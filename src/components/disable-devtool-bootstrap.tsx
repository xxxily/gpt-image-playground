'use client';

import * as React from 'react';
import { isTauriDesktop } from '@/lib/desktop-runtime';
import { getDisableDevtoolScope, shouldEnableDisableDevtoolForUrl } from '@/lib/disable-devtool';

export function DisableDevtoolBootstrap() {
    React.useEffect(() => {
        const scope = getDisableDevtoolScope();

        // This feature is a deterrence layer for the web app only.
        // Desktop builds are intentionally left untouched.
        if (scope === 'none' || isTauriDesktop()) return;

        const currentUrl = window.location.href;
        if (!shouldEnableDisableDevtoolForUrl(currentUrl, scope)) return;

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
