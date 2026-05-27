'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { FloatingActionMenu } from '@/components/ui/floating-action-menu';
import type { FeatureMenuItem, FeatureMenuOpenSurface } from '@/lib/feature-menu-registry';
import { Boxes, Compass, Layers3 } from 'lucide-react';
import * as React from 'react';

type AppFeatureMenuProps = {
    onOpenAssetLibrary: (tab?: 'assets' | 'inspiration', surface?: FeatureMenuOpenSurface) => void;
    rightBoundaryPx?: number;
};

export function AppFeatureMenu({ onOpenAssetLibrary, rightBoundaryPx }: AppFeatureMenuProps) {
    const { t } = useAppLanguage();

    const items = React.useMemo<FeatureMenuItem[]>(
        () => [
            {
                id: 'creative-resources',
                labelKey: 'featureMenu.group.creativeResources',
                descriptionKey: 'featureMenu.group.creativeResources.description',
                icon: Layers3,
                order: 10,
                children: [
                    {
                        id: 'asset-library',
                        labelKey: 'featureMenu.assetLibrary',
                        descriptionKey: 'featureMenu.assetLibrary.description',
                        icon: Boxes,
                        order: 10,
                        action: 'custom',
                        drawerId: 'asset-library',
                        defaultSurface: 'split',
                        supportedSurfaces: ['split', 'drawer'],
                        onSelect: (surface = 'default') => onOpenAssetLibrary('assets', surface),
                        children: [
                            {
                                id: 'asset-library-split',
                                labelKey: 'workspace.surface.openSplit',
                                descriptionKey: 'workspace.surface.openSplit.description',
                                icon: Boxes,
                                order: 10,
                                surface: 'split',
                                action: 'custom',
                                onSelect: () => onOpenAssetLibrary('assets', 'split')
                            },
                            {
                                id: 'asset-library-drawer',
                                labelKey: 'workspace.surface.openDrawer',
                                descriptionKey: 'workspace.surface.openDrawer.description',
                                icon: Boxes,
                                order: 20,
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
                        order: 20,
                        action: 'custom',
                        drawerId: 'asset-library',
                        defaultSurface: 'split',
                        supportedSurfaces: ['split', 'drawer', 'external'],
                        onSelect: (surface = 'default') => onOpenAssetLibrary('inspiration', surface),
                        children: [
                            {
                                id: 'inspiration-hub-split',
                                labelKey: 'workspace.surface.openSplit',
                                descriptionKey: 'workspace.surface.openSplit.description',
                                icon: Compass,
                                order: 10,
                                surface: 'split',
                                action: 'custom',
                                onSelect: () => onOpenAssetLibrary('inspiration', 'split')
                            },
                            {
                                id: 'inspiration-hub-drawer',
                                labelKey: 'workspace.surface.openDrawer',
                                descriptionKey: 'workspace.surface.openDrawer.description',
                                icon: Compass,
                                order: 20,
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
                                order: 30,
                                surface: 'external',
                                action: 'custom',
                                onSelect: () => onOpenAssetLibrary('inspiration', 'external')
                            }
                        ]
                    }
                ]
            }
        ],
        [onOpenAssetLibrary]
    );

    return (
        <FloatingActionMenu
            items={items}
            label={t('featureMenu.label')}
            resetLabel={t('featureMenu.resetPosition')}
            backLabel={t('featureMenu.back')}
            rightBoundaryPx={rightBoundaryPx}
            renderLabel={t}
            renderDescription={t}
        />
    );
}
