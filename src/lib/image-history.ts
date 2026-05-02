import { isImageModelId } from '@/lib/model-registry';
import type { CostDetails } from '@/lib/cost-utils';
import type {
    HistoryImage,
    HistoryMetadata,
    ImageBackground,
    ImageModeration,
    ImageOutputFormat,
    ImageQuality,
    ImageStorageMode
} from '@/types/history';

export const IMAGE_HISTORY_STORAGE_KEY = 'openaiImageHistory';

export type ImageHistoryLoadResult = {
    history: HistoryMetadata[];
    /** Preserve raw storage on the next save cycle to avoid overwriting recoverable malformed data. */
    shouldPreserveStoredValue: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isImageQuality(value: unknown): value is ImageQuality {
    return value === 'low' || value === 'medium' || value === 'high' || value === 'auto';
}

function isImageBackground(value: unknown): value is ImageBackground {
    return value === 'transparent' || value === 'opaque' || value === 'auto';
}

function isImageModeration(value: unknown): value is ImageModeration {
    return value === 'low' || value === 'auto';
}

function isImageOutputFormat(value: unknown): value is ImageOutputFormat {
    return value === 'png' || value === 'jpeg' || value === 'webp';
}

function isImageStorageMode(value: unknown): value is ImageStorageMode {
    return value === 'fs' || value === 'indexeddb' || value === 'url';
}

function normalizeHistoryImage(value: unknown): HistoryImage | null {
    if (!isRecord(value)) return null;

    const filename = typeof value.filename === 'string' ? value.filename.trim() : '';
    if (!filename) return null;

    const path = typeof value.path === 'string' && value.path.trim() ? value.path : undefined;
    return path ? { filename, path } : { filename };
}

function normalizeCostDetails(value: unknown): CostDetails | null {
    if (!isRecord(value)) return null;

    const estimatedCostUsd = value.estimated_cost_usd;
    const textInputTokens = value.text_input_tokens;
    const imageInputTokens = value.image_input_tokens;
    const imageOutputTokens = value.image_output_tokens;

    if (
        !isFiniteNumber(estimatedCostUsd) ||
        !isFiniteNumber(textInputTokens) ||
        !isFiniteNumber(imageInputTokens) ||
        !isFiniteNumber(imageOutputTokens)
    ) {
        return null;
    }

    return {
        estimated_cost_usd: estimatedCostUsd,
        text_input_tokens: textInputTokens,
        image_input_tokens: imageInputTokens,
        image_output_tokens: imageOutputTokens
    };
}

function normalizeHistoryMetadata(value: unknown): HistoryMetadata | null {
    if (!isRecord(value)) return null;

    const timestamp = value.timestamp;
    if (!isFiniteNumber(timestamp) || timestamp <= 0) return null;

    if (!Array.isArray(value.images)) return null;
    const images = value.images.map(normalizeHistoryImage).filter((image): image is HistoryImage => image !== null);
    if (images.length === 0) return null;

    const history: HistoryMetadata = {
        timestamp,
        images,
        durationMs: isFiniteNumber(value.durationMs) && value.durationMs >= 0 ? value.durationMs : 0,
        quality: isImageQuality(value.quality) ? value.quality : 'auto',
        background: isImageBackground(value.background) ? value.background : 'auto',
        moderation: isImageModeration(value.moderation) ? value.moderation : 'auto',
        prompt: typeof value.prompt === 'string' ? value.prompt : '',
        mode: value.mode === 'edit' ? 'edit' : 'generate',
        costDetails: normalizeCostDetails(value.costDetails)
    };

    if (isImageStorageMode(value.storageModeUsed)) {
        history.storageModeUsed = value.storageModeUsed;
    }

    if (isImageOutputFormat(value.output_format)) {
        history.output_format = value.output_format;
    }

    if (isImageModelId(value.model)) {
        history.model = value.model;
    }

    return history;
}

/**
 * Safely load image history from localStorage.
 *
 * Returns an empty array when data is malformed or non-array,
 * but preserves the raw localStorage value for potential recovery.
 */
export function loadImageHistory(): ImageHistoryLoadResult {
    const emptyResult: ImageHistoryLoadResult = { history: [], shouldPreserveStoredValue: false };

    if (typeof window === 'undefined') return emptyResult;

    try {
        const raw = window.localStorage.getItem(IMAGE_HISTORY_STORAGE_KEY);
        if (!raw) return emptyResult;

        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            console.warn('Invalid image history data found in localStorage (not an array). Data preserved for recovery.');
            return { history: [], shouldPreserveStoredValue: true };
        }

        const history = parsed
            .map(normalizeHistoryMetadata)
            .filter((entry): entry is HistoryMetadata => entry !== null)
            .sort((a, b) => b.timestamp - a.timestamp);

        return {
            history,
            shouldPreserveStoredValue: history.length !== parsed.length
        };
    } catch (error) {
        console.warn('Failed to load or parse image history from localStorage. Data preserved for recovery:', error);
        return { history: [], shouldPreserveStoredValue: true };
    }
}

/**
 * Save image history to localStorage.
 */
export function saveImageHistory(history: HistoryMetadata[]): boolean {
    if (typeof window === 'undefined') return true;

    try {
        window.localStorage.setItem(IMAGE_HISTORY_STORAGE_KEY, JSON.stringify(history));
        return true;
    } catch (error) {
        console.error('Failed to save image history to localStorage:', error);
        return false;
    }
}

/**
 * Remove the image history key from localStorage only.
 * Does NOT affect prompt history or other stored data.
 */
export function clearImageHistoryLocalStorage(): boolean {
    if (typeof window === 'undefined') return true;

    try {
        window.localStorage.removeItem(IMAGE_HISTORY_STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Failed to clear image history from localStorage:', error);
        return false;
    }
}
