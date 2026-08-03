import { setShowcaseRecipeOutputQuality, setShowcaseRecipeOutputSize } from './showcase-admin-draft';
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
});
