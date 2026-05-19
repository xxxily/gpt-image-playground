import { db } from './db';
import { isBlobObjectUrl } from './object-url';

type Listener = () => void;

export type BlobFallbackLoader = (filename: string) => Promise<Blob | null>;

const FLUSH_BATCH_SIZE = 32;

class BlobUrlStore {
    private readonly cache = new Map<string, string>();
    private readonly pending = new Set<string>();
    private readonly failed = new Set<string>();
    private readonly subscribers = new Map<string, Set<Listener>>();
    private readonly pendingQueue = new Set<string>();
    private flushScheduled = false;
    private fallbackLoader: BlobFallbackLoader | null = null;

    setFallbackLoader(loader: BlobFallbackLoader | null): void {
        this.fallbackLoader = loader;
    }

    getCached(filename: string): string | undefined {
        return this.cache.get(filename);
    }

    hasFailed(filename: string): boolean {
        return this.failed.has(filename);
    }

    /**
     * Insert (or replace) a URL for a filename without going through IndexedDB.
     * Used when a task completes with a directly-usable URL (Tauri path, server URL).
     * If a previous blob URL is being replaced, it is revoked.
     */
    set(filename: string, url: string): void {
        const previous = this.cache.get(filename);
        if (previous === url) return;
        if (previous && isBlobObjectUrl(previous)) {
            URL.revokeObjectURL(previous);
        }
        this.cache.set(filename, url);
        this.pending.delete(filename);
        this.failed.delete(filename);
        this.notify(filename);
    }

    request(filename: string): void {
        if (!filename) return;
        if (this.cache.has(filename) || this.failed.has(filename) || this.pending.has(filename)) return;
        if (this.pendingQueue.has(filename)) return;
        this.pendingQueue.add(filename);
        this.scheduleFlush();
    }

    requestMany(filenames: readonly string[]): void {
        let anyAdded = false;
        for (const filename of filenames) {
            if (!filename) continue;
            if (this.cache.has(filename) || this.failed.has(filename) || this.pending.has(filename)) continue;
            if (this.pendingQueue.has(filename)) continue;
            this.pendingQueue.add(filename);
            anyAdded = true;
        }
        if (anyAdded) this.scheduleFlush();
    }

    private scheduleFlush(): void {
        if (this.flushScheduled) return;
        this.flushScheduled = true;
        queueMicrotask(() => {
            this.flushScheduled = false;
            void this.flushPending();
        });
    }

    private async flushPending(): Promise<void> {
        if (this.pendingQueue.size === 0) return;

        const toLoad = Array.from(this.pendingQueue).filter(
            (filename) => !this.cache.has(filename) && !this.failed.has(filename) && !this.pending.has(filename)
        );
        this.pendingQueue.clear();
        if (toLoad.length === 0) return;

        for (const filename of toLoad) this.pending.add(filename);

        for (let start = 0; start < toLoad.length; start += FLUSH_BATCH_SIZE) {
            const batch = toLoad.slice(start, start + FLUSH_BATCH_SIZE);
            await this.loadBatch(batch);
        }
    }

    private async loadBatch(filenames: string[]): Promise<void> {
        let records: Array<{ blob?: Blob } | undefined> = [];
        try {
            records = await db.images.bulkGet(filenames);
        } catch (error) {
            console.warn('blobUrlStore: bulkGet failed, falling back per-item', error);
            records = await Promise.all(
                filenames.map((filename) =>
                    db.images
                        .get(filename)
                        .then((record) => record as { blob?: Blob } | undefined)
                        .catch(() => undefined)
                )
            );
        }

        for (let i = 0; i < filenames.length; i += 1) {
            const filename = filenames[i];
            const record = records[i];
            let blob: Blob | null | undefined = record?.blob;

            if (!blob && this.fallbackLoader) {
                try {
                    blob = await this.fallbackLoader(filename);
                } catch (error) {
                    console.warn(`blobUrlStore: fallback loader failed for ${filename}:`, error);
                    blob = null;
                }
            }

            this.pending.delete(filename);

            if (!blob) {
                this.failed.add(filename);
                this.notify(filename);
                continue;
            }

            if (this.cache.has(filename)) {
                this.notify(filename);
                continue;
            }

            const url = URL.createObjectURL(blob);
            this.cache.set(filename, url);
            this.notify(filename);
        }
    }

    subscribe(filename: string, listener: Listener): () => void {
        let listeners = this.subscribers.get(filename);
        if (!listeners) {
            listeners = new Set();
            this.subscribers.set(filename, listeners);
        }
        listeners.add(listener);
        return () => {
            const current = this.subscribers.get(filename);
            if (!current) return;
            current.delete(listener);
            if (current.size === 0) this.subscribers.delete(filename);
        };
    }

    private notify(filename: string): void {
        const listeners = this.subscribers.get(filename);
        if (!listeners) return;
        listeners.forEach((listener) => listener());
    }

    delete(filename: string): string | undefined {
        const url = this.cache.get(filename);
        if (url && isBlobObjectUrl(url)) URL.revokeObjectURL(url);
        this.cache.delete(filename);
        this.pending.delete(filename);
        this.failed.delete(filename);
        this.pendingQueue.delete(filename);
        this.notify(filename);
        return url;
    }

    clearFailed(): void {
        if (this.failed.size === 0) return;
        const failed = Array.from(this.failed);
        this.failed.clear();
        failed.forEach((filename) => this.notify(filename));
    }

    clearAll(): void {
        const filenames = Array.from(this.cache.keys());
        this.cache.forEach((url) => {
            if (isBlobObjectUrl(url)) URL.revokeObjectURL(url);
        });
        this.cache.clear();
        this.pending.clear();
        this.failed.clear();
        this.pendingQueue.clear();
        filenames.forEach((filename) => this.notify(filename));
        this.subscribers.forEach((listeners) => listeners.forEach((l) => l()));
    }
}

export const blobUrlStore = new BlobUrlStore();
