import type { ShowcasePublicCatalogResult } from './types';
import { DEFAULT_SHOWCASE_CONTENT_NOTICE } from './validation';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import { getServerDatabaseReady } from '@/lib/server/db';
import { showcasePublications, showcaseTopics } from '@/lib/server/schema';
import { SHOWCASE_CATALOG_SCHEMA_VERSION, getManagedShowcaseAssetId, normalizeShowcaseCatalog } from '@/lib/showcase';
import type { ShowcaseAsset, ShowcaseCase, ShowcaseCatalog, ShowcaseTopic } from '@/lib/showcase';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { createHash } from 'node:crypto';

type PublicationSnapshot = {
    topic: ShowcaseTopic;
    cases: ShowcaseCase[];
    assets: ShowcaseAsset[];
};

export function etagForShowcaseCatalog(catalog: ShowcaseCatalog): string {
    return `\"${createHash('sha256').update(JSON.stringify(catalog)).digest('hex')}\"`;
}

export function toPublicShowcaseWireCatalog(
    catalog: ShowcaseCatalog,
    publicOrigin: string,
    options: { supportsExtendedCases?: boolean } = {}
): ShowcaseCatalog {
    let secureOrigin: string | null = null;
    try {
        const parsed = new URL(publicOrigin);
        secureOrigin = parsed.protocol === 'https:' ? parsed.origin : null;
    } catch {
        secureOrigin = null;
    }
    const executableCaseIds = new Set(
        catalog.cases
            .filter(
                (showcaseCase) => options.supportsExtendedCases || showcaseCase.unsupportedRecipeVersion === undefined
            )
            .map((item) => item.id)
    );
    const topics = catalog.topics
        .map((topic) => {
            if (options.supportsExtendedCases) {
                return { ...topic, caseIds: topic.caseIds.filter((caseId) => executableCaseIds.has(caseId)) };
            }
            const legacyTopic = { ...topic } as ShowcaseTopic & { categories?: unknown; publishedAt?: unknown };
            Reflect.deleteProperty(legacyTopic, 'categories');
            Reflect.deleteProperty(legacyTopic, 'publishedAt');
            return { ...legacyTopic, caseIds: topic.caseIds.filter((caseId) => executableCaseIds.has(caseId)) };
        })
        .filter((topic) => topic.caseIds.length > 0);
    const topicIds = new Set(topics.map((topic) => topic.id));
    const cases = catalog.cases.filter(
        (showcaseCase) => executableCaseIds.has(showcaseCase.id) && topicIds.has(showcaseCase.topicId)
    );
    const referencedAssetIds = new Set<string>();
    for (const topic of topics) referencedAssetIds.add(topic.coverAssetId);
    for (const showcaseCase of cases) {
        referencedAssetIds.add(showcaseCase.coverAssetId);
        showcaseCase.inputAssetIds.forEach((id) => referencedAssetIds.add(id));
        showcaseCase.outputAssetIds.forEach((id) => referencedAssetIds.add(id));
    }
    return {
        ...catalog,
        topics,
        cases,
        assets: catalog.assets
            .filter((asset) => referencedAssetIds.has(asset.id))
            .map((asset) => {
                if (asset.kind !== 'remote-image') return asset;
                const managedAssetId = getManagedShowcaseAssetId(asset);
                return {
                    id: asset.id,
                    kind: 'remote-image' as const,
                    alt: asset.alt,
                    url:
                        managedAssetId && secureOrigin
                            ? new URL(`/api/showcase-media/${managedAssetId}`, secureOrigin).toString()
                            : asset.url,
                    mimeType: asset.mimeType,
                    ...(asset.width !== undefined ? { width: asset.width } : {}),
                    ...(asset.height !== undefined ? { height: asset.height } : {}),
                    ...(managedAssetId && secureOrigin && options.supportsExtendedCases
                        ? {
                              thumbnailUrl: new URL(
                                  `/api/showcase-media/${managedAssetId}?variant=thumbnail`,
                                  secureOrigin
                              ).toString()
                          }
                        : {}),
                    ...(managedAssetId && !secureOrigin
                        ? {
                              managedAssetId,
                              thumbnailUrl:
                                  asset.thumbnailUrl ?? `/api/showcase-media/${managedAssetId}?variant=thumbnail`
                          }
                        : {}),
                    ...(!managedAssetId && options.supportsExtendedCases && asset.thumbnailUrl
                        ? { thumbnailUrl: asset.thumbnailUrl }
                        : {})
                };
            })
    };
}

export function parseShowcasePublicationSnapshot(value: string): PublicationSnapshot | null {
    try {
        const parsed = JSON.parse(value) as PublicationSnapshot;
        const generatedAt = Date.now();
        const normalized = normalizeShowcaseCatalog(
            {
                schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
                catalogRevision: `snapshot-${generatedAt}`,
                generatedAt,
                contentNotice: DEFAULT_SHOWCASE_CONTENT_NOTICE,
                topics: parsed.topic ? [parsed.topic] : [],
                cases: parsed.cases,
                assets: parsed.assets
            },
            {
                allowDanglingRelatedTopicIds: true,
                allowUnsupportedRecipeVersions: true,
                allowExtendedTopicMetadata: true
            }
        );
        const topic = normalized?.topics[0];
        return normalized && topic ? { topic, cases: normalized.cases, assets: normalized.assets } : null;
    } catch {
        return null;
    }
}

function retainPublishedRelatedTopics(topics: ShowcaseTopic[]): ShowcaseTopic[] {
    const publishedTopicIds = new Set(topics.map((topic) => topic.id));
    return topics.map((topic) =>
        topic.relatedTopicIds
            ? {
                  ...topic,
                  relatedTopicIds: topic.relatedTopicIds.filter((id) => publishedTopicIds.has(id))
              }
            : topic
    );
}

function mergePublicationAssets(entries: Array<{ snapshot: PublicationSnapshot }>): ShowcaseAsset[] | null {
    const assets = new Map<string, ShowcaseAsset>();
    for (const entry of entries) {
        for (const asset of entry.snapshot.assets) {
            const existing = assets.get(asset.id);
            if (existing && JSON.stringify(existing) !== JSON.stringify(asset)) return null;
            assets.set(asset.id, asset);
        }
    }
    return [...assets.values()];
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
        const snapshot = parseShowcasePublicationSnapshot(row.snapshotJson);
        return snapshot ? [{ row, snapshot }] : [];
    });
    if (validEntries.length === 0) {
        return {
            catalog: DEFAULT_SHOWCASE_CATALOG,
            source: 'builtin',
            etag: etagForShowcaseCatalog(DEFAULT_SHOWCASE_CATALOG)
        };
    }

    const acceptedEntries: typeof validEntries = [];
    for (const entry of validEntries) {
        const candidates = [...acceptedEntries, entry];
        const assets = mergePublicationAssets(candidates);
        if (!assets) continue;
        const candidateCatalog = normalizeShowcaseCatalog(
            {
                schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
                catalogRevision: 'published-validation',
                generatedAt: Math.max(...candidates.map((candidate) => candidate.row.publishedAt.getTime()), 1),
                contentNotice: DEFAULT_SHOWCASE_CONTENT_NOTICE,
                topics: candidates.map((candidate) => candidate.snapshot.topic),
                cases: candidates.flatMap((candidate) => candidate.snapshot.cases),
                assets
            },
            {
                allowDanglingRelatedTopicIds: true,
                allowUnsupportedRecipeVersions: true,
                allowExtendedTopicMetadata: true
            }
        );
        if (candidateCatalog) acceptedEntries.push(entry);
    }
    if (acceptedEntries.length === 0) {
        return {
            catalog: DEFAULT_SHOWCASE_CATALOG,
            source: 'builtin',
            etag: etagForShowcaseCatalog(DEFAULT_SHOWCASE_CATALOG)
        };
    }

    const generatedAt = Math.max(...acceptedEntries.map((entry) => entry.row.publishedAt.getTime()), 1);
    const catalogRevision = createHash('sha256')
        .update(acceptedEntries.map((entry) => entry.row.catalogRevision).join('\n'))
        .digest('hex')
        .slice(0, 32);
    const publishedTopics = retainPublishedRelatedTopics(
        acceptedEntries.map((entry) => ({
            ...entry.snapshot.topic,
            publishedAt: entry.row.publishedAt.getTime()
        }))
    );
    const publishedAssets = mergePublicationAssets(acceptedEntries);
    if (!publishedAssets) {
        return {
            catalog: DEFAULT_SHOWCASE_CATALOG,
            source: 'builtin',
            etag: etagForShowcaseCatalog(DEFAULT_SHOWCASE_CATALOG)
        };
    }
    const catalog = normalizeShowcaseCatalog(
        {
            schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
            catalogRevision: `published-${catalogRevision}`,
            generatedAt,
            contentNotice: DEFAULT_SHOWCASE_CONTENT_NOTICE,
            topics: publishedTopics,
            cases: acceptedEntries.flatMap((entry) => entry.snapshot.cases),
            assets: publishedAssets
        },
        { allowUnsupportedRecipeVersions: true, allowExtendedTopicMetadata: true }
    );
    if (!catalog) {
        return {
            catalog: DEFAULT_SHOWCASE_CATALOG,
            source: 'builtin',
            etag: etagForShowcaseCatalog(DEFAULT_SHOWCASE_CATALOG)
        };
    }

    return { catalog, source: 'published', etag: etagForShowcaseCatalog(catalog) };
}

export async function getPublicShowcaseTopic(slugOrId: string): Promise<ShowcasePublicCatalogResult | null> {
    const result = await getPublicShowcaseCatalog();
    const topic = result.catalog.topics.find((candidate) => candidate.slug === slugOrId || candidate.id === slugOrId);
    if (!topic) return null;
    const standaloneTopic = retainPublishedRelatedTopics([topic])[0]!;
    const caseIds = new Set(topic.caseIds);
    const cases = result.catalog.cases.filter((showcaseCase) => caseIds.has(showcaseCase.id));
    const assetIds = new Set<string>([topic.coverAssetId]);
    for (const showcaseCase of cases) {
        assetIds.add(showcaseCase.coverAssetId);
        showcaseCase.inputAssetIds.forEach((id) => assetIds.add(id));
        showcaseCase.outputAssetIds.forEach((id) => assetIds.add(id));
    }
    const catalog = normalizeShowcaseCatalog(
        {
            ...result.catalog,
            topics: [standaloneTopic],
            cases,
            assets: result.catalog.assets.filter((asset) => assetIds.has(asset.id))
        },
        { allowUnsupportedRecipeVersions: true, allowExtendedTopicMetadata: true }
    );
    if (!catalog) return null;
    return { ...result, catalog, etag: etagForShowcaseCatalog(catalog) };
}
