/**
 * Snapshot manifest schema. Stored as JSON in S3 and used for roundtrip verification.
 */

import type { HistoryMetadata } from '@/types/history';
import type { AppConfig } from '@/lib/config';

export const MANIFEST_VERSION = 1;

export type ManifestImageEntry = {
    filename: string;
    /** SHA-256 hex digest of the raw blob bytes */
    sha256: string;
    /** S3 object key for the uploaded blob */
    objectKey: string;
    mimeType: string;
    size: number;
};

export type SnapshotManifest = {
    version: typeof MANIFEST_VERSION;
    snapshotId: string;
    createdAt: number;
    /** Source metadata labels for human reference */
    sourceLabel?: string;
    /** Sanitized AppConfig with all API keys / secrets stripped */
    appConfig: Partial<AppConfig>;
    promptHistory: Array<{ prompt: string; timestamp: number }>;
    userPromptTemplates: Array<{ id: string; name: string; categoryId: string; prompt: string; description?: string }>;
    imageHistory: HistoryMetadata[];
    images: ManifestImageEntry[];
    /** Sync mode: 'full' includes image blobs, 'metadata' only config/history/templates */
    syncMode?: 'full' | 'metadata';
    /** Total images known locally at snapshot time (for metadata-only syncs that reference previously-uploaded images) */
    totalLocalImages?: number;
    /** Number of images skipped during upload because they already exist remotely */
    skippedImages?: number;
    /** Optional lower timestamp bound used when the snapshot only includes recent image blobs */
    imageScopeSince?: number;
};

export function validateManifest(value: unknown): SnapshotManifest | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const m = value as Record<string, unknown>;
    if (m.version !== MANIFEST_VERSION) return null;
    if (typeof m.snapshotId !== 'string' || !m.snapshotId) return null;
    if (typeof m.createdAt !== 'number' || m.createdAt <= 0) return null;
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
    }
    return value as SnapshotManifest;
}
