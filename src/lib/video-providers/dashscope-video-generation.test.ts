import { describe, expect, it, vi } from 'vitest';

import type { ModelCatalogEntry, ProviderEndpoint } from '../provider-model-catalog';
import { VideoAdapterError } from './adapter';
import { dashscopeVideoAdapter } from './dashscope-video-generation';

function endpoint(overrides: Partial<ProviderEndpoint> = {}): ProviderEndpoint {
    return {
        id: 'wan-endpoint',
        provider: 'aliyun-dashscope',
        name: 'DashScope',
        apiKey: 'sk-dashscope',
        apiBaseUrl: 'https://dashscope.aliyuncs.com',
        protocol: 'dashscope-video-generation',
        enabled: true,
        ...overrides
    };
}

function catalogEntry(rawModelId = 'wan2.7-t2v'): ModelCatalogEntry {
    return {
        id: `wan-endpoint::${rawModelId}`,
        rawModelId,
        providerEndpointId: 'wan-endpoint',
        provider: 'aliyun-dashscope',
        label: rawModelId,
        source: 'remote',
        enabled: true,
        capabilities: {
            tasks: ['video.generate', 'video.imageToVideo', 'video.referenceToVideo'],
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

describe('dashscopeVideoAdapter.submit', () => {
    it('routes text-to-video to text2video endpoint with async header', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({
                request_id: 'req-123',
                output: { task_id: 'task-1', task_status: 'PENDING' }
            })
        );
        const result = await dashscopeVideoAdapter.submit(
            {
                endpoint: endpoint(),
                catalogEntry: catalogEntry(),
                taskMode: 'text-to-video',
                prompt: '一只猫在打鼓',
                parameters: { promptEnhanceEnabled: true, seed: 7 },
                sourceImages: []
            },
            fetcher
        );

        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(url).toBe(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2video/video-synthesis'
        );
        expect((init?.headers as Record<string, string>)['X-DashScope-Async']).toBe('enable');
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.model).toBe('wan2.7-t2v');
        expect(body.input.prompt).toBe('一只猫在打鼓');
        expect(body.parameters.prompt_extend).toBe(true);
        expect(body.parameters.seed).toBe(7);
        expect(result.providerJobId).toBe('task-1');
        expect(result.providerRequestId).toBe('req-123');
        expect(result.status).toBe('queued');
    });

    it('routes image-to-video to image2video endpoint and uses public URL', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({
                request_id: 'req-456',
                output: { task_id: 'task-2', task_status: 'PENDING' }
            })
        );
        await dashscopeVideoAdapter.submit(
            {
                endpoint: endpoint(),
                catalogEntry: catalogEntry(),
                taskMode: 'image-to-video',
                prompt: 'pan up',
                parameters: {},
                sourceImages: [
                    {
                        filename: 'a.jpg',
                        mimeType: 'image/jpeg',
                        role: 'start_frame',
                        publicUrl: 'https://oss.example.com/a.jpg'
                    },
                    {
                        filename: 'b.jpg',
                        mimeType: 'image/jpeg',
                        role: 'end_frame',
                        publicUrl: 'https://oss.example.com/b.jpg'
                    }
                ]
            },
            fetcher
        );

        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(url).toBe(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis'
        );
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.input.img_url).toBe('https://oss.example.com/a.jpg');
        expect(body.input.last_frame_img_url).toBe('https://oss.example.com/b.jpg');
    });

    it('routes reference-to-video models to reference2video endpoint', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({ output: { task_id: 't', task_status: 'PENDING' } })
        );
        await dashscopeVideoAdapter.submit(
            {
                endpoint: endpoint(),
                catalogEntry: catalogEntry('wan2.6-r2v'),
                taskMode: 'text-to-video',
                prompt: 'ref',
                parameters: {},
                sourceImages: []
            },
            fetcher
        );
        expect(fetcher.mock.calls[0]?.[0]).toBe(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/reference2video/video-synthesis'
        );
    });

    it('throws when image-to-video lacks a public URL', async () => {
        const fetcher = vi.fn();
        await expect(
            dashscopeVideoAdapter.submit(
                {
                    endpoint: endpoint(),
                    catalogEntry: catalogEntry(),
                    taskMode: 'image-to-video',
                    prompt: 'a',
                    parameters: {},
                    sourceImages: [
                        {
                            filename: 'a.jpg',
                            mimeType: 'image/jpeg',
                            role: 'start_frame',
                            base64: 'BASE64'
                        }
                    ]
                },
                fetcher
            )
        ).rejects.toBeInstanceOf(VideoAdapterError);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('wraps non-ok responses into VideoAdapterError', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({ code: 'InvalidParameter', message: 'bad' }, 400)
        );
        await expect(
            dashscopeVideoAdapter.submit(
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
        ).rejects.toMatchObject({ status: 400 });
    });
});

describe('dashscopeVideoAdapter.poll', () => {
    it('returns succeeded with video URL when task is done', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({
                request_id: 'req-1',
                output: {
                    task_id: 'task-1',
                    task_status: 'SUCCEEDED',
                    progress: 1,
                    video_url: 'https://cdn.aliyun.com/x.mp4',
                    cover_url: 'https://cdn.aliyun.com/x.jpg'
                }
            })
        );
        const result = await dashscopeVideoAdapter.poll(
            { endpoint: endpoint(), providerJobId: 'task-1' },
            fetcher
        );
        expect(fetcher.mock.calls[0]?.[0]).toBe(
            'https://dashscope.aliyuncs.com/api/v1/tasks/task-1'
        );
        expect(result.status).toBe('succeeded');
        expect(result.resultRemoteUrl).toBe('https://cdn.aliyun.com/x.mp4');
        expect(result.thumbnailRemoteUrl).toBe('https://cdn.aliyun.com/x.jpg');
    });

    it('returns running for PENDING/RUNNING', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({ output: { task_id: 't', task_status: 'RUNNING', progress: 0.3 } })
        );
        const result = await dashscopeVideoAdapter.poll(
            { endpoint: endpoint(), providerJobId: 't' },
            fetcher
        );
        expect(result.status).toBe('running');
        expect(result.progress).toBeCloseTo(0.3);
    });

    it('surfaces error code and message on FAILED', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({
                output: {
                    task_status: 'FAILED',
                    error_code: 'ContentRisk',
                    error_message: 'Blocked'
                }
            })
        );
        const result = await dashscopeVideoAdapter.poll(
            { endpoint: endpoint(), providerJobId: 't' },
            fetcher
        );
        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('ContentRisk');
        expect(result.errorMessage).toBe('Blocked');
    });

    it('falls back to results[].url and results[].cover_url when top-level video_url is absent', async () => {
        const fetcher = vi.fn().mockResolvedValueOnce(
            jsonResponse({
                output: {
                    task_status: 'SUCCEEDED',
                    results: [
                        {
                            url: 'https://cdn.aliyun.com/y.mp4',
                            cover_url: 'https://cdn.aliyun.com/y.jpg'
                        }
                    ]
                }
            })
        );
        const result = await dashscopeVideoAdapter.poll(
            { endpoint: endpoint(), providerJobId: 't' },
            fetcher
        );
        expect(result.resultRemoteUrl).toBe('https://cdn.aliyun.com/y.mp4');
        expect(result.thumbnailRemoteUrl).toBe('https://cdn.aliyun.com/y.jpg');
    });
});

describe('dashscopeVideoAdapter.download', () => {
    it('returns the upstream Response for the resultRemoteUrl', async () => {
        const upstream = new Response('bytes', { status: 200 });
        const fetcher = vi.fn().mockResolvedValueOnce(upstream);
        const response = await dashscopeVideoAdapter.download(
            { endpoint: endpoint(), resultRemoteUrl: 'https://cdn.aliyun.com/z.mp4' },
            fetcher
        );
        expect(response).toBe(upstream);
        expect(fetcher.mock.calls[0]?.[0]).toBe('https://cdn.aliyun.com/z.mp4');
    });

    it('throws when no resultRemoteUrl is provided', async () => {
        const fetcher = vi.fn();
        await expect(
            dashscopeVideoAdapter.download({ endpoint: endpoint() }, fetcher)
        ).rejects.toBeInstanceOf(VideoAdapterError);
    });
});
