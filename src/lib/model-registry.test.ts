import {
    getFirstImageModelForProvider,
    getImageModelProviderGroups,
    getImageModel,
    getModelProvider,
    normalizeCustomImageModels,
    GEMINI_NANO_BANANA_2_MODEL,
    SEEDREAM_5_LITE_MODEL,
    SENSENOVA_U1_FAST_MODEL
} from './model-registry';
import { describe, expect, it } from 'vitest';

describe('model registry provider metadata', () => {
    it('registers SenseNova U1 Fast as a first-class custom-size provider model', () => {
        const model = getImageModel(SENSENOVA_U1_FAST_MODEL);

        expect(model.provider).toBe('sensenova');
        expect(model.providerLabel).toBe('SenseNova');
        expect(model.supportsCustomSize).toBe(true);
        expect(model.supportsQuality).toBe(false);
        expect(model.supportsOutputFormat).toBe(false);
        expect(model.supportsEditing).toBe(false);
        expect(model.defaultSize).toBe('2752x1536');
        expect(model.sizePresets).toEqual({
            square: '2048x2048',
            landscape: '2752x1536',
            portrait: '1536x2752'
        });
    });

    it('registers Gemini with documented 1K ratio presets', () => {
        const model = getImageModel(GEMINI_NANO_BANANA_2_MODEL);

        expect(model.provider).toBe('google');
        expect(model.supportsEditing).toBe(true);
        expect(model.supportsCustomSize).toBe(false);
        expect(model.sizePresets).toEqual({
            square: '1024x1024',
            landscape: '1264x848',
            portrait: '848x1264'
        });
    });

    it('registers Seedream 5.0 Lite with provider defaults for Ark image generation', () => {
        const model = getImageModel(SEEDREAM_5_LITE_MODEL);

        expect(model.provider).toBe('seedream');
        expect(model.providerLabel).toBe('Seedream');
        expect(model.supportsCustomSize).toBe(true);
        expect(model.supportsQuality).toBe(false);
        expect(model.supportsOutputFormat).toBe(true);
        expect(model.supportsEditing).toBe(true);
        expect(model.defaultSize).toBe('2K');
        expect(model.providerOptions).toEqual({ response_format: 'url', watermark: false });
    });

    it('infers SenseNova and Seedream providers for unknown model IDs', () => {
        expect(getModelProvider('sensenova-future-model')).toBe('sensenova');
        expect(getModelProvider('doubao-seedream-future')).toBe('seedream');
        expect(getModelProvider('doubao-seededit-future')).toBe('seedream');
    });

    it('groups built-in and custom models by provider for provider-first selectors', () => {
        const groups = getImageModelProviderGroups([
            { id: 'vendor-seedream-plus', provider: 'seedream', label: 'Vendor Seedream Plus' },
            { id: 'vendor-google-image', provider: 'google', label: 'Vendor Google Image' }
        ]);

        expect(groups.map((group) => group.provider)).toEqual(['openai', 'google', 'seedream', 'sensenova']);
        expect(
            groups
                .find((group) => group.provider === 'seedream')
                ?.models.map((model) => model.id)
                .slice(0, 4)
        ).toEqual([
            SEEDREAM_5_LITE_MODEL,
            'doubao-seedream-4.5',
            'doubao-seedream-4.0-250828',
            'doubao-seedream-3.0-t2i'
        ]);
        expect(groups.find((group) => group.provider === 'seedream')?.models.map((model) => model.id)).toContain(
            'vendor-seedream-plus'
        );
        expect(getFirstImageModelForProvider('sensenova')?.id).toBe(SENSENOVA_U1_FAST_MODEL);
    });
});

describe('custom image model normalization', () => {
    it('preserves custom model capabilities, size presets, default size, and provider params', () => {
        expect(
            normalizeCustomImageModels([
                {
                    id: 'vendor-xl-image',
                    provider: 'openai',
                    label: 'Vendor XL',
                    capabilities: {
                        supportsCustomSize: true,
                        supportsStreaming: true,
                        supportsOutputFormat: true,
                        supportsCompression: false
                    },
                    sizePresets: {
                        square: '2048x2048',
                        landscape: '2304x1296',
                        portrait: '1296x2304'
                    },
                    defaultSize: '2304x1296',
                    providerOptions: {
                        watermark: false,
                        nested: { style: 'infographic' }
                    }
                }
            ])
        ).toEqual([
            {
                id: 'vendor-xl-image',
                provider: 'openai',
                label: 'Vendor XL',
                capabilities: {
                    supportsStreaming: true,
                    supportsCustomSize: true,
                    supportsOutputFormat: true,
                    supportsCompression: false
                },
                sizePresets: {
                    square: '2048x2048',
                    landscape: '2304x1296',
                    portrait: '1296x2304'
                },
                defaultSize: '2304x1296',
                providerOptions: {
                    watermark: false,
                    nested: { style: 'infographic' }
                }
            }
        ]);
    });

    it('turns custom capabilities into model definition flags', () => {
        const customModels = normalizeCustomImageModels([
            {
                id: 'custom-size-model',
                provider: 'openai',
                capabilities: { supportsCustomSize: true, supportsMask: false }
            }
        ]);

        const definition = getImageModel('custom-size-model', customModels);
        expect(definition.supportsCustomSize).toBe(true);
        expect(definition.supportsMask).toBe(false);
        expect(definition.custom).toBe(true);
    });

    it('rejects non-json provider options for custom models', () => {
        expect(
            normalizeCustomImageModels([
                {
                    id: 'bad-options-model',
                    provider: 'openai',
                    providerOptions: { ok: true, nope: undefined }
                }
            ])
        ).toEqual([{ id: 'bad-options-model', provider: 'openai' }]);
    });
});
