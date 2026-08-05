import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const databasePath = path.join(os.tmpdir(), 'gpt-image-playground-showcase-provenance-migration.test.sqlite');
const originalDatabasePath = process.env.ADMIN_DATABASE_PATH;

function createLegacyDatabase(): void {
    fs.rmSync(databasePath, { force: true });
    const database = new Database(databasePath);
    database.exec(`
        CREATE TABLE "showcase_assets" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "mimeType" TEXT NOT NULL,
            "width" INTEGER NOT NULL,
            "height" INTEGER NOT NULL,
            "byteSize" INTEGER NOT NULL,
            "thumbnailWidth" INTEGER NOT NULL,
            "thumbnailHeight" INTEGER NOT NULL,
            "thumbnailByteSize" INTEGER NOT NULL,
            "checksum" TEXT NOT NULL,
            "storageKey" TEXT NOT NULL UNIQUE,
            "thumbnailStorageKey" TEXT NOT NULL UNIQUE,
            "sourceLabel" TEXT NOT NULL,
            "licenseNote" TEXT NOT NULL,
            "altZhCN" TEXT NOT NULL,
            "altEnUS" TEXT NOT NULL,
            "createdByUserId" TEXT,
            "createdAt" INTEGER NOT NULL
        );
        INSERT INTO "showcase_assets" (
            "id", "mimeType", "width", "height", "byteSize", "thumbnailWidth", "thumbnailHeight",
            "thumbnailByteSize", "checksum", "storageKey", "thumbnailStorageKey", "sourceLabel",
            "licenseNote", "altZhCN", "altEnUS", "createdByUserId", "createdAt"
        ) VALUES (
            'media_0123456789abcdef0123456789abcdef', 'image/webp', 100, 80, 1000, 64, 51,
            300, 'legacy-checksum', 'legacy.webp', 'legacy.thumbnail.webp', 'Legacy owned source',
            'Legacy license note', '旧版替代文本', 'Legacy alt text', NULL, 1722729600000
        );
    `);
    database.close();
}

beforeAll(() => {
    createLegacyDatabase();
    process.env.ADMIN_DATABASE_PATH = databasePath;
    vi.resetModules();
});

afterAll(() => {
    if (typeof originalDatabasePath === 'string') process.env.ADMIN_DATABASE_PATH = originalDatabasePath;
    else delete process.env.ADMIN_DATABASE_PATH;
    fs.rmSync(databasePath, { force: true });
    fs.rmSync(`${databasePath}-wal`, { force: true });
    fs.rmSync(`${databasePath}-shm`, { force: true });
});

describe('showcase media provenance migration', () => {
    it('adds safe defaults without rewriting existing source, license, or alt metadata', async () => {
        const { getServerDatabaseReady, getSqliteClient } = await import('@/lib/server/db');
        await getServerDatabaseReady();

        const columns = getSqliteClient().prepare('PRAGMA table_info("showcase_assets");').all() as Array<{
            name: string;
        }>;
        expect(columns.map((column) => column.name)).toEqual(
            expect.arrayContaining([
                'provenanceType',
                'generationModelId',
                'generationRecipeVersion',
                'generatedAt',
                'candidateCount',
                'reviewStatus',
                'reviewNote',
                'reviewedByUserId',
                'reviewedAt'
            ])
        );

        const row = getSqliteClient()
            .prepare(
                `SELECT "sourceLabel", "licenseNote", "altZhCN", "altEnUS", "provenanceType",
                        "generationModelId", "generationRecipeVersion", "generatedAt", "candidateCount",
                        "reviewStatus", "reviewNote", "reviewedByUserId", "reviewedAt"
                 FROM "showcase_assets"
                 WHERE "id" = 'media_0123456789abcdef0123456789abcdef';`
            )
            .get();

        expect(row).toEqual({
            sourceLabel: 'Legacy owned source',
            licenseNote: 'Legacy license note',
            altZhCN: '旧版替代文本',
            altEnUS: 'Legacy alt text',
            provenanceType: 'licensed-source',
            generationModelId: null,
            generationRecipeVersion: null,
            generatedAt: null,
            candidateCount: null,
            reviewStatus: 'not-required',
            reviewNote: null,
            reviewedByUserId: null,
            reviewedAt: null
        });
    });
});
