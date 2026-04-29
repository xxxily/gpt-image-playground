import { GEMINI_NANO_BANANA_2_MODEL } from '@/lib/model-registry';
import type { ProviderConfig, ProviderEditParams, ProviderGenerateParams, ProviderImageResult } from '@/lib/provider-types';
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

function sizeToImageConfig(size?: string) {
    if (!size || size === 'auto') return undefined;

    const ratioMap: Record<string, string> = {
        '1024x1024': '1:1',
        '2048x2048': '1:1',
        '1536x1024': '3:2',
        '3072x2048': '3:2',
        '1024x1536': '2:3',
        '2048x3072': '2:3'
    };

    const aspectRatio = ratioMap[size];
    return aspectRatio ? { aspectRatio } : undefined;
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
        output_tokens: usage.candidatesTokenCount ?? Math.max(0, (usage.totalTokenCount ?? 0) - (usage.promptTokenCount ?? 0))
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
        throw new Error(finishReason ? `Gemini did not return image data. Finish reason: ${finishReason}` : 'Gemini did not return image data.');
    }

    return {
        images,
        usage: toGeminiUsage(response)
    };
}

async function callGeminiGenerateContent(parts: GeminiPart[], config: ProviderConfig, params: ProviderGenerateParams | ProviderEditParams): Promise<ProviderImageResult> {
    if (!config.apiKey) {
        throw new Error('Gemini Nano Banana 2 requires GEMINI_API_KEY or a Gemini API Key in settings.');
    }

    const model = params.model || GEMINI_NANO_BANANA_2_MODEL;
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent`;
    const imageConfig = 'size' in params ? sizeToImageConfig(params.size) : undefined;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': config.apiKey
        },
        body: JSON.stringify({
            contents: [{ parts }],
            ...(imageConfig ? { generationConfig: { imageConfig } } : {})
        }),
        signal: params.signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini image request failed (${response.status}): ${errorText}`);
    }

    const json = await response.json() as GeminiResponse;
    return extractImages(json);
}

export async function generateGeminiImage(params: ProviderGenerateParams, config: ProviderConfig): Promise<ProviderImageResult> {
    return callGeminiGenerateContent([{ text: params.prompt }], config, params);
}

export async function editGeminiImage(params: ProviderEditParams, config: ProviderConfig): Promise<ProviderImageResult> {
    const inlineImages = await Promise.all(params.imageFiles.map(fileToInlineData));
    return callGeminiGenerateContent(
        [
            { text: params.prompt },
            ...inlineImages.map((inlineData) => ({ inlineData }))
        ],
        config,
        params
    );
}
