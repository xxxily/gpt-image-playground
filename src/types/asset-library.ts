export type AssetLibraryKind = 'image' | 'video' | 'design-file' | 'document' | 'archive' | 'unknown';

export type AssetLibrarySyncStatus = 'local_only' | 'queued' | 'syncing' | 'synced' | 'failed' | 'conflict';

export type AssetLibrarySource =
    | 'file-picker'
    | 'drop'
    | 'paste'
    | 'folder'
    | 'history'
    | 'current-source'
    | 'import'
    | 'restored';

export type AssetLibraryCategory = {
    id: string;
    builtIn: boolean;
    order: number;
    labelKey?: string;
    name?: string;
};

export type AssetLibraryItem = {
    id: string;
    displayName: string;
    originalFilename: string;
    kind: AssetLibraryKind;
    mimeType: string;
    size: number;
    sha256?: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    categoryId: string;
    tags: string[];
    favorite: boolean;
    note?: string;
    source: AssetLibrarySource;
    sourceUrl?: string;
    blobKey: string;
    thumbnailKey?: string;
    syncStatus?: AssetLibrarySyncStatus;
    remoteKey?: string;
    createdAt: number;
    updatedAt: number;
    lastUsedAt?: number;
    usageCount?: number;
};

export type AssetLibraryBlobRecord = {
    blobKey: string;
    blob: Blob;
    size?: number;
    mimeType?: string;
    sha256?: string;
    lastModifiedLocal?: number;
};

export type AssetLibraryImportSource = Extract<
    AssetLibrarySource,
    'file-picker' | 'drop' | 'paste' | 'folder' | 'history' | 'current-source' | 'import' | 'restored'
>;

export type AssetLibraryImportResult = {
    added: AssetLibraryItem[];
    skippedDuplicates: AssetLibraryItem[];
    rejected: Array<{ filename: string; reason: string }>;
};

