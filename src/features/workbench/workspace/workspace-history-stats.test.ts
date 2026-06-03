import { describe, expect, it } from 'vitest';
import { buildWorkspaceHistoryStats, collectRunningWorkspaceIds } from './workspace-history-stats';
import type { HistoryMetadata, VisionTextHistoryMetadata } from '@/types/history';
import type { VideoHistoryMetadata } from '@/lib/video-types';

describe('buildWorkspaceHistoryStats', () => {
    it('aggregates image, vision text, and video history by workspace', () => {
        const stats = buildWorkspaceHistoryStats({
            imageHistory: [
                {
                    workspaceId: 'workspace-a',
                    images: [{ filename: 'a.png', size: 10 }, { filename: 'b.png' }]
                }
            ] as HistoryMetadata[],
            visionTextHistory: [
                {
                    workspaceId: 'workspace-a',
                    sourceImages: [{ filename: 'source.png', size: 7 }]
                }
            ] as VisionTextHistoryMetadata[],
            videoHistory: [
                {
                    workspaceId: 'workspace-b',
                    sourceAssets: [{ filename: 'source.mp4', size: 12 }],
                    resultAssets: [{ filename: 'result.mp4', size: 30 }]
                }
            ] as VideoHistoryMetadata[]
        });

        expect(stats.get('workspace-a')).toMatchObject({
            imageHistoryCount: 1,
            visionTextHistoryCount: 1,
            videoHistoryCount: 0,
            fileCount: 3,
            totalBytes: 17
        });
        expect(stats.get('workspace-b')).toMatchObject({
            imageHistoryCount: 0,
            visionTextHistoryCount: 0,
            videoHistoryCount: 1,
            fileCount: 2,
            totalBytes: 42
        });
    });
});

describe('collectRunningWorkspaceIds', () => {
    it('collects active image and video task workspace ids', () => {
        expect(
            collectRunningWorkspaceIds({
                imageTasks: [
                    { status: 'queued', workspaceId: 'image-a' },
                    { status: 'done', workspaceId: 'image-b' },
                    { status: 'streaming' }
                ],
                videoTasks: [
                    { status: 'polling', workspaceId: 'video-a' },
                    { status: 'succeeded', workspaceId: 'video-b' }
                ]
            })
        ).toEqual(['image-a', 'default', 'video-a']);
    });
});
