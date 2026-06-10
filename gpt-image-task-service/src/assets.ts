import { ManagedTaskErrorCode } from './types.js';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

export type LocalFileAssetStoreOptions = {
    rootDir?: string;
    downloadBaseUrl?: string;
    retentionMs?: number;
    maxOutputAssetBytes?: number;
};

export type StoredLocalAsset = {
    assetId: string;
    outputId: string;
    taskId: string;
    kind: 'image' | 'video' | 'text' | 'thumbnail' | 'metadata';
    filename: string;
    mimeType: string;
    size: number;
    sha256: string;
    filePath: string;
    downloadToken: string;
    downloadUrl: string;
    createdAt: string;
    expiresAt: string;
};

export type LocalAssetDownload = {
    filePath: string;
    filename: string;
    mimeType: string;
    size: number;
    sha256: string;
    expiresAt: string;
};

export type LocalAssetStoreSummary = {
    provider: 'local-filesystem';
    rootDir: string;
    storedAssets: number;
    retentionHours: number;
    maxOutputAssetBytes: number;
    s3CompatibleAvailable: false;
    s3CompatibleConfigFields: string[];
};

export class AssetStorageError extends Error {
    readonly retryable: boolean;

    constructor(
        readonly code: ManagedTaskErrorCode,
        message: string,
        retryable = false
    ) {
        super(message);
        this.retryable = retryable;
    }
}

export class LocalFileAssetStore {
    private readonly assets = new Map<string, StoredLocalAsset>();
    private readonly rootDir: string;
    private readonly downloadBaseUrl: string;
    private readonly retentionMs: number;
    private readonly maxOutputAssetBytes: number;

    constructor(options: LocalFileAssetStoreOptions = {}) {
        this.rootDir = options.rootDir ?? join(tmpdir(), 'gpt-image-task-service-assets');
        this.downloadBaseUrl = trimTrailingSlash(options.downloadBaseUrl ?? '');
        this.retentionMs = options.retentionMs ?? 24 * 60 * 60 * 1000;
        this.maxOutputAssetBytes = options.maxOutputAssetBytes ?? 25 * 1024 * 1024;
    }

    async saveTextOutput(input: {
        taskId: string;
        kind: StoredLocalAsset['kind'];
        filename: string;
        mimeType: string;
        content: string;
    }): Promise<StoredLocalAsset> {
        const body = Buffer.from(input.content, 'utf8');
        if (body.byteLength > this.maxOutputAssetBytes) {
            throw new AssetStorageError(
                'asset_save_failed',
                'Result asset exceeds configured output size limit.',
                true
            );
        }

        const now = Date.now();
        const assetId = `asset_${randomUUID()}`;
        const outputId = `out_${randomUUID()}`;
        const filename = sanitizeFilename(input.filename);
        const taskDir = join(this.rootDir, sanitizePathSegment(input.taskId));
        const filePath = join(taskDir, `${assetId}-${filename}`);
        const sha256 = createHash('sha256').update(body).digest('hex');
        const downloadToken = randomUUID().replaceAll('-', '');
        const expiresAt = new Date(now + this.retentionMs).toISOString();

        await mkdir(taskDir, { recursive: true });
        await writeFile(filePath, body, { flag: 'wx' });

        const asset: StoredLocalAsset = {
            assetId,
            outputId,
            taskId: input.taskId,
            kind: input.kind,
            filename,
            mimeType: input.mimeType,
            size: body.byteLength,
            sha256,
            filePath,
            downloadToken,
            downloadUrl: `${this.downloadBaseUrl}/v1/assets/${assetId}/download?token=${downloadToken}`,
            createdAt: new Date(now).toISOString(),
            expiresAt
        };
        this.assets.set(assetId, asset);
        return asset;
    }

    async getDownload(assetId: string, token: string | null): Promise<LocalAssetDownload> {
        const asset = this.assets.get(assetId);
        if (!asset || !token || token !== asset.downloadToken) {
            throw new AssetStorageError('task_not_found', 'Result asset is not available.', false);
        }
        if (Date.parse(asset.expiresAt) <= Date.now()) {
            throw new AssetStorageError('asset_retention_expired', 'Result asset retention has expired.', false);
        }

        const fileStat = await stat(asset.filePath).catch(() => undefined);
        if (!fileStat?.isFile()) {
            throw new AssetStorageError('asset_download_failed', 'Result asset file is missing.', false);
        }

        return {
            filePath: asset.filePath,
            filename: asset.filename,
            mimeType: asset.mimeType,
            size: fileStat.size,
            sha256: asset.sha256,
            expiresAt: asset.expiresAt
        };
    }

    summary(): LocalAssetStoreSummary {
        return {
            provider: 'local-filesystem',
            rootDir: this.rootDir,
            storedAssets: this.assets.size,
            retentionHours: Math.round((this.retentionMs / (60 * 60 * 1000)) * 100) / 100,
            maxOutputAssetBytes: this.maxOutputAssetBytes,
            s3CompatibleAvailable: false,
            s3CompatibleConfigFields: [
                'endpoint',
                'bucket',
                'region',
                'accessKeyRef',
                'secretKeyRef',
                'pathPrefix',
                'publicDownloadMode',
                'signedUrlExpiresSeconds'
            ]
        };
    }
}

function sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'task';
}

function sanitizeFilename(value: string): string {
    const name = basename(value).replace(/[^a-zA-Z0-9._-]/g, '_');
    return name.slice(0, 120) || 'output.bin';
}

function trimTrailingSlash(value: string): string {
    return value.endsWith('/') ? value.slice(0, -1) : value;
}
