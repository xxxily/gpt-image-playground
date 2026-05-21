import type { VideoHistoryMetadata } from '@/lib/video-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeEntry(overrides: Partial<VideoHistoryMetadata> = {}): VideoHistoryMetadata {
    return {
        id: 'vid_1_a',
        type: 'text-to-video',
        timestamp: 1,
        prompt: 'a sunny day',
        providerEndpointId: 'ep:openai:default',
        providerKind: 'openai',
        providerProtocol: 'openai-images',
        rawModelId: 'gpt-image-1',
        sourceAssets: [],
        resultAssets: [],
        job: {
            id: 'job_1',
            status: 'succeeded',
            createdAt: 1,
            updatedAt: 2
        },
        parameters: {},
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
    const mod = await import('./video-history');
    return {
        loadVideoHistory: mod.loadVideoHistory,
        saveVideoHistory: mod.saveVideoHistory,
        clearVideoHistoryLocalStorage: mod.clearVideoHistoryLocalStorage,
        mergeRestoredVideoHistory: mod.mergeRestoredVideoHistory
    };
}

describe('loadVideoHistory', () => {
    it('returns empty history when localStorage is empty', async () => {
        const { loadVideoHistory } = await loadModule();
        expect(loadVideoHistory()).toEqual({ history: [], shouldPreserveStoredValue: false });
    });

    it('preserves stored value when stored value is not an array', async () => {
        localStorage.setItem('gpt-image-playground-video-history', JSON.stringify({ notAnArray: true }));
        const { loadVideoHistory } = await loadModule();
        expect(loadVideoHistory()).toEqual({ history: [], shouldPreserveStoredValue: true });
    });

    it('returns parsed history for valid JSON array', async () => {
        const valid = [makeEntry()];
        localStorage.setItem('gpt-image-playground-video-history', JSON.stringify(valid));
        const { loadVideoHistory } = await loadModule();
        const result = loadVideoHistory();
        expect(result.history).toHaveLength(1);
        expect(result.history[0]?.id).toBe('vid_1_a');
        expect(result.shouldPreserveStoredValue).toBe(false);
    });

    it('filters invalid array entries and sets shouldPreserveStoredValue when entries dropped', async () => {
        const valid = makeEntry({ id: 'vid_2_b', timestamp: 2 });
        localStorage.setItem(
            'gpt-image-playground-video-history',
            JSON.stringify([valid, { id: 'bad', timestamp: 3 }, { notAnEntry: true }])
        );
        const { loadVideoHistory } = await loadModule();
        const result = loadVideoHistory();
        expect(result.history).toHaveLength(1);
        expect(result.history[0]?.id).toBe('vid_2_b');
        expect(result.shouldPreserveStoredValue).toBe(true);
    });

    it('sorts results by timestamp descending', async () => {
        const entries = [
            makeEntry({ id: 'v1', timestamp: 3 }),
            makeEntry({ id: 'v2', timestamp: 1 }),
            makeEntry({ id: 'v3', timestamp: 2 })
        ];
        localStorage.setItem('gpt-image-playground-video-history', JSON.stringify(entries));
        const { loadVideoHistory } = await loadModule();
        const result = loadVideoHistory();
        expect(result.history.map((e) => e.id)).toEqual(['v1', 'v3', 'v2']);
    });
});

describe('saveVideoHistory', () => {
    it('saves history to localStorage and returns true', async () => {
        const entries = [makeEntry({ id: 'vid_s1', timestamp: 1 })];
        const { saveVideoHistory } = await loadModule();
        expect(saveVideoHistory(entries)).toBe(true);

        const saved = JSON.parse(localStorage.getItem('gpt-image-playground-video-history') as string) as VideoHistoryMetadata[];
        expect(saved).toHaveLength(1);
        expect(saved[0]?.id).toBe('vid_s1');
    });

    it('sorts by timestamp desc and clamps limit to minimum of 50', async () => {
        const entries = Array.from({ length: 60 }, (_, i) =>
            makeEntry({ id: `vid_${i}`, timestamp: i + 1 })
        );
        const { saveVideoHistory } = await loadModule();
        expect(saveVideoHistory(entries, 5)).toBe(true);

        const saved = JSON.parse(localStorage.getItem('gpt-image-playground-video-history') as string) as VideoHistoryMetadata[];
        expect(saved).toHaveLength(50);
        expect(saved[0]?.timestamp).toBe(60);
        expect(saved[49]?.timestamp).toBe(11);
    });

    it('drops null-normalized entries', async () => {
        const badEntry: VideoHistoryMetadata = { id: '', timestamp: 1, prompt: '', providerEndpointId: '', providerKind: 'openai', providerProtocol: 'openai-images', rawModelId: 'x', sourceAssets: [], resultAssets: [], job: { id: '', status: 'queued', createdAt: 1, updatedAt: 1 }, parameters: {}, type: 'text-to-video' };
        localStorage.setItem('gpt-image-playground-video-history', JSON.stringify([badEntry]));
        const { loadVideoHistory, saveVideoHistory } = await loadModule();
        const { history } = loadVideoHistory();
        expect(history).toHaveLength(0);

        const valid = makeEntry({ id: 'vid_ok', timestamp: 100 });
        expect(saveVideoHistory([valid, badEntry])).toBe(true);
        const saved = JSON.parse(localStorage.getItem('gpt-image-playground-video-history') as string) as VideoHistoryMetadata[];
        expect(saved).toHaveLength(1);
        expect(saved[0]?.id).toBe('vid_ok');
    });
});

describe('clearVideoHistoryLocalStorage', () => {
    it('removes the key from localStorage', async () => {
        localStorage.setItem('gpt-image-playground-video-history', JSON.stringify([makeEntry()]));
        const { clearVideoHistoryLocalStorage } = await loadModule();
        expect(clearVideoHistoryLocalStorage()).toBe(true);
        expect(localStorage.getItem('gpt-image-playground-video-history')).toBeNull();
    });
});

describe('mergeRestoredVideoHistory', () => {
    it('merges by id with restored overriding current, and sorts descending', async () => {
        const current = [makeEntry({ id: 'same', timestamp: 1, prompt: 'local' })];
        const restored = [
            makeEntry({ id: 'same', timestamp: 1, prompt: 'remote' }),
            makeEntry({ id: 'newer', timestamp: 3, prompt: 'newer' })
        ];
        const { mergeRestoredVideoHistory } = await loadModule();
        const merged = mergeRestoredVideoHistory(current, restored);
        expect(merged.map((e) => e.prompt)).toEqual(['newer', 'remote']);
    });

    it('handles empty arrays', async () => {
        const { mergeRestoredVideoHistory } = await loadModule();
        expect(mergeRestoredVideoHistory([], [])).toEqual([]);
    });

    it('keeps current entries when no id overlap', async () => {
        const current = [makeEntry({ id: 'c1', timestamp: 5 })];
        const restored = [makeEntry({ id: 'r1', timestamp: 10 })];
        const { mergeRestoredVideoHistory } = await loadModule();
        const merged = mergeRestoredVideoHistory(current, restored);
        expect(merged.map((e) => e.id)).toEqual(['r1', 'c1']);
    });

    it('drops invalid entries during merge', async () => {
        const current = [makeEntry({ id: 'good', timestamp: 1 })];
        const restored = [{ id: '', timestamp: 2 } as unknown as VideoHistoryMetadata];
        const { mergeRestoredVideoHistory } = await loadModule();
        const merged = mergeRestoredVideoHistory(current, restored);
        expect(merged).toHaveLength(1);
        expect(merged[0]?.id).toBe('good');
    });
});
