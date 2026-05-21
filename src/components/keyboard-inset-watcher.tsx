'use client';

import * as React from 'react';

const KEYBOARD_INSET_VAR = '--app-keyboard-inset-bottom';
const VISUAL_VIEWPORT_INSET_VAR = '--app-viewport-inset-bottom';

export function KeyboardInsetWatcher() {
    React.useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const vp = window.visualViewport;
        if (!vp) {
            document.documentElement.style.setProperty(KEYBOARD_INSET_VAR, '0px');
            document.documentElement.style.setProperty(VISUAL_VIEWPORT_INSET_VAR, '0px');
            return undefined;
        }

        const handleResize = () => {
            const layoutHeight = window.innerHeight;
            const visualHeight = vp.height;
            const offsetTop = vp.offsetTop ?? 0;
            const bottomGap = Math.max(0, layoutHeight - (visualHeight + offsetTop));
            const inset = Math.round(bottomGap);
            document.documentElement.style.setProperty(VISUAL_VIEWPORT_INSET_VAR, `${inset}px`);
            const keyboardInset = inset > 80 ? inset : 0;
            document.documentElement.style.setProperty(KEYBOARD_INSET_VAR, `${keyboardInset}px`);
        };

        handleResize();
        vp.addEventListener('resize', handleResize);
        vp.addEventListener('scroll', handleResize);
        return () => {
            vp.removeEventListener('resize', handleResize);
            vp.removeEventListener('scroll', handleResize);
            document.documentElement.style.removeProperty(KEYBOARD_INSET_VAR);
            document.documentElement.style.removeProperty(VISUAL_VIEWPORT_INSET_VAR);
        };
    }, []);

    return null;
}
