import { db, type VideoBlobRecord } from '@/lib/db';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import type {
    VideoHistoryMetadata,
    VideoResultAssetKind,
    VideoResultAssetRef,
    VideoSourceAssetRef
} from '@/lib/video-types';

export type PersistVideoAssetOptions = {
    forceIndexedDb?: boolean;
    filename?: string;
    durationSeconds?: number;
    remoteUrlExpiresAt?: number;
};

export type PersistVideoAssetResult = {
    filename: string;
    storageModeUsed: 'fs' | 'indexeddb';
    size: number;
    sha256: string;
    mimeType: string;
};

type DesktopLocalVideoSaveResult = {
    path: string;
    filename: string;
};

function inferExtension(blob: Blob, kind: VideoResultAssetKind): string {
    const type = blob.type.toLowerCase();
    if (kind === 'video') {
        if (type.includes('mp4')) return 'mp4';
        if (type.includes('webm')) return 'webm';
        if (type.includes('quicktime') || type.includes('mov')) return 'mov';
        return 'mp4';
    }
    if (kind === 'thumbnail') {
        if (type.includes('webp')) return 'webp';
        if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
        return 'png';
    }
    if (kind === 'spritesheet') {
        return 'webp';
    }
    return 'bin';
}

function generateAssetFilename(kind: VideoResultAssetKind, blob: Blob): string {
    const ext = inferExtension(blob, kind);
    const random = Math.random().toString(36).slice(2, 8);
    return `video-${kind}-${Date.now()}-${random}.${ext}`;
}

async function computeSha256Hex(blob: Blob): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) return '';
    try {
        const buffer = await blob.arrayBuffer();
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hash))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    } catch (error) {
        console.warn('Failed to compute SHA-256 for video asset:', error);
        return '';
    }
}

async function trySaveVideoToTauri(
    blob: Blob,
    filename: string,
    kind: VideoResultAssetKind
): Promise<DesktopLocalVideoSaveResult | null> {
    if (!isTauriDesktop()) return null;
    try {
        const buffer = await blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const result = await invokeDesktopCommand<DesktopLocalVideoSaveResult>('save_local_video', {
            filename,
            kind,
            bytes
        });
        return result ?? null;
    } catch (error) {
        console.warn('Tauri save_local_video unavailable, falling back to IndexedDB:', error);
        return null;
    }
}

export async function persistVideoAsset(
    blob: Blob,
    kind: VideoResultAssetKind,
    options: PersistVideoAssetOptions = {}
): Promise<PersistVideoAssetResult> {
    const filename = options.filename ?? generateAssetFilename(kind, blob);
    const mimeType = blob.type || (kind === 'video' ? 'video/mp4' : 'application/octet-stream');
    const size = blob.size;
    const sha256 = await computeSha256Hex(blob);

    const desktopResult = options.forceIndexedDb ? null : await trySaveVideoToTauri(blob, filename, kind);

    if (desktopResult) {
        return {
            filename: desktopResult.filename || filename,
            storageModeUsed: 'fs',
            size,
            sha256,
            mimeType
        };
    }

    const record: VideoBlobRecord = {
        filename,
        blob,
        kind,
        mimeType,
        size,
        sha256,
        syncStatus: 'local_only',
        lastModifiedLocal: Date.now(),
        ...(options.durationSeconds !== undefined ? { durationSeconds: options.durationSeconds } : {}),
        ...(options.remoteUrlExpiresAt !== undefined ? { remoteUrlExpiresAt: options.remoteUrlExpiresAt } : {})
    };

    try {
        await db.videoBlobs.put(record);
    } catch (error) {
        console.warn('Failed to persist video asset to IndexedDB:', error);
    }

    return {
        filename,
        storageModeUsed: 'indexeddb',
        size,
        sha256,
        mimeType
    };
}

export function resolveVideoAssetSrc(
    ref: VideoResultAssetRef | VideoSourceAssetRef,
    getCachedUrl?: (filename: string) => string | undefined
): string | undefined {
    const remoteUrl = 'remoteUrl' in ref ? ref.remoteUrl : undefined;
    if (ref.storageModeUsed === 'fs' && remoteUrl && remoteUrl.startsWith('https://')) {
        return remoteUrl;
    }
    const cached = getCachedUrl?.(ref.filename);
    if (cached) return cached;
    return undefined;
}

export async function loadVideoAssetAsBlob(
    ref: VideoResultAssetRef | VideoSourceAssetRef
): Promise<Blob | null> {
    try {
        const record = await db.videoBlobs.get(ref.filename);
        return record?.blob ?? null;
    } catch (error) {
        console.warn('Failed to load video asset blob:', error);
        return null;
    }
}

export function getVideoAssetReferenceCounts(
    videoHistory: readonly VideoHistoryMetadata[]
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const entry of videoHistory) {
        for (const source of entry.sourceAssets ?? []) {
            counts.set(source.filename, (counts.get(source.filename) ?? 0) + 1);
        }
        for (const result of entry.resultAssets ?? []) {
            counts.set(result.filename, (counts.get(result.filename) ?? 0) + 1);
        }
    }
    return counts;
}

export async function deleteUnreferencedVideoAssets(
    candidateFilenames: readonly string[],
    referenceCounts: Map<string, number>
): Promise<string[]> {
    const deleted: string[] = [];
    for (const filename of candidateFilenames) {
        const count = referenceCounts.get(filename);
        if (count !== undefined && count > 0) continue;
        try {
            await db.videoBlobs.delete(filename);
            deleted.push(filename);
        } catch (error) {
            console.warn(`Failed to delete unreferenced video asset ${filename}:`, error);
        }
    }
    return deleted;
}
