import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
    result?: {
        images: { path: string; filename: string }[];
    };
}

interface TaskTrackerProps {
    tasks: Task[];
    onCancel: (id: string) => void;
    onSelectTask: (id: string) => void;
    selectedTaskId?: string;
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

    return <span className='font-mono text-xs whitespace-nowrap text-white/40 tabular-nums'>{display}</span>;
}

export function TaskTracker({ tasks, onCancel, onSelectTask, selectedTaskId }: TaskTrackerProps) {
    const activeTasks = tasks.filter(
        (t) => t.status === 'queued' || t.status === 'running' || t.status === 'streaming' || t.status === 'error'
    );
    const hasRunningTasks = activeTasks.some(
        (t) => t.status === 'running' || t.status === 'streaming' || t.status === 'queued'
    );

    if (activeTasks.length === 0) return null;

    return (
        <div className='mb-4 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]'>
            <div className='flex items-center justify-center gap-2 border-b border-white/[0.06] bg-white/[0.01] px-4 py-2'>
                {hasRunningTasks ? (
                    <Loader2 className='h-3 w-3 animate-spin text-violet-400' />
                ) : (
                    <AlertTriangle className='h-3 w-3 text-red-400' />
                )}
                <span className='text-xs font-medium text-white/60'>任务队列 ({activeTasks.length})</span>
            </div>
            <div className='max-h-[300px] divide-y divide-white/[0.04] overflow-y-auto'>
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
                                isSelected ? 'bg-violet-500/10' : 'hover:bg-white/[0.02]'
                            )}>
                            <div className='shrink-0'>
                                {isError ? (
                                    <AlertTriangle className='h-4 w-4 text-red-400' />
                                ) : isStreaming ? (
                                    <Loader2 className='h-4 w-4 animate-spin text-violet-400' />
                                ) : isQueued ? (
                                    <div className='h-4 w-4 rounded-full border border-white/20' />
                                ) : (
                                    <Loader2 className='h-4 w-4 animate-spin text-white/40' />
                                )}
                            </div>

                            <div className='min-w-0 flex-1'>
                                <div className='flex min-w-0 items-center gap-2'>
                                    <span
                                        className='truncate text-sm text-white/80'
                                        data-i18n-skip={task.prompt ? 'true' : undefined}>
                                        {task.prompt || '等待中...'}
                                    </span>
                                    <span className='shrink-0 text-xs whitespace-nowrap text-white/30'>·</span>
                                    <span
                                        className={cn(
                                            'shrink-0 text-xs whitespace-nowrap',
                                            isError ? 'text-red-300' : 'text-white/40'
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
                                {isError && task.error && (
                                    <p className='mt-1 line-clamp-2 text-xs text-red-300/85'>{task.error}</p>
                                )}
                            </div>

                            <div className='flex shrink-0 items-center gap-3'>
                                {isActive && <ElapsedTimer startedAt={task.startedAt} />}

                                {(isQueued || isActive) && (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        className='h-6 px-2 text-white/30 hover:bg-red-500/10 hover:text-red-400'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCancel(task.id);
                                        }}>
                                        取消
                                    </Button>
                                )}

                                {isError && (
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        className='h-6 px-2 text-white/30 hover:bg-red-500/10 hover:text-red-300'
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCancel(task.id);
                                        }}>
                                        关闭
                                    </Button>
                                )}
                            </div>

                            {isStreaming && task.streamingPreviews && task.streamingPreviews.size > 0 && (
                                <div className='h-8 w-8 shrink-0 overflow-hidden rounded border border-white/10 bg-black/40'>
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
