import {
    normalizeManagedTaskBaseUrl,
    resolveManagedTaskExecution,
    type ManagedTaskServiceConfig,
    type ManagedTaskPolicyMatch,
    type ManagedTaskTakeoverPolicy
} from '@/lib/managed-task-config';
import type { ModelCatalogEntry, ProviderEndpoint } from '@/lib/provider-model-catalog';
import { describe, expect, it } from 'vitest';

type PolicyOverrides = Omit<Partial<ManagedTaskTakeoverPolicy>, 'match'> & {
    match?: Partial<ManagedTaskPolicyMatch>;
};

function createService(overrides: Partial<ManagedTaskServiceConfig> = {}): ManagedTaskServiceConfig {
    return {
        id: overrides.id ?? 'svc-default',
        name: overrides.name ?? 'Default task service',
        baseUrl: overrides.baseUrl ?? 'https://tasks.example.test',
        enabled: overrides.enabled ?? true,
        authMode: overrides.authMode ?? 'none',
        authTokenConfigured: overrides.authTokenConfigured ?? false,
        healthCheckEnabled: overrides.healthCheckEnabled ?? true,
        healthCheckIntervalSeconds: overrides.healthCheckIntervalSeconds ?? 60,
        healthStatus: overrides.healthStatus ?? 'ok',
        ...overrides
    };
}

function createPolicy(overrides: PolicyOverrides = {}): ManagedTaskTakeoverPolicy {
    const { match, limits, ...rest } = overrides;
    return {
        id: overrides.id ?? 'policy-default',
        name: overrides.name ?? 'Default takeover',
        enabled: overrides.enabled ?? true,
        priority: overrides.priority ?? 0,
        match: {
            providerEndpointIds: [],
            normalizedBaseUrls: [],
            providerKinds: [],
            providerProtocols: [],
            modelCatalogEntryIds: [],
            taskCapabilities: ['image.generate', 'image.edit'],
            ...match
        },
        mode: overrides.mode ?? 'managed-task',
        taskServiceId: overrides.taskServiceId ?? 'svc-default',
        fallbackMode: overrides.fallbackMode ?? 'fail-closed',
        limits,
        ...rest
    };
}

const endpoint: Pick<ProviderEndpoint, 'id' | 'apiBaseUrl' | 'provider' | 'protocol'> = {
    id: 'endpoint-openai',
    apiBaseUrl: 'https://api.openai.example/v1/',
    provider: 'openai-compatible',
    protocol: 'openai-images'
};

const model: Pick<
    ModelCatalogEntry,
    'id' | 'rawModelId' | 'providerEndpointId' | 'provider' | 'protocol' | 'capabilities'
> = {
    id: 'model-image',
    rawModelId: 'gpt-image-test',
    providerEndpointId: 'endpoint-openai',
    provider: 'openai-compatible',
    protocol: 'openai-images',
    capabilities: {
        tasks: ['image.generate', 'image.edit'],
        inputModalities: ['text', 'image'],
        outputModalities: ['image']
    }
};

describe('managed task resolver', () => {
    it('normalizes endpoint base URLs for policy matching', () => {
        expect(normalizeManagedTaskBaseUrl('API.EXAMPLE.TEST/v1///')).toBe('https://api.example.test/v1');
        expect(normalizeManagedTaskBaseUrl('https://User:Secret@API.EXAMPLE.TEST/v1?x=1#hash')).toBe(
            'https://api.example.test/v1'
        );
    });

    it('keeps existing execution mode when no policy matches or the task capability is unsupported', () => {
        expect(
            resolveManagedTaskExecution({
                services: [createService()],
                policies: [],
                providerEndpoint: endpoint,
                model,
                taskCapability: 'image.generate',
                defaultMode: 'proxy'
            })
        ).toMatchObject({ mode: 'proxy', reason: 'policy_not_matched' });

        expect(
            resolveManagedTaskExecution({
                services: [createService()],
                policies: [createPolicy()],
                providerEndpoint: endpoint,
                model,
                taskCapability: 'vision.text',
                defaultMode: 'direct'
            })
        ).toMatchObject({ mode: 'direct', reason: 'unsupported_task_capability' });
    });

    it('prefers the most specific matching policy before priority', () => {
        const genericService = createService({ id: 'svc-generic', name: 'Generic service' });
        const modelService = createService({ id: 'svc-model', name: 'Model service' });
        const result = resolveManagedTaskExecution({
            services: [genericService, modelService],
            policies: [
                createPolicy({
                    id: 'generic',
                    name: 'Generic provider',
                    priority: 1000,
                    taskServiceId: 'svc-generic',
                    match: { providerKinds: ['openai-compatible'], taskCapabilities: ['image.generate'] }
                }),
                createPolicy({
                    id: 'model',
                    name: 'Specific model',
                    priority: 0,
                    taskServiceId: 'svc-model',
                    match: { modelCatalogEntryIds: ['model-image'], taskCapabilities: ['image.generate'] }
                })
            ],
            providerEndpoint: endpoint,
            model,
            taskCapability: 'image.generate',
            defaultMode: 'direct'
        });

        expect(result).toMatchObject({
            mode: 'managed-task',
            reason: 'policy_mode_managed_task',
            policyId: 'model',
            taskServiceId: 'svc-model'
        });
    });

    it('applies explicit fallback modes when the chosen task service is unavailable', () => {
        const result = resolveManagedTaskExecution({
            services: [createService({ id: 'svc-unavailable', healthStatus: 'unavailable' })],
            policies: [
                createPolicy({
                    id: 'fallback-policy',
                    taskServiceId: 'svc-unavailable',
                    fallbackMode: 'ask-user',
                    match: { normalizedBaseUrls: ['https://api.openai.example/v1'] }
                })
            ],
            providerEndpoint: endpoint,
            model,
            taskCapability: 'image.edit',
            defaultMode: 'proxy'
        });

        expect(result).toMatchObject({
            mode: 'ask-user',
            reason: 'task_service_unavailable',
            policyId: 'fallback-policy',
            taskServiceId: 'svc-unavailable'
        });
    });
});
