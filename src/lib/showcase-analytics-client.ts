'use client';

import {
    normalizeShowcaseAnalyticsEvent,
    type ShowcaseAnalyticsEvent,
    type ShowcaseAnalyticsRuntime
} from './showcase-analytics';
import { resolveShowcaseCatalogEndpoint } from './showcase-client';
import { isTauriDesktop } from './desktop-runtime';

const FLUSH_DELAY_MS = 750;
const MAX_QUEUE_SIZE = 25;
const MAX_PERSISTED_QUEUE_SIZE = 100;
const MAX_EVENT_AGE_MS = 7 * 86_400_000;
const QUEUE_STORAGE_KEY = 'gpt-image-playground-showcase-analytics-queue-v1';
const IMPRESSION_STORAGE_KEY = 'gpt-image-playground-showcase-impressions-v2';
const RETRY_DELAYS_MS = [1_000, 5_000, 30_000, 120_000, 300_000] as const;

export type QueuedShowcaseAnalyticsEvent = {
    event: ShowcaseAnalyticsEvent;
    attempts: number;
    nextAttemptAt: number;
    enqueuedAt: number;
};

export type ShowcaseAnalyticsQueueEnvelope = {
    version: 1;
    events: QueuedShowcaseAnalyticsEvent[];
};

let queue: QueuedShowcaseAnalyticsEvent[] = [];
let flushTimer: number | null = null;
let flushing = false;
let queueLoaded = false;
let lifecycleListenersInstalled = false;

function handlePageHide(): void {
    void flushShowcaseAnalyticsEvents({ beacon: true, force: true });
}

function handleVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        void flushShowcaseAnalyticsEvents({ beacon: true, force: true });
    }
}

export function getShowcaseAnalyticsRetryDelay(attempts: number): number {
    const index = Math.max(0, Math.min(RETRY_DELAYS_MS.length - 1, Math.floor(attempts)));
    return RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[0];
}

function isStorageLike(value: unknown): value is Storage {
    return Boolean(
        value &&
            typeof value === 'object' &&
            typeof (value as Storage).getItem === 'function' &&
            typeof (value as Storage).setItem === 'function'
    );
}

function getLocalStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return isStorageLike(window.localStorage) ? window.localStorage : null;
    } catch {
        return null;
    }
}

export function normalizeShowcaseAnalyticsQueueEnvelope(
    value: unknown,
    now = Date.now()
): ShowcaseAnalyticsQueueEnvelope {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { version: 1, events: [] };
    const record = value as Record<string, unknown>;
    if (record.version !== 1 || !Array.isArray(record.events)) return { version: 1, events: [] };

    const events: QueuedShowcaseAnalyticsEvent[] = [];
    for (const candidate of record.events) {
        if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue;
        const item = candidate as Record<string, unknown>;
        const normalizedEvent = normalizeShowcaseAnalyticsEvent(item.event);
        const attempts = item.attempts;
        const nextAttemptAt = item.nextAttemptAt;
        const enqueuedAt = item.enqueuedAt;
        if (
            !normalizedEvent ||
            typeof attempts !== 'number' ||
            !Number.isInteger(attempts) ||
            attempts < 0 ||
            attempts > 20 ||
            typeof nextAttemptAt !== 'number' ||
            !Number.isFinite(nextAttemptAt) ||
            typeof enqueuedAt !== 'number' ||
            !Number.isFinite(enqueuedAt) ||
            enqueuedAt < now - MAX_EVENT_AGE_MS
        ) {
            continue;
        }
        events.push({
            event: normalizedEvent,
            attempts,
            nextAttemptAt: Math.max(0, nextAttemptAt),
            enqueuedAt
        });
        if (events.length >= MAX_PERSISTED_QUEUE_SIZE) break;
    }
    return { version: 1, events };
}

function persistQueue(): void {
    const storage = getLocalStorage();
    if (!storage) return;
    const envelope: ShowcaseAnalyticsQueueEnvelope = {
        version: 1,
        events: queue.slice(-MAX_PERSISTED_QUEUE_SIZE)
    };
    try {
        storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(envelope));
    } catch {
        // A full or unavailable browser store must never affect creation.
        // Trim aggressively once so a transient quota error does not repeat.
        try {
            storage.setItem(
                QUEUE_STORAGE_KEY,
                JSON.stringify({ version: 1, events: envelope.events.slice(-Math.floor(MAX_PERSISTED_QUEUE_SIZE / 2)) })
            );
        } catch {
            // Ignore storage failures; the in-memory queue remains bounded.
        }
    }
}

function loadQueue(): void {
    if (queueLoaded) return;
    queueLoaded = true;
    const storage = getLocalStorage();
    if (!storage) return;
    try {
        const raw = storage.getItem(QUEUE_STORAGE_KEY);
        if (!raw) return;
        queue = normalizeShowcaseAnalyticsQueueEnvelope(JSON.parse(raw)).events;
    } catch {
        queue = [];
    }
}

function clearPersistedQueue(): void {
    const storage = getLocalStorage();
    try {
        storage?.removeItem(QUEUE_STORAGE_KEY);
    } catch {
        // Ignore storage failures.
    }
}

function impressionKey(event: ShowcaseAnalyticsEvent): string | null {
    if (event.event !== 'showcase_impression' || !event.catalogRevision) return null;
    return `${event.catalogRevision}:${event.topicId}`;
}

function shouldDropDuplicateImpression(event: ShowcaseAnalyticsEvent): boolean {
    const key = impressionKey(event);
    if (!key || typeof window === 'undefined') return false;
    try {
        const storage = window.sessionStorage;
        const raw = storage.getItem(IMPRESSION_STORAGE_KEY);
        const keys = raw ? (JSON.parse(raw) as unknown) : [];
        const seen = Array.isArray(keys) ? keys.filter((item): item is string => typeof item === 'string') : [];
        if (seen.includes(key)) return true;
        const next = [...seen.slice(-(MAX_PERSISTED_QUEUE_SIZE - 1)), key];
        storage.setItem(IMPRESSION_STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Session storage is an optimization only.
    }
    return false;
}

export function getShowcaseImpressionDeduplicationKeyForTests(event: ShowcaseAnalyticsEvent): string | null {
    return impressionKey(event);
}

function currentRuntime(): ShowcaseAnalyticsRuntime {
    return isTauriDesktop() ? 'tauri' : 'web';
}

function resolveEventsEndpoint(): string | null {
    const catalogEndpoint = resolveShowcaseCatalogEndpoint();
    if (!catalogEndpoint) return null;
    if (catalogEndpoint.startsWith('/')) return '/api/showcase-events';
    try {
        return new URL('/api/showcase-events', catalogEndpoint).toString();
    } catch {
        return null;
    }
}

function scheduleFlush(): void {
    if (flushTimer || typeof window === 'undefined') return;
    const now = Date.now();
    const delay = getShowcaseAnalyticsNextFlushDelay(queue, now);
    if (delay === null) return;
    flushTimer = window.setTimeout(() => {
        flushTimer = null;
        void flushShowcaseAnalyticsEvents();
    }, delay);
}

export function getShowcaseAnalyticsNextFlushDelay(
    events: readonly Pick<QueuedShowcaseAnalyticsEvent, 'nextAttemptAt'>[],
    now = Date.now()
): number | null {
    if (events.length === 0) return null;
    const earliest = events.reduce((value, item) => Math.min(value, item.nextAttemptAt), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(earliest)) return null;
    return earliest <= now ? FLUSH_DELAY_MS : Math.max(0, earliest - now);
}

function installLifecycleListeners(): void {
    if (lifecycleListenersInstalled || typeof window === 'undefined') return;
    lifecycleListenersInstalled = true;
    window.addEventListener('pagehide', handlePageHide);
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
}

function removeLifecycleListeners(): void {
    if (!lifecycleListenersInstalled || typeof window === 'undefined') return;
    window.removeEventListener('pagehide', handlePageHide);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibilityChange);
    lifecycleListenersInstalled = false;
}

function selectDueEvents(force: boolean): QueuedShowcaseAnalyticsEvent[] {
    const now = Date.now();
    return queue
        .filter((item) => force || item.nextAttemptAt <= now)
        .slice(0, MAX_QUEUE_SIZE);
}

function removeQueueItems(items: QueuedShowcaseAnalyticsEvent[]): void {
    if (items.length === 0) return;
    const selected = new Set(items);
    queue = queue.filter((item) => !selected.has(item));
    if (queue.length === 0) clearPersistedQueue();
    else persistQueue();
}

function markQueueItemsFailed(items: QueuedShowcaseAnalyticsEvent[]): void {
    const now = Date.now();
    const selected = new Set(items);
    queue = queue.map((item) => {
        if (!selected.has(item)) return item;
        const attempts = Math.min(20, item.attempts + 1);
        return {
            ...item,
            attempts,
            nextAttemptAt: now + getShowcaseAnalyticsRetryDelay(attempts - 1)
        };
    });
    persistQueue();
}

function sendBeacon(endpoint: string, events: QueuedShowcaseAnalyticsEvent[]): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function' || events.length === 0) {
        return false;
    }
    try {
        const body = new Blob([JSON.stringify({ events: events.map((item) => item.event) })], {
            type: 'application/json'
        });
        return navigator.sendBeacon(endpoint, body);
    } catch {
        return false;
    }
}

export function trackShowcaseAnalyticsEvent(
    event: Omit<ShowcaseAnalyticsEvent, 'runtime'> & { runtime?: ShowcaseAnalyticsRuntime }
): void {
    const normalized = normalizeShowcaseAnalyticsEvent({ ...event, runtime: event.runtime ?? currentRuntime() });
    if (!normalized || typeof window === 'undefined') return;
    loadQueue();
    installLifecycleListeners();
    if (shouldDropDuplicateImpression(normalized)) return;
    queue.push({ event: normalized, attempts: 0, nextAttemptAt: 0, enqueuedAt: Date.now() });
    if (queue.length > MAX_PERSISTED_QUEUE_SIZE) queue = queue.slice(-MAX_PERSISTED_QUEUE_SIZE);
    persistQueue();
    if (queue.length >= MAX_QUEUE_SIZE) void flushShowcaseAnalyticsEvents({ force: true });
    else scheduleFlush();
}

export async function flushShowcaseAnalyticsEvents(options: { beacon?: boolean; force?: boolean } = {}): Promise<void> {
    loadQueue();
    installLifecycleListeners();
    if (flushing || queue.length === 0) return;
    const endpoint = resolveEventsEndpoint();
    if (!endpoint) return;
    const events = selectDueEvents(options.force === true);
    if (events.length === 0) {
        scheduleFlush();
        return;
    }
    if (options.beacon && sendBeacon(endpoint, events)) {
        removeQueueItems(events);
        return;
    }
    flushing = true;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ events: events.map((item) => item.event) }),
            cache: 'no-store',
            keepalive: true
        });
        if (!response.ok) throw new Error(`Analytics request failed with ${response.status}.`);
        removeQueueItems(events);
    } catch {
        markQueueItemsFailed(events);
    } finally {
        flushing = false;
        if (queue.length > 0) scheduleFlush();
    }
}

/** Test-only reset hook; safe to call in a browser test between isolated cases. */
export function resetShowcaseAnalyticsClientForTests(): void {
    if (flushTimer !== null && typeof window !== 'undefined') window.clearTimeout(flushTimer);
    flushTimer = null;
    queue = [];
    queueLoaded = false;
    flushing = false;
    removeLifecycleListeners();
}

export function clearShowcaseAnalyticsImpressionMemoryForTests(): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(IMPRESSION_STORAGE_KEY);
    } catch {
        // Ignore storage failures.
    }
}

export function readShowcaseAnalyticsQueueForTests(): ShowcaseAnalyticsQueueEnvelope {
    loadQueue();
    return { version: 1, events: queue.map((item) => ({ ...item, event: { ...item.event } })) };
}
