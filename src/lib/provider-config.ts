import type { AppConfig } from '@/lib/config';
import type { ImageProviderId } from '@/lib/model-registry';
import { resolveProviderInstanceCredentials, type ProviderInstanceCredentialOverrides } from '@/lib/provider-instances';

export const SENSENOVA_DEFAULT_BASE_URL = 'https://token.sensenova.cn/v1';
export const SEEDREAM_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

export type ProviderCredentialConfig = {
    apiKey: string;
    apiBaseUrl: string;
    providerLabel: string;
    providerInstanceId: string;
    providerInstanceName: string;
};

export type ProviderConfigFieldNames = {
    apiKey: keyof Pick<AppConfig, 'openaiApiKey' | 'geminiApiKey' | 'sensenovaApiKey' | 'seedreamApiKey'>;
    apiBaseUrl: keyof Pick<AppConfig, 'openaiApiBaseUrl' | 'geminiApiBaseUrl' | 'sensenovaApiBaseUrl' | 'seedreamApiBaseUrl'>;
};

export function normalizeOpenAICompatibleBaseUrl(value: string | undefined): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return '';

    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const url = new URL(withProtocol);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return trimmed;

        url.username = '';
        url.password = '';
        url.search = '';
        url.hash = '';

        const normalizedPathname = url.pathname.replace(/\/+$/g, '');
        url.pathname = normalizedPathname || '/v1';

        return url.toString();
    } catch {
        return trimmed;
    }
}

export function getProviderConfigFieldNames(provider: ImageProviderId): ProviderConfigFieldNames {
    if (provider === 'google') {
        return { apiKey: 'geminiApiKey', apiBaseUrl: 'geminiApiBaseUrl' };
    }
    if (provider === 'sensenova') {
        return { apiKey: 'sensenovaApiKey', apiBaseUrl: 'sensenovaApiBaseUrl' };
    }
    if (provider === 'seedream') {
        return { apiKey: 'seedreamApiKey', apiBaseUrl: 'seedreamApiBaseUrl' };
    }
    return { apiKey: 'openaiApiKey', apiBaseUrl: 'openaiApiBaseUrl' };
}

export function getProviderCredentialConfig(
    config: AppConfig,
    provider: ImageProviderId,
    providerInstanceId?: string,
    overrides: ProviderInstanceCredentialOverrides = {}
): ProviderCredentialConfig {
    const resolved = resolveProviderInstanceCredentials(
        config.providerInstances,
        provider,
        providerInstanceId || config.selectedProviderInstanceId || undefined,
        config,
        overrides
    );

    if (provider !== 'openai') return resolved;

    return {
        ...resolved,
        apiBaseUrl: normalizeOpenAICompatibleBaseUrl(resolved.apiBaseUrl)
    };
}

export function getProviderDefaultBaseUrl(provider: ImageProviderId): string {
    if (provider === 'sensenova') return SENSENOVA_DEFAULT_BASE_URL;
    if (provider === 'seedream') return SEEDREAM_DEFAULT_BASE_URL;
    if (provider === 'google') return 'https://generativelanguage.googleapis.com/v1beta';
    return 'https://api.openai.com/v1';
}
