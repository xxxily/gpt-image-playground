'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Edit3, Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import * as React from 'react';

type PromoTransition = 'fade' | 'slide' | 'none';
type PromoScope = 'global' | 'share';
type PromoDevice = 'all' | 'desktop' | 'mobile';

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

type PromoAdminClientProps = {
    initialSlots: AdminPromoSlot[];
    initialConfigs: AdminPromoConfig[];
    initialItems: AdminPromoItem[];
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

type ConfigDraft = {
    id: string;
    slotId: string;
    scope: PromoScope;
    shareProfileId: string;
    enabled: boolean;
    intervalMs: string;
    transition: PromoTransition;
    startsAt: string;
    endsAt: string;
};

type ItemDraft = {
    id: string;
    configId: string;
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

const emptySlotDraft: SlotDraft = {
    id: '',
    key: '',
    name: '',
    description: '',
    enabled: true,
    defaultIntervalMs: '5000',
    defaultTransition: 'fade'
};

const emptyConfigDraft: ConfigDraft = {
    id: '',
    slotId: '',
    scope: 'global',
    shareProfileId: '',
    enabled: true,
    intervalMs: '',
    transition: 'fade',
    startsAt: '',
    endsAt: ''
};

const emptyItemDraft: ItemDraft = {
    id: '',
    configId: '',
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

export function PromoAdminClient({ initialSlots, initialConfigs, initialItems }: PromoAdminClientProps) {
    const [slots, setSlots] = React.useState(initialSlots);
    const [configs, setConfigs] = React.useState(initialConfigs);
    const [items, setItems] = React.useState(initialItems);
    const [slotDraft, setSlotDraft] = React.useState<SlotDraft>(emptySlotDraft);
    const [configDraft, setConfigDraft] = React.useState<ConfigDraft>({
        ...emptyConfigDraft,
        slotId: initialSlots[0]?.id || ''
    });
    const [itemDraft, setItemDraft] = React.useState<ItemDraft>({
        ...emptyItemDraft,
        configId: initialConfigs[0]?.id || ''
    });
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');

    const slotById = React.useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
    const configById = React.useMemo(() => new Map(configs.map((config) => [config.id, config])), [configs]);

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
            if (options?.notify !== false) {
                setMessage('数据已刷新。');
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
        });
    };

    const saveConfig = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runMutation('config-save', async () => {
            const body = {
                slotId: configDraft.slotId,
                scope: configDraft.scope,
                shareProfileId: configDraft.scope === 'share' ? configDraft.shareProfileId || null : null,
                enabled: configDraft.enabled,
                intervalMs: configDraft.intervalMs ? Number(configDraft.intervalMs) : null,
                transition: configDraft.transition,
                startsAt: fromDateTimeInput(configDraft.startsAt),
                endsAt: fromDateTimeInput(configDraft.endsAt)
            };
            if (configDraft.id) {
                await requestJson(`/api/admin/promo/configs/${configDraft.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(body)
                });
                setMessage('广告配置已更新。');
            } else {
                await requestJson('/api/admin/promo/configs', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setMessage('广告配置已创建。');
            }
            setConfigDraft({ ...emptyConfigDraft, slotId: slots[0]?.id || '' });
        });
    };

    const saveItem = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runMutation('item-save', async () => {
            const body = {
                configId: itemDraft.configId,
                title: itemDraft.title,
                alt: itemDraft.alt,
                desktopImageUrl: itemDraft.desktopImageUrl,
                mobileImageUrl: itemDraft.mobileImageUrl,
                linkUrl: itemDraft.linkUrl,
                device: itemDraft.device,
                enabled: itemDraft.enabled,
                sortOrder: Number(itemDraft.sortOrder || 0),
                weight: Number(itemDraft.weight || 100),
                startsAt: fromDateTimeInput(itemDraft.startsAt),
                endsAt: fromDateTimeInput(itemDraft.endsAt)
            };
            if (itemDraft.id) {
                await requestJson(`/api/admin/promo/items/${itemDraft.id}`, {
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
            setItemDraft({ ...emptyItemDraft, configId: configs[0]?.id || '' });
        });
    };

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <h1 className='text-2xl font-semibold'>推广位管理</h1>
                    <p className='mt-1 text-sm text-muted-foreground'>管理广告位、全局配置和 URL 素材。保存后公共读取接口立即生效。</p>
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
                    <CardDescription>控制位置启停、默认轮播间隔和切换方式。</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <form onSubmit={saveSlot} className='grid gap-3 rounded-md border p-3 md:grid-cols-6'>
                        <Field label='Key'>
                            <Input value={slotDraft.key} disabled={Boolean(slotDraft.id)} onChange={(event) => setSlotDraft((draft) => ({ ...draft, key: event.target.value }))} placeholder='custom_banner' />
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
                        <div className='flex items-end gap-2'>
                            <Button type='submit' disabled={busyKey === 'slot-save' || !slotDraft.name || !slotDraft.key}>
                                {busyKey === 'slot-save' ? <Loader2 className='size-4 animate-spin' /> : slotDraft.id ? <Save className='size-4' /> : <Plus className='size-4' />}
                                {slotDraft.id ? '保存' : '新增'}
                            </Button>
                            {slotDraft.id && (
                                <Button type='button' variant='outline' onClick={() => setSlotDraft(emptySlotDraft)}>
                                    取消
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className='grid gap-3 xl:grid-cols-3'>
                        {slots.map((slot) => (
                            <div key={slot.id} className='rounded-md border p-3'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <div className='flex items-center gap-2'>
                                            <p className='truncate text-sm font-semibold'>{slot.name}</p>
                                            <StatusPill active={slot.enabled} />
                                        </div>
                                        <p className='mt-1 truncate font-mono text-xs text-muted-foreground'>{slot.key}</p>
                                    </div>
                                    <Button type='button' variant='outline' size='sm' onClick={() => setSlotDraft({
                                        id: slot.id,
                                        key: slot.key,
                                        name: slot.name,
                                        description: slot.description || '',
                                        enabled: slot.enabled,
                                        defaultIntervalMs: String(slot.defaultIntervalMs),
                                        defaultTransition: slot.defaultTransition
                                    })}>
                                        <Edit3 className='size-4' />
                                        编辑
                                    </Button>
                                </div>
                                <p className='mt-2 text-xs text-muted-foreground'>{slot.description || '无说明'}</p>
                                <div className='mt-3 flex items-center justify-between text-xs text-muted-foreground'>
                                    <span>{slot.defaultIntervalMs} ms</span>
                                    <span>{slot.defaultTransition}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>全局配置</CardTitle>
                    <CardDescription>一个广告位可以有多组配置；公共读取会选择最近更新且有效的全局配置。</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <form onSubmit={saveConfig} className='grid gap-3 rounded-md border p-3 md:grid-cols-6'>
                        <Field label='广告位'>
                            <select className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm' value={configDraft.slotId} onChange={(event) => setConfigDraft((draft) => ({ ...draft, slotId: event.target.value }))}>
                                {slots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>
                                        {slot.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label='范围'>
                            <select className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm' value={configDraft.scope} onChange={(event) => setConfigDraft((draft) => ({ ...draft, scope: event.target.value as PromoScope }))}>
                                <option value='global'>global</option>
                                <option value='share'>share</option>
                            </select>
                        </Field>
                        <Field label='间隔 ms'>
                            <Input type='number' min={3000} value={configDraft.intervalMs} onChange={(event) => setConfigDraft((draft) => ({ ...draft, intervalMs: event.target.value }))} placeholder='继承广告位' />
                        </Field>
                        <Field label='切换'>
                            <select className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm' value={configDraft.transition} onChange={(event) => setConfigDraft((draft) => ({ ...draft, transition: event.target.value as PromoTransition }))}>
                                <option value='fade'>fade</option>
                                <option value='slide'>slide</option>
                                <option value='none'>none</option>
                            </select>
                        </Field>
                        <Field label='开始'>
                            <Input type='datetime-local' value={configDraft.startsAt} onChange={(event) => setConfigDraft((draft) => ({ ...draft, startsAt: event.target.value }))} />
                        </Field>
                        <Field label='结束'>
                            <Input type='datetime-local' value={configDraft.endsAt} onChange={(event) => setConfigDraft((draft) => ({ ...draft, endsAt: event.target.value }))} />
                        </Field>
                        {configDraft.scope === 'share' && (
                            <div className='md:col-span-5'>
                                <Field label='分享 Profile ID'>
                                    <Input value={configDraft.shareProfileId} onChange={(event) => setConfigDraft((draft) => ({ ...draft, shareProfileId: event.target.value }))} />
                                </Field>
                            </div>
                        )}
                        <label className='flex items-end gap-2 text-sm'>
                            <input type='checkbox' checked={configDraft.enabled} onChange={(event) => setConfigDraft((draft) => ({ ...draft, enabled: event.target.checked }))} />
                            启用
                        </label>
                        <div className='flex items-end gap-2 md:col-span-6'>
                            <Button type='submit' disabled={busyKey === 'config-save' || !configDraft.slotId}>
                                {busyKey === 'config-save' ? <Loader2 className='size-4 animate-spin' /> : configDraft.id ? <Save className='size-4' /> : <Plus className='size-4' />}
                                {configDraft.id ? '保存配置' : '新增配置'}
                            </Button>
                            {configDraft.id && (
                                <Button type='button' variant='outline' onClick={() => setConfigDraft({ ...emptyConfigDraft, slotId: slots[0]?.id || '' })}>
                                    取消
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className='overflow-x-auto rounded-md border'>
                        <table className='w-full min-w-[780px] text-sm'>
                            <thead className='bg-muted/60 text-left text-xs text-muted-foreground'>
                                <tr>
                                    <th className='px-3 py-2'>广告位</th>
                                    <th className='px-3 py-2'>范围</th>
                                    <th className='px-3 py-2'>状态</th>
                                    <th className='px-3 py-2'>轮播</th>
                                    <th className='px-3 py-2'>时间窗</th>
                                    <th className='px-3 py-2 text-right'>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {configs.map((config) => (
                                    <tr key={config.id} className='border-t'>
                                        <td className='px-3 py-2'>{slotById.get(config.slotId)?.name || config.slotId}</td>
                                        <td className='px-3 py-2 font-mono text-xs'>{config.scope}</td>
                                        <td className='px-3 py-2'><StatusPill active={config.enabled} /></td>
                                        <td className='px-3 py-2'>{config.intervalMs || '继承'} / {config.transition || '继承'}</td>
                                        <td className='px-3 py-2 text-xs text-muted-foreground'>{config.startsAt ? new Date(config.startsAt).toLocaleString() : '立即'} - {config.endsAt ? new Date(config.endsAt).toLocaleString() : '长期'}</td>
                                        <td className='px-3 py-2'>
                                            <div className='flex justify-end gap-2'>
                                                <Button type='button' variant='outline' size='sm' onClick={() => setConfigDraft({
                                                    id: config.id,
                                                    slotId: config.slotId,
                                                    scope: config.scope,
                                                    shareProfileId: config.shareProfileId || '',
                                                    enabled: config.enabled,
                                                    intervalMs: config.intervalMs ? String(config.intervalMs) : '',
                                                    transition: config.transition || 'fade',
                                                    startsAt: toDateTimeInput(config.startsAt),
                                                    endsAt: toDateTimeInput(config.endsAt)
                                                })}>
                                                    <Edit3 className='size-4' />
                                                    编辑
                                                </Button>
                                                <Button type='button' variant='outline' size='sm' onClick={() => runMutation(`config-toggle-${config.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/configs/${config.id}`, {
                                                        method: 'PUT',
                                                        body: JSON.stringify({ enabled: !config.enabled })
                                                    });
                                                    setMessage(config.enabled ? '配置已停用。' : '配置已恢复。');
                                                })}>
                                                    {config.enabled ? '停用' : '恢复'}
                                                </Button>
                                                <Button type='button' variant='outline' size='sm' onClick={() => runMutation(`config-delete-${config.id}`, async () => {
                                                    await requestJson(`/api/admin/promo/configs/${config.id}`, { method: 'DELETE' });
                                                    setMessage('配置已删除。');
                                                })}>
                                                    <Trash2 className='size-4' />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>素材</CardTitle>
                    <CardDescription>第一期只支持图片 URL，保存时会做服务端安全校验。</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <form onSubmit={saveItem} className='grid gap-3 rounded-md border p-3 md:grid-cols-6'>
                        <Field label='配置'>
                            <select className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm' value={itemDraft.configId} onChange={(event) => setItemDraft((draft) => ({ ...draft, configId: event.target.value }))}>
                                {configs.map((config) => (
                                    <option key={config.id} value={config.id}>
                                        {(slotById.get(config.slotId)?.name || config.slotId) + ` / ${config.scope}`}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label='标题'>
                            <Input value={itemDraft.title} onChange={(event) => setItemDraft((draft) => ({ ...draft, title: event.target.value }))} />
                        </Field>
                        <Field label='替代文本'>
                            <Input value={itemDraft.alt} onChange={(event) => setItemDraft((draft) => ({ ...draft, alt: event.target.value }))} />
                        </Field>
                        <Field label='设备'>
                            <select className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm' value={itemDraft.device} onChange={(event) => setItemDraft((draft) => ({ ...draft, device: event.target.value as PromoDevice }))}>
                                <option value='all'>all</option>
                                <option value='desktop'>desktop</option>
                                <option value='mobile'>mobile</option>
                            </select>
                        </Field>
                        <Field label='排序'>
                            <Input type='number' value={itemDraft.sortOrder} onChange={(event) => setItemDraft((draft) => ({ ...draft, sortOrder: event.target.value }))} />
                        </Field>
                        <Field label='权重'>
                            <Input type='number' min={0} value={itemDraft.weight} onChange={(event) => setItemDraft((draft) => ({ ...draft, weight: event.target.value }))} />
                        </Field>
                        <div className='md:col-span-3'>
                            <Field label='桌面图 URL'>
                                <Input value={itemDraft.desktopImageUrl} onChange={(event) => setItemDraft((draft) => ({ ...draft, desktopImageUrl: event.target.value }))} placeholder='/ad/banner.webp 或 https://...' />
                            </Field>
                        </div>
                        <div className='md:col-span-3'>
                            <Field label='移动图 URL'>
                                <Input value={itemDraft.mobileImageUrl} onChange={(event) => setItemDraft((draft) => ({ ...draft, mobileImageUrl: event.target.value }))} placeholder='/ad/banner-mobile.webp 或 https://...' />
                            </Field>
                        </div>
                        <div className='md:col-span-4'>
                            <Field label='点击链接'>
                                <Input value={itemDraft.linkUrl} onChange={(event) => setItemDraft((draft) => ({ ...draft, linkUrl: event.target.value }))} placeholder='https://example.com' />
                            </Field>
                        </div>
                        <Field label='开始'>
                            <Input type='datetime-local' value={itemDraft.startsAt} onChange={(event) => setItemDraft((draft) => ({ ...draft, startsAt: event.target.value }))} />
                        </Field>
                        <Field label='结束'>
                            <Input type='datetime-local' value={itemDraft.endsAt} onChange={(event) => setItemDraft((draft) => ({ ...draft, endsAt: event.target.value }))} />
                        </Field>
                        <label className='flex items-end gap-2 text-sm'>
                            <input type='checkbox' checked={itemDraft.enabled} onChange={(event) => setItemDraft((draft) => ({ ...draft, enabled: event.target.checked }))} />
                            启用
                        </label>
                        <div className='flex items-end gap-2 md:col-span-5'>
                            <Button type='submit' disabled={busyKey === 'item-save' || !itemDraft.configId || !itemDraft.title || !itemDraft.desktopImageUrl || !itemDraft.mobileImageUrl || !itemDraft.linkUrl}>
                                {busyKey === 'item-save' ? <Loader2 className='size-4 animate-spin' /> : itemDraft.id ? <Save className='size-4' /> : <Plus className='size-4' />}
                                {itemDraft.id ? '保存素材' : '新增素材'}
                            </Button>
                            {itemDraft.id && (
                                <Button type='button' variant='outline' onClick={() => setItemDraft({ ...emptyItemDraft, configId: configs[0]?.id || '' })}>
                                    取消
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className='grid gap-3 lg:grid-cols-2'>
                        {items.map((item) => {
                            const config = configById.get(item.configId);
                            return (
                                <div key={item.id} className='grid gap-3 rounded-md border p-3 sm:grid-cols-[160px_minmax(0,1fr)]'>
                                    <div className='overflow-hidden rounded-md border bg-muted'>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- Admin previews accept arbitrary external creative URLs. */}
                                        <img src={item.desktopImageUrl} alt={item.alt} className='aspect-[4/1] h-full w-full object-cover' loading='lazy' />
                                    </div>
                                    <div className='min-w-0 space-y-2'>
                                        <div className='flex items-start justify-between gap-2'>
                                            <div className='min-w-0'>
                                                <p className='truncate text-sm font-semibold'>{item.title}</p>
                                                <p className='truncate text-xs text-muted-foreground'>{slotById.get(config?.slotId || '')?.name || item.configId}</p>
                                            </div>
                                            <StatusPill active={item.enabled} />
                                        </div>
                                        <p className='truncate text-xs text-muted-foreground'>{item.linkUrl}</p>
                                        <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
                                            <span>{item.device}</span>
                                            <span>sort {item.sortOrder}</span>
                                            <span>weight {item.weight}</span>
                                        </div>
                                        <div className='flex flex-wrap justify-end gap-2'>
                                            <Button type='button' variant='outline' size='sm' onClick={() => setItemDraft({
                                                id: item.id,
                                                configId: item.configId,
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
                                            })}>
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
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
