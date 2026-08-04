import {
    buildShowcaseCaseHref,
    buildShowcaseDirectoryHref,
    buildShowcaseTopicHref,
    buildShowcaseWorkbenchHref,
    getLocalizedShowcaseText
} from './showcase-navigation';
import { describe, expect, it } from 'vitest';

describe('showcase navigation', () => {
    it('builds static-export-compatible topic and case links', () => {
        expect(buildShowcaseTopicHref('old-photo-restoration')).toBe('/topics?topic=old-photo-restoration');
        expect(buildShowcaseCaseHref('old-photo-restoration', 'scratch-removal')).toBe(
            '/topics?topic=old-photo-restoration&case=scratch-removal'
        );
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
