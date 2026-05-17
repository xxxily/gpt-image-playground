import * as React from 'react';
import { cn } from '@/lib/utils';

export type SkeletonProps = React.ComponentProps<'div'>;

export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            data-slot='skeleton'
            aria-hidden='true'
            className={cn('bg-panel-subtle animate-pulse rounded-md', className)}
            {...props}
        />
    );
}
