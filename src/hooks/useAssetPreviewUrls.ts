'use client';

import { getAssetLibraryFile } from '@/lib/asset-library';
import type { AssetLibraryItem } from '@/types/asset-library';
import * as React from 'react';

export function useAssetPreviewUrls(
    previewableAssets: readonly AssetLibraryItem[],
    previewAssetIndex: number | null
): Record<string, string> {
    const [previewUrls, setPreviewUrls] = React.useState<Record<string, string>>({});
    const previewUrlsRef = React.useRef<Record<string, string>>({});

    React.useEffect(() => {
        if (previewAssetIndex === null) return;

        let cancelled = false;

        const loadUrlForIndex = async (index: number) => {
            if (index < 0 || index >= previewableAssets.length) return;
            const asset = previewableAssets[index];
            if (previewUrlsRef.current[asset.id]) return;

            try {
                const file = await getAssetLibraryFile(asset);
                if (!file || cancelled) return;

                const objectUrl = URL.createObjectURL(file);
                if (cancelled) {
                    URL.revokeObjectURL(objectUrl);
                    return;
                }

                if (previewUrlsRef.current[asset.id]) {
                    URL.revokeObjectURL(objectUrl);
                    return;
                }

                const nextUrls = { ...previewUrlsRef.current, [asset.id]: objectUrl };
                previewUrlsRef.current = nextUrls;
                setPreviewUrls(nextUrls);
            } catch (error) {
                console.error('Failed to load preview URL', error);
            }
        };

        void loadUrlForIndex(previewAssetIndex);
        void loadUrlForIndex(previewAssetIndex - 1);
        void loadUrlForIndex(previewAssetIndex + 1);

        return () => {
            cancelled = true;
        };
    }, [previewAssetIndex, previewableAssets]);

    React.useEffect(() => {
        const activeIds = new Set(previewableAssets.map((asset) => asset.id));
        const nextUrls: Record<string, string> = {};
        let changed = false;

        for (const [assetId, url] of Object.entries(previewUrlsRef.current)) {
            if (activeIds.has(assetId)) {
                nextUrls[assetId] = url;
                continue;
            }

            URL.revokeObjectURL(url);
            changed = true;
        }

        if (changed) {
            previewUrlsRef.current = nextUrls;
            setPreviewUrls(nextUrls);
        }
    }, [previewableAssets]);

    React.useEffect(() => {
        return () => {
            for (const url of Object.values(previewUrlsRef.current)) {
                URL.revokeObjectURL(url);
            }
            previewUrlsRef.current = {};
        };
    }, []);

    return previewUrls;
}
