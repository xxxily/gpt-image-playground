'use client';

import { cn } from '@/lib/utils';
import { FolderKanban } from 'lucide-react';

type WorkspaceStatusChipProps = {
    name: string;
    openLabel: string;
    onOpen: () => void;
    className?: string;
};

export function WorkspaceStatusChip({
    name,
    openLabel,
    onOpen,
    className
}: WorkspaceStatusChipProps) {
    return (
        <div className={cn('flex min-w-0 justify-end', className)}>
            <button
                type='button'
                title={openLabel}
                aria-label={openLabel}
                onClick={onOpen}
                className='group text-on-panel-faint hover:bg-accent/45 hover:text-foreground focus-visible:ring-ring ml-auto inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium whitespace-nowrap transition-colors active:bg-accent/70 focus-visible:ring-2 focus-visible:outline-none'>
                <FolderKanban className='text-on-panel-faint group-hover:text-primary h-3 w-3 shrink-0 transition-colors' />
                <span suppressHydrationWarning className='min-w-0 truncate transition-colors group-hover:text-foreground' data-i18n-skip='true'>
                    {name}
                </span>
            </button>
        </div>
    );
}
