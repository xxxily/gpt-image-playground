'use client';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNotice } from '@/components/notice-provider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatClientDirectLinkRestriction, getClientDirectLinkRestriction } from '@/lib/connection-policy';
import { loadConfig, saveConfig, type AppConfig } from '@/lib/config';
import { DESKTOP_APP_DOWNLOAD_URL, DESKTOP_ONLY_SETTINGS_MESSAGE } from '@/lib/desktop-guidance';
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
import { handleExternalLinkClick, invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import { buildDiscoverProviderModelsRequest, discoverProviderModels } from '@/lib/model-discovery';
import { getAllImageModels, getProviderLabel, IMAGE_MODEL_IDS, IMAGE_PROVIDER_ORDER, normalizeCustomImageModels, type CustomImageModelCapabilities, type ImageProviderId, type StoredCustomImageModel } from '@/lib/model-registry';
import { SEEDREAM_DEFAULT_BASE_URL, SENSENOVA_DEFAULT_BASE_URL, getProviderDefaultBaseUrl } from '@/lib/provider-config';
import {
    getCatalogEntryLabel,
    inferModelCatalogCapabilities,
    normalizeUnifiedProviderModelConfig,
    upsertDiscoveredModelCatalogEntries,
    type ModelCatalogEntry,
    type ModelTaskCapability,
    type ModelTaskDefaultCatalogEntryIds,
    type ProviderEndpoint
} from '@/lib/provider-model-catalog';
import {
    createProviderInstanceId,
    getProviderInstanceHostname,
    normalizeProviderInstances,
    type ProviderInstance
} from '@/lib/provider-instances';
import { DEFAULT_VISION_TEXT_MODEL } from '@/lib/vision-text-model-registry';
import {
    createVisionTextProviderInstanceId,
    getDefaultVisionTextProviderInstanceName,
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
    VISION_TEXT_API_COMPATIBILITY_LABELS,
    VISION_TEXT_DETAIL_LABELS,
    VISION_TEXT_TASK_TYPE_LABELS,
    type VisionTextApiCompatibility,
    type VisionTextDetail,
    type VisionTextProviderKind,
    type VisionTextResponseFormat,
    type VisionTextTaskType
} from '@/lib/vision-text-types';
import {
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_MODEL,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
    DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
    POLISH_PICKER_TOKEN_DEFAULT,
    POLISH_PICKER_TOKEN_TEMPORARY,
    PROMPT_POLISH_PRESETS,
    PROMPT_POLISH_THINKING_EFFORT_OPTIONS,
    getDefaultPolishPickerOrder,
    normalizePolishPickerOrder,
    normalizePromptPolishThinkingEffortFormat,
    normalizePromptPolishPresetId,
    normalizeStoredCustomPolishPrompts,
    type PolishPickerToken,
    type StoredCustomPolishPrompt,
    type PromptPolishThinkingEffortFormat
} from '@/lib/prompt-polish-core';
import { DEFAULT_PROMPT_HISTORY_LIMIT, normalizePromptHistoryLimit } from '@/lib/prompt-history';
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
    Key,
    Plus,
    Radio,
    ScanEye,
    History,
    MoveDown,
    MoveUp,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Wifi,
    Bug,
    Cloud,
    Loader2,
    RefreshCw
} from 'lucide-react';
import * as React from 'react';

import {
    DEFAULT_SYNC_AUTO_SYNC_SETTINGS,
    DEFAULT_SYNC_CONFIG,
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

type SettingsDialogProps = {
    onConfigChange: (config: Partial<AppConfig>) => void;
};

type SettingsView = 'main' | 'providers' | 'vision-text' | 'polish-prompts';

const AUTO_SYNC_SCOPE_OPTIONS: Array<{ key: keyof SyncAutoSyncScopes; label: string; description: string }> = [
    { key: 'appConfig', label: '应用配置', description: '模型、接口、存储方式等非敏感设置。' },
    { key: 'polishingPrompts', label: '自定义润色提示词', description: '润色系统提示词、预设和自定义润色提示词。' },
    { key: 'promptHistory', label: '提示词历史', description: '输入过的提示词记录。' },
    { key: 'promptTemplates', label: '提示词库', description: '用户自定义提示词模板。' },
    { key: 'imageHistory', label: '生成历史记录', description: '历史条目、提示词、参数和图片文件名。' },
    { key: 'imageBlobs', label: '历史图片文件', description: '只上传新增或变化的历史图片文件。' }
];

type InitialConfig = {
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
    customImageModels: StoredCustomImageModel[];
    polishingApiKey: string;
    polishingApiBaseUrl: string;
    polishingModelId: string;
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

function statusBadge(label: string, tone: 'green' | 'blue' | 'amber') {
    const toneClass = tone === 'green'
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

const polishingThinkingFormatDescriptions: Record<PromptPolishThinkingEffortFormat, string> = {
    openai: '发送 thinking.type 与 reasoning_effort。',
    anthropic: '发送 thinking.type 与 output_config.effort。',
    both: '同时发送三种字段，适合明确支持混合参数的中转。'
};

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
        <section className='rounded-2xl border border-border bg-card/80 shadow-sm dark:bg-white/[0.025]'>
            <button
                type='button'
                onClick={() => setOpen((value) => !value)}
                className='flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                aria-expanded={open}>
                <span className='min-w-0'>
                    <span className='flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground'>
                        {icon && <span className='text-muted-foreground' aria-hidden='true'>{icon}</span>}
                        {title}
                    </span>
                    <span className='mt-1 block text-sm text-muted-foreground'>{description}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className='space-y-4 border-t border-border p-4'>{children}</div>}
        </section>
    );
}

function SecretInput({
    id,
    value,
    onChange,
    visible,
    onVisibleChange,
    placeholder
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
    onVisibleChange: () => void;
    placeholder: string;
}) {
    return (
        <div className='relative'>
            <Input
                id={id}
                name={`${id}-not-password`}
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                spellCheck={false}
                autoComplete='one-time-code'
                autoCorrect='off'
                autoCapitalize='none'
                data-1p-ignore='true'
                data-bwignore='true'
                data-lpignore='true'
                className='h-10 rounded-xl bg-background pr-10 text-foreground'
            />
            <button
                type='button'
                onClick={onVisibleChange}
                className='absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
                aria-label={visible ? '隐藏 API Key' : '显示 API Key'}>
                {visible ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
            </button>
        </div>
    );
}

type ProviderApiConfigMetadata = {
    title: string;
    description: string;
    icon: React.ReactNode;
    apiKeyId: string;
    apiKeyLabel: string;
    apiKeyValue: string;
    onApiKeyChange: (value: string) => void;
    apiKeyVisible: boolean;
    onApiKeyVisibleChange: () => void;
    apiKeyPlaceholder: string;
    apiKeyStatus: React.ReactNode;
    apiKeyHint?: string;
    baseUrlId: string;
    baseUrlLabel: string;
    baseUrlValue: string;
    onBaseUrlChange: (value: string) => void;
    baseUrlPlaceholder: string;
    baseUrlStatus: React.ReactNode;
    baseUrlHint?: string;
};

function providerLabel(provider: ImageProviderId): string {
    return getProviderLabel(provider);
}

export function SettingsDialog({ onConfigChange }: SettingsDialogProps) {
    const { addNotice } = useNotice();
    const [open, setOpen] = React.useState(false);
    const [settingsView, setSettingsView] = React.useState<SettingsView>('main');
    const [apiKey, setApiKey] = React.useState('');
    const [showApiKey, setShowApiKey] = React.useState(false);
    const [apiBaseUrl, setApiBaseUrl] = React.useState('');
    const [geminiApiKey, setGeminiApiKey] = React.useState('');
    const [showGeminiApiKey, setShowGeminiApiKey] = React.useState(false);
    const [geminiApiBaseUrl, setGeminiApiBaseUrl] = React.useState('');
    const [sensenovaApiKey, setSensenovaApiKey] = React.useState('');
    const [showSensenovaApiKey, setShowSensenovaApiKey] = React.useState(false);
    const [sensenovaApiBaseUrl, setSensenovaApiBaseUrl] = React.useState('');
    const [seedreamApiKey, setSeedreamApiKey] = React.useState('');
    const [showSeedreamApiKey, setShowSeedreamApiKey] = React.useState(false);
    const [seedreamApiBaseUrl, setSeedreamApiBaseUrl] = React.useState('');
    const [polishingApiKey, setPolishingApiKey] = React.useState('');
    const [showPolishingApiKey, setShowPolishingApiKey] = React.useState(false);
    const [polishingApiBaseUrl, setPolishingApiBaseUrl] = React.useState('');
    const [polishingModelId, setPolishingModelId] = React.useState(DEFAULT_PROMPT_POLISH_MODEL);
    const [polishingPrompt, setPolishingPrompt] = React.useState(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
    const [polishingPresetId, setPolishingPresetId] = React.useState(DEFAULT_POLISHING_PRESET_ID);
    const [polishingThinkingEnabled, setPolishingThinkingEnabled] = React.useState(DEFAULT_PROMPT_POLISH_THINKING_ENABLED);
    const [polishingThinkingEffort, setPolishingThinkingEffort] = React.useState(DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
    const [polishingThinkingEffortFormat, setPolishingThinkingEffortFormat] = React.useState<PromptPolishThinkingEffortFormat>(
        DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT
    );
    const [polishingCustomPrompts, setPolishingCustomPrompts] = React.useState<StoredCustomPolishPrompt[]>([]);
    const [polishPickerOrder, setPolishPickerOrder] = React.useState<PolishPickerToken[]>(getDefaultPolishPickerOrder());
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
    const [providerModelRefreshStatus, setProviderModelRefreshStatus] =
        React.useState<ProviderModelRefreshStatus>({});
    const [newProviderType, setNewProviderType] = React.useState<ImageProviderId>('openai');
    const [newProviderName, setNewProviderName] = React.useState('');
    const [newProviderApiKey, setNewProviderApiKey] = React.useState('');
    const [newProviderApiBaseUrl, setNewProviderApiBaseUrl] = React.useState('');
    const [providerApiKeyVisibility, setProviderApiKeyVisibility] = React.useState<Record<string, boolean>>({});
    const [newModelByProviderInstance, setNewModelByProviderInstance] = React.useState<Record<string, string>>({});
    const [visionTextProviderInstances, setVisionTextProviderInstances] = React.useState<VisionTextProviderInstance[]>([]);
    const [selectedVisionTextProviderInstanceId, setSelectedVisionTextProviderInstanceId] = React.useState('');
    const [newVisionTextProviderKind, setNewVisionTextProviderKind] =
        React.useState<VisionTextProviderKind>('openai');
    const [newVisionTextProviderName, setNewVisionTextProviderName] = React.useState('');
    const [newVisionTextProviderApiKey, setNewVisionTextProviderApiKey] = React.useState('');
    const [newVisionTextProviderApiBaseUrl, setNewVisionTextProviderApiBaseUrl] = React.useState('');
    const [newVisionTextProviderApiCompatibility, setNewVisionTextProviderApiCompatibility] =
        React.useState(DEFAULT_VISION_TEXT_API_COMPATIBILITY);
    const [visionTextProviderApiKeyVisibility, setVisionTextProviderApiKeyVisibility] = React.useState<Record<string, boolean>>({});
    const [visionTextModelId, setVisionTextModelId] = React.useState(DEFAULT_VISION_TEXT_MODEL);
    const [visionTextTaskType, setVisionTextTaskType] = React.useState<VisionTextTaskType>(DEFAULT_VISION_TEXT_TASK_TYPE);
    const [visionTextDetail, setVisionTextDetail] = React.useState<VisionTextDetail>(DEFAULT_VISION_TEXT_DETAIL);
    const [visionTextResponseFormat, setVisionTextResponseFormat] = React.useState<VisionTextResponseFormat>(DEFAULT_VISION_TEXT_RESPONSE_FORMAT);
    const [visionTextStreamingEnabled, setVisionTextStreamingEnabled] = React.useState(DEFAULT_VISION_TEXT_STREAMING_ENABLED);
    const [visionTextStructuredOutputEnabled, setVisionTextStructuredOutputEnabled] = React.useState(DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED);
    const [visionTextMaxOutputTokens, setVisionTextMaxOutputTokens] = React.useState(DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS);
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
    const [s3AllowRemoteDeletion, setS3AllowRemoteDeletion] = React.useState(DEFAULT_SYNC_CONFIG.s3.allowRemoteDeletion);
    const [s3RequestMode, setS3RequestMode] = React.useState<S3SyncRequestMode>(DEFAULT_SYNC_CONFIG.s3.requestMode);
    const [s3Prefix, setS3Prefix] = React.useState(DEFAULT_SYNC_CONFIG.s3.prefix);
    const [s3ProfileId, setS3ProfileId] = React.useState(DEFAULT_SYNC_CONFIG.s3.profileId);
    const [syncAutoSyncEnabled, setSyncAutoSyncEnabled] = React.useState(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.enabled);
    const [syncAutoSyncScopes, setSyncAutoSyncScopes] = React.useState<SyncAutoSyncScopes>(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.scopes);
    const [initialSyncConfigSnapshot, setInitialSyncConfigSnapshot] = React.useState('');
    const [hasEnvApiKey, setHasEnvApiKey] = React.useState(false);
    const [hasEnvApiBaseUrl, setHasEnvApiBaseUrl] = React.useState(false);
    const [envApiBaseUrl, setEnvApiBaseUrl] = React.useState('');
    const [hasEnvGeminiApiKey, setHasEnvGeminiApiKey] = React.useState(false);
    const [hasEnvGeminiApiBaseUrl, setHasEnvGeminiApiBaseUrl] = React.useState(false);
    const [envGeminiApiBaseUrl, setEnvGeminiApiBaseUrl] = React.useState('');
    const [hasEnvSensenovaApiKey, setHasEnvSensenovaApiKey] = React.useState(false);
    const [hasEnvSensenovaApiBaseUrl, setHasEnvSensenovaApiBaseUrl] = React.useState(false);
    const [envSensenovaApiBaseUrl, setEnvSensenovaApiBaseUrl] = React.useState('');
    const [hasEnvSeedreamApiKey, setHasEnvSeedreamApiKey] = React.useState(false);
    const [hasEnvSeedreamApiBaseUrl, setHasEnvSeedreamApiBaseUrl] = React.useState(false);
    const [envSeedreamApiBaseUrl, setEnvSeedreamApiBaseUrl] = React.useState('');
    const [hasEnvPolishingApiKey, setHasEnvPolishingApiKey] = React.useState(false);
    const [hasEnvPolishingApiBaseUrl, setHasEnvPolishingApiBaseUrl] = React.useState(false);
    const [envPolishingApiBaseUrl, setEnvPolishingApiBaseUrl] = React.useState('');
    const [envPolishingModelId, setEnvPolishingModelId] = React.useState('');
    const [hasEnvPolishingPrompt, setHasEnvPolishingPrompt] = React.useState(false);
    const [envPolishingThinkingEnabled, setEnvPolishingThinkingEnabled] = React.useState('');
    const [envPolishingThinkingEffort, setEnvPolishingThinkingEffort] = React.useState('');
    const [envPolishingThinkingEffortFormat, setEnvPolishingThinkingEffortFormat] = React.useState('');
    const [hasEnvStorageMode, setHasEnvStorageMode] = React.useState(false);
    const [clientDirectLinkPriority, setClientDirectLinkPriority] = React.useState(false);
    const [serverHasAppPassword, setServerHasAppPassword] = React.useState(false);
    const [initialConfig, setInitialConfig] = React.useState<InitialConfig>({
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
        customImageModels: [],
        polishingApiKey: '',
        polishingApiBaseUrl: '',
        polishingModelId: DEFAULT_PROMPT_POLISH_MODEL,
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
        desktopProxyMode: 'disabled',
        desktopProxyUrl: '',
        desktopPromoServiceMode: 'current',
        desktopPromoServiceUrl: '',
        desktopDebugMode: false
    });
    const [maxConcurrentTasks, setMaxConcurrentTasks] = React.useState(3);
    const [promptHistoryLimit, setPromptHistoryLimit] = React.useState(DEFAULT_PROMPT_HISTORY_LIMIT);
    const [desktopProxyMode, setDesktopProxyMode] = React.useState<DesktopProxyMode>('disabled');
    const [desktopProxyUrl, setDesktopProxyUrl] = React.useState('');
    const [desktopPromoServiceMode, setDesktopPromoServiceMode] =
        React.useState<DesktopPromoServiceMode>('current');
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

    const currentSyncConfig = React.useMemo(() => normalizeSyncConfig({
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
        }
    }), [s3AccessKeyId, s3AllowRemoteDeletion, s3Bucket, s3Endpoint, s3ForcePathStyle, s3Prefix, s3ProfileId, s3Region, s3RequestMode, s3SecretAccessKey, syncAutoSyncEnabled, syncAutoSyncScopes]);
    const currentSyncConfigSnapshot = React.useMemo(() => JSON.stringify({
        s3: currentSyncConfig.s3,
        autoSync: currentSyncConfig.autoSync
    }), [currentSyncConfig]);
    const isS3Configured = isS3SyncConfigConfigured(currentSyncConfig.s3);

    const handleAutoSyncScopeChange = React.useCallback((key: keyof SyncAutoSyncScopes, checked: boolean) => {
        setSyncAutoSyncScopes((current) => ({ ...current, [key]: checked }));
    }, []);

    React.useEffect(() => {
        setIsDesktopRuntime(isTauriDesktop());
    }, []);

    React.useEffect(() => {
        if (!open) return;

        const config = loadConfig();
        const normalizedCustomModels = normalizeCustomImageModels(config.customImageModels);
        const normalizedProviderInstances = normalizeProviderInstances(config.providerInstances, config);
        const normalizedVisionTextProviderInstances = normalizeVisionTextProviderInstances(config.visionTextProviderInstances);
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
        setApiKey(config.openaiApiKey || '');
        setApiBaseUrl(config.openaiApiBaseUrl || '');
        setGeminiApiKey(config.geminiApiKey || '');
        setGeminiApiBaseUrl(config.geminiApiBaseUrl || '');
        setSensenovaApiKey(config.sensenovaApiKey || '');
        setSensenovaApiBaseUrl(config.sensenovaApiBaseUrl || '');
        setSeedreamApiKey(config.seedreamApiKey || '');
        setSeedreamApiBaseUrl(config.seedreamApiBaseUrl || '');
        setProviderInstances(normalizedProviderInstances);
        setSelectedProviderInstanceId(config.selectedProviderInstanceId || '');
        setProviderEndpoints(normalizedUnifiedProviderModelConfig.providerEndpoints);
        setModelCatalog(normalizedUnifiedProviderModelConfig.modelCatalog);
        setModelTaskDefaultCatalogEntryIds(normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds);
        setModelCatalogSearch('');
        setProviderModelRefreshStatus({});
        setPolishingApiKey(config.polishingApiKey || '');
        setPolishingApiBaseUrl(config.polishingApiBaseUrl || '');
        setPolishingModelId(config.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL);
        setPolishingPrompt(config.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
        setPolishingPresetId(normalizePromptPolishPresetId(config.polishingPresetId));
        setPolishingThinkingEnabled(config.polishingThinkingEnabled);
        setPolishingThinkingEffort(config.polishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT);
        setPolishingThinkingEffortFormat(normalizePromptPolishThinkingEffortFormat(config.polishingThinkingEffortFormat));
        setPolishingCustomPrompts(normalizedCustomPolishPrompts);
        setPolishPickerOrder(normalizedPolishPickerOrder);
        setPolishPromptEditIndex(null);
        setNewPolishPromptName('');
        setNewPolishPromptSystemPrompt('');
        setCustomImageModels(normalizedCustomModels);
        setVisionTextProviderInstances(normalizedVisionTextProviderInstances);
        setSelectedVisionTextProviderInstanceId(config.selectedVisionTextProviderInstanceId || '');
        setNewVisionTextProviderKind('openai');
        setNewVisionTextProviderName('');
        setNewVisionTextProviderApiKey('');
        setNewVisionTextProviderApiBaseUrl('');
        setNewVisionTextProviderApiCompatibility(DEFAULT_VISION_TEXT_API_COMPATIBILITY);
        setVisionTextProviderApiKeyVisibility({});
        setVisionTextModelId(config.visionTextModelId || DEFAULT_VISION_TEXT_MODEL);
        setVisionTextTaskType(config.visionTextTaskType || DEFAULT_VISION_TEXT_TASK_TYPE);
        setVisionTextDetail(config.visionTextDetail || DEFAULT_VISION_TEXT_DETAIL);
        setVisionTextResponseFormat(config.visionTextResponseFormat || DEFAULT_VISION_TEXT_RESPONSE_FORMAT);
        setVisionTextStreamingEnabled(config.visionTextStreamingEnabled);
        setVisionTextStructuredOutputEnabled(config.visionTextStructuredOutputEnabled);
        setVisionTextMaxOutputTokens(config.visionTextMaxOutputTokens || DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS);
        setVisionTextSystemPrompt(config.visionTextSystemPrompt || DEFAULT_VISION_TEXT_SYSTEM_PROMPT);
        setVisionTextApiCompatibility(config.visionTextApiCompatibility || DEFAULT_VISION_TEXT_API_COMPATIBILITY);
        setStorageMode(config.imageStorageMode || 'auto');
        setImageStoragePath(config.imageStoragePath || '');
        setConnectionMode(config.connectionMode || 'proxy');
        setMaxConcurrentTasks(config.maxConcurrentTasks || 3);
        setPromptHistoryLimit(normalizePromptHistoryLimit(config.promptHistoryLimit));
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
        setShowS3SecretAccessKey(false);
        setInitialSyncConfigSnapshot(JSON.stringify({
            s3: syncConfig.s3,
            autoSync: syncConfig.autoSync
        }));
        setS3Status(isS3SyncConfigConfigured(syncConfig.s3)
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
            : { configured: false, message: '当前浏览器尚未配置 S3 兼容对象存储。' });
        setS3TestResult(null);
        setImageStoragePathError('');
        setPromoServiceUrlError('');
        setSaveWarningMessage('');
        setDiscardConfirmOpen(false);
        setNewProviderType('openai');
        setNewProviderName('');
        setNewProviderApiKey('');
        setNewProviderApiBaseUrl('');
        setProviderApiKeyVisibility({});
        setNewModelByProviderInstance({});
        setSettingsView('main');
        setInitialConfig({
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
            visionTextApiCompatibility:
                config.visionTextApiCompatibility || DEFAULT_VISION_TEXT_API_COMPATIBILITY,
            customImageModels: normalizedCustomModels,
            polishingApiKey: config.polishingApiKey || '',
            polishingApiBaseUrl: config.polishingApiBaseUrl || '',
            polishingModelId: config.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL,
            polishingPrompt: config.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
            polishingPresetId: normalizePromptPolishPresetId(config.polishingPresetId),
            polishingThinkingEnabled: config.polishingThinkingEnabled,
            polishingThinkingEffort: config.polishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
            polishingThinkingEffortFormat: normalizePromptPolishThinkingEffortFormat(config.polishingThinkingEffortFormat),
            polishingCustomPrompts: normalizedCustomPolishPrompts,
            polishPickerOrder: normalizedPolishPickerOrder,
            storageMode: config.imageStorageMode || 'auto',
            imageStoragePath: config.imageStoragePath || '',
            connectionMode: config.connectionMode || 'proxy',
            maxConcurrentTasks: config.maxConcurrentTasks || 3,
            promptHistoryLimit: normalizePromptHistoryLimit(config.promptHistoryLimit),
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
                setHasEnvApiKey(data.hasEnvApiKey || false);
                setHasEnvApiBaseUrl(!!data.envApiBaseUrl);
                setEnvApiBaseUrl(typeof data.envApiBaseUrl === 'string' ? data.envApiBaseUrl : '');
                setHasEnvGeminiApiKey(data.hasEnvGeminiApiKey || false);
                setHasEnvGeminiApiBaseUrl(!!data.envGeminiApiBaseUrl);
                setEnvGeminiApiBaseUrl(typeof data.envGeminiApiBaseUrl === 'string' ? data.envGeminiApiBaseUrl : '');
                setHasEnvSensenovaApiKey(data.hasEnvSensenovaApiKey || false);
                setHasEnvSensenovaApiBaseUrl(!!data.envSensenovaApiBaseUrl);
                setEnvSensenovaApiBaseUrl(typeof data.envSensenovaApiBaseUrl === 'string' ? data.envSensenovaApiBaseUrl : '');
                setHasEnvSeedreamApiKey(data.hasEnvSeedreamApiKey || false);
                setHasEnvSeedreamApiBaseUrl(!!data.envSeedreamApiBaseUrl);
                setEnvSeedreamApiBaseUrl(typeof data.envSeedreamApiBaseUrl === 'string' ? data.envSeedreamApiBaseUrl : '');
                setHasEnvPolishingApiKey(data.hasEnvPolishingApiKey || false);
                setHasEnvPolishingApiBaseUrl(!!data.envPolishingApiBaseUrl);
                setEnvPolishingApiBaseUrl(typeof data.envPolishingApiBaseUrl === 'string' ? data.envPolishingApiBaseUrl : '');
                setEnvPolishingModelId(typeof data.envPolishingModelId === 'string' ? data.envPolishingModelId : '');
                setHasEnvPolishingPrompt(data.hasEnvPolishingPrompt || false);
                setEnvPolishingThinkingEnabled(typeof data.envPolishingThinkingEnabled === 'string' ? data.envPolishingThinkingEnabled : '');
                setEnvPolishingThinkingEffort(typeof data.envPolishingThinkingEffort === 'string' ? data.envPolishingThinkingEffort : '');
                setEnvPolishingThinkingEffortFormat(typeof data.envPolishingThinkingEffortFormat === 'string' ? data.envPolishingThinkingEffortFormat : '');
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

    const updateCustomModelCapability = React.useCallback((id: string, capability: keyof CustomImageModelCapabilities, enabled: boolean | string) => {
        setCustomImageModels((current) => current.map((model) => model.id === id ? {
            ...model,
            capabilities: { ...(model.capabilities ?? {}), [capability]: !!enabled }
        } : model));
    }, []);

    const updateCustomModelDefaultSize = React.useCallback((id: string, defaultSize: string) => {
        setCustomImageModels((current) => current.map((model) => model.id === id ? {
            ...model,
            defaultSize: defaultSize.trim() || undefined
        } : model));
    }, []);

    const updateCustomModelSizePreset = React.useCallback((id: string, preset: 'square' | 'landscape' | 'portrait', value: string) => {
        setCustomImageModels((current) => current.map((model) => {
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
        }));
    }, []);

    const rebuildProviderEndpoints = React.useCallback((
        nextProviderInstances: readonly ProviderInstance[],
        nextVisionTextProviderInstances: readonly VisionTextProviderInstance[] = visionTextProviderInstances,
        nextPolishingApiKey?: string,
        nextPolishingApiBaseUrl?: string
    ) => {
        const effectivePolishingApiKey = nextPolishingApiKey ?? polishingApiKey;
        const effectivePolishingApiBaseUrl = nextPolishingApiBaseUrl ?? polishingApiBaseUrl;
        const freshConfig = normalizeUnifiedProviderModelConfig(undefined, {
            openaiApiKey: apiKey,
            openaiApiBaseUrl: apiBaseUrl,
            geminiApiKey,
            geminiApiBaseUrl,
            sensenovaApiKey,
            sensenovaApiBaseUrl,
            seedreamApiKey,
            seedreamApiBaseUrl,
            polishingApiKey: effectivePolishingApiKey,
            polishingApiBaseUrl: effectivePolishingApiBaseUrl,
            providerInstances: nextProviderInstances,
            customImageModels,
            visionTextProviderInstances: nextVisionTextProviderInstances,
            selectedProviderInstanceId,
            selectedVisionTextProviderInstanceId,
            visionTextModelId,
            visionTextApiCompatibility,
            visionTextDetail,
            visionTextMaxOutputTokens,
            polishingModelId,
            polishingThinkingEnabled,
            polishingThinkingEffort,
            polishingThinkingEffortFormat
        });
        const previousEndpoints = new Map(providerEndpoints.map((endpoint) => [endpoint.id, endpoint]));
        setProviderEndpoints(
            freshConfig.providerEndpoints.map((endpoint) => {
                const previous = previousEndpoints.get(endpoint.id);
                return previous?.modelDiscovery ? { ...endpoint, modelDiscovery: previous.modelDiscovery } : endpoint;
            })
        );
    }, [
        apiBaseUrl,
        apiKey,
        customImageModels,
        geminiApiBaseUrl,
        geminiApiKey,
        polishingApiBaseUrl,
        polishingApiKey,
        polishingModelId,
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
    ]);

    const updateModelCatalogEntryEnabled = React.useCallback((id: string, enabled: boolean | string) => {
        setModelCatalog((current) => current.map((entry) => entry.id === id ? { ...entry, enabled: !!enabled } : entry));
    }, []);

    const updateModelCatalogEntryTask = React.useCallback((id: string, task: ModelTaskCapability, enabled: boolean | string) => {
        setModelCatalog((current) => current.map((entry) => {
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
        }));
    }, []);

    const restoreModelCatalogEntryAuto = React.useCallback((id: string) => {
        setModelCatalog((current) => current.map((entry) => {
            if (entry.id !== id) return entry;
            const inferred = inferModelCatalogCapabilities(entry.rawModelId, entry.provider);
            return {
                ...entry,
                source: entry.source === 'remote' ? 'remote' : 'builtin',
                enabled: true,
                capabilities: inferred.capabilities,
                capabilityConfidence: inferred.confidence
            };
        }));
    }, []);

    const updateProviderInstance = React.useCallback((id: string, updates: Partial<ProviderInstance>) => {
        setProviderInstances((current) => {
            const next = normalizeProviderInstances(
                current.map((instance) => instance.id === id ? { ...instance, ...updates } : instance),
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
    }, [apiBaseUrl, apiKey, geminiApiBaseUrl, geminiApiKey, rebuildProviderEndpoints, seedreamApiBaseUrl, seedreamApiKey, sensenovaApiBaseUrl, sensenovaApiKey]);

    const addProviderInstance = React.useCallback(() => {
        const newApiBaseUrl = newProviderApiBaseUrl.trim();
        const name = newProviderName.trim() || getProviderInstanceHostname(newApiBaseUrl) || getProviderLabel(newProviderType);
        const id = createProviderInstanceId(newProviderType, newApiBaseUrl || name, providerInstances.map((instance) => instance.id));
        setProviderInstances((current) => {
            const next = normalizeProviderInstances([
                ...current,
                {
                    id,
                    type: newProviderType,
                    name,
                    apiKey: newProviderApiKey.trim(),
                    apiBaseUrl: newApiBaseUrl,
                    models: []
                }
            ], {
                openaiApiKey: apiKey,
                openaiApiBaseUrl: apiBaseUrl,
                geminiApiKey,
                geminiApiBaseUrl,
                sensenovaApiKey,
                sensenovaApiBaseUrl,
                seedreamApiKey,
                seedreamApiBaseUrl
            });
            rebuildProviderEndpoints(next);
            return next;
        });
        setSelectedProviderInstanceId(id);
        setNewProviderName('');
        setNewProviderApiKey('');
        setNewProviderApiBaseUrl('');
    }, [apiBaseUrl, apiKey, geminiApiBaseUrl, geminiApiKey, newProviderApiBaseUrl, newProviderApiKey, newProviderName, newProviderType, providerInstances, rebuildProviderEndpoints, seedreamApiBaseUrl, seedreamApiKey, sensenovaApiBaseUrl, sensenovaApiKey]);

    const removeProviderInstance = React.useCallback((id: string) => {
        setProviderInstances((current) => {
            const target = current.find((instance) => instance.id === id);
            if (!target) return current;
            const instancesForType = current.filter((instance) => instance.type === target.type);
            if (instancesForType.length <= 1) return current;
            const remaining = current.filter((instance) => instance.id !== id);
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
            rebuildProviderEndpoints(next);
            if (selectedProviderInstanceId === id) {
                setSelectedProviderInstanceId(next.find((instance) => instance.type === target.type)?.id || '');
            }
            return next;
        });
    }, [apiBaseUrl, apiKey, geminiApiBaseUrl, geminiApiKey, rebuildProviderEndpoints, seedreamApiBaseUrl, seedreamApiKey, selectedProviderInstanceId, sensenovaApiBaseUrl, sensenovaApiKey]);

    const setProviderInstanceDefault = React.useCallback((id: string) => {
        setProviderInstances((current) => {
            const target = current.find((instance) => instance.id === id);
            if (!target) return current;
            const next = normalizeProviderInstances(current.map((instance) => instance.type === target.type
                ? { ...instance, isDefault: instance.id === id }
                : instance
            ));
            rebuildProviderEndpoints(next);
            return next;
        });
        setSelectedProviderInstanceId(id);
    }, [rebuildProviderEndpoints]);

    const updateProviderInstanceModel = React.useCallback((instanceId: string, modelId: string, enabled: boolean | string) => {
        const checked = !!enabled;
        setProviderInstances((current) => normalizeProviderInstances(current.map((instance) => {
            if (instance.id !== instanceId) return instance;
            const availableModels = getAllImageModels(customImageModels)
                .filter((model) => model.provider === instance.type)
                .map((model) => model.id);
            const currentModels = instance.models.length > 0 ? instance.models : availableModels;
            const models = checked
                ? [...currentModels.filter((id) => id !== modelId), modelId]
                : currentModels.filter((id) => id !== modelId);
            return { ...instance, models };
        })));
    }, [customImageModels]);

    const addModelToProviderInstance = React.useCallback((instance: ProviderInstance, modelId: string) => {
        const id = modelId.trim();
        if (!id) return;
        updateProviderInstanceModel(instance.id, id, true);
        if (!IMAGE_MODEL_IDS.includes(id) && !customImageModels.some((model) => model.id === id)) {
            setCustomImageModels((current) => normalizeCustomImageModels([...current, { id, provider: instance.type, instanceId: instance.id }]));
        }
    }, [customImageModels, updateProviderInstanceModel]);

    const refreshProviderInstanceModels = React.useCallback(async (instance: ProviderInstance) => {
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
                polishingApiKey,
                polishingApiBaseUrl,
                polishingModelId,
                polishingThinkingEnabled,
                polishingThinkingEffort,
                polishingThinkingEffortFormat
            }
        );
        const endpoint = normalizedUnifiedProviderModelConfig.providerEndpoints.find((item) => item.id === instance.id);
        if (!endpoint) return;
        setProviderModelRefreshStatus((current) => ({
            ...current,
            [instance.id]: { loading: true, message: '正在读取模型列表…', tone: 'info' }
        }));

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
                polishingApiKey,
                polishingApiBaseUrl,
                polishingModelId,
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
            setProviderEndpoints((current) =>
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
            const imageModelIds = nextCatalog
                .filter(
                    (entry) =>
                        entry.providerEndpointId === endpoint.id &&
                        (entry.capabilities.tasks.includes('image.generate') ||
                            entry.capabilities.tasks.includes('image.edit')) &&
                        entry.capabilityConfidence !== 'low'
                )
                .map((entry) => entry.rawModelId);
            if (imageModelIds.length > 0) {
                setCustomImageModels((current) => {
                    const existing = new Set([...IMAGE_MODEL_IDS, ...current.map((model) => model.id)]);
                    const additions = imageModelIds
                        .filter((modelId) => !existing.has(modelId))
                        .map((id) => ({ id, provider: instance.type, instanceId: instance.id }));
                    return additions.length > 0 ? normalizeCustomImageModels([...current, ...additions]) : current;
                });
                setProviderInstances((current) =>
                    {
                        const next = normalizeProviderInstances(
                            current.map((item) => {
                                if (item.id !== instance.id || item.models.length === 0) return item;
                                return { ...item, models: Array.from(new Set([...item.models, ...imageModelIds])) };
                            }),
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
                    }
                );
            }
            setProviderModelRefreshStatus((current) => ({
                ...current,
                [instance.id]: {
                    loading: false,
                    message: `已发现 ${result.models.length} 个模型。`,
                    tone: 'success'
                }
            }));
        } catch (error) {
            const message = error instanceof Error ? error.message : '模型列表读取失败。';
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
        }
    }, [
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
        polishingApiBaseUrl,
        polishingApiKey,
        polishingCustomPrompts,
        polishingModelId,
        polishingPresetId,
        polishingPrompt,
        polishingThinkingEffort,
        polishingThinkingEffortFormat,
        polishingThinkingEnabled,
        promptHistoryLimit,
        providerEndpoints,
        providerInstances,
        rebuildProviderEndpoints,
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
        visionTextStreamingEnabled,
        visionTextStructuredOutputEnabled,
        visionTextSystemPrompt,
        visionTextTaskType
    ]);

    const updateVisionTextProviderInstance = React.useCallback((id: string, updates: Partial<VisionTextProviderInstance>) => {
        setVisionTextProviderInstances((current) => {
            const next = normalizeVisionTextProviderInstances(
                current.map((instance) => (instance.id === id ? { ...instance, ...updates } : instance))
            );
            rebuildProviderEndpoints(providerInstances, next);
            return next;
        });
    }, [providerInstances, rebuildProviderEndpoints]);

    const addVisionTextProviderInstance = React.useCallback(() => {
        const baseUrl = newVisionTextProviderApiBaseUrl.trim();
        const name = newVisionTextProviderName.trim() || getDefaultVisionTextProviderInstanceName(newVisionTextProviderKind, baseUrl);
        const id = createVisionTextProviderInstanceId(
            newVisionTextProviderKind,
            baseUrl || name,
            visionTextProviderInstances.map((instance) => instance.id)
        );
        setVisionTextProviderInstances((current) => {
            const next = normalizeVisionTextProviderInstances([
                ...current,
                {
                    id,
                    kind: newVisionTextProviderKind,
                    name,
                    apiKey: newVisionTextProviderApiKey.trim(),
                    apiBaseUrl: baseUrl,
                    apiCompatibility: newVisionTextProviderApiCompatibility,
                    models: [],
                    isDefault: current.length === 0,
                    reuseOpenAIImageCredentials: newVisionTextProviderKind === 'openai'
                }
            ]);
            rebuildProviderEndpoints(providerInstances, next);
            return next;
        });
        setSelectedVisionTextProviderInstanceId(id);
        setNewVisionTextProviderName('');
        setNewVisionTextProviderApiKey('');
        setNewVisionTextProviderApiBaseUrl('');
        setNewVisionTextProviderApiCompatibility(
            newVisionTextProviderKind === 'openai' ? 'responses' : 'chat-completions'
        );
    }, [
        providerInstances,
        rebuildProviderEndpoints,
        newVisionTextProviderApiBaseUrl,
        newVisionTextProviderApiCompatibility,
        newVisionTextProviderApiKey,
        newVisionTextProviderKind,
        newVisionTextProviderName,
        visionTextProviderInstances
    ]);

    const removeVisionTextProviderInstance = React.useCallback((id: string) => {
        setVisionTextProviderInstances((current) => {
            const target = current.find((instance) => instance.id === id);
            if (!target) return current;
            if (current.filter((instance) => instance.kind === target.kind).length <= 1) return current;
            const remaining = current.filter((instance) => instance.id !== id);
            const next = normalizeVisionTextProviderInstances(remaining);
            rebuildProviderEndpoints(providerInstances, next);
            if (selectedVisionTextProviderInstanceId === id) {
                setSelectedVisionTextProviderInstanceId(
                    next.find((instance) => instance.kind === target.kind)?.id || ''
                );
            }
            return next;
        });
    }, [providerInstances, rebuildProviderEndpoints, selectedVisionTextProviderInstanceId]);

    const setVisionTextProviderInstanceDefault = React.useCallback((id: string) => {
        setVisionTextProviderInstances((current) => {
            const target = current.find((instance) => instance.id === id);
            if (!target) return current;
            const next = normalizeVisionTextProviderInstances(
                current.map((instance) =>
                    instance.kind === target.kind ? { ...instance, isDefault: instance.id === id } : instance
                )
            );
            rebuildProviderEndpoints(providerInstances, next);
            return next;
        });
        setSelectedVisionTextProviderInstanceId(id);
    }, [providerInstances, rebuildProviderEndpoints]);

    const directLinkRestriction = React.useMemo(
        () => getClientDirectLinkRestriction({
            enabled: clientDirectLinkPriority,
            openaiApiBaseUrl: apiBaseUrl,
            envOpenaiApiBaseUrl: envApiBaseUrl,
            polishingApiBaseUrl,
            envPolishingApiBaseUrl,
            geminiApiBaseUrl,
            envGeminiApiBaseUrl,
            sensenovaApiBaseUrl,
            envSensenovaApiBaseUrl,
            seedreamApiBaseUrl,
            providerInstances,
            envSeedreamApiBaseUrl
        }),
        [apiBaseUrl, clientDirectLinkPriority, envApiBaseUrl, envGeminiApiBaseUrl, envPolishingApiBaseUrl, envSeedreamApiBaseUrl, envSensenovaApiBaseUrl, geminiApiBaseUrl, polishingApiBaseUrl, providerInstances, seedreamApiBaseUrl, sensenovaApiBaseUrl]
    );
    const directLinkRestrictionMessage = directLinkRestriction ? formatClientDirectLinkRestriction(directLinkRestriction) : '';
    const effectiveConnectionMode = directLinkRestriction ? 'direct' : connectionMode;
    const selectedPolishPreset = React.useMemo(
        () =>
            PROMPT_POLISH_PRESETS.find((preset) => preset.id === polishingPresetId) ||
            PROMPT_POLISH_PRESETS.find((preset) => preset.id === DEFAULT_POLISHING_PRESET_ID) ||
            PROMPT_POLISH_PRESETS[0],
        [polishingPresetId]
    );
    const providerApiConfigs = React.useMemo<Record<ImageProviderId, ProviderApiConfigMetadata>>(() => ({
        openai: {
            title: 'OpenAI',
            description: '官方 OpenAI 或 OpenAI 兼容端点。',
            icon: <Globe className='h-4 w-4' />,
            apiKeyId: 'openai-api-key',
            apiKeyLabel: 'OpenAI API Key',
            apiKeyValue: apiKey,
            onApiKeyChange: setApiKey,
            apiKeyVisible: showApiKey,
            onApiKeyVisibleChange: () => setShowApiKey((value) => !value),
            apiKeyPlaceholder: 'sk-…',
            apiKeyStatus: apiKey ? statusBadge('UI', 'green') : hasEnvApiKey ? statusBadge('ENV', 'blue') : null,
            apiKeyHint: hasEnvApiKey ? '.env 中已配置，当前为空时使用 ENV 值。' : undefined,
            baseUrlId: 'openai-base-url',
            baseUrlLabel: 'OpenAI API Base URL',
            baseUrlValue: apiBaseUrl,
            onBaseUrlChange: setApiBaseUrl,
            baseUrlPlaceholder: 'https://api.openai.com/v1',
            baseUrlStatus: apiBaseUrl ? statusBadge('UI', 'green') : hasEnvApiBaseUrl ? statusBadge('ENV', 'blue') : null,
            baseUrlHint: hasEnvApiBaseUrl ? '.env 中已配置，当前为空时使用 ENV 值。' : undefined
        },
        google: {
            title: 'Google Gemini',
            description: 'Gemini 图像模型接口配置。',
            icon: <Sparkles className='h-4 w-4' />,
            apiKeyId: 'gemini-api-key',
            apiKeyLabel: 'Gemini API Key',
            apiKeyValue: geminiApiKey,
            onApiKeyChange: setGeminiApiKey,
            apiKeyVisible: showGeminiApiKey,
            onApiKeyVisibleChange: () => setShowGeminiApiKey((value) => !value),
            apiKeyPlaceholder: 'AIza…',
            apiKeyStatus: geminiApiKey ? statusBadge('UI', 'green') : hasEnvGeminiApiKey ? statusBadge('ENV', 'blue') : null,
            apiKeyHint: hasEnvGeminiApiKey ? '.env 中已配置 GEMINI_API_KEY，当前为空时使用 ENV 值。' : undefined,
            baseUrlId: 'gemini-base-url',
            baseUrlLabel: 'Gemini API Base URL',
            baseUrlValue: geminiApiBaseUrl,
            onBaseUrlChange: setGeminiApiBaseUrl,
            baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
            baseUrlStatus: geminiApiBaseUrl ? statusBadge('UI', 'green') : hasEnvGeminiApiBaseUrl ? statusBadge('ENV', 'blue') : null,
            baseUrlHint: '用于 Google Gemini 图像模型。'
        },
        seedream: {
            title: 'Seedream / 火山方舟',
            description: '豆包 Seedream 文生图、图生图和组图接口。',
            icon: <Sparkles className='h-4 w-4' />,
            apiKeyId: 'seedream-api-key',
            apiKeyLabel: 'Seedream API Key',
            apiKeyValue: seedreamApiKey,
            onApiKeyChange: setSeedreamApiKey,
            apiKeyVisible: showSeedreamApiKey,
            onApiKeyVisibleChange: () => setShowSeedreamApiKey((value) => !value),
            apiKeyPlaceholder: 'VolcEngine Ark API Key',
            apiKeyStatus: seedreamApiKey ? statusBadge('UI', 'green') : hasEnvSeedreamApiKey ? statusBadge('ENV', 'blue') : null,
            apiKeyHint: hasEnvSeedreamApiKey ? '.env 中已配置 SEEDREAM_API_KEY，当前为空时使用 ENV 值。' : undefined,
            baseUrlId: 'seedream-base-url',
            baseUrlLabel: 'Seedream API Base URL',
            baseUrlValue: seedreamApiBaseUrl,
            onBaseUrlChange: setSeedreamApiBaseUrl,
            baseUrlPlaceholder: envSeedreamApiBaseUrl || SEEDREAM_DEFAULT_BASE_URL,
            baseUrlStatus: seedreamApiBaseUrl ? statusBadge('UI', 'green') : hasEnvSeedreamApiBaseUrl ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber'),
            baseUrlHint: '支持 Seedream 默认图片生成接口；高级参数在生成表单中配置。'
        },
        sensenova: {
            title: 'SenseNova',
            description: '商汤 SenseNova U1 Fast 图像生成接口。',
            icon: <Sparkles className='h-4 w-4' />,
            apiKeyId: 'sensenova-api-key',
            apiKeyLabel: 'SenseNova API Key',
            apiKeyValue: sensenovaApiKey,
            onApiKeyChange: setSensenovaApiKey,
            apiKeyVisible: showSensenovaApiKey,
            onApiKeyVisibleChange: () => setShowSensenovaApiKey((value) => !value),
            apiKeyPlaceholder: 'SenseNova bearer token',
            apiKeyStatus: sensenovaApiKey ? statusBadge('UI', 'green') : hasEnvSensenovaApiKey ? statusBadge('ENV', 'blue') : null,
            apiKeyHint: hasEnvSensenovaApiKey ? '.env 中已配置 SENSENOVA_API_KEY，当前为空时使用 ENV 值。' : undefined,
            baseUrlId: 'sensenova-base-url',
            baseUrlLabel: 'SenseNova API Base URL',
            baseUrlValue: sensenovaApiBaseUrl,
            onBaseUrlChange: setSensenovaApiBaseUrl,
            baseUrlPlaceholder: envSensenovaApiBaseUrl || SENSENOVA_DEFAULT_BASE_URL,
            baseUrlStatus: sensenovaApiBaseUrl ? statusBadge('UI', 'green') : hasEnvSensenovaApiBaseUrl ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber'),
            baseUrlHint: '内置模型 sensenova-u1-fast 默认使用独立图片生成接口。'
        }
    }), [apiBaseUrl, apiKey, envSeedreamApiBaseUrl, envSensenovaApiBaseUrl, geminiApiBaseUrl, geminiApiKey, hasEnvApiBaseUrl, hasEnvApiKey, hasEnvGeminiApiBaseUrl, hasEnvGeminiApiKey, hasEnvSeedreamApiBaseUrl, hasEnvSeedreamApiKey, hasEnvSensenovaApiBaseUrl, hasEnvSensenovaApiKey, seedreamApiBaseUrl, seedreamApiKey, sensenovaApiBaseUrl, sensenovaApiKey, showApiKey, showGeminiApiKey, showSeedreamApiKey, showSensenovaApiKey]);
    const hasUnsavedChanges = React.useMemo(() => {
        const normalizedCustomModels = normalizeCustomImageModels(customImageModels);
        const normalizedVisionTextProviderInstances = normalizeVisionTextProviderInstances(visionTextProviderInstances);
        const normalizedCustomPolishPrompts = normalizeStoredCustomPolishPrompts(polishingCustomPrompts, polishingPrompt);
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
                polishingApiKey,
                polishingApiBaseUrl,
                polishingModelId,
                polishingThinkingEnabled,
                polishingThinkingEffort,
                polishingThinkingEffortFormat
            }
        );
        const comparableConnectionMode = directLinkRestriction ? 'direct' : initialConfig.connectionMode;
        return (
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
            JSON.stringify(normalizedUnifiedProviderModelConfig.providerEndpoints) !== JSON.stringify(initialConfig.providerEndpoints) ||
            JSON.stringify(normalizedUnifiedProviderModelConfig.modelCatalog) !== JSON.stringify(initialConfig.modelCatalog) ||
            JSON.stringify(normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds) !== JSON.stringify(initialConfig.modelTaskDefaultCatalogEntryIds) ||
            JSON.stringify(normalizedVisionTextProviderInstances) !== JSON.stringify(initialConfig.visionTextProviderInstances) ||
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
            polishingApiKey !== initialConfig.polishingApiKey ||
            polishingApiBaseUrl !== initialConfig.polishingApiBaseUrl ||
            polishingModelId !== initialConfig.polishingModelId ||
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
        initialConfig,
        initialSyncConfigSnapshot,
        maxConcurrentTasks,
        modelCatalog,
        modelTaskDefaultCatalogEntryIds,
        polishPickerOrder,
        polishingApiBaseUrl,
        polishingApiKey,
        polishingCustomPrompts,
        polishingModelId,
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
        visionTextStreamingEnabled,
        visionTextStructuredOutputEnabled,
        visionTextSystemPrompt,
        visionTextTaskType
    ]);

    const handleDialogOpenChange = React.useCallback((nextOpen: boolean) => {
        if (nextOpen) {
            setSettingsView('main');
            setOpen(true);
            return;
        }
        if (!saved && hasUnsavedChanges) {
            setDiscardConfirmOpen(true);
            return;
        }
        setOpen(false);
    }, [hasUnsavedChanges, saved]);

    const handleConfirmDiscardChanges = React.useCallback(() => {
        setDiscardConfirmOpen(false);
        setOpen(false);
    }, []);

    const handleFetchS3Status = React.useCallback(async () => {
        setS3StatusLoading(true);
        setS3TestResult(null);
        try {
            const status: S3StatusResponse = currentSyncConfig.s3.requestMode === 'server'
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
            setS3TestResult({ ok: result.ok, message: result.message || (result.ok ? 'S3 连接测试成功。' : (result.error || '连接失败')) });
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
        const normalizedCustomPolishPrompts = normalizeStoredCustomPolishPrompts(polishingCustomPrompts, polishingPrompt);
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
                polishingApiKey,
                polishingApiBaseUrl,
                polishingModelId,
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
        if (nextApiKey !== initialConfig.apiKey) newConfig.openaiApiKey = nextApiKey;
        if (nextApiBaseUrl !== initialConfig.apiBaseUrl) newConfig.openaiApiBaseUrl = nextApiBaseUrl;
        if (nextGeminiApiKey !== initialConfig.geminiApiKey) newConfig.geminiApiKey = nextGeminiApiKey;
        if (nextGeminiApiBaseUrl !== initialConfig.geminiApiBaseUrl) newConfig.geminiApiBaseUrl = nextGeminiApiBaseUrl;
        if (nextSensenovaApiKey !== initialConfig.sensenovaApiKey) newConfig.sensenovaApiKey = nextSensenovaApiKey;
        if (nextSensenovaApiBaseUrl !== initialConfig.sensenovaApiBaseUrl) newConfig.sensenovaApiBaseUrl = nextSensenovaApiBaseUrl;
        if (nextSeedreamApiKey !== initialConfig.seedreamApiKey) newConfig.seedreamApiKey = nextSeedreamApiKey;
        if (nextSeedreamApiBaseUrl !== initialConfig.seedreamApiBaseUrl) newConfig.seedreamApiBaseUrl = nextSeedreamApiBaseUrl;
        if (selectedProviderInstanceId !== initialConfig.selectedProviderInstanceId) newConfig.selectedProviderInstanceId = selectedProviderInstanceId;
        if (JSON.stringify(normalizedProviderInstances) !== JSON.stringify(initialConfig.providerInstances)) {
            newConfig.providerInstances = normalizedProviderInstances;
        }
        if (JSON.stringify(normalizedUnifiedProviderModelConfig.providerEndpoints) !== JSON.stringify(initialConfig.providerEndpoints)) {
            newConfig.providerEndpoints = normalizedUnifiedProviderModelConfig.providerEndpoints;
        }
        if (JSON.stringify(normalizedUnifiedProviderModelConfig.modelCatalog) !== JSON.stringify(initialConfig.modelCatalog)) {
            newConfig.modelCatalog = normalizedUnifiedProviderModelConfig.modelCatalog;
        }
        if (JSON.stringify(normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds) !== JSON.stringify(initialConfig.modelTaskDefaultCatalogEntryIds)) {
            newConfig.modelTaskDefaultCatalogEntryIds = normalizedUnifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds;
        }
        if (JSON.stringify(normalizedVisionTextProviderInstances) !== JSON.stringify(initialConfig.visionTextProviderInstances)) {
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
        if (polishingApiKey !== initialConfig.polishingApiKey) newConfig.polishingApiKey = polishingApiKey;
        if (polishingApiBaseUrl !== initialConfig.polishingApiBaseUrl) newConfig.polishingApiBaseUrl = polishingApiBaseUrl;
        if (polishingModelId !== initialConfig.polishingModelId) newConfig.polishingModelId = polishingModelId;
        if (polishingPrompt !== initialConfig.polishingPrompt) newConfig.polishingPrompt = polishingPrompt;
        if (polishingPresetId !== initialConfig.polishingPresetId) newConfig.polishingPresetId = polishingPresetId;
        if (polishingThinkingEnabled !== initialConfig.polishingThinkingEnabled) newConfig.polishingThinkingEnabled = polishingThinkingEnabled;
        if (polishingThinkingEffort !== initialConfig.polishingThinkingEffort) newConfig.polishingThinkingEffort = polishingThinkingEffort.trim() || DEFAULT_PROMPT_POLISH_THINKING_EFFORT;
        if (polishingThinkingEffortFormat !== initialConfig.polishingThinkingEffortFormat) newConfig.polishingThinkingEffortFormat = polishingThinkingEffortFormat;
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

        if (directLinkRestriction?.provider === 'openai' && !directLinkRestriction.serviceLabel && !apiBaseUrl && envApiBaseUrl) {
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
        if (directLinkRestriction?.serviceLabel === '提示词润色' && !polishingApiBaseUrl && envPolishingApiBaseUrl) {
            newConfig.polishingApiBaseUrl = envPolishingApiBaseUrl;
        }

        let nextSaveWarningMessage = '';
        if (savedConnectionMode === 'direct') {
            const effectiveApiKey = apiKey || (hasEnvApiKey ? '(env)' : '');
            const effectiveBaseUrl = apiBaseUrl || envApiBaseUrl || (hasEnvApiBaseUrl ? '(env)' : '');
            const effectiveGeminiApiKey = geminiApiKey || (hasEnvGeminiApiKey ? '(env)' : '');
            const effectiveSensenovaApiKey = sensenovaApiKey || (hasEnvSensenovaApiKey ? '(env)' : '');
            const effectiveSeedreamApiKey = seedreamApiKey || (hasEnvSeedreamApiKey ? '(env)' : '');
            const effectivePolishingApiKey = polishingApiKey || (hasEnvPolishingApiKey ? '(env)' : '');
            if ((!effectiveApiKey || effectiveApiKey === '(env)') && (!effectiveGeminiApiKey || effectiveGeminiApiKey === '(env)') && (!effectiveSensenovaApiKey || effectiveSensenovaApiKey === '(env)') && (!effectiveSeedreamApiKey || effectiveSeedreamApiKey === '(env)') && (!effectivePolishingApiKey || effectivePolishingApiKey === '(env)')) {
                nextSaveWarningMessage = '配置已保存。直连生成仍需要在浏览器配置 OpenAI、Gemini、SenseNova、Seedream 或提示词润色 API Key；云存储配置不会因此被阻止。';
            } else if (effectiveApiKey && effectiveApiKey !== '(env)' && !effectiveGeminiApiKey && (!effectiveBaseUrl || effectiveBaseUrl === '(env)')) {
                nextSaveWarningMessage = '配置已保存。当前直连 OpenAI 兼容接口缺少 API Base URL，生成请求可能失败；云存储配置已正常保存。';
            }
        }

        saveConfig(newConfig);
        saveSyncConfig(currentSyncConfig);
        setInitialSyncConfigSnapshot(JSON.stringify({
            s3: currentSyncConfig.s3,
            autoSync: currentSyncConfig.autoSync
        }));
        setS3Status(isS3SyncConfigConfigured(currentSyncConfig.s3)
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
            : { configured: false, message: '当前浏览器尚未配置完整的 S3 兼容对象存储信息。' });
        onConfigChange(newConfig);
        setSaveWarningMessage(nextSaveWarningMessage);
        setSaved(true);
        if (nextSaveWarningMessage) {
            addNotice(nextSaveWarningMessage, 'warning');
        } else {
            addNotice('配置已保存，立即生效。', 'success');
        }
        setTimeout(() => setOpen(false), 600);
    };

    const handleReset = () => {
        const resetRestriction = getClientDirectLinkRestriction({
            enabled: clientDirectLinkPriority,
            envOpenaiApiBaseUrl: envApiBaseUrl,
            envPolishingApiBaseUrl,
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
        const resetProviderInstances = normalizeProviderInstances(undefined);
        const resetVisionTextProviderInstances = normalizeVisionTextProviderInstances(undefined);
        const resetUnifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(undefined, {
            providerInstances: resetProviderInstances,
            customImageModels: [],
            visionTextProviderInstances: resetVisionTextProviderInstances,
            visionTextModelId: DEFAULT_VISION_TEXT_MODEL,
            polishingModelId: DEFAULT_PROMPT_POLISH_MODEL,
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
        setVisionTextProviderInstances(resetVisionTextProviderInstances);
        setSelectedVisionTextProviderInstanceId('');
        setNewVisionTextProviderKind('openai');
        setNewVisionTextProviderName('');
        setNewVisionTextProviderApiKey('');
        setNewVisionTextProviderApiBaseUrl('');
        setNewVisionTextProviderApiCompatibility(DEFAULT_VISION_TEXT_API_COMPATIBILITY);
        setVisionTextProviderApiKeyVisibility({});
        setVisionTextModelId('');
        setVisionTextTaskType(DEFAULT_VISION_TEXT_TASK_TYPE);
        setVisionTextDetail(DEFAULT_VISION_TEXT_DETAIL);
        setVisionTextResponseFormat(DEFAULT_VISION_TEXT_RESPONSE_FORMAT);
        setVisionTextStreamingEnabled(DEFAULT_VISION_TEXT_STREAMING_ENABLED);
        setVisionTextStructuredOutputEnabled(DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED);
        setVisionTextMaxOutputTokens(DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS);
        setVisionTextSystemPrompt(DEFAULT_VISION_TEXT_SYSTEM_PROMPT);
        setVisionTextApiCompatibility(DEFAULT_VISION_TEXT_API_COMPATIBILITY);
        setPolishingApiKey('');
        setPolishingApiBaseUrl('');
        setPolishingModelId(DEFAULT_PROMPT_POLISH_MODEL);
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
        setInitialSyncConfigSnapshot(JSON.stringify({
            s3: DEFAULT_SYNC_CONFIG.s3,
            autoSync: DEFAULT_SYNC_CONFIG.autoSync
        }));
        setS3Status({ configured: false, message: '当前浏览器尚未配置 S3 兼容对象存储。' });
        setS3TestResult(null);
        setProxyUrlError('');
        setPromoServiceUrlError('');
        setSaveWarningMessage('');
        onConfigChange({
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
            polishingApiKey: '',
            polishingApiBaseUrl: '',
            polishingModelId: DEFAULT_PROMPT_POLISH_MODEL,
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
            desktopProxyMode: 'disabled',
            desktopProxyUrl: '',
            desktopPromoServiceMode: 'current',
            desktopPromoServiceUrl: '',
            desktopDebugMode: false
        });
        setSaved(true);
        setTimeout(() => setOpen(false), 600);
    };

    const storageOptions = [
        { value: 'auto', label: '自动检测' },
        { value: 'fs', label: '文件系统' },
        { value: 'indexeddb', label: 'IndexedDB' }
    ];

    return (
        <>
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='icon'
                    className='text-foreground/60 hover:bg-accent hover:text-foreground'
                    aria-label='Settings'>
                    <Settings className='h-4 w-4' />
                </Button>
            </DialogTrigger>
            <DialogContent className='flex h-screen max-h-screen w-screen max-w-none flex-col overflow-hidden rounded-none border-border bg-background p-0 text-foreground shadow-xl top-0 left-0 translate-x-0 translate-y-0 supports-[height:100dvh]:h-dvh supports-[height:100dvh]:max-h-dvh sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(760px,calc(100vw-2rem))] sm:max-w-[760px] sm:rounded-2xl sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]'>
                <div className='shrink-0 border-b border-border bg-card/70 px-5 py-4 pr-12 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-4'>
                    <DialogHeader>
                        <DialogTitle className='text-xl font-semibold'>
                            {settingsView === 'providers'
                                ? '供应商 API 配置'
                                : settingsView === 'polish-prompts'
                                    ? '提示词润色配置'
                                    : '系统配置'}
                        </DialogTitle>
                        <DialogDescription>
                            {settingsView === 'providers'
                                ? '管理各供应商的 API Key 与 Base URL。'
                                : settingsView === 'polish-prompts'
                                    ? '管理润色模型、自定义提示词和润色下拉顺序。'
                                    : '配置 API、模型、运行参数与桌面端选项。'}
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
                                className='min-h-[44px] rounded-xl px-3 text-muted-foreground hover:bg-accent hover:text-foreground'>
                                <ArrowLeft className='h-4 w-4' />
                                返回系统配置
                            </Button>
                            <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                同一供应商类型现在可以保存多个命名端点；高级选项里会直接显示这些命名供应商。新增端点未填写名称时，会默认使用 Base URL 的域名作为名称。
                            </div>

                            <ProviderSection title='新增供应商端点' description='选择兼容类型，填写 API Key / Base URL，可留空名称自动使用域名。' icon={<Plus className='h-4 w-4' />} defaultOpen>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <Select value={newProviderType} onValueChange={(value) => setNewProviderType(value as ImageProviderId)}>
                                        <SelectTrigger className='h-10 w-full rounded-xl bg-background text-foreground'>
                                            <SelectValue placeholder='供应商类型' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='openai'>OpenAI Compatible</SelectItem>
                                            <SelectItem value='google'>Google Gemini</SelectItem>
                                            <SelectItem value='seedream'>Seedream</SelectItem>
                                            <SelectItem value='sensenova'>SenseNova</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        value={newProviderName}
                                        onChange={(event) => setNewProviderName(event.target.value)}
                                        placeholder='供应商名称（可选）'
                                        className='h-10 rounded-xl bg-background text-foreground'
                                    />
                                </div>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <SecretInput
                                        id='new-provider-api-key'
                                        value={newProviderApiKey}
                                        onChange={setNewProviderApiKey}
                                        visible={providerApiKeyVisibility.__new === true}
                                        onVisibleChange={() => setProviderApiKeyVisibility((current) => ({ ...current, __new: !current.__new }))}
                                        placeholder='API Key'
                                    />
                                    <Input
                                        value={newProviderApiBaseUrl}
                                        onChange={(event) => setNewProviderApiBaseUrl(event.target.value)}
                                        placeholder={getProviderDefaultBaseUrl(newProviderType)}
                                        className='h-10 rounded-xl bg-background text-foreground'
                                    />
                                </div>
                                <Button type='button' onClick={addProviderInstance} className='min-h-[44px] rounded-xl bg-violet-600 text-white hover:bg-violet-500'>
                                    <Plus className='h-4 w-4' />
                                    添加供应商
                                </Button>
                            </ProviderSection>

                            <div className='space-y-3'>
                                {IMAGE_PROVIDER_ORDER.map((provider) => {
                                    const config = providerApiConfigs[provider];
                                    const instances = providerInstances.filter((instance) => instance.type === provider);
                                    return (
                                        <ProviderSection
                                            key={provider}
                                            title={config.title}
                                            description={`${config.description} · ${instances.length} 个端点`}
                                            icon={config.icon}
                                            defaultOpen={provider === 'openai'}>
                                            <div className='space-y-3'>
                                                {instances.map((instance) => {
                                                    const visible = providerApiKeyVisibility[instance.id] === true;
                                                    const allModels = getAllImageModels(customImageModels).filter((model) => model.provider === instance.type);
                                                    const selectedModelIds = new Set(instance.models.length > 0 ? instance.models : allModels.map((model) => model.id));
                                                    const newModelValue = newModelByProviderInstance[instance.id] ?? '';
                                                    return (
                                                        <article key={instance.id} className='space-y-4 rounded-2xl border border-border bg-background/70 p-4 shadow-sm'>
                                                            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                                                                <div className='min-w-0 flex-1 space-y-2'>
                                                                    <div className='flex flex-wrap items-center gap-2'>
                                                                        <Input
                                                                            value={instance.name}
                                                                            onChange={(event) => updateProviderInstance(instance.id, { name: event.target.value })}
                                                                            placeholder={getProviderInstanceHostname(instance.apiBaseUrl) || getProviderLabel(instance.type)}
                                                                            className='h-9 rounded-xl bg-background text-sm font-semibold text-foreground sm:max-w-xs'
                                                                        />
                                                                        {instance.isDefault ? statusBadge('默认', 'green') : statusBadge('可切换', 'blue')}
                                                                        {selectedProviderInstanceId === instance.id && statusBadge('当前选择', 'amber')}
                                                                    </div>
                                                                    <p className='text-xs text-muted-foreground'>ID: <span className='font-mono'>{instance.id}</span></p>
                                                                </div>
                                                                <div className='flex flex-wrap gap-2'>
                                                                    <Button
                                                                        type='button'
                                                                        variant='outline'
                                                                        size='sm'
                                                                        onClick={() => refreshProviderInstanceModels(instance)}
                                                                        disabled={providerModelRefreshStatus[instance.id]?.loading}
                                                                        className='min-h-[36px] rounded-xl'>
                                                                        {providerModelRefreshStatus[instance.id]?.loading ? (
                                                                            <Loader2 className='h-4 w-4 animate-spin' />
                                                                        ) : (
                                                                            <RefreshCw className='h-4 w-4' />
                                                                        )}
                                                                        刷新模型
                                                                    </Button>
                                                                    {!instance.isDefault && (
                                                                        <Button type='button' variant='outline' size='sm' onClick={() => setProviderInstanceDefault(instance.id)} className='min-h-[36px] rounded-xl'>设为默认</Button>
                                                                    )}
                                                                    <Button type='button' variant='outline' size='sm' onClick={() => setSelectedProviderInstanceId(instance.id)} className='min-h-[36px] rounded-xl'>选择</Button>
                                                                    <Button type='button' variant='ghost' size='icon' onClick={() => removeProviderInstance(instance.id)} disabled={instances.length <= 1} className='h-9 w-9 text-muted-foreground hover:bg-red-500/10 hover:text-red-600' aria-label={`删除供应商 ${instance.name}`}>
                                                                        <Trash2 className='h-4 w-4' />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            {providerModelRefreshStatus[instance.id]?.message && (
                                                                <p className={`text-xs ${providerModelRefreshStatus[instance.id]?.tone === 'error' ? 'text-red-600 dark:text-red-300' : providerModelRefreshStatus[instance.id]?.tone === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                                                                    {providerModelRefreshStatus[instance.id]?.message}
                                                                </p>
                                                            )}
                                                            <div className='grid gap-3 lg:grid-cols-2'>
                                                                <div className='space-y-2'>
                                                                    <Label className='text-xs text-muted-foreground'>API Key</Label>
                                                                    <SecretInput
                                                                        id={`provider-instance-key-${instance.id}`}
                                                                        value={instance.apiKey}
                                                                        onChange={(value) => updateProviderInstance(instance.id, { apiKey: value })}
                                                                        visible={visible}
                                                                        onVisibleChange={() => setProviderApiKeyVisibility((current) => ({ ...current, [instance.id]: !current[instance.id] }))}
                                                                        placeholder={config.apiKeyPlaceholder}
                                                                    />
                                                                </div>
                                                                <div className='space-y-2'>
                                                                    <Label className='text-xs text-muted-foreground'>API Base URL</Label>
                                                                    <Input
                                                                        value={instance.apiBaseUrl}
                                                                        onChange={(event) => updateProviderInstance(instance.id, { apiBaseUrl: event.target.value })}
                                                                        placeholder={config.baseUrlPlaceholder}
                                                                        className='h-10 rounded-xl bg-background text-foreground'
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className='space-y-3 rounded-xl border border-border bg-muted/20 p-3'>
                                                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                                                    <div>
                                                                        <p className='text-sm font-medium text-foreground'>可用模型</p>
                                                                        <p className='text-xs text-muted-foreground'>不勾选任何限制时默认可用该类型全部模型；勾选后只在高级选项中显示已选模型。</p>
                                                                    </div>
                                                                    <span className='text-xs text-muted-foreground'>{selectedModelIds.size} / {allModels.length}</span>
                                                                </div>
                                                                <div className='grid gap-2 sm:grid-cols-2'>
                                                                    {allModels.map((model) => (
                                                                        <div key={model.id} className='flex items-center gap-2'>
                                                                            <Checkbox
                                                                                id={`provider-model-${instance.id}-${model.id}`}
                                                                                checked={selectedModelIds.has(model.id)}
                                                                                onCheckedChange={(checked) => updateProviderInstanceModel(instance.id, model.id, checked)}
                                                                            />
                                                                            <Label htmlFor={`provider-model-${instance.id}-${model.id}`} className='cursor-pointer text-xs text-muted-foreground'>
                                                                                {model.label}{model.custom ? ' · 自定义' : ''}
                                                                            </Label>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]'>
                                                                    <Input
                                                                        value={newModelValue}
                                                                        onChange={(event) => setNewModelByProviderInstance((current) => ({ ...current, [instance.id]: event.target.value }))}
                                                                        placeholder='添加该供应商提供的自定义模型 ID'
                                                                        className='h-10 rounded-xl bg-background font-mono text-xs text-foreground'
                                                                        onKeyDown={(event) => {
                                                                            if (event.key === 'Enter') {
                                                                                event.preventDefault();
                                                                                addModelToProviderInstance(instance, newModelValue);
                                                                                setNewModelByProviderInstance((current) => ({ ...current, [instance.id]: '' }));
                                                                            }
                                                                        }}
                                                                    />
                                                                    <Button
                                                                        type='button'
                                                                        variant='outline'
                                                                        onClick={() => {
                                                                            addModelToProviderInstance(instance, newModelValue);
                                                                            setNewModelByProviderInstance((current) => ({ ...current, [instance.id]: '' }));
                                                                        }}
                                                                        disabled={!newModelValue.trim()}
                                                                        className='min-h-[44px] rounded-xl'>
                                                                        添加模型
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </article>
                                                    );
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
                            <button
                                type='button'
                                onClick={() => setSettingsView('providers')}
                                className='flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 px-4 py-4 text-left shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
                                <span className='flex min-w-0 items-start gap-3'>
                                    <span className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground' aria-hidden='true'>
                                        <Globe className='h-5 w-5' />
                                    </span>
                                    <span className='min-w-0'>
                                        <span className='block text-sm font-semibold text-foreground'>供应商 API 配置</span>
                                        <span className='mt-1 block text-sm leading-5 text-muted-foreground'>管理图像供应商的 API Key 与 Base URL。</span>
                                    </span>
                                </span>
                                <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground' />
                            </button>

                            <button
                                type='button'
                                onClick={() => setSettingsView('polish-prompts')}
                                className='flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 px-4 py-4 text-left shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
                                <span className='flex min-w-0 items-start gap-3'>
                                    <span className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-200' aria-hidden='true'>
                                        <Sparkles className='h-5 w-5' />
                                    </span>
                                    <span className='min-w-0'>
                                        <span className='block text-sm font-semibold text-foreground'>提示词润色配置</span>
                                        <span className='mt-1 block text-sm leading-5 text-muted-foreground'>管理润色模型、多个自定义提示词，以及“润色”按钮弹出选项顺序。</span>
                                    </span>
                                </span>
                                <span className='flex shrink-0 items-center gap-2'>
                                    {polishingCustomPrompts.length > 0 ? statusBadge(`${polishingCustomPrompts.length} 条自定义`, 'green') : statusBadge('未添加', 'amber')}
                                    <ChevronRight className='h-4 w-4 text-muted-foreground' />
                                </span>
                            </button>

                            <button
                                type='button'
                                onClick={() => setSettingsView('vision-text')}
                                className='flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 px-4 py-4 text-left shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
                                <span className='flex min-w-0 items-start gap-3'>
                                    <span className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-200' aria-hidden='true'>
                                        <ScanEye className='h-5 w-5' />
                                    </span>
                                    <span className='min-w-0'>
                                        <span className='block text-sm font-semibold text-foreground'>图生文与多模态</span>
                                        <span className='mt-1 block text-sm leading-5 text-muted-foreground'>配置图片理解、提示词反推和多模态文本输出模型。</span>
                                    </span>
                                </span>
                                <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground' />
                            </button>

                    <ProviderSection title='统一模型目录' description='展示发现模型、自定义模型和能力覆盖。任务选择器会优先使用这里的能力标注。' icon={<Sparkles className='h-4 w-4' />}>
                        <div className='space-y-3'>
                            <Input
                                value={modelCatalogSearch}
                                onChange={(event) => setModelCatalogSearch(event.target.value)}
                                placeholder='搜索模型 ID、显示名、端点、厂商或能力'
                                className='h-10 rounded-xl bg-background text-sm text-foreground'
                            />
                            <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
                                {statusBadge(`${modelCatalog.length} 条目录项`, 'blue')}
                                {statusBadge(`${modelCatalog.filter((entry) => entry.enabled !== false).length} 已启用`, 'green')}
                                {statusBadge(`${modelCatalog.filter((entry) => entry.capabilityConfidence === 'low').length} 未分类`, 'amber')}
                            </div>
                            <div className='max-h-[420px] space-y-2 overflow-y-auto pr-1'>
                                {modelCatalog.filter((entry) => {
                                    const endpoint = providerEndpoints.find((item) => item.id === entry.providerEndpointId);
                                    const searchable = [
                                        entry.rawModelId,
                                        entry.label,
                                        entry.displayLabel,
                                        entry.upstreamVendor,
                                        endpoint?.name,
                                        endpoint?.provider,
                                        ...entry.capabilities.tasks
                                    ]
                                        .filter(Boolean)
                                        .join(' ')
                                        .toLowerCase();
                                    return !modelCatalogSearch.trim() || searchable.includes(modelCatalogSearch.trim().toLowerCase());
                                }).map((entry) => {
                                    const endpoint = providerEndpoints.find((item) => item.id === entry.providerEndpointId);
                                    return (
                                        <div key={entry.id} className='space-y-3 rounded-xl border border-border bg-background/70 p-3'>
                                            <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                                                <div className='min-w-0 space-y-1'>
                                                    <p className='truncate font-mono text-sm text-foreground'>{getCatalogEntryLabel(entry, endpoint)}</p>
                                                    <p className='text-xs text-muted-foreground'>
                                                        {entry.rawModelId} · {endpoint?.name || entry.providerEndpointId} · {entry.capabilityConfidence || 'low'}
                                                    </p>
                                                </div>
                                                <div className='flex flex-wrap items-center gap-2'>
                                                    <Button type='button' variant='ghost' size='sm' onClick={() => restoreModelCatalogEntryAuto(entry.id)} className='min-h-[36px] rounded-xl'>
                                                        恢复自动
                                                    </Button>
                                                    <Button type='button' variant='ghost' size='icon' onClick={() => updateModelCatalogEntryEnabled(entry.id, !entry.enabled)} className='h-9 w-9 text-muted-foreground hover:bg-red-500/10 hover:text-red-600' aria-label={`切换模型 ${entry.id}`}>
                                                        {entry.enabled === false ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className='flex flex-wrap gap-2 text-xs'>
                                                {entry.source === 'remote' ? statusBadge('发现', 'blue') : entry.source === 'custom' ? statusBadge('自定义', 'green') : statusBadge('预置', 'amber')}
                                                {entry.enabled === false ? statusBadge('已禁用', 'amber') : statusBadge('已启用', 'green')}
                                            </div>
                                            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                                                {(['image.generate', 'image.edit', 'image.maskEdit', 'vision.text', 'prompt.polish', 'text.generate'] as const).map((task) => (
                                                    <div key={task} className='flex items-center gap-2'>
                                                        <Checkbox
                                                            id={`catalog-task-${entry.id}-${task}`}
                                                            checked={entry.capabilities.tasks.includes(task)}
                                                            onCheckedChange={(checked) => updateModelCatalogEntryTask(entry.id, task, checked)}
                                                        />
                                                        <Label htmlFor={`catalog-task-${entry.id}-${task}`} className='cursor-pointer text-xs text-muted-foreground'>
                                                            {task}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                {modelCatalog.filter((entry) => {
                                    const endpoint = providerEndpoints.find((item) => item.id === entry.providerEndpointId);
                                    const searchable = [
                                        entry.rawModelId,
                                        entry.label,
                                        entry.displayLabel,
                                        entry.upstreamVendor,
                                        endpoint?.name,
                                        endpoint?.provider,
                                        ...entry.capabilities.tasks
                                    ]
                                        .filter(Boolean)
                                        .join(' ')
                                        .toLowerCase();
                                    return !modelCatalogSearch.trim() || searchable.includes(modelCatalogSearch.trim().toLowerCase());
                                }).length === 0 && (
                                    <p className='rounded-xl border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground'>
                                        还没有匹配的目录项。刷新模型列表后，发现结果会出现在这里。
                                    </p>
                                )}
                            </div>
                        </div>
                    </ProviderSection>

                    <ProviderSection title='自定义模型能力覆盖' description='自定义模型 ID 仍可单独覆盖尺寸、能力和供应商参数。' icon={<Sparkles className='h-4 w-4' />}>
                        <p className='rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-xs leading-5 text-violet-900 dark:text-violet-100'>
                            新增模型请进入上方“供应商 API 配置”刷新或手动添加；这里保留的是模型级别的高级覆盖项。
                        </p>

                        {customImageModels.length > 0 ? (
                            <div className='space-y-2'>
                                {customImageModels.map((model) => (
                                    <div key={model.id} className='space-y-3 rounded-xl border border-border bg-background/70 p-3'>
                                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                                            <div className='min-w-0 flex-1'>
                                                <p className='truncate font-mono text-sm text-foreground'>{model.id}</p>
                                                <p className='text-xs text-muted-foreground'>{providerLabel(model.provider)}</p>
                                            </div>
                                            <span className='rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground'>
                                                {model.instanceId ? `绑定 ${model.instanceId}` : '全局自定义'}
                                            </span>
                                            <Button type='button' variant='ghost' size='icon' onClick={() => removeCustomModel(model.id)} className='h-9 w-9 text-muted-foreground hover:bg-red-500/10 hover:text-red-600' aria-label={`删除模型 ${model.id}`}>
                                                <Trash2 className='h-4 w-4' />
                                            </Button>
                                        </div>
                                        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                                            {([
                                                ['supportsCustomSize', '允许自定义尺寸'],
                                                ['supportsEditing', '支持图片编辑'],
                                                ['supportsMask', '支持蒙版'],
                                                ['supportsQuality', '支持质量参数'],
                                                ['supportsOutputFormat', '支持输出格式'],
                                                ['supportsBackground', '支持背景参数'],
                                                ['supportsModeration', '支持审核参数'],
                                                ['supportsCompression', '支持压缩率'],
                                                ['supportsStreaming', '支持流式预览']
                                            ] as const).map(([capability, label]) => (
                                                <div key={capability} className='flex items-center gap-2'>
                                                    <Checkbox
                                                        id={`custom-${capability}-${model.id}`}
                                                        checked={model.capabilities?.[capability] === true}
                                                        onCheckedChange={(checked) => updateCustomModelCapability(model.id, capability, checked)}
                                                    />
                                                    <Label htmlFor={`custom-${capability}-${model.id}`} className='cursor-pointer text-xs text-muted-foreground'>{label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className='grid gap-2 sm:grid-cols-4'>
                                            <Input
                                                value={model.defaultSize ?? ''}
                                                onChange={(event) => updateCustomModelDefaultSize(model.id, event.target.value)}
                                                placeholder='默认尺寸 2K 或 2048x2048'
                                                className='h-9 rounded-xl bg-background text-xs text-foreground sm:col-span-1'
                                            />
                                            <Input
                                                value={model.sizePresets?.square ?? ''}
                                                onChange={(event) => updateCustomModelSizePreset(model.id, 'square', event.target.value)}
                                                placeholder='正方形 2048x2048'
                                                className='h-9 rounded-xl bg-background text-xs text-foreground'
                                            />
                                            <Input
                                                value={model.sizePresets?.landscape ?? ''}
                                                onChange={(event) => updateCustomModelSizePreset(model.id, 'landscape', event.target.value)}
                                                placeholder='横向 2560x1440'
                                                className='h-9 rounded-xl bg-background text-xs text-foreground'
                                            />
                                            <Input
                                                value={model.sizePresets?.portrait ?? ''}
                                                onChange={(event) => updateCustomModelSizePreset(model.id, 'portrait', event.target.value)}
                                                placeholder='纵向 1440x2560'
                                                className='h-9 rounded-xl bg-background text-xs text-foreground'
                                            />
                                        </div>
                                        <p className='text-xs text-muted-foreground'>可为自定义模型覆盖能力、默认尺寸和预设；常用供应商参数会在生成表单中显示，JSON 仅作为新参数临时兜底。</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className='rounded-xl border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground'>还没有自定义模型。系统预置模型仍会正常显示。</p>
                        )}
                    </ProviderSection>

                    <ProviderSection title='运行与存储' description='配置 API 连接、并发任务数量和图片存储模式。' icon={<Settings className='h-4 w-4' />}>
                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label className='flex items-center gap-2'>
                                    <Radio className='h-4 w-4 text-muted-foreground' />
                                    API 连接模式
                                </Label>
                                {statusBadge(connectionMode === 'proxy' ? '服务器中转' : '客户端直连', connectionMode === 'proxy' ? 'green' : 'amber')}
                            </div>
                            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                <button
                                    type='button'
                                    onClick={() => {
                                        if (!directLinkRestriction) setConnectionMode('proxy');
                                    }}
                                    disabled={!!directLinkRestriction}
                                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${connectionMode === 'proxy' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                    <Wifi className='h-4 w-4' />
                                    服务器中转
                                </button>
                                <button
                                    type='button'
                                    onClick={() => setConnectionMode('direct')}
                                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${connectionMode === 'direct' ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
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
                                                <li>浏览器会直接访问供应商或中转服务，API Key 会在 Network 面板可见。</li>
                                                <li>OpenAI 兼容端点通常需要 CORS 支持；Google Gemini 可使用官方 REST 端点。</li>
                                                <li>{serverHasAppPassword ? '服务器配置了 APP_PASSWORD，直连模式将绕过密码验证。' : '直连模式不经过服务器，不会触发 APP_PASSWORD 验证。'}</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className='text-xs text-muted-foreground'>请求经服务器转发，API Key 不在浏览器暴露，更安全。</p>
                            )}
                        </div>

                        <div className='space-y-3'>
                            <div className='flex items-center gap-2'>
                                <Label htmlFor='max-concurrent-tasks' className='flex items-center gap-2'>
                                    <Cpu className='h-4 w-4 text-muted-foreground' />
                                    并发任务数
                                </Label>
                                <span className='inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300'>{maxConcurrentTasks}</span>
                            </div>
                            <div className='flex items-center gap-4'>
                                <input
                                    id='max-concurrent-tasks'
                                    type='range'
                                    min='1'
                                    max='10'
                                    value={maxConcurrentTasks}
                                    onChange={(event) => setMaxConcurrentTasks(parseInt(event.target.value, 10))}
                                    className='h-2 flex-1 appearance-none rounded-full bg-muted accent-violet-600'
                                />
                                <span className='w-8 text-right font-mono text-sm text-muted-foreground tabular-nums'>{maxConcurrentTasks}</span>
                            </div>
                            <p className='text-xs text-muted-foreground'>同时执行的 API 请求数量，值越大效率越高但更容易触发速率限制。</p>
                        </div>

                        <div className='space-y-3'>
                            <div className='flex items-center gap-2'>
                                <Label htmlFor='prompt-history-limit' className='flex items-center gap-2'>
                                    <History className='h-4 w-4 text-muted-foreground' />
                                    提示词历史数量
                                </Label>
                                <span className='inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300'>{promptHistoryLimit}</span>
                            </div>
                            <div className='flex items-center gap-4'>
                                <input
                                    id='prompt-history-limit'
                                    type='range'
                                    min='1'
                                    max='100'
                                    value={promptHistoryLimit}
                                    onChange={(event) => setPromptHistoryLimit(normalizePromptHistoryLimit(event.target.value))}
                                    className='h-2 flex-1 appearance-none rounded-full bg-muted accent-violet-600'
                                />
                                <span className='w-10 text-right font-mono text-sm text-muted-foreground tabular-nums'>{promptHistoryLimit}</span>
                            </div>
                            <p className='text-xs text-muted-foreground'>记录最近使用的提示词，默认保留 20 条，方便从输入框下方快速找回。</p>
                        </div>

                        <div className='space-y-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <Label className='flex items-center gap-2'>
                                    <Database className='h-4 w-4 text-muted-foreground' />
                                    图片存储模式
                                </Label>
                                {statusBadge(storageMode !== 'auto' ? 'UI' : hasEnvStorageMode ? 'ENV' : 'AUTO', storageMode !== 'auto' ? 'green' : 'blue')}
                            </div>
                            <Select onValueChange={(value) => setStorageMode(value as typeof storageMode)} value={storageMode}>
                                <SelectTrigger className='h-10 w-full rounded-xl bg-background text-foreground'>
                                    <SelectValue placeholder='选择存储模式' />
                                </SelectTrigger>
                                <SelectContent>
                                    {storageOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className='space-y-1 text-xs text-muted-foreground'>
                                <p><strong>自动检测:</strong> Vercel → IndexedDB，本地运行 → 文件系统</p>
                                <p><strong>文件系统:</strong> Web 端保存到 <code className='text-foreground'>./generated-images</code>；桌面端保存到应用数据目录或下方选择的文件夹</p>
                                <p><strong>IndexedDB:</strong> 图片保存在浏览器本地存储，适合无服务器部署</p>
                            </div>
                            {isDesktopRuntime && storageMode === 'fs' && (
                                <div className='rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3'>
                                    <div className='space-y-2'>
                                        <div className='flex items-center justify-between gap-2'>
                                            <Label htmlFor='desktop-image-storage-path' className='flex items-center gap-2 text-sm font-medium'>
                                                <FolderOpen className='h-4 w-4 text-emerald-600 dark:text-emerald-300' />
                                                桌面端文件夹
                                            </Label>
                                            {imageStoragePath ? statusBadge('自定义路径', 'green') : statusBadge('默认路径', 'blue')}
                                        </div>
                                        <Input
                                            id='desktop-image-storage-path'
                                            value={imageStoragePath}
                                            onChange={(event) => {
                                                setImageStoragePath(event.target.value);
                                                setImageStoragePathError('');
                                            }}
                                            placeholder={defaultImageStoragePath || '留空时使用默认应用数据目录'}
                                            className='h-10 rounded-xl bg-background font-mono text-xs text-foreground'
                                            aria-label='桌面端图片存储路径'
                                        />
                                        <div className='flex flex-wrap gap-2'>
                                            {imageStoragePath && (
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    onClick={() => { setImageStoragePath(''); setImageStoragePathError(''); }}
                                                    className='min-h-[44px] rounded-xl text-muted-foreground hover:text-foreground'>
                                                    使用默认路径
                                                </Button>
                                            )}
                                        </div>
                                        <p className='text-xs leading-5 text-emerald-800 dark:text-emerald-100/90'>
                                            留空时默认保存到应用数据目录下的 <code className='text-foreground'>generated-images</code>。如需自定义目录，请直接填写本机文件夹绝对路径。
                                        </p>
                                        {imageStoragePathError && (
                                            <p className='text-xs text-red-600 dark:text-red-300' role='alert'>{imageStoragePathError}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ProviderSection>

                    <ProviderSection title='桌面端设置' description='Tauri 桌面 Rust 中转代理、调试模式。' icon={<Bug className='h-4 w-4' />}>
                        {isDesktopRuntime ? (
                            <>
                                <div className='space-y-3'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <Label className='flex items-center gap-2'>
                                            <Wifi className='h-4 w-4 text-muted-foreground' />
                                            代理模式（仅桌面端 Rust 请求）
                                        </Label>
                                        {statusBadge(desktopProxyMode, desktopProxyMode === 'disabled' ? 'amber' : desktopProxyMode === 'system' ? 'green' : 'blue')}
                                    </div>
                                    <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                                        {([
                                            ['disabled', '禁用代理'],
                                            ['system', '默认环境代理'],
                                            ['manual', '手动代理']
                                        ] as [DesktopProxyMode, string][]).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type='button'
                                                onClick={() => { setDesktopProxyMode(value); setProxyUrlError(''); }}
                                                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${desktopProxyMode === value ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {desktopProxyMode === 'manual' && (
                                        <div className='space-y-2'>
                                            <Label htmlFor='desktop-proxy-url' className='text-xs text-muted-foreground'>代理地址</Label>
                                            <Input
                                                id='desktop-proxy-url'
                                                type='text'
                                                placeholder='127.0.0.1:7890 或 socks5://127.0.0.1:1080'
                                                value={desktopProxyUrl}
                                                onChange={(event) => { setDesktopProxyUrl(event.target.value); setProxyUrlError(''); }}
                                                autoComplete='off'
                                                className={`h-10 rounded-xl bg-background text-foreground ${proxyUrlError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                            />
                                            {proxyUrlError && (
                                                <p className='text-xs text-red-500' role='alert'>{proxyUrlError}</p>
                                            )}
                                        </div>
                                    )}
                                    {desktopProxyMode === 'system' && (
                                        <p className='text-xs text-muted-foreground'>使用 Rust HTTP 客户端默认代理行为（如环境变量代理）；如需稳定指定代理，建议选择手动代理。</p>
                                    )}
                                {desktopProxyMode === 'disabled' && (
                                    <p className='text-xs text-muted-foreground'>Rust 中转将直接连接 API 服务器，不使用代理。</p>
                                )}
                            </div>

                            <div className='space-y-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <Label className='flex items-center gap-2'>
                                        <Globe className='h-4 w-4 text-muted-foreground' />
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
                                    {([
                                        ['current', '当前站点'],
                                        ['origin', '自定义域名'],
                                        ['endpoint', '完整接口'],
                                        ['disabled', '关闭']
                                    ] as [DesktopPromoServiceMode, string][]).map(([value, label]) => (
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
                                            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${desktopPromoServiceMode === value ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {desktopPromoServiceMode === 'origin' && (
                                    <div className='space-y-2'>
                                        <Label htmlFor='desktop-promo-service-url' className='text-xs text-muted-foreground'>
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
                                            className={`h-10 rounded-xl bg-background text-foreground ${promoServiceUrlError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                        />
                                    </div>
                                )}
                                {desktopPromoServiceMode === 'endpoint' && (
                                    <div className='space-y-2'>
                                        <Label htmlFor='desktop-promo-service-endpoint' className='text-xs text-muted-foreground'>
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
                                            className={`h-10 rounded-xl bg-background text-foreground ${promoServiceUrlError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                        />
                                    </div>
                                )}
                                {desktopPromoServiceMode === 'current' && (
                                    <p className='text-xs text-muted-foreground'>桌面端会请求当前站点的 /api/promo/placements。</p>
                                )}
                                {desktopPromoServiceMode === 'disabled' && (
                                    <p className='text-xs text-muted-foreground'>桌面端不会请求展示接口，所有展示位保持隐藏。</p>
                                )}
                                {promoServiceUrlError && (
                                    <p className='text-xs text-red-500' role='alert'>
                                        {promoServiceUrlError}
                                    </p>
                                )}
                                {desktopPromoPlacementsUrl && desktopPromoServiceMode !== 'disabled' && (
                                    <p className='break-all rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground'>
                                        {desktopPromoPlacementsUrl}
                                    </p>
                                )}
                            </div>

                            <div className='space-y-3'>
                                <div className='flex items-center gap-2'>
                                    <Label htmlFor='desktop-debug-mode' className='flex items-center gap-2'>
                                        <Bug className='h-4 w-4 text-muted-foreground' />
                                            调试模式
                                        </Label>
                                        {desktopDebugMode ? statusBadge('已开启', 'blue') : statusBadge('关闭', 'amber')}
                                    </div>
                                    <div className='flex items-center space-x-2'>
                                        <Checkbox
                                            id='desktop-debug-mode'
                                            checked={desktopDebugMode}
                                            onCheckedChange={(checked) => setDesktopDebugMode(!!checked)}
                                        />
                                        <label htmlFor='desktop-debug-mode' className='text-sm text-muted-foreground cursor-pointer'>
                                            开启后，Rust 中转会在 API 请求中附加调试头并返回更详细的错误信息。
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
                                            <p className='font-semibold'>当前为 Web 应用，桌面端配置未启用</p>
                                            <p className='text-xs leading-5 text-sky-800/85 dark:text-sky-100/80'>{DESKTOP_ONLY_SETTINGS_MESSAGE}</p>
                                        </div>
                                        <Button asChild variant='outline' size='sm' className='min-h-[44px] rounded-xl border-sky-500/30 bg-background/80 text-sky-700 hover:bg-background dark:text-sky-100'>
                                            <a
                                                href={DESKTOP_APP_DOWNLOAD_URL}
                                                target='_blank'
                                                rel='noopener noreferrer'
                                                onClick={handleExternalLinkClick(DESKTOP_APP_DOWNLOAD_URL)}>
                                                <Download className='h-4 w-4' />
                                                下载或更新桌面端
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ProviderSection>

                    <ProviderSection title='云存储同步' description='为当前设备配置 S3 兼容对象存储，同步配置、提示词、历史记录与历史图片。' icon={<Cloud className='h-4 w-4' />}>
                        <div className='space-y-4'>
                            <div className='rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100'>
                                这是单机/自托管模式：每个访问者在本机保存对象存储配置。默认使用客户端直连；Web 端需要对象存储支持 CORS，桌面端会通过 Tauri Rust 网络层请求对象存储。
                            </div>

                            <div className='flex flex-wrap items-center gap-2'>
                                <Cloud className='h-4 w-4 text-muted-foreground' />
                                <span className='text-sm font-medium text-foreground'>S3 兼容对象存储</span>
                                {isS3Configured ? statusBadge('本地已配置', 'green') : statusBadge('未配置', 'amber')}
                            </div>

                            <div className='grid gap-3 sm:grid-cols-2'>
                                <div className='space-y-2'>
                                    <Label htmlFor='s3-endpoint' className='text-xs text-muted-foreground'>Endpoint</Label>
                                    <Input
                                        id='s3-endpoint'
                                        type='url'
                                        value={s3Endpoint}
                                        onChange={(event) => setS3Endpoint(event.target.value)}
                                        placeholder='https://s3.example.com'
                                        autoComplete='off'
                                        className='h-10 rounded-xl bg-background font-mono text-foreground'
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='s3-bucket' className='text-xs text-muted-foreground'>Bucket</Label>
                                    <Input
                                        id='s3-bucket'
                                        value={s3Bucket}
                                        onChange={(event) => setS3Bucket(event.target.value)}
                                        placeholder='gpt-image-playground'
                                        autoComplete='off'
                                        className='h-10 rounded-xl bg-background font-mono text-foreground'
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='s3-region' className='text-xs text-muted-foreground'>Region</Label>
                                    <Input
                                        id='s3-region'
                                        value={s3Region}
                                        onChange={(event) => setS3Region(event.target.value)}
                                        placeholder='us-east-1'
                                        autoComplete='off'
                                        className='h-10 rounded-xl bg-background font-mono text-foreground'
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='s3-access-key-id' className='text-xs text-muted-foreground'>Access Key ID</Label>
                                    <Input
                                        id='s3-access-key-id'
                                        value={s3AccessKeyId}
                                        onChange={(event) => setS3AccessKeyId(event.target.value)}
                                        placeholder='your_access_key'
                                        autoComplete='off'
                                        spellCheck={false}
                                        className='h-10 rounded-xl bg-background font-mono text-foreground'
                                    />
                                </div>
                                <div className='space-y-2 sm:col-span-2'>
                                    <Label htmlFor='s3-secret-access-key' className='text-xs text-muted-foreground'>Secret Access Key</Label>
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
                                    <Label htmlFor='s3-prefix' className='text-xs text-muted-foreground'>远端根前缀</Label>
                                    <Input
                                        id='s3-prefix'
                                        value={s3Prefix}
                                        onChange={(event) => setS3Prefix(event.target.value)}
                                        placeholder={DEFAULT_SYNC_CONFIG.s3.prefix}
                                        autoComplete='off'
                                        className='h-10 rounded-xl bg-background font-mono text-foreground'
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='s3-profile-id' className='text-xs text-muted-foreground'>Profile / 设备命名空间</Label>
                                    <Input
                                        id='s3-profile-id'
                                        value={s3ProfileId}
                                        onChange={(event) => setS3ProfileId(event.target.value)}
                                        placeholder='default'
                                        autoComplete='off'
                                        className='h-10 rounded-xl bg-background font-mono text-foreground'
                                    />
                                </div>
                            </div>

                            <div className='flex items-center space-x-2'>
                                <Checkbox
                                    id='s3-force-path-style'
                                    checked={s3ForcePathStyle}
                                    onCheckedChange={(checked) => setS3ForcePathStyle(!!checked)}
                                />
                                <Label htmlFor='s3-force-path-style' className='cursor-pointer text-sm text-muted-foreground'>
                                    使用 path-style 访问（RustFS / MinIO / IP 地址端点通常需要开启）
                                </Label>
                            </div>

                            <div className='rounded-xl border border-border bg-background/60 p-3'>
                                <div className='flex items-start gap-3'>
                                    <Checkbox
                                        id='s3-allow-remote-deletion'
                                        checked={s3AllowRemoteDeletion}
                                        onCheckedChange={(checked) => setS3AllowRemoteDeletion(!!checked)}
                                        className='mt-0.5'
                                    />
                                    <div className='min-w-0 space-y-1'>
                                        <Label htmlFor='s3-allow-remote-deletion' className='cursor-pointer text-sm font-medium text-foreground'>
                                            允许同步删除远端图片
                                        </Label>
                                        <p className='text-xs leading-5 text-muted-foreground'>
                                            默认关闭，普通同步只需要读取、列出和写入权限。关闭时，本地删除不会发布远端删除标记，也不会请求 DeleteObject；需要多设备同步删除且凭据确实具备删除权限时再开启。
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className='space-y-2'>
                                <Label className='text-xs text-muted-foreground'>云存储请求方式</Label>
                                <div className='grid gap-2 sm:grid-cols-2'>
                                    <button
                                        type='button'
                                        onClick={() => setS3RequestMode('direct')}
                                        className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${s3RequestMode === 'direct' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                        <span className='block font-medium'>{isDesktopRuntime ? '桌面 Rust 中转' : '客户端直连'}</span>
                                        <span className='mt-1 block text-xs opacity-75'>{isDesktopRuntime ? '使用本地 Tauri 网络层，避免 WebView CORS。' : '默认方式，需要对象存储端点允许当前站点 CORS。'}</span>
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => setS3RequestMode('server')}
                                        disabled={isDesktopRuntime || clientDirectLinkPriority}
                                        className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${s3RequestMode === 'server' ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                        <span className='block font-medium'>服务器中转</span>
                                        <span className='mt-1 block text-xs opacity-75'>仅在直连跨域失败且服务端已配置 S3 时使用。</span>
                                    </button>
                                </div>
                                {clientDirectLinkPriority && !isDesktopRuntime && (
                                    <p className='text-xs text-amber-700 dark:text-amber-300'>
                                        当前部署启用了 CLIENT_DIRECT_LINK_PRIORITY，云存储服务器中转不可用。
                                    </p>
                                )}
                            </div>

                            <div className='space-y-3 rounded-xl border border-border bg-background/60 p-3'>
                                <div className='flex items-start gap-3'>
                                    <Checkbox
                                        id='sync-auto-sync-enabled'
                                        checked={syncAutoSyncEnabled}
                                        onCheckedChange={(checked) => setSyncAutoSyncEnabled(!!checked)}
                                        className='mt-0.5'
                                    />
                                    <div className='min-w-0 space-y-1'>
                                        <Label htmlFor='sync-auto-sync-enabled' className='cursor-pointer text-sm font-medium text-foreground'>
                                            自动同步
                                        </Label>
                                        <p className='text-xs leading-5 text-muted-foreground'>
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
                                                className='flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5'>
                                                <Checkbox
                                                    id={`sync-auto-scope-${scope.key}`}
                                                    checked={syncAutoSyncScopes[scope.key]}
                                                    onCheckedChange={(checked) => handleAutoSyncScopeChange(scope.key, !!checked)}
                                                    className='mt-0.5'
                                                />
                                                <span className='min-w-0'>
                                                    <span className='block text-sm font-medium text-foreground'>{scope.label}</span>
                                                    <span className='mt-0.5 block text-xs leading-5 text-muted-foreground'>{scope.description}</span>
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
                                    {s3StatusLoading ? <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' /> : null}
                                    刷新状态
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={handleTestS3Connection}
                                    disabled={s3TestLoading || !isS3Configured}
                                    className='rounded-xl'>
                                    {s3TestLoading ? <Loader2 className='mr-1 h-3.5 w-3.5 animate-spin' /> : null}
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
                                        setS3AllowRemoteDeletion(DEFAULT_SYNC_CONFIG.s3.allowRemoteDeletion);
                                        setS3RequestMode(DEFAULT_SYNC_CONFIG.s3.requestMode);
                                        setS3Prefix(DEFAULT_SYNC_CONFIG.s3.prefix);
                                        setS3ProfileId(DEFAULT_SYNC_CONFIG.s3.profileId);
                                        setSyncAutoSyncEnabled(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.enabled);
                                        setSyncAutoSyncScopes(DEFAULT_SYNC_AUTO_SYNC_SETTINGS.scopes);
                                        setInitialSyncConfigSnapshot(JSON.stringify({
                                            s3: DEFAULT_SYNC_CONFIG.s3,
                                            autoSync: DEFAULT_SYNC_CONFIG.autoSync
                                        }));
                                        setS3Status({ configured: false, message: '当前浏览器尚未配置 S3 兼容对象存储。' });
                                        setS3TestResult(null);
                                    }}
                                    className='rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-600'>
                                    清除本地 S3 配置
                                </Button>
                            </div>

                            {s3Status && (
                                <div className='space-y-1 rounded-xl border border-border bg-background/60 p-3 text-xs'>
                                    <div className='grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3'>
                                        <span className='text-muted-foreground'>Endpoint</span>
                                        <span className='col-span-2 truncate font-mono text-foreground'>{s3Status.endpoint || '—'}</span>
                                        <span className='text-muted-foreground'>Bucket</span>
                                        <span className='col-span-2 truncate font-mono text-foreground'>{s3Status.bucket || '—'}</span>
                                        <span className='text-muted-foreground'>Region</span>
                                        <span className='col-span-2 font-mono text-foreground'>{s3Status.region || '—'}</span>
                                        <span className='text-muted-foreground'>根前缀</span>
                                        <span className='col-span-2 truncate font-mono text-foreground'>{s3Status.rootPrefix || '—'}</span>
                                        <span className='text-muted-foreground'>Profile</span>
                                        <span className='col-span-2 font-mono text-foreground'>{s3Status.profileId || '—'}</span>
                                        <span className='text-muted-foreground'>远端删除</span>
                                        <span className='col-span-2 text-foreground'>{s3Status.allowRemoteDeletion ? '已允许' : '未开启'}</span>
                                    </div>
                                </div>
                            )}
                            {s3TestResult && (
                                <div className={`rounded-xl border p-3 text-xs ${s3TestResult.ok ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200'}`}>
                                    {s3TestResult.message}
                                </div>
                            )}
                            <p className='text-xs text-muted-foreground'>
                                保存配置后，生成历史右上角会显示一个云同步图标；点击后可手动上传快照或从最新快照恢复。
                            </p>
                        </div>
                    </ProviderSection>

                    <div className='border-t border-border pt-2'>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={handleReset}
                            className='h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-red-600'>
                            <Plus className='mr-1 h-3 w-3 rotate-45' />
                            重置所有配置
                        </Button>
                    </div>
                        </>
                    )}

                    {settingsView === 'vision-text' && (
                        <div className='space-y-4'>
                            <Button
                                type='button'
                                variant='ghost'
                                onClick={() => setSettingsView('main')}
                                className='min-h-[44px] rounded-xl px-3 text-muted-foreground hover:bg-accent hover:text-foreground'>
                                <ArrowLeft className='h-4 w-4' />
                                返回系统配置
                            </Button>

                            <div className='rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-950 dark:text-emerald-100'>
                                管理图生文专用端点、默认模型和多模态输出参数。这里的配置不会混入图片生成供应商。
                            </div>

                            <ProviderSection title='新增图生文端点' description='填写端点名称、API Key、Base URL 和兼容模式。' icon={<Plus className='h-4 w-4' />} defaultOpen>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <Select value={newVisionTextProviderKind} onValueChange={(value) => setNewVisionTextProviderKind(value as VisionTextProviderKind)}>
                                        <SelectTrigger className='h-10 w-full rounded-xl bg-background text-foreground'>
                                            <SelectValue placeholder='端点类型' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='openai'>OpenAI</SelectItem>
                                            <SelectItem value='openai-compatible'>OpenAI Compatible</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        value={newVisionTextProviderName}
                                        onChange={(event) => setNewVisionTextProviderName(event.target.value)}
                                        placeholder='端点名称（可选）'
                                        className='h-10 rounded-xl bg-background text-foreground'
                                    />
                                </div>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <SecretInput
                                        id='new-vision-provider-api-key'
                                        value={newVisionTextProviderApiKey}
                                        onChange={setNewVisionTextProviderApiKey}
                                        visible={visionTextProviderApiKeyVisibility.__new === true}
                                        onVisibleChange={() => setVisionTextProviderApiKeyVisibility((current) => ({ ...current, __new: !current.__new }))}
                                        placeholder='API Key'
                                    />
                                    <Input
                                        value={newVisionTextProviderApiBaseUrl}
                                        onChange={(event) => setNewVisionTextProviderApiBaseUrl(event.target.value)}
                                        placeholder='https://api.openai.com/v1'
                                        className='h-10 rounded-xl bg-background text-foreground'
                                    />
                                </div>
                                <Select value={newVisionTextProviderApiCompatibility} onValueChange={(value) => setNewVisionTextProviderApiCompatibility(value as 'responses' | 'chat-completions')}>
                                    <SelectTrigger className='h-10 w-full rounded-xl bg-background text-foreground'>
                                        <SelectValue placeholder='兼容模式' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(VISION_TEXT_API_COMPATIBILITY_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button type='button' onClick={addVisionTextProviderInstance} className='min-h-[44px] rounded-xl bg-emerald-600 text-white hover:bg-emerald-500'>
                                    <Plus className='h-4 w-4' />
                                    添加端点
                                </Button>
                            </ProviderSection>

                            <div className='space-y-3'>
                                {visionTextProviderInstances.map((instance) => {
                                    const visible = visionTextProviderApiKeyVisibility[instance.id] === true;
                                    return (
                                        <article key={instance.id} className='space-y-4 rounded-2xl border border-border bg-background/70 p-4 shadow-sm'>
                                            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                                                <div className='min-w-0 flex-1 space-y-2'>
                                                    <div className='flex flex-wrap items-center gap-2'>
                                                        <Input
                                                            value={instance.name}
                                                            onChange={(event) => updateVisionTextProviderInstance(instance.id, { name: event.target.value })}
                                                            placeholder={getDefaultVisionTextProviderInstanceName(instance.kind, instance.apiBaseUrl)}
                                                            className='h-9 rounded-xl bg-background text-sm font-semibold text-foreground sm:max-w-xs'
                                                        />
                                                        {instance.isDefault ? statusBadge('默认', 'green') : statusBadge('可切换', 'blue')}
                                                        {selectedVisionTextProviderInstanceId === instance.id && statusBadge('当前选择', 'amber')}
                                                    </div>
                                                    <p className='text-xs text-muted-foreground'>ID: <span className='font-mono'>{instance.id}</span></p>
                                                </div>
                                                <div className='flex flex-wrap gap-2'>
                                                    {!instance.isDefault && (
                                                        <Button type='button' variant='outline' size='sm' onClick={() => setVisionTextProviderInstanceDefault(instance.id)} className='min-h-[36px] rounded-xl'>设为默认</Button>
                                                    )}
                                                    <Button type='button' variant='outline' size='sm' onClick={() => setSelectedVisionTextProviderInstanceId(instance.id)} className='min-h-[36px] rounded-xl'>选择</Button>
                                                    <Button type='button' variant='ghost' size='icon' onClick={() => removeVisionTextProviderInstance(instance.id)} disabled={visionTextProviderInstances.filter((item) => item.kind === instance.kind).length <= 1} className='h-9 w-9 text-muted-foreground hover:bg-red-500/10 hover:text-red-600' aria-label={`删除图生文端点 ${instance.name}`}>
                                                        <Trash2 className='h-4 w-4' />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className='grid gap-3 lg:grid-cols-2'>
                                                <div className='space-y-2'>
                                                    <Label className='text-xs text-muted-foreground'>API Key</Label>
                                                    <SecretInput
                                                        id={`vision-provider-key-${instance.id}`}
                                                        value={instance.apiKey}
                                                        onChange={(value) => updateVisionTextProviderInstance(instance.id, { apiKey: value })}
                                                        visible={visible}
                                                        onVisibleChange={() => setVisionTextProviderApiKeyVisibility((current) => ({ ...current, [instance.id]: !current[instance.id] }))}
                                                        placeholder='API Key'
                                                    />
                                                </div>
                                                <div className='space-y-2'>
                                                    <Label className='text-xs text-muted-foreground'>API Base URL</Label>
                                                    <Input
                                                        value={instance.apiBaseUrl}
                                                        onChange={(event) => updateVisionTextProviderInstance(instance.id, { apiBaseUrl: event.target.value })}
                                                        placeholder='https://api.openai.com/v1'
                                                        className='h-10 rounded-xl bg-background text-foreground'
                                                    />
                                                </div>
                                            </div>
                                            <div className='grid gap-3 sm:grid-cols-2'>
                                                <div className='space-y-1.5'>
                                                    <Label className='text-xs text-muted-foreground'>兼容模式</Label>
                                                    <Select
                                                        value={instance.apiCompatibility}
                                                        onValueChange={(value) => updateVisionTextProviderInstance(instance.id, { apiCompatibility: value as 'responses' | 'chat-completions' })}
                                                    >
                                                        <SelectTrigger className='h-10 rounded-xl bg-background text-foreground'>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.entries(VISION_TEXT_API_COMPATIBILITY_LABELS).map(([value, label]) => (
                                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className='space-y-1.5'>
                                                    <Label className='text-xs text-muted-foreground'>模型 ID（逗号分隔）</Label>
                                                    <Input
                                                        value={instance.models.join(', ')}
                                                        onChange={(event) =>
                                                            updateVisionTextProviderInstance(instance.id, {
                                                                models: event.target.value
                                                                    .split(',')
                                                                    .map((item) => item.trim())
                                                                    .filter(Boolean)
                                                            })
                                                        }
                                                        className='h-10 rounded-xl bg-background font-mono text-xs text-foreground'
                                                        placeholder='gpt-5.5, gpt-5.4'
                                                    />
                                                </div>
                                            </div>
                                            {instance.kind === 'openai' && (
                                                <div className='flex items-center gap-2'>
                                                    <Checkbox
                                                        id={`vision-reuse-openai-${instance.id}`}
                                                        checked={instance.reuseOpenAIImageCredentials === true}
                                                        onCheckedChange={(checked) => updateVisionTextProviderInstance(instance.id, { reuseOpenAIImageCredentials: !!checked })}
                                                    />
                                                    <Label htmlFor={`vision-reuse-openai-${instance.id}`} className='text-sm text-muted-foreground'>
                                                        复用 OpenAI 图片供应商凭证
                                                    </Label>
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>

                            <ProviderSection title='默认图生文配置' description='控制默认任务行为和输出。' icon={<Settings className='h-4 w-4' />}>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor='vision-default-model' className='text-xs text-muted-foreground'>默认模型</Label>
                                        <Input
                                            id='vision-default-model'
                                            value={visionTextModelId}
                                            onChange={(event) => setVisionTextModelId(event.target.value)}
                                            className='h-10 rounded-xl bg-background font-mono text-sm text-foreground'
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor='vision-default-task' className='text-xs text-muted-foreground'>默认任务类型</Label>
                                        <Select value={visionTextTaskType} onValueChange={(value) => setVisionTextTaskType(value as typeof visionTextTaskType)}>
                                            <SelectTrigger id='vision-default-task' className='h-10 rounded-xl bg-background text-foreground'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(VISION_TEXT_TASK_TYPE_LABELS).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor='vision-default-detail' className='text-xs text-muted-foreground'>默认视觉 detail</Label>
                                        <Select value={visionTextDetail} onValueChange={(value) => setVisionTextDetail(value as typeof visionTextDetail)}>
                                            <SelectTrigger id='vision-default-detail' className='h-10 rounded-xl bg-background text-foreground'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(VISION_TEXT_DETAIL_LABELS).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor='vision-default-format' className='text-xs text-muted-foreground'>默认输出格式</Label>
                                        <Select value={visionTextResponseFormat} onValueChange={(value) => setVisionTextResponseFormat(value as typeof visionTextResponseFormat)}>
                                            <SelectTrigger id='vision-default-format' className='h-10 rounded-xl bg-background text-foreground'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='text'>自然语言文本</SelectItem>
                                                <SelectItem value='json_schema'>结构化 JSON</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor='vision-default-compat' className='text-xs text-muted-foreground'>默认兼容模式</Label>
                                        <Select value={visionTextApiCompatibility} onValueChange={(value) => setVisionTextApiCompatibility(value as typeof visionTextApiCompatibility)}>
                                            <SelectTrigger id='vision-default-compat' className='h-10 rounded-xl bg-background text-foreground'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(VISION_TEXT_API_COMPATIBILITY_LABELS).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor='vision-default-max' className='text-xs text-muted-foreground'>最大输出 Token</Label>
                                        <Input
                                            id='vision-default-max'
                                            type='number'
                                            min={256}
                                            max={32768}
                                            step={256}
                                            value={visionTextMaxOutputTokens}
                                            onChange={(event) => setVisionTextMaxOutputTokens(Number(event.target.value) || DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS)}
                                            className='h-10 rounded-xl bg-background text-foreground'
                                        />
                                    </div>
                                </div>
                                <div className='flex flex-wrap items-center gap-4'>
                                    <div className='flex items-center gap-2'>
                                        <Checkbox
                                            id='vision-default-stream'
                                            checked={visionTextStreamingEnabled}
                                            onCheckedChange={(checked) => setVisionTextStreamingEnabled(!!checked)}
                                        />
                                        <Label htmlFor='vision-default-stream' className='text-sm text-muted-foreground'>
                                            默认流式输出
                                        </Label>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <Checkbox
                                            id='vision-default-structured'
                                            checked={visionTextStructuredOutputEnabled}
                                            onCheckedChange={(checked) => setVisionTextStructuredOutputEnabled(!!checked)}
                                        />
                                        <Label htmlFor='vision-default-structured' className='text-sm text-muted-foreground'>
                                            默认结构化输出
                                        </Label>
                                    </div>
                                </div>
                                <div className='space-y-1.5'>
                                    <Label htmlFor='vision-default-system' className='text-xs text-muted-foreground'>系统提示词</Label>
                                    <Textarea
                                        id='vision-default-system'
                                        value={visionTextSystemPrompt}
                                        onChange={(event) => setVisionTextSystemPrompt(event.target.value)}
                                        className='min-h-32 rounded-xl bg-background text-foreground'
                                    />
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
                                className='min-h-[44px] rounded-xl px-3 text-muted-foreground hover:bg-accent hover:text-foreground'>
                                <ArrowLeft className='h-4 w-4' />
                                返回系统配置
                            </Button>

                            <div className='rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-950 dark:text-violet-100'>
                                这里配置提示词润色的所有参数：API 连接、模型、思考模式、默认内置预设、自定义提示词管理以及下拉选择顺序。
                                {hasEnvPolishingPrompt && polishingCustomPrompts.length === 0 && (
                                    <span className='mt-1 block text-violet-900/80 dark:text-violet-100/75'>
                                        检测到 .env 中配置了 POLISHING_PROMPT；浏览器下拉不会直接显示 ENV 值，如需常用，请在这里添加为自定义提示词并保存。
                                    </span>
                                )}
                            </div>

                            <div className='space-y-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <Label htmlFor='polishing-api-key' className='flex items-center gap-2'>
                                        <Key className='h-4 w-4 text-muted-foreground' />
                                        润色 API Key
                                        <span className='text-xs font-normal text-muted-foreground'>(可选)</span>
                                    </Label>
                                    {polishingApiKey ? statusBadge('UI', 'green') : hasEnvPolishingApiKey ? statusBadge('ENV', 'blue') : statusBadge('复用 OpenAI', 'amber')}
                                </div>
                                <SecretInput
                                    id='polishing-api-key'
                                    value={polishingApiKey}
                                    onChange={setPolishingApiKey}
                                    visible={showPolishingApiKey}
                                    onVisibleChange={() => setShowPolishingApiKey((value) => !value)}
                                    placeholder='留空时复用 OpenAI API Key 或 POLISHING_API_KEY'
                                />
                                <p className='text-xs text-muted-foreground'>留空时优先使用 .env 的 POLISHING_API_KEY，其次复用 OpenAI API Key。</p>
                            </div>

                            <div className='space-y-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <Label htmlFor='polishing-base-url' className='flex items-center gap-2'>
                                        <Globe className='h-4 w-4 text-muted-foreground' />
                                        润色 API Base URL
                                        <span className='text-xs font-normal text-muted-foreground'>(可选)</span>
                                    </Label>
                                    {polishingApiBaseUrl ? statusBadge('UI', 'green') : hasEnvPolishingApiBaseUrl ? statusBadge('ENV', 'blue') : statusBadge('复用 OpenAI', 'amber')}
                                </div>
                                <Input
                                    id='polishing-base-url'
                                    type='url'
                                    placeholder='https://api.openai.com/v1'
                                    value={polishingApiBaseUrl}
                                    onChange={(event) => setPolishingApiBaseUrl(event.target.value)}
                                    autoComplete='off'
                                    className='h-10 rounded-xl bg-background text-foreground'
                                />
                                <p className='text-xs text-muted-foreground'>支持 OpenAI-compatible Chat Completions 端点；若直链优先开启且这里是非官方地址，会锁定客户端直连。</p>
                            </div>

                            <div className='space-y-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <Label htmlFor='polishing-model-id' className='flex items-center gap-2'>
                                        <Cpu className='h-4 w-4 text-muted-foreground' />
                                        润色模型 ID
                                    </Label>
                                    {polishingModelId !== DEFAULT_PROMPT_POLISH_MODEL ? statusBadge('UI', 'green') : envPolishingModelId ? statusBadge('ENV', 'blue') : statusBadge('默认', 'amber')}
                                </div>
                                <Input
                                    id='polishing-model-id'
                                    value={polishingModelId}
                                    onChange={(event) => setPolishingModelId(event.target.value)}
                                    placeholder={envPolishingModelId || DEFAULT_PROMPT_POLISH_MODEL}
                                    autoComplete='off'
                                    spellCheck={false}
                                    className='h-10 rounded-xl bg-background font-mono text-foreground'
                                />
                            </div>

                            <div className='space-y-3 rounded-xl border border-border bg-background/55 p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <Label className='flex items-center gap-2'>
                                        <Cpu className='h-4 w-4 text-muted-foreground' />
                                        润色思考模式
                                    </Label>
                                    {polishingThinkingEnabled ? statusBadge('已开启', 'green') : envPolishingThinkingEnabled ? statusBadge('ENV', 'blue') : statusBadge('关闭', 'amber')}
                                </div>
                                <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                                    <button
                                        type='button'
                                        onClick={() => setPolishingThinkingEnabled(false)}
                                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${!polishingThinkingEnabled ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                        关闭思考
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => setPolishingThinkingEnabled(true)}
                                        className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${polishingThinkingEnabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                        开启思考
                                    </button>
                                </div>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-2'>
                                        <Label htmlFor='polishing-thinking-format' className='text-xs text-muted-foreground'>思考强度参数格式</Label>
                                        <Select
                                            value={polishingThinkingEffortFormat}
                                            onValueChange={(value) => setPolishingThinkingEffortFormat(normalizePromptPolishThinkingEffortFormat(value))}
                                            disabled={!polishingThinkingEnabled}>
                                            <SelectTrigger id='polishing-thinking-format' className='h-10 rounded-xl bg-background text-foreground disabled:cursor-not-allowed disabled:opacity-50'>
                                                <SelectValue placeholder='选择兼容格式' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(polishingThinkingFormatLabels).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-2'>
                                        <Label htmlFor='polishing-thinking-effort' className='text-xs text-muted-foreground'>思考强度</Label>
                                        <Input
                                            id='polishing-thinking-effort'
                                            list='polishing-thinking-effort-presets'
                                            value={polishingThinkingEffort}
                                            onChange={(event) => setPolishingThinkingEffort(event.target.value)}
                                            placeholder={envPolishingThinkingEffort || DEFAULT_PROMPT_POLISH_THINKING_EFFORT}
                                            autoComplete='off'
                                            spellCheck={false}
                                            disabled={!polishingThinkingEnabled}
                                            className='h-10 rounded-xl bg-background font-mono text-foreground disabled:cursor-not-allowed disabled:opacity-50'
                                        />
                                        <datalist id='polishing-thinking-effort-presets'>
                                            {PROMPT_POLISH_THINKING_EFFORT_OPTIONS.map((option) => (
                                                <option key={option} value={option} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                                <p className='text-xs text-muted-foreground'>
                                    开启后会发送 <span className='font-mono'>thinking.type</span>，并按格式附加
                                    <span className='font-mono'> reasoning_effort</span> 或 <span className='font-mono'>output_config.effort</span>。
                                </p>
                                {polishingThinkingEnabled && (
                                    <p className='text-xs text-muted-foreground'>{polishingThinkingFormatDescriptions[polishingThinkingEffortFormat]}</p>
                                )}
                                {(envPolishingThinkingEnabled || envPolishingThinkingEffort || envPolishingThinkingEffortFormat) && (
                                    <p className='text-xs text-muted-foreground'>
                                        .env 可配置 POLISHING_THINKING_ENABLED / POLISHING_THINKING_EFFORT / POLISHING_THINKING_EFFORT_FORMAT
                                        {envPolishingThinkingEffortFormat ? `（当前 ENV 格式：${envPolishingThinkingEffortFormat}）` : ''}。
                                    </p>
                                )}
                            </div>

                            <div className='space-y-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <Label className='flex items-center gap-2'>
                                        <Sparkles className='h-4 w-4 text-muted-foreground' />
                                        默认内置预设
                                    </Label>
                                    {polishingPresetId !== DEFAULT_POLISHING_PRESET_ID ? statusBadge('UI', 'green') : statusBadge('默认', 'amber')}
                                </div>
                                <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                                    {PROMPT_POLISH_PRESETS.map((preset) => {
                                        const selected = polishingPresetId === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type='button'
                                                aria-pressed={selected}
                                                onClick={() => setPolishingPresetId(preset.id)}
                                                className={`rounded-xl border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none ${selected ? 'border-violet-500/50 bg-violet-500/10 text-foreground shadow-sm shadow-violet-500/10 ring-1 ring-violet-500/20' : 'border-border bg-background text-muted-foreground hover:border-violet-300/50 hover:bg-accent hover:text-foreground'}`}>
                                                <span className='block text-sm font-medium'>{preset.label}</span>
                                                <span className='mt-0.5 block text-[11px] text-muted-foreground'>{preset.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className='rounded-xl border border-violet-500/20 bg-violet-500/5 p-3'>
                                    <div className='flex flex-wrap items-center justify-between gap-2'>
                                        <div className='min-w-0'>
                                            <p className='text-sm font-semibold text-foreground'>当前选中：{selectedPolishPreset.label}</p>
                                            <p className='mt-0.5 text-xs text-muted-foreground'>{selectedPolishPreset.description}</p>
                                        </div>
                                        <span className='rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-200'>
                                            {selectedPolishPreset.category}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className='space-y-3'>
                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                    <div className='flex items-center gap-2'>
                                        <Label className='flex items-center gap-2'>
                                            <Sparkles className='h-4 w-4 text-muted-foreground' />
                                            自定义润色提示词
                                        </Label>
                                        {polishingCustomPrompts.length > 0 ? statusBadge(`${polishingCustomPrompts.length} 条`, 'green') : statusBadge('未添加', 'amber')}
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
                                    <div className='space-y-3 rounded-xl border border-border bg-background/70 p-3'>
                                        <p className='text-sm font-medium text-foreground'>
                                            {polishPromptEditIndex >= 0 ? '编辑提示词' : '新增提示词'}
                                        </p>
                                        <div className='space-y-2'>
                                            <Label htmlFor='new-polish-prompt-name' className='text-xs text-muted-foreground'>名称</Label>
                                            <Input
                                                id='new-polish-prompt-name'
                                                value={newPolishPromptName}
                                                onChange={(e) => setNewPolishPromptName(e.target.value)}
                                                placeholder='例如：电商文案专用'
                                                className='h-10 rounded-xl bg-background text-foreground'
                                            />
                                        </div>
                                        <div className='space-y-2'>
                                            <Label htmlFor='new-polish-prompt-system' className='text-xs text-muted-foreground'>系统提示词</Label>
                                            <Textarea
                                                id='new-polish-prompt-system'
                                                value={newPolishPromptSystemPrompt}
                                                onChange={(e) => setNewPolishPromptSystemPrompt(e.target.value)}
                                                placeholder='输入完整提示词...'
                                                className='min-h-24 rounded-xl bg-background text-sm text-foreground'
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
                                                        setPolishingCustomPrompts((prev) => prev.map((p, idx) =>
                                                            idx === polishPromptEditIndex ? { ...p, name, systemPrompt, updatedAt: Date.now() } : p
                                                        ));
                                                    } else {
                                                        const id = `custom-${Date.now()}`;
                                                        setPolishingCustomPrompts((prev) => [...prev, {
                                                            id,
                                                            name,
                                                            systemPrompt,
                                                            createdAt: Date.now(),
                                                        }]);
                                                        setPolishPickerOrder((prev) => {
                                                            if (prev.includes(id)) return prev;
                                                            const temporaryIndex = prev.indexOf(POLISH_PICKER_TOKEN_TEMPORARY);
                                                            if (temporaryIndex === -1) return [...prev, id];
                                                            return [
                                                                ...prev.slice(0, temporaryIndex),
                                                                id,
                                                                ...prev.slice(temporaryIndex),
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
                                    <div key={prompt.id} className='space-y-2 rounded-xl border border-border bg-background/70 p-3'>
                                        <div className='flex items-center justify-between gap-2'>
                                            <p className='text-sm font-semibold text-foreground truncate'>{prompt.name}</p>
                                            <div className='flex items-center gap-1'>
                                                <button
                                                    type='button'
                                                    onClick={() => setPolishingCustomPrompts((prev) => {
                                                        if (idx <= 0) return prev;
                                                        const next = [...prev];
                                                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                                        return next;
                                                    })}
                                                    disabled={idx === 0}
                                                    className='h-8 w-8 min-h-[32px] min-w-[32px] rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
                                                    aria-label='上移'>
                                                    <MoveUp className='h-3.5 w-3.5' />
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => setPolishingCustomPrompts((prev) => {
                                                        if (idx >= prev.length - 1) return prev;
                                                        const next = [...prev];
                                                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                                        return next;
                                                    })}
                                                    disabled={idx === polishingCustomPrompts.length - 1}
                                                    className='h-8 w-8 min-h-[32px] min-w-[32px] rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
                                                    aria-label='下移'>
                                                    <MoveDown className='h-3.5 w-3.5' />
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        setPolishingCustomPrompts((prev) => prev.filter((_, k) => k !== idx));
                                                        setPolishPickerOrder((prev) => prev.filter((t) => t !== prompt.id));
                                                    }}
                                                    className='h-8 w-8 min-h-[32px] min-w-[32px] rounded-md flex items-center justify-center text-muted-foreground hover:bg-red-500/10 hover:text-red-600'
                                                    aria-label='删除提示词'>
                                                    <Trash2 className='h-3.5 w-3.5' />
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        setPolishPromptEditIndex(idx);
                                                        setNewPolishPromptName(prompt.name);
                                                        setNewPolishPromptSystemPrompt(prompt.systemPrompt);
                                                    }}
                                                    className='h-8 min-h-[32px] rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground'>
                                                    编辑
                                                </button>
                                            </div>
                                        </div>
                                        <pre className='max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground'>
                                            {prompt.systemPrompt}
                                        </pre>
                                    </div>
                                ))}

                                {polishingCustomPrompts.length === 0 && polishPromptEditIndex === null && (
                                    <p className='rounded-xl border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground'>
                                        还没有自定义提示词。点击「添加提示词」创建。
                                    </p>
                                )}
                            </div>

                            <div className='space-y-3'>
                                <Label className='flex items-center gap-2'>
                                    <SlidersHorizontal className='h-4 w-4 text-muted-foreground' />
                                    润色下拉选择顺序
                                </Label>
                                <p className='text-xs text-muted-foreground'>调整润色弹出窗口中各选项的显示顺序。</p>

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
                                        <div key={token} className='flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2.5'>
                                            <span className='min-h-[32px] min-w-0 flex-1'>
                                                <span className='block text-sm font-medium text-foreground truncate'>{label}</span>
                                                <span className='block text-xs text-muted-foreground truncate'>{description}</span>
                                            </span>
                                            <div className='flex items-center gap-1 shrink-0'>
                                                <button
                                                    type='button'
                                                    onClick={() => setPolishPickerOrder((prev) => {
                                                        if (idx <= 0) return prev;
                                                        const next = [...prev];
                                                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                                        return next;
                                                    })}
                                                    disabled={idx === 0}
                                                    className='h-8 w-8 min-h-[32px] min-w-[32px] rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
                                                    aria-label='上移'>
                                                    <MoveUp className='h-3.5 w-3.5' />
                                                </button>
                                                <button
                                                    type='button'
                                                    onClick={() => setPolishPickerOrder((prev) => {
                                                        if (idx >= prev.length - 1) return prev;
                                                        const next = [...prev];
                                                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                                        return next;
                                                    })}
                                                    disabled={idx === polishPickerOrder.length - 1}
                                                    className='h-8 w-8 min-h-[32px] min-w-[32px] rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed'
                                                    aria-label='下移'>
                                                    <MoveDown className='h-3.5 w-3.5' />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className='shrink-0 border-t border-border bg-background/95 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6 sm:pb-4'>
                    <div className='mr-auto space-y-1'>
                        {saved && <p className='text-xs text-emerald-600 dark:text-emerald-300'>已保存，配置立即生效 ✓</p>}
                        {saveWarningMessage && <p className='max-w-md text-xs leading-5 text-amber-700 dark:text-amber-300'>{saveWarningMessage}</p>}
                    </div>
                    <Button variant='outline' onClick={() => handleDialogOpenChange(false)} className='rounded-xl'>取消</Button>
                    <Button
                        onClick={handleSave}
                        className='rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 hover:brightness-110 disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none'>
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
                        <Button type='button' variant='outline'>继续编辑</Button>
                    </DialogClose>
                    <Button type='button' variant='destructive' onClick={handleConfirmDiscardChanges}>放弃修改</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
