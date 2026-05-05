import type { ImageModelId } from '@/lib/model-registry';
import type { ProviderOptions } from '@/lib/provider-options';

export type ProviderSizeOption = {
    value: string;
    label: string;
    description: string;
};

export type SeedreamResponseFormat = 'url' | 'b64_json';
export type SeedreamSequentialImageGeneration = 'disabled' | 'auto';
export type SeedreamOutputFormat = 'png' | 'jpeg';
export type SeedreamOptimizePromptMode = 'standard' | 'fast';

export type SeedreamAdvancedOptionsInput = {
    size?: string | null;
    responseFormat: SeedreamResponseFormat;
    watermark: boolean;
    sequentialImageGeneration: SeedreamSequentialImageGeneration;
    maxImages: number;
    seed?: number | null;
    guidanceScale?: number | null;
    outputFormat?: SeedreamOutputFormat | null;
    optimizePromptMode?: SeedreamOptimizePromptMode | null;
    webSearch?: boolean;
};

export type SeedreamCapabilityFlags = {
    supportsResolutionAliases: boolean;
    supportsSequentialGeneration: boolean;
    supportsSeed: boolean;
    supportsGuidanceScale: boolean;
    supportsOutputFormat: boolean;
    supportsOptimizePrompt: boolean;
    supportsWebSearch: boolean;
};

export const DEFAULT_SEEDREAM_ADVANCED_OPTIONS: SeedreamAdvancedOptionsInput = {
    size: null,
    responseFormat: 'url',
    watermark: false,
    sequentialImageGeneration: 'disabled',
    maxImages: 15,
    seed: null,
    guidanceScale: null,
    outputFormat: null,
    optimizePromptMode: 'standard',
    webSearch: false
};

export const SEEDREAM_RESPONSE_FORMAT_OPTIONS: readonly ProviderSizeOption[] = [
    { value: 'url', label: 'URL 链接', description: '返回 24 小时有效的图片下载链接，适合浏览器直连展示。' },
    { value: 'b64_json', label: 'Base64 JSON', description: '返回 Base64 图片数据，适合需要本地保存或避免外链失效的场景。' }
];

export const SENSENOVA_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    { value: '2048x2048', label: '1:1 正方形', description: '2048×2048 · SenseNova 2K' },
    { value: '2752x1536', label: '16:9 横向', description: '2752×1536 · 默认横向尺寸' },
    { value: '1536x2752', label: '9:16 纵向', description: '1536×2752 · 竖版封面/短视频' },
    { value: '2496x1664', label: '3:2 横向', description: '2496×1664 · 摄影常用比例' },
    { value: '1664x2496', label: '2:3 纵向', description: '1664×2496 · 海报/人像' },
    { value: '2368x1760', label: '4:3 横向', description: '2368×1760 · 通用横幅' },
    { value: '1760x2368', label: '3:4 纵向', description: '1760×2368 · 通用竖图' },
    { value: '2272x1824', label: '5:4 横向', description: '2272×1824 · 轻横幅' },
    { value: '1824x2272', label: '4:5 纵向', description: '1824×2272 · 社媒竖图' },
    { value: '3072x1376', label: '21:9 超宽', description: '3072×1376 · 电影宽屏' },
    { value: '1344x3136', label: '9:21 超竖', description: '1344×3136 · 长图/手机壁纸' }
];

const SEEDREAM_3_MODEL = 'doubao-seedream-3.0-t2i';
const SEEDREAM_4_PLUS_MODELS = new Set(['doubao-seedream-4.0-250828', 'doubao-seedream-4.5', 'doubao-seedream-5.0-lite']);
const SEEDREAM_5_LITE_MODEL = 'doubao-seedream-5.0-lite';

const SEEDREAM_1K_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    { value: '1024x1024', label: '1K · 1:1', description: '1024×1024' },
    { value: '1280x720', label: '1K · 16:9', description: '1280×720' },
    { value: '720x1280', label: '1K · 9:16', description: '720×1280' },
    { value: '1152x864', label: '1K · 4:3', description: '1152×864' },
    { value: '864x1152', label: '1K · 3:4', description: '864×1152' }
];

const SEEDREAM_2K_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    { value: '2K', label: '2K 自动比例', description: '让模型根据提示词判断比例；推荐默认。' },
    { value: '2048x2048', label: '2K · 1:1', description: '2048×2048' },
    { value: '2848x1600', label: '2K · 16:9', description: '2848×1600' },
    { value: '1600x2848', label: '2K · 9:16', description: '1600×2848' },
    { value: '2304x1728', label: '2K · 4:3', description: '2304×1728' },
    { value: '1728x2304', label: '2K · 3:4', description: '1728×2304' },
    { value: '2496x1664', label: '2K · 3:2', description: '2496×1664' },
    { value: '1664x2496', label: '2K · 2:3', description: '1664×2496' },
    { value: '3136x1344', label: '2K · 21:9', description: '3136×1344' }
];

const SEEDREAM_3K_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    { value: '3K', label: '3K 自动比例', description: 'Seedream 5.0 Lite 支持，模型自动判断比例。' },
    { value: '3072x3072', label: '3K · 1:1', description: '3072×3072' },
    { value: '4096x2304', label: '3K · 16:9', description: '4096×2304' },
    { value: '2304x4096', label: '3K · 9:16', description: '2304×4096' },
    { value: '3456x2592', label: '3K · 4:3', description: '3456×2592' },
    { value: '2592x3456', label: '3K · 3:4', description: '2592×3456' }
];

const SEEDREAM_4K_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    { value: '4K', label: '4K 自动比例', description: '模型自动判断比例；适合高分辨率输出。' },
    { value: '4096x4096', label: '4K · 1:1', description: '4096×4096' },
    { value: '5504x3040', label: '4K · 16:9', description: '5504×3040' },
    { value: '3040x5504', label: '4K · 9:16', description: '3040×5504' },
    { value: '4704x3520', label: '4K · 4:3', description: '4704×3520' },
    { value: '3520x4704', label: '4K · 3:4', description: '3520×4704' }
];

export function getSeedreamCapabilityFlags(model: ImageModelId): SeedreamCapabilityFlags {
    const modelId = String(model);
    const supportsFourthGenerationFeatures = SEEDREAM_4_PLUS_MODELS.has(modelId);

    return {
        supportsResolutionAliases: supportsFourthGenerationFeatures,
        supportsSequentialGeneration: supportsFourthGenerationFeatures,
        supportsSeed: modelId === SEEDREAM_3_MODEL,
        supportsGuidanceScale: modelId === SEEDREAM_3_MODEL,
        supportsOutputFormat: modelId === SEEDREAM_5_LITE_MODEL,
        supportsOptimizePrompt: supportsFourthGenerationFeatures,
        supportsWebSearch: modelId === SEEDREAM_5_LITE_MODEL
    };
}

export function getSeedreamSizeOptions(model: ImageModelId): readonly ProviderSizeOption[] {
    const modelId = String(model);
    if (modelId === SEEDREAM_3_MODEL) {
        return [
            { value: '1024x1024', label: '默认 1:1', description: '1024×1024 · Seedream 3.0 默认尺寸' },
            ...SEEDREAM_1K_SIZE_OPTIONS.filter((option) => option.value !== '1024x1024')
        ];
    }
    if (modelId === SEEDREAM_5_LITE_MODEL) {
        return [...SEEDREAM_2K_SIZE_OPTIONS, ...SEEDREAM_3K_SIZE_OPTIONS, ...SEEDREAM_4K_SIZE_OPTIONS];
    }
    if (modelId === 'doubao-seedream-4.0-250828') {
        return [...SEEDREAM_1K_SIZE_OPTIONS, ...SEEDREAM_2K_SIZE_OPTIONS, ...SEEDREAM_4K_SIZE_OPTIONS];
    }
    return [...SEEDREAM_2K_SIZE_OPTIONS, ...SEEDREAM_4K_SIZE_OPTIONS];
}

function clampInteger(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(Math.trunc(value), max));
}

function finiteNumber(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function buildSeedreamProviderOptions(model: ImageModelId, input: SeedreamAdvancedOptionsInput): ProviderOptions {
    const capabilities = getSeedreamCapabilityFlags(model);
    const options: ProviderOptions = {
        response_format: input.responseFormat,
        watermark: input.watermark
    };

    if (input.size) {
        options.size = input.size;
    }

    if (capabilities.supportsSequentialGeneration) {
        options.sequential_image_generation = input.sequentialImageGeneration;
        if (input.sequentialImageGeneration === 'auto') {
            options.sequential_image_generation_options = {
                max_images: clampInteger(input.maxImages, 1, 15)
            };
        }
    }

    if (capabilities.supportsSeed && finiteNumber(input.seed)) {
        options.seed = clampInteger(input.seed, -1, 2_147_483_647);
    }

    if (capabilities.supportsGuidanceScale && finiteNumber(input.guidanceScale)) {
        options.guidance_scale = Math.max(1, Math.min(input.guidanceScale, 10));
    }

    if (capabilities.supportsOutputFormat && input.outputFormat) {
        options.output_format = input.outputFormat;
    }

    if (capabilities.supportsOptimizePrompt && input.optimizePromptMode) {
        options.optimize_prompt_options = { mode: input.optimizePromptMode };
    }

    if (capabilities.supportsWebSearch && input.webSearch) {
        options.tools = [{ type: 'web_search' }];
    }

    return options;
}
