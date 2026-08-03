import { DEFAULT_CONFIG } from '@/lib/config';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import {
    clearShowcaseCatalogCache,
    getShowcaseCase,
    getShowcaseCases,
    getShowcaseTopic,
    loadShowcaseCatalog,
    readShowcaseCatalogCache,
    SHOWCASE_CATALOG_CACHE_KEY,
    writeShowcaseCatalogCache
} from '@/lib/showcase-client';
import { describe, expect, it, vi } from 'vitest';

function createStorage() {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        values
    };
}

describe('showcase catalog client', () => {
    it('uses a valid remote catalog and stores its ETag', async () => {
        const storage = createStorage();
        const fetcher = vi.fn(async () =>
            new Response(JSON.stringify({ catalog: DEFAULT_SHOWCASE_CATALOG }), {
                status: 200,
                headers: { etag: '"catalog-v1"', 'content-type': 'application/json' }
            })
        );

        const result = await loadShowcaseCatalog({
            endpoint: 'https://content.example/api/showcases',
            storage,
            fetcher,
            now: () => 1234
        });

        expect(result.source).toBe('remote');
        expect(result.catalog.catalogRevision).toBe(DEFAULT_SHOWCASE_CATALOG.catalogRevision);
        expect(readShowcaseCatalogCache(storage, 'https://content.example/api/showcases')).toMatchObject({
            cachedAt: 1234,
            etag: '"catalog-v1"'
        });
    });

    it('uses the recent cache for 304 and network failures', async () => {
        const storage = createStorage();
        writeShowcaseCatalogCache(
            {
                version: 1,
                endpoint: '/api/showcases',
                cachedAt: 100,
                etag: '"catalog-v1"',
                catalog: DEFAULT_SHOWCASE_CATALOG
            },
            storage
        );

        const notModified = await loadShowcaseCatalog({
            endpoint: '/api/showcases',
            storage,
            fetcher: vi.fn(async () => new Response(null, { status: 304 }))
        });
        expect(notModified).toMatchObject({ source: 'cache', stale: false });

        const failed = await loadShowcaseCatalog({
            endpoint: '/api/showcases',
            storage,
            fetcher: vi.fn(async () => {
                throw new Error('offline');
            })
        });
        expect(failed).toMatchObject({ source: 'cache', stale: true });
    });

    it('falls back to the built-in catalog for invalid responses or disabled remote content', async () => {
        const invalid = await loadShowcaseCatalog({
            endpoint: '/api/showcases',
            storage: createStorage(),
            fetcher: vi.fn(async () => Response.json({ schemaVersion: 999 }))
        });
        expect(invalid).toMatchObject({ source: 'builtin', stale: false });

        const disabled = await loadShowcaseCatalog({ endpoint: null, appConfig: DEFAULT_CONFIG });
        expect(disabled).toMatchObject({ source: 'builtin', endpoint: null });
    });

    it('ignores damaged or cross-endpoint cache entries and can clear them', () => {
        const storage = createStorage();
        storage.setItem(SHOWCASE_CATALOG_CACHE_KEY, '{broken');
        expect(readShowcaseCatalogCache(storage)).toBeNull();

        writeShowcaseCatalogCache(
            {
                version: 1,
                endpoint: '/api/showcases',
                cachedAt: 1,
                etag: null,
                catalog: DEFAULT_SHOWCASE_CATALOG
            },
            storage
        );
        expect(readShowcaseCatalogCache(storage, 'https://other.example/api/showcases')).toBeNull();
        clearShowcaseCatalogCache(storage);
        expect(storage.values.size).toBe(0);
    });

    it('resolves topics, ordered cases, and case slugs', () => {
        const topic = getShowcaseTopic(DEFAULT_SHOWCASE_CATALOG, 'old-photo-restoration');
        expect(topic).not.toBeNull();
        expect(getShowcaseCases(DEFAULT_SHOWCASE_CATALOG, topic!)).toHaveLength(4);
        expect(getShowcaseCase(DEFAULT_SHOWCASE_CATALOG, topic!, 'scratch-removal')?.topicId).toBe(topic!.id);
    });
});
