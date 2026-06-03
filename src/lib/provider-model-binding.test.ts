import { describe, expect, it } from 'vitest';
import {
    bindProviderModelToTask,
    getProviderEndpointCompatibilityFamily,
    getProviderModelBindingEntries,
    getProviderModelBindingEndpoints
} from './provider-model-binding';
import {
    getCatalogEntryId,
    getModelCatalogEntriesForTask,
    normalizeUnifiedProviderModelConfig,
    type ModelCatalogEntry,
    type ProviderEndpoint
} from './provider-model-catalog';

function endpoint(overrides: Partial<ProviderEndpoint> = {}): ProviderEndpoint {
    return {
        id: 'openai:images',
        provider: 'openai-compatible',
        name: 'OpenAI Images Relay',
        apiKey: 'key',
        apiBaseUrl: 'https://relay.example.com/v1',
        protocol: 'openai-images',
        enabled: true,
        modelIds: [],
        ...overrides
    };
}

function entry(providerEndpoint: ProviderEndpoint, rawModelId: string): ModelCatalogEntry {
    return {
        id: getCatalogEntryId(providerEndpoint.id, rawModelId),
        rawModelId,
        providerEndpointId: providerEndpoint.id,
        provider: providerEndpoint.provider,
        protocol: providerEndpoint.protocol,
        label: rawModelId,
        source: 'remote',
        enabled: true,
        capabilities: {
            tasks: [],
            inputModalities: [],
            outputModalities: []
        },
        capabilityConfidence: 'low'
    };
}

describe('provider model binding helpers', () => {
    it('treats OpenAI-compatible endpoints as bindable even when categorized by image or video protocol', () => {
        const imageEndpoint = endpoint();
        const videoEndpoint = endpoint({
            id: 'openai:sora',
            provider: 'openai',
            protocol: 'openai-videos',
            name: 'Sora'
        });
        const geminiEndpoint = endpoint({
            id: 'google:gemini',
            provider: 'google-gemini',
            protocol: 'gemini-generate-content',
            name: 'Gemini'
        });

        expect(getProviderEndpointCompatibilityFamily(imageEndpoint)).toBe('openai-compatible');
        expect(getProviderEndpointCompatibilityFamily(videoEndpoint)).toBe('openai-compatible');
        expect(getProviderEndpointCompatibilityFamily(geminiEndpoint)).toBeNull();
        expect(
            getProviderModelBindingEndpoints(
                { providerEndpoints: [imageEndpoint, videoEndpoint, geminiEndpoint] },
                { allowedFamilies: ['openai-compatible', 'anthropic-compatible'] }
            ).map((item) => item.id)
        ).toEqual(['openai:images', 'openai:sora']);
    });

    it('shows fetched endpoint models before they are added to the endpoint allowlist', () => {
        const providerEndpoint = endpoint();
        const catalogEntry = entry(providerEndpoint, 'gpt-4.1-mini');

        expect(
            getProviderModelBindingEntries(
                {
                    providerEndpoints: [providerEndpoint],
                    modelCatalog: [catalogEntry]
                },
                {
                    providerEndpointId: providerEndpoint.id,
                    task: 'prompt.polish',
                    includeUnmanaged: true,
                    includeWithoutTaskCapability: true
                }
            ).map((item) => item.rawModelId)
        ).toEqual(['gpt-4.1-mini']);
    });

    it('binds a selected model to a task by extending an existing allowlist, capability, and task default', () => {
        const providerEndpoint = endpoint({ modelIds: ['managed-image-model'] });
        const catalogEntry = entry(providerEndpoint, 'gpt-4.1-mini');
        const config = bindProviderModelToTask(
            {
                providerEndpoints: [providerEndpoint],
                modelCatalog: [catalogEntry],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {
                catalogEntryId: catalogEntry.id,
                task: 'prompt.polish'
            }
        );

        expect(config.providerEndpoints[0].modelIds).toEqual(['managed-image-model', 'gpt-4.1-mini']);
        expect(config.modelCatalog[0].capabilities.tasks).toContain('prompt.polish');
        expect(config.modelCatalog[0].capabilities.inputModalities).toContain('text');
        expect(config.modelCatalog[0].capabilities.outputModalities).toContain('text');
        expect(config.modelTaskDefaultCatalogEntryIds['prompt.polish']).toBe(catalogEntry.id);
    });

    it('keeps unrestricted image endpoint models available when binding a batch planning model', () => {
        const providerEndpoint = endpoint({ protocol: 'openai-images', modelIds: [] });
        const imageEntry = entry(providerEndpoint, 'gpt-image-2');
        imageEntry.capabilities = {
            tasks: ['image.generate', 'image.edit'],
            inputModalities: ['text', 'image'],
            outputModalities: ['image']
        };
        imageEntry.capabilityConfidence = 'high';
        const batchEntry = entry(providerEndpoint, 'gpt-4.1-mini');
        const config = bindProviderModelToTask(
            {
                providerEndpoints: [providerEndpoint],
                modelCatalog: [imageEntry, batchEntry],
                modelTaskDefaultCatalogEntryIds: {
                    'image.generate': imageEntry.id,
                    'image.edit': imageEntry.id
                }
            },
            {
                catalogEntryId: batchEntry.id,
                task: 'prompt.batchPlan'
            }
        );

        expect(config.providerEndpoints[0].modelIds).toEqual([]);
        expect(config.modelCatalog.find((item) => item.id === batchEntry.id)?.capabilities.tasks).toContain(
            'prompt.batchPlan'
        );

        const normalized = normalizeUnifiedProviderModelConfig(config, {
            providerInstances: [
                {
                    id: providerEndpoint.id,
                    type: 'openai',
                    name: providerEndpoint.name,
                    apiKey: providerEndpoint.apiKey,
                    apiBaseUrl: providerEndpoint.apiBaseUrl,
                    models: [],
                    isDefault: true
                }
            ]
        });
        expect(normalized.modelTaskDefaultCatalogEntryIds['image.generate']).toBe(imageEntry.id);
        expect(normalized.modelTaskDefaultCatalogEntryIds['image.edit']).toBe(imageEntry.id);
        expect(normalized.modelTaskDefaultCatalogEntryIds['prompt.batchPlan']).toBe(batchEntry.id);
        expect(
            getModelCatalogEntriesForTask(normalized, 'image.generate', {
                providerEndpointId: providerEndpoint.id
            }).map((item) => item.rawModelId)
        ).toContain('gpt-image-2');
    });

    it('binds a vision-text model with text and image input modalities', () => {
        const providerEndpoint = endpoint({
            id: 'anthropic:vision',
            provider: 'anthropic-compatible',
            protocol: 'anthropic-compatible-messages'
        });
        const catalogEntry = entry(providerEndpoint, 'claude-vision-model');
        const config = bindProviderModelToTask(
            {
                providerEndpoints: [providerEndpoint],
                modelCatalog: [catalogEntry],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {
                catalogEntryId: catalogEntry.id,
                task: 'vision.text'
            }
        );

        expect(config.providerEndpoints[0].modelIds).toEqual([]);
        expect(config.modelCatalog[0].capabilities.tasks).toContain('vision.text');
        expect(config.modelCatalog[0].capabilities.inputModalities).toEqual(
            expect.arrayContaining(['text', 'image'])
        );
        expect(config.modelCatalog[0].capabilities.outputModalities).toEqual(['text']);
        expect(config.modelTaskDefaultCatalogEntryIds['vision.text']).toBe(catalogEntry.id);
    });
});
