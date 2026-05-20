'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/textarea';
import { WorkbenchCard } from '@/components/ui/workbench-card';
import type { BatchPlan, BatchPlanItem } from '@/lib/batch-plan-core';
import { cn } from '@/lib/utils';
import {
    ArrowDown,
    ArrowUp,
    Check,
    Clipboard,
    Layers3,
    Loader2,
    RefreshCw,
    Trash2,
    X
} from 'lucide-react';
import * as React from 'react';

type BatchPlanOutputProps = {
    plan: BatchPlan | null;
    isLoading: boolean;
    error?: string | null;
    onPlanChange: (plan: BatchPlan) => void;
    onRegenerate: (instruction: string) => void | Promise<void>;
    onConfirm: () => void;
    onDismiss: () => void;
    confirmDisabled?: boolean;
};

function updateTasks(plan: BatchPlan, updater: (tasks: BatchPlanItem[]) => BatchPlanItem[]): BatchPlan {
    return {
        ...plan,
        tasks: updater(plan.tasks).map((task, index) => ({ ...task, order: index + 1 }))
    };
}

export function BatchPlanOutput({
    plan,
    isLoading,
    error,
    onPlanChange,
    onRegenerate,
    onConfirm,
    onDismiss,
    confirmDisabled = false
}: BatchPlanOutputProps) {
    const { t } = useAppLanguage();
    const [adjustment, setAdjustment] = React.useState('');
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const enabledCount = plan?.tasks.filter((task) => task.enabled && task.prompt.trim()).length ?? 0;

    const handleTaskChange = React.useCallback(
        (taskId: string, patch: Partial<BatchPlanItem>) => {
            if (!plan) return;
            onPlanChange(
                updateTasks(plan, (tasks) =>
                    tasks.map((task) =>
                        task.id === taskId
                            ? {
                                  ...task,
                                  ...patch,
                                  lockedByUser: patch.prompt !== undefined ? true : (patch.lockedByUser ?? task.lockedByUser)
                              }
                            : task
                    )
                )
            );
        },
        [onPlanChange, plan]
    );

    const handleMove = React.useCallback(
        (taskId: string, direction: -1 | 1) => {
            if (!plan) return;
            const index = plan.tasks.findIndex((task) => task.id === taskId);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= plan.tasks.length) return;
            onPlanChange(
                updateTasks(plan, (tasks) => {
                    const next = [...tasks];
                    [next[index], next[target]] = [next[target], next[index]];
                    return next;
                })
            );
        },
        [onPlanChange, plan]
    );

    const handleDelete = React.useCallback(
        (taskId: string) => {
            if (!plan) return;
            onPlanChange(updateTasks(plan, (tasks) => tasks.filter((task) => task.id !== taskId)));
        },
        [onPlanChange, plan]
    );

    const handleCopy = React.useCallback(async (task: BatchPlanItem) => {
        try {
            await navigator.clipboard.writeText(task.prompt);
            setCopiedId(task.id);
            window.setTimeout(() => setCopiedId(null), 1200);
        } catch (copyError) {
            console.warn('[batch-plan-output] clipboard.writeText failed', copyError);
        }
    }, []);

    if (!plan && isLoading) {
        return (
            <WorkbenchCard className='min-h-[300px]'>
                <div className='flex min-h-[300px] flex-1 flex-col items-center justify-center gap-3 p-6 text-muted-foreground'>
                    <Loader2 className='h-6 w-6 animate-spin' aria-hidden='true' />
                    <p className='text-sm'>{t('batch.loading')}</p>
                </div>
            </WorkbenchCard>
        );
    }

    if (!plan) {
        return (
            <WorkbenchCard className='min-h-[300px]'>
                <EmptyState
                    icon={<Layers3 />}
                    title={t('batch.emptyTitle')}
                    description={error || t('batch.emptyDescription')}
                    className='min-h-[300px]'
                />
            </WorkbenchCard>
        );
    }

    return (
        <WorkbenchCard className='min-h-[300px]'>
            <div className='flex min-h-0 flex-1 flex-col overflow-hidden p-4'>
                <div className='mb-3 flex shrink-0 items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <div className='flex min-w-0 items-center gap-2'>
                            <Layers3 className='h-4 w-4 shrink-0 text-violet-600 dark:text-violet-200/80' />
                            <h2 className='truncate text-sm font-medium text-foreground/85'>{t('batch.previewTitle')}</h2>
                        </div>
                        <p className='mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground' data-i18n-skip='true'>
                            {plan.summary}
                        </p>
                    </div>
                    <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={onDismiss}
                        className='h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground'
                        aria-label={t('batch.dismiss')}>
                        <X className='h-4 w-4' />
                    </Button>
                </div>

                <div className='mb-3 grid shrink-0 gap-2 text-xs sm:grid-cols-3'>
                    <div className='rounded-lg border border-border bg-muted/30 px-3 py-2'>
                        <p className='text-muted-foreground'>{t('batch.intent')}</p>
                        <p className='mt-1 truncate font-medium text-foreground' data-i18n-skip='true'>
                            {plan.resolvedIntent}
                        </p>
                    </div>
                    <div className='rounded-lg border border-border bg-muted/30 px-3 py-2'>
                        <p className='text-muted-foreground'>{t('batch.count')}</p>
                        <p className='mt-1 font-medium text-foreground'>{enabledCount} / {plan.tasks.length}</p>
                    </div>
                    <div className='rounded-lg border border-border bg-muted/30 px-3 py-2'>
                        <p className='text-muted-foreground'>{t('batch.sourceImages')}</p>
                        <p className='mt-1 font-medium text-foreground'>{plan.sourceImageCount}</p>
                    </div>
                </div>

                {plan.strategyReason && (
                    <p className='mb-3 shrink-0 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground dark:bg-panel-ghost'>
                        {plan.strategyReason}
                    </p>
                )}

                {error && (
                    <p className='mb-3 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100/90'>
                        {error}
                    </p>
                )}

                <div className='mb-3 shrink-0 space-y-2 rounded-xl border border-border bg-background/70 p-3 dark:bg-panel-ghost'>
                    <Textarea
                        value={adjustment}
                        onChange={(event) => setAdjustment(event.target.value)}
                        placeholder={t('batch.adjustPlaceholder')}
                        className='min-h-16 rounded-lg border-border bg-card text-sm'
                    />
                    <div className='flex justify-end'>
                        <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => void onRegenerate(adjustment)}
                            disabled={isLoading}
                            className='rounded-lg'>
                            {isLoading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <RefreshCw className='mr-2 h-4 w-4' />}
                            {t('batch.regenerate')}
                        </Button>
                    </div>
                </div>

                <div className='min-h-0 flex-1 space-y-3 overflow-y-auto pr-1'>
                    {plan.tasks.map((task, index) => (
                        <div
                            key={task.id}
                            className={cn(
                                'rounded-xl border bg-background/80 p-3 transition-colors dark:bg-panel-ghost',
                                task.enabled ? 'border-border' : 'border-border opacity-60'
                            )}>
                            <div className='mb-2 flex items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <div className='flex min-w-0 items-center gap-2'>
                                        <span className='inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground'>
                                            {index + 1}
                                        </span>
                                        <input
                                            value={task.title || ''}
                                            onChange={(event) => handleTaskChange(task.id, { title: event.target.value })}
                                            placeholder={t('batch.itemTitlePlaceholder')}
                                            className='min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground'
                                            data-i18n-skip='true'
                                        />
                                    </div>
                                    <p className='mt-1 line-clamp-1 text-xs text-muted-foreground' data-i18n-skip='true'>
                                        {task.variationAxis || task.sourceExcerpt}
                                    </p>
                                </div>
                                <div className='flex shrink-0 items-center gap-1'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='icon'
                                        disabled={index === 0}
                                        onClick={() => handleMove(task.id, -1)}
                                        className='h-7 w-7 rounded-md'>
                                        <ArrowUp className='h-3.5 w-3.5' />
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='icon'
                                        disabled={index === plan.tasks.length - 1}
                                        onClick={() => handleMove(task.id, 1)}
                                        className='h-7 w-7 rounded-md'>
                                        <ArrowDown className='h-3.5 w-3.5' />
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='icon'
                                        onClick={() => handleDelete(task.id)}
                                        className='h-7 w-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive'>
                                        <Trash2 className='h-3.5 w-3.5' />
                                    </Button>
                                </div>
                            </div>

                            <Textarea
                                value={task.prompt}
                                onChange={(event) => handleTaskChange(task.id, { prompt: event.target.value })}
                                className='min-h-24 rounded-lg border-border bg-card text-sm leading-5'
                                data-i18n-skip='true'
                            />
                            <div className='mt-2 flex flex-wrap items-center justify-between gap-2 text-xs'>
                                <div className='flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground'>
                                    <span className='rounded-md border border-border px-1.5 py-0.5'>
                                        {task.sourceImagePolicy === 'inherit-all' ? t('batch.inheritsImages') : t('batch.noImages')}
                                    </span>
                                    {task.lockedByUser && (
                                        <span className='rounded-md border border-amber-300/50 bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-200'>
                                            {t('batch.userEdited')}
                                        </span>
                                    )}
                                </div>
                                <div className='flex shrink-0 items-center gap-1'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => handleTaskChange(task.id, { enabled: !task.enabled })}
                                        className='h-7 rounded-md px-2 text-xs'>
                                        {task.enabled ? t('batch.disable') : t('batch.enable')}
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => void handleCopy(task)}
                                        className='h-7 rounded-md px-2 text-xs'>
                                        {copiedId === task.id ? <Check className='mr-1 h-3.5 w-3.5' /> : <Clipboard className='mr-1 h-3.5 w-3.5' />}
                                        {copiedId === task.id ? t('task.error.copied') : t('batch.copyPrompt')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className='flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2'>
                <span className='text-xs text-muted-foreground'>
                    {t('batch.confirmHint', { count: enabledCount })}
                </span>
                <Button
                    type='button'
                    onClick={onConfirm}
                    disabled={enabledCount === 0 || isLoading || confirmDisabled}
                    className='rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-white shadow-violet-600/20 hover:brightness-110 disabled:pointer-events-none disabled:opacity-30'>
                    {t('batch.confirm', { count: enabledCount })}
                </Button>
            </div>
        </WorkbenchCard>
    );
}
