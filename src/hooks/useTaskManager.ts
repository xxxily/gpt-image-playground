import { generateId, generateShortId } from '@/lib/id';
import { formatApiError } from '@/lib/api-error';
import { categorizeApiError } from '@/lib/api-error-category';
import { blobUrlStore } from '@/lib/blob-url-store';
import type { GptImageModel } from '@/lib/cost-utils';
import { persistHistorySourceImages } from '@/lib/history-assets';
import type { StoredCustomImageModel } from '@/lib/model-registry';
import type { ProviderOptions } from '@/lib/provider-options';
import type { ProviderUsage } from '@/lib/provider-types';
import { notifyTaskCompletion } from '@/lib/tab-notification';
import {
    executeImageToTextTask,
    executeTask,
    type ImageToTextExecutionParams,
    type TaskExecutionParams,
    type TaskProgress
} from '@/lib/taskExecutor';
import type { TaskStatus } from '@/lib/tasks';
import type { VisionTextProviderInstance } from '@/lib/vision-text-provider-instances';
import type {
    ImageToTextStructuredResult,
    VisionTextApiCompatibility,
    VisionTextDetail,
    VisionTextProviderKind,
    VisionTextResponseFormat,
    VisionTextTaskType
} from '@/lib/vision-text-types';
import type { HistoryMetadata, VisionTextHistoryMetadata } from '@/types/history';
import * as React from 'react';

export type WorkbenchTaskMode = 'generate' | 'edit' | 'image-to-text' | 'text-to-video' | 'image-to-video';

export type BatchTaskMetadata = {
    batchId?: string;
    batchIndex?: number;
    batchTotal?: number;
    batchLabel?: string;
};

export type ImageSubmitParams = {
    mode: 'generate' | 'edit';
    model: GptImageModel;
    prompt: string;
    n: number;
    size?: string;
    quality?: 'low' | 'medium' | 'high' | 'auto';
    output_format?: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background?: 'transparent' | 'opaque' | 'auto';
    moderation?: 'low' | 'auto';
    imageFiles?: File[];
    maskFile?: File | null;
    enableStreaming: boolean;
    partialImages: 1 | 2 | 3;
    connectionMode: 'proxy' | 'direct';
    providerInstanceId?: string;
    apiKey?: string;
    apiBaseUrl?: string;
    geminiApiKey?: string;
    geminiApiBaseUrl?: string;
    sensenovaApiKey?: string;
    sensenovaApiBaseUrl?: string;
    seedreamApiKey?: string;
    seedreamApiBaseUrl?: string;
    customImageModels?: StoredCustomImageModel[];
    providerOptions?: ProviderOptions;
    passwordHash?: string;
    imageStorageMode: 'fs' | 'indexeddb' | 'auto';
    imageStoragePath?: string;
} & BatchTaskMetadata;

export type ImageToTextSubmitParams = {
    mode: 'image-to-text';
    model: string;
    prompt: string;
    imageFiles: File[];
    connectionMode: 'proxy' | 'direct';
    providerKind: VisionTextProviderKind;
    providerInstances: readonly VisionTextProviderInstance[];
    providerInstanceId?: string;
    taskType: VisionTextTaskType;
    detail: VisionTextDetail;
    responseFormat: VisionTextResponseFormat;
    streamingEnabled: boolean;
    structuredOutputEnabled: boolean;
    maxOutputTokens: number;
    systemPrompt: string;
    apiCompatibility: VisionTextApiCompatibility;
    apiKey?: string;
    apiBaseUrl?: string;
    openaiApiKey?: string;
    openaiApiBaseUrl?: string;
    passwordHash?: string;
    imageStorageMode: 'fs' | 'indexeddb' | 'auto';
    imageStoragePath?: string;
} & BatchTaskMetadata;

export type SubmitParams = ImageSubmitParams | ImageToTextSubmitParams;

interface TaskState {
    id: string;
    mode: WorkbenchTaskMode;
    status: TaskStatus;
    prompt: string;
    model: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    streamingPreviews: Map<number, string>;
    durationMs: number;
    result?: {
        images: { path: string; filename: string }[];
        historyEntry: HistoryMetadata;
    };
    textResult?: {
        text: string;
        structured: ImageToTextStructuredResult | null;
        durationMs: number;
        providerInstanceId: string;
        model: string;
        usage?: ProviderUsage;
    };
    streamingText: string;
    error?: string;
    batchId?: string;
    batchIndex?: number;
    batchTotal?: number;
    batchLabel?: string;
}

function generateTaskId(): string {
    return generateId('task');
}

function generateVisionTextHistoryId(timestamp: number): string {
    const randomSuffix = generateShortId();
    return `vision_text_${timestamp}_${randomSuffix}`;
}

function applyBatchMetadata<T extends HistoryMetadata>(entry: T, params: SubmitParams): T {
    if (!params.batchId && !params.batchLabel && !params.batchIndex && !params.batchTotal) {
        return entry;
    }

    return {
        ...entry,
        ...(params.batchId ? { batchId: params.batchId } : {}),
        ...(typeof params.batchIndex === 'number' ? { batchIndex: params.batchIndex } : {}),
        ...(typeof params.batchTotal === 'number' ? { batchTotal: params.batchTotal } : {}),
        ...(params.batchLabel ? { batchLabel: params.batchLabel } : {})
    };
}

function createQueuedTaskState(id: string, params: SubmitParams, createdAt = Date.now()): TaskState {
    return {
        id,
        mode: params.mode,
        status: 'queued',
        prompt: params.prompt,
        model: params.model,
        createdAt,
        streamingPreviews: new Map(),
        streamingText: '',
        durationMs: 0,
        ...(params.batchId ? { batchId: params.batchId } : {}),
        ...(typeof params.batchIndex === 'number' ? { batchIndex: params.batchIndex } : {}),
        ...(typeof params.batchTotal === 'number' ? { batchTotal: params.batchTotal } : {}),
        ...(params.batchLabel ? { batchLabel: params.batchLabel } : {})
    };
}

export function useTaskManager(
    maxConcurrent: number = 3,
    onHistoryEntry?: (entry: HistoryMetadata) => void,
    onVisionTextHistoryEntry?: (entry: VisionTextHistoryMetadata) => void
) {
    const [tasks, setTasks] = React.useState<TaskState[]>([]);
    const [maxCon, setMaxCon] = React.useState(maxConcurrent);
    const abortControllersRef = React.useRef<Map<string, AbortController>>(new Map());
    const paramsRef = React.useRef<Map<string, SubmitParams>>(new Map());
    const retryParamsRef = React.useRef<Map<string, SubmitParams>>(new Map());

    React.useEffect(() => {
        setMaxCon(maxConcurrent);
    }, [maxConcurrent]);

    const previousTaskStatusesRef = React.useRef<Map<string, TaskStatus>>(new Map());

    React.useEffect(() => {
        const previous = previousTaskStatusesRef.current;
        tasks.forEach((task) => {
            const before = previous.get(task.id);
            if (before === task.status) return;
            previous.set(task.id, task.status);
            if (before && before !== task.status && (task.status === 'done' || task.status === 'error')) {
                notifyTaskCompletion({ kind: task.status === 'done' ? 'success' : 'error' });
            }
        });
        const liveIds = new Set(tasks.map((t) => t.id));
        for (const id of Array.from(previous.keys())) {
            if (!liveIds.has(id)) previous.delete(id);
        }
    }, [tasks]);

    React.useEffect(() => {
        const controllers = abortControllersRef.current;
        const pendingParams = paramsRef.current;
        const retryParams = retryParamsRef.current;
        return () => {
            controllers.forEach((c) => c.abort());
            controllers.clear();
            pendingParams.clear();
            retryParams.clear();
        };
    }, []);

    const releaseTaskParams = React.useCallback((taskId: string) => {
        paramsRef.current.delete(taskId);
        retryParamsRef.current.delete(taskId);
    }, []);

    const retainRetryParams = React.useCallback((taskId: string) => {
        const params = paramsRef.current.get(taskId) ?? retryParamsRef.current.get(taskId);
        if (params) retryParamsRef.current.set(taskId, params);
        paramsRef.current.delete(taskId);
    }, []);

    const beginExecute = React.useCallback(
        (taskId: string) => {
            const params = paramsRef.current.get(taskId);
            if (!params) {
                setTasks((p) =>
                    p.map((t) =>
                        t.id === taskId
                            ? { ...t, status: 'error' as TaskStatus, error: '任务参数丢失', errorCategory: categorizeApiError('任务参数丢失'), completedAt: Date.now() }
                            : t
                    )
                );
                retryParamsRef.current.delete(taskId);
                return;
            }

            const controller = new AbortController();
            abortControllersRef.current.set(taskId, controller);
            retryParamsRef.current.delete(taskId);
            const startTime = Date.now();
            const startMonotonic = typeof performance !== 'undefined' ? performance.now() : startTime;

            const elapsedMonotonic = () =>
                Math.round(typeof performance !== 'undefined' ? performance.now() - startMonotonic : Date.now() - startTime);

            setTasks((prev) =>
                prev.map((t) =>
                    t.id === taskId ? { ...t, status: 'running' as TaskStatus, startedAt: Date.now() } : t
                )
            );

            if (params.mode === 'image-to-text') {
                const onProgress: ImageToTextExecutionParams['onProgress'] = (progress) => {
                    if (controller.signal.aborted) return;
                    if (progress.type === 'text_delta') {
                        setTasks((prev) =>
                            prev.map((t) =>
                                t.id === taskId
                                    ? {
                                          ...t,
                                          status: 'streaming' as TaskStatus,
                                          streamingText: `${t.streamingText}${progress.delta}`
                                      }
                                    : t
                            )
                        );
                    } else if (progress.type === 'streaming_complete') {
                        setTasks((prev) =>
                            prev.map((t) =>
                                t.id === taskId
                                    ? {
                                          ...t,
                                          streamingText: progress.text,
                                          textResult: {
                                              text: progress.text,
                                              structured: progress.structured ?? null,
                                              durationMs: elapsedMonotonic(),
                                              providerInstanceId: params.providerInstanceId || '',
                                              model: params.model
                                          }
                                      }
                                    : t
                            )
                        );
                    }
                };

                executeImageToTextTask({
                    connectionMode: params.connectionMode,
                    providerKind: params.providerKind,
                    providerInstances: params.providerInstances,
                    providerInstanceId: params.providerInstanceId,
                    model: params.model,
                    prompt: params.prompt,
                    imageFiles: params.imageFiles,
                    taskType: params.taskType,
                    detail: params.detail,
                    responseFormat: params.responseFormat,
                    streamingEnabled: params.streamingEnabled,
                    structuredOutputEnabled: params.structuredOutputEnabled,
                    maxOutputTokens: params.maxOutputTokens,
                    systemPrompt: params.systemPrompt,
                    apiCompatibility: params.apiCompatibility,
                    apiKey: params.apiKey,
                    apiBaseUrl: params.apiBaseUrl,
                    openaiApiKey: params.openaiApiKey,
                    openaiApiBaseUrl: params.openaiApiBaseUrl,
                    passwordHash: params.passwordHash,
                    onProgress,
                    signal: controller.signal
                })
                    .then(async (result) => {
                        if (controller.signal.aborted) {
                            setTasks((prev) =>
                                prev.map((t) =>
                                    t.id === taskId
                                        ? {
                                              ...t,
                                              status: 'cancelled' as TaskStatus,
                                              durationMs: elapsedMonotonic(),
                                              completedAt: Date.now()
                                          }
                                        : t
                                )
                            );
                            abortControllersRef.current.delete(taskId);
                            releaseTaskParams(taskId);
                            return;
                        }

                        if (typeof result === 'string') {
                            setTasks((prev) =>
                                prev.map((t) =>
                                    t.id === taskId
                                        ? {
                                              ...t,
                                              status: 'error' as TaskStatus,
                                              error: result,
                                              errorCategory: categorizeApiError(result),
                                              durationMs: elapsedMonotonic(),
                                              completedAt: Date.now()
                                          }
                                        : t
                                )
                            );
                            retainRetryParams(taskId);
                        } else {
                            setTasks((prev) =>
                                prev.map((t) =>
                                    t.id === taskId
                                        ? {
                                              ...t,
                                              status: 'done' as TaskStatus,
                                              textResult: {
                                                  text: result.text,
                                                  structured: result.structured,
                                                  durationMs: result.durationMs,
                                                  providerInstanceId: result.providerInstanceId,
                                                  model: result.model,
                                                  usage: result.usage as ProviderUsage | undefined
                                              },
                                              streamingText: result.text,
                                              durationMs: result.durationMs,
                                              completedAt: Date.now()
                                          }
                                        : t
                                )
                            );

                            if (onVisionTextHistoryEntry) {
                                try {
                                    const timestamp = Date.now();
                                    const sourceImageResult = await persistHistorySourceImages(params.imageFiles, {
                                        storageMode: params.imageStorageMode,
                                        desktopStoragePath: params.imageStoragePath,
                                        passwordHash: params.passwordHash,
                                        source: 'uploaded',
                                        timestamp
                                    });
                                    const providerInstance = params.providerInstances.find(
                                        (instance) => instance.id === result.providerInstanceId
                                    );
                                    const historyEntry: VisionTextHistoryMetadata = {
                                        id: generateVisionTextHistoryId(timestamp),
                                        type: 'image-to-text',
                                        timestamp,
                                        durationMs: result.durationMs,
                                        prompt: params.prompt,
                                        taskType: params.taskType,
                                        detail: params.detail,
                                        responseFormat: params.responseFormat,
                                        structuredOutputEnabled: params.structuredOutputEnabled,
                                        maxOutputTokens: params.maxOutputTokens,
                                        sourceImages: sourceImageResult.refs,
                                        resultText: result.text,
                                        structuredResult: result.structured,
                                        providerKind: result.provider,
                                        providerInstanceId: result.providerInstanceId,
                                        providerInstanceName: providerInstance?.name,
                                        model: result.model,
                                        apiCompatibility: params.apiCompatibility,
                                        usage: result.usage as ProviderUsage | undefined,
                                        syncStatus: sourceImageResult.failedCount > 0 ? 'partial' : 'local_only'
                                    };
                                    onVisionTextHistoryEntry(historyEntry);
                                } catch (historyError) {
                                    console.warn('Failed to save image-to-text history entry:', historyError);
                                }
                            }
                            releaseTaskParams(taskId);
                        }

                        abortControllersRef.current.delete(taskId);
                    })
                    .catch((error: unknown) => {
                        const taskStatus = controller.signal.aborted ? 'cancelled' : 'error';
                        const errorMessage =
                            taskStatus === 'error' ? formatApiError(error, '图生文任务执行失败') : undefined;
                        const errorCategory =
                            taskStatus === 'error'
                                ? categorizeApiError(error, typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined)
                                : undefined;

                        setTasks((prev) =>
                            prev.map((t) =>
                                t.id === taskId
                                    ? {
                                          ...t,
                                          status: taskStatus as TaskStatus,
                                          error: errorMessage,
                                          errorCategory,
                                          durationMs: elapsedMonotonic(),
                                          completedAt: Date.now()
                                      }
                                    : t
                            )
                        );
                        abortControllersRef.current.delete(taskId);
                        if (taskStatus === 'error') {
                            retainRetryParams(taskId);
                        } else {
                            releaseTaskParams(taskId);
                        }
                    });
                return;
            }

            // TODO Phase E: handle text-to-video/image-to-video. SubmitParams currently
            // does not include video variants, so any video task is unreachable here.
            // When Phase E adds VideoSubmitParams to the SubmitParams union, restore the
            // defensive branch that flips the task to 'error' until video-executor wires up.

            const onProgress = (progress: TaskProgress) => {
                if (controller.signal.aborted) return;
                if (progress.type === 'streaming_partial') {
                    setTasks((prev) =>
                        prev.map((t) => {
                            if (t.id !== taskId) return t;
                            const map = new Map(t.streamingPreviews);
                            map.set(progress.index, `data:image/png;base64,${progress.b64_json}`);
                            return { ...t, status: 'streaming' as TaskStatus, streamingPreviews: map };
                        })
                    );
                }
            };

            const execParams: TaskExecutionParams = {
                connectionMode: params.connectionMode,
                providerInstanceId: params.providerInstanceId,
                apiKey: params.apiKey,
                apiBaseUrl: params.apiBaseUrl,
                geminiApiKey: params.geminiApiKey,
                geminiApiBaseUrl: params.geminiApiBaseUrl,
                sensenovaApiKey: params.sensenovaApiKey,
                sensenovaApiBaseUrl: params.sensenovaApiBaseUrl,
                seedreamApiKey: params.seedreamApiKey,
                seedreamApiBaseUrl: params.seedreamApiBaseUrl,
                customImageModels: params.customImageModels,
                providerOptions: params.providerOptions,
                passwordHash: params.passwordHash,
                imageStorageMode: params.imageStorageMode,
                imageStoragePath: params.imageStoragePath,
                mode: params.mode,
                model: params.model,
                prompt: params.prompt,
                n: params.n,
                size: params.size,
                quality: params.quality,
                output_format: params.output_format,
                output_compression: params.output_compression,
                background: params.background,
                moderation: params.moderation,
                editImages: params.imageFiles,
                editMaskFile: params.maskFile,
                enableStreaming: params.enableStreaming,
                partialImages: params.partialImages,
                onProgress,
                signal: controller.signal
            };

            executeTask(execParams)
                .then((result) => {
                    if (controller.signal.aborted) {
                        setTasks((prev) =>
                            prev.map((t) =>
                                t.id === taskId
                                    ? {
                                          ...t,
                                          status: 'cancelled' as TaskStatus,
                                          durationMs: elapsedMonotonic(),
                                          completedAt: Date.now()
                                      }
                                    : t
                            )
                        );
                        abortControllersRef.current.delete(taskId);
                        releaseTaskParams(taskId);
                        return;
                    }

                    if (typeof result === 'string') {
                        setTasks((prev) =>
                            prev.map((t) =>
                                t.id === taskId
                                    ? {
                                          ...t,
                                          status: 'error' as TaskStatus,
                                          error: result,
                                          errorCategory: categorizeApiError(result),
                                          durationMs: elapsedMonotonic(),
                                          completedAt: Date.now()
                                      }
                                    : t
                            )
                        );
                        retainRetryParams(taskId);
                    } else {
                        const historyEntry = applyBatchMetadata(result.historyEntry, params);
                        setTasks((prev) =>
                            prev.map((t) =>
                                t.id === taskId
                                    ? {
                                          ...t,
                                          status: 'done' as TaskStatus,
                                          result: { images: result.images, historyEntry },
                                          durationMs: result.durationMs,
                                          completedAt: Date.now(),
                                          streamingPreviews: new Map()
                                      }
                                    : t
                            )
                        );
                        onHistoryEntry?.(historyEntry);
                        result.images.forEach((img) => {
                            blobUrlStore.set(img.filename, img.path);
                        });
                        releaseTaskParams(taskId);
                    }

                    abortControllersRef.current.delete(taskId);
                })
                .catch((error: unknown) => {
                    const taskStatus = controller.signal.aborted ? 'cancelled' : 'error';
                    const errorMessage = taskStatus === 'error' ? formatApiError(error, '任务执行失败') : undefined;
                    const errorCategory =
                        taskStatus === 'error'
                            ? categorizeApiError(error, typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined)
                            : undefined;

                    setTasks((prev) =>
                        prev.map((t) =>
                            t.id === taskId
                                ? {
                                      ...t,
                                      status: taskStatus as TaskStatus,
                                      error: errorMessage,
                                      errorCategory,
                                      durationMs: elapsedMonotonic(),
                                      completedAt: Date.now()
                                  }
                                : t
                        )
                    );
                    abortControllersRef.current.delete(taskId);
                    if (taskStatus === 'error') {
                        retainRetryParams(taskId);
                    } else {
                        releaseTaskParams(taskId);
                    }
                });
        },
        [onHistoryEntry, onVisionTextHistoryEntry, releaseTaskParams, retainRetryParams]
    );

    React.useEffect(() => {
        const active = tasks.filter((t) => t.status === 'running' || t.status === 'streaming').length;
        const availableSlots = Math.max(0, maxCon - active);
        const queuedTasks = tasks.filter((t) => t.status === 'queued').slice(0, availableSlots);
        queuedTasks.forEach((task) => beginExecute(task.id));
    }, [tasks, maxCon, beginExecute]);

    const submitTasks = React.useCallback((paramsList: SubmitParams[]) => {
        if (paramsList.length === 0) return [] as string[];

        const createdAt = Date.now();
        const newTasks: TaskState[] = [];
        const ids: string[] = [];

        paramsList.forEach((params) => {
            const id = generateTaskId();
            ids.push(id);
            paramsRef.current.set(id, params);
            retryParamsRef.current.delete(id);
            newTasks.push(createQueuedTaskState(id, params, createdAt));
        });

        setTasks((prev) => [...prev, ...newTasks]);
        return ids;
    }, []);

    const submitTask = React.useCallback((params: SubmitParams) => {
        const [taskId] = submitTasks([params]);
        return taskId;
    }, [submitTasks]);

    const retryTask = React.useCallback((taskId: string) => {
        const params = retryParamsRef.current.get(taskId);
        if (!params) {
            setTasks((prev) =>
                prev.map((t) =>
                    t.id === taskId ? { ...t, status: 'error' as TaskStatus, error: '任务参数已释放，请重新提交。', errorCategory: categorizeApiError('任务参数已释放，请重新提交。') } : t
                )
            );
            return false;
        }

        paramsRef.current.set(taskId, params);
        retryParamsRef.current.delete(taskId);
        const now = Date.now();
        setTasks((prev) =>
            prev.map((t) =>
                t.id === taskId
                    ? {
                          ...t,
                          mode: params.mode,
                          status: 'queued' as TaskStatus,
                          prompt: params.prompt,
                          model: params.model,
                          createdAt: now,
                          startedAt: undefined,
                          completedAt: undefined,
                          streamingPreviews: new Map(),
                          streamingText: '',
                          durationMs: 0,
                          result: undefined,
                          textResult: undefined,
                          error: undefined
                      }
                    : t
            )
        );
        return true;
    }, []);

    const cancelTask = React.useCallback(
        (taskId: string) => {
            const controller = abortControllersRef.current.get(taskId);
            if (controller) {
                controller.abort();
                releaseTaskParams(taskId);
            } else {
                setTasks((prev) =>
                    prev.map((t) =>
                        t.id === taskId ? { ...t, status: 'cancelled' as TaskStatus, completedAt: Date.now() } : t
                    )
                );
                releaseTaskParams(taskId);
            }
        },
        [releaseTaskParams]
    );

    const clearCompleted = React.useCallback(() => {
        setTasks((prev) => {
            prev.forEach((t) => {
                if (t.status !== 'running' && t.status !== 'streaming' && t.status !== 'queued') {
                    releaseTaskParams(t.id);
                }
            });
            return prev.filter((t) => t.status === 'running' || t.status === 'streaming' || t.status === 'queued');
        });
    }, [releaseTaskParams]);

    return {
        tasks,
        submitTask,
        submitTasks,
        cancelTask,
        retryTask,
        clearCompleted,
        maxConcurrent: maxCon
    };
}
