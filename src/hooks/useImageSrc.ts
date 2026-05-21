import * as React from 'react';

import { blobUrlStore } from '@/lib/blob-url-store';

interface UseImageSrcOptions {
    /**
     * When false, the hook subscribes for cache updates but does NOT trigger a load.
     * Used to defer IndexedDB reads until the consumer is visible (IntersectionObserver).
     */
    enabled?: boolean;
}

/**
 * Subscribe to the blob URL for a single filename.
 *
 * - Returns `undefined` while the URL is loading or after a permanent failure.
 * - Only the component(s) using this filename re-render when its blob URL resolves —
 *   we avoid the previous "bump a global revision counter and re-render the whole grid"
 *   pattern by using a `useSyncExternalStore` per filename subscription.
 */
export function useImageSrc(filename: string | null | undefined, options: UseImageSrcOptions = {}): string | undefined {
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
        if (!effectiveFilename) return undefined;
        return blobUrlStore.getCached(effectiveFilename);
    }, [effectiveFilename]);

    const url = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    React.useEffect(() => {
        if (!enabled || !effectiveFilename) return;
        if (blobUrlStore.getCached(effectiveFilename) || blobUrlStore.hasFailed(effectiveFilename)) return;
        blobUrlStore.request(effectiveFilename);
    }, [enabled, effectiveFilename]);

    return url;
}
