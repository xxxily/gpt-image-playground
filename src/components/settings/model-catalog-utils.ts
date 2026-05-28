import type { ManagedModelOption } from '@/components/settings/model-manager';
import {
    getCatalogEntryLabel,
    isPendingVideoPlaceholderEntry,
    type ModelCatalogEntry,
    type ModelCatalogSource,
    type ModelTaskCapability,
    type ProviderEndpoint,
    type ProviderKind
} from '@/lib/provider-model-catalog';

type Translate = (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;

export type ModelCatalogProviderFilter = 'all' | ProviderKind;
export type ModelCatalogEndpointFilter = 'all' | string;
export type ModelCatalogTaskFilter = 'all' | ModelTaskCapability;
export type ModelCatalogSourceFilter = 'all' | ModelCatalogSource;
export type ModelCatalogStatusFilter = 'all' | 'enabled' | 'disabled' | 'unclassified';

export const MODEL_CATALOG_PROVIDER_LABELS: Record<ProviderKind, string> = {
    openai: 'OpenAI',
    'openai-compatible': 'OpenAI Compatible',
    anthropic: 'Anthropic',
    'anthropic-compatible': 'Anthropic Compatible',
    'google-gemini': 'Google Gemini',
    'volcengine-ark': 'VolcEngine Ark',
    sensenova: 'SenseNova',
    'google-vertex-ai': 'Google Vertex AI',
    runway: 'Runway',
    luma: 'Luma',
    minimax: 'MiniMax',
    kling: 'Kling',
    'byteplus-modelark': 'BytePlus ModelArk',
    'aliyun-dashscope': 'Aliyun DashScope',
    'tencent-hunyuan-video': 'Tencent Hunyuan Video',
    'tencent-tokenhub': 'Tencent TokenHub',
    fal: 'fal.ai (聚合平台)',
    xai: 'xAI'
};

export const MODEL_CATALOG_PROVIDER_ORDER: ProviderKind[] = [
    'openai',
    'openai-compatible',
    'anthropic',
    'anthropic-compatible',
    'google-gemini',
    'volcengine-ark',
    'sensenova',
    'google-vertex-ai',
    'runway',
    'luma',
    'minimax',
    'kling',
    'byteplus-modelark',
    'aliyun-dashscope',
    'tencent-hunyuan-video',
    'tencent-tokenhub',
    'fal',
    'xai'
];

export const MODEL_CATALOG_TASK_OPTIONS: Array<{ value: ModelCatalogTaskFilter; label: string }> = [
    { value: 'all', label: '全部能力' },
    { value: 'image.generate', label: '文生图' },
    { value: 'image.edit', label: '图生图' },
    { value: 'image.maskEdit', label: '蒙版编辑' },
    { value: 'vision.text', label: '图生文' },
    { value: 'prompt.polish', label: '提示词润色' },
    { value: 'text.generate', label: '文本生成' },
    { value: 'text.reasoning', label: '推理文本' },
    { value: 'video.generate', label: '文生视频' },
    { value: 'video.imageToVideo', label: '图生视频' },
    { value: 'audio.speech', label: '语音合成' },
    { value: 'audio.transcribe', label: '语音转写' },
    { value: 'embedding.create', label: '向量嵌入' }
];

export const MODEL_CATALOG_SOURCE_OPTIONS: Array<{ value: ModelCatalogSourceFilter; label: string }> = [
    { value: 'all', label: '全部来源' },
    { value: 'remote', label: '发现模型' },
    { value: 'builtin', label: '预置模型' },
    { value: 'custom', label: '自定义模型' }
];

export const MODEL_CATALOG_STATUS_OPTIONS: Array<{ value: ModelCatalogStatusFilter; label: string }> = [
    { value: 'all', label: '全部状态' },
    { value: 'enabled', label: '已启用' },
    { value: 'disabled', label: '已禁用' },
    { value: 'unclassified', label: '未分类' }
];

export function modelCatalogProviderLabel(provider: ProviderKind): string {
    return MODEL_CATALOG_PROVIDER_LABELS[provider] || provider;
}

export function modelCatalogTaskLabel(task: ModelTaskCapability): string {
    return MODEL_CATALOG_TASK_OPTIONS.find((option) => option.value === task)?.label || task;
}

export function modelCatalogEntrySearchText(entry: ModelCatalogEntry, endpoint?: ProviderEndpoint): string {
    const metadataValues = entry.remoteMetadata
        ? Object.values(entry.remoteMetadata).flatMap((value) => {
              if (typeof value === 'string' || typeof value === 'number') return [String(value)];
              if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').map(String);
              return [];
          })
        : [];
    return [
        entry.rawModelId,
        entry.label,
        entry.displayLabel,
        entry.upstreamVendor,
        entry.modelFamily,
        entry.source,
        entry.capabilityConfidence,
        modelCatalogProviderLabel(entry.provider),
        endpoint?.name,
        endpoint?.provider ? modelCatalogProviderLabel(endpoint.provider) : undefined,
        ...entry.capabilities.tasks,
        ...entry.capabilities.inputModalities,
        ...entry.capabilities.outputModalities,
        ...metadataValues
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export function modelCatalogSelectLabel(entry: ModelCatalogEntry): string {
    if (entry.displayLabel && entry.displayLabel !== entry.rawModelId) {
        return `${entry.displayLabel} (${entry.rawModelId})`;
    }
    return entry.label || entry.rawModelId;
}

export function getCatalogEntryManagedOption(
    entry: ModelCatalogEntry,
    endpoint: ProviderEndpoint | undefined,
    selectedModelIds: ReadonlySet<string>,
    t: Translate
): ManagedModelOption {
    return {
        id: entry.id,
        modelId: entry.rawModelId,
        label: modelCatalogSelectLabel(entry),
        detail: [entry.upstreamVendor, entry.capabilities.tasks.map(modelCatalogTaskLabel).join(' / ')]
            .filter(Boolean)
            .join(' · '),
        badges: [
            entry.source === 'remote'
                ? t('settings.modelManager.badgeDiscovered')
                : entry.source === 'custom'
                  ? t('settings.modelManager.badgeCustom')
                  : t('settings.modelManager.badgePreset'),
            selectedModelIds.has(entry.rawModelId) ? t('settings.modelManager.badgeAdded') : '',
            entry.capabilityConfidence === 'low'
                ? t('settings.modelCatalog.status.unclassified')
                : isPendingVideoPlaceholderEntry(entry)
                  ? t('settings.modelCatalog.status.pendingAdapter')
                  : ''
        ].filter(Boolean),
        metadata: {
            displayLabel: entry.displayLabel,
            upstreamVendor: entry.upstreamVendor,
            endpointName: endpoint?.name
        }
    };
}

export function getCatalogEntryBindingOption(
    entry: ModelCatalogEntry,
    endpoint: ProviderEndpoint | undefined,
    selectedModelIds: ReadonlySet<string>,
    task: ModelTaskCapability,
    t: Translate
): ManagedModelOption {
    return {
        id: entry.id,
        modelId: entry.rawModelId,
        label: getCatalogEntryLabel(entry, endpoint),
        detail: [entry.upstreamVendor, entry.capabilities.tasks.map(modelCatalogTaskLabel).join(' / ')]
            .filter(Boolean)
            .join(' · '),
        badges: [
            entry.source === 'remote'
                ? t('settings.modelManager.badgeDiscovered')
                : entry.source === 'custom'
                  ? t('settings.modelManager.badgeCustom')
                  : t('settings.modelManager.badgePreset'),
            selectedModelIds.has(entry.rawModelId) ? t('settings.modelBinding.selectedBadge') : '',
            entry.capabilities.tasks.includes(task) ? '' : t('settings.modelBinding.willBindBadge')
        ].filter(Boolean),
        metadata: {
            displayLabel: entry.displayLabel,
            upstreamVendor: entry.upstreamVendor,
            endpointName: endpoint?.name
        }
    };
}
