import {
    VideoAdapterError,
    type VideoAdapterPollResult,
    type VideoAdapterSubmitResult,
    type VideoProviderAdapter
} from '@/lib/video-providers/adapter';
import type { ProviderProtocol } from '@/lib/provider-model-catalog';

function unimplemented(protocol: ProviderProtocol, operation: string): never {
    throw new VideoAdapterError({
        code: 'adapter_implementation_pending',
        message: `Video adapter for protocol "${protocol}" is registered but its ${operation} implementation is pending. ` +
            `The shape mirrors the openai-videos and dashscope-video-generation reference adapters; see ` +
            `docs/requirements/VIDEO_GENERATION_REQUIREMENTS.md for the protocol-specific endpoints and payload fields.`
    });
}

function buildPlaceholderAdapter(protocol: ProviderProtocol, displayName: string): VideoProviderAdapter {
    return {
        protocol,
        displayName,
        async submit(): Promise<VideoAdapterSubmitResult> {
            unimplemented(protocol, 'submit');
        },
        async poll(): Promise<VideoAdapterPollResult> {
            unimplemented(protocol, 'poll');
        },
        async download(): Promise<Response> {
            unimplemented(protocol, 'download');
        },
        async cancel(): Promise<void> {
            unimplemented(protocol, 'cancel');
        }
    };
}

export const geminiGenerateVideosAdapter = buildPlaceholderAdapter(
    'gemini-generate-videos',
    'Google Veo (Gemini API)'
);

export const vertexAiVeoAdapter = buildPlaceholderAdapter(
    'vertex-ai-veo',
    'Google Veo (Vertex AI)'
);

export const runwayApiV1Adapter = buildPlaceholderAdapter(
    'runway-api-v1',
    'Runway Gen 4.x'
);

export const lumaDreamMachineAdapter = buildPlaceholderAdapter(
    'luma-dream-machine',
    'Luma Dream Machine'
);

export const minimaxVideoAdapter = buildPlaceholderAdapter(
    'minimax-video',
    'MiniMax Hailuo'
);

export const klingApiAdapter = buildPlaceholderAdapter(
    'kling-api',
    'Kuaishou Kling'
);

export const modelarkVideoGenerationAdapter = buildPlaceholderAdapter(
    'modelark-video-generation',
    'ByteDance Seedance (ModelArk)'
);

export const tencentVclmAdapter = buildPlaceholderAdapter(
    'tencent-vclm',
    'Tencent Hunyuan/Yt-Video VCLM'
);

export const tencentTokenhubVideoAdapter = buildPlaceholderAdapter(
    'tencent-tokenhub-video',
    'Tencent TokenHub Video'
);

export const falModelApiAdapter = buildPlaceholderAdapter(
    'fal-model-api',
    'fal.ai (Happy Horse, Pika, etc.)'
);

export const xaiImagineVideoAdapter = buildPlaceholderAdapter(
    'xai-imagine-video',
    'xAI Grok Imagine'
);

export const PLACEHOLDER_VIDEO_ADAPTERS: ReadonlyArray<VideoProviderAdapter> = [
    geminiGenerateVideosAdapter,
    vertexAiVeoAdapter,
    runwayApiV1Adapter,
    lumaDreamMachineAdapter,
    minimaxVideoAdapter,
    klingApiAdapter,
    modelarkVideoGenerationAdapter,
    tencentVclmAdapter,
    tencentTokenhubVideoAdapter,
    falModelApiAdapter,
    xaiImagineVideoAdapter
];
