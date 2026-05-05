import { isProviderOptions, type ProviderOptions } from '@/lib/provider-options';

export type ImageProviderId = 'openai' | 'google' | 'sensenova' | 'seedream';
export const IMAGE_PROVIDER_ORDER: readonly ImageProviderId[] = ['openai', 'google', 'seedream', 'sensenova'];

export type OpenAIImageModel = 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2';
export type GeminiImageModel = 'gemini-3.1-flash-image-preview';
export type SenseNovaImageModel = 'sensenova-u1-fast';
export type SeedreamImageModel = 'doubao-seedream-5.0-lite' | 'doubao-seedream-4.5' | 'doubao-seedream-4.0-250828' | 'doubao-seedream-3.0-t2i';
export type KnownImageModelId = OpenAIImageModel | GeminiImageModel | SenseNovaImageModel | SeedreamImageModel;
export type ImageModelId = KnownImageModelId | (string & {});

export type CustomImageModelCapabilities = {
    supportsStreaming?: boolean;
    supportsEditing?: boolean;
    supportsMask?: boolean;
    supportsCustomSize?: boolean;
    supportsQuality?: boolean;
    supportsOutputFormat?: boolean;
    supportsBackground?: boolean;
    supportsModeration?: boolean;
    supportsCompression?: boolean;
};

export type ImageModelSizePresets = {
    square?: string;
    landscape?: string;
    portrait?: string;
};

export type StoredCustomImageModel = {
    id: string;
    provider: ImageProviderId;
    label?: string;
    capabilities?: CustomImageModelCapabilities;
    sizePresets?: ImageModelSizePresets;
    defaultSize?: string;
    providerOptions?: ProviderOptions;
};

function asKnownImageModelId(value: string): KnownImageModelId {
    return value as KnownImageModelId;
}

export type ImageModelDefinition = {
    id: string;
    label: string;
    provider: ImageProviderId;
    providerLabel: string;
    supportsStreaming: boolean;
    supportsEditing: boolean;
    supportsMask: boolean;
    supportsCustomSize: boolean;
    supportsQuality: boolean;
    supportsOutputFormat: boolean;
    supportsBackground: boolean;
    supportsModeration: boolean;
    supportsCompression: boolean;
    sizePresets?: ImageModelSizePresets;
    defaultSize?: string;
    providerOptions?: ProviderOptions;
    custom?: boolean;
};

export type ImageModelProviderGroup = {
    provider: ImageProviderId;
    providerLabel: string;
    models: readonly ImageModelDefinition[];
};

export const DEFAULT_IMAGE_MODEL: ImageModelId = 'gpt-image-2';
export const GEMINI_NANO_BANANA_2_MODEL: GeminiImageModel = 'gemini-3.1-flash-image-preview';
export const SENSENOVA_U1_FAST_MODEL: SenseNovaImageModel = 'sensenova-u1-fast';
export const SEEDREAM_5_LITE_MODEL: SeedreamImageModel = 'doubao-seedream-5.0-lite';

export const IMAGE_MODELS: readonly ImageModelDefinition[] = [
    {
        id: asKnownImageModelId('gpt-image-2'),
        label: 'gpt-image-2',
        provider: 'openai',
        providerLabel: 'OpenAI',
        supportsStreaming: true,
        supportsEditing: true,
        supportsMask: true,
        supportsCustomSize: true,
        supportsQuality: true,
        supportsOutputFormat: true,
        supportsBackground: false,
        supportsModeration: true,
        supportsCompression: true
    },
    {
        id: asKnownImageModelId('gpt-image-1.5'),
        label: 'gpt-image-1.5',
        provider: 'openai',
        providerLabel: 'OpenAI',
        supportsStreaming: true,
        supportsEditing: true,
        supportsMask: true,
        supportsCustomSize: false,
        supportsQuality: true,
        supportsOutputFormat: true,
        supportsBackground: true,
        supportsModeration: true,
        supportsCompression: true
    },
    {
        id: asKnownImageModelId('gpt-image-1'),
        label: 'gpt-image-1',
        provider: 'openai',
        providerLabel: 'OpenAI',
        supportsStreaming: true,
        supportsEditing: true,
        supportsMask: true,
        supportsCustomSize: false,
        supportsQuality: true,
        supportsOutputFormat: true,
        supportsBackground: true,
        supportsModeration: true,
        supportsCompression: true
    },
    {
        id: asKnownImageModelId('gpt-image-1-mini'),
        label: 'gpt-image-1-mini',
        provider: 'openai',
        providerLabel: 'OpenAI',
        supportsStreaming: true,
        supportsEditing: true,
        supportsMask: true,
        supportsCustomSize: false,
        supportsQuality: true,
        supportsOutputFormat: true,
        supportsBackground: true,
        supportsModeration: true,
        supportsCompression: true
    },
    {
        id: asKnownImageModelId(GEMINI_NANO_BANANA_2_MODEL),
        label: 'Gemini Nano Banana 2',
        provider: 'google',
        providerLabel: 'Google',
        supportsStreaming: false,
        supportsEditing: true,
        supportsMask: false,
        supportsCustomSize: false,
        supportsQuality: false,
        supportsOutputFormat: false,
        supportsBackground: false,
        supportsModeration: false,
        supportsCompression: false
    },
    {
        id: asKnownImageModelId(SENSENOVA_U1_FAST_MODEL),
        label: 'SenseNova U1 Fast',
        provider: 'sensenova',
        providerLabel: 'SenseNova',
        supportsStreaming: false,
        supportsEditing: false,
        supportsMask: false,
        supportsCustomSize: true,
        supportsQuality: false,
        supportsOutputFormat: false,
        supportsBackground: false,
        supportsModeration: false,
        supportsCompression: false,
        defaultSize: '2752x1536',
        sizePresets: {
            square: '2048x2048',
            landscape: '2752x1536',
            portrait: '1536x2752'
        }
    },
    {
        id: asKnownImageModelId(SEEDREAM_5_LITE_MODEL),
        label: 'Doubao Seedream 5.0 Lite',
        provider: 'seedream',
        providerLabel: 'Seedream',
        supportsStreaming: false,
        supportsEditing: true,
        supportsMask: false,
        supportsCustomSize: true,
        supportsQuality: false,
        supportsOutputFormat: true,
        supportsBackground: false,
        supportsModeration: false,
        supportsCompression: false,
        defaultSize: '2K',
        sizePresets: {
            square: '2048x2048',
            landscape: '2560x1440',
            portrait: '1440x2560'
        },
        providerOptions: { response_format: 'url', watermark: false }
    },
    {
        id: asKnownImageModelId('doubao-seedream-4.5'),
        label: 'Doubao Seedream 4.5',
        provider: 'seedream',
        providerLabel: 'Seedream',
        supportsStreaming: false,
        supportsEditing: true,
        supportsMask: false,
        supportsCustomSize: true,
        supportsQuality: false,
        supportsOutputFormat: false,
        supportsBackground: false,
        supportsModeration: false,
        supportsCompression: false,
        defaultSize: '2K',
        sizePresets: {
            square: '2048x2048',
            landscape: '2560x1440',
            portrait: '1440x2560'
        },
        providerOptions: { response_format: 'url', watermark: false }
    },
    {
        id: asKnownImageModelId('doubao-seedream-4.0-250828'),
        label: 'Doubao Seedream 4.0',
        provider: 'seedream',
        providerLabel: 'Seedream',
        supportsStreaming: false,
        supportsEditing: true,
        supportsMask: false,
        supportsCustomSize: true,
        supportsQuality: false,
        supportsOutputFormat: false,
        supportsBackground: false,
        supportsModeration: false,
        supportsCompression: false,
        defaultSize: '2K',
        sizePresets: {
            square: '2048x2048',
            landscape: '2560x1440',
            portrait: '1440x2560'
        },
        providerOptions: { response_format: 'url', watermark: false }
    },
    {
        id: asKnownImageModelId('doubao-seedream-3.0-t2i'),
        label: 'Doubao Seedream 3.0 T2I',
        provider: 'seedream',
        providerLabel: 'Seedream',
        supportsStreaming: false,
        supportsEditing: false,
        supportsMask: false,
        supportsCustomSize: true,
        supportsQuality: false,
        supportsOutputFormat: false,
        supportsBackground: false,
        supportsModeration: false,
        supportsCompression: false,
        defaultSize: '2K',
        sizePresets: {
            square: '2048x2048',
            landscape: '2560x1440',
            portrait: '1440x2560'
        }
    }
];

export const IMAGE_MODEL_IDS = IMAGE_MODELS.map((model) => model.id);

export function isImageModelId(value: unknown): value is ImageModelId {
    return typeof value === 'string' && value.trim().length > 0;
}

export function isImageProviderId(value: unknown): value is ImageProviderId {
    return value === 'openai' || value === 'google' || value === 'sensenova' || value === 'seedream';
}

export function getProviderLabel(provider: ImageProviderId): string {
    if (provider === 'google') return 'Google Gemini';
    if (provider === 'sensenova') return 'SenseNova';
    if (provider === 'seedream') return 'Seedream';
    return 'OpenAI Compatible';
}

function inferProviderFromModelId(model: string): ImageProviderId {
    const normalized = model.toLowerCase();
    if (normalized.startsWith('gemini-')) return 'google';
    if (normalized.startsWith('sensenova-')) return 'sensenova';
    if (normalized.startsWith('doubao-seedream-') || normalized.startsWith('doubao-seededit-')) return 'seedream';
    return 'openai';
}

function normalizeProvider(value: unknown): ImageProviderId {
    if (value === 'google' || value === 'sensenova' || value === 'seedream') return value;
    return 'openai';
}

function optionalBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
}

function normalizeCapabilities(value: unknown): CustomImageModelCapabilities | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

    const record = value as Record<string, unknown>;
    const capabilities: CustomImageModelCapabilities = {};
    const supportsStreaming = optionalBoolean(record.supportsStreaming);
    const supportsEditing = optionalBoolean(record.supportsEditing);
    const supportsMask = optionalBoolean(record.supportsMask);
    const supportsCustomSize = optionalBoolean(record.supportsCustomSize);
    const supportsQuality = optionalBoolean(record.supportsQuality);
    const supportsOutputFormat = optionalBoolean(record.supportsOutputFormat);
    const supportsBackground = optionalBoolean(record.supportsBackground);
    const supportsModeration = optionalBoolean(record.supportsModeration);
    const supportsCompression = optionalBoolean(record.supportsCompression);

    if (supportsStreaming !== undefined) capabilities.supportsStreaming = supportsStreaming;
    if (supportsEditing !== undefined) capabilities.supportsEditing = supportsEditing;
    if (supportsMask !== undefined) capabilities.supportsMask = supportsMask;
    if (supportsCustomSize !== undefined) capabilities.supportsCustomSize = supportsCustomSize;
    if (supportsQuality !== undefined) capabilities.supportsQuality = supportsQuality;
    if (supportsOutputFormat !== undefined) capabilities.supportsOutputFormat = supportsOutputFormat;
    if (supportsBackground !== undefined) capabilities.supportsBackground = supportsBackground;
    if (supportsModeration !== undefined) capabilities.supportsModeration = supportsModeration;
    if (supportsCompression !== undefined) capabilities.supportsCompression = supportsCompression;

    return Object.values(capabilities).some((item) => item !== undefined) ? capabilities : undefined;
}

function normalizeSizePresets(value: unknown): ImageModelSizePresets | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

    const record = value as Record<string, unknown>;
    const presets: ImageModelSizePresets = {};
    if (typeof record.square === 'string' && record.square.trim()) presets.square = record.square.trim();
    if (typeof record.landscape === 'string' && record.landscape.trim()) presets.landscape = record.landscape.trim();
    if (typeof record.portrait === 'string' && record.portrait.trim()) presets.portrait = record.portrait.trim();

    return Object.keys(presets).length > 0 ? presets : undefined;
}

export function normalizeCustomImageModels(value: unknown): StoredCustomImageModel[] {
    if (!Array.isArray(value)) return [];

    const seen = new Set<string>();
    const result: StoredCustomImageModel[] = [];

    value.forEach((item) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) return;

        const record = item as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        if (!id || seen.has(id) || IMAGE_MODEL_IDS.includes(id as KnownImageModelId)) return;

        const provider = normalizeProvider(record.provider);
        const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : undefined;
        const capabilities = normalizeCapabilities(record.capabilities);
        const sizePresets = normalizeSizePresets(record.sizePresets);
        const defaultSize = typeof record.defaultSize === 'string' && record.defaultSize.trim() ? record.defaultSize.trim() : undefined;
        const providerOptions = isProviderOptions(record.providerOptions) ? record.providerOptions : undefined;
        seen.add(id);
        result.push({
            id,
            provider,
            ...(label && { label }),
            ...(capabilities && { capabilities }),
            ...(sizePresets && { sizePresets }),
            ...(defaultSize && { defaultSize }),
            ...(providerOptions && { providerOptions })
        });
    });

    return result;
}

export function createCustomImageModelDefinition(customModel: StoredCustomImageModel): ImageModelDefinition {
    const provider = customModel.provider;
    const openAICompatible = provider === 'openai' || provider === 'sensenova' || provider === 'seedream';
    const capabilities = customModel.capabilities ?? {};

    return {
        id: customModel.id,
        label: customModel.label || customModel.id,
        provider,
        providerLabel: getProviderLabel(provider),
        supportsStreaming: capabilities.supportsStreaming ?? false,
        supportsEditing: capabilities.supportsEditing ?? openAICompatible,
        supportsMask: capabilities.supportsMask ?? provider === 'openai',
        supportsCustomSize: capabilities.supportsCustomSize ?? false,
        supportsQuality: capabilities.supportsQuality ?? provider === 'openai',
        supportsOutputFormat: capabilities.supportsOutputFormat ?? provider === 'openai',
        supportsBackground: capabilities.supportsBackground ?? provider === 'openai',
        supportsModeration: capabilities.supportsModeration ?? provider === 'openai',
        supportsCompression: capabilities.supportsCompression ?? provider === 'openai',
        sizePresets: customModel.sizePresets,
        defaultSize: customModel.defaultSize,
        providerOptions: customModel.providerOptions,
        custom: true
    };
}

export function getAllImageModels(customModels: readonly StoredCustomImageModel[] = []): readonly ImageModelDefinition[] {
    const knownIds = new Set(IMAGE_MODEL_IDS);
    const normalizedCustomModels = normalizeCustomImageModels(customModels)
        .filter((model) => !knownIds.has(model.id as KnownImageModelId))
        .map(createCustomImageModelDefinition);

    return [...IMAGE_MODELS, ...normalizedCustomModels];
}

export function getImageModelProviderGroups(
    customModels: readonly StoredCustomImageModel[] = []
): readonly ImageModelProviderGroup[] {
    const groups = new Map<ImageProviderId, ImageModelDefinition[]>();

    getAllImageModels(customModels).forEach((model) => {
        const providerModels = groups.get(model.provider) ?? [];
        providerModels.push(model);
        groups.set(model.provider, providerModels);
    });

    return IMAGE_PROVIDER_ORDER
        .map((provider) => {
            const models = groups.get(provider) ?? [];
            return {
                provider,
                providerLabel: getProviderLabel(provider),
                models
            };
        })
        .filter((group) => group.models.length > 0);
}

export function getFirstImageModelForProvider(
    provider: ImageProviderId,
    customModels: readonly StoredCustomImageModel[] = []
): ImageModelDefinition | null {
    return getAllImageModels(customModels).find((model) => model.provider === provider) ?? null;
}

export function getImageModel(
    model: ImageModelId,
    customModels: readonly StoredCustomImageModel[] = []
): ImageModelDefinition {
    const builtin = IMAGE_MODELS.find((item) => item.id === model);
    if (builtin) return builtin;

    const custom = normalizeCustomImageModels(customModels).find((item) => item.id === model);
    if (custom) return createCustomImageModelDefinition(custom);

    const id = String(model).trim() || DEFAULT_IMAGE_MODEL;
    return createCustomImageModelDefinition({
        id,
        provider: inferProviderFromModelId(id)
    });
}

export function getModelProvider(
    model: ImageModelId,
    customModels: readonly StoredCustomImageModel[] = []
): ImageProviderId {
    return getImageModel(model, customModels).provider;
}

export function isOpenAIImageModel(
    value: unknown,
    customModels: readonly StoredCustomImageModel[] = []
): value is ImageModelId {
    return isImageModelId(value) && getImageModel(value, customModels).provider === 'openai';
}
