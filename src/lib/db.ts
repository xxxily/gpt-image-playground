import {
    VIDEO_BLOB_STORE_TABLE,
    VIDEO_JOB_STORE_TABLE,
    type VideoGenerationJob,
    type VideoHistoryImageSyncStatus
} from '@/lib/video-types';
import type { HistoryImageSyncStatus } from '@/types/history';
import Dexie, { type EntityTable } from 'dexie';

export type ImageSyncStatus = HistoryImageSyncStatus;

export interface ImageRecord {
    filename: string;
    blob: Blob;
    /** SHA-256 hex digest for cheap sync identity checks. Filled after upload/restore. */
    sha256?: string;
    /** Blob byte size cached to avoid reading the Blob during restore checks. */
    size?: number;
    /** Content-addressed remote object key used by the last successful sync. */
    remoteKey?: string;
    /** Remote MIME type recorded by the manifest when available. */
    mimeType?: string;
    /** Sync status set by v2 migration; defaults to 'local_only' */
    syncStatus?: ImageSyncStatus;
    /** Epoch ms of last local modification; set by v2 migration when missing */
    lastModifiedLocal?: number;
}

export interface VideoBlobRecord {
    /** Stable filename. The kind is encoded by suffix or by the historyId mapping. */
    filename: string;
    blob: Blob;
    /** Either 'video' (full asset), 'thumbnail' or 'spritesheet'. */
    kind: 'video' | 'thumbnail' | 'spritesheet';
    /** Optional declared MIME type. */
    mimeType?: string;
    /** Cached byte size; avoids reading the Blob on restore checks. */
    size?: number;
    /** Cached duration when known; useful for history list metadata. */
    durationSeconds?: number;
    /** SHA-256 hex digest. Filled after upload/restore. */
    sha256?: string;
    /** Content-addressed remote object key used by the last successful sync. */
    remoteKey?: string;
    /** Sync status. Mirrors HistoryImageSyncStatus shape but reuses VideoHistoryImageSyncStatus. */
    syncStatus?: VideoHistoryImageSyncStatus;
    /** Epoch ms of last local modification. */
    lastModifiedLocal?: number;
    /** Provider-supplied expiry (epoch ms) for the source remote URL, if any. */
    remoteUrlExpiresAt?: number;
}

export type VideoJobRecord = VideoGenerationJob & {
    /** Provider endpoint id this job was submitted against. */
    providerEndpointId: string;
    /** Provider protocol used at submit time. */
    protocol: string;
    /** Workbench task mode that produced this job. */
    taskMode: 'text-to-video' | 'image-to-video';
    /** Raw provider response snapshot used for resume after reload (truncated to <= 64 KiB). */
    resumePayload?: string;
};

export class ImageDB extends Dexie {
    images!: EntityTable<ImageRecord, 'filename'>;
    videoBlobs!: EntityTable<VideoBlobRecord, 'filename'>;
    videoJobs!: EntityTable<VideoJobRecord, 'id'>;

    constructor() {
        super('ImageDB');

        this.version(1).stores({
            images: '&filename'
        });

        this.version(2)
            .stores({
                images: '&filename'
            })
            .upgrade((tx) => {
                return tx
                    .table('images')
                    .toCollection()
                    .modify((record) => {
                        if (!record.syncStatus) {
                            record.syncStatus = 'local_only';
                        }
                        if (!record.lastModifiedLocal) {
                            record.lastModifiedLocal = Date.now();
                        }
                    });
            });

        this.version(3)
            .stores({
                images: '&filename'
            });

        // Keep this table keyed only by filename. Adding indexes on Blob-side
        // metadata such as sha256/remoteKey forces mobile Chrome to scan existing
        // image records during schema upgrade/open, which can block restore writes.
        this.version(4)
            .stores({
                images: '&filename'
            });

        // Version 5 introduces video-side persistence:
        //   - `videoBlobs` stores video output assets (the full video file, an
        //     optional poster thumbnail, an optional spritesheet) keyed by filename.
        //   - `videoJobs` stores resumable async-job state keyed by job id so that
        //     polling can resume after a reload. Indexed on `status` so the executor
        //     can cheaply list resumable jobs without scanning all entries.
        // Same discipline as the image table: keep extra indexes off the blob row to
        // avoid mobile Chrome upgrade scans on the (potentially large) video blobs.
        this.version(5).stores({
            images: '&filename',
            [VIDEO_BLOB_STORE_TABLE]: '&filename',
            [VIDEO_JOB_STORE_TABLE]: '&id, status, updatedAt'
        });

        this.images = this.table('images');
        this.videoBlobs = this.table(VIDEO_BLOB_STORE_TABLE);
        this.videoJobs = this.table(VIDEO_JOB_STORE_TABLE);
    }
}

export const db = new ImageDB();
