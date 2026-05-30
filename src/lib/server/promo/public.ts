import { desc, eq, inArray } from 'drizzle-orm';
import { getGenerationHeaderAdConfig } from '@/lib/ad-config';
import { getServerDatabaseReady } from '@/lib/server/db';
import {
    promoConfigs,
    promoItems,
    promoShareKeys,
    promoShareProfiles,
    promoSlots,
} from '@/lib/server/schema';
import {
    PROMO_ALLOWED_ITEM_FIELDS,
    PROMO_ASPECT_RATIO_PRESETS,
    PROMO_ALT_MAX_LENGTH,
    PROMO_DEFAULT_INTERVAL_MS,
    PROMO_DEFAULT_TRANSITION,
    PROMO_MAX_ASPECT_RATIO_EDGE,
    PROMO_MAX_DOMAIN_RULES,
    PROMO_MIN_INTERVAL_MS,
    buildPromoAspectRatio,
    evaluatePromoConstraintSet,
    getDefaultPromoAspectRatioForSlot,
    type PromoCapabilities,
    type PromoCapabilitySlot,
    type PromoConstraintEvaluationContext,
    type PromoDevice,
    type PromoPlacement,
    type PromoPlacementItem,
    type PromoPlacementSource,
    PROMO_URL_MAX_LENGTH,
    PROMO_TITLE_MAX_LENGTH
} from '@/lib/promo';
import { ensurePromoSlotsSeeded } from '@/lib/server/promo/seed';
import { normalizePromoImageUrl, normalizePromoRemoteUrl, validatePromoImageUrl, validatePromoRemoteUrl } from '@/lib/server/promo/url';

type PromoSlotRow = typeof promoSlots.$inferSelect;
type PromoConfigRow = typeof promoConfigs.$inferSelect;
type PromoItemRow = typeof promoItems.$inferSelect;
type PromoShareKeyRow = typeof promoShareKeys.$inferSelect;
type PromoShareProfileRow = typeof promoShareProfiles.$inferSelect;

export type PromoPlacementsQuery = {
    slots?: string[];
    surface?: string | null;
    device?: string | null;
    promoProfileId?: string | null;
    requestHost?: string | null;
    now?: Date;
};

export type PromoPlacementsResponse = {
    placements: PromoPlacement[];
};

export type PromoCapabilitiesResponse = PromoCapabilities;

type PromoResolvedCandidate = {
    placement: PromoPlacement | null;
    source: PromoPlacementSource;
    constraintStrength: number;
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

export function isPromoShareConfigEnabled(): boolean {
    return process.env.PROMO_SHARE_CONFIG_ENABLED !== 'false';
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
    const desktopImage = normalizePromoImageUrl(row.desktopImageUrl);
    const mobileImage = normalizePromoImageUrl(row.mobileImageUrl);
    const resolvedImage = desktopImage || mobileImage;
    const linkUrl = row.linkUrl.trim() ? normalizePromoRemoteUrl(row.linkUrl) : '';
    if (!resolvedImage) return null;
    if (row.linkUrl.trim() && !linkUrl) return null;
    if (row.title.length > PROMO_TITLE_MAX_LENGTH) return null;
    if (row.alt.length > PROMO_ALT_MAX_LENGTH) return null;

    return {
        title: row.title.trim(),
        alt: row.alt.trim(),
        desktopImageUrl: desktopImage || resolvedImage,
        mobileImageUrl: mobileImage || resolvedImage,
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

function buildPlacement(
    slot: PromoSlotRow,
    source: PromoPlacementSource,
    items: PromoPlacementItem[],
    intervalMs?: number | null,
    transition?: string | null,
    config?: PromoConfigRow | null
): PromoPlacement {
    return {
        slotKey: slot.key,
        slotName: slot.name,
        description: slot.description,
        enabled: slot.enabled,
        intervalMs: clampInterval(intervalMs, slot.defaultIntervalMs || PROMO_DEFAULT_INTERVAL_MS),
        transition: normalizeTransition(transition || slot.defaultTransition),
        source,
        aspectRatio: config
            ? buildPromoAspectRatio(
                  config.aspectRatioWidth,
                  config.aspectRatioHeight,
                  config.aspectRatioLabel,
                  config.aspectRatioSource,
                  slot.key
              )
            : getDefaultPromoAspectRatioForSlot(slot.key),
        items: sortPromoItems(items)
    };
}

function getValidPromoItemsForConfig(
    configId: string,
    itemsByConfigId: Map<string, PromoItemRow[]>,
    requestedDevice: PromoDevice,
    now: number
): PromoPlacementItem[] {
    return (itemsByConfigId.get(configId) || [])
        .filter((item) => item.enabled && isWithinWindow(now, item.startsAt, item.endsAt))
        .filter((item) => matchesDevice(normalizeDevice(item.device), requestedDevice))
        .map(toPublicItem)
        .filter((item): item is PromoPlacementItem => !!item);
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
        aspectRatio: getDefaultPromoAspectRatioForSlot(slot.key),
        items: [
            {
                title: legacy.alt.trim() || '横幅内容',
                alt: legacy.alt.trim() || '横幅内容',
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

async function loadPromoProfileContext(promoProfileId: string | null | undefined): Promise<PromoShareProfileRow | null> {
    if (!promoProfileId?.trim()) return null;
    const db = await getServerDatabaseReady();
    const [profile] = await db.select().from(promoShareProfiles).where(eq(promoShareProfiles.publicId, promoProfileId.trim())).limit(1);
    if (!profile) return null;
    if (profile.status !== 'active') return null;
    if (profile.shareKeyId) {
        const [shareKey] = await db.select().from(promoShareKeys).where(eq(promoShareKeys.id, profile.shareKeyId)).limit(1);
        if (!isUsablePromoShareKey(shareKey)) return null;
    }
    return profile;
}

function isUsablePromoShareKey(shareKey: PromoShareKeyRow | undefined): boolean {
    if (!shareKey) return false;
    if (shareKey.status !== 'active') return false;
    if (shareKey.expiresAt && shareKey.expiresAt.getTime() < Date.now()) return false;
    return true;
}

async function buildShareCandidate(
    slot: PromoSlotRow,
    itemsByConfigId: Map<string, PromoItemRow[]>,
    configs: PromoConfigRow[],
    promoProfileId: string | null | undefined,
    requestedDevice: PromoDevice,
    context: PromoConstraintEvaluationContext
): Promise<PromoResolvedCandidate | null> {
    if (!isPromoShareConfigEnabled()) return null;
    if (!promoProfileId?.trim()) return null;
    const profile = await loadPromoProfileContext(promoProfileId);
    if (!profile) return null;

    const now = context.now?.getTime() ?? Date.now();
    const shareConfigMatches = [...configs]
        .filter((config) => config.slotId === slot.id && config.scope === 'share' && config.enabled)
        .filter((config) => config.shareProfileId === profile.id)
        .map((config) => ({
            config,
            constraint: evaluatePromoConstraintSet(config.constraintsJson, context)
        }))
        .filter(({ config, constraint }) => constraint.matches && isWithinWindow(now, config.startsAt, config.endsAt))
        .sort(
            (a, b) =>
                b.constraint.strength - a.constraint.strength ||
                b.config.updatedAt.getTime() - a.config.updatedAt.getTime() ||
                b.config.createdAt.getTime() - a.config.createdAt.getTime()
        );

    for (const { config: shareConfig, constraint } of shareConfigMatches) {
        const validItems = getValidPromoItemsForConfig(shareConfig.id, itemsByConfigId, requestedDevice, now);
        if (validItems.length === 0) continue;
        return {
            source: 'share',
            placement: buildPlacement(slot, 'share', validItems, shareConfig.intervalMs, shareConfig.transition, shareConfig),
            constraintStrength: constraint.strength
        };
    }

    return null;
}

function buildGlobalCandidate(
    slot: PromoSlotRow,
    configs: PromoConfigRow[],
    itemsByConfigId: Map<string, PromoItemRow[]>,
    requestedDevice: PromoDevice,
    context: PromoConstraintEvaluationContext
): PromoResolvedCandidate | null {
    const now = context.now?.getTime() ?? Date.now();
    const globalConfigMatches = [...configs]
        .filter((config) => config.slotId === slot.id && config.scope === 'global' && config.enabled)
        .map((config) => ({
            config,
            constraint: evaluatePromoConstraintSet(config.constraintsJson, context)
        }))
        .filter(({ config, constraint }) => constraint.matches && isWithinWindow(now, config.startsAt, config.endsAt))
        .sort(
            (a, b) =>
                b.constraint.strength - a.constraint.strength ||
                b.config.updatedAt.getTime() - a.config.updatedAt.getTime() ||
                b.config.createdAt.getTime() - a.config.createdAt.getTime()
        );

    for (const { config: globalConfig, constraint } of globalConfigMatches) {
        const validItems = getValidPromoItemsForConfig(globalConfig.id, itemsByConfigId, requestedDevice, now);
        if (validItems.length === 0) continue;
        return {
            source: 'global',
            placement: buildPlacement(slot, 'global', validItems, globalConfig.intervalMs, globalConfig.transition, globalConfig),
            constraintStrength: constraint.strength
        };
    }

    return null;
}

export async function getPromoCapabilities(): Promise<PromoCapabilitiesResponse> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    const slots = await db.select().from(promoSlots).orderBy(desc(promoSlots.key));

    return {
        shareProfilesEnabled: isPromoShareConfigEnabled(),
        slots: slots.map<PromoCapabilitySlot>((slot) => ({
            key: slot.key,
            name: slot.name,
            description: slot.description,
            enabled: slot.enabled,
            defaultIntervalMs: clampInterval(slot.defaultIntervalMs, PROMO_DEFAULT_INTERVAL_MS),
            defaultTransition: normalizeTransition(slot.defaultTransition)
        })),
        aspectRatios: {
            presets: PROMO_ASPECT_RATIO_PRESETS,
            maxEdgeRatio: PROMO_MAX_ASPECT_RATIO_EDGE
        },
        constraints: {
            types: [
                {
                    type: 'domain',
                    label: '显示域名',
                    editor: 'domainAllowlist',
                    defaultEnabled: false,
                    maxRules: PROMO_MAX_DOMAIN_RULES
                }
            ]
        },
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
    const context: PromoConstraintEvaluationContext = {
        now: query.now || new Date(),
        requestHost: query.requestHost ?? null,
        device: requestedDevice,
        surface: query.surface ?? null,
        promoProfileId: query.promoProfileId ?? null,
        runtime: 'web'
    };
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

        const shareCandidate = await buildShareCandidate(
            slot,
            itemsByConfigId,
            configs,
            query.promoProfileId,
            requestedDevice,
            context
        );
        if (shareCandidate?.placement) {
            placements.push(shareCandidate.placement);
            continue;
        }

        const globalCandidate = buildGlobalCandidate(slot, configs, itemsByConfigId, requestedDevice, context);
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
    const desktopImageValid = item.desktopImageUrl.trim() ? validatePromoImageUrl(item.desktopImageUrl).ok : false;
    const mobileImageValid = item.mobileImageUrl.trim() ? validatePromoImageUrl(item.mobileImageUrl).ok : false;
    const linkValid = item.linkUrl.trim() ? validatePromoRemoteUrl(item.linkUrl).ok : true;
    return Boolean((desktopImageValid || mobileImageValid) && linkValid);
}
