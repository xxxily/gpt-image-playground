'use client';

import * as React from 'react';

const DIALOG_HISTORY_KEY = '__gptImagePlaygroundDialog';

type DialogHistoryState = {
    id?: unknown;
};

type DialogHistoryRecord = {
    id: string;
    closeFromHistory: () => void;
};

const records: DialogHistoryRecord[] = [];

let listeningWindow: Window | null = null;
let suppressedPopstateCount = 0;

function getBrowserWindow(): Window | null {
    if (typeof window === 'undefined') return null;
    if (!window.history?.pushState || !window.history?.back) return null;
    return window;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getDialogHistoryStateId(state: unknown): string | null {
    if (!isRecord(state)) return null;

    const dialogState = state[DIALOG_HISTORY_KEY];
    if (!isRecord(dialogState)) return null;

    const id = (dialogState as DialogHistoryState).id;
    return typeof id === 'string' ? id : null;
}

function createDialogHistoryState(windowRef: Window, id: string): Record<string, unknown> {
    const currentState = windowRef.history.state;

    if (!isRecord(currentState)) {
        return {
            [DIALOG_HISTORY_KEY]: { id }
        };
    }

    return {
        ...currentState,
        [DIALOG_HISTORY_KEY]: { id }
    };
}

function pushDialogHistoryEntry(windowRef: Window, id: string): boolean {
    try {
        windowRef.history.pushState(createDialogHistoryState(windowRef, id), '', windowRef.location.href);
        return true;
    } catch (error) {
        console.warn('Failed to add dialog history entry.', error);
        return false;
    }
}

function isCurrentEntryFor(windowRef: Window, id: string): boolean {
    return getDialogHistoryStateId(windowRef.history.state) === id;
}

function hasActiveRecord(id: string): boolean {
    return records.some((record) => record.id === id);
}

function getTopRecord(): DialogHistoryRecord | null {
    return records.length > 0 ? records[records.length - 1] : null;
}

function suppressNextBackNavigation(windowRef: Window) {
    suppressedPopstateCount += 1;
    windowRef.history.back();
}

function isStaleDialogHistoryState(state: unknown): boolean {
    const id = getDialogHistoryStateId(state);
    return Boolean(id && !hasActiveRecord(id));
}

function skipStaleEntryIfNeeded(windowRef: Window, state: unknown): boolean {
    if (!isStaleDialogHistoryState(state)) return false;

    suppressNextBackNavigation(windowRef);
    return true;
}

function handlePopState(event: PopStateEvent) {
    const windowRef = getBrowserWindow();
    if (!windowRef) return;

    const currentState = windowRef.history.state ?? event.state;

    if (suppressedPopstateCount > 0) {
        suppressedPopstateCount -= 1;
        skipStaleEntryIfNeeded(windowRef, currentState);
        return;
    }

    const topRecord = getTopRecord();
    if (!topRecord) {
        skipStaleEntryIfNeeded(windowRef, currentState);
        return;
    }

    if (!pushDialogHistoryEntry(windowRef, topRecord.id)) return;

    topRecord.closeFromHistory();
}

function ensurePopstateListener(windowRef: Window) {
    if (listeningWindow === windowRef) return;

    if (listeningWindow) {
        listeningWindow.removeEventListener('popstate', handlePopState);
    }

    windowRef.addEventListener('popstate', handlePopState);
    listeningWindow = windowRef;
}

export function registerDialogHistoryEntry(id: string, closeFromHistory: () => void): () => void {
    const windowRef = getBrowserWindow();
    if (!windowRef) return () => {};

    ensurePopstateListener(windowRef);

    const record: DialogHistoryRecord = { id, closeFromHistory };
    records.push(record);

    const pushed = pushDialogHistoryEntry(windowRef, id);
    let registered = true;

    return () => {
        if (!registered) return;
        registered = false;

        const index = records.indexOf(record);
        if (index >= 0) records.splice(index, 1);

        if (!pushed || !isCurrentEntryFor(windowRef, id)) return;

        suppressNextBackNavigation(windowRef);
    };
}

export function useDialogHistoryEntry(open: boolean, closeFromHistory: () => void) {
    const id = React.useId();
    const closeFromHistoryRef = React.useRef(closeFromHistory);
    closeFromHistoryRef.current = closeFromHistory;

    React.useEffect(() => {
        if (!open) return;

        return registerDialogHistoryEntry(id, () => closeFromHistoryRef.current());
    }, [id, open]);
}

export function resetDialogHistoryForTests() {
    if (listeningWindow) {
        listeningWindow.removeEventListener('popstate', handlePopState);
    }

    records.splice(0, records.length);
    listeningWindow = null;
    suppressedPopstateCount = 0;
}
