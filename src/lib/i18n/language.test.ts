import { describe, expect, it } from 'vitest';
import {
    DEFAULT_APP_LANGUAGE,
    normalizeAppLanguage,
    resolveInitialAppLanguage
} from './language';

describe('app language normalization', () => {
    it('normalizes Chinese language variants to zh-CN', () => {
        expect(normalizeAppLanguage('zh')).toBe('zh-CN');
        expect(normalizeAppLanguage('zh-CN')).toBe('zh-CN');
        expect(normalizeAppLanguage('zh_Hans')).toBe('zh-CN');
        expect(normalizeAppLanguage('zh-TW')).toBe('zh-CN');
        expect(normalizeAppLanguage('zh-HK')).toBe('zh-CN');
    });

    it('normalizes English language variants to en-US', () => {
        expect(normalizeAppLanguage('en')).toBe('en-US');
        expect(normalizeAppLanguage('en-US')).toBe('en-US');
        expect(normalizeAppLanguage('en_GB')).toBe('en-US');
    });

    it('rejects unsupported values', () => {
        expect(normalizeAppLanguage('ja-JP')).toBeNull();
        expect(normalizeAppLanguage('')).toBeNull();
        expect(normalizeAppLanguage(null)).toBeNull();
    });

    it('prefers stored language before runtime candidates', () => {
        expect(resolveInitialAppLanguage('en-US', ['zh-CN'])).toBe('en-US');
        expect(resolveInitialAppLanguage(undefined, ['fr-FR', 'zh-TW'])).toBe('zh-CN');
        expect(resolveInitialAppLanguage(undefined, ['fr-FR'])).toBe(DEFAULT_APP_LANGUAGE);
    });
});

