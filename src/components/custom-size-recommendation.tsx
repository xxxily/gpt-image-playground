'use client';

import { Button } from '@/components/ui/button';
import { recommendGptImage2Size } from '@/lib/size-utils';
import { cn } from '@/lib/utils';
import * as React from 'react';

type CustomSizeRecommendationProps = {
    width: number;
    height: number;
    onApply: (width: number, height: number) => void;
    variant?: 'theme' | 'dark';
};

export function CustomSizeRecommendation({ width, height, onApply, variant = 'theme' }: CustomSizeRecommendationProps) {
    const recommendation = React.useMemo(() => recommendGptImage2Size(width, height), [width, height]);

    if (!recommendation || (recommendation.width === width && recommendation.height === height)) {
        return null;
    }

    return (
        <div
            className={cn(
                'flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center sm:justify-between',
                variant === 'dark'
                    ? 'border-panel-divider bg-panel-ghost text-on-panel-muted'
                    : 'border-border bg-background/60 text-muted-foreground'
            )}>
            <p className='min-w-0 text-xs leading-5'>
                <span>推荐可提交尺寸：</span>
                <span className='font-mono tabular-nums' data-i18n-skip='true'>
                    {recommendation.width} × {recommendation.height}
                </span>
                <span>
                    {recommendation.wasAspectRatioClamped
                        ? ' · 已按 3:1 上限贴近当前比例。'
                        : ' · 按当前输入比例贴近限制。'}
                </span>
            </p>
            <Button
                type='button'
                variant='outline'
                size='sm'
                className={cn(
                    'h-7 shrink-0 px-2 text-xs',
                    variant === 'dark'
                        ? 'border-panel-divider bg-panel-ghost text-on-panel-muted hover:bg-accent hover:text-foreground'
                        : undefined
                )}
                onClick={() => onApply(recommendation.width, recommendation.height)}>
                套用推荐
            </Button>
        </div>
    );
}
