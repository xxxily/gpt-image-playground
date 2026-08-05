import {
    archiveShowcaseTopicAdmin,
    createShowcaseTopicAdmin,
    ensureDefaultShowcaseTopicsAdmin,
    getShowcaseTopicAdmin,
    listShowcaseTopicsAdmin,
    publishShowcaseTopicAdmin,
    rollbackShowcaseTopicAdmin,
    unpublishShowcaseTopicAdmin,
    updateShowcaseTopicAdmin
} from './admin';
import { getShowcaseCorsHeaders } from './cors';
import { getPublicShowcaseCatalog, getPublicShowcaseTopic } from './public';
import { assertRemoteShowcaseAssetsHealthy } from './remote-media';
import type { ShowcaseAdminActor, ShowcaseTopicDraft } from './types';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import { authUsers } from '@/lib/server/schema';
import type { ShowcaseTopic } from '@/lib/showcase';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./remote-media', () => ({
    assertRemoteShowcaseAssetsHealthy: vi.fn(async () => [])
}));

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
    vi.mocked(assertRemoteShowcaseAssetsHealthy).mockReset().mockResolvedValue([]);
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
    it('materializes every bundled topic as an editable draft exactly once', async () => {
        const firstInsertCount = await ensureDefaultShowcaseTopicsAdmin();
        const firstTopics = await listShowcaseTopicsAdmin();
        const secondInsertCount = await ensureDefaultShowcaseTopicsAdmin();

        expect(firstInsertCount).toBe(DEFAULT_SHOWCASE_CATALOG.topics.length);
        expect(secondInsertCount).toBe(0);
        expect(firstTopics).toHaveLength(DEFAULT_SHOWCASE_CATALOG.topics.length);
        expect(firstTopics.map((topic) => topic.id)).toEqual(DEFAULT_SHOWCASE_CATALOG.topics.map((topic) => topic.id));
        expect(firstTopics.every((topic) => topic.status === 'draft' && topic.draftRevision === 1)).toBe(true);
    });

    it('only fills missing bundled topics and preserves administrator changes and lifecycle state', async () => {
        const customizedDraft = withTitle(draftForTopic(0), '管理员保留标题');
        await createShowcaseTopicAdmin({ draft: customizedDraft }, actor());
        await archiveShowcaseTopicAdmin(customizedDraft.topic.id, actor());

        const topics = await listShowcaseTopicsAdmin();
        const customized = topics.find((topic) => topic.id === customizedDraft.topic.id);

        expect(topics).toHaveLength(DEFAULT_SHOWCASE_CATALOG.topics.length);
        expect(customized?.status).toBe('archived');
        expect(customized?.draft.topic.title['zh-CN']).toBe('管理员保留标题');
        expect(customized?.draftRevision).toBe(1);
    });

    it('uses a deterministic fallback slug when a custom topic already owns a bundled slug', async () => {
        const source = draftForTopic(0);
        const customId = 'custom-old-photo-topic';
        const customDraft: ShowcaseTopicDraft = {
            ...source,
            topic: { ...source.topic, id: customId },
            cases: source.cases.map((showcaseCase) => ({ ...showcaseCase, topicId: customId }))
        };
        await createShowcaseTopicAdmin({ draft: customDraft }, actor());

        const topics = await listShowcaseTopicsAdmin();
        const custom = topics.find((topic) => topic.id === customId);
        const bundled = topics.find((topic) => topic.id === source.topic.id);

        expect(custom?.slug).toBe(source.topic.slug);
        expect(bundled?.slug).toBe(`${source.topic.slug}-builtin`);
        expect(bundled?.draft.topic.slug).toBe(`${source.topic.slug}-builtin`);
        expect(topics).toHaveLength(DEFAULT_SHOWCASE_CATALOG.topics.length + 1);
    });

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

    it('round-trips every structured operations field through create, update, clear, and reload', async () => {
        const initialDraft = draftForTopic(0);
        const relatedTopicId = DEFAULT_SHOWCASE_CATALOG.topics[1]!.id;
        const firstCase = initialDraft.cases[0]!;
        const enrichedDraft: ShowcaseTopicDraft = {
            ...initialDraft,
            topic: {
                ...initialDraft.topic,
                faq: [
                    {
                        question: { 'zh-CN': '需要准备什么？', 'en-US': 'What should I prepare?' },
                        answer: { 'zh-CN': '准备一张清晰原图。', 'en-US': 'Prepare one clear source image.' }
                    }
                ],
                relatedTopicIds: [relatedTopicId]
            },
            cases: initialDraft.cases.map((showcaseCase) =>
                showcaseCase.id === firstCase.id
                    ? {
                          ...showcaseCase,
                          recipe: {
                              ...showcaseCase.recipe,
                              inputSlots: showcaseCase.recipe.inputSlots.map((slot, index) =>
                                  index === 0
                                      ? {
                                            ...slot,
                                            minCount: 1,
                                            maxCount: 3,
                                            acceptedMimeTypes: ['image/png', 'image/webp']
                                        }
                                      : slot
                              ),
                              userInstruction: { enabled: true, maxLength: 800 },
                              output: {
                                  ...showcaseCase.recipe.output,
                                  background: 'transparent',
                                  moderation: 'low'
                              }
                          }
                      }
                    : showcaseCase
            )
        };

        await createShowcaseTopicAdmin({ draft: enrichedDraft }, actor());
        const created = await getShowcaseTopicAdmin(enrichedDraft.topic.id);
        expect(created?.topic.draft.topic.faq).toEqual(enrichedDraft.topic.faq);
        expect(created?.topic.draft.topic.relatedTopicIds).toEqual([relatedTopicId]);
        expect(created?.topic.draft.cases[0]?.recipe).toMatchObject({
            inputSlots: [
                expect.objectContaining({
                    minCount: 1,
                    maxCount: 3,
                    acceptedMimeTypes: ['image/png', 'image/webp']
                })
            ],
            userInstruction: { enabled: true, maxLength: 800 },
            output: expect.objectContaining({ background: 'transparent', moderation: 'low' })
        });

        const clearedDraft: ShowcaseTopicDraft = {
            ...created!.topic.draft,
            topic: {
                ...created!.topic.draft.topic,
                faq: undefined,
                relatedTopicIds: undefined
            },
            cases: created!.topic.draft.cases.map((showcaseCase, index) => {
                if (index !== 0) return showcaseCase;
                const output = { ...showcaseCase.recipe.output };
                delete output.background;
                delete output.moderation;
                const recipe = { ...showcaseCase.recipe, output };
                delete recipe.userInstruction;
                return { ...showcaseCase, recipe };
            })
        };
        await updateShowcaseTopicAdmin(enrichedDraft.topic.id, { draft: clearedDraft }, actor());
        const cleared = await getShowcaseTopicAdmin(enrichedDraft.topic.id);
        expect(cleared?.topic.draft.topic).not.toHaveProperty('faq');
        expect(cleared?.topic.draft.topic).not.toHaveProperty('relatedTopicIds');
        expect(cleared?.topic.draft.cases[0]?.recipe).not.toHaveProperty('userInstruction');
        expect(cleared?.topic.draft.cases[0]?.recipe.output).not.toHaveProperty('background');
        expect(cleared?.topic.draft.cases[0]?.recipe.output).not.toHaveProperty('moderation');
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

    it('does not create a publication when remote media probing fails', async () => {
        const initialDraft = draftForTopic(3);
        const remoteAsset = {
            id: 'external-publication-cover',
            kind: 'remote-image' as const,
            alt: { 'zh-CN': '远程封面', 'en-US': 'Remote cover' },
            url: 'https://images.example.test/cover.webp',
            mimeType: 'image/webp' as const,
            width: 1200,
            height: 800
        };
        const remoteDraft: ShowcaseTopicDraft = {
            ...initialDraft,
            topic: { ...initialDraft.topic, coverAssetId: remoteAsset.id },
            assets: [...initialDraft.assets, remoteAsset]
        };
        await createShowcaseTopicAdmin({ draft: remoteDraft }, actor());
        vi.mocked(assertRemoteShowcaseAssetsHealthy).mockRejectedValueOnce(new Error('远程媒体发布校验失败'));

        await expect(publishShowcaseTopicAdmin(remoteDraft.topic.id, actor())).rejects.toThrow('远程媒体发布校验失败');
        expect(
            getSqliteClient()
                .prepare('SELECT COUNT(*) AS "count" FROM "showcase_publications" WHERE "topicId" = ?;')
                .get(remoteDraft.topic.id)
        ).toMatchObject({ count: 0 });
        expect(await getShowcaseTopicAdmin(remoteDraft.topic.id)).toMatchObject({
            topic: { status: 'draft', publishedPublicationId: null },
            publications: []
        });
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
