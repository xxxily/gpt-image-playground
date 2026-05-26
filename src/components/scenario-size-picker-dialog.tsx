'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    SCENARIO_SIZE_CATEGORIES,
    formatScenarioSize,
    getLocalizedScenarioText,
    getScenarioSizeAdapter,
    getScenarioSizeOptions,
    type ScenarioModelSizeOption,
    type ScenarioSizeCategory,
    type ScenarioSizeSourceConfidence,
    type ScenarioSizeMatchQuality,
    type ScenarioSizeTier
} from '@/lib/scenario-image-sizes';
import type { ImageModelId, StoredCustomImageModel } from '@/lib/model-registry';
import { cn } from '@/lib/utils';
import {
    BadgeCheck,
    Check,
    ChevronRight,
    Filter,
    ImageIcon,
    Info,
    Layers3,
    MonitorSmartphone,
    Search,
    SlidersHorizontal,
    Sparkles,
    Target,
    X
} from 'lucide-react';
import * as React from 'react';

type ScenarioSizePickerDialogProps = {
    model: ImageModelId;
    customImageModels?: readonly StoredCustomImageModel[];
    currentSize: string;
    onApply: (option: ScenarioModelSizeOption) => void;
    triggerClassName?: string;
    triggerLabel?: string;
};

const COMMON_RATIOS = ['1:1', '4:5', '3:4', '9:16', '16:9', '1.91:1', '2:3', '3:2'] as const;
const CONFIDENCE_FILTERS: readonly ScenarioSizeSourceConfidence[] = [
    'official',
    'officialAds',
    'platformPractice',
    'industryStandard',
    'practical'
];
const DIRECTION_FILTERS = ['square', 'landscape', 'portrait', 'wide', 'tall'] as const;

type ScenarioSizeDirection = (typeof DIRECTION_FILTERS)[number];

function localize(value: { 'zh-CN': string; 'en-US': string } | undefined, language: 'zh-CN' | 'en-US'): string {
    return getLocalizedScenarioText(value, language);
}

function compactPercent(value: number): string {
    if (!Number.isFinite(value)) return '';
    return `${Math.round(value * 100)}%`;
}

function sourceSizeLabel(option: ScenarioModelSizeOption): string {
    if (!option.source.sourceWidth || !option.source.sourceHeight) return option.source.ratioLabel;
    return formatScenarioSize(option.source.sourceWidth, option.source.sourceHeight);
}

function optionSearchText(option: ScenarioModelSizeOption, language: 'zh-CN' | 'en-US'): string {
    return [
        localize(option.source.title, language),
        option.source.id,
        option.source.category,
        option.source.ratioLabel,
        option.ratioLabel,
        option.modelSize,
        option.tier,
        option.matchQuality,
        ...option.source.platforms,
        ...option.source.useCases,
        ...option.source.tags
    ]
        .join(' ')
        .toLowerCase();
}

function optionKey(option: ScenarioModelSizeOption): string {
    return `${option.source.id}:${option.modelSize || 'unavailable'}`;
}

function candidateTone(matchQuality: ScenarioSizeMatchQuality): string {
    if (matchQuality === 'exact') return 'text-emerald-700 dark:text-emerald-300';
    if (matchQuality === 'near') return 'text-sky-700 dark:text-sky-300';
    if (matchQuality === 'fallback') return 'text-amber-700 dark:text-amber-300';
    return 'text-muted-foreground';
}

function scenarioDirection(option: ScenarioModelSizeOption): ScenarioSizeDirection {
    const ratio = option.source.ratio;
    if (ratio >= 0.92 && ratio <= 1.08) return 'square';
    if (ratio >= 2) return 'wide';
    if (ratio <= 0.5) return 'tall';
    if (ratio > 1) return 'landscape';
    return 'portrait';
}

export function ScenarioSizePickerDialog({
    model,
    customImageModels = [],
    currentSize,
    onApply,
    triggerClassName,
    triggerLabel
}: ScenarioSizePickerDialogProps) {
    const { t, language } = useAppLanguage();
    const [open, setOpen] = React.useState(false);
    const adapter = React.useMemo(() => getScenarioSizeAdapter(model, customImageModels), [customImageModels, model]);
    const [tier, setTier] = React.useState<ScenarioSizeTier | string>('2K');
    const [query, setQuery] = React.useState('');
    const [category, setCategory] = React.useState<ScenarioSizeCategory | 'all'>('all');
    const [platform, setPlatform] = React.useState<string>('all');
    const [direction, setDirection] = React.useState<ScenarioSizeDirection | 'all'>('all');
    const [ratio, setRatio] = React.useState<string>('all');
    const [confidence, setConfidence] = React.useState<ScenarioSizeSourceConfidence | 'all'>('all');
    const [showUnavailable, setShowUnavailable] = React.useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (!adapter) return;
        setTier((current) => (adapter.tiers.includes(current as ScenarioSizeTier) ? current : adapter.defaultTier));
    }, [adapter]);

    const options = React.useMemo(
        () =>
            getScenarioSizeOptions(model, customImageModels, {
                preferredTier: tier as ScenarioSizeTier,
                includeUnavailable: showUnavailable
            }),
        [customImageModels, model, showUnavailable, tier]
    );

    React.useEffect(() => {
        if (!open || !adapter) return;
        const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
        return () => window.cancelAnimationFrame(frame);
    }, [adapter, open]);

    const platforms = React.useMemo(() => {
        const counts = new Map<string, number>();
        for (const option of options) {
            for (const item of option.source.platforms) {
                counts.set(item, (counts.get(item) ?? 0) + option.source.popularity);
            }
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], language))
            .map(([item]) => item)
            .slice(0, 48);
    }, [language, options]);

    React.useEffect(() => {
        if (platform === 'all' || platforms.includes(platform)) return;
        setPlatform('all');
    }, [platform, platforms]);

    const ratios = React.useMemo(() => {
        const seen = new Set<string>();
        const values: string[] = [];
        for (const commonRatio of COMMON_RATIOS) {
            if (options.some((option) => option.source.ratioLabel === commonRatio || option.ratioLabel === commonRatio)) {
                seen.add(commonRatio);
                values.push(commonRatio);
            }
        }
        for (const option of options) {
            if (seen.has(option.source.ratioLabel)) continue;
            seen.add(option.source.ratioLabel);
            values.push(option.source.ratioLabel);
        }
        return values.slice(0, 16);
    }, [options]);

    const filteredOptions = React.useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return options.filter((option) => {
            if (!showUnavailable && !option.valid) return false;
            if (category !== 'all' && option.source.category !== category) return false;
            if (platform !== 'all' && !option.source.platforms.includes(platform)) return false;
            if (direction !== 'all' && scenarioDirection(option) !== direction) return false;
            if (ratio !== 'all' && option.source.ratioLabel !== ratio && option.ratioLabel !== ratio) return false;
            if (confidence !== 'all' && option.source.confidence !== confidence) return false;
            if (normalizedQuery && !optionSearchText(option, language).includes(normalizedQuery)) return false;
            return true;
        });
    }, [category, confidence, direction, language, options, platform, query, ratio, showUnavailable]);

    const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
    const selectedOption = React.useMemo(() => {
        if (selectedKey) {
            const selected = filteredOptions.find((option) => optionKey(option) === selectedKey);
            if (selected) return selected;
        }
        return (
            filteredOptions.find((option) => option.modelSize === currentSize) ??
            filteredOptions.find((option) => option.valid) ??
            filteredOptions[0] ??
            null
        );
    }, [currentSize, filteredOptions, selectedKey]);

    React.useEffect(() => {
        if (!open) return;
        const current = filteredOptions.find((option) => option.modelSize === currentSize);
        if (current) {
            setSelectedKey(optionKey(current));
        } else {
            setSelectedKey(null);
        }
    }, [currentSize, filteredOptions, open]);

    const currentSummary = React.useMemo(() => {
        if (!currentSize || currentSize === 'auto') return t('scenarioSize.current.auto');
        if (currentSize === 'custom') return t('scenarioSize.current.custom');
        return currentSize.replace('x', ' × ');
    }, [currentSize, t]);

    const applySelected = React.useCallback(() => {
        if (!selectedOption || !selectedOption.valid) return;
        onApply(selectedOption);
        setOpen(false);
    }, [onApply, selectedOption]);

    const moveSelection = React.useCallback(
        (delta: number) => {
            if (filteredOptions.length === 0) return;
            const currentKey = selectedOption ? optionKey(selectedOption) : selectedKey;
            const currentIndex = currentKey ? filteredOptions.findIndex((option) => optionKey(option) === currentKey) : -1;
            const nextIndex = currentIndex < 0
                ? delta > 0
                    ? 0
                    : filteredOptions.length - 1
                : (currentIndex + delta + filteredOptions.length) % filteredOptions.length;
            setSelectedKey(optionKey(filteredOptions[nextIndex]));
        },
        [filteredOptions, selectedKey, selectedOption]
    );

    const handleSearchKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                applySelected();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveSelection(1);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveSelection(-1);
            }
        },
        [applySelected, moveSelection]
    );

    const clearFilters = React.useCallback(() => {
        setQuery('');
        setCategory('all');
        setPlatform('all');
        setDirection('all');
        setRatio('all');
        setConfidence('all');
    }, []);

    return (
        <>
            <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setOpen(true)}
                className={cn('h-9 rounded-full border-border bg-background/80 px-3 text-xs', triggerClassName)}
            >
                <SlidersHorizontal className='h-4 w-4' aria-hidden='true' />
                <span className='truncate'>{triggerLabel ?? t('scenarioSize.trigger')}</span>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className='grid max-h-[calc(100dvh-1rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]'>
                    <DialogHeader className='border-b border-border px-4 py-4 text-left sm:px-5'>
                        <div className='flex items-start gap-3 pr-10'>
                            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground'>
                                <MonitorSmartphone className='h-5 w-5' aria-hidden='true' />
                            </div>
                            <div className='min-w-0 space-y-1'>
                                <DialogTitle className='text-base sm:text-lg'>{t('scenarioSize.title')}</DialogTitle>
                                <DialogDescription className='max-w-3xl text-xs leading-5 sm:text-sm'>
                                    {t('scenarioSize.description', {
                                        model: adapter?.modelLabel ?? String(model),
                                        size: currentSummary
                                    })}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {!adapter ? (
                        <div className='flex min-h-[320px] items-center justify-center p-6'>
                            <div className='max-w-md space-y-3 text-center'>
                                <ImageIcon className='mx-auto h-10 w-10 text-muted-foreground' aria-hidden='true' />
                                <p className='font-medium text-foreground'>{t('scenarioSize.noAdapterTitle')}</p>
                                <p className='text-sm leading-6 text-muted-foreground'>{t('scenarioSize.noAdapterDescription')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className='grid min-h-0 grid-cols-1 overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)_340px] lg:overflow-hidden'>
                            <aside className='space-y-4 border-b border-border bg-muted/30 p-4 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0'>
                                <div className='space-y-2'>
                                    <Label htmlFor='scenario-size-search' className='text-xs text-muted-foreground'>
                                        {t('scenarioSize.searchLabel')}
                                    </Label>
                                    <div className='relative'>
                                        <Search
                                            className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground'
                                            aria-hidden='true'
                                        />
                                        <Input
                                            ref={searchInputRef}
                                            id='scenario-size-search'
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            onKeyDown={handleSearchKeyDown}
                                            placeholder={t('scenarioSize.searchPlaceholder')}
                                            className='h-10 rounded-lg bg-background pl-9'
                                        />
                                        {query && (
                                            <button
                                                type='button'
                                                onClick={() => setQuery('')}
                                                className='absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
                                                aria-label={t('scenarioSize.clearSearch')}
                                            >
                                                <X className='h-4 w-4' aria-hidden='true' />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className='space-y-2'>
                                    <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                                        <Layers3 className='h-3.5 w-3.5' aria-hidden='true' />
                                        {t('scenarioSize.tier')}
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        {adapter.tiers.map((tierOption) => (
                                            <button
                                                key={tierOption}
                                                type='button'
                                                onClick={() => setTier(tierOption)}
                                                aria-pressed={tier === tierOption}
                                                className={cn(
                                                    'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                                                    tier === tierOption
                                                        ? 'border-foreground bg-foreground text-background'
                                                        : 'border-border bg-background text-foreground hover:bg-muted'
                                                )}
                                            >
                                                {tierOption}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className='space-y-2'>
                                    <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                                        <Filter className='h-3.5 w-3.5' aria-hidden='true' />
                                        {t('scenarioSize.category')}
                                    </div>
                                    <div className='grid grid-cols-2 gap-2 lg:grid-cols-1'>
                                        <FilterButton
                                            active={category === 'all'}
                                            label={t('scenarioSize.category.all')}
                                            onClick={() => setCategory('all')}
                                        />
                                        {SCENARIO_SIZE_CATEGORIES.map((categoryItem) => (
                                            <FilterButton
                                                key={categoryItem}
                                                active={category === categoryItem}
                                                label={t(`scenarioSize.category.${categoryItem}`)}
                                                onClick={() => setCategory(categoryItem)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className='space-y-2'>
                                    <Label htmlFor='scenario-size-platform' className='text-xs font-medium text-muted-foreground'>
                                        {t('scenarioSize.platform')}
                                    </Label>
                                    <Select value={platform} onValueChange={setPlatform}>
                                        <SelectTrigger id='scenario-size-platform' className='h-9 w-full rounded-lg bg-background'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className='max-h-72'>
                                            <SelectItem value='all'>{t('scenarioSize.platform.all')}</SelectItem>
                                            {platforms.map((platformItem) => (
                                                <SelectItem key={platformItem} value={platformItem}>
                                                    {platformItem}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className='space-y-2'>
                                    <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                                        <MonitorSmartphone className='h-3.5 w-3.5' aria-hidden='true' />
                                        {t('scenarioSize.direction')}
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        <FilterButton
                                            active={direction === 'all'}
                                            label={t('scenarioSize.direction.all')}
                                            onClick={() => setDirection('all')}
                                            compact
                                        />
                                        {DIRECTION_FILTERS.map((directionItem) => (
                                            <FilterButton
                                                key={directionItem}
                                                active={direction === directionItem}
                                                label={t(`scenarioSize.direction.${directionItem}`)}
                                                onClick={() => setDirection(directionItem)}
                                                compact
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className='space-y-2'>
                                    <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                                        <Target className='h-3.5 w-3.5' aria-hidden='true' />
                                        {t('scenarioSize.ratio')}
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        <FilterButton
                                            active={ratio === 'all'}
                                            label={t('scenarioSize.ratio.all')}
                                            onClick={() => setRatio('all')}
                                            compact
                                        />
                                        {ratios.map((ratioItem) => (
                                            <FilterButton
                                                key={ratioItem}
                                                active={ratio === ratioItem}
                                                label={ratioItem}
                                                onClick={() => setRatio(ratioItem)}
                                                compact
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className='space-y-2'>
                                    <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                                        <BadgeCheck className='h-3.5 w-3.5' aria-hidden='true' />
                                        {t('scenarioSize.confidence')}
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        <FilterButton
                                            active={confidence === 'all'}
                                            label={t('scenarioSize.confidence.all')}
                                            onClick={() => setConfidence('all')}
                                            compact
                                        />
                                        {CONFIDENCE_FILTERS.map((confidenceItem) => (
                                            <FilterButton
                                                key={confidenceItem}
                                                active={confidence === confidenceItem}
                                                label={t(`scenarioSize.confidence.${confidenceItem}`)}
                                                onClick={() => setConfidence(confidenceItem)}
                                                compact
                                            />
                                        ))}
                                    </div>
                                </div>

                                <label className='flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted-foreground'>
                                    <Checkbox
                                        checked={showUnavailable}
                                        onCheckedChange={(checked) => setShowUnavailable(Boolean(checked))}
                                        className='mt-0.5'
                                    />
                                    <span>{t('scenarioSize.showUnavailable')}</span>
                                </label>
                            </aside>

                            <section className='p-3 sm:p-4 lg:min-h-0 lg:overflow-y-auto'>
                                <div className='mb-3 flex items-center justify-between gap-3'>
                                    <p className='text-sm font-medium text-foreground'>
                                        {t('scenarioSize.resultCount', { count: filteredOptions.length })}
                                    </p>
                                    <p className='hidden text-xs text-muted-foreground sm:block'>
                                        {t('scenarioSize.adapterKind', { kind: t(`scenarioSize.adapter.${adapter.kind}`) })}
                                    </p>
                                </div>
                                {filteredOptions.length === 0 ? (
                                    <div className='flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center'>
                                        <div className='max-w-sm space-y-3'>
                                            <Search className='mx-auto h-8 w-8 text-muted-foreground' aria-hidden='true' />
                                            <p className='font-medium text-foreground'>{t('scenarioSize.emptyTitle')}</p>
                                            <p className='text-sm leading-6 text-muted-foreground'>{t('scenarioSize.emptyDescription')}</p>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                size='sm'
                                                onClick={clearFilters}
                                            >
                                                {t('scenarioSize.clearFilters')}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className='grid grid-cols-1 gap-2 xl:grid-cols-2'>
                                        {filteredOptions.map((option) => {
                                            const key = optionKey(option);
                                            const active = selectedOption === option || key === selectedKey;
                                            const current = option.modelSize === currentSize;
                                            return (
                                                <button
                                                    type='button'
                                                    key={key || option.source.id}
                                                    onClick={() => setSelectedKey(key)}
                                                    className={cn(
                                                        'group min-h-[112px] rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
                                                        active
                                                            ? 'border-foreground bg-foreground text-background'
                                                            : 'border-border bg-background hover:border-foreground/30 hover:bg-muted/60',
                                                        !option.valid && 'opacity-60'
                                                    )}
                                                >
                                                    <div className='flex items-start justify-between gap-3'>
                                                        <div className='min-w-0 space-y-1'>
                                                            <p className='line-clamp-2 text-sm leading-5 font-semibold'>
                                                                {localize(option.source.title, language)}
                                                            </p>
                                                            <p
                                                                className={cn(
                                                                    'text-xs leading-5',
                                                                    active ? 'text-background/70' : 'text-muted-foreground'
                                                                )}
                                                            >
                                                                {option.source.platforms.slice(0, 3).join(' / ')}
                                                            </p>
                                                        </div>
                                                        {current ? (
                                                            <span
                                                                className={cn(
                                                                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px]',
                                                                    active ? 'bg-background/15' : 'bg-primary/10 text-primary'
                                                                )}
                                                            >
                                                                <Check className='h-3 w-3' aria-hidden='true' />
                                                                {t('scenarioSize.currentBadge')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div className='mt-3 grid grid-cols-3 gap-2 text-xs'>
                                                        <Metric
                                                            active={active}
                                                            label={t('scenarioSize.source')}
                                                            value={sourceSizeLabel(option)}
                                                        />
                                                        <Metric
                                                            active={active}
                                                            label={t('scenarioSize.modelSize')}
                                                            value={option.valid ? option.modelSize.replace('x', '×') : t('scenarioSize.unavailable')}
                                                        />
                                                        <Metric active={active} label={t('scenarioSize.tier')} value={String(option.tier)} />
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            'mt-3 flex items-center justify-between gap-2 text-xs',
                                                            active ? 'text-background/75' : candidateTone(option.matchQuality)
                                                        )}
                                                    >
                                                        <span className='inline-flex items-center gap-1'>
                                                            <BadgeCheck className='h-3.5 w-3.5' aria-hidden='true' />
                                                            {t(`scenarioSize.match.${option.matchQuality}`)}
                                                        </span>
                                                        <ChevronRight className='h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5' aria-hidden='true' />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            <aside className='border-t border-border bg-muted/20 p-4 lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l'>
                                {selectedOption ? (
                                    <ScenarioDetail option={selectedOption} />
                                ) : (
                                    <div className='rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground'>
                                        {t('scenarioSize.selectOne')}
                                    </div>
                                )}
                            </aside>
                        </div>
                    )}

                    <DialogFooter className='border-t border-border bg-background px-4 py-3 sm:px-5'>
                        <div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                            <p className='text-xs leading-5 text-muted-foreground'>
                                {selectedOption?.valid
                                    ? t('scenarioSize.footerSelection', {
                                          title: localize(selectedOption.source.title, language),
                                          size: selectedOption.modelSize
                                      })
                                    : t('scenarioSize.footerEmpty')}
                            </p>
                            <div className='flex gap-2'>
                                <Button type='button' variant='outline' onClick={() => setOpen(false)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button type='button' onClick={applySelected} disabled={!selectedOption?.valid}>
                                    <Check className='h-4 w-4' aria-hidden='true' />
                                    {t('scenarioSize.apply')}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function FilterButton({
    active,
    label,
    onClick,
    compact = false
}: {
    active: boolean;
    label: string;
    onClick: () => void;
    compact?: boolean;
}) {
    return (
        <button
            type='button'
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'min-h-8 rounded-full border text-xs font-medium transition-colors',
                compact ? 'px-2.5' : 'px-3 text-left',
                active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-foreground hover:bg-muted'
            )}
        >
            {label}
        </button>
    );
}

function Metric({ label, value, active }: { label: string; value: string; active: boolean }) {
    return (
        <span className={cn('min-w-0 rounded-md p-2', active ? 'bg-background/10' : 'bg-muted/60')}>
            <span className={cn('block text-[10px]', active ? 'text-background/60' : 'text-muted-foreground')}>
                {label}
            </span>
            <span className='mt-1 block truncate font-medium'>{value}</span>
        </span>
    );
}

function ScenarioDetail({ option }: { option: ScenarioModelSizeOption }) {
    const { t, language } = useAppLanguage();
    const note = localize(option.source.note, language);
    const safeArea = localize(option.source.safeArea, language);
    const disabledReason = localize(option.disabledReason, language);

    return (
        <div className='space-y-4'>
            <div className='space-y-2'>
                <div className='inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground'>
                    <Sparkles className='h-3.5 w-3.5' aria-hidden='true' />
                    {t(`scenarioSize.category.${option.source.category}`)}
                </div>
                <h3 className='text-base leading-6 font-semibold text-foreground'>{localize(option.source.title, language)}</h3>
                <p className='text-sm leading-6 text-muted-foreground'>{option.source.platforms.join(' / ')}</p>
            </div>

            <div className='grid grid-cols-2 gap-2'>
                <DetailStat label={t('scenarioSize.sourceSize')} value={sourceSizeLabel(option)} />
                <DetailStat label={t('scenarioSize.sourceRatio')} value={option.source.ratioLabel} />
                <DetailStat label={t('scenarioSize.modelSize')} value={option.valid ? option.modelSize.replace('x', ' × ') : t('scenarioSize.unavailable')} />
                <DetailStat label={t('scenarioSize.modelRatio')} value={option.ratioLabel} />
                <DetailStat label={t('scenarioSize.tier')} value={String(option.tier)} />
                <DetailStat label={t('scenarioSize.confidence')} value={t(`scenarioSize.confidence.${option.source.confidence}`)} />
            </div>

            <div className='rounded-lg border border-border bg-background p-3 text-sm leading-6'>
                <div className={cn('mb-1 flex items-center gap-2 text-xs font-medium', candidateTone(option.matchQuality))}>
                    <BadgeCheck className='h-4 w-4' aria-hidden='true' />
                    {t(`scenarioSize.match.${option.matchQuality}`)}
                </div>
                <p className='text-muted-foreground'>
                    {option.valid
                        ? t('scenarioSize.detail.matchDescription', {
                              source: sourceSizeLabel(option),
                              target: option.modelSize,
                              delta: compactPercent(option.ratioDelta)
                          })
                        : disabledReason || t('scenarioSize.unavailableDescription')}
                </p>
            </div>

            {(note || safeArea) && (
                <div className='space-y-2 rounded-lg border border-border bg-background p-3 text-sm leading-6 text-muted-foreground'>
                    <div className='flex items-center gap-2 text-xs font-medium text-foreground'>
                        <Info className='h-4 w-4' aria-hidden='true' />
                        {t('scenarioSize.productionNotes')}
                    </div>
                    {note && <p>{note}</p>}
                    {safeArea && <p>{safeArea}</p>}
                </div>
            )}

            <div className='flex flex-wrap gap-2'>
                {option.source.tags.map((tag) => (
                    <span
                        key={tag}
                        className='rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground'
                    >
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
}

function DetailStat({ label, value }: { label: string; value: string }) {
    return (
        <div className='rounded-lg border border-border bg-background p-3'>
            <p className='text-[11px] text-muted-foreground'>{label}</p>
            <p className='mt-1 truncate text-sm font-semibold text-foreground'>{value}</p>
        </div>
    );
}
