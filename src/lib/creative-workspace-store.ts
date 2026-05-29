import { generateId } from '@/lib/id';
import {
    ALL_CREATIVE_WORKSPACES_ID,
    DEFAULT_CREATIVE_WORKSPACE_ID,
    type CreativeWorkspace,
    type CreativeWorkspaceState,
    type CreativeWorkspaceStatus,
    type CreativeWorkspaceTombstone
} from '@/types/creative-workspace';

export const CREATIVE_WORKSPACE_STORAGE_KEY = 'gpt-image-playground-creative-workspaces-v1';
export const CREATIVE_WORKSPACE_CHANGED_EVENT = 'gpt-image-playground:creative-workspaces-changed';
export const CREATIVE_WORKSPACE_STATE_VERSION = 1;
export const DEFAULT_CREATIVE_WORKSPACE_NAME = '默认工作空间';

export const DEFAULT_WORKSPACE_COLOR = '#2563eb';
export const WORKSPACE_COLOR_PALETTE = [
    '#2563eb',
    '#0284c7',
    '#0891b2',
    '#0f766e',
    '#059669',
    '#4d7c0f',
    '#b45309',
    '#c2410c',
    '#dc2626',
    '#be123c',
    '#7c3aed',
    '#9333ea',
    '#a21caf',
    '#475569'
] as const;
const DEFAULT_WORKSPACE_NAMES = new Set(['默认工作空间', 'Default Workspace']);
const RESERVED_WORKSPACE_NAMES = new Set(['全部工作空间', 'All Workspaces', '默认工作空间', 'Default Workspace']);
const WORKSPACE_COLOR_SET = new Set<string>(WORKSPACE_COLOR_PALETTE);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeWorkspaceColor(value: unknown): string {
    const color = normalizeOptionalString(value);
    return color && WORKSPACE_COLOR_SET.has(color) ? color : DEFAULT_WORKSPACE_COLOR;
}

function normalizeStatus(value: unknown): CreativeWorkspaceStatus {
    return value === 'archived' ? 'archived' : 'active';
}

function normalizeWorkspaceId(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function createDefaultCreativeWorkspace(now = Date.now()): CreativeWorkspace {
    return {
        id: DEFAULT_CREATIVE_WORKSPACE_ID,
        name: DEFAULT_CREATIVE_WORKSPACE_NAME,
        color: DEFAULT_WORKSPACE_COLOR,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now
    };
}

export function isReservedCreativeWorkspaceName(name: string): boolean {
    return RESERVED_WORKSPACE_NAMES.has(name.trim());
}

export function isDefaultCreativeWorkspaceName(name: string | undefined): boolean {
    return typeof name === 'string' && DEFAULT_WORKSPACE_NAMES.has(name.trim());
}

export function getCreativeWorkspaceDisplayName(
    workspace: Pick<CreativeWorkspace, 'id' | 'name'>,
    defaultWorkspaceName: string
): string {
    if (workspace.id === DEFAULT_CREATIVE_WORKSPACE_ID && isDefaultCreativeWorkspaceName(workspace.name)) {
        return defaultWorkspaceName;
    }
    return workspace.name;
}

export function getWorkspaceNameSnapshotDisplayName(
    workspaceId: string | undefined,
    workspaceNameSnapshot: string | undefined,
    defaultWorkspaceName: string
): string | undefined {
    const trimmedName = typeof workspaceNameSnapshot === 'string' ? workspaceNameSnapshot.trim() : '';
    if (workspaceId === DEFAULT_CREATIVE_WORKSPACE_ID && (!trimmedName || isDefaultCreativeWorkspaceName(trimmedName))) {
        return defaultWorkspaceName;
    }
    return trimmedName || undefined;
}

export function compareCreativeWorkspacesByDisplayOrder(a: CreativeWorkspace, b: CreativeWorkspace): number {
    const favoriteDelta = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
    if (favoriteDelta) return favoriteDelta;
    const createdAtDelta = b.createdAt - a.createdAt;
    if (createdAtDelta) return createdAtDelta;
    return a.id.localeCompare(b.id);
}

export function normalizeCreativeWorkspace(value: unknown, now = Date.now()): CreativeWorkspace | null {
    if (!isRecord(value)) return null;

    const id = normalizeWorkspaceId(value.id);
    if (!id || id === ALL_CREATIVE_WORKSPACES_ID) return null;

    const rawName = typeof value.name === 'string' ? value.name.trim() : '';
    const name = rawName || (id === DEFAULT_CREATIVE_WORKSPACE_ID ? DEFAULT_CREATIVE_WORKSPACE_NAME : '');
    if (!name) return null;

    const createdAt = isFiniteNumber(value.createdAt) && value.createdAt > 0 ? value.createdAt : now;
    const updatedAt = isFiniteNumber(value.updatedAt) && value.updatedAt > 0 ? value.updatedAt : createdAt;
    const workspace: CreativeWorkspace = {
        id,
        name,
        status: id === DEFAULT_CREATIVE_WORKSPACE_ID ? normalizeStatus(value.status) : normalizeStatus(value.status),
        createdAt,
        updatedAt
    };

    const description = normalizeOptionalString(value.description);
    const color = normalizeWorkspaceColor(value.color);
    const icon = normalizeOptionalString(value.icon);
    if (description) workspace.description = description;
    workspace.color = color;
    if (icon) workspace.icon = icon;
    if (typeof value.favorite === 'boolean') workspace.favorite = value.favorite;
    if (isFiniteNumber(value.order)) workspace.order = Math.round(value.order);
    if (isFiniteNumber(value.lastOpenedAt) && value.lastOpenedAt > 0) workspace.lastOpenedAt = value.lastOpenedAt;
    if (isFiniteNumber(value.lastTaskAt) && value.lastTaskAt > 0) workspace.lastTaskAt = value.lastTaskAt;

    if (isRecord(value.stats)) {
        workspace.stats = {
            imageHistoryCount:
                isFiniteNumber(value.stats.imageHistoryCount) && value.stats.imageHistoryCount >= 0
                    ? Math.floor(value.stats.imageHistoryCount)
                    : 0,
            visionTextHistoryCount:
                isFiniteNumber(value.stats.visionTextHistoryCount) && value.stats.visionTextHistoryCount >= 0
                    ? Math.floor(value.stats.visionTextHistoryCount)
                    : 0,
            videoHistoryCount:
                isFiniteNumber(value.stats.videoHistoryCount) && value.stats.videoHistoryCount >= 0
                    ? Math.floor(value.stats.videoHistoryCount)
                    : 0,
            fileCount:
                isFiniteNumber(value.stats.fileCount) && value.stats.fileCount >= 0
                    ? Math.floor(value.stats.fileCount)
                    : 0,
            ...(isFiniteNumber(value.stats.totalBytes) && value.stats.totalBytes >= 0
                ? { totalBytes: Math.floor(value.stats.totalBytes) }
                : {})
        };
    }

    return workspace;
}

function normalizeTombstone(value: unknown): CreativeWorkspaceTombstone | null {
    if (!isRecord(value)) return null;
    const workspaceId = normalizeWorkspaceId(value.workspaceId);
    const workspaceNameSnapshot = normalizeOptionalString(value.workspaceNameSnapshot);
    if (!workspaceId || !workspaceNameSnapshot) return null;
    const deletedAt = isFiniteNumber(value.deletedAt) && value.deletedAt > 0 ? value.deletedAt : 0;
    if (!deletedAt) return null;
    const deviceId = normalizeOptionalString(value.deviceId);
    return {
        workspaceId,
        workspaceNameSnapshot,
        deletedAt,
        ...(deviceId ? { deviceId } : {})
    };
}

export function normalizeCreativeWorkspaceState(value: unknown, now = Date.now()): CreativeWorkspaceState {
    const record = isRecord(value) && value.version === CREATIVE_WORKSPACE_STATE_VERSION ? value : {};
    const workspacesById = new Map<string, CreativeWorkspace>();

    if (Array.isArray(record.workspaces)) {
        for (const rawWorkspace of record.workspaces) {
            const workspace = normalizeCreativeWorkspace(rawWorkspace, now);
            if (workspace) workspacesById.set(workspace.id, workspace);
        }
    }

    if (!workspacesById.has(DEFAULT_CREATIVE_WORKSPACE_ID)) {
        workspacesById.set(DEFAULT_CREATIVE_WORKSPACE_ID, createDefaultCreativeWorkspace(now));
    }

    const workspaces = Array.from(workspacesById.values()).sort(compareCreativeWorkspacesByDisplayOrder);
    const activeWorkspaceId = normalizeWorkspaceId(record.activeWorkspaceId);
    const activeExists = activeWorkspaceId && workspaces.some((workspace) => workspace.id === activeWorkspaceId);
    const tombstones = Array.isArray(record.tombstones)
        ? record.tombstones
              .map(normalizeTombstone)
              .filter((entry): entry is CreativeWorkspaceTombstone => entry !== null)
        : [];

    return {
        version: CREATIVE_WORKSPACE_STATE_VERSION,
        activeWorkspaceId: activeExists ? activeWorkspaceId : DEFAULT_CREATIVE_WORKSPACE_ID,
        workspaces,
        ...(tombstones.length > 0 ? { tombstones } : {}),
        updatedAt: isFiniteNumber(record.updatedAt) && record.updatedAt > 0 ? record.updatedAt : now
    };
}

export function getCreativeWorkspaceById(
    state: CreativeWorkspaceState,
    workspaceId: string
): CreativeWorkspace | undefined {
    return state.workspaces.find((workspace) => workspace.id === workspaceId);
}

export function getActiveCreativeWorkspace(state: CreativeWorkspaceState): CreativeWorkspace {
    return getCreativeWorkspaceById(state, state.activeWorkspaceId) ?? createDefaultCreativeWorkspace(state.updatedAt);
}

export function createCreativeWorkspaceId(): string {
    return generateId('workspace');
}

export function validateCreativeWorkspaceName(
    state: CreativeWorkspaceState,
    name: string,
    options?: { ignoreWorkspaceId?: string }
): { ok: true; name: string } | { ok: false; reason: 'empty' | 'duplicate' | 'reserved' } {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, reason: 'empty' };
    if (isReservedCreativeWorkspaceName(trimmed) && options?.ignoreWorkspaceId !== DEFAULT_CREATIVE_WORKSPACE_ID) {
        return { ok: false, reason: 'reserved' };
    }
    const duplicate = state.workspaces.some(
        (workspace) =>
            workspace.id !== options?.ignoreWorkspaceId &&
            workspace.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase()
    );
    if (duplicate) return { ok: false, reason: 'duplicate' };
    return { ok: true, name: trimmed };
}

export function loadCreativeWorkspaceState(): CreativeWorkspaceState {
    if (typeof window === 'undefined') return normalizeCreativeWorkspaceState(null);

    try {
        const stored = window.localStorage.getItem(CREATIVE_WORKSPACE_STORAGE_KEY);
        return normalizeCreativeWorkspaceState(stored ? JSON.parse(stored) : null);
    } catch (error) {
        console.warn('Failed to load creative workspaces:', error);
        return normalizeCreativeWorkspaceState(null);
    }
}

export function saveCreativeWorkspaceState(state: CreativeWorkspaceState): boolean {
    if (typeof window === 'undefined') return true;

    try {
        window.localStorage.setItem(
            CREATIVE_WORKSPACE_STORAGE_KEY,
            JSON.stringify(normalizeCreativeWorkspaceState(state))
        );
        window.dispatchEvent(new CustomEvent(CREATIVE_WORKSPACE_CHANGED_EVENT));
        return true;
    } catch (error) {
        console.warn('Failed to save creative workspaces:', error);
        return false;
    }
}
