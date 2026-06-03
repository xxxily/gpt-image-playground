import type { AppConfig } from '@/lib/config';
import { normalizeCustomImageModels } from '@/lib/model-registry';
import {
    hydrateDefaultProviderInstanceCredentials,
    normalizeProviderInstances
} from '@/lib/provider-instances';
import { normalizeUnifiedProviderModelConfig } from '@/lib/provider-model-catalog';
import { normalizeVisionTextProviderInstances } from '@/lib/vision-text-provider-instances';

export const CONFIG_SCHEMA_VERSION = 2;

export type ConfigFieldStatus = 'active' | 'read-only migration' | 'deprecated' | 'removed';

export const READ_ONLY_MIGRATION_CONFIG_FIELDS = [
    'openaiApiKey',
    'openaiApiBaseUrl',
    'geminiApiKey',
    'geminiApiBaseUrl',
    'sensenovaApiKey',
    'sensenovaApiBaseUrl',
    'seedreamApiKey',
    'seedreamApiBaseUrl'
] as const;

export const DEPRECATED_CONFIG_FIELDS = ['customPolishPrompts'] as const;

export const CONFIG_FIELD_STATUS: Record<string, ConfigFieldStatus> = {
    schemaVersion: 'active',
    appLanguage: 'active',
    providerEndpoints: 'active',
    modelCatalog: 'active',
    modelTaskDefaultCatalogEntryIds: 'active',
    providerInstances: 'active',
    selectedProviderInstanceId: 'active',
    customImageModels: 'active',
    visionTextProviderInstances: 'active',
    selectedVisionTextProviderInstanceId: 'active',
    visionTextModelId: 'active',
    visionTextTaskType: 'active',
    visionTextDetail: 'active',
    visionTextResponseFormat: 'active',
    visionTextStreamingEnabled: 'active',
    visionTextStructuredOutputEnabled: 'active',
    visionTextMaxOutputTokens: 'active',
    visionTextSystemPrompt: 'active',
    visionTextApiCompatibility: 'active',
    visionTextHistoryEnabled: 'active',
    polishingPrompt: 'active',
    polishingPresetId: 'active',
    polishingThinkingEnabled: 'active',
    polishingThinkingEffort: 'active',
    polishingThinkingEffortFormat: 'active',
    polishingCustomPrompts: 'active',
    polishPickerOrder: 'active',
    imageStorageMode: 'active',
    imageStoragePath: 'active',
    connectionMode: 'active',
    maxConcurrentTasks: 'active',
    promptHistoryLimit: 'active',
    desktopProxyMode: 'active',
    desktopProxyUrl: 'active',
    desktopPromoServiceMode: 'active',
    desktopPromoServiceUrl: 'active',
    desktopDebugMode: 'active',
    videoTaskDefaults: 'active',
    videoSyncOptions: 'active',
    batchFeature: 'active',
    hiddenPromptToolbarButtons: 'active',
    customPolishPrompts: 'deprecated',
    openaiApiKey: 'read-only migration',
    openaiApiBaseUrl: 'read-only migration',
    geminiApiKey: 'read-only migration',
    geminiApiBaseUrl: 'read-only migration',
    sensenovaApiKey: 'read-only migration',
    sensenovaApiBaseUrl: 'read-only migration',
    seedreamApiKey: 'read-only migration',
    seedreamApiBaseUrl: 'read-only migration'
};

export type MigratedConfig = {
    config: Record<string, unknown>;
    fromVersion: number;
    toVersion: typeof CONFIG_SCHEMA_VERSION;
    warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getConfigSchemaVersion(value: unknown): number {
    if (!isRecord(value)) return 1;
    return typeof value.schemaVersion === 'number' && Number.isInteger(value.schemaVersion) && value.schemaVersion > 0
        ? value.schemaVersion
        : 1;
}

function stripFields(source: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
    const result = { ...source };
    fields.forEach((field) => {
        delete result[field];
    });
    return result;
}

function normalizeConfigV2(source: Record<string, unknown>): Record<string, unknown> {
    const providerInstances = hydrateDefaultProviderInstanceCredentials(
        normalizeProviderInstances(source.providerInstances, source),
        source
    );
    const customImageModels = normalizeCustomImageModels(source.customImageModels);
    const visionTextProviderInstances = normalizeVisionTextProviderInstances(source.visionTextProviderInstances);
    const unifiedProviderModelConfig = normalizeUnifiedProviderModelConfig(source, {
        ...source,
        providerInstances,
        customImageModels,
        visionTextProviderInstances
    });

    return {
        ...stripFields(source, [...READ_ONLY_MIGRATION_CONFIG_FIELDS, ...DEPRECATED_CONFIG_FIELDS]),
        schemaVersion: CONFIG_SCHEMA_VERSION,
        providerInstances,
        customImageModels,
        providerEndpoints: unifiedProviderModelConfig.providerEndpoints,
        modelCatalog: unifiedProviderModelConfig.modelCatalog,
        modelTaskDefaultCatalogEntryIds: unifiedProviderModelConfig.modelTaskDefaultCatalogEntryIds,
        visionTextProviderInstances
    };
}

export function migrateConfigToCurrent(raw: unknown): MigratedConfig {
    const source = isRecord(raw) ? { ...raw } : {};
    const fromVersion = getConfigSchemaVersion(source);
    const warnings: string[] = [];

    if (fromVersion < CONFIG_SCHEMA_VERSION) {
        warnings.push(`schema v${fromVersion} -> v${CONFIG_SCHEMA_VERSION}`);
    }
    if (fromVersion > CONFIG_SCHEMA_VERSION) {
        warnings.push(`schema v${fromVersion} read as v${CONFIG_SCHEMA_VERSION}`);
    }

    return {
        config: normalizeConfigV2(source),
        fromVersion,
        toVersion: CONFIG_SCHEMA_VERSION,
        warnings
    };
}

export function serializeConfigForStorage(config: Partial<AppConfig> | Record<string, unknown>): Record<string, unknown> {
    return migrateConfigToCurrent(config).config;
}
