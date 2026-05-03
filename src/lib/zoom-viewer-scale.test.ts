import { describe, expect, it } from 'vitest';
import { getZoomViewerFitScale } from './zoom-viewer-scale';

describe('getZoomViewerFitScale', () => {
    it('fills the full mobile viewport width without side padding', () => {
        const scale = getZoomViewerFitScale({ width: 800, height: 800 }, { width: 390, height: 844 });

        expect(scale).toBeCloseTo(390 / 800);
    });

    it('upscales small images on mobile so one viewport edge is filled', () => {
        const scale = getZoomViewerFitScale({ width: 200, height: 200 }, { width: 390, height: 844 });

        expect(scale).toBeCloseTo(390 / 200);
    });

    it('uses the height edge for very tall mobile images', () => {
        const scale = getZoomViewerFitScale({ width: 600, height: 1800 }, { width: 390, height: 844 });

        expect(scale).toBeCloseTo(844 / 1800);
    });

    it('keeps the desktop preview padding and avoids upscaling', () => {
        const scale = getZoomViewerFitScale({ width: 500, height: 300 }, { width: 1440, height: 900 });

        expect(scale).toBe(1);
    });

    it('fits large desktop images within the padded viewport', () => {
        const scale = getZoomViewerFitScale({ width: 3000, height: 2000 }, { width: 1440, height: 900 });

        expect(scale).toBeCloseTo((900 - 80) / 2000);
    });
});
