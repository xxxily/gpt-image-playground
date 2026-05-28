'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { CustomSizeRecommendation } from '@/components/custom-size-recommendation';
import { ScenarioSizePickerDialog } from '@/components/scenario-size-picker-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GptImageModel } from '@/lib/cost-utils';
import type { StoredCustomImageModel } from '@/lib/model-registry';
import type { ProviderSizeOption } from '@/lib/provider-advanced-options';
import {
    getGptImage2ScenarioSizeDescriptor,
    getGptImage2ScenarioSizeVariant,
    getGptImage2ScenarioSizeVariants,
    getScenarioRatioOptionsWithSwap,
    type GptImage2ScenarioSizeVariant
} from '@/lib/scenario-image-sizes';
import {
    OPENAI_IMAGE_ASPECT_RATIOS,
    OPENAI_IMAGE_SIZE_TIERS,
    getGptImage2SizePreset,
    getGptImage2SizePresetByTierAndRatio,
    getGptImage2SizePresetsByTier,
    getPresetDimensions
} from '@/lib/size-utils';
import type { OpenAIImageAspectRatio, OpenAIImageSizePreset, OpenAIImageSizeTier, SizePreset } from '@/lib/size-utils';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';

type SizePillButtonProps = {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
    title?: string;
    className?: string;
};

export const SizePillButton = React.memo(function SizePillButton({
    active,
    children,
    onClick,
    title,
    className
}: SizePillButtonProps) {
    return (
        <button
            type='button'
            aria-pressed={active}
            title={title}
            onClick={onClick}
            className={cn(
                'focus-visible:ring-ring/50 min-h-10 rounded-full border px-4 py-2 text-sm leading-none font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                active
                    ? 'border-foreground bg-foreground text-background shadow-sm'
                    : 'border-border bg-background/90 text-foreground hover:border-foreground/30 hover:bg-muted',
                className
            )}>
            {children}
        </button>
    );
});

function formatSizeValue(value: string): string {
    return value.replace('x', '×');
}

function formatSizeValueSpaced(value: string): string {
    return value.replace('x', ' × ');
}

type ProviderOptionLike = {
    value: string;
    label: string;
    description?: string;
};

export function providerOptionTitle(option: ProviderOptionLike): string {
    return option.description ? `${option.label} · ${option.description}` : option.label;
}

function uniqueSizeMetadata(options: readonly ProviderSizeOption[], key: 'tier' | 'ratio'): string[] {
    const seen = new Set<string>();
    const values: string[] = [];
    options.forEach((option) => {
        const value = option[key];
        if (!value || seen.has(value)) return;
        seen.add(value);
        values.push(value);
    });
    return values;
}

function firstSizeOptionForTierAndRatio(
    options: readonly ProviderSizeOption[],
    tier: string,
    ratio: string
): ProviderSizeOption | undefined {
    return (
        options.find((option) => option.tier === tier && option.ratio === ratio) ||
        options.find((option) => option.tier === tier) ||
        options[0]
    );
}

function providerSizeSummary(size: string, options: readonly ProviderSizeOption[]): string | null {
    const selected = options.find((option) => option.value === size);
    if (!selected) return size ? formatSizeValueSpaced(size) : null;
    return [selected.tier, selected.ratio, formatSizeValueSpaced(selected.value)].filter(Boolean).join(' · ');
}

type OpenAIResolutionOption = {
    value: string;
    width: number;
    height: number;
    tier: OpenAIImageSizeTier;
    ratioLabel: string;
};

function normalizeOpenAIResolutionOption(
    option: GptImage2ScenarioSizeVariant | OpenAIImageSizePreset
): OpenAIResolutionOption {
    return {
        value: option.value,
        width: option.width,
        height: option.height,
        tier: option.tier,
        ratioLabel: 'ratioLabel' in option ? option.ratioLabel : option.ratio
    };
}

function getOpenAIResolutionOptionRatio(option: OpenAIResolutionOption | OpenAIImageSizePreset): string {
    return 'ratioLabel' in option ? option.ratioLabel : option.ratio;
}

function openAIResolutionSummary(descriptor: GptImage2ScenarioSizeVariant | null, size: string): string | null {
    if (!descriptor && (!size || ['auto', 'custom', 'square', 'landscape', 'portrait'].includes(size))) return null;
    if (!descriptor) return formatSizeValueSpaced(size);
    return `${descriptor.tier} · ${descriptor.ratioLabel} · ${formatSizeValueSpaced(descriptor.value)}`;
}

type ProviderResolutionSizeControlsProps = {
    size: string;
    onSizeChange: (value: string) => void;
    model: GptImageModel;
    customImageModels: readonly StoredCustomImageModel[];
    options: readonly ProviderSizeOption[];
    autoValue?: string;
    autoTitle: string;
    note: string;
};

export const ProviderResolutionSizeControls = React.memo(function ProviderResolutionSizeControls({
    size,
    onSizeChange,
    model,
    customImageModels,
    options,
    autoValue = 'auto',
    autoTitle,
    note
}: ProviderResolutionSizeControlsProps) {
    const selectedPreset = React.useMemo(
        () => options.find((option) => option.value === size) ?? null,
        [options, size]
    );
    const tiers = React.useMemo(() => uniqueSizeMetadata(options, 'tier'), [options]);
    const [selectedTier, setSelectedTier] = React.useState(selectedPreset?.tier ?? tiers[0] ?? '');

    const tierOptions = React.useMemo(
        () => options.filter((option) => option.tier === selectedTier),
        [options, selectedTier]
    );
    const ratios = React.useMemo(() => uniqueSizeMetadata(tierOptions, 'ratio'), [tierOptions]);
    const [selectedRatio, setSelectedRatio] = React.useState(selectedPreset?.ratio ?? ratios[0] ?? '');

    React.useEffect(() => {
        if (!selectedPreset) return;
        if (selectedPreset.tier) setSelectedTier(selectedPreset.tier);
        if (selectedPreset.ratio) setSelectedRatio(selectedPreset.ratio);
    }, [selectedPreset]);

    React.useEffect(() => {
        if (tiers.length === 0 || tiers.includes(selectedTier)) return;
        setSelectedTier(tiers[0]);
    }, [selectedTier, tiers]);

    React.useEffect(() => {
        if (ratios.length === 0 || ratios.includes(selectedRatio)) return;
        setSelectedRatio(ratios[0]);
    }, [ratios, selectedRatio]);

    const applyTier = React.useCallback(
        (tier: string) => {
            const nextOption = firstSizeOptionForTierAndRatio(options, tier, selectedRatio);
            if (!nextOption) return;
            setSelectedTier(tier);
            if (nextOption.ratio) setSelectedRatio(nextOption.ratio);
            onSizeChange(nextOption.value);
        },
        [onSizeChange, options, selectedRatio]
    );

    const applyRatio = React.useCallback(
        (ratio: string) => {
            const nextOption = firstSizeOptionForTierAndRatio(options, selectedTier, ratio);
            if (!nextOption) return;
            setSelectedRatio(ratio);
            if (nextOption.tier) setSelectedTier(nextOption.tier);
            onSizeChange(nextOption.value);
        },
        [onSizeChange, options, selectedTier]
    );

    const selectedSummary = size && size !== autoValue ? providerSizeSummary(size, options) : null;
    const scenarioPicker = (
        <div className='flex flex-wrap items-center gap-2 pt-1'>
            <ScenarioSizePickerDialog
                model={model}
                customImageModels={customImageModels}
                currentSize={size === autoValue ? 'auto' : size}
                onApply={(option) => onSizeChange(option.modelSize)}
            />
            {selectedSummary && (
                <span className='border-border bg-background text-muted-foreground rounded-full border px-3 py-1.5 text-xs'>
                    {selectedSummary}
                </span>
            )}
        </div>
    );

    if (options.length === 0) {
        return (
            <div className='space-y-3'>
                {scenarioPicker}
                <p className='text-muted-foreground/80 text-xs leading-5'>{note}</p>
            </div>
        );
    }

    return (
        <div className='space-y-3'>
            <div className='space-y-2'>
                <Label className='text-foreground block'>清晰度</Label>
                <div className='flex flex-wrap gap-2'>
                    {tiers.map((tier) => (
                        <SizePillButton
                            key={tier}
                            active={selectedPreset?.tier === tier}
                            onClick={() => applyTier(tier)}>
                            {tier}
                        </SizePillButton>
                    ))}
                </div>
            </div>
            <div className='space-y-2'>
                <Label className='text-foreground block'>比例</Label>
                <div className='flex flex-wrap gap-2'>
                    {ratios.map((ratio) => (
                        <SizePillButton
                            key={`${selectedTier}-${ratio}`}
                            active={selectedPreset?.ratio === ratio && selectedPreset?.tier === selectedTier}
                            onClick={() => applyRatio(ratio)}>
                            {ratio}
                        </SizePillButton>
                    ))}
                </div>
            </div>
            <div className='space-y-2'>
                <Label className='text-foreground block'>分辨率</Label>
                <div className='flex flex-wrap gap-2'>
                    <SizePillButton
                        active={!size || size === autoValue}
                        title={autoTitle}
                        onClick={() => onSizeChange(autoValue)}>
                        auto
                    </SizePillButton>
                    {tierOptions.map((option) => (
                        <SizePillButton
                            key={option.value}
                            active={size === option.value}
                            title={providerOptionTitle(option)}
                            onClick={() => onSizeChange(option.value)}>
                            {formatSizeValue(option.value)}
                        </SizePillButton>
                    ))}
                </div>
            </div>
            {scenarioPicker}
            <p className='text-muted-foreground/80 text-xs leading-5'>{note}</p>
        </div>
    );
});

type OpenAIResolutionSizeControlsProps = {
    size: SizePreset;
    onSizeChange: (value: string) => void;
    editModel: GptImageModel;
    customImageModels: readonly StoredCustomImageModel[];
    scenarioSelectedSize: string | null;
    onScenarioSelectedSizeChange: (value: string | null) => void;
    customWidth: number;
    onCustomWidthChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    customHeight: number;
    onCustomHeightChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onCustomSizeApply: (width: number, height: number) => void;
    customSizeValidation: { valid: boolean; reason?: string };
};

export const OpenAIResolutionSizeControls = React.memo(function OpenAIResolutionSizeControls({
    size,
    onSizeChange,
    editModel,
    customImageModels,
    scenarioSelectedSize,
    onScenarioSelectedSizeChange,
    customWidth,
    onCustomWidthChange,
    customHeight,
    onCustomHeightChange,
    onCustomSizeApply,
    customSizeValidation
}: OpenAIResolutionSizeControlsProps) {
    const { t } = useAppLanguage();
    const selectedPreset = getGptImage2SizePreset(size);
    const scenarioDescriptor = React.useMemo(() => getGptImage2ScenarioSizeDescriptor(size), [size]);
    const showScenarioRefinement = scenarioSelectedSize === size && Boolean(scenarioDescriptor);
    const scenarioSummary = showScenarioRefinement ? openAIResolutionSummary(scenarioDescriptor, size) : null;
    const [selectedTier, setSelectedTier] = React.useState<OpenAIImageSizeTier>(selectedPreset?.tier ?? '1K');
    const [selectedRatio, setSelectedRatio] = React.useState<OpenAIImageAspectRatio>(selectedPreset?.ratio ?? '1:1');
    const [scenarioTier, setScenarioTier] = React.useState<OpenAIImageSizeTier>(scenarioDescriptor?.tier ?? '2K');
    const [scenarioRatio, setScenarioRatio] = React.useState<string>(scenarioDescriptor?.ratioLabel ?? '1:1');
    const [scenarioRatioAnchor, setScenarioRatioAnchor] = React.useState<string>(
        scenarioDescriptor?.ratioLabel ?? '1:1'
    );
    const resolutionOptions = React.useMemo(() => getGptImage2SizePresetsByTier(selectedTier), [selectedTier]);
    const scenarioRatioOptions = React.useMemo(() => {
        const anchoredOptions = getScenarioRatioOptionsWithSwap(scenarioRatioAnchor);
        if (anchoredOptions.includes(scenarioRatio)) return anchoredOptions;
        return getScenarioRatioOptionsWithSwap(scenarioRatio);
    }, [scenarioRatio, scenarioRatioAnchor]);
    const scenarioResolutionOptions = React.useMemo(
        () => getGptImage2ScenarioSizeVariants(scenarioRatio).map(normalizeOpenAIResolutionOption),
        [scenarioRatio]
    );

    React.useEffect(() => {
        if (!selectedPreset) return;
        setSelectedTier(selectedPreset.tier);
        setSelectedRatio(selectedPreset.ratio);
    }, [selectedPreset]);

    React.useEffect(() => {
        if (!scenarioDescriptor || !showScenarioRefinement) return;
        setScenarioTier(scenarioDescriptor.tier);
        setScenarioRatio(scenarioDescriptor.ratioLabel);
    }, [scenarioDescriptor, showScenarioRefinement]);

    React.useEffect(() => {
        if (!scenarioSelectedSize) return;
        if (scenarioDescriptor) return;
        onScenarioSelectedSizeChange(null);
    }, [onScenarioSelectedSizeChange, scenarioDescriptor, scenarioSelectedSize]);

    const applyTier = React.useCallback(
        (tier: OpenAIImageSizeTier) => {
            onScenarioSelectedSizeChange(null);
            setSelectedTier(tier);
            onSizeChange(getGptImage2SizePresetByTierAndRatio(tier, selectedRatio).value);
        },
        [onScenarioSelectedSizeChange, onSizeChange, selectedRatio]
    );

    const applyRatio = React.useCallback(
        (ratio: OpenAIImageAspectRatio) => {
            onScenarioSelectedSizeChange(null);
            setSelectedRatio(ratio);
            onSizeChange(getGptImage2SizePresetByTierAndRatio(selectedTier, ratio).value);
        },
        [onScenarioSelectedSizeChange, onSizeChange, selectedTier]
    );

    const applyScenarioTier = React.useCallback(
        (tier: OpenAIImageSizeTier) => {
            const nextOption = getGptImage2ScenarioSizeVariant(scenarioRatio, tier);
            if (!nextOption) return;
            onScenarioSelectedSizeChange(nextOption.value);
            setScenarioTier(tier);
            onSizeChange(nextOption.value);
        },
        [onScenarioSelectedSizeChange, onSizeChange, scenarioRatio]
    );

    const applyScenarioRatio = React.useCallback(
        (ratio: string) => {
            const nextOption = getGptImage2ScenarioSizeVariant(ratio, scenarioTier);
            if (!nextOption) return;
            onScenarioSelectedSizeChange(nextOption.value);
            setScenarioRatio(ratio);
            onSizeChange(nextOption.value);
        },
        [onScenarioSelectedSizeChange, onSizeChange, scenarioTier]
    );

    return (
        <div className='space-y-3'>
            <div className='space-y-2'>
                <Label className='text-foreground block'>清晰度</Label>
                <div className='flex flex-wrap gap-2'>
                    {OPENAI_IMAGE_SIZE_TIERS.map((tier) => (
                        <SizePillButton
                            key={tier}
                            active={selectedPreset?.tier === tier}
                            onClick={() => applyTier(tier)}>
                            {tier}
                        </SizePillButton>
                    ))}
                </div>
            </div>
            <div className='space-y-2'>
                <Label className='text-foreground block'>比例</Label>
                <div className='flex flex-wrap gap-2'>
                    {OPENAI_IMAGE_ASPECT_RATIOS.map((ratio) => (
                        <SizePillButton
                            key={ratio}
                            active={selectedPreset?.ratio === ratio}
                            onClick={() => applyRatio(ratio)}>
                            {ratio}
                        </SizePillButton>
                    ))}
                </div>
            </div>
            <div className='space-y-2'>
                <Label className='text-foreground block'>分辨率</Label>
                <div className='flex flex-wrap gap-2'>
                    <SizePillButton
                        active={size === 'auto'}
                        onClick={() => {
                            onScenarioSelectedSizeChange(null);
                            onSizeChange('auto');
                        }}>
                        auto
                    </SizePillButton>
                    {resolutionOptions.map((option) => (
                        <SizePillButton
                            key={option.value}
                            active={size === option.value}
                            title={`${option.tier} · ${getOpenAIResolutionOptionRatio(option)}`}
                            onClick={() => {
                                onScenarioSelectedSizeChange(null);
                                onSizeChange(option.value);
                            }}>
                            {formatSizeValue(option.value)}
                        </SizePillButton>
                    ))}
                    <SizePillButton
                        active={size === 'custom'}
                        onClick={() => {
                            onScenarioSelectedSizeChange(null);
                            onSizeChange('custom');
                        }}>
                        自定义
                    </SizePillButton>
                </div>
            </div>
            <div className='border-border/70 space-y-3 border-t pt-3'>
                <div className='flex flex-wrap items-center gap-2'>
                    <ScenarioSizePickerDialog
                        model={editModel}
                        customImageModels={customImageModels}
                        currentSize={size}
                        onApply={(option) => {
                            setScenarioRatioAnchor(option.ratioLabel);
                            onScenarioSelectedSizeChange(option.modelSize);
                            onSizeChange(option.modelSize);
                            if (option.adapterKind === 'customPixels') {
                                onCustomSizeApply(option.width, option.height);
                            }
                        }}
                    />
                    {scenarioSummary && (
                        <span className='border-border bg-background text-muted-foreground rounded-full border px-3 py-1.5 text-xs'>
                            {scenarioSummary}
                        </span>
                    )}
                </div>
                {showScenarioRefinement && scenarioDescriptor && (
                    <div className='border-border bg-muted/20 space-y-3 rounded-xl border p-3'>
                        <div className='space-y-2'>
                            <Label className='text-muted-foreground block text-xs'>{t('scenarioSize.tier')}</Label>
                            <div className='flex flex-wrap gap-2'>
                                {OPENAI_IMAGE_SIZE_TIERS.map((tier) => (
                                    <SizePillButton
                                        key={`scenario-tier-${tier}`}
                                        active={scenarioDescriptor.tier === tier}
                                        onClick={() => applyScenarioTier(tier)}>
                                        {tier}
                                    </SizePillButton>
                                ))}
                            </div>
                        </div>
                        <div className='space-y-2'>
                            <Label className='text-muted-foreground block text-xs'>{t('scenarioSize.ratio')}</Label>
                            <div className='flex flex-wrap gap-2'>
                                {scenarioRatioOptions.map((ratio) => (
                                    <SizePillButton
                                        key={`scenario-ratio-${ratio}`}
                                        active={scenarioDescriptor.ratioLabel === ratio}
                                        onClick={() => applyScenarioRatio(ratio)}>
                                        {ratio}
                                    </SizePillButton>
                                ))}
                            </div>
                        </div>
                        <div className='space-y-2'>
                            <Label className='text-muted-foreground block text-xs'>
                                {t('scenarioSize.resolution')}
                            </Label>
                            <div className='flex flex-wrap gap-2'>
                                {scenarioResolutionOptions.map((option) => (
                                    <SizePillButton
                                        key={`scenario-resolution-${option.value}`}
                                        active={size === option.value}
                                        title={`${option.tier} · ${option.ratioLabel}`}
                                        onClick={() => {
                                            onScenarioSelectedSizeChange(option.value);
                                            setScenarioTier(option.tier);
                                            setScenarioRatio(option.ratioLabel);
                                            onSizeChange(option.value);
                                        }}>
                                        {formatSizeValue(option.value)}
                                    </SizePillButton>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {size === 'custom' && (
                <div className='border-border bg-muted/30 space-y-2 rounded-xl border p-3'>
                    <div className='flex items-center gap-3'>
                        <div className='flex-1 space-y-1'>
                            <Label htmlFor='edit-custom-width' className='text-muted-foreground text-xs'>
                                宽度 (px)
                            </Label>
                            <Input
                                id='edit-custom-width'
                                type='number'
                                min={16}
                                max={3840}
                                step={16}
                                value={customWidth > 0 ? customWidth : ''}
                                onChange={onCustomWidthChange}
                                className='border-border bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/30 rounded-xl transition-[color,box-shadow,border-color] duration-200'
                            />
                        </div>
                        <span className='text-muted-foreground pt-5'>x</span>
                        <div className='flex-1 space-y-1'>
                            <Label htmlFor='edit-custom-height' className='text-muted-foreground text-xs'>
                                高度 (px)
                            </Label>
                            <Input
                                id='edit-custom-height'
                                type='number'
                                min={16}
                                max={3840}
                                step={16}
                                value={customHeight > 0 ? customHeight : ''}
                                onChange={onCustomHeightChange}
                                className='border-border bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/30 rounded-xl transition-[color,box-shadow,border-color] duration-200'
                            />
                        </div>
                    </div>
                    <p className='text-muted-foreground text-xs'>
                        {customWidth > 0 && customHeight > 0
                            ? `${(customWidth * customHeight).toLocaleString()} 像素 (${(
                                  ((customWidth * customHeight) / 8_294_400) *
                                  100
                              ).toFixed(1)}% 最大值) · ${(
                                  Math.max(customWidth, customHeight) / Math.min(customWidth, customHeight)
                              ).toFixed(2)}:1 比例`
                            : '填写宽度和高度后显示像素与比例。'}
                    </p>
                    <CustomSizeRecommendation width={customWidth} height={customHeight} onApply={onCustomSizeApply} />
                    {!customSizeValidation.valid && (
                        <p className='inline-flex items-start gap-1 text-xs text-red-700 dark:text-red-300'>
                            <AlertTriangle className='mt-0.5 h-3 w-3 shrink-0' aria-hidden='true' />
                            <span>{customSizeValidation.reason}</span>
                        </p>
                    )}
                </div>
            )}
            <p className='text-muted-foreground/80 text-xs leading-5'>
                OpenAI 自定义尺寸需为 16 的倍数，最长边不超过 3840px，长短边比例不超过 3:1，总像素 655,360 至
                8,294,400。
            </p>
            {(size === 'square' || size === 'landscape' || size === 'portrait') && (
                <p className='text-muted-foreground/80 text-xs'>
                    当前旧版比例会解析为 {getPresetDimensions(size, editModel, customImageModels) || 'auto'}。
                </p>
            )}
        </div>
    );
});
