import {
    DEFAULT_SYNC_CONFIG,
    decodeSyncConfigFromShare,
    encodeSyncConfigForShare,
    isS3SyncConfigConfigured,
    normalizeSharedSyncConfig,
    normalizeSyncConfig
} from '@/lib/sync/provider-config';
import { describe, expect, it } from 'vitest';

describe('normalizeSyncConfig', () => {
    it('preserves browser-owned S3 credential fields', () => {
        const config = normalizeSyncConfig({
            type: 's3',
            s3: {
                endpoint: ' http://192.168.0.161:9000 ',
                region: ' us-east-1 ',
                bucket: ' gpt-image-playground ',
                accessKeyId: ' access-key ',
                secretAccessKey: ' secret-key ',
                forcePathStyle: 'true',
                requestMode: 'server',
                prefix: ' custom/root/ ',
                profileId: ' user@example.com '
            }
        });

        expect(config.s3.endpoint).toBe('http://192.168.0.161:9000');
        expect(config.s3.region).toBe('us-east-1');
        expect(config.s3.bucket).toBe('gpt-image-playground');
        expect(config.s3.accessKeyId).toBe('access-key');
        expect(config.s3.secretAccessKey).toBe('secret-key');
        expect(config.s3.forcePathStyle).toBe(true);
        expect(config.s3.requestMode).toBe('server');
        expect(config.s3.prefix).toBe('custom/root');
        expect(config.s3.profileId).toBe('user-example-com');
    });

    it('defaults invalid request mode to direct', () => {
        const config = normalizeSyncConfig({
            type: 's3',
            s3: {
                requestMode: 'invalid'
            }
        });

        expect(config.s3.requestMode).toBe('direct');
    });

    it('defaults path-style access for S3-compatible self-hosted endpoints', () => {
        const config = normalizeSyncConfig({
            type: 's3',
            s3: {
                endpoint: 'http://localhost:9000',
                bucket: 'bucket',
                accessKeyId: 'ak',
                secretAccessKey: 'sk'
            }
        });

        expect(config.s3.forcePathStyle).toBe(DEFAULT_SYNC_CONFIG.s3.forcePathStyle);
        expect(config.s3.forcePathStyle).toBe(true);
    });

    it('roundtrips shareable sync config payloads with credentials intact', () => {
        const config = normalizeSyncConfig({
            type: 's3',
            s3: {
                endpoint: 'https://s3.example.com',
                region: 'us-east-1',
                bucket: 'images',
                accessKeyId: 'ak-share',
                secretAccessKey: 'sk-share',
                forcePathStyle: false,
                requestMode: 'direct',
                prefix: 'gpt-image-playground/v1',
                profileId: 'new-device'
            }
        });

        const encoded = encodeSyncConfigForShare(config, {
            autoRestore: false,
            restoreMetadata: true,
            imageRestoreScope: 'recent',
            recentMs: 24 * 60 * 60 * 1000
        });
        expect(encoded).not.toContain('sk-share');

        const decoded = decodeSyncConfigFromShare(encoded);
        expect(decoded?.config.s3).toEqual(config.s3);
        expect(decoded?.restoreOptions).toEqual({
            autoRestore: false,
            restoreMetadata: true,
            imageRestoreScope: 'recent',
            recentMs: 24 * 60 * 60 * 1000
        });
    });

    it('defaults shared restore options to metadata-only manual restore', () => {
        const config = normalizeSyncConfig({
            type: 's3',
            s3: {
                endpoint: 'https://s3.example.com',
                bucket: 'images',
                accessKeyId: 'ak-share',
                secretAccessKey: 'sk-share'
            }
        });

        const decoded = decodeSyncConfigFromShare(encodeSyncConfigForShare(config));

        expect(decoded?.restoreOptions).toEqual({
            autoRestore: false,
            restoreMetadata: true,
            imageRestoreScope: 'none'
        });
    });

    it('rejects incomplete shared sync config payloads', () => {
        expect(
            normalizeSharedSyncConfig({
                version: 1,
                type: 's3',
                s3: {
                    endpoint: 'https://s3.example.com',
                    bucket: 'images',
                    accessKeyId: 'ak'
                }
            })
        ).toBeNull();
        expect(decodeSyncConfigFromShare('not-valid')).toBeNull();
    });
});

describe('isS3SyncConfigConfigured', () => {
    it('requires endpoint, bucket, access key id, and secret access key', () => {
        expect(isS3SyncConfigConfigured(null)).toBe(false);
        expect(isS3SyncConfigConfigured(DEFAULT_SYNC_CONFIG.s3)).toBe(false);
        expect(
            isS3SyncConfigConfigured({
                ...DEFAULT_SYNC_CONFIG.s3,
                endpoint: 'http://localhost:9000',
                bucket: 'bucket',
                accessKeyId: 'ak'
            })
        ).toBe(false);
        expect(
            isS3SyncConfigConfigured({
                ...DEFAULT_SYNC_CONFIG.s3,
                endpoint: 'http://localhost:9000',
                bucket: 'bucket',
                accessKeyId: 'ak',
                secretAccessKey: 'sk'
            })
        ).toBe(true);
    });
});
