'use client';

import * as React from 'react';

export function PreventPageZoom() {
    React.useEffect(() => {
        // Prevent Safari gesture-based zoom (pinch on trackpad)
        const preventGesture = (e: Event) => { e.preventDefault(); };
        document.addEventListener('gesturestart', preventGesture, { passive: false });
        document.addEventListener('gesturechange', preventGesture, { passive: false });
        document.addEventListener('gestureend', preventGesture, { passive: false });

        // Prevent Ctrl+scroll zoom on desktop
        const preventWheelWithCtrl = (e: WheelEvent) => {
            if (e.ctrlKey) { e.preventDefault(); }
        };
        window.addEventListener('wheel', preventWheelWithCtrl, { passive: false });

        return () => {
            document.removeEventListener('gesturestart', preventGesture);
            document.removeEventListener('gesturechange', preventGesture);
            document.removeEventListener('gestureend', preventGesture);
            window.removeEventListener('wheel', preventWheelWithCtrl);
        };
    }, []);

    return null;
}
