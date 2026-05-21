'use client';

import * as React from 'react';

export type NetworkStatus = {
    online: boolean;
    supported: boolean;
};

function readInitialOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    if (typeof navigator.onLine !== 'boolean') return true;
    return navigator.onLine;
}

function isNavigatorOnLineSupported(): boolean {
    if (typeof navigator === 'undefined') return false;
    return typeof navigator.onLine === 'boolean';
}

export function useNetworkStatus(): NetworkStatus {
    const [online, setOnline] = React.useState<boolean>(() => readInitialOnline());
    const [supported, setSupported] = React.useState<boolean>(() => isNavigatorOnLineSupported());

    React.useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (!isNavigatorOnLineSupported()) {
            setSupported(false);
            return undefined;
        }
        setSupported(true);
        setOnline(readInitialOnline());

        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { online, supported };
}
