import {
    normalizeDesktopPromoServiceMode,
    normalizeDesktopPromoServiceUrl,
    normalizeDesktopProxyMode,
    type DesktopPromoServiceMode,
    type DesktopProxyMode
} from '@/lib/desktop-config';
import { normalizeCustomImageModels, type StoredCustomImageModel } from '@/lib/model-registry';
import { DEFAULT_PROVIDER_INSTANCES, normalizeProviderInstances, type ProviderInstance } from '@/lib/provider-instances';
import {
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_MODEL,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT,
    DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT,
    DEFAULT_PROMPT_POLISH_THINKING_ENABLED,
    getDefaultPolishPickerOrder,
    normalizePolishPickerOrder,
    normalizePromptPolishThinkingEffort,
    normalizePromptPolishThinkingEffortFormat,
    normalizePromptPolishThinkingEnabled,
    normalizePromptPolishPresetId,
    normalizeStoredCustomPolishPrompts,
    type PolishPickerToken,
    type StoredCustomPolishPrompt,
    type PromptPolishThinkingEffortFormat
} from '@/lib/prompt-polish-core';
import { DEFAULT_PROMPT_HISTORY_LIMIT, normalizePromptHistoryLimit } from '@/lib/prompt-history';

const DEFAULT_SITE_URL = 'https://img-playground.anzz.site';
const isDesktopBuild = process.env.DESKTOP_BUILD === '1';
const defaultDesktopPromoServiceUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    DEFAULT_SITE_URL;

export interface AppConfig {
    openaiApiKey: string;
    openaiApiBaseUrl: string;
    geminiApiKey: string;
    geminiApiBaseUrl: string;
    sensenovaApiKey: string;
    sensenovaApiBaseUrl: string;
    seedreamApiKey: string;
    seedreamApiBaseUrl: string;
    providerInstances: ProviderInstance[];
    selectedProviderInstanceId: string;
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
    imageStorageMode: 'fs' | 'indexeddb' | 'auto';
    imageStoragePath: string;
    connectionMode: 'proxy' | 'direct';
    maxConcurrentTasks: number;
    promptHistoryLimit: number;
    desktopProxyMode: DesktopProxyMode;
    desktopProxyUrl: string;
    desktopPromoServiceMode: DesktopPromoServiceMode;
    desktopPromoServiceUrl: string;
    desktopDebugMode: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
    openaiApiKey: '',
    openaiApiBaseUrl: '',
    geminiApiKey: '',
    geminiApiBaseUrl: '',
    sensenovaApiKey: '',
    sensenovaApiBaseUrl: '',
    seedreamApiKey: '',
    seedreamApiBaseUrl: '',
    providerInstances: [...DEFAULT_PROVIDER_INSTANCES],
    selectedProviderInstanceId: '',
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
    imageStorageMode: 'auto',
    imageStoragePath: '',
    connectionMode: 'proxy',
    maxConcurrentTasks: 3,
    promptHistoryLimit: DEFAULT_PROMPT_HISTORY_LIMIT,
    desktopProxyMode: 'disabled',
    desktopProxyUrl: '',
    desktopPromoServiceMode: isDesktopBuild ? 'origin' : 'current',
    desktopPromoServiceUrl: isDesktopBuild ? defaultDesktopPromoServiceUrl : '',
    desktopDebugMode: false,
};

const CONFIG_STORAGE_KEY = 'gpt-image-playground-config';
export const CONFIG_CHANGED_EVENT = 'gpt-image-playground-config-changed';

export function loadConfig(): AppConfig {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;

    try {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as Partial<AppConfig> & { customPolishPrompts?: unknown };
            const providerInstances = normalizeProviderInstances(parsed.providerInstances, parsed);
            const polishingCustomPrompts = normalizeStoredCustomPolishPrompts(
                parsed.polishingCustomPrompts ?? parsed.customPolishPrompts,
                parsed.polishingPrompt
            );
            const polishPickerOrder = normalizePolishPickerOrder(
                parsed.polishPickerOrder,
                new Set(polishingCustomPrompts.map((prompt) => prompt.id))
            );
            return {
                ...DEFAULT_CONFIG,
                ...parsed,
                providerInstances,
                selectedProviderInstanceId: typeof parsed.selectedProviderInstanceId === 'string' ? parsed.selectedProviderInstanceId : '',
                customImageModels: normalizeCustomImageModels(parsed.customImageModels),
                polishingPresetId: normalizePromptPolishPresetId(parsed.polishingPresetId),
                polishingThinkingEnabled: normalizePromptPolishThinkingEnabled(parsed.polishingThinkingEnabled),
                polishingThinkingEffort: normalizePromptPolishThinkingEffort(parsed.polishingThinkingEffort),
                polishingThinkingEffortFormat: normalizePromptPolishThinkingEffortFormat(parsed.polishingThinkingEffortFormat),
                polishingCustomPrompts,
                polishPickerOrder,
                promptHistoryLimit: normalizePromptHistoryLimit(parsed.promptHistoryLimit),
                imageStoragePath: typeof parsed.imageStoragePath === 'string' ? parsed.imageStoragePath : '',
                desktopProxyMode: normalizeDesktopProxyMode(parsed.desktopProxyMode),
                desktopProxyUrl: typeof parsed.desktopProxyUrl === 'string' ? parsed.desktopProxyUrl : '',
                desktopPromoServiceMode: normalizeDesktopPromoServiceMode(parsed.desktopPromoServiceMode),
                desktopPromoServiceUrl:
                    typeof parsed.desktopPromoServiceUrl === 'string'
                        ? normalizeDesktopPromoServiceUrl(
                              parsed.desktopPromoServiceUrl,
                              normalizeDesktopPromoServiceMode(parsed.desktopPromoServiceMode)
                          )
                        : '',
                desktopDebugMode: typeof parsed.desktopDebugMode === 'boolean' ? parsed.desktopDebugMode : false
            };
        }
    } catch {
        // ignore
    }
    return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<AppConfig>): void {
    try {
        const existing = loadConfig();
        const merged = { ...existing, ...config };
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(CONFIG_CHANGED_EVENT, {
                detail: { changedKeys: Object.keys(config) }
            }));
        }
    } catch {
        // ignore
    }
}

export function getConfigValue<K extends keyof AppConfig>(key: K, envValue?: string): AppConfig[K] {
    const uiConfig = loadConfig();
    
    // Priority: UI config > env value > default
    if (key === 'openaiApiKey') {
        return (uiConfig.openaiApiKey || envValue || DEFAULT_CONFIG.openaiApiKey) as AppConfig[K];
    }
    if (key === 'openaiApiBaseUrl') {
        return (uiConfig.openaiApiBaseUrl || envValue || DEFAULT_CONFIG.openaiApiBaseUrl) as AppConfig[K];
    }
    if (key === 'geminiApiKey') {
        return (uiConfig.geminiApiKey || envValue || DEFAULT_CONFIG.geminiApiKey) as AppConfig[K];
    }
    if (key === 'geminiApiBaseUrl') {
        return (uiConfig.geminiApiBaseUrl || envValue || DEFAULT_CONFIG.geminiApiBaseUrl) as AppConfig[K];
    }
    if (key === 'sensenovaApiKey') {
        return (uiConfig.sensenovaApiKey || envValue || DEFAULT_CONFIG.sensenovaApiKey) as AppConfig[K];
    }
    if (key === 'sensenovaApiBaseUrl') {
        return (uiConfig.sensenovaApiBaseUrl || envValue || DEFAULT_CONFIG.sensenovaApiBaseUrl) as AppConfig[K];
    }
    if (key === 'seedreamApiKey') {
        return (uiConfig.seedreamApiKey || envValue || DEFAULT_CONFIG.seedreamApiKey) as AppConfig[K];
    }
    if (key === 'seedreamApiBaseUrl') {
        return (uiConfig.seedreamApiBaseUrl || envValue || DEFAULT_CONFIG.seedreamApiBaseUrl) as AppConfig[K];
    }
    if (key === 'polishingApiKey') {
        return (uiConfig.polishingApiKey || envValue || DEFAULT_CONFIG.polishingApiKey) as AppConfig[K];
    }
    if (key === 'polishingApiBaseUrl') {
        return (uiConfig.polishingApiBaseUrl || envValue || DEFAULT_CONFIG.polishingApiBaseUrl) as AppConfig[K];
    }
    if (key === 'polishingModelId') {
        return (uiConfig.polishingModelId || envValue || DEFAULT_CONFIG.polishingModelId) as AppConfig[K];
    }
    if (key === 'polishingPrompt') {
        return (uiConfig.polishingPrompt || envValue || DEFAULT_CONFIG.polishingPrompt) as AppConfig[K];
    }
    if (key === 'polishingPresetId') {
        return (normalizePromptPolishPresetId(uiConfig.polishingPresetId) || DEFAULT_CONFIG.polishingPresetId) as AppConfig[K];
    }
    if (key === 'polishingThinkingEnabled') {
        return normalizePromptPolishThinkingEnabled(uiConfig.polishingThinkingEnabled || envValue) as AppConfig[K];
    }
    if (key === 'polishingThinkingEffort') {
        return (uiConfig.polishingThinkingEffort || envValue || DEFAULT_CONFIG.polishingThinkingEffort) as AppConfig[K];
    }
    if (key === 'polishingThinkingEffortFormat') {
        return (uiConfig.polishingThinkingEffortFormat || envValue || DEFAULT_CONFIG.polishingThinkingEffortFormat) as AppConfig[K];
    }
    if (key === 'imageStorageMode') {
        if (uiConfig.imageStorageMode && uiConfig.imageStorageMode !== 'auto') {
            return uiConfig.imageStorageMode as AppConfig[K];
        }
        return (envValue || DEFAULT_CONFIG.imageStorageMode) as AppConfig[K];
    }
    if (key === 'customImageModels') {
        return normalizeCustomImageModels(uiConfig.customImageModels) as AppConfig[K];
    }
    if (key === 'providerInstances') {
        return normalizeProviderInstances(uiConfig.providerInstances, uiConfig) as AppConfig[K];
    }
    
    return uiConfig[key] || DEFAULT_CONFIG[key];
}
