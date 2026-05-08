import type { AppConfig } from '@/lib/config';
import { getClientDirectLinkRestriction } from '@/lib/connection-policy';
import {
    getProviderConfigFieldNames,
    getProviderCredentialConfig,
    normalizeOpenAICompatibleBaseUrl
} from '@/lib/provider-config';
import {
    getImageModel,
    IMAGE_MODEL_IDS,
    type ImageProviderId,
    type StoredCustomImageModel
} from '@/lib/model-registry';
import {
    getDefaultProviderInstanceName,
    getProviderInstance,
    normalizeProviderInstances,
    type ProviderInstance
} from '@/lib/provider-instances';
import type { ParsedUrlParams } from '@/lib/url-params';

type BuildSharedConfigUpdatesOptions = {
    clientDirectLinkPriority?: boolean;
    modelFallback: string;
};

type ResolveClientDirectLinkConnectionModeOptions = {
    clientDirectLinkPriority?: boolean;
    model: string;
    providerInstanceId?: string;
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

export function hasMatchingStoredSharedConfig(parsed: ParsedUrlParams, storedConfig: AppConfig): boolean {
    if (!shouldPromptForConfigPersistence(parsed)) return false;

    const provider = getImageModel(parsed.model, storedConfig.customImageModels).provider;
    const storedProviderConfig = getProviderCredentialConfig(storedConfig, provider, parsed.providerInstanceId);
    const storedApiKey = storedProviderConfig.apiKey.trim();
    const storedBaseUrl = provider === 'openai'
        ? normalizeOpenAICompatibleBaseUrl(storedProviderConfig.apiBaseUrl)
        : storedProviderConfig.apiBaseUrl.trim();
    const sharedBaseUrl = provider === 'openai'
        ? normalizeOpenAICompatibleBaseUrl(parsed.baseUrl)
        : parsed.baseUrl.trim();

    return storedApiKey === parsed.apiKey.trim() && storedBaseUrl === sharedBaseUrl;
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
    const normalizedProviderInstances = normalizeProviderInstances(currentConfig.providerInstances, currentConfig);
    const targetInstance = getProviderInstance(
        normalizedProviderInstances,
        provider,
        parsed.providerInstanceId || currentConfig.selectedProviderInstanceId || undefined
    );

    if (parsed.apiKey !== undefined) {
        configUpdates[getProviderConfigFieldNames(provider).apiKey] = parsed.apiKey;
    }
    if (parsed.baseUrl !== undefined) {
        configUpdates[getProviderConfigFieldNames(provider).apiBaseUrl] = parsed.baseUrl;
    }

    if (parsed.model) {
        const customImageModels = getCustomImageModelUpdates(parsed.model, normalizedCustomModels, targetInstance.id);
        if (customImageModels) configUpdates.customImageModels = customImageModels;
    }

    if (parsed.providerInstanceId !== undefined) {
        configUpdates.selectedProviderInstanceId = targetInstance.id;
    }

    if (parsed.apiKey !== undefined || parsed.baseUrl !== undefined || parsed.model !== undefined) {
        configUpdates.providerInstances = upsertSharedProviderInstance(
            normalizedProviderInstances,
            targetInstance,
            {
                apiKey: parsed.apiKey,
                apiBaseUrl: parsed.baseUrl,
                model: parsed.model
            }
        );
    }

    const effectiveConfig = { ...currentConfig, ...configUpdates };
    const effectiveInstance = getProviderInstance(effectiveConfig.providerInstances, provider, targetInstance.id);
    const directLinkRestriction = getClientDirectLinkRestriction({
        enabled: options.clientDirectLinkPriority === true,
        providers: [provider],
        providerInstances: [effectiveInstance],
        openaiApiBaseUrl: effectiveConfig.openaiApiBaseUrl,
        geminiApiBaseUrl: effectiveConfig.geminiApiBaseUrl,
        sensenovaApiBaseUrl: effectiveConfig.sensenovaApiBaseUrl,
        seedreamApiBaseUrl: effectiveConfig.seedreamApiBaseUrl
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
    const selectedInstance = getProviderInstance(config.providerInstances, provider, options.providerInstanceId || config.selectedProviderInstanceId || undefined);
    const directLinkRestriction = getClientDirectLinkRestriction({
        enabled: options.clientDirectLinkPriority === true,
        providers: [provider],
        providerInstances: [selectedInstance],
        openaiApiBaseUrl: config.openaiApiBaseUrl,
        geminiApiBaseUrl: config.geminiApiBaseUrl,
        sensenovaApiBaseUrl: config.sensenovaApiBaseUrl,
        seedreamApiBaseUrl: config.seedreamApiBaseUrl
    });

    return directLinkRestriction ? 'direct' : config.connectionMode;
}

function getCustomImageModelUpdates(
    model: string,
    normalizedCustomModels: StoredCustomImageModel[],
    instanceId?: string
): StoredCustomImageModel[] | null {
    if (IMAGE_MODEL_IDS.includes(model)) return null;
    if (normalizedCustomModels.some((customModel) => customModel.id === model)) return null;

    const provider: ImageProviderId = getImageModel(model, normalizedCustomModels).provider;
    return [...normalizedCustomModels, { id: model, provider, ...(instanceId && { instanceId }) }];
}

function upsertSharedProviderInstance(
    providerInstances: readonly ProviderInstance[],
    targetInstance: ProviderInstance,
    updates: { apiKey?: string; apiBaseUrl?: string; model?: string }
): ProviderInstance[] {
    const nextInstance: ProviderInstance = {
        ...targetInstance,
        apiKey: updates.apiKey !== undefined ? updates.apiKey : targetInstance.apiKey,
        apiBaseUrl: updates.apiBaseUrl !== undefined ? updates.apiBaseUrl : targetInstance.apiBaseUrl,
        models: updates.model && !targetInstance.models.includes(updates.model)
            ? [...targetInstance.models, updates.model]
            : targetInstance.models
    };

    if (!targetInstance.name.trim() || (updates.apiBaseUrl !== undefined && targetInstance.name === targetInstance.type)) {
        nextInstance.name = getDefaultProviderInstanceName(targetInstance.type, nextInstance.apiBaseUrl);
    }

    let updated = false;
    const result = providerInstances.map((instance) => {
        if (instance.id !== targetInstance.id) return instance;
        updated = true;
        return nextInstance;
    });

    return updated ? result : [...result, nextInstance];
}

export function maskSharedSecret(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '未提供';
    if (trimmed.length <= 8) return '已提供';
    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
