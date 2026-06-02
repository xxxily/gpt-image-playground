import type { ModelTaskCapability } from '@/lib/provider-model-catalog';

export type ConfigurationGuidanceIntent =
    | 'add-endpoint'
    | 'edit-endpoint'
    | 'select-task-model'
    | 'manage-endpoint-models';

export type ConfigurationGuidanceSource = 'workbench' | 'api-error' | 'settings-empty-state' | 'tauri-proxy';

export type ConfigurationGuidanceView =
    | 'provider-endpoints'
    | 'image-endpoints'
    | 'video-endpoints'
    | 'vision-text'
    | 'polish-prompts'
    | 'batch-config';

export type ConfigurationGuidanceTarget = {
    view: ConfigurationGuidanceView;
    intent: ConfigurationGuidanceIntent;
    taskCapability?: ModelTaskCapability;
    providerEndpointId?: string;
    providerTemplateId?: string;
    source?: ConfigurationGuidanceSource;
};

export type ConfigurationGuidanceKind = 'image' | 'visionText' | 'polish' | 'batch' | 'video';

export const CONFIGURATION_REQUIRED_MESSAGE_KEY = 'configuration.required.message';
export const CONFIGURATION_REQUIRED_ACTION_KEY = 'configuration.required.action';
export const CONFIGURATION_REQUIRED_MESSAGE = '请先配置服务供应商端点和填写 API Key。';
const CONFIGURATION_REQUIRED_CODE_PATTERN = /\bconfiguration_required\b/iu;
const API_ERROR_METADATA_SUFFIX_PATTERN = /\s*\((?=[^)]*\b(?:code|type):)[^)]*\)\s*$/iu;

const CONFIGURATION_ERROR_PATTERNS = [
    /服务器中转模式需要配置\s*API\s*Key/u,
    /OPENAI_API_KEY\s+is\s+not\s+set/iu,
    /requires\s+GEMINI_API_KEY/iu,
    /需要配置\s*API\s*Key/u,
    /API\s*Key\s*为空/u,
    /请先在图生文与多模态设置中选择端点和模型/u,
    /请选择一个视频模型/u,
    /视频供应商尚未配置/u,
    /Video provider not configured/u,
    /Select a video model/u,
    /提示词润色需要先在供应商端点管理/u,
    /提示词润色需要先.*选择可用模型/u,
    /批量规划需要先在供应商端点管理/u,
    /批量规划需要先.*选择可用模型/u,
    /批量规划需要配置\s*API\s*Key/u,
    /Batch planning.*model/iu,
    /Prompt polish.*model/iu
] as const;

function stripApiErrorMetadataSuffix(message: string): string {
    return message.replace(API_ERROR_METADATA_SUFFIX_PATTERN, '').trim();
}

export const CONFIGURATION_GUIDANCE_TARGETS = {
    image: {
        view: 'image-endpoints',
        intent: 'add-endpoint',
        taskCapability: 'image.generate',
        source: 'workbench'
    },
    visionText: {
        view: 'vision-text',
        intent: 'select-task-model',
        taskCapability: 'vision.text',
        source: 'workbench'
    },
    polish: {
        view: 'polish-prompts',
        intent: 'select-task-model',
        taskCapability: 'prompt.polish',
        source: 'workbench'
    },
    batch: {
        view: 'batch-config',
        intent: 'select-task-model',
        taskCapability: 'prompt.batchPlan',
        source: 'workbench'
    },
    video: {
        view: 'video-endpoints',
        intent: 'add-endpoint',
        taskCapability: 'video.generate',
        source: 'workbench'
    }
} satisfies Record<ConfigurationGuidanceKind, ConfigurationGuidanceTarget>;

export function isConfigurationRequiredMessage(message: unknown): boolean {
    if (typeof message !== 'string') return false;
    const normalized = message.trim();
    if (!normalized) return false;
    const userMessage = stripApiErrorMetadataSuffix(normalized);
    if (normalized === CONFIGURATION_REQUIRED_MESSAGE || userMessage === CONFIGURATION_REQUIRED_MESSAGE) return true;
    if (CONFIGURATION_REQUIRED_CODE_PATTERN.test(normalized)) return true;
    return CONFIGURATION_ERROR_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function getConfigurationGuidanceKindFromMessage(message: unknown): ConfigurationGuidanceKind | null {
    if (typeof message !== 'string' || !isConfigurationRequiredMessage(message)) return null;
    const normalized = message.trim();
    const userMessage = stripApiErrorMetadataSuffix(normalized);
    if (userMessage === CONFIGURATION_REQUIRED_MESSAGE) return null;
    if (/图生文|vision\.text|image-to-text|Image-to-Text/iu.test(userMessage)) return 'visionText';
    if (/批量|batch/iu.test(userMessage)) return 'batch';
    if (/润色|polish/iu.test(userMessage)) return 'polish';
    if (/视频|video|Select a video model/iu.test(userMessage)) return 'video';
    return 'image';
}

export function getConfigurationGuidanceTarget(
    kind: ConfigurationGuidanceKind,
    overrides: Partial<ConfigurationGuidanceTarget> = {}
): ConfigurationGuidanceTarget {
    return {
        ...CONFIGURATION_GUIDANCE_TARGETS[kind],
        ...overrides
    };
}

export function getConfigurationGuidanceTargetForMessage(
    message: unknown,
    fallbackKind: ConfigurationGuidanceKind = 'image',
    overrides: Partial<ConfigurationGuidanceTarget> = {}
): ConfigurationGuidanceTarget | null {
    if (!isConfigurationRequiredMessage(message)) return null;
    return getConfigurationGuidanceTarget(getConfigurationGuidanceKindFromMessage(message) ?? fallbackKind, overrides);
}
