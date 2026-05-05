import type { ImageModelId } from '@/lib/model-registry';
import type { ProviderOptions } from '@/lib/provider-options';
import type { ImageBackground, ImageModeration, ImageOutputFormat, ImageQuality } from '@/types/history';

export type ProviderUsage = {
    input_tokens_details?: {
        text_tokens?: number;
        image_tokens?: number;
    };
    output_tokens?: number;
};

export type ProviderGeneratedImage = {
    b64_json?: string;
    path?: string;
    output_format: ImageOutputFormat;
};

export type ProviderImageResult = {
    images: ProviderGeneratedImage[];
    usage?: ProviderUsage;
};

export type ProviderConfig = {
    apiKey?: string;
    baseUrl?: string;
};

export type ProviderGenerateParams = {
    model: ImageModelId;
    prompt: string;
    n: number;
    size?: string;
    quality?: ImageQuality;
    output_format?: ImageOutputFormat;
    output_compression?: number;
    background?: ImageBackground;
    moderation?: ImageModeration;
    providerOptions?: ProviderOptions;
    signal?: AbortSignal;
};

export type ProviderEditParams = {
    model: ImageModelId;
    prompt: string;
    imageFiles: File[];
    maskFile?: File | null;
    n: number;
    size?: string;
    quality?: ImageQuality;
    providerOptions?: ProviderOptions;
    signal?: AbortSignal;
};
