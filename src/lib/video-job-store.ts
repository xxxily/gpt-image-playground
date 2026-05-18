import { db, type VideoJobRecord } from '@/lib/db';
import type { VideoGenerationStatus } from '@/lib/video-types';

const RESUMABLE_STATUSES: VideoGenerationStatus[] = ['queued', 'running', 'polling'];
const TERMINAL_STATUSES: VideoGenerationStatus[] = ['succeeded', 'failed', 'cancelled', 'expired'];

function isTerminalStatus(status: VideoGenerationStatus | undefined): boolean {
    return status !== undefined && TERMINAL_STATUSES.includes(status);
}

export async function recordVideoJob(job: VideoJobRecord): Promise<boolean> {
    try {
        const normalized: VideoJobRecord = {
            ...job,
            updatedAt: typeof job.updatedAt === 'number' ? job.updatedAt : Date.now()
        };
        await db.videoJobs.put(normalized);
        return true;
    } catch (error) {
        console.warn('Failed to record video job:', error);
        return false;
    }
}

export async function updateVideoJob(
    id: string,
    patch: Partial<VideoJobRecord>
): Promise<VideoJobRecord | null> {
    try {
        const existing = await db.videoJobs.get(id);
        if (!existing) return null;

        const merged: VideoJobRecord = {
            ...existing,
            ...patch,
            id: existing.id,
            updatedAt: Date.now()
        };

        if (isTerminalStatus(patch.status) && merged.completedAt === undefined) {
            merged.completedAt = Date.now();
        }

        await db.videoJobs.put(merged);
        return merged;
    } catch (error) {
        console.warn('Failed to update video job:', error);
        return null;
    }
}

export async function getVideoJob(id: string): Promise<VideoJobRecord | null> {
    try {
        const record = await db.videoJobs.get(id);
        return record ?? null;
    } catch (error) {
        console.warn('Failed to read video job:', error);
        return null;
    }
}

export async function listResumableVideoJobs(): Promise<VideoJobRecord[]> {
    try {
        const records = await db.videoJobs.where('status').anyOf(RESUMABLE_STATUSES).toArray();
        return records.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    } catch (error) {
        console.warn('Failed to list resumable video jobs:', error);
        return [];
    }
}

export async function listAllVideoJobs(): Promise<VideoJobRecord[]> {
    try {
        const records = await db.videoJobs.toArray();
        return records.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    } catch (error) {
        console.warn('Failed to list video jobs:', error);
        return [];
    }
}

export async function removeVideoJob(id: string): Promise<boolean> {
    try {
        await db.videoJobs.delete(id);
        return true;
    } catch (error) {
        console.warn('Failed to delete video job:', error);
        return false;
    }
}

export async function purgeExpiredVideoJobs(olderThanMs: number): Promise<number> {
    if (!Number.isFinite(olderThanMs) || olderThanMs <= 0) return 0;

    try {
        const cutoff = Date.now() - olderThanMs;
        const records = await db.videoJobs.toArray();
        const expired = records.filter(
            (record) => isTerminalStatus(record.status) && (record.updatedAt ?? 0) < cutoff
        );
        for (const record of expired) {
            await db.videoJobs.delete(record.id);
        }
        return expired.length;
    } catch (error) {
        console.warn('Failed to purge expired video jobs:', error);
        return 0;
    }
}
