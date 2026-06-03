import type { AppConfig } from '@/lib/config';

export const PROJECT_HEALTH_LEGACY_CONFIG_V1_FIXTURE = {
    appLanguage: 'zh-CN',
    openaiApiKey: 'sk-legacy-openai',
    openaiApiBaseUrl: 'https://legacy-openai.example.com/v1',
    geminiApiKey: 'legacy-gemini-key',
    geminiApiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    sensenovaApiKey: 'legacy-sensenova-key',
    sensenovaApiBaseUrl: 'https://api.sensenova.cn/v1',
    seedreamApiKey: 'legacy-seedream-key',
    seedreamApiBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    providerInstances: [
        {
            id: 'openai:default',
            type: 'openai',
            name: 'OpenAI',
            apiKey: '',
            apiBaseUrl: '',
            models: ['legacy-image-model'],
            isDefault: true
        }
    ],
    selectedProviderInstanceId: 'openai:default',
    customImageModels: [
        {
            id: 'legacy-image-model',
            provider: 'openai',
            instanceId: 'openai:default',
            label: 'Legacy Image Model',
            capabilities: {
                supportsEditing: true,
                supportsMask: true,
                supportsCustomSize: true
            }
        }
    ],
    providerEndpoints: [],
    modelCatalog: [],
    modelTaskDefaultCatalogEntryIds: {},
    visionTextProviderInstances: [
        {
            id: 'vision:default',
            kind: 'openai-compatible',
            name: 'Vision Relay',
            apiKey: 'legacy-vision-key',
            apiBaseUrl: 'https://vision.example.com/v1',
            apiCompatibility: 'chat-completions',
            models: ['legacy-vl-model'],
            isDefault: true
        }
    ],
    selectedVisionTextProviderInstanceId: 'vision:default',
    visionTextModelId: 'legacy-vl-model',
    polishingPrompt: 'Polish prompts without changing intent.',
    connectionMode: 'proxy',
    imageStorageMode: 'auto',
    promptHistoryLimit: 80
} satisfies Partial<AppConfig> & Record<string, unknown>;

export const PROJECT_HEALTH_ADMIN_SETTINGS_FIXTURE = {
    publicRuntimeConfig: {
        publicShortLinksEnabled: true,
        publicPromoPlacementsEnabled: true,
        exposesSecrets: false
    },
    protectedAdminConfig: {
        shortLinkModerationEnabled: true,
        promoGroupsEditable: true,
        auditLogRetentionDays: 30
    },
    serverSecretConfig: {
        betterAuthSecretConfigured: false,
        shortLinkEncryptionSecretConfigured: false,
        shortLinkStatsSaltConfigured: false
    },
    deploymentOnlyConfig: {
        nodeEnv: 'production',
        desktopBuild: false,
        databaseUrlConfigured: true
    }
} as const;

export const PROJECT_HEALTH_WORKBENCH_REGRESSION_FIXTURE = {
    prompt: 'Create a clean product image for a translucent water bottle on a desk.',
    runtime: {
        webApiRoutesAvailable: true,
        tauriDesktop: false,
        mobileViewport: true,
        clientDirectMode: false
    },
    sourceImages: [
        {
            id: 'source-1',
            name: 'bottle-reference.png',
            mimeType: 'image/png',
            sizeBytes: 248_000
        }
    ],
    expectedBoundaries: [
        'submission',
        'history',
        'share',
        'sync',
        'desktop-assets',
        'video-boundary',
        'vision-text'
    ],
    expectedStorageGroups: ['config', 'history', 'sync', 'assets']
} as const;
