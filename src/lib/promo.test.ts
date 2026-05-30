import {
    PROMO_SLOT_CREATIVE_GUIDANCE,
    PROMO_SLOT_DEFINITIONS,
    evaluatePromoConstraintSet,
    getDefaultPromoAspectRatioForSlot,
    getPromoConstraintChips,
    getPromoSlotCreativeGuidance,
    normalizePromoAspectRatio,
    parsePromoAspectRatio,
    parsePromoDomainRulesInput,
    serializePromoAspectRatioCss,
    serializePromoConstraintSet,
    serializePromoConstraintSetForStorage,
    updatePromoConstraintSetDomain
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

describe('promo constraints', () => {
    it('parses exact, URL, wildcard, duplicate, and localhost domain rules', () => {
        const parsed = parsePromoDomainRulesInput(
            'Site-A.Example.com https://site-b.example.com/path *.example.com localhost:3000 site-a.example.com'
        );

        expect(parsed.errors).toEqual([]);
        expect(parsed.rules).toEqual([
            { type: 'exact', host: 'site-a.example.com', port: null, label: 'site-a.example.com' },
            { type: 'exact', host: 'site-b.example.com', port: null, label: 'site-b.example.com' },
            { type: 'wildcard', host: 'example.com', port: null, label: '*.example.com' },
            { type: 'exact', host: 'localhost', port: 3000, label: 'localhost:3000' }
        ]);
    });

    it('evaluates domain constraints by match strength', () => {
        const rules = parsePromoDomainRulesInput('*.example.com exact.example.com').rules;
        const set = updatePromoConstraintSetDomain(null, { mode: 'allowlist', rules });
        const serialized = serializePromoConstraintSet(set);

        expect(evaluatePromoConstraintSet(serialized, { requestHost: 'exact.example.com' })).toMatchObject({
            matches: true,
            strengthLabel: 'exact'
        });
        expect(evaluatePromoConstraintSet(serialized, { requestHost: 'child.example.com' })).toMatchObject({
            matches: true,
            strengthLabel: 'wildcard'
        });
        expect(evaluatePromoConstraintSet(serialized, { requestHost: 'example.com' }).matches).toBe(false);
        expect(evaluatePromoConstraintSet(serialized, { requestHost: 'other.test' }).matches).toBe(false);
    });

    it('keeps public display generic for empty and unknown constraints', () => {
        expect(getPromoConstraintChips(null)).toEqual([]);
        const unknown = serializePromoConstraintSet({
            version: 1,
            logic: 'all',
            constraints: [
                {
                    id: 'future',
                    type: 'timeWindow',
                    enabled: true,
                    label: 'Time window',
                    summary: 'Weekdays 09:00-18:00',
                    payload: { value: true }
                }
            ]
        });

        expect(getPromoConstraintChips(unknown)[0]).toMatchObject({
            type: 'timeWindow',
            summary: 'Weekdays 09:00-18:00',
            severity: 'warning'
        });
        expect(evaluatePromoConstraintSet(unknown, { requestHost: 'example.com' }).matches).toBe(false);
    });

    it('preserves unknown constraints while editing the domain constraint', () => {
        const existing = serializePromoConstraintSet({
            version: 1,
            logic: 'all',
            constraints: [
                {
                    id: 'future',
                    type: 'timeWindow',
                    enabled: true,
                    label: 'Time window',
                    summary: 'Weekdays 09:00-18:00',
                    payload: { value: true }
                }
            ]
        });
        const updated = updatePromoConstraintSetDomain(existing, {
            mode: 'allowlist',
            rules: parsePromoDomainRulesInput('site-a.example.com').rules
        });

        expect(getPromoConstraintChips(updated).map((chip) => chip.type)).toEqual(['timeWindow', 'domain']);
    });

    it('normalizes constraints before storage and rejects invalid known payloads', () => {
        expect(
            serializePromoConstraintSetForStorage({
                version: 1,
                logic: 'all',
                constraints: [
                    {
                        id: 'domain',
                        type: 'domain',
                        enabled: true,
                        label: '显示域名',
                        summary: '*.example.com',
                        payload: {
                            mode: 'allowlist',
                            rules: [{ type: 'exact', host: '*.example.com', port: null, label: '*.example.com' }]
                        }
                    }
                ]
            })
        ).toBeNull();

        expect(
            serializePromoConstraintSetForStorage({
                version: 1,
                logic: 'all',
                constraints: [
                    {
                        id: 'domain',
                        type: 'domain',
                        enabled: true,
                        label: '显示域名',
                        summary: 'all',
                        payload: { mode: 'all', rules: [] }
                    }
                ]
            })
        ).toBeNull();
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
