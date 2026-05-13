'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, Filter, Info, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
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

const actionLabels: Record<string, string> = {
    admin_login: '管理员登录',
    admin_user_create: '创建管理员',
    admin_user_update: '更新管理员',
    audit_log_clear: '清空审计',
    audit_log_delete: '删除审计',
    bootstrap_owner_create: '初始化 Owner',
    bootstrap_owner_reset_password: '重置 Owner 密码',
    promo_config_create: '创建展示组',
    promo_config_delete: '删除展示组',
    promo_config_update: '更新展示组',
    promo_item_create: '创建素材',
    promo_item_delete: '删除素材',
    promo_item_update: '更新素材',
    promo_share_key_batch_create: '批量创建分享 Key',
    promo_share_key_create: '创建分享 Key',
    promo_share_key_disabled: '停用分享 Key',
    promo_share_key_revoked: '吊销分享 Key',
    promo_share_key_update: '更新分享 Key',
    promo_share_profile_create: '创建分享 Profile',
    promo_slot_create: '创建展示位',
    promo_slot_delete: '删除展示位',
    promo_slot_update: '更新展示位'
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

function getActionLabel(action: string): string {
    return actionLabels[action] || action.replace(/_/g, ' ');
}

function getAuditCategory(log: AuditLogRecord): AuditCategory {
    if (log.action.startsWith('promo_') || log.targetType.startsWith('promo_')) return 'promo';
    if (log.action.startsWith('admin_user') || log.action.startsWith('bootstrap_') || log.targetType === 'user') return 'user';
    if (log.action.includes('login') || log.targetType === 'session') return 'auth';
    return 'system';
}

function getAuditLevel(log: AuditLogRecord): AuditLevel {
    if (log.action.includes('delete') || log.action.includes('clear') || log.action.includes('revoked') || log.action.includes('reset_password')) {
        return 'critical';
    }
    if (log.action.includes('disabled') || log.action.includes('update') || log.action.includes('bootstrap')) return 'warning';
    return 'info';
}

function categoryLabel(category: AuditCategory): string {
    const labels: Record<AuditCategory, string> = {
        auth: '登录',
        promo: '展示',
        user: '账号',
        system: '系统'
    };
    return labels[category];
}

function levelLabel(level: AuditLevel): string {
    const labels: Record<AuditLevel, string> = {
        critical: '高风险',
        warning: '变更',
        info: '信息'
    };
    return labels[level];
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
    return <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', className)}>{children}</span>;
}

function CategoryPill({ category }: { category: AuditCategory }) {
    const className =
        category === 'promo'
            ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
            : category === 'user'
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : category === 'auth'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground';

    return <Pill className={className}>{categoryLabel(category)}</Pill>;
}

function LevelPill({ level }: { level: AuditLevel }) {
    const className =
        level === 'critical'
            ? 'bg-red-500/10 text-red-700 dark:text-red-300'
            : level === 'warning'
              ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
              : 'bg-muted text-muted-foreground';

    return <Pill className={className}>{levelLabel(level)}</Pill>;
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
    const [payload, setPayload] = React.useState(initialPayload);
    const [selectedLog, setSelectedLog] = React.useState<AuditLogRecord | null>(null);
    const [maintenanceKey, setMaintenanceKey] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');

    const counts = React.useMemo(() => {
        const byLevel: Record<AuditLevel, number> = { critical: 0, warning: 0, info: 0 };
        const byCategory: Record<AuditCategory, number> = { auth: 0, promo: 0, user: 0, system: 0 };

        for (const log of payload.logs) {
            byLevel[getAuditLevel(log)] += 1;
            byCategory[getAuditCategory(log)] += 1;
        }

        return { byLevel, byCategory };
    }, [payload.logs]);

    const loadPage = React.useCallback(async (page: number, pageSize = payload.pageSize, options?: { notify?: boolean }) => {
        setBusyKey('reload');
        setError('');
        if (options?.notify !== false) setMessage('');
        try {
            const nextPayload = await requestJson<AuditLogPagePayload>(buildPageUrl(page, pageSize));
            setPayload(nextPayload);
            if (options?.notify !== false) setMessage('审计列表已刷新。');
        } catch (err) {
            setError(err instanceof Error ? err.message : '刷新失败。');
        } finally {
            setBusyKey('');
        }
    }, [payload.pageSize]);

    const deleteOne = async (log: AuditLogRecord) => {
        if (!window.confirm(`确认删除这条审计记录？\n${getActionLabel(log.action)} / ${log.targetId}`)) return;
        setBusyKey(`delete-${log.id}`);
        setError('');
        setMessage('');
        try {
            await requestJson(`/api/admin/audit-logs/${log.id}`, {
                method: 'DELETE',
                body: JSON.stringify({ maintenanceKey })
            });
            setSelectedLog(null);
            setMessage('审计记录已删除。');
            await loadPage(payload.page, payload.pageSize, { notify: false });
        } catch (err) {
            setError(err instanceof Error ? err.message : '删除失败。');
        } finally {
            setBusyKey('');
        }
    };

    const clearAll = async () => {
        if (!window.confirm('确认清空当前所有审计记录？清空后系统会写入一条新的清空审计记录。')) return;
        setBusyKey('clear');
        setError('');
        setMessage('');
        try {
            const result = await requestJson<{ deletedCount: number }>('/api/admin/audit-logs', {
                method: 'DELETE',
                body: JSON.stringify({ maintenanceKey })
            });
            setMessage(`已清空 ${result.deletedCount} 条审计记录。`);
            await loadPage(1, payload.pageSize, { notify: false });
        } catch (err) {
            setError(err instanceof Error ? err.message : '清空失败。');
        } finally {
            setBusyKey('');
        }
    };

    return (
        <section className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <h1 className='text-2xl font-semibold'>审计日志</h1>
                    <p className='mt-1 text-sm text-muted-foreground'>按时间分页查看后台关键动作，列表保留摘要，详情内查看完整上下文。</p>
                </div>
                <Button type='button' variant='outline' size='sm' onClick={() => loadPage(payload.page)} disabled={busyKey === 'reload'}>
                    {busyKey === 'reload' ? <Loader2 className='size-4 animate-spin' /> : <RefreshCw className='size-4' />}
                    刷新
                </Button>
            </div>

            {error && (
                <Alert variant='destructive'>
                    <AlertTriangle className='size-4' />
                    <AlertTitle>操作失败</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {message && (
                <Alert className='border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'>
                    <ShieldCheck className='size-4' />
                    <AlertTitle>已完成</AlertTitle>
                    <AlertDescription>{message}</AlertDescription>
                </Alert>
            )}

            <div className='grid gap-3 md:grid-cols-4'>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>总量</CardTitle>
                        <CardDescription>分页统计</CardDescription>
                    </CardHeader>
                    <CardContent className='text-2xl font-semibold'>{payload.total}</CardContent>
                </Card>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>高风险</CardTitle>
                        <CardDescription>当前页删除/清空/重置</CardDescription>
                    </CardHeader>
                    <CardContent className='text-2xl font-semibold text-red-700 dark:text-red-300'>{counts.byLevel.critical}</CardContent>
                </Card>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>推广变更</CardTitle>
                        <CardDescription>当前页展示相关</CardDescription>
                    </CardHeader>
                    <CardContent className='text-2xl font-semibold text-sky-700 dark:text-sky-300'>{counts.byCategory.promo}</CardContent>
                </Card>
                <Card>
                    <CardHeader className='pb-2'>
                        <CardTitle className='text-sm font-medium'>自动轮换</CardTitle>
                        <CardDescription>{payload.maintenance.maxRows > 0 ? '保留最新行数' : '已关闭'}</CardDescription>
                    </CardHeader>
                    <CardContent className='text-2xl font-semibold'>{payload.maintenance.maxRows > 0 ? payload.maintenance.maxRows : 'off'}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className='gap-3 lg:flex-row lg:items-start lg:justify-between'>
                    <div>
                        <CardTitle>审计列表</CardTitle>
                        <CardDescription>第 {payload.page} / {payload.totalPages} 页，每页最多 100 条。</CardDescription>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Filter className='size-4 text-muted-foreground' />
                        <Label htmlFor='audit-page-size' className='text-xs text-muted-foreground'>每页</Label>
                        <select
                            id='audit-page-size'
                            className='h-8 rounded-md border border-input bg-background px-2 text-sm'
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
                        <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground md:grid-cols-[150px_150px_minmax(0,1fr)_160px_auto]'>
                            <span>时间</span>
                            <span className='hidden md:block'>分类/级别</span>
                            <span>事件摘要</span>
                            <span className='hidden md:block'>操作者</span>
                            <span className='text-right'>操作</span>
                        </div>
                        {payload.logs.map((log) => {
                            const category = getAuditCategory(log);
                            const level = getAuditLevel(log);
                            return (
                                <div
                                    key={log.id}
                                    className='grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t px-3 py-3 text-sm md:grid-cols-[150px_150px_minmax(0,1fr)_160px_auto]'>
                                    <div className='text-xs text-muted-foreground'>{formatDateTime(log.createdAt)}</div>
                                    <div className='hidden flex-wrap gap-1 md:flex'>
                                        <CategoryPill category={category} />
                                        <LevelPill level={level} />
                                    </div>
                                    <div className='min-w-0'>
                                        <div className='flex flex-wrap gap-1 md:hidden'>
                                            <CategoryPill category={category} />
                                            <LevelPill level={level} />
                                        </div>
                                        <p className='mt-1 truncate font-medium md:mt-0'>{getActionLabel(log.action)}</p>
                                        <p className='mt-1 truncate text-xs text-muted-foreground'>
                                            {log.targetType} / {log.targetId}
                                        </p>
                                    </div>
                                    <div className='hidden min-w-0 text-xs text-muted-foreground md:block'>
                                        <p className='truncate'>{log.actorUserId || log.actorType}</p>
                                        <p className='mt-1 truncate'>{log.ip || '无 IP'}</p>
                                    </div>
                                    <div className='flex justify-end gap-2'>
                                        <Button type='button' variant='outline' size='sm' onClick={() => setSelectedLog(log)}>
                                            <Eye className='size-4' />
                                            详情
                                        </Button>
                                        <Button
                                            type='button'
                                            variant='outline'
                                            size='sm'
                                            disabled={!payload.maintenance.keyConfigured || !maintenanceKey || busyKey === `delete-${log.id}`}
                                            onClick={() => deleteOne(log)}
                                            aria-label='删除审计记录'>
                                            {busyKey === `delete-${log.id}` ? <Loader2 className='size-4 animate-spin' /> : <Trash2 className='size-4' />}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                        {payload.logs.length === 0 && (
                            <div className='px-3 py-10 text-center text-sm text-muted-foreground'>暂无审计记录。</div>
                        )}
                    </div>

                    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                        <p className='text-xs text-muted-foreground'>
                            显示 {(payload.page - 1) * payload.pageSize + (payload.logs.length ? 1 : 0)}-
                            {(payload.page - 1) * payload.pageSize + payload.logs.length} / {payload.total}
                        </p>
                        <div className='flex gap-2'>
                            <Button type='button' variant='outline' size='sm' disabled={payload.page <= 1 || busyKey === 'reload'} onClick={() => loadPage(payload.page - 1)}>
                                <ChevronLeft className='size-4' />
                                上一页
                            </Button>
                            <Button type='button' variant='outline' size='sm' disabled={payload.page >= payload.totalPages || busyKey === 'reload'} onClick={() => loadPage(payload.page + 1)}>
                                下一页
                                <ChevronRight className='size-4' />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>审计维护</CardTitle>
                    <CardDescription>删除或清空需要 owner 登录态和 AUDIT_LOG_MAINTENANCE_KEY。常规增长由 AUDIT_LOG_MAX_ROWS 自动轮换控制。</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {!payload.maintenance.keyConfigured && (
                        <Alert>
                            <Info className='size-4' />
                            <AlertTitle>维护密钥未配置</AlertTitle>
                            <AlertDescription>当前环境不会允许手动删除或清空审计记录。</AlertDescription>
                        </Alert>
                    )}
                    <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]'>
                        <div className='space-y-2'>
                            <Label htmlFor='audit-maintenance-key' className='text-xs text-muted-foreground'>审计维护密钥</Label>
                            <Input
                                id='audit-maintenance-key'
                                type='password'
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
                                {busyKey === 'clear' ? <Loader2 className='size-4 animate-spin' /> : <Trash2 className='size-4' />}
                                清空审计
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className='max-w-3xl'>
                    {selectedLog && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{getActionLabel(selectedLog.action)}</DialogTitle>
                                <DialogDescription>
                                    {formatDateTime(selectedLog.createdAt)} / {selectedLog.targetType} / {selectedLog.targetId}
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
                                        <p className='text-xs font-medium text-muted-foreground'>操作者</p>
                                        <p className='mt-1 break-all'>{selectedLog.actorUserId || selectedLog.actorType}</p>
                                    </div>
                                    <div className='rounded-md border p-3'>
                                        <p className='text-xs font-medium text-muted-foreground'>来源 IP</p>
                                        <p className='mt-1 break-all'>{selectedLog.ip || '-'}</p>
                                    </div>
                                    <div className='rounded-md border p-3 md:col-span-2'>
                                        <p className='text-xs font-medium text-muted-foreground'>User Agent</p>
                                        <p className='mt-1 break-all'>{selectedLog.userAgent || '-'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className='mb-2 text-xs font-medium text-muted-foreground'>完整 Metadata</p>
                                    <pre className='max-h-[38vh] overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-5'>
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
