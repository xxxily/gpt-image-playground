'use client';

import { cn } from '@/lib/utils';
import type { InspirationSite } from '@/types/inspiration-sites';
import * as React from 'react';

function getSiteInitial(title: string): string {
    return title.trim().charAt(0).toLocaleUpperCase() || '?';
}

function getFaviconUrl(siteUrl: string): string | null {
    try {
        const url = new URL(siteUrl);
        if (url.protocol !== 'https:') return null;
        return `${url.origin}/favicon.ico`;
    } catch {
        return null;
    }
}

export function InspirationSiteAvatar({ site, className }: { site: InspirationSite; className?: string }) {
    const faviconUrl = React.useMemo(() => getFaviconUrl(site.url), [site.url]);
    const [faviconReady, setFaviconReady] = React.useState(false);

    React.useEffect(() => {
        setFaviconReady(false);
    }, [faviconUrl]);

    return (
        <span
            aria-hidden='true'
            className={cn(
                'from-primary/10 to-primary/5 text-primary border-primary/10 group-hover:from-primary group-hover:to-primary/95 group-hover:text-primary-foreground relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-tr text-sm font-black shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-transparent',
                faviconReady && 'bg-card from-card to-card group-hover:from-card group-hover:to-card',
                className
            )}>
            <span className={cn('transition-opacity duration-200', faviconReady ? 'opacity-0' : 'opacity-100')}>
                {getSiteInitial(site.title)}
            </span>
            {faviconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={faviconUrl}
                    alt=''
                    className={cn(
                        'absolute h-6 w-6 rounded-md object-contain transition-opacity duration-200',
                        faviconReady ? 'opacity-100' : 'opacity-0'
                    )}
                    draggable={false}
                    loading='lazy'
                    decoding='async'
                    referrerPolicy='no-referrer'
                    onLoad={() => setFaviconReady(true)}
                    onError={() => setFaviconReady(false)}
                />
            )}
        </span>
    );
}
