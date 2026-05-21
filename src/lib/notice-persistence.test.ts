import { describe, expect, it } from 'vitest';
import { NOTICE_PERSIST_STORAGE_KEY, readDismissedNoticeKeys, writeDismissedNoticeKeys } from './notice-persistence';

function createMemoryStorage(initial?: Record<string, string>): Storage {
    const store = new Map<string, string>(Object.entries(initial ?? {}));
    return {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (key) => (store.has(key) ? store.get(key)! : null),
        key: (index) => Array.from(store.keys())[index] ?? null,
        removeItem: (key) => {
            store.delete(key);
        },
        setItem: (key, value) => {
            store.set(key, String(value));
        }
    };
}

describe('notice-persistence', () => {
    it('returns empty set when storage is null', () => {
        expect(readDismissedNoticeKeys(null).size).toBe(0);
    });

    it('returns empty set when key is missing', () => {
        expect(readDismissedNoticeKeys(createMemoryStorage()).size).toBe(0);
    });

    it('parses persisted string array', () => {
        const storage = createMemoryStorage({
            [NOTICE_PERSIST_STORAGE_KEY]: JSON.stringify(['release-v3', 'tour-2026'])
        });
        const set = readDismissedNoticeKeys(storage);
        expect(set.has('release-v3')).toBe(true);
        expect(set.has('tour-2026')).toBe(true);
        expect(set.size).toBe(2);
    });

    it('drops non-string entries defensively', () => {
        const storage = createMemoryStorage({
            [NOTICE_PERSIST_STORAGE_KEY]: JSON.stringify(['ok', 42, null, { a: 1 }])
        });
        const set = readDismissedNoticeKeys(storage);
        expect(set.size).toBe(1);
        expect(set.has('ok')).toBe(true);
    });

    it('returns empty set on malformed JSON', () => {
        const storage = createMemoryStorage({ [NOTICE_PERSIST_STORAGE_KEY]: 'not-json' });
        expect(readDismissedNoticeKeys(storage).size).toBe(0);
    });

    it('writes set as JSON array', () => {
        const storage = createMemoryStorage();
        writeDismissedNoticeKeys(storage, new Set(['k1', 'k2']));
        expect(JSON.parse(storage.getItem(NOTICE_PERSIST_STORAGE_KEY)!)).toEqual(expect.arrayContaining(['k1', 'k2']));
    });

    it('tolerates throwing setItem (quota / private mode)', () => {
        const throwing: Storage = {
            get length() {
                return 0;
            },
            clear: () => undefined,
            getItem: () => null,
            key: () => null,
            removeItem: () => undefined,
            setItem: () => {
                throw new Error('QuotaExceeded');
            }
        };
        expect(() => writeDismissedNoticeKeys(throwing, new Set(['x']))).not.toThrow();
    });
});
