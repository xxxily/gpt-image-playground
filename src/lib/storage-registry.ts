export type StorageMedium = 'localStorage' | 'indexedDB' | 'filesystem';
export type StorageGroup = 'config' | 'history' | 'sync' | 'assets' | 'workspace' | 'ui' | 'auth' | 'cache';
export type StorageSensitivity = 'public' | 'user-content' | 'sensitive' | 'secret';

export type StorageRegistryEntry = {
    id: string;
    medium: StorageMedium;
    key: string;
    group: StorageGroup;
    sensitivity: StorageSensitivity;
    synced: boolean;
    exported: boolean;
    clearable: boolean;
    retention: 'until-user-clears' | 'session' | 'cache' | 'external';
    description: string;
};

export type LocalStorageBackup = {
    createdAt: number;
    entries: Record<string, string>;
};

export const STORAGE_REGISTRY: readonly StorageRegistryEntry[] = [
    {
        id: 'app-config',
        medium: 'localStorage',
        key: 'gpt-image-playground-config',
        group: 'config',
        sensitivity: 'secret',
        synced: true,
        exported: true,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Versioned app configuration, provider endpoints, model catalog, and local preferences.'
    },
    {
        id: 'app-config-backups',
        medium: 'localStorage',
        key: 'gpt-image-playground-config-backup-*',
        group: 'config',
        sensitivity: 'secret',
        synced: false,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Short local backup chain created before importing app configuration.'
    },
    {
        id: 'client-password-hash',
        medium: 'localStorage',
        key: 'clientPasswordHash',
        group: 'auth',
        sensitivity: 'sensitive',
        synced: false,
        exported: false,
        clearable: false,
        retention: 'until-user-clears',
        description: 'Deprecated APP_PASSWORD compatibility hash used as a bearer credential.'
    },
    {
        id: 'sync-config',
        medium: 'localStorage',
        key: 'gpt-image-playground-sync-config',
        group: 'sync',
        sensitivity: 'secret',
        synced: false,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'S3-compatible sync endpoint, bucket, access key, secret key, and sync UI settings.'
    },
    {
        id: 'sync-device-id',
        medium: 'localStorage',
        key: 'gpt-image-playground-sync-device-id',
        group: 'sync',
        sensitivity: 'sensitive',
        synced: false,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Device identifier used to separate sync revisions and tombstones.'
    },
    {
        id: 'image-history',
        medium: 'localStorage',
        key: 'openaiImageHistory',
        group: 'history',
        sensitivity: 'user-content',
        synced: true,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Image generation history metadata.'
    },
    {
        id: 'prompt-history',
        medium: 'localStorage',
        key: 'gpt-image-playground-prompt-history',
        group: 'history',
        sensitivity: 'user-content',
        synced: true,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Prompt history entries.'
    },
    {
        id: 'vision-text-history',
        medium: 'localStorage',
        key: 'gpt-image-playground-vision-text-history',
        group: 'history',
        sensitivity: 'user-content',
        synced: true,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Vision-text history metadata and source references.'
    },
    {
        id: 'video-history',
        medium: 'localStorage',
        key: 'gpt-image-playground-video-history',
        group: 'history',
        sensitivity: 'user-content',
        synced: true,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Video generation history metadata.'
    },
    {
        id: 'prompt-templates',
        medium: 'localStorage',
        key: 'gpt-image-playground-user-prompt-templates',
        group: 'assets',
        sensitivity: 'user-content',
        synced: true,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'User-authored prompt templates.'
    },
    {
        id: 'asset-categories',
        medium: 'localStorage',
        key: 'gpt-image-playground-asset-library-custom-categories',
        group: 'assets',
        sensitivity: 'user-content',
        synced: false,
        exported: true,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Custom asset library categories.'
    },
    {
        id: 'creative-workspaces',
        medium: 'localStorage',
        key: 'gpt-image-playground-creative-workspaces-v1',
        group: 'workspace',
        sensitivity: 'user-content',
        synced: true,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Creative workspace list and workspace tombstones.'
    },
    {
        id: 'form-preferences',
        medium: 'localStorage',
        key: 'gpt-image-playground-form-options',
        group: 'ui',
        sensitivity: 'public',
        synced: false,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Generation form option preferences.'
    },
    {
        id: 'workspace-layout',
        medium: 'localStorage',
        key: 'gpt-image-playground-workspace-layout-v1*',
        group: 'ui',
        sensitivity: 'public',
        synced: false,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Workbench panel layout and panel preference state.'
    },
    {
        id: 'prompt-draft',
        medium: 'localStorage',
        key: 'gpt_image_playground.prompt_draft.*.v1',
        group: 'ui',
        sensitivity: 'user-content',
        synced: false,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Recoverable prompt drafts for edit and batch flows.'
    },
    {
        id: 'batch-plan-draft',
        medium: 'localStorage',
        key: 'gpt_image_playground.batch_plan_draft.v1',
        group: 'ui',
        sensitivity: 'user-content',
        synced: false,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'Batch planning draft state.'
    },
    {
        id: 'image-blobs',
        medium: 'indexedDB',
        key: 'ImageHistoryDB.images',
        group: 'history',
        sensitivity: 'user-content',
        synced: true,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'IndexedDB image blobs and image blob metadata.'
    },
    {
        id: 'video-blobs',
        medium: 'indexedDB',
        key: 'ImageHistoryDB.videos',
        group: 'history',
        sensitivity: 'user-content',
        synced: true,
        exported: false,
        clearable: true,
        retention: 'until-user-clears',
        description: 'IndexedDB video blobs and video asset metadata.'
    },
    {
        id: 'generated-files',
        medium: 'filesystem',
        key: 'generated-images/',
        group: 'history',
        sensitivity: 'user-content',
        synced: false,
        exported: false,
        clearable: false,
        retention: 'external',
        description: 'Server-side generated image files outside browser storage.'
    }
] as const;

export function getStorageRegistryEntries(group?: StorageGroup): StorageRegistryEntry[] {
    return STORAGE_REGISTRY.filter((entry) => group === undefined || entry.group === group).map((entry) => ({ ...entry }));
}

export function getClearableLocalStorageKeys(groups: readonly StorageGroup[]): string[] {
    const wanted = new Set(groups);
    return STORAGE_REGISTRY.filter(
        (entry) => entry.medium === 'localStorage' && entry.clearable && wanted.has(entry.group)
    ).map((entry) => entry.key);
}

function matchesStoragePattern(pattern: string, key: string): boolean {
    if (!pattern.includes('*')) return pattern === key;
    const escaped = pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`^${escaped.join('.*')}$`).test(key);
}

export function createLocalStorageBackup(
    storage: Pick<Storage, 'getItem' | 'key' | 'length'>,
    groups: readonly StorageGroup[]
): LocalStorageBackup {
    const patterns = getClearableLocalStorageKeys(groups);
    const entries: Record<string, string> = {};
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !patterns.some((pattern) => matchesStoragePattern(pattern, key))) continue;
        const value = storage.getItem(key);
        if (value !== null) entries[key] = value;
    }
    return { createdAt: Date.now(), entries };
}

export function clearLocalStorageByRegistry(
    storage: Pick<Storage, 'key' | 'length' | 'removeItem'>,
    groups: readonly StorageGroup[]
): string[] {
    const patterns = getClearableLocalStorageKeys(groups);
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && patterns.some((pattern) => matchesStoragePattern(pattern, key))) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
    return keys;
}
