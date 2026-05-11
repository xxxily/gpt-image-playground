import type { SyncDebugEntry, SyncResult } from './results';

export type SyncErrorEntry = {
    message: string;
    details?: string;
};

export type SyncStatusDetails = {
    operation: string;
    operationLabel: string;
    target?: string;
    bucket?: string;
    basePrefix?: string;
    snapshotId?: string;
    manifestCreatedAt?: number;
    startedAt?: number;
    completedAt?: number;
    elapsedMs?: number;
    progress?: number;
    total?: number;
    completed?: number;
    failed?: number;
    skipped?: number;
    errors?: SyncErrorEntry[];
    debug?: SyncDebugEntry[];
    inProgress: boolean;
    done: boolean;
    success?: boolean;
};

export function createSyncStatusDetails(
    operationLabel: string,
    result?: Partial<SyncResult>,
    options?: {
        operation?: string;
        target?: string;
        errors?: SyncErrorEntry[];
        inProgress?: boolean;
        done?: boolean;
        success?: boolean;
    }
): SyncStatusDetails {
    const total = result?.totalImages;
    const completed = result?.completedImages;
    const progress = total && total > 0 && completed !== undefined
        ? Math.min(100, Math.round((completed / total) * 100))
        : undefined;
    const errors = options?.errors ?? (result?.error ? [{ message: result.error }] : undefined);

    return {
        operation: options?.operation ?? ([result?.operation, result?.mode, result?.phase].filter(Boolean).join(':') || operationLabel),
        operationLabel,
        target: options?.target ?? result?.manifestKey,
        bucket: result?.bucket,
        basePrefix: result?.basePrefix,
        snapshotId: result?.snapshotId,
        manifestCreatedAt: result?.manifestCreatedAt,
        startedAt: result?.startedAt,
        completedAt: result?.completedAt,
        progress,
        total,
        completed,
        failed: result?.failedImages,
        skipped: result?.skippedImages,
        errors,
        debug: result?.debug,
        inProgress: options?.inProgress ?? !result?.completedAt,
        done: options?.done ?? Boolean(result?.completedAt),
        success: options?.success ?? (result?.ok === undefined ? undefined : result.ok)
    };
}
