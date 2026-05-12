'use client';

import { PromoLegacyAdapter } from '@/components/promo-legacy-adapter';
import { PromoSlot } from '@/components/promo-slot';
import { type GenerationHeaderAdConfig } from '@/lib/ad-config';

type GenerationHeaderAdProps = {
    className?: string;
    config?: GenerationHeaderAdConfig | null;
    promoProfileId?: string | null;
};

export function GenerationHeaderAd({ className, config, promoProfileId }: GenerationHeaderAdProps) {
    if (config === null) return null;
    if (config !== undefined) {
        return (
            <PromoLegacyAdapter
                slotKey='generation_form_header'
                className={className}
                config={config}
                sizes='(min-width: 1280px) 248px, (min-width: 768px) 240px, (min-width: 640px) 224px, calc(100vw - 48px)'
            />
        );
    }

    return <PromoSlot slotKey='generation_form_header' surface='home' promoProfileId={promoProfileId} className={className} />;
}
