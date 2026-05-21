import * as React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface WorkbenchCardProps extends React.ComponentProps<'div'> {
    asChild?: boolean;
}

export function WorkbenchCard({ className, ...props }: WorkbenchCardProps) {
    return (
        <Card
            className={cn(
                'app-panel-card group flex h-full w-full flex-col gap-0 overflow-hidden rounded-2xl border py-0 backdrop-blur-xl',
                className
            )}
            {...props}
        />
    );
}

export type WorkbenchCardHeaderProps = React.ComponentProps<'div'>;

export function WorkbenchCardHeader({ className, ...props }: WorkbenchCardHeaderProps) {
    return (
        <div
            data-slot='workbench-card-header'
            className={cn(
                'border-panel-divider flex shrink-0 items-start justify-between border-b px-4 pt-4 pb-4 sm:px-5',
                className
            )}
            {...props}
        />
    );
}

export type WorkbenchCardBodyProps = React.ComponentProps<'div'>;

export function WorkbenchCardBody({ className, ...props }: WorkbenchCardBodyProps) {
    return (
        <div
            data-slot='workbench-card-body'
            className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
            {...props}
        />
    );
}
