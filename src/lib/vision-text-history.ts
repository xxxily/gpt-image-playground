import type { ProviderUsage } from '@/lib/provider-types';
import {
    DEFAULT_VISION_TEXT_API_COMPATIBILITY,
    DEFAULT_VISION_TEXT_DETAIL,
    DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
    DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
    DEFAULT_VISION_TEXT_TASK_TYPE,
    VISION_TEXT_TASK_TYPES,
    type ImageToTextStructuredResult,
    type VisionTextApiCompatibility,
    type VisionTextDetail,
    type VisionTextProviderKind,
    type VisionTextResponseFormat,
    type VisionTextTaskType
} from '@/lib/vision-text-types';
import type {
    HistoryImageSyncStatus,
    ImageStorageMode,
    VisionTextHistoryMetadata,
    VisionTextHistorySyncStatus,
    VisionTextSourceImageRef
} from '@/types/history';

export const VISION_TEXT_HISTORY_STORAGE_KEY = 'gpt-image-playground-vision-text-history';
export const DEFAULT_VISION_TEXT_HISTORY_LIMIT = 200;

export type VisionTextHistoryLoadResult = {
    history: VisionTextHistoryMetadata[];
    /** Preserve raw storage on the next save cycle to avoid overwriting recoverable malformed data. */
    shouldPreserveStoredValue: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function normalizeString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function isImageStorageMode(value: unknown): value is ImageStorageMode {
    return value === 'fs' || value === 'indexeddb' || value === 'url';
}

function isHistoryImageSyncStatus(value: unknown): value is HistoryImageSyncStatus {
    return value === 'local_only' || value === 'pending_upload' || value === 'synced' || value === 'conflict';
}

function isVisionTextHistorySyncStatus(value: unknown): value is VisionTextHistorySyncStatus {
    return (
        value === 'local_only' ||
        value === 'pending_upload' ||
        value === 'synced' ||
        value === 'partial' ||
        value === 'conflict'
    );
}

function isVisionTextProviderKind(value: unknown): value is VisionTextProviderKind {
    return value === 'openai' || value === 'openai-compatible';
}

function isVisionTextApiCompatibility(value: unknown): value is VisionTextApiCompatibility {
    return value === 'responses' || value === 'chat-completions';
}

function isVisionTextDetail(value: unknown): value is VisionTextDetail {
    return value === 'auto' || value === 'low' || value === 'high' || value === 'original';
}

function isVisionTextResponseFormat(value: unknown): value is VisionTextResponseFormat {
    return value === 'text' || value === 'json_schema';
}

function isVisionTextTaskType(value: unknown): value is VisionTextTaskType {
    return typeof value === 'string' && (VISION_TEXT_TASK_TYPES as readonly string[]).includes(value);
}

function isVisionTextSource(value: unknown): value is VisionTextSourceImageRef['source'] {
    return (
        value === 'uploaded' ||
        value === 'clipboard' ||
        value === 'history-image' ||
        value === 'remote-url' ||
        value === 'restored'
    );
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

function normalizeStructuredResult(value: unknown): ImageToTextStructuredResult | null {
    if (!isRecord(value)) return null;

    return {
        summary: normalizeString(value.summary),
        prompt: normalizeString(value.prompt),
        negativePrompt: normalizeString(value.negativePrompt),
        styleTags: normalizeStringArray(value.styleTags),
        subject: normalizeString(value.subject),
        composition: normalizeString(value.composition),
        lighting: normalizeString(value.lighting),
        colorPalette: normalizeString(value.colorPalette),
        materials: normalizeString(value.materials),
        textInImage: normalizeString(value.textInImage),
        aspectRatioRecommendation: normalizeString(value.aspectRatioRecommendation),
        generationNotes: normalizeString(value.generationNotes),
        warnings: normalizeStringArray(value.warnings)
    };
}

function normalizeProviderUsage(value: unknown): ProviderUsage | undefined {
    if (!isRecord(value)) return undefined;
    const usage: ProviderUsage = {};

    if (isFiniteNumber(value.output_tokens) && value.output_tokens >= 0) {
        usage.output_tokens = value.output_tokens;
    }

    if (isRecord(value.input_tokens_details)) {
        const details: NonNullable<ProviderUsage['input_tokens_details']> = {};
        if (
            isFiniteNumber(value.input_tokens_details.text_tokens) &&
            value.input_tokens_details.text_tokens >= 0
        ) {
            details.text_tokens = value.input_tokens_details.text_tokens;
        }
        if (
            isFiniteNumber(value.input_tokens_details.image_tokens) &&
            value.input_tokens_details.image_tokens >= 0
        ) {
            details.image_tokens = value.input_tokens_details.image_tokens;
        }
        if (Object.keys(details).length > 0) usage.input_tokens_details = details;
    }

    return Object.keys(usage).length > 0 ? usage : undefined;
}

export function normalizeVisionTextSourceImageRef(value: unknown): VisionTextSourceImageRef | null {
    if (!isRecord(value)) return null;

    const filename = normalizeString(value.filename).trim();
    if (!filename) return null;

    const storageModeUsed = isImageStorageMode(value.storageModeUsed) ? value.storageModeUsed : 'indexeddb';
    const source = isVisionTextSource(value.source) ? value.source : 'uploaded';
    const path = normalizeOptionalString(value.path);
    const mimeType = normalizeOptionalString(value.mimeType);
    const sha256 = normalizeOptionalString(value.sha256);
    const syncStatus = isHistoryImageSyncStatus(value.syncStatus) ? value.syncStatus : undefined;
    const size = isFiniteNumber(value.size) && value.size >= 0 ? value.size : undefined;
    const width = isFiniteNumber(value.width) && value.width > 0 ? value.width : undefined;
    const height = isFiniteNumber(value.height) && value.height > 0 ? value.height : undefined;

    return {
        filename,
        storageModeUsed,
        source,
        ...(path ? { path } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(size !== undefined ? { size } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(sha256 ? { sha256 } : {}),
        ...(syncStatus ? { syncStatus } : {})
    };
}

export function normalizeVisionTextHistoryMetadata(value: unknown): VisionTextHistoryMetadata | null {
    if (!isRecord(value)) return null;

    const timestamp = value.timestamp;
    if (!isFiniteNumber(timestamp) || timestamp <= 0) return null;

    const rawId = normalizeString(value.id).trim();
    const id = rawId || `vision_text_${timestamp}`;
    const sourceImages = Array.isArray(value.sourceImages)
        ? value.sourceImages
              .map(normalizeVisionTextSourceImageRef)
              .filter((image): image is VisionTextSourceImageRef => image !== null)
        : [];
    if (sourceImages.length === 0) return null;

    const syncStatus = isVisionTextHistorySyncStatus(value.syncStatus) ? value.syncStatus : undefined;
    const usage = normalizeProviderUsage(value.usage);
    const structuredResult = normalizeStructuredResult(value.structuredResult);

    return {
        id,
        type: 'image-to-text',
        timestamp,
        durationMs: isFiniteNumber(value.durationMs) && value.durationMs >= 0 ? value.durationMs : 0,
        prompt: normalizeString(value.prompt),
        taskType: isVisionTextTaskType(value.taskType) ? value.taskType : DEFAULT_VISION_TEXT_TASK_TYPE,
        detail: isVisionTextDetail(value.detail) ? value.detail : DEFAULT_VISION_TEXT_DETAIL,
        responseFormat: isVisionTextResponseFormat(value.responseFormat)
            ? value.responseFormat
            : DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
        structuredOutputEnabled:
            typeof value.structuredOutputEnabled === 'boolean' ? value.structuredOutputEnabled : Boolean(structuredResult),
        maxOutputTokens:
            isFiniteNumber(value.maxOutputTokens) && value.maxOutputTokens > 0
                ? Math.floor(value.maxOutputTokens)
                : DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
        sourceImages,
        resultText: normalizeString(value.resultText),
        structuredResult,
        providerKind: isVisionTextProviderKind(value.providerKind) ? value.providerKind : 'openai',
        providerInstanceId: normalizeString(value.providerInstanceId),
        ...(normalizeOptionalString(value.providerInstanceName)
            ? { providerInstanceName: normalizeOptionalString(value.providerInstanceName) }
            : {}),
        model: normalizeString(value.model),
        apiCompatibility: isVisionTextApiCompatibility(value.apiCompatibility)
            ? value.apiCompatibility
            : DEFAULT_VISION_TEXT_API_COMPATIBILITY,
        ...(usage ? { usage } : {}),
        ...(syncStatus ? { syncStatus } : {})
    };
}

export function loadVisionTextHistory(): VisionTextHistoryLoadResult {
    const emptyResult: VisionTextHistoryLoadResult = { history: [], shouldPreserveStoredValue: false };

    if (typeof window === 'undefined') return emptyResult;

    try {
        const raw = window.localStorage.getItem(VISION_TEXT_HISTORY_STORAGE_KEY);
        if (!raw) return emptyResult;

        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            console.warn('Invalid vision text history data found in localStorage. Data preserved for recovery.');
            return { history: [], shouldPreserveStoredValue: true };
        }

        const history = parsed
            .map(normalizeVisionTextHistoryMetadata)
            .filter((entry): entry is VisionTextHistoryMetadata => entry !== null)
            .sort((a, b) => b.timestamp - a.timestamp);

        return {
            history,
            shouldPreserveStoredValue: history.length !== parsed.length
        };
    } catch (error) {
        console.warn('Failed to load or parse vision text history. Data preserved for recovery:', error);
        return { history: [], shouldPreserveStoredValue: true };
    }
}

export function saveVisionTextHistory(
    history: VisionTextHistoryMetadata[],
    limit = DEFAULT_VISION_TEXT_HISTORY_LIMIT
): boolean {
    if (typeof window === 'undefined') return true;

    const normalizedLimit = Math.max(100, Math.floor(limit || DEFAULT_VISION_TEXT_HISTORY_LIMIT));
    const sortedHistory = [...history]
        .map(normalizeVisionTextHistoryMetadata)
        .filter((entry): entry is VisionTextHistoryMetadata => entry !== null)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, normalizedLimit);

    try {
        window.localStorage.setItem(VISION_TEXT_HISTORY_STORAGE_KEY, JSON.stringify(sortedHistory));
        return true;
    } catch (error) {
        console.error('Failed to save vision text history to localStorage:', error);
        return false;
    }
}

export function clearVisionTextHistoryLocalStorage(): boolean {
    if (typeof window === 'undefined') return true;

    try {
        window.localStorage.removeItem(VISION_TEXT_HISTORY_STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Failed to clear vision text history from localStorage:', error);
        return false;
    }
}

export function mergeRestoredVisionTextHistory(
    current: VisionTextHistoryMetadata[],
    restored: VisionTextHistoryMetadata[]
): VisionTextHistoryMetadata[] {
    const merged = new Map<string, VisionTextHistoryMetadata>();

    for (const entry of current) {
        const normalized = normalizeVisionTextHistoryMetadata(entry);
        if (normalized) merged.set(normalized.id, normalized);
    }

    for (const entry of restored) {
        const normalized = normalizeVisionTextHistoryMetadata(entry);
        if (!normalized) continue;
        const existing = merged.get(normalized.id);
        merged.set(normalized.id, existing ? { ...existing, ...normalized } : normalized);
    }

    return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
}
