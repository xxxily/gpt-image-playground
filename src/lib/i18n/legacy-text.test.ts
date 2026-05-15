import { describe, expect, it } from 'vitest';
import { translateLegacyUiString } from './legacy-text';

describe('legacy UI text bridge', () => {
    it('translates exact legacy labels', () => {
        expect(translateLegacyUiString('系统配置')).toBe('System Settings');
        expect(translateLegacyUiString('开始生成')).toBe('Generate');
    });

    it('translates common dynamic legacy labels', () => {
        expect(translateLegacyUiString('查看源图片 2')).toBe('View source image 2');
        expect(translateLegacyUiString('最近 7 天图片')).toBe('Images from the last 7 days');
    });

    it('leaves unknown strings to React resources', () => {
        expect(translateLegacyUiString('some provider value')).toBeNull();
    });
});

