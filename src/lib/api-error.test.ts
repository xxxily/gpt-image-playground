import { describe, expect, it } from 'vitest';
import { formatApiError, getApiResponseErrorMessage, readApiResponseBody } from './api-error';

describe('formatApiError', () => {
    it('extracts nested provider error messages and metadata', () => {
        const message = formatApiError({
            error: {
                code: '',
                message: '无效的令牌 (request id: 202605030627252366339418268d9d6619Nyp2r)',
                type: 'new_api_error'
            }
        });

        expect(message).toContain('无效的令牌 (request id: 202605030627252366339418268d9d6619Nyp2r)');
        expect(message).toContain('type: new_api_error');
        expect(message).not.toContain('code:');
    });

    it('extracts nested errors from common response wrapper fields', () => {
        expect(
            formatApiError({
                response: {
                    data: {
                        error: {
                            message: 'API key expired',
                            type: 'authentication_error'
                        }
                    }
                }
            })
        ).toContain('API key expired');
    });

    it('uses the first useful message from errors arrays', () => {
        expect(formatApiError({ errors: [{ detail: '' }, { detail: '额度不足，请稍后重试。' }] })).toBe('额度不足，请稍后重试。');
    });

    it('never returns a blank message when payload fields are empty', () => {
        expect(formatApiError({ error: { message: '', detail: '' } }, '提示词润色失败，请稍后重试。')).toBe(
            '提示词润色失败，请稍后重试。'
        );
    });
});

describe('readApiResponseBody', () => {
    it('parses JSON error payloads even when content-type is missing', async () => {
        const response = new Response('{"error":{"message":"无效的令牌","type":"new_api_error"}}', { status: 401 });

        await expect(readApiResponseBody(response)).resolves.toEqual({
            error: {
                message: '无效的令牌',
                type: 'new_api_error'
            }
        });
    });

    it('returns malformed JSON as text instead of swallowing the body', async () => {
        const response = new Response('{"error":', {
            status: 502,
            headers: { 'content-type': 'application/json' }
        });

        await expect(readApiResponseBody(response)).resolves.toBe('{"error":');
    });

    it('returns an empty object for empty bodies', async () => {
        const response = new Response('', { status: 500 });

        await expect(readApiResponseBody(response)).resolves.toEqual({});
    });
});

describe('getApiResponseErrorMessage', () => {
    it('formats nested JSON API errors into user-facing text', async () => {
        const response = new Response(
            JSON.stringify({
                error: {
                    code: '',
                    message: '无效的令牌 (request id: abc)',
                    type: 'new_api_error'
                }
            }),
            {
                status: 401,
                headers: { 'content-type': 'application/json' }
            }
        );

        const message = await getApiResponseErrorMessage(response, '提示词润色失败');

        expect(message).toContain('无效的令牌 (request id: abc)');
        expect(message).toContain('type: new_api_error');
    });

    it('uses readable plain text or HTML error bodies before fallback text', async () => {
        const response = new Response('<html><body><h1>502 Bad Gateway</h1><script>ignored()</script></body></html>', {
            status: 502,
            headers: { 'content-type': 'text/html' }
        });

        await expect(getApiResponseErrorMessage(response, '提示词润色失败')).resolves.toBe('502 Bad Gateway');
    });

    it('falls back to response status text or caller fallback for empty bodies', async () => {
        const withStatusText = new Response('', { status: 429, statusText: 'Too Many Requests' });
        const withoutStatusText = new Response('', { status: 500 });

        await expect(getApiResponseErrorMessage(withStatusText, '提示词润色失败')).resolves.toBe('Too Many Requests');
        await expect(getApiResponseErrorMessage(withoutStatusText, '提示词润色失败')).resolves.toBe('提示词润色失败');
    });
});
