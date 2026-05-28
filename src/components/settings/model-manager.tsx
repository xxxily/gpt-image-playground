'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import type { ModelTaskCapability } from '@/lib/provider-model-catalog';
import { Plus, RefreshCw } from 'lucide-react';
import * as React from 'react';

type Translate = (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;

export type ManagedModelOption = {
    id: string;
    modelId: string;
    label: string;
    detail?: string;
    badges?: string[];
    disabled?: boolean;
    metadata?: Record<string, string | undefined>;
};

export type ModelManagerDialogState = {
    open: boolean;
    title: string;
    description: string;
    endpointId: string;
    selectionMode?: 'single' | 'multiple';
    optionMode?: 'management' | 'binding';
    bindingTask?: ModelTaskCapability;
    requireSelection?: boolean;
    options: ManagedModelOption[];
    selectedModelIds: string[];
    loading?: boolean;
    statusMessage?: string;
    statusTone?: 'success' | 'error' | 'info';
    emptyMessage?: string;
    allowManualModels?: boolean;
    onRefresh?: () => void | Promise<void>;
    onConfirm: (modelIds: string[], options: ManagedModelOption[]) => void;
};

export function mergeManagedModelOptions(options: readonly ManagedModelOption[]): ManagedModelOption[] {
    const optionsByModelId = new Map<string, ManagedModelOption>();
    options.forEach((option) => {
        const modelId = option.modelId.trim();
        if (!modelId) return;
        const existing = optionsByModelId.get(modelId);
        if (existing) {
            optionsByModelId.set(modelId, {
                ...existing,
                ...option,
                badges: Array.from(new Set([...(existing.badges ?? []), ...(option.badges ?? [])]))
            });
            return;
        }
        optionsByModelId.set(modelId, { ...option, id: option.id || modelId, modelId });
    });
    return Array.from(optionsByModelId.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function normalizeModelIds(modelIds: readonly string[]): string[] {
    return Array.from(new Set(modelIds.map((item) => item.trim()).filter(Boolean)));
}

export function ModelListManagerDialog({
    state,
    onOpenChange,
    t
}: {
    state: ModelManagerDialogState | null;
    onOpenChange: (open: boolean) => void;
    t: Translate;
}) {
    const [search, setSearch] = React.useState('');
    const [selectedModelIds, setSelectedModelIds] = React.useState<string[]>([]);
    const [manualModelId, setManualModelId] = React.useState('');
    const [manualModelLabel, setManualModelLabel] = React.useState('');
    const [manualModelVendor, setManualModelVendor] = React.useState('');
    const [localOptions, setLocalOptions] = React.useState<ManagedModelOption[]>([]);
    const previousEndpointIdRef = React.useRef<string | null>(null);
    const selectionMode = state?.selectionMode ?? 'multiple';
    const isSingleSelection = selectionMode === 'single';

    React.useEffect(() => {
        if (!state?.open) {
            previousEndpointIdRef.current = null;
            return;
        }
        if (previousEndpointIdRef.current === state.endpointId) return;
        previousEndpointIdRef.current = state.endpointId;
        setSearch('');
        setManualModelId('');
        setManualModelLabel('');
        setManualModelVendor('');
        setSelectedModelIds(normalizeModelIds(state.selectedModelIds));
        setLocalOptions(state.options);
    }, [state?.endpointId, state?.open, state?.options, state?.selectedModelIds]);

    React.useEffect(() => {
        if (!state?.open) return;
        setLocalOptions((current) =>
            state.optionMode === 'binding' ? state.options : mergeManagedModelOptions([...current, ...state.options])
        );
    }, [state?.optionMode, state?.options, state?.open]);

    const filteredOptions = React.useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        if (!state) return [];
        return localOptions.filter((option) => {
            if (!normalizedSearch) return true;
            return [option.modelId, option.label, option.detail, ...(option.badges ?? [])]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearch);
        });
    }, [localOptions, search, state]);

    const selectableFilteredModelIds = React.useMemo(
        () => filteredOptions.filter((option) => !option.disabled).map((option) => option.modelId),
        [filteredOptions]
    );
    const selectedSet = React.useMemo(() => new Set(selectedModelIds), [selectedModelIds]);
    const allFilteredSelected =
        selectableFilteredModelIds.length > 0 &&
        selectableFilteredModelIds.every((modelId) => selectedSet.has(modelId));

    const setModelChecked = React.useCallback(
        (modelId: string, checked: boolean | string) => {
            setSelectedModelIds((current) => {
                if (isSingleSelection) return checked ? [modelId] : [];
                const next = new Set(current);
                if (checked) {
                    next.add(modelId);
                } else {
                    next.delete(modelId);
                }
                return Array.from(next);
            });
        },
        [isSingleSelection]
    );

    const setFilteredChecked = React.useCallback(
        (checked: boolean) => {
            setSelectedModelIds((current) => {
                const next = new Set(current);
                selectableFilteredModelIds.forEach((modelId) => {
                    if (checked) {
                        next.add(modelId);
                    } else {
                        next.delete(modelId);
                    }
                });
                return Array.from(next);
            });
        },
        [selectableFilteredModelIds]
    );

    const addManualOption = React.useCallback(() => {
        const modelId = manualModelId.trim();
        if (!modelId) return;
        const label = manualModelLabel.trim() || modelId;
        const vendor = manualModelVendor.trim() || undefined;
        const option: ManagedModelOption = {
            id: `manual:${modelId}`,
            modelId,
            label,
            detail: vendor,
            badges: [t('settings.modelManager.badgeCustom')],
            metadata: {
                displayLabel: manualModelLabel.trim() || undefined,
                upstreamVendor: vendor
            }
        };
        setLocalOptions((current) => mergeManagedModelOptions([...current, option]));
        setSelectedModelIds((current) => (isSingleSelection ? [modelId] : normalizeModelIds([...current, modelId])));
        setManualModelId('');
        setManualModelLabel('');
        setManualModelVendor('');
    }, [isSingleSelection, manualModelId, manualModelLabel, manualModelVendor, t]);

    if (!state) return null;

    return (
        <Dialog open={state.open} onOpenChange={onOpenChange}>
            <DialogContent className='border-border bg-background text-foreground top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none p-0 shadow-2xl sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[min(760px,calc(100dvh-2rem))] sm:w-[min(760px,calc(100vw-2rem))] sm:max-w-[760px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl'>
                <DialogHeader className='border-border border-b px-5 py-4 pr-14 text-left sm:px-6'>
                    <DialogTitle className='text-lg font-semibold'>{state.title}</DialogTitle>
                    <DialogDescription>{state.description}</DialogDescription>
                </DialogHeader>
                <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6'>
                    <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='text-muted-foreground text-xs'>
                            {t('settings.modelManager.selectedCount', {
                                selected: selectedModelIds.length,
                                total: localOptions.length
                            })}
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            {state.onRefresh && (
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() => void state.onRefresh?.()}
                                    disabled={state.loading}
                                    className='min-h-[36px] rounded-xl'>
                                    {state.loading ? <Spinner size='md' /> : <RefreshCw className='h-4 w-4' />}
                                    {t('settings.modelManager.fetchButton')}
                                </Button>
                            )}
                            {!isSingleSelection && (
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() => setFilteredChecked(!allFilteredSelected)}
                                    disabled={selectableFilteredModelIds.length === 0}
                                    className='min-h-[36px] rounded-xl'>
                                    {allFilteredSelected
                                        ? t('settings.modelManager.clearFiltered')
                                        : t('settings.modelManager.selectFiltered')}
                                </Button>
                            )}
                        </div>
                    </div>
                    {state.statusMessage && (
                        <p
                            className={`text-xs ${state.statusTone === 'error' ? 'text-red-600 dark:text-red-300' : state.statusTone === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                            {state.statusMessage}
                        </p>
                    )}
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('settings.modelManager.searchPlaceholder')}
                        className='bg-background text-foreground h-10 rounded-xl text-sm'
                    />
                    {state.allowManualModels && (
                        <div className='border-border bg-muted/20 grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_1fr_1fr_auto]'>
                            <Input
                                value={manualModelId}
                                onChange={(event) => setManualModelId(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addManualOption();
                                    }
                                }}
                                placeholder={t('settings.modelManager.manualIdPlaceholder')}
                                className='bg-background text-foreground h-10 rounded-xl font-mono text-xs'
                            />
                            <Input
                                value={manualModelLabel}
                                onChange={(event) => setManualModelLabel(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addManualOption();
                                    }
                                }}
                                placeholder={t('settings.modelManager.manualLabelPlaceholder')}
                                className='bg-background text-foreground h-10 rounded-xl text-xs'
                            />
                            <Input
                                value={manualModelVendor}
                                onChange={(event) => setManualModelVendor(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        addManualOption();
                                    }
                                }}
                                placeholder={t('settings.modelManager.manualVendorPlaceholder')}
                                className='bg-background text-foreground h-10 rounded-xl text-xs'
                            />
                            <Button
                                type='button'
                                variant='outline'
                                onClick={addManualOption}
                                disabled={!manualModelId.trim()}
                                className='min-h-[40px] rounded-xl'>
                                <Plus className='h-4 w-4' />
                                {t('settings.modelManager.manualAdd')}
                            </Button>
                        </div>
                    )}
                    <div className='space-y-2'>
                        {isSingleSelection ? (
                            <RadioGroup
                                value={selectedModelIds[0] ?? ''}
                                onValueChange={(value) => setSelectedModelIds(value ? [value] : [])}
                                className='space-y-2'>
                                {filteredOptions.map((option) => (
                                    <label
                                        key={option.id}
                                        className={`border-border bg-background/70 flex items-start gap-3 rounded-xl border p-3 ${option.disabled ? 'opacity-60' : ''}`}>
                                        <RadioGroupItem
                                            value={option.modelId}
                                            disabled={option.disabled}
                                            className='mt-0.5'
                                        />
                                        <span className='min-w-0 flex-1'>
                                            <span className='text-foreground block truncate text-sm font-semibold'>
                                                {option.label}
                                            </span>
                                            <span className='text-muted-foreground mt-0.5 block truncate font-mono text-xs'>
                                                {option.modelId}
                                            </span>
                                            {option.detail && (
                                                <span className='text-muted-foreground mt-1 block text-xs leading-5'>
                                                    {option.detail}
                                                </span>
                                            )}
                                            {option.badges && option.badges.length > 0 && (
                                                <span className='mt-2 flex flex-wrap gap-1.5'>
                                                    {option.badges.map((badge) => (
                                                        <span
                                                            key={badge}
                                                            className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]'>
                                                            {badge}
                                                        </span>
                                                    ))}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </RadioGroup>
                        ) : (
                            filteredOptions.map((option) => {
                                const checked = selectedSet.has(option.modelId);
                                return (
                                    <label
                                        key={option.id}
                                        className={`border-border bg-background/70 flex items-start gap-3 rounded-xl border p-3 ${option.disabled ? 'opacity-60' : ''}`}>
                                        <Checkbox
                                            checked={checked}
                                            disabled={option.disabled}
                                            onCheckedChange={(value) => setModelChecked(option.modelId, value)}
                                            className='mt-0.5'
                                        />
                                        <span className='min-w-0 flex-1'>
                                            <span className='text-foreground block truncate text-sm font-semibold'>
                                                {option.label}
                                            </span>
                                            <span className='text-muted-foreground mt-0.5 block truncate font-mono text-xs'>
                                                {option.modelId}
                                            </span>
                                            {option.detail && (
                                                <span className='text-muted-foreground mt-1 block text-xs leading-5'>
                                                    {option.detail}
                                                </span>
                                            )}
                                            {option.badges && option.badges.length > 0 && (
                                                <span className='mt-2 flex flex-wrap gap-1.5'>
                                                    {option.badges.map((badge) => (
                                                        <span
                                                            key={badge}
                                                            className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]'>
                                                            {badge}
                                                        </span>
                                                    ))}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                        {filteredOptions.length === 0 && (
                            <p className='text-muted-foreground border-border rounded-xl border border-dashed p-4 text-sm'>
                                {state.emptyMessage || t('settings.modelManager.empty')}
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter className='border-border bg-card/60 border-t px-5 py-4 sm:px-6'>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => onOpenChange(false)}
                        className='min-h-[40px] rounded-xl'>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type='button'
                        onClick={() => {
                            state.onConfirm(selectedModelIds, localOptions);
                            onOpenChange(false);
                        }}
                        disabled={state.requireSelection && selectedModelIds.length === 0}
                        className='min-h-[40px] rounded-xl'>
                        {t('settings.modelManager.apply')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
