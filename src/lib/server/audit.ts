import { count, desc, type InferSelectModel } from 'drizzle-orm';
import { auditLogs } from '@/lib/server/schema';
import { getServerDatabaseReady } from '@/lib/server/db';
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
    return created;
}

export async function listAuditLogs(limit = 50): Promise<AuditLog[]> {
    const db = await getServerDatabaseReady();
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function countAuditLogs(): Promise<number> {
    const db = await getServerDatabaseReady();
    const rows = await db.select({ count: count() }).from(auditLogs);
    return Number(rows[0]?.count || 0);
}
