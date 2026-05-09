import Dexie, { type EntityTable } from 'dexie';

export type ImageSyncStatus = 'local_only' | 'pending_upload' | 'synced' | 'conflict';

export interface ImageRecord {
    filename: string;
    blob: Blob;
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

        this.version(2).stores({
            images: '&filename'
        }).upgrade(tx => {
            return tx.table('images').toCollection().modify(record => {
                if (!record.syncStatus) {
                    record.syncStatus = 'local_only';
                }
                if (!record.lastModifiedLocal) {
                    record.lastModifiedLocal = Date.now();
                }
            });
        });

        this.images = this.table('images');
    }
}

export const db = new ImageDB();
