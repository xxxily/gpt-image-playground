'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useMessage } from '@/components/notice-provider';
import { usePublicRuntimeConfig } from '@/components/public-runtime-config-provider';
import { CONFIGURATION_REQUIRED_ACTION_KEY, CONFIGURATION_REQUIRED_MESSAGE_KEY } from '@/lib/configuration-guidance';
import { isTauriDesktop, openExternalUrl } from '@/lib/desktop-runtime';
import { cn } from '@/lib/utils';
import * as React from 'react';

type ConfigurationRequiredActionsProps = {
    onConfigure?: () => void;
    className?: string;
    messageClassName?: string;
    actionClassName?: string;
    stopPropagation?: boolean;
};

export function ConfigurationRequiredActions({
    onConfigure,
    className,
    messageClassName,
    actionClassName,
    stopPropagation = false
}: ConfigurationRequiredActionsProps) {
    const { t } = useAppLanguage();
    const { addNotice } = useMessage();
    const { config } = usePublicRuntimeConfig();
    const purchaseCta = config.apiKeyPurchaseCta;

    const handleConfigure = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (stopPropagation) event.stopPropagation();
        onConfigure?.();
    };

    const handlePurchase = async (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (stopPropagation) event.stopPropagation();
        if (!purchaseCta) return;
        if (!isTauriDesktop()) return;
        event.preventDefault();
        try {
            await openExternalUrl(purchaseCta.url);
        } catch {
            addNotice(t('configuration.purchaseCta.openFailed'), 'error');
        }
    };

    const textButtonClassName = cn(
        'shrink-0 rounded px-0.5 font-medium underline underline-offset-2 focus-visible:ring-1 focus-visible:ring-current focus-visible:outline-none',
        actionClassName
    );

    return (
        <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
            <span className={messageClassName}>{t(CONFIGURATION_REQUIRED_MESSAGE_KEY)}</span>
            {onConfigure && (
                <button type='button' onClick={handleConfigure} className={textButtonClassName}>
                    {t(CONFIGURATION_REQUIRED_ACTION_KEY)}
                </button>
            )}
            {purchaseCta && (
                <a
                    href={purchaseCta.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={handlePurchase}
                    className={textButtonClassName}
                    aria-label={purchaseCta.label}
                    data-i18n-skip='true'>
                    {purchaseCta.label}
                </a>
            )}
        </span>
    );
}
