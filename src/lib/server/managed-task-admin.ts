import {
    DEFAULT_MANAGED_TASK_HEALTH_CHECK_INTERVAL_SECONDS,
    MANAGED_TASK_P0_CAPABILITIES,
    normalizeManagedTaskBaseUrl,
    normalizeManagedTaskExecutionMode,
    normalizeManagedTaskFallbackMode,
    normalizeManagedTaskHealthCheckIntervalSeconds,
    normalizeManagedTaskHealthStatus,
    normalizeManagedTaskPolicyLimits,
    normalizeManagedTaskPolicyMatch,
    normalizeManagedTaskServiceAuthMode,
    type ManagedTaskCapabilitiesSummary,
    type ManagedTaskHealthSummary,
    type ManagedTaskResolutionInput,
    type ManagedTaskServiceConfig,
    type ManagedTaskTakeoverPolicy
} from '@/lib/managed-task-config';
import { validatePublicHttpBaseUrl } from '@/lib/server-url-safety';
import { recordAuditLog } from '@/lib/server/audit';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { managedTaskPolicies, managedTaskServices } from '@/lib/server/schema';
import { randomToken, sanitizePlainText } from '@/lib/server/security';
import { asc, count, desc, eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export type ManagedTaskAdminActor = {
    userId: string;
    email: string;
    role: string;
    request: Request;
};

export type ManagedTaskServiceAdminInput = {
    name: string;
    baseUrl: string;
    enabled?: boolean;
    authMode?: unknown;
    authToken?: string | null;
    clearAuthToken?: boolean;
    healthCheckEnabled?: boolean;
    healthCheckIntervalSeconds?: number;
};

export type ManagedTaskServiceAdminUpdateInput = Partial<ManagedTaskServiceAdminInput>;

export type ManagedTaskPolicyAdminInput = {
    name: string;
    enabled?: boolean;
    priority?: number;
    match?: unknown;
    mode?: unknown;
    taskServiceId?: string | null;
    fallbackMode?: unknown;
    limits?: unknown;
};

export type ManagedTaskPolicyAdminUpdateInput = Partial<ManagedTaskPolicyAdminInput>;

type ManagedTaskServiceRecord = typeof managedTaskServices.$inferSelect;
type ManagedTaskPolicyRecord = typeof managedTaskPolicies.$inferSelect;

const SERVICE_NAME_MAX_LENGTH = 120;
const POLICY_NAME_MAX_LENGTH = 120;
const TOKEN_PREFIX_LENGTH = 8;
const TOKEN_CIPHER_VERSION = 'v1';

function getRequestIp(request: Request): string | null {
    return request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function normalizeName(value: string | undefined, maxLength: number, label: string): string {
    const normalized = sanitizePlainText(value || '');
    if (!normalized) throw new Error(`${label}不能为空。`);
    if (normalized.length > maxLength) throw new Error(`${label}不能超过 ${maxLength} 个字符。`);
    return normalized;
}

export function normalizeManagedTaskServiceBaseUrlForStorage(value: string): string {
    const normalized = normalizeManagedTaskBaseUrl(value);
    if (!normalized) throw new Error('任务服务 URL 不能为空。');
    const validation = validatePublicHttpBaseUrl(normalized);
    if (!validation.ok) {
        throw new Error(validation.reason.replace(/^Base URL/u, '任务服务 URL'));
    }
    if (process.env.NODE_ENV === 'production' && new URL(validation.normalizedUrl).protocol !== 'https:') {
        throw new Error('生产环境只允许保存 https 任务服务 URL。');
    }
    return validation.normalizedUrl;
}

function normalizePriority(value: number | null | undefined): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(-1_000_000, Math.min(1_000_000, Math.trunc(parsed)));
}

function normalizeTaskServiceId(value: string | null | undefined): string | null {
    const normalized = sanitizePlainText(value || '');
    return normalized || null;
}

function getUrlHost(value: string): string {
    try {
        return new URL(value).host;
    } catch {
        return '';
    }
}

function getEncryptionSecret(): string {
    const configured =
        process.env.MANAGED_TASK_CONFIG_SECRET?.trim() ||
        process.env.BETTER_AUTH_SECRET?.trim() ||
        process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
    if (!configured) {
        throw new Error('缺少 MANAGED_TASK_CONFIG_SECRET 或 BETTER_AUTH_SECRET，无法保存任务服务鉴权 Token。');
    }
    return configured;
}

function getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(getEncryptionSecret()).digest();
}

function encryptAuthToken(token: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    cipher.setAAD(Buffer.from('managed-task-service-auth-token'));
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        TOKEN_CIPHER_VERSION,
        iv.toString('base64url'),
        tag.toString('base64url'),
        ciphertext.toString('base64url')
    ].join(':');
}

function decryptAuthToken(ciphertext: string | null): string | null {
    if (!ciphertext) return null;
    const [version, ivValue, tagValue, encryptedValue] = ciphertext.split(':');
    if (version !== TOKEN_CIPHER_VERSION || !ivValue || !tagValue || !encryptedValue) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAAD(Buffer.from('managed-task-service-auth-token'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString(
        'utf8'
    );
}

function toTokenPrefix(token: string): string {
    const trimmed = token.trim();
    return trimmed.length <= TOKEN_PREFIX_LENGTH ? trimmed : trimmed.slice(0, TOKEN_PREFIX_LENGTH);
}

function summarizeService(record: ManagedTaskServiceRecord | null): Record<string, unknown> | null {
    if (!record) return null;
    return {
        name: record.name,
        urlHost: getUrlHost(record.baseUrl),
        enabled: record.enabled,
        authMode: record.authMode,
        authTokenConfigured: Boolean(record.authTokenCiphertext),
        healthStatus: record.healthStatus,
        healthCheckEnabled: record.healthCheckEnabled
    };
}

function summarizePolicy(record: ManagedTaskPolicyRecord | null): Record<string, unknown> | null {
    if (!record) return null;
    const match = normalizeManagedTaskPolicyMatch(parseJsonObject(record.matchJson));
    return {
        name: record.name,
        enabled: record.enabled,
        priority: record.priority,
        mode: record.mode,
        taskServiceId: record.taskServiceId,
        fallbackMode: record.fallbackMode,
        matchCounts: {
            providerEndpointIds: match.providerEndpointIds.length,
            normalizedBaseUrls: match.normalizedBaseUrls.length,
            providerKinds: match.providerKinds.length,
            providerProtocols: match.providerProtocols.length,
            modelCatalogEntryIds: match.modelCatalogEntryIds.length,
            taskCapabilities: match.taskCapabilities
        }
    };
}

async function writeManagedTaskAudit(
    actor: ManagedTaskAdminActor,
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    await recordAuditLog({
        actorUserId: actor.userId,
        actorType: 'user',
        action,
        targetType,
        targetId,
        ip: getRequestIp(actor.request),
        userAgent: actor.request.headers.get('user-agent'),
        metadata
    });
}

function serviceRecordToDto(
    record: ManagedTaskServiceRecord
): ManagedTaskServiceConfig & { authTokenPrefix?: string | null } {
    const healthSummary = parseJsonObject(record.healthSummaryJson) as ManagedTaskHealthSummary;
    const capabilitiesSummary = parseJsonObject(record.capabilitiesSummaryJson) as ManagedTaskCapabilitiesSummary;
    return {
        id: record.id,
        name: record.name,
        baseUrl: record.baseUrl,
        enabled: record.enabled,
        authMode: normalizeManagedTaskServiceAuthMode(record.authMode),
        authTokenConfigured: Boolean(record.authTokenCiphertext),
        authTokenPrefix: record.authTokenPrefix,
        healthCheckEnabled: record.healthCheckEnabled,
        healthCheckIntervalSeconds: normalizeManagedTaskHealthCheckIntervalSeconds(record.healthCheckIntervalSeconds),
        healthStatus: normalizeManagedTaskHealthStatus(record.healthStatus),
        lastCheckedAt: record.lastCheckedAt ? Number(record.lastCheckedAt) : null,
        healthSummary: Object.keys(healthSummary).length > 0 ? healthSummary : null,
        capabilitiesSummary: Object.keys(capabilitiesSummary).length > 0 ? capabilitiesSummary : null,
        createdAt: Number(record.createdAt),
        updatedAt: Number(record.updatedAt),
        updatedByUserId: record.updatedByUserId
    };
}

function policyRecordToDto(record: ManagedTaskPolicyRecord): ManagedTaskTakeoverPolicy {
    return {
        id: record.id,
        name: record.name,
        enabled: record.enabled,
        priority: record.priority,
        match: normalizeManagedTaskPolicyMatch(parseJsonObject(record.matchJson)),
        mode: normalizeManagedTaskExecutionMode(record.mode),
        taskServiceId: record.taskServiceId,
        fallbackMode: normalizeManagedTaskFallbackMode(record.fallbackMode),
        limits: normalizeManagedTaskPolicyLimits(parseJsonObject(record.limitsJson)),
        createdAt: Number(record.createdAt),
        updatedAt: Number(record.updatedAt),
        updatedByUserId: record.updatedByUserId
    };
}

async function getServiceRecordById(id: string): Promise<ManagedTaskServiceRecord | null> {
    const db = await getServerDatabaseReady();
    const [record] = await db
        .select()
        .from(managedTaskServices)
        .where(eq(managedTaskServices.id, sanitizePlainText(id)))
        .limit(1);
    return record || null;
}

async function getPolicyRecordById(id: string): Promise<ManagedTaskPolicyRecord | null> {
    const db = await getServerDatabaseReady();
    const [record] = await db
        .select()
        .from(managedTaskPolicies)
        .where(eq(managedTaskPolicies.id, sanitizePlainText(id)))
        .limit(1);
    return record || null;
}

export async function listManagedTaskServicesAdmin(): Promise<
    Array<ManagedTaskServiceConfig & { authTokenPrefix?: string | null }>
> {
    const db = await getServerDatabaseReady();
    const rows = await db
        .select()
        .from(managedTaskServices)
        .orderBy(desc(managedTaskServices.enabled), asc(managedTaskServices.name), desc(managedTaskServices.updatedAt));
    return rows.map(serviceRecordToDto);
}

export async function listManagedTaskPoliciesAdmin(): Promise<ManagedTaskTakeoverPolicy[]> {
    const db = await getServerDatabaseReady();
    const rows = await db
        .select()
        .from(managedTaskPolicies)
        .orderBy(desc(managedTaskPolicies.enabled), desc(managedTaskPolicies.priority), asc(managedTaskPolicies.name));
    return rows.map(policyRecordToDto);
}

export async function createManagedTaskServiceAdmin(
    input: ManagedTaskServiceAdminInput,
    actor: ManagedTaskAdminActor
): Promise<ManagedTaskServiceConfig & { authTokenPrefix?: string | null }> {
    await getServerDatabaseReady();
    const authMode = normalizeManagedTaskServiceAuthMode(input.authMode);
    const authToken = input.authToken?.trim() || '';
    const tokenCiphertext = authMode === 'bearer' && authToken ? encryptAuthToken(authToken) : null;
    const tokenPrefix = authMode === 'bearer' && authToken ? toTokenPrefix(authToken) : null;
    const now = Date.now();
    const values = {
        id: randomToken(12),
        name: normalizeName(input.name, SERVICE_NAME_MAX_LENGTH, '任务服务名称'),
        baseUrl: normalizeManagedTaskServiceBaseUrlForStorage(input.baseUrl),
        enabled: input.enabled === true,
        authMode,
        authTokenCiphertext: tokenCiphertext,
        authTokenPrefix: tokenPrefix,
        healthCheckEnabled: input.healthCheckEnabled !== false,
        healthCheckIntervalSeconds: normalizeManagedTaskHealthCheckIntervalSeconds(
            input.healthCheckIntervalSeconds ?? DEFAULT_MANAGED_TASK_HEALTH_CHECK_INTERVAL_SECONDS
        ),
        healthStatus: 'unknown' as const,
        updatedByUserId: actor.userId,
        createdAt: now,
        updatedAt: now
    };

    await getServerDatabaseReady();
    getSqliteClient()
        .prepare(
            `INSERT INTO "managed_task_services"
             ("id", "name", "baseUrl", "enabled", "authMode", "authTokenCiphertext", "authTokenPrefix",
              "healthCheckEnabled", "healthCheckIntervalSeconds", "healthStatus", "healthSummaryJson",
              "capabilitiesSummaryJson", "createdAt", "updatedAt", "updatedByUserId")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', '{}', ?, ?, ?);`
        )
        .run(
            values.id,
            values.name,
            values.baseUrl,
            values.enabled ? 1 : 0,
            values.authMode,
            values.authTokenCiphertext,
            values.authTokenPrefix,
            values.healthCheckEnabled ? 1 : 0,
            values.healthCheckIntervalSeconds,
            values.healthStatus,
            values.createdAt,
            values.updatedAt,
            values.updatedByUserId
        );

    const created = await getServiceRecordById(values.id);
    if (!created) throw new Error('任务服务配置创建失败。');
    await writeManagedTaskAudit(actor, 'managed_task_service_create', 'managed_task_service', created.id, {
        after: summarizeService(created)
    });
    return serviceRecordToDto(created);
}

export async function updateManagedTaskServiceAdmin(
    id: string,
    input: ManagedTaskServiceAdminUpdateInput,
    actor: ManagedTaskAdminActor
): Promise<(ManagedTaskServiceConfig & { authTokenPrefix?: string | null }) | null> {
    await getServerDatabaseReady();
    const current = await getServiceRecordById(id);
    if (!current) return null;

    const authMode =
        input.authMode !== undefined ? normalizeManagedTaskServiceAuthMode(input.authMode) : current.authMode;
    const authToken = input.authToken?.trim() || '';
    const shouldClearToken = input.clearAuthToken === true || authMode === 'none';
    const nextCiphertext = shouldClearToken
        ? null
        : authToken
          ? encryptAuthToken(authToken)
          : current.authTokenCiphertext;
    const nextPrefix = shouldClearToken ? null : authToken ? toTokenPrefix(authToken) : current.authTokenPrefix;
    const now = Date.now();
    const values = {
        name:
            input.name !== undefined
                ? normalizeName(input.name, SERVICE_NAME_MAX_LENGTH, '任务服务名称')
                : current.name,
        baseUrl:
            input.baseUrl !== undefined ? normalizeManagedTaskServiceBaseUrlForStorage(input.baseUrl) : current.baseUrl,
        enabled: input.enabled ?? current.enabled,
        authMode,
        authTokenCiphertext: nextCiphertext,
        authTokenPrefix: nextPrefix,
        healthCheckEnabled: input.healthCheckEnabled ?? current.healthCheckEnabled,
        healthCheckIntervalSeconds:
            input.healthCheckIntervalSeconds !== undefined
                ? normalizeManagedTaskHealthCheckIntervalSeconds(input.healthCheckIntervalSeconds)
                : current.healthCheckIntervalSeconds,
        updatedAt: now,
        updatedByUserId: actor.userId
    };

    getSqliteClient()
        .prepare(
            `UPDATE "managed_task_services"
             SET "name" = ?, "baseUrl" = ?, "enabled" = ?, "authMode" = ?, "authTokenCiphertext" = ?,
                 "authTokenPrefix" = ?, "healthCheckEnabled" = ?, "healthCheckIntervalSeconds" = ?,
                 "updatedAt" = ?, "updatedByUserId" = ?
             WHERE "id" = ?;`
        )
        .run(
            values.name,
            values.baseUrl,
            values.enabled ? 1 : 0,
            values.authMode,
            values.authTokenCiphertext,
            values.authTokenPrefix,
            values.healthCheckEnabled ? 1 : 0,
            values.healthCheckIntervalSeconds,
            values.updatedAt,
            values.updatedByUserId,
            current.id
        );

    const updated = await getServiceRecordById(current.id);
    if (!updated) return null;
    await writeManagedTaskAudit(actor, 'managed_task_service_update', 'managed_task_service', updated.id, {
        before: summarizeService(current),
        after: summarizeService(updated),
        authTokenChanged: Boolean(authToken || shouldClearToken)
    });
    return serviceRecordToDto(updated);
}

export async function deleteManagedTaskServiceAdmin(id: string, actor: ManagedTaskAdminActor): Promise<boolean> {
    await getServerDatabaseReady();
    const current = await getServiceRecordById(id);
    if (!current) return false;
    getSqliteClient().transaction(() => {
        getSqliteClient()
            .prepare(
                `UPDATE "managed_task_policies" SET "taskServiceId" = NULL, "updatedAt" = ? WHERE "taskServiceId" = ?;`
            )
            .run(Date.now(), current.id);
        getSqliteClient().prepare(`DELETE FROM "managed_task_services" WHERE "id" = ?;`).run(current.id);
    })();
    await writeManagedTaskAudit(actor, 'managed_task_service_delete', 'managed_task_service', current.id, {
        before: summarizeService(current)
    });
    return true;
}

export async function createManagedTaskPolicyAdmin(
    input: ManagedTaskPolicyAdminInput,
    actor: ManagedTaskAdminActor
): Promise<ManagedTaskTakeoverPolicy> {
    await getServerDatabaseReady();
    const match = normalizeManagedTaskPolicyMatch(input.match);
    const limits = normalizeManagedTaskPolicyLimits(input.limits);
    const mode = normalizeManagedTaskExecutionMode(input.mode);
    const serviceId = normalizeTaskServiceId(input.taskServiceId);
    if (mode === 'managed-task' && !serviceId) throw new Error('managed-task 策略必须选择任务服务。');
    const now = Date.now();
    const values = {
        id: randomToken(12),
        name: normalizeName(input.name, POLICY_NAME_MAX_LENGTH, '接管策略名称'),
        enabled: input.enabled === true,
        priority: normalizePriority(input.priority),
        matchJson: JSON.stringify(match),
        mode,
        taskServiceId: serviceId,
        fallbackMode: normalizeManagedTaskFallbackMode(input.fallbackMode),
        limitsJson: JSON.stringify(limits),
        updatedByUserId: actor.userId,
        createdAt: now,
        updatedAt: now
    };

    getSqliteClient()
        .prepare(
            `INSERT INTO "managed_task_policies"
             ("id", "name", "enabled", "priority", "matchJson", "mode", "taskServiceId", "fallbackMode",
              "limitsJson", "createdAt", "updatedAt", "updatedByUserId")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
            values.id,
            values.name,
            values.enabled ? 1 : 0,
            values.priority,
            values.matchJson,
            values.mode,
            values.taskServiceId,
            values.fallbackMode,
            values.limitsJson,
            values.createdAt,
            values.updatedAt,
            values.updatedByUserId
        );

    const created = await getPolicyRecordById(values.id);
    if (!created) throw new Error('接管策略创建失败。');
    await writeManagedTaskAudit(actor, 'managed_task_policy_create', 'managed_task_policy', created.id, {
        after: summarizePolicy(created)
    });
    return policyRecordToDto(created);
}

export async function updateManagedTaskPolicyAdmin(
    id: string,
    input: ManagedTaskPolicyAdminUpdateInput,
    actor: ManagedTaskAdminActor
): Promise<ManagedTaskTakeoverPolicy | null> {
    await getServerDatabaseReady();
    const current = await getPolicyRecordById(id);
    if (!current) return null;
    const mode = input.mode !== undefined ? normalizeManagedTaskExecutionMode(input.mode) : current.mode;
    const serviceId =
        input.taskServiceId !== undefined ? normalizeTaskServiceId(input.taskServiceId) : current.taskServiceId;
    if (mode === 'managed-task' && !serviceId) throw new Error('managed-task 策略必须选择任务服务。');
    const match =
        input.match !== undefined
            ? normalizeManagedTaskPolicyMatch(input.match)
            : normalizeManagedTaskPolicyMatch(parseJsonObject(current.matchJson));
    const limits =
        input.limits !== undefined
            ? normalizeManagedTaskPolicyLimits(input.limits)
            : normalizeManagedTaskPolicyLimits(parseJsonObject(current.limitsJson));
    const now = Date.now();

    getSqliteClient()
        .prepare(
            `UPDATE "managed_task_policies"
             SET "name" = ?, "enabled" = ?, "priority" = ?, "matchJson" = ?, "mode" = ?, "taskServiceId" = ?,
                 "fallbackMode" = ?, "limitsJson" = ?, "updatedAt" = ?, "updatedByUserId" = ?
             WHERE "id" = ?;`
        )
        .run(
            input.name !== undefined ? normalizeName(input.name, POLICY_NAME_MAX_LENGTH, '接管策略名称') : current.name,
            (input.enabled ?? current.enabled) ? 1 : 0,
            input.priority !== undefined ? normalizePriority(input.priority) : current.priority,
            JSON.stringify(match),
            mode,
            serviceId,
            input.fallbackMode !== undefined
                ? normalizeManagedTaskFallbackMode(input.fallbackMode)
                : current.fallbackMode,
            JSON.stringify(limits),
            now,
            actor.userId,
            current.id
        );

    const updated = await getPolicyRecordById(current.id);
    if (!updated) return null;
    await writeManagedTaskAudit(actor, 'managed_task_policy_update', 'managed_task_policy', updated.id, {
        before: summarizePolicy(current),
        after: summarizePolicy(updated)
    });
    return policyRecordToDto(updated);
}

export async function deleteManagedTaskPolicyAdmin(id: string, actor: ManagedTaskAdminActor): Promise<boolean> {
    await getServerDatabaseReady();
    const current = await getPolicyRecordById(id);
    if (!current) return false;
    getSqliteClient().prepare(`DELETE FROM "managed_task_policies" WHERE "id" = ?;`).run(current.id);
    await writeManagedTaskAudit(actor, 'managed_task_policy_delete', 'managed_task_policy', current.id, {
        before: summarizePolicy(current)
    });
    return true;
}

async function fetchTaskServiceJson(
    service: ManagedTaskServiceRecord,
    pathname: string,
    token: string | null
): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = `${service.baseUrl.replace(/\/+$/u, '')}${pathname}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: token ? { authorization: `Bearer ${token}` } : undefined,
            signal: controller.signal,
            cache: 'no-store'
        });
        const payload = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as Record<string, unknown>)
            : {};
    } finally {
        clearTimeout(timer);
    }
}

function normalizeHealthPayload(
    payload: Record<string, unknown>,
    fallbackStatus: ManagedTaskHealthSummary['status']
): ManagedTaskHealthSummary {
    const dependencies = Array.isArray(payload.dependencies)
        ? payload.dependencies
              .filter(
                  (item): item is Record<string, unknown> => item && typeof item === 'object' && !Array.isArray(item)
              )
              .map((item) => ({
                  name: typeof item.name === 'string' ? item.name : 'unknown',
                  status: typeof item.status === 'string' ? item.status : 'unknown',
                  safeMessage: typeof item.safeMessage === 'string' ? item.safeMessage : undefined
              }))
        : undefined;
    return {
        status:
            normalizeManagedTaskHealthStatus(payload.status) === 'unknown'
                ? fallbackStatus
                : normalizeManagedTaskHealthStatus(payload.status),
        version: typeof payload.version === 'string' ? payload.version : undefined,
        schemaVersion: typeof payload.schemaVersion === 'string' ? payload.schemaVersion : undefined,
        checkedAt: typeof payload.checkedAt === 'string' ? payload.checkedAt : undefined,
        dependencies,
        safeMessage: typeof payload.safeMessage === 'string' ? payload.safeMessage : undefined
    };
}

function normalizeCapabilitiesPayload(payload: Record<string, unknown>): ManagedTaskCapabilitiesSummary {
    const storage =
        payload.storage && typeof payload.storage === 'object' && !Array.isArray(payload.storage)
            ? (payload.storage as Record<string, unknown>)
            : {};
    const events =
        payload.events && typeof payload.events === 'object' && !Array.isArray(payload.events)
            ? (payload.events as Record<string, unknown>)
            : {};
    const limits =
        payload.limits && typeof payload.limits === 'object' && !Array.isArray(payload.limits)
            ? (payload.limits as Record<string, unknown>)
            : {};
    const retryPolicy =
        payload.retryPolicy && typeof payload.retryPolicy === 'object' && !Array.isArray(payload.retryPolicy)
            ? (payload.retryPolicy as Record<string, unknown>)
            : {};
    return {
        schemaVersion: typeof payload.schemaVersion === 'string' ? payload.schemaVersion : undefined,
        serviceVersion: typeof payload.serviceVersion === 'string' ? payload.serviceVersion : undefined,
        taskTypes: Array.isArray(payload.taskTypes)
            ? payload.taskTypes.filter((item): item is string => typeof item === 'string')
            : [],
        credentialModes: Array.isArray(payload.credentialModes)
            ? payload.credentialModes.filter((item): item is string => typeof item === 'string')
            : [],
        storage: {
            primary: typeof storage.primary === 'string' ? storage.primary : undefined,
            s3CompatibleAvailable: storage.s3CompatibleAvailable === true,
            maxInputAssetBytes: typeof storage.maxInputAssetBytes === 'number' ? storage.maxInputAssetBytes : undefined,
            maxOutputAssetBytes:
                typeof storage.maxOutputAssetBytes === 'number' ? storage.maxOutputAssetBytes : undefined,
            defaultRetentionHours:
                typeof storage.defaultRetentionHours === 'number' ? storage.defaultRetentionHours : undefined
        },
        events: {
            sse: events.sse === true,
            batchPolling: events.batchPolling === true,
            webhook: events.webhook === true
        },
        limits: {
            maxBatchQueryTasks: typeof limits.maxBatchQueryTasks === 'number' ? limits.maxBatchQueryTasks : undefined
        },
        retryPolicy: {
            enabled: retryPolicy.enabled === true,
            maxAttempts: typeof retryPolicy.maxAttempts === 'number' ? retryPolicy.maxAttempts : undefined,
            backoffMs: typeof retryPolicy.backoffMs === 'number' ? retryPolicy.backoffMs : undefined,
            feeRiskWarning: typeof retryPolicy.feeRiskWarning === 'string' ? retryPolicy.feeRiskWarning : undefined
        },
        diagnosticsUrl: typeof payload.diagnosticsUrl === 'string' ? payload.diagnosticsUrl : undefined
    };
}

export async function checkManagedTaskServiceAdmin(
    id: string,
    actor: ManagedTaskAdminActor
): Promise<ManagedTaskServiceConfig & { authTokenPrefix?: string | null }> {
    await getServerDatabaseReady();
    const service = await getServiceRecordById(id);
    if (!service) throw new Error('任务服务配置不存在。');
    let token: string | null = null;
    if (service.authMode === 'bearer') {
        token = decryptAuthToken(service.authTokenCiphertext);
        if (!token) throw new Error('任务服务鉴权 Token 无法解密或未配置。');
    }

    let healthSummary: ManagedTaskHealthSummary;
    let capabilitiesSummary: ManagedTaskCapabilitiesSummary | null = null;
    try {
        const healthPayload = await fetchTaskServiceJson(service, '/v1/admin/health', token);
        healthSummary = normalizeHealthPayload(healthPayload, 'ok');
        const capabilitiesPayload = await fetchTaskServiceJson(service, '/v1/admin/capabilities', token);
        capabilitiesSummary = normalizeCapabilitiesPayload(capabilitiesPayload);
    } catch (error) {
        healthSummary = {
            status: 'unavailable',
            safeMessage: error instanceof Error ? error.message : 'Task service health check failed.'
        };
    }

    const now = Date.now();
    getSqliteClient()
        .prepare(
            `UPDATE "managed_task_services"
             SET "healthStatus" = ?, "lastCheckedAt" = ?, "healthSummaryJson" = ?, "capabilitiesSummaryJson" = ?,
                 "updatedAt" = ?
             WHERE "id" = ?;`
        )
        .run(
            healthSummary.status,
            now,
            JSON.stringify(healthSummary),
            JSON.stringify(capabilitiesSummary ?? {}),
            now,
            service.id
        );
    const updated = await getServiceRecordById(service.id);
    if (!updated) throw new Error('任务服务健康检查结果保存失败。');
    await writeManagedTaskAudit(actor, 'managed_task_service_health_check', 'managed_task_service', updated.id, {
        after: summarizeService(updated),
        taskTypes: capabilitiesSummary?.taskTypes.filter((task) =>
            MANAGED_TASK_P0_CAPABILITIES.includes(task as (typeof MANAGED_TASK_P0_CAPABILITIES)[number])
        )
    });
    return serviceRecordToDto(updated);
}

export async function getManagedTaskResolutionInput(): Promise<
    Pick<ManagedTaskResolutionInput, 'services' | 'policies'>
> {
    const [services, policies] = await Promise.all([listManagedTaskServicesAdmin(), listManagedTaskPoliciesAdmin()]);
    return { services, policies };
}

export type ManagedTaskServiceInvocationConfig = {
    id: string;
    name: string;
    baseUrl: string;
    authMode: ManagedTaskServiceConfig['authMode'];
    authToken: string | null;
    capabilitiesSummary?: ManagedTaskCapabilitiesSummary | null;
};

export async function getManagedTaskServiceInvocationConfig(
    id: string
): Promise<ManagedTaskServiceInvocationConfig | null> {
    await getServerDatabaseReady();
    const service = await getServiceRecordById(id);
    if (!service || !service.enabled) return null;

    let authToken: string | null = null;
    const authMode = normalizeManagedTaskServiceAuthMode(service.authMode);
    if (authMode === 'bearer') {
        authToken = decryptAuthToken(service.authTokenCiphertext);
        if (!authToken) throw new Error('任务服务鉴权 Token 无法解密或未配置。');
    }

    return {
        id: service.id,
        name: service.name,
        baseUrl: service.baseUrl,
        authMode,
        authToken,
        capabilitiesSummary: serviceRecordToDto(service).capabilitiesSummary
    };
}

export async function countManagedTaskServices(): Promise<number> {
    const db = await getServerDatabaseReady();
    const rows = await db.select({ count: count() }).from(managedTaskServices);
    return Number(rows[0]?.count || 0);
}

export async function countManagedTaskPolicies(): Promise<number> {
    const db = await getServerDatabaseReady();
    const rows = await db.select({ count: count() }).from(managedTaskPolicies);
    return Number(rows[0]?.count || 0);
}
