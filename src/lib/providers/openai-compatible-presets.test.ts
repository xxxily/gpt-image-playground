import { describe, expect, it } from 'vitest';
import {
    SEEDREAM_PROVIDER_DEFAULTS,
    SENSENOVA_PROVIDER_DEFAULTS,
    getOpenAICompatibleProviderDefaults
} from './openai-compatible-presets';

describe('OpenAI-compatible provider presets', () => {
    it('returns only SenseNova and Seedream as OpenAI-compatible non-OpenAI presets', () => {
        expect(getOpenAICompatibleProviderDefaults('sensenova')).toBe(SENSENOVA_PROVIDER_DEFAULTS);
        expect(getOpenAICompatibleProviderDefaults('seedream')).toBe(SEEDREAM_PROVIDER_DEFAULTS);
        expect(getOpenAICompatibleProviderDefaults('openai')).toBeNull();
        expect(getOpenAICompatibleProviderDefaults('google')).toBeNull();
    });

    it('keeps Seedream provider defaults provider-native instead of OpenAI image params', () => {
        expect(SEEDREAM_PROVIDER_DEFAULTS.defaultGenerateParams).toEqual({
            size: '2K',
            response_format: 'url',
            watermark: false
        });
        expect(SEEDREAM_PROVIDER_DEFAULTS.defaultEditParams).toEqual({
            size: '2K',
            response_format: 'url',
            watermark: false
        });
        expect(SEEDREAM_PROVIDER_DEFAULTS.editRequestMode).toBe('generations-json');
        expect(SEEDREAM_PROVIDER_DEFAULTS.defaultOutputFormat).toBe('jpeg');
    });

    it('keeps SenseNova on the default multipart edit path because editing is not enabled', () => {
        expect(SENSENOVA_PROVIDER_DEFAULTS.editRequestMode).toBeUndefined();
    });
});
