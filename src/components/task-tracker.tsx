import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import * as React from 'react';

interface Task {
    id: string;
    mode: 'generate' | 'edit';
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
        const frame = requestAnimationFrame(function tick() {
            setElapsed(Date.now() - startedAt);
            requestAnimationFrame(tick);
        });
        return () => cancelAnimationFrame(frame);
    }, [startedAt, completedAt]);

    const seconds = elapsed / 1000;
    const display = seconds < 60 ? seconds.toFixed(1) + 's' : Math.floor(seconds / 60) + 'm' + Math.floor(seconds % 60) + 's';

    return <span className="font-mono text-xs text-white/40 tabular-nums whitespace-nowrap">{display}</span>;
}

export function TaskTracker({ tasks, onCancel, onSelectTask, selectedTaskId }: TaskTrackerProps) {
    const activeTasks = tasks.filter(t => t.status === 'queued' || t.status === 'running' || t.status === 'streaming');

    if (activeTasks.length === 0) return null;

    return (
        <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-center gap-2 bg-white/[0.01]">
                <Loader2 className="h-3 w-3 text-violet-400 animate-spin" />
                <span className="text-xs font-medium text-white/60">任务队列 ({activeTasks.length})</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-white/[0.04]">
                {activeTasks.map(task => {
                    const isActive = task.status === 'running' || task.status === 'streaming';
                    const isQueued = task.status === 'queued';
                    const isSelected = task.id === selectedTaskId;
                    const isStreaming = task.status === 'streaming';

                    return (
                        <div
                            key={task.id}
                            onClick={() => onSelectTask(task.id)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer",
                                isSelected ? "bg-violet-500/10" : "hover:bg-white/[0.02]"
                            )}
                        >
                            <div className="shrink-0">
                                {isStreaming ? (
                                    <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
                                ) : isQueued ? (
                                    <div className="h-4 w-4 rounded-full border border-white/20" />
                                ) : (
                                    <Loader2 className="h-4 w-4 text-white/40 animate-spin" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                <span className="truncate text-sm text-white/80">{task.prompt || '等待中...'}</span>
                                <span className="text-xs text-white/30 whitespace-nowrap shrink-0">·</span>
                                <span className="text-xs text-white/40 whitespace-nowrap shrink-0">
                                    {isQueued ? '排队中' : isStreaming ? '流式生成' : '处理中'}
                                </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {isActive && <ElapsedTimer startedAt={task.startedAt} />}
                                
                                {isActive && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCancel(task.id);
                                        }}
                                    >
                                        取消
                                    </Button>
                                )}
                            </div>

                            {isStreaming && task.streamingPreviews && task.streamingPreviews.size > 0 && (
                                <div className="shrink-0 h-8 w-8 rounded overflow-hidden bg-black/40 border border-white/10">
                                    {(() => {
                                        const entries = Array.from(task.streamingPreviews!.entries());
                                        const latest = entries[entries.length - 1];
                                        if (!latest) return null;
                                        return (
                                            <Image
                                                src={latest[1]}
                                                alt="preview"
                                                width={32}
                                                height={32}
                                                className="object-cover"
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
