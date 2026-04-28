'use client';

import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import * as React from 'react';

type ZoomViewerProps = {
    src: string | null;
    open: boolean;
    onClose: () => void;
};

export const ZoomViewer = React.memo(function ZoomViewer({ src, open, onClose }: ZoomViewerProps) {
    const scaleRef = React.useRef(1);
    const offsetXRef = React.useRef(0);
    const offsetYRef = React.useRef(0);
    const originXRef = React.useRef(0);
    const originYRef = React.useRef(0);
    const isDragging = React.useRef(false);
    const lastPos = React.useRef({ x: 0, y: 0 });
    const imgRef = React.useRef<HTMLImageElement>(null);
    const [uiScale, setUiScale] = React.useState(1);
    const [imgSize, setImgSize] = React.useState({ w: 0, h: 0 });

    const calcCentered = React.useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const sw = imgSize.w * scaleRef.current;
        const sh = imgSize.h * scaleRef.current;
        return {
            left: (vw - sw) / 2,
            top: (vh - sh) / 2,
        };
    }, [imgSize]);

    React.useEffect(() => {
        if (!open) {
            scaleRef.current = 1;
            offsetXRef.current = 0;
            offsetYRef.current = 0;
            setUiScale(1);
            setImgSize({ w: 0, h: 0 });
            return;
        }
        if (src) {
            const img = new window.Image();
            img.onload = () => {
                const pad = 40;
                const vw = window.innerWidth - pad * 2;
                const vh = window.innerHeight - pad * 2;
                const s = Math.min(vw / img.naturalWidth, vh / img.naturalHeight, 1);
                scaleRef.current = s;
                offsetXRef.current = 0;
                offsetYRef.current = 0;
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
                setUiScale(s);
            };
            img.onerror = () => {
                scaleRef.current = 1;
                setUiScale(1);
                offsetXRef.current = 0;
                offsetYRef.current = 0;
                setImgSize({ w: 0, h: 0 });
            };
            img.src = src;
        }
    }, [open, src]);

    React.useEffect(() => {
        if (!open || imgSize.w === 0) return;
        const c = calcCentered();
        originXRef.current = c.left;
        originYRef.current = c.top;
    }, [open, imgSize, calcCentered]);

    React.useEffect(() => {
        if (!open) return;
        const onResize = () => {
            const c = calcCentered();
            originXRef.current = c.left;
            originYRef.current = c.top;
            if (imgRef.current) imgRef.current.style.display = 'none';
            requestAnimationFrame(() => {
                if (imgRef.current) imgRef.current.style.display = '';
            });
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [open, calcCentered]);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const applyPosition = React.useCallback(() => {
        if (imgRef.current) {
            const sw = imgSize.w * scaleRef.current;
            const sh = imgSize.h * scaleRef.current;
            imgRef.current.style.width = `${sw}px`;
            imgRef.current.style.height = `${sh}px`;
            imgRef.current.style.left = `${originXRef.current + offsetXRef.current}px`;
            imgRef.current.style.top = `${originYRef.current + offsetYRef.current}px`;
        }
    }, [imgSize]);

    const handleWheel = React.useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        const prevScale = scaleRef.current;
        scaleRef.current = Math.max(0.1, scaleRef.current + delta);
        const ratio = scaleRef.current / prevScale;
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        offsetXRef.current = mx - ratio * (mx - originXRef.current - offsetXRef.current) - originXRef.current;
        offsetYRef.current = my - ratio * (my - originYRef.current - offsetYRef.current) - originYRef.current;
        setUiScale(scaleRef.current);
        requestAnimationFrame(applyPosition);
    }, [applyPosition]);

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        isDragging.current = true;
        lastPos.current = { x: e.clientX - offsetXRef.current, y: e.clientY - offsetYRef.current };
    }, []);

    const handleMouseUp = React.useCallback(() => {
        isDragging.current = false;
    }, []);

    const handleContextMenu = React.useCallback((_e: React.MouseEvent) => {
        isDragging.current = false;
    }, []);

    const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
        if (!isDragging.current) return;
        offsetXRef.current = e.clientX - lastPos.current.x;
        offsetYRef.current = e.clientY - lastPos.current.y;
        requestAnimationFrame(applyPosition);
    }, [applyPosition]);

    const handleOverlayClick = React.useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    const resetView = React.useCallback(() => {
        scaleRef.current = 1;
        offsetXRef.current = 0;
        offsetYRef.current = 0;
        const c = calcCentered();
        originXRef.current = c.left;
        originYRef.current = c.top;
        setUiScale(1);
        requestAnimationFrame(applyPosition);
    }, [calcCentered, applyPosition]);

    const adjustScale = React.useCallback((step: number) => {
        const prevScale = scaleRef.current;
        scaleRef.current = Math.max(0.1, scaleRef.current + step);
        const ratio = scaleRef.current / prevScale;
        const vw2 = window.innerWidth / 2;
        const vh2 = window.innerHeight / 2;
        offsetXRef.current = vw2 - ratio * (vw2 - originXRef.current - offsetXRef.current) - originXRef.current;
        offsetYRef.current = vh2 - ratio * (vh2 - originYRef.current - offsetYRef.current) - originYRef.current;
        setUiScale(scaleRef.current);
        requestAnimationFrame(applyPosition);
    }, [applyPosition]);

    if (!open || !src) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[999] bg-black/95 overscroll-none cursor-zoom-out"
            onWheel={handleWheel}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            onClick={handleOverlayClick}>
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="fixed top-4 right-4 z-[1001] flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                aria-label="关闭">
                <X className="h-5 w-5" />
            </button>
            {imgSize.w > 0 ? (
                <img
                    ref={imgRef}
                    src={src}
                    alt="完整尺寸预览图"
                    className="select-none"
                    draggable={false}
                    style={{
                        position: 'absolute',
                        transition: 'none',
                        cursor: isDragging.current ? 'grabbing' : 'grab',
                    }}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/60">加载中...</div>
            )}
            <div className="fixed bottom-8 left-1/2 z-[1001] -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/60 px-4 py-2 text-white/80 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}>
                <button onClick={() => adjustScale(-0.1)} className="hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span className="text-sm font-medium tabular-nums min-w-[48px] text-center">{Math.round(uiScale * 100)}%</span>
                <button onClick={() => adjustScale(0.1)} className="hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button onClick={resetView} className="hover:text-white transition-colors ml-2 text-xs">
                    重置
                </button>
            </div>
        </div>,
        document.body
    );
});
