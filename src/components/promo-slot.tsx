'use client';

import { PromoCarousel, type PromoViewportDevice } from '@/components/promo-carousel';
import {
    buildLegacyPromoPlacement,
    getPromoSlotImageSizes,
    getPromoSlotWrapperClassName
} from '@/components/promo-legacy-adapter';
import { type PromoPlacement, type PromoSlotKey } from '@/lib/promo';
import * as React from 'react';

type PromoSlotProps = {
    slotKey: PromoSlotKey | string;
    surface?: string;
    promoProfileId?: string | null;
    className?: string;
};

type PromoPlacementsResponse = {
    placements?: PromoPlacement[];
};

function usePromoViewportDevice(): PromoViewportDevice {
    const [device, setDevice] = React.useState<PromoViewportDevice>(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
        return window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop';
    });

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

        const media = window.matchMedia('(max-width: 767px)');
        const handleChange = () => setDevice(media.matches ? 'mobile' : 'desktop');

        handleChange();
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', handleChange);
            return () => media.removeEventListener('change', handleChange);
        }

        media.addListener(handleChange);
        return () => media.removeListener(handleChange);
    }, []);

    return device;
}

function useIntersectionObserver(node: HTMLElement | null, rootMargin = '200px'): boolean {
    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
        if (!node) return undefined;
        if (typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return undefined;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setIsVisible(true);
                        return;
                    }
                }
            },
            {
                rootMargin,
                threshold: 0.01
            }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [node, rootMargin]);

    return isVisible;
}

async function fetchPromoPlacement(
    slotKey: string,
    surface: string,
    device: PromoViewportDevice,
    promoProfileId: string | null | undefined,
    signal: AbortSignal
): Promise<PromoPlacement | null> {
    const params = new URLSearchParams();
    params.set('slots', slotKey);
    params.set('surface', surface);
    params.set('device', device);
    if (promoProfileId?.trim()) {
        params.set('promoProfileId', promoProfileId.trim());
    }

    const response = await fetch(`/api/promo/placements?${params.toString()}`, {
        signal,
        headers: {
            accept: 'application/json'
        },
        cache: 'no-store'
    });

    if (!response.ok) return null;

    const payload = (await response.json().catch(() => null)) as PromoPlacementsResponse | null;
    const placements = payload?.placements || [];
    return placements.find((placement) => placement.slotKey === slotKey) || null;
}

export function PromoSlot({ slotKey, surface = 'home', promoProfileId, className }: PromoSlotProps) {
    const device = usePromoViewportDevice();
    const fallbackPlacement = React.useMemo(() => buildLegacyPromoPlacement(slotKey), [slotKey]);
    const [placement, setPlacement] = React.useState<PromoPlacement | null>(() => fallbackPlacement);
    const [loadState, setLoadState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>(
        fallbackPlacement ? 'ready' : 'idle'
    );
    const [slotElement, setSlotElement] = React.useState<HTMLDivElement | null>(null);
    const isVisible = useIntersectionObserver(slotElement);
    const loadedQueryKeyRef = React.useRef('');
    const queryKey = `${slotKey}|${surface}|${device}|${promoProfileId?.trim() || ''}`;
    const wrapperClassName = React.useMemo(() => getPromoSlotWrapperClassName(slotKey, className), [className, slotKey]);
    const sizes = React.useMemo(() => getPromoSlotImageSizes(slotKey), [slotKey]);

    React.useEffect(() => {
        loadedQueryKeyRef.current = '';
        setPlacement(fallbackPlacement);
        setLoadState(fallbackPlacement ? 'ready' : 'idle');
    }, [fallbackPlacement, queryKey]);

    React.useEffect(() => {
        if (!isVisible) return undefined;
        if (loadedQueryKeyRef.current === queryKey) return undefined;

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 2000);
        let cancelled = false;

        const run = async () => {
            setLoadState((current) => (current === 'ready' && placement ? current : 'loading'));

            try {
                const nextPlacement = await fetchPromoPlacement(slotKey, surface, device, promoProfileId, controller.signal);
                if (cancelled) return;

                loadedQueryKeyRef.current = queryKey;
                setPlacement(nextPlacement || fallbackPlacement);
                setLoadState('ready');
            } catch {
                if (cancelled) return;

                loadedQueryKeyRef.current = queryKey;
                setPlacement((current) => current || fallbackPlacement);
                setLoadState('error');
            } finally {
                window.clearTimeout(timeout);
            }
        };

        void run();

        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [device, fallbackPlacement, isVisible, placement, promoProfileId, queryKey, slotKey, surface]);

    if (!placement) {
        return <div ref={setSlotElement} className='h-px w-full' data-promo-load-state={loadState} aria-hidden='true' />;
    }

    return (
        <div ref={setSlotElement} className={wrapperClassName}>
            <PromoCarousel placement={placement} device={device} sizes={sizes} className='h-full w-full' />
        </div>
    );
}
