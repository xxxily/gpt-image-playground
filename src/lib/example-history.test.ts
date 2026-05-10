import {
    EXAMPLE_HISTORY,
    EXAMPLE_HISTORY_HIDDEN_STORAGE_KEY,
    getVisibleExampleHistory,
    isExampleHistoryImage,
    isExampleHistoryItem,
    loadHiddenExampleHistoryIds,
    normalizeExampleHistoryMode,
    saveHiddenExampleHistoryIds,
    shouldShowExampleHistory
} from './example-history';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let storage: Record<string, string> = {};

function makeStorage(): Storage {
    return {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
            storage[key] = value;
        },
        removeItem: (key: string) => {
            delete storage[key];
        },
        clear: () => {
            storage = {};
        },
        get length() {
            return Object.keys(storage).length;
        },
        key: (index: number) => Object.keys(storage)[index] ?? null
    };
}

beforeEach(() => {
    storage = {};
    const localStorage = makeStorage();
    (globalThis as Record<string, unknown>).window = { localStorage };
});

afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
});

describe('normalizeExampleHistoryMode', () => {
    it('defaults to auto for unset and enabled-like values', () => {
        expect(normalizeExampleHistoryMode()).toBe('auto');
        expect(normalizeExampleHistoryMode('true')).toBe('auto');
        expect(normalizeExampleHistoryMode('1')).toBe('auto');
    });

    it('normalizes empty and off modes', () => {
        expect(normalizeExampleHistoryMode('empty')).toBe('empty');
        expect(normalizeExampleHistoryMode('always')).toBe('empty');
        expect(normalizeExampleHistoryMode('off')).toBe('off');
        expect(normalizeExampleHistoryMode('false')).toBe('off');
    });
});

describe('shouldShowExampleHistory', () => {
    it('shows auto examples while real history is empty and examples remain visible', () => {
        expect(shouldShowExampleHistory({ mode: 'auto', historyLength: 0, visibleExampleCount: 1 })).toBe(true);
        expect(shouldShowExampleHistory({ mode: 'auto', historyLength: 0, visibleExampleCount: 0 })).toBe(false);
        expect(shouldShowExampleHistory({ mode: 'auto', historyLength: 1, visibleExampleCount: 1 })).toBe(false);
    });

    it('supports empty and off modes', () => {
        expect(shouldShowExampleHistory({ mode: 'empty', historyLength: 0, visibleExampleCount: 1 })).toBe(true);
        expect(shouldShowExampleHistory({ mode: 'empty', historyLength: 1, visibleExampleCount: 1 })).toBe(false);
        expect(shouldShowExampleHistory({ mode: 'off', historyLength: 0, visibleExampleCount: 1 })).toBe(false);
    });
});

describe('hidden example history ids', () => {
    it('reads and writes the hidden examples local marker', () => {
        expect(loadHiddenExampleHistoryIds()).toEqual([]);

        expect(saveHiddenExampleHistoryIds([EXAMPLE_HISTORY[0].timestamp])).toBe(true);

        expect(loadHiddenExampleHistoryIds()).toEqual([EXAMPLE_HISTORY[0].timestamp]);
        expect(window.localStorage.getItem(EXAMPLE_HISTORY_HIDDEN_STORAGE_KEY)).toBe(
            JSON.stringify([EXAMPLE_HISTORY[0].timestamp])
        );
    });

    it('filters hidden examples without mutating built-in example data', () => {
        const visible = getVisibleExampleHistory([EXAMPLE_HISTORY[0].timestamp]);

        expect(visible).toHaveLength(EXAMPLE_HISTORY.length - 1);
        expect(visible.some((item) => item.timestamp === EXAMPLE_HISTORY[0].timestamp)).toBe(false);
    });
});

describe('EXAMPLE_HISTORY', () => {
    it('contains URL-backed example entries with separate thumbnails and previews', () => {
        expect(EXAMPLE_HISTORY.length).toBeGreaterThan(0);

        for (const entry of EXAMPLE_HISTORY) {
            expect(isExampleHistoryItem(entry)).toBe(true);
            expect(entry.storageModeUsed).toBe('url');

            for (const image of entry.images) {
                expect(isExampleHistoryImage(image)).toBe(true);
                expect(image.thumbnailPath).toContain('/examples/history/');
                expect(image.previewPath).toContain('/examples/history/');
                expect(image.thumbnailPath).not.toBe(image.previewPath);
            }
        }
    });
});
