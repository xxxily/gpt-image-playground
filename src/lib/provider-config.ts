import type { AppConfig } from '@/lib/config';
import { getProviderLabel, type ImageProviderId } from '@/lib/model-registry';

export const SENSENOVA_DEFAULT_BASE_URL = 'https://token.sensenova.cn/v1';
export const SEEDREAM_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';

export type ProviderCredentialConfig = {
    apiKey: string;
    apiBaseUrl: string;
    providerLabel: string;
};

export type ProviderConfigFieldNames = {
    apiKey: keyof Pick<AppConfig, 'openaiApiKey' | 'geminiApiKey' | 'sensenovaApiKey' | 'seedreamApiKey'>;
    apiBaseUrl: keyof Pick<AppConfig, 'openaiApiBaseUrl' | 'geminiApiBaseUrl' | 'sensenovaApiBaseUrl' | 'seedreamApiBaseUrl'>;
};

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

export function getProviderCredentialConfig(config: AppConfig, provider: ImageProviderId): ProviderCredentialConfig {
    const fieldNames = getProviderConfigFieldNames(provider);
    return {
        apiKey: config[fieldNames.apiKey],
        apiBaseUrl: config[fieldNames.apiBaseUrl],
        providerLabel: getProviderLabel(provider)
    };
}

export function getProviderDefaultBaseUrl(provider: ImageProviderId): string {
    if (provider === 'sensenova') return SENSENOVA_DEFAULT_BASE_URL;
    if (provider === 'seedream') return SEEDREAM_DEFAULT_BASE_URL;
    if (provider === 'google') return 'https://generativelanguage.googleapis.com/v1beta';
    return 'https://api.openai.com/v1';
}
