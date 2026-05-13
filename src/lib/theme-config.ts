export type ResolvedTheme = 'light' | 'dark';
export type ThemeProviderConfig = {
    attribute: 'class';
    storageKey: string;
    defaultTheme: 'light' | 'dark' | 'system';
    enableSystem: boolean;
    disableTransitionOnChange: boolean;
    enableColorScheme: boolean;
};

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
} satisfies ThemeProviderConfig;

export function getSystemUnavailableFallbackTheme(storedTheme: string | null): ResolvedTheme | null {
    if (storedTheme === 'light' || storedTheme === 'dark') {
        return null;
    }

    return SYSTEM_THEME_UNAVAILABLE_FALLBACK;
}

export function buildThemeInitializerScript(config: ThemeProviderConfig = appThemeProviderConfig): string {
    const payload = JSON.stringify({
        attribute: config.attribute,
        storageKey: config.storageKey,
        defaultTheme: config.defaultTheme,
        enableSystem: config.enableSystem,
        enableColorScheme: config.enableColorScheme,
        fallbackTheme: SYSTEM_THEME_UNAVAILABLE_FALLBACK
    });

    return `(()=>{try{const c=${payload};const r=document.documentElement;const s=localStorage.getItem(c.storageKey);let t=s||c.defaultTheme;if(!s&&t==="system"&&typeof matchMedia!=="function")t=c.fallbackTheme;const d=()=>matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";const v=t==="system"&&c.enableSystem?d():t==="dark"?"dark":"light";if(c.attribute==="class"){r.classList.remove("light","dark");r.classList.add(v)}else{r.setAttribute(c.attribute,v)}if(c.enableColorScheme)r.style.colorScheme=v}catch(e){}})();`;
}
