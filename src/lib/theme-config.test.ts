import { describe, expect, it } from 'vitest';

import {
    appThemeProviderConfig,
    getSystemUnavailableFallbackTheme,
    SYSTEM_THEME_UNAVAILABLE_FALLBACK,
    THEME_STORAGE_KEY
} from './theme-config';

describe('appThemeProviderConfig', () => {
    it('uses the system preference for first visits instead of forcing dark mode', () => {
        expect(appThemeProviderConfig.attribute).toBe('class');
        expect(appThemeProviderConfig.storageKey).toBe(THEME_STORAGE_KEY);
        expect(appThemeProviderConfig.enableSystem).toBe(true);
        expect(appThemeProviderConfig.defaultTheme).toBe('system');
        expect(appThemeProviderConfig.defaultTheme).not.toBe('dark');
    });

    it('uses light as the fallback when system theme detection is unavailable', () => {
        expect(SYSTEM_THEME_UNAVAILABLE_FALLBACK).toBe('light');
        expect(getSystemUnavailableFallbackTheme(null)).toBe('light');
        expect(getSystemUnavailableFallbackTheme('system')).toBe('light');
        expect(getSystemUnavailableFallbackTheme('unexpected')).toBe('light');
    });

    it('preserves explicit user theme choices when system detection is unavailable', () => {
        expect(getSystemUnavailableFallbackTheme('light')).toBeNull();
        expect(getSystemUnavailableFallbackTheme('dark')).toBeNull();
    });
});
