import { buildPromptOnlyUrlParams, maskSharedSecret, shouldPromptForConfigPersistence } from './shared-config';
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

describe('maskSharedSecret', () => {
    it('masks long secrets without exposing the full value', () => {
        expect(maskSharedSecret('sk-abcdef123456')).toBe('sk-a…3456');
    });

    it('does not echo short secrets', () => {
        expect(maskSharedSecret('sk-1')).toBe('已提供');
    });
});
