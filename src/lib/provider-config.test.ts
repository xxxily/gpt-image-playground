import { DEFAULT_CONFIG } from './config';
import {
    SEEDREAM_DEFAULT_BASE_URL,
    SENSENOVA_DEFAULT_BASE_URL,
    getProviderConfigFieldNames,
    getProviderCredentialConfig,
    getProviderDefaultBaseUrl
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
            providerLabel: 'Seedream'
        });
    });
});
