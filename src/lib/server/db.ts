import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { serverSchema } from '@/lib/server/schema';

type ServerDatabase = BetterSQLite3Database<typeof serverSchema> & {
    $client: Database.Database;
};

type DatabaseBundle = {
    client: Database.Database;
    db: ServerDatabase;
};

const DEFAULT_DATABASE_DIR = path.join('/tmp', 'gpt-image-playground');
const DEFAULT_DATABASE_PATH = path.join(DEFAULT_DATABASE_DIR, 'promo-admin.sqlite');

function resolveDatabasePath(): string {
    const configuredPath = process.env.ADMIN_DATABASE_PATH?.trim();
    if (!configuredPath) return DEFAULT_DATABASE_PATH;
    if (path.isAbsolute(configuredPath)) return configuredPath;
    return path.join(DEFAULT_DATABASE_DIR, configuredPath);
}

const createTableStatements = [
    `CREATE TABLE IF NOT EXISTS "user" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "emailVerified" INTEGER NOT NULL DEFAULT 0,
        "image" TEXT,
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "role" TEXT NOT NULL DEFAULT 'viewer',
        "status" TEXT NOT NULL DEFAULT 'active',
        "lastLoginAt" INTEGER
    );`,
    `CREATE TABLE IF NOT EXISTS "session" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "expiresAt" INTEGER NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("userId");`,
    `CREATE TABLE IF NOT EXISTS "account" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" INTEGER,
        "refreshTokenExpiresAt" INTEGER,
        "scope" TEXT,
        "password" TEXT,
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_idx" ON "account" ("providerId", "accountId");`,
    `CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("userId");`,
    `CREATE TABLE IF NOT EXISTS "verification" (
        "identifier" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expiresAt" INTEGER NOT NULL,
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer))
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");`,
    `CREATE TABLE IF NOT EXISTS "promo_slots" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "key" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "enabled" INTEGER NOT NULL DEFAULT 1,
        "defaultIntervalMs" INTEGER NOT NULL DEFAULT 5000,
        "defaultTransition" TEXT NOT NULL DEFAULT 'fade',
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer))
    );`,
    `CREATE TABLE IF NOT EXISTS "promo_share_keys" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "name" TEXT NOT NULL,
        "note" TEXT,
        "tokenPrefix" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL UNIQUE,
        "status" TEXT NOT NULL DEFAULT 'active',
        "expiresAt" INTEGER,
        "allowedSlotsJson" TEXT NOT NULL DEFAULT '[]',
        "createdByUserId" TEXT,
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "lastUsedAt" INTEGER,
        FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS "promo_share_keys_status_idx" ON "promo_share_keys" ("status");`,
    `CREATE INDEX IF NOT EXISTS "promo_share_keys_prefix_idx" ON "promo_share_keys" ("tokenPrefix");`,
    `CREATE TABLE IF NOT EXISTS "promo_share_profiles" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "publicId" TEXT NOT NULL UNIQUE,
        "shareKeyId" TEXT,
        "name" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "lastPublishedAt" INTEGER,
        FOREIGN KEY ("shareKeyId") REFERENCES "promo_share_keys"("id") ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS "promo_share_profiles_share_key_idx" ON "promo_share_profiles" ("shareKeyId");`,
    `CREATE TABLE IF NOT EXISTS "promo_configs" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "slotId" TEXT NOT NULL,
        "scope" TEXT NOT NULL,
        "shareProfileId" TEXT,
        "enabled" INTEGER NOT NULL DEFAULT 1,
        "intervalMs" INTEGER,
        "transition" TEXT,
        "startsAt" INTEGER,
        "endsAt" INTEGER,
        "createdByUserId" TEXT,
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        FOREIGN KEY ("slotId") REFERENCES "promo_slots"("id") ON DELETE CASCADE,
        FOREIGN KEY ("shareProfileId") REFERENCES "promo_share_profiles"("id") ON DELETE SET NULL,
        FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS "promo_configs_slot_scope_idx" ON "promo_configs" ("slotId", "scope");`,
    `CREATE INDEX IF NOT EXISTS "promo_configs_share_profile_idx" ON "promo_configs" ("shareProfileId");`,
    `CREATE TABLE IF NOT EXISTS "promo_items" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "configId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "alt" TEXT NOT NULL,
        "desktopImageUrl" TEXT NOT NULL,
        "mobileImageUrl" TEXT NOT NULL,
        "linkUrl" TEXT NOT NULL,
        "device" TEXT NOT NULL DEFAULT 'all',
        "enabled" INTEGER NOT NULL DEFAULT 1,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "weight" INTEGER NOT NULL DEFAULT 100,
        "startsAt" INTEGER,
        "endsAt" INTEGER,
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        "updatedAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        FOREIGN KEY ("configId") REFERENCES "promo_configs"("id") ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "promo_items_config_sort_idx" ON "promo_items" ("configId", "sortOrder");`,
    `CREATE INDEX IF NOT EXISTS "promo_items_config_weight_idx" ON "promo_items" ("configId", "weight");`,
    `CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "actorUserId" TEXT,
        "actorType" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "targetType" TEXT NOT NULL,
        "targetId" TEXT NOT NULL,
        "ip" TEXT,
        "userAgent" TEXT,
        "metadataJson" TEXT NOT NULL DEFAULT '{}',
        "createdAt" INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
        FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL
    );`,
    `CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" ("actorUserId");`,
    `CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");`
];

let bundle: DatabaseBundle | null = null;
let ensurePromise: Promise<void> | null = null;

function ensureDirectoryExists(databasePath: string): void {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function openBundle(): DatabaseBundle {
    if (bundle) return bundle;

    const databasePath = resolveDatabasePath();
    ensureDirectoryExists(databasePath);
    const client = new Database(databasePath);
    client.pragma('journal_mode = WAL');
    client.pragma('foreign_keys = ON');
    client.pragma('busy_timeout = 5000');
    client.pragma('synchronous = NORMAL');

    const db = drizzle(client, { schema: serverSchema }) as ServerDatabase;
    bundle = { client, db };
    return bundle;
}

export function getServerDatabase(): ServerDatabase {
    return openBundle().db;
}

export function getSqliteClient(): Database.Database {
    return openBundle().client;
}

export async function ensureServerSchema(): Promise<void> {
    if (!ensurePromise) {
        ensurePromise = Promise.resolve().then(() => {
            const client = getSqliteClient();
            for (const statement of createTableStatements) {
                client.exec(statement);
            }
        });
    }

    await ensurePromise;
}

export async function getServerDatabaseReady(): Promise<ServerDatabase> {
    await ensureServerSchema();
    return getServerDatabase();
}
