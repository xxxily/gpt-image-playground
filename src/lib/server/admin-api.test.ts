import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminApiError, assertAdminMutationOrigin } from './admin-api';

const originalAuthBaseUrl = process.env.AUTH_BASE_URL;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

function restoreEnv(key: 'AUTH_BASE_URL' | 'NEXT_PUBLIC_SITE_URL' | 'NEXT_PUBLIC_APP_URL', value: string | undefined): void {
    if (value === undefined) {
        delete process.env[key];
        return;
    }
    process.env[key] = value;
}

function clearConfiguredOrigins(): void {
    delete process.env.AUTH_BASE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
}

function makeAdminPostRequest(url: string, headers: Record<string, string>): NextRequest {
    return new NextRequest(url, {
        method: 'POST',
        headers
    });
}

describe('assertAdminMutationOrigin', () => {
    afterEach(() => {
        restoreEnv('AUTH_BASE_URL', originalAuthBaseUrl);
        restoreEnv('NEXT_PUBLIC_SITE_URL', originalSiteUrl);
        restoreEnv('NEXT_PUBLIC_APP_URL', originalAppUrl);
    });

    it('allows a same-origin mutation', () => {
        clearConfiguredOrigins();
        const request = makeAdminPostRequest('http://localhost:3000/api/admin/bootstrap', {
            origin: 'http://localhost:3000'
        });

        expect(() => assertAdminMutationOrigin(request)).not.toThrow();
    });

    it('allows the configured public origin when Next sees the internal proxy URL', () => {
        clearConfiguredOrigins();
        process.env.AUTH_BASE_URL = 'https://img-playground.anzz.site';
        const request = makeAdminPostRequest('http://127.0.0.1:3000/api/admin/bootstrap', {
            origin: 'https://img-playground.anzz.site'
        });

        expect(() => assertAdminMutationOrigin(request)).not.toThrow();
    });

    it('allows the forwarded public origin from a reverse proxy', () => {
        clearConfiguredOrigins();
        const request = makeAdminPostRequest('http://127.0.0.1:3000/api/admin/bootstrap', {
            host: '127.0.0.1:3000',
            origin: 'https://img-playground.anzz.site',
            'x-forwarded-host': 'img-playground.anzz.site',
            'x-forwarded-proto': 'https'
        });

        expect(() => assertAdminMutationOrigin(request)).not.toThrow();
    });

    it('rejects a mismatched origin', () => {
        clearConfiguredOrigins();
        process.env.AUTH_BASE_URL = 'https://img-playground.anzz.site';
        const request = makeAdminPostRequest('http://127.0.0.1:3000/api/admin/bootstrap', {
            origin: 'https://evil.example'
        });

        expect(() => assertAdminMutationOrigin(request)).toThrow(AdminApiError);
    });

    it('rejects cross-site fetch metadata even when the origin is configured', () => {
        clearConfiguredOrigins();
        process.env.AUTH_BASE_URL = 'https://img-playground.anzz.site';
        const request = makeAdminPostRequest('http://127.0.0.1:3000/api/admin/bootstrap', {
            origin: 'https://img-playground.anzz.site',
            'sec-fetch-site': 'cross-site'
        });

        expect(() => assertAdminMutationOrigin(request)).toThrow(AdminApiError);
    });
});
