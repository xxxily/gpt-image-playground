import { GET, OPTIONS } from './route';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { etagForShowcaseCatalog, getPublicShowcaseCatalog, toPublicShowcaseWireCatalog } = vi.hoisted(() => ({
    etagForShowcaseCatalog: vi.fn(() => '"showcase-etag"'),
    getPublicShowcaseCatalog: vi.fn(),
    toPublicShowcaseWireCatalog: vi.fn((catalog: unknown) => catalog)
}));

vi.mock('@/lib/server/showcase/public', () => ({
    etagForShowcaseCatalog,
    getPublicShowcaseCatalog,
    toPublicShowcaseWireCatalog
}));

describe('GET /api/showcases', () => {
    beforeEach(() => {
        getPublicShowcaseCatalog.mockReset();
        delete process.env.SHOWCASE_PUBLIC_ALLOWED_ORIGINS;
    });

    it('returns a wrapped catalog with ETag and honors If-None-Match', async () => {
        getPublicShowcaseCatalog.mockResolvedValue({
            catalog: { catalogRevision: 'published-1' },
            source: 'published',
            etag: '"showcase-etag"'
        });

        const response = await GET(new NextRequest('https://app.example/api/showcases'));
        const notModified = await GET(
            new NextRequest('https://app.example/api/showcases', {
                headers: { 'if-none-match': '"showcase-etag"' }
            })
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('etag')).toBe('"showcase-etag"');
        expect(toPublicShowcaseWireCatalog).toHaveBeenCalledWith(
            { catalogRevision: 'published-1' },
            'https://app.example',
            { supportsExtendedCases: false }
        );
        await expect(response.json()).resolves.toEqual({
            catalog: { catalogRevision: 'published-1' },
            source: 'published'
        });
        expect(notModified.status).toBe(304);

        await GET(
            new NextRequest('https://app.example/api/showcases', {
                headers: { 'x-showcase-client-version': '2' }
            })
        );
        expect(toPublicShowcaseWireCatalog).toHaveBeenLastCalledWith(
            { catalogRevision: 'published-1' },
            'https://app.example',
            { supportsExtendedCases: true }
        );
    });

    it('exposes cross-origin GET only to configured origins', async () => {
        process.env.SHOWCASE_PUBLIC_ALLOWED_ORIGINS = 'https://desktop.example';
        const allowed = await OPTIONS(
            new NextRequest('https://content.example/api/showcases', {
                method: 'OPTIONS',
                headers: { origin: 'https://desktop.example' }
            })
        );
        const denied = await OPTIONS(
            new NextRequest('https://content.example/api/showcases', {
                method: 'OPTIONS',
                headers: { origin: 'https://evil.example' }
            })
        );

        expect(allowed.status).toBe(204);
        expect(allowed.headers.get('access-control-allow-origin')).toBe('https://desktop.example');
        expect(allowed.headers.get('access-control-allow-headers')).toContain('X-Showcase-Client-Version');
        expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    });
});
