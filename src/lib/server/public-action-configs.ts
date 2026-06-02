import { normalizePublicActionButtonLabel } from '@/lib/public-runtime-config';
import type { PublicApiKeyPurchaseCta, PublicRuntimeConfig } from '@/lib/public-runtime-config';
import { validatePublicHttpBaseUrl } from '@/lib/server-url-safety';
import { recordAuditLog } from '@/lib/server/audit';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { adminPublicActionConfigs, type PublicActionConfigKind } from '@/lib/server/schema';
import { randomToken, sanitizePlainText } from '@/lib/server/security';
import { and, asc, desc, eq } from 'drizzle-orm';

export const API_KEY_PURCHASE_PUBLIC_ACTION_KIND: PublicActionConfigKind = 'api_key_purchase';

export type PublicActionConfigRecord = typeof adminPublicActionConfigs.$inferSelect;

export type PublicActionConfigCreateInput = {
    kind?: PublicActionConfigKind;
    name: string;
    buttonLabel: string;
    targetUrl: string;
    enabled?: boolean;
    active?: boolean;
    description?: string | null;
    sortOrder?: number;
};

export type PublicActionConfigUpdateInput = Partial<Omit<PublicActionConfigCreateInput, 'kind'>>;

export type PublicActionAdminActor = {
    userId: string;
    email: string;
    role: string;
    request: Request;
};

const NAME_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;
const URL_MAX_LENGTH = 2048;

function normalizeName(value: string): string {
    const normalized = sanitizePlainText(value || '');
    if (!normalized) throw new Error('名称不能为空。');
    if (normalized.length > NAME_MAX_LENGTH) throw new Error(`名称不能超过 ${NAME_MAX_LENGTH} 个字符。`);
    return normalized;
}

function normalizeDescription(value: string | null | undefined): string | null {
    const normalized = sanitizePlainText(value || '');
    if (!normalized) return null;
    if (normalized.length > DESCRIPTION_MAX_LENGTH) {
        throw new Error(`后台备注不能超过 ${DESCRIPTION_MAX_LENGTH} 个字符。`);
    }
    return normalized;
}

export function normalizePublicActionLabelForStorage(value: string): string {
    const normalized = normalizePublicActionButtonLabel(value);
    if (!normalized) {
        throw new Error('按钮文本需为 2 到 32 个字符，且不能包含换行或 HTML。');
    }
    return normalized;
}

export function normalizePublicActionTargetUrlForStorage(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new Error('URL 不能为空。');
    if (trimmed.length > URL_MAX_LENGTH) throw new Error(`URL 不能超过 ${URL_MAX_LENGTH} 个字符。`);

    const validation = validatePublicHttpBaseUrl(trimmed);
    if (!validation.ok) {
        throw new Error(validation.reason.replace(/^Base URL/u, 'URL'));
    }
    if (process.env.NODE_ENV === 'production' && new URL(validation.normalizedUrl).protocol !== 'https:') {
        throw new Error('生产环境只允许保存 https URL。');
    }
    return validation.normalizedUrl;
}

function normalizeSortOrder(value: number | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(-1_000_000, Math.min(1_000_000, Math.trunc(parsed)));
}

function normalizeKind(value: PublicActionConfigKind | undefined): PublicActionConfigKind {
    return value === API_KEY_PURCHASE_PUBLIC_ACTION_KIND ? value : API_KEY_PURCHASE_PUBLIC_ACTION_KIND;
}

function getRequestIp(request: Request): string | null {
    return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
}

function getUrlHost(value: string): string {
    try {
        return new URL(value).host;
    } catch {
        return '';
    }
}

function summarizeConfig(record: PublicActionConfigRecord | null): Record<string, unknown> | null {
    if (!record) return null;
    return {
        name: record.name,
        buttonLabel: record.buttonLabel,
        urlHost: getUrlHost(record.targetUrl),
        enabled: record.enabled,
        active: record.active,
        sortOrder: record.sortOrder
    };
}

async function writePublicActionAudit(
    actor: PublicActionAdminActor,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    await recordAuditLog({
        actorUserId: actor.userId,
        actorType: 'user',
        action,
        targetType: 'admin_public_action_config',
        targetId,
        ip: getRequestIp(actor.request),
        userAgent: actor.request.headers.get('user-agent'),
        metadata
    });
}

async function getPublicActionConfigById(id: string): Promise<PublicActionConfigRecord | null> {
    const db = await getServerDatabaseReady();
    const [record] = await db
        .select()
        .from(adminPublicActionConfigs)
        .where(eq(adminPublicActionConfigs.id, sanitizePlainText(id)))
        .limit(1);
    return record || null;
}

function runConfigInsert(values: {
    id: string;
    kind: PublicActionConfigKind;
    name: string;
    buttonLabel: string;
    targetUrl: string;
    enabled: boolean;
    active: boolean;
    description: string | null;
    sortOrder: number;
    updatedByUserId: string;
}): void {
    const client = getSqliteClient();
    const now = Date.now();
    client.transaction(() => {
        if (values.active) {
            client
                .prepare(
                    `UPDATE "admin_public_action_configs"
                 SET "active" = 0, "updatedAt" = ?, "updatedByUserId" = ?
                 WHERE "kind" = ?;`
                )
                .run(now, values.updatedByUserId, values.kind);
        }
        client
            .prepare(
                `INSERT INTO "admin_public_action_configs"
             ("id", "kind", "name", "buttonLabel", "targetUrl", "enabled", "active", "description", "sortOrder", "createdAt", "updatedAt", "updatedByUserId")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
            )
            .run(
                values.id,
                values.kind,
                values.name,
                values.buttonLabel,
                values.targetUrl,
                values.enabled ? 1 : 0,
                values.active ? 1 : 0,
                values.description,
                values.sortOrder,
                now,
                now,
                values.updatedByUserId
            );
    })();
}

function runConfigUpdate(
    current: PublicActionConfigRecord,
    values: {
        name: string;
        buttonLabel: string;
        targetUrl: string;
        enabled: boolean;
        active: boolean;
        description: string | null;
        sortOrder: number;
        updatedByUserId: string;
    }
): void {
    const client = getSqliteClient();
    const now = Date.now();
    client.transaction(() => {
        if (values.active) {
            client
                .prepare(
                    `UPDATE "admin_public_action_configs"
                 SET "active" = 0, "updatedAt" = ?, "updatedByUserId" = ?
                 WHERE "kind" = ? AND "id" <> ?;`
                )
                .run(now, values.updatedByUserId, current.kind, current.id);
        }
        client
            .prepare(
                `UPDATE "admin_public_action_configs"
             SET "name" = ?, "buttonLabel" = ?, "targetUrl" = ?, "enabled" = ?, "active" = ?,
                 "description" = ?, "sortOrder" = ?, "updatedAt" = ?, "updatedByUserId" = ?
             WHERE "id" = ?;`
            )
            .run(
                values.name,
                values.buttonLabel,
                values.targetUrl,
                values.enabled ? 1 : 0,
                values.active ? 1 : 0,
                values.description,
                values.sortOrder,
                now,
                values.updatedByUserId,
                current.id
            );
    })();
}

export async function listPublicActionConfigsAdmin(
    kind: PublicActionConfigKind = API_KEY_PURCHASE_PUBLIC_ACTION_KIND
): Promise<PublicActionConfigRecord[]> {
    const db = await getServerDatabaseReady();
    return db
        .select()
        .from(adminPublicActionConfigs)
        .where(eq(adminPublicActionConfigs.kind, kind))
        .orderBy(
            desc(adminPublicActionConfigs.active),
            desc(adminPublicActionConfigs.enabled),
            asc(adminPublicActionConfigs.sortOrder),
            desc(adminPublicActionConfigs.updatedAt)
        );
}

export async function createPublicActionConfigAdmin(
    input: PublicActionConfigCreateInput,
    actor: PublicActionAdminActor
): Promise<PublicActionConfigRecord> {
    await getServerDatabaseReady();
    const kind = normalizeKind(input.kind);
    const enabled = input.active ? true : (input.enabled ?? false);
    const active = enabled && input.active === true;
    const values = {
        id: randomToken(12),
        kind,
        name: normalizeName(input.name),
        buttonLabel: normalizePublicActionLabelForStorage(input.buttonLabel),
        targetUrl: normalizePublicActionTargetUrlForStorage(input.targetUrl),
        enabled,
        active,
        description: normalizeDescription(input.description),
        sortOrder: normalizeSortOrder(input.sortOrder),
        updatedByUserId: actor.userId
    };

    runConfigInsert(values);
    const created = await getPublicActionConfigById(values.id);
    if (!created) throw new Error('购买入口创建失败。');

    await writePublicActionAudit(
        actor,
        active ? 'public_action_config_create_active' : 'public_action_config_create',
        created.id,
        {
            after: summarizeConfig(created)
        }
    );
    return created;
}

export async function updatePublicActionConfigAdmin(
    id: string,
    input: PublicActionConfigUpdateInput,
    actor: PublicActionAdminActor
): Promise<PublicActionConfigRecord | null> {
    await getServerDatabaseReady();
    const current = await getPublicActionConfigById(id);
    if (!current) return null;

    const requestedEnabled = input.active ? true : (input.enabled ?? current.enabled);
    const requestedActive =
        input.enabled === false ? false : input.active !== undefined ? input.active === true : current.active;
    const active = requestedEnabled && requestedActive;
    const values = {
        name: input.name !== undefined ? normalizeName(input.name) : current.name,
        buttonLabel:
            input.buttonLabel !== undefined
                ? normalizePublicActionLabelForStorage(input.buttonLabel)
                : current.buttonLabel,
        targetUrl:
            input.targetUrl !== undefined
                ? normalizePublicActionTargetUrlForStorage(input.targetUrl)
                : current.targetUrl,
        enabled: requestedEnabled,
        active,
        description: input.description !== undefined ? normalizeDescription(input.description) : current.description,
        sortOrder: input.sortOrder !== undefined ? normalizeSortOrder(input.sortOrder) : current.sortOrder,
        updatedByUserId: actor.userId
    };

    runConfigUpdate(current, values);
    const updated = await getPublicActionConfigById(current.id);
    if (!updated) return null;

    const action =
        active && !current.active
            ? 'public_action_config_activate'
            : !active && current.active
              ? 'public_action_config_deactivate'
              : 'public_action_config_update';
    await writePublicActionAudit(actor, action, updated.id, {
        before: summarizeConfig(current),
        after: summarizeConfig(updated)
    });
    return updated;
}

export async function deletePublicActionConfigAdmin(id: string, actor: PublicActionAdminActor): Promise<boolean> {
    await getServerDatabaseReady();
    const current = await getPublicActionConfigById(id);
    if (!current) return false;
    const client = getSqliteClient();
    client.prepare(`DELETE FROM "admin_public_action_configs" WHERE "id" = ?;`).run(current.id);
    await writePublicActionAudit(actor, 'public_action_config_delete', current.id, {
        before: summarizeConfig(current)
    });
    return true;
}

export async function getPublicApiKeyPurchaseCta(): Promise<PublicApiKeyPurchaseCta | null> {
    const db = await getServerDatabaseReady();
    const [record] = await db
        .select()
        .from(adminPublicActionConfigs)
        .where(
            and(
                eq(adminPublicActionConfigs.kind, API_KEY_PURCHASE_PUBLIC_ACTION_KIND),
                eq(adminPublicActionConfigs.enabled, true),
                eq(adminPublicActionConfigs.active, true)
            )
        )
        .orderBy(desc(adminPublicActionConfigs.updatedAt))
        .limit(1);

    if (!record) return null;
    try {
        return {
            label: normalizePublicActionLabelForStorage(record.buttonLabel),
            url: normalizePublicActionTargetUrlForStorage(record.targetUrl)
        };
    } catch {
        return null;
    }
}

export async function getPublicRuntimeConfig(): Promise<PublicRuntimeConfig> {
    return {
        apiKeyPurchaseCta: await getPublicApiKeyPurchaseCta()
    };
}
