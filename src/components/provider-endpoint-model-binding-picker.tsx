'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    getProviderEndpointCompatibilityFamily,
    getProviderModelBindingEndpoints,
    type ProviderEndpointCompatibilityFamily
} from '@/lib/provider-model-binding';
import {
    getCatalogEntryLabel,
    type ModelCatalogEntry,
    type ModelTaskCapability,
    type ModelTaskDefaultCatalogEntryIds,
    type ProviderEndpoint
} from '@/lib/provider-model-catalog';
import { ChevronDown, Plus, Settings } from 'lucide-react';
import * as React from 'react';

type Translate = (key: string, params?: Record<string, string | number | boolean | null | undefined>) => string;

type ProviderEndpointModelBindingPickerProps = {
    task: ModelTaskCapability;
    title: string;
    description: string;
    allowedCompatibilityFamilies: readonly ProviderEndpointCompatibilityFamily[];
    providerEndpoints: ProviderEndpoint[];
    modelCatalog: ModelCatalogEntry[];
    modelTaskDefaultCatalogEntryIds: ModelTaskDefaultCatalogEntryIds;
    selectedEndpointId?: string;
    showEmptyState?: boolean;
    onSelectedEndpointIdChange: (endpointId: string) => void;
    onChooseModel: (endpoint: ProviderEndpoint) => void;
    onManageEndpoint: (endpoint: ProviderEndpoint) => void;
    onAddEndpoint: () => void;
    t: Translate;
};

export function ProviderEndpointModelBindingPicker({
    task,
    title,
    description,
    allowedCompatibilityFamilies,
    providerEndpoints,
    modelCatalog,
    modelTaskDefaultCatalogEntryIds,
    selectedEndpointId,
    showEmptyState = true,
    onSelectedEndpointIdChange,
    onChooseModel,
    onManageEndpoint,
    onAddEndpoint,
    t
}: ProviderEndpointModelBindingPickerProps) {
    const config = React.useMemo(
        () => ({ providerEndpoints, modelCatalog, modelTaskDefaultCatalogEntryIds }),
        [modelCatalog, modelTaskDefaultCatalogEntryIds, providerEndpoints]
    );
    const endpoints = React.useMemo(
        () => getProviderModelBindingEndpoints(config, { allowedFamilies: allowedCompatibilityFamilies }),
        [allowedCompatibilityFamilies, config]
    );
    const selectedCatalogEntryId = modelTaskDefaultCatalogEntryIds[task] || '';
    const selectedEntry =
        selectedCatalogEntryId ? modelCatalog.find((entry) => entry.id === selectedCatalogEntryId) ?? null : null;
    const effectiveEndpointId = selectedEndpointId || selectedEntry?.providerEndpointId || '';
    const selectedEndpoint = endpoints.find((endpoint) => endpoint.id === effectiveEndpointId) ?? null;
    const selectedModelLabel =
        selectedEntry && selectedEntry.providerEndpointId === effectiveEndpointId
            ? getCatalogEntryLabel(selectedEntry, selectedEndpoint ?? undefined)
            : '';

    if (endpoints.length === 0 && !showEmptyState) return null;

    return (
        <div className='border-border bg-muted/20 space-y-3 rounded-xl border p-3'>
            <div className='space-y-1'>
                <div className='min-w-0 space-y-1'>
                    <Label className='text-muted-foreground text-xs'>{title}</Label>
                    <p className='text-muted-foreground text-xs leading-5'>{description}</p>
                </div>
            </div>

            {endpoints.length === 0 ? (
                <div className='border-border bg-background/70 flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='min-w-0 space-y-1'>
                        <p className='text-foreground text-sm font-medium'>
                            {t('settings.modelBinding.noEligibleEndpointsTitle')}
                        </p>
                        <p className='text-muted-foreground text-xs leading-5'>
                            {t('settings.modelBinding.noEligibleEndpointsDescription')}
                        </p>
                    </div>
                    <Button type='button' variant='outline' onClick={onAddEndpoint} className='min-h-[40px] rounded-xl'>
                        <Plus className='h-4 w-4' />
                        {t('settings.polish.addEndpoint')}
                    </Button>
                </div>
            ) : (
                <div className='grid gap-2'>
                    <div className='flex flex-col gap-2 lg:flex-row lg:items-center'>
                        <div className='min-w-0 flex-1'>
                            <Select value={effectiveEndpointId} onValueChange={onSelectedEndpointIdChange}>
                                <SelectTrigger className='bg-background text-foreground h-10 rounded-xl'>
                                    <SelectValue placeholder={t('settings.modelBinding.endpointPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {endpoints.map((endpoint) => {
                                        const family = getProviderEndpointCompatibilityFamily(endpoint);
                                        const count = modelCatalog.filter(
                                            (entry) => entry.providerEndpointId === endpoint.id
                                        ).length;
                                        return (
                                            <SelectItem key={endpoint.id} value={endpoint.id}>
                                                {endpoint.name || endpoint.id}
                                                <span className='text-muted-foreground ml-2 text-xs'>
                                                    {family === 'anthropic-compatible'
                                                        ? t('settings.modelBinding.familyAnthropic')
                                                        : t('settings.modelBinding.familyOpenAI')}
                                                    {' · '}
                                                    {count}
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedEndpoint && (
                            <div className='flex shrink-0 flex-wrap gap-2'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    onClick={() => onManageEndpoint(selectedEndpoint)}
                                    className='min-h-[40px] rounded-xl text-xs'>
                                    <Settings className='h-3.5 w-3.5' />
                                    {t('settings.modelBinding.manageEndpoint')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {selectedEndpoint ? (
                        <button
                            type='button'
                            onClick={() => onChooseModel(selectedEndpoint)}
                            aria-label={
                                selectedModelLabel
                                    ? t('settings.modelBinding.changeModel')
                                    : t('settings.modelBinding.chooseModel')
                            }
                            className='border-border bg-background/70 hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-ring/50 flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none'>
                            <span className='min-w-0'>
                                <span className='text-muted-foreground block text-xs'>
                                    {t('settings.modelBinding.selectedModelLabel')}
                                </span>
                                <span className='text-foreground block truncate'>
                                    {selectedModelLabel || t('settings.modelBinding.noModelSelected')}
                                </span>
                            </span>
                            <ChevronDown className='text-muted-foreground h-4 w-4 shrink-0' />
                        </button>
                    ) : (
                        <div className='border-border bg-background/70 flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm opacity-70'>
                            <span className='min-w-0'>
                                <span className='text-muted-foreground block text-xs'>
                                    {t('settings.modelBinding.selectedModelLabel')}
                                </span>
                                <span className='text-foreground block truncate'>
                                    {t('settings.modelBinding.noModelSelected')}
                                </span>
                            </span>
                        </div>
                    )}
                </div>
            )}

            {selectedEndpoint && !selectedModelLabel && (
                <p className='text-muted-foreground text-xs leading-5'>
                    {t('settings.modelBinding.noModelsForEndpoint')}
                </p>
            )}
        </div>
    );
}
