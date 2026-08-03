'use client';

import { ShowcaseCaseDetail, ShowcaseTopicDetail } from './showcase-detail';
import {
    buildShowcaseDirectoryHref,
    getLocalizedShowcaseText,
    type ShowcaseDirectoryInputFilter
} from './showcase-navigation';
import { ShowcaseTopicCard } from './showcase-topic-card';
import { getShowcaseCatalogSourceMessageKey, useShowcaseCatalog } from './use-showcase-catalog';
import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { getShowcaseCase, getShowcaseTopic } from '@/lib/showcase-client';
import { Compass, Home, RefreshCw, RotateCcw, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
    const router = useRouter();
    const searchParams = useSearchParams();
    const topicSlug = searchParams.get('topic');
    const caseSlug = searchParams.get('case');
    const state = useShowcaseCatalog();

    const topic = topicSlug ? getShowcaseTopic(state.catalog, topicSlug) : null;
    const showcaseCase = topic && caseSlug ? getShowcaseCase(state.catalog, topic, caseSlug) : null;
    const queryParam = searchParams.get('q')?.trim() ?? '';
    const inputParam = searchParams.get('input');
    const inputFilter: ShowcaseDirectoryInputFilter = ['none', 'single', 'multiple', 'mask'].includes(inputParam ?? '')
        ? (inputParam as ShowcaseDirectoryInputFilter)
        : 'all';
    const tagFilter = searchParams.get('tag')?.trim() ?? '';
    const [queryDraft, setQueryDraft] = React.useState(queryParam);

    React.useEffect(() => setQueryDraft(queryParam), [queryParam]);

    const allTags = React.useMemo(() => {
        const values = new Map<string, string>();
        state.catalog.topics.forEach((item) => {
            item.tags.forEach((tag) => {
                const label = getLocalizedShowcaseText(tag, language);
                values.set(label.toLocaleLowerCase(), label);
            });
        });
        return [...values.values()].sort((left, right) => left.localeCompare(right, language));
    }, [language, state.catalog.topics]);

    const topics = React.useMemo(() => {
        const query = queryParam.toLocaleLowerCase(language);
        return state.catalog.topics
            .filter((item) => {
                const cases = item.caseIds
                    .map((caseId) => state.catalog.cases.find((candidate) => candidate.id === caseId))
                    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
                const minimumInputs = Math.min(
                    ...cases.map((candidate) =>
                        candidate.recipe.inputSlots.reduce((sum, slot) => sum + slot.minCount, 0)
                    )
                );
                const maximumInputs = Math.max(
                    ...cases.map((candidate) =>
                        candidate.recipe.inputSlots.reduce((sum, slot) => sum + slot.maxCount, 0)
                    )
                );
                const needsMask = cases.some((candidate) => candidate.recipe.capabilityRequirements.supportsMask);
                if (inputFilter === 'none' && minimumInputs !== 0) return false;
                if (inputFilter === 'single' && !(minimumInputs <= 1 && maximumInputs === 1)) return false;
                if (inputFilter === 'multiple' && maximumInputs < 2) return false;
                if (inputFilter === 'mask' && !needsMask) return false;
                if (
                    tagFilter &&
                    !item.tags.some(
                        (tag) =>
                            getLocalizedShowcaseText(tag, language).toLocaleLowerCase() ===
                            tagFilter.toLocaleLowerCase()
                    )
                ) {
                    return false;
                }
                if (!query) return true;
                const searchable = [
                    item.slug,
                    getLocalizedShowcaseText(item.title, language),
                    getLocalizedShowcaseText(item.summary, language),
                    ...item.tags.map((tag) => getLocalizedShowcaseText(tag, language)),
                    ...cases.flatMap((candidate) => [
                        candidate.slug,
                        getLocalizedShowcaseText(candidate.title, language),
                        getLocalizedShowcaseText(candidate.summary, language)
                    ])
                ]
                    .join(' ')
                    .toLocaleLowerCase(language);
                return searchable.includes(query);
            })
            .sort((left, right) => Number(right.featured) - Number(left.featured) || left.sortOrder - right.sortOrder);
    }, [inputFilter, language, queryParam, state.catalog.cases, state.catalog.topics, tagFilter]);

    const updateFilters = React.useCallback(
        (next: { query?: string; input?: ShowcaseDirectoryInputFilter; tag?: string }) => {
            router.replace(
                buildShowcaseDirectoryHref({
                    query: next.query ?? queryParam,
                    input: next.input ?? inputFilter,
                    tag: next.tag ?? tagFilter
                }),
                { scroll: false }
            );
        },
        [inputFilter, queryParam, router, tagFilter]
    );

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
                    <form
                        className='app-panel-subtle mb-4 grid min-w-0 gap-3 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_12rem]'
                        role='search'
                        onSubmit={(event) => {
                            event.preventDefault();
                            updateFilters({ query: queryDraft });
                        }}>
                        <label className='min-w-0 space-y-1.5'>
                            <span className='text-on-panel-muted text-xs font-medium'>
                                {t('showcase.page.searchLabel')}
                            </span>
                            <span className='relative block'>
                                <Search
                                    className='text-on-panel-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
                                    aria-hidden='true'
                                />
                                <Input
                                    name='showcase-search'
                                    type='search'
                                    autoComplete='off'
                                    value={queryDraft}
                                    onChange={(event) => setQueryDraft(event.target.value)}
                                    placeholder={t('showcase.page.searchPlaceholder')}
                                    className='bg-background pl-9'
                                />
                            </span>
                        </label>
                        <label className='space-y-1.5'>
                            <span className='text-on-panel-muted flex items-center gap-1.5 text-xs font-medium'>
                                <SlidersHorizontal className='size-3.5' aria-hidden='true' />
                                {t('showcase.page.inputFilterLabel')}
                            </span>
                            <select
                                name='showcase-input-filter'
                                value={inputFilter}
                                onChange={(event) =>
                                    updateFilters({ input: event.target.value as ShowcaseDirectoryInputFilter })
                                }
                                className='border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]'>
                                {(['all', 'none', 'single', 'multiple', 'mask'] as const).map((value) => (
                                    <option key={value} value={value}>
                                        {t(`showcase.page.inputFilter.${value}`)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className='flex min-w-0 flex-wrap items-center gap-2 sm:col-span-2'>
                            <span className='text-on-panel-faint text-xs'>{t('showcase.page.tagFilterLabel')}</span>
                            {allTags.slice(0, 10).map((tag) => (
                                <button
                                    key={tag}
                                    type='button'
                                    aria-pressed={tagFilter === tag}
                                    onClick={() => updateFilters({ tag: tagFilter === tag ? '' : tag })}
                                    className={`focus-visible:ring-ring/50 min-h-8 rounded-full border px-3 text-xs transition-[background-color,border-color,color] outline-none focus-visible:ring-[3px] ${
                                        tagFilter === tag
                                            ? 'border-primary/50 bg-primary/10 text-primary'
                                            : 'border-panel-divider bg-panel-ghost text-on-panel-muted hover:bg-panel-subtle'
                                    }`}>
                                    {tag}
                                </button>
                            ))}
                            {queryParam || inputFilter !== 'all' || tagFilter ? (
                                <Button asChild variant='ghost' size='sm' className='ml-auto'>
                                    <Link href='/topics'>
                                        <RotateCcw aria-hidden='true' />
                                        {t('showcase.page.resetFilters')}
                                    </Link>
                                </Button>
                            ) : null}
                        </div>
                    </form>
                    {topics.length > 0 ? (
                        <div className='grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                            {topics.map((item) => (
                                <ShowcaseTopicCard key={item.id} catalog={state.catalog} topic={item} />
                            ))}
                        </div>
                    ) : (
                        <div className='app-panel-card rounded-2xl border'>
                            <EmptyState
                                icon={<SearchX />}
                                title={t('showcase.page.noResultsTitle')}
                                description={t('showcase.page.noResultsDescription')}
                                action={
                                    <Button asChild variant='outline'>
                                        <Link href='/topics'>{t('showcase.page.resetFilters')}</Link>
                                    </Button>
                                }
                            />
                        </div>
                    )}
                </section>
            )}
            <p className='text-on-panel-faint mx-auto mt-8 max-w-2xl text-center text-xs leading-5'>
                {getLocalizedShowcaseText(state.catalog.contentNotice, language)}
            </p>
        </main>
    );
}
