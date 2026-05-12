import { desc, eq, inArray, or } from 'drizzle-orm';
import { getGenerationHeaderAdConfig } from '@/lib/ad-config';
import { getServerDatabaseReady } from '@/lib/server/db';
import {
    promoConfigs,
    promoItems,
    promoShareKeys,
    promoShareProfiles,
    promoSlots,
    type PromoDevice as DbPromoDevice
} from '@/lib/server/schema';
import {
    PROMO_ALLOWED_ITEM_FIELDS,
    PROMO_ALT_MAX_LENGTH,
    PROMO_DEFAULT_INTERVAL_MS,
    PROMO_DEFAULT_TRANSITION,
    PROMO_DEVICE_VALUES,
    PROMO_MIN_INTERVAL_MS,
    type PromoCapabilities,
    type PromoCapabilitySlot,
    type PromoDevice,
    type PromoPlacement,
    type PromoPlacementItem,
    type PromoPlacementSource,
    type PromoSlotKey,
    PROMO_URL_MAX_LENGTH,
    PROMO_TITLE_MAX_LENGTH
} from '@/lib/promo';
import { ensurePromoSlotsSeeded } from '@/lib/server/promo/seed';
import { normalizePromoRemoteUrl, validatePromoRemoteUrl } from '@/lib/server/promo/url';

type PromoSlotRow = typeof promoSlots.$inferSelect;
type PromoConfigRow = typeof promoConfigs.$inferSelect;
type PromoItemRow = typeof promoItems.$inferSelect;
type PromoShareProfileRow = typeof promoShareProfiles.$inferSelect;
type PromoShareKeyRow = typeof promoShareKeys.$inferSelect;

export type PromoPlacementsQuery = {
    slots?: string[];
    surface?: string | null;
    device?: string | null;
    promoProfileId?: string | null;
};

export type PromoPlacementsResponse = {
    placements: PromoPlacement[];
};

export type PromoCapabilitiesResponse = PromoCapabilities;

type PromoResolvedCandidate = {
    placement: PromoPlacement | null;
    source: PromoPlacementSource;
};

function clampInterval(value: number | null | undefined, fallback: number): number {
    const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(PROMO_MIN_INTERVAL_MS, parsed);
}

function normalizeTransition(value: string | null | undefined): PromoPlacement['transition'] {
    if (value === 'slide' || value === 'none' || value === 'fade') return value;
    return PROMO_DEFAULT_TRANSITION;
}

function normalizeDevice(value: string | null | undefined): PromoDevice {
    if (value === 'desktop' || value === 'mobile' || value === 'all') return value;
    return 'all';
}

function normalizeSlotKeyList(input: string[] | undefined): string[] {
    if (!input || input.length === 0) return [];
    const deduped = new Set<string>();
    for (const raw of input) {
        const candidate = raw.trim();
        if (!candidate) continue;
        for (const part of candidate.split(',')) {
            const normalized = part.trim();
            if (normalized) deduped.add(normalized);
        }
    }
    return [...deduped];
}

function isWithinWindow(now: number, startsAt: Date | null | undefined, endsAt: Date | null | undefined): boolean {
    if (startsAt && startsAt.getTime() > now) return false;
    if (endsAt && endsAt.getTime() < now) return false;
    return true;
}

function matchesDevice(itemDevice: PromoDevice, requestedDevice: PromoDevice): boolean {
    if (requestedDevice === 'all') return true;
    return itemDevice === 'all' || itemDevice === requestedDevice;
}

function toPublicItem(row: PromoItemRow): PromoPlacementItem | null {
    const desktopImage = normalizePromoRemoteUrl(row.desktopImageUrl);
    const mobileImage = normalizePromoRemoteUrl(row.mobileImageUrl);
    const linkUrl = normalizePromoRemoteUrl(row.linkUrl);
    if (!desktopImage || !mobileImage || !linkUrl) return null;
    if (row.title.trim().length === 0 || row.title.length > PROMO_TITLE_MAX_LENGTH) return null;
    if (row.alt.trim().length === 0 || row.alt.length > PROMO_ALT_MAX_LENGTH) return null;

    return {
        title: row.title.trim(),
        alt: row.alt.trim(),
        desktopImageUrl: desktopImage,
        mobileImageUrl: mobileImage,
        linkUrl,
        device: normalizeDevice(row.device),
        sortOrder: row.sortOrder,
        weight: row.weight
    };
}

function sortPromoItems(items: PromoPlacementItem[]): PromoPlacementItem[] {
    return [...items].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        if (a.weight !== b.weight) return b.weight - a.weight;
        return a.title.localeCompare(b.title);
    });
}

function buildPlacement(slot: PromoSlotRow, source: PromoPlacementSource, items: PromoPlacementItem[], intervalMs?: number | null, transition?: string | null): PromoPlacement {
    return {
        slotKey: slot.key,
        slotName: slot.name,
        description: slot.description,
        enabled: slot.enabled,
        intervalMs: clampInterval(intervalMs, slot.defaultIntervalMs || PROMO_DEFAULT_INTERVAL_MS),
        transition: normalizeTransition(transition || slot.defaultTransition),
        source,
        items: sortPromoItems(items)
    };
}

function buildLegacyPlacement(slot: PromoSlotRow): PromoPlacement | null {
    if (slot.key !== 'generation_form_header') return null;
    const legacy = getGenerationHeaderAdConfig();
    if (!legacy) return null;

    return {
        slotKey: slot.key,
        slotName: slot.name,
        description: slot.description,
        enabled: true,
        intervalMs: clampInterval(slot.defaultIntervalMs, PROMO_DEFAULT_INTERVAL_MS),
        transition: normalizeTransition(slot.defaultTransition),
        source: 'legacy',
        items: [
            {
                title: legacy.alt.trim() || '赞助广告',
                alt: legacy.alt.trim() || '赞助广告',
                desktopImageUrl: legacy.imageUrl,
                mobileImageUrl: legacy.imageUrl,
                linkUrl: legacy.linkUrl,
                device: 'all',
                sortOrder: 0,
                weight: 100
            }
        ]
    };
}

async function loadPromoSlotsByKeys(slotKeys: string[]): Promise<PromoSlotRow[]> {
    const db = await getServerDatabaseReady();
    if (slotKeys.length === 0) {
        return db.select().from(promoSlots).orderBy(desc(promoSlots.createdAt));
    }
    return db.select().from(promoSlots).where(inArray(promoSlots.key, slotKeys)).orderBy(desc(promoSlots.createdAt));
}

async function loadPromoProfileContext(promoProfileId: string | null | undefined): Promise<{
    profile: PromoShareProfileRow | null;
    shareKey: PromoShareKeyRow | null;
} | null> {
    if (!promoProfileId?.trim()) return null;
    const db = await getServerDatabaseReady();
    const [profile] = await db.select().from(promoShareProfiles).where(eq(promoShareProfiles.publicId, promoProfileId.trim())).limit(1);
    if (!profile) return null;
    if (profile.status !== 'active') return { profile, shareKey: null };
    const [shareKey] = await db.select().from(promoShareKeys).where(eq(promoShareKeys.id, profile.shareKeyId || '')).limit(1);
    return { profile, shareKey: shareKey || null };
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

function isShareProfileSlotAllowed(
    slotKey: string,
    profile: PromoShareProfileRow,
    shareKey: PromoShareKeyRow | null
): boolean {
    if (!shareKey || profile.status !== 'active') return false;
    if (shareKey.status !== 'active') return false;
    if (shareKey.expiresAt && shareKey.expiresAt.getTime() < Date.now()) return false;
    const allowedSlots = parseAllowedSlotsJson(shareKey.allowedSlotsJson);
    if (allowedSlots.length === 0) return true;
    return allowedSlots.includes(slotKey);
}

async function buildShareCandidate(
    slot: PromoSlotRow,
    itemsByConfigId: Map<string, PromoItemRow[]>,
    configs: PromoConfigRow[],
    promoProfileId: string | null | undefined,
    requestedDevice: PromoDevice
): Promise<PromoResolvedCandidate | null> {
    if (!promoProfileId?.trim()) return null;
    const context = await loadPromoProfileContext(promoProfileId);
    const profile = context?.profile;
    const shareKey = context?.shareKey;
    if (!profile || !shareKey) return null;
    if (!isShareProfileSlotAllowed(slot.key, profile, shareKey)) return null;

    const shareConfig = [...configs]
        .filter((config) => config.slotId === slot.id && config.scope === 'share' && config.enabled)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
        .find((config) => config.shareProfileId === profile.id);
    if (!shareConfig || !isWithinWindow(Date.now(), shareConfig.startsAt, shareConfig.endsAt)) return null;

    const validItems = (itemsByConfigId.get(shareConfig.id) || [])
        .filter((item) => item.enabled && isWithinWindow(Date.now(), item.startsAt, item.endsAt))
        .filter((item) => matchesDevice(normalizeDevice(item.device), requestedDevice))
        .map(toPublicItem)
        .filter((item): item is PromoPlacementItem => !!item);

    if (validItems.length === 0) return null;
    return {
        source: 'share',
        placement: buildPlacement(slot, 'share', validItems, shareConfig.intervalMs, shareConfig.transition)
    };
}

function buildGlobalCandidate(
    slot: PromoSlotRow,
    configs: PromoConfigRow[],
    itemsByConfigId: Map<string, PromoItemRow[]>,
    requestedDevice: PromoDevice
): PromoResolvedCandidate | null {
    const globalConfig = [...configs]
        .filter((config) => config.slotId === slot.id && config.scope === 'global' && config.enabled)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
        .find((config) => isWithinWindow(Date.now(), config.startsAt, config.endsAt));
    if (!globalConfig) return null;

    const validItems = (itemsByConfigId.get(globalConfig.id) || [])
        .filter((item) => item.enabled && isWithinWindow(Date.now(), item.startsAt, item.endsAt))
        .filter((item) => matchesDevice(normalizeDevice(item.device), requestedDevice))
        .map(toPublicItem)
        .filter((item): item is PromoPlacementItem => !!item);

    if (validItems.length === 0) return null;
    return {
        source: 'global',
        placement: buildPlacement(slot, 'global', validItems, globalConfig.intervalMs, globalConfig.transition)
    };
}

export async function getPromoCapabilities(): Promise<PromoCapabilitiesResponse> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    const slots = await db.select().from(promoSlots).orderBy(desc(promoSlots.key));

    return {
        shareProfilesEnabled: true,
        slots: slots.map<PromoCapabilitySlot>((slot) => ({
            key: slot.key,
            name: slot.name,
            description: slot.description,
            enabled: slot.enabled,
            defaultIntervalMs: clampInterval(slot.defaultIntervalMs, PROMO_DEFAULT_INTERVAL_MS),
            defaultTransition: normalizeTransition(slot.defaultTransition)
        })),
        itemLimits: {
            titleMaxLength: PROMO_TITLE_MAX_LENGTH,
            altMaxLength: PROMO_ALT_MAX_LENGTH,
            urlMaxLength: PROMO_URL_MAX_LENGTH,
            allowedFields: PROMO_ALLOWED_ITEM_FIELDS
        },
        carouselDefaults: {
            intervalMs: PROMO_DEFAULT_INTERVAL_MS,
            minIntervalMs: PROMO_MIN_INTERVAL_MS,
            transition: PROMO_DEFAULT_TRANSITION
        }
    };
}

export async function getPromoPlacements(query: PromoPlacementsQuery): Promise<PromoPlacementsResponse> {
    await ensurePromoSlotsSeeded();
    const requestedSlots = normalizeSlotKeyList(query.slots);
    const requestedDevice = normalizeDevice(query.device);
    const db = await getServerDatabaseReady();
    const slots = await loadPromoSlotsByKeys(requestedSlots);
    if (slots.length === 0) return { placements: [] };

    const slotIds = slots.map((slot) => slot.id);
    const configs = slotIds.length
        ? await db.select().from(promoConfigs).where(inArray(promoConfigs.slotId, slotIds)).orderBy(desc(promoConfigs.updatedAt))
        : [];
    const configIds = configs.map((config) => config.id);
    const items = configIds.length
        ? await db.select().from(promoItems).where(inArray(promoItems.configId, configIds)).orderBy(desc(promoItems.updatedAt))
        : [];
    const itemsByConfigId = new Map<string, PromoItemRow[]>();
    for (const item of items) {
        const current = itemsByConfigId.get(item.configId);
        if (current) current.push(item);
        else itemsByConfigId.set(item.configId, [item]);
    }

    const placements: PromoPlacement[] = [];
    for (const slot of slots) {
        if (!slot.enabled) continue;

        const shareCandidate = await buildShareCandidate(slot, itemsByConfigId, configs, query.promoProfileId, requestedDevice);
        if (shareCandidate?.placement) {
            placements.push(shareCandidate.placement);
            continue;
        }

        const globalCandidate = buildGlobalCandidate(slot, configs, itemsByConfigId, requestedDevice);
        if (globalCandidate?.placement) {
            placements.push(globalCandidate.placement);
            continue;
        }

        const legacyPlacement = buildLegacyPlacement(slot);
        if (legacyPlacement && slot.key === 'generation_form_header') {
            placements.push(legacyPlacement);
        }
    }

    return { placements };
}

export function validatePromoItemUrls(item: {
    desktopImageUrl: string;
    mobileImageUrl: string;
    linkUrl: string;
}): boolean {
    return Boolean(
        validatePromoRemoteUrl(item.desktopImageUrl).ok &&
            validatePromoRemoteUrl(item.mobileImageUrl).ok &&
            validatePromoRemoteUrl(item.linkUrl).ok
    );
}
