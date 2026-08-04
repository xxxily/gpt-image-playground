import type { AppLanguage } from '@/lib/i18n/language';
import type { ShowcaseLocalizedText } from '@/lib/showcase';

export function getLocalizedShowcaseText(value: ShowcaseLocalizedText, language: AppLanguage): string {
    return value[language] ?? value['zh-CN'] ?? value['en-US'];
}

function appendShowcaseReturnHref(params: URLSearchParams, returnHref?: string): void {
    const normalized = normalizeShowcaseDirectoryReturnHref(returnHref);
    if (normalized !== '/topics') params.set('return', normalized);
}

export function buildShowcaseTopicHref(topicSlug: string, returnHref?: string): string {
    const params = new URLSearchParams({ topic: topicSlug });
    appendShowcaseReturnHref(params, returnHref);
    return `/topics?${params.toString()}`;
}

export function buildShowcaseCaseHref(topicSlug: string, caseSlug: string, returnHref?: string): string {
    const params = new URLSearchParams({ topic: topicSlug, case: caseSlug });
    appendShowcaseReturnHref(params, returnHref);
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
export type ShowcaseDirectorySort = 'recommended' | 'latest' | 'easy';

export type ShowcaseDirectoryFilters = {
    query?: string;
    input?: ShowcaseDirectoryInputFilter;
    tag?: string;
    category?: string;
    sort?: ShowcaseDirectorySort;
};

export function buildShowcaseDirectoryHref(filters: ShowcaseDirectoryFilters): string {
    const params = new URLSearchParams();
    const query = filters.query?.trim();
    const input = filters.input ?? 'all';
    const tag = filters.tag?.trim();
    const category = filters.category?.trim();
    const sort = filters.sort ?? 'recommended';
    if (query) params.set('q', query);
    if (input !== 'all') params.set('input', input);
    if (tag) params.set('tag', tag);
    if (category) params.set('category', category);
    if (sort !== 'recommended') params.set('sort', sort);
    const suffix = params.toString();
    return suffix ? `/topics?${suffix}` : '/topics';
}

/**
 * Keep directory state across topic/case navigation without accepting an
 * arbitrary redirect target. Unknown keys, nested detail links, hashes, and
 * cross-origin URLs are discarded.
 */
export function normalizeShowcaseDirectoryReturnHref(value?: string | null): string {
    if (!value || !value.startsWith('/topics') || value.startsWith('//')) return '/topics';
    try {
        const parsed = new URL(value, 'https://showcase.local');
        if (parsed.origin !== 'https://showcase.local' || parsed.pathname !== '/topics' || parsed.hash)
            return '/topics';
        const input = parsed.searchParams.get('input');
        const sort = parsed.searchParams.get('sort');
        return buildShowcaseDirectoryHref({
            query: parsed.searchParams.get('q') ?? undefined,
            input: ['all', 'none', 'single', 'multiple', 'mask'].includes(input ?? '')
                ? (input as ShowcaseDirectoryInputFilter)
                : 'all',
            tag: parsed.searchParams.get('tag') ?? undefined,
            category: parsed.searchParams.get('category') ?? undefined,
            sort: ['recommended', 'latest', 'easy'].includes(sort ?? '')
                ? (sort as ShowcaseDirectorySort)
                : 'recommended'
        });
    } catch {
        return '/topics';
    }
}
