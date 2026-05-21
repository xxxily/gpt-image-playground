import { DEFAULT_CONFIG } from './config';
import {
    buildPromptOnlyUrlParams,
    buildSharedConfigUpdates,
    hasMatchingStoredSharedConfig,
    maskSharedSecret,
    resolveClientDirectLinkConnectionMode,
    shouldPromptForConfigPersistence
} from './shared-config';
import { describe, expect, it } from 'vitest';

describe('shouldPromptForConfigPersistence', () => {
    it('requires apiKey, baseUrl, and model to all be present', () => {
        expect(
            shouldPromptForConfigPersistence({
                apiKey: 'sk-123',
                baseUrl: 'https://api.example.com',
                model: 'gpt-image-2'
            })
        ).toBe(true);

        expect(shouldPromptForConfigPersistence({ apiKey: 'sk-123', baseUrl: 'https://api.example.com' })).toBe(false);
        expect(shouldPromptForConfigPersistence({ apiKey: 'sk-123', model: 'gpt-image-2' })).toBe(false);
        expect(shouldPromptForConfigPersistence({ baseUrl: 'https://api.example.com', model: 'gpt-image-2' })).toBe(
            false
        );
    });

    it('does not prompt for empty configuration values', () => {
        expect(
            shouldPromptForConfigPersistence({
                apiKey: ' ',
                baseUrl: 'https://api.example.com',
                model: 'gpt-image-2'
            })
        ).toBe(false);
        expect(
            shouldPromptForConfigPersistence({
                apiKey: 'sk-123',
                baseUrl: '',
                model: 'gpt-image-2'
            })
        ).toBe(false);
        expect(
            shouldPromptForConfigPersistence({
                apiKey: 'sk-123',
                baseUrl: 'https://api.example.com',
                model: '   '
            })
        ).toBe(false);
    });

    it('skips persistence prompts for temp-only API key shares', () => {
        expect(
            shouldPromptForConfigPersistence({
                apiKey: 'sk-123',
                apiKeyTempOnly: true,
                baseUrl: 'https://api.example.com',
                model: 'gpt-image-2'
            })
        ).toBe(false);
    });
});

describe('hasMatchingStoredSharedConfig', () => {
    it('matches saved OpenAI config after trimming shared and stored values', () => {
        expect(
            hasMatchingStoredSharedConfig(
                {
                    apiKey: ' sk-saved ',
                    baseUrl: ' https://relay.example.com/v1 ',
                    model: 'gpt-image-2'
                },
                {
                    ...DEFAULT_CONFIG,
                    openaiApiKey: 'sk-saved',
                    openaiApiBaseUrl: 'https://relay.example.com/v1'
                }
            )
        ).toBe(true);
    });

    it('matches any stored provider instance with the same shared endpoint and key', () => {
        expect(
            hasMatchingStoredSharedConfig(
                {
                    apiKey: 'relay-key',
                    baseUrl: 'https://relay.example.com/v1',
                    model: 'gpt-image-2'
                },
                {
                    ...DEFAULT_CONFIG,
                    providerInstances: [
                        ...DEFAULT_CONFIG.providerInstances,
                        {
                            id: 'openai:relay',
                            type: 'openai',
                            name: 'relay.example.com',
                            apiKey: 'relay-key',
                            apiBaseUrl: 'https://relay.example.com/v1',
                            models: []
                        }
                    ]
                }
            )
        ).toBe(true);
    });

    it('matches stored endpoint credentials even when the shared instance id differs', () => {
        expect(
            hasMatchingStoredSharedConfig(
                {
                    apiKey: 'relay-key',
                    baseUrl: 'https://relay.example.com/v1',
                    model: 'gpt-image-2',
                    providerInstanceId: 'openai:sender-relay'
                },
                {
                    ...DEFAULT_CONFIG,
                    providerInstances: [
                        ...DEFAULT_CONFIG.providerInstances,
                        {
                            id: 'openai:local-relay',
                            type: 'openai',
                            name: 'relay.example.com',
                            apiKey: 'relay-key',
                            apiBaseUrl: 'https://relay.example.com/v1',
                            models: []
                        }
                    ]
                }
            )
        ).toBe(true);
    });

    it('matches the provider implied by the shared model', () => {
        expect(
            hasMatchingStoredSharedConfig(
                {
                    apiKey: 'gemini-saved-key',
                    baseUrl: 'https://gemini-relay.example.com/v1beta',
                    model: 'gemini-3.1-flash-image-preview'
                },
                {
                    ...DEFAULT_CONFIG,
                    openaiApiKey: 'different-openai-key',
                    openaiApiBaseUrl: 'https://different-openai.example.com/v1',
                    geminiApiKey: 'gemini-saved-key',
                    geminiApiBaseUrl: 'https://gemini-relay.example.com/v1beta'
                }
            )
        ).toBe(true);
    });

    it('does not match when the saved provider config differs', () => {
        expect(
            hasMatchingStoredSharedConfig(
                {
                    apiKey: 'sk-shared',
                    baseUrl: 'https://relay.example.com/v1',
                    model: 'gpt-image-2'
                },
                {
                    ...DEFAULT_CONFIG,
                    openaiApiKey: 'sk-saved',
                    openaiApiBaseUrl: 'https://relay.example.com/v1'
                }
            )
        ).toBe(false);
    });

    it('matches saved credentials on the shared provider instance', () => {
        expect(
            hasMatchingStoredSharedConfig(
                {
                    apiKey: 'relay-key',
                    baseUrl: 'https://relay.example.com',
                    model: 'gpt-image-2',
                    providerInstanceId: 'openai:relay'
                },
                {
                    ...DEFAULT_CONFIG,
                    providerInstances: [
                        ...DEFAULT_CONFIG.providerInstances,
                        {
                            id: 'openai:relay',
                            type: 'openai',
                            name: 'relay.example.com',
                            apiKey: 'relay-key',
                            apiBaseUrl: 'https://relay.example.com/v1',
                            models: []
                        }
                    ]
                }
            )
        ).toBe(true);
    });

    it('does not match a fresh local config with unsaved shared values', () => {
        expect(
            hasMatchingStoredSharedConfig(
                {
                    apiKey: 'sk-shared',
                    baseUrl: 'https://relay.example.com/v1',
                    model: 'gpt-image-2'
                },
                DEFAULT_CONFIG
            )
        ).toBe(false);
    });

    it('does not match incomplete shared config', () => {
        expect(
            hasMatchingStoredSharedConfig(
                {
                    apiKey: 'sk-saved',
                    baseUrl: 'https://relay.example.com/v1'
                },
                {
                    ...DEFAULT_CONFIG,
                    openaiApiKey: 'sk-saved',
                    openaiApiBaseUrl: 'https://relay.example.com/v1'
                }
            )
        ).toBe(false);
    });
});

describe('buildPromptOnlyUrlParams', () => {
    it('keeps prompt text while dropping shared config and autostart', () => {
        expect(
            buildPromptOnlyUrlParams({
                prompt: 'draw a moonlit cat',
                promoProfileId: 'promo-profile-1',
                apiKey: 'sk-123',
                baseUrl: 'https://api.example.com',
                model: 'gpt-image-2',
                autostart: true
            })
        ).toEqual({ prompt: 'draw a moonlit cat', promoProfileId: 'promo-profile-1' });
    });

    it('returns an empty object when no prompt was shared', () => {
        expect(buildPromptOnlyUrlParams({ apiKey: 'sk-123', model: 'gpt-image-2' })).toEqual({});
    });
});

describe('buildSharedConfigUpdates', () => {
    it('creates and selects a new provider instance for a shared OpenAI relay endpoint', () => {
        const updates = buildSharedConfigUpdates(
            {
                apiKey: 'sk-shared-openai-key',
                baseUrl: 'https://relay.example.com/v1',
                model: 'gpt-image-2'
            },
            DEFAULT_CONFIG,
            { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
        );

        const sharedInstance = updates.providerInstances?.find(
            (instance) =>
                instance.type === 'openai' &&
                instance.apiKey === 'sk-shared-openai-key' &&
                instance.apiBaseUrl === 'https://relay.example.com/v1'
        );

        expect(sharedInstance).toMatchObject({
            name: 'relay.example.com',
            models: ['gpt-image-2']
        });
        expect(updates.selectedProviderInstanceId).toBe(sharedInstance?.id);
        expect(updates).toMatchObject({
            connectionMode: 'direct'
        });
        expect(updates).not.toHaveProperty('openaiApiKey');
        expect(updates).not.toHaveProperty('openaiApiBaseUrl');
        expect(updates.providerInstances?.find((instance) => instance.id === 'openai:default')).toMatchObject({
            apiKey: '',
            apiBaseUrl: ''
        });
    });

    it('keeps proxy mode unchanged for official OpenAI URLs', () => {
        expect(
            buildSharedConfigUpdates(
                {
                    apiKey: 'sk-shared-openai-key',
                    baseUrl: 'https://api.openai.com/v1',
                    model: 'gpt-image-2'
                },
                DEFAULT_CONFIG,
                { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
            )
        ).toMatchObject({
            selectedProviderInstanceId: 'openai:default',
            openaiApiKey: 'sk-shared-openai-key',
            openaiApiBaseUrl: 'https://api.openai.com/v1'
        });
    });

    it('updates the matching provider instance when the shared base URL already exists', () => {
        const updates = buildSharedConfigUpdates(
            {
                apiKey: 'relay-updated-key',
                baseUrl: 'https://relay.example.com/v1',
                model: 'gpt-image-2'
            },
            {
                ...DEFAULT_CONFIG,
                providerInstances: [
                    ...DEFAULT_CONFIG.providerInstances,
                    {
                        id: 'openai:relay',
                        type: 'openai',
                        name: 'relay.example.com',
                        apiKey: 'relay-original-key',
                        apiBaseUrl: 'https://relay.example.com/v1',
                        models: ['gpt-image-2']
                    }
                ]
            },
            { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
        );

        expect(updates.selectedProviderInstanceId).toBe('openai:relay');
        expect(updates.providerInstances?.find((instance) => instance.id === 'openai:relay')).toMatchObject({
            apiKey: 'relay-updated-key',
            apiBaseUrl: 'https://relay.example.com/v1',
            models: ['gpt-image-2']
        });
        expect(updates).not.toHaveProperty('openaiApiKey');
        expect(updates).not.toHaveProperty('openaiApiBaseUrl');
    });

    it('creates a Gemini provider instance without overwriting OpenAI settings', () => {
        const updates = buildSharedConfigUpdates(
            {
                apiKey: 'gemini-shared-key',
                baseUrl: 'https://gemini-relay.example.com/v1beta',
                model: 'gemini-3.1-flash-image-preview'
            },
            {
                ...DEFAULT_CONFIG,
                openaiApiKey: 'sk-existing-openai-key',
                openaiApiBaseUrl: 'https://api.openai.com/v1'
            },
            { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
        );

        const sharedInstance = updates.providerInstances?.find(
            (instance) =>
                instance.type === 'google' &&
                instance.apiKey === 'gemini-shared-key' &&
                instance.apiBaseUrl === 'https://gemini-relay.example.com/v1beta'
        );

        expect(sharedInstance).toMatchObject({
            name: 'gemini-relay.example.com',
            models: ['gemini-3.1-flash-image-preview']
        });
        expect(updates).toMatchObject({
            selectedProviderInstanceId: sharedInstance?.id,
            connectionMode: 'direct'
        });
        expect(updates).not.toHaveProperty('geminiApiKey');
        expect(updates).not.toHaveProperty('geminiApiBaseUrl');
    });

    it('registers unknown shared models without losing provider detection', () => {
        const updates = buildSharedConfigUpdates(
            {
                apiKey: 'sk-custom-key',
                baseUrl: 'https://custom-openai.example.com/v1',
                model: 'my-custom-image-model'
            },
            DEFAULT_CONFIG,
            { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
        );

        const sharedInstance = updates.providerInstances?.find(
            (instance) =>
                instance.type === 'openai' &&
                instance.apiKey === 'sk-custom-key' &&
                instance.apiBaseUrl === 'https://custom-openai.example.com/v1'
        );

        expect(sharedInstance).toMatchObject({
            name: 'custom-openai.example.com',
            models: ['my-custom-image-model']
        });
        expect(updates).toMatchObject({
            selectedProviderInstanceId: sharedInstance?.id,
            customImageModels: [
                {
                    id: 'my-custom-image-model',
                    provider: 'openai',
                    instanceId: sharedInstance?.id
                }
            ],
            connectionMode: 'direct'
        });
        expect(updates).not.toHaveProperty('openaiApiKey');
        expect(updates).not.toHaveProperty('openaiApiBaseUrl');
    });

    it('selects and updates the shared provider instance when present', () => {
        const updates = buildSharedConfigUpdates(
            {
                apiKey: 'relay-key',
                baseUrl: 'https://relay.example.com',
                model: 'gpt-image-2',
                providerInstanceId: 'openai:relay'
            },
            {
                ...DEFAULT_CONFIG,
                providerInstances: [
                    ...DEFAULT_CONFIG.providerInstances,
                    {
                        id: 'openai:relay',
                        type: 'openai',
                        name: 'relay.example.com',
                        apiKey: '',
                        apiBaseUrl: '',
                        models: []
                    }
                ]
            },
            { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
        );

        expect(updates).toMatchObject({
            selectedProviderInstanceId: 'openai:relay',
            connectionMode: 'direct'
        });
        expect(updates).not.toHaveProperty('openaiApiKey');
        expect(updates).not.toHaveProperty('openaiApiBaseUrl');
        expect(updates.providerInstances?.find((instance) => instance.id === 'openai:relay')).toMatchObject({
            apiKey: 'relay-key',
            apiBaseUrl: 'https://relay.example.com',
            models: ['gpt-image-2']
        });
        expect(updates.providerEndpoints?.find((endpoint) => endpoint.id === 'openai:relay')).toMatchObject({
            apiKey: 'relay-key',
            apiBaseUrl: 'https://relay.example.com'
        });
    });

    it('updates the selected provider instance for API-key-only shares', () => {
        const updates = buildSharedConfigUpdates(
            {
                apiKey: 'relay-updated-key',
                model: 'gpt-image-2'
            },
            {
                ...DEFAULT_CONFIG,
                selectedProviderInstanceId: 'openai:relay',
                providerInstances: [
                    ...DEFAULT_CONFIG.providerInstances,
                    {
                        id: 'openai:relay',
                        type: 'openai',
                        name: 'relay.example.com',
                        apiKey: 'relay-original-key',
                        apiBaseUrl: 'https://relay.example.com/v1',
                        models: ['gpt-image-2']
                    }
                ]
            },
            { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
        );

        expect(updates).toMatchObject({
            selectedProviderInstanceId: 'openai:relay',
            connectionMode: 'direct'
        });
        expect(updates.providerInstances?.some((instance) => instance.id === 'openai:openai')).toBe(false);
        expect(updates.providerInstances?.find((instance) => instance.id === 'openai:relay')).toMatchObject({
            apiKey: 'relay-updated-key',
            apiBaseUrl: 'https://relay.example.com/v1',
            models: ['gpt-image-2']
        });
        expect(updates).not.toHaveProperty('openaiApiKey');
        expect(updates).not.toHaveProperty('openaiApiBaseUrl');
    });

    it('maps SenseNova shared config to SenseNova settings', () => {
        expect(
            buildSharedConfigUpdates(
                {
                    apiKey: 'sense-key',
                    baseUrl: 'https://token.sensenova.cn/v1',
                    model: 'sensenova-u1-fast'
                },
                DEFAULT_CONFIG,
                { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
            )
        ).toMatchObject({
            sensenovaApiKey: 'sense-key',
            sensenovaApiBaseUrl: 'https://token.sensenova.cn/v1'
        });
    });

    it('maps Seedream shared config to Seedream settings', () => {
        expect(
            buildSharedConfigUpdates(
                {
                    apiKey: 'seed-key',
                    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
                    model: 'doubao-seedream-5.0-lite'
                },
                DEFAULT_CONFIG,
                { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
            )
        ).toMatchObject({
            seedreamApiKey: 'seed-key',
            seedreamApiBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
        });
    });
});

describe('resolveClientDirectLinkConnectionMode', () => {
    it('forces direct mode from the effective OpenAI Base URL at submit time', () => {
        expect(
            resolveClientDirectLinkConnectionMode(
                {
                    ...DEFAULT_CONFIG,
                    connectionMode: 'proxy',
                    openaiApiBaseUrl: 'https://relay.example.com/v1'
                },
                { clientDirectLinkPriority: true, model: 'gpt-image-2' }
            )
        ).toBe('direct');
    });

    it('keeps proxy mode for official OpenAI URLs at submit time', () => {
        expect(
            resolveClientDirectLinkConnectionMode(
                {
                    ...DEFAULT_CONFIG,
                    connectionMode: 'proxy',
                    openaiApiBaseUrl: 'https://api.openai.com/v1'
                },
                { clientDirectLinkPriority: true, model: 'gpt-image-2' }
            )
        ).toBe('proxy');
    });

    it('uses the submitted model provider when forcing Gemini direct mode', () => {
        expect(
            resolveClientDirectLinkConnectionMode(
                {
                    ...DEFAULT_CONFIG,
                    connectionMode: 'proxy',
                    openaiApiBaseUrl: 'https://api.openai.com/v1',
                    geminiApiBaseUrl: 'https://gemini-relay.example.com/v1beta'
                },
                { clientDirectLinkPriority: true, model: 'gemini-3.1-flash-image-preview' }
            )
        ).toBe('direct');
    });
});

describe('maskSharedSecret', () => {
    it('masks long secrets without exposing the full value', () => {
        expect(maskSharedSecret('sk-abcdef123456')).toBe('sk-a…3456');
    });

    it('does not echo short secrets', () => {
        expect(maskSharedSecret('sk-1')).toBe('已提供');
    });
});
