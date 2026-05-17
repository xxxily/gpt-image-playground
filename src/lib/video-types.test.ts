import { describe, expect, it } from 'vitest';
import {
    DEFAULT_VIDEO_SYNC_OPTIONS,
    DEFAULT_VIDEO_TASK_DEFAULTS,
    normalizeVideoGenerationJob,
    normalizeVideoGenerationParameters,
    normalizeVideoGenerationStatus,
    normalizeVideoHistoryMetadata,
    normalizeVideoImageSyncStatus,
    normalizeVideoResolutionTier,
    normalizeVideoResultAssetKind,
    normalizeVideoResultAssetRef,
    normalizeVideoShotType,
    normalizeVideoSourceAssetRef,
    normalizeVideoSourceImageRole,
    normalizeVideoStorageMode,
    normalizeVideoSyncOptions,
    normalizeVideoSyncStatus,
    normalizeVideoTaskDefaults
} from '@/lib/video-types';

// ---------------------------------------------------------------------------
// normalizeVideoGenerationStatus
// ---------------------------------------------------------------------------

describe('normalizeVideoGenerationStatus', () => {
    const validStatuses = ['queued', 'running', 'polling', 'succeeded', 'failed', 'cancelled', 'expired'] as const;

    it.each(validStatuses)('round-trips %s', (status) => {
        expect(normalizeVideoGenerationStatus(status)).toBe(status);
    });

    it('returns queued for unknown', () => {
        expect(normalizeVideoGenerationStatus(null)).toBe('queued');
        expect(normalizeVideoGenerationStatus(undefined)).toBe('queued');
        expect(normalizeVideoGenerationStatus(42)).toBe('queued');
        expect(normalizeVideoGenerationStatus('bogus')).toBe('queued');
        expect(normalizeVideoGenerationStatus({})).toBe('queued');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoSourceImageRole
// ---------------------------------------------------------------------------

describe('normalizeVideoSourceImageRole', () => {
    const validRoles = ['start_frame', 'end_frame', 'reference', 'subject', 'character', 'motion'] as const;

    it.each(validRoles)('round-trips %s', (role) => {
        expect(normalizeVideoSourceImageRole(role)).toBe(role);
    });

    it('returns reference for unknown', () => {
        expect(normalizeVideoSourceImageRole(null)).toBe('reference');
        expect(normalizeVideoSourceImageRole(undefined)).toBe('reference');
        expect(normalizeVideoSourceImageRole('bogus')).toBe('reference');
        expect(normalizeVideoSourceImageRole(0)).toBe('reference');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoResultAssetKind
// ---------------------------------------------------------------------------

describe('normalizeVideoResultAssetKind', () => {
    const validKinds = ['video', 'thumbnail', 'spritesheet'] as const;

    it.each(validKinds)('round-trips %s', (kind) => {
        expect(normalizeVideoResultAssetKind(kind)).toBe(kind);
    });

    it('returns video for unknown', () => {
        expect(normalizeVideoResultAssetKind(null)).toBe('video');
        expect(normalizeVideoResultAssetKind('bogus')).toBe('video');
        expect(normalizeVideoResultAssetKind({})).toBe('video');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoResolutionTier
// ---------------------------------------------------------------------------

describe('normalizeVideoResolutionTier', () => {
    it('returns undefined for unknown', () => {
        expect(normalizeVideoResolutionTier(null)).toBeUndefined();
        expect(normalizeVideoResolutionTier(undefined)).toBeUndefined();
        expect(normalizeVideoResolutionTier('4K')).toBeUndefined();
        expect(normalizeVideoResolutionTier('bogus')).toBeUndefined();
    });

    it('accepts valid tiers case-sensitively', () => {
        expect(normalizeVideoResolutionTier('480p')).toBe('480p');
        expect(normalizeVideoResolutionTier('720p')).toBe('720p');
        expect(normalizeVideoResolutionTier('1080p')).toBe('1080p');
        expect(normalizeVideoResolutionTier('4k')).toBe('4k');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoShotType
// ---------------------------------------------------------------------------

describe('normalizeVideoShotType', () => {
    it('returns undefined for unknown', () => {
        expect(normalizeVideoShotType(null)).toBeUndefined();
        expect(normalizeVideoShotType('bogus')).toBeUndefined();
    });

    it('round-trips valid shot types', () => {
        expect(normalizeVideoShotType('single')).toBe('single');
        expect(normalizeVideoShotType('multi')).toBe('multi');
        expect(normalizeVideoShotType('auto')).toBe('auto');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoStorageMode
// ---------------------------------------------------------------------------

describe('normalizeVideoStorageMode', () => {
    it('returns indexeddb for unknown', () => {
        expect(normalizeVideoStorageMode(null)).toBe('indexeddb');
        expect(normalizeVideoStorageMode('bogus')).toBe('indexeddb');
    });

    it('round-trips valid modes', () => {
        expect(normalizeVideoStorageMode('fs')).toBe('fs');
        expect(normalizeVideoStorageMode('indexeddb')).toBe('indexeddb');
        expect(normalizeVideoStorageMode('url')).toBe('url');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoSyncStatus
// ---------------------------------------------------------------------------

describe('normalizeVideoSyncStatus', () => {
    it('returns undefined for unknown', () => {
        expect(normalizeVideoSyncStatus(null)).toBeUndefined();
        expect(normalizeVideoSyncStatus('bogus')).toBeUndefined();
    });

    it('round-trips valid statuses', () => {
        expect(normalizeVideoSyncStatus('local_only')).toBe('local_only');
        expect(normalizeVideoSyncStatus('pending_upload')).toBe('pending_upload');
        expect(normalizeVideoSyncStatus('synced')).toBe('synced');
        expect(normalizeVideoSyncStatus('partial')).toBe('partial');
        expect(normalizeVideoSyncStatus('conflict')).toBe('conflict');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoImageSyncStatus
// ---------------------------------------------------------------------------

describe('normalizeVideoImageSyncStatus', () => {
    it('returns undefined for unknown', () => {
        expect(normalizeVideoImageSyncStatus(null)).toBeUndefined();
        expect(normalizeVideoImageSyncStatus('bogus')).toBeUndefined();
    });

    it('round-trips valid statuses', () => {
        expect(normalizeVideoImageSyncStatus('local_only')).toBe('local_only');
        expect(normalizeVideoImageSyncStatus('pending_upload')).toBe('pending_upload');
        expect(normalizeVideoImageSyncStatus('synced')).toBe('synced');
        expect(normalizeVideoImageSyncStatus('conflict')).toBe('conflict');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoSourceAssetRef
// ---------------------------------------------------------------------------

describe('normalizeVideoSourceAssetRef', () => {
    it('returns null for non-record', () => {
        expect(normalizeVideoSourceAssetRef(null)).toBeNull();
        expect(normalizeVideoSourceAssetRef('')).toBeNull();
        expect(normalizeVideoSourceAssetRef(42)).toBeNull();
    });

    it('returns null for empty filename', () => {
        expect(normalizeVideoSourceAssetRef({ filename: '' })).toBeNull();
        expect(normalizeVideoSourceAssetRef({ filename: '  ' })).toBeNull();
        expect(normalizeVideoSourceAssetRef({})).toBeNull();
        expect(normalizeVideoSourceAssetRef({ filename: 123 })).toBeNull();
    });

    it('full valid record round-trips', () => {
        const input = {
            filename: 'test.png',
            role: 'start_frame',
            storageModeUsed: 'fs',
            mimeType: 'image/png',
            size: 1024,
            width: 1920,
            height: 1080,
            sha256: 'abc123',
            source: 'uploaded',
            syncStatus: 'local_only'
        };
        const result = normalizeVideoSourceAssetRef(input);
        expect(result).toEqual({
            filename: 'test.png',
            role: 'start_frame',
            storageModeUsed: 'fs',
            mimeType: 'image/png',
            size: 1024,
            width: 1920,
            height: 1080,
            sha256: 'abc123',
            source: 'uploaded',
            syncStatus: 'local_only'
        });
    });

    it('unknown source defaults to uploaded', () => {
        const result = normalizeVideoSourceAssetRef({ filename: 'img.png', source: 'bogus' });
        expect(result).not.toBeNull();
        expect(result!.source).toBe('uploaded');
    });

    it('preserves syncStatus when valid', () => {
        const result = normalizeVideoSourceAssetRef({ filename: 'img.png', syncStatus: 'pending_upload' });
        expect(result).not.toBeNull();
        expect(result!.syncStatus).toBe('pending_upload');
    });

    it('ignores syncStatus when invalid', () => {
        const result = normalizeVideoSourceAssetRef({ filename: 'img.png', syncStatus: 'bogus' });
        expect(result).not.toBeNull();
        expect(result!.syncStatus).toBeUndefined();
    });

    it('trims filename', () => {
        const result = normalizeVideoSourceAssetRef({ filename: '  test.png  ' });
        expect(result).not.toBeNull();
        expect(result!.filename).toBe('test.png');
    });

    it('ignores zero or negative size/width/height', () => {
        const result = normalizeVideoSourceAssetRef({
            filename: 'img.png',
            size: -1,
            width: 0,
            height: -5
        });
        expect(result).not.toBeNull();
        expect(result!.size).toBeUndefined();
        expect(result!.width).toBeUndefined();
        expect(result!.height).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoResultAssetRef
// ---------------------------------------------------------------------------

describe('normalizeVideoResultAssetRef', () => {
    it('returns null for non-record', () => {
        expect(normalizeVideoResultAssetRef(null)).toBeNull();
        expect(normalizeVideoResultAssetRef('')).toBeNull();
    });

    it('returns null for empty filename', () => {
        expect(normalizeVideoResultAssetRef({ filename: '', mimeType: 'video/mp4' })).toBeNull();
        expect(normalizeVideoResultAssetRef({ mimeType: 'video/mp4' })).toBeNull();
    });

    it('returns null for empty mimeType', () => {
        expect(normalizeVideoResultAssetRef({ filename: 'video.mp4', mimeType: '' })).toBeNull();
        expect(normalizeVideoResultAssetRef({ filename: 'video.mp4' })).toBeNull();
        expect(normalizeVideoResultAssetRef({ filename: 'video.mp4', mimeType: 123 })).toBeNull();
    });

    it('full valid record round-trips', () => {
        const input = {
            filename: 'output.mp4',
            kind: 'video',
            mimeType: 'video/mp4',
            storageModeUsed: 'url',
            size: 10_000_000,
            width: 1920,
            height: 1080,
            durationSeconds: 5.0,
            remoteUrl: 'https://example.com/video.mp4',
            remoteUrlExpiresAt: 1700000000000,
            sha256: 'def456',
            syncStatus: 'synced'
        };
        const result = normalizeVideoResultAssetRef(input);
        expect(result).toEqual({
            filename: 'output.mp4',
            kind: 'video',
            mimeType: 'video/mp4',
            storageModeUsed: 'url',
            size: 10_000_000,
            width: 1920,
            height: 1080,
            durationSeconds: 5.0,
            remoteUrl: 'https://example.com/video.mp4',
            remoteUrlExpiresAt: 1700000000000,
            sha256: 'def456',
            syncStatus: 'synced'
        });
    });

    it('preserves remoteUrlExpiresAt as number', () => {
        const result = normalizeVideoResultAssetRef({
            filename: 'v.mp4',
            mimeType: 'video/mp4',
            remoteUrlExpiresAt: 9999999999999
        });
        expect(result).not.toBeNull();
        expect(result!.remoteUrlExpiresAt).toBe(9999999999999);
    });

    it('defaults kind to video when unknown', () => {
        const result = normalizeVideoResultAssetRef({ filename: 'v.mp4', mimeType: 'video/mp4', kind: 'bogus' });
        expect(result).not.toBeNull();
        expect(result!.kind).toBe('video');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoGenerationJob
// ---------------------------------------------------------------------------

describe('normalizeVideoGenerationJob', () => {
    it('returns null for missing id', () => {
        expect(normalizeVideoGenerationJob(null)).toBeNull();
        expect(normalizeVideoGenerationJob({})).toBeNull();
        expect(normalizeVideoGenerationJob({ id: '' })).toBeNull();
        expect(normalizeVideoGenerationJob({ id: '  ' })).toBeNull();
    });

    it('status defaults to queued', () => {
        const result = normalizeVideoGenerationJob({ id: 'job-1' });
        expect(result).not.toBeNull();
        expect(result!.status).toBe('queued');
    });

    it('missing createdAt/updatedAt populated with Date.now()', () => {
        const before = Date.now();
        const result = normalizeVideoGenerationJob({ id: 'job-2' });
        const after = Date.now();
        expect(result).not.toBeNull();
        expect(result!.createdAt).toBeGreaterThanOrEqual(before);
        expect(result!.createdAt).toBeLessThanOrEqual(after);
        expect(result!.updatedAt).toBeGreaterThanOrEqual(before);
        expect(result!.updatedAt).toBeLessThanOrEqual(after);
    });

    it('preserves valid fields', () => {
        const result = normalizeVideoGenerationJob({
            id: 'job-3',
            status: 'succeeded',
            createdAt: 1000,
            updatedAt: 2000,
            providerJobId: 'remote-42',
            progress: 75,
            errorCode: 'TIMEOUT'
        });
        expect(result).toEqual({
            id: 'job-3',
            status: 'succeeded',
            createdAt: 1000,
            updatedAt: 2000,
            providerJobId: 'remote-42',
            progress: 75,
            errorCode: 'TIMEOUT'
        });
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoGenerationParameters
// ---------------------------------------------------------------------------

describe('normalizeVideoGenerationParameters', () => {
    it('returns empty object for non-record', () => {
        expect(normalizeVideoGenerationParameters(null)).toEqual({});
        expect(normalizeVideoGenerationParameters(42)).toEqual({});
        expect(normalizeVideoGenerationParameters('')).toEqual({});
    });

    it('returns empty object for empty record', () => {
        expect(normalizeVideoGenerationParameters({})).toEqual({});
    });

    it('silently drops invalid fields', () => {
        const result = normalizeVideoGenerationParameters({
            durationSeconds: 'bogus',
            aspectRatio: 123,
            frameRate: -1,
            count: 0
        });
        expect(result).toEqual({});
    });

    it('accepts valid parameters', () => {
        const result = normalizeVideoGenerationParameters({
            durationSeconds: 10,
            aspectRatio: '16:9',
            resolutionTier: '1080p',
            frameRate: 30,
            seed: 42,
            count: 4,
            promptEnhanceEnabled: true,
            cameraMotion: 'pan-left',
            shotType: 'single'
        });
        expect(result.durationSeconds).toBe(10);
        expect(result.aspectRatio).toBe('16:9');
        expect(result.resolutionTier).toBe('1080p');
        expect(result.frameRate).toBe(30);
        expect(result.seed).toBe(42);
        expect(result.count).toBe(4);
        expect(result.promptEnhanceEnabled).toBe(true);
        expect(result.cameraMotion).toBe('pan-left');
        expect(result.shotType).toBe('single');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoHistoryMetadata
// ---------------------------------------------------------------------------

describe('normalizeVideoHistoryMetadata', () => {
    function minimalJob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            id: 'job-1',
            status: 'queued',
            createdAt: 1,
            updatedAt: 1,
            ...overrides
        };
    }

    function minimalInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            id: 'hist-1',
            prompt: 'make a video',
            rawModelId: 'model-x',
            type: 'text-to-video',
            timestamp: 100,
            providerEndpointId: 'ep-1',
            providerKind: 'openai',
            providerProtocol: 'openai-images',
            job: minimalJob(),
            ...overrides
        };
    }

    it('returns null for missing id', () => {
        expect(normalizeVideoHistoryMetadata({ prompt: 'x', rawModelId: 'y', job: minimalJob() })).toBeNull();
    });

    it('returns null for missing prompt', () => {
        expect(normalizeVideoHistoryMetadata({ id: 'a', rawModelId: 'y', job: minimalJob() })).toBeNull();
    });

    it('returns null for missing rawModelId', () => {
        expect(normalizeVideoHistoryMetadata({ id: 'a', prompt: 'x', job: minimalJob() })).toBeNull();
    });

    it('returns null for missing job', () => {
        expect(normalizeVideoHistoryMetadata({ id: 'a', prompt: 'x', rawModelId: 'y' })).toBeNull();
    });

    it('returns null for invalid job', () => {
        expect(normalizeVideoHistoryMetadata(minimalInput({ job: { id: '' } }))).toBeNull();
    });

    it('valid round-trips with empty asset arrays', () => {
        const result = normalizeVideoHistoryMetadata(minimalInput());
        expect(result).not.toBeNull();
        expect(result!.id).toBe('hist-1');
        expect(result!.type).toBe('text-to-video');
        expect(result!.prompt).toBe('make a video');
        expect(result!.rawModelId).toBe('model-x');
        expect(result!.providerEndpointId).toBe('ep-1');
        expect(result!.providerKind).toBe('openai');
        expect(result!.providerProtocol).toBe('openai-images');
        expect(result!.sourceAssets).toEqual([]);
        expect(result!.resultAssets).toEqual([]);
        expect(result!.job).not.toBeNull();
        expect(result!.parameters).toEqual({});
    });

    it('unknown type defaults to text-to-video', () => {
        const result = normalizeVideoHistoryMetadata(minimalInput({ type: 'bogus' }));
        expect(result).not.toBeNull();
        expect(result!.type).toBe('text-to-video');
    });

    it('non-array sourceAssets becomes empty array', () => {
        const result = normalizeVideoHistoryMetadata(minimalInput({ sourceAssets: 'not-an-array' }));
        expect(result).not.toBeNull();
        expect(result!.sourceAssets).toEqual([]);
    });

    it('invalid entries in sourceAssets are dropped', () => {
        const result = normalizeVideoHistoryMetadata(minimalInput({
            sourceAssets: [{ filename: 'valid.png' }, { filename: '' }, 'not-a-record']
        }));
        expect(result).not.toBeNull();
        expect(result!.sourceAssets).toHaveLength(1);
        expect(result!.sourceAssets[0].filename).toBe('valid.png');
    });

    it('unknown providerKind defaults to openai-compatible', () => {
        const result = normalizeVideoHistoryMetadata(minimalInput({ providerKind: 'unknown-provider' }));
        expect(result).not.toBeNull();
        expect(result!.providerKind).toBe('openai-compatible');
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoTaskDefaults
// ---------------------------------------------------------------------------

describe('normalizeVideoTaskDefaults', () => {
    it('returns defaults for non-record', () => {
        expect(normalizeVideoTaskDefaults(null)).toEqual(DEFAULT_VIDEO_TASK_DEFAULTS);
        expect(normalizeVideoTaskDefaults(42)).toEqual(DEFAULT_VIDEO_TASK_DEFAULTS);
    });

    it('pollingIntervalSeconds < 1 clamped to 1', () => {
        expect(normalizeVideoTaskDefaults({ pollingIntervalSeconds: -5 }).pollingIntervalSeconds).toBe(1);
        expect(normalizeVideoTaskDefaults({ pollingIntervalSeconds: 0 }).pollingIntervalSeconds).toBe(1);
        expect(normalizeVideoTaskDefaults({ pollingIntervalSeconds: 5 }).pollingIntervalSeconds).toBe(5);
    });

    it('pollingMaxIntervalSeconds >= pollingIntervalSeconds', () => {
        const result = normalizeVideoTaskDefaults({ pollingIntervalSeconds: 10, pollingMaxIntervalSeconds: 5 });
        expect(result.pollingMaxIntervalSeconds).toBe(10);
    });

    it('pollingTimeoutMinutes > 1440 clamped to 1440', () => {
        expect(normalizeVideoTaskDefaults({ pollingTimeoutMinutes: 9999 }).pollingTimeoutMinutes).toBe(1440);
        expect(normalizeVideoTaskDefaults({ pollingTimeoutMinutes: 0 }).pollingTimeoutMinutes).toBe(1);
    });

    it('maxFailureRetries clamped to 0-5', () => {
        expect(normalizeVideoTaskDefaults({ maxFailureRetries: -1 }).maxFailureRetries).toBe(0);
        expect(normalizeVideoTaskDefaults({ maxFailureRetries: 100 }).maxFailureRetries).toBe(5);
        expect(normalizeVideoTaskDefaults({ maxFailureRetries: 3 }).maxFailureRetries).toBe(3);
    });

    it('unknown booleans use defaults', () => {
        expect(normalizeVideoTaskDefaults({}).saveHistoryEnabled).toBe(DEFAULT_VIDEO_TASK_DEFAULTS.saveHistoryEnabled);
        expect(normalizeVideoTaskDefaults({}).autoDownloadEnabled).toBe(DEFAULT_VIDEO_TASK_DEFAULTS.autoDownloadEnabled);
    });

    it('true booleans preserved', () => {
        const result = normalizeVideoTaskDefaults({
            saveHistoryEnabled: true,
            autoDownloadEnabled: true
        });
        expect(result.saveHistoryEnabled).toBe(true);
        expect(result.autoDownloadEnabled).toBe(true);
    });

    it('false booleans preserved as false', () => {
        const result = normalizeVideoTaskDefaults({
            saveHistoryEnabled: false,
            autoDownloadEnabled: false
        });
        expect(result.saveHistoryEnabled).toBe(false);
        expect(result.autoDownloadEnabled).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// normalizeVideoSyncOptions
// ---------------------------------------------------------------------------

describe('normalizeVideoSyncOptions', () => {
    it('returns defaults for non-record', () => {
        expect(normalizeVideoSyncOptions(null)).toEqual(DEFAULT_VIDEO_SYNC_OPTIONS);
        expect(normalizeVideoSyncOptions(42)).toEqual(DEFAULT_VIDEO_SYNC_OPTIONS);
    });

    it('maxVideoAssetBytes < 1 MB clamped to 1 MB', () => {
        const oneMB = 1 * 1024 * 1024;
        expect(normalizeVideoSyncOptions({ maxVideoAssetBytes: 0 }).maxVideoAssetBytes).toBe(oneMB);
        expect(normalizeVideoSyncOptions({ maxVideoAssetBytes: -100 }).maxVideoAssetBytes).toBe(oneMB);
        expect(normalizeVideoSyncOptions({ maxVideoAssetBytes: 500 }).maxVideoAssetBytes).toBe(oneMB);
    });

    it('maxVideoAssetBytes > 5 GB clamped to 5 GB', () => {
        const fiveGB = 5 * 1024 * 1024 * 1024;
        expect(normalizeVideoSyncOptions({ maxVideoAssetBytes: 999_999_999_999 }).maxVideoAssetBytes).toBe(fiveGB);
    });

    it('recentVideoRangeDays > 365 clamped to 365', () => {
        expect(normalizeVideoSyncOptions({ recentVideoRangeDays: 999 }).recentVideoRangeDays).toBe(365);
        expect(normalizeVideoSyncOptions({ recentVideoRangeDays: 0 }).recentVideoRangeDays).toBe(1);
    });

    it('booleans default to DEFAULT_VIDEO_SYNC_OPTIONS when missing/false', () => {
        const result = normalizeVideoSyncOptions({});
        expect(result.videoHistory).toBe(DEFAULT_VIDEO_SYNC_OPTIONS.videoHistory);
        expect(result.videoSourceImages).toBe(DEFAULT_VIDEO_SYNC_OPTIONS.videoSourceImages);
        expect(result.videoThumbnails).toBe(DEFAULT_VIDEO_SYNC_OPTIONS.videoThumbnails);
        expect(result.videoFiles).toBe(DEFAULT_VIDEO_SYNC_OPTIONS.videoFiles);
    });

    it('true boolean overrides default', () => {
        const result = normalizeVideoSyncOptions({ videoFiles: true, videoHistory: true });
        expect(result.videoFiles).toBe(true);
        expect(result.videoHistory).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('video constants', () => {
    it('DEFAULT_VIDEO_TASK_DEFAULTS has correct shape', () => {
        expect(DEFAULT_VIDEO_TASK_DEFAULTS.pollingIntervalSeconds).toBe(5);
        expect(DEFAULT_VIDEO_TASK_DEFAULTS.pollingMaxIntervalSeconds).toBe(30);
        expect(DEFAULT_VIDEO_TASK_DEFAULTS.pollingTimeoutMinutes).toBe(30);
        expect(DEFAULT_VIDEO_TASK_DEFAULTS.maxFailureRetries).toBe(0);
        expect(DEFAULT_VIDEO_TASK_DEFAULTS.saveHistoryEnabled).toBe(true);
        expect(DEFAULT_VIDEO_TASK_DEFAULTS.autoDownloadEnabled).toBe(true);
    });

    it('DEFAULT_VIDEO_SYNC_OPTIONS has correct shape', () => {
        expect(DEFAULT_VIDEO_SYNC_OPTIONS.videoHistory).toBe(true);
        expect(DEFAULT_VIDEO_SYNC_OPTIONS.videoSourceImages).toBe(true);
        expect(DEFAULT_VIDEO_SYNC_OPTIONS.videoThumbnails).toBe(true);
        expect(DEFAULT_VIDEO_SYNC_OPTIONS.videoFiles).toBe(false);
        expect(DEFAULT_VIDEO_SYNC_OPTIONS.recentVideoRangeDays).toBe(7);
        expect(DEFAULT_VIDEO_SYNC_OPTIONS.maxVideoAssetBytes).toBe(100 * 1024 * 1024);
    });
});
