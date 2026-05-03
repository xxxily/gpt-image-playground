import { DEFAULT_CONFIG } from './config';
import {
    buildPromptOnlyUrlParams,
    buildSharedConfigUpdates,
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
});

describe('buildPromptOnlyUrlParams', () => {
    it('keeps prompt text while dropping shared config and autostart', () => {
        expect(
            buildPromptOnlyUrlParams({
                prompt: 'draw a moonlit cat',
                apiKey: 'sk-123',
                baseUrl: 'https://api.example.com',
                model: 'gpt-image-2',
                autostart: true
            })
        ).toEqual({ prompt: 'draw a moonlit cat' });
    });

    it('returns an empty object when no prompt was shared', () => {
        expect(buildPromptOnlyUrlParams({ apiKey: 'sk-123', model: 'gpt-image-2' })).toEqual({});
    });
});

describe('buildSharedConfigUpdates', () => {
    it('maps OpenAI shared config and forces direct mode for third-party URLs when relay is disabled', () => {
        expect(
            buildSharedConfigUpdates(
                {
                    apiKey: 'sk-shared-openai-key',
                    baseUrl: 'https://relay.example.com/v1',
                    model: 'gpt-image-2'
                },
                DEFAULT_CONFIG,
                { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
            )
        ).toEqual({
            openaiApiKey: 'sk-shared-openai-key',
            openaiApiBaseUrl: 'https://relay.example.com/v1',
            connectionMode: 'direct'
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
        ).toEqual({
            openaiApiKey: 'sk-shared-openai-key',
            openaiApiBaseUrl: 'https://api.openai.com/v1'
        });
    });

    it('maps Gemini shared config to Gemini settings and direct mode independently of OpenAI settings', () => {
        expect(
            buildSharedConfigUpdates(
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
            )
        ).toEqual({
            geminiApiKey: 'gemini-shared-key',
            geminiApiBaseUrl: 'https://gemini-relay.example.com/v1beta',
            connectionMode: 'direct'
        });
    });

    it('registers unknown shared models without losing provider detection', () => {
        expect(
            buildSharedConfigUpdates(
                {
                    apiKey: 'sk-custom-key',
                    baseUrl: 'https://custom-openai.example.com/v1',
                    model: 'my-custom-image-model'
                },
                DEFAULT_CONFIG,
                { clientDirectLinkPriority: true, modelFallback: 'gpt-image-2' }
            )
        ).toEqual({
            openaiApiKey: 'sk-custom-key',
            openaiApiBaseUrl: 'https://custom-openai.example.com/v1',
            customImageModels: [{ id: 'my-custom-image-model', provider: 'openai' }],
            connectionMode: 'direct'
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
