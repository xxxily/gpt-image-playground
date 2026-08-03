import {
    applyShowcasePrompt,
    buildShowcaseRecipePrompt,
    evaluateShowcaseModelCompatibility,
    normalizeShowcaseRecipe,
    resolveShowcaseRecipeWorkbenchValues,
    SHOWCASE_RECIPE_VERSION,
    syncShowcasePromptWithUserInstruction
} from './showcase-recipe';
import type { ShowcaseInputSlot, ShowcaseRecipeV1 } from './showcase-recipe';
import { describe, expect, it } from 'vitest';

function slot(id = 'target', order = 0): ShowcaseInputSlot {
    return {
        id,
        label: { 'zh-CN': '主体图片', 'en-US': 'Subject image' },
        description: {
            'zh-CN': '上传一张主体清晰、边缘完整的图片。',
            'en-US': 'Upload one image with a clear subject and complete edges.'
        },
        role: 'target',
        required: true,
        minCount: 1,
        maxCount: 1,
        workbenchOrder: order,
        acceptedMimeTypes: ['image/*']
    };
}

function validRecipe(overrides: Partial<ShowcaseRecipeV1> = {}): ShowcaseRecipeV1 {
    return {
        version: SHOWCASE_RECIPE_VERSION,
        taskMode: 'image-edit',
        promptStrategy: 'replace',
        prompt: {
            'zh-CN': '保留主体身份与构图，清理背景并恢复自然边缘。',
            'en-US': 'Preserve subject identity and composition, clean the background, and recover natural edges.'
        },
        inputSlots: [slot()],
        capabilityRequirements: {
            supportsEditing: true,
            minReferenceImages: 1,
            supportedTaskModes: ['image-edit']
        },
        output: {
            n: 1,
            size: '1024x1024',
            quality: 'high',
            outputFormat: 'png',
            background: 'auto',
            moderation: 'auto'
        },
        userInstruction: {
            enabled: true,
            maxLength: 500
        },
        ...overrides
    };
}

function clone<T>(value: T): T {
    return structuredClone(value);
}

describe('normalizeShowcaseRecipe', () => {
    it('normalizes a transparent single-image recipe without hiding or rewriting its prompt', () => {
        const recipe = validRecipe();
        const normalized = normalizeShowcaseRecipe(recipe);

        expect(normalized).not.toBeNull();
        expect(normalized?.prompt).toEqual(recipe.prompt);
        expect(normalized?.inputSlots).toHaveLength(1);
        expect(normalized?.taskMode).toBe('image-edit');
    });

    it('preserves custom safe values in a multi-image recipe', () => {
        const garmentSlot: ShowcaseInputSlot = {
            ...slot('garment', 1),
            label: { 'zh-CN': '服装图片', 'en-US': 'Garment image' },
            role: 'garment'
        };
        const recipe = validRecipe({
            promptStrategy: 'append',
            inputSlots: [slot('person', 0), garmentSlot],
            preferredModelIds: ['custom-provider/image-editor-v2'],
            capabilityRequirements: {
                supportsEditing: true,
                supportsCustomSize: true,
                minReferenceImages: 2,
                supportedTaskModes: ['image-edit']
            },
            output: {
                n: 2,
                customWidth: 1200,
                customHeight: 1600,
                quality: 'auto',
                outputFormat: 'webp',
                outputCompression: 88,
                background: 'opaque',
                moderation: 'low'
            }
        });

        expect(normalizeShowcaseRecipe(recipe)).toEqual(recipe);
    });

    it('accepts schemaVersion as a legacy input alias and emits canonical version', () => {
        const recipe = validRecipe();
        const legacyRecipe = { ...recipe } as Partial<ShowcaseRecipeV1> & { schemaVersion?: number };
        delete legacyRecipe.version;

        expect(normalizeShowcaseRecipe({ ...legacyRecipe, schemaVersion: 1 })).toEqual(recipe);
    });

    it('rejects missing, invalid, conflicting, and future versions', () => {
        const recipe = validRecipe();
        const withoutVersion = { ...recipe } as Partial<ShowcaseRecipeV1>;
        delete withoutVersion.version;

        expect(normalizeShowcaseRecipe(withoutVersion)).toBeNull();
        expect(normalizeShowcaseRecipe({ ...recipe, version: 2 })).toBeNull();
        expect(normalizeShowcaseRecipe({ ...recipe, version: '1' })).toBeNull();
        expect(normalizeShowcaseRecipe({ ...recipe, schemaVersion: 2 })).toBeNull();
        expect(normalizeShowcaseRecipe(null)).toBeNull();
        expect(normalizeShowcaseRecipe([])).toBeNull();
    });

    it('rejects unknown fields at every structured layer', () => {
        const recipe = validRecipe();
        const invalidPayloads: unknown[] = [
            { ...recipe, autostart: true },
            { ...recipe, apiKey: 'not-allowed' },
            { ...recipe, prompt: { ...recipe.prompt, 'fr-FR': 'Texte' } },
            { ...recipe, inputSlots: [{ ...recipe.inputSlots[0], sourcePath: '/tmp/input.png' }] },
            { ...recipe, capabilityRequirements: { ...recipe.capabilityRequirements, provider: 'custom' } },
            { ...recipe, output: { ...recipe.output, rawProviderOptions: {} } },
            { ...recipe, userInstruction: { ...recipe.userInstruction, templateCode: 'run()' } }
        ];

        for (const payload of invalidPayloads) {
            expect(normalizeShowcaseRecipe(payload)).toBeNull();
        }
    });

    it('rejects dangerous keys and non-standard object prototypes', () => {
        const dangerous = clone(validRecipe());
        Object.defineProperty(dangerous.inputSlots[0], '__proto__', {
            value: { polluted: true },
            enumerable: true
        });

        const customPrototype = clone(validRecipe());
        Object.setPrototypeOf(customPrototype.capabilityRequirements, { inherited: true });

        expect(normalizeShowcaseRecipe(dangerous)).toBeNull();
        expect(normalizeShowcaseRecipe(customPrototype)).toBeNull();
        expect(Object.prototype).not.toHaveProperty('polluted');
    });

    it('rejects credentials, URLs, local paths, inline bytes, and executable text', () => {
        const forbiddenPrompts = [
            'Use apiKey = sk-example-placeholder for this request.',
            'Read the source from file:///Users/example/photo.png.',
            'Use blob:runtime-object as the image.',
            'Use data:image/png;base64,AAAA as the source.',
            'Download the image from https://example.com/source.png.',
            '<script>submit()</script>',
            `Inline image: ${'A'.repeat(300)}`
        ];

        for (const prompt of forbiddenPrompts) {
            expect(
                normalizeShowcaseRecipe(
                    validRecipe({ prompt: { 'zh-CN': prompt, 'en-US': 'A normal visible prompt.' } })
                )
            ).toBeNull();
        }
    });

    it('rejects invalid input ordering, duplicate slots, and inconsistent counts', () => {
        const first = slot('target', 0);
        const duplicateId = slot('target', 1);
        const duplicateOrder = slot('style-reference', 0);
        const invalidOptional = { ...slot('optional', 1), required: false, minCount: 1 };

        expect(normalizeShowcaseRecipe(validRecipe({ inputSlots: [first, duplicateId] }))).toBeNull();
        expect(normalizeShowcaseRecipe(validRecipe({ inputSlots: [first, duplicateOrder] }))).toBeNull();
        expect(normalizeShowcaseRecipe(validRecipe({ inputSlots: [first, invalidOptional] }))).toBeNull();
        expect(normalizeShowcaseRecipe(validRecipe({ inputSlots: [] }))).toBeNull();
    });

    it('allows only the registered visible user-instruction placeholder', () => {
        const visiblePrompt = {
            'zh-CN': '保留主体。补充要求：{{user_instruction}}',
            'en-US': 'Preserve the subject. Additional request: {{user_instruction}}'
        };

        expect(
            normalizeShowcaseRecipe(
                validRecipe({
                    prompt: visiblePrompt,
                    userInstruction: { enabled: true, maxLength: 500, placeholderKey: 'user_instruction' }
                })
            )?.prompt
        ).toEqual(visiblePrompt);
        expect(normalizeShowcaseRecipe(validRecipe({ prompt: visiblePrompt, userInstruction: undefined }))).toBeNull();
        expect(
            normalizeShowcaseRecipe(
                validRecipe({
                    prompt: {
                        'zh-CN': '执行 {{network_request}}',
                        'en-US': 'Run {{network_request}}'
                    }
                })
            )
        ).toBeNull();
    });
});

describe('showcase recipe application helpers', () => {
    it('builds transparent editable prompts and explicit conflict modes', () => {
        const recipe = validRecipe({
            prompt: { 'zh-CN': '修复照片。{{user_instruction}}', 'en-US': 'Restore the photo. {{user_instruction}}' },
            userInstruction: { enabled: true, maxLength: 20, placeholderKey: 'user_instruction' }
        });
        expect(buildShowcaseRecipePrompt(recipe, 'zh-CN', '保留衣服颜色')).toBe('修复照片。保留衣服颜色');
        expect(applyShowcasePrompt('已有内容', '专题内容', 'replace')).toBe('专题内容');
        expect(applyShowcasePrompt('已有内容', '专题内容', 'append')).toBe('已有内容\n\n专题内容');
        expect(applyShowcasePrompt('已有内容', '专题内容', 'keep')).toBe('已有内容');
    });

    it('updates the generated prompt for personalization without overwriting manual edits', () => {
        const recipe = validRecipe({
            prompt: { 'zh-CN': '修复照片。{{user_instruction}}', 'en-US': 'Restore the photo. {{user_instruction}}' },
            userInstruction: { enabled: true, maxLength: 20, placeholderKey: 'user_instruction' }
        });

        expect(syncShowcasePromptWithUserInstruction(recipe, 'zh-CN', '', '保留衣服颜色', '修复照片。')).toBe(
            '修复照片。保留衣服颜色'
        );
        expect(
            syncShowcasePromptWithUserInstruction(
                recipe,
                'zh-CN',
                '保留衣服颜色',
                '去除划痕',
                '这是用户手动改写的完整提示词'
            )
        ).toBe('这是用户手动改写的完整提示词');
    });

    it('reports concrete model incompatibilities and exposes only workbench-safe values', () => {
        const recipe = validRecipe({
            capabilityRequirements: {
                supportsEditing: true,
                supportsMask: true,
                supportsCustomSize: true,
                minReferenceImages: 2,
                supportedTaskModes: ['image-edit']
            },
            output: { n: 2, size: '832x1248', quality: 'high', outputFormat: 'webp' }
        });
        expect(
            evaluateShowcaseModelCompatibility(recipe, {
                id: 'model',
                label: 'Model',
                supportsEditing: false,
                supportsMask: false,
                supportsCustomSize: false,
                maxReferenceImages: 1
            }).reasons
        ).toEqual(['editing', 'mask', 'custom-size', 'reference-images']);
        expect(resolveShowcaseRecipeWorkbenchValues(recipe, 'prompt')).toEqual({
            taskMode: 'image-edit',
            prompt: 'prompt',
            n: 2,
            size: '832x1248',
            quality: 'high',
            outputFormat: 'webp'
        });
    });

    it('preserves a scenario size identifier for model-specific resolution in the workbench', () => {
        const recipe = validRecipe({ output: { n: 1, scenarioId: 'xiaohongshu-cover', quality: 'high' } });

        expect(resolveShowcaseRecipeWorkbenchValues(recipe, 'prompt')).toEqual({
            taskMode: 'image-edit',
            prompt: 'prompt',
            n: 1,
            scenarioId: 'xiaohongshu-cover',
            quality: 'high'
        });
    });
});
