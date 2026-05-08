import { describe, expect, it } from 'vitest';
import {
    createProviderInstanceId,
    getDefaultProviderInstanceName,
    getProviderInstance,
    getProviderInstanceModelDefinitions,
    normalizeProviderInstances,
    resolveProviderInstanceCredentials
} from './provider-instances';

describe('provider instances', () => {
    it('uses the endpoint hostname as the default provider instance name', () => {
        expect(getDefaultProviderInstanceName('openai', 'https://api.yourpro.cc/v1')).toBe('api.yourpro.cc');
        expect(createProviderInstanceId('openai', 'https://api.yourpro.cc/v1')).toBe('openai:api-yourpro-cc');
    });

    it('normalizes legacy flat credentials into default instances', () => {
        const instances = normalizeProviderInstances(undefined, {
            openaiApiKey: 'sk-openai',
            openaiApiBaseUrl: 'https://api.openai.com/v1',
            seedreamApiKey: 'seed-key',
            seedreamApiBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
        });

        expect(getProviderInstance(instances, 'openai').apiKey).toBe('sk-openai');
        expect(getProviderInstance(instances, 'openai').name).toBe('api.openai.com');
        expect(getProviderInstance(instances, 'seedream').apiKey).toBe('seed-key');
        expect(instances.filter((instance) => instance.type === 'openai')).toHaveLength(1);
    });

    it('keeps only one default instance per provider type', () => {
        const instances = normalizeProviderInstances([
            { id: 'openai:first', type: 'openai', name: 'first', apiKey: 'one', apiBaseUrl: '', models: [], isDefault: true },
            { id: 'openai:second', type: 'openai', name: 'second', apiKey: 'two', apiBaseUrl: '', models: [], isDefault: true }
        ]);

        expect(instances.filter((instance) => instance.type === 'openai' && instance.isDefault)).toHaveLength(1);
    });

    it('resolves named instance credentials before legacy fallback', () => {
        const instances = normalizeProviderInstances([
            { id: 'openai:relay', type: 'openai', name: 'relay', apiKey: 'relay-key', apiBaseUrl: 'https://relay.example.com/v1', models: [] }
        ], { openaiApiKey: 'legacy-key', openaiApiBaseUrl: 'https://api.openai.com/v1' });

        expect(resolveProviderInstanceCredentials(instances, 'openai', 'openai:relay', { openaiApiKey: 'legacy-key' })).toMatchObject({
            apiKey: 'relay-key',
            apiBaseUrl: 'https://relay.example.com/v1',
            providerInstanceId: 'openai:relay'
        });
    });

    it('limits model definitions to the selected instance model list', () => {
        const instance = {
            id: 'openai:relay',
            type: 'openai' as const,
            name: 'relay',
            apiKey: '',
            apiBaseUrl: '',
            models: ['gpt-image-1', 'relay-custom']
        };

        const models = getProviderInstanceModelDefinitions(instance, [
            { id: 'relay-custom', provider: 'openai', instanceId: 'openai:relay' }
        ]);

        expect(models.map((model) => model.id)).toEqual(['gpt-image-1', 'relay-custom']);
    });
});
