import * as React from 'react';

interface UseScrollVisibilityOptions {
    edgeOffset?: number;
    initialVisible?: boolean;
}

export function useScrollVisibility({ edgeOffset = 32, initialVisible = true }: UseScrollVisibilityOptions = {}) {
    const [isVisible, setIsVisible] = React.useState(initialVisible);

    React.useEffect(() => {
        let frameId: number | null = null;

        const updateVisibility = () => {
            frameId = null;

            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const viewportHeight = window.innerHeight;
            const scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            const maxScrollTop = Math.max(0, scrollHeight - viewportHeight);
            const isScrollable = maxScrollTop > edgeOffset;
            const isAtTop = scrollTop <= edgeOffset;
            const isAtBottom = maxScrollTop - scrollTop <= edgeOffset;

            setIsVisible(!isScrollable || isAtTop || isAtBottom);
        };

        const requestUpdate = () => {
            if (frameId !== null) return;
            frameId = window.requestAnimationFrame(updateVisibility);
        };

        updateVisibility();
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);

        return () => {
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
            if (frameId !== null) window.cancelAnimationFrame(frameId);
        };
    }, [edgeOffset]);

    return isVisible;
}
