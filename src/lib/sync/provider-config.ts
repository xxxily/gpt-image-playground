/**
 * Sync provider configuration stored in localStorage under key `gpt-image-playground-sync-config`.
 *
 * This feature is designed for single-user / self-hosted usage: each browser profile owns its
 * own S3-compatible object storage credentials and uses them directly in the browser. The sync
 * snapshot itself still strips image API keys and does not include this sync provider configuration.
 */

import { DEFAULT_SYNC_ROOT_PREFIX, normalizeSyncRootPrefix, sanitizeSyncProfileId } from '@/lib/sync/key-validation';

export type SyncProviderType = 's3';
export type S3SyncRequestMode = 'direct' | 'server';

export type S3SyncConfig = {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    requestMode: S3SyncRequestMode;
    prefix: string;       // root prefix, e.g. 'gpt-image-playground/v1'
    profileId: string;    // logical profile / user id for namespace isolation
};

export type SyncProviderConfig = {
    type: SyncProviderType;
    s3: S3SyncConfig;
    createdAt: number;
    updatedAt: number;
};

export const SYNC_CONFIG_STORAGE_KEY = 'gpt-image-playground-sync-config';
export const SYNC_CONFIG_CHANGED_EVENT = 'gpt-image-playground-sync-config-changed';

export const DEFAULT_SYNC_CONFIG: SyncProviderConfig = {
    type: 's3',
    s3: {
        endpoint: '',
        region: 'us-east-1',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: true,
        requestMode: 'direct',
        prefix: DEFAULT_SYNC_ROOT_PREFIX,
        profileId: 'default'
    },
    createdAt: 0,
    updatedAt: 0
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value.trim() : fallback;
}

function getBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true' || value === '1';
    return fallback;
}

function getRequestMode(value: unknown): S3SyncRequestMode {
    return value === 'server' ? 'server' : 'direct';
}

function notifySyncConfigChanged(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(SYNC_CONFIG_CHANGED_EVENT));
}

export function normalizeSyncConfig(value: unknown): SyncProviderConfig {
    if (!isRecord(value)) return { ...DEFAULT_SYNC_CONFIG, createdAt: Date.now(), updatedAt: Date.now() };

    const rawS3 = isRecord(value.s3) ? value.s3 : {};
    const now = Date.now();

    return {
        type: 's3',
        s3: {
            endpoint: getString(rawS3.endpoint),
            region: getString(rawS3.region, DEFAULT_SYNC_CONFIG.s3.region),
            bucket: getString(rawS3.bucket),
            accessKeyId: getString(rawS3.accessKeyId),
            secretAccessKey: getString(rawS3.secretAccessKey),
            forcePathStyle: getBoolean(rawS3.forcePathStyle, DEFAULT_SYNC_CONFIG.s3.forcePathStyle),
            requestMode: getRequestMode(rawS3.requestMode),
            prefix: normalizeSyncRootPrefix(getString(rawS3.prefix, DEFAULT_SYNC_CONFIG.s3.prefix)),
            profileId: sanitizeSyncProfileId(getString(rawS3.profileId, DEFAULT_SYNC_CONFIG.s3.profileId))
        },
        createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : now,
        updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : now
    };
}

export function isS3SyncConfigConfigured(config: S3SyncConfig | null | undefined): boolean {
    if (!config) return false;
    return Boolean(
        config.endpoint.trim() &&
        config.bucket.trim() &&
        config.accessKeyId.trim() &&
        config.secretAccessKey.trim()
    );
}

export function loadSyncConfig(): SyncProviderConfig | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
        if (!raw) return null;
        return normalizeSyncConfig(JSON.parse(raw));
    } catch (error) {
        console.warn('Failed to load sync config from localStorage:', error);
        return null;
    }
}

export function saveSyncConfig(config: SyncProviderConfig): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(normalizeSyncConfig(config)));
        notifySyncConfigChanged();
    } catch (error) {
        console.warn('Failed to save sync config to localStorage:', error);
    }
}

export function clearSyncConfig(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(SYNC_CONFIG_STORAGE_KEY);
        notifySyncConfigChanged();
    } catch (error) {
        console.warn('Failed to clear sync config from localStorage:', error);
    }
}
