import type { ImageProviderId } from '@/lib/model-registry';
import { getProviderInstanceHostname } from '@/lib/provider-instances';
import {
    isPromptPolishProviderEndpoint,
    isVideoProviderProtocol,
    type ProviderEndpoint,
    type ProviderKind,
    type ProviderProtocol
} from '@/lib/provider-model-catalog';

export type ProviderEndpointTemplate = {
    category: 'text' | 'image' | 'video';
    kind: ProviderKind;
    protocol: ProviderProtocol;
    title: string;
    descriptionKey: string;
    placeholder: string;
    baseUrlPlaceholder: string;
    legacyImageProvider?: ImageProviderId;
    supportedByDiscovery?: boolean;
    adapterStatus?: 'implemented' | 'pending';
};

export const TEXT_PROVIDER_ENDPOINT_TEMPLATES: ProviderEndpointTemplate[] = [
    {
        category: 'text',
        kind: 'openai-compatible',
        protocol: 'openai-chat-completions',
        title: 'OpenAI Compatible / Chat Completions',
        descriptionKey: 'settings.endpoints.template.openaiChat.description',
        placeholder: 'Text Relay',
        baseUrlPlaceholder: 'https://api.openai.com/v1',
        supportedByDiscovery: true,
        adapterStatus: 'implemented'
    },
    {
        category: 'text',
        kind: 'openai',
        protocol: 'openai-responses',
        title: 'OpenAI / Responses',
        descriptionKey: 'settings.endpoints.template.openaiResponses.description',
        placeholder: 'OpenAI Responses',
        baseUrlPlaceholder: 'https://api.openai.com/v1',
        supportedByDiscovery: true,
        adapterStatus: 'implemented'
    },
    {
        category: 'text',
        kind: 'anthropic',
        protocol: 'anthropic-messages',
        title: 'Anthropic / Messages',
        descriptionKey: 'settings.endpoints.template.anthropicMessages.description',
        placeholder: 'Anthropic',
        baseUrlPlaceholder: 'https://api.anthropic.com/v1',
        supportedByDiscovery: true,
        adapterStatus: 'implemented'
    },
    {
        category: 'text',
        kind: 'anthropic-compatible',
        protocol: 'anthropic-compatible-messages',
        title: 'Anthropic Compatible / Messages',
        descriptionKey: 'settings.endpoints.template.anthropicCompatible.description',
        placeholder: 'Anthropic Relay',
        baseUrlPlaceholder: 'https://api.anthropic.com/v1',
        supportedByDiscovery: true,
        adapterStatus: 'implemented'
    }
];

export const IMAGE_PROVIDER_ENDPOINT_TEMPLATES: ProviderEndpointTemplate[] = [
    {
        category: 'image',
        kind: 'openai-compatible',
        protocol: 'openai-images',
        title: 'OpenAI Compatible / Images',
        descriptionKey: 'settings.endpoints.template.openaiImages.description',
        placeholder: 'OpenAI Images',
        baseUrlPlaceholder: 'https://api.openai.com/v1',
        legacyImageProvider: 'openai',
        supportedByDiscovery: true,
        adapterStatus: 'implemented'
    },
    {
        category: 'image',
        kind: 'google-gemini',
        protocol: 'gemini-generate-content',
        title: 'Google Gemini / Images',
        descriptionKey: 'settings.endpoints.template.geminiImages.description',
        placeholder: 'Google Gemini',
        baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
        legacyImageProvider: 'google',
        supportedByDiscovery: false,
        adapterStatus: 'implemented'
    },
    {
        category: 'image',
        kind: 'volcengine-ark',
        protocol: 'ark-openai-compatible',
        title: 'Seedream / VolcEngine Ark',
        descriptionKey: 'settings.endpoints.template.seedreamImages.description',
        placeholder: 'Seedream',
        baseUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
        legacyImageProvider: 'seedream',
        supportedByDiscovery: true,
        adapterStatus: 'implemented'
    },
    {
        category: 'image',
        kind: 'sensenova',
        protocol: 'openai-images',
        title: 'SenseNova',
        descriptionKey: 'settings.endpoints.template.sensenovaImages.description',
        placeholder: 'SenseNova',
        baseUrlPlaceholder: 'https://token.sensenova.cn/v1',
        legacyImageProvider: 'sensenova',
        supportedByDiscovery: true,
        adapterStatus: 'implemented'
    }
];

export const VIDEO_PROVIDER_ENDPOINT_TEMPLATES: ProviderEndpointTemplate[] = [
    {
        category: 'video',
        kind: 'openai',
        protocol: 'openai-videos',
        title: 'OpenAI / Sora',
        descriptionKey: 'settings.endpoints.template.openaiVideos.description',
        placeholder: 'OpenAI Sora',
        baseUrlPlaceholder: 'https://api.openai.com/v1',
        supportedByDiscovery: true,
        adapterStatus: 'implemented'
    },
    {
        category: 'video',
        kind: 'google-gemini',
        protocol: 'gemini-generate-videos',
        title: 'Google Veo (Gemini API)',
        descriptionKey: 'settings.endpoints.template.geminiVideos.description',
        placeholder: 'Google Veo',
        baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'google-vertex-ai',
        protocol: 'vertex-ai-veo',
        title: 'Google Veo (Vertex AI)',
        descriptionKey: 'settings.endpoints.template.vertexVeo.description',
        placeholder: 'Google Veo Vertex',
        baseUrlPlaceholder: 'https://us-central1-aiplatform.googleapis.com',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'runway',
        protocol: 'runway-api-v1',
        title: 'Runway',
        descriptionKey: 'settings.endpoints.template.runway.description',
        placeholder: 'Runway',
        baseUrlPlaceholder: 'https://api.runwayml.com',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'luma',
        protocol: 'luma-dream-machine',
        title: 'Luma Dream Machine',
        descriptionKey: 'settings.endpoints.template.luma.description',
        placeholder: 'Luma Dream Machine',
        baseUrlPlaceholder: 'https://api.lumalabs.ai',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'minimax',
        protocol: 'minimax-video',
        title: 'MiniMax Hailuo',
        descriptionKey: 'settings.endpoints.template.minimax.description',
        placeholder: 'MiniMax Hailuo',
        baseUrlPlaceholder: 'https://api.minimaxi.chat',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'kling',
        protocol: 'kling-api',
        title: 'Kling',
        descriptionKey: 'settings.endpoints.template.kling.description',
        placeholder: 'Kling',
        baseUrlPlaceholder: 'https://api.klingai.com',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'byteplus-modelark',
        protocol: 'modelark-video-generation',
        title: 'BytePlus ModelArk',
        descriptionKey: 'settings.endpoints.template.modelark.description',
        placeholder: 'BytePlus ModelArk',
        baseUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'aliyun-dashscope',
        protocol: 'dashscope-video-generation',
        title: 'Aliyun DashScope / Wan',
        descriptionKey: 'settings.endpoints.template.dashscope.description',
        placeholder: 'DashScope Wan',
        baseUrlPlaceholder: 'https://dashscope.aliyuncs.com',
        supportedByDiscovery: false,
        adapterStatus: 'implemented'
    },
    {
        category: 'video',
        kind: 'tencent-hunyuan-video',
        protocol: 'tencent-vclm',
        title: 'Tencent Hunyuan',
        descriptionKey: 'settings.endpoints.template.tencentHunyuan.description',
        placeholder: 'Tencent Hunyuan',
        baseUrlPlaceholder: 'https://hunyuan.tencentcloudapi.com',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'tencent-tokenhub',
        protocol: 'tencent-tokenhub-video',
        title: 'Tencent TokenHub',
        descriptionKey: 'settings.endpoints.template.tencentTokenhub.description',
        placeholder: 'Tencent TokenHub',
        baseUrlPlaceholder: 'https://api.hunyuan.tencent.com',
        supportedByDiscovery: true,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'fal',
        protocol: 'fal-model-api',
        title: 'fal.ai',
        descriptionKey: 'settings.endpoints.template.fal.description',
        placeholder: 'fal.ai',
        baseUrlPlaceholder: 'https://fal.run',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    },
    {
        category: 'video',
        kind: 'xai',
        protocol: 'xai-imagine-video',
        title: 'xAI Grok Imagine',
        descriptionKey: 'settings.endpoints.template.xai.description',
        placeholder: 'xAI Grok Imagine',
        baseUrlPlaceholder: 'https://api.x.ai/v1',
        supportedByDiscovery: false,
        adapterStatus: 'pending'
    }
];

export const PROVIDER_ENDPOINT_TEMPLATES: ProviderEndpointTemplate[] = [
    ...TEXT_PROVIDER_ENDPOINT_TEMPLATES,
    ...IMAGE_PROVIDER_ENDPOINT_TEMPLATES,
    ...VIDEO_PROVIDER_ENDPOINT_TEMPLATES
];

export function normalizeProviderEndpointSlug(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return slug || 'default';
}

export function createProviderEndpointId(
    provider: ProviderKind,
    nameOrBaseUrl: string,
    existingIds: readonly string[]
): string {
    const host = getProviderInstanceHostname(nameOrBaseUrl) || nameOrBaseUrl;
    const base = `${provider}:${normalizeProviderEndpointSlug(host)}`;
    if (!existingIds.includes(base)) return base;
    let index = 2;
    while (existingIds.includes(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
}

export function getProviderEndpointTemplateKey(template: ProviderEndpointTemplate): string {
    return `${template.kind}:${template.protocol}`;
}

export function getProviderEndpointTemplateByKey(key: string): ProviderEndpointTemplate | null {
    return PROVIDER_ENDPOINT_TEMPLATES.find((template) => getProviderEndpointTemplateKey(template) === key) ?? null;
}

export function isImageProviderEndpoint(endpoint: ProviderEndpoint): boolean {
    return (
        endpoint.legacyImageProvider === 'openai' ||
        endpoint.legacyImageProvider === 'google' ||
        endpoint.legacyImageProvider === 'seedream' ||
        endpoint.legacyImageProvider === 'sensenova' ||
        endpoint.protocol === 'openai-images' ||
        endpoint.protocol === 'gemini-generate-content' ||
        endpoint.protocol === 'ark-openai-compatible'
    );
}

export function isTextProviderEndpoint(endpoint: ProviderEndpoint): boolean {
    if (isImageProviderEndpoint(endpoint) || isVideoProviderProtocol(endpoint.protocol)) return false;
    return isPromptPolishProviderEndpoint(endpoint);
}
