'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { cn } from '@/lib/utils';
import {
    Edit3,
    KeyRound,
    Loader2,
    Mail,
    RefreshCw,
    Save,
    Shield,
    UserCheck,
    UserPlus,
    Users,
    UserX
} from 'lucide-react';
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

function requestJson<T>(url: string, init?: RequestInit, fallbackError = 'Operation failed.'): Promise<T> {
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
                typeof payload === 'object' &&
                payload !== null &&
                'error' in payload &&
                typeof (payload as { error?: unknown }).error === 'string'
                    ? (payload as { error: string }).error || fallbackError
                    : fallbackError;
            throw new Error(errorMessage);
        }
        return payload as T;
    });
}

function StatusPill({ status }: { status: AdminStatus }) {
    const { t } = useAppLanguage();
    const tone =
        status === 'active'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'bg-muted text-muted-foreground';
    return (
        <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', tone)}>
            {status === 'active' ? t('phase4b.statusActive') : t('phase4b.statusDisabled')}
        </span>
    );
}

function RolePill({ role }: { role: AdminRole }) {
    const { t } = useAppLanguage();
    const tone =
        role === 'owner'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : role === 'admin'
              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
              : 'bg-muted text-muted-foreground';
    return (
        <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', tone)}>
            {role === 'owner' ? t('phase4b.roleOwner') : role === 'admin' ? t('phase4b.roleAdmin') : t('phase4b.roleViewer')}
        </span>
    );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className='space-y-2'>
            <Label className='text-muted-foreground text-xs font-medium'>{label}</Label>
            {children}
        </div>
    );
}

function formatDateTime(value: string | null, emptyLabel: string): string {
    if (!value) return emptyLabel;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? emptyLabel : date.toLocaleString();
}

export function UsersAdminClient({ initialUsers }: UsersAdminClientProps) {
    const { t } = useAppLanguage();
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
                setMessage(t('phase4b.userListRefreshed'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('phase4b.refreshFailed'));
        } finally {
            setBusyKey('');
        }
    }, [t]);

    const runMutation = async (key: string, action: () => Promise<void>) => {
        setBusyKey(key);
        setError('');
        setMessage('');
        try {
            await action();
            await reload({ notify: false });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.publicActions.notice.failed'));
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
                setMessage(t('phase4b.userUpdated'));
            } else {
                await requestJson('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                setMessage(t('phase4b.userCreated'));
            }
            setDraft(emptyUserDraft);
        });
    };

    return (
        <div className='space-y-6'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <Heading level={1} size='section'>
                        <LocalizedMessage id='phase4b.adminAccounts' />
                    </Heading>
                    <p className='text-muted-foreground mt-1 text-sm'>
                        <LocalizedMessage id='phase4b.reviewAccountStatusBeforeEditingOrCreatingRole' />
                    </p>
                </div>
                <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => reload()}
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
                <div className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>
                    {error}
                </div>
            )}
            {message && (
                <div className='rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'>
                    {message}
                </div>
            )}

            <div className='grid gap-3 md:grid-cols-4'>
                <Card>
                    <CardContent className='flex items-center gap-3 p-4'>
                        <Users className='text-muted-foreground size-5' />
                        <div>
                            <p className='text-muted-foreground text-xs'>
                                <LocalizedMessage id='phase4b.allAccounts' />
                            </p>
                            <p className='text-xl font-semibold'>{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className='flex items-center gap-3 p-4'>
                        <UserCheck className='size-5 text-emerald-600 dark:text-emerald-300' />
                        <div>
                            <p className='text-muted-foreground text-xs'>
                                <LocalizedMessage id='phase4b.enabled' />
                            </p>
                            <p className='text-xl font-semibold'>{stats.active}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className='flex items-center gap-3 p-4'>
                        <Shield className='size-5 text-amber-600 dark:text-amber-300' />
                        <div>
                            <p className='text-muted-foreground text-xs'>
                                <LocalizedMessage id='phase4b.roleOwner' />
                            </p>
                            <p className='text-xl font-semibold'>{stats.owner}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className='flex items-center gap-3 p-4'>
                        <UserX className='text-muted-foreground size-5' />
                        <div>
                            <p className='text-muted-foreground text-xs'>
                                <LocalizedMessage id='admin.publicActions.deactivate' />
                            </p>
                            <p className='text-xl font-semibold'>{stats.disabled}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className='grid gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]'>
                <Card className='2xl:order-1'>
                    <CardHeader>
                        <CardTitle>
                            <LocalizedMessage id='phase4b.accountList' />
                        </CardTitle>
                        <CardDescription>
                            <LocalizedMessage id='phase4b.theListFocusesOnIdentityPermissionsLoginStatus' />
                        </CardDescription>
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
                                    <div className='text-muted-foreground mt-2 flex min-w-0 items-center gap-2 text-xs'>
                                        <Mail className='size-3.5 shrink-0' />
                                        <span className='truncate'>{user.email}</span>
                                    </div>
                                </div>
                                <div className='bg-muted/40 text-muted-foreground rounded-md px-3 py-2 text-xs'>
                                    <p className='text-foreground font-medium'>
                                        <LocalizedMessage id='phase4b.lastLogin' />
                                    </p>
                                    <p className='mt-1'>{formatDateTime(user.lastLoginAt, t('phase4b.notLoggedInYet'))}</p>
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
                                        <LocalizedMessage id='common.edit' />
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
                                        {user.status === 'active' ? t('phase4b.disable') : t('phase4b.restoreAction')}
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
                                                setMessage(
                                                    t('phase4b.passwordResetToChangeImmediately', {
                                                        password: generatedPassword
                                                    })
                                                );
                                            })
                                        }>
                                        {busyKey === `user-password-${user.id}` ? (
                                            <Loader2 className='size-4 animate-spin' />
                                        ) : (
                                            <KeyRound className='size-4' />
                                        )}
                                        <LocalizedMessage id='phase4b.resetPassword' />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {users.length === 0 && (
                            <div className='text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm'>
                                <LocalizedMessage id='phase4b.noAdminAccountsYet' />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className='2xl:sticky 2xl:top-6 2xl:order-2 2xl:self-start'>
                    <CardHeader>
                        <CardTitle>{draft.id ? t('phase4b.editAccount') : t('phase4b.newAccount')}</CardTitle>
                        <CardDescription>
                            {draft.id
                                ? t('phase4b.emailCannotBeChangedPasswordBlankKeeps')
                                : t('phase4b.onlyOwnerCanCreateAdmins')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={saveUser} className='space-y-3'>
                            <Field label={<LocalizedMessage id='admin.users.email' />}>
                                <Input
                                    type='email'
                                    value={draft.email}
                                    disabled={Boolean(draft.id)}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, email: event.target.value }))
                                    }
                                />
                            </Field>
                            <Field label={<LocalizedMessage id='inspiration.field.title' />}>
                                <Input
                                    value={draft.name}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, name: event.target.value }))
                                    }
                                />
                            </Field>
                            <Field label={draft.id ? t('phase4b.newPassword') : t('phase4b.initialPassword')}>
                                <PasswordInput
                                    value={draft.password}
                                    onChange={(event) =>
                                        setDraft((current) => ({ ...current, password: event.target.value }))
                                    }
                                />
                            </Field>
                            <div className='grid grid-cols-2 gap-3'>
                                <Field label={<LocalizedMessage id='admin.users.role' />}>
                                    <select
                                        className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                        value={draft.role}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                role: event.target.value as AdminRole
                                            }))
                                        }>
                                        <option value='owner'>{t('phase4b.roleOwner')}</option>
                                        <option value='admin'>{t('phase4b.roleAdmin')}</option>
                                        <option value='viewer'>{t('phase4b.roleViewer')}</option>
                                    </select>
                                </Field>
                                <Field label={<LocalizedMessage id='video.history.detail.status' />}>
                                    <select
                                        className='border-input bg-background h-9 w-full rounded-md border px-3 text-sm'
                                        value={draft.status}
                                        onChange={(event) =>
                                            setDraft((current) => ({
                                                ...current,
                                                status: event.target.value as AdminStatus
                                            }))
                                        }>
                                        <option value='active'>{t('phase4b.statusActive')}</option>
                                        <option value='disabled'>{t('phase4b.statusDisabled')}</option>
                                    </select>
                                </Field>
                            </div>
                            <div className='flex flex-wrap gap-2 pt-2'>
                                <Button
                                    type='submit'
                                    disabled={
                                        busyKey === 'user-save' ||
                                        !draft.name ||
                                        !draft.email ||
                                        (!draft.id && draft.password.length < 12)
                                    }>
                                    {busyKey === 'user-save' ? (
                                        <Loader2 className='size-4 animate-spin' />
                                    ) : draft.id ? (
                                        <Save className='size-4' />
                                    ) : (
                                        <UserPlus className='size-4' />
                                    )}
                                    {draft.id ? t('phase4b.saveAccount') : t('phase4b.createAccount')}
                                </Button>
                                {draft.id && (
                                    <Button type='button' variant='outline' onClick={() => setDraft(emptyUserDraft)}>
                                        <LocalizedMessage id='tasks.cancel' />
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
