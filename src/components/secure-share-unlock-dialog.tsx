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
import {
    getSharePasswordRequiredMessage,
    getSharePasswordWarningMessage,
    SHARE_PASSWORD_MIN_LENGTH
} from '@/lib/share-crypto';
import {
    clearThrottleState,
    getRemainingThrottleMs,
    recordFailedAttempt,
    shareThrottleKey
} from '@/lib/unlock-throttle';
import { useAppLanguage } from '@/components/app-language-provider';
import { AlertTriangle, LockKeyhole } from 'lucide-react';
import * as React from 'react';

const DEFAULT_THROTTLE_KEY = shareThrottleKey('__default__');

type SecureShareUnlockDialogProps = {
    open: boolean;
    isUnlocking: boolean;
    errorMessage: string;
    onUnlock: (password: string) => Promise<void>;
    onOpenChange: (open: boolean) => void;
    shareId?: string;
    onUnlockSuccess?: () => void;
};

export function SecureShareUnlockDialog({
    open,
    isUnlocking,
    errorMessage,
    onUnlock,
    onOpenChange,
    shareId,
    onUnlockSuccess
}: SecureShareUnlockDialogProps) {
    const [password, setPassword] = React.useState('');
    const [remainingMs, setRemainingMs] = React.useState(0);
    const [failedAttempts, setFailedAttempts] = React.useState(0);
    const [prevErrorMessage, setPrevErrorMessage] = React.useState('');
    const lastCountedErrorRef = React.useRef<string>('');
    const [prevIsUnlocking, setPrevIsUnlocking] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const { t } = useAppLanguage();
    const throttleKey = shareId ? shareThrottleKey(shareId) : DEFAULT_THROTTLE_KEY;
    const requiredMessage = getSharePasswordRequiredMessage(password);
    const warningMessage = getSharePasswordWarningMessage(password);
    const isThrottled = remainingMs > 0;
    const canUnlock = !requiredMessage && !isUnlocking && !isThrottled;

    React.useEffect(() => {
        if (!open) {
            setPassword('');
            return;
        }

        const state = getRemainingThrottleMs(throttleKey);
        setRemainingMs(state);
        setPrevErrorMessage('');
        lastCountedErrorRef.current = '';

        window.setTimeout(() => inputRef.current?.focus(), 50);
    }, [open, throttleKey]);

    React.useEffect(() => {
        if (!isThrottled) return;

        const interval = setInterval(() => {
            setRemainingMs((prev) => {
                const next = Math.max(0, prev - 1000);
                if (next === 0) {
                    clearInterval(interval);
                }
                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isThrottled]);

    React.useEffect(() => {
        if (prevIsUnlocking && !isUnlocking && errorMessage && errorMessage !== lastCountedErrorRef.current) {
            const state = recordFailedAttempt(throttleKey);
            setFailedAttempts(state.failedAttempts);
            const remaining = getRemainingThrottleMs(throttleKey);
            setRemainingMs(remaining);
            lastCountedErrorRef.current = errorMessage;
        }
        setPrevErrorMessage(errorMessage);
        setPrevIsUnlocking(isUnlocking);
    }, [errorMessage, isUnlocking, throttleKey]);

    React.useEffect(() => {
        if (!open && !errorMessage) {
            clearThrottleState(throttleKey);
            setFailedAttempts(0);
            setRemainingMs(0);
            lastCountedErrorRef.current = '';
            onUnlockSuccess?.();
        }
    }, [open, errorMessage, throttleKey, onUnlockSuccess]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canUnlock) return;
        await onUnlock(password);
    };

    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const throttledMessage = t('share.unlock.throttled', { count: failedAttempts, seconds: remainingSeconds });
    const waitMessage = t('share.unlock.waitSeconds', { seconds: remainingSeconds });

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

                    {isThrottled && (
                        <div
                            className='flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300'
                            role='alert'>
                            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <span className='text-sm leading-5'>{throttledMessage}</span>
                        </div>
                    )}

                    <div className='space-y-2'>
                        <Label htmlFor='secure-share-password'>解密密码</Label>
                        <Input
                            ref={inputRef}
                            id='secure-share-password'
                            name='secure-share-one-time-decryption-key'
                            type='password'
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder={`建议至少 ${SHARE_PASSWORD_MIN_LENGTH} 个字符`}
                            autoComplete='one-time-code'
                            autoCorrect='off'
                            autoCapitalize='none'
                            data-1p-ignore='true'
                            data-bwignore='true'
                            data-lpignore='true'
                            className='rounded-xl'
                            aria-describedby='secure-share-password-help'
                        />
                        <p id='secure-share-password-help' className='text-muted-foreground text-xs leading-5'>
                            密码不会保存到浏览器。加密只保护链接中的参数；如果链接包含 API Key，解密后仍请谨慎使用。
                        </p>
                        <p className='text-muted-foreground text-xs leading-5'>
                            {t('share.unlock.caseSensitive')}
                        </p>
                    </div>

                    {(requiredMessage || errorMessage) && !isThrottled && (
                        <p
                            className='flex items-start gap-2 text-xs leading-5 text-red-600 dark:text-red-300'
                            role='alert'>
                            <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                            <span>{errorMessage || requiredMessage}</span>
                        </p>
                    )}
                    {warningMessage && !requiredMessage && !errorMessage && !isThrottled && (
                        <p className='flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300' role='status'>
                            <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                            <span>{warningMessage} 如果分享者就是这样设置的密码，可以继续解密。</span>
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
                            {isThrottled
                                ? waitMessage
                                : isUnlocking
                                    ? t('share.unlock.unlocking')
                                    : t('share.unlock.submit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
