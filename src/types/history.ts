import type { CostDetails, GptImageModel } from '@/lib/cost-utils';
import type { ProviderUsage } from '@/lib/provider-types';
import type {
    ImageToTextStructuredResult,
    VisionTextApiCompatibility,
    VisionTextDetail,
    VisionTextProviderKind,
    VisionTextResponseFormat,
    VisionTextTaskType
} from '@/lib/vision-text-types';

export type ImageQuality = 'low' | 'medium' | 'high' | 'auto';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';
export type ImageModeration = 'low' | 'auto';
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageStorageMode = 'fs' | 'indexeddb' | 'url';
export type HistoryImageSyncStatus = 'local_only' | 'pending_upload' | 'synced' | 'conflict';
export type VisionTextHistorySyncStatus = 'local_only' | 'pending_upload' | 'synced' | 'partial' | 'conflict';

export type HistoryImage = {
    filename: string;
    path?: string;
    size?: number;
    syncStatus?: HistoryImageSyncStatus;
};

export type HistoryMetadata = {
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: ImageStorageMode;
    durationMs: number;
    quality: ImageQuality;
    background: ImageBackground;
    moderation: ImageModeration;
    prompt: string;
    mode: 'generate' | 'edit';
    costDetails: CostDetails | null;
    output_format?: ImageOutputFormat;
    model?: GptImageModel;
};

export type VisionTextSourceImageRef = {
    filename: string;
    path?: string;
    storageModeUsed: ImageStorageMode;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    sha256?: string;
    source: 'uploaded' | 'clipboard' | 'history-image' | 'remote-url' | 'restored';
    syncStatus?: HistoryImageSyncStatus;
};

export type VisionTextHistoryMetadata = {
    id: string;
    type: 'image-to-text';
    timestamp: number;
    durationMs: number;
    prompt: string;
    taskType: VisionTextTaskType;
    detail: VisionTextDetail;
    responseFormat: VisionTextResponseFormat;
    structuredOutputEnabled: boolean;
    maxOutputTokens: number;
    sourceImages: VisionTextSourceImageRef[];
    resultText: string;
    structuredResult?: ImageToTextStructuredResult | null;
    providerKind: VisionTextProviderKind;
    providerInstanceId: string;
    providerInstanceName?: string;
    model: string;
    apiCompatibility: VisionTextApiCompatibility;
    usage?: ProviderUsage;
    syncStatus?: VisionTextHistorySyncStatus;
};

export type { ProviderUsage };
