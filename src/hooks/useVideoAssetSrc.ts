import * as React from 'react';

import { videoBlobUrlStore } from '@/lib/video-blob-url-store';
import { resolveVideoAssetSrc } from '@/lib/video-asset-store';
import type { VideoResultAssetRef, VideoSourceAssetRef } from '@/lib/video-types';

type VideoAssetRef = VideoResultAssetRef | VideoSourceAssetRef | null | undefined;

interface UseVideoAssetSrcOptions {
    enabled?: boolean;
}

export function useVideoAssetSrc(
    ref: VideoAssetRef,
    options: UseVideoAssetSrcOptions = {}
): string | undefined {
    const { enabled = true } = options;
    const filename = ref?.filename || '';

    const subscribe = React.useCallback(
        (listener: () => void) => {
            if (!filename) return () => {};
            return videoBlobUrlStore.subscribe(filename, listener);
        },
        [filename]
    );

    const getSnapshot = React.useCallback(() => {
        if (!filename) return undefined;
        return videoBlobUrlStore.getCached(filename);
    }, [filename]);

    const cachedUrl = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    React.useEffect(() => {
        if (!enabled || !filename) return;
        if (videoBlobUrlStore.getCached(filename) || videoBlobUrlStore.hasFailed(filename)) return;
        videoBlobUrlStore.request(filename);
    }, [enabled, filename]);

    if (!ref) return undefined;
    return resolveVideoAssetSrc(ref, () => cachedUrl) ?? ('remoteUrl' in ref ? ref.remoteUrl : undefined);
}
