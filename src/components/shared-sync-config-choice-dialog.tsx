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
import { buildBasePrefix, type SharedSyncConfig, type SharedSyncRestoreOptions } from '@/lib/sync';
import { AlertTriangle, Cloud, Database, FolderDown, KeyRound, Link2, RotateCcw, Trash2 } from 'lucide-react';

type SharedSyncConfigChoiceDialogProps = {
    open: boolean;
    sharedSyncConfig: SharedSyncConfig;
    onSaveOnly: () => void;
    onSaveAndRestore: () => void;
    onIgnoreConfig: () => void;
};

function formatRecentMs(recentMs: number | undefined): string {
    const ms = recentMs ?? 7 * 24 * 60 * 60 * 1000;
    const hours = Math.max(1, Math.round(ms / 3600000));
    if (hours < 24) return `最近 ${hours} 小时图片`;
    return `最近 ${Math.max(1, Math.round(hours / 24))} 天图片`;
}

function getRestorePlanLabel(restoreOptions: SharedSyncRestoreOptions): string {
    const parts: string[] = [];
    if (restoreOptions.restoreMetadata) parts.push('配置和历史记录');
    if (restoreOptions.imageRestoreScope === 'recent') parts.push(formatRecentMs(restoreOptions.recentMs));
    if (restoreOptions.imageRestoreScope === 'full') parts.push('全部历史图片');
    return parts.length > 0 ? parts.join('、') : '不恢复配置、历史或图片';
}

export function SharedSyncConfigChoiceDialog({
    open,
    sharedSyncConfig,
    onSaveOnly,
    onSaveAndRestore,
    onIgnoreConfig
}: SharedSyncConfigChoiceDialogProps) {
    const { config: syncConfig, restoreOptions } = sharedSyncConfig;
    const basePrefix = buildBasePrefix(syncConfig.s3.profileId, syncConfig.s3.prefix);
    const hasSuggestedRestore = restoreOptions.restoreMetadata || restoreOptions.imageRestoreScope !== 'none';
    const restoreButtonLabel = restoreOptions.imageRestoreScope === 'full' ? '保存并全量恢复' : '保存并按分享设置恢复';

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onIgnoreConfig()}>
            <DialogContent className='border-border bg-background text-foreground shadow-2xl sm:max-w-[560px]'>
                <DialogHeader>
                    <div className='mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300'>
                        <Cloud className='h-5 w-5' aria-hidden='true' />
                    </div>
                    <DialogTitle>这个分享链接包含云存储同步配置</DialogTitle>
                    <DialogDescription>
                        保存后，当前设备就能访问同一个 S3
                        兼容对象存储。是否恢复配置、历史和图片由你按需确认，不会默认全量下载。
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-3'>
                    <div className='border-border bg-card/70 grid gap-2 rounded-2xl border p-3 text-sm dark:bg-white/[0.03]'>
                        <div className='flex items-start gap-2'>
                            <Link2 className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>Endpoint</p>
                                <p className='text-muted-foreground truncate font-mono text-xs'>
                                    {syncConfig.s3.endpoint}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <Database className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>Bucket</p>
                                <p className='text-muted-foreground truncate font-mono text-xs'>
                                    {syncConfig.s3.bucket}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <FolderDown className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>远端路径</p>
                                <p className='text-muted-foreground truncate font-mono text-xs'>{basePrefix}</p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <KeyRound className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>访问凭据</p>
                                <p className='text-muted-foreground font-mono text-xs'>
                                    {maskSharedSecret(syncConfig.s3.accessKeyId)} /{' '}
                                    {maskSharedSecret(syncConfig.s3.secretAccessKey)}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <Trash2 className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>远端删除</p>
                                <p className='text-muted-foreground text-xs'>
                                    {syncConfig.s3.allowRemoteDeletion
                                        ? '分享配置允许同步删除远端图片；请确认这是你自己的空间。'
                                        : '未开启，普通同步不需要 DeleteObject 权限。'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className='rounded-2xl border border-sky-500/25 bg-sky-500/10 p-3 text-sm text-sky-950 dark:text-sky-100'>
                        <div className='flex items-start gap-2'>
                            <RotateCcw className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>分享者设置的恢复策略</p>
                                <p className='mt-1 text-xs leading-5'>{getRestorePlanLabel(restoreOptions)}</p>
                                <p className='mt-1 text-xs leading-5'>
                                    {restoreOptions.autoRestore
                                        ? '分享者设置了打开后自动恢复；链接解密后会保存配置并按这个策略执行。'
                                        : '默认不自动恢复。保存配置后，你也可以之后在历史面板手动同步。'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {restoreOptions.imageRestoreScope === 'full' && (
                        <Alert className='border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'>
                            <AlertTriangle className='h-4 w-4' aria-hidden='true' />
                            <AlertTitle>全量图片恢复可能很慢</AlertTitle>
                            <AlertDescription>
                                远端历史图片较多时，全量恢复会消耗大量时间、网络流量和本地浏览器存储空间。建议只在新设备初始化时使用。
                            </AlertDescription>
                        </Alert>
                    )}

                    <Alert className='border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'>
                        <AlertTriangle className='h-4 w-4' aria-hidden='true' />
                        <AlertTitle>保存前请确认这是你自己的同步空间</AlertTitle>
                        <AlertDescription>
                            选择保存会把对象存储凭据写入浏览器
                            localStorage。“保存并同步”会立即读取远端最新快照，并覆盖本地同步到的配置和历史记录。
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter className='gap-2 sm:justify-between'>
                    <Button type='button' variant='outline' className='rounded-xl' onClick={onIgnoreConfig}>
                        忽略同步配置
                    </Button>
                    <div className='flex flex-col-reverse gap-2 sm:flex-row'>
                        <Button type='button' variant='secondary' className='rounded-xl' onClick={onSaveOnly}>
                            仅保存配置
                        </Button>
                        {hasSuggestedRestore && (
                            <Button
                                type='button'
                                className='rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-lg shadow-sky-600/20 transition-all duration-200 hover:brightness-110'
                                onClick={onSaveAndRestore}>
                                {restoreButtonLabel}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
