import { describe, expect, it } from 'vitest';
import { getForwardedRequestOrigin, getHeadersPublicOrigin, getRequestPublicOrigin, parseConfiguredOrigins } from './request-origin';

describe('server request origin helpers', () => {
    it('prefers forwarded host and proto over the internal request URL', () => {
        const request = new Request('http://127.0.0.1:3000/api/share/short-links', {
            headers: {
                host: '127.0.0.1:3000',
                'x-forwarded-host': 'i.anzz.site',
                'x-forwarded-proto': 'https'
            }
        });

        expect(getRequestPublicOrigin(request)).toBe('https://i.anzz.site');
    });

    it('does not inherit an internal http protocol for a public host without x-forwarded-proto', () => {
        const origin = getForwardedRequestOrigin(
            new Headers({
                host: '127.0.0.1:3000',
                'x-forwarded-host': 'i.anzz.site'
            }),
            'http://127.0.0.1:3000/api/admin/login'
        );

        expect(origin).toBe('https://i.anzz.site');
    });

    it('uses host headers before origin headers when deriving auth origin from server component headers', () => {
        const headers = new Headers({
            host: 'i.anzz.site',
            origin: 'https://img-playground.anzz.site'
        });

        expect(getHeadersPublicOrigin(headers)).toBe('https://i.anzz.site');
    });

    it('parses comma or whitespace separated configured origins', () => {
        expect(parseConfiguredOrigins(['https://img-playground.anzz.site, https://i.anzz.site  docs.example'])).toEqual([
            'https://img-playground.anzz.site',
            'https://i.anzz.site',
            'https://docs.example'
        ]);
    });
});
