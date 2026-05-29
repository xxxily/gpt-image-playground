import { getScopedWorkspaceId } from '@/lib/creative-workspace-history';
import { DEFAULT_CREATIVE_WORKSPACE_ID, type WorkspaceFilePointer } from '@/types/creative-workspace';
import type { HistoryMetadata, VisionTextHistoryMetadata } from '@/types/history';
import type { VideoHistoryMetadata } from '@/lib/video-types';

export type WorkspaceDeletionPlan = {
    workspaceId: string;
    localImageHistoryTimestamps: number[];
    localVisionTextHistoryIds: string[];
    localVideoHistoryIds: string[];
    localFilePointers: WorkspaceFilePointer[];
    remoteKeys: string[];
    sharedFilePointers: WorkspaceFilePointer[];
    blockedReasons: string[];
};

export type WorkspaceDeletionStatus =
    | 'planning'
    | 'blocked'
    | 'deleting-history'
    | 'deleting-local-files'
    | 'deleting-remote-files'
    | 'writing-tombstone'
    | 'completed'
    | 'partial-failed';

type BuildWorkspaceDeletionPlanInput = {
    workspaceId: string;
    imageHistory: readonly HistoryMetadata[];
    visionTextHistory: readonly VisionTextHistoryMetadata[];
    videoHistory: readonly VideoHistoryMetadata[];
    runningWorkspaceIds?: readonly string[];
    allowDefaultWorkspaceDelete?: boolean;
};

function makePointer(
    id: string,
    workspaceId: string,
    filename: string | undefined,
    owner: WorkspaceFilePointer['owner'],
    storageMode: WorkspaceFilePointer['storageMode'],
    createdAt: number,
    options?: Pick<WorkspaceFilePointer, 'path' | 'size' | 'mimeType' | 'remoteKey' | 'shared'>
): WorkspaceFilePointer | null {
    if (!filename && !options?.path && !options?.remoteKey) return null;
    return {
        id,
        workspaceId,
        owner,
        storageMode,
        ...(filename ? { filename } : {}),
        ...(options?.path ? { path: options.path } : {}),
        ...(typeof options?.size === 'number' ? { size: options.size } : {}),
        ...(options?.mimeType ? { mimeType: options.mimeType } : {}),
        ...(options?.remoteKey ? { remoteKey: options.remoteKey } : {}),
        ...(options?.shared ? { shared: true } : {}),
        createdAt
    };
}

export function buildWorkspaceDeletionPlan(input: BuildWorkspaceDeletionPlanInput): WorkspaceDeletionPlan {
    const runningWorkspaceIds = new Set(input.runningWorkspaceIds ?? []);
    const blockedReasons: string[] = [];

    if (input.workspaceId === DEFAULT_CREATIVE_WORKSPACE_ID && !input.allowDefaultWorkspaceDelete) {
        blockedReasons.push('default-workspace-delete-disabled');
    }
    if (runningWorkspaceIds.has(input.workspaceId)) {
        blockedReasons.push('running-tasks');
    }

    const imageHistory = input.imageHistory.filter((entry) => getScopedWorkspaceId(entry) === input.workspaceId);
    const visionTextHistory = input.visionTextHistory.filter(
        (entry) => getScopedWorkspaceId(entry) === input.workspaceId
    );
    const videoHistory = input.videoHistory.filter((entry) => getScopedWorkspaceId(entry) === input.workspaceId);
    const filePointers: WorkspaceFilePointer[] = [];

    for (const entry of imageHistory) {
        for (const image of entry.images) {
            const pointer = makePointer(
                `image-history-output:${entry.timestamp}:${image.filename}`,
                input.workspaceId,
                image.filename,
                'image-history-output',
                entry.storageModeUsed ?? 'indexeddb',
                entry.timestamp,
                { path: image.path, size: image.size }
            );
            if (pointer) filePointers.push(pointer);
        }
    }

    for (const entry of visionTextHistory) {
        for (const image of entry.sourceImages) {
            const pointer = makePointer(
                `vision-text-source:${entry.id}:${image.filename}`,
                input.workspaceId,
                image.filename,
                'vision-text-source',
                image.storageModeUsed ?? 'indexeddb',
                entry.timestamp,
                { path: image.path, size: image.size, mimeType: image.mimeType }
            );
            if (pointer) filePointers.push(pointer);
        }
    }

    for (const entry of videoHistory) {
        for (const source of entry.sourceAssets) {
            const pointer = makePointer(
                `video-source:${entry.id}:${source.filename}`,
                input.workspaceId,
                source.filename,
                'video-source',
                source.storageModeUsed ?? 'indexeddb',
                entry.timestamp,
                { size: source.size, mimeType: source.mimeType }
            );
            if (pointer) filePointers.push(pointer);
        }
        for (const asset of entry.resultAssets) {
            const pointer = makePointer(
                `video-output:${entry.id}:${asset.filename}`,
                input.workspaceId,
                asset.filename,
                asset.kind === 'thumbnail' ? 'video-output' : 'video-output',
                asset.storageModeUsed ?? 'indexeddb',
                entry.timestamp,
                { size: asset.size, mimeType: asset.mimeType, remoteKey: asset.remoteUrl }
            );
            if (pointer) filePointers.push(pointer);
        }
    }

    const uniqueById = new Map<string, WorkspaceFilePointer>();
    for (const pointer of filePointers) {
        uniqueById.set(pointer.id, pointer);
    }

    return {
        workspaceId: input.workspaceId,
        localImageHistoryTimestamps: imageHistory.map((entry) => entry.timestamp),
        localVisionTextHistoryIds: visionTextHistory.map((entry) => entry.id),
        localVideoHistoryIds: videoHistory.map((entry) => entry.id),
        localFilePointers: Array.from(uniqueById.values()).filter((pointer) => !pointer.shared),
        remoteKeys: Array.from(
            new Set(
                Array.from(uniqueById.values())
                    .map((pointer) => pointer.remoteKey)
                    .filter((key): key is string => Boolean(key))
            )
        ),
        sharedFilePointers: Array.from(uniqueById.values()).filter((pointer) => pointer.shared),
        blockedReasons
    };
}
