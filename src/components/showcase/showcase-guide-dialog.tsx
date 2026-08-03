'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ShowcaseCase, ShowcaseTopic } from '@/lib/showcase';
import {
    buildShowcaseRecipePrompt,
    localizeShowcaseText,
    type ShowcaseModelCompatibility,
    type ShowcaseModelCompatibilityReason,
    type ShowcasePromptApplyMode
} from '@/lib/showcase-recipe';
import { AlertTriangle, ArrowRight, Check, ImagePlus, Sparkles } from 'lucide-react';
import * as React from 'react';

export type ShowcaseGuideSubmission = {
    files: File[];
    imageMode: 'replace' | 'append';
    prompt: string;
    promptMode: ShowcasePromptApplyMode;
};

const COMPATIBILITY_REASON_KEYS: Record<ShowcaseModelCompatibilityReason, string> = {
    'task-mode': 'showcase.guide.compatibility.reason.taskMode',
    editing: 'showcase.guide.compatibility.reason.editing',
    mask: 'showcase.guide.compatibility.reason.mask',
    'custom-size': 'showcase.guide.compatibility.reason.customSize',
    'reference-images': 'showcase.guide.compatibility.reason.referenceImages'
};

type ShowcaseGuideDialogProps = {
    open: boolean;
    topic: ShowcaseTopic | null;
    showcaseCase: ShowcaseCase | null;
    currentPrompt: string;
    currentSourceImageCount: number;
    compatibility: ShowcaseModelCompatibility | null;
    modelLabel: string;
    recommendedModelLabels?: string[];
    onOpenChange: (open: boolean) => void;
    onOpenModelSettings: () => void;
    onConfirm: (submission: ShowcaseGuideSubmission) => void;
};

function ChoiceButton({
    active,
    label,
    description,
    onClick
}: {
    active: boolean;
    label: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`min-w-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                active
                    ? 'border-primary/50 bg-primary/10 text-foreground ring-primary/20 ring-2'
                    : 'border-border bg-panel-ghost text-muted-foreground hover:bg-panel-subtle'
            }`}>
            <span className='flex items-center gap-2 text-sm font-medium'>
                {active && <Check className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />}
                {label}
            </span>
            <span className='mt-1 block text-xs leading-5'>{description}</span>
        </button>
    );
}

export function ShowcaseGuideDialog({
    open,
    topic,
    showcaseCase,
    currentPrompt,
    currentSourceImageCount,
    compatibility,
    modelLabel,
    recommendedModelLabels = [],
    onOpenChange,
    onOpenModelSettings,
    onConfirm
}: ShowcaseGuideDialogProps) {
    const { language, t } = useAppLanguage();
    const [filesBySlot, setFilesBySlot] = React.useState<Record<string, File[]>>({});
    const [userInstruction, setUserInstruction] = React.useState('');
    const [promptMode, setPromptMode] = React.useState<ShowcasePromptApplyMode>('replace');
    const [imageMode, setImageMode] = React.useState<'replace' | 'append'>('replace');

    React.useEffect(() => {
        if (!open || !showcaseCase) return;
        setFilesBySlot({});
        setUserInstruction('');
        setPromptMode(currentPrompt.trim() ? showcaseCase.recipe.promptStrategy : 'replace');
        setImageMode('replace');
    }, [currentPrompt, open, showcaseCase]);

    if (!topic || !showcaseCase) return null;

    const recipe = showcaseCase.recipe;
    const orderedSlots = [...recipe.inputSlots].sort((left, right) => left.workbenchOrder - right.workbenchOrder);
    const orderedFiles = orderedSlots.flatMap((slot) => filesBySlot[slot.id] ?? []);
    const missingSlots = orderedSlots.filter((slot) => (filesBySlot[slot.id]?.length ?? 0) < slot.minCount);
    const prompt = buildShowcaseRecipePrompt(recipe, language, userInstruction);
    const canConfirm = missingSlots.length === 0 && compatibility?.compatible !== false;
    const compatibilityReasons = compatibility?.reasons.map((reason) => t(COMPATIBILITY_REASON_KEYS[reason])) ?? [];
    const listSeparator = language === 'zh-CN' ? '、' : ', ';
    const compatibilitySuggestion = recommendedModelLabels.length
        ? t('showcase.guide.compatibility.recommendations', { models: recommendedModelLabels.join(listSeparator) })
        : t('showcase.guide.compatibility.configureModel');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='app-panel-card gap-0 overflow-hidden p-0 sm:max-w-3xl'>
                <DialogHeader className='border-panel-divider border-b px-5 py-4 pr-14'>
                    <div className='text-primary mb-2 flex items-center gap-2 text-xs font-medium'>
                        <Sparkles className='h-3.5 w-3.5' />
                        {localizeShowcaseText(topic.title, language)}
                    </div>
                    <DialogTitle className='text-xl'>{localizeShowcaseText(showcaseCase.title, language)}</DialogTitle>
                    <DialogDescription className='leading-6'>
                        {localizeShowcaseText(showcaseCase.summary, language)}
                    </DialogDescription>
                </DialogHeader>

                <div className='max-h-[min(70dvh,680px)] space-y-5 overflow-y-auto px-5 py-5'>
                    <section className='space-y-3' aria-labelledby='showcase-input-heading'>
                        <div className='flex items-center justify-between gap-3'>
                            <h3 id='showcase-input-heading' className='text-sm font-semibold'>
                                {t('showcase.guide.step.images')}
                            </h3>
                            <span className='text-muted-foreground text-xs'>
                                {t('showcase.guide.images.orderHint')}
                            </span>
                        </div>
                        <div className='grid gap-3 sm:grid-cols-2'>
                            {orderedSlots.map((slot, index) => {
                                const selected = filesBySlot[slot.id] ?? [];
                                return (
                                    <label
                                        key={slot.id}
                                        className='app-panel-subtle border-panel-divider group flex min-h-32 cursor-pointer flex-col rounded-xl border p-3 focus-within:ring-2 focus-within:ring-violet-500/30'>
                                        <input
                                            type='file'
                                            accept={slot.acceptedMimeTypes.join(',')}
                                            multiple={slot.maxCount > 1}
                                            className='sr-only'
                                            onChange={(event) => {
                                                const selectedFiles = Array.from(event.target.files ?? []).slice(
                                                    0,
                                                    slot.maxCount
                                                );
                                                setFilesBySlot((current) => ({ ...current, [slot.id]: selectedFiles }));
                                            }}
                                        />
                                        <div className='flex items-start gap-3'>
                                            <span className='bg-background border-border flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold'>
                                                {index + 1}
                                            </span>
                                            <div className='min-w-0'>
                                                <p className='text-sm font-medium'>
                                                    {localizeShowcaseText(slot.label, language)}
                                                    {!slot.required && (
                                                        <span className='text-muted-foreground ml-1 font-normal'>
                                                            {t('showcase.guide.optional')}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className='text-muted-foreground mt-1 text-xs leading-5'>
                                                    {localizeShowcaseText(slot.description, language)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className='mt-auto pt-3'>
                                            <span className='border-border bg-background/70 flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs'>
                                                <ImagePlus className='text-primary h-3.5 w-3.5 shrink-0' />
                                                <span className='truncate'>
                                                    {selected.length > 0
                                                        ? selected.map((file) => file.name).join(', ')
                                                        : t('showcase.guide.chooseImage')}
                                                </span>
                                            </span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        {currentSourceImageCount > 0 && (
                            <div className='app-panel-subtle border-panel-divider space-y-2 rounded-xl border p-3'>
                                <p className='text-muted-foreground text-xs leading-5'>
                                    {t('showcase.guide.images.existing', { count: currentSourceImageCount })}
                                </p>
                                <div className='grid gap-2 sm:grid-cols-2'>
                                    <ChoiceButton
                                        active={imageMode === 'replace'}
                                        label={t('showcase.guide.imageMode.replace')}
                                        description={t('showcase.guide.imageMode.replace.description')}
                                        onClick={() => setImageMode('replace')}
                                    />
                                    <ChoiceButton
                                        active={imageMode === 'append'}
                                        label={t('showcase.guide.imageMode.append')}
                                        description={t('showcase.guide.imageMode.append.description')}
                                        onClick={() => setImageMode('append')}
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    {recipe.userInstruction?.enabled && (
                        <section className='space-y-2'>
                            <h3 className='text-sm font-semibold'>{t('showcase.guide.step.personalize')}</h3>
                            <Input
                                value={userInstruction}
                                maxLength={recipe.userInstruction.maxLength}
                                onChange={(event) => setUserInstruction(event.target.value)}
                                placeholder={t('showcase.guide.personalize.placeholder')}
                                className='bg-panel-ghost h-10 rounded-xl'
                            />
                        </section>
                    )}

                    <section className='space-y-3'>
                        <h3 className='text-sm font-semibold'>{t('showcase.guide.step.prompt')}</h3>
                        {currentPrompt.trim() && (
                            <div className='grid gap-2 sm:grid-cols-3'>
                                <ChoiceButton
                                    active={promptMode === 'replace'}
                                    label={t('showcase.guide.promptMode.replace')}
                                    description={t('showcase.guide.promptMode.replace.description')}
                                    onClick={() => setPromptMode('replace')}
                                />
                                <ChoiceButton
                                    active={promptMode === 'append'}
                                    label={t('showcase.guide.promptMode.append')}
                                    description={t('showcase.guide.promptMode.append.description')}
                                    onClick={() => setPromptMode('append')}
                                />
                                <ChoiceButton
                                    active={promptMode === 'keep'}
                                    label={t('showcase.guide.promptMode.keep')}
                                    description={t('showcase.guide.promptMode.keep.description')}
                                    onClick={() => setPromptMode('keep')}
                                />
                            </div>
                        )}
                        <Textarea
                            value={prompt}
                            readOnly
                            className='bg-panel-ghost min-h-32 rounded-xl text-sm leading-6'
                            aria-label={t('showcase.guide.prompt.ariaLabel')}
                        />
                    </section>

                    <section className='space-y-2'>
                        <h3 className='text-sm font-semibold'>{t('showcase.guide.step.compatibility')}</h3>
                        {compatibility?.compatible === false ? (
                            <div className='rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200'>
                                <div className='flex items-start gap-2'>
                                    <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
                                    <div>
                                        <p className='font-medium'>
                                            {t('showcase.guide.compatibility.incompatible', { model: modelLabel })}
                                        </p>
                                        <p className='mt-1 text-xs leading-5 opacity-90'>
                                            {t('showcase.guide.compatibility.details', {
                                                reasons: compatibilityReasons.join(listSeparator),
                                                suggestion: compatibilitySuggestion
                                            })}
                                        </p>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            className='mt-3 border-amber-500/30 bg-background/70'
                                            onClick={onOpenModelSettings}>
                                            {t('showcase.guide.compatibility.openSettings')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className='rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200'>
                                <div className='flex items-center gap-2 font-medium'>
                                    <Check className='h-4 w-4' />
                                    {t('showcase.guide.compatibility.compatible', { model: modelLabel })}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <DialogFooter className='border-panel-divider bg-background/90 border-t px-5 py-4 sm:items-center sm:justify-between'>
                    <p className='text-muted-foreground text-xs leading-5'>{t('showcase.guide.safetyNotice')}</p>
                    <div className='flex gap-2'>
                        <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type='button'
                            disabled={!canConfirm}
                            onClick={() => onConfirm({ files: orderedFiles, imageMode, prompt, promptMode })}>
                            {canConfirm ? <ArrowRight className='h-4 w-4' /> : <AlertTriangle className='h-4 w-4' />}
                            {t('showcase.guide.loadWorkbench')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
