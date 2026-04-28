import { TaskCard } from '@/components/task-card';
import { Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import type { HistoryMetadata } from '@/types/history';

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
        historyEntry: HistoryMetadata;
    };
    error?: string;
}

interface TaskListProps {
    tasks: TaskType[];
    maxConcurrent: number;
    onCancel: (id: string) => void;
    onSendToEdit: (filename: string) => void;
    onClearCompleted: () => void;
    onRetry: (id: string) => void;
    displayedBatch?: { path: string; filename: string }[] | null;
    onImageClick?: (path: string) => void;
    onDismissBatch?: () => void;
}

const ACTIVE_STATUSES = new Set<TaskType['status']>(['queued', 'running', 'streaming']);
const COMPLETED_STATUSES = new Set<TaskType['status']>(['done', 'error', 'cancelled']);

function sortTasks(a: TaskType, b: TaskType): number {
    const aActive = ACTIVE_STATUSES.has(a.status);
    const bActive = ACTIVE_STATUSES.has(b.status);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return b.createdAt - a.createdAt;
}

export function TaskList({ tasks, onCancel, onSendToEdit, onClearCompleted, onRetry, displayedBatch, onImageClick, onDismissBatch }: TaskListProps) {
    const activeCount = tasks.filter(t => ACTIVE_STATUSES.has(t.status)).length;
    const completedCount = tasks.filter(t => COMPLETED_STATUSES.has(t.status)).length;
    const sorted = [...tasks].sort(sortTasks);

    if (tasks.length === 0 && !displayedBatch) {
        return (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] border-dashed">
                <Sparkles className="h-8 w-8 text-white/20" />
                <p className="text-sm text-white/40">提交生成任务后，结果将显示在这里。</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {displayedBatch && displayedBatch.length > 0 ? (
                <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] border-dashed p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-white/60">历史预览</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white" onClick={() => onDismissBatch?.()}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className={`grid gap-2 ${displayedBatch.length === 1 ? 'grid-cols-1' : displayedBatch.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                        {displayedBatch.map((img, i) => (
                            <div
                                key={img.filename}
                                className="relative group rounded-lg overflow-hidden bg-white/[0.02] border border-white/[0.06] aspect-square cursor-pointer"
                                onClick={() => onImageClick?.(img.path)}
                            >
                                <Image
                                    src={img.path}
                                    alt={`历史 ${i + 1}`}
                                    fill
                                    style={{ objectFit: 'contain' }}
                                    unoptimized
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all opacity-0 group-hover:opacity-100">
                                    <Button size="sm" variant="outline" className="mb-2 bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); onSendToEdit(img.filename); }}>
                                        发送到编辑
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
                {sorted.map(task => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        onCancel={onCancel}
                        onSendToEdit={onSendToEdit}
                        onRetry={onRetry}
                        onImageClick={onImageClick}
                    />
                ))}
            </div>

            {completedCount > 0 && (
                <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-white/[0.06] shrink-0">
                    <span className="text-xs text-white/40">
                        {activeCount > 0 ? `${activeCount} 个任务运行中` : '全部完成'} · 共 {tasks.length} 个
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs text-white/40 hover:text-white hover:bg-white/10"
                        onClick={onClearCompleted}
                    >
                        <Trash2 className="h-3 w-3 mr-1" />
                        清空已完成
                    </Button>
                </div>
            )}
        </div>
    );
}
