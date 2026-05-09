import type { AppConfig } from '@/lib/config';
import type { HistoryMetadata } from '@/types/history';
import type { PromptTemplate } from '@/types/prompt-template';
import type { ProviderInstance } from '@/lib/provider-instances';
import type { PromptHistoryEntry } from '@/lib/prompt-history';
import type { ManifestImageEntry, SnapshotManifest } from './manifest';
import { MANIFEST_VERSION, validateManifest } from './manifest';
import type { SyncResult } from './results';
import { emptySyncResult } from './results';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const API_KEY_FIELDS = new Set([
    'openaiApiKey', 'geminiApiKey', 'sensenovaApiKey', 'seedreamApiKey',
    'polishingApiKey'
]);

const DEVICE_LOCAL_FIELDS = new Set([
    'imageStoragePath',
    'desktopProxyMode',
    'desktopProxyUrl',
    'desktopDebugMode'
]);

export function sanitizeAppConfigForSync(config: AppConfig): Partial<AppConfig> {
    const copy: Partial<AppConfig> = { ...config };
    for (const key of API_KEY_FIELDS) {
        delete copy[key as keyof AppConfig];
    }
    for (const key of DEVICE_LOCAL_FIELDS) {
        delete copy[key as keyof AppConfig];
    }

    if (Array.isArray(config.providerInstances)) {
        copy.providerInstances = config.providerInstances.map((instance): ProviderInstance => ({
            ...instance,
            apiKey: ''
        }));
    }
    return copy;
}

export async function computeSHA256(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createSnapshotId(): string {
    return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export function buildManifest(
    snapshotId: string,
    basePrefix: string,
    appConfig: AppConfig,
    promptHistory: PromptHistoryEntry[],
    userPromptTemplates: PromptTemplate[],
    imageHistory: HistoryMetadata[],
    images: ManifestImageEntry[],
    sourceLabel?: string,
    syncMode?: 'full' | 'metadata'
): SnapshotManifest {
    return {
        version: MANIFEST_VERSION,
        snapshotId,
        createdAt: Date.now(),
        sourceLabel,
        syncMode,
        appConfig: sanitizeAppConfigForSync(appConfig),
        promptHistory: promptHistory.map(e => ({ prompt: e.prompt, timestamp: e.timestamp })),
        userPromptTemplates: userPromptTemplates.map(t => ({
            id: t.id, name: t.name, categoryId: t.categoryId, prompt: t.prompt, description: t.description
        })),
        imageHistory: imageHistory.map((history) => ({
            ...history,
            images: history.images.map((image) => ({ ...image }))
        })),
        images: images.map((image) => ({
            ...image,
            objectKey: `${basePrefix}/images/${image.filename}`
        }))
    };
}

export async function createSnapshot(
    options: {
        appConfig: AppConfig;
        promptHistory: PromptHistoryEntry[];
        userPromptTemplates: PromptTemplate[];
        imageHistory: HistoryMetadata[];
        imageBlobs: Map<string, Blob>;
        basePrefix: string;
        mode?: 'full' | 'metadata';
    }
): Promise<{ manifest: SnapshotManifest; result: SyncResult }> {
    const snapshotId = createSnapshotId();
    const mode = options.mode ?? 'full';
    const imageEntries: ManifestImageEntry[] = [];

    if (mode === 'full') {
        for (const [filename, blob] of options.imageBlobs) {
            const sha256 = await computeSHA256(blob);
            imageEntries.push({
                filename,
                sha256,
                objectKey: `${options.basePrefix}/images/${filename}`,
                mimeType: blob.type || 'application/octet-stream',
                size: blob.size
            });
        }
    }

    const manifest = buildManifest(
        snapshotId,
        options.basePrefix,
        options.appConfig,
        options.promptHistory,
        options.userPromptTemplates,
        options.imageHistory,
        imageEntries,
        undefined,
        mode
    );

    if (mode === 'metadata') {
        manifest.totalLocalImages = options.imageBlobs.size;
    }

    return { manifest, result: emptySyncResult('snapshot') };
}

export function verifyManifestRoundtrip(raw: unknown): SnapshotManifest | null {
    const manifest = validateManifest(raw);
    if (!manifest) return null;

    const seenFilenames = new Set<string>();
    for (const img of manifest.images) {
        if (seenFilenames.has(img.filename)) return null;
        seenFilenames.add(img.filename);
        if (!/^[a-zA-Z0-9._-]+\.([a-z]+)$/.test(img.filename)) return null;
        if (img.objectKey.startsWith('/') || img.objectKey.startsWith('\\')) return null;
        if (img.objectKey.includes('..') || img.objectKey.includes('\\') || img.objectKey.includes('\0')) return null;
        const legacyImageSuffix = `/images/${img.filename}`;
        const contentAddressedImageSuffix = `/images/${img.sha256}/${img.filename}`;
        if (!img.objectKey.endsWith(legacyImageSuffix) && !img.objectKey.endsWith(contentAddressedImageSuffix)) return null;
    }

    for (const key of API_KEY_FIELDS) {
        if (key in manifest.appConfig) return null;
    }

    if (Array.isArray(manifest.appConfig.providerInstances)) {
        for (const providerInstance of manifest.appConfig.providerInstances) {
            if (isRecord(providerInstance) && typeof providerInstance.apiKey === 'string' && providerInstance.apiKey.trim()) {
                return null;
            }
        }
    }

    return manifest;
}
