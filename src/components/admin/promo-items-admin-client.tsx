'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Edit3, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

type PromoDevice = 'all' | 'desktop' | 'mobile';

type PromoConfig = {
    id: string;
    name: string;
    scope: 'global' | 'share';
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
            typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
                ? ((payload as { error: string }).error || '操作失败。')
                : '操作失败。';
        throw new Error(errorMessage);
    }
    return payload as T;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='space-y-2'>
            <Label className='text-xs font-medium text-muted-foreground'>{label}</Label>
            {children}
        </div>
    );
}

function StatusPill({ active }: { active: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
            )}>
            {active ? '启用' : '停用'}
        </span>
    );
}

export function PromoItemsAdminClient({ config, initialItems }: PromoItemsAdminClientProps) {
    const [items, setItems] = React.useState(initialItems);
    const [draft, setDraft] = React.useState<ItemDraft>(emptyItemDraft);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');

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
            setError(err instanceof Error ? err.message : '操作失败。');
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
                setMessage('素材已更新。');
            } else {
                await requestJson('/api/admin/promo/items', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setMessage('素材已创建。');
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

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <h1 className='text-2xl font-semibold'>管理素材</h1>
                    <p className='mt-1 text-sm text-muted-foreground'>
                        {config.name} / {config.scope === 'share' ? '分享广告组' : '全局广告组'}
                    </p>
                </div>
                <Button asChild variant='outline'>
                    <Link href={`/admin/promo?scope=${config.scope}`}>返回广告组</Link>
                </Button>
            </div>

            {error && <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>{error}</div>}
            {message && <div className='rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'>{message}</div>}

            <div className='grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]'>
                <Card className='xl:sticky xl:top-6 xl:self-start'>
                    <CardHeader>
                        <CardTitle>{draft.id ? '编辑素材' : '新增素材'}</CardTitle>
                        <CardDescription>素材只属于当前广告组；多张素材按排序值和权重展示。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={saveItem} className='space-y-3'>
                            <Field label='标题'>
                                <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
                            </Field>
                            <Field label='替代文本'>
                                <Input value={draft.alt} onChange={(event) => setDraft((current) => ({ ...current, alt: event.target.value }))} />
                            </Field>
                            <Field label='桌面图 URL'>
                                <Input value={draft.desktopImageUrl} onChange={(event) => setDraft((current) => ({ ...current, desktopImageUrl: event.target.value }))} placeholder='/ad/banner.webp 或 https://...' />
                            </Field>
                            <Field label='移动图 URL'>
                                <Input value={draft.mobileImageUrl} onChange={(event) => setDraft((current) => ({ ...current, mobileImageUrl: event.target.value }))} placeholder='/ad/banner-mobile.webp 或 https://...' />
                            </Field>
                            <Field label='点击链接'>
                                <Input value={draft.linkUrl} onChange={(event) => setDraft((current) => ({ ...current, linkUrl: event.target.value }))} placeholder='https://example.com' />
                            </Field>
                            <div className='grid grid-cols-3 gap-3'>
                                <Field label='设备'>
                                    <select
                                        className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                                        value={draft.device}
                                        onChange={(event) => setDraft((current) => ({ ...current, device: event.target.value as PromoDevice }))}>
                                        <option value='all'>all</option>
                                        <option value='desktop'>desktop</option>
                                        <option value='mobile'>mobile</option>
                                    </select>
                                </Field>
                                <Field label='排序'>
                                    <Input type='number' value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))} />
                                </Field>
                                <Field label='权重'>
                                    <Input type='number' min={0} value={draft.weight} onChange={(event) => setDraft((current) => ({ ...current, weight: event.target.value }))} />
                                </Field>
                            </div>
                            <div className='grid grid-cols-2 gap-3'>
                                <Field label='开始'>
                                    <Input type='datetime-local' value={draft.startsAt} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))} />
                                </Field>
                                <Field label='结束'>
                                    <Input type='datetime-local' value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} />
                                </Field>
                            </div>
                            <label className='flex items-center gap-2 text-sm'>
                                <input type='checkbox' checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                                启用素材
                            </label>
                            <div className='flex gap-2'>
                                <Button type='submit' disabled={busyKey === 'item-save' || !draft.title || !draft.desktopImageUrl || !draft.mobileImageUrl || !draft.linkUrl}>
                                    {busyKey === 'item-save' ? <Loader2 className='size-4 animate-spin' /> : draft.id ? <Save className='size-4' /> : <Plus className='size-4' />}
                                    {draft.id ? '保存素材' : '新增素材'}
                                </Button>
                                {draft.id && (
                                    <Button type='button' variant='outline' onClick={() => setDraft(emptyItemDraft)}>
                                        取消编辑
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>素材列表</CardTitle>
                        <CardDescription>当前广告组共 {items.length} 张素材。</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        {items.map((item) => (
                            <div key={item.id} className='grid gap-3 rounded-md border p-3 sm:grid-cols-[160px_minmax(0,1fr)]'>
                                <div className='overflow-hidden rounded-md border bg-muted'>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- Admin previews accept arbitrary external creative URLs. */}
                                    <img src={item.desktopImageUrl} alt={item.alt} className='aspect-[4/1] h-full w-full object-cover' loading='lazy' />
                                </div>
                                <div className='min-w-0 space-y-2'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <div className='min-w-0'>
                                            <p className='truncate text-sm font-semibold'>{item.title}</p>
                                            <p className='truncate text-xs text-muted-foreground'>{item.linkUrl}</p>
                                        </div>
                                        <StatusPill active={item.enabled} />
                                    </div>
                                    <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
                                        <span>{item.device}</span>
                                        <span>sort {item.sortOrder}</span>
                                        <span>weight {item.weight}</span>
                                    </div>
                                    <div className='flex flex-wrap justify-end gap-2'>
                                        <Button type='button' variant='outline' size='sm' onClick={() => startEdit(item)}>
                                            <Edit3 className='size-4' />
                                            编辑
                                        </Button>
                                        <Button type='button' variant='outline' size='sm' onClick={() => runMutation(`item-toggle-${item.id}`, async () => {
                                            await requestJson(`/api/admin/promo/items/${item.id}`, {
                                                method: 'PUT',
                                                body: JSON.stringify({ enabled: !item.enabled })
                                            });
                                            setMessage(item.enabled ? '素材已停用。' : '素材已恢复。');
                                        })}>
                                            {item.enabled ? '停用' : '恢复'}
                                        </Button>
                                        <Button type='button' variant='outline' size='sm' onClick={() => runMutation(`item-delete-${item.id}`, async () => {
                                            await requestJson(`/api/admin/promo/items/${item.id}`, { method: 'DELETE' });
                                            setMessage('素材已删除。');
                                        })}>
                                            <Trash2 className='size-4' />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
                                这个广告组还没有素材。
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
