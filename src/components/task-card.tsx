import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CategorizedError } from '@/lib/api-error-category';
import { computeEtaState } from '@/lib/task-eta';
import { cn } from '@/lib/utils';
import {
    CheckCircle2,
    AlertTriangle,
    Send,
    RotateCcw,
    KeyRound,
    Clock,
    ServerCrash,
    WifiOff,
    Wallet,
    Copy,
    Check,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
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
        images: { path: string; filename: string; size?: number }[];
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
    errorCategory?: CategorizedError;
}

interface TaskCardProps {
    task: TaskType;
    onCancel: (id: string) => void;
    onSendToEdit: (filename: string) => void;
    onRetry: (id: string) => void;
    onImageClick?: (path: string) => void;
    className?: string;
    etaMs?: number | null;
}

function ElapsedTimer({
    startedAt,
    completedAt,
    etaMs
}: {
    startedAt?: number;
    completedAt?: number;
    etaMs?: number | null;
}) {
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

    const eta = !completedAt && typeof etaMs === 'number' ? computeEtaState(elapsed, etaMs) : null;
    const seconds = elapsed / 1000;
    const display =
        seconds < 60 ? seconds.toFixed(1) + 's' : Math.floor(seconds / 60) + 'm' + Math.floor(seconds % 60) + 's';

    if (eta && eta.phase === 'estimating') {
        const remainingSec = Math.max(1, Math.ceil(eta.remainingMs / 1000));
        return (
            <span className='text-on-panel-faint font-mono text-xs tabular-nums'>
                {display} <LocalizedMessage id='phase4b.estimatedRemaining' />
                {remainingSec}s
            </span>
        );
    }
    if (eta && eta.phase === 'overrun') {
        return (
            <span className='font-mono text-xs text-amber-700 tabular-nums dark:text-amber-300'>
                {display} <LocalizedMessage id='phase4b.overEstimate' />
            </span>
        );
    }

    return <span className='text-on-panel-faint font-mono text-xs tabular-nums'>{display}</span>;
}

function formatTaskDuration(durationMs: number): string {
    if (!Number.isFinite(durationMs) || durationMs < 0) return '0.0s';
    const seconds = durationMs / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${Math.floor(seconds / 60)}m${Math.floor(seconds % 60)}s`;
}

export function TaskCard({ task, onCancel, onSendToEdit, onRetry, onImageClick, className, etaMs }: TaskCardProps) {
    const { t } = useAppLanguage();
    const isQueued = task.status === 'queued';
    const isActive = task.status === 'running' || task.status === 'streaming';
    const isDone = task.status === 'done';
    const isError = task.status === 'error';
    const isCancelled = task.status === 'cancelled';

    const category = task.errorCategory;
    const [copiedError, setCopiedError] = React.useState(false);
    const [rawExpanded, setRawExpanded] = React.useState(false);
    const [rateLimitRemainingSec, setRateLimitRemainingSec] = React.useState<number>(() =>
        category?.category === 'rate-limit' && category.retryAfterSec ? category.retryAfterSec : 0
    );

    React.useEffect(() => {
        if (category?.category !== 'rate-limit' || !category.retryAfterSec) {
            setRateLimitRemainingSec(0);
            return;
        }
        setRateLimitRemainingSec(category.retryAfterSec);
        const interval = window.setInterval(() => {
            setRateLimitRemainingSec((current) => (current > 0 ? current - 1 : 0));
        }, 1000);
        return () => window.clearInterval(interval);
    }, [category?.category, category?.retryAfterSec, task.id]);

    const errorIcon = React.useMemo(() => {
        switch (category?.category) {
            case 'auth':
                return KeyRound;
            case 'rate-limit':
                return Clock;
            case 'server':
                return ServerCrash;
            case 'network':
                return WifiOff;
            case 'quota':
                return Wallet;
            default:
                return AlertTriangle;
        }
    }, [category?.category]);

    const errorHintKey = React.useMemo(() => {
        switch (category?.category) {
            case 'auth':
                return 'task.error.hint.auth';
            case 'rate-limit':
                return 'task.error.hint.rateLimit';
            case 'server':
                return 'task.error.hint.server';
            case 'network':
                return 'task.error.hint.network';
            case 'quota':
                return 'task.error.hint.quota';
            default:
                return null;
        }
    }, [category?.category]);

    const errorToneClasses = React.useMemo(() => {
        switch (category?.category) {
            case 'auth':
            case 'rate-limit':
            case 'network':
                return 'text-amber-700 dark:text-amber-300';
            case 'server':
            case 'quota':
                return 'text-red-700 dark:text-red-300';
            default:
                return 'text-red-700 dark:text-red-300';
        }
    }, [category?.category]);

    const ErrorIcon = errorIcon;
    const retryable = category?.retryable ?? true;
    const retryDisabled = !retryable || rateLimitRemainingSec > 0;

    const handleCopyError = async () => {
        try {
            await navigator.clipboard.writeText(task.error ?? '');
            setCopiedError(true);
            window.setTimeout(() => setCopiedError(false), 1500);
        } catch (err) {
            console.warn('[task-card] clipboard.writeText failed', err);
        }
    };

    return (
        <div
            className={cn(
                'border-panel-divider bg-panel-ghost flex flex-col overflow-hidden rounded-xl border backdrop-blur-sm',
                className
            )}>
            <div className='border-panel-divider flex items-center justify-between gap-3 border-b px-3 py-2'>
                <div className='flex min-w-0 flex-1 items-center gap-2'>
                    {isQueued && <Spinner size='md' className='text-on-panel-faint' />}
                    {task.status === 'running' && <Spinner size='md' className='text-on-panel-muted' />}
                    {task.status === 'streaming' && <Spinner size='md' className='text-violet-400' />}
                    {isDone && <CheckCircle2 className='h-4 w-4 shrink-0 text-green-400' />}
                    {isError && <ErrorIcon className={cn('h-4 w-4 shrink-0', errorToneClasses)} />}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span
                                className='text-on-panel-muted truncate text-sm'
                                data-i18n-skip={task.prompt ? 'true' : undefined}>
                                {task.prompt || t('phase4b.emptyPrompt')}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className='max-w-xs' data-i18n-skip='true'>
                            {task.prompt}
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div className='flex shrink-0 items-center gap-2'>
                    {isQueued && (
                        <span className='text-on-panel-faint text-xs'>
                            <LocalizedMessage id='tasks.status.queued' />
                        </span>
                    )}
                    {(isQueued || isActive) && (
                        <Button
                            variant='ghost'
                            size='sm'
                            className='text-on-panel-faint hover:bg-accent hover:text-foreground h-6 px-2'
                            onClick={() => onCancel(task.id)}>
                            <LocalizedMessage id='tasks.cancel' />
                        </Button>
                    )}
                    {isError && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className='inline-flex'>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        className='text-on-panel-faint hover:bg-accent hover:text-foreground h-6 px-2'
                                        onClick={() => onRetry(task.id)}
                                        disabled={retryDisabled}>
                                        <RotateCcw className='mr-1 h-3 w-3' />
                                        {rateLimitRemainingSec > 0
                                            ? t('task.error.retryIn', { seconds: rateLimitRemainingSec.toString() })
                                            : t('phase4b.retry')}
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            {!retryable && <TooltipContent>{t('task.error.notRetryableTooltip')}</TooltipContent>}
                        </Tooltip>
                    )}
                </div>
            </div>

            <div className='px-3 py-3'>
                {isQueued && (
                    <div className='text-on-panel-faint flex items-center gap-2 text-sm'>
                        <Spinner size='md' />
                        <span>
                            <LocalizedMessage id='phase4b.queuedWaitingForAnAvailableSlot' />
                        </span>
                    </div>
                )}

                {isActive && (
                    <div className='space-y-2'>
                        <div className='flex items-center gap-2'>
                            <span className='text-on-panel-muted text-sm'>
                                {task.status === 'streaming'
                                    ? t('phase4b.streamingGeneration')
                                    : t('phase4b.processing')}
                            </span>
                            <ElapsedTimer startedAt={task.startedAt} completedAt={task.completedAt} etaMs={etaMs} />
                        </div>
                        {task.streamingPreviews.size > 0 && (
                            <div className='bg-panel-ghost relative flex aspect-video max-h-[200px] items-center justify-center overflow-hidden rounded-lg'>
                                {Array.from(task.streamingPreviews.entries()).map(([index, dataUrl]) => (
                                    <Image
                                        key={index}
                                        src={dataUrl}
                                        alt={t('phase4b.previewImageAlt', { index: index + 1 })}
                                        fill
                                        style={{ objectFit: 'contain' }}
                                        className='opacity-60'
                                        unoptimized
                                    />
                                ))}
                                <div className='absolute inset-0 flex items-center justify-center bg-black/30'>
                                    <div className='text-on-panel-muted flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5'>
                                        <Spinner size='md' />
                                        <span className='text-sm'>
                                            <LocalizedMessage id='phase4b.generatingImage' />
                                        </span>
                                        <ElapsedTimer
                                            startedAt={task.startedAt}
                                            completedAt={task.completedAt}
                                            etaMs={etaMs}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {isDone && task.result && (
                    <div className='space-y-3'>
                        <div className='flex items-center gap-2 text-sm'>
                            <span className='text-on-panel-faint'>
                                <LocalizedMessage id='phase4b.done' />
                            </span>
                            <span className='text-white/20'>·</span>
                            <span className='text-on-panel-faint'>
                                {task.result.historyEntry?.durationMs
                                    ? `${(task.result.historyEntry.durationMs / 1000).toFixed(1)}s`
                                    : `${(task.durationMs / 1000).toFixed(1)}s`}
                            </span>
                            {task.result.historyEntry?.costDetails && (
                                <>
                                    <span className='text-white/20'>·</span>
                                    <span className='text-on-panel-faint'>
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
                                    className='group border-panel-divider bg-panel-ghost relative aspect-square cursor-pointer overflow-hidden rounded-lg border'
                                    onClick={() => onImageClick?.(img.path)}>
                                    <Image
                                        src={img.path}
                                        alt={t('phase4b.resultImageAlt', { index: i + 1 })}
                                        fill
                                        style={{ objectFit: 'contain' }}
                                        unoptimized
                                    />
                                    <div className='absolute inset-0 flex items-end justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100'>
                                        <Button
                                            size='sm'
                                            variant='outline'
                                            className='bg-accent text-foreground mb-2 border-white/20 hover:bg-white/20'
                                            onClick={() => onSendToEdit(img.filename)}>
                                            <Send className='mr-1 h-3 w-3' />
                                            <LocalizedMessage id='assets.action.sendToEdit' />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isError && (
                    <div className='space-y-2'>
                        <div className={cn('inline-flex items-start gap-1.5 text-sm', errorToneClasses)}>
                            <ErrorIcon className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                            <span className='break-words'>{errorHintKey ? t(errorHintKey) : task.error}</span>
                        </div>
                        {errorHintKey && task.error && (
                            <button
                                type='button'
                                onClick={() => setRawExpanded((v) => !v)}
                                className='text-on-panel-faint hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded text-xs focus-visible:ring-1 focus-visible:outline-none'
                                aria-expanded={rawExpanded}>
                                {rawExpanded ? (
                                    <ChevronDown className='h-3 w-3' />
                                ) : (
                                    <ChevronRight className='h-3 w-3' />
                                )}
                                {rawExpanded ? t('task.error.hideRaw') : t('task.error.showRaw')}
                            </button>
                        )}
                        {rawExpanded && task.error && (
                            <pre
                                className='border-panel-divider bg-panel-ghost text-on-panel-muted max-h-32 overflow-auto rounded border px-2 py-1.5 text-[11px] leading-snug whitespace-pre-wrap'
                                data-i18n-skip='true'>
                                {task.error}
                            </pre>
                        )}
                        <div className='text-on-panel-faint flex items-center gap-2 text-xs'>
                            <span>{t('tasks.duration', { duration: formatTaskDuration(task.durationMs) })}</span>
                            <button
                                type='button'
                                onClick={handleCopyError}
                                className='hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded px-1 focus-visible:ring-1 focus-visible:outline-none'
                                aria-label={t('task.error.copy')}>
                                {copiedError ? <Check className='h-3 w-3' /> : <Copy className='h-3 w-3' />}
                                <span>{copiedError ? t('task.error.copied') : t('task.error.copy')}</span>
                            </button>
                        </div>
                    </div>
                )}

                {isCancelled && (
                    <p className='text-on-panel-faint text-sm'>
                        <LocalizedMessage id='phase4b.taskCancelled' />
                    </p>
                )}
            </div>
        </div>
    );
}
