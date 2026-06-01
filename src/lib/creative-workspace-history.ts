import {
    ALL_CREATIVE_WORKSPACES_ID,
    DEFAULT_CREATIVE_WORKSPACE_ID,
    type CreativeWorkspaceHistoryScope,
    type WorkspaceScopedMetadata,
    type WorkspaceTaskScope
} from '@/types/creative-workspace';

export function normalizeHistoryWorkspaceId(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_CREATIVE_WORKSPACE_ID;
}

export function getScopedWorkspaceId(entry: WorkspaceScopedMetadata): string {
    return normalizeHistoryWorkspaceId(entry.workspaceId);
}

export function getScopedWorkspaceNameSnapshot(entry: WorkspaceScopedMetadata): string | undefined {
    return typeof entry.workspaceNameSnapshot === 'string' && entry.workspaceNameSnapshot.trim()
        ? entry.workspaceNameSnapshot.trim()
        : undefined;
}

export function isAllCreativeWorkspacesScope(scope: CreativeWorkspaceHistoryScope): boolean {
    return scope === ALL_CREATIVE_WORKSPACES_ID;
}

export function filterByCreativeWorkspace<T extends WorkspaceScopedMetadata>(
    entries: readonly T[],
    scope: CreativeWorkspaceHistoryScope
): T[] {
    if (isAllCreativeWorkspacesScope(scope)) return entries.map((entry) => ({ ...entry }));
    return entries
        .filter((entry) => getScopedWorkspaceId(entry) === scope)
        .map((entry) => ({ ...entry }));
}

export function withWorkspaceScope<T extends WorkspaceScopedMetadata>(entry: T, scope: WorkspaceTaskScope): T {
    return {
        ...entry,
        workspaceId: scope.workspaceId,
        workspaceNameSnapshot: scope.workspaceNameSnapshot
    };
}

export type MoveWorkspaceHistoryResult<T> = {
    entries: T[];
    moved: T[];
    unchanged: T[];
    missingIds: string[];
};

export function moveHistoryEntriesToWorkspace<T extends WorkspaceScopedMetadata>(
    entries: readonly T[],
    selectedIds: readonly string[],
    target: WorkspaceTaskScope,
    getEntryId: (entry: T) => string
): MoveWorkspaceHistoryResult<T> {
    const requestedIds = new Set(selectedIds.map((id) => id.trim()).filter(Boolean));
    const seenIds = new Set<string>();
    const moved: T[] = [];
    const unchanged: T[] = [];

    if (requestedIds.size === 0) {
        return {
            entries: entries.map((entry) => ({ ...entry })),
            moved,
            unchanged,
            missingIds: []
        };
    }

    const nextEntries = entries.map((entry) => {
        const entryId = getEntryId(entry);
        if (!requestedIds.has(entryId)) return { ...entry };

        seenIds.add(entryId);
        if (
            getScopedWorkspaceId(entry) === target.workspaceId &&
            getScopedWorkspaceNameSnapshot(entry) === target.workspaceNameSnapshot
        ) {
            const cloned = { ...entry };
            unchanged.push(cloned);
            return cloned;
        }

        const movedEntry = withWorkspaceScope(entry, target);
        moved.push(movedEntry);
        return movedEntry;
    });

    return {
        entries: nextEntries,
        moved,
        unchanged,
        missingIds: Array.from(requestedIds).filter((id) => !seenIds.has(id))
    };
}
