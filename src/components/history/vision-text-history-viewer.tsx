'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
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

function formatUsage(usage?: ProviderUsage): string | null {
    const parts: string[] = [];
    const textTokens = usage?.input_tokens_details?.text_tokens;
    const imageTokens = usage?.input_tokens_details?.image_tokens;
    const outputTokens = usage?.output_tokens;
    if (typeof textTokens === 'number') parts.push(`文本 ${textTokens.toLocaleString()}`);
    if (typeof imageTokens === 'number') parts.push(`图片 ${imageTokens.toLocaleString()}`);
    if (typeof outputTokens === 'number') parts.push(`输出 ${outputTokens.toLocaleString()}`);
    return parts.length > 0 ? parts.join(' / ') : null;
}

function StructuredField({ label, value }: { label: string; value?: string | string[] | null }) {
    const text = Array.isArray(value) ? value.filter(Boolean).join('、') : value?.trim();
    if (!text) return null;

    return (
        <div className='border-border bg-background/60 rounded-lg border p-3 dark:border-white/[0.06] dark:bg-white/[0.025]'>
            <p className='text-foreground/75 mb-1 text-xs font-medium'>{label}</p>
            <p className='text-muted-foreground text-sm leading-5 whitespace-pre-wrap' data-i18n-skip='true'>
                {text}
            </p>
        </div>
    );
}

function StructuredResultFields({ structured }: { structured: ImageToTextStructuredResult | null | undefined }) {
    if (!structured) return null;

    return (
        <div className='grid gap-2 sm:grid-cols-2'>
            <StructuredField label='主提示词' value={structured.prompt} />
            <StructuredField label='负向提示词' value={structured.negativePrompt} />
            <StructuredField label='风格标签' value={structured.styleTags} />
            <StructuredField label='主体' value={structured.subject} />
            <StructuredField label='构图' value={structured.composition} />
            <StructuredField label='光照' value={structured.lighting} />
            <StructuredField label='色彩' value={structured.colorPalette} />
            <StructuredField label='材质' value={structured.materials} />
            <StructuredField label='文字识别' value={structured.textInImage} />
            <StructuredField label='画幅建议' value={structured.aspectRatioRecommendation} />
            <StructuredField label='生成注意事项' value={structured.generationNotes} />
            <StructuredField label='风险提示' value={structured.warnings} />
        </div>
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
    const { formatDateTime } = useAppLanguage();
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const [copied, setCopied] = React.useState<'full' | 'prompt' | null>(null);

    React.useEffect(() => {
        if (!open || !item) return;
        setSelectedIndex(Math.min(Math.max(0, initialSourceImageIndex), Math.max(0, item.sourceImages.length - 1)));
        setCopied(null);
    }, [initialSourceImageIndex, item, open]);

    if (!item) return null;

    const selectedSource = item.sourceImages[selectedIndex] ?? item.sourceImages[0];
    const selectedSrc = selectedSource ? getSourceImageSrc(selectedSource) : undefined;
    const reusablePrompt = getReusablePrompt(item);
    const usageLabel = formatUsage(item.usage);

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
                    <DialogTitle className='text-base leading-tight sm:text-lg'>图生文历史详情</DialogTitle>
                    <DialogDescription className='sr-only'>查看源图和图生文结果。</DialogDescription>
                </DialogHeader>

                <div className='grid min-h-0 flex-1 grid-rows-[minmax(220px,34dvh)_minmax(0,1fr)] overflow-hidden sm:grid-rows-[minmax(240px,38dvh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:grid-rows-none'>
                    <div className='bg-muted/20 flex min-h-0 flex-col overflow-hidden border-b lg:min-h-[300px] lg:border-r lg:border-b-0'>
                        <div className='flex min-h-0 flex-1 items-center justify-center p-3'>
                            {selectedSrc ? (
                                <div className='relative h-full w-full'>
                                    <Image
                                        src={selectedSrc}
                                        alt={selectedSource?.filename ?? '源图'}
                                        fill
                                        className='object-contain'
                                        sizes='(min-width: 1024px) 58vw, 100vw'
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <div className='text-muted-foreground flex min-h-[180px] flex-col items-center justify-center gap-2 text-sm lg:min-h-[260px]'>
                                    <FileImage className='h-10 w-10 opacity-40' />
                                    <span>源图待恢复</span>
                                </div>
                            )}
                        </div>
                        {item.sourceImages.length > 1 && (
                            <div className='border-border flex shrink-0 gap-2 overflow-x-auto border-t p-3'>
                                {item.sourceImages.map((source, index) => {
                                    const src = getSourceImageSrc(source);
                                    return (
                                        <button
                                            type='button'
                                            key={`${source.filename}-${index}`}
                                            onClick={() => setSelectedIndex(index)}
                                            className={cn(
                                                'relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border',
                                                selectedIndex === index
                                                    ? 'border-violet-500 ring-2 ring-violet-500/40'
                                                    : 'border-white/[0.08]'
                                            )}
                                            aria-label={`查看源图 ${index + 1}`}>
                                            {src ? (
                                                <Image
                                                    src={src}
                                                    alt={source.filename}
                                                    fill
                                                    className='object-cover'
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className='bg-muted text-muted-foreground flex h-full w-full items-center justify-center'>
                                                    <FileImage className='h-4 w-4' />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className='min-h-0 overflow-y-auto p-3 sm:p-4'>
                        <div className='mb-4 grid gap-2 text-sm sm:grid-cols-2'>
                            <div>
                                <p className='text-muted-foreground text-xs'>任务类型</p>
                                <p className='font-medium'>{VISION_TEXT_TASK_TYPE_LABELS[item.taskType]}</p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>模型</p>
                                <p className='truncate font-medium'>{item.model || '未知模型'}</p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>创建时间</p>
                                <p className='font-medium'>
                                    {formatDateTime(item.timestamp, { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>耗时 / 源图</p>
                                <p className='font-medium'>
                                    {formatDuration(item.durationMs)} / {item.sourceImages.length} 张
                                </p>
                            </div>
                            <div>
                                <p className='text-muted-foreground text-xs'>精度</p>
                                <p className='font-medium'>{VISION_TEXT_DETAIL_LABELS[item.detail]}</p>
                            </div>
                            {usageLabel && (
                                <div>
                                    <p className='text-muted-foreground text-xs'>Usage</p>
                                    <p className='font-medium'>{usageLabel}</p>
                                </div>
                            )}
                        </div>

                        {item.prompt && (
                            <div className='border-border bg-muted/35 mb-4 rounded-lg border p-3'>
                                <p className='text-foreground/75 mb-1 text-xs font-medium'>用户指导词</p>
                                <p
                                    className='text-muted-foreground text-sm leading-5 whitespace-pre-wrap'
                                    data-i18n-skip='true'>
                                    {item.prompt}
                                </p>
                            </div>
                        )}

                        <div className='border-border bg-background/70 mb-4 max-h-[32dvh] overflow-auto rounded-lg border p-3 lg:max-h-[34vh]'>
                            <p className='text-foreground/75 mb-2 text-xs font-medium'>完整结果</p>
                            <pre className='text-foreground/90 text-sm leading-6 break-words whitespace-pre-wrap'>
                                {item.resultText || '无文本结果'}
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
                            {copied === 'full' ? '已复制' : '复制全文'}
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
                                {copied === 'prompt' ? '已复制' : '复制主提示词'}
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
                            替换提示词
                        </Button>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            disabled={!reusablePrompt}
                            onClick={() => onAppendPrompt(reusablePrompt)}
                            className='w-full justify-center sm:w-auto'>
                            <Plus className='mr-2 h-4 w-4' />
                            追加提示词
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
                            恢复到图生文
                        </Button>
                        <Button
                            type='button'
                            size='sm'
                            disabled={!reusablePrompt}
                            onClick={() => onSendToGenerator(reusablePrompt)}
                            className='w-full justify-center sm:w-auto'>
                            <Send className='mr-2 h-4 w-4' />
                            发送到生成器
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
