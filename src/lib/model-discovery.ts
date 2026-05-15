import { formatApiError } from '@/lib/api-error';
import { desktopProxyConfigFromAppConfig, type DesktopProxyConfig } from '@/lib/desktop-config';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import { normalizeOpenAICompatibleBaseUrl } from '@/lib/provider-config';
import type { ProviderEndpoint } from '@/lib/provider-model-catalog';

export type DiscoveredProviderModel = {
    id: string;
    label?: string;
    displayLabel?: string;
    upstreamVendor?: string;
    remoteMetadata?: Record<string, unknown>;
};

export type DiscoverProviderModelsRequest = {
    endpoint: Pick<ProviderEndpoint, 'id' | 'provider' | 'name' | 'apiKey' | 'apiBaseUrl' | 'protocol'>;
    passwordHash?: string | null;
    proxyConfig?: DesktopProxyConfig;
    debugMode?: boolean;
};

export type DiscoverProviderModelsResponse = {
    models: DiscoveredProviderModel[];
    refreshedAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function pickRemoteMetadata(value: Record<string, unknown>): Record<string, unknown> | undefined {
    const metadata: Record<string, unknown> = {};
    for (const key of ['object', 'owned_by', 'provider', 'family', 'modalities', 'capabilities', 'created']) {
        if (value[key] !== undefined) metadata[key] = value[key];
    }
    return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function parseOpenAICompatibleModelsResponse(value: unknown): DiscoveredProviderModel[] {
    if (!isRecord(value)) return [];
    const data = Array.isArray(value.data) ? value.data : [];
    const seen = new Set<string>();
    const models: DiscoveredProviderModel[] = [];

    data.forEach((item) => {
        if (!isRecord(item)) return;
        const id = normalizeOptionalString(item.id);
        if (!id || seen.has(id)) return;
        seen.add(id);
        const displayLabel =
            normalizeOptionalString(item.display_name) ||
            normalizeOptionalString(item.name) ||
            normalizeOptionalString(item.label);
        const upstreamVendor =
            normalizeOptionalString(item.owned_by) ||
            normalizeOptionalString(item.provider) ||
            normalizeOptionalString(item.vendor);
        models.push({
            id,
            ...(displayLabel ? { displayLabel } : {}),
            ...(upstreamVendor ? { upstreamVendor } : {}),
            ...(pickRemoteMetadata(item) ? { remoteMetadata: pickRemoteMetadata(item) } : {})
        });
    });

    return models;
}

export async function discoverOpenAICompatibleModels(
    endpoint: Pick<ProviderEndpoint, 'apiKey' | 'apiBaseUrl'>,
    options: { signal?: AbortSignal } = {}
): Promise<DiscoverProviderModelsResponse> {
    if (!endpoint.apiKey.trim()) {
        throw new Error('刷新模型列表需要配置 API Key。');
    }

    const baseUrl = normalizeOpenAICompatibleBaseUrl(endpoint.apiBaseUrl || 'https://api.openai.com/v1');
    const response = await fetch(`${baseUrl.replace(/\/+$/u, '')}/models`, {
        method: 'GET',
        signal: options.signal,
        headers: {
            Authorization: `Bearer ${endpoint.apiKey}`,
            Accept: 'application/json'
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(formatApiError(data, `模型列表读取失败：HTTP ${response.status}`));
    }

    return {
        models: parseOpenAICompatibleModelsResponse(data),
        refreshedAt: Date.now()
    };
}

export async function discoverProviderModelsViaServer(
    request: DiscoverProviderModelsRequest,
    options: { signal?: AbortSignal } = {}
): Promise<DiscoverProviderModelsResponse> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (request.passwordHash) headers['x-app-password'] = request.passwordHash;
    const response = await fetch('/api/provider-models', {
        method: 'POST',
        headers,
        signal: options.signal,
        body: JSON.stringify({
            endpoint: request.endpoint,
            passwordHash: request.passwordHash || undefined
        })
    });
    const data = await response.json().catch((error) => ({ error: formatApiError(error, '模型列表读取失败。') }));
    if (!response.ok) {
        throw new Error(formatApiError(data, `模型列表读取失败：HTTP ${response.status}`));
    }
    return {
        models: Array.isArray(data.models) ? data.models : [],
        refreshedAt: typeof data.refreshedAt === 'number' ? data.refreshedAt : Date.now()
    };
}

export async function discoverProviderModels(
    request: DiscoverProviderModelsRequest,
    options: { signal?: AbortSignal } = {}
): Promise<DiscoverProviderModelsResponse> {
    if (isTauriDesktop()) {
        return invokeDesktopCommand<DiscoverProviderModelsResponse>('proxy_provider_models', {
            request: {
                endpoint: request.endpoint,
                proxyConfig: request.proxyConfig,
                debugMode: request.debugMode
            }
        });
    }

    return discoverProviderModelsViaServer(request, options);
}

export function buildDiscoverProviderModelsRequest(
    endpoint: ProviderEndpoint,
    config: Parameters<typeof desktopProxyConfigFromAppConfig>[0],
    passwordHash?: string | null
): DiscoverProviderModelsRequest {
    return {
        endpoint: {
            id: endpoint.id,
            provider: endpoint.provider,
            name: endpoint.name,
            apiKey: endpoint.apiKey,
            apiBaseUrl: endpoint.apiBaseUrl,
            protocol: endpoint.protocol
        },
        passwordHash,
        proxyConfig: desktopProxyConfigFromAppConfig(config),
        debugMode: config.desktopDebugMode
    };
}
