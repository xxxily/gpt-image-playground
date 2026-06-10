import { ManagedGenerationTaskRequest } from './types.js';

export function sampleTaskRequest(overrides: Partial<ManagedGenerationTaskRequest> = {}): ManagedGenerationTaskRequest {
    return {
        idempotencyKey: 'idem-1',
        taskType: 'image.generate',
        providerEndpointRef: {
            id: 'endpoint-openai-compatible',
            provider: 'openai-compatible',
            protocol: 'openai-images',
            baseUrl: 'https://gateway.example.com/v1',
            baseUrlFingerprint: 'fp_gateway_example'
        },
        executionCredential: {
            mode: 'user-delegated',
            keyEnvelope: 'sealed-test-key',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            fingerprint: 'key_fp_test',
            algorithm: 'sealed-box-v1'
        },
        model: {
            catalogEntryId: 'model-catalog-entry',
            rawModelId: 'gpt-image-1'
        },
        prompt: 'Draw a compact phase one mock image.',
        parameters: {
            mock: {
                delayMs: 1,
                providerDelayMs: 1,
                downloadDelayMs: 1
            }
        },
        inputAssets: [],
        clientContext: {
            appInstanceId: 'app-test',
            clientTaskId: 'client-task-test',
            source: 'web',
            locale: 'zh-CN'
        },
        ...overrides
    };
}
