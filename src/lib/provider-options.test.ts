import { isProviderJsonValue, isProviderOptions, mergeProviderOptions, mergeRequestParams, parseProviderOptionsJson } from './provider-options';
import { describe, expect, it } from 'vitest';

describe('parseProviderOptionsJson', () => {
    it('accepts empty custom params as an empty object', () => {
        expect(parseProviderOptionsJson('')).toEqual({ valid: true, value: {} });
        expect(parseProviderOptionsJson(undefined)).toEqual({ valid: true, value: {} });
    });

    it('parses nested JSON object params', () => {
        expect(parseProviderOptionsJson('{"watermark":false,"options":{"max_images":5}}')).toEqual({
            valid: true,
            value: { watermark: false, options: { max_images: 5 } }
        });
    });

    it('rejects non-object JSON values', () => {
        const result = parseProviderOptionsJson('["not", "object"]');
        expect(result.valid).toBe(false);
    });
});

describe('mergeProviderOptions', () => {
    it('lets later sources override earlier defaults', () => {
        expect(
            mergeProviderOptions(
                { response_format: 'url', watermark: true },
                { watermark: false, output_format: 'png' }
            )
        ).toEqual({ response_format: 'url', watermark: false, output_format: 'png' });
    });
});

describe('provider option guards', () => {
    it('accepts nested JSON-compatible values and rejects unsupported runtime values', () => {
        expect(isProviderJsonValue({ watermark: false, nested: [{ max_images: 5 }] })).toBe(true);
        expect(isProviderJsonValue({ broken: undefined })).toBe(false);
        expect(isProviderOptions({ response_format: 'url' })).toBe(true);
        expect(isProviderOptions(['not', 'an', 'object'])).toBe(false);
    });
});

describe('mergeRequestParams', () => {
    it('lets later sources override request defaults and skips undefined values', () => {
        expect(
            mergeRequestParams(
                { size: '2K', n: 1, watermark: true },
                { size: undefined, response_format: 'url' },
                { watermark: false, seed: -1 }
            )
        ).toEqual({ size: '2K', n: 1, watermark: false, response_format: 'url', seed: -1 });
    });
});
