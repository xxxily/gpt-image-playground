'use client';

import { getZoomViewerFitScale } from '@/lib/zoom-viewer-scale';
import type { SwipeDirection } from '@/lib/zoom-viewer-gallery';
import {
    applyGalleryBoundaryResistance,
    createSwipeState,
    resolveGalleryDragOffsets,
    resolveGalleryDragTarget,
    markSwipeAsMultiTouch,
    resolveNextIndex,
    updateSwipeState,
} from '@/lib/zoom-viewer-gallery';
import { AlertCircle, Send, X } from 'lucide-react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import * as React from 'react';

const CLICK_SUPPRESSION_DRAG_THRESHOLD = 4;
const MAX_GALLERY_DOTS = 12;
const GALLERY_SETTLE_DURATION_MS = 260;
const GALLERY_SETTLE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

type GalleryTransitionPhase = 'idle' | 'dragging' | 'settling';
type ImageLoadState = 'idle' | 'loading' | 'ready' | 'error';

export type ZoomViewerImage = {
    src: string;
    filename?: string;
};

type ZoomViewerProps = {
    src: string | null;
    open: boolean;
    onClose: () => void;
    onSendToEdit?: () => void;
    images?: ZoomViewerImage[];
    currentIndex?: number;
    onNavigate?: (index: number) => void;
};

function getViewportSize() {
    const vp = window.visualViewport;
    return {
        width: vp ? vp.width : window.innerWidth,
        height: vp ? vp.height : window.innerHeight
    };
}

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

    React.useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return prefersReducedMotion;
}

export const ZoomViewer = React.memo(function ZoomViewer({ src, open, onClose, onSendToEdit, images, currentIndex: optCurrentIndex, onNavigate }: ZoomViewerProps) {
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const isDragging = React.useRef(false);
    const lastPos = React.useRef({ x: 0, y: 0 });
    const dragStartPoint = React.useRef({ x: 0, y: 0 });
    const hasMovedDuringDrag = React.useRef(false);
    const suppressNextOverlayClick = React.useRef(false);
    const pinchStartDist = React.useRef(0);
    const pinchStartZoom = React.useRef(1);
    const touchSwipeRef = React.useRef<ReturnType<typeof createSwipeState> | null>(null);
    const galleryOffsetXRef = React.useRef(0);
    const gallerySettleTimerRef = React.useRef<number | null>(null);

    const hasGallery = !!(images && images.length > 1 && onNavigate);
    const galleryIndex = hasGallery ? (optCurrentIndex ?? 0) : 0;
    const currentSrc = hasGallery && images ? images[galleryIndex]?.src ?? null : src;
    const previousImage = hasGallery && images ? images[galleryIndex - 1] : undefined;
    const nextImage = hasGallery && images ? images[galleryIndex + 1] : undefined;
    const prefersReducedMotion = usePrefersReducedMotion();

    const fitScaleRef = React.useRef(1);
    const zoomRef = React.useRef(1);
    const offsetXRef = React.useRef(0);
    const offsetYRef = React.useRef(0);

    const [imgNatural, setImgNatural] = React.useState({ w: 0, h: 0 });
    const [uiScale, setUiScale] = React.useState(1);
    const [imageLoadState, setImageLoadState] = React.useState<ImageLoadState>('idle');
    const [galleryOffsetX, setGalleryOffsetX] = React.useState(0);
    const [galleryPhase, setGalleryPhase] = React.useState<GalleryTransitionPhase>('idle');
    const [galleryPreviewDirection, setGalleryPreviewDirection] = React.useState<SwipeDirection | null>(null);

    const resetTransform = React.useCallback(() => {
        fitScaleRef.current = 1;
        zoomRef.current = 1;
        offsetXRef.current = 0;
        offsetYRef.current = 0;
    }, []);

    const setGalleryDragOffset = React.useCallback((offsetX: number) => {
        galleryOffsetXRef.current = offsetX;
        setGalleryOffsetX(offsetX);
    }, []);

    const commitTransform = React.useCallback(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const totalScale = fitScaleRef.current * zoomRef.current;
        el.style.transform = `translate(calc(-50% + ${offsetXRef.current + galleryOffsetXRef.current}px), calc(-50% + ${offsetYRef.current}px)) scale(${totalScale})`;
    }, []);

    const clearGallerySettleTimer = React.useCallback(() => {
        if (gallerySettleTimerRef.current) {
            window.clearTimeout(gallerySettleTimerRef.current);
            gallerySettleTimerRef.current = null;
        }
    }, []);

    const navigateTo = React.useCallback((direction: SwipeDirection) => {
        const next = resolveNextIndex(galleryIndex, direction, images?.length ?? 0);
        if (next === null || next === galleryIndex) return;
        clearGallerySettleTimer();
        setGalleryPhase('idle');
        setGalleryPreviewDirection(null);
        setGalleryDragOffset(0);
        resetTransform();
        setImgNatural({ w: 0, h: 0 });
        setUiScale(1);
        onNavigate?.(next);
    }, [clearGallerySettleTimer, galleryIndex, images?.length, onNavigate, resetTransform, setGalleryDragOffset]);

    const settleGalleryDrag = React.useCallback(() => {
        if (!hasGallery) {
            setGalleryPhase('idle');
            setGalleryPreviewDirection(null);
            setGalleryDragOffset(0);
            requestAnimationFrame(commitTransform);
            return;
        }

        const vp = getViewportSize();
        const target = resolveGalleryDragTarget(
            galleryOffsetXRef.current,
            galleryIndex,
            images?.length ?? 0,
            vp.width,
        );
        const duration = prefersReducedMotion ? 0 : GALLERY_SETTLE_DURATION_MS;

        clearGallerySettleTimer();
        setGalleryPhase('settling');
        setGalleryDragOffset(target.targetOffsetX);
        requestAnimationFrame(commitTransform);

        gallerySettleTimerRef.current = window.setTimeout(() => {
            gallerySettleTimerRef.current = null;
            if (target.shouldNavigate && target.direction) {
                navigateTo(target.direction);
                return;
            }
            setGalleryDragOffset(0);
            setGalleryPreviewDirection(null);
            setGalleryPhase('idle');
            requestAnimationFrame(commitTransform);
        }, duration);
    }, [clearGallerySettleTimer, commitTransform, galleryIndex, hasGallery, images?.length, navigateTo, prefersReducedMotion, setGalleryDragOffset]);

    const handleNavigatePrevious = React.useCallback(() => navigateTo('right'), [navigateTo]);
    const handleNavigateNext = React.useCallback(() => navigateTo('left'), [navigateTo]);

    const updateDragPosition = React.useCallback((clientX: number, clientY: number) => {
        const movedX = clientX - dragStartPoint.current.x;
        const movedY = clientY - dragStartPoint.current.y;
        if (Math.hypot(movedX, movedY) >= CLICK_SUPPRESSION_DRAG_THRESHOLD) {
            hasMovedDuringDrag.current = true;
        }

        const isZoomedForPan = zoomRef.current > 1.05;
        const proposedOffsetX = clientX - lastPos.current.x;
        const proposedOffsetY = isZoomedForPan ? clientY - lastPos.current.y : 0;
        const vp = getViewportSize();
        const dragOffsets = hasGallery
            ? resolveGalleryDragOffsets(
                zoomRef.current,
                fitScaleRef.current * zoomRef.current,
                proposedOffsetX,
                imgNatural.w,
                vp.width,
            )
            : { imageOffsetX: proposedOffsetX, galleryOffsetX: 0 };
        const dragDirection = dragOffsets.galleryOffsetX < 0 ? 'left' : dragOffsets.galleryOffsetX > 0 ? 'right' : null;
        const hasAdjacentImage = dragDirection ? resolveNextIndex(galleryIndex, dragDirection, images?.length ?? 0) !== null : true;
        const galleryDragOffset = applyGalleryBoundaryResistance(dragOffsets.galleryOffsetX, hasAdjacentImage);
        const previewDirection = galleryDragOffset < 0 ? 'left' : galleryDragOffset > 0 ? 'right' : null;

        offsetXRef.current = dragOffsets.imageOffsetX;
        offsetYRef.current = proposedOffsetY;
        setGalleryDragOffset(galleryDragOffset);

        if (galleryDragOffset !== 0) {
            clearGallerySettleTimer();
            setGalleryPreviewDirection(previewDirection);
            setGalleryPhase('dragging');
        } else {
            setGalleryPreviewDirection(null);
            setGalleryPhase('idle');
        }

        requestAnimationFrame(commitTransform);
    }, [clearGallerySettleTimer, commitTransform, galleryIndex, hasGallery, images?.length, imgNatural.w, setGalleryDragOffset]);

    React.useEffect(() => {
        if (!open) {
            clearGallerySettleTimer();
            resetTransform();
            isDragging.current = false;
            touchSwipeRef.current = null;
            hasMovedDuringDrag.current = false;
            suppressNextOverlayClick.current = false;
            setGalleryPhase('idle');
            setGalleryPreviewDirection(null);
            setGalleryDragOffset(0);
            setUiScale(1);
            setImageLoadState('idle');
            setImgNatural({ w: 0, h: 0 });
            return;
        }
        if (currentSrc) {
            let active = true;

            clearGallerySettleTimer();
            setGalleryPhase('idle');
            setGalleryPreviewDirection(null);
            setGalleryDragOffset(0);
            resetTransform();
            setUiScale(1);
            setImgNatural({ w: 0, h: 0 });
            setImageLoadState('loading');

            const img = new window.Image();
            img.onload = () => {
                if (!active) return;
                const width = img.naturalWidth || img.width;
                const height = img.naturalHeight || img.height;

                if (width <= 0 || height <= 0) {
                    resetTransform();
                    setUiScale(1);
                    setImgNatural({ w: 0, h: 0 });
                    setImageLoadState('error');
                    return;
                }

                fitScaleRef.current = getZoomViewerFitScale(
                    { width, height },
                    getViewportSize()
                );
                zoomRef.current = 1;
                offsetXRef.current = 0;
                offsetYRef.current = 0;
                setImgNatural({ w: width, h: height });
                setUiScale(fitScaleRef.current);
                setImageLoadState('ready');
            };
            img.onerror = () => {
                if (!active) return;
                resetTransform();
                setUiScale(1);
                setImgNatural({ w: 0, h: 0 });
                setImageLoadState('error');
            };
            img.src = currentSrc;

            return () => {
                active = false;
                img.onload = null;
                img.onerror = null;
            };
        }
    }, [clearGallerySettleTimer, open, currentSrc, resetTransform, setGalleryDragOffset]);

    React.useEffect(() => () => clearGallerySettleTimer(), [clearGallerySettleTimer]);

    React.useLayoutEffect(() => {
        if (imgNatural.w > 0) {
            commitTransform();
        }
    }, [imgNatural, commitTransform]);

    const resetView = React.useCallback(() => {
        resetTransform();
        setUiScale(fitScaleRef.current);
        requestAnimationFrame(commitTransform);
    }, [commitTransform, resetTransform]);

    const adjustZoom = React.useCallback((factor: number) => {
        zoomRef.current = Math.max(0.1, zoomRef.current * factor);
        setUiScale(fitScaleRef.current * zoomRef.current);
        requestAnimationFrame(commitTransform);
    }, [commitTransform]);

    const isZoomInputTarget = React.useCallback((target: EventTarget | null) => {
        const el = overlayRef.current;
        if (!el) return false;
        if (!(target instanceof Node)) return true;
        return el.contains(target) || target === document || target === document.body || target === document.documentElement;
    }, []);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (hasGallery) {
                if (e.key === 'ArrowLeft') { handleNavigatePrevious(); }
                if (e.key === 'ArrowRight') { handleNavigateNext(); }
            }
            if (e.key === '-' || e.key === '=' || (e.key === 'Equal' && !e.shiftKey)) {
                e.preventDefault();
                adjustZoom((e.key === '-' ? 0.9 : 1.1));
                return;
            }
            if (e.key === '0') {
                e.preventDefault();
                resetView();
                return;
            }
        };
        const onGlobalMouseUp = () => {
            const dragging = isDragging.current;
            isDragging.current = false;
            if (dragging && hasMovedDuringDrag.current) {
                suppressNextOverlayClick.current = true;
            }
            if (dragging && hasGallery && galleryOffsetXRef.current !== 0) {
                settleGalleryDrag();
            }
        };
        const onGlobalMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            e.preventDefault();
            updateDragPosition(e.clientX, e.clientY);
        };
        const preventGesture = (e: Event) => { e.preventDefault(); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('mouseup', onGlobalMouseUp);
        window.addEventListener('mousemove', onGlobalMouseMove);
        window.addEventListener('gesturestart', preventGesture, { passive: false });
        window.addEventListener('gesturechange', preventGesture, { passive: false });
        window.addEventListener('gestureend', preventGesture, { passive: false });
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mouseup', onGlobalMouseUp);
            window.removeEventListener('mousemove', onGlobalMouseMove);
            window.removeEventListener('gesturestart', preventGesture);
            window.removeEventListener('gesturechange', preventGesture);
            window.removeEventListener('gestureend', preventGesture);
        };
    }, [open, onClose, hasGallery, settleGalleryDrag, handleNavigatePrevious, handleNavigateNext, updateDragPosition, adjustZoom, resetView]);

    React.useEffect(() => {
        if (!open) return;
        const onWheel = (e: WheelEvent) => {
            if (!isZoomInputTarget(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            adjustZoom(factor);
        };
        const listenerOptions: AddEventListenerOptions = { passive: false, capture: true };
        document.addEventListener('wheel', onWheel, listenerOptions);
        return () => document.removeEventListener('wheel', onWheel, listenerOptions);
    }, [open, adjustZoom, isZoomInputTarget]);

    React.useEffect(() => {
        if (!open) return;
        const el = overlayRef.current;
        if (!el) return;
        const onGestureStart = (e: Event) => {
            const ge = e as unknown as { scale: number | undefined };
            if (!isZoomInputTarget(e.target)) return;
            if (ge.scale !== undefined) pinchStartZoom.current = zoomRef.current;
        };
        const onGestureChange = (e: Event) => {
            const ge = e as unknown as { scale: number | undefined };
            if (!isZoomInputTarget(e.target)) return;
            if (ge.scale !== undefined) {
                e.preventDefault();
                zoomRef.current = Math.max(0.1, pinchStartZoom.current * ge.scale);
                setUiScale(fitScaleRef.current * zoomRef.current);
                requestAnimationFrame(commitTransform);
            }
        };
        window.addEventListener('gesturestart', onGestureStart, { passive: false });
        window.addEventListener('gesturechange', onGestureChange, { passive: false });
        return () => {
            window.removeEventListener('gesturestart', onGestureStart);
            window.removeEventListener('gesturechange', onGestureChange);
        };
    }, [open, commitTransform, isZoomInputTarget]);

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        clearGallerySettleTimer();
        setGalleryPhase('idle');
        setGalleryPreviewDirection(null);
        setGalleryDragOffset(0);
        isDragging.current = true;
        dragStartPoint.current = { x: e.clientX, y: e.clientY };
        hasMovedDuringDrag.current = false;
        lastPos.current = { x: e.clientX - offsetXRef.current, y: e.clientY - offsetYRef.current };
    }, [clearGallerySettleTimer, setGalleryDragOffset]);

    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchStartDist.current = Math.hypot(dx, dy);
            pinchStartZoom.current = zoomRef.current;
            touchSwipeRef.current = markSwipeAsMultiTouch(createSwipeState(e.touches[0].clientX, e.touches[0].clientY));
        } else if (e.touches.length === 1) {
            clearGallerySettleTimer();
            setGalleryPhase('idle');
            setGalleryPreviewDirection(null);
            setGalleryDragOffset(0);
            isDragging.current = true;
            const touch = e.touches[0];
            dragStartPoint.current = { x: touch.clientX, y: touch.clientY };
            hasMovedDuringDrag.current = false;
            lastPos.current = {
                x: touch.clientX - offsetXRef.current,
                y: touch.clientY - offsetYRef.current,
            };
            touchSwipeRef.current = createSwipeState(touch.clientX, touch.clientY);
        }
    }, [clearGallerySettleTimer, setGalleryDragOffset]);

    const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (pinchStartDist.current > 0) {
                zoomRef.current = Math.max(0.1, pinchStartZoom.current * (dist / pinchStartDist.current));
                setUiScale(fitScaleRef.current * zoomRef.current);
                requestAnimationFrame(commitTransform);
            }
        } else if (e.touches.length === 1 && isDragging.current) {
            const touch = e.touches[0];
            if (touchSwipeRef.current) {
                touchSwipeRef.current = updateSwipeState(touchSwipeRef.current, touch.clientX, touch.clientY);
            }
            updateDragPosition(touch.clientX, touch.clientY);
        }
    }, [commitTransform, updateDragPosition]);

    const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
        if (e.touches.length < 2) pinchStartDist.current = 0;
        if (e.touches.length === 0) {
            isDragging.current = false;
            if (hasMovedDuringDrag.current) {
                suppressNextOverlayClick.current = true;
            }
            if (hasGallery && touchSwipeRef.current && galleryOffsetXRef.current !== 0) {
                settleGalleryDrag();
            }
            touchSwipeRef.current = null;
        }
    }, [hasGallery, settleGalleryDrag]);

    const handleOverlayClick = React.useCallback((e: React.MouseEvent) => {
        if (suppressNextOverlayClick.current) {
            suppressNextOverlayClick.current = false;
            return;
        }
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    if (!open || !currentSrc) return null;

    const showGalleryIndicator = hasGallery && (images?.length ?? 0) > 1;
    const galleryImages = showGalleryIndicator ? images ?? [] : [];
    const showGalleryDots = galleryImages.length <= MAX_GALLERY_DOTS;
    const previewViewportWidth = typeof window === 'undefined' ? 0 : getViewportSize().width;
    const galleryTransition = galleryPhase === 'settling' && !prefersReducedMotion
        ? `transform ${GALLERY_SETTLE_DURATION_MS}ms ${GALLERY_SETTLE_EASING}`
        : 'none';
    const previewOpacity = Math.min(1, Math.max(0.25, Math.abs(galleryOffsetX) / Math.max(1, previewViewportWidth * 0.32)));
    const previewBaseStyle: React.CSSProperties = {
        height: '100dvh',
        pointerEvents: 'none',
        top: '50%',
        transition: galleryTransition,
        width: '100dvw',
        willChange: galleryPhase === 'idle' ? undefined : 'transform',
    };

    const content = (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[999] bg-black/95 overflow-hidden"
            style={{ touchAction: 'none' }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleOverlayClick}>
            <button
                onClick={onClose}
                className="fixed top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-[1000] flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="关闭">
                <X className="h-5 w-5" />
            </button>
            {imageLoadState === 'ready' && imgNatural.w > 0 ? (
                <>
                    {showGalleryIndicator && previousImage && galleryPreviewDirection === 'right' && (
                        <div
                            className="absolute left-1/2 z-0 select-none"
                            style={{
                                ...previewBaseStyle,
                                opacity: previewOpacity,
                                transform: `translate(calc(-50% - ${previewViewportWidth}px + ${galleryOffsetX}px), calc(-50% + ${offsetYRef.current}px))`,
                            }}>
                            <Image
                                src={previousImage.src}
                                alt="上一张预览图"
                                fill
                                sizes="100vw"
                                unoptimized
                                className="select-none object-contain"
                                draggable={false}
                            />
                        </div>
                    )}
                    {showGalleryIndicator && nextImage && galleryPreviewDirection === 'left' && (
                        <div
                            className="absolute left-1/2 z-0 select-none"
                            style={{
                                ...previewBaseStyle,
                                opacity: previewOpacity,
                                transform: `translate(calc(-50% + ${previewViewportWidth}px + ${galleryOffsetX}px), calc(-50% + ${offsetYRef.current}px))`,
                            }}>
                            <Image
                                src={nextImage.src}
                                alt="下一张预览图"
                                fill
                                sizes="100vw"
                                unoptimized
                                className="select-none object-contain"
                                draggable={false}
                            />
                        </div>
                    )}
                    <div
                        ref={wrapperRef}
                        className="absolute left-1/2 top-1/2 z-10 cursor-grab select-none active:cursor-grabbing"
                        style={{
                            width: `${imgNatural.w}px`,
                            height: `${imgNatural.h}px`,
                            transformOrigin: 'center center',
                            transition: galleryTransition,
                            willChange: galleryPhase === 'idle' ? undefined : 'transform',
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        <Image
                            key={currentSrc}
                            src={currentSrc}
                            alt="完整尺寸预览图"
                            width={imgNatural.w}
                            height={imgNatural.h}
                            unoptimized
                            className="block h-full w-full select-none"
                            draggable={false}
                        />
                    </div>
                </>
            ) : imageLoadState === 'error' ? (
                <div className="absolute left-1/2 top-1/2 flex max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-5 py-4 text-center text-white/75 backdrop-blur">
                    <AlertCircle className="h-7 w-7 text-red-200" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-white">大图加载失败</p>
                        <p className="text-xs leading-5 text-white/55">源图片预览地址可能已失效，请重新添加这张图片后再查看。</p>
                    </div>
                </div>
            ) : (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60">加载中...</div>
            )}
            {showGalleryIndicator && (
                <div className="fixed top-[max(1.25rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 text-white/50 text-xs">
                    {showGalleryDots ? (
                        galleryImages.map((_, i) => (
                            <span
                                key={i}
                                className={`block h-1.5 rounded-full transition-all duration-200 ${i === galleryIndex ? 'w-4 bg-white/70' : 'w-1.5 bg-white/30'}`}
                            />
                        ))
                    ) : (
                        <span className="rounded-full bg-black/50 px-2.5 py-1 text-white/70 backdrop-blur-sm">
                            {galleryIndex + 1} / {galleryImages.length}
                        </span>
                    )}
                </div>
            )}
            {imageLoadState === 'ready' && (
                <div
                    className="fixed bottom-[max(2rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 flex-nowrap rounded-full bg-black/60 px-4 py-2 text-white/80 backdrop-blur-sm"
                    style={{ touchAction: 'manipulation' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    role="toolbar"
                    aria-label="缩放控制">
                    <button
                        onClick={() => adjustZoom(0.9)}
                        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="缩小视图">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <span className="text-sm font-medium tabular-nums min-w-[48px] text-center" aria-live="polite">{(uiScale * 100).toFixed(0)}%</span>
                    <button
                        onClick={() => adjustZoom(1.1)}
                        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="放大视图">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button
                        onClick={resetView}
                        className="flex h-11 min-w-[44px] items-center justify-center rounded-full px-3 hover:bg-white/10 hover:text-white transition-colors text-xs whitespace-nowrap"
                        aria-label="重置缩放">
                        重置
                    </button>
                    {onSendToEdit && (
                        <button
                            type="button"
                            onClick={onSendToEdit}
                            className="ml-2 flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-400/30 bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-100 transition-colors hover:border-violet-300/50 hover:bg-violet-500/30 hover:text-white"
                            aria-label="发送当前预览图片到编辑">
                            <Send className="h-3.5 w-3.5" />
                            编辑
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    return createPortal(content, document.body);
});
