import type { BatchPlanningStrategyId } from '@/lib/batch-config';
import { PROMPT_TOOLBAR_BUTTON_IDS, type PromptToolbarButtonId } from '@/lib/config';
import type { ModelTaskCapability } from '@/lib/provider-model-catalog';
import type { SyncAutoSyncScopes } from '@/lib/sync';
import type { VideoSyncOptions } from '@/lib/video-types';

export type UnifiedTaskDefaultTask = ModelTaskCapability;

export const AUTO_SYNC_SCOPE_OPTIONS: Array<{ key: keyof SyncAutoSyncScopes; label: string; description: string }> = [
    { key: 'appConfig', label: '应用配置', description: '模型、接口、存储方式等非敏感设置。' },
    { key: 'polishingPrompts', label: '自定义润色提示词', description: '润色系统提示词、预设和自定义润色提示词。' },
    { key: 'promptHistory', label: '提示词历史', description: '输入过的提示词记录。' },
    { key: 'promptTemplates', label: '提示词库', description: '用户自定义提示词模板。' },
    { key: 'imageHistory', label: '生成历史记录', description: '历史条目、提示词、参数和图片文件名。' },
    { key: 'imageBlobs', label: '历史图片文件', description: '只上传新增或变化的历史图片文件。' },
    { key: 'visionTextHistory', label: '图生文历史记录', description: '图生文结果、参数和源图文件名。' },
    { key: 'visionTextSourceImages', label: '图生文源图文件', description: '只上传新增或变化的图生文源图。' }
];

export const PROMPT_TOOLBAR_BUTTON_OPTIONS: Array<{ key: PromptToolbarButtonId; labelKey: string }> =
    PROMPT_TOOLBAR_BUTTON_IDS.map((key) => ({
        key,
        labelKey: `settings.promptToolbar.${key}`
    }));

export const TASK_DEFAULT_ROW_CONFIGS: Array<{
    task: UnifiedTaskDefaultTask;
    titleKey: string;
    descriptionKey: string;
}> = [
    {
        task: 'image.generate',
        titleKey: 'settings.taskDefaults.imageGenerate.title',
        descriptionKey: 'settings.taskDefaults.imageGenerate.description'
    },
    {
        task: 'image.edit',
        titleKey: 'settings.taskDefaults.imageEdit.title',
        descriptionKey: 'settings.taskDefaults.imageEdit.description'
    },
    {
        task: 'vision.text',
        titleKey: 'settings.taskDefaults.visionText.title',
        descriptionKey: 'settings.taskDefaults.visionText.description'
    },
    {
        task: 'video.generate',
        titleKey: 'settings.taskDefaults.videoGenerate.title',
        descriptionKey: 'settings.taskDefaults.videoGenerate.description'
    },
    {
        task: 'video.imageToVideo',
        titleKey: 'settings.taskDefaults.videoImageToVideo.title',
        descriptionKey: 'settings.taskDefaults.videoImageToVideo.description'
    }
];

export const VIDEO_ASPECT_RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
export const VIDEO_RESOLUTION_TIER_OPTIONS = ['480p', '720p', '1080p', '4k'] as const;
export const VIDEO_SYNC_OPTION_CONFIGS: Array<{
    key: keyof Pick<VideoSyncOptions, 'videoHistory' | 'videoSourceImages' | 'videoThumbnails' | 'videoFiles'>;
    labelKey: string;
}> = [
    { key: 'videoHistory', labelKey: 'settings.video.sync.history.label' },
    { key: 'videoSourceImages', labelKey: 'settings.video.sync.sourceImages.label' },
    { key: 'videoThumbnails', labelKey: 'settings.video.sync.thumbnails.label' },
    { key: 'videoFiles', labelKey: 'settings.video.sync.files.label' }
];

export const PROMPT_MODEL_BINDING_COMPATIBILITY_FAMILIES = ['openai-compatible', 'anthropic-compatible'] as const;
export const BATCH_MODEL_BINDING_COMPATIBILITY_FAMILIES = PROMPT_MODEL_BINDING_COMPATIBILITY_FAMILIES;
export const VISION_TEXT_MODEL_BINDING_COMPATIBILITY_FAMILIES = PROMPT_MODEL_BINDING_COMPATIBILITY_FAMILIES;

export function batchStrategyLabelKey(strategyId: BatchPlanningStrategyId): string {
    if (strategyId === 'content-split') return 'batch.dialog.mode.contentSplit';
    if (strategyId === 'variant-exploration') return 'batch.dialog.mode.variantExploration';
    if (strategyId === 'reference-variant') return 'batch.dialog.mode.referenceVariant';
    if (strategyId === 'manual-split') return 'batch.source.manual';
    if (strategyId === 'json-import') return 'batch.source.json';
    return 'batch.dialog.mode.auto';
}
