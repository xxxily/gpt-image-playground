import { getScopedWorkspaceId } from '@/lib/creative-workspace-history';
import { DEFAULT_CREATIVE_WORKSPACE_ID } from '@/types/creative-workspace';
import type { HistoryMetadata, VisionTextHistoryMetadata } from '@/types/history';
import type { VideoHistoryMetadata } from '@/lib/video-types';

export type WorkspaceHistoryStats = {
    imageHistoryCount: number;
    visionTextHistoryCount: number;
    videoHistoryCount: number;
    fileCount: number;
    totalBytes: number;
};

type WorkspaceTaskLike = {
    status: string;
    workspaceId?: string;
};

const ACTIVE_IMAGE_TASK_STATUSES = new Set(['queued', 'running', 'streaming']);
const ACTIVE_VIDEO_TASK_STATUSES = new Set(['queued', 'running', 'polling']);

function ensureStats(stats: Map<string, WorkspaceHistoryStats>, workspaceId: string) {
    const current = stats.get(workspaceId);
    if (current) return current;
    const next: WorkspaceHistoryStats = {
        imageHistoryCount: 0,
        visionTextHistoryCount: 0,
        videoHistoryCount: 0,
        fileCount: 0,
        totalBytes: 0
    };
    stats.set(workspaceId, next);
    return next;
}

export function buildWorkspaceHistoryStats({
    imageHistory,
    visionTextHistory,
    videoHistory
}: {
    imageHistory: readonly HistoryMetadata[];
    visionTextHistory: readonly VisionTextHistoryMetadata[];
    videoHistory: readonly VideoHistoryMetadata[];
}) {
    const stats = new Map<string, WorkspaceHistoryStats>();

    for (const item of imageHistory) {
        const stat = ensureStats(stats, getScopedWorkspaceId(item));
        stat.imageHistoryCount += 1;
        stat.fileCount += item.images.length;
        stat.totalBytes += item.images.reduce((sum, image) => sum + (image.size ?? 0), 0);
    }
    for (const item of visionTextHistory) {
        const stat = ensureStats(stats, getScopedWorkspaceId(item));
        stat.visionTextHistoryCount += 1;
        stat.fileCount += item.sourceImages.length;
        stat.totalBytes += item.sourceImages.reduce((sum, image) => sum + (image.size ?? 0), 0);
    }
    for (const item of videoHistory) {
        const stat = ensureStats(stats, getScopedWorkspaceId(item));
        stat.videoHistoryCount += 1;
        stat.fileCount += item.sourceAssets.length + item.resultAssets.length;
        stat.totalBytes += [...item.sourceAssets, ...item.resultAssets].reduce(
            (sum, asset) => sum + (asset.size ?? 0),
            0
        );
    }

    return stats;
}

export function collectRunningWorkspaceIds({
    imageTasks,
    videoTasks
}: {
    imageTasks: readonly WorkspaceTaskLike[];
    videoTasks: readonly WorkspaceTaskLike[];
}) {
    const ids: string[] = [];
    for (const task of imageTasks) {
        if (ACTIVE_IMAGE_TASK_STATUSES.has(task.status)) {
            ids.push(task.workspaceId ?? DEFAULT_CREATIVE_WORKSPACE_ID);
        }
    }
    for (const task of videoTasks) {
        if (ACTIVE_VIDEO_TASK_STATUSES.has(task.status)) {
            ids.push(task.workspaceId ?? DEFAULT_CREATIVE_WORKSPACE_ID);
        }
    }
    return ids;
}
