import { describe, expect, it } from 'vitest';
import { collectHistoryImageTimestamps } from './history-timestamps';
import type { HistoryMetadata } from '@/types/history';

describe('collectHistoryImageTimestamps', () => {
    it('indexes image filenames by their history entry timestamp', () => {
        const history = [
            {
                timestamp: 10,
                images: [{ filename: 'a.png' }, { filename: 'b.png' }]
            },
            {
                timestamp: 20,
                images: [{ filename: 'a.png' }]
            }
        ] as HistoryMetadata[];

        expect(Array.from(collectHistoryImageTimestamps(history).entries())).toEqual([
            ['a.png', 20],
            ['b.png', 10]
        ]);
    });
});
