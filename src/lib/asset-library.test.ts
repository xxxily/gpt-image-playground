import { updateAssetLibraryItems } from './asset-library';
import type { AssetLibraryItem } from '@/types/asset-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const assetLibraryItemsTable = vi.hoisted(() => {
    type AssetItemsTableStub = {
        records: Map<string, AssetLibraryItem>;
        bulkGet: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };

    const table: AssetItemsTableStub = {
        records: new Map<string, AssetLibraryItem>(),
        bulkGet: vi.fn(async (ids: string[]) => ids.map((id) => table.records.get(id))),
        update: vi.fn(async (id: string, updates: Partial<AssetLibraryItem>) => {
            const current = table.records.get(id);
            if (!current) return 0;
            table.records.set(id, { ...current, ...updates });
            return 1;
        })
    };

    return table;
});

const transactionMock = vi.hoisted(() =>
    vi.fn(async (_mode: string, _table: unknown, callback: () => Promise<void>) => callback())
);

vi.mock('@/lib/db', () => ({
    db: {
        assetLibraryItems: assetLibraryItemsTable,
        transaction: transactionMock
    }
}));

function makeAsset(overrides: Partial<AssetLibraryItem> = {}): AssetLibraryItem {
    return {
        id: 'asset_1',
        displayName: 'Asset 1',
        originalFilename: 'asset-1.png',
        kind: 'image',
        mimeType: 'image/png',
        size: 10,
        categoryId: 'uncategorized',
        tags: [],
        favorite: false,
        source: 'file-picker',
        blobKey: 'blob_1',
        syncStatus: 'local_only',
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides
    };
}

beforeEach(() => {
    assetLibraryItemsTable.records.clear();
    assetLibraryItemsTable.bulkGet.mockClear();
    assetLibraryItemsTable.update.mockClear();
    transactionMock.mockClear();
    transactionMock.mockImplementation(async (_mode: string, _table: unknown, callback: () => Promise<void>) =>
        callback()
    );
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal(
        'CustomEvent',
        class {
            type: string;

            constructor(type: string) {
                this.type = type;
            }
        }
    );
});

describe('updateAssetLibraryItems', () => {
    it('updates all requested assets inside one transaction and dispatches one change event', async () => {
        assetLibraryItemsTable.records.set('a', makeAsset({ id: 'a' }));
        assetLibraryItemsTable.records.set('b', makeAsset({ id: 'b' }));

        const result = await updateAssetLibraryItems(['a', 'b'], { categoryId: 'brand' });

        expect(result).toEqual({ requested: 2, updated: 2, missingIds: [] });
        expect(transactionMock).toHaveBeenCalledTimes(1);
        expect(assetLibraryItemsTable.update).toHaveBeenCalledTimes(2);
        expect(assetLibraryItemsTable.records.get('a')?.categoryId).toBe('brand');
        expect(assetLibraryItemsTable.records.get('b')?.categoryId).toBe('brand');
        expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('deduplicates ids and reports missing assets without aborting the batch', async () => {
        assetLibraryItemsTable.records.set('a', makeAsset({ id: 'a' }));

        const result = await updateAssetLibraryItems(['a', 'missing', 'a'], { favorite: true });

        expect(result).toEqual({ requested: 2, updated: 1, missingIds: ['missing'] });
        expect(assetLibraryItemsTable.update).toHaveBeenCalledTimes(1);
        expect(assetLibraryItemsTable.records.get('a')?.favorite).toBe(true);
        expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('uses the current stored item when deriving batch tag updates', async () => {
        assetLibraryItemsTable.records.set('a', makeAsset({ id: 'a', tags: ['Hero'] }));

        const result = await updateAssetLibraryItems(['a'], (item) => ({
            tags: [...item.tags, 'hero', ' New ', 'new']
        }));

        expect(result.updated).toBe(1);
        expect(assetLibraryItemsTable.records.get('a')?.tags).toEqual(['Hero', 'New']);
    });
});
