'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { useImageSrc } from '@/hooks/useImageSrc';
import { getModelRates, type GptImageModel } from '@/lib/cost-utils';
import { isTauriDesktop } from '@/lib/desktop-runtime';
import { isExampleHistoryImage, isExampleHistoryItem, type ExampleHistoryMetadata } from '@/lib/example-history';
import { DEFAULT_IMAGE_MODEL, isImageModelId } from '@/lib/model-registry';
import { cn } from '@/lib/utils';
import type { HistoryImage, HistoryMetadata, ImageStorageMode } from '@/types/history';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
    Check,
    Boxes,
    Cloud,
    CloudUpload,
    Copy,
    DollarSign,
    Download,
    FileImage,
    Layers,
    Pencil,
    Sparkles as SparklesIcon,
    Trash2
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

const HISTORY_THUMBNAIL_EAGER_COUNT = 10;

const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

const calculateCost = (value: number, rate: number): string => {
    const cost = value * rate;
    return isNaN(cost) ? 'N/A' : cost.toFixed(4);
};

const formatCostShort = (value: number): string => value.toFixed(2);
const formatCostPrecise = (value: number): string => value.toFixed(4);
const formatHistoryFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatHistoryDateLabel = (timestamp: number, language: string): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMin = Math.floor(diffMs / 60000);
    const relativeFormatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    const shortDateFormatter = new Intl.DateTimeFormat(language, {
        month: 'numeric',
        day: 'numeric'
    });

    if (diffMin < 1) return language === 'en-US' ? 'just now' : '刚刚';
    if (diffMin < 60) return relativeFormatter.format(-diffMin, 'minute');

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return relativeFormatter.format(-diffHr, 'hour');

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return relativeFormatter.format(-diffDay, 'day');

    return shortDateFormatter.format(date);
};

function isBrowserAddressableImagePath(pathOrUrl: string): boolean {
    try {
        const url = new URL(pathOrUrl, window.location.href);
        return ['http:', 'https:', 'blob:', 'data:', 'asset:'].includes(url.protocol);
    } catch {
        return false;
    }
}

function getDesktopDisplayImagePath(pathOrUrl: string): string {
    if (!isTauriDesktop() || isBrowserAddressableImagePath(pathOrUrl)) return pathOrUrl;
    return convertFileSrc(pathOrUrl);
}

function resolveDirectThumbnailUrl(image: HistoryImage, storageMode: ImageStorageMode): string | undefined {
    if (isExampleHistoryImage(image)) return image.thumbnailPath;
    if (image.path) {
        if (isTauriDesktop() && !isBrowserAddressableImagePath(image.path)) return undefined;
        return getDesktopDisplayImagePath(image.path);
    }
    if (storageMode === 'indexeddb') return undefined;
    return `/api/image/${image.filename}`;
}

export type HistoryImageCardProps = {
    item: HistoryMetadata | ExampleHistoryMetadata;
    itemIndex: number;
    selectionEnabled: boolean;
    isSelected: boolean;
    isSyncing?: boolean;
    showImageSyncBadge: boolean;
    itemIsSynced: boolean;

    openPromptDialogTimestamp: number | null;
    setOpenPromptDialogTimestamp: React.Dispatch<React.SetStateAction<number | null>>;
    openCostDialogTimestamp: number | null;
    setOpenCostDialogTimestamp: React.Dispatch<React.SetStateAction<number | null>>;
    copiedTimestamp: number | null;

    onSelectItem: (id: number) => void;
    onSelectImage: (item: HistoryMetadata) => void;
    onOpenPreview: (image: HistoryImage, storageMode: ImageStorageMode) => void;
    onCopyPrompt: (text: string | null | undefined, timestamp: number) => void | Promise<void>;
    onDownloadItem: (item: HistoryMetadata, event: React.MouseEvent) => void | Promise<void>;
    onSyncHistoryItem?: (item: HistoryMetadata) => void | Promise<void>;
    onSaveToAssetLibrary?: (item: HistoryMetadata) => void | Promise<void>;

    onDeleteItemRequest: (item: HistoryMetadata) => void;
    itemPendingDeleteConfirmation: HistoryMetadata | null;
    onConfirmDeletion: () => void;
    onCancelDeletion: () => void;
    deletePreferenceDialogValue: boolean;
    onDeletePreferenceDialogChange: (isChecked: boolean) => void;
    showRemoteDeleteOption?: boolean;
    deleteRemoteDialogValue?: boolean;
    onDeleteRemoteDialogChange?: (isChecked: boolean) => void;
    onDeleteExampleItem?: (item: ExampleHistoryMetadata) => void;
};

function HistoryImageCardImpl({
    item,
    itemIndex,
    selectionEnabled,
    isSelected,
    isSyncing,
    showImageSyncBadge,
    itemIsSynced,
    openPromptDialogTimestamp,
    setOpenPromptDialogTimestamp,
    openCostDialogTimestamp,
    setOpenCostDialogTimestamp,
    copiedTimestamp,
    onSelectItem,
    onSelectImage,
    onOpenPreview,
    onCopyPrompt,
    onDownloadItem,
    onSyncHistoryItem,
    onSaveToAssetLibrary,
    onDeleteItemRequest,
    itemPendingDeleteConfirmation,
    onConfirmDeletion,
    onCancelDeletion,
    deletePreferenceDialogValue,
    onDeletePreferenceDialogChange,
    showRemoteDeleteOption,
    deleteRemoteDialogValue,
    onDeleteRemoteDialogChange,
    onDeleteExampleItem
}: HistoryImageCardProps) {
    const { language, formatDateTime, t } = useAppLanguage();
    const cardRef = React.useRef<HTMLDivElement | null>(null);
    const shouldEagerLoadThumbnail = itemIndex < HISTORY_THUMBNAIL_EAGER_COUNT;
    const [isVisible, setIsVisible] = React.useState(shouldEagerLoadThumbnail);

    React.useEffect(() => {
        if (isVisible) return;
        const node = cardRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '400px 0px' }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [isVisible]);

    const firstImage = item.images?.[0];
    const imageCount = item.images?.length ?? 0;
    const isMultiImage = imageCount > 1;
    const totalImageSize = item.images.reduce(
        (total, image) => total + (typeof image.size === 'number' ? image.size : 0),
        0
    );
    const hasImageSize = item.images.some((image) => typeof image.size === 'number');
    const imageSizeLabel = hasImageSize ? formatHistoryFileSize(totalImageSize) : null;
    const itemKey = item.timestamp;
    const originalStorageMode = item.storageModeUsed || 'fs';
    const outputFormat = item.output_format || 'png';
    const isExampleItem = isExampleHistoryItem(item);

    const directUrl = firstImage ? resolveDirectThumbnailUrl(firstImage, originalStorageMode) : undefined;
    const idbFilename = !directUrl && firstImage ? firstImage.filename : null;
    const idbUrl = useImageSrc(idbFilename, { enabled: isVisible });
    const thumbnailUrl = directUrl ?? idbUrl;

    const [thumbnailStatus, setThumbnailStatus] = React.useState<'pending' | 'ready' | 'error'>('pending');
    React.useEffect(() => {
        setThumbnailStatus('pending');
    }, [thumbnailUrl]);

    const thumbnailImageReady = thumbnailUrl != null && thumbnailStatus === 'ready';
    const thumbnailLoadFailed = thumbnailStatus === 'error';
    const thumbnailChromeClass = thumbnailImageReady ? 'opacity-100' : 'pointer-events-none opacity-0';

    return (
        <div
            ref={cardRef}
            data-history-card-id={itemKey}
            className={cn(
                'flex flex-col overflow-hidden rounded-xl border border-panel-divider backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-panel-divider hover:shadow-lg hover:shadow-black/10',
                selectionEnabled && isSelected ? 'border-blue-500/30 ring-2 ring-blue-500/60' : ''
            )}>
            {/* -- Thumbnail area -- */}
            <div className='relative'>
                <button
                    onClick={() => {
                        if (selectionEnabled) {
                            onSelectItem(itemKey);
                            return;
                        }
                        if (firstImage) {
                            onOpenPreview(firstImage, originalStorageMode);
                        }
                        if (isExampleItem) return;
                        React.startTransition(() => {
                            onSelectImage(item);
                        });
                    }}
                    data-history-card-open
                    className='focus:ring-primary group/history-thumbnail bg-muted/30 relative block aspect-square w-full cursor-pointer overflow-hidden rounded-none border-0 transition-transform duration-150 focus:ring-2 focus:ring-offset-2 focus:outline-none'
                    aria-label={`查看图片，生成于 ${formatDateTime(item.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}。点击打开完整预览。`}>
                    {!thumbnailImageReady && (
                        <div
                            aria-hidden='true'
                            className='from-muted/80 via-muted/40 to-background/50 absolute inset-0 overflow-hidden bg-gradient-to-br'>
                            <div className='absolute inset-0 animate-pulse bg-panel-ghost' />
                            <div className='absolute inset-0 flex items-center justify-center'>
                                <FileImage className='text-muted-foreground/30 h-7 w-7' />
                            </div>
                        </div>
                    )}
                    {thumbnailUrl && !thumbnailLoadFailed ? (
                        <Image
                            src={thumbnailUrl}
                            alt={`批量生成预览，时间 ${formatDateTime(item.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}`}
                            width={150}
                            height={150}
                            className={cn(
                                'h-full w-full object-cover transition-[opacity,transform] duration-300 ease-out group-hover/history-thumbnail:scale-[1.02]',
                                thumbnailImageReady ? 'opacity-100' : 'opacity-0'
                            )}
                            loading={shouldEagerLoadThumbnail ? 'eager' : 'lazy'}
                            decoding='async'
                            fetchPriority={shouldEagerLoadThumbnail ? 'high' : 'low'}
                            onLoad={() => setThumbnailStatus('ready')}
                            onError={() => setThumbnailStatus('error')}
                            unoptimized
                        />
                    ) : (
                        <div className='bg-muted text-muted-foreground flex h-full w-full items-center justify-center'>
                            <FileImage size={24} />
                        </div>
                    )}
                </button>

                {selectionEnabled && (
                    <div className='absolute top-2 left-2 z-20'>
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onSelectItem(itemKey)}
                            onClick={(e) => e.stopPropagation()}
                            className='h-5 w-5 rounded-full border-2 border-white/70 shadow-lg data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white'
                        />
                    </div>
                )}

                {/* Mode badge — top-left */}
                <div
                    className={cn(
                        'pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm transition-opacity duration-200',
                        thumbnailChromeClass,
                        item.mode === 'edit'
                            ? 'bg-orange-500 text-white'
                            : 'dark:bg-primary/80 bg-violet-600 text-white'
                    )}>
                    {item.mode === 'edit' ? (
                        <Pencil size={11} className='shrink-0' />
                    ) : (
                        <SparklesIcon size={11} className='shrink-0' />
                    )}
                    {item.mode === 'edit' ? '编辑' : '生成'}
                </div>

                {isExampleItem && (
                    <div
                        className={cn(
                            'pointer-events-none absolute top-2 right-2 z-10 flex max-w-[calc(100%-4.75rem)] items-center gap-1 truncate rounded-md border border-white/60 bg-white/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-950 shadow-sm backdrop-blur-sm transition-opacity duration-200 dark:border-white/20 dark:bg-white/75 dark:text-slate-950',
                            thumbnailChromeClass
                        )}>
                        <span className='truncate'>示例 · {item.featureLabel}</span>
                    </div>
                )}

                {/* Multi-image count — bottom-left */}
                {isMultiImage && (
                    <div
                        className={cn(
                            'pointer-events-none absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm transition-opacity duration-200',
                            thumbnailChromeClass
                        )}>
                        <Layers size={12} className='shrink-0' />
                        {imageCount}
                    </div>
                )}

                {showImageSyncBadge &&
                    (itemIsSynced ? (
                        <div
                            className={cn(
                                'absolute right-2 bottom-2 z-20 flex h-8 w-8 items-center justify-center text-emerald-400 drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.7)] transition-opacity duration-200',
                                thumbnailChromeClass
                            )}
                            title='已同步到云存储'
                            aria-label='已同步到云存储'>
                            <Cloud size={18} />
                        </div>
                    ) : (
                        <button
                            type='button'
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isSyncing || !thumbnailImageReady) return;
                                void onSyncHistoryItem?.(item);
                            }}
                            aria-disabled={isSyncing || !thumbnailImageReady}
                            className={cn(
                                'absolute right-2 bottom-2 z-20 flex h-8 w-8 items-center justify-center text-slate-950/75 drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.75)] transition-[opacity,color,filter] duration-200 hover:text-sky-600 hover:drop-shadow-[0_1px_3px_rgb(255_255_255_/_0.95)] aria-disabled:cursor-not-allowed dark:text-on-panel-muted dark:drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.75)] dark:hover:text-sky-300 dark:hover:drop-shadow-[0_1px_3px_rgb(0_0_0_/_0.9)]',
                                thumbnailChromeClass
                            )}
                            title='未同步，点击上传到云存储'
                            aria-label='同步此历史图片到云存储'>
                            {isSyncing ? <Spinner size='md' /> : <CloudUpload size={18} />}
                        </button>
                    ))}

                {/* Cost pill — top-right */}
                {item.costDetails && (
                    <Dialog
                        open={openCostDialogTimestamp === itemKey}
                        onOpenChange={(isOpen) => !isOpen && setOpenCostDialogTimestamp(null)}>
                        <DialogTrigger asChild>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenCostDialogTimestamp(itemKey);
                                }}
                                className={cn(
                                    'absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300 backdrop-blur-sm transition-[opacity,background-color,color] duration-200 hover:bg-black/85 hover:text-emerald-200',
                                    thumbnailChromeClass
                                )}
                                disabled={!thumbnailImageReady}
                                tabIndex={thumbnailImageReady ? 0 : -1}
                                aria-hidden={!thumbnailImageReady}
                                title={`$${formatCostPrecise(item.costDetails.estimated_cost_usd)}`}
                                aria-label={`点击查看费用明细，$${formatCostPrecise(item.costDetails.estimated_cost_usd)}`}>
                                <DollarSign size={11} className='shrink-0' />
                                {formatCostShort(item.costDetails.estimated_cost_usd)}
                            </button>
                        </DialogTrigger>
                        <DialogContent className='border-border bg-background text-foreground sm:max-w-[450px]'>
                            <DialogHeader>
                                <DialogTitle>成本明细</DialogTitle>
                                <DialogDescription className='sr-only'>此图片生成的费用明细。</DialogDescription>
                            </DialogHeader>
                            {(() => {
                                const modelForRates: GptImageModel = isImageModelId(item.model)
                                    ? item.model
                                    : DEFAULT_IMAGE_MODEL;
                                const rates = getModelRates(modelForRates);
                                return (
                                    <>
                                        <div className='text-muted-foreground space-y-1 pt-1 text-xs'>
                                            <p>{modelForRates} 定价:</p>
                                            <ul className='list-disc pl-4'>
                                                <li>Text Input: ${rates.textInputPerMillion} / 1M tokens</li>
                                                <li>Image Input: ${rates.imageInputPerMillion} / 1M tokens</li>
                                                <li>Image Output: ${rates.imageOutputPerMillion} / 1M tokens</li>
                                            </ul>
                                        </div>
                                        <div className='text-muted-foreground space-y-2 py-4 text-sm'>
                                            <div className='flex justify-between'>
                                                <span>文本输入 Token:</span>{' '}
                                                <span>
                                                    {item.costDetails.text_input_tokens.toLocaleString()} (~$
                                                    {calculateCost(
                                                        item.costDetails.text_input_tokens,
                                                        rates.textInputPerToken
                                                    )}
                                                    )
                                                </span>
                                            </div>
                                            {item.costDetails.image_input_tokens > 0 && (
                                                <div className='flex justify-between'>
                                                    <span>图片输入 Token:</span>{' '}
                                                    <span>
                                                        {item.costDetails.image_input_tokens.toLocaleString()} (~$
                                                        {calculateCost(
                                                            item.costDetails.image_input_tokens,
                                                            rates.imageInputPerToken
                                                        )}
                                                        )
                                                    </span>
                                                </div>
                                            )}
                                            <div className='flex justify-between'>
                                                <span>图片输出 Token:</span>{' '}
                                                <span>
                                                    {item.costDetails.image_output_tokens.toLocaleString()} (~$
                                                    {calculateCost(
                                                        item.costDetails.image_output_tokens,
                                                        rates.imageOutputPerToken
                                                    )}
                                                    )
                                                </span>
                                            </div>
                                            <hr className='border-border my-2' />
                                            <div className='text-foreground flex justify-between font-medium'>
                                                <span>总计:</span>
                                                <span>${item.costDetails.estimated_cost_usd.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button
                                        type='button'
                                        variant='secondary'
                                        size='sm'
                                        className='bg-secondary text-secondary-foreground hover:bg-secondary/80'>
                                        关闭
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* -- Metadata & actions -- */}
            <div className='flex flex-col gap-2 p-2'>
                {/* Row 1: Timestamp + Duration */}
                <div className='flex items-center justify-between'>
                    <time
                        title={
                            isExampleItem
                                ? '内置示例'
                                : `生成于 ${formatDateTime(item.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}`
                        }
                        className='text-muted-foreground truncate text-[11px]'>
                        {isExampleItem ? '内置示例' : formatHistoryDateLabel(item.timestamp, language)}
                    </time>
                    <span className='text-muted-foreground shrink-0 text-[11px] tabular-nums'>
                        {formatDuration(item.durationMs)}
                    </span>
                </div>

                {/* Row 2: Model + Quality + Image count tags */}
                <div className='flex flex-wrap items-center gap-1'>
                    <span className='bg-muted/60 text-muted-foreground inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium'>
                        {item.model || DEFAULT_IMAGE_MODEL}
                    </span>
                    {item.quality && (
                        <span className='bg-muted/60 text-muted-foreground inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px]'>
                            {item.quality}
                        </span>
                    )}
                    {item.output_format && (
                        <span className='bg-muted/60 text-muted-foreground inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] uppercase tabular-nums'>
                            {outputFormat}
                        </span>
                    )}
                    {imageSizeLabel && (
                        <span
                            className='bg-muted/60 text-muted-foreground inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] tabular-nums'
                            title={isMultiImage ? '图片总大小' : '文件大小'}>
                            {imageSizeLabel}
                        </span>
                    )}
                    {originalStorageMode === 'indexeddb' && (
                        <span className='bg-muted/60 text-muted-foreground inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px]'>
                            索引
                        </span>
                    )}
                </div>

                {/* Row 3: Background + Moderation (secondary info) */}
                {(item.background || item.moderation) && (
                    <div className='text-muted-foreground/70 flex flex-wrap items-center gap-1.5 text-[11px]'>
                        {item.background && <span>背景 {item.background}</span>}
                        {item.background && item.moderation && (
                            <span className='text-muted-foreground/40'>·</span>
                        )}
                        {item.moderation && <span>审核 {item.moderation}</span>}
                    </div>
                )}

                {/* Row 4: Actions */}
                <div className='flex items-center gap-1 pt-0.5'>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='text-muted-foreground hover:text-foreground h-7 w-7 p-0 sm:h-6 sm:w-auto sm:px-1.5 sm:text-[11px]'
                        onClick={(e) => onDownloadItem(item, e)}
                        aria-label='下载此图片'>
                        <Download size={13} className='shrink-0 opacity-60 sm:mr-1' />
                        <span className='sr-only sm:not-sr-only sm:inline'>下载</span>
                    </Button>
                    <Dialog
                        open={openPromptDialogTimestamp === itemKey}
                        onOpenChange={(isOpen) => !isOpen && setOpenPromptDialogTimestamp(null)}>
                        <DialogTrigger asChild>
                            <Button
                                variant='ghost'
                                size='sm'
                                className='text-muted-foreground hover:text-foreground h-7 w-7 p-0 sm:h-6 sm:w-auto sm:px-1.5 sm:text-[11px]'
                                onClick={() => setOpenPromptDialogTimestamp(itemKey)}>
                                <FileImage size={13} className='shrink-0 opacity-60 sm:mr-1' />
                                <span className='sr-only sm:not-sr-only sm:inline'>查看提示词</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className='border-border bg-background text-foreground sm:max-w-[625px]'>
                            <DialogHeader>
                                <DialogTitle>提示词</DialogTitle>
                                <DialogDescription className='sr-only'>生成此图片使用的完整提示词。</DialogDescription>
                            </DialogHeader>
                            <div
                                className='border-border bg-muted text-foreground max-h-[400px] overflow-y-auto rounded-md border p-3 py-4 text-sm'
                                data-i18n-skip={item.prompt ? 'true' : undefined}>
                                {item.prompt || '提示词为空'}
                            </div>
                            <DialogFooter>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={() => onCopyPrompt(item.prompt, itemKey)}
                                    className='border-border text-muted-foreground hover:bg-accent hover:text-foreground'>
                                    {copiedTimestamp === itemKey ? (
                                        <Check className='mr-2 h-4 w-4 text-green-400' />
                                    ) : (
                                        <Copy className='mr-2 h-4 w-4' />
                                    )}
                                    {copiedTimestamp === itemKey ? '已复制' : '复制'}
                                </Button>
                                <DialogClose asChild>
                                    <Button
                                        type='button'
                                        variant='secondary'
                                        size='sm'
                                        className='bg-secondary text-secondary-foreground hover:bg-secondary/80'>
                                        关闭
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    {!isExampleItem && onSaveToAssetLibrary && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='text-muted-foreground hover:text-foreground h-7 w-7 p-0 sm:h-6 sm:w-auto sm:px-1.5 sm:text-[11px]'
                            onClick={(e) => {
                                e.stopPropagation();
                                void onSaveToAssetLibrary(item as HistoryMetadata);
                            }}
                            aria-label={t('history.action.saveToAssets')}>
                            <Boxes size={13} className='shrink-0 opacity-60 sm:mr-1' />
                            <span className='sr-only sm:not-sr-only sm:inline'>{t('history.action.saveToAssets')}</span>
                        </Button>
                    )}
                    {isExampleItem ? (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='text-muted-foreground/50 hover:text-destructive ml-auto h-6 w-6 p-0'
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteExampleItem?.(item);
                            }}
                            aria-label='删除此示例'>
                            <Trash2 size={13} />
                        </Button>
                    ) : (
                        <Dialog
                            open={itemPendingDeleteConfirmation?.timestamp === item.timestamp}
                            onOpenChange={(isOpen) => {
                                if (!isOpen) onCancelDeletion();
                            }}>
                            <DialogTrigger asChild>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='text-muted-foreground/50 hover:text-destructive ml-auto h-6 w-6 p-0'
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteItemRequest(item);
                                    }}
                                    aria-label='删除此历史条目'>
                                    <Trash2 size={13} />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                                <DialogHeader>
                                    <DialogTitle>确认删除</DialogTitle>
                                    <p className='text-muted-foreground pt-2'>
                                        确定要删除此历史条目吗？将移除 {item.images.length} 张图片。 此操作不可撤销。
                                    </p>
                                </DialogHeader>
                                <div className='flex items-center space-x-2 py-2'>
                                    <Checkbox
                                        id={`dont-ask-${item.timestamp}`}
                                        checked={deletePreferenceDialogValue}
                                        onCheckedChange={(checked) => onDeletePreferenceDialogChange(!!checked)}
                                        className='border-neutral-400 bg-white data-[state=checked]:border-neutral-700 data-[state=checked]:bg-white data-[state=checked]:text-black dark:border-neutral-500 dark:!bg-white'
                                    />
                                    <label
                                        htmlFor={`dont-ask-${item.timestamp}`}
                                        className='text-muted-foreground text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                                        不再询问
                                    </label>
                                </div>
                                {showRemoteDeleteOption && (
                                    <div className='border-border bg-muted/30 flex items-start gap-2 rounded-md border p-2'>
                                        <Checkbox
                                            id={`delete-remote-${item.timestamp}`}
                                            checked={Boolean(deleteRemoteDialogValue)}
                                            onCheckedChange={(checked) =>
                                                onDeleteRemoteDialogChange?.(!!checked)
                                            }
                                            className='mt-0.5 border-neutral-400 bg-white data-[state=checked]:border-neutral-700 data-[state=checked]:bg-white data-[state=checked]:text-black dark:border-neutral-500 dark:!bg-white'
                                        />
                                        <label
                                            htmlFor={`delete-remote-${item.timestamp}`}
                                            className='text-muted-foreground cursor-pointer text-sm leading-5'>
                                            同时删除远端图片
                                        </label>
                                    </div>
                                )}
                                <DialogFooter className='gap-2 sm:justify-end'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={onCancelDeletion}
                                        className='border-border text-muted-foreground hover:bg-accent hover:text-foreground'>
                                        取消
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='destructive'
                                        size='sm'
                                        onClick={onConfirmDeletion}
                                        className='bg-red-600 text-white hover:bg-red-500'>
                                        删除
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>
        </div>
    );
}

export const HistoryImageCard = React.memo(HistoryImageCardImpl);
