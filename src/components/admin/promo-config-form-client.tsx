'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, Clipboard, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

type PromoTransition = 'fade' | 'slide' | 'none';
type PromoScope = 'global' | 'share';

type PromoSlotOption = {
    id: string;
    name: string;
    key: string;
};

type PromoConfigFormRecord = {
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
};

type PromoShareProfileRecord = {
    id: string;
    publicId: string;
};

type PromoConfigFormClientProps = {
    mode: 'create' | 'edit';
    scope: PromoScope;
    slots: PromoSlotOption[];
    config?: PromoConfigFormRecord | null;
    shareProfile?: PromoShareProfileRecord | null;
};

type Draft = {
    name: string;
    note: string;
    slotId: string;
    enabled: boolean;
    intervalMs: string;
    transition: PromoTransition;
    startsAt: string;
    endsAt: string;
};

function toDateTimeInput(value: string | null | undefined): string {
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
                ? ((payload as { error: string }).error || '保存失败。')
                : '保存失败。';
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

export function PromoConfigFormClient({ mode, scope, slots, config, shareProfile }: PromoConfigFormClientProps) {
    const router = useRouter();
    const [draft, setDraft] = React.useState<Draft>(() => ({
        name: config?.name || '',
        note: config?.note || '',
        slotId: config?.slotId || slots[0]?.id || '',
        enabled: config?.enabled ?? true,
        intervalMs: config?.intervalMs ? String(config.intervalMs) : '',
        transition: config?.transition || 'fade',
        startsAt: toDateTimeInput(config?.startsAt),
        endsAt: toDateTimeInput(config?.endsAt)
    }));
    const [error, setError] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [profileCopied, setProfileCopied] = React.useState(false);
    const profileCopiedTimerRef = React.useRef<number | null>(null);

    const title = mode === 'create' ? `新增${scope === 'global' ? '全局' : '分享'}展示组` : `编辑${scope === 'global' ? '全局' : '分享'}展示组`;

    React.useEffect(() => {
        return () => {
            if (profileCopiedTimerRef.current) window.clearTimeout(profileCopiedTimerRef.current);
        };
    }, []);

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const body = {
                name: draft.name,
                note: draft.note || null,
                slotId: draft.slotId,
                scope,
                enabled: draft.enabled,
                intervalMs: draft.intervalMs ? Number(draft.intervalMs) : null,
                transition: draft.transition,
                startsAt: fromDateTimeInput(draft.startsAt),
                endsAt: fromDateTimeInput(draft.endsAt)
            };
            if (mode === 'edit' && config) {
                await requestJson(`/api/admin/promo/configs/${config.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(body)
                });
            } else {
                await requestJson('/api/admin/promo/configs', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
            }
            router.push(`/admin/promo?scope=${scope}`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败。');
        } finally {
            setSaving(false);
        }
    };

    const copyProfileId = async () => {
        if (!shareProfile?.publicId) return;
        try {
            await navigator.clipboard.writeText(shareProfile.publicId);
            setProfileCopied(true);
            if (profileCopiedTimerRef.current) window.clearTimeout(profileCopiedTimerRef.current);
            profileCopiedTimerRef.current = window.setTimeout(() => {
                setProfileCopied(false);
                profileCopiedTimerRef.current = null;
            }, 2000);
        } catch {
            setError('复制失败，请手动选中 Profile ID。');
        }
    };

    return (
        <div className='space-y-6'>
            <div>
                <h1 className='text-2xl font-semibold'>{title}</h1>
                <p className='mt-1 text-sm text-muted-foreground'>
                    {scope === 'share'
                        ? '分享展示组由管理员创建，系统自动生成 Profile ID，再交给用户填入分享链接。'
                        : '全局展示组用于普通访问兜底展示。'}
                </p>
            </div>

            {error && <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>{error}</div>}

            <Card>
                <CardHeader>
                    <CardTitle>展示组信息</CardTitle>
                    <CardDescription>名称和备注只面向后台管理员；开始/结束时间决定展示组是否可被公共读取接口选中。</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className='grid gap-4 md:grid-cols-2'>
                        <Field label='名称'>
                            <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required />
                        </Field>
                        <Field label='展示位'>
                            <select
                                className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                                value={draft.slotId}
                                onChange={(event) => setDraft((current) => ({ ...current, slotId: event.target.value }))}>
                                {slots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>
                                        {slot.name} / {slot.key}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className='md:col-span-2'>
                            <Field label='备注'>
                                <Textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder='投放目的、客户、素材来源或审核说明' />
                            </Field>
                        </div>
                        <Field label='间隔 ms'>
                            <Input type='number' min={3000} value={draft.intervalMs} onChange={(event) => setDraft((current) => ({ ...current, intervalMs: event.target.value }))} placeholder='继承展示位默认值' />
                        </Field>
                        <Field label='切换'>
                            <select
                                className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                                value={draft.transition}
                                onChange={(event) => setDraft((current) => ({ ...current, transition: event.target.value as PromoTransition }))}>
                                <option value='fade'>fade</option>
                                <option value='slide'>slide</option>
                                <option value='none'>none</option>
                            </select>
                        </Field>
                        <Field label='开始'>
                            <Input type='datetime-local' value={draft.startsAt} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))} />
                        </Field>
                        <Field label='结束'>
                            <Input type='datetime-local' value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} />
                        </Field>
                        <label className='flex items-center gap-2 text-sm'>
                            <input type='checkbox' checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
                            启用展示组
                        </label>
                        {scope === 'share' && (
                            <div className='rounded-md border bg-muted/30 p-3 text-sm md:col-span-2'>
                                <div className='font-medium'>Profile ID</div>
                                {shareProfile ? (
                                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                                        <code className='rounded bg-background px-2 py-1 text-xs'>{shareProfile.publicId}</code>
                                        <Button type='button' variant='outline' size='sm' onClick={copyProfileId}>
                                            {profileCopied ? <Check className='size-4' /> : <Clipboard className='size-4' />}
                                            复制 ID
                                        </Button>
                                        {profileCopied && (
                                            <span className='rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300'>
                                                已复制
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <p className='mt-2 text-muted-foreground'>保存后自动生成，管理员再把这个 ID 给用户填写到分享链接中。</p>
                                )}
                            </div>
                        )}
                        <div className='flex gap-2 md:col-span-2'>
                            <Button type='submit' disabled={saving || !draft.name || !draft.slotId}>
                                {saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
                                保存
                            </Button>
                            <Button type='button' variant='outline' onClick={() => router.push(`/admin/promo?scope=${scope}`)}>
                                取消
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
