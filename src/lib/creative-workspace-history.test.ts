import { describe, expect, it } from 'vitest';
import {
    filterByCreativeWorkspace,
    getScopedWorkspaceId,
    moveHistoryEntriesToWorkspace,
    withWorkspaceScope
} from './creative-workspace-history';
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

    it('moves selected legacy and scoped entries to a target workspace', () => {
        const entries: Array<WorkspaceScopedMetadata & { id: string; prompt: string }> = [
            { id: '1', prompt: 'legacy' },
            { id: '2', prompt: 'other', workspaceId: 'workspace_old', workspaceNameSnapshot: 'Old' },
            { id: '3', prompt: 'skip', workspaceId: 'workspace_old', workspaceNameSnapshot: 'Old' }
        ];

        const result = moveHistoryEntriesToWorkspace(
            entries,
            ['1', '2'],
            { workspaceId: 'workspace_new', workspaceNameSnapshot: 'New' },
            (entry) => entry.id
        );

        expect(result.entries).toEqual([
            {
                id: '1',
                prompt: 'legacy',
                workspaceId: 'workspace_new',
                workspaceNameSnapshot: 'New'
            },
            {
                id: '2',
                prompt: 'other',
                workspaceId: 'workspace_new',
                workspaceNameSnapshot: 'New'
            },
            { id: '3', prompt: 'skip', workspaceId: 'workspace_old', workspaceNameSnapshot: 'Old' }
        ]);
        expect(result.moved).toHaveLength(2);
        expect(result.unchanged).toHaveLength(0);
        expect(result.missingIds).toEqual([]);
    });

    it('reports unchanged target entries and missing ids without mutating source entries', () => {
        const entries: Array<WorkspaceScopedMetadata & { id: string }> = [
            { id: '1', workspaceId: 'workspace_new', workspaceNameSnapshot: 'New' },
            { id: '2', workspaceId: 'workspace_old', workspaceNameSnapshot: 'Old' }
        ];

        const result = moveHistoryEntriesToWorkspace(
            entries,
            ['1', 'missing'],
            { workspaceId: 'workspace_new', workspaceNameSnapshot: 'New' },
            (entry) => entry.id
        );

        expect(result.entries).toEqual(entries);
        expect(result.entries[0]).not.toBe(entries[0]);
        expect(result.moved).toEqual([]);
        expect(result.unchanged).toEqual([{ id: '1', workspaceId: 'workspace_new', workspaceNameSnapshot: 'New' }]);
        expect(result.missingIds).toEqual(['missing']);
    });
});
