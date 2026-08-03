import type { ShowcasePublicCatalogResult } from './types';
import { DEFAULT_SHOWCASE_CONTENT_NOTICE } from './validation';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import { getServerDatabaseReady } from '@/lib/server/db';
import { showcasePublications, showcaseTopics } from '@/lib/server/schema';
import { SHOWCASE_CATALOG_SCHEMA_VERSION, normalizeShowcaseCatalog } from '@/lib/showcase';
import type { ShowcaseAsset, ShowcaseCase, ShowcaseCatalog, ShowcaseTopic } from '@/lib/showcase';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { createHash } from 'node:crypto';

type PublicationSnapshot = {
    topic: ShowcaseTopic;
    cases: ShowcaseCase[];
    assets: ShowcaseAsset[];
};

function etagForCatalog(catalog: ShowcaseCatalog): string {
    return `\"${createHash('sha256').update(JSON.stringify(catalog)).digest('hex')}\"`;
}

function parsePublicationSnapshot(value: string): PublicationSnapshot | null {
    try {
        const parsed = JSON.parse(value) as PublicationSnapshot;
        const generatedAt = Date.now();
        const normalized = normalizeShowcaseCatalog({
            schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
            catalogRevision: `snapshot-${generatedAt}`,
            generatedAt,
            contentNotice: DEFAULT_SHOWCASE_CONTENT_NOTICE,
            topics: parsed.topic ? [parsed.topic] : [],
            cases: parsed.cases,
            assets: parsed.assets
        });
        const topic = normalized?.topics[0];
        return normalized && topic ? { topic, cases: normalized.cases, assets: normalized.assets } : null;
    } catch {
        return null;
    }
}

export async function getPublicShowcaseCatalog(now = new Date()): Promise<ShowcasePublicCatalogResult> {
    const db = await getServerDatabaseReady();
    const rows = await db
        .select({
            topicId: showcaseTopics.id,
            publicationId: showcasePublications.id,
            catalogRevision: showcasePublications.catalogRevision,
            publishedAt: showcasePublications.publishedAt,
            snapshotJson: showcasePublications.snapshotJson
        })
        .from(showcaseTopics)
        .innerJoin(showcasePublications, eq(showcaseTopics.publishedPublicationId, showcasePublications.id))
        .where(
            and(
                or(eq(showcaseTopics.status, 'published'), eq(showcaseTopics.status, 'scheduled')),
                or(isNull(showcaseTopics.startsAt), lte(showcaseTopics.startsAt, now)),
                or(isNull(showcaseTopics.endsAt), gte(showcaseTopics.endsAt, now))
            )
        )
        .orderBy(asc(showcaseTopics.sortOrder), asc(showcaseTopics.id));

    const validEntries = rows.flatMap((row) => {
        const snapshot = parsePublicationSnapshot(row.snapshotJson);
        return snapshot ? [{ row, snapshot }] : [];
    });
    if (validEntries.length === 0) {
        return {
            catalog: DEFAULT_SHOWCASE_CATALOG,
            source: 'builtin',
            etag: etagForCatalog(DEFAULT_SHOWCASE_CATALOG)
        };
    }

    const acceptedEntries: typeof validEntries = [];
    for (const entry of validEntries) {
        const candidates = [...acceptedEntries, entry];
        const candidateCatalog = normalizeShowcaseCatalog({
            schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
            catalogRevision: 'published-validation',
            generatedAt: Math.max(...candidates.map((candidate) => candidate.row.publishedAt.getTime()), 1),
            contentNotice: DEFAULT_SHOWCASE_CONTENT_NOTICE,
            topics: candidates.map((candidate) => candidate.snapshot.topic),
            cases: candidates.flatMap((candidate) => candidate.snapshot.cases),
            assets: candidates.flatMap((candidate) => candidate.snapshot.assets)
        });
        if (candidateCatalog) acceptedEntries.push(entry);
    }
    if (acceptedEntries.length === 0) {
        return {
            catalog: DEFAULT_SHOWCASE_CATALOG,
            source: 'builtin',
            etag: etagForCatalog(DEFAULT_SHOWCASE_CATALOG)
        };
    }

    const generatedAt = Math.max(...acceptedEntries.map((entry) => entry.row.publishedAt.getTime()), 1);
    const catalogRevision = createHash('sha256')
        .update(acceptedEntries.map((entry) => entry.row.catalogRevision).join('\n'))
        .digest('hex')
        .slice(0, 32);
    const catalog = normalizeShowcaseCatalog({
        schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
        catalogRevision: `published-${catalogRevision}`,
        generatedAt,
        contentNotice: DEFAULT_SHOWCASE_CONTENT_NOTICE,
        topics: acceptedEntries.map((entry) => entry.snapshot.topic),
        cases: acceptedEntries.flatMap((entry) => entry.snapshot.cases),
        assets: acceptedEntries.flatMap((entry) => entry.snapshot.assets)
    });
    if (!catalog) {
        return {
            catalog: DEFAULT_SHOWCASE_CATALOG,
            source: 'builtin',
            etag: etagForCatalog(DEFAULT_SHOWCASE_CATALOG)
        };
    }

    return { catalog, source: 'published', etag: etagForCatalog(catalog) };
}

export async function getPublicShowcaseTopic(slugOrId: string): Promise<ShowcasePublicCatalogResult | null> {
    const result = await getPublicShowcaseCatalog();
    const topic = result.catalog.topics.find((candidate) => candidate.slug === slugOrId || candidate.id === slugOrId);
    if (!topic) return null;
    const caseIds = new Set(topic.caseIds);
    const cases = result.catalog.cases.filter((showcaseCase) => caseIds.has(showcaseCase.id));
    const assetIds = new Set<string>([topic.coverAssetId]);
    for (const showcaseCase of cases) {
        assetIds.add(showcaseCase.coverAssetId);
        showcaseCase.inputAssetIds.forEach((id) => assetIds.add(id));
        showcaseCase.outputAssetIds.forEach((id) => assetIds.add(id));
    }
    const catalog = normalizeShowcaseCatalog({
        ...result.catalog,
        topics: [topic],
        cases,
        assets: result.catalog.assets.filter((asset) => assetIds.has(asset.id))
    });
    if (!catalog) return null;
    return { ...result, catalog, etag: etagForCatalog(catalog) };
}
