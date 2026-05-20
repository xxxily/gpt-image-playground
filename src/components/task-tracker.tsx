import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

interface Task {
    id: string;
    mode: 'generate' | 'edit' | 'image-to-text';
    status: 'queued' | 'running' | 'streaming' | 'done' | 'error' | 'cancelled';
    prompt: string;
    model: string;
    createdAt: number;
    startedAt?: number;
    streamingPreviews?: Map<number, string>;
    durationMs: number;
    error?: string;
    batchId?: string;
    batchIndex?: number;
    batchTotal?: number;
    batchLabel?: string;
    result?: {
        images: { path: string; filename: string }[];
    };
}

interface TaskTrackerProps {
    tasks: Task[];
    onCancel: (id: string) => void;
    onRetry: (id: string) => void;
    onSelectTask: (id: string) => void;
    selectedTaskId?: string;
    maxConcurrent?: number;
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

    return <span className='font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums'>{display}</span>;
}

export function TaskTracker({ tasks, onCancel, onRetry, onSelectTask, selectedTaskId, maxConcurrent = 3 }: TaskTrackerProps) {
    const { t } = useAppLanguage();

    const runningCount = tasks.filter((t) => t.status === 'running').length;
    const streamingCount = tasks.filter((t) => t.status === 'streaming').length;
    const queuedCount = tasks.filter((t) => t.status === 'queued').length;
    const errorCount = tasks.filter((t) => t.status === 'error').length;
    const activeCount = runningCount + streamingCount;

    const activeTasks = tasks.filter(
        (t) => t.status === 'queued' || t.status === 'running' || t.status === 'streaming' || t.status === 'error'
    );
    const hasRunningTasks = activeTasks.some(
        (t) => t.status === 'running' || t.status === 'streaming' || t.status === 'queued'
    );

    if (activeTasks.length === 0) return null;

    const concurrencyDots = Array.from({ length: maxConcurrent }, (_, i) => (
        <span
            key={i}
            className={cn(
                'inline-block h-2 w-2 rounded-full',
                i < activeCount ? 'bg-foreground' : 'border border-border'
            )}
        />
    ));

    return (
        <div className='mb-4 overflow-hidden rounded-xl border border-border bg-card'>
            <div className='flex items-center justify-between border-b border-border px-4 py-2'>
                <div className='flex items-center gap-2'>
                    {hasRunningTasks ? (
                        <Loader2 className='h-3 w-3 animate-spin text-primary' />
                    ) : (
                        <AlertTriangle className='h-3 w-3 text-destructive' />
                    )}
                    <span className='text-xs font-medium text-muted-foreground'>
                        {t('tasks.running')} {runningCount + streamingCount} / {t('tasks.queued')} {queuedCount} / {t('tasks.error')} {errorCount}
                    </span>
                </div>
                <div className='flex items-center gap-1' aria-label={t('tasks.concurrencySlots')}>
                    {concurrencyDots}
                </div>
            </div>
            <div className='max-h-[300px] divide-y divide-border overflow-y-auto'>
                {activeTasks.map((task) => {
                    const isActive = task.status === 'running' || task.status === 'streaming';
                    const isQueued = task.status === 'queued';
                    const isSelected = task.id === selectedTaskId;
                    const isStreaming = task.status === 'streaming';
                    const isError = task.status === 'error';

                    return (
                        <div
                            key={task.id}
                            onClick={() => onSelectTask(task.id)}
                            className={cn(
                                'flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors',
                                isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                            )}>
                            <div className='shrink-0'>
                                {isError ? (
                                    <AlertTriangle className='h-4 w-4 text-destructive' />
                                ) : isStreaming ? (
                                    <Loader2 className='h-4 w-4 animate-spin text-primary' />
                                ) : isQueued ? (
                                    <div className='h-4 w-4 rounded-full border border-border' />
                                ) : (
                                    <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                                )}
                            </div>

                            <div className='min-w-0 flex-1'>
                                <div className='flex min-w-0 items-center gap-2'>
                                    <span
                                        className='truncate text-sm text-foreground'
                                        data-i18n-skip={task.prompt ? 'true' : undefined}>
                                        {task.prompt || '等待中...'}
                                    </span>
                                    <span className='shrink-0 text-xs whitespace-nowrap text-muted-foreground'>·</span>
                                    <span
                                        className={cn(
                                            'shrink-0 text-xs whitespace-nowrap',
                                            isError ? 'text-destructive' : 'text-muted-foreground'
                                        )}>
                                        {isError
                                            ? '出错'
                                            : isQueued
                                              ? '排队中'
                                              : isStreaming
                                                ? task.mode === 'image-to-text'
                                                    ? '流式文本'
                                                    : '流式生成'
                                            : '处理中'}
                                    </span>
                                </div>
                                {(task.batchId || task.batchLabel || task.batchIndex || task.batchTotal) && (
                                    <div className='mt-1 flex flex-wrap items-center gap-1.5 text-[11px]'>
                                        <span className='rounded-md border border-border px-1.5 py-0.5 text-muted-foreground'>
                                            {t('batch.task.group')}
                                        </span>
                                        {task.batchLabel && (
                                            <span
                                                className='max-w-[14rem] truncate rounded-md border border-border px-1.5 py-0.5 text-muted-foreground'
                                                data-i18n-skip='true'>
                                                {task.batchLabel}
                                            </span>
                                        )}
                                        {typeof task.batchIndex === 'number' && typeof task.batchTotal === 'number' && (
                                            <span className='rounded-md border border-border px-1.5 py-0.5 text-muted-foreground tabular-nums'>
                                                {task.batchIndex}/{task.batchTotal}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {isError && task.error && (
                                    <p className='mt-1 line-clamp-2 text-xs text-destructive/85'>{task.error}</p>
                                )}
                            </div>

                            <div className='flex shrink-0 items-center gap-3'>
                                {isActive && <ElapsedTimer startedAt={task.startedAt} />}

                                {(isQueued || isActive) && (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        className='h-6 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCancel(task.id);
                                        }}>
                                        取消
                                    </Button>
                                )}

                                {isError && (
                                    <>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-6 px-2 text-muted-foreground hover:bg-muted hover:text-foreground'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRetry(task.id);
                                            }}>
                                            <RotateCcw className='h-3 w-3' />
                                            重试
                                        </Button>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-6 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCancel(task.id);
                                            }}>
                                            关闭
                                        </Button>
                                    </>
                                )}
                            </div>

                            {isStreaming && task.streamingPreviews && task.streamingPreviews.size > 0 && (
                                <div className='h-8 w-8 shrink-0 overflow-hidden rounded border border-border bg-muted/50'>
                                    {(() => {
                                        const entries = Array.from(task.streamingPreviews!.entries());
                                        const latest = entries[entries.length - 1];
                                        if (!latest) return null;
                                        return (
                                            <Image
                                                src={latest[1]}
                                                alt='preview'
                                                width={32}
                                                height={32}
                                                className='object-cover'
                                                unoptimized
                                            />
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
