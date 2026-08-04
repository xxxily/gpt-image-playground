import type { ShowcaseAdminActor, ShowcaseTopicDraft } from './types';
import { normalizeShowcaseTopicDraft } from './validation';
import { getAuditLogMaxRows, pruneAuditLogsToMaxRows } from '@/lib/server/audit';
import { getServerDatabasePath, getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { showcaseAssets } from '@/lib/server/schema';
import { randomToken, sanitizePlainText } from '@/lib/server/security';
import { getManagedShowcaseAssetId, type ShowcaseRemoteAsset } from '@/lib/showcase';
import { desc, eq, inArray } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';

export const SHOWCASE_MEDIA_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const SHOWCASE_MEDIA_MAX_PIXELS = 40_000_000;
export const SHOWCASE_MEDIA_MAX_EDGE = 12_000;
export const SHOWCASE_MEDIA_DISPLAY_MAX_EDGE = 4_096;
export const SHOWCASE_MEDIA_THUMBNAIL_MAX_EDGE = 640;

const INPUT_MIME_FORMATS = new Map([
    ['image/jpeg', 'jpeg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/avif', 'heif']
]);
const INPUT_EXTENSIONS = new Map([
    ['image/jpeg', new Set(['.jpg', '.jpeg'])],
    ['image/png', new Set(['.png'])],
    ['image/webp', new Set(['.webp'])],
    ['image/avif', new Set(['.avif'])]
]);
const TEXT_SECRET_PATTERN = /(?:api[_ -]?key|access[_ -]?token|password|secret)\s*[:=]/iu;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/iu;
const MANAGED_ASSET_ID_PATTERN = /^media_[a-f0-9]{32}$/u;

type ManagedAssetRow = typeof showcaseAssets.$inferSelect;

export type ShowcaseManagedAsset = {
    id: string;
    mimeType: 'image/webp';
    width: number;
    height: number;
    byteSize: number;
    thumbnailWidth: number;
    thumbnailHeight: number;
    thumbnailByteSize: number;
    checksum: string;
    sourceLabel: string;
    licenseNote: string;
    alt: { 'zh-CN': string; 'en-US': string };
    createdAt: number;
    catalogAsset: ShowcaseRemoteAsset;
};

export type CreateShowcaseManagedAssetInput = {
    file: File;
    sourceLabel: string;
    licenseNote: string;
    altZhCN: string;
    altEnUS: string;
};

export class ShowcaseAssetInUseError extends Error {
    readonly code = 'ASSET_IN_USE';

    constructor(public readonly references: { drafts: string[]; publications: string[] }) {
        super('媒体仍被专题草稿或发布版本引用，不能永久删除。');
    }
}

function expandConfiguredPath(value: string): string {
    if (value === '~') return os.homedir();
    if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
    return value;
}

export function getShowcaseMediaDirectory(): string {
    const configured = process.env.SHOWCASE_MEDIA_DIR?.trim();
    if (!configured) return path.join(path.dirname(getServerDatabasePath()), 'showcase-media');
    const expanded = expandConfiguredPath(configured);
    return path.isAbsolute(expanded) ? expanded : path.join(path.dirname(getServerDatabasePath()), expanded);
}

function normalizeMetadataText(value: string, field: string, maximumLength: number): string {
    const normalized = value.trim();
    if (
        !normalized ||
        normalized.length > maximumLength ||
        normalized.includes('\0') ||
        HTML_TAG_PATTERN.test(normalized) ||
        TEXT_SECRET_PATTERN.test(normalized)
    ) {
        throw new Error(`${field}不完整或包含不安全内容。`);
    }
    try {
        const url = new URL(normalized);
        if (url.username || url.password || url.protocol !== 'https:') {
            throw new Error(`${field}中的网址必须是无凭证 HTTPS 地址。`);
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('必须是无凭证')) throw error;
    }
    return normalized;
}

function publicMediaUrl(id: string, thumbnail = false): string {
    return `/api/showcase-media/${id}${thumbnail ? '?variant=thumbnail' : ''}`;
}

function toManagedAsset(row: ManagedAssetRow): ShowcaseManagedAsset {
    const alt = { 'zh-CN': row.altZhCN, 'en-US': row.altEnUS };
    return {
        id: row.id,
        mimeType: 'image/webp',
        width: row.width,
        height: row.height,
        byteSize: row.byteSize,
        thumbnailWidth: row.thumbnailWidth,
        thumbnailHeight: row.thumbnailHeight,
        thumbnailByteSize: row.thumbnailByteSize,
        checksum: row.checksum,
        sourceLabel: row.sourceLabel,
        licenseNote: row.licenseNote,
        alt,
        createdAt: row.createdAt.getTime(),
        catalogAsset: {
            id: row.id,
            kind: 'remote-image',
            alt,
            url: publicMediaUrl(row.id),
            thumbnailUrl: publicMediaUrl(row.id, true),
            managedAssetId: row.id,
            mimeType: 'image/webp',
            width: row.width,
            height: row.height
        }
    };
}

function getRequestIp(request: Request): string | null {
    return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
}

function writeAssetAuditInTransaction(
    actor: ShowcaseAdminActor,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>
): void {
    getSqliteClient()
        .prepare(
            `INSERT INTO "audit_logs"
             ("id", "actorUserId", "actorType", "action", "targetType", "targetId", "ip", "userAgent", "metadataJson")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
            randomToken(16),
            actor.userId,
            'user',
            sanitizePlainText(action),
            'showcase_asset',
            sanitizePlainText(targetId),
            getRequestIp(actor.request),
            actor.request.headers.get('user-agent')?.trim() || null,
            JSON.stringify(metadata)
        );
}

async function pruneAssetAuditLogs(): Promise<void> {
    try {
        await pruneAuditLogsToMaxRows(getAuditLogMaxRows());
    } catch {
        // Retention maintenance must not turn a successful media mutation into an API failure.
    }
}

function getReferencedAssetIds(draft: ShowcaseTopicDraft): Set<string> {
    const referencedIds = new Set<string>([draft.topic.coverAssetId]);
    const casesById = new Map(draft.cases.map((item) => [item.id, item]));
    for (const caseId of draft.topic.caseIds) {
        const showcaseCase = casesById.get(caseId);
        if (!showcaseCase) continue;
        referencedIds.add(showcaseCase.coverAssetId);
        showcaseCase.inputAssetIds.forEach((id) => referencedIds.add(id));
        showcaseCase.outputAssetIds.forEach((id) => referencedIds.add(id));
    }
    return referencedIds;
}

export function selectReferencedShowcaseTopicDraftAssets(draft: ShowcaseTopicDraft): ShowcaseTopicDraft {
    const referencedIds = getReferencedAssetIds(draft);
    return {
        ...draft,
        assets: draft.assets.filter((asset) => referencedIds.has(asset.id))
    };
}

async function validateManagedAssetFiles(row: ManagedAssetRow): Promise<void> {
    const displayPath = getShowcaseManagedAssetFilePath(row, false);
    const thumbnailPath = getShowcaseManagedAssetFilePath(row, true);
    let display: Buffer;
    let thumbnail: Buffer;
    try {
        [display, thumbnail] = await Promise.all([fs.readFile(displayPath), fs.readFile(thumbnailPath)]);
    } catch {
        throw new Error(`专题引用的托管媒体文件不存在：${row.id}`);
    }
    if (display.byteLength !== row.byteSize || thumbnail.byteLength !== row.thumbnailByteSize) {
        throw new Error(`专题引用的托管媒体大小校验失败：${row.id}`);
    }
    if (createHash('sha256').update(display).digest('hex') !== row.checksum) {
        throw new Error(`专题引用的托管媒体 checksum 校验失败：${row.id}`);
    }
    try {
        const [displayMetadata, thumbnailMetadata] = await Promise.all([
            sharp(display, { failOn: 'error', limitInputPixels: SHOWCASE_MEDIA_DISPLAY_MAX_EDGE ** 2 }).metadata(),
            sharp(thumbnail, { failOn: 'error', limitInputPixels: SHOWCASE_MEDIA_THUMBNAIL_MAX_EDGE ** 2 }).metadata()
        ]);
        if (
            displayMetadata.format !== 'webp' ||
            displayMetadata.width !== row.width ||
            displayMetadata.height !== row.height ||
            thumbnailMetadata.format !== 'webp' ||
            thumbnailMetadata.width !== row.thumbnailWidth ||
            thumbnailMetadata.height !== row.thumbnailHeight
        ) {
            throw new Error('metadata-mismatch');
        }
    } catch {
        throw new Error(`专题引用的托管媒体无法安全解码：${row.id}`);
    }
}

async function writeAtomic(filePath: string, contents: Buffer): Promise<void> {
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    await fs.writeFile(temporaryPath, contents, { flag: 'wx' });
    try {
        await fs.rename(temporaryPath, filePath);
    } catch (error) {
        await fs.rm(temporaryPath, { force: true });
        throw error;
    }
}

function assertUploadEnvelope(file: File): void {
    if (!file.name.trim() || file.size <= 0 || file.size > SHOWCASE_MEDIA_MAX_UPLOAD_BYTES) {
        throw new Error('图片文件为空或超过 12 MB 限制。');
    }
    const expectedFormat = INPUT_MIME_FORMATS.get(file.type);
    const allowedExtensions = INPUT_EXTENSIONS.get(file.type);
    if (!expectedFormat || !allowedExtensions?.has(path.extname(file.name).toLowerCase())) {
        throw new Error('仅支持扩展名与 MIME 一致的 JPEG、PNG、WebP 或 AVIF 图片。');
    }
}

export async function createShowcaseManagedAsset(
    input: CreateShowcaseManagedAssetInput,
    actor: ShowcaseAdminActor
): Promise<ShowcaseManagedAsset> {
    assertUploadEnvelope(input.file);
    const sourceLabel = normalizeMetadataText(input.sourceLabel, '版权来源', 500);
    const licenseNote = normalizeMetadataText(input.licenseNote, '授权说明', 1_000);
    const altZhCN = normalizeMetadataText(input.altZhCN, '中文替代文本', 500);
    const altEnUS = normalizeMetadataText(input.altEnUS, '英文替代文本', 500);
    const source = Buffer.from(await input.file.arrayBuffer());
    if (source.byteLength !== input.file.size || source.byteLength > SHOWCASE_MEDIA_MAX_UPLOAD_BYTES) {
        throw new Error('图片文件大小校验失败。');
    }

    let metadata: Metadata;
    try {
        metadata = await sharp(source, {
            failOn: 'error',
            limitInputPixels: SHOWCASE_MEDIA_MAX_PIXELS
        }).metadata();
    } catch {
        throw new Error('图片无法安全解码或像素数量超过限制。');
    }
    const expectedFormat = INPUT_MIME_FORMATS.get(input.file.type);
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (
        metadata.format !== expectedFormat ||
        width <= 0 ||
        height <= 0 ||
        width > SHOWCASE_MEDIA_MAX_EDGE ||
        height > SHOWCASE_MEDIA_MAX_EDGE ||
        width * height > SHOWCASE_MEDIA_MAX_PIXELS
    ) {
        throw new Error('图片真实格式、尺寸或像素数量不符合要求。');
    }

    const [display, thumbnail] = await Promise.all([
        sharp(source, { failOn: 'error', limitInputPixels: SHOWCASE_MEDIA_MAX_PIXELS })
            .rotate()
            .resize({
                width: SHOWCASE_MEDIA_DISPLAY_MAX_EDGE,
                height: SHOWCASE_MEDIA_DISPLAY_MAX_EDGE,
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({ quality: 88, effort: 4 })
            .toBuffer({ resolveWithObject: true }),
        sharp(source, { failOn: 'error', limitInputPixels: SHOWCASE_MEDIA_MAX_PIXELS })
            .rotate()
            .resize({
                width: SHOWCASE_MEDIA_THUMBNAIL_MAX_EDGE,
                height: SHOWCASE_MEDIA_THUMBNAIL_MAX_EDGE,
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({ quality: 80, effort: 4 })
            .toBuffer({ resolveWithObject: true })
    ]);

    const id = `media_${randomUUID().replaceAll('-', '')}`;
    const storageKey = `${id}.webp`;
    const thumbnailStorageKey = `${id}.thumbnail.webp`;
    const directory = getShowcaseMediaDirectory();
    await fs.mkdir(directory, { recursive: true });
    const displayPath = path.join(directory, storageKey);
    const thumbnailPath = path.join(directory, thumbnailStorageKey);
    await writeAtomic(displayPath, display.data);
    try {
        await writeAtomic(thumbnailPath, thumbnail.data);
        await getServerDatabaseReady();
        const now = Date.now();
        const checksum = createHash('sha256').update(display.data).digest('hex');
        getSqliteClient().transaction(() => {
            getSqliteClient()
                .prepare(
                    `INSERT INTO "showcase_assets"
                     ("id", "mimeType", "width", "height", "byteSize", "thumbnailWidth", "thumbnailHeight", "thumbnailByteSize", "checksum", "storageKey", "thumbnailStorageKey", "sourceLabel", "licenseNote", "altZhCN", "altEnUS", "createdByUserId", "createdAt")
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
                )
                .run(
                    id,
                    'image/webp',
                    display.info.width,
                    display.info.height,
                    display.data.byteLength,
                    thumbnail.info.width,
                    thumbnail.info.height,
                    thumbnail.data.byteLength,
                    checksum,
                    storageKey,
                    thumbnailStorageKey,
                    sourceLabel,
                    licenseNote,
                    altZhCN,
                    altEnUS,
                    actor.userId,
                    now
                );
            writeAssetAuditInTransaction(actor, 'showcase_asset_upload', id, {
                mimeType: 'image/webp',
                width: display.info.width,
                height: display.info.height,
                byteSize: display.data.byteLength,
                checksum
            });
        })();
        await pruneAssetAuditLogs();
        const created = await getShowcaseManagedAsset(id);
        if (!created) throw new Error('专题媒体记录创建失败。');
        return toManagedAsset(created);
    } catch (error) {
        await Promise.all([fs.rm(displayPath, { force: true }), fs.rm(thumbnailPath, { force: true })]);
        throw error;
    }
}

export async function listShowcaseManagedAssets(): Promise<ShowcaseManagedAsset[]> {
    const db = await getServerDatabaseReady();
    const rows = await db.select().from(showcaseAssets).orderBy(desc(showcaseAssets.createdAt));
    return rows.map(toManagedAsset);
}

export async function getShowcaseManagedAsset(id: string): Promise<ManagedAssetRow | null> {
    if (!MANAGED_ASSET_ID_PATTERN.test(id)) return null;
    const db = await getServerDatabaseReady();
    const [row] = await db.select().from(showcaseAssets).where(eq(showcaseAssets.id, id)).limit(1);
    return row ?? null;
}

export function getShowcaseManagedAssetFilePath(row: ManagedAssetRow, thumbnail: boolean): string {
    const storageKey = thumbnail ? row.thumbnailStorageKey : row.storageKey;
    if (path.basename(storageKey) !== storageKey) throw new Error('专题媒体存储记录不安全。');
    return path.join(getShowcaseMediaDirectory(), storageKey);
}

export async function isShowcaseManagedAssetPublic(id: string, now = Date.now()): Promise<boolean> {
    if (!MANAGED_ASSET_ID_PATTERN.test(id)) return false;
    await getServerDatabaseReady();
    const row = getSqliteClient()
        .prepare(
            `SELECT 1 AS "published"
             FROM "showcase_publication_assets" AS refs
             INNER JOIN "showcase_topics" AS topics
                 ON topics."publishedPublicationId" = refs."publicationId"
             WHERE refs."assetId" = ?
               AND topics."status" IN ('published', 'scheduled')
               AND (topics."startsAt" IS NULL OR topics."startsAt" <= ?)
               AND (topics."endsAt" IS NULL OR topics."endsAt" >= ?)
             LIMIT 1;`
        )
        .get(id, now, now);
    return Boolean(row);
}

export function getManagedAssetIds(draft: ShowcaseTopicDraft): string[] {
    const referencedIds = getReferencedAssetIds(draft);
    return [
        ...new Set(
            draft.assets
                .filter((asset) => referencedIds.has(asset.id))
                .flatMap((asset) => getManagedShowcaseAssetId(asset) ?? [])
        )
    ];
}

export async function assertManagedShowcaseAssetsHealthy(draft: ShowcaseTopicDraft): Promise<string[]> {
    const ids = getManagedAssetIds(draft);
    if (ids.length === 0) return ids;
    const db = await getServerDatabaseReady();
    const rows = await db.select().from(showcaseAssets).where(inArray(showcaseAssets.id, ids));
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const missing = ids.filter((id) => !rowsById.has(id));
    if (missing.length > 0) throw new Error(`专题引用的托管媒体不存在：${missing.join(', ')}`);
    for (const id of ids) await validateManagedAssetFiles(rowsById.get(id)!);
    return ids;
}

function draftReferencesAsset(serialized: string, id: string): boolean {
    try {
        const draft = normalizeShowcaseTopicDraft(JSON.parse(serialized));
        return Boolean(draft && getManagedAssetIds(draft).includes(id));
    } catch {
        return serialized.includes(`\"${id}\"`);
    }
}

function findAssetReferencesInTransaction(id: string): { drafts: string[]; publications: string[] } {
    const draftRows = getSqliteClient().prepare('SELECT "id", "draftJson" FROM "showcase_topics";').all() as Array<{
        id: string;
        draftJson: string;
    }>;
    const publicationRows = getSqliteClient()
        .prepare(
            `SELECT publications."id", publications."snapshotJson"
             FROM "showcase_publications" AS publications
             LEFT JOIN "showcase_publication_assets" AS refs
               ON refs."publicationId" = publications."id" AND refs."assetId" = ?;`
        )
        .all(id) as Array<{ id: string; snapshotJson: string }>;
    const directPublicationIds = new Set(
        (
            getSqliteClient()
                .prepare('SELECT "publicationId" FROM "showcase_publication_assets" WHERE "assetId" = ?;')
                .all(id) as Array<{ publicationId: string }>
        ).map((row) => row.publicationId)
    );
    return {
        drafts: draftRows.filter((row) => draftReferencesAsset(row.draftJson, id)).map((row) => row.id),
        publications: publicationRows
            .filter((row) => directPublicationIds.has(row.id) || draftReferencesAsset(row.snapshotJson, id))
            .map((row) => row.id)
    };
}

function quarantineFile(filePath: string): string | null {
    const quarantinePath = `${filePath}.${randomUUID()}.deleting`;
    try {
        fsSync.renameSync(filePath, quarantinePath);
        return quarantinePath;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
        throw error;
    }
}

function quarantineAssetFiles(displayPath: string, thumbnailPath: string): [string | null, string | null] {
    const displayQuarantine = quarantineFile(displayPath);
    try {
        const thumbnailQuarantine = quarantineFile(thumbnailPath);
        return [displayQuarantine, thumbnailQuarantine];
    } catch (error) {
        if (displayQuarantine) fsSync.renameSync(displayQuarantine, displayPath);
        throw error;
    }
}

export async function deleteShowcaseManagedAsset(id: string, actor: ShowcaseAdminActor): Promise<boolean> {
    await getServerDatabaseReady();
    let row: ManagedAssetRow | null = null;
    let displayPath = '';
    let thumbnailPath = '';
    let quarantined: [string | null, string | null] = [null, null];
    try {
        getSqliteClient()
            .transaction(() => {
                row =
                    (getSqliteClient().prepare('SELECT * FROM "showcase_assets" WHERE "id" = ? LIMIT 1;').get(id) as
                        | ManagedAssetRow
                        | undefined) ?? null;
                if (!row) return;
                const references = findAssetReferencesInTransaction(id);
                if (references.drafts.length > 0 || references.publications.length > 0) {
                    throw new ShowcaseAssetInUseError(references);
                }
                displayPath = getShowcaseManagedAssetFilePath(row, false);
                thumbnailPath = getShowcaseManagedAssetFilePath(row, true);
                quarantined = quarantineAssetFiles(displayPath, thumbnailPath);
                const deleted = getSqliteClient().prepare('DELETE FROM "showcase_assets" WHERE "id" = ?;').run(id);
                if (deleted.changes !== 1) throw new Error('专题媒体记录删除失败。');
                writeAssetAuditInTransaction(actor, 'showcase_asset_delete', id, {
                    checksum: row!.checksum,
                    byteSize: row!.byteSize,
                    sourceLabel: row!.sourceLabel
                });
            })
            .immediate();
    } catch (error) {
        quarantined.forEach((quarantinePath, index) => {
            if (quarantinePath) fsSync.renameSync(quarantinePath, index === 0 ? displayPath : thumbnailPath);
        });
        throw error;
    }
    if (!row) return false;
    await Promise.allSettled(
        quarantined.map((filePath) => (filePath ? fs.rm(filePath, { force: true }) : Promise.resolve()))
    );
    await pruneAssetAuditLogs();
    return true;
}
