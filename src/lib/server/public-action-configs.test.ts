import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import {
    createPublicActionConfigAdmin,
    deletePublicActionConfigAdmin,
    getPublicRuntimeConfig,
    listPublicActionConfigsAdmin,
    normalizePublicActionLabelForStorage,
    normalizePublicActionTargetUrlForStorage,
    updatePublicActionConfigAdmin,
    type PublicActionAdminActor
} from '@/lib/server/public-action-configs';
import { authUsers } from '@/lib/server/schema';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const databasePath = path.join(os.tmpdir(), 'gpt-image-playground-public-actions.test.sqlite');

process.env.ADMIN_DATABASE_PATH = databasePath;
process.env.BETTER_AUTH_SECRET = 'public-actions-auth-secret';

function makeActor(): PublicActionAdminActor {
    return {
        userId: 'admin-1',
        email: 'admin@example.com',
        role: 'owner',
        request: new Request('https://app.example/api/admin/public-actions', {
            headers: {
                'user-agent': 'vitest browser',
                'x-forwarded-for': '203.0.113.20'
            }
        })
    };
}

async function seedAdminUser(): Promise<void> {
    const db = await getServerDatabaseReady();
    await db.insert(authUsers).values({
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@example.com',
        emailVerified: true,
        role: 'owner',
        status: 'active'
    });
}

async function resetTables(): Promise<void> {
    await getServerDatabaseReady();
    getSqliteClient().exec(`
        DELETE FROM "admin_public_action_configs";
        DELETE FROM "audit_logs";
        DELETE FROM "user";
    `);
}

beforeAll(() => {
    try {
        fs.rmSync(databasePath);
    } catch {
        // Fresh file is fine.
    }
});

afterEach(async () => {
    await resetTables();
});

afterAll(() => {
    try {
        fs.rmSync(databasePath);
    } catch {
        // Best effort cleanup.
    }
});

describe('public action config validation', () => {
    it('normalizes valid labels and URLs', () => {
        expect(normalizePublicActionLabelForStorage('  购买 API Key  ')).toBe('购买 API Key');
        expect(normalizePublicActionTargetUrlForStorage('supplier.example.com/buy')).toBe(
            'https://supplier.example.com/buy'
        );
    });

    it('rejects unsafe labels and URLs', () => {
        expect(() => normalizePublicActionLabelForStorage('购买\nAPI Key')).toThrow('按钮文本');
        expect(() => normalizePublicActionLabelForStorage('<b>购买</b>')).toThrow('按钮文本');
        expect(() => normalizePublicActionTargetUrlForStorage('javascript:alert(1)')).toThrow('URL');
        expect(() => normalizePublicActionTargetUrlForStorage('https://user:pass@example.com/buy')).toThrow('URL');
        expect(() => normalizePublicActionTargetUrlForStorage('http://127.0.0.1/buy')).toThrow('URL');
    });

    it('requires https URLs in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        try {
            expect(() => normalizePublicActionTargetUrlForStorage('http://supplier.example.com/buy')).toThrow('https');
        } finally {
            vi.unstubAllEnvs();
        }
    });
});

describe('public action config storage', () => {
    it('keeps only one active purchase entry and exposes only public DTO fields', async () => {
        await seedAdminUser();
        const actor = makeActor();
        const first = await createPublicActionConfigAdmin(
            {
                name: 'Primary',
                buttonLabel: '购买 API Key',
                targetUrl: 'https://supplier-a.example.com/buy',
                enabled: true,
                active: true,
                description: 'internal note'
            },
            actor
        );
        const second = await createPublicActionConfigAdmin(
            {
                name: 'Backup',
                buttonLabel: '申请 API Key',
                targetUrl: 'https://supplier-b.example.com/apply',
                enabled: true,
                active: true
            },
            actor
        );

        const rows = await listPublicActionConfigsAdmin();
        expect(rows.filter((row) => row.active && row.enabled)).toHaveLength(1);
        expect(rows.find((row) => row.id === first.id)?.active).toBe(false);
        expect(rows.find((row) => row.id === second.id)?.active).toBe(true);

        const runtimeConfig = await getPublicRuntimeConfig();
        expect(runtimeConfig).toEqual({
            apiKeyPurchaseCta: {
                label: '申请 API Key',
                url: 'https://supplier-b.example.com/apply'
            }
        });
        expect(Object.keys(runtimeConfig.apiKeyPurchaseCta || {})).toEqual(['label', 'url']);
    });

    it('returns null after the current entry is disabled', async () => {
        await seedAdminUser();
        const actor = makeActor();
        const created = await createPublicActionConfigAdmin(
            {
                name: 'Primary',
                buttonLabel: '购买 API Key',
                targetUrl: 'https://supplier.example.com/buy',
                enabled: true,
                active: true
            },
            actor
        );

        await updatePublicActionConfigAdmin(created.id, { enabled: false }, actor);

        expect(await getPublicRuntimeConfig()).toEqual({ apiKeyPurchaseCta: null });
        const [row] = await listPublicActionConfigsAdmin();
        expect(row.enabled).toBe(false);
        expect(row.active).toBe(false);
    });

    it('writes audits for create, update, and delete without leaking admin notes', async () => {
        await seedAdminUser();
        const actor = makeActor();
        const created = await createPublicActionConfigAdmin(
            {
                name: 'Primary',
                buttonLabel: '购买 API Key',
                targetUrl: 'https://supplier.example.com/buy',
                enabled: true,
                active: true,
                description: 'secret internal note'
            },
            actor
        );
        await updatePublicActionConfigAdmin(created.id, { active: false }, actor);
        await deletePublicActionConfigAdmin(created.id, actor);

        const audits = getSqliteClient()
            .prepare(`SELECT "action", "metadataJson" FROM "audit_logs" ORDER BY "createdAt" ASC;`)
            .all() as Array<{ action: string; metadataJson: string }>;

        expect(audits.map((audit) => audit.action)).toEqual([
            'public_action_config_create_active',
            'public_action_config_deactivate',
            'public_action_config_delete'
        ]);
        expect(audits.map((audit) => audit.metadataJson).join('\n')).not.toContain('secret internal note');
    });
});
