import { loadConfig, type AppConfig } from '@/lib/config';
import { GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { desktopProxyConfigFromAppConfig } from '@/lib/desktop-config';
import { appendDesktopAppGuidance, isLikelyWebDirectAccessError } from '@/lib/desktop-guidance';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import { loadImageHistory, saveImageHistory } from '@/lib/image-history';
import { db } from '@/lib/db';
import { loadPromptHistory, savePromptHistoryEntries } from '@/lib/prompt-history';
import { loadUserPromptTemplates, saveUserPromptTemplates } from '@/lib/prompt-template-storage';
import type { PromptTemplateWithSource } from '@/types/prompt-template';
import { isS3SyncConfigConfigured, loadSyncConfig, type S3SyncRequestMode, type SyncProviderConfig } from '@/lib/sync/provider-config';
import { DEFAULT_MANIFEST_REVISION } from '@/lib/sync/manifest';
import type { ManifestImageEntry, ManifestTombstoneEntry, SnapshotManifest } from '@/lib/sync/manifest';
import { buildManifest, computeSHA256, createSnapshotId, verifyManifestRoundtrip } from '@/lib/sync/snapshot';
import { buildBasePrefix, validateObjectKey } from '@/lib/sync/key-validation';
import type { RestoreSyncMode, SyncResult, UploadSyncMode } from '@/lib/sync/results';
import { emptySyncResult, failedSyncResult } from '@/lib/sync/results';
import type { StorageObjectMetadata, StorageProvider } from '@/lib/sync/storage-provider';
import type { HistoryMetadata } from '@/types/history';

type SignOperation = {
    method: 'PUT' | 'GET' | 'HEAD';
    key: string;
    contentType?: string;
    sha256?: string;
};

type SignResponse = {
    urls: Array<{ key: string; method: string; url: string }>;
};

type ListResponse = {
    prefix: string;
    count: number;
    objects: Array<{ key: string; size: number; lastModified: string }>;
};

export type ImageSyncPreview = {
    operation: 'upload' | 'restore';
    totalImages: number;
    pendingImages: number;
    skippedImages: number;
    force: boolean;
    since?: number;
    manifestKey?: string;
    snapshotId?: string;
    manifestCreatedAt?: number;
};

export type S3StatusResponse = {
    configured: boolean;
    endpoint?: string;
    region?: string;
    bucket?: string;
    forcePathStyle?: boolean;
    rootPrefix?: string;
    profileId?: string;
    basePrefix?: string;
    message?: string;
    envVarsPresent?: Array<{ name: string; present: boolean }>;
};

export type S3ConnectionTestResponse = {
    ok: boolean;
    message?: string;
    error?: string;
    bucket?: string;
    basePrefix?: string;
    config?: Omit<SyncProviderConfig['s3'], 'accessKeyId' | 'secretAccessKey' | 'requestMode'> & { basePrefix: string };
};

type PasswordOptions = {
    passwordHash?: string | null;
};

type S3RequestOptions = PasswordOptions & {
    config?: SyncProviderConfig | null;
};

const CLIENT_SIGNED_URL_EXPIRES_IN_SECONDS = 3600;
const DEFAULT_BULK_DELETE_IMAGE_LIMIT = 50;
const DEFAULT_BULK_DELETE_RATIO_LIMIT = 0.5;
const SYNC_DEVICE_ID_STORAGE_KEY = 'gpt-image-playground-sync-device-id';
type S3TransportMode = 'direct' | 'desktop' | 'server';

type DesktopS3HeadResponse = {
    contentLength?: number;
    metadata?: Record<string, string>;
};

type DesktopS3GetResponse = {
    bytes: number[];
    contentType: string;
};

type SyncResultContext = Pick<SyncResult, 'operation' | 'mode' | 'manifestKey' | 'snapshotId' | 'manifestCreatedAt' | 'bucket' | 'basePrefix' | 'startedAt'>;

function getStoredPasswordHash(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem('clientPasswordHash');
    } catch {
        return null;
    }
}

function getPasswordHash(options?: PasswordOptions): string | null {
    return options?.passwordHash ?? getStoredPasswordHash();
}

function resolveRequestConfig(config?: SyncProviderConfig | null): SyncProviderConfig | null {
    return config ?? loadSyncConfig();
}

function getS3ConfigPayload(config?: SyncProviderConfig | null): SyncProviderConfig['s3'] | undefined {
    const resolved = resolveRequestConfig(config);
    if (!resolved || !isS3SyncConfigConfigured(resolved.s3)) return undefined;
    return resolved.s3;
}

function createBrowserS3Client(config: SyncProviderConfig): S3Client {
    return new S3Client({
        endpoint: config.s3.endpoint,
        region: config.s3.region || 'us-east-1',
        credentials: {
            accessKeyId: config.s3.accessKeyId,
            secretAccessKey: config.s3.secretAccessKey
        },
        forcePathStyle: config.s3.forcePathStyle
    });
}

function resolveS3TransportMode(config: SyncProviderConfig, requestMode?: S3SyncRequestMode): S3TransportMode {
    if (isTauriDesktop()) return 'desktop';
    return (requestMode ?? config.s3.requestMode) === 'server' ? 'server' : 'direct';
}

function getDesktopProxyConfig() {
    return desktopProxyConfigFromAppConfig(loadConfig());
}

function buildS3DirectAccessError(message: string): string {
    const guidance = '如当前 Web 部署未开启 CLIENT_DIRECT_LINK_PRIORITY，且服务端已配置 S3 环境变量，也可以在系统设置的云存储同步中手动切换为“服务器中转”后重试。';
    return appendDesktopAppGuidance(`云存储直连失败：对象存储端点可能不支持当前站点的 CORS 跨域访问。原始错误: ${message} ${guidance}`);
}

function normalizeS3Error(error: unknown, transportMode: S3TransportMode): string {
    const message = error instanceof Error ? error.message : String(error);
    if (transportMode === 'direct' && isLikelyWebDirectAccessError(message)) {
        return buildS3DirectAccessError(message);
    }
    return message;
}

function getResultContext(config: SyncProviderConfig, options?: {
    operation?: SyncResult['operation'];
    mode?: SyncResult['mode'];
    manifest?: SnapshotManifest;
    manifestKey?: string;
    startedAt?: number;
}): SyncResultContext {
    const basePrefix = buildBasePrefix(config.s3.profileId, config.s3.prefix);
    return {
        operation: options?.operation,
        mode: options?.mode,
        manifestKey: options?.manifestKey,
        snapshotId: options?.manifest?.snapshotId,
        manifestCreatedAt: options?.manifest?.createdAt,
        bucket: config.s3.bucket,
        basePrefix,
        startedAt: options?.startedAt
    };
}

function applyResultContext(result: SyncResult, context: SyncResultContext): SyncResult {
    return {
        ...result,
        operation: context.operation ?? result.operation,
        mode: context.mode ?? result.mode,
        manifestKey: context.manifestKey ?? result.manifestKey,
        snapshotId: context.snapshotId ?? result.snapshotId,
        manifestCreatedAt: context.manifestCreatedAt ?? result.manifestCreatedAt,
        bucket: context.bucket ?? result.bucket,
        basePrefix: context.basePrefix ?? result.basePrefix,
        startedAt: context.startedAt ?? result.startedAt
    };
}

function finishResult(result: SyncResult): SyncResult {
    return { ...result, completedAt: Date.now() };
}

function createSyncDeviceId(): string {
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `device-${randomPart}`;
}

export function getOrCreateSyncDeviceId(): string {
    if (typeof window === 'undefined') return createSyncDeviceId();

    try {
        const existing = localStorage.getItem(SYNC_DEVICE_ID_STORAGE_KEY);
        if (existing) return existing;
        const next = createSyncDeviceId();
        localStorage.setItem(SYNC_DEVICE_ID_STORAGE_KEY, next);
        return next;
    } catch {
        return createSyncDeviceId();
    }
}

export async function fetchS3Status(options?: S3RequestOptions): Promise<S3StatusResponse> {
    const hash = getPasswordHash(options);
    const resolvedConfig = resolveRequestConfig(options?.config);
    const s3Config = resolvedConfig && isS3SyncConfigConfigured(resolvedConfig.s3) ? resolvedConfig.s3 : undefined;

    if (resolvedConfig && s3Config && resolvedConfig.s3.requestMode !== 'server') {
        return {
            configured: true,
            endpoint: s3Config.endpoint,
            region: s3Config.region,
            bucket: s3Config.bucket,
            forcePathStyle: s3Config.forcePathStyle,
            rootPrefix: s3Config.prefix,
            profileId: s3Config.profileId,
            basePrefix: buildBasePrefix(s3Config.profileId, s3Config.prefix)
        };
    }

    const headers = new Headers();
    if (hash) headers.set('Authorization', `Bearer ${hash}`);
    const response = await fetch('/api/storage/s3/status', { headers });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to load S3 status.' }));
        const message = typeof payload.error === 'string' ? payload.error : 'Failed to load S3 status.';
        throw new Error(message);
    }
    return response.json() as Promise<S3StatusResponse>;
}

export async function testS3Connection(options?: S3RequestOptions): Promise<S3ConnectionTestResponse> {
    const hash = getPasswordHash(options);
    const resolvedConfig = resolveRequestConfig(options?.config);
    const s3Config = resolvedConfig && isS3SyncConfigConfigured(resolvedConfig.s3) ? resolvedConfig.s3 : undefined;
    if (s3Config && resolvedConfig) {
        try {
            const transportMode = resolveS3TransportMode(resolvedConfig);
            if (transportMode === 'server') {
                return testS3ConnectionViaServer(hash);
            }
            if (transportMode === 'desktop') {
                const listUrl = await signListObjectsUrl(
                    resolvedConfig,
                    `${buildBasePrefix(s3Config.profileId, s3Config.prefix)}/`
                );
                await fetchSignedUrlThroughDesktop(listUrl);
            } else {
                const client = createBrowserS3Client(resolvedConfig);
                await client.send(new HeadBucketCommand({ Bucket: s3Config.bucket }));
            }
            return {
                ok: true,
                message: 'S3 connection successful.',
                bucket: s3Config.bucket,
                basePrefix: buildBasePrefix(s3Config.profileId, s3Config.prefix),
                config: {
                    endpoint: s3Config.endpoint,
                    region: s3Config.region,
                    bucket: s3Config.bucket,
                    forcePathStyle: s3Config.forcePathStyle,
                    prefix: s3Config.prefix,
                    profileId: s3Config.profileId,
                    basePrefix: buildBasePrefix(s3Config.profileId, s3Config.prefix)
                }
            };
        } catch (err: unknown) {
            return { ok: false, error: normalizeS3Error(err, resolveS3TransportMode(resolvedConfig)) };
        }
    }

    return testS3ConnectionViaServer(hash);
}

async function testS3ConnectionViaServer(hash: string | null): Promise<S3ConnectionTestResponse> {
    const response = await fetch('/api/storage/s3/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordHash: hash })
    });
    const payload = await response.json().catch(() => ({ ok: false, error: 'Failed to test S3 connection.' }));
    if (!response.ok) {
        return {
            ok: false,
            error: typeof payload.error === 'string' ? payload.error : `S3 test failed with status ${response.status}`
        };
    }
    return payload as S3ConnectionTestResponse;
}

async function signOperations(ops: SignOperation[], basePrefix: string, config: SyncProviderConfig): Promise<SignResponse> {
    const s3Config = getS3ConfigPayload(config);
    const urls: SignResponse['urls'] = [];

    if (!s3Config) {
        throw new Error('Network object storage is not configured. Configure S3-compatible storage in Settings first.');
    }

    const client = createBrowserS3Client(config);

    for (const op of ops) {
        if (op.method !== 'PUT' && op.method !== 'GET' && op.method !== 'HEAD') {
            throw new Error(`Unsupported operation method: ${op.method}`);
        }
        const keyValidation = validateObjectKey(op.key, basePrefix);
        if (!keyValidation.valid) {
            throw new Error(`Invalid object key "${op.key}": ${keyValidation.reason}`);
        }

        let url: string;
        if (op.method === 'PUT') {
            url = await getSignedUrl(
                client,
                new PutObjectCommand({
                    Bucket: s3Config.bucket,
                    Key: op.key,
                    ContentType: op.contentType || 'application/octet-stream',
                    Metadata: op.sha256 ? { sha256: op.sha256 } : undefined
                }),
                { expiresIn: CLIENT_SIGNED_URL_EXPIRES_IN_SECONDS }
            );
        } else if (op.method === 'GET') {
            url = await getSignedUrl(
                client,
                new GetObjectCommand({ Bucket: s3Config.bucket, Key: op.key }),
                { expiresIn: CLIENT_SIGNED_URL_EXPIRES_IN_SECONDS }
            );
        } else {
            url = await getSignedUrl(
                client,
                new HeadObjectCommand({ Bucket: s3Config.bucket, Key: op.key }),
                { expiresIn: CLIENT_SIGNED_URL_EXPIRES_IN_SECONDS }
            );
        }
        urls.push({ key: op.key, method: op.method, url });
    }

    return { urls };
}

async function signListObjectsUrl(config: SyncProviderConfig, prefix: string, continuationToken?: string): Promise<string> {
    const s3Config = getS3ConfigPayload(config);
    if (!s3Config) {
        throw new Error('Network object storage is not configured. Configure S3-compatible storage in Settings first.');
    }

    const client = createBrowserS3Client(config);
    return getSignedUrl(
        client,
        new ListObjectsV2Command({
            Bucket: s3Config.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken
        }),
        { expiresIn: CLIENT_SIGNED_URL_EXPIRES_IN_SECONDS }
    );
}

async function fetchSignedUrlThroughDesktop(url: string): Promise<Blob> {
    const response = await invokeDesktopCommand<DesktopS3GetResponse>('proxy_s3_get', {
        url,
        proxyConfig: getDesktopProxyConfig()
    });
    return new Blob([new Uint8Array(response.bytes)], { type: response.contentType || 'application/octet-stream' });
}

async function uploadSignedUrlThroughDesktop(url: string, blob: Blob, sha256?: string): Promise<void> {
    await invokeDesktopCommand<void>('proxy_s3_put', {
        url,
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
        contentType: blob.type || 'application/octet-stream',
        sha256,
        proxyConfig: getDesktopProxyConfig()
    });
}

async function headSignedUrlThroughDesktop(url: string): Promise<DesktopS3HeadResponse> {
    return invokeDesktopCommand<DesktopS3HeadResponse>('proxy_s3_head', {
        url,
        proxyConfig: getDesktopProxyConfig()
    });
}

async function headObjectThroughServer(key: string): Promise<{ contentLength?: number; metadata?: Record<string, string> } | null> {
    const response = await fetch('/api/storage/s3/object', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            operation: 'HEAD',
            key,
            passwordHash: getStoredPasswordHash()
        })
    });

    if (response.status === 404) return null;
    const payload = await response.json().catch(() => null) as { contentLength?: number; metadata?: Record<string, string>; error?: string } | null;
    if (!response.ok) {
        throw new Error(payload?.error || `S3 server relay HEAD failed with status ${response.status}`);
    }
    return { contentLength: payload?.contentLength, metadata: payload?.metadata };
}

async function uploadObjectThroughServer(key: string, blob: Blob, sha256?: string): Promise<void> {
    const headers = new Headers({
        'Content-Type': blob.type || 'application/octet-stream',
        'x-sync-object-key': key
    });
    const passwordHash = getStoredPasswordHash();
    if (passwordHash) headers.set('x-app-password', passwordHash);
    if (sha256) headers.set('x-amz-meta-sha256', sha256);

    const response = await fetch('/api/storage/s3/object', {
        method: 'PUT',
        headers,
        body: blob
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: `S3 server relay PUT failed with status ${response.status}` }));
        throw new Error(typeof payload.error === 'string' ? payload.error : `S3 server relay PUT failed with status ${response.status}`);
    }
}

async function downloadObjectThroughServer(key: string): Promise<Blob> {
    const params = new URLSearchParams({ key });
    const passwordHash = getStoredPasswordHash();
    if (passwordHash) params.set('passwordHash', passwordHash);

    const response = await fetch(`/api/storage/s3/object?${params.toString()}`);
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: `S3 server relay GET failed with status ${response.status}` }));
        throw new Error(typeof payload.error === 'string' ? payload.error : `S3 server relay GET failed with status ${response.status}`);
    }
    return response.blob();
}

function parseListObjectsXml(xmlText: string): { objects: ListResponse['objects']; nextContinuationToken?: string } {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    const contents = Array.from(doc.getElementsByTagName('Contents'));
    const objects = contents.flatMap((node): ListResponse['objects'] => {
        const key = node.getElementsByTagName('Key')[0]?.textContent || '';
        const sizeText = node.getElementsByTagName('Size')[0]?.textContent || '';
        const lastModified = node.getElementsByTagName('LastModified')[0]?.textContent || '';
        const size = Number(sizeText);
        if (!key || !Number.isFinite(size) || !lastModified) return [];
        return [{ key, size, lastModified }];
    });
    const nextContinuationToken = doc.getElementsByTagName('NextContinuationToken')[0]?.textContent || undefined;
    return { objects, nextContinuationToken };
}

async function listObjectsThroughDesktop(config: SyncProviderConfig, prefix: string): Promise<ListResponse> {
    const objects: ListResponse['objects'] = [];
    let continuationToken: string | undefined;

    do {
        const url = await signListObjectsUrl(config, prefix, continuationToken);
        const text = await (await fetchSignedUrlThroughDesktop(url)).text();
        const parsed = parseListObjectsXml(text);
        objects.push(...parsed.objects);
        continuationToken = parsed.nextContinuationToken;
    } while (continuationToken);

    return { prefix: buildBasePrefix(config.s3.profileId, config.s3.prefix), count: objects.length, objects };
}

async function listObjectsThroughServer(prefix: string): Promise<ListResponse> {
    const response = await fetch('/api/storage/s3/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, passwordHash: getStoredPasswordHash() })
    });
    const payload = await response.json().catch(() => ({ error: `S3 server relay list failed with status ${response.status}` }));
    if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : `S3 server relay list failed with status ${response.status}`);
    }
    return payload as ListResponse;
}

async function uploadObject(config: SyncProviderConfig, key: string, blob: Blob, sha256: string | undefined, transportMode: S3TransportMode, basePrefix: string): Promise<void> {
    try {
        if (transportMode === 'server') {
            await uploadObjectThroughServer(key, blob, sha256);
            return;
        }

        const signResponse = await signOperations([
            { method: 'PUT', key, contentType: blob.type || 'application/octet-stream', sha256 }
        ], basePrefix, config);
        const url = signResponse.urls[0]?.url;
        if (!url) throw new Error('Missing signed URL for object upload.');
        if (transportMode === 'desktop') {
            await uploadSignedUrlThroughDesktop(url, blob, sha256);
            return;
        }
        await uploadToSignedUrl(url, blob, sha256);
    } catch (error) {
        throw new Error(normalizeS3Error(error, transportMode));
    }
}

async function headObject(
    config: SyncProviderConfig,
    key: string,
    transportMode: S3TransportMode,
    basePrefix: string
): Promise<{ contentLength?: number; metadata?: StorageObjectMetadata } | null> {
    try {
        if (transportMode === 'server') {
            return headObjectThroughServer(key);
        }
        if (transportMode === 'desktop') {
            const signResponse = await signOperations([{ method: 'HEAD', key }], basePrefix, config);
            const url = signResponse.urls[0]?.url;
            if (!url) return null;
            return headSignedUrlThroughDesktop(url);
        }

        const client = createBrowserS3Client(config);
        const s3Config = getS3ConfigPayload(config);
        if (!s3Config) return null;
        const response = await client.send(new HeadObjectCommand({ Bucket: s3Config.bucket, Key: key }));
        return { contentLength: response.ContentLength, metadata: response.Metadata };
    } catch {
        return null;
    }
}

async function downloadObject(config: SyncProviderConfig, key: string, transportMode: S3TransportMode, basePrefix: string): Promise<Blob> {
    try {
        if (transportMode === 'server') {
            return downloadObjectThroughServer(key);
        }

        const signResponse = await signOperations([{ method: 'GET', key }], basePrefix, config);
        const url = signResponse.urls[0]?.url;
        if (!url) throw new Error('Missing signed URL for object download.');
        return transportMode === 'desktop'
            ? fetchSignedUrlThroughDesktop(url)
            : downloadFromSignedUrl(url);
    } catch (error) {
        throw new Error(normalizeS3Error(error, transportMode));
    }
}

async function listObjects(
    config: SyncProviderConfig,
    prefix: string,
    transportMode: S3TransportMode
): Promise<ListResponse> {
    if (transportMode === 'server') {
        return listObjectsThroughServer(prefix);
    }
    if (transportMode === 'desktop') {
        return listObjectsThroughDesktop(config, prefix);
    }

    const s3Config = getS3ConfigPayload(config);
    if (!s3Config) {
        throw new Error('Network object storage is not configured. Configure S3-compatible storage in Settings first.');
    }

    const client = createBrowserS3Client(config);
    const objects: ListResponse['objects'] = [];
    let continuationToken: string | undefined;

    try {
        do {
            const response = await client.send(new ListObjectsV2Command({
                Bucket: s3Config.bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken
            }));

            for (const object of response.Contents || []) {
                if (!object.Key || object.Size === undefined || !object.LastModified) continue;
                objects.push({
                    key: object.Key,
                    size: object.Size,
                    lastModified: object.LastModified.toISOString()
                });
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);
    } catch (error) {
        throw new Error(normalizeS3Error(error, transportMode));
    }

    return { prefix, count: objects.length, objects };
}

export function createS3StorageProvider(config: SyncProviderConfig, options?: { requestMode?: S3SyncRequestMode }): StorageProvider {
    const basePrefix = buildBasePrefix(config.s3.profileId, config.s3.prefix);
    const transportMode = resolveS3TransportMode(config, options?.requestMode);
    return {
        kind: 's3-compatible',
        displayName: 'S3-compatible object storage',
        putObject: (key, blob, metadata) => uploadObject(config, key, blob, metadata?.sha256, transportMode, basePrefix),
        getObject: (key) => downloadObject(config, key, transportMode, basePrefix),
        headObject: (key) => headObject(config, key, transportMode, basePrefix),
        listObjects: async (prefix) => (await listObjects(config, prefix, transportMode)).objects
    };
}

async function listImageFilenames(): Promise<string[]> {
    const keys = await db.images.toCollection().primaryKeys();
    return keys.filter((key): key is string => typeof key === 'string');
}

async function getImageBlob(filename: string): Promise<Blob | null> {
    const record = await db.images.get(filename);
    return record?.blob ?? null;
}

function getRecentHistoryImageFilenames(manifest: Pick<SnapshotManifest, 'imageHistory'>, since?: number): Set<string> | null {
    if (since === undefined) return null;
    if (!Number.isFinite(since)) return new Set();

    const filenames = new Set<string>();
    for (const item of manifest.imageHistory) {
        if (item.timestamp < since) continue;
        for (const image of item.images ?? []) {
            filenames.add(image.filename);
        }
    }
    return filenames;
}

export function normalizeRestoredImageHistoryForIndexedDb(
    imageHistory: HistoryMetadata[],
    restoredFilenames?: ReadonlySet<string>
): HistoryMetadata[] {
    return filterImageHistoryByFilenames(imageHistory, restoredFilenames)
        .map((entry) => ({
            ...entry,
            images: entry.images.map((image) => ({ filename: image.filename })),
            storageModeUsed: 'indexeddb' as const
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
}

function filterImageHistoryByFilenames(
    imageHistory: HistoryMetadata[],
    filenames?: ReadonlySet<string>
): HistoryMetadata[] {
    return imageHistory
        .map((entry): HistoryMetadata | null => {
            const images = entry.images
                .filter((image) => !filenames || filenames.has(image.filename))
                .map((image) => ({ ...image }));

            if (images.length === 0) return null;

            return {
                ...entry,
                images
            };
        })
        .filter((entry): entry is HistoryMetadata => entry !== null);
}

export function mergeRestoredImageHistory(
    currentHistory: HistoryMetadata[],
    restoredHistory: HistoryMetadata[]
): HistoryMetadata[] {
    const mergedByTimestamp = new Map<number, HistoryMetadata>();

    for (const entry of currentHistory) {
        mergedByTimestamp.set(entry.timestamp, entry);
    }
    for (const entry of restoredHistory) {
        mergedByTimestamp.set(entry.timestamp, entry);
    }

    return Array.from(mergedByTimestamp.values()).sort((a, b) => b.timestamp - a.timestamp);
}

function saveRestoredImageHistoryForIndexedDb(
    manifest: SnapshotManifest,
    restoredFilenames: ReadonlySet<string>,
    mode: 'replace' | 'merge'
): void {
    const restoredHistory = normalizeRestoredImageHistoryForIndexedDb(manifest.imageHistory, restoredFilenames);
    if (restoredHistory.length === 0) return;

    const nextHistory = mode === 'merge'
        ? mergeRestoredImageHistory(loadImageHistory().history, restoredHistory)
        : restoredHistory;
    saveImageHistory(nextHistory);
}

async function buildLocalImageEntries(basePrefix: string, since?: number): Promise<ManifestImageEntry[]> {
    const localHistory = loadImageHistory().history;
    const recentFilenames = getRecentHistoryImageFilenames({ imageHistory: localHistory }, since);
    const imageEntries: ManifestImageEntry[] = [];

    for (const filename of await listImageFilenames()) {
        if (recentFilenames && !recentFilenames.has(filename)) continue;

        const blob = await getImageBlob(filename);
        if (!blob) continue;
        imageEntries.push({
            filename,
            sha256: await computeSHA256(blob),
            objectKey: `${basePrefix}/snapshots/pending/images/${filename}`,
            mimeType: blob.type || 'application/octet-stream',
            size: blob.size
        });
    }

    return imageEntries;
}

export function buildSyncedImageObjectKey(basePrefix: string, sha256: string, filename: string): string {
    return `${basePrefix}/images/${sha256}/${filename}`;
}

export function buildManifestBackupKey(basePrefix: string, snapshotId: string, previousSnapshotId: string): string {
    return `${basePrefix}/snapshots/${snapshotId}/backups/${previousSnapshotId}-manifest.json`;
}

export function createBulkDeletionPlan(options: {
    previousManifest: SnapshotManifest | null;
    currentImages: ManifestImageEntry[];
    deviceId: string;
    deletedAt?: number;
    allowBulkDeletion?: boolean;
    maxDeletedImages?: number;
    maxDeletedRatio?: number;
}): {
    allowed: boolean;
    tombstones: ManifestTombstoneEntry[];
    reason?: string;
} {
    if (!options.previousManifest || options.previousManifest.images.length === 0) {
        return { allowed: true, tombstones: [] };
    }

    const currentFilenames = new Set(options.currentImages.map((image) => image.filename));
    const missingImages = options.previousManifest.images.filter((image) => !currentFilenames.has(image.filename));
    const deletedAt = options.deletedAt ?? Date.now();
    const tombstones: ManifestTombstoneEntry[] = missingImages.map((image) => ({
        filename: image.filename,
        objectKey: image.objectKey,
        sha256: image.sha256,
        deletedAt,
        deviceId: options.deviceId,
        reason: 'local-delete'
    }));

    if (missingImages.length === 0) {
        return { allowed: true, tombstones };
    }

    const maxDeletedImages = options.maxDeletedImages ?? DEFAULT_BULK_DELETE_IMAGE_LIMIT;
    const maxDeletedRatio = options.maxDeletedRatio ?? DEFAULT_BULK_DELETE_RATIO_LIMIT;
    const deletedRatio = missingImages.length / options.previousManifest.images.length;
    const exceedsLimit = missingImages.length > maxDeletedImages || deletedRatio > maxDeletedRatio;

    if (exceedsLimit && !options.allowBulkDeletion) {
        return {
            allowed: false,
            tombstones,
            reason: `Bulk deletion guard blocked publishing ${missingImages.length} tombstone(s) from ${options.previousManifest.images.length} previous image(s). Set allowBulkDeletion to true to allow intentional deletion sync.`
        };
    }

    return { allowed: true, tombstones };
}

export function isRemoteObjectCurrent(
    remote: { contentLength?: number; metadata?: Record<string, string> },
    expected: { size?: number; sha256?: string }
): boolean {
    if (expected.size !== undefined && remote.contentLength !== expected.size) return false;
    if (!expected.sha256) return true;

    const remoteSha256 = Object.entries(remote.metadata ?? {})
        .find(([key]) => key.toLowerCase() === 'sha256')?.[1];

    return remoteSha256 ? remoteSha256 === expected.sha256 : true;
}

export function mergePreviousImageEntriesForMetadata(
    manifest: SnapshotManifest,
    previousManifest: SnapshotManifest | null
): SnapshotManifest {
    if (!previousManifest || previousManifest.images.length === 0) return manifest;
    return mergeManifestImageEntries({ ...manifest, images: [] }, previousManifest);
}

export function mergeManifestImageEntries(
    manifest: SnapshotManifest,
    previousManifest: SnapshotManifest | null
): SnapshotManifest {
    if (!previousManifest || previousManifest.images.length === 0) return manifest;

    const merged = new Map<string, ManifestImageEntry>();
    for (const image of previousManifest.images) {
        merged.set(image.filename, { ...image });
    }
    for (const image of manifest.images) {
        merged.set(image.filename, { ...image });
    }

    return { ...manifest, images: Array.from(merged.values()) };
}

export function filterManifestImagesBySince(manifest: SnapshotManifest, since?: number): SnapshotManifest {
    const recentFilenames = getRecentHistoryImageFilenames(manifest, since);
    if (!recentFilenames) return manifest;
    const filteredImages = manifest.images.filter((image) => recentFilenames.has(image.filename));
    const filteredImageFilenames = new Set(filteredImages.map((image) => image.filename));

    return {
        ...manifest,
        images: filteredImages,
        imageHistory: filterImageHistoryByFilenames(manifest.imageHistory, filteredImageFilenames),
        imageScopeSince: since
    };
}

export function getRestorePlan(mode: RestoreSyncMode, manifest: SnapshotManifest): {
    restoreMetadata: boolean;
    restoreImages: boolean;
    totalImages: number;
} {
    const restoreMetadata = mode === 'full' || mode === 'metadata';
    const restoreImages = (mode === 'full' || mode === 'images') && manifest.images.length > 0;
    return {
        restoreMetadata,
        restoreImages,
        totalImages: restoreImages ? manifest.images.length : 0
    };
}

async function loadPreviousManifestForUpload(
    config: SyncProviderConfig,
    latestManifestKey: string,
    transportMode: S3TransportMode,
    requestMode?: S3SyncRequestMode
): Promise<SnapshotManifest | null> {
    try {
        return await downloadManifestOnly(config, latestManifestKey, transportMode);
    } catch (error) {
        console.warn('Failed to load latest manifest pointer before upload:', error);
    }

    try {
        const listed = await listSnapshots(config, { requestMode });
        const prevManifestKey = findLatestManifestKey(listed);
        if (!prevManifestKey || prevManifestKey === latestManifestKey) return null;
        return await downloadManifestOnly(config, prevManifestKey, transportMode);
    } catch (error) {
        console.warn('Failed to load previous snapshot manifest before upload:', error);
        return null;
    }
}

function getNextManifestRevision(previousManifest: SnapshotManifest | null): number {
    return previousManifest?.revision ? previousManifest.revision + 1 : DEFAULT_MANIFEST_REVISION;
}

export async function uploadSnapshot(options: {
    config: SyncProviderConfig;
    appConfig: AppConfig;
    mode?: UploadSyncMode;
    force?: boolean;
    allowBulkDeletion?: boolean;
    since?: number;
    requestMode?: S3SyncRequestMode;
    onProgress?: (result: SyncResult) => void;
}): Promise<SyncResult> {
    let result = emptySyncResult('snapshot');
    const startedAt = Date.now();

    try {
        const basePrefix = buildBasePrefix(options.config.s3.profileId, options.config.s3.prefix);
        const mode = options.mode ?? 'full';
        const transportMode = resolveS3TransportMode(options.config, options.requestMode);
        const baseContext = getResultContext(options.config, { operation: 'upload', mode, startedAt });
        const deviceId = getOrCreateSyncDeviceId();
        const snapshotId = createSnapshotId();
        const snapshotPrefix = `${basePrefix}/snapshots/${snapshotId}`;
        const snapshotManifestKey = `${snapshotPrefix}/manifest.json`;
        const latestManifestKey = `${basePrefix}/manifest.json`;
        const previousManifest = await loadPreviousManifestForUpload(options.config, latestManifestKey, transportMode, options.requestMode);
        const previousManifestBackupKey = previousManifest
            ? buildManifestBackupKey(basePrefix, snapshotId, previousManifest.snapshotId)
            : undefined;
        const imageEntries = mode === 'full'
            ? await buildLocalImageEntries(basePrefix, options.since)
            : [];
        const uploadImageFilenames = new Set(imageEntries.map((image) => image.filename));

        const pendingManifest = buildManifest(
            snapshotId,
            `${basePrefix}/snapshots/pending`,
            options.appConfig,
            loadPromptHistory(),
            loadUserPromptTemplates().filter(t => t.source === 'user'),
            loadImageHistory().history,
            imageEntries,
            undefined,
            mode,
            {
                revision: getNextManifestRevision(previousManifest),
                deviceId,
                parentSnapshotId: previousManifest?.snapshotId,
                previousManifestBackupKey,
                tombstones: previousManifest?.tombstones ?? []
            }
        );

        result = applyResultContext(emptySyncResult('snapshot'), baseContext);
        options.onProgress?.(result);

        const manifest: SnapshotManifest = {
            ...pendingManifest,
            imageScopeSince: options.since,
            images: pendingManifest.images.map((image) => ({
                ...image,
                objectKey: buildSyncedImageObjectKey(basePrefix, image.sha256, image.filename)
            }))
        };

        if (mode === 'metadata') {
            manifest.totalLocalImages = await db.images.count();
        }

        const manifestContext = getResultContext(options.config, {
            operation: 'upload',
            mode,
            manifest,
            manifestKey: latestManifestKey,
            startedAt
        });
        // For metadata-only sync, try to merge previous image entries from the latest manifest
        // so that restore still sees previously-uploaded images.
        if (mode === 'metadata') {
            manifest.images = mergePreviousImageEntriesForMetadata(manifest, previousManifest).images;
        }

        if (mode === 'full' && options.since !== undefined) {
            manifest.images = mergeManifestImageEntries(manifest, previousManifest).images;
        }

        const deletionPlan = createBulkDeletionPlan({
            previousManifest,
            currentImages: manifest.images,
            deviceId,
            allowBulkDeletion: options.allowBulkDeletion
        });
        if (!deletionPlan.allowed) {
            throw new Error(deletionPlan.reason ?? 'Bulk deletion guard blocked publishing this manifest.');
        }
        manifest.tombstones = [...(previousManifest?.tombstones ?? []), ...deletionPlan.tombstones];

        const imagesToUpload = mode === 'full'
            ? manifest.images.filter((image) => uploadImageFilenames.has(image.filename))
            : [];

        result.phase = 'upload-images';
        result.manifestKey = latestManifestKey;
        result = applyResultContext(result, manifestContext);
        result.totalImages = imagesToUpload.length;
        if (mode === 'metadata') {
            result.totalImages = manifest.totalLocalImages ?? 0;
        }
        options.onProgress?.(result);

        let skippedImages = 0;
        let firstImageError: string | undefined;

        if (mode === 'full') {
            const existingKeys = new Set<string>();

            for (const img of imagesToUpload) {
                if (!options.force && await objectExists(options.config, img.objectKey, img.size, img.sha256, transportMode, basePrefix)) {
                    existingKeys.add(img.objectKey);
                    skippedImages++;
                    result.skippedImages = skippedImages;
                    result.imageStatuses[img.filename] = 'synced';
                    result.completedImages++;
                    options.onProgress?.({ ...result });
                    continue;
                }
            }

            for (const img of imagesToUpload) {
                if (existingKeys.has(img.objectKey)) continue;

                const blob = await getImageBlob(img.filename);
                if (!blob) {
                    firstImageError ??= `本地图片 ${img.filename} 不存在，无法上传。`;
                    result.failedImages++;
                    result.imageStatuses[img.filename] = 'error';
                    continue;
                }

                result.imageStatuses[img.filename] = 'uploading';
                try {
                    await uploadObject(options.config, img.objectKey, blob, img.sha256, transportMode, basePrefix);
                    result.imageStatuses[img.filename] = 'uploaded';
                    result.completedImages++;
                } catch (error) {
                    firstImageError ??= normalizeS3Error(error, transportMode);
                    result.imageStatuses[img.filename] = 'error';
                    result.failedImages++;
                }
                options.onProgress?.({ ...result });
            }
        }

        manifest.skippedImages = skippedImages || undefined;
        const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });

        if (result.failedImages === 0) {
            result.phase = 'upload-manifest';
            options.onProgress?.(applyResultContext({ ...result }, manifestContext));
            if (previousManifest && previousManifestBackupKey) {
                const backupBlob = new Blob([JSON.stringify(previousManifest, null, 2)], { type: 'application/json' });
                await uploadObject(options.config, previousManifestBackupKey, backupBlob, undefined, transportMode, basePrefix);
            }
            await uploadObject(options.config, snapshotManifestKey, manifestBlob, undefined, transportMode, basePrefix);
            await uploadObject(options.config, latestManifestKey, manifestBlob, undefined, transportMode, basePrefix);
        }

        result.skippedImages = skippedImages;
        if (result.failedImages > 0 && firstImageError) {
            result.error = firstImageError;
        }
        result.ok = result.failedImages === 0;
        return finishResult(applyResultContext(result, manifestContext));
    } catch (err: unknown) {
        const transportMode = resolveS3TransportMode(options.config, options.requestMode);
        return finishResult({
            ...failedSyncResult('snapshot', normalizeS3Error(err, transportMode)),
            operation: 'upload',
            mode: options.mode ?? 'full',
            startedAt
        });
    }
}

async function isLocalImageCurrent(image: ManifestImageEntry): Promise<boolean> {
    const blob = await getImageBlob(image.filename);
    if (!blob) return false;
    if (blob.size !== image.size) return false;
    return computeSHA256(blob).then((sha256) => sha256 === image.sha256).catch(() => false);
}

export async function previewUploadSnapshot(options: {
    config: SyncProviderConfig;
    force?: boolean;
    since?: number;
    requestMode?: S3SyncRequestMode;
}): Promise<ImageSyncPreview> {
    const basePrefix = buildBasePrefix(options.config.s3.profileId, options.config.s3.prefix);
    const imageEntries = await buildLocalImageEntries(basePrefix, options.since);
    const force = Boolean(options.force);
    const transportMode = resolveS3TransportMode(options.config, options.requestMode);

    if (force || imageEntries.length === 0) {
        return {
            operation: 'upload',
            totalImages: imageEntries.length,
            pendingImages: imageEntries.length,
            skippedImages: 0,
            force,
            since: options.since
        };
    }

    let skippedImages = 0;

    for (const image of imageEntries) {
        const objectKey = buildSyncedImageObjectKey(basePrefix, image.sha256, image.filename);
        if (await objectExists(options.config, objectKey, image.size, image.sha256, transportMode, basePrefix)) {
            skippedImages++;
        }
    }

    return {
        operation: 'upload',
        totalImages: imageEntries.length,
        pendingImages: imageEntries.length - skippedImages,
        skippedImages,
        force,
        since: options.since
    };
}

async function objectExists(
    config: SyncProviderConfig,
    key: string,
    expectedSize: number | undefined,
    expectedSha256: string | undefined,
    transportMode: S3TransportMode,
    basePrefix: string
): Promise<boolean> {
    const response = await headObject(config, key, transportMode, basePrefix);
    if (!response) return false;
    return isRemoteObjectCurrent(
        { contentLength: response.contentLength, metadata: response.metadata },
        { size: expectedSize, sha256: expectedSha256 }
    );
}

async function uploadToSignedUrl(url: string, blob: Blob, sha256?: string): Promise<void> {
    const headers = new Headers({ 'Content-Type': blob.type || 'application/octet-stream' });
    if (sha256) headers.set('x-amz-meta-sha256', sha256);

    const res = await fetch(url, {
        method: 'PUT',
        body: blob,
        headers
    });
    if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
    }
}

export async function listSnapshots(config: SyncProviderConfig, options?: { requestMode?: S3SyncRequestMode }): Promise<ListResponse> {
    const basePrefix = buildBasePrefix(config.s3.profileId, config.s3.prefix);
    const transportMode = resolveS3TransportMode(config, options?.requestMode);
    if (transportMode === 'server') {
        return listObjectsThroughServer(`${basePrefix}/`);
    }
    if (transportMode === 'desktop') {
        return listObjectsThroughDesktop(config, `${basePrefix}/`);
    }

    const s3Config = getS3ConfigPayload(config);
    if (!s3Config) {
        throw new Error('Network object storage is not configured. Configure S3-compatible storage in Settings first.');
    }

    const client = createBrowserS3Client(config);
    const objects: ListResponse['objects'] = [];
    let continuationToken: string | undefined;

    try {
        do {
            const response = await client.send(new ListObjectsV2Command({
                Bucket: s3Config.bucket,
                Prefix: `${basePrefix}/`,
                ContinuationToken: continuationToken
            }));

            for (const object of response.Contents || []) {
                if (!object.Key || object.Size === undefined || !object.LastModified) continue;
                objects.push({
                    key: object.Key,
                    size: object.Size,
                    lastModified: object.LastModified.toISOString()
                });
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);
    } catch (error) {
        throw new Error(normalizeS3Error(error, transportMode));
    }

    return { prefix: basePrefix, count: objects.length, objects };
}

async function downloadFromSignedUrl(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Download failed with status ${res.status}`);
    }
    return res.blob();
}

async function downloadManifestOnly(
    config: SyncProviderConfig,
    manifestKey: string,
    transportMode = resolveS3TransportMode(config)
): Promise<SnapshotManifest> {
    const manifestBlob = await downloadObject(
        config,
        manifestKey,
        transportMode,
        buildBasePrefix(config.s3.profileId, config.s3.prefix)
    );
    const manifestText = await manifestBlob.text();
    const manifest = verifyManifestRoundtrip(JSON.parse(manifestText));
    if (!manifest) {
        throw new Error('Manifest validation failed');
    }
    return manifest;
}

export function findLatestManifestKey(listResponse: ListResponse): string | null {
    const manifests = listResponse.objects
        .filter((object) => object.key.endsWith('/manifest.json'))
        .sort((a, b) => Date.parse(b.lastModified) - Date.parse(a.lastModified));
    return manifests[0]?.key ?? null;
}

export async function downloadLatestSnapshot(config: SyncProviderConfig, manifestKey: string): Promise<{
    manifest: SnapshotManifest;
    imageUrls: Map<string, string>;
}> {
    const transportMode = resolveS3TransportMode(config);
    const manifest = await downloadManifestOnly(config, manifestKey, transportMode);

    if (manifest.images.length === 0 || transportMode === 'server') {
        return { manifest, imageUrls: new Map() };
    }

    const imageSignOps = manifest.images.map(img => ({
        method: 'GET' as const,
        key: img.objectKey
    }));

    const imageSignResponse = await signOperations(
        imageSignOps,
        buildBasePrefix(config.s3.profileId, config.s3.prefix),
        config
    );

    const imageUrls = new Map<string, string>();
    for (const u of imageSignResponse.urls) {
        imageUrls.set(u.key, u.url);
    }

    return { manifest, imageUrls };
}

export async function restoreFromSnapshot(options: {
    manifest: SnapshotManifest;
    imageBlobs?: Map<string, Blob>;
    mode?: RestoreSyncMode;
    context?: SyncResultContext;
    skippedImageFilenames?: ReadonlySet<string>;
    onProgress?: (result: SyncResult) => void;
}): Promise<SyncResult> {
    let result = emptySyncResult('restore');
    const mode = options.mode ?? 'full';
    const context: SyncResultContext = {
        ...options.context,
        operation: 'restore',
        mode,
        snapshotId: options.manifest.snapshotId,
        manifestCreatedAt: options.manifest.createdAt,
        startedAt: options.context?.startedAt ?? Date.now()
    };
    const plan = getRestorePlan(mode, options.manifest);
    const skippedImageFilenames = options.skippedImageFilenames ?? new Set<string>();

    try {
        result.phase = plan.restoreMetadata ? 'restore-metadata' : 'restore-images';
        result.totalImages = plan.totalImages;
        if (plan.restoreImages && skippedImageFilenames.size > 0) {
            result.skippedImages = skippedImageFilenames.size;
            result.completedImages = skippedImageFilenames.size;
            for (const filename of skippedImageFilenames) {
                result.imageStatuses[filename] = 'synced';
            }
        }
        result = applyResultContext(result, context);
        options.onProgress?.(result);

        if (plan.restoreMetadata) {
            if (options.manifest.appConfig) {
                const { saveConfig } = await import('@/lib/config');
                saveConfig(options.manifest.appConfig);
            }

            if (Array.isArray(options.manifest.promptHistory)) {
                savePromptHistoryEntries([...options.manifest.promptHistory].sort((a, b) => b.timestamp - a.timestamp));
            }

            if (Array.isArray(options.manifest.userPromptTemplates)) {
                const restored: PromptTemplateWithSource[] = options.manifest.userPromptTemplates.map((template) => ({
                    ...template,
                    source: 'user'
                }));
                saveUserPromptTemplates(restored);
            }

            if (Array.isArray(options.manifest.imageHistory) && !plan.restoreImages) {
                saveImageHistory(options.manifest.imageHistory);
            }
        }

        if (plan.restoreImages && options.imageBlobs) {
            const restoredImageFilenames = new Set<string>(skippedImageFilenames);
            result.totalImages = options.manifest.images.length;
            result.phase = 'restore-images';
            options.onProgress?.(applyResultContext({ ...result }, context));

            for (const img of options.manifest.images) {
                if (skippedImageFilenames.has(img.filename)) continue;

                const blob = options.imageBlobs.get(img.filename);
                if (!blob) {
                    result.failedImages++;
                    result.imageStatuses[img.filename] = 'error';
                    continue;
                }

                result.imageStatuses[img.filename] = 'restoring';
                try {
                    await db.images.put({
                        filename: img.filename,
                        blob,
                        syncStatus: 'synced',
                        lastModifiedLocal: Date.now()
                    });
                    restoredImageFilenames.add(img.filename);
                    result.imageStatuses[img.filename] = 'restored';
                    result.completedImages++;
                } catch {
                    result.imageStatuses[img.filename] = 'error';
                    result.failedImages++;
                }
                options.onProgress?.(applyResultContext({ ...result }, context));
            }

            if (restoredImageFilenames.size > 0) {
                if (plan.restoreMetadata) {
                    saveImageHistory(normalizeRestoredImageHistoryForIndexedDb(
                        options.manifest.imageHistory,
                        restoredImageFilenames
                    ));
                } else {
                    saveRestoredImageHistoryForIndexedDb(options.manifest, restoredImageFilenames, 'merge');
                }
            } else if (plan.restoreMetadata && result.failedImages === 0) {
                saveImageHistory([]);
            }
        }

        result.ok = result.failedImages === 0;
        return finishResult(applyResultContext(result, context));
    } catch (err: unknown) {
        return finishResult(applyResultContext(failedSyncResult('restore', err instanceof Error ? err.message : String(err)), context));
    }
}

export async function previewRestoreSnapshot(config: SyncProviderConfig, manifestKey: string, options?: {
    mode?: RestoreSyncMode;
    force?: boolean;
    since?: number;
    requestMode?: S3SyncRequestMode;
}): Promise<ImageSyncPreview> {
    const mode = options?.mode ?? 'full';
    const force = Boolean(options?.force);
    const transportMode = resolveS3TransportMode(config, options?.requestMode);
    const manifest = filterManifestImagesBySince(await downloadManifestOnly(config, manifestKey, transportMode), options?.since);
    const plan = getRestorePlan(mode, manifest);
    let skippedImages = 0;

    if (plan.restoreImages && !force) {
        for (const image of manifest.images) {
            if (await isLocalImageCurrent(image)) {
                skippedImages++;
            }
        }
    }

    return {
        operation: 'restore',
        totalImages: plan.totalImages,
        pendingImages: force ? plan.totalImages : plan.totalImages - skippedImages,
        skippedImages: force ? 0 : skippedImages,
        force,
        since: options?.since,
        manifestKey,
        snapshotId: manifest.snapshotId,
        manifestCreatedAt: manifest.createdAt
    };
}

export async function downloadAndRestoreSnapshot(config: SyncProviderConfig, manifestKey: string, options?: {
    mode?: RestoreSyncMode;
    force?: boolean;
    since?: number;
    requestMode?: S3SyncRequestMode;
    onProgress?: (result: SyncResult) => void;
}): Promise<SyncResult> {
    const mode = options?.mode ?? 'full';
    const transportMode = resolveS3TransportMode(config, options?.requestMode);
    const startedAt = Date.now();
    let context = getResultContext(config, { operation: 'restore', mode, manifestKey, startedAt });
    options?.onProgress?.(applyResultContext(emptySyncResult('download-manifest'), context));

    const manifest = filterManifestImagesBySince(await downloadManifestOnly(config, manifestKey, transportMode), options?.since);
    context = getResultContext(config, { operation: 'restore', mode, manifest, manifestKey, startedAt });
    const plan = getRestorePlan(mode, manifest);

    if (!plan.restoreImages) {
        return restoreFromSnapshot({ manifest, mode, context, onProgress: options?.onProgress });
    }

    const imageBlobs = new Map<string, Blob>();
    const skippedImageFilenames = new Set<string>();
    const imagesToDownload: ManifestImageEntry[] = [];
    const result = applyResultContext(emptySyncResult('download-images'), context);
    let firstImageError: string | undefined;
    result.totalImages = manifest.images.length;

    for (const img of manifest.images) {
        if (!options?.force && await isLocalImageCurrent(img)) {
            skippedImageFilenames.add(img.filename);
            result.skippedImages = skippedImageFilenames.size;
            result.completedImages++;
            result.imageStatuses[img.filename] = 'synced';
            continue;
        }
        imagesToDownload.push(img);
    }

    options?.onProgress?.({ ...result });

    for (const img of imagesToDownload) {
        result.imageStatuses[img.filename] = 'downloading';
        try {
            const blob = await downloadObject(
                config,
                img.objectKey,
                transportMode,
                buildBasePrefix(config.s3.profileId, config.s3.prefix)
            );
            const sha256 = await computeSHA256(blob);
            if (sha256 !== img.sha256) {
                firstImageError ??= `远端图片 ${img.filename} 校验失败。`;
                result.failedImages++;
                result.imageStatuses[img.filename] = 'error';
                continue;
            }
            imageBlobs.set(img.filename, blob);
            result.imageStatuses[img.filename] = 'restored';
            result.completedImages++;
        } catch (error) {
            firstImageError ??= normalizeS3Error(error, transportMode);
            result.failedImages++;
            result.imageStatuses[img.filename] = 'error';
        }
        options?.onProgress?.({ ...result });
    }

    if (result.failedImages > 0) {
        return finishResult(applyResultContext({
            ...result,
            ok: false,
            error: firstImageError ?? '部分图片下载失败。'
        }, context));
    }

    return restoreFromSnapshot({ manifest, imageBlobs, mode, context, skippedImageFilenames, onProgress: options?.onProgress });
}
