import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type AppConfig } from './config';
import {
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    getPolishPresetById
} from './prompt-polish-core';
import { getPromptPolishErrorMessage, polishPrompt } from './prompt-polish';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

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
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
        void args;
        return response;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function stubFetchFailure(error: Error) {
    const fetchMock = vi.fn(async (...args: [RequestInfo | URL, RequestInit?]) => {
        void args;
        throw error;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function getFetchJsonBody(fetchMock: ReturnType<typeof stubFetchResponse>): Record<string, unknown> {
    const init = fetchMock.mock.calls[0]?.[1];
    if (!isRecord(init) || typeof init.body !== 'string') {
        throw new Error('Expected fetch call with JSON string body.');
    }

    const parsed: unknown = JSON.parse(init.body);
    if (!isRecord(parsed)) {
        throw new Error('Expected fetch JSON body to be an object.');
    }

    return parsed;
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

describe('polishPrompt system prompt selection', () => {
    it('defers proxy-mode system prompt to the server for the balanced default config', async () => {
        const fetchMock = stubFetchResponse(
            new Response(JSON.stringify({ polishedPrompt: '更好的猫提示词' }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );

        await polishPrompt({
            prompt: '一只猫',
            config: createConfig({
                connectionMode: 'proxy',
                polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
                polishingPresetId: DEFAULT_POLISHING_PRESET_ID
            })
        });

        expect(getFetchJsonBody(fetchMock).systemPrompt).toBeUndefined();
    });

    it('normalizes the configured default preset before deciding proxy fallback behavior', async () => {
        const fetchMock = stubFetchResponse(
            new Response(JSON.stringify({ polishedPrompt: '更好的猫提示词' }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );

        await polishPrompt({
            prompt: '一只猫',
            config: createConfig({
                connectionMode: 'proxy',
                polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
                polishingPresetId: '  BALANCED  '
            })
        });

        expect(getFetchJsonBody(fetchMock).systemPrompt).toBeUndefined();
    });

    it('sends a selected built-in preset system prompt in proxy mode', async () => {
        const fetchMock = stubFetchResponse(
            new Response(JSON.stringify({ polishedPrompt: '电影感猫提示词' }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );
        const cinematicPreset = getPolishPresetById('cinematic');
        expect(cinematicPreset).toBeTruthy();

        await polishPrompt({
            prompt: '一只猫',
            config: createConfig({
                connectionMode: 'proxy',
                polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
                polishingPresetId: 'cinematic'
            })
        });

        expect(getFetchJsonBody(fetchMock).systemPrompt).toBe(cinematicPreset?.systemPrompt);
    });

    it('sends a one-off custom system prompt ahead of config defaults', async () => {
        const fetchMock = stubFetchResponse(
            new Response(JSON.stringify({ polishedPrompt: '临时润色结果' }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );

        await polishPrompt({
            prompt: '一只猫',
            systemPrompt: '本次临时用这个润色规则',
            config: createConfig({
                connectionMode: 'proxy',
                polishingPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
                polishingPresetId: DEFAULT_POLISHING_PRESET_ID
            })
        });

        expect(getFetchJsonBody(fetchMock).systemPrompt).toBe('本次临时用这个润色规则');
    });
});
