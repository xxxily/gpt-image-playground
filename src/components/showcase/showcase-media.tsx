'use client';

import { getLocalizedShowcaseText } from './showcase-navigation';
import { useAppLanguage } from '@/components/app-language-provider';
import type { ShowcaseAsset, ShowcaseCase, ShowcaseCatalog } from '@/lib/showcase';
import { getShowcaseAsset } from '@/lib/showcase-client';
import { cn } from '@/lib/utils';
import { ArrowRight, ImageIcon, Images } from 'lucide-react';

type ShowcaseMediaProps = {
    asset: ShowcaseAsset | null;
    className?: string;
    eager?: boolean;
};

export function ShowcaseMedia({ asset, className, eager = false }: ShowcaseMediaProps) {
    const { language, t } = useAppLanguage();

    if (!asset) {
        return (
            <div
                className={cn(
                    'bg-panel-subtle text-on-panel-faint flex min-h-0 items-center justify-center',
                    className
                )}
                role='img'
                aria-label={t('showcase.media.unavailable')}>
                <ImageIcon className='size-6' aria-hidden='true' />
            </div>
        );
    }

    const alt = getLocalizedShowcaseText(asset.alt, language);
    if (asset.kind === 'remote-image') {
        return (
            // The catalog validator only accepts credential-free public HTTPS image URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={asset.url}
                alt={alt}
                width={asset.width}
                height={asset.height}
                loading={eager ? 'eager' : 'lazy'}
                decoding='async'
                className={cn('h-full w-full object-cover', className)}
            />
        );
    }

    return (
        <div
            className={cn(
                'relative flex min-h-0 items-center justify-center overflow-hidden p-3 text-center',
                className
            )}
            style={{
                backgroundColor: asset.placeholder.backgroundColor,
                color: asset.placeholder.foregroundColor
            }}
            role='img'
            aria-label={alt}>
            <div
                className='absolute inset-0 opacity-[0.14]'
                aria-hidden='true'
                style={{
                    backgroundImage:
                        'linear-gradient(135deg, currentColor 1px, transparent 1px), linear-gradient(45deg, currentColor 1px, transparent 1px)',
                    backgroundSize: '22px 22px'
                }}
            />
            <div className='relative flex max-w-[14rem] flex-col items-center gap-2'>
                <Images className='size-6 opacity-65' aria-hidden='true' />
                <span className='text-xs leading-snug font-semibold sm:text-sm'>
                    {getLocalizedShowcaseText(asset.placeholder.label, language)}
                </span>
                <span className='bg-background/20 rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-medium tracking-wide'>
                    {t('showcase.media.placeholder')}
                </span>
            </div>
        </div>
    );
}

type ShowcaseComparisonProps = {
    catalog: ShowcaseCatalog;
    showcaseCase: ShowcaseCase;
    className?: string;
    compact?: boolean;
    eager?: boolean;
};

export function ShowcaseComparison({
    catalog,
    showcaseCase,
    className,
    compact = false,
    eager = false
}: ShowcaseComparisonProps) {
    const { t } = useAppLanguage();
    const inputs = showcaseCase.inputAssetIds
        .map((assetId) => getShowcaseAsset(catalog, assetId))
        .filter((asset): asset is ShowcaseAsset => asset !== null);
    const output =
        showcaseCase.outputAssetIds
            .map((assetId) => getShowcaseAsset(catalog, assetId))
            .find((asset): asset is ShowcaseAsset => asset !== null) ?? null;
    const mediaHeight = compact ? 'min-h-28 sm:min-h-32' : 'min-h-44 sm:min-h-64';

    return (
        <div
            className={cn(
                'border-panel-divider bg-panel-ghost grid min-w-0 grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] overflow-hidden rounded-xl border',
                className
            )}>
            <figure className='flex min-w-0 flex-col'>
                <figcaption className='border-panel-divider text-on-panel-muted border-b px-2.5 py-1.5 text-[11px] font-medium'>
                    {inputs.length > 1
                        ? t('showcase.comparison.inputs', { count: inputs.length })
                        : t('showcase.comparison.input')}
                </figcaption>
                <div className={cn('grid flex-1', inputs.length > 1 ? 'grid-cols-2' : 'grid-cols-1', mediaHeight)}>
                    {inputs.length > 0 ? (
                        inputs.map((asset, index) => (
                            <ShowcaseMedia
                                key={asset.id}
                                asset={asset}
                                eager={eager && index === 0}
                                className={cn(
                                    'min-h-0',
                                    inputs.length > 1 && index % 2 === 1 ? 'border-panel-divider border-l' : '',
                                    inputs.length > 2 && index >= 2 ? 'border-panel-divider border-t' : ''
                                )}
                            />
                        ))
                    ) : (
                        <ShowcaseMedia asset={null} />
                    )}
                </div>
            </figure>

            <div
                className='border-panel-divider bg-panel-subtle flex items-center justify-center border-x'
                aria-hidden='true'>
                <ArrowRight className='text-on-panel-faint size-3.5' />
            </div>

            <figure className='flex min-w-0 flex-col'>
                <figcaption className='border-panel-divider text-on-panel-muted border-b px-2.5 py-1.5 text-[11px] font-medium'>
                    {t('showcase.comparison.output')}
                </figcaption>
                <ShowcaseMedia asset={output} eager={eager} className={cn('flex-1', mediaHeight)} />
            </figure>
        </div>
    );
}
