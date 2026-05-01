'use client';

import type { HistoryImage, HistoryMetadata, ImageStorageMode } from '@/types/history';
import { getModelRates, type GptImageModel } from '@/lib/cost-utils';
import { DEFAULT_IMAGE_MODEL, isImageModelId } from '@/lib/model-registry';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ZoomViewer } from '@/components/zoom-viewer';
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
import { cn } from '@/lib/utils';
import {
    Copy,
    Check,
    Layers,
    DollarSign,
    Pencil,
    Sparkles as SparklesIcon,
    FileImage,
    Trash2,
    Download
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type HistoryPanelProps = {
    history: HistoryMetadata[];
    onSelectImage: (item: HistoryMetadata) => void;
    onClearHistory: () => void;
    getImageSrc: (filename: string) => string | undefined;
    onDeleteItemRequest: (item: HistoryMetadata) => void;
    itemPendingDeleteConfirmation: HistoryMetadata | null;
    onConfirmDeletion: () => void;
    onCancelDeletion: () => void;
    deletePreferenceDialogValue: boolean;
    onDeletePreferenceDialogChange: (isChecked: boolean) => void;
    onSendToEdit: (filename: string) => void | Promise<void>;
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
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
};

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
    onSelectImage,
    onClearHistory,
    getImageSrc,
    onDeleteItemRequest,
    itemPendingDeleteConfirmation,
    onConfirmDeletion,
    onCancelDeletion,
    deletePreferenceDialogValue,
    onDeletePreferenceDialogChange,
    onSendToEdit,
    selectionMode,
    selectedIds,
    onSelectItem,
    onSelectAll,
    onReplaceSelectedItems,
    onToggleSelectionMode,
    onDownloadSingle,
    onDownloadAllSelected,
    onDeleteSelected,
    onCancelSelection
}: HistoryPanelProps) {
    const [openPromptDialogTimestamp, setOpenPromptDialogTimestamp] = React.useState<number | null>(null);
    const [openCostDialogTimestamp, setOpenCostDialogTimestamp] = React.useState<number | null>(null);
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [copiedTimestamp, setCopiedTimestamp] = React.useState<number | null>(null);
    const [previewImage, setPreviewImage] = React.useState<{ src: string; filename: string } | null>(null);
    const [selectionRect, setSelectionRect] = React.useState<SelectionRect | null>(null);
    const gridRef = React.useRef<HTMLDivElement | null>(null);
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

    React.useEffect(() => () => {
        const dragState = dragSelectionRef.current;
        if (dragState?.rafId !== null && dragState?.rafId !== undefined) {
            window.cancelAnimationFrame(dragState.rafId);
        }
    }, []);

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
        try {
            await navigator.clipboard.writeText(text);
            setCopiedTimestamp(timestamp);
            setTimeout(() => setCopiedTimestamp(null), 1500);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const getHistoryImageSrc = React.useCallback(
        (image: HistoryImage, storageMode: ImageStorageMode) => {
            if (image.path) return image.path;

            if (storageMode === 'indexeddb') {
                return getImageSrc(image.filename);
            }

            return `/api/image/${image.filename}`;
        },
        [getImageSrc]
    );

    const handleOpenPreview = React.useCallback(
        (image: HistoryImage, storageMode: ImageStorageMode) => {
            const src = getHistoryImageSrc(image, storageMode);
            if (!src) return;

            setPreviewImage({ src, filename: image.filename });
        },
        [getHistoryImageSrc]
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

        await onSendToEdit(previewImage.filename);
        setPreviewImage(null);
        scrollToEditForm();
    }, [onSendToEdit, previewImage, scrollToEditForm]);

    const handleDownloadItem = React.useCallback(async (item: HistoryMetadata, e: React.MouseEvent) => {
        e.stopPropagation();
        await onDownloadSingle(item);
    }, [onDownloadSingle]);

    const updateDragSelection = React.useCallback((currentX: number, currentY: number) => {
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
    }, [onReplaceSelectedItems, selectedIds]);

    const handleGridPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!selectionMode) return;
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
    }, [selectedIds, selectionMode]);

    const handleGridPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
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
    }, [updateDragSelection]);

    const finishDragSelection = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
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
    }, [updateDragSelection]);

    const handleGridClickCapture = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!suppressNextClickRef.current) return;

        suppressNextClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
    }, []);

    return (
        <>
        <Card className='app-panel-card flex h-full w-full flex-col overflow-hidden rounded-2xl border backdrop-blur-xl before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3'>
                <div className='flex items-center gap-2'>
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
                                <div className='space-y-1 pt-1 text-xs text-muted-foreground'>
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
                                        <li>Cost is shown as $0 until stable public token pricing is configured.</li>
                                    </ul>
                                </div>
                                <div className='space-y-2 py-4 text-sm text-muted-foreground'>
                                    <div className='flex justify-between'>
                                        <span>生成图片总数:</span> <span>{totalImages.toLocaleString()}</span>
                                    </div>
                                    <div className='flex justify-between'>
                                        <span>每张图片平均费用:</span> <span>${averageCost.toFixed(4)}</span>
                                    </div>
                                    <hr className='my-2 border-border' />
                                    <div className='flex justify-between font-medium text-foreground'>
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
                {history.length > 0 && (
                    <div className='flex items-center gap-1.5'>
                        {history.length >= 2 && (
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={onToggleSelectionMode}
                                className={cn(
                                    'h-auto rounded-lg px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
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
                                className='h-auto rounded-lg px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'>
                                {selectedIds.size === history.length ? '清除已选' : '全选'}
                            </Button>
                        )}
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={onClearHistory}
                            className='h-auto rounded-lg px-2.5 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'>
                            清空
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent className='flex-grow overflow-y-auto p-4'>
                {history.length === 0 ? (
                    <div className='flex h-full items-center justify-center text-white/40'>
                        <p>生成的图片将显示在这里。</p>
                    </div>
                ) : (
                    <>
                    {selectionMode && selectedIds.size > 0 && (
                        <div
                            aria-live='polite'
                            className='app-panel-subtle mb-3 flex items-center justify-between rounded-xl border px-3 py-2'>
                            <div className='flex items-center gap-2'>
                                <span className='text-sm font-medium text-foreground'>已选 {selectedIds.size} 项</span>
                            </div>
                            <div className='flex items-center gap-1.5'>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={onDownloadAllSelected}
                                    className='h-7 rounded-lg px-3 text-xs text-foreground'>
                                    <Download size={13} className='mr-1' />
                                    下载
                                </Button>
                                <Button
                                    size='sm'
                                    variant='destructive'
                                    onClick={onDeleteSelected}
                                    className='h-7 rounded-lg border border-red-500/10 bg-red-600/20 px-3 text-xs text-red-300 transition-colors hover:bg-red-600/30 hover:border-red-500/20'>
                                    <Trash2 size={13} className='mr-1' />
                                    删除
                                </Button>
                                <div className='mx-1 h-4 w-px bg-border' />
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={onCancelSelection}
                                    className='h-7 rounded-lg px-3 text-xs text-muted-foreground'>
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
                            selectionMode ? 'select-none cursor-crosshair' : ''
                        )}>
                        {[...history].map((item) => {
                            const firstImage = item.images?.[0];
                            const imageCount = item.images?.length ?? 0;
                            const isMultiImage = imageCount > 1;
                            const itemKey = item.timestamp;
                            const originalStorageMode = item.storageModeUsed || 'fs';
                            const outputFormat = item.output_format || 'png';

                            let thumbnailUrl: string | undefined;
                            if (firstImage) {
                                thumbnailUrl = getHistoryImageSrc(firstImage, originalStorageMode);
                            }

                            return (
                                <div key={itemKey} data-history-card-id={itemKey} className={cn(
                                    'flex flex-col overflow-hidden rounded-xl border border-white/[0.06] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/10',
                                    selectionMode && selectedIds.has(itemKey) ? 'ring-2 ring-blue-500/60 border-blue-500/30' : ''
                                )}>
                                    {/* -- Thumbnail area -- */}
                                    <div className='relative'>
                                        <button
                                            onClick={() => {
                                                if (selectionMode) {
                                                    onSelectItem(itemKey);
                                                    return;
                                                }
                                                if (firstImage) {
                                                    handleOpenPreview(firstImage, originalStorageMode);
                                                }
                                                React.startTransition(() => {
                                                    onSelectImage(item);
                                                });
                                            }}
                                            data-history-card-open
                                            className='relative block aspect-square w-full cursor-pointer overflow-hidden rounded-none border-0 transition-transform duration-150 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none'
                                            aria-label={`查看图片，生成于 ${absoluteDateTimeFormatter.format(new Date(item.timestamp))}。点击打开完整预览。`}>
                                            {thumbnailUrl ? (
                                                <Image
                                                    src={thumbnailUrl}
                                                    alt={`批量生成预览，时间 ${absoluteDateTimeFormatter.format(new Date(item.timestamp))}`}
                                                    width={150}
                                                    height={150}
                                                    className='h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]'
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className='flex h-full w-full items-center justify-center bg-muted text-muted-foreground'>
                                                    <FileImage size={24} />
                                                </div>
                                            )}
                                        </button>

                                        {selectionMode && (
                                            <div className='absolute top-2 left-2 z-20'>
                                                <Checkbox
                                                    checked={selectedIds.has(itemKey)}
                                                    onCheckedChange={() => onSelectItem(itemKey)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className='h-5 w-5 rounded-full border-2 border-white/70 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white shadow-lg'
                                                />
                                            </div>
                                        )}

                                        {/* Mode badge — top-left */}
                                        <div
                                            className={cn(
                                                'pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm',
                                                item.mode === 'edit' ? 'bg-orange-500 text-white' : 'bg-violet-600 text-white dark:bg-primary/80'
                                            )}>
                                            {item.mode === 'edit' ? (
                                                <Pencil size={11} className='shrink-0' />
                                            ) : (
                                                <SparklesIcon size={11} className='shrink-0' />
                                            )}
                                            {item.mode === 'edit' ? '编辑' : '生成'}
                                        </div>

                                        {/* Multi-image count — bottom-right */}
                                        {isMultiImage && (
                                            <div className='pointer-events-none absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm'>
                                                <Layers size={12} className='shrink-0' />
                                                {imageCount}
                                            </div>
                                        )}

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
                                                        className='absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300 backdrop-blur-sm transition-colors duration-150 hover:bg-black/85 hover:text-emerald-200'
                                                        aria-label='点击查看费用明细'>
                                                        <DollarSign size={11} className='shrink-0' />
                                                        ${item.costDetails.estimated_cost_usd.toFixed(4)}
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
                                                        const modelForRates: GptImageModel = isImageModelId(item.model)
                                                            ? item.model
                                                            : DEFAULT_IMAGE_MODEL;
                                                        const rates = getModelRates(modelForRates);
                                                        return (
                                                            <>
                                                                <div className='space-y-1 pt-1 text-xs text-muted-foreground'>
                                                                    <p>{modelForRates} 定价:</p>
                                                                    <ul className='list-disc pl-4'>
                                                                        <li>
                                                                            Text Input: ${rates.textInputPerMillion} /
                                                                            1M tokens
                                                                        </li>
                                                                        <li>
                                                                            Image Input: ${rates.imageInputPerMillion} /
                                                                            1M tokens
                                                                        </li>
                                                                        <li>
                                                                            Image Output: $
                                                                            {rates.imageOutputPerMillion} / 1M tokens
                                                                        </li>
                                                                    </ul>
                                                                </div>
                                                                <div className='space-y-2 py-4 text-sm text-muted-foreground'>
                                                                    <div className='flex justify-between'>
                                                                        <span>文本输入 Token:</span>{' '}
                                                                        <span>
                                                                            {item.costDetails.text_input_tokens.toLocaleString()}{' '}
                                                                            (~$
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
                                                                                item.costDetails.image_output_tokens,
                                                                                rates.imageOutputPerToken
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    </div>
                                                                    <hr className='my-2 border-border' />
                                                                    <div className='flex justify-between font-medium text-foreground'>
                                                                        <span>总计:</span>
                                                                        <span>
                                                                            ${item.costDetails.estimated_cost_usd.toFixed(4)}
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
                                                title={`生成于 ${absoluteDateTimeFormatter.format(new Date(item.timestamp))}`}
                                                className='text-[11px] text-muted-foreground truncate'>
                                                {formatHistoryDateLabel(item.timestamp)}
                                            </time>
                                            <span className='text-[11px] tabular-nums text-muted-foreground shrink-0'>
                                                {formatDuration(item.durationMs)}
                                            </span>
                                        </div>

                                        {/* Row 2: Model + Quality + Image count tags */}
                                        <div className='flex items-center gap-1 flex-wrap'>
                                            <span className='inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground'>
                                                {item.model || DEFAULT_IMAGE_MODEL}
                                            </span>
                                            {item.quality && (
                                                <span className='inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground'>
                                                    {item.quality}
                                                </span>
                                            )}
                                            {item.output_format && (
                                                <span className='inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground tabular-nums uppercase'>
                                                    {outputFormat}
                                                </span>
                                            )}
                                            {originalStorageMode === 'indexeddb' && (
                                                <span className='inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground'>
                                                    索引
                                                </span>
                                            )}
                                        </div>

                                        {/* Row 3: Background + Moderation (secondary info) */}
                                        {(item.background || item.moderation) && (
                                            <div className='flex items-center gap-1.5 text-[11px] text-muted-foreground/70 flex-wrap'>
                                                {item.background && (
                                                    <span>背景 {item.background}</span>
                                                )}
                                                {item.background && item.moderation && (
                                                    <span className='text-muted-foreground/40'>·</span>
                                                )}
                                                {item.moderation && (
                                                    <span>审核 {item.moderation}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Row 4: Actions */}
                                        <div className='flex items-center gap-1 pt-0.5'>
                                            <Button
                                                variant='ghost'
                                                size='sm'
                                                className='h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground'
                                                onClick={(e) => handleDownloadItem(item, e)}
                                                aria-label='下载此图片'>
                                                <Download size={12} className='mr-1 shrink-0 opacity-60' />
                                                下载
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
                                                        className='h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground'
                                                        onClick={() => setOpenPromptDialogTimestamp(itemKey)}>
                                                        <FileImage size={12} className='mr-1 shrink-0 opacity-60' />
                                                        查看提示词
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className='border-border bg-background text-foreground sm:max-w-[625px]'>
                                                    <DialogHeader>
                                                    <DialogTitle>提示词</DialogTitle>
                                                        <DialogDescription className='sr-only'>
                                                            生成此图片使用的完整提示词。
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <div className='max-h-[400px] overflow-y-auto rounded-md border border-border bg-muted p-3 py-4 text-sm text-foreground'>
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
                                            <Dialog
                                                open={itemPendingDeleteConfirmation?.timestamp === item.timestamp}
                                                onOpenChange={(isOpen) => {
                                                    if (!isOpen) onCancelDeletion();
                                                }}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant='ghost'
                                                        size='sm'
                                                        className='h-6 w-6 p-0 ml-auto text-muted-foreground/50 hover:text-destructive'
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
                                                    <DialogTitle>
                                                    确认删除
                                                </DialogTitle>
                            <p className='pt-2 text-muted-foreground'>
                            确定要删除此历史条目吗？将移除 {item.images.length} 张图片。
                            此操作不可撤销。
                        </p>
                                                    </DialogHeader>
                                                    <div className='flex items-center space-x-2 py-2'>
                                                        <Checkbox
                                                            id={`dont-ask-${item.timestamp}`}
                                                            checked={deletePreferenceDialogValue}
                                                            onCheckedChange={(checked) =>
                                                                onDeletePreferenceDialogChange(!!checked)
                                                            }
                                                            className='border-neutral-400 bg-white data-[state=checked]:border-neutral-700 data-[state=checked]:bg-white data-[state=checked]:text-black dark:border-neutral-500 dark:!bg-white'
                                                        />
                                                        <label
                                                            htmlFor={`dont-ask-${item.timestamp}`}
                                                            className='text-sm leading-none font-medium text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                            不再询问
                        </label>
                                                    </div>
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
        <ZoomViewer
            src={previewImage?.src ?? null}
            open={!!previewImage}
            onClose={() => setPreviewImage(null)}
            onSendToEdit={previewImage ? handlePreviewSendToEdit : undefined}
        />
        </>
    );
}

export const HistoryPanel = React.memo(HistoryPanelImpl);
