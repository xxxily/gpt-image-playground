'use client';

import {
    CONFIG_CHANGED_EVENT,
    loadConfig,
    saveConfig
} from '@/lib/config';
import {
    APP_LANGUAGE_LABELS,
    DEFAULT_APP_LANGUAGE,
    detectRuntimeAppLanguage,
    normalizeAppLanguage,
    type AppLanguage
} from '@/lib/i18n/language';
import { getDocumentAppLanguage } from '@/lib/i18n/initializer';
import { translateMessage, type TranslateParams } from '@/lib/i18n/translator';
import * as React from 'react';

type AppLanguageContextValue = {
    language: AppLanguage;
    setLanguage: (language: AppLanguage) => void;
    t: (key: string, params?: TranslateParams) => string;
    formatDateTime: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    languageLabels: typeof APP_LANGUAGE_LABELS;
};

const AppLanguageContext = React.createContext<AppLanguageContextValue | null>(null);

export function useAppLanguage(): AppLanguageContextValue {
    const context = React.useContext(AppLanguageContext);
    if (context) return context;

    return {
        language: DEFAULT_APP_LANGUAGE,
        setLanguage: () => undefined,
        t: (key, params) => translateMessage(DEFAULT_APP_LANGUAGE, key, params),
        formatDateTime: (value, options) => new Intl.DateTimeFormat(DEFAULT_APP_LANGUAGE, options).format(new Date(value)),
        formatNumber: (value, options) => new Intl.NumberFormat(DEFAULT_APP_LANGUAGE, options).format(value),
        languageLabels: APP_LANGUAGE_LABELS
    };
}

export function AppLanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = React.useState<AppLanguage>(() =>
        normalizeAppLanguage(getDocumentAppLanguage()) ?? DEFAULT_APP_LANGUAGE
    );

    React.useEffect(() => {
        const config = loadConfig();
        setLanguageState(config.appLanguage);
    }, []);

    React.useEffect(() => {
        const updateFromConfig = () => {
            const config = loadConfig();
            setLanguageState(config.appLanguage);
        };
        window.addEventListener(CONFIG_CHANGED_EVENT, updateFromConfig);
        return () => window.removeEventListener(CONFIG_CHANGED_EVENT, updateFromConfig);
    }, []);

    React.useEffect(() => {
        const root = document.documentElement;
        root.lang = language;
        root.dataset.appLanguage = language;
    }, [language]);

    const setLanguage = React.useCallback((nextLanguage: AppLanguage) => {
        const normalized = normalizeAppLanguage(nextLanguage) ?? detectRuntimeAppLanguage();
        setLanguageState(normalized);
        saveConfig({ appLanguage: normalized });
    }, []);

    const value = React.useMemo<AppLanguageContextValue>(() => ({
        language,
        setLanguage,
        t: (key, params) => translateMessage(language, key, params),
        formatDateTime: (value, options) => new Intl.DateTimeFormat(language, options).format(new Date(value)),
        formatNumber: (value, options) => new Intl.NumberFormat(language, options).format(value),
        languageLabels: APP_LANGUAGE_LABELS
    }), [language, setLanguage]);

    return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

