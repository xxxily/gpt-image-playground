import { generateId } from '@/lib/id';

export type BatchPlanningMode = 'auto' | 'content-split' | 'variant-exploration' | 'reference-variant' | 'mixed';
export type BatchResolvedIntent = 'content-split' | 'variant-exploration' | 'reference-variant' | 'mixed';
export type BatchCountMode = 'auto' | 'fixed';
export type BatchSourceImagePolicy = 'inherit-all' | 'none';

export type BatchPlanItem = {
    id: string;
    order: number;
    enabled: boolean;
    title?: string;
    sourceExcerpt: string;
    variationAxis?: string;
    prompt: string;
    negativePrompt?: string;
    notes?: string;
    sourceImagePolicy?: BatchSourceImagePolicy;
    lockedByUser?: boolean;
};

export type BatchPlan = {
    batchId: string;
    sourceText: string;
    sourceImageCount: number;
    planningMode: BatchPlanningMode;
    resolvedIntent: BatchResolvedIntent;
    countMode: BatchCountMode;
    targetCount?: number;
    recommendedCount: number;
    summary: string;
    strategyReason: string;
    warnings: string[];
    tasks: BatchPlanItem[];
};

export type BuildBatchPlanPromptParams = {
    sourceText: string;
    sourceImageCount: number;
    planningMode: BatchPlanningMode;
    countMode: BatchCountMode;
    targetCount?: number;
    maxCount: number;
    adjustmentInstruction?: string;
    previousPlan?: BatchPlan | null;
};

export const DEFAULT_BATCH_PLAN_MAX_COUNT = 12;
export const MIN_BATCH_PLAN_COUNT = 1;
export const MAX_BATCH_PLAN_COUNT = 30;

export const DEFAULT_BATCH_PLAN_SYSTEM_PROMPT = `你是一名 AI 图像批量任务规划师。你需要把用户输入规划成多个可以直接提交给图像生成或图片编辑模型的任务。

核心目标：
1. 默认使用 AI 自动判断：如果输入是多条文案、文章、脚本或分段内容，优先拆分成多个主题明确的任务；如果输入是单个需求或同一段文案，优先生成多个差异明确的候选版本；如果用户提供了参考图，优先围绕参考图和文案做多版本产出。
2. 每个任务的 prompt 必须是可直接用于生图或图片编辑的完整提示词，而不是摘要、标题或分析。
3. 多版本探索时，每条任务必须有清晰差异，例如风格、构图、场景、受众、版式、镜头、光线、材质或商业表达角度。
4. 有参考图时，默认所有任务继承当前参考图，并在 prompt 中明确如何使用参考图，例如保留主体、沿用配色/构图、做海报化重设计或作为风格参考。
5. 不要编造用户没有暗示的真实品牌、人物身份、地点或敏感事实；不确定的信息进入 warnings。
6. 如果用户给了调整指令，要在保留人工编辑条目的前提下调整整批方案。

输出要求：
1. 只输出一个 JSON 对象，不要 Markdown、解释、代码围栏或额外文字。
2. JSON 必须符合字段：batchId, sourceText, sourceImageCount, planningMode, resolvedIntent, countMode, targetCount, recommendedCount, summary, strategyReason, warnings, tasks。
3. tasks 数组内每项必须包含：id, order, enabled, title, sourceExcerpt, variationAxis, prompt, negativePrompt, notes, sourceImagePolicy, lockedByUser。
4. id 可以为空字符串，客户端会补齐；order 从 1 开始；enabled 默认 true；lockedByUser 默认 false。
5. sourceImagePolicy 只能是 "inherit-all" 或 "none"。有参考图时默认 "inherit-all"，无参考图时默认 "none"。
6. recommendedCount 必须等于有效任务数量或最接近的建议数量。`;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | undefined {
    const trimmed = trimString(value);
    return trimmed || undefined;
}

export function normalizeBatchPlanCount(value: unknown, fallback = 6): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.min(MAX_BATCH_PLAN_COUNT, Math.max(MIN_BATCH_PLAN_COUNT, Math.round(numberValue)));
}

function normalizeNonNegativeCount(value: unknown, fallback = 0): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(0, Math.round(numberValue));
}

export function normalizeBatchPlanningMode(value: unknown): BatchPlanningMode {
    if (
        value === 'content-split' ||
        value === 'variant-exploration' ||
        value === 'reference-variant' ||
        value === 'mixed'
    ) {
        return value;
    }
    return 'auto';
}

function normalizeBatchResolvedIntent(value: unknown, sourceImageCount: number): BatchResolvedIntent {
    if (
        value === 'content-split' ||
        value === 'variant-exploration' ||
        value === 'reference-variant' ||
        value === 'mixed'
    ) {
        return value;
    }
    return sourceImageCount > 0 ? 'reference-variant' : 'variant-exploration';
}

function normalizeBatchCountMode(value: unknown): BatchCountMode {
    return value === 'fixed' ? 'fixed' : 'auto';
}

function normalizeWarnings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => trimString(item)).filter(Boolean).slice(0, 12);
}

function normalizeSourceImagePolicy(value: unknown, sourceImageCount: number): BatchSourceImagePolicy {
    if (value === 'inherit-all' || value === 'none') return value;
    return sourceImageCount > 0 ? 'inherit-all' : 'none';
}

function makeFallbackSourceExcerpt(sourceText: string): string {
    return sourceText.trim().replace(/\s+/g, ' ').slice(0, 120);
}

function normalizeBatchPlanItem(
    value: unknown,
    index: number,
    sourceText: string,
    sourceImageCount: number
): BatchPlanItem | null {
    if (!isRecord(value)) return null;

    const prompt = trimString(value.prompt);
    if (!prompt) return null;

    const order = normalizeBatchPlanCount(value.order, index + 1);
    const title = optionalString(value.title);
    const sourceExcerpt = optionalString(value.sourceExcerpt) || makeFallbackSourceExcerpt(sourceText);
    const variationAxis = optionalString(value.variationAxis);
    const negativePrompt = optionalString(value.negativePrompt);
    const notes = optionalString(value.notes);

    return {
        id: optionalString(value.id) || generateId('batch_item'),
        order,
        enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
        ...(title ? { title } : {}),
        sourceExcerpt,
        ...(variationAxis ? { variationAxis } : {}),
        prompt,
        ...(negativePrompt ? { negativePrompt } : {}),
        ...(notes ? { notes } : {}),
        sourceImagePolicy: normalizeSourceImagePolicy(value.sourceImagePolicy, sourceImageCount),
        lockedByUser: value.lockedByUser === true
    };
}

function sortAndRenumberItems(items: BatchPlanItem[]): BatchPlanItem[] {
    return [...items]
        .sort((a, b) => a.order - b.order)
        .map((item, index) => ({
            ...item,
            order: index + 1
        }));
}

export function normalizeBatchPlan(value: unknown, fallback: BuildBatchPlanPromptParams): BatchPlan {
    const record = isRecord(value) ? value : {};
    const sourceImageCount = normalizeNonNegativeCount(record.sourceImageCount, fallback.sourceImageCount);
    const sourceText = trimString(record.sourceText) || fallback.sourceText.trim();
    const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
    const tasks = sortAndRenumberItems(
        rawTasks
            .map((item, index) => normalizeBatchPlanItem(item, index, sourceText, sourceImageCount))
            .filter((item): item is BatchPlanItem => item !== null)
    );

    if (tasks.length === 0) {
        const targetCount = normalizeBatchPlanCount(fallback.targetCount, fallback.sourceImageCount > 0 ? 4 : 6);
        const generated = Array.from({ length: targetCount }, (_, index) => ({
            id: generateId('batch_item'),
            order: index + 1,
            enabled: true,
            title: `版本 ${index + 1}`,
            sourceExcerpt: makeFallbackSourceExcerpt(sourceText),
            variationAxis: index === 0 ? '基础版本' : `差异化版本 ${index + 1}`,
            prompt: sourceText,
            sourceImagePolicy: sourceImageCount > 0 ? 'inherit-all' as const : 'none' as const,
            lockedByUser: false
        }));
        tasks.push(...generated);
    }

    const recommendedCount = normalizeBatchPlanCount(record.recommendedCount, tasks.filter((task) => task.enabled).length);

    return {
        batchId: optionalString(record.batchId) || generateId('batch'),
        sourceText,
        sourceImageCount,
        planningMode: normalizeBatchPlanningMode(record.planningMode || fallback.planningMode),
        resolvedIntent: normalizeBatchResolvedIntent(record.resolvedIntent, sourceImageCount),
        countMode: normalizeBatchCountMode(record.countMode || fallback.countMode),
        ...(record.targetCount !== undefined || fallback.targetCount !== undefined
            ? { targetCount: normalizeBatchPlanCount(record.targetCount, fallback.targetCount) }
            : {}),
        recommendedCount,
        summary: optionalString(record.summary) || '已生成批量任务预览。',
        strategyReason: optionalString(record.strategyReason) || '根据当前输入自动生成批量任务候选。',
        warnings: normalizeWarnings(record.warnings),
        tasks
    };
}

export function extractJsonObjectText(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error('批量规划失败：模型未返回内容。');

    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/u);
    const text = fenced ? fenced[1].trim() : trimmed;
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) {
        throw new Error('批量规划失败：模型未返回可解析的 JSON。');
    }
    return text.slice(firstBrace, lastBrace + 1);
}

export function parseBatchPlanText(raw: string, fallback: BuildBatchPlanPromptParams): BatchPlan {
    const jsonText = extractJsonObjectText(raw);
    const parsed = JSON.parse(jsonText) as unknown;
    return normalizeBatchPlan(parsed, fallback);
}

export function buildBatchPlanPrompt(params: BuildBatchPlanPromptParams): string {
    const countInstruction =
        params.countMode === 'fixed'
            ? `固定数量：请生成 ${normalizeBatchPlanCount(params.targetCount, 4)} 条任务。`
            : `AI 自动：请自行判断任务数量，最多 ${normalizeBatchPlanCount(params.maxCount, DEFAULT_BATCH_PLAN_MAX_COUNT)} 条。`;
    const imageInstruction =
        params.sourceImageCount > 0
            ? `当前有 ${params.sourceImageCount} 张源图片。首版要求所有子任务继承这些源图片，sourceImagePolicy 使用 "inherit-all"，并在每条 prompt 中说明如何使用参考图。`
            : '当前没有源图片。sourceImagePolicy 使用 "none"，任务走文生图生成路径。';
    const previousPlan = params.previousPlan
        ? `\n\n已有批量方案 JSON（尽量保留 lockedByUser=true 的条目）：\n${JSON.stringify(params.previousPlan)}`
        : '';
    const adjustment = params.adjustmentInstruction?.trim()
        ? `\n\n用户本次调整指令：\n${params.adjustmentInstruction.trim()}`
        : '';

    return [
        `批量目标：${params.planningMode}`,
        countInstruction,
        imageInstruction,
        `用户原始输入：\n${params.sourceText.trim()}`,
        adjustment,
        previousPlan,
        '\n请只返回符合要求的 BatchPlan JSON。'
    ].join('\n');
}
