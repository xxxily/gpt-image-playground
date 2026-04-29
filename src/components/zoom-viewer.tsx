'use client';

import { Send, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import * as React from 'react';

type ZoomViewerProps = {
    src: string | null;
    open: boolean;
    onClose: () => void;
    onSendToEdit?: () => void;
};

export const ZoomViewer = React.memo(function ZoomViewer({ src, open, onClose, onSendToEdit }: ZoomViewerProps) {
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const isDragging = React.useRef(false);
    const lastPos = React.useRef({ x: 0, y: 0 });
    const pinchStartDist = React.useRef(0);
    const pinchStartZoom = React.useRef(1);

    const fitScaleRef = React.useRef(1);
    const zoomRef = React.useRef(1);
    const offsetXRef = React.useRef(0);
    const offsetYRef = React.useRef(0);

    const [imgNatural, setImgNatural] = React.useState({ w: 0, h: 0 });
    const [uiScale, setUiScale] = React.useState(1);

    const commitTransform = React.useCallback(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const totalScale = fitScaleRef.current * zoomRef.current;
        el.style.transform = `translate(calc(-50% + ${offsetXRef.current}px), calc(-50% + ${offsetYRef.current}px)) scale(${totalScale})`;
    }, []);

    React.useEffect(() => {
        if (!open) {
            fitScaleRef.current = 1;
            zoomRef.current = 1;
            offsetXRef.current = 0;
            offsetYRef.current = 0;
            isDragging.current = false;
            setUiScale(1);
            setImgNatural({ w: 0, h: 0 });
            return;
        }
        if (src) {
            const img = new window.Image();
            img.onload = () => {
                const pad = 40;
                const vp = window.visualViewport;
                const vw = (vp ? vp.width : window.innerWidth) - pad * 2;
                const vh = (vp ? vp.height : window.innerHeight) - pad * 2;
                fitScaleRef.current = Math.min(vw / img.naturalWidth, vh / img.naturalHeight, 1);
                zoomRef.current = 1;
                offsetXRef.current = 0;
                offsetYRef.current = 0;
                setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
                setUiScale(fitScaleRef.current);
            };
            img.onerror = () => {
                fitScaleRef.current = 1;
                zoomRef.current = 1;
                offsetXRef.current = 0;
                offsetYRef.current = 0;
                setUiScale(1);
                setImgNatural({ w: 0, h: 0 });
            };
            img.src = src;
        }
    }, [open, src]);

    React.useLayoutEffect(() => {
        if (imgNatural.w > 0) {
            commitTransform();
        }
    }, [imgNatural, commitTransform]);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const onGlobalMouseUp = () => { isDragging.current = false; };
        const onGlobalMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            e.preventDefault();
            offsetXRef.current = e.clientX - lastPos.current.x;
            offsetYRef.current = e.clientY - lastPos.current.y;
            requestAnimationFrame(commitTransform);
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
    }, [open, onClose, commitTransform]);

    React.useEffect(() => {
        const el = overlayRef.current;
        if (!el || !open) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            zoomRef.current = Math.max(0.1, zoomRef.current * factor);
            setUiScale(fitScaleRef.current * zoomRef.current);
            requestAnimationFrame(commitTransform);
        };
        el.addEventListener('wheel', onWheel, { passive: false, capture: true });
        return () => el.removeEventListener('wheel', onWheel);
    }, [open, commitTransform]);

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        isDragging.current = true;
        lastPos.current = { x: e.clientX - offsetXRef.current, y: e.clientY - offsetYRef.current };
    }, []);

    const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchStartDist.current = Math.hypot(dx, dy);
            pinchStartZoom.current = zoomRef.current;
        } else if (e.touches.length === 1) {
            isDragging.current = true;
            lastPos.current = {
                x: e.touches[0].clientX - offsetXRef.current,
                y: e.touches[0].clientY - offsetYRef.current,
            };
        }
    }, []);

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
            offsetXRef.current = e.touches[0].clientX - lastPos.current.x;
            offsetYRef.current = e.touches[0].clientY - lastPos.current.y;
            requestAnimationFrame(commitTransform);
        }
    }, [commitTransform]);

    const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
        if (e.touches.length < 2) pinchStartDist.current = 0;
        if (e.touches.length === 0) isDragging.current = false;
    }, []);

    const handleOverlayClick = React.useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    const resetView = React.useCallback(() => {
        zoomRef.current = 1;
        offsetXRef.current = 0;
        offsetYRef.current = 0;
        setUiScale(fitScaleRef.current);
        requestAnimationFrame(commitTransform);
    }, [commitTransform]);

    const adjustZoom = React.useCallback((factor: number) => {
        zoomRef.current = Math.max(0.1, zoomRef.current * factor);
        setUiScale(fitScaleRef.current * zoomRef.current);
        requestAnimationFrame(commitTransform);
    }, [commitTransform]);

    if (!open || !src) return null;

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
                className="fixed top-4 right-4 z-[1000] flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                style={{ touchAction: 'manipulation' }}
                aria-label="关闭">
                <X className="h-5 w-5" />
            </button>
            {imgNatural.w > 0 ? (
                <div
                    ref={wrapperRef}
                    className="absolute left-1/2 top-1/2 cursor-grab active:cursor-grabbing select-none"
                    style={{
                        width: `${imgNatural.w}px`,
                        height: `${imgNatural.h}px`,
                        transformOrigin: 'center center',
                    }}
                    onClick={(e) => e.stopPropagation()}>
                    <img
                        src={src}
                        alt="完整尺寸预览图"
                        className="select-none block w-full h-full"
                        draggable={false}
                    />
                </div>
            ) : (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60">加载中...</div>
            )}
            <div
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 flex-nowrap rounded-full bg-black/60 px-4 py-2 text-white/80 backdrop-blur-sm"
                style={{ touchAction: 'manipulation' }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}>
                <button onClick={() => adjustZoom(0.9)} className="hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span className="text-sm font-medium tabular-nums min-w-[48px] text-center">{(uiScale * 100).toFixed(0)}%</span>
                <button onClick={() => adjustZoom(1.1)} className="hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button onClick={resetView} className="hover:text-white transition-colors ml-2 text-xs whitespace-nowrap">
                    重置
                </button>
                {onSendToEdit && (
                    <button
                        type="button"
                        onClick={onSendToEdit}
                        className="ml-2 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-400/30 bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-100 transition-colors hover:border-violet-300/50 hover:bg-violet-500/30 hover:text-white"
                        aria-label="发送当前预览图片到编辑">
                        <Send className="h-3.5 w-3.5" />
                        编辑
                    </button>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
});
