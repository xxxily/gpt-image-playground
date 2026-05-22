import { PROMO_SLOT_CREATIVE_GUIDANCE, PROMO_SLOT_DEFINITIONS, getPromoSlotCreativeGuidance } from './promo';
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
