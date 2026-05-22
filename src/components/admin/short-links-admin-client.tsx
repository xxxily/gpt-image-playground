'use client';

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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
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
                ? (payload as { error: string }).error || '操作失败。'
                : '操作失败。';
        throw new Error(errorMessage);
    }
    return payload as T;
}

function formatDateTime(value: string | null): string {
    if (!value) return '无';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '无' : date.toLocaleString();
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
    const label = status === 'active' ? '启用' : status === 'disabled' ? '停用' : '已删除';
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
    const flags: string[] = [];
    if (link.targetSummary?.encryptedShare) flags.push('加密分享');
    if (link.targetSummary?.hasApiKey) flags.push('含 API Key');
    if (link.targetSummary?.hasSyncConfig) flags.push('含同步配置');
    if (link.targetSummary?.hasInlinePassword) flags.push('含 #key');
    if (link.targetSummary?.hasAutostart) flags.push('自动生成');
    if (flags.length === 0) flags.push('普通分享');
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
    const { addNotice } = useMessage();
    const [links, setLinks] = React.useState(initialLinks);
    const [settings, setSettings] = React.useState(initialSettings);
    const [settingsDraft, setSettingsDraft] = React.useState(() => buildSettingsDraft(initialSettings));
    const [selectedId, setSelectedId] = React.useState(initialLinks[0]?.id || '');
    const selectedLink = links.find((link) => link.id === selectedId) || links[0] || null;
    const [linkDraft, setLinkDraft] = React.useState<LinkDraft | null>(() => (selectedLink ? buildLinkDraft(selectedLink) : null));
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
            setError(err instanceof Error ? err.message : '刷新失败。');
        } finally {
            setBusyKey('');
        }
    }, [selectedId]);

    const copyShortUrl = async (code: string) => {
        const copied = await copyTextToClipboard(shortUrlForCode(code));
        if (copied) {
            setCopiedCode(code);
            window.setTimeout(() => setCopiedCode(''), 1600);
        } else {
            addNotice('短链复制失败，请手动选择复制。', 'error');
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
            addNotice('短链设置已保存。', 'success');
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存设置失败。');
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
            addNotice('短链已更新。', 'success');
        } catch (err) {
            setError(err instanceof Error ? err.message : '更新短链失败。');
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
            setError(err instanceof Error ? err.message : '读取统计失败。');
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
            addNotice('短链已删除。', 'success');
        } catch (err) {
            setError(err instanceof Error ? err.message : '删除短链失败。');
        } finally {
            setBusyKey('');
        }
    };

    return (
        <section className='space-y-6'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                    <Heading level={1} size='section'>短链管理</Heading>
                    <p className='text-muted-foreground mt-1 text-sm'>管理分享短链、推荐内容关联和访问情况。</p>
                </div>
                <Button type='button' variant='outline' onClick={reload} disabled={busyKey === 'reload'}>
                    {busyKey === 'reload' ? <Loader2 className='mr-2 size-4 animate-spin' /> : <RefreshCw className='mr-2 size-4' />}
                    刷新
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
                        短链设置
                    </CardTitle>
                    <CardDescription>
                        当前状态：{settings.enabled ? '已开启' : '已关闭'}；创建模式：{settings.creationMode}
                        {settings.passphraseConfigured ? '；已配置创建口令' : '；未配置创建口令'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className='grid gap-4 lg:grid-cols-4' onSubmit={saveSettings}>
                        <label className='flex items-center gap-2 text-sm'>
                            <input
                                type='checkbox'
                                checked={settingsDraft.enabled}
                                onChange={(event) => setSettingsDraft((draft) => ({ ...draft, enabled: event.target.checked }))}
                            />
                            开启短链功能
                        </label>
                        <div className='space-y-2'>
                            <Label>创建模式</Label>
                            <select
                                value={settingsDraft.creationMode}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, creationMode: event.target.value as CreationMode }))
                                }
                                className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'>
                                <option value='disabled'>关闭创建</option>
                                <option value='admin'>仅管理员</option>
                                <option value='passphrase'>管理员 + 口令</option>
                                <option value='public'>公开创建</option>
                            </select>
                        </div>
                        <div className='space-y-2'>
                            <Label>新创建口令</Label>
                            <PasswordInput
                                value={settingsDraft.passphrase}
                                onChange={(event) => setSettingsDraft((draft) => ({ ...draft, passphrase: event.target.value }))}
                                placeholder={settings.passphraseConfigured ? '留空则不修改' : '至少设置一个口令'}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>短码长度</Label>
                            <Input
                                value={settingsDraft.codeLength}
                                onChange={(event) => setSettingsDraft((draft) => ({ ...draft, codeLength: event.target.value }))}
                                inputMode='numeric'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>默认有效期（天，0 为不限）</Label>
                            <Input
                                value={settingsDraft.defaultExpiresInDays}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, defaultExpiresInDays: event.target.value }))
                                }
                                inputMode='numeric'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>目标 URL 最大长度</Label>
                            <Input
                                value={settingsDraft.maxTargetUrlLength}
                                onChange={(event) =>
                                    setSettingsDraft((draft) => ({ ...draft, maxTargetUrlLength: event.target.value }))
                                }
                                inputMode='numeric'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label>访问明细保留天数</Label>
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
                                允许明文敏感参数
                            </label>
                            <label className='flex items-center gap-2'>
                                <input
                                    type='checkbox'
                                    checked={settingsDraft.allowInlineSecurePassword}
                                    onChange={(event) =>
                                        setSettingsDraft((draft) => ({
                                            ...draft,
                                            allowInlineSecurePassword: event.target.checked
                                        }))
                                    }
                                />
                                允许保存 #key
                            </label>
                        </div>
                        <div className='space-y-2 lg:col-span-3'>
                            <Label>允许域名（一行一个 Origin）</Label>
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
                                {busyKey === 'settings' ? <Loader2 className='mr-2 size-4 animate-spin' /> : <Save className='mr-2 size-4' />}
                                保存设置
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]'>
                <Card>
                    <CardHeader>
                        <CardTitle>短链列表</CardTitle>
                        <CardDescription>{links.length} 条短链</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        {links.length === 0 && (
                            <div className='text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm'>
                                暂无短链。用户在分享面板点击创建短链后会出现在这里。
                            </div>
                        )}
                        {links.map((link) => (
                            <button
                                key={link.id}
                                type='button'
                                onClick={() => setSelectedId(link.id)}
                                className={cn(
                                    'border-border bg-card w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/50',
                                    selectedLink?.id === link.id && 'border-primary bg-primary/5'
                                )}>
                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                    <div className='flex min-w-0 items-center gap-2'>
                                        <Link2 className='text-muted-foreground size-4 shrink-0' />
                                        <span className='font-mono text-sm font-semibold'>{link.code}</span>
                                        <StatusPill status={link.status} />
                                    </div>
                                    <span className='text-muted-foreground text-xs'>{formatDateTime(link.createdAt)}</span>
                                </div>
                                <p className='text-muted-foreground mt-2 truncate font-mono text-xs'>{link.targetPreview}</p>
                                <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
                                    <TargetFlags link={link} />
                                    <span className='text-muted-foreground text-xs'>
                                        {link.visitCount} 次访问 / {link.uniqueVisitorCount} 唯一访客
                                    </span>
                                </div>
                            </button>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>短链详情</CardTitle>
                        <CardDescription>{selectedLink ? `/${selectedLink.code}` : '选择一条短链查看详情'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!selectedLink || !linkDraft ? (
                            <div className='text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm'>暂无可管理短链。</div>
                        ) : (
                            <div className='space-y-4'>
                                <div className='flex flex-wrap gap-2'>
                                    <Button type='button' variant='outline' size='sm' onClick={() => copyShortUrl(selectedLink.code)}>
                                        {copiedCode === selectedLink.code ? <Check className='mr-2 size-4' /> : <Copy className='mr-2 size-4' />}
                                        {copiedCode === selectedLink.code ? '已复制' : '复制短链'}
                                    </Button>
                                    <Button type='button' variant='outline' size='sm' asChild>
                                        <a href={shortUrlForCode(selectedLink.code)} target='_blank' rel='noreferrer'>
                                            <ExternalLink className='mr-2 size-4' />
                                            打开
                                        </a>
                                    </Button>
                                    <Button type='button' variant='outline' size='sm' onClick={() => loadStats(selectedLink.id)}>
                                        {busyKey === `stats-${selectedLink.id}` ? (
                                            <Loader2 className='mr-2 size-4 animate-spin' />
                                        ) : (
                                            <BarChart3 className='mr-2 size-4' />
                                        )}
                                        刷新统计
                                    </Button>
                                </div>

                                <div className='rounded-xl border p-3'>
                                    <p className='text-muted-foreground mb-1 text-xs'>目标 URL（脱敏）</p>
                                    <p className='break-all font-mono text-xs'>{selectedLink.targetPreview}</p>
                                </div>

                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-2'>
                                        <Label>状态</Label>
                                        <select
                                            value={linkDraft.status}
                                            onChange={(event) =>
                                                setLinkDraft((draft) => draft && { ...draft, status: event.target.value as ShortLinkStatus })
                                            }
                                            className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'>
                                            <option value='active'>启用</option>
                                            <option value='disabled'>停用</option>
                                            <option value='deleted'>已删除</option>
                                        </select>
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>过期时间</Label>
                                        <Input
                                            type='datetime-local'
                                            value={linkDraft.expiresAt}
                                            onChange={(event) =>
                                                setLinkDraft((draft) => draft && { ...draft, expiresAt: event.target.value })
                                            }
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>最大访问次数</Label>
                                        <Input
                                            value={linkDraft.maxVisits}
                                            onChange={(event) =>
                                                setLinkDraft((draft) => draft && { ...draft, maxVisits: event.target.value })
                                            }
                                            inputMode='numeric'
                                            placeholder='留空表示不限'
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>推荐内容策略</Label>
                                        <select
                                            value={linkDraft.promoMode}
                                            onChange={(event) =>
                                                setLinkDraft((draft) => draft && { ...draft, promoMode: event.target.value as PromoMode })
                                            }
                                            className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'>
                                            <option value='inherit'>继承长链接</option>
                                            <option value='none'>不展示分享推荐</option>
                                            <option value='override'>绑定指定 Profile</option>
                                        </select>
                                    </div>
                                </div>

                                {linkDraft.promoMode === 'override' && (
                                    <div className='space-y-2'>
                                        <Label>分享 Profile</Label>
                                        <select
                                            value={linkDraft.promoProfileId}
                                            onChange={(event) =>
                                                setLinkDraft((draft) => draft && { ...draft, promoProfileId: event.target.value })
                                            }
                                            className='border-input bg-background h-10 w-full rounded-md border px-3 text-sm'>
                                            <option value=''>选择 Profile</option>
                                            {profiles.map((profile) => (
                                                <option key={profile.id} value={profile.id}>
                                                    {profile.name} / {profile.publicId} / {profile.status}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className='space-y-2'>
                                    <Label>备注</Label>
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
                                        <p className='text-muted-foreground text-xs'>访问</p>
                                        <p className='mt-1 text-2xl font-semibold'>{stats?.totalVisits ?? selectedLink.visitCount}</p>
                                    </div>
                                    <div className='rounded-xl border p-3'>
                                        <p className='text-muted-foreground text-xs'>唯一访客</p>
                                        <p className='mt-1 text-2xl font-semibold'>{stats?.uniqueVisitors ?? selectedLink.uniqueVisitorCount}</p>
                                    </div>
                                    <div className='rounded-xl border p-3'>
                                        <p className='text-muted-foreground text-xs'>今日 / 7 天 / 30 天</p>
                                        <p className='mt-1 font-semibold'>
                                            {stats ? `${stats.todayVisits} / ${stats.sevenDayVisits} / ${stats.thirtyDayVisits}` : '刷新统计后显示'}
                                        </p>
                                    </div>
                                    <div className='rounded-xl border p-3'>
                                        <p className='text-muted-foreground text-xs'>最近访问</p>
                                        <p className='mt-1 font-semibold'>{formatDateTime(stats?.lastVisitedAt ?? selectedLink.lastVisitedAt)}</p>
                                    </div>
                                </div>

                                {stats && (
                                    <div className='space-y-2 rounded-xl border p-3 text-xs'>
                                        <p className='font-medium'>最近访问</p>
                                        {stats.recentVisits.length === 0 ? (
                                            <p className='text-muted-foreground'>暂无访问记录。</p>
                                        ) : (
                                            <div className='space-y-1'>
                                                {stats.recentVisits.slice(0, 8).map((visit) => (
                                                    <div key={visit.id} className='text-muted-foreground flex justify-between gap-2'>
                                                        <span>{formatDateTime(visit.visitedAt)}</span>
                                                        <span>{visit.deviceType} / {visit.refererHost || 'direct'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className='flex flex-wrap justify-between gap-2'>
                                    <Button type='button' onClick={saveSelectedLink} disabled={busyKey === `save-${selectedLink.id}`}>
                                        {busyKey === `save-${selectedLink.id}` ? (
                                            <Loader2 className='mr-2 size-4 animate-spin' />
                                        ) : (
                                            <Save className='mr-2 size-4' />
                                        )}
                                        保存短链
                                    </Button>
                                    <Button type='button' variant='destructive' onClick={() => setPendingDelete(selectedLink)}>
                                        <Trash2 className='mr-2 size-4' />
                                        删除
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
                            删除短链
                        </DialogTitle>
                        <DialogDescription>
                            删除后短链将不再跳转。此操作会写入审计日志。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => setPendingDelete(null)}>
                            取消
                        </Button>
                        <Button type='button' variant='destructive' onClick={deleteLink} disabled={Boolean(pendingDelete && busyKey === `delete-${pendingDelete.id}`)}>
                            {pendingDelete && busyKey === `delete-${pendingDelete.id}` && <Loader2 className='mr-2 size-4 animate-spin' />}
                            确认删除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
