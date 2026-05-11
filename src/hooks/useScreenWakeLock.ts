import * as React from 'react';

type WakeLockSentinelLike = EventTarget & {
    released: boolean;
    release: () => Promise<void>;
};

type WakeLockNavigator = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
};

export type ScreenWakeLockState = {
    supported: boolean;
    active: boolean;
    error: string | null;
};

export function useScreenWakeLock(enabled: boolean): ScreenWakeLockState {
    const sentinelRef = React.useRef<WakeLockSentinelLike | null>(null);
    const [state, setState] = React.useState<ScreenWakeLockState>({
        supported: true,
        active: false,
        error: null
    });

    React.useEffect(() => {
        if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
            setState({ supported: false, active: false, error: null });
            return;
        }

        let cancelled = false;
        const wakeLock = (navigator as WakeLockNavigator).wakeLock;

        const releaseCurrent = async () => {
            const sentinel = sentinelRef.current;
            sentinelRef.current = null;
            if (sentinel && !sentinel.released) {
                await sentinel.release().catch(() => undefined);
            }
            if (!cancelled) {
                setState((current) => ({ ...current, active: false }));
            }
        };

        const requestWakeLock = async () => {
            if (!enabled || !wakeLock || document.visibilityState !== 'visible') {
                await releaseCurrent();
                return;
            }
            if (sentinelRef.current && !sentinelRef.current.released) {
                setState({ supported: true, active: true, error: null });
                return;
            }

            try {
                const sentinel = await wakeLock.request('screen');
                if (cancelled) {
                    await sentinel.release().catch(() => undefined);
                    return;
                }
                sentinelRef.current = sentinel;
                setState({ supported: true, active: true, error: null });
                sentinel.addEventListener('release', () => {
                    if (sentinelRef.current === sentinel) {
                        sentinelRef.current = null;
                    }
                    if (!cancelled) {
                        setState((current) => ({ ...current, active: false }));
                    }
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Screen wake lock request failed.';
                if (!cancelled) {
                    setState({ supported: true, active: false, error: message });
                }
            }
        };

        const handleVisibilityChange = () => {
            void requestWakeLock();
        };

        void requestWakeLock();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            void releaseCurrent();
        };
    }, [enabled]);

    return state;
}
