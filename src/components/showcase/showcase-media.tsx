'use client';

import { getLocalizedShowcaseText } from './showcase-navigation';
import { useAppLanguage } from '@/components/app-language-provider';
import type { ShowcaseAsset, ShowcaseCase, ShowcaseCatalog } from '@/lib/showcase';
import { getShowcaseAsset } from '@/lib/showcase-client';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, ArrowRight, ImageIcon, Images, PanelsTopLeft } from 'lucide-react';
import * as React from 'react';

type ShowcaseMediaProps = {
    asset: ShowcaseAsset | null;
    className?: string;
    eager?: boolean;
    style?: React.CSSProperties;
};

export function ShowcaseMedia({ asset, className, eager = false, style }: ShowcaseMediaProps) {
    const { language, t } = useAppLanguage();

    if (!asset) {
        return (
            <div
                className={cn(
                    'bg-panel-subtle text-on-panel-faint flex min-h-0 items-center justify-center',
                    className
                )}
                role='img'
                style={style}
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
                srcSet={asset.thumbnailUrl && asset.width ? `${asset.thumbnailUrl} 640w, ${asset.url} ${asset.width}w` : undefined}
                sizes='(max-width: 640px) 100vw, 640px'
                alt={alt}
                width={asset.width}
                height={asset.height}
                loading={eager ? 'eager' : 'lazy'}
                decoding='async'
                style={style}
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
                color: asset.placeholder.foregroundColor,
                ...style
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
    const [mode, setMode] = React.useState<'side-by-side' | 'slider'>('side-by-side');
    const [position, setPosition] = React.useState(50);
    const inputs = showcaseCase.inputAssetIds
        .map((assetId) => getShowcaseAsset(catalog, assetId))
        .filter((asset): asset is ShowcaseAsset => asset !== null);
    const output =
        showcaseCase.outputAssetIds
            .map((assetId) => getShowcaseAsset(catalog, assetId))
            .find((asset): asset is ShowcaseAsset => asset !== null) ?? null;
    const mediaHeight = compact ? 'min-h-28 sm:min-h-32' : 'min-h-44 sm:min-h-64';

    const sideBySide = (
        <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_1.75rem_minmax(0,1fr)] overflow-hidden'>
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

    const canSlide = inputs.length === 1 && output !== null;
    const slider = (
        <div className={cn('relative isolate overflow-hidden', mediaHeight)}>
            <ShowcaseMedia asset={output} eager={eager} className='absolute inset-0 h-full w-full' />
            <div
                className='absolute inset-y-0 left-0 overflow-hidden border-r border-white/80 shadow-[3px_0_12px_rgba(0,0,0,0.18)]'
                style={{ width: `${position}%` }}>
                <div className='absolute inset-y-0 left-0 w-[100cqw] max-w-none'>
                    <ShowcaseMedia
                        asset={inputs[0] ?? null}
                        eager={eager}
                        className='absolute inset-0 h-full w-full object-cover'
                    />
                </div>
            </div>
            <span className='absolute top-2 left-2 rounded-md bg-black/65 px-2 py-1 text-[11px] font-medium text-white'>
                {t('showcase.comparison.input')}
            </span>
            <span className='absolute top-2 right-2 rounded-md bg-black/65 px-2 py-1 text-[11px] font-medium text-white'>
                {t('showcase.comparison.output')}
            </span>
            <div className='pointer-events-none absolute inset-y-0 z-10 w-px bg-white' style={{ left: `${position}%` }}>
                <span className='bg-background text-foreground border-panel-divider absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg'>
                    <ArrowLeftRight className='size-4' aria-hidden='true' />
                </span>
            </div>
            <input
                type='range'
                min={0}
                max={100}
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
                aria-label={t('showcase.comparison.sliderLabel')}
                aria-valuetext={t('showcase.comparison.sliderValue', { value: position })}
                className='absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0'
            />
        </div>
    );

    return (
        <div
            className={cn(
                'border-panel-divider bg-panel-ghost [container-type:inline-size] min-w-0 overflow-hidden rounded-xl border',
                className
            )}>
            {!compact && canSlide ? (
                <div className='border-panel-divider bg-panel-subtle flex items-center justify-end gap-1 border-b p-1'>
                    <button
                        type='button'
                        aria-pressed={mode === 'side-by-side'}
                        onClick={() => setMode('side-by-side')}
                        className={cn(
                            'focus-visible:ring-ring/50 flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs outline-none focus-visible:ring-[3px]',
                            mode === 'side-by-side'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-on-panel-muted hover:bg-panel-ghost'
                        )}>
                        <PanelsTopLeft className='size-3.5' aria-hidden='true' />
                        {t('showcase.comparison.sideBySide')}
                    </button>
                    <button
                        type='button'
                        aria-pressed={mode === 'slider'}
                        onClick={() => setMode('slider')}
                        className={cn(
                            'focus-visible:ring-ring/50 flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs outline-none focus-visible:ring-[3px]',
                            mode === 'slider'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-on-panel-muted hover:bg-panel-ghost'
                        )}>
                        <ArrowLeftRight className='size-3.5' aria-hidden='true' />
                        {t('showcase.comparison.slider')}
                    </button>
                </div>
            ) : null}
            {mode === 'slider' && canSlide ? slider : sideBySide}
        </div>
    );
}
