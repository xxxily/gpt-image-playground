'use client';

import { MemoTextarea } from '@/components/memoized-textarea';
import { useNotice } from '@/components/notice-provider';
import { PromptTemplatesDialog } from '@/components/prompt-templates-dialog';
import { ShareDialog } from '@/components/share-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ZoomViewer } from '@/components/zoom-viewer';
import type { GptImageModel } from '@/lib/cost-utils';
import type { AppConfig } from '@/lib/config';
import { DEFAULT_PROMPT_TEMPLATE_CATEGORIES, DEFAULT_PROMPT_TEMPLATES } from '@/lib/default-prompt-templates';
import { getImageModel, getProviderLabel, isImageModelId, type StoredCustomImageModel } from '@/lib/model-registry';
import {
    DEFAULT_SEEDREAM_ADVANCED_OPTIONS,
    SEEDREAM_RESPONSE_FORMAT_OPTIONS,
    SENSENOVA_SIZE_OPTIONS,
    buildSeedreamProviderOptions,
    getSeedreamCapabilityFlags,
    getSeedreamSizeOptions,
    type SeedreamOptimizePromptMode,
    type SeedreamOutputFormat,
    type SeedreamResponseFormat,
    type SeedreamSequentialImageGeneration
} from '@/lib/provider-advanced-options';
import { mergeProviderOptions, parseProviderOptionsJson, type ProviderOptions } from '@/lib/provider-options';
import { getProviderInstance, getProviderInstanceModelDefinitions, type ProviderInstance } from '@/lib/provider-instances';
import { getPromptPolishErrorMessage, polishPrompt } from '@/lib/prompt-polish';
import {
    addPromptHistory,
    clearPromptHistory,
    loadPromptHistory,
    normalizePromptHistoryLimit,
    removePromptHistory,
    type PromptHistoryEntry
} from '@/lib/prompt-history';
import { loadUserPromptTemplates } from '@/lib/prompt-template-storage';
import { getPresetTooltip, validateGptImage2Size } from '@/lib/size-utils';
import type { SizePreset } from '@/lib/size-utils';
import { cn } from '@/lib/utils';
import {
    PROMPT_POLISH_PRESETS,
    DEFAULT_POLISHING_PRESET_ID,
    POLISH_PICKER_TOKEN_DEFAULT,
    POLISH_PICKER_TOKEN_TEMPORARY,
    normalizePolishPickerOrder,
    getPolishPresetById,
    normalizePromptPolishPresetId
} from '@/lib/prompt-polish-core';
import type { PromptTemplateWithSource } from '@/types/prompt-template';
import {
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
    Maximize2,
    FileImage,
    BrickWall,
    ShieldCheck,
    ShieldAlert,
    History,
    SlidersHorizontal,
    Search,
    Trash2
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

export type EditingFormData = {
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
    imageFiles: File[];
    maskFile: File | null;
    model: GptImageModel;
    providerInstanceId: string;
    providerOptions?: ProviderOptions;
};

type EditingFormProps = {
    onSubmit: (data: EditingFormData) => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    editModel: EditingFormData['model'];
    setEditModel: React.Dispatch<React.SetStateAction<EditingFormData['model']>>;
    providerInstanceId: string;
    setProviderInstanceId: React.Dispatch<React.SetStateAction<string>>;
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
    outputFormat: EditingFormData['output_format'];
    setOutputFormat: React.Dispatch<React.SetStateAction<EditingFormData['output_format']>>;
    compression: number[];
    setCompression: React.Dispatch<React.SetStateAction<number[]>>;
    background: EditingFormData['background'];
    setBackground: React.Dispatch<React.SetStateAction<EditingFormData['background']>>;
    moderation: EditingFormData['moderation'];
    setModeration: React.Dispatch<React.SetStateAction<EditingFormData['moderation']>>;
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
    promptHistoryLimit: number;
    customImageModels?: StoredCustomImageModel[];
    appConfig: AppConfig;
    clientDirectLinkPriority: boolean;
    shareApiKey: string;
    shareApiBaseUrl: string;
    shareProviderInstanceId: string;
    shareProviderLabel: string;
};

type SlashCommandState = {
    triggerStart: number;
    query: string;
    activeIndex: number;
};

const SUBMIT_COOLDOWN_MS = 1000;
const PROVIDER_SIZE_DEFAULT_VALUE = '__model-default__';

function formatPromptHistoryTime(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    const formatter = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

    if (diffMs < minuteMs) return '刚刚';
    if (diffMs < hourMs) return formatter.format(-Math.floor(diffMs / minuteMs), 'minute');
    if (diffMs < dayMs) return formatter.format(-Math.floor(diffMs / hourMs), 'hour');
    return formatter.format(-Math.floor(diffMs / dayMs), 'day');
}

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
                className='border-border text-primary data-[state=checked]:border-primary data-[state=checked]:text-primary'
            />
            <Label htmlFor={id} className='flex cursor-pointer items-center gap-2 text-base text-foreground/80'>
                <Icon className='h-5 w-5 text-muted-foreground' />
                {label}
            </Label>
        </div>
    );
});

function EditingFormBase({
    onSubmit,
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
    outputFormat,
    setOutputFormat,
    compression,
    setCompression,
    background,
    setBackground,
    moderation,
    setModeration,
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
    setPartialImages,
    promptHistoryLimit,
    customImageModels = [],
    appConfig,
    providerInstanceId,
    setProviderInstanceId,
    clientDirectLinkPriority,
    shareApiKey,
    shareApiBaseUrl,
    shareProviderInstanceId,
    shareProviderLabel
}: EditingFormProps) {
    const { addNotice } = useNotice();
    const [firstImagePreviewUrl, setFirstImagePreviewUrl] = React.useState<string | null>(null);
    const [zoomOpen, setZoomOpen] = React.useState(false);
    const [zoomSrc, setZoomSrc] = React.useState<string | null>(null);
    const [zoomIndex, setZoomIndex] = React.useState(0);
    const [advancedOptionsOpen, setAdvancedOptionsOpen] = React.useState(false);
    const [providerOptionsJson, setProviderOptionsJson] = React.useState('');
    const [seedreamSize, setSeedreamSize] = React.useState<string>('');
    const [sensenovaSize, setSensenovaSize] = React.useState<string>('');
    const [seedreamResponseFormat, setSeedreamResponseFormat] = React.useState<SeedreamResponseFormat>(DEFAULT_SEEDREAM_ADVANCED_OPTIONS.responseFormat);
    const [seedreamWatermark, setSeedreamWatermark] = React.useState(DEFAULT_SEEDREAM_ADVANCED_OPTIONS.watermark);
    const [seedreamSequentialGeneration, setSeedreamSequentialGeneration] = React.useState<SeedreamSequentialImageGeneration>(DEFAULT_SEEDREAM_ADVANCED_OPTIONS.sequentialImageGeneration);
    const [seedreamMaxImages, setSeedreamMaxImages] = React.useState(DEFAULT_SEEDREAM_ADVANCED_OPTIONS.maxImages);
    const [seedreamSeed, setSeedreamSeed] = React.useState('');
    const [seedreamGuidanceScale, setSeedreamGuidanceScale] = React.useState('');
    const [seedreamOutputFormat, setSeedreamOutputFormat] = React.useState<SeedreamOutputFormat>('jpeg');
    const [seedreamOptimizePromptMode, setSeedreamOptimizePromptMode] = React.useState<SeedreamOptimizePromptMode>('standard');
    const [seedreamWebSearch, setSeedreamWebSearch] = React.useState(false);
    const [slashCommand, setSlashCommand] = React.useState<SlashCommandState | null>(null);
    const [historyPickerOpen, setHistoryPickerOpen] = React.useState(false);
    const [historySearchQuery, setHistorySearchQuery] = React.useState('');
    const [promptHistory, setPromptHistory] = React.useState<PromptHistoryEntry[]>([]);
    const [isPolishingPrompt, setIsPolishingPrompt] = React.useState(false);
    const [promptPolishError, setPromptPolishError] = React.useState<string | null>(null);
    const [polishPickerOpen, setPolishPickerOpen] = React.useState(false);
    const [polishSearchQuery, setPolishSearchQuery] = React.useState('');
    const [polishCustomMode, setPolishCustomMode] = React.useState(false);
    const [polishCustomPrompt, setPolishCustomPrompt] = React.useState('');
    const [isSubmitCoolingDown, setIsSubmitCoolingDown] = React.useState(false);
    const [configSummaryFits, setConfigSummaryFits] = React.useState(false);
    const [quickUserTemplates, setQuickUserTemplates] = React.useState<PromptTemplateWithSource[]>([]);
    const promptTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const promptControlsRef = React.useRef<HTMLDivElement>(null);
    const promptToolbarRef = React.useRef<HTMLDivElement>(null);
    const configSummaryMeasureRef = React.useRef<HTMLSpanElement>(null);
    const submitCooldownRef = React.useRef(false);
    const submitCooldownTimerRef = React.useRef<number | null>(null);
    const promptPolishAbortRef = React.useRef<AbortController | null>(null);
    const slashCommandListId = React.useId();
    const promptHistoryListId = React.useId();
    const promptHistoryPickerRef = React.useRef<HTMLDivElement>(null);
    const slashCommandListRef = React.useRef<HTMLDivElement>(null);
    const polishPickerRef = React.useRef<HTMLDivElement>(null);

    const openZoom = React.useCallback((src: string, index?: number) => {
        setZoomSrc(src);
        setZoomIndex(index ?? 0);
        setZoomOpen(true);
    }, []);

    const zoomImageList = React.useMemo(
        () => sourceImagePreviewUrls.map((url, i) => ({ src: url, filename: imageFiles[i]?.name })),
        [sourceImagePreviewUrls, imageFiles],
    );

    const modelDefinition = getImageModel(editModel, customImageModels);
    const selectedProvider = modelDefinition.provider;
    const selectedProviderInstance = React.useMemo(
        () => getProviderInstance(appConfig.providerInstances, selectedProvider, providerInstanceId || appConfig.selectedProviderInstanceId),
        [appConfig.providerInstances, appConfig.selectedProviderInstanceId, providerInstanceId, selectedProvider]
    );
    const providerModelOptions = React.useMemo(
        () => getProviderInstanceModelDefinitions(selectedProviderInstance, customImageModels),
        [customImageModels, selectedProviderInstance]
    );
    const seedreamCapabilities = React.useMemo(() => getSeedreamCapabilityFlags(editModel), [editModel]);
    const seedreamSizeOptions = React.useMemo(() => getSeedreamSizeOptions(editModel), [editModel]);
    const normalizedPromptHistoryLimit = React.useMemo(
        () => normalizePromptHistoryLimit(promptHistoryLimit),
        [promptHistoryLimit]
    );
    const hasSourceImages = imageFiles.length > 0;
    const showGenerationOptions = !hasSourceImages;
    const showCustomSizeInput = modelDefinition.supportsCustomSize && selectedProvider !== 'seedream' && selectedProvider !== 'sensenova';
    const showQualityControls = modelDefinition.supportsQuality;
    const showOutputFormatControls = showGenerationOptions && modelDefinition.supportsOutputFormat;
    const showBackgroundControls = showGenerationOptions && modelDefinition.supportsBackground;
    const showModerationControls = showGenerationOptions && modelDefinition.supportsModeration;
    const showGenericSizeControls = selectedProvider !== 'seedream' && selectedProvider !== 'sensenova';
    const showCompression = showGenerationOptions && modelDefinition.supportsCompression && (outputFormat === 'jpeg' || outputFormat === 'webp');
    const advancedSizeSummary = selectedProvider === 'seedream'
        ? seedreamSize || modelDefinition.defaultSize || '模型默认'
        : selectedProvider === 'sensenova'
          ? sensenovaSize || modelDefinition.defaultSize || '模型默认'
          : editSize === 'custom'
            ? `${editCustomWidth}×${editCustomHeight}`
            : editSize;
    const modeUnsupportedMessage = hasSourceImages && !modelDefinition.supportsEditing
        ? `${modelDefinition.label} 暂不支持图片编辑，请切换到支持编辑的模型或移除源图片后生成。`
        : null;
    const maskUnsupportedMessage = hasSourceImages && modelDefinition.supportsEditing && !modelDefinition.supportsMask
        ? `${modelDefinition.label} 支持参考图编辑，但不支持蒙版参数；已保存的蒙版不会随请求发送。`
        : null;
    const title = hasSourceImages ? '编辑图片' : '生成图片';
    const submitLabel = hasSourceImages ? '开始编辑' : '开始生成';
    const quickTemplates = React.useMemo<PromptTemplateWithSource[]>(
        () => [
            ...DEFAULT_PROMPT_TEMPLATES.map((template) => ({ ...template, source: 'default' as const })),
            ...quickUserTemplates
        ],
        [quickUserTemplates]
    );
    const templateCategoryNameById = React.useMemo(() => {
        const map = new Map<string, string>();
        DEFAULT_PROMPT_TEMPLATE_CATEGORIES.forEach((category) => map.set(category.id, category.name));
        map.set('custom', '我的模板');
        return map;
    }, []);
    const slashCommandMatches = React.useMemo(() => {
        if (!slashCommand) return [];

        const query = slashCommand.query.trim().toLocaleLowerCase();
        return quickTemplates
            .filter((template) => {
                const categoryName = templateCategoryNameById.get(template.categoryId) || template.categoryId;
                const searchableText =
                    `${template.name} ${template.description || ''} ${template.prompt} ${categoryName}`.toLocaleLowerCase();
                return searchableText.includes(query);
            })
            .slice(0, 8);
    }, [quickTemplates, slashCommand, templateCategoryNameById]);
    const promptHistoryMatches = React.useMemo(() => {
        const query = historySearchQuery.trim().toLocaleLowerCase();
        const source = query
            ? promptHistory.filter((entry) => entry.prompt.toLocaleLowerCase().includes(query))
            : promptHistory;

        return source.slice(0, normalizedPromptHistoryLimit);
    }, [historySearchQuery, normalizedPromptHistoryLimit, promptHistory]);
    const configuredPolishPresetId = React.useMemo(
        () => normalizePromptPolishPresetId(appConfig.polishingPresetId),
        [appConfig.polishingPresetId]
    );
    const configuredPolishPreset = React.useMemo(
        () => getPolishPresetById(configuredPolishPresetId),
        [configuredPolishPresetId]
    );
    const activeSlashTemplate = slashCommandMatches[slashCommand?.activeIndex ?? 0];
    const customSizeValidation = React.useMemo(
        () =>
            editSize === 'custom' ? validateGptImage2Size(editCustomWidth, editCustomHeight) : { valid: true as const },
        [editSize, editCustomWidth, editCustomHeight]
    );
    const customSizeInvalid = editSize === 'custom' && !customSizeValidation.valid;
    const providerOptionsValidation = React.useMemo(
        () => parseProviderOptionsJson(providerOptionsJson),
        [providerOptionsJson]
    );
    const providerOptionsInvalid = providerOptionsValidation.valid === false;
    const configSummaryNeedsAttention = customSizeInvalid || providerOptionsInvalid;
    const configSummaryText = `${selectedProviderInstance.name} / ${modelDefinition.label} · ${advancedSizeSummary} · ${editQuality} · ${editN[0]} 张`;
    const configSummaryFullText = configSummaryNeedsAttention ? `${configSummaryText} · 需修正` : configSummaryText;
    const structuredProviderOptions = React.useMemo<ProviderOptions>(() => {
        if (selectedProvider === 'seedream') {
            const parsedSeed = seedreamSeed.trim() ? Number(seedreamSeed) : null;
            const parsedGuidanceScale = seedreamGuidanceScale.trim() ? Number(seedreamGuidanceScale) : null;
            return buildSeedreamProviderOptions(editModel, {
                size: seedreamSize || null,
                responseFormat: seedreamResponseFormat,
                watermark: seedreamWatermark,
                sequentialImageGeneration: seedreamSequentialGeneration,
                maxImages: seedreamMaxImages,
                seed: Number.isFinite(parsedSeed) ? parsedSeed : null,
                guidanceScale: Number.isFinite(parsedGuidanceScale) ? parsedGuidanceScale : null,
                outputFormat: seedreamOutputFormat,
                optimizePromptMode: seedreamOptimizePromptMode,
                webSearch: seedreamWebSearch
            });
        }
        if (selectedProvider === 'sensenova' && sensenovaSize) {
            return { size: sensenovaSize };
        }
        return {};
    }, [editModel, selectedProvider, seedreamGuidanceScale, seedreamMaxImages, seedreamOptimizePromptMode, seedreamOutputFormat, seedreamResponseFormat, seedreamSeed, seedreamSequentialGeneration, seedreamSize, seedreamWatermark, seedreamWebSearch, sensenovaSize]);
    const effectiveProviderOptions = React.useMemo<ProviderOptions>(() => (
        providerOptionsValidation.valid
            ? mergeProviderOptions(structuredProviderOptions, providerOptionsValidation.value)
            : structuredProviderOptions
    ), [providerOptionsValidation, structuredProviderOptions]);

    const handleSetEditModel = React.useCallback(
        (v: string) => {
            if (isImageModelId(v)) setEditModel(v);
        },
        [setEditModel]
    );
    React.useEffect(() => {
        if (selectedProviderInstance.id !== providerInstanceId) {
            setProviderInstanceId(selectedProviderInstance.id);
        }
    }, [providerInstanceId, selectedProviderInstance.id, setProviderInstanceId]);

    React.useEffect(() => {
        if (providerModelOptions.length === 0) return;
        if (providerModelOptions.some((option) => option.id === editModel)) return;
        setEditModel(providerModelOptions[0].id);
    }, [editModel, providerModelOptions, setEditModel]);

    const handleSetProviderInstance = React.useCallback(
        (value: string) => {
            const instance = appConfig.providerInstances.find((item): item is ProviderInstance => item.id === value);
            if (!instance) return;
            setProviderInstanceId(instance.id);
            const models = getProviderInstanceModelDefinitions(instance, customImageModels);
            if (models.length > 0 && !models.some((option) => option.id === editModel)) {
                setEditModel(models[0].id);
            }
        },
        [appConfig.providerInstances, customImageModels, editModel, setEditModel, setProviderInstanceId]
    );
    const handleSetSeedreamSize = React.useCallback((value: string) => {
        setSeedreamSize(value === PROVIDER_SIZE_DEFAULT_VALUE ? '' : value);
    }, []);
    const handleSetSensenovaSize = React.useCallback((value: string) => {
        setSensenovaSize(value === PROVIDER_SIZE_DEFAULT_VALUE ? '' : value);
    }, []);
    const handleSetSeedreamResponseFormat = React.useCallback(
        (value: string) => {
            if (value === 'url' || value === 'b64_json') setSeedreamResponseFormat(value);
        },
        []
    );
    const handleSetSeedreamSequentialGeneration = React.useCallback(
        (value: string) => {
            if (value === 'disabled' || value === 'auto') setSeedreamSequentialGeneration(value);
        },
        []
    );
    const handleSetSeedreamOutputFormat = React.useCallback(
        (value: string) => {
            if (value === 'png' || value === 'jpeg') setSeedreamOutputFormat(value);
        },
        []
    );
    const handleSetSeedreamOptimizePromptMode = React.useCallback(
        (value: string) => {
            if (value === 'standard' || value === 'fast') setSeedreamOptimizePromptMode(value);
        },
        []
    );
    const handleSetEditSize = React.useCallback(
        (v: string) => setEditSize(v as EditingFormData['size']),
        [setEditSize]
    );
    const handleSetEditQuality = React.useCallback(
        (v: string) => setEditQuality(v as EditingFormData['quality']),
        [setEditQuality]
    );
    const handleSetOutputFormat = React.useCallback(
        (v: string) => setOutputFormat(v as EditingFormData['output_format']),
        [setOutputFormat]
    );
    const handleSetBackground = React.useCallback(
        (v: string) => setBackground(v as EditingFormData['background']),
        [setBackground]
    );
    const handleSetModeration = React.useCallback(
        (v: string) => setModeration(v as EditingFormData['moderation']),
        [setModeration]
    );
    const handleSetEditCustomWidth = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setEditCustomWidth(parseInt(e.target.value, 10) || 0),
        [setEditCustomWidth]
    );
    const handleSetEditCustomHeight = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setEditCustomHeight(parseInt(e.target.value, 10) || 0),
        [setEditCustomHeight]
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
    const refreshQuickUserTemplates = React.useCallback(() => {
        setQuickUserTemplates(loadUserPromptTemplates());
    }, []);
    const refreshPromptHistory = React.useCallback(() => {
        setPromptHistory(loadPromptHistory().slice(0, normalizedPromptHistoryLimit));
    }, [normalizedPromptHistoryLimit]);

    const startSubmitCooldown = React.useCallback(() => {
        submitCooldownRef.current = true;
        setIsSubmitCoolingDown(true);

        if (submitCooldownTimerRef.current !== null) {
            window.clearTimeout(submitCooldownTimerRef.current);
        }

        submitCooldownTimerRef.current = window.setTimeout(() => {
            submitCooldownRef.current = false;
            setIsSubmitCoolingDown(false);
            submitCooldownTimerRef.current = null;
        }, SUBMIT_COOLDOWN_MS);
    }, []);

    const stopSubmitCooldown = React.useCallback(() => {
        submitCooldownRef.current = false;
        setIsSubmitCoolingDown(false);

        if (submitCooldownTimerRef.current !== null) {
            window.clearTimeout(submitCooldownTimerRef.current);
            submitCooldownTimerRef.current = null;
        }
    }, []);

    const focusPromptAt = React.useCallback((cursorPosition?: number) => {
        const textarea = promptTextareaRef.current;
        if (!textarea) return;

        requestAnimationFrame(() => {
            textarea.focus();
            if (typeof cursorPosition === 'number') {
                textarea.setSelectionRange(cursorPosition, cursorPosition);
            }
        });
    }, []);

    const handleClearPrompt = React.useCallback(() => {
        if (!editPrompt.trim()) return;

        setEditPrompt('');
        setSlashCommand(null);
        setHistoryPickerOpen(false);
        setPolishPickerOpen(false);
        setPolishCustomMode(false);
        setPromptPolishError(null);
        focusPromptAt(0);
    }, [editPrompt, focusPromptAt, setEditPrompt]);

    const handlePolishPrompt = React.useCallback(async (systemPrompt?: string) => {
        const trimmedPrompt = editPrompt.trim();
        if (!trimmedPrompt || isPolishingPrompt) return;

        promptPolishAbortRef.current?.abort();
        const abortController = new AbortController();
        promptPolishAbortRef.current = abortController;

        setIsPolishingPrompt(true);
        setPromptPolishError(null);
        setPolishPickerOpen(false);
        setSlashCommand(null);
        setHistoryPickerOpen(false);

        try {
            const result = await polishPrompt({
                prompt: trimmedPrompt,
                systemPrompt,
                config: appConfig,
                clientDirectLinkPriority,
                passwordHash: clientPasswordHash,
                signal: abortController.signal
            });
            setEditPrompt(result.polishedPrompt);
            focusPromptAt(result.polishedPrompt.length);
        } catch (error) {
            if (abortController.signal.aborted) return;
            setPromptPolishError(getPromptPolishErrorMessage(error));
        } finally {
            if (promptPolishAbortRef.current === abortController) {
                promptPolishAbortRef.current = null;
            }
            if (!abortController.signal.aborted) {
                setIsPolishingPrompt(false);
            }
        }
    }, [appConfig, clientDirectLinkPriority, clientPasswordHash, editPrompt, focusPromptAt, isPolishingPrompt, setEditPrompt]);

    const handleOpenPromptHistory = React.useCallback(() => {
        refreshPromptHistory();
        setHistorySearchQuery('');
        setSlashCommand(null);
        setPolishPickerOpen(false);
        setAdvancedOptionsOpen(false);
        setHistoryPickerOpen((value) => !value);
    }, [refreshPromptHistory]);

    const handleOpenAdvancedOptions = React.useCallback(() => {
        setHistoryPickerOpen(false);
        setPolishPickerOpen(false);
        setPolishCustomMode(false);
        setSlashCommand(null);
        setAdvancedOptionsOpen(true);
    }, []);

    const handleApplyPromptHistory = React.useCallback(
        (entry: PromptHistoryEntry) => {
            setEditPrompt(entry.prompt);
            setHistoryPickerOpen(false);
            setSlashCommand(null);
            focusPromptAt(entry.prompt.length);
        },
        [focusPromptAt, setEditPrompt]
    );

    const handleRemovePromptHistory = React.useCallback(
        (prompt: string) => {
            setPromptHistory(removePromptHistory(prompt).slice(0, normalizedPromptHistoryLimit));
        },
        [normalizedPromptHistoryLimit]
    );

    const handleClearPromptHistory = React.useCallback(() => {
        clearPromptHistory();
        setPromptHistory([]);
        setHistorySearchQuery('');
    }, []);

    const handleOpenPolishPicker = React.useCallback(() => {
        setPolishSearchQuery('');
        setPolishCustomMode(false);
        setPolishCustomPrompt('');
        setHistoryPickerOpen(false);
        setAdvancedOptionsOpen(false);
        setSlashCommand(null);
        setPolishPickerOpen((v) => !v);
    }, []);

    const polishPickerItems = React.useMemo(() => {
        const order = normalizePolishPickerOrder(
            appConfig.polishPickerOrder,
            new Set(appConfig.polishingCustomPrompts.map((prompt) => prompt.id))
        );
        const query = polishSearchQuery.trim().toLocaleLowerCase();

        const matches = (text: string) => {
            if (!query) return true;
            return text.toLocaleLowerCase().includes(query);
        };

        const items: Array<{
            token: string;
            type: 'default' | 'custom' | 'preset' | 'temporary';
            label: string;
            description: string;
            id: string;
        }> = [];

        for (const token of order) {
            if (token === POLISH_PICKER_TOKEN_DEFAULT) {
                const preset = getPolishPresetById(configuredPolishPresetId) || getPolishPresetById(DEFAULT_POLISHING_PRESET_ID) || PROMPT_POLISH_PRESETS[0];
                const text = `使用默认内置 ${preset.label} ${preset.description}`;
                if (matches(text)) {
                    items.push({ token, type: 'default', label: `使用默认内置：${preset.label}`, description: preset.description, id: token });
                }
            } else if (token === POLISH_PICKER_TOKEN_TEMPORARY) {
                if (matches('临时自定义')) {
                    items.push({ token, type: 'temporary', label: '临时自定义润色提示词', description: '仅本次润色生效，不会保存', id: token });
                }
            } else {
                const savedPrompt = appConfig.polishingCustomPrompts.find((p) => p.id === token);
                const builtInPreset = PROMPT_POLISH_PRESETS.find((p) => p.id === token);
                if (savedPrompt) {
                    const text = `${savedPrompt.name} ${savedPrompt.systemPrompt}`;
                    if (matches(text)) {
                        items.push({ token, type: 'custom', label: savedPrompt.name, description: savedPrompt.systemPrompt.slice(0, 80), id: token });
                    }
                } else if (builtInPreset) {
                    const text = `${builtInPreset.label} ${builtInPreset.description} ${builtInPreset.category}`;
                    if (matches(text)) {
                        items.push({ token, type: 'preset', label: builtInPreset.label, description: builtInPreset.description, id: token });
                    }
                }
            }
        }

        return items;
    }, [appConfig.polishPickerOrder, appConfig.polishingCustomPrompts, configuredPolishPresetId, polishSearchQuery]);

    const handleUsePolishDefault = React.useCallback(() => {
        setPolishPickerOpen(false);
        if (configuredPolishPreset) {
            handlePolishPrompt(configuredPolishPreset.systemPrompt);
            return;
        }
        handlePolishPrompt();
    }, [configuredPolishPreset, handlePolishPrompt]);

    const handleSelectSavedCustomPolishPrompt = React.useCallback((token: string) => {
        const savedPrompt = appConfig.polishingCustomPrompts.find((p) => p.id === token);
        if (!savedPrompt) return;
        setPolishPickerOpen(false);
        handlePolishPrompt(savedPrompt.systemPrompt);
    }, [appConfig.polishingCustomPrompts, handlePolishPrompt]);

    const handleSelectPolishPreset = React.useCallback(
        (presetId: string) => {
            const preset = getPolishPresetById(presetId);
            if (!preset) return;
            setPolishPickerOpen(false);
            handlePolishPrompt(preset.systemPrompt);
        },
        [handlePolishPrompt]
    );

    const handleEnterPolishCustomMode = React.useCallback(() => {
        setPolishCustomMode(true);
        setPolishCustomPrompt('');
    }, []);

    const handleApplyPolishCustom = React.useCallback(() => {
        if (!polishCustomPrompt.trim()) {
            setPolishCustomMode(false);
            return;
        }
        const systemPrompt = polishCustomPrompt.trim();
        setPolishPickerOpen(false);
        handlePolishPrompt(systemPrompt);
    }, [polishCustomPrompt, handlePolishPrompt]);

    const detectSlashCommand = React.useCallback((value: string, cursorPosition: number): SlashCommandState | null => {
        const beforeCursor = value.slice(0, cursorPosition);
        const tokenStart =
            Math.max(beforeCursor.lastIndexOf(' '), beforeCursor.lastIndexOf('\n'), beforeCursor.lastIndexOf('\t')) + 1;
        const token = beforeCursor.slice(tokenStart);

        if (!token.startsWith('/') || token.includes('\n')) return null;

        return {
            triggerStart: tokenStart,
            query: token.slice(1),
            activeIndex: 0
        };
    }, []);

    const syncSlashCommand = React.useCallback(
        (textarea: HTMLTextAreaElement) => {
            const nextCommand = detectSlashCommand(textarea.value, textarea.selectionStart);
            if (nextCommand) {
                if (quickUserTemplates.length === 0) {
                    refreshQuickUserTemplates();
                }
            }
            setSlashCommand(nextCommand);
        },
        [detectSlashCommand, quickUserTemplates.length, refreshQuickUserTemplates]
    );

    const insertTextAtPromptCursor = React.useCallback(
        (text: string) => {
            const textarea = promptTextareaRef.current;
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const nextPrompt = `${editPrompt.slice(0, start)}${text}${editPrompt.slice(end)}`;
            const nextCursorPosition = start + text.length;

            setEditPrompt(nextPrompt);
            setSlashCommand({ triggerStart: start, query: '', activeIndex: 0 });
            refreshQuickUserTemplates();

            requestAnimationFrame(() => {
                textarea.focus();
                textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
            });
        },
        [editPrompt, refreshQuickUserTemplates, setEditPrompt]
    );

    const handleOpenPromptSearch = React.useCallback(() => {
        setHistoryPickerOpen(false);
        setPolishPickerOpen(false);
        if (slashCommand) {
            focusPromptAt();
            return;
        }
        insertTextAtPromptCursor('/');
    }, [focusPromptAt, insertTextAtPromptCursor, slashCommand]);

    const applySlashTemplate = React.useCallback(
        (template: PromptTemplateWithSource) => {
            const textarea = promptTextareaRef.current;
            if (!textarea || !slashCommand) return;

            const selectionEnd = textarea.selectionStart;
            const nextPrompt = `${editPrompt.slice(0, slashCommand.triggerStart)}${template.prompt}${editPrompt.slice(selectionEnd)}`;
            const nextCursorPosition = slashCommand.triggerStart + template.prompt.length;

            setEditPrompt(nextPrompt);
            setSlashCommand(null);

            requestAnimationFrame(() => {
                textarea.focus();
                textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
            });
        },
        [editPrompt, setEditPrompt, slashCommand]
    );

    const handlePromptChange = React.useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            if (promptPolishError) setPromptPolishError(null);
            syncSlashCommand(event.currentTarget);
        },
        [promptPolishError, syncSlashCommand]
    );

    const handlePromptSelect = React.useCallback(
        (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
            setHistoryPickerOpen(false);
            setPolishPickerOpen(false);
            setPolishCustomMode(false);
            if (historyPickerOpen || polishPickerOpen || slashCommand) {
                setSlashCommand(null);
                return;
            }
            syncSlashCommand(event.currentTarget);
        },
        [historyPickerOpen, polishPickerOpen, slashCommand, syncSlashCommand]
    );

    const handlePromptKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if ((event.ctrlKey || event.metaKey) && event.key === '/') {
                event.preventDefault();
                insertTextAtPromptCursor('/');
                return;
            }

            if (slashCommand) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    setSlashCommand(null);
                    return;
                }

                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    if (slashCommandMatches.length > 0) {
                        setSlashCommand((current) =>
                            current
                                ? {
                                      ...current,
                                      activeIndex: (current.activeIndex + 1) % slashCommandMatches.length
                                  }
                                : null
                        );
                    }
                    return;
                }

                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (slashCommandMatches.length > 0) {
                        setSlashCommand((current) =>
                            current
                                ? {
                                      ...current,
                                      activeIndex:
                                          (current.activeIndex - 1 + slashCommandMatches.length) %
                                          slashCommandMatches.length
                                  }
                                : null
                        );
                    }
                    return;
                }

                if (event.key === 'Enter') {
                    if (activeSlashTemplate) {
                        event.preventDefault();
                        applySlashTemplate(activeSlashTemplate);
                    }
                    return;
                }
            }

            if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || event.nativeEvent.isComposing) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
        },
        [activeSlashTemplate, applySlashTemplate, insertTextAtPromptCursor, slashCommand, slashCommandMatches.length]
    );
    const editImageCount = editN[0];

    const streamingDisabled = React.useMemo(() => editImageCount > 1 || !modelDefinition.supportsStreaming, [editImageCount, modelDefinition.supportsStreaming]);
    const streamingHint = React.useMemo(
        () =>
            !modelDefinition.supportsStreaming
                ? `${modelDefinition.providerLabel} 的当前模型暂不支持流式预览。`
                : editImageCount > 1
                ? '仅在生成单张图片（n=1）时支持流式预览。'
                : '在图片生成过程中展示预览，提供更交互式的体验。',
        [editImageCount, modelDefinition.providerLabel, modelDefinition.supportsStreaming]
    );
    const streamLabel = React.useMemo(
        () => (streamingDisabled ? 'cursor-not-allowed text-muted-foreground/60' : 'cursor-pointer text-foreground/80'),
        [streamingDisabled]
    );
    const promptToolbarIconOnlyButton =
        'h-9 w-9 min-w-0 cursor-pointer rounded-md p-0 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent active:scale-[0.98] sm:h-8 sm:w-auto sm:px-2.5 sm:text-xs disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-45';
    const promptToolbarNeutralButton = `${promptToolbarIconOnlyButton} text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 sm:text-slate-700 sm:hover:bg-slate-100 sm:hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15`;

    React.useEffect(() => {
        const container = promptControlsRef.current;
        const measure = configSummaryMeasureRef.current;
        if (!container || !measure) {
            setConfigSummaryFits(false);
            return;
        }

        const updateFit = () => {
            if (window.innerWidth < 640) {
                setConfigSummaryFits(false);
                return;
            }

            setConfigSummaryFits(measure.scrollWidth <= container.clientWidth);
        };

        updateFit();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateFit);
            return () => window.removeEventListener('resize', updateFit);
        }

        const resizeObserver = new ResizeObserver(updateFit);
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [configSummaryFullText]);

    React.useEffect(() => {
        refreshQuickUserTemplates();
    }, [refreshQuickUserTemplates]);

    React.useEffect(() => {
        refreshPromptHistory();
    }, [refreshPromptHistory]);

    React.useEffect(() => {
        return () => {
            if (submitCooldownTimerRef.current !== null) {
                window.clearTimeout(submitCooldownTimerRef.current);
            }
            promptPolishAbortRef.current?.abort();
        };
    }, []);

    React.useEffect(() => {
        if (!historyPickerOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (promptHistoryPickerRef.current?.contains(target)) return;
            if (promptToolbarRef.current?.contains(target)) return;
            setHistoryPickerOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setHistoryPickerOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [historyPickerOpen]);

    React.useEffect(() => {
        if (!polishPickerOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (polishPickerRef.current?.contains(target)) return;
            if (promptToolbarRef.current?.contains(target)) return;
            setPolishPickerOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPolishPickerOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [polishPickerOpen]);

    React.useEffect(() => {
        if (!slashCommand) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (slashCommandListRef.current?.contains(target)) return;
            if (promptToolbarRef.current?.contains(target)) return;
            setSlashCommand(null);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSlashCommand(null);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [slashCommand]);

    React.useEffect(() => {
        if (!slashCommand || slashCommandMatches.length === 0 || slashCommand.activeIndex < slashCommandMatches.length)
            return;
        setSlashCommand((current) => (current ? { ...current, activeIndex: 0 } : null));
    }, [slashCommand, slashCommandMatches.length]);

    // Auto-scroll active template option into view when navigating with arrow keys
    React.useEffect(() => {
        if (!slashCommand) return;
        const activeOption = document.getElementById(`${slashCommandListId}-option-${slashCommand.activeIndex}`);
        activeOption?.scrollIntoView({ block: 'nearest' });
    }, [slashCommand, slashCommandListId]);

    // Disable streaming when editN > 1 (OpenAI limitation)
    React.useEffect(() => {
        if (streamingDisabled && enableStreaming) {
            setEnableStreaming(false);
        }
    }, [streamingDisabled, enableStreaming, setEnableStreaming]);

    // 'custom' is only valid for models that expose custom WxH input in this form.
    React.useEffect(() => {
        if (!showCustomSizeInput && editSize === 'custom') {
            setEditSize('auto');
        }
    }, [showCustomSizeInput, editSize, setEditSize]);

    React.useEffect(() => {
        if (!modelDefinition.supportsBackground && background === 'transparent') {
            setBackground('auto');
        }
    }, [modelDefinition.supportsBackground, background, setBackground]);

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
            addNotice(`最多只能选择 ${maxImages} 张图片。`, 'warning');
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
            addNotice('遮罩文件格式无效，请上传 PNG 文件。', 'warning');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            if (img.width !== editOriginalImageSize.width || img.height !== editOriginalImageSize.height) {
                addNotice(`遮罩尺寸 ${img.width}x${img.height} 必须与源图片尺寸 ${editOriginalImageSize.width}x${editOriginalImageSize.height} 一致。`, 'warning');
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
            addNotice('无法读取上传的遮罩图片尺寸。', 'error');
            URL.revokeObjectURL(objectUrl);
            event.target.value = '';
        };

        img.src = objectUrl;
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitCooldownRef.current) {
            return;
        }
        const trimmedPrompt = editPrompt.trim();
        if (!trimmedPrompt) {
            return;
        }
        if (modeUnsupportedMessage) {
            return;
        }
        if (hasSourceImages && modelDefinition.supportsMask && editDrawnPoints.length > 0 && !editGeneratedMaskFile && !editIsMaskSaved) {
            addNotice('提交前请先保存已绘制的遮罩。', 'warning');
            return;
        }
        if (customSizeInvalid) {
            return;
        }
        if (providerOptionsValidation.valid === false) {
            return;
        }

        startSubmitCooldown();

        const formData: EditingFormData = {
            prompt: trimmedPrompt,
            n: editImageCount,
            size: editSize,
            customWidth: editCustomWidth,
            customHeight: editCustomHeight,
            quality: editQuality,
            output_format: outputFormat,
            background,
            moderation,
            imageFiles: imageFiles,
            maskFile: modelDefinition.supportsMask ? editGeneratedMaskFile : null,
            model: editModel,
            providerInstanceId: selectedProviderInstance.id,
            providerOptions: Object.keys(effectiveProviderOptions).length > 0 ? effectiveProviderOptions : undefined
        };
        if (showCompression) {
            formData.output_compression = compression[0];
        }

        try {
            onSubmit(formData);
            setPromptHistory(addPromptHistory(trimmedPrompt, normalizedPromptHistoryLimit));
            setHistoryPickerOpen(false);
        } catch (error) {
            stopSubmitCooldown();
            throw error;
        }
    };

    const displayFileNames = (files: File[]) => {
        if (files.length === 0) return null;
        if (files.length === 1) return files[0].name;
        return `已选择 ${files.length} 张源图片`;
    };

    return (
        <Card className='app-panel-card group flex h-full w-full flex-col overflow-hidden rounded-2xl border backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent'>
            <CardHeader className='flex items-start justify-between border-b border-white/[0.06] pb-4'>
                <div>
                    <div className='flex items-center'>
                        <CardTitle className='py-1 text-lg font-medium text-white'>{title}</CardTitle>
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
                </div>
            </CardHeader>
            <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col lg:h-full lg:overflow-hidden'>
                <CardContent className='space-y-5 p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto'>
                    <div className='space-y-2'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <Label htmlFor='edit-prompt' className='text-white'>
                                提示词
                            </Label>
                            <div className='flex items-center gap-2'>
                                <span className='text-xs text-white/35'>Ctrl/⌘ + Enter 提交</span>
                                <PromptTemplatesDialog
                                    currentPrompt={editPrompt}
                                    onApplyTemplate={setEditPrompt}
                                    triggerClassName={promptToolbarNeutralButton}
                                />
                            </div>
                        </div>
                        <div ref={promptControlsRef} className='relative'>
                            <MemoTextarea
                                ref={promptTextareaRef}
                                id='edit-prompt'
                                placeholder={
                                    hasSourceImages
                                        ? '例如，给主体人物添加一顶派对帽，或输入 / 搜索提示词模板'
                                        : '例如，一位在太空中漂浮的宇航员，写实风格，或输入 / 搜索提示词模板'
                                }
                                value={editPrompt}
                                valueSetter={setEditPrompt}
                                required
                                role='combobox'
                                aria-autocomplete='list'
                                aria-expanded={slashCommand ? true : undefined}
                                aria-controls={slashCommand ? slashCommandListId : undefined}
                                aria-activedescendant={
                                    slashCommand && activeSlashTemplate
                                        ? `${slashCommandListId}-option-${slashCommand.activeIndex}`
                                        : undefined
                                }
                                onChange={handlePromptChange}
                                onSelect={handlePromptSelect}
                                onClick={handlePromptSelect}
                                onKeyDown={handlePromptKeyDown}
                                className='min-h-[208px] rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-900 dark:text-white transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-slate-400 dark:placeholder:text-white/15 focus:border-violet-500/50 focus:bg-white/[0.06] focus:ring-violet-500/30'
                            />
                            <div
                                ref={promptToolbarRef}
                                role='toolbar'
                                aria-label='提示词快捷操作'
                                className='mt-2 flex items-center justify-end gap-1'>
                                <div className='flex items-center gap-1'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleClearPrompt}
                                        disabled={!editPrompt.trim()}
                                        className={cn(
                                            promptToolbarIconOnlyButton,
                                            editPrompt.trim()
                                                ? 'border border-violet-200/80 bg-violet-50 text-violet-700 shadow-sm shadow-violet-500/10 hover:bg-violet-100 hover:text-violet-800 active:bg-violet-200 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-100 dark:shadow-none dark:hover:bg-violet-500/20 dark:hover:text-white dark:active:bg-violet-500/30'
                                                : 'cursor-not-allowed text-slate-400 hover:bg-transparent hover:text-slate-400 dark:text-white/25 dark:hover:text-white/25'
                                        )}
                                        aria-label='清空提示词'
                                        title='清空提示词'>
                                        <X className='h-3 w-3' aria-hidden='true' />
                                        <span className='sr-only sm:not-sr-only sm:ml-1 sm:inline'>清空</span>
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleOpenPolishPicker}
                                        disabled={!editPrompt.trim() || isPolishingPrompt}
                                        className={cn(
                                            promptToolbarIconOnlyButton,
                                            editPrompt.trim() && !isPolishingPrompt
                                                ? 'border border-sky-200/70 bg-sky-50 text-sky-700 shadow-sm shadow-sky-500/10 hover:bg-sky-100 hover:text-sky-800 active:bg-sky-200 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-100 dark:shadow-none dark:hover:bg-sky-500/20 dark:hover:text-white dark:active:bg-sky-500/30'
                                                : 'cursor-not-allowed text-slate-400 hover:bg-transparent hover:text-slate-400 dark:text-white/25 dark:hover:text-white/25'
                                        )}
                                        aria-busy={isPolishingPrompt}
                                        aria-label={isPolishingPrompt ? '正在润色提示词' : '打开润色预设选择器'}
                                        title={isPolishingPrompt ? '正在润色提示词' : '润色提示词'}>
                                        <Sparkles className='h-3 w-3' aria-hidden='true' />
                                        <span className='sr-only sm:not-sr-only sm:ml-1 sm:inline'>{isPolishingPrompt ? '润色中' : '润色'}</span>
                                    </Button>
                                    <ShareDialog
                                        currentPrompt={editPrompt}
                                        currentModel={editModel}
                                        apiKey={shareApiKey}
                                        apiBaseUrl={shareApiBaseUrl}
                                        providerInstanceId={shareProviderInstanceId}
                                        providerLabel={shareProviderLabel}
                                        triggerClassName={cn(
                                            promptToolbarIconOnlyButton,
                                            'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 sm:text-slate-700 sm:hover:bg-slate-100 sm:hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15'
                                        )}
                                    />
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleOpenPromptSearch}
                                        className={cn(promptToolbarIconOnlyButton, 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 sm:text-slate-700 sm:hover:bg-slate-100 sm:hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15')}
                                        aria-label='搜索提示词模板'
                                        title='搜索提示词模板'>
                                        <Search className='h-3 w-3' aria-hidden='true' />
                                        <span className='sr-only sm:not-sr-only sm:ml-1 sm:inline'>模板</span>
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleOpenPromptHistory}
                                        className={cn(
                                            promptToolbarIconOnlyButton,
                                            historyPickerOpen
                                                ? 'bg-violet-500/10 text-violet-700 hover:bg-violet-500/15 active:bg-violet-500/20 dark:bg-violet-500/20 dark:text-white dark:hover:bg-violet-500/25 dark:active:bg-violet-500/30'
                                                : promptHistory.length > 0
                                                   ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15'
                                                   : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/75 dark:active:bg-white/12'
                                        )}
                                        aria-expanded={historyPickerOpen}
                                        aria-haspopup='dialog'
                                        aria-controls={historyPickerOpen ? promptHistoryListId : undefined}
                                        aria-label='打开提示词历史'
                                        title='提示词历史'>
                                        <History className='h-3 w-3' aria-hidden='true' />
                                        <span className='sr-only sm:not-sr-only sm:ml-1 sm:inline'>历史</span>
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleOpenAdvancedOptions}
                                        className={cn(
                                            promptToolbarIconOnlyButton,
                                            advancedOptionsOpen
                                                ? 'bg-violet-500/10 text-violet-700 hover:bg-violet-500/15 active:bg-violet-500/20 dark:bg-violet-500/20 dark:text-white dark:hover:bg-violet-500/25 dark:active:bg-violet-500/30'
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15'
                                        )}
                                        aria-expanded={advancedOptionsOpen}
                                        aria-haspopup='dialog'
                                        aria-controls={advancedOptionsOpen ? 'advanced-image-options' : undefined}
                                        aria-label='打开高级选项'
                                        title='高级选项'>
                                        <SlidersHorizontal className='h-3 w-3' aria-hidden='true' />
                                        <span className='sr-only sm:not-sr-only sm:ml-1 sm:inline'>高级</span>
                                    </Button>
                                </div>
                            </div>
                            <span
                                ref={configSummaryMeasureRef}
                                className='pointer-events-none invisible absolute max-w-none whitespace-nowrap text-[11px] font-medium'
                                aria-hidden='true'>
                                {configSummaryFullText}
                            </span>
                            {configSummaryFits && (
                                <button
                                    type='button'
                                    onClick={handleOpenAdvancedOptions}
                                    className='mt-2 hidden max-w-full items-center gap-1.5 whitespace-nowrap text-left text-[11px] font-medium text-white/38 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45 sm:ml-auto sm:flex'
                                    aria-label={`当前配置：${configSummaryText}${configSummaryNeedsAttention ? '，需修正' : ''}。点击打开高级选项`}
                                    title='打开高级选项'>
                                    <span>{configSummaryText}</span>
                                    {configSummaryNeedsAttention && <span className='text-red-300'>需修正</span>}
                                </button>
                            )}
                            {configSummaryNeedsAttention && !advancedOptionsOpen && (
                                <p className='mt-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-100/90' role='alert'>
                                    自定义参数无效，请打开高级选项修改后再提交。
                                </p>
                            )}
                            {promptPolishError && (
                                <p
                                    role='alert'
                                    className='mt-2 break-words rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100/90'>
                                    {promptPolishError}
                                </p>
                            )}
                            {historyPickerOpen && (
                                <div
                                    ref={promptHistoryPickerRef}
                                    id={promptHistoryListId}
                                    role='dialog'
                                    aria-label='提示词历史'
                                    className='absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-violet-400/20 dark:bg-[#11111b]/95 dark:shadow-black/50'>
                                    <div className='border-b border-slate-200 p-2.5 dark:border-white/[0.08]'>
                                        <div className='relative'>
                                            <Search
                                                className='pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-violet-500 dark:text-violet-200/60'
                                                aria-hidden='true'
                                            />
                                            <Input
                                                value={historySearchQuery}
                                                onChange={(event) => setHistorySearchQuery(event.target.value)}
                                                placeholder='搜索最近使用的提示词…'
                                                aria-label='搜索提示词历史'
                                                autoComplete='off'
                                                className='h-8 rounded-lg border-slate-200 bg-white pl-8 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30'
                                            />
                                        </div>
                                    </div>
                                    {promptHistoryMatches.length > 0 ? (
                                        <div className='max-h-72 overflow-y-auto p-1.5'>
                                            {promptHistoryMatches.map((entry) => (
                                                <div
                                                    key={`${entry.timestamp}-${entry.prompt}`}
                                                    className='group flex items-start gap-2 rounded-xl border border-transparent px-2 py-1.5 text-slate-700 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950 dark:text-white/70 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.06] dark:hover:text-white'>
                                                    <button
                                                        type='button'
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            handleApplyPromptHistory(entry);
                                                        }}
                                                        className='flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1 py-0.5 text-left focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none'>
                                                        <History
                                                            className='mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-200/65'
                                                            aria-hidden='true'
                                                        />
                                                        <span className='min-w-0 flex-1'>
                                                            <span className='line-clamp-2 text-sm leading-5'>
                                                                {entry.prompt}
                                                            </span>
                                                            <span className='mt-1 block text-[11px] text-slate-500 dark:text-white/38'>
                                                                {formatPromptHistoryTime(entry.timestamp)}
                                                            </span>
                                                        </span>
                                                    </button>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon'
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            handleRemovePromptHistory(entry.prompt);
                                                        }}
                                                        className='h-7 w-7 shrink-0 rounded-md text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 dark:text-white/30 dark:hover:bg-red-500/10 dark:hover:text-red-200'
                                                        aria-label='删除这条提示词历史'
                                                        title='删除这条历史'>
                                                        <Trash2 className='h-3.5 w-3.5' aria-hidden='true' />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className='px-4 py-5 text-center text-sm text-slate-500 dark:text-white/45'>
                                            提交一次提示词后，这里会显示最近使用记录。
                                        </div>
                                    )}
                                    {promptHistory.length > 0 && (
                                        <div className='flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2 dark:border-white/[0.08]'>
                                            <p className='text-xs text-slate-500 dark:text-white/35'>
                                                最多保留 {normalizedPromptHistoryLimit} 条，可在系统设置修改。
                                            </p>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={handleClearPromptHistory}
                                                className='h-7 rounded-md px-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-white/45 dark:hover:bg-red-500/10 dark:hover:text-red-200'>
                                                清空历史
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {slashCommand && (
                                <div
                                    ref={slashCommandListRef}
                                    id={slashCommandListId}
                                    role='listbox'
                                    aria-label='提示词模板快捷命令'
                                    className='absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-violet-400/20 dark:bg-[#11111b]/95 dark:shadow-black/50'>
                                    <div className='flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-white/[0.08] dark:text-white/45'>
                                        <Search className='h-3.5 w-3.5 text-violet-500 dark:text-violet-200/70' />
                                        <span>输入 / 搜索模板，↑↓ 选择，Enter 快速填入，Esc 关闭</span>
                                    </div>
                                    {slashCommandMatches.length > 0 ? (
                                        <div className='max-h-72 overflow-y-auto p-1.5'>
                                            {slashCommandMatches.map((template, index) => {
                                                const selected = index === slashCommand.activeIndex;
                                                const categoryName =
                                                    templateCategoryNameById.get(template.categoryId) ||
                                                    template.categoryId;
                                                return (
                                                    <button
                                                        key={`${template.source}:${template.id}`}
                                                        id={`${slashCommandListId}-option-${index}`}
                                                        type='button'
                                                        role='option'
                                                        aria-selected={selected}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            applySlashTemplate(template);
                                                        }}
                                                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${selected ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-400/40 dark:bg-violet-500/18 dark:text-white' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950 dark:text-white/70 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.06] dark:hover:text-white'}`}>
                                                        <div className='flex items-start justify-between gap-3'>
                                                            <div className='min-w-0'>
                                                                <p className='truncate text-sm font-medium'>
                                                                    {template.name}
                                                                </p>
                                                                <p className='mt-0.5 truncate text-xs text-slate-500 dark:text-white/40'>
                                                                    {categoryName}
                                                                </p>
                                                            </div>
                                                            <span
                                                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${template.source === 'default' ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/20 dark:text-violet-100 dark:ring-violet-300/25' : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-300/25'}`}>
                                                                {template.source === 'default' ? '预置' : '自定义'}
                                                            </span>
                                                        </div>
                                                        <p className='mt-1 line-clamp-1 text-xs leading-5 text-slate-500 dark:text-white/45'>
                                                            {template.prompt}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className='px-4 py-5 text-center text-sm text-slate-500 dark:text-white/45'>
                                            没有匹配的模板，继续输入可直接作为提示词。
                                        </div>
                                    )}
                                </div>
                            )}
                            {polishPickerOpen && (
                                <div
                                    ref={polishPickerRef}
                                    role='dialog'
                                    aria-label='润色预设选择'
                                    className='absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-violet-400/20 dark:bg-[#11111b]/95 dark:shadow-black/50'>
                                    <div className='border-b border-slate-200 p-2.5 dark:border-white/[0.08]'>
                                        <div className='relative'>
                                            <Search
                                                className='pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-violet-500 dark:text-violet-200/60'
                                                aria-hidden='true'
                                            />
                                            <Input
                                                value={polishSearchQuery}
                                                onChange={(event) => setPolishSearchQuery(event.target.value)}
                                                placeholder='搜索润色预设…'
                                                aria-label='搜索润色预设'
                                                autoComplete='off'
                                                className='h-8 rounded-lg border-slate-200 bg-white pl-8 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-violet-500/50 focus-visible:ring-violet-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30'
                                            />
                                        </div>
                                    </div>
                                    {!polishCustomMode && polishPickerItems.length === 0 && (
                                        <div className='px-4 py-5 text-center text-sm text-slate-500 dark:text-white/45'>
                                            没有匹配的润色预设。
                                        </div>
                                    )}
                                    {!polishCustomMode && polishPickerItems.length > 0 && (
                                        <div className='max-h-72 overflow-y-auto p-1.5'>
                                            {polishPickerItems.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type='button'
                                                    onMouseDown={(event) => {
                                                        event.preventDefault();
                                                        if (item.type === 'default') {
                                                            handleUsePolishDefault();
                                                        } else if (item.type === 'custom') {
                                                            handleSelectSavedCustomPolishPrompt(item.token);
                                                        } else if (item.type === 'preset') {
                                                            handleSelectPolishPreset(item.token);
                                                        } else if (item.type === 'temporary') {
                                                            handleEnterPolishCustomMode();
                                                        }
                                                    }}
                                                    className='group flex w-full flex-col rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:outline-none dark:hover:border-white/[0.08] dark:hover:bg-white/[0.06]'>
                                                    <div className='flex items-start justify-between gap-2'>
                                                        <div className='min-w-0'>
                                                            <p className='text-sm font-medium text-slate-800 group-hover:text-slate-950 dark:text-white/85 dark:group-hover:text-white'>
                                                                {item.label}
                                                            </p>
                                                            <p className='mt-0.5 text-xs text-slate-500 dark:text-white/40'>
                                                                {item.description}
                                                            </p>
                                                        </div>
                                                        <span
                                                            className={cn(
                                                                'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                                                                item.type === 'default' && 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/20 dark:text-violet-100 dark:ring-violet-300/25',
                                                                item.type === 'custom' && 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-300/25',
                                                                item.type === 'preset' && 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:ring-sky-300/25',
                                                                item.type === 'temporary' && 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-300/25'
                                                            )}>
                                                            {item.type === 'default' ? '默认' : ''}
                                                            {item.type === 'custom' ? '自定义' : ''}
                                                            {item.type === 'preset' ? '内置' : ''}
                                                            {item.type === 'temporary' ? '临时' : ''}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {polishCustomMode && (
                                        <div className='p-3'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <div>
                                                    <p className='text-sm font-medium text-slate-700 dark:text-white/70'>临时自定义润色系统提示词</p>
                                                    <p className='mt-0.5 text-xs text-slate-500 dark:text-white/40'>仅本次润色使用，不会保存或覆盖系统设置。</p>
                                                </div>
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        setPolishCustomMode(false);
                                                        setPolishCustomPrompt('');
                                                    }}
                                                    className='rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/[0.06] dark:hover:text-white/60'>
                                                    返回预设
                                                </button>
                                            </div>
                                            <textarea
                                                value={polishCustomPrompt}
                                                onChange={(event) => setPolishCustomPrompt(event.target.value)}
                                                placeholder='输入本次润色的系统提示词…'
                                                aria-label='自定义润色系统提示词'
                                                className='mt-2 min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-violet-500/50 focus-visible:ring-1 focus-visible:ring-violet-500/20 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30'
                                            />
                                            <div className='mt-2 flex gap-2'>
                                                <button
                                                    type='button'
                                                    onClick={handleApplyPolishCustom}
                                                    disabled={!polishCustomPrompt.trim()}
                                                    aria-label='使用临时自定义提示词润色，仅本次生效'
                                                    className='h-8 rounded-lg border border-violet-300 bg-violet-600 px-3 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-violet-400/40 dark:bg-violet-500/20 dark:text-violet-200 dark:hover:bg-violet-500/30'>
                                                    润色
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className='space-y-3'>
                        <div className='flex items-center gap-2'>
                            <Label className='text-white'>源图片 (最多{maxImages}张)</Label>
                        </div>
                        <Input
                            id='image-files-input'
                            type='file'
                            accept='image/png, image/jpeg, image/webp'
                            multiple
                            onChange={handleImageFileChange}
                            disabled={imageFiles.length >= maxImages}
                            className='sr-only'
                        />
                        <div className='flex gap-3 overflow-x-auto py-1.5'>
                            {sourceImagePreviewUrls.map((url, index) => (
                                <div key={`${url}-${index}`} className='relative h-24 w-24 shrink-0 sm:h-28 sm:w-28'>
                                    <button
                                        type='button'
                                        className='group relative h-full w-full cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-all duration-200 hover:border-white/[0.12] hover:shadow-lg hover:shadow-violet-500/5 focus:ring-2 focus:ring-violet-500/50 focus:outline-none'
                                        onClick={() => openZoom(url, index)}
                                        aria-label={`查看源图片 ${index + 1}`}>
                                        <Image
                                            src={url}
                                            alt={`源图片预览 ${index + 1}`}
                                            fill
                                            sizes='112px'
                                            className='object-cover transition-transform duration-200 group-hover:scale-[1.02]'
                                            unoptimized
                                        />
                                        <div className='absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100'>
                                            <Maximize2 className='h-6 w-6 text-white/85' />
                                        </div>
                                    </button>
                                    <Button
                                        type='button'
                                        variant='destructive'
                                        size='icon'
                                        className='absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-red-600/90 p-0 text-white shadow-lg shadow-black/30 hover:bg-red-600'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveImage(index);
                                        }}
                                        aria-label={`移除源图片 ${index + 1}`}>
                                        <X className='h-3.5 w-3.5' />
                                    </Button>
                                </div>
                            ))}
                            {imageFiles.length < maxImages ? (
                                <Label
                                    htmlFor='image-files-input'
                                    className='group flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.14] bg-white/[0.03] p-3 text-center transition-all duration-200 focus-within:ring-2 focus-within:ring-violet-500/50 hover:border-violet-400/45 hover:bg-violet-500/10 sm:h-28 sm:w-28'>
                                    <span className='flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors duration-200 group-hover:bg-violet-500/25 group-hover:text-white'>
                                        <UploadCloud className='h-5 w-5' />
                                    </span>
                                    <span className='text-xs font-medium text-white/80'>
                                        {imageFiles.length > 0 ? '继续添加' : '添加原图'}
                                    </span>
                                    <span className='text-[11px] leading-4 text-white/40'>
                                        {imageFiles.length}/{maxImages} · PNG/JPEG/WebP
                                    </span>
                                </Label>
                            ) : (
                                <div
                                    aria-disabled='true'
                                    className='flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-center opacity-60 sm:h-28 sm:w-28'>
                                    <span className='flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/50'>
                                        <UploadCloud className='h-5 w-5' />
                                    </span>
                                    <span className='text-xs font-medium text-white/60'>已达上限</span>
                                    <span className='text-[11px] leading-4 text-white/35'>
                                        {imageFiles.length}/{maxImages}
                                    </span>
                                </div>
                            )}
                        </div>
                        {displayFileNames(imageFiles) && (
                            <p className='text-xs text-white/35'>{displayFileNames(imageFiles)}</p>
                        )}
                    </div>

                    <Dialog open={advancedOptionsOpen} onOpenChange={setAdvancedOptionsOpen}>
                        <DialogContent className='flex h-dvh max-h-dvh w-screen max-w-none flex-col overflow-hidden overscroll-contain rounded-none border-border bg-background p-0 text-foreground shadow-xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(760px,calc(100vw-2rem))] sm:max-w-[760px] sm:rounded-2xl'>
                            <DialogHeader className='border-b border-border bg-card/70 px-5 py-4 pr-12 sm:px-6'>
                                <DialogTitle className='text-left text-xl font-semibold text-foreground'>高级选项</DialogTitle>
                                <DialogDescription className='sr-only'>配置供应商、模型与图片生成参数。</DialogDescription>
                            </DialogHeader>
                            <div id='advanced-image-options' className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6'>
                                <div className='space-y-2'>
                                    <div className='grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]'>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='edit-provider-select' className='text-foreground'>供应商</Label>
                                            <Select value={selectedProviderInstance.id} onValueChange={handleSetProviderInstance}>
                                                <SelectTrigger
                                                    id='edit-provider-select'
                                                    className='w-full rounded-xl border-border bg-background text-foreground transition-[color,box-shadow,border-color] duration-200 focus:border-ring focus:ring-ring/30'>
                                                    <SelectValue placeholder='选择供应商' />
                                                </SelectTrigger>
                                                <SelectContent className='border-border bg-popover text-popover-foreground shadow-xl'>
                                                    {appConfig.providerInstances.map((instance, index) => {
                                                        const models = getProviderInstanceModelDefinitions(instance, customImageModels);
                                                        return (
                                                            <React.Fragment key={instance.id}>
                                                                {index > 0 && <SelectSeparator />}
                                                                <SelectGroup>
                                                                    <SelectLabel>{instance.isDefault ? `${getProviderLabel(instance.type)} · 默认` : getProviderLabel(instance.type)}</SelectLabel>
                                                                    <SelectItem value={instance.id}>
                                                                        {instance.name}
                                                                        <span className='ml-2 text-xs text-muted-foreground'>{models.length} 个模型</span>
                                                                    </SelectItem>
                                                                </SelectGroup>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='edit-model-select' className='text-foreground'>模型</Label>
                                            <Select value={editModel} onValueChange={handleSetEditModel}>
                                                <SelectTrigger
                                                    id='edit-model-select'
                                                    className='w-full rounded-xl border-border bg-background text-foreground transition-[color,box-shadow,border-color] duration-200 focus:border-ring focus:ring-ring/30'>
                                                    <SelectValue placeholder='选择模型' />
                                                </SelectTrigger>
                                                <SelectContent className='border-border bg-popover text-popover-foreground shadow-xl'>
                                                    {providerModelOptions.map((option) => (
                                                        <SelectItem
                                                            key={option.id}
                                                            value={option.id}>
                                                            {option.label}
                                                            {option.custom && <span className='ml-2 text-xs text-muted-foreground'>自定义</span>}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className='rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-xs text-violet-950/85 dark:text-violet-100/85'>
                                        当前使用 <span className='font-medium text-violet-950 dark:text-white'>{selectedProviderInstance.name}</span> 的 API Key/Base URL；高级参数仍按 <span className='font-medium text-violet-950 dark:text-white'>{modelDefinition.providerLabel}</span> 能力显示。
                                    </div>
                                    {modeUnsupportedMessage && (
                                        <div className='rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100'>
                                            {modeUnsupportedMessage}
                                        </div>
                                    )}
                                    {maskUnsupportedMessage && (
                                        <div className='rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 text-xs leading-5 text-sky-900 dark:text-sky-100'>
                                            {maskUnsupportedMessage}
                                        </div>
                                    )}
                                    <div className='flex flex-wrap items-center gap-4'>
                                        {modelDefinition.id === 'gpt-image-2' && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className='h-4 w-4 cursor-help text-muted-foreground hover:text-foreground/70' />
                                                </TooltipTrigger>
                                                <TooltipContent className='max-w-[280px]'>
                                                    {hasSourceImages
                                                        ? 'gpt-image-2 始终以高保真度处理参考图片。这提升了编辑质量，但每次请求消耗的图片输入 token 比 gpt-image-1.5 默认保真度更多。'
                                                        : 'gpt-image-2 支持更灵活的生成尺寸与质量控制。'}
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
                                                        className='border-border disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground'
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
                                            <Label className='text-foreground'>Preview Images</Label>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <HelpCircle className='h-4 w-4 cursor-help text-muted-foreground hover:text-foreground/70' />
                                                </TooltipTrigger>
                                                <TooltipContent className='max-w-[250px]'>
                                                    Each preview image adds ~$0.003 to the cost (100 additional output
                                                    tokens).
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        <RadioGroup
                                            value={String(partialImages)}
                                            onValueChange={handleSetPartialImages}
                                            className='flex gap-x-5'>
                                            {[1, 2, 3].map((value) => (
                                                <div key={value} className='flex items-center space-x-2'>
                                                    <RadioGroupItem
                                                        value={String(value)}
                                                        id={`edit-partial-${value}`}
                                                        className='border-border text-primary data-[state=checked]:border-primary data-[state=checked]:text-primary'
                                                    />
                                                    <Label
                                                        htmlFor={`edit-partial-${value}`}
                                                        className='cursor-pointer text-foreground/80'>
                                                        {value}
                                                    </Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    </div>
                                )}

                                {hasSourceImages && modelDefinition.supportsMask && (
                                    <div className='space-y-3'>
                                        <Label className='block text-foreground'>蒙版</Label>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() => setEditShowMaskEditor(!editShowMaskEditor)}
                                            disabled={!editOriginalImageSize}
                                            className='w-full justify-start border-border px-3 text-foreground/80 hover:bg-accent hover:text-foreground'>
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
                                            <div className='space-y-3 rounded-xl border border-border bg-muted/30 p-3'>
                                                <p className='text-xs text-muted-foreground'>
                                                    在下方图片上绘制，标记需要编辑的区域 (绘制区域在蒙版中变为透明)。
                                                </p>
                                                <div
                                                    className='relative mx-auto w-full overflow-hidden rounded border border-border'
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
                                                <div className='space-y-2 pt-2'>
                                                    <Label htmlFor='brush-size-slider' className='text-sm text-foreground'>
                                                        笔刷大小: {editBrushSize[0]}px
                                                    </Label>
                                                    <Slider
                                                        id='brush-size-slider'
                                                        min={5}
                                                        max={100}
                                                        step={1}
                                                        value={editBrushSize}
                                                        onValueChange={setEditBrushSize}
                                                        className='mt-1'
                                                    />
                                                </div>
                                                <div className='flex items-center justify-between gap-2 pt-3'>
                                                    <Button
                                                        type='button'
                                                        variant='outline'
                                                        size='sm'
                                                        onClick={() => maskInputRef.current?.click()}
                                                        disabled={!editOriginalImageSize}
                                                        className='mr-auto border-border text-foreground/80 hover:bg-accent hover:text-foreground'>
                                                        <UploadCloud className='mr-1.5 h-4 w-4' /> 上传蒙版
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
                                                            className='border-border text-foreground/80 hover:bg-accent hover:text-foreground'>
                                                            <Eraser className='mr-1.5 h-4 w-4' /> 清除
                                                        </Button>
                                                        <Button
                                                            type='button'
                                                            variant='default'
                                                            size='sm'
                                                            onClick={generateAndSaveMask}
                                                            disabled={editDrawnPoints.length === 0}
                                                            className='bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'>
                                                            <Save className='mr-1.5 h-4 w-4' /> 保存蒙版
                                                        </Button>
                                                    </div>
                                                </div>
                                                {editMaskPreviewUrl && (
                                                    <div className='mt-3 border-t border-border pt-3 text-center'>
                                                        <Label className='mb-1.5 block text-sm text-foreground'>
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
                                                        蒙版生成中…
                                                    </p>
                                                )}
                                                {editIsMaskSaved && editMaskPreviewUrl && (
                                                    <p className='pt-1 text-center text-xs text-green-400'>
                                                        蒙版保存成功！
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {!editShowMaskEditor && editGeneratedMaskFile && (
                                            <p className='pt-1 text-xs text-green-400'>
                                                已应用蒙版: {editGeneratedMaskFile.name}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {showGenericSizeControls && (
                                    <div className='space-y-3'>
                                        <Label className='block text-foreground'>尺寸</Label>
                                        <RadioGroup
                                            value={editSize}
                                            onValueChange={handleSetEditSize}
                                            className='flex flex-wrap gap-3'>
                                        <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                            <RadioItemWithIcon
                                                value='auto'
                                                id='edit-size-auto'
                                                label='自动'
                                                Icon={Sparkles}
                                            />
                                        </div>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                                    <RadioItemWithIcon
                                                        value='portrait'
                                                        id='edit-size-portrait'
                                                        label='纵向'
                                                        Icon={RectangleVertical}
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>{getPresetTooltip('portrait', editModel, customImageModels)}</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                                    <RadioItemWithIcon
                                                        value='landscape'
                                                        id='edit-size-landscape'
                                                        label='横向'
                                                        Icon={RectangleHorizontal}
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>{getPresetTooltip('landscape', editModel, customImageModels)}</TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                                    <RadioItemWithIcon
                                                        value='square'
                                                        id='edit-size-square'
                                                        label='正方形'
                                                        Icon={Square}
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>{getPresetTooltip('square', editModel, customImageModels)}</TooltipContent>
                                        </Tooltip>
                                        {showCustomSizeInput && (
                                            <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                                <RadioItemWithIcon
                                                    value='custom'
                                                    id='edit-size-custom'
                                                    label='自定义'
                                                    Icon={SquareDashed}
                                                />
                                            </div>
                                        )}
                                        </RadioGroup>
                                        {showCustomSizeInput && editSize === 'custom' && (
                                            <div className='space-y-2 rounded-xl border border-border bg-muted/30 p-3'>
                                            <div className='flex items-center gap-3'>
                                                <div className='flex-1 space-y-1'>
                                                    <Label
                                                        htmlFor='edit-custom-width'
                                                        className='text-xs text-muted-foreground'>
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
                                                        className='rounded-xl border-border bg-background text-foreground transition-[color,box-shadow,border-color] duration-200 focus-visible:border-ring focus-visible:ring-ring/30'
                                                    />
                                                </div>
                                                <span className='pt-5 text-muted-foreground'>×</span>
                                                <div className='flex-1 space-y-1'>
                                                    <Label
                                                        htmlFor='edit-custom-height'
                                                        className='text-xs text-muted-foreground'>
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
                                                        className='rounded-xl border-border bg-background text-foreground transition-[color,box-shadow,border-color] duration-200 focus-visible:border-ring focus-visible:ring-ring/30'
                                                    />
                                                </div>
                                            </div>
                                            <p className='text-xs text-muted-foreground'>
                                                {(editCustomWidth * editCustomHeight).toLocaleString()} 像素 (
                                                {(((editCustomWidth * editCustomHeight) / 8_294_400) * 100).toFixed(1)}%
                                                最大值) ·{' '}
                                                {editCustomWidth > 0 && editCustomHeight > 0
                                                    ? `${(Math.max(editCustomWidth, editCustomHeight) / Math.min(editCustomWidth, editCustomHeight)).toFixed(2)}:1 比例`
                                                    : '—'}
                                            </p>
                                            {!customSizeValidation.valid && (
                                                <p className='text-xs text-red-700 dark:text-red-300'>{customSizeValidation.reason}</p>
                                            )}
                                            <p className='text-xs text-muted-foreground/80'>
                                                限制: 16 的倍数，边长最大 3840px，宽高比 ≤ 3:1，总像素 655,360 至
                                                8,294,400。
                                            </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {showQualityControls && <div className='space-y-3'>
                                    <Label className='block text-foreground'>质量</Label>
                                    <RadioGroup
                                        value={editQuality}
                                        onValueChange={handleSetEditQuality}
                                        className='flex flex-wrap gap-3'>
                                        <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                            <RadioItemWithIcon
                                                value='auto'
                                                id='edit-quality-auto'
                                                label='自动'
                                                Icon={Sparkles}
                                            />
                                        </div>
                                        <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                            <RadioItemWithIcon
                                                value='low'
                                                id='edit-quality-low'
                                                label='低'
                                                Icon={Tally1}
                                            />
                                        </div>
                                        <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                            <RadioItemWithIcon
                                                value='medium'
                                                id='edit-quality-medium'
                                                label='中'
                                                Icon={Tally2}
                                            />
                                        </div>
                                        <div className='rounded-xl border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-accent/60'>
                                            <RadioItemWithIcon
                                                value='high'
                                                id='edit-quality-high'
                                                label='高'
                                                Icon={Tally3}
                                            />
                                        </div>
                                    </RadioGroup>
                                </div>}

                                {showBackgroundControls && (
                                    <div className='space-y-3'>
                                        <Label className='block text-foreground'>背景</Label>
                                        <RadioGroup
                                            value={background}
                                            onValueChange={handleSetBackground}
                                            className='flex flex-wrap gap-x-5 gap-y-3'>
                                            <RadioItemWithIcon
                                                value='auto'
                                                id='unified-bg-auto'
                                                label='自动'
                                                Icon={Sparkles}
                                            />
                                            <RadioItemWithIcon
                                                value='opaque'
                                                id='unified-bg-opaque'
                                                label='不透明'
                                                Icon={BrickWall}
                                            />
                                            <RadioItemWithIcon
                                                value='transparent'
                                                id='unified-bg-transparent'
                                                label='透明'
                                                Icon={Eraser}
                                            />
                                        </RadioGroup>
                                    </div>
                                )}

                                {showOutputFormatControls && (
                                    <div className='space-y-3'>
                                        <Label className='block text-foreground'>输出格式</Label>
                                        <RadioGroup
                                            value={outputFormat}
                                            onValueChange={handleSetOutputFormat}
                                            className='flex flex-wrap gap-x-5 gap-y-3'>
                                            <RadioItemWithIcon
                                                value='png'
                                                id='unified-format-png'
                                                label='PNG'
                                                Icon={FileImage}
                                            />
                                            <RadioItemWithIcon
                                                value='jpeg'
                                                id='unified-format-jpeg'
                                                label='JPEG'
                                                Icon={FileImage}
                                            />
                                            <RadioItemWithIcon
                                                value='webp'
                                                id='unified-format-webp'
                                                label='WebP'
                                                Icon={FileImage}
                                            />
                                        </RadioGroup>
                                    </div>
                                )}

                                {showCompression && (
                                    <div className='space-y-2 pt-2 transition-opacity duration-300'>
                                        <Label htmlFor='unified-compression-slider' className='text-foreground'>
                                            压缩率: {compression[0]}%
                                        </Label>
                                        <Slider
                                            id='unified-compression-slider'
                                            min={0}
                                            max={100}
                                            step={1}
                                            value={compression}
                                            onValueChange={handleSetCompression}
                                            className='mt-3'
                                        />
                                    </div>
                                )}

                                    {showModerationControls && (
                                        <div className='space-y-3'>
                                            <Label className='block text-foreground'>内容审核</Label>
                                        <RadioGroup
                                            value={moderation}
                                            onValueChange={handleSetModeration}
                                            className='flex flex-wrap gap-x-5 gap-y-3'>
                                            <RadioItemWithIcon
                                                value='auto'
                                                id='unified-mod-auto'
                                                label='自动'
                                                Icon={ShieldCheck}
                                            />
                                            <RadioItemWithIcon
                                                value='low'
                                                id='unified-mod-low'
                                                label='低'
                                                Icon={ShieldAlert}
                                            />
                                            </RadioGroup>
                                        </div>
                                    )}

                                    {selectedProvider === 'sensenova' && (
                                        <div className='space-y-3 rounded-xl border border-amber-500/25 bg-amber-50/90 p-3 shadow-sm shadow-amber-900/5 dark:border-amber-400/15 dark:bg-amber-500/10 dark:shadow-none'>
                                            <div>
                                                <Label htmlFor='sensenova-size-select' className='text-amber-950 dark:text-amber-100'>SenseNova 尺寸</Label>
                                                <p className='mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-100/85'>
                                                    SenseNova 仅支持文档化 2K 尺寸；不支持水印、response_format、背景、审核等 OpenAI 参数。
                                                </p>
                                            </div>
                                            <Select
                                                value={sensenovaSize || PROVIDER_SIZE_DEFAULT_VALUE}
                                                onValueChange={handleSetSensenovaSize}>
                                                <SelectTrigger
                                                    id='sensenova-size-select'
                                                    className='w-full rounded-xl border border-amber-500/30 bg-white text-amber-950 transition-colors duration-200 focus:border-amber-600/60 focus:ring-amber-500/30 dark:border-amber-300/20 dark:bg-black/10 dark:text-white dark:focus:border-amber-300/50 dark:focus:ring-amber-300/30'>
                                                    <SelectValue placeholder='选择 SenseNova 尺寸' />
                                                </SelectTrigger>
                                                <SelectContent className='border-border bg-popover text-popover-foreground shadow-xl'>
                                                    <SelectItem value={PROVIDER_SIZE_DEFAULT_VALUE}>
                                                        模型默认 · {modelDefinition.defaultSize || '2752x1536'}
                                                    </SelectItem>
                                                    {SENSENOVA_SIZE_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                            <span className='ml-2 text-xs text-muted-foreground'>{option.description}</span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {selectedProvider === 'seedream' && (
                                        <div className='space-y-3'>
                                            <Label className='text-foreground'>Seedream 高级参数</Label>
                                            <div className='space-y-2 rounded-xl border border-border bg-muted/30 p-3'>
                                                <div className='grid gap-3 sm:grid-cols-2'>
                                                    <div className='space-y-1.5'>
                                                        <Label htmlFor='seedream-size-select' className='text-xs text-muted-foreground'>尺寸</Label>
                                                        <Select
                                                            value={seedreamSize || PROVIDER_SIZE_DEFAULT_VALUE}
                                                            onValueChange={handleSetSeedreamSize}>
                                                            <SelectTrigger
                                                                id='seedream-size-select'
                                                                className='w-full rounded-xl border-border bg-background text-foreground transition-[color,box-shadow,border-color] duration-200 focus:border-ring focus:ring-ring/30'>
                                                                <SelectValue placeholder='选择 Seedream 尺寸' />
                                                            </SelectTrigger>
                                                            <SelectContent className='border-border bg-popover text-popover-foreground shadow-xl'>
                                                                <SelectItem value={PROVIDER_SIZE_DEFAULT_VALUE}>
                                                                    模型默认 · {modelDefinition.defaultSize || '2K'}
                                                                </SelectItem>
                                                                {seedreamSizeOptions.map((option) => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        {option.label}
                                                                        <span className='ml-2 text-xs text-muted-foreground'>{option.description}</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className='space-y-1.5'>
                                                        <Label htmlFor='seedream-response-format-select' className='text-xs text-muted-foreground'>响应格式</Label>
                                                        <Select
                                                            value={seedreamResponseFormat}
                                                            onValueChange={handleSetSeedreamResponseFormat}>
                                                            <SelectTrigger
                                                                id='seedream-response-format-select'
                                                                className='w-full rounded-xl border-border bg-background text-foreground transition-[color,box-shadow,border-color] duration-200 focus:border-ring focus:ring-ring/30'>
                                                                <SelectValue placeholder='选择响应格式' />
                                                            </SelectTrigger>
                                                            <SelectContent className='border-border bg-popover text-popover-foreground shadow-xl'>
                                                                {SEEDREAM_RESPONSE_FORMAT_OPTIONS.map((option) => (
                                                                    <SelectItem key={option.value} value={option.value}>
                                                                        {option.label}
                                                                        <span className='ml-2 text-xs text-muted-foreground'>{option.description}</span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className='flex items-center gap-2'>
                                                    <Checkbox
                                                        id='seedream-watermark'
                                                        checked={seedreamWatermark}
                                                        onCheckedChange={(checked) => setSeedreamWatermark(!!checked)}
                                                        className='border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground'
                                                    />
                                                    <Label htmlFor='seedream-watermark' className='cursor-pointer text-xs text-muted-foreground'>水印</Label>
                                                </div>
                                                {seedreamCapabilities.supportsSequentialGeneration && (
                                                    <>
                                                        <div className='space-y-1.5'>
                                                                <Label className='text-xs text-muted-foreground'>序列生成</Label>
                                                            <div className='flex gap-3'>
                                                                <button
                                                                    type='button'
                                                                    onClick={() => handleSetSeedreamSequentialGeneration('disabled')}
                                                                    className={`rounded-full px-3 py-1 text-xs transition-colors ${seedreamSequentialGeneration === 'disabled' ? 'bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/30 dark:bg-violet-500/25 dark:text-violet-50 dark:ring-violet-400/30' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                                    关闭
                                                                </button>
                                                                <button
                                                                    type='button'
                                                                    onClick={() => handleSetSeedreamSequentialGeneration('auto')}
                                                                    className={`rounded-full px-3 py-1 text-xs transition-colors ${seedreamSequentialGeneration === 'auto' ? 'bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/30 dark:bg-violet-500/25 dark:text-violet-50 dark:ring-violet-400/30' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                                    自动组图
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {seedreamSequentialGeneration === 'auto' && (
                                                            <div className='space-y-1.5'>
                                                                <Label className='text-xs text-muted-foreground'>最大图片数: {seedreamMaxImages}</Label>
                                                                <Slider
                                                                    value={[seedreamMaxImages]}
                                                                    onValueChange={(v) => setSeedreamMaxImages(v[0])}
                                                                    min={1}
                                                                    max={15}
                                                                    step={1}
                                                                    className=''
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {seedreamCapabilities.supportsSeed && (
                                                    <div className='space-y-1.5'>
                                                        <Label htmlFor='seedream-seed' className='text-xs text-muted-foreground'>Seed</Label>
                                                        <Input
                                                            id='seedream-seed'
                                                            type='number'
                                                            value={seedreamSeed}
                                                            onChange={(e) => setSeedreamSeed(e.target.value)}
                                                            className='rounded-xl border-border bg-background text-foreground'
                                                            placeholder='随机'
                                                        />
                                                    </div>
                                                )}
                                                {seedreamCapabilities.supportsGuidanceScale && (
                                                    <div className='space-y-1.5'>
                                                        <Label htmlFor='seedream-guidance' className='text-xs text-muted-foreground'>Guidance Scale (1-10)</Label>
                                                        <Input
                                                            id='seedream-guidance'
                                                            type='number'
                                                            min={1}
                                                            max={10}
                                                            step={0.5}
                                                            value={seedreamGuidanceScale}
                                                            onChange={(e) => setSeedreamGuidanceScale(e.target.value)}
                                                            className='rounded-xl border-border bg-background text-foreground'
                                                            placeholder='7.5'
                                                        />
                                                    </div>
                                                )}
                                                {seedreamCapabilities.supportsOutputFormat && (
                                                    <div className='space-y-1.5'>
                                                        <Label className='text-xs text-muted-foreground'>输出格式</Label>
                                                        <div className='flex gap-3'>
                                                            <button
                                                                type='button'
                                                                onClick={() => handleSetSeedreamOutputFormat('png')}
                                                                className={`rounded-full px-3 py-1 text-xs transition-colors ${seedreamOutputFormat === 'png' ? 'bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/30 dark:bg-violet-500/25 dark:text-violet-50 dark:ring-violet-400/30' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                                PNG
                                                            </button>
                                                            <button
                                                                type='button'
                                                                onClick={() => handleSetSeedreamOutputFormat('jpeg')}
                                                                className={`rounded-full px-3 py-1 text-xs transition-colors ${seedreamOutputFormat === 'jpeg' ? 'bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/30 dark:bg-violet-500/25 dark:text-violet-50 dark:ring-violet-400/30' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                                JPEG
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                {seedreamCapabilities.supportsOptimizePrompt && (
                                                    <div className='space-y-1.5'>
                                                        <Label className='text-xs text-muted-foreground'>提示词优化</Label>
                                                        <div className='flex gap-3'>
                                                            <button
                                                                type='button'
                                                                onClick={() => handleSetSeedreamOptimizePromptMode('standard')}
                                                                className={`rounded-full px-3 py-1 text-xs transition-colors ${seedreamOptimizePromptMode === 'standard' ? 'bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/30 dark:bg-violet-500/25 dark:text-violet-50 dark:ring-violet-400/30' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                                标准
                                                            </button>
                                                            <button
                                                                type='button'
                                                                onClick={() => handleSetSeedreamOptimizePromptMode('fast')}
                                                                className={`rounded-full px-3 py-1 text-xs transition-colors ${seedreamOptimizePromptMode === 'fast' ? 'bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/30 dark:bg-violet-500/25 dark:text-violet-50 dark:ring-violet-400/30' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                                                快速
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                {seedreamCapabilities.supportsWebSearch && (
                                                    <div className='flex items-center gap-2'>
                                                        <Checkbox
                                                            id='seedream-websearch'
                                                            checked={seedreamWebSearch}
                                                            onCheckedChange={(checked) => setSeedreamWebSearch(!!checked)}
                                                            className='border-border data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground'
                                                        />
                                                        <Label htmlFor='seedream-websearch' className='cursor-pointer text-xs text-muted-foreground'>联网搜索</Label>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className='space-y-2 rounded-xl border border-border bg-muted/30 p-3'>
                                        <Label htmlFor='provider-options-json' className='block text-foreground'>自定义参数 JSON</Label>
                                        <textarea
                                            id='provider-options-json'
                                            value={providerOptionsJson}
                                            onChange={(event) => setProviderOptionsJson(event.target.value)}
                                            spellCheck={false}
                                            placeholder={'例如：{\n  "vendor_experimental_flag": true,\n  "new_parameter_from_docs": "value"\n}'}
                                            className='min-h-28 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm text-foreground transition-[color,box-shadow,border-color] duration-200 placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30'
                                        />
                                        <p className='text-xs leading-5 text-muted-foreground'>
                                            仅用于供应商新加、低频或尚未做成控件的参数；常用参数请优先使用上方一等控件。同名字段会覆盖表单生成的参数，适合作为临时兜底。
                                        </p>
                                        {providerOptionsValidation.valid === false && (
                                            <p className='text-xs text-red-700 dark:text-red-300'>{providerOptionsValidation.error}</p>
                                        )}
                                    </div>

                                    <div className='space-y-4 py-2'>
                                    <Label htmlFor='edit-n-slider' className='text-foreground'>
                                        图片数量: {editN[0]}
                                    </Label>
                                    <Slider
                                        id='edit-n-slider'
                                        min={1}
                                        max={10}
                                        step={1}
                                        value={editN}
                                        onValueChange={setEditN}
                                        className='my-3'
                                    />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardContent>
                <CardFooter className='border-t border-white/[0.06] p-4'>
                    <Button
                        type='submit'
                        disabled={!editPrompt.trim() || customSizeInvalid || providerOptionsInvalid || Boolean(modeUnsupportedMessage) || isSubmitCoolingDown}
                        aria-busy={isSubmitCoolingDown}
                        className='group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-medium text-white shadow-lg shadow-violet-600/20 transition-[box-shadow,filter,background-image,color] duration-200 hover:shadow-violet-600/40 hover:brightness-110 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none dark:disabled:from-white/10 dark:disabled:to-white/10 dark:disabled:text-white/40'>
                        {isSubmitCoolingDown ? '请稍候…' : submitLabel}
                    </Button>
                </CardFooter>
            </form>

            <ZoomViewer
                src={zoomSrc}
                open={zoomOpen}
                onClose={() => {
                    setZoomOpen(false);
                    setZoomSrc(null);
                }}
                images={zoomImageList}
                currentIndex={zoomIndex}
                onNavigate={(nextIndex) => {
                    setZoomIndex(nextIndex);
                    if (zoomImageList[nextIndex]) {
                        setZoomSrc(zoomImageList[nextIndex].src);
                    }
                }}
            />
        </Card>
    );
}

export const EditingForm = React.memo(EditingFormBase) as typeof EditingFormBase;
