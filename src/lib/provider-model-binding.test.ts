import { describe, expect, it } from 'vitest';
import {
    bindProviderModelToTask,
    getProviderEndpointCompatibilityFamily,
    getProviderModelBindingEntries,
    getProviderModelBindingEndpoints
} from './provider-model-binding';
import { getCatalogEntryId, type ModelCatalogEntry, type ProviderEndpoint } from './provider-model-catalog';

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

    it('binds a selected model to a task by adding allowlist, capability, and task default', () => {
        const providerEndpoint = endpoint();
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

        expect(config.providerEndpoints[0].modelIds).toEqual(['gpt-4.1-mini']);
        expect(config.modelCatalog[0].capabilities.tasks).toContain('prompt.polish');
        expect(config.modelCatalog[0].capabilities.inputModalities).toContain('text');
        expect(config.modelCatalog[0].capabilities.outputModalities).toContain('text');
        expect(config.modelTaskDefaultCatalogEntryIds['prompt.polish']).toBe(catalogEntry.id);
    });
});
