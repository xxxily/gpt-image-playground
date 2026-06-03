import {
    type ModelCatalogConfig,
    type ModelCatalogEntry,
    type ModelTaskCapability,
    type ModelTaskDefaultCatalogEntryIds,
    type ModelModality,
    type ProviderEndpoint,
    type ProviderKind,
    type ProviderProtocol
} from '@/lib/provider-model-catalog';

export type ProviderEndpointCompatibilityFamily = 'openai-compatible' | 'anthropic-compatible';
type ProviderEndpointCompatibilityInput = {
    provider?: ProviderKind | string | null;
    protocol?: ProviderProtocol | string | null;
};

export type ProviderEndpointModelBindingConfig = Required<
    Pick<ModelCatalogConfig, 'providerEndpoints' | 'modelCatalog' | 'modelTaskDefaultCatalogEntryIds'>
>;

const OPENAI_COMPATIBLE_PROTOCOLS = new Set<ProviderProtocol>([
    'openai-responses',
    'openai-chat-completions',
    'openai-images',
    'ark-openai-compatible',
    'openai-videos'
]);

const ANTHROPIC_COMPATIBLE_PROTOCOLS = new Set<ProviderProtocol>([
    'anthropic-messages',
    'anthropic-compatible-messages'
]);

function uniqueStrings<T extends string>(values: readonly T[]): T[] {
    return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

export function getProviderEndpointCompatibilityFamily(
    endpoint: ProviderEndpointCompatibilityInput
): ProviderEndpointCompatibilityFamily | null {
    if (endpoint.provider === 'anthropic' || endpoint.provider === 'anthropic-compatible') {
        return 'anthropic-compatible';
    }
    if (endpoint.provider === 'openai' || endpoint.provider === 'openai-compatible') {
        return 'openai-compatible';
    }
    if (ANTHROPIC_COMPATIBLE_PROTOCOLS.has(endpoint.protocol as ProviderProtocol)) {
        return 'anthropic-compatible';
    }
    if (OPENAI_COMPATIBLE_PROTOCOLS.has(endpoint.protocol as ProviderProtocol)) {
        return 'openai-compatible';
    }
    return null;
}

export function isProviderEndpointCompatibleWithFamilies(
    endpoint: ProviderEndpoint,
    allowedFamilies: readonly ProviderEndpointCompatibilityFamily[]
): boolean {
    if (endpoint.enabled === false) return false;
    const family = getProviderEndpointCompatibilityFamily(endpoint);
    return family !== null && allowedFamilies.includes(family);
}

export function supportsProviderEndpointModelDiscovery(
    endpoint: ProviderEndpointCompatibilityInput
): boolean {
    return getProviderEndpointCompatibilityFamily(endpoint) !== null || endpoint.protocol === 'tencent-tokenhub-video';
}

export function getProviderModelBindingEndpoints(
    config: Pick<ModelCatalogConfig, 'providerEndpoints'>,
    options: { allowedFamilies: readonly ProviderEndpointCompatibilityFamily[] }
): ProviderEndpoint[] {
    return (config.providerEndpoints ?? []).filter((endpoint) =>
        isProviderEndpointCompatibleWithFamilies(endpoint, options.allowedFamilies)
    );
}

export function getProviderModelBindingEntries(
    config: Pick<ModelCatalogConfig, 'providerEndpoints' | 'modelCatalog'>,
    options: {
        providerEndpointId: string;
        task?: ModelTaskCapability;
        includeUnmanaged?: boolean;
        includeWithoutTaskCapability?: boolean;
    }
): ModelCatalogEntry[] {
    const endpoint = (config.providerEndpoints ?? []).find((item) => item.id === options.providerEndpointId);
    if (!endpoint || endpoint.enabled === false) return [];
    const managedModelIds = new Set(endpoint.modelIds ?? []);
    const restrictToManaged =
        options.includeUnmanaged !== true && Array.isArray(endpoint.modelIds) && endpoint.modelIds.length > 0;

    return (config.modelCatalog ?? [])
        .filter((entry) => {
            if (entry.enabled === false) return false;
            if (entry.providerEndpointId !== endpoint.id) return false;
            if (restrictToManaged && !managedModelIds.has(entry.rawModelId)) return false;
            if (options.task && options.includeWithoutTaskCapability !== true) {
                return entry.capabilities.tasks.includes(options.task);
            }
            return true;
        })
        .sort((a, b) => (a.displayLabel || a.label || a.rawModelId).localeCompare(b.displayLabel || b.label || b.rawModelId));
}

function taskModalities(task: ModelTaskCapability): {
    inputModalities: ModelModality[];
    outputModalities: ModelModality[];
} {
    if (task === 'vision.text') {
        return { inputModalities: ['text', 'image'], outputModalities: ['text'] };
    }
    if (task.startsWith('video.')) {
        return { inputModalities: ['text', 'image'], outputModalities: ['video'] };
    }
    if (task.startsWith('image.')) {
        return { inputModalities: ['text', 'image'], outputModalities: ['image'] };
    }
    if (task.startsWith('audio.')) {
        return { inputModalities: ['text'], outputModalities: ['audio'] };
    }
    if (task === 'embedding.create') {
        return { inputModalities: ['text'], outputModalities: ['embedding'] };
    }
    return { inputModalities: ['text'], outputModalities: ['text'] };
}

export function ensureCatalogEntryTaskCapability(
    entry: ModelCatalogEntry,
    task: ModelTaskCapability
): ModelCatalogEntry {
    const modalities = taskModalities(task);
    return {
        ...entry,
        capabilities: {
            ...entry.capabilities,
            tasks: uniqueStrings([...entry.capabilities.tasks, task]),
            inputModalities: uniqueStrings([
                ...entry.capabilities.inputModalities,
                ...modalities.inputModalities
            ]),
            outputModalities: uniqueStrings([
                ...entry.capabilities.outputModalities,
                ...modalities.outputModalities
            ])
        },
        capabilityConfidence: entry.capabilityConfidence === 'high' ? entry.capabilityConfidence : 'medium'
    };
}

export function bindProviderModelToTask(
    config: ProviderEndpointModelBindingConfig,
    options: { catalogEntryId: string; task: ModelTaskCapability }
): ProviderEndpointModelBindingConfig {
    const entry = config.modelCatalog.find((item) => item.id === options.catalogEntryId);
    if (!entry) return config;
    const endpoint = config.providerEndpoints.find((item) => item.id === entry.providerEndpointId);
    if (!endpoint) return config;

    const nextProviderEndpoints = config.providerEndpoints.map((item) => {
        if (item.id !== endpoint.id) return item;
        if (!Array.isArray(item.modelIds) || item.modelIds.length === 0) return item;
        return {
            ...item,
            modelIds: uniqueStrings([...item.modelIds, entry.rawModelId])
        };
    });
    const nextModelCatalog = config.modelCatalog.map((item) =>
        item.id === entry.id ? ensureCatalogEntryTaskCapability(item, options.task) : item
    );
    const nextTaskDefaults: ModelTaskDefaultCatalogEntryIds = {
        ...config.modelTaskDefaultCatalogEntryIds,
        [options.task]: entry.id
    };

    return {
        providerEndpoints: nextProviderEndpoints,
        modelCatalog: nextModelCatalog,
        modelTaskDefaultCatalogEntryIds: nextTaskDefaults
    };
}

export function isProviderKindOpenAIOrAnthropicCompatible(provider: ProviderKind): boolean {
    return (
        provider === 'openai' ||
        provider === 'openai-compatible' ||
        provider === 'anthropic' ||
        provider === 'anthropic-compatible'
    );
}
