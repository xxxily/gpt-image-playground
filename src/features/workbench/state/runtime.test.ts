import { describe, expect, it, vi } from 'vitest';
import { isEditablePasteTarget, parseServerRuntimeConfig, prefersReducedMotion } from './runtime';

describe('workbench runtime helpers', () => {
    it('normalizes server runtime config flags', () => {
        expect(parseServerRuntimeConfig({ clientDirectLinkPriority: true })).toEqual({
            clientDirectLinkPriority: true
        });
        expect(parseServerRuntimeConfig({ clientDirectLinkPriority: 'true' })).toEqual({});
        expect(parseServerRuntimeConfig(null)).toEqual({});
    });

    it('returns false for editable target checks outside the browser DOM', () => {
        expect(isEditablePasteTarget(null)).toBe(false);
        expect(isEditablePasteTarget({} as EventTarget)).toBe(false);
    });

    it('reads reduced motion only when matchMedia is available', () => {
        expect(prefersReducedMotion()).toBe(false);
        vi.stubGlobal('window', {
            matchMedia: vi.fn().mockReturnValue({ matches: true })
        });
        expect(prefersReducedMotion()).toBe(true);
        vi.unstubAllGlobals();
    });
});
