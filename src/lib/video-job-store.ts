import { db, type VideoJobRecord } from '@/lib/db';

const TERMINAL_STATUSES: readonly string[] = ['succeeded', 'failed', 'cancelled', 'expired'];
const RESUMABLE_STATUSES: readonly string[] = ['queued', 'running', 'polling'];

export async function recordVideoJob(job: VideoJobRecord): Promise<void> {
    try {
        const record: VideoJobRecord = {
            ...job,
            updatedAt: job.updatedAt || Date.now()
        };
        await db.videoJobs.put(record);
    } catch (error) {
        console.warn('Failed to record video job:', error);
    }
}

export async function updateVideoJob(id: string, patch: Partial<VideoJobRecord>): Promise<VideoJobRecord | null> {
    try {
        const existing = await db.videoJobs.get(id);
        if (!existing) return null;

        const updated: VideoJobRecord = {
            ...existing,
            ...patch,
            updatedAt: Date.now()
        };

        const newStatus = patch.status ?? existing.status;
        if (TERMINAL_STATUSES.includes(newStatus) && !updated.completedAt) {
            updated.completedAt = Date.now();
        }

        await db.videoJobs.put(updated);
        return updated;
    } catch (error) {
        console.warn('Failed to update video job:', id, error);
        return null;
    }
}

export async function getVideoJob(id: string): Promise<VideoJobRecord | null> {
    try {
        return await db.videoJobs.get(id) ?? null;
    } catch (error) {
        console.warn('Failed to get video job:', id, error);
        return null;
    }
}

export async function listResumableVideoJobs(): Promise<VideoJobRecord[]> {
    try {
        return await db.videoJobs
            .where('status')
            .anyOf(RESUMABLE_STATUSES)
            .reverse()
            .sortBy('updatedAt');
    } catch (error) {
        console.warn('Failed to list resumable video jobs:', error);
        return [];
    }
}

export async function listAllVideoJobs(): Promise<VideoJobRecord[]> {
    try {
        return await db.videoJobs.orderBy('updatedAt').reverse().toArray();
    } catch (error) {
        console.warn('Failed to list all video jobs:', error);
        return [];
    }
}

export async function removeVideoJob(id: string): Promise<void> {
    try {
        await db.videoJobs.delete(id);
    } catch (error) {
        console.warn('Failed to remove video job:', id, error);
    }
}

export async function purgeExpiredVideoJobs(olderThanMs: number): Promise<number> {
    try {
        const now = Date.now();
        const cutoff = now - olderThanMs;
        const jobs = await db.videoJobs.toArray();
        const toDelete = jobs.filter((job) =>
            TERMINAL_STATUSES.includes(job.status) && job.updatedAt < cutoff
        );
        for (const job of toDelete) {
            await db.videoJobs.delete(job.id);
        }
        return toDelete.length;
    } catch (error) {
        console.warn('Failed to purge expired video jobs:', error);
        return 0;
    }
}
