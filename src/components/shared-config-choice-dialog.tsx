'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { maskSharedSecret } from '@/lib/shared-config';
import { AlertTriangle, Database, KeyRound, Link2, ShieldQuestion } from 'lucide-react';

type SharedConfigChoiceDialogProps = {
    open: boolean;
    providerLabel: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    onUseTemporarily: () => void;
    onSaveLocally: () => void;
    onIgnoreConfig: () => void;
};

export function SharedConfigChoiceDialog({
    open,
    providerLabel,
    apiKey,
    baseUrl,
    model,
    onUseTemporarily,
    onSaveLocally,
    onIgnoreConfig
}: SharedConfigChoiceDialogProps) {
    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onIgnoreConfig()}>
            <DialogContent className='border-border bg-background text-foreground shadow-2xl sm:max-w-[540px]'>
                <DialogHeader>
                    <div className='mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300'>
                        <ShieldQuestion className='h-5 w-5' aria-hidden='true' />
                    </div>
                    <DialogTitle>这个分享链接包含 API 配置</DialogTitle>
                    <DialogDescription>
                        链接里提供了 {providerLabel} 的 API Key、API 地址和模型
                        ID。你可以只在当前页面临时使用，或保存到本地浏览器设置中供以后继续使用。
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-3'>
                    <div className='border-border bg-card/70 grid gap-2 rounded-2xl border p-3 text-sm dark:bg-white/[0.03]'>
                        <div className='flex items-start gap-2'>
                            <KeyRound className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>API Key</p>
                                <p className='text-muted-foreground font-mono text-xs'>{maskSharedSecret(apiKey)}</p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <Link2 className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>API 地址</p>
                                <p className='text-muted-foreground truncate font-mono text-xs'>{baseUrl}</p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <Database className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>模型 ID</p>
                                <p className='text-muted-foreground truncate font-mono text-xs'>{model}</p>
                            </div>
                        </div>
                    </div>

                    <Alert className='border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'>
                        <AlertTriangle className='h-4 w-4' aria-hidden='true' />
                        <AlertTitle>保存前请确认来源可信</AlertTitle>
                        <AlertDescription>
                            选择“保存到本地设置”会把这些值写入浏览器
                            localStorage，同一浏览器之后都会优先使用它们。共享设备或不可信链接建议选择“仅本次使用”。
                        </AlertDescription>
                    </Alert>

                    <Alert className='border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100'>
                        <Link2 className='h-4 w-4' aria-hidden='true' />
                        <AlertTitle>临时使用也会自动适配连接方式</AlertTitle>
                        <AlertDescription>
                            如果这个 API 地址是第三方服务，且当前部署禁止服务器中转，选择“仅本次使用”时也会在本页面临时切到客户端直连，不需要再去系统配置保存一次。
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter className='gap-2 sm:justify-between'>
                    <Button type='button' variant='outline' className='rounded-xl' onClick={onIgnoreConfig}>
                        忽略这些配置
                    </Button>
                    <div className='flex flex-col-reverse gap-2 sm:flex-row'>
                        <Button type='button' variant='secondary' className='rounded-xl' onClick={onUseTemporarily}>
                            仅本次使用
                        </Button>
                        <Button
                            type='button'
                            className='rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20 transition-all duration-200 hover:brightness-110'
                            onClick={onSaveLocally}>
                            保存到本地设置
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
