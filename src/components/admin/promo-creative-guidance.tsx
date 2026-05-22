'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import {
    PROMO_SLOT_CREATIVE_GUIDANCE,
    getPromoSlotCreativeGuidance,
    type PromoSlotCreativeGuidance
} from '@/lib/promo';
import { cn } from '@/lib/utils';

type PromoCreativeGuidanceProps = {
    slotKey?: string | null;
    className?: string;
    compact?: boolean;
};

const ALL_GUIDANCE = Object.values(PROMO_SLOT_CREATIVE_GUIDANCE);

function GuidanceRows({ guidance }: { guidance: PromoSlotCreativeGuidance }) {
    const { t } = useAppLanguage();

    return (
        <div className='grid gap-2 sm:grid-cols-2'>
            {(
                [
                    [t('promo.guidance.desktop'), guidance.desktop],
                    [t('promo.guidance.mobile'), guidance.mobile]
                ] as const
            ).map(([label, target]) => (
                <div
                    key={`${guidance.slotKey}-${label}`}
                    className='border-panel-divider bg-background/60 rounded-md border p-2'>
                    <div className='text-foreground text-xs font-semibold'>{label}</div>
                    <dl className='text-muted-foreground mt-1 grid gap-1 text-xs'>
                        <div className='flex items-center justify-between gap-2'>
                            <dt>{t('promo.guidance.ratio')}</dt>
                            <dd className='text-foreground font-mono' data-i18n-skip='true'>
                                {target.recommendedRatio}
                            </dd>
                        </div>
                        <div className='flex items-center justify-between gap-2'>
                            <dt>{t('promo.guidance.recommendedPixels')}</dt>
                            <dd className='text-foreground font-mono' data-i18n-skip='true'>
                                {target.recommendedPixels}
                            </dd>
                        </div>
                        <div className='flex items-center justify-between gap-2'>
                            <dt>{t('promo.guidance.minimumPixels')}</dt>
                            <dd className='text-foreground font-mono' data-i18n-skip='true'>
                                {target.minimumPixels}
                            </dd>
                        </div>
                    </dl>
                    <p className='text-muted-foreground mt-1 text-[11px] leading-4'>
                        {t('promo.guidance.displayAndSafeArea', {
                            displaySize: target.displaySize,
                            safeArea: t(`promo.guidance.safeArea.${target.safeArea}`)
                        })}
                    </p>
                </div>
            ))}
        </div>
    );
}

export function PromoCreativeGuidance({ slotKey, className, compact = false }: PromoCreativeGuidanceProps) {
    const { t } = useAppLanguage();
    const selectedGuidance = slotKey ? getPromoSlotCreativeGuidance(slotKey) : null;
    const guidanceList = selectedGuidance ? [selectedGuidance] : ALL_GUIDANCE;

    return (
        <section className={cn('border-panel-divider bg-panel-ghost rounded-lg border p-3', className)}>
            <div className='space-y-1'>
                <h3 className='text-foreground text-sm font-semibold'>{t('promo.guidance.title')}</h3>
                <p className='text-muted-foreground text-xs leading-5'>{t('promo.guidance.description')}</p>
            </div>
            <div className={cn('mt-3 grid gap-3', compact ? 'grid-cols-1' : 'xl:grid-cols-3')}>
                {guidanceList.map((guidance) => (
                    <div key={guidance.slotKey} className='space-y-2'>
                        {!selectedGuidance && (
                            <div>
                                <div className='text-foreground font-mono text-xs' data-i18n-skip='true'>
                                    {guidance.slotKey}
                                </div>
                            </div>
                        )}
                        <GuidanceRows guidance={guidance} />
                    </div>
                ))}
            </div>
            <p className='text-muted-foreground mt-3 text-xs leading-5'>{t('promo.guidance.footer')}</p>
        </section>
    );
}
