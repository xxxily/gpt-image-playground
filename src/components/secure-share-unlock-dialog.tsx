'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSharePasswordValidationMessage, SHARE_PASSWORD_MIN_LENGTH } from '@/lib/share-crypto';
import { AlertTriangle, LockKeyhole } from 'lucide-react';
import * as React from 'react';

type SecureShareUnlockDialogProps = {
    open: boolean;
    isUnlocking: boolean;
    errorMessage: string;
    onUnlock: (password: string) => Promise<void>;
    onOpenChange: (open: boolean) => void;
};

export function SecureShareUnlockDialog({
    open,
    isUnlocking,
    errorMessage,
    onUnlock,
    onOpenChange
}: SecureShareUnlockDialogProps) {
    const [password, setPassword] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const validationMessage = getSharePasswordValidationMessage(password);
    const canUnlock = !validationMessage && !isUnlocking;

    React.useEffect(() => {
        if (!open) {
            setPassword('');
            return;
        }

        window.setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canUnlock) return;
        await onUnlock(password);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='border-border bg-background text-foreground shadow-2xl sm:max-w-[460px]'>
                <form onSubmit={handleSubmit} className='space-y-5'>
                    <DialogHeader>
                        <div className='mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'>
                            <LockKeyhole className='h-5 w-5' aria-hidden='true' />
                        </div>
                        <DialogTitle>解密分享链接</DialogTitle>
                        <DialogDescription>
                            这个链接使用密码加密了提示词、模型和可选 API
                            配置。请输入分享者通过其他渠道给你的密码，解密成功后才会应用这些参数。
                        </DialogDescription>
                    </DialogHeader>

                    <div className='space-y-2'>
                        <Label htmlFor='secure-share-password'>解密密码</Label>
                        <Input
                            ref={inputRef}
                            id='secure-share-password'
                            type='password'
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder={`至少 ${SHARE_PASSWORD_MIN_LENGTH} 个字符`}
                            autoComplete='current-password'
                            className='rounded-xl'
                            aria-describedby='secure-share-password-help'
                        />
                        <p id='secure-share-password-help' className='text-muted-foreground text-xs leading-5'>
                            密码不会保存到浏览器。加密只保护链接中的参数；如果链接包含 API Key，解密后仍请谨慎使用。
                        </p>
                    </div>

                    {(validationMessage || errorMessage) && (
                        <p
                            className='flex items-start gap-2 text-xs leading-5 text-red-600 dark:text-red-300'
                            role='alert'>
                            <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                            <span>{errorMessage || validationMessage}</span>
                        </p>
                    )}

                    <DialogFooter className='gap-2'>
                        <Button
                            type='button'
                            variant='outline'
                            className='rounded-xl'
                            onClick={() => onOpenChange(false)}>
                            暂不解密
                        </Button>
                        <Button
                            type='submit'
                            disabled={!canUnlock}
                            className='rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:brightness-110 disabled:shadow-none disabled:brightness-100'>
                            <LockKeyhole className='h-4 w-4' aria-hidden='true' />
                            {isUnlocking ? '正在解密…' : '解密并应用'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
