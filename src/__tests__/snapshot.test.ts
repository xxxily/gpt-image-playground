import { describe, it, expect } from 'vitest';
import { buildManifest, createSnapshot, verifyManifestRoundtrip, sanitizeAppConfigForSync } from '@/lib/sync/snapshot';
import { DEFAULT_MANIFEST_DEVICE_ID, DEFAULT_MANIFEST_REVISION, validateManifest, MANIFEST_VERSION } from '@/lib/sync/manifest';
import { DEFAULT_CONFIG, type AppConfig } from '@/lib/config';
import type { HistoryMetadata } from '@/types/history';
import type { PromptTemplate } from '@/types/prompt-template';
import type { PromptHistoryEntry } from '@/lib/prompt-history';

const mockAppConfig: AppConfig = {
    ...DEFAULT_CONFIG,
    openaiApiKey: 'sk-secret-123',
    openaiApiBaseUrl: 'https://api.openai.com/v1',
    geminiApiKey: 'gemini-key-456',
    geminiApiBaseUrl: '',
    sensenovaApiKey: 'sensenova-key',
    sensenovaApiBaseUrl: '',
    seedreamApiKey: 'seedream-key',
    seedreamApiBaseUrl: '',
    providerInstances: [
        {
            id: 'openai:default',
            type: 'openai',
            name: 'OpenAI',
            apiKey: 'nested-provider-key',
            apiBaseUrl: 'https://api.openai.com/v1',
            models: [],
            isDefault: true
        }
    ],
    selectedProviderInstanceId: '',
    customImageModels: [],
    polishingApiKey: 'polish-key',
    polishingApiBaseUrl: '',
    polishingModelId: 'gpt-4o-mini',
    polishingPrompt: 'You are a helpful assistant',
    polishingPresetId: 'default',
    polishingThinkingEnabled: false,
    polishingThinkingEffort: 'medium',
    polishingThinkingEffortFormat: 'openai',
    polishingCustomPrompts: [],
    polishPickerOrder: [],
    imageStorageMode: 'indexeddb',
    imageStoragePath: '',
    connectionMode: 'proxy',
    maxConcurrentTasks: 3,
    promptHistoryLimit: 20,
    desktopProxyMode: 'disabled',
    desktopProxyUrl: '',
    desktopPromoServiceMode: 'current',
    desktopPromoServiceUrl: '',
    desktopDebugMode: false
};

const mockPromptHistory: PromptHistoryEntry[] = [
    { prompt: 'a cat', timestamp: 1700000000000 },
    { prompt: 'a dog', timestamp: 1700000001000 }
];

const mockTemplates: PromptTemplate[] = [
    { id: 't1', name: 'Logo', categoryId: 'cat1', prompt: 'Design a logo' }
];

const mockImageHistory: HistoryMetadata[] = [
    {
        timestamp: 1700000000000,
        images: [{ filename: 'test.png', size: 123456 }],
        durationMs: 5000,
        quality: 'auto',
        background: 'auto',
        moderation: 'auto',
        prompt: 'test prompt',
        mode: 'generate',
        costDetails: { estimated_cost_usd: 0.04, text_input_tokens: 100, image_input_tokens: 0, image_output_tokens: 0 }
    }
];

const basePrefix = 'gpt-image-playground/v1/test-profile/snapshots/snap-001';

describe('buildManifest', () => {
    it('strips API keys from appConfig', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            []
        );

        expect(manifest.appConfig.openaiApiKey).toBeUndefined();
        expect(manifest.appConfig.geminiApiKey).toBeUndefined();
        expect(manifest.appConfig.sensenovaApiKey).toBeUndefined();
        expect(manifest.appConfig.seedreamApiKey).toBeUndefined();
        expect(manifest.appConfig.polishingApiKey).toBeUndefined();
        expect(manifest.appConfig.providerInstances?.[0]?.apiKey).toBe('');
    });

    it('preserves non-secret config fields', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            []
        );

        expect(manifest.appConfig.openaiApiBaseUrl).toBe('https://api.openai.com/v1');
        expect(manifest.appConfig.imageStorageMode).toBe('indexeddb');
        expect(manifest.appConfig.maxConcurrentTasks).toBe(3);
        expect(manifest.imageHistory[0].images[0].size).toBe(123456);
    });

    it('has correct version and snapshotId', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            []
        );

        expect(manifest.version).toBe(MANIFEST_VERSION);
        expect(manifest.snapshotId).toBe('snap-001');
    });

    it('records producer device and monotonic manifest revision metadata', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            [],
            undefined,
            'metadata',
            {
                deviceId: 'device-alpha',
                revision: 12,
                parentSnapshotId: 'snap-000'
            }
        );

        expect(manifest.deviceId).toBe('device-alpha');
        expect(manifest.revision).toBe(12);
        expect(manifest.parentSnapshotId).toBe('snap-000');
    });

    it('stores tombstones for intentional remote deletions', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            [],
            undefined,
            'metadata',
            {
                deviceId: 'device-alpha',
                tombstones: [{
                    filename: 'deleted.png',
                    objectKey: 'gpt-image-playground/v1/default/images/abc/deleted.png',
                    sha256: 'a'.repeat(64),
                    deletedAt: 1778310000000,
                    deviceId: 'device-alpha',
                    reason: 'local-delete'
                }]
            }
        );

        expect(manifest.tombstones).toEqual([{
            filename: 'deleted.png',
            objectKey: 'gpt-image-playground/v1/default/images/abc/deleted.png',
            sha256: 'a'.repeat(64),
            deletedAt: 1778310000000,
            deviceId: 'device-alpha',
            reason: 'local-delete'
        }]);
    });

    it('serializes prompt history', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            []
        );

        expect(manifest.promptHistory).toEqual(mockPromptHistory);
    });

    it('serializes templates without source field', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            []
        );

        expect(manifest.userPromptTemplates).toHaveLength(1);
        expect(manifest.userPromptTemplates[0]).not.toHaveProperty('source');
    });
});

describe('verifyManifestRoundtrip', () => {
    it('rejects manifest with API keys present', () => {
        const manifest = buildManifest('snap-001', basePrefix, mockAppConfig, [], [], [], []);
        const badManifest = { ...manifest, appConfig: { ...manifest.appConfig, openaiApiKey: 'leaked' } };
        expect(verifyManifestRoundtrip(badManifest)).toBeNull();
    });

    it('rejects manifest with nested provider API keys present', () => {
        const manifest = buildManifest('snap-001', basePrefix, mockAppConfig, [], [], [], []);
        const badManifest = {
            ...manifest,
            appConfig: {
                ...manifest.appConfig,
                providerInstances: [{ id: 'openai:default', apiKey: 'leaked' }]
            }
        };
        expect(verifyManifestRoundtrip(badManifest)).toBeNull();
    });

    it('rejects manifest with duplicate filenames', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            [],
            [],
            [],
            [
                { filename: 'a.png', sha256: 'abc123', objectKey: 'k1', mimeType: 'image/png', size: 100 },
                { filename: 'a.png', sha256: 'def456', objectKey: 'k2', mimeType: 'image/png', size: 200 }
            ]
        );
        expect(verifyManifestRoundtrip(manifest)).toBeNull();
    });

    it('rejects invalid filename pattern', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            [],
            [],
            [],
            [
                { filename: '../../etc/passwd', sha256: 'abc', objectKey: 'k', mimeType: 'text/plain', size: 10 }
            ]
        );
        expect(verifyManifestRoundtrip(manifest)).toBeNull();
    });

    it('accepts valid manifest', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            [
                { filename: 'photo-001.png', sha256: 'abc123', objectKey: 'k1', mimeType: 'image/png', size: 1024 }
            ]
        );
        const verified = verifyManifestRoundtrip(manifest);
        expect(verified).not.toBeNull();
        expect(verified?.snapshotId).toBe('snap-001');
        expect(verified?.images).toHaveLength(1);
        expect(verified?.images[0]?.objectKey).toBe(`${basePrefix}/images/photo-001.png`);
    });

    it('accepts content-addressed image object keys', () => {
        const sha256 = 'a'.repeat(64);
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            mockPromptHistory,
            mockTemplates,
            mockImageHistory,
            [
                {
                    filename: 'photo-001.png',
                    sha256,
                    objectKey: `gpt-image-playground/v1/test-profile/images/${sha256}/photo-001.png`,
                    mimeType: 'image/png',
                    size: 1024
                }
            ]
        );

        const verified = verifyManifestRoundtrip({
            ...manifest,
            images: [
                {
                    filename: 'photo-001.png',
                    sha256,
                    objectKey: `gpt-image-playground/v1/test-profile/images/${sha256}/photo-001.png`,
                    mimeType: 'image/png',
                    size: 1024
                }
            ]
        });

        expect(verified).not.toBeNull();
        expect(verified?.images[0]?.objectKey).toBe(`gpt-image-playground/v1/test-profile/images/${sha256}/photo-001.png`);
    });

    it('rejects manifest with wrong version', () => {
        const manifest = buildManifest('snap-001', basePrefix, mockAppConfig, [], [], [], []);
        const badManifest = { ...manifest, version: 999 };
        expect(verifyManifestRoundtrip(badManifest)).toBeNull();
    });

    it('rejects tombstones with unsafe object keys', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            [],
            [],
            [],
            [],
            undefined,
            'full',
            {
                deviceId: 'device-alpha',
                tombstones: [{
                    filename: 'deleted.png',
                    objectKey: '../outside/deleted.png',
                    sha256: 'a'.repeat(64),
                    deletedAt: 1778310000000,
                    deviceId: 'device-alpha',
                    reason: 'local-delete'
                }]
            }
        );

        expect(verifyManifestRoundtrip(manifest)).toBeNull();
    });

    it('rejects null input', () => {
        expect(verifyManifestRoundtrip(null)).toBeNull();
    });

    it('rejects array input', () => {
        expect(verifyManifestRoundtrip([])).toBeNull();
    });
});

describe('validateManifest', () => {
    it('rejects empty images array entries with missing fields', () => {
        const result = validateManifest({
            version: MANIFEST_VERSION,
            snapshotId: 's1',
            createdAt: Date.now(),
            appConfig: {},
            promptHistory: [],
            userPromptTemplates: [],
            imageHistory: [],
            images: [{ filename: 'a.png' }]
        });
        expect(result).toBeNull();
    });

    it('accepts minimal valid manifest', () => {
        const result = validateManifest({
            version: MANIFEST_VERSION,
            snapshotId: 's1',
            createdAt: Date.now(),
            appConfig: {},
            promptHistory: [],
            userPromptTemplates: [],
            imageHistory: [],
            images: []
        });
        expect(result).not.toBeNull();
    });

    it('normalizes legacy manifests without revision or deviceId', () => {
        const result = validateManifest({
            version: MANIFEST_VERSION,
            snapshotId: 'legacy-snapshot',
            createdAt: Date.now(),
            appConfig: {},
            promptHistory: [],
            userPromptTemplates: [],
            imageHistory: [],
            images: []
        });

        expect(result?.revision).toBe(DEFAULT_MANIFEST_REVISION);
        expect(result?.deviceId).toBe(DEFAULT_MANIFEST_DEVICE_ID);
        expect(result?.tombstones).toEqual([]);
    });

    it('rejects tombstones with invalid deletion metadata', () => {
        const result = validateManifest({
            version: MANIFEST_VERSION,
            snapshotId: 's1',
            createdAt: Date.now(),
            revision: 2,
            deviceId: 'device-alpha',
            appConfig: {},
            promptHistory: [],
            userPromptTemplates: [],
            imageHistory: [],
            images: [],
            tombstones: [{ filename: 'deleted.png', deletedAt: 0 }]
        });

        expect(result).toBeNull();
    });
});

describe('buildManifest syncMode', () => {
    it('includes syncMode field when provided', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            [],
            [],
            [],
            [],
            undefined,
            'metadata'
        );
        expect(manifest.syncMode).toBe('metadata');
    });

    it('omits syncMode when not provided', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            [],
            [],
            [],
            []
        );
        expect(manifest.syncMode).toBeUndefined();
    });

    it('accepts metadata-mode manifest with empty images via validateManifest', () => {
        const manifest = buildManifest(
            'snap-001',
            basePrefix,
            mockAppConfig,
            [],
            [],
            [],
            [],
            undefined,
            'metadata'
        );
        const raw = JSON.parse(JSON.stringify(manifest));
        const validated = validateManifest(raw);
        expect(validated).not.toBeNull();
        expect(validated?.images).toHaveLength(0);
    });
});

describe('createSnapshot modes', () => {
    it('metadata mode keeps lightweight data but omits image blob entries', async () => {
        const { manifest } = await createSnapshot({
            appConfig: mockAppConfig,
            promptHistory: mockPromptHistory,
            userPromptTemplates: mockTemplates,
            imageHistory: mockImageHistory,
            imageBlobs: new Map([
                ['photo-001.png', new Blob(['image-bytes'], { type: 'image/png' })]
            ]),
            basePrefix,
            mode: 'metadata'
        });

        expect(manifest.syncMode).toBe('metadata');
        expect(manifest.promptHistory).toEqual(mockPromptHistory);
        expect(manifest.userPromptTemplates).toHaveLength(1);
        expect(manifest.imageHistory).toHaveLength(1);
        expect(manifest.images).toHaveLength(0);
        expect(manifest.totalLocalImages).toBe(1);
    });
});

describe('sanitizeAppConfigForSync', () => {
    it('removes imageStoragePath and desktop-local fields', () => {
        const sanitized = sanitizeAppConfigForSync(mockAppConfig);
        expect(sanitized.imageStoragePath).toBeUndefined();
        expect(sanitized.desktopProxyMode).toBeUndefined();
        expect(sanitized.desktopProxyUrl).toBeUndefined();
        expect(sanitized.desktopDebugMode).toBeUndefined();
    });
});
