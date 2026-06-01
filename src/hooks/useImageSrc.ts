import * as React from 'react';

import { blobUrlStore } from '@/lib/blob-url-store';

interface UseImageSrcOptions {
    /**
     * When false, the hook subscribes for cache updates but does NOT trigger a load.
     * Used to defer IndexedDB reads until the consumer is visible (IntersectionObserver).
     */
    enabled?: boolean;
}

export type ImageSrcStatus = 'idle' | 'loading' | 'ready' | 'error';

export type ImageSrcState = {
    src?: string;
    status: ImageSrcStatus;
};

const READY_PREFIX = 'ready:';

function readImageSrcSnapshot(filename: string): string {
    if (!filename) return 'idle';
    const cached = blobUrlStore.getCached(filename);
    if (cached) return `${READY_PREFIX}${cached}`;
    if (blobUrlStore.hasFailed(filename)) return 'error';
    return 'loading';
}

/**
 * Subscribe to the blob URL for a single filename.
 *
 * - Returns `undefined` while the URL is loading or after a permanent failure.
 * - Only the component(s) using this filename re-render when its blob URL resolves —
 *   we avoid the previous "bump a global revision counter and re-render the whole grid"
 *   pattern by using a `useSyncExternalStore` per filename subscription.
 */
export function useImageSrcState(filename: string | null | undefined, options: UseImageSrcOptions = {}): ImageSrcState {
    const { enabled = true } = options;
    const effectiveFilename = filename || '';

    const subscribe = React.useCallback(
        (listener: () => void) => {
            if (!effectiveFilename) return () => {};
            return blobUrlStore.subscribe(effectiveFilename, listener);
        },
        [effectiveFilename]
    );

    const getSnapshot = React.useCallback(() => {
        return readImageSrcSnapshot(effectiveFilename);
    }, [effectiveFilename]);

    const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    React.useEffect(() => {
        if (!enabled || !effectiveFilename) return;
        if (blobUrlStore.getCached(effectiveFilename) || blobUrlStore.hasFailed(effectiveFilename)) return;
        blobUrlStore.request(effectiveFilename);
    }, [enabled, effectiveFilename]);

    return React.useMemo(() => {
        if (snapshot.startsWith(READY_PREFIX)) {
            return { src: snapshot.slice(READY_PREFIX.length), status: 'ready' };
        }
        return { status: snapshot as ImageSrcStatus };
    }, [snapshot]);
}

export function useImageSrc(filename: string | null | undefined, options: UseImageSrcOptions = {}): string | undefined {
    return useImageSrcState(filename, options).src;
}
