import { isTauriDesktop } from '@/lib/desktop-runtime';
import { convertFileSrc } from '@tauri-apps/api/core';
import { lookup } from 'mime-types';

export function getFetchableImageUrl(pathOrUrl: string, passwordHash?: string | null): string {
    try {
        const url = new URL(pathOrUrl, window.location.href);
        if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== window.location.origin) {
            if (isTauriDesktop()) {
                return '';
            }
            const params = new URLSearchParams({ url: url.href });
            if (passwordHash) params.set('passwordHash', passwordHash);
            return `/api/image-proxy?${params.toString()}`;
        }
    } catch {
        return pathOrUrl;
    }

    return pathOrUrl;
}

export function isBrowserAddressableImagePath(pathOrUrl: string): boolean {
    try {
        const url = new URL(pathOrUrl, window.location.href);
        return ['http:', 'https:', 'blob:', 'data:', 'asset:'].includes(url.protocol);
    } catch {
        return false;
    }
}

export function getFileMimeType(file: File): string {
    return file.type || (lookup(file.name) as string) || 'application/octet-stream';
}

export async function fileToUint8Array(file: File): Promise<Uint8Array> {
    return new Uint8Array(await file.arrayBuffer());
}

export function getDesktopDisplayImagePath(pathOrUrl: string): string {
    if (!isTauriDesktop() || isBrowserAddressableImagePath(pathOrUrl)) return pathOrUrl;
    return convertFileSrc(pathOrUrl);
}

export function getImageMimeTypeFromFilename(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'webp') return 'image/webp';
    if (extension === 'gif') return 'image/gif';
    return 'image/png';
}
