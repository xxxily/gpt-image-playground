'use client';

import {
    normalizeBatchPlan,
    normalizeBatchPlanCount,
    type BatchCountMode,
    type BatchPlan,
    type BatchPlanningMode,
    type BatchSourceImagePolicy
} from '@/lib/batch-plan-core';
import type { BatchPlanDraftSource, BatchTextSplitMode } from '@/lib/batch-task-import';
import { isProviderOptions, type ProviderOptions } from '@/lib/provider-options';

export type BatchPlanFormSnapshot = {
    taskMode: 'image-generate' | 'image-edit';
    n: number;
    size: string;
    customWidth: number;
    customHeight: number;
    quality: 'low' | 'medium' | 'high' | 'auto';
    output_format: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background: 'transparent' | 'opaque' | 'auto';
    moderation: 'low' | 'auto';
    model: string;
    providerInstanceId: string;
    providerOptions?: ProviderOptions;
};

export type BatchPlanDraft = {
    source: BatchPlanDraftSource;
    sourceText: string;
    sourceImageCount: number;
    sourceImageNames: string[];
    planningMode: BatchPlanningMode;
    countMode: BatchCountMode;
    targetCount?: number;
    maxCount: number;
    adjustmentInstruction: string;
    splitMode?: BatchTextSplitMode;
    customDelimiter?: string;
    trimWhitespace?: boolean;
    ignoreEmpty?: boolean;
    collapseWhitespace?: boolean;
    preserveParagraphLineBreaks?: boolean;
    promptPrefix?: string;
    promptSuffix?: string;
    sourceImagePolicy?: BatchSourceImagePolicy;
    jsonImportText?: string;
    formSnapshot?: BatchPlanFormSnapshot;
    preview?: BatchPlan | null;
    updatedAt: number;
};

const STORAGE_KEY = 'gpt_image_playground.batch_plan_draft.v1';
const MAX_DRAFT_BYTES = 96_000;
const MAX_SOURCE_IMAGE_NAMES = 12;
const MAX_ADJUSTMENT_LENGTH = 6_000;
const MAX_JSON_IMPORT_DRAFT_LENGTH = 12_000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => trimString(item)).filter(Boolean).slice(0, MAX_SOURCE_IMAGE_NAMES);
}

function normalizeCount(value: unknown, fallback: number): number {
    return normalizeBatchPlanCount(value, fallback);
}

function normalizeDraftSource(value: unknown): BatchPlanDraftSource {
    return value === 'manual-split' || value === 'json-import' ? value : 'ai-plan';
}

function normalizeSplitMode(value: unknown): BatchTextSplitMode | undefined {
    if (value === 'non-empty-lines' || value === 'blank-lines' || value === 'custom-delimiter') {
        return value;
    }
    return undefined;
}

function normalizeSourceImagePolicy(value: unknown): BatchSourceImagePolicy | undefined {
    return value === 'inherit-all' || value === 'none' ? value : undefined;
}

function normalizeDimension(value: unknown, fallback: number): number {
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(0, Math.round(numberValue));
}

function normalizeFormSnapshot(value: unknown): BatchPlanFormSnapshot | undefined {
    if (!isRecord(value)) return undefined;

    const taskMode = value.taskMode === 'image-edit' ? 'image-edit' : 'image-generate';
    const n = normalizeCount(value.n, 1);
    const size = trimString(value.size) || 'auto';
    const customWidth = normalizeDimension(value.customWidth, 1024);
    const customHeight = normalizeDimension(value.customHeight, 1024);
    const quality = value.quality === 'low' || value.quality === 'medium' || value.quality === 'high' || value.quality === 'auto'
        ? value.quality
        : 'auto';
    const outputFormat = value.output_format === 'jpeg' || value.output_format === 'webp' ? value.output_format : 'png';
    const background = value.background === 'transparent' || value.background === 'opaque' || value.background === 'auto'
        ? value.background
        : 'auto';
    const moderation = value.moderation === 'low' || value.moderation === 'auto' ? value.moderation : 'low';
    const model = trimString(value.model);
    const providerInstanceId = trimString(value.providerInstanceId);
    if (!model || !providerInstanceId) return undefined;

    const snapshot: BatchPlanFormSnapshot = {
        taskMode,
        n,
        size,
        customWidth,
        customHeight,
        quality,
        output_format: outputFormat,
        background,
        moderation,
        model,
        providerInstanceId
    };

    const outputCompression = typeof value.output_compression === 'number' && Number.isFinite(value.output_compression)
        ? Math.max(0, Math.round(value.output_compression))
        : undefined;
    if (outputCompression !== undefined) {
        snapshot.output_compression = outputCompression;
    }

    if (isProviderOptions(value.providerOptions)) {
        snapshot.providerOptions = value.providerOptions;
    }

    return snapshot;
}

function buildFallbackDraft(record: Record<string, unknown>): Omit<BatchPlanDraft, 'preview' | 'updatedAt'> {
    const splitMode = normalizeSplitMode(record.splitMode);
    const sourceImagePolicy = normalizeSourceImagePolicy(record.sourceImagePolicy);
    return {
        source: normalizeDraftSource(record.source),
        sourceText: trimString(record.sourceText),
        sourceImageCount: normalizeCount(record.sourceImageCount, 0),
        sourceImageNames: normalizeStringArray(record.sourceImageNames),
        planningMode: record.planningMode === 'content-split' ||
            record.planningMode === 'variant-exploration' ||
            record.planningMode === 'reference-variant' ||
            record.planningMode === 'mixed' ||
            record.planningMode === 'manual-split' ||
            record.planningMode === 'json-import'
            ? record.planningMode
            : 'auto',
        countMode: record.countMode === 'fixed' ? 'fixed' : 'auto',
        ...(record.targetCount !== undefined ? { targetCount: normalizeCount(record.targetCount, 6) } : {}),
        maxCount: normalizeCount(record.maxCount, 12),
        adjustmentInstruction: trimString(record.adjustmentInstruction).slice(0, MAX_ADJUSTMENT_LENGTH),
        ...(splitMode ? { splitMode } : {}),
        ...(record.customDelimiter !== undefined ? { customDelimiter: trimString(record.customDelimiter).slice(0, 120) } : {}),
        ...(typeof record.trimWhitespace === 'boolean' ? { trimWhitespace: record.trimWhitespace } : {}),
        ...(typeof record.ignoreEmpty === 'boolean' ? { ignoreEmpty: record.ignoreEmpty } : {}),
        ...(typeof record.collapseWhitespace === 'boolean' ? { collapseWhitespace: record.collapseWhitespace } : {}),
        ...(typeof record.preserveParagraphLineBreaks === 'boolean'
            ? { preserveParagraphLineBreaks: record.preserveParagraphLineBreaks }
            : {}),
        ...(record.promptPrefix !== undefined ? { promptPrefix: trimString(record.promptPrefix).slice(0, 4000) } : {}),
        ...(record.promptSuffix !== undefined ? { promptSuffix: trimString(record.promptSuffix).slice(0, 4000) } : {}),
        ...(sourceImagePolicy ? { sourceImagePolicy } : {}),
        ...(record.jsonImportText !== undefined
            ? { jsonImportText: trimString(record.jsonImportText).slice(0, MAX_JSON_IMPORT_DRAFT_LENGTH) }
            : {})
    };
}

function normalizePreview(value: unknown, fallback: Omit<BatchPlanDraft, 'preview' | 'updatedAt'>): BatchPlan | null {
    if (!isRecord(value)) return null;
    try {
        return normalizeBatchPlan(value, {
            sourceText: fallback.sourceText,
            sourceImageCount: fallback.sourceImageCount,
            planningMode: fallback.planningMode,
            countMode: fallback.countMode,
            ...(fallback.targetCount !== undefined ? { targetCount: fallback.targetCount } : {}),
            maxCount: fallback.maxCount,
            adjustmentInstruction: fallback.adjustmentInstruction
        });
    } catch (error) {
        console.warn('[batch-plan-draft] failed to normalize preview', error);
        return null;
    }
}

function normalizeDraft(value: unknown): BatchPlanDraft | null {
    if (!isRecord(value)) return null;

    const fallback = buildFallbackDraft(value);
    const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now();
    const preview = normalizePreview(value.preview, fallback);
    const formSnapshot = normalizeFormSnapshot(value.formSnapshot);

    return {
        ...fallback,
        ...(formSnapshot ? { formSnapshot } : {}),
        ...(preview ? { preview } : {}),
        updatedAt
    };
}

function serializeDraft(draft: BatchPlanDraft): string {
    const compactPreview =
        draft.preview && JSON.stringify(draft.preview).length > MAX_DRAFT_BYTES / 2
            ? {
                  ...draft.preview,
                  tasks: draft.preview.tasks.slice(0, 12).map((task) => ({
                      ...task,
                      prompt: task.prompt.slice(0, 1000),
                      ...(task.negativePrompt ? { negativePrompt: task.negativePrompt.slice(0, 400) } : {}),
                      ...(task.notes ? { notes: task.notes.slice(0, 400) } : {})
                  }))
              }
            : draft.preview;

    const candidate: BatchPlanDraft = {
        ...draft,
        sourceText: draft.sourceText,
        sourceImageNames: draft.sourceImageNames.slice(0, MAX_SOURCE_IMAGE_NAMES),
        adjustmentInstruction: draft.adjustmentInstruction.slice(0, MAX_ADJUSTMENT_LENGTH),
        ...(draft.jsonImportText
            ? { jsonImportText: draft.jsonImportText.slice(0, MAX_JSON_IMPORT_DRAFT_LENGTH) }
            : {}),
        ...(compactPreview ? { preview: compactPreview } : {})
    };

    const json = JSON.stringify(candidate);
    if (json.length <= MAX_DRAFT_BYTES) return json;

    const trimmed: BatchPlanDraft = {
        ...candidate,
        preview: candidate.preview
            ? {
                  ...candidate.preview,
                  tasks: candidate.preview.tasks.slice(0, 6).map((task) => ({
                      ...task,
                      prompt: task.prompt.slice(0, 800)
                  }))
              }
            : undefined
    };

    const trimmedJson = JSON.stringify(trimmed);
    if (trimmedJson.length <= MAX_DRAFT_BYTES) return trimmedJson;

    return JSON.stringify({
        ...trimmed,
        preview: trimmed.preview ? { ...trimmed.preview, tasks: [] } : undefined
    });
}

export function loadBatchPlanDraft(): BatchPlanDraft | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return normalizeDraft(JSON.parse(raw));
    } catch (error) {
        console.warn('[batch-plan-draft] failed to load draft', error);
        return null;
    }
}

export function saveBatchPlanDraft(draft: BatchPlanDraft): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STORAGE_KEY, serializeDraft(draft));
    } catch (error) {
        console.warn('[batch-plan-draft] failed to save draft', error);
    }
}

export function clearBatchPlanDraft(): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('[batch-plan-draft] failed to clear draft', error);
    }
}

export function hasMeaningfulBatchPlanDraft(): boolean {
    const draft = loadBatchPlanDraft();
    return Boolean(draft && (draft.sourceText.trim() || draft.preview?.tasks.length));
}
