import { db, type VideoBlobRecord } from '@/lib/db';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import {
    type VideoHistoryMetadata,
    type VideoResultAssetKind,
    type VideoResultAssetRef,
    type VideoSourceAssetRef
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

function getExtensionFromMime(mimeType: string, kind: VideoResultAssetKind): string {
    if (kind === 'video' && mimeType.startsWith('video/')) return 'mp4';
    const major = mimeType.split('/')[0];
    if (kind === 'video') {
        if (major === 'image') {
            const sub = mimeType.split('/')[1];
            if (sub === 'jpeg' || sub === 'jpg') return 'jpg';
            if (sub === 'webp') return 'webp';
            return 'png';
        }
        return 'bin';
    }
    if (kind === 'thumbnail') {
        const sub = mimeType.split('/')[1];
        if (sub === 'jpeg' || sub === 'jpg') return 'jpg';
        if (sub === 'webp') return 'webp';
        return 'png';
    }
    if (kind === 'spritesheet') return 'webp';
    return 'bin';
}

async function computeSha256(blob: Blob): Promise<string> {
    try {
        if (typeof crypto === 'undefined' || !crypto.subtle) {
            console.warn('crypto.subtle not available, SHA-256 computation skipped.');
            return '';
        }
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    } catch (error) {
        console.warn('Failed to compute SHA-256:', error);
        return '';
    }
}

export async function persistVideoAsset(
    blob: Blob,
    kind: VideoResultAssetKind,
    options?: PersistVideoAssetOptions
): Promise<PersistVideoAssetResult> {
    const sha256 = await computeSha256(blob);

    const ext = getExtensionFromMime(blob.type || '', kind);
    const filename = options?.filename || `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    let storageModeUsed: 'fs' | 'indexeddb' = 'indexeddb';

    if (isTauriDesktop() && !options?.forceIndexedDb) {
        try {
            await invokeDesktopCommand('save_local_video', {
                filename,
                bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
                kind
            });
            storageModeUsed = 'fs';
        } catch (error) {
            console.warn('Failed to save video through Tauri, falling back to IndexedDB:', error);
        }
    }

    try {
        const record: VideoBlobRecord = {
            filename,
            blob,
            kind,
            mimeType: blob.type || 'application/octet-stream',
            size: blob.size,
            sha256,
            syncStatus: 'local_only',
            lastModifiedLocal: Date.now()
        };

        if (options?.durationSeconds !== undefined) record.durationSeconds = options.durationSeconds;
        if (options?.remoteUrlExpiresAt !== undefined) record.remoteUrlExpiresAt = options.remoteUrlExpiresAt;

        await db.videoBlobs.put(record);
    } catch (error) {
        console.warn('Failed to persist video asset to IndexedDB:', error);
    }

    return {
        filename,
        storageModeUsed,
        size: blob.size,
        sha256,
        mimeType: blob.type || 'application/octet-stream'
    };
}

export function resolveVideoAssetSrc(
    ref: VideoResultAssetRef | VideoSourceAssetRef,
    getCachedUrl?: (filename: string) => string | undefined
): string | undefined {
    if (ref.storageModeUsed === 'fs') {
        const refWithRemote = ref as VideoResultAssetRef;
        if (refWithRemote.remoteUrl && refWithRemote.remoteUrl.startsWith('https')) {
            return refWithRemote.remoteUrl;
        }
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
        console.warn('Failed to load video asset as blob:', ref.filename, error);
        return null;
    }
}

export function getVideoAssetReferenceCounts(
    videoHistory: readonly VideoHistoryMetadata[]
): Map<string, number> {
    const counts = new Map<string, number>();
    const add = (filename: string | undefined) => {
        if (!filename) return;
        counts.set(filename, (counts.get(filename) ?? 0) + 1);
    };

    for (const entry of videoHistory) {
        for (const asset of entry.sourceAssets) add(asset.filename);
        for (const asset of entry.resultAssets) add(asset.filename);
    }

    return counts;
}

export async function deleteUnreferencedVideoAssets(
    candidateFilenames: readonly string[],
    referenceCounts: Map<string, number>
): Promise<string[]> {
    const deleted: string[] = [];

    for (const filename of candidateFilenames) {
        if ((referenceCounts.get(filename) ?? 0) > 0) continue;
        try {
            await db.videoBlobs.delete(filename);
            deleted.push(filename);
        } catch (error) {
            console.warn('Failed to delete unreferenced video asset:', filename, error);
        }
    }

    return deleted;
}
