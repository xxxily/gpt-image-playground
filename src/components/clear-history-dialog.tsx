'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { LocalizedMessage } from '@/components/localized-message';
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
    title,
    description,
    confirmLabel,
    showRemoteDeleteOption,
    deleteRemoteValue,
    onDeleteRemoteChange,
    deleteRemoteLabel
}: ClearHistoryDialogProps) {
    const { t } = useAppLanguage();
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
                        <DialogTitle>{title ?? t('phase4b.clearHistoryDangerTitle')}</DialogTitle>
                    </div>
                    <DialogDescription>
                        {description ?? (
                            <>
                                <LocalizedMessage id='phase4b.thisPermanentlyDeletesAllGeneratedImagesAndHistory' />
                                {isIndexedDBMode && t('phase4b.indexedDbImagesAlsoDeleted')}
                                <LocalizedMessage id='phase4b.promptHistoryIsNotAffected' />
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
                            {deleteRemoteLabel ?? t('phase4b.alsoDeleteRemoteHistoryFiles')}
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
                            <LocalizedMessage id='tasks.cancel' />
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
                        {confirmLabel ?? t('phase4b.clearHistory')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
