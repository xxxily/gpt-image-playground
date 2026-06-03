import { describe, expect, it } from 'vitest';
import {
    countActiveModelCatalogFilters,
    filterModelCatalogEntries,
    groupModelCatalogEntriesByProvider,
    type ModelCatalogFilterState
} from './model-catalog-state';
import type { ModelCatalogEntry, ProviderEndpoint } from '@/lib/provider-model-catalog';

const defaultFilters: ModelCatalogFilterState = {
    search: '',
    provider: 'all',
    endpoint: 'all',
    task: 'all',
    source: 'all',
    status: 'all'
};

const endpoints = new Map<string, ProviderEndpoint>([
    [
        'endpoint-b',
        {
            id: 'endpoint-b',
            provider: 'openai',
            name: 'Beta OpenAI',
            apiKey: '',
            apiBaseUrl: 'https://example.test/openai',
            protocol: 'openai-chat-completions'
        }
    ],
    [
        'endpoint-a',
        {
            id: 'endpoint-a',
            provider: 'openai-compatible',
            name: 'Alpha OpenAI',
            apiKey: '',
            apiBaseUrl: 'https://example.test/openai',
            protocol: 'openai-chat-completions'
        }
    ]
]);

const entries: ModelCatalogEntry[] = [
    {
        id: 'openai-disabled',
        rawModelId: 'gpt-4o',
        providerEndpointId: 'endpoint-b',
        provider: 'openai',
        label: 'GPT-4o',
        source: 'remote',
        enabled: false,
        capabilityConfidence: 'high',
        capabilities: {
            tasks: ['vision.text'],
            inputModalities: ['image', 'text'],
            outputModalities: ['text']
        }
    },
    {
        id: 'openai-unclassified',
        rawModelId: 'zeta-image',
        providerEndpointId: 'endpoint-a',
        provider: 'openai-compatible',
        label: 'Zeta Image',
        source: 'custom',
        enabled: true,
        capabilityConfidence: 'low',
        capabilities: {
            tasks: ['image.generate'],
            inputModalities: ['text'],
            outputModalities: ['image']
        }
    }
];

describe('filterModelCatalogEntries', () => {
    it('filters by provider, task, status, and search text', () => {
        const result = filterModelCatalogEntries({
            entries,
            endpointsById: endpoints,
            filters: {
                ...defaultFilters,
                search: 'alpha',
                provider: 'openai-compatible',
                task: 'image.generate',
                status: 'unclassified'
            }
        });

        expect(result.map((entry) => entry.id)).toEqual(['openai-unclassified']);
    });

    it('sorts entries by provider order, endpoint, then model id', () => {
        const result = filterModelCatalogEntries({
            entries: [...entries].reverse(),
            endpointsById: endpoints,
            filters: defaultFilters
        });

        expect(result.map((entry) => entry.id)).toEqual(['openai-disabled', 'openai-unclassified']);
    });
});

describe('groupModelCatalogEntriesByProvider', () => {
    it('groups filtered entries by provider order', () => {
        expect(groupModelCatalogEntriesByProvider(entries).map((group) => group.provider)).toEqual([
            'openai',
            'openai-compatible'
        ]);
    });
});

describe('countActiveModelCatalogFilters', () => {
    it('counts non-default filters', () => {
        expect(
            countActiveModelCatalogFilters({
                ...defaultFilters,
                search: 'image',
                status: 'enabled',
                source: 'custom'
            })
        ).toBe(3);
    });
});
