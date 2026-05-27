import type * as React from 'react';

export type FeatureMenuAction = 'open-dialog' | 'open-drawer' | 'open-external' | 'custom';
export type FeatureMenuOpenSurface = 'default' | 'split' | 'drawer' | 'external';

export type FeatureMenuItem = {
    id: string;
    labelKey: string;
    descriptionKey?: string;
    icon?: React.ComponentType<{ className?: string }>;
    order: number;
    group?: string;
    badge?: string | number;
    disabled?: boolean;
    hidden?: boolean;
    action?: FeatureMenuAction;
    drawerId?: string;
    dialogId?: string;
    externalUrl?: string;
    surface?: FeatureMenuOpenSurface;
    supportedSurfaces?: FeatureMenuOpenSurface[];
    defaultSurface?: FeatureMenuOpenSurface;
    children?: FeatureMenuItem[];
    onSelect?: (surface?: FeatureMenuOpenSurface) => void;
};

export function sortFeatureMenuItems(items: readonly FeatureMenuItem[]): FeatureMenuItem[] {
    return [...items]
        .filter((item) => !item.hidden)
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
            ...item,
            children: item.children ? sortFeatureMenuItems(item.children) : undefined
        }));
}
