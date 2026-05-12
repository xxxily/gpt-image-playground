import { and, eq } from 'drizzle-orm';
import { randomToken, sanitizePlainText, hashSha256Hex } from '@/lib/server/security';
import { recordAuditLog } from '@/lib/server/audit';
import { getServerDatabaseReady } from '@/lib/server/db';
import {
    promoConfigs,
    promoItems,
    promoShareKeys,
    promoShareProfiles,
    promoSlots
} from '@/lib/server/schema';
import { ensurePromoSlotsSeeded } from '@/lib/server/promo/seed';
import { validatePromoItemUrls } from '@/lib/server/promo/public';
import {
    PROMO_ALT_MAX_LENGTH,
    PROMO_DEFAULT_INTERVAL_MS,
    PROMO_DEFAULT_TRANSITION,
    PROMO_MIN_INTERVAL_MS,
    PROMO_TITLE_MAX_LENGTH,
    PROMO_URL_MAX_LENGTH,
    type PromoDevice,
    type PromoTransition
} from '@/lib/promo';

type PromoShareKeyRecord = typeof promoShareKeys.$inferSelect;
type PromoShareProfileRecord = typeof promoShareProfiles.$inferSelect;
type PromoSlotRecord = typeof promoSlots.$inferSelect;
type PromoConfigRecord = typeof promoConfigs.$inferSelect;
type PromoItemRecord = typeof promoItems.$inferSelect;
type PromoShareKeyPublicRecord = Omit<PromoShareKeyRecord, 'tokenHash'>;

export type PromoShareKeyValidation = {
    valid: boolean;
    reason?: 'invalid' | 'disabled' | 'revoked' | 'expired' | 'slot_not_allowed';
    key?: PromoShareKeyPublicRecord;
    allowedSlots: string[];
    slotAllowed?: boolean;
};

export type PromoShareItemInput = {
    title: string;
    alt: string;
    desktopImageUrl: string;
    mobileImageUrl: string;
    linkUrl: string;
    device?: PromoDevice;
    enabled?: boolean;
    sortOrder?: number;
    weight?: number;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
};

export type PromoShareProfileUpsertInput = {
    shareKey: string;
    name: string;
    slotKey: string;
    promoProfileId?: string | null;
    enabled?: boolean;
    intervalMs?: number | null;
    transition?: PromoTransition | null;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
    items: PromoShareItemInput[];
};

export type PromoShareProfileUpsertResult = {
    promoProfileId: string;
    profile: PromoShareProfileRecord;
    slot: PromoSlotRecord;
    config: PromoConfigRecord;
    items: PromoItemRecord[];
};

function normalizeText(value: string): string {
    return sanitizePlainText(value);
}

function parseDateOrNull(value: Date | string | null | undefined): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeInterval(value: number | null | undefined, fallback: number): number {
    const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(PROMO_MIN_INTERVAL_MS, parsed);
}

function normalizeTransition(value: PromoTransition | null | undefined): PromoTransition {
    if (value === 'fade' || value === 'slide' || value === 'none') return value;
    return PROMO_DEFAULT_TRANSITION;
}

function normalizeDevice(value: PromoDevice | null | undefined): PromoDevice {
    if (value === 'desktop' || value === 'mobile' || value === 'all') return value;
    return 'all';
}

function parseAllowedSlotsJson(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean);
    } catch {
        return [];
    }
}

function toPublicShareKey(record: PromoShareKeyRecord): PromoShareKeyPublicRecord {
    const { tokenHash, ...safeRecord } = record;
    void tokenHash;
    return safeRecord;
}

function isPromoShareConfigEnabled(): boolean {
    return process.env.PROMO_SHARE_CONFIG_ENABLED !== 'false';
}

async function loadShareKeyByToken(token: string): Promise<PromoShareKeyRecord | null> {
    const db = await getServerDatabaseReady();
    const tokenHash = hashSha256Hex(token.trim());
    const [record] = await db.select().from(promoShareKeys).where(eq(promoShareKeys.tokenHash, tokenHash)).limit(1);
    return record || null;
}

async function loadSlotByKey(slotKey: string): Promise<PromoSlotRecord | null> {
    const db = await getServerDatabaseReady();
    const [slot] = await db.select().from(promoSlots).where(eq(promoSlots.key, slotKey.trim())).limit(1);
    return slot || null;
}

async function saveAudit(
    action: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, unknown>,
    shareKeyId?: string | null
): Promise<void> {
    await recordAuditLog({
        actorUserId: null,
        actorType: 'share_key',
        action,
        targetType,
        targetId,
        metadata: {
            ...(metadata || {}),
            ...(shareKeyId ? { shareKeyId } : {})
        }
    });
}

function sanitizeItemInput(item: PromoShareItemInput): PromoShareItemInput {
    return {
        title: normalizeText(item.title),
        alt: normalizeText(item.alt),
        desktopImageUrl: item.desktopImageUrl.trim(),
        mobileImageUrl: item.mobileImageUrl.trim(),
        linkUrl: item.linkUrl.trim(),
        device: normalizeDevice(item.device),
        enabled: item.enabled ?? true,
        sortOrder: item.sortOrder ?? 0,
        weight: item.weight ?? 100,
        startsAt: parseDateOrNull(item.startsAt),
        endsAt: parseDateOrNull(item.endsAt)
    };
}

function validateItemShape(item: PromoShareItemInput): void {
    const sanitized = sanitizeItemInput(item);
    if (sanitized.title.length === 0 || sanitized.title.length > PROMO_TITLE_MAX_LENGTH) {
        throw new Error('广告标题不合法。');
    }
    if (sanitized.alt.length === 0 || sanitized.alt.length > PROMO_ALT_MAX_LENGTH) {
        throw new Error('广告替代文本不合法。');
    }
    if (
        sanitized.desktopImageUrl.length === 0 ||
        sanitized.desktopImageUrl.length > PROMO_URL_MAX_LENGTH ||
        sanitized.mobileImageUrl.length === 0 ||
        sanitized.mobileImageUrl.length > PROMO_URL_MAX_LENGTH ||
        sanitized.linkUrl.length === 0 ||
        sanitized.linkUrl.length > PROMO_URL_MAX_LENGTH
    ) {
        throw new Error('广告 URL 不合法。');
    }
    if (!validatePromoItemUrls(sanitized)) {
        throw new Error('广告 URL 不合法。');
    }
}

export async function validatePromoShareKey(
    token: string,
    slotKey?: string | null
): Promise<PromoShareKeyValidation> {
    if (!isPromoShareConfigEnabled()) {
        return { valid: false, reason: 'disabled', allowedSlots: [] };
    }

    const trimmed = token.trim();
    if (!trimmed) {
        return { valid: false, reason: 'invalid', allowedSlots: [] };
    }

    const record = await loadShareKeyByToken(trimmed);
    if (!record) {
        return { valid: false, reason: 'invalid', allowedSlots: [] };
    }

    const allowedSlots = parseAllowedSlotsJson(record.allowedSlotsJson);
    const expired = Boolean(record.expiresAt && record.expiresAt.getTime() < Date.now());
    const slotAllowed = !slotKey?.trim() || allowedSlots.length === 0 || allowedSlots.includes(slotKey.trim());

    if (record.status === 'disabled') {
        return { valid: false, reason: 'disabled', allowedSlots, key: toPublicShareKey(record) };
    }
    if (record.status === 'revoked') {
        return { valid: false, reason: 'revoked', allowedSlots, key: toPublicShareKey(record) };
    }
    if (expired) {
        return {
            valid: false,
            reason: 'expired',
            allowedSlots,
            slotAllowed,
            key: toPublicShareKey(record)
        };
    }
    if (!slotAllowed) {
        return {
            valid: false,
            reason: 'slot_not_allowed',
            allowedSlots,
            slotAllowed: false,
            key: toPublicShareKey(record)
        };
    }

    await getServerDatabaseReady().then((db) =>
        db.update(promoShareKeys).set({ lastUsedAt: new Date() }).where(eq(promoShareKeys.id, record.id))
    );

    return {
        valid: true,
        allowedSlots,
        slotAllowed: true,
        key: toPublicShareKey(record)
    };
}

export async function upsertPromoShareProfile(input: PromoShareProfileUpsertInput): Promise<PromoShareProfileUpsertResult> {
    if (!isPromoShareConfigEnabled()) {
        throw new Error('分享广告配置功能未开启。');
    }

    const shareKey = await loadShareKeyByToken(input.shareKey);
    if (!shareKey) {
        throw new Error('权限 Key 不正确。');
    }

    if (shareKey.status === 'disabled') {
        throw new Error('权限 Key 已停用。');
    }
    if (shareKey.status === 'revoked') {
        throw new Error('权限 Key 已撤销。');
    }
    if (shareKey.expiresAt && shareKey.expiresAt.getTime() < Date.now()) {
        throw new Error('权限 Key 已过期。');
    }

    const allowedSlots = parseAllowedSlotsJson(shareKey.allowedSlotsJson);
    if (allowedSlots.length > 0 && !allowedSlots.includes(input.slotKey.trim())) {
        throw new Error('权限 Key 不允许这个广告位。');
    }

    if (input.items.length === 0) {
        throw new Error('至少需要一个广告素材。');
    }
    input.items.forEach(validateItemShape);

    const db = await getServerDatabaseReady();
    await ensurePromoSlotsSeeded();
    const slot = await loadSlotByKey(input.slotKey);
    if (!slot) {
        throw new Error('广告位不存在。');
    }

    const requestedPromoProfileId = input.promoProfileId?.trim() || null;
    const profilePublicId = requestedPromoProfileId || randomToken(10);
    const now = new Date();

    let profile = await db
        .select()
        .from(promoShareProfiles)
        .where(eq(promoShareProfiles.publicId, profilePublicId))
        .limit(1)
        .then((rows) => rows[0] || null);
    const profileAlreadyExists = Boolean(profile);
    if (profile) {
        if (profile.shareKeyId && profile.shareKeyId !== shareKey.id) {
            throw new Error('该分享配置不属于这个权限 Key。');
        }
        const [updatedProfile] = await db
            .update(promoShareProfiles)
            .set({
                shareKeyId: shareKey.id,
                name: normalizeText(input.name),
                status: 'active',
                updatedAt: now,
                lastPublishedAt: now
            })
            .where(eq(promoShareProfiles.id, profile.id))
            .returning();
        profile = updatedProfile || profile;
    } else {
        const [createdProfile] = await db
            .insert(promoShareProfiles)
            .values({
                id: randomToken(12),
                publicId: profilePublicId,
                shareKeyId: shareKey.id,
                name: normalizeText(input.name),
                status: 'active',
                lastPublishedAt: now
            })
            .returning();
        profile = createdProfile;
    }

    const [existingConfig] = await db
        .select()
        .from(promoConfigs)
        .where(and(eq(promoConfigs.scope, 'share'), eq(promoConfigs.shareProfileId, profile.id)))
        .limit(1);

    if (existingConfig) {
        await db.delete(promoItems).where(eq(promoItems.configId, existingConfig.id));
        await db.delete(promoConfigs).where(eq(promoConfigs.id, existingConfig.id));
    }

    const [config] = await db
        .insert(promoConfigs)
        .values({
            id: randomToken(12),
            slotId: slot.id,
            scope: 'share',
            shareProfileId: profile.id,
            enabled: input.enabled ?? true,
            intervalMs: input.intervalMs === undefined ? null : normalizeInterval(input.intervalMs, slot.defaultIntervalMs || PROMO_DEFAULT_INTERVAL_MS),
            transition: input.transition === undefined ? null : normalizeTransition(input.transition),
            startsAt: parseDateOrNull(input.startsAt),
            endsAt: parseDateOrNull(input.endsAt),
            createdByUserId: null
        })
        .returning();

    const items = await Promise.all(
        input.items.map(async (item) => {
            const sanitized = sanitizeItemInput(item);
            const [createdItem] = await db
                .insert(promoItems)
                .values({
                    id: randomToken(12),
                    configId: config.id,
                    title: sanitized.title,
                    alt: sanitized.alt,
                    desktopImageUrl: sanitized.desktopImageUrl,
                    mobileImageUrl: sanitized.mobileImageUrl,
                    linkUrl: sanitized.linkUrl,
                    device: sanitized.device,
                    enabled: sanitized.enabled ?? true,
                    sortOrder: sanitized.sortOrder ?? 0,
                    weight: sanitized.weight ?? 100,
                    startsAt: parseDateOrNull(sanitized.startsAt),
                    endsAt: parseDateOrNull(sanitized.endsAt)
                })
                .returning();
            return createdItem;
        })
    );

    await getServerDatabaseReady().then((readyDb) =>
        readyDb.update(promoShareKeys).set({ lastUsedAt: now }).where(eq(promoShareKeys.id, shareKey.id))
    );

    await saveAudit(
        profileAlreadyExists ? 'promo_share_profile_update' : 'promo_share_profile_create',
        'promo_share_profile',
        profile.id,
        {
            slotKey: slot.key,
            itemCount: items.length,
            enabled: config.enabled
        },
        shareKey.id
    );

    return {
        promoProfileId: profile.publicId,
        profile,
        slot,
        config,
        items
    };
}
