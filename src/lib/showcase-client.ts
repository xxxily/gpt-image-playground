import { loadConfig, type AppConfig } from '@/lib/config';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import { desktopShowcaseServiceConfigFromAppConfig } from '@/lib/desktop-config';
import { isTauriDesktop } from '@/lib/desktop-runtime';
import {
    isExecutableShowcaseCase,
    normalizeShowcaseCatalog,
    type ShowcaseAsset,
    type ShowcaseCase,
    type ShowcaseCatalog,
    type ShowcaseTopic
} from '@/lib/showcase';

/** Legacy strict-v1 cache key kept for old clients and one-release migration. */
export const SHOWCASE_CATALOG_CACHE_KEY = 'gpt-image-playground-showcase-catalog-v1';
/** Extended wire contract cache must never share storage with strict-v1 responses. */
export const SHOWCASE_CATALOG_EXTENDED_CACHE_KEY = 'gpt-image-playground-showcase-catalog-v2';
export const SHOWCASE_CATALOG_REQUEST_TIMEOUT_MS = 3_000;
export const SHOWCASE_CATALOG_MAX_CACHE_BYTES = 2_000_000;

export type ShowcaseCatalogCacheContract = 'legacy-v1' | 'extended-v2';

export type ShowcaseCatalogSource = 'remote' | 'cache' | 'builtin';

export type ShowcaseCatalogLoadResult = {
    catalog: ShowcaseCatalog;
    source: ShowcaseCatalogSource;
    endpoint: string | null;
    stale: boolean;
};

export type ShowcaseCatalogCacheEnvelope = {
    version: 1;
    /** Missing on pre-v2.15.11 entries; those entries are sanitized and migrated to the extended cache. */
    contract?: ShowcaseCatalogCacheContract;
    endpoint: string;
    cachedAt: number;
    etag: string | null;
    catalog: ShowcaseCatalog;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function cacheKeyForContract(contract: ShowcaseCatalogCacheContract): string {
    return contract === 'extended-v2' ? SHOWCASE_CATALOG_EXTENDED_CACHE_KEY : SHOWCASE_CATALOG_CACHE_KEY;
}

export type LoadShowcaseCatalogOptions = {
    endpoint?: string | null;
    appConfig?: AppConfig;
    fetcher?: typeof fetch;
    storage?: StorageLike | null;
    timeoutMs?: number;
    signal?: AbortSignal;
    now?: () => number;
};

function getBrowserStorage(): StorageLike | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function unwrapCatalogPayload(value: unknown): unknown {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
    const record = value as Record<string, unknown>;
    return record.catalog ?? value;
}

function createBuiltinResult(endpoint: string | null): ShowcaseCatalogLoadResult {
    return {
        catalog: DEFAULT_SHOWCASE_CATALOG,
        source: 'builtin',
        endpoint,
        stale: false
    };
}

export function resolveShowcaseCatalogMediaUrls(catalog: ShowcaseCatalog, endpoint: string): ShowcaseCatalog {
    let endpointUrl: URL;
    try {
        endpointUrl = new URL(endpoint);
    } catch {
        return catalog;
    }

    const assets = catalog.assets.map((asset) => {
        if (asset.kind !== 'remote-image' || !asset.url.startsWith('/')) return asset;
        return {
            ...asset,
            url: new URL(asset.url, endpointUrl).toString(),
            ...(asset.thumbnailUrl ? { thumbnailUrl: new URL(asset.thumbnailUrl, endpointUrl).toString() } : {})
        };
    });
    return { ...catalog, assets };
}

export function resolveShowcaseCatalogEndpoint(config: AppConfig = loadConfig()): string | null {
    if (!isTauriDesktop()) return '/api/showcases';
    return desktopShowcaseServiceConfigFromAppConfig(config).catalogUrl;
}

export function readShowcaseCatalogCache(
    storage: StorageLike | null = getBrowserStorage(),
    endpoint?: string | null,
    contract: ShowcaseCatalogCacheContract = 'extended-v2'
): ShowcaseCatalogCacheEnvelope | null {
    if (!storage) return null;

    try {
        const rawValue = storage.getItem(cacheKeyForContract(contract));
        if (!rawValue || rawValue.length > SHOWCASE_CATALOG_MAX_CACHE_BYTES) return null;
        const parsed = JSON.parse(rawValue) as Partial<ShowcaseCatalogCacheEnvelope>;
        const storedContract = parsed.contract;
        const isUnversionedPreviousClientEntry = storedContract === undefined && contract === 'legacy-v1';
        const normalizedContract: ShowcaseCatalogCacheContract = isUnversionedPreviousClientEntry
            ? 'extended-v2'
            : contract;
        if (
            parsed.version !== 1 ||
            (!isUnversionedPreviousClientEntry && storedContract !== contract) ||
            typeof parsed.endpoint !== 'string' ||
            (endpoint !== undefined && parsed.endpoint !== endpoint) ||
            typeof parsed.cachedAt !== 'number' ||
            !Number.isFinite(parsed.cachedAt) ||
            parsed.cachedAt <= 0 ||
            (parsed.etag !== null && typeof parsed.etag !== 'string')
        ) {
            return null;
        }

        const normalizedCatalog = normalizeShowcaseCatalog(parsed.catalog, {
            allowUnsupportedRecipeVersions: normalizedContract === 'extended-v2',
            allowExtendedTopicMetadata: normalizedContract === 'extended-v2'
        });
        const catalog = normalizedCatalog ? resolveShowcaseCatalogMediaUrls(normalizedCatalog, parsed.endpoint) : null;
        if (!catalog) return null;
        return {
            version: 1,
            contract: normalizedContract,
            endpoint: parsed.endpoint,
            cachedAt: parsed.cachedAt,
            etag: parsed.etag ?? null,
            catalog
        };
    } catch {
        return null;
    }
}

export function writeShowcaseCatalogCache(
    envelope: ShowcaseCatalogCacheEnvelope,
    storage: StorageLike | null = getBrowserStorage()
): boolean {
    if (!storage) return false;
    const contract = envelope.contract ?? 'extended-v2';
    const catalog = normalizeShowcaseCatalog(envelope.catalog, {
        allowUnsupportedRecipeVersions: contract === 'extended-v2',
        allowExtendedTopicMetadata: contract === 'extended-v2'
    });
    if (!catalog) return false;

    try {
        const serialized = JSON.stringify({ ...envelope, version: 1, contract, catalog });
        if (serialized.length > SHOWCASE_CATALOG_MAX_CACHE_BYTES) return false;
        storage.setItem(cacheKeyForContract(contract), serialized);
        return true;
    } catch {
        return false;
    }
}

export function clearShowcaseCatalogCache(storage: StorageLike | null = getBrowserStorage()): void {
    try {
        storage?.removeItem(SHOWCASE_CATALOG_CACHE_KEY);
        storage?.removeItem(SHOWCASE_CATALOG_EXTENDED_CACHE_KEY);
    } catch {
        // Storage availability must never affect the workbench.
    }
}

export async function loadShowcaseCatalog(
    options: LoadShowcaseCatalogOptions = {}
): Promise<ShowcaseCatalogLoadResult> {
    const endpoint =
        options.endpoint === undefined ? resolveShowcaseCatalogEndpoint(options.appConfig) : options.endpoint;
    if (!endpoint) return createBuiltinResult(null);

    const storage = options.storage === undefined ? getBrowserStorage() : options.storage;
    const extendedCache = readShowcaseCatalogCache(storage, endpoint, 'extended-v2');
    const fallbackCache = extendedCache ? null : readShowcaseCatalogCache(storage, endpoint, 'legacy-v1');
    const cached = extendedCache ?? fallbackCache;
    if (!extendedCache && fallbackCache?.contract === 'extended-v2') {
        writeShowcaseCatalogCache(fallbackCache, storage);
    }
    const fetcher = options.fetcher ?? globalThis.fetch;
    if (typeof fetcher !== 'function') {
        return cached
            ? { catalog: cached.catalog, source: 'cache', endpoint, stale: true }
            : createBuiltinResult(endpoint);
    }

    const controller = new AbortController();
    const timeoutMs = Math.max(250, options.timeoutMs ?? SHOWCASE_CATALOG_REQUEST_TIMEOUT_MS);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
        const headers = new Headers({ accept: 'application/json', 'x-showcase-client-version': '2' });
        if (cached?.etag) headers.set('if-none-match', cached.etag);
        const response = await fetcher(endpoint, {
            method: 'GET',
            cache: 'no-store',
            headers,
            signal: controller.signal
        });

        if (response.status === 304 && cached) {
            return { catalog: cached.catalog, source: 'cache', endpoint, stale: false };
        }
        if (!response.ok) throw new Error(`Showcase catalog request failed with ${response.status}.`);

        const payload = await response.json();
        const normalizedCatalog = normalizeShowcaseCatalog(unwrapCatalogPayload(payload), {
            allowUnsupportedRecipeVersions: true,
            allowExtendedTopicMetadata: true
        });
        if (!normalizedCatalog) throw new Error('Showcase catalog response is invalid.');
        const catalog = resolveShowcaseCatalogMediaUrls(normalizedCatalog, endpoint);

        writeShowcaseCatalogCache(
            {
                version: 1,
                contract: 'extended-v2',
                endpoint,
                cachedAt: (options.now ?? Date.now)(),
                etag: response.headers.get('etag'),
                catalog
            },
            storage
        );
        return { catalog, source: 'remote', endpoint, stale: false };
    } catch {
        if (cached) return { catalog: cached.catalog, source: 'cache', endpoint, stale: true };
        return createBuiltinResult(endpoint);
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abortFromCaller);
    }
}

export function getShowcaseTopic(catalog: ShowcaseCatalog, slugOrId: string): ShowcaseTopic | null {
    return catalog.topics.find((topic) => topic.slug === slugOrId || topic.id === slugOrId) ?? null;
}

export function getShowcaseCase(catalog: ShowcaseCatalog, topic: ShowcaseTopic, slugOrId: string): ShowcaseCase | null {
    const caseIds = new Set(topic.caseIds);
    return (
        catalog.cases.find(
            (showcaseCase) =>
                caseIds.has(showcaseCase.id) && (showcaseCase.slug === slugOrId || showcaseCase.id === slugOrId)
        ) ?? null
    );
}

export function getShowcaseCases(catalog: ShowcaseCatalog, topic: ShowcaseTopic): ShowcaseCase[] {
    const order = new Map(topic.caseIds.map((id, index) => [id, index]));
    return catalog.cases
        .filter((showcaseCase) => order.has(showcaseCase.id))
        .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

export type ShowcaseTopicInputSummary = {
    minimumInputs: number;
    maximumInputs: number;
    inputRequirementsKnown: boolean;
    needsMask: boolean;
    roles: string[];
    difficulties: ShowcaseCase['difficulty'][];
    executableCases: number;
};

export function getShowcaseTopicInputSummary(
    catalog: ShowcaseCatalog,
    topic: ShowcaseTopic
): ShowcaseTopicInputSummary {
    const cases = getShowcaseCases(catalog, topic);
    const executableCases = cases.filter(isExecutableShowcaseCase);
    const inputSource = executableCases;
    const difficultySource = executableCases.length > 0 ? executableCases : cases;
    const inputCounts = inputSource.map((showcaseCase) =>
        showcaseCase.recipe.inputSlots.reduce(
            (value, slot) => ({
                minimum: value.minimum + slot.minCount,
                maximum: value.maximum + slot.maxCount
            }),
            { minimum: 0, maximum: 0 }
        )
    );
    const roles = [
        ...new Set(
            inputSource.flatMap((showcaseCase) =>
                [...showcaseCase.recipe.inputSlots]
                    .sort((left, right) => left.workbenchOrder - right.workbenchOrder)
                    .map((slot) => slot.role)
            )
        )
    ];
    const difficulties = [...new Set(difficultySource.map((showcaseCase) => showcaseCase.difficulty))];
    return {
        minimumInputs: inputCounts.length > 0 ? Math.min(...inputCounts.map((item) => item.minimum)) : 0,
        maximumInputs: inputCounts.length > 0 ? Math.max(...inputCounts.map((item) => item.maximum)) : 0,
        inputRequirementsKnown: executableCases.length > 0,
        needsMask: inputSource.some((showcaseCase) => showcaseCase.recipe.capabilityRequirements.supportsMask === true),
        roles,
        difficulties,
        executableCases: executableCases.length
    };
}

export function getShowcaseAsset(catalog: ShowcaseCatalog, assetId: string): ShowcaseAsset | null {
    return catalog.assets.find((asset) => asset.id === assetId) ?? null;
}
