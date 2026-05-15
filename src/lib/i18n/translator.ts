import type { AppLanguage } from './language';
import { DEFAULT_APP_LANGUAGE } from './language';
import { APP_MESSAGES } from './messages';

export type TranslateParams = Record<string, string | number | boolean | null | undefined>;

export function translateMessage(language: AppLanguage, key: string, params?: TranslateParams): string {
    const template = APP_MESSAGES[language][key] ?? APP_MESSAGES[DEFAULT_APP_LANGUAGE][key] ?? key;
    if (!params) return template;

    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramKey: string) => {
        const value = params[paramKey];
        return value === undefined || value === null ? match : String(value);
    });
}

export function getMessageKeySet(language: AppLanguage): Set<string> {
    return new Set(Object.keys(APP_MESSAGES[language]));
}

