import type {
    VisionTextDetail,
    VisionTextProviderKind
} from '@/lib/vision-text-types';
import {
    DEFAULT_VISION_TEXT_DETAIL,
    DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS
} from '@/lib/vision-text-types';

export type VisionTextModelDefinition = {
    id: string;
    label: string;
    providerKind: VisionTextProviderKind;
    supportsStreaming: boolean;
    supportsStructuredOutput: boolean;
    supportsVisionDetail: boolean;
    defaultDetail: VisionTextDetail;
    maxImages: number;
    maxImageBytes?: number;
    maxOutputTokens?: number;
};

export const DEFAULT_VISION_TEXT_MODEL = 'gpt-5.5';
export const VISION_TEXT_MODEL_IDS = ['gpt-5.5', 'gpt-5.4'] as const;

export const VISION_TEXT_MODELS: readonly VisionTextModelDefinition[] = [
    {
        id: 'gpt-5.5',
        label: 'gpt-5.5',
        providerKind: 'openai',
        supportsStreaming: true,
        supportsStructuredOutput: true,
        supportsVisionDetail: true,
        defaultDetail: DEFAULT_VISION_TEXT_DETAIL,
        maxImages: 10,
        maxImageBytes: 50 * 1024 * 1024,
        maxOutputTokens: DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS
    },
    {
        id: 'gpt-5.4',
        label: 'gpt-5.4',
        providerKind: 'openai',
        supportsStreaming: true,
        supportsStructuredOutput: true,
        supportsVisionDetail: true,
        defaultDetail: DEFAULT_VISION_TEXT_DETAIL,
        maxImages: 10,
        maxImageBytes: 50 * 1024 * 1024,
        maxOutputTokens: DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS
    }
] as const;

function asVisionTextModelId(value: string): string {
    return value.trim();
}

export function isVisionTextModelId(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export function getVisionTextModelDefinition(
    modelId: string,
    providerKind: VisionTextProviderKind = 'openai'
): VisionTextModelDefinition {
    const normalizedId = asVisionTextModelId(modelId);
    const builtIn = VISION_TEXT_MODELS.find((model) => model.id === normalizedId);
    if (builtIn) {
        return builtIn;
    }

    return {
        id: normalizedId,
        label: normalizedId,
        providerKind,
        supportsStreaming: true,
        supportsStructuredOutput: true,
        supportsVisionDetail: true,
        defaultDetail: DEFAULT_VISION_TEXT_DETAIL,
        maxImages: 10,
        maxImageBytes: 50 * 1024 * 1024,
        maxOutputTokens: DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS
    };
}

export function getVisionTextModelDefinitions(
    modelIds: readonly string[] = [],
    providerKind: VisionTextProviderKind = 'openai'
): readonly VisionTextModelDefinition[] {
    const ids = modelIds.length > 0 ? modelIds : [...VISION_TEXT_MODEL_IDS];
    return ids.map((modelId) => getVisionTextModelDefinition(modelId, providerKind));
}

export function normalizeVisionTextModelIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    const seen = new Set<string>();
    const result: string[] = [];
    value.forEach((item) => {
        if (typeof item !== 'string') return;
        const id = item.trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        result.push(id);
    });
    return result;
}

