import { describe, expect, it, vi } from 'vitest';

import type { ModelCatalogEntry, ProviderEndpoint } from '../provider-model-catalog';
import { soraVideoAdapter } from './openai-videos';
import { VideoAdapterError } from './adapter';

function endpoint(overrides: Partial<ProviderEndpoint> = {}): ProviderEndpoint {
    return {
        id: 'sora-endpoint',
        provider: 'openai',
        name: 'Sora',
        apiKey: 'sk-test',
        apiBaseUrl: 'https://api.openai.com/v1',
        protocol: 'openai-videos',
        enabled: true,
        ...overrides
    };
}

function catalogEntry(): ModelCatalogEntry {
    return {
        id: 'sora-endpoint::sora-2',
        rawModelId: 'sora-2',
        providerEndpointId: 'sora-endpoint',
        provider: 'openai',
        label: 'Sora 2',
        source: 'remote',
        enabled: true,
        capabilities: {
            tasks: ['video.generate', 'video.imageToVideo'],
            inputModalities: ['text', 'image'],
            outputModalities: ['video']
        },
        capabilityConfidence: 'high'
    };
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

describe('soraVideoAdapter.submit', () => {
    it('posts the expected create body for text-to-video', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({ id: 'vid_abc', status: 'queued', progress: 0 })
        );
        const result = await soraVideoAdapter.submit(
            {
                endpoint: endpoint(),
                catalogEntry: catalogEntry(),
                taskMode: 'text-to-video',
                prompt: 'A skater on Mars',
                parameters: {
                    durationSeconds: 6,
                    size: '1024x1792',
                    seed: 42,
                    count: 1,
                    nativeAudioEnabled: true
                },
                sourceImages: []
            },
            fetcher
        );

        expect(fetcher).toHaveBeenCalledTimes(1);
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(url).toBe('https://api.openai.com/v1/videos');
        expect(init?.method).toBe('POST');
        const sentBody = JSON.parse(String(init?.body ?? '{}'));
        expect(sentBody.model).toBe('sora-2');
        expect(sentBody.prompt).toBe('A skater on Mars');
        expect(sentBody.seconds).toBe(6);
        expect(sentBody.size).toBe('1024x1792');
        expect(sentBody.seed).toBe(42);
        expect(sentBody.n).toBe(1);
        expect(sentBody.audio).toBe(true);
        expect(result.providerJobId).toBe('vid_abc');
        expect(result.status).toBe('queued');
    });

    it('embeds the source image as a data URL for image-to-video', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({ id: 'vid_xyz', status: 'queued' })
        );
        await soraVideoAdapter.submit(
            {
                endpoint: endpoint(),
                catalogEntry: catalogEntry(),
                taskMode: 'image-to-video',
                prompt: 'Pan upward',
                parameters: {},
                sourceImages: [
                    {
                        filename: 'first.jpg',
                        mimeType: 'image/jpeg',
                        role: 'start_frame',
                        base64: 'BASE64'
                    }
                ]
            },
            fetcher
        );

        const [, init] = fetcher.mock.calls[0] ?? [];
        const sentBody = JSON.parse(String(init?.body ?? '{}'));
        expect(sentBody.input_reference).toBe('data:image/jpeg;base64,BASE64');
    });

    it('throws when image-to-video has no source image', async () => {
        const fetcher = vi.fn();
        await expect(
            soraVideoAdapter.submit(
                {
                    endpoint: endpoint(),
                    catalogEntry: catalogEntry(),
                    taskMode: 'image-to-video',
                    prompt: 'Pan up',
                    parameters: {},
                    sourceImages: []
                },
                fetcher
            )
        ).rejects.toBeInstanceOf(VideoAdapterError);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('wraps non-ok responses into VideoAdapterError', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({ error: { message: 'rate limited' } }, 429)
        );
        await expect(
            soraVideoAdapter.submit(
                {
                    endpoint: endpoint(),
                    catalogEntry: catalogEntry(),
                    taskMode: 'text-to-video',
                    prompt: 'a',
                    parameters: {},
                    sourceImages: []
                },
                fetcher
            )
        ).rejects.toMatchObject({ status: 429 });
    });
});

describe('soraVideoAdapter.poll', () => {
    it('returns succeeded with result URL when output is present', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({
                id: 'vid_abc',
                status: 'completed',
                progress: 1,
                output: {
                    url: 'https://cdn.openai.com/sora/x.mp4',
                    thumbnail_url: 'https://cdn.openai.com/sora/x.jpg',
                    expires_at: 1_700_000_000
                }
            })
        );

        const result = await soraVideoAdapter.poll(
            {
                endpoint: endpoint(),
                providerJobId: 'vid_abc'
            },
            fetcher
        );
        expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/videos/vid_abc');
        expect(result.status).toBe('succeeded');
        expect(result.resultRemoteUrl).toBe('https://cdn.openai.com/sora/x.mp4');
        expect(result.thumbnailRemoteUrl).toBe('https://cdn.openai.com/sora/x.jpg');
        expect(result.resultRemoteUrlExpiresAt).toBe(1_700_000_000_000);
    });

    it('returns failed and surfaces provider error', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({
                id: 'vid_abc',
                status: 'failed',
                error: { code: 'safety_blocked', message: 'Rejected' }
            })
        );
        const result = await soraVideoAdapter.poll(
            { endpoint: endpoint(), providerJobId: 'vid_abc' },
            fetcher
        );
        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('safety_blocked');
        expect(result.errorMessage).toBe('Rejected');
    });

    it('normalizes provider-specific running status', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({ status: 'in_progress', progress: 0.4 })
        );
        const result = await soraVideoAdapter.poll(
            { endpoint: endpoint(), providerJobId: 'vid' },
            fetcher
        );
        expect(result.status).toBe('running');
        expect(result.progress).toBeCloseTo(0.4);
    });
});

describe('soraVideoAdapter.download', () => {
    it('prefers resultRemoteUrl when provided', async () => {
        const blobResponse = new Response('bytes', { status: 200 });
        const fetcher = vi.fn().mockResolvedValueOnce(blobResponse);
        const response = await soraVideoAdapter.download(
            { endpoint: endpoint(), resultRemoteUrl: 'https://cdn.openai.com/sora/x.mp4' },
            fetcher
        );
        expect(response).toBe(blobResponse);
        expect(fetcher.mock.calls[0]?.[0]).toBe('https://cdn.openai.com/sora/x.mp4');
    });

    it('falls back to /content endpoint with providerJobId', async () => {
        const blobResponse = new Response('bytes', { status: 200 });
        const fetcher = vi.fn().mockResolvedValueOnce(blobResponse);
        await soraVideoAdapter.download(
            { endpoint: endpoint(), providerJobId: 'vid_abc' },
            fetcher
        );
        expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/videos/vid_abc/content');
    });

    it('throws when neither url nor id is provided', async () => {
        const fetcher = vi.fn();
        await expect(
            soraVideoAdapter.download({ endpoint: endpoint() }, fetcher)
        ).rejects.toBeInstanceOf(VideoAdapterError);
    });
});

describe('soraVideoAdapter.cancel', () => {
    it('treats 404 as a no-op (already finished)', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 }));
        await expect(
            soraVideoAdapter.cancel?.(
                { endpoint: endpoint(), providerJobId: 'vid_abc' },
                fetcher
            )
        ).resolves.toBeUndefined();
    });

    it('throws on other failure codes', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(new Response('boom', { status: 500 }));
        await expect(
            soraVideoAdapter.cancel?.(
                { endpoint: endpoint(), providerJobId: 'vid_abc' },
                fetcher
            )
        ).rejects.toBeInstanceOf(VideoAdapterError);
    });
});
