import {
    createImageTaskRunDetails,
    createVisionTextTaskRunDetails,
    sanitizeTaskRunUrl,
    summarizeProviderOptions
} from './task-run-details';
import { describe, expect, it } from 'vitest';

describe('task run details helpers', () => {
    it('strips credentials, query, and hash from endpoint URLs', () => {
        expect(sanitizeTaskRunUrl('https://user:secret@example.com/v1/images?token=hidden#fragment')).toBe(
            'https://example.com/v1/images'
        );
        expect(sanitizeTaskRunUrl('relay.example.com/v1?api_key=hidden')).toBe('relay.example.com/v1');
    });

    it('redacts sensitive custom provider option keys', () => {
        const summary = summarizeProviderOptions({
            seed: 42,
            apiKey: 'sk-hidden',
            nested: { access_token: 'secret-token', guidance: 3.5 }
        });

        expect(summary).toContain('"seed":42');
        expect(summary).toContain('"guidance":3.5');
        expect(summary).toContain('"<<redacted>>"');
        expect(summary).not.toContain('sk-hidden');
        expect(summary).not.toContain('secret-token');
    });

    it('builds image task details without exposing secrets', () => {
        const details = createImageTaskRunDetails({
            mode: 'generate',
            provider: 'openai',
            providerLabel: 'OpenAI',
            providerInstanceName: 'Relay',
            providerInstanceId: 'openai:relay',
            apiBaseUrl: 'https://user:pass@relay.example.com/v1?token=hidden',
            connectionMode: 'direct',
            model: 'gpt-image-2',
            n: 2,
            size: '1024x1024',
            quality: 'high',
            enableStreaming: true,
            partialImages: 2,
            providerOptions: { seed: 7, password: 'hidden' }
        });
        const values = details.items.map((item) => item.value || item.valueKey).join('\n');

        expect(values).toContain('Relay (openai:relay)');
        expect(values).toContain('https://relay.example.com/v1');
        expect(values).toContain('gpt-image-2');
        expect(values).toContain('tasks.details.connectionMode.direct');
        expect(values).not.toContain('user:pass');
        expect(values).not.toContain('pass@');
        expect(values).not.toContain('hidden');
    });

    it('summarizes image-to-text runtime choices', () => {
        const details = createVisionTextTaskRunDetails({
            providerKind: 'openai-compatible',
            providerLabel: 'OpenAI Compatible',
            providerProtocol: 'openai-responses',
            endpointName: 'Vision Relay',
            endpointId: 'endpoint:vision',
            apiBaseUrl: 'https://vision.example.com/v1',
            connectionMode: 'proxy',
            model: 'gpt-4.1-mini',
            taskType: 'prompt_extraction',
            detail: 'high',
            responseFormat: 'json_schema',
            streamingEnabled: true,
            structuredOutputEnabled: true,
            maxOutputTokens: 1200,
            systemPrompt: 'Describe the image.',
            imageCount: 3,
            apiCompatibility: 'responses'
        });

        expect(details.items.some((item) => item.value === 'Vision Relay (endpoint:vision)')).toBe(true);
        expect(details.items.some((item) => item.value === 'openai-responses')).toBe(true);
        expect(details.items.some((item) => item.valueKey === 'tasks.details.systemPromptConfigured')).toBe(true);
    });
});
