import {
    buildConnectivityProbeUrl,
    confirmNavigatorOfflineStatus,
    probeSameOriginConnectivity,
    readNavigatorNetworkStatus
} from './network-status';
import { describe, expect, it } from 'vitest';

describe('network status helpers', () => {
    it('keeps server and unsupported navigator state optimistic', () => {
        expect(readNavigatorNetworkStatus(undefined)).toEqual({ online: true, supported: false });
        expect(readNavigatorNetworkStatus({ onLine: 'offline' } as unknown as Navigator)).toEqual({
            online: true,
            supported: false
        });
    });

    it('reads supported navigator online state exactly', () => {
        expect(readNavigatorNetworkStatus({ onLine: true } as Navigator)).toEqual({
            online: true,
            supported: true
        });
        expect(readNavigatorNetworkStatus({ onLine: false } as Navigator)).toEqual({
            online: false,
            supported: true
        });
    });

    it('builds a cache-busting same-origin probe URL', () => {
        const url = buildConnectivityProbeUrl('https://example.com/workbench?x=1', 123);
        expect(url).toBe('https://example.com/favicon.svg?__network_check=123');
    });

    it('treats a reachable same-origin probe as online', async () => {
        let requestInit: RequestInit | undefined;
        const result = await probeSameOriginConnectivity({
            currentHref: 'https://example.com/workbench',
            fetchImpl: async (_input, init) => {
                requestInit = init;
                return new Response('', { status: 200 });
            }
        });

        expect(result).toBe(true);
        expect(requestInit).toMatchObject({
            cache: 'no-store',
            credentials: 'same-origin',
            method: 'GET'
        });
    });

    it('keeps a failed same-origin probe offline', async () => {
        await expect(
            probeSameOriginConnectivity({
                currentHref: 'https://example.com/workbench',
                fetchImpl: async () => {
                    throw new TypeError('Failed to fetch');
                }
            })
        ).resolves.toBe(false);
    });

    it('does not confirm navigator offline while same-origin probe is reachable', async () => {
        await expect(
            confirmNavigatorOfflineStatus({
                currentHref: 'https://example.com/workbench',
                navigatorStatus: { online: false, supported: true },
                fetchImpl: async () => new Response('', { status: 200 })
            })
        ).resolves.toEqual({ online: true, supported: true });
    });

    it('confirms navigator offline only after the same-origin probe fails', async () => {
        await expect(
            confirmNavigatorOfflineStatus({
                currentHref: 'https://example.com/workbench',
                navigatorStatus: { online: false, supported: true },
                fetchImpl: async () => {
                    throw new TypeError('Failed to fetch');
                }
            })
        ).resolves.toEqual({ online: false, supported: true });
    });
});
