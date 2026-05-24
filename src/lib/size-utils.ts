import type { GptImageModel } from '@/lib/cost-utils';
import { getImageModel, type StoredCustomImageModel } from '@/lib/model-registry';

export type SizeValidation = { valid: true } | { valid: false; reason: string };
export type GptImage2SizeRecommendationComparison = 'smaller' | 'same' | 'larger';
export type GptImage2SizeRecommendation = {
    width: number;
    height: number;
    ratio: number;
    pixels: number;
    comparison: GptImage2SizeRecommendationComparison;
    wasAspectRatioClamped: boolean;
    wasPixelCountClamped: boolean;
};

export const GPT_IMAGE_2_MIN_PIXELS = 655_360;
export const GPT_IMAGE_2_MAX_PIXELS = 8_294_400;
export const GPT_IMAGE_2_MAX_EDGE = 3840;
export const GPT_IMAGE_2_EDGE_MULTIPLE = 16;
export const GPT_IMAGE_2_MAX_ASPECT = 3;
export const GPT_IMAGE_2_RECOMMENDATION_LIMIT = 8;
export const LEGACY_SIZE_PRESETS = ['auto', 'portrait', 'landscape', 'square', 'custom'] as const;

export type LegacySizePreset = (typeof LEGACY_SIZE_PRESETS)[number];
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
        return { valid: false, reason: '请输入有效的宽度和高度。' };
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return { valid: false, reason: '宽度和高度必须是整数。' };
    }
    if (width % GPT_IMAGE_2_EDGE_MULTIPLE !== 0 || height % GPT_IMAGE_2_EDGE_MULTIPLE !== 0) {
        return { valid: false, reason: `宽度和高度都需要是 ${GPT_IMAGE_2_EDGE_MULTIPLE} 的倍数。` };
    }
    if (width > GPT_IMAGE_2_MAX_EDGE || height > GPT_IMAGE_2_MAX_EDGE) {
        return { valid: false, reason: `最长边不能超过 ${GPT_IMAGE_2_MAX_EDGE}px。` };
    }
    const long = Math.max(width, height);
    const short = Math.min(width, height);
    if (long / short > GPT_IMAGE_2_MAX_ASPECT) {
        return { valid: false, reason: `长短边比例不能超过 ${GPT_IMAGE_2_MAX_ASPECT}:1。` };
    }
    const pixels = width * height;
    if (pixels < GPT_IMAGE_2_MIN_PIXELS) {
        return { valid: false, reason: `总像素不能低于 ${GPT_IMAGE_2_MIN_PIXELS.toLocaleString()}。` };
    }
    if (pixels > GPT_IMAGE_2_MAX_PIXELS) {
        return { valid: false, reason: `总像素不能超过 ${GPT_IMAGE_2_MAX_PIXELS.toLocaleString()}。` };
    }
    return { valid: true };
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function roundToMultiple(value: number, multiple: number): number {
    return Math.round(value / multiple) * multiple;
}

function isValidGptImage2SizeCandidate(width: number, height: number): boolean {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return false;
    if (width % GPT_IMAGE_2_EDGE_MULTIPLE !== 0 || height % GPT_IMAGE_2_EDGE_MULTIPLE !== 0) return false;
    if (width > GPT_IMAGE_2_MAX_EDGE || height > GPT_IMAGE_2_MAX_EDGE) return false;

    const long = Math.max(width, height);
    const short = Math.min(width, height);
    if (long / short > GPT_IMAGE_2_MAX_ASPECT) return false;

    const pixels = width * height;
    return pixels >= GPT_IMAGE_2_MIN_PIXELS && pixels <= GPT_IMAGE_2_MAX_PIXELS;
}

function getGptImage2RecommendationComparison(
    candidatePixels: number,
    requestedPixels: number
): GptImage2SizeRecommendationComparison {
    if (candidatePixels < requestedPixels * 0.98) return 'smaller';
    if (candidatePixels > requestedPixels * 1.02) return 'larger';
    return 'same';
}

function findBestGptImage2SizeCandidate(
    targetRatio: number,
    targetPixels: number
): { width: number; height: number; score: number } | null {
    let targetWidth = Math.sqrt(targetPixels * targetRatio);
    let targetHeight = targetWidth / targetRatio;
    const edgeScale = Math.min(1, GPT_IMAGE_2_MAX_EDGE / targetWidth, GPT_IMAGE_2_MAX_EDGE / targetHeight);
    targetWidth *= edgeScale;
    targetHeight *= edgeScale;

    let best: { width: number; height: number; score: number } | null = null;
    const consider = (candidateWidth: number, candidateHeight: number) => {
        if (!isValidGptImage2SizeCandidate(candidateWidth, candidateHeight)) return;

        const candidateRatio = candidateWidth / candidateHeight;
        const candidatePixels = candidateWidth * candidateHeight;
        const ratioScore = Math.abs(Math.log(candidateRatio / targetRatio));
        const pixelScore = Math.abs(Math.log(candidatePixels / targetPixels));
        const dimensionScore =
            (Math.abs(candidateWidth - targetWidth) + Math.abs(candidateHeight - targetHeight)) / GPT_IMAGE_2_MAX_EDGE;
        const score = ratioScore * 10 + pixelScore * 3 + dimensionScore;

        if (!best || score < best.score) {
            best = { width: candidateWidth, height: candidateHeight, score };
        }
    };

    const nearbyWidth = roundToMultiple(targetWidth, GPT_IMAGE_2_EDGE_MULTIPLE);
    const nearbyHeight = roundToMultiple(targetHeight, GPT_IMAGE_2_EDGE_MULTIPLE);
    for (let widthDelta = -64; widthDelta <= 64; widthDelta += GPT_IMAGE_2_EDGE_MULTIPLE) {
        for (let heightDelta = -64; heightDelta <= 64; heightDelta += GPT_IMAGE_2_EDGE_MULTIPLE) {
            consider(nearbyWidth + widthDelta, nearbyHeight + heightDelta);
        }
    }

    for (
        let candidateWidth = GPT_IMAGE_2_EDGE_MULTIPLE;
        candidateWidth <= GPT_IMAGE_2_MAX_EDGE;
        candidateWidth += GPT_IMAGE_2_EDGE_MULTIPLE
    ) {
        const matchingHeight = roundToMultiple(candidateWidth / targetRatio, GPT_IMAGE_2_EDGE_MULTIPLE);
        consider(candidateWidth, matchingHeight);
        consider(candidateWidth, matchingHeight - GPT_IMAGE_2_EDGE_MULTIPLE);
        consider(candidateWidth, matchingHeight + GPT_IMAGE_2_EDGE_MULTIPLE);
    }

    for (
        let candidateHeight = GPT_IMAGE_2_EDGE_MULTIPLE;
        candidateHeight <= GPT_IMAGE_2_MAX_EDGE;
        candidateHeight += GPT_IMAGE_2_EDGE_MULTIPLE
    ) {
        const matchingWidth = roundToMultiple(candidateHeight * targetRatio, GPT_IMAGE_2_EDGE_MULTIPLE);
        consider(matchingWidth, candidateHeight);
        consider(matchingWidth - GPT_IMAGE_2_EDGE_MULTIPLE, candidateHeight);
        consider(matchingWidth + GPT_IMAGE_2_EDGE_MULTIPLE, candidateHeight);
    }

    return best;
}

function getGptImage2MaxLongEdgeForRatio(targetRatio: number): number {
    const longShortRatio = Math.max(targetRatio, 1 / targetRatio);
    return Math.min(GPT_IMAGE_2_MAX_EDGE, Math.sqrt(GPT_IMAGE_2_MAX_PIXELS * longShortRatio));
}

function getGptImage2TargetPixelsForLongEdge(targetRatio: number, longEdge: number): number {
    const longShortRatio = Math.max(targetRatio, 1 / targetRatio);
    const maxLongEdge = getGptImage2MaxLongEdgeForRatio(targetRatio);
    const targetLongEdge = clampNumber(longEdge, GPT_IMAGE_2_EDGE_MULTIPLE, maxLongEdge);
    return clampNumber(
        (targetLongEdge * targetLongEdge) / longShortRatio,
        GPT_IMAGE_2_MIN_PIXELS,
        GPT_IMAGE_2_MAX_PIXELS
    );
}

export function recommendGptImage2Sizes(width: number, height: number): GptImage2SizeRecommendation[] {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];

    const rawRatio = width / height;
    const minRatio = 1 / GPT_IMAGE_2_MAX_ASPECT;
    const maxRatio = GPT_IMAGE_2_MAX_ASPECT;
    const targetRatio = clampNumber(rawRatio, minRatio, maxRatio);
    const requestedPixels = width * height;
    const targetPixels = clampNumber(width * height, GPT_IMAGE_2_MIN_PIXELS, GPT_IMAGE_2_MAX_PIXELS);
    const wasAspectRatioClamped = targetRatio !== rawRatio;
    const wasPixelCountClamped = targetPixels !== requestedPixels;
    const maxLongEdge = getGptImage2MaxLongEdgeForRatio(targetRatio);
    const targetPixelBuckets = [
        GPT_IMAGE_2_MIN_PIXELS,
        getGptImage2TargetPixelsForLongEdge(targetRatio, 1280),
        targetPixels,
        getGptImage2TargetPixelsForLongEdge(targetRatio, 2048),
        getGptImage2TargetPixelsForLongEdge(targetRatio, 3072),
        getGptImage2TargetPixelsForLongEdge(targetRatio, maxLongEdge)
    ];

    if (requestedPixels >= GPT_IMAGE_2_MIN_PIXELS && requestedPixels <= GPT_IMAGE_2_MAX_PIXELS) {
        targetPixelBuckets.push(
            clampNumber(requestedPixels * 0.75, GPT_IMAGE_2_MIN_PIXELS, GPT_IMAGE_2_MAX_PIXELS),
            clampNumber(requestedPixels * 1.25, GPT_IMAGE_2_MIN_PIXELS, GPT_IMAGE_2_MAX_PIXELS)
        );
    }

    const recommendations = new Map<string, GptImage2SizeRecommendation & { score: number; primary: boolean }>();
    for (const [index, bucketPixels] of targetPixelBuckets.entries()) {
        const candidate = findBestGptImage2SizeCandidate(targetRatio, bucketPixels);
        if (!candidate) continue;

        const key = `${candidate.width}x${candidate.height}`;
        const pixels = candidate.width * candidate.height;
        const existing = recommendations.get(key);
        const weightedScore = candidate.score + index / 100;
        if (existing && existing.score <= weightedScore) continue;

        recommendations.set(key, {
            width: candidate.width,
            height: candidate.height,
            ratio: candidate.width / candidate.height,
            pixels,
            comparison: getGptImage2RecommendationComparison(pixels, requestedPixels),
            wasAspectRatioClamped,
            wasPixelCountClamped,
            score: weightedScore,
            primary: bucketPixels === targetPixels
        });
    }

    const ranked = [...recommendations.values()].sort((a, b) => {
        if (a.primary !== b.primary) return a.primary ? -1 : 1;
        if (a.primary && b.primary) return a.score - b.score;
        return a.pixels - b.pixels || a.width - b.width || a.height - b.height;
    });

    return ranked.slice(0, GPT_IMAGE_2_RECOMMENDATION_LIMIT).map((item) => ({
        width: item.width,
        height: item.height,
        ratio: item.ratio,
        pixels: item.pixels,
        comparison: item.comparison,
        wasAspectRatioClamped: item.wasAspectRatioClamped,
        wasPixelCountClamped: item.wasPixelCountClamped
    }));
}

export function recommendGptImage2Size(width: number, height: number): GptImage2SizeRecommendation | null {
    return recommendGptImage2Sizes(width, height)[0] ?? null;
}

export function getGptImage2SizeRepairRecommendations(width: number, height: number): GptImage2SizeRecommendation[] {
    if (validateGptImage2Size(width, height).valid) return [];

    const recommendations = recommendGptImage2Sizes(width, height);
    const primaryRecommendation = recommendations[0];
    if (
        !primaryRecommendation ||
        (recommendations.length === 1 &&
            primaryRecommendation.width === width &&
            primaryRecommendation.height === height)
    ) {
        return [];
    }

    return recommendations;
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
    return (
        GPT_IMAGE_2_SIZE_PRESETS.find((preset) => preset.tier === tier && preset.ratio === ratio) ??
        GPT_IMAGE_2_SIZE_PRESETS.find((preset) => preset.tier === tier) ??
        GPT_IMAGE_2_SIZE_PRESETS[0]
    );
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
