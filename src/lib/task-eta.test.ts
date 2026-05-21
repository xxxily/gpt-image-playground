import { describe, expect, it } from 'vitest';
import { computeEtaState, estimateTaskDurationMs } from './task-eta';

describe('estimateTaskDurationMs', () => {
    it('returns null on empty samples', () => {
        expect(estimateTaskDurationMs({ samples: [] })).toBeNull();
    });

    it('skips invalid durations', () => {
        const result = estimateTaskDurationMs({
            samples: [
                { durationMs: 0 },
                { durationMs: -1 },
                { durationMs: Number.NaN }
            ]
        });
        expect(result).toBeNull();
    });

    it('averages exact (model, size, n) matches when enough samples exist', () => {
        const samples = [
            { durationMs: 1000, model: 'gpt-image-1', sizeKey: '1024x1024', n: 1 },
            { durationMs: 2000, model: 'gpt-image-1', sizeKey: '1024x1024', n: 1 },
            { durationMs: 3000, model: 'gpt-image-1', sizeKey: '1024x1024', n: 1 },
            { durationMs: 9000, model: 'other', sizeKey: '1024x1024', n: 1 }
        ];
        const result = estimateTaskDurationMs({
            samples,
            model: 'gpt-image-1',
            sizeKey: '1024x1024',
            n: 1
        });
        expect(result).toBe(2000);
    });

    it('falls back to model-only when exact match is too sparse', () => {
        const samples = [
            { durationMs: 1000, model: 'gpt-image-1', sizeKey: '1024x1024', n: 1 },
            { durationMs: 3000, model: 'gpt-image-1', sizeKey: '512x512', n: 2 },
            { durationMs: 2000, model: 'gpt-image-1', sizeKey: '512x512', n: 4 }
        ];
        const result = estimateTaskDurationMs({
            samples,
            model: 'gpt-image-1',
            sizeKey: '2048x2048',
            n: 1
        });
        expect(result).toBe(2000);
    });

    it('falls back to global mean when nothing matches', () => {
        const samples = [
            { durationMs: 1000, model: 'a' },
            { durationMs: 5000, model: 'b' }
        ];
        const result = estimateTaskDurationMs({ samples, model: 'nonexistent' });
        expect(result).toBe(3000);
    });

    it('respects sampleLimit by taking only the most recent items', () => {
        const samples = [
            { durationMs: 100 },
            { durationMs: 100 },
            { durationMs: 100 },
            { durationMs: 100 },
            { durationMs: 1000 },
            { durationMs: 1000 },
            { durationMs: 1000 }
        ];
        const result = estimateTaskDurationMs({ samples, sampleLimit: 3 });
        expect(result).toBe(1000);
    });

    it('clamps via maxBoundMs', () => {
        const samples = [{ durationMs: 999_999_999 }];
        const result = estimateTaskDurationMs({ samples, maxBoundMs: 60_000 });
        expect(result).toBe(60_000);
    });
});

describe('computeEtaState', () => {
    it('overrun when etaMs is missing', () => {
        expect(computeEtaState(2000, null).phase).toBe('overrun');
        expect(computeEtaState(2000, undefined).phase).toBe('overrun');
    });

    it('estimating while elapsed < etaMs', () => {
        const state = computeEtaState(2000, 5000);
        expect(state.phase).toBe('estimating');
        expect(state.remainingMs).toBe(3000);
    });

    it('overrun when elapsed exceeds eta', () => {
        const state = computeEtaState(6000, 5000);
        expect(state.phase).toBe('overrun');
        expect(state.elapsedMs).toBe(6000);
    });

    it('handles zero etaMs as overrun', () => {
        const state = computeEtaState(1000, 0);
        expect(state.phase).toBe('overrun');
    });
});
