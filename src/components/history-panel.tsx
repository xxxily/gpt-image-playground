'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ZoomViewer } from '@/components/zoom-viewer';
import { getModelRates, type GptImageModel } from '@/lib/cost-utils';
import { copyTextToClipboard, isTauriDesktop } from '@/lib/desktop-runtime';
import { isExampleHistoryImage, isExampleHistoryItem, type ExampleHistoryMetadata } from '@/lib/example-history';
import { DEFAULT_IMAGE_MODEL, isImageModelId } from '@/lib/model-registry';
import type { SyncStatusDetails } from '@/lib/sync/status-details';
import { cn } from '@/lib/utils';
import type { HistoryImage, HistoryMetadata, ImageStorageMode } from '@/types/history';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
    Copy,
    Check,
    Layers,
    DollarSign,
    Pencil,
    Sparkles as SparklesIcon,
    FileImage,
    Trash2,
    Download,
    CloudUpload,
    CloudDownload,
    Loader2,
    Cloud,
    Clock,
    CalendarClock,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    FolderDown,
    ImageDown,
    RotateCcw
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type HistoryPanelProps = {
    history: HistoryMetadata[];
    exampleHistory?: ExampleHistoryMetadata[];
    onSelectImage: (item: HistoryMetadata) => void;
    onClearHistory: () => void;
    getImageSrc: (filename: string) => string | undefined;
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
    isSyncing?: boolean;
    /** Legacy simple status label; superseded by syncStatus if both provided */
    syncStatusLabel?: string;
    /** Rich sync/restore status detail */
    syncStatus?: SyncStatusDetails | null;
};

type ImageSyncActionOptions = {
    force?: boolean;
    since?: number;
};

type RecentSyncAction = 'upload' | 'restore';
type RecentRangeUnit = 'hours' | 'days';

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

const calculateCost = (value: number, rate: number): string => {
    const cost = value * rate;
    return isNaN(cost) ? 'N/A' : cost.toFixed(4);
};

const absoluteDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
});

const shortDateFormatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric'
});

const formatHistoryDateLabel = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小时前`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} 天前`;

    return shortDateFormatter.format(date);
};

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
    exampleHistory,
    onSelectImage,
    onClearHistory,
    getImageSrc,
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
    isSyncing,
    syncStatusLabel,
    syncStatus
}: HistoryPanelProps) {
    const [openPromptDialogTimestamp, setOpenPromptDialogTimestamp] = React.useState<number | null>(null);
    const [openCostDialogTimestamp, setOpenCostDialogTimestamp] = React.useState<number | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [copiedTimestamp, setCopiedTimestamp] = React.useState<number | null>(null);
    const [previewImage, setPreviewImage] = React.useState<PreviewImage | null>(null);
    const [previewImageList, setPreviewImageList] = React.useState<PreviewImage[]>([]);
    const [previewImageListIndex, setPreviewImageListIndex] = React.useState(0);
    const [selectionRect, setSelectionRect] = React.useState<SelectionRect | null>(null);
    const [syncMenuOpen, setSyncMenuOpen] = React.useState(false);
    const [recentSyncAction, setRecentSyncAction] = React.useState<RecentSyncAction | null>(null);
    const [recentRangeUnit, setRecentRangeUnit] = React.useState<RecentRangeUnit>('days');
    const [recentRangeAmount, setRecentRangeAmount] = React.useState('7');
    const gridRef = React.useRef<HTMLDivElement | null>(null);
    const syncMenuRef = React.useRef<HTMLDivElement | null>(null);
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
    const selectionEnabled = selectionMode && !showingExampleHistory;

    React.useEffect(
        () => () => {
            const dragState = dragSelectionRef.current;
            if (dragState?.rafId !== null && dragState?.rafId !== undefined) {
                window.cancelAnimationFrame(dragState.rafId);
            }
        },
        []
    );

    React.useEffect(() => {
        if (!syncMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (syncMenuRef.current?.contains(event.target as Node)) return;
            setSyncMenuOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [syncMenuOpen]);

    const hasSyncActions = Boolean(
        onSyncUploadMetadata || onSyncUploadFull || onSyncRestore || onSyncRestoreMetadata || onSyncRestoreImages
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
            if (image.path) return getDesktopDisplayImagePath(image.path);

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
            void onSyncUploadFull?.({ since });
            return;
        }

        void onSyncRestoreImages?.({ since });
    }, [
        onSyncRestoreImages,
        onSyncUploadFull,
        recentRangeIsValid,
        recentRangeUnit,
        recentRangeValue,
        recentSyncAction
    ]);

    return (
        <>
            <Card className='app-panel-card flex h-full w-full flex-col overflow-hidden rounded-2xl border backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent'>
                <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3'>
                    <div className={cn('flex items-center gap-2', selectionEnabled && 'hidden sm:flex')}>
                        <CardTitle className='text-lg font-medium text-white'>生成历史</CardTitle>
                        {totalCost > 0 && (
                            <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                                <DialogTrigger asChild>
                                    <button
                                        className='mt-0.5 flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/12 px-2 py-0.5 text-[12px] text-emerald-700 transition-colors hover:bg-emerald-500/18 dark:bg-emerald-600/20 dark:text-emerald-300 dark:hover:bg-emerald-600/30'
                                        aria-label='Show total cost summary'>
                                        总计: ${totalCost.toFixed(4)}
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
                                            <span>每张图片平均费用:</span> <span>${averageCost.toFixed(4)}</span>
                                        </div>
                                        <hr className='border-border my-2' />
                                        <div className='text-foreground flex justify-between font-medium'>
                                            <span>估算总费用:</span>
                                            <span>${totalCost.toFixed(4)}</span>
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
                    {(history.length > 0 || hasSyncActions) && (
                        <div className='flex items-center gap-1.5'>
                            {history.length >= 2 && (
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={onToggleSelectionMode}
                                    className={cn(
                                        'text-muted-foreground hover:bg-accent hover:text-foreground h-auto rounded-lg px-2.5 py-1 transition-colors',
                                        selectionMode ? 'bg-accent text-foreground' : ''
                                    )}>
                                    {selectionMode ? '退出多选' : '多选'}
                                </Button>
                            )}
                            {selectionMode && (
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => {
                                        if (selectedIds.size === history.length) {
                                            onSelectAll([]);
                                        } else {
                                            onSelectAll(history.map((h) => h.timestamp));
                                        }
                                    }}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground h-auto rounded-lg px-2.5 py-1 transition-colors'>
                                    {selectedIds.size === history.length ? '清除已选' : '全选'}
                                </Button>
                            )}
                            {history.length > 0 && (
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={onClearHistory}
                                    className='text-muted-foreground hover:bg-accent hover:text-foreground h-auto rounded-lg px-2.5 py-1 transition-colors'>
                                    清空
                                </Button>
                            )}
                            {hasSyncActions && (
                                <div ref={syncMenuRef} className='relative'>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        type='button'
                                        onClick={() => setSyncMenuOpen((value) => !value)}
                                        disabled={isSyncing}
                                        aria-label='S3 同步操作'
                                        aria-expanded={syncMenuOpen}
                                        className='text-muted-foreground hover:bg-accent hover:text-foreground h-8 w-8 rounded-lg p-0 transition-colors sm:h-7 sm:w-7'>
                                        {isSyncing ? (
                                            <Loader2 size={14} className='animate-spin' />
                                        ) : (
                                            <Cloud size={14} />
                                        )}
                                    </Button>
                                    {syncMenuOpen && (
                                        <div className='border-border bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-2 min-w-56 overflow-hidden rounded-xl border p-1 shadow-lg shadow-black/10'>
                                            {onSyncUploadMetadata && (
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        setSyncMenuOpen(false);
                                                        void onSyncUploadMetadata();
                                                    }}
                                                    className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                    <CloudUpload size={14} className='shrink-0' />
                                                    同步配置
                                                </button>
                                            )}
                                            {onSyncUploadFull && (
                                                <>
                                                    <button
                                                        type='button'
                                                        onClick={() => {
                                                            setSyncMenuOpen(false);
                                                            void onSyncUploadFull();
                                                        }}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                        <CloudUpload size={14} className='shrink-0' />
                                                        同步历史图片
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => openRecentSyncDialog('upload')}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                        <CalendarClock size={14} className='shrink-0' />
                                                        同步最近图片
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => {
                                                            setSyncMenuOpen(false);
                                                            void onSyncUploadFull({ force: true });
                                                        }}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                        <RotateCcw size={14} className='shrink-0' />
                                                        强制同步历史图片
                                                    </button>
                                                </>
                                            )}
                                            {(onSyncRestore || onSyncRestoreMetadata || onSyncRestoreImages) && (
                                                <div className='bg-border my-1 h-px' />
                                            )}
                                            {onSyncRestore && !onSyncRestoreMetadata && !onSyncRestoreImages && (
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        setSyncMenuOpen(false);
                                                        void onSyncRestore();
                                                    }}
                                                    className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                    <CloudDownload size={14} className='shrink-0' />从 S3 恢复
                                                </button>
                                            )}
                                            {onSyncRestoreMetadata && (
                                                <button
                                                    type='button'
                                                    onClick={() => {
                                                        setSyncMenuOpen(false);
                                                        void onSyncRestoreMetadata();
                                                    }}
                                                    className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                    <FolderDown size={14} className='shrink-0' />
                                                    恢复配置
                                                </button>
                                            )}
                                            {onSyncRestoreImages && (
                                                <>
                                                    <button
                                                        type='button'
                                                        onClick={() => {
                                                            setSyncMenuOpen(false);
                                                            void onSyncRestoreImages();
                                                        }}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                        <ImageDown size={14} className='shrink-0' />
                                                        恢复历史图片
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => openRecentSyncDialog('restore')}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                        <CalendarClock size={14} className='shrink-0' />
                                                        恢复最近图片
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() => {
                                                            setSyncMenuOpen(false);
                                                            void onSyncRestoreImages({ force: true });
                                                        }}
                                                        className='text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors'>
                                                        <RotateCcw size={14} className='shrink-0' />
                                                        强制恢复历史图片
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
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
                        <div className='mt-0 border-b border-white/[0.06] bg-violet-500/5'>
                            <div className='flex items-center gap-2 px-3 py-1.5'>
                                {active ? (
                                    <Loader2 size={12} className='shrink-0 animate-spin text-violet-400' />
                                ) : s?.done ? (
                                    <Cloud
                                        size={12}
                                        className={cn('shrink-0', s.success ? 'text-emerald-400' : 'text-amber-400')}
                                    />
                                ) : legacyLabel ? (
                                    <Cloud size={12} className='shrink-0 text-violet-400' />
                                ) : (
                                    <Cloud size={12} className='shrink-0 text-violet-400' />
                                )}
                                <span className='truncate text-[11px] text-violet-300/80'>
                                    {legacyLabel ? syncStatusLabel : (s?.operationLabel ?? s?.operation ?? '同步中')}
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
                                <div className='text-muted-foreground border-t border-white/[0.04] px-3 py-2 text-[11px]'>
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
                                                {absoluteDateTimeFormatter.format(new Date(s.manifestCreatedAt))}
                                            </span>
                                        )}
                                        {s.startedAt && (
                                            <span className='flex items-center gap-0.5'>
                                                <Clock size={10} className='shrink-0' />
                                                {absoluteDateTimeFormatter.format(new Date(s.startedAt))}
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
                                </div>
                            )}
                        </div>
                    );
                })()}
                <CardContent className='flex-grow overflow-y-auto p-4'>
                    {displayHistory.length === 0 ? (
                        <div className='flex h-full items-center justify-center text-white/40'>
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
                            <div className='relative'>
                                <div
                                    ref={gridRef}
                                    onPointerDown={handleGridPointerDown}
                                    onPointerMove={handleGridPointerMove}
                                    onPointerUp={finishDragSelection}
                                    onPointerCancel={finishDragSelection}
                                    onClickCapture={handleGridClickCapture}
                                    className={cn(
                                        'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
                                        selectionEnabled ? 'cursor-crosshair select-none' : ''
                                    )}>
                                    {[...displayHistory].map((item) => {
                                        const firstImage = item.images?.[0];
                                        const imageCount = item.images?.length ?? 0;
                                        const isMultiImage = imageCount > 1;
                                        const itemKey = item.timestamp;
                                        const originalStorageMode = item.storageModeUsed || 'fs';
                                        const outputFormat = item.output_format || 'png';
                                        const isExampleItem = isExampleHistoryItem(item);

                                        let thumbnailUrl: string | undefined;
                                        if (firstImage) {
                                            thumbnailUrl = getHistoryImageSrc(firstImage, originalStorageMode);
                                        }

                                        return (
                                            <div
                                                key={itemKey}
                                                data-history-card-id={itemKey}
                                                className={cn(
                                                    'flex flex-col overflow-hidden rounded-xl border border-white/[0.06] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/10',
                                                    selectionEnabled && selectedIds.has(itemKey)
                                                        ? 'border-blue-500/30 ring-2 ring-blue-500/60'
                                                        : ''
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
                                                                handleOpenPreview(firstImage, originalStorageMode);
                                                            }
                                                            if (isExampleItem) {
                                                                return;
                                                            }
                                                            React.startTransition(() => {
                                                                onSelectImage(item);
                                                            });
                                                        }}
                                                        data-history-card-open
                                                        className='focus:ring-primary relative block aspect-square w-full cursor-pointer overflow-hidden rounded-none border-0 transition-transform duration-150 focus:ring-2 focus:ring-offset-2 focus:outline-none'
                                                        aria-label={`查看图片，生成于 ${absoluteDateTimeFormatter.format(new Date(item.timestamp))}。点击打开完整预览。`}>
                                                        {thumbnailUrl ? (
                                                            <Image
                                                                src={thumbnailUrl}
                                                                alt={`批量生成预览，时间 ${absoluteDateTimeFormatter.format(new Date(item.timestamp))}`}
                                                                width={150}
                                                                height={150}
                                                                className='h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]'
                                                                loading='lazy'
                                                                decoding='async'
                                                                fetchPriority='low'
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
                                                                checked={selectedIds.has(itemKey)}
                                                                onCheckedChange={() => onSelectItem(itemKey)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className='h-5 w-5 rounded-full border-2 border-white/70 shadow-lg data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white'
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Mode badge — top-left */}
                                                    <div
                                                        className={cn(
                                                            'pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm',
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
                                                        <div className='pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm backdrop-blur-sm'>
                                                            示例 · {item.featureLabel}
                                                        </div>
                                                    )}

                                                    {/* Multi-image count — bottom-right */}
                                                    {isMultiImage && (
                                                        <div className='pointer-events-none absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm'>
                                                            <Layers size={12} className='shrink-0' />
                                                            {imageCount}
                                                        </div>
                                                    )}

                                                    {/* Cost pill — top-right */}
                                                    {item.costDetails && (
                                                        <Dialog
                                                            open={openCostDialogTimestamp === itemKey}
                                                            onOpenChange={(isOpen) =>
                                                                !isOpen && setOpenCostDialogTimestamp(null)
                                                            }>
                                                            <DialogTrigger asChild>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenCostDialogTimestamp(itemKey);
                                                                    }}
                                                                    className='absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300 backdrop-blur-sm transition-colors duration-150 hover:bg-black/85 hover:text-emerald-200'
                                                                    aria-label='点击查看费用明细'>
                                                                    <DollarSign size={11} className='shrink-0' />$
                                                                    {item.costDetails.estimated_cost_usd.toFixed(4)}
                                                                </button>
                                                            </DialogTrigger>
                                                            <DialogContent className='border-border bg-background text-foreground sm:max-w-[450px]'>
                                                                <DialogHeader>
                                                                    <DialogTitle>成本明细</DialogTitle>
                                                                    <DialogDescription className='sr-only'>
                                                                        此图片生成的费用明细。
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                {(() => {
                                                                    const modelForRates: GptImageModel = isImageModelId(
                                                                        item.model
                                                                    )
                                                                        ? item.model
                                                                        : DEFAULT_IMAGE_MODEL;
                                                                    const rates = getModelRates(modelForRates);
                                                                    return (
                                                                        <>
                                                                            <div className='text-muted-foreground space-y-1 pt-1 text-xs'>
                                                                                <p>{modelForRates} 定价:</p>
                                                                                <ul className='list-disc pl-4'>
                                                                                    <li>
                                                                                        Text Input: $
                                                                                        {rates.textInputPerMillion} / 1M
                                                                                        tokens
                                                                                    </li>
                                                                                    <li>
                                                                                        Image Input: $
                                                                                        {rates.imageInputPerMillion} /
                                                                                        1M tokens
                                                                                    </li>
                                                                                    <li>
                                                                                        Image Output: $
                                                                                        {rates.imageOutputPerMillion} /
                                                                                        1M tokens
                                                                                    </li>
                                                                                </ul>
                                                                            </div>
                                                                            <div className='text-muted-foreground space-y-2 py-4 text-sm'>
                                                                                <div className='flex justify-between'>
                                                                                    <span>文本输入 Token:</span>{' '}
                                                                                    <span>
                                                                                        {item.costDetails.text_input_tokens.toLocaleString()}{' '}
                                                                                        (~$
                                                                                        {calculateCost(
                                                                                            item.costDetails
                                                                                                .text_input_tokens,
                                                                                            rates.textInputPerToken
                                                                                        )}
                                                                                        )
                                                                                    </span>
                                                                                </div>
                                                                                {item.costDetails.image_input_tokens >
                                                                                    0 && (
                                                                                    <div className='flex justify-between'>
                                                                                        <span>图片输入 Token:</span>{' '}
                                                                                        <span>
                                                                                            {item.costDetails.image_input_tokens.toLocaleString()}{' '}
                                                                                            (~$
                                                                                            {calculateCost(
                                                                                                item.costDetails
                                                                                                    .image_input_tokens,
                                                                                                rates.imageInputPerToken
                                                                                            )}
                                                                                            )
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                <div className='flex justify-between'>
                                                                                    <span>图片输出 Token:</span>{' '}
                                                                                    <span>
                                                                                        {item.costDetails.image_output_tokens.toLocaleString()}{' '}
                                                                                        (~$
                                                                                        {calculateCost(
                                                                                            item.costDetails
                                                                                                .image_output_tokens,
                                                                                            rates.imageOutputPerToken
                                                                                        )}
                                                                                        )
                                                                                    </span>
                                                                                </div>
                                                                                <hr className='border-border my-2' />
                                                                                <div className='text-foreground flex justify-between font-medium'>
                                                                                    <span>总计:</span>
                                                                                    <span>
                                                                                        $
                                                                                        {item.costDetails.estimated_cost_usd.toFixed(
                                                                                            4
                                                                                        )}
                                                                                    </span>
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
                                                                    : `生成于 ${absoluteDateTimeFormatter.format(new Date(item.timestamp))}`
                                                            }
                                                            className='text-muted-foreground truncate text-[11px]'>
                                                            {isExampleItem
                                                                ? '内置示例'
                                                                : formatHistoryDateLabel(item.timestamp)}
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
                                                            onClick={(e) => handleDownloadItem(item, e)}
                                                            aria-label='下载此图片'>
                                                            <Download
                                                                size={13}
                                                                className='shrink-0 opacity-60 sm:mr-1'
                                                            />
                                                            <span className='sr-only sm:not-sr-only sm:inline'>
                                                                下载
                                                            </span>
                                                        </Button>
                                                        <Dialog
                                                            open={openPromptDialogTimestamp === itemKey}
                                                            onOpenChange={(isOpen) =>
                                                                !isOpen && setOpenPromptDialogTimestamp(null)
                                                            }>
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    variant='ghost'
                                                                    size='sm'
                                                                    className='text-muted-foreground hover:text-foreground h-7 w-7 p-0 sm:h-6 sm:w-auto sm:px-1.5 sm:text-[11px]'
                                                                    onClick={() =>
                                                                        setOpenPromptDialogTimestamp(itemKey)
                                                                    }>
                                                                    <FileImage
                                                                        size={13}
                                                                        className='shrink-0 opacity-60 sm:mr-1'
                                                                    />
                                                                    <span className='sr-only sm:not-sr-only sm:inline'>
                                                                        查看提示词
                                                                    </span>
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className='border-border bg-background text-foreground sm:max-w-[625px]'>
                                                                <DialogHeader>
                                                                    <DialogTitle>提示词</DialogTitle>
                                                                    <DialogDescription className='sr-only'>
                                                                        生成此图片使用的完整提示词。
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <div className='border-border bg-muted text-foreground max-h-[400px] overflow-y-auto rounded-md border p-3 py-4 text-sm'>
                                                                    {item.prompt || '提示词为空'}
                                                                </div>
                                                                <DialogFooter>
                                                                    <Button
                                                                        variant='outline'
                                                                        size='sm'
                                                                        onClick={() => handleCopy(item.prompt, itemKey)}
                                                                        className='border-border text-muted-foreground hover:bg-accent hover:text-foreground'>
                                                                        {copiedTimestamp === itemKey ? (
                                                                            <Check className='mr-2 h-4 w-4 text-green-400' />
                                                                        ) : (
                                                                            <Copy className='mr-2 h-4 w-4' />
                                                                        )}
                                                                        {copiedTimestamp === itemKey
                                                                            ? '已复制'
                                                                            : '复制'}
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
                                                                open={
                                                                    itemPendingDeleteConfirmation?.timestamp ===
                                                                    item.timestamp
                                                                }
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
                                                                            确定要删除此历史条目吗？将移除{' '}
                                                                            {item.images.length} 张图片。
                                                                            此操作不可撤销。
                                                                        </p>
                                                                    </DialogHeader>
                                                                    <div className='flex items-center space-x-2 py-2'>
                                                                        <Checkbox
                                                                            id={`dont-ask-${item.timestamp}`}
                                                                            checked={deletePreferenceDialogValue}
                                                                            onCheckedChange={(checked) =>
                                                                                onDeletePreferenceDialogChange(
                                                                                    !!checked
                                                                                )
                                                                            }
                                                                            className='border-neutral-400 bg-white data-[state=checked]:border-neutral-700 data-[state=checked]:bg-white data-[state=checked]:text-black dark:border-neutral-500 dark:!bg-white'
                                                                        />
                                                                        <label
                                                                            htmlFor={`dont-ask-${item.timestamp}`}
                                                                            className='text-muted-foreground text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                                                                            不再询问
                                                                        </label>
                                                                    </div>
                                                                    {showRemoteDeleteOption && (
                                                                        <div className='flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2'>
                                                                            <Checkbox
                                                                                id={`delete-remote-${item.timestamp}`}
                                                                                checked={Boolean(deleteRemoteDialogValue)}
                                                                                onCheckedChange={(checked) =>
                                                                                    onDeleteRemoteDialogChange?.(
                                                                                        !!checked
                                                                                    )
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
            </Card>
            <Dialog
                open={!!recentSyncAction}
                onOpenChange={(open) => {
                    if (!open) setRecentSyncAction(null);
                }}>
                <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{recentSyncAction === 'restore' ? '恢复最近图片' : '同步最近图片'}</DialogTitle>
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
        </>
    );
}

export const HistoryPanel = React.memo(HistoryPanelImpl);
