import { describe, expect, it, vi } from 'vitest';
import {
    STORAGE_REGISTRY,
    clearLocalStorageByRegistry,
    createLocalStorageBackup,
    getClearableLocalStorageKeys,
    getStorageRegistryEntries
} from './storage-registry';

function createStorage(initial: Record<string, string>) {
    const store = new Map(Object.entries(initial));
    return {
        get length() {
            return store.size;
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        }
    };
}

describe('storage registry', () => {
    it('documents sensitive browser storage separately from user content', () => {
        expect(STORAGE_REGISTRY).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'app-config', sensitivity: 'secret' }),
                expect.objectContaining({ id: 'sync-config', sensitivity: 'secret' }),
                expect.objectContaining({ id: 'client-password-hash', clearable: false }),
                expect.objectContaining({ id: 'image-blobs', medium: 'indexedDB' })
            ])
        );
    });

    it('returns clearable localStorage keys by data group', () => {
        expect(getClearableLocalStorageKeys(['config'])).toEqual(
            expect.arrayContaining(['gpt-image-playground-config', 'gpt-image-playground-config-backup-*'])
        );
        expect(getClearableLocalStorageKeys(['auth'])).not.toContain('clientPasswordHash');
        expect(getStorageRegistryEntries('history').every((entry) => entry.group === 'history')).toBe(true);
    });

    it('backs up and clears only registry-matched localStorage groups', () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(1234);
        const storage = createStorage({
            'gpt-image-playground-config': '{"schemaVersion":2}',
            'gpt-image-playground-config-backup-1': '{}',
            clientPasswordHash: 'keep',
            unrelated: 'keep'
        });

        const backup = createLocalStorageBackup(storage, ['config']);
        const cleared = clearLocalStorageByRegistry(storage, ['config']);

        expect(backup).toEqual({
            createdAt: 1234,
            entries: {
                'gpt-image-playground-config': '{"schemaVersion":2}',
                'gpt-image-playground-config-backup-1': '{}'
            }
        });
        expect(cleared).toEqual(['gpt-image-playground-config', 'gpt-image-playground-config-backup-1']);
        expect(storage.getItem('clientPasswordHash')).toBe('keep');
        expect(storage.getItem('unrelated')).toBe('keep');
        now.mockRestore();
    });
});
