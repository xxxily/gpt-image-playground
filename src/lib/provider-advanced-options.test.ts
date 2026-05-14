import { SEEDREAM_5_LITE_MODEL } from './model-registry';
import {
    DEFAULT_SEEDREAM_ADVANCED_OPTIONS,
    GEMINI_SIZE_OPTIONS,
    buildSeedreamProviderOptions,
    getSeedreamCapabilityFlags,
    getSeedreamSizeOptions,
    SENSENOVA_SIZE_OPTIONS
} from './provider-advanced-options';
import { describe, expect, it } from 'vitest';

describe('provider advanced option metadata', () => {
    it('exposes documented SenseNova 2K sizes as first-class choices', () => {
        expect(SENSENOVA_SIZE_OPTIONS.map((option) => option.value)).toContain('2752x1536');
        expect(SENSENOVA_SIZE_OPTIONS.map((option) => option.value)).toContain('3072x1376');
        expect(SENSENOVA_SIZE_OPTIONS.find((option) => option.value === '2752x1536')).toMatchObject({
            tier: '2K',
            ratio: '16:9'
        });
    });

    it('exposes Gemini documented size tiers and aspect ratios', () => {
        expect(GEMINI_SIZE_OPTIONS).toHaveLength(56);
        expect(GEMINI_SIZE_OPTIONS.map((option) => option.value)).toEqual(
            expect.arrayContaining(['512x512', '1024x1024', '1536x12288', '3392x5056', '6336x2688'])
        );
        expect(GEMINI_SIZE_OPTIONS.find((option) => option.value === '6336x2688')).toMatchObject({
            tier: '4K',
            ratio: '21:9'
        });
        expect(GEMINI_SIZE_OPTIONS.find((option) => option.value === '512x512')).toMatchObject({
            tier: '512',
            ratio: '1:1'
        });
    });

    it('returns Seedream size choices matched to model generation rules', () => {
        expect(getSeedreamSizeOptions(SEEDREAM_5_LITE_MODEL).map((option) => option.value)).toEqual(
            expect.arrayContaining(['2048x2048', '3072x3072', '4096x4096', '4096x2304'])
        );
        expect(getSeedreamSizeOptions(SEEDREAM_5_LITE_MODEL).map((option) => option.value)).not.toContain('2K');
        expect(getSeedreamSizeOptions('doubao-seedream-3.0-t2i').map((option) => option.value)).not.toContain('2K');
        expect(getSeedreamSizeOptions('doubao-seedream-3.0-t2i').find((option) => option.value === '1024x1024'))
            .toMatchObject({
                tier: '1K',
                ratio: '1:1'
            });
    });

    it('models Seedream feature availability by model version', () => {
        expect(getSeedreamCapabilityFlags(SEEDREAM_5_LITE_MODEL)).toMatchObject({
            supportsSequentialGeneration: true,
            supportsOutputFormat: true,
            supportsWebSearch: true,
            supportsSeed: false
        });
        expect(getSeedreamCapabilityFlags('doubao-seedream-3.0-t2i')).toMatchObject({
            supportsSequentialGeneration: false,
            supportsOutputFormat: false,
            supportsSeed: true,
            supportsGuidanceScale: true
        });
    });

    it('builds common Seedream request params from structured controls', () => {
        expect(
            buildSeedreamProviderOptions(SEEDREAM_5_LITE_MODEL, {
                ...DEFAULT_SEEDREAM_ADVANCED_OPTIONS,
                size: '3K',
                responseFormat: 'b64_json',
                watermark: true,
                sequentialImageGeneration: 'auto',
                maxImages: 99,
                outputFormat: 'png',
                optimizePromptMode: 'standard',
                webSearch: true
            })
        ).toEqual({
            size: '3K',
            response_format: 'b64_json',
            watermark: true,
            sequential_image_generation: 'auto',
            sequential_image_generation_options: { max_images: 15 },
            output_format: 'png',
            optimize_prompt_options: { mode: 'standard' },
            tools: [{ type: 'web_search' }]
        });
    });

    it('builds Seedream 3.0 seed and guidance controls only for that model', () => {
        expect(
            buildSeedreamProviderOptions('doubao-seedream-3.0-t2i', {
                ...DEFAULT_SEEDREAM_ADVANCED_OPTIONS,
                seed: 2_147_483_700,
                guidanceScale: 20,
                sequentialImageGeneration: 'auto',
                maxImages: 8,
                outputFormat: 'png',
                webSearch: true
            })
        ).toEqual({
            response_format: 'url',
            watermark: false,
            seed: 2_147_483_647,
            guidance_scale: 10
        });
    });
});
