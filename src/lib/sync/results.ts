import type { ImageSyncStatus } from './image-sync-status';

export type UploadSyncMode = 'full' | 'metadata';
export type RestoreSyncMode = 'full' | 'metadata' | 'images';
export type SyncOperation = 'upload' | 'restore';

export type SyncResult = {
    ok: boolean;
    /** High-level phase that completed */
    phase: 'snapshot' | 'upload-manifest' | 'upload-images' | 'download-manifest' | 'download-images' | 'restore' | 'restore-metadata' | 'restore-images';
    totalImages: number;
    completedImages: number;
    failedImages: number;
    /** Per-image status map keyed by filename */
    imageStatuses: Record<string, ImageSyncStatus>;
    error?: string;
    /** Operation category for UI summaries */
    operation?: SyncOperation;
    /** S3 key of the uploaded manifest (upload path) or downloaded manifest key (download path) */
    manifestKey?: string;
    /** Snapshot id from the manifest being uploaded/restored */
    snapshotId?: string;
    /** Snapshot creation timestamp from the manifest */
    manifestCreatedAt?: number;
    /** Target bucket used by the operation */
    bucket?: string;
    /** Target profile/root prefix used by the operation */
    basePrefix?: string;
    /** Operation start and completion timestamps */
    startedAt?: number;
    completedAt?: number;
    /** Number of images skipped because upload/restore found an already-current copy */
    skippedImages?: number;
    /** Sync/restore mode used by the operation */
    mode?: UploadSyncMode | RestoreSyncMode;
};

export function emptySyncResult(phase: SyncResult['phase'] = 'snapshot'): SyncResult {
    return {
        ok: true,
        phase,
        totalImages: 0,
        completedImages: 0,
        failedImages: 0,
        imageStatuses: {}
    };
}

export function failedSyncResult(phase: SyncResult['phase'], error: string): SyncResult {
    return {
        ok: false,
        phase,
        totalImages: 0,
        completedImages: 0,
        failedImages: 0,
        imageStatuses: {},
        error
    };
}
