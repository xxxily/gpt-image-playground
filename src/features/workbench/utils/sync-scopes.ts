import type { AppConfig } from '@/lib/config';
import { buildBasePrefix, type SyncAutoSyncScopes, type SyncDebugEntry, type SyncProviderConfig } from '@/lib/sync';

const EMPTY_AUTO_SYNC_SCOPES: SyncAutoSyncScopes = {
    appConfig: false,
    polishingPrompts: false,
    promptHistory: false,
    promptTemplates: false,
    imageHistory: false,
    imageBlobs: false,
    visionTextHistory: false,
    visionTextSourceImages: false,
    videoHistory: false,
    videoSourceImages: false,
    videoThumbnails: false,
    videoFiles: false
};

export const POLISHING_PROMPT_CONFIG_KEYS = new Set<keyof AppConfig>([
    'polishingPrompt',
    'polishingPresetId',
    'polishingCustomPrompts',
    'polishPickerOrder'
]);

export function createEmptyAutoSyncScopes(): SyncAutoSyncScopes {
    return { ...EMPTY_AUTO_SYNC_SCOPES };
}

export function hasAnyAutoSyncScope(scopes: SyncAutoSyncScopes): boolean {
    return Object.values(scopes).some(Boolean);
}

export function intersectAutoSyncScopes(
    requested: Partial<SyncAutoSyncScopes>,
    enabled: SyncAutoSyncScopes
): SyncAutoSyncScopes {
    return {
        appConfig: Boolean(requested.appConfig && enabled.appConfig),
        polishingPrompts: Boolean(requested.polishingPrompts && enabled.polishingPrompts),
        promptHistory: Boolean(requested.promptHistory && enabled.promptHistory),
        promptTemplates: Boolean(requested.promptTemplates && enabled.promptTemplates),
        imageHistory: Boolean(requested.imageHistory && enabled.imageHistory),
        imageBlobs: Boolean(requested.imageBlobs && enabled.imageBlobs),
        visionTextHistory: Boolean(requested.visionTextHistory && enabled.visionTextHistory),
        visionTextSourceImages: Boolean(requested.visionTextSourceImages && enabled.visionTextSourceImages),
        videoHistory: Boolean(requested.videoHistory && enabled.videoHistory),
        videoSourceImages: Boolean(requested.videoSourceImages && enabled.videoSourceImages),
        videoThumbnails: Boolean(requested.videoThumbnails && enabled.videoThumbnails),
        videoFiles: Boolean(requested.videoFiles && enabled.videoFiles)
    };
}

export function mergeAutoSyncScopes(current: SyncAutoSyncScopes, incoming: SyncAutoSyncScopes): SyncAutoSyncScopes {
    return {
        appConfig: current.appConfig || incoming.appConfig,
        polishingPrompts: current.polishingPrompts || incoming.polishingPrompts,
        promptHistory: current.promptHistory || incoming.promptHistory,
        promptTemplates: current.promptTemplates || incoming.promptTemplates,
        imageHistory: current.imageHistory || incoming.imageHistory,
        imageBlobs: current.imageBlobs || incoming.imageBlobs,
        visionTextHistory: current.visionTextHistory || incoming.visionTextHistory,
        visionTextSourceImages: current.visionTextSourceImages || incoming.visionTextSourceImages,
        videoHistory: current.videoHistory || incoming.videoHistory,
        videoSourceImages: current.videoSourceImages || incoming.videoSourceImages,
        videoThumbnails: current.videoThumbnails || incoming.videoThumbnails,
        videoFiles: current.videoFiles || incoming.videoFiles
    };
}

export function formatImageSyncScopeLabel(since?: number): string {
    if (since === undefined) return '全部历史图片';

    const elapsedMs = Math.max(0, Date.now() - since);
    const elapsedHours = Math.max(1, Math.round(elapsedMs / 3600000));
    if (elapsedHours < 24) return `最近 ${elapsedHours} 小时图片`;

    const elapsedDays = Math.max(1, Math.round(elapsedHours / 24));
    return `最近 ${elapsedDays} 天图片`;
}

export function formatVisionTextSyncScopeLabel(since?: number): string {
    if (since === undefined) return '全部图生文';

    const elapsedMs = Math.max(0, Date.now() - since);
    const elapsedHours = Math.max(1, Math.round(elapsedMs / 3600000));
    if (elapsedHours < 24) return `最近 ${elapsedHours} 小时图生文`;

    const elapsedDays = Math.max(1, Math.round(elapsedHours / 24));
    return `最近 ${elapsedDays} 天图生文`;
}

export function formatFullHistorySyncScopeLabel(since?: number): string {
    if (since === undefined) return '全部历史';

    const elapsedMs = Math.max(0, Date.now() - since);
    const elapsedHours = Math.max(1, Math.round(elapsedMs / 3600000));
    if (elapsedHours < 24) return `最近 ${elapsedHours} 小时历史`;

    const elapsedDays = Math.max(1, Math.round(elapsedHours / 24));
    return `最近 ${elapsedDays} 天历史`;
}

export function getLatestSyncManifestKey(config: SyncProviderConfig): string {
    return `${buildBasePrefix(config.s3.profileId, config.s3.prefix)}/manifest.json`;
}

export function createSyncDebugEntry(step: string, message: string, startedAt: number): SyncDebugEntry {
    const at = Date.now();
    return { at, step, message, elapsedMs: at - startedAt };
}
