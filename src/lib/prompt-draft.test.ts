import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    clearPromptDraft,
    getMeaningfulPromptDraft,
    hasMeaningfulDraft,
    loadPromptDraft,
    savePromptDraft
} from './prompt-draft';

function createLocalStorageMock() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => {
            store.clear();
        }
    };
}

function installBrowserStorage() {
    const localStorage = createLocalStorageMock();
    vi.stubGlobal('window', { localStorage });
    vi.stubGlobal('localStorage', localStorage);
    return localStorage;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('prompt draft persistence', () => {
    it('does not persist empty or whitespace-only drafts', () => {
        const localStorage = installBrowserStorage();

        savePromptDraft('edit', 'usable draft');
        expect(loadPromptDraft('edit')).toBe('usable draft');

        savePromptDraft('edit', '   ');
        expect(localStorage.getItem('gpt_image_playground.prompt_draft.edit.v1')).toBeNull();
    });

    it('only treats trimmed drafts above the threshold as recoverable', () => {
        installBrowserStorage();

        savePromptDraft('generate', '   ');
        expect(hasMeaningfulDraft('generate')).toBe(false);
        expect(getMeaningfulPromptDraft('generate')).toBeNull();

        savePromptDraft('generate', '1234567');
        expect(hasMeaningfulDraft('generate')).toBe(false);

        savePromptDraft('generate', ' 12345678 ');
        expect(hasMeaningfulDraft('generate')).toBe(true);
        expect(getMeaningfulPromptDraft('generate')).toBe(' 12345678 ');

        clearPromptDraft('generate');
        expect(getMeaningfulPromptDraft('generate')).toBeNull();
    });
});
