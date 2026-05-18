import { formatApiError } from '@/lib/api-error';
import {
    VideoAdapterError,
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

const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com';

function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

function resolveBaseUrl(apiBaseUrl: string | undefined): string {
    const base = apiBaseUrl && apiBaseUrl.trim() ? apiBaseUrl.trim() : DEFAULT_DASHSCOPE_BASE_URL;
    return trimTrailingSlash(base);
}

function pickReferenceImage(
    sourceImages: readonly VideoAdapterSourceImage[],
    role: VideoAdapterSourceImage['role']
): VideoAdapterSourceImage | undefined {
    return sourceImages.find((image) => image.role === role);
}

function sourceImageToPublicUrl(image: VideoAdapterSourceImage | undefined): string | null {
    if (!image) return null;
    if (image.publicUrl) return image.publicUrl;
    return null;
}

function normalizeStatus(value: unknown): VideoGenerationStatus {
    if (typeof value !== 'string') return 'running';
    switch (value.toUpperCase()) {
        case 'PENDING':
        case 'QUEUED':
            return 'queued';
        case 'RUNNING':
        case 'PROCESSING':
        case 'IN_PROGRESS':
            return 'running';
        case 'SUCCEEDED':
        case 'SUCCESS':
            return 'succeeded';
        case 'FAILED':
        case 'ERROR':
            return 'failed';
        case 'CANCELED':
        case 'CANCELLED':
            return 'cancelled';
        case 'EXPIRED':
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
            code: 'wan_http_error',
            message: formatApiError(parsed ?? text, fallback),
            status: response.status,
            providerResponse: parsed ?? text
        });
    }
    return (await response.json()) as T;
}

type WanSubmitBody = {
    model: string;
    input: Record<string, unknown>;
    parameters: Record<string, unknown>;
};

function buildSubmitBody(input: VideoAdapterSubmitInput): WanSubmitBody {
    const modelId = input.catalogEntry.rawModelId;
    const wanInput: Record<string, unknown> = { prompt: input.prompt };

    if (input.negativePrompt) wanInput.negative_prompt = input.negativePrompt;

    if (input.taskMode === 'image-to-video') {
        const startFrame = sourceImageToPublicUrl(pickReferenceImage(input.sourceImages, 'start_frame'));
        const endFrame = sourceImageToPublicUrl(pickReferenceImage(input.sourceImages, 'end_frame'));
        const reference = sourceImageToPublicUrl(pickReferenceImage(input.sourceImages, 'reference'));
        const fallback = sourceImageToPublicUrl(input.sourceImages[0]);

        const firstFrame = startFrame ?? reference ?? fallback;
        if (!firstFrame) {
            throw new VideoAdapterError({
                code: 'wan_missing_public_url',
                message: 'Wan image-to-video requires a public HTTPS image URL. Use the desktop app or your object storage to expose the source image first.'
            });
        }
        wanInput.img_url = firstFrame;
        if (endFrame) wanInput.last_frame_img_url = endFrame;
    }

    const parameters: Record<string, unknown> = {};
    if (input.parameters.size) parameters.size = input.parameters.size;
    if (input.parameters.aspectRatio) parameters.aspect_ratio = input.parameters.aspectRatio;
    if (input.parameters.durationSeconds !== undefined) parameters.duration = input.parameters.durationSeconds;
    if (input.parameters.frameRate !== undefined) parameters.fps = input.parameters.frameRate;
    if (input.parameters.seed !== undefined) parameters.seed = input.parameters.seed;
    if (input.parameters.promptEnhanceEnabled !== undefined) {
        parameters.prompt_extend = input.parameters.promptEnhanceEnabled;
    }
    if (input.parameters.nativeAudioEnabled !== undefined) {
        parameters.audio = input.parameters.nativeAudioEnabled;
    }
    if (input.parameters.watermarkEnabled !== undefined) {
        parameters.watermark = input.parameters.watermarkEnabled;
    }

    return {
        model: modelId,
        input: wanInput,
        parameters
    };
}

function resolveSubmitPath(modelId: string, taskMode: VideoAdapterSubmitInput['taskMode']): string {
    if (taskMode === 'image-to-video') {
        return '/api/v1/services/aigc/image2video/video-synthesis';
    }
    if (modelId.toLowerCase().includes('-r2v') || modelId.toLowerCase().includes('reference')) {
        return '/api/v1/services/aigc/reference2video/video-synthesis';
    }
    return '/api/v1/services/aigc/text2video/video-synthesis';
}

export const dashscopeVideoAdapter: VideoProviderAdapter = {
    protocol: 'dashscope-video-generation',
    displayName: 'Aliyun Wan (DashScope)',

    async submit(input: VideoAdapterSubmitInput, fetcher: VideoFetcher): Promise<VideoAdapterSubmitResult> {
        const path = resolveSubmitPath(input.catalogEntry.rawModelId, input.taskMode);
        const url = `${resolveBaseUrl(input.endpoint.apiBaseUrl)}${path}`;
        const body = buildSubmitBody(input);

        const response = await fetcher(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable'
            },
            body: JSON.stringify(body)
        });
        const json = await readJsonOrError<{
            request_id?: string;
            output?: { task_id?: string; task_status?: string; progress?: number } | null;
            code?: string;
            message?: string;
        }>(response, 'Wan video submit failed.');

        const taskId = json.output?.task_id;
        if (!taskId) {
            throw new VideoAdapterError({
                code: 'wan_missing_task_id',
                message: json.message || 'Wan response did not include a task id.',
                providerResponse: json
            });
        }

        return {
            providerJobId: taskId,
            status: normalizeStatus(json.output?.task_status),
            progress: clampProgress(json.output?.progress),
            providerRequestId: json.request_id,
            rawResponse: json
        };
    },

    async poll(input: VideoAdapterPollInput, fetcher: VideoFetcher): Promise<VideoAdapterPollResult> {
        const url = `${resolveBaseUrl(input.endpoint.apiBaseUrl)}/api/v1/tasks/${encodeURIComponent(input.providerJobId)}`;
        const response = await fetcher(url, { method: 'GET' });
        const json = await readJsonOrError<{
            request_id?: string;
            output?: {
                task_id?: string;
                task_status?: string;
                progress?: number;
                video_url?: string;
                cover_url?: string;
                end_time?: string;
                results?: Array<{ url?: string; cover_url?: string }>;
                error_code?: string;
                error_message?: string;
            } | null;
            code?: string;
            message?: string;
        }>(response, 'Wan video poll failed.');

        const status = normalizeStatus(json.output?.task_status);
        const result: VideoAdapterPollResult = {
            status,
            progress: clampProgress(json.output?.progress),
            rawResponse: json
        };

        if (json.output) {
            const directUrl = json.output.video_url;
            const firstResultUrl = json.output.results?.[0]?.url;
            const resultRemoteUrl = directUrl ?? firstResultUrl;
            if (resultRemoteUrl) result.resultRemoteUrl = resultRemoteUrl;

            const thumbnail = json.output.cover_url ?? json.output.results?.[0]?.cover_url;
            if (thumbnail) result.thumbnailRemoteUrl = thumbnail;

            if (typeof json.output.error_code === 'string') result.errorCode = json.output.error_code;
            if (typeof json.output.error_message === 'string') result.errorMessage = json.output.error_message;
        }

        if (json.code && status === 'failed') {
            result.errorCode = result.errorCode ?? json.code;
            result.errorMessage = result.errorMessage ?? json.message;
        }

        return result;
    },

    async download(input: VideoAdapterDownloadInput, fetcher: VideoFetcher): Promise<Response> {
        if (!input.resultRemoteUrl) {
            throw new VideoAdapterError({
                code: 'wan_missing_url',
                message: 'Wan download requires the resultRemoteUrl returned by poll.'
            });
        }
        return fetcher(input.resultRemoteUrl, { method: 'GET' });
    }
};
