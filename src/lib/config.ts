import { normalizeCustomImageModels, type StoredCustomImageModel } from '@/lib/model-registry';

export interface AppConfig {
    openaiApiKey: string;
    openaiApiBaseUrl: string;
    geminiApiKey: string;
    geminiApiBaseUrl: string;
    customImageModels: StoredCustomImageModel[];
    imageStorageMode: 'fs' | 'indexeddb' | 'auto';
    connectionMode: 'proxy' | 'direct';
    maxConcurrentTasks: number;
}

export const DEFAULT_CONFIG: AppConfig = {
    openaiApiKey: '',
    openaiApiBaseUrl: '',
    geminiApiKey: '',
    geminiApiBaseUrl: '',
    customImageModels: [],
    imageStorageMode: 'auto',
    connectionMode: 'proxy',
    maxConcurrentTasks: 3,
};

const CONFIG_STORAGE_KEY = 'gpt-image-playground-config';

export function loadConfig(): AppConfig {
    try {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as Partial<AppConfig>;
            return {
                ...DEFAULT_CONFIG,
                ...parsed,
                customImageModels: normalizeCustomImageModels(parsed.customImageModels)
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
    if (key === 'imageStorageMode') {
        if (uiConfig.imageStorageMode && uiConfig.imageStorageMode !== 'auto') {
            return uiConfig.imageStorageMode as AppConfig[K];
        }
        return (envValue || DEFAULT_CONFIG.imageStorageMode) as AppConfig[K];
    }
    if (key === 'customImageModels') {
        return normalizeCustomImageModels(uiConfig.customImageModels) as AppConfig[K];
    }
    
    return uiConfig[key] || DEFAULT_CONFIG[key];
}
