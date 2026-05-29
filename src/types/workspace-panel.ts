export type WorkspacePaneId = 'main' | 'right-resource' | 'left-resource' | 'left-nav' | 'bottom-activity';

export type WorkspacePanePosition = 'main' | 'left' | 'right' | 'bottom';

export type WorkspacePaneKind =
    | 'main-workbench'
    | 'creative-workspaces'
    | 'creative-resources'
    | 'task-center'
    | 'sync-activity'
    | 'prompt-library';

export type WorkspacePaneState = {
    id: WorkspacePaneId;
    kind: WorkspacePaneKind;
    position: WorkspacePanePosition;
    active: boolean;
    collapsed: boolean;
    sizePx?: number;
    sizeRatio?: number;
    previousSizePx?: number;
    minSizePx: number;
    maxSizePx?: number;
    defaultSizePx: number;
    order: number;
};

export type WorkspaceLayoutState = {
    version: 1;
    panes: WorkspacePaneState[];
    activeAuxiliaryPaneId?: WorkspacePaneId;
    lastUpdatedAt: number;
};

export type WorkspacePanelMode = 'closed' | 'split' | 'drawer';

export type WorkspacePanelFeature = 'creative-workspaces' | 'asset-library' | 'inspiration-hub';

export type WorkspacePanelTab = 'workspaces' | 'assets' | 'inspiration';

export type WorkspaceDockSide = 'right' | 'left';

export type WorkspaceOpenSurface = 'default' | 'split' | 'left' | 'right' | 'drawer' | 'external';
