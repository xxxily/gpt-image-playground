'use client';

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
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';

type ClearHistoryDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isIndexedDBMode: boolean;
    title?: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    showRemoteDeleteOption?: boolean;
    deleteRemoteValue?: boolean;
    onDeleteRemoteChange?: (isChecked: boolean) => void;
    deleteRemoteLabel?: string;
};

export function ClearHistoryDialog({
    open,
    onOpenChange,
    onConfirm,
    isIndexedDBMode,
    title = '重大操作：清空生成历史',
    description,
    confirmLabel = '清空历史',
    showRemoteDeleteOption,
    deleteRemoteValue,
    onDeleteRemoteChange,
    deleteRemoteLabel = '同时删除云存储中这些历史图片对应的远端文件'
}: ClearHistoryDialogProps) {
    const cancelButtonRef = React.useRef<HTMLButtonElement>(null);

    // Product requirement: the irreversible action must not be confirmable by keyboard activation.
    // Keyboard-generated button clicks have detail 0; pointer/touch clicks have a positive detail.
    const handleConfirmClick = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            if (event.detail === 0) return;
            onConfirm();
        },
        [onConfirm]
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    cancelButtonRef.current?.focus();
                }}
                className='bg-background text-foreground border-red-500/20 sm:max-w-md'>
                <DialogHeader>
                    <div className='flex items-center gap-2'>
                        <AlertTriangle size={20} className='shrink-0 text-red-500' aria-hidden='true' />
                        <DialogTitle>{title}</DialogTitle>
                    </div>
                    <DialogDescription>
                        {description ?? (
                            <>
                                此操作将永久删除所有已生成的图片及历史记录，不可撤销。
                                {isIndexedDBMode && ' 同时会清除浏览器中存储的所有图片数据。'}
                                提示词历史不会受到影响。
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                {showRemoteDeleteOption && (
                    <div className='border-border bg-muted/30 flex items-start gap-2 rounded-md border p-3'>
                        <Checkbox
                            id='clear-history-delete-remote'
                            checked={Boolean(deleteRemoteValue)}
                            onCheckedChange={(checked) => onDeleteRemoteChange?.(!!checked)}
                            className='mt-0.5'
                        />
                        <label
                            htmlFor='clear-history-delete-remote'
                            className='text-muted-foreground cursor-pointer text-sm leading-5'>
                            {deleteRemoteLabel}
                        </label>
                    </div>
                )}
                <DialogFooter className='gap-2 sm:justify-end'>
                    <DialogClose asChild>
                        <Button
                            ref={cancelButtonRef}
                            type='button'
                            variant='outline'
                            size='sm'
                            className='border-border text-muted-foreground hover:bg-accent hover:text-foreground'>
                            取消
                        </Button>
                    </DialogClose>
                    <Button
                        type='button'
                        variant='destructive'
                        size='sm'
                        onClick={handleConfirmClick}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        }}
                        tabIndex={-1}
                        className='bg-red-600 text-white hover:bg-red-500'>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
