'use client';

import { handleExternalLinkClick } from '@/lib/desktop-runtime';
import { cn } from '@/lib/utils';
import * as React from 'react';

export type ExternalLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'onClick'> & {
    href: string;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export const ExternalLink = React.forwardRef<HTMLAnchorElement, ExternalLinkProps>(function ExternalLink(
    { href, onClick, className, children, ...rest },
    ref
) {
    const tauriClickHandler = React.useMemo(() => handleExternalLinkClick(href), [href]);

    const handleClick = React.useCallback(
        (event: React.MouseEvent<HTMLAnchorElement>) => {
            tauriClickHandler(event);
            if (onClick) onClick(event);
        },
        [tauriClickHandler, onClick]
    );

    return (
        <a
            ref={ref}
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            onClick={handleClick}
            className={cn(className)}
            {...rest}>
            {children}
        </a>
    );
});
