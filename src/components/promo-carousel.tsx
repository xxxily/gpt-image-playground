'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useNotice } from '@/components/notice-provider';
import { copyTextToClipboard, isTauriDesktop, openExternalUrl } from '@/lib/desktop-runtime';
import { getDefaultPromoAspectRatioForSlot, serializePromoAspectRatioCss } from '@/lib/promo';
import { PROMO_MIN_INTERVAL_MS, type PromoPlacement, type PromoPlacementItem } from '@/lib/promo';
import { cn } from '@/lib/utils';
import { Pause, Play } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

export type PromoViewportDevice = 'desktop' | 'mobile';

type PromoCarouselProps = {
    placement: PromoPlacement;
    device: PromoViewportDevice;
    className?: string;
    sizes?: string;
};

function isAndroidClient(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent || '');
}

function waitForDocumentHidden(timeoutMs: number): Promise<boolean> {
    if (typeof document === 'undefined' || typeof window === 'undefined') return Promise.resolve(false);
    if (document.visibilityState === 'hidden') return Promise.resolve(true);

    return new Promise((resolve) => {
        let settled = false;

        function cleanup() {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.clearTimeout(timeout);
        }

        function finish(value: boolean) {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(value);
        }

        function handleVisibilityChange() {
            if (document.visibilityState === 'hidden') finish(true);
        }

        const timeout = window.setTimeout(() => finish(false), timeoutMs);
        document.addEventListener('visibilitychange', handleVisibilityChange);
    });
}

function usePrefersReducedMotion(): boolean {
    const [reducedMotion, setReducedMotion] = React.useState(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handleChange = () => setReducedMotion(media.matches);

        handleChange();
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', handleChange);
            return () => media.removeEventListener('change', handleChange);
        }

        media.addListener(handleChange);
        return () => media.removeListener(handleChange);
    }, []);

    return reducedMotion;
}

function getItemImageUrl(item: PromoPlacementItem, device: PromoViewportDevice): string {
    return device === 'mobile'
        ? item.mobileImageUrl || item.desktopImageUrl
        : item.desktopImageUrl || item.mobileImageUrl;
}

export function PromoCarousel({ placement, device, className, sizes = '100vw' }: PromoCarouselProps) {
    const { addNotice } = useNotice();
    const { t } = useAppLanguage();
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [isHovered, setIsHovered] = React.useState(false);
    const [userPaused, setUserPaused] = React.useState(false);
    const [isDocumentVisible, setIsDocumentVisible] = React.useState(() => {
        if (typeof document === 'undefined') return true;
        return document.visibilityState !== 'hidden';
    });
    const reducedMotion = usePrefersReducedMotion();
    const itemCount = placement.items.length;
    const intervalMs = Math.max(PROMO_MIN_INTERVAL_MS, placement.intervalMs || PROMO_MIN_INTERVAL_MS);
    const shouldAnimate = itemCount > 1 && !reducedMotion;
    const shouldSlide = shouldAnimate && placement.transition === 'slide';
    const shouldFade = shouldAnimate && placement.transition === 'fade';
    const imageLoading = placement.slotKey === 'generation_form_header' ? 'eager' : 'lazy';
    const roundedClassName = placement.slotKey === 'generation_form_header' ? 'rounded-none' : 'rounded-xl';
    const aspectRatio = serializePromoAspectRatioCss(
        placement.aspectRatio || getDefaultPromoAspectRatioForSlot(placement.slotKey)
    );
    const isGenerationHeader = placement.slotKey === 'generation_form_header';
    const showCarouselControl = shouldAnimate;

    React.useEffect(() => {
        if (activeIndex >= itemCount) setActiveIndex(0);
    }, [activeIndex, itemCount]);

    React.useEffect(() => {
        if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;

        const handleVisibilityChange = () => setIsDocumentVisible(document.visibilityState !== 'hidden');
        handleVisibilityChange();
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    React.useEffect(() => {
        if (!shouldAnimate || isHovered || !isDocumentVisible || userPaused) return undefined;

        const interval = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % itemCount);
        }, intervalMs);

        return () => window.clearInterval(interval);
    }, [intervalMs, isDocumentVisible, isHovered, itemCount, shouldAnimate, userPaused]);

    const handleClick = React.useCallback(
        async (event: React.MouseEvent<HTMLAnchorElement>, linkUrl: string) => {
            if (!isTauriDesktop()) return;

            event.preventDefault();

            try {
                await openExternalUrl(linkUrl);
                if (isAndroidClient()) {
                    const movedToBrowser = await waitForDocumentHidden(900);
                    if (!movedToBrowser) {
                        const copied = await copyTextToClipboard(linkUrl);
                        addNotice(
                            copied
                                ? t('phase4b.browserFallbackCopiedNotice')
                                : t('phase4b.browserFallbackCopyFailedNotice'),
                            copied ? 'warning' : 'error'
                        );
                    }
                }
            } catch (error) {
                console.error('Failed to open placement link.', error);
                const copied = await copyTextToClipboard(linkUrl);
                if (isAndroidClient()) {
                    addNotice(
                        copied
                            ? t('phase4b.androidExternalOpenCopiedNotice')
                            : t('phase4b.androidExternalOpenCopyFailedNotice'),
                        copied ? 'warning' : 'error'
                    );
                    return;
                }

                addNotice(
                    copied ? t('phase4b.externalOpenCopiedNotice') : t('phase4b.externalOpenCopyFailedNotice'),
                    copied ? 'warning' : 'error'
                );
            }
        },
        [addNotice, t]
    );

    const renderImage = (item: PromoPlacementItem) => {
        const alt = item.alt || item.title || placement.slotName || t('phase4b.promoImageAlt');
        return (
            <>
                <Image
                    src={getItemImageUrl(item, device)}
                    alt={alt}
                    fill
                    unoptimized
                    loading={imageLoading}
                    decoding='async'
                    sizes={sizes}
                    className='h-full w-full object-contain'
                />
                {isGenerationHeader && item.title && (
                    <span className='sr-only' data-i18n-skip='true'>
                        {item.title}
                    </span>
                )}
            </>
        );
    };

    const renderPromoItem = (item: PromoPlacementItem, index: number) => {
        const active = index === activeIndex;
        const imageUrl = getItemImageUrl(item, device);
        const itemKey = `${imageUrl}-${index}-${item.linkUrl || 'static'}`;
        const itemClassName = cn(
            'group/banner relative block h-full w-full overflow-hidden',
            shouldFade && 'transition-opacity duration-500 ease-out',
            shouldSlide && 'shrink-0 basis-full'
        );

        const content = (
            <>
                {renderImage(item)}
                {!active && shouldFade && (
                    <span className='pointer-events-none absolute inset-0 bg-black/0 opacity-0' aria-hidden='true' />
                )}
            </>
        );

        if (!item.linkUrl) {
            return (
                <div key={itemKey} className={itemClassName}>
                    {content}
                </div>
            );
        }

        return (
            <a
                key={itemKey}
                href={item.linkUrl}
                target='_blank'
                rel='noopener noreferrer nofollow'
                aria-label={item.alt || item.title || placement.slotName}
                onClick={(event) => void handleClick(event, item.linkUrl)}
                className={itemClassName}>
                {content}
            </a>
        );
    };

    if (itemCount === 0) return null;

    const pauseLabel = userPaused ? t('carousel.play') : t('carousel.pause');

    return (
        <div
            className={cn(
                'relative transition-colors focus-within:ring-2 focus-within:ring-violet-400/60 focus-within:outline-none',
                showCarouselControl && 'flex items-center gap-2',
                className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}>
            <div
                className={cn(
                    'bg-panel-ghost relative min-w-0 overflow-hidden transition-colors',
                    roundedClassName,
                    showCarouselControl ? 'flex-1' : 'h-full max-w-full'
                )}
                style={{ aspectRatio }}>
                {shouldSlide ? (
                    <div className='flex h-full w-full overflow-hidden'>
                        <div
                            className={cn(
                                'flex h-full w-full',
                                shouldAnimate && 'transition-transform duration-500 ease-out'
                            )}
                            style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
                            {placement.items.map((item, index) => renderPromoItem(item, index))}
                        </div>
                    </div>
                ) : (
                    <div className='relative h-full w-full'>
                        {placement.items.map((item, index) => {
                            const active = index === activeIndex;
                            const imageUrl = getItemImageUrl(item, device);
                            const itemKey = `${imageUrl}-${index}-${item.linkUrl || 'static'}`;
                            const itemClassName = cn(
                                'group/banner absolute inset-0 block h-full w-full overflow-hidden',
                                shouldFade && 'transition-opacity duration-500 ease-out',
                                active ? 'opacity-100' : 'pointer-events-none opacity-0'
                            );

                            if (!item.linkUrl) {
                                return (
                                    <div key={itemKey} className={itemClassName}>
                                        {renderImage(item)}
                                    </div>
                                );
                            }

                            return (
                                <a
                                    key={itemKey}
                                    href={item.linkUrl}
                                    target='_blank'
                                    rel='noopener noreferrer nofollow'
                                    aria-label={item.alt || item.title || placement.slotName}
                                    onClick={(event) => void handleClick(event, item.linkUrl)}
                                    className={itemClassName}>
                                    {renderImage(item)}
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>
            {showCarouselControl && (
                <button
                    type='button'
                    onClick={() => setUserPaused((prev) => !prev)}
                    aria-label={pauseLabel}
                    aria-pressed={userPaused}
                    title={pauseLabel}
                    className='bg-accent text-on-panel-muted hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm transition-colors focus:ring-2 focus:ring-violet-400/60 focus:outline-none'>
                    {userPaused ? (
                        <Play className='h-3.5 w-3.5' aria-hidden='true' />
                    ) : (
                        <Pause className='h-3.5 w-3.5' aria-hidden='true' />
                    )}
                </button>
            )}
        </div>
    );
}
