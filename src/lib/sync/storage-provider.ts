export type StorageProviderKind = 's3-compatible' | 'webdav' | 'local' | 'custom';

export type StorageObjectMetadata = Record<string, string>;

export type StorageObjectListEntry = {
    key: string;
    size: number;
    lastModified: string;
};

export type StorageObjectHead = {
    contentLength?: number;
    metadata?: StorageObjectMetadata;
};

export interface StorageProvider {
    readonly kind: StorageProviderKind;
    readonly displayName: string;
    putObject(key: string, blob: Blob, metadata?: StorageObjectMetadata): Promise<void>;
    getObject(key: string): Promise<Blob>;
    headObject(key: string): Promise<StorageObjectHead | null>;
    listObjects(prefix: string): Promise<StorageObjectListEntry[]>;
}
