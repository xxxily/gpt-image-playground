import type { MouseEventHandler } from 'react';

type TauriCoreApi = {
    invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    Channel: new <T>() => { onmessage: ((value: T) => void) | null };
};

type TauriClipboardManagerApi = {
    writeText: (text: string) => Promise<void>;
};

type TauriOpenerApi = {
    openUrl: (url: string) => Promise<void>;
};

type TauriWindow = Window & {
    __TAURI_INTERNALS__?: unknown;
};

let tauriCorePromise: Promise<TauriCoreApi> | null = null;
let tauriClipboardManagerPromise: Promise<TauriClipboardManagerApi> | null = null;
let tauriOpenerPromise: Promise<TauriOpenerApi> | null = null;

export function isTauriDesktop(): boolean {
    if (typeof window === 'undefined') return false;
    const tauriWindow: TauriWindow = window;
    return tauriWindow.__TAURI_INTERNALS__ !== undefined;
}

async function loadTauriCore(): Promise<TauriCoreApi> {
    if (!tauriCorePromise) {
        tauriCorePromise = import('@tauri-apps/api/core');
    }
    return tauriCorePromise;
}

async function loadTauriClipboardManager(): Promise<TauriClipboardManagerApi> {
    if (!tauriClipboardManagerPromise) {
        tauriClipboardManagerPromise = import('@tauri-apps/plugin-clipboard-manager');
    }
    return tauriClipboardManagerPromise;
}

async function loadTauriOpener(): Promise<TauriOpenerApi> {
    if (!tauriOpenerPromise) {
        tauriOpenerPromise = import('@tauri-apps/plugin-opener');
    }
    return tauriOpenerPromise;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
    if (isTauriDesktop()) {
        try {
            const { writeText } = await loadTauriClipboardManager();
            await writeText(text);
            return true;
        } catch (error) {
            console.warn('Tauri clipboard copy failed, trying web clipboard fallback.', error);
        }
    }

    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        console.warn('Clipboard API copy failed, trying fallback.', error);
    }

    if (typeof document === 'undefined') return false;

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        return document.execCommand('copy');
    } catch (error) {
        console.error('Fallback clipboard copy failed.', error);
        return false;
    } finally {
        textArea.remove();
    }
}

export async function openExternalUrl(url: string): Promise<void> {
    if (isTauriDesktop()) {
        const { openUrl } = await loadTauriOpener();
        await openUrl(url);
        return;
    }

    if (typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
}

export function handleExternalLinkClick(url: string): MouseEventHandler<HTMLAnchorElement> {
    return (event) => {
        if (!isTauriDesktop()) return;

        event.preventDefault();
        openExternalUrl(url).catch((error) => {
            console.error('Failed to open external URL.', error);
        });
    };
}

export async function invokeDesktopCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!isTauriDesktop()) {
        throw new Error('当前运行环境不是 Tauri 桌面端。');
    }

    const { invoke } = await loadTauriCore();
    return invoke<T>(command, args);
}

export async function invokeDesktopStreamingCommand<T>(
    command: string,
    args: Record<string, unknown>,
    onEvent: (event: T) => void
): Promise<void> {
    if (!isTauriDesktop()) {
        throw new Error('当前运行环境不是 Tauri 桌面端。');
    }

    const { invoke, Channel } = await loadTauriCore();
    const channel = new Channel<T>();
    channel.onmessage = onEvent;

    await invoke<void>(command, { ...args, channel });
}
