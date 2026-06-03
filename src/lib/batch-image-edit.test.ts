import {
    buildBatchImageEditPlan,
    isBatchImageEditPlan,
    normalizeBatchImageEditPlan,
    type BatchImageEditRuntimeInput
} from './batch-image-edit';
import { describe, expect, it } from 'vitest';

function input(name: string, order: number): BatchImageEditRuntimeInput {
    return {
        id: `input_${order}`,
        file: new File(['x'], name, { type: 'image/png' }),
        previewUrl: `blob:${name}`,
        filename: name,
        mimeType: 'image/png',
        sizeBytes: 1,
        order,
        status: 'ready'
    };
}

describe('batch image edit helpers', () => {
    it('builds one image edit task per ready input image', () => {
        const plan = buildBatchImageEditPlan({
            inputs: [input('a.png', 1), input('b.png', 2)],
            sharedReferenceImageCount: 1,
            instruction: '统一转成水彩风格',
            preset: 'style-transfer'
        });

        expect(isBatchImageEditPlan(plan)).toBe(true);
        expect(plan.planningMode).toBe('image-edit-batch');
        expect(plan.batchInputImageCount).toBe(2);
        expect(plan.sharedReferenceImageCount).toBe(1);
        expect(plan.tasks).toHaveLength(2);
        expect(plan.tasks[0]).toMatchObject({
            inputImageId: 'input_1',
            inputImageFilename: 'a.png',
            sharedReferenceCount: 1,
            operationPreset: 'style-transfer'
        });
        expect(plan.tasks[0].prompt).toContain('第一张图片是待处理目标图');
        expect(plan.tasks[0].prompt).toContain('统一转成水彩风格');
    });

    it('allows preset-driven restoration without a custom instruction', () => {
        const plan = buildBatchImageEditPlan({
            inputs: [input('old-photo.png', 1)],
            sharedReferenceImageCount: 0,
            instruction: '',
            preset: 'photo-restore'
        });

        expect(plan.tasks[0].prompt).toContain('修复这张老照片');
        expect(plan.tasks[0].sharedReferenceCount).toBe(0);
    });

    it('rejects custom mode without an instruction', () => {
        expect(() =>
            buildBatchImageEditPlan({
                inputs: [input('a.png', 1)],
                sharedReferenceImageCount: 0,
                instruction: '   ',
                preset: 'custom'
            })
        ).toThrow('batch.imageEdit.error.emptyInstruction');
    });

    it('normalizes persisted plans without dropping image input mapping', () => {
        const plan = buildBatchImageEditPlan({
            inputs: [input('a.png', 1)],
            sharedReferenceImageCount: 1,
            instruction: '统一转成水彩风格',
            preset: 'style-transfer'
        });
        const normalized = normalizeBatchImageEditPlan(JSON.parse(JSON.stringify(plan)), {
            sourceText: plan.sourceText,
            sourceImageCount: plan.sourceImageCount,
            planningMode: 'image-edit-batch',
            countMode: 'fixed',
            targetCount: plan.tasks.length,
            maxCount: 12,
            adjustmentInstruction: ''
        });

        expect(normalized).not.toBeNull();
        expect(isBatchImageEditPlan(normalized)).toBe(true);
        expect(normalized?.tasks[0]).toMatchObject({
            inputImageId: 'input_1',
            inputImageFilename: 'a.png',
            inputImageOrder: 1,
            sharedReferenceCount: 1,
            sourceImagePolicy: 'none'
        });
    });
});
