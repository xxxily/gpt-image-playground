export const SUPPORTED_APP_LANGUAGES = ['zh-CN', 'en-US'] as const;

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'zh-CN';

export const APP_LANGUAGE_LABELS: Record<AppLanguage, { native: string; english: string }> = {
    'zh-CN': {
        native: '简体中文',
        english: 'Chinese (Simplified)'
    },
    'en-US': {
        native: 'English',
        english: 'English'
    }
};

export function normalizeAppLanguage(value: unknown): AppLanguage | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().replace('_', '-').toLowerCase();
    if (!normalized) return null;

    if (normalized === 'zh' || normalized.startsWith('zh-')) {
        return 'zh-CN';
    }
    if (normalized === 'en' || normalized.startsWith('en-')) {
        return 'en-US';
    }

    return null;
}

export function resolveInitialAppLanguage(
    storedLanguage?: unknown,
    runtimeLanguages?: readonly unknown[]
): AppLanguage {
    const stored = normalizeAppLanguage(storedLanguage);
    if (stored) return stored;

    for (const language of runtimeLanguages ?? []) {
        const normalized = normalizeAppLanguage(language);
        if (normalized) return normalized;
    }

    return DEFAULT_APP_LANGUAGE;
}

export function getRuntimeLanguageCandidates(): string[] {
    if (typeof navigator === 'undefined') return [];

    const candidates: string[] = [];
    if (Array.isArray(navigator.languages)) {
        candidates.push(...navigator.languages.filter((language): language is string => typeof language === 'string'));
    }
    if (typeof navigator.language === 'string') {
        candidates.push(navigator.language);
    }

    return candidates;
}

export function detectRuntimeAppLanguage(): AppLanguage {
    return resolveInitialAppLanguage(undefined, getRuntimeLanguageCandidates());
}

