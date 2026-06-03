'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { useMessage } from '@/components/notice-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildPromoAspectRatio, getPromoConstraintChips, type PromoAspectRatioSource } from '@/lib/promo';
import { cn } from '@/lib/utils';
import { Check, Clipboard, Edit3, Loader2, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';

type PromoTransition = 'fade' | 'slide' | 'none';
type PromoScope = 'global' | 'share';

export type AdminPromoSlot = {
    id: string;
    key: string;
    name: string;
    description: string | null;
    enabled: boolean;
    defaultIntervalMs: number;
    defaultTransition: PromoTransition;
    createdAt: string;
    updatedAt: string;
};

export type AdminPromoConfig = {
    id: string;
    name: string;
    note: string | null;
    slotId: string;
    scope: PromoScope;
    shareProfileId: string | null;
    enabled: boolean;
    intervalMs: number | null;
    transition: PromoTransition | null;
    aspectRatioWidth: number | null;
    aspectRatioHeight: number | null;
    aspectRatioLabel: string | null;
    aspectRatioSource: PromoAspectRatioSource | null;
    constraintsJson: string | null;
    startsAt: string | null;
    endsAt: string | null;
    createdByUserId: string | null;
    createdAt: string;
    updatedAt: string;
};

export type AdminPromoItem = {
    id: string;
    configId: string;
    enabled: boolean;
};

export type AdminPromoShareProfile = {
    id: string;
    publicId: string;
    name: string;
    status: 'active' | 'disabled';
    createdAt: string;
    updatedAt: string;
    lastPublishedAt: string | null;
};

type PromoAdminClientProps = {
    initialSlots: AdminPromoSlot[];
    initialConfigs: AdminPromoConfig[];
    initialItems: AdminPromoItem[];
    initialShareProfiles: AdminPromoShareProfile[];
};

type SlotDraft = {
    id: string;
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    defaultIntervalMs: string;
    defaultTransition: PromoTransition;
};

const emptySlotDraft: SlotDraft = {
    id: '',
    key: '',
    name: '',
    description: '',
    enabled: true,
    defaultIntervalMs: '5000',
    defaultTransition: 'fade'
};

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

function StatusPill({ active, labels }: { active: boolean; labels?: [string, string] }) {
    const { t } = useAppLanguage();
    const activeLabel = labels?.[0] ?? t('phase4b.enable');
    const inactiveLabel = labels?.[1] ?? t('phase4b.disable');
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
            )}>
            {active ? activeLabel : inactiveLabel}
        </span>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='space-y-2'>
            <Label className='text-muted-foreground text-xs font-medium'>{label}</Label>
            {children}
        </div>
    );
}

function formatTimeRange(startsAt: string | null, endsAt: string | null, t: ReturnType<typeof useAppLanguage>['t']): string {
    const start = startsAt ? new Date(startsAt).toLocaleString() : t('phase4b.immediately');
    const end = endsAt ? new Date(endsAt).toLocaleString() : t('phase4b.longTerm');
    return `${start} - ${end}`;
}

function formatConfigAspectRatio(
    config: AdminPromoConfig,
    slotKey: string | null | undefined,
    inheritedLabel: string
): string {
    const aspectRatio = buildPromoAspectRatio(
        config.aspectRatioWidth,
        config.aspectRatioHeight,
        config.aspectRatioLabel,
        config.aspectRatioSource,
        slotKey
    );
    return aspectRatio.source === 'legacySlot' ? `${aspectRatio.label} / ${inheritedLabel}` : aspectRatio.label;
}

function TruncatedText({ value, className }: { value: string; className?: string }) {
    return (
        <span className={cn('block min-w-0 truncate', className)} title={value}>
            {value}
        </span>
    );
}

function ConstraintChips({
    constraintsJson,
    allDomainsLabel
}: {
    constraintsJson: string | null;
    allDomainsLabel: string;
}) {
    const chips = getPromoConstraintChips(constraintsJson);
    if (chips.length === 0) {
        return <span className='text-muted-foreground text-xs'>{allDomainsLabel}</span>;
    }
    return (
        <div className='flex min-w-0 flex-wrap gap-1.5'>
            {chips.slice(0, 3).map((chip) => (
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
            {chips.length > 3 && (
                <span className='bg-muted text-muted-foreground inline-flex rounded-md px-2 py-1 text-xs font-medium'>
                    +{chips.length - 3}
                </span>
            )}
        </div>
    );
}

function buildConfigSearchText(
    config: AdminPromoConfig,
    slot: AdminPromoSlot | null | undefined,
    profile: AdminPromoShareProfile | null | undefined,
    allDomainsLabel: string
): string {
    const chips = getPromoConstraintChips(config.constraintsJson);
    return [
        config.name,
        config.note,
        slot?.name,
        slot?.key,
        profile?.publicId,
        profile?.name,
        chips.length > 0 ? chips.map((chip) => `${chip.type} ${chip.label} ${chip.summary}`).join(' ') : allDomainsLabel
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

export function PromoAdminClient({
    initialSlots,
    initialConfigs,
    initialItems,
    initialShareProfiles
}: PromoAdminClientProps) {
    const searchParams = useSearchParams();
    const { addNotice } = useMessage();
    const { t } = useAppLanguage();
    const [slots, setSlots] = React.useState(initialSlots);
    const [configs, setConfigs] = React.useState(initialConfigs);
    const [items, setItems] = React.useState(initialItems);
    const [slotDraft, setSlotDraft] = React.useState<SlotDraft>(emptySlotDraft);
    const [editingSlotId, setEditingSlotId] = React.useState<string>('');
    const [activeScope, setActiveScope] = React.useState<PromoScope>(() =>
        searchParams.get('scope') === 'share' ? 'share' : 'global'
    );
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');
    const [copiedProfileId, setCopiedProfileId] = React.useState('');
    const [configSearch, setConfigSearch] = React.useState('');
    const copiedProfileTimerRef = React.useRef<number | null>(null);

    const slotById = React.useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
    const profileById = React.useMemo(
        () => new Map(initialShareProfiles.map((profile) => [profile.id, profile])),
        [initialShareProfiles]
    );
    const itemCountByConfigId = React.useMemo(() => {
        const counts = new Map<string, number>();
        for (const item of items) counts.set(item.configId, (counts.get(item.configId) || 0) + 1);
        return counts;
    }, [items]);

    React.useEffect(() => {
        return () => {
            if (copiedProfileTimerRef.current) window.clearTimeout(copiedProfileTimerRef.current);
        };
    }, []);

    const allDomainsLabel = t('promo.constraints.allDomains');
    const normalizedConfigSearch = configSearch.trim().toLowerCase();
    const scopedConfigs = React.useMemo(
        () =>
            configs
                .filter((config) => config.scope === activeScope)
                .filter((config) => {
                    if (!normalizedConfigSearch) return true;
                    const profile = config.shareProfileId ? profileById.get(config.shareProfileId) : null;
                    return buildConfigSearchText(
                        config,
                        slotById.get(config.slotId),
                        profile,
                        allDomainsLabel
                    ).includes(normalizedConfigSearch);
                }),
        [activeScope, allDomainsLabel, configs, normalizedConfigSearch, profileById, slotById]
    );

    const reload = React.useCallback(async (options?: { notify?: boolean }) => {
        setBusyKey('reload');
        setError('');
        try {
            const [slotPayload, configPayload, itemPayload] = await Promise.all([
                requestJson<{ slots: AdminPromoSlot[] }>(
                    '/api/admin/promo/slots',
                    undefined,
                    t('admin.publicActions.notice.failed')
                ),
                requestJson<{ configs: AdminPromoConfig[] }>(
                    '/api/admin/promo/configs',
                    undefined,
                    t('admin.publicActions.notice.failed')
                ),
                requestJson<{ items: AdminPromoItem[] }>(
                    '/api/admin/promo/items',
                    undefined,
                    t('admin.publicActions.notice.failed')
                )
            ]);
            setSlots(slotPayload.slots);
            setConfigs(configPayload.configs);
            setItems(itemPayload.items);
            if (options?.notify !== false) setMessage(t('phase4b.dataRefreshed'));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.refreshFailed'));
        } finally {
            setBusyKey('');
        }
    }, [t]);

    const runMutation = async (key: string, action: () => Promise<void>) => {
        setBusyKey(key);
        setError('');
        setMessage('');
        try {
            await action();
            await reload({ notify: false });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.publicActions.notice.failed'));
        } finally {
            setBusyKey('');
        }
    };

    const saveSlot = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const body = {
            key: slotDraft.key,
            name: slotDraft.name,
            description: slotDraft.description || null,
            enabled: slotDraft.enabled,
            defaultIntervalMs: Number(slotDraft.defaultIntervalMs || 5000),
            defaultTransition: slotDraft.defaultTransition
        };
        await runMutation('slot-save', async () => {
            if (slotDraft.id) {
                await requestJson(`/api/admin/promo/slots/${slotDraft.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: body.name,
                        description: body.description,
                        enabled: body.enabled,
                        defaultIntervalMs: body.defaultIntervalMs,
                        defaultTransition: body.defaultTransition
                    })
                });
                setMessage(t('phase4b.placementUpdated'));
            } else {
                await requestJson('/api/admin/promo/slots', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setMessage(t('phase4b.placementCreated'));
            }
            setSlotDraft(emptySlotDraft);
            setEditingSlotId('');
        });
    };

    const copyProfileId = async (profileId: string) => {
        try {
            await navigator.clipboard.writeText(profileId);
            setCopiedProfileId(profileId);
            if (copiedProfileTimerRef.current) window.clearTimeout(copiedProfileTimerRef.current);
            copiedProfileTimerRef.current = window.setTimeout(() => {
                setCopiedProfileId('');
                copiedProfileTimerRef.current = null;
            }, 2000);
        } catch {
            setError(t('phase4b.copyProfileIdFailed'));
        }
    };

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <Heading level={1} size='section'>
                        <LocalizedMessage id='phase4b.placementManagement' />
                    </Heading>
                    <p className='text-muted-foreground mt-1 text-sm'>
                        <LocalizedMessage id='phase4b.adminsCreateGlobalAndShareDisplayGroupsHere' />
                    </p>
                </div>
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => reload()}
                    disabled={busyKey === 'reload'}>
                    {busyKey === 'reload' ? (
                        <Loader2 className='size-4 animate-spin' />
                    ) : (
                        <RefreshCw className='size-4' />
                    )}
                    <LocalizedMessage id='inspiration.action.reload' />
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

            <Card>
                <CardHeader>
                    <CardTitle>
                        <LocalizedMessage id='admin.nav.promo' />
                    </CardTitle>
                    <CardDescription>
                        <LocalizedMessage id='phase4b.controlPlacementAvailabilityDefaultCarouselIntervalAndTransition' />
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {!editingSlotId && (
                        <form onSubmit={saveSlot} className='grid gap-3 rounded-md border p-3 md:grid-cols-6'>
                            <Field label='Key'>
                                <Input
                                    value={slotDraft.key}
                                    onChange={(event) =>
                                        setSlotDraft((draft) => ({ ...draft, key: event.target.value }))
                                    }
                                    placeholder='custom_banner'
                                />
                            </Field>
                            <Field label={t('inspiration.field.title')}>
                                <Input
                                    value={slotDraft.name}
                                    onChange={(event) =>
                                        setSlotDraft((draft) => ({ ...draft, name: event.target.value }))
                                    }
                                />
                            </Field>
                            <Field label={t('phase4b.description')}>
                                <Input
                                    value={slotDraft.description}
                                    onChange={(event) =>
                                        setSlotDraft((draft) => ({ ...draft, description: event.target.value }))
                                    }
                                />
                            </Field>
                            <Field label={t('phase4b.intervalMs')}>
                                <Input
                                    type='number'
                                    min={3000}
                                    value={slotDraft.defaultIntervalMs}
                                    onChange={(event) =>
                                        setSlotDraft((draft) => ({ ...draft, defaultIntervalMs: event.target.value }))
                                    }
                                />
                            </Field>
                            <Field label={t('phase4b.transition')}>
                                <select
                                    className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                    value={slotDraft.defaultTransition}
                                    onChange={(event) =>
                                        setSlotDraft((draft) => ({
                                            ...draft,
                                            defaultTransition: event.target.value as PromoTransition
                                        }))
                                    }>
                                    <option value='fade'>{t('phase4b.fade')}</option>
                                    <option value='slide'>{t('phase4b.slide')}</option>
                                    <option value='none'>{t('phase4b.none')}</option>
                                </select>
                            </Field>
                            <div className='flex items-end'>
                                <Button
                                    type='submit'
                                    disabled={busyKey === 'slot-save' || !slotDraft.name || !slotDraft.key}>
                                    {busyKey === 'slot-save' ? (
                                        <Loader2 className='size-4 animate-spin' />
                                    ) : (
                                        <Plus className='size-4' />
                                    )}
                                    <LocalizedMessage id='phase4b.add' />
                                </Button>
                            </div>
                        </form>
                    )}

                    <div className='grid gap-3 xl:grid-cols-3'>
                        {slots.map((slot) => {
                            const editing = editingSlotId === slot.id;
                            return (
                                <div key={slot.id} className='rounded-md border p-3'>
                                    {editing ? (
                                        <form onSubmit={saveSlot} className='space-y-3'>
                                            <div className='grid gap-3 sm:grid-cols-2'>
                                                <Field label={t('inspiration.field.title')}>
                                                    <Input
                                                        value={slotDraft.name}
                                                        onChange={(event) =>
                                                            setSlotDraft((draft) => ({
                                                                ...draft,
                                                                name: event.target.value
                                                            }))
                                                        }
                                                    />
                                                </Field>
                                                <Field label={t('phase4b.intervalMs')}>
                                                    <Input
                                                        type='number'
                                                        min={3000}
                                                        value={slotDraft.defaultIntervalMs}
                                                        onChange={(event) =>
                                                            setSlotDraft((draft) => ({
                                                                ...draft,
                                                                defaultIntervalMs: event.target.value
                                                            }))
                                                        }
                                                    />
                                                </Field>
                                            </div>
                                            <Field label={t('phase4b.description')}>
                                                <Input
                                                    value={slotDraft.description}
                                                    onChange={(event) =>
                                                        setSlotDraft((draft) => ({
                                                            ...draft,
                                                            description: event.target.value
                                                        }))
                                                    }
                                                />
                                            </Field>
                                            <div className='grid gap-3 sm:grid-cols-2'>
                                                <Field label={t('phase4b.transition')}>
                                                    <select
                                                        className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                                        value={slotDraft.defaultTransition}
                                                        onChange={(event) =>
                                                            setSlotDraft((draft) => ({
                                                                ...draft,
                                                                defaultTransition: event.target.value as PromoTransition
                                                            }))
                                                        }>
                                                        <option value='fade'>{t('phase4b.fade')}</option>
                                                        <option value='slide'>{t('phase4b.slide')}</option>
                                                        <option value='none'>{t('phase4b.none')}</option>
                                                    </select>
                                                </Field>
                                                <label className='flex items-end gap-2 text-sm'>
                                                    <input
                                                        type='checkbox'
                                                        checked={slotDraft.enabled}
                                                        onChange={(event) =>
                                                            setSlotDraft((draft) => ({
                                                                ...draft,
                                                                enabled: event.target.checked
                                                            }))
                                                        }
                                                    />
                                                    <LocalizedMessage id='batch.enable' />
                                                </label>
                                            </div>
                                            <div className='flex gap-2'>
                                                <Button
                                                    type='submit'
                                                    disabled={busyKey === 'slot-save' || !slotDraft.name}>
                                                    {busyKey === 'slot-save' ? (
                                                        <Loader2 className='size-4 animate-spin' />
                                                    ) : (
                                                        <Save className='size-4' />
                                                    )}
                                                    <LocalizedMessage id='password.save' />
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={() => {
                                                        setEditingSlotId('');
                                                        setSlotDraft(emptySlotDraft);
                                                    }}>
                                                    <LocalizedMessage id='tasks.cancel' />
                                                </Button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <div className='flex items-start justify-between gap-3'>
                                                <div className='min-w-0'>
                                                    <div className='flex items-center gap-2'>
                                                        <p className='truncate text-sm font-semibold'>{slot.name}</p>
                                                        <StatusPill active={slot.enabled} />
                                                    </div>
                                                    <p className='text-muted-foreground mt-1 truncate font-mono text-xs'>
                                                        {slot.key}
                                                    </p>
                                                </div>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    onClick={() => {
                                                        setEditingSlotId(slot.id);
                                                        setSlotDraft({
                                                            id: slot.id,
                                                            key: slot.key,
                                                            name: slot.name,
                                                            description: slot.description || '',
                                                            enabled: slot.enabled,
                                                            defaultIntervalMs: String(slot.defaultIntervalMs),
                                                            defaultTransition: slot.defaultTransition
                                                        });
                                                    }}>
                                                    <Edit3 className='size-4' />
                                                    <LocalizedMessage id='common.edit' />
                                                </Button>
                                            </div>
                                            <p className='text-muted-foreground mt-2 text-xs'>
                                                {slot.description || t('phase4b.noDescription')}
                                            </p>
                                            <div className='text-muted-foreground mt-3 flex items-center justify-between text-xs'>
                                                <span>{slot.defaultIntervalMs} ms</span>
                                                <span>
                                                    {slot.defaultTransition === 'fade'
                                                        ? t('phase4b.fade')
                                                        : slot.defaultTransition === 'slide'
                                                          ? t('phase4b.slide')
                                                          : t('phase4b.none')}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className='gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div>
                        <CardTitle>
                            <LocalizedMessage id='phase4b.displayGroup' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.globalDisplayGroupsAndShareDisplayGroupsAre' />
                        </CardDescription>
                    </div>
                    <Button asChild>
                        <Link href={`/admin/promo/configs/new?scope=${activeScope}`}>
                            <Plus className='size-4' />
                            <LocalizedMessage id='phase4b.add' />
                            {activeScope === 'global' ? t('phase4b.global') : t('phase4b.shareScope')}
                            <LocalizedMessage id='phase4b.displayGroup' />
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='bg-muted/40 inline-flex rounded-md border p-1'>
                            {(
                                [
                                    ['global', t('phase4b.globalDisplayGroup')],
                                    ['share', t('phase4b.shareDisplayGroup')]
                                ] as const
                            ).map(([scope, label]) => (
                                <button
                                    key={scope}
                                    type='button'
                                    onClick={() => setActiveScope(scope)}
                                    className={cn(
                                        'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                                        activeScope === scope
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    )}>
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className='relative sm:w-80'>
                            <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
                            <Input
                                className='pl-8'
                                value={configSearch}
                                onChange={(event) => setConfigSearch(event.target.value)}
                                placeholder={t('promo.constraints.searchPlaceholder')}
                            />
                        </div>
                    </div>

                    <div className='space-y-3 md:hidden'>
                        {scopedConfigs.map((config) => {
                            const profile = config.shareProfileId ? profileById.get(config.shareProfileId) : null;
                            const slot = slotById.get(config.slotId);
                            const slotName = slot?.name || config.slotId;
                            const aspectRatioLabel = formatConfigAspectRatio(
                                config,
                                slot?.key,
                                t('promo.aspectRatio.inheritedShort')
                            );
                            const timeRange = formatTimeRange(config.startsAt, config.endsAt, t);
                            const itemCount = itemCountByConfigId.get(config.id) || 0;
                            return (
                                <div
                                    key={config.id}
                                    className='border-border bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-sm'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <div className='min-w-0 flex-1'>
                                            <p
                                                className='text-foreground truncate text-sm font-semibold'
                                                title={config.name}>
                                                {config.name}
                                            </p>
                                            {config.note && (
                                                <p className='text-muted-foreground mt-0.5 line-clamp-2 text-xs'>
                                                    {config.note}
                                                </p>
                                            )}
                                        </div>
                                        <StatusPill active={config.enabled} />
                                    </div>
                                    <dl className='grid grid-cols-2 gap-x-3 gap-y-2 text-xs'>
                                        <div className='min-w-0'>
                                            <dt className='text-muted-foreground'>
                                                <LocalizedMessage id='admin.nav.promo' />
                                            </dt>
                                            <dd className='text-foreground mt-0.5 truncate' title={slotName}>
                                                {slotName}
                                            </dd>
                                        </div>
                                        <div className='min-w-0'>
                                            <dt className='text-muted-foreground'>
                                                <LocalizedMessage id='phase4b.assetCount' />
                                            </dt>
                                            <dd className='text-foreground mt-0.5'>{itemCount}</dd>
                                        </div>
                                        <div className='min-w-0'>
                                            <dt className='text-muted-foreground'>{t('promo.aspectRatio.column')}</dt>
                                            <dd className='text-foreground mt-0.5 font-mono' data-i18n-skip='true'>
                                                {aspectRatioLabel}
                                            </dd>
                                        </div>
                                        <div className='col-span-2 min-w-0'>
                                            <dt className='text-muted-foreground'>
                                                <LocalizedMessage id='phase4b.timeWindow' />
                                            </dt>
                                            <dd className='text-foreground mt-0.5 truncate' title={timeRange}>
                                                {timeRange}
                                            </dd>
                                        </div>
                                        <div className='col-span-2 min-w-0'>
                                            <dt className='text-muted-foreground'>{t('promo.constraints.column')}</dt>
                                            <dd className='mt-1'>
                                                <ConstraintChips
                                                    constraintsJson={config.constraintsJson}
                                                    allDomainsLabel={allDomainsLabel}
                                                />
                                            </dd>
                                        </div>
                                        {activeScope === 'share' && (
                                            <div className='col-span-2 min-w-0'>
                                                <dt className='text-muted-foreground'>
                                                    <LocalizedMessage id='phase4b.promoProfileId' />
                                                </dt>
                                                <dd className='mt-0.5 flex min-w-0 items-center gap-2'>
                                                    {profile ? (
                                                        <>
                                                            <code
                                                                className='bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-[11px]'
                                                                title={profile.publicId}>
                                                                {profile.publicId}
                                                            </code>
                                                            <Button
                                                                type='button'
                                                                variant='outline'
                                                                size='sm'
                                                                onClick={() => copyProfileId(profile.publicId)}>
                                                                {copiedProfileId === profile.publicId ? (
                                                                    <Check className='size-4' />
                                                                ) : (
                                                                    <Clipboard className='size-4' />
                                                                )}
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <span className='text-muted-foreground'>
                                                            <LocalizedMessage id='phase4b.notGenerated' />
                                                        </span>
                                                    )}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                    <div className='flex flex-wrap gap-1.5'>
                                        <Button asChild variant='outline' size='sm'>
                                            <Link href={`/admin/promo/configs/${config.id}/items`}>
                                                <LocalizedMessage id='phase4b.manageAssets' />
                                            </Link>
                                        </Button>
                                        <Button asChild variant='outline' size='sm'>
                                            <Link href={`/admin/promo/configs/${config.id}/edit`}>
                                                <Edit3 className='size-4' />
                                                <LocalizedMessage id='common.edit' />
                                            </Link>
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            disabled={busyKey === `config-toggle-${config.id}`}
                                            onClick={() =>
                                                runMutation(`config-toggle-${config.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/configs/${config.id}`, {
                                                        method: 'PUT',
                                                        body: JSON.stringify({ enabled: !config.enabled })
                                                    });
                                                    addNotice(
                                                        config.enabled
                                                            ? t('phase4b.displayGroupDisabled')
                                                            : t('phase4b.displayGroupEnabled'),
                                                        'success'
                                                    );
                                                })
                                            }>
                                            {busyKey === `config-toggle-${config.id}` && (
                                                <Loader2 className='size-4 animate-spin' />
                                            )}
                                            {config.enabled ? t('phase4b.disable') : t('phase4b.enable')}
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            aria-label={t('phase4b.deleteDisplayGroup')}
                                            onClick={() =>
                                                runMutation(`config-delete-${config.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/configs/${config.id}`, {
                                                        method: 'DELETE'
                                                    });
                                                    setMessage(t('phase4b.displayGroupDeleted'));
                                                })
                                            }>
                                            <Trash2 className='size-4' />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                        {scopedConfigs.length === 0 && (
                            <p className='text-muted-foreground border-border bg-card rounded-xl border border-dashed p-6 text-center text-sm'>
                                <LocalizedMessage id='phase4b.no' />
                                {t('phase4b.noDisplayGroupsForScope', {
                                    scope: activeScope === 'global' ? t('phase4b.global') : t('phase4b.shareScope')
                                })}
                            </p>
                        )}
                    </div>

                    <div className='hidden overflow-x-auto rounded-md border md:block'>
                        <table
                            className={cn(
                                'w-full table-fixed text-sm',
                                activeScope === 'share' ? 'min-w-[1300px]' : 'min-w-[1100px]'
                            )}>
                            <colgroup>
                                <col className='w-[180px]' />
                                <col className='w-[140px]' />
                                {activeScope === 'share' && <col className='w-[210px]' />}
                                <col className='w-[90px]' />
                                <col className='w-[76px]' />
                                <col className='w-[72px]' />
                                <col className='w-[180px]' />
                                <col className='w-[210px]' />
                                <col className='w-[260px]' />
                            </colgroup>
                            <thead className='bg-muted/60 text-muted-foreground text-left text-xs'>
                                <tr>
                                    <th className='px-3 py-2 whitespace-nowrap'>
                                        <LocalizedMessage id='inspiration.field.title' />
                                    </th>
                                    <th className='px-3 py-2 whitespace-nowrap'>
                                        <LocalizedMessage id='admin.nav.promo' />
                                    </th>
                                    {activeScope === 'share' && (
                                        <th className='px-3 py-2 whitespace-nowrap'>
                                            <LocalizedMessage id='phase4b.promoProfileId' />
                                        </th>
                                    )}
                                    <th className='px-3 py-2 whitespace-nowrap'>{t('promo.aspectRatio.column')}</th>
                                    <th className='px-3 py-2 whitespace-nowrap'>
                                        <LocalizedMessage id='video.history.detail.status' />
                                    </th>
                                    <th className='px-3 py-2 whitespace-nowrap'>
                                        <LocalizedMessage id='phase4b.assetCount' />
                                    </th>
                                    <th className='px-3 py-2 whitespace-nowrap'>{t('promo.constraints.column')}</th>
                                    <th className='px-3 py-2 whitespace-nowrap'>
                                        <LocalizedMessage id='phase4b.timeWindow' />
                                    </th>
                                    <th className='bg-muted sticky right-0 z-20 px-3 py-2 text-right whitespace-nowrap shadow-[-8px_0_12px_-12px_rgb(0_0_0/0.35)]'>
                                        <LocalizedMessage id='assets.list.actions' />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {scopedConfigs.map((config) => {
                                    const profile = config.shareProfileId
                                        ? profileById.get(config.shareProfileId)
                                        : null;
                                    const slot = slotById.get(config.slotId);
                                    const slotName = slot?.name || config.slotId;
                                    const aspectRatioLabel = formatConfigAspectRatio(
                                        config,
                                        slot?.key,
                                        t('promo.aspectRatio.inheritedShort')
                                    );
                            const timeRange = formatTimeRange(config.startsAt, config.endsAt, t);
                                    return (
                                        <tr key={config.id} className='border-t align-top'>
                                            <td
                                                className='min-w-0 px-3 py-2'
                                                title={[config.name, config.note].filter(Boolean).join('\n')}>
                                                <TruncatedText value={config.name} className='font-medium' />
                                                {config.note && (
                                                    <TruncatedText
                                                        value={config.note}
                                                        className='text-muted-foreground mt-1 text-xs'
                                                    />
                                                )}
                                            </td>
                                            <td className='min-w-0 px-3 py-2'>
                                                <TruncatedText value={slotName} />
                                            </td>
                                            {activeScope === 'share' && (
                                                <td className='min-w-0 px-3 py-2'>
                                                    {profile ? (
                                                        <div className='flex min-w-0 items-center gap-2'>
                                                            <code
                                                                className='bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-xs'
                                                                title={profile.publicId}>
                                                                {profile.publicId}
                                                            </code>
                                                            <Button
                                                                type='button'
                                                                variant='outline'
                                                                size='sm'
                                                                onClick={() => copyProfileId(profile.publicId)}>
                                                                {copiedProfileId === profile.publicId ? (
                                                                    <Check className='size-4' />
                                                                ) : (
                                                                    <Clipboard className='size-4' />
                                                                )}
                                                                <LocalizedMessage id='phase4b.copy' />
                                                            </Button>
                                                            {copiedProfileId === profile.publicId && (
                                                                <span className='shrink-0 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300'>
                                                                    <LocalizedMessage id='task.error.copied' />
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className='text-muted-foreground'>
                                                            <LocalizedMessage id='phase4b.notGenerated' />
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td
                                                className='px-3 py-2 font-mono text-xs whitespace-nowrap'
                                                data-i18n-skip='true'>
                                                {aspectRatioLabel}
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap'>
                                                <StatusPill active={config.enabled} />
                                            </td>
                                            <td className='px-3 py-2 whitespace-nowrap'>
                                                {itemCountByConfigId.get(config.id) || 0}
                                            </td>
                                            <td className='min-w-0 px-3 py-2'>
                                                <ConstraintChips
                                                    constraintsJson={config.constraintsJson}
                                                    allDomainsLabel={allDomainsLabel}
                                                />
                                            </td>
                                            <td className='text-muted-foreground min-w-0 px-3 py-2 text-xs whitespace-nowrap'>
                                                <TruncatedText value={timeRange} />
                                            </td>
                                            <td className='bg-background sticky right-0 z-10 px-3 py-2 shadow-[-8px_0_12px_-12px_rgb(0_0_0/0.35)]'>
                                                <div className='flex min-w-0 justify-end gap-1.5'>
                                                    <Button asChild variant='outline' size='sm'>
                                                        <Link href={`/admin/promo/configs/${config.id}/items`}>
                                                            <LocalizedMessage id='phase4b.manageAssets' />
                                                        </Link>
                                                    </Button>
                                                    <Button asChild variant='outline' size='sm'>
                                                        <Link href={`/admin/promo/configs/${config.id}/edit`}>
                                                            <Edit3 className='size-4' />
                                                            <LocalizedMessage id='common.edit' />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        type='button'
                                                        variant='outline'
                                                        size='sm'
                                                        disabled={busyKey === `config-toggle-${config.id}`}
                                                        onClick={() =>
                                                            runMutation(`config-toggle-${config.id}`, async () => {
                                                                await requestJson(
                                                                    `/api/admin/promo/configs/${config.id}`,
                                                                    {
                                                                        method: 'PUT',
                                                                        body: JSON.stringify({
                                                                            enabled: !config.enabled
                                                                        })
                                                                    }
                                                                );
                                                                addNotice(
                                                                    config.enabled
                                                                        ? t('phase4b.displayGroupDisabled')
                                                                        : t('phase4b.displayGroupEnabled'),
                                                                    'success'
                                                                );
                                                            })
                                                        }>
                                                        {busyKey === `config-toggle-${config.id}` && (
                                                            <Loader2 className='size-4 animate-spin' />
                                                        )}
                                                        {config.enabled ? t('phase4b.disable') : t('phase4b.enable')}
                                                    </Button>
                                                    <Button
                                                        type='button'
                                                        variant='outline'
                                                        size='sm'
                                                        onClick={() =>
                                                            runMutation(`config-delete-${config.id}`, async () => {
                                                                await requestJson(
                                                                    `/api/admin/promo/configs/${config.id}`,
                                                                    { method: 'DELETE' }
                                                                );
                                                                setMessage(t('phase4b.displayGroupDeleted'));
                                                            })
                                                        }>
                                                        <Trash2 className='size-4' />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {scopedConfigs.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={activeScope === 'share' ? 9 : 8}
                                            className='text-muted-foreground px-3 py-8 text-center text-sm'>
                                            {t('phase4b.noDisplayGroupsForScope', {
                                                scope:
                                                    activeScope === 'global'
                                                        ? t('phase4b.global')
                                                        : t('phase4b.shareScope')
                                            })}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
