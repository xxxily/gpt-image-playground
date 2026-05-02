import {
    parseUrlParams,
    buildCleanedUrl,
    buildSecureShareUrl,
    buildShareQuery,
    buildShareUrl,
    getSecureSharePayload,
    shouldAutoStartFromUrl
} from './url-params';
import { describe, it, expect } from 'vitest';

describe('parseUrlParams', () => {
    it('returns empty result for empty search', () => {
        const result = parseUrlParams('');
        expect(result.parsed).toEqual({});
        expect(result.consumed).toEqual({
            prompt: false,
            apiKey: false,
            baseUrl: false,
            model: false,
            autostart: false
        });
    });

    it('parses prompt param', () => {
        const result = parseUrlParams('?prompt=hello+world');
        expect(result.parsed.prompt).toBe('hello world');
        expect(result.consumed.prompt).toBe(true);
    });

    it('parses apiKey and aliases', () => {
        const r1 = parseUrlParams('?apikey=sk-123');
        expect(r1.parsed.apiKey).toBe('sk-123');

        const r2 = parseUrlParams('?apiKey=sk-456');
        expect(r2.parsed.apiKey).toBe('sk-456');
    });

    it('parses baseUrl and aliases', () => {
        const r1 = parseUrlParams('?baseurl=https://api.example.com');
        expect(r1.parsed.baseUrl).toBe('https://api.example.com');

        const r2 = parseUrlParams('?baseUrl=https://api2.example.com');
        expect(r2.parsed.baseUrl).toBe('https://api2.example.com');
    });

    it('rejects non-http baseUrl values but still marks them consumed for cleanup', () => {
        const result = parseUrlParams('?baseUrl=javascript:alert(1)');

        expect(result.parsed.baseUrl).toBeUndefined();
        expect(result.consumed.baseUrl).toBe(true);
    });

    it('accepts an empty baseUrl as an explicit session override', () => {
        const result = parseUrlParams('?baseUrl=');

        expect(result.parsed.baseUrl).toBe('');
        expect(result.consumed.baseUrl).toBe(true);
    });

    it('parses model param', () => {
        const result = parseUrlParams('?model=gpt-image-1');
        expect(result.parsed.model).toBe('gpt-image-1');
        expect(result.consumed.model).toBe(true);
    });

    it('parses autostart with truthy values', () => {
        for (const value of ['true', '1', 'yes', 'on', '']) {
            const suffix = value ? `=${value}` : '';
            const result = parseUrlParams(`?autostart${suffix}`);
            expect(result.parsed.autostart).toBe(true);
        }
    });

    it('parses autostart with falsy values', () => {
        for (const value of ['false', '0', 'no', 'off']) {
            const result = parseUrlParams(`?autostart=${value}`);
            expect(result.parsed.autostart).toBe(false);
        }
    });

    it('parses autostart aliases', () => {
        const r1 = parseUrlParams('?autoStart=1');
        expect(r1.parsed.autostart).toBe(true);

        const r2 = parseUrlParams('?auto=true');
        expect(r2.parsed.autostart).toBe(true);

        const r3 = parseUrlParams('?generate=yes');
        expect(r3.parsed.autostart).toBe(true);
    });

    it('parses all params together', () => {
        const result = parseUrlParams(
            '?prompt=test+prompt&apiKey=sk-abc&baseUrl=https://api.test&model=gpt-image-1&autostart=true'
        );
        expect(result.parsed).toEqual({
            prompt: 'test prompt',
            apiKey: 'sk-abc',
            baseUrl: 'https://api.test',
            model: 'gpt-image-1',
            autostart: true
        });
        expect(result.consumed.prompt).toBe(true);
        expect(result.consumed.apiKey).toBe(true);
        expect(result.consumed.baseUrl).toBe(true);
        expect(result.consumed.model).toBe(true);
        expect(result.consumed.autostart).toBe(true);
    });

    it('ignores unrelated params', () => {
        const result = parseUrlParams('?foo=bar&baz=qux');
        expect(result.parsed).toEqual({});
        expect(result.consumed).toEqual({
            prompt: false,
            apiKey: false,
            baseUrl: false,
            model: false,
            autostart: false
        });
    });

    it('accepts URLSearchParams instance', () => {
        const params = new URLSearchParams('prompt=hello&autostart=1');
        const result = parseUrlParams(params);
        expect(result.parsed.prompt).toBe('hello');
        expect(result.parsed.autostart).toBe(true);
    });
});

describe('secure share URL helpers', () => {
    it('detects the secure share payload without parsing it as plaintext params', () => {
        const result = parseUrlParams('?sdata=opaque&prompt=plain');

        expect(getSecureSharePayload('?sdata=opaque&prompt=plain')).toBe('opaque');
        expect(result.parsed.prompt).toBe('plain');
        expect(result.consumed.secureShare).toBeUndefined();
    });

    it('builds an opaque secure share URL and clears unrelated query values', () => {
        const url = buildSecureShareUrl('https://example.com/play?prompt=stale&apikey=old#edit', 'encrypted_payload');

        expect(url).toBe('https://example.com/play?sdata=encrypted_payload#edit');
    });

    it('removes secure share payloads when marked consumed', () => {
        const cleaned = buildCleanedUrl('https://example.com/play?sdata=opaque&foo=bar#x', {
            prompt: false,
            apiKey: false,
            baseUrl: false,
            model: false,
            autostart: false,
            secureShare: true
        });

        expect(cleaned).toBe('https://example.com/play?foo=bar#x');
    });
});

describe('buildCleanedUrl', () => {
    const base = 'https://example.com/path';

    it('returns same URL when nothing consumed', () => {
        const url = `${base}?prompt=hello&foo=bar`;
        const cleaned = buildCleanedUrl(url, {
            prompt: false,
            apiKey: false,
            baseUrl: false,
            model: false,
            autostart: false
        });
        expect(cleaned).toBe(url);
    });

    it('removes consumed prompt param', () => {
        const cleaned = buildCleanedUrl(`${base}?prompt=hello&foo=bar`, {
            prompt: true,
            apiKey: false,
            baseUrl: false,
            model: false,
            autostart: false
        });
        expect(cleaned).toBe(`${base}?foo=bar`);
    });

    it('removes all consumed params', () => {
        const url = `${base}?prompt=hi&apiKey=sk&baseUrl=https://x&model=gpt&autostart=1&other=val`;
        const cleaned = buildCleanedUrl(url, {
            prompt: true,
            apiKey: true,
            baseUrl: true,
            model: true,
            autostart: true
        });
        expect(cleaned).toBe(`${base}?other=val`);
    });

    it('removes all alias variants of consumed params', () => {
        const url = `${base}?apiKey=sk&apikey=other&foo=bar`;
        const cleaned = buildCleanedUrl(url, {
            prompt: false,
            apiKey: true,
            baseUrl: false,
            model: false,
            autostart: false
        });
        expect(cleaned).toBe(`${base}?foo=bar`);
    });

    it('preserves path and hash', () => {
        const url = `${base}?prompt=hello&foo=bar#section`;
        const cleaned = buildCleanedUrl(url, {
            prompt: true,
            apiKey: false,
            baseUrl: false,
            model: false,
            autostart: false
        });
        expect(cleaned.startsWith(`${base}?`)).toBe(true);
        expect(cleaned.includes('#section')).toBe(true);
        expect(cleaned).not.toContain('prompt=');
        expect(cleaned).toContain('foo=bar');
    });

    it('returns empty search when all params consumed and none remain', () => {
        const url = `${base}?prompt=hello`;
        const cleaned = buildCleanedUrl(url, {
            prompt: true,
            apiKey: false,
            baseUrl: false,
            model: false,
            autostart: false
        });
        expect(cleaned).toBe(`${base}`);
    });
});

describe('buildShareQuery', () => {
    it('uses canonical share parameter keys', () => {
        const query = buildShareQuery({
            prompt: 'draw a cat',
            apiKey: 'sk-share',
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-image-2',
            autostart: true
        });

        expect(query.get('prompt')).toBe('draw a cat');
        expect(query.get('apikey')).toBe('sk-share');
        expect(query.get('baseurl')).toBe('https://api.example.com/v1');
        expect(query.get('model')).toBe('gpt-image-2');
        expect(query.get('autostart')).toBe('true');
        expect(query.has('apiKey')).toBe(false);
        expect(query.has('baseUrl')).toBe(false);
        expect(query.has('autoStart')).toBe(false);
    });

    it('omits empty string values but preserves explicit false autostart', () => {
        const query = buildShareQuery({
            prompt: '   ',
            apiKey: '',
            baseUrl: '',
            model: '',
            autostart: false
        });

        expect(query.has('prompt')).toBe(false);
        expect(query.has('apikey')).toBe(false);
        expect(query.has('baseurl')).toBe(false);
        expect(query.has('model')).toBe(false);
        expect(query.get('autostart')).toBe('false');
    });
});

describe('buildShareUrl', () => {
    it('builds a share URL with only selected params and clears unrelated query values', () => {
        const url = buildShareUrl('https://example.com/play?old=1&prompt=stale#edit', {
            prompt: 'hello world',
            model: 'gpt-image-2'
        });

        expect(url).toBe('https://example.com/play?prompt=hello+world&model=gpt-image-2#edit');
    });

    it('encodes special characters safely', () => {
        const url = buildShareUrl('https://example.com/', {
            prompt: 'cat & dog = friends #1',
            baseUrl: 'https://api.example.com/v1?tenant=a&mode=test'
        });

        const parsed = new URL(url);
        expect(parsed.searchParams.get('prompt')).toBe('cat & dog = friends #1');
        expect(parsed.searchParams.get('baseurl')).toBe('https://api.example.com/v1?tenant=a&mode=test');
    });

    it('returns the clean base URL when no params are selected', () => {
        const url = buildShareUrl('https://example.com/path?secret=old#section', {});

        expect(url).toBe('https://example.com/path#section');
    });
});

describe('shouldAutoStartFromUrl', () => {
    it('requires a true autostart flag and non-empty prompt', () => {
        expect(shouldAutoStartFromUrl({ prompt: 'draw a cat', autostart: true })).toBe(true);
        expect(shouldAutoStartFromUrl({ prompt: '   ', autostart: true })).toBe(false);
        expect(shouldAutoStartFromUrl({ prompt: 'draw a cat', autostart: false })).toBe(false);
        expect(shouldAutoStartFromUrl({ autostart: true })).toBe(false);
    });
});
