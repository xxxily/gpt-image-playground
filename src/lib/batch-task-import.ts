import {
    normalizeBatchTaskOverrides,
    type BatchPlan,
    type BatchPlanItem,
    type BatchSourceImagePolicy,
    type BatchTaskOverrides
} from '@/lib/batch-plan-core';
import { generateId } from '@/lib/id';

export const BATCH_TASK_IMPORT_SCHEMA_VERSION = 'gpt-image-playground.batch-tasks.v1';

export type BatchPlanDraftSource = 'ai-plan' | 'manual-split' | 'json-import';
export type BatchTextSplitMode = 'non-empty-lines' | 'blank-lines' | 'custom-delimiter';

export type BatchTaskBuildWarning =
    | { code: 'text.truncated'; limit: number; omitted: number }
    | { code: 'text.duplicates'; count: number }
    | { code: 'json.schemaMissing' }
    | { code: 'json.truncated'; limit: number; omitted: number }
    | { code: 'json.duplicateIds'; count: number }
    | { code: 'json.sensitiveIgnored'; fields: string[] }
    | { code: 'json.overridesApplied'; count: number }
    | { code: 'json.overridesIgnored'; count: number };

export type BatchTaskImportIssue = {
    path: string;
    code:
        | 'rootObjectRequired'
        | 'tasksRequired'
        | 'taskObjectRequired'
        | 'promptRequired'
        | 'invalidEnabled'
        | 'invalidOrder'
        | 'invalidSourceImagePolicy'
        | 'invalidMetadata';
};

export type BatchTaskImportErrorCode =
    | 'text.emptyInput'
    | 'text.customDelimiterRequired'
    | 'json.emptyInput'
    | 'json.parseFailed'
    | 'json.unsupportedSchema'
    | 'json.invalidImport';

export class BatchTaskImportError extends Error {
    code: BatchTaskImportErrorCode;
    line?: number;
    column?: number;
    issues?: BatchTaskImportIssue[];
    schemaVersion?: string;

    constructor(
        code: BatchTaskImportErrorCode,
        details: {
            message?: string;
            line?: number;
            column?: number;
            issues?: BatchTaskImportIssue[];
            schemaVersion?: string;
        } = {}
    ) {
        super(details.message || code);
        this.name = 'BatchTaskImportError';
        this.code = code;
        if (details.line !== undefined) this.line = details.line;
        if (details.column !== undefined) this.column = details.column;
        if (details.issues) this.issues = details.issues;
        if (details.schemaVersion !== undefined) this.schemaVersion = details.schemaVersion;
    }
}

export type BuildManualSplitBatchPlanParams = {
    sourceText: string;
    sourceImageCount: number;
    splitMode: BatchTextSplitMode;
    customDelimiter?: string;
    trimWhitespace: boolean;
    ignoreEmpty: boolean;
    collapseWhitespace?: boolean;
    preserveParagraphLineBreaks?: boolean;
    prefix?: string;
    suffix?: string;
};

export type ParseBatchTaskImportJsonParams = {
    jsonText: string;
    currentSourceImageCount: number;
};

export type BatchTaskPlanBuildResult = {
    plan: BatchPlan;
    warnings: BatchTaskBuildWarning[];
};

const SENSITIVE_IMPORT_KEYS = new Set([
    'apikey',
    'api_key',
    'password',
    'passwordhash',
    'baseurl',
    'apiurl',
    'connectionmode',
    'imagestoragepath',
    'openaiapikey',
    'geminiapikey',
    'sensenovaapikey',
    'seedreamapikey'
]);

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

function truncateText(value: string, maxLength: number): string {
    const trimmed = value.trim();
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function isSimpleJsonValue(value: unknown): value is string | number | boolean | null {
    return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function normalizeSourceImagePolicy(sourceImageCount: number): BatchSourceImagePolicy {
    return sourceImageCount > 0 ? 'inherit-all' : 'none';
}

function normalizeTextSegment(
    segment: string,
    options: Pick<BuildManualSplitBatchPlanParams, 'trimWhitespace' | 'collapseWhitespace'>
): string {
    const trimmed = options.trimWhitespace ? segment.trim() : segment;
    return options.collapseWhitespace ? trimmed.replace(/\s+/gu, ' ').trim() : trimmed;
}

function splitSourceText(params: BuildManualSplitBatchPlanParams): string[] {
    const sourceText = params.sourceText.replace(/\r\n?/gu, '\n');
    if (params.splitMode === 'non-empty-lines') {
        return sourceText.split('\n');
    }
    if (params.splitMode === 'blank-lines') {
        const paragraphs = sourceText.split(/\n\s*\n+/u);
        return params.preserveParagraphLineBreaks === false
            ? paragraphs.map((paragraph) => paragraph.replace(/\n+/gu, ' '))
            : paragraphs;
    }
    const delimiter = params.customDelimiter ?? '';
    if (!delimiter) {
        throw new BatchTaskImportError('text.customDelimiterRequired');
    }
    return sourceText.split(delimiter);
}

function applyPromptAffixes(prompt: string, prefix: string | undefined, suffix: string | undefined): string {
    return [prefix?.trim(), prompt.trim(), suffix?.trim()].filter(Boolean).join('\n\n');
}

function makeTaskTitle(prompt: string, index: number): string {
    const firstLine = prompt.split('\n').map((line) => line.trim()).find(Boolean) || `Task ${index + 1}`;
    return truncateText(firstLine, 32);
}

function makePlanBase(
    sourceText: string,
    sourceImageCount: number,
    tasks: BatchPlanItem[],
    planningMode: 'manual-split' | 'json-import',
    warnings: BatchTaskBuildWarning[],
    summary: string,
    strategyReason: string
): BatchPlan {
    return {
        batchId: generateId('batch'),
        sourceText,
        sourceImageCount,
        planningMode,
        resolvedIntent: planningMode,
        countMode: 'fixed',
        targetCount: tasks.length,
        recommendedCount: tasks.filter((task) => task.enabled && task.prompt.trim()).length,
        summary,
        strategyReason,
        warnings: warnings.map((warning) => warning.code),
        tasks
    };
}

function countDuplicatePrompts(tasks: BatchPlanItem[]): number {
    const seen = new Set<string>();
    let duplicates = 0;
    tasks.forEach((task) => {
        const key = task.prompt.trim().replace(/\s+/gu, ' ').toLowerCase();
        if (!key) return;
        if (seen.has(key)) {
            duplicates += 1;
        } else {
            seen.add(key);
        }
    });
    return duplicates;
}

function getManualSplitSummary(splitMode: BuildManualSplitBatchPlanParams['splitMode'], count: number): string {
    const label =
        splitMode === 'custom-delimiter'
            ? '自定义分隔符'
            : splitMode === 'blank-lines'
              ? '空行段落'
              : '非空行';
    return `已按${label}切分为 ${count} 条批量任务。`;
}

export function buildManualSplitBatchPlan(params: BuildManualSplitBatchPlanParams): BatchTaskPlanBuildResult {
    const normalizedSourceText = params.sourceText.trim();
    if (!normalizedSourceText) {
        throw new BatchTaskImportError('text.emptyInput');
    }

    const warnings: BatchTaskBuildWarning[] = [];
    const sourceImagePolicy = normalizeSourceImagePolicy(params.sourceImageCount);
    const segments = splitSourceText(params)
        .map((segment) => normalizeTextSegment(segment, params))
        .filter((segment) => (params.ignoreEmpty ? Boolean(segment.trim()) : true));

    if (segments.length === 0) {
        throw new BatchTaskImportError('text.emptyInput');
    }

    const tasks: BatchPlanItem[] = segments.map((segment, index) => {
        const prompt = applyPromptAffixes(segment, params.prefix, params.suffix);
        return {
            id: generateId('batch_item'),
            order: index + 1,
            enabled: true,
            title: makeTaskTitle(segment, index),
            sourceExcerpt: truncateText(segment, 180),
            prompt,
            sourceImagePolicy,
            lockedByUser: false
        };
    });

    const duplicatePromptCount = countDuplicatePrompts(tasks);
    if (duplicatePromptCount > 0) {
        warnings.push({ code: 'text.duplicates', count: duplicatePromptCount });
    }

    return {
        plan: makePlanBase(
            normalizedSourceText,
            params.sourceImageCount,
            tasks,
            'manual-split',
            warnings,
            getManualSplitSummary(params.splitMode, tasks.length),
            '未调用 AI；每个文本片段按原文生成一条任务。'
        ),
        warnings
    };
}

function positionToLineColumn(source: string, position: number): { line: number; column: number } {
    let line = 1;
    let column = 1;
    for (let index = 0; index < position && index < source.length; index += 1) {
        if (source.charCodeAt(index) === 10) {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }
    return { line, column };
}

function extractJsonErrorLocation(message: string, source: string): { line: number; column: number } | null {
    const positionMatch = message.match(/position\s+(\d+)/iu);
    if (positionMatch) {
        const position = Number(positionMatch[1]);
        if (Number.isFinite(position) && position >= 0) {
            return positionToLineColumn(source, Math.min(position, source.length));
        }
    }
    const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/iu);
    if (lineColMatch) {
        return {
            line: Math.max(1, Number(lineColMatch[1])),
            column: Math.max(1, Number(lineColMatch[2]))
        };
    }
    return null;
}

function parseJsonImportText(jsonText: string): Record<string, unknown> {
    const trimmed = jsonText.trim();
    if (!trimmed) {
        throw new BatchTaskImportError('json.emptyInput');
    }

    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!isRecord(parsed)) {
            throw new BatchTaskImportError('json.invalidImport', {
                issues: [{ path: '$', code: 'rootObjectRequired' }]
            });
        }
        return parsed;
    } catch (error) {
        if (error instanceof BatchTaskImportError) throw error;
        const message = error instanceof Error ? error.message : 'JSON parse failed';
        const location = extractJsonErrorLocation(message, trimmed);
        throw new BatchTaskImportError('json.parseFailed', {
            message,
            ...(location ?? {})
        });
    }
}

function collectSensitiveKeys(value: unknown, keys = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
        value.forEach((item) => collectSensitiveKeys(item, keys));
        return keys;
    }
    if (!isRecord(value)) return keys;

    Object.entries(value).forEach(([key, item]) => {
        const normalizedKey = key.replace(/[-_\s]/gu, '').toLowerCase();
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_IMPORT_KEYS.has(normalizedKey) || SENSITIVE_IMPORT_KEYS.has(lowerKey)) {
            keys.add(key);
        }
        collectSensitiveKeys(item, keys);
    });
    return keys;
}

function normalizeImportId(value: unknown, usedIds: Set<string>): { id: string; duplicated: boolean } {
    const candidate = optionalString(value);
    if (!candidate || !/^[A-Za-z0-9_.:-]{1,96}$/u.test(candidate) || usedIds.has(candidate)) {
        const id = generateId('batch_item');
        usedIds.add(id);
        return { id, duplicated: Boolean(candidate) };
    }
    usedIds.add(candidate);
    return { id: candidate, duplicated: false };
}

function validateMetadata(value: unknown): boolean {
    if (value === undefined) return true;
    if (!isRecord(value)) return false;
    return Object.values(value).every(isSimpleJsonValue);
}

function finiteOrder(value: unknown, fallback: number): number {
    if (value === undefined) return fallback;
    const numberValue = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : Number.NaN;
}

function countOverrideFields(value: unknown): number {
    return isRecord(value) ? Object.keys(value).length : 0;
}

function countNormalizedOverrideFields(overrides: BatchTaskOverrides | undefined): number {
    return overrides ? Object.keys(overrides).length : 0;
}

function mergeTaskOverrides(
    defaultOverrides: BatchTaskOverrides | undefined,
    taskOverrides: BatchTaskOverrides | undefined
): BatchTaskOverrides | undefined {
    const merged = {
        ...(defaultOverrides ?? {}),
        ...(taskOverrides ?? {})
    };
    return Object.keys(merged).length > 0 ? merged : undefined;
}

export function parseBatchTaskImportJson(params: ParseBatchTaskImportJsonParams): BatchTaskPlanBuildResult {
    const record = parseJsonImportText(params.jsonText);
    const warnings: BatchTaskBuildWarning[] = [];
    const issues: BatchTaskImportIssue[] = [];
    const schemaVersion = optionalString(record.schemaVersion);
    if (!schemaVersion) {
        warnings.push({ code: 'json.schemaMissing' });
    } else if (schemaVersion !== BATCH_TASK_IMPORT_SCHEMA_VERSION) {
        throw new BatchTaskImportError('json.unsupportedSchema', { schemaVersion });
    }

    const sensitiveKeys = [...collectSensitiveKeys(record)].sort();
    if (sensitiveKeys.length > 0) {
        warnings.push({ code: 'json.sensitiveIgnored', fields: sensitiveKeys });
    }

    if (!Array.isArray(record.tasks)) {
        throw new BatchTaskImportError('json.invalidImport', {
            issues: [{ path: '$.tasks', code: 'tasksRequired' }]
        });
    }

    const defaults = isRecord(record.defaults) ? record.defaults : {};
    const defaultSourceImagePolicy = normalizeSourceImagePolicy(params.currentSourceImageCount);
    const defaultEnabled = typeof defaults.enabled === 'boolean' ? defaults.enabled : true;
    const defaultNegativePrompt = optionalString(defaults.negativePrompt);
    const defaultNotes = optionalString(defaults.notes);
    const defaultOverrides = normalizeBatchTaskOverrides(defaults.overrides);
    let ignoredOverridesCount = Math.max(
        0,
        countOverrideFields(defaults.overrides) - countNormalizedOverrideFields(defaultOverrides)
    );
    let appliedOverridesCount = 0;
    const sortableTasks: Array<{ item: BatchPlanItem; rawIndex: number; sortOrder: number }> = [];
    const usedIds = new Set<string>();
    let duplicateIdCount = 0;

    record.tasks.forEach((rawTask, rawIndex) => {
        const path = `$.tasks[${rawIndex}]`;
        if (!isRecord(rawTask)) {
            issues.push({ path, code: 'taskObjectRequired' });
            return;
        }

        const prompt = trimString(rawTask.prompt);
        if (!prompt) {
            issues.push({ path: `${path}.prompt`, code: 'promptRequired' });
        }
        if (rawTask.enabled !== undefined && typeof rawTask.enabled !== 'boolean') {
            issues.push({ path: `${path}.enabled`, code: 'invalidEnabled' });
        }
        const order = finiteOrder(rawTask.order, rawIndex + 1);
        if (!Number.isFinite(order)) {
            issues.push({ path: `${path}.order`, code: 'invalidOrder' });
        }
        if (!validateMetadata(rawTask.metadata)) {
            issues.push({ path: `${path}.metadata`, code: 'invalidMetadata' });
        }
        const taskOverrides = normalizeBatchTaskOverrides(rawTask.overrides);
        ignoredOverridesCount += Math.max(
            0,
            countOverrideFields(rawTask.overrides) - countNormalizedOverrideFields(taskOverrides)
        );
        if (!prompt || !Number.isFinite(order)) return;

        const normalizedId = normalizeImportId(rawTask.id, usedIds);
        if (normalizedId.duplicated) duplicateIdCount += 1;
        const negativePrompt = optionalString(rawTask.negativePrompt) || defaultNegativePrompt;
        const notes = optionalString(rawTask.notes) || defaultNotes;
        const sourceExcerpt = optionalString(rawTask.sourceExcerpt) || truncateText(prompt, 180);
        const sourceImagePolicy = defaultSourceImagePolicy;
        const overrides = mergeTaskOverrides(defaultOverrides, taskOverrides);
        if (overrides) appliedOverridesCount += 1;

        sortableTasks.push({
            rawIndex,
            sortOrder: order,
            item: {
                id: normalizedId.id,
                order: rawIndex + 1,
                enabled: typeof rawTask.enabled === 'boolean' ? rawTask.enabled : defaultEnabled,
                ...(optionalString(rawTask.title) ? { title: optionalString(rawTask.title) } : {}),
                sourceExcerpt,
                ...(optionalString(rawTask.variationAxis) ? { variationAxis: optionalString(rawTask.variationAxis) } : {}),
                prompt,
                ...(negativePrompt ? { negativePrompt } : {}),
                ...(notes ? { notes } : {}),
                ...(overrides ? { overrides } : {}),
                sourceImagePolicy,
                lockedByUser: false
            }
        });
    });

    if (issues.length > 0) {
        throw new BatchTaskImportError('json.invalidImport', { issues });
    }

    if (duplicateIdCount > 0) {
        warnings.push({ code: 'json.duplicateIds', count: duplicateIdCount });
    }
    if (appliedOverridesCount > 0) {
        warnings.push({ code: 'json.overridesApplied', count: appliedOverridesCount });
    }
    if (ignoredOverridesCount > 0) {
        warnings.push({ code: 'json.overridesIgnored', count: ignoredOverridesCount });
    }

    const sortedTasks = sortableTasks
        .sort((a, b) => a.sortOrder - b.sortOrder || a.rawIndex - b.rawIndex)
        .map((entry) => entry.item);
    if (sortedTasks.length === 0) {
        throw new BatchTaskImportError('json.invalidImport', {
            issues: [{ path: '$.tasks', code: 'tasksRequired' }]
        });
    }

    const sourceText =
        optionalString(record.sourceText) ||
        sortedTasks.map((task) => task.prompt).join('\n').slice(0, 4000);
    const batchLabel = optionalString(record.batchLabel);
    const plan = makePlanBase(
        sourceText,
        params.currentSourceImageCount,
        sortedTasks.map((task, index) => ({ ...task, order: index + 1 })),
        'json-import',
        warnings,
        batchLabel || `已从 JSON 导入 ${sortedTasks.length} 条批量任务。`,
        '未调用 AI；按外部 JSON 规范导入并归一化为批量预览。'
    );
    const importedBatchId = optionalString(record.batchId);
    if (importedBatchId && /^[A-Za-z0-9_.:-]{1,120}$/u.test(importedBatchId)) {
        plan.batchId = importedBatchId;
    }

    return { plan, warnings };
}
