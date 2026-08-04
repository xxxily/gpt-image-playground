import { DEFAULT_CONFIG } from './config';
import { DEFAULT_SHOWCASE_CATALOG } from './default-showcases';
import { DEFAULT_IMAGE_FORM_PREFERENCES } from './form-preferences';
import { getShowcaseTopicAvailability } from './showcase-availability';
import { describe, expect, it } from 'vitest';

const topic = DEFAULT_SHOWCASE_CATALOG.topics.find((item) => item.id === 'old-photo-restoration')!;

describe('showcase topic availability', () => {
    it('requires a configured compatible model when no credential is available', () => {
        expect(
            getShowcaseTopicAvailability(
                DEFAULT_SHOWCASE_CATALOG,
                topic,
                DEFAULT_CONFIG,
                DEFAULT_IMAGE_FORM_PREFERENCES
            )
        ).toBe('needs-compatible-model');
    });

    it('is ready when the current compatible provider has a credential', () => {
        const config = {
            ...DEFAULT_CONFIG,
            openaiApiKey: 'configured-for-test',
            providerInstances: DEFAULT_CONFIG.providerInstances.map((instance) =>
                instance.type === 'openai' ? { ...instance, apiKey: 'configured-for-test' } : instance
            )
        };
        expect(
            getShowcaseTopicAvailability(
                DEFAULT_SHOWCASE_CATALOG,
                topic,
                config,
                DEFAULT_IMAGE_FORM_PREFERENCES
            )
        ).toBe('ready');
    });

    it('uses the provider instance selected in the current form preferences', () => {
        const config = {
            ...DEFAULT_CONFIG,
            providerInstances: DEFAULT_CONFIG.providerInstances.map((instance) =>
                instance.type === 'openai'
                    ? { ...instance, apiKey: '' }
                    : instance
            ).concat({
                id: 'openai:team',
                type: 'openai' as const,
                name: 'Team endpoint',
                apiKey: 'configured-for-test',
                apiBaseUrl: 'https://api.example.com/v1',
                models: []
            })
        };
        expect(
            getShowcaseTopicAvailability(DEFAULT_SHOWCASE_CATALOG, topic, config, {
                ...DEFAULT_IMAGE_FORM_PREFERENCES,
                providerInstanceId: 'openai:team'
            })
        ).toBe('ready');
    });

    it('detects a configured compatible instance even when it is not currently selected', () => {
        const config = {
            ...DEFAULT_CONFIG,
            providerInstances: DEFAULT_CONFIG.providerInstances.concat({
                id: 'openai:team',
                type: 'openai' as const,
                name: 'Team endpoint',
                apiKey: 'configured-for-test',
                apiBaseUrl: 'https://api.example.com/v1',
                models: []
            })
        };
        expect(
            getShowcaseTopicAvailability(
                DEFAULT_SHOWCASE_CATALOG,
                topic,
                config,
                DEFAULT_IMAGE_FORM_PREFERENCES
            )
        ).toBe('compatible-unconfigured');
    });
});
