'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    clearBatchPlanDraft,
    loadBatchPlanDraft,
    saveBatchPlanDraft,
    type BatchPlanDraft
} from '@/lib/batch-plan-draft';
import {
    DEFAULT_BATCH_PLAN_MAX_COUNT,
    MAX_BATCH_PLAN_COUNT,
    MIN_BATCH_PLAN_COUNT,
    type BatchCountMode,
    type BatchPlanningMode
} from '@/lib/batch-plan-core';
import { cn } from '@/lib/utils';
import { Layers3, RotateCcw, Sparkles, X } from 'lucide-react';
import * as React from 'react';

type BatchPlanningDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentPrompt: string;
    currentSourceImageCount: number;
    currentSourceImageNames: string[];
    isPlanning: boolean;
    onPlan: (params: {
        planningMode: BatchPlanningMode;
        countMode: BatchCountMode;
        targetCount?: number;
        maxCount: number;
        adjustmentInstruction: string;
    }) => Promise<void>;
    onRecoverPrompt: (prompt: string) => void;
};

function readPreviewCount(draft: BatchPlanDraft | null): number {
    return draft?.preview?.tasks.length ?? 0;
}

function buildDefaultDraft(
    currentPrompt: string,
    currentSourceImageCount: number,
    currentSourceImageNames: string[]
): BatchPlanDraft {
    return {
        sourceText: currentPrompt.trim(),
        sourceImageCount: currentSourceImageCount,
        sourceImageNames: currentSourceImageNames.slice(0, 12),
        planningMode: 'auto',
        countMode: 'auto',
        maxCount: DEFAULT_BATCH_PLAN_MAX_COUNT,
        adjustmentInstruction: '',
        updatedAt: Date.now()
    };
}

function clampCount(value: string, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(MIN_BATCH_PLAN_COUNT, Math.min(MAX_BATCH_PLAN_COUNT, Math.round(parsed)));
}

export function BatchPlanningDialog({
    open,
    onOpenChange,
    currentPrompt,
    currentSourceImageCount,
    currentSourceImageNames,
    isPlanning,
    onPlan,
    onRecoverPrompt
}: BatchPlanningDialogProps) {
    const { t } = useAppLanguage();
    const [draft, setDraft] = React.useState<BatchPlanDraft>(() =>
        buildDefaultDraft(currentPrompt, currentSourceImageCount, currentSourceImageNames)
    );
    const [planningMode, setPlanningMode] = React.useState<BatchPlanningMode>('auto');
    const [countMode, setCountMode] = React.useState<BatchCountMode>('auto');
    const [targetCount, setTargetCount] = React.useState(String(6));
    const [maxCount, setMaxCount] = React.useState(String(DEFAULT_BATCH_PLAN_MAX_COUNT));
    const [adjustmentInstruction, setAdjustmentInstruction] = React.useState('');
    const [localError, setLocalError] = React.useState<string | null>(null);
    const sourceText = currentPrompt.trim();
    const canSubmit = Boolean(sourceText) && !isPlanning && (countMode === 'auto' || targetCount.trim().length > 0);

    const syncStateFromDraft = React.useCallback(
        (nextDraft: BatchPlanDraft | null) => {
            const sourceDraft = nextDraft ?? buildDefaultDraft(currentPrompt, currentSourceImageCount, currentSourceImageNames);
            setDraft(sourceDraft);
            setPlanningMode(sourceDraft.planningMode);
            setCountMode(sourceDraft.countMode);
            setTargetCount(
                typeof sourceDraft.targetCount === 'number' ? String(sourceDraft.targetCount) : String(6)
            );
            setMaxCount(String(sourceDraft.maxCount || DEFAULT_BATCH_PLAN_MAX_COUNT));
            setAdjustmentInstruction(sourceDraft.adjustmentInstruction);
        },
        [currentPrompt, currentSourceImageCount, currentSourceImageNames]
    );

    React.useEffect(() => {
        if (!open) return;
        const stored = loadBatchPlanDraft();
        syncStateFromDraft(stored);
        setLocalError(null);
    }, [open, syncStateFromDraft]);

    const persistDraft = React.useCallback(
        (patch?: Partial<BatchPlanDraft>) => {
            const stored = loadBatchPlanDraft();
            const nextPlanningMode = patch?.planningMode ?? planningMode;
            const nextCountMode = patch?.countMode ?? countMode;
            const hasTargetCountPatch = patch ? Object.prototype.hasOwnProperty.call(patch, 'targetCount') : false;
            const nextTargetCount =
                hasTargetCountPatch
                    ? patch?.targetCount
                    : nextCountMode === 'fixed' && targetCount.trim()
                      ? clampCount(targetCount, 6)
                      : undefined;
            const nextMaxCount = patch?.maxCount ?? clampCount(maxCount, DEFAULT_BATCH_PLAN_MAX_COUNT);
            const nextAdjustmentInstruction = patch?.adjustmentInstruction ?? adjustmentInstruction.trim();
            const nextDraft: BatchPlanDraft = {
                ...(stored ?? draft),
                sourceText,
                sourceImageCount: currentSourceImageCount,
                sourceImageNames: currentSourceImageNames.slice(0, 12),
                planningMode: nextPlanningMode,
                countMode: nextCountMode,
                ...(nextTargetCount !== undefined ? { targetCount: nextTargetCount } : {}),
                maxCount: nextMaxCount,
                adjustmentInstruction: nextAdjustmentInstruction,
                updatedAt: Date.now(),
                ...(patch ?? {})
            } as BatchPlanDraft;
            saveBatchPlanDraft(nextDraft);
            setDraft(nextDraft);
        },
        [
            adjustmentInstruction,
            countMode,
            currentSourceImageCount,
            currentSourceImageNames,
            draft,
            maxCount,
            planningMode,
            sourceText,
            targetCount
        ]
    );

    const handleRecoverDraft = React.useCallback(() => {
        const stored = loadBatchPlanDraft();
        if (!stored) return;
        syncStateFromDraft(stored);
        onRecoverPrompt(stored.sourceText);
    }, [onRecoverPrompt, syncStateFromDraft]);

    const handleDiscardDraft = React.useCallback(() => {
        clearBatchPlanDraft();
        syncStateFromDraft(null);
        setLocalError(null);
    }, [syncStateFromDraft]);

    const handleSubmit = React.useCallback(async () => {
        if (!canSubmit) return;
        setLocalError(null);

        const resolvedCountMode = countMode;
        const resolvedTargetCount =
            resolvedCountMode === 'fixed'
                ? clampCount(targetCount, 6)
                : undefined;
        const resolvedMaxCount = clampCount(maxCount, DEFAULT_BATCH_PLAN_MAX_COUNT);

        persistDraft({
            sourceText,
            sourceImageCount: currentSourceImageCount,
            sourceImageNames: currentSourceImageNames.slice(0, 12),
            planningMode,
            countMode: resolvedCountMode,
            ...(resolvedTargetCount !== undefined ? { targetCount: resolvedTargetCount } : {}),
            maxCount: resolvedMaxCount,
            adjustmentInstruction: adjustmentInstruction.trim(),
            updatedAt: Date.now()
        });

        try {
            await onPlan({
                planningMode,
                countMode: resolvedCountMode,
                ...(resolvedTargetCount !== undefined ? { targetCount: resolvedTargetCount } : {}),
                maxCount: resolvedMaxCount,
                adjustmentInstruction: adjustmentInstruction.trim()
            });
            onOpenChange(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('batch.dialog.submitError');
            setLocalError(message);
        }
    }, [
        adjustmentInstruction,
        canSubmit,
        countMode,
        currentSourceImageCount,
        currentSourceImageNames,
        maxCount,
        onOpenChange,
        onPlan,
        persistDraft,
        planningMode,
        sourceText,
        targetCount,
        t
    ]);

    const recoverableDraft = loadBatchPlanDraft();
    const enabledPreviewCount = readPreviewCount(recoverableDraft);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='border-border bg-background text-foreground top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden overscroll-contain rounded-none p-0 shadow-xl sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(860px,calc(100vw-2rem))] sm:max-w-[860px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl'>
                <div className='flex min-h-0 flex-1 flex-col'>
                    <DialogHeader className='border-border border-b px-4 py-4 sm:px-5'>
                        <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                                <DialogTitle className='flex items-center gap-2 text-lg'>
                                    <Layers3 className='h-5 w-5 text-violet-500 dark:text-violet-200/80' />
                                    {t('batch.dialog.title')}
                                </DialogTitle>
                                <DialogDescription className='mt-1 text-sm leading-6 text-muted-foreground'>
                                    {t('batch.dialog.description')}
                                </DialogDescription>
                            </div>
                            <Button
                                type='button'
                                variant='ghost'
                                size='icon'
                                onClick={() => onOpenChange(false)}
                                className='h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground'
                                aria-label={t('common.cancel')}>
                                <X className='h-4 w-4' />
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5'>
                        {recoverableDraft && (
                            <div className='mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm'>
                                <span className='flex min-w-0 items-center gap-2 text-muted-foreground'>
                                    <RotateCcw className='h-4 w-4 shrink-0' />
                                    <span className='truncate'>{t('batch.draft.banner', { count: enabledPreviewCount })}</span>
                                </span>
                                <div className='flex shrink-0 items-center gap-2'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleRecoverDraft}
                                        className='h-7 rounded-md px-2 text-xs'>
                                        {t('batch.draft.recover')}
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleDiscardDraft}
                                        className='h-7 rounded-md px-2 text-xs text-muted-foreground'>
                                        {t('batch.draft.discard')}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]'>
                            <div className='space-y-4'>
                                <div className='rounded-xl border border-border bg-card p-3'>
                                    <div className='flex items-center justify-between gap-2'>
                                        <Label className='text-sm font-medium text-foreground'>{t('batch.dialog.sourceTitle')}</Label>
                                        <span className='text-xs text-muted-foreground'>
                                            {t('batch.dialog.sourceCount', { count: currentSourceImageCount })}
                                        </span>
                                    </div>
                                    <p className='mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground' data-i18n-skip='true'>
                                        {sourceText || t('batch.dialog.emptySource')}
                                    </p>
                                    {currentSourceImageCount > 0 && (
                                        <p className='mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground' data-i18n-skip='true'>
                                            {currentSourceImageNames.length > 0
                                                ? currentSourceImageNames.join(' · ')
                                                : t('batch.dialog.sourceImagesAttached', { count: currentSourceImageCount })}
                                        </p>
                                    )}
                                </div>

                                <div className='grid gap-4 sm:grid-cols-2'>
                                    <div className='space-y-1.5'>
                                        <Label className='text-foreground'>{t('batch.dialog.planningMode')}</Label>
                                        <Select
                                            value={planningMode}
                                            onValueChange={(value) => {
                                                const next = value as BatchPlanningMode;
                                                setPlanningMode(next);
                                                persistDraft({
                                                    planningMode: next,
                                                    updatedAt: Date.now()
                                                });
                                            }}>
                                            <SelectTrigger className='h-10 rounded-xl border-border bg-background text-foreground'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='auto'>{t('batch.dialog.mode.auto')}</SelectItem>
                                                <SelectItem value='content-split'>{t('batch.dialog.mode.contentSplit')}</SelectItem>
                                                <SelectItem value='variant-exploration'>{t('batch.dialog.mode.variantExploration')}</SelectItem>
                                                <SelectItem value='reference-variant'>{t('batch.dialog.mode.referenceVariant')}</SelectItem>
                                                <SelectItem value='mixed'>{t('batch.dialog.mode.mixed')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className='space-y-1.5'>
                                        <Label className='text-foreground'>{t('batch.dialog.countMode')}</Label>
                                        <RadioGroup
                                            value={countMode}
                                            onValueChange={(value) => {
                                                const next = value as BatchCountMode;
                                                setCountMode(next);
                                                persistDraft({
                                                    countMode: next,
                                                    updatedAt: Date.now()
                                                });
                                            }}
                                            className='grid grid-cols-2 gap-2'>
                                            <label className={cn('flex items-center gap-2 rounded-xl border border-border px-3 py-2', countMode === 'auto' && 'border-violet-500/50 bg-violet-500/10')}>
                                                <RadioGroupItem value='auto' />
                                                <span className='text-sm text-foreground'>{t('batch.dialog.countAuto')}</span>
                                            </label>
                                            <label className={cn('flex items-center gap-2 rounded-xl border border-border px-3 py-2', countMode === 'fixed' && 'border-violet-500/50 bg-violet-500/10')}>
                                                <RadioGroupItem value='fixed' />
                                                <span className='text-sm text-foreground'>{t('batch.dialog.countFixed')}</span>
                                            </label>
                                        </RadioGroup>
                                    </div>
                                </div>

                                <div className='grid gap-4 sm:grid-cols-2'>
                                    <div className='space-y-1.5'>
                                        <Label htmlFor='batch-target-count' className='text-foreground'>
                                            {t('batch.dialog.targetCount')}
                                        </Label>
                                        <Input
                                            id='batch-target-count'
                                            type='number'
                                            min={MIN_BATCH_PLAN_COUNT}
                                            max={MAX_BATCH_PLAN_COUNT}
                                            value={targetCount}
                                            onChange={(event) => {
                                                const next = event.target.value;
                                                setTargetCount(next);
                                                persistDraft({
                                                    targetCount: next.trim() ? clampCount(next, 6) : undefined,
                                                    updatedAt: Date.now()
                                                });
                                            }}
                                            disabled={countMode !== 'fixed'}
                                            className='h-10 rounded-xl border-border bg-background text-foreground'
                                        />
                                    </div>

                                    <div className='space-y-1.5'>
                                        <Label htmlFor='batch-max-count' className='text-foreground'>
                                            {t('batch.dialog.maxCount')}
                                        </Label>
                                        <Input
                                            id='batch-max-count'
                                            type='number'
                                            min={MIN_BATCH_PLAN_COUNT}
                                            max={MAX_BATCH_PLAN_COUNT}
                                            value={maxCount}
                                            onChange={(event) => {
                                                const next = event.target.value;
                                                setMaxCount(next);
                                                persistDraft({
                                                    maxCount: clampCount(next, DEFAULT_BATCH_PLAN_MAX_COUNT),
                                                    updatedAt: Date.now()
                                                });
                                            }}
                                            className='h-10 rounded-xl border-border bg-background text-foreground'
                                        />
                                    </div>
                                </div>

                                <div className='space-y-1.5'>
                                    <div className='flex items-center justify-between gap-2'>
                                        <Label htmlFor='batch-adjustment' className='text-foreground'>
                                            {t('batch.dialog.adjustment')}
                                        </Label>
                                        <span className='text-xs text-muted-foreground'>
                                            {t('batch.dialog.adjustmentHint')}
                                        </span>
                                    </div>
                                    <Textarea
                                        id='batch-adjustment'
                                        value={adjustmentInstruction}
                                        onChange={(event) => {
                                            const next = event.target.value;
                                            setAdjustmentInstruction(next);
                                            persistDraft({
                                                adjustmentInstruction: next,
                                                updatedAt: Date.now()
                                            });
                                        }}
                                        placeholder={t('batch.dialog.adjustmentPlaceholder')}
                                        className='min-h-36 rounded-xl border-border bg-background text-sm text-foreground'
                                    />
                                </div>
                            </div>

                            <div className='space-y-3 rounded-xl border border-border bg-muted/20 p-3'>
                                <div className='flex items-center gap-2'>
                                    <Sparkles className='h-4 w-4 text-violet-500 dark:text-violet-200/80' />
                                    <h3 className='text-sm font-medium text-foreground'>{t('batch.dialog.tipsTitle')}</h3>
                                </div>
                                <ul className='space-y-2 text-xs leading-5 text-muted-foreground'>
                                    <li>{t('batch.dialog.tipAuto')}</li>
                                    <li>{t('batch.dialog.tipFixed')}</li>
                                    <li>{t('batch.dialog.tipReference')}</li>
                                    <li>{t('batch.dialog.tipAdjust')}</li>
                                </ul>
                            </div>
                        </div>

                        {localError && (
                            <p className='mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100'>
                                {localError}
                            </p>
                        )}
                    </div>

                    <DialogFooter className='border-border border-t px-4 py-4 sm:px-5'>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => onOpenChange(false)}
                            className='rounded-xl'>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type='button'
                            onClick={() => void handleSubmit()}
                            disabled={!canSubmit}
                            className='rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:brightness-110 disabled:pointer-events-none disabled:opacity-40'>
                            {isPlanning ? t('batch.dialog.generating') : t('batch.dialog.generate')}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
