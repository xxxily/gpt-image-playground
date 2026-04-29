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
    const scaleRef = React.useRef(1);
    const offsetXRef = React.useRef(0);
    const offsetYRef = React.useRef(0);
    const isDragging = React.useRef(false);
    const lastPos = React.useRef({ x: 0, y: 0 });
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const [uiScale, setUiScale] = React.useState(1);
    const [imgSize, setImgSize] = React.useState({ w: 0, h: 0 });

    React.useEffect(() => {
        if (!open) {
            scaleRef.current = 1;
            offsetXRef.current = 0;
            offsetYRef.current = 0;
            isDragging.current = false;
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

    const commitTransform = React.useCallback(() => {
        if (wrapperRef.current) {
            wrapperRef.current.style.width = `${imgSize.w}px`;
            wrapperRef.current.style.height = `${imgSize.h}px`;
            wrapperRef.current.style.transform = `translate(${offsetXRef.current}px, ${offsetYRef.current}px) scale(${scaleRef.current})`;
        }
    }, [imgSize]);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { onClose(); }
        };
        const onGlobalMouseUp = () => { isDragging.current = false; };
        const onGlobalMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            e.preventDefault();
            offsetXRef.current = e.clientX - lastPos.current.x;
            offsetYRef.current = e.clientY - lastPos.current.y;
            requestAnimationFrame(commitTransform);
        };
        const preventTouch = (e: TouchEvent) => { e.preventDefault(); };
        const preventGesture = (e: Event) => { e.preventDefault(); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('mouseup', onGlobalMouseUp);
        window.addEventListener('mousemove', onGlobalMouseMove);
        window.addEventListener('touchstart', preventTouch, { passive: false });
        window.addEventListener('touchmove', preventTouch, { passive: false });
        window.addEventListener('gesturechange', preventGesture, { passive: false });
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('mouseup', onGlobalMouseUp);
            window.removeEventListener('mousemove', onGlobalMouseMove);
            window.removeEventListener('touchstart', preventTouch);
            window.removeEventListener('touchmove', preventTouch);
            window.removeEventListener('gesturechange', preventGesture);
        };
    }, [open, onClose, commitTransform]);

    React.useLayoutEffect(() => {
        if (imgSize.w > 0) {
            offsetXRef.current = 0;
            offsetYRef.current = 0;
            requestAnimationFrame(commitTransform);
        }
    }, [open, imgSize, commitTransform]);

    React.useEffect(() => {
        const el = overlayRef.current;
        if (!el || !open) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            scaleRef.current = Math.max(0.1, scaleRef.current + delta);
            setUiScale(scaleRef.current);
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

    const handleOverlayClick = React.useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    const resetView = React.useCallback(() => {
        scaleRef.current = 1;
        offsetXRef.current = 0;
        offsetYRef.current = 0;
        setUiScale(1);
        requestAnimationFrame(commitTransform);
    }, [commitTransform]);

    const adjustScale = React.useCallback((step: number) => {
        scaleRef.current = Math.max(0.1, scaleRef.current + step);
        setUiScale(scaleRef.current);
        requestAnimationFrame(commitTransform);
    }, [commitTransform]);

    if (!open || !src) return null;

    const content = (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center overscroll-none"
            onMouseDown={handleMouseDown}
            onClick={handleOverlayClick}>
            <button
                onClick={onClose}
                className="fixed top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                aria-label="关闭">
                <X className="h-5 w-5" />
            </button>
            {imgSize.w > 0 ? (
                <div
                    ref={wrapperRef}
                    className="cursor-grab active:cursor-grabbing select-none"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        width: `${imgSize.w}px`,
                        height: `${imgSize.h}px`,
                    }}>
                    <img
                        src={src}
                        alt="完整尺寸预览图"
                        className="select-none"
                        style={{ width: '100%', height: '100%' }}
                        draggable={false}
                    />
                </div>
            ) : (
                <div className="text-white/60">加载中...</div>
            )}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/60 px-4 py-2 text-white/80 backdrop-blur-sm"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}>
                <button onClick={() => adjustScale(-0.1)} className="hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span className="text-sm font-medium tabular-nums min-w-[48px] text-center">{(uiScale * 100).toFixed(0)}%</span>
                <button onClick={() => adjustScale(0.1)} className="hover:text-white transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button onClick={resetView} className="hover:text-white transition-colors ml-2 text-xs">
                    重置
                </button>
                {onSendToEdit && (
                    <button
                        type="button"
                        onClick={onSendToEdit}
                        className="ml-2 flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-100 transition-colors hover:border-violet-300/50 hover:bg-violet-500/30 hover:text-white"
                        aria-label="发送当前预览图片到编辑">
                        <Send className="h-3.5 w-3.5" />
                        发送到编辑
                    </button>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
});
