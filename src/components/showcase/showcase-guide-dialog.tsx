'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useNotice } from '@/components/notice-provider';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getAssetLibraryFile, isAssetLibraryImage, listAssetLibraryItems } from '@/lib/asset-library';
import { getClipboardImageFiles } from '@/lib/clipboard-images';
import { copyTextToClipboard, readDesktopClipboardImageFile } from '@/lib/desktop-runtime';
import { isExecutableShowcaseCase, type ShowcaseCase, type ShowcaseTopic } from '@/lib/showcase';
import {
    buildShowcaseRecipePrompt,
    localizeShowcaseText,
    syncShowcasePromptWithUserInstruction,
    type ShowcaseModelCompatibility,
    type ShowcaseModelCompatibilityReason,
    type ShowcasePromptApplyMode
} from '@/lib/showcase-recipe';
import type { AssetLibraryItem } from '@/types/asset-library';
import type { HistoryMetadata } from '@/types/history';
import {
    AlertTriangle,
    ArrowRight,
    Check,
    ClipboardPaste,
    Copy,
    FileImage,
    ImagePlus,
    Images,
    Library,
    Loader2,
    Sparkles,
    Trash2
} from 'lucide-react';
import * as React from 'react';

export type ShowcaseGuideSubmission = {
    files: File[];
    imageMode: 'replace' | 'append';
    prompt: string;
    promptMode: ShowcasePromptApplyMode;
};

const COMPATIBILITY_REASON_KEYS: Record<ShowcaseModelCompatibilityReason, string> = {
    'task-mode': 'showcase.guide.compatibility.reason.taskMode',
    editing: 'showcase.guide.compatibility.reason.editing',
    mask: 'showcase.guide.compatibility.reason.mask',
    'custom-size': 'showcase.guide.compatibility.reason.customSize',
    'reference-images': 'showcase.guide.compatibility.reason.referenceImages'
};

type ShowcaseGuideDialogProps = {
    open: boolean;
    topic: ShowcaseTopic | null;
    showcaseCase: ShowcaseCase | null;
    currentPrompt: string;
    currentSourceImageCount: number;
    compatibility: ShowcaseModelCompatibility | null;
    modelLabel: string;
    recommendedModelLabels?: string[];
    history?: HistoryMetadata[];
    getHistoryImageSrc?: (filename: string) => string | undefined;
    onLoadHistoryImage?: (entry: HistoryMetadata, imageIndex: number) => Promise<File | null>;
    onOpenChange: (open: boolean) => void;
    onOpenModelSettings: () => void;
    onConfirm: (submission: ShowcaseGuideSubmission) => void;
};

type SlotPicker = {
    slotId: string;
    source: 'library' | 'history';
};

function fileSignature(file: Pick<File, 'name' | 'size' | 'type' | 'lastModified'>): string {
    return [file.name, file.size, file.type, file.lastModified].join('\u0000');
}

function dedupeFiles(files: readonly File[]): File[] {
    const seen = new Set<string>();
    return files.filter((file) => {
        const signature = fileSignature(file);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
    });
}

function FilePreview({ file }: { file: File }) {
    const [url, setUrl] = React.useState('');

    React.useEffect(() => {
        const nextUrl = URL.createObjectURL(file);
        setUrl(nextUrl);
        return () => URL.revokeObjectURL(nextUrl);
    }, [file]);

    return url ? (
        // The source is a local user-selected object URL, so Next image optimization is not applicable.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt='' className='size-12 shrink-0 rounded-md object-cover' />
    ) : (
        <span className='bg-panel-subtle flex size-12 shrink-0 items-center justify-center rounded-md'>
            <FileImage className='text-on-panel-faint size-5' aria-hidden='true' />
        </span>
    );
}

function ChoiceButton({
    active,
    label,
    description,
    onClick
}: {
    active: boolean;
    label: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`min-w-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                active
                    ? 'border-primary/50 bg-primary/10 text-foreground ring-primary/20 ring-2'
                    : 'border-border bg-panel-ghost text-muted-foreground hover:bg-panel-subtle'
            }`}>
            <span className='flex items-center gap-2 text-sm font-medium'>
                {active && <Check className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />}
                {label}
            </span>
            <span className='mt-1 block text-xs leading-5'>{description}</span>
        </button>
    );
}

export function ShowcaseGuideDialog({
    open,
    topic,
    showcaseCase,
    currentPrompt,
    currentSourceImageCount,
    compatibility,
    modelLabel,
    recommendedModelLabels = [],
    history = [],
    getHistoryImageSrc,
    onLoadHistoryImage,
    onOpenChange,
    onOpenModelSettings,
    onConfirm
}: ShowcaseGuideDialogProps) {
    const { language, t } = useAppLanguage();
    const { addNotice } = useNotice();
    const [filesBySlot, setFilesBySlot] = React.useState<Record<string, File[]>>({});
    const [userInstruction, setUserInstruction] = React.useState('');
    const [promptMode, setPromptMode] = React.useState<ShowcasePromptApplyMode>('replace');
    const [imageMode, setImageMode] = React.useState<'replace' | 'append'>('replace');
    const [promptDraft, setPromptDraft] = React.useState('');
    const [slotPicker, setSlotPicker] = React.useState<SlotPicker | null>(null);
    const [assetItems, setAssetItems] = React.useState<AssetLibraryItem[]>([]);
    const [assetsLoading, setAssetsLoading] = React.useState(false);
    const [pickerBusyKey, setPickerBusyKey] = React.useState('');

    React.useEffect(() => {
        if (!open || !showcaseCase) return;
        setFilesBySlot({});
        setUserInstruction('');
        setPromptMode(currentPrompt.trim() ? showcaseCase.recipe.promptStrategy : 'replace');
        setImageMode('replace');
        setPromptDraft(buildShowcaseRecipePrompt(showcaseCase.recipe, language, ''));
        setSlotPicker(null);
        setPickerBusyKey('');
    }, [currentPrompt, language, open, showcaseCase]);

    React.useEffect(() => {
        if (slotPicker?.source !== 'library' || assetItems.length > 0 || assetsLoading) return;
        setAssetsLoading(true);
        void listAssetLibraryItems()
            .then((items) => setAssetItems(items.filter((item) => isAssetLibraryImage(item))))
            .catch((error) => {
                console.warn('Failed to load showcase asset library picker:', error);
                addNotice(t('showcase.guide.source.loadFailed'), 'error');
            })
            .finally(() => setAssetsLoading(false));
    }, [addNotice, assetItems.length, assetsLoading, slotPicker?.source, t]);

    if (!topic || !showcaseCase || !isExecutableShowcaseCase(showcaseCase)) return null;

    const recipe = showcaseCase.recipe;
    const orderedSlots = [...recipe.inputSlots].sort((left, right) => left.workbenchOrder - right.workbenchOrder);
    const orderedFiles = orderedSlots.flatMap((slot) => filesBySlot[slot.id] ?? []);
    const missingSlots = orderedSlots.filter((slot) => (filesBySlot[slot.id]?.length ?? 0) < slot.minCount);
    const canConfirm =
        missingSlots.length === 0 && compatibility?.compatible !== false && promptDraft.trim().length > 0;
    const compatibilityReasons = compatibility?.reasons.map((reason) => t(COMPATIBILITY_REASON_KEYS[reason])) ?? [];
    const listSeparator = language === 'zh-CN' ? '、' : ', ';
    const compatibilitySuggestion = recommendedModelLabels.length
        ? t('showcase.guide.compatibility.recommendations', { models: recommendedModelLabels.join(listSeparator) })
        : t('showcase.guide.compatibility.configureModel');
    const activePickerSlot = orderedSlots.find((slot) => slot.id === slotPicker?.slotId) ?? null;
    const historyImages = history.flatMap((entry) =>
        entry.images.map((image, imageIndex) => ({ entry, image, imageIndex }))
    );

    const setSlotFiles = (slotId: string, files: readonly File[], maxCount: number, append = true) => {
        setFilesBySlot((current) => {
            const next = dedupeFiles([...(append ? (current[slotId] ?? []) : []), ...files]).slice(0, maxCount);
            return { ...current, [slotId]: next };
        });
    };

    const removeSlotFile = (slotId: string, target: File) => {
        const targetSignature = fileSignature(target);
        setFilesBySlot((current) => ({
            ...current,
            [slotId]: (current[slotId] ?? []).filter((file) => fileSignature(file) !== targetSignature)
        }));
    };

    const readClipboardForSlot = async (slotId: string, maxCount: number) => {
        setPickerBusyKey(`clipboard:${slotId}`);
        try {
            let files: File[] = [];
            if (typeof navigator !== 'undefined' && navigator.clipboard?.read) {
                const items = await navigator.clipboard.read().catch(() => []);
                for (const item of items) {
                    const imageType = item.types.find((type) => type.startsWith('image/'));
                    if (!imageType) continue;
                    const blob = await item.getType(imageType);
                    files.push(
                        new File(
                            [blob],
                            `clipboard-${Date.now()}-${files.length + 1}.${imageType.split('/')[1] || 'png'}`,
                            {
                                type: imageType
                            }
                        )
                    );
                }
            }
            if (files.length === 0) {
                const desktopFile = await readDesktopClipboardImageFile();
                if (desktopFile) files = [desktopFile];
            }
            if (files.length === 0) {
                addNotice(t('showcase.guide.source.clipboardEmpty'), 'warning');
                return;
            }
            setSlotFiles(slotId, files, maxCount);
            addNotice(t('showcase.guide.source.added', { count: Math.min(files.length, maxCount) }), 'success');
        } catch (error) {
            console.warn('Failed to read showcase clipboard input:', error);
            addNotice(t('showcase.guide.source.clipboardFailed'), 'warning');
        } finally {
            setPickerBusyKey('');
        }
    };

    const handleSlotPaste = (slotId: string, maxCount: number, event: React.ClipboardEvent<HTMLElement>) => {
        const files = getClipboardImageFiles(event.clipboardData);
        if (files.length === 0) return;
        event.preventDefault();
        setSlotFiles(slotId, files, maxCount);
        addNotice(t('showcase.guide.source.added', { count: Math.min(files.length, maxCount) }), 'success');
    };

    const chooseAsset = async (item: AssetLibraryItem) => {
        if (!activePickerSlot) return;
        setPickerBusyKey(`asset:${item.id}`);
        try {
            const file = await getAssetLibraryFile(item);
            if (!file) throw new Error('Asset file is unavailable.');
            setSlotFiles(activePickerSlot.id, [file], activePickerSlot.maxCount);
            setSlotPicker(null);
        } catch (error) {
            console.warn('Failed to select showcase asset:', error);
            addNotice(t('showcase.guide.source.assetFailed'), 'error');
        } finally {
            setPickerBusyKey('');
        }
    };

    const chooseHistoryImage = async (entry: HistoryMetadata, imageIndex: number) => {
        if (!activePickerSlot || !onLoadHistoryImage) return;
        const key = `history:${entry.timestamp}:${imageIndex}`;
        setPickerBusyKey(key);
        try {
            const file = await onLoadHistoryImage(entry, imageIndex);
            if (!file) throw new Error('History file is unavailable.');
            setSlotFiles(activePickerSlot.id, [file], activePickerSlot.maxCount);
            setSlotPicker(null);
        } catch (error) {
            console.warn('Failed to select showcase history image:', error);
            addNotice(t('showcase.guide.source.historyFailed'), 'error');
        } finally {
            setPickerBusyKey('');
        }
    };

    const copyPrompt = async () => {
        const copied = await copyTextToClipboard(promptDraft);
        addNotice(
            t(copied ? 'showcase.guide.prompt.copied' : 'showcase.guide.prompt.copyFailed'),
            copied ? 'success' : 'error'
        );
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className='app-panel-card inset-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border'>
                    <DialogHeader className='border-panel-divider border-b px-5 py-4 pr-14'>
                        <div className='text-primary mb-2 flex items-center gap-2 text-xs font-medium'>
                            <Sparkles className='h-3.5 w-3.5' />
                            {localizeShowcaseText(topic.title, language)}
                        </div>
                        <DialogTitle className='text-xl'>
                            {localizeShowcaseText(showcaseCase.title, language)}
                        </DialogTitle>
                        <DialogDescription className='leading-6'>
                            {localizeShowcaseText(showcaseCase.summary, language)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className='max-h-[min(70dvh,680px)] space-y-5 overflow-y-auto px-5 py-5'>
                        <section className='space-y-3' aria-labelledby='showcase-input-heading'>
                            <div className='flex items-center justify-between gap-3'>
                                <h3 id='showcase-input-heading' className='text-sm font-semibold'>
                                    {t('showcase.guide.step.images')}
                                </h3>
                                <span className='text-muted-foreground text-xs'>
                                    {t('showcase.guide.images.orderHint')}
                                </span>
                            </div>
                            <div className='grid gap-3 sm:grid-cols-2'>
                                {orderedSlots.map((slot, index) => {
                                    const selected = filesBySlot[slot.id] ?? [];
                                    const missing = selected.length < slot.minCount;
                                    return (
                                        <div
                                            key={slot.id}
                                            className={`app-panel-subtle border-panel-divider flex min-h-32 min-w-0 flex-col rounded-xl border p-3 focus-within:ring-2 focus-within:ring-violet-500/30 ${missing ? 'border-amber-500/40' : ''}`}
                                            onPaste={(event) => handleSlotPaste(slot.id, slot.maxCount, event)}>
                                            <input
                                                id={`showcase-slot-${slot.id}`}
                                                type='file'
                                                accept={slot.acceptedMimeTypes.join(',')}
                                                multiple={slot.maxCount > 1}
                                                className='sr-only'
                                                onChange={(event) => {
                                                    const selectedFiles = Array.from(event.target.files ?? []).slice(
                                                        0,
                                                        slot.maxCount
                                                    );
                                                    setFilesBySlot((current) => ({
                                                        ...current,
                                                        [slot.id]: selectedFiles
                                                    }));
                                                    event.currentTarget.value = '';
                                                }}
                                            />
                                            <div className='flex items-start gap-3'>
                                                <span className='bg-background border-border flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold'>
                                                    {index + 1}
                                                </span>
                                                <div className='min-w-0'>
                                                    <p className='text-sm font-medium'>
                                                        {localizeShowcaseText(slot.label, language)}
                                                        {!slot.required && (
                                                            <span className='text-muted-foreground ml-1 font-normal'>
                                                                {t('showcase.guide.optional')}
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className='text-muted-foreground mt-1 text-xs leading-5'>
                                                        {localizeShowcaseText(slot.description, language)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className='mt-3 flex min-w-0 flex-wrap gap-2'>
                                                {selected.map((file) => (
                                                    <div
                                                        key={fileSignature(file)}
                                                        className='border-border bg-background/70 flex max-w-full min-w-0 items-center gap-2 rounded-lg border p-1.5'>
                                                        <FilePreview file={file} />
                                                        <span className='max-w-[9rem] truncate text-xs'>
                                                            {file.name}
                                                        </span>
                                                        <button
                                                            type='button'
                                                            className='text-on-panel-faint hover:text-foreground focus-visible:ring-ring/50 flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none'
                                                            onClick={() => removeSlotFile(slot.id, file)}
                                                            aria-label={t('showcase.guide.source.remove', {
                                                                name: file.name
                                                            })}>
                                                            <Trash2 className='size-3.5' aria-hidden='true' />
                                                        </button>
                                                    </div>
                                                ))}
                                                {selected.length === 0 ? (
                                                    <span className='text-on-panel-faint flex min-h-12 items-center gap-2 text-xs'>
                                                        <ImagePlus className='size-4 shrink-0' aria-hidden='true' />
                                                        {t('showcase.guide.chooseImage')}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className='mt-auto flex flex-wrap gap-2 pt-3'>
                                                <Button
                                                    asChild
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    className='min-h-9'>
                                                    <label
                                                        htmlFor={`showcase-slot-${slot.id}`}
                                                        className='cursor-pointer'>
                                                        <ImagePlus aria-hidden='true' />
                                                        {t('showcase.guide.source.file')}
                                                    </label>
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    className='min-h-9'
                                                    onClick={() => void readClipboardForSlot(slot.id, slot.maxCount)}
                                                    disabled={pickerBusyKey === `clipboard:${slot.id}`}>
                                                    {pickerBusyKey === `clipboard:${slot.id}` ? (
                                                        <Loader2
                                                            className='animate-spin motion-reduce:animate-none'
                                                            aria-hidden='true'
                                                        />
                                                    ) : (
                                                        <ClipboardPaste aria-hidden='true' />
                                                    )}
                                                    {t('showcase.guide.source.paste')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    className='min-h-9'
                                                    onClick={() =>
                                                        setSlotPicker({ slotId: slot.id, source: 'library' })
                                                    }>
                                                    <Library aria-hidden='true' />
                                                    {t('showcase.guide.source.library')}
                                                </Button>
                                                {history.length > 0 && onLoadHistoryImage ? (
                                                    <Button
                                                        type='button'
                                                        variant='outline'
                                                        size='sm'
                                                        className='min-h-9'
                                                        onClick={() =>
                                                            setSlotPicker({ slotId: slot.id, source: 'history' })
                                                        }>
                                                        <Images aria-hidden='true' />
                                                        {t('showcase.guide.source.history')}
                                                    </Button>
                                                ) : null}
                                            </div>
                                            {missing ? (
                                                <p
                                                    className='mt-2 text-xs text-amber-700 dark:text-amber-300'
                                                    role='alert'>
                                                    {t('showcase.guide.images.missing', {
                                                        count: slot.minCount - selected.length
                                                    })}
                                                </p>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                            {currentSourceImageCount > 0 && (
                                <div className='app-panel-subtle border-panel-divider space-y-2 rounded-xl border p-3'>
                                    <p className='text-muted-foreground text-xs leading-5'>
                                        {t('showcase.guide.images.existing', { count: currentSourceImageCount })}
                                    </p>
                                    <div className='grid gap-2 sm:grid-cols-2'>
                                        <ChoiceButton
                                            active={imageMode === 'replace'}
                                            label={t('showcase.guide.imageMode.replace')}
                                            description={t('showcase.guide.imageMode.replace.description')}
                                            onClick={() => setImageMode('replace')}
                                        />
                                        <ChoiceButton
                                            active={imageMode === 'append'}
                                            label={t('showcase.guide.imageMode.append')}
                                            description={t('showcase.guide.imageMode.append.description')}
                                            onClick={() => setImageMode('append')}
                                        />
                                    </div>
                                </div>
                            )}
                        </section>

                        {recipe.userInstruction?.enabled && (
                            <section className='space-y-2'>
                                <h3 className='text-sm font-semibold'>{t('showcase.guide.step.personalize')}</h3>
                                <Input
                                    value={userInstruction}
                                    maxLength={recipe.userInstruction.maxLength}
                                    onChange={(event) => {
                                        const nextInstruction = event.target.value;
                                        setPromptDraft((currentPrompt) =>
                                            syncShowcasePromptWithUserInstruction(
                                                recipe,
                                                language,
                                                userInstruction,
                                                nextInstruction,
                                                currentPrompt
                                            )
                                        );
                                        setUserInstruction(nextInstruction);
                                    }}
                                    placeholder={t('showcase.guide.personalize.placeholder')}
                                    className='bg-panel-ghost h-10 rounded-xl'
                                />
                            </section>
                        )}

                        <section className='space-y-3'>
                            <h3 className='text-sm font-semibold'>{t('showcase.guide.step.prompt')}</h3>
                            {currentPrompt.trim() && (
                                <div className='grid gap-2 sm:grid-cols-3'>
                                    <ChoiceButton
                                        active={promptMode === 'replace'}
                                        label={t('showcase.guide.promptMode.replace')}
                                        description={t('showcase.guide.promptMode.replace.description')}
                                        onClick={() => setPromptMode('replace')}
                                    />
                                    <ChoiceButton
                                        active={promptMode === 'append'}
                                        label={t('showcase.guide.promptMode.append')}
                                        description={t('showcase.guide.promptMode.append.description')}
                                        onClick={() => setPromptMode('append')}
                                    />
                                    <ChoiceButton
                                        active={promptMode === 'keep'}
                                        label={t('showcase.guide.promptMode.keep')}
                                        description={t('showcase.guide.promptMode.keep.description')}
                                        onClick={() => setPromptMode('keep')}
                                    />
                                </div>
                            )}
                            <div className='relative'>
                                <Textarea
                                    value={promptDraft}
                                    onChange={(event) => setPromptDraft(event.target.value)}
                                    maxLength={12000}
                                    className='bg-panel-ghost min-h-32 rounded-xl pr-12 text-sm leading-6'
                                    aria-label={t('showcase.guide.prompt.ariaLabel')}
                                />
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    className='absolute top-2 right-2 size-9'
                                    onClick={() => void copyPrompt()}
                                    aria-label={t('showcase.guide.prompt.copy')}>
                                    <Copy className='size-4' aria-hidden='true' />
                                </Button>
                            </div>
                            <p className='text-on-panel-faint text-xs'>{t('showcase.guide.prompt.editHint')}</p>
                        </section>

                        <section className='space-y-2'>
                            <h3 className='text-sm font-semibold'>{t('showcase.guide.step.compatibility')}</h3>
                            {compatibility?.compatible === false ? (
                                <div className='rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200'>
                                    <div className='flex items-start gap-2'>
                                        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
                                        <div>
                                            <p className='font-medium'>
                                                {t('showcase.guide.compatibility.incompatible', { model: modelLabel })}
                                            </p>
                                            <p className='mt-1 text-xs leading-5 opacity-90'>
                                                {t('showcase.guide.compatibility.details', {
                                                    reasons: compatibilityReasons.join(listSeparator),
                                                    suggestion: compatibilitySuggestion
                                                })}
                                            </p>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                size='sm'
                                                className='bg-background/70 mt-3 border-amber-500/30'
                                                onClick={onOpenModelSettings}>
                                                {t('showcase.guide.compatibility.openSettings')}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className='rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200'>
                                    <div className='flex items-center gap-2 font-medium'>
                                        <Check className='h-4 w-4' />
                                        {t('showcase.guide.compatibility.compatible', { model: modelLabel })}
                                    </div>
                                </div>
                            )}
                        </section>

                        <section
                            className='app-panel-subtle border-panel-divider rounded-xl border p-3'
                            aria-labelledby='showcase-summary-heading'>
                            <h3 id='showcase-summary-heading' className='text-sm font-semibold'>
                                {t('showcase.guide.summary.title')}
                            </h3>
                            <dl className='mt-3 grid gap-2 text-xs sm:grid-cols-2'>
                                <div>
                                    <dt className='text-on-panel-faint'>{t('showcase.guide.summary.images')}</dt>
                                    <dd className='text-foreground mt-0.5 font-medium'>
                                        {orderedFiles.length} /{' '}
                                        {orderedSlots.reduce((sum, slot) => sum + slot.minCount, 0)}
                                    </dd>
                                </div>
                                <div>
                                    <dt className='text-on-panel-faint'>{t('showcase.guide.summary.model')}</dt>
                                    <dd className='text-foreground mt-0.5 font-medium'>{modelLabel}</dd>
                                </div>
                                <div>
                                    <dt className='text-on-panel-faint'>{t('showcase.guide.summary.mode')}</dt>
                                    <dd className='text-foreground mt-0.5 font-medium'>
                                        {t(
                                            recipe.taskMode === 'image-edit'
                                                ? 'showcase.recipe.imageEdit'
                                                : 'showcase.recipe.imageGenerate'
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt className='text-on-panel-faint'>{t('showcase.guide.summary.prompt')}</dt>
                                    <dd className='text-foreground mt-0.5 font-medium'>{promptDraft.length} / 12000</dd>
                                </div>
                            </dl>
                        </section>
                    </div>

                    <DialogFooter className='border-panel-divider bg-background/90 border-t px-5 py-4 sm:items-center sm:justify-between'>
                        <p className='text-muted-foreground text-xs leading-5'>{t('showcase.guide.safetyNotice')}</p>
                        <div className='flex gap-2'>
                            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type='button'
                                disabled={!canConfirm}
                                onClick={() =>
                                    onConfirm({ files: orderedFiles, imageMode, prompt: promptDraft, promptMode })
                                }>
                                {canConfirm ? (
                                    <ArrowRight className='h-4 w-4' />
                                ) : (
                                    <AlertTriangle className='h-4 w-4' />
                                )}
                                {t('showcase.guide.loadWorkbench')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(slotPicker)} onOpenChange={(nextOpen) => !nextOpen && setSlotPicker(null)}>
                <DialogContent className='app-panel-card gap-0 overflow-hidden p-0 sm:max-w-3xl'>
                    <DialogHeader className='border-panel-divider border-b px-5 py-4 pr-14'>
                        <DialogTitle>{t('showcase.guide.source.pickerTitle')}</DialogTitle>
                        <DialogDescription>
                            {activePickerSlot
                                ? t('showcase.guide.source.pickerDescription', {
                                      slot: localizeShowcaseText(activePickerSlot.label, language)
                                  })
                                : t('showcase.guide.source.pickerDescriptionFallback')}
                        </DialogDescription>
                    </DialogHeader>
                    <Tabs
                        value={slotPicker?.source ?? 'library'}
                        onValueChange={(value) =>
                            setSlotPicker((current) =>
                                current ? { ...current, source: value === 'history' ? 'history' : 'library' } : current
                            )
                        }
                        className='min-h-0'>
                        <div className='border-panel-divider border-b px-5 py-3'>
                            <TabsList className='w-full sm:w-auto'>
                                <TabsTrigger value='library' className='flex-1 sm:flex-none'>
                                    <Library aria-hidden='true' />
                                    {t('showcase.guide.source.library')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value='history'
                                    className='flex-1 sm:flex-none'
                                    disabled={!onLoadHistoryImage}>
                                    <Images aria-hidden='true' />
                                    {t('showcase.guide.source.history')}
                                </TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value='library' className='m-0'>
                            <div className='max-h-[min(66dvh,34rem)] overflow-y-auto p-4 sm:p-5'>
                                {assetsLoading ? (
                                    <div className='text-on-panel-muted flex min-h-40 items-center justify-center gap-2 text-sm'>
                                        <Loader2
                                            className='size-4 animate-spin motion-reduce:animate-none'
                                            aria-hidden='true'
                                        />
                                        {t('showcase.guide.source.loading')}
                                    </div>
                                ) : assetItems.length > 0 ? (
                                    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                                        {assetItems.map((item) => (
                                            <button
                                                key={item.id}
                                                type='button'
                                                onClick={() => void chooseAsset(item)}
                                                disabled={Boolean(pickerBusyKey)}
                                                className='app-panel-subtle border-panel-divider focus-visible:ring-ring/50 hover:bg-panel-ghost min-w-0 rounded-xl border p-3 text-left focus-visible:ring-2 focus-visible:outline-none'>
                                                <span className='bg-background flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border'>
                                                    {pickerBusyKey === `asset:${item.id}` ? (
                                                        <Loader2
                                                            className='text-on-panel-faint size-5 animate-spin motion-reduce:animate-none'
                                                            aria-hidden='true'
                                                        />
                                                    ) : (
                                                        <FileImage
                                                            className='text-on-panel-faint size-6'
                                                            aria-hidden='true'
                                                        />
                                                    )}
                                                </span>
                                                <span
                                                    className='text-foreground mt-2 block truncate text-sm font-medium'
                                                    data-i18n-skip='true'>
                                                    {item.displayName}
                                                </span>
                                                <span className='text-on-panel-faint mt-1 block text-xs'>
                                                    {item.width && item.height
                                                        ? `${item.width} × ${item.height}`
                                                        : item.mimeType}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className='border-panel-divider text-on-panel-muted rounded-xl border border-dashed px-4 py-12 text-center text-sm'>
                                        {t('showcase.guide.source.libraryEmpty')}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                        <TabsContent value='history' className='m-0'>
                            <div className='max-h-[min(66dvh,34rem)] overflow-y-auto p-4 sm:p-5'>
                                {historyImages.length > 0 ? (
                                    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                                        {historyImages.slice(0, 60).map(({ entry, image, imageIndex }) => {
                                            const src = getHistoryImageSrc?.(image.filename);
                                            const busy = pickerBusyKey === `history:${entry.timestamp}:${imageIndex}`;
                                            return (
                                                <button
                                                    key={`${entry.timestamp}:${image.filename}:${imageIndex}`}
                                                    type='button'
                                                    onClick={() => void chooseHistoryImage(entry, imageIndex)}
                                                    disabled={Boolean(pickerBusyKey)}
                                                    className='app-panel-subtle border-panel-divider focus-visible:ring-ring/50 hover:bg-panel-ghost min-w-0 rounded-xl border p-2 text-left focus-visible:ring-2 focus-visible:outline-none'>
                                                    <span className='bg-background relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border'>
                                                        {src ? (
                                                            // History can resolve to local object URLs and Tauri URLs, so Next optimization is not applicable.
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={src}
                                                                alt=''
                                                                className='h-full w-full object-cover'
                                                            />
                                                        ) : (
                                                            <Images
                                                                className='text-on-panel-faint size-6'
                                                                aria-hidden='true'
                                                            />
                                                        )}
                                                        {busy ? (
                                                            <span className='absolute inset-0 flex items-center justify-center bg-black/35'>
                                                                <Loader2
                                                                    className='size-5 animate-spin text-white motion-reduce:animate-none'
                                                                    aria-hidden='true'
                                                                />
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <span
                                                        className='text-foreground mt-2 block truncate text-xs font-medium'
                                                        data-i18n-skip='true'>
                                                        {image.filename}
                                                    </span>
                                                    <span className='text-on-panel-faint mt-1 block text-[11px]'>
                                                        {new Date(entry.timestamp).toLocaleString(language)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className='border-panel-divider text-on-panel-muted rounded-xl border border-dashed px-4 py-12 text-center text-sm'>
                                        {t('showcase.guide.source.historyEmpty')}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </>
    );
}
