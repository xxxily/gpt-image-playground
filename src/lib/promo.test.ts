import {
    PROMO_SLOT_CREATIVE_GUIDANCE,
    PROMO_SLOT_DEFINITIONS,
    getDefaultPromoAspectRatioForSlot,
    getPromoSlotCreativeGuidance,
    normalizePromoAspectRatio,
    parsePromoAspectRatio,
    serializePromoAspectRatioCss
} from './promo';
import { describe, expect, it } from 'vitest';

describe('promo creative guidance', () => {
    it('keeps guidance for every built-in promo slot', () => {
        expect(Object.keys(PROMO_SLOT_CREATIVE_GUIDANCE).sort()).toEqual(
            PROMO_SLOT_DEFINITIONS.map((slot) => slot.key).sort()
        );
    });

    it('documents separate desktop and mobile targets for wide banner slots', () => {
        expect(getPromoSlotCreativeGuidance('app_top_banner')?.desktop.recommendedRatio).toBe('10:1');
        expect(getPromoSlotCreativeGuidance('app_top_banner')?.mobile.recommendedRatio).toBe('4:1');
        expect(getPromoSlotCreativeGuidance('history_top_banner')?.desktop.recommendedRatio).toBe('10:1');
        expect(getPromoSlotCreativeGuidance('history_top_banner')?.mobile.recommendedRatio).toBe('4:1');
    });

    it('keeps generation header guidance at 4:1 on both device classes', () => {
        expect(getPromoSlotCreativeGuidance('generation_form_header')?.desktop.recommendedRatio).toBe('4:1');
        expect(getPromoSlotCreativeGuidance('generation_form_header')?.mobile.recommendedRatio).toBe('4:1');
    });
});

describe('promo aspect ratios', () => {
    it('normalizes integer ratios to their simplest form', () => {
        expect(normalizePromoAspectRatio(1920, 1080, 'custom')).toEqual({
            width: 16,
            height: 9,
            label: '16:9',
            source: 'custom'
        });
        expect(normalizePromoAspectRatio(1200, 300, 'preset')).toEqual({
            width: 4,
            height: 1,
            label: '4:1',
            source: 'preset'
        });
    });

    it('parses decimal share-card ratios without changing scale on only one side', () => {
        expect(parsePromoAspectRatio('1.91:1', 'preset')).toEqual({
            width: 191,
            height: 100,
            label: '1.91:1',
            source: 'preset'
        });
    });

    it('rejects invalid or extreme ratios', () => {
        expect(parsePromoAspectRatio('0:1')).toBeNull();
        expect(parsePromoAspectRatio('21:1')).toBeNull();
        expect(parsePromoAspectRatio('not-a-ratio')).toBeNull();
    });

    it('provides slot defaults and CSS serialization fallbacks', () => {
        expect(getDefaultPromoAspectRatioForSlot('app_top_banner')).toMatchObject({
            width: 10,
            height: 1,
            label: '10:1',
            source: 'legacySlot'
        });
        expect(serializePromoAspectRatioCss({ width: 16, height: 9, label: '16:9', source: 'preset' })).toBe(
            '16 / 9'
        );
        expect(serializePromoAspectRatioCss(null)).toBe('4 / 1');
    });
});
