import { assertRemoteShowcaseAssetsHealthy, type ShowcaseRemoteMediaProbeOptions } from './remote-media';
import type { ShowcaseTopicDraft } from './types';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import type { ShowcaseRemoteAsset } from '@/lib/showcase';
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';

let jpegBody: Buffer;

function remoteDraft(overrides: Partial<ShowcaseRemoteAsset> = {}): ShowcaseTopicDraft {
    const topic = DEFAULT_SHOWCASE_CATALOG.topics[0]!;
    const caseIds = new Set(topic.caseIds);
    const cases = DEFAULT_SHOWCASE_CATALOG.cases.filter((showcaseCase) => caseIds.has(showcaseCase.id));
    const assetIds = new Set<string>();
    for (const showcaseCase of cases) {
        assetIds.add(showcaseCase.coverAssetId);
        showcaseCase.inputAssetIds.forEach((id) => assetIds.add(id));
        showcaseCase.outputAssetIds.forEach((id) => assetIds.add(id));
    }
    const remoteAsset: ShowcaseRemoteAsset = {
        id: 'remote-cover',
        kind: 'remote-image',
        alt: { 'zh-CN': '远程专题封面', 'en-US': 'Remote topic cover' },
        url: 'https://images.example.test/topic-cover.jpg',
        mimeType: 'image/jpeg',
        width: 40,
        height: 20,
        ...overrides
    };
    return {
        topic: { ...topic, coverAssetId: remoteAsset.id },
        cases,
        assets: [...DEFAULT_SHOWCASE_CATALOG.assets.filter((asset) => assetIds.has(asset.id)), remoteAsset]
    };
}

function publicLookup() {
    return Promise.resolve([{ address: '8.8.8.8', family: 4 }]);
}

function imageResponse(body = jpegBody, headers: Record<string, string> = { 'content-type': 'image/jpeg' }) {
    return {
        kind: 'response' as const,
        status: 200,
        headers,
        body
    };
}

const successfulRequest: NonNullable<ShowcaseRemoteMediaProbeOptions['request']> = async () => imageResponse();

beforeAll(async () => {
    jpegBody = await sharp({
        create: { width: 40, height: 20, channels: 3, background: '#4f6d7a' }
    })
        .jpeg()
        .toBuffer();
});

describe('showcase remote media publication probe', () => {
    it('pins a verified public address and accepts a matching decodable image', async () => {
        const lookup = vi.fn(publicLookup);
        const request = vi.fn<NonNullable<ShowcaseRemoteMediaProbeOptions['request']>>(successfulRequest);

        await expect(assertRemoteShowcaseAssetsHealthy(remoteDraft(), { lookup, request })).resolves.toEqual([
            'https://images.example.test/topic-cover.jpg'
        ]);
        expect(lookup).toHaveBeenCalledWith('images.example.test');
        const [requestedUrl, resolvedAddress, limits] = request.mock.calls[0]!;
        expect(requestedUrl).toBeInstanceOf(URL);
        expect(requestedUrl.hostname).toBe('images.example.test');
        expect(resolvedAddress).toEqual({ address: '8.8.8.8', family: 4 });
        expect(limits.maximumBytes).toBe(12 * 1024 * 1024);
        expect(limits.timeoutMs).toBeGreaterThan(0);
        expect(limits.timeoutMs).toBeLessThanOrEqual(10_000);
    });

    it('rejects direct or DNS-resolved private and reserved addresses before requesting', async () => {
        const request = vi.fn<NonNullable<ShowcaseRemoteMediaProbeOptions['request']>>(successfulRequest);
        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft({ url: 'https://127.0.0.1/cover.jpg' }), {
                lookup: vi.fn(publicLookup),
                request
            })
        ).rejects.toThrow('内网或保留 IP');
        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                lookup: vi.fn(async () => [{ address: '10.0.0.8', family: 4 }]),
                request
            })
        ).rejects.toThrow('解析到了内网');
        expect(request).not.toHaveBeenCalled();
    });

    it('revalidates every redirect target and blocks a redirect into a private host', async () => {
        const lookup = vi.fn(async (hostname: string) =>
            hostname === 'images.example.test'
                ? [{ address: '8.8.8.8', family: 4 }]
                : [{ address: '192.168.1.20', family: 4 }]
        );
        const request = vi.fn(async () => ({
            kind: 'redirect' as const,
            status: 302,
            location: 'https://private.example.test/cover.jpg'
        }));

        await expect(assertRemoteShowcaseAssetsHealthy(remoteDraft(), { lookup, request })).rejects.toThrow(
            '解析到了内网'
        );
        expect(request).toHaveBeenCalledTimes(1);
        expect(lookup).toHaveBeenCalledTimes(2);
    });

    it('rejects MIME mismatches, oversized responses, corrupt images, and false dimensions', async () => {
        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                lookup: publicLookup,
                request: async () => imageResponse(jpegBody, { 'content-type': 'image/png' })
            })
        ).rejects.toThrow('MIME 不匹配');

        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                lookup: publicLookup,
                maximumBytes: 32,
                request: successfulRequest
            })
        ).rejects.toThrow('超过大小限制');

        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                lookup: publicLookup,
                request: async () => imageResponse(Buffer.from('not-an-image'))
            })
        ).rejects.toThrow('无法安全解码');

        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft({ width: 400, height: 200 }), {
                lookup: publicLookup,
                request: successfulRequest
            })
        ).rejects.toThrow('声明尺寸与真实尺寸不一致');
    });

    it('fails closed on request timeouts and redirect loops', async () => {
        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                timeoutMs: 5,
                lookup: async () => new Promise(() => undefined),
                request: successfulRequest
            })
        ).rejects.toThrow('探测超时');

        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                lookup: publicLookup,
                request: async () => {
                    throw new Error('远程媒体请求超时。');
                }
            })
        ).rejects.toThrow('请求超时');

        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                lookup: publicLookup,
                maximumRedirects: 1,
                request: async () => ({
                    kind: 'redirect',
                    status: 302,
                    location: 'https://images.example.test/again.jpg'
                })
            })
        ).rejects.toThrow('重定向次数过多');
    });

    it('rejects redirect-only internal hosts and sensitive query parameters', async () => {
        const lookup = vi.fn(publicLookup);
        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                lookup,
                request: async () => ({
                    kind: 'redirect',
                    status: 302,
                    location: 'https://localhost./cover.jpg'
                })
            })
        ).rejects.toThrow('本机或内部域名');
        await expect(
            assertRemoteShowcaseAssetsHealthy(remoteDraft(), {
                lookup,
                request: async () => ({
                    kind: 'redirect',
                    status: 302,
                    location: 'https://images.example.test/cover.jpg?access_token=hidden'
                })
            })
        ).rejects.toThrow('敏感查询参数');
    });

    it('ignores unreferenced external assets and managed media URLs', async () => {
        const managedDraft = remoteDraft({
            id: 'media_0123456789abcdef0123456789abcdef',
            url: '/api/showcase-media/media_0123456789abcdef0123456789abcdef',
            thumbnailUrl: '/api/showcase-media/media_0123456789abcdef0123456789abcdef?variant=thumbnail',
            managedAssetId: 'media_0123456789abcdef0123456789abcdef',
            mimeType: 'image/webp'
        });
        const request = vi.fn<NonNullable<ShowcaseRemoteMediaProbeOptions['request']>>(successfulRequest);

        await expect(
            assertRemoteShowcaseAssetsHealthy(
                {
                    ...managedDraft,
                    assets: [
                        ...managedDraft.assets,
                        {
                            ...remoteDraft().assets.at(-1)!,
                            id: 'unreferenced-external'
                        }
                    ]
                },
                { lookup: publicLookup, request }
            )
        ).resolves.toEqual([]);
        expect(request).not.toHaveBeenCalled();
    });
});
