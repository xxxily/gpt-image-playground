import {
    DEFAULT_IMAGE_MODEL,
    getAllImageModels,
    getImageModel,
    normalizeCustomImageModels,
    type ImageModelDefinition,
    type ImageProviderId,
    type StoredCustomImageModel
} from '@/lib/model-registry';
import {
    DEFAULT_PROMPT_POLISH_MODEL,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
    DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
    type PromptPolishThinkingEffortFormat
} from '@/lib/prompt-polish-core';
import {
    getDefaultProviderInstanceName,
    getProviderInstance,
    normalizeProviderInstances,
    resolveProviderInstanceCredentials,
    type LegacyProviderCredentialFields,
    type ProviderInstance
} from '@/lib/provider-instances';
import {
    DEFAULT_VISION_TEXT_MODEL,
    getVisionTextModelDefinitions,
    type VisionTextModelDefinition
} from '@/lib/vision-text-model-registry';
import {
    normalizeVisionTextProviderInstances,
    resolveVisionTextProviderInstanceCredentials,
    type VisionTextProviderInstance
} from '@/lib/vision-text-provider-instances';
import {
    DEFAULT_VISION_TEXT_API_COMPATIBILITY,
    type VisionTextApiCompatibility,
    type VisionTextDetail
} from '@/lib/vision-text-types';

export type ProviderKind =
    | 'openai'
    | 'openai-compatible'
    | 'google-gemini'
    | 'volcengine-ark'
    | 'sensenova'
    | 'google-vertex-ai'
    | 'runway'
    | 'luma'
    | 'minimax'
    | 'kling'
    | 'byteplus-modelark'
    | 'aliyun-dashscope'
    | 'tencent-hunyuan-video'
    | 'tencent-tokenhub'
    | 'fal';

export type ProviderProtocol =
    | 'openai-responses'
    | 'openai-chat-completions'
    | 'openai-images'
    | 'gemini-generate-content'
    | 'gemini-generate-videos'
    | 'ark-openai-compatible'
    | 'openai-videos'
    | 'vertex-ai-veo'
    | 'runway-api-v1'
    | 'luma-dream-machine'
    | 'minimax-video'
    | 'kling-api'
    | 'modelark-video-generation'
    | 'dashscope-video-generation'
    | 'tencent-vclm'
    | 'tencent-tokenhub-video'
    | 'fal-model-api';

export type ModelDiscoverySettings = {
    enabled: boolean;
    lastRefreshedAt?: number;
    lastError?: string;
};

export type ProviderEndpoint = {
    id: string;
    provider: ProviderKind;
    name: string;
    apiKey: string;
    apiBaseUrl: string;
    protocol: ProviderProtocol;
    isDefault?: boolean;
    enabled?: boolean;
    modelDiscovery?: ModelDiscoverySettings;
    legacyImageProvider?: ImageProviderId;
    legacyVisionTextKind?: VisionTextProviderInstance['kind'];
};

export type ModelTaskCapability =
    | 'image.generate'
    | 'image.edit'
    | 'image.maskEdit'
    | 'vision.text'
    | 'text.generate'
    | 'text.reasoning'
    | 'prompt.polish'
    | 'prompt.batchPlan'
    | 'video.generate'
    | 'video.imageToVideo'
    | 'video.edit'
    | 'video.extend'
    | 'video.referenceToVideo'
    | 'video.audioToVideo'
    | 'video.character'
    | 'audio.speech'
    | 'audio.transcribe'
    | 'embedding.create';

export type ModelModality = 'text' | 'image' | 'audio' | 'video' | 'embedding';

export type VideoModelFeatures = {
    asyncJob: boolean;
    progressPolling?: boolean;
    webhooks?: boolean;
    batch?: boolean;
    cancel?: boolean;
    downloadContent?: boolean;
    resultUrlExpires?: boolean;
    inputImageUpload?: 'multipart' | 'base64' | 'publicUrl' | 'fileId';
    inputVideoUpload?: 'multipart' | 'base64' | 'publicUrl' | 'fileId';
    referenceImages?: boolean;
    startFrame?: boolean;
    endFrame?: boolean;
    videoExtension?: boolean;
    videoEdit?: boolean;
    nativeAudio?: boolean;
    externalAudio?: boolean;
    negativePrompt?: boolean;
    seed?: boolean;
    promptEnhance?: boolean;
    watermarkControl?: boolean;
    cameraControl?: boolean;
    multiShot?: boolean;
};

export type ModelCapabilities = {
    tasks: ModelTaskCapability[];
    inputModalities: ModelModality[];
    outputModalities: ModelModality[];
    features?: {
        streaming?: boolean;
        structuredOutput?: boolean;
        toolUse?: boolean;
        reasoning?: boolean;
        imageMask?: boolean;
        customImageSize?: boolean;
        outputFormat?: boolean;
        outputCompression?: boolean;
        background?: boolean;
        moderation?: boolean;
        video?: VideoModelFeatures;
    };
};

export type ModelCatalogSource = 'builtin' | 'remote' | 'custom';
export type CapabilityConfidence = 'high' | 'medium' | 'low';

export type VideoModelDefaults = {
    durationSeconds?: number;
    size?: string;
    aspectRatio?: string;
    resolutionTier?: '480p' | '720p' | '1080p' | '4k';
    frameRate?: number;
    count?: number;
    promptEnhanceEnabled?: boolean;
    nativeAudioEnabled?: boolean;
    watermarkEnabled?: boolean;
};

export type ModelTaskDefaults = {
    image?: {
        defaultSize?: string;
    };
    visionText?: {
        apiCompatibility?: VisionTextApiCompatibility;
        defaultDetail?: VisionTextDetail;
        maxImages?: number;
        maxImageBytes?: number;
        maxOutputTokens?: number;
    };
    promptPolish?: {
        thinkingEnabled?: boolean;
        thinkingEffort?: string;
        thinkingEffortFormat?: PromptPolishThinkingEffortFormat;
    };
    video?: VideoModelDefaults;
};

export type ModelCatalogEntry = {
    id: string;
    rawModelId: string;
    providerEndpointId: string;
    provider: ProviderKind;
    label: string;
    displayLabel?: string;
    upstreamVendor?: string;
    modelFamily?: string;
    source: ModelCatalogSource;
    enabled: boolean;
    capabilities: ModelCapabilities;
    defaults?: ModelTaskDefaults;
    capabilityConfidence?: CapabilityConfidence;
    remoteMetadata?: Record<string, unknown>;
    updatedAt?: number;
};

export type ModelTaskDefaultCatalogEntryIds = Partial<Record<ModelTaskCapability, string>>;

export type ModelCatalogConfig = {
    providerEndpoints?: ProviderEndpoint[];
    modelCatalog?: ModelCatalogEntry[];
    modelTaskDefaultCatalogEntryIds?: ModelTaskDefaultCatalogEntryIds;
};

type LegacyUnifiedConfig = LegacyProviderCredentialFields & {
    providerInstances?: unknown;
    selectedProviderInstanceId?: unknown;
    customImageModels?: unknown;
    visionTextProviderInstances?: unknown;
    selectedVisionTextProviderInstanceId?: unknown;
    visionTextModelId?: unknown;
    visionTextApiCompatibility?: unknown;
    visionTextDetail?: unknown;
    visionTextMaxOutputTokens?: unknown;
    polishingApiKey?: unknown;
    polishingApiBaseUrl?: unknown;
    polishingModelId?: unknown;
    polishingThinkingEnabled?: unknown;
    polishingThinkingEffort?: unknown;
    polishingThinkingEffortFormat?: unknown;
};

export type PromptPolishCatalogSelection = {
    endpoint: ProviderEndpoint | null;
    catalogEntry: ModelCatalogEntry | null;
    apiKey: string;
    apiBaseUrl: string;
    modelId: string;
    thinkingEnabled: boolean;
    thinkingEffort: string;
    thinkingEffortFormat: PromptPolishThinkingEffortFormat;
};

const EMPTY_CAPABILITIES: ModelCapabilities = {
    tasks: [],
    inputModalities: [],
    outputModalities: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function optionalBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
}

function uniqueStrings<T extends string>(values: readonly T[]): T[] {
    const seen = new Set<T>();
    const result: T[] = [];
    values.forEach((value) => {
        if (seen.has(value)) return;
        seen.add(value);
        result.push(value);
    });
    return result;
}

function normalizeProviderKind(value: unknown, fallback: ProviderKind = 'openai-compatible'): ProviderKind {
    if (
        value === 'openai' ||
        value === 'openai-compatible' ||
        value === 'google-gemini' ||
        value === 'volcengine-ark' ||
        value === 'sensenova' ||
        value === 'google-vertex-ai' ||
        value === 'runway' ||
        value === 'luma' ||
        value === 'minimax' ||
        value === 'kling' ||
        value === 'byteplus-modelark' ||
        value === 'aliyun-dashscope' ||
        value === 'tencent-hunyuan-video' ||
        value === 'tencent-tokenhub' ||
        value === 'fal'
    ) {
        return value;
    }
    return fallback;
}

function normalizeProviderProtocol(value: unknown, fallback: ProviderProtocol): ProviderProtocol {
    if (
        value === 'openai-responses' ||
        value === 'openai-chat-completions' ||
        value === 'openai-images' ||
        value === 'gemini-generate-content' ||
        value === 'gemini-generate-videos' ||
        value === 'ark-openai-compatible' ||
        value === 'openai-videos' ||
        value === 'vertex-ai-veo' ||
        value === 'runway-api-v1' ||
        value === 'luma-dream-machine' ||
        value === 'minimax-video' ||
        value === 'kling-api' ||
        value === 'modelark-video-generation' ||
        value === 'dashscope-video-generation' ||
        value === 'tencent-vclm' ||
        value === 'tencent-tokenhub-video' ||
        value === 'fal-model-api'
    ) {
        return value;
    }
    return fallback;
}

function imageProviderToEndpointProvider(provider: ImageProviderId): ProviderKind {
    if (provider === 'google') return 'google-gemini';
    if (provider === 'seedream') return 'volcengine-ark';
    if (provider === 'sensenova') return 'sensenova';
    return 'openai-compatible';
}

function imageProviderToProtocol(provider: ImageProviderId): ProviderProtocol {
    if (provider === 'google') return 'gemini-generate-content';
    if (provider === 'seedream') return 'ark-openai-compatible';
    return 'openai-images';
}

function visionTextProtocol(value: VisionTextApiCompatibility): ProviderProtocol {
    return value === 'responses' ? 'openai-responses' : 'openai-chat-completions';
}

export function getCatalogEntryId(providerEndpointId: string, rawModelId: string): string {
    return `${providerEndpointId}::${encodeURIComponent(rawModelId.trim())}`;
}

export function parseCatalogEntryId(value: string): { providerEndpointId: string; rawModelId: string } | null {
    const separator = value.indexOf('::');
    if (separator <= 0) return null;
    const providerEndpointId = value.slice(0, separator);
    const encodedModel = value.slice(separator + 2);
    if (!providerEndpointId || !encodedModel) return null;
    try {
        return { providerEndpointId, rawModelId: decodeURIComponent(encodedModel) };
    } catch {
        return null;
    }
}

function mergeGeneratedEndpoint(existing: ProviderEndpoint | undefined, generated: ProviderEndpoint): ProviderEndpoint {
    if (!existing) return generated;

    return {
        ...generated,
        enabled: existing.enabled !== false,
        modelDiscovery: existing.modelDiscovery
            ? { ...(generated.modelDiscovery ?? { enabled: true }), ...existing.modelDiscovery }
            : generated.modelDiscovery
    };
}

function createEndpointFromProviderInstance(
    instance: ProviderInstance,
    legacy: LegacyProviderCredentialFields = {}
): ProviderEndpoint {
    const credentials = resolveProviderInstanceCredentials([instance], instance.type, instance.id, legacy);
    return {
        id: instance.id,
        provider: imageProviderToEndpointProvider(instance.type),
        name: instance.name || getDefaultProviderInstanceName(instance.type, instance.apiBaseUrl),
        apiKey: credentials.apiKey,
        apiBaseUrl: credentials.apiBaseUrl,
        protocol: imageProviderToProtocol(instance.type),
        ...(instance.isDefault ? { isDefault: true } : {}),
        enabled: true,
        modelDiscovery: {
            enabled: instance.type === 'openai' || instance.type === 'seedream' || instance.type === 'sensenova'
        },
        legacyImageProvider: instance.type
    };
}

function createEndpointFromVisionTextInstance(
    instance: VisionTextProviderInstance,
    legacy: LegacyUnifiedConfig = {}
): ProviderEndpoint {
    const credentials = resolveVisionTextProviderInstanceCredentials(instance, {
        apiKey: trimString(legacy.openaiApiKey),
        apiBaseUrl: trimString(legacy.openaiApiBaseUrl)
    });
    return {
        id: instance.id,
        provider: instance.kind === 'openai' ? 'openai' : 'openai-compatible',
        name: instance.name,
        apiKey: credentials.apiKey,
        apiBaseUrl: credentials.apiBaseUrl,
        protocol: visionTextProtocol(instance.apiCompatibility),
        ...(instance.isDefault ? { isDefault: true } : {}),
        enabled: true,
        modelDiscovery: { enabled: true },
        legacyVisionTextKind: instance.kind
    };
}

function endpointsHaveSameCredentials(endpoint: ProviderEndpoint, apiKey: string, apiBaseUrl: string): boolean {
    return endpoint.apiKey.trim() === apiKey.trim() && endpoint.apiBaseUrl.trim() === apiBaseUrl.trim();
}

function normalizeEndpointRecord(value: unknown): ProviderEndpoint | null {
    if (!isRecord(value)) return null;
    const id = trimString(value.id);
    if (!id) return null;
    const provider = normalizeProviderKind(value.provider);
    const protocol = normalizeProviderProtocol(
        value.protocol,
        provider === 'google-gemini'
            ? 'gemini-generate-content'
            : provider === 'google-vertex-ai'
              ? 'vertex-ai-veo'
              : provider === 'runway'
                ? 'runway-api-v1'
                : provider === 'luma'
                  ? 'luma-dream-machine'
                  : provider === 'minimax'
                    ? 'minimax-video'
                    : provider === 'kling'
                      ? 'kling-api'
                      : provider === 'byteplus-modelark'
                        ? 'modelark-video-generation'
                        : provider === 'aliyun-dashscope'
                          ? 'dashscope-video-generation'
                          : provider === 'tencent-hunyuan-video'
                            ? 'tencent-vclm'
                            : provider === 'tencent-tokenhub'
                              ? 'tencent-tokenhub-video'
                              : provider === 'fal'
                                ? 'fal-model-api'
                                : 'openai-images'
    );
    const name = trimString(value.name) || id;
    const apiKey = trimString(value.apiKey);
    const apiBaseUrl = trimString(value.apiBaseUrl);
    const modelDiscovery = isRecord(value.modelDiscovery)
        ? {
              enabled: value.modelDiscovery.enabled !== false,
              ...(typeof value.modelDiscovery.lastRefreshedAt === 'number'
                  ? { lastRefreshedAt: value.modelDiscovery.lastRefreshedAt }
                  : {}),
              ...(typeof value.modelDiscovery.lastError === 'string' && value.modelDiscovery.lastError.trim()
                  ? { lastError: value.modelDiscovery.lastError.trim() }
                  : {})
          }
        : undefined;
    return {
        id,
        provider,
        name,
        apiKey,
        apiBaseUrl,
        protocol,
        ...(value.isDefault === true ? { isDefault: true } : {}),
        enabled: value.enabled !== false,
        ...(modelDiscovery ? { modelDiscovery } : {}),
        ...(value.legacyImageProvider === 'openai' ||
        value.legacyImageProvider === 'google' ||
        value.legacyImageProvider === 'sensenova' ||
        value.legacyImageProvider === 'seedream'
            ? { legacyImageProvider: value.legacyImageProvider }
            : {}),
        ...(value.legacyVisionTextKind === 'openai' || value.legacyVisionTextKind === 'openai-compatible'
            ? { legacyVisionTextKind: value.legacyVisionTextKind }
            : {})
    };
}

export function normalizeProviderEndpoints(value: unknown, legacy: LegacyUnifiedConfig = {}): ProviderEndpoint[] {
    const endpoints = new Map<string, ProviderEndpoint>();

    if (Array.isArray(value)) {
        value.forEach((item) => {
            const endpoint = normalizeEndpointRecord(item);
            if (!endpoint || endpoints.has(endpoint.id)) return;
            endpoints.set(endpoint.id, endpoint);
        });
    }

    normalizeProviderInstances(legacy.providerInstances, legacy).forEach((instance) => {
        const generated = createEndpointFromProviderInstance(instance, legacy);
        endpoints.set(instance.id, mergeGeneratedEndpoint(endpoints.get(instance.id), generated));
    });

    normalizeVisionTextProviderInstances(legacy.visionTextProviderInstances).forEach((instance) => {
        const generated = createEndpointFromVisionTextInstance(instance, legacy);
        endpoints.set(instance.id, mergeGeneratedEndpoint(endpoints.get(instance.id), generated));
    });

    const polishApiKey = trimString(legacy.polishingApiKey);
    const polishApiBaseUrl = trimString(legacy.polishingApiBaseUrl);
    if (polishApiKey || polishApiBaseUrl) {
        const matchingEndpoint = Array.from(endpoints.values()).find((endpoint) =>
            endpointsHaveSameCredentials(endpoint, polishApiKey, polishApiBaseUrl)
        );
        if (!matchingEndpoint && !endpoints.has('prompt-polish:default')) {
            endpoints.set('prompt-polish:default', {
                id: 'prompt-polish:default',
                provider: 'openai-compatible',
                name: 'Prompt Polish',
                apiKey: polishApiKey,
                apiBaseUrl: polishApiBaseUrl,
                protocol: 'openai-chat-completions',
                enabled: true,
                modelDiscovery: { enabled: true }
            });
        }
    }

    return Array.from(endpoints.values());
}

function imageModelCapabilities(model: ImageModelDefinition): ModelCapabilities {
    const tasks: ModelTaskCapability[] = ['image.generate'];
    if (model.supportsEditing) tasks.push('image.edit');
    if (model.supportsMask) tasks.push('image.maskEdit');
    const features: NonNullable<ModelCapabilities['features']> = {
        streaming: model.supportsStreaming,
        imageMask: model.supportsMask,
        customImageSize: model.supportsCustomSize,
        outputFormat: model.supportsOutputFormat,
        outputCompression: model.supportsCompression,
        background: model.supportsBackground,
        moderation: model.supportsModeration
    };
    return {
        tasks,
        inputModalities: model.supportsEditing ? ['text', 'image'] : ['text'],
        outputModalities: ['image'],
        features
    };
}

function visionTextCapabilities(model: VisionTextModelDefinition): ModelCapabilities {
    return {
        tasks: ['vision.text', 'text.generate'],
        inputModalities: ['text', 'image'],
        outputModalities: ['text'],
        features: {
            streaming: model.supportsStreaming,
            structuredOutput: model.supportsStructuredOutput
        }
    };
}

function textCapabilities(source: ModelCatalogSource = 'builtin'): ModelCapabilities {
    return {
        tasks: ['prompt.polish', 'prompt.batchPlan', 'text.generate'],
        inputModalities: ['text'],
        outputModalities: ['text'],
        features: {
            streaming: source !== 'custom'
        }
    };
}

function inferRemoteCapabilities(
    modelId: string,
    provider: ProviderKind
): { capabilities: ModelCapabilities; confidence: CapabilityConfidence } {
    const normalized = modelId.toLowerCase();
    if (
        provider === 'google-gemini' ||
        normalized.startsWith('gemini-') ||
        normalized.startsWith('veo-')
    ) {
        const isVeo = normalized.startsWith('veo-');
        if (isVeo) {
            return {
                capabilities: {
                    tasks: ['video.generate', 'video.imageToVideo', 'video.extend'],
                    inputModalities: ['text', 'image'],
                    outputModalities: ['video'],
                    features: {
                        video: {
                            asyncJob: true,
                            progressPolling: true,
                            downloadContent: true,
                            resultUrlExpires: true,
                            inputImageUpload: 'base64',
                            referenceImages: true,
                            startFrame: true,
                            endFrame: true,
                            videoExtension: true,
                            nativeAudio: true,
                            cancel: true
                        }
                    }
                },
                confidence: 'high'
            };
        }
        return {
            capabilities: {
                tasks: ['vision.text', 'text.generate'],
                inputModalities: ['text', 'image'],
                outputModalities: ['text'],
                features: { streaming: true, structuredOutput: true }
            },
            confidence: 'medium'
        };
    }
    if (normalized.includes('sora')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        downloadContent: true,
                        resultUrlExpires: true,
                        inputImageUpload: 'base64',
                        referenceImages: true,
                        startFrame: true,
                        videoExtension: true,
                        videoEdit: true,
                        nativeAudio: true,
                        negativePrompt: false,
                        seed: false,
                        batch: true,
                        cancel: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.startsWith('veo-')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo', 'video.extend'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        downloadContent: true,
                        resultUrlExpires: true,
                        inputImageUpload: 'base64',
                        referenceImages: true,
                        startFrame: true,
                        endFrame: true,
                        videoExtension: true,
                        nativeAudio: true,
                        cancel: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (
        normalized.includes('gen4') ||
        normalized.includes('gen3') ||
        normalized.includes('aleph') ||
        normalized.includes('act_two')
    ) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        downloadContent: true,
                        webhooks: true,
                        inputImageUpload: 'publicUrl',
                        referenceImages: true,
                        cancel: true,
                        seed: true,
                        negativePrompt: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.startsWith('ray-') || normalized.includes('ray2') || normalized.includes('ray3')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        downloadContent: true,
                        webhooks: true,
                        inputImageUpload: 'publicUrl',
                        startFrame: true,
                        endFrame: true,
                        cameraControl: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.includes('hailuo') || normalized.includes('minimax-hailuo') || normalized.includes('minimax-video')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        downloadContent: true,
                        inputImageUpload: 'base64',
                        startFrame: true,
                        endFrame: true,
                        referenceImages: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.startsWith('kling-')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        webhooks: true,
                        downloadContent: true,
                        inputImageUpload: 'publicUrl',
                        cameraControl: true,
                        multiShot: true,
                        nativeAudio: true,
                        negativePrompt: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.includes('seedance') || normalized.includes('doubao-seedance')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        downloadContent: true,
                        resultUrlExpires: true,
                        inputImageUpload: 'publicUrl',
                        referenceImages: true,
                        multiShot: true,
                        nativeAudio: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.includes('wan2.') || normalized.startsWith('wan-')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo', 'video.referenceToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        webhooks: true,
                        downloadContent: true,
                        inputImageUpload: 'publicUrl',
                        startFrame: true,
                        endFrame: true,
                        videoExtension: true,
                        promptEnhance: true,
                        negativePrompt: true,
                        seed: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.includes('happy-horse') || normalized.includes('alibaba/happy-horse')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo', 'video.edit', 'video.referenceToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        downloadContent: true,
                        inputImageUpload: 'publicUrl',
                        referenceImages: true,
                        videoEdit: true,
                        nativeAudio: true
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.includes('hy-video') || normalized.includes('yt-video')) {
        return {
            capabilities: {
                tasks: ['video.generate', 'video.imageToVideo'],
                inputModalities: ['text', 'image'],
                outputModalities: ['video'],
                features: {
                    video: {
                        asyncJob: true,
                        progressPolling: true,
                        downloadContent: true,
                        inputImageUpload: 'publicUrl'
                    }
                }
            },
            confidence: 'high'
        };
    }
    if (normalized.includes('gpt-image') || normalized.includes('image')) {
        return {
            capabilities: {
                tasks: ['image.generate', 'image.edit'],
                inputModalities: ['text', 'image'],
                outputModalities: ['image'],
                features: { outputFormat: true, customImageSize: normalized.includes('gpt-image-2') }
            },
            confidence: normalized.includes('gpt-image') ? 'high' : 'medium'
        };
    }
    if (normalized.includes('seedream') || normalized.includes('seededit')) {
        return {
            capabilities: {
                tasks: ['image.generate', 'image.edit'],
                inputModalities: ['text', 'image'],
                outputModalities: ['image'],
                features: { outputFormat: true, customImageSize: true }
            },
            confidence: 'high'
        };
    }
    if (normalized.includes('vision') || normalized.includes('vl') || normalized.includes('omni')) {
        return {
            capabilities: {
                tasks: ['vision.text', 'text.generate'],
                inputModalities: ['text', 'image'],
                outputModalities: ['text'],
                features: { streaming: true }
            },
            confidence: 'medium'
        };
    }
    if (normalized.includes('embed')) {
        return {
            capabilities: {
                tasks: ['embedding.create'],
                inputModalities: ['text'],
                outputModalities: ['embedding']
            },
            confidence: 'medium'
        };
    }
    if (normalized.includes('tts') || normalized.includes('speech')) {
        return {
            capabilities: {
                tasks: ['audio.speech'],
                inputModalities: ['text'],
                outputModalities: ['audio']
            },
            confidence: 'medium'
        };
    }
    if (normalized.includes('whisper') || normalized.includes('transcribe')) {
        return {
            capabilities: {
                tasks: ['audio.transcribe'],
                inputModalities: ['audio'],
                outputModalities: ['text']
            },
            confidence: 'medium'
        };
    }
    if (normalized.includes('reason') || normalized.startsWith('o') || normalized.includes('thinking')) {
        return {
            capabilities: {
                tasks: ['text.generate', 'text.reasoning', 'prompt.polish', 'prompt.batchPlan'],
                inputModalities: ['text'],
                outputModalities: ['text'],
                features: { reasoning: true, streaming: true }
            },
            confidence: 'medium'
        };
    }
    return { capabilities: EMPTY_CAPABILITIES, confidence: 'low' };
}

export function inferModelCatalogCapabilities(
    modelId: string,
    provider: ProviderKind
): { capabilities: ModelCapabilities; confidence: CapabilityConfidence } {
    return inferRemoteCapabilities(modelId, provider);
}

function makeCatalogEntry(input: {
    endpoint: ProviderEndpoint;
    rawModelId: string;
    label?: string;
    source: ModelCatalogSource;
    capabilities: ModelCapabilities;
    defaults?: ModelTaskDefaults;
    capabilityConfidence?: CapabilityConfidence;
    displayLabel?: string;
    upstreamVendor?: string;
    remoteMetadata?: Record<string, unknown>;
    updatedAt?: number;
}): ModelCatalogEntry {
    const rawModelId = input.rawModelId.trim();
    return {
        id: getCatalogEntryId(input.endpoint.id, rawModelId),
        rawModelId,
        providerEndpointId: input.endpoint.id,
        provider: input.endpoint.provider,
        label: input.label || rawModelId,
        ...(input.displayLabel ? { displayLabel: input.displayLabel } : {}),
        ...(input.upstreamVendor ? { upstreamVendor: input.upstreamVendor } : {}),
        source: input.source,
        enabled: true,
        capabilities: {
            tasks: uniqueStrings(input.capabilities.tasks),
            inputModalities: uniqueStrings(input.capabilities.inputModalities),
            outputModalities: uniqueStrings(input.capabilities.outputModalities),
            ...(input.capabilities.features ? { features: input.capabilities.features } : {})
        },
        ...(input.defaults ? { defaults: input.defaults } : {}),
        capabilityConfidence: input.capabilityConfidence || (input.source === 'remote' ? 'medium' : 'high'),
        ...(input.remoteMetadata ? { remoteMetadata: input.remoteMetadata } : {}),
        ...(input.updatedAt ? { updatedAt: input.updatedAt } : {})
    };
}

function createImageCatalogEntries(
    endpoint: ProviderEndpoint,
    instance: ProviderInstance,
    customImageModels: readonly StoredCustomImageModel[]
): ModelCatalogEntry[] {
    const entries: ModelCatalogEntry[] = [];
    const models =
        instance.models.length > 0
            ? instance.models.map((modelId) => getImageModel(modelId, customImageModels))
            : getAllImageModels(customImageModels).filter((model) => {
                  if (model.provider !== instance.type) return false;
                  if (!model.custom || !model.instanceId) return true;
                  return model.instanceId === instance.id;
              });

    models.forEach((model) => {
        entries.push(
            makeCatalogEntry({
                endpoint,
                rawModelId: model.id,
                label: model.label,
                source: model.custom ? 'custom' : 'builtin',
                capabilities: imageModelCapabilities(model),
                defaults: {
                    image: {
                        ...(model.defaultSize ? { defaultSize: model.defaultSize } : {})
                    }
                },
                capabilityConfidence: model.custom ? 'medium' : 'high'
            })
        );
    });

    return entries;
}

function createVisionTextCatalogEntries(
    endpoint: ProviderEndpoint,
    instance: VisionTextProviderInstance
): ModelCatalogEntry[] {
    return getVisionTextModelDefinitions(instance.models, instance.kind).map((model) =>
        makeCatalogEntry({
            endpoint,
            rawModelId: model.id,
            label: model.label,
            source: instance.models.includes(model.id) ? 'custom' : 'builtin',
            capabilities: visionTextCapabilities(model),
            defaults: {
                visionText: {
                    apiCompatibility: instance.apiCompatibility,
                    defaultDetail: model.defaultDetail,
                    maxImages: model.maxImages,
                    ...(model.maxImageBytes ? { maxImageBytes: model.maxImageBytes } : {}),
                    ...(model.maxOutputTokens ? { maxOutputTokens: model.maxOutputTokens } : {})
                }
            },
            capabilityConfidence: instance.models.includes(model.id) ? 'medium' : 'high'
        })
    );
}

function createPromptPolishCatalogEntry(endpoint: ProviderEndpoint, legacy: LegacyUnifiedConfig): ModelCatalogEntry {
    const modelId = trimString(legacy.polishingModelId) || DEFAULT_PROMPT_POLISH_MODEL;
    return makeCatalogEntry({
        endpoint,
        rawModelId: modelId,
        source: 'custom',
        capabilities: textCapabilities('custom'),
        defaults: {
            promptPolish: {
                thinkingEnabled:
                    optionalBoolean(legacy.polishingThinkingEnabled) ?? DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
                thinkingEffort: trimString(legacy.polishingThinkingEffort) || DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
                thinkingEffortFormat:
                    legacy.polishingThinkingEffortFormat === 'openai' ||
                    legacy.polishingThinkingEffortFormat === 'anthropic' ||
                    legacy.polishingThinkingEffortFormat === 'both'
                        ? legacy.polishingThinkingEffortFormat
                        : DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT
            }
        },
        capabilityConfidence: 'high'
    });
}

function normalizeCapabilities(value: unknown): ModelCapabilities {
    if (!isRecord(value)) return EMPTY_CAPABILITIES;
    const tasks = Array.isArray(value.tasks)
        ? value.tasks.filter(
              (item): item is ModelTaskCapability => typeof item === 'string' && isModelTaskCapability(item)
          )
        : [];
    const inputModalities = Array.isArray(value.inputModalities)
        ? value.inputModalities.filter(
              (item): item is ModelModality => typeof item === 'string' && isModelModality(item)
          )
        : [];
    const outputModalities = Array.isArray(value.outputModalities)
        ? value.outputModalities.filter(
              (item): item is ModelModality => typeof item === 'string' && isModelModality(item)
          )
        : [];
    const features = isRecord(value.features)
        ? Object.fromEntries(
              Object.entries(value.features).filter(([, featureValue]) => typeof featureValue === 'boolean')
          )
        : undefined;
    const videoFeatures = normalizeVideoFeatures(isRecord(value.features) ? value.features : undefined);
    return {
        tasks: uniqueStrings(tasks),
        inputModalities: uniqueStrings(inputModalities),
        outputModalities: uniqueStrings(outputModalities),
        ...(features && Object.keys(features).length > 0 ? { features: { ...features, ...(videoFeatures ? { video: videoFeatures } : {}) } } : videoFeatures ? { features: { video: videoFeatures } } : {})
    };
}

function normalizeModelTaskDefaults(value: unknown): ModelTaskDefaults {
    if (!isRecord(value)) return {};
    const result: ModelTaskDefaults = {};
    const resolutionTiers = ['480p', '720p', '1080p', '4k'] as const;
    if (isRecord(value.image)) {
        const img: { defaultSize?: string } = {};
        if (typeof value.image.defaultSize === 'string') img.defaultSize = value.image.defaultSize;
        result.image = img;
    }
    if (isRecord(value.visionText)) {
        const vt: NonNullable<ModelTaskDefaults['visionText']> = {};
        if (typeof value.visionText.apiCompatibility === 'string') {
            vt.apiCompatibility = value.visionText.apiCompatibility as VisionTextApiCompatibility;
        }
        if (typeof value.visionText.defaultDetail === 'string') {
            vt.defaultDetail = value.visionText.defaultDetail as VisionTextDetail;
        }
        if (typeof value.visionText.maxImages === 'number') vt.maxImages = value.visionText.maxImages;
        if (typeof value.visionText.maxImageBytes === 'number') vt.maxImageBytes = value.visionText.maxImageBytes;
        if (typeof value.visionText.maxOutputTokens === 'number') vt.maxOutputTokens = value.visionText.maxOutputTokens;
        result.visionText = vt;
    }
    if (isRecord(value.promptPolish)) {
        const pp: NonNullable<ModelTaskDefaults['promptPolish']> = {};
        if (typeof value.promptPolish.thinkingEnabled === 'boolean') pp.thinkingEnabled = value.promptPolish.thinkingEnabled;
        if (typeof value.promptPolish.thinkingEffort === 'string') pp.thinkingEffort = value.promptPolish.thinkingEffort;
        if (
            value.promptPolish.thinkingEffortFormat === 'openai' ||
            value.promptPolish.thinkingEffortFormat === 'anthropic' ||
            value.promptPolish.thinkingEffortFormat === 'both'
        ) {
            pp.thinkingEffortFormat = value.promptPolish.thinkingEffortFormat as PromptPolishThinkingEffortFormat;
        }
        result.promptPolish = pp;
    }
    if (isRecord(value.video)) {
        const vd: VideoModelDefaults = {};
        if (typeof value.video.durationSeconds === 'number') vd.durationSeconds = value.video.durationSeconds;
        if (typeof value.video.frameRate === 'number') vd.frameRate = value.video.frameRate;
        if (typeof value.video.count === 'number') vd.count = value.video.count;
        if (typeof value.video.size === 'string') vd.size = value.video.size;
        if (typeof value.video.aspectRatio === 'string') vd.aspectRatio = value.video.aspectRatio;
        if (
            typeof value.video.resolutionTier === 'string' &&
            resolutionTiers.includes(value.video.resolutionTier as typeof resolutionTiers[number])
        ) {
            vd.resolutionTier = value.video.resolutionTier as VideoModelDefaults['resolutionTier'];
        }
        if (typeof value.video.promptEnhanceEnabled === 'boolean') vd.promptEnhanceEnabled = value.video.promptEnhanceEnabled;
        if (typeof value.video.nativeAudioEnabled === 'boolean') vd.nativeAudioEnabled = value.video.nativeAudioEnabled;
        if (typeof value.video.watermarkEnabled === 'boolean') vd.watermarkEnabled = value.video.watermarkEnabled;
        result.video = vd;
    }
    return result;
}

function normalizeVideoFeatures(features: Record<string, unknown> | undefined): VideoModelFeatures | null {
    if (!features || !isRecord(features.video)) return null;
    const v = features.video;
    if (!isRecord(v)) return null;
    if (typeof v.asyncJob !== 'boolean') return null;
    const result: Record<string, unknown> = { asyncJob: v.asyncJob };
    const booleanFields: ReadonlyArray<keyof VideoModelFeatures> = [
        'progressPolling',
        'webhooks',
        'batch',
        'cancel',
        'downloadContent',
        'resultUrlExpires',
        'referenceImages',
        'startFrame',
        'endFrame',
        'videoExtension',
        'videoEdit',
        'nativeAudio',
        'externalAudio',
        'negativePrompt',
        'seed',
        'promptEnhance',
        'watermarkControl',
        'cameraControl',
        'multiShot'
    ];
    const uploadEnum = ['multipart', 'base64', 'publicUrl', 'fileId'] as const;
    for (const field of booleanFields) {
        if (typeof v[field] === 'boolean') {
            result[field] = v[field];
        }
    }
    if (typeof v.inputImageUpload === 'string' && uploadEnum.includes(v.inputImageUpload as typeof uploadEnum[number])) {
        result.inputImageUpload = v.inputImageUpload as 'multipart' | 'base64' | 'publicUrl' | 'fileId';
    }
    if (typeof v.inputVideoUpload === 'string' && uploadEnum.includes(v.inputVideoUpload as typeof uploadEnum[number])) {
        result.inputVideoUpload = v.inputVideoUpload as 'multipart' | 'base64' | 'publicUrl' | 'fileId';
    }
    return result as VideoModelFeatures;
}

function normalizeCatalogEntryRecord(
    value: unknown,
    endpointsById: Map<string, ProviderEndpoint>
): ModelCatalogEntry | null {
    if (!isRecord(value)) return null;
    const rawModelId = trimString(value.rawModelId);
    const providerEndpointId = trimString(value.providerEndpointId);
    const endpoint = endpointsById.get(providerEndpointId);
    if (!rawModelId || !endpoint) return null;

    const source =
        value.source === 'builtin' || value.source === 'remote' || value.source === 'custom' ? value.source : 'custom';
    const capabilityConfidence =
        value.capabilityConfidence === 'high' ||
        value.capabilityConfidence === 'medium' ||
        value.capabilityConfidence === 'low'
            ? value.capabilityConfidence
            : source === 'remote'
              ? 'medium'
              : 'high';
    const remoteMetadata = isRecord(value.remoteMetadata) ? value.remoteMetadata : undefined;
    return {
        id: trimString(value.id) || getCatalogEntryId(providerEndpointId, rawModelId),
        rawModelId,
        providerEndpointId,
        provider: normalizeProviderKind(value.provider, endpoint.provider),
        label: trimString(value.label) || rawModelId,
        ...(trimString(value.displayLabel) ? { displayLabel: trimString(value.displayLabel) } : {}),
        ...(trimString(value.upstreamVendor) ? { upstreamVendor: trimString(value.upstreamVendor) } : {}),
        ...(trimString(value.modelFamily) ? { modelFamily: trimString(value.modelFamily) } : {}),
        source,
        enabled: value.enabled !== false,
        capabilities: normalizeCapabilities(value.capabilities),
        ...(isRecord(value.defaults) ? { defaults: normalizeModelTaskDefaults(value.defaults) } : {}),
        capabilityConfidence,
        ...(remoteMetadata ? { remoteMetadata } : {}),
        ...(typeof value.updatedAt === 'number' ? { updatedAt: value.updatedAt } : {})
    };
}

function isModelTaskCapability(value: string): value is ModelTaskCapability {
    return [
        'image.generate',
        'image.edit',
        'image.maskEdit',
        'vision.text',
        'text.generate',
        'text.reasoning',
        'prompt.polish',
        'prompt.batchPlan',
        'video.generate',
        'video.imageToVideo',
        'video.edit',
        'video.extend',
        'video.referenceToVideo',
        'video.audioToVideo',
        'video.character',
        'audio.speech',
        'audio.transcribe',
        'embedding.create'
    ].includes(value);
}

function isModelModality(value: string): value is ModelModality {
    return ['text', 'image', 'audio', 'video', 'embedding'].includes(value);
}

export function normalizeModelCatalogEntries(
    value: unknown,
    endpoints: readonly ProviderEndpoint[],
    legacy: LegacyUnifiedConfig = {}
): ModelCatalogEntry[] {
    const endpointsById = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));
    const generated = new Map<string, ModelCatalogEntry>();
    const providerInstances = normalizeProviderInstances(legacy.providerInstances, legacy);
    const customImageModels = normalizeCustomImageModels(legacy.customImageModels);

    providerInstances.forEach((instance) => {
        const endpoint = endpointsById.get(instance.id);
        if (!endpoint) return;
        createImageCatalogEntries(endpoint, instance, customImageModels).forEach((entry) =>
            generated.set(entry.id, entry)
        );
    });

    normalizeVisionTextProviderInstances(legacy.visionTextProviderInstances).forEach((instance) => {
        const endpoint = endpointsById.get(instance.id);
        if (!endpoint) return;
        createVisionTextCatalogEntries(endpoint, instance).forEach((entry) => generated.set(entry.id, entry));
    });

    const polishModelId = trimString(legacy.polishingModelId);
    if (polishModelId || trimString(legacy.polishingApiKey) || trimString(legacy.polishingApiBaseUrl)) {
        const endpoint =
            endpoints.find((item) =>
                endpointsHaveSameCredentials(
                    item,
                    trimString(legacy.polishingApiKey),
                    trimString(legacy.polishingApiBaseUrl)
                )
            ) ||
            endpointsById.get('prompt-polish:default') ||
            endpointsById.get('openai:default') ||
            endpoints[0];
        if (endpoint) {
            const entry = createPromptPolishCatalogEntry(endpoint, legacy);
            generated.set(entry.id, entry);
        }
    }

    if (Array.isArray(value)) {
        value.forEach((item) => {
            const entry = normalizeCatalogEntryRecord(item, endpointsById);
            if (!entry) return;
            const inferred =
                entry.source === 'remote' &&
                entry.capabilities.tasks.length === 0 &&
                entry.capabilityConfidence !== 'high'
                    ? inferRemoteCapabilities(entry.rawModelId, entry.provider)
                    : null;
            generated.set(entry.id, {
                ...generated.get(entry.id),
                ...entry,
                capabilities:
                    entry.capabilities.tasks.length > 0
                        ? entry.capabilities
                        : (inferred?.capabilities ?? entry.capabilities),
                capabilityConfidence:
                    entry.capabilities.tasks.length > 0
                        ? entry.capabilityConfidence
                        : (inferred?.confidence ?? entry.capabilityConfidence)
            });
        });
    }

    return Array.from(generated.values());
}

export function normalizeModelTaskDefaultCatalogEntryIds(
    value: unknown,
    entries: readonly ModelCatalogEntry[],
    legacy: LegacyUnifiedConfig = {}
): ModelTaskDefaultCatalogEntryIds {
    const entryIds = new Set(entries.map((entry) => entry.id));
    const defaults: ModelTaskDefaultCatalogEntryIds = {};
    if (isRecord(value)) {
        Object.entries(value).forEach(([task, entryId]) => {
            if (!isModelTaskCapability(task) || typeof entryId !== 'string' || !entryIds.has(entryId)) return;
            defaults[task] = entryId;
        });
    }

    const imageDefaultEntry =
        entries.find(
            (entry) => entry.rawModelId === DEFAULT_IMAGE_MODEL && entry.capabilities.tasks.includes('image.generate')
        ) || entries.find((entry) => entry.capabilities.tasks.includes('image.generate'));
    const editDefaultEntry =
        entries.find(
            (entry) => entry.rawModelId === DEFAULT_IMAGE_MODEL && entry.capabilities.tasks.includes('image.edit')
        ) || entries.find((entry) => entry.capabilities.tasks.includes('image.edit'));
    const visionDefaultModel = trimString(legacy.visionTextModelId) || DEFAULT_VISION_TEXT_MODEL;
    const visionDefaultEntry =
        entries.find(
            (entry) => entry.rawModelId === visionDefaultModel && entry.capabilities.tasks.includes('vision.text')
        ) || entries.find((entry) => entry.capabilities.tasks.includes('vision.text'));
    const polishDefaultModel = trimString(legacy.polishingModelId) || DEFAULT_PROMPT_POLISH_MODEL;
    const polishDefaultEntry =
        entries.find(
            (entry) => entry.rawModelId === polishDefaultModel && entry.capabilities.tasks.includes('prompt.polish')
        ) ||
        entries.find((entry) => entry.capabilities.tasks.includes('prompt.polish')) ||
        entries.find((entry) => entry.capabilities.tasks.includes('text.generate'));

    if (!defaults['image.generate'] && imageDefaultEntry) defaults['image.generate'] = imageDefaultEntry.id;
    if (!defaults['image.edit'] && editDefaultEntry) defaults['image.edit'] = editDefaultEntry.id;
    if (!defaults['vision.text'] && visionDefaultEntry) defaults['vision.text'] = visionDefaultEntry.id;
    if (!defaults['prompt.polish'] && polishDefaultEntry) defaults['prompt.polish'] = polishDefaultEntry.id;

    return defaults;
}

export function normalizeUnifiedProviderModelConfig(
    value: ModelCatalogConfig | undefined,
    legacy: LegacyUnifiedConfig
): Required<ModelCatalogConfig> {
    const providerEndpoints = normalizeProviderEndpoints(value?.providerEndpoints, legacy);
    const modelCatalog = normalizeModelCatalogEntries(value?.modelCatalog, providerEndpoints, legacy);
    const modelTaskDefaultCatalogEntryIds = normalizeModelTaskDefaultCatalogEntryIds(
        value?.modelTaskDefaultCatalogEntryIds,
        modelCatalog,
        legacy
    );
    return { providerEndpoints, modelCatalog, modelTaskDefaultCatalogEntryIds };
}

export function getModelCatalogEntriesForTask(
    config: ModelCatalogConfig,
    task: ModelTaskCapability,
    options: { includeUnclassified?: boolean; providerEndpointId?: string } = {}
): ModelCatalogEntry[] {
    const endpoints = config.providerEndpoints ?? [];
    const endpointIds = new Set(
        endpoints.filter((endpoint) => endpoint.enabled !== false).map((endpoint) => endpoint.id)
    );
    return (config.modelCatalog ?? []).filter((entry) => {
        if (entry.enabled === false) return false;
        if (!endpointIds.has(entry.providerEndpointId)) return false;
        if (options.providerEndpointId && entry.providerEndpointId !== options.providerEndpointId) return false;
        if (entry.capabilities.tasks.includes(task)) return true;
        return options.includeUnclassified === true && entry.capabilityConfidence === 'low';
    });
}

export function findModelCatalogEntry(
    config: ModelCatalogConfig,
    selector: { catalogEntryId?: string; providerEndpointId?: string; rawModelId?: string }
): ModelCatalogEntry | null {
    const entries = config.modelCatalog ?? [];
    if (selector.catalogEntryId) {
        const entry = entries.find((item) => item.id === selector.catalogEntryId);
        if (entry) return entry;
    }
    if (selector.providerEndpointId && selector.rawModelId) {
        const id = getCatalogEntryId(selector.providerEndpointId, selector.rawModelId);
        const entry = entries.find((item) => item.id === id);
        if (entry) return entry;
    }
    if (selector.rawModelId) {
        return entries.find((item) => item.rawModelId === selector.rawModelId) ?? null;
    }
    return null;
}

export function resolveDefaultModelCatalogEntry(
    config: ModelCatalogConfig,
    task: ModelTaskCapability
): ModelCatalogEntry | null {
    const defaultId = config.modelTaskDefaultCatalogEntryIds?.[task];
    const defaultEntry = defaultId ? findModelCatalogEntry(config, { catalogEntryId: defaultId }) : null;
    if (defaultEntry && defaultEntry.enabled !== false && defaultEntry.capabilities.tasks.includes(task)) {
        return defaultEntry;
    }
    return getModelCatalogEntriesForTask(config, task)[0] ?? null;
}

export function upsertDiscoveredModelCatalogEntries(
    currentEntries: readonly ModelCatalogEntry[],
    endpoint: ProviderEndpoint,
    discoveredModels: ReadonlyArray<{
        id: string;
        label?: string;
        displayLabel?: string;
        upstreamVendor?: string;
        remoteMetadata?: Record<string, unknown>;
    }>,
    updatedAt: number = Date.now()
): ModelCatalogEntry[] {
    const entriesById = new Map(currentEntries.map((entry) => [entry.id, entry]));
    discoveredModels.forEach((model) => {
        const rawModelId = model.id.trim();
        if (!rawModelId) return;
        const id = getCatalogEntryId(endpoint.id, rawModelId);
        const existing = entriesById.get(id);
        const inferred = inferRemoteCapabilities(rawModelId, endpoint.provider);
        entriesById.set(id, {
            ...(existing ??
                makeCatalogEntry({
                    endpoint,
                    rawModelId,
                    label: model.label || model.displayLabel || rawModelId,
                    source: 'remote',
                    capabilities: inferred.capabilities,
                    capabilityConfidence: inferred.confidence
                })),
            source: existing?.source ?? 'remote',
            label: existing?.label || model.label || model.displayLabel || rawModelId,
            ...(model.displayLabel ? { displayLabel: model.displayLabel } : {}),
            ...(model.upstreamVendor ? { upstreamVendor: model.upstreamVendor } : {}),
            ...(model.remoteMetadata ? { remoteMetadata: model.remoteMetadata } : {}),
            capabilities:
                existing && (existing.capabilities.tasks.length > 0 || existing.capabilityConfidence === 'high')
                    ? existing.capabilities
                    : inferred.capabilities,
            capabilityConfidence:
                existing && (existing.capabilities.tasks.length > 0 || existing.capabilityConfidence === 'high')
                    ? existing.capabilityConfidence
                    : inferred.confidence,
            updatedAt
        });
    });
    return Array.from(entriesById.values());
}

export function resolvePromptPolishCatalogSelection(
    config: ModelCatalogConfig & LegacyUnifiedConfig
): PromptPolishCatalogSelection {
    const entry =
        resolveDefaultModelCatalogEntry(config, 'prompt.polish') ||
        getModelCatalogEntriesForTask(config, 'text.generate')[0] ||
        null;
    const endpoint = entry
        ? ((config.providerEndpoints ?? []).find((item) => item.id === entry.providerEndpointId) ?? null)
        : null;

    const fallbackProviderInstances = normalizeProviderInstances(config.providerInstances, config);
    const fallbackOpenAIInstance = getProviderInstance(
        fallbackProviderInstances,
        'openai',
        config.selectedProviderInstanceId as string
    );
    const apiKey =
        endpoint?.apiKey ||
        trimString(config.polishingApiKey) ||
        fallbackOpenAIInstance.apiKey ||
        trimString(config.openaiApiKey);
    const apiBaseUrl =
        endpoint?.apiBaseUrl ||
        trimString(config.polishingApiBaseUrl) ||
        fallbackOpenAIInstance.apiBaseUrl ||
        trimString(config.openaiApiBaseUrl);

    return {
        endpoint,
        catalogEntry: entry,
        apiKey,
        apiBaseUrl,
        modelId: entry?.rawModelId || trimString(config.polishingModelId) || DEFAULT_PROMPT_POLISH_MODEL,
        thinkingEnabled:
            entry?.defaults?.promptPolish?.thinkingEnabled ??
            optionalBoolean(config.polishingThinkingEnabled) ??
            DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
        thinkingEffort:
            entry?.defaults?.promptPolish?.thinkingEffort ||
            trimString(config.polishingThinkingEffort) ||
            DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
        thinkingEffortFormat:
            entry?.defaults?.promptPolish?.thinkingEffortFormat ||
            (config.polishingThinkingEffortFormat === 'openai' ||
            config.polishingThinkingEffortFormat === 'anthropic' ||
            config.polishingThinkingEffortFormat === 'both'
                ? config.polishingThinkingEffortFormat
                : DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT)
    };
}

export function endpointToLegacyProviderInstance(endpoint: ProviderEndpoint): ProviderInstance | null {
    if (!endpoint.legacyImageProvider) return null;
    return {
        id: endpoint.id,
        type: endpoint.legacyImageProvider,
        name: endpoint.name,
        apiKey: endpoint.apiKey,
        apiBaseUrl: endpoint.apiBaseUrl,
        models: [],
        ...(endpoint.isDefault ? { isDefault: true } : {})
    };
}

export function endpointToLegacyVisionTextProviderInstance(
    endpoint: ProviderEndpoint
): VisionTextProviderInstance | null {
    if (!endpoint.legacyVisionTextKind) return null;
    return {
        id: endpoint.id,
        kind: endpoint.legacyVisionTextKind,
        name: endpoint.name,
        apiKey: endpoint.apiKey,
        apiBaseUrl: endpoint.apiBaseUrl,
        apiCompatibility:
            endpoint.protocol === 'openai-responses' ? 'responses' : DEFAULT_VISION_TEXT_API_COMPATIBILITY,
        models: [],
        ...(endpoint.isDefault ? { isDefault: true } : {})
    };
}

export function getCatalogEntryLabel(entry: ModelCatalogEntry, endpoint?: ProviderEndpoint): string {
    const label = entry.displayLabel || entry.label || entry.rawModelId;
    const source = entry.source === 'remote' ? '发现' : entry.source === 'custom' ? '自定义' : '预置';
    return endpoint ? `${endpoint.name} / ${label} · ${source}` : `${label} · ${source}`;
}

export function getCatalogConfigFromUnknown(value: unknown, legacy: LegacyUnifiedConfig): Required<ModelCatalogConfig> {
    if (!isRecord(value)) return normalizeUnifiedProviderModelConfig(undefined, legacy);
    return normalizeUnifiedProviderModelConfig(
        {
            providerEndpoints: Array.isArray(value.providerEndpoints)
                ? (value.providerEndpoints as ProviderEndpoint[])
                : undefined,
            modelCatalog: Array.isArray(value.modelCatalog) ? (value.modelCatalog as ModelCatalogEntry[]) : undefined,
            modelTaskDefaultCatalogEntryIds: isRecord(value.modelTaskDefaultCatalogEntryIds)
                ? (value.modelTaskDefaultCatalogEntryIds as ModelTaskDefaultCatalogEntryIds)
                : undefined
        },
        legacy
    );
}

export function resolveVisionTextCredentialsFromCatalog(
    config: ModelCatalogConfig & LegacyUnifiedConfig,
    providerInstance: VisionTextProviderInstance
) {
    const endpoint = (config.providerEndpoints ?? []).find((item) => item.id === providerInstance.id);
    if (endpoint) {
        return {
            apiKey:
                endpoint.apiKey ||
                (providerInstance.reuseOpenAIImageCredentials ? trimString(config.openaiApiKey) : ''),
            apiBaseUrl:
                endpoint.apiBaseUrl ||
                (providerInstance.reuseOpenAIImageCredentials ? trimString(config.openaiApiBaseUrl) : '')
        };
    }
    return resolveVisionTextProviderInstanceCredentials(providerInstance, {
        apiKey: trimString(config.openaiApiKey),
        apiBaseUrl: trimString(config.openaiApiBaseUrl)
    });
}
