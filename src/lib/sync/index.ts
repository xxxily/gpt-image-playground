export {
    DEFAULT_SYNC_CONFIG,
    loadSyncConfig,
    normalizeSyncConfig,
    saveSyncConfig,
    clearSyncConfig,
    isS3SyncConfigConfigured,
    SYNC_CONFIG_CHANGED_EVENT,
    SYNC_CONFIG_STORAGE_KEY,
    SYNC_CONFIG_SHARE_VERSION,
    DEFAULT_SHARED_SYNC_RESTORE_OPTIONS,
    buildSyncConfigSharePayload,
    normalizeSharedSyncConfig,
    encodeSyncConfigForShare,
    decodeSyncConfigFromShare
} from './provider-config';
export type {
    SyncProviderConfig,
    SyncProviderType,
    S3SyncConfig,
    S3SyncRequestMode,
    SharedSyncConfigPayload,
    SharedSyncConfig,
    SharedSyncRestoreOptions,
    SharedSyncImageRestoreScope
} from './provider-config';
export { MANIFEST_VERSION, validateManifest } from './manifest';
export type { SnapshotManifest, ManifestImageEntry, ManifestTombstoneEntry, ManifestTombstoneReason } from './manifest';
export type { ImageSyncStatus } from './image-sync-status';
export type { RestoreSyncMode, SyncOperation, SyncResult, UploadSyncMode } from './results';
export type {
    StorageObjectHead,
    StorageObjectListEntry,
    StorageObjectMetadata,
    StorageProvider,
    StorageProviderKind
} from './storage-provider';
export type { SyncErrorEntry, SyncStatusDetails } from './status-details';
export { createSyncStatusDetails } from './status-details';
export { emptySyncResult, failedSyncResult } from './results';
export {
    computeSHA256,
    buildManifest,
    createSnapshot,
    sanitizeAppConfigForSync,
    verifyManifestRoundtrip
} from './snapshot';
export {
    DEFAULT_SYNC_ROOT_PREFIX,
    buildBasePrefix,
    normalizeSyncRootPrefix,
    sanitizeSyncProfileId,
    validateObjectKey,
    validatePrefix
} from './key-validation';
export type { KeyValidationResult } from './key-validation';
export {
    fetchS3Status,
    testS3Connection,
    uploadSnapshot,
    listSnapshots,
    findLatestManifestKey,
    downloadLatestSnapshot,
    restoreFromSnapshot,
    downloadAndRestoreSnapshot,
    previewUploadSnapshot,
    previewRestoreSnapshot,
    getRestorePlan,
    buildSyncedImageObjectKey,
    buildManifestBackupKey,
    createBulkDeletionPlan,
    createS3StorageProvider,
    getOrCreateSyncDeviceId
} from './sync-client';
export type { ImageSyncPreview, S3ConnectionTestResponse, S3StatusResponse } from './sync-client';
