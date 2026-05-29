import { describe, expect, it } from 'vitest';
import { buildWorkspaceDeletionPlan } from './creative-workspace-deletion';
import type { HistoryMetadata, VisionTextHistoryMetadata } from '@/types/history';
import type { VideoHistoryMetadata } from '@/lib/video-types';

function imageEntry(workspaceId: string): HistoryMetadata {
    return {
        timestamp: 1,
        workspaceId,
        images: [{ filename: `${workspaceId}.png`, size: 10 }],
        durationMs: 100,
        quality: 'auto',
        background: 'auto',
        moderation: 'auto',
        prompt: 'prompt',
        mode: 'generate',
        costDetails: null
    };
}

describe('creative workspace deletion plan', () => {
    it('collects only histories and files owned by the target workspace', () => {
        const plan = buildWorkspaceDeletionPlan({
            workspaceId: 'workspace_1',
            imageHistory: [imageEntry('workspace_1'), imageEntry('workspace_2')],
            visionTextHistory: [
                {
                    id: 'vision_1',
                    workspaceId: 'workspace_1',
                    type: 'image-to-text',
                    timestamp: 2,
                    durationMs: 100,
                    prompt: 'describe',
                    taskType: 'prompt_extraction',
                    detail: 'auto',
                    responseFormat: 'text',
                    structuredOutputEnabled: false,
                    maxOutputTokens: 1000,
                    sourceImages: [
                        {
                            filename: 'source.png',
                            storageModeUsed: 'indexeddb',
                            source: 'uploaded'
                        }
                    ],
                    resultText: 'text',
                    providerKind: 'openai',
                    providerInstanceId: 'openai',
                    model: 'gpt-4.1',
                    apiCompatibility: 'responses'
                } satisfies VisionTextHistoryMetadata
            ],
            videoHistory: [] as VideoHistoryMetadata[]
        });

        expect(plan.localImageHistoryTimestamps).toEqual([1]);
        expect(plan.localVisionTextHistoryIds).toEqual(['vision_1']);
        expect(plan.localFilePointers.map((pointer) => pointer.filename).sort()).toEqual([
            'source.png',
            'workspace_1.png'
        ]);
        expect(plan.blockedReasons).toEqual([]);
    });

    it('blocks default workspace deletion and running workspace deletion', () => {
        const plan = buildWorkspaceDeletionPlan({
            workspaceId: 'default',
            imageHistory: [],
            visionTextHistory: [],
            videoHistory: [],
            runningWorkspaceIds: ['default']
        });

        expect(plan.blockedReasons).toEqual(['default-workspace-delete-disabled', 'running-tasks']);
    });
});
