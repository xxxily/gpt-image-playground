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

export const promoKeyStatuses = ['active', 'disabled', 'revoked'] as const;
export type PromoKeyStatus = (typeof promoKeyStatuses)[number];

export const promoProfileStatuses = ['active', 'disabled'] as const;
export type PromoProfileStatus = (typeof promoProfileStatuses)[number];

const nowExpression = sql`(cast((julianday('now') - 2440587.5) * 86400000 as integer))`;

const timestampMs = (name: string) => integer(name, { mode: 'timestamp_ms' }).notNull().default(nowExpression);

export const authUsers = sqliteTable(
    'user',
    {
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
    }
);

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

export const promoSlots = sqliteTable(
    'promo_slots',
    {
        id: text('id').primaryKey(),
        key: text('key').notNull().unique(),
        name: text('name').notNull(),
        description: text('description'),
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
        defaultIntervalMs: integer('defaultIntervalMs').notNull().default(5000),
        defaultTransition: text('defaultTransition').notNull().default('fade'),
        createdAt: timestampMs('createdAt'),
        updatedAt: timestampMs('updatedAt')
    }
);

export const promoConfigs = sqliteTable(
    'promo_configs',
    {
        id: text('id').primaryKey(),
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
        actionIdx: index('audit_logs_action_idx').on(table.action)
    })
);

export const serverSchema = {
    user: authUsers,
    session: authSessions,
    account: authAccounts,
    verification: authVerifications,
    promo_slots: promoSlots,
    promo_configs: promoConfigs,
    promo_items: promoItems,
    promo_share_keys: promoShareKeys,
    promo_share_profiles: promoShareProfiles,
    audit_logs: auditLogs
} as const;

export type ServerSchema = typeof serverSchema;
