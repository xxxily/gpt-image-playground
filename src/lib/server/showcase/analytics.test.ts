import {
    getShowcaseAnalyticsSummary,
    parseShowcaseAnalyticsBatch,
    recordShowcaseAnalyticsBatch,
    SHOWCASE_ANALYTICS_MAX_BATCH
} from './analytics';
import { getServerDatabaseReady, getSqliteClient } from '@/lib/server/db';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const databasePath = path.join(os.tmpdir(), 'gpt-image-playground-showcase-analytics.test.sqlite');
process.env.ADMIN_DATABASE_PATH = databasePath;

async function resetEvents() {
    await getServerDatabaseReady();
    getSqliteClient().exec('DELETE FROM "showcase_events";');
}

beforeAll(async () => {
    fs.rmSync(databasePath, { force: true });
    fs.rmSync(`${databasePath}-wal`, { force: true });
    fs.rmSync(`${databasePath}-shm`, { force: true });
    await resetEvents();
});

afterEach(resetEvents);

afterAll(() => {
    fs.rmSync(databasePath, { force: true });
    fs.rmSync(`${databasePath}-wal`, { force: true });
    fs.rmSync(`${databasePath}-shm`, { force: true });
});

describe('showcase analytics persistence', () => {
    it('enforces batch limits and aggregates anonymous topic/case counts', async () => {
        expect(() => parseShowcaseAnalyticsBatch([])).toThrow('批次大小');
        expect(() =>
            parseShowcaseAnalyticsBatch(
                Array.from({ length: SHOWCASE_ANALYTICS_MAX_BATCH + 1 }, () => ({
                    event: 'showcase_open',
                    topicId: 'topic-one',
                    entryPoint: 'home',
                    runtime: 'web'
                }))
            )
        ).toThrow('批次大小');

        await recordShowcaseAnalyticsBatch([
            {
                event: 'showcase_open',
                topicId: 'topic-one',
                entryPoint: 'home',
                runtime: 'web'
            },
            {
                event: 'showcase_case_open',
                topicId: 'topic-one',
                caseId: 'case-one',
                entryPoint: 'topic',
                runtime: 'web'
            }
        ]);

        const summary = await getShowcaseAnalyticsSummary(Date.now() - 60_000, Date.now() + 60_000);
        expect(summary.total).toBe(2);
        expect(summary.events).toEqual(
            expect.arrayContaining([
                { event: 'showcase_open', count: 1 },
                { event: 'showcase_case_open', count: 1 }
            ])
        );
        expect(summary.topics).toEqual(
            expect.arrayContaining([{ topicId: 'topic-one', event: 'showcase_open', count: 1 }])
        );
        expect(summary.cases).toEqual([
            { topicId: 'topic-one', caseId: 'case-one', event: 'showcase_case_open', count: 1 }
        ]);
    });
});
