import { db } from '@/lib/db';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import type { HistoryMetadata, VisionTextHistoryMetadata, VisionTextSourceImageRef } from '@/types/history';

export type PersistHistorySourceImagesOptions = {
    storageMode: 'fs' | 'indexeddb' | 'auto';
    desktopStoragePath?: string;
    passwordHash?: string;
    source?: VisionTextSourceImageRef['source'];
    timestamp?: number;
};

export type PersistHistorySourceImagesResult = {
    refs: VisionTextSourceImageRef[];
    failedCount: number;
};

type DesktopLocalImageSaveResult = {
    path: string;
    filename: string;
};

function bytesToNumberArray(bytes: Uint8Array): number[] {
    return Array.from(bytes);
}

function getMimeTypeFromFilename(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'webp') return 'image/webp';
    if (extension === 'gif') return 'image/gif';
    return 'image/png';
}

function getExtensionFromFile(file: File): string {
    const byName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (byName && byName.length <= 8) return byName === 'jpg' ? 'jpeg' : byName;
    if (file.type === 'image/jpeg') return 'jpeg';
    if (file.type === 'image/webp') return 'webp';
    if (file.type === 'image/gif') return 'gif';
    return 'png';
}

function resolveRequestedStorageMode(mode: PersistHistorySourceImagesOptions['storageMode']): 'fs' | 'indexeddb' {
    if (mode === 'fs' || mode === 'indexeddb') return mode;

    const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
    const isOnVercel = vercelEnv === 'production' || vercelEnv === 'preview';

    if (explicitMode === 'fs') return 'fs';
    if (explicitMode === 'indexeddb') return 'indexeddb';
    return isOnVercel ? 'indexeddb' : 'fs';
}

export async function computeBlobSha256(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function getImageDimensions(blob: Blob): Promise<{ width?: number; height?: number }> {
    if (typeof window === 'undefined') return {};

    if ('createImageBitmap' in window) {
        try {
            const bitmap = await createImageBitmap(blob);
            const dimensions = { width: bitmap.width, height: bitmap.height };
            bitmap.close();
            return dimensions;
        } catch {
            // Fall back to HTMLImageElement below.
        }
    }

    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const image = new window.Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({});
        };
        image.src = url;
    });
}

function createHistoryAssetFilename(file: File, timestamp: number, index: number, sha256: string): string {
    return `vision-source-${timestamp}-${index}-${sha256.slice(0, 10)}.${getExtensionFromFile(file)}`;
}

async function saveHistoryAssetToServer(
    file: File,
    filename: string,
    passwordHash?: string
): Promise<{ filename: string; path: string; size: number; mimeType: string }> {
    const formData = new FormData();
    formData.append('file', file, filename);
    formData.append('filename', filename);
    if (passwordHash) formData.append('passwordHash', passwordHash);

    const response = await fetch('/api/history-assets', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message || `History asset upload failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
        filename?: string;
        path?: string;
        size?: number;
        mimeType?: string;
    };
    if (!payload.filename || !payload.path) {
        throw new Error('History asset upload returned an invalid response.');
    }

    return {
        filename: payload.filename,
        path: payload.path,
        size: typeof payload.size === 'number' ? payload.size : file.size,
        mimeType: payload.mimeType || file.type || 'application/octet-stream'
    };
}

async function saveBlobToIndexedDb(filename: string, blob: Blob, sha256: string): Promise<void> {
    await db.images.put({
        filename,
        blob,
        sha256,
        size: blob.size,
        mimeType: blob.type || 'application/octet-stream',
        syncStatus: 'local_only',
        lastModifiedLocal: Date.now()
    });
}

async function persistOneSourceImage(
    file: File,
    index: number,
    options: PersistHistorySourceImagesOptions
): Promise<{ ref: VisionTextSourceImageRef; usedFallback: boolean }> {
    const timestamp = options.timestamp ?? Date.now();
    const blob: Blob = file;
    const sha256 = await computeBlobSha256(blob);
    const dimensions = await getImageDimensions(blob);
    const requestedStorageMode = resolveRequestedStorageMode(options.storageMode);
    const filename = createHistoryAssetFilename(file, timestamp, index, sha256);
    const baseRef = {
        mimeType: file.type || blob.type || 'application/octet-stream',
        size: blob.size,
        sha256,
        source: options.source ?? 'uploaded',
        syncStatus: 'local_only' as const,
        ...dimensions
    };

    if (requestedStorageMode === 'fs' && isTauriDesktop()) {
        try {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const saved = await invokeDesktopCommand<DesktopLocalImageSaveResult>('save_local_image', {
                filename,
                bytes: bytesToNumberArray(bytes),
                customStoragePath: options.desktopStoragePath?.trim() || undefined
            });
            return {
                ref: {
                    ...baseRef,
                    filename: saved.filename,
                    path: saved.path,
                    storageModeUsed: 'fs'
                },
                usedFallback: false
            };
        } catch (error) {
            console.warn('Failed to save vision source image through Tauri, falling back to IndexedDB:', error);
        }
    }

    if (requestedStorageMode === 'fs' && !isTauriDesktop()) {
        try {
            const saved = await saveHistoryAssetToServer(file, filename, options.passwordHash);
            return {
                ref: {
                    ...baseRef,
                    filename: saved.filename,
                    path: saved.path,
                    storageModeUsed: 'fs',
                    mimeType: saved.mimeType,
                    size: saved.size
                },
                usedFallback: false
            };
        } catch (error) {
            console.warn('Failed to save vision source image through Web history asset route, falling back to IndexedDB:', error);
        }
    }

    await saveBlobToIndexedDb(filename, blob, sha256);
    return {
        ref: {
            ...baseRef,
            filename,
            storageModeUsed: 'indexeddb'
        },
        usedFallback: requestedStorageMode !== 'indexeddb'
    };
}

export async function persistHistorySourceImages(
    files: readonly File[],
    options: PersistHistorySourceImagesOptions
): Promise<PersistHistorySourceImagesResult> {
    const refs: VisionTextSourceImageRef[] = [];
    let failedCount = 0;
    const timestamp = options.timestamp ?? Date.now();

    for (const [index, file] of files.entries()) {
        try {
            const { ref } = await persistOneSourceImage(file, index, { ...options, timestamp });
            refs.push(ref);
        } catch (error) {
            console.warn('Failed to persist vision source image:', error);
            failedCount += 1;
            refs.push({
                filename: `vision-source-${timestamp}-${index}-missing.${getExtensionFromFile(file)}`,
                storageModeUsed: resolveRequestedStorageMode(options.storageMode),
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                source: options.source ?? 'uploaded',
                syncStatus: 'conflict'
            });
        }
    }

    return { refs, failedCount };
}

export function resolveHistoryAssetSrc(
    ref: VisionTextSourceImageRef,
    getImageSrc?: (filename: string) => string | undefined
): string | undefined {
    const cached = getImageSrc?.(ref.filename);
    if (cached) return cached;

    if (ref.path) return ref.path;
    if (ref.storageModeUsed === 'indexeddb' || isTauriDesktop()) return getImageSrc?.(ref.filename);
    return `/api/image/${encodeURIComponent(ref.filename)}`;
}

export async function loadHistoryAssetAsFile(
    ref: VisionTextSourceImageRef,
    options: { desktopStoragePath?: string; passwordHash?: string | null } = {}
): Promise<File | null> {
    const record = await db.images.get(ref.filename);
    const mimeType = ref.mimeType || record?.mimeType || getMimeTypeFromFilename(ref.filename);
    if (record?.blob) {
        return new File([record.blob], ref.filename, { type: record.blob.type || mimeType });
    }

    if (isTauriDesktop()) {
        try {
            const bytes = await invokeDesktopCommand<number[]>('serve_local_image', {
                filename: ref.filename,
                customStoragePath: options.desktopStoragePath?.trim() || undefined
            });
            const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
            return new File([blob], ref.filename, { type: mimeType });
        } catch (error) {
            console.warn('Failed to load Tauri history asset as file:', error);
        }
    }

    const url = ref.path || `/api/image/${encodeURIComponent(ref.filename)}`;
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) return null;
        const blob = await response.blob();
        return new File([blob], ref.filename, { type: blob.type || mimeType });
    } catch (error) {
        console.warn('Failed to load history asset as file:', error);
        return null;
    }
}

export function getHistoryAssetReferenceCounts(
    imageHistory: readonly HistoryMetadata[],
    visionTextHistory: readonly VisionTextHistoryMetadata[]
): Map<string, number> {
    const counts = new Map<string, number>();
    const add = (filename: string | undefined) => {
        if (!filename) return;
        counts.set(filename, (counts.get(filename) ?? 0) + 1);
    };

    for (const entry of imageHistory) {
        for (const image of entry.images) add(image.filename);
    }
    for (const entry of visionTextHistory) {
        for (const image of entry.sourceImages) add(image.filename);
    }

    return counts;
}

export async function deleteUnreferencedHistoryAssets(
    refs: readonly VisionTextSourceImageRef[],
    referenceCounts: ReadonlyMap<string, number>,
    options: { desktopStoragePath?: string; passwordHash?: string | null } = {}
): Promise<string[]> {
    const deleted: string[] = [];
    const refsByFilename = new Map<string, VisionTextSourceImageRef>();
    for (const ref of refs) {
        if (ref.filename && !refsByFilename.has(ref.filename)) refsByFilename.set(ref.filename, ref);
    }
    const filenames = Array.from(refsByFilename.keys());

    for (const filename of filenames) {
        if ((referenceCounts.get(filename) ?? 0) > 0) continue;
        const ref = refsByFilename.get(filename);
        if (ref?.storageModeUsed === 'fs' && isTauriDesktop()) {
            await invokeDesktopCommand<Array<{ filename: string; success: boolean; error?: string }>>(
                'delete_local_images',
                {
                    filenames: [filename],
                    customStoragePath: options.desktopStoragePath?.trim() || undefined
                }
            ).catch(() => undefined);
        } else if (ref?.storageModeUsed === 'fs') {
            await fetch('/api/image-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filenames: [filename],
                    ...(options.passwordHash ? { passwordHash: options.passwordHash } : {})
                })
            }).catch(() => undefined);
        }
        await db.images.delete(filename).catch(() => undefined);
        deleted.push(filename);
    }

    return deleted;
}
