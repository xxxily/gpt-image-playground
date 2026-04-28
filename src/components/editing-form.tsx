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
    Upload,
    Eraser,
    Save,
    Square,
    RectangleHorizontal,
    RectangleVertical,
    Sparkles,
    Tally1,
    Tally2,
    Tally3,
    X,
    ScanEye,
    UploadCloud,
    Lock,
    LockOpen,
    HelpCircle,
    SquareDashed,
    Info,
    Maximize2
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

import type { GptImageModel } from '@/lib/cost-utils';
import type { SizePreset } from '@/lib/size-utils';
import { ZoomViewer } from '@/components/zoom-viewer';

export type EditingFormData = {
    prompt: string;
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: 'low' | 'medium' | 'high' | 'auto';
    imageFiles: File[];
    maskFile: File | null;
    model: GptImageModel;
};

type EditingFormProps = {
    onSubmit: (data: EditingFormData) => void;
    currentMode: 'generate' | 'edit';
    onModeChange: (mode: 'generate' | 'edit') => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    editModel: EditingFormData['model'];
    setEditModel: React.Dispatch<React.SetStateAction<EditingFormData['model']>>;
    imageFiles: File[];
    sourceImagePreviewUrls: string[];
    setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
    setSourceImagePreviewUrls: React.Dispatch<React.SetStateAction<string[]>>;
    maxImages: number;
    editPrompt: string;
    setEditPrompt: React.Dispatch<React.SetStateAction<string>>;
    editN: number[];
    setEditN: React.Dispatch<React.SetStateAction<number[]>>;
    editSize: EditingFormData['size'];
    setEditSize: React.Dispatch<React.SetStateAction<EditingFormData['size']>>;
    editCustomWidth: number;
    setEditCustomWidth: React.Dispatch<React.SetStateAction<number>>;
    editCustomHeight: number;
    setEditCustomHeight: React.Dispatch<React.SetStateAction<number>>;
    editQuality: EditingFormData['quality'];
    setEditQuality: React.Dispatch<React.SetStateAction<EditingFormData['quality']>>;
    editBrushSize: number[];
    setEditBrushSize: React.Dispatch<React.SetStateAction<number[]>>;
    editShowMaskEditor: boolean;
    setEditShowMaskEditor: React.Dispatch<React.SetStateAction<boolean>>;
    editGeneratedMaskFile: File | null;
    setEditGeneratedMaskFile: React.Dispatch<React.SetStateAction<File | null>>;
    editIsMaskSaved: boolean;
    setEditIsMaskSaved: React.Dispatch<React.SetStateAction<boolean>>;
    editOriginalImageSize: { width: number; height: number } | null;
    setEditOriginalImageSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
    editDrawnPoints: DrawnPoint[];
    setEditDrawnPoints: React.Dispatch<React.SetStateAction<DrawnPoint[]>>;
    editMaskPreviewUrl: string | null;
    setEditMaskPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
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

function EditingFormBase({
    onSubmit,
    currentMode,
    onModeChange,
    isPasswordRequiredByBackend,
    clientPasswordHash,
    onOpenPasswordDialog,
    editModel,
    setEditModel,
    imageFiles,
    sourceImagePreviewUrls,
    setImageFiles,
    setSourceImagePreviewUrls,
    maxImages,
    editPrompt,
    setEditPrompt,
    editN,
    setEditN,
    editSize,
    setEditSize,
    editCustomWidth,
    setEditCustomWidth,
    editCustomHeight,
    setEditCustomHeight,
    editQuality,
    setEditQuality,
    editBrushSize,
    setEditBrushSize,
    editShowMaskEditor,
    setEditShowMaskEditor,
    editGeneratedMaskFile,
    setEditGeneratedMaskFile,
    editIsMaskSaved,
    setEditIsMaskSaved,
    editOriginalImageSize,
    setEditOriginalImageSize,
    editDrawnPoints,
    setEditDrawnPoints,
    editMaskPreviewUrl,
    setEditMaskPreviewUrl,
    enableStreaming,
    setEnableStreaming,
    partialImages,
    setPartialImages
}: EditingFormProps) {
    const [firstImagePreviewUrl, setFirstImagePreviewUrl] = React.useState<string | null>(null);
    const [zoomOpen, setZoomOpen] = React.useState(false);
    const [zoomSrc, setZoomSrc] = React.useState<string | null>(null);

    const openZoom = React.useCallback((src: string) => {
        setZoomSrc(src);
        setZoomOpen(true);
    }, []);

    const isGptImage2 = editModel === 'gpt-image-2';
    const customSizeValidation = React.useMemo(
        () => editSize === 'custom' ? validateGptImage2Size(editCustomWidth, editCustomHeight) : { valid: true as const },
        [editSize, editCustomWidth, editCustomHeight]
    );
    const customSizeInvalid = editSize === 'custom' && !customSizeValidation.valid;

    const handleSetEditModel = React.useCallback((v: string) => setEditModel(v as EditingFormData['model']), [setEditModel]);
    const handleSetEditSize = React.useCallback((v: string) => setEditSize(v as EditingFormData['size']), [setEditSize]);
    const handleSetEditQuality = React.useCallback((v: string) => setEditQuality(v as EditingFormData['quality']), [setEditQuality]);
    const handleSetEditCustomWidth = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => setEditCustomWidth(parseInt(e.target.value, 10) || 0), [setEditCustomWidth]);
    const handleSetEditCustomHeight = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => setEditCustomHeight(parseInt(e.target.value, 10) || 0), [setEditCustomHeight]);
    const handleSetEnableStreaming = React.useCallback((checked: boolean | string) => setEnableStreaming(!!checked), [setEnableStreaming]);
    const handleSetPartialImages = React.useCallback((v: string) => setPartialImages(Number(v) as 1 | 2 | 3), [setPartialImages]);
    const handleSetEditN = React.useCallback((v: number[]) => setEditN(v), [setEditN]);
    const handleSetEditBrushSize = React.useCallback((v: number[]) => setEditBrushSize(v), [setEditBrushSize]);
    const handleSetEditPrompt = React.useCallback((v: string) => setEditPrompt(v), [setEditPrompt]);

    const streamingDisabled = React.useMemo(() => editN[0] > 1, [editN[0]]);
    const streamingHint = React.useMemo(() => editN[0] > 1 ? '仅在生成单张图片（n=1）时支持流式预览。' : '在图片生成过程中展示预览，提供更交互式的体验。', [editN[0]]);
    const streamLabel = React.useMemo(() => editN[0] > 1 ? 'cursor-not-allowed text-white/40' : 'cursor-pointer text-white/80', [editN[0]]);

    // Disable streaming when editN > 1 (OpenAI limitation)
    React.useEffect(() => {
        if (editN[0] > 1 && enableStreaming) {
            setEnableStreaming(false);
        }
    }, [editN, enableStreaming, setEnableStreaming]);

    // 'custom' is only valid on gpt-image-2; reset when switching to a legacy model
    React.useEffect(() => {
        if (!isGptImage2 && editSize === 'custom') {
            setEditSize('auto');
        }
    }, [isGptImage2, editSize, setEditSize]);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const visualFeedbackCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const isDrawing = React.useRef(false);
    const lastPos = React.useRef<{ x: number; y: number } | null>(null);
    const maskInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (editOriginalImageSize) {
            if (!visualFeedbackCanvasRef.current) {
                visualFeedbackCanvasRef.current = document.createElement('canvas');
            }
            visualFeedbackCanvasRef.current.width = editOriginalImageSize.width;
            visualFeedbackCanvasRef.current.height = editOriginalImageSize.height;
        }
    }, [editOriginalImageSize]);

    React.useEffect(() => {
        setEditGeneratedMaskFile(null);
        setEditIsMaskSaved(false);
        setEditOriginalImageSize(null);
        setFirstImagePreviewUrl(null);
        setEditDrawnPoints([]);
        setEditMaskPreviewUrl(null);

        if (imageFiles.length > 0 && sourceImagePreviewUrls.length > 0) {
            const img = new window.Image();
            img.onload = () => {
                setEditOriginalImageSize({ width: img.width, height: img.height });
            };
            img.src = sourceImagePreviewUrls[0];
            setFirstImagePreviewUrl(sourceImagePreviewUrls[0]);
        } else {
            setEditShowMaskEditor(false);
        }
    }, [
        imageFiles,
        sourceImagePreviewUrls,
        setEditGeneratedMaskFile,
        setEditIsMaskSaved,
        setEditOriginalImageSize,
        setEditDrawnPoints,
        setEditMaskPreviewUrl,
        setEditShowMaskEditor
    ]);

    React.useEffect(() => {
        const displayCtx = canvasRef.current?.getContext('2d');
        const displayCanvas = canvasRef.current;
        const feedbackCanvas = visualFeedbackCanvasRef.current;

        if (!displayCtx || !displayCanvas || !feedbackCanvas || !editOriginalImageSize) return;

        const feedbackCtx = feedbackCanvas.getContext('2d');
        if (!feedbackCtx) return;

        feedbackCtx.clearRect(0, 0, feedbackCanvas.width, feedbackCanvas.height);
        feedbackCtx.fillStyle = 'red';
        editDrawnPoints.forEach((point) => {
            feedbackCtx.beginPath();
            feedbackCtx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
            feedbackCtx.fill();
        });

        displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.save();
        displayCtx.globalAlpha = 0.5;
        displayCtx.drawImage(feedbackCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
        displayCtx.restore();
    }, [editDrawnPoints, editOriginalImageSize]);

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const addPoint = (x: number, y: number) => {
        setEditDrawnPoints((prevPoints) => [...prevPoints, { x, y, size: editBrushSize[0] }]);
        setEditIsMaskSaved(false);
        setEditMaskPreviewUrl(null);
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const currentPos = getMousePos(e);
        if (!currentPos) return;
        lastPos.current = currentPos;
        addPoint(currentPos.x, currentPos.y);
    };

    const drawLine = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        e.preventDefault();
        const currentPos = getMousePos(e);
        if (!currentPos || !lastPos.current) return;

        const dist = Math.hypot(currentPos.x - lastPos.current.x, currentPos.y - lastPos.current.y);
        const angle = Math.atan2(currentPos.y - lastPos.current.y, currentPos.x - lastPos.current.x);
        const step = Math.max(1, editBrushSize[0] / 4);

        for (let i = step; i < dist; i += step) {
            const x = lastPos.current.x + Math.cos(angle) * i;
            const y = lastPos.current.y + Math.sin(angle) * i;
            addPoint(x, y);
        }
        addPoint(currentPos.x, currentPos.y);

        lastPos.current = currentPos;
    };

    const drawMaskStroke = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        lastPos.current = null;
    };

    const handleClearMask = () => {
        setEditDrawnPoints([]);
        setEditGeneratedMaskFile(null);
        setEditIsMaskSaved(false);
        setEditMaskPreviewUrl(null);
    };

    const generateAndSaveMask = () => {
        if (!editOriginalImageSize || editDrawnPoints.length === 0) {
            setEditGeneratedMaskFile(null);
            setEditIsMaskSaved(false);
            setEditMaskPreviewUrl(null);
            return;
        }

        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = editOriginalImageSize.width;
        offscreenCanvas.height = editOriginalImageSize.height;
        const offscreenCtx = offscreenCanvas.getContext('2d');

        if (!offscreenCtx) return;

        offscreenCtx.fillStyle = '#000000';
        offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        offscreenCtx.globalCompositeOperation = 'destination-out';
        editDrawnPoints.forEach((point) => {
            drawMaskStroke(offscreenCtx, point.x, point.y, point.size);
        });

        try {
            const dataUrl = offscreenCanvas.toDataURL('image/png');
            setEditMaskPreviewUrl(dataUrl);
        } catch (e) {
            console.error('Error generating mask preview data URL:', e);
            setEditMaskPreviewUrl(null);
        }

        offscreenCanvas.toBlob((blob) => {
            if (blob) {
                const maskFile = new File([blob], 'generated-mask.png', { type: 'image/png' });
                setEditGeneratedMaskFile(maskFile);
                setEditIsMaskSaved(true);
            } else {
                console.error('Failed to generate mask blob.');
                setEditIsMaskSaved(false);
                setEditMaskPreviewUrl(null);
            }
        }, 'image/png');
    };

    const processImageFiles = (files: File[]) => {
        const validFiles = files.filter((f) => f.type.startsWith('image/'));
        if (validFiles.length === 0) return;

        const totalFiles = imageFiles.length + validFiles.length;
        if (totalFiles > maxImages) {
            alert(`You can only select up to ${maxImages} images.`);
            const allowed = validFiles.slice(0, maxImages - imageFiles.length);
            if (allowed.length === 0) return;
            validFiles.length = 0;
            validFiles.push(...allowed);
        }

        setImageFiles((prev) => [...prev, ...validFiles]);
        Promise.all(
            validFiles.map(
                (file) =>
                    new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    })
            )
        ).then((urls) => setSourceImagePreviewUrls((prev) => [...prev, ...urls]));
    };

    const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            processImageFiles(Array.from(event.target.files));
            event.target.value = '';
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setImageFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove));
        setSourceImagePreviewUrls((prevUrls) => prevUrls.filter((_, index) => index !== indexToRemove));
    };

    const handleMaskFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !editOriginalImageSize) {
            event.target.value = '';
            return;
        }

        if (file.type !== 'image/png') {
            alert('Invalid file type. Please upload a PNG file for the mask.');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            if (img.width !== editOriginalImageSize.width || img.height !== editOriginalImageSize.height) {
                alert(
                    `Mask dimensions (${img.width}x${img.height}) must match the source image dimensions (${editOriginalImageSize.width}x${editOriginalImageSize.height}).`
                );
                URL.revokeObjectURL(objectUrl);
                event.target.value = '';
                return;
            }

            setEditGeneratedMaskFile(file);
            setEditIsMaskSaved(true);
            setEditDrawnPoints([]);

            reader.onloadend = () => {
                setEditMaskPreviewUrl(reader.result as string);
                URL.revokeObjectURL(objectUrl);
            };
            reader.onerror = () => {
                console.error('Error reading mask file for preview.');
                setEditMaskPreviewUrl(null);
                URL.revokeObjectURL(objectUrl);
            };
            reader.readAsDataURL(file);

            event.target.value = '';
        };

        img.onerror = () => {
            alert('Failed to load the uploaded mask image to check dimensions.');
            URL.revokeObjectURL(objectUrl);
            event.target.value = '';
        };

        img.src = objectUrl;
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (imageFiles.length === 0) {
            alert('Please select at least one image to edit.');
            return;
        }
        if (editDrawnPoints.length > 0 && !editGeneratedMaskFile && !editIsMaskSaved) {
            alert('Please save the mask you have drawn before submitting.');
            return;
        }
        if (customSizeInvalid) {
            return;
        }

        const formData: EditingFormData = {
            prompt: editPrompt,
            n: editN[0],
            size: editSize,
            customWidth: editCustomWidth,
            customHeight: editCustomHeight,
            quality: editQuality,
            imageFiles: imageFiles,
            maskFile: editGeneratedMaskFile,
            model: editModel
        };
        onSubmit(formData);
    };

    const displayFileNames = (files: File[]) => {
        if (files.length === 0) return 'No file selected.';
        if (files.length === 1) return files[0].name;
        return `${files.length} files selected`;
    };

    return (
        <Card className='group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none'>
            <CardHeader className='flex items-start justify-between border-b border-white/[0.06] pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>编辑图片</CardTitle>
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
                    <CardDescription className='mt-1 text-white/60'>基于文本提示词修改现有图片。</CardDescription>
                </div>
                <ModeToggle currentMode={currentMode} onModeChange={onModeChange} />
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex h-full flex-1 flex-col overflow-hidden'>
                <CardContent className='flex-1 space-y-5 overflow-y-auto p-4'>
                    <div className='space-y-1.5'>
                        <Label htmlFor='edit-model-select' className='text-white'>
                        模型
                    </Label>
                        <div className='flex items-center gap-4'>
                            <Select value={editModel} onValueChange={handleSetEditModel}>
                                <SelectTrigger
                                    id='edit-model-select'
                                    className='w-[180px] rounded-xl border border-white/[0.08] bg-white/[0.04] text-white focus:border-violet-500/50 focus:ring-violet-500/30 focus:bg-white/[0.06] transition-all duration-200'>
                                    <SelectValue placeholder='Select model' />
                                </SelectTrigger>
                                <SelectContent className='border-white/[0.08] bg-[#12121a] text-white shadow-xl shadow-black/40'>
                                    <SelectItem value='gpt-image-2' className='focus:bg-white/10'>
                                        gpt-image-2
                                    </SelectItem>
                                    <SelectItem value='gpt-image-1.5' className='focus:bg-white/10'>
                                        gpt-image-1.5
                                    </SelectItem>
                                    <SelectItem value='gpt-image-1' className='focus:bg-white/10'>
                                        gpt-image-1
                                    </SelectItem>
                                    <SelectItem value='gpt-image-1-mini' className='focus:bg-white/10'>
                                        gpt-image-1-mini
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {isGptImage2 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className='h-4 w-4 cursor-help text-white/40 hover:text-white/60' />
                                    </TooltipTrigger>
                                    <TooltipContent className='max-w-[280px]'>
                                    gpt-image-2 始终以高保真度处理参考图片。这提升了编辑质量，但每次请求消耗的图片输入 token 比 gpt-image-1.5 默认保真度更多。
                                </TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className='flex items-center gap-2'>
                                        <Checkbox
                                            id='edit-enable-streaming'
                                            checked={enableStreaming}
                                            onCheckedChange={handleSetEnableStreaming}
                                            disabled={streamingDisabled}
                                            className='border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black disabled:cursor-not-allowed disabled:opacity-50'
                                        />
                                        <Label
                                            htmlFor='edit-enable-streaming'
                                            className={`text-sm ${streamLabel}`}>
                                    启用流式预览
                                </Label>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className='max-w-[250px]'>{streamingHint}</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {enableStreaming && (
                        <div className='space-y-3'>
                            <div className='flex items-center gap-2'>
                                <Label className='text-white'>Preview Images</Label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className='h-4 w-4 cursor-help text-white/40 hover:text-white/60' />
                                    </TooltipTrigger>
                                    <TooltipContent className='max-w-[250px]'>
                                        Each preview image adds ~$0.003 to the cost (100 additional output tokens).
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <RadioGroup
                                value={String(partialImages)}
                                onValueChange={handleSetPartialImages}
                                className='flex gap-x-5'>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='1'
                                        id='edit-partial-1'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-1' className='cursor-pointer text-white/80'>
                                        1
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='2'
                                        id='edit-partial-2'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-2' className='cursor-pointer text-white/80'>
                                        2
                                    </Label>
                                </div>
                                <div className='flex items-center space-x-2'>
                                    <RadioGroupItem
                                        value='3'
                                        id='edit-partial-3'
                                        className='border-white/40 text-white data-[state=checked]:border-white data-[state=checked]:text-white'
                                    />
                                    <Label htmlFor='edit-partial-3' className='cursor-pointer text-white/80'>
                                        3
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}

                    <div className='space-y-1.5'>
                                <Label htmlFor='edit-prompt' className='text-white'>
                        提示词
                    </Label>
                    <MemoTextarea
                        id='edit-prompt'
                        placeholder='例如，给主体人物添加一顶派对帽'
                            value={editPrompt}
                            valueSetter={setEditPrompt}
                            required
                            className='min-h-[80px] rounded-xl border border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30 focus:border-violet-500/50 focus:ring-violet-500/30 focus:bg-white/[0.06] transition-all duration-200'
                        />
                    </div>

                    <div className='space-y-2'>
                        <div className='flex items-center gap-2'>
                            <Label className='text-white'>源图片 (最多{maxImages}张)</Label>
                            <span className='text-xs text-white/30'>可全局拖拽或粘贴到页面</span>
                        </div>
                        <Label
                            htmlFor='image-files-input'
                            className='flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm transition-all duration-200 hover:bg-white/[0.08]'>
                            <span className='truncate pr-2 text-white/60'>{displayFileNames(imageFiles)}</span>
                            <span className='flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white/80 hover:bg-white/20'>
                                <Upload className='h-3 w-3' />
                                请选择文件
                            </span>
                        </Label>
                        <Input
                            id='image-files-input'
                            type='file'
                            accept='image/png, image/jpeg, image/webp'
                            multiple
                            onChange={handleImageFileChange}
                            disabled={imageFiles.length >= maxImages}
                            className='sr-only'
                        />
                        {sourceImagePreviewUrls.length > 0 && (
                            <div className='flex space-x-2 overflow-x-auto pt-2'>
                                {sourceImagePreviewUrls.map((url, index) => (
                                    <div key={url} className='relative shrink-0'>
                                        <div className='group relative cursor-pointer' onClick={() => openZoom(url)}>
                                            <Image
                                                src={url}
                                                alt={`Source preview ${index + 1}`}
                                                width={80}
                                                height={80}
                                                className='rounded border border-white/10 object-cover transition-opacity group-hover:opacity-80'
                                                unoptimized
                                            />
                                            <div className='absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100 rounded border border-white/10'>
                                                <Maximize2 className='h-5 w-5 text-white/80' />
                                            </div>
                                        </div>
                                        <Button
                                            type='button'
                                            variant='destructive'
                                            size='icon'
                                            className='absolute top-0 right-0 z-10 h-5 w-5 translate-x-1/3 -translate-y-1/3 transform rounded-full bg-red-600 p-0.5 text-white hover:bg-red-700'
                                            onClick={(e) => { e.stopPropagation(); handleRemoveImage(index); }}
                                            aria-label={`Remove image ${index + 1}`}>
                                            <X className='h-3 w-3' />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>蒙版</Label>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => setEditShowMaskEditor(!editShowMaskEditor)}
                            disabled={!editOriginalImageSize}
                            className='w-full justify-start border-white/20 px-3 text-white/80 hover:bg-white/10 hover:text-white'>
                            {editShowMaskEditor
                            ? '关闭蒙版编辑器'
                            : editGeneratedMaskFile
                              ? '编辑已保存蒙版'
                              : '创建蒙版'}
                            {editIsMaskSaved && !editShowMaskEditor && (
                                <span className='ml-auto text-xs text-green-400'>(已保存)</span>
                            )}
                            <ScanEye className='mt-0.5' />
                        </Button>

                        {editShowMaskEditor && firstImagePreviewUrl && editOriginalImageSize && (
                            <div className='space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3'>
                                    <p className='text-xs text-white/60'>
                                    在下方图片上绘制，标记需要编辑的区域 (绘制区域在蒙版中变为透明)。
                                </p>
                                <div
                                    className='relative mx-auto w-full overflow-hidden rounded border border-white/10'
                                    style={{
                                        maxWidth: `min(100%, ${editOriginalImageSize.width}px)`,
                                        aspectRatio: `${editOriginalImageSize.width} / ${editOriginalImageSize.height}`
                                    }}>
                                    <Image
                                        src={firstImagePreviewUrl}
                                        alt='Image preview for masking'
                                        width={editOriginalImageSize.width}
                                        height={editOriginalImageSize.height}
                                        className='block h-auto w-full'
                                        unoptimized
                                    />
                                    <canvas
                                        ref={canvasRef}
                                        width={editOriginalImageSize.width}
                                        height={editOriginalImageSize.height}
                                        className='absolute top-0 left-0 h-full w-full cursor-crosshair'
                                        onMouseDown={startDrawing}
                                        onMouseMove={drawLine}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={drawLine}
                                        onTouchEnd={stopDrawing}
                                    />
                                </div>
                                <div className='grid grid-cols-1 gap-4 pt-2'>
                                    <div className='space-y-2'>
                                        <Label htmlFor='brush-size-slider' className='text-sm text-white'>
                                        笔刷大小: {editBrushSize[0]}px
                                    </Label>
                                        <Slider
                                            id='brush-size-slider'
                                            min={5}
                                            max={100}
                                            step={1}
                                            value={editBrushSize}
                                            onValueChange={setEditBrushSize}
                                            className='mt-1 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                                        />
                                    </div>
                                </div>
                                <div className='flex items-center justify-between gap-2 pt-3'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => maskInputRef.current?.click()}
                                        disabled={!editOriginalImageSize}
                                        className='mr-auto border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                                        <UploadCloud className='mr-1.5 h-4 w-4' />                                         上传蒙版
                                    </Button>
                                    <Input
                                        ref={maskInputRef}
                                        id='mask-file-input'
                                        type='file'
                                        accept='image/png'
                                        onChange={handleMaskFileChange}
                                        className='sr-only'
                                    />
                                    <div className='flex gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={handleClearMask}
                                            className='border-white/20 text-white/80 hover:bg-white/10 hover:text-white'>
                                            <Eraser className='mr-1.5 h-4 w-4' /> 清除
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='default'
                                            size='sm'
                                            onClick={generateAndSaveMask}
                                            disabled={editDrawnPoints.length === 0}
                                            className='bg-white text-black hover:bg-white/90 disabled:opacity-50'>
                                            <Save className='mr-1.5 h-4 w-4' /> 保存蒙版
                                        </Button>
                                    </div>
                                </div>
                                {editMaskPreviewUrl && (
                                    <div className='mt-3 border-t border-white/10 pt-3 text-center'>
                                        <Label className='mb-1.5 block text-sm text-white'>
                                            蒙版预览:
                                        </Label>
                                        <div className='inline-block rounded border border-gray-300 bg-white p-1'>
                                            <Image
                                                src={editMaskPreviewUrl}
                                                alt='Generated mask preview'
                                                width={0}
                                                height={134}
                                                className='block max-w-full'
                                                style={{ width: 'auto', height: '134px' }}
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                )}
                                {editIsMaskSaved && !editMaskPreviewUrl && (
                                    <p className='pt-1 text-center text-xs text-yellow-400'>
                                        蒙版生成中...
                                    </p>
                                )}
                                {editIsMaskSaved && editMaskPreviewUrl && (
                                    <p className='pt-1 text-center text-xs text-green-400'>蒙版保存成功！</p>
                                )}
                            </div>
                        )}
                        {!editShowMaskEditor && editGeneratedMaskFile && (
                            <p className='pt-1 text-xs text-green-400'>已应用蒙版: {editGeneratedMaskFile.name}</p>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>尺寸</Label>
                        <RadioGroup
                            value={editSize}
                            onValueChange={handleSetEditSize}
                            className='flex flex-wrap gap-3'>
                        <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                            <RadioItemWithIcon value='auto' id='edit-size-auto' label='自动' Icon={Sparkles} />
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                                    <RadioItemWithIcon value='portrait' id='edit-size-portrait' label='纵向' Icon={RectangleVertical} />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>{getPresetTooltip('portrait', editModel)}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                                    <RadioItemWithIcon value='landscape' id='edit-size-landscape' label='横向' Icon={RectangleHorizontal} />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>{getPresetTooltip('landscape', editModel)}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                                    <RadioItemWithIcon value='square' id='edit-size-square' label='正方形' Icon={Square} />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>{getPresetTooltip('square', editModel)}</TooltipContent>
                        </Tooltip>
                        {isGptImage2 && (
                            <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                                <RadioItemWithIcon
                                    value='custom'
                                    id='edit-size-custom'
                                    label='自定义'
                                    Icon={SquareDashed}
                                />
                            </div>
                        )}
                        </RadioGroup>
                        {isGptImage2 && editSize === 'custom' && (
                            <div className='space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3'>
                                <div className='flex items-center gap-3'>
                                    <div className='flex-1 space-y-1'>
                            <Label htmlFor='edit-custom-width' className='text-xs text-white/70'>
                                    宽度 (px)
                                </Label>
                                        <Input
                                            id='edit-custom-width'
                                            type='number'
                                            min={16}
                                            max={3840}
                                            step={16}
                                            value={editCustomWidth}
                                            onChange={handleSetEditCustomWidth}
                                            className='rounded-xl border border-white/[0.08] bg-white/[0.04] text-white focus:border-violet-500/50 focus:ring-violet-500/30 focus:bg-white/[0.06] transition-all duration-200'
                                        />
                                    </div>
                                    <span className='pt-5 text-white/60'>×</span>
                                    <div className='flex-1 space-y-1'>
                                <Label htmlFor='edit-custom-height' className='text-xs text-white/70'>
                                    高度 (px)
                                </Label>
                                        <Input
                                            id='edit-custom-height'
                                            type='number'
                                            min={16}
                                            max={3840}
                                            step={16}
                                            value={editCustomHeight}
                                            onChange={handleSetEditCustomHeight}
                                            className='rounded-xl border border-white/[0.08] bg-white/[0.04] text-white focus:border-violet-500/50 focus:ring-violet-500/30 focus:bg-white/[0.06] transition-all duration-200'
                                        />
                                    </div>
                                </div>
                        <p className='text-xs text-white/50'>
                            {(editCustomWidth * editCustomHeight).toLocaleString()} 像素 (
                            {((editCustomWidth * editCustomHeight) / 8_294_400 * 100).toFixed(1)}% 最大值) ·{' '}
                            {editCustomWidth > 0 && editCustomHeight > 0
                                ? `${(Math.max(editCustomWidth, editCustomHeight) / Math.min(editCustomWidth, editCustomHeight)).toFixed(2)}:1 比例`
                                : '—'}
                        </p>
                                {!customSizeValidation.valid && (
                                    <p className='text-xs text-red-400'>{customSizeValidation.reason}</p>
                                )}
                        <p className='text-xs text-white/40'>
                            限制: 16 的倍数，边长最大 3840px，宽高比 ≤ 3:1，总像素 655,360 至 8,294,400。
                        </p>
                            </div>
                        )}
                    </div>

                    <div className='space-y-3'>
                        <Label className='block text-white'>质量</Label>
                        <RadioGroup
                            value={editQuality}
                            onValueChange={handleSetEditQuality}
                            className='flex flex-wrap gap-3'>
                        <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                            <RadioItemWithIcon value='auto' id='edit-quality-auto' label='自动' Icon={Sparkles} />
                        </div>
                        <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                            <RadioItemWithIcon value='low' id='edit-quality-low' label='低' Icon={Tally1} />
                        </div>
                        <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                            <RadioItemWithIcon value='medium' id='edit-quality-medium' label='中' Icon={Tally2} />
                        </div>
                        <div className='rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all hover:bg-white/[0.06]'>
                            <RadioItemWithIcon value='high' id='edit-quality-high' label='高' Icon={Tally3} />
                        </div>
                        </RadioGroup>
                    </div>

                    <div className='space-y-2'>
                        <Label htmlFor='edit-n-slider' className='text-white'>
                    图片数量: {editN[0]}
                </Label>
                        <Slider
                            id='edit-n-slider'
                            min={1}
                            max={10}
                            step={1}
                            value={editN}
                            onValueChange={setEditN}
                            className='mt-3 [&>button]:border-black [&>button]:bg-white [&>button]:ring-offset-black [&>span:first-child]:h-1 [&>span:first-child>span]:bg-white'
                        />
                    </div>
                </CardContent>
                <CardFooter className='border-t border-white/[0.06] p-4'>
                    <Button
                        type='submit'
                        disabled={!editPrompt || imageFiles.length === 0 || customSizeInvalid}
                        className='group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-lg shadow-violet-600/20 transition-all duration-200 hover:shadow-violet-600/40 hover:brightness-110 disabled:from-white/10 disabled:to-white/10 disabled:shadow-none disabled:text-white/40'>
                        开始编辑
                    </Button>
                </CardFooter>
            </form>

            <ZoomViewer src={zoomSrc} open={zoomOpen} onClose={() => { setZoomOpen(false); setZoomSrc(null); }} />
        </Card>
    );
}

export const EditingForm = React.memo(EditingFormBase) as typeof EditingFormBase;
