import { sql } from 'drizzle-orm';
import { integer, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const adminRoles = ['owner', 'admin', 'viewer'] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminStatuses = ['active', 'disabled'] as const;
export type AdminStatus = (typeof adminStatuses)[number];

export const promoScopes = ['global', 'share'] as const;
export type PromoScope = (typeof promoScopes)[number];

export const promoTransitions = ['fade', 'slide', 'none'] as const;
export type PromoTransition = (typeof promoTransitions)[number];

export const promoDevices = ['all', 'desktop', 'mobile'] as const;
export type PromoDevice = (typeof promoDevices)[number];

export const promoAspectRatioSources = ['preset', 'custom', 'legacySlot'] as const;
export type PromoAspectRatioSource = (typeof promoAspectRatioSources)[number];

export const promoKeyStatuses = ['active', 'disabled', 'revoked'] as const;
export type PromoKeyStatus = (typeof promoKeyStatuses)[number];

export const promoProfileStatuses = ['active', 'disabled'] as const;
export type PromoProfileStatus = (typeof promoProfileStatuses)[number];

export const shortLinkStatuses = ['active', 'disabled', 'deleted'] as const;
export type ShortLinkStatus = (typeof shortLinkStatuses)[number];

export const shortLinkPromoModes = ['inherit', 'none', 'override'] as const;
export type ShortLinkPromoMode = (typeof shortLinkPromoModes)[number];

export const shortLinkCreatedByTypes = ['admin', 'passphrase', 'public'] as const;
export type ShortLinkCreatedByType = (typeof shortLinkCreatedByTypes)[number];

export const shortLinkCreationModes = ['disabled', 'admin', 'passphrase', 'public'] as const;
export type ShortLinkCreationMode = (typeof shortLinkCreationModes)[number];

export const publicActionConfigKinds = ['api_key_purchase'] as const;
export type PublicActionConfigKind = (typeof publicActionConfigKinds)[number];

const nowExpression = sql`(cast((julianday('now') - 2440587.5) * 86400000 as integer))`;

const timestampMs = (name: string) => integer(name, { mode: 'timestamp_ms' }).notNull().default(nowExpression);

export const authUsers = sqliteTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: timestampMs('createdAt'),
    updatedAt: timestampMs('updatedAt'),
    role: text('role').notNull().default('viewer'),
    status: text('status').notNull().default('active'),
    lastLoginAt: integer('lastLoginAt', { mode: 'timestamp_ms' })
});

export const authSessions = sqliteTable(
    'session',
    {
        id: text('id').primaryKey(),
        expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
        token: text('token').notNull().unique(),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt'),
        ipAddress: text('ipAddress'),
        userAgent: text('userAgent'),
        userId: text('userId')
            .notNull()
            .references(() => authUsers.id, { onDelete: 'cascade' })
    },
    (table) => ({
        userIdIdx: index('session_user_id_idx').on(table.userId)
    })
);

export const authAccounts = sqliteTable(
    'account',
    {
        id: text('id').primaryKey(),
        accountId: text('accountId').notNull(),
        providerId: text('providerId').notNull(),
        userId: text('userId')
            .notNull()
            .references(() => authUsers.id, { onDelete: 'cascade' }),
        accessToken: text('accessToken'),
        refreshToken: text('refreshToken'),
        idToken: text('idToken'),
        accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
        refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
        scope: text('scope'),
        password: text('password'),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt')
    },
    (table) => ({
        providerAccountIdx: uniqueIndex('account_provider_account_idx').on(table.providerId, table.accountId),
        userIdIdx: index('account_user_id_idx').on(table.userId)
    })
);

export const authVerifications = sqliteTable(
    'verification',
    {
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt')
    },
    (table) => ({
        identifierIdx: uniqueIndex('verification_identifier_idx').on(table.identifier)
    })
);

export const promoSlots = sqliteTable('promo_slots', {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    defaultIntervalMs: integer('defaultIntervalMs').notNull().default(5000),
    defaultTransition: text('defaultTransition').notNull().default('fade'),
    createdAt: timestampMs('createdAt'),
    updatedAt: timestampMs('updatedAt')
});

export const adminPublicActionConfigs = sqliteTable(
    'admin_public_action_configs',
    {
        id: text('id').primaryKey(),
        kind: text('kind').notNull().$type<PublicActionConfigKind>(),
        name: text('name').notNull(),
        buttonLabel: text('buttonLabel').notNull(),
        targetUrl: text('targetUrl').notNull(),
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
        active: integer('active', { mode: 'boolean' }).notNull().default(false),
        description: text('description'),
        sortOrder: integer('sortOrder').notNull().default(0),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt'),
        updatedByUserId: text('updatedByUserId').references(() => authUsers.id, { onDelete: 'set null' })
    },
    (table) => ({
        kindActiveIdx: index('admin_public_action_configs_kind_active_idx').on(table.kind, table.active),
        kindEnabledIdx: index('admin_public_action_configs_kind_enabled_idx').on(table.kind, table.enabled),
        updatedAtIdx: index('admin_public_action_configs_updated_at_idx').on(table.updatedAt)
    })
);

export const promoConfigs = sqliteTable(
    'promo_configs',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull().default('展示组'),
        note: text('note'),
        slotId: text('slotId')
            .notNull()
            .references(() => promoSlots.id, { onDelete: 'cascade' }),
        scope: text('scope').notNull().$type<PromoScope>(),
        shareProfileId: text('shareProfileId').references(() => promoShareProfiles.id, {
            onDelete: 'set null'
        }),
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
        intervalMs: integer('intervalMs'),
        transition: text('transition').$type<PromoTransition>(),
        aspectRatioWidth: integer('aspectRatioWidth'),
        aspectRatioHeight: integer('aspectRatioHeight'),
        aspectRatioLabel: text('aspectRatioLabel'),
        aspectRatioSource: text('aspectRatioSource').$type<PromoAspectRatioSource>(),
        constraintsJson: text('constraintsJson'),
        startsAt: integer('startsAt', { mode: 'timestamp_ms' }),
        endsAt: integer('endsAt', { mode: 'timestamp_ms' }),
        createdByUserId: text('createdByUserId').references(() => authUsers.id, { onDelete: 'set null' }),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt')
    },
    (table) => ({
        slotScopeIdx: index('promo_configs_slot_scope_idx').on(table.slotId, table.scope),
        shareProfileIdx: index('promo_configs_share_profile_idx').on(table.shareProfileId)
    })
);

export const promoItems = sqliteTable(
    'promo_items',
    {
        id: text('id').primaryKey(),
        configId: text('configId')
            .notNull()
            .references(() => promoConfigs.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        alt: text('alt').notNull(),
        desktopImageUrl: text('desktopImageUrl').notNull(),
        mobileImageUrl: text('mobileImageUrl').notNull(),
        linkUrl: text('linkUrl').notNull(),
        device: text('device').notNull().default('all').$type<PromoDevice>(),
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
        sortOrder: integer('sortOrder').notNull().default(0),
        weight: integer('weight').notNull().default(100),
        startsAt: integer('startsAt', { mode: 'timestamp_ms' }),
        endsAt: integer('endsAt', { mode: 'timestamp_ms' }),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt')
    },
    (table) => ({
        configSortIdx: index('promo_items_config_sort_idx').on(table.configId, table.sortOrder),
        configWeightIdx: index('promo_items_config_weight_idx').on(table.configId, table.weight)
    })
);

export const promoShareKeys = sqliteTable(
    'promo_share_keys',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        note: text('note'),
        tokenPrefix: text('tokenPrefix').notNull(),
        tokenHash: text('tokenHash').notNull().unique(),
        status: text('status').notNull().default('active').$type<PromoKeyStatus>(),
        expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }),
        allowedSlotsJson: text('allowedSlotsJson').notNull().default('[]'),
        createdByUserId: text('createdByUserId').references(() => authUsers.id, {
            onDelete: 'set null'
        }),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt'),
        lastUsedAt: integer('lastUsedAt', { mode: 'timestamp_ms' })
    },
    (table) => ({
        statusIdx: index('promo_share_keys_status_idx').on(table.status),
        prefixIdx: index('promo_share_keys_prefix_idx').on(table.tokenPrefix)
    })
);

export const promoShareProfiles = sqliteTable(
    'promo_share_profiles',
    {
        id: text('id').primaryKey(),
        publicId: text('publicId').notNull().unique(),
        shareKeyId: text('shareKeyId').references(() => promoShareKeys.id, {
            onDelete: 'set null'
        }),
        name: text('name').notNull(),
        status: text('status').notNull().default('active').$type<PromoProfileStatus>(),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt'),
        lastPublishedAt: integer('lastPublishedAt', { mode: 'timestamp_ms' })
    },
    (table) => ({
        shareKeyIdx: index('promo_share_profiles_share_key_idx').on(table.shareKeyId)
    })
);

export const shortLinkSettings = sqliteTable('short_link_settings', {
    id: text('id').primaryKey(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    creationMode: text('creationMode').notNull().default('disabled').$type<ShortLinkCreationMode>(),
    passphraseHash: text('passphraseHash'),
    codeLength: integer('codeLength').notNull().default(12),
    defaultExpiresInDays: integer('defaultExpiresInDays').notNull().default(90),
    maxTargetUrlLength: integer('maxTargetUrlLength').notNull().default(8192),
    allowSensitiveTargets: integer('allowSensitiveTargets', { mode: 'boolean' }).notNull().default(false),
    allowInlineSecurePassword: integer('allowInlineSecurePassword', { mode: 'boolean' }).notNull().default(false),
    allowedOriginsJson: text('allowedOriginsJson').notNull().default('[]'),
    visitRetentionDays: integer('visitRetentionDays').notNull().default(90),
    createdAt: timestampMs('createdAt'),
    updatedAt: timestampMs('updatedAt')
});

export const shortLinks = sqliteTable(
    'short_links',
    {
        id: text('id').primaryKey(),
        code: text('code').notNull().unique(),
        targetUrl: text('targetUrl').notNull(),
        targetUrlHash: text('targetUrlHash').notNull(),
        targetSummaryJson: text('targetSummaryJson').notNull().default('{}'),
        status: text('status').notNull().default('active').$type<ShortLinkStatus>(),
        promoMode: text('promoMode').notNull().default('inherit').$type<ShortLinkPromoMode>(),
        promoProfileId: text('promoProfileId').references(() => promoShareProfiles.id, {
            onDelete: 'set null'
        }),
        note: text('note'),
        createdByUserId: text('createdByUserId').references(() => authUsers.id, {
            onDelete: 'set null'
        }),
        createdByType: text('createdByType').notNull().default('passphrase').$type<ShortLinkCreatedByType>(),
        creationKeyHash: text('creationKeyHash'),
        expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }),
        maxVisits: integer('maxVisits'),
        visitCount: integer('visitCount').notNull().default(0),
        uniqueVisitorCount: integer('uniqueVisitorCount').notNull().default(0),
        lastVisitedAt: integer('lastVisitedAt', { mode: 'timestamp_ms' }),
        clientRequestId: text('clientRequestId'),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt')
    },
    (table) => ({
        codeIdx: uniqueIndex('short_links_code_idx').on(table.code),
        targetHashIdx: index('short_links_target_hash_idx').on(table.targetUrlHash),
        statusIdx: index('short_links_status_idx').on(table.status),
        promoProfileIdx: index('short_links_promo_profile_idx').on(table.promoProfileId),
        clientRequestIdx: uniqueIndex('short_links_client_request_idx').on(table.clientRequestId),
        createdAtIdx: index('short_links_created_at_idx').on(table.createdAt),
        lastVisitedAtIdx: index('short_links_last_visited_at_idx').on(table.lastVisitedAt)
    })
);

export const shortLinkVisits = sqliteTable(
    'short_link_visits',
    {
        id: text('id').primaryKey(),
        shortLinkId: text('shortLinkId')
            .notNull()
            .references(() => shortLinks.id, { onDelete: 'cascade' }),
        visitedAt: timestampMs('visitedAt'),
        ipHash: text('ipHash').notNull(),
        userAgentHash: text('userAgentHash'),
        refererHost: text('refererHost'),
        deviceType: text('deviceType').notNull().default('unknown'),
        browser: text('browser'),
        os: text('os'),
        method: text('method').notNull().default('GET'),
        status: text('status').notNull().default('redirected')
    },
    (table) => ({
        shortLinkVisitedAtIdx: index('short_link_visits_link_visited_idx').on(table.shortLinkId, table.visitedAt),
        visitorIdx: index('short_link_visits_visitor_idx').on(table.shortLinkId, table.ipHash, table.userAgentHash),
        statusIdx: index('short_link_visits_status_idx').on(table.status)
    })
);

export const auditLogs = sqliteTable(
    'audit_logs',
    {
        id: text('id').primaryKey(),
        actorUserId: text('actorUserId').references(() => authUsers.id, { onDelete: 'set null' }),
        actorType: text('actorType').notNull(),
        action: text('action').notNull(),
        targetType: text('targetType').notNull(),
        targetId: text('targetId').notNull(),
        ip: text('ip'),
        userAgent: text('userAgent'),
        metadataJson: text('metadataJson').notNull().default('{}'),
        createdAt: timestampMs('createdAt')
    },
    (table) => ({
        actorIdx: index('audit_logs_actor_idx').on(table.actorUserId),
        actionIdx: index('audit_logs_action_idx').on(table.action),
        createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt)
    })
);

export const serverSchema = {
    user: authUsers,
    session: authSessions,
    account: authAccounts,
    verification: authVerifications,
    admin_public_action_configs: adminPublicActionConfigs,
    promo_slots: promoSlots,
    promo_configs: promoConfigs,
    promo_items: promoItems,
    promo_share_keys: promoShareKeys,
    promo_share_profiles: promoShareProfiles,
    short_link_settings: shortLinkSettings,
    short_links: shortLinks,
    short_link_visits: shortLinkVisits,
    audit_logs: auditLogs
} as const;

export type ServerSchema = typeof serverSchema;
