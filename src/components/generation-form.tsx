'use client';

import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { MemoTextarea } from '@/components/memoized-textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getPresetTooltip, validateGptImage2Size } from '@/lib/size-utils';
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
    Loader2,
    BrickWall,
    Lock,
    LockOpen,
    HelpCircle,
    SquareDashed
} from 'lucide-react';
import * as React from 'react';

import type { GptImageModel } from '@/lib/cost-utils';
import type { SizePreset } from '@/lib/size-utils';

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
    isLoading: boolean;
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
};

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
                className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
            />
            <Label htmlFor={id} className='flex cursor-pointer items-center gap-2 text-base text-white/80'>
                <Icon className='h-5 w-5 text-white/60' />
                {label}
            </Label>
        </div>
    );
});

function GenerationFormBase({
    onSubmit,
    isLoading,
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
    setPartialImages
}: GenerationFormProps) {
    const showCompression = outputFormat === 'jpeg' || outputFormat === 'webp';
    const isGptImage2 = model === 'gpt-image-2';
    const customSizeValidation = React.useMemo(
        () => size === 'custom' ? validateGptImage2Size(customWidth, customHeight) : { valid: true as const },
        [size, customWidth, customHeight]
    );
    const customSizeInvalid = size === 'custom' && !customSizeValidation.valid;

    React.useEffect(() => {
        if (n[0] > 1 && enableStreaming) {
            setEnableStreaming(false);
        }
    }, [n, enableStreaming, setEnableStreaming]);

    React.useEffect(() => {
        if (!isGptImage2 && size === 'custom') {
            setSize('auto');
        }
    }, [isGptImage2, size, setSize]);

    React.useEffect(() => {
        if (isGptImage2 && background === 'transparent') {
            setBackground('auto');
        }
    }, [isGptImage2, background, setBackground]);

    const handleSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (customSizeValidation.valid === false) {
            return;
        }
        const formData: GenerationFormData = {
            prompt,
            n: n[0],
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
    }, [prompt, n, size, customWidth, customHeight, quality, outputFormat, background, moderation, model, showCompression, compression, customSizeValidation, onSubmit]);

    const handleSetModel = React.useCallback((v: string) => setModel(v as GenerationFormData['model']), [setModel]);
    const handleSetSize = React.useCallback((v: string) => setSize(v as GenerationFormData['size']), [setSize]);
    const handleSetQuality = React.useCallback((v: string) => setQuality(v as GenerationFormData['quality']), [setQuality]);
    const handleSetOutputFormat = React.useCallback((v: string) => setOutputFormat(v as GenerationFormData['output_format']), [setOutputFormat]);
    const handleSetBackground = React.useCallback((v: string) => setBackground(v as GenerationFormData['background']), [setBackground]);
    const handleSetModeration = React.useCallback((v: string) => setModeration(v as GenerationFormData['moderation']), [setModeration]);
    const handleSetCustomWidth = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => setCustomWidth(parseInt(e.target.value, 10) || 0), [setCustomWidth]);
    const handleSetCustomHeight = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => setCustomHeight(parseInt(e.target.value, 10) || 0), [setCustomHeight]);
    const handleSetEnableStreaming = React.useCallback((checked: boolean | string) => setEnableStreaming(!!checked), [setEnableStreaming]);
    const handleSetPartialImages = React.useCallback((v: string) => setPartialImages(Number(v) as 1 | 2 | 3), [setPartialImages]);
    const handleSetCompression = React.useCallback((v: number[]) => setCompression(v), [setCompression]);
    const handleSetN = React.useCallback((v: number[]) => setN(v), [setN]);

    const modelLabel = React.useMemo(() => n[0] > 1 ? 'cursor-not-allowed text-white/40' : 'cursor-pointer text-white/80', [n[0]]);
    const streamingDisabled = React.useMemo(() => isLoading || n[0] > 1, [isLoading, n[0]]);
    const streamingHint = React.useMemo(() => n[0] > 1 ? '仅在生成单张图片（n=1）时支持流式预览。' : '在图片生成过程中展示预览，提供更交互式的体验。', [n[0]]);

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex items-start justify-between border-b border-white/10 pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>生成图片</CardTitle>
                        {isPasswordRequiredByBackend && (
                            <Button
                                variant='ghost'
                                size='icon'
                                onClick={onOpenPasswordDialog}
                                className='ml-2 text-white/60 hover:text-white'
                                aria-label='Configure Password'>
                                {clientPasswordHash ? <Lock className='h-4 w-4' /> : <LockOpen className='h-4 w-4' />}
                            </Button>
                        )}
                    </div>
                    <CardDescription className='mt-1 text-white/60'>通过文本提示词创建新图片。</CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    <SectionModel
                        model={model}
                        onModelChange={handleSetModel}
                        isLoading={isLoading}
                        enableStreaming={enableStreaming}
                        onStreamingChange={handleSetEnableStreaming}
                        streamingDisabled={streamingDisabled}
                        streamingHint={streamingHint}
                        nIsGreater1={n[0] > 1}
                        partialImages={partialImages}
                        onPartialImagesChange={handleSetPartialImages}
                    />

                    <div className='space-y-1.5'>
                        <Label htmlFor='prompt' className='text-white'>
                    提示词
                </Label>
                <MemoTextarea
                    id='prompt'
                    placeholder='例如，一位在太空中漂浮的宇航员，写实风格'
                            value={prompt}
                            valueSetter={setPrompt}
                            required
                            disabled={isLoading}
                            className='min-h-[80px] rounded-md border border-white/20 bg-black text-white placeholder:text-white/40 focus:border-white/50 focus:ring-white/50'
                        />
                    </div>

                    <div className='space-y-2'>
                            <Label htmlFor='n-slider' className='text-white'>
                    图片数量: {n[0]}
                </Label>
                        <Slider
                            id='n-slider'
                            min={1}
                            max={10}
                            step={1}
                            value={n}
                            onValueChange={handleSetN}
                            disabled={isLoading}
                            className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                        />
                    </div>

                    <SectionSize
                        size={size}
                        onSizeChange={handleSetSize}
                        isLoading={isLoading}
                        isGptImage2={isGptImage2}
                        model={model}
                        customWidth={customWidth}
                        onCustomWidthChange={handleSetCustomWidth}
                        customHeight={customHeight}
                        onCustomHeightChange={handleSetCustomHeight}
                        customSizeValidation={customSizeValidation}
                    />

                    <SectionQuality
                        quality={quality}
                        onQualityChange={handleSetQuality}
                        isLoading={isLoading}
                    />

                    {!isGptImage2 && (
                        <SectionBackground
                            background={background}
                            onBackgroundChange={handleSetBackground}
                            isLoading={isLoading}
                        />
                    )}

                    <SectionFormat
                        outputFormat={outputFormat}
                        onFormatChange={handleSetOutputFormat}
                        isLoading={isLoading}
                    />

                    {showCompression && (
                        <div className='space-y-2 pt-2 transition-opacity duration-300'>
                            <Label htmlFor='compression-slider' className='text-white'>
                        压缩率: {compression[0]}%
                    </Label>
                            <Slider
                                id='compression-slider'
                                min={0}
                                max={100}
                                step={1}
                                value={compression}
                                onValueChange={handleSetCompression}
                                disabled={isLoading}
                                className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                            />
                        </div>
                    )}

                    <SectionModeration
                        moderation={moderation}
                        onModerationChange={handleSetModeration}
                        isLoading={isLoading}
                    />
                </CardContent>
                <CardFooter className='border-t border-white/10 p-4'>
                    <Button
                        type='submit'
                        disabled={isLoading || !prompt || customSizeInvalid}
                        className='flex w-full items-center justify-center gap-2 rounded-md bg-white text-black hover:bg-white/90 disabled:bg-white/10 disabled:text-white/40'>
                        {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
                                {isLoading ? 'Generating...'
                            : '生成'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}

/** Memoized sections prevent full-form re-renders on any prop change. */

type SectionModelProps = {
    model: GenerationFormData['model'];
    onModelChange: (v: string) => void;
    isLoading: boolean;
    enableStreaming: boolean;
    onStreamingChange: (checked: boolean | string) => void;
    streamingDisabled: boolean;
    streamingHint: string;
    nIsGreater1: boolean;
    partialImages: 1 | 2 | 3;
    onPartialImagesChange: (v: string) => void;
};

const SectionModel = React.memo(function SectionModel({
    model, onModelChange, isLoading, enableStreaming, onStreamingChange,
    streamingDisabled, streamingHint, nIsGreater1, partialImages, onPartialImagesChange
}: SectionModelProps) {
    return (
        <div className='space-y-1.5'>
            <Label htmlFor='model-select' className='text-white'>
                模型
            </Label>
            <div className='flex items-center gap-4'>
                <Select value={model} onValueChange={onModelChange} disabled={isLoading}>
                    <SelectTrigger
                        id='model-select'
                        className='w-[180px] rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'>
                        <SelectValue placeholder='选择模型' />
                    </SelectTrigger>
                    <SelectContent className='border-white/20 bg-black text-white'>
                        <SelectItem value='gpt-image-2' className='focus:bg-white/10'>gpt-image-2</SelectItem>
                        <SelectItem value='gpt-image-1.5' className='focus:bg-white/10'>gpt-image-1.5</SelectItem>
                        <SelectItem value='gpt-image-1' className='focus:bg-white/10'>gpt-image-1</SelectItem>
                        <SelectItem value='gpt-image-1-mini' className='focus:bg-white/10'>gpt-image-1-mini</SelectItem>
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
                                className='border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black disabled:cursor-not-allowed disabled:opacity-50'
                            />
                            <Label htmlFor='enable-streaming' className={`text-sm ${nIsGreater1 ? 'cursor-not-allowed text-white/40' : 'cursor-pointer text-white/80'}`}>
                                启用流式预览
                            </Label>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className='max-w-[250px]'>{streamingHint}</TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
});

type SectionSizeProps = {
    size: GenerationFormData['size'];
    onSizeChange: (v: string) => void;
    isLoading: boolean;
    isGptImage2: boolean;
    model: GenerationFormData['model'];
    customWidth: number;
    onCustomWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    customHeight: number;
    onCustomHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    customSizeValidation: { valid: boolean; reason?: string };
};

const SectionSize = React.memo(function SectionSize({
    size, onSizeChange, isLoading, isGptImage2, model,
    customWidth, onCustomWidthChange, customHeight, onCustomHeightChange,
    customSizeValidation
}: SectionSizeProps) {
    const presetTooltips = React.useMemo(() => ({
        square: getPresetTooltip('square', model),
        landscape: getPresetTooltip('landscape', model),
        portrait: getPresetTooltip('portrait', model),
    }), [model]);

    return (
        <div className='space-y-3'>
            <Label className='block text-white'>尺寸</Label>
            <RadioGroup
                value={size}
                onValueChange={onSizeChange}
                disabled={isLoading}
                className='flex flex-wrap gap-x-5 gap-y-3'>
                <RadioItemWithIcon value='auto' id='size-auto' label='自动' Icon={Sparkles} />
                {isGptImage2 && (
                    <RadioItemWithIcon value='custom' id='size-custom' label='自定义' Icon={SquareDashed} />
                )}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <RadioItemWithIcon value='square' id='size-square' label='正方形' Icon={Square} />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{presetTooltips.square}</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <RadioItemWithIcon value='landscape' id='size-landscape' label='横向' Icon={RectangleHorizontal} />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{presetTooltips.landscape}</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <RadioItemWithIcon value='portrait' id='size-portrait' label='纵向' Icon={RectangleVertical} />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>{presetTooltips.portrait}</TooltipContent>
                </Tooltip>
            </RadioGroup>
            {isGptImage2 && size === 'custom' && (
                <div className='space-y-2 rounded-md border border-white/10 bg-white/5 p-3'>
                    <div className='flex items-center gap-3'>
                        <div className='flex-1 space-y-1'>
                            <Label htmlFor='custom-width' className='text-xs text-white/70'>宽度 (px)</Label>
                            <Input
                                id='custom-width'
                                type='number'
                                min={16}
                                max={3840}
                                step={16}
                                value={customWidth}
                                onChange={onCustomWidthChange}
                                disabled={isLoading}
                                className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'
                            />
                        </div>
                        <span className='pt-5 text-white/60'>×</span>
                        <div className='flex-1 space-y-1'>
                            <Label htmlFor='custom-height' className='text-xs text-white/70'>高度 (px)</Label>
                            <Input
                                id='custom-height'
                                type='number'
                                min={16}
                                max={3840}
                                step={16}
                                value={customHeight}
                                onChange={onCustomHeightChange}
                                disabled={isLoading}
                                className='rounded-md border border-white/20 bg-black text-white focus:border-white/50 focus:ring-white/50'
                            />
                        </div>
                    </div>
                    <p className='text-xs text-white/50'>
                        {(customWidth * customHeight).toLocaleString()} 像素 (
                        {((customWidth * customHeight) / 8_294_400 * 100).toFixed(1)}% 最大值) ·{' '}
                        {customWidth > 0 && customHeight > 0
                            ? `${(Math.max(customWidth, customHeight) / Math.min(customWidth, customHeight)).toFixed(2)}:1 比例`
                            : '—'}
                    </p>
                    {customSizeValidation.valid === false && (
                        <p className='text-xs text-red-400'>{customSizeValidation.reason}</p>
                    )}
                    <p className='text-xs text-white/40'>
                        限制: 16 的倍数，边长最大 3840px，宽高比 ≤ 3:1，总像素 655,360 至 8,294,400。
                    </p>
                </div>
            )}
        </div>
    );
});

type SectionQualityProps = {
    quality: GenerationFormData['quality'];
    onQualityChange: (v: string) => void;
    isLoading: boolean;
};

const SectionQuality = React.memo(function SectionQuality({ quality, onQualityChange, isLoading }: SectionQualityProps) {
    return (
        <div className='space-y-3'>
            <Label className='block text-white'>质量</Label>
            <RadioGroup
                value={quality}
                onValueChange={onQualityChange}
                disabled={isLoading}
                className='flex flex-wrap gap-x-5 gap-y-3'>
                <RadioItemWithIcon value='auto' id='quality-auto' label='自动' Icon={Sparkles} />
                <RadioItemWithIcon value='low' id='quality-low' label='低' Icon={Tally1} />
                <RadioItemWithIcon value='medium' id='quality-medium' label='中' Icon={Tally2} />
                <RadioItemWithIcon value='high' id='quality-high' label='高' Icon={Tally3} />
            </RadioGroup>
        </div>
    );
});

type SectionBackgroundProps = {
    background: GenerationFormData['background'];
    onBackgroundChange: (v: string) => void;
    isLoading: boolean;
};

const SectionBackground = React.memo(function SectionBackground({ background, onBackgroundChange, isLoading }: SectionBackgroundProps) {
    return (
        <div className='space-y-3'>
            <Label className='block text-white'>背景</Label>
            <RadioGroup
                value={background}
                onValueChange={onBackgroundChange}
                disabled={isLoading}
                className='flex flex-wrap gap-x-5 gap-y-3'>
                <RadioItemWithIcon value='auto' id='bg-auto' label='自动' Icon={Sparkles} />
                <RadioItemWithIcon value='opaque' id='bg-opaque' label='不透明' Icon={BrickWall} />
                <RadioItemWithIcon value='transparent' id='bg-transparent' label='透明' Icon={Eraser} />
            </RadioGroup>
        </div>
    );
});

type SectionFormatProps = {
    outputFormat: GenerationFormData['output_format'];
    onFormatChange: (v: string) => void;
    isLoading: boolean;
};

const SectionFormat = React.memo(function SectionFormat({ outputFormat, onFormatChange, isLoading }: SectionFormatProps) {
    return (
        <div className='space-y-3'>
            <Label className='block text-white'>输出格式</Label>
            <RadioGroup
                value={outputFormat}
                onValueChange={onFormatChange}
                disabled={isLoading}
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
    isLoading: boolean;
};

const SectionModeration = React.memo(function SectionModeration({ moderation, onModerationChange, isLoading }: SectionModerationProps) {
    return (
        <div className='space-y-3'>
            <Label className='block text-white'>内容审核</Label>
            <RadioGroup
                value={moderation}
                onValueChange={onModerationChange}
                disabled={isLoading}
                className='flex flex-wrap gap-x-5 gap-y-3'>
                <RadioItemWithIcon value='auto' id='mod-auto' label='自动' Icon={ShieldCheck} />
                <RadioItemWithIcon value='low' id='mod-low' label='低' Icon={ShieldAlert} />
            </RadioGroup>
        </div>
    );
});

export const GenerationForm = React.memo(GenerationFormBase) as typeof GenerationFormBase;