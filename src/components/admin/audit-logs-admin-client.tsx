'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Eye,
    Filter,
    Info,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Trash2
} from 'lucide-react';
import * as React from 'react';

type AuditLogRecord = {
    id: string;
    actorUserId: string | null;
    actorType: string;
    action: string;
    targetType: string;
    targetId: string;
    ip: string | null;
    userAgent: string | null;
    metadataJson: string;
    createdAt: string;
};

export type AuditLogPagePayload = {
    logs: AuditLogRecord[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    maintenance: {
        keyConfigured: boolean;
        maxRows: number;
    };
};

type AuditLogsAdminClientProps = {
    initialPayload: AuditLogPagePayload;
};

type AuditLevel = 'critical' | 'warning' | 'info';
type AuditCategory = 'auth' | 'promo' | 'user' | 'system';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

type TranslateFn = ReturnType<typeof useAppLanguage>['t'];

const actionLabelKeys: Record<string, string> = {
    admin_login: 'phase4b.auditActionAdminLogin',
    admin_user_create: 'phase4b.auditActionAdminUserCreate',
    admin_user_update: 'phase4b.auditActionAdminUserUpdate',
    audit_log_clear: 'phase4b.clearAuditLogs',
    audit_log_delete: 'phase4b.auditActionDeleteAudit',
    bootstrap_owner_create: 'phase4b.auditActionBootstrapOwnerCreate',
    bootstrap_owner_reset_password: 'phase4b.auditActionBootstrapOwnerResetPassword',
    promo_config_create: 'phase4b.auditActionPromoConfigCreate',
    promo_config_delete: 'phase4b.deleteDisplayGroup',
    promo_config_update: 'phase4b.auditActionPromoConfigUpdate',
    promo_item_create: 'phase4b.auditActionPromoItemCreate',
    promo_item_delete: 'assets.delete.title',
    promo_item_update: 'phase4b.auditActionPromoItemUpdate',
    promo_share_key_batch_create: 'phase4b.auditActionPromoShareKeyBatchCreate',
    promo_share_key_create: 'phase4b.auditActionPromoShareKeyCreate',
    promo_share_key_disabled: 'phase4b.auditActionPromoShareKeyDisabled',
    promo_share_key_revoked: 'phase4b.auditActionPromoShareKeyRevoked',
    promo_share_key_update: 'phase4b.auditActionPromoShareKeyUpdate',
    promo_share_profile_create: 'phase4b.auditActionPromoShareProfileCreate',
    promo_slot_create: 'phase4b.auditActionPromoSlotCreate',
    promo_slot_delete: 'phase4b.auditActionPromoSlotDelete',
    promo_slot_update: 'phase4b.auditActionPromoSlotUpdate'
};

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
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error?: unknown }).error === 'string'
                ? (payload as { error: string }).error || fallbackError
                : fallbackError;
        throw new Error(errorMessage);
    }
    return payload as T;
}

function getActionLabel(action: string, t: TranslateFn): string {
    const labelKey = actionLabelKeys[action];
    return labelKey ? t(labelKey) : action.replace(/_/g, ' ');
}

function getAuditCategory(log: AuditLogRecord): AuditCategory {
    if (log.action.startsWith('promo_') || log.targetType.startsWith('promo_')) return 'promo';
    if (log.action.startsWith('admin_user') || log.action.startsWith('bootstrap_') || log.targetType === 'user')
        return 'user';
    if (log.action.includes('login') || log.targetType === 'session') return 'auth';
    return 'system';
}

function getAuditLevel(log: AuditLogRecord): AuditLevel {
    if (
        log.action.includes('delete') ||
        log.action.includes('clear') ||
        log.action.includes('revoked') ||
        log.action.includes('reset_password')
    ) {
        return 'critical';
    }
    if (log.action.includes('disabled') || log.action.includes('update') || log.action.includes('bootstrap'))
        return 'warning';
    return 'info';
}

function categoryLabel(category: AuditCategory, t: TranslateFn): string {
    const labelKeys: Record<AuditCategory, string> = {
        auth: 'phase4b.auditCategoryAuth',
        promo: 'phase4b.auditCategoryPromo',
        user: 'phase4b.account',
        system: 'phase4b.auditCategorySystem'
    };
    return t(labelKeys[category]);
}

function levelLabel(level: AuditLevel, t: TranslateFn): string {
    const labelKeys: Record<AuditLevel, string> = {
        critical: 'phase4b.highRisk',
        warning: 'phase4b.auditLevelWarning',
        info: 'phase4b.auditLevelInfo'
    };
    return t(labelKeys[level]);
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', className)}>
            {children}
        </span>
    );
}

function CategoryPill({ category }: { category: AuditCategory }) {
    const { t } = useAppLanguage();
    const className =
        category === 'promo'
            ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
            : category === 'user'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : category === 'auth'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground';

    return <Pill className={className}>{categoryLabel(category, t)}</Pill>;
}

function LevelPill({ level }: { level: AuditLevel }) {
    const { t } = useAppLanguage();
    const className =
        level === 'critical'
            ? 'bg-red-500/10 text-red-700 dark:text-red-300'
            : level === 'warning'
              ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
              : 'bg-muted text-muted-foreground';

    return <Pill className={className}>{levelLabel(level, t)}</Pill>;
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function formatMetadata(value: string): string {
    try {
        return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
        return value;
    }
}

function buildPageUrl(page: number, pageSize: number): string {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize)
    });
    return `/api/admin/audit-logs?${params.toString()}`;
}

export function AuditLogsAdminClient({ initialPayload }: AuditLogsAdminClientProps) {
    const { t } = useAppLanguage();
    const [payload, setPayload] = React.useState(initialPayload);
    const [selectedLog, setSelectedLog] = React.useState<AuditLogRecord | null>(null);
    const [maintenanceKey, setMaintenanceKey] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');
    const [logPendingDelete, setLogPendingDelete] = React.useState<AuditLogRecord | null>(null);
    const [isClearAuditDialogOpen, setIsClearAuditDialogOpen] = React.useState(false);

    const counts = React.useMemo(() => {
        const byLevel: Record<AuditLevel, number> = { critical: 0, warning: 0, info: 0 };
        const byCategory: Record<AuditCategory, number> = { auth: 0, promo: 0, user: 0, system: 0 };

        for (const log of payload.logs) {
            byLevel[getAuditLevel(log)] += 1;
            byCategory[getAuditCategory(log)] += 1;
        }

        return { byLevel, byCategory };
    }, [payload.logs]);

    const loadPage = React.useCallback(
        async (page: number, pageSize = payload.pageSize, options?: { notify?: boolean }) => {
            setBusyKey('reload');
            setError('');
            if (options?.notify !== false) setMessage('');
            try {
                const nextPayload = await requestJson<AuditLogPagePayload>(
                    buildPageUrl(page, pageSize),
                    undefined,
                    t('admin.publicActions.notice.failed')
                );
                setPayload(nextPayload);
                if (options?.notify !== false) setMessage(t('phase4b.auditListRefreshed'));
            } catch (err) {
                setError(err instanceof Error ? err.message : t('phase4b.refreshFailed'));
            } finally {
                setBusyKey('');
            }
        },
        [payload.pageSize, t]
    );

    const executeDeleteOne = async (log: AuditLogRecord) => {
        setBusyKey(`delete-${log.id}`);
        setError('');
        setMessage('');
        try {
            await requestJson(`/api/admin/audit-logs/${log.id}`, {
                method: 'DELETE',
                body: JSON.stringify({ maintenanceKey })
            }, t('admin.publicActions.notice.failed'));
            setSelectedLog(null);
            setMessage(t('phase4b.auditRecordDeleted'));
            await loadPage(payload.page, payload.pageSize, { notify: false });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.deleteFailed'));
        } finally {
            setBusyKey('');
        }
    };

    const deleteOne = (log: AuditLogRecord) => {
        setLogPendingDelete(log);
    };

    const confirmDeleteOne = async () => {
        const log = logPendingDelete;
        if (!log) return;
        setLogPendingDelete(null);
        await executeDeleteOne(log);
    };

    const executeClearAll = async () => {
        setBusyKey('clear');
        setError('');
        setMessage('');
        try {
            const result = await requestJson<{ deletedCount: number }>('/api/admin/audit-logs', {
                method: 'DELETE',
                body: JSON.stringify({ maintenanceKey })
            }, t('admin.publicActions.notice.failed'));
            setMessage(t('phase4b.auditRecordsCleared', { count: result.deletedCount }));
            await loadPage(1, payload.pageSize, { notify: false });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.clearFailed'));
        } finally {
            setBusyKey('');
        }
    };

    const clearAll = () => {
        setIsClearAuditDialogOpen(true);
    };

    const confirmClearAll = async () => {
        setIsClearAuditDialogOpen(false);
        await executeClearAll();
    };

    return (
        <section className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <Heading level={1} size='section'>
                        <LocalizedMessage id='phase4b.auditLogs' />
                    </Heading>
                    <p className='text-muted-foreground mt-1 text-sm'>
                        <LocalizedMessage id='phase4b.pageThroughKeyAdminActionsByTimeThe' />
                    </p>
                </div>
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => loadPage(payload.page)}
                    disabled={busyKey === 'reload'}>
                    {busyKey === 'reload' ? (
                        <Loader2 className='size-4 animate-spin' />
                    ) : (
                        <RefreshCw className='size-4' />
                    )}
                    <LocalizedMessage id='inspiration.action.reload' />
                </Button>
            </div>

            {error && (
                <Alert variant='destructive'>
                    <AlertTriangle className='size-4' />
                    <AlertTitle>
                        <LocalizedMessage id='phase4b.failed' />
                    </AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {message && (
                <Alert className='border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'>
                    <ShieldCheck className='size-4' />
                    <AlertTitle>
                        <LocalizedMessage id='video.status.succeeded' />
                    </AlertTitle>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}

            <div className='grid gap-3 md:grid-cols-4'>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>
                            <LocalizedMessage id='phase4b.total' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.pageStatistics' />
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='text-2xl font-semibold'>{payload.total}</CardContent>
                </Card>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>
                            <LocalizedMessage id='phase4b.highRisk' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.deletesClearsAndResetsOnThisPage' />
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='text-2xl font-semibold text-red-700 dark:text-red-300'>
                        {counts.byLevel.critical}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>
                            <LocalizedMessage id='phase4b.promoChanges' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.promoRelatedEntriesOnThisPage' />
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='text-2xl font-semibold text-sky-700 dark:text-sky-300'>
                        {counts.byCategory.promo}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>
                            <LocalizedMessage id='phase4b.automaticRotation' />
                        </CardTitle>
                        <CardDescription>
                            {payload.maintenance.maxRows > 0 ? t('phase4b.keepLatestRows') : t('phase4b.off')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='text-2xl font-semibold'>
                        {payload.maintenance.maxRows > 0 ? payload.maintenance.maxRows : 'off'}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className='gap-3 lg:flex-row lg:items-start lg:justify-between'>
                    <div>
                        <CardTitle>
                            <LocalizedMessage id='phase4b.auditList' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.page' /> {payload.page} / {payload.totalPages}{' '}
                            <LocalizedMessage id='phase4b.upTo100RowsPerPage' />
                        </CardDescription>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Filter className='text-muted-foreground size-4' />
                        <Label htmlFor='audit-page-size' className='text-muted-foreground text-xs'>
                            <LocalizedMessage id='phase4b.perPage' />
                        </Label>
                        <select
                            id='audit-page-size'
                            className='border-input bg-background h-8 rounded-md border px-2 text-sm'
                            value={payload.pageSize}
                            onChange={(event) => loadPage(1, Number(event.target.value))}>
                            {PAGE_SIZE_OPTIONS.map((pageSize) => (
                                <option key={pageSize} value={pageSize}>
                                    {pageSize}
                                </option>
                            ))}
                        </select>
                    </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <div className='overflow-hidden rounded-md border'>
                        <div className='bg-muted/60 text-muted-foreground grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 text-xs font-medium md:grid-cols-[150px_150px_minmax(0,1fr)_160px_auto]'>
                            <span>
                                <LocalizedMessage id='phase4b.time' />
                            </span>
                            <span className='hidden md:block'>
                                <LocalizedMessage id='phase4b.categoryLevel' />
                            </span>
                            <span>
                                <LocalizedMessage id='phase4b.eventSummary' />
                            </span>
                            <span className='hidden md:block'>
                                <LocalizedMessage id='phase4b.actor' />
                            </span>
                            <span className='text-right'>
                                <LocalizedMessage id='assets.list.actions' />
                            </span>
                        </div>
                        {payload.logs.map((log) => {
                            const category = getAuditCategory(log);
                            const level = getAuditLevel(log);
                            return (
                                <div
                                    key={log.id}
                                    className='grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t px-3 py-3 text-sm md:grid-cols-[150px_150px_minmax(0,1fr)_160px_auto]'>
                                    <div className='text-muted-foreground text-xs'>{formatDateTime(log.createdAt)}</div>
                                    <div className='hidden flex-wrap gap-1 md:flex'>
                                        <CategoryPill category={category} />
                                        <LevelPill level={level} />
                                    </div>
                                    <div className='min-w-0'>
                                        <div className='flex flex-wrap gap-1 md:hidden'>
                                            <CategoryPill category={category} />
                                            <LevelPill level={level} />
                                        </div>
                                        <p className='mt-1 truncate font-medium md:mt-0'>
                                            {getActionLabel(log.action, t)}
                                        </p>
                                        <p className='text-muted-foreground mt-1 truncate text-xs'>
                                            {log.targetType} / {log.targetId}
                                        </p>
                                    </div>
                                    <div className='text-muted-foreground hidden min-w-0 text-xs md:block'>
                                        <p className='truncate'>{log.actorUserId || log.actorType}</p>
                                        <p className='mt-1 truncate'>{log.ip || t('phase4b.noIp')}</p>
                                    </div>
                                    <div className='flex justify-end gap-2'>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            onClick={() => setSelectedLog(log)}>
                                            <Eye className='size-4' />
                                            <LocalizedMessage id='phase4b.details' />
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            disabled={
                                                !payload.maintenance.keyConfigured ||
                                                !maintenanceKey ||
                                                busyKey === `delete-${log.id}`
                                            }
                                            onClick={() => deleteOne(log)}
                                            aria-label={t('admin.audit.deleteRecordAria')}>
                                            {busyKey === `delete-${log.id}` ? (
                                                <Loader2 className='size-4 animate-spin' />
                                            ) : (
                                                <Trash2 className='size-4' />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                        {payload.logs.length === 0 && (
                            <div className='text-muted-foreground px-3 py-10 text-center text-sm'>
                                <LocalizedMessage id='phase4b.noAuditLogsYet' />
                            </div>
                        )}
                    </div>

                    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                        <p className='text-muted-foreground text-xs'>
                            <LocalizedMessage id='phase4b.showing' />{' '}
                            {(payload.page - 1) * payload.pageSize + (payload.logs.length ? 1 : 0)}-
                            {(payload.page - 1) * payload.pageSize + payload.logs.length} / {payload.total}
                        </p>
                        <div className='flex gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                disabled={payload.page <= 1 || busyKey === 'reload'}
                                onClick={() => loadPage(payload.page - 1)}>
                                <ChevronLeft className='size-4' />
                                <LocalizedMessage id='phase4b.previousPage' />
                            </Button>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                disabled={payload.page >= payload.totalPages || busyKey === 'reload'}
                                onClick={() => loadPage(payload.page + 1)}>
                                <LocalizedMessage id='phase4b.nextPage' />
                                <ChevronRight className='size-4' />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>
                        <LocalizedMessage id='phase4b.auditMaintenance' />
                    </CardTitle>
                    <CardDescription>
                        <LocalizedMessage id='phase4b.deletingOrClearingRequiresAnOwnerSessionAnd' />
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {!payload.maintenance.keyConfigured && (
                        <Alert>
                            <Info className='size-4' />
                            <AlertTitle>
                                <LocalizedMessage id='phase4b.maintenanceKeyIsNotConfigured' />
                            </AlertTitle>
                            <AlertDescription>
                                <LocalizedMessage id='phase4b.thisEnvironmentWillNotAllowManualAuditLog' />
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]'>
                        <div className='space-y-2'>
                            <Label htmlFor='audit-maintenance-key' className='text-muted-foreground text-xs'>
                                <LocalizedMessage id='phase4b.auditMaintenanceKey' />
                            </Label>
                            <PasswordInput
                                id='audit-maintenance-key'
                                value={maintenanceKey}
                                onChange={(event) => setMaintenanceKey(event.target.value)}
                                placeholder='AUDIT_LOG_MAINTENANCE_KEY'
                                disabled={!payload.maintenance.keyConfigured}
                            />
                        </div>
                        <div className='flex items-end'>
                            <Button
                                type='button'
                                variant='destructive'
                                onClick={clearAll}
                                disabled={!payload.maintenance.keyConfigured || !maintenanceKey || busyKey === 'clear'}>
                                {busyKey === 'clear' ? (
                                    <Loader2 className='size-4 animate-spin' />
                                ) : (
                                    <Trash2 className='size-4' />
                                )}
                                <LocalizedMessage id='phase4b.clearAuditLogs' />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={Boolean(logPendingDelete)}
                onOpenChange={(open) => {
                    if (!open) setLogPendingDelete(null);
                }}>
                <DialogContent className='max-w-md'>
                    <DialogHeader>
                        <DialogTitle>
                            <LocalizedMessage id='phase4b.deleteAuditLog' />
                        </DialogTitle>
                        <DialogDescription>
                            <LocalizedMessage id='phase4b.deleteThisAuditLogThisCannotBeUndone' />
                        </DialogDescription>
                    </DialogHeader>
                    {logPendingDelete && (
                        <div className='bg-muted/30 rounded-md border p-3 text-sm'>
                            <p className='font-medium'>{getActionLabel(logPendingDelete.action, t)}</p>
                            <p className='text-muted-foreground mt-1 text-xs break-all'>
                                {logPendingDelete.targetType} / {logPendingDelete.targetId}
                            </p>
                        </div>
                    )}
                    <DialogFooter className='gap-2 sm:justify-end'>
                        <Button type='button' variant='outline' onClick={() => setLogPendingDelete(null)}>
                            <LocalizedMessage id='tasks.cancel' />
                        </Button>
                        <Button type='button' variant='destructive' onClick={confirmDeleteOne}>
                            <LocalizedMessage id='assets.action.delete' />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isClearAuditDialogOpen} onOpenChange={setIsClearAuditDialogOpen}>
                <DialogContent className='max-w-md'>
                    <DialogHeader>
                        <DialogTitle>
                            <LocalizedMessage id='phase4b.clearAuditLogs.8bbe01' />
                        </DialogTitle>
                        <DialogDescription>
                            <LocalizedMessage id='phase4b.clearAllCurrentAuditLogsANewClear' />
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className='gap-2 sm:justify-end'>
                        <Button type='button' variant='outline' onClick={() => setIsClearAuditDialogOpen(false)}>
                            <LocalizedMessage id='tasks.cancel' />
                        </Button>
                        <Button type='button' variant='destructive' onClick={confirmClearAll}>
                            <LocalizedMessage id='phase4b.clearAuditLogs' />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className='max-w-3xl'>
                    {selectedLog && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{getActionLabel(selectedLog.action, t)}</DialogTitle>
                                <DialogDescription>
                                    {formatDateTime(selectedLog.createdAt)} / {selectedLog.targetType} /{' '}
                                    {selectedLog.targetId}
                                </DialogDescription>
                            </DialogHeader>
                            <div className='space-y-4 text-sm'>
                                <div className='flex flex-wrap gap-2'>
                                    <CategoryPill category={getAuditCategory(selectedLog)} />
                                    <LevelPill level={getAuditLevel(selectedLog)} />
                                    <Pill className='bg-muted text-muted-foreground'>{selectedLog.action}</Pill>
                                </div>
                                <div className='grid gap-3 md:grid-cols-2'>
                                    <div className='rounded-md border p-3'>
                                        <p className='text-muted-foreground text-xs font-medium'>
                                            <LocalizedMessage id='phase4b.actor' />
                                        </p>
                                        <p className='mt-1 break-all'>
                                            {selectedLog.actorUserId || selectedLog.actorType}
                                        </p>
                                    </div>
                                    <div className='rounded-md border p-3'>
                                        <p className='text-muted-foreground text-xs font-medium'>
                                            <LocalizedMessage id='phase4b.sourceIp' />
                                        </p>
                                        <p className='mt-1 break-all'>{selectedLog.ip || '-'}</p>
                                    </div>
                                    <div className='rounded-md border p-3 md:col-span-2'>
                                        <p className='text-muted-foreground text-xs font-medium'>
                                            <LocalizedMessage id='phase4b.userAgent' />
                                        </p>
                                        <p className='mt-1 break-all'>{selectedLog.userAgent || '-'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className='text-muted-foreground mb-2 text-xs font-medium'>
                                        <LocalizedMessage id='phase4b.fullMetadata' />
                                    </p>
                                    <pre className='bg-muted/50 max-h-[38vh] overflow-auto rounded-md p-3 text-xs leading-5'>
                                        {formatMetadata(selectedLog.metadataJson)}
                                    </pre>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
