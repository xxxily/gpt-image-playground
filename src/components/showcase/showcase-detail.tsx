'use client';

import { ShowcaseCaseCard } from './showcase-case-card';
import { ShowcaseComparison } from './showcase-media';
import {
    buildShowcaseCaseHref,
    buildShowcaseTopicHref,
    buildShowcaseWorkbenchHref,
    getLocalizedShowcaseText
} from './showcase-navigation';
import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { isExecutableShowcaseCase, type ShowcaseCase, type ShowcaseCatalog, type ShowcaseTopic } from '@/lib/showcase';
import { getShowcaseCases } from '@/lib/showcase-client';
import { copyTextToClipboard } from '@/lib/desktop-runtime';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    ClipboardList,
    ImagePlus,
    Info,
    Layers3,
    LockKeyhole,
    Sparkles
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

function InformationPanel({
    icon,
    title,
    children,
    tone = 'default'
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    tone?: 'default' | 'warning';
}) {
    return (
        <section
            className={
                tone === 'warning'
                    ? 'rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4'
                    : 'app-panel-subtle rounded-xl border p-4'
            }>
            <div className='flex items-start gap-3'>
                <span
                    className={
                        tone === 'warning' ? 'mt-0.5 text-amber-600 dark:text-amber-300' : 'text-on-panel-faint mt-0.5'
                    }
                    aria-hidden='true'>
                    {icon}
                </span>
                <div className='min-w-0'>
                    <h2 className='text-foreground text-sm font-semibold'>{title}</h2>
                    <div className='text-on-panel-muted mt-1 text-sm leading-6'>{children}</div>
                </div>
            </div>
        </section>
    );
}

export function ShowcaseTopicDetail({ catalog, topic }: { catalog: ShowcaseCatalog; topic: ShowcaseTopic }) {
    const { language, t } = useAppLanguage();
    const cases = getShowcaseCases(catalog, topic);
    const relatedTopics = (topic.relatedTopicIds ?? [])
        .map((id) => catalog.topics.find((candidate) => candidate.id === id))
        .filter((candidate): candidate is ShowcaseTopic => Boolean(candidate));

    return (
        <div className='space-y-5'>
            <nav aria-label={t('showcase.breadcrumb.aria')}>
                <Button asChild variant='ghost' size='sm' className='-ml-2'>
                    <Link href='/topics'>
                        <ArrowLeft aria-hidden='true' />
                        {t('showcase.backToTopics')}
                    </Link>
                </Button>
            </nav>

            <header className='app-panel-card overflow-hidden rounded-2xl border'>
                <div className='grid min-w-0 gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.8fr)]'>
                    <div className='min-w-0'>
                        <div className='text-on-panel-faint flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase'>
                            <Layers3 className='size-3.5' aria-hidden='true' />
                            {t('showcase.topic.label')}
                        </div>
                        <h1 className='text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl'>
                            {getLocalizedShowcaseText(topic.title, language)}
                        </h1>
                        <p className='text-on-panel-muted mt-3 max-w-3xl text-sm leading-7 sm:text-base'>
                            {getLocalizedShowcaseText(topic.summary, language)}
                        </p>
                        <div className='mt-4 flex flex-wrap gap-2'>
                            {topic.tags.map((tag) => (
                                <span
                                    key={`${topic.id}-${getLocalizedShowcaseText(tag, language)}`}
                                    className='border-panel-divider bg-panel-ghost text-on-panel-muted rounded-full border px-2.5 py-1 text-xs'>
                                    {getLocalizedShowcaseText(tag, language)}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className='grid gap-3'>
                        <InformationPanel
                            icon={<ClipboardList className='size-4' />}
                            title={t('showcase.topic.preparation')}>
                            {getLocalizedShowcaseText(topic.preparation, language)}
                        </InformationPanel>
                        <InformationPanel
                            icon={<AlertTriangle className='size-4' />}
                            title={t('showcase.topic.limitations')}
                            tone='warning'>
                            {getLocalizedShowcaseText(topic.limitations, language)}
                        </InformationPanel>
                        {topic.capabilities ? (
                            <InformationPanel
                                icon={<Sparkles className='size-4' />}
                                title={t('showcase.topic.capabilities')}>
                                {getLocalizedShowcaseText(topic.capabilities, language)}
                            </InformationPanel>
                        ) : null}
                    </div>
                </div>
            </header>

            {(topic.suitableFor || topic.unsuitableFor || topic.recommendedInputQuality) && (
                <section className='grid min-w-0 gap-4 md:grid-cols-3' aria-labelledby='showcase-topic-fit'>
                    <h2 id='showcase-topic-fit' className='sr-only'>
                        {t('showcase.topic.fitTitle')}
                    </h2>
                    {topic.suitableFor ? (
                        <InformationPanel
                            icon={<CheckCircle2 className='size-4' />}
                            title={t('showcase.topic.suitableFor')}>
                            {getLocalizedShowcaseText(topic.suitableFor, language)}
                        </InformationPanel>
                    ) : null}
                    {topic.unsuitableFor ? (
                        <InformationPanel
                            icon={<AlertTriangle className='size-4' />}
                            title={t('showcase.topic.unsuitableFor')}
                            tone='warning'>
                            {getLocalizedShowcaseText(topic.unsuitableFor, language)}
                        </InformationPanel>
                    ) : null}
                    {topic.recommendedInputQuality ? (
                        <InformationPanel
                            icon={<ImagePlus className='size-4' />}
                            title={t('showcase.topic.inputQuality')}>
                            {getLocalizedShowcaseText(topic.recommendedInputQuality, language)}
                        </InformationPanel>
                    ) : null}
                </section>
            )}

            <section aria-labelledby='showcase-topic-cases'>
                <div className='mb-3 flex items-end justify-between gap-3'>
                    <div>
                        <h2 id='showcase-topic-cases' className='text-foreground text-lg font-semibold'>
                            {t('showcase.topic.casesTitle')}
                        </h2>
                        <p className='text-on-panel-muted mt-1 text-sm'>
                            {t('showcase.topic.casesDescription', { count: cases.length })}
                        </p>
                    </div>
                </div>
                <div className='grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3'>
                    {cases.map((showcaseCase) => (
                        <ShowcaseCaseCard
                            key={showcaseCase.id}
                            catalog={catalog}
                            topic={topic}
                            showcaseCase={showcaseCase}
                        />
                    ))}
                </div>
            </section>

            {topic.faq && topic.faq.length > 0 ? (
                <section className='app-panel-card rounded-2xl border p-4 sm:p-5' aria-labelledby='showcase-topic-faq'>
                    <h2 id='showcase-topic-faq' className='text-foreground text-base font-semibold'>
                        {t('showcase.topic.faq')}
                    </h2>
                    <div className='mt-3 divide-y divide-[color:var(--panel-divider)]'>
                        {topic.faq.map((item, index) => (
                            <details key={`${topic.id}-faq-${index}`} className='group py-3 first:pt-0 last:pb-0'>
                                <summary className='text-foreground cursor-pointer list-none pr-8 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] [&::-webkit-details-marker]:hidden'>
                                    {getLocalizedShowcaseText(item.question, language)}
                                </summary>
                                <p className='text-on-panel-muted mt-2 text-sm leading-6'>
                                    {getLocalizedShowcaseText(item.answer, language)}
                                </p>
                            </details>
                        ))}
                    </div>
                </section>
            ) : null}

            {relatedTopics.length > 0 ? (
                <section aria-labelledby='showcase-topic-related'>
                    <h2 id='showcase-topic-related' className='text-foreground text-base font-semibold'>
                        {t('showcase.topic.related')}
                    </h2>
                    <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                        {relatedTopics.map((related) => (
                            <Link
                                key={related.id}
                                href={buildShowcaseTopicHref(related.slug)}
                                className='app-panel-subtle border-panel-divider focus-visible:ring-ring/50 hover:bg-panel-ghost rounded-xl border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none'>
                                <span className='text-foreground block text-sm font-medium'>
                                    {getLocalizedShowcaseText(related.title, language)}
                                </span>
                                <span className='text-on-panel-muted mt-1 block text-xs leading-5'>
                                    {getLocalizedShowcaseText(related.summary, language)}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}

export function ShowcaseCaseDetail({
    catalog,
    topic,
    showcaseCase
}: {
    catalog: ShowcaseCatalog;
    topic: ShowcaseTopic;
    showcaseCase: ShowcaseCase;
}) {
    const { language, t } = useAppLanguage();
    const cases = getShowcaseCases(catalog, topic);
    const currentIndex = cases.findIndex((item) => item.id === showcaseCase.id);
    const nextCase = currentIndex >= 0 ? cases[currentIndex + 1] : undefined;
    const executable = isExecutableShowcaseCase(showcaseCase);
    const output = executable ? showcaseCase.recipe.output : undefined;
    const prompt = executable
        ? getLocalizedShowcaseText(showcaseCase.recipe.prompt, language)
        : showcaseCase.readOnlyPrompt
          ? getLocalizedShowcaseText(showcaseCase.readOnlyPrompt, language)
          : t('showcase.case.unsupportedDescription', { version: showcaseCase.unsupportedRecipeVersion ?? '?' });
    const taskModeLabel = executable
        ? t(
              showcaseCase.recipe.taskMode === 'image-edit'
                  ? 'showcase.recipe.imageEdit'
                  : 'showcase.recipe.imageGenerate'
          )
        : t('showcase.recipe.unknown');
    const [promptCopyStatus, setPromptCopyStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

    const copyPrompt = async () => {
        const copied = await copyTextToClipboard(prompt);
        setPromptCopyStatus(copied ? 'success' : 'error');
        if (copied) window.setTimeout(() => setPromptCopyStatus('idle'), 1800);
    };

    return (
        <div className='space-y-5'>
            <nav className='flex flex-wrap items-center gap-1' aria-label={t('showcase.breadcrumb.aria')}>
                <Button asChild variant='ghost' size='sm' className='-ml-2'>
                    <Link href='/topics'>
                        <ArrowLeft aria-hidden='true' />
                        {t('showcase.backToTopics')}
                    </Link>
                </Button>
                <span className='text-on-panel-faint' aria-hidden='true'>
                    /
                </span>
                <Button asChild variant='ghost' size='sm'>
                    <Link href={buildShowcaseTopicHref(topic.slug)}>
                        {getLocalizedShowcaseText(topic.title, language)}
                    </Link>
                </Button>
            </nav>

            <header className='app-panel-card min-w-0 overflow-hidden rounded-2xl border'>
                <div className='grid min-w-0 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]'>
                    <ShowcaseComparison catalog={catalog} showcaseCase={showcaseCase} eager />
                    <div className='flex min-w-0 flex-col'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='border-panel-divider bg-panel-ghost text-on-panel-muted rounded-full border px-2.5 py-1 text-xs'>
                                {t(`showcase.difficulty.${showcaseCase.difficulty}`)}
                            </span>
                            <span className='text-on-panel-faint text-xs'>
                                {executable
                                    ? t('showcase.case.referenceCount', {
                                          count: showcaseCase.recipe.inputSlots.length
                                      })
                                    : t('showcase.case.inputRequirementsUnknown')}
                            </span>
                        </div>
                        <h1 className='text-foreground mt-3 text-2xl font-semibold tracking-tight sm:text-3xl'>
                            {getLocalizedShowcaseText(showcaseCase.title, language)}
                        </h1>
                        <p className='text-on-panel-muted mt-3 text-sm leading-7'>
                            {getLocalizedShowcaseText(showcaseCase.resultExplanation, language)}
                        </p>

                        <div className='mt-5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3'>
                            <div className='app-panel-subtle rounded-lg border p-2.5'>
                                <span className='text-on-panel-faint block'>{t('showcase.recipe.mode')}</span>
                                <strong className='text-foreground mt-1 block font-medium'>{taskModeLabel}</strong>
                            </div>
                            <div className='app-panel-subtle rounded-lg border p-2.5'>
                                <span className='text-on-panel-faint block'>{t('showcase.recipe.size')}</span>
                                <strong className='text-foreground mt-1 block truncate font-medium'>
                                    {!executable
                                        ? t('showcase.recipe.unknown')
                                        : (output?.size ?? t('showcase.recipe.auto'))}
                                </strong>
                            </div>
                            <div className='app-panel-subtle col-span-2 rounded-lg border p-2.5 sm:col-span-1'>
                                <span className='text-on-panel-faint block'>{t('showcase.recipe.quality')}</span>
                                <strong className='text-foreground mt-1 block font-medium'>
                                    {!executable
                                        ? t('showcase.recipe.unknown')
                                        : output?.quality
                                          ? t(`showcase.recipe.quality.${output.quality}`)
                                          : t('showcase.recipe.auto')}
                                </strong>
                            </div>
                        </div>

                        {executable ? (
                            <Button asChild size='lg' className='mt-5 w-full'>
                                <Link href={buildShowcaseWorkbenchHref(topic.slug, showcaseCase.slug)}>
                                    <Sparkles aria-hidden='true' />
                                    {t('showcase.case.start')}
                                </Link>
                            </Button>
                        ) : (
                            <Button size='lg' className='mt-5 w-full' disabled>
                                <LockKeyhole aria-hidden='true' />
                                {t('showcase.case.readOnly')}
                            </Button>
                        )}
                        <p className='text-on-panel-faint mt-2 text-center text-xs leading-5'>
                            {executable ? t('showcase.case.startHint') : t('showcase.case.unsupportedHint')}
                        </p>
                    </div>
                </div>
            </header>

            <div className='grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
                <section
                    className='app-panel-card min-w-0 rounded-2xl border p-4 sm:p-5'
                    aria-labelledby='showcase-input-title'>
                    <div className='flex items-center gap-2'>
                        <ImagePlus className='text-on-panel-faint size-4' aria-hidden='true' />
                        <h2 id='showcase-input-title' className='text-foreground text-base font-semibold'>
                            {t('showcase.case.inputsTitle')}
                        </h2>
                    </div>
                    {executable ? (
                        <>
                            <p className='text-on-panel-muted mt-2 text-sm leading-6'>
                                {getLocalizedShowcaseText(showcaseCase.inputGuidance, language)}
                            </p>
                            <ol className='mt-4 space-y-2'>
                                {[...showcaseCase.recipe.inputSlots]
                                    .sort((left, right) => left.workbenchOrder - right.workbenchOrder)
                                    .map((slot, index) => (
                                        <li key={slot.id} className='app-panel-subtle flex gap-3 rounded-xl border p-3'>
                                            <span className='bg-foreground text-background flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
                                                {index + 1}
                                            </span>
                                            <div className='min-w-0'>
                                                <div className='flex flex-wrap items-center gap-2'>
                                                    <strong className='text-foreground text-sm font-medium'>
                                                        {getLocalizedShowcaseText(slot.label, language)}
                                                    </strong>
                                                    <span className='text-on-panel-faint text-[11px]'>
                                                        {slot.required
                                                            ? t('showcase.input.required')
                                                            : t('showcase.input.optional')}
                                                    </span>
                                                </div>
                                                <p className='text-on-panel-muted mt-1 text-xs leading-5'>
                                                    {getLocalizedShowcaseText(slot.description, language)}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                            </ol>
                        </>
                    ) : (
                        <div className='mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm leading-6 text-amber-800 dark:text-amber-200'>
                            {t('showcase.case.inputRequirementsUpgrade')}
                        </div>
                    )}
                </section>

                <section
                    className='app-panel-card min-w-0 rounded-2xl border p-4 sm:p-5'
                    aria-labelledby='showcase-prompt-title'>
                    <div className='flex items-center gap-2'>
                        <CheckCircle2 className='text-on-panel-faint size-4' aria-hidden='true' />
                        <h2 id='showcase-prompt-title' className='text-foreground text-base font-semibold'>
                            {t('showcase.case.promptTitle')}
                        </h2>
                    </div>
                    <p className='text-on-panel-muted mt-2 text-sm leading-6'>
                        {t(executable ? 'showcase.case.promptDescription' : 'showcase.case.readOnlyPromptDescription')}
                    </p>
                    <div className='relative mt-4'>
                        <div className='border-panel-divider bg-panel-ghost text-foreground max-h-64 overflow-auto rounded-xl border p-4 pr-12 text-sm leading-7 whitespace-pre-wrap'>
                            {prompt}
                        </div>
                        <button
                            type='button'
                            onClick={() => void copyPrompt()}
                            className='border-panel-divider bg-background text-on-panel-muted hover:bg-panel-subtle focus-visible:ring-ring/50 absolute top-2 right-2 flex size-8 items-center justify-center rounded-md border outline-none focus-visible:ring-[3px]'
                            aria-label={t('showcase.case.copyPrompt')}>
                            <ClipboardList className='size-3.5' aria-hidden='true' />
                        </button>
                    </div>
                    <p className='text-on-panel-faint mt-2 text-xs' role='status' aria-live='polite'>
                        {promptCopyStatus === 'success'
                            ? t('showcase.case.promptCopied')
                            : promptCopyStatus === 'error'
                              ? t('showcase.case.promptCopyFailed')
                              : null}
                    </p>
                    <div className='text-on-panel-muted mt-3 flex items-start gap-2 text-xs leading-5'>
                        <Info className='mt-0.5 size-3.5 shrink-0' aria-hidden='true' />
                        <span>{t('showcase.case.promptHint')}</span>
                    </div>
                </section>
            </div>

            <InformationPanel
                icon={<AlertTriangle className='size-4' />}
                title={t('showcase.case.cautionsTitle')}
                tone='warning'>
                {getLocalizedShowcaseText(showcaseCase.cautions, language)}
            </InformationPanel>

            <footer className='border-panel-divider flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between'>
                <Button asChild variant='outline'>
                    <Link href={buildShowcaseTopicHref(topic.slug)}>
                        <ArrowLeft aria-hidden='true' />
                        {t('showcase.case.backToCases')}
                    </Link>
                </Button>
                {nextCase ? (
                    <Button asChild variant='ghost'>
                        <Link href={buildShowcaseCaseHref(topic.slug, nextCase.slug)}>
                            {t('showcase.case.next', { title: getLocalizedShowcaseText(nextCase.title, language) })}
                            <ArrowRight aria-hidden='true' />
                        </Link>
                    </Button>
                ) : null}
            </footer>
        </div>
    );
}
