type TauriCoreApi = {
    invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    Channel: new <T>() => { onmessage: ((value: T) => void) | null };
};

type TauriWindow = Window & {
    __TAURI_INTERNALS__?: unknown;
};

let tauriCorePromise: Promise<TauriCoreApi> | null = null;

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
