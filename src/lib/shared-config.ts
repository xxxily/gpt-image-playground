import type { AppConfig } from '@/lib/config';
import { getClientDirectLinkRestriction } from '@/lib/connection-policy';
import {
    getImageModel,
    IMAGE_MODEL_IDS,
    type ImageProviderId,
    type StoredCustomImageModel
} from '@/lib/model-registry';
import type { ParsedUrlParams } from '@/lib/url-params';

type BuildSharedConfigUpdatesOptions = {
    clientDirectLinkPriority?: boolean;
    modelFallback: string;
};

type ResolveClientDirectLinkConnectionModeOptions = {
    clientDirectLinkPriority?: boolean;
    model: string;
};

function hasNonEmptyValue(value: string | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export function shouldPromptForConfigPersistence(parsed: ParsedUrlParams): parsed is ParsedUrlParams & {
    apiKey: string;
    baseUrl: string;
    model: string;
} {
    return hasNonEmptyValue(parsed.apiKey) && hasNonEmptyValue(parsed.baseUrl) && hasNonEmptyValue(parsed.model);
}

export function buildPromptOnlyUrlParams(parsed: ParsedUrlParams): ParsedUrlParams {
    return parsed.prompt === undefined ? {} : { prompt: parsed.prompt };
}

export function buildSharedConfigUpdates(
    parsed: ParsedUrlParams,
    currentConfig: AppConfig,
    options: BuildSharedConfigUpdatesOptions
): Partial<AppConfig> {
    const configUpdates: Partial<AppConfig> = {};
    const normalizedCustomModels = currentConfig.customImageModels || [];
    const modelForProvider = parsed.model ?? options.modelFallback;
    const provider = getImageModel(modelForProvider, normalizedCustomModels).provider;

    if (parsed.apiKey !== undefined) {
        configUpdates[provider === 'google' ? 'geminiApiKey' : 'openaiApiKey'] = parsed.apiKey;
    }
    if (parsed.baseUrl !== undefined) {
        configUpdates[provider === 'google' ? 'geminiApiBaseUrl' : 'openaiApiBaseUrl'] = parsed.baseUrl;
    }

    if (parsed.model) {
        const customImageModels = getCustomImageModelUpdates(parsed.model, normalizedCustomModels);
        if (customImageModels) configUpdates.customImageModels = customImageModels;
    }

    const effectiveConfig = { ...currentConfig, ...configUpdates };
    const directLinkRestriction = getClientDirectLinkRestriction({
        enabled: options.clientDirectLinkPriority === true,
        providers: [provider],
        openaiApiBaseUrl: effectiveConfig.openaiApiBaseUrl,
        geminiApiBaseUrl: effectiveConfig.geminiApiBaseUrl
    });

    if (directLinkRestriction) {
        configUpdates.connectionMode = 'direct';
    }

    return configUpdates;
}

export function resolveClientDirectLinkConnectionMode(
    config: AppConfig,
    options: ResolveClientDirectLinkConnectionModeOptions
): AppConfig['connectionMode'] {
    const provider = getImageModel(options.model, config.customImageModels).provider;
    const directLinkRestriction = getClientDirectLinkRestriction({
        enabled: options.clientDirectLinkPriority === true,
        providers: [provider],
        openaiApiBaseUrl: config.openaiApiBaseUrl,
        geminiApiBaseUrl: config.geminiApiBaseUrl
    });

    return directLinkRestriction ? 'direct' : config.connectionMode;
}

function getCustomImageModelUpdates(
    model: string,
    normalizedCustomModels: StoredCustomImageModel[]
): StoredCustomImageModel[] | null {
    if (IMAGE_MODEL_IDS.includes(model)) return null;
    if (normalizedCustomModels.some((customModel) => customModel.id === model)) return null;

    const provider: ImageProviderId = getImageModel(model, normalizedCustomModels).provider;
    return [...normalizedCustomModels, { id: model, provider }];
}

export function maskSharedSecret(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '未提供';
    if (trimmed.length <= 8) return '已提供';
    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
