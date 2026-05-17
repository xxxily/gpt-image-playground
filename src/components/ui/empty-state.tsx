import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps extends Omit<React.ComponentProps<'div'>, 'title'> {
    icon?: React.ReactNode;
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action, className, children, ...props }: EmptyStateProps) {
    return (
        <div
            data-slot='empty-state'
            className={cn(
                'flex w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center',
                className
            )}
            {...props}>
            {icon ? (
                <div className='text-on-panel-faint [&_svg]:h-10 [&_svg]:w-10' aria-hidden='true'>
                    {icon}
                </div>
            ) : null}
            {title ? <p className='text-foreground text-sm font-medium'>{title}</p> : null}
            {description ? <p className='text-on-panel-muted max-w-md text-sm'>{description}</p> : null}
            {children}
            {action ? <div className='mt-1'>{action}</div> : null}
        </div>
    );
}
