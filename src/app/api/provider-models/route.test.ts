import { POST } from './route';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/model-discovery', () => ({
    discoverOpenAICompatibleModels: vi.fn(async (request) => ({
        models: [
            {
                id: 'test-model',
                upstreamVendor: request.apiBaseUrl
            }
        ],
        refreshedAt: 123
    }))
}));

describe('POST /api/provider-models', () => {
    it('allows model discovery for private-network base URLs', async () => {
        const request = new Request('http://localhost/api/provider-models', {
            method: 'POST',
            body: JSON.stringify({
                endpoint: {
                    id: 'openai:relay',
                    protocol: 'openai-chat-completions',
                    apiBaseUrl: 'http://192.168.1.10/v1',
                    apiKey: 'secret'
                }
            })
        });

        const response = await POST(request as never);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            models: [{ id: 'test-model', upstreamVendor: 'http://192.168.1.10/v1' }]
        });
    });

    it('allows model discovery for supported video endpoint protocols', async () => {
        const request = new Request('http://localhost/api/provider-models', {
            method: 'POST',
            body: JSON.stringify({
                endpoint: {
                    id: 'openai:sora',
                    protocol: 'openai-videos',
                    apiBaseUrl: 'https://api.openai.com/v1',
                    apiKey: 'secret'
                }
            })
        });

        const response = await POST(request as never);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            models: [{ id: 'test-model', upstreamVendor: 'https://api.openai.com/v1' }]
        });
    });

    it('rejects video protocols without automatic model discovery', async () => {
        const request = new Request('http://localhost/api/provider-models', {
            method: 'POST',
            body: JSON.stringify({
                endpoint: {
                    id: 'runway:default',
                    protocol: 'runway-api-v1',
                    apiBaseUrl: 'https://api.runwayml.com',
                    apiKey: 'secret'
                }
            })
        });

        const response = await POST(request as never);
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: '该供应商暂不支持自动读取模型列表。'
        });
    });
});
