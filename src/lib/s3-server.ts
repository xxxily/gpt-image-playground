import crypto from 'crypto';
import { GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isEnabledEnvFlag } from '@/lib/connection-policy';
import { appendDesktopAppGuidance } from '@/lib/desktop-guidance';
import { buildBasePrefix, DEFAULT_SYNC_ROOT_PREFIX, normalizeSyncRootPrefix, sanitizeSyncProfileId } from '@/lib/sync/key-validation';
import type { S3SyncConfig } from '@/lib/sync/provider-config';

export type S3ServerConfig = {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    rootPrefix: string;
    profileId: string;
    basePrefix: string;
};

export type S3ResolvedConfig = S3ServerConfig;

export function isS3ServerRelayAllowed(): boolean {
    return !isEnabledEnvFlag(process.env.CLIENT_DIRECT_LINK_PRIORITY || process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY);
}

export function formatS3ServerRelayBlockedMessage(): string {
    return appendDesktopAppGuidance('当前部署启用了 CLIENT_DIRECT_LINK_PRIORITY，云存储服务器中转不可用。请在系统设置中使用客户端直连；如果浏览器直连因 CORS 跨域失败，请改用桌面端。');
}

function deriveProfileId(): string {
    if (process.env.S3_PROFILE_ID) return sanitizeSyncProfileId(process.env.S3_PROFILE_ID);
    if (process.env.APP_PASSWORD) {
        return crypto.createHash('sha256').update(process.env.APP_PASSWORD).digest('hex').slice(0, 16);
    }
    return 'default';
}

export function getS3ServerConfig(): S3ServerConfig | null {
    const {
        S3_ENDPOINT,
        S3_REGION,
        S3_BUCKET,
        S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY,
        S3_FORCE_PATH_STYLE,
        S3_PREFIX
    } = process.env;

    if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
        return null;
    }

    const rootPrefix = normalizeSyncRootPrefix(S3_PREFIX || DEFAULT_SYNC_ROOT_PREFIX);
    const profileId = deriveProfileId();

    return {
        endpoint: S3_ENDPOINT,
        region: S3_REGION || 'us-east-1',
        bucket: S3_BUCKET,
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
        forcePathStyle: S3_FORCE_PATH_STYLE === 'true' || S3_FORCE_PATH_STYLE === '1',
        rootPrefix,
        profileId,
        basePrefix: buildBasePrefix(profileId, rootPrefix)
    };
}

export function createPublicS3ConfigResponse(config: S3ResolvedConfig): Omit<S3SyncConfig, 'accessKeyId' | 'secretAccessKey' | 'requestMode'> & { basePrefix: string } {
    return {
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        forcePathStyle: config.forcePathStyle,
        prefix: config.rootPrefix,
        profileId: config.profileId,
        basePrefix: config.basePrefix
    };
}

export function createS3Client(cfg: S3ServerConfig): S3Client {
    return new S3Client({
        endpoint: cfg.endpoint,
        region: cfg.region,
        credentials: {
            accessKeyId: cfg.accessKeyId,
            secretAccessKey: cfg.secretAccessKey
        },
        forcePathStyle: cfg.forcePathStyle
    });
}

export async function generatePresignedPutUrl(
    client: S3Client,
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds = 3600
): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    return getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
}

export async function generatePresignedGetUrl(
    client: S3Client,
    bucket: string,
    key: string,
    expiresInSeconds = 3600
): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
}

export async function listObjectsUnderPrefix(
    client: S3Client,
    bucket: string,
    prefix: string
): Promise<{ key: string; size: number; lastModified: Date }[]> {
    const objects: { key: string; size: number; lastModified: Date }[] = [];
    let continuationToken: string | undefined;

    do {
        const response = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken
        }));

        for (const obj of response.Contents || []) {
            if (obj.Key === undefined || obj.Size === undefined || obj.LastModified === undefined) continue;
            objects.push({
                key: obj.Key,
                size: obj.Size,
                lastModified: obj.LastModified
            });
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return objects;
}

export async function verifyS3Connection(cfg: S3ServerConfig): Promise<{ ok: boolean; error?: string }> {
    try {
        const client = createS3Client(cfg);
        await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
        return { ok: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
    }
}

export const S3_ENV_VAR_NAMES = [
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_PREFIX',
    'S3_PROFILE_ID',
    'S3_FORCE_PATH_STYLE'
] as const;
