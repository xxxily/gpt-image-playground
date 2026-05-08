import { DEFAULT_CONFIG } from './config';
import {
    SEEDREAM_DEFAULT_BASE_URL,
    SENSENOVA_DEFAULT_BASE_URL,
    getProviderConfigFieldNames,
    getProviderCredentialConfig,
    getProviderDefaultBaseUrl,
    normalizeOpenAICompatibleBaseUrl
} from './provider-config';
import { describe, expect, it } from 'vitest';

describe('provider credential config', () => {
    it('maps every image provider to its dedicated config fields', () => {
        expect(getProviderConfigFieldNames('openai')).toEqual({ apiKey: 'openaiApiKey', apiBaseUrl: 'openaiApiBaseUrl' });
        expect(getProviderConfigFieldNames('google')).toEqual({ apiKey: 'geminiApiKey', apiBaseUrl: 'geminiApiBaseUrl' });
        expect(getProviderConfigFieldNames('sensenova')).toEqual({ apiKey: 'sensenovaApiKey', apiBaseUrl: 'sensenovaApiBaseUrl' });
        expect(getProviderConfigFieldNames('seedream')).toEqual({ apiKey: 'seedreamApiKey', apiBaseUrl: 'seedreamApiBaseUrl' });
    });

    it('returns provider-specific default API base URLs', () => {
        expect(getProviderDefaultBaseUrl('sensenova')).toBe(SENSENOVA_DEFAULT_BASE_URL);
        expect(getProviderDefaultBaseUrl('seedream')).toBe(SEEDREAM_DEFAULT_BASE_URL);
        expect(getProviderDefaultBaseUrl('google')).toContain('generativelanguage.googleapis.com');
        expect(getProviderDefaultBaseUrl('openai')).toBe('https://api.openai.com/v1');
    });

    it('normalizes OpenAI-compatible base URLs from common user input forms', () => {
        expect(normalizeOpenAICompatibleBaseUrl('api.example.com')).toBe('https://api.example.com/v1');
        expect(normalizeOpenAICompatibleBaseUrl('api.example.com/')).toBe('https://api.example.com/v1');
        expect(normalizeOpenAICompatibleBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
        expect(normalizeOpenAICompatibleBaseUrl('http://localhost:11434/')).toBe('http://localhost:11434/v1');
        expect(normalizeOpenAICompatibleBaseUrl('https://api.example.com/custom/')).toBe('https://api.example.com/custom');
        expect(normalizeOpenAICompatibleBaseUrl('https://api.example.com/v1?tenant=a#hash')).toBe('https://api.example.com/v1');
        expect(normalizeOpenAICompatibleBaseUrl('   ')).toBe('');
    });

    it('extracts credentials for the selected provider only', () => {
        expect(
            getProviderCredentialConfig(
                {
                    ...DEFAULT_CONFIG,
                    seedreamApiKey: 'seedream-key',
                    seedreamApiBaseUrl: 'https://seedream.example/v3',
                    openaiApiKey: 'openai-key'
                },
                'seedream'
            )
        ).toEqual({
            apiKey: 'seedream-key',
            apiBaseUrl: 'https://seedream.example/v3',
            providerLabel: 'Seedream',
            providerInstanceId: 'seedream:default',
            providerInstanceName: 'Seedream'
        });
    });

    it('resolves credentials from a named provider instance before legacy fields', () => {
        expect(
            getProviderCredentialConfig(
                {
                    ...DEFAULT_CONFIG,
                    openaiApiKey: 'legacy-key',
                    openaiApiBaseUrl: 'https://api.openai.com/v1',
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
                },
                'openai',
                'openai:relay'
            )
        ).toMatchObject({
            apiKey: 'relay-key',
            apiBaseUrl: 'https://relay.example.com/v1',
            providerInstanceId: 'openai:relay',
            providerInstanceName: 'relay.example.com'
        });
    });

    it('normalizes OpenAI-compatible instance base URLs when resolving credentials', () => {
        expect(
            getProviderCredentialConfig(
                {
                    ...DEFAULT_CONFIG,
                    providerInstances: [
                        ...DEFAULT_CONFIG.providerInstances,
                        {
                            id: 'openai:relay-domain-only',
                            type: 'openai',
                            name: 'relay.example.com',
                            apiKey: 'relay-key',
                            apiBaseUrl: 'relay.example.com/',
                            models: []
                        }
                    ]
                },
                'openai',
                'openai:relay-domain-only'
            )
        ).toMatchObject({
            apiBaseUrl: 'https://relay.example.com/v1'
        });
    });

    it('does not apply OpenAI /v1 normalization to non-OpenAI providers', () => {
        expect(
            getProviderCredentialConfig(
                {
                    ...DEFAULT_CONFIG,
                    seedreamApiBaseUrl: 'https://ark.example.com/api/v3/'
                },
                'seedream'
            ).apiBaseUrl
        ).toBe('https://ark.example.com/api/v3/');
    });
});
