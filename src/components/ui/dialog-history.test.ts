import {
    getDialogHistoryStateId,
    registerDialogHistoryEntry,
    resetDialogHistoryForTests
} from './dialog-history';
import { afterEach, describe, expect, it, vi } from 'vitest';

type PopStateListener = (event: PopStateEvent) => void;

class TestHistory {
    private entries: Array<{ state: unknown; url: string }> = [{ state: null, url: 'https://example.test/app' }];
    private index = 0;

    constructor(private readonly windowRef: TestWindow) {}

    get state(): unknown {
        return this.entries[this.index]?.state ?? null;
    }

    get length(): number {
        return this.entries.length;
    }

    pushState(state: unknown, _unused: string, url?: string | URL | null) {
        this.entries = this.entries.slice(0, this.index + 1);
        this.entries.push({ state, url: url?.toString() ?? this.windowRef.location.href });
        this.index = this.entries.length - 1;
    }

    back() {
        if (this.index <= 0) return;

        this.index -= 1;
        this.windowRef.dispatchPopState(this.state);
    }
}

class TestWindow {
    readonly location = { href: 'https://example.test/app' };
    readonly history = new TestHistory(this);
    private readonly popStateListeners = new Set<PopStateListener>();

    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type !== 'popstate') return;
        if (typeof listener === 'function') {
            this.popStateListeners.add(listener as PopStateListener);
        }
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type !== 'popstate') return;
        if (typeof listener === 'function') {
            this.popStateListeners.delete(listener as PopStateListener);
        }
    }

    dispatchPopState(state: unknown) {
        const event = { state } as PopStateEvent;
        for (const listener of Array.from(this.popStateListeners)) {
            listener(event);
        }
    }
}

function installTestWindow(): TestWindow {
    const testWindow = new TestWindow();
    vi.stubGlobal('window', testWindow);
    return testWindow;
}

afterEach(() => {
    resetDialogHistoryForTests();
    vi.unstubAllGlobals();
});

describe('dialog history entries', () => {
    it('pushes a guard entry while a dialog is open and removes it when closed by UI', () => {
        const testWindow = installTestWindow();

        const unregister = registerDialogHistoryEntry('dialog-a', () => {});

        expect(getDialogHistoryStateId(testWindow.history.state)).toBe('dialog-a');
        expect(testWindow.history.length).toBe(2);

        unregister();

        expect(getDialogHistoryStateId(testWindow.history.state)).toBeNull();
    });

    it('closes the top dialog when the user navigates back', () => {
        const testWindow = installTestWindow();
        const closed: string[] = [];
        let unregister = () => {};

        unregister = registerDialogHistoryEntry('dialog-a', () => {
            closed.push('dialog-a');
            unregister();
        });

        testWindow.history.back();

        expect(closed).toEqual(['dialog-a']);
        expect(getDialogHistoryStateId(testWindow.history.state)).toBeNull();
    });

    it('keeps the guard entry when close is intercepted by the dialog owner', () => {
        const testWindow = installTestWindow();
        let closeRequests = 0;

        const unregister = registerDialogHistoryEntry('settings-dialog', () => {
            closeRequests += 1;
        });

        testWindow.history.back();

        expect(closeRequests).toBe(1);
        expect(getDialogHistoryStateId(testWindow.history.state)).toBe('settings-dialog');

        unregister();
    });

    it('closes nested dialogs from top to bottom', () => {
        const testWindow = installTestWindow();
        const closed: string[] = [];
        let unregisterA = () => {};
        let unregisterB = () => {};

        unregisterA = registerDialogHistoryEntry('dialog-a', () => {
            closed.push('dialog-a');
            unregisterA();
        });
        unregisterB = registerDialogHistoryEntry('dialog-b', () => {
            closed.push('dialog-b');
            unregisterB();
        });

        testWindow.history.back();

        expect(closed).toEqual(['dialog-b']);
        expect(getDialogHistoryStateId(testWindow.history.state)).toBe('dialog-a');

        testWindow.history.back();

        expect(closed).toEqual(['dialog-b', 'dialog-a']);
        expect(getDialogHistoryStateId(testWindow.history.state)).toBeNull();
    });

    it('skips stale entries when a parent dialog closes before the top dialog', () => {
        const testWindow = installTestWindow();

        const unregisterA = registerDialogHistoryEntry('dialog-a', () => {});
        const unregisterB = registerDialogHistoryEntry('dialog-b', () => {});

        unregisterA();
        unregisterB();

        expect(getDialogHistoryStateId(testWindow.history.state)).toBeNull();
    });
});
