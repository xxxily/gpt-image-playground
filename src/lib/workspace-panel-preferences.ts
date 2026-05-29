import type {
    WorkspaceDockSide,
    WorkspaceLayoutState,
    WorkspacePaneId,
    WorkspacePanePosition,
    WorkspacePaneState,
    WorkspacePanelFeature,
    WorkspacePanelTab
} from '@/types/workspace-panel';

const WORKSPACE_LAYOUT_STORAGE_KEY = 'gpt-image-playground-workspace-layout-v1';

export const WORKSPACE_LAYOUT_VERSION = 1;
export const LEFT_RESOURCE_PANE_ID = 'left-resource';
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
    workspacesDockSide: WorkspaceDockSide;
    assetsDockSide: WorkspaceDockSide;
    inspirationDockSide: WorkspaceDockSide;
    leftTab: WorkspacePanelTab;
    rightTab: WorkspacePanelTab;
    lastTab: WorkspacePanelTab;
    lastFeature: WorkspacePanelFeature;
};

export type NormalizedWorkspaceLayout = {
    layout: WorkspaceLayoutState;
    leftPane: WorkspacePaneState;
    rightPane: WorkspacePaneState;
    canSplit: boolean;
};

const DEFAULT_PANEL_PREFERENCES: WorkspacePanelPreferences = {
    defaultDesktopSurface: 'split',
    defaultMobileSurface: 'drawer',
    dockSide: 'right',
    workspacesDockSide: 'right',
    assetsDockSide: 'right',
    inspirationDockSide: 'right',
    leftTab: 'workspaces',
    rightTab: 'assets',
    lastTab: 'assets',
    lastFeature: 'asset-library'
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function clampWorkspacePaneSize(value: number, min: number, max: number): number {
    return Math.min(Math.max(Math.round(value), min), max);
}

export function getWorkspaceSidePaneMaxWidth(containerWidth: number, oppositeWidth = 0): number {
    const viewportMax = Math.min(WORKSPACE_RIGHT_MAX_WIDTH_PX, Math.round(containerWidth * 0.58));
    const mainAwareMax = Math.max(
        WORKSPACE_RIGHT_MIN_WIDTH_PX,
        containerWidth - WORKSPACE_MAIN_MIN_WIDTH_PX - Math.max(0, oppositeWidth)
    );
    return Math.max(WORKSPACE_RIGHT_MIN_WIDTH_PX, Math.min(viewportMax, mainAwareMax));
}

export function getWorkspaceRightPaneMaxWidth(containerWidth: number): number {
    return getWorkspaceSidePaneMaxWidth(containerWidth);
}

export function getWorkspaceRightPaneDefaultWidth(containerWidth: number): number {
    return clampWorkspacePaneSize(
        Math.min(WORKSPACE_RIGHT_DEFAULT_WIDTH_PX, Math.round(containerWidth * 0.36)),
        WORKSPACE_RIGHT_MIN_WIDTH_PX,
        getWorkspaceRightPaneMaxWidth(containerWidth)
    );
}

function normalizeTab(value: unknown): WorkspacePanelTab {
    if (value === 'workspaces' || value === 'inspiration') return value;
    return 'assets';
}

function normalizeFeature(value: unknown): WorkspacePanelFeature {
    if (value === 'creative-workspaces' || value === 'inspiration-hub') return value;
    return 'asset-library';
}

function normalizeDockSide(value: unknown): WorkspaceDockSide {
    return value === 'left' ? 'left' : 'right';
}

function makeDefaultSidePane(side: WorkspaceDockSide, containerWidth: number): WorkspacePaneState {
    const defaultSizePx = getWorkspaceRightPaneDefaultWidth(containerWidth);
    return {
        id: side === 'left' ? LEFT_RESOURCE_PANE_ID : RIGHT_RESOURCE_PANE_ID,
        kind: side === 'left' ? 'creative-workspaces' : 'creative-resources',
        position: side,
        active: false,
        collapsed: false,
        sizePx: defaultSizePx,
        sizeRatio: containerWidth > 0 ? defaultSizePx / containerWidth : undefined,
        previousSizePx: defaultSizePx,
        minSizePx: WORKSPACE_RIGHT_MIN_WIDTH_PX,
        maxSizePx: getWorkspaceSidePaneMaxWidth(containerWidth),
        defaultSizePx,
        order: side === 'left' ? 5 : 10
    };
}

function normalizeSidePane(
    value: unknown,
    side: WorkspaceDockSide,
    containerWidth: number,
    oppositeWidth = 0
): WorkspacePaneState {
    const fallback = makeDefaultSidePane(side, containerWidth);
    if (!isRecord(value)) return fallback;

    const maxSizePx = getWorkspaceSidePaneMaxWidth(containerWidth, oppositeWidth);
    const defaultSizePx = getWorkspaceRightPaneDefaultWidth(containerWidth);
    const storedRatio =
        typeof value.sizeRatio === 'number' && Number.isFinite(value.sizeRatio) ? value.sizeRatio : undefined;
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
        id: side === 'left' ? LEFT_RESOURCE_PANE_ID : RIGHT_RESOURCE_PANE_ID,
        kind: side === 'left' ? 'creative-workspaces' : 'creative-resources',
        position: side,
        active: Boolean(value.active),
        collapsed: Boolean(value.collapsed),
        sizePx,
        sizeRatio: containerWidth > 0 ? sizePx / containerWidth : undefined,
        previousSizePx,
        minSizePx: WORKSPACE_RIGHT_MIN_WIDTH_PX,
        maxSizePx,
        defaultSizePx,
        order: side === 'left' ? 5 : 10
    };
}

function normalizePanelPreferences(value: unknown): WorkspacePanelPreferences {
    if (!isRecord(value)) return DEFAULT_PANEL_PREFERENCES;
    const legacyDockSide = normalizeDockSide(value.dockSide);
    return {
        defaultDesktopSurface: value.defaultDesktopSurface === 'drawer' ? 'drawer' : 'split',
        defaultMobileSurface: 'drawer',
        dockSide: legacyDockSide,
        workspacesDockSide: normalizeDockSide(value.workspacesDockSide ?? legacyDockSide),
        assetsDockSide: normalizeDockSide(value.assetsDockSide ?? legacyDockSide),
        inspirationDockSide: normalizeDockSide(value.inspirationDockSide ?? legacyDockSide),
        leftTab: normalizeTab(value.leftTab),
        rightTab: normalizeTab(value.rightTab ?? value.lastTab),
        lastTab: normalizeTab(value.lastTab),
        lastFeature: normalizeFeature(value.lastFeature)
    };
}

function findStoredPane(
    storedPanes: unknown[],
    id: WorkspacePaneId,
    position: WorkspacePanePosition
): unknown {
    return storedPanes.find((pane) => isRecord(pane) && (pane.id === id || pane.position === position));
}

export function normalizeWorkspaceLayoutState(value: unknown, containerWidth: number): NormalizedWorkspaceLayout {
    const canSplit = containerWidth >= WORKSPACE_SPLIT_MIN_VIEWPORT_PX;
    const record = isRecord(value) && value.version === WORKSPACE_LAYOUT_VERSION ? value : {};
    const storedPanes = Array.isArray(record.panes) ? record.panes : [];
    const storedLeftPane = findStoredPane(storedPanes, LEFT_RESOURCE_PANE_ID, 'left');
    const storedRightPane = findStoredPane(storedPanes, RIGHT_RESOURCE_PANE_ID, 'right');
    let leftPane = normalizeSidePane(storedLeftPane, 'left', containerWidth);
    let rightPane = normalizeSidePane(storedRightPane, 'right', containerWidth, leftPane.active ? leftPane.sizePx : 0);
    leftPane = normalizeSidePane(storedLeftPane, 'left', containerWidth, rightPane.active ? rightPane.sizePx : 0);

    if (!canSplit) {
        leftPane = { ...leftPane, active: false, collapsed: false };
        rightPane = { ...rightPane, active: false, collapsed: false };
    }

    if (
        canSplit &&
        leftPane.active &&
        rightPane.active &&
        !leftPane.collapsed &&
        !rightPane.collapsed &&
        containerWidth - (leftPane.sizePx ?? 0) - (rightPane.sizePx ?? 0) < WORKSPACE_MAIN_MIN_WIDTH_PX
    ) {
        leftPane = { ...leftPane, collapsed: true, previousSizePx: leftPane.sizePx, sizePx: WORKSPACE_RIGHT_COLLAPSED_WIDTH_PX };
    }

    const activePanes = [leftPane, rightPane].filter((pane) => pane.active);
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
                defaultSizePx: Math.max(
                    WORKSPACE_MAIN_MIN_WIDTH_PX,
                    containerWidth - (leftPane.active ? leftPane.sizePx ?? 0 : 0) - (rightPane.active ? rightPane.sizePx ?? 0 : 0)
                ),
                order: 0
            },
            leftPane,
            rightPane
        ],
        activeAuxiliaryPaneId: activePanes.at(-1)?.id,
        lastUpdatedAt: typeof record.lastUpdatedAt === 'number' ? record.lastUpdatedAt : Date.now()
    };

    return { layout, leftPane, rightPane, canSplit };
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
