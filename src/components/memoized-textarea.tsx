'use client';

import { cn } from '@/lib/utils';
import * as React from 'react';

type MemoTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    contentSizingDebounceMs?: number;
    maxVisibleRows?: number;
    value: string;
    valueSetter: React.Dispatch<React.SetStateAction<string>>;
};

const MemoTextareaBase = React.forwardRef<HTMLTextAreaElement, MemoTextareaProps>(function MemoTextarea(
    { className, contentSizingDebounceMs = 280, maxVisibleRows = 20, style, value, valueSetter, onChange, ...restProps },
    ref
) {
    const [contentSizingReady, setContentSizingReady] = React.useState(true);
    const [lockedHeightPx, setLockedHeightPx] = React.useState<number | null>(null);
    const contentSizingTimerRef = React.useRef<number | null>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const hasMountedRef = React.useRef(false);
    const resolvedMaxVisibleRows =
        Number.isFinite(maxVisibleRows) && maxVisibleRows > 0 ? Math.floor(maxVisibleRows) : undefined;
    const textareaStyle = React.useMemo<React.CSSProperties | undefined>(() => {
        const sizingStyle = resolvedMaxVisibleRows
            ? {
                  maxHeight: `calc(${resolvedMaxVisibleRows}lh + 1rem)`,
                  overflowY: 'auto' as const
              }
            : undefined;
        const typingStyle =
            contentSizingReady || lockedHeightPx === null
                ? undefined
                : {
                      height: `${lockedHeightPx}px`,
                      overflowY: 'hidden' as const
                  };

        return {
            ...sizingStyle,
            ...style,
            ...typingStyle
        };
    }, [contentSizingReady, lockedHeightPx, resolvedMaxVisibleRows, style]);

    const captureCurrentHeight = React.useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        setLockedHeightPx(textarea.getBoundingClientRect().height);
    }, []);

    const setTextareaRef = React.useCallback(
        (node: HTMLTextAreaElement | null) => {
            textareaRef.current = node;
            if (typeof ref === 'function') {
                ref(node);
                return;
            }
            if (ref) {
                ref.current = node;
            }
        },
        [ref]
    );

    React.useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
        }

        if (contentSizingTimerRef.current !== null) {
            window.clearTimeout(contentSizingTimerRef.current);
        }

        captureCurrentHeight();
        setContentSizingReady(false);
        contentSizingTimerRef.current = window.setTimeout(() => {
            setContentSizingReady(true);
            setLockedHeightPx(null);
            contentSizingTimerRef.current = null;
        }, Math.max(0, contentSizingDebounceMs));

        return () => {
            if (contentSizingTimerRef.current !== null) {
                window.clearTimeout(contentSizingTimerRef.current);
                contentSizingTimerRef.current = null;
            }
        };
    }, [captureCurrentHeight, contentSizingDebounceMs, value]);

    const handleChange = React.useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setLockedHeightPx(e.currentTarget.getBoundingClientRect().height);
            setContentSizingReady(false);
            valueSetter(e.target.value);
            onChange?.(e);
        },
        [onChange, valueSetter]
    );

    return (
        <textarea
            ref={setTextareaRef}
            data-slot='textarea'
            value={value}
            onChange={handleChange}
            style={textareaStyle}
            className={cn(
                'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                contentSizingReady && 'field-sizing-content',
                className
            )}
            {...restProps}
        />
    );
});

export const MemoTextarea = React.memo(MemoTextareaBase);
MemoTextarea.displayName = 'MemoTextarea';

/** @deprecated Use MemoTextarea */
export const MemoizedTextarea = MemoTextarea;
