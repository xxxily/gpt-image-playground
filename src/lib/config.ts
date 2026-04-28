export interface AppConfig {
    openaiApiKey: string;
    openaiApiBaseUrl: string;
    imageStorageMode: 'fs' | 'indexeddb' | 'auto';
    connectionMode: 'proxy' | 'direct';
    maxConcurrentTasks: number;
}

export const DEFAULT_CONFIG: AppConfig = {
    openaiApiKey: '',
    openaiApiBaseUrl: '',
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
            return { ...DEFAULT_CONFIG, ...parsed };
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
    if (key === 'imageStorageMode') {
        if (uiConfig.imageStorageMode && uiConfig.imageStorageMode !== 'auto') {
            return uiConfig.imageStorageMode as AppConfig[K];
        }
        return (envValue || DEFAULT_CONFIG.imageStorageMode) as AppConfig[K];
    }
    
    return uiConfig[key] || DEFAULT_CONFIG[key];
}
