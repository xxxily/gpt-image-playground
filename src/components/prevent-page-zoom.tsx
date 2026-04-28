'use client';

import * as React from 'react';

export function PreventPageZoom() {
    React.useEffect(() => {
        const preventTouch = (e: Event) => { e.preventDefault(); };
        const preventWheelWithCtrl = (e: WheelEvent) => {
            if (e.ctrlKey) { e.preventDefault(); }
        };

        document.addEventListener('touchstart', preventTouch, { passive: false });
        document.addEventListener('touchmove', preventTouch, { passive: false });
        document.addEventListener('gesturestart', preventTouch, { passive: false });
        document.addEventListener('gesturechange', preventTouch, { passive: false });
        document.addEventListener('gestureend', preventTouch, { passive: false });
        window.addEventListener('wheel', preventWheelWithCtrl, { passive: false });

        return () => {
            document.removeEventListener('touchstart', preventTouch);
            document.removeEventListener('touchmove', preventTouch);
            document.removeEventListener('gesturestart', preventTouch);
            document.removeEventListener('gesturechange', preventTouch);
            document.removeEventListener('gestureend', preventTouch);
            window.removeEventListener('wheel', preventWheelWithCtrl);
        };
    }, []);

    return null;
}
