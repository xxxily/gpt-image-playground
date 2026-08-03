import {
    archiveShowcaseTopicAdmin,
    createShowcaseTopicAdmin,
    getShowcaseTopicAdmin,
    publishShowcaseTopicAdmin,
    rollbackShowcaseTopicAdmin,
    unpublishShowcaseTopicAdmin,
    updateShowcaseTopicAdmin
} from './admin';
import { getShowcaseCorsHeaders } from './cors';
import { getPublicShowcaseCatalog, getPublicShowcaseTopic } from './public';
import type { ShowcaseAdminActor, ShowcaseTopicDraft } from './types';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { authUsers } from '@/lib/server/schema';
import type { ShowcaseTopic } from '@/lib/showcase';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const databasePath = path.join(os.tmpdir(), 'gpt-image-playground-showcases.test.sqlite');

process.env.ADMIN_DATABASE_PATH = databasePath;

function draftForTopic(index: number): ShowcaseTopicDraft {
    const topic = DEFAULT_SHOWCASE_CATALOG.topics[index]!;
    const caseIds = new Set(topic.caseIds);
    const cases = DEFAULT_SHOWCASE_CATALOG.cases.filter((showcaseCase) => caseIds.has(showcaseCase.id));
    const assetIds = new Set<string>([topic.coverAssetId]);
    for (const showcaseCase of cases) {
        assetIds.add(showcaseCase.coverAssetId);
        showcaseCase.inputAssetIds.forEach((id) => assetIds.add(id));
        showcaseCase.outputAssetIds.forEach((id) => assetIds.add(id));
    }
    return {
        topic,
        cases,
        assets: DEFAULT_SHOWCASE_CATALOG.assets.filter((asset) => assetIds.has(asset.id))
    };
}

function withTitle(draft: ShowcaseTopicDraft, title: string): ShowcaseTopicDraft {
    return {
        ...draft,
        topic: {
            ...draft.topic,
            title: { ...draft.topic.title, 'zh-CN': title }
        }
    };
}

function actor(): ShowcaseAdminActor {
    return {
        userId: 'showcase-admin-user',
        email: 'showcase@example.com',
        role: 'admin',
        request: new NextRequest('https://app.example/api/admin/showcases', {
            headers: {
                'user-agent': 'vitest',
                'x-forwarded-for': '203.0.113.11'
            }
        })
    };
}

async function resetTables(): Promise<void> {
    await getServerDatabaseReady();
    getSqliteClient().exec(`
        DELETE FROM "showcase_publications";
        DELETE FROM "showcase_topics";
        DELETE FROM "audit_logs";
        DELETE FROM "user" WHERE "id" = 'showcase-admin-user';
    `);
    const db = await getServerDatabaseReady();
    await db.insert(authUsers).values({
        id: 'showcase-admin-user',
        name: 'Showcase Admin',
        email: 'showcase@example.com',
        role: 'admin',
        status: 'active'
    });
}

beforeAll(async () => {
    try {
        fs.rmSync(databasePath);
    } catch {
        // Fresh database is expected.
    }
    await resetTables();
});

afterEach(resetTables);

afterAll(() => {
    try {
        fs.rmSync(databasePath);
    } catch {
        // Best effort cleanup.
    }
});

describe('showcase publications', () => {
    it('uses the built-in catalog when no topic has been published', async () => {
        const result = await getPublicShowcaseCatalog();

        expect(result.source).toBe('builtin');
        expect(result.catalog.catalogRevision).toBe(DEFAULT_SHOWCASE_CATALOG.catalogRevision);
    });

    it('keeps draft edits isolated from the active immutable publication', async () => {
        const initialDraft = draftForTopic(0);
        await createShowcaseTopicAdmin({ draft: initialDraft }, actor());
        const firstPublication = await publishShowcaseTopicAdmin(initialDraft.topic.id, actor());

        const editedDraft = withTitle(initialDraft, '未发布的新标题');
        await updateShowcaseTopicAdmin(initialDraft.topic.id, { draft: editedDraft }, actor());

        const publicResult = await getPublicShowcaseCatalog();
        const adminResult = await getShowcaseTopicAdmin(initialDraft.topic.id);
        expect(firstPublication?.revision).toBe(1);
        expect(publicResult.source).toBe('published');
        expect(publicResult.catalog.topics[0]?.title['zh-CN']).toBe(initialDraft.topic.title['zh-CN']);
        expect(publicResult.catalog.topics[0]?.relatedTopicIds).toEqual([]);
        expect((await getPublicShowcaseTopic(initialDraft.topic.slug))?.catalog.topics[0]?.relatedTopicIds).toEqual([]);
        expect(adminResult?.topic.draft.topic.title['zh-CN']).toBe('未发布的新标题');
        expect(adminResult?.publications).toHaveLength(1);
    });

    it('publishes a new revision, unpublishes, and rolls back as a new immutable revision', async () => {
        const initialDraft = draftForTopic(1);
        await createShowcaseTopicAdmin({ draft: initialDraft }, actor());
        const revisionOne = await publishShowcaseTopicAdmin(initialDraft.topic.id, actor());

        await updateShowcaseTopicAdmin(
            initialDraft.topic.id,
            { draft: withTitle(initialDraft, '第二版标题') },
            actor()
        );
        const revisionTwo = await publishShowcaseTopicAdmin(initialDraft.topic.id, actor());
        expect(revisionTwo?.revision).toBe(2);
        expect((await getPublicShowcaseCatalog()).catalog.topics[0]?.title['zh-CN']).toBe('第二版标题');

        await unpublishShowcaseTopicAdmin(initialDraft.topic.id, actor());
        expect((await getPublicShowcaseCatalog()).source).toBe('builtin');

        const rollback = await rollbackShowcaseTopicAdmin(initialDraft.topic.id, revisionOne!.id, actor());
        expect(rollback).toMatchObject({ revision: 3, sourcePublicationId: revisionOne!.id, active: true });
        expect((await getPublicShowcaseCatalog()).catalog.topics[0]?.title['zh-CN']).toBe(
            initialDraft.topic.title['zh-CN']
        );
    });

    it('rejects unsafe remote media, duplicate slugs, invalid windows, and id changes', async () => {
        const initialDraft = draftForTopic(2);
        await createShowcaseTopicAdmin({ draft: initialDraft }, actor());

        const unsafeDraft: ShowcaseTopicDraft = {
            ...draftForTopic(3),
            assets: draftForTopic(3).assets.map((asset, index) =>
                index === 0
                    ? {
                          id: asset.id,
                          kind: 'remote-image' as const,
                          alt: asset.alt,
                          url: 'http://127.0.0.1/private.png',
                          mimeType: 'image/png' as const
                      }
                    : asset
            )
        };
        await expect(createShowcaseTopicAdmin({ draft: unsafeDraft }, actor())).rejects.toThrow('不完整');

        const duplicateSlugDraft = draftForTopic(4);
        duplicateSlugDraft.topic = { ...duplicateSlugDraft.topic, slug: initialDraft.topic.slug };
        await expect(createShowcaseTopicAdmin({ draft: duplicateSlugDraft }, actor())).rejects.toThrow('Slug 已存在');

        await expect(
            updateShowcaseTopicAdmin(
                initialDraft.topic.id,
                { draft: initialDraft, startsAt: new Date(20_000), endsAt: new Date(10_000) },
                actor()
            )
        ).rejects.toThrow('开始时间');

        const changedIdTopic: ShowcaseTopic = { ...initialDraft.topic, id: 'changed-id' };
        await expect(
            updateShowcaseTopicAdmin(
                initialDraft.topic.id,
                { draft: { ...initialDraft, topic: changedIdTopic } },
                actor()
            )
        ).rejects.toThrow();
    });

    it('excludes future and expired publications and archives by soft deletion', async () => {
        const futureDraft = draftForTopic(4);
        await createShowcaseTopicAdmin({ draft: futureDraft, startsAt: new Date(Date.now() + 60_000) }, actor());
        await publishShowcaseTopicAdmin(futureDraft.topic.id, actor());
        expect((await getPublicShowcaseCatalog()).source).toBe('builtin');

        await archiveShowcaseTopicAdmin(futureDraft.topic.id, actor());
        const archived = await getShowcaseTopicAdmin(futureDraft.topic.id);
        expect(archived?.topic.status).toBe('archived');
        expect(archived?.topic.publishedPublicationId).toBeNull();

        const expiredDraft = draftForTopic(5);
        await createShowcaseTopicAdmin(
            { draft: expiredDraft, startsAt: new Date(Date.now() - 120_000), endsAt: new Date(Date.now() - 60_000) },
            actor()
        );
        await publishShowcaseTopicAdmin(expiredDraft.topic.id, actor());
        expect((await getPublicShowcaseCatalog()).source).toBe('builtin');
    });

    it('isolates a corrupt publication instead of dropping other valid topics', async () => {
        const firstDraft = draftForTopic(0);
        const secondDraft = draftForTopic(1);
        await createShowcaseTopicAdmin({ draft: firstDraft }, actor());
        await createShowcaseTopicAdmin({ draft: secondDraft }, actor());
        const firstPublication = await publishShowcaseTopicAdmin(firstDraft.topic.id, actor());
        await publishShowcaseTopicAdmin(secondDraft.topic.id, actor());

        getSqliteClient()
            .prepare('UPDATE "showcase_publications" SET "snapshotJson" = ? WHERE "id" = ?;')
            .run('{broken', firstPublication!.id);

        const result = await getPublicShowcaseCatalog();
        expect(result.source).toBe('published');
        expect(result.catalog.topics.map((topic) => topic.id)).toEqual([secondDraft.topic.id]);
    });

    it('adds CORS only for explicitly trusted public-content origins', () => {
        const previous = process.env.SHOWCASE_PUBLIC_ALLOWED_ORIGINS;
        process.env.SHOWCASE_PUBLIC_ALLOWED_ORIGINS = 'https://desktop-content.example';
        try {
            const trusted = getShowcaseCorsHeaders(
                new NextRequest('https://api.example/api/showcases', {
                    headers: { origin: 'https://desktop-content.example' }
                })
            );
            const untrusted = getShowcaseCorsHeaders(
                new NextRequest('https://api.example/api/showcases', {
                    headers: { origin: 'https://evil.example' }
                })
            );

            expect(trusted.get('access-control-allow-origin')).toBe('https://desktop-content.example');
            expect(untrusted.get('access-control-allow-origin')).toBeNull();
        } finally {
            if (previous === undefined) delete process.env.SHOWCASE_PUBLIC_ALLOWED_ORIGINS;
            else process.env.SHOWCASE_PUBLIC_ALLOWED_ORIGINS = previous;
        }
    });
});
