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
    allowRemoteDeletion: boolean;
    requestMode: S3SyncRequestMode;
    prefix: string; // root prefix, e.g. 'gpt-image-playground/v1'
    profileId: string; // logical profile / user id for namespace isolation
};

export type SyncAutoSyncScopes = {
    appConfig: boolean;
    polishingPrompts: boolean;
    promptHistory: boolean;
    promptTemplates: boolean;
    imageHistory: boolean;
    imageBlobs: boolean;
};

export type SyncAutoSyncSettings = {
    enabled: boolean;
    scopes: SyncAutoSyncScopes;
    debounceMs: number;
};

export type SyncProviderConfig = {
    type: SyncProviderType;
    s3: S3SyncConfig;
    autoSync: SyncAutoSyncSettings;
    createdAt: number;
    updatedAt: number;
};

export type SharedSyncImageRestoreScope = 'none' | 'recent' | 'full';

export type SharedSyncRestoreOptions = {
    autoRestore: boolean;
    restoreMetadata: boolean;
    imageRestoreScope: SharedSyncImageRestoreScope;
    recentMs?: number;
};

export type SharedSyncConfig = {
    config: SyncProviderConfig;
    restoreOptions: SharedSyncRestoreOptions;
};

export const SYNC_CONFIG_STORAGE_KEY = 'gpt-image-playground-sync-config';
export const SYNC_CONFIG_CHANGED_EVENT = 'gpt-image-playground-sync-config-changed';
export const SYNC_CONFIG_SHARE_VERSION = 1;
export const DEFAULT_SHARED_SYNC_RESTORE_OPTIONS: SharedSyncRestoreOptions = {
    autoRestore: false,
    restoreMetadata: true,
    imageRestoreScope: 'none'
};

export const DEFAULT_SYNC_AUTO_SYNC_SCOPES: SyncAutoSyncScopes = {
    appConfig: true,
    polishingPrompts: true,
    promptHistory: true,
    promptTemplates: true,
    imageHistory: true,
    imageBlobs: true
};

export const DEFAULT_SYNC_AUTO_SYNC_SETTINGS: SyncAutoSyncSettings = {
    enabled: false,
    scopes: DEFAULT_SYNC_AUTO_SYNC_SCOPES,
    debounceMs: 3000
};

export const DEFAULT_SYNC_CONFIG: SyncProviderConfig = {
    type: 's3',
    s3: {
        endpoint: '',
        region: 'us-east-1',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: true,
        allowRemoteDeletion: false,
        requestMode: 'direct',
        prefix: DEFAULT_SYNC_ROOT_PREFIX,
        profileId: 'default'
    },
    autoSync: DEFAULT_SYNC_AUTO_SYNC_SETTINGS,
    createdAt: 0,
    updatedAt: 0
};

export type SharedSyncConfigPayload = {
    version: typeof SYNC_CONFIG_SHARE_VERSION;
    type: SyncProviderType;
    s3: S3SyncConfig;
    restoreOptions?: SharedSyncRestoreOptions;
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

function normalizeAutoSyncScopes(value: unknown): SyncAutoSyncScopes {
    const source = isRecord(value) ? value : {};
    return {
        appConfig: getBoolean(source.appConfig, DEFAULT_SYNC_AUTO_SYNC_SCOPES.appConfig),
        polishingPrompts: getBoolean(source.polishingPrompts, DEFAULT_SYNC_AUTO_SYNC_SCOPES.polishingPrompts),
        promptHistory: getBoolean(source.promptHistory, DEFAULT_SYNC_AUTO_SYNC_SCOPES.promptHistory),
        promptTemplates: getBoolean(source.promptTemplates, DEFAULT_SYNC_AUTO_SYNC_SCOPES.promptTemplates),
        imageHistory: getBoolean(source.imageHistory, DEFAULT_SYNC_AUTO_SYNC_SCOPES.imageHistory),
        imageBlobs: getBoolean(source.imageBlobs, DEFAULT_SYNC_AUTO_SYNC_SCOPES.imageBlobs)
    };
}

export function normalizeAutoSyncSettings(value: unknown): SyncAutoSyncSettings {
    const source = isRecord(value) ? value : {};
    const rawDebounceMs = typeof source.debounceMs === 'number' ? source.debounceMs : Number(source.debounceMs);
    return {
        enabled: getBoolean(source.enabled, DEFAULT_SYNC_AUTO_SYNC_SETTINGS.enabled),
        scopes: normalizeAutoSyncScopes(source.scopes),
        debounceMs: Number.isFinite(rawDebounceMs)
            ? Math.min(30000, Math.max(1000, Math.floor(rawDebounceMs)))
            : DEFAULT_SYNC_AUTO_SYNC_SETTINGS.debounceMs
    };
}

function normalizeSharedSyncImageRestoreScope(value: unknown): SharedSyncImageRestoreScope {
    return value === 'recent' || value === 'full' ? value : 'none';
}

function normalizeSharedSyncRestoreOptions(value: unknown): SharedSyncRestoreOptions {
    if (!isRecord(value)) return { ...DEFAULT_SHARED_SYNC_RESTORE_OPTIONS };

    const imageRestoreScope = normalizeSharedSyncImageRestoreScope(value.imageRestoreScope);
    const recentMs =
        typeof value.recentMs === 'number' && Number.isFinite(value.recentMs)
            ? Math.max(60 * 60 * 1000, Math.floor(value.recentMs))
            : undefined;

    return {
        autoRestore: getBoolean(value.autoRestore, DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.autoRestore),
        restoreMetadata: getBoolean(value.restoreMetadata, DEFAULT_SHARED_SYNC_RESTORE_OPTIONS.restoreMetadata),
        imageRestoreScope,
        ...(imageRestoreScope === 'recent' && { recentMs: recentMs ?? 7 * 24 * 60 * 60 * 1000 })
    };
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
            allowRemoteDeletion: getBoolean(rawS3.allowRemoteDeletion, DEFAULT_SYNC_CONFIG.s3.allowRemoteDeletion),
            requestMode: getRequestMode(rawS3.requestMode),
            prefix: normalizeSyncRootPrefix(getString(rawS3.prefix, DEFAULT_SYNC_CONFIG.s3.prefix)),
            profileId: sanitizeSyncProfileId(getString(rawS3.profileId, DEFAULT_SYNC_CONFIG.s3.profileId))
        },
        autoSync: normalizeAutoSyncSettings(value.autoSync),
        createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : now,
        updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : now
    };
}

export function isS3SyncConfigConfigured(config: S3SyncConfig | null | undefined): boolean {
    if (!config) return false;
    return Boolean(
        config.endpoint.trim() && config.bucket.trim() && config.accessKeyId.trim() && config.secretAccessKey.trim()
    );
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    if (typeof globalThis.btoa !== 'function') throw new Error('当前环境不支持分享云存储同步配置。');

    return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
    const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

    if (typeof globalThis.atob !== 'function') throw new Error('分享的云存储同步配置格式无效。');
    const binary = globalThis.atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function buildSyncConfigSharePayload(
    config: SyncProviderConfig,
    restoreOptions?: SharedSyncRestoreOptions
): SharedSyncConfigPayload {
    const normalized = normalizeSyncConfig(config);
    return {
        version: SYNC_CONFIG_SHARE_VERSION,
        type: 's3',
        s3: { ...normalized.s3 },
        restoreOptions: normalizeSharedSyncRestoreOptions(restoreOptions)
    };
}

export function normalizeSharedSyncConfig(value: unknown): SharedSyncConfig | null {
    if (!isRecord(value)) return null;

    const rawS3 = isRecord(value.s3) ? value.s3 : null;
    if (!rawS3) return null;
    if ('version' in value && value.version !== SYNC_CONFIG_SHARE_VERSION) return null;
    if ('type' in value && value.type !== 's3') return null;

    const normalized = normalizeSyncConfig({
        type: 's3',
        s3: rawS3,
        createdAt: Date.now(),
        updatedAt: Date.now()
    });

    return isS3SyncConfigConfigured(normalized.s3)
        ? {
              config: normalized,
              restoreOptions: normalizeSharedSyncRestoreOptions(value.restoreOptions)
          }
        : null;
}

export function encodeSyncConfigForShare(
    config: SyncProviderConfig,
    restoreOptions?: SharedSyncRestoreOptions
): string {
    const payload = buildSyncConfigSharePayload(config, restoreOptions);
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    return bytesToBase64Url(encoded);
}

export function decodeSyncConfigFromShare(value: string): SharedSyncConfig | null {
    try {
        const decoded = new TextDecoder().decode(base64UrlToBytes(value));
        return normalizeSharedSyncConfig(JSON.parse(decoded));
    } catch {
        return null;
    }
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
