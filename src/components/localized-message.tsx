'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import type { TranslateParams } from '@/lib/i18n/translator';

type LocalizedMessageProps = {
    id: string;
    params?: TranslateParams;
};

export function LocalizedMessage({ id, params }: LocalizedMessageProps) {
    const { t } = useAppLanguage();
    return <>{t(id, params)}</>;
}
