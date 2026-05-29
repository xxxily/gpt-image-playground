export const DEFAULT_CREATIVE_WORKSPACE_ID = 'default';
export const ALL_CREATIVE_WORKSPACES_ID = 'all-workspaces';

export type CreativeWorkspaceStatus = 'active' | 'archived';

export type WorkspaceScopedMetadata = {
    workspaceId?: string;
    workspaceNameSnapshot?: string;
};

export type WorkspaceTaskScope = {
    workspaceId: string;
    workspaceNameSnapshot: string;
};

export type WorkspaceFileOwner =
    | 'image-history-output'
    | 'image-history-source'
    | 'vision-text-source'
    | 'video-output'
    | 'video-source'
    | 'draft-source'
    | 'workspace-cover'
    | 'asset-copy';

export type WorkspaceFilePointer = {
    id: string;
    workspaceId: string;
    owner: WorkspaceFileOwner;
    storageMode: 'fs' | 'indexeddb' | 'url' | 'tauri-local' | 'remote';
    filename?: string;
    path?: string;
    blobKey?: string;
    remoteKey?: string;
    mimeType?: string;
    size?: number;
    sha256?: string;
    createdAt: number;
    shared?: boolean;
};

export type CreativeWorkspace = {
    id: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    coverImageRef?: WorkspaceFilePointer;
    status: CreativeWorkspaceStatus;
    favorite?: boolean;
    order?: number;
    createdAt: number;
    updatedAt: number;
    lastOpenedAt?: number;
    lastTaskAt?: number;
    stats?: {
        imageHistoryCount: number;
        visionTextHistoryCount: number;
        videoHistoryCount: number;
        fileCount: number;
        totalBytes?: number;
    };
};

export type CreativeWorkspaceTombstone = {
    workspaceId: string;
    workspaceNameSnapshot: string;
    deletedAt: number;
    deviceId?: string;
};

export type CreativeWorkspaceState = {
    version: 1;
    activeWorkspaceId: string;
    workspaces: CreativeWorkspace[];
    tombstones?: CreativeWorkspaceTombstone[];
    updatedAt: number;
};

export type CreativeWorkspaceDraft = {
    workspaceId: string;
    prompt?: string;
    mode?: 'generate' | 'edit' | 'vision-text' | 'video';
    sourceImageRefs?: WorkspaceFilePointer[];
    updatedAt: number;
};

export type CreativeWorkspaceHistoryScope = string | typeof ALL_CREATIVE_WORKSPACES_ID;
