import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    clearVideoHistoryLocalStorage,
    loadVideoHistory,
    mergeRestoredVideoHistory,
    saveVideoHistory
} from './video-history';
import { VIDEO_HISTORY_STORAGE_KEY, type VideoHistoryMetadata } from './video-types';

const store = new Map<string, string>();
const stubStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
        store.set(key, value);
    },
    removeItem: (key: string) => {
        store.delete(key);
    },
    clear: () => {
        store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
        return store.size;
    }
};

function makeJob(id: string, status: 'queued' | 'running' | 'succeeded' = 'queued', createdAt = 1) {
    return {
        id,
        status,
        createdAt,
        updatedAt: createdAt
    };
}

function makeEntry(id: string, timestamp: number, prompt = 'a video'): VideoHistoryMetadata {
    return {
        id,
        type: 'text-to-video',
        timestamp,
        prompt,
        providerEndpointId: 'endpoint-x',
        providerKind: 'openai',
        providerProtocol: 'openai-videos',
        rawModelId: 'sora-2',
        sourceAssets: [],
        resultAssets: [],
        job: makeJob(id, 'succeeded', timestamp),
        parameters: {}
    };
}

beforeEach(() => {
    store.clear();
    vi.stubGlobal('window', { localStorage: stubStorage });
    vi.stubGlobal('localStorage', stubStorage);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('loadVideoHistory', () => {
    it('returns empty when storage is empty', () => {
        const result = loadVideoHistory();
        expect(result.history).toEqual([]);
        expect(result.shouldPreserveStoredValue).toBe(false);
    });

    it('preserves stored value when raw data is not an array', () => {
        store.set(VIDEO_HISTORY_STORAGE_KEY, JSON.stringify({ unexpected: true }));
        const result = loadVideoHistory();
        expect(result.history).toEqual([]);
        expect(result.shouldPreserveStoredValue).toBe(true);
    });

    it('preserves stored value when JSON is corrupt', () => {
        store.set(VIDEO_HISTORY_STORAGE_KEY, '{{ this is not json');
        const result = loadVideoHistory();
        expect(result.history).toEqual([]);
        expect(result.shouldPreserveStoredValue).toBe(true);
    });

    it('drops invalid entries and flags preservation', () => {
        store.set(
            VIDEO_HISTORY_STORAGE_KEY,
            JSON.stringify([makeEntry('a', 2), { id: '' }, makeEntry('b', 1)])
        );
        const result = loadVideoHistory();
        expect(result.history.map((entry) => entry.id)).toEqual(['a', 'b']);
        expect(result.shouldPreserveStoredValue).toBe(true);
    });

    it('returns descending order by timestamp', () => {
        store.set(
            VIDEO_HISTORY_STORAGE_KEY,
            JSON.stringify([makeEntry('a', 100), makeEntry('b', 300), makeEntry('c', 200)])
        );
        const result = loadVideoHistory();
        expect(result.history.map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
        expect(result.shouldPreserveStoredValue).toBe(false);
    });
});

describe('saveVideoHistory', () => {
    it('round-trips entries through localStorage', () => {
        const ok = saveVideoHistory([makeEntry('a', 1), makeEntry('b', 2)]);
        expect(ok).toBe(true);
        const result = loadVideoHistory();
        expect(result.history.map((entry) => entry.id)).toEqual(['b', 'a']);
    });

    it('clamps to the limit', () => {
        const entries: VideoHistoryMetadata[] = [];
        for (let i = 1; i <= 60; i++) entries.push(makeEntry(`id-${i}`, i));
        saveVideoHistory(entries, 50);
        const result = loadVideoHistory();
        expect(result.history).toHaveLength(50);
        expect(result.history[0].id).toBe('id-60');
        expect(result.history.at(-1)?.id).toBe('id-11');
    });
});

describe('clearVideoHistoryLocalStorage', () => {
    it('removes the stored key', () => {
        store.set(VIDEO_HISTORY_STORAGE_KEY, JSON.stringify([makeEntry('a', 1)]));
        expect(clearVideoHistoryLocalStorage()).toBe(true);
        expect(store.has(VIDEO_HISTORY_STORAGE_KEY)).toBe(false);
    });
});

describe('mergeRestoredVideoHistory', () => {
    it('upserts entries by id', () => {
        const current = [makeEntry('a', 1, 'old prompt')];
        const restored = [makeEntry('a', 1, 'new prompt'), makeEntry('b', 2)];
        const merged = mergeRestoredVideoHistory(current, restored);
        const a = merged.find((entry) => entry.id === 'a');
        const b = merged.find((entry) => entry.id === 'b');
        expect(a?.prompt).toBe('new prompt');
        expect(b).toBeTruthy();
    });

    it('sorts merged result descending', () => {
        const merged = mergeRestoredVideoHistory(
            [makeEntry('a', 100)],
            [makeEntry('b', 300), makeEntry('c', 200)]
        );
        expect(merged.map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
    });
});
