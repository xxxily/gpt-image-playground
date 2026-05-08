'use client';

import { getSystemUnavailableFallbackTheme, THEME_STORAGE_KEY } from '@/lib/theme-config';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps, useTheme } from 'next-themes';
import * as React from 'react';

const PREFERS_COLOR_SCHEME_DARK_QUERY = '(prefers-color-scheme: dark)';

export function ThemeProvider({ children, storageKey = THEME_STORAGE_KEY, ...props }: ThemeProviderProps) {
    return (
        <NextThemesProvider storageKey={storageKey} {...props}>
            <SystemThemeFallback storageKey={storageKey} />
            {children}
        </NextThemesProvider>
    );
}

function SystemThemeFallback({ storageKey }: { storageKey: string }) {
    const { setTheme } = useTheme();

    React.useEffect(() => {
        if (canDetectSystemTheme()) {
            return;
        }

        const fallbackTheme = getSystemUnavailableFallbackTheme(getStoredTheme(storageKey));
        if (fallbackTheme) {
            setTheme(fallbackTheme);
        }
    }, [setTheme, storageKey]);

    return null;
}

function canDetectSystemTheme() {
    if (typeof window.matchMedia !== 'function') {
        return false;
    }

    try {
        return window.matchMedia(PREFERS_COLOR_SCHEME_DARK_QUERY).media !== 'not all';
    } catch {
        return false;
    }
}

function getStoredTheme(storageKey: string) {
    try {
        return window.localStorage.getItem(storageKey);
    } catch {
        return null;
    }
}
