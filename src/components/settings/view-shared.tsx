import { ChevronDown, ChevronRight } from 'lucide-react';
import * as React from 'react';

export function statusBadge(label: string, tone: 'green' | 'blue' | 'amber') {
    const toneClass =
        tone === 'green'
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
            : tone === 'blue'
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    const dotClass = tone === 'green' ? 'bg-emerald-500' : tone === 'blue' ? 'bg-blue-500' : 'bg-amber-500';

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            {label}
        </span>
    );
}

export function SettingsNavigationButton({
    title,
    description,
    icon,
    badge,
    onClick
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            className='border-border bg-card/80 hover:bg-accent/50 focus-visible:ring-offset-background flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:outline-none'>
            <span className='flex min-w-0 items-start gap-3'>
                <span
                    className='bg-muted text-muted-foreground mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl'
                    aria-hidden='true'>
                    {icon}
                </span>
                <span className='min-w-0'>
                    <span className='text-foreground block text-sm font-semibold'>{title}</span>
                    <span className='text-muted-foreground mt-1 block text-sm leading-5'>{description}</span>
                </span>
            </span>
            <span className='flex shrink-0 items-center gap-2'>
                {badge}
                <ChevronRight className='text-muted-foreground h-4 w-4' />
            </span>
        </button>
    );
}

export function ProviderSection({
    title,
    description,
    icon,
    children,
    defaultOpen = false
}: {
    title: string;
    description: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = React.useState(defaultOpen);

    return (
        <section className='border-border bg-card/80 dark:bg-panel-soft rounded-2xl border shadow-sm'>
            <button
                type='button'
                onClick={() => setOpen((value) => !value)}
                className='hover:bg-accent/50 focus-visible:ring-offset-background flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:outline-none'
                aria-expanded={open}>
                <span className='min-w-0'>
                    <span className='text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-[0.22em] uppercase'>
                        {icon && (
                            <span className='text-muted-foreground' aria-hidden='true'>
                                {icon}
                            </span>
                        )}
                        {title}
                    </span>
                    <span className='text-muted-foreground mt-1 block text-sm'>{description}</span>
                </span>
                <ChevronDown
                    className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && <div className='border-border space-y-4 border-t p-4'>{children}</div>}
        </section>
    );
}
