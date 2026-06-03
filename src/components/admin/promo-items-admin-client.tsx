'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    buildPromoAspectRatio,
    getPromoConstraintChips,
    serializePromoAspectRatioCss,
    type PromoAspectRatio,
    type PromoAspectRatioSource
} from '@/lib/promo';
import { cn } from '@/lib/utils';
import { Copy, Edit3, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

type PromoDevice = 'all' | 'desktop' | 'mobile';

type PromoConfig = {
    id: string;
    name: string;
    scope: 'global' | 'share';
    slotKey?: string | null;
    aspectRatioWidth?: number | null;
    aspectRatioHeight?: number | null;
    aspectRatioLabel?: string | null;
    aspectRatioSource?: PromoAspectRatioSource | null;
    constraintsJson?: string | null;
};

export type AdminPromoItemDetail = {
    id: string;
    configId: string;
    title: string;
    alt: string;
    desktopImageUrl: string;
    mobileImageUrl: string;
    linkUrl: string;
    device: PromoDevice;
    enabled: boolean;
    sortOrder: number;
    weight: number;
    startsAt: string | null;
    endsAt: string | null;
    createdAt: string;
    updatedAt: string;
};

type PromoItemsAdminClientProps = {
    config: PromoConfig;
    initialItems: AdminPromoItemDetail[];
};

type ItemDraft = {
    id: string;
    title: string;
    alt: string;
    desktopImageUrl: string;
    mobileImageUrl: string;
    linkUrl: string;
    device: PromoDevice;
    enabled: boolean;
    sortOrder: string;
    weight: string;
    startsAt: string;
    endsAt: string;
};

const emptyItemDraft: ItemDraft = {
    id: '',
    title: '',
    alt: '',
    desktopImageUrl: '',
    mobileImageUrl: '',
    linkUrl: '',
    device: 'all',
    enabled: true,
    sortOrder: '0',
    weight: '100',
    startsAt: '',
    endsAt: ''
};

function toDateTimeInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string): string | null {
    return value ? new Date(value).toISOString() : null;
}

async function requestJson<T>(url: string, init?: RequestInit, fallbackError = 'Operation failed.'): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: {
            'content-type': 'application/json',
            ...(init?.headers || {})
        }
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
        const errorMessage =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
                ? (payload as { error: string }).error || fallbackError
                : fallbackError;
        throw new Error(errorMessage);
    }
    return payload as T;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='space-y-2'>
            <Label className='text-muted-foreground text-xs font-medium'>{label}</Label>
            {children}
        </div>
    );
}

function StatusPill({ active }: { active: boolean }) {
    const { t } = useAppLanguage();
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
            )}>
            {active ? t('phase4b.enable') : t('phase4b.disable')}
        </span>
    );
}

function ConstraintChips({
    constraintsJson,
    allDomainsLabel
}: {
    constraintsJson?: string | null;
    allDomainsLabel: string;
}) {
    const chips = getPromoConstraintChips(constraintsJson);
    if (chips.length === 0) return <span className='text-muted-foreground text-xs'>{allDomainsLabel}</span>;
    return (
        <div className='flex min-w-0 flex-wrap gap-1.5'>
            {chips.map((chip) => (
                <span
                    key={`${chip.type}-${chip.id}`}
                    className={cn(
                        'inline-flex max-w-full rounded-md px-2 py-1 text-xs font-medium',
                        chip.severity === 'warning'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                            : 'bg-muted text-muted-foreground'
                    )}
                    title={`${chip.label}: ${chip.summary}`}>
                    <span className='truncate'>{chip.summary}</span>
                </span>
            ))}
        </div>
    );
}

export function PromoItemsAdminClient({ config, initialItems }: PromoItemsAdminClientProps) {
    const { t } = useAppLanguage();
    const [items, setItems] = React.useState(initialItems);
    const [draft, setDraft] = React.useState<ItemDraft>(emptyItemDraft);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');
    const configAspectRatio = React.useMemo<PromoAspectRatio>(
        () =>
            buildPromoAspectRatio(
                config.aspectRatioWidth,
                config.aspectRatioHeight,
                config.aspectRatioLabel,
                config.aspectRatioSource,
                config.slotKey
            ),
        [
            config.aspectRatioHeight,
            config.aspectRatioLabel,
            config.aspectRatioSource,
            config.aspectRatioWidth,
            config.slotKey
        ]
    );
    const previewAspectRatio = serializePromoAspectRatioCss(configAspectRatio);
    const hasDraftImageUrl = Boolean(draft.desktopImageUrl.trim() || draft.mobileImageUrl.trim());

    const reload = React.useCallback(async () => {
        const payload = await requestJson<{ items: AdminPromoItemDetail[] }>('/api/admin/promo/items');
        setItems(payload.items.filter((item) => item.configId === config.id));
    }, [config.id]);

    const runMutation = async (key: string, action: () => Promise<void>) => {
        setBusyKey(key);
        setError('');
        setMessage('');
        try {
            await action();
            await reload();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.publicActions.notice.failed'));
        } finally {
            setBusyKey('');
        }
    };

    const saveItem = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runMutation('item-save', async () => {
            const body = {
                configId: config.id,
                title: draft.title,
                alt: draft.alt,
                desktopImageUrl: draft.desktopImageUrl,
                mobileImageUrl: draft.mobileImageUrl,
                linkUrl: draft.linkUrl,
                device: draft.device,
                enabled: draft.enabled,
                sortOrder: Number(draft.sortOrder || 0),
                weight: Number(draft.weight || 100),
                startsAt: fromDateTimeInput(draft.startsAt),
                endsAt: fromDateTimeInput(draft.endsAt)
            };
            if (draft.id) {
                await requestJson(`/api/admin/promo/items/${draft.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(body)
                });
                setMessage(t('phase4b.assetUpdated'));
            } else {
                await requestJson('/api/admin/promo/items', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setMessage(t('phase4b.assetCreated'));
            }
            setDraft(emptyItemDraft);
        });
    };

    const startEdit = (item: AdminPromoItemDetail) => {
        setDraft({
            id: item.id,
            title: item.title,
            alt: item.alt,
            desktopImageUrl: item.desktopImageUrl,
            mobileImageUrl: item.mobileImageUrl,
            linkUrl: item.linkUrl,
            device: item.device,
            enabled: item.enabled,
            sortOrder: String(item.sortOrder),
            weight: String(item.weight),
            startsAt: toDateTimeInput(item.startsAt),
            endsAt: toDateTimeInput(item.endsAt)
        });
        setError('');
        setMessage('');
    };

    const duplicateItem = async (item: AdminPromoItemDetail) => {
        await runMutation(`item-copy-${item.id}`, async () => {
            await requestJson('/api/admin/promo/items', {
                method: 'POST',
                body: JSON.stringify({
                    configId: config.id,
                    title: item.title ? t('phase4b.assetCopyName', { title: item.title }) : '',
                    alt: item.alt,
                    desktopImageUrl: item.desktopImageUrl,
                    mobileImageUrl: item.mobileImageUrl,
                    linkUrl: item.linkUrl,
                    device: item.device,
                    enabled: false,
                    sortOrder: item.sortOrder + 1,
                    weight: item.weight,
                    startsAt: item.startsAt,
                    endsAt: item.endsAt
                })
            });
            setMessage(t('phase4b.assetCopyCreated'));
        });
    };

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <Heading level={1} size='section'>
                        <LocalizedMessage id='phase4b.manageAssets' />
                    </Heading>
                    <p className='text-muted-foreground mt-1 text-sm'>
                        {config.name} /{' '}
                        {config.scope === 'share' ? t('phase4b.shareDisplayGroup') : t('phase4b.globalDisplayGroup')}
                    </p>
                </div>
                <Button asChild variant='outline'>
                    <Link href={`/admin/promo?scope=${config.scope}`}>
                        <LocalizedMessage id='phase4b.backToDisplayGroup' />
                    </Link>
                </Button>
            </div>

            {error && (
                <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>
                    {error}
                </div>
            )}
            {message && (
                <div className='rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'>
                    {message}
                </div>
            )}

            <div className='grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]'>
                <Card className='xl:sticky xl:top-6 xl:self-start'>
                    <CardHeader>
                        <CardTitle>{draft.id ? t('phase4b.editAsset') : t('phase4b.newAsset')}</CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.assetsBelongOnlyToTheCurrentDisplayGroup' />
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className='border-panel-divider bg-panel-ghost mb-4 rounded-md border p-3'>
                            <div className='text-foreground text-sm font-medium'>
                                {t('promo.aspectRatio.currentItemsTitle')}
                            </div>
                            <div className='mt-2 grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3'>
                                <p className='text-muted-foreground text-xs leading-5'>
                                    {t('promo.aspectRatio.currentItemsDescription')}
                                </p>
                                <div>
                                    <div
                                        className='border-panel-divider bg-background rounded border'
                                        style={{ aspectRatio: previewAspectRatio }}
                                        aria-hidden='true'
                                    />
                                    <p
                                        className='text-muted-foreground mt-1 text-center font-mono text-xs'
                                        data-i18n-skip='true'>
                                        {configAspectRatio.label}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className='border-panel-divider bg-panel-ghost mb-4 rounded-md border p-3'>
                            <div className='text-foreground text-sm font-medium'>
                                {t('promo.constraints.currentItemsTitle')}
                            </div>
                            <div className='mt-2'>
                                <ConstraintChips
                                    constraintsJson={config.constraintsJson}
                                    allDomainsLabel={t('promo.constraints.allDomains')}
                                />
                            </div>
                        </div>
                        <form onSubmit={saveItem} className='space-y-3'>
                            <Field label={t('phase4b.title')}>
                                <Input
                                    value={draft.title}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, title: event.target.value }))
                                    }
                                />
                            </Field>
                            <Field label={t('phase4b.altText')}>
                                <Input
                                    value={draft.alt}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, alt: event.target.value }))
                                    }
                                />
                            </Field>
                            <Field label={t('phase4b.desktopImageUrl')}>
                                <Input
                                    value={draft.desktopImageUrl}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, desktopImageUrl: event.target.value }))
                                    }
                                    placeholder={t('phase4b.bannerBannerWebpOr')}
                                />
                            </Field>
                            <Field label={t('phase4b.mobileImageUrl')}>
                                <Input
                                    value={draft.mobileImageUrl}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, mobileImageUrl: event.target.value }))
                                    }
                                    placeholder={t('promo.items.mobileImagePlaceholder')}
                                />
                            </Field>
                            <Field label={t('phase4b.clickUrl')}>
                                <Input
                                    value={draft.linkUrl}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, linkUrl: event.target.value }))
                                    }
                                    placeholder={t('promo.items.linkUrlPlaceholder')}
                                />
                            </Field>
                            <div className='grid grid-cols-3 gap-3'>
                                <Field label={t('phase4b.device')}>
                                    <select
                                        className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                        value={draft.device}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                device: event.target.value as PromoDevice
                                            }))
                                        }>
                                        <option value='all'>{t('phase4b.allDevices')}</option>
                                        <option value='desktop'>{t('phase4b.desktopDevice')}</option>
                                        <option value='mobile'>{t('phase4b.mobileDevice')}</option>
                                    </select>
                                </Field>
                                <Field label={t('admin.publicActions.field.sortOrder')}>
                                    <Input
                                        type='number'
                                        value={draft.sortOrder}
                                        onChange={(event) =>
                                            setDraft((current) => ({ ...current, sortOrder: event.target.value }))
                                        }
                                    />
                                </Field>
                                <Field label={t('phase4b.weight')}>
                                    <Input
                                        type='number'
                                        min={0}
                                        value={draft.weight}
                                        onChange={(event) =>
                                            setDraft((current) => ({ ...current, weight: event.target.value }))
                                        }
                                    />
                                </Field>
                            </div>
                            <div className='grid grid-cols-2 gap-3'>
                                <Field label={t('phase4b.start')}>
                                    <Input
                                        type='datetime-local'
                                        value={draft.startsAt}
                                        onChange={(event) =>
                                            setDraft((current) => ({ ...current, startsAt: event.target.value }))
                                        }
                                    />
                                </Field>
                                <Field label={t('phase4b.end')}>
                                    <Input
                                        type='datetime-local'
                                        value={draft.endsAt}
                                        onChange={(event) =>
                                            setDraft((current) => ({ ...current, endsAt: event.target.value }))
                                        }
                                    />
                                </Field>
                            </div>
                            <label className='flex items-center gap-2 text-sm'>
                                <input
                                    type='checkbox'
                                    checked={draft.enabled}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, enabled: event.target.checked }))
                                    }
                                />
                                <LocalizedMessage id='phase4b.enableAsset' />
                            </label>
                            <div className='flex gap-2'>
                                <Button type='submit' disabled={busyKey === 'item-save' || !hasDraftImageUrl}>
                                    {busyKey === 'item-save' ? (
                                        <Loader2 className='size-4 animate-spin' />
                                    ) : draft.id ? (
                                        <Save className='size-4' />
                                    ) : (
                                        <Plus className='size-4' />
                                    )}
                                    {draft.id ? t('phase4b.saveAsset') : t('phase4b.newAsset')}
                                </Button>
                                {draft.id && (
                                    <Button type='button' variant='outline' onClick={() => setDraft(emptyItemDraft)}>
                                        <LocalizedMessage id='phase4b.cancelEditing' />
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            <LocalizedMessage id='phase4b.assetList' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.currentDisplayGroupHas' /> {items.length}{' '}
                            <LocalizedMessage id='phase4b.assets' />
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className='grid gap-3 rounded-md border p-3 sm:grid-cols-[160px_minmax(0,1fr)]'>
                                <div className='bg-muted overflow-hidden rounded-md'>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- Admin previews accept arbitrary external creative URLs. */}
                                    <img
                                        src={item.desktopImageUrl}
                                        alt={item.alt || item.title || t('phase4b.promoImageAlt')}
                                        className='h-full w-full object-contain'
                                        style={{ aspectRatio: previewAspectRatio }}
                                        loading='lazy'
                                    />
                                </div>
                                <div className='min-w-0 space-y-2'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <div className='min-w-0'>
                                            <p className='truncate text-sm font-semibold' data-i18n-skip='true'>
                                                {item.title || item.desktopImageUrl || item.mobileImageUrl}
                                            </p>
                                            {item.linkUrl && (
                                                <p
                                                    className='text-muted-foreground truncate text-xs'
                                                    data-i18n-skip='true'>
                                                    {item.linkUrl}
                                                </p>
                                            )}
                                        </div>
                                        <StatusPill active={item.enabled} />
                                    </div>
                                    <div className='text-muted-foreground flex flex-wrap gap-2 text-xs'>
                                        <span>
                                            {item.device === 'all'
                                                ? t('phase4b.allDevices')
                                                : item.device === 'desktop'
                                                  ? t('phase4b.desktopDevice')
                                                  : t('phase4b.mobileDevice')}
                                        </span>
                                        <span>
                                            {t('admin.publicActions.field.sortOrder')} {item.sortOrder}
                                        </span>
                                        <span>
                                            {t('phase4b.weight')} {item.weight}
                                        </span>
                                    </div>
                                    <div className='flex flex-wrap justify-end gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() => startEdit(item)}>
                                            <Edit3 className='size-4' />
                                            <LocalizedMessage id='common.edit' />
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            disabled={busyKey === `item-copy-${item.id}`}
                                            onClick={() => duplicateItem(item)}>
                                            {busyKey === `item-copy-${item.id}` ? (
                                                <Loader2 className='size-4 animate-spin' />
                                            ) : (
                                                <Copy className='size-4' />
                                            )}
                                            <LocalizedMessage id='phase4b.copy.71d6ee' />
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() =>
                                                runMutation(`item-toggle-${item.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/items/${item.id}`, {
                                                        method: 'PUT',
                                                        body: JSON.stringify({ enabled: !item.enabled })
                                                    });
                                                    setMessage(
                                                        item.enabled
                                                            ? t('phase4b.assetDisabled')
                                                            : t('phase4b.assetRestored')
                                                    );
                                                })
                                            }>
                                            {item.enabled ? t('phase4b.disable') : t('phase4b.restoreAction')}
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() =>
                                                runMutation(`item-delete-${item.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/items/${item.id}`, {
                                                        method: 'DELETE'
                                                    });
                                                    setMessage(t('assets.notice.deleted'));
                                                })
                                            }>
                                            <Trash2 className='size-4' />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
                                <LocalizedMessage id='phase4b.thisDisplayGroupHasNoAssetsYet' />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
