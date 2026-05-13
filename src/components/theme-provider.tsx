'use client';

import { getSystemUnavailableFallbackTheme, THEME_STORAGE_KEY } from '@/lib/theme-config';
import * as React from 'react';

const PREFERS_COLOR_SCHEME_DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_VALUES = ['light', 'dark'] as const;
const DEFAULT_THEMES = [...THEME_VALUES];

type ResolvedTheme = (typeof THEME_VALUES)[number];
type Theme = ResolvedTheme | 'system';

export type ThemeProviderProps = {
    children: React.ReactNode;
    storageKey?: string;
    defaultTheme?: Theme;
    enableSystem?: boolean;
    enableColorScheme?: boolean;
    disableTransitionOnChange?: boolean;
    attribute?: 'class' | `data-${string}` | Array<'class' | `data-${string}`>;
    themes?: ResolvedTheme[];
};

type ThemeContextValue = {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    systemTheme: ResolvedTheme;
    themes: Theme[];
    setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
    const context = React.useContext(ThemeContext);
    if (context) return context;

    return {
        theme: 'system',
        resolvedTheme: 'light',
        systemTheme: 'light',
        themes: ['light', 'dark', 'system'],
        setTheme: () => undefined
    };
}

export function ThemeProvider({
    children,
    storageKey = THEME_STORAGE_KEY,
    defaultTheme = 'system',
    enableSystem = true,
    enableColorScheme = true,
    disableTransitionOnChange = false,
    attribute = 'class',
    themes = DEFAULT_THEMES
}: ThemeProviderProps) {
    const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
    const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme>('light');

    React.useEffect(() => {
        const storedTheme = readStoredTheme(storageKey);
        const fallbackTheme = getSystemUnavailableFallbackTheme(storedTheme);
        setThemeState(normalizeTheme(storedTheme || fallbackTheme || defaultTheme, defaultTheme));
    }, [defaultTheme, storageKey]);

    React.useEffect(() => {
        const updateSystemTheme = () => setSystemTheme(resolveSystemTheme());
        updateSystemTheme();

        if (typeof window.matchMedia !== 'function') return undefined;
        const media = window.matchMedia(PREFERS_COLOR_SCHEME_DARK_QUERY);
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', updateSystemTheme);
            return () => media.removeEventListener('change', updateSystemTheme);
        }

        media.addListener(updateSystemTheme);
        return () => media.removeListener(updateSystemTheme);
    }, []);

    const resolvedTheme = theme === 'system' && enableSystem ? systemTheme : theme === 'dark' ? 'dark' : 'light';

    React.useEffect(() => {
        return applyThemeToDocument({
            resolvedTheme,
            attribute,
            themes,
            enableColorScheme,
            disableTransitionOnChange
        });
    }, [attribute, disableTransitionOnChange, enableColorScheme, resolvedTheme, themes]);

    const setTheme = React.useCallback((nextTheme: Theme) => {
        const normalizedTheme = normalizeTheme(nextTheme, 'system');
        setThemeState(normalizedTheme);
        try {
            window.localStorage.setItem(storageKey, normalizedTheme);
        } catch {
            // localStorage can be unavailable in private or locked-down contexts.
        }
    }, [storageKey]);

    const value = React.useMemo<ThemeContextValue>(
        () => ({
            theme,
            resolvedTheme,
            systemTheme,
            themes: enableSystem ? [...themes, 'system'] : themes,
            setTheme
        }),
        [enableSystem, resolvedTheme, setTheme, systemTheme, theme, themes]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function normalizeTheme(value: string | null | undefined, fallback: Theme): Theme {
    if (value === 'light' || value === 'dark' || value === 'system') return value;
    return fallback;
}

function readStoredTheme(storageKey: string): string | null {
    try {
        return window.localStorage.getItem(storageKey);
    } catch {
        return null;
    }
}

function resolveSystemTheme(): ResolvedTheme {
    if (typeof window.matchMedia !== 'function') return 'light';

    try {
        return window.matchMedia(PREFERS_COLOR_SCHEME_DARK_QUERY).matches ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

function applyThemeToDocument({
    resolvedTheme,
    attribute,
    themes,
    enableColorScheme,
    disableTransitionOnChange
}: {
    resolvedTheme: ResolvedTheme;
    attribute: NonNullable<ThemeProviderProps['attribute']>;
    themes: ResolvedTheme[];
    enableColorScheme: boolean;
    disableTransitionOnChange: boolean;
}) {
    const restoreTransitions = disableTransitionOnChange ? disableTransitionsTemporarily() : undefined;
    const root = document.documentElement;
    const attributes = Array.isArray(attribute) ? attribute : [attribute];

    for (const item of attributes) {
        if (item === 'class') {
            root.classList.remove(...themes);
            root.classList.add(resolvedTheme);
        } else {
            root.setAttribute(item, resolvedTheme);
        }
    }

    if (enableColorScheme) {
        root.style.colorScheme = resolvedTheme;
    }

    restoreTransitions?.();
}

function disableTransitionsTemporarily() {
    const style = document.createElement('style');
    style.appendChild(
        document.createTextNode('*,*::before,*::after{transition:none!important}')
    );
    document.head.appendChild(style);

    return () => {
        window.getComputedStyle(document.body);
        window.setTimeout(() => {
            style.remove();
        }, 1);
    };
}
