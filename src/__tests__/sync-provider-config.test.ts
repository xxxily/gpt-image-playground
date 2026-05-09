import { describe, expect, it } from 'vitest';
import { DEFAULT_SYNC_CONFIG, isS3SyncConfigConfigured, normalizeSyncConfig } from '@/lib/sync/provider-config';

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
});

describe('isS3SyncConfigConfigured', () => {
    it('requires endpoint, bucket, access key id, and secret access key', () => {
        expect(isS3SyncConfigConfigured(null)).toBe(false);
        expect(isS3SyncConfigConfigured(DEFAULT_SYNC_CONFIG.s3)).toBe(false);
        expect(isS3SyncConfigConfigured({
            ...DEFAULT_SYNC_CONFIG.s3,
            endpoint: 'http://localhost:9000',
            bucket: 'bucket',
            accessKeyId: 'ak'
        })).toBe(false);
        expect(isS3SyncConfigConfigured({
            ...DEFAULT_SYNC_CONFIG.s3,
            endpoint: 'http://localhost:9000',
            bucket: 'bucket',
            accessKeyId: 'ak',
            secretAccessKey: 'sk'
        })).toBe(true);
    });
});
