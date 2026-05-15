'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import * as React from 'react';

export function DocumentLanguageMetaSync() {
    const { language, t } = useAppLanguage();

    React.useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dataset.appLanguage = language;
        document.title = t('app.title');

        let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (!description) {
            description = document.createElement('meta');
            description.name = 'description';
            document.head.appendChild(description);
        }
        description.content = t('app.description');
    }, [language, t]);

    return null;
}

