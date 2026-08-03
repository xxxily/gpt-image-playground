'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ExternalLink, Sparkles, X } from 'lucide-react';

type ShowcaseAttributionChipProps = {
    label: string;
    topic: string;
    showcaseCase: string;
    openLabel: string;
    clearLabel: string;
    onOpen: () => void;
    onClear: () => void;
    className?: string;
};

export function ShowcaseAttributionChip({
    label,
    topic,
    showcaseCase,
    openLabel,
    clearLabel,
    onOpen,
    onClear,
    className
}: ShowcaseAttributionChipProps) {
    return (
        <div
            className={cn(
                'border-primary/20 bg-primary/8 text-foreground flex max-w-full min-w-0 items-center gap-1 rounded-lg border px-1.5 py-1',
                className
            )}>
            <Sparkles className='text-primary h-3.5 w-3.5 shrink-0' aria-hidden='true' />
            <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 max-w-full min-w-0 gap-1.5 px-1.5 text-xs'
                title={openLabel}
                aria-label={openLabel}
                onClick={onOpen}>
                <span className='text-muted-foreground shrink-0'>{label}</span>
                <span className='min-w-0 truncate' data-i18n-skip='true'>
                    {topic} / {showcaseCase}
                </span>
                <ExternalLink className='h-3 w-3 shrink-0' aria-hidden='true' />
            </Button>
            <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-foreground h-7 w-7 shrink-0'
                title={clearLabel}
                aria-label={clearLabel}
                onClick={onClear}>
                <X className='h-3.5 w-3.5' aria-hidden='true' />
            </Button>
        </div>
    );
}
