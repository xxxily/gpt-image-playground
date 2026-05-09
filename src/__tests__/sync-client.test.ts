import { describe, expect, it } from 'vitest';
import {
    buildSyncedImageObjectKey,
    filterManifestImagesBySince,
    findLatestManifestKey,
    getRestorePlan,
    isRemoteObjectCurrent,
    mergeManifestImageEntries,
    mergePreviousImageEntriesForMetadata,
    mergeRestoredImageHistory,
    normalizeRestoredImageHistoryForIndexedDb
} from '@/lib/sync/sync-client';
import { emptySyncResult, failedSyncResult } from '@/lib/sync/results';
import { createSyncStatusDetails } from '@/lib/sync/status-details';
import type { SnapshotManifest } from '@/lib/sync/manifest';

describe('findLatestManifestKey', () => {
    it('chooses the newest manifest object under a directory path', () => {
        const latest = findLatestManifestKey({
            prefix: 'gpt-image-playground/v1/default',
            count: 3,
            objects: [
                { key: 'gpt-image-playground/v1/default/snapshots/a/manifest.json', size: 1, lastModified: '2026-01-01T00:00:00.000Z' },
                { key: 'gpt-image-playground/v1/default/snapshots/b/manifest.json', size: 1, lastModified: '2026-01-02T00:00:00.000Z' },
                { key: 'gpt-image-playground/v1/default/snapshots/b/image.png', size: 1, lastModified: '2026-01-03T00:00:00.000Z' }
            ]
        });

        expect(latest).toBe('gpt-image-playground/v1/default/snapshots/b/manifest.json');
    });

    it('ignores keys that merely end with manifest.json without a path separator', () => {
        const latest = findLatestManifestKey({
            prefix: 'gpt-image-playground/v1/default',
            count: 2,
            objects: [
                { key: 'gpt-image-playground/v1/defaultmanifest.json', size: 1, lastModified: '2026-01-03T00:00:00.000Z' },
                { key: 'gpt-image-playground/v1/default/manifest.json', size: 1, lastModified: '2026-01-02T00:00:00.000Z' }
            ]
        });

        expect(latest).toBe('gpt-image-playground/v1/default/manifest.json');
    });
});

describe('buildSyncedImageObjectKey', () => {
    it('uses a stable content-addressed path for incremental uploads', () => {
        const key = buildSyncedImageObjectKey(
            'gpt-image-playground/v1/default',
            'a'.repeat(64),
            'photo-001.png'
        );

        expect(key).toBe(`gpt-image-playground/v1/default/images/${'a'.repeat(64)}/photo-001.png`);
    });
});

describe('isRemoteObjectCurrent', () => {
    it('accepts remote object when size and sha256 metadata match', () => {
        expect(isRemoteObjectCurrent(
            { contentLength: 123, metadata: { sha256: 'abc' } },
            { size: 123, sha256: 'abc' }
        )).toBe(true);
    });

    it('rejects remote object when size differs', () => {
        expect(isRemoteObjectCurrent(
            { contentLength: 124, metadata: { sha256: 'abc' } },
            { size: 123, sha256: 'abc' }
        )).toBe(false);
    });

    it('accepts content-addressed remote object when sha256 metadata is absent', () => {
        expect(isRemoteObjectCurrent(
            { contentLength: 123, metadata: {} },
            { size: 123, sha256: 'abc' }
        )).toBe(true);
    });

    it('rejects remote object when sha256 metadata is different', () => {
        expect(isRemoteObjectCurrent(
            { contentLength: 123, metadata: { sha256: 'def' } },
            { size: 123, sha256: 'abc' }
        )).toBe(false);
    });
});

describe('mergePreviousImageEntriesForMetadata', () => {
    const baseManifest: SnapshotManifest = {
        version: 1,
        snapshotId: 'current',
        createdAt: 1778310000000,
        appConfig: {},
        promptHistory: [],
        userPromptTemplates: [],
        imageHistory: [],
        images: [],
        syncMode: 'metadata'
    };

    it('preserves current metadata manifest when no previous image entries exist', () => {
        const merged = mergePreviousImageEntriesForMetadata(baseManifest, null);
        expect(merged).toEqual(baseManifest);
    });

    it('copies previous image entries into metadata manifest for restore continuity', () => {
        const previous: SnapshotManifest = {
            ...baseManifest,
            snapshotId: 'previous',
            syncMode: 'full',
            images: [{
                filename: 'photo-001.png',
                sha256: 'a'.repeat(64),
                objectKey: `gpt-image-playground/v1/default/images/${'a'.repeat(64)}/photo-001.png`,
                mimeType: 'image/png',
                size: 123
            }]
        };

        const merged = mergePreviousImageEntriesForMetadata(baseManifest, previous);
        expect(merged.images).toEqual(previous.images);
        expect(merged.images).not.toBe(previous.images);
        expect(merged.snapshotId).toBe('current');
        expect(merged.syncMode).toBe('metadata');
    });
});

describe('mergeManifestImageEntries', () => {
    const baseManifest: SnapshotManifest = {
        version: 1,
        snapshotId: 'current',
        createdAt: 1778310000000,
        appConfig: {},
        promptHistory: [],
        userPromptTemplates: [],
        imageHistory: [],
        images: [],
        syncMode: 'full'
    };

    it('keeps previous image entries and lets current entries replace matching filenames', () => {
        const previous: SnapshotManifest = {
            ...baseManifest,
            snapshotId: 'previous',
            images: [
                {
                    filename: 'old.png',
                    sha256: 'a'.repeat(64),
                    objectKey: `gpt-image-playground/v1/default/images/${'a'.repeat(64)}/old.png`,
                    mimeType: 'image/png',
                    size: 100
                },
                {
                    filename: 'same.png',
                    sha256: 'b'.repeat(64),
                    objectKey: `gpt-image-playground/v1/default/images/${'b'.repeat(64)}/same.png`,
                    mimeType: 'image/png',
                    size: 200
                }
            ]
        };
        const current: SnapshotManifest = {
            ...baseManifest,
            images: [{
                filename: 'same.png',
                sha256: 'c'.repeat(64),
                objectKey: `gpt-image-playground/v1/default/images/${'c'.repeat(64)}/same.png`,
                mimeType: 'image/png',
                size: 300
            }]
        };

        const merged = mergeManifestImageEntries(current, previous);
        expect(merged.images.map((image) => image.filename)).toEqual(['old.png', 'same.png']);
        expect(merged.images.find((image) => image.filename === 'same.png')?.sha256).toBe('c'.repeat(64));
    });
});

describe('filterManifestImagesBySince', () => {
    const now = 1778310000000;
    const manifest: SnapshotManifest = {
        version: 1,
        snapshotId: 'snap',
        createdAt: now,
        appConfig: {},
        promptHistory: [],
        userPromptTemplates: [],
        syncMode: 'full',
        imageHistory: [
            {
                timestamp: now - 3600000,
                prompt: 'recent',
                images: [{ filename: 'recent.png' }],
                durationMs: 1000,
                quality: 'auto',
                background: 'auto',
                moderation: 'auto',
                mode: 'generate',
                costDetails: null,
                model: 'gpt-image-1',
                storageModeUsed: 'indexeddb'
            },
            {
                timestamp: now - 86400000 * 3,
                prompt: 'old',
                images: [{ filename: 'old.png' }],
                durationMs: 1000,
                quality: 'auto',
                background: 'auto',
                moderation: 'auto',
                mode: 'generate',
                costDetails: null,
                model: 'gpt-image-1',
                storageModeUsed: 'indexeddb'
            }
        ],
        images: [
            {
                filename: 'recent.png',
                sha256: 'a'.repeat(64),
                objectKey: `gpt-image-playground/v1/default/images/${'a'.repeat(64)}/recent.png`,
                mimeType: 'image/png',
                size: 100
            },
            {
                filename: 'old.png',
                sha256: 'b'.repeat(64),
                objectKey: `gpt-image-playground/v1/default/images/${'b'.repeat(64)}/old.png`,
                mimeType: 'image/png',
                size: 200
            }
        ]
    };

    it('keeps only images referenced by recent history entries', () => {
        const filtered = filterManifestImagesBySince(manifest, now - 86400000);
        expect(filtered.images.map((image) => image.filename)).toEqual(['recent.png']);
        expect(filtered.imageScopeSince).toBe(now - 86400000);
    });

    it('returns all images when no range is provided', () => {
        expect(filterManifestImagesBySince(manifest).images).toHaveLength(2);
    });
});

describe('getRestorePlan', () => {
    const manifestWithImages: SnapshotManifest = {
        version: 1,
        snapshotId: 'snap-with-images',
        createdAt: 1778310000000,
        appConfig: {},
        promptHistory: [],
        userPromptTemplates: [],
        imageHistory: [],
        syncMode: 'full',
        images: [{
            filename: 'photo-001.png',
            sha256: 'a'.repeat(64),
            objectKey: `gpt-image-playground/v1/default/images/${'a'.repeat(64)}/photo-001.png`,
            mimeType: 'image/png',
            size: 123
        }]
    };

    it('restores metadata without downloading images in metadata mode', () => {
        expect(getRestorePlan('metadata', manifestWithImages)).toEqual({
            restoreMetadata: true,
            restoreImages: false,
            totalImages: 0
        });
    });

    it('restores only image blobs in images mode', () => {
        expect(getRestorePlan('images', manifestWithImages)).toEqual({
            restoreMetadata: false,
            restoreImages: true,
            totalImages: 1
        });
    });

    it('restores metadata and images in full mode', () => {
        expect(getRestorePlan('full', manifestWithImages)).toEqual({
            restoreMetadata: true,
            restoreImages: true,
            totalImages: 1
        });
    });

    it('does not attempt image restore when manifest has no image entries', () => {
        expect(getRestorePlan('images', { ...manifestWithImages, images: [] })).toEqual({
            restoreMetadata: false,
            restoreImages: false,
            totalImages: 0
        });
    });
});

describe('restore image history display normalization', () => {
    const remoteHistory: SnapshotManifest['imageHistory'] = [
        {
            timestamp: 1778310000000,
            prompt: 'remote fs entry',
            images: [
                { filename: 'remote-a.png', path: '/old-device/generated/remote-a.png' },
                { filename: 'remote-b.png', path: '/old-device/generated/remote-b.png' }
            ],
            durationMs: 1000,
            quality: 'auto',
            background: 'auto',
            moderation: 'auto',
            mode: 'generate',
            costDetails: null,
            model: 'gpt-image-1',
            storageModeUsed: 'fs'
        }
    ];

    it('strips device-local paths and marks restored records as IndexedDB-backed', () => {
        const normalized = normalizeRestoredImageHistoryForIndexedDb(remoteHistory, new Set(['remote-a.png']));

        expect(normalized).toEqual([
            {
                ...remoteHistory[0],
                images: [{ filename: 'remote-a.png' }],
                storageModeUsed: 'indexeddb'
            }
        ]);
    });

    it('merges restored remote history into the current local history by timestamp', () => {
        const current = [
            {
                ...remoteHistory[0],
                prompt: 'local stale entry',
                images: [{ filename: 'local.png' }],
                storageModeUsed: 'indexeddb' as const
            },
            {
                ...remoteHistory[0],
                timestamp: 1778300000000,
                prompt: 'local only',
                images: [{ filename: 'local-only.png' }],
                storageModeUsed: 'indexeddb' as const
            }
        ];
        const restored = normalizeRestoredImageHistoryForIndexedDb(remoteHistory);

        expect(mergeRestoredImageHistory(current, restored).map((entry) => entry.prompt)).toEqual([
            'remote fs entry',
            'local only'
        ]);
    });
});

describe('SyncResult helpers', () => {
    it('emptySyncResult initializes with zero counters', () => {
        const result = emptySyncResult('snapshot');
        expect(result.ok).toBe(true);
        expect(result.totalImages).toBe(0);
        expect(result.completedImages).toBe(0);
        expect(result.failedImages).toBe(0);
        expect(result.skippedImages).toBeUndefined();
    });

    it('failedSyncResult sets ok=false and includes error', () => {
        const result = failedSyncResult('upload-images', 'network error');
        expect(result.ok).toBe(false);
        expect(result.error).toBe('network error');
        expect(result.phase).toBe('upload-images');
    });
});

describe('createSyncStatusDetails', () => {
    it('maps sync result context into UI status details', () => {
        const details = createSyncStatusDetails('历史图片同步完成', {
            ok: true,
            operation: 'upload',
            mode: 'full',
            phase: 'upload-manifest',
            manifestKey: 'gpt-image-playground/v1/default/manifest.json',
            snapshotId: 'snap-001',
            manifestCreatedAt: 1778310000000,
            bucket: 'test-bucket-demo',
            basePrefix: 'gpt-image-playground/v1/default',
            startedAt: 1778310000000,
            completedAt: 1778310005000,
            totalImages: 10,
            completedImages: 8,
            failedImages: 1,
            skippedImages: 2
        }, { operation: 'upload-images', inProgress: false, done: true, success: true });

        expect(details).toMatchObject({
            operation: 'upload-images',
            operationLabel: '历史图片同步完成',
            target: 'gpt-image-playground/v1/default/manifest.json',
            bucket: 'test-bucket-demo',
            basePrefix: 'gpt-image-playground/v1/default',
            snapshotId: 'snap-001',
            progress: 80,
            total: 10,
            completed: 8,
            failed: 1,
            skipped: 2,
            inProgress: false,
            done: true,
            success: true
        });
    });

    it('turns result errors into detail entries', () => {
        const details = createSyncStatusDetails('恢复失败', {
            ok: false,
            operation: 'restore',
            mode: 'metadata',
            phase: 'restore-metadata',
            error: 'Manifest validation failed'
        }, { operation: 'restore-metadata', inProgress: false, done: true, success: false });

        expect(details.errors).toEqual([{ message: 'Manifest validation failed' }]);
        expect(details.success).toBe(false);
    });
});
