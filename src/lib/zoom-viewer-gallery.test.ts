import { describe, expect, it } from 'vitest';
import {
    applyGalleryBoundaryResistance,
    createSwipeState,
    getGalleryCommitThreshold,
    updateSwipeState,
    markSwipeAsMultiTouch,
    resolveSwipeGesture,
    resolvePanGesture,
    resolveGalleryDragOffsets,
    resolveGalleryDragTarget,
    resolveNextIndex,
    getHorizontalPanLimit,
    shouldNavigateWhenZoomed,
    SWIPE_NAVIGATION_THRESHOLD,
} from './zoom-viewer-gallery';

describe('createSwipeState', () => {
    it('initializes with given coordinates', () => {
        const state = createSwipeState(100, 200);
        expect(state.startX).toBe(100);
        expect(state.startY).toBe(200);
        expect(state.currentX).toBe(100);
        expect(state.currentY).toBe(200);
        expect(state.isMultiTouch).toBe(false);
    });

    it('can be initialized as multi-touch', () => {
        const state = createSwipeState(100, 200, true);
        expect(state.isMultiTouch).toBe(true);
    });
});

describe('updateSwipeState', () => {
    it('updates current position without mutating start', () => {
        const state = createSwipeState(100, 200);
        const updated = updateSwipeState(state, 300, 250);

        expect(updated.startX).toBe(100);
        expect(updated.currentX).toBe(300);
        expect(updated.currentY).toBe(250);
        expect(state.currentX).toBe(100);
    });
});

describe('markSwipeAsMultiTouch', () => {
    it('sets isMultiTouch flag', () => {
        const state = createSwipeState(100, 200);
        const updated = markSwipeAsMultiTouch(state);
        expect(updated.isMultiTouch).toBe(true);
    });
});

describe('resolveSwipeGesture', () => {
    const threshold = SWIPE_NAVIGATION_THRESHOLD;

    it('returns left for horizontal swipe beyond threshold', () => {
        const state = updateSwipeState(createSwipeState(300, 400), 100, 405);
        expect(resolveSwipeGesture(state)).toBe('left');
    });

    it('returns right for horizontal swipe beyond threshold', () => {
        const state = updateSwipeState(createSwipeState(100, 400), 300, 405);
        expect(resolveSwipeGesture(state)).toBe('right');
    });

    it('returns null when below threshold', () => {
        const state = updateSwipeState(createSwipeState(200, 400), 220, 400);
        expect(resolveSwipeGesture(state)).toBeNull();
    });

    it('returns null for vertical-dominant swipes', () => {
        const state = updateSwipeState(createSwipeState(200, 400), 240, 500);
        expect(resolveSwipeGesture(state)).toBeNull();
    });

    it('returns null for multi-touch', () => {
        const state = markSwipeAsMultiTouch(updateSwipeState(createSwipeState(100, 400), 300, 400));
        expect(resolveSwipeGesture(state)).toBeNull();
    });

    it('returns exactly at threshold', () => {
        const state = updateSwipeState(createSwipeState(200, 400), 200 + threshold + 1, 400);
        expect(resolveSwipeGesture(state)).toBe('right');
    });

    it('uses custom threshold when provided', () => {
        const state = updateSwipeState(createSwipeState(200, 400), 230, 400);
        expect(resolveSwipeGesture(state, 25)).toBe('right');
        expect(resolveSwipeGesture(state)).toBeNull();
    });
});

describe('resolvePanGesture', () => {
    it('returns right for positive offset delta (drag right)', () => {
        expect(resolvePanGesture(0, 100)).toBe('right');
        expect(resolvePanGesture(100, 0)).toBe('left');
    });

    it('returns left for negative offset delta (drag left)', () => {
        expect(resolvePanGesture(0, -100)).toBe('left');
    });

    it('returns null when below threshold', () => {
        expect(resolvePanGesture(0, 30)).toBeNull();
        expect(resolvePanGesture(0, -30)).toBeNull();
    });

    it('returns direction exactly at threshold', () => {
        expect(resolvePanGesture(0, SWIPE_NAVIGATION_THRESHOLD)).toBe('right');
        expect(resolvePanGesture(0, -SWIPE_NAVIGATION_THRESHOLD)).toBe('left');
    });

    it('uses custom threshold when provided', () => {
        expect(resolvePanGesture(0, 40, 50)).toBeNull();
        expect(resolvePanGesture(0, 40, 30)).toBe('right');
    });
});

describe('resolveNextIndex', () => {
    it('increments on left direction', () => {
        expect(resolveNextIndex(0, 'left', 3)).toBe(1);
        expect(resolveNextIndex(1, 'left', 3)).toBe(2);
    });

    it('decrements on right direction', () => {
        expect(resolveNextIndex(2, 'right', 3)).toBe(1);
        expect(resolveNextIndex(1, 'right', 3)).toBe(0);
    });

    it('returns null at boundaries (no wrapping)', () => {
        expect(resolveNextIndex(2, 'left', 3)).toBeNull();
        expect(resolveNextIndex(0, 'right', 3)).toBeNull();
    });

    it('returns null for single image', () => {
        expect(resolveNextIndex(0, 'left', 1)).toBeNull();
        expect(resolveNextIndex(0, 'right', 1)).toBeNull();
    });

    it('returns null for invalid current index', () => {
        expect(resolveNextIndex(-1, 'left', 3)).toBeNull();
        expect(resolveNextIndex(5, 'left', 3)).toBeNull();
    });

    it('returns null for empty collection', () => {
        expect(resolveNextIndex(0, 'left', 0)).toBeNull();
    });
});

describe('getGalleryCommitThreshold', () => {
    it('uses a proportional viewport threshold for normal screens', () => {
        expect(getGalleryCommitThreshold(400)).toBe(88);
    });

    it('does not go below the swipe threshold', () => {
        expect(getGalleryCommitThreshold(120)).toBe(SWIPE_NAVIGATION_THRESHOLD);
    });

    it('caps the threshold on wide screens', () => {
        expect(getGalleryCommitThreshold(1200)).toBe(160);
    });
});

describe('applyGalleryBoundaryResistance', () => {
    it('keeps the raw offset when an adjacent image exists', () => {
        expect(applyGalleryBoundaryResistance(120, true)).toBe(120);
        expect(applyGalleryBoundaryResistance(-120, true)).toBe(-120);
    });

    it('damps the offset when dragging beyond a gallery boundary', () => {
        expect(applyGalleryBoundaryResistance(120, false)).toBe(42);
        expect(applyGalleryBoundaryResistance(-120, false)).toBe(-42);
    });
});

describe('resolveGalleryDragTarget', () => {
    it('cancels back to center when drag distance is below threshold', () => {
        expect(resolveGalleryDragTarget(-70, 0, 3, 400)).toEqual({
            direction: 'left',
            nextIndex: 1,
            shouldNavigate: false,
            targetOffsetX: 0,
        });
    });

    it('commits to the next image when left drag crosses threshold', () => {
        expect(resolveGalleryDragTarget(-120, 0, 3, 400)).toEqual({
            direction: 'left',
            nextIndex: 1,
            shouldNavigate: true,
            targetOffsetX: -400,
        });
    });

    it('commits to the previous image when right drag crosses threshold', () => {
        expect(resolveGalleryDragTarget(120, 2, 3, 400)).toEqual({
            direction: 'right',
            nextIndex: 1,
            shouldNavigate: true,
            targetOffsetX: 400,
        });
    });

    it('cancels at gallery boundaries even when the drag distance is large', () => {
        expect(resolveGalleryDragTarget(180, 0, 3, 400)).toEqual({
            direction: 'right',
            nextIndex: null,
            shouldNavigate: false,
            targetOffsetX: 0,
        });
        expect(resolveGalleryDragTarget(-180, 2, 3, 400)).toEqual({
            direction: 'left',
            nextIndex: null,
            shouldNavigate: false,
            targetOffsetX: 0,
        });
    });
});

describe('resolveGalleryDragOffsets', () => {
    it('uses the whole horizontal drag as gallery offset when not zoomed', () => {
        expect(resolveGalleryDragOffsets(1, 1, -90, 1000, 500)).toEqual({
            imageOffsetX: 0,
            galleryOffsetX: -90,
        });
    });

    it('uses pan offset first while a zoomed image still has room to move', () => {
        expect(resolveGalleryDragOffsets(2, 2, 120, 1000, 500)).toEqual({
            imageOffsetX: 120,
            galleryOffsetX: 0,
        });
    });

    it('converts only the beyond-edge distance into gallery offset for zoomed images', () => {
        const maxOffset = getHorizontalPanLimit(1000, 2, 500);
        expect(resolveGalleryDragOffsets(2, 2, maxOffset + 60, 1000, 500)).toEqual({
            imageOffsetX: maxOffset,
            galleryOffsetX: 60,
        });
        expect(resolveGalleryDragOffsets(2, 2, -maxOffset - 60, 1000, 500)).toEqual({
            imageOffsetX: -maxOffset,
            galleryOffsetX: -60,
        });
    });
});

describe('getHorizontalPanLimit', () => {
    it('returns half of the rendered horizontal overflow', () => {
        expect(getHorizontalPanLimit(1000, 2, 500)).toBe(750);
    });

    it('returns zero when the image does not overflow horizontally', () => {
        expect(getHorizontalPanLimit(500, 1, 800)).toBe(0);
    });

    it('returns zero for invalid rendered overflow', () => {
        expect(getHorizontalPanLimit(500, Number.NaN, 800)).toBe(0);
    });
});

describe('shouldNavigateWhenZoomed', () => {
    it('returns true when not zoomed (scale = 1)', () => {
        expect(shouldNavigateWhenZoomed(1, 1, 0, 1000, 500, 'left')).toBe(true);
        expect(shouldNavigateWhenZoomed(1, 1, 0, 1000, 500, 'right')).toBe(true);
    });

    it('returns true when barely zoomed (scale = 1.05)', () => {
        expect(shouldNavigateWhenZoomed(1.05, 1.05, 0, 1000, 500, 'left')).toBe(true);
    });

    it('returns true when dragged beyond the right edge and navigating to previous image', () => {
        const relativeZoomScale = 2;
        const renderedScale = 2;
        const imageWidth = 1000;
        const viewportWidth = 500;
        const maxOffset = getHorizontalPanLimit(imageWidth, renderedScale, viewportWidth);
        expect(shouldNavigateWhenZoomed(relativeZoomScale, renderedScale, maxOffset + SWIPE_NAVIGATION_THRESHOLD, imageWidth, viewportWidth, 'right')).toBe(true);
    });

    it('returns true when dragged beyond the left edge and navigating to next image', () => {
        const relativeZoomScale = 2;
        const renderedScale = 2;
        const imageWidth = 1000;
        const viewportWidth = 500;
        const maxOffset = getHorizontalPanLimit(imageWidth, renderedScale, viewportWidth);
        expect(shouldNavigateWhenZoomed(relativeZoomScale, renderedScale, -maxOffset - SWIPE_NAVIGATION_THRESHOLD, imageWidth, viewportWidth, 'left')).toBe(true);
    });

    it('returns false when in middle of zoomed image', () => {
        expect(shouldNavigateWhenZoomed(2, 2, 100, 1000, 500, 'left')).toBe(false);
        expect(shouldNavigateWhenZoomed(2, 2, -100, 1000, 500, 'right')).toBe(false);
    });

    it('returns false when at a pan edge but not beyond the overscroll threshold', () => {
        const relativeZoomScale = 2;
        const renderedScale = 2;
        const imageWidth = 1000;
        const viewportWidth = 500;
        const maxOffset = getHorizontalPanLimit(imageWidth, renderedScale, viewportWidth);
        expect(shouldNavigateWhenZoomed(relativeZoomScale, renderedScale, -maxOffset, imageWidth, viewportWidth, 'left')).toBe(false);
        expect(shouldNavigateWhenZoomed(relativeZoomScale, renderedScale, maxOffset, imageWidth, viewportWidth, 'right')).toBe(false);
    });

    it('returns true for zoomed images that still do not overflow horizontally', () => {
        expect(shouldNavigateWhenZoomed(2, 2, 0, 100, 500, 'left')).toBe(true);
    });
});

describe('SWIPE_NAVIGATION_THRESHOLD', () => {
    it('is a deterministic numeric value', () => {
        expect(typeof SWIPE_NAVIGATION_THRESHOLD).toBe('number');
        expect(SWIPE_NAVIGATION_THRESHOLD).toBeGreaterThan(0);
    });
});
