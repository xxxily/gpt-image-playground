export type ImageProviderId = 'openai' | 'google';

export type OpenAIImageModel = 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2';
export type GeminiImageModel = 'gemini-3.1-flash-image-preview';
export type KnownImageModelId = OpenAIImageModel | GeminiImageModel;
export type ImageModelId = KnownImageModelId | (string & {});

export type StoredCustomImageModel = {
    id: string;
    provider: ImageProviderId;
    label?: string;
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
    supportsBackground: boolean;
    supportsModeration: boolean;
    supportsCompression: boolean;
    custom?: boolean;
};

export const DEFAULT_IMAGE_MODEL: ImageModelId = 'gpt-image-2';
export const GEMINI_NANO_BANANA_2_MODEL: GeminiImageModel = 'gemini-3.1-flash-image-preview';

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
        supportsBackground: false,
        supportsModeration: false,
        supportsCompression: false
    }
];

export const IMAGE_MODEL_IDS = IMAGE_MODELS.map((model) => model.id);

export function isImageModelId(value: unknown): value is ImageModelId {
    return typeof value === 'string' && value.trim().length > 0;
}

function providerLabel(provider: ImageProviderId): string {
    return provider === 'google' ? 'Google' : 'OpenAI';
}

function inferProviderFromModelId(model: string): ImageProviderId {
    return model.toLowerCase().startsWith('gemini-') ? 'google' : 'openai';
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

        const provider = record.provider === 'google' ? 'google' : 'openai';
        const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : undefined;
        seen.add(id);
        result.push({ id, provider, label });
    });

    return result;
}

export function createCustomImageModelDefinition(customModel: StoredCustomImageModel): ImageModelDefinition {
    const provider = customModel.provider;

    return {
        id: customModel.id,
        label: customModel.label || customModel.id,
        provider,
        providerLabel: providerLabel(provider),
        supportsStreaming: false,
        supportsEditing: true,
        supportsMask: provider === 'openai',
        supportsCustomSize: false,
        supportsBackground: provider === 'openai',
        supportsModeration: provider === 'openai',
        supportsCompression: provider === 'openai',
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
