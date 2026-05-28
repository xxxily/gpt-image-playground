import type { AppConfig } from '@/lib/config';
import {
    isPendingVideoPlaceholderEntry,
    resolveDefaultModelCatalogEntry
} from '@/lib/provider-model-catalog';
import { normalizeVideoGenerationParameters, type VideoSourceAssetRef } from '@/lib/video-types';

export function buildVideoSourceRole(
    taskMode: 'text-to-video' | 'image-to-video',
    index: number
): VideoSourceAssetRef['role'] {
    if (taskMode === 'image-to-video') {
        if (index === 0) return 'start_frame';
        if (index === 1) return 'end_frame';
        return 'reference';
    }
    return 'reference';
}

export function pickVideoDefaultCatalogEntry(
    cfg: AppConfig,
    taskMode: 'text-to-video' | 'image-to-video',
    providerEndpointId?: string
) {
    const preferredTask = taskMode === 'image-to-video' ? 'video.imageToVideo' : 'video.generate';
    const preferredEntry = resolveDefaultModelCatalogEntry(cfg, preferredTask);
    const providerEntry = providerEndpointId
        ? cfg.modelCatalog?.find(
              (entry) =>
                  entry.providerEndpointId === providerEndpointId &&
                  entry.enabled !== false &&
                  entry.capabilities.tasks.includes(preferredTask) &&
                  !isPendingVideoPlaceholderEntry(entry)
          )
        : null;
    return (
        providerEntry ||
        preferredEntry ||
        resolveDefaultModelCatalogEntry(cfg, 'video.generate') ||
        resolveDefaultModelCatalogEntry(cfg, 'video.imageToVideo') ||
        null
    );
}

export function buildVideoGenerationParametersFromDefaults(
    cfg: AppConfig,
    taskMode: 'text-to-video' | 'image-to-video'
): ReturnType<typeof normalizeVideoGenerationParameters> {
    const defaults = cfg.videoTaskDefaults;
    return normalizeVideoGenerationParameters({
        durationSeconds: defaults.defaultDurationSeconds,
        aspectRatio: defaults.defaultAspectRatio,
        resolutionTier: defaults.defaultResolutionTier,
        promptEnhanceEnabled: defaults.defaultPromptEnhanceEnabled,
        nativeAudioEnabled: defaults.defaultNativeAudioEnabled,
        count: 1,
        ...(taskMode === 'image-to-video' ? { watermarkEnabled: false } : {})
    });
}
