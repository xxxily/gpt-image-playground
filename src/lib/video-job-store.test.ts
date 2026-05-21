import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoJobRecord } from '@/lib/db';

const jobsTable = vi.hoisted(() => {
    class CollectionProxy {
        private records: Map<string, VideoJobRecord>;
        private filtered: VideoJobRecord[] | null = null;
        private reversed = false;

        constructor(records: Map<string, VideoJobRecord>) {
            this.records = records;
        }

        anyOf(values: readonly string[]) {
            this.filtered = [...this.records.values()].filter((record) => values.includes(record.status));
            return this;
        }

        reverse() {
            this.reversed = true;
            return this;
        }

        sortBy(field: string) {
            const items = this.filtered ? [...this.filtered] : [...this.records.values()];
            items.sort((a, b) => {
                const keyA = (a as unknown as Record<string, unknown>)[field] as number;
                const keyB = (b as unknown as Record<string, unknown>)[field] as number;
                return (keyA ?? 0) - (keyB ?? 0);
            });
            return this.reversed ? items.reverse() : items;
        }

        toArray() {
            const items = this.filtered ? [...this.filtered] : [...this.records.values()];
            return Promise.resolve(this.reversed ? items.reverse() : items);
        }
    }

    type JobsTableStub = {
        records: Map<string, VideoJobRecord>;
        put: (record: VideoJobRecord) => Promise<void>;
        get: (id: string) => Promise<VideoJobRecord | undefined>;
        delete: (id: string) => Promise<void>;
        where: (field: string) => CollectionProxy;
        orderBy: (field: string) => CollectionProxy;
        toArray: () => Promise<VideoJobRecord[]>;
    };

    const table: JobsTableStub = {
        records: new Map<string, VideoJobRecord>(),
        put: vi.fn(async (record: VideoJobRecord) => {
            table.records.set(record.id, record);
        }) as JobsTableStub['put'],
        get: vi.fn(async (id: string) => table.records.get(id) ?? undefined) as JobsTableStub['get'],
        delete: vi.fn(async (id: string) => {
            table.records.delete(id);
        }) as JobsTableStub['delete'],
        where: vi.fn(() => new CollectionProxy(table.records)) as JobsTableStub['where'],
        orderBy: vi.fn(() => new CollectionProxy(table.records)) as JobsTableStub['orderBy'],
        toArray: vi.fn(async () => [...table.records.values()]) as JobsTableStub['toArray']
    };

    return table;
});

vi.mock('@/lib/db', () => ({
    db: { videoJobs: jobsTable }
}));

vi.spyOn(console, 'warn').mockImplementation(() => {});

import {
    getVideoJob,
    listAllVideoJobs,
    listResumableVideoJobs,
    purgeExpiredVideoJobs,
    recordVideoJob,
    removeVideoJob,
    updateVideoJob
} from './video-job-store';

function makeJob(overrides: Partial<VideoJobRecord> = {}): VideoJobRecord {
    return {
        id: 'job_1',
        status: 'queued',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        providerEndpointId: 'ep:openai:default',
        protocol: 'openai-images',
        taskMode: 'text-to-video',
        ...overrides
    };
}

beforeEach(() => {
    jobsTable.records.clear();
    vi.clearAllMocks();
});

describe('recordVideoJob', () => {
    it('stores a new job and ensures updatedAt is set', async () => {
        const job = makeJob({ id: 'new_job', updatedAt: undefined });
        await recordVideoJob(job);

        const stored = await jobsTable.get('new_job');
        expect(stored).toBeDefined();
        expect(stored?.updatedAt).toBeDefined();
    });

    it('upserts an existing job', async () => {
        const existing = makeJob({ id: 'upsert_job' });
        await recordVideoJob(existing);

        const updated = makeJob({ id: 'upsert_job', status: 'running' });
        await recordVideoJob(updated);

        const stored = await jobsTable.get('upsert_job');
        expect(stored?.status).toBe('running');
    });
});

describe('updateVideoJob', () => {
    it('returns null if job does not exist', async () => {
        const result = await updateVideoJob('nonexistent', { status: 'running' });
        expect(result).toBeNull();
    });

    it('merges patch and sets updatedAt', async () => {
        const job = makeJob({ id: 'update_job', updatedAt: 1000 });
        await recordVideoJob(job);

        const result = await updateVideoJob('update_job', { status: 'running' });
        expect(result).not.toBeNull();
        expect(result?.status).toBe('running');
        expect(result?.updatedAt).toBeGreaterThan(1000);
    });

    it('sets completedAt when status transitions to succeeded', async () => {
        const job = makeJob({ id: 'complete_job', status: 'queued' });
        await recordVideoJob(job);

        const result = await updateVideoJob('complete_job', { status: 'succeeded' });
        expect(result?.completedAt).toBeDefined();
        expect(result?.completedAt).toBeGreaterThan(0);
    });

    it('preserves completedAt when patch provides it', async () => {
        const customTime = 12345;
        const job = makeJob({ id: 'custom_time_job', status: 'queued' });
        await recordVideoJob(job);

        const result = await updateVideoJob('custom_time_job', {
            status: 'succeeded',
            completedAt: customTime
        });
        expect(result?.completedAt).toBe(customTime);
    });

    it('sets completedAt for failed status', async () => {
        const job = makeJob({ id: 'fail_job', status: 'running' });
        await recordVideoJob(job);

        const result = await updateVideoJob('fail_job', { status: 'failed', errorMessage: 'timeout' });
        expect(result?.completedAt).toBeDefined();
        expect(result?.errorMessage).toBe('timeout');
    });
});

describe('getVideoJob', () => {
    it('returns null when job does not exist', async () => {
        const result = await getVideoJob('missing');
        expect(result).toBeNull();
    });

    it('returns the job record', async () => {
        const job = makeJob({ id: 'get_job' });
        await recordVideoJob(job);

        const result = await getVideoJob('get_job');
        expect(result?.id).toBe('get_job');
    });
});

describe('listResumableVideoJobs', () => {
    it('filters to queued/running/polling statuses only', async () => {
        await recordVideoJob(makeJob({ id: 'j_queued', status: 'queued', updatedAt: 1 }));
        await recordVideoJob(makeJob({ id: 'j_running', status: 'running', updatedAt: 2 }));
        await recordVideoJob(makeJob({ id: 'j_polling', status: 'polling', updatedAt: 3 }));
        await recordVideoJob(makeJob({ id: 'j_done', status: 'succeeded', updatedAt: 4 }));
        await recordVideoJob(makeJob({ id: 'j_failed', status: 'failed', updatedAt: 5 }));

        const result = await listResumableVideoJobs();
        expect(result).toHaveLength(3);
        expect(result.map((j) => j.id).sort()).toEqual(['j_polling', 'j_queued', 'j_running']);
    });

    it('returns sorted by updatedAt descending', async () => {
        await recordVideoJob(makeJob({ id: 'a', status: 'queued', updatedAt: 100 }));
        await recordVideoJob(makeJob({ id: 'b', status: 'running', updatedAt: 300 }));
        await recordVideoJob(makeJob({ id: 'c', status: 'polling', updatedAt: 200 }));

        const result = await listResumableVideoJobs();
        expect(result.map((j) => j.id)).toEqual(['b', 'c', 'a']);
    });

    it('returns empty array when no resumable jobs', async () => {
        const result = await listResumableVideoJobs();
        expect(result).toEqual([]);
    });
});

describe('listAllVideoJobs', () => {
    it('returns all jobs sorted by updatedAt descending', async () => {
        await recordVideoJob(makeJob({ id: 'x', updatedAt: 50 }));
        await recordVideoJob(makeJob({ id: 'y', updatedAt: 150 }));
        await recordVideoJob(makeJob({ id: 'z', updatedAt: 100 }));

        const result = await listAllVideoJobs();
        expect(result.map((j) => j.id)).toEqual(['z', 'y', 'x']);
    });

    it('returns empty array when no jobs', async () => {
        const result = await listAllVideoJobs();
        expect(result).toEqual([]);
    });
});

describe('removeVideoJob', () => {
    it('deletes the job by id', async () => {
        await recordVideoJob(makeJob({ id: 'del_job' }));
        await removeVideoJob('del_job');

        const result = await getVideoJob('del_job');
        expect(result).toBeNull();
    });

    it('does not throw for non-existent id', async () => {
        await removeVideoJob('nonexistent');
    });
});

describe('purgeExpiredVideoJobs', () => {
    it('deletes terminal jobs older than cutoff and returns count', async () => {
        const now = Date.now();
        const oldThreshold = 10000;

        await recordVideoJob(makeJob({ id: 'old_success', status: 'succeeded', updatedAt: now - 20000 }));
        await recordVideoJob(makeJob({ id: 'old_failed', status: 'failed', updatedAt: now - 15000 }));
        await recordVideoJob(makeJob({ id: 'old_cancelled', status: 'cancelled', updatedAt: now - 30000 }));
        await recordVideoJob(makeJob({ id: 'old_expired', status: 'expired', updatedAt: now - 50000 }));
        await recordVideoJob(makeJob({ id: 'recent_success', status: 'succeeded', updatedAt: now - 5000 }));
        await recordVideoJob(makeJob({ id: 'active_queued', status: 'queued', updatedAt: now - 20000 }));

        const count = await purgeExpiredVideoJobs(oldThreshold);
        expect(count).toBe(4);

        expect(await getVideoJob('old_success')).toBeNull();
        expect(await getVideoJob('old_failed')).toBeNull();
        expect(await getVideoJob('old_cancelled')).toBeNull();
        expect(await getVideoJob('old_expired')).toBeNull();
        expect(await getVideoJob('recent_success')).not.toBeNull();
        expect(await getVideoJob('active_queued')).not.toBeNull();
    });

    it('returns 0 when no terminal jobs to purge', async () => {
        await recordVideoJob(makeJob({ id: 'active', status: 'running' }));
        const count = await purgeExpiredVideoJobs(1000);
        expect(count).toBe(0);
    });
});
