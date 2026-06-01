'use client';

import {
    CREATIVE_WORKSPACE_CHANGED_EVENT,
    compareCreativeWorkspacesByDisplayOrder,
    createCreativeWorkspaceId,
    getActiveCreativeWorkspace,
    loadCreativeWorkspaceState,
    normalizeCreativeWorkspaceState,
    normalizeWorkspaceColor,
    saveCreativeWorkspaceState,
    validateCreativeWorkspaceName
} from '@/lib/creative-workspace-store';
import { DEFAULT_CREATIVE_WORKSPACE_ID, type CreativeWorkspace, type CreativeWorkspaceState } from '@/types/creative-workspace';
import * as React from 'react';

type CreateWorkspaceInput = {
    name: string;
    description?: string;
    color?: string;
};

type CreateWorkspaceOptions = {
    activate?: boolean;
};

export function useCreativeWorkspaces() {
    const [state, setState] = React.useState<CreativeWorkspaceState>(() => normalizeCreativeWorkspaceState(null));

    React.useEffect(() => {
        const refresh = () => setState(loadCreativeWorkspaceState());
        refresh();
        window.addEventListener(CREATIVE_WORKSPACE_CHANGED_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(CREATIVE_WORKSPACE_CHANGED_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    const persist = React.useCallback((nextState: CreativeWorkspaceState) => {
        const normalizedState = normalizeCreativeWorkspaceState(nextState);
        const saved = saveCreativeWorkspaceState(normalizedState);
        setState(normalizedState);
        return saved;
    }, []);

    const createWorkspace = React.useCallback(
        (
            input: CreateWorkspaceInput,
            options?: CreateWorkspaceOptions
        ): { ok: true; workspace: CreativeWorkspace } | { ok: false; reason: string } => {
            const validation = validateCreativeWorkspaceName(state, input.name);
            if (!validation.ok) return { ok: false, reason: validation.reason };
            const now = Date.now();
            const shouldActivate = options?.activate !== false;
            const workspace: CreativeWorkspace = {
                id: createCreativeWorkspaceId(),
                name: validation.name,
                ...(input.description?.trim() ? { description: input.description.trim() } : {}),
                color: normalizeWorkspaceColor(input.color),
                status: 'active',
                createdAt: now,
                updatedAt: now,
                ...(shouldActivate ? { lastOpenedAt: now } : {})
            };
            const nextState: CreativeWorkspaceState = {
                ...state,
                activeWorkspaceId: shouldActivate ? workspace.id : state.activeWorkspaceId,
                workspaces: [workspace, ...state.workspaces],
                updatedAt: now
            };
            persist(nextState);
            return { ok: true, workspace };
        },
        [persist, state]
    );

    const enterWorkspace = React.useCallback(
        (workspaceId: string): boolean => {
            const workspace = state.workspaces.find((item) => item.id === workspaceId);
            if (!workspace) return false;
            const now = Date.now();
            persist({
                ...state,
                activeWorkspaceId: workspaceId,
                workspaces: state.workspaces.map((item) =>
                    item.id === workspaceId ? { ...item, lastOpenedAt: now, updatedAt: now } : item
                ),
                updatedAt: now
            });
            return true;
        },
        [persist, state]
    );

    const renameWorkspace = React.useCallback(
        (
            workspaceId: string,
            name: string,
            description?: string,
            color?: string
        ): { ok: true } | { ok: false; reason: string } => {
            const validation = validateCreativeWorkspaceName(state, name, { ignoreWorkspaceId: workspaceId });
            if (!validation.ok) return { ok: false, reason: validation.reason };
            const now = Date.now();
            persist({
                ...state,
                workspaces: state.workspaces.map((item) =>
                    item.id === workspaceId
                        ? {
                              ...item,
                              name: validation.name,
                              ...(description !== undefined
                                  ? description.trim()
                                      ? { description: description.trim() }
                                      : { description: undefined }
                                  : {}),
                              ...(color !== undefined ? { color: normalizeWorkspaceColor(color) } : {}),
                              updatedAt: now
                          }
                        : item
                ),
                updatedAt: now
            });
            return { ok: true };
        },
        [persist, state]
    );

    const setWorkspacePinned = React.useCallback(
        (workspaceId: string, pinned: boolean): boolean => {
            const workspace = state.workspaces.find((item) => item.id === workspaceId);
            if (!workspace) return false;
            const now = Date.now();
            persist({
                ...state,
                workspaces: state.workspaces.map((item) =>
                    item.id === workspaceId ? { ...item, favorite: pinned, updatedAt: now } : item
                ),
                updatedAt: now
            });
            return true;
        },
        [persist, state]
    );

    const setWorkspaceArchived = React.useCallback(
        (workspaceId: string, archived: boolean): boolean => {
            const workspace = state.workspaces.find((item) => item.id === workspaceId);
            if (!workspace) return false;
            const now = Date.now();
            const nextActive =
                archived && state.activeWorkspaceId === workspaceId ? DEFAULT_CREATIVE_WORKSPACE_ID : state.activeWorkspaceId;
            persist({
                ...state,
                activeWorkspaceId: nextActive,
                workspaces: state.workspaces.map((item) =>
                    item.id === workspaceId ? { ...item, status: archived ? 'archived' : 'active', updatedAt: now } : item
                ),
                updatedAt: now
            });
            return true;
        },
        [persist, state]
    );

    const removeWorkspaceMetadata = React.useCallback(
        (workspaceId: string): CreativeWorkspace | null => {
            const workspace = state.workspaces.find((item) => item.id === workspaceId);
            if (!workspace || workspaceId === DEFAULT_CREATIVE_WORKSPACE_ID) return null;
            const now = Date.now();
            const remaining = state.workspaces.filter((item) => item.id !== workspaceId);
            const fallback =
                remaining
                    .filter((item) => item.status === 'active')
                    .sort(compareCreativeWorkspacesByDisplayOrder)[0]?.id ??
                DEFAULT_CREATIVE_WORKSPACE_ID;
            persist({
                ...state,
                activeWorkspaceId: state.activeWorkspaceId === workspaceId ? fallback : state.activeWorkspaceId,
                workspaces: remaining,
                tombstones: [
                    ...(state.tombstones ?? []),
                    {
                        workspaceId,
                        workspaceNameSnapshot: workspace.name,
                        deletedAt: now
                    }
                ],
                updatedAt: now
            });
            return workspace;
        },
        [persist, state]
    );

    const activeWorkspace = React.useMemo(() => getActiveCreativeWorkspace(state), [state]);

    return {
        state,
        workspaces: state.workspaces,
        activeWorkspace,
        activeWorkspaceId: state.activeWorkspaceId,
        createWorkspace,
        enterWorkspace,
        renameWorkspace,
        setWorkspacePinned,
        setWorkspaceArchived,
        removeWorkspaceMetadata
    };
}
