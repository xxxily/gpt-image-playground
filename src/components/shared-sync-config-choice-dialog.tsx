'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
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

function formatRecentMs(recentMs: number | undefined, t: ReturnType<typeof useAppLanguage>['t']): string {
    const ms = recentMs ?? 7 * 24 * 60 * 60 * 1000;
    const hours = Math.max(1, Math.round(ms / 3600000));
    if (hours < 24) return t('phase4b.recentHoursImages', { count: hours });
    return t('phase4b.recentDaysImages', { count: Math.max(1, Math.round(hours / 24)) });
}

function getRestorePlanLabel(restoreOptions: SharedSyncRestoreOptions, t: ReturnType<typeof useAppLanguage>['t']): string {
    const parts: string[] = [];
    if (restoreOptions.restoreMetadata) parts.push(t('phase4b.configAndHistoryRecords'));
    if (restoreOptions.imageRestoreScope === 'recent') parts.push(formatRecentMs(restoreOptions.recentMs, t));
    if (restoreOptions.imageRestoreScope === 'full') parts.push(t('phase4b.allHistoryImages'));
    return parts.length > 0 ? parts.join(t('phase4b.listSeparator')) : t('phase4b.restoreNothing');
}

export function SharedSyncConfigChoiceDialog({
    open,
    sharedSyncConfig,
    onSaveOnly,
    onSaveAndRestore,
    onIgnoreConfig
}: SharedSyncConfigChoiceDialogProps) {
    const { t } = useAppLanguage();
    const { config: syncConfig, restoreOptions } = sharedSyncConfig;
    const basePrefix = buildBasePrefix(syncConfig.s3.profileId, syncConfig.s3.prefix);
    const hasSuggestedRestore = restoreOptions.restoreMetadata || restoreOptions.imageRestoreScope !== 'none';
    const restoreButtonLabel =
        restoreOptions.imageRestoreScope === 'full' ? t('phase4b.saveAndFullRestore') : t('phase4b.saveAndRestoreByShareSettings');

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onIgnoreConfig()}>
            <DialogContent className='border-border bg-background text-foreground shadow-2xl sm:max-w-[560px]'>
                <DialogHeader>
                    <div className='mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300'>
                        <Cloud className='h-5 w-5' aria-hidden='true' />
                    </div>
                    <DialogTitle>
                        <LocalizedMessage id='phase4b.thisShareLinkContainsCloudStorageSyncSettings' />
                    </DialogTitle>
                    <DialogDescription>
                        <LocalizedMessage id='phase4b.afterSavingThisDeviceCanAccessTheSame' />
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-3'>
                    <div className='border-border bg-card/70 dark:bg-panel-ghost grid gap-2 rounded-2xl border p-3 text-sm'>
                        <div className='flex items-start gap-2'>
                            <Link2 className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>
                                    <LocalizedMessage id='phase4b.endpoint' />
                                </p>
                                <p className='text-muted-foreground truncate font-mono text-xs'>
                                    {syncConfig.s3.endpoint}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <Database className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>
                                    <LocalizedMessage id='phase4b.bucket' />
                                </p>
                                <p className='text-muted-foreground truncate font-mono text-xs'>
                                    {syncConfig.s3.bucket}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <FolderDown className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>
                                    <LocalizedMessage id='phase4b.remotePath' />
                                </p>
                                <p className='text-muted-foreground truncate font-mono text-xs'>{basePrefix}</p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <KeyRound className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>
                                    <LocalizedMessage id='phase4b.accessCredentials' />
                                </p>
                                <p className='text-muted-foreground font-mono text-xs'>
                                    {maskSharedSecret(syncConfig.s3.accessKeyId)} /{' '}
                                    {maskSharedSecret(syncConfig.s3.secretAccessKey)}
                                </p>
                            </div>
                        </div>
                        <div className='flex items-start gap-2'>
                            <Trash2 className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>
                                    <LocalizedMessage id='phase4b.remoteDelete' />
                                </p>
                                <p className='text-muted-foreground text-xs'>
                                    {syncConfig.s3.allowRemoteDeletion
                                        ? t('phase4b.sharedConfigAllowsRemoteDelete')
                                        : t('phase4b.remoteDeleteDisabledNormalSyncNoDeleteObject')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className='rounded-2xl border border-sky-500/25 bg-sky-500/10 p-3 text-sm text-sky-950 dark:text-sky-100'>
                        <div className='flex items-start gap-2'>
                            <RotateCcw className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                            <div className='min-w-0'>
                                <p className='font-medium'>
                                    <LocalizedMessage id='phase4b.restoreStrategySetBySender' />
                                </p>
                                <p className='mt-1 text-xs leading-5'>{getRestorePlanLabel(restoreOptions, t)}</p>
                                <p className='mt-1 text-xs leading-5'>
                                    {restoreOptions.autoRestore
                                        ? t('phase4b.senderEnabledAutoRestore')
                                        : t('phase4b.defaultManualRestoreAfterSaving')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {restoreOptions.imageRestoreScope === 'full' && (
                        <Alert className='border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'>
                            <AlertTriangle className='h-4 w-4' aria-hidden='true' />
                            <AlertTitle>
                                <LocalizedMessage id='phase4b.fullImageRestoreMayBeSlow' />
                            </AlertTitle>
                            <AlertDescription>
                                <LocalizedMessage id='phase4b.ifThereAreManyRemoteHistoryImagesFull' />
                            </AlertDescription>
                        </Alert>
                    )}

                    <Alert className='border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'>
                        <AlertTriangle className='h-4 w-4' aria-hidden='true' />
                        <AlertTitle>
                            <LocalizedMessage id='phase4b.confirmThisIsYourOwnSyncStorageBefore' />
                        </AlertTitle>
                        <AlertDescription>
                            <LocalizedMessage id='phase4b.savingWritesObjectStorageCredentialsToBrowserLocalstorage' />
                        </AlertDescription>
                    </Alert>
                </div>

                <DialogFooter className='gap-2 sm:justify-between'>
                    <Button type='button' variant='outline' className='rounded-xl' onClick={onIgnoreConfig}>
                        <LocalizedMessage id='phase4b.ignoreSyncSettings' />
                    </Button>
                    <div className='flex flex-col-reverse gap-2 sm:flex-row'>
                        <Button type='button' variant='secondary' className='rounded-xl' onClick={onSaveOnly}>
                            <LocalizedMessage id='phase4b.saveSettingsOnly' />
                        </Button>
                        {hasSuggestedRestore && (
                            <Button
                                type='button'
                                className='text-foreground rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 shadow-lg shadow-sky-600/20 transition-all duration-200 hover:brightness-110'
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
