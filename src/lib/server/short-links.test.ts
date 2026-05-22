import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { promoShareProfiles, shortLinks, shortLinkSettings } from '@/lib/server/schema';
import { createPublicShortLink, resolveShortLinkRedirect } from './short-links';

const databasePath = path.join(os.tmpdir(), 'gpt-image-playground-short-links.test.sqlite');

process.env.ADMIN_DATABASE_PATH = databasePath;
process.env.SHORT_LINK_TARGET_SECRET = 'short-link-test-secret';
process.env.BETTER_AUTH_SECRET = 'short-link-auth-secret';

function makeRequest(url = 'https://app.example/'): NextRequest {
    return new NextRequest(url, {
        headers: {
            'user-agent': 'vitest browser',
            'x-forwarded-for': '203.0.113.10'
        }
    });
}

async function resetShortLinkTables(): Promise<void> {
    await getServerDatabaseReady();
    getSqliteClient().exec(`
        DELETE FROM "short_link_visits";
        DELETE FROM "short_links";
        DELETE FROM "short_link_settings";
        DELETE FROM "promo_share_profiles";
        DELETE FROM "audit_logs";
    `);
}

async function enablePublicShortLinks(): Promise<void> {
    const db = await getServerDatabaseReady();
    await db.insert(shortLinkSettings).values({
        id: 'default',
        enabled: true,
        creationMode: 'public',
        codeLength: 10,
        defaultExpiresInDays: 90,
        maxTargetUrlLength: 8192,
        allowSensitiveTargets: false,
        allowInlineSecurePassword: false,
        allowedOriginsJson: JSON.stringify(['https://app.example']),
        visitRetentionDays: 90
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
    await resetShortLinkTables();
});

afterAll(() => {
    try {
        fs.rmSync(databasePath);
    } catch {
        // Best effort cleanup.
    }
});

describe('short links', () => {
    it('creates a public short link only for recognizable share URLs', async () => {
        await enablePublicShortLinks();
        const result = await createPublicShortLink(makeRequest(), {
            targetUrl: 'https://app.example/?prompt=hello&model=gpt-image-1',
            clientRequestId: 'create-1'
        });

        expect(result.shortUrl).toBe(`https://app.example/s/${result.link.code}`);
        expect(result.link.code).toHaveLength(10);

        const redirect = await resolveShortLinkRedirect(makeRequest(`https://app.example/s/${result.link.code}`), result.link.code);
        expect(redirect.ok).toBe(true);
        if (redirect.ok) {
            expect(redirect.url).toContain('prompt=hello');
            expect(redirect.url).toContain('model=gpt-image-1');
        }
    });

    it('deduplicates creation by clientRequestId', async () => {
        await enablePublicShortLinks();
        const first = await createPublicShortLink(makeRequest(), {
            targetUrl: 'https://app.example/?prompt=hello',
            clientRequestId: 'same-request'
        });
        const second = await createPublicShortLink(makeRequest(), {
            targetUrl: 'https://app.example/?prompt=hello',
            clientRequestId: 'same-request'
        });

        expect(second.link.id).toBe(first.link.id);
        const db = await getServerDatabaseReady();
        const rows = await db.select().from(shortLinks);
        expect(rows).toHaveLength(1);
    });

    it('rejects unsafe or sensitive targets by default', async () => {
        await enablePublicShortLinks();
        await expect(
            createPublicShortLink(makeRequest(), {
                targetUrl: 'javascript:alert(1)',
                clientRequestId: 'bad-protocol'
            })
        ).rejects.toThrow('http 或 https');
        await expect(
            createPublicShortLink(makeRequest(), {
                targetUrl: 'https://app.example/?apiKey=secret&prompt=hello',
                clientRequestId: 'api-key'
            })
        ).rejects.toThrow('密码加密分享');
        await expect(
            createPublicShortLink(makeRequest(), {
                targetUrl: 'https://app.example/s/abcdefghi',
                clientRequestId: 'recursive'
            })
        ).rejects.toThrow('另一个短链');
    });

    it('allows encrypted share short links that carry an inline decrypt key', async () => {
        await enablePublicShortLinks();
        const result = await createPublicShortLink(makeRequest(), {
            targetUrl: 'https://app.example/?sdata=encrypted-payload&source=gpt-image-playground#key=decrypt-key',
            clientRequestId: 'inline-key'
        });

        expect(result.warnings).toContain('inline-password-stored');

        const redirect = await resolveShortLinkRedirect(makeRequest(`https://app.example/s/${result.link.code}`), result.link.code);
        expect(redirect.ok).toBe(true);
        if (redirect.ok) {
            expect(redirect.url).toContain('sdata=encrypted-payload');
            expect(redirect.url).toContain('#key=decrypt-key');
        }
    });

    it('overrides promoProfileId when the short link is bound to a profile', async () => {
        await enablePublicShortLinks();
        const db = await getServerDatabaseReady();
        await db.insert(promoShareProfiles).values({
            id: 'profile-1',
            publicId: 'promo-public-1',
            name: 'Share profile',
            status: 'active'
        });
        const result = await createPublicShortLink(makeRequest(), {
            targetUrl: 'https://app.example/?prompt=hello&promoProfileId=old-profile',
            clientRequestId: 'promo-override'
        });
        await db
            .update(shortLinks)
            .set({ promoMode: 'override', promoProfileId: 'profile-1' })
            .where(eq(shortLinks.id, result.link.id));

        const redirect = await resolveShortLinkRedirect(makeRequest(`https://app.example/s/${result.link.code}`), result.link.code);
        expect(redirect.ok).toBe(true);
        if (redirect.ok) {
            expect(new URL(redirect.url).searchParams.get('promoProfileId')).toBe('promo-public-1');
        }
    });
});
