import {
    MODEL_CATALOG_PROVIDER_ORDER,
    modelCatalogEntrySearchText,
    type ModelCatalogEndpointFilter,
    type ModelCatalogProviderFilter,
    type ModelCatalogSourceFilter,
    type ModelCatalogStatusFilter,
    type ModelCatalogTaskFilter
} from '@/components/settings/model-catalog-utils';
import type { ModelCatalogEntry, ProviderEndpoint, ProviderKind } from '@/lib/provider-model-catalog';

export type ModelCatalogFilterState = {
    search: string;
    provider: ModelCatalogProviderFilter;
    endpoint: ModelCatalogEndpointFilter;
    task: ModelCatalogTaskFilter;
    source: ModelCatalogSourceFilter;
    status: ModelCatalogStatusFilter;
};

export function filterModelCatalogEntries({
    entries,
    endpointsById,
    filters
}: {
    entries: readonly ModelCatalogEntry[];
    endpointsById: ReadonlyMap<string, ProviderEndpoint>;
    filters: ModelCatalogFilterState;
}) {
    const search = filters.search.trim().toLowerCase();
    return entries
        .filter((entry) => {
            const endpoint = endpointsById.get(entry.providerEndpointId);
            if (filters.provider !== 'all' && entry.provider !== filters.provider) return false;
            if (filters.endpoint !== 'all' && entry.providerEndpointId !== filters.endpoint) return false;
            if (filters.task !== 'all' && !entry.capabilities.tasks.includes(filters.task)) return false;
            if (filters.source !== 'all' && entry.source !== filters.source) return false;
            if (filters.status === 'enabled' && entry.enabled === false) return false;
            if (filters.status === 'disabled' && entry.enabled !== false) return false;
            if (filters.status === 'unclassified' && entry.capabilityConfidence !== 'low') return false;
            if (search && !modelCatalogEntrySearchText(entry, endpoint).includes(search)) return false;
            return true;
        })
        .sort((a, b) => {
            const providerDiff =
                MODEL_CATALOG_PROVIDER_ORDER.indexOf(a.provider) - MODEL_CATALOG_PROVIDER_ORDER.indexOf(b.provider);
            if (providerDiff !== 0) return providerDiff;
            const endpointA = endpointsById.get(a.providerEndpointId)?.name || a.providerEndpointId;
            const endpointB = endpointsById.get(b.providerEndpointId)?.name || b.providerEndpointId;
            const endpointDiff = endpointA.localeCompare(endpointB);
            if (endpointDiff !== 0) return endpointDiff;
            return a.rawModelId.localeCompare(b.rawModelId);
        });
}

export function groupModelCatalogEntriesByProvider(entries: readonly ModelCatalogEntry[]) {
    const groups = new Map<ProviderKind, ModelCatalogEntry[]>();
    entries.forEach((entry) => {
        const current = groups.get(entry.provider) ?? [];
        current.push(entry);
        groups.set(entry.provider, current);
    });
    return MODEL_CATALOG_PROVIDER_ORDER.filter((provider) => groups.has(provider)).map((provider) => ({
        provider,
        entries: groups.get(provider) ?? []
    }));
}

export function countActiveModelCatalogFilters(filters: ModelCatalogFilterState) {
    return [
        filters.search.trim(),
        filters.provider !== 'all',
        filters.endpoint !== 'all',
        filters.task !== 'all',
        filters.source !== 'all',
        filters.status !== 'all'
    ].filter(Boolean).length;
}
