'use client';

import * as React from 'react';

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

type ClearHistoryDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isIndexedDBMode: boolean;
    showRemoteDeleteOption?: boolean;
    deleteRemoteValue?: boolean;
    onDeleteRemoteChange?: (isChecked: boolean) => void;
};

export function ClearHistoryDialog({
    open,
    onOpenChange,
    onConfirm,
    isIndexedDBMode,
    showRemoteDeleteOption,
    deleteRemoteValue,
    onDeleteRemoteChange
}: ClearHistoryDialogProps) {
    const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
    const pointerConfirmRef = React.useRef(false);

    // Product requirement: the irreversible action must not be confirmable by keyboard activation.
    // Gate confirmation on a pointer press so synthesized Enter/Space clicks are ignored.
    const handleConfirmClick = React.useCallback(() => {
        if (!pointerConfirmRef.current) return;
        pointerConfirmRef.current = false;
        onConfirm();
    }, [onConfirm]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    cancelButtonRef.current?.focus();
                }}
                className='border-red-500/20 bg-background text-foreground sm:max-w-md'>
                <DialogHeader>
                    <div className='flex items-center gap-2'>
                        <AlertTriangle
                            size={20}
                            className='shrink-0 text-red-500'
                            aria-hidden='true'
                        />
                        <DialogTitle>重大操作：清空生成历史</DialogTitle>
                    </div>
                    <DialogDescription>
                        此操作将永久删除所有已生成的图片及历史记录，不可撤销。
                        {isIndexedDBMode && ' 同时会清除浏览器中存储的所有图片数据。'}
                        提示词历史不会受到影响。
                    </DialogDescription>
                </DialogHeader>
                {showRemoteDeleteOption && (
                    <div className='flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3'>
                        <Checkbox
                            id='clear-history-delete-remote'
                            checked={Boolean(deleteRemoteValue)}
                            onCheckedChange={(checked) => onDeleteRemoteChange?.(!!checked)}
                            className='mt-0.5'
                        />
                        <label
                            htmlFor='clear-history-delete-remote'
                            className='cursor-pointer text-sm leading-5 text-muted-foreground'>
                            同时删除云存储中这些历史图片对应的远端文件
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
                        onPointerDown={() => {
                            pointerConfirmRef.current = true;
                        }}
                        onPointerLeave={() => {
                            pointerConfirmRef.current = false;
                        }}
                        onPointerCancel={() => {
                            pointerConfirmRef.current = false;
                        }}
                        onClick={handleConfirmClick}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        }}
                        tabIndex={-1}
                        className='bg-red-600 text-white hover:bg-red-500'>
                        清空历史
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
