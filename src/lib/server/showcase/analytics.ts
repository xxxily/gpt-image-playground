import { normalizeShowcaseAnalyticsEvent, type ShowcaseAnalyticsEvent } from '@/lib/showcase-analytics';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { showcaseEvents } from '@/lib/server/schema';
import { randomToken } from '@/lib/server/security';
import { and, count, gte, lte, sql } from 'drizzle-orm';

export const SHOWCASE_ANALYTICS_MAX_BATCH = 25;
export const SHOWCASE_ANALYTICS_MAX_BODY_BYTES = 32 * 1024;
export const SHOWCASE_ANALYTICS_RETENTION_DAYS = 180;
export const SHOWCASE_ANALYTICS_MAX_ROWS = 1_000_000;

export type ShowcaseAnalyticsSummaryRow = {
    event: string;
    count: number;
};

export type ShowcaseAnalyticsSummary = {
    from: number;
    to: number;
    total: number;
    events: ShowcaseAnalyticsSummaryRow[];
    topics: Array<{ topicId: string; event: string; count: number }>;
    cases: Array<{ topicId: string; caseId: string; event: string; count: number }>;
};

export function parseShowcaseAnalyticsBatch(value: unknown): ShowcaseAnalyticsEvent[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > SHOWCASE_ANALYTICS_MAX_BATCH) {
        throw new Error('专题分析事件批次大小不合法。');
    }
    const events = value.map((item) => normalizeShowcaseAnalyticsEvent(item));
    if (events.some((event) => !event)) throw new Error('专题分析事件包含不支持或不安全的字段。');
    return events as ShowcaseAnalyticsEvent[];
}

export async function recordShowcaseAnalyticsBatch(events: ShowcaseAnalyticsEvent[]): Promise<void> {
    const normalized = parseShowcaseAnalyticsBatch(events);
    await getServerDatabaseReady();
    const now = Date.now();
    const insert = getSqliteClient().prepare(
        `INSERT INTO "showcase_events"
         ("id", "eventName", "topicId", "caseId", "catalogRevision", "position", "entryPoint", "runtime", "recipeVersion", "modelId", "errorCategory", "createdAt")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
    );
    const transaction = getSqliteClient().transaction(() => {
        for (const event of normalized) {
            insert.run(
                randomToken(16),
                event.event,
                event.topicId,
                event.caseId ?? null,
                event.catalogRevision ?? null,
                event.position ?? null,
                event.entryPoint ?? null,
                event.runtime,
                event.recipeVersion ?? null,
                event.modelId ?? null,
                event.errorCategory ?? null,
                now
            );
        }
    });
    transaction();
    pruneShowcaseAnalytics(now - SHOWCASE_ANALYTICS_RETENTION_DAYS * 86_400_000);
}

export function pruneShowcaseAnalytics(before: number): number {
    const result = getSqliteClient()
        .prepare('DELETE FROM "showcase_events" WHERE "createdAt" < ?;')
        .run(before);
    const countRow = getSqliteClient().prepare('SELECT COUNT(*) AS "count" FROM "showcase_events";').get() as {
        count: number;
    };
    if (countRow.count > SHOWCASE_ANALYTICS_MAX_ROWS) {
        const overflow = getSqliteClient()
            .prepare(
                `DELETE FROM "showcase_events"
                 WHERE "id" IN (
                    SELECT "id" FROM "showcase_events"
                    ORDER BY "createdAt" ASC, "id" ASC
                    LIMIT ?
                 );`
            )
            .run(countRow.count - SHOWCASE_ANALYTICS_MAX_ROWS);
        return result.changes + overflow.changes;
    }
    return result.changes;
}

export async function getShowcaseAnalyticsSummary(
    from = Date.now() - 30 * 86_400_000,
    to = Date.now()
): Promise<ShowcaseAnalyticsSummary> {
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    const db = await getServerDatabaseReady();
    const where = and(gte(showcaseEvents.createdAt, new Date(start)), lte(showcaseEvents.createdAt, new Date(end)));
    const [eventRows, topicRows, caseRows, totalRows] = await Promise.all([
        db
            .select({ event: showcaseEvents.eventName, count: count() })
            .from(showcaseEvents)
            .where(where)
            .groupBy(showcaseEvents.eventName),
        db
            .select({ topicId: showcaseEvents.topicId, event: showcaseEvents.eventName, count: count() })
            .from(showcaseEvents)
            .where(where)
            .groupBy(showcaseEvents.topicId, showcaseEvents.eventName),
        db
            .select({
                topicId: showcaseEvents.topicId,
                caseId: showcaseEvents.caseId,
                event: showcaseEvents.eventName,
                count: count()
            })
            .from(showcaseEvents)
            .where(and(where, sql`${showcaseEvents.caseId} IS NOT NULL`))
            .groupBy(showcaseEvents.topicId, showcaseEvents.caseId, showcaseEvents.eventName),
        db.select({ count: count() }).from(showcaseEvents).where(where)
    ]);
    return {
        from: start,
        to: end,
        total: Number(totalRows[0]?.count ?? 0),
        events: eventRows.map((row) => ({ event: row.event, count: Number(row.count) })),
        topics: topicRows.map((row) => ({ topicId: row.topicId, event: row.event, count: Number(row.count) })),
        cases: caseRows
            .filter((row): row is typeof row & { caseId: string } => typeof row.caseId === 'string')
            .map((row) => ({ topicId: row.topicId, caseId: row.caseId, event: row.event, count: Number(row.count) }))
    };
}
