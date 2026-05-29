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
