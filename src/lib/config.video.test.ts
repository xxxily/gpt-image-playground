import { CONFIG_STORAGE_KEY, loadConfig } from './config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_VIDEO_SYNC_OPTIONS,
    DEFAULT_VIDEO_TASK_DEFAULTS
} from '@/lib/video-types';

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

describe('config video fields', () => {
    it('loadConfig returns videoTaskDefaults and videoSyncOptions of correct shape for missing input', () => {
        const localStorage = createLocalStorageMock();
        vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() });
        vi.stubGlobal('localStorage', localStorage);
        vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });

        const configDefaults = loadConfig();

        expect(configDefaults.videoTaskDefaults).toEqual(DEFAULT_VIDEO_TASK_DEFAULTS);
        expect(configDefaults.videoSyncOptions).toEqual(DEFAULT_VIDEO_SYNC_OPTIONS);

        localStorage.setItem(
            CONFIG_STORAGE_KEY,
            JSON.stringify({ appLanguage: 'en-US' })
        );
        const configPartial = loadConfig();
        expect(configPartial.videoTaskDefaults).toEqual(DEFAULT_VIDEO_TASK_DEFAULTS);
        expect(configPartial.videoSyncOptions).toEqual(DEFAULT_VIDEO_SYNC_OPTIONS);
    });

    it('loadConfig clamps invalid videoTaskDefaults.pollingIntervalSeconds to 1', () => {
        const localStorage = createLocalStorageMock();
        vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() });
        vi.stubGlobal('localStorage', localStorage);
        vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' });

        localStorage.setItem(
            CONFIG_STORAGE_KEY,
            JSON.stringify({
                appLanguage: 'en-US',
                videoTaskDefaults: { pollingIntervalSeconds: -5 }
            })
        );

        const config = loadConfig();
        expect(config.videoTaskDefaults.pollingIntervalSeconds).toBe(1);
    });
});
