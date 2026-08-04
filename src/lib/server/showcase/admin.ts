import {
    assertManagedShowcaseAssetsHealthy,
    getManagedAssetIds,
    selectReferencedShowcaseTopicDraftAssets
} from './media';
import { assertRemoteShowcaseAssetsHealthy } from './remote-media';
import type {
    ShowcaseAdminActor,
    ShowcaseAdminTopic,
    ShowcasePublicationSummary,
    ShowcaseTopicDraft,
    ShowcaseTopicWriteInput
} from './types';
import { buildCatalogFromTopicDraft, normalizeShowcaseIdentifier, normalizeShowcaseTopicDraft } from './validation';
import { getAuditLogMaxRows, pruneAuditLogsToMaxRows } from '@/lib/server/audit';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { showcasePublications, showcaseTopics } from '@/lib/server/schema';
import { randomToken, sanitizePlainText } from '@/lib/server/security';
import { SHOWCASE_CATALOG_SCHEMA_VERSION } from '@/lib/showcase';
import type { ShowcaseCatalog } from '@/lib/showcase';
import { asc, desc, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';

type TopicRow = typeof showcaseTopics.$inferSelect;
type PublicationRow = typeof showcasePublications.$inferSelect;

function dateMs(value: Date | null | undefined): number | null {
    return value ? value.getTime() : null;
}

function parseDraft(value: string): ShowcaseTopicDraft {
    const draft = normalizeShowcaseTopicDraft(JSON.parse(value));
    if (!draft) throw new Error('专题草稿已损坏，无法读取。');
    return draft;
}

function toAdminTopic(row: TopicRow): ShowcaseAdminTopic {
    return {
        id: row.id,
        slug: row.slug,
        status: row.status,
        featured: row.featured,
        sortOrder: row.sortOrder,
        startsAt: dateMs(row.startsAt),
        endsAt: dateMs(row.endsAt),
        draftRevision: row.draftRevision,
        publishedPublicationId: row.publishedPublicationId,
        publishedAt: dateMs(row.publishedAt),
        archivedAt: dateMs(row.archivedAt),
        createdAt: row.createdAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
        draft: parseDraft(row.draftJson)
    };
}

function toPublicationSummary(row: PublicationRow, activePublicationId: string | null): ShowcasePublicationSummary {
    return {
        id: row.id,
        topicId: row.topicId,
        revision: row.revision,
        schemaVersion: row.schemaVersion,
        catalogRevision: row.catalogRevision,
        contentHash: row.contentHash,
        sourcePublicationId: row.sourcePublicationId,
        publishedAt: row.publishedAt.getTime(),
        active: row.id === activePublicationId
    };
}

function normalizedDraftOrThrow(value: unknown): ShowcaseTopicDraft {
    const draft = normalizeShowcaseTopicDraft(value);
    if (!draft) throw new Error('专题草稿不完整或包含不安全内容。');
    if (JSON.stringify(draft).length > 2_000_000) throw new Error('专题草稿超过 2 MB 限制。');
    return draft;
}

function assertDateWindow(startsAt: Date | null | undefined, endsAt: Date | null | undefined): void {
    if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) {
        throw new Error('专题开始时间必须早于结束时间。');
    }
}

function publicationSnapshot(draft: ShowcaseTopicDraft): string {
    return JSON.stringify(draft);
}

function getRequestIp(request: Request): string | null {
    return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
}

function writeAuditInTransaction(
    actor: ShowcaseAdminActor,
    action: string,
    targetId: string,
    metadata: Record<string, unknown> = {}
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
            'showcase_topic',
            sanitizePlainText(targetId),
            getRequestIp(actor.request),
            actor.request.headers.get('user-agent')?.trim() || null,
            JSON.stringify(metadata)
        );
}

async function writeAudit(
    actor: ShowcaseAdminActor,
    action: string,
    targetId: string,
    metadata: Record<string, unknown> = {}
): Promise<void> {
    await getServerDatabaseReady();
    getSqliteClient()
        .transaction(() => writeAuditInTransaction(actor, action, targetId, metadata))
        .immediate();
    await pruneShowcaseAuditLogs();
}

async function pruneShowcaseAuditLogs(): Promise<void> {
    try {
        await pruneAuditLogsToMaxRows(getAuditLogMaxRows());
    } catch {
        // Retention maintenance must not turn a successful showcase mutation into an API failure.
    }
}

function assertManagedShowcaseAssetsExistInTransaction(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const lookup = getSqliteClient().prepare('SELECT 1 AS "present" FROM "showcase_assets" WHERE "id" = ? LIMIT 1;');
    const missing = ids.filter((id) => !lookup.get(id));
    if (missing.length > 0) throw new Error(`专题引用的托管媒体不存在：${missing.join(', ')}`);
}

async function getTopicRow(id: string): Promise<TopicRow | null> {
    const normalizedId = normalizeShowcaseIdentifier(id);
    if (!normalizedId) return null;
    const db = await getServerDatabaseReady();
    const [row] = await db.select().from(showcaseTopics).where(eq(showcaseTopics.id, normalizedId)).limit(1);
    return row ?? null;
}

async function createPublication(
    row: TopicRow,
    draft: ShowcaseTopicDraft,
    actor: ShowcaseAdminActor,
    sourcePublicationId: string | null = null
): Promise<PublicationRow> {
    await getServerDatabaseReady();
    const publicationDraft = selectReferencedShowcaseTopicDraftAssets(draft);
    const [managedAssetIds] = await Promise.all([
        assertManagedShowcaseAssetsHealthy(publicationDraft),
        assertRemoteShowcaseAssetsHealthy(publicationDraft)
    ]);
    const publicationId = randomToken(16);
    const now = new Date();
    const transactionResult = getSqliteClient().transaction(() => {
        const revisionRow = getSqliteClient()
            .prepare(
                'SELECT COALESCE(MAX("revision"), 0) AS "revision" FROM "showcase_publications" WHERE "topicId" = ?;'
            )
            .get(row.id) as { revision: number };
        const revision = Number(revisionRow.revision) + 1;
        const catalogRevision = `topic-${row.id}-r${revision}-${publicationId.slice(0, 8)}`;
        const catalog = buildCatalogFromTopicDraft(publicationDraft, catalogRevision, now.getTime());
        const snapshotJson = publicationSnapshot({
            topic: catalog.topics[0]!,
            cases: catalog.cases,
            assets: catalog.assets
        });
        const contentHash = createHash('sha256').update(snapshotJson).digest('hex');
        getSqliteClient()
            .prepare(
                `INSERT INTO "showcase_publications"
                 ("id", "topicId", "revision", "schemaVersion", "catalogRevision", "snapshotJson", "contentHash", "sourcePublicationId", "publishedByUserId", "publishedAt")
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
            )
            .run(
                publicationId,
                row.id,
                revision,
                SHOWCASE_CATALOG_SCHEMA_VERSION,
                catalogRevision,
                snapshotJson,
                contentHash,
                sourcePublicationId,
                actor.userId,
                now.getTime()
            );
        const insertAssetReference = getSqliteClient().prepare(
            `INSERT INTO "showcase_publication_assets" ("publicationId", "assetId", "createdAt")
             VALUES (?, ?, ?);`
        );
        for (const assetId of managedAssetIds) {
            insertAssetReference.run(publicationId, assetId, now.getTime());
        }
        getSqliteClient()
            .prepare(
                `UPDATE "showcase_topics"
                 SET "status" = ?, "publishedPublicationId" = ?, "publishedAt" = ?, "archivedAt" = NULL,
                     "updatedByUserId" = ?, "updatedAt" = ?
                 WHERE "id" = ?;`
            )
            .run(
                row.startsAt && row.startsAt.getTime() > now.getTime() ? 'scheduled' : 'published',
                publicationId,
                now.getTime(),
                actor.userId,
                now.getTime(),
                row.id
            );
        return { revision, catalogRevision, contentHash };
    })();
    const db = await getServerDatabaseReady();
    const [publication] = await db
        .select()
        .from(showcasePublications)
        .where(eq(showcasePublications.id, publicationId))
        .limit(1);
    if (!publication) {
        throw new Error(`专题发布失败：修订 ${transactionResult.revision} 未写入。`);
    }
    return publication;
}

export async function listShowcaseTopicsAdmin(): Promise<ShowcaseAdminTopic[]> {
    const db = await getServerDatabaseReady();
    const rows = await db.select().from(showcaseTopics).orderBy(asc(showcaseTopics.sortOrder), asc(showcaseTopics.id));
    return rows.map(toAdminTopic);
}

export async function getShowcaseTopicAdmin(id: string): Promise<{
    topic: ShowcaseAdminTopic;
    publications: ShowcasePublicationSummary[];
} | null> {
    const row = await getTopicRow(id);
    if (!row) return null;
    const db = await getServerDatabaseReady();
    const publications = await db
        .select()
        .from(showcasePublications)
        .where(eq(showcasePublications.topicId, row.id))
        .orderBy(desc(showcasePublications.revision));
    return {
        topic: toAdminTopic(row),
        publications: publications.map((publication) => toPublicationSummary(publication, row.publishedPublicationId))
    };
}

export async function createShowcaseTopicAdmin(
    input: ShowcaseTopicWriteInput,
    actor: ShowcaseAdminActor
): Promise<ShowcaseAdminTopic> {
    const draft = normalizedDraftOrThrow(input.draft);
    const managedAssetIds = getManagedAssetIds(draft);
    assertDateWindow(input.startsAt, input.endsAt);
    await getServerDatabaseReady();
    const now = Date.now();
    getSqliteClient()
        .transaction(() => {
            assertManagedShowcaseAssetsExistInTransaction(managedAssetIds);
            if (
                getSqliteClient().prepare('SELECT 1 FROM "showcase_topics" WHERE "id" = ? LIMIT 1;').get(draft.topic.id)
            ) {
                throw new Error('专题 ID 已存在。');
            }
            if (
                getSqliteClient()
                    .prepare('SELECT 1 FROM "showcase_topics" WHERE "slug" = ? LIMIT 1;')
                    .get(draft.topic.slug)
            ) {
                throw new Error('专题 Slug 已存在。');
            }
            getSqliteClient()
                .prepare(
                    `INSERT INTO "showcase_topics"
                     ("id", "slug", "status", "featured", "sortOrder", "startsAt", "endsAt", "draftJson", "draftRevision", "createdByUserId", "updatedByUserId", "createdAt", "updatedAt")
                     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?);`
                )
                .run(
                    draft.topic.id,
                    draft.topic.slug,
                    draft.topic.featured ? 1 : 0,
                    draft.topic.sortOrder,
                    dateMs(input.startsAt) ?? null,
                    dateMs(input.endsAt) ?? null,
                    JSON.stringify(draft),
                    actor.userId,
                    actor.userId,
                    now,
                    now
                );
            writeAuditInTransaction(actor, 'showcase_topic_create', draft.topic.id, { slug: draft.topic.slug });
        })
        .immediate();
    await pruneShowcaseAuditLogs();
    const created = await getTopicRow(draft.topic.id);
    if (!created) throw new Error('专题草稿创建失败。');
    return toAdminTopic(created);
}

export async function updateShowcaseTopicAdmin(
    id: string,
    input: ShowcaseTopicWriteInput,
    actor: ShowcaseAdminActor
): Promise<ShowcaseAdminTopic | null> {
    const normalizedId = normalizeShowcaseIdentifier(id);
    if (!normalizedId) return null;
    const draft = normalizedDraftOrThrow(input.draft);
    const managedAssetIds = getManagedAssetIds(draft);
    if (draft.topic.id !== normalizedId) throw new Error('专题 ID 创建后不能修改。');
    assertDateWindow(input.startsAt, input.endsAt);
    await getServerDatabaseReady();
    let updatedRevision = 0;
    let found = false;
    getSqliteClient()
        .transaction(() => {
            const row = getSqliteClient()
                .prepare(
                    'SELECT "id", "startsAt", "endsAt", "draftRevision" FROM "showcase_topics" WHERE "id" = ? LIMIT 1;'
                )
                .get(normalizedId) as
                | { id: string; startsAt: number | null; endsAt: number | null; draftRevision: number }
                | undefined;
            if (!row) return;
            found = true;
            assertManagedShowcaseAssetsExistInTransaction(managedAssetIds);
            const slugOwner = getSqliteClient()
                .prepare('SELECT "id" FROM "showcase_topics" WHERE "slug" = ? LIMIT 1;')
                .get(draft.topic.slug) as { id: string } | undefined;
            if (slugOwner && slugOwner.id !== normalizedId) throw new Error('专题 Slug 已存在。');
            updatedRevision = Number(row.draftRevision) + 1;
            const now = Date.now();
            const result = getSqliteClient()
                .prepare(
                    `UPDATE "showcase_topics"
                     SET "slug" = ?, "featured" = ?, "sortOrder" = ?, "startsAt" = ?, "endsAt" = ?,
                         "draftJson" = ?, "draftRevision" = ?, "updatedByUserId" = ?, "updatedAt" = ?
                     WHERE "id" = ?;`
                )
                .run(
                    draft.topic.slug,
                    draft.topic.featured ? 1 : 0,
                    draft.topic.sortOrder,
                    input.startsAt === undefined ? row.startsAt : dateMs(input.startsAt),
                    input.endsAt === undefined ? row.endsAt : dateMs(input.endsAt),
                    JSON.stringify(draft),
                    updatedRevision,
                    actor.userId,
                    now,
                    normalizedId
                );
            if (result.changes !== 1) throw new Error('专题草稿更新失败。');
            writeAuditInTransaction(actor, 'showcase_topic_update', normalizedId, {
                slug: draft.topic.slug,
                draftRevision: updatedRevision
            });
        })
        .immediate();
    if (!found) return null;
    await pruneShowcaseAuditLogs();
    const updated = await getTopicRow(normalizedId);
    if (!updated) throw new Error('专题草稿更新后无法读取。');
    return toAdminTopic(updated);
}

export async function archiveShowcaseTopicAdmin(id: string, actor: ShowcaseAdminActor): Promise<boolean> {
    const row = await getTopicRow(id);
    if (!row) return false;
    const now = new Date();
    const db = await getServerDatabaseReady();
    await db
        .update(showcaseTopics)
        .set({
            status: 'archived',
            publishedPublicationId: null,
            archivedAt: now,
            updatedByUserId: actor.userId,
            updatedAt: now
        })
        .where(eq(showcaseTopics.id, row.id));
    await writeAudit(actor, 'showcase_topic_archive', row.id, { previousStatus: row.status });
    return true;
}

export async function previewShowcaseTopicAdmin(id: string): Promise<ShowcaseCatalog | null> {
    const row = await getTopicRow(id);
    if (!row) return null;
    return buildCatalogFromTopicDraft(parseDraft(row.draftJson), `preview-${row.id}-r${row.draftRevision}`);
}

export async function publishShowcaseTopicAdmin(
    id: string,
    actor: ShowcaseAdminActor
): Promise<ShowcasePublicationSummary | null> {
    const row = await getTopicRow(id);
    if (!row) return null;
    const publication = await createPublication(row, parseDraft(row.draftJson), actor);
    await writeAudit(actor, 'showcase_topic_publish', row.id, {
        publicationId: publication.id,
        revision: publication.revision,
        contentHash: publication.contentHash
    });
    return toPublicationSummary(publication, publication.id);
}

export async function unpublishShowcaseTopicAdmin(id: string, actor: ShowcaseAdminActor): Promise<boolean> {
    const row = await getTopicRow(id);
    if (!row) return false;
    const db = await getServerDatabaseReady();
    await db
        .update(showcaseTopics)
        .set({
            status: 'unpublished',
            publishedPublicationId: null,
            updatedByUserId: actor.userId,
            updatedAt: new Date()
        })
        .where(eq(showcaseTopics.id, row.id));
    await writeAudit(actor, 'showcase_topic_unpublish', row.id, {
        publicationId: row.publishedPublicationId
    });
    return true;
}

export async function rollbackShowcaseTopicAdmin(
    id: string,
    publicationId: string,
    actor: ShowcaseAdminActor
): Promise<ShowcasePublicationSummary | null> {
    const row = await getTopicRow(id);
    if (!row) return null;
    const normalizedPublicationId = publicationId.trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(normalizedPublicationId)) throw new Error('发布版本 ID 不合法。');
    const db = await getServerDatabaseReady();
    const [source] = await db
        .select()
        .from(showcasePublications)
        .where(eq(showcasePublications.id, normalizedPublicationId))
        .limit(1);
    if (!source || source.topicId !== row.id) throw new Error('指定的历史发布版本不存在。');
    const draft = normalizedDraftOrThrow(JSON.parse(source.snapshotJson));
    const publication = await createPublication(row, draft, actor, source.id);
    await writeAudit(actor, 'showcase_topic_rollback', row.id, {
        sourcePublicationId: source.id,
        publicationId: publication.id,
        revision: publication.revision
    });
    return toPublicationSummary(publication, publication.id);
}
