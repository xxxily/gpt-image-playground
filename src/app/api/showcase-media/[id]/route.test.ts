import { GET } from './route';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getShowcaseManagedAsset, getShowcaseManagedAssetFilePath, isShowcaseManagedAssetPublic, readFile } = vi.hoisted(
    () => ({
        getShowcaseManagedAsset: vi.fn(),
        getShowcaseManagedAssetFilePath: vi.fn(() => '/tmp/media.webp'),
        isShowcaseManagedAssetPublic: vi.fn(),
        readFile: vi.fn()
    })
);

vi.mock('@/lib/server/showcase/media', () => ({
    getShowcaseManagedAsset,
    getShowcaseManagedAssetFilePath,
    isShowcaseManagedAssetPublic
}));
vi.mock('node:fs/promises', () => ({ default: { readFile } }));

const asset = {
    id: 'media_0123456789abcdef0123456789abcdef',
    checksum: 'checksum',
    storageKey: 'asset.webp',
    thumbnailStorageKey: 'asset.thumbnail.webp'
};

describe('GET /api/showcase-media/[id]', () => {
    beforeEach(() => {
        getShowcaseManagedAsset.mockReset();
        getShowcaseManagedAsset.mockResolvedValue(asset);
        getShowcaseManagedAssetFilePath.mockClear();
        isShowcaseManagedAssetPublic.mockReset();
        readFile.mockReset();
        readFile.mockResolvedValue(Buffer.from('webp-image'));
    });

    it('serves published media with immutable headers and honors ETag', async () => {
        isShowcaseManagedAssetPublic.mockResolvedValue(true);
        const request = new NextRequest(`https://content.example/api/showcase-media/${asset.id}`);
        const response = await GET(request, { params: Promise.resolve({ id: asset.id }) });
        const notModified = await GET(
            new NextRequest(`https://content.example/api/showcase-media/${asset.id}`, {
                headers: { 'if-none-match': '"checksum"' }
            }),
            { params: Promise.resolve({ id: asset.id }) }
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('image/webp');
        expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(notModified.status).toBe(304);
    });

    it('uses the thumbnail variant and hides unpublished media without an admin session', async () => {
        isShowcaseManagedAssetPublic.mockResolvedValue(true);
        const thumbnail = await GET(
            new NextRequest(`https://content.example/api/showcase-media/${asset.id}?variant=thumbnail`),
            { params: Promise.resolve({ id: asset.id }) }
        );
        expect(thumbnail.headers.get('etag')).toBe('"checksum-thumbnail"');
        expect(getShowcaseManagedAssetFilePath).toHaveBeenCalledWith(asset, true);

        isShowcaseManagedAssetPublic.mockResolvedValue(false);
        const hidden = await GET(new NextRequest(`https://content.example/api/showcase-media/${asset.id}`), {
            params: Promise.resolve({ id: asset.id })
        });
        expect(hidden.status).toBe(404);
    });
});
