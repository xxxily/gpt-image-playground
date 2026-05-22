'use client';

import * as React from 'react';
import { isTauriDesktop } from '@/lib/desktop-runtime';
import { getDisableDevtoolScope, shouldEnableDisableDevtoolForUrl } from '@/lib/disable-devtool';

export function DisableDevtoolBootstrap() {
    const initialUrlRef = React.useRef<string | null>(
        typeof window === 'undefined' ? null : window.location.href
    );

    React.useEffect(() => {
        const scope = getDisableDevtoolScope();

        // This feature is a deterrence layer for the web app only.
        // Desktop builds are intentionally left untouched.
        if (scope === 'none' || isTauriDesktop()) return;

        const currentUrl = window.location.href;
        const initialUrl = initialUrlRef.current;
        const urlCandidates = [initialUrl, currentUrl].filter((url): url is string => Boolean(url));
        const shouldEnable = urlCandidates.some((url) => shouldEnableDisableDevtoolForUrl(url, scope));
        if (!shouldEnable) return;

        let cancelled = false;

        void (async () => {
            try {
                const { default: disableDevtool } = await import('disable-devtool');
                if (cancelled) return;

                // Keep only the DevTools deterrence layer.
                // Leave normal user interactions untouched, especially right-click,
                // text selection, and clipboard operations.
                disableDevtool({
                    disableMenu: false,
                    disableSelect: false,
                    disableInputSelect: false,
                    disableCopy: false,
                    disableCut: false,
                    disablePaste: false,
                });
            } catch (error) {
                console.warn('Failed to initialize disable-devtool deterrence.', error);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return null;
}
