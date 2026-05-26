import { normalizeImageFormPreferences } from '@/lib/form-preferences';
import { describe, expect, it } from 'vitest';

describe('normalizeImageFormPreferences', () => {
    it('preserves scenario-selected sizes when the marker matches the stored size', () => {
        const preferences = normalizeImageFormPreferences({
            model: 'gpt-image-2',
            size: '1536x2048',
            scenarioSelectedSize: '1536x2048'
        });

        expect(preferences.size).toBe('1536x2048');
        expect(preferences.scenarioSelectedSize).toBe('1536x2048');
    });

    it('clears stale scenario-selected markers when they no longer match the size', () => {
        const preferences = normalizeImageFormPreferences({
            model: 'gpt-image-2',
            size: '1536x2048',
            scenarioSelectedSize: '2048x1536'
        });

        expect(preferences.size).toBe('1536x2048');
        expect(preferences.scenarioSelectedSize).toBeNull();
    });

    it('does not treat legacy size presets as scenario-selected sizes', () => {
        const preferences = normalizeImageFormPreferences({
            model: 'gpt-image-2',
            size: 'auto',
            scenarioSelectedSize: 'auto'
        });

        expect(preferences.size).toBe('auto');
        expect(preferences.scenarioSelectedSize).toBeNull();
    });
});
