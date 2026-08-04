import {
    clearShowcaseAnalyticsImpressionMemoryForTests,
    flushShowcaseAnalyticsEvents,
    getShowcaseImpressionDeduplicationKeyForTests,
    getShowcaseAnalyticsNextFlushDelay,
    getShowcaseAnalyticsRetryDelay,
    normalizeShowcaseAnalyticsQueueEnvelope,
    readShowcaseAnalyticsQueueForTests,
    resetShowcaseAnalyticsClientForTests,
    trackShowcaseAnalyticsEvent
} from './showcase-analytics-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const event = {
    event: 'showcase_open' as const,
    topicId: 'old-photo-restoration',
    entryPoint: 'directory' as const,
    runtime: 'web' as const
};

function createStorage(): Storage {
    const values = new Map<string, string>();
    return {
        get length() {
            return values.size;
        },
        clear: () => values.clear(),
        getItem: (key) => values.get(key) ?? null,
        key: (index) => [...values.keys()][index] ?? null,
        removeItem: (key) => values.delete(key),
        setItem: (key, value) => values.set(key, value)
    };
}

function installBrowserGlobals(sendBeacon = vi.fn(() => false)) {
    const localStorage = createStorage();
    const sessionStorage = createStorage();
    const windowListeners = { add: vi.fn(), remove: vi.fn() };
    const documentListeners = { add: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('window', {
        localStorage,
        sessionStorage,
        setTimeout,
        clearTimeout,
        addEventListener: windowListeners.add,
        removeEventListener: windowListeners.remove
    });
    vi.stubGlobal('document', {
        visibilityState: 'visible',
        addEventListener: documentListeners.add,
        removeEventListener: documentListeners.remove
    });
    vi.stubGlobal('navigator', { sendBeacon });
    vi.stubGlobal('localStorage', localStorage);
    return { localStorage, sessionStorage, sendBeacon, windowListeners, documentListeners };
}

afterEach(() => {
    resetShowcaseAnalyticsClientForTests();
    clearShowcaseAnalyticsImpressionMemoryForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('showcase analytics client queue helpers', () => {
    it('uses a bounded retry schedule', () => {
        expect(getShowcaseAnalyticsRetryDelay(0)).toBe(1_000);
        expect(getShowcaseAnalyticsRetryDelay(1)).toBe(5_000);
        expect(getShowcaseAnalyticsRetryDelay(4)).toBe(300_000);
        expect(getShowcaseAnalyticsRetryDelay(99)).toBe(300_000);
    });

    it('schedules due work once and sleeps until the earliest retry instead of polling every 750ms', () => {
        expect(getShowcaseAnalyticsNextFlushDelay([], 10_000)).toBeNull();
        expect(getShowcaseAnalyticsNextFlushDelay([{ nextAttemptAt: 0 }], 10_000)).toBe(750);
        expect(
            getShowcaseAnalyticsNextFlushDelay(
                [{ nextAttemptAt: 40_000 }, { nextAttemptAt: 15_000 }, { nextAttemptAt: 25_000 }],
                10_000
            )
        ).toBe(5_000);
    });

    it('requeues the first failed request with the one-second retry delay', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(10_000);
        installBrowserGlobals();
        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new Error('offline');
        }));

        trackShowcaseAnalyticsEvent(event);
        await flushShowcaseAnalyticsEvents({ force: true });

        expect(readShowcaseAnalyticsQueueForTests().events).toEqual([
            expect.objectContaining({ attempts: 1, nextAttemptAt: 11_000, enqueuedAt: 10_000 })
        ]);
    });

    it('falls back to keepalive fetch when Beacon declines the payload', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(20_000);
        const browser = installBrowserGlobals(vi.fn(() => false));
        const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetcher);

        trackShowcaseAnalyticsEvent(event);
        await flushShowcaseAnalyticsEvents({ beacon: true, force: true });

        expect(browser.sendBeacon).toHaveBeenCalledOnce();
        expect(fetcher).toHaveBeenCalledWith(
            '/api/showcase-events',
            expect.objectContaining({ method: 'POST', keepalive: true })
        );
        expect(readShowcaseAnalyticsQueueForTests().events).toEqual([]);
    });

    it('removes lifecycle listeners when the client is reset', () => {
        const browser = installBrowserGlobals();

        trackShowcaseAnalyticsEvent(event);
        resetShowcaseAnalyticsClientForTests();

        expect(browser.windowListeners.add).toHaveBeenCalledWith('pagehide', expect.any(Function));
        expect(browser.windowListeners.remove).toHaveBeenCalledWith('pagehide', expect.any(Function));
        expect(browser.documentListeners.add).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        expect(browser.documentListeners.remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('restores only recent normalized anonymous events', () => {
        const now = Date.UTC(2026, 7, 4);
        const queue = normalizeShowcaseAnalyticsQueueEnvelope(
            {
                version: 1,
                events: [
                    { event, attempts: 2, nextAttemptAt: now + 1_000, enqueuedAt: now - 1_000 },
                    {
                        event: { ...event, prompt: 'must never persist' },
                        attempts: 0,
                        nextAttemptAt: 0,
                        enqueuedAt: now
                    },
                    { event, attempts: 0, nextAttemptAt: 0, enqueuedAt: now - 8 * 86_400_000 }
                ]
            },
            now
        );

        expect(queue.events).toEqual([
            { event, attempts: 2, nextAttemptAt: now + 1_000, enqueuedAt: now - 1_000 }
        ]);
    });

    it('deduplicates impressions by catalog revision and topic rather than card position', () => {
        const base = {
            event: 'showcase_impression' as const,
            topicId: 'old-photo-restoration',
            catalogRevision: 'catalog-v2',
            runtime: 'web' as const
        };
        expect(getShowcaseImpressionDeduplicationKeyForTests({ ...base, position: 0 })).toBe(
            'catalog-v2:old-photo-restoration'
        );
        expect(getShowcaseImpressionDeduplicationKeyForTests({ ...base, position: 4 })).toBe(
            'catalog-v2:old-photo-restoration'
        );
    });
});
