import {
    DEFAULT_VIDEO_HISTORY_LIMIT,
    VIDEO_HISTORY_STORAGE_KEY,
    normalizeVideoHistoryMetadata,
    type VideoHistoryMetadata
} from '@/lib/video-types';

export type VideoHistoryLoadResult = {
    history: VideoHistoryMetadata[];
    shouldPreserveStoredValue: boolean;
};

export function loadVideoHistory(): VideoHistoryLoadResult {
    const emptyResult: VideoHistoryLoadResult = { history: [], shouldPreserveStoredValue: false };

    if (typeof window === 'undefined') return emptyResult;

    try {
        const raw = window.localStorage.getItem(VIDEO_HISTORY_STORAGE_KEY);
        if (!raw) return emptyResult;

        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            console.warn('Invalid video history data found in localStorage. Data preserved for recovery.');
            return { history: [], shouldPreserveStoredValue: true };
        }

        const history = parsed
            .map(normalizeVideoHistoryMetadata)
            .filter((entry): entry is VideoHistoryMetadata => entry !== null)
            .sort((a, b) => b.timestamp - a.timestamp);

        return {
            history,
            shouldPreserveStoredValue: history.length !== parsed.length
        };
    } catch (error) {
        console.warn('Failed to load or parse video history. Data preserved for recovery:', error);
        return { history: [], shouldPreserveStoredValue: true };
    }
}

export function saveVideoHistory(
    history: VideoHistoryMetadata[],
    limit = DEFAULT_VIDEO_HISTORY_LIMIT
): boolean {
    if (typeof window === 'undefined') return true;

    const normalizedLimit = Math.max(50, Math.floor(limit || DEFAULT_VIDEO_HISTORY_LIMIT));
    const sortedHistory = [...history]
        .map(normalizeVideoHistoryMetadata)
        .filter((entry): entry is VideoHistoryMetadata => entry !== null)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, normalizedLimit);

    try {
        window.localStorage.setItem(VIDEO_HISTORY_STORAGE_KEY, JSON.stringify(sortedHistory));
        return true;
    } catch (error) {
        console.error('Failed to save video history to localStorage:', error);
        return false;
    }
}

export function clearVideoHistoryLocalStorage(): boolean {
    if (typeof window === 'undefined') return true;

    try {
        window.localStorage.removeItem(VIDEO_HISTORY_STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Failed to clear video history from localStorage:', error);
        return false;
    }
}

export function mergeRestoredVideoHistory(
    current: VideoHistoryMetadata[],
    restored: VideoHistoryMetadata[]
): VideoHistoryMetadata[] {
    const merged = new Map<string, VideoHistoryMetadata>();

    for (const entry of current) {
        const normalized = normalizeVideoHistoryMetadata(entry);
        if (normalized) merged.set(normalized.id, normalized);
    }

    for (const entry of restored) {
        const normalized = normalizeVideoHistoryMetadata(entry);
        if (!normalized) continue;
        const existing = merged.get(normalized.id);
        merged.set(normalized.id, existing ? { ...existing, ...normalized } : normalized);
    }

    return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
}
