import type { ThemeProviderProps } from 'next-themes';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const SYSTEM_THEME_UNAVAILABLE_FALLBACK = 'light';

// Use system preference for normal first-load detection, then fall back to light
// from the client provider when prefers-color-scheme cannot be resolved.
export const appThemeProviderConfig = {
    attribute: 'class',
    storageKey: THEME_STORAGE_KEY,
    defaultTheme: 'system',
    enableSystem: true,
    disableTransitionOnChange: true,
    enableColorScheme: true
} satisfies Omit<ThemeProviderProps, 'children'>;

export function getSystemUnavailableFallbackTheme(storedTheme: string | null): ResolvedTheme | null {
    if (storedTheme === 'light' || storedTheme === 'dark') {
        return null;
    }

    return SYSTEM_THEME_UNAVAILABLE_FALLBACK;
}
