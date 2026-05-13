'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Clipboard, Edit3, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
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

function StatusPill({ active, labels = ['启用', '停用'] }: { active: boolean; labels?: [string, string] }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
            )}>
            {active ? labels[0] : labels[1]}
        </span>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='space-y-2'>
            <Label className='text-xs font-medium text-muted-foreground'>{label}</Label>
            {children}
        </div>
    );
}

function formatTimeRange(startsAt: string | null, endsAt: string | null): string {
    const start = startsAt ? new Date(startsAt).toLocaleString() : '立即';
    const end = endsAt ? new Date(endsAt).toLocaleString() : '长期';
    return `${start} - ${end}`;
}

export function PromoAdminClient({
    initialSlots,
    initialConfigs,
    initialItems,
    initialShareProfiles
}: PromoAdminClientProps) {
    const searchParams = useSearchParams();
    const [slots, setSlots] = React.useState(initialSlots);
    const [configs, setConfigs] = React.useState(initialConfigs);
    const [items, setItems] = React.useState(initialItems);
    const [slotDraft, setSlotDraft] = React.useState<SlotDraft>(emptySlotDraft);
    const [editingSlotId, setEditingSlotId] = React.useState<string>('');
    const [activeScope, setActiveScope] = React.useState<PromoScope>(() => searchParams.get('scope') === 'share' ? 'share' : 'global');
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');

    const slotById = React.useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
    const profileById = React.useMemo(() => new Map(initialShareProfiles.map((profile) => [profile.id, profile])), [initialShareProfiles]);
    const itemCountByConfigId = React.useMemo(() => {
        const counts = new Map<string, number>();
        for (const item of items) counts.set(item.configId, (counts.get(item.configId) || 0) + 1);
        return counts;
    }, [items]);

    const scopedConfigs = React.useMemo(
        () => configs.filter((config) => config.scope === activeScope),
        [activeScope, configs]
    );

    const reload = React.useCallback(async (options?: { notify?: boolean }) => {
        setBusyKey('reload');
        setError('');
        try {
            const [slotPayload, configPayload, itemPayload] = await Promise.all([
                requestJson<{ slots: AdminPromoSlot[] }>('/api/admin/promo/slots'),
                requestJson<{ configs: AdminPromoConfig[] }>('/api/admin/promo/configs'),
                requestJson<{ items: AdminPromoItem[] }>('/api/admin/promo/items')
            ]);
            setSlots(slotPayload.slots);
            setConfigs(configPayload.configs);
            setItems(itemPayload.items);
            if (options?.notify !== false) setMessage('数据已刷新。');
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
                setMessage('广告位已更新。');
            } else {
                await requestJson('/api/admin/promo/slots', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setMessage('广告位已创建。');
            }
            setSlotDraft(emptySlotDraft);
            setEditingSlotId('');
        });
    };

    const copyProfileId = async (profileId: string) => {
        try {
            await navigator.clipboard.writeText(profileId);
            setMessage('Profile ID 已复制。');
        } catch {
            setError('复制失败，请手动选中 Profile ID。');
        }
    };

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <h1 className='text-2xl font-semibold'>推广位管理</h1>
                    <p className='mt-1 text-sm text-muted-foreground'>管理员统一创建全局广告组和分享广告组，分享广告组会自动生成 Profile ID。</p>
                </div>
                <Button type='button' variant='outline' size='sm' onClick={() => reload()} disabled={busyKey === 'reload'}>
                    {busyKey === 'reload' ? <Loader2 className='size-4 animate-spin' /> : <RefreshCw className='size-4' />}
                    刷新
                </Button>
            </div>

            {error && <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>{error}</div>}
            {message && <div className='rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'>{message}</div>}

            <Card>
                <CardHeader>
                    <CardTitle>广告位</CardTitle>
                    <CardDescription>控制展示位置启停、默认轮播间隔和切换方式；编辑直接在对应广告位卡片内完成。</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {!editingSlotId && (
                        <form onSubmit={saveSlot} className='grid gap-3 rounded-md border p-3 md:grid-cols-6'>
                            <Field label='Key'>
                                <Input value={slotDraft.key} onChange={(event) => setSlotDraft((draft) => ({ ...draft, key: event.target.value }))} placeholder='custom_banner' />
                            </Field>
                            <Field label='名称'>
                                <Input value={slotDraft.name} onChange={(event) => setSlotDraft((draft) => ({ ...draft, name: event.target.value }))} />
                            </Field>
                            <Field label='说明'>
                                <Input value={slotDraft.description} onChange={(event) => setSlotDraft((draft) => ({ ...draft, description: event.target.value }))} />
                            </Field>
                            <Field label='间隔 ms'>
                                <Input type='number' min={3000} value={slotDraft.defaultIntervalMs} onChange={(event) => setSlotDraft((draft) => ({ ...draft, defaultIntervalMs: event.target.value }))} />
                            </Field>
                            <Field label='切换'>
                                <select
                                    className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                                    value={slotDraft.defaultTransition}
                                    onChange={(event) => setSlotDraft((draft) => ({ ...draft, defaultTransition: event.target.value as PromoTransition }))}>
                                    <option value='fade'>fade</option>
                                    <option value='slide'>slide</option>
                                    <option value='none'>none</option>
                                </select>
                            </Field>
                            <div className='flex items-end'>
                                <Button type='submit' disabled={busyKey === 'slot-save' || !slotDraft.name || !slotDraft.key}>
                                    {busyKey === 'slot-save' ? <Loader2 className='size-4 animate-spin' /> : <Plus className='size-4' />}
                                    新增
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
                                                <Field label='名称'>
                                                    <Input value={slotDraft.name} onChange={(event) => setSlotDraft((draft) => ({ ...draft, name: event.target.value }))} />
                                                </Field>
                                                <Field label='间隔 ms'>
                                                    <Input type='number' min={3000} value={slotDraft.defaultIntervalMs} onChange={(event) => setSlotDraft((draft) => ({ ...draft, defaultIntervalMs: event.target.value }))} />
                                                </Field>
                                            </div>
                                            <Field label='说明'>
                                                <Input value={slotDraft.description} onChange={(event) => setSlotDraft((draft) => ({ ...draft, description: event.target.value }))} />
                                            </Field>
                                            <div className='grid gap-3 sm:grid-cols-2'>
                                                <Field label='切换'>
                                                    <select
                                                        className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                                                        value={slotDraft.defaultTransition}
                                                        onChange={(event) => setSlotDraft((draft) => ({ ...draft, defaultTransition: event.target.value as PromoTransition }))}>
                                                        <option value='fade'>fade</option>
                                                        <option value='slide'>slide</option>
                                                        <option value='none'>none</option>
                                                    </select>
                                                </Field>
                                                <label className='flex items-end gap-2 text-sm'>
                                                    <input type='checkbox' checked={slotDraft.enabled} onChange={(event) => setSlotDraft((draft) => ({ ...draft, enabled: event.target.checked }))} />
                                                    启用
                                                </label>
                                            </div>
                                            <div className='flex gap-2'>
                                                <Button type='submit' disabled={busyKey === 'slot-save' || !slotDraft.name}>
                                                    {busyKey === 'slot-save' ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
                                                    保存
                                                </Button>
                                                <Button type='button' variant='outline' onClick={() => {
                                                    setEditingSlotId('');
                                                    setSlotDraft(emptySlotDraft);
                                                }}>
                                                    取消
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
                                                    <p className='mt-1 truncate font-mono text-xs text-muted-foreground'>{slot.key}</p>
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
                                                    编辑
                                                </Button>
                                            </div>
                                            <p className='mt-2 text-xs text-muted-foreground'>{slot.description || '无说明'}</p>
                                            <div className='mt-3 flex items-center justify-between text-xs text-muted-foreground'>
                                                <span>{slot.defaultIntervalMs} ms</span>
                                                <span>{slot.defaultTransition}</span>
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
                        <CardTitle>广告组</CardTitle>
                        <CardDescription>全局广告组和分享广告组分开管理；素材在广告组的子页面维护。</CardDescription>
                    </div>
                    <Button asChild>
                        <Link href={`/admin/promo/configs/new?scope=${activeScope}`}>
                            <Plus className='size-4' />
                            新增{activeScope === 'global' ? '全局' : '分享'}广告组
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div className='inline-flex rounded-md border bg-muted/40 p-1'>
                        {([
                            ['global', '全局广告组'],
                            ['share', '分享广告组']
                        ] as const).map(([scope, label]) => (
                            <button
                                key={scope}
                                type='button'
                                onClick={() => setActiveScope(scope)}
                                className={cn(
                                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                                    activeScope === scope ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                )}>
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className='overflow-x-auto rounded-md border'>
                        <table className='w-full min-w-[980px] text-sm'>
                            <thead className='bg-muted/60 text-left text-xs text-muted-foreground'>
                                <tr>
                                    <th className='px-3 py-2'>名称</th>
                                    <th className='px-3 py-2'>广告位</th>
                                    {activeScope === 'share' && <th className='px-3 py-2'>Profile ID</th>}
                                    <th className='px-3 py-2'>状态</th>
                                    <th className='px-3 py-2'>轮播</th>
                                    <th className='px-3 py-2'>素材数</th>
                                    <th className='px-3 py-2'>时间窗</th>
                                    <th className='px-3 py-2 text-right'>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scopedConfigs.map((config) => {
                                    const profile = config.shareProfileId ? profileById.get(config.shareProfileId) : null;
                                    return (
                                        <tr key={config.id} className='border-t align-top'>
                                            <td className='px-3 py-2'>
                                                <div className='font-medium'>{config.name}</div>
                                                {config.note && <div className='mt-1 line-clamp-2 text-xs text-muted-foreground'>{config.note}</div>}
                                            </td>
                                            <td className='px-3 py-2'>{slotById.get(config.slotId)?.name || config.slotId}</td>
                                            {activeScope === 'share' && (
                                                <td className='px-3 py-2'>
                                                    {profile ? (
                                                        <div className='flex items-center gap-2'>
                                                            <code className='rounded bg-muted px-2 py-1 text-xs'>{profile.publicId}</code>
                                                            <Button type='button' variant='outline' size='sm' onClick={() => copyProfileId(profile.publicId)}>
                                                                <Clipboard className='size-4' />
                                                                复制
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className='text-muted-foreground'>未生成</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className='px-3 py-2'><StatusPill active={config.enabled} /></td>
                                            <td className='px-3 py-2'>{config.intervalMs || '继承'} / {config.transition || '继承'}</td>
                                            <td className='px-3 py-2'>{itemCountByConfigId.get(config.id) || 0}</td>
                                            <td className='px-3 py-2 text-xs text-muted-foreground'>{formatTimeRange(config.startsAt, config.endsAt)}</td>
                                            <td className='px-3 py-2'>
                                                <div className='flex justify-end gap-2'>
                                                    <Button asChild variant='outline' size='sm'>
                                                        <Link href={`/admin/promo/configs/${config.id}/items`}>管理素材</Link>
                                                    </Button>
                                                    <Button asChild variant='outline' size='sm'>
                                                        <Link href={`/admin/promo/configs/${config.id}/edit`}>
                                                            <Edit3 className='size-4' />
                                                            编辑
                                                        </Link>
                                                    </Button>
                                                    <Button type='button' variant='outline' size='sm' onClick={() => runMutation(`config-toggle-${config.id}`, async () => {
                                                        await requestJson(`/api/admin/promo/configs/${config.id}`, {
                                                            method: 'PUT',
                                                            body: JSON.stringify({ enabled: !config.enabled })
                                                        });
                                                        setMessage(config.enabled ? '广告组已停用。' : '广告组已恢复。');
                                                    })}>
                                                        {config.enabled ? '停用' : '恢复'}
                                                    </Button>
                                                    <Button type='button' variant='outline' size='sm' onClick={() => runMutation(`config-delete-${config.id}`, async () => {
                                                        await requestJson(`/api/admin/promo/configs/${config.id}`, { method: 'DELETE' });
                                                        setMessage('广告组已删除。');
                                                    })}>
                                                        <Trash2 className='size-4' />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {scopedConfigs.length === 0 && (
                                    <tr>
                                        <td colSpan={activeScope === 'share' ? 8 : 7} className='px-3 py-8 text-center text-sm text-muted-foreground'>
                                            暂无{activeScope === 'global' ? '全局' : '分享'}广告组。
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
