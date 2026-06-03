import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_STORAGE_KEY, loadConfig, saveConfig } from './config';
import {
    CONFIG_SCHEMA_VERSION,
    READ_ONLY_MIGRATION_CONFIG_FIELDS,
    migrateConfigToCurrent,
    serializeConfigForStorage
} from './config-migrations';
import { PROJECT_HEALTH_LEGACY_CONFIG_V1_FIXTURE } from './project-health-regression-fixtures';

function createLocalStorageMock() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => {
            store.clear();
        }
    };
}

function installBrowserStorage() {
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() });
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });
    return localStorage;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('config schema migrations', () => {
    it('migrates legacy provider credentials into schema v2 provider endpoints', () => {
        const result = migrateConfigToCurrent(PROJECT_HEALTH_LEGACY_CONFIG_V1_FIXTURE);

        expect(result.fromVersion).toBe(1);
        expect(result.toVersion).toBe(CONFIG_SCHEMA_VERSION);
        expect(result.config.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
        for (const field of READ_ONLY_MIGRATION_CONFIG_FIELDS) {
            expect(result.config).not.toHaveProperty(field);
        }
        expect(result.config.providerEndpoints).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'openai:default',
                    apiKey: 'sk-legacy-openai',
                    apiBaseUrl: 'https://legacy-openai.example.com/v1'
                })
            ])
        );
    });

    it('loads legacy localStorage config through the migration pipeline', () => {
        const localStorage = installBrowserStorage();
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(PROJECT_HEALTH_LEGACY_CONFIG_V1_FIXTURE));

        const config = loadConfig();

        expect(config.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
        expect(config.openaiApiKey).toBe('');
        expect(config.providerEndpoints.find((endpoint) => endpoint.id === 'openai:default')).toMatchObject({
            apiKey: 'sk-legacy-openai',
            apiBaseUrl: 'https://legacy-openai.example.com/v1'
        });
    });

    it('serializes new saves without read-only legacy provider fields', () => {
        const localStorage = installBrowserStorage();

        saveConfig({
            openaiApiKey: 'sk-should-not-persist',
            openaiApiBaseUrl: 'https://legacy.example.com/v1',
            providerEndpoints: [
                {
                    id: 'openai:canonical',
                    provider: 'openai',
                    name: 'Canonical OpenAI',
                    apiKey: 'sk-canonical',
                    apiBaseUrl: 'https://canonical.example.com/v1',
                    protocol: 'openai-images',
                    enabled: true
                }
            ]
        });

        const stored = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}') as Record<string, unknown>;
        expect(stored.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
        expect(stored.openaiApiKey).toBeUndefined();
        expect(stored.openaiApiBaseUrl).toBeUndefined();
        expect(stored.providerEndpoints).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'openai:canonical', apiKey: 'sk-canonical' })])
        );
    });

    it('preserves user-customized provider endpoints while normalizing invalid values', () => {
        const stored = serializeConfigForStorage({
            schemaVersion: CONFIG_SCHEMA_VERSION,
            appLanguage: 'invalid-language',
            providerEndpoints: [
                {
                    id: 'relay:custom',
                    provider: 'openai-compatible',
                    name: 'Custom Relay',
                    apiKey: 'sk-custom',
                    apiBaseUrl: 'https://relay.example.com/v1',
                    protocol: 'openai-chat-completions',
                    modelIds: ['model-a', 'model-a', 'model-b'],
                    enabled: true
                }
            ],
            promptHistoryLimit: -1
        });

        expect(stored.providerEndpoints).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'relay:custom',
                    modelIds: ['model-a', 'model-b']
                })
            ])
        );
        expect(stored.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    });
});
