import { DEFAULT_SHOWCASE_CATALOG } from './default-showcases';
import {
    formatShowcaseRecipeOutputCustomSize,
    parseShowcaseRecipeOutputCustomSize,
    setShowcaseInputSlotCounts,
    setShowcaseInputSlotMimeTypes,
    setShowcaseInputSlotRequired,
    setShowcaseRecipeOutputCustomSize,
    setShowcaseRecipeOutputEnum,
    setShowcaseRecipeOutputInteger,
    setShowcaseRecipeOutputQuality,
    setShowcaseRecipeOutputScenario,
    setShowcaseRecipeOutputSize,
    setShowcaseRecipeUserInstruction,
    setShowcaseRecipeUserInstructionPlaceholder,
    setShowcaseTopicFaq,
    setShowcaseTopicRelatedIds,
    toggleShowcaseInputSlotMimeType
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

describe('showcase admin structured field helpers', () => {
    const topic = DEFAULT_SHOWCASE_CATALOG.topics[0]!;
    const inputSlot = DEFAULT_SHOWCASE_CATALOG.cases[0]!.recipe.inputSlots[0]!;

    it('creates and clears FAQ and related-topic fields without leaving empty arrays', () => {
        const faq = [
            {
                question: { 'zh-CN': '需要几张图？', 'en-US': 'How many images are needed?' },
                answer: { 'zh-CN': '一张清晰原图。', 'en-US': 'One clear source image.' }
            }
        ];
        expect(setShowcaseTopicFaq(topic, faq).faq).toEqual(faq);
        expect(setShowcaseTopicFaq({ ...topic, faq }, [])).not.toHaveProperty('faq');
        expect(setShowcaseTopicRelatedIds(topic, [' creative-style ', topic.id, 'creative-style'])).toEqual({
            ...topic,
            relatedTopicIds: ['creative-style']
        });
        expect(setShowcaseTopicRelatedIds({ ...topic, relatedTopicIds: ['creative-style'] }, [])).not.toHaveProperty(
            'relatedTopicIds'
        );
    });

    it('enables, bounds, updates, and clears user instructions', () => {
        const recipe = DEFAULT_SHOWCASE_CATALOG.cases[0]!.recipe;
        expect(setShowcaseRecipeUserInstruction({ ...recipe, userInstruction: undefined }, true, 4_000)).toMatchObject({
            userInstruction: { enabled: true, maxLength: 2_000 }
        });
        expect(
            setShowcaseRecipeUserInstruction(
                {
                    ...recipe,
                    prompt: {
                        'zh-CN': `${recipe.prompt['zh-CN']}\n\n{{user_instruction}}`,
                        'en-US': `${recipe.prompt['en-US']}\n\n{{user_instruction}}`
                    },
                    userInstruction: { enabled: true, maxLength: 500, placeholderKey: 'user_instruction' }
                },
                true,
                800
            )
        ).toMatchObject({ userInstruction: { enabled: true, maxLength: 800, placeholderKey: 'user_instruction' } });

        const cleared = setShowcaseRecipeUserInstruction(
            {
                ...recipe,
                prompt: {
                    'zh-CN': `${recipe.prompt['zh-CN']}\n\n{{user_instruction}}`,
                    'en-US': `${recipe.prompt['en-US']}\n\n{{user_instruction}}`
                },
                userInstruction: { enabled: true, maxLength: 500, placeholderKey: 'user_instruction' }
            },
            false
        );
        expect(cleared).not.toHaveProperty('userInstruction');
        expect(cleared.prompt['zh-CN']).not.toContain('{{user_instruction}}');

        const withPlaceholder = setShowcaseRecipeUserInstructionPlaceholder(
            { ...recipe, userInstruction: { enabled: true, maxLength: 500 } },
            true
        );
        expect(withPlaceholder.userInstruction).toEqual({
            enabled: true,
            maxLength: 500,
            placeholderKey: 'user_instruction'
        });
        expect(withPlaceholder.prompt['zh-CN']).toContain('{{user_instruction}}');
        const withoutPlaceholder = setShowcaseRecipeUserInstructionPlaceholder(withPlaceholder, false);
        expect(withoutPlaceholder.userInstruction).toEqual({ enabled: true, maxLength: 500 });
        expect(withoutPlaceholder.prompt['zh-CN']).not.toContain('{{user_instruction}}');
    });

    it('keeps input-slot required/count invariants and normalizes MIME selections', () => {
        expect(setShowcaseInputSlotRequired({ ...inputSlot, minCount: 0 }, true)).toMatchObject({
            required: true,
            minCount: 1,
            maxCount: 1
        });
        expect(setShowcaseInputSlotRequired(inputSlot, false)).toMatchObject({ required: false, minCount: 0 });
        expect(setShowcaseInputSlotCounts({ ...inputSlot, maxCount: 4 }, 3, 2)).toMatchObject({
            minCount: 2,
            maxCount: 2
        });
        expect(setShowcaseInputSlotMimeTypes(inputSlot, ['image/png', 'image/png', 'text/plain'])).toMatchObject({
            acceptedMimeTypes: ['image/png']
        });
        expect(setShowcaseInputSlotMimeTypes(inputSlot, [])).toMatchObject({ acceptedMimeTypes: ['image/*'] });
        expect(toggleShowcaseInputSlotMimeType(inputSlot, 'image/png', true)).toMatchObject({
            acceptedMimeTypes: ['image/png']
        });
        expect(
            toggleShowcaseInputSlotMimeType(
                { ...inputSlot, acceptedMimeTypes: ['image/png', 'image/webp'] },
                'image/*',
                true
            )
        ).toMatchObject({ acceptedMimeTypes: ['image/*'] });
        expect(
            toggleShowcaseInputSlotMimeType({ ...inputSlot, acceptedMimeTypes: ['image/png'] }, 'image/png', false)
        ).toMatchObject({ acceptedMimeTypes: ['image/*'] });
    });
});
