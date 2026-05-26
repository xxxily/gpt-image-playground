'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    PROMO_ASPECT_RATIO_PRESETS,
    formatPromoAspectRatioLabel,
    getRecommendedPromoAspectRatioForSlot,
    normalizePromoAspectRatio,
    serializePromoAspectRatioCss,
    type PromoAspectRatio,
    type PromoAspectRatioSource
} from '@/lib/promo';
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
    aspectRatioWidth: number | null;
    aspectRatioHeight: number | null;
    aspectRatioLabel: string | null;
    aspectRatioSource: PromoAspectRatioSource | null;
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
    aspectRatioMode: 'preset' | 'custom';
    aspectRatioPresetId: string;
    aspectRatioWidth: string;
    aspectRatioHeight: string;
    startsAt: string;
    endsAt: string;
};

function getPresetIdByRatio(width: number | null | undefined, height: number | null | undefined): string {
    if (!width || !height) return '';
    return PROMO_ASPECT_RATIO_PRESETS.find((preset) => preset.width === width && preset.height === height)?.id || '';
}

function getRecommendedPresetForSlot(slotKey: string | null): PromoAspectRatio {
    return getRecommendedPromoAspectRatioForSlot(slotKey || '');
}

function buildInitialAspectRatioDraft(config: PromoConfigFormRecord | null | undefined, slotKey: string | null) {
    const recommended = getRecommendedPresetForSlot(slotKey);
    const presetId = getPresetIdByRatio(config?.aspectRatioWidth, config?.aspectRatioHeight);
    const source = config?.aspectRatioSource;
    const hasStoredRatio = Boolean(config?.aspectRatioWidth && config?.aspectRatioHeight);
    const width = config?.aspectRatioWidth || recommended.width;
    const height = config?.aspectRatioHeight || recommended.height;
    return {
        aspectRatioMode: source === 'custom' || (hasStoredRatio && !presetId) ? 'custom' as const : 'preset' as const,
        aspectRatioPresetId: presetId || getPresetIdByRatio(recommended.width, recommended.height) || PROMO_ASPECT_RATIO_PRESETS[0].id,
        aspectRatioWidth: String(width),
        aspectRatioHeight: String(height)
    };
}

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
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
                ? (payload as { error: string }).error || '保存失败。'
                : '保存失败。';
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

export function PromoConfigFormClient({ mode, scope, slots, config, shareProfile }: PromoConfigFormClientProps) {
    const router = useRouter();
    const { t } = useAppLanguage();
    const initialSlotKey = slots.find((slot) => slot.id === (config?.slotId || slots[0]?.id))?.key || null;
    const [draft, setDraft] = React.useState<Draft>(() => ({
        name: config?.name || '',
        note: config?.note || '',
        slotId: config?.slotId || slots[0]?.id || '',
        enabled: config?.enabled ?? true,
        intervalMs: config?.intervalMs ? String(config.intervalMs) : '',
        transition: config?.transition || 'fade',
        ...buildInitialAspectRatioDraft(config, initialSlotKey),
        startsAt: toDateTimeInput(config?.startsAt),
        endsAt: toDateTimeInput(config?.endsAt)
    }));
    const [error, setError] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [profileCopied, setProfileCopied] = React.useState(false);
    const profileCopiedTimerRef = React.useRef<number | null>(null);

    const title =
        mode === 'create'
            ? `新增${scope === 'global' ? '全局' : '分享'}展示组`
            : `编辑${scope === 'global' ? '全局' : '分享'}展示组`;
    const selectedSlotKey = React.useMemo(
        () => slots.find((slot) => slot.id === draft.slotId)?.key || null,
        [draft.slotId, slots]
    );
    const selectedAspectRatio = React.useMemo(() => {
        if (draft.aspectRatioMode === 'preset') {
            const preset =
                PROMO_ASPECT_RATIO_PRESETS.find((entry) => entry.id === draft.aspectRatioPresetId) ||
                PROMO_ASPECT_RATIO_PRESETS[0];
            return normalizePromoAspectRatio(preset.width, preset.height, 'preset');
        }
        return normalizePromoAspectRatio(Number(draft.aspectRatioWidth), Number(draft.aspectRatioHeight), 'custom');
    }, [draft.aspectRatioHeight, draft.aspectRatioMode, draft.aspectRatioPresetId, draft.aspectRatioWidth]);

    React.useEffect(() => {
        if (mode !== 'create' || !selectedSlotKey) return;
        const recommended = getRecommendedPresetForSlot(selectedSlotKey);
        const presetId = getPresetIdByRatio(recommended.width, recommended.height);
        setDraft((current) => {
            if (current.aspectRatioMode !== 'preset') return current;
            return {
                ...current,
                aspectRatioPresetId: presetId || current.aspectRatioPresetId,
                aspectRatioWidth: String(recommended.width),
                aspectRatioHeight: String(recommended.height)
            };
        });
    }, [mode, selectedSlotKey]);

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
                aspectRatioWidth: selectedAspectRatio?.width,
                aspectRatioHeight: selectedAspectRatio?.height,
                aspectRatioSource: selectedAspectRatio?.source,
                startsAt: fromDateTimeInput(draft.startsAt),
                endsAt: fromDateTimeInput(draft.endsAt)
            };
            if (!selectedAspectRatio) {
                throw new Error(t('promo.aspectRatio.invalid'));
            }
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
                <Heading level={1} size='section'>
                    {title}
                </Heading>
                <p className='text-muted-foreground mt-1 text-sm'>
                    {scope === 'share'
                        ? '分享展示组由管理员创建，系统自动生成 Profile ID，再交给用户填入分享链接。'
                        : '全局展示组用于普通访问兜底展示。'}
                </p>
            </div>

            {error && (
                <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>展示组信息</CardTitle>
                    <CardDescription>
                        名称和备注只面向后台管理员；开始/结束时间决定展示组是否可被公共读取接口选中。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className='grid gap-4 md:grid-cols-2'>
                        <Field label='名称'>
                            <Input
                                value={draft.name}
                                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                                required
                            />
                        </Field>
                        <Field label='展示位'>
                            <select
                                className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                value={draft.slotId}
                                onChange={(event) =>
                                    setDraft((current) => ({ ...current, slotId: event.target.value }))
                                }>
                                {slots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>
                                        {slot.name} / {slot.key}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className='md:col-span-2'>
                            <Field label={t('promo.aspectRatio.fieldLabel')}>
                                <div className='grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_160px]'>
                                    <div className='space-y-3'>
                                        <div className='grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]'>
                                            <select
                                                className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                                value={draft.aspectRatioMode}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        aspectRatioMode: event.target.value as Draft['aspectRatioMode']
                                                    }))
                                                }>
                                                <option value='preset'>{t('promo.aspectRatio.mode.preset')}</option>
                                                <option value='custom'>{t('promo.aspectRatio.mode.custom')}</option>
                                            </select>
                                            {draft.aspectRatioMode === 'preset' ? (
                                                <select
                                                    className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                                    value={draft.aspectRatioPresetId}
                                                    onChange={(event) => {
                                                        const preset =
                                                            PROMO_ASPECT_RATIO_PRESETS.find(
                                                                (entry) => entry.id === event.target.value
                                                            ) || PROMO_ASPECT_RATIO_PRESETS[0];
                                                        setDraft((current) => ({
                                                            ...current,
                                                            aspectRatioPresetId: preset.id,
                                                            aspectRatioWidth: String(preset.width),
                                                            aspectRatioHeight: String(preset.height)
                                                        }));
                                                    }}>
                                                    {PROMO_ASPECT_RATIO_PRESETS.map((preset) => (
                                                        <option key={preset.id} value={preset.id}>
                                                            {preset.label} / {t(`promo.aspectRatio.group.${preset.group}`)}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2'>
                                                    <Input
                                                        type='number'
                                                        min={1}
                                                        value={draft.aspectRatioWidth}
                                                        onChange={(event) =>
                                                            setDraft((current) => ({
                                                                ...current,
                                                                aspectRatioWidth: event.target.value
                                                            }))
                                                        }
                                                        aria-label={t('promo.aspectRatio.widthAria')}
                                                    />
                                                    <span className='text-muted-foreground text-sm'>:</span>
                                                    <Input
                                                        type='number'
                                                        min={1}
                                                        value={draft.aspectRatioHeight}
                                                        onChange={(event) =>
                                                            setDraft((current) => ({
                                                                ...current,
                                                                aspectRatioHeight: event.target.value
                                                            }))
                                                        }
                                                        aria-label={t('promo.aspectRatio.heightAria')}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <p className='text-muted-foreground text-xs leading-5'>
                                            {t('promo.aspectRatio.description')}
                                        </p>
                                        {!selectedAspectRatio && (
                                            <p className='text-xs text-red-600 dark:text-red-300'>
                                                {t('promo.aspectRatio.invalid')}
                                            </p>
                                        )}
                                    </div>
                                    <div className='space-y-2'>
                                        <div
                                            className='border-panel-divider bg-panel-ghost w-full rounded-md border'
                                            style={{
                                                aspectRatio: serializePromoAspectRatioCss(selectedAspectRatio)
                                            }}
                                            aria-hidden='true'
                                        />
                                        <p className='text-muted-foreground text-center font-mono text-xs' data-i18n-skip='true'>
                                            {selectedAspectRatio
                                                ? formatPromoAspectRatioLabel(
                                                      selectedAspectRatio.width,
                                                      selectedAspectRatio.height
                                                  )
                                                : 'Invalid'}
                                        </p>
                                    </div>
                                </div>
                            </Field>
                        </div>
                        <div className='md:col-span-2'>
                            <Field label='备注'>
                                <Textarea
                                    value={draft.note}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, note: event.target.value }))
                                    }
                                    placeholder='投放目的、客户、素材来源或审核说明'
                                />
                            </Field>
                        </div>
                        <Field label='间隔 ms'>
                            <Input
                                type='number'
                                min={3000}
                                value={draft.intervalMs}
                                onChange={(event) =>
                                    setDraft((current) => ({ ...current, intervalMs: event.target.value }))
                                }
                                placeholder='继承展示位默认值'
                            />
                        </Field>
                        <Field label='切换'>
                            <select
                                className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                value={draft.transition}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        transition: event.target.value as PromoTransition
                                    }))
                                }>
                                <option value='fade'>fade</option>
                                <option value='slide'>slide</option>
                                <option value='none'>none</option>
                            </select>
                        </Field>
                        <Field label='开始'>
                            <Input
                                type='datetime-local'
                                value={draft.startsAt}
                                onChange={(event) =>
                                    setDraft((current) => ({ ...current, startsAt: event.target.value }))
                                }
                            />
                        </Field>
                        <Field label='结束'>
                            <Input
                                type='datetime-local'
                                value={draft.endsAt}
                                onChange={(event) =>
                                    setDraft((current) => ({ ...current, endsAt: event.target.value }))
                                }
                            />
                        </Field>
                        <label className='flex items-center gap-2 text-sm'>
                            <input
                                type='checkbox'
                                checked={draft.enabled}
                                onChange={(event) =>
                                    setDraft((current) => ({ ...current, enabled: event.target.checked }))
                                }
                            />
                            启用展示组
                        </label>
                        {scope === 'share' && (
                            <div className='bg-muted/30 rounded-md border p-3 text-sm md:col-span-2'>
                                <div className='font-medium'>Profile ID</div>
                                {shareProfile ? (
                                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                                        <code className='bg-background rounded px-2 py-1 text-xs'>
                                            {shareProfile.publicId}
                                        </code>
                                        <Button type='button' variant='outline' size='sm' onClick={copyProfileId}>
                                            {profileCopied ? (
                                                <Check className='size-4' />
                                            ) : (
                                                <Clipboard className='size-4' />
                                            )}
                                            复制 ID
                                        </Button>
                                        {profileCopied && (
                                            <span className='rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300'>
                                                已复制
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <p className='text-muted-foreground mt-2'>
                                        保存后自动生成，管理员再把这个 ID 给用户填写到分享链接中。
                                    </p>
                                )}
                            </div>
                        )}
                        <div className='flex gap-2 md:col-span-2'>
                            <Button type='submit' disabled={saving || !draft.name || !draft.slotId}>
                                {saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
                                保存
                            </Button>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => router.push(`/admin/promo?scope=${scope}`)}>
                                取消
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
