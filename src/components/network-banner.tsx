'use client';

import { useNetworkStatus } from '@/lib/network-status';
import { useAppLanguage } from '@/components/app-language-provider';
import { WifiOff } from 'lucide-react';
import * as React from 'react';

export function NetworkBanner() {
    const { online, supported } = useNetworkStatus();
    const { t } = useAppLanguage();

    if (!supported || online) return null;

    return (
        <div
            role='status'
            aria-live='polite'
            className='sticky top-0 z-50 flex w-full items-center justify-center gap-2 border-b border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-700 backdrop-blur-sm dark:text-amber-200'>
            <WifiOff className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
            <span>{t('network.offlineBanner')}</span>
        </div>
    );
}
