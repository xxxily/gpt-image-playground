export const MAX_BATCH_OVERRIDE_IMAGE_COUNT = 10;

export function clampBatchOverrideImageCount(value: number): number {
    return Math.max(1, Math.min(MAX_BATCH_OVERRIDE_IMAGE_COUNT, Math.round(value)));
}
