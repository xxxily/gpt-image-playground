'use client';

import { IconButton } from '@/components/ui/icon-button';
import { cn } from '@/lib/utils';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import * as React from 'react';

type WorkspacePaneProps = {
    title: React.ReactNode;
    description?: React.ReactNode;
    collapsed?: boolean;
    collapseLabel: string;
    expandLabel: string;
    closeLabel: string;
    className?: string;
    toolbar?: React.ReactNode;
    side?: 'left' | 'right';
    children: React.ReactNode;
    onCollapseChange: (collapsed: boolean) => void;
    onClose: () => void;
};

export function WorkspacePane({
    title,
    description,
    collapsed = false,
    collapseLabel,
    expandLabel,
    closeLabel,
    className,
    toolbar,
    side = 'right',
    children,
    onCollapseChange,
    onClose
}: WorkspacePaneProps) {
    const CollapseIcon = side === 'left' ? PanelLeftClose : PanelRightClose;
    const ExpandIcon = side === 'left' ? PanelLeftOpen : PanelRightOpen;

    if (collapsed) {
        return (
            <aside
                role='complementary'
                aria-label={typeof title === 'string' ? title : undefined}
                data-collapsed='true'
                className={cn(
                    'bg-background/95 text-foreground flex h-full min-h-0 w-full flex-col items-center',
                    className
                )}>
                <div className='flex min-h-0 flex-1 flex-col items-center gap-2 px-1.5 py-3'>
                    <IconButton
                        type='button'
                        size='sm'
                        variant='ghost'
                        aria-label={expandLabel}
                        tooltip={expandLabel}
                        onClick={() => onCollapseChange(false)}>
                        <ExpandIcon className='h-4 w-4' />
                    </IconButton>
                    <div
                        className='text-muted-foreground max-h-[14rem] min-w-0 rotate-180 overflow-hidden text-xs font-medium tracking-wider uppercase'
                        style={{ writingMode: 'vertical-rl' }}>
                        {title}
                    </div>
                </div>
            </aside>
        );
    }

    return (
        <aside
            role='complementary'
            aria-label={typeof title === 'string' ? title : undefined}
            className={cn(
                'bg-background text-foreground flex h-full min-h-0 w-full flex-col overflow-hidden',
                className
            )}>
            <div className='border-border bg-background/95 flex shrink-0 items-start gap-2 border-b px-3 py-2.5 backdrop-blur'>
                <div className='min-w-0 flex-1'>
                    <h2 className='truncate text-sm font-semibold'>{title}</h2>
                    {description && <p className='text-muted-foreground truncate text-xs'>{description}</p>}
                </div>
                {toolbar && <div className='flex min-w-0 shrink-0 items-center gap-1'>{toolbar}</div>}
                <IconButton
                    type='button'
                    size='sm'
                    variant='ghost'
                    aria-label={collapseLabel}
                    tooltip={collapseLabel}
                    onClick={() => onCollapseChange(true)}>
                    <CollapseIcon className='h-4 w-4' />
                </IconButton>
                <IconButton
                    type='button'
                    size='sm'
                    variant='ghost'
                    aria-label={closeLabel}
                    tooltip={closeLabel}
                    onClick={onClose}>
                    <X className='h-4 w-4' />
                </IconButton>
            </div>
            <div className='min-h-0 flex-1 overflow-hidden overscroll-contain'>{children}</div>
        </aside>
    );
}
