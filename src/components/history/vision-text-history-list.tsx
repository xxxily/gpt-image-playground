'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { copyTextToClipboard } from '@/lib/desktop-runtime';
import { cn } from '@/lib/utils';
import { VISION_TEXT_TASK_TYPE_LABELS } from '@/lib/vision-text-types';
import type { VisionTextHistoryMetadata, VisionTextSourceImageRef } from '@/types/history';
import {
    AlertTriangle,
    Check,
    Clipboard,
    Cloud,
    CloudUpload,
    FileImage,
    Loader2,
    Send,
    Trash2,
    Undo2
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

type VisionTextHistoryListProps = {
    items: VisionTextHistoryMetadata[];
    getSourceImageSrc: (ref: VisionTextSourceImageRef) => string | undefined;
    imageSrcRevision?: number;
    selectionMode: boolean;
    selectedIds: Set<string>;
    onSelectItem: (id: string) => void;
    onSelectHistory: (item: VisionTextHistoryMetadata) => void;
    onOpenViewer: (item: VisionTextHistoryMetadata, sourceImageIndex: number) => void;
    onDeleteItem: (item: VisionTextHistoryMetadata) => void;
    onSendToGenerator: (prompt: string) => void;
    onSyncItem?: (item: VisionTextHistoryMetadata) => void | Promise<void>;
    isSyncing?: boolean;
};

function formatRelativeTime(timestamp: number, language: string): string {
    const diffMs = Date.now() - timestamp;
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
    return shortDateFormatter.format(new Date(timestamp));
}

function getReusablePrompt(item: VisionTextHistoryMetadata): string {
    return item.structuredResult?.prompt?.trim() || item.resultText.trim();
}

function getSummary(item: VisionTextHistoryMetadata): string {
    return item.structuredResult?.summary?.trim() || item.resultText.trim() || '无文本结果';
}

function getUsageLabel(item: VisionTextHistoryMetadata): string | null {
    const textTokens = item.usage?.input_tokens_details?.text_tokens;
    const imageTokens = item.usage?.input_tokens_details?.image_tokens;
    const outputTokens = item.usage?.output_tokens;
    const total = [textTokens, imageTokens, outputTokens]
        .filter((value): value is number => typeof value === 'number')
        .reduce((sum, value) => sum + value, 0);
    return total > 0 ? `${total.toLocaleString()} tok` : null;
}

function SourceThumbnail({
    refInfo,
    src,
    index,
    onOpen,
    compact
}: {
    refInfo: VisionTextSourceImageRef;
    src?: string;
    index: number;
    onOpen: (index: number) => void;
    compact?: boolean;
}) {
    return (
        <button
            type='button'
            onClick={(event) => {
                event.stopPropagation();
                onOpen(index);
            }}
            className={cn(
                'focus:ring-primary bg-muted/40 relative block h-full min-h-0 w-full overflow-hidden rounded-lg border border-white/[0.06] focus:ring-2 focus:outline-none',
                compact ? 'aspect-square' : 'aspect-[4/3]'
            )}
            aria-label={`打开源图 ${index + 1}`}>
            {src ? (
                <Image
                    src={src}
                    alt={refInfo.filename}
                    width={360}
                    height={270}
                    className='h-full w-full object-cover'
                    unoptimized
                />
            ) : (
                <div className='text-muted-foreground flex h-full min-h-16 flex-col items-center justify-center gap-1 text-[11px]'>
                    <FileImage className='h-5 w-5 opacity-50' />
                    <span>源图待恢复</span>
                </div>
            )}
        </button>
    );
}

export function VisionTextHistoryList({
    items,
    getSourceImageSrc,
    selectionMode,
    selectedIds,
    onSelectItem,
    onSelectHistory,
    onOpenViewer,
    onDeleteItem,
    onSendToGenerator,
    onSyncItem,
    isSyncing
}: VisionTextHistoryListProps) {
    const { language, formatDateTime } = useAppLanguage();
    const [copiedId, setCopiedId] = React.useState<string | null>(null);

    const copyResult = React.useCallback(async (item: VisionTextHistoryMetadata) => {
        await copyTextToClipboard(item.resultText);
        setCopiedId(item.id);
        window.setTimeout(() => setCopiedId(null), 1200);
    }, []);

    if (items.length === 0) {
        return (
            <div className='flex h-full min-h-[220px] items-center justify-center text-white/40'>
                <p>图生文结果将显示在这里。</p>
            </div>
        );
    }

    return (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
            {items.map((item) => {
                const primarySource = item.sourceImages[0];
                const primarySrc = primarySource ? getSourceImageSrc(primarySource) : undefined;
                const extraImageCount = Math.max(0, item.sourceImages.length - 1);
                const usageLabel = getUsageLabel(item);
                const reusablePrompt = getReusablePrompt(item);
                const isSelected = selectedIds.has(item.id);
                const isSynced = item.syncStatus === 'synced';
                const isPartial =
                    item.syncStatus === 'partial' || item.sourceImages.some((image) => !getSourceImageSrc(image));

                return (
                    <article
                        key={item.id}
                        data-vision-text-history-card-id={item.id}
                        className={cn(
                            'app-panel-subtle flex min-w-0 flex-col overflow-hidden rounded-xl border transition-[border-color,box-shadow] hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/10',
                            selectionMode && isSelected ? 'border-blue-500/35 ring-2 ring-blue-500/60' : ''
                        )}>
                        <div className='relative'>
                            {primarySource ? (
                                <SourceThumbnail
                                    refInfo={primarySource}
                                    src={primarySrc}
                                    index={0}
                                    compact
                                    onOpen={() => {
                                        if (selectionMode) {
                                            onSelectItem(item.id);
                                            return;
                                        }
                                        onOpenViewer(item, 0);
                                    }}
                                />
                            ) : (
                                <button
                                    type='button'
                                    onClick={() => onOpenViewer(item, 0)}
                                    className='bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center'>
                                    <FileImage className='h-6 w-6 opacity-60' />
                                </button>
                            )}
                            {selectionMode && (
                                <div className='absolute top-2 left-2 z-20'>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => onSelectItem(item.id)}
                                        className='h-5 w-5 rounded-full border-2 border-white/70 shadow-lg data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white'
                                    />
                                </div>
                            )}
                            <span
                                className={cn(
                                    'pointer-events-none absolute top-2 z-10 rounded-md px-1.5 py-0.5 text-[11px] font-medium shadow-sm',
                                    selectionMode ? 'right-2' : 'left-2',
                                    'bg-black/70 text-white'
                                )}>
                                {VISION_TEXT_TASK_TYPE_LABELS[item.taskType]}
                            </span>
                            {extraImageCount > 0 && (
                                <span className='pointer-events-none absolute bottom-2 left-2 z-10 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white'>
                                    +{extraImageCount}
                                </span>
                            )}
                            {isPartial && (
                                <span
                                    className='pointer-events-none absolute right-2 bottom-2 z-10 inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[11px] font-medium text-white'
                                    title='源图待恢复'>
                                    <AlertTriangle size={11} />
                                </span>
                            )}
                        </div>

                        <div className='flex min-w-0 flex-1 flex-col gap-2 p-2.5'>
                            <button
                                type='button'
                                onClick={() => {
                                    if (selectionMode) {
                                        onSelectItem(item.id);
                                        return;
                                    }
                                    onSelectHistory(item);
                                }}
                                className='focus:ring-primary min-w-0 rounded-lg text-left focus:ring-2 focus:outline-none'>
                                <p className='text-foreground line-clamp-2 text-xs leading-5 sm:text-sm' data-i18n-skip='true'>
                                    {getSummary(item)}
                                </p>
                            </button>

                            <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]'>
                                <span className='max-w-full truncate'>{item.model || '未知模型'}</span>
                                <span>{item.sourceImages.length} 张源图</span>
                                {usageLabel && <span>{usageLabel}</span>}
                                <span
                                    title={formatDateTime(item.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}>
                                    {formatRelativeTime(item.timestamp, language)}
                                </span>
                            </div>

                            <div className='mt-auto grid grid-cols-2 gap-1.5'>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() => onOpenViewer(item, 0)}
                                    className='h-7 rounded-lg px-2 text-xs whitespace-nowrap'>
                                    <FileImage className='mr-1 h-3.5 w-3.5' />
                                    详情
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() => onSelectHistory(item)}
                                    className='h-7 rounded-lg px-2 text-xs whitespace-nowrap'>
                                    <Undo2 className='mr-1 h-3.5 w-3.5' />
                                    恢复
                                </Button>
                            </div>

                            <div className='flex items-center gap-1'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => copyResult(item)}
                                    className='text-muted-foreground h-7 w-7 rounded-lg p-0'
                                    title={copiedId === item.id ? '已复制' : '复制'}
                                    aria-label={copiedId === item.id ? '已复制' : '复制'}>
                                    {copiedId === item.id ? (
                                        <Check className='h-3.5 w-3.5' />
                                    ) : (
                                        <Clipboard className='h-3.5 w-3.5' />
                                    )}
                                </Button>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    disabled={!reusablePrompt}
                                    onClick={() => onSendToGenerator(reusablePrompt)}
                                    className='text-muted-foreground h-7 w-7 rounded-lg p-0'
                                    title='发送到生成器'
                                    aria-label='发送到生成器'>
                                    <Send className='h-3.5 w-3.5' />
                                </Button>
                                {onSyncItem &&
                                    (isSynced ? (
                                        <span
                                            className='text-muted-foreground inline-flex h-7 w-7 items-center justify-center rounded-lg'
                                            title='已同步到云存储'
                                            aria-label='已同步到云存储'>
                                            <Cloud className='h-3.5 w-3.5 text-emerald-500' />
                                        </span>
                                    ) : (
                                        <Button
                                            type='button'
                                            variant='ghost'
                                            size='sm'
                                            disabled={isSyncing}
                                            onClick={() => void onSyncItem(item)}
                                            className='text-muted-foreground h-7 w-7 rounded-lg p-0'
                                            title='同步'
                                            aria-label='同步'>
                                            {isSyncing ? (
                                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                            ) : (
                                                <CloudUpload className='h-3.5 w-3.5' />
                                            )}
                                        </Button>
                                    ))}
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => onDeleteItem(item)}
                                    className='text-muted-foreground hover:text-destructive ml-auto h-7 w-7 rounded-lg p-0'
                                    title='删除'
                                    aria-label='删除'>
                                    <Trash2 className='h-3.5 w-3.5' />
                                </Button>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
