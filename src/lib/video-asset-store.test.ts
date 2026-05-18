import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VideoBlobRecord } from './db';
import type {
    VideoHistoryMetadata,
    VideoResultAssetRef,
    VideoSourceAssetRef
} from './video-types';

const blobsTable = vi.hoisted(() => {
    type BlobsTableStub = {
        records: Map<string, unknown>;
        put: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
    };
    const stub: BlobsTableStub = {
        records: new Map(),
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn()
    };
    return stub;
});

vi.mock('@/lib/db', () => ({
    db: {
        videoBlobs: blobsTable
    }
}));

const desktopRuntime = vi.hoisted(() => ({
    isTauriDesktop: vi.fn(() => false),
    invokeDesktopCommand: vi.fn()
}));

vi.mock('@/lib/desktop-runtime', () => desktopRuntime);

import {
    deleteUnreferencedVideoAssets,
    getVideoAssetReferenceCounts,
    loadVideoAssetAsBlob,
    persistVideoAsset,
    resolveVideoAssetSrc
} from './video-asset-store';

function videoBlob(size = 1024, type = 'video/mp4'): Blob {
    return new Blob([new Uint8Array(size)], { type });
}

function imageBlob(size = 256, type = 'image/png'): Blob {
    return new Blob([new Uint8Array(size)], { type });
}

beforeEach(() => {
    blobsTable.records.clear();
    blobsTable.put.mockImplementation(async (record: VideoBlobRecord) => {
        blobsTable.records.set(record.filename, record);
        return record.filename;
    });
    blobsTable.get.mockImplementation(async (key: string) => blobsTable.records.get(key) as VideoBlobRecord | undefined);
    blobsTable.delete.mockImplementation(async (key: string) => {
        blobsTable.records.delete(key);
    });
    desktopRuntime.isTauriDesktop.mockReturnValue(false);
    desktopRuntime.invokeDesktopCommand.mockReset();
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('persistVideoAsset', () => {
    it('writes to IndexedDB when not on desktop', async () => {
        const blob = videoBlob(2048);
        const result = await persistVideoAsset(blob, 'video');
        expect(result.storageModeUsed).toBe('indexeddb');
        expect(result.size).toBe(2048);
        expect(result.mimeType).toBe('video/mp4');
        expect(blobsTable.records.size).toBe(1);
    });

    it('uses the provided filename', async () => {
        const result = await persistVideoAsset(videoBlob(), 'video', { filename: 'preset-name.mp4' });
        expect(result.filename).toBe('preset-name.mp4');
        expect(blobsTable.records.has('preset-name.mp4')).toBe(true);
    });

    it('forces IndexedDB when option is set even on desktop', async () => {
        desktopRuntime.isTauriDesktop.mockReturnValue(true);
        desktopRuntime.invokeDesktopCommand.mockResolvedValueOnce({
            path: '/tmp/x',
            filename: 'desktop.mp4'
        });
        const result = await persistVideoAsset(videoBlob(), 'video', { forceIndexedDb: true });
        expect(result.storageModeUsed).toBe('indexeddb');
        expect(desktopRuntime.invokeDesktopCommand).not.toHaveBeenCalled();
    });

    it('falls back to IndexedDB when the desktop command throws', async () => {
        desktopRuntime.isTauriDesktop.mockReturnValue(true);
        desktopRuntime.invokeDesktopCommand.mockRejectedValueOnce(new Error('unimplemented'));
        const result = await persistVideoAsset(videoBlob(), 'video');
        expect(result.storageModeUsed).toBe('indexeddb');
    });

    it('honors duration and remoteUrlExpiresAt options', async () => {
        const blob = videoBlob();
        await persistVideoAsset(blob, 'video', {
            filename: 'with-meta.mp4',
            durationSeconds: 4.5,
            remoteUrlExpiresAt: 9999
        });
        const stored = blobsTable.records.get('with-meta.mp4') as VideoBlobRecord | undefined;
        expect(stored?.durationSeconds).toBe(4.5);
        expect(stored?.remoteUrlExpiresAt).toBe(9999);
    });

    it('records desktop fs metadata when desktop command succeeds', async () => {
        desktopRuntime.isTauriDesktop.mockReturnValue(true);
        desktopRuntime.invokeDesktopCommand.mockResolvedValueOnce({
            path: '/data/videos/result.mp4',
            filename: 'result.mp4'
        });
        const result = await persistVideoAsset(videoBlob(), 'video', { filename: 'result.mp4' });
        expect(result.storageModeUsed).toBe('fs');
        expect(result.filename).toBe('result.mp4');
        expect(blobsTable.records.size).toBe(0);
    });
});

describe('resolveVideoAssetSrc', () => {
    it('returns https remoteUrl when storage is fs', () => {
        const ref: VideoResultAssetRef = {
            filename: 'x.mp4',
            kind: 'video',
            mimeType: 'video/mp4',
            storageModeUsed: 'fs',
            remoteUrl: 'https://example.com/x.mp4'
        };
        expect(resolveVideoAssetSrc(ref)).toBe('https://example.com/x.mp4');
    });

    it('ignores non-https remote URLs even when storage is fs', () => {
        const ref: VideoResultAssetRef = {
            filename: 'x.mp4',
            kind: 'video',
            mimeType: 'video/mp4',
            storageModeUsed: 'fs',
            remoteUrl: 'http://example.com/x.mp4'
        };
        expect(resolveVideoAssetSrc(ref)).toBeUndefined();
    });

    it('returns the cached URL when getCachedUrl provides one', () => {
        const ref: VideoSourceAssetRef = {
            filename: 's.png',
            role: 'reference',
            storageModeUsed: 'indexeddb',
            source: 'uploaded'
        };
        const cache = (filename: string) => (filename === 's.png' ? 'blob:cached' : undefined);
        expect(resolveVideoAssetSrc(ref, cache)).toBe('blob:cached');
    });

    it('returns undefined when no resolution path is available', () => {
        const ref: VideoResultAssetRef = {
            filename: 'x.mp4',
            kind: 'video',
            mimeType: 'video/mp4',
            storageModeUsed: 'indexeddb'
        };
        expect(resolveVideoAssetSrc(ref)).toBeUndefined();
    });
});

describe('loadVideoAssetAsBlob', () => {
    it('returns the stored blob', async () => {
        const blob = videoBlob(512);
        blobsTable.records.set('p.mp4', {
            filename: 'p.mp4',
            blob,
            kind: 'video'
        });
        const result = await loadVideoAssetAsBlob({
            filename: 'p.mp4',
            kind: 'video',
            mimeType: 'video/mp4',
            storageModeUsed: 'indexeddb'
        });
        expect(result).toBe(blob);
    });

    it('returns null when missing', async () => {
        const result = await loadVideoAssetAsBlob({
            filename: 'absent.mp4',
            kind: 'video',
            mimeType: 'video/mp4',
            storageModeUsed: 'indexeddb'
        });
        expect(result).toBeNull();
    });
});

describe('getVideoAssetReferenceCounts', () => {
    it('counts asset references across the history', () => {
        const history: VideoHistoryMetadata[] = [
            {
                id: 'a',
                type: 'image-to-video',
                timestamp: 1,
                prompt: 'p',
                providerEndpointId: 'x',
                providerKind: 'openai',
                providerProtocol: 'openai-videos',
                rawModelId: 'sora-2',
                sourceAssets: [
                    {
                        filename: 'src-1.png',
                        role: 'reference',
                        storageModeUsed: 'indexeddb',
                        source: 'uploaded'
                    }
                ],
                resultAssets: [
                    {
                        filename: 'out-1.mp4',
                        kind: 'video',
                        mimeType: 'video/mp4',
                        storageModeUsed: 'indexeddb'
                    },
                    {
                        filename: 'out-thumb-1.jpg',
                        kind: 'thumbnail',
                        mimeType: 'image/jpeg',
                        storageModeUsed: 'indexeddb'
                    }
                ],
                job: { id: 'job-a', status: 'succeeded', createdAt: 1, updatedAt: 1 },
                parameters: {}
            },
            {
                id: 'b',
                type: 'image-to-video',
                timestamp: 2,
                prompt: 'p',
                providerEndpointId: 'x',
                providerKind: 'openai',
                providerProtocol: 'openai-videos',
                rawModelId: 'sora-2',
                sourceAssets: [
                    {
                        filename: 'src-1.png',
                        role: 'reference',
                        storageModeUsed: 'indexeddb',
                        source: 'uploaded'
                    }
                ],
                resultAssets: [],
                job: { id: 'job-b', status: 'succeeded', createdAt: 2, updatedAt: 2 },
                parameters: {}
            }
        ];
        const counts = getVideoAssetReferenceCounts(history);
        expect(counts.get('src-1.png')).toBe(2);
        expect(counts.get('out-1.mp4')).toBe(1);
        expect(counts.get('out-thumb-1.jpg')).toBe(1);
        expect(counts.get('does-not-exist')).toBeUndefined();
    });
});

describe('deleteUnreferencedVideoAssets', () => {
    it('only deletes filenames with zero or missing reference count', async () => {
        blobsTable.records.set('keep.mp4', { filename: 'keep.mp4', blob: videoBlob(), kind: 'video' });
        blobsTable.records.set('drop.mp4', { filename: 'drop.mp4', blob: videoBlob(), kind: 'video' });
        blobsTable.records.set('orphan.png', {
            filename: 'orphan.png',
            blob: imageBlob(),
            kind: 'thumbnail'
        });

        const refCounts = new Map([
            ['keep.mp4', 2],
            ['drop.mp4', 0]
        ]);

        const deleted = await deleteUnreferencedVideoAssets(
            ['keep.mp4', 'drop.mp4', 'orphan.png'],
            refCounts
        );
        expect(deleted.sort()).toEqual(['drop.mp4', 'orphan.png']);
        expect(blobsTable.records.has('keep.mp4')).toBe(true);
        expect(blobsTable.records.has('drop.mp4')).toBe(false);
        expect(blobsTable.records.has('orphan.png')).toBe(false);
    });
});
