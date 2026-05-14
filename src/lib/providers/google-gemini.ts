import { GEMINI_NANO_BANANA_2_MODEL } from '@/lib/model-registry';
import { GEMINI_SIZE_OPTIONS } from '@/lib/provider-advanced-options';
import type {
    ProviderConfig,
    ProviderEditParams,
    ProviderGenerateParams,
    ProviderImageResult
} from '@/lib/provider-types';
import type { ImageOutputFormat } from '@/types/history';

type GeminiInlineData = {
    mimeType?: string;
    data?: string;
};

type GeminiPart = {
    text?: string;
    inlineData?: GeminiInlineData;
};

type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: GeminiPart[];
        };
        finishReason?: string;
    }>;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
};

type GeminiImageConfig = {
    aspectRatio: string;
    imageSize: string;
};

function mimeTypeToOutputFormat(mimeType?: string): ImageOutputFormat {
    if (mimeType === 'image/jpeg') return 'jpeg';
    if (mimeType === 'image/webp') return 'webp';
    return 'png';
}

function splitDataUrl(value: string): { mimeType: string; data: string } {
    const match = value.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) return { mimeType: 'image/png', data: value };
    return { mimeType: match[1], data: match[2] };
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(arrayBuffer).toString('base64');
    }

    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

const GEMINI_IMAGE_CONFIG_BY_SIZE = new Map<string, GeminiImageConfig>(
    GEMINI_SIZE_OPTIONS.flatMap((option) =>
        option.tier && option.ratio ? [[option.value, { aspectRatio: option.ratio, imageSize: option.tier }]] : []
    )
);

const GEMINI_LEGACY_IMAGE_CONFIG_BY_SIZE = new Map<string, GeminiImageConfig>([
    ['1536x1024', { aspectRatio: '3:2', imageSize: '1K' }],
    ['1024x1536', { aspectRatio: '2:3', imageSize: '1K' }],
    ['3072x2048', { aspectRatio: '3:2', imageSize: '2K' }],
    ['2048x3072', { aspectRatio: '2:3', imageSize: '2K' }]
]);

function sizeToImageConfig(size?: string): GeminiImageConfig | undefined {
    if (!size || size === 'auto') return undefined;

    return GEMINI_IMAGE_CONFIG_BY_SIZE.get(size) ?? GEMINI_LEGACY_IMAGE_CONFIG_BY_SIZE.get(size);
}

async function fileToInlineData(file: File): Promise<GeminiInlineData> {
    const arrayBuffer = await file.arrayBuffer();
    return {
        mimeType: file.type || 'image/png',
        data: arrayBufferToBase64(arrayBuffer)
    };
}

function toGeminiUsage(response: GeminiResponse) {
    const usage = response.usageMetadata;
    if (!usage) return undefined;

    return {
        input_tokens_details: {
            text_tokens: usage.promptTokenCount ?? 0,
            image_tokens: 0
        },
        output_tokens:
            usage.candidatesTokenCount ?? Math.max(0, (usage.totalTokenCount ?? 0) - (usage.promptTokenCount ?? 0))
    };
}

function extractImages(response: GeminiResponse): ProviderImageResult {
    const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
    const images = parts
        .map((part) => part.inlineData)
        .filter((inlineData): inlineData is GeminiInlineData => Boolean(inlineData?.data))
        .map((inlineData) => ({
            b64_json: splitDataUrl(inlineData.data || '').data,
            output_format: mimeTypeToOutputFormat(inlineData.mimeType)
        }));

    if (images.length === 0) {
        const finishReason = response.candidates?.[0]?.finishReason;
        throw new Error(
            finishReason
                ? `Gemini did not return image data. Finish reason: ${finishReason}`
                : 'Gemini did not return image data.'
        );
    }

    return {
        images,
        usage: toGeminiUsage(response)
    };
}

async function callGeminiGenerateContent(
    parts: GeminiPart[],
    config: ProviderConfig,
    params: ProviderGenerateParams | ProviderEditParams
): Promise<ProviderImageResult> {
    if (!config.apiKey) {
        throw new Error('Gemini Nano Banana 2 requires GEMINI_API_KEY or a Gemini API Key in settings.');
    }

    const model = params.model || GEMINI_NANO_BANANA_2_MODEL;
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent`;
    const imageConfig = 'size' in params ? sizeToImageConfig(params.size) : undefined;
    const generationConfig = {
        responseModalities: ['IMAGE'],
        ...(imageConfig ? { responseFormat: { image: imageConfig } } : {})
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': config.apiKey
        },
        body: JSON.stringify({
            contents: [{ parts }],
            generationConfig
        }),
        signal: params.signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini image request failed (${response.status}): ${errorText}`);
    }

    const json = (await response.json()) as GeminiResponse;
    return extractImages(json);
}

export async function generateGeminiImage(
    params: ProviderGenerateParams,
    config: ProviderConfig
): Promise<ProviderImageResult> {
    return callGeminiGenerateContent([{ text: params.prompt }], config, params);
}

export async function editGeminiImage(
    params: ProviderEditParams,
    config: ProviderConfig
): Promise<ProviderImageResult> {
    const inlineImages = await Promise.all(params.imageFiles.map(fileToInlineData));
    return callGeminiGenerateContent(
        [{ text: params.prompt }, ...inlineImages.map((inlineData) => ({ inlineData }))],
        config,
        params
    );
}
