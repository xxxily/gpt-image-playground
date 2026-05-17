import { useEffect, useState } from 'react';

export const BREAKPOINTS = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export function isBelowBreakpoint(bp: Breakpoint): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${BREAKPOINTS[bp] - 1}px)`).matches;
}

export function isAboveOrAtBreakpoint(bp: Breakpoint): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${BREAKPOINTS[bp]}px)`).matches;
}

export const isMobileViewport = () => isBelowBreakpoint('lg');

export function useMediaQueryAtLeast(bp: Breakpoint): boolean {
    const [matches, setMatches] = useState<boolean>(() => isAboveOrAtBreakpoint(bp));
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(`(min-width: ${BREAKPOINTS[bp]}px)`);
        const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
        setMatches(mql.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [bp]);
    return matches;
}

export function useIsMobileViewport(): boolean {
    return !useMediaQueryAtLeast('lg');
}
