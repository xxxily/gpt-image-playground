'use client';

import { ShowcaseMedia } from './showcase-media';
import { buildShowcaseTopicHref, getLocalizedShowcaseText } from './showcase-navigation';
import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { CONFIG_CHANGED_EVENT } from '@/lib/config';
import { FORM_PREFERENCES_CHANGED_EVENT } from '@/lib/form-preferences';
import type { ShowcaseCatalog, ShowcaseTopic } from '@/lib/showcase';
import { readShowcaseTopicAvailability } from '@/lib/showcase-availability';
import { getShowcaseAsset, getShowcaseCases, getShowcaseTopicInputSummary } from '@/lib/showcase-client';
import { SYNC_CONFIG_CHANGED_EVENT } from '@/lib/sync/provider-config';
import { ArrowRight, CheckCircle2, ImagePlus, Layers3, Settings2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

export type ShowcaseTopicCardProps = {
    catalog: ShowcaseCatalog;
    topic: ShowcaseTopic;
    compact?: boolean;
    returnHref?: string;
};

export function ShowcaseTopicCard({ catalog, topic, compact = false, returnHref }: ShowcaseTopicCardProps) {
    const { language, t } = useAppLanguage();
    const cases = getShowcaseCases(catalog, topic);
    const cover = getShowcaseAsset(catalog, topic.coverAssetId);
    const title = getLocalizedShowcaseText(topic.title, language);
    const summary = getLocalizedShowcaseText(topic.summary, language);
    const inputSummary = getShowcaseTopicInputSummary(catalog, topic);
    const [availability, setAvailability] = React.useState<ReturnType<typeof readShowcaseTopicAvailability> | null>(
        null
    );
    const refreshAvailability = React.useCallback(() => {
        setAvailability(readShowcaseTopicAvailability(catalog, topic));
    }, [catalog, topic]);

    React.useEffect(() => {
        refreshAvailability();
        if (typeof window === 'undefined') return;
        const refreshOnVisible = () => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') refreshAvailability();
        };
        window.addEventListener(CONFIG_CHANGED_EVENT, refreshAvailability);
        window.addEventListener(FORM_PREFERENCES_CHANGED_EVENT, refreshAvailability);
        window.addEventListener(SYNC_CONFIG_CHANGED_EVENT, refreshAvailability);
        window.addEventListener('pageshow', refreshOnVisible);
        window.addEventListener('storage', refreshAvailability);
        document.addEventListener('visibilitychange', refreshOnVisible);
        return () => {
            window.removeEventListener(CONFIG_CHANGED_EVENT, refreshAvailability);
            window.removeEventListener(FORM_PREFERENCES_CHANGED_EVENT, refreshAvailability);
            window.removeEventListener(SYNC_CONFIG_CHANGED_EVENT, refreshAvailability);
            window.removeEventListener('pageshow', refreshOnVisible);
            window.removeEventListener('storage', refreshAvailability);
            document.removeEventListener('visibilitychange', refreshOnVisible);
        };
    }, [refreshAvailability]);

    const inputLabel = !inputSummary.inputRequirementsKnown
        ? t('showcase.topic.input.unknown')
        : inputSummary.maximumInputs === 0
          ? t('showcase.topic.input.none')
          : inputSummary.minimumInputs === inputSummary.maximumInputs
            ? t('showcase.topic.input.exact', { count: inputSummary.maximumInputs })
            : t('showcase.topic.input.range', {
                  minimum: inputSummary.minimumInputs,
                  maximum: inputSummary.maximumInputs
              });
    const availabilityIcon =
        availability === 'ready' ? (
            <CheckCircle2 className='size-3.5' aria-hidden='true' />
        ) : availability === 'read-only' ? (
            <ShieldAlert className='size-3.5' aria-hidden='true' />
        ) : (
            <Settings2 className='size-3.5' aria-hidden='true' />
        );

    return (
        <article className='app-panel-subtle group focus-within:border-primary/45 flex min-w-0 flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 motion-reduce:transform-none'>
            <Link
                href={buildShowcaseTopicHref(topic.slug, returnHref)}
                className='focus-visible:ring-ring/50 block min-w-0 outline-none focus-visible:ring-[3px]'
                aria-label={t('showcase.topic.openAria', { title })}>
                <ShowcaseMedia
                    asset={cover}
                    eager={topic.sortOrder <= 100}
                    className={compact ? 'aspect-[1.65]' : 'aspect-[1.8]'}
                />
            </Link>
            <div className='flex min-w-0 flex-1 flex-col gap-3 p-4'>
                <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <h3 className='text-foreground truncate text-base font-semibold'>{title}</h3>
                        <p className='text-on-panel-muted mt-1 line-clamp-2 text-sm leading-5'>{summary}</p>
                    </div>
                    <span className='bg-panel-ghost text-on-panel-muted border-panel-divider inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px]'>
                        <Layers3 className='size-3' aria-hidden='true' />
                        {t('showcase.topic.caseCount', { count: cases.length })}
                    </span>
                </div>

                <div className='flex flex-wrap gap-1.5' aria-label={t('showcase.topic.tagsAria')}>
                    {topic.tags.slice(0, compact ? 2 : 4).map((tag) => (
                        <span
                            key={`${topic.id}-${getLocalizedShowcaseText(tag, language)}`}
                            className='border-panel-divider bg-panel-ghost text-on-panel-faint rounded-full border px-2 py-1 text-[11px]'>
                            {getLocalizedShowcaseText(tag, language)}
                        </span>
                    ))}
                </div>

                <div className='border-panel-divider bg-panel-ghost grid grid-cols-2 gap-px overflow-hidden rounded-lg border text-[11px]'>
                    <span className='bg-panel-subtle text-on-panel-muted flex min-w-0 items-center gap-1.5 px-2.5 py-2'>
                        <ImagePlus className='size-3.5 shrink-0' aria-hidden='true' />
                        <span className='truncate'>{inputLabel}</span>
                    </span>
                    <span
                        className={`bg-panel-subtle flex min-w-0 items-center gap-1.5 px-2.5 py-2 ${
                            availability === 'ready' ? 'text-emerald-700 dark:text-emerald-300' : 'text-on-panel-muted'
                        }`}>
                        {availabilityIcon}
                        <span className='truncate'>
                            {availability
                                ? t(`showcase.topic.availability.${availability}`)
                                : t('showcase.topic.availability.checking')}
                        </span>
                    </span>
                </div>

                <Button asChild variant='ghost' size='sm' className='mt-auto w-full justify-between px-2 text-left'>
                    <Link href={buildShowcaseTopicHref(topic.slug, returnHref)}>
                        {t('showcase.topic.browseCases')}
                        <ArrowRight aria-hidden='true' />
                    </Link>
                </Button>
            </div>
        </article>
    );
}
