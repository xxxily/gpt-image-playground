import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { hashSha256Hex } from '@/lib/server/security';
import { promoConfigs, promoItems, promoShareKeys } from '@/lib/server/schema';
import { ensurePromoSlotsSeeded } from './seed';
import { getPromoPlacements } from './public';
import { upsertPromoShareProfile, validatePromoShareKey, type PromoShareItemInput } from './share';

const databasePath = path.join(os.tmpdir(), 'gpt-image-playground-promo-share.test.sqlite');
const SHARE_TOKEN = 'promo-share-token-for-tests';

process.env.ADMIN_DATABASE_PATH = databasePath;

async function resetPromoTables(): Promise<void> {
    await getServerDatabaseReady();
    getSqliteClient().exec(`
        DELETE FROM "promo_items";
        DELETE FROM "promo_configs";
        DELETE FROM "promo_share_profiles";
        DELETE FROM "promo_share_keys";
        DELETE FROM "audit_logs";
    `);
}

async function seedShareKey(
    input: {
        token?: string;
        id?: string;
        status?: 'active' | 'disabled' | 'revoked';
        expiresAt?: Date | null;
        allowedSlots?: string[];
    } = {}
): Promise<string> {
    await ensurePromoSlotsSeeded();
    const db = await getServerDatabaseReady();
    const token = input.token || SHARE_TOKEN;

    await db.insert(promoShareKeys).values({
        id: input.id || 'share-key-1',
        name: 'Share Key',
        note: 'test fixture',
        tokenPrefix: token.slice(0, 8),
        tokenHash: hashSha256Hex(token),
        status: input.status || 'active',
        expiresAt: input.expiresAt === undefined ? new Date('2099-01-01T00:00:00.000Z') : input.expiresAt,
        allowedSlotsJson: JSON.stringify(input.allowedSlots ?? ['generation_form_header']),
        createdByUserId: null
    });

    return token;
}

function shareItem(overrides: Partial<PromoShareItemInput> = {}): PromoShareItemInput {
    return {
        title: 'Share banner',
        alt: 'Share banner alt',
        desktopImageUrl: 'https://cdn.example/share.webp',
        mobileImageUrl: 'https://cdn.example/share-mobile.webp',
        linkUrl: 'https://share.example/promo',
        device: 'all',
        enabled: true,
        sortOrder: 0,
        weight: 100,
        ...overrides
    };
}

function removeDatabaseFiles(): void {
    for (const suffix of ['', '-wal', '-shm']) {
        try {
            fs.rmSync(`${databasePath}${suffix}`);
        } catch {
            // Best effort cleanup.
        }
    }
}

beforeAll(() => {
    removeDatabaseFiles();
});

afterEach(async () => {
    await resetPromoTables();
    delete process.env.PROMO_SHARE_CONFIG_ENABLED;
});

afterAll(() => {
    removeDatabaseFiles();
});

describe('promo share key validation', () => {
    it('validates active keys without returning token hashes', async () => {
        await seedShareKey();

        const result = await validatePromoShareKey(SHARE_TOKEN, 'generation_form_header');

        expect(result).toMatchObject({
            valid: true,
            allowedSlots: ['generation_form_header'],
            slotAllowed: true
        });
        expect(result.key?.tokenPrefix).toBe(SHARE_TOKEN.slice(0, 8));
        expect(Object.prototype.hasOwnProperty.call(result.key || {}, 'tokenHash')).toBe(false);
    });

    it('rejects keys outside their allowed slot list', async () => {
        await seedShareKey({ allowedSlots: ['history_top_banner'] });

        const result = await validatePromoShareKey(SHARE_TOKEN, 'generation_form_header');

        expect(result).toMatchObject({
            valid: false,
            reason: 'slot_not_allowed',
            allowedSlots: ['history_top_banner'],
            slotAllowed: false
        });
    });

    it('rejects expired keys and disabled share configuration', async () => {
        await seedShareKey({ expiresAt: new Date('2000-01-01T00:00:00.000Z') });

        await expect(validatePromoShareKey(SHARE_TOKEN, 'generation_form_header')).resolves.toMatchObject({
            valid: false,
            reason: 'expired'
        });

        process.env.PROMO_SHARE_CONFIG_ENABLED = 'false';
        await expect(validatePromoShareKey(SHARE_TOKEN, 'generation_form_header')).resolves.toMatchObject({
            valid: false,
            reason: 'disabled'
        });
    });
});

describe('promo share profile upsert', () => {
    it('creates and updates a share profile that can win public placement priority', async () => {
        await seedShareKey();

        const created = await upsertPromoShareProfile({
            shareKey: SHARE_TOKEN,
            name: 'Creator share profile',
            slotKey: 'generation_form_header',
            intervalMs: 3000,
            transition: 'slide',
            items: [shareItem()]
        });

        expect(created.promoProfileId).toBeTruthy();
        expect(created.config.scope).toBe('share');
        expect(created.items).toHaveLength(1);

        const firstPlacement = await getPromoPlacements({
            slots: ['generation_form_header'],
            promoProfileId: created.promoProfileId
        });
        expect(firstPlacement.placements[0]?.source).toBe('share');
        expect(firstPlacement.placements[0]?.items[0]?.title).toBe('Share banner');

        const updated = await upsertPromoShareProfile({
            shareKey: SHARE_TOKEN,
            promoProfileId: created.promoProfileId,
            name: 'Creator share profile updated',
            slotKey: 'generation_form_header',
            items: [
                shareItem({
                    title: 'Updated share banner',
                    desktopImageUrl: 'https://cdn.example/share-updated.webp',
                    mobileImageUrl: 'https://cdn.example/share-updated-mobile.webp'
                })
            ]
        });

        expect(updated.profile.id).toBe(created.profile.id);
        expect(updated.promoProfileId).toBe(created.promoProfileId);

        const db = await getServerDatabaseReady();
        const configs = await db
            .select()
            .from(promoConfigs)
            .where(eq(promoConfigs.shareProfileId, created.profile.id));
        const items = await db.select().from(promoItems).where(eq(promoItems.configId, updated.config.id));

        expect(configs).toHaveLength(1);
        expect(items).toHaveLength(1);
        expect(items[0]?.title).toBe('Updated share banner');
    });

    it('blocks expired keys and unsafe item URLs', async () => {
        await seedShareKey({ expiresAt: new Date('2000-01-01T00:00:00.000Z') });

        await expect(
            upsertPromoShareProfile({
                shareKey: SHARE_TOKEN,
                name: 'Expired profile',
                slotKey: 'generation_form_header',
                items: [shareItem()]
            })
        ).rejects.toThrow('权限 Key 已过期。');

        await resetPromoTables();
        await seedShareKey();

        await expect(
            upsertPromoShareProfile({
                shareKey: SHARE_TOKEN,
                name: 'Unsafe profile',
                slotKey: 'generation_form_header',
                items: [shareItem({ linkUrl: 'javascript:alert(1)' })]
            })
        ).rejects.toThrow('广告 URL 不合法。');
    });
});
