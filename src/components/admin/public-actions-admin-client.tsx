'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useMessage } from '@/components/notice-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { openExternalUrl } from '@/lib/desktop-runtime';
import { cn } from '@/lib/utils';
import {
    CheckCircle2,
    ExternalLink,
    Link2,
    Loader2,
    PauseCircle,
    Plus,
    Save,
    Search,
    Star,
    Trash2
} from 'lucide-react';
import * as React from 'react';

export type AdminPublicActionConfig = {
    id: string;
    kind: 'api_key_purchase';
    name: string;
    buttonLabel: string;
    targetUrl: string;
    enabled: boolean;
    active: boolean;
    description: string | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    updatedByUserId: string | null;
};

type PublicActionsAdminClientProps = {
    initialConfigs: AdminPublicActionConfig[];
};

type PublicActionDraft = {
    name: string;
    buttonLabel: string;
    targetUrl: string;
    enabled: boolean;
    active: boolean;
    description: string;
    sortOrder: string;
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
            payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
                ? (payload as { error: string }).error
                : fallbackError;
        throw new Error(errorMessage || fallbackError);
    }
    return payload as T;
}

function buildDraft(config: AdminPublicActionConfig | null, defaultLabel: string): PublicActionDraft {
    if (!config) {
        return {
            name: '',
            buttonLabel: defaultLabel,
            targetUrl: '',
            enabled: false,
            active: false,
            description: '',
            sortOrder: '0'
        };
    }
    return {
        name: config.name,
        buttonLabel: config.buttonLabel,
        targetUrl: config.targetUrl,
        enabled: config.enabled,
        active: config.active,
        description: config.description || '',
        sortOrder: String(config.sortOrder)
    };
}

function getUrlHost(value: string): string {
    try {
        return new URL(value).host;
    } catch {
        return '';
    }
}

function normalizeSortOrder(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function StatusBadge({ active, enabled }: { active: boolean; enabled: boolean }) {
    const { t } = useAppLanguage();
    const label =
        active && enabled
            ? t('admin.publicActions.status.current')
            : enabled
              ? t('admin.publicActions.status.enabled')
              : t('admin.publicActions.status.disabled');
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                active && enabled
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : enabled
                      ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
                      : 'bg-muted text-muted-foreground'
            )}>
            {active && enabled ? <CheckCircle2 className='h-3 w-3' /> : null}
            {label}
        </span>
    );
}

export function PublicActionsAdminClient({ initialConfigs }: PublicActionsAdminClientProps) {
    const { t, formatDateTime } = useAppLanguage();
    const { addNotice } = useMessage();
    const defaultLabel = t('admin.publicActions.defaultButtonLabel');
    const [configs, setConfigs] = React.useState(initialConfigs);
    const [selectedId, setSelectedId] = React.useState(initialConfigs[0]?.id || '');
    const [isCreating, setIsCreating] = React.useState(initialConfigs.length === 0);
    const selectedConfig = configs.find((config) => config.id === selectedId) || null;
    const [draft, setDraft] = React.useState(() => buildDraft(selectedConfig, defaultLabel));
    const [searchQuery, setSearchQuery] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');
    const [deleteTarget, setDeleteTarget] = React.useState<AdminPublicActionConfig | null>(null);

    React.useEffect(() => {
        setDraft(buildDraft(isCreating ? null : selectedConfig, defaultLabel));
    }, [defaultLabel, isCreating, selectedConfig]);

    const filteredConfigs = React.useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase();
        if (!query) return configs;
        return configs.filter((config) => {
            const host = getUrlHost(config.targetUrl);
            return `${config.name} ${config.buttonLabel} ${config.targetUrl} ${host}`
                .toLocaleLowerCase()
                .includes(query);
        });
    }, [configs, searchQuery]);

    const previewHost = getUrlHost(draft.targetUrl);
    const canSubmit =
        draft.name.trim().length > 0 && draft.buttonLabel.trim().length > 0 && draft.targetUrl.trim().length > 0;

    const updateDraft = <TKey extends keyof PublicActionDraft>(key: TKey, value: PublicActionDraft[TKey]) => {
        setDraft((current) => ({
            ...current,
            [key]: value,
            ...(key === 'active' && value === true ? { enabled: true } : {}),
            ...(key === 'enabled' && value === false ? { active: false } : {})
        }));
    };

    const refreshConfigs = React.useCallback(async () => {
        const payload = await requestJson<{ configs: AdminPublicActionConfig[] }>('/api/admin/public-actions');
        setConfigs(payload.configs);
        return payload.configs;
    }, []);

    const handleCreate = () => {
        setIsCreating(true);
        setSelectedId('');
        setDraft(buildDraft(null, defaultLabel));
    };

    const handleSelect = (config: AdminPublicActionConfig) => {
        setIsCreating(false);
        setSelectedId(config.id);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSubmit || busyKey) return;
        const payload = {
            name: draft.name,
            buttonLabel: draft.buttonLabel,
            targetUrl: draft.targetUrl,
            enabled: draft.enabled,
            active: draft.active,
            description: draft.description || null,
            sortOrder: normalizeSortOrder(draft.sortOrder)
        };
        const key = isCreating ? 'create' : `save:${selectedConfig?.id || ''}`;
        setBusyKey(key);
        try {
            const response = await requestJson<{ config: AdminPublicActionConfig }>(
                isCreating ? '/api/admin/public-actions' : `/api/admin/public-actions/${selectedConfig?.id}`,
                {
                    method: isCreating ? 'POST' : 'PUT',
                    body: JSON.stringify(payload)
                }
            );
            const nextConfigs = await refreshConfigs();
            setSelectedId(response.config.id);
            setIsCreating(false);
            setDraft(
                buildDraft(
                    nextConfigs.find((config) => config.id === response.config.id) || response.config,
                    defaultLabel
                )
            );
            addNotice(
                isCreating ? t('admin.publicActions.notice.created') : t('admin.publicActions.notice.updated'),
                'success'
            );
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.publicActions.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const updateConfig = async (
        config: AdminPublicActionConfig,
        patch: Partial<Pick<AdminPublicActionConfig, 'enabled' | 'active'>>
    ) => {
        const key = `update:${config.id}`;
        setBusyKey(key);
        try {
            const response = await requestJson<{ config: AdminPublicActionConfig }>(
                `/api/admin/public-actions/${config.id}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(patch)
                }
            );
            await refreshConfigs();
            setSelectedId(response.config.id);
            setIsCreating(false);
            addNotice(
                patch.active ? t('admin.publicActions.notice.activated') : t('admin.publicActions.notice.deactivated'),
                'success'
            );
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.publicActions.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget || busyKey) return;
        const target = deleteTarget;
        setBusyKey(`delete:${target.id}`);
        try {
            await requestJson<{ ok: boolean }>(`/api/admin/public-actions/${target.id}`, { method: 'DELETE' });
            const next = await refreshConfigs();
            setDeleteTarget(null);
            if (selectedId === target.id) {
                setSelectedId(next[0]?.id || '');
                setIsCreating(next.length === 0);
            }
            addNotice(t('admin.publicActions.notice.deleted'), 'success');
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.publicActions.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const handlePreview = async (url: string) => {
        try {
            await openExternalUrl(url);
        } catch {
            addNotice(t('configuration.purchaseCta.openFailed'), 'error');
        }
    };

    return (
        <section className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <Heading level={1} size='section'>
                        {t('admin.publicActions.title')}
                    </Heading>
                    <p className='text-muted-foreground mt-1 text-sm'>{t('admin.publicActions.description')}</p>
                </div>
                <Button type='button' onClick={handleCreate} className='shrink-0'>
                    <Plus className='mr-2 h-4 w-4' />
                    {t('admin.publicActions.new')}
                </Button>
            </div>

            <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]'>
                <Card>
                    <CardHeader className='space-y-3'>
                        <div>
                            <CardTitle>{t('admin.publicActions.listTitle')}</CardTitle>
                            <CardDescription>{t('admin.publicActions.listDescription')}</CardDescription>
                        </div>
                        <div className='relative'>
                            <Search className='text-muted-foreground pointer-events-none absolute top-2.5 left-3 h-4 w-4' />
                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={t('admin.publicActions.searchPlaceholder')}
                                className='pl-9'
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {filteredConfigs.length === 0 ? (
                            <div className='border-border bg-muted/20 rounded-xl border p-6 text-center'>
                                <Link2 className='text-muted-foreground mx-auto mb-2 h-8 w-8' />
                                <p className='text-sm font-medium'>{t('admin.publicActions.emptyTitle')}</p>
                                <p className='text-muted-foreground mt-1 text-xs'>
                                    {t('admin.publicActions.emptyDescription')}
                                </p>
                            </div>
                        ) : (
                            <div className='space-y-3'>
                                {filteredConfigs.map((config) => (
                                    <div
                                        key={config.id}
                                        className={cn(
                                            'border-border bg-background overflow-hidden rounded-xl border transition-colors',
                                            selectedId === config.id && !isCreating && 'border-primary bg-primary/5'
                                        )}>
                                        <button
                                            type='button'
                                            onClick={() => handleSelect(config)}
                                            className='hover:bg-muted/40 focus-visible:ring-ring/50 flex w-full flex-col gap-3 p-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none'>
                                            <div className='flex items-start justify-between gap-3'>
                                                <div className='min-w-0'>
                                                    <p
                                                        className='text-foreground truncate text-sm font-medium'
                                                        data-i18n-skip>
                                                        {config.name}
                                                    </p>
                                                    <p
                                                        className='text-muted-foreground mt-1 truncate text-xs'
                                                        data-i18n-skip>
                                                        {config.buttonLabel}
                                                    </p>
                                                </div>
                                                <StatusBadge active={config.active} enabled={config.enabled} />
                                            </div>
                                            <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
                                                <span className='max-w-full truncate' data-i18n-skip>
                                                    {getUrlHost(config.targetUrl) || config.targetUrl}
                                                </span>
                                                <span>{formatDateTime(config.updatedAt)}</span>
                                            </div>
                                        </button>
                                        <div className='flex flex-wrap items-center gap-2 px-3 pb-3'>
                                            <Button
                                                type='button'
                                                variant='outline'
                                                size='sm'
                                                onClick={() => {
                                                    void handlePreview(config.targetUrl);
                                                }}>
                                                <ExternalLink className='mr-1 h-3.5 w-3.5' />
                                                {t('admin.publicActions.preview')}
                                            </Button>
                                            {config.active && config.enabled ? (
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    disabled={busyKey === `update:${config.id}`}
                                                    onClick={() => {
                                                        void updateConfig(config, { enabled: false, active: false });
                                                    }}>
                                                    <PauseCircle className='mr-1 h-3.5 w-3.5' />
                                                    {t('admin.publicActions.deactivate')}
                                                </Button>
                                            ) : (
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    disabled={busyKey === `update:${config.id}`}
                                                    onClick={() => {
                                                        void updateConfig(config, { enabled: true, active: true });
                                                    }}>
                                                    <Star className='mr-1 h-3.5 w-3.5' />
                                                    {t('admin.publicActions.activate')}
                                                </Button>
                                            )}
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                className='text-destructive hover:bg-destructive/10 hover:text-destructive'
                                                onClick={() => {
                                                    setDeleteTarget(config);
                                                }}>
                                                <Trash2 className='mr-1 h-3.5 w-3.5' />
                                                {t('admin.publicActions.delete')}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {isCreating ? t('admin.publicActions.createTitle') : t('admin.publicActions.editTitle')}
                        </CardTitle>
                        <CardDescription>{t('admin.publicActions.formDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className='space-y-4' onSubmit={handleSubmit}>
                            <div className='space-y-1.5'>
                                <Label htmlFor='public-action-name'>{t('admin.publicActions.field.name')}</Label>
                                <Input
                                    id='public-action-name'
                                    value={draft.name}
                                    onChange={(event) => updateDraft('name', event.target.value)}
                                    placeholder={t('admin.publicActions.placeholder.name')}
                                />
                            </div>
                            <div className='space-y-1.5'>
                                <Label htmlFor='public-action-label'>
                                    {t('admin.publicActions.field.buttonLabel')}
                                </Label>
                                <Input
                                    id='public-action-label'
                                    value={draft.buttonLabel}
                                    onChange={(event) => updateDraft('buttonLabel', event.target.value)}
                                    placeholder={defaultLabel}
                                />
                                <p className='text-muted-foreground text-xs'>
                                    {t('admin.publicActions.help.buttonLabel')}
                                </p>
                            </div>
                            <div className='space-y-1.5'>
                                <Label htmlFor='public-action-url'>{t('admin.publicActions.field.url')}</Label>
                                <Input
                                    id='public-action-url'
                                    value={draft.targetUrl}
                                    onChange={(event) => updateDraft('targetUrl', event.target.value)}
                                    placeholder='https://supplier.example.com/buy'
                                    data-i18n-skip
                                />
                                <p className='text-muted-foreground text-xs'>
                                    {previewHost
                                        ? t('admin.publicActions.help.urlHost', { host: previewHost })
                                        : t('admin.publicActions.help.url')}
                                </p>
                            </div>
                            <div className='space-y-1.5'>
                                <Label htmlFor='public-action-description'>
                                    {t('admin.publicActions.field.description')}
                                </Label>
                                <Textarea
                                    id='public-action-description'
                                    value={draft.description}
                                    onChange={(event) => updateDraft('description', event.target.value)}
                                    placeholder={t('admin.publicActions.placeholder.description')}
                                    className='min-h-24'
                                />
                            </div>
                            <div className='grid gap-3 sm:grid-cols-2'>
                                <label className='border-border bg-background flex items-start gap-2 rounded-xl border p-3 text-sm'>
                                    <Checkbox
                                        checked={draft.enabled}
                                        onCheckedChange={(value) => updateDraft('enabled', value === true)}
                                    />
                                    <span>
                                        <span className='block font-medium'>
                                            {t('admin.publicActions.field.enabled')}
                                        </span>
                                        <span className='text-muted-foreground mt-1 block text-xs'>
                                            {t('admin.publicActions.help.enabled')}
                                        </span>
                                    </span>
                                </label>
                                <label className='border-border bg-background flex items-start gap-2 rounded-xl border p-3 text-sm'>
                                    <Checkbox
                                        checked={draft.active}
                                        onCheckedChange={(value) => updateDraft('active', value === true)}
                                    />
                                    <span>
                                        <span className='block font-medium'>
                                            {t('admin.publicActions.field.active')}
                                        </span>
                                        <span className='text-muted-foreground mt-1 block text-xs'>
                                            {t('admin.publicActions.help.active')}
                                        </span>
                                    </span>
                                </label>
                            </div>
                            <div className='space-y-1.5'>
                                <Label htmlFor='public-action-sort'>{t('admin.publicActions.field.sortOrder')}</Label>
                                <Input
                                    id='public-action-sort'
                                    type='number'
                                    value={draft.sortOrder}
                                    onChange={(event) => updateDraft('sortOrder', event.target.value)}
                                />
                            </div>
                            <div className='flex flex-wrap justify-end gap-2'>
                                {!isCreating && (
                                    <Button type='button' variant='outline' onClick={handleCreate}>
                                        {t('admin.publicActions.cancelEdit')}
                                    </Button>
                                )}
                                <Button type='submit' disabled={!canSubmit || Boolean(busyKey)}>
                                    {busyKey === 'create' || busyKey.startsWith('save:') ? (
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    ) : (
                                        <Save className='mr-2 h-4 w-4' />
                                    )}
                                    {isCreating ? t('admin.publicActions.create') : t('admin.publicActions.save')}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('admin.publicActions.confirmDeleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {deleteTarget?.active && deleteTarget.enabled
                                ? t('admin.publicActions.confirmDeleteActiveDescription')
                                : t('admin.publicActions.confirmDeleteDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    {deleteTarget && (
                        <div className='border-border bg-muted/30 rounded-xl border p-3 text-sm'>
                            <p className='font-medium' data-i18n-skip>
                                {deleteTarget.name}
                            </p>
                            <p className='text-muted-foreground mt-1 truncate text-xs' data-i18n-skip>
                                {deleteTarget.targetUrl}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => setDeleteTarget(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            disabled={Boolean(deleteTarget && busyKey === `delete:${deleteTarget.id}`)}
                            onClick={handleDelete}>
                            {deleteTarget && busyKey === `delete:${deleteTarget.id}` ? (
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                            ) : (
                                <Trash2 className='mr-2 h-4 w-4' />
                            )}
                            {t('admin.publicActions.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
