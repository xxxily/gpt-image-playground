import { formatApiError } from '@/lib/api-error';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import type { ModelCatalogEntry, ProviderEndpoint } from '@/lib/provider-model-catalog';
import { getVideoAdapter } from '@/lib/video-providers/registry';
import {
    type VideoAdapterCancelInput,
    type VideoAdapterDownloadInput,
    type VideoAdapterPollInput,
    type VideoAdapterPollResult,
    type VideoAdapterSourceImage,
    type VideoAdapterSubmitInput,
    type VideoAdapterSubmitResult,
    VideoAdapterError,
    type VideoFetcher
} from '@/lib/video-providers/adapter';
import {
    type VideoGenerationJob,
    type VideoGenerationParameters,
    type VideoGenerationStatus
} from '@/lib/video-types';

export type VideoConnectionMode = 'proxy' | 'direct';

export type VideoExecutorTaskMode = 'text-to-video' | 'image-to-video';

export type VideoExecutorSubmitParams = {
    connectionMode: VideoConnectionMode;
    endpoint: ProviderEndpoint;
    catalogEntry: ModelCatalogEntry;
    taskMode: VideoExecutorTaskMode;
    prompt: string;
    negativePrompt?: string;
    parameters: VideoGenerationParameters;
    sourceImages: VideoAdapterSourceImage[];
    callbackUrl?: string;
    passwordHash?: string;
    signal?: AbortSignal;
};

export type VideoExecutorPollParams = {
    connectionMode: VideoConnectionMode;
    endpoint: ProviderEndpoint;
    catalogEntry?: ModelCatalogEntry;
    providerJobId: string;
    passwordHash?: string;
    signal?: AbortSignal;
};

export type VideoExecutorDownloadParams = {
    connectionMode: VideoConnectionMode;
    endpoint: ProviderEndpoint;
    providerJobId?: string;
    resultRemoteUrl?: string;
    passwordHash?: string;
    signal?: AbortSignal;
};

export type VideoExecutorCancelParams = {
    connectionMode: VideoConnectionMode;
    endpoint: ProviderEndpoint;
    providerJobId: string;
    passwordHash?: string;
    signal?: AbortSignal;
};

export type VideoExecutorSubmitOutput = {
    job: VideoGenerationJob;
    rawResponse?: unknown;
};

export type VideoExecutorPollOutput = VideoAdapterPollResult;

export const DEFAULT_VIDEO_POLLING_BASE_INTERVAL_MS = 5_000;
export const DEFAULT_VIDEO_POLLING_MAX_INTERVAL_MS = 30_000;
export const DEFAULT_VIDEO_POLLING_BACKOFF_MULTIPLIER = 1.5;

export type VideoPollingOptions = {
    baseIntervalMs?: number;
    maxIntervalMs?: number;
    backoffMultiplier?: number;
    onProgress?: (result: VideoAdapterPollResult, attempt: number) => void;
    signal?: AbortSignal;
};

function isTerminalStatus(status: VideoGenerationStatus): boolean {
    return status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'expired';
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

function buildJobFromSubmitResult(
    submit: VideoAdapterSubmitResult,
    params: VideoExecutorSubmitParams,
    localId: string
): VideoGenerationJob {
    const now = Date.now();
    return {
        id: localId,
        providerJobId: submit.providerJobId,
        providerRequestId: submit.providerRequestId,
        status: submit.status,
        progress: submit.progress,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        pollAttempts: 0
    };
}

function createLocalJobId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `video_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `video_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export type VideoExecutorContext = {
    fetcher?: VideoFetcher;
    isTauri?: () => boolean;
    invokeDesktop?: typeof invokeDesktopCommand;
};

const DEFAULT_CONTEXT: Required<VideoExecutorContext> = {
    fetcher: (url, init) => fetch(url, init),
    isTauri: () => isTauriDesktop(),
    invokeDesktop: invokeDesktopCommand
};

function withDefaults(context: VideoExecutorContext | undefined): Required<VideoExecutorContext> {
    return {
        fetcher: context?.fetcher ?? DEFAULT_CONTEXT.fetcher,
        isTauri: context?.isTauri ?? DEFAULT_CONTEXT.isTauri,
        invokeDesktop: context?.invokeDesktop ?? DEFAULT_CONTEXT.invokeDesktop
    };
}

function applyAuthHeaders(
    init: RequestInit,
    endpoint: ProviderEndpoint
): RequestInit {
    const headers = new Headers(init.headers);
    if (endpoint.apiKey && !headers.has('Authorization')) {
        if (endpoint.provider === 'google-gemini' || endpoint.provider === 'google-vertex-ai') {
            headers.set('x-goog-api-key', endpoint.apiKey);
        } else {
            headers.set('Authorization', `Bearer ${endpoint.apiKey}`);
        }
    }
    return { ...init, headers };
}

function buildDirectFetcher(endpoint: ProviderEndpoint, signal?: AbortSignal): VideoFetcher {
    return async (url, init = {}) => {
        const finalInit = applyAuthHeaders(init, endpoint);
        return fetch(url, { ...finalInit, signal: finalInit.signal ?? signal });
    };
}

async function callWebApiRoute(
    route: 'create' | 'poll' | 'download' | 'cancel',
    body: Record<string, unknown>,
    passwordHash: string | undefined,
    signal: AbortSignal | undefined,
    context: Required<VideoExecutorContext>
): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (passwordHash) headers['x-app-password'] = passwordHash;
    return context.fetcher(`/api/video/${route}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
    });
}

async function readJsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        let parsed: unknown = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = null;
        }
        throw new VideoAdapterError({
            code: 'http_error',
            message: formatApiError(parsed ?? text, fallback),
            status: response.status,
            providerResponse: parsed ?? text
        });
    }
    return (await response.json()) as T;
}

function ensureAdapter(protocol: ProviderEndpoint['protocol']) {
    const adapter = getVideoAdapter(protocol);
    if (!adapter) {
        throw new VideoAdapterError({
            code: 'adapter_not_registered',
            message: `No video adapter is registered for protocol "${protocol}".`
        });
    }
    return adapter;
}

export async function submitVideoTask(
    params: VideoExecutorSubmitParams,
    context?: VideoExecutorContext
): Promise<VideoExecutorSubmitOutput> {
    const ctx = withDefaults(context);
    const localId = createLocalJobId();

    if (params.connectionMode === 'direct') {
        const adapter = ensureAdapter(params.endpoint.protocol);
        const fetcher = buildDirectFetcher(params.endpoint, params.signal);
        const submitInput: VideoAdapterSubmitInput = {
            endpoint: params.endpoint,
            catalogEntry: params.catalogEntry,
            taskMode: params.taskMode,
            prompt: params.prompt,
            negativePrompt: params.negativePrompt,
            parameters: params.parameters,
            sourceImages: params.sourceImages,
            ...(params.callbackUrl ? { callbackUrl: params.callbackUrl } : {})
        };
        const result = await adapter.submit(submitInput, fetcher);
        return { job: buildJobFromSubmitResult(result, params, localId), rawResponse: result.rawResponse };
    }

    if (ctx.isTauri()) {
        try {
            const result = await ctx.invokeDesktop<VideoAdapterSubmitResult>('proxy_video_create', {
                endpoint: params.endpoint,
                catalogEntryId: params.catalogEntry.id,
                taskMode: params.taskMode,
                prompt: params.prompt,
                negativePrompt: params.negativePrompt,
                parameters: params.parameters,
                sourceImages: params.sourceImages,
                callbackUrl: params.callbackUrl
            });
            return { job: buildJobFromSubmitResult(result, params, localId), rawResponse: result.rawResponse };
        } catch (error) {
            if (error instanceof VideoAdapterError) throw error;
            throw new VideoAdapterError({
                code: 'desktop_proxy_failed',
                message: formatApiError(error, 'Desktop proxy_video_create failed.'),
                providerResponse: error
            });
        }
    }

    const response = await callWebApiRoute(
        'create',
        {
            endpoint: params.endpoint,
            catalogEntryId: params.catalogEntry.id,
            taskMode: params.taskMode,
            prompt: params.prompt,
            negativePrompt: params.negativePrompt,
            parameters: params.parameters,
            sourceImages: params.sourceImages,
            callbackUrl: params.callbackUrl
        },
        params.passwordHash,
        params.signal,
        ctx
    );
    const submit = await readJsonOrThrow<VideoAdapterSubmitResult>(response, 'Failed to submit video task.');
    return { job: buildJobFromSubmitResult(submit, params, localId), rawResponse: submit.rawResponse };
}

export async function pollVideoJobOnce(
    params: VideoExecutorPollParams,
    context?: VideoExecutorContext
): Promise<VideoExecutorPollOutput> {
    const ctx = withDefaults(context);

    if (params.connectionMode === 'direct') {
        const adapter = ensureAdapter(params.endpoint.protocol);
        const fetcher = buildDirectFetcher(params.endpoint, params.signal);
        const pollInput: VideoAdapterPollInput = {
            endpoint: params.endpoint,
            catalogEntry: params.catalogEntry,
            providerJobId: params.providerJobId
        };
        return adapter.poll(pollInput, fetcher);
    }

    if (ctx.isTauri()) {
        try {
            return await ctx.invokeDesktop<VideoAdapterPollResult>('proxy_video_poll', {
                endpoint: params.endpoint,
                catalogEntryId: params.catalogEntry?.id,
                providerJobId: params.providerJobId
            });
        } catch (error) {
            if (error instanceof VideoAdapterError) throw error;
            throw new VideoAdapterError({
                code: 'desktop_proxy_failed',
                message: formatApiError(error, 'Desktop proxy_video_poll failed.'),
                providerResponse: error
            });
        }
    }

    const response = await callWebApiRoute(
        'poll',
        {
            endpoint: params.endpoint,
            catalogEntryId: params.catalogEntry?.id,
            providerJobId: params.providerJobId
        },
        params.passwordHash,
        params.signal,
        ctx
    );
    return readJsonOrThrow<VideoAdapterPollResult>(response, 'Failed to poll video task.');
}

export async function pollVideoJobUntilDone(
    params: VideoExecutorPollParams,
    options: VideoPollingOptions = {},
    context?: VideoExecutorContext
): Promise<VideoExecutorPollOutput> {
    const base = Math.max(1_000, options.baseIntervalMs ?? DEFAULT_VIDEO_POLLING_BASE_INTERVAL_MS);
    const cap = Math.max(base, options.maxIntervalMs ?? DEFAULT_VIDEO_POLLING_MAX_INTERVAL_MS);
    const multiplier = Math.max(1, options.backoffMultiplier ?? DEFAULT_VIDEO_POLLING_BACKOFF_MULTIPLIER);
    let interval = base;
    let attempt = 0;
    const signal = options.signal ?? params.signal;

    while (true) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const result = await pollVideoJobOnce({ ...params, signal }, context);
        options.onProgress?.(result, attempt);
        if (isTerminalStatus(result.status)) return result;
        attempt += 1;
        await sleep(interval, signal);
        interval = Math.min(cap, Math.floor(interval * multiplier));
    }
}

export async function downloadVideoResult(
    params: VideoExecutorDownloadParams,
    context?: VideoExecutorContext
): Promise<Response> {
    const ctx = withDefaults(context);

    if (params.connectionMode === 'direct') {
        const adapter = ensureAdapter(params.endpoint.protocol);
        const fetcher = buildDirectFetcher(params.endpoint, params.signal);
        const downloadInput: VideoAdapterDownloadInput = {
            endpoint: params.endpoint,
            providerJobId: params.providerJobId,
            resultRemoteUrl: params.resultRemoteUrl
        };
        return adapter.download(downloadInput, fetcher);
    }

    if (ctx.isTauri()) {
        try {
            return await ctx.invokeDesktop<Response>('proxy_video_download', {
                endpoint: params.endpoint,
                providerJobId: params.providerJobId,
                resultRemoteUrl: params.resultRemoteUrl
            });
        } catch (error) {
            if (error instanceof VideoAdapterError) throw error;
            throw new VideoAdapterError({
                code: 'desktop_proxy_failed',
                message: formatApiError(error, 'Desktop proxy_video_download failed.'),
                providerResponse: error
            });
        }
    }

    return callWebApiRoute(
        'download',
        {
            endpoint: params.endpoint,
            providerJobId: params.providerJobId,
            resultRemoteUrl: params.resultRemoteUrl
        },
        params.passwordHash,
        params.signal,
        ctx
    );
}

export async function cancelVideoJob(
    params: VideoExecutorCancelParams,
    context?: VideoExecutorContext
): Promise<void> {
    const ctx = withDefaults(context);

    if (params.connectionMode === 'direct') {
        const adapter = ensureAdapter(params.endpoint.protocol);
        if (!adapter.cancel) return;
        const fetcher = buildDirectFetcher(params.endpoint, params.signal);
        const cancelInput: VideoAdapterCancelInput = {
            endpoint: params.endpoint,
            providerJobId: params.providerJobId
        };
        await adapter.cancel(cancelInput, fetcher);
        return;
    }

    if (ctx.isTauri()) {
        try {
            await ctx.invokeDesktop<void>('proxy_video_cancel', {
                endpoint: params.endpoint,
                providerJobId: params.providerJobId
            });
            return;
        } catch (error) {
            if (error instanceof VideoAdapterError) throw error;
            throw new VideoAdapterError({
                code: 'desktop_proxy_failed',
                message: formatApiError(error, 'Desktop proxy_video_cancel failed.'),
                providerResponse: error
            });
        }
    }

    await callWebApiRoute(
        'cancel',
        {
            endpoint: params.endpoint,
            providerJobId: params.providerJobId
        },
        params.passwordHash,
        params.signal,
        ctx
    );
}
