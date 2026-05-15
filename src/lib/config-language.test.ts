import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG, loadConfig, saveConfig } from './config';

function createLocalStorageMock() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => {
            store.clear();
        }
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('config language persistence', () => {
    it('falls back to the runtime language when no config is stored', () => {
        const localStorage = createLocalStorageMock();
        vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() });
        vi.stubGlobal('localStorage', localStorage);
        vi.stubGlobal('navigator', { languages: ['en-GB'], language: 'en-GB' });

        const config = loadConfig();
        expect(config.appLanguage).toBe('en-US');
    });

    it('normalizes app language before saving', () => {
        const localStorage = createLocalStorageMock();
        const dispatchEvent = vi.fn();
        vi.stubGlobal('window', { localStorage, dispatchEvent });
        vi.stubGlobal('localStorage', localStorage);
        vi.stubGlobal('navigator', { languages: ['zh-CN'], language: 'zh-CN' });

        saveConfig({ ...DEFAULT_CONFIG, appLanguage: 'en-US' });
        const parsed = JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || '{}') as { appLanguage?: string };

        expect(parsed.appLanguage).toBe('en-US');
        expect(dispatchEvent).toHaveBeenCalled();
    });
});

