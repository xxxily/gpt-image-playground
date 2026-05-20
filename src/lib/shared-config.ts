import type { AppConfig } from '@/lib/config';
import { getClientDirectLinkRestriction } from '@/lib/connection-policy';
import {
    getImageModel,
    IMAGE_MODEL_IDS,
    type ImageProviderId,
    type StoredCustomImageModel
} from '@/lib/model-registry';
import {
    getProviderConfigFieldNames,
    getProviderCredentialConfig,
    getProviderDefaultBaseUrl,
    normalizeOpenAICompatibleBaseUrl
} from '@/lib/provider-config';
import {
    getDefaultProviderInstanceName,
    getProviderInstanceDefaultId,
    getProviderInstance,
    normalizeProviderInstances,
    createProviderInstanceId,
    type ProviderInstance
} from '@/lib/provider-instances';
import { normalizeUnifiedProviderModelConfig } from '@/lib/provider-model-catalog';
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

function normalizeSharedBaseUrl(provider: ImageProviderId, baseUrl: string): string {
    return provider === 'openai' ? normalizeOpenAICompatibleBaseUrl(baseUrl) : baseUrl.trim();
}

function findProviderInstanceByBaseUrl(
    providerInstances: readonly ProviderInstance[],
    provider: ImageProviderId,
    baseUrl: string
): ProviderInstance | null {
    const normalizedBaseUrl = normalizeSharedBaseUrl(provider, baseUrl);
    if (!normalizedBaseUrl) return null;

    const matchingInstance =
        providerInstances.find(
            (instance) =>
                instance.type === provider &&
                normalizeSharedBaseUrl(provider, instance.apiBaseUrl) === normalizedBaseUrl
        ) || null;
    if (matchingInstance) return matchingInstance;

    const defaultBaseUrl = normalizeSharedBaseUrl(provider, getProviderDefaultBaseUrl(provider));
    if (normalizedBaseUrl === defaultBaseUrl) {
        return providerInstances.find((instance) => instance.type === provider && instance.isDefault) || null;
    }

    return null;
}

function resolveSharedProviderInstanceId(
    provider: ImageProviderId,
    baseUrl: string,
    preferredId: string | undefined,
    existingIds: readonly string[]
): string {
    const trimmedPreferredId = preferredId?.trim() || '';
    if (trimmedPreferredId) return trimmedPreferredId;

    return createProviderInstanceId(provider, baseUrl || provider, existingIds);
}

function createSharedProviderTargetInstance(
    provider: ImageProviderId,
    baseUrl: string,
    preferredId: string | undefined,
    providerInstances: readonly ProviderInstance[]
): ProviderInstance {
    const trimmedPreferredId = preferredId?.trim() || '';
    if (trimmedPreferredId) {
        const existingInstance = providerInstances.find(
            (instance) => instance.type === provider && instance.id === trimmedPreferredId
        );
        if (existingInstance) return existingInstance;
    }

    const id = resolveSharedProviderInstanceId(
        provider,
        baseUrl,
        trimmedPreferredId || undefined,
        providerInstances.map((instance) => instance.id)
    );

    return {
        id,
        type: provider,
        name: getDefaultProviderInstanceName(provider, baseUrl),
        apiKey: '',
        apiBaseUrl: '',
        models: []
    };
}

export function shouldPromptForConfigPersistence(parsed: ParsedUrlParams): parsed is ParsedUrlParams & {
    apiKey: string;
    baseUrl: string;
    model: string;
} {
    return (
        parsed.apiKeyTempOnly !== true &&
        hasNonEmptyValue(parsed.apiKey) &&
        hasNonEmptyValue(parsed.baseUrl) &&
        hasNonEmptyValue(parsed.model)
    );
}

export function hasMatchingStoredSharedConfig(parsed: ParsedUrlParams, storedConfig: AppConfig): boolean {
    if (!shouldPromptForConfigPersistence(parsed)) return false;

    const provider = getImageModel(parsed.model, storedConfig.customImageModels).provider;
    const storedProviderConfig = getProviderCredentialConfig(storedConfig, provider, parsed.providerInstanceId);
    const storedApiKey = storedProviderConfig.apiKey.trim();
    const storedBaseUrl = normalizeSharedBaseUrl(provider, storedProviderConfig.apiBaseUrl);
    const sharedBaseUrl = normalizeSharedBaseUrl(provider, parsed.baseUrl);

    const matchingInstance = normalizeProviderInstances(storedConfig.providerInstances, storedConfig).find(
        (instance) => {
            if (instance.type !== provider) return false;
            const credentials = getProviderCredentialConfig(storedConfig, provider, instance.id);
            return (
                credentials.apiKey.trim() === parsed.apiKey.trim() &&
                normalizeSharedBaseUrl(provider, credentials.apiBaseUrl) === sharedBaseUrl
            );
        }
    );
    if (matchingInstance) return true;

    return storedApiKey === parsed.apiKey.trim() && storedBaseUrl === sharedBaseUrl;
}

export function buildPromptOnlyUrlParams(parsed: ParsedUrlParams): ParsedUrlParams {
    const result: ParsedUrlParams = {};
    if (parsed.prompt !== undefined) result.prompt = parsed.prompt;
    if (parsed.promoProfileId !== undefined) result.promoProfileId = parsed.promoProfileId;
    return result;
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
    const hasBaseUrl = parsed.baseUrl !== undefined;
    const matchingInstance = hasBaseUrl
        ? findProviderInstanceByBaseUrl(normalizedProviderInstances, provider, parsed.baseUrl || '')
        : null;
    const targetInstance = matchingInstance
        ? matchingInstance
        : hasBaseUrl
          ? createSharedProviderTargetInstance(
                provider,
                parsed.baseUrl || '',
                parsed.providerInstanceId,
                normalizedProviderInstances
            )
          : getProviderInstance(
                normalizedProviderInstances,
                provider,
                parsed.providerInstanceId || currentConfig.selectedProviderInstanceId || undefined
            );

    if (parsed.model) {
        const customImageModels = getCustomImageModelUpdates(parsed.model, normalizedCustomModels, targetInstance.id);
        if (customImageModels) configUpdates.customImageModels = customImageModels;
    }

    if (parsed.apiKey !== undefined || parsed.baseUrl !== undefined || parsed.model !== undefined) {
        configUpdates.providerInstances = upsertSharedProviderInstance(normalizedProviderInstances, targetInstance, {
            apiKey: parsed.apiKey,
            apiBaseUrl: parsed.baseUrl,
            model: parsed.model
        });
    }

    if (parsed.apiKey !== undefined || parsed.baseUrl !== undefined || parsed.model !== undefined) {
        configUpdates.selectedProviderInstanceId = targetInstance.id;
        if (targetInstance.id === getProviderInstanceDefaultId(provider)) {
            if (parsed.apiKey !== undefined) {
                configUpdates[getProviderConfigFieldNames(provider).apiKey] = parsed.apiKey;
            }
            if (parsed.baseUrl !== undefined) {
                configUpdates[getProviderConfigFieldNames(provider).apiBaseUrl] = parsed.baseUrl;
            }
        }
    }

    const effectiveConfig = { ...currentConfig, ...configUpdates };
    if (configUpdates.providerInstances || configUpdates.customImageModels) {
        const unifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: currentConfig.providerEndpoints,
                modelCatalog: currentConfig.modelCatalog,
                modelTaskDefaultCatalogEntryIds: currentConfig.modelTaskDefaultCatalogEntryIds
            },
            effectiveConfig
        );
        configUpdates.providerEndpoints = unifiedProviderModelConfig.providerEndpoints;
        configUpdates.modelCatalog = unifiedProviderModelConfig.modelCatalog;
        configUpdates.modelTaskDefaultCatalogEntryIds = unifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds;
    }

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
    const selectedInstance = getProviderInstance(
        config.providerInstances,
        provider,
        options.providerInstanceId || config.selectedProviderInstanceId || undefined
    );
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
        models:
            updates.model && !targetInstance.models.includes(updates.model)
                ? [...targetInstance.models, updates.model]
                : targetInstance.models
    };

    if (
        !targetInstance.name.trim() ||
        (updates.apiBaseUrl !== undefined && targetInstance.name === targetInstance.type)
    ) {
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
