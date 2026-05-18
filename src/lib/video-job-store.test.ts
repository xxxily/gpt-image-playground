import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VideoJobRecord } from './db';

const jobsTable = vi.hoisted(() => {
    type JobsTableStub = {
        records: Map<string, unknown>;
        put: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
        toArray: ReturnType<typeof vi.fn>;
        where: ReturnType<typeof vi.fn>;
    };
    const stub: JobsTableStub = {
        records: new Map(),
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        toArray: vi.fn(),
        where: vi.fn()
    };
    return stub;
});

vi.mock('@/lib/db', () => ({
    db: {
        videoJobs: jobsTable
    }
}));

import {
    getVideoJob,
    listAllVideoJobs,
    listResumableVideoJobs,
    purgeExpiredVideoJobs,
    recordVideoJob,
    removeVideoJob,
    updateVideoJob
} from './video-job-store';

function buildJob(overrides: Partial<VideoJobRecord> = {}): VideoJobRecord {
    return {
        id: overrides.id ?? 'job-1',
        providerEndpointId: 'endpoint-x',
        protocol: 'openai-videos',
        taskMode: 'text-to-video',
        status: 'queued',
        createdAt: 1,
        updatedAt: 1,
        ...overrides
    };
}

beforeEach(() => {
    jobsTable.records.clear();
    jobsTable.put.mockImplementation(async (record: VideoJobRecord) => {
        jobsTable.records.set(record.id, record);
        return record.id;
    });
    jobsTable.get.mockImplementation(async (id: string) => jobsTable.records.get(id) as VideoJobRecord | undefined);
    jobsTable.delete.mockImplementation(async (id: string) => {
        jobsTable.records.delete(id);
    });
    jobsTable.toArray.mockImplementation(async () => [...jobsTable.records.values()] as VideoJobRecord[]);
    jobsTable.where.mockImplementation((field: string) => ({
        anyOf: (statuses: string[]) => ({
            toArray: async () => {
                if (field !== 'status') return [];
                return ([...jobsTable.records.values()] as VideoJobRecord[]).filter((record) =>
                    statuses.includes(String(record.status))
                );
            }
        })
    }));
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('recordVideoJob', () => {
    it('writes the job and fills updatedAt when missing', async () => {
        const job = buildJob({ updatedAt: undefined as unknown as number });
        const ok = await recordVideoJob(job);
        expect(ok).toBe(true);
        const stored = jobsTable.records.get(job.id) as VideoJobRecord | undefined;
        expect(stored?.updatedAt).toBeGreaterThan(0);
    });

    it('returns false on error', async () => {
        jobsTable.put.mockRejectedValueOnce(new Error('boom'));
        const ok = await recordVideoJob(buildJob());
        expect(ok).toBe(false);
    });
});

describe('updateVideoJob', () => {
    it('returns null when the job does not exist', async () => {
        const result = await updateVideoJob('missing', { status: 'failed' });
        expect(result).toBeNull();
    });

    it('merges patch and bumps updatedAt', async () => {
        await recordVideoJob(buildJob({ id: 'merge-test', status: 'queued' }));
        const before = Date.now();
        const result = await updateVideoJob('merge-test', { status: 'running', progress: 42 });
        expect(result?.status).toBe('running');
        expect(result?.progress).toBe(42);
        expect((result?.updatedAt ?? 0) >= before).toBe(true);
    });

    it('sets completedAt when transitioning to a terminal status', async () => {
        await recordVideoJob(buildJob({ id: 'terminal-test' }));
        const result = await updateVideoJob('terminal-test', { status: 'succeeded' });
        expect(result?.completedAt).toBeGreaterThan(0);
    });

    it('keeps caller-provided completedAt when patch already sets one', async () => {
        await recordVideoJob(buildJob({ id: 'preserve-completed' }));
        const result = await updateVideoJob('preserve-completed', {
            status: 'succeeded',
            completedAt: 4242
        });
        expect(result?.completedAt).toBe(4242);
    });
});

describe('getVideoJob', () => {
    it('returns null when missing', async () => {
        const result = await getVideoJob('missing');
        expect(result).toBeNull();
    });

    it('returns the stored record', async () => {
        await recordVideoJob(buildJob({ id: 'exists' }));
        const result = await getVideoJob('exists');
        expect(result?.id).toBe('exists');
    });
});

describe('listResumableVideoJobs', () => {
    it('returns only resumable statuses sorted by updatedAt desc', async () => {
        await recordVideoJob(buildJob({ id: 'queued-1', status: 'queued', updatedAt: 10 }));
        await recordVideoJob(buildJob({ id: 'done-1', status: 'succeeded', updatedAt: 50 }));
        await recordVideoJob(buildJob({ id: 'running-1', status: 'running', updatedAt: 30 }));
        await recordVideoJob(buildJob({ id: 'failed-1', status: 'failed', updatedAt: 40 }));
        await recordVideoJob(buildJob({ id: 'polling-1', status: 'polling', updatedAt: 20 }));

        const result = await listResumableVideoJobs();
        expect(result.map((record) => record.id)).toEqual(['running-1', 'polling-1', 'queued-1']);
    });
});

describe('listAllVideoJobs', () => {
    it('returns every record sorted by updatedAt desc', async () => {
        await recordVideoJob(buildJob({ id: 'a', updatedAt: 1 }));
        await recordVideoJob(buildJob({ id: 'b', updatedAt: 10 }));
        await recordVideoJob(buildJob({ id: 'c', updatedAt: 5 }));
        const result = await listAllVideoJobs();
        expect(result.map((record) => record.id)).toEqual(['b', 'c', 'a']);
    });
});

describe('removeVideoJob', () => {
    it('deletes the record', async () => {
        await recordVideoJob(buildJob({ id: 'gone' }));
        const ok = await removeVideoJob('gone');
        expect(ok).toBe(true);
        expect(jobsTable.records.has('gone')).toBe(false);
    });
});

describe('purgeExpiredVideoJobs', () => {
    it('removes terminal jobs older than the cutoff', async () => {
        const now = Date.now();
        await recordVideoJob(buildJob({ id: 'old-done', status: 'succeeded', updatedAt: now - 7 * 86400000 }));
        await recordVideoJob(buildJob({ id: 'fresh-done', status: 'succeeded', updatedAt: now - 1000 }));
        await recordVideoJob(buildJob({ id: 'old-running', status: 'running', updatedAt: now - 7 * 86400000 }));

        const removed = await purgeExpiredVideoJobs(2 * 86400000);
        expect(removed).toBe(1);
        expect(jobsTable.records.has('old-done')).toBe(false);
        expect(jobsTable.records.has('fresh-done')).toBe(true);
        expect(jobsTable.records.has('old-running')).toBe(true);
    });

    it('returns 0 for invalid inputs', async () => {
        expect(await purgeExpiredVideoJobs(0)).toBe(0);
        expect(await purgeExpiredVideoJobs(-100)).toBe(0);
        expect(await purgeExpiredVideoJobs(Number.NaN)).toBe(0);
    });
});
