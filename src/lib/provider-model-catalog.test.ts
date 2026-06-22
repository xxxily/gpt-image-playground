import {
    getCatalogEntryId,
    getCatalogEntryLabel,
    getModelCatalogEntriesForTask,
    normalizeUnifiedProviderModelConfig,
    resolvePromptPolishCatalogSelection,
    resolveVisionTextCatalogSelection,
    resolveDefaultModelCatalogEntry,
    upsertDiscoveredModelCatalogEntries,
    findModelCatalogEntry,
    inferModelCatalogCapabilities,
    inferModelCatalogCapabilitiesForEndpoint,
    createCustomModelCatalogEntry,
    getPromptPolishModelCatalogEntriesForTask,
    type ModelCatalogEntry,
    type ProviderEndpoint,
    type VideoModelFeatures
} from './provider-model-catalog';
import { describe, expect, it } from 'vitest';

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
    it('migrates legacy image and vision-text config without recreating old prompt-polish connection fields', () => {
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
            visionTextModelId: 'vendor-vl-model'
        });

        expect(config.providerEndpoints.map((endpoint) => endpoint.id)).toEqual(
            expect.arrayContaining(['openai:relay', 'vision:relay'])
        );
        expect(config.providerEndpoints.map((endpoint) => endpoint.id)).not.toContain('prompt-polish:default');

        const imageEntry = config.modelCatalog.find((entry) => entry.rawModelId === 'custom-image-model');
        expect(imageEntry?.providerEndpointId).toBe('openai:relay');
        expect(imageEntry?.capabilities.tasks).toEqual(
            expect.arrayContaining(['image.generate', 'image.edit', 'image.maskEdit'])
        );

        expect(config.modelTaskDefaultCatalogEntryIds['vision.text']).toBeUndefined();
        const visionSelection = resolveVisionTextCatalogSelection(config, { providerEndpointId: 'vision:relay' });
        expect(visionSelection.endpoint?.id).toBe('vision:relay');
        expect(visionSelection.modelId).toBe('');

        const polishSelection = resolvePromptPolishCatalogSelection(config);
        expect(polishSelection.endpoint).toBeNull();
        expect(polishSelection.modelId).toBe('');
    });

    it('requires an explicit batch planning model selection and exposes pending adapter labels', () => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: 'openai:text',
                        provider: 'openai-compatible',
                        name: 'Text Relay',
                        apiKey: 'text-key',
                        apiBaseUrl: 'https://text.example.com/v1',
                        protocol: 'openai-chat-completions',
                        enabled: true
                    },
                    {
                        id: 'xai:video',
                        provider: 'xai',
                        name: 'xAI',
                        apiKey: 'video-key',
                        apiBaseUrl: 'https://api.x.ai/v1',
                        protocol: 'xai-imagine-video',
                        enabled: true
                    }
                ],
                modelCatalog: [
                    catalogEntry(
                        {
                            id: 'openai:text',
                            provider: 'openai-compatible',
                            name: 'Text Relay',
                            apiKey: 'text-key',
                            apiBaseUrl: 'https://text.example.com/v1',
                            protocol: 'openai-chat-completions',
                            enabled: true
                        },
                        'batch-model',
                        {
                            capabilities: {
                                tasks: ['prompt.batchPlan', 'prompt.polish', 'text.generate'],
                                inputModalities: ['text'],
                                outputModalities: ['text']
                            },
                            capabilityConfidence: 'high'
                        }
                    )
                ],
                modelTaskDefaultCatalogEntryIds: { 'prompt.polish': 'openai:text::batch-model' }
            },
            {}
        );

        expect(resolvePromptPolishCatalogSelection(config).modelId).toBe('batch-model');
        expect(resolvePromptPolishCatalogSelection(config, 'prompt.batchPlan').modelId).toBe('');
        expect(resolveDefaultModelCatalogEntry(config, 'prompt.batchPlan')).toBeNull();
        expect(
            config.modelCatalog.find((entry) => entry.rawModelId === 'grok-imagine-video')?.capabilities.tasks
        ).toEqual(expect.arrayContaining(['video.generate', 'video.imageToVideo']));
        expect(
            getCatalogEntryLabel(config.modelCatalog.find((entry) => entry.rawModelId === 'grok-imagine-video')!)
        ).toContain('适配器待实现');
    });

    it('creates generated legacy endpoints from provider instance credentials', () => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [],
                modelCatalog: [],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {
                openaiApiKey: 'sk-shared',
                openaiApiBaseUrl: 'https://relay.example.com/v1',
                providerInstances: [
                    {
                        id: 'openai:default',
                        type: 'openai',
                        name: 'relay.example.com',
                        apiKey: 'sk-shared',
                        apiBaseUrl: 'https://relay.example.com/v1',
                        models: [],
                        isDefault: true
                    }
                ]
            }
        );

        expect(config.providerEndpoints.find((endpoint) => endpoint.id === 'openai:default')).toMatchObject({
            apiKey: 'sk-shared',
            apiBaseUrl: 'https://relay.example.com/v1'
        });
    });

    it('preserves explicitly cleared credentials on generated legacy endpoints', () => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: 'openai:default',
                        provider: 'openai',
                        name: 'OpenAI',
                        apiKey: '',
                        apiBaseUrl: '',
                        protocol: 'openai-images',
                        enabled: true,
                        modelDiscovery: {
                            enabled: true,
                            lastRefreshedAt: 123
                        },
                        legacyImageProvider: 'openai'
                    }
                ],
                modelCatalog: [],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {
                openaiApiKey: 'sk-shared',
                openaiApiBaseUrl: 'https://relay.example.com/v1',
                providerInstances: [
                    {
                        id: 'openai:default',
                        type: 'openai',
                        name: 'relay.example.com',
                        apiKey: 'sk-shared',
                        apiBaseUrl: 'https://relay.example.com/v1',
                        models: [],
                        isDefault: true
                    }
                ]
            }
        );

        expect(config.providerEndpoints.find((endpoint) => endpoint.id === 'openai:default')).toMatchObject({
            apiKey: '',
            apiBaseUrl: '',
            modelDiscovery: {
                enabled: true,
                lastRefreshedAt: 123
            }
        });
    });

    it('resolves vision-text selection from unified endpoints', () => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: 'openai:vision',
                        provider: 'openai-compatible',
                        name: 'Vision Relay',
                        apiKey: 'vision-key',
                        apiBaseUrl: 'https://vision.example.com/v1',
                        protocol: 'openai-chat-completions',
                        enabled: true
                    }
                ],
                modelCatalog: [
                    catalogEntry(
                        {
                            id: 'openai:vision',
                            provider: 'openai-compatible',
                            name: 'Vision Relay',
                            apiKey: 'vision-key',
                            apiBaseUrl: 'https://vision.example.com/v1',
                            protocol: 'openai-chat-completions',
                            enabled: true
                        },
                        'vision-model',
                        {
                            capabilities: {
                                tasks: ['vision.text', 'text.generate'],
                                inputModalities: ['text', 'image'],
                                outputModalities: ['text']
                            },
                            capabilityConfidence: 'high'
                        }
                    )
                ],
                modelTaskDefaultCatalogEntryIds: { 'vision.text': 'openai:vision::vision-model' }
            },
            {}
        );

        const selection = resolveVisionTextCatalogSelection(config);
        expect(selection.endpoint?.id).toBe('openai:vision');
        expect(selection.apiKey).toBe('vision-key');
        expect(selection.apiBaseUrl).toBe('https://vision.example.com/v1');
        expect(selection.modelId).toBe('vision-model');
        expect(selection.apiCompatibility).toBe('chat-completions');
        expect(selection.providerInstance?.id).toBe('openai:vision');
    });

    it('resolves Anthropic-compatible vision-text catalog selection without OpenAI compatibility fallback', () => {
        const endpoint = {
            id: 'anthropic:vision',
            provider: 'anthropic-compatible' as const,
            name: 'Anthropic Relay',
            apiKey: 'anthropic-key',
            apiBaseUrl: 'https://anthropic.example.com/v1',
            protocol: 'anthropic-compatible-messages' as const,
            enabled: true
        };
        const entry = catalogEntry(endpoint, 'claude-vision-model', {
            capabilities: {
                tasks: ['vision.text', 'text.generate'],
                inputModalities: ['text', 'image'],
                outputModalities: ['text']
            },
            capabilityConfidence: 'high'
        });
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [endpoint],
                modelCatalog: [entry],
                modelTaskDefaultCatalogEntryIds: { 'vision.text': entry.id }
            },
            {}
        );

        const selection = resolveVisionTextCatalogSelection(config);
        expect(selection.endpoint?.id).toBe(endpoint.id);
        expect(selection.providerInstance?.kind).toBe('anthropic-compatible');
        expect(selection.modelId).toBe('claude-vision-model');
        expect(selection.apiCompatibility).toBe('chat-completions');
    });

    it('keeps the requested vision-text endpoint unbound when its model is not selected as the task default', () => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: 'openai:first',
                        provider: 'openai-compatible',
                        name: 'First Relay',
                        apiKey: 'first-key',
                        apiBaseUrl: 'https://first.example.com/v1',
                        protocol: 'openai-chat-completions',
                        enabled: true
                    },
                    {
                        id: 'openai:preferred',
                        provider: 'openai-compatible',
                        name: 'Preferred Relay',
                        apiKey: 'preferred-key',
                        apiBaseUrl: 'https://preferred.example.com/v1',
                        protocol: 'openai-chat-completions',
                        enabled: true
                    }
                ],
                modelCatalog: [
                    catalogEntry(
                        {
                            id: 'openai:first',
                            provider: 'openai-compatible',
                            name: 'First Relay',
                            apiKey: 'first-key',
                            apiBaseUrl: 'https://first.example.com/v1',
                            protocol: 'openai-chat-completions',
                            enabled: true
                        },
                        'first-vision-model',
                        {
                            capabilities: {
                                tasks: ['vision.text', 'text.generate'],
                                inputModalities: ['text', 'image'],
                                outputModalities: ['text']
                            },
                            capabilityConfidence: 'high'
                        }
                    ),
                    catalogEntry(
                        {
                            id: 'openai:preferred',
                            provider: 'openai-compatible',
                            name: 'Preferred Relay',
                            apiKey: 'preferred-key',
                            apiBaseUrl: 'https://preferred.example.com/v1',
                            protocol: 'openai-chat-completions',
                            enabled: true
                        },
                        'preferred-vision-model',
                        {
                            capabilities: {
                                tasks: ['vision.text', 'text.generate'],
                                inputModalities: ['text', 'image'],
                                outputModalities: ['text']
                            },
                            capabilityConfidence: 'high'
                        }
                    )
                ],
                modelTaskDefaultCatalogEntryIds: { 'vision.text': 'openai:first::first-vision-model' }
            },
            {}
        );

        const selection = resolveVisionTextCatalogSelection(config, {
            providerEndpointId: 'openai:preferred'
        });

        expect(selection.endpoint?.id).toBe('openai:preferred');
        expect(selection.catalogEntry).toBeNull();
        expect(selection.modelId).toBe('');
        expect(selection.apiKey).toBe('preferred-key');
        expect(selection.apiBaseUrl).toBe('https://preferred.example.com/v1');
    });

    it('does not auto-default to the xAI placeholder video model', () => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: 'xai:video',
                        provider: 'xai',
                        name: 'xAI',
                        apiKey: 'video-key',
                        apiBaseUrl: 'https://api.x.ai/v1',
                        protocol: 'xai-imagine-video',
                        enabled: true
                    }
                ],
                modelCatalog: [],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {}
        );

        expect(config.modelCatalog.some((entry) => entry.rawModelId === 'grok-imagine-video')).toBe(true);
        expect(resolveDefaultModelCatalogEntry(config, 'video.generate')).toBeNull();
        expect(resolveDefaultModelCatalogEntry(config, 'video.imageToVideo')).toBeNull();
    });

    it('prefers a real video model over the xAI placeholder when resolving defaults', () => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: 'xai:video',
                        provider: 'xai',
                        name: 'xAI',
                        apiKey: 'video-key',
                        apiBaseUrl: 'https://api.x.ai/v1',
                        protocol: 'xai-imagine-video',
                        enabled: true
                    },
                    {
                        id: 'openai:video',
                        provider: 'openai-compatible',
                        name: 'Video Relay',
                        apiKey: 'relay-key',
                        apiBaseUrl: 'https://relay.example.com/v1',
                        protocol: 'openai-chat-completions',
                        enabled: true
                    }
                ],
                modelCatalog: [
                    catalogEntry(
                        {
                            id: 'openai:video',
                            provider: 'openai-compatible',
                            name: 'Video Relay',
                            apiKey: 'relay-key',
                            apiBaseUrl: 'https://relay.example.com/v1',
                            protocol: 'openai-chat-completions',
                            enabled: true
                        },
                        'real-video-model',
                        {
                            capabilities: {
                                tasks: ['video.generate', 'video.imageToVideo'],
                                inputModalities: ['text', 'image'],
                                outputModalities: ['video']
                            },
                            capabilityConfidence: 'high'
                        }
                    )
                ],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {}
        );

        expect(resolveDefaultModelCatalogEntry(config, 'video.generate')?.rawModelId).toBe('real-video-model');
        expect(resolveDefaultModelCatalogEntry(config, 'video.imageToVideo')?.rawModelId).toBe('real-video-model');
    });

    it('keeps a video endpoint with an empty model whitelist out of video selectors', () => {
        const videoEndpoint: ProviderEndpoint = {
            id: 'openai:sora',
            provider: 'openai',
            name: 'OpenAI Sora',
            apiKey: 'video-key',
            apiBaseUrl: 'https://api.openai.com/v1',
            protocol: 'openai-videos',
            enabled: true,
            modelIds: []
        };
        const entry = catalogEntry(videoEndpoint, 'sora-2', {
            provider: 'openai',
            protocol: 'openai-videos',
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: { video: { asyncJob: true } }
            },
            capabilityConfidence: 'high'
        });
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [videoEndpoint],
                modelCatalog: [entry],
                modelTaskDefaultCatalogEntryIds: { 'video.generate': entry.id }
            },
            {}
        );

        expect(getModelCatalogEntriesForTask(config, 'video.generate')).toEqual([]);
        expect(resolveDefaultModelCatalogEntry(config, 'video.generate')).toBeNull();
    });

    it('allows a whitelisted implemented video model to become the default', () => {
        const videoEndpoint: ProviderEndpoint = {
            id: 'openai:sora',
            provider: 'openai',
            name: 'OpenAI Sora',
            apiKey: 'video-key',
            apiBaseUrl: 'https://api.openai.com/v1',
            protocol: 'openai-videos',
            enabled: true,
            modelIds: ['sora-2']
        };
        const entry = createCustomModelCatalogEntry(videoEndpoint, 'sora-2');
        expect(entry).not.toBeNull();
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [videoEndpoint],
                modelCatalog: entry ? [entry] : [],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {}
        );

        expect(getModelCatalogEntriesForTask(config, 'video.generate').map((item) => item.rawModelId)).toEqual([
            'sora-2'
        ]);
        expect(resolveDefaultModelCatalogEntry(config, 'video.generate')?.rawModelId).toBe('sora-2');
        expect(resolveDefaultModelCatalogEntry(config, 'video.imageToVideo')?.rawModelId).toBe('sora-2');
    });

    it('infers pending video protocols as video-capable but not defaultable', () => {
        const runwayEndpoint: ProviderEndpoint = {
            id: 'runway:default',
            provider: 'runway',
            name: 'Runway',
            apiKey: 'video-key',
            apiBaseUrl: 'https://api.runwayml.com',
            protocol: 'runway-api-v1',
            enabled: true,
            modelIds: ['private-model']
        };
        const inferred = inferModelCatalogCapabilitiesForEndpoint('private-model', runwayEndpoint);
        const entry = createCustomModelCatalogEntry(runwayEndpoint, 'private-model');
        expect(entry).not.toBeNull();
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [runwayEndpoint],
                modelCatalog: entry ? [entry] : [],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {}
        );

        expect(inferred.capabilities.tasks).toEqual(expect.arrayContaining(['video.generate', 'video.imageToVideo']));
        expect(inferred.confidence).toBe('low');
        expect(getModelCatalogEntriesForTask(config, 'video.generate')).toHaveLength(1);
        expect(resolveDefaultModelCatalogEntry(config, 'video.generate')).toBeNull();
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

    it('treats unknown OpenAI-compatible text models as reusable prompt polish models', () => {
        const refreshed = upsertDiscoveredModelCatalogEntries([], endpointA, [{ id: 'private-text-model' }], 5);
        const entry = refreshed.find((item) => item.rawModelId === 'private-text-model');

        expect(entry?.capabilities.tasks).toEqual(
            expect.arrayContaining(['text.generate', 'prompt.polish', 'prompt.batchPlan'])
        );
        expect(entry?.capabilityConfidence).toBe('medium');

        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [{ ...endpointA, modelIds: ['private-text-model'] }],
                modelCatalog: refreshed,
                modelTaskDefaultCatalogEntryIds: {}
            },
            {}
        );

        expect(getModelCatalogEntriesForTask(config, 'prompt.polish').map((item) => item.rawModelId)).toEqual([
            'private-text-model'
        ]);
        expect(resolvePromptPolishCatalogSelection(config).endpoint).toBeNull();
        expect(resolvePromptPolishCatalogSelection(config).modelId).toBe('');

        const selectedConfig = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [{ ...endpointA, modelIds: ['private-text-model'] }],
                modelCatalog: refreshed,
                modelTaskDefaultCatalogEntryIds: {
                    'prompt.polish': getCatalogEntryId(endpointA.id, 'private-text-model')
                }
            },
            {}
        );
        expect(resolvePromptPolishCatalogSelection(selectedConfig).endpoint?.id).toBe(endpointA.id);
        expect(resolvePromptPolishCatalogSelection(selectedConfig).modelId).toBe('private-text-model');
    });

    it('keeps explicit prompt task defaults on endpoints with an empty model allowlist', () => {
        const endpoint: ProviderEndpoint = {
            ...endpointA,
            id: 'openai:empty-text',
            modelIds: []
        };
        const polishEntry = catalogEntry(endpoint, 'polish-model', {
            capabilities: {
                tasks: ['text.generate', 'prompt.polish'],
                inputModalities: ['text'],
                outputModalities: ['text']
            },
            capabilityConfidence: 'high'
        });
        const batchEntry = catalogEntry(endpoint, 'batch-model', {
            capabilities: {
                tasks: ['text.generate', 'prompt.batchPlan'],
                inputModalities: ['text'],
                outputModalities: ['text']
            },
            capabilityConfidence: 'high'
        });

        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [endpoint],
                modelCatalog: [polishEntry, batchEntry],
                modelTaskDefaultCatalogEntryIds: {
                    'prompt.polish': polishEntry.id,
                    'prompt.batchPlan': batchEntry.id
                }
            },
            {}
        );

        expect(getModelCatalogEntriesForTask(config, 'prompt.polish')).toEqual([]);
        expect(config.modelTaskDefaultCatalogEntryIds['prompt.polish']).toBe(polishEntry.id);
        expect(config.modelTaskDefaultCatalogEntryIds['prompt.batchPlan']).toBe(batchEntry.id);
        expect(resolvePromptPolishCatalogSelection(config, 'prompt.polish').modelId).toBe('polish-model');
        expect(resolvePromptPolishCatalogSelection(config, 'prompt.batchPlan').modelId).toBe('batch-model');
        expect(resolveDefaultModelCatalogEntry(config, 'prompt.batchPlan')?.rawModelId).toBe('batch-model');
    });

    it('preserves explicit prompt defaults when a saved catalog entry is missing task capability or allowlist membership', () => {
        const endpoint: ProviderEndpoint = {
            ...endpointA,
            id: 'openai:strict-text',
            modelIds: ['other-model']
        };
        const batchEntry = catalogEntry(endpoint, 'batch-model', {
            capabilities: {
                tasks: ['text.generate'],
                inputModalities: ['text'],
                outputModalities: ['text']
            },
            capabilityConfidence: 'high'
        });

        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [endpoint],
                modelCatalog: [batchEntry],
                modelTaskDefaultCatalogEntryIds: {
                    'prompt.batchPlan': batchEntry.id
                }
            },
            {}
        );

        expect(config.providerEndpoints[0]?.modelIds).toEqual(['other-model', 'batch-model']);
        expect(config.modelCatalog.find((entry) => entry.id === batchEntry.id)?.capabilities.tasks).toContain(
            'prompt.batchPlan'
        );
        expect(config.modelTaskDefaultCatalogEntryIds['prompt.batchPlan']).toBe(batchEntry.id);
        expect(resolvePromptPolishCatalogSelection(config, 'prompt.batchPlan').modelId).toBe('batch-model');
    });

    it('preserves shared prompt defaults when one saved catalog entry backs polish and batch planning', () => {
        const endpoint: ProviderEndpoint = {
            ...endpointA,
            id: 'openai:shared-text',
            modelIds: ['shared-model']
        };
        const sharedEntry = catalogEntry(endpoint, 'shared-model', {
            capabilities: {
                tasks: ['text.generate'],
                inputModalities: ['text'],
                outputModalities: ['text']
            },
            capabilityConfidence: 'medium'
        });

        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [endpoint],
                modelCatalog: [sharedEntry],
                modelTaskDefaultCatalogEntryIds: {
                    'prompt.polish': sharedEntry.id,
                    'prompt.batchPlan': sharedEntry.id
                }
            },
            {}
        );

        expect(config.modelCatalog.find((entry) => entry.id === sharedEntry.id)?.capabilities.tasks).toEqual(
            expect.arrayContaining(['text.generate', 'prompt.polish', 'prompt.batchPlan'])
        );
        expect(config.modelTaskDefaultCatalogEntryIds['prompt.polish']).toBe(sharedEntry.id);
        expect(config.modelTaskDefaultCatalogEntryIds['prompt.batchPlan']).toBe(sharedEntry.id);
        expect(resolvePromptPolishCatalogSelection(config, 'prompt.polish').modelId).toBe('shared-model');
        expect(resolvePromptPolishCatalogSelection(config, 'prompt.batchPlan').modelId).toBe('shared-model');
    });

    it('keeps explicit vision-text defaults on endpoints with an empty model allowlist', () => {
        const endpoint: ProviderEndpoint = {
            id: 'openai:empty-vision',
            provider: 'openai-compatible',
            name: 'Empty Vision Relay',
            apiKey: 'vision-key',
            apiBaseUrl: 'https://vision.example.com/v1',
            protocol: 'openai-chat-completions',
            enabled: true,
            modelIds: []
        };
        const entry = catalogEntry(endpoint, 'vision-model', {
            capabilities: {
                tasks: ['vision.text', 'text.generate'],
                inputModalities: ['text', 'image'],
                outputModalities: ['text']
            },
            capabilityConfidence: 'high'
        });

        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [endpoint],
                modelCatalog: [entry],
                modelTaskDefaultCatalogEntryIds: { 'vision.text': entry.id }
            },
            {}
        );

        expect(getModelCatalogEntriesForTask(config, 'vision.text')).toEqual([]);
        expect(config.modelTaskDefaultCatalogEntryIds['vision.text']).toBe(entry.id);
        expect(resolveDefaultModelCatalogEntry(config, 'vision.text')?.rawModelId).toBe('vision-model');
        expect(resolveVisionTextCatalogSelection(config).modelId).toBe('vision-model');
    });

    it('treats Anthropic-compatible text models as reusable prompt polish models', () => {
        const anthropicEndpoint: ProviderEndpoint = {
            id: 'anthropic:default',
            provider: 'anthropic-compatible',
            name: 'Anthropic Relay',
            apiKey: 'anthropic-key',
            apiBaseUrl: 'https://anthropic.example.com/v1',
            protocol: 'anthropic-compatible-messages',
            enabled: true,
            modelIds: ['claude-private']
        };
        const refreshed = upsertDiscoveredModelCatalogEntries([], anthropicEndpoint, [{ id: 'claude-private' }], 5);
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [anthropicEndpoint],
                modelCatalog: refreshed,
                modelTaskDefaultCatalogEntryIds: {
                    'prompt.polish': getCatalogEntryId(anthropicEndpoint.id, 'claude-private')
                }
            },
            {}
        );

        expect(
            getPromptPolishModelCatalogEntriesForTask(config, 'prompt.polish').map((item) => item.rawModelId)
        ).toEqual(['claude-private']);
        const selection = resolvePromptPolishCatalogSelection(config);
        expect(selection.endpoint?.id).toBe(anthropicEndpoint.id);
        expect(selection.apiKey).toBe('anthropic-key');
        expect(selection.modelId).toBe('claude-private');
    });

    it('allows OpenAI-compatible image-categorized endpoints for prompt polish selection', () => {
        const imageEndpoint: ProviderEndpoint = {
            id: 'image:openai',
            provider: 'openai-compatible',
            name: 'Image Relay',
            apiKey: 'image-key',
            apiBaseUrl: 'https://image.example.com/v1',
            protocol: 'openai-images',
            enabled: true,
            modelIds: ['text-looking-image-model']
        };
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [imageEndpoint],
                modelCatalog: [
                    catalogEntry(imageEndpoint, 'text-looking-image-model', {
                        capabilities: {
                            tasks: ['text.generate', 'prompt.polish', 'prompt.batchPlan'],
                            inputModalities: ['text'],
                            outputModalities: ['text']
                        },
                        capabilityConfidence: 'high'
                    })
                ],
                modelTaskDefaultCatalogEntryIds: {
                    'prompt.polish': 'image:openai::text-looking-image-model'
                }
            },
            {}
        );

        expect(
            getPromptPolishModelCatalogEntriesForTask(config, 'prompt.polish').map((item) => item.rawModelId)
        ).toEqual(['text-looking-image-model']);
        expect(resolvePromptPolishCatalogSelection(config).endpoint?.id).toBe(imageEndpoint.id);
    });

    it('excludes non OpenAI or Anthropic compatible endpoints from prompt polish selection even when tasks overlap', () => {
        const geminiEndpoint: ProviderEndpoint = {
            id: 'google:gemini',
            provider: 'google-gemini',
            name: 'Gemini',
            apiKey: 'gemini-key',
            apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            protocol: 'gemini-generate-content',
            enabled: true,
            modelIds: ['gemini-text-looking-model']
        };
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [geminiEndpoint],
                modelCatalog: [
                    catalogEntry(geminiEndpoint, 'gemini-text-looking-model', {
                        capabilities: {
                            tasks: ['text.generate', 'prompt.polish', 'prompt.batchPlan'],
                            inputModalities: ['text'],
                            outputModalities: ['text']
                        },
                        capabilityConfidence: 'high'
                    })
                ],
                modelTaskDefaultCatalogEntryIds: {
                    'prompt.polish': 'google:gemini::gemini-text-looking-model'
                }
            },
            {}
        );

        expect(getPromptPolishModelCatalogEntriesForTask(config, 'prompt.polish')).toEqual([]);
        expect(resolvePromptPolishCatalogSelection(config).endpoint).toBeNull();
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

describe('video provider kinds round-trip', () => {
    const newKinds = [
        'anthropic',
        'anthropic-compatible',
        'google-vertex-ai',
        'runway',
        'luma',
        'minimax',
        'kling',
        'byteplus-modelark',
        'aliyun-dashscope',
        'tencent-hunyuan-video',
        'tencent-tokenhub',
        'fal'
    ] as const;

    it.each(newKinds)('normalizes provider kind "%s"', (kind) => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: `video:${kind}`,
                        provider: kind,
                        name: `${kind} endpoint`,
                        apiKey: 'key',
                        apiBaseUrl: 'https://video.example.com/v1',
                        protocol: 'openai-images',
                        enabled: true
                    }
                ],
                modelCatalog: [],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {}
        );
        expect(config.providerEndpoints[0]?.provider).toBe(kind);
    });

    it('falls back unknown provider kind to openai-compatible', () => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: 'video:unknown',
                        provider: 'totally-unknown-provider',
                        name: 'Unknown',
                        apiKey: 'key',
                        apiBaseUrl: 'https://example.com',
                        protocol: 'openai-images',
                        enabled: true
                    } as unknown as ProviderEndpoint
                ],
                modelCatalog: [],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {}
        );
        expect(config.providerEndpoints[0]?.provider).toBe('openai-compatible');
    });
});

describe('video protocol round-trip', () => {
    const newProtocols = [
        'anthropic-messages',
        'anthropic-compatible-messages',
        'openai-videos',
        'gemini-generate-videos',
        'vertex-ai-veo',
        'runway-api-v1',
        'luma-dream-machine',
        'minimax-video',
        'kling-api',
        'modelark-video-generation',
        'dashscope-video-generation',
        'tencent-vclm',
        'tencent-tokenhub-video',
        'fal-model-api'
    ] as const;

    it.each(newProtocols)('normalizes provider protocol "%s"', (protocol) => {
        const config = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [
                    {
                        id: `video:${protocol}`,
                        provider: 'openai-compatible',
                        name: `${protocol} endpoint`,
                        apiKey: 'key',
                        apiBaseUrl: 'https://video.example.com/v1',
                        protocol,
                        enabled: true
                    }
                ],
                modelCatalog: [],
                modelTaskDefaultCatalogEntryIds: {}
            },
            {}
        );
        expect(config.providerEndpoints[0]?.protocol).toBe(protocol);
    });

    it('maps new provider kind to correct default protocol', () => {
        const kindProtocolPairs: Array<{ kind: string; expectedProtocol: string }> = [
            { kind: 'anthropic', expectedProtocol: 'anthropic-messages' },
            { kind: 'anthropic-compatible', expectedProtocol: 'anthropic-compatible-messages' },
            { kind: 'google-vertex-ai', expectedProtocol: 'vertex-ai-veo' },
            { kind: 'runway', expectedProtocol: 'runway-api-v1' },
            { kind: 'luma', expectedProtocol: 'luma-dream-machine' },
            { kind: 'minimax', expectedProtocol: 'minimax-video' },
            { kind: 'kling', expectedProtocol: 'kling-api' },
            { kind: 'byteplus-modelark', expectedProtocol: 'modelark-video-generation' },
            { kind: 'aliyun-dashscope', expectedProtocol: 'dashscope-video-generation' },
            { kind: 'tencent-hunyuan-video', expectedProtocol: 'tencent-vclm' },
            { kind: 'tencent-tokenhub', expectedProtocol: 'tencent-tokenhub-video' },
            { kind: 'fal', expectedProtocol: 'fal-model-api' }
        ];
        for (const { kind, expectedProtocol } of kindProtocolPairs) {
            const config = normalizeUnifiedProviderModelConfig(
                {
                    providerEndpoints: [
                        {
                            id: `video:${kind}`,
                            provider: kind,
                            name: kind,
                            apiKey: 'key',
                            apiBaseUrl: 'https://example.com/v1',
                            protocol: 'invalid-protocol',
                            enabled: true
                        } as unknown as ProviderEndpoint
                    ],
                    modelCatalog: [],
                    modelTaskDefaultCatalogEntryIds: {}
                },
                {}
            );
            expect(config.providerEndpoints[0]?.protocol).toBe(expectedProtocol);
        }
    });
});

describe('video task capabilities guard', () => {
    it.each(['video.edit', 'video.extend', 'video.referenceToVideo', 'video.audioToVideo', 'video.character'] as const)(
        'recognizes video task capability "%s"',
        (task) => {
            const entry: ModelCatalogEntry = catalogEntry(endpointA, 'video-model', {
                capabilities: {
                    tasks: [task],
                    inputModalities: ['text', 'image'],
                    outputModalities: ['video']
                },
                capabilityConfidence: 'high'
            });
            const config = {
                providerEndpoints: [endpointA],
                modelCatalog: [entry],
                modelTaskDefaultCatalogEntryIds: {}
            };
            const results = getModelCatalogEntriesForTask(config, task);
            expect(results).toHaveLength(1);
            expect(results[0]?.rawModelId).toBe('video-model');
        }
    );
});

describe('inferModelCatalogCapabilities for video models', () => {
    it('detects Seedream 5.0 endpoint IDs as image generation models', () => {
        const { capabilities, confidence } = inferModelCatalogCapabilities(
            'doubao-seedream-5-0-260128',
            'volcengine-ark'
        );

        expect(capabilities.tasks).toEqual(expect.arrayContaining(['image.generate', 'image.edit']));
        expect(capabilities.inputModalities).toEqual(['text', 'image']);
        expect(capabilities.outputModalities).toEqual(['image']);
        expect(capabilities.features).toMatchObject({ outputFormat: true, customImageSize: true });
        expect(confidence).toBe('high');
    });

    it('detects sora-2 as video model with correct tasks and features', () => {
        const { capabilities, confidence } = inferModelCatalogCapabilities('sora-2', 'openai');
        expect(capabilities.tasks).toContain('video.generate');
        expect(capabilities.tasks).toContain('video.imageToVideo');
        expect(capabilities.inputModalities).toContain('text');
        expect(capabilities.inputModalities).toContain('image');
        expect(capabilities.outputModalities).toEqual(['video']);
        expect(confidence).toBe('high');
        expect(capabilities.features?.video?.asyncJob).toBe(true);
        expect(capabilities.features?.video?.progressPolling).toBe(true);
        expect(capabilities.features?.video?.downloadContent).toBe(true);
        expect(capabilities.features?.video?.resultUrlExpires).toBe(true);
        expect(capabilities.features?.video?.inputImageUpload).toBe('base64');
        expect(capabilities.features?.video?.referenceImages).toBe(true);
        expect(capabilities.features?.video?.startFrame).toBe(true);
        expect(capabilities.features?.video?.videoExtension).toBe(true);
        expect(capabilities.features?.video?.videoEdit).toBe(true);
        expect(capabilities.features?.video?.nativeAudio).toBe(true);
        expect(capabilities.features?.video?.negativePrompt).toBe(false);
        expect(capabilities.features?.video?.seed).toBe(false);
        expect(capabilities.features?.video?.batch).toBe(true);
        expect(capabilities.features?.video?.cancel).toBe(true);
    });

    it('detects veo-3.1-generate-001 as video model with correct shape', () => {
        const { capabilities, confidence } = inferModelCatalogCapabilities('veo-3.1-generate-001', 'google-gemini');
        expect(capabilities.tasks).toContain('video.generate');
        expect(capabilities.tasks).toContain('video.imageToVideo');
        expect(capabilities.tasks).toContain('video.extend');
        expect(capabilities.inputModalities).toContain('text');
        expect(capabilities.inputModalities).toContain('image');
        expect(capabilities.outputModalities).toEqual(['video']);
        expect(confidence).toBe('high');
        expect(capabilities.features?.video?.asyncJob).toBe(true);
        expect(capabilities.features?.video?.progressPolling).toBe(true);
        expect(capabilities.features?.video?.downloadContent).toBe(true);
        expect(capabilities.features?.video?.resultUrlExpires).toBe(true);
        expect(capabilities.features?.video?.inputImageUpload).toBe('base64');
        expect(capabilities.features?.video?.referenceImages).toBe(true);
        expect(capabilities.features?.video?.startFrame).toBe(true);
        expect(capabilities.features?.video?.endFrame).toBe(true);
        expect(capabilities.features?.video?.videoExtension).toBe(true);
        expect(capabilities.features?.video?.nativeAudio).toBe(true);
        expect(capabilities.features?.video?.cancel).toBe(true);
    });

    it('detects gen4.5 as Runway video model', () => {
        const { capabilities } = inferModelCatalogCapabilities('gen4.5', 'openai-compatible');
        expect(capabilities.tasks).toContain('video.generate');
        expect(capabilities.tasks).toContain('video.imageToVideo');
        expect(capabilities.features?.video?.asyncJob).toBe(true);
        expect(capabilities.features?.video?.webhooks).toBe(true);
        expect(capabilities.features?.video?.inputImageUpload).toBe('publicUrl');
        expect(capabilities.features?.video?.cancel).toBe(true);
        expect(capabilities.features?.video?.seed).toBe(true);
        expect(capabilities.features?.video?.negativePrompt).toBe(true);
    });

    it('detects ray-2 as Luma video model', () => {
        const { capabilities } = inferModelCatalogCapabilities('ray-2', 'openai-compatible');
        expect(capabilities.tasks).toContain('video.generate');
        expect(capabilities.tasks).toContain('video.imageToVideo');
        expect(capabilities.features?.video?.cameraControl).toBe(true);
        expect(capabilities.features?.video?.startFrame).toBe(true);
        expect(capabilities.features?.video?.endFrame).toBe(true);
    });

    it('detects kling-v3.0-t2v as Kling video model', () => {
        const { capabilities } = inferModelCatalogCapabilities('kling-v3.0-t2v', 'kling');
        expect(capabilities.tasks).toContain('video.generate');
        expect(capabilities.tasks).toContain('video.imageToVideo');
        expect(capabilities.features?.video?.cameraControl).toBe(true);
        expect(capabilities.features?.video?.multiShot).toBe(true);
        expect(capabilities.features?.video?.nativeAudio).toBe(true);
        expect(capabilities.features?.video?.negativePrompt).toBe(true);
    });

    it('detects wan2.6-t2v as Wan video model', () => {
        const { capabilities } = inferModelCatalogCapabilities('wan2.6-t2v', 'openai-compatible');
        expect(capabilities.tasks).toContain('video.generate');
        expect(capabilities.tasks).toContain('video.imageToVideo');
        expect(capabilities.tasks).toContain('video.referenceToVideo');
        expect(capabilities.features?.video?.promptEnhance).toBe(true);
        expect(capabilities.features?.video?.negativePrompt).toBe(true);
        expect(capabilities.features?.video?.seed).toBe(true);
    });

    it('detects happy-horse as video model with edit capability', () => {
        const { capabilities } = inferModelCatalogCapabilities('alibaba/happy-horse', 'fal');
        expect(capabilities.tasks).toContain('video.generate');
        expect(capabilities.tasks).toContain('video.imageToVideo');
        expect(capabilities.tasks).toContain('video.edit');
        expect(capabilities.tasks).toContain('video.referenceToVideo');
        expect(capabilities.features?.video?.videoEdit).toBe(true);
        expect(capabilities.features?.video?.nativeAudio).toBe(true);
    });
});

describe('normalizeCapabilities drops unknown VideoModelFeatures fields', () => {
    it('drops unknown fields from features.video but preserves valid ones', () => {
        const entry: ModelCatalogEntry = catalogEntry(endpointA, 'test-video', {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        inputImageUpload: 'base64',
                        unknownField: 'this should be dropped',
                        anotherUnknown: 123,
                        cancel: true
                    } as unknown as VideoModelFeatures
                }
            },
            capabilityConfidence: 'high'
        });
        const config = normalizeUnifiedProviderModelConfig(
            { providerEndpoints: [endpointA], modelCatalog: [entry], modelTaskDefaultCatalogEntryIds: {} },
            {}
        );
        const normalizedEntry = findModelCatalogEntry(config, { rawModelId: 'test-video' });
        expect(normalizedEntry?.capabilities.features?.video?.asyncJob).toBe(true);
        expect(normalizedEntry?.capabilities.features?.video?.progressPolling).toBe(true);
        expect(normalizedEntry?.capabilities.features?.video?.inputImageUpload).toBe('base64');
        expect(normalizedEntry?.capabilities.features?.video?.cancel).toBe(true);
        expect(
            (normalizedEntry?.capabilities.features?.video as Record<string, unknown>)?.unknownField
        ).toBeUndefined();
        expect(
            (normalizedEntry?.capabilities.features?.video as Record<string, unknown>)?.anotherUnknown
        ).toBeUndefined();
    });

    it('coerces wrong-type fields in VideoModelFeatures to undefined', () => {
        const entry: ModelCatalogEntry = catalogEntry(endpointA, 'type-check', {
            capabilities: {
                tasks: ['video.generate'],
                inputModalities: ['text'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: 'not-a-boolean',
                        seed: 'wrong-type',
                        inputImageUpload: 'invalid-enum-value',
                        cancel: true
                    } as unknown as VideoModelFeatures
                }
            },
            capabilityConfidence: 'high'
        });
        const config = normalizeUnifiedProviderModelConfig(
            { providerEndpoints: [endpointA], modelCatalog: [entry], modelTaskDefaultCatalogEntryIds: {} },
            {}
        );
        const normalizedEntry = findModelCatalogEntry(config, { rawModelId: 'type-check' });
        expect(normalizedEntry?.capabilities.features?.video?.asyncJob).toBe(true);
        expect(normalizedEntry?.capabilities.features?.video?.cancel).toBe(true);
        expect(normalizedEntry?.capabilities.features?.video?.progressPolling).toBeUndefined();
        expect(normalizedEntry?.capabilities.features?.video?.seed).toBeUndefined();
        expect(normalizedEntry?.capabilities.features?.video?.inputImageUpload).toBeUndefined();
    });
});

describe('normalizeModelTaskDefaults drops invalid values', () => {
    it('drops invalid resolutionTier from video defaults', () => {
        const entry: ModelCatalogEntry = catalogEntry(endpointA, 'defaults-test', {
            capabilities: {
                tasks: ['video.generate'],
                inputModalities: ['text'],
                outputModalities: ['video']
            },
            defaults: {
                video: {
                    durationSeconds: 5,
                    resolutionTier: '720p',
                    count: 1,
                    promptEnhanceEnabled: true
                }
            },
            capabilityConfidence: 'high'
        });
        const validConfig = normalizeUnifiedProviderModelConfig(
            { providerEndpoints: [endpointA], modelCatalog: [entry], modelTaskDefaultCatalogEntryIds: {} },
            {}
        );
        const validDefaults = findModelCatalogEntry(validConfig, { rawModelId: 'defaults-test' })?.defaults?.video;
        expect(validDefaults?.durationSeconds).toBe(5);
        expect(validDefaults?.resolutionTier).toBe('720p');
        expect(validDefaults?.count).toBe(1);
        expect(validDefaults?.promptEnhanceEnabled).toBe(true);

        const invalidEntry: ModelCatalogEntry = catalogEntry(endpointA, 'invalid-defaults', {
            capabilities: {
                tasks: ['video.generate'],
                inputModalities: ['text'],
                outputModalities: ['video']
            },
            defaults: {
                video: {
                    durationSeconds: 'not-a-number' as unknown as number,
                    resolutionTier: '999p' as '720p',
                    count: 1,
                    promptEnhanceEnabled: true
                }
            },
            capabilityConfidence: 'high'
        });
        const invalidConfig = normalizeUnifiedProviderModelConfig(
            { providerEndpoints: [endpointA], modelCatalog: [invalidEntry], modelTaskDefaultCatalogEntryIds: {} },
            {}
        );
        const normalizedDefaults = findModelCatalogEntry(invalidConfig, { rawModelId: 'invalid-defaults' })?.defaults
            ?.video;
        expect(normalizedDefaults?.durationSeconds).toBeUndefined();
        expect(normalizedDefaults?.resolutionTier).toBeUndefined();
        expect(normalizedDefaults?.count).toBe(1);
        expect(normalizedDefaults?.promptEnhanceEnabled).toBe(true);
    });
});
