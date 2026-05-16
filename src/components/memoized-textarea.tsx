'use client';

import { cn } from '@/lib/utils';
import * as React from 'react';

type MemoTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    maxVisibleRows?: number;
    value: string;
    valueSetter: React.Dispatch<React.SetStateAction<string>>;
};

const MemoTextareaBase = React.forwardRef<HTMLTextAreaElement, MemoTextareaProps>(function MemoTextarea(
    { className, maxVisibleRows = 20, style, value, valueSetter, onChange, ...restProps },
    ref
) {
    const resolvedMaxVisibleRows =
        Number.isFinite(maxVisibleRows) && maxVisibleRows > 0 ? Math.floor(maxVisibleRows) : undefined;
    const textareaStyle = resolvedMaxVisibleRows
        ? {
              maxHeight: `calc(${resolvedMaxVisibleRows}lh + 1rem)`,
              overflowY: 'auto' as const,
              ...style
          }
        : style;

    const handleChange = React.useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            valueSetter(e.target.value);
            onChange?.(e);
        },
        [onChange, valueSetter]
    );

    return (
        <textarea
            ref={ref}
            data-slot='textarea'
            value={value}
            onChange={handleChange}
            style={textareaStyle}
            className={cn(
                'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
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
