import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoBlobRecord } from '@/lib/db';

vi.mock('@/lib/desktop-runtime', () => ({
    isTauriDesktop: vi.fn(() => false),
    invokeDesktopCommand: vi.fn()
}));

const videoBlobsTable = vi.hoisted(() => {
    type VideoBlobsTableStub = {
        records: Map<string, VideoBlobRecord>;
        put: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
        toArray: ReturnType<typeof vi.fn>;
    };

    const table: VideoBlobsTableStub = {
        records: new Map<string, VideoBlobRecord>(),
        put: vi.fn(async (record: VideoBlobRecord) => {
            table.records.set(record.filename, record);
        }),
        get: vi.fn(async (filename: string) => table.records.get(filename)),
        delete: vi.fn(async (filename: string) => {
            table.records.delete(filename);
            return true;
        }),
        toArray: vi.fn(async () => [...table.records.values()])
    };

    return table;
});

import type { VideoHistoryMetadata, VideoResultAssetRef } from '@/lib/video-types';

vi.mock('@/lib/db', () => ({
    db: {
        videoBlobs: videoBlobsTable
    }
}));

import { db } from '@/lib/db';
import {
    deleteUnreferencedVideoAssets,
    getVideoAssetReferenceCounts,
    loadVideoAssetAsBlob,
    persistVideoAsset,
    resolveVideoAssetSrc,
    type PersistVideoAssetOptions
} from './video-asset-store';

import { isTauriDesktop, invokeDesktopCommand } from '@/lib/desktop-runtime';

function makeBlob(content: string, type = 'video/mp4'): Blob {
    return new Blob([content], { type });
}

function makeVideoHistoryRef(overrides: Partial<VideoHistoryMetadata> = {}): VideoHistoryMetadata {
    return {
        id: 'vh_1',
        type: 'text-to-video',
        timestamp: 1,
        prompt: 'test prompt',
        providerEndpointId: 'ep:openai:default',
        providerKind: 'openai',
        providerProtocol: 'openai-images',
        rawModelId: 'gpt-image-1',
        sourceAssets: [],
        resultAssets: [],
        job: {
            id: 'job_1',
            status: 'succeeded',
            createdAt: 1,
            updatedAt: 2
        },
        parameters: {},
        ...overrides
    };
}

function makeResultAssetRef(overrides: Partial<VideoResultAssetRef> = {}): VideoResultAssetRef {
    return {
        filename: 'vid.mp4',
        kind: 'video',
        mimeType: 'video/mp4',
        storageModeUsed: 'indexeddb',
        ...overrides
    };
}

beforeEach(() => {
    videoBlobsTable.records.clear();
    vi.mocked(isTauriDesktop).mockReturnValue(false);
    vi.mocked(invokeDesktopCommand).mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('persistVideoAsset', () => {
    it('writes to IndexedDB on web, computes sha256, returns shape', async () => {
        const blob = makeBlob('test video content');
        const result = await persistVideoAsset(blob, 'video');

        expect(result.filename).toMatch(/^video_\d+_[a-z0-9]+\.mp4$/);
        expect(result.storageModeUsed).toBe('indexeddb');
        expect(result.size).toBe(blob.size);
        expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(result.mimeType).toBe('video/mp4');

        const record = await db.videoBlobs.get(result.filename);
        expect(record).toBeDefined();
        expect(record?.kind).toBe('video');
        expect(record?.syncStatus).toBe('local_only');
        expect(record?.sha256).toBe(result.sha256);
    });

    it('generates correct extension for thumbnail kind', async () => {
        const blob = makeBlob('thumb', 'image/jpeg');
        const result = await persistVideoAsset(blob, 'thumbnail');

        expect(result.filename).toMatch(/\.jpg$/);
    });

    it('generates webp extension for spritesheet kind', async () => {
        const blob = makeBlob('sheet', 'image/webp');
        const result = await persistVideoAsset(blob, 'spritesheet');

        expect(result.filename).toMatch(/\.webp$/);
    });

    it('uses provided filename', async () => {
        const blob = makeBlob('content');
        const options: PersistVideoAssetOptions = { filename: 'custom_name.mp4' };
        const result = await persistVideoAsset(blob, 'video', options);

        expect(result.filename).toBe('custom_name.mp4');
    });

    it('includes durationSeconds and remoteUrlExpiresAt when provided', async () => {
        const blob = makeBlob('content');
        const options: PersistVideoAssetOptions = {
            filename: 'timed.mp4',
            durationSeconds: 15,
            remoteUrlExpiresAt: Date.now() + 3600000
        };
        await persistVideoAsset(blob, 'video', options);

        const record = await db.videoBlobs.get('timed.mp4');
        expect(record?.durationSeconds).toBe(15);
        expect(record?.remoteUrlExpiresAt).toBe(options.remoteUrlExpiresAt);
    });
});

describe('resolveVideoAssetSrc', () => {
    it('returns remoteUrl when storageMode is fs and remoteUrl is https', () => {
        const ref = makeResultAssetRef({
            storageModeUsed: 'fs',
            remoteUrl: 'https://cdn.example.com/video.mp4',
            filename: 'vid.mp4'
        });

        expect(resolveVideoAssetSrc(ref)).toBe('https://cdn.example.com/video.mp4');
    });

    it('returns cached value from getCachedUrl when provided', () => {
        const ref = makeResultAssetRef({ filename: 'cached.mp4' });
        const getCachedUrl = vi.fn((f: string) => (f === 'cached.mp4' ? 'blob:http://cached' : undefined));

        expect(resolveVideoAssetSrc(ref, getCachedUrl)).toBe('blob:http://cached');
    });

    it('returns undefined when no remoteUrl and no cached url', () => {
        const ref = makeResultAssetRef({ filename: 'no_url.mp4' });

        expect(resolveVideoAssetSrc(ref)).toBeUndefined();
    });

    it('does not return http remoteUrl', () => {
        const ref = makeResultAssetRef({
            storageModeUsed: 'fs',
            remoteUrl: 'http://insecure.example.com/video.mp4',
            filename: 'http_vid.mp4'
        });

        expect(resolveVideoAssetSrc(ref)).toBeUndefined();
    });
});

describe('loadVideoAssetAsBlob', () => {
    it('returns the stored blob', async () => {
        const blob = makeBlob('stored content');
        await db.videoBlobs.put({
            filename: 'stored.mp4',
            blob,
            kind: 'video',
            mimeType: 'video/mp4',
            size: blob.size,
            sha256: 'abc123',
            syncStatus: 'local_only',
            lastModifiedLocal: Date.now()
        });

        const result = await loadVideoAssetAsBlob(makeResultAssetRef({ filename: 'stored.mp4' }));
        expect(result).not.toBeNull();
        expect(await result?.text()).toBe('stored content');
    });

    it('returns null when filename not found', async () => {
        const result = await loadVideoAssetAsBlob(makeResultAssetRef({ filename: 'missing.mp4' }));
        expect(result).toBeNull();
    });
});

describe('getVideoAssetReferenceCounts', () => {
    it('tallies multi-reference filenames', () => {
        const history: VideoHistoryMetadata[] = [
            makeVideoHistoryRef({
                id: 'h1',
                sourceAssets: [{ filename: 'shared.png', role: 'start_frame', storageModeUsed: 'indexeddb', source: 'uploaded' }],
                resultAssets: [
                    { filename: 'vid1.mp4', kind: 'video', mimeType: 'video/mp4', storageModeUsed: 'indexeddb' }
                ]
            }),
            makeVideoHistoryRef({
                id: 'h2',
                sourceAssets: [{ filename: 'shared.png', role: 'reference', storageModeUsed: 'indexeddb', source: 'uploaded' }],
                resultAssets: [
                    { filename: 'vid2.mp4', kind: 'video', mimeType: 'video/mp4', storageModeUsed: 'indexeddb' }
                ]
            })
        ];

        const counts = getVideoAssetReferenceCounts(history);
        expect(counts.get('shared.png')).toBe(2);
        expect(counts.get('vid1.mp4')).toBe(1);
        expect(counts.get('vid2.mp4')).toBe(1);
        expect(counts.get('nonexistent.png')).toBeUndefined();
    });

    it('returns empty map for empty history', () => {
        expect(getVideoAssetReferenceCounts([])).toEqual(new Map());
    });
});

describe('deleteUnreferencedVideoAssets', () => {
    it('deletes only zero-reference filenames and returns the deleted list', async () => {
        await db.videoBlobs.put({
            filename: 'orphan.mp4',
            blob: makeBlob('orphan'),
            kind: 'video',
            mimeType: 'video/mp4',
            size: 1,
            sha256: 'sha1',
            syncStatus: 'local_only',
            lastModifiedLocal: Date.now()
        });
        await db.videoBlobs.put({
            filename: 'used.mp4',
            blob: makeBlob('used'),
            kind: 'video',
            mimeType: 'video/mp4',
            size: 1,
            sha256: 'sha2',
            syncStatus: 'local_only',
            lastModifiedLocal: Date.now()
        });

        const counts = new Map<string, number>();
        counts.set('used.mp4', 3);
        counts.set('orphan.mp4', 0);

        const deleted = await deleteUnreferencedVideoAssets(['orphan.mp4', 'used.mp4'], counts);
        expect(deleted).toEqual(['orphan.mp4']);
        expect(await db.videoBlobs.get('orphan.mp4')).toBeUndefined();
        expect(await db.videoBlobs.get('used.mp4')).toBeDefined();
    });

    it('deletes filenames with undefined reference count', async () => {
        await db.videoBlobs.put({
            filename: 'unknown.mp4',
            blob: makeBlob('unknown'),
            kind: 'video',
            mimeType: 'video/mp4',
            size: 1,
            sha256: 'sha3',
            syncStatus: 'local_only',
            lastModifiedLocal: Date.now()
        });

        const counts = new Map<string, number>();
        const deleted = await deleteUnreferencedVideoAssets(['unknown.mp4'], counts);
        expect(deleted).toEqual(['unknown.mp4']);
    });
});
