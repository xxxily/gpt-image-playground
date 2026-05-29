'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { FloatingActionMenu } from '@/components/ui/floating-action-menu';
import type { FeatureMenuItem, FeatureMenuOpenSurface } from '@/lib/feature-menu-registry';
import { Boxes, Compass, FolderKanban } from 'lucide-react';
import * as React from 'react';

type AppFeatureMenuProps = {
    onOpenAssetLibrary: (tab?: 'assets' | 'inspiration', surface?: FeatureMenuOpenSurface) => void;
    onOpenCreativeWorkspaces: (surface?: FeatureMenuOpenSurface) => void;
    rightBoundaryPx?: number;
};

export function AppFeatureMenu({ onOpenAssetLibrary, onOpenCreativeWorkspaces, rightBoundaryPx }: AppFeatureMenuProps) {
    const { t } = useAppLanguage();

    const items = React.useMemo<FeatureMenuItem[]>(
        () => [
            {
                id: 'creative-workspaces',
                labelKey: 'featureMenu.creativeWorkspaces',
                descriptionKey: 'featureMenu.creativeWorkspaces.description',
                icon: FolderKanban,
                order: 10,
                action: 'custom',
                defaultSurface: 'right',
                supportedSurfaces: ['left', 'right', 'drawer'],
                onSelect: (surface = 'default') => onOpenCreativeWorkspaces(surface),
                children: [
                    {
                        id: 'creative-workspaces-left',
                        labelKey: 'workspace.surface.openLeft',
                        descriptionKey: 'workspace.surface.openLeft.description',
                        icon: FolderKanban,
                        order: 10,
                        surface: 'left',
                        action: 'custom',
                        onSelect: () => onOpenCreativeWorkspaces('left')
                    },
                    {
                        id: 'creative-workspaces-right',
                        labelKey: 'workspace.surface.openRight',
                        descriptionKey: 'workspace.surface.openRight.description',
                        icon: FolderKanban,
                        order: 20,
                        surface: 'right',
                        action: 'custom',
                        onSelect: () => onOpenCreativeWorkspaces('right')
                    },
                    {
                        id: 'creative-workspaces-drawer',
                        labelKey: 'workspace.surface.openDrawer',
                        descriptionKey: 'workspace.surface.openDrawer.description',
                        icon: FolderKanban,
                        order: 30,
                        separatorBefore: true,
                        surface: 'drawer',
                        action: 'custom',
                        onSelect: () => onOpenCreativeWorkspaces('drawer')
                    }
                ]
            },
            {
                id: 'asset-library',
                labelKey: 'featureMenu.assetLibrary',
                descriptionKey: 'featureMenu.assetLibrary.description',
                icon: Boxes,
                order: 20,
                separatorBefore: true,
                action: 'custom',
                drawerId: 'asset-library',
                defaultSurface: 'right',
                supportedSurfaces: ['left', 'right', 'drawer'],
                onSelect: (surface = 'default') => onOpenAssetLibrary('assets', surface),
                children: [
                    {
                        id: 'asset-library-left',
                        labelKey: 'workspace.surface.openLeft',
                        descriptionKey: 'workspace.surface.openLeft.description',
                        icon: Boxes,
                        order: 10,
                        surface: 'left',
                        action: 'custom',
                        onSelect: () => onOpenAssetLibrary('assets', 'left')
                    },
                    {
                        id: 'asset-library-right',
                        labelKey: 'workspace.surface.openRight',
                        descriptionKey: 'workspace.surface.openRight.description',
                        icon: Boxes,
                        order: 20,
                        surface: 'right',
                        action: 'custom',
                        onSelect: () => onOpenAssetLibrary('assets', 'right')
                    },
                    {
                        id: 'asset-library-drawer',
                        labelKey: 'workspace.surface.openDrawer',
                        descriptionKey: 'workspace.surface.openDrawer.description',
                        icon: Boxes,
                        order: 30,
                        separatorBefore: true,
                        surface: 'drawer',
                        action: 'open-drawer',
                        drawerId: 'asset-library',
                        onSelect: () => onOpenAssetLibrary('assets', 'drawer')
                    }
                ]
            },
            {
                id: 'inspiration-hub',
                labelKey: 'featureMenu.inspirationHub',
                descriptionKey: 'featureMenu.inspirationHub.description',
                icon: Compass,
                order: 30,
                separatorBefore: true,
                action: 'custom',
                drawerId: 'asset-library',
                defaultSurface: 'right',
                supportedSurfaces: ['left', 'right', 'drawer', 'external'],
                onSelect: (surface = 'default') => onOpenAssetLibrary('inspiration', surface),
                children: [
                    {
                        id: 'inspiration-hub-left',
                        labelKey: 'workspace.surface.openLeft',
                        descriptionKey: 'workspace.surface.openLeft.description',
                        icon: Compass,
                        order: 10,
                        surface: 'left',
                        action: 'custom',
                        onSelect: () => onOpenAssetLibrary('inspiration', 'left')
                    },
                    {
                        id: 'inspiration-hub-right',
                        labelKey: 'workspace.surface.openRight',
                        descriptionKey: 'workspace.surface.openRight.description',
                        icon: Compass,
                        order: 20,
                        surface: 'right',
                        action: 'custom',
                        onSelect: () => onOpenAssetLibrary('inspiration', 'right')
                    },
                    {
                        id: 'inspiration-hub-drawer',
                        labelKey: 'workspace.surface.openDrawer',
                        descriptionKey: 'workspace.surface.openDrawer.description',
                        icon: Compass,
                        order: 30,
                        separatorBefore: true,
                        surface: 'drawer',
                        action: 'open-drawer',
                        drawerId: 'asset-library',
                        onSelect: () => onOpenAssetLibrary('inspiration', 'drawer')
                    },
                    {
                        id: 'inspiration-hub-external',
                        labelKey: 'workspace.surface.openExternal',
                        descriptionKey: 'workspace.surface.openExternal.description',
                        icon: Compass,
                        order: 40,
                        separatorBefore: true,
                        surface: 'external',
                        action: 'custom',
                        onSelect: () => onOpenAssetLibrary('inspiration', 'external')
                    }
                ]
            }
        ],
        [onOpenAssetLibrary, onOpenCreativeWorkspaces]
    );

    return (
        <FloatingActionMenu
            items={items}
            label={t('featureMenu.label')}
            resetLabel={t('featureMenu.resetPosition')}
            rightBoundaryPx={rightBoundaryPx}
            renderLabel={t}
            renderDescription={t}
        />
    );
}
