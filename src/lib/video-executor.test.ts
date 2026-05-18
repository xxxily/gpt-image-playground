import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelCatalogEntry, ProviderEndpoint } from './provider-model-catalog';
import {
    cancelVideoJob,
    downloadVideoResult,
    pollVideoJobOnce,
    pollVideoJobUntilDone,
    submitVideoTask,
    type VideoExecutorContext
} from './video-executor';
import { VideoAdapterError, type VideoProviderAdapter } from './video-providers/adapter';
import {
    clearVideoAdapterRegistry,
    registerVideoAdapter
} from './video-providers/registry';

function buildEndpoint(): ProviderEndpoint {
    return {
        id: 'endpoint-test',
        provider: 'openai',
        name: 'Test',
        apiKey: 'sk-test',
        apiBaseUrl: 'https://example.com/v1',
        protocol: 'openai-videos',
        enabled: true
    };
}

function buildCatalogEntry(endpoint: ProviderEndpoint): ModelCatalogEntry {
    return {
        id: `${endpoint.id}::sora-2`,
        rawModelId: 'sora-2',
        providerEndpointId: endpoint.id,
        provider: endpoint.provider,
        label: 'Sora 2',
        source: 'remote',
        enabled: true,
        capabilities: {
            tasks: ['video.generate', 'video.imageToVideo'],
            inputModalities: ['text', 'image'],
            outputModalities: ['video'],
            features: { video: { asyncJob: true } }
        },
        capabilityConfidence: 'high'
    };
}

const submitMock = vi.fn();
const pollMock = vi.fn();
const downloadMock = vi.fn();
const cancelMock = vi.fn();

const testAdapter: VideoProviderAdapter = {
    protocol: 'openai-videos',
    displayName: 'Test Adapter',
    submit: (...args) => submitMock(...args),
    poll: (...args) => pollMock(...args),
    download: (...args) => downloadMock(...args),
    cancel: (...args) => cancelMock(...args)
};

const fetchMock = vi.fn();
const invokeMock = vi.fn();

const isTauriMock = vi.fn(() => false);

const context: VideoExecutorContext = {
    fetcher: (...args) => fetchMock(...args),
    isTauri: () => isTauriMock(),
    invokeDesktop: (...args) => invokeMock(...args)
};

beforeEach(() => {
    clearVideoAdapterRegistry();
    registerVideoAdapter(testAdapter);
    submitMock.mockReset();
    pollMock.mockReset();
    downloadMock.mockReset();
    cancelMock.mockReset();
    fetchMock.mockReset();
    invokeMock.mockReset();
    isTauriMock.mockReturnValue(false);
});

afterEach(() => {
    vi.useRealTimers();
    clearVideoAdapterRegistry();
});

describe('submitVideoTask', () => {
    it('calls the adapter directly in direct mode', async () => {
        const endpoint = buildEndpoint();
        const entry = buildCatalogEntry(endpoint);
        submitMock.mockResolvedValueOnce({
            providerJobId: 'job-1',
            status: 'queued',
            progress: 0
        });

        const result = await submitVideoTask(
            {
                connectionMode: 'direct',
                endpoint,
                catalogEntry: entry,
                taskMode: 'text-to-video',
                prompt: 'A skater on Mars',
                parameters: { durationSeconds: 6 },
                sourceImages: []
            },
            context
        );

        expect(submitMock).toHaveBeenCalledTimes(1);
        const submitArgs = submitMock.mock.calls[0]?.[0];
        expect(submitArgs?.prompt).toBe('A skater on Mars');
        expect(submitArgs?.taskMode).toBe('text-to-video');
        expect(result.job.providerJobId).toBe('job-1');
        expect(result.job.status).toBe('queued');
    });

    it('calls the web route in proxy mode on web', async () => {
        const endpoint = buildEndpoint();
        const entry = buildCatalogEntry(endpoint);
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ providerJobId: 'job-web', status: 'queued' }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );

        const result = await submitVideoTask(
            {
                connectionMode: 'proxy',
                endpoint,
                catalogEntry: entry,
                taskMode: 'text-to-video',
                prompt: 'cinematic skater',
                parameters: {},
                sourceImages: [],
                passwordHash: 'hash-1'
            },
            context
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] ?? [];
        expect(url).toBe('/api/video/create');
        expect((init?.headers as Record<string, string>)['x-app-password']).toBe('hash-1');
        expect(submitMock).not.toHaveBeenCalled();
        expect(result.job.providerJobId).toBe('job-web');
    });

    it('invokes the desktop command in proxy mode on tauri', async () => {
        const endpoint = buildEndpoint();
        const entry = buildCatalogEntry(endpoint);
        isTauriMock.mockReturnValue(true);
        invokeMock.mockResolvedValueOnce({ providerJobId: 'job-desktop', status: 'queued' });

        const result = await submitVideoTask(
            {
                connectionMode: 'proxy',
                endpoint,
                catalogEntry: entry,
                taskMode: 'image-to-video',
                prompt: 'fly through clouds',
                parameters: {},
                sourceImages: []
            },
            context
        );

        expect(invokeMock).toHaveBeenCalledTimes(1);
        const [command, args] = invokeMock.mock.calls[0] ?? [];
        expect(command).toBe('proxy_video_create');
        expect((args as Record<string, unknown>)?.taskMode).toBe('image-to-video');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.job.providerJobId).toBe('job-desktop');
    });

    it('surfaces VideoAdapterError when no adapter is registered', async () => {
        clearVideoAdapterRegistry();
        const endpoint = buildEndpoint();
        const entry = buildCatalogEntry(endpoint);
        await expect(
            submitVideoTask(
                {
                    connectionMode: 'direct',
                    endpoint,
                    catalogEntry: entry,
                    taskMode: 'text-to-video',
                    prompt: 'a',
                    parameters: {},
                    sourceImages: []
                },
                context
            )
        ).rejects.toBeInstanceOf(VideoAdapterError);
    });

    it('wraps non-ok web responses as VideoAdapterError', async () => {
        const endpoint = buildEndpoint();
        const entry = buildCatalogEntry(endpoint);
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'quota_exceeded' }), {
                status: 429,
                headers: { 'content-type': 'application/json' }
            })
        );

        await expect(
            submitVideoTask(
                {
                    connectionMode: 'proxy',
                    endpoint,
                    catalogEntry: entry,
                    taskMode: 'text-to-video',
                    prompt: 'a',
                    parameters: {},
                    sourceImages: []
                },
                context
            )
        ).rejects.toMatchObject({ status: 429 });
    });
});

describe('pollVideoJobOnce', () => {
    it('returns the adapter result in direct mode', async () => {
        const endpoint = buildEndpoint();
        pollMock.mockResolvedValueOnce({ status: 'running', progress: 0.4 });
        const result = await pollVideoJobOnce(
            {
                connectionMode: 'direct',
                endpoint,
                providerJobId: 'job-1'
            },
            context
        );
        expect(result.status).toBe('running');
        expect(result.progress).toBe(0.4);
    });

    it('uses the web route in proxy mode', async () => {
        const endpoint = buildEndpoint();
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ status: 'succeeded', resultRemoteUrl: 'https://cdn/x.mp4' }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );
        const result = await pollVideoJobOnce(
            {
                connectionMode: 'proxy',
                endpoint,
                providerJobId: 'job-1'
            },
            context
        );
        expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/video/poll');
        expect(result.resultRemoteUrl).toBe('https://cdn/x.mp4');
    });
});

describe('pollVideoJobUntilDone', () => {
    it('keeps polling while status is non-terminal and stops on succeeded', async () => {
        const endpoint = buildEndpoint();
        pollMock
            .mockResolvedValueOnce({ status: 'running', progress: 0.1 })
            .mockResolvedValueOnce({ status: 'polling', progress: 0.5 })
            .mockResolvedValueOnce({ status: 'succeeded', resultRemoteUrl: 'https://cdn/x.mp4' });

        const onProgress = vi.fn();
        const result = await pollVideoJobUntilDone(
            {
                connectionMode: 'direct',
                endpoint,
                providerJobId: 'job-1'
            },
            {
                baseIntervalMs: 1,
                maxIntervalMs: 5,
                backoffMultiplier: 2,
                onProgress
            },
            context
        );

        expect(pollMock).toHaveBeenCalledTimes(3);
        expect(onProgress).toHaveBeenCalledTimes(3);
        expect(result.status).toBe('succeeded');
        expect(result.resultRemoteUrl).toBe('https://cdn/x.mp4');
    });

    it('stops polling immediately on a terminal failure', async () => {
        const endpoint = buildEndpoint();
        pollMock.mockResolvedValueOnce({
            status: 'failed',
            errorCode: 'safety_block',
            errorMessage: 'Rejected'
        });

        const result = await pollVideoJobUntilDone(
            { connectionMode: 'direct', endpoint, providerJobId: 'job-1' },
            { baseIntervalMs: 1 },
            context
        );
        expect(result.status).toBe('failed');
        expect(result.errorCode).toBe('safety_block');
        expect(pollMock).toHaveBeenCalledTimes(1);
    });

    it('aborts when the signal fires', async () => {
        const endpoint = buildEndpoint();
        const controller = new AbortController();
        pollMock.mockResolvedValue({ status: 'running' });

        const promise = pollVideoJobUntilDone(
            { connectionMode: 'direct', endpoint, providerJobId: 'job-1', signal: controller.signal },
            { baseIntervalMs: 50 },
            context
        );

        await new Promise((resolve) => setTimeout(resolve, 10));
        controller.abort();
        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    });
});

describe('downloadVideoResult', () => {
    it('returns the adapter response in direct mode', async () => {
        const endpoint = buildEndpoint();
        const upstreamResponse = new Response('video-bytes', {
            status: 200,
            headers: { 'content-type': 'video/mp4' }
        });
        downloadMock.mockResolvedValueOnce(upstreamResponse);

        const response = await downloadVideoResult(
            { connectionMode: 'direct', endpoint, providerJobId: 'job-1' },
            context
        );
        expect(response).toBe(upstreamResponse);
    });

    it('falls back to the web route in proxy mode', async () => {
        const endpoint = buildEndpoint();
        const upstreamResponse = new Response('via-route', {
            status: 200,
            headers: { 'content-type': 'video/mp4' }
        });
        fetchMock.mockResolvedValueOnce(upstreamResponse);

        const response = await downloadVideoResult(
            { connectionMode: 'proxy', endpoint, resultRemoteUrl: 'https://cdn/x.mp4' },
            context
        );
        expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/video/download');
        expect(response).toBe(upstreamResponse);
    });
});

describe('cancelVideoJob', () => {
    it('calls the adapter cancel in direct mode', async () => {
        const endpoint = buildEndpoint();
        cancelMock.mockResolvedValueOnce(undefined);
        await cancelVideoJob(
            { connectionMode: 'direct', endpoint, providerJobId: 'job-1' },
            context
        );
        expect(cancelMock).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when the adapter does not support cancel', async () => {
        clearVideoAdapterRegistry();
        registerVideoAdapter({
            protocol: 'openai-videos',
            displayName: 'Test (no cancel)',
            submit: () => Promise.resolve({ providerJobId: 'x', status: 'queued' }),
            poll: () => Promise.resolve({ status: 'running' }),
            download: () => Promise.resolve(new Response('x'))
        });
        const endpoint = buildEndpoint();
        await expect(
            cancelVideoJob(
                { connectionMode: 'direct', endpoint, providerJobId: 'job-1' },
                context
            )
        ).resolves.toBeUndefined();
    });

    it('hits the web route in proxy mode', async () => {
        const endpoint = buildEndpoint();
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            })
        );
        await cancelVideoJob(
            { connectionMode: 'proxy', endpoint, providerJobId: 'job-1' },
            context
        );
        expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/video/cancel');
    });
});
