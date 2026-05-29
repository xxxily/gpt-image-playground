import { describe, expect, it } from 'vitest';
import {
    DEFAULT_CREATIVE_WORKSPACE_NAME,
    getCreativeWorkspaceDisplayName,
    getWorkspaceNameSnapshotDisplayName,
    normalizeCreativeWorkspaceState,
    validateCreativeWorkspaceName
} from './creative-workspace-store';
import { DEFAULT_CREATIVE_WORKSPACE_ID } from '@/types/creative-workspace';

describe('creative workspace store', () => {
    it('adds a default workspace for empty or legacy state', () => {
        const state = normalizeCreativeWorkspaceState(null, 1000);

        expect(state.activeWorkspaceId).toBe(DEFAULT_CREATIVE_WORKSPACE_ID);
        expect(state.workspaces).toHaveLength(1);
        expect(state.workspaces[0]).toMatchObject({
            id: DEFAULT_CREATIVE_WORKSPACE_ID,
            name: DEFAULT_CREATIVE_WORKSPACE_NAME,
            status: 'active'
        });
    });

    it('normalizes invalid active workspace ids to default', () => {
        const state = normalizeCreativeWorkspaceState(
            {
                version: 1,
                activeWorkspaceId: 'missing',
                workspaces: [
                    {
                        id: 'workspace_1',
                        name: 'Campaign',
                        status: 'active',
                        createdAt: 1,
                        updatedAt: 1
                    }
                ],
                updatedAt: 1
            },
            1000
        );

        expect(state.activeWorkspaceId).toBe(DEFAULT_CREATIVE_WORKSPACE_ID);
        expect(state.workspaces.map((workspace) => workspace.id)).toContain('workspace_1');
    });

    it('rejects empty, duplicate, and reserved names', () => {
        const state = normalizeCreativeWorkspaceState(
            {
                version: 1,
                activeWorkspaceId: DEFAULT_CREATIVE_WORKSPACE_ID,
                workspaces: [
                    {
                        id: 'workspace_1',
                        name: 'Campaign',
                        status: 'active',
                        createdAt: 1,
                        updatedAt: 1
                    }
                ],
                updatedAt: 1
            },
            1000
        );

        expect(validateCreativeWorkspaceName(state, '   ')).toEqual({ ok: false, reason: 'empty' });
        expect(validateCreativeWorkspaceName(state, 'campaign')).toEqual({ ok: false, reason: 'duplicate' });
        expect(validateCreativeWorkspaceName(state, '全部工作空间')).toEqual({ ok: false, reason: 'reserved' });
        expect(validateCreativeWorkspaceName(state, 'Spring Launch')).toEqual({ ok: true, name: 'Spring Launch' });
    });

    it('orders pinned workspaces first, then newest created without using last opened time', () => {
        const state = normalizeCreativeWorkspaceState(
            {
                version: 1,
                activeWorkspaceId: 'workspace_middle',
                workspaces: [
                    {
                        id: DEFAULT_CREATIVE_WORKSPACE_ID,
                        name: DEFAULT_CREATIVE_WORKSPACE_NAME,
                        status: 'active',
                        createdAt: 10,
                        updatedAt: 999999,
                        lastOpenedAt: 999999
                    },
                    {
                        id: 'workspace_middle',
                        name: 'Middle',
                        status: 'active',
                        createdAt: 30,
                        updatedAt: 30,
                        lastOpenedAt: 5000
                    },
                    {
                        id: 'workspace_newest',
                        name: 'Newest',
                        status: 'active',
                        createdAt: 40,
                        updatedAt: 40,
                        lastOpenedAt: 40
                    },
                    {
                        id: 'workspace_pinned_old',
                        name: 'Pinned old',
                        status: 'active',
                        favorite: true,
                        createdAt: 20,
                        updatedAt: 20,
                        lastOpenedAt: 20
                    }
                ],
                updatedAt: 999999
            },
            1000
        );

        expect(state.workspaces.map((workspace) => workspace.id)).toEqual([
            'workspace_pinned_old',
            'workspace_newest',
            'workspace_middle',
            DEFAULT_CREATIVE_WORKSPACE_ID
        ]);
    });

    it('localizes only system default workspace names for display', () => {
        expect(
            getCreativeWorkspaceDisplayName(
                { id: DEFAULT_CREATIVE_WORKSPACE_ID, name: DEFAULT_CREATIVE_WORKSPACE_NAME },
                'Default Workspace'
            )
        ).toBe('Default Workspace');
        expect(
            getWorkspaceNameSnapshotDisplayName(DEFAULT_CREATIVE_WORKSPACE_ID, '默认工作空间', 'Default Workspace')
        ).toBe('Default Workspace');
        expect(
            getCreativeWorkspaceDisplayName({ id: DEFAULT_CREATIVE_WORKSPACE_ID, name: 'Campaign' }, 'Default Workspace')
        ).toBe('Campaign');
    });
});
