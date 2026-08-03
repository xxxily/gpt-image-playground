'use client';

import { ShowcaseTopicCard } from './showcase-topic-card';
import { getShowcaseCatalogSourceMessageKey, useShowcaseCatalog } from './use-showcase-catalog';
import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import type { ShowcaseCatalog } from '@/lib/showcase';
import { ArrowRight, Compass, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export type ShowcaseSectionProps = {
    catalog?: ShowcaseCatalog;
    className?: string;
    maxTopics?: number;
};

export function ShowcaseSection({ catalog: catalogOverride, className, maxTopics = 3 }: ShowcaseSectionProps) {
    const { t } = useAppLanguage();
    const state = useShowcaseCatalog(catalogOverride);
    const topics = state.catalog.topics
        .filter((topic) => topic.featured)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .slice(0, Math.max(1, maxTopics));

    return (
        <section
            className={`app-panel-card min-w-0 rounded-2xl border p-4 shadow-sm sm:p-5 ${className ?? ''}`}
            aria-labelledby='showcase-section-title'>
            <div className='mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
                <div className='min-w-0'>
                    <div className='text-on-panel-faint mb-1 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase'>
                        <Compass className='size-3.5' aria-hidden='true' />
                        {t('showcase.section.eyebrow')}
                    </div>
                    <h2
                        id='showcase-section-title'
                        className='text-foreground text-lg font-semibold tracking-tight sm:text-xl'>
                        {t('showcase.section.title')}
                    </h2>
                    <p className='text-on-panel-muted mt-1 max-w-2xl text-sm leading-6'>
                        {t('showcase.section.description')}
                    </p>
                </div>
                <Button asChild variant='ghost' size='sm' className='w-full shrink-0 justify-between sm:w-auto'>
                    <Link href='/topics'>
                        {t('showcase.section.viewAll')}
                        <ArrowRight aria-hidden='true' />
                    </Link>
                </Button>
            </div>

            {topics.length > 0 ? (
                <div className='grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                    {topics.map((topic) => (
                        <ShowcaseTopicCard key={topic.id} catalog={state.catalog} topic={topic} compact />
                    ))}
                </div>
            ) : (
                <div className='border-panel-divider bg-panel-subtle text-on-panel-muted flex min-h-28 items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm'>
                    {t('showcase.section.empty')}
                </div>
            )}

            <div className='text-on-panel-faint mt-3 flex items-center gap-1.5 text-[11px]' role='status'>
                {state.isLoading || state.source === 'cache' ? (
                    <RefreshCw className={`size-3 ${state.isLoading ? 'animate-spin' : ''}`} aria-hidden='true' />
                ) : null}
                {state.isLoading
                    ? t('showcase.source.loading')
                    : t(getShowcaseCatalogSourceMessageKey(state.source, state.stale))}
            </div>
        </section>
    );
}
