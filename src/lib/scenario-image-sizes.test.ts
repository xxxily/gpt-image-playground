import { GEMINI_NANO_BANANA_2_MODEL } from '@/lib/model-registry';
import { GEMINI_SIZE_OPTIONS } from '@/lib/provider-advanced-options';
import {
    SCENARIO_IMAGE_SIZE_SOURCES,
    getScenarioSizeAdapter,
    getScenarioSizeOptions,
    getGptImage2ScenarioSizeDescriptor,
    getGptImage2ScenarioSizeVariant,
    getScenarioRatioOptionsWithSwap,
    isScenarioSizeSupportedValue
} from '@/lib/scenario-image-sizes';
import { validateGptImage2Size } from '@/lib/size-utils';
import { describe, expect, it } from 'vitest';

describe('scenario image size sources', () => {
    it('keeps scenario data model-agnostic and uniquely keyed', () => {
        const ids = new Set<string>();
        for (const source of SCENARIO_IMAGE_SIZE_SOURCES) {
            expect(ids.has(source.id), source.id).toBe(false);
            ids.add(source.id);
            expect(source.title['zh-CN']).toBeTruthy();
            expect(source.title['en-US']).toBeTruthy();
            expect(source.ratio).toBeGreaterThan(0);
            expect(source.platforms.length, source.id).toBeGreaterThan(0);
            expect(source.confidence, source.id).toMatch(/^(official|officialAds|platformPractice|industryStandard|practical)$/u);
            expect(JSON.stringify(source)).not.toContain('gptImage2');
            expect(JSON.stringify(source)).not.toContain('geminiSize');
        }
    });
});

describe('gpt-image-2 scenario size adapter', () => {
    it('returns valid custom pixel sizes for all available scenario candidates', () => {
        const options = getScenarioSizeOptions('gpt-image-2', [], { preferredTier: '2K' });

        expect(options.length).toBeGreaterThan(15);
        for (const option of options) {
            expect(option.valid, option.source.id).toBe(true);
            expect(validateGptImage2Size(option.width, option.height), option.modelSize).toEqual({ valid: true });
        }
    });

    it('maps common social scenarios to expected aspect families', () => {
        const options = getScenarioSizeOptions('gpt-image-2', [], { preferredTier: '2K' });
        const xhs = options.find((option) => option.source.id === 'xiaohongshu-cover');
        const og = options.find((option) => option.source.id === 'open-graph-share');

        expect(xhs?.modelSize).toBe('1536x2048');
        expect(og?.modelSize).toBe('2048x1072');
    });
});

describe('Gemini Nano Banana 2 scenario size adapter', () => {
    it('returns only declared Gemini size values', () => {
        const geminiValues = new Set(GEMINI_SIZE_OPTIONS.map((option) => option.value));
        const options = getScenarioSizeOptions(GEMINI_NANO_BANANA_2_MODEL, [], { preferredTier: '2K' });

        expect(options.length).toBeGreaterThan(15);
        for (const option of options) {
            expect(geminiValues.has(option.modelSize), `${option.source.id} -> ${option.modelSize}`).toBe(true);
        }
    });

    it('uses exact ratios when Gemini exposes them and near matches otherwise', () => {
        const options = getScenarioSizeOptions(GEMINI_NANO_BANANA_2_MODEL, [], { preferredTier: '2K' });
        const xhs = options.find((option) => option.source.id === 'xiaohongshu-cover');
        const story = options.find((option) => option.source.id === 'stories-reels-short-video');
        const og = options.find((option) => option.source.id === 'open-graph-share');

        expect(xhs).toMatchObject({ modelSize: '1792x2400', matchQuality: 'exact' });
        expect(story).toMatchObject({ modelSize: '1536x2752', matchQuality: 'exact' });
        expect(og?.modelSize).toMatch(/^(2752x1536|3168x1344)$/u);
        expect(og?.matchQuality).toBe('near');
    });
});

describe('scenario size support validation', () => {
    it('validates through the active model adapter', () => {
        expect(isScenarioSizeSupportedValue('gpt-image-2', '1536x2048')).toBe(true);
        expect(isScenarioSizeSupportedValue('gpt-image-2', '1537x2048')).toBe(false);
        expect(isScenarioSizeSupportedValue(GEMINI_NANO_BANANA_2_MODEL, '1536x2752')).toBe(true);
        expect(isScenarioSizeSupportedValue(GEMINI_NANO_BANANA_2_MODEL, '1536x2048')).toBe(false);
    });

    it('exposes adapter metadata for UI tier controls', () => {
        expect(getScenarioSizeAdapter('gpt-image-2')?.tiers).toEqual(['1K', '2K', '3K', '4K']);
        expect(getScenarioSizeAdapter(GEMINI_NANO_BANANA_2_MODEL)?.tiers).toEqual(['512', '1K', '2K', '4K']);
    });
});

describe('gpt-image-2 scenario size variants', () => {
    it('describes scene-selected sizes so the form can keep tier and ratio controls in sync', () => {
        expect(getGptImage2ScenarioSizeDescriptor('1536x2048')).toMatchObject({
            value: '1536x2048',
            tier: '2K',
            ratioLabel: '3:4'
        });
        expect(getGptImage2ScenarioSizeDescriptor('2048x1072')).toMatchObject({
            value: '2048x1072',
            tier: '2K',
            ratioLabel: '1.91:1'
        });
    });

    it('supports switching the selected ratio to its transposed orientation', () => {
        expect(getScenarioRatioOptionsWithSwap('3:4')).toEqual(['3:4', '4:3']);
        expect(getScenarioRatioOptionsWithSwap('1:1')).toEqual(['1:1']);
        expect(getGptImage2ScenarioSizeVariant('4:3', '2K')?.value).toBe('2048x1536');
    });
});
