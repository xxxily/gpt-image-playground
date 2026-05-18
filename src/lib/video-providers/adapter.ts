import type { ModelCatalogEntry, ProviderEndpoint, ProviderProtocol } from '@/lib/provider-model-catalog';
import type {
    VideoGenerationParameters,
    VideoGenerationStatus,
    VideoSourceImageRole
} from '@/lib/video-types';

export type VideoAdapterSourceImage = {
    filename: string;
    mimeType: string;
    role: VideoSourceImageRole;
    bytes?: Uint8Array;
    base64?: string;
    publicUrl?: string;
};

export type VideoAdapterSubmitInput = {
    endpoint: ProviderEndpoint;
    catalogEntry: ModelCatalogEntry;
    taskMode: 'text-to-video' | 'image-to-video';
    prompt: string;
    negativePrompt?: string;
    parameters: VideoGenerationParameters;
    sourceImages: VideoAdapterSourceImage[];
    callbackUrl?: string;
};

export type VideoAdapterSubmitResult = {
    providerJobId: string;
    providerRequestId?: string;
    status: VideoGenerationStatus;
    progress?: number;
    rawResponse?: unknown;
};

export type VideoAdapterPollInput = {
    endpoint: ProviderEndpoint;
    catalogEntry?: ModelCatalogEntry;
    providerJobId: string;
};

export type VideoAdapterPollResult = {
    status: VideoGenerationStatus;
    progress?: number;
    resultRemoteUrl?: string;
    resultRemoteUrlExpiresAt?: number;
    thumbnailRemoteUrl?: string;
    errorCode?: string;
    errorMessage?: string;
    rawResponse?: unknown;
};

export type VideoAdapterDownloadInput = {
    endpoint: ProviderEndpoint;
    providerJobId?: string;
    resultRemoteUrl?: string;
};

export type VideoAdapterCancelInput = {
    endpoint: ProviderEndpoint;
    providerJobId: string;
};

export type VideoFetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type VideoProviderAdapter = {
    readonly protocol: ProviderProtocol;
    readonly displayName: string;
    submit(input: VideoAdapterSubmitInput, fetcher: VideoFetcher): Promise<VideoAdapterSubmitResult>;
    poll(input: VideoAdapterPollInput, fetcher: VideoFetcher): Promise<VideoAdapterPollResult>;
    download(input: VideoAdapterDownloadInput, fetcher: VideoFetcher): Promise<Response>;
    cancel?(input: VideoAdapterCancelInput, fetcher: VideoFetcher): Promise<void>;
};

export class VideoAdapterError extends Error {
    readonly code: string;
    readonly status?: number;
    readonly providerResponse?: unknown;

    constructor(options: {
        code: string;
        message: string;
        status?: number;
        providerResponse?: unknown;
    }) {
        super(options.message);
        this.name = 'VideoAdapterError';
        this.code = options.code;
        this.status = options.status;
        this.providerResponse = options.providerResponse;
    }
}
