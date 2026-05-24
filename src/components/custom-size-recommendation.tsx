'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { getGptImage2SizeRepairRecommendations } from '@/lib/size-utils';
import { cn } from '@/lib/utils';
import * as React from 'react';

type CustomSizeRecommendationProps = {
    width: number;
    height: number;
    onApply: (width: number, height: number) => void;
    variant?: 'theme' | 'dark';
};

export function CustomSizeRecommendation({ width, height, onApply, variant = 'theme' }: CustomSizeRecommendationProps) {
    const { t, formatNumber } = useAppLanguage();
    const recommendations = React.useMemo(() => getGptImage2SizeRepairRecommendations(width, height), [width, height]);
    const requestedPixels = width * height;
    const primaryRecommendation = recommendations[0];

    if (!primaryRecommendation) {
        return null;
    }

    const statusText =
        primaryRecommendation.wasAspectRatioClamped &&
        primaryRecommendation.wasPixelCountClamped &&
        requestedPixels < primaryRecommendation.pixels
            ? t('customSize.recommendation.aspectClampedAndPixelRaised')
            : primaryRecommendation.wasAspectRatioClamped && primaryRecommendation.wasPixelCountClamped
              ? t('customSize.recommendation.aspectClampedAndPixelLowered')
              : primaryRecommendation.wasAspectRatioClamped
                ? t('customSize.recommendation.aspectClamped')
                : primaryRecommendation.wasPixelCountClamped && requestedPixels < primaryRecommendation.pixels
                  ? t('customSize.recommendation.pixelRaised')
                  : primaryRecommendation.wasPixelCountClamped
                    ? t('customSize.recommendation.pixelLowered')
                    : t('customSize.recommendation.exactRatio');

    return (
        <div
            className={cn(
                'flex flex-col gap-2 rounded-lg border p-2',
                variant === 'dark'
                    ? 'border-panel-divider bg-panel-ghost text-on-panel-muted'
                    : 'border-border bg-background/60 text-muted-foreground'
            )}>
            <p className='min-w-0 text-xs leading-5'>
                <span>{t('customSize.recommendation.title')}</span>
                <span>{statusText}</span>
            </p>
            <div className='flex flex-wrap gap-2'>
                {recommendations.map((recommendation, index) => {
                    const megapixels = recommendation.pixels / 1_000_000;
                    return (
                        <Button
                            key={`${recommendation.width}x${recommendation.height}`}
                            type='button'
                            variant={index === 0 ? 'default' : 'outline'}
                            size='sm'
                            className={cn(
                                'h-auto min-h-8 shrink-0 flex-col items-start gap-0 px-2 py-1 text-left text-xs leading-4',
                                variant === 'dark' && index !== 0
                                    ? 'border-panel-divider bg-panel-ghost text-on-panel-muted hover:bg-accent hover:text-foreground'
                                    : undefined
                            )}
                            onClick={() => onApply(recommendation.width, recommendation.height)}>
                            <span className='font-mono tabular-nums' data-i18n-skip='true'>
                                {recommendation.width} × {recommendation.height}
                            </span>
                            <span className='text-[10px] opacity-80'>
                                {formatNumber(megapixels, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MP ·{' '}
                                {t(`customSize.recommendation.${recommendation.comparison}`)}
                            </span>
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}
