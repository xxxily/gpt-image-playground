'use client';

import { IconButton } from '@/components/ui/icon-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type='button'
                            aria-label={expandLabel}
                            onClick={() => onCollapseChange(false)}
                            className='group hover:bg-accent focus-visible:ring-ring flex min-h-0 w-full flex-1 flex-col items-center gap-2 rounded-lg px-1.5 py-3 transition-colors outline-none focus-visible:ring-2'>
                            <span className='text-muted-foreground group-hover:text-accent-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors'>
                                <ExpandIcon className='h-4 w-4' />
                            </span>
                            <span
                                className='text-muted-foreground group-hover:text-accent-foreground max-h-[14rem] min-w-0 overflow-hidden text-xs leading-none font-medium tracking-wider transition-colors'
                                style={{ writingMode: 'vertical-rl' }}>
                                {title}
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side={side === 'left' ? 'right' : 'left'}>{expandLabel}</TooltipContent>
                </Tooltip>
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
