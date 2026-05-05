type TauriCoreApi = {
    invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
    Channel: new <T>() => { onmessage: ((value: T) => void) | null };
};

type TauriEventApi = {
    listen: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;
};

type TauriEventUnlisten = () => void;

type TauriWindow = Window & {
    __TAURI_INTERNALS__?: unknown;
};

let tauriCorePromise: Promise<TauriCoreApi> | null = null;
let tauriEventPromise: Promise<TauriEventApi> | null = null;

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

async function loadTauriEvent(): Promise<TauriEventApi> {
    if (!tauriEventPromise) {
        tauriEventPromise = import('@tauri-apps/api/event');
    }
    return tauriEventPromise;
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
    channel.onmessage = (value) => onEvent(value);

    await invoke<void>(command, { ...args, channel });
}

export async function setupDesktopStreaming(
    eventPrefix: string,
    onEvent: (event: { eventType: string; data: Record<string, unknown> }) => void
): Promise<TauriEventUnlisten> {
    const { listen } = await loadTauriEvent();
    return listen<{ eventType: string; data: Record<string, unknown> }>(
        eventPrefix,
        (e) => onEvent(e.payload)
    );
}
