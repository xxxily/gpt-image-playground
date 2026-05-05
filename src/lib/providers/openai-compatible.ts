import OpenAI from 'openai';
import { formatApiError, hasApiErrorPayload } from '@/lib/api-error';
import type { ProviderConfig, ProviderEditParams, ProviderGenerateParams, ProviderImageResult } from '@/lib/provider-types';
import { mergeRequestParams, type ProviderOptions } from '@/lib/provider-options';
import type { ImageOutputFormat } from '@/types/history';

export type OpenAICompatibleProviderDefaults = {
    providerLabel: string;
    defaultBaseUrl: string;
    missingApiKeyMessage: string;
    defaultGenerateParams?: ProviderOptions;
    defaultEditParams?: ProviderOptions;
    editRequestMode?: 'edits-multipart' | 'generations-json';
    defaultOutputFormat?: ImageOutputFormat;
    maxImages?: number;
};

type OpenAIImageData = {
    b64_json?: string | null;
    url?: string | null;
};

type OpenAIImageResponse = {
    data?: OpenAIImageData[] | null;
    usage?: OpenAI.Images.ImagesResponse['usage'];
};

function createClient(config: ProviderConfig, defaults: OpenAICompatibleProviderDefaults): OpenAI {
    if (!config.apiKey) {
        throw new Error(defaults.missingApiKeyMessage);
    }

    return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || defaults.defaultBaseUrl,
        dangerouslyAllowBrowser: true
    });
}

function clampImageCount(n: number, maxImages = 10): number {
    return Math.max(1, Math.min(n || 1, maxImages));
}

function normalizeImages(data: OpenAIImageData[], outputFormat: ImageOutputFormat): ProviderImageResult['images'] {
    return data
        .map((image): ProviderImageResult['images'][number] | null => {
            if (image.b64_json) {
                return { b64_json: image.b64_json, output_format: outputFormat };
            }
            if (image.url) {
                return { path: image.url, output_format: outputFormat };
            }
            return null;
        })
        .filter((image): image is ProviderImageResult['images'][number] => image !== null);
}

function providerOutputFormat(options: ProviderOptions | undefined, fallback: ImageOutputFormat): ImageOutputFormat {
    const outputFormat = options?.output_format;
    return outputFormat === 'png' || outputFormat === 'jpeg' || outputFormat === 'webp' ? outputFormat : fallback;
}

function isFileLike(value: unknown): value is File {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { arrayBuffer?: unknown; type?: unknown; name?: unknown };
    return typeof candidate.arrayBuffer === 'function' && typeof candidate.type === 'string' && typeof candidate.name === 'string';
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, bytes.length);
        let chunk = '';
        for (let index = offset; index < end; index += 1) {
            chunk += String.fromCharCode(bytes[index]);
        }
        binary += chunk;
    }

    return btoa(binary);
}

async function fileToDataUri(file: File): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type.trim() || 'application/octet-stream';
    return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

async function createJsonImageInput(files: File[]): Promise<string | string[]> {
    const images = await Promise.all(files.map(fileToDataUri));
    return images.length === 1 ? images[0] : images;
}

async function normalizeJsonGenerationsImageInput(value: unknown, fallbackFiles: File[]): Promise<string | string[]> {
    if (typeof value === 'string') return value;
    if (isStringArray(value)) return value.length === 1 ? value[0] : value;

    if (Array.isArray(value) && value.every(isFileLike)) {
        return createJsonImageInput(value);
    }

    return createJsonImageInput(fallbackFiles);
}

async function createJsonGenerationsEditParams(
    params: ProviderEditParams,
    requestParams: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const jsonParams = { ...requestParams };
    delete jsonParams.mask;
    return {
        ...jsonParams,
        image: await normalizeJsonGenerationsImageInput(jsonParams.image, params.imageFiles)
    };
}

function assertImagesResponse(response: OpenAIImageResponse, providerLabel: string): OpenAIImageResponse & { data: OpenAIImageData[] } {
    if (hasApiErrorPayload(response)) {
        throw new Error(formatApiError(response));
    }
    if (!Array.isArray(response.data) || response.data.length === 0) {
        throw new Error(`${providerLabel} 响应中没有有效的图片数据。`);
    }
    return { ...response, data: response.data };
}

export async function generateOpenAICompatibleImage(
    params: ProviderGenerateParams,
    config: ProviderConfig,
    defaults: OpenAICompatibleProviderDefaults
): Promise<ProviderImageResult> {
    const client = createClient(config, defaults);
    const outputFormat = providerOutputFormat(params.providerOptions, defaults.defaultOutputFormat ?? params.output_format ?? 'png');
    const requestParams = mergeRequestParams(
        defaults.defaultGenerateParams,
        {
            model: params.model,
            prompt: params.prompt,
            n: clampImageCount(params.n, defaults.maxImages),
            size: params.size ?? 'auto'
        },
        params.providerOptions
    ) as unknown as OpenAI.Images.ImageGenerateParamsNonStreaming;

    const response = assertImagesResponse(await client.images.generate(requestParams), defaults.providerLabel);
    return {
        images: normalizeImages(response.data, outputFormat),
        usage: response.usage
    };
}

export async function editOpenAICompatibleImage(
    params: ProviderEditParams,
    config: ProviderConfig,
    defaults: OpenAICompatibleProviderDefaults
): Promise<ProviderImageResult> {
    if (params.imageFiles.length === 0) {
        throw new Error('编辑模式至少需要一张图片。');
    }

    const client = createClient(config, defaults);
    const requestParams = mergeRequestParams(
        defaults.defaultEditParams,
        {
            model: params.model,
            prompt: params.prompt,
            image: params.imageFiles,
            n: clampImageCount(params.n, defaults.maxImages),
            size: params.size === 'auto' ? undefined : params.size,
            ...(params.maskFile ? { mask: params.maskFile } : {})
        },
        params.providerOptions
    );

    const response = defaults.editRequestMode === 'generations-json'
        ? assertImagesResponse(
            await client.post<OpenAIImageResponse>('/images/generations', {
                body: await createJsonGenerationsEditParams(params, requestParams)
            }),
            defaults.providerLabel
        )
        : assertImagesResponse(
            await client.images.edit(requestParams as unknown as OpenAI.Images.ImageEditParamsNonStreaming),
            defaults.providerLabel
        );
    return {
        images: normalizeImages(response.data, providerOutputFormat(params.providerOptions, defaults.defaultOutputFormat ?? 'png')),
        usage: response.usage
    };
}
