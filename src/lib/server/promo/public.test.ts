import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { promoConfigs, promoItems, promoShareKeys, promoShareProfiles } from '@/lib/server/schema';
import { ensurePromoSlotsSeeded } from './seed';
import { getPromoPlacements } from './public';
import { normalizePromoRemoteUrl, validatePromoRemoteUrl } from './url';

const databasePath = path.join(os.tmpdir(), 'gpt-image-playground-promo-public.test.sqlite');

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

async function seedSharePlacementFixture(input: { keyStatus?: 'active' | 'disabled' | 'revoked'; expiresAt?: Date | null } = {}): Promise<void> {
    const db = await getServerDatabaseReady();
    await ensurePromoSlotsSeeded();

    const shareKeyId = 'share-key-1';
    const shareProfileId = 'share-profile-1';
    const globalConfigId = 'global-config-1';
    const shareConfigId = 'share-config-1';

    await db.insert(promoShareKeys).values({
        id: shareKeyId,
        name: 'Share Key',
        note: 'fixture',
        tokenPrefix: 'share',
        tokenHash: 'hash-share-key-1',
        status: input.keyStatus || 'active',
        expiresAt: input.expiresAt === undefined ? new Date('2099-01-01T00:00:00.000Z') : input.expiresAt,
        allowedSlotsJson: JSON.stringify(['generation_form_header']),
        createdByUserId: null
    });

    await db.insert(promoShareProfiles).values({
        id: shareProfileId,
        publicId: 'promo-profile-1',
        shareKeyId,
        name: 'Share Profile',
        status: 'active'
    });

    await db.insert(promoConfigs).values({
        id: globalConfigId,
        slotId: 'generation_form_header',
        scope: 'global',
        enabled: true,
        intervalMs: 4500,
        transition: 'fade',
        startsAt: null,
        endsAt: null,
        shareProfileId: null,
        createdByUserId: null
    });

    await db.insert(promoItems).values({
        id: 'global-item-1',
        configId: globalConfigId,
        title: 'Global banner',
        alt: 'Global banner alt',
        desktopImageUrl: 'https://cdn.example/global.webp',
        mobileImageUrl: 'https://cdn.example/global-mobile.webp',
        linkUrl: 'https://global.example/promo',
        device: 'all',
        enabled: true,
        sortOrder: 0,
        weight: 100,
        startsAt: null,
        endsAt: null
    });

    await db.insert(promoConfigs).values({
        id: shareConfigId,
        slotId: 'generation_form_header',
        scope: 'share',
        enabled: true,
        intervalMs: 3000,
        transition: 'slide',
        startsAt: null,
        endsAt: null,
        shareProfileId,
        createdByUserId: null
    });

    await db.insert(promoItems).values({
        id: 'share-item-1',
        configId: shareConfigId,
        title: 'Share banner',
        alt: 'Share banner alt',
        desktopImageUrl: 'https://cdn.example/share.webp',
        mobileImageUrl: 'https://cdn.example/share-mobile.webp',
        linkUrl: 'https://share.example/promo',
        device: 'all',
        enabled: true,
        sortOrder: 0,
        weight: 100,
        startsAt: null,
        endsAt: null
    });
}

beforeAll(() => {
    try {
        fs.rmSync(databasePath);
    } catch {
        // Fresh file is fine.
    }
});

afterEach(async () => {
    await resetPromoTables();
    delete process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED;
    delete process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL;
    delete process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_LINK_URL;
    delete process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_ALT;
});

afterAll(() => {
    try {
        fs.rmSync(databasePath);
    } catch {
        // Best effort cleanup.
    }
});

describe('promo url safety', () => {
    it('accepts public http and https URLs', () => {
        expect(validatePromoRemoteUrl('https://cdn.example/banner.webp')).toEqual({
            ok: true,
            normalizedUrl: 'https://cdn.example/banner.webp'
        });
        expect(normalizePromoRemoteUrl('relay.example.com/banner.webp')).toBe('https://relay.example.com/banner.webp');
    });

    it('rejects unsafe protocols and local hosts', () => {
        expect(validatePromoRemoteUrl('javascript:alert(1)').ok).toBe(false);
        expect(validatePromoRemoteUrl('http://127.0.0.1/banner.webp').ok).toBe(false);
        expect(validatePromoRemoteUrl('http://metadata.google.internal/banner.webp').ok).toBe(false);
    });
});

describe('promo placements', () => {
    it('prefers share placements over global placements', async () => {
        await seedSharePlacementFixture();

        const result = await getPromoPlacements({
            slots: ['generation_form_header'],
            promoProfileId: 'promo-profile-1'
        });

        expect(result.placements).toHaveLength(1);
        expect(result.placements[0]?.source).toBe('share');
        expect(result.placements[0]?.items[0]).toMatchObject({
            title: 'Share banner',
            desktopImageUrl: 'https://cdn.example/share.webp',
            mobileImageUrl: 'https://cdn.example/share-mobile.webp',
            linkUrl: 'https://share.example/promo'
        });
    });

    it('hides share placements when the key is expired', async () => {
        await seedSharePlacementFixture({ expiresAt: new Date('2000-01-01T00:00:00.000Z') });

        const result = await getPromoPlacements({
            slots: ['generation_form_header'],
            promoProfileId: 'promo-profile-1'
        });

        expect(result.placements).toHaveLength(1);
        expect(result.placements[0]?.source).toBe('global');
    });

    it('hides share placements when the key is revoked and no fallback exists', async () => {
        const db = await getServerDatabaseReady();
        await ensurePromoSlotsSeeded();

        await db.insert(promoShareKeys).values({
            id: 'revoked-key-1',
            name: 'Revoked Key',
            note: 'fixture',
            tokenPrefix: 'revoked',
            tokenHash: 'hash-revoked-key-1',
            status: 'revoked',
            expiresAt: new Date('2099-01-01T00:00:00.000Z'),
            allowedSlotsJson: JSON.stringify(['generation_form_header']),
            createdByUserId: null
        });

        await db.insert(promoShareProfiles).values({
            id: 'revoked-profile-1',
            publicId: 'revoked-promo-profile-1',
            shareKeyId: 'revoked-key-1',
            name: 'Revoked Profile',
            status: 'active'
        });

        await db.insert(promoConfigs).values({
            id: 'revoked-share-config-1',
            slotId: 'generation_form_header',
            scope: 'share',
            enabled: true,
            intervalMs: 3000,
            transition: 'fade',
            startsAt: null,
            endsAt: null,
            shareProfileId: 'revoked-profile-1',
            createdByUserId: null
        });

        await db.insert(promoItems).values({
            id: 'revoked-share-item-1',
            configId: 'revoked-share-config-1',
            title: 'Revoked share banner',
            alt: 'Revoked share banner alt',
            desktopImageUrl: 'https://cdn.example/revoked.webp',
            mobileImageUrl: 'https://cdn.example/revoked-mobile.webp',
            linkUrl: 'https://revoked.example/promo',
            device: 'all',
            enabled: true,
            sortOrder: 0,
            weight: 100,
            startsAt: null,
            endsAt: null
        });

        const result = await getPromoPlacements({
            slots: ['generation_form_header'],
            promoProfileId: 'revoked-promo-profile-1'
        });

        expect(result.placements).toHaveLength(0);
    });

    it('falls back to the legacy env banner and keeps local public paths', async () => {
        process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED = 'true';
        process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL = '/ad/header-banner.webp';
        process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_LINK_URL = 'https://sponsor.example/path';
        process.env.NEXT_PUBLIC_GENERATION_HEADER_AD_ALT = ' Sponsor ';

        const result = await getPromoPlacements({
            slots: ['generation_form_header']
        });

        expect(result.placements).toHaveLength(1);
        expect(result.placements[0]?.source).toBe('legacy');
        expect(result.placements[0]?.items[0]).toMatchObject({
            title: 'Sponsor',
            alt: 'Sponsor',
            desktopImageUrl: '/ad/header-banner.webp',
            mobileImageUrl: '/ad/header-banner.webp',
            linkUrl: 'https://sponsor.example/path'
        });
    });
});
