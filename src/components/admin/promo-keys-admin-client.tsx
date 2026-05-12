'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Edit3, Loader2, Plus, RefreshCw, Save } from 'lucide-react';
import * as React from 'react';

type PromoShareKeyStatus = 'active' | 'disabled' | 'revoked';

export type AdminPromoShareKey = {
    id: string;
    name: string;
    note: string | null;
    tokenPrefix: string;
    status: PromoShareKeyStatus;
    expiresAt: string | null;
    allowedSlotsJson: string;
    createdByUserId: string | null;
    createdAt: string;
    updatedAt: string;
    lastUsedAt: string | null;
};

export type PromoSlotOption = {
    id: string;
    key: string;
    name: string;
};

type PromoKeysAdminClientProps = {
    initialKeys: AdminPromoShareKey[];
    slotOptions: PromoSlotOption[];
};

type ShareKeyDraft = {
    id: string;
    name: string;
    note: string;
    expiresAt: string;
    allowedSlots: string[];
    count: string;
};

const emptyShareKeyDraft: ShareKeyDraft = {
    id: '',
    name: '',
    note: '',
    expiresAt: '',
    allowedSlots: [],
    count: '1'
};

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    return fetch(url, {
        ...init,
        headers: {
            'content-type': 'application/json',
            ...(init?.headers || {})
        }
    }).then(async (response) => {
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
            const errorMessage =
                typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
                    ? ((payload as { error: string }).error || '操作失败。')
                    : '操作失败。';
            throw new Error(errorMessage);
        }
        return payload as T;
    });
}

function StatusPill({ status }: { status: PromoShareKeyStatus }) {
    const label = status === 'active' ? '启用' : status === 'disabled' ? '停用' : '撤销';
    const tone =
        status === 'active'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : status === 'disabled'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'bg-muted text-muted-foreground';
    return <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', tone)}>{label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='space-y-2'>
            <Label className='text-xs font-medium text-muted-foreground'>{label}</Label>
            {children}
        </div>
    );
}

function toDateTimeInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

export function PromoKeysAdminClient({ initialKeys, slotOptions }: PromoKeysAdminClientProps) {
    const [keys, setKeys] = React.useState(initialKeys);
    const [draft, setDraft] = React.useState<ShareKeyDraft>(emptyShareKeyDraft);
    const [issuedTokens, setIssuedTokens] = React.useState<Array<{ id: string; token: string }>>([]);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');

    const reload = React.useCallback(async (options?: { notify?: boolean }) => {
        setBusyKey('reload');
        try {
            const payload = await requestJson<{ keys: AdminPromoShareKey[] }>('/api/admin/promo/share-keys');
            setKeys(payload.keys);
            if (options?.notify !== false) {
                setMessage('权限 Key 已刷新。');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '刷新失败。');
        } finally {
            setBusyKey('');
        }
    }, []);

    const runMutation = async (key: string, action: () => Promise<void>) => {
        setBusyKey(key);
        setError('');
        setMessage('');
        try {
            await action();
            await reload({ notify: false });
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败。');
        } finally {
            setBusyKey('');
        }
    };

    const toggleSlot = (slotId: string) => {
        setDraft((current) => {
            const exists = current.allowedSlots.includes(slotId);
            return {
                ...current,
                allowedSlots: exists ? current.allowedSlots.filter((entry) => entry !== slotId) : [...current.allowedSlots, slotId]
            };
        });
    };

    const saveKey = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runMutation('share-key-save', async () => {
            const body = {
                name: draft.name,
                note: draft.note || null,
                expiresAt: draft.expiresAt || null,
                allowedSlots: draft.allowedSlots,
                count: Number(draft.count || 1)
            };
            if (draft.id) {
                await requestJson(`/api/admin/promo/share-keys/${draft.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: body.name,
                        note: body.note,
                        expiresAt: body.expiresAt,
                        allowedSlots: body.allowedSlots
                    })
                });
                setMessage('权限 Key 已更新。');
            } else if (body.count > 1) {
                const payload = await requestJson<{ keys: Array<{ key: AdminPromoShareKey; token: string }> }>('/api/admin/promo/share-keys/batch', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setIssuedTokens(payload.keys.map(({ key, token }) => ({ id: key.id, token })));
                setMessage(`已批量创建 ${payload.keys.length} 个权限 Key。`);
            } else {
                const payload = await requestJson<{ key: AdminPromoShareKey; token: string }>('/api/admin/promo/share-keys', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setIssuedTokens([{ id: payload.key.id, token: payload.token }]);
                setMessage('权限 Key 已创建。明文仅显示一次。');
            }
            setDraft(emptyShareKeyDraft);
        });
    };

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <h1 className='text-2xl font-semibold'>权限 Key 管理</h1>
                    <p className='mt-1 text-sm text-muted-foreground'>创建、批量创建、禁用和撤销分享广告权限 Key。</p>
                </div>
                <Button type='button' variant='outline' size='sm' onClick={() => reload()} disabled={busyKey === 'reload'}>
                    {busyKey === 'reload' ? <Loader2 className='size-4 animate-spin' /> : <RefreshCw className='size-4' />}
                    刷新
                </Button>
            </div>

            {error && <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>{error}</div>}
            {message && <div className='rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'>{message}</div>}

            {issuedTokens.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>一次性明文</CardTitle>
                        <CardDescription>这些 Key 只会在创建后显示一次，之后只保留哈希和前缀。</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-2'>
                        {issuedTokens.map((item) => (
                            <div key={item.id} className='rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs break-all'>
                                {item.token}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>创建 / 编辑</CardTitle>
                    <CardDescription>支持单个创建或批量创建，可限制广告位范围。</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={saveKey} className='grid gap-3 rounded-md border p-3 md:grid-cols-6'>
                        <Field label='名称'>
                            <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                        </Field>
                        <Field label='备注'>
                            <Input value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
                        </Field>
                        <Field label='过期时间'>
                            <Input type='datetime-local' value={draft.expiresAt} onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value }))} />
                        </Field>
                        <Field label='批量数量'>
                            <Input type='number' min={1} max={20} value={draft.count} onChange={(event) => setDraft((current) => ({ ...current, count: event.target.value }))} />
                        </Field>
                        <div className='md:col-span-6'>
                            <p className='mb-2 text-xs font-medium text-muted-foreground'>允许广告位</p>
                            <div className='flex flex-wrap gap-2'>
                                {slotOptions.map((slot) => (
                                    <button
                                        key={slot.id}
                                        type='button'
                                        onClick={() => toggleSlot(slot.id)}
                                        className={cn(
                                            'rounded-md border px-3 py-2 text-xs transition-colors',
                                            draft.allowedSlots.includes(slot.id) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/60'
                                        )}>
                                        {slot.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className='flex items-end gap-2 md:col-span-6'>
                            <Button type='submit' disabled={busyKey === 'share-key-save' || !draft.name}>
                                {busyKey === 'share-key-save' ? <Loader2 className='size-4 animate-spin' /> : draft.id ? <Save className='size-4' /> : <Plus className='size-4' />}
                                {draft.id ? '保存' : '创建'}
                            </Button>
                            {draft.id && (
                                <Button type='button' variant='outline' onClick={() => setDraft(emptyShareKeyDraft)}>
                                    取消
                                </Button>
                            )}
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>权限 Key 列表</CardTitle>
                    <CardDescription>状态变更会写入审计。</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {keys.map((key) => {
                        const allowedSlots = (() => {
                            try {
                                const parsed = JSON.parse(key.allowedSlotsJson);
                                return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
                            } catch {
                                return [];
                            }
                        })();
                        return (
                            <div key={key.id} className='space-y-3 rounded-md border p-3'>
                                <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                                    <div className='min-w-0'>
                                        <div className='flex items-center gap-2'>
                                            <p className='truncate text-sm font-semibold'>{key.name}</p>
                                            <StatusPill status={key.status} />
                                        </div>
                                        <p className='mt-1 text-xs text-muted-foreground'>
                                            前缀 {key.tokenPrefix} - {key.expiresAt ? new Date(key.expiresAt).toLocaleString() : '永久'}
                                        </p>
                                        <p className='mt-1 text-xs text-muted-foreground'>允许 {allowedSlots.length > 0 ? allowedSlots.join(', ') : '全部广告位'}</p>
                                        {key.note && <p className='mt-1 text-xs text-muted-foreground'>{key.note}</p>}
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() =>
                                                    setDraft({
                                                        id: key.id,
                                                        name: key.name,
                                                        note: key.note || '',
                                                        expiresAt: toDateTimeInput(key.expiresAt),
                                                        allowedSlots,
                                                        count: '1'
                                                    })
                                                }>
                                            <Edit3 className='size-4' />
                                            编辑
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() =>
                                                runMutation(`share-key-disable-${key.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/share-keys/${key.id}/disable`, { method: 'POST' });
                                                    setMessage('权限 Key 已停用。');
                                                })
                                            }>
                                            停用
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() =>
                                                runMutation(`share-key-revoke-${key.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/share-keys/${key.id}/revoke`, { method: 'POST' });
                                                    setMessage('权限 Key 已撤销。');
                                                })
                                            }>
                                            撤销
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() =>
                                                runMutation(`share-key-delete-${key.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/share-keys/${key.id}`, {
                                                        method: 'PUT',
                                                        body: JSON.stringify({ status: 'active' })
                                                    });
                                                    setMessage('权限 Key 已恢复。');
                                                })
                                            }>
                                            恢复
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
