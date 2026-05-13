import { createHash, timingSafeEqual } from 'node:crypto';
import { and, count, desc, eq, type InferSelectModel, type SQL } from 'drizzle-orm';
import { auditLogs } from '@/lib/server/schema';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { randomToken, sanitizePlainText } from '@/lib/server/security';

export type AuditLog = InferSelectModel<typeof auditLogs>;

export type AuditLogInput = {
    actorUserId?: string | null;
    actorType: string;
    action: string;
    targetType: string;
    targetId: string;
    ip?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
};

export type AuditLogListOptions = {
    page?: number;
    pageSize?: number;
    action?: string | null;
    targetType?: string | null;
};

export type AuditLogPage = {
    logs: AuditLog[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

const DEFAULT_AUDIT_LOG_MAX_ROWS = 5000;
const MAX_AUDIT_LOG_PAGE_SIZE = 100;

function normalizePage(value: number | null | undefined): number {
    return Math.max(1, Math.floor(Number.isFinite(value) ? Number(value) : 1));
}

function normalizePageSize(value: number | null | undefined): number {
    return Math.max(10, Math.min(MAX_AUDIT_LOG_PAGE_SIZE, Math.floor(Number.isFinite(value) ? Number(value) : 25)));
}

function buildAuditWhere(options: AuditLogListOptions): SQL | undefined {
    const conditions: SQL[] = [];
    const action = options.action?.trim();
    const targetType = options.targetType?.trim();

    if (action && action !== 'all') conditions.push(eq(auditLogs.action, sanitizePlainText(action)));
    if (targetType && targetType !== 'all') conditions.push(eq(auditLogs.targetType, sanitizePlainText(targetType)));

    return conditions.length > 0 ? and(...conditions) : undefined;
}

export function getAuditLogMaxRows(): number {
    const configured = process.env.AUDIT_LOG_MAX_ROWS?.trim();
    if (!configured) return DEFAULT_AUDIT_LOG_MAX_ROWS;
    if (configured === '0' || configured.toLowerCase() === 'off' || configured.toLowerCase() === 'false') return 0;

    const parsed = Number(configured);
    if (!Number.isFinite(parsed)) return DEFAULT_AUDIT_LOG_MAX_ROWS;
    return Math.max(100, Math.min(500_000, Math.floor(parsed)));
}

export function isAuditLogMaintenanceKeyConfigured(): boolean {
    return Boolean(process.env.AUDIT_LOG_MAINTENANCE_KEY?.trim());
}

export function verifyAuditLogMaintenanceKey(input: string | null | undefined): boolean {
    const configured = process.env.AUDIT_LOG_MAINTENANCE_KEY?.trim();
    const provided = input?.trim();
    if (!configured || !provided) return false;

    const configuredHash = createHash('sha256').update(configured).digest('hex');
    const providedHash = createHash('sha256').update(provided).digest('hex');
    return timingSafeEqual(Buffer.from(configuredHash, 'hex'), Buffer.from(providedHash, 'hex'));
}

export async function pruneAuditLogsToMaxRows(maxRows = getAuditLogMaxRows()): Promise<number> {
    if (maxRows <= 0) return 0;

    await getServerDatabaseReady();
    const result = getSqliteClient()
        .prepare(
            `DELETE FROM "audit_logs"
             WHERE "id" IN (
                 SELECT "id" FROM "audit_logs"
                 ORDER BY "createdAt" DESC, "id" DESC
                 LIMIT -1 OFFSET ?
             );`
        )
        .run(maxRows);
    return result.changes;
}

export async function recordAuditLog(input: AuditLogInput): Promise<AuditLog> {
    const db = await getServerDatabaseReady();
    const row = {
        id: randomToken(16),
        actorUserId: input.actorUserId ?? null,
        actorType: sanitizePlainText(input.actorType),
        action: sanitizePlainText(input.action),
        targetType: sanitizePlainText(input.targetType),
        targetId: sanitizePlainText(input.targetId),
        ip: input.ip?.trim() || null,
        userAgent: input.userAgent?.trim() || null,
        metadataJson: JSON.stringify(input.metadata ?? {})
    };

    const [created] = await db.insert(auditLogs).values(row).returning();
    await pruneAuditLogsToMaxRows();
    return created;
}

export async function listAuditLogs(options: number | AuditLogListOptions = 50): Promise<AuditLog[]> {
    if (typeof options === 'number') {
        const page = await listAuditLogsPage({ page: 1, pageSize: options });
        return page.logs;
    }

    const page = await listAuditLogsPage(options);
    return page.logs;
}

export async function listAuditLogsPage(options: AuditLogListOptions = {}): Promise<AuditLogPage> {
    const db = await getServerDatabaseReady();
    const page = normalizePage(options.page);
    const pageSize = normalizePageSize(options.pageSize);
    const where = buildAuditWhere(options);
    const offset = (page - 1) * pageSize;

    const logsQuery = db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(pageSize)
        .offset(offset);
    const countQuery = db.select({ count: count() }).from(auditLogs).where(where);

    const [logs, rows] = await Promise.all([logsQuery, countQuery]);
    const total = Number(rows[0]?.count || 0);

    return {
        logs,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
}

export async function countAuditLogs(): Promise<number> {
    const db = await getServerDatabaseReady();
    const rows = await db.select({ count: count() }).from(auditLogs);
    return Number(rows[0]?.count || 0);
}

export async function deleteAuditLog(id: string): Promise<boolean> {
    const db = await getServerDatabaseReady();
    const [deleted] = await db.delete(auditLogs).where(eq(auditLogs.id, sanitizePlainText(id))).returning({ id: auditLogs.id });
    return Boolean(deleted);
}

export async function clearAuditLogs(): Promise<number> {
    const db = await getServerDatabaseReady();
    const total = await countAuditLogs();
    await db.delete(auditLogs);
    return total;
}
