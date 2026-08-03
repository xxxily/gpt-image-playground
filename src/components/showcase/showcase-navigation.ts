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
