import type { GptImageModel } from '@/lib/cost-utils';
import { getImageModel, type StoredCustomImageModel } from '@/lib/model-registry';

export type SizeValidation = { valid: true } | { valid: false; reason: string };

export const GPT_IMAGE_2_MIN_PIXELS = 655_360;
export const GPT_IMAGE_2_MAX_PIXELS = 8_294_400;
export const GPT_IMAGE_2_MAX_EDGE = 3840;
export const GPT_IMAGE_2_EDGE_MULTIPLE = 16;
export const GPT_IMAGE_2_MAX_ASPECT = 3;
export const LEGACY_SIZE_PRESETS = ['auto', 'portrait', 'landscape', 'square', 'custom'] as const;

export type LegacySizePreset = typeof LEGACY_SIZE_PRESETS[number];
export type OpenAIImageSizeTier = '1K' | '2K' | '3K' | '4K';
export type OpenAIImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9' | '9:21';
export type SizePreset = LegacySizePreset | (string & {});

export type OpenAIImageSizePreset = {
    value: string;
    tier: OpenAIImageSizeTier;
    ratio: OpenAIImageAspectRatio;
    width: number;
    height: number;
};

export const OPENAI_IMAGE_SIZE_TIERS: readonly OpenAIImageSizeTier[] = ['1K', '2K', '3K', '4K'];

export const OPENAI_IMAGE_ASPECT_RATIOS: readonly OpenAIImageAspectRatio[] = [
    '1:1',
    '16:9',
    '9:16',
    '4:3',
    '3:4',
    '3:2',
    '2:3',
    '21:9',
    '9:21'
];

export const GPT_IMAGE_2_SIZE_PRESETS: readonly OpenAIImageSizePreset[] = [
    { tier: '1K', ratio: '1:1', value: '1024x1024', width: 1024, height: 1024 },
    { tier: '1K', ratio: '16:9', value: '1280x720', width: 1280, height: 720 },
    { tier: '1K', ratio: '9:16', value: '720x1280', width: 720, height: 1280 },
    { tier: '1K', ratio: '4:3', value: '1152x864', width: 1152, height: 864 },
    { tier: '1K', ratio: '3:4', value: '864x1152', width: 864, height: 1152 },
    { tier: '1K', ratio: '3:2', value: '1248x832', width: 1248, height: 832 },
    { tier: '1K', ratio: '2:3', value: '832x1248', width: 832, height: 1248 },
    { tier: '1K', ratio: '21:9', value: '1280x544', width: 1280, height: 544 },
    { tier: '1K', ratio: '9:21', value: '544x1280', width: 544, height: 1280 },
    { tier: '2K', ratio: '1:1', value: '2048x2048', width: 2048, height: 2048 },
    { tier: '2K', ratio: '16:9', value: '2048x1152', width: 2048, height: 1152 },
    { tier: '2K', ratio: '9:16', value: '1152x2048', width: 1152, height: 2048 },
    { tier: '2K', ratio: '4:3', value: '2048x1536', width: 2048, height: 1536 },
    { tier: '2K', ratio: '3:4', value: '1536x2048', width: 1536, height: 2048 },
    { tier: '2K', ratio: '3:2', value: '2016x1344', width: 2016, height: 1344 },
    { tier: '2K', ratio: '2:3', value: '1344x2016', width: 1344, height: 2016 },
    { tier: '2K', ratio: '21:9', value: '2048x880', width: 2048, height: 880 },
    { tier: '2K', ratio: '9:21', value: '880x2048', width: 880, height: 2048 },
    { tier: '3K', ratio: '1:1', value: '2560x2560', width: 2560, height: 2560 },
    { tier: '3K', ratio: '16:9', value: '3072x1728', width: 3072, height: 1728 },
    { tier: '3K', ratio: '9:16', value: '1728x3072', width: 1728, height: 3072 },
    { tier: '3K', ratio: '4:3', value: '3072x2304', width: 3072, height: 2304 },
    { tier: '3K', ratio: '3:4', value: '2304x3072', width: 2304, height: 3072 },
    { tier: '3K', ratio: '3:2', value: '3072x2048', width: 3072, height: 2048 },
    { tier: '3K', ratio: '2:3', value: '2048x3072', width: 2048, height: 3072 },
    { tier: '3K', ratio: '21:9', value: '3072x1312', width: 3072, height: 1312 },
    { tier: '3K', ratio: '9:21', value: '1312x3072', width: 1312, height: 3072 },
    { tier: '4K', ratio: '1:1', value: '2880x2880', width: 2880, height: 2880 },
    { tier: '4K', ratio: '16:9', value: '3840x2160', width: 3840, height: 2160 },
    { tier: '4K', ratio: '9:16', value: '2160x3840', width: 2160, height: 3840 },
    { tier: '4K', ratio: '4:3', value: '3264x2448', width: 3264, height: 2448 },
    { tier: '4K', ratio: '3:4', value: '2448x3264', width: 2448, height: 3264 },
    { tier: '4K', ratio: '3:2', value: '3520x2352', width: 3520, height: 2352 },
    { tier: '4K', ratio: '2:3', value: '2352x3520', width: 2352, height: 3520 },
    { tier: '4K', ratio: '21:9', value: '3840x1648', width: 3840, height: 1648 },
    { tier: '4K', ratio: '9:21', value: '1648x3840', width: 1648, height: 3840 }
];

const GPT_IMAGE_2_SIZE_PRESETS_BY_VALUE = new Map(GPT_IMAGE_2_SIZE_PRESETS.map((preset) => [preset.value, preset]));

export function validateGptImage2Size(width: number, height: number): SizeValidation {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return { valid: false, reason: 'Width and height must be positive numbers.' };
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return { valid: false, reason: 'Width and height must be whole numbers.' };
    }
    if (width % GPT_IMAGE_2_EDGE_MULTIPLE !== 0 || height % GPT_IMAGE_2_EDGE_MULTIPLE !== 0) {
        return { valid: false, reason: `Both edges must be multiples of ${GPT_IMAGE_2_EDGE_MULTIPLE}.` };
    }
    if (width > GPT_IMAGE_2_MAX_EDGE || height > GPT_IMAGE_2_MAX_EDGE) {
        return { valid: false, reason: `Maximum edge is ${GPT_IMAGE_2_MAX_EDGE}px.` };
    }
    const long = Math.max(width, height);
    const short = Math.min(width, height);
    if (long / short > GPT_IMAGE_2_MAX_ASPECT) {
        return { valid: false, reason: `Aspect ratio (long:short) must be ≤ ${GPT_IMAGE_2_MAX_ASPECT}:1.` };
    }
    const pixels = width * height;
    if (pixels < GPT_IMAGE_2_MIN_PIXELS) {
        return { valid: false, reason: `Total pixels must be at least ${GPT_IMAGE_2_MIN_PIXELS.toLocaleString()}.` };
    }
    if (pixels > GPT_IMAGE_2_MAX_PIXELS) {
        return { valid: false, reason: `Total pixels must be no more than ${GPT_IMAGE_2_MAX_PIXELS.toLocaleString()}.` };
    }
    return { valid: true };
}

export function isLegacySizePreset(value: unknown): value is LegacySizePreset {
    return typeof value === 'string' && LEGACY_SIZE_PRESETS.includes(value as LegacySizePreset);
}

export function getGptImage2SizePreset(value: string): OpenAIImageSizePreset | null {
    return GPT_IMAGE_2_SIZE_PRESETS_BY_VALUE.get(value) ?? null;
}

export function getGptImage2SizePresetsByTier(tier: OpenAIImageSizeTier): readonly OpenAIImageSizePreset[] {
    return GPT_IMAGE_2_SIZE_PRESETS.filter((preset) => preset.tier === tier);
}

export function getGptImage2SizePresetByTierAndRatio(
    tier: OpenAIImageSizeTier,
    ratio: OpenAIImageAspectRatio
): OpenAIImageSizePreset {
    return GPT_IMAGE_2_SIZE_PRESETS.find((preset) => preset.tier === tier && preset.ratio === ratio)
        ?? GPT_IMAGE_2_SIZE_PRESETS.find((preset) => preset.tier === tier)
        ?? GPT_IMAGE_2_SIZE_PRESETS[0];
}

export function isGptImage2SizePresetValue(value: unknown): value is string {
    return typeof value === 'string' && GPT_IMAGE_2_SIZE_PRESETS_BY_VALUE.has(value);
}

export function isSizePresetValue(value: unknown): value is SizePreset {
    return isLegacySizePreset(value) || isGptImage2SizePresetValue(value);
}

/**
 * Returns the concrete WxH string for a preset, tailored to the model.
 * Returns null for 'auto' (let the API pick) and 'custom' (caller provides WxH).
 * gpt-image-2 uses higher-resolution variants of the same ratios.
 */
export function getPresetDimensions(
    preset: SizePreset,
    model: GptImageModel,
    customModels: readonly StoredCustomImageModel[] = []
): string | null {
    if (preset === 'auto' || preset === 'custom') return null;
    if (isGptImage2SizePresetValue(preset)) return preset;
    if (!isLegacySizePreset(preset)) return preset;

    const modelDefinition = getImageModel(model, customModels);
    const configuredPreset = modelDefinition.sizePresets?.[preset];
    if (configuredPreset) return configuredPreset;

    const isHighResolutionModel = modelDefinition.supportsCustomSize;
    switch (preset) {
        case 'square':
            return isHighResolutionModel ? '2048x2048' : '1024x1024';
        case 'landscape':
            return isHighResolutionModel ? '3072x2048' : '1536x1024';
        case 'portrait':
            return isHighResolutionModel ? '2048x3072' : '1024x1536';
    }
    return null;
}

/**
 * Human-readable dimension info for tooltips.
 */
export function getPresetTooltip(
    preset: SizePreset,
    model: GptImageModel,
    customModels: readonly StoredCustomImageModel[] = []
): string | null {
    const dims = getPresetDimensions(preset, model, customModels);
    if (!dims) return null;
    const [w, h] = dims.split('x').map(Number);
    const mp = ((w * h) / 1_000_000).toFixed(1);
    const gptImagePreset = getGptImage2SizePreset(preset);
    const ratio = gptImagePreset?.ratio ?? (preset === 'square' ? '1:1' : preset === 'landscape' ? '3:2' : '2:3');
    return `${w} × ${h} · ${ratio} · ${mp} MP`;
}

export function resolveImageRequestSize(
    preset: SizePreset,
    model: GptImageModel,
    customWidth: number,
    customHeight: number,
    customModels: readonly StoredCustomImageModel[] = []
): string {
    if (preset === 'custom') return `${customWidth}x${customHeight}`;
    if (isGptImage2SizePresetValue(preset)) return preset;

    const presetDimensions = getPresetDimensions(preset, model, customModels);
    if (presetDimensions) return presetDimensions;

    const modelDefinition = getImageModel(model, customModels);
    return modelDefinition.defaultSize ?? preset;
}
