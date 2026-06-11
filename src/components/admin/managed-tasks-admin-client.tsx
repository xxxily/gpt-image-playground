'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { useMessage } from '@/components/notice-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    DEFAULT_MANAGED_TASK_HEALTH_CHECK_INTERVAL_SECONDS,
    normalizeManagedTaskBaseUrl,
    resolveManagedTaskExecution,
    type GenerationExecutionMode,
    type ManagedTaskFallbackMode,
    type ManagedTaskP0Capability,
    type ManagedTaskPolicyLimits,
    type ManagedTaskPolicyMatch,
    type ManagedTaskResolvedExecutionMode,
    type ManagedTaskResolution,
    type ManagedTaskServiceConfig,
    type ManagedTaskServiceHealthStatus,
    type ManagedTaskTakeoverPolicy
} from '@/lib/managed-task-config';
import type { ProviderKind, ProviderProtocol } from '@/lib/provider-model-catalog';
import { cn } from '@/lib/utils';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Loader2,
    Plus,
    RefreshCcw,
    Route,
    Save,
    ServerCog,
    ShieldAlert,
    Trash2,
    Workflow,
    XCircle
} from 'lucide-react';
import * as React from 'react';

export type AdminManagedTaskService = ManagedTaskServiceConfig & {
    authTokenPrefix?: string | null;
};

export type AdminManagedTaskPolicy = ManagedTaskTakeoverPolicy;

type ManagedTasksAdminClientProps = {
    initialServices: AdminManagedTaskService[];
    initialPolicies: AdminManagedTaskPolicy[];
};

type ServiceDraft = {
    name: string;
    baseUrl: string;
    enabled: boolean;
    authMode: 'none' | 'bearer';
    authToken: string;
    clearAuthToken: boolean;
    healthCheckEnabled: boolean;
    healthCheckIntervalSeconds: string;
};

type PolicyDraft = {
    name: string;
    enabled: boolean;
    priority: string;
    mode: GenerationExecutionMode;
    taskServiceId: string;
    fallbackMode: ManagedTaskFallbackMode;
    providerEndpointIds: string;
    normalizedBaseUrls: string;
    providerKinds: string;
    providerProtocols: string;
    modelCatalogEntryIds: string;
    taskCapabilities: ManagedTaskP0Capability[];
    maxSubmittedTasksPerUserPerHour: string;
    maxQueuedTasksPerUser: string;
    maxInputAssetBytes: string;
    maxOutputAssetBytes: string;
    timeoutSeconds: string;
};

type PreviewDraft = {
    taskCapability: ManagedTaskP0Capability | 'vision.text';
    defaultMode: 'direct' | 'proxy';
    providerEndpointId: string;
    apiBaseUrl: string;
    providerKind: ProviderKind;
    providerProtocol: ProviderProtocol;
    modelCatalogEntryId: string;
    rawModelId: string;
};

type DeleteTarget =
    | { type: 'service'; service: AdminManagedTaskService }
    | { type: 'policy'; policy: AdminManagedTaskPolicy };

const P0_CAPABILITIES: ManagedTaskP0Capability[] = ['image.generate', 'image.edit'];
const PROVIDER_KIND_OPTIONS: ProviderKind[] = [
    'openai',
    'openai-compatible',
    'google-gemini',
    'volcengine-ark',
    'fal',
    'xai'
];
const PROVIDER_PROTOCOL_OPTIONS: ProviderProtocol[] = [
    'openai-images',
    'openai-responses',
    'openai-chat-completions',
    'gemini-generate-content',
    'ark-openai-compatible',
    'fal-model-api'
];
const EMPTY_SELECT_VALUE = '__none__';

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
            payload &&
            typeof payload === 'object' &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
                ? (payload as { error: string }).error
                : fallbackError;
        throw new Error(errorMessage || fallbackError);
    }
    return payload as T;
}

function splitList(value: string): string[] {
    return value
        .split(/[\n,]/u)
        .map((item) => item.trim())
        .filter(Boolean);
}

function joinList(values: string[] | undefined): string {
    return (values || []).join('\n');
}

function parseInteger(value: string): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function buildServiceDraft(service: AdminManagedTaskService | null): ServiceDraft {
    if (!service) {
        return {
            name: '',
            baseUrl: '',
            enabled: false,
            authMode: 'none',
            authToken: '',
            clearAuthToken: false,
            healthCheckEnabled: true,
            healthCheckIntervalSeconds: String(DEFAULT_MANAGED_TASK_HEALTH_CHECK_INTERVAL_SECONDS)
        };
    }
    return {
        name: service.name,
        baseUrl: service.baseUrl,
        enabled: service.enabled,
        authMode: service.authMode,
        authToken: '',
        clearAuthToken: false,
        healthCheckEnabled: service.healthCheckEnabled,
        healthCheckIntervalSeconds: String(service.healthCheckIntervalSeconds)
    };
}

function buildPolicyDraft(policy: AdminManagedTaskPolicy | null, defaultServiceId: string): PolicyDraft {
    if (!policy) {
        return {
            name: '',
            enabled: false,
            priority: '0',
            mode: 'managed-task',
            taskServiceId: defaultServiceId,
            fallbackMode: 'fail-closed',
            providerEndpointIds: '',
            normalizedBaseUrls: '',
            providerKinds: '',
            providerProtocols: '',
            modelCatalogEntryIds: '',
            taskCapabilities: [...P0_CAPABILITIES],
            maxSubmittedTasksPerUserPerHour: '',
            maxQueuedTasksPerUser: '',
            maxInputAssetBytes: '',
            maxOutputAssetBytes: '',
            timeoutSeconds: ''
        };
    }
    const match = policy.match;
    const limits = policy.limits || {};
    return {
        name: policy.name,
        enabled: policy.enabled,
        priority: String(policy.priority),
        mode: policy.mode,
        taskServiceId: policy.taskServiceId || EMPTY_SELECT_VALUE,
        fallbackMode: policy.fallbackMode,
        providerEndpointIds: joinList(match.providerEndpointIds),
        normalizedBaseUrls: joinList(match.normalizedBaseUrls),
        providerKinds: joinList(match.providerKinds),
        providerProtocols: joinList(match.providerProtocols),
        modelCatalogEntryIds: joinList(match.modelCatalogEntryIds),
        taskCapabilities: match.taskCapabilities.length > 0 ? match.taskCapabilities : [...P0_CAPABILITIES],
        maxSubmittedTasksPerUserPerHour: stringifyLimit(limits.maxSubmittedTasksPerUserPerHour),
        maxQueuedTasksPerUser: stringifyLimit(limits.maxQueuedTasksPerUser),
        maxInputAssetBytes: stringifyLimit(limits.maxInputAssetBytes),
        maxOutputAssetBytes: stringifyLimit(limits.maxOutputAssetBytes),
        timeoutSeconds: stringifyLimit(limits.timeoutSeconds)
    };
}

function stringifyLimit(value: number | undefined): string {
    return Number.isFinite(value) ? String(value) : '';
}

function getServiceHost(service: AdminManagedTaskService): string {
    try {
        return new URL(service.baseUrl).host;
    } catch {
        return service.baseUrl;
    }
}

function getHealthTone(status: ManagedTaskServiceHealthStatus): string {
    if (status === 'ok') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    if (status === 'degraded') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    if (status === 'unavailable') return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
}

function getModeTone(mode: ManagedTaskResolvedExecutionMode): string {
    if (mode === 'managed-task') return 'bg-primary/10 text-primary';
    if (mode === 'fail-closed') return 'bg-destructive/10 text-destructive';
    if (mode === 'ask-user') return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    return 'bg-muted text-muted-foreground';
}

function StatusPill({ label, className }: { label: React.ReactNode; className?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium', className)}>
            {label}
        </span>
    );
}

export function ManagedTasksAdminClient({ initialServices, initialPolicies }: ManagedTasksAdminClientProps) {
    const { t, formatDateTime, formatNumber } = useAppLanguage();
    const { addNotice } = useMessage();
    const [services, setServices] = React.useState(initialServices);
    const [policies, setPolicies] = React.useState(initialPolicies);
    const [selectedServiceId, setSelectedServiceId] = React.useState(initialServices[0]?.id || '');
    const [selectedPolicyId, setSelectedPolicyId] = React.useState(initialPolicies[0]?.id || '');
    const [isCreatingService, setIsCreatingService] = React.useState(initialServices.length === 0);
    const [isCreatingPolicy, setIsCreatingPolicy] = React.useState(initialPolicies.length === 0);
    const selectedService = services.find((service) => service.id === selectedServiceId) || null;
    const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId) || null;
    const [serviceDraft, setServiceDraft] = React.useState(() => buildServiceDraft(selectedService));
    const [policyDraft, setPolicyDraft] = React.useState(() =>
        buildPolicyDraft(selectedPolicy, initialServices[0]?.id || EMPTY_SELECT_VALUE)
    );
    const [previewDraft, setPreviewDraft] = React.useState<PreviewDraft>({
        taskCapability: 'image.generate',
        defaultMode: 'proxy',
        providerEndpointId: '',
        apiBaseUrl: '',
        providerKind: 'openai-compatible',
        providerProtocol: 'openai-images',
        modelCatalogEntryId: '',
        rawModelId: ''
    });
    const [busyKey, setBusyKey] = React.useState('');
    const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);

    React.useEffect(() => {
        setServiceDraft(buildServiceDraft(isCreatingService ? null : selectedService));
    }, [isCreatingService, selectedService]);

    React.useEffect(() => {
        setPolicyDraft(
            buildPolicyDraft(isCreatingPolicy ? null : selectedPolicy, services[0]?.id || EMPTY_SELECT_VALUE)
        );
    }, [isCreatingPolicy, selectedPolicy, services]);

    const refreshAll = React.useCallback(async () => {
        const payload = await requestJson<{
            services: AdminManagedTaskService[];
            policies: AdminManagedTaskPolicy[];
        }>('/api/admin/managed-task-services', undefined, t('admin.managedTasks.notice.failed'));
        setServices(payload.services);
        setPolicies(payload.policies);
        return payload;
    }, [t]);

    const updateServiceDraft = <TKey extends keyof ServiceDraft>(key: TKey, value: ServiceDraft[TKey]) => {
        setServiceDraft((current) => ({
            ...current,
            [key]: value,
            ...(key === 'authMode' && value === 'none' ? { authToken: '', clearAuthToken: true } : {})
        }));
    };

    const updatePolicyDraft = <TKey extends keyof PolicyDraft>(key: TKey, value: PolicyDraft[TKey]) => {
        setPolicyDraft((current) => ({
            ...current,
            [key]: value
        }));
    };

    const updatePreviewDraft = <TKey extends keyof PreviewDraft>(key: TKey, value: PreviewDraft[TKey]) => {
        setPreviewDraft((current) => ({
            ...current,
            [key]: value
        }));
    };

    const serviceCanSubmit = serviceDraft.name.trim().length > 0 && serviceDraft.baseUrl.trim().length > 0;
    const policyCanSubmit =
        policyDraft.name.trim().length > 0 &&
        (policyDraft.mode !== 'managed-task' || policyDraft.taskServiceId !== EMPTY_SELECT_VALUE);

    const previewResult = React.useMemo<ManagedTaskResolution>(() => {
        const normalizedBaseUrl = normalizeManagedTaskBaseUrl(previewDraft.apiBaseUrl);
        return resolveManagedTaskExecution({
            services,
            policies,
            providerEndpoint: {
                id: previewDraft.providerEndpointId.trim() || 'preview-endpoint',
                apiBaseUrl: normalizedBaseUrl,
                provider: previewDraft.providerKind,
                protocol: previewDraft.providerProtocol
            },
            model: previewDraft.modelCatalogEntryId.trim()
                ? {
                      id: previewDraft.modelCatalogEntryId.trim(),
                      rawModelId: previewDraft.rawModelId.trim() || previewDraft.modelCatalogEntryId.trim(),
                      providerEndpointId: previewDraft.providerEndpointId.trim() || 'preview-endpoint',
                      provider: previewDraft.providerKind,
                      protocol: previewDraft.providerProtocol,
                      capabilities: {
                          tasks: [previewDraft.taskCapability],
                          inputModalities: ['text', 'image'],
                          outputModalities: ['image']
                      }
                  }
                : null,
            taskCapability: previewDraft.taskCapability,
            defaultMode: previewDraft.defaultMode
        });
    }, [policies, previewDraft, services]);

    const submitService = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!serviceCanSubmit || busyKey) return;
        const key = isCreatingService ? 'service:create' : `service:update:${selectedService?.id || ''}`;
        setBusyKey(key);
        try {
            const payload = {
                name: serviceDraft.name,
                baseUrl: serviceDraft.baseUrl,
                enabled: serviceDraft.enabled,
                authMode: serviceDraft.authMode,
                authToken: serviceDraft.authToken || null,
                clearAuthToken: serviceDraft.clearAuthToken,
                healthCheckEnabled: serviceDraft.healthCheckEnabled,
                healthCheckIntervalSeconds: parseInteger(serviceDraft.healthCheckIntervalSeconds)
            };
            const response = await requestJson<{ service: AdminManagedTaskService }>(
                isCreatingService
                    ? '/api/admin/managed-task-services'
                    : `/api/admin/managed-task-services/${selectedService?.id}`,
                {
                    method: isCreatingService ? 'POST' : 'PUT',
                    body: JSON.stringify(payload)
                },
                t('admin.managedTasks.notice.failed')
            );
            const refreshed = await refreshAll();
            setSelectedServiceId(response.service.id);
            setIsCreatingService(false);
            if (!selectedPolicyId && refreshed.policies[0]) setSelectedPolicyId(refreshed.policies[0].id);
            addNotice(
                isCreatingService
                    ? t('admin.managedTasks.notice.serviceCreated')
                    : t('admin.managedTasks.notice.serviceUpdated'),
                'success'
            );
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.managedTasks.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const submitPolicy = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!policyCanSubmit || busyKey) return;
        const key = isCreatingPolicy ? 'policy:create' : `policy:update:${selectedPolicy?.id || ''}`;
        setBusyKey(key);
        try {
            const match: ManagedTaskPolicyMatch = {
                providerEndpointIds: splitList(policyDraft.providerEndpointIds),
                normalizedBaseUrls: splitList(policyDraft.normalizedBaseUrls),
                providerKinds: splitList(policyDraft.providerKinds) as ProviderKind[],
                providerProtocols: splitList(policyDraft.providerProtocols) as ProviderProtocol[],
                modelCatalogEntryIds: splitList(policyDraft.modelCatalogEntryIds),
                taskCapabilities: policyDraft.taskCapabilities
            };
            const limits: ManagedTaskPolicyLimits = {};
            for (const [keyName, value] of [
                ['maxSubmittedTasksPerUserPerHour', policyDraft.maxSubmittedTasksPerUserPerHour],
                ['maxQueuedTasksPerUser', policyDraft.maxQueuedTasksPerUser],
                ['maxInputAssetBytes', policyDraft.maxInputAssetBytes],
                ['maxOutputAssetBytes', policyDraft.maxOutputAssetBytes],
                ['timeoutSeconds', policyDraft.timeoutSeconds]
            ] as const) {
                const parsed = parseInteger(value);
                if (parsed && parsed > 0) limits[keyName] = parsed;
            }
            const payload = {
                name: policyDraft.name,
                enabled: policyDraft.enabled,
                priority: parseInteger(policyDraft.priority) ?? 0,
                mode: policyDraft.mode,
                taskServiceId:
                    policyDraft.mode === 'managed-task' && policyDraft.taskServiceId !== EMPTY_SELECT_VALUE
                        ? policyDraft.taskServiceId
                        : null,
                fallbackMode: policyDraft.fallbackMode,
                match,
                limits
            };
            const response = await requestJson<{ policy: AdminManagedTaskPolicy }>(
                isCreatingPolicy
                    ? '/api/admin/managed-task-policies'
                    : `/api/admin/managed-task-policies/${selectedPolicy?.id}`,
                {
                    method: isCreatingPolicy ? 'POST' : 'PUT',
                    body: JSON.stringify(payload)
                },
                t('admin.managedTasks.notice.failed')
            );
            await refreshAll();
            setSelectedPolicyId(response.policy.id);
            setIsCreatingPolicy(false);
            addNotice(
                isCreatingPolicy
                    ? t('admin.managedTasks.notice.policyCreated')
                    : t('admin.managedTasks.notice.policyUpdated'),
                'success'
            );
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.managedTasks.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const runHealthCheck = async (service: AdminManagedTaskService) => {
        const key = `service:check:${service.id}`;
        setBusyKey(key);
        try {
            const response = await requestJson<{ service: AdminManagedTaskService }>(
                `/api/admin/managed-task-services/${service.id}/check`,
                { method: 'POST' },
                t('admin.managedTasks.notice.failed')
            );
            await refreshAll();
            setSelectedServiceId(response.service.id);
            addNotice(t('admin.managedTasks.notice.healthChecked'), 'success');
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.managedTasks.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget || busyKey) return;
        const key = `${deleteTarget.type}:delete`;
        setBusyKey(key);
        try {
            if (deleteTarget.type === 'service') {
                await requestJson<{ ok: true }>(
                    `/api/admin/managed-task-services/${deleteTarget.service.id}`,
                    { method: 'DELETE' },
                    t('admin.managedTasks.notice.failed')
                );
                const refreshed = await refreshAll();
                setSelectedServiceId(refreshed.services[0]?.id || '');
                setIsCreatingService(refreshed.services.length === 0);
                addNotice(t('admin.managedTasks.notice.serviceDeleted'), 'success');
            } else {
                await requestJson<{ ok: true }>(
                    `/api/admin/managed-task-policies/${deleteTarget.policy.id}`,
                    { method: 'DELETE' },
                    t('admin.managedTasks.notice.failed')
                );
                const refreshed = await refreshAll();
                setSelectedPolicyId(refreshed.policies[0]?.id || '');
                setIsCreatingPolicy(refreshed.policies.length === 0);
                addNotice(t('admin.managedTasks.notice.policyDeleted'), 'success');
            }
            setDeleteTarget(null);
        } catch (error) {
            addNotice(error instanceof Error ? error.message : t('admin.managedTasks.notice.failed'), 'error');
        } finally {
            setBusyKey('');
        }
    };

    const serviceAuthHelp =
        selectedService?.authMode === 'bearer' && selectedService.authTokenConfigured
            ? t('admin.managedTasks.authTokenConfigured', {
                  prefix: selectedService.authTokenPrefix || t('admin.managedTasks.redacted')
              })
            : t('admin.managedTasks.authTokenEmpty');
    const serviceCapabilities = selectedService?.capabilitiesSummary;

    return (
        <section className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div className='min-w-0'>
                    <Heading level={1} size='section'>
                        {t('admin.managedTasks.title')}
                    </Heading>
                    <p className='text-muted-foreground mt-1 max-w-3xl text-sm'>
                        {t('admin.managedTasks.description')}
                    </p>
                </div>
                <Button
                    type='button'
                    variant='outline'
                    onClick={() => void refreshAll().catch((error) => addNotice(error.message, 'error'))}
                    disabled={Boolean(busyKey)}
                    className='w-full sm:w-auto'>
                    <RefreshCcw className='mr-2 size-4' />
                    {t('admin.managedTasks.refresh')}
                </Button>
            </div>

            <Alert>
                <ShieldAlert className='size-4' />
                <AlertTitle>{t('admin.managedTasks.boundaryTitle')}</AlertTitle>
                <AlertDescription>{t('admin.managedTasks.boundaryDescription')}</AlertDescription>
            </Alert>

            <div className='grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]'>
                <div className='space-y-4'>
                    <Card>
                        <CardHeader className='gap-2'>
                            <div className='flex items-start justify-between gap-3'>
                                <div>
                                    <CardTitle className='flex items-center gap-2 text-base'>
                                        <ServerCog className='size-4' />
                                        {t('admin.managedTasks.services.title')}
                                    </CardTitle>
                                    <CardDescription>{t('admin.managedTasks.services.description')}</CardDescription>
                                </div>
                                <Button
                                    type='button'
                                    size='sm'
                                    onClick={() => {
                                        setIsCreatingService(true);
                                        setSelectedServiceId('');
                                    }}>
                                    <Plus className='mr-2 size-4' />
                                    {t('admin.managedTasks.services.new')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {services.length === 0 ? (
                                <EmptyState
                                    icon={<ServerCog />}
                                    title={t('admin.managedTasks.services.emptyTitle')}
                                    description={t('admin.managedTasks.services.emptyDescription')}
                                />
                            ) : (
                                <div className='space-y-2'>
                                    {services.map((service) => {
                                        const active = selectedServiceId === service.id && !isCreatingService;
                                        return (
                                            <button
                                                key={service.id}
                                                type='button'
                                                className={cn(
                                                    'border-border bg-card hover:bg-muted/50 focus-visible:ring-ring/50 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none',
                                                    active && 'border-primary bg-primary/10'
                                                )}
                                                onClick={() => {
                                                    setIsCreatingService(false);
                                                    setSelectedServiceId(service.id);
                                                }}>
                                                <span className='min-w-0 space-y-1'>
                                                    <span className='block truncate text-sm font-medium' data-i18n-skip>
                                                        {service.name}
                                                    </span>
                                                    <span
                                                        className='text-muted-foreground block truncate text-xs'
                                                        data-i18n-skip>
                                                        {getServiceHost(service)}
                                                    </span>
                                                    <span className='flex flex-wrap gap-2'>
                                                        <StatusPill
                                                            label={t(
                                                                `admin.managedTasks.health.${service.healthStatus}`
                                                            )}
                                                            className={getHealthTone(service.healthStatus)}
                                                        />
                                                        {service.enabled ? (
                                                            <StatusPill
                                                                label={t('admin.managedTasks.status.enabled')}
                                                                className='bg-sky-500/10 text-sky-700 dark:text-sky-300'
                                                            />
                                                        ) : (
                                                            <StatusPill
                                                                label={t('admin.managedTasks.status.disabled')}
                                                                className='bg-muted text-muted-foreground'
                                                            />
                                                        )}
                                                        {service.authTokenConfigured ? (
                                                            <StatusPill
                                                                label={t('admin.managedTasks.status.tokenConfigured')}
                                                                className='bg-muted text-muted-foreground'
                                                            />
                                                        ) : null}
                                                    </span>
                                                </span>
                                                {service.healthStatus === 'ok' ? (
                                                    <CheckCircle2 className='mt-1 size-4 shrink-0 text-emerald-600' />
                                                ) : service.healthStatus === 'unavailable' ? (
                                                    <XCircle className='text-destructive mt-1 size-4 shrink-0' />
                                                ) : (
                                                    <Activity className='text-muted-foreground mt-1 size-4 shrink-0' />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className='gap-2'>
                            <div className='flex items-start justify-between gap-3'>
                                <div>
                                    <CardTitle className='flex items-center gap-2 text-base'>
                                        <Route className='size-4' />
                                        {t('admin.managedTasks.policies.title')}
                                    </CardTitle>
                                    <CardDescription>{t('admin.managedTasks.policies.description')}</CardDescription>
                                </div>
                                <Button
                                    type='button'
                                    size='sm'
                                    onClick={() => {
                                        setIsCreatingPolicy(true);
                                        setSelectedPolicyId('');
                                    }}>
                                    <Plus className='mr-2 size-4' />
                                    {t('admin.managedTasks.policies.new')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {policies.length === 0 ? (
                                <EmptyState
                                    icon={<Route />}
                                    title={t('admin.managedTasks.policies.emptyTitle')}
                                    description={t('admin.managedTasks.policies.emptyDescription')}
                                />
                            ) : (
                                <div className='space-y-2'>
                                    {policies.map((policy) => {
                                        const service = services.find((item) => item.id === policy.taskServiceId);
                                        const active = selectedPolicyId === policy.id && !isCreatingPolicy;
                                        return (
                                            <button
                                                key={policy.id}
                                                type='button'
                                                className={cn(
                                                    'border-border bg-card hover:bg-muted/50 focus-visible:ring-ring/50 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none',
                                                    active && 'border-primary bg-primary/10'
                                                )}
                                                onClick={() => {
                                                    setIsCreatingPolicy(false);
                                                    setSelectedPolicyId(policy.id);
                                                }}>
                                                <span className='min-w-0 space-y-1'>
                                                    <span className='block truncate text-sm font-medium' data-i18n-skip>
                                                        {policy.name}
                                                    </span>
                                                    <span
                                                        className='text-muted-foreground block truncate text-xs'
                                                        data-i18n-skip>
                                                        {service?.name || t('admin.managedTasks.policies.noService')}
                                                    </span>
                                                    <span className='flex flex-wrap gap-2'>
                                                        <StatusPill
                                                            label={t(`admin.managedTasks.mode.${policy.mode}`)}
                                                            className='bg-primary/10 text-primary'
                                                        />
                                                        <StatusPill
                                                            label={t('admin.managedTasks.priorityValue', {
                                                                value: policy.priority
                                                            })}
                                                            className='bg-muted text-muted-foreground'
                                                        />
                                                        {policy.enabled ? (
                                                            <StatusPill
                                                                label={t('admin.managedTasks.status.enabled')}
                                                                className='bg-sky-500/10 text-sky-700 dark:text-sky-300'
                                                            />
                                                        ) : (
                                                            <StatusPill
                                                                label={t('admin.managedTasks.status.disabled')}
                                                                className='bg-muted text-muted-foreground'
                                                            />
                                                        )}
                                                    </span>
                                                </span>
                                                <ClipboardCheck className='text-muted-foreground mt-1 size-4 shrink-0' />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className='space-y-4'>
                    <Card>
                        <CardHeader>
                            <CardTitle className='text-base'>
                                {isCreatingService
                                    ? t('admin.managedTasks.services.createTitle')
                                    : t('admin.managedTasks.services.editTitle')}
                            </CardTitle>
                            <CardDescription>{t('admin.managedTasks.services.formDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className='space-y-4' onSubmit={submitService}>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-2'>
                                        <Label htmlFor='managed-task-service-name'>
                                            {t('admin.managedTasks.field.name')}
                                        </Label>
                                        <Input
                                            id='managed-task-service-name'
                                            value={serviceDraft.name}
                                            onChange={(event) => updateServiceDraft('name', event.target.value)}
                                            placeholder={t('admin.managedTasks.services.namePlaceholder')}
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <Label htmlFor='managed-task-service-base-url'>
                                            {t('admin.managedTasks.field.baseUrl')}
                                        </Label>
                                        <Input
                                            id='managed-task-service-base-url'
                                            value={serviceDraft.baseUrl}
                                            onChange={(event) => updateServiceDraft('baseUrl', event.target.value)}
                                            placeholder={t('admin.managedTasks.services.baseUrlPlaceholder')}
                                        />
                                    </div>
                                </div>

                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-2'>
                                        <Label>{t('admin.managedTasks.field.authMode')}</Label>
                                        <Select
                                            value={serviceDraft.authMode}
                                            onValueChange={(value) =>
                                                updateServiceDraft('authMode', value as ServiceDraft['authMode'])
                                            }>
                                            <SelectTrigger className='w-full'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='none'>
                                                    {t('admin.managedTasks.authMode.none')}
                                                </SelectItem>
                                                <SelectItem value='bearer'>
                                                    {t('admin.managedTasks.authMode.bearer')}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-2'>
                                        <Label htmlFor='managed-task-service-health-interval'>
                                            {t('admin.managedTasks.field.healthInterval')}
                                        </Label>
                                        <Input
                                            id='managed-task-service-health-interval'
                                            inputMode='numeric'
                                            value={serviceDraft.healthCheckIntervalSeconds}
                                            onChange={(event) =>
                                                updateServiceDraft('healthCheckIntervalSeconds', event.target.value)
                                            }
                                        />
                                    </div>
                                </div>

                                {serviceDraft.authMode === 'bearer' ? (
                                    <div className='space-y-2'>
                                        <Label htmlFor='managed-task-service-token'>
                                            {t('admin.managedTasks.field.authToken')}
                                        </Label>
                                        <PasswordInput
                                            id='managed-task-service-token'
                                            value={serviceDraft.authToken}
                                            onChange={(event) => updateServiceDraft('authToken', event.target.value)}
                                            placeholder={t('admin.managedTasks.services.tokenPlaceholder')}
                                        />
                                        <p className='text-muted-foreground text-xs'>{serviceAuthHelp}</p>
                                    </div>
                                ) : null}

                                <div className='grid gap-3 sm:grid-cols-3'>
                                    <label className='border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm'>
                                        <Checkbox
                                            checked={serviceDraft.enabled}
                                            onCheckedChange={(checked) =>
                                                updateServiceDraft('enabled', checked === true)
                                            }
                                        />
                                        {t('admin.managedTasks.field.enabled')}
                                    </label>
                                    <label className='border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm'>
                                        <Checkbox
                                            checked={serviceDraft.healthCheckEnabled}
                                            onCheckedChange={(checked) =>
                                                updateServiceDraft('healthCheckEnabled', checked === true)
                                            }
                                        />
                                        {t('admin.managedTasks.field.healthEnabled')}
                                    </label>
                                    <label className='border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm'>
                                        <Checkbox
                                            checked={serviceDraft.clearAuthToken}
                                            onCheckedChange={(checked) =>
                                                updateServiceDraft('clearAuthToken', checked === true)
                                            }
                                            disabled={isCreatingService || serviceDraft.authMode === 'none'}
                                        />
                                        {t('admin.managedTasks.field.clearToken')}
                                    </label>
                                </div>

                                {serviceCapabilities ? (
                                    <div className='bg-muted/40 space-y-2 rounded-lg p-3 text-sm'>
                                        <div className='flex items-center justify-between gap-3'>
                                            <span className='font-medium'>
                                                {t('admin.managedTasks.capabilities.title')}
                                            </span>
                                            {selectedService?.lastCheckedAt ? (
                                                <span className='text-muted-foreground text-xs'>
                                                    {formatDateTime(selectedService.lastCheckedAt)}
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className='grid gap-2 sm:grid-cols-2'>
                                            <CapabilityRow
                                                label={t('admin.managedTasks.capabilities.taskTypes')}
                                                value={serviceCapabilities.taskTypes.join(', ')}
                                            />
                                            <CapabilityRow
                                                label={t('admin.managedTasks.capabilities.credentials')}
                                                value={serviceCapabilities.credentialModes.join(', ')}
                                            />
                                            <CapabilityRow
                                                label={t('admin.managedTasks.capabilities.storage')}
                                                value={serviceCapabilities.storage?.primary || ''}
                                            />
                                            <CapabilityRow
                                                label={t('admin.managedTasks.capabilities.batchPolling')}
                                                value={
                                                    serviceCapabilities.events?.batchPolling
                                                        ? t('admin.managedTasks.yes')
                                                        : t('admin.managedTasks.no')
                                                }
                                            />
                                        </div>
                                    </div>
                                ) : null}

                                <div className='flex flex-col gap-2 sm:flex-row sm:justify-between'>
                                    <div className='flex gap-2'>
                                        {!isCreatingService && selectedService ? (
                                            <>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={() => void runHealthCheck(selectedService)}
                                                    disabled={Boolean(busyKey)}>
                                                    {busyKey === `service:check:${selectedService.id}` ? (
                                                        <Loader2 className='mr-2 size-4 animate-spin' />
                                                    ) : (
                                                        <Activity className='mr-2 size-4' />
                                                    )}
                                                    {t('admin.managedTasks.services.check')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    onClick={() =>
                                                        setDeleteTarget({ type: 'service', service: selectedService })
                                                    }
                                                    disabled={Boolean(busyKey)}>
                                                    <Trash2 className='mr-2 size-4' />
                                                    {t('admin.managedTasks.delete')}
                                                </Button>
                                            </>
                                        ) : null}
                                    </div>
                                    <Button type='submit' disabled={!serviceCanSubmit || Boolean(busyKey)}>
                                        {busyKey.startsWith('service:') && !busyKey.includes(':check:') ? (
                                            <Loader2 className='mr-2 size-4 animate-spin' />
                                        ) : (
                                            <Save className='mr-2 size-4' />
                                        )}
                                        {isCreatingService
                                            ? t('admin.managedTasks.services.create')
                                            : t('admin.managedTasks.services.save')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className='text-base'>
                                {isCreatingPolicy
                                    ? t('admin.managedTasks.policies.createTitle')
                                    : t('admin.managedTasks.policies.editTitle')}
                            </CardTitle>
                            <CardDescription>{t('admin.managedTasks.policies.formDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className='space-y-4' onSubmit={submitPolicy}>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <div className='space-y-2'>
                                        <Label htmlFor='managed-task-policy-name'>
                                            {t('admin.managedTasks.field.name')}
                                        </Label>
                                        <Input
                                            id='managed-task-policy-name'
                                            value={policyDraft.name}
                                            onChange={(event) => updatePolicyDraft('name', event.target.value)}
                                            placeholder={t('admin.managedTasks.policies.namePlaceholder')}
                                        />
                                    </div>
                                    <div className='space-y-2'>
                                        <Label htmlFor='managed-task-policy-priority'>
                                            {t('admin.managedTasks.field.priority')}
                                        </Label>
                                        <Input
                                            id='managed-task-policy-priority'
                                            inputMode='numeric'
                                            value={policyDraft.priority}
                                            onChange={(event) => updatePolicyDraft('priority', event.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className='grid gap-3 sm:grid-cols-3'>
                                    <div className='space-y-2'>
                                        <Label>{t('admin.managedTasks.field.mode')}</Label>
                                        <Select
                                            value={policyDraft.mode}
                                            onValueChange={(value) =>
                                                updatePolicyDraft('mode', value as GenerationExecutionMode)
                                            }>
                                            <SelectTrigger className='w-full'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(['managed-task', 'proxy', 'direct', 'auto'] as const).map((mode) => (
                                                    <SelectItem key={mode} value={mode}>
                                                        {t(`admin.managedTasks.mode.${mode}`)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>{t('admin.managedTasks.field.service')}</Label>
                                        <Select
                                            value={policyDraft.taskServiceId}
                                            onValueChange={(value) => updatePolicyDraft('taskServiceId', value)}
                                            disabled={services.length === 0}>
                                            <SelectTrigger className='w-full'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={EMPTY_SELECT_VALUE}>
                                                    {t('admin.managedTasks.policies.noService')}
                                                </SelectItem>
                                                {services.map((service) => (
                                                    <SelectItem key={service.id} value={service.id}>
                                                        {service.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className='space-y-2'>
                                        <Label>{t('admin.managedTasks.field.fallback')}</Label>
                                        <Select
                                            value={policyDraft.fallbackMode}
                                            onValueChange={(value) =>
                                                updatePolicyDraft('fallbackMode', value as ManagedTaskFallbackMode)
                                            }>
                                            <SelectTrigger className='w-full'>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(['fail-closed', 'ask-user', 'proxy', 'direct'] as const).map(
                                                    (mode) => (
                                                        <SelectItem key={mode} value={mode}>
                                                            {t(`admin.managedTasks.fallback.${mode}`)}
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Alert>
                                    <AlertTriangle className='size-4' />
                                    <AlertTitle>{t('admin.managedTasks.policies.matchTitle')}</AlertTitle>
                                    <AlertDescription>
                                        {t('admin.managedTasks.policies.matchDescription')}
                                    </AlertDescription>
                                </Alert>

                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <TextListField
                                        id='managed-task-policy-endpoints'
                                        label={t('admin.managedTasks.field.providerEndpointIds')}
                                        value={policyDraft.providerEndpointIds}
                                        onChange={(value) => updatePolicyDraft('providerEndpointIds', value)}
                                    />
                                    <TextListField
                                        id='managed-task-policy-base-urls'
                                        label={t('admin.managedTasks.field.baseUrls')}
                                        value={policyDraft.normalizedBaseUrls}
                                        onChange={(value) => updatePolicyDraft('normalizedBaseUrls', value)}
                                    />
                                    <TextListField
                                        id='managed-task-policy-provider-kinds'
                                        label={t('admin.managedTasks.field.providerKinds')}
                                        value={policyDraft.providerKinds}
                                        onChange={(value) => updatePolicyDraft('providerKinds', value)}
                                        placeholder={PROVIDER_KIND_OPTIONS.join(', ')}
                                    />
                                    <TextListField
                                        id='managed-task-policy-provider-protocols'
                                        label={t('admin.managedTasks.field.providerProtocols')}
                                        value={policyDraft.providerProtocols}
                                        onChange={(value) => updatePolicyDraft('providerProtocols', value)}
                                        placeholder={PROVIDER_PROTOCOL_OPTIONS.join(', ')}
                                    />
                                    <TextListField
                                        id='managed-task-policy-models'
                                        label={t('admin.managedTasks.field.modelCatalogEntryIds')}
                                        value={policyDraft.modelCatalogEntryIds}
                                        onChange={(value) => updatePolicyDraft('modelCatalogEntryIds', value)}
                                    />
                                    <div className='space-y-2'>
                                        <Label>{t('admin.managedTasks.field.taskCapabilities')}</Label>
                                        <div className='grid gap-2'>
                                            {P0_CAPABILITIES.map((capability) => (
                                                <label
                                                    key={capability}
                                                    className='border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm'>
                                                    <Checkbox
                                                        checked={policyDraft.taskCapabilities.includes(capability)}
                                                        onCheckedChange={(checked) => {
                                                            const next = checked
                                                                ? [...policyDraft.taskCapabilities, capability]
                                                                : policyDraft.taskCapabilities.filter(
                                                                      (item) => item !== capability
                                                                  );
                                                            updatePolicyDraft(
                                                                'taskCapabilities',
                                                                next.length > 0 ? next : [...P0_CAPABILITIES]
                                                            );
                                                        }}
                                                    />
                                                    <span data-i18n-skip>{capability}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                                    <NumberField
                                        id='managed-task-limit-hour'
                                        label={t('admin.managedTasks.field.maxSubmittedPerHour')}
                                        value={policyDraft.maxSubmittedTasksPerUserPerHour}
                                        onChange={(value) =>
                                            updatePolicyDraft('maxSubmittedTasksPerUserPerHour', value)
                                        }
                                    />
                                    <NumberField
                                        id='managed-task-limit-queued'
                                        label={t('admin.managedTasks.field.maxQueued')}
                                        value={policyDraft.maxQueuedTasksPerUser}
                                        onChange={(value) => updatePolicyDraft('maxQueuedTasksPerUser', value)}
                                    />
                                    <NumberField
                                        id='managed-task-limit-timeout'
                                        label={t('admin.managedTasks.field.timeoutSeconds')}
                                        value={policyDraft.timeoutSeconds}
                                        onChange={(value) => updatePolicyDraft('timeoutSeconds', value)}
                                    />
                                    <NumberField
                                        id='managed-task-limit-input'
                                        label={t('admin.managedTasks.field.maxInputAssetBytes')}
                                        value={policyDraft.maxInputAssetBytes}
                                        onChange={(value) => updatePolicyDraft('maxInputAssetBytes', value)}
                                    />
                                    <NumberField
                                        id='managed-task-limit-output'
                                        label={t('admin.managedTasks.field.maxOutputAssetBytes')}
                                        value={policyDraft.maxOutputAssetBytes}
                                        onChange={(value) => updatePolicyDraft('maxOutputAssetBytes', value)}
                                    />
                                    <label className='border-border flex items-center gap-2 rounded-md border px-3 py-2 text-sm sm:self-end'>
                                        <Checkbox
                                            checked={policyDraft.enabled}
                                            onCheckedChange={(checked) =>
                                                updatePolicyDraft('enabled', checked === true)
                                            }
                                        />
                                        {t('admin.managedTasks.field.enabled')}
                                    </label>
                                </div>

                                <div className='flex flex-col gap-2 sm:flex-row sm:justify-between'>
                                    {!isCreatingPolicy && selectedPolicy ? (
                                        <Button
                                            type='button'
                                            variant='outline'
                                            onClick={() => setDeleteTarget({ type: 'policy', policy: selectedPolicy })}
                                            disabled={Boolean(busyKey)}>
                                            <Trash2 className='mr-2 size-4' />
                                            {t('admin.managedTasks.delete')}
                                        </Button>
                                    ) : (
                                        <span />
                                    )}
                                    <Button type='submit' disabled={!policyCanSubmit || Boolean(busyKey)}>
                                        {busyKey.startsWith('policy:') ? (
                                            <Loader2 className='mr-2 size-4 animate-spin' />
                                        ) : (
                                            <Save className='mr-2 size-4' />
                                        )}
                                        {isCreatingPolicy
                                            ? t('admin.managedTasks.policies.create')
                                            : t('admin.managedTasks.policies.save')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2 text-base'>
                                <Workflow className='size-4' />
                                {t('admin.managedTasks.preview.title')}
                            </CardTitle>
                            <CardDescription>{t('admin.managedTasks.preview.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            <div className='grid gap-3 sm:grid-cols-2'>
                                <div className='space-y-2'>
                                    <Label>{t('admin.managedTasks.preview.task')}</Label>
                                    <Select
                                        value={previewDraft.taskCapability}
                                        onValueChange={(value) =>
                                            updatePreviewDraft(
                                                'taskCapability',
                                                value as PreviewDraft['taskCapability']
                                            )
                                        }>
                                        <SelectTrigger className='w-full'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='image.generate'>image.generate</SelectItem>
                                            <SelectItem value='image.edit'>image.edit</SelectItem>
                                            <SelectItem value='vision.text'>vision.text</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label>{t('admin.managedTasks.preview.defaultMode')}</Label>
                                    <Select
                                        value={previewDraft.defaultMode}
                                        onValueChange={(value) =>
                                            updatePreviewDraft('defaultMode', value as PreviewDraft['defaultMode'])
                                        }>
                                        <SelectTrigger className='w-full'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='proxy'>{t('admin.managedTasks.mode.proxy')}</SelectItem>
                                            <SelectItem value='direct'>
                                                {t('admin.managedTasks.mode.direct')}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='managed-task-preview-endpoint'>
                                        {t('admin.managedTasks.field.providerEndpointId')}
                                    </Label>
                                    <Input
                                        id='managed-task-preview-endpoint'
                                        value={previewDraft.providerEndpointId}
                                        onChange={(event) =>
                                            updatePreviewDraft('providerEndpointId', event.target.value)
                                        }
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='managed-task-preview-url'>
                                        {t('admin.managedTasks.field.baseUrl')}
                                    </Label>
                                    <Input
                                        id='managed-task-preview-url'
                                        value={previewDraft.apiBaseUrl}
                                        onChange={(event) => updatePreviewDraft('apiBaseUrl', event.target.value)}
                                        placeholder={t('admin.managedTasks.preview.apiBaseUrlPlaceholder')}
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label>{t('admin.managedTasks.field.providerKind')}</Label>
                                    <Select
                                        value={previewDraft.providerKind}
                                        onValueChange={(value) =>
                                            updatePreviewDraft('providerKind', value as ProviderKind)
                                        }>
                                        <SelectTrigger className='w-full'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PROVIDER_KIND_OPTIONS.map((providerKind) => (
                                                <SelectItem key={providerKind} value={providerKind}>
                                                    {providerKind}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label>{t('admin.managedTasks.field.providerProtocol')}</Label>
                                    <Select
                                        value={previewDraft.providerProtocol}
                                        onValueChange={(value) =>
                                            updatePreviewDraft('providerProtocol', value as ProviderProtocol)
                                        }>
                                        <SelectTrigger className='w-full'>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PROVIDER_PROTOCOL_OPTIONS.map((providerProtocol) => (
                                                <SelectItem key={providerProtocol} value={providerProtocol}>
                                                    {providerProtocol}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='managed-task-preview-model'>
                                        {t('admin.managedTasks.field.modelCatalogEntryId')}
                                    </Label>
                                    <Input
                                        id='managed-task-preview-model'
                                        value={previewDraft.modelCatalogEntryId}
                                        onChange={(event) =>
                                            updatePreviewDraft('modelCatalogEntryId', event.target.value)
                                        }
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='managed-task-preview-raw-model'>
                                        {t('admin.managedTasks.field.rawModelId')}
                                    </Label>
                                    <Input
                                        id='managed-task-preview-raw-model'
                                        value={previewDraft.rawModelId}
                                        onChange={(event) => updatePreviewDraft('rawModelId', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className='border-border bg-muted/40 rounded-lg border p-4'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <StatusPill
                                        label={t(`admin.managedTasks.resolvedMode.${previewResult.mode}`)}
                                        className={getModeTone(previewResult.mode)}
                                    />
                                    <StatusPill
                                        label={t(`admin.managedTasks.reason.${previewResult.reason}`)}
                                        className='bg-card text-card-foreground border-border border'
                                    />
                                </div>
                                <div className='text-muted-foreground mt-3 grid gap-1 text-xs sm:grid-cols-2'>
                                    <p>
                                        {t('admin.managedTasks.preview.policy')}:{' '}
                                        <span className='text-foreground' data-i18n-skip>
                                            {previewResult.policyName ||
                                                previewResult.policyId ||
                                                t('admin.managedTasks.none')}
                                        </span>
                                    </p>
                                    <p>
                                        {t('admin.managedTasks.preview.service')}:{' '}
                                        <span className='text-foreground' data-i18n-skip>
                                            {previewResult.taskServiceName ||
                                                previewResult.taskServiceId ||
                                                t('admin.managedTasks.none')}
                                        </span>
                                    </p>
                                    <p>
                                        {t('admin.managedTasks.preview.servicesCount', {
                                            count: formatNumber(services.length)
                                        })}
                                    </p>
                                    <p>
                                        {t('admin.managedTasks.preview.policiesCount', {
                                            count: formatNumber(policies.length)
                                        })}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('admin.managedTasks.confirmDeleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {deleteTarget?.type === 'service'
                                ? t('admin.managedTasks.confirmDeleteServiceDescription')
                                : t('admin.managedTasks.confirmDeletePolicyDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => setDeleteTarget(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            onClick={() => void confirmDelete()}
                            disabled={Boolean(busyKey)}>
                            {busyKey.endsWith(':delete') ? (
                                <Loader2 className='mr-2 size-4 animate-spin' />
                            ) : (
                                <Trash2 className='mr-2 size-4' />
                            )}
                            {t('admin.managedTasks.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

function CapabilityRow({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0'>
            <p className='text-muted-foreground text-xs'>{label}</p>
            <p className='truncate text-sm' data-i18n-skip>
                {value || '-'}
            </p>
        </div>
    );
}

function TextListField({
    id,
    label,
    value,
    onChange,
    placeholder
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <div className='space-y-2'>
            <Label htmlFor={id}>{label}</Label>
            <Textarea
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className='min-h-20 resize-y'
            />
        </div>
    );
}

function NumberField({
    id,
    label,
    value,
    onChange
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className='space-y-2'>
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} inputMode='numeric' value={value} onChange={(event) => onChange(event.target.value)} />
        </div>
    );
}
