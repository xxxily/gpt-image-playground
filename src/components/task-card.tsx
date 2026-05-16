import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, AlertCircle, Send, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

interface TaskType {
    id: string;
    mode: 'generate' | 'edit';
    status: 'queued' | 'running' | 'streaming' | 'done' | 'error' | 'cancelled';
    prompt: string;
    model: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    streamingPreviews: Map<number, string>;
    durationMs: number;
    result?: {
        images: { path: string; filename: string }[];
        historyEntry: {
            durationMs: number;
            costDetails: {
                estimated_cost_usd: number;
                text_input_tokens: number;
                image_input_tokens: number;
                image_output_tokens: number;
            } | null;
        };
    };
    error?: string;
}

interface TaskCardProps {
    task: TaskType;
    onCancel: (id: string) => void;
    onSendToEdit: (filename: string) => void;
    onRetry: (id: string) => void;
    onImageClick?: (path: string) => void;
    className?: string;
}

function ElapsedTimer({ startedAt, completedAt }: { startedAt?: number; completedAt?: number }) {
    const [elapsed, setElapsed] = React.useState(0);

    React.useEffect(() => {
        if (!startedAt) return;
        if (completedAt) {
            setElapsed(completedAt - startedAt);
            return;
        }
        const tick = () => {
            setElapsed(Date.now() - startedAt);
        };
        tick();
        const interval = window.setInterval(tick, 250);
        return () => window.clearInterval(interval);
    }, [startedAt, completedAt]);

    const seconds = elapsed / 1000;
    const display =
        seconds < 60 ? seconds.toFixed(1) + 's' : Math.floor(seconds / 60) + 'm' + Math.floor(seconds % 60) + 's';

    return <span className='font-mono text-xs text-white/40 tabular-nums'>{display}</span>;
}

export function TaskCard({ task, onCancel, onSendToEdit, onRetry, onImageClick, className }: TaskCardProps) {
    const isQueued = task.status === 'queued';
    const isActive = task.status === 'running' || task.status === 'streaming';
    const isDone = task.status === 'done';
    const isError = task.status === 'error';
    const isCancelled = task.status === 'cancelled';

    return (
        <div
            className={cn(
                'flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm',
                className
            )}>
            <div className='flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2'>
                <div className='flex min-w-0 flex-1 items-center gap-2'>
                    {isQueued && <Loader2 className='h-4 w-4 animate-spin text-white/40' />}
                    {task.status === 'running' && <Loader2 className='h-4 w-4 animate-spin text-white/60' />}
                    {task.status === 'streaming' && <Loader2 className='h-4 w-4 animate-spin text-violet-400' />}
                    {isDone && <CheckCircle2 className='h-4 w-4 shrink-0 text-green-400' />}
                    {isError && <AlertCircle className='h-4 w-4 shrink-0 text-red-400' />}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span
                                className='truncate text-sm text-white/80'
                                data-i18n-skip={task.prompt ? 'true' : undefined}>
                                {task.prompt || '（无提示词）'}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className='max-w-xs' data-i18n-skip='true'>
                            {task.prompt}
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div className='flex shrink-0 items-center gap-2'>
                    {isQueued && <span className='text-xs text-white/40'>排队中</span>}
                    {(isQueued || isActive) && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 px-2 text-white/40 hover:bg-white/10 hover:text-white'
                            onClick={() => onCancel(task.id)}>
                            取消
                        </Button>
                    )}
                    {isError && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 px-2 text-white/40 hover:bg-white/10 hover:text-white'
                            onClick={() => onRetry(task.id)}>
                            <RotateCcw className='mr-1 h-3 w-3' />
                            重试
                        </Button>
                    )}
                </div>
            </div>

            <div className='px-3 py-3'>
                {isQueued && (
                    <div className='flex items-center gap-2 text-sm text-white/40'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        <span>排队中 — 等待空闲...</span>
                    </div>
                )}

                {isActive && (
                    <div className='space-y-2'>
                        <div className='flex items-center gap-2'>
                            <span className='text-sm text-white/60'>
                                {task.status === 'streaming' ? '流式生成中...' : '正在处理...'}
                            </span>
                            <ElapsedTimer startedAt={task.startedAt} completedAt={task.completedAt} />
                        </div>
                        {task.streamingPreviews.size > 0 && (
                            <div className='relative flex aspect-video max-h-[200px] items-center justify-center overflow-hidden rounded-lg bg-white/[0.02]'>
                                {Array.from(task.streamingPreviews.entries()).map(([index, dataUrl]) => (
                                    <Image
                                        key={index}
                                        src={dataUrl}
                                        alt={`预览 ${index + 1}`}
                                        fill
                                        style={{ objectFit: 'contain' }}
                                        className='opacity-60'
                                        unoptimized
                                    />
                                ))}
                                <div className='absolute inset-0 flex items-center justify-center bg-black/30'>
                                    <div className='flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-white/80'>
                                        <Loader2 className='h-4 w-4 animate-spin' />
                                        <span className='text-sm'>生成图片中...</span>
                                        <ElapsedTimer startedAt={task.startedAt} completedAt={task.completedAt} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {isDone && task.result && (
                    <div className='space-y-3'>
                        <div className='flex items-center gap-2 text-sm'>
                            <span className='text-white/40'>完成</span>
                            <span className='text-white/20'>·</span>
                            <span className='text-white/40'>
                                {task.result.historyEntry?.durationMs
                                    ? `${(task.result.historyEntry.durationMs / 1000).toFixed(1)}s`
                                    : `${(task.durationMs / 1000).toFixed(1)}s`}
                            </span>
                            {task.result.historyEntry?.costDetails && (
                                <>
                                    <span className='text-white/20'>·</span>
                                    <span className='text-white/40'>
                                        ${task.result.historyEntry.costDetails.estimated_cost_usd.toFixed(4)}
                                    </span>
                                </>
                            )}
                        </div>

                        <div
                            className={cn(
                                'grid gap-2',
                                task.result.images.length === 1
                                    ? 'grid-cols-1'
                                    : task.result.images.length === 2
                                      ? 'grid-cols-2'
                                      : 'grid-cols-2'
                            )}>
                            {task.result.images.map((img, i) => (
                                <div
                                    key={img.filename}
                                    className='group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]'
                                    onClick={() => onImageClick?.(img.path)}>
                                    <Image
                                        src={img.path}
                                        alt={`结果 ${i + 1}`}
                                        fill
                                        style={{ objectFit: 'contain' }}
                                        unoptimized
                                    />
                                    <div className='absolute inset-0 flex items-end justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100'>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            className='mb-2 border-white/20 bg-white/10 text-white hover:bg-white/20'
                                            onClick={() => onSendToEdit(img.filename)}>
                                            <Send className='mr-1 h-3 w-3' />
                                            发送到编辑
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isError && (
                    <div className='space-y-1'>
                        <p className='text-sm text-red-400'>{task.error}</p>
                        <p className='text-xs text-white/30'>尝试次数: {(task.durationMs / 1000).toFixed(1)}s</p>
                    </div>
                )}

                {isCancelled && <p className='text-sm text-white/40'>任务已取消</p>}
            </div>
        </div>
    );
}
