import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerLogger, getServerLogLevel, redactLogString, redactLogValue } from './server-logger';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
});

describe('server logger redaction', () => {
    it('redacts prompt fields and common secret fields by key', () => {
        expect(
            redactLogValue({
                prompt: 'draw a private family photo',
                openaiApiKey: 'sk-private-secret',
                nested: {
                    secretAccessKey: 's3-private-secret'
                }
            })
        ).toEqual({
            prompt: '[redacted-prompt]',
            openaiApiKey: '[redacted-secret]',
            nested: {
                secretAccessKey: '[redacted-secret]'
            }
        });
    });

    it('redacts sensitive strings without removing operational context', () => {
        const redacted = redactLogString(
            'Authorization: Bearer sk-secret-token file=/Users/blaze/work/app/generated-images/a.png url=https://example.com/share?apiKey=sk-abc&prompt=hello&mode=edit'
        );

        expect(redacted).toContain('Authorization: Bearer [redacted-secret]');
        expect(redacted).toContain('file=[redacted-path]');
        expect(redacted).toContain('apiKey=[redacted-secret]');
        expect(redacted).toContain('prompt=[redacted-secret]');
        expect(redacted).not.toContain('/Users/blaze');
        expect(redacted).not.toContain('sk-secret-token');
        expect(redacted).not.toContain('hello');
    });

    it('redacts error messages before logging', () => {
        const error = new Error('Provider failed for /tmp/private-output.png with sk-secret-token');

        expect(redactLogValue(error)).toEqual({
            name: 'Error',
            message: 'Provider failed for [redacted-path] with [redacted-secret]',
            code: undefined,
            status: undefined
        });
    });

    it('keeps debug logs disabled in production unless explicitly enabled', () => {
        vi.stubEnv('NODE_ENV', 'production');
        delete process.env.SERVER_LOG_LEVEL;
        delete process.env.SERVER_DEBUG_LOGS;

        expect(getServerLogLevel()).toBe('warn');

        process.env.SERVER_DEBUG_LOGS = 'true';
        expect(getServerLogLevel()).toBe('debug');
    });

    it('emits structured redacted payloads', () => {
        process.env.SERVER_LOG_LEVEL = 'info';
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        createServerLogger('test.scope').info('request complete', {
            prompt: 'private prompt',
            outputPath: '/Users/blaze/work/app/generated-images/out.png',
            url: 'https://example.com/?apiKey=sk-private-token'
        });

        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy.mock.calls[0]?.[0]).toEqual({
            level: 'info',
            scope: 'test.scope',
            event: 'request complete',
            details: {
                prompt: '[redacted-prompt]',
                outputPath: '[redacted-path]',
                url: 'https://example.com/?apiKey=[redacted-secret]'
            }
        });
    });
});
