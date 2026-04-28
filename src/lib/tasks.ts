import type { HistoryMetadata } from '@/types/history';

export type TaskStatus = 'queued' | 'running' | 'streaming' | 'done' | 'error' | 'cancelled';

export type TaskMode = 'generate' | 'edit';

export interface TaskSnapshot {
    id: string;
    mode: TaskMode;
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
    params: {
        mode: TaskMode;
        model: string;
        prompt: string;
        n: number;
        size?: string;
        quality?: string;
        output_format?: string;
        output_compression?: number;
        background?: string;
        moderation?: string;
        imageCount?: number;
        hasMask?: boolean;
    };
}

export function createTaskSnapshot(mode: TaskMode, prompt: string, model: string, params: TaskSnapshot['params']): TaskSnapshot {
    return {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mode,
        status: 'queued',
        prompt,
        model,
        createdAt: Date.now(),
        streamingPreviews: new Map(),
        durationMs: 0,
        params,
    };
}

export function nextQueuedTask(tasks: TaskSnapshot[]): TaskSnapshot | null {
    return tasks.find(t => t.status === 'queued') || null;
}

export function countActiveTasks(tasks: TaskSnapshot[]): number {
    return tasks.filter(t => t.status === 'running' || t.status === 'streaming').length;
}

export function countRunningOrQueued(tasks: TaskSnapshot[]): number {
    return tasks.filter(t => t.status === 'running' || t.status === 'streaming' || t.status === 'queued').length;
}
