/**
 * Snapshot manifest schema. Stored as JSON in S3 and used for roundtrip verification.
 */

import type { HistoryMetadata } from '@/types/history';
import type { VisionTextHistoryMetadata } from '@/types/history';
import type { AppConfig } from '@/lib/config';
import { normalizeVisionTextHistoryMetadata } from '@/lib/vision-text-history';

export const MANIFEST_VERSION = 1;
export const DEFAULT_MANIFEST_REVISION = 1;
export const DEFAULT_MANIFEST_DEVICE_ID = 'legacy-device';

export type ManifestTombstoneReason = 'local-delete';

export type ManifestTombstoneEntry = {
    filename: string;
    /** S3 object key for the deleted blob reference */
    objectKey: string;
    /** SHA-256 hex digest of the deleted blob reference */
    sha256: string;
    deletedAt: number;
    deviceId: string;
    reason: ManifestTombstoneReason;
};

export type ManifestImageEntry = {
    filename: string;
    /** SHA-256 hex digest of the raw blob bytes */
    sha256: string;
    /** S3 object key for the uploaded blob */
    objectKey: string;
    mimeType: string;
    size: number;
    role?: 'image-output' | 'vision-text-source' | 'shared-history-asset';
    referencedBy?: Array<{
        historyType: 'image' | 'vision-text';
        historyId: string;
    }>;
};

export type SnapshotManifest = {
    version: typeof MANIFEST_VERSION;
    snapshotId: string;
    createdAt: number;
    /** Monotonic logical revision for this sync namespace. Legacy manifests normalize to 1. */
    revision?: number;
    /** Browser/device that produced this manifest. Legacy manifests normalize to legacy-device. */
    deviceId?: string;
    /** Previous manifest snapshot id, when known. */
    parentSnapshotId?: string;
    /** Backup object key written before replacing the namespace-level manifest pointer. */
    previousManifestBackupKey?: string;
    /** Source metadata labels for human reference */
    sourceLabel?: string;
    /** Sanitized AppConfig with all API keys / secrets stripped */
    appConfig: Partial<AppConfig>;
    promptHistory: Array<{ prompt: string; timestamp: number }>;
    userPromptTemplates: Array<{ id: string; name: string; categoryId: string; prompt: string; description?: string }>;
    imageHistory: HistoryMetadata[];
    visionTextHistory?: VisionTextHistoryMetadata[];
    images: ManifestImageEntry[];
    /** Sync mode: 'full' includes image blobs, 'metadata' only config/history/templates */
    syncMode?: 'full' | 'metadata';
    /** Total images known locally at snapshot time (for metadata-only syncs that reference previously-uploaded images) */
    totalLocalImages?: number;
    /** Number of images skipped during upload because they already exist remotely */
    skippedImages?: number;
    /** Optional lower timestamp bound used when the snapshot only includes recent image blobs */
    imageScopeSince?: number;
    /** Intentional deletions compared with a previous full manifest. */
    tombstones?: ManifestTombstoneEntry[];
};

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
}

function validateTombstone(value: unknown): ManifestTombstoneEntry | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const entry = value as Record<string, unknown>;
    if (typeof entry.filename !== 'string' || !entry.filename) return null;
    if (typeof entry.objectKey !== 'string' || !entry.objectKey) return null;
    if (typeof entry.sha256 !== 'string' || !entry.sha256) return null;
    if (!isPositiveInteger(entry.deletedAt)) return null;
    if (typeof entry.deviceId !== 'string' || !entry.deviceId) return null;
    if (entry.reason !== 'local-delete') return null;

    return {
        filename: entry.filename,
        objectKey: entry.objectKey,
        sha256: entry.sha256,
        deletedAt: entry.deletedAt,
        deviceId: entry.deviceId,
        reason: entry.reason
    };
}

export function validateManifest(value: unknown): SnapshotManifest | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const m = value as Record<string, unknown>;
    if (m.version !== MANIFEST_VERSION) return null;
    if (typeof m.snapshotId !== 'string' || !m.snapshotId) return null;
    if (typeof m.createdAt !== 'number' || m.createdAt <= 0) return null;
    if (m.revision !== undefined && !isPositiveInteger(m.revision)) return null;
    if (m.deviceId !== undefined && (typeof m.deviceId !== 'string' || !m.deviceId)) return null;
    if (!isOptionalString(m.parentSnapshotId)) return null;
    if (!isOptionalString(m.previousManifestBackupKey)) return null;
    if (typeof m.appConfig !== 'object' || m.appConfig === null) return null;
    if (!Array.isArray(m.promptHistory)) return null;
    if (!Array.isArray(m.userPromptTemplates)) return null;
    if (!Array.isArray(m.imageHistory)) return null;
    if (!Array.isArray(m.images)) return null;
    for (const img of m.images) {
        if (typeof img !== 'object' || img === null) return null;
        const e = img as Record<string, unknown>;
        if (typeof e.filename !== 'string' || !e.filename) return null;
        if (typeof e.sha256 !== 'string' || !e.sha256) return null;
        if (typeof e.objectKey !== 'string' || !e.objectKey) return null;
        if (typeof e.mimeType !== 'string' || !e.mimeType) return null;
        if (typeof e.size !== 'number' || e.size < 0) return null;
        if (
            e.role !== undefined &&
            e.role !== 'image-output' &&
            e.role !== 'vision-text-source' &&
            e.role !== 'shared-history-asset'
        ) {
            return null;
        }
        if (e.referencedBy !== undefined) {
            if (!Array.isArray(e.referencedBy)) return null;
            for (const reference of e.referencedBy) {
                if (typeof reference !== 'object' || reference === null) return null;
                const ref = reference as Record<string, unknown>;
                if (ref.historyType !== 'image' && ref.historyType !== 'vision-text') return null;
                if (typeof ref.historyId !== 'string' || !ref.historyId) return null;
            }
        }
    }
    const visionTextHistory: VisionTextHistoryMetadata[] = [];
    if (m.visionTextHistory !== undefined) {
        if (!Array.isArray(m.visionTextHistory)) return null;
        for (const entry of m.visionTextHistory) {
            const normalized = normalizeVisionTextHistoryMetadata(entry);
            if (!normalized) return null;
            visionTextHistory.push(normalized);
        }
    }
    const tombstones: ManifestTombstoneEntry[] = [];
    if (m.tombstones !== undefined) {
        if (!Array.isArray(m.tombstones)) return null;
        for (const tombstone of m.tombstones) {
            const validated = validateTombstone(tombstone);
            if (!validated) return null;
            tombstones.push(validated);
        }
    }

    return {
        ...(value as SnapshotManifest),
        revision: m.revision ?? DEFAULT_MANIFEST_REVISION,
        deviceId: m.deviceId ?? DEFAULT_MANIFEST_DEVICE_ID,
        visionTextHistory,
        tombstones
    };
}
