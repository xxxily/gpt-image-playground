'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useNotice } from '@/components/notice-provider';
import { copyTextToClipboard, isTauriDesktop, openExternalUrl } from '@/lib/desktop-runtime';
import { getPromoSlotCreativeGuidance } from '@/lib/promo';
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

function getSlotAspectRatio(slotKey: string, device: PromoViewportDevice): string {
    const guidance = getPromoSlotCreativeGuidance(slotKey);
    if (!guidance) return '4 / 1';
    return guidance[device].recommendedRatio.replace(':', ' / ');
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
    const aspectRatio = getSlotAspectRatio(placement.slotKey, device);
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
                                ? '如果没有唤起默认浏览器，已复制链接，请手动打开访问。'
                                : '如果没有唤起默认浏览器，也未能复制链接，请手动打开访问。',
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
                            ? '无法唤起默认浏览器，已复制链接，请手动打开访问。'
                            : '无法唤起默认浏览器，也未能复制链接，请手动打开访问。',
                        copied ? 'warning' : 'error'
                    );
                    return;
                }

                addNotice(
                    copied ? '无法打开外部浏览器，已复制链接。' : '无法打开外部浏览器，也未能复制链接。',
                    copied ? 'warning' : 'error'
                );
            }
        },
        [addNotice]
    );

    const renderPromoItem = (item: PromoPlacementItem, index: number) => {
        const active = index === activeIndex;
        const imageUrl = getItemImageUrl(item, device);
        const imageClassName = 'h-full w-full object-contain';

        return (
            <a
                key={`${item.title}-${index}-${item.linkUrl}`}
                href={item.linkUrl}
                target='_blank'
                rel='noopener noreferrer nofollow'
                aria-label={item.alt || item.title}
                onClick={(event) => void handleClick(event, item.linkUrl)}
                className={cn(
                    'group/banner relative block h-full w-full overflow-hidden',
                    shouldFade && 'transition-opacity duration-500 ease-out',
                    shouldSlide && 'shrink-0 basis-full'
                )}>
                <Image
                    src={imageUrl}
                    alt={item.alt || item.title}
                    fill
                    unoptimized
                    loading={imageLoading}
                    decoding='async'
                    sizes={sizes}
                    className={imageClassName}
                />
                {isGenerationHeader && item.title && (
                    <span className='sr-only' data-i18n-skip='true'>
                        {item.title}
                    </span>
                )}
                {!active && shouldFade && (
                    <span className='pointer-events-none absolute inset-0 bg-black/0 opacity-0' aria-hidden='true' />
                )}
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
                    'border-panel-divider bg-panel-ghost hover:border-panel-divider relative min-w-0 overflow-hidden border shadow-sm transition-colors',
                    roundedClassName,
                    showCarouselControl ? 'flex-1' : 'h-full w-full'
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
                            return (
                                <a
                                    key={`${item.title}-${index}-${item.linkUrl}`}
                                    href={item.linkUrl}
                                    target='_blank'
                                    rel='noopener noreferrer nofollow'
                                    aria-label={item.alt || item.title}
                                    onClick={(event) => void handleClick(event, item.linkUrl)}
                                    className={cn(
                                        'group/banner absolute inset-0 block h-full w-full overflow-hidden',
                                        shouldFade && 'transition-opacity duration-500 ease-out',
                                        active ? 'opacity-100' : 'pointer-events-none opacity-0'
                                    )}>
                                    <Image
                                        src={getItemImageUrl(item, device)}
                                        alt={item.alt || item.title}
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
