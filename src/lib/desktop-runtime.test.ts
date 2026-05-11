import {
    checkDesktopUpdate,
    installDesktopUpdate,
    isTauriDesktop,
    invokeDesktopCommand,
    invokeDesktopStreamingCommand,
    relaunchDesktopApp,
    type DesktopUpdate,
    type DesktopUpdateDownloadEvent
} from './desktop-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';

type MockChannel = {
    onmessage: ((value: unknown) => void) | null;
};

const tauriMocks = vi.hoisted(() => ({
    invoke: vi.fn(),
    checkUpdate: vi.fn(),
    relaunch: vi.fn(),
    channels: [] as MockChannel[]
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: tauriMocks.invoke,
    Channel: class {
        onmessage: ((value: unknown) => void) | null = null;

        constructor() {
            tauriMocks.channels.push(this);
        }
    }
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
    check: tauriMocks.checkUpdate
}));

vi.mock('@tauri-apps/plugin-process', () => ({
    relaunch: tauriMocks.relaunch
}));

function stubTauriWindow() {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
}

function getChannel(value: unknown): MockChannel | null {
    if (typeof value !== 'object' || value === null || !('onmessage' in value)) return null;
    const channel = value as { onmessage?: unknown };
    if (channel.onmessage === null) return { onmessage: null };
    if (typeof channel.onmessage !== 'function') return null;
    const onmessage = channel.onmessage as (value: unknown) => void;
    return { onmessage };
}

afterEach(() => {
    tauriMocks.invoke.mockReset();
    tauriMocks.checkUpdate.mockReset();
    tauriMocks.relaunch.mockReset();
    tauriMocks.channels.length = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('isTauriDesktop', () => {
    it('returns false when __TAURI_INTERNALS__ is not present', () => {
        delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
        expect(isTauriDesktop()).toBe(false);
    });

    it('returns false in a non-browser environment (no window)', async () => {
        const result = isTauriDesktop();
        expect(result).toBe(false);
    });

    it('returns true when Tauri internals are present on window', () => {
        stubTauriWindow();
        expect(isTauriDesktop()).toBe(true);
    });
});

describe('invokeDesktopCommand', () => {
    it('throws when not in Tauri desktop environment', async () => {
        delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
        await expect(invokeDesktopCommand('proxy_images', {})).rejects.toThrow('当前运行环境不是 Tauri 桌面端');
    });

    it('invokes a Tauri command with the provided args', async () => {
        stubTauriWindow();
        tauriMocks.invoke.mockResolvedValueOnce({ ok: true });

        await expect(invokeDesktopCommand('proxy_images', { request: { model: 'gpt-image-2' } })).resolves.toEqual({
            ok: true
        });

        expect(tauriMocks.invoke).toHaveBeenCalledWith('proxy_images', { request: { model: 'gpt-image-2' } });
    });
});

describe('invokeDesktopStreamingCommand', () => {
    it('throws when not in Tauri desktop environment', async () => {
        delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
        await expect(invokeDesktopStreamingCommand('proxy_images_streaming', {}, () => {})).rejects.toThrow(
            '当前运行环境不是 Tauri 桌面端'
        );
    });

    it('passes a Channel to Tauri and forwards channel messages', async () => {
        stubTauriWindow();
        const events: unknown[] = [];

        tauriMocks.invoke.mockImplementationOnce((_command: string, args?: Record<string, unknown>) => {
            const channel = getChannel(args?.channel);
            channel?.onmessage?.({ eventType: 'image_generation.partial_image', data: { b64_json: 'abc' } });
            return Promise.resolve(undefined);
        });

        await invokeDesktopStreamingCommand(
            'proxy_images_streaming',
            { request: { enableStreaming: true } },
            (event) => {
                events.push(event);
            }
        );

        expect(tauriMocks.channels).toHaveLength(1);
        expect(tauriMocks.invoke).toHaveBeenCalledWith('proxy_images_streaming', {
            request: { enableStreaming: true },
            channel: tauriMocks.channels[0]
        });
        expect(events).toEqual([{ eventType: 'image_generation.partial_image', data: { b64_json: 'abc' } }]);
    });
});

describe('checkDesktopUpdate', () => {
    it('throws when not in Tauri desktop environment', async () => {
        delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
        await expect(checkDesktopUpdate()).rejects.toThrow('当前运行环境不是 Tauri 桌面端');
    });

    it('checks for an update through the Tauri updater plugin', async () => {
        stubTauriWindow();
        const update = {
            currentVersion: '1.0.0',
            version: '1.1.0',
            downloadAndInstall: vi.fn()
        } satisfies DesktopUpdate;

        tauriMocks.checkUpdate.mockResolvedValueOnce(update);

        await expect(checkDesktopUpdate()).resolves.toBe(update);
        expect(tauriMocks.checkUpdate).toHaveBeenCalledWith({ timeout: 15_000 });
    });
});

describe('installDesktopUpdate', () => {
    it('throws when not in Tauri desktop environment', async () => {
        delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
        const update = {
            currentVersion: '1.0.0',
            version: '1.1.0',
            downloadAndInstall: vi.fn()
        } satisfies DesktopUpdate;

        await expect(installDesktopUpdate(update)).rejects.toThrow('当前运行环境不是 Tauri 桌面端');
    });

    it('downloads and installs an update with progress events', async () => {
        stubTauriWindow();
        const events: unknown[] = [];
        const update = {
            currentVersion: '1.0.0',
            version: '1.1.0',
            downloadAndInstall: vi.fn(async (onEvent?: (event: DesktopUpdateDownloadEvent) => void) => {
                onEvent?.({ event: 'Finished' });
            })
        } satisfies DesktopUpdate;

        await installDesktopUpdate(update, (event) => events.push(event));

        expect(update.downloadAndInstall).toHaveBeenCalledTimes(1);
        expect(events).toEqual([{ event: 'Finished' }]);
    });
});

describe('relaunchDesktopApp', () => {
    it('throws when not in Tauri desktop environment', async () => {
        delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
        await expect(relaunchDesktopApp()).rejects.toThrow('当前运行环境不是 Tauri 桌面端');
    });

    it('relaunches through the Tauri process plugin', async () => {
        stubTauriWindow();
        tauriMocks.relaunch.mockResolvedValueOnce(undefined);

        await relaunchDesktopApp();

        expect(tauriMocks.relaunch).toHaveBeenCalledTimes(1);
    });
});
