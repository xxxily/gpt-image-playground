import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type AppConfig } from './config';
import { getPromptPolishErrorMessage, polishPrompt } from './prompt-polish';

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
    return {
        ...DEFAULT_CONFIG,
        polishingApiKey: 'test-polishing-key',
        polishingApiBaseUrl: 'https://relay.example.com/v1',
        polishingModelId: 'test-polish-model',
        polishingPrompt: 'Polish image prompts.',
        ...overrides
    };
}

function stubFetchResponse(response: Response) {
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function stubFetchFailure(error: Error) {
    const fetchMock = vi.fn(async () => {
        throw error;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('polishPrompt error feedback', () => {
    it('surfaces proxy-mode 401 nested provider errors', async () => {
        stubFetchResponse(
            new Response(
                JSON.stringify({
                    error: {
                        code: '',
                        message: '无效的令牌 (request id: 202605030704468408677708268d9d62zMKwByP)',
                        type: 'new_api_error'
                    }
                }),
                {
                    status: 401,
                    statusText: 'Unauthorized',
                    headers: { 'content-type': 'application/json; charset=utf-8' }
                }
            )
        );

        await expect(
            polishPrompt({
                prompt: '一只猫',
                config: createConfig({ connectionMode: 'proxy' })
            })
        ).rejects.toThrow(/无效的令牌/);
    });

    it('surfaces direct-mode 404 invalid URL JSON errors', async () => {
        stubFetchResponse(
            new Response(
                JSON.stringify({
                    error: {
                        message: 'Invalid URL (POST /v122222/v1/chat/completions)',
                        type: 'invalid_request_error',
                        param: '',
                        code: ''
                    }
                }),
                {
                    status: 404,
                    headers: { 'content-type': 'application/json' }
                }
            )
        );

        await expect(
            polishPrompt({
                prompt: '一只猫',
                config: createConfig({
                    connectionMode: 'direct',
                    polishingApiBaseUrl: 'https://relay.example.com/v122222/v1'
                })
            })
        ).rejects.toThrow(/Invalid URL \(POST \/v122222\/v1\/chat\/completions\)/);
    });

    it('wraps direct-mode network failures with a user-facing CORS hint', async () => {
        stubFetchFailure(new TypeError('Failed to fetch'));

        await expect(
            polishPrompt({
                prompt: '一只猫',
                config: createConfig({ connectionMode: 'direct' })
            })
        ).rejects.toThrow(/直连模式润色失败：目标地址可能不支持 CORS/);
    });

    it('formats blank Error instances with nested API payloads for UI alerts', () => {
        const error = Object.assign(new Error(''), {
            error: {
                code: '',
                message: '无效的令牌 (request id: abc)',
                type: 'new_api_error'
            }
        });

        expect(getPromptPolishErrorMessage(error)).toBe('无效的令牌 (request id: abc) (type: new_api_error)');
    });

    it('never returns a blank UI alert message', () => {
        expect(getPromptPolishErrorMessage(new Error(''))).toBe('提示词润色失败，请稍后重试。');
        expect(getPromptPolishErrorMessage('   ')).toBe('提示词润色失败，请稍后重试。');
    });
});
