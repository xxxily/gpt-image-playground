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
});
