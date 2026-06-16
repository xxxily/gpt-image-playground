'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import {
    testProviderConnection,
    type ConnectionFailureReason,
    type ConnectionTestResult,
    type ConnectionProviderKind
} from '@/lib/provider-connection-test';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, PlugZap, XCircle } from 'lucide-react';
import * as React from 'react';

const RESULT_VISIBLE_MS = 60_000;

type ProviderConnectionTestButtonProps = {
    kind: ConnectionProviderKind;
    baseUrl: string;
    apiKey: string;
    disabled?: boolean;
    className?: string;
};

function reasonI18nKey(reason: ConnectionFailureReason): string {
    return `settings.connectionTest.reason.${reason}`;
}

function detailI18nKey(reason: ConnectionFailureReason): string {
    return `settings.connectionTest.detail.${reason}`;
}

export function ProviderConnectionTestButton({
    kind,
    baseUrl,
    apiKey,
    disabled,
    className
}: ProviderConnectionTestButtonProps) {
    const { t } = useAppLanguage();
    const [pending, setPending] = React.useState(false);
    const [result, setResult] = React.useState<ConnectionTestResult | null>(null);
    const timerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        setResult(null);
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, [kind, baseUrl, apiKey]);

    const handleClick = React.useCallback(async () => {
        if (pending) return;
        setPending(true);
        setResult(null);
        try {
            const next = await testProviderConnection({ kind, baseUrl, apiKey });
            setResult(next);
            if (timerRef.current !== null) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => setResult(null), RESULT_VISIBLE_MS);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setResult({ ok: false, reason: 'unknown', message });
        } finally {
            setPending(false);
        }
    }, [apiKey, baseUrl, kind, pending]);

    const trimmedKey = apiKey.trim();
    const buttonDisabled = disabled || pending || trimmedKey.length === 0;

    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
            <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={buttonDisabled}
                onClick={handleClick}
                aria-label={t('settings.connectionTest.button')}
                className='h-9 gap-2 rounded-xl px-3 text-xs'>
                {pending ? (
                    <Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
                ) : (
                    <PlugZap className='h-4 w-4' aria-hidden='true' />
                )}
                {pending ? t('settings.connectionTest.testing') : t('settings.connectionTest.button')}
            </Button>
            {result && <ConnectionTestBadge result={result} />}
        </div>
    );
}

function ConnectionTestBadge({ result }: { result: ConnectionTestResult }) {
    const { t } = useAppLanguage();

    if (result.ok) {
        const detailParts: string[] = [t('settings.connectionTest.latency', { ms: String(result.latencyMs) })];
        if (typeof result.modelsFound === 'number') {
            detailParts.push(t('settings.connectionTest.modelsFound', { count: String(result.modelsFound) }));
        }
        return (
            <span
                className='inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300'
                role='status'
                aria-live='polite'>
                <CheckCircle2 className='h-3.5 w-3.5' aria-hidden='true' />
                <span>{t('settings.connectionTest.ok')}</span>
                <span className='text-emerald-700/70 dark:text-emerald-300/70'>{detailParts.join(' · ')}</span>
                {result.note && (
                    <span className='ml-1 text-emerald-700/70 dark:text-emerald-300/70'>{result.note}</span>
                )}
            </span>
        );
    }

    return (
        <span
            className='inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300'
            role='status'
            aria-live='polite'>
            <XCircle className='h-3.5 w-3.5' aria-hidden='true' />
            <span>{t(reasonI18nKey(result.reason))}</span>
            <span className='text-red-700/70 dark:text-red-300/70'>
                {result.reason === 'cors' ? t(detailI18nKey(result.reason)) : result.message}
            </span>
        </span>
    );
}
