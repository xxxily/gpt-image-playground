import { resolveActiveBatchPlanFormSnapshot, type BatchPlanFormSnapshot } from './batch-plan-draft';
import { describe, expect, it } from 'vitest';

const previewSnapshot: BatchPlanFormSnapshot = {
    taskMode: 'image-generate',
    n: 1,
    size: '1024x1024',
    customWidth: 1024,
    customHeight: 1024,
    quality: 'low',
    output_format: 'png',
    background: 'auto',
    moderation: 'low',
    model: 'gpt-image-1',
    providerInstanceId: 'openai:old'
};

describe('batch plan draft form snapshot resolution', () => {
    it('prefers the active form snapshot over the preview-time draft snapshot', () => {
        const currentSnapshot: BatchPlanFormSnapshot = {
            ...previewSnapshot,
            size: 'custom',
            customWidth: 1536,
            customHeight: 2048,
            quality: 'high',
            output_format: 'webp',
            output_compression: 82,
            providerInstanceId: 'openai:current'
        };

        expect(resolveActiveBatchPlanFormSnapshot(currentSnapshot, previewSnapshot)).toEqual(currentSnapshot);
    });

    it('falls back to the stored preview snapshot when no active form snapshot is available', () => {
        expect(resolveActiveBatchPlanFormSnapshot(null, previewSnapshot)).toEqual(previewSnapshot);
    });
});
