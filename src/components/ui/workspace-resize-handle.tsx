'use client';

import { cn } from '@/lib/utils';
import * as React from 'react';

type WorkspaceResizeHandleProps = {
    orientation: 'vertical' | 'horizontal';
    valuePx: number;
    minValuePx: number;
    maxValuePx: number;
    defaultValuePx: number;
    ariaLabel: string;
    className?: string;
    invert?: boolean;
    disabled?: boolean;
    stepPx?: number;
    onResizeStart?: () => void;
    onResize: (valuePx: number) => void;
    onResizeEnd?: (valuePx: number) => void;
    onReset?: () => void;
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.round(value), min), max);
}

export function WorkspaceResizeHandle({
    orientation,
    valuePx,
    minValuePx,
    maxValuePx,
    defaultValuePx,
    ariaLabel,
    className,
    invert = false,
    disabled = false,
    stepPx = 24,
    onResizeStart,
    onResize,
    onResizeEnd,
    onReset
}: WorkspaceResizeHandleProps) {
    const [dragging, setDragging] = React.useState(false);
    const dragRef = React.useRef<{
        pointerId: number;
        startClient: number;
        startValue: number;
        latestValue: number;
    } | null>(null);

    const resizeTo = React.useCallback(
        (nextValue: number) => {
            const clamped = clamp(nextValue, minValuePx, maxValuePx);
            onResize(clamped);
            return clamped;
        },
        [maxValuePx, minValuePx, onResize]
    );

    const endResize = React.useCallback(
        (nextValue: number) => {
            const clamped = clamp(nextValue, minValuePx, maxValuePx);
            onResizeEnd?.(clamped);
        },
        [maxValuePx, minValuePx, onResizeEnd]
    );

    const handlePointerDown = React.useCallback(
        (event: React.PointerEvent<HTMLButtonElement>) => {
            if (disabled) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            const startClient = orientation === 'vertical' ? event.clientX : event.clientY;
            dragRef.current = {
                pointerId: event.pointerId,
                startClient,
                startValue: valuePx,
                latestValue: valuePx
            };
            setDragging(true);
            onResizeStart?.();
        },
        [disabled, onResizeStart, orientation, valuePx]
    );

    const handlePointerMove = React.useCallback(
        (event: React.PointerEvent<HTMLButtonElement>) => {
            const state = dragRef.current;
            if (!state || state.pointerId !== event.pointerId) return;
            const currentClient = orientation === 'vertical' ? event.clientX : event.clientY;
            const delta = (currentClient - state.startClient) * (invert ? -1 : 1);
            state.latestValue = resizeTo(state.startValue + delta);
        },
        [invert, orientation, resizeTo]
    );

    const handlePointerUp = React.useCallback(
        (event: React.PointerEvent<HTMLButtonElement>) => {
            const state = dragRef.current;
            if (!state || state.pointerId !== event.pointerId) return;
            dragRef.current = null;
            setDragging(false);
            endResize(state.latestValue);
        },
        [endResize]
    );

    React.useEffect(() => {
        if (!dragging) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            const state = dragRef.current;
            if (!state) return;
            event.preventDefault();
            resizeTo(state.startValue);
            endResize(state.startValue);
            dragRef.current = null;
            setDragging(false);
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [dragging, endResize, resizeTo]);

    const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (disabled) return;

            const arrowBack = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
            const arrowForward = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
            if (event.key === arrowBack || event.key === arrowForward) {
                event.preventDefault();
                const direction = event.key === arrowForward ? 1 : -1;
                const signedDirection = direction * (invert ? -1 : 1);
                const next = resizeTo(valuePx + signedDirection * stepPx);
                endResize(next);
                return;
            }

            if (event.key === 'Home') {
                event.preventDefault();
                const next = resizeTo(minValuePx);
                endResize(next);
                return;
            }

            if (event.key === 'End') {
                event.preventDefault();
                const next = resizeTo(maxValuePx);
                endResize(next);
            }
        },
        [disabled, endResize, invert, maxValuePx, minValuePx, orientation, resizeTo, stepPx, valuePx]
    );

    return (
        <>
            <button
                type='button'
                aria-label={ariaLabel}
                aria-orientation={orientation}
                aria-valuemin={minValuePx}
                aria-valuemax={maxValuePx}
                aria-valuenow={clamp(valuePx, minValuePx, maxValuePx)}
                data-orientation={orientation}
                data-dragging={dragging ? 'true' : 'false'}
                disabled={disabled}
                role='separator'
                tabIndex={disabled ? -1 : 0}
                className={cn(
                    'group relative shrink-0 touch-none outline-none disabled:pointer-events-none disabled:opacity-50',
                    orientation === 'vertical' ? 'w-3 cursor-col-resize' : 'h-3 cursor-row-resize',
                    className
                )}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={() => {
                    if (disabled) return;
                    const next = clamp(defaultValuePx, minValuePx, maxValuePx);
                    onReset?.();
                    onResize(next);
                    onResizeEnd?.(next);
                }}
                onKeyDown={handleKeyDown}>
                <span
                    aria-hidden='true'
                    className={cn(
                        'bg-border group-hover:bg-primary/70 group-focus-visible:bg-primary absolute transition-colors',
                        orientation === 'vertical'
                            ? 'top-0 bottom-0 left-1/2 w-px -translate-x-1/2'
                            : 'top-1/2 right-0 left-0 h-px -translate-y-1/2',
                        dragging && 'bg-primary'
                    )}
                />
            </button>
            {dragging && (
                <div
                    aria-hidden='true'
                    className={cn(
                        'fixed inset-0 z-[70] touch-none',
                        orientation === 'vertical' ? 'cursor-col-resize' : 'cursor-row-resize'
                    )}
                />
            )}
        </>
    );
}
