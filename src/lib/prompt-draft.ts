'use client';

/**
 * Draft persistence for prompt textareas.
 *
 * Stores the current prompt to `localStorage` so users can recover
 * unsubmitted drafts after a refresh or accidental navigation.
 * All functions are SSR-safe and catch errors without throwing.
 */

const DRAFT_THRESHOLD = 8;

const STORAGE_KEYS = {
    generate: 'gpt_image_playground.prompt_draft.generate.v1',
    edit: 'gpt_image_playground.prompt_draft.edit.v1'
} as const;

type DraftMode = 'generate' | 'edit';

function getStorageKey(mode: DraftMode): string {
    return STORAGE_KEYS[mode];
}

export function loadPromptDraft(mode: DraftMode): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const key = getStorageKey(mode);
        const raw = localStorage.getItem(key);
        return raw ?? null;
    } catch (error) {
        console.warn('Failed to load prompt draft:', error);
        return null;
    }
}

export function savePromptDraft(mode: DraftMode, value: string): void {
    if (typeof window === 'undefined') return;
    try {
        const key = getStorageKey(mode);
        if (value.trim()) {
            localStorage.setItem(key, value);
        } else {
            localStorage.removeItem(key);
        }
    } catch (error) {
        console.warn('Failed to save prompt draft:', error);
    }
}

export function clearPromptDraft(mode: DraftMode): void {
    if (typeof window === 'undefined') return;
    try {
        const key = getStorageKey(mode);
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('Failed to clear prompt draft:', error);
    }
}

export function hasMeaningfulDraft(mode: DraftMode, threshold = DRAFT_THRESHOLD): boolean {
    return getMeaningfulPromptDraft(mode, threshold) !== null;
}

export function getMeaningfulPromptDraft(mode: DraftMode, threshold = DRAFT_THRESHOLD): string | null {
    const draft = loadPromptDraft(mode);
    if (!draft) return null;
    return draft.trim().length >= threshold ? draft : null;
}
