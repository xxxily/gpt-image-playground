'use client';

import { CONFIG_CHANGED_EVENT, loadConfig } from '@/lib/config';
import { desktopPublicRuntimeConfigFromAppConfig } from '@/lib/desktop-config';
import { isTauriDesktop } from '@/lib/desktop-runtime';
import {
    EMPTY_PUBLIC_RUNTIME_CONFIG,
    normalizePublicRuntimeConfig,
    type PublicRuntimeConfig
} from '@/lib/public-runtime-config';
import * as React from 'react';

type PublicRuntimeConfigContextValue = {
    config: PublicRuntimeConfig;
    loading: boolean;
};

const PublicRuntimeConfigContext = React.createContext<PublicRuntimeConfigContextValue>({
    config: EMPTY_PUBLIC_RUNTIME_CONFIG,
    loading: false
});

function resolvePublicRuntimeConfigEndpoint(): string | null {
    if (typeof window === 'undefined') return '/api/public-runtime-config';
    if (!isTauriDesktop()) return '/api/public-runtime-config';
    return desktopPublicRuntimeConfigFromAppConfig(loadConfig()).configUrl;
}

async function fetchPublicRuntimeConfig(endpoint: string, signal: AbortSignal): Promise<PublicRuntimeConfig> {
    const response = await fetch(endpoint, {
        signal,
        headers: {
            accept: 'application/json'
        },
        cache: 'no-store'
    });
    if (!response.ok) throw new Error('Public runtime config request failed.');
    return normalizePublicRuntimeConfig(await response.json().catch(() => null));
}

export function PublicRuntimeConfigProvider({ children }: { children: React.ReactNode }) {
    const [endpoint, setEndpoint] = React.useState<string | null>(() => resolvePublicRuntimeConfigEndpoint());
    const [config, setConfig] = React.useState<PublicRuntimeConfig>(EMPTY_PUBLIC_RUNTIME_CONFIG);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        const update = () => setEndpoint(resolvePublicRuntimeConfigEndpoint());
        update();
        window.addEventListener(CONFIG_CHANGED_EVENT, update);
        return () => window.removeEventListener(CONFIG_CHANGED_EVENT, update);
    }, []);

    React.useEffect(() => {
        if (!endpoint) {
            setConfig(EMPTY_PUBLIC_RUNTIME_CONFIG);
            setLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        let cancelled = false;
        let retryTimer: number | null = null;
        let retryDelayMs = 30_000;

        const load = async () => {
            setLoading(true);
            try {
                const nextConfig = await fetchPublicRuntimeConfig(endpoint, controller.signal);
                if (cancelled) return;
                setConfig(nextConfig);
                retryDelayMs = 30_000;
            } catch (error) {
                if (cancelled || controller.signal.aborted) return;
                console.warn('[public-runtime-config] failed to load config', error);
                setConfig(EMPTY_PUBLIC_RUNTIME_CONFIG);
                retryTimer = window.setTimeout(() => {
                    retryDelayMs = Math.min(retryDelayMs * 2, 5 * 60_000);
                    void load();
                }, retryDelayMs);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
            controller.abort();
            if (retryTimer !== null) window.clearTimeout(retryTimer);
        };
    }, [endpoint]);

    const value = React.useMemo(() => ({ config, loading }), [config, loading]);
    return <PublicRuntimeConfigContext.Provider value={value}>{children}</PublicRuntimeConfigContext.Provider>;
}

export function usePublicRuntimeConfig(): PublicRuntimeConfigContextValue {
    return React.useContext(PublicRuntimeConfigContext);
}
