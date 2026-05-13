'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Edit3, KeyRound, Loader2, Mail, RefreshCw, Save, Shield, UserCheck, UserPlus, Users, UserX } from 'lucide-react';
import * as React from 'react';

type AdminRole = 'owner' | 'admin' | 'viewer';
type AdminStatus = 'active' | 'disabled';

export type AdminUser = {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: string;
    updatedAt: string;
    role: AdminRole;
    status: AdminStatus;
    lastLoginAt: string | null;
};

type UsersAdminClientProps = {
    initialUsers: AdminUser[];
};

type UserDraft = {
    id: string;
    email: string;
    name: string;
    password: string;
    role: AdminRole;
    status: AdminStatus;
};

const emptyUserDraft: UserDraft = {
    id: '',
    email: '',
    name: '',
    password: '',
    role: 'admin',
    status: 'active'
};

function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    return fetch(url, {
        ...init,
        headers: {
            'content-type': 'application/json',
            ...(init?.headers || {})
        }
    }).then(async (response) => {
        const payload = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
            const errorMessage =
                typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
                    ? ((payload as { error: string }).error || '操作失败。')
                    : '操作失败。';
            throw new Error(errorMessage);
        }
        return payload as T;
    });
}

function StatusPill({ status }: { status: AdminStatus }) {
    const tone = status === 'active' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground';
    return <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', tone)}>{status === 'active' ? '启用' : '停用'}</span>;
}

function RolePill({ role }: { role: AdminRole }) {
    const tone =
        role === 'owner'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : role === 'admin'
              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
              : 'bg-muted text-muted-foreground';
    return <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', tone)}>{role}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='space-y-2'>
            <Label className='text-xs font-medium text-muted-foreground'>{label}</Label>
            {children}
        </div>
    );
}

function formatDateTime(value: string | null): string {
    if (!value) return '尚未登录';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '尚未登录' : date.toLocaleString();
}

export function UsersAdminClient({ initialUsers }: UsersAdminClientProps) {
    const [users, setUsers] = React.useState(initialUsers);
    const [draft, setDraft] = React.useState<UserDraft>(emptyUserDraft);
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyKey, setBusyKey] = React.useState('');
    const stats = React.useMemo(
        () => ({
            total: users.length,
            active: users.filter((user) => user.status === 'active').length,
            owner: users.filter((user) => user.role === 'owner').length,
            disabled: users.filter((user) => user.status === 'disabled').length
        }),
        [users]
    );

    const reload = React.useCallback(async (options?: { notify?: boolean }) => {
        setBusyKey('reload');
        try {
            const payload = await requestJson<{ users: AdminUser[] }>('/api/admin/users');
            setUsers(payload.users);
            if (options?.notify !== false) {
                setMessage('用户列表已刷新。');
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

    const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runMutation('user-save', async () => {
            const body = {
                email: draft.email,
                name: draft.name,
                password: draft.password,
                role: draft.role,
                status: draft.status
            };
            if (draft.id) {
                await requestJson(`/api/admin/users/${draft.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: body.name,
                        password: body.password || undefined,
                        role: body.role,
                        status: body.status
                    })
                });
                setMessage('用户已更新。');
            } else {
                await requestJson('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setMessage('用户已创建。');
            }
            setDraft(emptyUserDraft);
        });
    };

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <h1 className='text-2xl font-semibold'>管理员账号</h1>
                    <p className='mt-1 text-sm text-muted-foreground'>优先查看账号状态，再进入编辑或创建；所有角色、状态和密码变更都会写入审计。</p>
                </div>
                <Button type='button' variant='outline' size='sm' onClick={() => reload()} disabled={busyKey === 'reload'}>
                    {busyKey === 'reload' ? <Loader2 className='size-4 animate-spin' /> : <RefreshCw className='size-4' />}
                    刷新
                </Button>
            </div>

            {error && <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>{error}</div>}
            {message && <div className='rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'>{message}</div>}

            <div className='grid gap-3 md:grid-cols-4'>
                <Card>
                    <CardContent className='flex items-center gap-3 p-4'>
                        <Users className='size-5 text-muted-foreground' />
                        <div>
                            <p className='text-xs text-muted-foreground'>全部账号</p>
                            <p className='text-xl font-semibold'>{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className='flex items-center gap-3 p-4'>
                        <UserCheck className='size-5 text-emerald-600 dark:text-emerald-300' />
                        <div>
                            <p className='text-xs text-muted-foreground'>启用中</p>
                            <p className='text-xl font-semibold'>{stats.active}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className='flex items-center gap-3 p-4'>
                        <Shield className='size-5 text-amber-600 dark:text-amber-300' />
                        <div>
                            <p className='text-xs text-muted-foreground'>Owner</p>
                            <p className='text-xl font-semibold'>{stats.owner}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className='flex items-center gap-3 p-4'>
                        <UserX className='size-5 text-muted-foreground' />
                        <div>
                            <p className='text-xs text-muted-foreground'>停用</p>
                            <p className='text-xl font-semibold'>{stats.disabled}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className='grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]'>
                <Card className='2xl:order-1'>
                    <CardHeader>
                        <CardTitle>账号列表</CardTitle>
                        <CardDescription>列表只放身份、权限、登录状态和高频操作；密码重置会生成一次性临时密码。</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3'>
                        {users.map((user) => (
                            <div key={user.id} className='grid gap-3 rounded-md border p-4'>
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <p className='truncate text-sm font-semibold'>{user.name}</p>
                                        <StatusPill status={user.status} />
                                        <RolePill role={user.role} />
                                    </div>
                                    <div className='mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground'>
                                        <Mail className='size-3.5 shrink-0' />
                                        <span className='truncate'>{user.email}</span>
                                    </div>
                                </div>
                                <div className='rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground'>
                                    <p className='font-medium text-foreground'>最近登录</p>
                                    <p className='mt-1'>{formatDateTime(user.lastLoginAt)}</p>
                                </div>
                                <div className='flex min-w-0 flex-wrap gap-2'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() =>
                                            setDraft({
                                                id: user.id,
                                                email: user.email,
                                                name: user.name,
                                                password: '',
                                                role: user.role,
                                                status: user.status
                                            })
                                        }>
                                        <Edit3 className='size-4' />
                                        编辑
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        disabled={busyKey === `user-toggle-${user.id}`}
                                        onClick={() =>
                                            runMutation(`user-toggle-${user.id}`, async () => {
                                                await requestJson(`/api/admin/users/${user.id}`, {
                                                    method: 'PUT',
                                                    body: JSON.stringify({
                                                        status: user.status === 'active' ? 'disabled' : 'active'
                                                    })
                                                });
                                            })
                                        }>
                                        {user.status === 'active' ? '停用' : '恢复'}
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        disabled={busyKey === `user-password-${user.id}`}
                                        onClick={() =>
                                            runMutation(`user-password-${user.id}`, async () => {
                                                const generatedPassword = `Admin-${window.crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
                                                await requestJson(`/api/admin/users/${user.id}`, {
                                                    method: 'PUT',
                                                    body: JSON.stringify({
                                                        password: generatedPassword
                                                    })
                                                });
                                                setMessage(`密码已重置为 ${generatedPassword}，请立即修改。`);
                                            })
                                        }>
                                        {busyKey === `user-password-${user.id}` ? <Loader2 className='size-4 animate-spin' /> : <KeyRound className='size-4' />}
                                        重置密码
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {users.length === 0 && (
                            <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
                                还没有管理员账号。
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className='2xl:sticky 2xl:top-6 2xl:order-2 2xl:self-start'>
                    <CardHeader>
                        <CardTitle>{draft.id ? '编辑账号' : '新增账号'}</CardTitle>
                        <CardDescription>{draft.id ? '邮箱不可在这里修改；留空密码表示不重置。' : '只有 owner 可以创建新管理员账号。'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={saveUser} className='space-y-3'>
                            <Field label='邮箱'>
                                <Input
                                    type='email'
                                    value={draft.email}
                                    disabled={Boolean(draft.id)}
                                    onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                                />
                            </Field>
                            <Field label='名称'>
                                <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                            </Field>
                            <Field label={draft.id ? '新密码' : '初始密码'}>
                                <Input type='password' value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} />
                            </Field>
                            <div className='grid grid-cols-2 gap-3'>
                                <Field label='角色'>
                                    <select
                                        className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                                        value={draft.role}
                                        onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value as AdminRole }))}>
                                        <option value='owner'>owner</option>
                                        <option value='admin'>admin</option>
                                        <option value='viewer'>viewer</option>
                                    </select>
                                </Field>
                                <Field label='状态'>
                                    <select
                                        className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                                        value={draft.status}
                                        onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as AdminStatus }))}>
                                        <option value='active'>active</option>
                                        <option value='disabled'>disabled</option>
                                    </select>
                                </Field>
                            </div>
                            <div className='flex flex-wrap gap-2 pt-2'>
                                <Button type='submit' disabled={busyKey === 'user-save' || !draft.name || !draft.email || (!draft.id && draft.password.length < 12)}>
                                    {busyKey === 'user-save' ? <Loader2 className='size-4 animate-spin' /> : draft.id ? <Save className='size-4' /> : <UserPlus className='size-4' />}
                                    {draft.id ? '保存账号' : '创建账号'}
                                </Button>
                                {draft.id && (
                                    <Button type='button' variant='outline' onClick={() => setDraft(emptyUserDraft)}>
                                        取消
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
