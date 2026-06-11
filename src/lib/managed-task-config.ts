import type {
    ModelCatalogEntry,
    ModelTaskCapability,
    ProviderEndpoint,
    ProviderKind,
    ProviderProtocol
} from '@/lib/provider-model-catalog';

export type GenerationExecutionMode = 'direct' | 'proxy' | 'managed-task' | 'auto';
export type ManagedTaskResolvedExecutionMode = 'direct' | 'proxy' | 'managed-task' | 'fail-closed' | 'ask-user';
export type ManagedTaskFallbackMode = 'proxy' | 'direct' | 'fail-closed' | 'ask-user';
export type ManagedTaskServiceAuthMode = 'none' | 'bearer';
export type ManagedTaskServiceHealthStatus = 'unknown' | 'ok' | 'degraded' | 'unavailable';
export type ManagedTaskP0Capability = Extract<ModelTaskCapability, 'image.generate' | 'image.edit'>;

export const MANAGED_TASK_P0_CAPABILITIES: ManagedTaskP0Capability[] = ['image.generate', 'image.edit'];
export const DEFAULT_MANAGED_TASK_HEALTH_CHECK_INTERVAL_SECONDS = 60;

export type ManagedTaskServiceConfig = {
    id: string;
    name: string;
    baseUrl: string;
    enabled: boolean;
    authMode: ManagedTaskServiceAuthMode;
    authTokenConfigured: boolean;
    healthCheckEnabled: boolean;
    healthCheckIntervalSeconds: number;
    healthStatus: ManagedTaskServiceHealthStatus;
    lastCheckedAt?: number | null;
    healthSummary?: ManagedTaskHealthSummary | null;
    capabilitiesSummary?: ManagedTaskCapabilitiesSummary | null;
    createdAt?: number;
    updatedAt?: number;
    updatedByUserId?: string | null;
};

export type ManagedTaskHealthSummary = {
    status: ManagedTaskServiceHealthStatus;
    version?: string;
    schemaVersion?: string;
    checkedAt?: string;
    dependencies?: Array<{
        name: string;
        status: ManagedTaskServiceHealthStatus | string;
        safeMessage?: string;
    }>;
    safeMessage?: string;
};

export type ManagedTaskCapabilitiesSummary = {
    schemaVersion?: string;
    serviceVersion?: string;
    taskTypes: string[];
    credentialModes: string[];
    storage?: {
        primary?: string;
        s3CompatibleAvailable?: boolean;
        maxInputAssetBytes?: number;
        maxOutputAssetBytes?: number;
        defaultRetentionHours?: number;
    };
    events?: {
        sse?: boolean;
        batchPolling?: boolean;
        webhook?: boolean;
    };
    limits?: {
        maxBatchQueryTasks?: number;
    };
    retryPolicy?: {
        enabled?: boolean;
        maxAttempts?: number;
        backoffMs?: number;
        feeRiskWarning?: string;
    };
    diagnosticsUrl?: string;
};

export type ManagedTaskRetryPolicySummary = {
    enabled: boolean;
    maxAttempts: number;
    backoffMs: number;
    feeRiskWarning: string;
};

export type ManagedTaskAdminVisibility = 'summary' | 'full';

export type ManagedTaskAdminSummary = {
    visibility: 'summary';
    taskId: string;
    status: string;
    taskType: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    attempt: number;
    maxAttempts: number;
    retryable: boolean;
    cancellable: boolean;
    endpoint?: Record<string, unknown>;
    model?: Record<string, unknown>;
    credentialFingerprint?: string;
    promptSummary?: {
        sha256?: string;
        length?: number;
    };
    outputCount: number;
    errorCode?: string;
};

export type ManagedTaskAdminDiagnostic = Omit<ManagedTaskAdminSummary, 'visibility'> & {
    visibility: 'full';
    prompt?: string;
    parameters?: Record<string, unknown>;
    inputAssets?: unknown[];
    clientContext?: Record<string, unknown>;
    providerEndpointRef?: Record<string, unknown>;
    executionCredential?: Record<string, unknown>;
    events?: unknown[];
    result?: Record<string, unknown>;
};

export type ManagedTaskAdminTaskList = {
    tasks: ManagedTaskAdminSummary[];
    requestedAt: string;
};

export type ManagedTaskPolicyMatch = {
    providerEndpointIds: string[];
    normalizedBaseUrls: string[];
    providerKinds: ProviderKind[];
    providerProtocols: ProviderProtocol[];
    modelCatalogEntryIds: string[];
    taskCapabilities: ManagedTaskP0Capability[];
};

export type ManagedTaskPolicyLimits = {
    maxSubmittedTasksPerUserPerHour?: number;
    maxQueuedTasksPerUser?: number;
    maxInputAssetBytes?: number;
    maxOutputAssetBytes?: number;
    timeoutSeconds?: number;
};

export type ManagedTaskTakeoverPolicy = {
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
    match: ManagedTaskPolicyMatch;
    mode: GenerationExecutionMode;
    taskServiceId?: string | null;
    fallbackMode: ManagedTaskFallbackMode;
    limits?: ManagedTaskPolicyLimits;
    createdAt?: number;
    updatedAt?: number;
    updatedByUserId?: string | null;
};

export type ManagedTaskResolutionInput = {
    services: ManagedTaskServiceConfig[];
    policies: ManagedTaskTakeoverPolicy[];
    providerEndpoint?: Pick<ProviderEndpoint, 'id' | 'apiBaseUrl' | 'provider' | 'protocol'> | null;
    model?: Pick<
        ModelCatalogEntry,
        'id' | 'rawModelId' | 'providerEndpointId' | 'provider' | 'protocol' | 'capabilities'
    > | null;
    taskCapability: ModelTaskCapability | string;
    defaultMode: Extract<GenerationExecutionMode, 'direct' | 'proxy'>;
};

export type ManagedTaskResolution = {
    mode: ManagedTaskResolvedExecutionMode;
    reason:
        | 'policy_not_matched'
        | 'policy_mode_direct'
        | 'policy_mode_proxy'
        | 'policy_mode_managed_task'
        | 'task_service_missing'
        | 'task_service_disabled'
        | 'task_service_unavailable'
        | 'unsupported_task_capability';
    policyId?: string;
    policyName?: string;
    taskServiceId?: string;
    taskServiceName?: string;
    fallbackMode?: ManagedTaskFallbackMode;
};

type PolicyMatchResult = {
    policy: ManagedTaskTakeoverPolicy;
    specificity: number;
};

function uniqueStrings(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    const result: string[] = [];
    values.forEach((value) => {
        if (typeof value !== 'string') return;
        const normalized = value.trim();
        if (normalized && !result.includes(normalized)) result.push(normalized);
    });
    return result;
}

function normalizeProviderKinds(values: unknown): ProviderKind[] {
    return uniqueStrings(values) as ProviderKind[];
}

function normalizeProviderProtocols(values: unknown): ProviderProtocol[] {
    return uniqueStrings(values) as ProviderProtocol[];
}

function normalizeTaskCapabilities(values: unknown): ManagedTaskP0Capability[] {
    const normalized = uniqueStrings(values).filter((value): value is ManagedTaskP0Capability =>
        MANAGED_TASK_P0_CAPABILITIES.includes(value as ManagedTaskP0Capability)
    );
    return normalized.length > 0 ? normalized : [...MANAGED_TASK_P0_CAPABILITIES];
}

export function normalizeManagedTaskBaseUrl(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const url = new URL(withProtocol);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return trimmed;
        url.username = '';
        url.password = '';
        url.search = '';
        url.hash = '';
        url.hostname = url.hostname.toLowerCase();
        url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
        return url.toString().replace(/\/+$/u, '');
    } catch {
        return trimmed;
    }
}

export function normalizeManagedTaskPolicyMatch(value: unknown): ManagedTaskPolicyMatch {
    const source =
        value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    return {
        providerEndpointIds: uniqueStrings(source.providerEndpointIds),
        normalizedBaseUrls: uniqueStrings(source.normalizedBaseUrls).map(normalizeManagedTaskBaseUrl).filter(Boolean),
        providerKinds: normalizeProviderKinds(source.providerKinds),
        providerProtocols: normalizeProviderProtocols(source.providerProtocols),
        modelCatalogEntryIds: uniqueStrings(source.modelCatalogEntryIds),
        taskCapabilities: normalizeTaskCapabilities(source.taskCapabilities)
    };
}

export function normalizeManagedTaskPolicyLimits(value: unknown): ManagedTaskPolicyLimits {
    const source =
        value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const limits: ManagedTaskPolicyLimits = {};

    for (const key of [
        'maxSubmittedTasksPerUserPerHour',
        'maxQueuedTasksPerUser',
        'maxInputAssetBytes',
        'maxOutputAssetBytes',
        'timeoutSeconds'
    ] as const) {
        const parsed = Number(source[key]);
        if (Number.isFinite(parsed) && parsed > 0) {
            limits[key] = Math.floor(parsed);
        }
    }
    return limits;
}

export function normalizeManagedTaskExecutionMode(value: unknown): GenerationExecutionMode {
    return value === 'direct' || value === 'proxy' || value === 'managed-task' || value === 'auto'
        ? value
        : 'managed-task';
}

export function normalizeManagedTaskFallbackMode(value: unknown): ManagedTaskFallbackMode {
    return value === 'direct' || value === 'proxy' || value === 'fail-closed' || value === 'ask-user'
        ? value
        : 'fail-closed';
}

export function normalizeManagedTaskServiceAuthMode(value: unknown): ManagedTaskServiceAuthMode {
    return value === 'bearer' ? 'bearer' : 'none';
}

export function normalizeManagedTaskHealthStatus(value: unknown): ManagedTaskServiceHealthStatus {
    return value === 'ok' || value === 'degraded' || value === 'unavailable' ? value : 'unknown';
}

export function normalizeManagedTaskHealthCheckIntervalSeconds(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_MANAGED_TASK_HEALTH_CHECK_INTERVAL_SECONDS;
    return Math.max(15, Math.min(3600, Math.floor(parsed)));
}

function fallbackToResolvedMode(fallbackMode: ManagedTaskFallbackMode): ManagedTaskResolvedExecutionMode {
    return fallbackMode;
}

function getPolicySpecificity(
    policy: ManagedTaskTakeoverPolicy,
    input: ManagedTaskResolutionInput,
    normalizedEndpointBaseUrl: string
): number | null {
    if (!policy.enabled) return null;
    if (!policy.match.taskCapabilities.includes(input.taskCapability as ManagedTaskP0Capability)) return null;

    let specificity = 1;
    const modelId = input.model?.id;
    const endpointId = input.providerEndpoint?.id || input.model?.providerEndpointId;
    const provider = input.providerEndpoint?.provider || input.model?.provider;
    const protocol = input.providerEndpoint?.protocol || input.model?.protocol;

    if (policy.match.modelCatalogEntryIds.length > 0) {
        if (!modelId || !policy.match.modelCatalogEntryIds.includes(modelId)) return null;
        specificity += 1000;
    }
    if (policy.match.providerEndpointIds.length > 0) {
        if (!endpointId || !policy.match.providerEndpointIds.includes(endpointId)) return null;
        specificity += 800;
    }
    if (policy.match.normalizedBaseUrls.length > 0) {
        if (!normalizedEndpointBaseUrl || !policy.match.normalizedBaseUrls.includes(normalizedEndpointBaseUrl))
            return null;
        specificity += 600;
    }
    if (policy.match.providerProtocols.length > 0) {
        if (!protocol || !policy.match.providerProtocols.includes(protocol)) return null;
        specificity += 400;
    }
    if (policy.match.providerKinds.length > 0) {
        if (!provider || !policy.match.providerKinds.includes(provider)) return null;
        specificity += 300;
    }
    return specificity;
}

function findMatchingPolicy(input: ManagedTaskResolutionInput): PolicyMatchResult | null {
    const normalizedEndpointBaseUrl = normalizeManagedTaskBaseUrl(input.providerEndpoint?.apiBaseUrl || '');
    const matches = input.policies
        .map((policy) => ({
            policy,
            specificity: getPolicySpecificity(policy, input, normalizedEndpointBaseUrl)
        }))
        .filter((match): match is PolicyMatchResult => match.specificity !== null)
        .sort((a, b) => b.specificity - a.specificity || b.policy.priority - a.policy.priority);

    return matches[0] || null;
}

export function resolveManagedTaskExecution(input: ManagedTaskResolutionInput): ManagedTaskResolution {
    if (!MANAGED_TASK_P0_CAPABILITIES.includes(input.taskCapability as ManagedTaskP0Capability)) {
        return { mode: input.defaultMode, reason: 'unsupported_task_capability' };
    }

    const matched = findMatchingPolicy(input);
    if (!matched) return { mode: input.defaultMode, reason: 'policy_not_matched' };

    const { policy } = matched;
    const policyContext = {
        policyId: policy.id,
        policyName: policy.name,
        fallbackMode: policy.fallbackMode
    };

    if (policy.mode === 'direct') {
        return { ...policyContext, mode: 'direct', reason: 'policy_mode_direct' };
    }
    if (policy.mode === 'proxy') {
        return { ...policyContext, mode: 'proxy', reason: 'policy_mode_proxy' };
    }

    const service = input.services.find((item) => item.id === policy.taskServiceId);
    if (!service) {
        return {
            ...policyContext,
            mode: fallbackToResolvedMode(policy.fallbackMode),
            reason: 'task_service_missing',
            taskServiceId: policy.taskServiceId || undefined
        };
    }
    if (!service.enabled) {
        return {
            ...policyContext,
            mode: fallbackToResolvedMode(policy.fallbackMode),
            reason: 'task_service_disabled',
            taskServiceId: service.id,
            taskServiceName: service.name
        };
    }
    if (service.healthStatus === 'unavailable') {
        return {
            ...policyContext,
            mode: fallbackToResolvedMode(policy.fallbackMode),
            reason: 'task_service_unavailable',
            taskServiceId: service.id,
            taskServiceName: service.name
        };
    }

    return {
        ...policyContext,
        mode: 'managed-task',
        reason: 'policy_mode_managed_task',
        taskServiceId: service.id,
        taskServiceName: service.name
    };
}
