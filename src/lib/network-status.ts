'use client';

import * as React from 'react';

export type NetworkStatus = {
    online: boolean;
    supported: boolean;
};

type ConnectivityProbeFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const CONNECTIVITY_PROBE_PATH = '/favicon.svg';
const CONNECTIVITY_PROBE_TIMEOUT_MS = 4000;
const OFFLINE_RECHECK_INTERVAL_MS = 15000;

export function readNavigatorNetworkStatus(nav: Pick<Navigator, 'onLine'> | undefined): NetworkStatus {
    if (!nav || typeof nav.onLine !== 'boolean') {
        return { online: true, supported: false };
    }

    return { online: nav.onLine, supported: true };
}

export function buildConnectivityProbeUrl(currentHref: string, nonce = Date.now()): string | null {
    try {
        const url = new URL(CONNECTIVITY_PROBE_PATH, currentHref);
        url.searchParams.set('__network_check', String(nonce));
        return url.toString();
    } catch {
        return null;
    }
}

export async function probeSameOriginConnectivity({
    currentHref,
    fetchImpl,
    signal,
    timeoutMs = CONNECTIVITY_PROBE_TIMEOUT_MS
}: {
    currentHref: string;
    fetchImpl?: ConnectivityProbeFetch;
    signal?: AbortSignal;
    timeoutMs?: number;
}): Promise<boolean> {
    const probeUrl = buildConnectivityProbeUrl(currentHref);
    const fetcher = fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
    if (!probeUrl || !fetcher || typeof AbortController === 'undefined') return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const abortProbe = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abortProbe, { once: true });

    try {
        const response = await fetcher(probeUrl, {
            cache: 'no-store',
            credentials: 'same-origin',
            method: 'GET',
            signal: controller.signal
        });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortProbe);
    }
}

export async function confirmNavigatorOfflineStatus({
    currentHref,
    fetchImpl,
    navigatorStatus,
    signal,
    timeoutMs = CONNECTIVITY_PROBE_TIMEOUT_MS
}: {
    currentHref: string;
    fetchImpl?: ConnectivityProbeFetch;
    navigatorStatus: NetworkStatus;
    signal?: AbortSignal;
    timeoutMs?: number;
}): Promise<NetworkStatus> {
    if (!navigatorStatus.supported || navigatorStatus.online) return navigatorStatus;

    const reachable = await probeSameOriginConnectivity({
        currentHref,
        fetchImpl,
        signal,
        timeoutMs
    });

    return reachable ? { online: true, supported: true } : navigatorStatus;
}

export function useNetworkStatus(): NetworkStatus {
    const [status, setStatus] = React.useState<NetworkStatus>({ online: true, supported: false });

    React.useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const commitStatus = (next: NetworkStatus) => {
            setStatus((current) =>
                current.online === next.online && current.supported === next.supported ? current : next
            );
        };

        const readCurrentStatus = () => readNavigatorNetworkStatus(navigator);
        const initialStatus = readCurrentStatus();
        if (!initialStatus.supported) {
            commitStatus(initialStatus);
            return undefined;
        }
        commitStatus(initialStatus.online ? initialStatus : { online: true, supported: true });

        let disposed = false;
        let probeController: AbortController | null = null;
        let latestProbeId = 0;

        const confirmOfflineStatus = async () => {
            const current = readCurrentStatus();
            if (current.online) {
                commitStatus(current);
                return;
            }
            if (typeof AbortController === 'undefined') {
                commitStatus(current);
                return;
            }

            const probeId = latestProbeId + 1;
            latestProbeId = probeId;
            probeController?.abort();
            probeController = new AbortController();

            const confirmedStatus = await confirmNavigatorOfflineStatus({
                currentHref: window.location.href,
                navigatorStatus: current,
                signal: probeController.signal,
                timeoutMs: CONNECTIVITY_PROBE_TIMEOUT_MS
            });
            if (disposed || latestProbeId !== probeId) return;

            commitStatus(confirmedStatus);
        };

        const handleOnline = () => {
            probeController?.abort();
            commitStatus({ online: true, supported: true });
        };
        const handleOffline = () => {
            void confirmOfflineStatus();
        };
        const handleRecoveryCheck = () => {
            void confirmOfflineStatus();
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') handleRecoveryCheck();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('focus', handleRecoveryCheck);
        window.addEventListener('pageshow', handleRecoveryCheck);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        if (!initialStatus.online) {
            void confirmOfflineStatus();
        }

        const intervalId = window.setInterval(() => {
            if (!readCurrentStatus().online) {
                void confirmOfflineStatus();
            }
        }, OFFLINE_RECHECK_INTERVAL_MS);

        return () => {
            disposed = true;
            probeController?.abort();
            window.clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('focus', handleRecoveryCheck);
            window.removeEventListener('pageshow', handleRecoveryCheck);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return status;
}
