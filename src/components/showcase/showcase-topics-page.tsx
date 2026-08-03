'use client';

import { ShowcaseCaseDetail, ShowcaseTopicDetail } from './showcase-detail';
import { getLocalizedShowcaseText } from './showcase-navigation';
import { ShowcaseTopicCard } from './showcase-topic-card';
import { getShowcaseCatalogSourceMessageKey, useShowcaseCatalog } from './use-showcase-catalog';
import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getShowcaseCase, getShowcaseTopic } from '@/lib/showcase-client';
import { Compass, Home, RefreshCw, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';

function TopicsHeader() {
    const { t } = useAppLanguage();
    return (
        <header className='mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
            <div className='min-w-0'>
                <div className='text-on-panel-faint flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase'>
                    <Compass className='size-3.5' aria-hidden='true' />
                    {t('showcase.page.eyebrow')}
                </div>
                <h1 className='text-foreground mt-2 text-2xl font-semibold tracking-tight sm:text-3xl'>
                    {t('showcase.page.title')}
                </h1>
                <p className='text-on-panel-muted mt-2 max-w-3xl text-sm leading-7 sm:text-base'>
                    {t('showcase.page.description')}
                </p>
            </div>
            <Button asChild variant='outline' size='sm' className='w-full shrink-0 sm:w-auto'>
                <Link href='/'>
                    <Home aria-hidden='true' />
                    {t('showcase.page.backToWorkbench')}
                </Link>
            </Button>
        </header>
    );
}

export function ShowcaseTopicsPage() {
    const { language, t } = useAppLanguage();
    const searchParams = useSearchParams();
    const topicSlug = searchParams.get('topic');
    const caseSlug = searchParams.get('case');
    const state = useShowcaseCatalog();

    const topic = topicSlug ? getShowcaseTopic(state.catalog, topicSlug) : null;
    const showcaseCase = topic && caseSlug ? getShowcaseCase(state.catalog, topic, caseSlug) : null;
    const topics = state.catalog.topics.slice().sort((left, right) => left.sortOrder - right.sortOrder);

    if (state.isLoading && ((topicSlug && !topic) || (topic && caseSlug && !showcaseCase))) {
        return (
            <main id='main-content' className='mx-auto min-h-dvh w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
                <TopicsHeader />
                <div className='app-panel-card flex min-h-60 items-center justify-center rounded-2xl border'>
                    <div
                        className='text-on-panel-muted flex items-center gap-2 text-sm'
                        role='status'
                        aria-live='polite'>
                        <RefreshCw className='size-4 animate-spin' aria-hidden='true' />
                        {t('showcase.page.loading')}
                    </div>
                </div>
            </main>
        );
    }

    if (topicSlug && !topic) {
        return (
            <main id='main-content' className='mx-auto min-h-dvh w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
                <TopicsHeader />
                <div className='app-panel-card rounded-2xl border'>
                    <EmptyState
                        icon={<SearchX />}
                        title={t('showcase.page.notFoundTitle')}
                        description={t('showcase.page.notFoundDescription')}
                        action={
                            <Button asChild variant='outline'>
                                <Link href='/topics'>{t('showcase.page.viewAllTopics')}</Link>
                            </Button>
                        }
                    />
                </div>
            </main>
        );
    }

    if (topic && caseSlug && !showcaseCase) {
        return (
            <main id='main-content' className='mx-auto min-h-dvh w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
                <TopicsHeader />
                <div className='app-panel-card rounded-2xl border'>
                    <EmptyState
                        icon={<SearchX />}
                        title={t('showcase.page.caseNotFoundTitle')}
                        description={t('showcase.page.caseNotFoundDescription')}
                        action={
                            <Button asChild variant='outline'>
                                <Link href={`?topic=${encodeURIComponent(topic.slug)}`}>
                                    {t('showcase.page.backToTopic')}
                                </Link>
                            </Button>
                        }
                    />
                </div>
            </main>
        );
    }

    return (
        <main id='main-content' className='mx-auto min-h-dvh w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
            {!topic ? <TopicsHeader /> : null}
            <div
                className='text-on-panel-faint mb-4 flex items-center gap-1.5 text-[11px]'
                role='status'
                aria-live='polite'>
                {state.isLoading || state.source === 'cache' ? (
                    <RefreshCw className={`size-3 ${state.isLoading ? 'animate-spin' : ''}`} aria-hidden='true' />
                ) : null}
                {state.isLoading
                    ? t('showcase.source.loading')
                    : t(getShowcaseCatalogSourceMessageKey(state.source, state.stale))}
            </div>

            {showcaseCase && topic ? (
                <ShowcaseCaseDetail catalog={state.catalog} topic={topic} showcaseCase={showcaseCase} />
            ) : topic ? (
                <ShowcaseTopicDetail catalog={state.catalog} topic={topic} />
            ) : (
                <section aria-labelledby='showcase-topic-directory'>
                    <div className='mb-3 flex items-end justify-between gap-3'>
                        <div>
                            <h2 id='showcase-topic-directory' className='text-foreground text-lg font-semibold'>
                                {t('showcase.page.directoryTitle')}
                            </h2>
                            <p className='text-on-panel-muted mt-1 text-sm'>
                                {t('showcase.page.directoryDescription')}
                            </p>
                        </div>
                        <span className='text-on-panel-faint hidden text-xs sm:inline'>
                            {t('showcase.page.topicCount', { count: topics.length })}
                        </span>
                    </div>
                    <div className='grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                        {topics.map((item) => (
                            <ShowcaseTopicCard key={item.id} catalog={state.catalog} topic={item} />
                        ))}
                    </div>
                </section>
            )}
            <p className='text-on-panel-faint mx-auto mt-8 max-w-2xl text-center text-xs leading-5'>
                {getLocalizedShowcaseText(state.catalog.contentNotice, language)}
            </p>
        </main>
    );
}
