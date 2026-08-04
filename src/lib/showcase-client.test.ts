import { DEFAULT_CONFIG } from '@/lib/config';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import { isExecutableShowcaseCase, type ShowcaseReadOnlyCase, type ShowcaseTopic } from '@/lib/showcase';
import {
    clearShowcaseCatalogCache,
    getShowcaseCase,
    getShowcaseCases,
    getShowcaseTopic,
    getShowcaseTopicInputSummary,
    loadShowcaseCatalog,
    readShowcaseCatalogCache,
    SHOWCASE_CATALOG_CACHE_KEY,
    SHOWCASE_CATALOG_EXTENDED_CACHE_KEY,
    writeShowcaseCatalogCache
} from '@/lib/showcase-client';
import { describe, expect, it, vi } from 'vitest';

function strictV1Catalog() {
    return {
        ...DEFAULT_SHOWCASE_CATALOG,
        topics: DEFAULT_SHOWCASE_CATALOG.topics.map((topic) => {
            const legacyTopic: ShowcaseTopic = { ...topic };
            Reflect.deleteProperty(legacyTopic, 'categories');
            Reflect.deleteProperty(legacyTopic, 'publishedAt');
            return legacyTopic;
        })
    };
}

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
        const fetcher = vi.fn((...args: [RequestInfo | URL, RequestInit?]) => {
            void args;
            return Promise.resolve(
                new Response(JSON.stringify({ catalog: DEFAULT_SHOWCASE_CATALOG }), {
                    status: 200,
                    headers: { etag: '"catalog-v1"', 'content-type': 'application/json' }
                })
            );
        });

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
        expect(fetcher).toHaveBeenCalledWith(
            'https://content.example/api/showcases',
            expect.objectContaining({
                headers: expect.objectContaining({})
            })
        );
        const requestHeaders = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
        expect(requestHeaders.get('x-showcase-client-version')).toBe('2');
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
        storage.setItem(SHOWCASE_CATALOG_EXTENDED_CACHE_KEY, '{broken');
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

    it('keeps strict-v1 and extended caches isolated and can use a strict-v1 entry offline', async () => {
        const storage = createStorage();
        const endpoint = '/api/showcases';
        expect(
            writeShowcaseCatalogCache(
                {
                    version: 1,
                    contract: 'legacy-v1',
                    endpoint,
                    cachedAt: 10,
                    etag: '"legacy"',
                    catalog: strictV1Catalog()
                },
                storage
            )
        ).toBe(true);
        expect(
            writeShowcaseCatalogCache(
                {
                    version: 1,
                    contract: 'extended-v2',
                    endpoint,
                    cachedAt: 20,
                    etag: '"extended"',
                    catalog: DEFAULT_SHOWCASE_CATALOG
                },
                storage
            )
        ).toBe(true);

        expect(storage.values.has(SHOWCASE_CATALOG_CACHE_KEY)).toBe(true);
        expect(storage.values.has(SHOWCASE_CATALOG_EXTENDED_CACHE_KEY)).toBe(true);
        expect(readShowcaseCatalogCache(storage, endpoint, 'legacy-v1')?.catalog.topics[0]).not.toHaveProperty(
            'categories'
        );
        expect(readShowcaseCatalogCache(storage, endpoint, 'extended-v2')?.catalog.topics[0]?.categories).toBeDefined();

        storage.removeItem(SHOWCASE_CATALOG_EXTENDED_CACHE_KEY);
        const offline = await loadShowcaseCatalog({
            endpoint,
            storage,
            fetcher: vi.fn(async () => {
                throw new Error('offline');
            })
        });
        expect(offline).toMatchObject({ source: 'cache', stale: true });
        expect(offline.catalog.topics[0]).not.toHaveProperty('categories');
    });

    it('migrates an unversioned extended cache written by the previous client', async () => {
        const storage = createStorage();
        const endpoint = '/api/showcases';
        storage.setItem(
            SHOWCASE_CATALOG_CACHE_KEY,
            JSON.stringify({
                version: 1,
                endpoint,
                cachedAt: 30,
                etag: '"previous-client"',
                catalog: DEFAULT_SHOWCASE_CATALOG
            })
        );

        const offline = await loadShowcaseCatalog({
            endpoint,
            storage,
            fetcher: vi.fn(async () => {
                throw new Error('offline');
            })
        });

        expect(offline).toMatchObject({ source: 'cache', stale: true });
        expect(offline.catalog.topics[0]?.categories).toBeDefined();
        expect(readShowcaseCatalogCache(storage, endpoint, 'extended-v2')).toMatchObject({
            contract: 'extended-v2',
            etag: '"previous-client"'
        });
    });

    it('resolves topics, ordered cases, and case slugs', () => {
        const topic = getShowcaseTopic(DEFAULT_SHOWCASE_CATALOG, 'old-photo-restoration');
        expect(topic).not.toBeNull();
        expect(getShowcaseCases(DEFAULT_SHOWCASE_CATALOG, topic!)).toHaveLength(4);
        expect(getShowcaseCase(DEFAULT_SHOWCASE_CATALOG, topic!, 'scratch-removal')?.topicId).toBe(topic!.id);
    });

    it('does not infer image requirements from a read-only future recipe', () => {
        const sourceTopic = getShowcaseTopic(DEFAULT_SHOWCASE_CATALOG, 'old-photo-restoration')!;
        const sourceCase = getShowcaseCases(DEFAULT_SHOWCASE_CATALOG, sourceTopic)[0]!;
        expect(isExecutableShowcaseCase(sourceCase)).toBe(true);
        if (!isExecutableShowcaseCase(sourceCase)) throw new Error('Expected a built-in executable showcase case');
        const { recipe, ...readOnlyFields } = sourceCase;
        expect(recipe.version).toBe(1);
        const futureCase: ShowcaseReadOnlyCase = {
            ...readOnlyFields,
            unsupportedRecipeVersion: 2
        };
        const futureTopic = { ...sourceTopic, caseIds: [futureCase.id] };
        const futureCatalog = {
            ...DEFAULT_SHOWCASE_CATALOG,
            topics: [futureTopic],
            cases: [futureCase]
        };

        expect(getShowcaseTopicInputSummary(futureCatalog, futureTopic)).toMatchObject({
            minimumInputs: 0,
            maximumInputs: 0,
            inputRequirementsKnown: false,
            executableCases: 0
        });
    });
});
