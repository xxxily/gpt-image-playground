'use client';

import { getGenerationHeaderAdConfig, type GenerationHeaderAdConfig } from '@/lib/ad-config';
import {
    PROMO_DEFAULT_INTERVAL_MS,
    PROMO_DEFAULT_TRANSITION,
    PROMO_SLOT_DEFINITIONS,
    type PromoPlacement
} from '@/lib/promo';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { PromoCarousel, type PromoViewportDevice } from './promo-carousel';

function resolveLegacySlotMeta(slotKey: string): (typeof PROMO_SLOT_DEFINITIONS)[number] | null {
    return PROMO_SLOT_DEFINITIONS.find((slot) => slot.key === slotKey) || null;
}

export function buildLegacyPromoPlacement(
    slotKey: string,
    legacyConfig: GenerationHeaderAdConfig | null | undefined = getGenerationHeaderAdConfig()
): PromoPlacement | null {
    const legacy = legacyConfig ?? null;
    if (!legacy || slotKey !== 'generation_form_header') return null;

    const slot = resolveLegacySlotMeta(slotKey);
    if (!slot) return null;

    const alt = legacy.alt.trim() || '赞助广告';

    return {
        slotKey,
        slotName: slot.name,
        description: slot.description,
        enabled: true,
        intervalMs: slot.defaultIntervalMs || PROMO_DEFAULT_INTERVAL_MS,
        transition: slot.defaultTransition || PROMO_DEFAULT_TRANSITION,
        source: 'legacy',
        items: [
            {
                title: alt,
                alt,
                desktopImageUrl: legacy.imageUrl,
                mobileImageUrl: legacy.imageUrl,
                linkUrl: legacy.linkUrl,
                device: 'all',
                sortOrder: 0,
                weight: 100
            }
        ]
    };
}

type PromoLegacyAdapterProps = {
    slotKey: string;
    className?: string;
    sizes?: string;
    device?: PromoViewportDevice;
    config?: GenerationHeaderAdConfig | null;
};

export function PromoLegacyAdapter({
    slotKey,
    className,
    sizes,
    device = 'desktop',
    config
}: PromoLegacyAdapterProps) {
    const placement = React.useMemo(() => buildLegacyPromoPlacement(slotKey, config), [config, slotKey]);
    if (!placement) return null;

    return <PromoCarousel placement={placement} device={device} className={className} sizes={sizes} />;
}

export function getPromoSlotWrapperClassName(slotKey: string, className?: string): string {
    const baseClassName =
        slotKey === 'generation_form_header'
            ? 'w-full aspect-[4/1] sm:w-[224px] md:w-[240px] lg:w-[224px] xl:w-[248px]'
            : 'w-full h-24 sm:h-28 lg:h-32';
    return cn(baseClassName, className);
}

export function getPromoSlotImageSizes(slotKey: string): string {
    if (slotKey === 'generation_form_header') {
        return '(min-width: 1280px) 248px, (min-width: 768px) 240px, (min-width: 640px) 224px, calc(100vw - 48px)';
    }

    return '100vw';
}
