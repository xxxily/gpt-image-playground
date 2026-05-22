'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { HistoryImageCard } from '@/components/history/history-image-card';
import { VisionTextHistoryList } from '@/components/history/vision-text-history-list';
import { VisionTextHistoryViewer } from '@/components/history/vision-text-history-viewer';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { WorkbenchCard } from '@/components/ui/workbench-card';
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
import { useVideoAssetSrc } from '@/hooks/useVideoAssetSrc';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ZoomViewer } from '@/components/zoom-viewer';
import { copyTextToClipboard, isTauriDesktop } from '@/lib/desktop-runtime';
import { isExampleHistoryImage, isExampleHistoryItem, type ExampleHistoryMetadata } from '@/lib/example-history';
import type { SyncStatusDetails } from '@/lib/sync/status-details';
import { cn } from '@/lib/utils';
import type { VideoHistoryMetadata, VideoResultAssetRef } from '@/lib/video-types';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
    HistoryImage,
    HistoryImageSyncStatus,
    HistoryMetadata,
    ImageStorageMode,
    VisionTextHistoryMetadata,
    VisionTextSourceImageRef
} from '@/types/history';
import { convertFileSrc } from '@tauri-apps/api/core';
import Image from 'next/image';
import {
    Trash2,
    Download,
    CloudUpload,
    Cloud,
    Clock,
    CalendarClock,
    History as HistoryIcon,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    FolderDown,
    ImageDown,
    Film,
    Play,
    Copy,
    RotateCw,
    Send
} from 'lucide-react';
import * as React from 'react';

type HistoryPanelProps = {
    history: HistoryMetadata[];
    visionTextHistory?: VisionTextHistoryMetadata[];
    videoHistory?: VideoHistoryMetadata[];
    activeHistoryTab?: HistoryPanelTab;
    onHistoryTabChange?: (tab: HistoryPanelTab) => void;
    exampleHistory?: ExampleHistoryMetadata[];
    onSelectImage: (item: HistoryMetadata) => void;
    onSelectVisionTextHistory?: (item: VisionTextHistoryMetadata) => void;
    onOpenVisionTextHistoryViewer?: (item: VisionTextHistoryMetadata, sourceImageIndex: number) => void;
    onDeleteVisionTextHistoryRequest?: (item: VisionTextHistoryMetadata) => void;
    onDeleteSelectedVisionTextHistory?: (ids: string[]) => boolean | void | Promise<boolean | void>;
    onClearVisionTextHistory?: () => void;
    onSelectVideoHistory?: (item: VideoHistoryMetadata) => void;
    onDeleteVideoHistoryRequest?: (item: VideoHistoryMetadata) => void;
    onDeleteSelectedVideoHistory?: (ids: string[]) => boolean | void | Promise<boolean | void>;
    onClearVideoHistory?: () => void;
    onCopyVideoPrompt?: (prompt: string) => void | Promise<void>;
    onCopyVideoTaskId?: (taskId: string) => void | Promise<void>;
    onRegenerateVideoHistory?: (item: VideoHistoryMetadata) => void | Promise<void>;
    onRestoreVideoHistoryToWorkbench?: (item: VideoHistoryMetadata) => void | Promise<void>;
    onSendVisionTextHistoryToGenerator?: (prompt: string) => void;
    onReplacePromptFromVisionTextHistory?: (prompt: string) => void;
    onAppendPromptFromVisionTextHistory?: (prompt: string) => void;
    onClearHistory: () => void;
    getImageSrc: (filename: string) => string | undefined;
    getVisionTextSourceImageSrc?: (ref: VisionTextSourceImageRef) => string | undefined;
    onDeleteItemRequest: (item: HistoryMetadata) => void;
    itemPendingDeleteConfirmation: HistoryMetadata | null;
    onConfirmDeletion: () => void;
    onCancelDeletion: () => void;
    deletePreferenceDialogValue: boolean;
    onDeletePreferenceDialogChange: (isChecked: boolean) => void;
    showRemoteDeleteOption?: boolean;
    deleteRemoteDialogValue?: boolean;
    onDeleteRemoteDialogChange?: (isChecked: boolean) => void;
    onSendToEdit: (filename: string) => void | Promise<void>;
    onDeleteExampleItem?: (item: ExampleHistoryMetadata) => void;
    selectionMode: boolean;
    selectedIds: Set<number>;
    onSelectItem: (id: number) => void;
    onSelectAll: (ids: number[]) => void;
    onReplaceSelectedItems: (ids: number[]) => void;
    onToggleSelectionMode: () => void;
    onDownloadSingle: (item: HistoryMetadata) => void | Promise<void>;
    onDownloadAllSelected: () => void | Promise<void>;
    onDeleteSelected: () => void | Promise<void>;
    onCancelSelection: () => void;
    onSyncUploadMetadata?: () => void | Promise<void>;
    onSyncUploadFull?: (options?: ImageSyncActionOptions) => void | Promise<void>;
    onSyncRestore?: (options?: ImageSyncActionOptions) => void | Promise<void>;
    /** Split restore actions — if provided, these replace the generic onSyncRestore in the menu */
    onSyncRestoreMetadata?: () => void | Promise<void>;
    onSyncRestoreImages?: (options?: ImageSyncActionOptions) => void | Promise<void>;
    onSyncHistoryItem?: (item: HistoryMetadata) => void | Promise<void>;
    onSyncVisionTextHistoryItem?: (item: VisionTextHistoryMetadata) => void | Promise<void>;
    onSyncVideoHistoryItem?: (item: VideoHistoryMetadata) => void | Promise<void>;
    onSyncVisionTextHistoryFull?: (options?: ImageSyncActionOptions) => void | Promise<void>;
    onRestoreVisionTextHistory?: (options?: ImageSyncActionOptions) => void | Promise<void>;
    imageSyncStatuses?: Record<string, HistoryImageSyncStatus | undefined>;
    isSyncing?: boolean;
    /** Legacy simple status label; superseded by syncStatus if both provided */
    syncStatusLabel?: string;
    /** Rich sync/restore status detail */
    syncStatus?: SyncStatusDetails | null;
};

type ImageSyncActionOptions = {
    force?: boolean;
    since?: number;
    historyType?: 'image' | 'vision-text';
    filenames?: string[];
};

type HistoryPanelTab = 'images' | 'vision-text' | 'video';
type RecentSyncAction = 'upload' | 'restore';
type RecentRangeUnit = 'hours' | 'days';
type TranslateFn = ReturnType<typeof useAppLanguage>['t'];

function formatVideoDuration(seconds: number | undefined): string | null {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
    return `${Math.round(seconds)}s`;
}

function getVideoTypeLabel(item: VideoHistoryMetadata, t: TranslateFn): string {
    return item.type === 'image-to-video'
        ? t('video.history.cardType.imageToVideo')
        : t('video.history.cardType.textToVideo');
}

function getVideoStatusLabel(status: VideoHistoryMetadata['job']['status'], t: TranslateFn): string {
    switch (status) {
        case 'queued':
            return t('video.status.queued');
        case 'running':
            return t('video.status.running');
        case 'polling':
            return t('video.status.polling');
        case 'succeeded':
            return t('video.status.succeeded');
        case 'failed':
            return t('video.status.failed');
        case 'cancelled':
            return t('video.status.cancelled');
        case 'expired':
            return t('video.status.expired');
        default:
            return status;
    }
}

function getVideoSyncLabel(status: VideoHistoryMetadata['syncStatus'], t: TranslateFn): string {
    switch (status) {
        case 'synced':
            return t('video.history.syncStatus.synced');
        case 'pending_upload':
            return t('video.history.syncStatus.pending_upload');
        case 'partial':
            return t('video.history.syncStatus.partial');
        case 'conflict':
            return t('video.history.syncStatus.conflict');
        case 'local_only':
        default:
            return t('video.history.syncStatus.local_only');
    }
}

function getVideoPrimaryResult(item: VideoHistoryMetadata): VideoResultAssetRef | undefined {
    return item.resultAssets.find((asset) => asset.kind === 'video') ?? item.resultAssets[0];
}

function getVideoPosterResult(item: VideoHistoryMetadata): VideoResultAssetRef | undefined {
    return item.resultAssets.find((asset) => asset.kind === 'thumbnail');
}

function VideoHistoryCard({
    item,
    selectionMode,
    isSelected,
    onSelectItem,
    onSelectHistory,
    onOpenDetails,
    onDeleteItem,
    onCopyPrompt,
    onCopyTaskId,
    onRegenerate,
    onRestore,
    onSyncItem,
    isSyncing,
    formatDateTime,
    t
}: {
    item: VideoHistoryMetadata;
    selectionMode: boolean;
    isSelected: boolean;
    onSelectItem: (id: string) => void;
    onSelectHistory?: (item: VideoHistoryMetadata) => void;
    onOpenDetails: (item: VideoHistoryMetadata) => void;
    onDeleteItem?: (item: VideoHistoryMetadata) => void;
    onCopyPrompt?: (prompt: string) => void | Promise<void>;
    onCopyTaskId?: (taskId: string) => void | Promise<void>;
    onRegenerate?: (item: VideoHistoryMetadata) => void | Promise<void>;
    onRestore?: (item: VideoHistoryMetadata) => void | Promise<void>;
    onSyncItem?: (item: VideoHistoryMetadata) => void | Promise<void>;
    isSyncing?: boolean;
    formatDateTime: ReturnType<typeof useAppLanguage>['formatDateTime'];
    t: TranslateFn;
}) {
    const primaryResult = getVideoPrimaryResult(item);
    const posterResult = getVideoPosterResult(item);
    const videoSrc = useVideoAssetSrc(primaryResult) ?? item.job.resultRemoteUrl;
    const posterSrc = useVideoAssetSrc(posterResult) ?? item.job.thumbnailRemoteUrl;
    const durationLabel = formatVideoDuration(item.parameters.durationSeconds);
    const metadata = [
        item.providerEndpointName || item.providerKind,
        item.rawModelId,
        durationLabel,
        item.parameters.resolutionTier || item.parameters.size || item.parameters.aspectRatio,
        getVideoStatusLabel(item.job.status, t)
    ].filter(Boolean);

    return (
        <article
            className={cn(
                'app-panel-subtle flex min-w-0 flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] hover:border-panel-divider hover:shadow-lg hover:shadow-black/10',
                selectionMode && isSelected ? 'border-blue-500/35 ring-2 ring-blue-500/60' : ''
            )}>
            <div className='relative bg-muted/35'>
                <button
                    type='button'
                    onClick={() => {
                        if (selectionMode) {
                            onSelectItem(item.id);
                            return;
                        }
                        onSelectHistory?.(item);
                        onOpenDetails(item);
                    }}
                    className='focus:ring-primary relative block aspect-video w-full overflow-hidden focus:ring-2 focus:outline-none'
                    aria-label={t('video.history.viewDetails')}>
                    {posterSrc ? (
                        <Image
                            src={posterSrc}
                            alt=''
                            width={480}
                            height={270}
                            className='h-full w-full object-cover'
                            unoptimized
                        />
                    ) : videoSrc ? (
                        <video src={videoSrc} muted playsInline preload='metadata' className='h-full w-full object-cover' />
                    ) : (
                        <div className='text-muted-foreground flex h-full min-h-28 flex-col items-center justify-center gap-2 text-xs'>
                            <Film className='h-7 w-7 opacity-50' />
                            <span>{t('video.history.pendingRestore')}</span>
                        </div>
                    )}
                </button>
                {selectionMode && (
                    <div className='absolute top-2 left-2 z-20'>
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onSelectItem(item.id)}
                            className='h-5 w-5 rounded-full border-2 border-white/70 shadow-lg data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-foreground'
                        />
                    </div>
                )}
                <span className='pointer-events-none absolute top-2 right-2 rounded-md bg-neutral-950/80 px-1.5 py-0.5 text-[11px] font-medium text-neutral-50 dark:bg-black/75 dark:text-foreground'>
                    {getVideoTypeLabel(item, t)}
                </span>
                {item.sourceAssets.length > 0 && (
                    <span className='pointer-events-none absolute bottom-2 left-2 rounded-md bg-neutral-950/80 px-1.5 py-0.5 text-[11px] font-medium text-neutral-50 dark:bg-black/75 dark:text-foreground'>
                        {t('video.history.metadata.sourceCount', { count: item.sourceAssets.length })}
                    </span>
                )}
                {durationLabel && (
                    <span className='pointer-events-none absolute bottom-2 right-2 rounded-md bg-neutral-950/80 px-1.5 py-0.5 text-[11px] font-medium text-neutral-50 dark:bg-black/75 dark:text-foreground'>
                        {durationLabel}
                    </span>
                )}
            </div>
            <div className='flex min-h-0 flex-1 flex-col gap-2 p-3'>
                <div className='min-w-0'>
                    <p className='line-clamp-2 min-h-[2.5rem] text-sm leading-5 font-medium' data-i18n-skip='true'>
                        {item.prompt}
                    </p>
                    <p className='text-muted-foreground mt-1 truncate text-xs'>{metadata.join(' · ')}</p>
                    <p className='text-muted-foreground mt-0.5 text-xs'>
                        {formatDateTime(item.timestamp, { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                        {getVideoSyncLabel(item.syncStatus, t)}
                    </p>
                </div>
                <div className='mt-auto flex flex-wrap items-center gap-1'>
                    <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                            onSelectHistory?.(item);
                            onOpenDetails(item);
                        }}
                        className='text-muted-foreground hover:text-foreground h-8 rounded-lg px-2 text-xs'>
                        <Play className='mr-1 h-3.5 w-3.5' />
                        {t('video.history.play')}
                    </Button>
                    {onRestore && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => void onRestore(item)}
                            className='text-muted-foreground hover:text-foreground h-8 rounded-lg px-2 text-xs'>
                            <Send className='mr-1 h-3.5 w-3.5' />
                            {t('video.history.restore')}
                        </Button>
                    )}
                    {onRegenerate && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => void onRegenerate(item)}
                            className='text-muted-foreground hover:text-foreground h-8 rounded-lg px-2 text-xs'>
                            <RotateCw className='mr-1 h-3.5 w-3.5' />
                            {t('video.history.rerun')}
                        </Button>
                    )}
                    {onCopyPrompt && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => void onCopyPrompt(item.prompt)}
                            className='text-muted-foreground hover:text-foreground h-8 rounded-lg px-2 text-xs'>
                            <Copy className='mr-1 h-3.5 w-3.5' />
                            {t('video.history.copyPrompt')}
                        </Button>
                    )}
                    {onCopyTaskId && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => void onCopyTaskId(item.id)}
                            className='text-muted-foreground hover:text-foreground h-8 rounded-lg px-2 text-xs'>
                            ID
                        </Button>
                    )}
                    {onSyncItem && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            disabled={isSyncing}
                            onClick={() => void onSyncItem(item)}
                            className='text-muted-foreground hover:text-foreground h-8 rounded-lg px-2 text-xs'>
                            {isSyncing ? <Spinner size='xs' className='mr-1' /> : <CloudUpload className='mr-1 h-3.5 w-3.5' />}
                            {t('video.history.sync')}
                        </Button>
                    )}
                    {onDeleteItem && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => onDeleteItem(item)}
                            className='ml-auto h-8 rounded-lg px-2 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-600'>
                            <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                    )}
                </div>
            </div>
        </article>
    );
}

function VideoHistoryDetailsDialog({
    item,
    open,
    onOpenChange,
    onCopyPrompt,
    onCopyTaskId,
    onRegenerate,
    onRestore,
    formatDateTime,
    t
}: {
    item: VideoHistoryMetadata | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCopyPrompt?: (prompt: string) => void | Promise<void>;
    onCopyTaskId?: (taskId: string) => void | Promise<void>;
    onRegenerate?: (item: VideoHistoryMetadata) => void | Promise<void>;
    onRestore?: (item: VideoHistoryMetadata) => void | Promise<void>;
    formatDateTime: ReturnType<typeof useAppLanguage>['formatDateTime'];
    t: TranslateFn;
}) {
    const primaryResult = item ? getVideoPrimaryResult(item) : undefined;
    const posterResult = item ? getVideoPosterResult(item) : undefined;
    const videoAssetSrc = useVideoAssetSrc(primaryResult);
    const posterAssetSrc = useVideoAssetSrc(posterResult);
    if (!item) return null;
    const videoSrc = videoAssetSrc ?? item.job.resultRemoteUrl;
    const posterSrc = posterAssetSrc ?? item.job.thumbnailRemoteUrl;
    const downloadName = `${item.id}.mp4`;
    const details = [
        [t('video.history.detail.type'), getVideoTypeLabel(item, t)],
        [t('video.history.detail.provider'), item.providerEndpointName || item.providerKind],
        [t('video.history.detail.protocol'), item.providerProtocol],
        [t('video.history.detail.model'), item.rawModelId],
        [t('video.history.detail.status'), getVideoStatusLabel(item.job.status, t)],
        [
            t('video.history.detail.duration'),
            formatVideoDuration(item.parameters.durationSeconds) ?? t('video.form.modelDefault')
        ],
        [t('video.history.detail.aspectRatio'), item.parameters.aspectRatio ?? t('video.form.modelDefault')],
        [
            t('video.history.detail.resolution'),
            item.parameters.resolutionTier ?? item.parameters.size ?? t('video.form.modelDefault')
        ],
        [t('video.history.detail.createdAt'), formatDateTime(item.timestamp, { dateStyle: 'medium', timeStyle: 'short' })],
        [t('video.history.detail.taskId'), item.id]
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='border-border bg-background text-foreground fixed top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 p-0 shadow-none sm:top-[50%] sm:left-[50%] sm:h-[92vh] sm:max-h-[92vh] sm:w-[calc(100vw-1.5rem)] sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:shadow-lg [&>button:last-child]:top-[max(0.375rem,env(safe-area-inset-top))] [&>button:last-child]:z-20 sm:[&>button:last-child]:top-3 sm:[&>button:last-child]:right-3'>
                <DialogHeader className='border-border min-h-14 shrink-0 justify-center border-b px-4 py-2 pr-16 text-left sm:px-5'>
                    <DialogTitle className='text-base leading-tight sm:text-lg'>
                        {t('video.history.detailsTitle')}
                    </DialogTitle>
                    <DialogDescription className='sr-only'>
                        {t('video.history.detailsDescription')}
                    </DialogDescription>
                </DialogHeader>
                <div className='grid min-h-0 flex-1 grid-rows-[minmax(220px,36dvh)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:grid-rows-none'>
                    <div className='bg-muted/20 flex min-h-0 items-center justify-center border-b p-3 lg:border-r lg:border-b-0'>
                        {videoSrc ? (
                            <video
                                src={videoSrc}
                                poster={posterSrc}
                                controls
                                playsInline
                                preload='metadata'
                                className='max-h-full w-full rounded-lg bg-black'
                            />
                        ) : (
                            <div className='text-muted-foreground flex min-h-[240px] flex-col items-center justify-center gap-2 text-sm'>
                                <Film className='h-10 w-10 opacity-45' />
                                <span>{t('video.history.filePendingRestore')}</span>
                            </div>
                        )}
                    </div>
                    <div className='min-h-0 overflow-y-auto p-4'>
                        <div className='grid gap-2 text-sm sm:grid-cols-2'>
                            {details.map(([label, value]) => (
                                <div key={label} className='min-w-0'>
                                    <p className='text-muted-foreground text-xs'>{label}</p>
                                    <p className='truncate font-medium' data-i18n-skip='true'>
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className='border-border bg-muted/35 mt-4 rounded-lg border p-3'>
                            <p className='text-foreground/75 mb-1 text-xs font-medium'>
                                {t('video.history.copyPrompt')}
                            </p>
                            <p className='text-muted-foreground text-sm leading-5 whitespace-pre-wrap' data-i18n-skip='true'>
                                {item.prompt}
                            </p>
                        </div>
                        {item.sourceAssets.length > 0 && (
                            <div className='mt-4'>
                                <p className='text-muted-foreground mb-2 text-xs font-medium'>
                                    {t('video.history.sourceAssets')}
                                </p>
                                <div className='grid gap-2 text-xs'>
                                    {item.sourceAssets.map((source, index) => (
                                        <div
                                            key={`${source.filename}-${index}`}
                                            className='border-border bg-background/60 flex items-center justify-between gap-2 rounded-lg border p-2'>
                                            <span className='truncate font-mono' data-i18n-skip='true'>
                                                {source.filename}
                                            </span>
                                            <span className='text-muted-foreground shrink-0'>{source.role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className='border-border flex shrink-0 flex-wrap gap-2 border-t p-3 sm:justify-end'>
                    {onCopyPrompt && (
                        <Button type='button' variant='outline' size='sm' onClick={() => void onCopyPrompt(item.prompt)}>
                            <Copy className='mr-1 h-3.5 w-3.5' />
                            {t('video.history.copyPrompt')}
                        </Button>
                    )}
                    {onCopyTaskId && (
                        <Button type='button' variant='outline' size='sm' onClick={() => void onCopyTaskId(item.id)}>
                            {t('video.output.copyTaskId')}
                        </Button>
                    )}
                    {videoSrc && (
                        <a
                            href={videoSrc}
                            download={downloadName}
                            className='border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium shadow-xs transition-colors'>
                            <Download className='mr-1 h-3.5 w-3.5' />
                            {t('video.history.download')}
                        </a>
                    )}
                    {onRestore && (
                        <Button type='button' variant='outline' size='sm' onClick={() => void onRestore(item)}>
                            <Send className='mr-1 h-3.5 w-3.5' />
                            {t('video.history.restore')}
                        </Button>
                    )}
                    {onRegenerate && (
                        <Button type='button' size='sm' onClick={() => void onRegenerate(item)}>
                            <RotateCw className='mr-1 h-3.5 w-3.5' />
                            {t('video.history.regenerate')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
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

const formatCostShort = (value: number): string => value.toFixed(2);
const formatCostPrecise = (value: number): string => value.toFixed(4);

type SelectionRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type PreviewImage = {
    src: string;
    filename: string;
    canSendToEdit: boolean;
};

const EMPTY_EXAMPLE_HISTORY: ExampleHistoryMetadata[] = [];
const getNormalizedRect = (startX: number, startY: number, currentX: number, currentY: number): SelectionRect => ({
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY)
});

const rectIntersects = (a: DOMRect, b: SelectionRect): boolean => {
    const bRight = b.left + b.width;
    const bBottom = b.top + b.height;

    return !(a.right < b.left || a.left > bRight || a.bottom < b.top || a.top > bBottom);
};

function HistoryPanelImpl({
    history,
    visionTextHistory = [],
    videoHistory = [],
    activeHistoryTab = 'images',
    onHistoryTabChange,
    exampleHistory,
    onSelectImage,
    onSelectVisionTextHistory,
    onOpenVisionTextHistoryViewer,
    onDeleteVisionTextHistoryRequest,
    onDeleteSelectedVisionTextHistory,
    onClearVisionTextHistory,
    onSelectVideoHistory,
    onDeleteVideoHistoryRequest,
    onDeleteSelectedVideoHistory,
    onClearVideoHistory,
    onCopyVideoPrompt,
    onCopyVideoTaskId,
    onRegenerateVideoHistory,
    onRestoreVideoHistoryToWorkbench,
    onSendVisionTextHistoryToGenerator,
    onReplacePromptFromVisionTextHistory,
    onAppendPromptFromVisionTextHistory,
    onClearHistory,
    getImageSrc,
    getVisionTextSourceImageSrc,
    onDeleteItemRequest,
    itemPendingDeleteConfirmation,
    onConfirmDeletion,
    onCancelDeletion,
    deletePreferenceDialogValue,
    onDeletePreferenceDialogChange,
    showRemoteDeleteOption,
    deleteRemoteDialogValue,
    onDeleteRemoteDialogChange,
    onSendToEdit,
    onDeleteExampleItem,
    selectionMode,
    selectedIds,
    onSelectItem,
    onSelectAll,
    onReplaceSelectedItems,
    onToggleSelectionMode,
    onDownloadSingle,
    onDownloadAllSelected,
    onDeleteSelected,
    onCancelSelection,
    onSyncUploadMetadata,
    onSyncUploadFull,
    onSyncRestore,
    onSyncRestoreMetadata,
    onSyncRestoreImages,
    onSyncHistoryItem,
    onSyncVisionTextHistoryItem,
    onSyncVideoHistoryItem,
    onSyncVisionTextHistoryFull,
    onRestoreVisionTextHistory,
    imageSyncStatuses,
    isSyncing,
    syncStatusLabel,
    syncStatus
}: HistoryPanelProps) {
    const { t, formatDateTime } = useAppLanguage();
    const [openPromptDialogTimestamp, setOpenPromptDialogTimestamp] = React.useState<number | null>(null);
    const [openCostDialogTimestamp, setOpenCostDialogTimestamp] = React.useState<number | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [copiedTimestamp, setCopiedTimestamp] = React.useState<number | null>(null);
    const [previewImage, setPreviewImage] = React.useState<PreviewImage | null>(null);
    const [previewImageList, setPreviewImageList] = React.useState<PreviewImage[]>([]);
    const [previewImageListIndex, setPreviewImageListIndex] = React.useState(0);
    const [visionTextViewerItem, setVisionTextViewerItem] = React.useState<VisionTextHistoryMetadata | null>(null);
    const [visionTextViewerSourceIndex, setVisionTextViewerSourceIndex] = React.useState(0);
    const [visionTextSelectionMode, setVisionTextSelectionMode] = React.useState(false);
    const [selectedVisionTextIds, setSelectedVisionTextIds] = React.useState<Set<string>>(new Set());
    const [videoDetailsItem, setVideoDetailsItem] = React.useState<VideoHistoryMetadata | null>(null);
    const [videoSelectionMode, setVideoSelectionMode] = React.useState(false);
    const [selectedVideoIds, setSelectedVideoIds] = React.useState<Set<string>>(new Set());
    const [selectionRect, setSelectionRect] = React.useState<SelectionRect | null>(null);
    const [syncMenuOpen, setSyncMenuOpen] = React.useState(false);
    const [syncMenuForce, setSyncMenuForce] = React.useState(false);
    const [recentSyncAction, setRecentSyncAction] = React.useState<RecentSyncAction | null>(null);
    const [recentRangeUnit, setRecentRangeUnit] = React.useState<RecentRangeUnit>('days');
    const [recentRangeAmount, setRecentRangeAmount] = React.useState('7');
    const gridRef = React.useRef<HTMLDivElement | null>(null);
    const cardContentRef = React.useRef<HTMLDivElement | null>(null);
    const virtualRegionRef = React.useRef<HTMLDivElement | null>(null);
    const [columnCount, setColumnCount] = React.useState(2);
    const [scrollMargin, setScrollMargin] = React.useState(0);
    const [statusDetailOpen, setStatusDetailOpen] = React.useState(false);
    const dragSelectionRef = React.useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        rafId: number | null;
        latestX: number;
        latestY: number;
        hasStarted: boolean;
        baseSelectedIds: Set<number>;
    } | null>(null);
    const suppressNextClickRef = React.useRef(false);
    const displayHistory = history.length > 0 ? history : (exampleHistory ?? EMPTY_EXAMPLE_HISTORY);
    const showingExampleHistory = history.length === 0 && displayHistory.length > 0;
    const currentHistoryTab = activeHistoryTab ?? 'images';
    const isVisionTextTab = currentHistoryTab === 'vision-text';
    const isVideoTab = currentHistoryTab === 'video';
    const selectionEnabled = selectionMode && !showingExampleHistory && !isVisionTextTab && !isVideoTab;
    const visionTextSelectionEnabled = isVisionTextTab && visionTextSelectionMode;
    const videoSelectionEnabled = isVideoTab && videoSelectionMode;
    const activeHistoryCount = isVideoTab ? videoHistory.length : isVisionTextTab ? visionTextHistory.length : history.length;
    const activeSelectionMode = isVideoTab ? videoSelectionMode : isVisionTextTab ? visionTextSelectionMode : selectionMode;
    const activeSelectedCount = isVideoTab
        ? selectedVideoIds.size
        : isVisionTextTab
          ? selectedVisionTextIds.size
          : selectedIds.size;
    const historyTabs: Array<{ value: HistoryPanelTab; label: string; count: number }> = [
        { value: 'images', label: '图片', count: showingExampleHistory ? displayHistory.length : history.length },
        { value: 'vision-text', label: '图生文', count: visionTextHistory.length },
        { value: 'video', label: t('video.history.tab'), count: videoHistory.length }
    ];

    // Detect grid column count from the scroll container's width.
    // Mirrors the Tailwind breakpoints used in the existing grid markup.
    React.useEffect(() => {
        const compute = (width: number): number => {
            if (width >= 1024) return 5;
            if (width >= 768) return 4;
            if (width >= 640) return 3;
            return 2;
        };
        const node = cardContentRef.current;
        if (!node) return;
        setColumnCount(compute(node.clientWidth));
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setColumnCount(compute(entry.contentRect.width));
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const rowCount = Math.max(1, Math.ceil(displayHistory.length / Math.max(1, columnCount)));
    const rowVirtualizer = useVirtualizer({
        count: displayHistory.length === 0 ? 0 : rowCount,
        getScrollElement: () => cardContentRef.current,
        estimateSize: () => 320,
        overscan: 4,
        scrollMargin,
        getItemKey: (rowIndex) => {
            const item = displayHistory[rowIndex * Math.max(1, columnCount)];
            return item ? item.timestamp : rowIndex;
        }
    });

    // Track the virtual region's offsetTop within the scroll container so the
    // virtualizer can correctly map scroll positions to row indices when there
    // is a toolbar above the grid.
    React.useEffect(() => {
        const region = virtualRegionRef.current;
        const scroller = cardContentRef.current;
        if (!region || !scroller) return;
        const update = () => {
            let next = 0;
            let node: HTMLElement | null = region;
            while (node && node !== scroller) {
                next += node.offsetTop;
                node = node.offsetParent as HTMLElement | null;
            }
            setScrollMargin((prev) => (prev === next ? prev : next));
        };
        update();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(update);
        observer.observe(scroller);
        observer.observe(region);
        return () => observer.disconnect();
    }, [isVisionTextTab, displayHistory.length, columnCount]);

    React.useEffect(() => {
        if (currentHistoryTab === 'vision-text') {
            onCancelSelection();
            setVideoSelectionMode(false);
            setSelectedVideoIds(new Set());
            return;
        }
        if (currentHistoryTab === 'video') {
            onCancelSelection();
            setVisionTextSelectionMode(false);
            setSelectedVisionTextIds(new Set());
            return;
        }
        setVisionTextSelectionMode(false);
        setSelectedVisionTextIds(new Set());
        setVideoSelectionMode(false);
        setSelectedVideoIds(new Set());
    }, [currentHistoryTab, onCancelSelection]);

    React.useEffect(() => {
        if (selectedVisionTextIds.size === 0) return;
        const validIds = new Set(visionTextHistory.map((item) => item.id));
        const next = new Set(Array.from(selectedVisionTextIds).filter((id) => validIds.has(id)));
        if (next.size === selectedVisionTextIds.size) return;
        setSelectedVisionTextIds(next);
        if (next.size === 0) setVisionTextSelectionMode(false);
    }, [selectedVisionTextIds, visionTextHistory]);

    React.useEffect(() => {
        if (selectedVideoIds.size === 0) return;
        const validIds = new Set(videoHistory.map((item) => item.id));
        const next = new Set(Array.from(selectedVideoIds).filter((id) => validIds.has(id)));
        if (next.size === selectedVideoIds.size) return;
        setSelectedVideoIds(next);
        if (next.size === 0) setVideoSelectionMode(false);
    }, [selectedVideoIds, videoHistory]);

    React.useEffect(
        () => () => {
            const dragState = dragSelectionRef.current;
            if (dragState?.rafId !== null && dragState?.rafId !== undefined) {
                window.cancelAnimationFrame(dragState.rafId);
            }
        },
        []
    );

    const hasHistoryUploadActions = Boolean(onSyncUploadFull || onSyncVisionTextHistoryFull);
    const hasHistoryRestoreActions = Boolean(onSyncRestore || onSyncRestoreImages || onRestoreVisionTextHistory);
    const hasSyncActions = Boolean(
        onSyncUploadMetadata || hasHistoryUploadActions || onSyncRestoreMetadata || hasHistoryRestoreActions
    );
    const activeHistoryNoun = '历史';
    const getImageSyncStatus = React.useCallback(
        (image: HistoryImage): HistoryImageSyncStatus => {
            return image.syncStatus ?? imageSyncStatuses?.[image.filename] ?? 'local_only';
        },
        [imageSyncStatuses]
    );

    const isHistoryItemSynced = React.useCallback(
        (item: HistoryMetadata) =>
            item.images.length > 0 && item.images.every((image) => getImageSyncStatus(image) === 'synced'),
        [getImageSyncStatus]
    );

    const { totalCost, totalImages } = React.useMemo(() => {
        let cost = 0;
        let images = 0;
        history.forEach((item) => {
            if (item.costDetails) {
                cost += item.costDetails.estimated_cost_usd;
            }
            images += item.images?.length ?? 0;
        });

        return { totalCost: Math.round(cost * 10000) / 10000, totalImages: images };
    }, [history]);

    const averageCost = totalImages > 0 ? totalCost / totalImages : 0;

    const handleCopy = async (text: string | null | undefined, timestamp: number) => {
        if (!text) return;
        const copied = await copyTextToClipboard(text);
        if (copied) {
            setCopiedTimestamp(timestamp);
            setTimeout(() => setCopiedTimestamp(null), 1500);
        } else {
            console.error('Failed to copy text.');
        }
    };

    const getHistoryImageSrc = React.useCallback(
        (image: HistoryImage, storageMode: ImageStorageMode) => {
            if (isExampleHistoryImage(image)) return image.thumbnailPath;
            if (image.path) {
                if (isTauriDesktop() && !isBrowserAddressableImagePath(image.path)) {
                    return getImageSrc(image.filename);
                }

                return getDesktopDisplayImagePath(image.path);
            }

            if (storageMode === 'indexeddb') {
                return getImageSrc(image.filename);
            }

            return `/api/image/${image.filename}`;
        },
        [getImageSrc]
    );

    const getHistoryPreviewImageSrc = React.useCallback(
        (image: HistoryImage, storageMode: ImageStorageMode) => {
            if (isExampleHistoryImage(image)) return image.previewPath;

            return getHistoryImageSrc(image, storageMode);
        },
        [getHistoryImageSrc]
    );

    const getHistoryPreviewImages = React.useCallback((): PreviewImage[] => {
        return displayHistory.flatMap((item) => {
            const storageMode = item.storageModeUsed || 'fs';

            return (item.images ?? []).flatMap((image) => {
                const src = getHistoryPreviewImageSrc(image, storageMode);
                return src ? [{ src, filename: image.filename, canSendToEdit: !isExampleHistoryImage(image) }] : [];
            });
        });
    }, [displayHistory, getHistoryPreviewImageSrc]);

    const handleOpenPreview = React.useCallback(
        (image: HistoryImage, storageMode: ImageStorageMode) => {
            const src = getHistoryPreviewImageSrc(image, storageMode);
            if (!src) return;

            const list = getHistoryPreviewImages();
            const currentIndex = list.findIndex(
                (preview) => preview.filename === image.filename && preview.src === src
            );
            const nextIndex = currentIndex >= 0 ? currentIndex : 0;

            setPreviewImage(
                list[nextIndex] ?? { src, filename: image.filename, canSendToEdit: !isExampleHistoryImage(image) }
            );
            setPreviewImageList(list.length > 1 ? list : []);
            setPreviewImageListIndex(nextIndex);
        },
        [getHistoryPreviewImageSrc, getHistoryPreviewImages]
    );

    const scrollToEditForm = React.useCallback(() => {
        const editFormAnchor = document.querySelector<HTMLElement>('[data-editing-form-anchor]');

        if (editFormAnchor) {
            editFormAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handlePreviewSendToEdit = React.useCallback(async () => {
        if (!previewImage) return;
        if (!previewImage.canSendToEdit) return;

        await onSendToEdit(previewImage.filename);
        setPreviewImage(null);
        scrollToEditForm();
    }, [onSendToEdit, previewImage, scrollToEditForm]);

    const handleDownloadItem = React.useCallback(
        async (item: HistoryMetadata, e: React.MouseEvent) => {
            e.stopPropagation();
            await onDownloadSingle(item);
        },
        [onDownloadSingle]
    );

    const updateDragSelection = React.useCallback(
        (currentX: number, currentY: number) => {
            const rect = getNormalizedRect(
                dragSelectionRef.current?.startX ?? currentX,
                dragSelectionRef.current?.startY ?? currentY,
                currentX,
                currentY
            );

            setSelectionRect(rect);

            if (!gridRef.current) return;

            const dragState = dragSelectionRef.current;
            const nextSelectedIds = new Set(dragState?.baseSelectedIds ?? selectedIds);
            const cards = gridRef.current.querySelectorAll<HTMLElement>('[data-history-card-id]');

            cards.forEach((card) => {
                const rawId = card.dataset.historyCardId;
                if (!rawId) return;

                if (rectIntersects(card.getBoundingClientRect(), rect)) {
                    nextSelectedIds.add(Number(rawId));
                }
            });

            onReplaceSelectedItems(Array.from(nextSelectedIds));
        },
        [onReplaceSelectedItems, selectedIds]
    );

    const handleGridPointerDown = React.useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!selectionEnabled) return;
            if (event.pointerType !== 'mouse') return;
            if (event.button !== 0) return;

            const target = event.target;
            if (!(target instanceof HTMLElement)) return;

            const openPreviewTrigger = target.closest('[data-history-card-open]');
            const blockedInteractive = target.closest('input,label,a,[data-slot="dialog-trigger"],[role="checkbox"]');
            const button = target.closest('button');

            if (blockedInteractive || (button && !openPreviewTrigger)) return;

            dragSelectionRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                rafId: null,
                latestX: event.clientX,
                latestY: event.clientY,
                hasStarted: false,
                baseSelectedIds: new Set(selectedIds)
            };
        },
        [selectedIds, selectionEnabled]
    );

    const handleGridPointerMove = React.useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const dragState = dragSelectionRef.current;
            if (!dragState || dragState.pointerId !== event.pointerId) return;

            dragState.latestX = event.clientX;
            dragState.latestY = event.clientY;

            if (!dragState.hasStarted) {
                const deltaX = Math.abs(event.clientX - dragState.startX);
                const deltaY = Math.abs(event.clientY - dragState.startY);

                if (Math.max(deltaX, deltaY) < 6) return;

                dragState.hasStarted = true;
                suppressNextClickRef.current = true;
                event.preventDefault();
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.setPointerCapture(event.pointerId);
                }
                setSelectionRect(getNormalizedRect(dragState.startX, dragState.startY, event.clientX, event.clientY));
            }

            if (dragState.rafId !== null) return;

            dragState.rafId = window.requestAnimationFrame(() => {
                dragState.rafId = null;
                updateDragSelection(dragState.latestX, dragState.latestY);
            });
        },
        [updateDragSelection]
    );

    const finishDragSelection = React.useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const dragState = dragSelectionRef.current;
            if (!dragState || dragState.pointerId !== event.pointerId) return;

            if (dragState.rafId !== null) {
                window.cancelAnimationFrame(dragState.rafId);
                dragState.rafId = null;
            }

            if (dragState.hasStarted) {
                updateDragSelection(dragState.latestX, dragState.latestY);
            }
            dragSelectionRef.current = null;
            setSelectionRect(null);

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        },
        [updateDragSelection]
    );

    const handleGridClickCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!suppressNextClickRef.current) return;

        suppressNextClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const openRecentSyncDialog = React.useCallback((action: RecentSyncAction) => {
        setRecentSyncAction(action);
        setRecentRangeUnit('days');
        setRecentRangeAmount('7');
        setSyncMenuOpen(false);
    }, []);

    const runFullHistoryUpload = React.useCallback(
        async (options?: ImageSyncActionOptions) => {
            if (onSyncUploadFull) await onSyncUploadFull(options);
            if (onSyncVisionTextHistoryFull) await onSyncVisionTextHistoryFull(options);
        },
        [onSyncUploadFull, onSyncVisionTextHistoryFull]
    );

    const runFullHistoryRestore = React.useCallback(
        async (options?: ImageSyncActionOptions) => {
            const hasSplitRestoreActions = Boolean(onSyncRestoreImages || onRestoreVisionTextHistory);

            if (hasSplitRestoreActions) {
                if (onSyncRestoreImages) await onSyncRestoreImages(options);
                if (onRestoreVisionTextHistory) await onRestoreVisionTextHistory(options);
                return;
            }

            if (onSyncRestore) await onSyncRestore(options);
        },
        [onRestoreVisionTextHistory, onSyncRestore, onSyncRestoreImages]
    );

    const recentRangeValue = Number(recentRangeAmount);
    const recentRangeIsValid = Number.isFinite(recentRangeValue) && recentRangeValue > 0;
    const handleConfirmRecentSync = React.useCallback(() => {
        if (!recentSyncAction || !recentRangeIsValid) return;

        const amount = Math.max(1, Math.floor(recentRangeValue));
        const durationMs = amount * (recentRangeUnit === 'hours' ? 3600000 : 86400000);
        const since = Date.now() - durationMs;
        const action = recentSyncAction;

        setRecentSyncAction(null);
        if (action === 'upload') {
            void runFullHistoryUpload({ since });
            return;
        }

        void runFullHistoryRestore({ since });
    }, [
        recentRangeIsValid,
        recentRangeUnit,
        recentRangeValue,
        recentSyncAction,
        runFullHistoryRestore,
        runFullHistoryUpload
    ]);

    const handleVisionTextSelectItem = React.useCallback((id: string) => {
        setSelectedVisionTextIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleVisionTextSelectAll = React.useCallback(() => {
        setSelectedVisionTextIds((prev) =>
            prev.size === visionTextHistory.length ? new Set() : new Set(visionTextHistory.map((item) => item.id))
        );
    }, [visionTextHistory]);

    const handleDeleteSelectedVisionText = React.useCallback(async () => {
        if (selectedVisionTextIds.size === 0) return;
        const result = await onDeleteSelectedVisionTextHistory?.(Array.from(selectedVisionTextIds));
        if (result === false) return;
        setSelectedVisionTextIds(new Set());
        setVisionTextSelectionMode(false);
    }, [onDeleteSelectedVisionTextHistory, selectedVisionTextIds]);

    const handleVideoSelectItem = React.useCallback((id: string) => {
        setSelectedVideoIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleVideoSelectAll = React.useCallback(() => {
        setSelectedVideoIds((prev) =>
            prev.size === videoHistory.length ? new Set() : new Set(videoHistory.map((item) => item.id))
        );
    }, [videoHistory]);

    const handleDeleteSelectedVideo = React.useCallback(async () => {
        if (selectedVideoIds.size === 0) return;
        const result = await onDeleteSelectedVideoHistory?.(Array.from(selectedVideoIds));
        if (result === false) return;
        setSelectedVideoIds(new Set());
        setVideoSelectionMode(false);
    }, [onDeleteSelectedVideoHistory, selectedVideoIds]);

    const handleOpenVisionTextViewer = React.useCallback(
        (item: VisionTextHistoryMetadata, sourceImageIndex: number) => {
            setVisionTextViewerItem(item);
            setVisionTextViewerSourceIndex(sourceImageIndex);
            onOpenVisionTextHistoryViewer?.(item, sourceImageIndex);
        },
        [onOpenVisionTextHistoryViewer]
    );

    const getVisionTextSourceSrc = React.useCallback(
        (ref: VisionTextSourceImageRef) => getVisionTextSourceImageSrc?.(ref),
        [getVisionTextSourceImageSrc]
    );

    return (
        <>
            <div className='flex h-full w-full min-w-0 flex-col gap-2'>
                <div className='border-border/60 flex shrink-0 items-center justify-between gap-2 border-b pb-2'>
                    <div className='flex min-w-0 flex-1 items-center gap-2'>
                        <div
                            className='flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                            role='tablist'
                            aria-label='历史类型'>
                            {historyTabs.map((tab) => {
                                const selected = tab.value === currentHistoryTab;
                                return (
                                    <button
                                        key={tab.value}
                                        type='button'
                                        role='tab'
                                        aria-selected={selected}
                                        onClick={() => onHistoryTabChange?.(tab.value)}
                                        className={cn(
                                            'text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none inline-flex h-9 shrink-0 items-center gap-2 rounded-md border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors',
                                            selected && 'border-primary bg-accent text-foreground'
                                        )}>
                                        <span>{tab.label}</span>
                                        <span
                                            className={cn(
                                                'rounded-full px-1.5 py-0.5 text-[11px] leading-none',
                                                selected
                                                    ? 'bg-background/70 text-foreground'
                                                    : 'bg-muted text-muted-foreground'
                                            )}>
                                            {tab.count.toLocaleString()}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {hasSyncActions && (
                            <Popover open={syncMenuOpen} onOpenChange={setSyncMenuOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        type='button'
                                        disabled={isSyncing}
                                        aria-label='云同步历史操作'
                                        className='text-muted-foreground hover:bg-accent hover:text-foreground h-9 w-9 shrink-0 rounded-md p-0 transition-colors'>
                                        {isSyncing ? <Spinner size='md' /> : <Cloud size={15} />}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align='end'
                                    sideOffset={8}
                                    className='w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-xl p-1 shadow-lg shadow-black/10'>
                                    {(onSyncUploadMetadata || hasHistoryUploadActions) && (
                                        <div role='group' aria-label='上传到云存储'>
                                            <div className='px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
                                                ↑ 上传到云存储
                                            </div>
                                            {onSyncUploadMetadata && (
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        setSyncMenuOpen(false);
                                                        void onSyncUploadMetadata();
                                                    }}
                                                    className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors'>
                                                    <CloudUpload size={14} className='shrink-0' />
                                                    仅配置
                                                </button>
                                            )}
                                            {hasHistoryUploadActions && (
                                                <>
                                                    <button
                                                        type='button'
                                                        onClick={() => {
                                                            setSyncMenuOpen(false);
                                                            void runFullHistoryUpload({ force: syncMenuForce });
                                                        }}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors'>
                                                        <CloudUpload size={14} className='shrink-0' />
                                                        完整历史
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => openRecentSyncDialog('upload')}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors'>
                                                        <CalendarClock size={14} className='shrink-0' />
                                                        最近历史
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {(onSyncRestoreMetadata || hasHistoryRestoreActions) && (
                                        <div className='bg-border my-1 h-px' />
                                    )}
                                    {(onSyncRestoreMetadata || hasHistoryRestoreActions) && (
                                        <div role='group' aria-label='从云存储恢复'>
                                            <div className='px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'>
                                                ↓ 从云存储恢复
                                            </div>
                                            {onSyncRestoreMetadata && (
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        setSyncMenuOpen(false);
                                                        void onSyncRestoreMetadata();
                                                    }}
                                                    className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors'>
                                                    <FolderDown size={14} className='shrink-0' />
                                                    仅配置
                                                </button>
                                            )}
                                            {hasHistoryRestoreActions && (
                                                <>
                                                    <button
                                                        type='button'
                                                        onClick={() => {
                                                            setSyncMenuOpen(false);
                                                            void runFullHistoryRestore({ force: syncMenuForce });
                                                        }}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors'>
                                                        <ImageDown size={14} className='shrink-0' />
                                                        完整历史
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => openRecentSyncDialog('restore')}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors'>
                                                        <CalendarClock size={14} className='shrink-0' />
                                                        最近历史
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {(hasHistoryUploadActions || hasHistoryRestoreActions) && (
                                        <>
                                            <div className='bg-border my-1 h-px' />
                                            <label
                                                className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors'>
                                                <Checkbox
                                                    checked={syncMenuForce}
                                                    onCheckedChange={(value) => setSyncMenuForce(value === true)}
                                                    aria-label='强制覆盖：忽略时间戳与冲突检查'
                                                />
                                                <span>强制覆盖（忽略时间戳与冲突）</span>
                                            </label>
                                        </>
                                    )}
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                </div>

                <WorkbenchCard className='min-h-0'>
                    <CardHeader className='border-panel-divider flex flex-row items-center justify-between gap-3 border-b px-4 py-3'>
                        <div className={cn('flex min-w-0 items-center gap-2', activeSelectionMode && 'hidden sm:flex')}>
                            <CardTitle
                                className='text-muted-foreground hover:text-foreground inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg'
                                title={isVideoTab ? '视频历史' : isVisionTextTab ? '图生文历史' : '图片历史'}
                                aria-label={isVideoTab ? '视频历史' : isVisionTextTab ? '图生文历史' : '图片历史'}>
                                {isVideoTab ? <Film size={18} aria-hidden='true' /> : <HistoryIcon size={18} aria-hidden='true' />}
                            </CardTitle>
                            {totalCost > 0 && !isVisionTextTab && (
                                <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                                    <DialogTrigger asChild>
                                        <button
                                            className='mt-0.5 flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/12 px-2 py-0.5 text-[12px] text-emerald-700 transition-colors hover:bg-emerald-500/18 dark:bg-emerald-600/20 dark:text-emerald-300 dark:hover:bg-emerald-600/30'
                                            title={`总计: $${formatCostPrecise(totalCost)}`}
                                            aria-label={`Show total cost summary, $${formatCostPrecise(totalCost)}`}>
                                            总计: ${formatCostShort(totalCost)}
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className='border-border bg-background text-foreground sm:max-w-[450px]'>
                                        <DialogHeader>
                                            <DialogTitle>成本总计</DialogTitle>
                                            {/* Add sr-only description for accessibility */}
                                            <DialogDescription className='sr-only'>
                                                历史中所有已生成图片的总费用估算。
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className='text-muted-foreground space-y-1 pt-1 text-xs'>
                                            <p className='font-medium'>gpt-image-2:</p>
                                            <ul className='list-disc pl-4'>
                                                <li>Text Input: $5 / 1M tokens</li>
                                                <li>Image Input: $8 / 1M tokens</li>
                                                <li>Image Output: $30 / 1M tokens</li>
                                            </ul>
                                            <p className='mt-2 font-medium'>gpt-image-1.5:</p>
                                            <ul className='list-disc pl-4'>
                                                <li>Text Input: $5 / 1M tokens</li>
                                                <li>Image Input: $8 / 1M tokens</li>
                                                <li>Image Output: $32 / 1M tokens</li>
                                            </ul>
                                            <p className='mt-2 font-medium'>gpt-image-1:</p>
                                            <ul className='list-disc pl-4'>
                                                <li>Text Input: $5 / 1M tokens</li>
                                                <li>Image Input: $10 / 1M tokens</li>
                                                <li>Image Output: $40 / 1M tokens</li>
                                            </ul>
                                            <p className='mt-2 font-medium'>gpt-image-1-mini:</p>
                                            <ul className='list-disc pl-4'>
                                                <li>Text Input: $2 / 1M tokens</li>
                                                <li>Image Input: $2.50 / 1M tokens</li>
                                                <li>Image Output: $8 / 1M tokens</li>
                                            </ul>
                                            <p className='mt-2 font-medium'>Gemini Nano Banana 2:</p>
                                            <ul className='list-disc pl-4'>
                                                <li>Usage is recorded when returned by Google.</li>
                                                <li>
                                                    Cost is shown as $0 until stable public token pricing is configured.
                                                </li>
                                            </ul>
                                        </div>
                                        <div className='text-muted-foreground space-y-2 py-4 text-sm'>
                                            <div className='flex justify-between'>
                                                <span>生成图片总数:</span> <span>{totalImages.toLocaleString()}</span>
                                            </div>
                                            <div className='flex justify-between'>
                                                <span>每张图片平均费用:</span>{' '}
                                                <span>${formatCostPrecise(averageCost)}</span>
                                            </div>
                                            <hr className='border-border my-2' />
                                            <div className='text-foreground flex justify-between font-medium'>
                                                <span>估算总费用:</span>
                                                <span>${formatCostPrecise(totalCost)}</span>
                                            </div>
                                        </div>
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
                        {activeHistoryCount > 0 && (
                            <div className='flex items-center gap-1.5'>
                                {activeHistoryCount >= 2 && (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => {
                                            if (isVideoTab) {
                                                setVideoSelectionMode((value) => !value);
                                                setSelectedVideoIds(new Set());
                                                return;
                                            }
                                            if (isVisionTextTab) {
                                                setVisionTextSelectionMode((value) => !value);
                                                setSelectedVisionTextIds(new Set());
                                                return;
                                            }
                                            onToggleSelectionMode();
                                        }}
                                        className={cn(
                                            'text-muted-foreground hover:bg-accent hover:text-foreground h-auto rounded-lg px-2.5 py-1 transition-colors',
                                            activeSelectionMode ? 'bg-accent text-foreground' : ''
                                        )}>
                                        {activeSelectionMode ? '退出多选' : '多选'}
                                    </Button>
                                )}
                                {activeSelectionMode && (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => {
                                            if (isVideoTab) {
                                                handleVideoSelectAll();
                                                return;
                                            }
                                            if (isVisionTextTab) {
                                                handleVisionTextSelectAll();
                                                return;
                                            }
                                            if (selectedIds.size === history.length) onSelectAll([]);
                                            else onSelectAll(history.map((h) => h.timestamp));
                                        }}
                                        className='text-muted-foreground hover:bg-accent hover:text-foreground h-auto rounded-lg px-2.5 py-1 transition-colors'>
                                        {activeSelectedCount === activeHistoryCount ? '清除已选' : '全选'}
                                    </Button>
                                )}
                                {activeHistoryCount > 0 && (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={isVideoTab ? onClearVideoHistory : isVisionTextTab ? onClearVisionTextHistory : onClearHistory}
                                        className='text-muted-foreground hover:bg-accent hover:text-foreground h-auto rounded-lg px-2.5 py-1 transition-colors'>
                                        清空
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardHeader>
                    {(() => {
                        const s =
                            syncStatus ??
                            (syncStatusLabel
                                ? { operation: '', operationLabel: syncStatusLabel, inProgress: false, done: false }
                                : null);
                        if (!s && !syncStatusLabel) return null;

                        const active = s && (s.inProgress || !s.done);
                        const legacyLabel = !s && syncStatusLabel;

                        return (
                            <div className='mt-0 border-b border-panel-divider bg-violet-500/5'>
                                <div className='flex items-center gap-2 px-3 py-1.5'>
                                    {active ? (
                                        <Spinner size="xs" className="shrink-0 text-violet-400" />
                                    ) : s?.done ? (
                                        <Cloud
                                            size={12}
                                            className={cn(
                                                'shrink-0',
                                                s.success ? 'text-emerald-400' : 'text-amber-400'
                                            )}
                                        />
                                    ) : legacyLabel ? (
                                        <Cloud size={12} className='shrink-0 text-violet-400' />
                                    ) : (
                                        <Cloud size={12} className='shrink-0 text-violet-400' />
                                    )}
                                    <span className='truncate text-[11px] text-violet-300/80'>
                                        {legacyLabel
                                            ? syncStatusLabel
                                            : (s?.operationLabel ?? s?.operation ?? '同步中')}
                                    </span>
                                    {s && s.inProgress && s.progress !== undefined && (
                                        <span className='ml-auto shrink-0 text-[11px] text-violet-400 tabular-nums'>
                                            {s.progress}%
                                        </span>
                                    )}
                                    {s && s.done && (
                                        <button
                                            type='button'
                                            onClick={() => setStatusDetailOpen((v) => !v)}
                                            className='ml-auto flex min-h-8 shrink-0 items-center gap-0.5 rounded px-2 py-1 text-[11px] text-violet-400/70 hover:text-violet-300'
                                            aria-expanded={statusDetailOpen}
                                            aria-label={statusDetailOpen ? '收起详情' : '展开详情'}>
                                            {statusDetailOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </button>
                                    )}
                                </div>

                                {s && (statusDetailOpen || s.inProgress) && (
                                    <div className='text-muted-foreground border-t border-panel-divider px-3 py-2 text-[11px]'>
                                        {s.total != null && s.total > 0 && (
                                            <div className='mb-2'>
                                                <div className='mb-1 flex items-center justify-between'>
                                                    <span>
                                                        {s.completed ?? 0} / {s.total}
                                                    </span>
                                                    <span className='tabular-nums'>
                                                        {s.failed != null && s.failed > 0 && (
                                                            <span className='text-red-400'>{s.failed} 失败</span>
                                                        )}
                                                        {s.failed != null &&
                                                            s.failed > 0 &&
                                                            s.skipped != null &&
                                                            s.skipped > 0 &&
                                                            ' · '}
                                                        {s.skipped != null && s.skipped > 0 && (
                                                            <span className='text-amber-400'>{s.skipped} 跳过</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className='h-1 overflow-hidden rounded-full bg-violet-500/15'>
                                                    <div
                                                        className='h-full rounded-full bg-violet-400 transition-[width]'
                                                        style={{
                                                            width: `${Math.min(100, Math.round(((s.completed ?? 0) / s.total) * 100))}%`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className='text-muted-foreground/80 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]'>
                                            {s.target && (
                                                <span className='truncate' title={s.target}>
                                                    目标: {s.target}
                                                </span>
                                            )}
                                            {s.bucket && <span>Bucket: {s.bucket}</span>}
                                            {s.basePrefix && (
                                                <span className='truncate' title={s.basePrefix}>
                                                    前缀: {s.basePrefix}
                                                </span>
                                            )}
                                            {s.snapshotId && <span>快照: {s.snapshotId}</span>}
                                            {s.manifestCreatedAt && (
                                                <span>
                                                    快照时间:{' '}
                                                    {formatDateTime(s.manifestCreatedAt, {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short'
                                                    })}
                                                </span>
                                            )}
                                            {s.startedAt && (
                                                <span className='flex items-center gap-0.5'>
                                                    <Clock size={10} className='shrink-0' />
                                                    {formatDateTime(s.startedAt, {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short'
                                                    })}
                                                </span>
                                            )}
                                            {(s.elapsedMs != null || (s.startedAt && s.completedAt)) && (
                                                <span className='tabular-nums'>
                                                    {formatDuration(s.elapsedMs ?? s.completedAt! - s.startedAt!)}
                                                </span>
                                            )}
                                            {s.success === true && <span className='text-emerald-400'>成功</span>}
                                            {s.success === false && <span className='text-red-400'>失败</span>}
                                        </div>

                                        {s.errors && s.errors.length > 0 && (
                                            <div className='mt-2 space-y-1'>
                                                {s.errors.map((err, i) => (
                                                    <div key={i} className='flex items-start gap-1.5 text-red-400/90'>
                                                        <AlertTriangle size={10} className='mt-0.5 shrink-0' />
                                                        <span className='break-all'>{err.message}</span>
                                                        {err.details && (
                                                            <span className='text-muted-foreground/60 ml-1 text-[10px]'>
                                                                {err.details}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {s.debug && s.debug.length > 0 && (
                                            <div className='border-panel-divider bg-panel-soft mt-2 rounded-lg border p-2'>
                                                <div className='mb-1 text-[10px] font-medium tracking-wide text-violet-300/70 uppercase'>
                                                    详细信息
                                                </div>
                                                <div className='text-muted-foreground/80 space-y-1 font-mono text-[10px] leading-4'>
                                                    {s.debug.slice(-6).map((entry, i) => (
                                                        <div key={`${entry.at}-${i}`} className='break-all'>
                                                            <span className='text-violet-300/70'>{entry.step}</span>
                                                            {entry.filename && (
                                                                <span className='text-muted-foreground/60'>
                                                                    {' '}
                                                                    {entry.filename}
                                                                </span>
                                                            )}
                                                            <span> · {entry.message}</span>
                                                            {entry.elapsedMs !== undefined && (
                                                                <span className='text-muted-foreground/60'>
                                                                    {' '}
                                                                    +{formatDuration(entry.elapsedMs)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    <CardContent ref={cardContentRef} className='flex-grow overflow-y-auto p-4'>
                        {isVideoTab ? (
                            <>
                                {videoSelectionEnabled && selectedVideoIds.size > 0 && (
                                    <div
                                        aria-live='polite'
                                        className='app-panel-subtle mb-3 flex items-center justify-between rounded-xl border px-3 py-2'>
                                        <span className='text-foreground text-sm font-medium'>
                                            {t('video.history.bulkDelete.description', {
                                                count: selectedVideoIds.size
                                            })}
                                        </span>
                                        <div className='flex items-center gap-1.5'>
                                            <Button
                                                size='sm'
                                                variant='destructive'
                                                onClick={handleDeleteSelectedVideo}
                                                className='h-7 rounded-lg border border-red-500/10 bg-red-600/20 px-3 text-xs text-red-300 transition-colors hover:border-red-500/20 hover:bg-red-600/30'>
                                                <Trash2 size={13} className='mr-1' />
                                                {t('video.history.delete')}
                                            </Button>
                                            <Button
                                                variant='outline'
                                                size='sm'
                                                onClick={() => {
                                                    setSelectedVideoIds(new Set());
                                                    setVideoSelectionMode(false);
                                                }}
                                                className='text-muted-foreground h-7 rounded-lg px-3 text-xs'>
                                                {t('common.cancel')}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                {videoHistory.length === 0 ? (
                                    <div className='flex h-full min-h-[220px] items-center justify-center text-on-panel-faint'>
                                        <p>{t('video.history.empty')}</p>
                                    </div>
                                ) : (
                                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                                        {videoHistory.map((item) => (
                                            <VideoHistoryCard
                                                key={item.id}
                                                item={item}
                                                selectionMode={videoSelectionEnabled}
                                                isSelected={selectedVideoIds.has(item.id)}
                                                onSelectItem={handleVideoSelectItem}
                                                onSelectHistory={onSelectVideoHistory}
                                                onOpenDetails={setVideoDetailsItem}
                                                onDeleteItem={onDeleteVideoHistoryRequest}
                                                onCopyPrompt={onCopyVideoPrompt}
                                                onCopyTaskId={onCopyVideoTaskId}
                                                onRegenerate={onRegenerateVideoHistory}
                                                onRestore={onRestoreVideoHistoryToWorkbench}
                                                onSyncItem={onSyncVideoHistoryItem}
                                                isSyncing={isSyncing}
                                                formatDateTime={formatDateTime}
                                                t={t}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : isVisionTextTab ? (
                            <>
                                {visionTextSelectionEnabled && selectedVisionTextIds.size > 0 && (
                                    <div
                                        aria-live='polite'
                                        className='app-panel-subtle mb-3 flex items-center justify-between rounded-xl border px-3 py-2'>
                                        <span className='text-foreground text-sm font-medium'>
                                            已选 {selectedVisionTextIds.size} 项
                                        </span>
                                        <div className='flex items-center gap-1.5'>
                                            <Button
                                                size='sm'
                                                variant='destructive'
                                                onClick={handleDeleteSelectedVisionText}
                                                className='h-7 rounded-lg border border-red-500/10 bg-red-600/20 px-3 text-xs text-red-300 transition-colors hover:border-red-500/20 hover:bg-red-600/30'>
                                                <Trash2 size={13} className='mr-1' />
                                                删除
                                            </Button>
                                            <Button
                                                variant='outline'
                                                size='sm'
                                                onClick={() => {
                                                    setSelectedVisionTextIds(new Set());
                                                    setVisionTextSelectionMode(false);
                                                }}
                                                className='text-muted-foreground h-7 rounded-lg px-3 text-xs'>
                                                取消
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <VisionTextHistoryList
                                    items={visionTextHistory}
                                    getSourceImageSrc={getVisionTextSourceSrc}
                                    selectionMode={visionTextSelectionEnabled}
                                    selectedIds={selectedVisionTextIds}
                                    onSelectItem={handleVisionTextSelectItem}
                                    onSelectHistory={(item) => onSelectVisionTextHistory?.(item)}
                                    onOpenViewer={handleOpenVisionTextViewer}
                                    onDeleteItem={(item) => onDeleteVisionTextHistoryRequest?.(item)}
                                    onSendToGenerator={(prompt) => onSendVisionTextHistoryToGenerator?.(prompt)}
                                    onSyncItem={onSyncVisionTextHistoryItem}
                                    isSyncing={isSyncing}
                                />
                            </>
                        ) : displayHistory.length === 0 ? (
                            <div className='flex h-full items-center justify-center text-on-panel-faint'>
                                <p>生成的图片将显示在这里。</p>
                            </div>
                        ) : (
                            <>
                                {selectionEnabled && selectedIds.size > 0 && (
                                    <div
                                        aria-live='polite'
                                        className='app-panel-subtle mb-3 flex items-center justify-between rounded-xl border px-3 py-2'>
                                        <div className='flex items-center gap-2'>
                                            <span className='text-foreground text-sm font-medium'>
                                                已选 {selectedIds.size} 项
                                            </span>
                                        </div>
                                        <div className='flex items-center gap-1.5'>
                                            <Button
                                                variant='outline'
                                                size='sm'
                                                onClick={onDownloadAllSelected}
                                                className='text-foreground h-7 rounded-lg px-3 text-xs'>
                                                <Download size={13} className='mr-1' />
                                                下载
                                            </Button>
                                            <Button
                                                size='sm'
                                                variant='destructive'
                                                onClick={onDeleteSelected}
                                                className='h-7 rounded-lg border border-red-500/10 bg-red-600/20 px-3 text-xs text-red-300 transition-colors hover:border-red-500/20 hover:bg-red-600/30'>
                                                <Trash2 size={13} className='mr-1' />
                                                删除
                                            </Button>
                                            <div className='bg-border mx-1 h-4 w-px' />
                                            <Button
                                                variant='outline'
                                                size='sm'
                                                onClick={onCancelSelection}
                                                className='text-muted-foreground h-7 rounded-lg px-3 text-xs'>
                                                取消
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <div className='relative' ref={virtualRegionRef}>
                                    <div
                                        ref={gridRef}
                                        onPointerDown={handleGridPointerDown}
                                        onPointerMove={handleGridPointerMove}
                                        onPointerUp={finishDragSelection}
                                        onPointerCancel={finishDragSelection}
                                        onClickCapture={handleGridClickCapture}
                                        className={cn(
                                            'relative w-full',
                                            selectionEnabled ? 'cursor-crosshair select-none' : ''
                                        )}
                                        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                            const startCol = virtualRow.index * Math.max(1, columnCount);
                                            const rowItems = displayHistory.slice(
                                                startCol,
                                                startCol + Math.max(1, columnCount)
                                            );
                                            return (
                                                <div
                                                    key={virtualRow.key}
                                                    data-index={virtualRow.index}
                                                    ref={rowVirtualizer.measureElement}
                                                    style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`
                                                    }}>
                                                    <div
                                                        className='grid gap-4 pb-4'
                                                        style={{
                                                            gridTemplateColumns: `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`
                                                        }}>
                                                        {rowItems.map((item, colIdx) => {
                                                            const itemIndex = startCol + colIdx;
                                                            const itemKey = item.timestamp;
                                                            const isExampleItem = isExampleHistoryItem(item);
                                                            const showImageSyncBadge = Boolean(
                                                                onSyncHistoryItem && !isExampleItem
                                                            );
                                                            const itemIsSynced = showImageSyncBadge
                                                                ? isHistoryItemSynced(item)
                                                                : false;
                                                            return (
                                                                <HistoryImageCard
                                                                    key={itemKey}
                                                                    item={item}
                                                                    itemIndex={itemIndex}
                                                                    selectionEnabled={selectionEnabled}
                                                                    isSelected={selectedIds.has(itemKey)}
                                                                    isSyncing={isSyncing}
                                                                    showImageSyncBadge={showImageSyncBadge}
                                                                    itemIsSynced={itemIsSynced}
                                                                    openPromptDialogTimestamp={openPromptDialogTimestamp}
                                                                    setOpenPromptDialogTimestamp={
                                                                        setOpenPromptDialogTimestamp
                                                                    }
                                                                    openCostDialogTimestamp={openCostDialogTimestamp}
                                                                    setOpenCostDialogTimestamp={
                                                                        setOpenCostDialogTimestamp
                                                                    }
                                                                    copiedTimestamp={copiedTimestamp}
                                                                    onSelectItem={onSelectItem}
                                                                    onSelectImage={onSelectImage}
                                                                    onOpenPreview={handleOpenPreview}
                                                                    onCopyPrompt={handleCopy}
                                                                    onDownloadItem={handleDownloadItem}
                                                                    onSyncHistoryItem={onSyncHistoryItem}
                                                                    onDeleteItemRequest={onDeleteItemRequest}
                                                                    itemPendingDeleteConfirmation={
                                                                        itemPendingDeleteConfirmation
                                                                    }
                                                                    onConfirmDeletion={onConfirmDeletion}
                                                                    onCancelDeletion={onCancelDeletion}
                                                                    deletePreferenceDialogValue={
                                                                        deletePreferenceDialogValue
                                                                    }
                                                                    onDeletePreferenceDialogChange={
                                                                        onDeletePreferenceDialogChange
                                                                    }
                                                                    showRemoteDeleteOption={showRemoteDeleteOption}
                                                                    deleteRemoteDialogValue={deleteRemoteDialogValue}
                                                                    onDeleteRemoteDialogChange={
                                                                        onDeleteRemoteDialogChange
                                                                    }
                                                                    onDeleteExampleItem={onDeleteExampleItem}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
                                        <div
                                            aria-hidden='true'
                                            className='pointer-events-none fixed z-50 border border-blue-500/60 bg-blue-500/15'
                                            style={{
                                                left: selectionRect.left,
                                                top: selectionRect.top,
                                                width: selectionRect.width,
                                                height: selectionRect.height
                                            }}
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </WorkbenchCard>
            </div>
            <Dialog
                open={!!recentSyncAction}
                onOpenChange={(open) => {
                    if (!open) setRecentSyncAction(null);
                }}>
                <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>
                            {recentSyncAction === 'restore'
                                ? `恢复最近${activeHistoryNoun}`
                                : `同步最近${activeHistoryNoun}`}
                        </DialogTitle>
                        <DialogDescription>选择需要处理的最近时间范围。</DialogDescription>
                    </DialogHeader>
                    <div className='space-y-4 py-1'>
                        <div className='space-y-2'>
                            <Label>时间单位</Label>
                            <ToggleGroup
                                type='single'
                                value={recentRangeUnit}
                                onValueChange={(value) => {
                                    if (value === 'hours' || value === 'days') setRecentRangeUnit(value);
                                }}
                                className='border-border grid w-full grid-cols-2 rounded-lg border p-1'
                                variant='outline'
                                size='sm'>
                                <ToggleGroupItem value='days' className='rounded-md text-sm'>
                                    按天
                                </ToggleGroupItem>
                                <ToggleGroupItem value='hours' className='rounded-md text-sm'>
                                    按小时
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='recent-sync-range'>
                                {recentRangeUnit === 'hours' ? '最近小时数' : '最近天数'}
                            </Label>
                            <Input
                                id='recent-sync-range'
                                type='number'
                                inputMode='numeric'
                                min={1}
                                step={1}
                                value={recentRangeAmount}
                                onChange={(event) => setRecentRangeAmount(event.target.value)}
                                aria-invalid={!recentRangeIsValid}
                            />
                            {!recentRangeIsValid && <p className='text-xs text-red-400'>请输入大于 0 的整数。</p>}
                        </div>
                    </div>
                    <DialogFooter className='gap-2 sm:justify-end'>
                        <DialogClose asChild>
                            <Button type='button' variant='outline'>
                                取消
                            </Button>
                        </DialogClose>
                        <Button type='button' disabled={!recentRangeIsValid} onClick={handleConfirmRecentSync}>
                            {recentSyncAction === 'restore' ? '继续恢复' : '继续同步'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ZoomViewer
                src={previewImage?.src ?? null}
                open={!!previewImage}
                onClose={() => {
                    setPreviewImage(null);
                    setPreviewImageList([]);
                    setPreviewImageListIndex(0);
                }}
                onSendToEdit={previewImage?.canSendToEdit ? handlePreviewSendToEdit : undefined}
                images={previewImageList}
                currentIndex={previewImageListIndex}
                onNavigate={(nextIndex) => {
                    if (previewImageList[nextIndex]) {
                        setPreviewImage(previewImageList[nextIndex]);
                        setPreviewImageListIndex(nextIndex);
                    }
                }}
            />
            <VisionTextHistoryViewer
                item={visionTextViewerItem}
                open={!!visionTextViewerItem}
                initialSourceImageIndex={visionTextViewerSourceIndex}
                getSourceImageSrc={getVisionTextSourceSrc}
                onClose={() => setVisionTextViewerItem(null)}
                onRestore={(item) => {
                    setVisionTextViewerItem(null);
                    onSelectVisionTextHistory?.(item);
                }}
                onSendToGenerator={(prompt) => {
                    setVisionTextViewerItem(null);
                    onSendVisionTextHistoryToGenerator?.(prompt);
                }}
                onReplacePrompt={(prompt) => onReplacePromptFromVisionTextHistory?.(prompt)}
                onAppendPrompt={(prompt) => onAppendPromptFromVisionTextHistory?.(prompt)}
            />
            <VideoHistoryDetailsDialog
                item={videoDetailsItem}
                open={!!videoDetailsItem}
                onOpenChange={(open) => {
                    if (!open) setVideoDetailsItem(null);
                }}
                onCopyPrompt={onCopyVideoPrompt}
                onCopyTaskId={onCopyVideoTaskId}
                onRegenerate={onRegenerateVideoHistory}
                onRestore={onRestoreVideoHistoryToWorkbench}
                formatDateTime={formatDateTime}
                t={t}
            />
        </>
    );
}

export const HistoryPanel = React.memo(HistoryPanelImpl);
