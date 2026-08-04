import {
    formatShowcaseRecipeOutputCustomSize,
    parseShowcaseRecipeOutputCustomSize,
    setShowcaseRecipeOutputCustomSize,
    setShowcaseRecipeOutputEnum,
    setShowcaseRecipeOutputInteger,
    setShowcaseRecipeOutputQuality,
    setShowcaseRecipeOutputScenario,
    setShowcaseRecipeOutputSize
} from './showcase-admin-draft';
import { describe, expect, it } from 'vitest';

describe('showcase admin draft output helpers', () => {
    it('clears every mutually exclusive size mode before applying a direct size', () => {
        expect(
            setShowcaseRecipeOutputSize(
                {
                    scenarioId: 'xiaohongshu-cover',
                    customWidth: 1200,
                    customHeight: 1600,
                    quality: 'high'
                },
                ' 1024x1024 '
            )
        ).toEqual({ size: '1024x1024', quality: 'high' });
    });

    it('actually removes cleared size and quality values', () => {
        expect(setShowcaseRecipeOutputSize({ size: '1024x1024', n: 2 }, '')).toEqual({ n: 2 });
        expect(setShowcaseRecipeOutputQuality({ quality: 'high', n: 2 }, '')).toEqual({ n: 2 });
        expect(setShowcaseRecipeOutputSize({ size: '1024x1024' }, '')).toBeUndefined();
        expect(setShowcaseRecipeOutputQuality({ quality: 'high' }, '')).toBeUndefined();
    });

    it('round-trips scenario/custom modes and optional output fields without stale values', () => {
        expect(setShowcaseRecipeOutputScenario({ size: '1024x1024', quality: 'high' }, ' portrait-cover ')).toEqual({
            scenarioId: 'portrait-cover',
            quality: 'high'
        });
        expect(
            setShowcaseRecipeOutputCustomSize({ scenarioId: 'portrait-cover', outputFormat: 'webp' }, '1200 × 1600')
        ).toEqual({ customWidth: 1200, customHeight: 1600, outputFormat: 'webp' });
        expect(setShowcaseRecipeOutputCustomSize({ customWidth: 1200, customHeight: 1600 }, '')).toBeUndefined();
        expect(setShowcaseRecipeOutputEnum({ background: 'transparent', n: 2 }, 'background', '')).toEqual({ n: 2 });
        expect(setShowcaseRecipeOutputInteger({ outputCompression: 80 }, 'outputCompression', null)).toBeUndefined();
    });

    it('supports a single editable width-by-height field without erasing partial input', () => {
        const current = { customWidth: 1200, customHeight: 1600, quality: 'high' as const };

        expect(parseShowcaseRecipeOutputCustomSize(' 1024x1536 ')).toEqual({ width: 1024, height: 1536 });
        expect(parseShowcaseRecipeOutputCustomSize('1024×1536')).toEqual({ width: 1024, height: 1536 });
        expect(parseShowcaseRecipeOutputCustomSize('1024')).toBeUndefined();
        expect(parseShowcaseRecipeOutputCustomSize('32×1024')).toBeUndefined();
        expect(setShowcaseRecipeOutputCustomSize(current, '1024')).toEqual({ quality: 'high' });
        expect(formatShowcaseRecipeOutputCustomSize(current)).toBe('1200×1600');
    });
});
