import {
    parseUrlParams,
    buildCleanedUrl,
    buildSecureShareUrl,
    buildShareQuery,
    buildShareUrl,
    findShareUrlInText,
    getSecureSharePayload,
    getSecureSharePasswordFromHash,
    isLikelyShareTextCandidate,
    shouldAutoStartFromUrl
} from './url-params';
import { DEFAULT_SYNC_CONFIG, encodeSyncConfigForShare, normalizeSyncConfig } from '@/lib/sync/provider-config';
import { describe, it, expect } from 'vitest';

const syncConfigFixture = normalizeSyncConfig({
    type: 's3',
    s3: {
        ...DEFAULT_SYNC_CONFIG.s3,
        endpoint: 'https://s3.example.com',
        bucket: 'images',
        accessKeyId: 'ak-share',
        secretAccessKey: 'sk-share',
        prefix: 'gpt-image-playground/v1',
        profileId: 'default'
    }
});

describe('parseUrlParams', () => {
    it('returns empty result for empty search', () => {
        const result = parseUrlParams('');
        expect(result.parsed).toEqual({});
        expect(result.consumed).toEqual({
            prompt: false,
            apiKey: false,
            apiKeyTempOnly: false,
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

    it('parses apiKey temp-only flags and aliases', () => {
        const r1 = parseUrlParams('?apiKeyTempOnly=1');
        expect(r1.parsed.apiKeyTempOnly).toBe(true);
        expect(r1.consumed.apiKeyTempOnly).toBe(true);

        const r2 = parseUrlParams('?apiKeyTemporaryOnly=false');
        expect(r2.parsed.apiKeyTempOnly).toBe(false);
        expect(r2.consumed.apiKeyTempOnly).toBe(true);
    });

    it('parses baseUrl and aliases', () => {
        const r1 = parseUrlParams('?baseurl=https://api.example.com');
        expect(r1.parsed.baseUrl).toBe('https://api.example.com');

        const r2 = parseUrlParams('?baseUrl=https://api2.example.com');
        expect(r2.parsed.baseUrl).toBe('https://api2.example.com');

        const r3 = parseUrlParams('?baseUrl=api3.example.com');
        expect(r3.parsed.baseUrl).toBe('https://api3.example.com');
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

    it('parses provider instance aliases', () => {
        const r1 = parseUrlParams('?providerInstance=openai:relay');
        expect(r1.parsed.providerInstanceId).toBe('openai:relay');
        expect(r1.consumed.providerInstanceId).toBe(true);

        const r2 = parseUrlParams('?providerInstanceId=openai:default');
        expect(r2.parsed.providerInstanceId).toBe('openai:default');

        const r3 = parseUrlParams('?instance=openai:third');
        expect(r3.parsed.providerInstanceId).toBe('openai:third');
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
        const encodedSyncConfig = encodeSyncConfigForShare(syncConfigFixture, {
            autoRestore: false,
            restoreMetadata: true,
            imageRestoreScope: 'recent',
            recentMs: 86400000
        });
        const result = parseUrlParams(
            `?prompt=test+prompt&apiKey=sk-abc&baseUrl=https://api.test&model=gpt-image-1&providerInstance=openai:relay&autostart=true&syncConfig=${encodedSyncConfig}`
        );
        expect(result.parsed).toMatchObject({
            prompt: 'test prompt',
            apiKey: 'sk-abc',
            baseUrl: 'https://api.test',
            model: 'gpt-image-1',
            providerInstanceId: 'openai:relay',
            autostart: true,
            syncConfig: {
                config: {
                    type: 's3',
                    s3: syncConfigFixture.s3
                },
                restoreOptions: {
                    autoRestore: false,
                    restoreMetadata: true,
                    imageRestoreScope: 'recent',
                    recentMs: 86400000
                }
            }
        });
        expect(result.consumed.prompt).toBe(true);
        expect(result.consumed.apiKey).toBe(true);
        expect(result.consumed.apiKeyTempOnly).toBe(false);
        expect(result.consumed.baseUrl).toBe(true);
        expect(result.consumed.model).toBe(true);
        expect(result.consumed.providerInstanceId).toBe(true);
        expect(result.consumed.autostart).toBe(true);
        expect(result.consumed.syncConfig).toBe(true);
    });

    it('consumes invalid sync config params for cleanup without applying them', () => {
        const result = parseUrlParams('?syncConfig=not-valid');

        expect(result.parsed.syncConfig).toBeUndefined();
        expect(result.consumed.syncConfig).toBe(true);
    });

    it('ignores unrelated params', () => {
        const result = parseUrlParams('?foo=bar&baz=qux');
        expect(result.parsed).toEqual({});
        expect(result.consumed).toEqual({
            prompt: false,
            apiKey: false,
            apiKeyTempOnly: false,
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

        expect(url).toBe('https://example.com/play?sdata=encrypted_payload&source=gpt-image-playground#edit');
    });

    it('builds a secure share URL with an optional decrypt password hash fragment', () => {
        const url = buildSecureShareUrl(
            'https://example.com/play?prompt=stale#edit',
            'encrypted_payload',
            'p@ss word#1'
        );

        expect(url).toBe(
            'https://example.com/play?sdata=encrypted_payload&source=gpt-image-playground#key=p%40ss+word%231'
        );
        expect(getSecureSharePasswordFromHash(new URL(url).hash)).toBe('p@ss word#1');
    });

    it('extracts only non-empty secure share passwords from hash fragments', () => {
        expect(getSecureSharePasswordFromHash('#key=abc12345')).toBe('abc12345');
        expect(getSecureSharePasswordFromHash('#key=')).toBeUndefined();
        expect(getSecureSharePasswordFromHash('#section')).toBeUndefined();
    });

    it('removes secure share payloads when marked consumed', () => {
        const cleaned = buildCleanedUrl('https://example.com/play?sdata=opaque&foo=bar#x', {
            prompt: false,
            apiKey: false,
            apiKeyTempOnly: false,
            baseUrl: false,
            model: false,
            autostart: false,
            secureShare: true
        });

        expect(cleaned).toBe('https://example.com/play?foo=bar#x');
    });

    it('removes secure share password hash when marked consumed', () => {
        const cleaned = buildCleanedUrl('https://example.com/play?sdata=opaque#key=abc12345', {
            prompt: false,
            apiKey: false,
            apiKeyTempOnly: false,
            baseUrl: false,
            model: false,
            autostart: false,
            secureShare: true,
            secureShareKey: true
        });

        expect(cleaned).toBe('https://example.com/play');
    });
});

describe('buildCleanedUrl', () => {
    const base = 'https://example.com/path';

    it('returns same URL when nothing consumed', () => {
        const url = `${base}?prompt=hello&foo=bar`;
        const cleaned = buildCleanedUrl(url, {
            prompt: false,
            apiKey: false,
            apiKeyTempOnly: false,
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
            apiKeyTempOnly: false,
            baseUrl: false,
            model: false,
            autostart: false
        });
        expect(cleaned).toBe(`${base}?foo=bar`);
    });

    it('removes all consumed params', () => {
        const url = `${base}?prompt=hi&apiKey=sk&baseUrl=https://x&model=gpt&providerInstance=openai:relay&autostart=1&syncConfig=abc&other=val`;
        const cleaned = buildCleanedUrl(url, {
            prompt: true,
            apiKey: true,
            apiKeyTempOnly: false,
            baseUrl: true,
            model: true,
            providerInstanceId: true,
            autostart: true,
            syncConfig: true
        });
        expect(cleaned).toBe(`${base}?other=val`);
    });

    it('removes all alias variants of consumed params', () => {
        const url = `${base}?apiKey=sk&apikey=other&foo=bar`;
        const cleaned = buildCleanedUrl(url, {
            prompt: false,
            apiKey: true,
            apiKeyTempOnly: false,
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
            apiKeyTempOnly: false,
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
            apiKeyTempOnly: false,
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
            apiKeyTempOnly: true,
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-image-2',
            providerInstanceId: 'openai:relay',
            autostart: true,
            syncConfig: {
                config: syncConfigFixture,
                restoreOptions: {
                    autoRestore: false,
                    restoreMetadata: true,
                    imageRestoreScope: 'none'
                }
            }
        });

        expect(query.get('prompt')).toBe('draw a cat');
        expect(query.get('apikey')).toBe('sk-share');
        expect(query.get('apiKeyTempOnly')).toBe('true');
        expect(query.get('baseurl')).toBe('https://api.example.com/v1');
        expect(query.get('model')).toBe('gpt-image-2');
        expect(query.get('providerInstance')).toBe('openai:relay');
        expect(query.get('autostart')).toBe('true');
        expect(query.get('source')).toBe('gpt-image-playground');
        expect(parseUrlParams(query).parsed.syncConfig?.config.s3).toEqual(syncConfigFixture.s3);
        expect(parseUrlParams(query).parsed.apiKeyTempOnly).toBe(true);
        expect(parseUrlParams(query).parsed.syncConfig?.restoreOptions).toEqual({
            autoRestore: false,
            restoreMetadata: true,
            imageRestoreScope: 'none'
        });
        expect(query.has('apiKey')).toBe(false);
        expect(query.has('apiKeyTempOnly')).toBe(true);
        expect(query.has('baseUrl')).toBe(false);
        expect(query.has('providerInstanceId')).toBe(false);
        expect(query.has('autoStart')).toBe(false);
    });

    it('omits empty string values but preserves explicit false autostart', () => {
        const query = buildShareQuery({
            prompt: '   ',
            apiKey: '',
            baseUrl: '',
            model: '',
            providerInstanceId: '',
            autostart: false
        });

        expect(query.has('prompt')).toBe(false);
        expect(query.has('apikey')).toBe(false);
        expect(query.has('baseurl')).toBe(false);
        expect(query.has('model')).toBe(false);
        expect(query.has('providerInstance')).toBe(false);
        expect(query.get('autostart')).toBe('false');
        expect(query.get('source')).toBe('gpt-image-playground');
    });
});

describe('buildShareUrl', () => {
    it('builds a share URL with only selected params and clears unrelated query values', () => {
        const url = buildShareUrl('https://example.com/play?old=1&prompt=stale#edit', {
            prompt: 'hello world',
            model: 'gpt-image-2'
        });

        expect(url).toBe('https://example.com/play?prompt=hello+world&model=gpt-image-2&source=gpt-image-playground#edit');
    });

    it('encodes special characters safely', () => {
        const url = buildShareUrl('https://example.com/', {
            prompt: 'cat & dog = friends #1',
            baseUrl: 'https://api.example.com/v1?tenant=a&mode=test'
        });

        const parsed = new URL(url);
        expect(parsed.searchParams.get('prompt')).toBe('cat & dog = friends #1');
        expect(parsed.searchParams.get('baseurl')).toBe('https://api.example.com/v1?tenant=a&mode=test');
        expect(parsed.searchParams.get('source')).toBe('gpt-image-playground');
    });

    it('returns the clean base URL when no params are selected', () => {
        const url = buildShareUrl('https://example.com/path?secret=old#section', {});

        expect(url).toBe('https://example.com/path#section');
    });
});

describe('findShareUrlInText', () => {
    it('detects share URLs from arbitrary origins', () => {
        const url = findShareUrlInText('配置：https://other.example/app?prompt=hello&model=gpt-image-2。');

        expect(url?.origin).toBe('https://other.example');
        expect(url?.searchParams.get('prompt')).toBe('hello');
    });

    it('detects Tauri app share URLs', () => {
        const url = findShareUrlInText('tauri://localhost/?model=gpt-image-2&source=gpt-image-playground');

        expect(url?.protocol).toBe('tauri:');
        expect(url?.searchParams.get('model')).toBe('gpt-image-2');
    });

    it('ignores ordinary links without share params', () => {
        expect(findShareUrlInText('https://example.com/docs')).toBeNull();
    });
});

describe('isLikelyShareTextCandidate', () => {
    it('only accepts text that looks like a share URL or query string', () => {
        expect(isLikelyShareTextCandidate(' ?prompt=hello')).toBe(true);
        expect(isLikelyShareTextCandidate(' https://example.com/?prompt=hello')).toBe(true);
        expect(isLikelyShareTextCandidate('plain text prompt')).toBe(false);
        expect(isLikelyShareTextCandidate('cat.jpg')).toBe(false);
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
