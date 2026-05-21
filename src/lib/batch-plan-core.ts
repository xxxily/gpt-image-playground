import { generateId } from '@/lib/id';

export type BatchPlanningMode =
    | 'auto'
    | 'content-split'
    | 'variant-exploration'
    | 'reference-variant'
    | 'mixed'
    | 'manual-split'
    | 'json-import';
export type BatchResolvedIntent =
    | 'content-split'
    | 'variant-exploration'
    | 'reference-variant'
    | 'mixed'
    | 'manual-split'
    | 'json-import';
export type BatchCountMode = 'auto' | 'fixed';
export type BatchSourceImagePolicy = 'inherit-all' | 'none';
export type BatchTaskOverrides = {
    n?: number;
    size?: string;
    quality?: 'low' | 'medium' | 'high' | 'auto';
    output_format?: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background?: 'transparent' | 'opaque' | 'auto';
    moderation?: 'low' | 'auto';
    model?: string;
    providerInstanceId?: string;
};

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
    overrides?: BatchTaskOverrides;
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
export const DEFAULT_BATCH_PLAN_MAX_TOKENS = 8000;

export const DEFAULT_BATCH_PLAN_SYSTEM_PROMPT = `你是一名 AI 图像批量任务规划师。你需要把用户输入规划成多个可以直接提交给图像生成或图片编辑模型的任务。

核心目标：
1. 默认使用 AI 自动判断：如果输入是多条文案、文章、脚本或分段内容，优先拆分成多个主题明确的任务；如果输入是单个需求或同一段文案，优先生成多个差异明确的候选版本；如果用户提供了参考图，优先围绕参考图和文案做多版本产出。
2. 每个任务的 prompt 必须是可直接用于生图或图片编辑的完整提示词，而不是摘要、标题或分析。
3. 多版本探索时，每条任务必须有清晰差异，例如风格、构图、场景、受众、版式、镜头、光线、材质或商业表达角度。
4. 有参考图时，所有任务自动继承当前参考图；没有参考图时自动不使用参考图。客户端会根据当前源图状态自动归一化任务的 sourceImagePolicy。
5. 不要编造用户没有暗示的真实品牌、人物身份、地点或敏感事实；不确定的信息进入 warnings。
6. 如果用户给了调整指令，要在保留人工编辑条目的前提下调整整批方案。
7. summary、strategyReason 保持简短；每条 task prompt 要可直接执行，但尽量精炼，避免长篇解释或重复摘要内容。

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

function stripTrailingCommas(text: string): string {
    return text.replace(/,\s*([}\]])/gu, '$1');
}

function repairJsonText(text: string): string {
    return stripTrailingCommas(text);
}

function parseJsonLikeRecord(text: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(text) as unknown;
        return isRecord(parsed) ? parsed : null;
    } catch {
        const repairedText = repairJsonText(text);
        if (repairedText === text) return null;

        try {
            const parsed = JSON.parse(repairedText) as unknown;
            return isRecord(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
}

function findMatchingBracket(text: string, startIndex: number, openChar: string, closeChar: string): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === openChar) {
            depth += 1;
            continue;
        }
        if (char === closeChar) {
            depth -= 1;
            if (depth === 0) return index;
        }
    }

    return -1;
}

function extractTaskObjectTexts(jsonText: string): string[] {
    const tasksKeyIndex = jsonText.lastIndexOf('"tasks"');
    if (tasksKeyIndex < 0) return [];

    const arrayStart = jsonText.indexOf('[', tasksKeyIndex);
    if (arrayStart < 0) return [];

    const arrayEnd = findMatchingBracket(jsonText, arrayStart, '[', ']');
    const arrayText = arrayEnd >= 0 ? jsonText.slice(arrayStart + 1, arrayEnd) : jsonText.slice(arrayStart + 1);

    const taskTexts: string[] = [];
    let inString = false;
    let escaped = false;
    let depth = 0;
    let startIndex = -1;

    for (let index = 0; index < arrayText.length; index += 1) {
        const char = arrayText[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            if (depth === 0) {
                startIndex = index;
            }
            depth += 1;
            continue;
        }

        if (char === '}') {
            if (depth > 0) {
                depth -= 1;
                if (depth === 0 && startIndex >= 0) {
                    taskTexts.push(arrayText.slice(startIndex, index + 1));
                    startIndex = -1;
                }
            }
        }
    }

    return taskTexts;
}

function parseTaskObjectText(
    text: string,
    index: number,
    sourceText: string,
    sourceImageCount: number
): BatchPlanItem | null {
    const parsed = parseJsonLikeRecord(text);
    if (!parsed) return null;

    return normalizeBatchPlanItem(parsed, index, sourceText, sourceImageCount);
}

function extractTaskItemsFromText(jsonText: string, sourceText: string, sourceImageCount: number): BatchPlanItem[] {
    return extractTaskObjectTexts(jsonText)
        .map((text, index) => parseTaskObjectText(text, index, sourceText, sourceImageCount))
        .filter((item): item is BatchPlanItem => item !== null);
}

function extractBatchPlanBaseRecord(jsonText: string): Record<string, unknown> | null {
    const parsed = parseJsonLikeRecord(jsonText);
    if (parsed) return parsed;

    const tasksKeyIndex = jsonText.lastIndexOf('"tasks"');
    if (tasksKeyIndex < 0) return null;

    const prefix = jsonText.slice(0, tasksKeyIndex).trimEnd();
    if (!prefix) return null;

    const normalizedPrefix = prefix.endsWith(',') ? prefix : `${prefix},`;
    const baseText = `${normalizedPrefix}"tasks":[]}`;
    return parseJsonLikeRecord(baseText);
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
        value === 'mixed' ||
        value === 'manual-split' ||
        value === 'json-import'
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
        value === 'mixed' ||
        value === 'manual-split' ||
        value === 'json-import'
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
    void value;
    return sourceImageCount > 0 ? 'inherit-all' : 'none';
}

function normalizePositiveInteger(value: unknown): number | undefined {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) return undefined;
    const normalized = Math.round(numberValue);
    return normalized > 0 ? normalized : undefined;
}

function normalizeNonNegativeInteger(value: unknown): number | undefined {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) return undefined;
    const normalized = Math.round(numberValue);
    return normalized >= 0 ? normalized : undefined;
}

export function normalizeBatchTaskOverrides(value: unknown): BatchTaskOverrides | undefined {
    if (!isRecord(value)) return undefined;

    const overrides: BatchTaskOverrides = {};
    const n = normalizePositiveInteger(value.n);
    const size = optionalString(value.size);
    const quality = value.quality;
    const outputFormat = value.output_format;
    const outputCompression = normalizeNonNegativeInteger(value.output_compression);
    const background = value.background;
    const moderation = value.moderation;
    const model = optionalString(value.model);
    const providerInstanceId = optionalString(value.providerInstanceId);

    if (n !== undefined) overrides.n = n;
    if (size) overrides.size = size;
    if (quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'auto') {
        overrides.quality = quality;
    }
    if (outputFormat === 'png' || outputFormat === 'jpeg' || outputFormat === 'webp') {
        overrides.output_format = outputFormat;
    }
    if (outputCompression !== undefined) overrides.output_compression = outputCompression;
    if (background === 'transparent' || background === 'opaque' || background === 'auto') {
        overrides.background = background;
    }
    if (moderation === 'low' || moderation === 'auto') {
        overrides.moderation = moderation;
    }
    if (model) overrides.model = model;
    if (providerInstanceId) overrides.providerInstanceId = providerInstanceId;

    return Object.keys(overrides).length > 0 ? overrides : undefined;
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
    const overrides = normalizeBatchTaskOverrides(value.overrides);

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
        ...(overrides ? { overrides } : {}),
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
    const parsed = parseJsonLikeRecord(jsonText);
    if (parsed) {
        return normalizeBatchPlan(parsed, fallback);
    }

    const baseRecord = extractBatchPlanBaseRecord(jsonText) ?? {};
    const taskItems = extractTaskItemsFromText(jsonText, fallback.sourceText, fallback.sourceImageCount);
    return normalizeBatchPlan(
        taskItems.length > 0 ? { ...baseRecord, tasks: taskItems } : baseRecord,
        fallback
    );
}

export function buildBatchPlanPrompt(params: BuildBatchPlanPromptParams): string {
    const countInstruction =
        params.countMode === 'fixed'
            ? `固定数量：请生成 ${normalizeBatchPlanCount(params.targetCount, 4)} 条任务。`
            : `AI 自动：请自行判断任务数量，最多 ${normalizeBatchPlanCount(params.maxCount, DEFAULT_BATCH_PLAN_MAX_COUNT)} 条。`;
    const imageInstruction =
        params.sourceImageCount > 0
            ? `当前有 ${params.sourceImageCount} 张源图片。首版要求所有子任务自动继承这些源图片。`
            : '当前没有源图片。任务自动走文生图生成路径。';
    const previousPlan = params.previousPlan
        ? (() => {
              const lockedTasks = params.previousPlan?.tasks.filter((task) => task.lockedByUser) ?? [];
              if (lockedTasks.length === 0) return '';

              return `\n\n已有批量方案 JSON（仅保留 lockedByUser=true 的条目）：\n${JSON.stringify({
                  batchId: params.previousPlan.batchId,
                  sourceText: params.previousPlan.sourceText,
                  sourceImageCount: params.previousPlan.sourceImageCount,
                  planningMode: params.previousPlan.planningMode,
                  resolvedIntent: params.previousPlan.resolvedIntent,
                  countMode: params.previousPlan.countMode,
                  targetCount: params.previousPlan.targetCount,
                  recommendedCount: params.previousPlan.recommendedCount,
                  summary: params.previousPlan.summary,
                  strategyReason: params.previousPlan.strategyReason,
                  warnings: params.previousPlan.warnings,
                  tasks: lockedTasks.map((task) => ({
                      id: task.id,
                      order: task.order,
                      enabled: task.enabled,
                      ...(task.title ? { title: task.title } : {}),
                      sourceExcerpt: task.sourceExcerpt,
                      ...(task.variationAxis ? { variationAxis: task.variationAxis } : {}),
                      prompt: task.prompt,
                      ...(task.negativePrompt ? { negativePrompt: task.negativePrompt } : {}),
                      ...(task.notes ? { notes: task.notes } : {}),
                      ...(task.overrides ? { overrides: task.overrides } : {}),
                      sourceImagePolicy: task.sourceImagePolicy,
                      lockedByUser: task.lockedByUser
                  }))
              })}`;
          })()
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
