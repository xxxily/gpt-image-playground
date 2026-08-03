import type { AppLanguage } from '@/lib/i18n/language';
import type { ShowcaseLocalizedText } from '@/lib/showcase';

export function getLocalizedShowcaseText(value: ShowcaseLocalizedText, language: AppLanguage): string {
    return value[language] ?? value['zh-CN'] ?? value['en-US'];
}

export function buildShowcaseTopicHref(topicSlug: string): string {
    const params = new URLSearchParams({ topic: topicSlug });
    return `/topics?${params.toString()}`;
}

export function buildShowcaseCaseHref(topicSlug: string, caseSlug: string): string {
    const params = new URLSearchParams({ topic: topicSlug, case: caseSlug });
    return `/topics?${params.toString()}`;
}

export function buildShowcaseWorkbenchHref(topicSlug: string, caseSlug: string): string {
    const params = new URLSearchParams({
        showcaseTopic: topicSlug,
        showcaseCase: caseSlug
    });
    return `/?${params.toString()}`;
}

export type ShowcaseDirectoryInputFilter = 'all' | 'none' | 'single' | 'multiple' | 'mask';

export type ShowcaseDirectoryFilters = {
    query?: string;
    input?: ShowcaseDirectoryInputFilter;
    tag?: string;
};

export function buildShowcaseDirectoryHref(filters: ShowcaseDirectoryFilters): string {
    const params = new URLSearchParams();
    const query = filters.query?.trim();
    const input = filters.input ?? 'all';
    const tag = filters.tag?.trim();
    if (query) params.set('q', query);
    if (input !== 'all') params.set('input', input);
    if (tag) params.set('tag', tag);
    const suffix = params.toString();
    return suffix ? `/topics?${suffix}` : '/topics';
}
