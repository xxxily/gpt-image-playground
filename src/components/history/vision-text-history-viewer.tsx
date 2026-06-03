'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useImageSrcState } from '@/hooks/useImageSrc';
import { copyTextToClipboard } from '@/lib/desktop-runtime';
import { cn } from '@/lib/utils';
import { VISION_TEXT_DETAIL_LABELS, VISION_TEXT_TASK_TYPE_LABELS } from '@/lib/vision-text-types';
import type { ImageToTextStructuredResult } from '@/lib/vision-text-types';
import type { ProviderUsage, VisionTextHistoryMetadata, VisionTextSourceImageRef } from '@/types/history';
import { Check, Clipboard, FileImage, Plus, Replace, Send, Undo2 } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type VisionTextHistoryViewerProps = {
    item: VisionTextHistoryMetadata | null;
    open: boolean;
    initialSourceImageIndex: number;
    getSourceImageSrc: (ref: VisionTextSourceImageRef) => string | undefined;
    onClose: () => void;
    onRestore: (item: VisionTextHistoryMetadata) => void;
    onSendToGenerator: (prompt: string) => void;
    onReplacePrompt: (prompt: string) => void;
    onAppendPrompt: (prompt: string) => void;
};

function getReusablePrompt(item: VisionTextHistoryMetadata): string {
    return item.structuredResult?.prompt?.trim() || item.resultText.trim();
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

type TranslateFn = ReturnType<typeof useAppLanguage>['t'];

function formatUsage(usage: ProviderUsage | undefined, t: TranslateFn): string | null {
    const parts: string[] = [];
    const textTokens = usage?.input_tokens_details?.text_tokens;
    const imageTokens = usage?.input_tokens_details?.image_tokens;
    const outputTokens = usage?.output_tokens;
    if (typeof textTokens === 'number') {
        parts.push(t('phase4b.usageTextTokens', { count: textTokens.toLocaleString() }));
    }
    if (typeof imageTokens === 'number') {
        parts.push(t('phase4b.usageImageTokens', { count: imageTokens.toLocaleString() }));
    }
    if (typeof outputTokens === 'number') {
        parts.push(t('phase4b.usageOutputTokens', { count: outputTokens.toLocaleString() }));
    }
    return parts.length > 0 ? parts.join(' / ') : null;
}

function StructuredField({ label, value }: { label: string; value?: string | string[] | null }) {
    const text = Array.isArray(value) ? value.filter(Boolean).join('、') : value?.trim();
    if (!text) return null;

    return (
        <div className='border-border bg-background/60 dark:border-panel-divider dark:bg-panel-soft rounded-lg border p-3'>
            <p className='text-foreground/75 mb-1 text-xs font-medium'>{label}</p>
            <p className='text-muted-foreground text-sm leading-5 whitespace-pre-wrap' data-i18n-skip='true'>
                {text}
            </p>
        </div>
    );
}

function StructuredResultFields({ structured }: { structured: ImageToTextStructuredResult | null | undefined }) {
    const { t } = useAppLanguage();

    if (!structured) return null;

    return (
        <div className='grid gap-2 sm:grid-cols-2'>
            <StructuredField label={t('phase4b.mainPrompt')} value={structured.prompt} />
            <StructuredField label={t('video.params.negativePrompt.label')} value={structured.negativePrompt} />
            <StructuredField label={t('phase4b.styleTags')} value={structured.styleTags} />
            <StructuredField label={t('phase4b.subject')} value={structured.subject} />
            <StructuredField label={t('phase4b.composition')} value={structured.composition} />
            <StructuredField label={t('phase4b.lighting')} value={structured.lighting} />
            <StructuredField label={t('phase4b.colors')} value={structured.colorPalette} />
            <StructuredField label={t('phase4b.materials')} value={structured.materials} />
            <StructuredField label={t('phase4b.textRecognition')} value={structured.textInImage} />
            <StructuredField label={t('phase4b.aspectRatioSuggestion')} value={structured.aspectRatioRecommendation} />
            <StructuredField label={t('phase4b.generationNotes')} value={structured.generationNotes} />
            <StructuredField label={t('phase4b.warnings')} value={structured.warnings} />
        </div>
    );
}

function SourceImageButton({
    source,
    index,
    selected,
    getSourceImageSrc,
    onSelect
}: {
    source: VisionTextSourceImageRef;
    index: number;
    selected: boolean;
    getSourceImageSrc: (ref: VisionTextSourceImageRef) => string | undefined;
    onSelect: (index: number) => void;
}) {
    const { t } = useAppLanguage();
    const directSrc = getSourceImageSrc(source);
    const storedImage = useImageSrcState(directSrc ? null : source.filename);
    const src = directSrc ?? storedImage.src;

    return (
        <button
            type='button'
            onClick={() => onSelect(index)}
            className={cn(
                'relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border',
                selected ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-panel-divider'
            )}
            aria-label={t('history.visionText.viewSourceImage', { index: index + 1 })}>
            {src ? (
                <Image src={src} alt={source.filename} fill className='object-cover' unoptimized />
            ) : storedImage.status === 'loading' ? (
                <div className='bg-muted text-muted-foreground flex h-full w-full items-center justify-center'>
                    <Spinner size='xs' />
                </div>
            ) : (
                <div className='bg-muted text-muted-foreground flex h-full w-full items-center justify-center'>
                    <FileImage className='h-4 w-4' />
                </div>
            )}
        </button>
    );
}

export function VisionTextHistoryViewer({
    item,
    open,
    initialSourceImageIndex,
    getSourceImageSrc,
    onClose,
    onRestore,
    onSendToGenerator,
    onReplacePrompt,
    onAppendPrompt
}: VisionTextHistoryViewerProps) {
    const { formatDateTime, t } = useAppLanguage();
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const [copied, setCopied] = React.useState<'full' | 'prompt' | null>(null);

    React.useEffect(() => {
        if (!open || !item) return;
        setSelectedIndex(Math.min(Math.max(0, initialSourceImageIndex), Math.max(0, item.sourceImages.length - 1)));
        setCopied(null);
    }, [initialSourceImageIndex, item, open]);

    const selectedSource = item?.sourceImages[selectedIndex] ?? item?.sourceImages[0];
    const selectedDirectSrc = selectedSource ? getSourceImageSrc(selectedSource) : undefined;
    const selectedStoredImage = useImageSrcState(selectedDirectSrc ? null : selectedSource?.filename);
    const selectedSrc = selectedDirectSrc ?? selectedStoredImage.src;

    if (!item) return null;

    const reusablePrompt = getReusablePrompt(item);
    const usageLabel = formatUsage(item.usage, t);

    const copyFullText = async () => {
        await copyTextToClipboard(item.resultText);
        setCopied('full');
        window.setTimeout(() => setCopied(null), 1200);
    };

    const copyMainPrompt = async () => {
        const prompt = item.structuredResult?.prompt?.trim();
        if (!prompt) return;
        await copyTextToClipboard(prompt);
        setCopied('prompt');
        window.setTimeout(() => setCopied(null), 1200);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) onClose();
            }}>
            <DialogContent className='border-border bg-background text-foreground fixed top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 p-0 shadow-none sm:top-[50%] sm:left-[50%] sm:h-[92vh] sm:max-h-[92vh] sm:w-[calc(100vw-1.5rem)] sm:max-w-6xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:shadow-lg [&>button:last-child]:top-[max(0.375rem,env(safe-area-inset-top))] [&>button:last-child]:z-20 sm:[&>button:last-child]:top-3 sm:[&>button:last-child]:right-3'>
                <DialogHeader className='border-border min-h-14 shrink-0 justify-center border-b px-4 py-2 pr-16 text-left sm:px-5'>
                    <DialogTitle className='text-base leading-tight sm:text-lg'>
                        <LocalizedMessage id='phase4b.imageToTextHistoryDetails' />
                    </DialogTitle>
                    <DialogDescription className='sr-only'>
                        <LocalizedMessage id='phase4b.viewSourceImagesAndImageToTextResult' />
                    </DialogDescription>
                </DialogHeader>

                <div className='grid min-h-0 flex-1 grid-rows-[minmax(220px,34dvh)_minmax(0,1fr)] overflow-hidden sm:grid-rows-[minmax(240px,38dvh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:grid-rows-none'>
                    <div className='bg-muted/20 flex min-h-0 flex-col overflow-hidden border-b lg:min-h-[300px] lg:border-r lg:border-b-0'>
                        <div className='flex min-h-0 flex-1 items-center justify-center p-3'>
                            {selectedSrc ? (
                                <div className='relative h-full w-full'>
                                    <Image
                                        src={selectedSrc}
                                        alt={selectedSource?.filename ?? t('phase4b.sourceImage')}
                                        fill
                                        className='object-contain'
                                        sizes='(min-width: 1024px) 58vw, 100vw'
                                        unoptimized
                                    />
                                </div>
                            ) : selectedStoredImage.status === 'loading' ? (
                                <div className='text-muted-foreground flex min-h-[180px] flex-col items-center justify-center gap-2 text-sm lg:min-h-[260px]'>
                                    <Spinner size='xl' />
                                    <span>{t('history.visionText.sourceLoading')}</span>
                                </div>
                            ) : (
                                <div className='text-muted-foreground flex min-h-[180px] flex-col items-center justify-center gap-2 text-sm lg:min-h-[260px]'>
                                    <FileImage className='h-10 w-10 opacity-40' />
                                    <span>{t('history.visionText.sourcePendingRestore')}</span>
                                </div>
                            )}
                        </div>
                        {item.sourceImages.length > 1 && (
                            <div className='border-border flex shrink-0 gap-2 overflow-x-auto border-t p-3'>
                                {item.sourceImages.map((source, index) => (
                                    <SourceImageButton
                                        key={`${source.filename}-${index}`}
                                        source={source}
                                        index={index}
                                        selected={selectedIndex === index}
                                        getSourceImageSrc={getSourceImageSrc}
                                        onSelect={setSelectedIndex}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className='min-h-0 overflow-y-auto p-3 sm:p-4'>
                        <div className='mb-4 grid gap-2 text-sm sm:grid-cols-2'>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    <LocalizedMessage id='video.history.detail.type' />
                                </p>
                                <p className='font-medium'>{VISION_TEXT_TASK_TYPE_LABELS[item.taskType]}</p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    <LocalizedMessage id='video.history.detail.model' />
                                </p>
                                <p className='truncate font-medium'>{item.model || t('phase4b.unknownModel')}</p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    <LocalizedMessage id='assets.list.date' />
                                </p>
                                <p className='font-medium'>
                                    {formatDateTime(item.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    <LocalizedMessage id='phase4b.durationSourceImages' />
                                </p>
                                <p className='font-medium'>
                                    {formatDuration(item.durationMs)} / {item.sourceImages.length}{' '}
                                    <LocalizedMessage id='phase4b.images' />
                                </p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>
                                    <LocalizedMessage id='phase4b.detail' />
                                </p>
                                <p className='font-medium'>{VISION_TEXT_DETAIL_LABELS[item.detail]}</p>
                            </div>
                            {usageLabel && (
                                <div>
                                    <p className='text-muted-foreground text-xs'>
                                        <LocalizedMessage id='phase4b.usage' />
                                    </p>
                                    <p className='font-medium'>{usageLabel}</p>
                                </div>
                            )}
                        </div>

                        {item.prompt && (
                            <div className='border-border bg-muted/35 mb-4 rounded-lg border p-3'>
                                <p className='text-foreground/75 mb-1 text-xs font-medium'>
                                    <LocalizedMessage id='phase4b.userInstructions' />
                                </p>
                                <p
                                    className='text-muted-foreground text-sm leading-5 whitespace-pre-wrap'
                                    data-i18n-skip='true'>
                                    {item.prompt}
                                </p>
                            </div>
                        )}

                        <div className='border-border bg-background/70 mb-4 max-h-[32dvh] overflow-auto rounded-lg border p-3 lg:max-h-[34vh]'>
                            <p className='text-foreground/75 mb-2 text-xs font-medium'>
                                <LocalizedMessage id='phase4b.fullResult' />
                            </p>
                            <pre className='text-foreground/90 text-sm leading-6 break-words whitespace-pre-wrap'>
                                {item.resultText || t('phase4b.noTextResult')}
                            </pre>
                        </div>

                        <StructuredResultFields structured={item.structuredResult} />
                    </div>
                </div>

                <DialogFooter className='border-border shrink-0 flex-col gap-2 border-t px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-between sm:px-4 sm:py-3'>
                    <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap'>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={copyFullText}
                            className='w-full justify-center sm:w-auto'>
                            {copied === 'full' ? (
                                <Check className='mr-2 h-4 w-4' />
                            ) : (
                                <Clipboard className='mr-2 h-4 w-4' />
                            )}
                            {copied === 'full' ? t('share.shortLink.copied') : t('phase4b.copyFullText')}
                        </Button>
                        {item.structuredResult?.prompt?.trim() && (
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={copyMainPrompt}
                                className='w-full justify-center sm:w-auto'>
                                {copied === 'prompt' ? (
                                    <Check className='mr-2 h-4 w-4' />
                                ) : (
                                    <Clipboard className='mr-2 h-4 w-4' />
                                )}
                                {copied === 'prompt' ? t('share.shortLink.copied') : t('phase4b.copyMainPrompt')}
                            </Button>
                        )}
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={!reusablePrompt}
                            onClick={() => onReplacePrompt(reusablePrompt)}
                            className='w-full justify-center sm:w-auto'>
                            <Replace className='mr-2 h-4 w-4' />
                            <LocalizedMessage id='phase4b.replacePrompt' />
                        </Button>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={!reusablePrompt}
                            onClick={() => onAppendPrompt(reusablePrompt)}
                            className='w-full justify-center sm:w-auto'>
                            <Plus className='mr-2 h-4 w-4' />
                            <LocalizedMessage id='phase4b.appendPrompt' />
                        </Button>
                    </div>
                    <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap'>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => onRestore(item)}
                            className='w-full justify-center sm:w-auto'>
                            <Undo2 className='mr-2 h-4 w-4' />
                            <LocalizedMessage id='phase4b.restoreToImageToText' />
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            disabled={!reusablePrompt}
                            onClick={() => onSendToGenerator(reusablePrompt)}
                            className='w-full justify-center sm:w-auto'>
                            <Send className='mr-2 h-4 w-4' />
                            <LocalizedMessage id='phase4b.sendToGenerator' />
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
