import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG, loadConfig, saveConfig } from './config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_VIDEO_SYNC_OPTIONS,
    DEFAULT_VIDEO_TASK_DEFAULTS
} from '@/lib/video-types';

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

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('config video fields', () => {
    it('loadConfig returns videoTaskDefaults and videoSyncOptions of correct shape for missing input', () => {
        const localStorage = createLocalStorageMock();
        vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() });
        vi.stubGlobal('localStorage', localStorage);
        vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });

        const configDefaults = loadConfig();

        expect(configDefaults.videoTaskDefaults).toEqual(DEFAULT_VIDEO_TASK_DEFAULTS);
        expect(configDefaults.videoSyncOptions).toEqual(DEFAULT_VIDEO_SYNC_OPTIONS);

        localStorage.setItem(
            CONFIG_STORAGE_KEY,
            JSON.stringify({ appLanguage: 'en-US' })
        );
        const configPartial = loadConfig();
        expect(configPartial.videoTaskDefaults).toEqual(DEFAULT_VIDEO_TASK_DEFAULTS);
        expect(configPartial.videoSyncOptions).toEqual(DEFAULT_VIDEO_SYNC_OPTIONS);
    });

    it('loadConfig clamps invalid videoTaskDefaults.pollingIntervalSeconds to 1', () => {
        const localStorage = createLocalStorageMock();
        vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() });
        vi.stubGlobal('localStorage', localStorage);
        vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });

        localStorage.setItem(
            CONFIG_STORAGE_KEY,
            JSON.stringify({
                appLanguage: 'en-US',
                videoTaskDefaults: { pollingIntervalSeconds: -5 }
            })
        );

        const config = loadConfig();
        expect(config.videoTaskDefaults.pollingIntervalSeconds).toBe(1);
    });

    it('persists unified task defaults for vision, polish, and video tasks', () => {
        const localStorage = createLocalStorageMock();
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', { localStorage, dispatchEvent });
        vi.stubGlobal('localStorage', localStorage);
        vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });

        saveConfig({
            ...DEFAULT_CONFIG,
            providerEndpoints: [
                {
                    id: 'openai:vision',
                    provider: 'openai-compatible',
                    name: 'Vision Relay',
                    apiKey: 'vision-key',
                    apiBaseUrl: 'https://vision.example.com/v1',
                    protocol: 'openai-chat-completions',
                    enabled: true
                }
            ],
            modelCatalog: [
                {
                    id: 'openai:vision::vision-model',
                    rawModelId: 'vision-model',
                    providerEndpointId: 'openai:vision',
                    provider: 'openai-compatible',
                    label: 'vision-model',
                    source: 'remote',
                    enabled: true,
                    capabilities: {
                        tasks: ['vision.text', 'text.generate'],
                        inputModalities: ['text', 'image'],
                        outputModalities: ['text']
                    },
                    capabilityConfidence: 'high'
                },
                {
                    id: 'openai:vision::polish-model',
                    rawModelId: 'polish-model',
                    providerEndpointId: 'openai:vision',
                    provider: 'openai-compatible',
                    label: 'polish-model',
                    source: 'remote',
                    enabled: true,
                    capabilities: {
                        tasks: ['prompt.polish', 'text.generate'],
                        inputModalities: ['text'],
                        outputModalities: ['text']
                    },
                    capabilityConfidence: 'high'
                },
                {
                    id: 'openai:vision::video-model',
                    rawModelId: 'video-model',
                    providerEndpointId: 'openai:vision',
                    provider: 'openai-compatible',
                    label: 'video-model',
                    source: 'remote',
                    enabled: true,
                    capabilities: {
                        tasks: ['video.generate', 'video.imageToVideo'],
                        inputModalities: ['text', 'image'],
                        outputModalities: ['video']
                    },
                    capabilityConfidence: 'high'
                }
            ],
            modelTaskDefaultCatalogEntryIds: {
                'vision.text': 'openai:vision::vision-model',
                'prompt.polish': 'openai:vision::polish-model',
                'video.generate': 'openai:vision::video-model',
                'video.imageToVideo': 'openai:vision::video-model'
            }
        });

        const stored = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}') as {
            modelTaskDefaultCatalogEntryIds?: Record<string, string>;
        };
        expect(stored.modelTaskDefaultCatalogEntryIds).toMatchObject({
            'vision.text': 'openai:vision::vision-model',
            'prompt.polish': 'openai:vision::polish-model',
            'video.generate': 'openai:vision::video-model',
            'video.imageToVideo': 'openai:vision::video-model'
        });

        const loaded = loadConfig();
        expect(loaded.modelTaskDefaultCatalogEntryIds).toMatchObject(stored.modelTaskDefaultCatalogEntryIds || {});
    });

    it('does not derive batch plan selection from polishing model binding', () => {
        const localStorage = createLocalStorageMock();
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', { localStorage, dispatchEvent });
        vi.stubGlobal('localStorage', localStorage);
        vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });

        saveConfig({
            ...DEFAULT_CONFIG,
            providerEndpoints: [
                {
                    id: 'openai:text',
                    provider: 'openai-compatible',
                    name: 'Text Relay',
                    apiKey: 'text-key',
                    apiBaseUrl: 'https://text.example.com/v1',
                    protocol: 'openai-chat-completions',
                    enabled: true
                }
            ],
            modelCatalog: [
                {
                    id: 'openai:text::batch-model',
                    rawModelId: 'batch-model',
                    providerEndpointId: 'openai:text',
                    provider: 'openai-compatible',
                    label: 'batch-model',
                    source: 'remote',
                    enabled: true,
                    capabilities: {
                        tasks: ['prompt.polish', 'prompt.batchPlan', 'text.generate'],
                        inputModalities: ['text'],
                        outputModalities: ['text']
                    },
                    capabilityConfidence: 'high'
                }
            ],
            modelTaskDefaultCatalogEntryIds: {
                'prompt.polish': 'openai:text::batch-model'
            }
        });

        const loaded = loadConfig();
        expect(loaded.modelTaskDefaultCatalogEntryIds).toMatchObject({
            'prompt.polish': 'openai:text::batch-model'
        });
        expect(loaded.modelTaskDefaultCatalogEntryIds['prompt.batchPlan']).toBeUndefined();
    });
});
