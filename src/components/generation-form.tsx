'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { CustomSizeRecommendation } from '@/components/custom-size-recommendation';
import { LocalizedMessage } from '@/components/localized-message';
import { MemoTextarea } from '@/components/memoized-textarea';
import { ModeToggle } from '@/components/mode-toggle';
import { ScenarioSizePickerDialog } from '@/components/scenario-size-picker-dialog';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkbenchCard } from '@/components/ui/workbench-card';
import type { GptImageModel } from '@/lib/cost-utils';
import { isTauriDesktop } from '@/lib/desktop-runtime';
import { getAllImageModels, getImageModel, isImageModelId, type StoredCustomImageModel } from '@/lib/model-registry';
import { clearPromptDraft, getMeaningfulPromptDraft, savePromptDraft } from '@/lib/prompt-draft';
import { getGptImage2ScenarioSizeDescriptor, isScenarioSizeSupportedValue } from '@/lib/scenario-image-sizes';
import { getPresetTooltip, validateGptImage2Size } from '@/lib/size-utils';
import type { SizePreset } from '@/lib/size-utils';
import {
    Square,
    RectangleHorizontal,
    RectangleVertical,
    Sparkles,
    Eraser,
    ShieldCheck,
    ShieldAlert,
    FileImage,
    Tally1,
    Tally2,
    Tally3,
    BrickWall,
    Lock,
    LockOpen,
    SquareDashed,
    RotateCcw
} from 'lucide-react';
import * as React from 'react';

export type GenerationFormData = {
    prompt: string;
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: 'low' | 'medium' | 'high' | 'auto';
    output_format: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background: 'transparent' | 'opaque' | 'auto';
    moderation: 'low' | 'auto';
    model: GptImageModel;
};

type GenerationFormProps = {
    onSubmit: (data: GenerationFormData) => void;
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    model: GenerationFormData['model'];
    setModel: React.Dispatch<React.SetStateAction<GenerationFormData['model']>>;
    prompt: string;
    setPrompt: React.Dispatch<React.SetStateAction<string>>;
    n: number[];
    setN: React.Dispatch<React.SetStateAction<number[]>>;
    size: GenerationFormData['size'];
    setSize: React.Dispatch<React.SetStateAction<GenerationFormData['size']>>;
    customWidth: number;
    setCustomWidth: React.Dispatch<React.SetStateAction<number>>;
    customHeight: number;
    setCustomHeight: React.Dispatch<React.SetStateAction<number>>;
    quality: GenerationFormData['quality'];
    setQuality: React.Dispatch<React.SetStateAction<GenerationFormData['quality']>>;
    outputFormat: GenerationFormData['output_format'];
    setOutputFormat: React.Dispatch<React.SetStateAction<GenerationFormData['output_format']>>;
    compression: number[];
    setCompression: React.Dispatch<React.SetStateAction<number[]>>;
    background: GenerationFormData['background'];
    setBackground: React.Dispatch<React.SetStateAction<GenerationFormData['background']>>;
    moderation: GenerationFormData['moderation'];
    setModeration: React.Dispatch<React.SetStateAction<GenerationFormData['moderation']>>;
    enableStreaming: boolean;
    setEnableStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    partialImages: 1 | 2 | 3;
    setPartialImages: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
    customImageModels?: StoredCustomImageModel[];
};

type DraftBannerProps = {
    draft: string;
    onRecover: (draft: string) => void;
    onDiscard: () => void;
    t: (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;
};

const DraftBanner = React.memo(function DraftBanner({ draft, onRecover, onDiscard, t }: DraftBannerProps) {
    const count = draft.length;
    return (
        <div className='border-border bg-card flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm'>
            <span className='text-muted-foreground flex items-center gap-2'>
                <RotateCcw className='h-4 w-4 shrink-0' />
                {t('prompt.draft.banner', { count })}
            </span>
            <div className='flex items-center gap-2'>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => onRecover(draft)}
                    className='text-foreground hover:bg-accent h-7 px-2 text-xs'>
                    {t('prompt.draft.recover')}
                </Button>
                <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={onDiscard}
                    className='text-foreground hover:bg-accent h-7 px-2 text-xs'>
                    {t('prompt.draft.discard')}
                </Button>
            </div>
        </div>
    );
});

const RadioItemWithIcon = React.memo(function RadioItemWithIcon({
    value,
    id,
    label,
    Icon
}: {
    value: string;
    id: string;
    label: string;
    Icon: React.ElementType;
}) {
    return (
        <div className='flex items-center space-x-2'>
            <RadioGroupItem
                value={value}
                id={id}
                className='border-panel-divider text-foreground data-[state=checked]:border-foreground data-[state=checked]:text-foreground'
            />
            <Label htmlFor={id} className='text-on-panel-muted flex cursor-pointer items-center gap-2 text-base'>
                <Icon className='text-on-panel-muted h-5 w-5' />
                {label}
            </Label>
        </div>
    );
});

function formatSizeValueSpaced(value: string): string {
    return value.replace('x', ' × ');
}

function selectedSizeSummary(size: string): string | null {
    if (!size || ['auto', 'portrait', 'landscape', 'square', 'custom'].includes(size)) return null;
    const descriptor = getGptImage2ScenarioSizeDescriptor(size);
    if (!descriptor) return formatSizeValueSpaced(size);
    return `${descriptor.tier} · ${descriptor.ratioLabel} · ${formatSizeValueSpaced(descriptor.value)}`;
}

function GenerationFormBase({
    onSubmit,
    currentMode,
    onModeChange,
    isPasswordRequiredByBackend,
    clientPasswordHash,
    onOpenPasswordDialog,
    model,
    setModel,
    prompt,
    setPrompt,
    n,
    setN,
    size,
    setSize,
    customWidth,
    setCustomWidth,
    customHeight,
    setCustomHeight,
    quality,
    setQuality,
    outputFormat,
    setOutputFormat,
    compression,
    setCompression,
    background,
    setBackground,
    moderation,
    setModeration,
    enableStreaming,
    setEnableStreaming,
    partialImages,
    setPartialImages,
    customImageModels = []
}: GenerationFormProps) {
    const { t } = useAppLanguage();
    const [recoverableDraft, setRecoverableDraft] = React.useState<string | null>(null);

    const showCompression = outputFormat === 'jpeg' || outputFormat === 'webp';
    const modelDefinition = getImageModel(model, customImageModels);
    const isGptImage2 = modelDefinition.supportsCustomSize;
    const customSizeValidation = React.useMemo(
        () => (size === 'custom' ? validateGptImage2Size(customWidth, customHeight) : { valid: true as const }),
        [size, customWidth, customHeight]
    );
    const customSizeInvalid = size === 'custom' && !customSizeValidation.valid;
    const imageCount = n[0];

    React.useEffect(() => {
        if (imageCount > 1 && enableStreaming) {
            setEnableStreaming(false);
        }
    }, [imageCount, enableStreaming, setEnableStreaming]);

    React.useEffect(() => {
        if (!isGptImage2 && size === 'custom') {
            setSize('auto');
        }
        if (!isScenarioSizeSupportedValue(model, size, customImageModels)) {
            setSize('auto');
        }
    }, [customImageModels, isGptImage2, model, size, setSize]);

    React.useEffect(() => {
        if (isGptImage2 && background === 'transparent') {
            setBackground('auto');
        }
    }, [isGptImage2, background, setBackground]);

    React.useEffect(() => {
        if (prompt === '') {
            setRecoverableDraft(getMeaningfulPromptDraft('generate'));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        if (prompt.length > 0) setRecoverableDraft(null);
    }, [prompt]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            savePromptDraft('generate', prompt);
        }, 400);
        return () => clearTimeout(timer);
    }, [prompt]);

    React.useEffect(() => {
        if (isTauriDesktop() || !prompt || prompt.length < 50) return;

        const handler = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [prompt]);

    const handlePromptKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.nativeEvent.isComposing) return;
        if (!(event.key === 'Enter' && (event.ctrlKey || event.metaKey))) return;
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
    }, []);

    const handleSubmit = React.useCallback(
        (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (customSizeValidation.valid === false) {
                return;
            }
            const formData: GenerationFormData = {
                prompt,
                n: imageCount,
                size,
                customWidth,
                customHeight,
                quality,
                output_format: outputFormat,
                background,
                moderation,
                model
            };
            if (showCompression) {
                formData.output_compression = compression[0];
            }
            onSubmit(formData);
            clearPromptDraft('generate');
            setRecoverableDraft(null);
        },
        [
            prompt,
            imageCount,
            size,
            customWidth,
            customHeight,
            quality,
            outputFormat,
            background,
            moderation,
            model,
            showCompression,
            compression,
            customSizeValidation,
            onSubmit
        ]
    );

    const handleSetModel = React.useCallback(
        (v: string) => {
            if (isImageModelId(v)) setModel(v);
        },
        [setModel]
    );
    const handleSetSize = React.useCallback((v: string) => setSize(v as GenerationFormData['size']), [setSize]);
    const handleSetQuality = React.useCallback(
        (v: string) => setQuality(v as GenerationFormData['quality']),
        [setQuality]
    );
    const handleSetOutputFormat = React.useCallback(
        (v: string) => setOutputFormat(v as GenerationFormData['output_format']),
        [setOutputFormat]
    );
    const handleSetBackground = React.useCallback(
        (v: string) => setBackground(v as GenerationFormData['background']),
        [setBackground]
    );
    const handleSetModeration = React.useCallback(
        (v: string) => setModeration(v as GenerationFormData['moderation']),
        [setModeration]
    );
    const handleSetCustomWidth = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setCustomWidth(parseInt(e.target.value, 10) || 0),
        [setCustomWidth]
    );
    const handleSetCustomHeight = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setCustomHeight(parseInt(e.target.value, 10) || 0),
        [setCustomHeight]
    );
    const handleApplyCustomSize = React.useCallback(
        (width: number, height: number) => {
            setCustomWidth(width);
            setCustomHeight(height);
        },
        [setCustomWidth, setCustomHeight]
    );
    const handleSetEnableStreaming = React.useCallback(
        (checked: boolean | string) => setEnableStreaming(!!checked),
        [setEnableStreaming]
    );
    const handleSetPartialImages = React.useCallback(
        (v: string) => setPartialImages(Number(v) as 1 | 2 | 3),
        [setPartialImages]
    );
    const handleSetCompression = React.useCallback((v: number[]) => setCompression(v), [setCompression]);
    const handleSetN = React.useCallback((v: number[]) => setN(v), [setN]);

    const streamingDisabled = React.useMemo(() => imageCount > 1, [imageCount]);
    const streamingHint = React.useMemo(
        () =>
            imageCount > 1
                ? t('phase4b.streamingOnlySingleImage')
                : t('phase4b.streamingPreviewDescription'),
        [imageCount, t]
    );

    return (
        <WorkbenchCard>
            <CardHeader className='border-panel-divider flex items-start justify-between border-b pb-4'>
                <div className='min-w-max shrink-0'>
                    <div className='flex items-center'>
                        <CardTitle className='text-foreground py-1 text-lg font-medium whitespace-nowrap'>
                            <LocalizedMessage id='phase4b.generateImage' />
                        </CardTitle>
                        {isPasswordRequiredByBackend && (
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={onOpenPasswordDialog}
                                className='text-on-panel-muted hover:text-foreground ml-2'
                                aria-label='Configure Password'>
                                {clientPasswordHash ? <Lock className='h-4 w-4' /> : <LockOpen className='h-4 w-4' />}
                            </Button>
                        )}
                    </div>
                    <CardDescription className='text-on-panel-muted mt-1'>
                        <LocalizedMessage id='phase4b.createNewImagesFromATextPrompt' />
                    </CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    <SectionModel
                        model={model}
                        onModelChange={handleSetModel}
                        enableStreaming={enableStreaming}
                        onStreamingChange={handleSetEnableStreaming}
                        streamingDisabled={streamingDisabled}
                        streamingHint={streamingHint}
                        nIsGreater1={imageCount > 1}
                        partialImages={partialImages}
                        onPartialImagesChange={handleSetPartialImages}
                        customImageModels={customImageModels}
                    />

                    <div className='space-y-1.5'>
                        <Label htmlFor='prompt' className='text-foreground'>
                            <LocalizedMessage id='video.history.prompt' />
                        </Label>
                        {recoverableDraft && (
                            <DraftBanner
                                draft={recoverableDraft}
                                onRecover={(draft) => {
                                    setPrompt(draft);
                                    setRecoverableDraft(null);
                                }}
                                onDiscard={() => {
                                    clearPromptDraft('generate');
                                    setRecoverableDraft(null);
                                }}
                                t={t}
                            />
                        )}
                        <MemoTextarea
                            id='prompt'
                            placeholder={t('phase4b.exampleAPhotorealisticAstronautFloatingInSpace')}
                            value={prompt}
                            valueSetter={setPrompt}
                            required
                            disabled={false}
                            onKeyDown={handlePromptKeyDown}
                            className='border-panel-divider bg-panel-ghost text-foreground placeholder:text-on-panel-faint focus:bg-panel-subtle min-h-[80px] rounded-xl border transition-all duration-200 focus:border-violet-500/50 focus:ring-violet-500/30'
                        />
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='n-slider' className='text-foreground'>
                            <LocalizedMessage id='phase4b.imageCount' /> {n[0]}
                        </Label>
                        <Slider
                            id='n-slider'
                            min={1}
                            max={10}
                            step={1}
                            value={n}
                            onValueChange={handleSetN}
                            disabled={false}
                            className='[&>button]:border-foreground [&>button]:bg-foreground [&>button]:ring-offset-background [&>span:first-child>span]:bg-foreground mt-3 [&>span:first-child]:h-1'
                        />
                    </div>

                    <SectionSize
                        size={size}
                        onSizeChange={handleSetSize}
                        isGptImage2={isGptImage2}
                        model={model}
                        customWidth={customWidth}
                        onCustomWidthChange={handleSetCustomWidth}
                        customHeight={customHeight}
                        onCustomHeightChange={handleSetCustomHeight}
                        onCustomSizeApply={handleApplyCustomSize}
                        customSizeValidation={customSizeValidation}
                        customImageModels={customImageModels}
                    />

                    <SectionQuality quality={quality} onQualityChange={handleSetQuality} />

                    {!isGptImage2 && (
                        <SectionBackground background={background} onBackgroundChange={handleSetBackground} />
                    )}

                    <SectionFormat outputFormat={outputFormat} onFormatChange={handleSetOutputFormat} />

                    {showCompression && (
                        <div className='space-y-2 pt-2 transition-opacity duration-300'>
                            <Label htmlFor='compression-slider' className='text-foreground'>
                                <LocalizedMessage id='phase4b.compression' /> {compression[0]}%
                            </Label>
                            <Slider
                                id='compression-slider'
                                min={0}
                                max={100}
                                step={1}
                                value={compression}
                                onValueChange={handleSetCompression}
                                disabled={false}
                                className='[&>button]:border-foreground [&>button]:bg-foreground [&>button]:ring-offset-background [&>span:first-child>span]:bg-foreground mt-3 [&>span:first-child]:h-1'
                            />
                        </div>
                    )}

                    <SectionModeration moderation={moderation} onModerationChange={handleSetModeration} />
                </CardContent>
                <CardFooter className='border-panel-divider border-t p-4'>
                    <Button
                        type='submit'
                        disabled={!prompt || customSizeInvalid}
                        className='group dark:disabled:text-on-panel-faint relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-lg shadow-violet-600/20 transition-[box-shadow,filter,background-image,color] duration-200 hover:shadow-violet-600/40 hover:brightness-110 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none dark:disabled:from-white/10 dark:disabled:to-white/10'>
                        <LocalizedMessage id='phase4b.generate' />
                    </Button>
                </CardFooter>
            </form>
        </WorkbenchCard>
    );
}

/** Memoized sections prevent full-form re-renders on any prop change. */

type SectionModelProps = {
    model: GenerationFormData['model'];
    onModelChange: (v: string) => void;
    enableStreaming: boolean;
    onStreamingChange: (checked: boolean | string) => void;
    streamingDisabled: boolean;
    streamingHint: string;
    nIsGreater1: boolean;
    partialImages: 1 | 2 | 3;
    onPartialImagesChange: (v: string) => void;
    customImageModels?: StoredCustomImageModel[];
};

const SectionModel = React.memo(function SectionModel({
    model,
    onModelChange,
    enableStreaming,
    onStreamingChange,
    streamingDisabled,
    streamingHint,
    nIsGreater1,
    partialImages,
    onPartialImagesChange,
    customImageModels = []
}: SectionModelProps) {
    const { t } = useAppLanguage();
    const modelOptions = React.useMemo(() => getAllImageModels(customImageModels), [customImageModels]);

    return (
        <div className='space-y-1.5'>
            <Label htmlFor='model-select' className='text-foreground'>
                <LocalizedMessage id='video.history.detail.model' />
            </Label>
            <div className='flex items-center gap-4'>
                <Select value={model} onValueChange={onModelChange}>
                    <SelectTrigger
                        id='model-select'
                        className='border-panel-divider bg-panel-ghost text-foreground focus:bg-panel-subtle w-[220px] rounded-xl border transition-all duration-200 focus:border-violet-500/50 focus:ring-violet-500/30'>
                        <SelectValue placeholder={t('settings.modelBinding.modelPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent className='border-border bg-popover text-popover-foreground shadow-xl'>
                        {modelOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id} className='focus:bg-accent'>
                                {option.label}
                                <span className='text-muted-foreground ml-2 text-xs'>
                                    {option.providerLabel}
                                    {option.custom ? t('phase4b.customSuffix') : ''}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className='flex items-center gap-2'>
                            <Checkbox
                                id='enable-streaming'
                                checked={enableStreaming}
                                onCheckedChange={onStreamingChange}
                                disabled={streamingDisabled}
                                className='border-panel-divider data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background disabled:cursor-not-allowed disabled:opacity-50'
                            />
                            <Label
                                htmlFor='enable-streaming'
                                className={`text-sm ${nIsGreater1 ? 'text-on-panel-faint cursor-not-allowed' : 'text-on-panel-muted cursor-pointer'}`}>
                                <LocalizedMessage id='phase4b.enableStreamingPreview' />
                            </Label>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className='max-w-[250px]'>{streamingHint}</TooltipContent>
                </Tooltip>
            </div>
            {enableStreaming && (
                <RadioGroup
                    value={String(partialImages)}
                    onValueChange={onPartialImagesChange}
                    className='flex gap-x-5 pt-2'>
                    <div className='flex items-center space-x-2'>
                        <RadioGroupItem
                            value='1'
                            id='partial-1'
                            className='border-panel-divider text-foreground data-[state=checked]:border-foreground data-[state=checked]:text-foreground'
                        />
                        <Label htmlFor='partial-1' className='text-on-panel-muted cursor-pointer'>
                            1
                        </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                        <RadioGroupItem
                            value='2'
                            id='partial-2'
                            className='border-panel-divider text-foreground data-[state=checked]:border-foreground data-[state=checked]:text-foreground'
                        />
                        <Label htmlFor='partial-2' className='text-on-panel-muted cursor-pointer'>
                            2
                        </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                        <RadioGroupItem
                            value='3'
                            id='partial-3'
                            className='border-panel-divider text-foreground data-[state=checked]:border-foreground data-[state=checked]:text-foreground'
                        />
                        <Label htmlFor='partial-3' className='text-on-panel-muted cursor-pointer'>
                            3
                        </Label>
                    </div>
                </RadioGroup>
            )}
        </div>
    );
});

type SectionSizeProps = {
    size: GenerationFormData['size'];
    onSizeChange: (v: string) => void;
    isGptImage2: boolean;
    model: GenerationFormData['model'];
    customWidth: number;
    onCustomWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    customHeight: number;
    onCustomHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCustomSizeApply: (width: number, height: number) => void;
    customSizeValidation: { valid: boolean; reason?: string };
    customImageModels: readonly StoredCustomImageModel[];
};

const SectionSize = React.memo(function SectionSize({
    size,
    onSizeChange,
    isGptImage2,
    model,
    customWidth,
    onCustomWidthChange,
    customHeight,
    onCustomHeightChange,
    onCustomSizeApply,
    customSizeValidation,
    customImageModels
}: SectionSizeProps) {
    const { t } = useAppLanguage();
    const sizeSummary = selectedSizeSummary(size);
    const scenarioPicker = (
        <div className='flex flex-wrap items-center gap-2'>
            <ScenarioSizePickerDialog
                model={model}
                customImageModels={customImageModels}
                currentSize={size}
                onApply={(option) => {
                    onSizeChange(option.modelSize);
                    if (option.adapterKind === 'customPixels') {
                        onCustomSizeApply(option.width, option.height);
                    }
                }}
            />
            {sizeSummary && (
                <span className='border-panel-divider bg-panel-ghost text-on-panel-muted rounded-full border px-3 py-1.5 text-xs'>
                    {sizeSummary}
                </span>
            )}
        </div>
    );
    const presetTooltips = React.useMemo(
        () => ({
            square: getPresetTooltip('square', model),
            landscape: getPresetTooltip('landscape', model),
            portrait: getPresetTooltip('portrait', model)
        }),
        [model]
    );

    return (
        <div className='space-y-3'>
            <Label className='text-foreground block'>
                <LocalizedMessage id='zoomViewer.info.dimensions' />
            </Label>
            <RadioGroup value={size} onValueChange={onSizeChange} disabled={false} className='flex flex-wrap gap-3'>
                <RadioItemWithIcon value='auto' id='size-auto' label={t('scenarioSize.current.auto')} Icon={Sparkles} />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className='border-panel-divider bg-panel-ghost hover:bg-panel-subtle rounded-xl border px-3 py-2 transition-all'>
                            <RadioItemWithIcon
                                value='portrait'
                                id='size-portrait'
                                label={t('phase4b.portrait')}
                                Icon={RectangleVertical}
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{presetTooltips.portrait}</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className='border-panel-divider bg-panel-ghost hover:bg-panel-subtle rounded-xl border px-3 py-2 transition-all'>
                            <RadioItemWithIcon
                                value='landscape'
                                id='size-landscape'
                                label={t('phase4b.landscape')}
                                Icon={RectangleHorizontal}
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{presetTooltips.landscape}</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className='border-panel-divider bg-panel-ghost hover:bg-panel-subtle rounded-xl border px-3 py-2 transition-all'>
                            <RadioItemWithIcon
                                value='square'
                                id='size-square'
                                label={t('phase4b.square')}
                                Icon={Square}
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{presetTooltips.square}</TooltipContent>
                </Tooltip>
                {isGptImage2 && (
                    <div className='border-panel-divider bg-panel-ghost hover:bg-panel-subtle rounded-xl border px-3 py-2 transition-all'>
                        <RadioItemWithIcon
                            value='custom'
                            id='size-custom'
                            label={t('scenarioSize.current.custom')}
                            Icon={SquareDashed}
                        />
                    </div>
                )}
            </RadioGroup>
            {scenarioPicker}
            {isGptImage2 && size === 'custom' && (
                <div className='border-panel-divider bg-panel-ghost space-y-2 rounded-xl border p-3'>
                    <div className='flex items-center gap-3'>
                        <div className='flex-1 space-y-1'>
                            <Label htmlFor='custom-width' className='text-on-panel-muted text-xs'>
                                <LocalizedMessage id='phase4b.widthPx' />
                            </Label>
                            <Input
                                id='custom-width'
                                type='number'
                                min={16}
                                max={3840}
                                step={16}
                                value={customWidth > 0 ? customWidth : ''}
                                onChange={onCustomWidthChange}
                                disabled={false}
                                className='border-panel-divider bg-panel-ghost text-foreground focus:bg-panel-subtle rounded-xl border transition-all duration-200 focus:border-violet-500/50 focus:ring-violet-500/30'
                            />
                        </div>
                        <span className='text-on-panel-muted pt-5'>×</span>
                        <div className='flex-1 space-y-1'>
                            <Label htmlFor='custom-height' className='text-on-panel-muted text-xs'>
                                <LocalizedMessage id='phase4b.heightPx' />
                            </Label>
                            <Input
                                id='custom-height'
                                type='number'
                                min={16}
                                max={3840}
                                step={16}
                                value={customHeight > 0 ? customHeight : ''}
                                onChange={onCustomHeightChange}
                                disabled={false}
                                className='border-panel-divider bg-panel-ghost text-foreground focus:bg-panel-subtle rounded-xl border transition-all duration-200 focus:border-violet-500/50 focus:ring-violet-500/30'
                            />
                        </div>
                    </div>
                    <p className='text-on-panel-muted text-xs'>
                        {customWidth > 0 && customHeight > 0
                            ? t('phase4b.pixelRatioSummary', {
                                  pixels: (customWidth * customHeight).toLocaleString(),
                                  percent: (((customWidth * customHeight) / 8_294_400) * 100).toFixed(1),
                                  ratio: (
                                      Math.max(customWidth, customHeight) / Math.min(customWidth, customHeight)
                                  ).toFixed(2)
                              })
                            : t('phase4b.customSizeSummaryPlaceholder')}
                    </p>
                    <CustomSizeRecommendation
                        width={customWidth}
                        height={customHeight}
                        onApply={onCustomSizeApply}
                        variant='dark'
                    />
                    {customSizeValidation.valid === false && (
                        <p className='text-xs text-red-700 dark:text-red-300'>{customSizeValidation.reason}</p>
                    )}
                    <p className='text-on-panel-faint text-xs'>
                        <LocalizedMessage id='phase4b.limitsMultiplesOf16MaxSide3840pxAspect' />
                    </p>
                </div>
            )}
        </div>
    );
});

type SectionQualityProps = {
    quality: GenerationFormData['quality'];
    onQualityChange: (v: string) => void;
};

const SectionQuality = React.memo(function SectionQuality({ quality, onQualityChange }: SectionQualityProps) {
    const { t } = useAppLanguage();

    return (
        <div className='space-y-3'>
            <Label className='text-foreground block'>
                <LocalizedMessage id='phase4b.quality' />
            </Label>
            <RadioGroup
                value={quality}
                onValueChange={onQualityChange}
                disabled={false}
                className='flex flex-wrap gap-3'>
                <div className='border-panel-divider bg-panel-ghost hover:bg-panel-subtle rounded-xl border px-3 py-2 transition-all'>
                    <RadioItemWithIcon
                        value='auto'
                        id='quality-auto'
                        label={t('scenarioSize.current.auto')}
                        Icon={Sparkles}
                    />
                </div>
                <div className='border-panel-divider bg-panel-ghost hover:bg-panel-subtle rounded-xl border px-3 py-2 transition-all'>
                    <RadioItemWithIcon value='low' id='quality-low' label={t('phase4b.low')} Icon={Tally1} />
                </div>
                <div className='border-panel-divider bg-panel-ghost hover:bg-panel-subtle rounded-xl border px-3 py-2 transition-all'>
                    <RadioItemWithIcon value='medium' id='quality-medium' label={t('phase4b.medium')} Icon={Tally2} />
                </div>
                <div className='border-panel-divider bg-panel-ghost hover:bg-panel-subtle rounded-xl border px-3 py-2 transition-all'>
                    <RadioItemWithIcon value='high' id='quality-high' label={t('phase4b.high')} Icon={Tally3} />
                </div>
            </RadioGroup>
        </div>
    );
});

type SectionBackgroundProps = {
    background: GenerationFormData['background'];
    onBackgroundChange: (v: string) => void;
};

const SectionBackground = React.memo(function SectionBackground({
    background,
    onBackgroundChange
}: SectionBackgroundProps) {
    const { t } = useAppLanguage();

    return (
        <div className='space-y-3'>
            <Label className='text-foreground block'>
                <LocalizedMessage id='phase4b.background' />
            </Label>
            <RadioGroup
                value={background}
                onValueChange={onBackgroundChange}
                disabled={false}
                className='flex flex-wrap gap-x-5 gap-y-3'>
                <RadioItemWithIcon value='auto' id='bg-auto' label={t('scenarioSize.current.auto')} Icon={Sparkles} />
                <RadioItemWithIcon value='opaque' id='bg-opaque' label={t('phase4b.opaque')} Icon={BrickWall} />
                <RadioItemWithIcon
                    value='transparent'
                    id='bg-transparent'
                    label={t('phase4b.transparent')}
                    Icon={Eraser}
                />
            </RadioGroup>
        </div>
    );
});

type SectionFormatProps = {
    outputFormat: GenerationFormData['output_format'];
    onFormatChange: (v: string) => void;
};

const SectionFormat = React.memo(function SectionFormat({ outputFormat, onFormatChange }: SectionFormatProps) {
    return (
        <div className='space-y-3'>
            <Label className='text-foreground block'>
                <LocalizedMessage id='workbench.visionText.options.outputFormat' />
            </Label>
            <RadioGroup
                value={outputFormat}
                onValueChange={onFormatChange}
                disabled={false}
                className='flex flex-wrap gap-x-5 gap-y-3'>
                <RadioItemWithIcon value='png' id='format-png' label='PNG' Icon={FileImage} />
                <RadioItemWithIcon value='jpeg' id='format-jpeg' label='JPEG' Icon={FileImage} />
                <RadioItemWithIcon value='webp' id='format-webp' label='WebP' Icon={FileImage} />
            </RadioGroup>
        </div>
    );
});

type SectionModerationProps = {
    moderation: GenerationFormData['moderation'];
    onModerationChange: (v: string) => void;
};

const SectionModeration = React.memo(function SectionModeration({
    moderation,
    onModerationChange
}: SectionModerationProps) {
    const { t } = useAppLanguage();

    return (
        <div className='space-y-3'>
            <Label className='text-foreground block'>
                <LocalizedMessage id='phase4b.moderation' />
            </Label>
            <RadioGroup
                value={moderation}
                onValueChange={onModerationChange}
                disabled={false}
                className='flex flex-wrap gap-x-5 gap-y-3'>
                <RadioItemWithIcon
                    value='auto'
                    id='mod-auto'
                    label={t('scenarioSize.current.auto')}
                    Icon={ShieldCheck}
                />
                <RadioItemWithIcon value='low' id='mod-low' label={t('phase4b.low')} Icon={ShieldAlert} />
            </RadioGroup>
        </div>
    );
});

export const GenerationForm = React.memo(GenerationFormBase) as typeof GenerationFormBase;
