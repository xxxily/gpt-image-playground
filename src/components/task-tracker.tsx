import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Loader2, RotateCcw, Trash2 } from 'lucide-react';
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
    onRetryAllFailed?: () => void;
    onClearFailed?: () => void;
    onSelectTask: (id: string) => void;
    selectedTaskId?: string;
    maxConcurrent?: number;
}

function formatTaskDuration(durationMs: number): string {
    if (!Number.isFinite(durationMs) || durationMs < 0) return '0.0s';
    const seconds = durationMs / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`;
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

    return <span className='text-muted-foreground font-mono text-xs whitespace-nowrap tabular-nums'>{display}</span>;
}

export function TaskTracker({
    tasks,
    onCancel,
    onRetry,
    onRetryAllFailed,
    onClearFailed,
    onSelectTask,
    selectedTaskId,
    maxConcurrent = 3
}: TaskTrackerProps) {
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
                i < activeCount ? 'bg-foreground' : 'border-border border'
            )}
        />
    ));

    return (
        <div className='border-border bg-card mb-4 overflow-hidden rounded-xl border'>
            <div className='border-border flex flex-col gap-2 border-b px-4 py-2 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex items-center gap-2'>
                    {hasRunningTasks ? (
                        <Loader2 className='text-primary h-3 w-3 animate-spin' />
                    ) : (
                        <AlertTriangle className='text-destructive h-3 w-3' />
                    )}
                    <span className='text-muted-foreground text-xs font-medium'>
                        {t('tasks.running')} {runningCount + streamingCount} / {t('tasks.queued')} {queuedCount} /{' '}
                        {t('tasks.error')} {errorCount}
                    </span>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-2'>
                    {errorCount > 0 && onRetryAllFailed && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='text-muted-foreground hover:bg-muted hover:text-foreground h-7 rounded-md px-2 text-xs'
                            onClick={onRetryAllFailed}>
                            <RotateCcw className='h-3 w-3' />
                            {t('tasks.retryAllFailed')}
                        </Button>
                    )}
                    {errorCount > 0 && onClearFailed && (
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-7 rounded-md px-2 text-xs'
                            onClick={onClearFailed}>
                            <Trash2 className='h-3 w-3' />
                            {t('tasks.clearFailed')}
                        </Button>
                    )}
                    <div className='flex items-center gap-1' aria-label={t('tasks.concurrencySlots')}>
                        {concurrencyDots}
                    </div>
                </div>
            </div>
            <div className='divide-border max-h-[300px] divide-y overflow-y-auto'>
                {activeTasks.map((task) => {
                    const isActive = task.status === 'running' || task.status === 'streaming';
                    const isQueued = task.status === 'queued';
                    const isSelected = task.id === selectedTaskId;
                    const isStreaming = task.status === 'streaming';
                    const isError = task.status === 'error';
                    const statusLabel = isError
                        ? t('tasks.status.error')
                        : isQueued
                          ? t('tasks.status.queued')
                          : isStreaming
                            ? task.mode === 'image-to-text'
                                ? t('tasks.status.streamingText')
                                : t('tasks.status.streamingImage')
                            : t('tasks.status.processing');

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
                                    <AlertTriangle className='text-destructive h-4 w-4' />
                                ) : isStreaming ? (
                                    <Loader2 className='text-primary h-4 w-4 animate-spin' />
                                ) : isQueued ? (
                                    <div className='border-border h-4 w-4 rounded-full border' />
                                ) : (
                                    <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                                )}
                            </div>

                            <div className='min-w-0 flex-1'>
                                <div className='flex min-w-0 items-center gap-2'>
                                    <span
                                        className='text-foreground truncate text-sm'
                                        data-i18n-skip={task.prompt ? 'true' : undefined}>
                                        {task.prompt || t('tasks.emptyPrompt')}
                                    </span>
                                    <span className='text-muted-foreground shrink-0 text-xs whitespace-nowrap'>·</span>
                                    <span
                                        className={cn(
                                            'shrink-0 text-xs whitespace-nowrap',
                                            isError ? 'text-destructive' : 'text-muted-foreground'
                                        )}>
                                        {statusLabel}
                                    </span>
                                </div>
                                {(task.batchId || task.batchLabel || task.batchIndex || task.batchTotal) && (
                                    <div className='mt-1 flex flex-wrap items-center gap-1.5 text-[11px]'>
                                        <span className='border-border text-muted-foreground rounded-md border px-1.5 py-0.5'>
                                            {t('batch.task.group')}
                                        </span>
                                        {task.batchLabel && (
                                            <span
                                                className='border-border text-muted-foreground max-w-[14rem] truncate rounded-md border px-1.5 py-0.5'
                                                data-i18n-skip='true'>
                                                {task.batchLabel}
                                            </span>
                                        )}
                                        {typeof task.batchIndex === 'number' && typeof task.batchTotal === 'number' && (
                                            <span className='border-border text-muted-foreground rounded-md border px-1.5 py-0.5 tabular-nums'>
                                                {task.batchIndex}/{task.batchTotal}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {isError && task.error && (
                                    <p className='text-destructive/85 mt-1 line-clamp-2 text-xs'>{task.error}</p>
                                )}
                            </div>

                            <div className='flex shrink-0 flex-wrap items-center justify-end gap-2'>
                                {isActive && <ElapsedTimer startedAt={task.startedAt} />}
                                {isError && task.durationMs > 0 && (
                                    <span className='text-muted-foreground inline-flex items-center gap-1 font-mono text-xs whitespace-nowrap tabular-nums'>
                                        <Clock className='h-3 w-3' aria-hidden='true' />
                                        {t('tasks.duration', { duration: formatTaskDuration(task.durationMs) })}
                                    </span>
                                )}

                                {(isQueued || isActive) && (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-6 px-2'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCancel(task.id);
                                        }}>
                                        {t('tasks.cancel')}
                                    </Button>
                                )}

                                {isError && (
                                    <>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='text-muted-foreground hover:bg-muted hover:text-foreground h-6 px-2'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRetry(task.id);
                                            }}>
                                            <RotateCcw className='h-3 w-3' />
                                            {t('tasks.retry')}
                                        </Button>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-6 px-2'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCancel(task.id);
                                            }}>
                                            {t('tasks.dismiss')}
                                        </Button>
                                    </>
                                )}
                            </div>

                            {isStreaming && task.streamingPreviews && task.streamingPreviews.size > 0 && (
                                <div className='border-border bg-muted/50 h-8 w-8 shrink-0 overflow-hidden rounded border'>
                                    {(() => {
                                        const entries = Array.from(task.streamingPreviews!.entries());
                                        const latest = entries[entries.length - 1];
                                        if (!latest) return null;
                                        return (
                                            <Image
                                                src={latest[1]}
                                                alt={t('tasks.streamingPreviewAlt')}
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
