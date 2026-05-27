import type {
    WorkspaceDockSide,
    WorkspaceLayoutState,
    WorkspacePaneState,
    WorkspacePanelFeature,
    WorkspacePanelTab
} from '@/types/workspace-panel';

const WORKSPACE_LAYOUT_STORAGE_KEY = 'gpt-image-playground-workspace-layout-v1';

export const WORKSPACE_LAYOUT_VERSION = 1;
export const RIGHT_RESOURCE_PANE_ID = 'right-resource';
export const WORKSPACE_MAIN_MIN_WIDTH_PX = 560;
export const WORKSPACE_RIGHT_DEFAULT_WIDTH_PX = 520;
export const WORKSPACE_RIGHT_MIN_WIDTH_PX = 360;
export const WORKSPACE_RIGHT_MAX_WIDTH_PX = 760;
export const WORKSPACE_RIGHT_COLLAPSED_WIDTH_PX = 52;
export const WORKSPACE_SPLIT_MIN_VIEWPORT_PX = 900;
export const WORKSPACE_SPLIT_DEFAULT_VIEWPORT_PX = 1200;

type WorkspacePanelPreferences = {
    defaultDesktopSurface: 'split' | 'drawer';
    defaultMobileSurface: 'drawer';
    dockSide: WorkspaceDockSide;
    lastTab: WorkspacePanelTab;
    lastFeature: WorkspacePanelFeature;
};

export type NormalizedWorkspaceLayout = {
    layout: WorkspaceLayoutState;
    rightPane: WorkspacePaneState;
    canSplit: boolean;
};

const DEFAULT_PANEL_PREFERENCES: WorkspacePanelPreferences = {
    defaultDesktopSurface: 'split',
    defaultMobileSurface: 'drawer',
    dockSide: 'right',
    lastTab: 'assets',
    lastFeature: 'asset-library'
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function clampWorkspacePaneSize(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.round(value), min), max);
}

export function getWorkspaceRightPaneMaxWidth(containerWidth: number): number {
    const viewportMax = Math.min(WORKSPACE_RIGHT_MAX_WIDTH_PX, Math.round(containerWidth * 0.58));
    const mainAwareMax = Math.max(WORKSPACE_RIGHT_MIN_WIDTH_PX, containerWidth - WORKSPACE_MAIN_MIN_WIDTH_PX);
    return Math.max(WORKSPACE_RIGHT_MIN_WIDTH_PX, Math.min(viewportMax, mainAwareMax));
}

export function getWorkspaceRightPaneDefaultWidth(containerWidth: number): number {
    return clampWorkspacePaneSize(
        Math.min(WORKSPACE_RIGHT_DEFAULT_WIDTH_PX, Math.round(containerWidth * 0.36)),
        WORKSPACE_RIGHT_MIN_WIDTH_PX,
        getWorkspaceRightPaneMaxWidth(containerWidth)
    );
}

function normalizeTab(value: unknown): WorkspacePanelTab {
    return value === 'inspiration' ? 'inspiration' : 'assets';
}

function normalizeFeature(value: unknown): WorkspacePanelFeature {
    return value === 'inspiration-hub' ? 'inspiration-hub' : 'asset-library';
}

function normalizeDockSide(value: unknown): WorkspaceDockSide {
    return value === 'left' ? 'left' : 'right';
}

function makeDefaultRightPane(containerWidth: number): WorkspacePaneState {
    const defaultSizePx = getWorkspaceRightPaneDefaultWidth(containerWidth);
    return {
        id: RIGHT_RESOURCE_PANE_ID,
        kind: 'creative-resources',
        position: 'right',
        active: false,
        collapsed: false,
        sizePx: defaultSizePx,
        sizeRatio: containerWidth > 0 ? defaultSizePx / containerWidth : undefined,
        previousSizePx: defaultSizePx,
        minSizePx: WORKSPACE_RIGHT_MIN_WIDTH_PX,
        maxSizePx: getWorkspaceRightPaneMaxWidth(containerWidth),
        defaultSizePx,
        order: 10
    };
}

function normalizeRightPane(value: unknown, containerWidth: number): WorkspacePaneState {
    const fallback = makeDefaultRightPane(containerWidth);
    if (!isRecord(value)) return fallback;

    const maxSizePx = getWorkspaceRightPaneMaxWidth(containerWidth);
    const defaultSizePx = getWorkspaceRightPaneDefaultWidth(containerWidth);
    const storedRatio = typeof value.sizeRatio === 'number' && Number.isFinite(value.sizeRatio) ? value.sizeRatio : undefined;
    const ratioSize =
        storedRatio !== undefined
            ? clampWorkspacePaneSize(storedRatio * containerWidth, WORKSPACE_RIGHT_MIN_WIDTH_PX, maxSizePx)
            : undefined;
    const storedSize =
        typeof value.sizePx === 'number' && Number.isFinite(value.sizePx)
            ? clampWorkspacePaneSize(value.sizePx, WORKSPACE_RIGHT_MIN_WIDTH_PX, maxSizePx)
            : undefined;
    const sizePx = ratioSize ?? storedSize ?? defaultSizePx;
    const previousSizePx =
        typeof value.previousSizePx === 'number' && Number.isFinite(value.previousSizePx)
            ? clampWorkspacePaneSize(value.previousSizePx, WORKSPACE_RIGHT_MIN_WIDTH_PX, maxSizePx)
            : sizePx;

    return {
        id: RIGHT_RESOURCE_PANE_ID,
        kind: 'creative-resources',
        position: 'right',
        active: Boolean(value.active),
        collapsed: Boolean(value.collapsed),
        sizePx,
        sizeRatio: containerWidth > 0 ? sizePx / containerWidth : undefined,
        previousSizePx,
        minSizePx: WORKSPACE_RIGHT_MIN_WIDTH_PX,
        maxSizePx,
        defaultSizePx,
        order: 10
    };
}

function normalizePanelPreferences(value: unknown): WorkspacePanelPreferences {
    if (!isRecord(value)) return DEFAULT_PANEL_PREFERENCES;
    return {
        defaultDesktopSurface: value.defaultDesktopSurface === 'drawer' ? 'drawer' : 'split',
        defaultMobileSurface: 'drawer',
        dockSide: normalizeDockSide(value.dockSide),
        lastTab: normalizeTab(value.lastTab),
        lastFeature: normalizeFeature(value.lastFeature)
    };
}

export function normalizeWorkspaceLayoutState(value: unknown, containerWidth: number): NormalizedWorkspaceLayout {
    const canSplit = containerWidth >= WORKSPACE_SPLIT_MIN_VIEWPORT_PX;
    const record = isRecord(value) && value.version === WORKSPACE_LAYOUT_VERSION ? value : {};
    const storedPanes = Array.isArray(record.panes) ? record.panes : [];
    const storedRightPane = storedPanes.find((pane) => isRecord(pane) && pane.id === RIGHT_RESOURCE_PANE_ID);
    let rightPane = normalizeRightPane(storedRightPane, containerWidth);

    if (!canSplit) {
        rightPane = {
            ...rightPane,
            active: false,
            collapsed: false
        };
    }

    const layout: WorkspaceLayoutState = {
        version: WORKSPACE_LAYOUT_VERSION,
        panes: [
            {
                id: 'main',
                kind: 'main-workbench',
                position: 'main',
                active: true,
                collapsed: false,
                minSizePx: WORKSPACE_MAIN_MIN_WIDTH_PX,
                defaultSizePx: Math.max(WORKSPACE_MAIN_MIN_WIDTH_PX, containerWidth - (rightPane.sizePx ?? 0)),
                order: 0
            },
            rightPane
        ],
        activeAuxiliaryPaneId: rightPane.active ? RIGHT_RESOURCE_PANE_ID : undefined,
        lastUpdatedAt: typeof record.lastUpdatedAt === 'number' ? record.lastUpdatedAt : Date.now()
    };

    return { layout, rightPane, canSplit };
}

export function loadWorkspaceLayoutState(containerWidth: number): NormalizedWorkspaceLayout {
    if (typeof window === 'undefined') {
        return normalizeWorkspaceLayoutState(null, containerWidth);
    }

    try {
        const stored = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
        return normalizeWorkspaceLayoutState(stored ? JSON.parse(stored) : null, containerWidth);
    } catch (error) {
        console.warn('Failed to load workspace layout preferences:', error);
        return normalizeWorkspaceLayoutState(null, containerWidth);
    }
}

export function saveWorkspaceLayoutState(layout: WorkspaceLayoutState): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (error) {
        console.warn('Failed to save workspace layout preferences:', error);
    }
}

export function loadWorkspacePanelPreferences(): WorkspacePanelPreferences {
    const fallback = DEFAULT_PANEL_PREFERENCES;
    if (typeof window === 'undefined') return fallback;

    try {
        const stored = window.localStorage.getItem(`${WORKSPACE_LAYOUT_STORAGE_KEY}:panel`);
        return normalizePanelPreferences(stored ? JSON.parse(stored) : null);
    } catch (error) {
        console.warn('Failed to load workspace panel preferences:', error);
        return fallback;
    }
}

export function saveWorkspacePanelPreferences(preferences: Partial<WorkspacePanelPreferences>): void {
    if (typeof window === 'undefined') return;

    try {
        const current = loadWorkspacePanelPreferences();
        window.localStorage.setItem(
            `${WORKSPACE_LAYOUT_STORAGE_KEY}:panel`,
            JSON.stringify(normalizePanelPreferences({ ...current, ...preferences }))
        );
    } catch (error) {
        console.warn('Failed to save workspace panel preferences:', error);
    }
}
