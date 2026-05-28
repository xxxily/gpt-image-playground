'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useNotice } from '@/components/notice-provider';
import { ProviderEndpointModelBindingPicker } from '@/components/provider-endpoint-model-binding-picker';
import {
    ModelListManagerDialog,
    mergeManagedModelOptions,
    normalizeModelIds,
    type ManagedModelOption,
    type ModelManagerDialogState
} from '@/components/settings/model-manager';
import { ProviderEndpointCard } from '@/components/settings/provider-endpoint-card';
import { SecretInput } from '@/components/settings/secret-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { ExternalLink } from '@/components/ui/external-link';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
    DEFAULT_BATCH_FEATURE_CONFIG,
    BATCH_AUTO_PROMPT_TEMPLATE_ID,
    getBatchPlanningSystemPrompt,
    normalizeBatchFeatureConfig,
    type BatchFeatureConfig,
    type BatchParameterPolishConfig,
    type BatchPlanningStrategyId,
    type BatchPromptTemplate
} from '@/lib/batch-config';
import { DEFAULT_BATCH_PLAN_SYSTEM_PROMPT } from '@/lib/batch-plan-core';
import {
    DEFAULT_HIDDEN_PROMPT_TOOLBAR_BUTTONS,
    PROMPT_TOOLBAR_BUTTON_IDS,
    loadConfig,
    normalizeHiddenPromptToolbarButtons,
    saveConfig,
    type AppConfig,
    type PromptToolbarButtonId
} from '@/lib/config';
import {
    CONFIG_SCHEMA_VERSION,
    buildExportedConfig,
    triggerJsonDownload,
    validateImportedConfig
} from '@/lib/config-export';
import { formatClientDirectLinkRestriction, getClientDirectLinkRestriction } from '@/lib/connection-policy';
import {
    buildDesktopPromoPlacementsUrl,
    isValidProxyUrl,
    normalizeDesktopPromoServiceMode,
    normalizeDesktopPromoServiceUrl,
    normalizeDesktopProxyMode,
    normalizeDesktopProxyUrl,
    type DesktopPromoServiceMode,
    type DesktopProxyMode
} from '@/lib/desktop-config';
import { DESKTOP_APP_DOWNLOAD_URL, DESKTOP_ONLY_SETTINGS_MESSAGE } from '@/lib/desktop-guidance';
import { copyTextToClipboard, invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import { APP_LANGUAGE_LABELS, detectRuntimeAppLanguage, type AppLanguage } from '@/lib/i18n/language';
import { buildDiscoverProviderModelsRequest, discoverProviderModels } from '@/lib/model-discovery';
import {
    getAllImageModels,
    getProviderLabel,
    IMAGE_MODEL_IDS,
    IMAGE_PROVIDER_ORDER,
    normalizeCustomImageModels,
    type CustomImageModelCapabilities,
    type ImageProviderId,
    type StoredCustomImageModel
} from '@/lib/model-registry';
import { DEFAULT_PROMPT_HISTORY_LIMIT, normalizePromptHistoryLimit } from '@/lib/prompt-history';
import {
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
    DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
    POLISH_PICKER_TOKEN_DEFAULT,
    POLISH_PICKER_TOKEN_TEMPORARY,
    PROMPT_POLISH_PRESETS,
    getDefaultPolishPickerOrder,
    normalizePolishPickerOrder,
    normalizePromptPolishThinkingEffortFormat,
    normalizePromptPolishPresetId,
    normalizeStoredCustomPolishPrompts,
    type PolishPickerToken,
    type StoredCustomPolishPrompt,
    type PromptPolishThinkingEffortFormat
} from '@/lib/prompt-polish-core';
import {
    createProviderInstanceId,
    getProviderInstanceHostname,
    normalizeProviderInstances,
    type ProviderInstance
} from '@/lib/provider-instances';
import {
    ensureCatalogEntryTaskCapability,
    getProviderModelBindingEndpoints,
    supportsProviderEndpointModelDiscovery
} from '@/lib/provider-model-binding';
import {
    getCatalogEntryLabel,
    createCustomModelCatalogEntry,
    getCatalogEntryId,
    getModelCatalogEntriesForTask,
    inferModelCatalogCapabilities,
    inferModelCatalogCapabilitiesForEndpoint,
    isPromptPolishProviderEndpoint,
    isVideoProviderProtocol,
    normalizeUnifiedProviderModelConfig,
    resolveDefaultModelCatalogEntry,
    resolveVisionTextCatalogSelection,
    supportsProviderModelDiscovery,
    isPendingVideoPlaceholderEntry,
    upsertDiscoveredModelCatalogEntries,
    findModelCatalogEntry,
    type ModelCatalogEntry,
    type ModelCatalogSource,
    type ModelTaskCapability,
    type ModelTaskDefaultCatalogEntryIds,
    type ProviderEndpoint,
    type ProviderKind,
    type ProviderProtocol
} from '@/lib/provider-model-catalog';
import {
    DEFAULT_SYNC_AUTO_SYNC_SETTINGS,
    DEFAULT_SYNC_CONFIG,
    DEFAULT_SYNC_UI_SETTINGS,
    clearSyncConfig,
    fetchS3Status,
    isS3SyncConfigConfigured,
    loadSyncConfig,
    normalizeSyncConfig,
    saveSyncConfig,
    testS3Connection,
    type S3SyncRequestMode,
    type S3StatusResponse,
    type SyncAutoSyncScopes
} from '@/lib/sync';
import {
    DEFAULT_VIDEO_SYNC_OPTIONS,
    DEFAULT_VIDEO_TASK_DEFAULTS,
    normalizeVideoSyncOptions,
    normalizeVideoTaskDefaults,
    type VideoSyncOptions,
    type VideoTaskDefaults
} from '@/lib/video-types';
import {
    normalizeVisionTextProviderInstances,
    type VisionTextProviderInstance
} from '@/lib/vision-text-provider-instances';
import {
    DEFAULT_VISION_TEXT_API_COMPATIBILITY,
    DEFAULT_VISION_TEXT_DETAIL,
    DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
    DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
    DEFAULT_VISION_TEXT_STREAMING_ENABLED,
    DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED,
    DEFAULT_VISION_TEXT_SYSTEM_PROMPT,
    DEFAULT_VISION_TEXT_TASK_TYPE,
    VISION_TEXT_DETAIL_LABELS,
    VISION_TEXT_TASK_TYPE_LABELS,
    type VisionTextApiCompatibility,
    type VisionTextDetail,
    type VisionTextResponseFormat,
    type VisionTextTaskType
} from '@/lib/vision-text-types';
import {
    AlertTriangle,
    ArrowLeft,
    ChevronDown,
    ChevronRight,
    Cpu,
    Database,
    Download,
    Eye,
    EyeOff,
    FolderOpen,
    Globe,
    Plus,
    Radio,
    ScanEye,
    History,
    Layers3,
    MoveDown,
    MoveUp,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Wifi,
    Bug,
    Cloud
} from 'lucide-react';
import * as React from 'react';

type SettingsDialogProps = {
    onConfigChange: (config: Partial<AppConfig>) => void;
    openTarget?: { view: SettingsView; nonce: number } | null;
};

type Translate = (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;

type SettingsView =
    | 'main'
    | 'providers'
    | 'provider-endpoints'
    | 'image-endpoints'
    | 'video-endpoints'
    | 'vision-text'
    | 'model-catalog'
    | 'polish-prompts'
    | 'batch-config';
type ModelCatalogProviderFilter = 'all' | ProviderKind;
type ModelCatalogEndpointFilter = 'all' | string;
type ModelCatalogTaskFilter = 'all' | ModelTaskCapability;
type ModelCatalogSourceFilter = 'all' | ModelCatalogSource;
type ModelCatalogStatusFilter = 'all' | 'enabled' | 'disabled' | 'unclassified';
type UnifiedTaskDefaultTask = ModelTaskCapability;

const AUTO_SYNC_SCOPE_OPTIONS: Array<{ key: keyof SyncAutoSyncScopes; label: string; description: string }> = [
    { key: 'appConfig', label: '应用配置', description: '模型、接口、存储方式等非敏感设置。' },
    { key: 'polishingPrompts', label: '自定义润色提示词', description: '润色系统提示词、预设和自定义润色提示词。' },
    { key: 'promptHistory', label: '提示词历史', description: '输入过的提示词记录。' },
    { key: 'promptTemplates', label: '提示词库', description: '用户自定义提示词模板。' },
    { key: 'imageHistory', label: '生成历史记录', description: '历史条目、提示词、参数和图片文件名。' },
    { key: 'imageBlobs', label: '历史图片文件', description: '只上传新增或变化的历史图片文件。' },
    { key: 'visionTextHistory', label: '图生文历史记录', description: '图生文结果、参数和源图文件名。' },
    { key: 'visionTextSourceImages', label: '图生文源图文件', description: '只上传新增或变化的图生文源图。' }
];

const PROMPT_TOOLBAR_BUTTON_OPTIONS: Array<{ key: PromptToolbarButtonId; labelKey: string }> =
    PROMPT_TOOLBAR_BUTTON_IDS.map((key) => ({
        key,
        labelKey: `settings.promptToolbar.${key}`
    }));

const TASK_DEFAULT_ROW_CONFIGS: Array<{
    task: UnifiedTaskDefaultTask;
    titleKey: string;
    descriptionKey: string;
}> = [
    {
        task: 'image.generate',
        titleKey: 'settings.taskDefaults.imageGenerate.title',
        descriptionKey: 'settings.taskDefaults.imageGenerate.description'
    },
    {
        task: 'image.edit',
        titleKey: 'settings.taskDefaults.imageEdit.title',
        descriptionKey: 'settings.taskDefaults.imageEdit.description'
    },
    {
        task: 'vision.text',
        titleKey: 'settings.taskDefaults.visionText.title',
        descriptionKey: 'settings.taskDefaults.visionText.description'
    },
    {
        task: 'video.generate',
        titleKey: 'settings.taskDefaults.videoGenerate.title',
        descriptionKey: 'settings.taskDefaults.videoGenerate.description'
    },
    {
        task: 'video.imageToVideo',
        titleKey: 'settings.taskDefaults.videoImageToVideo.title',
        descriptionKey: 'settings.taskDefaults.videoImageToVideo.description'
    }
];

const VIDEO_ASPECT_RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
const VIDEO_RESOLUTION_TIER_OPTIONS = ['480p', '720p', '1080p', '4k'] as const;
const VIDEO_SYNC_OPTION_CONFIGS: Array<{
    key: keyof Pick<VideoSyncOptions, 'videoHistory' | 'videoSourceImages' | 'videoThumbnails' | 'videoFiles'>;
    labelKey: string;
}> = [
    { key: 'videoHistory', labelKey: 'settings.video.sync.history.label' },
    { key: 'videoSourceImages', labelKey: 'settings.video.sync.sourceImages.label' },
    { key: 'videoThumbnails', labelKey: 'settings.video.sync.thumbnails.label' },
    { key: 'videoFiles', labelKey: 'settings.video.sync.files.label' }
];

type InitialConfig = {
    appLanguage: AppLanguage;
    apiKey: string;
    apiBaseUrl: string;
    geminiApiKey: string;
    geminiApiBaseUrl: string;
    sensenovaApiKey: string;
    sensenovaApiBaseUrl: string;
    seedreamApiKey: string;
    seedreamApiBaseUrl: string;
    providerInstances: ProviderInstance[];
    selectedProviderInstanceId: string;
    providerEndpoints: ProviderEndpoint[];
    modelCatalog: ModelCatalogEntry[];
    modelTaskDefaultCatalogEntryIds: ModelTaskDefaultCatalogEntryIds;
    visionTextProviderInstances: VisionTextProviderInstance[];
    selectedVisionTextProviderInstanceId: string;
    visionTextModelId: string;
    visionTextTaskType: VisionTextTaskType;
    visionTextDetail: VisionTextDetail;
    visionTextResponseFormat: VisionTextResponseFormat;
    visionTextStreamingEnabled: boolean;
    visionTextStructuredOutputEnabled: boolean;
    visionTextMaxOutputTokens: number;
    visionTextSystemPrompt: string;
    visionTextApiCompatibility: VisionTextApiCompatibility;
    visionTextHistoryEnabled: boolean;
    videoTaskDefaults: VideoTaskDefaults;
    videoSyncOptions: VideoSyncOptions;
    batchFeature: BatchFeatureConfig;
    customImageModels: StoredCustomImageModel[];
    polishingPrompt: string;
    polishingPresetId: string;
    polishingThinkingEnabled: boolean;
    polishingThinkingEffort: string;
    polishingThinkingEffortFormat: PromptPolishThinkingEffortFormat;
    polishingCustomPrompts: StoredCustomPolishPrompt[];
    polishPickerOrder: PolishPickerToken[];
    storageMode: string;
    imageStoragePath: string;
    connectionMode: string;
    maxConcurrentTasks: number;
    promptHistoryLimit: number;
    hiddenPromptToolbarButtons: PromptToolbarButtonId[];
    desktopProxyMode: DesktopProxyMode;
    desktopProxyUrl: string;
    desktopPromoServiceMode: DesktopPromoServiceMode;
    desktopPromoServiceUrl: string;
    desktopDebugMode: boolean;
};

type ProviderModelRefreshStatus = Record<
    string,
    { loading?: boolean; message?: string; tone?: 'success' | 'error' | 'info' }
>;

type PromptPolishModelSelectionTask = 'prompt.polish' | 'prompt.batchPlan';
const PROMPT_MODEL_BINDING_COMPATIBILITY_FAMILIES = ['openai-compatible', 'anthropic-compatible'] as const;
const BATCH_MODEL_BINDING_COMPATIBILITY_FAMILIES = PROMPT_MODEL_BINDING_COMPATIBILITY_FAMILIES;
const VISION_TEXT_MODEL_BINDING_COMPATIBILITY_FAMILIES = PROMPT_MODEL_BINDING_COMPATIBILITY_FAMILIES;

function statusBadge(label: string, tone: 'green' | 'blue' | 'amber') {
    const toneClass =
        tone === 'green'
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
            : tone === 'blue'
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    const dotClass = tone === 'green' ? 'bg-emerald-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-amber-500';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            {label}
        </span>
    );
}

const polishingThinkingFormatLabels: Record<PromptPolishThinkingEffortFormat, string> = {
    openai: 'OpenAI 兼容',
    anthropic: 'Anthropic 兼容',
    both: '兼容模式'
};

const MODEL_CATALOG_PROVIDER_LABELS: Record<ProviderKind, string> = {
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

const MODEL_CATALOG_PROVIDER_ORDER: ProviderKind[] = [
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

type ProviderEndpointTemplate = {
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

const TEXT_PROVIDER_ENDPOINT_TEMPLATES: ProviderEndpointTemplate[] = [
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

const IMAGE_PROVIDER_ENDPOINT_TEMPLATES: ProviderEndpointTemplate[] = [
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

const VIDEO_PROVIDER_ENDPOINT_TEMPLATES: ProviderEndpointTemplate[] = [
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

const PROVIDER_ENDPOINT_TEMPLATES: ProviderEndpointTemplate[] = [
    ...TEXT_PROVIDER_ENDPOINT_TEMPLATES,
    ...IMAGE_PROVIDER_ENDPOINT_TEMPLATES,
    ...VIDEO_PROVIDER_ENDPOINT_TEMPLATES
];

function normalizeProviderEndpointSlug(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return slug || 'default';
}

function createProviderEndpointId(
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

function getProviderEndpointTemplateKey(template: ProviderEndpointTemplate): string {
    return `${template.kind}:${template.protocol}`;
}

function getProviderEndpointTemplateByKey(key: string): ProviderEndpointTemplate | null {
    return PROVIDER_ENDPOINT_TEMPLATES.find((template) => getProviderEndpointTemplateKey(template) === key) ?? null;
}

function isImageProviderEndpoint(endpoint: ProviderEndpoint): boolean {
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

function isTextProviderEndpoint(endpoint: ProviderEndpoint): boolean {
    if (isImageProviderEndpoint(endpoint) || isVideoProviderProtocol(endpoint.protocol)) return false;
    return isPromptPolishProviderEndpoint(endpoint);
}

const MODEL_CATALOG_TASK_OPTIONS: Array<{ value: ModelCatalogTaskFilter; label: string }> = [
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

const MODEL_CATALOG_SOURCE_OPTIONS: Array<{ value: ModelCatalogSourceFilter; label: string }> = [
    { value: 'all', label: '全部来源' },
    { value: 'remote', label: '发现模型' },
    { value: 'builtin', label: '预置模型' },
    { value: 'custom', label: '自定义模型' }
];

const MODEL_CATALOG_STATUS_OPTIONS: Array<{ value: ModelCatalogStatusFilter; label: string }> = [
    { value: 'all', label: '全部状态' },
    { value: 'enabled', label: '已启用' },
    { value: 'disabled', label: '已禁用' },
    { value: 'unclassified', label: '未分类' }
];

function modelCatalogProviderLabel(provider: ProviderKind): string {
    return MODEL_CATALOG_PROVIDER_LABELS[provider] || provider;
}

function modelCatalogTaskLabel(task: ModelTaskCapability): string {
    return MODEL_CATALOG_TASK_OPTIONS.find((option) => option.value === task)?.label || task;
}

function modelCatalogEntrySearchText(entry: ModelCatalogEntry, endpoint?: ProviderEndpoint): string {
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

function modelCatalogSelectLabel(entry: ModelCatalogEntry): string {
    if (entry.displayLabel && entry.displayLabel !== entry.rawModelId) {
        return `${entry.displayLabel} (${entry.rawModelId})`;
    }
    return entry.label || entry.rawModelId;
}

function batchStrategyLabelKey(strategyId: BatchPlanningStrategyId): string {
    if (strategyId === 'content-split') return 'batch.dialog.mode.contentSplit';
    if (strategyId === 'variant-exploration') return 'batch.dialog.mode.variantExploration';
    if (strategyId === 'reference-variant') return 'batch.dialog.mode.referenceVariant';
    if (strategyId === 'manual-split') return 'batch.source.manual';
    if (strategyId === 'json-import') return 'batch.source.json';
    return 'batch.dialog.mode.auto';
}

function getCatalogEntryManagedOption(
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

function getCatalogEntryBindingOption(
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

function SettingsNavigationButton({
    title,
    description,
    icon,
    badge,
    onClick
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            className='border-border bg-card/80 hover:bg-accent/50 focus-visible:ring-offset-background flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:outline-none'>
            <span className='flex min-w-0 items-start gap-3'>
                <span
                    className='bg-muted text-muted-foreground mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'
                    aria-hidden='true'>
                    {icon}
                </span>
                <span className='min-w-0'>
                    <span className='text-foreground block text-sm font-semibold'>{title}</span>
                    <span className='text-muted-foreground mt-1 block text-sm leading-5'>{description}</span>
                </span>
            </span>
            <span className='flex shrink-0 items-center gap-2'>
                {badge}
                <ChevronRight className='text-muted-foreground h-4 w-4' />
            </span>
        </button>
    );
}

function ProviderSection({
    title,
    description,
    icon,
    children,
    defaultOpen = false
}: {
    title: string;
    description: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = React.useState(defaultOpen);

    return (
        <section className='border-border bg-card/80 dark:bg-panel-soft rounded-2xl border shadow-sm'>
            <button
                type='button'
                onClick={() => setOpen((value) => !value)}
                className='hover:bg-accent/50 focus-visible:ring-offset-background flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:outline-none'
                aria-expanded={open}>
                <span className='min-w-0'>
                    <span className='text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-[0.22em] uppercase'>
                        {icon && (
                            <span className='text-muted-foreground' aria-hidden='true'>
                                {icon}
                            </span>
                        )}
                        {title}
                    </span>
                    <span className='text-muted-foreground mt-1 block text-sm'>{description}</span>
                </span>
                <ChevronDown
                    className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && <div className='border-border space-y-4 border-t p-4'>{children}</div>}
        </section>
    );
}

function providerLabel(provider: ImageProviderId): string {
    return getProviderLabel(provider);
}

export function SettingsDialog({ onConfigChange, openTarget }: SettingsDialogProps) {
    const { addNotice } = useNotice();
    const { language, setLanguage, t } = useAppLanguage();
    const [open, setOpen] = React.useState(false);
    const [settingsView, setSettingsView] = React.useState<SettingsView>('main');
    const programmaticOpenViewRef = React.useRef<SettingsView | null>(null);
    const pendingOpenTargetNonceRef = React.useRef<number | null>(null);
    const [apiKey, setApiKey] = React.useState('');
    const [apiBaseUrl, setApiBaseUrl] = React.useState('');
    const [geminiApiKey, setGeminiApiKey] = React.useState('');
    const [geminiApiBaseUrl, setGeminiApiBaseUrl] = React.useState('');
    const [sensenovaApiKey, setSensenovaApiKey] = React.useState('');
    const [sensenovaApiBaseUrl, setSensenovaApiBaseUrl] = React.useState('');
    const [seedreamApiKey, setSeedreamApiKey] = React.useState('');
    const [seedreamApiBaseUrl, setSeedreamApiBaseUrl] = React.useState('');
    const [appLanguage, setAppLanguage] = React.useState<AppLanguage>(language);
    const [polishingPrompt, setPolishingPrompt] = React.useState(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
    const [polishingPresetId, setPolishingPresetId] = React.useState(DEFAULT_POLISHING_PRESET_ID);
    const [polishingThinkingEnabled, setPolishingThinkingEnabled] = React.useState(
        DEFAULT_PROMPT_POLISH_THINKING_ENABLED
    );
    const [polishingThinkingEffort, setPolishingThinkingEffort] = React.useState(DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
    const [polishingThinkingEffortFormat, setPolishingThinkingEffortFormat] =
        React.useState<PromptPolishThinkingEffortFormat>(DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT);
    const [polishingCustomPrompts, setPolishingCustomPrompts] = React.useState<StoredCustomPolishPrompt[]>([]);
    const [polishPickerOrder, setPolishPickerOrder] =
        React.useState<PolishPickerToken[]>(getDefaultPolishPickerOrder());
    const [polishPromptEditIndex, setPolishPromptEditIndex] = React.useState<number | null>(null);
    const [newPolishPromptName, setNewPolishPromptName] = React.useState('');
    const [newPolishPromptSystemPrompt, setNewPolishPromptSystemPrompt] = React.useState('');
    const [customImageModels, setCustomImageModels] = React.useState<StoredCustomImageModel[]>([]);
    const [providerInstances, setProviderInstances] = React.useState<ProviderInstance[]>([]);
    const [selectedProviderInstanceId, setSelectedProviderInstanceId] = React.useState('');
    const [providerEndpoints, setProviderEndpoints] = React.useState<ProviderEndpoint[]>([]);
    const [modelCatalog, setModelCatalog] = React.useState<ModelCatalogEntry[]>([]);
    const [modelTaskDefaultCatalogEntryIds, setModelTaskDefaultCatalogEntryIds] =
        React.useState<ModelTaskDefaultCatalogEntryIds>({});
    const [modelCatalogSearch, setModelCatalogSearch] = React.useState('');
    const [modelCatalogProviderFilter, setModelCatalogProviderFilter] =
        React.useState<ModelCatalogProviderFilter>('all');
    const [modelCatalogEndpointFilter, setModelCatalogEndpointFilter] =
        React.useState<ModelCatalogEndpointFilter>('all');
    const [modelCatalogTaskFilter, setModelCatalogTaskFilter] = React.useState<ModelCatalogTaskFilter>('all');
    const [modelCatalogSourceFilter, setModelCatalogSourceFilter] = React.useState<ModelCatalogSourceFilter>('all');
    const [modelCatalogStatusFilter, setModelCatalogStatusFilter] = React.useState<ModelCatalogStatusFilter>('all');
    const [providerModelRefreshStatus, setProviderModelRefreshStatus] = React.useState<ProviderModelRefreshStatus>({});
    const [modelManagerDialog, setModelManagerDialog] = React.useState<ModelManagerDialogState | null>(null);
    const [promptModelSelectionEndpointIds, setPromptModelSelectionEndpointIds] = React.useState<
        Partial<Record<PromptPolishModelSelectionTask, string>>
    >({});
    const [newUnifiedProviderTemplateKey, setNewUnifiedProviderTemplateKey] = React.useState(
        getProviderEndpointTemplateKey(TEXT_PROVIDER_ENDPOINT_TEMPLATES[0])
    );
    const [newUnifiedProviderName, setNewUnifiedProviderName] = React.useState('');
    const [newUnifiedProviderApiKey, setNewUnifiedProviderApiKey] = React.useState('');
    const [newUnifiedProviderApiBaseUrl, setNewUnifiedProviderApiBaseUrl] = React.useState('');
    const [newUnifiedProviderApiKeyVisible, setNewUnifiedProviderApiKeyVisible] = React.useState(false);
    const [unifiedProviderApiKeyVisibility, setUnifiedProviderApiKeyVisibility] = React.useState<
        Record<string, boolean>
    >({});
    const [providerApiKeyVisibility, setProviderApiKeyVisibility] = React.useState<Record<string, boolean>>({});
    const [visionTextProviderInstances, setVisionTextProviderInstances] = React.useState<VisionTextProviderInstance[]>(
        []
    );
    const [selectedVisionTextProviderInstanceId, setSelectedVisionTextProviderInstanceId] = React.useState('');
    const [visionTextModelId, setVisionTextModelId] = React.useState('');
    const [visionTextTaskType, setVisionTextTaskType] =
        React.useState<VisionTextTaskType>(DEFAULT_VISION_TEXT_TASK_TYPE);
    const [visionTextDetail, setVisionTextDetail] = React.useState<VisionTextDetail>(DEFAULT_VISION_TEXT_DETAIL);
    const [visionTextResponseFormat, setVisionTextResponseFormat] = React.useState<VisionTextResponseFormat>(
        DEFAULT_VISION_TEXT_RESPONSE_FORMAT
    );
    const [visionTextStreamingEnabled, setVisionTextStreamingEnabled] = React.useState(
        DEFAULT_VISION_TEXT_STREAMING_ENABLED
    );
    const [visionTextStructuredOutputEnabled, setVisionTextStructuredOutputEnabled] = React.useState(
        DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED
    );
    const [visionTextMaxOutputTokens, setVisionTextMaxOutputTokens] = React.useState(
        DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS
    );
    const [visionTextSystemPrompt, setVisionTextSystemPrompt] = React.useState(DEFAULT_VISION_TEXT_SYSTEM_PROMPT);
    const [visionTextApiCompatibility, setVisionTextApiCompatibility] = React.useState<VisionTextApiCompatibility>(
        DEFAULT_VISION_TEXT_API_COMPATIBILITY
    );
    const [storageMode, setStorageMode] = React.useState<'fs' | 'indexeddb' | 'auto'>('auto');
    const [connectionMode, setConnectionMode] = React.useState<'proxy' | 'direct'>('proxy');
    const [saved, setSaved] = React.useState(false);
    const [s3Endpoint, setS3Endpoint] = React.useState('');
    const [s3Region, setS3Region] = React.useState(DEFAULT_SYNC_CONFIG.s3.region);
    const [s3Bucket, setS3Bucket] = React.useState('');
    const [s3AccessKeyId, setS3AccessKeyId] = React.useState('');
    const [s3SecretAccessKey, setS3SecretAccessKey] = React.useState('');
    const [showS3SecretAccessKey, setShowS3SecretAccessKey] = React.useState(false);
    const [s3ForcePathStyle, setS3ForcePathStyle] = React.useState(DEFAULT_SYNC_CONFIG.s3.forcePathStyle);
    const [s3AllowRemoteDeletion, setS3AllowRemoteDeletion] = React.useState(
        DEFAULT_SYNC_CONFIG.s3.allowRemoteDeletion
    );
    const [s3RequestMode, setS3RequestMode] = React.useState<S3SyncRequestMode>(DEFAULT_SYNC_CONFIG.s3.requestMode);
    const [s3Prefix, setS3Prefix] = React.useState(DEFAULT_SYNC_CONFIG.s3.prefix);
    const [s3ProfileId, setS3ProfileId] = React.useState(DEFAULT_SYNC_CONFIG.s3.profileId);
    const [syncAutoSyncEnabled, setSyncAutoSyncEnabled] = React.useState(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.enabled);
    const [syncAutoSyncScopes, setSyncAutoSyncScopes] = React.useState<SyncAutoSyncScopes>(
        DEFAULT_SYNC_AUTO_SYNC_SETTINGS.scopes
    );
    const [syncHideWhenUnconfigured, setSyncHideWhenUnconfigured] = React.useState(
        DEFAULT_SYNC_UI_SETTINGS.hideWhenUnconfigured
    );
    const [initialSyncConfigSnapshot, setInitialSyncConfigSnapshot] = React.useState('');
    const [envApiBaseUrl, setEnvApiBaseUrl] = React.useState('');
    const [envGeminiApiBaseUrl, setEnvGeminiApiBaseUrl] = React.useState('');
    const [envSensenovaApiBaseUrl, setEnvSensenovaApiBaseUrl] = React.useState('');
    const [envSeedreamApiBaseUrl, setEnvSeedreamApiBaseUrl] = React.useState('');
    const [hasEnvPolishingPrompt, setHasEnvPolishingPrompt] = React.useState(false);
    const [envPolishingThinkingEffort, setEnvPolishingThinkingEffort] = React.useState('');
    const [, setEnvPolishingThinkingEffortFormat] = React.useState('');
    const [videoTaskDefaults, setVideoTaskDefaults] = React.useState<VideoTaskDefaults>(DEFAULT_VIDEO_TASK_DEFAULTS);
    const [videoSyncOptions, setVideoSyncOptions] = React.useState<VideoSyncOptions>(DEFAULT_VIDEO_SYNC_OPTIONS);
    const [batchFeature, setBatchFeature] = React.useState<BatchFeatureConfig>(DEFAULT_BATCH_FEATURE_CONFIG);
    const [batchPromptEditorOpen, setBatchPromptEditorOpen] = React.useState(false);
    const [batchPromptDraft, setBatchPromptDraft] = React.useState('');
    const [hasEnvStorageMode, setHasEnvStorageMode] = React.useState(false);
    const [clientDirectLinkPriority, setClientDirectLinkPriority] = React.useState(false);
    const [serverHasAppPassword, setServerHasAppPassword] = React.useState(false);
    const [initialConfig, setInitialConfig] = React.useState<InitialConfig>({
        appLanguage: language,
        apiKey: '',
        apiBaseUrl: '',
        geminiApiKey: '',
        geminiApiBaseUrl: '',
        sensenovaApiKey: '',
        sensenovaApiBaseUrl: '',
        seedreamApiKey: '',
        seedreamApiBaseUrl: '',
        providerInstances: [],
        selectedProviderInstanceId: '',
        providerEndpoints: [],
        modelCatalog: [],
        modelTaskDefaultCatalogEntryIds: {},
        visionTextProviderInstances: [],
        selectedVisionTextProviderInstanceId: '',
        visionTextModelId: '',
        visionTextTaskType: DEFAULT_VISION_TEXT_TASK_TYPE,
        visionTextDetail: DEFAULT_VISION_TEXT_DETAIL,
        visionTextResponseFormat: DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
        visionTextStreamingEnabled: DEFAULT_VISION_TEXT_STREAMING_ENABLED,
        visionTextStructuredOutputEnabled: DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED,
        visionTextMaxOutputTokens: DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
        visionTextSystemPrompt: DEFAULT_VISION_TEXT_SYSTEM_PROMPT,
        visionTextApiCompatibility: DEFAULT_VISION_TEXT_API_COMPATIBILITY,
        visionTextHistoryEnabled: true,
        videoTaskDefaults: DEFAULT_VIDEO_TASK_DEFAULTS,
        videoSyncOptions: DEFAULT_VIDEO_SYNC_OPTIONS,
        batchFeature: DEFAULT_BATCH_FEATURE_CONFIG,
        customImageModels: [],
        polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
        polishingPresetId: DEFAULT_POLISHING_PRESET_ID,
        polishingThinkingEnabled: DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
        polishingThinkingEffort: DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
        polishingThinkingEffortFormat: DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
        polishingCustomPrompts: [],
        polishPickerOrder: getDefaultPolishPickerOrder(),
        storageMode: 'auto',
        imageStoragePath: '',
        connectionMode: 'proxy',
        maxConcurrentTasks: 3,
        promptHistoryLimit: DEFAULT_PROMPT_HISTORY_LIMIT,
        hiddenPromptToolbarButtons: [...DEFAULT_HIDDEN_PROMPT_TOOLBAR_BUTTONS],
        desktopProxyMode: 'disabled',
        desktopProxyUrl: '',
        desktopPromoServiceMode: 'current',
        desktopPromoServiceUrl: '',
        desktopDebugMode: false
    });
    const [maxConcurrentTasks, setMaxConcurrentTasks] = React.useState(3);
    const [promptHistoryLimit, setPromptHistoryLimit] = React.useState(DEFAULT_PROMPT_HISTORY_LIMIT);
    const [hiddenPromptToolbarButtons, setHiddenPromptToolbarButtons] = React.useState<PromptToolbarButtonId[]>([]);
    const [visionTextHistoryEnabled, setVisionTextHistoryEnabled] = React.useState(true);
    const [desktopProxyMode, setDesktopProxyMode] = React.useState<DesktopProxyMode>('disabled');
    const [desktopProxyUrl, setDesktopProxyUrl] = React.useState('');
    const [desktopPromoServiceMode, setDesktopPromoServiceMode] = React.useState<DesktopPromoServiceMode>('current');
    const [desktopPromoServiceUrl, setDesktopPromoServiceUrl] = React.useState('');
    const [desktopDebugMode, setDesktopDebugMode] = React.useState(false);
    const [proxyUrlError, setProxyUrlError] = React.useState('');
    const [promoServiceUrlError, setPromoServiceUrlError] = React.useState('');
    const [isDesktopRuntime, setIsDesktopRuntime] = React.useState(false);
    const [imageStoragePath, setImageStoragePath] = React.useState('');
    const [defaultImageStoragePath, setDefaultImageStoragePath] = React.useState('');
    const [imageStoragePathError, setImageStoragePathError] = React.useState('');
    const [saveWarningMessage, setSaveWarningMessage] = React.useState('');
    const [discardConfirmOpen, setDiscardConfirmOpen] = React.useState(false);
    const [s3Status, setS3Status] = React.useState<S3StatusResponse | null>(null);
    const [s3StatusLoading, setS3StatusLoading] = React.useState(false);
    const [s3TestLoading, setS3TestLoading] = React.useState(false);
    const [s3TestResult, setS3TestResult] = React.useState<{ ok: boolean; message: string } | null>(null);
    const desktopPromoPlacementsUrl = React.useMemo(
        () => buildDesktopPromoPlacementsUrl(desktopPromoServiceMode, desktopPromoServiceUrl),
        [desktopPromoServiceMode, desktopPromoServiceUrl]
    );

    const currentSyncConfig = React.useMemo(
        () =>
            normalizeSyncConfig({
                type: 's3',
                s3: {
                    endpoint: s3Endpoint,
                    region: s3Region,
                    bucket: s3Bucket,
                    accessKeyId: s3AccessKeyId,
                    secretAccessKey: s3SecretAccessKey,
                    forcePathStyle: s3ForcePathStyle,
                    allowRemoteDeletion: s3AllowRemoteDeletion,
                    requestMode: s3RequestMode,
                    prefix: s3Prefix,
                    profileId: s3ProfileId
                },
                autoSync: {
                    enabled: syncAutoSyncEnabled,
                    scopes: syncAutoSyncScopes,
                    debounceMs: DEFAULT_SYNC_AUTO_SYNC_SETTINGS.debounceMs
                },
                ui: {
                    hideWhenUnconfigured: syncHideWhenUnconfigured
                }
            }),
        [
            s3AccessKeyId,
            s3AllowRemoteDeletion,
            s3Bucket,
            s3Endpoint,
            s3ForcePathStyle,
            s3Prefix,
            s3ProfileId,
            s3Region,
            s3RequestMode,
            s3SecretAccessKey,
            syncAutoSyncEnabled,
            syncAutoSyncScopes,
            syncHideWhenUnconfigured
        ]
    );
    const currentSyncConfigSnapshot = React.useMemo(
        () =>
            JSON.stringify({
                s3: currentSyncConfig.s3,
                autoSync: currentSyncConfig.autoSync,
                ui: currentSyncConfig.ui
            }),
        [currentSyncConfig]
    );
    const isS3Configured = isS3SyncConfigConfigured(currentSyncConfig.s3);
    const syncHideWhenUnconfiguredChecked = !isS3Configured && syncHideWhenUnconfigured;

    const handleAutoSyncScopeChange = React.useCallback((key: keyof SyncAutoSyncScopes, checked: boolean) => {
        setSyncAutoSyncScopes((current) => ({ ...current, [key]: checked }));
    }, []);

    const handlePromptToolbarButtonVisibilityChange = React.useCallback(
        (buttonId: PromptToolbarButtonId, checked: boolean) => {
            setHiddenPromptToolbarButtons((current) => {
                const normalized = normalizeHiddenPromptToolbarButtons(current);
                if (checked) return normalized.filter((item) => item !== buttonId);
                return normalized.includes(buttonId) ? normalized : [...normalized, buttonId];
            });
        },
        []
    );

    const updateBatchFeature = React.useCallback((updater: (current: BatchFeatureConfig) => BatchFeatureConfig) => {
        setBatchFeature((current) => normalizeBatchFeatureConfig(updater(normalizeBatchFeatureConfig(current))));
    }, []);

    const updateBatchParameterPolish = React.useCallback(
        (patch: Partial<BatchParameterPolishConfig>) => {
            updateBatchFeature((current) => ({
                ...current,
                parameterPolish: {
                    ...current.parameterPolish,
                    ...patch
                }
            }));
        },
        [updateBatchFeature]
    );

    const updateBatchAutoPromptTemplate = React.useCallback(
        (updater: (template: BatchPromptTemplate) => BatchPromptTemplate) => {
            updateBatchFeature((current) => ({
                ...current,
                promptTemplates: current.promptTemplates.map((template) =>
                    template.id === BATCH_AUTO_PROMPT_TEMPLATE_ID ? updater(template) : template
                )
            }));
        },
        [updateBatchFeature]
    );

    React.useEffect(() => {
        if (!openTarget) return;
        pendingOpenTargetNonceRef.current = openTarget.nonce;
        programmaticOpenViewRef.current = openTarget.view;
        setSettingsView(openTarget.view);
        setOpen(true);
        setDiscardConfirmOpen(false);
    }, [openTarget]);

    React.useEffect(() => {
        setIsDesktopRuntime(isTauriDesktop());
    }, []);

    React.useEffect(() => {
        if (!open) return;

        const config = loadConfig();
        const normalizedCustomModels = normalizeCustomImageModels(config.customImageModels);
        const normalizedProviderInstances = normalizeProviderInstances(config.providerInstances, config);
        const normalizedVisionTextProviderInstances = normalizeVisionTextProviderInstances(
            config.visionTextProviderInstances
        );
        const normalizedUnifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(config, {
            ...config,
            providerInstances: normalizedProviderInstances,
            customImageModels: normalizedCustomModels,
            visionTextProviderInstances: normalizedVisionTextProviderInstances
        });
        const normalizedCustomPolishPrompts = normalizeStoredCustomPolishPrompts(
            config.polishingCustomPrompts,
            config.polishingPrompt
        );
        const normalizedPolishPickerOrder = normalizePolishPickerOrder(
            config.polishPickerOrder,
            new Set(normalizedCustomPolishPrompts.map((prompt) => prompt.id))
        );
        const normalizedBatchFeature = normalizeBatchFeatureConfig(config.batchFeature);
        setApiKey(config.openaiApiKey || '');
        setApiBaseUrl(config.openaiApiBaseUrl || '');
        setGeminiApiKey(config.geminiApiKey || '');
        setGeminiApiBaseUrl(config.geminiApiBaseUrl || '');
        setSensenovaApiKey(config.sensenovaApiKey || '');
        setSensenovaApiBaseUrl(config.sensenovaApiBaseUrl || '');
        setSeedreamApiKey(config.seedreamApiKey || '');
        setSeedreamApiBaseUrl(config.seedreamApiBaseUrl || '');
        setAppLanguage(config.appLanguage);
        setProviderInstances(normalizedProviderInstances);
        setSelectedProviderInstanceId(config.selectedProviderInstanceId || '');
        setProviderEndpoints(normalizedUnifiedProviderModelConfig.providerEndpoints);
        setModelCatalog(normalizedUnifiedProviderModelConfig.modelCatalog);
        setModelTaskDefaultCatalogEntryIds(normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds);
        setModelCatalogSearch('');
        setModelCatalogProviderFilter('all');
        setModelCatalogEndpointFilter('all');
        setModelCatalogTaskFilter('all');
        setModelCatalogSourceFilter('all');
        setModelCatalogStatusFilter('all');
        setProviderModelRefreshStatus({});
        setPolishingPrompt(config.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
        setPolishingPresetId(normalizePromptPolishPresetId(config.polishingPresetId));
        setPolishingThinkingEnabled(config.polishingThinkingEnabled);
        setPolishingThinkingEffort(config.polishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
        setPolishingThinkingEffortFormat(
            normalizePromptPolishThinkingEffortFormat(config.polishingThinkingEffortFormat)
        );
        setPolishingCustomPrompts(normalizedCustomPolishPrompts);
        setPolishPickerOrder(normalizedPolishPickerOrder);
        setPolishPromptEditIndex(null);
        setNewPolishPromptName('');
        setNewPolishPromptSystemPrompt('');
        setCustomImageModels(normalizedCustomModels);
        setVisionTextProviderInstances(normalizedVisionTextProviderInstances);
        setSelectedVisionTextProviderInstanceId(config.selectedVisionTextProviderInstanceId || '');
        setVisionTextModelId(config.visionTextModelId || '');
        setVisionTextTaskType(config.visionTextTaskType || DEFAULT_VISION_TEXT_TASK_TYPE);
        setVisionTextDetail(config.visionTextDetail || DEFAULT_VISION_TEXT_DETAIL);
        setVisionTextResponseFormat(config.visionTextResponseFormat || DEFAULT_VISION_TEXT_RESPONSE_FORMAT);
        setVisionTextStreamingEnabled(config.visionTextStreamingEnabled);
        setVisionTextStructuredOutputEnabled(config.visionTextStructuredOutputEnabled);
        setVisionTextMaxOutputTokens(config.visionTextMaxOutputTokens || DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS);
        setVisionTextSystemPrompt(config.visionTextSystemPrompt || DEFAULT_VISION_TEXT_SYSTEM_PROMPT);
        setVisionTextApiCompatibility(config.visionTextApiCompatibility || DEFAULT_VISION_TEXT_API_COMPATIBILITY);
        setVisionTextHistoryEnabled(config.visionTextHistoryEnabled !== false);
        setVideoTaskDefaults(normalizeVideoTaskDefaults(config.videoTaskDefaults));
        setVideoSyncOptions(normalizeVideoSyncOptions(config.videoSyncOptions));
        setBatchFeature(normalizedBatchFeature);
        setBatchPromptEditorOpen(false);
        setBatchPromptDraft(
            getBatchPlanningSystemPrompt(normalizedBatchFeature, normalizedBatchFeature.defaultStrategyId)
        );
        setStorageMode(config.imageStorageMode || 'auto');
        setImageStoragePath(config.imageStoragePath || '');
        setConnectionMode(config.connectionMode || 'proxy');
        setMaxConcurrentTasks(config.maxConcurrentTasks || 3);
        setPromptHistoryLimit(normalizePromptHistoryLimit(config.promptHistoryLimit));
        setHiddenPromptToolbarButtons(normalizeHiddenPromptToolbarButtons(config.hiddenPromptToolbarButtons));
        setDesktopProxyMode(normalizeDesktopProxyMode(config.desktopProxyMode));
        setDesktopProxyUrl(config.desktopProxyUrl || '');
        setDesktopPromoServiceMode(normalizeDesktopPromoServiceMode(config.desktopPromoServiceMode));
        setDesktopPromoServiceUrl(
            normalizeDesktopPromoServiceUrl(
                config.desktopPromoServiceUrl || '',
                normalizeDesktopPromoServiceMode(config.desktopPromoServiceMode)
            )
        );
        setDesktopDebugMode(config.desktopDebugMode || false);
        const syncConfig = loadSyncConfig() || DEFAULT_SYNC_CONFIG;
        setS3Endpoint(syncConfig.s3.endpoint);
        setS3Region(syncConfig.s3.region);
        setS3Bucket(syncConfig.s3.bucket);
        setS3AccessKeyId(syncConfig.s3.accessKeyId);
        setS3SecretAccessKey(syncConfig.s3.secretAccessKey);
        setS3ForcePathStyle(syncConfig.s3.forcePathStyle);
        setS3AllowRemoteDeletion(syncConfig.s3.allowRemoteDeletion);
        setS3RequestMode(syncConfig.s3.requestMode);
        setS3Prefix(syncConfig.s3.prefix);
        setS3ProfileId(syncConfig.s3.profileId);
        setSyncAutoSyncEnabled(syncConfig.autoSync.enabled);
        setSyncAutoSyncScopes(syncConfig.autoSync.scopes);
        setSyncHideWhenUnconfigured(syncConfig.ui.hideWhenUnconfigured);
        setShowS3SecretAccessKey(false);
        setInitialSyncConfigSnapshot(
            JSON.stringify({
                s3: syncConfig.s3,
                autoSync: syncConfig.autoSync,
                ui: syncConfig.ui
            })
        );
        setS3Status(
            isS3SyncConfigConfigured(syncConfig.s3)
                ? {
                      configured: true,
                      endpoint: syncConfig.s3.endpoint,
                      region: syncConfig.s3.region,
                      bucket: syncConfig.s3.bucket,
                      forcePathStyle: syncConfig.s3.forcePathStyle,
                      allowRemoteDeletion: syncConfig.s3.allowRemoteDeletion,
                      rootPrefix: syncConfig.s3.prefix,
                      profileId: syncConfig.s3.profileId
                  }
                : { configured: false, message: '当前浏览器尚未配置 S3 兼容对象存储。' }
        );
        setS3TestResult(null);
        setImageStoragePathError('');
        setPromoServiceUrlError('');
        setSaveWarningMessage('');
        setDiscardConfirmOpen(false);
        setNewUnifiedProviderTemplateKey(getProviderEndpointTemplateKey(TEXT_PROVIDER_ENDPOINT_TEMPLATES[0]));
        setNewUnifiedProviderName('');
        setNewUnifiedProviderApiKey('');
        setNewUnifiedProviderApiBaseUrl('');
        setNewUnifiedProviderApiKeyVisible(false);
        setUnifiedProviderApiKeyVisibility({});
        setProviderApiKeyVisibility({});
        setModelManagerDialog(null);
        const initialSettingsView = programmaticOpenViewRef.current ?? 'main';
        programmaticOpenViewRef.current = null;
        setSettingsView(initialSettingsView);
        setInitialConfig({
            appLanguage: config.appLanguage,
            apiKey: config.openaiApiKey || '',
            apiBaseUrl: config.openaiApiBaseUrl || '',
            geminiApiKey: config.geminiApiKey || '',
            geminiApiBaseUrl: config.geminiApiBaseUrl || '',
            sensenovaApiKey: config.sensenovaApiKey || '',
            sensenovaApiBaseUrl: config.sensenovaApiBaseUrl || '',
            seedreamApiKey: config.seedreamApiKey || '',
            seedreamApiBaseUrl: config.seedreamApiBaseUrl || '',
            providerInstances: normalizedProviderInstances,
            selectedProviderInstanceId: config.selectedProviderInstanceId || '',
            providerEndpoints: normalizedUnifiedProviderModelConfig.providerEndpoints,
            modelCatalog: normalizedUnifiedProviderModelConfig.modelCatalog,
            modelTaskDefaultCatalogEntryIds: normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds,
            visionTextProviderInstances: normalizedVisionTextProviderInstances,
            selectedVisionTextProviderInstanceId: config.selectedVisionTextProviderInstanceId || '',
            visionTextModelId: config.visionTextModelId || '',
            visionTextTaskType: config.visionTextTaskType || DEFAULT_VISION_TEXT_TASK_TYPE,
            visionTextDetail: config.visionTextDetail || DEFAULT_VISION_TEXT_DETAIL,
            visionTextResponseFormat: config.visionTextResponseFormat || DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
            visionTextStreamingEnabled: config.visionTextStreamingEnabled,
            visionTextStructuredOutputEnabled: config.visionTextStructuredOutputEnabled,
            visionTextMaxOutputTokens: config.visionTextMaxOutputTokens || DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
            visionTextSystemPrompt: config.visionTextSystemPrompt || DEFAULT_VISION_TEXT_SYSTEM_PROMPT,
            visionTextApiCompatibility: config.visionTextApiCompatibility || DEFAULT_VISION_TEXT_API_COMPATIBILITY,
            visionTextHistoryEnabled: config.visionTextHistoryEnabled !== false,
            videoTaskDefaults: normalizeVideoTaskDefaults(config.videoTaskDefaults),
            videoSyncOptions: normalizeVideoSyncOptions(config.videoSyncOptions),
            batchFeature: normalizedBatchFeature,
            customImageModels: normalizedCustomModels,
            polishingPrompt: config.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
            polishingPresetId: normalizePromptPolishPresetId(config.polishingPresetId),
            polishingThinkingEnabled: config.polishingThinkingEnabled,
            polishingThinkingEffort: config.polishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
            polishingThinkingEffortFormat: normalizePromptPolishThinkingEffortFormat(
                config.polishingThinkingEffortFormat
            ),
            polishingCustomPrompts: normalizedCustomPolishPrompts,
            polishPickerOrder: normalizedPolishPickerOrder,
            storageMode: config.imageStorageMode || 'auto',
            imageStoragePath: config.imageStoragePath || '',
            connectionMode: config.connectionMode || 'proxy',
            maxConcurrentTasks: config.maxConcurrentTasks || 3,
            promptHistoryLimit: normalizePromptHistoryLimit(config.promptHistoryLimit),
            hiddenPromptToolbarButtons: normalizeHiddenPromptToolbarButtons(config.hiddenPromptToolbarButtons),
            desktopProxyMode: normalizeDesktopProxyMode(config.desktopProxyMode),
            desktopProxyUrl: config.desktopProxyUrl || '',
            desktopPromoServiceMode: normalizeDesktopPromoServiceMode(config.desktopPromoServiceMode),
            desktopPromoServiceUrl: normalizeDesktopPromoServiceUrl(
                config.desktopPromoServiceUrl || '',
                normalizeDesktopPromoServiceMode(config.desktopPromoServiceMode)
            ),
            desktopDebugMode: config.desktopDebugMode || false
        });
        setSaved(false);
        fetch('/api/config')
            .then((response) => response.json())
            .then((data) => {
                setEnvApiBaseUrl(typeof data.envApiBaseUrl === 'string' ? data.envApiBaseUrl : '');
                setEnvGeminiApiBaseUrl(typeof data.envGeminiApiBaseUrl === 'string' ? data.envGeminiApiBaseUrl : '');
                setEnvSensenovaApiBaseUrl(
                    typeof data.envSensenovaApiBaseUrl === 'string' ? data.envSensenovaApiBaseUrl : ''
                );
                setEnvSeedreamApiBaseUrl(
                    typeof data.envSeedreamApiBaseUrl === 'string' ? data.envSeedreamApiBaseUrl : ''
                );
                setHasEnvPolishingPrompt(data.hasEnvPolishingPrompt || false);
                setEnvPolishingThinkingEffort(
                    typeof data.envPolishingThinkingEffort === 'string' ? data.envPolishingThinkingEffort : ''
                );
                setEnvPolishingThinkingEffortFormat(
                    typeof data.envPolishingThinkingEffortFormat === 'string'
                        ? data.envPolishingThinkingEffortFormat
                        : ''
                );
                setHasEnvStorageMode(!!data.envStorageMode);
                setClientDirectLinkPriority(data.clientDirectLinkPriority || false);
                setServerHasAppPassword(data.hasAppPassword || false);
            })
            .catch((error: unknown) => {
                console.warn('Failed to load server configuration:', error);
                setClientDirectLinkPriority(false);
            });
    }, [open]);

    React.useEffect(() => {
        if (!open || !isDesktopRuntime) return;
        let active = true;

        invokeDesktopCommand<string>('get_default_image_storage_dir')
            .then((path) => {
                if (active) setDefaultImageStoragePath(path);
            })
            .catch((error: unknown) => {
                console.warn('Failed to load default desktop image storage directory:', error);
            });

        return () => {
            active = false;
        };
    }, [isDesktopRuntime, open]);

    const removeCustomModel = React.useCallback((id: string) => {
        setCustomImageModels((current) => current.filter((model) => model.id !== id));
    }, []);

    const updateCustomModelCapability = React.useCallback(
        (id: string, capability: keyof CustomImageModelCapabilities, enabled: boolean | string) => {
            setCustomImageModels((current) =>
                current.map((model) =>
                    model.id === id
                        ? {
                              ...model,
                              capabilities: { ...(model.capabilities ?? {}), [capability]: !!enabled }
                          }
                        : model
                )
            );
        },
        []
    );

    const updateCustomModelDefaultSize = React.useCallback((id: string, defaultSize: string) => {
        setCustomImageModels((current) =>
            current.map((model) =>
                model.id === id
                    ? {
                          ...model,
                          defaultSize: defaultSize.trim() || undefined
                      }
                    : model
            )
        );
    }, []);

    const updateCustomModelSizePreset = React.useCallback(
        (id: string, preset: 'square' | 'landscape' | 'portrait', value: string) => {
            setCustomImageModels((current) =>
                current.map((model) => {
                    if (model.id !== id) return model;
                    const nextPresets = { ...(model.sizePresets ?? {}) };
                    const trimmed = value.trim();
                    if (trimmed) {
                        nextPresets[preset] = trimmed;
                    } else {
                        delete nextPresets[preset];
                    }
                    return {
                        ...model,
                        sizePresets: Object.keys(nextPresets).length > 0 ? nextPresets : undefined
                    };
                })
            );
        },
        []
    );

    const rebuildProviderEndpoints = React.useCallback(
        (
            nextProviderInstances: readonly ProviderInstance[],
            nextVisionTextProviderInstances: readonly VisionTextProviderInstance[] = visionTextProviderInstances
        ) => {
            const preservedEndpoints = providerEndpoints.filter(
                (endpoint) => !endpoint.legacyImageProvider && !endpoint.legacyVisionTextKind
            );
            const freshConfig = normalizeUnifiedProviderModelConfig(undefined, {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl,
                providerInstances: nextProviderInstances,
                customImageModels,
                visionTextProviderInstances: nextVisionTextProviderInstances,
                selectedProviderInstanceId,
                selectedVisionTextProviderInstanceId,
                visionTextModelId,
                visionTextApiCompatibility,
                visionTextDetail,
                visionTextMaxOutputTokens,
                polishingThinkingEnabled,
                polishingThinkingEffort,
                polishingThinkingEffortFormat
            });
            setProviderEndpoints(
                normalizeUnifiedProviderModelConfig(
                    {
                        providerEndpoints: [...preservedEndpoints, ...freshConfig.providerEndpoints],
                        modelCatalog,
                        modelTaskDefaultCatalogEntryIds
                    },
                    {
                        openaiApiKey: apiKey,
                        openaiApiBaseUrl: apiBaseUrl,
                        geminiApiKey,
                        geminiApiBaseUrl,
                        sensenovaApiKey,
                        sensenovaApiBaseUrl,
                        seedreamApiKey,
                        seedreamApiBaseUrl,
                        providerInstances: nextProviderInstances,
                        customImageModels,
                        visionTextProviderInstances: nextVisionTextProviderInstances,
                        selectedProviderInstanceId,
                        selectedVisionTextProviderInstanceId,
                        visionTextModelId,
                        visionTextApiCompatibility,
                        visionTextDetail,
                        visionTextMaxOutputTokens,
                        polishingThinkingEnabled,
                        polishingThinkingEffort,
                        polishingThinkingEffortFormat
                    }
                ).providerEndpoints
            );
        },
        [
            apiBaseUrl,
            apiKey,
            customImageModels,
            geminiApiBaseUrl,
            geminiApiKey,
            modelCatalog,
            modelTaskDefaultCatalogEntryIds,
            polishingThinkingEffort,
            polishingThinkingEffortFormat,
            polishingThinkingEnabled,
            providerEndpoints,
            selectedProviderInstanceId,
            selectedVisionTextProviderInstanceId,
            seedreamApiBaseUrl,
            seedreamApiKey,
            sensenovaApiBaseUrl,
            sensenovaApiKey,
            visionTextApiCompatibility,
            visionTextDetail,
            visionTextMaxOutputTokens,
            visionTextModelId,
            visionTextProviderInstances
        ]
    );

    const updateModelCatalogEntryEnabled = React.useCallback((id: string, enabled: boolean | string) => {
        setModelCatalog((current) =>
            current.map((entry) => (entry.id === id ? { ...entry, enabled: !!enabled } : entry))
        );
    }, []);

    const updateModelCatalogEntryTask = React.useCallback(
        (id: string, task: ModelTaskCapability, enabled: boolean | string) => {
            setModelCatalog((current) =>
                current.map((entry) => {
                    if (entry.id !== id) return entry;
                    const tasks = new Set(entry.capabilities.tasks);
                    if (enabled) {
                        tasks.add(task);
                    } else {
                        tasks.delete(task);
                    }
                    return {
                        ...entry,
                        capabilities: {
                            ...entry.capabilities,
                            tasks: Array.from(tasks)
                        },
                        capabilityConfidence: 'high'
                    };
                })
            );
        },
        []
    );

    const restoreModelCatalogEntryAuto = React.useCallback(
        (id: string) => {
            setModelCatalog((current) =>
                current.map((entry) => {
                    if (entry.id !== id) return entry;
                    const endpoint = providerEndpoints.find((item) => item.id === entry.providerEndpointId);
                    const inferred = endpoint
                        ? inferModelCatalogCapabilitiesForEndpoint(entry.rawModelId, endpoint)
                        : inferModelCatalogCapabilities(entry.rawModelId, entry.provider);
                    return {
                        ...entry,
                        source: entry.source === 'remote' ? 'remote' : 'builtin',
                        enabled: true,
                        capabilities: inferred.capabilities,
                        capabilityConfidence: inferred.confidence
                    };
                })
            );
        },
        [providerEndpoints]
    );

    const updateUnifiedProviderEndpoint = React.useCallback((id: string, updates: Partial<ProviderEndpoint>) => {
        setProviderEndpoints((current) =>
            current.map((endpoint) => (endpoint.id === id ? { ...endpoint, ...updates } : endpoint))
        );
    }, []);

    const setEndpointModelIds = React.useCallback(
        (id: string, modelIds: readonly string[]) => {
            const uniqueModelIds = Array.from(new Set(modelIds.map((item) => item.trim()).filter(Boolean)));
            updateUnifiedProviderEndpoint(id, { modelIds: uniqueModelIds });
        },
        [updateUnifiedProviderEndpoint]
    );

    const syncProviderInstanceModelsFromCatalog = React.useCallback((id: string, modelIds: readonly string[]) => {
        const uniqueModelIds = normalizeModelIds(modelIds);
        setProviderInstances((current) =>
            current.map((instance) => (instance.id === id ? { ...instance, models: uniqueModelIds } : instance))
        );
    }, []);

    const bindTaskDefaultsFromCatalogEntry = React.useCallback((entry: ModelCatalogEntry) => {
        if (isPendingVideoPlaceholderEntry(entry)) return;
        setModelTaskDefaultCatalogEntryIds((current) => {
            const next = { ...current };
            if (!next['image.generate'] && entry.capabilities.tasks.includes('image.generate')) {
                next['image.generate'] = entry.id;
            }
            if (!next['image.edit'] && entry.capabilities.tasks.includes('image.edit')) {
                next['image.edit'] = entry.id;
            }
            if (!next['vision.text'] && entry.capabilities.tasks.includes('vision.text')) {
                next['vision.text'] = entry.id;
            }
            if (!next['video.generate'] && entry.capabilities.tasks.includes('video.generate')) {
                next['video.generate'] = entry.id;
            }
            if (!next['video.imageToVideo'] && entry.capabilities.tasks.includes('video.imageToVideo')) {
                next['video.imageToVideo'] = entry.id;
            }
            return next;
        });
    }, []);

    const removeUnifiedProviderEndpoint = React.useCallback(
        (id: string) => {
            setProviderEndpoints((current) => current.filter((endpoint) => endpoint.id !== id));
            setModelCatalog((current) => current.filter((entry) => entry.providerEndpointId !== id));
            setModelTaskDefaultCatalogEntryIds((current) => {
                const next: ModelTaskDefaultCatalogEntryIds = {};
                Object.entries(current).forEach(([task, entryId]) => {
                    const entry = modelCatalog.find((item) => item.id === entryId);
                    if (entry && entry.providerEndpointId === id) return;
                    next[task as ModelTaskCapability] = entryId;
                });
                return next;
            });
            setProviderModelRefreshStatus((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
            setUnifiedProviderApiKeyVisibility((current) => {
                const next = { ...current };
                delete next[id];
                return next;
            });
        },
        [modelCatalog]
    );

    const updateProviderInstance = React.useCallback(
        (id: string, updates: Partial<ProviderInstance>) => {
            setProviderInstances((current) => {
                const next = normalizeProviderInstances(
                    current.map((instance) => (instance.id === id ? { ...instance, ...updates } : instance)),
                    {
                        openaiApiKey: apiKey,
                        openaiApiBaseUrl: apiBaseUrl,
                        geminiApiKey,
                        geminiApiBaseUrl,
                        sensenovaApiKey,
                        sensenovaApiBaseUrl,
                        seedreamApiKey,
                        seedreamApiBaseUrl
                    }
                );
                rebuildProviderEndpoints(next);
                return next;
            });
        },
        [
            apiBaseUrl,
            apiKey,
            geminiApiBaseUrl,
            geminiApiKey,
            rebuildProviderEndpoints,
            seedreamApiBaseUrl,
            seedreamApiKey,
            sensenovaApiBaseUrl,
            sensenovaApiKey
        ]
    );

    const removeProviderInstanceById = React.useCallback(
        (id: string) => {
            const target = providerInstances.find((instance) => instance.id === id);
            if (!target) {
                removeUnifiedProviderEndpoint(id);
                return;
            }
            const instancesForType = providerInstances.filter((instance) => instance.type === target.type);
            if (instancesForType.length <= 1) return;
            const remaining = providerInstances.filter((instance) => instance.id !== id);
            const next = normalizeProviderInstances(remaining, {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl
            });
            setProviderInstances(next);
            const freshConfig = normalizeUnifiedProviderModelConfig(
                {
                    providerEndpoints: providerEndpoints.filter((endpoint) => endpoint.id !== id),
                    modelCatalog: modelCatalog.filter((entry) => entry.providerEndpointId !== id),
                    modelTaskDefaultCatalogEntryIds
                },
                {
                    openaiApiKey: apiKey,
                    openaiApiBaseUrl: apiBaseUrl,
                    geminiApiKey,
                    geminiApiBaseUrl,
                    sensenovaApiKey,
                    sensenovaApiBaseUrl,
                    seedreamApiKey,
                    seedreamApiBaseUrl,
                    providerInstances: next,
                    customImageModels,
                    visionTextProviderInstances
                }
            );
            setProviderEndpoints(freshConfig.providerEndpoints);
            setModelCatalog(freshConfig.modelCatalog);
            setModelTaskDefaultCatalogEntryIds(freshConfig.modelTaskDefaultCatalogEntryIds);
            if (selectedProviderInstanceId === id) {
                setSelectedProviderInstanceId(next.find((instance) => instance.type === target.type)?.id || '');
            }
            setProviderModelRefreshStatus((current) => {
                const nextStatus = { ...current };
                delete nextStatus[id];
                return nextStatus;
            });
            setUnifiedProviderApiKeyVisibility((current) => {
                const nextVisibility = { ...current };
                delete nextVisibility[id];
                return nextVisibility;
            });
            setProviderApiKeyVisibility((current) => {
                const nextVisibility = { ...current };
                delete nextVisibility[id];
                return nextVisibility;
            });
        },
        [
            apiBaseUrl,
            apiKey,
            customImageModels,
            geminiApiBaseUrl,
            geminiApiKey,
            modelCatalog,
            modelTaskDefaultCatalogEntryIds,
            providerEndpoints,
            providerInstances,
            removeUnifiedProviderEndpoint,
            seedreamApiBaseUrl,
            seedreamApiKey,
            selectedProviderInstanceId,
            sensenovaApiBaseUrl,
            sensenovaApiKey,
            visionTextProviderInstances
        ]
    );

    const addUnifiedProviderEndpoint = React.useCallback(() => {
        const template =
            getProviderEndpointTemplateByKey(newUnifiedProviderTemplateKey) ?? TEXT_PROVIDER_ENDPOINT_TEMPLATES[0];
        const normalizedBaseUrl = newUnifiedProviderApiBaseUrl.trim() || template.baseUrlPlaceholder;
        const name =
            newUnifiedProviderName.trim() ||
            getProviderInstanceHostname(normalizedBaseUrl) ||
            template.placeholder ||
            template.title;
        if (template.legacyImageProvider) {
            const id = createProviderInstanceId(
                template.legacyImageProvider,
                normalizedBaseUrl || name,
                providerInstances.map((instance) => instance.id)
            );
            setProviderInstances((current) => {
                const next = normalizeProviderInstances(
                    [
                        ...current,
                        {
                            id,
                            type: template.legacyImageProvider as ImageProviderId,
                            name,
                            apiKey: newUnifiedProviderApiKey.trim(),
                            apiBaseUrl: normalizedBaseUrl,
                            models: []
                        }
                    ],
                    {
                        openaiApiKey: apiKey,
                        openaiApiBaseUrl: apiBaseUrl,
                        geminiApiKey,
                        geminiApiBaseUrl,
                        sensenovaApiKey,
                        sensenovaApiBaseUrl,
                        seedreamApiKey,
                        seedreamApiBaseUrl
                    }
                );
                rebuildProviderEndpoints(next);
                return next;
            });
            setSelectedProviderInstanceId(id);
            setNewUnifiedProviderName('');
            setNewUnifiedProviderApiKey('');
            setNewUnifiedProviderApiBaseUrl('');
            setNewUnifiedProviderApiKeyVisible(false);
            setProviderModelRefreshStatus((current) => ({
                ...current,
                [id]: {
                    loading: false,
                    message: t('settings.endpoints.addedStatus'),
                    tone: 'info'
                }
            }));
            return;
        }
        const id = createProviderEndpointId(
            template.kind,
            normalizedBaseUrl || name,
            providerEndpoints.map((endpoint) => endpoint.id)
        );
        const nextEndpoint: ProviderEndpoint = {
            id,
            provider: template.kind,
            name,
            apiKey: newUnifiedProviderApiKey.trim(),
            apiBaseUrl: normalizedBaseUrl,
            protocol: template.protocol,
            enabled: true,
            modelIds: [],
            modelDiscovery: { enabled: supportsProviderModelDiscovery(template.protocol) }
        };
        const nextConfig = normalizeUnifiedProviderModelConfig(
            {
                providerEndpoints: [...providerEndpoints, nextEndpoint],
                modelCatalog,
                modelTaskDefaultCatalogEntryIds
            },
            {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl,
                providerInstances: normalizeProviderInstances(providerInstances, {
                    openaiApiKey: apiKey,
                    openaiApiBaseUrl: apiBaseUrl,
                    geminiApiKey,
                    geminiApiBaseUrl,
                    sensenovaApiKey,
                    sensenovaApiBaseUrl,
                    seedreamApiKey,
                    seedreamApiBaseUrl
                }),
                customImageModels,
                visionTextProviderInstances: normalizeVisionTextProviderInstances(visionTextProviderInstances),
                selectedProviderInstanceId,
                selectedVisionTextProviderInstanceId,
                visionTextModelId,
                visionTextApiCompatibility,
                visionTextDetail,
                visionTextMaxOutputTokens,
                polishingThinkingEnabled,
                polishingThinkingEffort,
                polishingThinkingEffortFormat
            }
        );
        setProviderEndpoints(nextConfig.providerEndpoints);
        setNewUnifiedProviderName('');
        setNewUnifiedProviderApiKey('');
        setNewUnifiedProviderApiBaseUrl('');
        setNewUnifiedProviderApiKeyVisible(false);
        setProviderModelRefreshStatus((current) => ({
            ...current,
            [id]: {
                loading: false,
                message: t('settings.endpoints.addedStatus'),
                tone: 'info'
            }
        }));
    }, [
        apiBaseUrl,
        apiKey,
        customImageModels,
        geminiApiBaseUrl,
        geminiApiKey,
        modelCatalog,
        modelTaskDefaultCatalogEntryIds,
        newUnifiedProviderApiBaseUrl,
        newUnifiedProviderApiKey,
        newUnifiedProviderName,
        newUnifiedProviderTemplateKey,
        polishingThinkingEffort,
        polishingThinkingEffortFormat,
        polishingThinkingEnabled,
        providerEndpoints,
        providerInstances,
        rebuildProviderEndpoints,
        selectedProviderInstanceId,
        selectedVisionTextProviderInstanceId,
        seedreamApiBaseUrl,
        seedreamApiKey,
        sensenovaApiBaseUrl,
        sensenovaApiKey,
        t,
        visionTextApiCompatibility,
        visionTextDetail,
        visionTextMaxOutputTokens,
        visionTextModelId,
        visionTextProviderInstances
    ]);

    const setProviderInstanceDefault = React.useCallback(
        (id: string) => {
            setProviderInstances((current) => {
                const target = current.find((instance) => instance.id === id);
                if (!target) return current;
                const next = normalizeProviderInstances(
                    current.map((instance) =>
                        instance.type === target.type ? { ...instance, isDefault: instance.id === id } : instance
                    )
                );
                rebuildProviderEndpoints(next);
                return next;
            });
            setSelectedProviderInstanceId(id);
        },
        [rebuildProviderEndpoints]
    );

    const refreshUnifiedProviderEndpointModels = React.useCallback(
        async (endpoint: ProviderEndpoint) => {
            const normalizedProviderInstances = normalizeProviderInstances(providerInstances, {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl
            });
            const normalizedVisionTextProviderInstances =
                normalizeVisionTextProviderInstances(visionTextProviderInstances);
            const normalizedUnifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(
                { providerEndpoints, modelCatalog, modelTaskDefaultCatalogEntryIds },
                {
                    openaiApiKey: apiKey,
                    openaiApiBaseUrl: apiBaseUrl,
                    geminiApiKey,
                    geminiApiBaseUrl,
                    sensenovaApiKey,
                    sensenovaApiBaseUrl,
                    seedreamApiKey,
                    seedreamApiBaseUrl,
                    providerInstances: normalizedProviderInstances,
                    customImageModels,
                    visionTextProviderInstances: normalizedVisionTextProviderInstances,
                    selectedProviderInstanceId,
                    selectedVisionTextProviderInstanceId,
                    visionTextModelId,
                    visionTextApiCompatibility,
                    visionTextDetail,
                    visionTextMaxOutputTokens,
                    polishingThinkingEnabled,
                    polishingThinkingEffort,
                    polishingThinkingEffortFormat
                }
            );
            const targetEndpoint = normalizedUnifiedProviderModelConfig.providerEndpoints.find(
                (item) => item.id === endpoint.id
            );
            if (!targetEndpoint) return;
            const loadingMessage = t('settings.modelManager.refreshLoading');
            setProviderModelRefreshStatus((current) => ({
                ...current,
                [endpoint.id]: { loading: true, message: loadingMessage, tone: 'info' }
            }));
            setModelManagerDialog((current) =>
                current?.endpointId === endpoint.id
                    ? { ...current, loading: true, statusMessage: loadingMessage, statusTone: 'info' }
                    : current
            );
            try {
                const runtimeConfig = {
                    ...loadConfig(),
                    openaiApiKey: apiKey,
                    openaiApiBaseUrl: apiBaseUrl,
                    geminiApiKey,
                    geminiApiBaseUrl,
                    sensenovaApiKey,
                    sensenovaApiBaseUrl,
                    seedreamApiKey,
                    seedreamApiBaseUrl,
                    providerInstances: normalizedProviderInstances,
                    customImageModels,
                    visionTextProviderInstances: normalizedVisionTextProviderInstances,
                    selectedProviderInstanceId,
                    selectedVisionTextProviderInstanceId,
                    visionTextModelId,
                    visionTextTaskType,
                    visionTextDetail,
                    visionTextResponseFormat,
                    visionTextStreamingEnabled,
                    visionTextStructuredOutputEnabled,
                    visionTextMaxOutputTokens,
                    visionTextSystemPrompt,
                    visionTextApiCompatibility,
                    polishingPrompt,
                    polishingPresetId,
                    polishingThinkingEnabled,
                    polishingThinkingEffort,
                    polishingThinkingEffortFormat,
                    polishingCustomPrompts,
                    polishPickerOrder,
                    imageStorageMode: storageMode,
                    imageStoragePath,
                    connectionMode,
                    maxConcurrentTasks,
                    promptHistoryLimit,
                    desktopProxyMode,
                    desktopProxyUrl,
                    desktopPromoServiceMode,
                    desktopPromoServiceUrl,
                    desktopDebugMode
                } as AppConfig;
                const result = await discoverProviderModels(
                    buildDiscoverProviderModelsRequest(targetEndpoint, runtimeConfig)
                );
                const nextCatalog = upsertDiscoveredModelCatalogEntries(
                    normalizedUnifiedProviderModelConfig.modelCatalog,
                    targetEndpoint,
                    result.models,
                    result.refreshedAt
                );
                setModelCatalog(nextCatalog);
                setProviderEndpoints(
                    (current) =>
                        normalizeUnifiedProviderModelConfig(
                            {
                                providerEndpoints: current.map((item) =>
                                    item.id === targetEndpoint.id
                                        ? {
                                              ...item,
                                              modelDiscovery: {
                                                  enabled: true,
                                                  lastRefreshedAt: result.refreshedAt
                                              }
                                          }
                                        : item
                                ),
                                modelCatalog: nextCatalog,
                                modelTaskDefaultCatalogEntryIds
                            },
                            {
                                providerInstances: normalizedProviderInstances,
                                customImageModels,
                                visionTextProviderInstances: normalizedVisionTextProviderInstances
                            }
                        ).providerEndpoints
                );
                setProviderModelRefreshStatus((current) => ({
                    ...current,
                    [endpoint.id]: {
                        loading: false,
                        message: t('settings.modelManager.refreshSuccess', { count: result.models.length }),
                        tone: 'success'
                    }
                }));
                setModelManagerDialog((current) =>
                    current?.endpointId === endpoint.id
                        ? (() => {
                              const refreshedModelIds = new Set(result.models.map((model) => model.id));
                              const selectedModelIds = new Set(current.selectedModelIds);
                              const refreshedEntries = nextCatalog.filter(
                                  (entry) =>
                                      entry.providerEndpointId === endpoint.id &&
                                      (current.optionMode === 'binding'
                                          ? refreshedModelIds.has(entry.rawModelId)
                                          : true)
                              );
                              const refreshedOptions = refreshedEntries.map((entry) =>
                                  current.optionMode === 'binding' && current.bindingTask
                                      ? getCatalogEntryBindingOption(
                                            entry,
                                            endpoint,
                                            selectedModelIds,
                                            current.bindingTask,
                                            t
                                        )
                                      : getCatalogEntryManagedOption(
                                            entry,
                                            endpoint,
                                            new Set(endpoint.modelIds ?? []),
                                            t
                                        )
                              );
                              return {
                                  ...current,
                                  options: mergeManagedModelOptions(
                                      current.optionMode === 'binding'
                                          ? refreshedOptions
                                          : [...current.options, ...refreshedOptions]
                                  ),
                                  loading: false,
                                  statusMessage: t('settings.modelManager.refreshSuccess', {
                                      count: result.models.length
                                  }),
                                  statusTone: 'success'
                              };
                          })()
                        : current
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : t('settings.modelManager.refreshError');
                setProviderEndpoints((current) =>
                    current.map((item) =>
                        item.id === targetEndpoint.id
                            ? {
                                  ...item,
                                  modelDiscovery: {
                                      ...(item.modelDiscovery ?? { enabled: true }),
                                      lastError: message
                                  }
                              }
                            : item
                    )
                );
                setProviderModelRefreshStatus((current) => ({
                    ...current,
                    [endpoint.id]: { loading: false, message, tone: 'error' }
                }));
                setModelManagerDialog((current) =>
                    current?.endpointId === endpoint.id
                        ? { ...current, loading: false, statusMessage: message, statusTone: 'error' }
                        : current
                );
            }
        },
        [
            apiBaseUrl,
            apiKey,
            connectionMode,
            customImageModels,
            desktopDebugMode,
            desktopPromoServiceMode,
            desktopPromoServiceUrl,
            desktopProxyMode,
            desktopProxyUrl,
            geminiApiBaseUrl,
            geminiApiKey,
            imageStoragePath,
            maxConcurrentTasks,
            modelCatalog,
            modelTaskDefaultCatalogEntryIds,
            polishPickerOrder,
            polishingCustomPrompts,
            polishingPresetId,
            polishingPrompt,
            polishingThinkingEffort,
            polishingThinkingEffortFormat,
            polishingThinkingEnabled,
            promptHistoryLimit,
            providerEndpoints,
            providerInstances,
            seedreamApiBaseUrl,
            seedreamApiKey,
            selectedProviderInstanceId,
            selectedVisionTextProviderInstanceId,
            sensenovaApiBaseUrl,
            sensenovaApiKey,
            storageMode,
            t,
            visionTextApiCompatibility,
            visionTextDetail,
            visionTextMaxOutputTokens,
            visionTextModelId,
            visionTextProviderInstances,
            visionTextResponseFormat,
            visionTextStreamingEnabled,
            visionTextStructuredOutputEnabled,
            visionTextSystemPrompt,
            visionTextTaskType
        ]
    );

    const refreshProviderInstanceModels = React.useCallback(
        async (instance: ProviderInstance) => {
            const normalizedProviderInstances = normalizeProviderInstances(providerInstances, {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl
            });
            const normalizedUnifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(
                { providerEndpoints, modelCatalog, modelTaskDefaultCatalogEntryIds },
                {
                    openaiApiKey: apiKey,
                    openaiApiBaseUrl: apiBaseUrl,
                    geminiApiKey,
                    geminiApiBaseUrl,
                    sensenovaApiKey,
                    sensenovaApiBaseUrl,
                    seedreamApiKey,
                    seedreamApiBaseUrl,
                    providerInstances: normalizedProviderInstances,
                    customImageModels,
                    visionTextProviderInstances,
                    selectedVisionTextProviderInstanceId,
                    visionTextModelId,
                    visionTextApiCompatibility,
                    visionTextDetail,
                    visionTextMaxOutputTokens,
                    polishingThinkingEnabled,
                    polishingThinkingEffort,
                    polishingThinkingEffortFormat
                }
            );
            const endpoint = normalizedUnifiedProviderModelConfig.providerEndpoints.find(
                (item) => item.id === instance.id
            );
            if (!endpoint) return;
            const loadingMessage = t('settings.modelManager.refreshLoading');
            setProviderModelRefreshStatus((current) => ({
                ...current,
                [instance.id]: { loading: true, message: loadingMessage, tone: 'info' }
            }));
            setModelManagerDialog((current) =>
                current?.endpointId === instance.id
                    ? { ...current, loading: true, statusMessage: loadingMessage, statusTone: 'info' }
                    : current
            );

            try {
                const runtimeConfig = {
                    ...loadConfig(),
                    openaiApiKey: apiKey,
                    openaiApiBaseUrl: apiBaseUrl,
                    geminiApiKey,
                    geminiApiBaseUrl,
                    sensenovaApiKey,
                    sensenovaApiBaseUrl,
                    seedreamApiKey,
                    seedreamApiBaseUrl,
                    providerInstances: normalizedProviderInstances,
                    customImageModels,
                    visionTextProviderInstances,
                    selectedProviderInstanceId,
                    selectedVisionTextProviderInstanceId,
                    visionTextModelId,
                    visionTextTaskType,
                    visionTextDetail,
                    visionTextResponseFormat,
                    visionTextStreamingEnabled,
                    visionTextStructuredOutputEnabled,
                    visionTextMaxOutputTokens,
                    visionTextSystemPrompt,
                    visionTextApiCompatibility,
                    polishingPrompt,
                    polishingPresetId,
                    polishingThinkingEnabled,
                    polishingThinkingEffort,
                    polishingThinkingEffortFormat,
                    polishingCustomPrompts,
                    polishPickerOrder,
                    imageStorageMode: storageMode,
                    imageStoragePath,
                    connectionMode,
                    maxConcurrentTasks,
                    promptHistoryLimit,
                    desktopProxyMode,
                    desktopProxyUrl,
                    desktopPromoServiceMode,
                    desktopPromoServiceUrl,
                    desktopDebugMode
                } as AppConfig;
                const result = await discoverProviderModels(
                    buildDiscoverProviderModelsRequest(endpoint, runtimeConfig)
                );
                const nextCatalog = upsertDiscoveredModelCatalogEntries(
                    normalizedUnifiedProviderModelConfig.modelCatalog,
                    endpoint,
                    result.models,
                    result.refreshedAt
                );
                setModelCatalog(nextCatalog);
                setProviderEndpoints(
                    (current) =>
                        normalizeUnifiedProviderModelConfig(
                            {
                                providerEndpoints: current.map((item) =>
                                    item.id === endpoint.id
                                        ? {
                                              ...item,
                                              modelDiscovery: {
                                                  enabled: true,
                                                  lastRefreshedAt: result.refreshedAt
                                              }
                                          }
                                        : item
                                ),
                                modelCatalog: nextCatalog,
                                modelTaskDefaultCatalogEntryIds
                            },
                            {
                                providerInstances: normalizedProviderInstances,
                                customImageModels,
                                visionTextProviderInstances
                            }
                        ).providerEndpoints
                );
                setProviderModelRefreshStatus((current) => ({
                    ...current,
                    [instance.id]: {
                        loading: false,
                        message: t('settings.modelManager.refreshSuccess', { count: result.models.length }),
                        tone: 'success'
                    }
                }));
                setModelManagerDialog((current) =>
                    current?.endpointId === instance.id
                        ? {
                              ...current,
                              options: mergeManagedModelOptions([
                                  ...current.options,
                                  ...nextCatalog
                                      .filter((entry) => entry.providerEndpointId === endpoint.id)
                                      .map((entry) =>
                                          getCatalogEntryManagedOption(entry, endpoint, new Set(instance.models), t)
                                      )
                              ]),
                              loading: false,
                              statusMessage: t('settings.modelManager.refreshSuccess', { count: result.models.length }),
                              statusTone: 'success'
                          }
                        : current
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : t('settings.modelManager.refreshError');
                setProviderEndpoints((current) =>
                    current.map((item) =>
                        item.id === endpoint.id
                            ? {
                                  ...item,
                                  modelDiscovery: {
                                      ...(item.modelDiscovery ?? { enabled: true }),
                                      lastError: message
                                  }
                              }
                            : item
                    )
                );
                setProviderModelRefreshStatus((current) => ({
                    ...current,
                    [instance.id]: { loading: false, message, tone: 'error' }
                }));
                setModelManagerDialog((current) =>
                    current?.endpointId === instance.id
                        ? { ...current, loading: false, statusMessage: message, statusTone: 'error' }
                        : current
                );
            }
        },
        [
            apiBaseUrl,
            apiKey,
            connectionMode,
            customImageModels,
            desktopDebugMode,
            desktopPromoServiceMode,
            desktopPromoServiceUrl,
            desktopProxyMode,
            desktopProxyUrl,
            geminiApiBaseUrl,
            geminiApiKey,
            imageStoragePath,
            maxConcurrentTasks,
            modelCatalog,
            modelTaskDefaultCatalogEntryIds,
            polishPickerOrder,
            polishingCustomPrompts,
            polishingPresetId,
            polishingPrompt,
            polishingThinkingEffort,
            polishingThinkingEffortFormat,
            polishingThinkingEnabled,
            promptHistoryLimit,
            providerEndpoints,
            providerInstances,
            seedreamApiBaseUrl,
            seedreamApiKey,
            selectedProviderInstanceId,
            selectedVisionTextProviderInstanceId,
            sensenovaApiBaseUrl,
            sensenovaApiKey,
            storageMode,
            t,
            visionTextApiCompatibility,
            visionTextDetail,
            visionTextMaxOutputTokens,
            visionTextModelId,
            visionTextProviderInstances,
            visionTextResponseFormat,
            visionTextStreamingEnabled,
            visionTextStructuredOutputEnabled,
            visionTextSystemPrompt,
            visionTextTaskType
        ]
    );

    const openProviderInstanceModelManager = React.useCallback(
        (instance: ProviderInstance) => {
            const allModels = getAllImageModels(customImageModels).filter((model) => {
                if (model.provider !== instance.type) return false;
                if (!model.custom || !model.instanceId) return true;
                return model.instanceId === instance.id;
            });
            const selectedModelIds = new Set(
                instance.models.length > 0 ? instance.models : allModels.map((model) => model.id)
            );
            const catalogOptions = modelCatalog
                .filter((entry) => entry.providerEndpointId === instance.id)
                .map((entry) =>
                    getCatalogEntryManagedOption(
                        entry,
                        providerEndpoints.find((endpoint) => endpoint.id === instance.id),
                        selectedModelIds,
                        t
                    )
                );
            const options = mergeManagedModelOptions([
                ...allModels.map((model) => ({
                    id: model.id,
                    modelId: model.id,
                    label: model.label,
                    detail: model.providerLabel,
                    badges: [
                        model.custom ? t('settings.modelManager.badgeCustom') : t('settings.modelManager.badgePreset'),
                        selectedModelIds.has(model.id) ? t('settings.modelManager.badgeAdded') : ''
                    ].filter(Boolean),
                    metadata: {
                        displayLabel: model.custom ? model.label : undefined
                    }
                })),
                ...catalogOptions
            ]);
            setModelManagerDialog({
                open: true,
                endpointId: instance.id,
                title: t('settings.modelManager.imageTitle', { name: instance.name }),
                description: t('settings.modelManager.imageDescription'),
                options,
                selectedModelIds: Array.from(selectedModelIds),
                allowManualModels: true,
                emptyMessage: t('settings.modelManager.emptyBeforeFetch'),
                onRefresh: supportsProviderModelDiscovery(
                    providerEndpoints.find((endpoint) => endpoint.id === instance.id)?.protocol
                )
                    ? () => refreshProviderInstanceModels(instance)
                    : undefined,
                onConfirm: (modelIds, optionsSnapshot) => {
                    const nextModelIds = normalizeModelIds(modelIds);
                    const selectedOptionsById = new Map(optionsSnapshot.map((option) => [option.modelId, option]));
                    const endpoint = providerEndpoints.find((item) => item.id === instance.id);
                    const customEntries = endpoint
                        ? nextModelIds
                              .filter((modelId) => !IMAGE_MODEL_IDS.includes(modelId))
                              .map((modelId) =>
                                  createCustomModelCatalogEntry(endpoint, modelId, {
                                      displayLabel: selectedOptionsById.get(modelId)?.metadata?.displayLabel
                                  })
                              )
                              .filter((entry): entry is ModelCatalogEntry => Boolean(entry))
                        : [];
                    setCustomImageModels((current) => {
                        const existing = new Set([...IMAGE_MODEL_IDS, ...current.map((model) => model.id)]);
                        const additions = nextModelIds
                            .filter((modelId) => !existing.has(modelId))
                            .map((id) => {
                                const option = selectedOptionsById.get(id);
                                return {
                                    id,
                                    provider: instance.type,
                                    instanceId: instance.id,
                                    ...(option?.metadata?.displayLabel ? { label: option.metadata.displayLabel } : {})
                                };
                            });
                        return additions.length > 0 ? normalizeCustomImageModels([...current, ...additions]) : current;
                    });
                    if (customEntries.length > 0) {
                        setModelCatalog((current) => {
                            const replacedIds = new Set(customEntries.map((entry) => entry.id));
                            return [...current.filter((entry) => !replacedIds.has(entry.id)), ...customEntries];
                        });
                    }
                    updateProviderInstance(instance.id, { models: nextModelIds });
                }
            });
            void refreshProviderInstanceModels(instance);
        },
        [customImageModels, modelCatalog, providerEndpoints, refreshProviderInstanceModels, t, updateProviderInstance]
    );

    const openProviderEndpointModelManager = React.useCallback(
        (endpoint: ProviderEndpoint, dialogOptions: { autoRefresh?: boolean } = {}) => {
            const selectedModelIds = new Set(endpoint.modelIds ?? []);
            const endpointCatalogEntries = modelCatalog.filter((entry) => entry.providerEndpointId === endpoint.id);
            const managedOptions = mergeManagedModelOptions(
                endpointCatalogEntries.map((entry) =>
                    getCatalogEntryManagedOption(entry, endpoint, selectedModelIds, t)
                )
            );
            const canDiscover =
                supportsProviderEndpointModelDiscovery(endpoint) || supportsProviderModelDiscovery(endpoint.protocol);
            setModelManagerDialog({
                open: true,
                endpointId: endpoint.id,
                title: t('settings.modelManager.endpointTitle', { name: endpoint.name }),
                description: canDiscover
                    ? t('settings.modelManager.endpointDescription')
                    : t('settings.modelManager.unsupportedDiscovery'),
                options: managedOptions,
                selectedModelIds: endpoint.modelIds ?? [],
                allowManualModels: true,
                emptyMessage: canDiscover
                    ? t('settings.modelManager.emptyBeforeFetch')
                    : t('settings.modelManager.unsupportedDiscovery'),
                onRefresh: canDiscover ? () => refreshUnifiedProviderEndpointModels(endpoint) : undefined,
                onConfirm: (modelIds, optionsSnapshot) => {
                    const nextModelIds = normalizeModelIds(modelIds);
                    const existingEntriesByModelId = new Map(
                        modelCatalog
                            .filter((entry) => entry.providerEndpointId === endpoint.id)
                            .map((entry) => [entry.rawModelId, entry])
                    );
                    const selectedOptionsById = new Map(optionsSnapshot.map((option) => [option.modelId, option]));
                    const customEntries = nextModelIds
                        .filter((modelId) => !existingEntriesByModelId.has(modelId))
                        .map((modelId) =>
                            createCustomModelCatalogEntry(endpoint, modelId, {
                                displayLabel: selectedOptionsById.get(modelId)?.metadata?.displayLabel,
                                upstreamVendor: selectedOptionsById.get(modelId)?.metadata?.upstreamVendor
                            })
                        )
                        .filter((entry): entry is ModelCatalogEntry => Boolean(entry));
                    if (customEntries.length > 0) {
                        setModelCatalog((current) => {
                            const replacedIds = new Set(customEntries.map((entry) => entry.id));
                            return [...current.filter((entry) => !replacedIds.has(entry.id)), ...customEntries];
                        });
                    }
                    setEndpointModelIds(endpoint.id, nextModelIds);
                    if (endpoint.legacyImageProvider) {
                        syncProviderInstanceModelsFromCatalog(endpoint.id, nextModelIds);
                    }
                    nextModelIds.forEach((modelId) => {
                        const entry =
                            existingEntriesByModelId.get(modelId) ||
                            customEntries.find((item) => item.rawModelId === modelId);
                        if (entry) bindTaskDefaultsFromCatalogEntry(entry);
                    });
                }
            });
            if (canDiscover && dialogOptions.autoRefresh !== false) {
                void refreshUnifiedProviderEndpointModels(endpoint);
            }
        },
        [
            bindTaskDefaultsFromCatalogEntry,
            modelCatalog,
            refreshUnifiedProviderEndpointModels,
            setEndpointModelIds,
            syncProviderInstanceModelsFromCatalog,
            t
        ]
    );

    const renderProviderEndpointCard = React.useCallback(
        (
            endpoint: ProviderEndpoint,
            options: {
                removeDisabled?: boolean;
                selectedModelCount?: number;
                totalModelCount?: number;
                summaryDescription?: string;
                badges?: React.ReactNode;
                extraActions?: React.ReactNode;
            } = {}
        ) => {
            const endpointEntries = modelCatalog.filter((entry) => entry.providerEndpointId === endpoint.id);
            const status = providerModelRefreshStatus[endpoint.id];
            const selectedModelCount = options.selectedModelCount ?? endpoint.modelIds?.length ?? 0;
            const totalModelCount = options.totalModelCount ?? endpointEntries.length;
            return (
                <ProviderEndpointCard
                    key={endpoint.id}
                    endpoint={endpoint}
                    apiKeyVisible={
                        unifiedProviderApiKeyVisibility[endpoint.id] === true ||
                        providerApiKeyVisibility[endpoint.id] === true
                    }
                    onApiKeyVisibleChange={() => {
                        setUnifiedProviderApiKeyVisibility((current) => ({
                            ...current,
                            [endpoint.id]: !current[endpoint.id]
                        }));
                        setProviderApiKeyVisibility((current) => ({
                            ...current,
                            [endpoint.id]: !current[endpoint.id]
                        }));
                    }}
                    onNameChange={(value) => {
                        if (endpoint.legacyImageProvider) {
                            updateProviderInstance(endpoint.id, { name: value });
                        } else {
                            updateUnifiedProviderEndpoint(endpoint.id, { name: value });
                        }
                    }}
                    onApiKeyChange={(value) => {
                        if (endpoint.legacyImageProvider) {
                            updateProviderInstance(endpoint.id, { apiKey: value });
                        } else {
                            updateUnifiedProviderEndpoint(endpoint.id, { apiKey: value });
                        }
                    }}
                    onBaseUrlChange={(value) => {
                        if (endpoint.legacyImageProvider) {
                            updateProviderInstance(endpoint.id, { apiBaseUrl: value });
                        } else {
                            updateUnifiedProviderEndpoint(endpoint.id, { apiBaseUrl: value });
                        }
                    }}
                    onManageModels={() =>
                        endpoint.legacyImageProvider &&
                        providerInstances.some((instance) => instance.id === endpoint.id)
                            ? openProviderInstanceModelManager(
                                  providerInstances.find((instance) => instance.id === endpoint.id) as ProviderInstance
                              )
                            : openProviderEndpointModelManager(endpoint)
                    }
                    onRemove={() =>
                        endpoint.legacyImageProvider
                            ? removeProviderInstanceById(endpoint.id)
                            : removeUnifiedProviderEndpoint(endpoint.id)
                    }
                    removeDisabled={options.removeDisabled}
                    loading={status?.loading}
                    statusMessage={status?.message}
                    statusTone={status?.tone}
                    selectedModelCount={selectedModelCount}
                    totalModelCount={totalModelCount}
                    summaryDescription={
                        options.summaryDescription || t('settings.modelManager.endpointSummaryDescription')
                    }
                    badges={options.badges}
                    extraActions={options.extraActions}
                    t={t}
                />
            );
        },
        [
            modelCatalog,
            openProviderInstanceModelManager,
            openProviderEndpointModelManager,
            providerApiKeyVisibility,
            providerInstances,
            providerModelRefreshStatus,
            removeProviderInstanceById,
            removeUnifiedProviderEndpoint,
            t,
            unifiedProviderApiKeyVisibility,
            updateProviderInstance,
            updateUnifiedProviderEndpoint
        ]
    );

    const directLinkRestriction = React.useMemo(
        () =>
            getClientDirectLinkRestriction({
                enabled: clientDirectLinkPriority,
                openaiApiBaseUrl: apiBaseUrl,
                envOpenaiApiBaseUrl: envApiBaseUrl,
                geminiApiBaseUrl,
                envGeminiApiBaseUrl,
                sensenovaApiBaseUrl,
                envSensenovaApiBaseUrl,
                seedreamApiBaseUrl,
                providerInstances,
                envSeedreamApiBaseUrl
            }),
        [
            apiBaseUrl,
            clientDirectLinkPriority,
            envApiBaseUrl,
            envGeminiApiBaseUrl,
            envSeedreamApiBaseUrl,
            envSensenovaApiBaseUrl,
            geminiApiBaseUrl,
            providerInstances,
            seedreamApiBaseUrl,
            sensenovaApiBaseUrl
        ]
    );
    const directLinkRestrictionMessage = directLinkRestriction
        ? formatClientDirectLinkRestriction(directLinkRestriction)
        : '';
    const effectiveConnectionMode = directLinkRestriction ? 'direct' : connectionMode;
    const hasUnsavedChanges = React.useMemo(() => {
        const normalizedCustomModels = normalizeCustomImageModels(customImageModels);
        const normalizedVisionTextProviderInstances = normalizeVisionTextProviderInstances(visionTextProviderInstances);
        const normalizedCustomPolishPrompts = normalizeStoredCustomPolishPrompts(
            polishingCustomPrompts,
            polishingPrompt
        );
        const normalizedBatchFeature = normalizeBatchFeatureConfig(batchFeature);
        const normalizedPolishPickerOrder = normalizePolishPickerOrder(
            polishPickerOrder,
            new Set(normalizedCustomPolishPrompts.map((prompt) => prompt.id))
        );
        const normalizedProviderInstances = normalizeProviderInstances(providerInstances, {
            openaiApiKey: apiKey,
            openaiApiBaseUrl: apiBaseUrl,
            geminiApiKey,
            geminiApiBaseUrl,
            sensenovaApiKey,
            sensenovaApiBaseUrl,
            seedreamApiKey,
            seedreamApiBaseUrl
        });
        const normalizedUnifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(
            { providerEndpoints, modelCatalog, modelTaskDefaultCatalogEntryIds },
            {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl,
                providerInstances: normalizedProviderInstances,
                customImageModels: normalizedCustomModels,
                visionTextProviderInstances: normalizedVisionTextProviderInstances,
                selectedVisionTextProviderInstanceId,
                visionTextModelId,
                visionTextApiCompatibility,
                visionTextDetail,
                visionTextMaxOutputTokens,
                polishingThinkingEnabled,
                polishingThinkingEffort,
                polishingThinkingEffortFormat
            }
        );
        const comparableConnectionMode = directLinkRestriction ? 'direct' : initialConfig.connectionMode;
        return (
            appLanguage !== initialConfig.appLanguage ||
            apiKey !== initialConfig.apiKey ||
            apiBaseUrl !== initialConfig.apiBaseUrl ||
            geminiApiKey !== initialConfig.geminiApiKey ||
            geminiApiBaseUrl !== initialConfig.geminiApiBaseUrl ||
            sensenovaApiKey !== initialConfig.sensenovaApiKey ||
            sensenovaApiBaseUrl !== initialConfig.sensenovaApiBaseUrl ||
            seedreamApiKey !== initialConfig.seedreamApiKey ||
            seedreamApiBaseUrl !== initialConfig.seedreamApiBaseUrl ||
            selectedProviderInstanceId !== initialConfig.selectedProviderInstanceId ||
            JSON.stringify(normalizedProviderInstances) !== JSON.stringify(initialConfig.providerInstances) ||
            JSON.stringify(normalizedUnifiedProviderModelConfig.providerEndpoints) !==
                JSON.stringify(initialConfig.providerEndpoints) ||
            JSON.stringify(normalizedUnifiedProviderModelConfig.modelCatalog) !==
                JSON.stringify(initialConfig.modelCatalog) ||
            JSON.stringify(normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds) !==
                JSON.stringify(initialConfig.modelTaskDefaultCatalogEntryIds) ||
            JSON.stringify(normalizedVisionTextProviderInstances) !==
                JSON.stringify(initialConfig.visionTextProviderInstances) ||
            selectedVisionTextProviderInstanceId !== initialConfig.selectedVisionTextProviderInstanceId ||
            visionTextModelId !== initialConfig.visionTextModelId ||
            visionTextTaskType !== initialConfig.visionTextTaskType ||
            visionTextDetail !== initialConfig.visionTextDetail ||
            visionTextResponseFormat !== initialConfig.visionTextResponseFormat ||
            visionTextStreamingEnabled !== initialConfig.visionTextStreamingEnabled ||
            visionTextStructuredOutputEnabled !== initialConfig.visionTextStructuredOutputEnabled ||
            visionTextMaxOutputTokens !== initialConfig.visionTextMaxOutputTokens ||
            visionTextSystemPrompt !== initialConfig.visionTextSystemPrompt ||
            visionTextApiCompatibility !== initialConfig.visionTextApiCompatibility ||
            visionTextHistoryEnabled !== initialConfig.visionTextHistoryEnabled ||
            JSON.stringify(normalizedBatchFeature) !== JSON.stringify(initialConfig.batchFeature) ||
            polishingPrompt !== initialConfig.polishingPrompt ||
            polishingPresetId !== initialConfig.polishingPresetId ||
            polishingThinkingEnabled !== initialConfig.polishingThinkingEnabled ||
            polishingThinkingEffort !== initialConfig.polishingThinkingEffort ||
            polishingThinkingEffortFormat !== initialConfig.polishingThinkingEffortFormat ||
            JSON.stringify(normalizedCustomPolishPrompts) !== JSON.stringify(initialConfig.polishingCustomPrompts) ||
            JSON.stringify(normalizedPolishPickerOrder) !== JSON.stringify(initialConfig.polishPickerOrder) ||
            JSON.stringify(normalizedCustomModels) !== JSON.stringify(initialConfig.customImageModels) ||
            storageMode !== initialConfig.storageMode ||
            imageStoragePath !== initialConfig.imageStoragePath ||
            effectiveConnectionMode !== comparableConnectionMode ||
            maxConcurrentTasks !== initialConfig.maxConcurrentTasks ||
            promptHistoryLimit !== initialConfig.promptHistoryLimit ||
            JSON.stringify(normalizeHiddenPromptToolbarButtons(hiddenPromptToolbarButtons)) !==
                JSON.stringify(initialConfig.hiddenPromptToolbarButtons) ||
            desktopProxyMode !== initialConfig.desktopProxyMode ||
            desktopProxyUrl !== initialConfig.desktopProxyUrl ||
            desktopPromoServiceMode !== initialConfig.desktopPromoServiceMode ||
            desktopPromoServiceUrl !== initialConfig.desktopPromoServiceUrl ||
            desktopDebugMode !== initialConfig.desktopDebugMode ||
            currentSyncConfigSnapshot !== initialSyncConfigSnapshot
        );
    }, [
        apiBaseUrl,
        apiKey,
        appLanguage,
        batchFeature,
        currentSyncConfigSnapshot,
        customImageModels,
        desktopDebugMode,
        desktopPromoServiceMode,
        desktopPromoServiceUrl,
        desktopProxyMode,
        desktopProxyUrl,
        directLinkRestriction,
        effectiveConnectionMode,
        geminiApiBaseUrl,
        geminiApiKey,
        imageStoragePath,
        hiddenPromptToolbarButtons,
        initialConfig,
        initialSyncConfigSnapshot,
        maxConcurrentTasks,
        modelCatalog,
        modelTaskDefaultCatalogEntryIds,
        polishPickerOrder,
        polishingCustomPrompts,
        polishingPresetId,
        polishingPrompt,
        polishingThinkingEffort,
        polishingThinkingEffortFormat,
        polishingThinkingEnabled,
        promptHistoryLimit,
        providerEndpoints,
        providerInstances,
        seedreamApiBaseUrl,
        seedreamApiKey,
        selectedProviderInstanceId,
        selectedVisionTextProviderInstanceId,
        sensenovaApiBaseUrl,
        sensenovaApiKey,
        storageMode,
        visionTextApiCompatibility,
        visionTextDetail,
        visionTextMaxOutputTokens,
        visionTextModelId,
        visionTextProviderInstances,
        visionTextResponseFormat,
        visionTextHistoryEnabled,
        visionTextStreamingEnabled,
        visionTextStructuredOutputEnabled,
        visionTextSystemPrompt,
        visionTextTaskType
    ]);

    const handleDialogOpenChange = React.useCallback(
        (nextOpen: boolean) => {
            if (nextOpen) {
                const pendingOpenTargetView =
                    openTarget && pendingOpenTargetNonceRef.current === openTarget.nonce ? openTarget.view : undefined;
                setSettingsView(pendingOpenTargetView ?? programmaticOpenViewRef.current ?? 'main');
                pendingOpenTargetNonceRef.current = null;
                setOpen(true);
                return;
            }
            pendingOpenTargetNonceRef.current = null;
            programmaticOpenViewRef.current = null;
            if (!saved && hasUnsavedChanges) {
                setDiscardConfirmOpen(true);
                return;
            }
            setOpen(false);
        },
        [hasUnsavedChanges, openTarget, saved]
    );

    const handleConfirmDiscardChanges = React.useCallback(() => {
        setDiscardConfirmOpen(false);
        setOpen(false);
    }, []);

    const handleFetchS3Status = React.useCallback(async () => {
        setS3StatusLoading(true);
        setS3TestResult(null);
        try {
            const status: S3StatusResponse =
                currentSyncConfig.s3.requestMode === 'server'
                    ? {
                          ...(await fetchS3Status({ config: currentSyncConfig })),
                          allowRemoteDeletion: currentSyncConfig.s3.allowRemoteDeletion
                      }
                    : isS3Configured
                      ? {
                            configured: true,
                            endpoint: currentSyncConfig.s3.endpoint,
                            region: currentSyncConfig.s3.region,
                            bucket: currentSyncConfig.s3.bucket,
                            forcePathStyle: currentSyncConfig.s3.forcePathStyle,
                            allowRemoteDeletion: currentSyncConfig.s3.allowRemoteDeletion,
                            rootPrefix: currentSyncConfig.s3.prefix,
                            profileId: currentSyncConfig.s3.profileId
                        }
                      : { configured: false, message: '当前浏览器尚未配置完整的 S3 兼容对象存储信息。' };
            setS3Status(status);
        } catch (err: unknown) {
            setS3Status({ configured: false, message: err instanceof Error ? err.message : 'S3 状态获取失败。' });
        } finally {
            setS3StatusLoading(false);
        }
    }, [currentSyncConfig, isS3Configured]);

    const handleTestS3Connection = React.useCallback(async () => {
        setS3TestLoading(true);
        setS3TestResult(null);
        if (!isS3Configured) {
            setS3TestResult({ ok: false, message: '请先填写 Endpoint、Bucket、Access Key ID 和 Secret Access Key。' });
            setS3TestLoading(false);
            handleFetchS3Status();
            return;
        }
        try {
            const result = await testS3Connection({ config: currentSyncConfig });
            setS3TestResult({
                ok: result.ok,
                message: result.message || (result.ok ? 'S3 连接测试成功。' : result.error || '连接失败')
            });
            if (result.ok) {
                void handleFetchS3Status();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'S3 连接测试失败。';
            setS3TestResult({ ok: false, message });
        } finally {
            setS3TestLoading(false);
        }
    }, [currentSyncConfig, handleFetchS3Status, isS3Configured]);

    React.useEffect(() => {
        if (directLinkRestriction && connectionMode !== 'direct') {
            setConnectionMode('direct');
        }
    }, [connectionMode, directLinkRestriction]);

    React.useEffect(() => {
        if ((clientDirectLinkPriority || isDesktopRuntime) && s3RequestMode === 'server') {
            setS3RequestMode('direct');
        }
    }, [clientDirectLinkPriority, isDesktopRuntime, s3RequestMode]);

    const handleSave = () => {
        const normalizedCustomModels = normalizeCustomImageModels(customImageModels);
        const normalizedCustomPolishPrompts = normalizeStoredCustomPolishPrompts(
            polishingCustomPrompts,
            polishingPrompt
        );
        const normalizedPolishPickerOrder = normalizePolishPickerOrder(
            polishPickerOrder,
            new Set(normalizedCustomPolishPrompts.map((prompt) => prompt.id))
        );
        const normalizedProviderInstances = normalizeProviderInstances(providerInstances, {
            openaiApiKey: apiKey,
            openaiApiBaseUrl: apiBaseUrl,
            geminiApiKey,
            geminiApiBaseUrl,
            sensenovaApiKey,
            sensenovaApiBaseUrl,
            seedreamApiKey,
            seedreamApiBaseUrl
        });
        const normalizedVisionTextProviderInstances = normalizeVisionTextProviderInstances(visionTextProviderInstances);
        const normalizedUnifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(
            { providerEndpoints, modelCatalog, modelTaskDefaultCatalogEntryIds },
            {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl,
                providerInstances: normalizedProviderInstances,
                customImageModels: normalizedCustomModels,
                visionTextProviderInstances: normalizedVisionTextProviderInstances,
                selectedVisionTextProviderInstanceId,
                visionTextModelId,
                visionTextApiCompatibility,
                visionTextDetail,
                visionTextMaxOutputTokens,
                polishingThinkingEnabled,
                polishingThinkingEffort,
                polishingThinkingEffortFormat
            }
        );
        const defaultProviderInstanceByType = (type: ImageProviderId) =>
            normalizedProviderInstances.find((instance) => instance.type === type && instance.isDefault) ||
            normalizedProviderInstances.find((instance) => instance.type === type);
        const defaultOpenAIInstance = defaultProviderInstanceByType('openai');
        const defaultGeminiInstance = defaultProviderInstanceByType('google');
        const defaultSensenovaInstance = defaultProviderInstanceByType('sensenova');
        const defaultSeedreamInstance = defaultProviderInstanceByType('seedream');
        const nextApiKey = defaultOpenAIInstance?.apiKey ?? apiKey;
        const nextApiBaseUrl = defaultOpenAIInstance?.apiBaseUrl ?? apiBaseUrl;
        const nextGeminiApiKey = defaultGeminiInstance?.apiKey ?? geminiApiKey;
        const nextGeminiApiBaseUrl = defaultGeminiInstance?.apiBaseUrl ?? geminiApiBaseUrl;
        const nextSensenovaApiKey = defaultSensenovaInstance?.apiKey ?? sensenovaApiKey;
        const nextSensenovaApiBaseUrl = defaultSensenovaInstance?.apiBaseUrl ?? sensenovaApiBaseUrl;
        const nextSeedreamApiKey = defaultSeedreamInstance?.apiKey ?? seedreamApiKey;
        const nextSeedreamApiBaseUrl = defaultSeedreamInstance?.apiBaseUrl ?? seedreamApiBaseUrl;
        const savedConnectionMode = effectiveConnectionMode;
        const newConfig: Partial<AppConfig> = {};
        if (appLanguage !== initialConfig.appLanguage) newConfig.appLanguage = appLanguage;
        if (nextApiKey !== initialConfig.apiKey) newConfig.openaiApiKey = nextApiKey;
        if (nextApiBaseUrl !== initialConfig.apiBaseUrl) newConfig.openaiApiBaseUrl = nextApiBaseUrl;
        if (nextGeminiApiKey !== initialConfig.geminiApiKey) newConfig.geminiApiKey = nextGeminiApiKey;
        if (nextGeminiApiBaseUrl !== initialConfig.geminiApiBaseUrl) newConfig.geminiApiBaseUrl = nextGeminiApiBaseUrl;
        if (nextSensenovaApiKey !== initialConfig.sensenovaApiKey) newConfig.sensenovaApiKey = nextSensenovaApiKey;
        if (nextSensenovaApiBaseUrl !== initialConfig.sensenovaApiBaseUrl)
            newConfig.sensenovaApiBaseUrl = nextSensenovaApiBaseUrl;
        if (nextSeedreamApiKey !== initialConfig.seedreamApiKey) newConfig.seedreamApiKey = nextSeedreamApiKey;
        if (nextSeedreamApiBaseUrl !== initialConfig.seedreamApiBaseUrl)
            newConfig.seedreamApiBaseUrl = nextSeedreamApiBaseUrl;
        if (selectedProviderInstanceId !== initialConfig.selectedProviderInstanceId)
            newConfig.selectedProviderInstanceId = selectedProviderInstanceId;
        if (JSON.stringify(normalizedProviderInstances) !== JSON.stringify(initialConfig.providerInstances)) {
            newConfig.providerInstances = normalizedProviderInstances;
        }
        if (
            JSON.stringify(normalizedUnifiedProviderModelConfig.providerEndpoints) !==
            JSON.stringify(initialConfig.providerEndpoints)
        ) {
            newConfig.providerEndpoints = normalizedUnifiedProviderModelConfig.providerEndpoints;
        }
        if (
            JSON.stringify(normalizedUnifiedProviderModelConfig.modelCatalog) !==
            JSON.stringify(initialConfig.modelCatalog)
        ) {
            newConfig.modelCatalog = normalizedUnifiedProviderModelConfig.modelCatalog;
        }
        if (
            JSON.stringify(normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds) !==
            JSON.stringify(initialConfig.modelTaskDefaultCatalogEntryIds)
        ) {
            newConfig.modelTaskDefaultCatalogEntryIds =
                normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds;
        }
        if (
            JSON.stringify(normalizedVisionTextProviderInstances) !==
            JSON.stringify(initialConfig.visionTextProviderInstances)
        ) {
            newConfig.visionTextProviderInstances = normalizedVisionTextProviderInstances;
        }
        if (selectedVisionTextProviderInstanceId !== initialConfig.selectedVisionTextProviderInstanceId) {
            newConfig.selectedVisionTextProviderInstanceId = selectedVisionTextProviderInstanceId;
        }
        if (visionTextModelId !== initialConfig.visionTextModelId) newConfig.visionTextModelId = visionTextModelId;
        if (visionTextTaskType !== initialConfig.visionTextTaskType) newConfig.visionTextTaskType = visionTextTaskType;
        if (visionTextDetail !== initialConfig.visionTextDetail) newConfig.visionTextDetail = visionTextDetail;
        if (visionTextResponseFormat !== initialConfig.visionTextResponseFormat) {
            newConfig.visionTextResponseFormat = visionTextResponseFormat;
        }
        if (visionTextStreamingEnabled !== initialConfig.visionTextStreamingEnabled) {
            newConfig.visionTextStreamingEnabled = visionTextStreamingEnabled;
        }
        if (visionTextStructuredOutputEnabled !== initialConfig.visionTextStructuredOutputEnabled) {
            newConfig.visionTextStructuredOutputEnabled = visionTextStructuredOutputEnabled;
        }
        if (visionTextMaxOutputTokens !== initialConfig.visionTextMaxOutputTokens) {
            newConfig.visionTextMaxOutputTokens = visionTextMaxOutputTokens;
        }
        if (visionTextSystemPrompt !== initialConfig.visionTextSystemPrompt) {
            newConfig.visionTextSystemPrompt = visionTextSystemPrompt;
        }
        if (visionTextApiCompatibility !== initialConfig.visionTextApiCompatibility) {
            newConfig.visionTextApiCompatibility = visionTextApiCompatibility;
        }
        if (visionTextHistoryEnabled !== initialConfig.visionTextHistoryEnabled) {
            newConfig.visionTextHistoryEnabled = visionTextHistoryEnabled;
        }
        const normalizedVideoTaskDefaults = normalizeVideoTaskDefaults(videoTaskDefaults);
        if (JSON.stringify(normalizedVideoTaskDefaults) !== JSON.stringify(initialConfig.videoTaskDefaults)) {
            newConfig.videoTaskDefaults = normalizedVideoTaskDefaults;
        }
        const normalizedVideoSyncOptions = normalizeVideoSyncOptions(videoSyncOptions);
        if (JSON.stringify(normalizedVideoSyncOptions) !== JSON.stringify(initialConfig.videoSyncOptions)) {
            newConfig.videoSyncOptions = normalizedVideoSyncOptions;
        }
        const normalizedBatchFeature = normalizeBatchFeatureConfig(batchFeature);
        if (JSON.stringify(normalizedBatchFeature) !== JSON.stringify(initialConfig.batchFeature)) {
            newConfig.batchFeature = normalizedBatchFeature;
        }
        if (polishingPrompt !== initialConfig.polishingPrompt) newConfig.polishingPrompt = polishingPrompt;
        if (polishingPresetId !== initialConfig.polishingPresetId) newConfig.polishingPresetId = polishingPresetId;
        if (polishingThinkingEnabled !== initialConfig.polishingThinkingEnabled)
            newConfig.polishingThinkingEnabled = polishingThinkingEnabled;
        if (polishingThinkingEffort !== initialConfig.polishingThinkingEffort)
            newConfig.polishingThinkingEffort = polishingThinkingEffort.trim() || DEFAULT_PROMPT_POLISH_THINKING_EFFORT;
        if (polishingThinkingEffortFormat !== initialConfig.polishingThinkingEffortFormat)
            newConfig.polishingThinkingEffortFormat = polishingThinkingEffortFormat;
        if (JSON.stringify(normalizedCustomPolishPrompts) !== JSON.stringify(initialConfig.polishingCustomPrompts)) {
            newConfig.polishingCustomPrompts = normalizedCustomPolishPrompts;
        }
        if (JSON.stringify(normalizedPolishPickerOrder) !== JSON.stringify(initialConfig.polishPickerOrder)) {
            newConfig.polishPickerOrder = normalizedPolishPickerOrder;
        }
        if (JSON.stringify(normalizedCustomModels) !== JSON.stringify(initialConfig.customImageModels)) {
            newConfig.customImageModels = normalizedCustomModels;
        }
        if (storageMode !== initialConfig.storageMode) newConfig.imageStorageMode = storageMode;
        if (imageStoragePath !== initialConfig.imageStoragePath) newConfig.imageStoragePath = imageStoragePath.trim();
        if (savedConnectionMode !== initialConfig.connectionMode) newConfig.connectionMode = savedConnectionMode;
        if (maxConcurrentTasks !== initialConfig.maxConcurrentTasks) newConfig.maxConcurrentTasks = maxConcurrentTasks;
        if (promptHistoryLimit !== initialConfig.promptHistoryLimit) newConfig.promptHistoryLimit = promptHistoryLimit;
        const normalizedHiddenPromptToolbarButtons = normalizeHiddenPromptToolbarButtons(hiddenPromptToolbarButtons);
        if (
            JSON.stringify(normalizedHiddenPromptToolbarButtons) !==
            JSON.stringify(initialConfig.hiddenPromptToolbarButtons)
        ) {
            newConfig.hiddenPromptToolbarButtons = normalizedHiddenPromptToolbarButtons;
        }
        if (desktopProxyMode !== initialConfig.desktopProxyMode) newConfig.desktopProxyMode = desktopProxyMode;
        if (desktopProxyUrl !== initialConfig.desktopProxyUrl || desktopProxyMode !== initialConfig.desktopProxyMode) {
            const trimmed = desktopProxyUrl.trim();
            if (desktopProxyMode === 'manual' && !trimmed) {
                setProxyUrlError('请输入代理地址，例如 127.0.0.1:7890 或 socks5://127.0.0.1:1080');
                return;
            }
            if (desktopProxyMode === 'manual' && !isValidProxyUrl(trimmed)) {
                setProxyUrlError('代理 URL 必须是有效的 http、https、socks5 或 socks5h 地址');
                return;
            }
            setProxyUrlError('');
            newConfig.desktopProxyUrl = desktopProxyMode === 'manual' ? normalizeDesktopProxyUrl(trimmed) : trimmed;
        }
        if (desktopPromoServiceMode !== initialConfig.desktopPromoServiceMode) {
            newConfig.desktopPromoServiceMode = desktopPromoServiceMode;
        }
        if (
            desktopPromoServiceUrl !== initialConfig.desktopPromoServiceUrl ||
            desktopPromoServiceMode !== initialConfig.desktopPromoServiceMode
        ) {
            const trimmed = desktopPromoServiceUrl.trim();
            if (desktopPromoServiceMode === 'origin' || desktopPromoServiceMode === 'endpoint') {
                if (!trimmed) {
                    setPromoServiceUrlError(
                        desktopPromoServiceMode === 'origin'
                            ? '请输入展示服务域名，例如 https://content.example.com'
                            : '请输入完整展示接口地址，例如 https://content.example.com/api/promo/placements'
                    );
                    return;
                }

                const normalized = normalizeDesktopPromoServiceUrl(trimmed, desktopPromoServiceMode);
                if (!normalized) {
                    setPromoServiceUrlError(
                        desktopPromoServiceMode === 'origin'
                            ? '展示服务域名必须是有效的 http 或 https 地址'
                            : '展示接口地址必须是有效的 http 或 https 地址'
                    );
                    return;
                }

                setPromoServiceUrlError('');
                newConfig.desktopPromoServiceUrl = normalized;
            } else {
                setPromoServiceUrlError('');
                newConfig.desktopPromoServiceUrl = '';
            }
        }
        if (desktopDebugMode !== initialConfig.desktopDebugMode) newConfig.desktopDebugMode = desktopDebugMode;

        if (
            directLinkRestriction?.provider === 'openai' &&
            !directLinkRestriction.serviceLabel &&
            !apiBaseUrl &&
            envApiBaseUrl
        ) {
            newConfig.openaiApiBaseUrl = envApiBaseUrl;
        }
        if (directLinkRestriction?.provider === 'google' && !geminiApiBaseUrl && envGeminiApiBaseUrl) {
            newConfig.geminiApiBaseUrl = envGeminiApiBaseUrl;
        }
        if (directLinkRestriction?.provider === 'sensenova' && !sensenovaApiBaseUrl && envSensenovaApiBaseUrl) {
            newConfig.sensenovaApiBaseUrl = envSensenovaApiBaseUrl;
        }
        if (directLinkRestriction?.provider === 'seedream' && !seedreamApiBaseUrl && envSeedreamApiBaseUrl) {
            newConfig.seedreamApiBaseUrl = envSeedreamApiBaseUrl;
        }
        saveConfig(newConfig);
        saveSyncConfig(currentSyncConfig);
        setInitialSyncConfigSnapshot(
            JSON.stringify({
                s3: currentSyncConfig.s3,
                autoSync: currentSyncConfig.autoSync,
                ui: currentSyncConfig.ui
            })
        );
        setS3Status(
            isS3SyncConfigConfigured(currentSyncConfig.s3)
                ? {
                      configured: true,
                      endpoint: currentSyncConfig.s3.endpoint,
                      region: currentSyncConfig.s3.region,
                      bucket: currentSyncConfig.s3.bucket,
                      forcePathStyle: currentSyncConfig.s3.forcePathStyle,
                      allowRemoteDeletion: currentSyncConfig.s3.allowRemoteDeletion,
                      rootPrefix: currentSyncConfig.s3.prefix,
                      profileId: currentSyncConfig.s3.profileId
                  }
                : { configured: false, message: '当前浏览器尚未配置完整的 S3 兼容对象存储信息。' }
        );
        if (newConfig.batchFeature) {
            setBatchFeature(normalizedBatchFeature);
            setBatchPromptDraft(
                getBatchPlanningSystemPrompt(normalizedBatchFeature, normalizedBatchFeature.defaultStrategyId)
            );
        }
        onConfigChange(newConfig);
        setSaveWarningMessage('');
        setSaved(true);
        addNotice(t('settings.saveSuccess'), 'success');
        setTimeout(() => setOpen(false), 600);
    };

    const handleReset = () => {
        const resetRestriction = getClientDirectLinkRestriction({
            enabled: clientDirectLinkPriority,
            envOpenaiApiBaseUrl: envApiBaseUrl,
            envGeminiApiBaseUrl,
            envSensenovaApiBaseUrl,
            envSeedreamApiBaseUrl
        });
        const resetConnectionMode = resetRestriction ? 'direct' : 'proxy';

        localStorage.removeItem('gpt-image-playground-config');
        clearSyncConfig();
        setApiKey('');
        setApiBaseUrl('');
        setGeminiApiKey('');
        setGeminiApiBaseUrl('');
        setSensenovaApiKey('');
        setSensenovaApiBaseUrl('');
        setSeedreamApiKey('');
        setSeedreamApiBaseUrl('');
        const resetAppLanguage = detectRuntimeAppLanguage();
        setAppLanguage(resetAppLanguage);
        setLanguage(resetAppLanguage);
        const resetProviderInstances = normalizeProviderInstances(undefined);
        const resetVisionTextProviderInstances = normalizeVisionTextProviderInstances(undefined);
        const resetUnifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(undefined, {
            providerInstances: resetProviderInstances,
            customImageModels: [],
            visionTextProviderInstances: resetVisionTextProviderInstances,
            polishingThinkingEnabled: DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
            polishingThinkingEffort: DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
            polishingThinkingEffortFormat: DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT
        });
        setProviderInstances(resetProviderInstances);
        setSelectedProviderInstanceId('');
        setProviderEndpoints(resetUnifiedProviderModelConfig.providerEndpoints);
        setModelCatalog(resetUnifiedProviderModelConfig.modelCatalog);
        setModelTaskDefaultCatalogEntryIds(resetUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds);
        setModelCatalogSearch('');
        setProviderModelRefreshStatus({});
        setNewUnifiedProviderTemplateKey(getProviderEndpointTemplateKey(TEXT_PROVIDER_ENDPOINT_TEMPLATES[0]));
        setNewUnifiedProviderName('');
        setNewUnifiedProviderApiKey('');
        setNewUnifiedProviderApiBaseUrl('');
        setNewUnifiedProviderApiKeyVisible(false);
        setUnifiedProviderApiKeyVisibility({});
        setModelManagerDialog(null);
        setVisionTextProviderInstances(resetVisionTextProviderInstances);
        setSelectedVisionTextProviderInstanceId('');
        setVisionTextModelId('');
        setVisionTextTaskType(DEFAULT_VISION_TEXT_TASK_TYPE);
        setVisionTextDetail(DEFAULT_VISION_TEXT_DETAIL);
        setVisionTextResponseFormat(DEFAULT_VISION_TEXT_RESPONSE_FORMAT);
        setVisionTextStreamingEnabled(DEFAULT_VISION_TEXT_STREAMING_ENABLED);
        setVisionTextStructuredOutputEnabled(DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED);
        setVisionTextMaxOutputTokens(DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS);
        setVisionTextSystemPrompt(DEFAULT_VISION_TEXT_SYSTEM_PROMPT);
        setVisionTextApiCompatibility(DEFAULT_VISION_TEXT_API_COMPATIBILITY);
        setVisionTextHistoryEnabled(true);
        setVideoTaskDefaults(DEFAULT_VIDEO_TASK_DEFAULTS);
        setVideoSyncOptions(DEFAULT_VIDEO_SYNC_OPTIONS);
        setBatchFeature(DEFAULT_BATCH_FEATURE_CONFIG);
        setBatchPromptEditorOpen(false);
        setBatchPromptDraft(DEFAULT_BATCH_PLAN_SYSTEM_PROMPT);
        setPolishingPrompt(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
        setPolishingPresetId(DEFAULT_POLISHING_PRESET_ID);
        setPolishingThinkingEnabled(DEFAULT_PROMPT_POLISH_THINKING_ENABLED);
        setPolishingThinkingEffort(DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
        setPolishingThinkingEffortFormat(DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT);
        setPolishingCustomPrompts([]);
        setPolishPickerOrder(getDefaultPolishPickerOrder());
        setPolishPromptEditIndex(null);
        setNewPolishPromptName('');
        setNewPolishPromptSystemPrompt('');
        setCustomImageModels([]);
        setStorageMode('auto');
        setImageStoragePath('');
        setImageStoragePathError('');
        setConnectionMode(resetConnectionMode);
        setMaxConcurrentTasks(3);
        setPromptHistoryLimit(DEFAULT_PROMPT_HISTORY_LIMIT);
        setHiddenPromptToolbarButtons([]);
        setDesktopProxyMode('disabled');
        setDesktopProxyUrl('');
        setDesktopPromoServiceMode('current');
        setDesktopPromoServiceUrl('');
        setDesktopDebugMode(false);
        setS3Endpoint('');
        setS3Region(DEFAULT_SYNC_CONFIG.s3.region);
        setS3Bucket('');
        setS3AccessKeyId('');
        setS3SecretAccessKey('');
        setShowS3SecretAccessKey(false);
        setS3ForcePathStyle(DEFAULT_SYNC_CONFIG.s3.forcePathStyle);
        setS3AllowRemoteDeletion(DEFAULT_SYNC_CONFIG.s3.allowRemoteDeletion);
        setS3RequestMode(DEFAULT_SYNC_CONFIG.s3.requestMode);
        setS3Prefix(DEFAULT_SYNC_CONFIG.s3.prefix);
        setS3ProfileId(DEFAULT_SYNC_CONFIG.s3.profileId);
        setSyncAutoSyncEnabled(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.enabled);
        setSyncAutoSyncScopes(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.scopes);
        setSyncHideWhenUnconfigured(DEFAULT_SYNC_UI_SETTINGS.hideWhenUnconfigured);
        setInitialSyncConfigSnapshot(
            JSON.stringify({
                s3: DEFAULT_SYNC_CONFIG.s3,
                autoSync: DEFAULT_SYNC_CONFIG.autoSync,
                ui: DEFAULT_SYNC_CONFIG.ui
            })
        );
        setS3Status({ configured: false, message: '当前浏览器尚未配置 S3 兼容对象存储。' });
        setS3TestResult(null);
        setProxyUrlError('');
        setPromoServiceUrlError('');
        setSaveWarningMessage('');
        onConfigChange({
            appLanguage: resetAppLanguage,
            openaiApiKey: '',
            openaiApiBaseUrl: '',
            geminiApiKey: '',
            geminiApiBaseUrl: '',
            sensenovaApiKey: '',
            sensenovaApiBaseUrl: '',
            seedreamApiKey: '',
            seedreamApiBaseUrl: '',
            providerInstances: resetProviderInstances,
            selectedProviderInstanceId: '',
            providerEndpoints: resetUnifiedProviderModelConfig.providerEndpoints,
            modelCatalog: resetUnifiedProviderModelConfig.modelCatalog,
            modelTaskDefaultCatalogEntryIds: resetUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds,
            visionTextProviderInstances: resetVisionTextProviderInstances,
            selectedVisionTextProviderInstanceId: '',
            visionTextModelId: '',
            visionTextTaskType: DEFAULT_VISION_TEXT_TASK_TYPE,
            visionTextDetail: DEFAULT_VISION_TEXT_DETAIL,
            visionTextResponseFormat: DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
            visionTextStreamingEnabled: DEFAULT_VISION_TEXT_STREAMING_ENABLED,
            visionTextStructuredOutputEnabled: DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED,
            visionTextMaxOutputTokens: DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
            visionTextSystemPrompt: DEFAULT_VISION_TEXT_SYSTEM_PROMPT,
            visionTextApiCompatibility: DEFAULT_VISION_TEXT_API_COMPATIBILITY,
            visionTextHistoryEnabled: true,
            videoTaskDefaults: DEFAULT_VIDEO_TASK_DEFAULTS,
            videoSyncOptions: DEFAULT_VIDEO_SYNC_OPTIONS,
            batchFeature: DEFAULT_BATCH_FEATURE_CONFIG,
            polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
            polishingPresetId: DEFAULT_POLISHING_PRESET_ID,
            polishingThinkingEnabled: DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
            polishingThinkingEffort: DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
            polishingThinkingEffortFormat: DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
            polishingCustomPrompts: [],
            polishPickerOrder: getDefaultPolishPickerOrder(),
            customImageModels: [],
            imageStorageMode: 'auto',
            imageStoragePath: '',
            connectionMode: resetConnectionMode,
            maxConcurrentTasks: 3,
            promptHistoryLimit: DEFAULT_PROMPT_HISTORY_LIMIT,
            hiddenPromptToolbarButtons: [...DEFAULT_HIDDEN_PROMPT_TOOLBAR_BUTTONS],
            desktopProxyMode: 'disabled',
            desktopProxyUrl: '',
            desktopPromoServiceMode: 'current',
            desktopPromoServiceUrl: '',
            desktopDebugMode: false
        });
        setSaved(true);
        setTimeout(() => setOpen(false), 600);
    };

    const importConfigFileRef = React.useRef<HTMLInputElement>(null);

    const performExportConfig = React.useCallback(
        (includeSecrets: boolean) => {
            try {
                const config = loadConfig() as unknown as Record<string, unknown>;
                const payload = buildExportedConfig({ config, includeSecrets });
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                triggerJsonDownload(`gpt-image-playground-config-${stamp}.json`, payload);
                addNotice(
                    includeSecrets ? '已导出配置（含密钥），请妥善保管。' : '已导出配置（不含密钥）。',
                    'success'
                );
            } catch (err) {
                console.warn('[settings] export failed', err);
                addNotice('导出失败，详见控制台', 'error');
            }
        },
        [addNotice]
    );

    const handleImportConfigClick = React.useCallback(() => {
        importConfigFileRef.current?.click();
    }, []);

    const handleImportConfigChange = React.useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
                const text = await file.text();
                let parsed: unknown;
                try {
                    parsed = JSON.parse(text);
                } catch {
                    addNotice('JSON 解析失败，请检查文件格式', 'error');
                    return;
                }
                const validation = validateImportedConfig(parsed);
                if (!validation.ok) {
                    addNotice(
                        validation.error === 'invalidJson'
                            ? 'JSON 内容无效'
                            : `Schema 版本不兼容（要求 ≤ v${CONFIG_SCHEMA_VERSION}）`,
                        'error'
                    );
                    return;
                }
                addNotice(
                    `已加载 schema v${validation.schemaVersion} 配置${
                        validation.includesSecrets ? '（含密钥）' : '（不含密钥）'
                    }${validation.warnings.length > 0 ? `；注意：${validation.warnings.join('; ')}` : ''}，点击「应用」覆盖当前设置（自动备份）`,
                    {
                        tone: 'warning',
                        durationMs: 12000,
                        action: {
                            label: '应用',
                            onClick: () => {
                                try {
                                    const current = loadConfig();
                                    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                                    const backupKey = `gpt-image-playground-config-backup-${stamp}`;
                                    localStorage.setItem(backupKey, JSON.stringify(current));
                                    const backupIndex = 'gpt-image-playground-config-backup-index';
                                    const indexRaw = localStorage.getItem(backupIndex);
                                    const index = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];
                                    const nextIndex = [...index, backupKey].slice(-3);
                                    for (const expired of index.filter((key) => !nextIndex.includes(key))) {
                                        localStorage.removeItem(expired);
                                    }
                                    localStorage.setItem(backupIndex, JSON.stringify(nextIndex));
                                } catch (err) {
                                    console.warn('[settings] backup before import failed', err);
                                }
                                saveConfig(validation.config as Partial<AppConfig>);
                                addNotice('配置已导入，部分设置刷新后生效', 'success');
                            }
                        }
                    }
                );
            } catch (err) {
                console.warn('[settings] import failed', err);
                addNotice('导入失败，详见控制台', 'error');
            }
        },
        [addNotice]
    );

    const storageOptions = [
        { value: 'auto', label: '自动检测' },
        { value: 'fs', label: '文件系统' },
        { value: 'indexeddb', label: 'IndexedDB' }
    ];
    const languageOptions: AppLanguage[] = ['zh-CN', 'en-US'];

    const handleLanguageChange = React.useCallback(
        (value: string) => {
            const nextLanguage = value as AppLanguage;
            setAppLanguage(nextLanguage);
            setLanguage(nextLanguage);
            setInitialConfig((current) => ({ ...current, appLanguage: nextLanguage }));
            onConfigChange({ appLanguage: nextLanguage });
        },
        [onConfigChange, setLanguage]
    );

    const modelCatalogEndpointById = React.useMemo(
        () => new Map(providerEndpoints.map((endpoint) => [endpoint.id, endpoint])),
        [providerEndpoints]
    );
    const modelCatalogProviderOptions = React.useMemo(() => {
        const providers = new Set<ProviderKind>();
        providerEndpoints.forEach((endpoint) => providers.add(endpoint.provider));
        modelCatalog.forEach((entry) => providers.add(entry.provider));
        return MODEL_CATALOG_PROVIDER_ORDER.filter((provider) => providers.has(provider));
    }, [modelCatalog, providerEndpoints]);
    const videoEndpointTemplates = React.useMemo(
        () =>
            VIDEO_PROVIDER_ENDPOINT_TEMPLATES.map((template) => ({
                ...template,
                supportedByDiscovery: supportsProviderModelDiscovery(template.protocol),
                hasEndpoint: providerEndpoints.some(
                    (endpoint) => endpoint.provider === template.kind && endpoint.protocol === template.protocol
                )
            })),
        [providerEndpoints]
    );
    const providerEndpointTemplates = React.useMemo(
        () =>
            PROVIDER_ENDPOINT_TEMPLATES.map((template) => ({
                ...template,
                supportedByDiscovery: supportsProviderModelDiscovery(template.protocol),
                hasEndpoint: providerEndpoints.some(
                    (endpoint) => endpoint.provider === template.kind && endpoint.protocol === template.protocol
                )
            })),
        [providerEndpoints]
    );
    const textProviderEndpoints = React.useMemo(
        () => providerEndpoints.filter((endpoint) => isTextProviderEndpoint(endpoint)),
        [providerEndpoints]
    );
    const imageProviderEndpoints = React.useMemo(
        () =>
            providerEndpoints.filter((endpoint) => {
                if (endpoint.legacyImageProvider) return true;
                return isImageProviderEndpoint(endpoint) && !isVideoProviderProtocol(endpoint.protocol);
            }),
        [providerEndpoints]
    );
    const videoProviderEndpoints = React.useMemo(
        () => providerEndpoints.filter((endpoint) => isVideoProviderProtocol(endpoint.protocol)),
        [providerEndpoints]
    );
    const providerEndpointCategoryGroups = React.useMemo(
        () => [
            {
                key: 'text' as const,
                title: t('settings.endpoints.textGroupTitle'),
                description: t('settings.endpoints.textGroupDescription'),
                templates: TEXT_PROVIDER_ENDPOINT_TEMPLATES,
                endpoints: textProviderEndpoints
            },
            {
                key: 'image' as const,
                title: t('settings.endpoints.imageGroupTitle'),
                description: t('settings.endpoints.imageGroupDescription'),
                templates: IMAGE_PROVIDER_ENDPOINT_TEMPLATES,
                endpoints: imageProviderEndpoints
            },
            {
                key: 'video' as const,
                title: t('settings.endpoints.videoGroupTitle'),
                description: t('settings.endpoints.videoGroupDescription'),
                templates: VIDEO_PROVIDER_ENDPOINT_TEMPLATES,
                endpoints: videoProviderEndpoints
            }
        ],
        [imageProviderEndpoints, t, textProviderEndpoints, videoProviderEndpoints]
    );
    const modelCatalogEndpointOptions = React.useMemo(
        () =>
            providerEndpoints.filter(
                (endpoint) => modelCatalogProviderFilter === 'all' || endpoint.provider === modelCatalogProviderFilter
            ),
        [modelCatalogProviderFilter, providerEndpoints]
    );

    React.useEffect(() => {
        if (modelCatalogEndpointFilter === 'all') return;
        if (!modelCatalogEndpointOptions.some((endpoint) => endpoint.id === modelCatalogEndpointFilter)) {
            setModelCatalogEndpointFilter('all');
        }
    }, [modelCatalogEndpointFilter, modelCatalogEndpointOptions]);

    const filteredModelCatalogEntries = React.useMemo(() => {
        const search = modelCatalogSearch.trim().toLowerCase();
        return modelCatalog
            .filter((entry) => {
                const endpoint = modelCatalogEndpointById.get(entry.providerEndpointId);
                if (modelCatalogProviderFilter !== 'all' && entry.provider !== modelCatalogProviderFilter) return false;
                if (modelCatalogEndpointFilter !== 'all' && entry.providerEndpointId !== modelCatalogEndpointFilter)
                    return false;
                if (modelCatalogTaskFilter !== 'all' && !entry.capabilities.tasks.includes(modelCatalogTaskFilter))
                    return false;
                if (modelCatalogSourceFilter !== 'all' && entry.source !== modelCatalogSourceFilter) return false;
                if (modelCatalogStatusFilter === 'enabled' && entry.enabled === false) return false;
                if (modelCatalogStatusFilter === 'disabled' && entry.enabled !== false) return false;
                if (modelCatalogStatusFilter === 'unclassified' && entry.capabilityConfidence !== 'low') return false;
                if (search && !modelCatalogEntrySearchText(entry, endpoint).includes(search)) return false;
                return true;
            })
            .sort((a, b) => {
                const providerDiff =
                    MODEL_CATALOG_PROVIDER_ORDER.indexOf(a.provider) - MODEL_CATALOG_PROVIDER_ORDER.indexOf(b.provider);
                if (providerDiff !== 0) return providerDiff;
                const endpointA = modelCatalogEndpointById.get(a.providerEndpointId)?.name || a.providerEndpointId;
                const endpointB = modelCatalogEndpointById.get(b.providerEndpointId)?.name || b.providerEndpointId;
                const endpointDiff = endpointA.localeCompare(endpointB);
                if (endpointDiff !== 0) return endpointDiff;
                return a.rawModelId.localeCompare(b.rawModelId);
            });
    }, [
        modelCatalog,
        modelCatalogEndpointById,
        modelCatalogEndpointFilter,
        modelCatalogProviderFilter,
        modelCatalogSearch,
        modelCatalogSourceFilter,
        modelCatalogStatusFilter,
        modelCatalogTaskFilter
    ]);
    const groupedModelCatalogEntries = React.useMemo(() => {
        const groups = new Map<ProviderKind, ModelCatalogEntry[]>();
        filteredModelCatalogEntries.forEach((entry) => {
            const entries = groups.get(entry.provider) ?? [];
            entries.push(entry);
            groups.set(entry.provider, entries);
        });
        return MODEL_CATALOG_PROVIDER_ORDER.filter((provider) => groups.has(provider)).map((provider) => ({
            provider,
            entries: groups.get(provider) ?? []
        }));
    }, [filteredModelCatalogEntries]);
    const modelCatalogActiveFilterCount = [
        modelCatalogSearch.trim(),
        modelCatalogProviderFilter !== 'all',
        modelCatalogEndpointFilter !== 'all',
        modelCatalogTaskFilter !== 'all',
        modelCatalogSourceFilter !== 'all',
        modelCatalogStatusFilter !== 'all'
    ].filter(Boolean).length;
    const unifiedModelCatalogConfig = React.useMemo(
        () => ({ providerEndpoints, modelCatalog, modelTaskDefaultCatalogEntryIds }),
        [modelCatalog, modelTaskDefaultCatalogEntryIds, providerEndpoints]
    );
    const visionTextCatalogSelection = React.useMemo(
        () =>
            resolveVisionTextCatalogSelection(
                {
                    providerEndpoints,
                    modelCatalog,
                    modelTaskDefaultCatalogEntryIds,
                    providerInstances,
                    visionTextProviderInstances,
                    selectedVisionTextProviderInstanceId,
                    visionTextModelId,
                    visionTextApiCompatibility,
                    openaiApiKey: apiKey,
                    openaiApiBaseUrl: apiBaseUrl,
                    geminiApiKey,
                    geminiApiBaseUrl,
                    sensenovaApiKey,
                    sensenovaApiBaseUrl,
                    seedreamApiKey,
                    seedreamApiBaseUrl,
                    polishingThinkingEnabled,
                    polishingThinkingEffort,
                    polishingThinkingEffortFormat
                },
                {
                    providerEndpointId: selectedVisionTextProviderInstanceId || undefined
                }
            ),
        [
            apiBaseUrl,
            apiKey,
            geminiApiBaseUrl,
            geminiApiKey,
            modelCatalog,
            modelTaskDefaultCatalogEntryIds,
            polishingThinkingEffort,
            polishingThinkingEffortFormat,
            polishingThinkingEnabled,
            providerEndpoints,
            providerInstances,
            seedreamApiBaseUrl,
            seedreamApiKey,
            selectedVisionTextProviderInstanceId,
            sensenovaApiBaseUrl,
            sensenovaApiKey,
            visionTextApiCompatibility,
            visionTextModelId,
            visionTextProviderInstances
        ]
    );
    const videoTaskDefaultRows = React.useMemo(
        () =>
            TASK_DEFAULT_ROW_CONFIGS.filter(
                (row) => row.task === 'video.generate' || row.task === 'video.imageToVideo'
            ),
        []
    );
    const promptModelSelectionRows = React.useMemo(
        () =>
            [
                {
                    task: 'prompt.polish' as const,
                    titleKey: 'settings.polish.modelSelection.promptPolish.title',
                    descriptionKey: 'settings.polish.modelSelection.promptPolish.description'
                }
            ] satisfies Array<{
                task: PromptPolishModelSelectionTask;
                titleKey: string;
                descriptionKey: string;
            }>,
        []
    );
    const promptPolishBindingEndpoints = React.useMemo(
        () =>
            getProviderModelBindingEndpoints(unifiedModelCatalogConfig, {
                allowedFamilies: PROMPT_MODEL_BINDING_COMPATIBILITY_FAMILIES
            }),
        [unifiedModelCatalogConfig]
    );
    const hasPromptPolishCompatibleEndpoints = promptPolishBindingEndpoints.length > 0;
    const visionTextBindingEndpoints = React.useMemo(
        () =>
            getProviderModelBindingEndpoints(unifiedModelCatalogConfig, {
                allowedFamilies: VISION_TEXT_MODEL_BINDING_COMPATIBILITY_FAMILIES
            }),
        [unifiedModelCatalogConfig]
    );
    const hasVisionTextCompatibleEndpoints = visionTextBindingEndpoints.length > 0;
    const selectedBatchPlanEntry = React.useMemo(
        () =>
            modelTaskDefaultCatalogEntryIds['prompt.batchPlan']
                ? findModelCatalogEntry(unifiedModelCatalogConfig, {
                      catalogEntryId: modelTaskDefaultCatalogEntryIds['prompt.batchPlan']
                  })
                : null,
        [modelTaskDefaultCatalogEntryIds, unifiedModelCatalogConfig]
    );
    const batchModelEndpointId =
        promptModelSelectionEndpointIds['prompt.batchPlan'] || selectedBatchPlanEntry?.providerEndpointId || '';
    const batchPlanPromptTemplate = React.useMemo(
        () =>
            batchFeature.promptTemplates.find((template) => template.id === BATCH_AUTO_PROMPT_TEMPLATE_ID) ||
            DEFAULT_BATCH_FEATURE_CONFIG.promptTemplates[0],
        [batchFeature.promptTemplates]
    );
    const batchPlanPromptIsCustom = Boolean(batchPlanPromptTemplate.customPrompt?.trim());

    React.useEffect(() => {
        setPromptModelSelectionEndpointIds((current) => {
            const next = { ...current };
            let changed = false;
            const endpointIds = new Set(promptPolishBindingEndpoints.map((endpoint) => endpoint.id));
            (['prompt.polish', 'prompt.batchPlan'] as const).forEach((task) => {
                const endpointId = next[task];
                if (!endpointId) return;
                if (endpointIds.has(endpointId)) return;
                delete next[task];
                changed = true;
            });
            return changed ? next : current;
        });
    }, [promptPolishBindingEndpoints]);

    const handleAddPromptBindingEndpoint = React.useCallback(() => {
        setNewUnifiedProviderTemplateKey(getProviderEndpointTemplateKey(TEXT_PROVIDER_ENDPOINT_TEMPLATES[0]));
        setSettingsView('provider-endpoints');
    }, []);

    const handleManagePromptBindingEndpoint = React.useCallback((endpoint: ProviderEndpoint) => {
        setNewUnifiedProviderTemplateKey(
            getProviderEndpointTemplateKey(
                PROVIDER_ENDPOINT_TEMPLATES.find(
                    (template) => template.kind === endpoint.provider && template.protocol === endpoint.protocol
                ) ?? TEXT_PROVIDER_ENDPOINT_TEMPLATES[0]
            )
        );
        setSettingsView('provider-endpoints');
    }, []);

    const bindModelIdToTask = React.useCallback(
        (task: ModelTaskCapability, endpoint: ProviderEndpoint, rawModelId: string, option?: ManagedModelOption) => {
            const modelId = rawModelId.trim();
            if (!modelId) return;
            const fallbackEntryId = getCatalogEntryId(endpoint.id, modelId);
            const selectedEntryId = option?.id && !option.id.startsWith('manual:') ? option.id : fallbackEntryId;
            setProviderEndpoints((current) =>
                current.map((item) =>
                    item.id === endpoint.id
                        ? {
                              ...item,
                              modelIds: normalizeModelIds([...(item.modelIds ?? []), modelId])
                          }
                        : item
                )
            );
            setModelCatalog((current) => {
                const existing = current.find(
                    (entry) =>
                        entry.id === selectedEntryId ||
                        (entry.providerEndpointId === endpoint.id && entry.rawModelId === modelId)
                );
                const created =
                    existing ||
                    createCustomModelCatalogEntry(endpoint, modelId, {
                        displayLabel:
                            option?.metadata?.displayLabel ||
                            (option?.label && option.label !== modelId ? option.label : undefined),
                        upstreamVendor: option?.metadata?.upstreamVendor
                    });
                if (!created) return current;
                const boundEntry = ensureCatalogEntryTaskCapability({ ...created, enabled: true }, task);
                return [...current.filter((entry) => entry.id !== boundEntry.id), boundEntry];
            });
            setModelTaskDefaultCatalogEntryIds((current) => ({
                ...current,
                [task]: selectedEntryId
            }));
            setPromptModelSelectionEndpointIds((current) => ({
                ...current,
                [task]: endpoint.id
            }));
            if (task === 'vision.text') {
                setSelectedVisionTextProviderInstanceId(endpoint.id);
                setVisionTextModelId(modelId);
                setVisionTextApiCompatibility(
                    endpoint.protocol === 'openai-responses' &&
                        endpoint.provider !== 'anthropic' &&
                        endpoint.provider !== 'anthropic-compatible'
                        ? 'responses'
                        : 'chat-completions'
                );
            }
        },
        []
    );

    const openTaskBindingModelManager = React.useCallback(
        (task: ModelTaskCapability, endpoint: ProviderEndpoint) => {
            const selectedEntryId = modelTaskDefaultCatalogEntryIds[task];
            const selectedEntry = selectedEntryId
                ? (modelCatalog.find((entry) => entry.id === selectedEntryId) ?? null)
                : null;
            const selectedModelIds =
                selectedEntry && selectedEntry.providerEndpointId === endpoint.id ? [selectedEntry.rawModelId] : [];
            const selectedSet = new Set(selectedModelIds);
            const endpointEntries = modelCatalog.filter((entry) => entry.providerEndpointId === endpoint.id);
            const options = mergeManagedModelOptions(
                endpointEntries.map((entry) => getCatalogEntryBindingOption(entry, endpoint, selectedSet, task, t))
            );
            setModelManagerDialog({
                open: true,
                endpointId: endpoint.id,
                selectionMode: 'single',
                optionMode: 'binding',
                bindingTask: task,
                requireSelection: true,
                title: t('settings.modelBinding.dialogTitle', { name: endpoint.name }),
                description: t('settings.modelBinding.dialogDescription'),
                options,
                selectedModelIds,
                allowManualModels: true,
                emptyMessage: t('settings.modelBinding.dialogEmpty'),
                onRefresh: () => refreshUnifiedProviderEndpointModels(endpoint),
                onConfirm: (modelIds, optionsSnapshot) => {
                    const modelId = modelIds[0]?.trim();
                    if (!modelId) return;
                    bindModelIdToTask(
                        task,
                        endpoint,
                        modelId,
                        optionsSnapshot.find((item) => item.modelId === modelId)
                    );
                }
            });
            void refreshUnifiedProviderEndpointModels(endpoint);
        },
        [bindModelIdToTask, modelCatalog, modelTaskDefaultCatalogEntryIds, refreshUnifiedProviderEndpointModels, t]
    );

    const copyBatchAutoPrompt = React.useCallback(() => {
        const text = getBatchPlanningSystemPrompt(batchFeature, 'auto');
        void copyTextToClipboard(text).then((ok) => {
            if (ok) addNotice(t('settings.batch.prompt.copySuccess'), 'success');
        });
    }, [addNotice, batchFeature, t]);

    const resetModelCatalogFilters = React.useCallback(() => {
        setModelCatalogSearch('');
        setModelCatalogProviderFilter('all');
        setModelCatalogEndpointFilter('all');
        setModelCatalogTaskFilter('all');
        setModelCatalogSourceFilter('all');
        setModelCatalogStatusFilter('all');
    }, []);

    return (
        <>
            <Dialog open={open} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                    <Button
                        variant='ghost'
                        size='icon'
                        className='text-foreground/60 hover:bg-accent hover:text-foreground'
                        aria-label={t('common.settings')}>
                        <Settings className='h-4 w-4' />
                    </Button>
                </DialogTrigger>
                <DialogContent className='border-border bg-background text-foreground top-0 left-0 flex h-screen max-h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none p-0 shadow-xl supports-[height:100dvh]:h-dvh supports-[height:100dvh]:max-h-dvh sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(760px,calc(100vw-2rem))] sm:max-w-[760px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl'>
                    <div className='border-border bg-card/70 shrink-0 border-b px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] pr-12 sm:px-6 sm:pt-4'>
                        <DialogHeader>
                            <DialogTitle className='text-xl font-semibold'>
                                {settingsView === 'providers'
                                    ? t('settings.providersTitle')
                                    : settingsView === 'provider-endpoints'
                                      ? t('settings.providerEndpointsTitle')
                                      : settingsView === 'image-endpoints'
                                        ? t('settings.imageEndpointsTitle')
                                        : settingsView === 'video-endpoints'
                                          ? t('settings.videoEndpointsTitle')
                                          : settingsView === 'batch-config'
                                            ? t('settings.batch.title')
                                            : settingsView === 'polish-prompts'
                                              ? t('settings.polishTitle')
                                              : settingsView === 'vision-text'
                                                ? t('settings.visionTextTitle')
                                                : settingsView === 'model-catalog'
                                                  ? t('settings.modelCatalogTitle')
                                                  : t('settings.title')}
                            </DialogTitle>
                            <DialogDescription>
                                {settingsView === 'providers'
                                    ? t('settings.providersDescription')
                                    : settingsView === 'provider-endpoints'
                                      ? t('settings.providerEndpointsDescription')
                                      : settingsView === 'image-endpoints'
                                        ? t('settings.imageEndpointsDescription')
                                        : settingsView === 'video-endpoints'
                                          ? t('settings.videoEndpointsDescription')
                                          : settingsView === 'batch-config'
                                            ? t('settings.batch.description')
                                            : settingsView === 'polish-prompts'
                                              ? t('settings.polishDescription')
                                              : settingsView === 'vision-text'
                                                ? t('settings.visionTextDescription')
                                                : settingsView === 'model-catalog'
                                                  ? t('settings.modelCatalogDescription')
                                                  : t('settings.description')}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className='min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6'>
                        {settingsView === 'providers' && (
                            <div className='space-y-4'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setSettingsView('main')}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                                    <ArrowLeft className='h-4 w-4' />
                                    返回系统配置
                                </Button>
                                <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                    {t('settings.providers.banner')}
                                </div>

                                <SettingsNavigationButton
                                    title={t('settings.providerEndpointsTitle')}
                                    description={t('settings.nav.providerEndpointsDescription')}
                                    icon={<Globe className='h-5 w-5' />}
                                    badge={statusBadge(
                                        t('settings.providers.endpointBadge', {
                                            count: String(providerEndpoints.length)
                                        }),
                                        'blue'
                                    )}
                                    onClick={() => setSettingsView('provider-endpoints')}
                                />

                                <SettingsNavigationButton
                                    title={t('settings.imageEndpointsTitle')}
                                    description={t('settings.nav.imageEndpointsDescription')}
                                    icon={<Cpu className='h-5 w-5' />}
                                    badge={statusBadge(
                                        t('settings.providers.endpointBadge', {
                                            count: String(imageProviderEndpoints.length)
                                        }),
                                        'blue'
                                    )}
                                    onClick={() => setSettingsView('image-endpoints')}
                                />

                                <SettingsNavigationButton
                                    title={t('settings.videoEndpointsTitle')}
                                    description={t('settings.nav.videoEndpointsDescription')}
                                    icon={<Radio className='h-5 w-5' />}
                                    badge={statusBadge(
                                        t('settings.providers.endpointBadge', {
                                            count: String(videoProviderEndpoints.length)
                                        }),
                                        'blue'
                                    )}
                                    onClick={() => setSettingsView('video-endpoints')}
                                />

                                <SettingsNavigationButton
                                    title={t('settings.modelCatalogTitle')}
                                    description={t('settings.modelCatalogDescription')}
                                    icon={<Sparkles className='h-5 w-5' />}
                                    badge={statusBadge(
                                        t('settings.modelCatalog.itemBadge', { count: String(modelCatalog.length) }),
                                        'blue'
                                    )}
                                    onClick={() => setSettingsView('model-catalog')}
                                />
                            </div>
                        )}

                        {settingsView === 'provider-endpoints' && (
                            <div className='space-y-4'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setSettingsView('providers')}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                                    <ArrowLeft className='h-4 w-4' />
                                    {t('settings.endpoints.backToProviders')}
                                </Button>
                                <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                    {t('settings.providerEndpoints.notice')}
                                </div>

                                <ProviderSection
                                    title={t('settings.endpoints.addTitle')}
                                    description={t('settings.endpoints.addDescription')}
                                    icon={<Plus className='h-4 w-4' />}
                                    defaultOpen>
                                    <div className='grid gap-3 md:grid-cols-[1.4fr_1fr]'>
                                        <Select
                                            value={newUnifiedProviderTemplateKey}
                                            onValueChange={setNewUnifiedProviderTemplateKey}>
                                            <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                                <SelectValue
                                                    placeholder={t('settings.endpoints.templatePlaceholder')}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {providerEndpointCategoryGroups.map((group, index) => (
                                                    <React.Fragment key={group.key}>
                                                        {index > 0 && <SelectSeparator />}
                                                        <SelectGroup>
                                                            <SelectLabel>{group.title}</SelectLabel>
                                                            {group.templates.map((template) => (
                                                                <SelectItem
                                                                    key={getProviderEndpointTemplateKey(template)}
                                                                    value={getProviderEndpointTemplateKey(template)}>
                                                                    {template.title}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectGroup>
                                                    </React.Fragment>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            value={newUnifiedProviderName}
                                            onChange={(event) => setNewUnifiedProviderName(event.target.value)}
                                            placeholder={t('settings.endpoints.namePlaceholder')}
                                            className='bg-background text-foreground h-10 rounded-xl'
                                        />
                                    </div>
                                    <div className='grid gap-3 md:grid-cols-2'>
                                        <SecretInput
                                            id='new-unified-provider-api-key'
                                            value={newUnifiedProviderApiKey}
                                            onChange={setNewUnifiedProviderApiKey}
                                            visible={newUnifiedProviderApiKeyVisible}
                                            onVisibleChange={() =>
                                                setNewUnifiedProviderApiKeyVisible((value) => !value)
                                            }
                                            placeholder='API Key'
                                        />
                                        <Input
                                            value={newUnifiedProviderApiBaseUrl}
                                            onChange={(event) => setNewUnifiedProviderApiBaseUrl(event.target.value)}
                                            placeholder={
                                                getProviderEndpointTemplateByKey(newUnifiedProviderTemplateKey)
                                                    ?.baseUrlPlaceholder || 'https://api.openai.com/v1'
                                            }
                                            className='bg-background text-foreground h-10 rounded-xl'
                                        />
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        <Button
                                            type='button'
                                            onClick={addUnifiedProviderEndpoint}
                                            className='min-h-[44px] rounded-xl bg-violet-600 text-white hover:bg-violet-500'>
                                            <Plus className='h-4 w-4' />
                                            {t('settings.endpoints.addButton')}
                                        </Button>
                                        <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
                                            {statusBadge(
                                                t('settings.endpoints.configuredCount', {
                                                    count: String(providerEndpoints.length)
                                                }),
                                                'green'
                                            )}
                                            {statusBadge(
                                                t('settings.endpoints.discoveryCount', {
                                                    count: String(
                                                        providerEndpointTemplates.filter(
                                                            (template) => template.supportedByDiscovery
                                                        ).length
                                                    )
                                                }),
                                                'blue'
                                            )}
                                        </div>
                                    </div>
                                </ProviderSection>

                                <div className='space-y-4'>
                                    {providerEndpointCategoryGroups.map((group) => (
                                        <ProviderSection
                                            key={group.key}
                                            title={group.title}
                                            description={`${group.description} · ${group.endpoints.length} ${t('settings.endpoints.countUnit')}`}
                                            icon={
                                                group.key === 'video' ? (
                                                    <Radio className='h-4 w-4' />
                                                ) : group.key === 'image' ? (
                                                    <Cpu className='h-4 w-4' />
                                                ) : (
                                                    <Sparkles className='h-4 w-4' />
                                                )
                                            }
                                            defaultOpen={group.endpoints.length > 0 || group.key === 'text'}>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                {statusBadge(
                                                    t('settings.endpoints.configuredCount', {
                                                        count: String(group.endpoints.length)
                                                    }),
                                                    group.endpoints.length > 0 ? 'green' : 'amber'
                                                )}
                                                {statusBadge(
                                                    t('settings.endpoints.discoveryCount', {
                                                        count: String(
                                                            group.templates.filter((template) =>
                                                                supportsProviderModelDiscovery(template.protocol)
                                                            ).length
                                                        )
                                                    }),
                                                    'blue'
                                                )}
                                            </div>
                                            {group.endpoints.length === 0 ? (
                                                <p className='text-muted-foreground border-border bg-background/60 rounded-xl border border-dashed p-3 text-xs'>
                                                    {t('settings.endpoints.emptyGroup')}
                                                </p>
                                            ) : (
                                                <div className='space-y-3'>
                                                    {group.endpoints.map((endpoint) => {
                                                        const matchingProviderInstance = endpoint.legacyImageProvider
                                                            ? providerInstances.find(
                                                                  (instance) => instance.id === endpoint.id
                                                              )
                                                            : undefined;
                                                        const endpointEntries = modelCatalog.filter(
                                                            (entry) => entry.providerEndpointId === endpoint.id
                                                        );
                                                        const selectedModelCount = endpoint.legacyImageProvider
                                                            ? matchingProviderInstance?.models.length ||
                                                              endpoint.modelIds?.length ||
                                                              endpointEntries.length
                                                            : (endpoint.modelIds?.length ?? 0);
                                                        const removeDisabled = matchingProviderInstance
                                                            ? providerInstances.filter(
                                                                  (instance) =>
                                                                      instance.type === matchingProviderInstance.type
                                                              ).length <= 1
                                                            : false;
                                                        const hasTextModel = endpointEntries.some((entry) =>
                                                            entry.capabilities.tasks.some(
                                                                (task) =>
                                                                    task === 'text.generate' ||
                                                                    task === 'prompt.polish' ||
                                                                    task === 'prompt.batchPlan'
                                                            )
                                                        );
                                                        const hasImageModel = endpointEntries.some((entry) =>
                                                            entry.capabilities.tasks.some((task) =>
                                                                task.startsWith('image.')
                                                            )
                                                        );
                                                        const hasVideoModel = endpointEntries.some(
                                                            (entry) =>
                                                                entry.capabilities.tasks.some((task) =>
                                                                    task.startsWith('video.')
                                                                ) && !isPendingVideoPlaceholderEntry(entry)
                                                        );
                                                        const capabilityBadge =
                                                            group.key === 'text'
                                                                ? hasTextModel
                                                                    ? statusBadge(
                                                                          t('settings.endpoints.textReady'),
                                                                          'green'
                                                                      )
                                                                    : statusBadge(
                                                                          t('settings.endpoints.needsModels'),
                                                                          'amber'
                                                                      )
                                                                : group.key === 'image'
                                                                  ? hasImageModel
                                                                      ? statusBadge(
                                                                            t('settings.endpoints.imageReady'),
                                                                            'green'
                                                                        )
                                                                      : statusBadge(
                                                                            t('settings.endpoints.needsModels'),
                                                                            'amber'
                                                                        )
                                                                  : hasVideoModel
                                                                    ? statusBadge(
                                                                          t('settings.endpoints.videoReady'),
                                                                          'green'
                                                                      )
                                                                    : statusBadge(
                                                                          t('settings.endpoints.needsModels'),
                                                                          'amber'
                                                                      );
                                                        return renderProviderEndpointCard(endpoint, {
                                                            selectedModelCount,
                                                            totalModelCount: endpointEntries.length,
                                                            removeDisabled,
                                                            badges: (
                                                                <>
                                                                    {capabilityBadge}
                                                                    {endpoint.enabled === false
                                                                        ? statusBadge(
                                                                              t(
                                                                                  'settings.modelCatalog.status.disabled'
                                                                              ),
                                                                              'amber'
                                                                          )
                                                                        : null}
                                                                </>
                                                            )
                                                        });
                                                    })}
                                                </div>
                                            )}
                                        </ProviderSection>
                                    ))}
                                </div>
                            </div>
                        )}

                        {settingsView === 'batch-config' && (
                            <div className='space-y-4'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setSettingsView('main')}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                                    <ArrowLeft className='h-4 w-4' />
                                    {t('settings.backToMain')}
                                </Button>

                                <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                    {t('settings.batch.banner')}
                                </div>

                                <ProviderSection
                                    title={t('settings.batch.model.title')}
                                    description={t('settings.batch.model.description')}
                                    icon={<Settings className='h-4 w-4' />}
                                    defaultOpen>
                                    <div className='space-y-3'>
                                        {!hasPromptPolishCompatibleEndpoints && (
                                            <div className='border-border bg-muted/30 flex flex-col gap-3 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
                                                <div className='min-w-0 space-y-1'>
                                                    <p className='text-foreground font-medium'>
                                                        {t('settings.modelBinding.noEligibleEndpointsTitle')}
                                                    </p>
                                                    <p className='text-muted-foreground text-xs leading-5'>
                                                        {t('settings.modelBinding.noEligibleEndpointsDescription')}
                                                    </p>
                                                </div>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={handleAddPromptBindingEndpoint}
                                                    className='min-h-[40px] shrink-0 rounded-xl'>
                                                    <Plus className='h-4 w-4' />
                                                    {t('settings.polish.addEndpoint')}
                                                </Button>
                                            </div>
                                        )}
                                        <ProviderEndpointModelBindingPicker
                                            task='prompt.batchPlan'
                                            title={t('settings.batch.model.pickerTitle')}
                                            description={t('settings.batch.model.pickerDescription')}
                                            allowedCompatibilityFamilies={BATCH_MODEL_BINDING_COMPATIBILITY_FAMILIES}
                                            providerEndpoints={providerEndpoints}
                                            modelCatalog={modelCatalog}
                                            modelTaskDefaultCatalogEntryIds={modelTaskDefaultCatalogEntryIds}
                                            selectedEndpointId={batchModelEndpointId}
                                            showEmptyState={false}
                                            onSelectedEndpointIdChange={(value) => {
                                                setPromptModelSelectionEndpointIds((current) => ({
                                                    ...current,
                                                    'prompt.batchPlan': value
                                                }));
                                                setModelTaskDefaultCatalogEntryIds((current) => {
                                                    const next = { ...current };
                                                    delete next['prompt.batchPlan'];
                                                    return next;
                                                });
                                            }}
                                            onChooseModel={(endpoint) =>
                                                openTaskBindingModelManager('prompt.batchPlan', endpoint)
                                            }
                                            onManageEndpoint={handleManagePromptBindingEndpoint}
                                            onAddEndpoint={handleAddPromptBindingEndpoint}
                                            t={t}
                                        />
                                        <p className='text-muted-foreground text-xs leading-5'>
                                            {t('settings.batch.model.note')}
                                        </p>
                                    </div>
                                </ProviderSection>

                                <ProviderSection
                                    title={t('settings.batch.strategy.title')}
                                    description={t('settings.batch.strategy.description')}
                                    icon={<Layers3 className='h-4 w-4' />}
                                    defaultOpen>
                                    <div className='space-y-4'>
                                        <div className='space-y-2'>
                                            <Label className='text-muted-foreground text-xs'>
                                                {t('settings.batch.strategy.default')}
                                            </Label>
                                            <Select
                                                value={batchFeature.defaultStrategyId}
                                                onValueChange={(value) => {
                                                    const nextId = value as BatchPlanningStrategyId;
                                                    updateBatchFeature((current) => ({
                                                        ...current,
                                                        defaultStrategyId: nextId
                                                    }));
                                                }}>
                                                <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {batchFeature.strategies
                                                        .filter((strategy) => strategy.enabled)
                                                        .map((strategy) => (
                                                            <SelectItem key={strategy.id} value={strategy.id}>
                                                                {t(batchStrategyLabelKey(strategy.id))}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className='grid gap-2 sm:grid-cols-2'>
                                            {batchFeature.strategies.map((strategy) => {
                                                const isCoreAuto = strategy.id === 'auto';
                                                const checked = strategy.enabled || isCoreAuto;
                                                return (
                                                    <label
                                                        key={strategy.id}
                                                        htmlFor={`batch-strategy-${strategy.id}`}
                                                        className='border-border/70 bg-background/70 flex min-h-[92px] cursor-pointer gap-3 rounded-xl border p-3'>
                                                        <Checkbox
                                                            id={`batch-strategy-${strategy.id}`}
                                                            checked={checked}
                                                            disabled={isCoreAuto}
                                                            onCheckedChange={(value) => {
                                                                const enabled = value === true;
                                                                updateBatchFeature((current) => {
                                                                    const strategies = current.strategies.map((item) =>
                                                                        item.id === strategy.id
                                                                            ? {
                                                                                  ...item,
                                                                                  enabled: isCoreAuto || enabled
                                                                              }
                                                                            : item
                                                                    );
                                                                    const defaultStrategyId =
                                                                        current.defaultStrategyId === strategy.id &&
                                                                        !enabled
                                                                            ? 'auto'
                                                                            : current.defaultStrategyId;
                                                                    return {
                                                                        ...current,
                                                                        strategies,
                                                                        defaultStrategyId
                                                                    };
                                                                });
                                                            }}
                                                            className='mt-0.5'
                                                        />
                                                        <span className='min-w-0 space-y-1'>
                                                            <span className='text-foreground block text-sm font-medium'>
                                                                {t(batchStrategyLabelKey(strategy.id))}
                                                            </span>
                                                            <span className='text-muted-foreground block text-xs leading-5'>
                                                                {t(strategy.descriptionKey)}
                                                            </span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </ProviderSection>

                                <ProviderSection
                                    title={t('settings.batch.prompt.title')}
                                    description={t('settings.batch.prompt.description')}
                                    icon={<Sparkles className='h-4 w-4' />}
                                    defaultOpen>
                                    <div className='space-y-3'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            {statusBadge(
                                                batchPlanPromptIsCustom
                                                    ? t('settings.batch.prompt.customBadge')
                                                    : t('settings.batch.prompt.defaultBadge'),
                                                batchPlanPromptIsCustom ? 'green' : 'blue'
                                            )}
                                            {statusBadge(t('settings.batch.prompt.contractBadge'), 'blue')}
                                        </div>
                                        <pre
                                            className='border-border bg-background/70 text-muted-foreground max-h-48 overflow-y-auto rounded-xl border p-3 text-xs leading-5 whitespace-pre-wrap'
                                            data-i18n-skip='true'>
                                            {getBatchPlanningSystemPrompt(batchFeature, 'auto')}
                                        </pre>
                                        {batchPromptEditorOpen ? (
                                            <div className='space-y-3'>
                                                <Textarea
                                                    value={batchPromptDraft}
                                                    onChange={(event) => setBatchPromptDraft(event.target.value)}
                                                    className='bg-background text-foreground min-h-56 rounded-xl text-sm leading-5'
                                                    data-i18n-skip='true'
                                                />
                                                <div className='flex flex-wrap gap-2'>
                                                    <Button
                                                        type='button'
                                                        onClick={() => {
                                                            const customPrompt = batchPromptDraft.trim();
                                                            updateBatchAutoPromptTemplate((template) => ({
                                                                ...template,
                                                                ...(customPrompt &&
                                                                customPrompt !== template.builtInPrompt
                                                                    ? { customPrompt, updatedAt: Date.now() }
                                                                    : { customPrompt: undefined, updatedAt: undefined })
                                                            }));
                                                            setBatchPromptEditorOpen(false);
                                                        }}
                                                        className='min-h-[40px] rounded-xl bg-violet-600 text-white hover:bg-violet-500'>
                                                        {t('common.save')}
                                                    </Button>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        onClick={() => {
                                                            setBatchPromptDraft(
                                                                getBatchPlanningSystemPrompt(batchFeature, 'auto')
                                                            );
                                                            setBatchPromptEditorOpen(false);
                                                        }}
                                                        className='min-h-[40px] rounded-xl'>
                                                        {t('common.cancel')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className='flex flex-wrap gap-2'>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={() => {
                                                        setBatchPromptDraft(
                                                            getBatchPlanningSystemPrompt(batchFeature, 'auto')
                                                        );
                                                        setBatchPromptEditorOpen(true);
                                                    }}
                                                    className='min-h-[40px] rounded-xl'>
                                                    {t('settings.batch.prompt.edit')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={copyBatchAutoPrompt}
                                                    className='min-h-[40px] rounded-xl'>
                                                    {t('settings.batch.prompt.copy')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    onClick={() => {
                                                        updateBatchAutoPromptTemplate((template) => ({
                                                            ...template,
                                                            customPrompt: undefined,
                                                            updatedAt: undefined
                                                        }));
                                                        setBatchPromptDraft(DEFAULT_BATCH_PLAN_SYSTEM_PROMPT);
                                                    }}
                                                    disabled={!batchPlanPromptIsCustom}
                                                    className='min-h-[40px] rounded-xl'>
                                                    {t('settings.batch.prompt.restore')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </ProviderSection>

                                <ProviderSection
                                    title={t('settings.batch.parameterPolish.title')}
                                    description={t('settings.batch.parameterPolish.description')}
                                    icon={<SlidersHorizontal className='h-4 w-4' />}>
                                    <div className='space-y-3'>
                                        <label className='border-border/70 bg-muted/20 flex items-start gap-3 rounded-xl border p-3'>
                                            <Checkbox
                                                checked={batchFeature.parameterPolish.enabled}
                                                onCheckedChange={(value) =>
                                                    updateBatchParameterPolish({ enabled: value === true })
                                                }
                                                className='mt-0.5'
                                            />
                                            <span className='min-w-0 space-y-1'>
                                                <span className='text-foreground block text-sm font-medium'>
                                                    {t('settings.batch.parameterPolish.enabled')}
                                                </span>
                                                <span className='text-muted-foreground block text-xs leading-5'>
                                                    {t('settings.batch.parameterPolish.enabledDescription')}
                                                </span>
                                            </span>
                                        </label>
                                        <div className='grid gap-3 sm:grid-cols-2'>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.batch.parameterPolish.scope')}
                                                </Label>
                                                <Select
                                                    value={batchFeature.parameterPolish.scope}
                                                    onValueChange={(value) =>
                                                        updateBatchParameterPolish({
                                                            scope:
                                                                value === 'task-prompts-and-negative-prompts'
                                                                    ? 'task-prompts-and-negative-prompts'
                                                                    : 'task-prompts'
                                                        })
                                                    }
                                                    disabled={!batchFeature.parameterPolish.enabled}>
                                                    <SelectTrigger className='bg-background text-foreground h-10 rounded-xl disabled:cursor-not-allowed disabled:opacity-50'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='task-prompts'>
                                                            {t('settings.batch.parameterPolish.scopePrompts')}
                                                        </SelectItem>
                                                        <SelectItem value='task-prompts-and-negative-prompts'>
                                                            {t(
                                                                'settings.batch.parameterPolish.scopePromptsAndNegative'
                                                            )}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.batch.parameterPolish.intensity')}
                                                </Label>
                                                <Select
                                                    value={batchFeature.parameterPolish.intensity}
                                                    onValueChange={(value) =>
                                                        updateBatchParameterPolish({
                                                            intensity: value === 'standard' ? 'standard' : 'light'
                                                        })
                                                    }
                                                    disabled={!batchFeature.parameterPolish.enabled}>
                                                    <SelectTrigger className='bg-background text-foreground h-10 rounded-xl disabled:cursor-not-allowed disabled:opacity-50'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='light'>
                                                            {t('settings.batch.parameterPolish.light')}
                                                        </SelectItem>
                                                        <SelectItem value='standard'>
                                                            {t('settings.batch.parameterPolish.standard')}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <p className='text-muted-foreground text-xs leading-5'>
                                            {t('settings.batch.parameterPolish.p0Note')}
                                        </p>
                                    </div>
                                </ProviderSection>

                                <ProviderSection
                                    title={t('settings.batch.safety.title')}
                                    description={t('settings.batch.safety.description')}
                                    icon={<AlertTriangle className='h-4 w-4' />}>
                                    <div className='grid gap-3 sm:grid-cols-2'>
                                        <div className='space-y-2'>
                                            <Label
                                                htmlFor='batch-max-auto-count'
                                                className='text-muted-foreground text-xs'>
                                                {t('settings.batch.safety.maxAuto')}
                                            </Label>
                                            <Input
                                                id='batch-max-auto-count'
                                                type='number'
                                                min={1}
                                                max={30}
                                                value={batchFeature.maxAutoTaskCount}
                                                onChange={(event) =>
                                                    updateBatchFeature((current) => ({
                                                        ...current,
                                                        maxAutoTaskCount: Number(event.target.value)
                                                    }))
                                                }
                                                className='bg-background text-foreground h-10 rounded-xl'
                                            />
                                        </div>
                                        <div className='space-y-2'>
                                            <Label
                                                htmlFor='batch-fixed-count'
                                                className='text-muted-foreground text-xs'>
                                                {t('settings.batch.safety.defaultFixed')}
                                            </Label>
                                            <Input
                                                id='batch-fixed-count'
                                                type='number'
                                                min={1}
                                                max={30}
                                                value={batchFeature.defaultFixedTaskCount}
                                                onChange={(event) =>
                                                    updateBatchFeature((current) => ({
                                                        ...current,
                                                        defaultFixedTaskCount: Number(event.target.value)
                                                    }))
                                                }
                                                className='bg-background text-foreground h-10 rounded-xl'
                                            />
                                        </div>
                                        <div className='space-y-2'>
                                            <Label
                                                htmlFor='batch-confirm-threshold'
                                                className='text-muted-foreground text-xs'>
                                                {t('settings.batch.safety.confirmThreshold')}
                                            </Label>
                                            <Input
                                                id='batch-confirm-threshold'
                                                type='number'
                                                min={1}
                                                max={30}
                                                value={batchFeature.confirmLargeBatchThreshold}
                                                onChange={(event) =>
                                                    updateBatchFeature((current) => ({
                                                        ...current,
                                                        confirmLargeBatchThreshold: Number(event.target.value)
                                                    }))
                                                }
                                                className='bg-background text-foreground h-10 rounded-xl'
                                            />
                                        </div>
                                        <div className='space-y-2'>
                                            <Label
                                                htmlFor='batch-preview-max-count'
                                                className='text-muted-foreground text-xs'>
                                                {t('settings.batch.safety.maxPreview')}
                                            </Label>
                                            <Input
                                                id='batch-preview-max-count'
                                                type='number'
                                                min={1}
                                                max={30}
                                                value={batchFeature.maxPreviewTaskCount}
                                                onChange={(event) =>
                                                    updateBatchFeature((current) => ({
                                                        ...current,
                                                        maxPreviewTaskCount: Number(event.target.value)
                                                    }))
                                                }
                                                className='bg-background text-foreground h-10 rounded-xl'
                                            />
                                        </div>
                                    </div>
                                </ProviderSection>
                            </div>
                        )}

                        {settingsView === 'image-endpoints' && (
                            <div className='space-y-4'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setSettingsView('providers')}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                                    <ArrowLeft className='h-4 w-4' />
                                    {t('settings.endpoints.backToProviders')}
                                </Button>
                                <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                    {t('settings.imageEndpoints.notice')}
                                </div>

                                <div className='flex flex-wrap gap-2'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        onClick={() => {
                                            setNewUnifiedProviderTemplateKey(
                                                getProviderEndpointTemplateKey(IMAGE_PROVIDER_ENDPOINT_TEMPLATES[0])
                                            );
                                            setSettingsView('provider-endpoints');
                                        }}
                                        className='min-h-[44px] rounded-xl'>
                                        <Plus className='h-4 w-4' />
                                        {t('settings.endpoints.addButton')}
                                    </Button>
                                    {statusBadge(
                                        t('settings.providers.endpointBadge', {
                                            count: String(imageProviderEndpoints.length)
                                        }),
                                        'blue'
                                    )}
                                </div>

                                <div className='space-y-3'>
                                    {IMAGE_PROVIDER_ORDER.map((provider) => {
                                        const instances = providerInstances.filter(
                                            (instance) => instance.type === provider
                                        );
                                        const template = IMAGE_PROVIDER_ENDPOINT_TEMPLATES.find(
                                            (item) => item.legacyImageProvider === provider
                                        );
                                        const title = template?.title || getProviderLabel(provider);
                                        const description = template?.descriptionKey
                                            ? t(template.descriptionKey)
                                            : getProviderLabel(provider);
                                        return (
                                            <ProviderSection
                                                key={provider}
                                                title={title}
                                                description={`${description} · ${instances.length} ${t('settings.endpoints.countUnit')}`}
                                                icon={<Cpu className='h-4 w-4' />}
                                                defaultOpen={provider === 'openai'}>
                                                <div className='space-y-3'>
                                                    {instances.map((instance) => {
                                                        const endpoint = providerEndpoints.find(
                                                            (item) => item.id === instance.id
                                                        );
                                                        if (!endpoint) return null;
                                                        const allModels = getAllImageModels(customImageModels).filter(
                                                            (model) => {
                                                                if (model.provider !== instance.type) return false;
                                                                if (!model.custom || !model.instanceId) return true;
                                                                return model.instanceId === instance.id;
                                                            }
                                                        );
                                                        const selectedModelIds = new Set(
                                                            instance.models.length > 0
                                                                ? instance.models
                                                                : allModels.map((model) => model.id)
                                                        );
                                                        const catalogModelCount = modelCatalog.filter(
                                                            (entry) => entry.providerEndpointId === instance.id
                                                        ).length;
                                                        return renderProviderEndpointCard(endpoint, {
                                                            selectedModelCount: selectedModelIds.size,
                                                            totalModelCount: Math.max(
                                                                allModels.length,
                                                                catalogModelCount
                                                            ),
                                                            removeDisabled: instances.length <= 1,
                                                            summaryDescription: t(
                                                                'settings.modelManager.imageSummaryDescription'
                                                            ),
                                                            badges: (
                                                                <>
                                                                    {instance.isDefault
                                                                        ? statusBadge('默认', 'green')
                                                                        : statusBadge('可切换', 'blue')}
                                                                    {selectedProviderInstanceId === instance.id &&
                                                                        statusBadge('当前选择', 'amber')}
                                                                </>
                                                            ),
                                                            extraActions: (
                                                                <>
                                                                    {!instance.isDefault && (
                                                                        <Button
                                                                            type='button'
                                                                            variant='outline'
                                                                            size='sm'
                                                                            onClick={() =>
                                                                                setProviderInstanceDefault(instance.id)
                                                                            }
                                                                            className='min-h-[36px] rounded-xl'>
                                                                            设为默认
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        type='button'
                                                                        variant='outline'
                                                                        size='sm'
                                                                        onClick={() =>
                                                                            setSelectedProviderInstanceId(instance.id)
                                                                        }
                                                                        className='min-h-[36px] rounded-xl'>
                                                                        选择
                                                                    </Button>
                                                                </>
                                                            )
                                                        });
                                                    })}
                                                </div>
                                            </ProviderSection>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {settingsView === 'main' && (
                            <>
                                <SettingsNavigationButton
                                    title={t('settings.providersTitle')}
                                    description={t('settings.nav.providersDescription')}
                                    icon={<Globe className='h-5 w-5' />}
                                    badge={statusBadge(
                                        t('settings.providers.endpointBadge', {
                                            count: String(providerEndpoints.length)
                                        }),
                                        'blue'
                                    )}
                                    onClick={() => setSettingsView('providers')}
                                />

                                <SettingsNavigationButton
                                    title={t('settings.visionTextTitle')}
                                    description={t('settings.nav.visionTextDescription')}
                                    icon={<ScanEye className='h-5 w-5' />}
                                    onClick={() => setSettingsView('vision-text')}
                                />

                                <SettingsNavigationButton
                                    title={t('settings.polishTitle')}
                                    description={t('settings.nav.polishDescription')}
                                    icon={<Sparkles className='h-5 w-5' />}
                                    badge={
                                        polishingCustomPrompts.length > 0
                                            ? statusBadge(
                                                  t('settings.polish.customPromptBadge', {
                                                      count: String(polishingCustomPrompts.length)
                                                  }),
                                                  'green'
                                              )
                                            : statusBadge(t('settings.polish.noCustomPromptBadge'), 'amber')
                                    }
                                    onClick={() => setSettingsView('polish-prompts')}
                                />

                                <SettingsNavigationButton
                                    title={t('settings.batch.title')}
                                    description={t('settings.nav.batchDescription')}
                                    icon={<Layers3 className='h-5 w-5' />}
                                    badge={statusBadge(
                                        t(batchStrategyLabelKey(batchFeature.defaultStrategyId)),
                                        'blue'
                                    )}
                                    onClick={() => setSettingsView('batch-config')}
                                />

                                <ProviderSection
                                    title={t('settings.general.title')}
                                    description={t('settings.general.description')}
                                    icon={<Settings className='h-4 w-4' />}>
                                    <div className='space-y-3'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <Label htmlFor='app-language' className='flex items-center gap-2'>
                                                <Globe className='text-muted-foreground h-4 w-4' />
                                                {t('settings.language.label')}
                                            </Label>
                                            {statusBadge(t('settings.language.statusSaved'), 'green')}
                                        </div>
                                        <Select value={appLanguage} onValueChange={handleLanguageChange}>
                                            <SelectTrigger
                                                id='app-language'
                                                className='bg-background text-foreground h-10 w-full rounded-xl'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {languageOptions.map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        {language === 'en-US'
                                                            ? APP_LANGUAGE_LABELS[option].english
                                                            : APP_LANGUAGE_LABELS[option].native}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className='text-muted-foreground text-xs'>
                                            {t('settings.language.description')}
                                        </p>
                                    </div>

                                    <div className='space-y-3'>
                                        <div className='space-y-1'>
                                            <Label className='flex items-center gap-2'>
                                                <SlidersHorizontal className='text-muted-foreground h-4 w-4' />
                                                {t('settings.promptToolbar.title')}
                                            </Label>
                                            <p className='text-muted-foreground text-xs leading-5'>
                                                {t('settings.promptToolbar.description')}
                                            </p>
                                        </div>
                                        <div className='grid gap-2 sm:grid-cols-2'>
                                            {PROMPT_TOOLBAR_BUTTON_OPTIONS.map((option) => {
                                                const checked = !hiddenPromptToolbarButtons.includes(option.key);
                                                return (
                                                    <label
                                                        key={option.key}
                                                        htmlFor={`prompt-toolbar-button-${option.key}`}
                                                        className='border-border/70 bg-muted/20 flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm'>
                                                        <Checkbox
                                                            id={`prompt-toolbar-button-${option.key}`}
                                                            checked={checked}
                                                            onCheckedChange={(value) =>
                                                                handlePromptToolbarButtonVisibilityChange(
                                                                    option.key,
                                                                    value === true
                                                                )
                                                            }
                                                        />
                                                        <span className='text-foreground min-w-0 truncate'>
                                                            {t(option.labelKey)}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </ProviderSection>

                                <ProviderSection
                                    title='运行与存储'
                                    description='配置 API 连接、并发任务数量和图片存储模式。'
                                    icon={<Settings className='h-4 w-4' />}>
                                    <div className='space-y-3'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <Label className='flex items-center gap-2'>
                                                <Radio className='text-muted-foreground h-4 w-4' />
                                                API 连接模式
                                            </Label>
                                            {statusBadge(
                                                connectionMode === 'proxy' ? '服务器中转' : '客户端直连',
                                                connectionMode === 'proxy' ? 'green' : 'amber'
                                            )}
                                        </div>
                                        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    if (!directLinkRestriction) setConnectionMode('proxy');
                                                }}
                                                disabled={!!directLinkRestriction}
                                                aria-pressed={connectionMode === 'proxy'}
                                                className={`focus-visible:ring-ring/50 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${connectionMode === 'proxy' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                <Wifi className='h-4 w-4' />
                                                服务器中转
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() => setConnectionMode('direct')}
                                                aria-pressed={connectionMode === 'direct'}
                                                className={`focus-visible:ring-ring/50 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none ${connectionMode === 'direct' ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                <Wifi className='h-4 w-4 rotate-45' />
                                                客户端直连
                                            </button>
                                        </div>
                                        {directLinkRestriction && (
                                            <div className='rounded-xl border border-sky-500/25 bg-sky-500/10 p-3'>
                                                <div className='flex gap-2'>
                                                    <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300' />
                                                    <div className='space-y-1 text-xs text-sky-800 dark:text-sky-200/90'>
                                                        <p className='font-medium'>已锁定客户端直连</p>
                                                        <p>{directLinkRestrictionMessage}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {connectionMode === 'direct' ? (
                                            <div className='rounded-xl border border-amber-500/25 bg-amber-500/10 p-3'>
                                                <div className='flex gap-2'>
                                                    <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300' />
                                                    <div className='space-y-1 text-xs text-amber-800 dark:text-amber-200/90'>
                                                        <p className='font-medium'>直连模式注意事项</p>
                                                        <ul className='list-inside list-disc space-y-0.5 text-amber-800/80 dark:text-amber-200/75'>
                                                            <li>
                                                                浏览器会直接访问供应商或中转服务，API Key 会在 Network
                                                                面板可见。
                                                            </li>
                                                            <li>
                                                                OpenAI 兼容端点通常需要 CORS 支持；Google Gemini
                                                                可使用官方 REST 端点。
                                                            </li>
                                                            <li>
                                                                {serverHasAppPassword
                                                                    ? '服务器配置了 APP_PASSWORD，直连模式将绕过密码验证。'
                                                                    : '直连模式不经过服务器，不会触发 APP_PASSWORD 验证。'}
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className='text-muted-foreground text-xs'>
                                                请求经服务器转发，API Key 不在浏览器暴露，更安全。
                                            </p>
                                        )}
                                    </div>

                                    <div className='space-y-3'>
                                        <div className='flex items-center gap-2'>
                                            <Label htmlFor='max-concurrent-tasks' className='flex items-center gap-2'>
                                                <Cpu className='text-muted-foreground h-4 w-4' />
                                                并发任务数
                                            </Label>
                                            <span className='inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300'>
                                                {maxConcurrentTasks}
                                            </span>
                                        </div>
                                        <div className='flex items-center gap-4'>
                                            <input
                                                id='max-concurrent-tasks'
                                                type='range'
                                                min='1'
                                                max='10'
                                                value={maxConcurrentTasks}
                                                onChange={(event) =>
                                                    setMaxConcurrentTasks(parseInt(event.target.value, 10))
                                                }
                                                className='bg-muted h-2 flex-1 appearance-none rounded-full accent-violet-600'
                                            />
                                            <span className='text-muted-foreground w-8 text-right font-mono text-sm tabular-nums'>
                                                {maxConcurrentTasks}
                                            </span>
                                        </div>
                                        <p className='text-muted-foreground text-xs'>
                                            同时执行的 API 请求数量，值越大效率越高但更容易触发速率限制。
                                        </p>
                                    </div>

                                    <div className='space-y-3'>
                                        <div className='flex items-center gap-2'>
                                            <Label htmlFor='prompt-history-limit' className='flex items-center gap-2'>
                                                <History className='text-muted-foreground h-4 w-4' />
                                                提示词历史数量
                                            </Label>
                                            <span className='inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300'>
                                                {promptHistoryLimit}
                                            </span>
                                        </div>
                                        <div className='flex items-center gap-4'>
                                            <input
                                                id='prompt-history-limit'
                                                type='range'
                                                min='1'
                                                max='100'
                                                value={promptHistoryLimit}
                                                onChange={(event) =>
                                                    setPromptHistoryLimit(
                                                        normalizePromptHistoryLimit(event.target.value)
                                                    )
                                                }
                                                className='bg-muted h-2 flex-1 appearance-none rounded-full accent-violet-600'
                                            />
                                            <span className='text-muted-foreground w-10 text-right font-mono text-sm tabular-nums'>
                                                {promptHistoryLimit}
                                            </span>
                                        </div>
                                        <p className='text-muted-foreground text-xs'>
                                            记录最近使用的提示词，默认保留 20 条，方便从输入框下方快速找回。
                                        </p>
                                    </div>

                                    <div className='space-y-3'>
                                        <div className='space-y-1'>
                                            <Label className='flex items-center gap-2'>
                                                <Cloud className='text-muted-foreground h-4 w-4' />
                                                {t('settings.video.title')}
                                            </Label>
                                            <p className='text-muted-foreground text-xs leading-5'>
                                                {t('settings.video.description')}
                                            </p>
                                        </div>
                                        <ProviderSection
                                            title={t('settings.taskDefaults.title')}
                                            description={t('settings.taskDefaults.description')}
                                            icon={<Settings className='h-4 w-4' />}
                                            defaultOpen>
                                            <div className='grid gap-3 sm:grid-cols-2'>
                                                {videoTaskDefaultRows.map((row) => {
                                                    const entries = getModelCatalogEntriesForTask(
                                                        unifiedModelCatalogConfig,
                                                        row.task
                                                    );
                                                    const selectedEntry =
                                                        findModelCatalogEntry(unifiedModelCatalogConfig, {
                                                            catalogEntryId: modelTaskDefaultCatalogEntryIds[row.task]
                                                        }) ||
                                                        resolveDefaultModelCatalogEntry(
                                                            unifiedModelCatalogConfig,
                                                            row.task
                                                        );
                                                    const selectedEndpointId = selectedEntry?.providerEndpointId || '';
                                                    return (
                                                        <div key={row.task} className='space-y-2'>
                                                            <Label className='text-muted-foreground text-xs'>
                                                                {t(row.titleKey)}
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    selectedEntry?.id ||
                                                                    modelTaskDefaultCatalogEntryIds[row.task] ||
                                                                    ''
                                                                }
                                                                onValueChange={(value) => {
                                                                    const entry = findModelCatalogEntry(
                                                                        unifiedModelCatalogConfig,
                                                                        { catalogEntryId: value }
                                                                    );
                                                                    if (!entry) return;
                                                                    setModelTaskDefaultCatalogEntryIds((current) => ({
                                                                        ...current,
                                                                        [row.task]: entry.id
                                                                    }));
                                                                    if (row.task === 'vision.text') {
                                                                        setSelectedVisionTextProviderInstanceId(
                                                                            entry.providerEndpointId
                                                                        );
                                                                        setVisionTextModelId(entry.rawModelId);
                                                                    }
                                                                }}>
                                                                <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                                                    <SelectValue
                                                                        placeholder={
                                                                            entries.length > 0
                                                                                ? t(
                                                                                      'settings.modelCatalog.selectPlaceholder.chooseAvailable'
                                                                                  )
                                                                                : t(
                                                                                      'settings.modelCatalog.selectPlaceholder.refresh'
                                                                                  )
                                                                        }
                                                                    />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {entries.map((entry) => {
                                                                        const endpoint = modelCatalogEndpointById.get(
                                                                            entry.providerEndpointId
                                                                        );
                                                                        return (
                                                                            <SelectItem key={entry.id} value={entry.id}>
                                                                                {getCatalogEntryLabel(entry, endpoint)}
                                                                                <span className='text-muted-foreground ml-2 text-xs'>
                                                                                    {entry.capabilityConfidence ===
                                                                                    'low'
                                                                                        ? t(
                                                                                              'settings.modelCatalog.status.unclassified'
                                                                                          )
                                                                                        : isPendingVideoPlaceholderEntry(
                                                                                                entry
                                                                                            )
                                                                                          ? t(
                                                                                                'settings.modelCatalog.status.pendingAdapter'
                                                                                            )
                                                                                          : t(
                                                                                                'settings.modelCatalog.status.discovered'
                                                                                            )}
                                                                                </span>
                                                                            </SelectItem>
                                                                        );
                                                                    })}
                                                                </SelectContent>
                                                            </Select>
                                                            <p className='text-muted-foreground text-xs'>
                                                                {t(row.descriptionKey)}
                                                                {selectedEndpointId
                                                                    ? ` · ${t('settings.taskDefaults.currentEndpoint', { id: selectedEndpointId })}`
                                                                    : ''}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </ProviderSection>
                                        <div className='grid gap-3 sm:grid-cols-2'>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.video.pollingIntervalSeconds.label')}
                                                </Label>
                                                <div className='flex items-center gap-4'>
                                                    <input
                                                        type='range'
                                                        min='1'
                                                        max='30'
                                                        value={videoTaskDefaults.pollingIntervalSeconds}
                                                        onChange={(event) =>
                                                            setVideoTaskDefaults((current) => ({
                                                                ...current,
                                                                pollingIntervalSeconds: Math.max(
                                                                    1,
                                                                    parseInt(event.target.value, 10) || 1
                                                                )
                                                            }))
                                                        }
                                                        className='bg-muted h-2 flex-1 appearance-none rounded-full accent-violet-600'
                                                    />
                                                    <span className='text-muted-foreground w-10 text-right font-mono text-sm tabular-nums'>
                                                        {videoTaskDefaults.pollingIntervalSeconds}
                                                    </span>
                                                </div>
                                                <p className='text-muted-foreground text-xs'>
                                                    {t('settings.video.pollingIntervalSeconds.description')}
                                                </p>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.video.pollingTimeoutMinutes.label')}
                                                </Label>
                                                <div className='flex items-center gap-4'>
                                                    <input
                                                        type='range'
                                                        min='1'
                                                        max='180'
                                                        value={videoTaskDefaults.pollingTimeoutMinutes}
                                                        onChange={(event) =>
                                                            setVideoTaskDefaults((current) => ({
                                                                ...current,
                                                                pollingTimeoutMinutes: Math.max(
                                                                    1,
                                                                    parseInt(event.target.value, 10) || 1
                                                                )
                                                            }))
                                                        }
                                                        className='bg-muted h-2 flex-1 appearance-none rounded-full accent-violet-600'
                                                    />
                                                    <span className='text-muted-foreground w-10 text-right font-mono text-sm tabular-nums'>
                                                        {videoTaskDefaults.pollingTimeoutMinutes}
                                                    </span>
                                                </div>
                                                <p className='text-muted-foreground text-xs'>
                                                    {t('settings.video.pollingTimeoutMinutes.description')}
                                                </p>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.video.maxRetries.label')}
                                                </Label>
                                                <div className='flex items-center gap-4'>
                                                    <input
                                                        type='range'
                                                        min='0'
                                                        max='5'
                                                        value={videoTaskDefaults.maxFailureRetries}
                                                        onChange={(event) =>
                                                            setVideoTaskDefaults((current) => ({
                                                                ...current,
                                                                maxFailureRetries: Math.max(
                                                                    0,
                                                                    parseInt(event.target.value, 10) || 0
                                                                )
                                                            }))
                                                        }
                                                        className='bg-muted h-2 flex-1 appearance-none rounded-full accent-violet-600'
                                                    />
                                                    <span className='text-muted-foreground w-10 text-right font-mono text-sm tabular-nums'>
                                                        {videoTaskDefaults.maxFailureRetries}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.video.defaultDuration.label')}
                                                </Label>
                                                <Input
                                                    type='number'
                                                    min={1}
                                                    max={180}
                                                    value={videoTaskDefaults.defaultDurationSeconds ?? ''}
                                                    onChange={(event) =>
                                                        setVideoTaskDefaults((current) => ({
                                                            ...current,
                                                            defaultDurationSeconds: event.target.value
                                                                ? Math.max(1, parseInt(event.target.value, 10) || 1)
                                                                : undefined
                                                        }))
                                                    }
                                                    className='bg-background text-foreground h-10 rounded-xl'
                                                />
                                                <p className='text-muted-foreground text-xs'>
                                                    {t('settings.video.defaultDuration.label')}
                                                </p>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.video.defaultAspectRatio.label')}
                                                </Label>
                                                <Select
                                                    value={videoTaskDefaults.defaultAspectRatio ?? '__model-default__'}
                                                    onValueChange={(value) =>
                                                        setVideoTaskDefaults((current) => ({
                                                            ...current,
                                                            defaultAspectRatio:
                                                                value === '__model-default__' ? undefined : value
                                                        }))
                                                    }>
                                                    <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='__model-default__'>模型默认</SelectItem>
                                                        {VIDEO_ASPECT_RATIO_OPTIONS.map((ratio) => (
                                                            <SelectItem key={ratio} value={ratio}>
                                                                {ratio}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.video.defaultResolutionTier.label')}
                                                </Label>
                                                <Select
                                                    value={
                                                        videoTaskDefaults.defaultResolutionTier ?? '__model-default__'
                                                    }
                                                    onValueChange={(value) =>
                                                        setVideoTaskDefaults((current) => ({
                                                            ...current,
                                                            defaultResolutionTier:
                                                                value === '__model-default__'
                                                                    ? undefined
                                                                    : (value as NonNullable<
                                                                          VideoTaskDefaults['defaultResolutionTier']
                                                                      >)
                                                        }))
                                                    }>
                                                    <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='__model-default__'>模型默认</SelectItem>
                                                        {VIDEO_RESOLUTION_TIER_OPTIONS.map((tier) => (
                                                            <SelectItem key={tier} value={tier}>
                                                                {t(`video.params.resolutionTier.${tier}`)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className='grid gap-2 sm:grid-cols-2'>
                                            <label className='border-border bg-muted/20 flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm'>
                                                <Checkbox
                                                    checked={videoTaskDefaults.defaultPromptEnhanceEnabled === true}
                                                    onCheckedChange={(checked) =>
                                                        setVideoTaskDefaults((current) => ({
                                                            ...current,
                                                            defaultPromptEnhanceEnabled: checked === true
                                                        }))
                                                    }
                                                    className='mt-0.5'
                                                />
                                                <span className='min-w-0'>
                                                    <span className='text-foreground block font-medium'>
                                                        {t('settings.video.promptEnhance.label')}
                                                    </span>
                                                    <span className='text-muted-foreground mt-0.5 block text-xs leading-5'>
                                                        {t('video.params.promptEnhance.description')}
                                                    </span>
                                                </span>
                                            </label>
                                            <label className='border-border bg-muted/20 flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm'>
                                                <Checkbox
                                                    checked={videoTaskDefaults.defaultNativeAudioEnabled === true}
                                                    onCheckedChange={(checked) =>
                                                        setVideoTaskDefaults((current) => ({
                                                            ...current,
                                                            defaultNativeAudioEnabled: checked === true
                                                        }))
                                                    }
                                                    className='mt-0.5'
                                                />
                                                <span className='min-w-0'>
                                                    <span className='text-foreground block font-medium'>
                                                        {t('settings.video.nativeAudio.label')}
                                                    </span>
                                                    <span className='text-muted-foreground mt-0.5 block text-xs leading-5'>
                                                        {t('video.params.nativeAudio.description')}
                                                    </span>
                                                </span>
                                            </label>
                                            <label className='border-border bg-muted/20 flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm'>
                                                <Checkbox
                                                    checked={videoTaskDefaults.saveHistoryEnabled}
                                                    onCheckedChange={(checked) =>
                                                        setVideoTaskDefaults((current) => ({
                                                            ...current,
                                                            saveHistoryEnabled: checked === true
                                                        }))
                                                    }
                                                    className='mt-0.5'
                                                />
                                                <span className='min-w-0'>
                                                    <span className='text-foreground block font-medium'>
                                                        {t('settings.video.saveHistory.label')}
                                                    </span>
                                                    <span className='text-muted-foreground mt-0.5 block text-xs leading-5'>
                                                        {t('settings.video.saveHistory.description')}
                                                    </span>
                                                </span>
                                            </label>
                                            <label className='border-border bg-muted/20 flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm'>
                                                <Checkbox
                                                    checked={videoTaskDefaults.autoDownloadEnabled}
                                                    onCheckedChange={(checked) =>
                                                        setVideoTaskDefaults((current) => ({
                                                            ...current,
                                                            autoDownloadEnabled: checked === true
                                                        }))
                                                    }
                                                    className='mt-0.5'
                                                />
                                                <span className='min-w-0'>
                                                    <span className='text-foreground block font-medium'>
                                                        {t('settings.video.autoDownload.label')}
                                                    </span>
                                                    <span className='text-muted-foreground mt-0.5 block text-xs leading-5'>
                                                        {t('settings.video.autoDownload.description')}
                                                    </span>
                                                </span>
                                            </label>
                                        </div>
                                        <div className='border-border bg-muted/20 space-y-3 rounded-xl border p-3'>
                                            <div className='flex items-center gap-2'>
                                                <Cloud className='text-muted-foreground h-4 w-4' />
                                                <Label className='text-foreground text-sm font-medium'>
                                                    {t('settings.video.sync.title')}
                                                </Label>
                                            </div>
                                            <div className='grid gap-2 sm:grid-cols-2'>
                                                {VIDEO_SYNC_OPTION_CONFIGS.map((option) => (
                                                    <label
                                                        key={option.key}
                                                        className='border-border/70 bg-background/60 flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm'>
                                                        <Checkbox
                                                            checked={videoSyncOptions[option.key]}
                                                            onCheckedChange={(checked) =>
                                                                setVideoSyncOptions((current) => ({
                                                                    ...current,
                                                                    [option.key]: checked === true
                                                                }))
                                                            }
                                                        />
                                                        <span>{t(option.labelKey)}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            <div className='grid gap-3 sm:grid-cols-2'>
                                                <div className='space-y-1.5'>
                                                    <Label className='text-muted-foreground text-xs'>
                                                        {t('settings.video.sync.recentDays.label')}
                                                    </Label>
                                                    <Input
                                                        type='number'
                                                        min={1}
                                                        max={365}
                                                        value={videoSyncOptions.recentVideoRangeDays}
                                                        onChange={(event) =>
                                                            setVideoSyncOptions((current) => ({
                                                                ...current,
                                                                recentVideoRangeDays: Math.max(
                                                                    1,
                                                                    parseInt(event.target.value, 10) || 1
                                                                )
                                                            }))
                                                        }
                                                        className='bg-background text-foreground h-10 rounded-xl'
                                                    />
                                                </div>
                                                <div className='space-y-1.5'>
                                                    <Label className='text-muted-foreground text-xs'>
                                                        {t('settings.video.sync.maxBytes.label')}
                                                    </Label>
                                                    <Input
                                                        type='number'
                                                        min={1048576}
                                                        step={1048576}
                                                        value={videoSyncOptions.maxVideoAssetBytes}
                                                        onChange={(event) =>
                                                            setVideoSyncOptions((current) => ({
                                                                ...current,
                                                                maxVideoAssetBytes: Math.max(
                                                                    1048576,
                                                                    parseInt(event.target.value, 10) || 1048576
                                                                )
                                                            }))
                                                        }
                                                        className='bg-background text-foreground h-10 rounded-xl'
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className='space-y-3'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <Label className='flex items-center gap-2'>
                                                <Database className='text-muted-foreground h-4 w-4' />
                                                图片存储模式
                                            </Label>
                                            {statusBadge(
                                                storageMode !== 'auto' ? 'UI' : hasEnvStorageMode ? 'ENV' : 'AUTO',
                                                storageMode !== 'auto' ? 'green' : 'blue'
                                            )}
                                        </div>
                                        <Select
                                            onValueChange={(value) => setStorageMode(value as typeof storageMode)}
                                            value={storageMode}>
                                            <SelectTrigger className='bg-background text-foreground h-10 w-full rounded-xl'>
                                                <SelectValue placeholder='选择存储模式' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {storageOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className='text-muted-foreground space-y-1 text-xs'>
                                            <p>
                                                <strong>自动检测:</strong> Vercel → IndexedDB，本地运行 → 文件系统
                                            </p>
                                            <p>
                                                <strong>文件系统:</strong> Web 端保存到{' '}
                                                <code className='text-foreground'>./generated-images</code>
                                                ；桌面端保存到应用数据目录或下方选择的文件夹
                                            </p>
                                            <p>
                                                <strong>IndexedDB:</strong> 图片保存在浏览器本地存储，适合无服务器部署
                                            </p>
                                        </div>
                                        {isDesktopRuntime && storageMode === 'fs' && (
                                            <div className='rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3'>
                                                <div className='space-y-2'>
                                                    <div className='flex items-center justify-between gap-2'>
                                                        <Label
                                                            htmlFor='desktop-image-storage-path'
                                                            className='flex items-center gap-2 text-sm font-medium'>
                                                            <FolderOpen className='h-4 w-4 text-emerald-600 dark:text-emerald-300' />
                                                            桌面端文件夹
                                                        </Label>
                                                        {imageStoragePath
                                                            ? statusBadge('自定义路径', 'green')
                                                            : statusBadge('默认路径', 'blue')}
                                                    </div>
                                                    <Input
                                                        id='desktop-image-storage-path'
                                                        value={imageStoragePath}
                                                        onChange={(event) => {
                                                            setImageStoragePath(event.target.value);
                                                            setImageStoragePathError('');
                                                        }}
                                                        placeholder={
                                                            defaultImageStoragePath || '留空时使用默认应用数据目录'
                                                        }
                                                        className='bg-background text-foreground h-10 rounded-xl font-mono text-xs'
                                                        aria-label='桌面端图片存储路径'
                                                    />
                                                    <div className='flex flex-wrap gap-2'>
                                                        {imageStoragePath && (
                                                            <Button
                                                                type='button'
                                                                variant='ghost'
                                                                onClick={() => {
                                                                    setImageStoragePath('');
                                                                    setImageStoragePathError('');
                                                                }}
                                                                className='text-muted-foreground hover:text-foreground min-h-[44px] rounded-xl'>
                                                                使用默认路径
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <p className='text-xs leading-5 text-emerald-800 dark:text-emerald-100/90'>
                                                        留空时默认保存到应用数据目录下的{' '}
                                                        <code className='text-foreground'>generated-images</code>
                                                        。如需自定义目录，请直接填写本机文件夹绝对路径。
                                                    </p>
                                                    {imageStoragePathError && (
                                                        <p
                                                            className='text-xs text-red-600 dark:text-red-300'
                                                            role='alert'>
                                                            {imageStoragePathError}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ProviderSection>

                                <ProviderSection
                                    title='云存储同步'
                                    description='为当前设备配置 S3 兼容对象存储，同步配置、提示词、历史记录与历史图片。'
                                    icon={<Cloud className='h-4 w-4' />}>
                                    <div className='space-y-4'>
                                        <div className='rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100'>
                                            这是单机/自托管模式：每个访问者在本机保存对象存储配置。默认使用客户端直连；Web
                                            端需要对象存储支持 CORS，桌面端会通过 Tauri Rust 网络层请求对象存储。
                                        </div>

                                        <div className='flex flex-wrap items-center gap-2'>
                                            <Cloud className='text-muted-foreground h-4 w-4' />
                                            <span className='text-foreground text-sm font-medium'>S3 兼容对象存储</span>
                                            {isS3Configured
                                                ? statusBadge('本地已配置', 'green')
                                                : statusBadge('未配置', 'amber')}
                                        </div>

                                        <div
                                            className={`border-border bg-background/60 rounded-xl border p-3 ${isS3Configured ? 'opacity-60' : ''}`}>
                                            <div className='flex items-start gap-3'>
                                                <Checkbox
                                                    id='sync-hide-when-unconfigured'
                                                    checked={syncHideWhenUnconfiguredChecked}
                                                    disabled={isS3Configured}
                                                    onCheckedChange={(checked) => {
                                                        if (isS3Configured) return;
                                                        setSyncHideWhenUnconfigured(checked === true);
                                                    }}
                                                    className='mt-0.5'
                                                />
                                                <div className='min-w-0 space-y-1'>
                                                    <Label
                                                        htmlFor='sync-hide-when-unconfigured'
                                                        className={`text-foreground text-sm font-medium ${isS3Configured ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                                        {t('settings.sync.visibility.hideWhenUnconfigured.label')}
                                                    </Label>
                                                    <p className='text-muted-foreground text-xs leading-5'>
                                                        {t(
                                                            isS3Configured
                                                                ? 'settings.sync.visibility.hideWhenUnconfigured.disabledDescription'
                                                                : 'settings.sync.visibility.hideWhenUnconfigured.description'
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className='grid gap-3 sm:grid-cols-2'>
                                            <div className='space-y-2'>
                                                <Label htmlFor='s3-endpoint' className='text-muted-foreground text-xs'>
                                                    Endpoint
                                                </Label>
                                                <Input
                                                    id='s3-endpoint'
                                                    type='url'
                                                    value={s3Endpoint}
                                                    onChange={(event) => setS3Endpoint(event.target.value)}
                                                    placeholder='https://s3.example.com'
                                                    autoComplete='off'
                                                    className='bg-background text-foreground h-10 rounded-xl font-mono'
                                                />
                                            </div>
                                            <div className='space-y-2'>
                                                <Label htmlFor='s3-bucket' className='text-muted-foreground text-xs'>
                                                    Bucket
                                                </Label>
                                                <Input
                                                    id='s3-bucket'
                                                    value={s3Bucket}
                                                    onChange={(event) => setS3Bucket(event.target.value)}
                                                    placeholder='gpt-image-playground'
                                                    autoComplete='off'
                                                    className='bg-background text-foreground h-10 rounded-xl font-mono'
                                                />
                                            </div>
                                            <div className='space-y-2'>
                                                <Label htmlFor='s3-region' className='text-muted-foreground text-xs'>
                                                    Region
                                                </Label>
                                                <Input
                                                    id='s3-region'
                                                    value={s3Region}
                                                    onChange={(event) => setS3Region(event.target.value)}
                                                    placeholder='us-east-1'
                                                    autoComplete='off'
                                                    className='bg-background text-foreground h-10 rounded-xl font-mono'
                                                />
                                            </div>
                                            <div className='space-y-2'>
                                                <Label
                                                    htmlFor='s3-access-key-id'
                                                    className='text-muted-foreground text-xs'>
                                                    Access Key ID
                                                </Label>
                                                <Input
                                                    id='s3-access-key-id'
                                                    value={s3AccessKeyId}
                                                    onChange={(event) => setS3AccessKeyId(event.target.value)}
                                                    placeholder='your_access_key'
                                                    autoComplete='off'
                                                    spellCheck={false}
                                                    className='bg-background text-foreground h-10 rounded-xl font-mono'
                                                />
                                            </div>
                                            <div className='space-y-2 sm:col-span-2'>
                                                <Label
                                                    htmlFor='s3-secret-access-key'
                                                    className='text-muted-foreground text-xs'>
                                                    Secret Access Key
                                                </Label>
                                                <SecretInput
                                                    id='s3-secret-access-key'
                                                    value={s3SecretAccessKey}
                                                    onChange={setS3SecretAccessKey}
                                                    visible={showS3SecretAccessKey}
                                                    onVisibleChange={() => setShowS3SecretAccessKey((value) => !value)}
                                                    placeholder='your_secret_key'
                                                />
                                            </div>
                                            <div className='space-y-2'>
                                                <Label htmlFor='s3-prefix' className='text-muted-foreground text-xs'>
                                                    远端根前缀
                                                </Label>
                                                <Input
                                                    id='s3-prefix'
                                                    value={s3Prefix}
                                                    onChange={(event) => setS3Prefix(event.target.value)}
                                                    placeholder={DEFAULT_SYNC_CONFIG.s3.prefix}
                                                    autoComplete='off'
                                                    className='bg-background text-foreground h-10 rounded-xl font-mono'
                                                />
                                            </div>
                                            <div className='space-y-2'>
                                                <Label
                                                    htmlFor='s3-profile-id'
                                                    className='text-muted-foreground text-xs'>
                                                    Profile / 设备命名空间
                                                </Label>
                                                <Input
                                                    id='s3-profile-id'
                                                    value={s3ProfileId}
                                                    onChange={(event) => setS3ProfileId(event.target.value)}
                                                    placeholder='default'
                                                    autoComplete='off'
                                                    className='bg-background text-foreground h-10 rounded-xl font-mono'
                                                />
                                            </div>
                                        </div>

                                        <div className='flex items-center space-x-2'>
                                            <Checkbox
                                                id='s3-force-path-style'
                                                checked={s3ForcePathStyle}
                                                onCheckedChange={(checked) => setS3ForcePathStyle(!!checked)}
                                            />
                                            <Label
                                                htmlFor='s3-force-path-style'
                                                className='text-muted-foreground cursor-pointer text-sm'>
                                                使用 path-style 访问（RustFS / MinIO / IP 地址端点通常需要开启）
                                            </Label>
                                        </div>

                                        <div className='border-border bg-background/60 rounded-xl border p-3'>
                                            <div className='flex items-start gap-3'>
                                                <Checkbox
                                                    id='s3-allow-remote-deletion'
                                                    checked={s3AllowRemoteDeletion}
                                                    onCheckedChange={(checked) => setS3AllowRemoteDeletion(!!checked)}
                                                    className='mt-0.5'
                                                />
                                                <div className='min-w-0 space-y-1'>
                                                    <Label
                                                        htmlFor='s3-allow-remote-deletion'
                                                        className='text-foreground cursor-pointer text-sm font-medium'>
                                                        允许同步删除远端图片
                                                    </Label>
                                                    <p className='text-muted-foreground text-xs leading-5'>
                                                        默认关闭，普通同步只需要读取、列出和写入权限。关闭时，本地删除不会发布远端删除标记，也不会请求
                                                        DeleteObject；需要多设备同步删除且凭据确实具备删除权限时再开启。
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className='space-y-2'>
                                            <Label className='text-muted-foreground text-xs'>云存储请求方式</Label>
                                            <div className='grid gap-2 sm:grid-cols-2'>
                                                <button
                                                    type='button'
                                                    onClick={() => setS3RequestMode('direct')}
                                                    aria-pressed={s3RequestMode === 'direct'}
                                                    className={`focus-visible:ring-ring/50 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none ${s3RequestMode === 'direct' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                    <span className='block font-medium'>
                                                        {isDesktopRuntime ? '桌面 Rust 中转' : '客户端直连'}
                                                    </span>
                                                    <span className='mt-1 block text-xs opacity-75'>
                                                        {isDesktopRuntime
                                                            ? '使用本地 Tauri 网络层，避免 WebView CORS。'
                                                            : '默认方式，需要对象存储端点允许当前站点 CORS。'}
                                                    </span>
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => setS3RequestMode('server')}
                                                    disabled={isDesktopRuntime || clientDirectLinkPriority}
                                                    aria-pressed={s3RequestMode === 'server'}
                                                    className={`focus-visible:ring-ring/50 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${s3RequestMode === 'server' ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                    <span className='block font-medium'>服务器中转</span>
                                                    <span className='mt-1 block text-xs opacity-75'>
                                                        仅在直连跨域失败且服务端已配置 S3 时使用。
                                                    </span>
                                                </button>
                                            </div>
                                            {clientDirectLinkPriority && !isDesktopRuntime && (
                                                <p className='text-xs text-amber-700 dark:text-amber-300'>
                                                    当前部署启用了 CLIENT_DIRECT_LINK_PRIORITY，云存储服务器中转不可用。
                                                </p>
                                            )}
                                        </div>

                                        <div className='border-border bg-background/60 space-y-3 rounded-xl border p-3'>
                                            <div className='flex items-start gap-3'>
                                                <Checkbox
                                                    id='sync-auto-sync-enabled'
                                                    checked={syncAutoSyncEnabled}
                                                    onCheckedChange={(checked) => setSyncAutoSyncEnabled(!!checked)}
                                                    className='mt-0.5'
                                                />
                                                <div className='min-w-0 space-y-1'>
                                                    <Label
                                                        htmlFor='sync-auto-sync-enabled'
                                                        className='text-foreground cursor-pointer text-sm font-medium'>
                                                        自动同步
                                                    </Label>
                                                    <p className='text-muted-foreground text-xs leading-5'>
                                                        开启后会在本机内容变化后按所选范围上传。
                                                    </p>
                                                </div>
                                            </div>

                                            {syncAutoSyncEnabled && (
                                                <div className='grid gap-2 pl-7 sm:grid-cols-2'>
                                                    {AUTO_SYNC_SCOPE_OPTIONS.map((scope) => (
                                                        <label
                                                            key={scope.key}
                                                            htmlFor={`sync-auto-scope-${scope.key}`}
                                                            className='border-border/70 bg-muted/20 flex cursor-pointer items-start gap-2 rounded-lg border p-2.5'>
                                                            <Checkbox
                                                                id={`sync-auto-scope-${scope.key}`}
                                                                checked={syncAutoSyncScopes[scope.key]}
                                                                onCheckedChange={(checked) =>
                                                                    handleAutoSyncScopeChange(scope.key, !!checked)
                                                                }
                                                                className='mt-0.5'
                                                            />
                                                            <span className='min-w-0'>
                                                                <span className='text-foreground block text-sm font-medium'>
                                                                    {scope.label}
                                                                </span>
                                                                <span className='text-muted-foreground mt-0.5 block text-xs leading-5'>
                                                                    {scope.description}
                                                                </span>
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className='flex flex-wrap gap-2'>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                size='sm'
                                                onClick={handleFetchS3Status}
                                                disabled={s3StatusLoading}
                                                className='rounded-xl'>
                                                {s3StatusLoading ? <Spinner size='sm' className='mr-1' /> : null}
                                                刷新状态
                                            </Button>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                size='sm'
                                                onClick={handleTestS3Connection}
                                                disabled={s3TestLoading || !isS3Configured}
                                                className='rounded-xl'>
                                                {s3TestLoading ? <Spinner size='sm' className='mr-1' /> : null}
                                                测试 S3 连接
                                            </Button>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={() => {
                                                    clearSyncConfig();
                                                    setS3Endpoint('');
                                                    setS3Region(DEFAULT_SYNC_CONFIG.s3.region);
                                                    setS3Bucket('');
                                                    setS3AccessKeyId('');
                                                    setS3SecretAccessKey('');
                                                    setS3ForcePathStyle(DEFAULT_SYNC_CONFIG.s3.forcePathStyle);
                                                    setS3AllowRemoteDeletion(
                                                        DEFAULT_SYNC_CONFIG.s3.allowRemoteDeletion
                                                    );
                                                    setS3RequestMode(DEFAULT_SYNC_CONFIG.s3.requestMode);
                                                    setS3Prefix(DEFAULT_SYNC_CONFIG.s3.prefix);
                                                    setS3ProfileId(DEFAULT_SYNC_CONFIG.s3.profileId);
                                                    setSyncAutoSyncEnabled(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.enabled);
                                                    setSyncAutoSyncScopes(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.scopes);
                                                    setSyncHideWhenUnconfigured(
                                                        DEFAULT_SYNC_UI_SETTINGS.hideWhenUnconfigured
                                                    );
                                                    setInitialSyncConfigSnapshot(
                                                        JSON.stringify({
                                                            s3: DEFAULT_SYNC_CONFIG.s3,
                                                            autoSync: DEFAULT_SYNC_CONFIG.autoSync,
                                                            ui: DEFAULT_SYNC_CONFIG.ui
                                                        })
                                                    );
                                                    setS3Status({
                                                        configured: false,
                                                        message: '当前浏览器尚未配置 S3 兼容对象存储。'
                                                    });
                                                    setS3TestResult(null);
                                                }}
                                                className='text-muted-foreground rounded-xl hover:bg-red-500/10 hover:text-red-600'>
                                                清除本地 S3 配置
                                            </Button>
                                        </div>

                                        {s3Status && (
                                            <div className='border-border bg-background/60 space-y-1 rounded-xl border p-3 text-xs'>
                                                <div className='grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3'>
                                                    <span className='text-muted-foreground'>Endpoint</span>
                                                    <span className='text-foreground col-span-2 truncate font-mono'>
                                                        {s3Status.endpoint || '—'}
                                                    </span>
                                                    <span className='text-muted-foreground'>Bucket</span>
                                                    <span className='text-foreground col-span-2 truncate font-mono'>
                                                        {s3Status.bucket || '—'}
                                                    </span>
                                                    <span className='text-muted-foreground'>Region</span>
                                                    <span className='text-foreground col-span-2 font-mono'>
                                                        {s3Status.region || '—'}
                                                    </span>
                                                    <span className='text-muted-foreground'>根前缀</span>
                                                    <span className='text-foreground col-span-2 truncate font-mono'>
                                                        {s3Status.rootPrefix || '—'}
                                                    </span>
                                                    <span className='text-muted-foreground'>Profile</span>
                                                    <span className='text-foreground col-span-2 font-mono'>
                                                        {s3Status.profileId || '—'}
                                                    </span>
                                                    <span className='text-muted-foreground'>远端删除</span>
                                                    <span className='text-foreground col-span-2'>
                                                        {s3Status.allowRemoteDeletion ? '已允许' : '未开启'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {s3TestResult && (
                                            <div
                                                className={`rounded-xl border p-3 text-xs ${s3TestResult.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200'}`}>
                                                {s3TestResult.message}
                                            </div>
                                        )}
                                        <p className='text-muted-foreground text-xs'>
                                            保存配置后，生成历史右上角会显示一个云同步图标；点击后可手动上传快照或从最新快照恢复。
                                        </p>
                                    </div>
                                </ProviderSection>

                                <ProviderSection
                                    title='桌面端设置'
                                    description='Tauri 桌面 Rust 中转代理、调试模式。'
                                    icon={<Bug className='h-4 w-4' />}>
                                    {isDesktopRuntime ? (
                                        <>
                                            <div className='space-y-3'>
                                                <div className='flex flex-wrap items-center gap-2'>
                                                    <Label className='flex items-center gap-2'>
                                                        <Wifi className='text-muted-foreground h-4 w-4' />
                                                        代理模式（仅桌面端 Rust 请求）
                                                    </Label>
                                                    {statusBadge(
                                                        desktopProxyMode,
                                                        desktopProxyMode === 'disabled'
                                                            ? 'amber'
                                                            : desktopProxyMode === 'system'
                                                              ? 'green'
                                                              : 'blue'
                                                    )}
                                                </div>
                                                <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                                                    {(
                                                        [
                                                            ['disabled', '禁用代理'],
                                                            ['system', '默认环境代理'],
                                                            ['manual', '手动代理']
                                                        ] as [DesktopProxyMode, string][]
                                                    ).map(([value, label]) => (
                                                        <button
                                                            key={value}
                                                            type='button'
                                                            onClick={() => {
                                                                setDesktopProxyMode(value);
                                                                setProxyUrlError('');
                                                            }}
                                                            aria-pressed={desktopProxyMode === value}
                                                            className={`focus-visible:ring-ring/50 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none ${desktopProxyMode === value ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                                {desktopProxyMode === 'manual' && (
                                                    <div className='space-y-2'>
                                                        <Label
                                                            htmlFor='desktop-proxy-url'
                                                            className='text-muted-foreground text-xs'>
                                                            代理地址
                                                        </Label>
                                                        <Input
                                                            id='desktop-proxy-url'
                                                            type='text'
                                                            placeholder='127.0.0.1:7890 或 socks5://127.0.0.1:1080'
                                                            value={desktopProxyUrl}
                                                            onChange={(event) => {
                                                                setDesktopProxyUrl(event.target.value);
                                                                setProxyUrlError('');
                                                            }}
                                                            autoComplete='off'
                                                            className={`bg-background text-foreground h-10 rounded-xl ${proxyUrlError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                                        />
                                                        {proxyUrlError && (
                                                            <p className='text-xs text-red-500' role='alert'>
                                                                {proxyUrlError}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                {desktopProxyMode === 'system' && (
                                                    <p className='text-muted-foreground text-xs'>
                                                        使用 Rust HTTP
                                                        客户端默认代理行为（如环境变量代理）；如需稳定指定代理，建议选择手动代理。
                                                    </p>
                                                )}
                                                {desktopProxyMode === 'disabled' && (
                                                    <p className='text-muted-foreground text-xs'>
                                                        Rust 中转将直接连接 API 服务器，不使用代理。
                                                    </p>
                                                )}
                                            </div>

                                            <div className='space-y-3'>
                                                <div className='flex flex-wrap items-center gap-2'>
                                                    <Label className='flex items-center gap-2'>
                                                        <Globe className='text-muted-foreground h-4 w-4' />
                                                        展示内容读取
                                                    </Label>
                                                    {statusBadge(
                                                        desktopPromoServiceMode === 'disabled'
                                                            ? '关闭'
                                                            : desktopPromoServiceMode === 'current'
                                                              ? '当前站点'
                                                              : desktopPromoServiceMode === 'origin'
                                                                ? '自定义域名'
                                                                : '完整接口',
                                                        desktopPromoServiceMode === 'disabled' ? 'amber' : 'blue'
                                                    )}
                                                </div>
                                                <div className='grid grid-cols-1 gap-2 sm:grid-cols-4'>
                                                    {(
                                                        [
                                                            ['current', '当前站点'],
                                                            ['origin', '自定义域名'],
                                                            ['endpoint', '完整接口'],
                                                            ['disabled', '关闭']
                                                        ] as [DesktopPromoServiceMode, string][]
                                                    ).map(([value, label]) => (
                                                        <button
                                                            key={value}
                                                            type='button'
                                                            onClick={() => {
                                                                setDesktopPromoServiceMode(value);
                                                                setPromoServiceUrlError('');
                                                                if (value === 'disabled' || value === 'current') {
                                                                    setDesktopPromoServiceUrl('');
                                                                }
                                                            }}
                                                            aria-pressed={desktopPromoServiceMode === value}
                                                            className={`focus-visible:ring-ring/50 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none ${desktopPromoServiceMode === value ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                            {label}
                                                        </button>
                                                    ))}
                                                </div>
                                                {desktopPromoServiceMode === 'origin' && (
                                                    <div className='space-y-2'>
                                                        <Label
                                                            htmlFor='desktop-promo-service-url'
                                                            className='text-muted-foreground text-xs'>
                                                            展示服务域名
                                                        </Label>
                                                        <Input
                                                            id='desktop-promo-service-url'
                                                            type='text'
                                                            placeholder='https://content.example.com'
                                                            value={desktopPromoServiceUrl}
                                                            onChange={(event) => {
                                                                setDesktopPromoServiceUrl(event.target.value);
                                                                setPromoServiceUrlError('');
                                                            }}
                                                            autoComplete='off'
                                                            className={`bg-background text-foreground h-10 rounded-xl ${promoServiceUrlError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                                        />
                                                    </div>
                                                )}
                                                {desktopPromoServiceMode === 'endpoint' && (
                                                    <div className='space-y-2'>
                                                        <Label
                                                            htmlFor='desktop-promo-service-endpoint'
                                                            className='text-muted-foreground text-xs'>
                                                            完整展示接口地址
                                                        </Label>
                                                        <Input
                                                            id='desktop-promo-service-endpoint'
                                                            type='text'
                                                            placeholder='https://content.example.com/api/promo/placements'
                                                            value={desktopPromoServiceUrl}
                                                            onChange={(event) => {
                                                                setDesktopPromoServiceUrl(event.target.value);
                                                                setPromoServiceUrlError('');
                                                            }}
                                                            autoComplete='off'
                                                            className={`bg-background text-foreground h-10 rounded-xl ${promoServiceUrlError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                                        />
                                                    </div>
                                                )}
                                                {desktopPromoServiceMode === 'current' && (
                                                    <p className='text-muted-foreground text-xs'>
                                                        桌面端会请求当前站点的 /api/promo/placements。
                                                    </p>
                                                )}
                                                {desktopPromoServiceMode === 'disabled' && (
                                                    <p className='text-muted-foreground text-xs'>
                                                        桌面端不会请求展示接口，所有展示位保持隐藏。
                                                    </p>
                                                )}
                                                {promoServiceUrlError && (
                                                    <p className='text-xs text-red-500' role='alert'>
                                                        {promoServiceUrlError}
                                                    </p>
                                                )}
                                                {desktopPromoPlacementsUrl &&
                                                    desktopPromoServiceMode !== 'disabled' && (
                                                        <p className='border-border bg-background text-muted-foreground rounded-xl border px-3 py-2 text-xs break-all'>
                                                            {desktopPromoPlacementsUrl}
                                                        </p>
                                                    )}
                                            </div>

                                            <div className='space-y-3'>
                                                <div className='flex items-center gap-2'>
                                                    <Label
                                                        htmlFor='desktop-debug-mode'
                                                        className='flex items-center gap-2'>
                                                        <Bug className='text-muted-foreground h-4 w-4' />
                                                        调试模式
                                                    </Label>
                                                    {desktopDebugMode
                                                        ? statusBadge('已开启', 'blue')
                                                        : statusBadge('关闭', 'amber')}
                                                </div>
                                                <div className='flex items-center space-x-2'>
                                                    <Checkbox
                                                        id='desktop-debug-mode'
                                                        checked={desktopDebugMode}
                                                        onCheckedChange={(checked) => setDesktopDebugMode(!!checked)}
                                                    />
                                                    <label
                                                        htmlFor='desktop-debug-mode'
                                                        className='text-muted-foreground cursor-pointer text-sm'>
                                                        开启后，Rust 中转会在 API
                                                        请求中附加调试头并返回更详细的错误信息。
                                                    </label>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className='rounded-xl border border-sky-500/25 bg-sky-500/10 p-4'>
                                            <div className='flex gap-3'>
                                                <Bug className='mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300' />
                                                <div className='space-y-3 text-sm text-sky-900 dark:text-sky-100'>
                                                    <div className='space-y-1'>
                                                        <p className='font-semibold'>
                                                            当前为 Web 应用，桌面端配置未启用
                                                        </p>
                                                        <p className='text-xs leading-5 text-sky-800/85 dark:text-sky-100/80'>
                                                            {DESKTOP_ONLY_SETTINGS_MESSAGE}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        asChild
                                                        variant='outline'
                                                        size='sm'
                                                        className='bg-background/80 hover:bg-background min-h-[44px] rounded-xl border-sky-500/30 text-sky-700 dark:text-sky-100'>
                                                        <ExternalLink href={DESKTOP_APP_DOWNLOAD_URL}>
                                                            <Download className='h-4 w-4' />
                                                            下载或更新桌面端
                                                        </ExternalLink>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </ProviderSection>

                                <div className='border-border flex flex-wrap items-center gap-3 border-t pt-2'>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleReset}
                                        className='text-muted-foreground h-auto p-0 hover:bg-transparent hover:text-red-600'>
                                        <Plus className='mr-1 h-3 w-3 rotate-45' />
                                        重置所有配置
                                    </Button>
                                    <span className='text-muted-foreground/40'>·</span>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => performExportConfig(false)}
                                        className='text-muted-foreground hover:text-foreground h-auto p-0 hover:bg-transparent'>
                                        导出（不含密钥）
                                    </Button>
                                    <span className='text-muted-foreground/40'>·</span>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => performExportConfig(true)}
                                        className='text-muted-foreground h-auto p-0 hover:bg-transparent hover:text-amber-600'>
                                        导出（含密钥）
                                    </Button>
                                    <span className='text-muted-foreground/40'>·</span>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleImportConfigClick}
                                        className='text-muted-foreground hover:text-foreground h-auto p-0 hover:bg-transparent'>
                                        导入配置 JSON
                                    </Button>
                                    <input
                                        ref={importConfigFileRef}
                                        type='file'
                                        accept='application/json,.json'
                                        className='hidden'
                                        onChange={handleImportConfigChange}
                                    />
                                </div>
                            </>
                        )}

                        {settingsView === 'video-endpoints' && (
                            <div className='space-y-4'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setSettingsView('providers')}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                                    <ArrowLeft className='h-4 w-4' />
                                    {t('settings.endpoints.backToProviders')}
                                </Button>

                                <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                    {t('settings.videoEndpoints.notice')}
                                </div>

                                <div className='flex flex-wrap gap-2'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        onClick={() => {
                                            setNewUnifiedProviderTemplateKey(
                                                getProviderEndpointTemplateKey(VIDEO_PROVIDER_ENDPOINT_TEMPLATES[0])
                                            );
                                            setSettingsView('provider-endpoints');
                                        }}
                                        className='min-h-[44px] rounded-xl'>
                                        <Plus className='h-4 w-4' />
                                        {t('settings.endpoints.addButton')}
                                    </Button>
                                    {statusBadge(
                                        t('settings.providers.endpointBadge', {
                                            count: String(videoProviderEndpoints.length)
                                        }),
                                        'blue'
                                    )}
                                    {statusBadge(
                                        t('settings.endpoints.discoveryCount', {
                                            count: String(
                                                videoEndpointTemplates.filter(
                                                    (template) => template.supportedByDiscovery
                                                ).length
                                            )
                                        }),
                                        'green'
                                    )}
                                </div>

                                <div className='space-y-4'>
                                    {videoEndpointTemplates.map((template) => {
                                        const endpoints = providerEndpoints.filter(
                                            (endpoint) =>
                                                endpoint.provider === template.kind &&
                                                endpoint.protocol === template.protocol
                                        );
                                        return (
                                            <ProviderSection
                                                key={getProviderEndpointTemplateKey(template)}
                                                title={template.title}
                                                description={`${t(template.descriptionKey)} · ${endpoints.length} ${t('settings.endpoints.countUnit')}`}
                                                icon={<Globe className='h-4 w-4' />}
                                                defaultOpen={template.hasEndpoint}>
                                                <div className='flex flex-wrap items-center gap-2'>
                                                    {template.adapterStatus === 'implemented'
                                                        ? statusBadge(
                                                              t('settings.endpoints.adapterImplemented'),
                                                              'green'
                                                          )
                                                        : statusBadge(t('settings.endpoints.adapterPending'), 'amber')}
                                                    {template.supportedByDiscovery
                                                        ? statusBadge(t('settings.endpoints.discoveryReady'), 'blue')
                                                        : statusBadge(t('settings.endpoints.manualModelOnly'), 'amber')}
                                                </div>
                                                {endpoints.length === 0 ? (
                                                    <p className='text-muted-foreground border-border bg-background/60 rounded-xl border border-dashed p-3 text-xs'>
                                                        {t('settings.endpoints.emptyTemplate')}
                                                    </p>
                                                ) : (
                                                    <div className='space-y-4'>
                                                        {endpoints.map((endpoint) => {
                                                            const endpointEntries = modelCatalog.filter(
                                                                (entry) => entry.providerEndpointId === endpoint.id
                                                            );
                                                            const selectedModelCount = endpoint.modelIds?.length ?? 0;
                                                            const hasRealVideoModels = (endpoint.modelIds ?? []).some(
                                                                (modelId) =>
                                                                    endpointEntries.some(
                                                                        (entry) =>
                                                                            entry.rawModelId === modelId &&
                                                                            entry.capabilities.tasks.some((task) =>
                                                                                task.startsWith('video.')
                                                                            ) &&
                                                                            !isPendingVideoPlaceholderEntry(entry)
                                                                    )
                                                            );
                                                            return renderProviderEndpointCard(endpoint, {
                                                                selectedModelCount,
                                                                totalModelCount: endpointEntries.length,
                                                                summaryDescription: t(
                                                                    'settings.modelManager.videoSummaryDescription'
                                                                ),
                                                                badges: hasRealVideoModels
                                                                    ? statusBadge(
                                                                          t('settings.endpoints.videoReady'),
                                                                          'green'
                                                                      )
                                                                    : statusBadge(
                                                                          t('settings.endpoints.needsModels'),
                                                                          'amber'
                                                                      )
                                                            });
                                                        })}
                                                    </div>
                                                )}
                                            </ProviderSection>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {settingsView === 'model-catalog' && (
                            <div className='space-y-4'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setSettingsView('providers')}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                                    <ArrowLeft className='h-4 w-4' />
                                    {t('settings.modelCatalog.backToProviders')}
                                </Button>

                                <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                    {t('settings.modelCatalog.notice')}
                                </div>

                                <div className='border-border bg-card/80 dark:bg-panel-soft space-y-3 rounded-2xl border p-4 shadow-sm'>
                                    <Input
                                        value={modelCatalogSearch}
                                        onChange={(event) => setModelCatalogSearch(event.target.value)}
                                        placeholder='搜索模型 ID、显示名、端点、厂商、能力或元数据'
                                        className='bg-background text-foreground h-10 rounded-xl text-sm'
                                    />
                                    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>
                                        <Select
                                            value={modelCatalogProviderFilter}
                                            onValueChange={(value) => {
                                                setModelCatalogProviderFilter(value as ModelCatalogProviderFilter);
                                                setModelCatalogEndpointFilter('all');
                                            }}>
                                            <SelectTrigger className='bg-background text-foreground h-10 w-full rounded-xl'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='all'>全部供应商</SelectItem>
                                                {modelCatalogProviderOptions.map((provider) => (
                                                    <SelectItem key={provider} value={provider}>
                                                        {modelCatalogProviderLabel(provider)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={modelCatalogEndpointFilter}
                                            onValueChange={setModelCatalogEndpointFilter}>
                                            <SelectTrigger className='bg-background text-foreground h-10 w-full rounded-xl'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='all'>全部端点</SelectItem>
                                                {modelCatalogEndpointOptions.map((endpoint) => (
                                                    <SelectItem key={endpoint.id} value={endpoint.id}>
                                                        {endpoint.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={modelCatalogTaskFilter}
                                            onValueChange={(value) =>
                                                setModelCatalogTaskFilter(value as ModelCatalogTaskFilter)
                                            }>
                                            <SelectTrigger className='bg-background text-foreground h-10 w-full rounded-xl'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MODEL_CATALOG_TASK_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={modelCatalogSourceFilter}
                                            onValueChange={(value) =>
                                                setModelCatalogSourceFilter(value as ModelCatalogSourceFilter)
                                            }>
                                            <SelectTrigger className='bg-background text-foreground h-10 w-full rounded-xl'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MODEL_CATALOG_SOURCE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={modelCatalogStatusFilter}
                                            onValueChange={(value) =>
                                                setModelCatalogStatusFilter(value as ModelCatalogStatusFilter)
                                            }>
                                            <SelectTrigger className='bg-background text-foreground h-10 w-full rounded-xl'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MODEL_CATALOG_STATUS_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
                                        {statusBadge(`${modelCatalog.length} 条目录项`, 'blue')}
                                        {statusBadge(`${filteredModelCatalogEntries.length} 条匹配`, 'green')}
                                        {statusBadge(
                                            `${modelCatalog.filter((entry) => entry.enabled !== false).length} 已启用`,
                                            'green'
                                        )}
                                        {statusBadge(
                                            `${modelCatalog.filter((entry) => entry.capabilityConfidence === 'low').length} 未分类`,
                                            'amber'
                                        )}
                                        {modelCatalogActiveFilterCount > 0 && (
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={resetModelCatalogFilters}
                                                className='text-muted-foreground hover:bg-accent hover:text-foreground h-7 rounded-lg px-2 text-xs'>
                                                清除筛选
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className='space-y-4'>
                                    {groupedModelCatalogEntries.map(({ provider, entries }) => (
                                        <section
                                            key={provider}
                                            className='border-border bg-card/80 dark:bg-panel-soft overflow-hidden rounded-2xl border shadow-sm'>
                                            <div className='border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3'>
                                                <div className='min-w-0'>
                                                    <h3 className='text-foreground text-sm font-semibold'>
                                                        {modelCatalogProviderLabel(provider)}
                                                    </h3>
                                                    <p className='text-muted-foreground text-xs'>
                                                        {entries.length} 个匹配模型
                                                    </p>
                                                </div>
                                                <span className='bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs'>
                                                    {entries.filter((entry) => entry.enabled !== false).length} 已启用
                                                </span>
                                            </div>
                                            <div className='space-y-2 p-3'>
                                                {entries.map((entry) => {
                                                    const endpoint = modelCatalogEndpointById.get(
                                                        entry.providerEndpointId
                                                    );
                                                    const sourceLabel =
                                                        MODEL_CATALOG_SOURCE_OPTIONS.find(
                                                            (option) => option.value === entry.source
                                                        )?.label || entry.source;
                                                    return (
                                                        <div
                                                            key={entry.id}
                                                            className='border-border bg-background/70 space-y-3 rounded-xl border p-3'>
                                                            <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                                                                <div className='min-w-0 space-y-1'>
                                                                    <p className='text-foreground truncate font-mono text-sm'>
                                                                        {getCatalogEntryLabel(entry, endpoint)}
                                                                    </p>
                                                                    <p className='text-muted-foreground truncate text-xs'>
                                                                        {entry.rawModelId} ·{' '}
                                                                        {endpoint?.name || entry.providerEndpointId} ·{' '}
                                                                        {entry.capabilityConfidence || 'low'}
                                                                        {entry.upstreamVendor
                                                                            ? ` · ${entry.upstreamVendor}`
                                                                            : ''}
                                                                    </p>
                                                                </div>
                                                                <div className='flex flex-wrap items-center gap-2'>
                                                                    <Button
                                                                        type='button'
                                                                        variant='ghost'
                                                                        size='sm'
                                                                        onClick={() =>
                                                                            restoreModelCatalogEntryAuto(entry.id)
                                                                        }
                                                                        className='min-h-[36px] rounded-xl'>
                                                                        恢复自动
                                                                    </Button>
                                                                    <Button
                                                                        type='button'
                                                                        variant='ghost'
                                                                        size='icon'
                                                                        onClick={() =>
                                                                            updateModelCatalogEntryEnabled(
                                                                                entry.id,
                                                                                !entry.enabled
                                                                            )
                                                                        }
                                                                        className='text-muted-foreground h-9 w-9 hover:bg-red-500/10 hover:text-red-600'
                                                                        aria-label={`切换模型 ${entry.id}`}>
                                                                        {entry.enabled === false ? (
                                                                            <EyeOff className='h-4 w-4' />
                                                                        ) : (
                                                                            <Eye className='h-4 w-4' />
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className='flex flex-wrap gap-2 text-xs'>
                                                                {entry.source === 'remote'
                                                                    ? statusBadge(sourceLabel, 'blue')
                                                                    : entry.source === 'custom'
                                                                      ? statusBadge(sourceLabel, 'green')
                                                                      : statusBadge(sourceLabel, 'amber')}
                                                                {entry.enabled === false
                                                                    ? statusBadge('已禁用', 'amber')
                                                                    : statusBadge('已启用', 'green')}
                                                                {entry.capabilityConfidence === 'low' &&
                                                                    statusBadge('未分类', 'amber')}
                                                                {entry.modelFamily &&
                                                                    statusBadge(entry.modelFamily, 'blue')}
                                                            </div>
                                                            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                                                                {MODEL_CATALOG_TASK_OPTIONS.filter(
                                                                    (option) => option.value !== 'all'
                                                                ).map((option) => {
                                                                    const task = option.value as ModelTaskCapability;
                                                                    return (
                                                                        <div
                                                                            key={task}
                                                                            className='flex items-center gap-2'>
                                                                            <Checkbox
                                                                                id={`catalog-task-${entry.id}-${task}`}
                                                                                checked={entry.capabilities.tasks.includes(
                                                                                    task
                                                                                )}
                                                                                onCheckedChange={(checked) =>
                                                                                    updateModelCatalogEntryTask(
                                                                                        entry.id,
                                                                                        task,
                                                                                        checked
                                                                                    )
                                                                                }
                                                                            />
                                                                            <Label
                                                                                htmlFor={`catalog-task-${entry.id}-${task}`}
                                                                                className='text-muted-foreground cursor-pointer truncate text-xs'>
                                                                                {modelCatalogTaskLabel(task)}
                                                                            </Label>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    ))}

                                    {filteredModelCatalogEntries.length === 0 && (
                                        <p className='border-border bg-background/60 text-muted-foreground rounded-xl border border-dashed p-4 text-sm'>
                                            还没有匹配的目录项。可以清除筛选，或在“供应商与模型”里刷新模型列表。
                                        </p>
                                    )}
                                </div>

                                <ProviderSection
                                    title='自定义模型能力覆盖'
                                    description='自定义模型 ID 仍可单独覆盖尺寸、能力和供应商参数。'
                                    icon={<Sparkles className='h-4 w-4' />}>
                                    <p className='rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-xs leading-5 text-violet-900 dark:text-violet-100'>
                                        新增模型请进入“供应商 API
                                        配置”刷新或手动添加；这里保留的是模型级别的高级覆盖项。
                                    </p>

                                    {customImageModels.length > 0 ? (
                                        <div className='space-y-2'>
                                            {customImageModels.map((model) => (
                                                <div
                                                    key={model.id}
                                                    className='border-border bg-background/70 space-y-3 rounded-xl border p-3'>
                                                    <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                                                        <div className='min-w-0 flex-1'>
                                                            <p className='text-foreground truncate font-mono text-sm'>
                                                                {model.id}
                                                            </p>
                                                            <p className='text-muted-foreground text-xs'>
                                                                {providerLabel(model.provider)}
                                                            </p>
                                                        </div>
                                                        <span className='bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs'>
                                                            {model.instanceId
                                                                ? `绑定 ${model.instanceId}`
                                                                : '全局自定义'}
                                                        </span>
                                                        <Button
                                                            type='button'
                                                            variant='ghost'
                                                            size='icon'
                                                            onClick={() => removeCustomModel(model.id)}
                                                            className='text-muted-foreground h-9 w-9 hover:bg-red-500/10 hover:text-red-600'
                                                            aria-label={`删除模型 ${model.id}`}>
                                                            <Trash2 className='h-4 w-4' />
                                                        </Button>
                                                    </div>
                                                    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                                                        {(
                                                            [
                                                                ['supportsCustomSize', '允许自定义尺寸'],
                                                                ['supportsEditing', '支持图片编辑'],
                                                                ['supportsMask', '支持蒙版'],
                                                                ['supportsQuality', '支持质量参数'],
                                                                ['supportsOutputFormat', '支持输出格式'],
                                                                ['supportsBackground', '支持背景参数'],
                                                                ['supportsModeration', '支持审核参数'],
                                                                ['supportsCompression', '支持压缩率'],
                                                                ['supportsStreaming', '支持流式预览']
                                                            ] as const
                                                        ).map(([capability, label]) => (
                                                            <div key={capability} className='flex items-center gap-2'>
                                                                <Checkbox
                                                                    id={`custom-${capability}-${model.id}`}
                                                                    checked={model.capabilities?.[capability] === true}
                                                                    onCheckedChange={(checked) =>
                                                                        updateCustomModelCapability(
                                                                            model.id,
                                                                            capability,
                                                                            checked
                                                                        )
                                                                    }
                                                                />
                                                                <Label
                                                                    htmlFor={`custom-${capability}-${model.id}`}
                                                                    className='text-muted-foreground cursor-pointer text-xs'>
                                                                    {label}
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className='grid gap-2 sm:grid-cols-4'>
                                                        <Input
                                                            value={model.defaultSize ?? ''}
                                                            onChange={(event) =>
                                                                updateCustomModelDefaultSize(
                                                                    model.id,
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder='默认尺寸 2K 或 2048x2048'
                                                            className='bg-background text-foreground h-9 rounded-xl text-xs sm:col-span-1'
                                                        />
                                                        <Input
                                                            value={model.sizePresets?.square ?? ''}
                                                            onChange={(event) =>
                                                                updateCustomModelSizePreset(
                                                                    model.id,
                                                                    'square',
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder='正方形 2048x2048'
                                                            className='bg-background text-foreground h-9 rounded-xl text-xs'
                                                        />
                                                        <Input
                                                            value={model.sizePresets?.landscape ?? ''}
                                                            onChange={(event) =>
                                                                updateCustomModelSizePreset(
                                                                    model.id,
                                                                    'landscape',
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder='横向 2560x1440'
                                                            className='bg-background text-foreground h-9 rounded-xl text-xs'
                                                        />
                                                        <Input
                                                            value={model.sizePresets?.portrait ?? ''}
                                                            onChange={(event) =>
                                                                updateCustomModelSizePreset(
                                                                    model.id,
                                                                    'portrait',
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder='纵向 1440x2560'
                                                            className='bg-background text-foreground h-9 rounded-xl text-xs'
                                                        />
                                                    </div>
                                                    <p className='text-muted-foreground text-xs'>
                                                        可为自定义模型覆盖能力、默认尺寸和预设；常用供应商参数会在生成表单中显示，JSON
                                                        仅作为新参数临时兜底。
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className='border-border bg-background/60 text-muted-foreground rounded-xl border border-dashed p-3 text-sm'>
                                            还没有自定义模型。系统预置模型仍会正常显示。
                                        </p>
                                    )}
                                </ProviderSection>
                            </div>
                        )}

                        {settingsView === 'vision-text' && (
                            <div className='space-y-4'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setSettingsView('main')}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                                    <ArrowLeft className='h-4 w-4' />
                                    {t('settings.backToMain')}
                                </Button>

                                <div className='rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-950 dark:text-emerald-100'>
                                    {t('settings.visionText.banner')}
                                </div>

                                <ProviderSection
                                    title={t('settings.visionText.model.title')}
                                    description={t('settings.visionText.model.description')}
                                    icon={<Settings className='h-4 w-4' />}
                                    defaultOpen>
                                    <div className='space-y-3'>
                                        <ProviderEndpointModelBindingPicker
                                            task='vision.text'
                                            title={t('settings.taskDefaults.visionText.title')}
                                            description={t('settings.taskDefaults.visionText.description')}
                                            allowedCompatibilityFamilies={
                                                VISION_TEXT_MODEL_BINDING_COMPATIBILITY_FAMILIES
                                            }
                                            providerEndpoints={providerEndpoints}
                                            modelCatalog={modelCatalog}
                                            modelTaskDefaultCatalogEntryIds={modelTaskDefaultCatalogEntryIds}
                                            selectedEndpointId={
                                                selectedVisionTextProviderInstanceId ||
                                                visionTextCatalogSelection.endpoint?.id ||
                                                ''
                                            }
                                            onSelectedEndpointIdChange={(value) => {
                                                const endpoint = providerEndpoints.find((item) => item.id === value);
                                                setSelectedVisionTextProviderInstanceId(value);
                                                setVisionTextModelId('');
                                                if (endpoint) {
                                                    setVisionTextApiCompatibility(
                                                        endpoint.protocol === 'openai-responses' &&
                                                            endpoint.provider !== 'anthropic' &&
                                                            endpoint.provider !== 'anthropic-compatible'
                                                            ? 'responses'
                                                            : 'chat-completions'
                                                    );
                                                }
                                                setModelTaskDefaultCatalogEntryIds((current) => {
                                                    const next = { ...current };
                                                    delete next['vision.text'];
                                                    return next;
                                                });
                                            }}
                                            onChooseModel={(endpoint) =>
                                                openTaskBindingModelManager('vision.text', endpoint)
                                            }
                                            onManageEndpoint={handleManagePromptBindingEndpoint}
                                            onAddEndpoint={handleAddPromptBindingEndpoint}
                                            t={t}
                                        />
                                        {!hasVisionTextCompatibleEndpoints && (
                                            <p className='text-muted-foreground text-xs leading-5'>
                                                {t('settings.visionText.model.noEndpointNote')}
                                            </p>
                                        )}
                                    </div>
                                </ProviderSection>

                                <ProviderSection
                                    title={t('settings.visionText.options.title')}
                                    description={t('settings.visionText.options.description')}
                                    icon={<SlidersHorizontal className='h-4 w-4' />}
                                    defaultOpen>
                                    <div className='space-y-4'>
                                        <div className='grid gap-3 sm:grid-cols-2'>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.visionText.taskType.label')}
                                                </Label>
                                                <Select
                                                    value={visionTextTaskType}
                                                    onValueChange={(value) =>
                                                        setVisionTextTaskType(value as typeof visionTextTaskType)
                                                    }>
                                                    <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(VISION_TEXT_TASK_TYPE_LABELS).map(
                                                            ([value, label]) => (
                                                                <SelectItem key={value} value={value}>
                                                                    {label}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.visionText.detail.label')}
                                                </Label>
                                                <Select
                                                    value={visionTextDetail}
                                                    onValueChange={(value) =>
                                                        setVisionTextDetail(value as typeof visionTextDetail)
                                                    }>
                                                    <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(VISION_TEXT_DETAIL_LABELS).map(
                                                            ([value, label]) => (
                                                                <SelectItem key={value} value={value}>
                                                                    {label}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.visionText.outputTarget.label')}
                                                </Label>
                                                <Select
                                                    value={visionTextResponseFormat}
                                                    onValueChange={(value) => {
                                                        setVisionTextResponseFormat(
                                                            value as typeof visionTextResponseFormat
                                                        );
                                                        setVisionTextStructuredOutputEnabled(value === 'json_schema');
                                                    }}>
                                                    <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='text'>
                                                            {t('settings.visionText.outputTarget.text')}
                                                        </SelectItem>
                                                        <SelectItem value='json_schema'>
                                                            {t('settings.visionText.outputTarget.structured')}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    {t('settings.visionText.maxOutputTokens.label')}
                                                </Label>
                                                <Input
                                                    type='number'
                                                    min={256}
                                                    max={32768}
                                                    step={256}
                                                    value={visionTextMaxOutputTokens}
                                                    onChange={(event) =>
                                                        setVisionTextMaxOutputTokens(
                                                            Number(event.target.value) ||
                                                                DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS
                                                        )
                                                    }
                                                    className='bg-background text-foreground h-10 rounded-xl'
                                                />
                                                <p className='text-muted-foreground text-xs leading-5'>
                                                    {t('settings.visionText.maxOutputTokens.description')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className='grid gap-3 sm:grid-cols-2'>
                                            <div className='border-border bg-muted/30 flex items-start gap-3 rounded-xl border p-3'>
                                                <Checkbox
                                                    id='vision-default-stream'
                                                    checked={visionTextStreamingEnabled}
                                                    onCheckedChange={(checked) =>
                                                        setVisionTextStreamingEnabled(!!checked)
                                                    }
                                                    className='mt-0.5'
                                                />
                                                <div className='min-w-0 space-y-1'>
                                                    <Label
                                                        htmlFor='vision-default-stream'
                                                        className='cursor-pointer text-sm font-medium'>
                                                        {t('settings.visionText.realtimeOutput.label')}
                                                    </Label>
                                                    <p className='text-muted-foreground text-xs leading-5'>
                                                        {t('settings.visionText.realtimeOutput.description')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className='border-border bg-muted/30 flex items-start gap-3 rounded-xl border p-3'>
                                                <Checkbox
                                                    id='vision-text-history-enabled-settings'
                                                    checked={visionTextHistoryEnabled}
                                                    onCheckedChange={(checked) =>
                                                        setVisionTextHistoryEnabled(checked === true)
                                                    }
                                                    className='mt-0.5'
                                                />
                                                <div className='min-w-0 space-y-1'>
                                                    <Label
                                                        htmlFor='vision-text-history-enabled-settings'
                                                        className='cursor-pointer text-sm font-medium'>
                                                        {t('settings.visionText.history.label')}
                                                    </Label>
                                                    <p className='text-muted-foreground text-xs leading-5'>
                                                        {t('settings.visionText.history.description')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className='space-y-2'>
                                            <Label className='text-muted-foreground text-xs'>
                                                {t('settings.visionText.systemPrompt.label')}
                                            </Label>
                                            <Textarea
                                                value={visionTextSystemPrompt}
                                                onChange={(event) => setVisionTextSystemPrompt(event.target.value)}
                                                className='bg-background text-foreground min-h-32 rounded-xl'
                                            />
                                            <p className='text-muted-foreground text-xs leading-5'>
                                                {t('settings.visionText.systemPrompt.description')}
                                            </p>
                                        </div>
                                    </div>
                                </ProviderSection>
                            </div>
                        )}

                        {settingsView === 'polish-prompts' && (
                            <div className='space-y-4'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => setSettingsView('main')}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground min-h-[44px] rounded-xl px-3'>
                                    <ArrowLeft className='h-4 w-4' />
                                    返回系统配置
                                </Button>

                                <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                    {t('settings.polish.banner')}
                                    {hasEnvPolishingPrompt && polishingCustomPrompts.length === 0 && (
                                        <span className='mt-1 block text-violet-900/80 dark:text-violet-100/75'>
                                            {t('settings.polish.envPromptNotice')}
                                        </span>
                                    )}
                                </div>

                                <ProviderSection
                                    title={t('settings.polish.modelSelection.title')}
                                    description={t('settings.polish.modelSelection.description')}
                                    icon={<Settings className='h-4 w-4' />}
                                    defaultOpen>
                                    <div className='space-y-3'>
                                        {!hasPromptPolishCompatibleEndpoints && (
                                            <div className='border-border bg-muted/30 flex flex-col gap-3 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
                                                <div className='min-w-0 space-y-1'>
                                                    <p className='text-foreground font-medium'>
                                                        {t('settings.modelBinding.noEligibleEndpointsTitle')}
                                                    </p>
                                                    <p className='text-muted-foreground text-xs leading-5'>
                                                        {t('settings.modelBinding.noEligibleEndpointsDescription')}
                                                    </p>
                                                </div>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={handleAddPromptBindingEndpoint}
                                                    className='min-h-[40px] shrink-0 rounded-xl'>
                                                    <Plus className='h-4 w-4' />
                                                    {t('settings.polish.addEndpoint')}
                                                </Button>
                                            </div>
                                        )}
                                        <div className='grid gap-3'>
                                            {promptModelSelectionRows.map((row) => (
                                                <ProviderEndpointModelBindingPicker
                                                    key={row.task}
                                                    task={row.task}
                                                    title={t(row.titleKey)}
                                                    description={t(row.descriptionKey)}
                                                    allowedCompatibilityFamilies={
                                                        PROMPT_MODEL_BINDING_COMPATIBILITY_FAMILIES
                                                    }
                                                    providerEndpoints={providerEndpoints}
                                                    modelCatalog={modelCatalog}
                                                    modelTaskDefaultCatalogEntryIds={modelTaskDefaultCatalogEntryIds}
                                                    selectedEndpointId={promptModelSelectionEndpointIds[row.task]}
                                                    showEmptyState={false}
                                                    onSelectedEndpointIdChange={(value) => {
                                                        setPromptModelSelectionEndpointIds((current) => ({
                                                            ...current,
                                                            [row.task]: value
                                                        }));
                                                        setModelTaskDefaultCatalogEntryIds((current) => {
                                                            const next = { ...current };
                                                            delete next[row.task];
                                                            return next;
                                                        });
                                                    }}
                                                    onChooseModel={(endpoint) =>
                                                        openTaskBindingModelManager(row.task, endpoint)
                                                    }
                                                    onManageEndpoint={handleManagePromptBindingEndpoint}
                                                    onAddEndpoint={handleAddPromptBindingEndpoint}
                                                    t={t}
                                                />
                                            ))}
                                        </div>
                                        <div className='grid gap-3 sm:grid-cols-2'>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>思考模式</Label>
                                                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                                    <button
                                                        type='button'
                                                        onClick={() => setPolishingThinkingEnabled(false)}
                                                        aria-pressed={!polishingThinkingEnabled}
                                                        className={`focus-visible:ring-ring/50 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none ${!polishingThinkingEnabled ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                        关闭思考
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => setPolishingThinkingEnabled(true)}
                                                        aria-pressed={polishingThinkingEnabled}
                                                        className={`focus-visible:ring-ring/50 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none ${polishingThinkingEnabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                        开启思考
                                                    </button>
                                                </div>
                                            </div>
                                            <div className='space-y-2'>
                                                <Label className='text-muted-foreground text-xs'>
                                                    思考强度参数格式
                                                </Label>
                                                <Select
                                                    value={polishingThinkingEffortFormat}
                                                    onValueChange={(value) =>
                                                        setPolishingThinkingEffortFormat(
                                                            normalizePromptPolishThinkingEffortFormat(value)
                                                        )
                                                    }
                                                    disabled={!polishingThinkingEnabled}>
                                                    <SelectTrigger className='bg-background text-foreground h-10 rounded-xl disabled:cursor-not-allowed disabled:opacity-50'>
                                                        <SelectValue placeholder='选择兼容格式' />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(polishingThinkingFormatLabels).map(
                                                            ([value, label]) => (
                                                                <SelectItem key={value} value={value}>
                                                                    {label}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className='space-y-2'>
                                            <Label className='text-muted-foreground text-xs'>思考强度</Label>
                                            <Input
                                                list='polishing-thinking-effort-presets'
                                                value={polishingThinkingEffort}
                                                onChange={(event) => setPolishingThinkingEffort(event.target.value)}
                                                placeholder={
                                                    envPolishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT
                                                }
                                                autoComplete='off'
                                                spellCheck={false}
                                                disabled={!polishingThinkingEnabled}
                                                className='bg-background text-foreground h-10 rounded-xl font-mono disabled:cursor-not-allowed disabled:opacity-50'
                                            />
                                        </div>
                                        <div className='space-y-2'>
                                            <Label className='text-muted-foreground text-xs'>默认内置预设</Label>
                                            <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                                                {PROMPT_POLISH_PRESETS.map((preset) => {
                                                    const selected = polishingPresetId === preset.id;
                                                    return (
                                                        <button
                                                            key={preset.id}
                                                            type='button'
                                                            aria-pressed={selected}
                                                            onClick={() => setPolishingPresetId(preset.id)}
                                                            className={`rounded-xl border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none ${selected ? 'text-foreground border-violet-500/50 bg-violet-500/10 shadow-sm ring-1 shadow-violet-500/10 ring-violet-500/20' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground hover:border-violet-300/50'}`}>
                                                            <span className='block text-sm font-medium'>
                                                                {preset.label}
                                                            </span>
                                                            <span className='text-muted-foreground mt-0.5 block text-[11px]'>
                                                                {preset.description}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <p className='text-muted-foreground text-xs'>
                                            {t('settings.polish.taskDefaults.note')}
                                        </p>
                                    </div>
                                </ProviderSection>

                                <div className='space-y-3'>
                                    <div className='flex flex-wrap items-center justify-between gap-2'>
                                        <div className='flex items-center gap-2'>
                                            <Label className='flex items-center gap-2'>
                                                <Sparkles className='text-muted-foreground h-4 w-4' />
                                                自定义润色提示词
                                            </Label>
                                            {polishingCustomPrompts.length > 0
                                                ? statusBadge(`${polishingCustomPrompts.length} 条`, 'green')
                                                : statusBadge('未添加', 'amber')}
                                        </div>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            onClick={() => {
                                                setPolishPromptEditIndex(-1);
                                                setNewPolishPromptName('');
                                                setNewPolishPromptSystemPrompt('');
                                            }}
                                            className='min-h-[44px] rounded-xl'>
                                            <Plus className='h-4 w-4' />
                                            添加提示词
                                        </Button>
                                    </div>

                                    {polishPromptEditIndex !== null && (
                                        <div className='border-border bg-background/70 space-y-3 rounded-xl border p-3'>
                                            <p className='text-foreground text-sm font-medium'>
                                                {polishPromptEditIndex >= 0 ? '编辑提示词' : '新增提示词'}
                                            </p>
                                            <div className='space-y-2'>
                                                <Label
                                                    htmlFor='new-polish-prompt-name'
                                                    className='text-muted-foreground text-xs'>
                                                    名称
                                                </Label>
                                                <Input
                                                    id='new-polish-prompt-name'
                                                    value={newPolishPromptName}
                                                    onChange={(e) => setNewPolishPromptName(e.target.value)}
                                                    placeholder='例如：电商文案专用'
                                                    className='bg-background text-foreground h-10 rounded-xl'
                                                />
                                            </div>
                                            <div className='space-y-2'>
                                                <Label
                                                    htmlFor='new-polish-prompt-system'
                                                    className='text-muted-foreground text-xs'>
                                                    系统提示词
                                                </Label>
                                                <Textarea
                                                    id='new-polish-prompt-system'
                                                    value={newPolishPromptSystemPrompt}
                                                    onChange={(e) => setNewPolishPromptSystemPrompt(e.target.value)}
                                                    placeholder='输入完整提示词...'
                                                    className='bg-background text-foreground min-h-24 rounded-xl text-sm'
                                                />
                                            </div>
                                            <div className='flex gap-2'>
                                                <Button
                                                    type='button'
                                                    onClick={() => {
                                                        const name = newPolishPromptName.trim();
                                                        const systemPrompt = newPolishPromptSystemPrompt.trim();
                                                        if (!name || !systemPrompt) return;
                                                        if (polishPromptEditIndex >= 0) {
                                                            setPolishingCustomPrompts((prev) =>
                                                                prev.map((p, idx) =>
                                                                    idx === polishPromptEditIndex
                                                                        ? {
                                                                              ...p,
                                                                              name,
                                                                              systemPrompt,
                                                                              updatedAt: Date.now()
                                                                          }
                                                                        : p
                                                                )
                                                            );
                                                        } else {
                                                            const id = `custom-${Date.now()}`;
                                                            setPolishingCustomPrompts((prev) => [
                                                                ...prev,
                                                                {
                                                                    id,
                                                                    name,
                                                                    systemPrompt,
                                                                    createdAt: Date.now()
                                                                }
                                                            ]);
                                                            setPolishPickerOrder((prev) => {
                                                                if (prev.includes(id)) return prev;
                                                                const temporaryIndex =
                                                                    prev.indexOf(POLISH_PICKER_TOKEN_TEMPORARY);
                                                                if (temporaryIndex === -1) return [...prev, id];
                                                                return [
                                                                    ...prev.slice(0, temporaryIndex),
                                                                    id,
                                                                    ...prev.slice(temporaryIndex)
                                                                ];
                                                            });
                                                        }
                                                        setPolishPromptEditIndex(null);
                                                        setNewPolishPromptName('');
                                                        setNewPolishPromptSystemPrompt('');
                                                    }}
                                                    className='min-h-[44px] rounded-xl bg-violet-600 text-white hover:bg-violet-500'>
                                                    保存
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    onClick={() => {
                                                        setPolishPromptEditIndex(null);
                                                        setNewPolishPromptName('');
                                                        setNewPolishPromptSystemPrompt('');
                                                    }}
                                                    className='min-h-[44px] rounded-xl'>
                                                    取消
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {polishingCustomPrompts.map((prompt, idx) => (
                                        <div
                                            key={prompt.id}
                                            className='border-border bg-background/70 space-y-2 rounded-xl border p-3'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <p className='text-foreground truncate text-sm font-semibold'>
                                                    {prompt.name}
                                                </p>
                                                <div className='flex items-center gap-1'>
                                                    <IconButton
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() =>
                                                            setPolishingCustomPrompts((prev) => {
                                                                if (idx <= 0) return prev;
                                                                const next = [...prev];
                                                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                                                return next;
                                                            })
                                                        }
                                                        disabled={idx === 0}
                                                        aria-label='上移'>
                                                        <MoveUp className='h-3.5 w-3.5' />
                                                    </IconButton>
                                                    <IconButton
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() =>
                                                            setPolishingCustomPrompts((prev) => {
                                                                if (idx >= prev.length - 1) return prev;
                                                                const next = [...prev];
                                                                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                                                return next;
                                                            })
                                                        }
                                                        disabled={idx === polishingCustomPrompts.length - 1}
                                                        aria-label='下移'>
                                                        <MoveDown className='h-3.5 w-3.5' />
                                                    </IconButton>
                                                    <IconButton
                                                        variant='ghost'
                                                        size='sm'
                                                        tone='destructive'
                                                        onClick={() => {
                                                            setPolishingCustomPrompts((prev) =>
                                                                prev.filter((_, k) => k !== idx)
                                                            );
                                                            setPolishPickerOrder((prev) =>
                                                                prev.filter((t) => t !== prompt.id)
                                                            );
                                                        }}
                                                        aria-label='删除提示词'>
                                                        <Trash2 className='h-3.5 w-3.5' />
                                                    </IconButton>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() => {
                                                            setPolishPromptEditIndex(idx);
                                                            setNewPolishPromptName(prompt.name);
                                                            setNewPolishPromptSystemPrompt(prompt.systemPrompt);
                                                        }}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground h-8 min-h-[32px] rounded-md px-2 text-xs'>
                                                        编辑
                                                    </Button>
                                                </div>
                                            </div>
                                            <pre className='text-muted-foreground max-h-24 overflow-y-auto text-xs leading-5 break-words whitespace-pre-wrap'>
                                                {prompt.systemPrompt}
                                            </pre>
                                        </div>
                                    ))}

                                    {polishingCustomPrompts.length === 0 && polishPromptEditIndex === null && (
                                        <p className='border-border bg-background/60 text-muted-foreground rounded-xl border border-dashed p-3 text-sm'>
                                            还没有自定义提示词。点击「添加提示词」创建。
                                        </p>
                                    )}
                                </div>

                                <div className='space-y-3'>
                                    <Label className='flex items-center gap-2'>
                                        <SlidersHorizontal className='text-muted-foreground h-4 w-4' />
                                        润色下拉选择顺序
                                    </Label>
                                    <p className='text-muted-foreground text-xs'>
                                        调整润色弹出窗口中各选项的显示顺序。
                                    </p>

                                    {polishPickerOrder.map((token, idx) => {
                                        let label = '';
                                        let description = '';
                                        const savedPrompt = polishingCustomPrompts.find((p) => p.id === token);
                                        const builtInPreset = PROMPT_POLISH_PRESETS.find((p) => p.id === token);

                                        if (token === POLISH_PICKER_TOKEN_DEFAULT) {
                                            label = '使用默认内置';
                                            description = `当前默认内置：${PROMPT_POLISH_PRESETS.find((p) => p.id === polishingPresetId)?.label || '均衡润色'}`;
                                        } else if (token === POLISH_PICKER_TOKEN_TEMPORARY) {
                                            label = '临时自定义';
                                            description = '本次手动输入，不保存';
                                        } else if (savedPrompt) {
                                            label = savedPrompt.name;
                                            description = savedPrompt.systemPrompt.slice(0, 60);
                                        } else if (builtInPreset) {
                                            label = builtInPreset.label;
                                            description = builtInPreset.description;
                                        } else {
                                            label = token;
                                            description = '未知项';
                                        }

                                        return (
                                            <div
                                                key={token}
                                                className='border-border bg-background/70 flex items-center gap-2 rounded-xl border px-3 py-2.5'>
                                                <span className='min-h-[32px] min-w-0 flex-1'>
                                                    <span className='text-foreground block truncate text-sm font-medium'>
                                                        {label}
                                                    </span>
                                                    <span className='text-muted-foreground block truncate text-xs'>
                                                        {description}
                                                    </span>
                                                </span>
                                                <div className='flex shrink-0 items-center gap-1'>
                                                    <IconButton
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() =>
                                                            setPolishPickerOrder((prev) => {
                                                                if (idx <= 0) return prev;
                                                                const next = [...prev];
                                                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                                                return next;
                                                            })
                                                        }
                                                        disabled={idx === 0}
                                                        aria-label='上移'>
                                                        <MoveUp className='h-3.5 w-3.5' />
                                                    </IconButton>
                                                    <IconButton
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={() =>
                                                            setPolishPickerOrder((prev) => {
                                                                if (idx >= prev.length - 1) return prev;
                                                                const next = [...prev];
                                                                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                                                return next;
                                                            })
                                                        }
                                                        disabled={idx === polishPickerOrder.length - 1}
                                                        aria-label='下移'>
                                                        <MoveDown className='h-3.5 w-3.5' />
                                                    </IconButton>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className='border-border bg-background/95 shrink-0 border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6 sm:pb-4'>
                        <div className='mr-auto space-y-1'>
                            {saved && (
                                <p className='text-xs text-emerald-600 dark:text-emerald-300'>
                                    {t('settings.saveSuccess')}
                                </p>
                            )}
                            {saveWarningMessage && (
                                <p className='max-w-md text-xs leading-5 text-amber-700 dark:text-amber-300'>
                                    {saveWarningMessage}
                                </p>
                            )}
                        </div>
                        <Button variant='outline' onClick={() => handleDialogOpenChange(false)} className='rounded-xl'>
                            取消
                        </Button>
                        <Button
                            onClick={handleSave}
                            className='disabled:from-muted disabled:to-muted disabled:text-muted-foreground rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 hover:brightness-110 disabled:shadow-none'>
                            保存配置
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
                <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>放弃未保存的配置？</DialogTitle>
                        <DialogDescription>当前配置有未保存修改。关闭后这些修改不会写入本机存储。</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className='gap-2 sm:justify-end'>
                        <DialogClose asChild>
                            <Button type='button' variant='outline'>
                                继续编辑
                            </Button>
                        </DialogClose>
                        <Button type='button' variant='destructive' onClick={handleConfirmDiscardChanges}>
                            放弃修改
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ModelListManagerDialog
                state={modelManagerDialog}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) setModelManagerDialog(null);
                }}
                t={t}
            />
        </>
    );
}
