'use client';

import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import type { ShowcaseCatalog } from '@/lib/showcase';
import { loadShowcaseCatalog, type ShowcaseCatalogLoadResult, type ShowcaseCatalogSource } from '@/lib/showcase-client';
import * as React from 'react';

export type UseShowcaseCatalogResult = ShowcaseCatalogLoadResult & {
    isLoading: boolean;
};

function createInitialState(catalog?: ShowcaseCatalog): UseShowcaseCatalogResult {
    return {
        catalog: catalog ?? DEFAULT_SHOWCASE_CATALOG,
        source: 'builtin',
        endpoint: null,
        stale: false,
        // Consumers can render the safe built-in catalog immediately while using
        // this flag to defer a remote-only deep-link not-found state.
        isLoading: catalog === undefined
    };
}

export function useShowcaseCatalog(
    catalogOverride?: ShowcaseCatalog,
    options: { enabled?: boolean } = {}
): UseShowcaseCatalogResult {
    const enabled = options.enabled ?? true;
    const [state, setState] = React.useState<UseShowcaseCatalogResult>(() => createInitialState(catalogOverride));

    React.useEffect(() => {
        if (catalogOverride) {
            setState(createInitialState(catalogOverride));
            return;
        }
        if (!enabled) {
            setState(createInitialState());
            return;
        }

        let active = true;
        const controller = new AbortController();

        void loadShowcaseCatalog({ signal: controller.signal }).then((result) => {
            if (!active) return;
            setState({ ...result, isLoading: false });
        });

        return () => {
            active = false;
            controller.abort();
        };
    }, [catalogOverride, enabled]);

    return state;
}

export function getShowcaseCatalogSourceMessageKey(source: ShowcaseCatalogSource, stale: boolean): string {
    if (source === 'cache') {
        return stale ? 'showcase.source.cacheStale' : 'showcase.source.cache';
    }
    return source === 'remote' ? 'showcase.source.remote' : 'showcase.source.builtin';
}
