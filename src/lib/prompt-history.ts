export type PromptHistoryEntry = {
    prompt: string;
    timestamp: number;
};

export const DEFAULT_PROMPT_HISTORY_LIMIT = 20;
export const MIN_PROMPT_HISTORY_LIMIT = 1;
export const MAX_PROMPT_HISTORY_LIMIT = 100;

const PROMPT_HISTORY_STORAGE_KEY = 'gpt-image-playground-prompt-history';
export const PROMPT_HISTORY_CHANGED_EVENT = 'gpt-image-playground-prompt-history-changed';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePromptHistoryEntry(value: unknown): PromptHistoryEntry | null {
    if (!isRecord(value)) return null;

    const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
    const timestamp = typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)
        ? value.timestamp
        : 0;

    if (!prompt || timestamp <= 0) return null;
    return { prompt, timestamp };
}

export function normalizePromptHistoryLimit(value: unknown): number {
    const numericValue = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numericValue)) return DEFAULT_PROMPT_HISTORY_LIMIT;
    return Math.min(MAX_PROMPT_HISTORY_LIMIT, Math.max(MIN_PROMPT_HISTORY_LIMIT, Math.round(numericValue)));
}

export function loadPromptHistory(): PromptHistoryEntry[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = window.localStorage.getItem(PROMPT_HISTORY_STORAGE_KEY);
        if (!stored) return [];

        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map(normalizePromptHistoryEntry)
            .filter((entry): entry is PromptHistoryEntry => entry !== null)
            .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.warn('Failed to load prompt history from localStorage:', error);
        return [];
    }
}

export function savePromptHistoryEntries(entries: PromptHistoryEntry[]): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(entries));
        window.dispatchEvent(new CustomEvent(PROMPT_HISTORY_CHANGED_EVENT));
    } catch (error) {
        console.warn('Failed to save prompt history to localStorage:', error);
    }
}

export function addPromptHistory(prompt: string, limit: number = DEFAULT_PROMPT_HISTORY_LIMIT): PromptHistoryEntry[] {
    const normalizedPrompt = prompt.trim();
    const normalizedLimit = normalizePromptHistoryLimit(limit);

    if (!normalizedPrompt) return loadPromptHistory().slice(0, normalizedLimit);

    const nextHistory = [
        { prompt: normalizedPrompt, timestamp: Date.now() },
        ...loadPromptHistory().filter((entry) => entry.prompt !== normalizedPrompt)
    ].slice(0, normalizedLimit);

    savePromptHistoryEntries(nextHistory);
    return nextHistory;
}

export function removePromptHistory(prompt: string): PromptHistoryEntry[] {
    const nextHistory = loadPromptHistory().filter((entry) => entry.prompt !== prompt.trim());
    savePromptHistoryEntries(nextHistory);
    return nextHistory;
}

export function clearPromptHistory(): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(PROMPT_HISTORY_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent(PROMPT_HISTORY_CHANGED_EVENT));
    } catch (error) {
        console.warn('Failed to clear prompt history from localStorage:', error);
    }
}
