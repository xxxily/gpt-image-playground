import * as React from 'react';
import { formatApiError } from '@/lib/api-error';
import { executeTask, type TaskExecutionParams, type TaskProgress } from '@/lib/taskExecutor';
import type { TaskStatus } from '@/lib/tasks';
import type { HistoryMetadata } from '@/types/history';
import type { GptImageModel } from '@/lib/cost-utils';
import type { StoredCustomImageModel } from '@/lib/model-registry';
import type { ProviderOptions } from '@/lib/provider-options';

export interface SubmitParams {
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
}

interface TaskState {
    id: string;
    mode: 'generate' | 'edit';
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
    error?: string;
}

function generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useTaskManager(maxConcurrent: number = 3, onHistoryEntry?: (entry: HistoryMetadata) => void, blobUrlCacheRef?: React.MutableRefObject<Map<string, string>>) {
    const [tasks, setTasks] = React.useState<TaskState[]>([]);
    const [maxCon, setMaxCon] = React.useState(maxConcurrent);
    const abortControllersRef = React.useRef<Map<string, AbortController>>(new Map());
    const paramsRef = React.useRef<Map<string, SubmitParams>>(new Map());

    React.useEffect(() => {
        setMaxCon(maxConcurrent);
    }, [maxConcurrent]);

    React.useEffect(() => {
        const controllers = abortControllersRef.current;
        return () => {
            controllers.forEach((c) => c.abort());
        };
    }, []);

    const beginExecute = React.useCallback(
        (taskId: string) => {
            const params = paramsRef.current.get(taskId);
            if (!params) {
                setTasks((p) => p.map((t) => t.id === taskId ? { ...t, status: 'error' as TaskStatus, error: '任务参数丢失', completedAt: Date.now() } : t));
                return;
            }

            const controller = new AbortController();
            abortControllersRef.current.set(taskId, controller);
            const startTime = Date.now();

            setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'running' as TaskStatus, startedAt: Date.now() } : t));

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
                signal: controller.signal,
            };

            executeTask(execParams).then((result) => {
                if (controller.signal.aborted) {
                    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'cancelled' as TaskStatus, durationMs: Date.now() - startTime, completedAt: Date.now() } : t));
                    abortControllersRef.current.delete(taskId);
                    paramsRef.current.delete(taskId);
                    return;
                }

                if (typeof result === 'string') {
                    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'error' as TaskStatus, error: result, durationMs: Date.now() - startTime, completedAt: Date.now() } : t));
                } else {
                    setTasks((prev) =>
                        prev.map((t) =>
                            t.id === taskId
                                ? {
                                      ...t,
                                      status: 'done' as TaskStatus,
                                      result: { images: result.images, historyEntry: result.historyEntry },
                                      durationMs: result.durationMs,
                                      completedAt: Date.now(),
                                      streamingPreviews: new Map(),
                                  }
                                : t
                        )
                    );
                    onHistoryEntry?.(result.historyEntry);
                    if (blobUrlCacheRef) {
                        result.images.forEach(img => {
                            blobUrlCacheRef.current.set(img.filename, img.path);
                        });
                    }
                }

                abortControllersRef.current.delete(taskId);
                paramsRef.current.delete(taskId);
            }).catch((error: unknown) => {
                const status = controller.signal.aborted ? 'cancelled' : 'error';
                const errorMessage = status === 'error' ? formatApiError(error, '任务执行失败') : undefined;

                setTasks((prev) => prev.map((t) => t.id === taskId ? {
                    ...t,
                    status: status as TaskStatus,
                    error: errorMessage,
                    durationMs: Date.now() - startTime,
                    completedAt: Date.now()
                } : t));
                abortControllersRef.current.delete(taskId);
                paramsRef.current.delete(taskId);
            });
        },
        [onHistoryEntry, blobUrlCacheRef]
    );

    React.useEffect(() => {
        const active = tasks.filter((t) => t.status === 'running' || t.status === 'streaming').length;
        const availableSlots = Math.max(0, maxCon - active);
        const queuedTasks = tasks.filter((t) => t.status === 'queued').slice(0, availableSlots);
        queuedTasks.forEach((task) => beginExecute(task.id));
    }, [tasks, maxCon, beginExecute]);

    const submitTask = React.useCallback((params: SubmitParams) => {
        const id = generateId();
        paramsRef.current.set(id, params);

        const newTask: TaskState = {
            id,
            mode: params.mode,
            status: 'queued',
            prompt: params.prompt,
            model: params.model,
            createdAt: Date.now(),
            streamingPreviews: new Map(),
            durationMs: 0,
        };

        setTasks((prev) => [...prev, newTask]);

        return id;
    }, []);

    const cancelTask = React.useCallback((taskId: string) => {
        const controller = abortControllersRef.current.get(taskId);
        if (controller) {
            controller.abort();
        } else {
            setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: 'cancelled' as TaskStatus, completedAt: Date.now() } : t));
            paramsRef.current.delete(taskId);
        }
    }, []);

    const clearCompleted = React.useCallback(() => {
        setTasks((prev) => prev.filter((t) => t.status === 'running' || t.status === 'streaming' || t.status === 'queued'));
    }, []);

    return {
        tasks,
        submitTask,
        cancelTask,
        clearCompleted,
        maxConcurrent: maxCon,
    };
}
