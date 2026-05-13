import { and, desc, eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { randomToken, sanitizePlainText, hashSha256Hex, isValidAdminPassword } from '@/lib/server/security';
import { recordAuditLog } from '@/lib/server/audit';
import { getServerDatabaseReady } from '@/lib/server/db';
import {
    authAccounts,
    authUsers,
    promoConfigs,
    promoItems,
    promoShareKeys,
    promoShareProfiles,
    promoSlots,
    type PromoTransition as DbPromoTransition,
    type PromoDevice as DbPromoDevice
} from '@/lib/server/schema';
import {
    PROMO_DEFAULT_INTERVAL_MS,
    PROMO_DEFAULT_TRANSITION,
    PROMO_MIN_INTERVAL_MS,
    type PromoTransition,
    type PromoDevice
} from '@/lib/promo';
import { ensurePromoSlotsSeeded } from '@/lib/server/promo/seed';
import { validatePromoItemUrls } from '@/lib/server/promo/public';

export type PromoAdminActor = {
    userId: string;
    email: string;
    role: string;
    request: Request;
};

export type PromoSlotRecord = typeof promoSlots.$inferSelect;
export type PromoConfigRecord = typeof promoConfigs.$inferSelect;
export type PromoItemRecord = typeof promoItems.$inferSelect;
export type PromoShareKeyRecord = typeof promoShareKeys.$inferSelect;
export type PromoShareProfileRecord = typeof promoShareProfiles.$inferSelect;
export type AdminUserRecord = typeof authUsers.$inferSelect;

export type PromoShareKeyCreateInput = {
    name: string;
    note?: string | null;
    expiresAt?: Date | null;
    allowedSlots: string[];
    count?: number;
};

export type PromoShareKeyUpdateInput = {
    name?: string;
    note?: string | null;
    expiresAt?: Date | null;
    allowedSlots?: string[];
    status?: 'active' | 'disabled' | 'revoked';
};

export type PromoSlotCreateInput = {
    key: string;
    name: string;
    description?: string | null;
    enabled?: boolean;
    defaultIntervalMs?: number;
    defaultTransition?: PromoTransition;
};

export type PromoSlotUpdateInput = {
    name?: string;
    description?: string | null;
    enabled?: boolean;
    defaultIntervalMs?: number;
    defaultTransition?: PromoTransition;
};

export type PromoConfigCreateInput = {
    name: string;
    note?: string | null;
    slotId: string;
    scope: 'global' | 'share';
    shareProfileId?: string | null;
    enabled?: boolean;
    intervalMs?: number | null;
    transition?: PromoTransition | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
};

export type PromoConfigUpdateInput = Partial<PromoConfigCreateInput>;

export type PromoItemCreateInput = {
    configId: string;
    title: string;
    alt: string;
    desktopImageUrl: string;
    mobileImageUrl: string;
    linkUrl: string;
    device?: PromoDevice;
    enabled?: boolean;
    sortOrder?: number;
    weight?: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
};

export type PromoItemUpdateInput = Partial<PromoItemCreateInput>;

export type AdminUserCreateInput = {
    email: string;
    name: string;
    password: string;
    role?: 'owner' | 'admin' | 'viewer';
    status?: 'active' | 'disabled';
};

export type AdminUserUpdateInput = {
    name?: string;
    role?: 'owner' | 'admin' | 'viewer';
    status?: 'active' | 'disabled';
    password?: string;
};

function clampInterval(value: number | null | undefined, fallback: number): number {
    const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(PROMO_MIN_INTERVAL_MS, parsed);
}

function normalizeTransition(value: PromoTransition | DbPromoTransition | null | undefined): PromoTransition {
    if (value === 'slide' || value === 'none' || value === 'fade') return value;
    return PROMO_DEFAULT_TRANSITION;
}

function normalizeDevice(value: PromoDevice | DbPromoDevice | null | undefined): PromoDevice {
    if (value === 'desktop' || value === 'mobile' || value === 'all') return value;
    return 'all';
}

function normalizeAdminRole(value: string | null | undefined): 'owner' | 'admin' | 'viewer' {
    if (value === 'owner' || value === 'admin' || value === 'viewer') return value;
    return 'viewer';
}

function normalizeAdminStatus(value: string | null | undefined): 'active' | 'disabled' {
    return value === 'disabled' ? 'disabled' : 'active';
}

function normalizeAllowedSlots(input: string[]): string {
    return JSON.stringify(
        input
            .map((slot) => slot.trim())
            .filter(Boolean)
    );
}

function normalizeText(value: string | null | undefined): string {
    return sanitizePlainText(value || '');
}

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

function toNullableText(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function parseDateOrNull(value: Date | string | number | null | undefined): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildShareKeyToken(): string {
    return randomToken(24);
}

async function writePromoAudit(
    actor: PromoAdminActor,
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
        ip: actor.request.headers.get('x-forwarded-for') || actor.request.headers.get('x-real-ip'),
        userAgent: actor.request.headers.get('user-agent'),
        metadata
    });
}

async function assertSlotExists(slotId: string): Promise<PromoSlotRecord | null> {
    const db = await getServerDatabaseReady();
    const [slot] = await db.select().from(promoSlots).where(eq(promoSlots.id, slotId)).limit(1);
    return slot || null;
}

async function assertConfigExists(configId: string): Promise<PromoConfigRecord | null> {
    const db = await getServerDatabaseReady();
    const [config] = await db.select().from(promoConfigs).where(eq(promoConfigs.id, configId)).limit(1);
    return config || null;
}

async function generatePromoProfilePublicId(): Promise<string> {
    const db = await getServerDatabaseReady();
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const publicId = randomToken(10);
        const [existing] = await db.select().from(promoShareProfiles).where(eq(promoShareProfiles.publicId, publicId)).limit(1);
        if (!existing) return publicId;
    }
    return randomToken(14);
}

async function createPromoShareProfileForConfig(
    input: Pick<PromoConfigCreateInput, 'name'>,
    actor: PromoAdminActor
): Promise<PromoShareProfileRecord> {
    const db = await getServerDatabaseReady();
    const [profile] = await db
        .insert(promoShareProfiles)
        .values({
            id: randomToken(12),
            publicId: await generatePromoProfilePublicId(),
            shareKeyId: null,
            name: normalizeText(input.name),
            status: 'active',
            lastPublishedAt: new Date()
        })
        .returning();
    await writePromoAudit(actor, 'promo_share_profile_create', 'promo_share_profile', profile.id, {
        publicId: profile.publicId,
        name: profile.name
    });
    return profile;
}

export async function listPromoSlotsAdmin(): Promise<PromoSlotRecord[]> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    return db.select().from(promoSlots).orderBy(desc(promoSlots.createdAt));
}

export async function createPromoSlotAdmin(input: PromoSlotCreateInput, actor: PromoAdminActor): Promise<PromoSlotRecord> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    const [existing] = await db.select().from(promoSlots).where(eq(promoSlots.key, normalizeText(input.key))).limit(1);
    if (existing) {
        throw new Error('广告位 Key 已存在。');
    }
    const [created] = await db
        .insert(promoSlots)
        .values({
            id: randomToken(12),
            key: normalizeText(input.key),
            name: normalizeText(input.name),
            description: toNullableText(input.description),
            enabled: input.enabled ?? true,
            defaultIntervalMs: clampInterval(input.defaultIntervalMs, PROMO_DEFAULT_INTERVAL_MS),
            defaultTransition: normalizeTransition(input.defaultTransition)
        })
        .returning();
    await writePromoAudit(actor, 'promo_slot_create', 'promo_slot', created.id, {
        key: created.key,
        name: created.name
    });
    return created;
}

export async function updatePromoSlotAdmin(
    id: string,
    input: PromoSlotUpdateInput,
    actor: PromoAdminActor
): Promise<PromoSlotRecord | null> {
    const db = await getServerDatabaseReady();
    const [updated] = await db
        .update(promoSlots)
        .set({
            ...(input.name !== undefined && { name: normalizeText(input.name) }),
            ...(input.description !== undefined && { description: toNullableText(input.description) }),
            ...(input.enabled !== undefined && { enabled: input.enabled }),
            ...(input.defaultIntervalMs !== undefined && {
                defaultIntervalMs: clampInterval(input.defaultIntervalMs, PROMO_DEFAULT_INTERVAL_MS)
            }),
            ...(input.defaultTransition !== undefined && {
                defaultTransition: normalizeTransition(input.defaultTransition)
            }),
            updatedAt: new Date()
        })
        .where(eq(promoSlots.id, id))
        .returning();
    if (!updated) return null;
    await writePromoAudit(actor, 'promo_slot_update', 'promo_slot', updated.id, {
        key: updated.key,
        enabled: updated.enabled
    });
    return updated;
}

export async function deletePromoSlotAdmin(id: string, actor: PromoAdminActor): Promise<boolean> {
    const db = await getServerDatabaseReady();
    const [slot] = await db.select().from(promoSlots).where(eq(promoSlots.id, id)).limit(1);
    if (!slot) return false;
    await db.delete(promoSlots).where(eq(promoSlots.id, id));
    await writePromoAudit(actor, 'promo_slot_delete', 'promo_slot', id, { key: slot.key, name: slot.name });
    return true;
}

export async function listPromoConfigsAdmin(): Promise<PromoConfigRecord[]> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    return db.select().from(promoConfigs).orderBy(desc(promoConfigs.createdAt));
}

export async function listPromoShareProfilesAdmin(): Promise<PromoShareProfileRecord[]> {
    const db = await getServerDatabaseReady();
    return db.select().from(promoShareProfiles).orderBy(desc(promoShareProfiles.createdAt));
}

export async function getPromoConfigAdmin(id: string): Promise<PromoConfigRecord | null> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    const [config] = await db.select().from(promoConfigs).where(eq(promoConfigs.id, id)).limit(1);
    return config || null;
}

export async function createPromoConfigAdmin(
    input: PromoConfigCreateInput,
    actor: PromoAdminActor
): Promise<PromoConfigRecord> {
    if (!(await assertSlotExists(input.slotId))) {
        throw new Error('广告位不存在。');
    }

    const db = await getServerDatabaseReady();
    const profile = input.scope === 'share' ? await createPromoShareProfileForConfig(input, actor) : null;
    const [created] = await db
        .insert(promoConfigs)
        .values({
            id: randomToken(12),
            name: normalizeText(input.name),
            note: toNullableText(input.note),
            slotId: input.slotId,
            scope: input.scope,
            shareProfileId: profile?.id || null,
            enabled: input.enabled ?? true,
            intervalMs: input.intervalMs === undefined ? null : clampInterval(input.intervalMs, PROMO_DEFAULT_INTERVAL_MS),
            transition: input.transition === undefined ? null : normalizeTransition(input.transition),
            startsAt: parseDateOrNull(input.startsAt),
            endsAt: parseDateOrNull(input.endsAt),
            createdByUserId: actor.userId
        })
        .returning();
    await writePromoAudit(actor, 'promo_config_create', 'promo_config', created.id, {
        slotId: created.slotId,
        scope: created.scope,
        shareProfilePublicId: profile?.publicId
    });
    return created;
}

export async function updatePromoConfigAdmin(
    id: string,
    input: PromoConfigUpdateInput,
    actor: PromoAdminActor
): Promise<PromoConfigRecord | null> {
    if (input.slotId && !(await assertSlotExists(input.slotId))) {
        throw new Error('广告位不存在。');
    }

    const db = await getServerDatabaseReady();
    const current = await assertConfigExists(id);
    if (!current) return null;
    const nextScope = input.scope ?? current.scope;
    let nextShareProfileId = current.shareProfileId;
    if (nextScope === 'global') {
        nextShareProfileId = null;
    } else if (nextScope === 'share' && !nextShareProfileId) {
        const profile = await createPromoShareProfileForConfig(
            { name: input.name ?? current.name },
            actor
        );
        nextShareProfileId = profile.id;
    }

    const [updated] = await db
        .update(promoConfigs)
        .set({
            ...(input.name !== undefined && { name: normalizeText(input.name) }),
            ...(input.note !== undefined && { note: toNullableText(input.note) }),
            ...(input.slotId !== undefined && { slotId: input.slotId }),
            ...(input.scope !== undefined && { scope: input.scope }),
            shareProfileId: nextShareProfileId,
            ...(input.enabled !== undefined && { enabled: input.enabled }),
            ...(input.intervalMs !== undefined && {
                intervalMs: input.intervalMs === null ? null : clampInterval(input.intervalMs, PROMO_DEFAULT_INTERVAL_MS)
            }),
            ...(input.transition !== undefined && {
                transition: input.transition === null ? null : normalizeTransition(input.transition)
            }),
            ...(input.startsAt !== undefined && { startsAt: parseDateOrNull(input.startsAt) }),
            ...(input.endsAt !== undefined && { endsAt: parseDateOrNull(input.endsAt) }),
            updatedAt: new Date()
        })
        .where(eq(promoConfigs.id, id))
        .returning();
    if (!updated) return null;
    await writePromoAudit(actor, 'promo_config_update', 'promo_config', updated.id, {
        slotId: updated.slotId,
        scope: updated.scope,
        enabled: updated.enabled
    });
    if (updated.shareProfileId) {
        await db
            .update(promoShareProfiles)
            .set({
                name: updated.name,
                status: updated.enabled ? 'active' : 'disabled',
                updatedAt: new Date(),
                lastPublishedAt: new Date()
            })
            .where(eq(promoShareProfiles.id, updated.shareProfileId));
    }
    return updated;
}

export async function deletePromoConfigAdmin(id: string, actor: PromoAdminActor): Promise<boolean> {
    const db = await getServerDatabaseReady();
    const [config] = await db.select().from(promoConfigs).where(eq(promoConfigs.id, id)).limit(1);
    if (!config) return false;
    await db.delete(promoConfigs).where(eq(promoConfigs.id, id));
    if (config.shareProfileId) {
        await db.delete(promoShareProfiles).where(eq(promoShareProfiles.id, config.shareProfileId));
    }
    await writePromoAudit(actor, 'promo_config_delete', 'promo_config', id, {
        slotId: config.slotId,
        scope: config.scope
    });
    return true;
}

export async function listPromoItemsAdmin(): Promise<PromoItemRecord[]> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    return db.select().from(promoItems).orderBy(desc(promoItems.createdAt));
}

export async function listPromoItemsByConfigAdmin(configId: string): Promise<PromoItemRecord[]> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    return db.select().from(promoItems).where(eq(promoItems.configId, configId)).orderBy(desc(promoItems.sortOrder));
}

export async function createPromoItemAdmin(
    input: PromoItemCreateInput,
    actor: PromoAdminActor
): Promise<PromoItemRecord> {
    if (!(await assertConfigExists(input.configId))) {
        throw new Error('广告配置不存在。');
    }
    if (!validatePromoItemUrls(input)) {
        throw new Error('广告 URL 不合法。');
    }

    const db = await getServerDatabaseReady();
    const [created] = await db
        .insert(promoItems)
        .values({
            id: randomToken(12),
            configId: input.configId,
            title: normalizeText(input.title),
            alt: normalizeText(input.alt),
            desktopImageUrl: input.desktopImageUrl.trim(),
            mobileImageUrl: input.mobileImageUrl.trim(),
            linkUrl: input.linkUrl.trim(),
            device: normalizeDevice(input.device),
            enabled: input.enabled ?? true,
            sortOrder: input.sortOrder ?? 0,
            weight: input.weight ?? 100,
            startsAt: parseDateOrNull(input.startsAt),
            endsAt: parseDateOrNull(input.endsAt)
        })
        .returning();
    await writePromoAudit(actor, 'promo_item_create', 'promo_item', created.id, {
        configId: created.configId,
        title: created.title
    });
    return created;
}

export async function updatePromoItemAdmin(
    id: string,
    input: PromoItemUpdateInput,
    actor: PromoAdminActor
): Promise<PromoItemRecord | null> {
    const db = await getServerDatabaseReady();
    const [current] = await db.select().from(promoItems).where(eq(promoItems.id, id)).limit(1);
    if (!current) return null;

    if (input.configId && !(await assertConfigExists(input.configId))) {
        throw new Error('广告配置不存在。');
    }

    const candidate = {
        desktopImageUrl: (input.desktopImageUrl ?? current.desktopImageUrl).trim(),
        mobileImageUrl: (input.mobileImageUrl ?? current.mobileImageUrl).trim(),
        linkUrl: (input.linkUrl ?? current.linkUrl).trim()
    };
    if (!validatePromoItemUrls(candidate)) {
        throw new Error('广告 URL 不合法。');
    }

    const [updated] = await db
        .update(promoItems)
        .set({
            ...(input.configId !== undefined && { configId: input.configId }),
            ...(input.title !== undefined && { title: normalizeText(input.title) }),
            ...(input.alt !== undefined && { alt: normalizeText(input.alt) }),
            ...(input.desktopImageUrl !== undefined && { desktopImageUrl: input.desktopImageUrl.trim() }),
            ...(input.mobileImageUrl !== undefined && { mobileImageUrl: input.mobileImageUrl.trim() }),
            ...(input.linkUrl !== undefined && { linkUrl: input.linkUrl.trim() }),
            ...(input.device !== undefined && { device: normalizeDevice(input.device) }),
            ...(input.enabled !== undefined && { enabled: input.enabled }),
            ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
            ...(input.weight !== undefined && { weight: input.weight }),
            ...(input.startsAt !== undefined && { startsAt: parseDateOrNull(input.startsAt) }),
            ...(input.endsAt !== undefined && { endsAt: parseDateOrNull(input.endsAt) }),
            updatedAt: new Date()
        })
        .where(eq(promoItems.id, id))
        .returning();
    if (!updated) return null;
    await writePromoAudit(actor, 'promo_item_update', 'promo_item', updated.id, {
        configId: updated.configId,
        title: updated.title,
        enabled: updated.enabled
    });
    return updated;
}

export async function deletePromoItemAdmin(id: string, actor: PromoAdminActor): Promise<boolean> {
    const db = await getServerDatabaseReady();
    const [item] = await db.select().from(promoItems).where(eq(promoItems.id, id)).limit(1);
    if (!item) return false;
    await db.delete(promoItems).where(eq(promoItems.id, id));
    await writePromoAudit(actor, 'promo_item_delete', 'promo_item', id, {
        configId: item.configId,
        title: item.title
    });
    return true;
}

export async function listPromoShareKeysAdmin(): Promise<PromoShareKeyRecord[]> {
    const db = await getServerDatabaseReady();
    return db.select().from(promoShareKeys).orderBy(desc(promoShareKeys.createdAt));
}

export async function createPromoShareKeyAdmin(
    input: PromoShareKeyCreateInput,
    actor: PromoAdminActor
): Promise<{ record: PromoShareKeyRecord; token: string }> {
    const db = await getServerDatabaseReady();
    const token = buildShareKeyToken();
    const [record] = await db
        .insert(promoShareKeys)
        .values({
            id: randomToken(12),
            name: normalizeText(input.name),
            note: toNullableText(input.note),
            tokenPrefix: token.slice(0, 8),
            tokenHash: hashSha256Hex(token),
            status: 'active',
            expiresAt: parseDateOrNull(input.expiresAt),
            allowedSlotsJson: normalizeAllowedSlots(input.allowedSlots),
            createdByUserId: actor.userId
        })
        .returning();
    await writePromoAudit(actor, 'promo_share_key_create', 'promo_share_key', record.id, {
        name: record.name,
        allowedSlots: input.allowedSlots
    });
    return { record, token };
}

export async function batchCreatePromoShareKeysAdmin(
    input: PromoShareKeyCreateInput,
    actor: PromoAdminActor
): Promise<Array<{ record: PromoShareKeyRecord; token: string }>> {
    const count = Math.max(1, Math.min(20, Math.floor(input.count || 1)));
    const results: Array<{ record: PromoShareKeyRecord; token: string }> = [];
    for (let index = 0; index < count; index += 1) {
        results.push(await createPromoShareKeyAdmin(input, actor));
    }
    await writePromoAudit(actor, 'promo_share_key_batch_create', 'promo_share_key_batch', 'batch', {
        count,
        name: input.name
    });
    return results;
}

export async function updatePromoShareKeyAdmin(
    id: string,
    input: PromoShareKeyUpdateInput,
    actor: PromoAdminActor
): Promise<PromoShareKeyRecord | null> {
    const db = await getServerDatabaseReady();
    const [updated] = await db
        .update(promoShareKeys)
        .set({
            ...(input.name !== undefined && { name: normalizeText(input.name) }),
            ...(input.note !== undefined && { note: toNullableText(input.note) }),
            ...(input.expiresAt !== undefined && { expiresAt: parseDateOrNull(input.expiresAt) }),
            ...(input.allowedSlots !== undefined && { allowedSlotsJson: normalizeAllowedSlots(input.allowedSlots) }),
            ...(input.status !== undefined && { status: input.status }),
            updatedAt: new Date()
        })
        .where(eq(promoShareKeys.id, id))
        .returning();
    if (!updated) return null;
    await writePromoAudit(actor, 'promo_share_key_update', 'promo_share_key', updated.id, {
        name: updated.name,
        status: updated.status
    });
    return updated;
}

export async function setPromoShareKeyStatusAdmin(
    id: string,
    status: 'disabled' | 'revoked',
    actor: PromoAdminActor
): Promise<PromoShareKeyRecord | null> {
    const db = await getServerDatabaseReady();
    const [updated] = await db
        .update(promoShareKeys)
        .set({
            status,
            updatedAt: new Date()
        })
        .where(eq(promoShareKeys.id, id))
        .returning();
    if (!updated) return null;
    await writePromoAudit(actor, `promo_share_key_${status}`, 'promo_share_key', updated.id, {
        name: updated.name,
        status: updated.status
    });
    return updated;
}

export async function listPromoSlotUsageCounts(): Promise<Map<string, { configs: number; items: number }>> {
    const db = await getServerDatabaseReady();
    const configs = await db.select().from(promoConfigs);
    const items = await db.select().from(promoItems);
    const counts = new Map<string, { configs: number; items: number }>();

    for (const config of configs) {
        const current = counts.get(config.slotId) || { configs: 0, items: 0 };
        current.configs += 1;
        counts.set(config.slotId, current);
    }

    for (const item of items) {
        const config = configs.find((entry) => entry.id === item.configId);
        if (!config) continue;
        const current = counts.get(config.slotId) || { configs: 0, items: 0 };
        current.items += 1;
        counts.set(config.slotId, current);
    }

    return counts;
}

export async function listAuditLogsAdmin(limit = 100) {
    const { listAuditLogs } = await import('@/lib/server/audit');
    return listAuditLogs(limit);
}

export async function listAdminUsersAdmin(): Promise<AdminUserRecord[]> {
    const db = await getServerDatabaseReady();
    return db.select().from(authUsers).orderBy(desc(authUsers.createdAt));
}

async function setAdminUserPassword(userId: string, password: string): Promise<void> {
    if (!isValidAdminPassword(password)) {
        throw new Error('管理员密码至少需要 12 位。');
    }
    const db = await getServerDatabaseReady();
    const passwordHash = await hashPassword(password);
    const [account] = await db
        .select()
        .from(authAccounts)
        .where(and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, 'credential')))
        .limit(1);

    if (account) {
        await db
            .update(authAccounts)
            .set({ password: passwordHash, updatedAt: new Date() })
            .where(eq(authAccounts.id, account.id));
        return;
    }

    await db.insert(authAccounts).values({
        id: randomToken(16),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash
    });
}

export async function createAdminUserAdmin(input: AdminUserCreateInput, actor: PromoAdminActor): Promise<AdminUserRecord> {
    if (!isValidAdminPassword(input.password)) {
        throw new Error('管理员密码至少需要 12 位。');
    }

    const email = normalizeEmail(input.email);
    const db = await getServerDatabaseReady();
    const [existing] = await db
        .select()
        .from(authUsers)
        .where(eq(authUsers.email, email))
        .limit(1);
    if (existing) {
        throw new Error('账号已存在。');
    }

    const userId = randomToken(16);
    const [created] = await db
        .insert(authUsers)
        .values({
            id: userId,
            email,
            name: normalizeText(input.name),
            emailVerified: false,
            role: normalizeAdminRole(input.role),
            status: normalizeAdminStatus(input.status)
        })
        .returning();

    await setAdminUserPassword(created.id, input.password);
    await writePromoAudit(actor, 'admin_user_create', 'user', created.id, {
        email: created.email,
        role: created.role,
        status: created.status
    });
    return created;
}

export async function updateAdminUserAdmin(
    id: string,
    input: AdminUserUpdateInput,
    actor: PromoAdminActor
): Promise<AdminUserRecord | null> {
    const db = await getServerDatabaseReady();
    const [current] = await db.select().from(authUsers).where(eq(authUsers.id, id)).limit(1);
    if (!current) return null;

    const nextStatus = input.status === undefined ? undefined : normalizeAdminStatus(input.status);
    if (id === actor.userId && nextStatus === 'disabled') {
        throw new Error('不能禁用当前登录账号。');
    }
    if (id === actor.userId && input.role && input.role !== current.role) {
        throw new Error('不能修改当前登录账号的角色。');
    }

    if (input.password !== undefined && input.password.trim()) {
        await setAdminUserPassword(id, input.password);
    }

    const [updated] = await db
        .update(authUsers)
        .set({
            ...(input.name !== undefined && { name: normalizeText(input.name) }),
            ...(input.role !== undefined && { role: normalizeAdminRole(input.role) }),
            ...(nextStatus !== undefined && { status: nextStatus }),
            updatedAt: new Date()
        })
        .where(eq(authUsers.id, id))
        .returning();
    if (!updated) return null;

    await writePromoAudit(actor, 'admin_user_update', 'user', updated.id, {
        email: updated.email,
        role: updated.role,
        status: updated.status,
        passwordChanged: Boolean(input.password?.trim())
    });
    return updated;
}
