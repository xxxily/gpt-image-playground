'use client';

import { CreativeWorkspacesPanel } from '@/components/workspaces/creative-workspaces-panel';
import {
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle
} from '@/components/ui/drawer';
import { useAppLanguage } from '@/components/app-language-provider';
import * as React from 'react';

type CreativeWorkspacesDrawerProps = React.ComponentProps<typeof CreativeWorkspacesPanel> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function CreativeWorkspacesDrawer({ open, onOpenChange, ...panelProps }: CreativeWorkspacesDrawerProps) {
    const { t } = useAppLanguage();

    return (
        <Drawer open={open} onOpenChange={onOpenChange} side='right' preferredWidth='min(760px,92vw)'>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>{t('creativeWorkspaces.drawer.title')}</DrawerTitle>
                    <DrawerDescription>{t('creativeWorkspaces.drawer.description')}</DrawerDescription>
                </DrawerHeader>
                <DrawerBody className='p-0'>
                    <CreativeWorkspacesPanel {...panelProps} compact />
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    );
}
