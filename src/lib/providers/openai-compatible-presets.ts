import { SEEDREAM_DEFAULT_BASE_URL, SENSENOVA_DEFAULT_BASE_URL } from '@/lib/provider-config';
import type { ImageProviderId } from '@/lib/model-registry';
import type { OpenAICompatibleProviderDefaults } from '@/lib/providers/openai-compatible';

export const SENSENOVA_PROVIDER_DEFAULTS: OpenAICompatibleProviderDefaults = {
    providerLabel: 'SenseNova',
    defaultBaseUrl: SENSENOVA_DEFAULT_BASE_URL,
    missingApiKeyMessage: 'SenseNova U1 Fast 需要配置 SenseNova API Key。',
    defaultGenerateParams: {
        size: '2752x1536',
        n: 1
    },
    maxImages: 10
};

export const SEEDREAM_PROVIDER_DEFAULTS: OpenAICompatibleProviderDefaults = {
    providerLabel: 'Seedream',
    defaultBaseUrl: SEEDREAM_DEFAULT_BASE_URL,
    missingApiKeyMessage: 'Seedream 需要配置火山方舟 API Key。',
    defaultGenerateParams: {
        size: '2K',
        response_format: 'url',
        watermark: false
    },
    defaultEditParams: {
        size: '2K',
        response_format: 'url',
        watermark: false
    },
    editRequestMode: 'generations-json',
    defaultOutputFormat: 'jpeg',
    maxImages: 15
};

export function getOpenAICompatibleProviderDefaults(provider: ImageProviderId): OpenAICompatibleProviderDefaults | null {
    if (provider === 'sensenova') return SENSENOVA_PROVIDER_DEFAULTS;
    if (provider === 'seedream') return SEEDREAM_PROVIDER_DEFAULTS;
    return null;
}
