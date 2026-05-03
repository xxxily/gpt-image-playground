export const SWIPE_NAVIGATION_THRESHOLD = 50;
export const GALLERY_COMMIT_DISTANCE_RATIO = 0.22;
export const GALLERY_COMMIT_MAX_THRESHOLD = 160;
export const GALLERY_EDGE_RESISTANCE = 0.35;

export type SwipeDirection = 'left' | 'right';

export type SwipeState = {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isMultiTouch: boolean;
};

export type GalleryDragOffsets = {
    imageOffsetX: number;
    galleryOffsetX: number;
};

export type GalleryDragTarget = {
    direction: SwipeDirection | null;
    nextIndex: number | null;
    shouldNavigate: boolean;
    targetOffsetX: number;
};

export function createSwipeState(startX: number, startY: number, isMultiTouch = false): SwipeState {
    return {
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        isMultiTouch,
    };
}

export function updateSwipeState(state: SwipeState, newX: number, newY: number): SwipeState {
    return {
        ...state,
        currentX: newX,
        currentY: newY,
    };
}

export function markSwipeAsMultiTouch(state: SwipeState): SwipeState {
    return { ...state, isMultiTouch: true };
}

export function resolveSwipeGesture(
    state: SwipeState,
    threshold: number = SWIPE_NAVIGATION_THRESHOLD,
): SwipeDirection | null {
    if (state.isMultiTouch) return null;

    const dx = state.currentX - state.startX;
    const dy = state.currentY - state.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx <= absDy) return null;
    if (absDx < threshold) return null;

    return dx < 0 ? 'left' : 'right';
}

export function resolvePanGesture(
    startOffsetX: number,
    endOffsetX: number,
    threshold: number = SWIPE_NAVIGATION_THRESHOLD,
): SwipeDirection | null {
    const dx = endOffsetX - startOffsetX;
    const absDx = Math.abs(dx);

    if (absDx < threshold) return null;

    return dx < 0 ? 'left' : 'right';
}

export function getHorizontalPanLimit(
    imageWidthPx: number,
    renderedScale: number,
    viewportWidth: number,
): number {
    const scaledWidth = imageWidthPx * renderedScale;
    const overflow = scaledWidth - viewportWidth;

    if (!Number.isFinite(overflow) || overflow <= 0) return 0;

    return overflow / 2;
}

export function getGalleryCommitThreshold(
    viewportWidth: number,
    minThreshold: number = SWIPE_NAVIGATION_THRESHOLD,
): number {
    const ratioThreshold = viewportWidth * GALLERY_COMMIT_DISTANCE_RATIO;

    if (!Number.isFinite(ratioThreshold) || ratioThreshold <= 0) return minThreshold;

    return Math.min(GALLERY_COMMIT_MAX_THRESHOLD, Math.max(minThreshold, ratioThreshold));
}

export function applyGalleryBoundaryResistance(
    offsetX: number,
    hasAdjacentImage: boolean,
    resistance: number = GALLERY_EDGE_RESISTANCE,
): number {
    if (hasAdjacentImage) return offsetX;

    return offsetX * resistance;
}

export function resolveNextIndex(
    current: number,
    direction: SwipeDirection,
    totalCount: number,
): number | null {
    if (totalCount <= 1) return null;
    if (current < 0 || current >= totalCount) return null;

    const next = direction === 'left' ? current + 1 : current - 1;

    if (next < 0 || next >= totalCount) return null;

    return next;
}

export function resolveGalleryDragTarget(
    offsetX: number,
    current: number,
    totalCount: number,
    viewportWidth: number,
    threshold: number = getGalleryCommitThreshold(viewportWidth),
): GalleryDragTarget {
    if (offsetX === 0) {
        return {
            direction: null,
            nextIndex: null,
            shouldNavigate: false,
            targetOffsetX: 0,
        };
    }

    const direction: SwipeDirection = offsetX < 0 ? 'left' : 'right';
    const nextIndex = resolveNextIndex(current, direction, totalCount);
    const shouldNavigate = nextIndex !== null && Math.abs(offsetX) >= threshold;

    return {
        direction,
        nextIndex,
        shouldNavigate,
        targetOffsetX: shouldNavigate ? (direction === 'left' ? -viewportWidth : viewportWidth) : 0,
    };
}

export function resolveGalleryDragOffsets(
    relativeZoomScale: number,
    renderedScale: number,
    proposedOffsetX: number,
    imageWidthPx: number,
    viewportWidth: number,
): GalleryDragOffsets {
    if (relativeZoomScale <= 1.05) {
        return {
            imageOffsetX: 0,
            galleryOffsetX: proposedOffsetX,
        };
    }

    const maxOffset = getHorizontalPanLimit(imageWidthPx, renderedScale, viewportWidth);
    if (maxOffset <= 0) {
        return {
            imageOffsetX: 0,
            galleryOffsetX: proposedOffsetX,
        };
    }

    if (proposedOffsetX > maxOffset) {
        return {
            imageOffsetX: maxOffset,
            galleryOffsetX: proposedOffsetX - maxOffset,
        };
    }

    if (proposedOffsetX < -maxOffset) {
        return {
            imageOffsetX: -maxOffset,
            galleryOffsetX: proposedOffsetX + maxOffset,
        };
    }

    return {
        imageOffsetX: proposedOffsetX,
        galleryOffsetX: 0,
    };
}

export function shouldNavigateWhenZoomed(
    relativeZoomScale: number,
    renderedScale: number,
    offsetX: number,
    imageWidthPx: number,
    viewportWidth: number,
    direction: SwipeDirection,
    threshold: number = SWIPE_NAVIGATION_THRESHOLD,
): boolean {
    if (relativeZoomScale <= 1.05) return true;

    const maxOffset = getHorizontalPanLimit(imageWidthPx, renderedScale, viewportWidth);
    if (maxOffset <= 0) return true;

    if (direction === 'left') {
        return offsetX <= -maxOffset - threshold;
    }

    return offsetX >= maxOffset + threshold;
}
