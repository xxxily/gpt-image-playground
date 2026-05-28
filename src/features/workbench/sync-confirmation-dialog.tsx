import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { ImageSyncPreview } from '@/lib/sync';
import {
    formatFullHistorySyncScopeLabel,
    formatImageSyncScopeLabel,
    formatVisionTextSyncScopeLabel
} from '@/features/workbench/utils/sync-scopes';

export type ImageSyncActionOptions = {
    force?: boolean;
    since?: number;
    manifestKey?: string;
    historyType?: 'image' | 'vision-text';
    filenames?: string[];
    scopeLabel?: string;
};

export type PendingImageSyncConfirmation = {
    operation: 'upload' | 'restore';
    target: 'images' | 'vision-text' | 'all';
    options: ImageSyncActionOptions;
    title: string;
    description: string;
    confirmLabel: string;
    preview: ImageSyncPreview;
};

type SyncConfirmationDialogProps = {
    pending: PendingImageSyncConfirmation | null;
    onPendingChange: (pending: PendingImageSyncConfirmation | null) => void;
    onConfirm: () => void;
};

export function SyncConfirmationDialog({ pending, onPendingChange, onConfirm }: SyncConfirmationDialogProps) {
    return (
        <Dialog
            open={!!pending}
            onOpenChange={(open) => {
                if (!open) onPendingChange(null);
            }}>
            <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                {pending && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{pending.title}</DialogTitle>
                            <DialogDescription className='pt-2'>{pending.description}</DialogDescription>
                        </DialogHeader>
                        <div className='border-border bg-muted/40 space-y-3 rounded-lg border p-3 text-sm'>
                            <div className='flex items-center justify-between gap-3'>
                                <span className='text-muted-foreground'>范围</span>
                                <span className='text-foreground font-medium'>
                                    {pending.target === 'all'
                                        ? formatFullHistorySyncScopeLabel(pending.preview.since)
                                        : pending.target === 'vision-text'
                                          ? formatVisionTextSyncScopeLabel(pending.preview.since)
                                          : formatImageSyncScopeLabel(pending.preview.since)}
                                </span>
                            </div>
                            <div className='flex items-center justify-between gap-3'>
                                <span className='text-muted-foreground'>
                                    {pending.target === 'all'
                                        ? '候选图片/源图'
                                        : pending.target === 'vision-text'
                                          ? '候选源图'
                                          : '候选图片'}
                                </span>
                                <span className='text-foreground font-medium tabular-nums'>
                                    {pending.preview.totalImages.toLocaleString()} 张
                                </span>
                            </div>
                            <div className='flex items-center justify-between gap-3'>
                                <span className='text-muted-foreground'>
                                    {pending.operation === 'upload' ? '需要上传' : '需要下载'}
                                </span>
                                <span className='text-foreground font-medium tabular-nums'>
                                    {pending.preview.pendingImages.toLocaleString()} 张
                                </span>
                            </div>
                            {!pending.preview.force && (
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-muted-foreground'>可跳过</span>
                                    <span className='text-foreground font-medium tabular-nums'>
                                        {pending.preview.skippedImages.toLocaleString()} 张
                                    </span>
                                </div>
                            )}
                            {pending.preview.manifestCreatedAt && (
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-muted-foreground'>快照时间</span>
                                    <span className='text-foreground font-medium'>
                                        {new Intl.DateTimeFormat('zh-CN', {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        }).format(new Date(pending.preview.manifestCreatedAt))}
                                    </span>
                                </div>
                            )}
                        </div>
                        <DialogFooter className='gap-2 sm:justify-end'>
                            <DialogClose asChild>
                                <Button variant='outline' onClick={() => onPendingChange(null)}>
                                    取消
                                </Button>
                            </DialogClose>
                            <Button onClick={onConfirm}>{pending.confirmLabel}</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
