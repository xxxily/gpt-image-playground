import * as React from 'react';

import { formatApiError } from '@/lib/api-error';
import type { ModelCatalogEntry, ProviderEndpoint } from '@/lib/provider-model-catalog';
import {
    cancelVideoJob,
    downloadVideoResult,
    pollVideoJobUntilDone,
    submitVideoTask,
    type VideoExecutorContext
} from '@/lib/video-executor';
import { mergeRestoredVideoHistory, saveVideoHistory } from '@/lib/video-history';
import {
    getVideoJob,
    listResumableVideoJobs,
    recordVideoJob,
    removeVideoJob,
    updateVideoJob
} from '@/lib/video-job-store';
import type { VideoAdapterSourceImage } from '@/lib/video-providers/adapter';
import { VideoAdapterError } from '@/lib/video-providers/adapter';
import { bootstrapVideoAdapters } from '@/lib/video-providers/bootstrap';
import {
    type VideoGenerationJob,
    type VideoGenerationParameters,
    type VideoGenerationStatus,
    type VideoHistoryMetadata,
    type VideoResultAssetRef,
    type VideoSourceAssetRef
} from '@/lib/video-types';
import { persistVideoAsset } from '@/lib/video-asset-store';

export type VideoConnectionMode = 'proxy' | 'direct';

export type VideoTaskSubmitInput = {
    connectionMode: VideoConnectionMode;
    taskMode: 'text-to-video' | 'image-to-video';
    endpoint: ProviderEndpoint;
    catalogEntry: ModelCatalogEntry;
    prompt: string;
    negativePrompt?: string;
    parameters: VideoGenerationParameters;
    sourceImages: VideoAdapterSourceImage[];
    sourceAssetRefs?: VideoSourceAssetRef[];
    passwordHash?: string;
    callbackUrl?: string;
    autoDownload?: boolean;
};

export type VideoTaskRecord = {
    jobId: string;
    providerJobId?: string;
    providerRequestId?: string;
    status: VideoGenerationStatus;
    taskMode: 'text-to-video' | 'image-to-video';
    prompt: string;
    catalogEntryId: string;
    rawModelId: string;
    providerEndpointId: string;
    parameters: VideoGenerationParameters;
    sourceAssetRefs: VideoSourceAssetRef[];
    progress?: number;
    createdAt: number;
    updatedAt: number;
    startedAt?: number;
    completedAt?: number;
    resultRemoteUrl?: string;
    resultRemoteUrlExpiresAt?: number;
    thumbnailRemoteUrl?: string;
    resultAssetRefs?: VideoResultAssetRef[];
    errorCode?: string;
    errorMessage?: string;
    historyEntry?: VideoHistoryMetadata;
};

export type VideoTaskManagerOptions = {
    connectionMode?: VideoConnectionMode;
    passwordHash?: string;
    pollingBaseIntervalMs?: number;
    pollingMaxIntervalMs?: number;
    pollingTimeoutMs?: number;
    onHistoryEntry?: (entry: VideoHistoryMetadata) => void;
    onNotice?: (message: string) => void;
    executorContext?: VideoExecutorContext;
    autoDownload?: boolean;
};

type InternalState = {
    tasks: VideoTaskRecord[];
    resumableCount: number;
};

type AbortMap = Map<string, AbortController>;

const TERMINAL: VideoGenerationStatus[] = ['succeeded', 'failed', 'cancelled', 'expired'];

function isTerminal(status: VideoGenerationStatus): boolean {
    return TERMINAL.includes(status);
}

function buildJobRecord(record: VideoTaskRecord, endpoint: ProviderEndpoint, protocol: string) {
    return {
        id: record.jobId,
        providerJobId: record.providerJobId,
        providerRequestId: record.providerRequestId,
        status: record.status,
        progress: record.progress,
        createdAt: record.createdAt,
        updatedAt: Date.now(),
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        errorCode: record.errorCode,
        errorMessage: record.errorMessage,
        resultRemoteUrl: record.resultRemoteUrl,
        resultRemoteUrlExpiresAt: record.resultRemoteUrlExpiresAt,
        thumbnailRemoteUrl: record.thumbnailRemoteUrl,
        providerEndpointId: endpoint.id,
        protocol,
        taskMode: record.taskMode
    };
}

function deriveHistoryEntry(record: VideoTaskRecord, endpoint: ProviderEndpoint): VideoHistoryMetadata {
    const job: VideoGenerationJob = {
        id: record.jobId,
        providerJobId: record.providerJobId,
        providerRequestId: record.providerRequestId,
        status: record.status,
        progress: record.progress,
        createdAt: record.createdAt,
        updatedAt: Date.now(),
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        errorCode: record.errorCode,
        errorMessage: record.errorMessage,
        resultRemoteUrl: record.resultRemoteUrl,
        resultRemoteUrlExpiresAt: record.resultRemoteUrlExpiresAt,
        thumbnailRemoteUrl: record.thumbnailRemoteUrl
    };
    return {
        id: record.jobId,
        type: record.taskMode,
        timestamp: record.createdAt,
        durationMs: record.completedAt && record.startedAt ? record.completedAt - record.startedAt : undefined,
        prompt: record.prompt,
        providerEndpointId: endpoint.id,
        providerEndpointName: endpoint.name,
        providerKind: endpoint.provider,
        providerProtocol: endpoint.protocol,
        catalogEntryId: record.catalogEntryId,
        rawModelId: record.rawModelId,
        sourceAssets: record.sourceAssetRefs,
        resultAssets: record.resultAssetRefs ?? [],
        job,
        parameters: record.parameters,
        syncStatus: 'local_only'
    };
}

async function downloadResultBlob(
    record: VideoTaskRecord,
    endpoint: ProviderEndpoint,
    connectionMode: VideoConnectionMode,
    passwordHash: string | undefined,
    executorContext: VideoExecutorContext | undefined,
    signal?: AbortSignal
): Promise<VideoResultAssetRef[]> {
    if (!record.resultRemoteUrl) return [];
    const response = await downloadVideoResult(
        {
            connectionMode,
            endpoint,
            providerJobId: record.providerJobId,
            resultRemoteUrl: record.resultRemoteUrl,
            passwordHash,
            signal
        },
        executorContext
    );
    if (!response.ok) {
        throw new VideoAdapterError({
            code: 'video_download_failed',
            message: `Failed to download video: HTTP ${response.status}`,
            status: response.status
        });
    }
    const contentType = response.headers.get('content-type') ?? 'video/mp4';
    const blob = await response.blob();
    const blobWithType = blob.type ? blob : new Blob([blob], { type: contentType });
    const persisted = await persistVideoAsset(blobWithType, 'video', {
        durationSeconds: record.parameters.durationSeconds,
        remoteUrlExpiresAt: record.resultRemoteUrlExpiresAt
    });
    return [
        {
            filename: persisted.filename,
            kind: 'video',
            mimeType: persisted.mimeType,
            storageModeUsed: persisted.storageModeUsed,
            size: persisted.size,
            sha256: persisted.sha256 || undefined,
            durationSeconds: record.parameters.durationSeconds,
            ...(record.resultRemoteUrl ? { remoteUrl: record.resultRemoteUrl } : {}),
            ...(record.resultRemoteUrlExpiresAt
                ? { remoteUrlExpiresAt: record.resultRemoteUrlExpiresAt }
                : {}),
            syncStatus: 'local_only'
        }
    ];
}

export function useVideoTaskManager(options: VideoTaskManagerOptions = {}) {
    const [state, setState] = React.useState<InternalState>({ tasks: [], resumableCount: 0 });
    const abortControllers = React.useRef<AbortMap>(new Map());
    const taskMetaRef = React.useRef<Map<string, { endpoint: ProviderEndpoint; catalogEntry: ModelCatalogEntry }>>(
        new Map()
    );
    const mountedRef = React.useRef(true);

    React.useEffect(() => {
        bootstrapVideoAdapters();
        const controllers = abortControllers.current;
        const meta = taskMetaRef.current;
        return () => {
            mountedRef.current = false;
            controllers.forEach((controller) => controller.abort());
            controllers.clear();
            meta.clear();
        };
    }, []);

    const safeSetState = React.useCallback((updater: (prev: InternalState) => InternalState) => {
        if (!mountedRef.current) return;
        setState(updater);
    }, []);

    const updateTask = React.useCallback(
        (jobId: string, patch: Partial<VideoTaskRecord>) => {
            safeSetState((prev) => ({
                ...prev,
                tasks: prev.tasks.map((task) => (task.jobId === jobId ? { ...task, ...patch } : task))
            }));
        },
        [safeSetState]
    );

    const finalizeTask = React.useCallback(
        async (jobId: string, finalStatus: VideoGenerationStatus, errorMessage?: string, errorCode?: string) => {
            const meta = taskMetaRef.current.get(jobId);
            const protocol = meta?.endpoint.protocol ?? 'openai-videos';

            safeSetState((prev) => {
                const updated = prev.tasks.map((task) => {
                    if (task.jobId !== jobId) return task;
                    return {
                        ...task,
                        status: finalStatus,
                        completedAt: Date.now(),
                        errorCode: errorCode ?? task.errorCode,
                        errorMessage: errorMessage ?? task.errorMessage
                    };
                });
                return { ...prev, tasks: updated };
            });

            if (meta) {
                const currentTask = state.tasks.find((task) => task.jobId === jobId);
                if (currentTask) {
                    await updateVideoJob(jobId, {
                        status: finalStatus,
                        errorCode: errorCode,
                        errorMessage: errorMessage,
                        completedAt: Date.now()
                    });
                    if (isTerminal(finalStatus)) {
                        await removeVideoJob(jobId).catch(() => undefined);
                    }
                }
                void protocol;
            }
        },
        [safeSetState, state.tasks]
    );

    const runPollingLoop = React.useCallback(
        async (jobId: string) => {
            const meta = taskMetaRef.current.get(jobId);
            if (!meta) return;
            const controller = abortControllers.current.get(jobId) ?? new AbortController();
            abortControllers.current.set(jobId, controller);

            try {
                const poll = await pollVideoJobUntilDone(
                    {
                        connectionMode: options.connectionMode ?? 'proxy',
                        endpoint: meta.endpoint,
                        catalogEntry: meta.catalogEntry,
                        providerJobId:
                            state.tasks.find((task) => task.jobId === jobId)?.providerJobId ?? jobId,
                        passwordHash: options.passwordHash,
                        signal: controller.signal
                    },
                    {
                        baseIntervalMs: options.pollingBaseIntervalMs,
                        maxIntervalMs: options.pollingMaxIntervalMs,
                        timeoutMs: options.pollingTimeoutMs,
                        onProgress: (snapshot) => {
                            updateTask(jobId, {
                                status: snapshot.status,
                                progress: snapshot.progress,
                                resultRemoteUrl: snapshot.resultRemoteUrl,
                                resultRemoteUrlExpiresAt: snapshot.resultRemoteUrlExpiresAt,
                                thumbnailRemoteUrl: snapshot.thumbnailRemoteUrl,
                                errorCode: snapshot.errorCode,
                                errorMessage: snapshot.errorMessage
                            });
                            void updateVideoJob(jobId, {
                                status: snapshot.status,
                                progress: snapshot.progress,
                                resultRemoteUrl: snapshot.resultRemoteUrl,
                                resultRemoteUrlExpiresAt: snapshot.resultRemoteUrlExpiresAt,
                                thumbnailRemoteUrl: snapshot.thumbnailRemoteUrl,
                                errorCode: snapshot.errorCode,
                                errorMessage: snapshot.errorMessage
                            });
                        }
                    },
                    options.executorContext
                );

                if (poll.status === 'succeeded' && (options.autoDownload ?? true)) {
                    const recordSnapshot = state.tasks.find((task) => task.jobId === jobId);
                    if (recordSnapshot) {
                        const refs = await downloadResultBlob(
                            { ...recordSnapshot, resultRemoteUrl: poll.resultRemoteUrl ?? recordSnapshot.resultRemoteUrl },
                            meta.endpoint,
                            options.connectionMode ?? 'proxy',
                            options.passwordHash,
                            options.executorContext,
                            controller.signal
                        ).catch((error) => {
                            options.onNotice?.(formatApiError(error, 'Video download failed.'));
                            return [];
                        });

                        if (refs.length > 0) {
                            updateTask(jobId, { resultAssetRefs: refs });
                        }
                    }
                }

                await finalizeTask(jobId, poll.status, poll.errorMessage, poll.errorCode);

                if (poll.status === 'succeeded') {
                    const final = state.tasks.find((task) => task.jobId === jobId);
                    if (final) {
                        const entry = deriveHistoryEntry({ ...final, ...poll }, meta.endpoint);
                        const merged = mergeRestoredVideoHistory([], [entry]);
                        saveVideoHistory(merged);
                        options.onHistoryEntry?.(entry);
                        updateTask(jobId, { historyEntry: entry });
                    }
                }
            } catch (error) {
                if ((error as DOMException)?.name === 'AbortError') {
                    await finalizeTask(jobId, 'cancelled', 'Cancelled by user');
                    return;
                }
                const message = formatApiError(error, 'Video task polling failed.');
                await finalizeTask(jobId, 'failed', message, error instanceof VideoAdapterError ? error.code : undefined);
                options.onNotice?.(message);
            } finally {
                abortControllers.current.delete(jobId);
            }
        },
        [
            finalizeTask,
            options,
            state.tasks,
            updateTask
        ]
    );

    const submit = React.useCallback(
        async (input: VideoTaskSubmitInput): Promise<VideoTaskRecord | null> => {
            bootstrapVideoAdapters();
            try {
                const controller = new AbortController();
                const result = await submitVideoTask(
                    {
                        connectionMode: input.connectionMode,
                        endpoint: input.endpoint,
                        catalogEntry: input.catalogEntry,
                        taskMode: input.taskMode,
                        prompt: input.prompt,
                        negativePrompt: input.negativePrompt,
                        parameters: input.parameters,
                        sourceImages: input.sourceImages,
                        callbackUrl: input.callbackUrl,
                        passwordHash: input.passwordHash,
                        signal: controller.signal
                    },
                    options.executorContext
                );

                const record: VideoTaskRecord = {
                    jobId: result.job.id,
                    providerJobId: result.job.providerJobId,
                    providerRequestId: result.job.providerRequestId,
                    status: result.job.status,
                    taskMode: input.taskMode,
                    prompt: input.prompt,
                    catalogEntryId: input.catalogEntry.id,
                    rawModelId: input.catalogEntry.rawModelId,
                    providerEndpointId: input.endpoint.id,
                    parameters: input.parameters,
                    sourceAssetRefs: input.sourceAssetRefs ?? [],
                    progress: result.job.progress,
                    createdAt: result.job.createdAt,
                    updatedAt: result.job.updatedAt,
                    startedAt: result.job.startedAt
                };

                taskMetaRef.current.set(record.jobId, {
                    endpoint: input.endpoint,
                    catalogEntry: input.catalogEntry
                });
                abortControllers.current.set(record.jobId, controller);
                safeSetState((prev) => ({ ...prev, tasks: [record, ...prev.tasks] }));
                await recordVideoJob(buildJobRecord(record, input.endpoint, input.endpoint.protocol));
                void runPollingLoop(record.jobId);
                return record;
            } catch (error) {
                const message = formatApiError(error, 'Failed to submit video task.');
                options.onNotice?.(message);
                return null;
            }
        },
        [options, runPollingLoop, safeSetState]
    );

    const cancel = React.useCallback(
        async (jobId: string) => {
            const controller = abortControllers.current.get(jobId);
            controller?.abort();
            const meta = taskMetaRef.current.get(jobId);
            const task = state.tasks.find((entry) => entry.jobId === jobId);
            if (meta && task?.providerJobId) {
                try {
                    await cancelVideoJob(
                        {
                            connectionMode: options.connectionMode ?? 'proxy',
                            endpoint: meta.endpoint,
                            providerJobId: task.providerJobId,
                            passwordHash: options.passwordHash
                        },
                        options.executorContext
                    );
                } catch (error) {
                    options.onNotice?.(formatApiError(error, 'Failed to cancel video task on the provider side.'));
                }
            }
            await finalizeTask(jobId, 'cancelled', 'Cancelled by user');
        },
        [finalizeTask, options, state.tasks]
    );

    const dismiss = React.useCallback(
        async (jobId: string) => {
            const controller = abortControllers.current.get(jobId);
            controller?.abort();
            abortControllers.current.delete(jobId);
            taskMetaRef.current.delete(jobId);
            safeSetState((prev) => ({
                ...prev,
                tasks: prev.tasks.filter((task) => task.jobId !== jobId)
            }));
            await removeVideoJob(jobId).catch(() => undefined);
        },
        [safeSetState]
    );

    const refreshResumable = React.useCallback(async () => {
        const jobs = await listResumableVideoJobs();
        safeSetState((prev) => ({ ...prev, resumableCount: jobs.length }));
        return jobs;
    }, [safeSetState]);

    const resumeAll = React.useCallback(
        async (
            resolveEndpoint: (providerEndpointId: string) => ProviderEndpoint | null,
            resolveCatalogEntry: (catalogEntryId: string) => ModelCatalogEntry | null
        ): Promise<number> => {
            const jobs = await listResumableVideoJobs();
            let resumed = 0;
            for (const job of jobs) {
                const endpoint = resolveEndpoint(job.providerEndpointId);
                if (!endpoint) continue;
                const existing = await getVideoJob(job.id);
                if (!existing) continue;
                const catalogEntry = resolveCatalogEntry(
                    `${endpoint.id}::${encodeURIComponent(existing.providerJobId ?? '')}`
                );
                if (!catalogEntry) continue;
                taskMetaRef.current.set(job.id, { endpoint, catalogEntry });
                safeSetState((prev) => ({
                    ...prev,
                    tasks: [
                        {
                            jobId: job.id,
                            providerJobId: job.providerJobId,
                            providerRequestId: job.providerRequestId,
                            status: job.status,
                            taskMode: job.taskMode,
                            prompt: '',
                            catalogEntryId: catalogEntry.id,
                            rawModelId: catalogEntry.rawModelId,
                            providerEndpointId: endpoint.id,
                            parameters: {},
                            sourceAssetRefs: [],
                            createdAt: job.createdAt,
                            updatedAt: job.updatedAt,
                            startedAt: job.startedAt,
                            resultRemoteUrl: job.resultRemoteUrl,
                            resultRemoteUrlExpiresAt: job.resultRemoteUrlExpiresAt,
                            thumbnailRemoteUrl: job.thumbnailRemoteUrl
                        },
                        ...prev.tasks
                    ]
                }));
                void runPollingLoop(job.id);
                resumed += 1;
            }
            return resumed;
        },
        [runPollingLoop, safeSetState]
    );

    return {
        tasks: state.tasks,
        resumableCount: state.resumableCount,
        submit,
        cancel,
        dismiss,
        refreshResumable,
        resumeAll
    };
}
