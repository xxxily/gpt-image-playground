import { describe, expect, it } from 'vitest';
import {
    getCatalogEntryId,
    getModelCatalogEntriesForTask,
    normalizeUnifiedProviderModelConfig,
    resolvePromptPolishCatalogSelection,
    upsertDiscoveredModelCatalogEntries,
    type ModelCatalogEntry,
    type ProviderEndpoint
} from './provider-model-catalog';

const endpointA: ProviderEndpoint = {
    id: 'openai:a',
    provider: 'openai-compatible',
    name: 'Relay A',
    apiKey: 'key-a',
    apiBaseUrl: 'https://a.example.com/v1',
    protocol: 'openai-chat-completions',
    enabled: true
};

const endpointB: ProviderEndpoint = {
    id: 'openai:b',
    provider: 'openai-compatible',
    name: 'Relay B',
    apiKey: 'key-b',
    apiBaseUrl: 'https://b.example.com/v1',
    protocol: 'openai-chat-completions',
    enabled: true
};

function catalogEntry(
    endpoint: ProviderEndpoint,
    rawModelId: string,
    overrides: Partial<ModelCatalogEntry> = {}
): ModelCatalogEntry {
    return {
        id: getCatalogEntryId(endpoint.id, rawModelId),
        rawModelId,
        providerEndpointId: endpoint.id,
        provider: endpoint.provider,
        label: rawModelId,
        source: 'remote',
        enabled: true,
        capabilities: {
            tasks: [],
            inputModalities: [],
            outputModalities: []
        },
        capabilityConfidence: 'low',
        ...overrides
    };
}

describe('provider model catalog normalization', () => {
    it('migrates legacy image, vision-text, and prompt-polish config into one catalog', () => {
        const config = normalizeUnifiedProviderModelConfig(undefined, {
            providerInstances: [
                {
                    id: 'openai:relay',
                    type: 'openai',
                    name: 'Relay',
                    apiKey: 'relay-key',
                    apiBaseUrl: 'https://relay.example.com/v1',
                    models: ['custom-image-model'],
                    isDefault: true
                }
            ],
            customImageModels: [
                {
                    id: 'custom-image-model',
                    provider: 'openai',
                    instanceId: 'openai:relay',
                    label: 'Custom Image',
                    capabilities: {
                        supportsEditing: true,
                        supportsMask: true,
                        supportsCustomSize: true
                    }
                }
            ],
            visionTextProviderInstances: [
                {
                    id: 'vision:relay',
                    kind: 'openai-compatible',
                    name: 'Vision Relay',
                    apiKey: 'vision-key',
                    apiBaseUrl: 'https://vision.example.com/v1',
                    apiCompatibility: 'chat-completions',
                    models: ['vendor-vl-model'],
                    isDefault: true
                }
            ],
            visionTextModelId: 'vendor-vl-model',
            polishingApiKey: 'polish-key',
            polishingApiBaseUrl: 'https://polish.example.com/v1',
            polishingModelId: 'polish-model'
        });

        expect(config.providerEndpoints.map((endpoint) => endpoint.id)).toEqual(
            expect.arrayContaining(['openai:relay', 'vision:relay', 'prompt-polish:default'])
        );

        const imageEntry = config.modelCatalog.find((entry) => entry.rawModelId === 'custom-image-model');
        expect(imageEntry?.providerEndpointId).toBe('openai:relay');
        expect(imageEntry?.capabilities.tasks).toEqual(
            expect.arrayContaining(['image.generate', 'image.edit', 'image.maskEdit'])
        );

        const visionDefault = config.modelCatalog.find(
            (entry) => entry.id === config.modelTaskDefaultCatalogEntryIds['vision.text']
        );
        expect(visionDefault?.rawModelId).toBe('vendor-vl-model');

        const polishSelection = resolvePromptPolishCatalogSelection(config);
        expect(polishSelection.endpoint?.id).toBe('prompt-polish:default');
        expect(polishSelection.apiKey).toBe('polish-key');
        expect(polishSelection.modelId).toBe('polish-model');
    });

    it('keeps the same raw model ID separate for different endpoints', () => {
        const first = upsertDiscoveredModelCatalogEntries([], endpointA, [{ id: 'shared-model' }], 1);
        const both = upsertDiscoveredModelCatalogEntries(first, endpointB, [{ id: 'shared-model' }], 2);

        expect(both).toHaveLength(2);
        expect(new Set(both.map((entry) => entry.id)).size).toBe(2);
        expect(both.map((entry) => entry.providerEndpointId)).toEqual(['openai:a', 'openai:b']);
    });

    it('filters task selectors by enabled endpoints and explicit task capabilities', () => {
        const config = {
            providerEndpoints: [endpointA, { ...endpointB, enabled: false }],
            modelCatalog: [
                catalogEntry(endpointA, 'image-model', {
                    capabilities: {
                        tasks: ['image.generate'],
                        inputModalities: ['text'],
                        outputModalities: ['image']
                    },
                    capabilityConfidence: 'high'
                }),
                catalogEntry(endpointA, 'unknown-model'),
                catalogEntry(endpointB, 'disabled-endpoint-model', {
                    capabilities: {
                        tasks: ['image.generate'],
                        inputModalities: ['text'],
                        outputModalities: ['image']
                    },
                    capabilityConfidence: 'high'
                })
            ]
        };

        expect(getModelCatalogEntriesForTask(config, 'image.generate').map((entry) => entry.rawModelId)).toEqual([
            'image-model'
        ]);
        expect(
            getModelCatalogEntriesForTask(config, 'image.generate', { includeUnclassified: true }).map(
                (entry) => entry.rawModelId
            )
        ).toEqual(['image-model', 'unknown-model']);
    });

    it('preserves manual empty capability overrides on discovered models', () => {
        const manualDisabled = catalogEntry(endpointA, 'gpt-image-future', {
            capabilities: {
                tasks: [],
                inputModalities: [],
                outputModalities: []
            },
            capabilityConfidence: 'high'
        });

        const normalized = normalizeUnifiedProviderModelConfig(
            { providerEndpoints: [endpointA], modelCatalog: [manualDisabled], modelTaskDefaultCatalogEntryIds: {} },
            {}
        );
        const refreshed = upsertDiscoveredModelCatalogEntries(
            normalized.modelCatalog,
            endpointA,
            [{ id: 'gpt-image-future' }],
            3
        );

        const normalizedEntry = normalized.modelCatalog.find((entry) => entry.id === manualDisabled.id);
        const refreshedEntry = refreshed.find((entry) => entry.id === manualDisabled.id);
        expect(normalizedEntry?.capabilities.tasks).toEqual([]);
        expect(refreshedEntry?.capabilities.tasks).toEqual([]);
        expect(refreshedEntry?.capabilityConfidence).toBe('high');
    });

    it('does not clear existing catalog entries when discovery returns no models', () => {
        const existing = catalogEntry(endpointA, 'kept-model', {
            capabilities: {
                tasks: ['text.generate'],
                inputModalities: ['text'],
                outputModalities: ['text']
            },
            capabilityConfidence: 'high'
        });

        expect(upsertDiscoveredModelCatalogEntries([existing], endpointA, [], 4)).toEqual([existing]);
    });
});
