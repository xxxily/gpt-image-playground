import type { HistoryMetadata } from '@/types/history';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const IMAGE_HISTORY_STORAGE_KEY = 'openaiImageHistory';
const PROMPT_HISTORY_STORAGE_KEY = 'gpt-image-playground-prompt-history';

function makeEntry(overrides: Partial<HistoryMetadata> = {}): HistoryMetadata {
    return {
        timestamp: 1,
        images: [{ filename: 'a.png' }],
        prompt: 'cat',
        durationMs: 100,
        quality: 'auto',
        background: 'transparent',
        moderation: 'auto',
        mode: 'generate',
        costDetails: null,
        ...overrides
    };
}

let storage: Record<string, string> = {};

function makeStorage(): Storage {
    return {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => { storage[key] = value; },
        removeItem: (key: string) => { delete storage[key]; },
        clear: () => { storage = {}; },
        get length() { return Object.keys(storage).length; },
        key: (index: number) => Object.keys(storage)[index] ?? null
    };
}

beforeEach(() => {
    storage = {};
    const s = makeStorage();
    (globalThis as Record<string, unknown>).window = { localStorage: s };
    (globalThis as Record<string, unknown>).localStorage = s;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).localStorage;
});

async function loadModule() {
    const mod = await import('./image-history');
    return {
        loadImageHistory: mod.loadImageHistory,
        saveImageHistory: mod.saveImageHistory,
        clearImageHistoryLocalStorage: mod.clearImageHistoryLocalStorage
    };
}

describe('loadImageHistory', () => {
    it('returns empty array when no stored data', async () => {
        const { loadImageHistory } = await loadModule();
        expect(loadImageHistory()).toEqual({ history: [], shouldPreserveStoredValue: false });
    });

    it('returns parsed array for valid JSON array', async () => {
        const valid = [makeEntry({ images: [{ filename: 'a.png', size: 153600 }] })];
        localStorage.setItem(IMAGE_HISTORY_STORAGE_KEY, JSON.stringify(valid));
        const { loadImageHistory } = await loadModule();
        expect(loadImageHistory()).toEqual({ history: valid, shouldPreserveStoredValue: false });
    });

    it('returns empty array for non-array JSON but preserves localStorage value', async () => {
        localStorage.setItem(IMAGE_HISTORY_STORAGE_KEY, JSON.stringify({ notAnArray: true }));
        const { loadImageHistory } = await loadModule();
        expect(loadImageHistory()).toEqual({ history: [], shouldPreserveStoredValue: true });
        expect(localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY)).toBe(JSON.stringify({ notAnArray: true }));
    });

    it('returns empty array for malformed JSON but preserves localStorage value', async () => {
        localStorage.setItem(IMAGE_HISTORY_STORAGE_KEY, 'not-valid-json{{{');
        const { loadImageHistory } = await loadModule();
        expect(loadImageHistory()).toEqual({ history: [], shouldPreserveStoredValue: true });
        expect(localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY)).toBe('not-valid-json{{{');
    });

    it('returns empty array for null JSON but preserves localStorage value', async () => {
        localStorage.setItem(IMAGE_HISTORY_STORAGE_KEY, 'null');
        const { loadImageHistory } = await loadModule();
        expect(loadImageHistory()).toEqual({ history: [], shouldPreserveStoredValue: true });
        expect(localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY)).toBe('null');
    });

    it('returns empty array for string JSON literal', async () => {
        localStorage.setItem(IMAGE_HISTORY_STORAGE_KEY, JSON.stringify('just a string'));
        const { loadImageHistory } = await loadModule();
        expect(loadImageHistory()).toEqual({ history: [], shouldPreserveStoredValue: true });
        expect(localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY)).toBe(JSON.stringify('just a string'));
    });

    it('filters invalid array entries and marks stored value for preservation', async () => {
        const valid = makeEntry({ timestamp: 2 });
        localStorage.setItem(
            IMAGE_HISTORY_STORAGE_KEY,
            JSON.stringify([
                valid,
                { timestamp: 0, images: [{ filename: 'bad.png' }] },
                { timestamp: 3, images: [] }
            ])
        );

        const { loadImageHistory } = await loadModule();
        expect(loadImageHistory()).toEqual({ history: [valid], shouldPreserveStoredValue: true });
    });
});

describe('saveImageHistory', () => {
    it('serializes history to localStorage', async () => {
        const valid = [makeEntry()];
        const { saveImageHistory } = await loadModule();
        expect(saveImageHistory(valid)).toBe(true);
        expect(localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY)).toBe(JSON.stringify(valid));
    });

    it('overwrites existing data', async () => {
        localStorage.setItem(IMAGE_HISTORY_STORAGE_KEY, JSON.stringify([{ old: true }]));
        const valid = [makeEntry()];
        const { saveImageHistory } = await loadModule();
        expect(saveImageHistory(valid)).toBe(true);
        expect(JSON.parse(localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY) as string)).toEqual(valid);
    });

    it('saves empty array as []', async () => {
        const { saveImageHistory } = await loadModule();
        expect(saveImageHistory([])).toBe(true);
        expect(localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY)).toBe('[]');
    });
});

describe('clearImageHistoryLocalStorage', () => {
    it('removes only the image history key', async () => {
        const valid = [makeEntry()];
        localStorage.setItem(IMAGE_HISTORY_STORAGE_KEY, JSON.stringify(valid));
        localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify([{ prompt: 'keep me', timestamp: 1 }]));
        localStorage.setItem('some-other-key', 'value');
        const { clearImageHistoryLocalStorage } = await loadModule();
        expect(clearImageHistoryLocalStorage()).toBe(true);
        expect(localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY)).toBeNull();
        expect(localStorage.getItem(PROMPT_HISTORY_STORAGE_KEY)).toBe(JSON.stringify([{ prompt: 'keep me', timestamp: 1 }]));
        expect(localStorage.getItem('some-other-key')).toBe('value');
    });

    it('does nothing when key is already absent', async () => {
        const { clearImageHistoryLocalStorage } = await loadModule();
        expect(clearImageHistoryLocalStorage()).toBe(true);
    });
});

describe('round-trip', () => {
    it('save then load returns same data', async () => {
        const valid = [makeEntry()];
        const { saveImageHistory, loadImageHistory } = await loadModule();
        expect(saveImageHistory(valid)).toBe(true);
        expect(loadImageHistory()).toEqual({ history: valid, shouldPreserveStoredValue: false });
    });

    it('save then clear then load returns empty', async () => {
        const valid = [makeEntry()];
        const { saveImageHistory, loadImageHistory, clearImageHistoryLocalStorage } = await loadModule();
        expect(saveImageHistory(valid)).toBe(true);
        expect(clearImageHistoryLocalStorage()).toBe(true);
        expect(loadImageHistory()).toEqual({ history: [], shouldPreserveStoredValue: false });
    });
});
