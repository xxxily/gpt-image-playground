import { formatApiError } from '@/lib/api-error';
import {
    VideoAdapterError,
    type VideoAdapterCancelInput,
    type VideoAdapterDownloadInput,
    type VideoAdapterPollInput,
    type VideoAdapterPollResult,
    type VideoAdapterSourceImage,
    type VideoAdapterSubmitInput,
    type VideoAdapterSubmitResult,
    type VideoFetcher,
    type VideoProviderAdapter
} from '@/lib/video-providers/adapter';
import type { VideoGenerationStatus } from '@/lib/video-types';

const DEFAULT_SORA_BASE_URL = 'https://api.openai.com/v1';

function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

function resolveBaseUrl(apiBaseUrl: string | undefined): string {
    const base = apiBaseUrl && apiBaseUrl.trim() ? apiBaseUrl.trim() : DEFAULT_SORA_BASE_URL;
    return trimTrailingSlash(base);
}

function pickReferenceImage(sourceImages: readonly VideoAdapterSourceImage[]): VideoAdapterSourceImage | null {
    if (sourceImages.length === 0) return null;
    return (
        sourceImages.find((image) => image.role === 'start_frame') ??
        sourceImages.find((image) => image.role === 'reference') ??
        sourceImages[0]
    );
}

function sourceImageToDataUrl(image: VideoAdapterSourceImage): string | null {
    if (image.base64) return `data:${image.mimeType};base64,${image.base64}`;
    if (image.publicUrl) return image.publicUrl;
    if (image.bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < image.bytes.length; offset += chunkSize) {
            const chunk = image.bytes.subarray(offset, Math.min(image.bytes.length, offset + chunkSize));
            binary += String.fromCharCode(...chunk);
        }
        const base64 = typeof globalThis.btoa === 'function' ? globalThis.btoa(binary) : '';
        if (base64) return `data:${image.mimeType};base64,${base64}`;
    }
    return null;
}

type SoraSubmitBody = {
    model: string;
    prompt: string;
    negative_prompt?: string;
    seconds?: number;
    size?: string;
    seed?: number;
    n?: number;
    input_reference?: string;
    audio?: boolean;
    watermark?: boolean;
};

function buildSubmitBody(input: VideoAdapterSubmitInput): SoraSubmitBody {
    const body: SoraSubmitBody = {
        model: input.catalogEntry.rawModelId,
        prompt: input.prompt
    };

    if (input.negativePrompt) body.negative_prompt = input.negativePrompt;
    if (input.parameters.durationSeconds !== undefined) body.seconds = input.parameters.durationSeconds;
    if (input.parameters.size) body.size = input.parameters.size;
    if (input.parameters.seed !== undefined) body.seed = input.parameters.seed;
    if (input.parameters.count !== undefined) body.n = input.parameters.count;
    if (input.parameters.nativeAudioEnabled !== undefined) body.audio = input.parameters.nativeAudioEnabled;
    if (input.parameters.watermarkEnabled !== undefined) body.watermark = input.parameters.watermarkEnabled;

    if (input.taskMode === 'image-to-video') {
        const reference = pickReferenceImage(input.sourceImages);
        if (!reference) {
            throw new VideoAdapterError({
                code: 'missing_source_image',
                message: 'Image-to-video requires at least one source image for Sora.'
            });
        }
        const dataUrl = sourceImageToDataUrl(reference);
        if (!dataUrl) {
            throw new VideoAdapterError({
                code: 'invalid_source_image',
                message: 'Sora image-to-video requires either base64 bytes or a public URL for the source image.'
            });
        }
        body.input_reference = dataUrl;
    }

    return body;
}

function normalizeStatus(value: unknown): VideoGenerationStatus {
    if (typeof value !== 'string') return 'running';
    switch (value.toLowerCase()) {
        case 'queued':
        case 'pending':
            return 'queued';
        case 'in_progress':
        case 'processing':
        case 'running':
            return 'running';
        case 'completed':
        case 'succeeded':
            return 'succeeded';
        case 'failed':
        case 'error':
            return 'failed';
        case 'cancelled':
        case 'canceled':
            return 'cancelled';
        case 'expired':
            return 'expired';
        default:
            return 'running';
    }
}

function clampProgress(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    if (value > 1) return Math.max(0, Math.min(1, value / 100));
    return Math.max(0, Math.min(1, value));
}

async function readJsonOrError<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        let parsed: unknown = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = null;
        }
        throw new VideoAdapterError({
            code: 'sora_http_error',
            message: formatApiError(parsed ?? text, fallback),
            status: response.status,
            providerResponse: parsed ?? text
        });
    }
    return (await response.json()) as T;
}

export const soraVideoAdapter: VideoProviderAdapter = {
    protocol: 'openai-videos',
    displayName: 'OpenAI Sora',

    async submit(input: VideoAdapterSubmitInput, fetcher: VideoFetcher): Promise<VideoAdapterSubmitResult> {
        const url = `${resolveBaseUrl(input.endpoint.apiBaseUrl)}/videos`;
        const body = buildSubmitBody(input);
        const response = await fetcher(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await readJsonOrError<{
            id?: string;
            object?: string;
            status?: string;
            progress?: number;
            created?: number;
        }>(response, 'Sora video submit failed.');

        if (!json.id) {
            throw new VideoAdapterError({
                code: 'sora_missing_id',
                message: 'Sora response did not include a video job id.',
                providerResponse: json
            });
        }

        return {
            providerJobId: json.id,
            status: normalizeStatus(json.status),
            progress: clampProgress(json.progress),
            rawResponse: json
        };
    },

    async poll(input: VideoAdapterPollInput, fetcher: VideoFetcher): Promise<VideoAdapterPollResult> {
        const url = `${resolveBaseUrl(input.endpoint.apiBaseUrl)}/videos/${encodeURIComponent(input.providerJobId)}`;
        const response = await fetcher(url, { method: 'GET' });
        const json = await readJsonOrError<{
            id?: string;
            status?: string;
            progress?: number;
            output?: { url?: string; expires_at?: number; thumbnail_url?: string } | null;
            error?: { code?: string; message?: string } | null;
            completed_at?: number;
        }>(response, 'Sora video poll failed.');

        const status = normalizeStatus(json.status);
        const result: VideoAdapterPollResult = {
            status,
            progress: clampProgress(json.progress),
            rawResponse: json
        };

        if (json.output) {
            if (typeof json.output.url === 'string') result.resultRemoteUrl = json.output.url;
            if (typeof json.output.thumbnail_url === 'string') {
                result.thumbnailRemoteUrl = json.output.thumbnail_url;
            }
            if (typeof json.output.expires_at === 'number') {
                result.resultRemoteUrlExpiresAt = json.output.expires_at * 1000;
            }
        }

        if (json.error) {
            if (typeof json.error.code === 'string') result.errorCode = json.error.code;
            if (typeof json.error.message === 'string') result.errorMessage = json.error.message;
        }

        return result;
    },

    async download(input: VideoAdapterDownloadInput, fetcher: VideoFetcher): Promise<Response> {
        if (input.resultRemoteUrl) {
            return fetcher(input.resultRemoteUrl, { method: 'GET' });
        }
        if (!input.providerJobId) {
            throw new VideoAdapterError({
                code: 'sora_missing_job_id',
                message: 'Sora download requires either resultRemoteUrl or providerJobId.'
            });
        }
        const url = `${resolveBaseUrl(input.endpoint.apiBaseUrl)}/videos/${encodeURIComponent(input.providerJobId)}/content`;
        return fetcher(url, { method: 'GET' });
    },

    async cancel(input: VideoAdapterCancelInput, fetcher: VideoFetcher): Promise<void> {
        const url = `${resolveBaseUrl(input.endpoint.apiBaseUrl)}/videos/${encodeURIComponent(input.providerJobId)}/cancel`;
        const response = await fetcher(url, { method: 'POST' });
        if (!response.ok && response.status !== 404) {
            const text = await response.text().catch(() => '');
            throw new VideoAdapterError({
                code: 'sora_cancel_failed',
                message: text || `Sora cancel failed with status ${response.status}.`,
                status: response.status
            });
        }
    }
};
