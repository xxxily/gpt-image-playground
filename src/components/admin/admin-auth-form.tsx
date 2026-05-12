'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2, LockKeyhole, Mail, Shield } from 'lucide-react';
import * as React from 'react';

type AdminAuthFormProps = {
    mode: 'login' | 'setup';
    actionUrl: string;
    submitLabel: string;
    hint: string;
    className?: string;
};

export function AdminAuthForm({ mode, actionUrl, submitLabel, hint, className }: AdminAuthFormProps) {
    const [email, setEmail] = React.useState('');
    const [name, setName] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [bootstrapSecret, setBootstrapSecret] = React.useState('');
    const [error, setError] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const canSubmit =
        email.trim().length > 0 &&
        password.trim().length >= 12 &&
        (mode === 'login' || (name.trim().length > 0 && bootstrapSecret.trim().length > 0));

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSubmit || isSubmitting) return;

        setIsSubmitting(true);
        setError('');

        try {
            const response = await fetch(actionUrl, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    name,
                    password,
                    bootstrapSecret: mode === 'setup' ? bootstrapSecret : undefined,
                    action: mode === 'setup' ? 'initialize' : undefined
                })
            });

            if (!response.ok) {
                const payload = (await response.json().catch(() => null)) as unknown;
                const errorMessage =
                    typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
                        ? ((payload as { error: string }).error || '操作失败。')
                        : '操作失败。';
                setError(errorMessage);
                return;
            }

            window.location.assign('/admin');
        } catch (error) {
            setError(error instanceof Error ? error.message : '操作失败。');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={cn('w-full max-w-lg space-y-4', className)}>
            <div className='space-y-2'>
                <Label htmlFor='admin-email' className='flex items-center gap-2'>
                    <Mail className='size-4' />
                    账号
                </Label>
                <Input id='admin-email' type='email' autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            {mode === 'setup' && (
                <div className='space-y-2'>
                    <Label htmlFor='admin-name' className='flex items-center gap-2'>
                        <Shield className='size-4' />
                        名称
                    </Label>
                    <Input id='admin-name' autoComplete='name' value={name} onChange={(event) => setName(event.target.value)} />
                </div>
            )}
            {mode === 'setup' && (
                <div className='space-y-2'>
                    <Label htmlFor='admin-bootstrap-secret' className='flex items-center gap-2'>
                        <LockKeyhole className='size-4' />
                        恢复密钥
                    </Label>
                    <Input
                        id='admin-bootstrap-secret'
                        type='password'
                        autoComplete='off'
                        value={bootstrapSecret}
                        onChange={(event) => setBootstrapSecret(event.target.value)}
                    />
                </div>
            )}
            <div className='space-y-2'>
                <Label htmlFor='admin-password' className='flex items-center gap-2'>
                    <LockKeyhole className='size-4' />
                    密码
                </Label>
                <Input
                    id='admin-password'
                    type='password'
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                />
            </div>
            {error && <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>}
            <p className='text-muted-foreground text-sm leading-6'>{hint}</p>
            <Button type='submit' className='w-full' disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? <Loader2 className='mr-2 size-4 animate-spin' /> : null}
                {submitLabel}
            </Button>
        </form>
    );
}
