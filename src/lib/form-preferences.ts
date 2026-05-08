import type { GptImageModel } from '@/lib/cost-utils';
import { DEFAULT_IMAGE_MODEL, IMAGE_MODEL_IDS, isImageModelId } from '@/lib/model-registry';
import type { SizePreset } from '@/lib/size-utils';
import type { ImageBackground, ImageModeration, ImageOutputFormat, ImageQuality } from '@/types/history';

const FORM_PREFERENCES_STORAGE_KEY = 'gpt-image-playground-form-options';

const SIZE_VALUES = ['auto', 'portrait', 'landscape', 'square', 'custom'] as const;
const QUALITY_VALUES = ['low', 'medium', 'high', 'auto'] as const;
const OUTPUT_FORMAT_VALUES = ['png', 'jpeg', 'webp'] as const;
const BACKGROUND_VALUES = ['transparent', 'opaque', 'auto'] as const;
const MODERATION_VALUES = ['low', 'auto'] as const;

export type ImageFormPreferences = {
    providerInstanceId: string;
    model: GptImageModel;
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: ImageQuality;
    outputFormat: ImageOutputFormat;
    compression: number;
    background: ImageBackground;
    moderation: ImageModeration;
    brushSize: number;
    enableStreaming: boolean;
    partialImages: 1 | 2 | 3;
};

export const DEFAULT_IMAGE_FORM_PREFERENCES: ImageFormPreferences = {
    providerInstanceId: '',
    model: DEFAULT_IMAGE_MODEL,
    n: 1,
    size: 'auto',
    customWidth: 1024,
    customHeight: 1024,
    quality: 'auto',
    outputFormat: 'png',
    compression: 100,
    background: 'auto',
    moderation: 'low',
    brushSize: 20,
    enableStreaming: false,
    partialImages: 2
};

const pendingPreferenceSave = {
    timer: undefined as number | undefined,
    preferences: undefined as ImageFormPreferences | undefined
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function imageModelValue(value: unknown, fallback: GptImageModel): GptImageModel {
    return isImageModelId(value) ? value.trim() : fallback;
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function intInRange(value: unknown, fallback: number, min: number, max: number): number {
    return Math.round(numberInRange(value, fallback, min, max));
}

function partialImagesValue(value: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 {
    if (value === 1 || value === 2 || value === 3) return value;
    return fallback;
}

export function normalizeImageFormPreferences(value: unknown): ImageFormPreferences {
    if (!isRecord(value)) return DEFAULT_IMAGE_FORM_PREFERENCES;

    return {
        providerInstanceId: typeof value.providerInstanceId === 'string' ? value.providerInstanceId.trim() : DEFAULT_IMAGE_FORM_PREFERENCES.providerInstanceId,
        model: imageModelValue(value.model, DEFAULT_IMAGE_FORM_PREFERENCES.model),
        n: intInRange(value.n, DEFAULT_IMAGE_FORM_PREFERENCES.n, 1, 10),
        size: oneOf(value.size, SIZE_VALUES, DEFAULT_IMAGE_FORM_PREFERENCES.size),
        customWidth: intInRange(value.customWidth, DEFAULT_IMAGE_FORM_PREFERENCES.customWidth, 16, 3840),
        customHeight: intInRange(value.customHeight, DEFAULT_IMAGE_FORM_PREFERENCES.customHeight, 16, 3840),
        quality: oneOf(value.quality, QUALITY_VALUES, DEFAULT_IMAGE_FORM_PREFERENCES.quality),
        outputFormat: oneOf(value.outputFormat, OUTPUT_FORMAT_VALUES, DEFAULT_IMAGE_FORM_PREFERENCES.outputFormat),
        compression: intInRange(value.compression, DEFAULT_IMAGE_FORM_PREFERENCES.compression, 0, 100),
        background: oneOf(value.background, BACKGROUND_VALUES, DEFAULT_IMAGE_FORM_PREFERENCES.background),
        moderation: oneOf(value.moderation, MODERATION_VALUES, DEFAULT_IMAGE_FORM_PREFERENCES.moderation),
        brushSize: intInRange(value.brushSize, DEFAULT_IMAGE_FORM_PREFERENCES.brushSize, 5, 100),
        enableStreaming: typeof value.enableStreaming === 'boolean' ? value.enableStreaming : DEFAULT_IMAGE_FORM_PREFERENCES.enableStreaming,
        partialImages: partialImagesValue(value.partialImages, DEFAULT_IMAGE_FORM_PREFERENCES.partialImages)
    };
}

export function loadImageFormPreferences(): ImageFormPreferences {
    if (typeof window === 'undefined') return DEFAULT_IMAGE_FORM_PREFERENCES;

    try {
        const stored = window.localStorage.getItem(FORM_PREFERENCES_STORAGE_KEY);
        if (!stored) return DEFAULT_IMAGE_FORM_PREFERENCES;
        return normalizeImageFormPreferences(JSON.parse(stored));
    } catch (error) {
        console.warn('Failed to load image form preferences:', error);
        return DEFAULT_IMAGE_FORM_PREFERENCES;
    }
}

export function saveImageFormPreferences(preferences: ImageFormPreferences): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(FORM_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
        console.warn('Failed to save image form preferences:', error);
    }
}

export function scheduleImageFormPreferencesSave(preferences: ImageFormPreferences, delayMs = 500): void {
    if (typeof window === 'undefined') return;

    pendingPreferenceSave.preferences = preferences;
    if (pendingPreferenceSave.timer) {
        window.clearTimeout(pendingPreferenceSave.timer);
    }

    pendingPreferenceSave.timer = window.setTimeout(() => {
        if (pendingPreferenceSave.preferences) {
            saveImageFormPreferences(pendingPreferenceSave.preferences);
            pendingPreferenceSave.preferences = undefined;
        }
        pendingPreferenceSave.timer = undefined;
    }, delayMs);
}

export function flushImageFormPreferencesSave(): void {
    if (typeof window === 'undefined') return;

    if (pendingPreferenceSave.timer) {
        window.clearTimeout(pendingPreferenceSave.timer);
        pendingPreferenceSave.timer = undefined;
    }

    if (pendingPreferenceSave.preferences) {
        saveImageFormPreferences(pendingPreferenceSave.preferences);
        pendingPreferenceSave.preferences = undefined;
    }
}

export const FORM_MODEL_VALUES = IMAGE_MODEL_IDS;
