import {
    normalizeBatchPlan,
    type BatchPlan,
    type BatchPlanItem,
    type BuildBatchPlanPromptParams
} from '@/lib/batch-plan-core';
import { generateId } from '@/lib/id';

export const BATCH_IMAGE_EDIT_SOURCE = 'image-edit-batch' as const;
export const MAX_BATCH_IMAGE_EDIT_INPUTS = 50;

export type BatchImageEditPreset = 'custom' | 'style-transfer' | 'photo-restore' | 'enhance' | 'background-rework';

export type BatchImageEditInputSummary = {
    id: string;
    filename: string;
    relativePath?: string;
    mimeType: string;
    sizeBytes?: number;
    order: number;
    status: 'ready' | 'warning' | 'invalid' | 'missing';
    warning?: string;
};

export type BatchImageEditRuntimeInput = BatchImageEditInputSummary & {
    file: File;
    previewUrl: string;
};

export type BatchImageEditRuntime = {
    inputs: BatchImageEditRuntimeInput[];
};

export type BatchImageEditPlanItem = BatchPlanItem & {
    inputImageId: string;
    inputImageFilename: string;
    inputImageRelativePath?: string;
    inputImageOrder: number;
    sharedReferenceCount: number;
    variantIndex?: number;
    variantTotal?: number;
    operationPreset: BatchImageEditPreset;
    outputFilenameHint: string;
};

export type BatchImageEditPlan = BatchPlan & {
    taskFamily: typeof BATCH_IMAGE_EDIT_SOURCE;
    batchInputImageCount: number;
    sharedReferenceImageCount: number;
    imagePairingMode: 'one-image-per-task';
    operationPreset: BatchImageEditPreset;
    imageInputs: BatchImageEditInputSummary[];
    tasks: BatchImageEditPlanItem[];
};

export type BuildBatchImageEditPlanParams = {
    inputs: BatchImageEditRuntimeInput[];
    sharedReferenceImageCount: number;
    instruction: string;
    preset: BatchImageEditPreset;
    maxTasks?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function truncateText(value: string, maxLength: number): string {
    const trimmed = value.trim();
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function stripImageExtension(filename: string): string {
    return filename.replace(/\.[A-Za-z0-9]+$/u, '') || filename;
}

function normalizeTaskLimit(value: unknown): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) return MAX_BATCH_IMAGE_EDIT_INPUTS;
    return Math.max(1, Math.min(MAX_BATCH_IMAGE_EDIT_INPUTS, Math.round(numberValue)));
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(0, Math.round(numberValue));
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(1, Math.round(numberValue));
}

function normalizePreset(value: unknown): BatchImageEditPreset {
    if (
        value === 'custom' ||
        value === 'style-transfer' ||
        value === 'photo-restore' ||
        value === 'enhance' ||
        value === 'background-rework'
    ) {
        return value;
    }
    return 'custom';
}

function normalizeInputStatus(value: unknown): BatchImageEditInputSummary['status'] {
    if (value === 'warning' || value === 'invalid' || value === 'missing') return value;
    return 'ready';
}

function normalizeImageInputSummary(value: unknown, index: number): BatchImageEditInputSummary | null {
    if (!isRecord(value)) return null;

    const id = trimString(value.id);
    const filename = trimString(value.filename);
    if (!id || !filename) return null;

    const relativePath = trimString(value.relativePath);
    const mimeType = trimString(value.mimeType) || 'image/png';
    const sizeBytes =
        typeof value.sizeBytes === 'number' && Number.isFinite(value.sizeBytes)
            ? Math.max(0, Math.round(value.sizeBytes))
            : undefined;
    const warning = trimString(value.warning);

    return {
        id,
        filename,
        ...(relativePath ? { relativePath } : {}),
        mimeType,
        ...(sizeBytes !== undefined ? { sizeBytes } : {}),
        order: normalizePositiveInteger(value.order, index + 1),
        status: normalizeInputStatus(value.status),
        ...(warning ? { warning } : {})
    };
}

function presetInstruction(preset: BatchImageEditPreset, sharedReferenceImageCount: number): string {
    const referenceClause =
        sharedReferenceImageCount > 0
            ? '第一张图片是待处理目标图，后续图片是共享参考图；参考共享参考图的风格、质感、构图或品牌视觉，但不要把参考图当作待处理目标。'
            : '第一张图片是待处理目标图。';

    if (preset === 'style-transfer') {
        return `${referenceClause} 对待处理图片进行风格化迁移，保留主要主体、姿态、结构和可识别特征，统一转换为用户指定或参考图体现的视觉风格。`;
    }
    if (preset === 'photo-restore') {
        return `${referenceClause} 修复这张老照片或受损照片，去除划痕、噪点、污渍、褪色和轻微模糊，尽量保留原始人物、场景、年代感和真实质感。`;
    }
    if (preset === 'enhance') {
        return `${referenceClause} 增强待处理图片的清晰度、光线、色彩、细节和整体观感，保持内容真实自然，不改变主体身份和关键构图。`;
    }
    if (preset === 'background-rework') {
        return `${referenceClause} 保留待处理图片中的主体，重绘或优化背景、光线和环境，让画面更干净、更适合商业或社媒使用。`;
    }
    return referenceClause;
}

function buildTaskPrompt(params: {
    filename: string;
    instruction: string;
    preset: BatchImageEditPreset;
    sharedReferenceImageCount: number;
}): string {
    const instruction = params.instruction.trim();
    const base = presetInstruction(params.preset, params.sharedReferenceImageCount);
    const fileHint = `当前处理文件：${params.filename}。`;
    return [base, instruction, fileHint].filter(Boolean).join('\n\n');
}

function makeSummary(preset: BatchImageEditPreset, count: number, sharedReferenceImageCount: number): string {
    const presetLabel =
        preset === 'style-transfer'
            ? '风格迁移'
            : preset === 'photo-restore'
              ? '老照片修复'
              : preset === 'enhance'
                ? '图片增强'
                : preset === 'background-rework'
                  ? '背景重绘'
                  : '自定义改图';
    const referenceText = sharedReferenceImageCount > 0 ? `，并继承 ${sharedReferenceImageCount} 张共享参考图` : '';
    return `已为 ${count} 张待处理图片创建${presetLabel}批量改图预览${referenceText}。`;
}

export function isBatchImageEditPlan(plan: BatchPlan | null | undefined): plan is BatchImageEditPlan {
    return Boolean(plan && (plan as Partial<BatchImageEditPlan>).taskFamily === BATCH_IMAGE_EDIT_SOURCE);
}

export function normalizeBatchImageEditPlan(
    value: unknown,
    fallback: BuildBatchPlanPromptParams
): BatchImageEditPlan | null {
    if (!isRecord(value)) return null;
    const rawTasks = Array.isArray(value.tasks) ? value.tasks : [];
    if (rawTasks.length === 0) return null;

    const operationPreset = normalizePreset(value.operationPreset);
    const imageInputs = (Array.isArray(value.imageInputs) ? value.imageInputs : [])
        .map((input, index) => normalizeImageInputSummary(input, index))
        .filter((input): input is BatchImageEditInputSummary => input !== null)
        .slice(0, MAX_BATCH_IMAGE_EDIT_INPUTS);
    const inputById = new Map(imageInputs.map((input) => [input.id, input]));

    const basePlan = normalizeBatchPlan(value, {
        ...fallback,
        planningMode: BATCH_IMAGE_EDIT_SOURCE,
        countMode: 'fixed'
    });

    const rawTaskById = new Map<string, Record<string, unknown>>();
    rawTasks.forEach((task) => {
        if (!isRecord(task)) return;
        const id = trimString(task.id);
        if (id) rawTaskById.set(id, task);
    });

    const tasks = basePlan.tasks
        .map((baseTask, index): BatchImageEditPlanItem | null => {
            const rawTask = rawTaskById.get(baseTask.id) ?? (isRecord(rawTasks[index]) ? rawTasks[index] : null);
            if (!rawTask) return null;

            const inputImageId = trimString(rawTask.inputImageId) || imageInputs[index]?.id;
            if (!inputImageId) return null;

            const matchingInput = inputById.get(inputImageId) ?? imageInputs[index];
            const inputImageFilename = trimString(rawTask.inputImageFilename) || matchingInput?.filename;
            if (!inputImageFilename) return null;

            const inputImageRelativePath = trimString(rawTask.inputImageRelativePath) || matchingInput?.relativePath;
            const outputFilenameHint =
                trimString(rawTask.outputFilenameHint) ||
                `${stripImageExtension(inputImageFilename)}_${String(index + 1).padStart(2, '0')}`;
            const taskPreset = normalizePreset(rawTask.operationPreset || operationPreset);
            const variantIndex =
                rawTask.variantIndex === undefined ? undefined : normalizePositiveInteger(rawTask.variantIndex, 1);
            const variantTotal =
                rawTask.variantTotal === undefined ? undefined : normalizePositiveInteger(rawTask.variantTotal, 1);

            return {
                ...baseTask,
                sourceImagePolicy: 'none',
                inputImageId,
                inputImageFilename,
                ...(inputImageRelativePath ? { inputImageRelativePath } : {}),
                inputImageOrder: normalizePositiveInteger(rawTask.inputImageOrder, matchingInput?.order ?? index + 1),
                sharedReferenceCount: normalizeNonNegativeInteger(
                    rawTask.sharedReferenceCount,
                    normalizeNonNegativeInteger(value.sharedReferenceImageCount, fallback.sourceImageCount)
                ),
                ...(variantIndex !== undefined ? { variantIndex } : {}),
                ...(variantTotal !== undefined ? { variantTotal } : {}),
                operationPreset: taskPreset,
                outputFilenameHint
            };
        })
        .filter((task): task is BatchImageEditPlanItem => task !== null);

    if (tasks.length === 0) return null;

    const sharedReferenceImageCount = normalizeNonNegativeInteger(
        value.sharedReferenceImageCount,
        fallback.sourceImageCount
    );

    return {
        ...basePlan,
        sourceImageCount: sharedReferenceImageCount,
        planningMode: BATCH_IMAGE_EDIT_SOURCE,
        resolvedIntent: BATCH_IMAGE_EDIT_SOURCE,
        countMode: 'fixed',
        targetCount: tasks.length,
        recommendedCount: tasks.filter((task) => task.enabled && task.prompt.trim()).length,
        tasks,
        taskFamily: BATCH_IMAGE_EDIT_SOURCE,
        batchInputImageCount: normalizePositiveInteger(value.batchInputImageCount, imageInputs.length || tasks.length),
        sharedReferenceImageCount,
        imagePairingMode: 'one-image-per-task',
        operationPreset,
        imageInputs
    };
}

export function buildBatchImageEditPlan(params: BuildBatchImageEditPlanParams): BatchImageEditPlan {
    const readyInputs = params.inputs.filter((input) => input.status === 'ready');
    if (readyInputs.length === 0) {
        throw new Error('batch.imageEdit.error.emptyImages');
    }
    if (params.preset === 'custom' && !params.instruction.trim()) {
        throw new Error('batch.imageEdit.error.emptyInstruction');
    }

    const maxTasks = normalizeTaskLimit(params.maxTasks);
    const limitedInputs = readyInputs.slice(0, maxTasks);
    const warnings =
        readyInputs.length > limitedInputs.length
            ? [`batch.imageEdit.warning.truncated:${limitedInputs.length}:${readyInputs.length - limitedInputs.length}`]
            : [];

    const tasks: BatchImageEditPlanItem[] = limitedInputs.map((input, index) => {
        const prompt = buildTaskPrompt({
            filename: input.relativePath || input.filename,
            instruction: params.instruction,
            preset: params.preset,
            sharedReferenceImageCount: params.sharedReferenceImageCount
        });
        const displayName = input.relativePath || input.filename;
        return {
            id: generateId('batch_item'),
            order: index + 1,
            enabled: true,
            title: truncateText(displayName, 40),
            sourceExcerpt: truncateText(displayName, 180),
            variationAxis: params.sharedReferenceImageCount > 0 ? '目标图 + 共享参考图' : '逐图改图',
            prompt,
            notes: displayName,
            sourceImagePolicy: 'none',
            lockedByUser: false,
            inputImageId: input.id,
            inputImageFilename: input.filename,
            ...(input.relativePath ? { inputImageRelativePath: input.relativePath } : {}),
            inputImageOrder: input.order,
            sharedReferenceCount: params.sharedReferenceImageCount,
            operationPreset: params.preset,
            outputFilenameHint: `${stripImageExtension(input.filename)}_${String(index + 1).padStart(2, '0')}`
        };
    });

    return {
        batchId: generateId('batch'),
        sourceText: params.instruction.trim(),
        sourceImageCount: params.sharedReferenceImageCount,
        planningMode: BATCH_IMAGE_EDIT_SOURCE,
        resolvedIntent: BATCH_IMAGE_EDIT_SOURCE,
        countMode: 'fixed',
        targetCount: tasks.length,
        recommendedCount: tasks.length,
        summary: makeSummary(params.preset, tasks.length, params.sharedReferenceImageCount),
        strategyReason: '未调用 AI；按待处理图片列表一图一任务生成批量图片编辑预览。',
        warnings,
        tasks,
        taskFamily: BATCH_IMAGE_EDIT_SOURCE,
        batchInputImageCount: readyInputs.length,
        sharedReferenceImageCount: params.sharedReferenceImageCount,
        imagePairingMode: 'one-image-per-task',
        operationPreset: params.preset,
        imageInputs: limitedInputs.map((input) => ({
            id: input.id,
            filename: input.filename,
            ...(input.relativePath ? { relativePath: input.relativePath } : {}),
            mimeType: input.mimeType,
            ...(input.sizeBytes !== undefined ? { sizeBytes: input.sizeBytes } : {}),
            order: input.order,
            status: input.status,
            ...(input.warning ? { warning: input.warning } : {})
        }))
    };
}
