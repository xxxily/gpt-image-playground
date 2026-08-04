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

let queue: ShowcaseAnalyticsEvent[] = [];
let flushTimer: number | null = null;
let flushing = false;

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
    flushTimer = window.setTimeout(() => {
        flushTimer = null;
        void flushShowcaseAnalyticsEvents();
    }, FLUSH_DELAY_MS);
}

export function trackShowcaseAnalyticsEvent(
    event: Omit<ShowcaseAnalyticsEvent, 'runtime'> & { runtime?: ShowcaseAnalyticsRuntime }
): void {
    const normalized = normalizeShowcaseAnalyticsEvent({ ...event, runtime: event.runtime ?? currentRuntime() });
    if (!normalized || typeof window === 'undefined') return;
    queue.push(normalized);
    if (queue.length >= MAX_QUEUE_SIZE) void flushShowcaseAnalyticsEvents();
    else scheduleFlush();
}

export async function flushShowcaseAnalyticsEvents(): Promise<void> {
    if (flushing || queue.length === 0) return;
    const endpoint = resolveEventsEndpoint();
    if (!endpoint) {
        queue = [];
        return;
    }
    flushing = true;
    const events = queue.splice(0, MAX_QUEUE_SIZE);
    try {
        await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ events }),
            cache: 'no-store',
            keepalive: true
        });
    } catch {
        // Analytics must never block or alter the creation flow.
    } finally {
        flushing = false;
        if (queue.length > 0) scheduleFlush();
    }
}
