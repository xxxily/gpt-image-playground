import {
    buildShowcaseCaseHref,
    buildShowcaseDirectoryHref,
    buildShowcaseTopicHref,
    buildShowcaseWorkbenchHref,
    getLocalizedShowcaseText,
    normalizeShowcaseDirectoryReturnHref
} from './showcase-navigation';
import { describe, expect, it } from 'vitest';

describe('showcase navigation', () => {
    it('builds static-export-compatible topic and case links', () => {
        expect(buildShowcaseTopicHref('old-photo-restoration')).toBe('/topics?topic=old-photo-restoration');
        expect(buildShowcaseCaseHref('old-photo-restoration', 'scratch-removal')).toBe(
            '/topics?topic=old-photo-restoration&case=scratch-removal'
        );
    });

    it('keeps a normalized directory return link across topic and case navigation', () => {
        const returnHref = '/topics?q=%E7%85%A7%E7%89%87&input=single&tag=%E6%96%B0%E6%89%8B&sort=easy';
        const topicHref = new URL(buildShowcaseTopicHref('old-photo-restoration', returnHref), 'https://example.com');
        const caseHref = new URL(
            buildShowcaseCaseHref('old-photo-restoration', 'scratch-removal', returnHref),
            'https://example.com'
        );

        expect(topicHref.searchParams.get('return')).toBe(returnHref);
        expect(caseHref.searchParams.get('return')).toBe(returnHref);
    });

    it('rejects unsafe return targets and strips detail-only parameters', () => {
        expect(normalizeShowcaseDirectoryReturnHref('https://evil.example/topics?q=photo')).toBe('/topics');
        expect(normalizeShowcaseDirectoryReturnHref('//evil.example/topics?q=photo')).toBe('/topics');
        expect(normalizeShowcaseDirectoryReturnHref('/topics?q=photo#case')).toBe('/topics');
        expect(normalizeShowcaseDirectoryReturnHref('/topics/other?q=photo')).toBe('/topics');
        expect(
            normalizeShowcaseDirectoryReturnHref(
                '/topics?topic=old-photo-restoration&case=scratch-removal&return=%2Ftopics%3Fq%3Dnested&q=photo&unknown=value'
            )
        ).toBe('/topics?q=photo');
    });

    it('normalizes unsupported filter values to directory defaults', () => {
        expect(
            normalizeShowcaseDirectoryReturnHref('/topics?input=invalid&sort=invalid&tag=%20%E6%96%B0%E6%89%8B%20')
        ).toBe('/topics?tag=%E6%96%B0%E6%89%8B');
    });

    it('builds a workbench handoff without an automatic submission flag', () => {
        const href = buildShowcaseWorkbenchHref('virtual-try-on', 'casual-top');
        expect(href).toBe('/?showcaseTopic=virtual-try-on&showcaseCase=casual-top');
        expect(href).not.toContain('autostart');
        expect(href).not.toContain('submit');
    });

    it('builds shareable directory filter links without empty defaults', () => {
        expect(
            buildShowcaseDirectoryHref({
                query: '照片 修复',
                input: 'single',
                tag: '新手',
                category: '修复',
                sort: 'easy'
            })
        ).toBe(
            '/topics?q=%E7%85%A7%E7%89%87+%E4%BF%AE%E5%A4%8D&input=single&tag=%E6%96%B0%E6%89%8B&category=%E4%BF%AE%E5%A4%8D&sort=easy'
        );
        expect(buildShowcaseDirectoryHref({ input: 'all' })).toBe('/topics');
    });

    it('selects catalog copy using the active application language', () => {
        const value = { 'zh-CN': '中文', 'en-US': 'English' };
        expect(getLocalizedShowcaseText(value, 'zh-CN')).toBe('中文');
        expect(getLocalizedShowcaseText(value, 'en-US')).toBe('English');
    });
});
