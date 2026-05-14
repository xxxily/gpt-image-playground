import type { ImageModelId } from '@/lib/model-registry';
import type { ProviderOptions } from '@/lib/provider-options';

export type ProviderSizeOption = {
    value: string;
    label: string;
    description: string;
    tier?: string;
    ratio?: string;
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
    {
        value: 'b64_json',
        label: 'Base64 JSON',
        description: '返回 Base64 图片数据，适合需要本地保存或避免外链失效的场景。'
    }
];

export const SENSENOVA_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    { value: '2048x2048', label: '2K · 1:1', description: '2048×2048 · 正方形', tier: '2K', ratio: '1:1' },
    { value: '2752x1536', label: '2K · 16:9', description: '2752×1536 · 默认横向尺寸', tier: '2K', ratio: '16:9' },
    { value: '1536x2752', label: '2K · 9:16', description: '1536×2752 · 竖版封面/短视频', tier: '2K', ratio: '9:16' },
    { value: '2496x1664', label: '2K · 3:2', description: '2496×1664 · 摄影常用比例', tier: '2K', ratio: '3:2' },
    { value: '1664x2496', label: '2K · 2:3', description: '1664×2496 · 海报/人像', tier: '2K', ratio: '2:3' },
    { value: '2368x1760', label: '2K · 4:3', description: '2368×1760 · 通用横幅', tier: '2K', ratio: '4:3' },
    { value: '1760x2368', label: '2K · 3:4', description: '1760×2368 · 通用竖图', tier: '2K', ratio: '3:4' },
    { value: '2272x1824', label: '2K · 5:4', description: '2272×1824 · 轻横幅', tier: '2K', ratio: '5:4' },
    { value: '1824x2272', label: '2K · 4:5', description: '1824×2272 · 社媒竖图', tier: '2K', ratio: '4:5' },
    { value: '3072x1376', label: '2K · 21:9', description: '3072×1376 · 电影宽屏', tier: '2K', ratio: '21:9' },
    { value: '1344x3136', label: '2K · 9:21', description: '1344×3136 · 长图/手机壁纸', tier: '2K', ratio: '9:21' }
];

function providerSizeOption(value: string, tier: string, ratio: string, suffix = ''): ProviderSizeOption {
    const formattedSize = value.replace('x', '×');
    return {
        value,
        tier,
        ratio,
        label: `${tier} · ${ratio}`,
        description: suffix ? `${formattedSize} · ${suffix}` : formattedSize
    };
}

const GEMINI_SIZE_TIERS = ['512', '1K', '2K', '4K'] as const;
const GEMINI_SIZE_ROWS: ReadonlyArray<{
    ratio: string;
    values: readonly [string, string, string, string];
}> = [
    { ratio: '1:1', values: ['512x512', '1024x1024', '2048x2048', '4096x4096'] },
    { ratio: '1:4', values: ['256x1024', '512x2048', '1024x4096', '2048x8192'] },
    { ratio: '1:8', values: ['192x1536', '384x3072', '768x6144', '1536x12288'] },
    { ratio: '2:3', values: ['424x632', '848x1264', '1696x2528', '3392x5056'] },
    { ratio: '3:2', values: ['632x424', '1264x848', '2528x1696', '5056x3392'] },
    { ratio: '3:4', values: ['448x600', '896x1200', '1792x2400', '3584x4800'] },
    { ratio: '4:1', values: ['1024x256', '2048x512', '4096x1024', '8192x2048'] },
    { ratio: '4:3', values: ['600x448', '1200x896', '2400x1792', '4800x3584'] },
    { ratio: '4:5', values: ['464x576', '928x1152', '1856x2304', '3712x4608'] },
    { ratio: '5:4', values: ['576x464', '1152x928', '2304x1856', '4608x3712'] },
    { ratio: '8:1', values: ['1536x192', '3072x384', '6144x768', '12288x1536'] },
    { ratio: '9:16', values: ['384x688', '768x1376', '1536x2752', '3072x5504'] },
    { ratio: '16:9', values: ['688x384', '1376x768', '2752x1536', '5504x3072'] },
    { ratio: '21:9', values: ['792x168', '1584x672', '3168x1344', '6336x2688'] }
];

export const GEMINI_SIZE_OPTIONS: readonly ProviderSizeOption[] = GEMINI_SIZE_TIERS.flatMap((tier, tierIndex) =>
    GEMINI_SIZE_ROWS.map(({ ratio, values }) =>
        providerSizeOption(values[tierIndex], tier, ratio, 'Gemini 3.1 Flash Image Preview')
    )
);

const SEEDREAM_3_MODEL = 'doubao-seedream-3.0-t2i';
const SEEDREAM_4_PLUS_MODELS = new Set([
    'doubao-seedream-4.0-250828',
    'doubao-seedream-4.5',
    'doubao-seedream-5.0-lite'
]);
const SEEDREAM_5_LITE_MODEL = 'doubao-seedream-5.0-lite';

const SEEDREAM_1K_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    providerSizeOption('1024x1024', '1K', '1:1'),
    providerSizeOption('1280x720', '1K', '16:9'),
    providerSizeOption('720x1280', '1K', '9:16'),
    providerSizeOption('1152x864', '1K', '4:3'),
    providerSizeOption('864x1152', '1K', '3:4')
];

const SEEDREAM_2K_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    providerSizeOption('2048x2048', '2K', '1:1'),
    providerSizeOption('2848x1600', '2K', '16:9'),
    providerSizeOption('1600x2848', '2K', '9:16'),
    providerSizeOption('2304x1728', '2K', '4:3'),
    providerSizeOption('1728x2304', '2K', '3:4'),
    providerSizeOption('2496x1664', '2K', '3:2'),
    providerSizeOption('1664x2496', '2K', '2:3'),
    providerSizeOption('3136x1344', '2K', '21:9')
];

const SEEDREAM_3K_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    providerSizeOption('3072x3072', '3K', '1:1'),
    providerSizeOption('4096x2304', '3K', '16:9'),
    providerSizeOption('2304x4096', '3K', '9:16'),
    providerSizeOption('3456x2592', '3K', '4:3'),
    providerSizeOption('2592x3456', '3K', '3:4')
];

const SEEDREAM_4K_SIZE_OPTIONS: readonly ProviderSizeOption[] = [
    providerSizeOption('4096x4096', '4K', '1:1'),
    providerSizeOption('5504x3040', '4K', '16:9'),
    providerSizeOption('3040x5504', '4K', '9:16'),
    providerSizeOption('4704x3520', '4K', '4:3'),
    providerSizeOption('3520x4704', '4K', '3:4')
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
            providerSizeOption('1024x1024', '1K', '1:1', 'Seedream 3.0 默认尺寸'),
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

export function buildSeedreamProviderOptions(
    model: ImageModelId,
    input: SeedreamAdvancedOptionsInput
): ProviderOptions {
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
