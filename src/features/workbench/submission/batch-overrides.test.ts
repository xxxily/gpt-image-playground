import { describe, expect, it } from 'vitest';
import { MAX_BATCH_OVERRIDE_IMAGE_COUNT, clampBatchOverrideImageCount } from './batch-overrides';

describe('clampBatchOverrideImageCount', () => {
    it('rounds and clamps override counts to the supported range', () => {
        expect(clampBatchOverrideImageCount(0)).toBe(1);
        expect(clampBatchOverrideImageCount(2.6)).toBe(3);
        expect(clampBatchOverrideImageCount(MAX_BATCH_OVERRIDE_IMAGE_COUNT + 4)).toBe(
            MAX_BATCH_OVERRIDE_IMAGE_COUNT
        );
    });
});
