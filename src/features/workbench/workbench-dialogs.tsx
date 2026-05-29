import { AppFeatureMenu } from '@/components/app-feature-menu';
import { AssetLibraryDrawer } from '@/components/asset-library-drawer';
import { BatchPlanningDialog } from '@/components/batch-planning-dialog';
import { ClearHistoryDialog } from '@/components/clear-history-dialog';
import { CreativeWorkspacesDrawer } from '@/components/workspaces/creative-workspaces-drawer';
import { PasswordDialog } from '@/components/password-dialog';
import { SecureShareUnlockDialog } from '@/components/secure-share-unlock-dialog';
import { SharedConfigChoiceDialog } from '@/components/shared-config-choice-dialog';
import { SharedSyncConfigChoiceDialog } from '@/components/shared-sync-config-choice-dialog';
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
import type { SharedSyncConfig } from '@/lib/sync';
import { BatchDeleteDialogs } from '@/features/workbench/batch-delete-dialogs';
import { SyncConfirmationDialog } from '@/features/workbench/sync-confirmation-dialog';
import * as React from 'react';

type SharedConfigChoiceState = {
    providerLabel: string;
    apiKey: string;
    baseUrl: string;
    model: string;
};

type SharedSyncConfigChoiceState = {
    sharedSyncConfig: SharedSyncConfig;
};

type LargeBatchConfirmationProps = {
    count: number;
    title: string;
    description: string;
    cancelLabel: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
};

type WorkbenchDialogsProps = {
    password: React.ComponentProps<typeof PasswordDialog>;
    secureShare: Omit<React.ComponentProps<typeof SecureShareUnlockDialog>, 'onOpenChange'> & {
        setDismissed: (dismissed: boolean) => void;
        setErrorMessage: (message: string) => void;
    };
    sharedConfigChoice: SharedConfigChoiceState | null;
    onUseSharedConfigTemporarily: () => void;
    onSaveSharedConfigLocally: () => void;
    onIgnoreSharedConfig: () => void;
    sharedSyncConfigChoice: SharedSyncConfigChoiceState | null;
    onSaveSharedSyncConfigOnly: () => void;
    onSaveSharedSyncConfigAndRestore: () => void;
    onIgnoreSharedSyncConfig: () => void;
    batchPlanning: React.ComponentProps<typeof BatchPlanningDialog>;
    assetLibrary: React.ComponentProps<typeof AssetLibraryDrawer>;
    creativeWorkspaces: React.ComponentProps<typeof CreativeWorkspacesDrawer>;
    featureMenu: React.ComponentProps<typeof AppFeatureMenu>;
    syncConfirmation: React.ComponentProps<typeof SyncConfirmationDialog>;
    largeBatchConfirmation: LargeBatchConfirmationProps;
    batchDelete: React.ComponentProps<typeof BatchDeleteDialogs>;
    clearHistory: React.ComponentProps<typeof ClearHistoryDialog>;
    clearVisionTextHistory: React.ComponentProps<typeof ClearHistoryDialog>;
};

export function WorkbenchDialogs({
    password,
    secureShare,
    sharedConfigChoice,
    onUseSharedConfigTemporarily,
    onSaveSharedConfigLocally,
    onIgnoreSharedConfig,
    sharedSyncConfigChoice,
    onSaveSharedSyncConfigOnly,
    onSaveSharedSyncConfigAndRestore,
    onIgnoreSharedSyncConfig,
    batchPlanning,
    assetLibrary,
    creativeWorkspaces,
    featureMenu,
    syncConfirmation,
    largeBatchConfirmation,
    batchDelete,
    clearHistory,
    clearVisionTextHistory
}: WorkbenchDialogsProps) {
    const { setDismissed, setErrorMessage, ...secureShareDialogProps } = secureShare;

    return (
        <>
            <PasswordDialog {...password} />
            <SecureShareUnlockDialog
                {...secureShareDialogProps}
                onOpenChange={(nextOpen) => {
                    setDismissed(!nextOpen);
                    if (nextOpen) setErrorMessage('');
                }}
            />
            {sharedConfigChoice && (
                <SharedConfigChoiceDialog
                    open={true}
                    providerLabel={sharedConfigChoice.providerLabel}
                    apiKey={sharedConfigChoice.apiKey}
                    baseUrl={sharedConfigChoice.baseUrl}
                    model={sharedConfigChoice.model}
                    onUseTemporarily={onUseSharedConfigTemporarily}
                    onSaveLocally={onSaveSharedConfigLocally}
                    onIgnoreConfig={onIgnoreSharedConfig}
                />
            )}
            {sharedSyncConfigChoice && (
                <SharedSyncConfigChoiceDialog
                    open={true}
                    sharedSyncConfig={sharedSyncConfigChoice.sharedSyncConfig}
                    onSaveOnly={onSaveSharedSyncConfigOnly}
                    onSaveAndRestore={onSaveSharedSyncConfigAndRestore}
                    onIgnoreConfig={onIgnoreSharedSyncConfig}
                />
            )}
            <BatchPlanningDialog {...batchPlanning} />
            <AssetLibraryDrawer {...assetLibrary} />
            <CreativeWorkspacesDrawer {...creativeWorkspaces} />
            <AppFeatureMenu {...featureMenu} />
            <SyncConfirmationDialog {...syncConfirmation} />
            <Dialog
                open={largeBatchConfirmation.count > 0}
                onOpenChange={(open) => {
                    if (!open) largeBatchConfirmation.onCancel();
                }}>
                <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{largeBatchConfirmation.title}</DialogTitle>
                        <DialogDescription className='pt-2'>{largeBatchConfirmation.description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className='gap-2 sm:justify-end'>
                        <DialogClose asChild>
                            <Button variant='outline' onClick={largeBatchConfirmation.onCancel}>
                                {largeBatchConfirmation.cancelLabel}
                            </Button>
                        </DialogClose>
                        <Button onClick={largeBatchConfirmation.onConfirm}>{largeBatchConfirmation.confirmLabel}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <BatchDeleteDialogs {...batchDelete} />
            <ClearHistoryDialog {...clearHistory} />
            <ClearHistoryDialog {...clearVisionTextHistory} />
        </>
    );
}
