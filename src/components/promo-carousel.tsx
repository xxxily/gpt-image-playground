'use client';

import { useNotice } from '@/components/notice-provider';
import { copyTextToClipboard, isTauriDesktop, openExternalUrl } from '@/lib/desktop-runtime';
import { PROMO_MIN_INTERVAL_MS, type PromoPlacement, type PromoPlacementItem } from '@/lib/promo';
import { cn } from '@/lib/utils';
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
    return device === 'mobile' ? item.mobileImageUrl || item.desktopImageUrl : item.desktopImageUrl || item.mobileImageUrl;
}

export function PromoCarousel({ placement, device, className, sizes = '100vw' }: PromoCarouselProps) {
    const { addNotice } = useNotice();
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [isHovered, setIsHovered] = React.useState(false);
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
        if (!shouldAnimate || isHovered || !isDocumentVisible) return undefined;

        const interval = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % itemCount);
        }, intervalMs);

        return () => window.clearInterval(interval);
    }, [intervalMs, isDocumentVisible, isHovered, itemCount, shouldAnimate]);

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
                                ? '如果没有唤起默认浏览器，已复制广告链接，请手动打开访问。'
                                : '如果没有唤起默认浏览器，也未能复制广告链接，请手动打开访问。',
                            copied ? 'warning' : 'error'
                        );
                    }
                }
            } catch (error) {
                console.error('Failed to open promo link.', error);
                const copied = await copyTextToClipboard(linkUrl);
                if (isAndroidClient()) {
                    addNotice(
                        copied
                            ? '无法唤起默认浏览器，已复制广告链接，请手动打开访问。'
                            : '无法唤起默认浏览器，也未能复制广告链接，请手动打开访问。',
                        copied ? 'warning' : 'error'
                    );
                    return;
                }

                addNotice(
                    copied ? '无法打开外部浏览器，已复制广告链接。' : '无法打开外部浏览器，也未能复制广告链接。',
                    copied ? 'warning' : 'error'
                );
            }
        },
        [addNotice]
    );

    const renderPromoItem = (item: PromoPlacementItem, index: number) => {
        const active = index === activeIndex;
        const imageUrl = getItemImageUrl(item, device);
        const imageClassName = 'h-full w-full object-cover transition-transform duration-200 group-hover/promo:scale-[1.015]';

        return (
            <a
                key={`${item.title}-${index}-${item.linkUrl}`}
                href={item.linkUrl}
                target='_blank'
                rel='noopener noreferrer sponsored nofollow'
                aria-label={item.alt || item.title}
                onClick={(event) => void handleClick(event, item.linkUrl)}
                className={cn('group/promo relative block h-full w-full overflow-hidden', shouldFade && 'transition-opacity duration-500 ease-out', shouldSlide && 'shrink-0 basis-full')}>
                <Image
                    src={imageUrl}
                    alt={item.alt || item.title}
                    fill
                    unoptimized
                    loading='lazy'
                    decoding='async'
                    sizes={sizes}
                    className={imageClassName}
                />
                <span className='absolute top-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white/85 backdrop-blur'>
                    广告
                </span>
                {!active && shouldFade && (
                    <span className='pointer-events-none absolute inset-0 bg-black/0 opacity-0' aria-hidden='true' />
                )}
            </a>
        );
    };

    if (itemCount === 0) return null;

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] shadow-sm transition-colors hover:border-white/20 focus-within:ring-2 focus-within:ring-violet-400/60 focus-within:outline-none',
                className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}>
            {shouldSlide ? (
                <div className='flex h-full w-full overflow-hidden'>
                    <div
                        className={cn('flex h-full w-full', shouldAnimate && 'transition-transform duration-500 ease-out')}
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
                                rel='noopener noreferrer sponsored nofollow'
                                aria-label={item.alt || item.title}
                                onClick={(event) => void handleClick(event, item.linkUrl)}
                                className={cn(
                                    'group/promo absolute inset-0 block h-full w-full overflow-hidden',
                                    shouldFade && 'transition-opacity duration-500 ease-out',
                                    active ? 'opacity-100' : 'pointer-events-none opacity-0'
                                )}>
                                <Image
                                    src={getItemImageUrl(item, device)}
                                    alt={item.alt || item.title}
                                    fill
                                    unoptimized
                                    loading='lazy'
                                    decoding='async'
                                    sizes={sizes}
                                    className='h-full w-full object-cover transition-transform duration-200 group-hover/promo:scale-[1.015]'
                                />
                                <span className='absolute top-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white/85 backdrop-blur'>
                                    广告
                                </span>
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
