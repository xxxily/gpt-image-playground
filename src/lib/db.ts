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

export class ImageDB extends Dexie {
    images!: EntityTable<ImageRecord, 'filename'>;

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

        this.images = this.table('images');
    }
}

export const db = new ImageDB();
