'use client';

import { ShowcaseMedia } from './showcase-media';
import { buildShowcaseTopicHref, getLocalizedShowcaseText } from './showcase-navigation';
import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import type { ShowcaseCatalog, ShowcaseTopic } from '@/lib/showcase';
import { getShowcaseAsset, getShowcaseCases } from '@/lib/showcase-client';
import { ArrowRight, Layers3 } from 'lucide-react';
import Link from 'next/link';

export type ShowcaseTopicCardProps = {
    catalog: ShowcaseCatalog;
    topic: ShowcaseTopic;
    compact?: boolean;
};

export function ShowcaseTopicCard({ catalog, topic, compact = false }: ShowcaseTopicCardProps) {
    const { language, t } = useAppLanguage();
    const cases = getShowcaseCases(catalog, topic);
    const cover = getShowcaseAsset(catalog, topic.coverAssetId);
    const title = getLocalizedShowcaseText(topic.title, language);
    const summary = getLocalizedShowcaseText(topic.summary, language);

    return (
        <article className='app-panel-subtle group flex min-w-0 flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow,transform] duration-200 focus-within:border-violet-500/45 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 motion-reduce:transform-none'>
            <Link
                href={buildShowcaseTopicHref(topic.slug)}
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

                <Button asChild variant='ghost' size='sm' className='mt-auto w-full justify-between px-2 text-left'>
                    <Link href={buildShowcaseTopicHref(topic.slug)}>
                        {t('showcase.topic.browseCases')}
                        <ArrowRight aria-hidden='true' />
                    </Link>
                </Button>
            </div>
        </article>
    );
}
