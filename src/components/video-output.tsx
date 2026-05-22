'use client';

import * as React from 'react';
import {
    Clapperboard,
    Copy,
    Download,
    Film,
    Loader2,
    RotateCw,
    TriangleAlert,
    X
} from 'lucide-react';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVideoAssetSrc } from '@/hooks/useVideoAssetSrc';
import type { VideoTaskRecord } from '@/hooks/useVideoTaskManager';

type VideoOutputProps = {
    task: VideoTaskRecord | null;
    onCancel?: (jobId: string) => void;
    onDismiss?: (jobId: string) => void;
    onRetry?: (jobId: string) => void;
    onCopyPrompt?: (prompt: string) => void;
    onCopyDiagnostics?: (task: VideoTaskRecord) => void;
};

function statusKey(status: VideoTaskRecord['status']): string {
    switch (status) {
        case 'queued':
            return 'video.status.queued';
        case 'running':
            return 'video.status.running';
        case 'polling':
            return 'video.status.polling';
        case 'succeeded':
            return 'video.status.succeeded';
        case 'failed':
            return 'video.status.failed';
        case 'cancelled':
            return 'video.status.cancelled';
        case 'expired':
            return 'video.status.expired';
        default:
            return 'video.status.running';
    }
}

function formatElapsed(task: VideoTaskRecord, now: number, formatNumber: (value: number) => string): string {
    if (!task.startedAt) return formatNumber(0);
    const endTime = task.completedAt ?? now;
    return formatNumber(Math.max(0, Math.round((endTime - task.startedAt) / 1000)));
}

function VideoPlayer({ src, poster }: { src: string | undefined; poster?: string }) {
    if (!src) return null;
    return (
        <video
            src={src}
            poster={poster}
            controls
            playsInline
            preload='metadata'
            className='w-full max-h-[60vh] rounded-lg bg-black'
        />
    );
}

export function VideoOutput({ task, onCancel, onDismiss, onRetry, onCopyPrompt, onCopyDiagnostics }: VideoOutputProps) {
    const { t, formatNumber } = useAppLanguage();
    const [now, setNow] = React.useState<number>(Date.now());

    React.useEffect(() => {
        if (!task || task.completedAt) return;
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [task]);

    const completedVideo = task?.resultAssetRefs?.find((ref) => ref.kind === 'video');
    const completedPoster = task?.resultAssetRefs?.find((ref) => ref.kind === 'thumbnail');
    const videoSrc = useVideoAssetSrc(completedVideo) ?? task?.resultRemoteUrl;
    const posterSrc = useVideoAssetSrc(completedPoster) ?? task?.thumbnailRemoteUrl;

    if (!task) {
        return (
            <div
                className='app-panel-card flex h-full min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border p-6 text-center'
                data-testid='video-output-empty'>
                <Film aria-hidden='true' className='text-muted-foreground mb-3 h-10 w-10' />
                <p className='text-muted-foreground text-sm'>{t('video.output.placeholder')}</p>
            </div>
        );
    }

    const inProgress = task.status === 'queued' || task.status === 'running' || task.status === 'polling';
    const showCancel = inProgress && onCancel;
    const showDismiss = !inProgress && onDismiss;
    const showRetry = (task.status === 'failed' || task.status === 'expired') && onRetry;
    const elapsedSeconds = formatElapsed(task, now, formatNumber);
    const progressPercent =
        typeof task.progress === 'number' && Number.isFinite(task.progress)
            ? Math.round(Math.max(0, Math.min(1, task.progress)) * 100)
            : null;

    return (
        <section
            className='app-panel-card flex h-full min-h-[300px] w-full flex-col overflow-hidden rounded-2xl border backdrop-blur-xl'
            data-testid='video-output'>
            <header className='flex items-start justify-between gap-3 border-b border-[color:var(--app-panel-divider)] p-4'>
                <div className='flex min-w-0 items-start gap-2'>
                    <Clapperboard
                        aria-hidden='true'
                        className='mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-text-on-panel-faint)]'
                    />
                    <div className='min-w-0'>
                        <div className='text-foreground flex items-center gap-2 text-sm font-medium'>
                            <span>{t(statusKey(task.status))}</span>
                            {inProgress && progressPercent !== null && (
                                <span className='text-muted-foreground text-xs'>
                                    {t('video.output.progress', { percent: progressPercent })}
                                </span>
                            )}
                            {inProgress && progressPercent === null && (
                                <span className='text-muted-foreground text-xs'>
                                    {t('video.output.elapsed', { seconds: elapsedSeconds })}
                                </span>
                            )}
                        </div>
                        <p className='text-muted-foreground mt-1 line-clamp-2 max-w-full break-words text-xs'>
                            {task.prompt}
                        </p>
                    </div>
                </div>
                <div className='flex shrink-0 items-center gap-1'>
                    {showCancel && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    aria-label={t('video.output.cancel')}
                                    onClick={() => onCancel?.(task.jobId)}>
                                    <X className='h-4 w-4' />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('video.output.cancel')}</TooltipContent>
                        </Tooltip>
                    )}
                    {showDismiss && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='icon'
                                    aria-label={t('common.cancel')}
                                    onClick={() => onDismiss?.(task.jobId)}>
                                    <X className='h-4 w-4' />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('common.cancel')}</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </header>

            <div className='flex flex-1 min-h-0 flex-col gap-3 p-4'>
                {inProgress && (
                    <div className='flex flex-1 items-center justify-center'>
                        <Loader2 aria-hidden='true' className='text-muted-foreground h-10 w-10 animate-spin' />
                    </div>
                )}

                {task.status === 'succeeded' && (
                    <div className='space-y-3'>
                        <VideoPlayer src={videoSrc} poster={posterSrc} />
                        {task.resultRemoteUrlExpiresAt && task.resultRemoteUrlExpiresAt < Date.now() + 60 * 60 * 1000 && (
                            <p className='flex items-center gap-2 rounded-md border border-[color:var(--app-panel-divider)] bg-[color:var(--app-panel-subtle)] px-3 py-2 text-xs text-[color:var(--app-text-on-panel-muted)]'>
                                <TriangleAlert aria-hidden='true' className='h-3.5 w-3.5 shrink-0' />
                                <span>{t('video.output.expiringSoon')}</span>
                            </p>
                        )}
                    </div>
                )}

                {task.status === 'failed' && (
                    <div className='space-y-3'>
                        <div className='flex items-start gap-2 rounded-md border border-[color:var(--app-panel-divider)] bg-[color:var(--app-panel-subtle)] p-3'>
                            <TriangleAlert
                                aria-hidden='true'
                                className='mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400'
                            />
                            <div className='min-w-0 flex-1'>
                                <p className='text-foreground text-sm font-medium'>
                                    {task.errorCode ?? t('video.status.failed')}
                                </p>
                                {task.errorMessage && (
                                    <p className='text-muted-foreground mt-1 break-words text-xs'>
                                        {task.errorMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {task.status === 'expired' && (
                    <p className='text-muted-foreground text-sm'>{t('video.output.expired')}</p>
                )}

                {task.status === 'cancelled' && (
                    <p className='text-muted-foreground text-sm'>{t('video.status.cancelled')}</p>
                )}
            </div>

            <footer className='flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--app-panel-divider)] p-3'>
                {onCopyPrompt && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => onCopyPrompt(task.prompt)}>
                                <Copy className='mr-1 h-3.5 w-3.5' />
                                {t('video.output.copyPrompt')}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('video.output.copyPrompt')}</TooltipContent>
                    </Tooltip>
                )}
                {task.status === 'failed' && onCopyDiagnostics && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => onCopyDiagnostics(task)}>
                                {t('video.output.copyDiagnostics')}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('video.output.copyDiagnostics')}</TooltipContent>
                    </Tooltip>
                )}
                {task.status === 'succeeded' && videoSrc && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <a
                                href={videoSrc}
                                download
                                className='border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium shadow-xs transition-colors'>
                                <Download className='mr-1 h-3.5 w-3.5' />
                                {t('video.output.download')}
                            </a>
                        </TooltipTrigger>
                        <TooltipContent>{t('video.output.download')}</TooltipContent>
                    </Tooltip>
                )}
                {showRetry && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type='button'
                                variant='default'
                                size='sm'
                                onClick={() => onRetry?.(task.jobId)}>
                                <RotateCw className='mr-1 h-3.5 w-3.5' />
                                {t('video.output.retry')}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('video.output.retry')}</TooltipContent>
                    </Tooltip>
                )}
            </footer>
        </section>
    );
}

export default VideoOutput;
