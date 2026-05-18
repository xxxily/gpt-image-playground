import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE_CLASS = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-7 w-7',
    '2xl': 'h-8 w-8'
} as const;

export interface SpinnerProps extends Omit<React.ComponentProps<'span'>, 'children'> {
    size?: keyof typeof SIZE_CLASS;
    label?: string;
}

export function Spinner({ size = 'md', label, className, ...props }: SpinnerProps) {
    return (
        <span
            data-slot='spinner'
            role='status'
            aria-live='polite'
            aria-label={label ?? 'Loading'}
            className={cn('inline-flex items-center justify-center', className)}
            {...props}>
            <Loader2 className={cn('animate-spin', SIZE_CLASS[size])} aria-hidden='true' />
        </span>
    );
}
