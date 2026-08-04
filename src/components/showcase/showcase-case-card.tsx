'use client';

import { ShowcaseComparison } from './showcase-media';
import { buildShowcaseCaseHref, buildShowcaseWorkbenchHref, getLocalizedShowcaseText } from './showcase-navigation';
import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { isExecutableShowcaseCase, type ShowcaseCase, type ShowcaseCatalog, type ShowcaseTopic } from '@/lib/showcase';
import { ArrowRight, LockKeyhole, Sparkles } from 'lucide-react';
import Link from 'next/link';

type ShowcaseCaseCardProps = {
    catalog: ShowcaseCatalog;
    topic: ShowcaseTopic;
    showcaseCase: ShowcaseCase;
};

export function ShowcaseCaseCard({ catalog, topic, showcaseCase }: ShowcaseCaseCardProps) {
    const { language, t } = useAppLanguage();
    const title = getLocalizedShowcaseText(showcaseCase.title, language);
    const executable = isExecutableShowcaseCase(showcaseCase);

    return (
        <article className='app-panel-subtle flex min-w-0 flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow,transform] duration-200 focus-within:border-violet-500/45 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 motion-reduce:transform-none'>
            <div className='p-3 pb-0'>
                <ShowcaseComparison catalog={catalog} showcaseCase={showcaseCase} compact />
            </div>

            <div className='flex min-w-0 flex-1 flex-col gap-3 p-4'>
                <div className='flex min-w-0 items-center justify-between gap-2'>
                    <span className='border-panel-divider bg-panel-ghost text-on-panel-muted inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium'>
                        {t(`showcase.difficulty.${showcaseCase.difficulty}`)}
                    </span>
                    <span className='text-on-panel-faint text-xs'>
                        {executable
                            ? t('showcase.case.referenceCount', { count: showcaseCase.recipe.inputSlots.length })
                            : t('showcase.case.updateRequired')}
                    </span>
                </div>

                <div className='min-w-0 space-y-1.5'>
                    <h3 className='text-foreground text-base leading-snug font-semibold'>{title}</h3>
                    <p className='text-on-panel-muted line-clamp-3 text-sm leading-6'>
                        {getLocalizedShowcaseText(showcaseCase.summary, language)}
                    </p>
                </div>

                <div className='mt-auto flex flex-col gap-2 pt-1 sm:flex-row'>
                    <Button asChild variant='outline' size='sm' className='min-w-0 flex-1'>
                        <Link href={buildShowcaseCaseHref(topic.slug, showcaseCase.slug)}>
                            {t('showcase.case.viewDetails')}
                            <ArrowRight aria-hidden='true' />
                        </Link>
                    </Button>
                    {executable ? (
                        <Button asChild size='sm' className='min-w-0 flex-1'>
                            <Link
                                href={buildShowcaseWorkbenchHref(topic.slug, showcaseCase.slug)}
                                aria-label={t('showcase.case.startAria', { title })}>
                                <Sparkles aria-hidden='true' />
                                {t('showcase.case.start')}
                            </Link>
                        </Button>
                    ) : (
                        <Button size='sm' className='min-w-0 flex-1' disabled>
                            <LockKeyhole aria-hidden='true' />
                            {t('showcase.case.readOnly')}
                        </Button>
                    )}
                </div>
            </div>
        </article>
    );
}
