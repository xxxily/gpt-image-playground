import {
    DEFAULT_BATCH_FEATURE_CONFIG,
    type BatchFeatureConfig
} from '@/lib/batch-config';
import {
    DEFAULT_HIDDEN_PROMPT_TOOLBAR_BUTTONS,
    type PromptToolbarButtonId
} from '@/lib/config';
import type { DesktopPromoServiceMode, DesktopProxyMode } from '@/lib/desktop-config';
import type { AppLanguage } from '@/lib/i18n/language';
import type { StoredCustomImageModel } from '@/lib/model-registry';
import { DEFAULT_PROMPT_HISTORY_LIMIT } from '@/lib/prompt-history';
import {
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
    DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
    getDefaultPolishPickerOrder,
    type PolishPickerToken,
    type PromptPolishThinkingEffortFormat,
    type StoredCustomPolishPrompt
} from '@/lib/prompt-polish-core';
import type { ProviderInstance } from '@/lib/provider-instances';
import type {
    ModelCatalogEntry,
    ModelTaskDefaultCatalogEntryIds,
    ProviderEndpoint
} from '@/lib/provider-model-catalog';
import {
    DEFAULT_VIDEO_SYNC_OPTIONS,
    DEFAULT_VIDEO_TASK_DEFAULTS,
    type VideoSyncOptions,
    type VideoTaskDefaults
} from '@/lib/video-types';
import type { VisionTextProviderInstance } from '@/lib/vision-text-provider-instances';
import {
    DEFAULT_VISION_TEXT_API_COMPATIBILITY,
    DEFAULT_VISION_TEXT_DETAIL,
    DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
    DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
    DEFAULT_VISION_TEXT_STREAMING_ENABLED,
    DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED,
    DEFAULT_VISION_TEXT_SYSTEM_PROMPT,
    DEFAULT_VISION_TEXT_TASK_TYPE,
    type VisionTextApiCompatibility,
    type VisionTextDetail,
    type VisionTextResponseFormat,
    type VisionTextTaskType
} from '@/lib/vision-text-types';

export type InitialConfig = {
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

export function createInitialSettingsConfig(appLanguage: AppLanguage): InitialConfig {
    return {
        appLanguage,
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
    };
}
