'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { useMessage } from '@/components/notice-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { PasswordInput } from '@/components/ui/password-input';
import { Textarea } from '@/components/ui/textarea';
import { copyTextToClipboard } from '@/lib/desktop-runtime';
import { cn } from '@/lib/utils';
import {
    BarChart3,
    Check,
    Copy,
    ExternalLink,
    Link2,
    Loader2,
    RefreshCw,
    Save,
    Settings2,
    ShieldAlert,
    Trash2
} from 'lucide-react';
import * as React from 'react';

type ShortLinkStatus = 'active' | 'disabled' | 'deleted';
type PromoMode = 'inherit' | 'none' | 'override';
type CreationMode = 'disabled' | 'admin' | 'passphrase' | 'public';

export type AdminShortLinkProfile = {
    id: string;
    publicId: string;
    name: string;
    status: 'active' | 'disabled';
};

export type AdminShortLink = {
    id: string;
    code: string;
    status: ShortLinkStatus;
    promoMode: PromoMode;
    promoProfileId: string | null;
    promoProfile: AdminShortLinkProfile | null;
    note: string | null;
    createdByType: 'admin' | 'passphrase' | 'public';
    expiresAt: string | null;
    maxVisits: number | null;
    visitCount: number;
    uniqueVisitorCount: number;
    lastVisitedAt: string | null;
    createdAt: string;
    updatedAt: string;
    targetPreview: string;
    targetSummary: {
        encryptedShare?: boolean;
        hasInlinePassword?: boolean;
        hasApiKey?: boolean;
        hasSyncConfig?: boolean;
        hasPromoProfileId?: boolean;
        hasAutostart?: boolean;
    } | null;
};

export type AdminShortLinkSettings = {
    enabled: boolean;
    creationMode: CreationMode;
    passphraseConfigured: boolean;
    codeLength: number;
    defaultExpiresInDays: number;
    maxTargetUrlLength: number;
    allowSensitiveTargets: boolean;
    allowInlineSecurePassword: boolean;
    allowedOrigins: string[];
    visitRetentionDays: number;
};

export type AdminShortLinkStats = {
    totalVisits: number;
    uniqueVisitors: number;
    todayVisits: number;
    sevenDayVisits: number;
    thirtyDayVisits: number;
    lastVisitedAt: string | null;
    referers: Array<{ refererHost: string; count: number }>;
    devices: Array<{ deviceType: string; count: number }>;
    recentVisits: Array<{
        id: string;
        visitedAt: string;
        refererHost: string | null;
        deviceType: string;
        browser: string | null;
        os: string | null;
        status: string;
    }>;
};

type ShortLinksAdminClientProps = {
    initialLinks: AdminShortLink[];
    initialSettings: AdminShortLinkSettings;
    profiles: AdminShortLinkProfile[];
};

type LinkDraft = {
    note: string;
    status: ShortLinkStatus;
    expiresAt: string;
    maxVisits: string;
    promoMode: PromoMode;
    promoProfileId: string;
};

type SettingsDraft = {
    enabled: boolean;
    creationMode: CreationMode;
    passphrase: string;
    codeLength: string;
    defaultExpiresInDays: string;
    maxTargetUrlLength: string;
    allowSensitiveTargets: boolean;
    allowInlineSecurePassword: boolean;
    allowedOrigins: string;
    visitRetentionDays: string;
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

function formatDateTime(value: string | null, emptyLabel: string): string {
    if (!value) return emptyLabel;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? emptyLabel : date.toLocaleString();
}

function toDateTimeLocal(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string): string | null {
    if (!value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildLinkDraft(link: AdminShortLink): LinkDraft {
    return {
        note: link.note || '',
        status: link.status,
        expiresAt: toDateTimeLocal(link.expiresAt),
        maxVisits: link.maxVisits ? String(link.maxVisits) : '',
        promoMode: link.promoMode,
        promoProfileId: link.promoProfileId || ''
    };
}

function buildSettingsDraft(settings: AdminShortLinkSettings): SettingsDraft {
    return {
        enabled: settings.enabled,
        creationMode: settings.creationMode,
        passphrase: '',
        codeLength: String(settings.codeLength),
        defaultExpiresInDays: String(settings.defaultExpiresInDays),
        maxTargetUrlLength: String(settings.maxTargetUrlLength),
        allowSensitiveTargets: settings.allowSensitiveTargets,
        allowInlineSecurePassword: settings.allowInlineSecurePassword,
        allowedOrigins: settings.allowedOrigins.join('\n'),
        visitRetentionDays: String(settings.visitRetentionDays)
    };
}

function parseNumberOrNull(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function shortUrlForCode(code: string): string {
    if (typeof window === 'undefined') return `/s/${code}`;
    return `${window.location.origin}/s/${code}`;
}

function StatusPill({ status }: { status: ShortLinkStatus }) {
    const { t } = useAppLanguage();
    const label = status === 'active' ? t('phase4b.enable') : status === 'disabled' ? t('phase4b.disable') : t('phase4b.deleted');
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : status === 'disabled'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'bg-muted text-muted-foreground'
            )}>
            {label}
        </span>
    );
}

function TargetFlags({ link }: { link: AdminShortLink }) {
    const { t } = useAppLanguage();
    const flags: string[] = [];
    if (link.targetSummary?.encryptedShare) flags.push(t('phase4b.encryptedShare'));
    if (link.targetSummary?.hasApiKey) flags.push(t('phase4b.containsApiKey'));
    if (link.targetSummary?.hasSyncConfig) flags.push(t('phase4b.containsSyncConfig'));
    if (link.targetSummary?.hasInlinePassword) flags.push(t('phase4b.containsHashKey'));
    if (link.targetSummary?.hasAutostart) flags.push(t('phase4b.autoGenerateFlag'));
    if (flags.length === 0) flags.push(t('phase4b.normalShare'));
    return (
        <div className='flex flex-wrap gap-1'>
            {flags.map((flag) => (
                <span key={flag} className='bg-muted text-muted-foreground rounded-md px-2 py-1 text-[11px]'>
                    {flag}
                </span>
            ))}
        </div>
    );
}

export function ShortLinksAdminClient({ initialLinks, initialSettings, profiles }: ShortLinksAdminClientProps) {
    const { t } = useAppLanguage();
    const { addNotice } = useMessage();
    const [links, setLinks] = React.useState(initialLinks);
    const [settings, setSettings] = React.useState(initialSettings);
    const [settingsDraft, setSettingsDraft] = React.useState(() => buildSettingsDraft(initialSettings));
    const [selectedId, setSelectedId] = React.useState(initialLinks[0]?.id || '');
    const selectedLink = links.find((link) => link.id === selectedId) || links[0] || null;
    const [linkDraft, setLinkDraft] = React.useState<LinkDraft | null>(() =>
        selectedLink ? buildLinkDraft(selectedLink) : null
    );
    const [stats, setStats] = React.useState<AdminShortLinkStats | null>(null);
    const [busyKey, setBusyKey] = React.useState('');
    const [error, setError] = React.useState('');
    const [copiedCode, setCopiedCode] = React.useState('');
    const [pendingDelete, setPendingDelete] = React.useState<AdminShortLink | null>(null);

    React.useEffect(() => {
        setLinkDraft(selectedLink ? buildLinkDraft(selectedLink) : null);
        setStats(null);
    }, [selectedLink]);

    const reload = React.useCallback(async () => {
        setBusyKey('reload');
        setError('');
        try {
            const [linkPayload, settingsPayload] = await Promise.all([
                requestJson<{ links: AdminShortLink[] }>('/api/admin/short-links'),
                requestJson<{ settings: AdminShortLinkSettings }>('/api/admin/short-link-settings')
            ]);
            setLinks(linkPayload.links);
            setSettings(settingsPayload.settings);
            setSettingsDraft(buildSettingsDraft(settingsPayload.settings));
            if (!selectedId && linkPayload.links[0]) setSelectedId(linkPayload.links[0].id);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.refreshFailed'));
        } finally {
            setBusyKey('');
        }
    }, [selectedId, t]);

    const copyShortUrl = async (code: string) => {
        const copied = await copyTextToClipboard(shortUrlForCode(code));
        if (copied) {
            setCopiedCode(code);
            window.setTimeout(() => setCopiedCode(''), 1600);
        } else {
            addNotice(t('share.shortLink.copyFailed'), 'error');
        }
    };

    const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusyKey('settings');
        setError('');
        try {
            const payload = await requestJson<{ settings: AdminShortLinkSettings }>('/api/admin/short-link-settings', {
                method: 'PATCH',
                body: JSON.stringify({
                    enabled: settingsDraft.enabled,
                    creationMode: settingsDraft.creationMode,
                    ...(settingsDraft.passphrase.trim() && { passphrase: settingsDraft.passphrase }),
                    codeLength: Number(settingsDraft.codeLength),
                    defaultExpiresInDays: Number(settingsDraft.defaultExpiresInDays),
                    maxTargetUrlLength: Number(settingsDraft.maxTargetUrlLength),
                    allowSensitiveTargets: settingsDraft.allowSensitiveTargets,
                    allowInlineSecurePassword: settingsDraft.allowInlineSecurePassword,
                    allowedOrigins: settingsDraft.allowedOrigins
                        .split(/\r?\n/u)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    visitRetentionDays: Number(settingsDraft.visitRetentionDays)
                })
            });
            setSettings(payload.settings);
            setSettingsDraft(buildSettingsDraft(payload.settings));
            addNotice(t('phase4b.shortLinkSettingsSaved'), 'success');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.saveSettingsFailed'));
        } finally {
            setBusyKey('');
        }
    };

    const saveSelectedLink = async () => {
        if (!selectedLink || !linkDraft) return;
        setBusyKey(`save-${selectedLink.id}`);
        setError('');
        try {
            await requestJson(`/api/admin/short-links/${selectedLink.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    note: linkDraft.note || null,
                    status: linkDraft.status,
                    expiresAt: fromDateTimeLocal(linkDraft.expiresAt),
                    maxVisits: parseNumberOrNull(linkDraft.maxVisits),
                    promoMode: linkDraft.promoMode,
                    promoProfileId: linkDraft.promoMode === 'override' ? linkDraft.promoProfileId || null : null
                })
            });
            await reload();
            addNotice(t('phase4b.shortLinkUpdated'), 'success');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.updateShortLinkFailed'));
        } finally {
            setBusyKey('');
        }
    };

    const loadStats = async (linkId: string) => {
        setBusyKey(`stats-${linkId}`);
        setError('');
        try {
            const payload = await requestJson<{ stats: AdminShortLinkStats }>(`/api/admin/short-links/${linkId}/stats`);
            setStats(payload.stats);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.readStatsFailed'));
        } finally {
            setBusyKey('');
        }
    };

    const deleteLink = async () => {
        if (!pendingDelete) return;
        setBusyKey(`delete-${pendingDelete.id}`);
        setError('');
        try {
            await requestJson(`/api/admin/short-links/${pendingDelete.id}`, { method: 'DELETE' });
            setPendingDelete(null);
            await reload();
            addNotice(t('phase4b.shortLinkDeleted'), 'success');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.deleteShortLinkFailed'));
        } finally {
            setBusyKey('');
        }
    };

    return (
        <section className='space-y-6'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <Heading level={1} size='section'>
                        <LocalizedMessage id='phase4b.shortLinkManagement' />
                    </Heading>
                    <p className='text-muted-foreground mt-1 text-sm'>
                        <LocalizedMessage id='phase4b.manageShareShortLinksRecommendationBindingsAndVisit' />
                    </p>
                </div>
                <Button type='button' variant='outline' onClick={reload} disabled={busyKey === 'reload'}>
                    {busyKey === 'reload' ? (
                        <Loader2 className='mr-2 size-4 animate-spin' />
                    ) : (
                        <RefreshCw className='mr-2 size-4' />
                    )}
                    <LocalizedMessage id='inspiration.action.reload' />
                </Button>
            </div>

            {error && (
                <div className='rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        <Settings2 className='size-4' />
                        <LocalizedMessage id='phase4b.shortLinkSettings' />
                    </CardTitle>
                    <CardDescription>
                        <LocalizedMessage id='phase4b.currentStatus' />
                        {settings.enabled ? t('phase4b.on') : t('phase4b.off')}
                        <LocalizedMessage id='phase4b.creationMode' />
                        {settings.creationMode}
                        {settings.passphraseConfigured
                            ? t('phase4b.creationPassphraseConfiguredSuffix')
                            : t('phase4b.creationPassphraseMissingSuffix')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className='grid gap-4 lg:grid-cols-4' onSubmit={saveSettings}>
                        <label className='flex items-center gap-2 text-sm'>
                            <input
                                type='checkbox'
                                checked={settingsDraft.enabled}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, enabled: event.target.checked }))
                                }
                            />
                            <LocalizedMessage id='phase4b.enableShortLinks' />
                        </label>
                        <div className='space-y-2'>
                            <Label>
                                <LocalizedMessage id='phase4b.creationMode.65edcb' />
                            </Label>
                            <select
                                value={settingsDraft.creationMode}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({
                                        ...draft,
                                        creationMode: event.target.value as CreationMode
                                    }))
                                }
                                className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'>
                                <option value='disabled'>
                                    <LocalizedMessage id='phase4b.disableCreation' />
                                </option>
                                <option value='admin'>
                                    <LocalizedMessage id='phase4b.adminsOnly' />
                                </option>
                                <option value='passphrase'>
                                    <LocalizedMessage id='phase4b.adminsPassphrase' />
                                </option>
                                <option value='public'>
                                    <LocalizedMessage id='phase4b.publicCreation' />
                                </option>
                            </select>
                        </div>
                        <div className='space-y-2'>
                            <Label>
                                <LocalizedMessage id='phase4b.newCreationPassphrase' />
                            </Label>
                            <PasswordInput
                                value={settingsDraft.passphrase}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, passphrase: event.target.value }))
                                }
                                placeholder={
                                    settings.passphraseConfigured
                                        ? t('phase4b.leaveEmptyToKeepExisting')
                                        : t('phase4b.setAtLeastOnePassphrase')
                                }
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>
                                <LocalizedMessage id='phase4b.shortCodeLength' />
                            </Label>
                            <Input
                                value={settingsDraft.codeLength}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, codeLength: event.target.value }))
                                }
                                inputMode='numeric'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>
                                <LocalizedMessage id='phase4b.defaultExpiryDays0ForUnlimited' />
                            </Label>
                            <Input
                                value={settingsDraft.defaultExpiresInDays}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({
                                        ...draft,
                                        defaultExpiresInDays: event.target.value
                                    }))
                                }
                                inputMode='numeric'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>
                                <LocalizedMessage id='phase4b.maximumTargetUrlLength' />
                            </Label>
                            <Input
                                value={settingsDraft.maxTargetUrlLength}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, maxTargetUrlLength: event.target.value }))
                                }
                                inputMode='numeric'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>
                                <LocalizedMessage id='phase4b.visitDetailRetentionDays' />
                            </Label>
                            <Input
                                value={settingsDraft.visitRetentionDays}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, visitRetentionDays: event.target.value }))
                                }
                                inputMode='numeric'
                            />
                        </div>
                        <div className='flex flex-col gap-2 text-sm'>
                            <label className='flex items-center gap-2'>
                                <input
                                    type='checkbox'
                                    checked={settingsDraft.allowSensitiveTargets}
                                    onChange={(event) =>
                                        setSettingsDraft((draft) => ({
                                            ...draft,
                                            allowSensitiveTargets: event.target.checked
                                        }))
                                    }
                                />
                                <LocalizedMessage id='phase4b.allowPlaintextSensitiveParams' />
                            </label>
                            <label className='flex items-center gap-2'>
                                <input type='checkbox' checked disabled aria-describedby='short-link-inline-key-note' />
                                <LocalizedMessage id='phase4b.allowSavingKey' />
                            </label>
                            <p id='short-link-inline-key-note' className='text-muted-foreground text-xs'>
                                <LocalizedMessage id='phase4b.encryptedShareKeyDecryptionPasswordsAreNowAllowed' />
                            </p>
                        </div>
                        <div className='space-y-2 lg:col-span-3'>
                            <Label>
                                <LocalizedMessage id='phase4b.allowedOriginsOneOriginPerLine' />
                            </Label>
                            <Textarea
                                value={settingsDraft.allowedOrigins}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, allowedOrigins: event.target.value }))
                                }
                                className='min-h-20 font-mono text-xs'
                                placeholder='https://img-playground.example.com'
                            />
                        </div>
                        <div className='flex items-end'>
                            <Button type='submit' disabled={busyKey === 'settings'}>
                                {busyKey === 'settings' ? (
                                    <Loader2 className='mr-2 size-4 animate-spin' />
                                ) : (
                                    <Save className='mr-2 size-4' />
                                )}
                                <LocalizedMessage id='phase4b.saveSettings' />
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]'>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <LocalizedMessage id='phase4b.shortLinkList' />
                        </CardTitle>
                        <CardDescription>
                            {links.length} <LocalizedMessage id='phase4b.shortLinks' />
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        {links.length === 0 && (
                            <div className='text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm'>
                                <LocalizedMessage id='phase4b.noShortLinksYetLinksCreatedFromThe' />
                            </div>
                        )}
                        {links.map((link) => (
                            <button
                                key={link.id}
                                type='button'
                                onClick={() => setSelectedId(link.id)}
                                className={cn(
                                    'border-border bg-card hover:bg-muted/50 w-full rounded-xl border p-3 text-left transition-colors',
                                    selectedLink?.id === link.id && 'border-primary bg-primary/5'
                                )}>
                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                    <div className='flex min-w-0 items-center gap-2'>
                                        <Link2 className='text-muted-foreground size-4 shrink-0' />
                                        <span className='font-mono text-sm font-semibold'>{link.code}</span>
                                        <StatusPill status={link.status} />
                                    </div>
                                    <span className='text-muted-foreground text-xs'>
                                        {formatDateTime(link.createdAt, t('phase4b.none'))}
                                    </span>
                                </div>
                                <p className='text-muted-foreground mt-2 truncate font-mono text-xs'>
                                    {link.targetPreview}
                                </p>
                                <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
                                    <TargetFlags link={link} />
                                    <span className='text-muted-foreground text-xs'>
                                        {link.visitCount} <LocalizedMessage id='phase4b.visits' />{' '}
                                        {link.uniqueVisitorCount} <LocalizedMessage id='phase4b.uniqueVisitors' />
                                    </span>
                                </div>
                            </button>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            <LocalizedMessage id='phase4b.shortLinkDetails' />
                        </CardTitle>
                        <CardDescription>
                            {selectedLink ? `/${selectedLink.code}` : t('phase4b.selectShortLinkForDetails')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!selectedLink || !linkDraft ? (
                            <div className='text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm'>
                                <LocalizedMessage id='phase4b.noManageableShortLinksYet' />
                            </div>
                        ) : (
                            <div className='space-y-4'>
                                <div className='flex flex-wrap gap-2'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => copyShortUrl(selectedLink.code)}>
                                        {copiedCode === selectedLink.code ? (
                                            <Check className='mr-2 size-4' />
                                        ) : (
                                            <Copy className='mr-2 size-4' />
                                        )}
                                        {copiedCode === selectedLink.code
                                            ? t('share.shortLink.copied')
                                            : t('share.shortLink.copy')}
                                    </Button>
                                    <Button type='button' variant='outline' size='sm' asChild>
                                        <a href={shortUrlForCode(selectedLink.code)} target='_blank' rel='noreferrer'>
                                            <ExternalLink className='mr-2 size-4' />
                                            <LocalizedMessage id='phase4b.open' />
                                        </a>
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => loadStats(selectedLink.id)}>
                                        {busyKey === `stats-${selectedLink.id}` ? (
                                            <Loader2 className='mr-2 size-4 animate-spin' />
                                        ) : (
                                            <BarChart3 className='mr-2 size-4' />
                                        )}
                                        <LocalizedMessage id='phase4b.refreshStats' />
                                    </Button>
                                </div>

                                <div className='rounded-xl border p-3'>
                                    <p className='text-muted-foreground mb-1 text-xs'>
                                        <LocalizedMessage id='phase4b.targetUrlRedacted' />
                                    </p>
                                    <p className='font-mono text-xs break-all'>{selectedLink.targetPreview}</p>
                                </div>

                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-2'>
                                        <Label>
                                            <LocalizedMessage id='video.history.detail.status' />
                                        </Label>
                                        <select
                                            value={linkDraft.status}
                                            onChange={(event) =>
                                                setLinkDraft(
                                                    (draft) =>
                                                        draft && {
                                                            ...draft,
                                                            status: event.target.value as ShortLinkStatus
                                                        }
                                                )
                                            }
                                            className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'>
                                            <option value='active'>
                                                <LocalizedMessage id='batch.enable' />
                                            </option>
                                            <option value='disabled'>
                                                <LocalizedMessage id='admin.publicActions.deactivate' />
                                            </option>
                                            <option value='deleted'>
                                                <LocalizedMessage id='phase4b.deleted' />
                                            </option>
                                        </select>
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>
                                            <LocalizedMessage id='phase4b.expiryTime' />
                                        </Label>
                                        <Input
                                            type='datetime-local'
                                            value={linkDraft.expiresAt}
                                            onChange={(event) =>
                                                setLinkDraft(
                                                    (draft) => draft && { ...draft, expiresAt: event.target.value }
                                                )
                                            }
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>
                                            <LocalizedMessage id='phase4b.maximumVisits' />
                                        </Label>
                                        <Input
                                            value={linkDraft.maxVisits}
                                            onChange={(event) =>
                                                setLinkDraft(
                                                    (draft) => draft && { ...draft, maxVisits: event.target.value }
                                                )
                                            }
                                            inputMode='numeric'
                                            placeholder={t('admin.shortLinks.unlimitedPlaceholder')}
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>
                                            <LocalizedMessage id='phase4b.recommendationStrategy' />
                                        </Label>
                                        <select
                                            value={linkDraft.promoMode}
                                            onChange={(event) =>
                                                setLinkDraft(
                                                    (draft) =>
                                                        draft && {
                                                            ...draft,
                                                            promoMode: event.target.value as PromoMode
                                                        }
                                                )
                                            }
                                            className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'>
                                            <option value='inherit'>
                                                <LocalizedMessage id='phase4b.inheritLongLink' />
                                            </option>
                                            <option value='none'>
                                                <LocalizedMessage id='phase4b.doNotShowShareRecommendations' />
                                            </option>
                                            <option value='override'>
                                                <LocalizedMessage id='phase4b.bindASpecificProfile' />
                                            </option>
                                        </select>
                                    </div>
                                </div>

                                {linkDraft.promoMode === 'override' && (
                                    <div className='space-y-2'>
                                        <Label>
                                            <LocalizedMessage id='phase4b.shareProfile' />
                                        </Label>
                                        <select
                                            value={linkDraft.promoProfileId}
                                            onChange={(event) =>
                                                setLinkDraft(
                                                    (draft) => draft && { ...draft, promoProfileId: event.target.value }
                                                )
                                            }
                                            className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'>
                                            <option value=''>
                                                <LocalizedMessage id='phase4b.selectProfile' />
                                            </option>
                                            {profiles.map((profile) => (
                                                <option key={profile.id} value={profile.id}>
                                                    {profile.name} / {profile.publicId} / {profile.status}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className='space-y-2'>
                                    <Label>
                                        <LocalizedMessage id='assets.field.note' />
                                    </Label>
                                    <Textarea
                                        value={linkDraft.note}
                                        onChange={(event) =>
                                            setLinkDraft((draft) => draft && { ...draft, note: event.target.value })
                                        }
                                        className='min-h-20'
                                    />
                                </div>

                                <div className='grid gap-3 text-sm sm:grid-cols-2'>
                                    <div className='rounded-xl border p-3'>
                                        <p className='text-muted-foreground text-xs'>
                                            <LocalizedMessage id='phase4b.visits.7f5641' />
                                        </p>
                                        <p className='mt-1 text-2xl font-semibold'>
                                            {stats?.totalVisits ?? selectedLink.visitCount}
                                        </p>
                                    </div>
                                    <div className='rounded-xl border p-3'>
                                        <p className='text-muted-foreground text-xs'>
                                            <LocalizedMessage id='phase4b.uniqueVisitors' />
                                        </p>
                                        <p className='mt-1 text-2xl font-semibold'>
                                            {stats?.uniqueVisitors ?? selectedLink.uniqueVisitorCount}
                                        </p>
                                    </div>
                                    <div className='rounded-xl border p-3'>
                                        <p className='text-muted-foreground text-xs'>
                                            <LocalizedMessage id='phase4b.today7Days30Days' />
                                        </p>
                                        <p className='mt-1 font-semibold'>
                                            {stats
                                                ? `${stats.todayVisits} / ${stats.sevenDayVisits} / ${stats.thirtyDayVisits}`
                                                : t('phase4b.refreshStatsToShow')}
                                        </p>
                                    </div>
                                    <div className='rounded-xl border p-3'>
                                        <p className='text-muted-foreground text-xs'>
                                            <LocalizedMessage id='phase4b.recentVisits' />
                                        </p>
                                        <p className='mt-1 font-semibold'>
                                            {formatDateTime(
                                                stats?.lastVisitedAt ?? selectedLink.lastVisitedAt,
                                                t('phase4b.none')
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {stats && (
                                    <div className='space-y-2 rounded-xl border p-3 text-xs'>
                                        <p className='font-medium'>
                                            <LocalizedMessage id='phase4b.recentVisits' />
                                        </p>
                                        {stats.recentVisits.length === 0 ? (
                                            <p className='text-muted-foreground'>
                                                <LocalizedMessage id='phase4b.noVisitRecordsYet' />
                                            </p>
                                        ) : (
                                            <div className='space-y-1'>
                                                {stats.recentVisits.slice(0, 8).map((visit) => (
                                                    <div
                                                        key={visit.id}
                                                        className='text-muted-foreground flex justify-between gap-2'>
                                                        <span>{formatDateTime(visit.visitedAt, t('phase4b.none'))}</span>
                                                        <span>
                                                            {visit.deviceType} / {visit.refererHost || 'direct'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className='flex flex-wrap justify-between gap-2'>
                                    <Button
                                        type='button'
                                        onClick={saveSelectedLink}
                                        disabled={busyKey === `save-${selectedLink.id}`}>
                                        {busyKey === `save-${selectedLink.id}` ? (
                                            <Loader2 className='mr-2 size-4 animate-spin' />
                                        ) : (
                                            <Save className='mr-2 size-4' />
                                        )}
                                        <LocalizedMessage id='phase4b.saveShortLink' />
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='destructive'
                                        onClick={() => setPendingDelete(selectedLink)}>
                                        <Trash2 className='mr-2 size-4' />
                                        <LocalizedMessage id='assets.action.delete' />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className='flex items-center gap-2'>
                            <ShieldAlert className='size-5 text-red-600' />
                            <LocalizedMessage id='phase4b.deleteShortLink' />
                        </DialogTitle>
                        <DialogDescription>
                            <LocalizedMessage id='phase4b.afterDeletionTheShortLinkWillNoLonger' />
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => setPendingDelete(null)}>
                            <LocalizedMessage id='tasks.cancel' />
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            onClick={deleteLink}
                            disabled={Boolean(pendingDelete && busyKey === `delete-${pendingDelete.id}`)}>
                            {pendingDelete && busyKey === `delete-${pendingDelete.id}` && (
                                <Loader2 className='mr-2 size-4 animate-spin' />
                            )}
                            <LocalizedMessage id='phase4b.confirmDeletion' />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
