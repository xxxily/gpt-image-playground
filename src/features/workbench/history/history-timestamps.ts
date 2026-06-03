import type { HistoryMetadata } from '@/types/history';

export function collectHistoryImageTimestamps(history: HistoryMetadata[]): Map<string, number> {
    const timestamps = new Map<string, number>();
    for (const entry of history) {
        for (const image of entry.images) {
            timestamps.set(image.filename, entry.timestamp);
        }
    }
    return timestamps;
}
