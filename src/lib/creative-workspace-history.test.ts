import { describe, expect, it } from 'vitest';
import { filterByCreativeWorkspace, getScopedWorkspaceId, withWorkspaceScope } from './creative-workspace-history';
import {
    ALL_CREATIVE_WORKSPACES_ID,
    DEFAULT_CREATIVE_WORKSPACE_ID,
    type WorkspaceScopedMetadata
} from '@/types/creative-workspace';

describe('creative workspace history helpers', () => {
    it('treats missing workspace ids as default workspace', () => {
        expect(getScopedWorkspaceId({})).toBe(DEFAULT_CREATIVE_WORKSPACE_ID);
        expect(getScopedWorkspaceId({ workspaceId: 'workspace_1' })).toBe('workspace_1');
    });

    it('filters by a concrete workspace or returns all for all-workspaces scope', () => {
        const entries: WorkspaceScopedMetadata[] = [
            {},
            { workspaceId: 'workspace_1' },
            { workspaceId: 'workspace_2' }
        ];

        expect(filterByCreativeWorkspace(entries, DEFAULT_CREATIVE_WORKSPACE_ID)).toEqual([{}]);
        expect(filterByCreativeWorkspace(entries, 'workspace_1')).toEqual([{ workspaceId: 'workspace_1' }]);
        expect(filterByCreativeWorkspace(entries, ALL_CREATIVE_WORKSPACES_ID)).toEqual(entries);
    });

    it('applies submit-time workspace scope without reading current state later', () => {
        expect(
            withWorkspaceScope(
                { workspaceId: 'old' },
                { workspaceId: 'workspace_1', workspaceNameSnapshot: 'Campaign' }
            )
        ).toEqual({ workspaceId: 'workspace_1', workspaceNameSnapshot: 'Campaign' });
    });
});
