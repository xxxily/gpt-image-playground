import { testProviderConnection } from './provider-connection-test';
import { describe, expect, it, vi } from 'vitest';

describe('testProviderConnection', () => {
    it('rejects empty key with auth reason', async () => {
        const result = await testProviderConnection({ kind: 'openai-compatible', baseUrl: '', apiKey: '' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('auth');
    });

    it('returns ok with model count for openai-compatible 200 response', async () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }), { status: 200 })
            );
        const result = await testProviderConnection({
            kind: 'openai-compatible',
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-x'
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.modelsFound).toBe(3);
            expect(result.latencyMs).toBeGreaterThanOrEqual(0);
        }
        fetchMock.mockRestore();
    });

    it('classifies 401 as auth failure', async () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }));
        const result = await testProviderConnection({
            kind: 'openai-compatible',
            baseUrl: '',
            apiKey: 'sk-bad'
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('auth');
            expect(result.status).toBe(401);
        }
        fetchMock.mockRestore();
    });

    it('classifies aborted fetch as timeout', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
            () =>
                new Promise<Response>((_, reject) => {
                    setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 50);
                })
        );
        const result = await testProviderConnection({
            kind: 'openai-compatible',
            baseUrl: '',
            apiKey: 'sk-x',
            timeoutMs: 10
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('timeout');
        fetchMock.mockRestore();
    });

    it('classifies browser direct fetch failure as CORS blocked', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const result = await testProviderConnection({
            kind: 'openai-compatible',
            baseUrl: '',
            apiKey: 'sk-x'
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('cors');
        fetchMock.mockRestore();
    });

    it('classifies non-browser TypeError as network failure', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Network unreachable'));
        const result = await testProviderConnection({
            kind: 'openai-compatible',
            baseUrl: '',
            apiKey: 'sk-x'
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('network');
        fetchMock.mockRestore();
    });
});
