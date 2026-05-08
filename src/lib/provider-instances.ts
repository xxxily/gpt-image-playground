import {
    getAllImageModels,
    getImageModel,
    getProviderLabel,
    IMAGE_PROVIDER_ORDER,
    isImageProviderId,
    type ImageModelDefinition,
    type ImageProviderId,
    type StoredCustomImageModel
} from '@/lib/model-registry';

export type ProviderInstance = {
    id: string;
    type: ImageProviderId;
    name: string;
    apiKey: string;
    apiBaseUrl: string;
    models: string[];
    isDefault?: boolean;
};

export type ProviderInstanceCredentialOverrides = {
    apiKey?: string;
    apiBaseUrl?: string;
};

export type ResolvedProviderCredentialConfig = {
    apiKey: string;
    apiBaseUrl: string;
    providerLabel: string;
    providerInstanceId: string;
    providerInstanceName: string;
};

export type LegacyProviderCredentialFields = Partial<{
    openaiApiKey: string;
    openaiApiBaseUrl: string;
    geminiApiKey: string;
    geminiApiBaseUrl: string;
    sensenovaApiKey: string;
    sensenovaApiBaseUrl: string;
    seedreamApiKey: string;
    seedreamApiBaseUrl: string;
}>;

const PROVIDER_LEGACY_FIELDS: Record<ImageProviderId, { apiKey: keyof LegacyProviderCredentialFields; apiBaseUrl: keyof LegacyProviderCredentialFields }> = {
    openai: { apiKey: 'openaiApiKey', apiBaseUrl: 'openaiApiBaseUrl' },
    google: { apiKey: 'geminiApiKey', apiBaseUrl: 'geminiApiBaseUrl' },
    sensenova: { apiKey: 'sensenovaApiKey', apiBaseUrl: 'sensenovaApiBaseUrl' },
    seedream: { apiKey: 'seedreamApiKey', apiBaseUrl: 'seedreamApiBaseUrl' }
};

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeSlug(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);

    return slug || 'default';
}

export function getProviderInstanceDefaultId(type: ImageProviderId): string {
    return `${type}:default`;
}

export function getProviderInstanceHostname(apiBaseUrl: string): string | null {
    const trimmed = apiBaseUrl.trim();
    if (!trimmed) return null;

    try {
        return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
    } catch {
        return null;
    }
}

export function getDefaultProviderInstanceName(type: ImageProviderId, apiBaseUrl: string): string {
    return getProviderInstanceHostname(apiBaseUrl) || getProviderLabel(type);
}

export function createProviderInstanceId(type: ImageProviderId, nameOrBaseUrl: string, existingIds: readonly string[] = []): string {
    const base = `${type}:${normalizeSlug(getProviderInstanceHostname(nameOrBaseUrl) || nameOrBaseUrl)}`;
    const used = new Set(existingIds);
    if (!used.has(base)) return base;

    let index = 2;
    while (used.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
}

function normalizeModelIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    const seen = new Set<string>();
    const result: string[] = [];
    value.forEach((item) => {
        const id = trimString(item);
        if (!id || seen.has(id)) return;
        seen.add(id);
        result.push(id);
    });
    return result;
}

function createDefaultProviderInstance(type: ImageProviderId, legacy: LegacyProviderCredentialFields = {}): ProviderInstance {
    const fields = PROVIDER_LEGACY_FIELDS[type];
    const apiKey = trimString(legacy[fields.apiKey]);
    const apiBaseUrl = trimString(legacy[fields.apiBaseUrl]);

    return {
        id: getProviderInstanceDefaultId(type),
        type,
        name: getDefaultProviderInstanceName(type, apiBaseUrl),
        apiKey,
        apiBaseUrl,
        models: [],
        isDefault: true
    };
}

export const DEFAULT_PROVIDER_INSTANCES: readonly ProviderInstance[] = IMAGE_PROVIDER_ORDER.map((type) =>
    createDefaultProviderInstance(type)
);

export function normalizeProviderInstances(value: unknown, legacy: LegacyProviderCredentialFields = {}): ProviderInstance[] {
    const instances: ProviderInstance[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(value)) {
        value.forEach((item) => {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) return;
            const record = item as Record<string, unknown>;
            if (!isImageProviderId(record.type)) return;

            const type = record.type;
            const apiKey = trimString(record.apiKey);
            const apiBaseUrl = trimString(record.apiBaseUrl);
            const rawName = trimString(record.name);
            const name = rawName || getDefaultProviderInstanceName(type, apiBaseUrl);
            const rawId = trimString(record.id);
            const id = rawId && !seenIds.has(rawId)
                ? rawId
                : createProviderInstanceId(type, apiBaseUrl || name, Array.from(seenIds));
            seenIds.add(id);

            instances.push({
                id,
                type,
                name,
                apiKey,
                apiBaseUrl,
                models: normalizeModelIds(record.models),
                ...(record.isDefault === true ? { isDefault: true } : {})
            });
        });
    }

    IMAGE_PROVIDER_ORDER.forEach((type) => {
        if (!instances.some((instance) => instance.type === type)) {
            const defaultInstance = createDefaultProviderInstance(type, legacy);
            if (seenIds.has(defaultInstance.id)) {
                defaultInstance.id = createProviderInstanceId(type, defaultInstance.name, Array.from(seenIds));
            }
            seenIds.add(defaultInstance.id);
            instances.push(defaultInstance);
        }
    });

    IMAGE_PROVIDER_ORDER.forEach((type) => {
        const providerInstances = instances.filter((instance) => instance.type === type);
        const defaultId = providerInstances.find((instance) => instance.isDefault)?.id ?? providerInstances[0]?.id;
        providerInstances.forEach((instance) => {
            if (instance.id === defaultId) {
                instance.isDefault = true;
            } else {
                delete instance.isDefault;
            }
        });
    });

    return IMAGE_PROVIDER_ORDER.flatMap((type) => instances.filter((instance) => instance.type === type));
}

export function getProviderInstancesForType(
    providerInstances: readonly ProviderInstance[],
    type: ImageProviderId
): readonly ProviderInstance[] {
    return providerInstances.filter((instance) => instance.type === type);
}

export function getProviderInstance(
    providerInstances: readonly ProviderInstance[],
    type: ImageProviderId,
    providerInstanceId?: string
): ProviderInstance {
    const instancesForType = getProviderInstancesForType(providerInstances, type);
    return (
        instancesForType.find((instance) => instance.id === providerInstanceId) ||
        instancesForType.find((instance) => instance.isDefault) ||
        instancesForType[0] ||
        createDefaultProviderInstance(type)
    );
}

export function getProviderInstanceModelDefinitions(
    providerInstance: ProviderInstance,
    customModels: readonly StoredCustomImageModel[] = []
): readonly ImageModelDefinition[] {
    if (providerInstance.models.length > 0) {
        return providerInstance.models
            .map((modelId) => getImageModel(modelId, customModels))
            .filter((model) => model.provider === providerInstance.type);
    }

    return getAllImageModels(customModels).filter((model) => {
        if (model.provider !== providerInstance.type) return false;
        if (!model.custom || !model.instanceId) return true;
        return model.instanceId === providerInstance.id;
    });
}

export function resolveProviderInstanceCredentials(
    providerInstances: readonly ProviderInstance[],
    type: ImageProviderId,
    providerInstanceId: string | undefined,
    legacy: LegacyProviderCredentialFields = {},
    overrides: ProviderInstanceCredentialOverrides = {}
): ResolvedProviderCredentialConfig {
    const instance = getProviderInstance(providerInstances, type, providerInstanceId);
    const fields = PROVIDER_LEGACY_FIELDS[type];
    const apiKey = trimString(overrides.apiKey) || instance.apiKey || trimString(legacy[fields.apiKey]);
    const apiBaseUrl = trimString(overrides.apiBaseUrl) || instance.apiBaseUrl || trimString(legacy[fields.apiBaseUrl]);

    return {
        apiKey,
        apiBaseUrl,
        providerLabel: getProviderLabel(type),
        providerInstanceId: instance.id,
        providerInstanceName: instance.name
    };
}
