import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { VisionTextHistoryMetadata } from '@/types/history';

type BatchDeleteDialogsProps = {
    pendingBatchDelete: number;
    onPendingBatchDeleteChange: (count: number) => void;
    batchDeleteRemoteWithLocal: boolean;
    onBatchDeleteRemoteWithLocalChange: (enabled: boolean) => void;
    showRemoteDeleteOption: boolean;
    onConfirmBatchDelete: () => void;
    visionTextItemToDeleteConfirm: VisionTextHistoryMetadata | null;
    dialogCheckboxStateSkipConfirm: boolean;
    onDialogCheckboxStateSkipConfirmChange: (enabled: boolean) => void;
    onCancelVisionTextDeletion: () => void;
    onConfirmVisionTextDeletion: () => void;
    pendingVisionTextBatchDeleteIds: string[];
    onPendingVisionTextBatchDeleteIdsChange: (ids: string[]) => void;
    onConfirmVisionTextBatchDelete: () => void;
};

export function BatchDeleteDialogs({
    pendingBatchDelete,
    onPendingBatchDeleteChange,
    batchDeleteRemoteWithLocal,
    onBatchDeleteRemoteWithLocalChange,
    showRemoteDeleteOption,
    onConfirmBatchDelete,
    visionTextItemToDeleteConfirm,
    dialogCheckboxStateSkipConfirm,
    onDialogCheckboxStateSkipConfirmChange,
    onCancelVisionTextDeletion,
    onConfirmVisionTextDeletion,
    pendingVisionTextBatchDeleteIds,
    onPendingVisionTextBatchDeleteIdsChange,
    onConfirmVisionTextBatchDelete
}: BatchDeleteDialogsProps) {
    const closeBatchDeleteDialog = () => {
        onPendingBatchDeleteChange(0);
        onBatchDeleteRemoteWithLocalChange(false);
    };

    return (
        <>
            <Dialog
                open={pendingBatchDelete > 0}
                onOpenChange={(open) => {
                    if (!open) closeBatchDeleteDialog();
                }}>
                <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>确认批量删除</DialogTitle>
                        <DialogDescription className='pt-2'>
                            确定要删除选中的 {pendingBatchDelete} 个条目吗？将移除相关图片。此操作不可撤销。
                        </DialogDescription>
                    </DialogHeader>
                    {showRemoteDeleteOption && (
                        <div className='border-border bg-muted/30 flex items-start gap-2 rounded-md border p-3'>
                            <Checkbox
                                id='batch-delete-remote'
                                checked={batchDeleteRemoteWithLocal}
                                onCheckedChange={(checked) => onBatchDeleteRemoteWithLocalChange(!!checked)}
                                className='mt-0.5'
                            />
                            <label
                                htmlFor='batch-delete-remote'
                                className='text-muted-foreground cursor-pointer text-sm leading-5'>
                                同时删除远端图片
                            </label>
                        </div>
                    )}
                    <DialogFooter className='gap-2 sm:justify-end'>
                        <DialogClose asChild>
                            <Button variant='outline' onClick={closeBatchDeleteDialog}>
                                取消
                            </Button>
                        </DialogClose>
                        <Button variant='destructive' onClick={onConfirmBatchDelete}>
                            删除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={Boolean(visionTextItemToDeleteConfirm)}
                onOpenChange={(open) => {
                    if (!open) onCancelVisionTextDeletion();
                }}>
                <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>确认删除图生文历史</DialogTitle>
                        <DialogDescription className='pt-2'>
                            确定要删除此图生文历史吗？将移除{' '}
                            {visionTextItemToDeleteConfirm?.sourceImages.length ?? 0} 张源图。此操作不可撤销。
                        </DialogDescription>
                    </DialogHeader>
                    <div className='flex items-center space-x-2 py-2'>
                        <Checkbox
                            id='dont-ask-vision-text-delete'
                            checked={dialogCheckboxStateSkipConfirm}
                            onCheckedChange={(checked) => onDialogCheckboxStateSkipConfirmChange(checked === true)}
                        />
                        <label
                            htmlFor='dont-ask-vision-text-delete'
                            className='text-muted-foreground text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                            不再询问
                        </label>
                    </div>
                    <DialogFooter className='gap-2 sm:justify-end'>
                        <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={onCancelVisionTextDeletion}
                            className='border-border text-muted-foreground hover:bg-accent hover:text-foreground'>
                            取消
                        </Button>
                        <Button
                            type='button'
                            variant='destructive'
                            size='sm'
                            onClick={onConfirmVisionTextDeletion}
                            className='bg-red-600 text-white hover:bg-red-500'>
                            删除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={pendingVisionTextBatchDeleteIds.length > 0}
                onOpenChange={(open) => {
                    if (!open) onPendingVisionTextBatchDeleteIdsChange([]);
                }}>
                <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>确认批量删除图生文历史</DialogTitle>
                        <DialogDescription className='pt-2'>
                            确定要删除选中的 {pendingVisionTextBatchDeleteIds.length} 条图生文历史吗？此操作不可撤销。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className='gap-2 sm:justify-end'>
                        <DialogClose asChild>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => onPendingVisionTextBatchDeleteIdsChange([])}>
                                取消
                            </Button>
                        </DialogClose>
                        <Button type='button' variant='destructive' onClick={onConfirmVisionTextBatchDelete}>
                            删除
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
