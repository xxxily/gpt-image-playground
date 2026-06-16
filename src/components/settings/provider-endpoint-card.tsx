'use client';

import { LocalizedMessage } from '@/components/localized-message';
import { ProviderConnectionTestButton } from '@/components/provider-connection-test-button';
import { SecretInput } from '@/components/settings/secret-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { ConnectionProviderKind } from '@/lib/provider-connection-test';
import { getDefaultProviderInstanceName } from '@/lib/provider-instances';
import type { ProviderEndpoint } from '@/lib/provider-model-catalog';
import { ChevronDown, RefreshCw, Trash2 } from 'lucide-react';
import * as React from 'react';

type Translate = (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;

type ProviderEndpointCardProps = {
    endpoint: ProviderEndpoint;
    apiKeyVisible: boolean;
    onApiKeyVisibleChange: () => void;
    onNameChange: (value: string) => void;
    onApiKeyChange: (value: string) => void;
    onBaseUrlChange: (value: string) => void;
    onManageModels: () => void;
    onRemove: () => void;
    removeDisabled?: boolean;
    loading?: boolean;
    statusMessage?: string;
    statusTone?: 'success' | 'error' | 'info';
    selectedModelCount: number;
    totalModelCount: number;
    summaryDescription: string;
    badges?: React.ReactNode;
    extraActions?: React.ReactNode;
    t: Translate;
};

function getConnectionTestKind(endpoint: ProviderEndpoint): ConnectionProviderKind | null {
    if (endpoint.provider === 'google-gemini') return 'gemini';
    if (endpoint.provider === 'volcengine-ark') return 'seedream';
    if (endpoint.provider === 'sensenova') return 'sensenova';
    if (
        endpoint.provider === 'openai' ||
        endpoint.provider === 'openai-compatible' ||
        endpoint.protocol === 'openai-chat-completions' ||
        endpoint.protocol === 'openai-responses' ||
        endpoint.protocol === 'openai-images' ||
        endpoint.protocol === 'openai-videos' ||
        endpoint.protocol === 'ark-openai-compatible'
    ) {
        return 'openai-compatible';
    }
    return null;
}

export function ProviderEndpointCard({
    endpoint,
    apiKeyVisible,
    onApiKeyVisibleChange,
    onNameChange,
    onApiKeyChange,
    onBaseUrlChange,
    onManageModels,
    onRemove,
    removeDisabled,
    loading,
    statusMessage,
    statusTone,
    selectedModelCount,
    totalModelCount,
    summaryDescription,
    badges,
    extraActions,
    t
}: ProviderEndpointCardProps) {
    const [detailsOpen, setDetailsOpen] = React.useState(true);
    const nameEditingRef = React.useRef(false);
    const fallbackName = endpoint.legacyImageProvider
        ? getDefaultProviderInstanceName(endpoint.legacyImageProvider, endpoint.apiBaseUrl)
        : endpoint.id;
    const [nameDraft, setNameDraft] = React.useState(endpoint.name || fallbackName);
    const connectionTestKind = getConnectionTestKind(endpoint);

    React.useEffect(() => {
        if (!nameEditingRef.current) {
            setNameDraft(endpoint.name || fallbackName);
        }
    }, [endpoint.name, fallbackName]);

    return (
        <article className='border-border bg-background/70 space-y-4 rounded-2xl border p-4 shadow-sm'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0 flex-1 space-y-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Input
                            value={nameDraft}
                            onFocus={() => {
                                nameEditingRef.current = true;
                            }}
                            onBlur={() => {
                                nameEditingRef.current = false;
                                const trimmed = nameDraft.trim();
                                const nextName = trimmed || fallbackName;
                                setNameDraft(nextName);
                                onNameChange(nextName);
                            }}
                            onChange={(event) => {
                                const nextValue = event.target.value;
                                setNameDraft(nextValue);
                                onNameChange(nextValue);
                            }}
                            placeholder={endpoint.id}
                            className='bg-background text-foreground h-9 rounded-xl text-sm font-semibold sm:max-w-xs'
                        />
                        {badges}
                    </div>
                    <p className='text-muted-foreground truncate text-xs'>
                        <span className='font-mono'>{endpoint.id}</span>
                        {' · '}
                        {endpoint.protocol}
                    </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    {extraActions}
                    {connectionTestKind && (
                        <ProviderConnectionTestButton
                            kind={connectionTestKind}
                            baseUrl={endpoint.apiBaseUrl}
                            apiKey={endpoint.apiKey}
                            disabled={loading}
                        />
                    )}
                    <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={() => setDetailsOpen((value) => !value)}
                        className='text-muted-foreground hover:bg-accent hover:text-foreground h-9 w-9'
                        aria-label={detailsOpen ? t('settings.endpoints.collapse') : t('settings.endpoints.expand')}
                        aria-expanded={detailsOpen}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
                    </Button>
                    <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={onManageModels}
                        disabled={loading}
                        className='min-h-[36px] rounded-xl'>
                        {loading ? <Spinner size='md' /> : <RefreshCw className='h-4 w-4' />}
                        {t('settings.modelManager.fetchButton')}
                    </Button>
                    <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        onClick={onRemove}
                        disabled={removeDisabled}
                        className='text-muted-foreground h-9 w-9 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-45'
                        aria-label={t('settings.endpoints.deleteEndpoint', { name: endpoint.name })}>
                        <Trash2 className='h-4 w-4' />
                    </Button>
                </div>
            </div>
            {statusMessage && (
                <p
                    className={`text-xs ${statusTone === 'error' ? 'text-red-600 dark:text-red-300' : statusTone === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                    {statusMessage}
                </p>
            )}
            {detailsOpen && (
                <>
                    <div className='grid gap-3 lg:grid-cols-2'>
                        <div className='space-y-2'>
                            <Label className='text-muted-foreground text-xs'>
                                <LocalizedMessage id='phase4b.apiKey' />
                            </Label>
                            <SecretInput
                                id={`provider-endpoint-key-${endpoint.id}`}
                                value={endpoint.apiKey}
                                onChange={onApiKeyChange}
                                visible={apiKeyVisible}
                                onVisibleChange={onApiKeyVisibleChange}
                                placeholder={t('phase4b.apiKey')}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label className='text-muted-foreground text-xs'>
                                <LocalizedMessage id='phase4b.apiBaseUrl' />
                            </Label>
                            <Input
                                value={endpoint.apiBaseUrl}
                                onChange={(event) => onBaseUrlChange(event.target.value)}
                                placeholder='https://api.openai.com/v1'
                                className='bg-background text-foreground h-10 rounded-xl'
                            />
                        </div>
                    </div>
                    <div className='border-border bg-muted/20 text-muted-foreground flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs'>
                        <span>
                            {t('settings.modelManager.summaryCount', {
                                selected: selectedModelCount,
                                total: totalModelCount
                            })}
                        </span>
                        <span>{summaryDescription}</span>
                    </div>
                </>
            )}
        </article>
    );
}
