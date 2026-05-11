import { SEEDREAM_5_LITE_MODEL, SENSENOVA_U1_FAST_MODEL, type StoredCustomImageModel } from './model-registry';
import {
    GPT_IMAGE_2_SIZE_PRESETS,
    getGptImage2SizePresetByTierAndRatio,
    getPresetDimensions,
    getPresetTooltip,
    resolveImageRequestSize,
    validateGptImage2Size
} from './size-utils';
import { describe, expect, it } from 'vitest';

describe('getPresetDimensions', () => {
    it('uses built-in provider-specific size presets', () => {
        expect(getPresetDimensions('landscape', SENSENOVA_U1_FAST_MODEL)).toBe('2752x1536');
        expect(getPresetDimensions('portrait', SENSENOVA_U1_FAST_MODEL)).toBe('1536x2752');
    });

    it('uses custom model size presets when configured', () => {
        const customModels: StoredCustomImageModel[] = [
            {
                id: 'custom-infographic-model',
                provider: 'openai',
                capabilities: { supportsCustomSize: true },
                sizePresets: { landscape: '2304x1296' }
            }
        ];

        expect(getPresetDimensions('landscape', 'custom-infographic-model', customModels)).toBe('2304x1296');
        expect(getPresetTooltip('landscape', 'custom-infographic-model', customModels)).toContain('2304 × 1296');
    });
});

describe('resolveImageRequestSize', () => {
    it('uses model default size when auto is selected for providers with fixed defaults', () => {
        expect(resolveImageRequestSize('auto', SENSENOVA_U1_FAST_MODEL, 1024, 1024)).toBe('2752x1536');
        expect(resolveImageRequestSize('auto', SEEDREAM_5_LITE_MODEL, 1024, 1024)).toBe('2K');
    });

    it('keeps auto for OpenAI models without provider defaults', () => {
        expect(resolveImageRequestSize('auto', 'gpt-image-2', 1024, 1024)).toBe('auto');
    });

    it('converts custom dimensions into WxH request values', () => {
        expect(resolveImageRequestSize('custom', 'gpt-image-2', 1536, 1024)).toBe('1536x1024');
    });

    it('passes concrete OpenAI resolution presets through unchanged', () => {
        expect(resolveImageRequestSize('3840x2160', 'gpt-image-2', 1024, 1024)).toBe('3840x2160');
    });
});

describe('validateGptImage2Size', () => {
    it('accepts valid dimensions at expected constraints', () => {
        expect(validateGptImage2Size(1024, 1024)).toEqual({ valid: true });
        expect(validateGptImage2Size(3072, 1024)).toEqual({ valid: true });
    });

    it('rejects invalid GPT image custom sizes with actionable reasons', () => {
        expect(validateGptImage2Size(100, 100)).toMatchObject({ valid: false });
        expect(validateGptImage2Size(4000, 1000)).toMatchObject({ valid: false });
        expect(validateGptImage2Size(1025, 1024)).toMatchObject({ valid: false });
    });
});

describe('GPT image 2 size presets', () => {
    it('keeps every preset inside OpenAI size constraints', () => {
        for (const preset of GPT_IMAGE_2_SIZE_PRESETS) {
            expect(validateGptImage2Size(preset.width, preset.height), preset.value).toEqual({ valid: true });
        }
    });

    it('uses OpenAI-safe 4K presets for wide and square ratios', () => {
        expect(getGptImage2SizePresetByTierAndRatio('4K', '16:9').value).toBe('3840x2160');
        expect(getGptImage2SizePresetByTierAndRatio('4K', '1:1').value).toBe('2880x2880');
    });
});
