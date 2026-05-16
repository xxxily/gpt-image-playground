import type { VisionTextHistoryMetadata } from '@/types/history';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VISION_TEXT_HISTORY_STORAGE_KEY = 'gpt-image-playground-vision-text-history';

function makeEntry(overrides: Partial<VisionTextHistoryMetadata> = {}): VisionTextHistoryMetadata {
    return {
        id: 'vision_text_1_a',
        type: 'image-to-text',
        timestamp: 1,
        durationMs: 1200,
        prompt: 'describe this',
        taskType: 'image_description',
        detail: 'auto',
        responseFormat: 'text',
        structuredOutputEnabled: false,
        maxOutputTokens: 4096,
        sourceImages: [
            {
                filename: 'vision-source-1-0-a.png',
                storageModeUsed: 'indexeddb',
                mimeType: 'image/png',
                size: 1024,
                source: 'uploaded',
                syncStatus: 'local_only'
            }
        ],
        resultText: 'A small product photo.',
        structuredResult: null,
        providerKind: 'openai',
        providerInstanceId: 'vision:openai:default',
        model: 'gpt-4.1-mini',
        apiCompatibility: 'responses',
        syncStatus: 'local_only',
        ...overrides
    };
}

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
    const mod = await import('./vision-text-history');
    return {
        loadVisionTextHistory: mod.loadVisionTextHistory,
        saveVisionTextHistory: mod.saveVisionTextHistory,
        clearVisionTextHistoryLocalStorage: mod.clearVisionTextHistoryLocalStorage,
        normalizeVisionTextHistoryMetadata: mod.normalizeVisionTextHistoryMetadata,
        mergeRestoredVisionTextHistory: mod.mergeRestoredVisionTextHistory
    };
}

describe('loadVisionTextHistory', () => {
    it('returns parsed history for valid JSON array', async () => {
        const valid = [makeEntry()];
        localStorage.setItem(VISION_TEXT_HISTORY_STORAGE_KEY, JSON.stringify(valid));
        const { loadVisionTextHistory } = await loadModule();
        expect(loadVisionTextHistory()).toEqual({ history: valid, shouldPreserveStoredValue: false });
    });

    it('preserves malformed localStorage values', async () => {
        localStorage.setItem(VISION_TEXT_HISTORY_STORAGE_KEY, 'not-json{{');
        const { loadVisionTextHistory } = await loadModule();
        expect(loadVisionTextHistory()).toEqual({ history: [], shouldPreserveStoredValue: true });
        expect(localStorage.getItem(VISION_TEXT_HISTORY_STORAGE_KEY)).toBe('not-json{{');
    });

    it('filters invalid array entries and keeps recoverable data', async () => {
        const valid = makeEntry({ id: 'vision_text_2_b', timestamp: 2 });
        localStorage.setItem(
            VISION_TEXT_HISTORY_STORAGE_KEY,
            JSON.stringify([valid, { id: 'bad', timestamp: 3, sourceImages: [] }, { notAnEntry: true }])
        );
        const { loadVisionTextHistory } = await loadModule();
        expect(loadVisionTextHistory()).toEqual({ history: [valid], shouldPreserveStoredValue: true });
    });
});

describe('saveVisionTextHistory', () => {
    it('sorts by timestamp desc and applies a minimum limit of 100', async () => {
        const entries = Array.from({ length: 110 }, (_, index) =>
            makeEntry({ id: `vision_text_${index}`, timestamp: index + 1 })
        );
        const { saveVisionTextHistory } = await loadModule();
        expect(saveVisionTextHistory(entries, 5)).toBe(true);

        const saved = JSON.parse(localStorage.getItem(VISION_TEXT_HISTORY_STORAGE_KEY) as string) as VisionTextHistoryMetadata[];
        expect(saved).toHaveLength(100);
        expect(saved[0]?.timestamp).toBe(110);
        expect(saved[99]?.timestamp).toBe(11);
    });
});

describe('normalizeVisionTextHistoryMetadata', () => {
    it('normalizes unknown optional fields to safe defaults', async () => {
        const { normalizeVisionTextHistoryMetadata } = await loadModule();
        const normalized = normalizeVisionTextHistoryMetadata({
            id: '',
            type: 'image-to-text',
            timestamp: 10,
            sourceImages: [{ filename: 'source.png', storageModeUsed: 'bad' }],
            resultText: 'result',
            taskType: 'bad',
            detail: 'bad',
            responseFormat: 'bad',
            providerKind: 'bad',
            apiCompatibility: 'bad'
        });

        expect(normalized).toMatchObject({
            id: 'vision_text_10',
            taskType: 'prompt_extraction',
            detail: 'auto',
            responseFormat: 'text',
            providerKind: 'openai',
            apiCompatibility: 'responses',
            sourceImages: [{ filename: 'source.png', storageModeUsed: 'indexeddb', source: 'uploaded' }]
        });
    });
});

describe('mergeRestoredVisionTextHistory', () => {
    it('merges by stable id and sorts by timestamp', async () => {
        const current = [makeEntry({ id: 'same', timestamp: 1, resultText: 'local' })];
        const restored = [
            makeEntry({ id: 'same', timestamp: 1, resultText: 'remote' }),
            makeEntry({ id: 'newer', timestamp: 3, resultText: 'newer' })
        ];
        const { mergeRestoredVisionTextHistory } = await loadModule();
        expect(mergeRestoredVisionTextHistory(current, restored).map((entry) => entry.resultText)).toEqual([
            'newer',
            'remote'
        ]);
    });
});
