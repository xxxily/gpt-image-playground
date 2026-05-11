import type { CostDetails, GptImageModel } from '@/lib/cost-utils';
import type { ProviderUsage } from '@/lib/provider-types';

export type ImageQuality = 'low' | 'medium' | 'high' | 'auto';
export type ImageBackground = 'transparent' | 'opaque' | 'auto';
export type ImageModeration = 'low' | 'auto';
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageStorageMode = 'fs' | 'indexeddb' | 'url';
export type HistoryImageSyncStatus = 'local_only' | 'pending_upload' | 'synced' | 'conflict';

export type HistoryImage = {
    filename: string;
    path?: string;
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

export type { ProviderUsage };
