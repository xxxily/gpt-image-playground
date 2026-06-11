import type {
    ManagedGenerationTaskType,
    ManagedTaskBatchMetadata,
    ManagedTaskClientRecord,
    ManagedTaskHistoryParams,
    ManagedTaskRecordImportState,
    ManagedTaskStatus
} from '@/lib/managed-task-types';

export const MANAGED_TASK_CLIENT_RECORDS_STORAGE_KEY = 'gpt-image-playground-managed-task-records-v1';

const MAX_MANAGED_TASK_CLIENT_RECORDS = 200;
const MAX_PROMPT_PREVIEW_LENGTH = 120;
const TERMINAL_STATUSES = new Set<ManagedTaskStatus>(['succeeded', 'failed', 'cancelled', 'expired', 'retained']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function optionalString(value: unknown): string | undefined {
    const normalized = trimString(value);
    return normalized || undefined;
}

function optionalPositiveNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return Math.floor(parsed);
}

function normalizeTaskType(value: unknown): ManagedGenerationTaskType | null {
    return value === 'image.generate' || value === 'image.edit' ? value : null;
}

function normalizeStatus(value: unknown): ManagedTaskStatus {
    switch (value) {
        case 'submitted':
        case 'accepted':
        case 'queued':
        case 'running':
        case 'provider_processing':
        case 'downloading_result':
        case 'succeeded':
        case 'failed':
        case 'retry_scheduled':
        case 'cancelling':
        case 'cancelled':
        case 'retained':
        case 'expired':
            return value;
        default:
            return 'submitted';
    }
}

function normalizeImportState(value: unknown): ManagedTaskRecordImportState {
    return value === 'importing' || value === 'imported' || value === 'failed' ? value : 'pending';
}

function normalizeHistoryParams(
    value: unknown,
    rawModelId: string,
    taskType: ManagedGenerationTaskType
): ManagedTaskHistoryParams {
    const source = isRecord(value) ? value : {};
    const mode = source.mode === 'edit' || taskType === 'image.edit' ? 'edit' : 'generate';
    const quality =
        source.quality === 'low' ||
        source.quality === 'medium' ||
        source.quality === 'high' ||
        source.quality === 'auto'
            ? source.quality
            : undefined;
    const outputFormat =
        source.outputFormat === 'jpeg' || source.outputFormat === 'webp' || source.outputFormat === 'png'
            ? source.outputFormat
            : undefined;
    const background =
        source.background === 'transparent' || source.background === 'opaque' || source.background === 'auto'
            ? source.background
            : undefined;
    const moderation = source.moderation === 'low' || source.moderation === 'auto' ? source.moderation : undefined;
    const imageStorageMode =
        source.imageStorageMode === 'fs' || source.imageStorageMode === 'indexeddb' || source.imageStorageMode === 'url'
            ? source.imageStorageMode
            : source.imageStorageMode === 'auto'
              ? 'auto'
              : undefined;

    return {
        mode,
        model: optionalString(source.model) || rawModelId,
        n: optionalPositiveNumber(source.n) ?? 1,
        ...(optionalString(source.size) ? { size: optionalString(source.size) } : {}),
        ...(quality ? { quality } : {}),
        ...(outputFormat ? { outputFormat } : {}),
        ...(typeof source.outputCompression === 'number' && Number.isFinite(source.outputCompression)
            ? { outputCompression: Math.max(0, Math.min(100, Math.floor(source.outputCompression))) }
            : {}),
        ...(background ? { background } : {}),
        ...(moderation ? { moderation } : {}),
        ...(imageStorageMode ? { imageStorageMode } : {})
    };
}

function normalizeBatch(value: unknown): ManagedTaskBatchMetadata | undefined {
    if (!isRecord(value)) return undefined;
    const batch: ManagedTaskBatchMetadata = {};
    const stringKeys = [
        'batchId',
        'batchLabel',
        'batchInputImageId',
        'batchInputImageFilename',
        'batchInputImageRelativePath'
    ] as const;
    stringKeys.forEach((key) => {
        const normalized = optionalString(value[key]);
        if (normalized) batch[key] = normalized;
    });
    const numberKeys = [
        'batchIndex',
        'batchTotal',
        'batchInputImageOrder',
        'batchVariantIndex',
        'batchVariantTotal'
    ] as const;
    numberKeys.forEach((key) => {
        const normalized = optionalPositiveNumber(value[key]);
        if (normalized !== undefined) batch[key] = normalized;
    });
    return Object.keys(batch).length > 0 ? batch : undefined;
}

export function hashManagedTaskText(value: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

export function createManagedTaskPromptPreview(prompt: string): string {
    const normalized = prompt.trim().replace(/\s+/gu, ' ');
    if (normalized.length <= MAX_PROMPT_PREVIEW_LENGTH) return normalized;
    return `${normalized.slice(0, MAX_PROMPT_PREVIEW_LENGTH - 1)}...`;
}

export function normalizeManagedTaskClientRecord(value: unknown): ManagedTaskClientRecord | null {
    if (!isRecord(value)) return null;
    const managedTaskId = trimString(value.managedTaskId);
    const clientTaskId = trimString(value.clientTaskId);
    const taskServiceId = trimString(value.taskServiceId);
    const providerEndpointId = trimString(value.providerEndpointId);
    const rawModelId = trimString(value.rawModelId);
    const taskType = normalizeTaskType(value.taskType);
    if (!managedTaskId || !clientTaskId || !taskServiceId || !providerEndpointId || !rawModelId || !taskType) {
        return null;
    }

    const createdAt = optionalPositiveNumber(value.createdAt) ?? Date.now();
    const status = normalizeStatus(value.status);
    const importState = normalizeImportState(value.importState);
    return {
        managedTaskId,
        clientTaskId,
        taskServiceId,
        ...(optionalString(value.taskServiceName) ? { taskServiceName: optionalString(value.taskServiceName) } : {}),
        providerEndpointId,
        ...(optionalString(value.modelCatalogEntryId)
            ? { modelCatalogEntryId: optionalString(value.modelCatalogEntryId) }
            : {}),
        rawModelId,
        ...(optionalString(value.workspaceId) ? { workspaceId: optionalString(value.workspaceId) } : {}),
        ...(optionalString(value.workspaceNameSnapshot)
            ? { workspaceNameSnapshot: optionalString(value.workspaceNameSnapshot) }
            : {}),
        taskType,
        promptDigest: optionalString(value.promptDigest) || hashManagedTaskText(`${managedTaskId}:${rawModelId}`),
        promptPreview: optionalString(value.promptPreview) || '',
        parameterDigest: optionalString(value.parameterDigest) || hashManagedTaskText(managedTaskId),
        historyParams: normalizeHistoryParams(value.historyParams, rawModelId, taskType),
        ...(normalizeBatch(value.batch) ? { batch: normalizeBatch(value.batch) } : {}),
        createdAt,
        updatedAt: optionalPositiveNumber(value.updatedAt) ?? createdAt,
        ...(optionalPositiveNumber(value.lastSyncedAt)
            ? { lastSyncedAt: optionalPositiveNumber(value.lastSyncedAt) }
            : {}),
        status,
        importState,
        ...(optionalPositiveNumber(value.resultImportedAt)
            ? { resultImportedAt: optionalPositiveNumber(value.resultImportedAt) }
            : {}),
        ...(optionalString(value.resultImportError)
            ? { resultImportError: optionalString(value.resultImportError) }
            : {}),
        ...(optionalPositiveNumber(value.completedAt) ? { completedAt: optionalPositiveNumber(value.completedAt) } : {})
    };
}

function canUseLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function sortAndBound(records: ManagedTaskClientRecord[]): ManagedTaskClientRecord[] {
    return [...records]
        .sort((first, second) => second.createdAt - first.createdAt)
        .slice(0, MAX_MANAGED_TASK_CLIENT_RECORDS);
}

export function loadManagedTaskClientRecords(): ManagedTaskClientRecord[] {
    if (!canUseLocalStorage()) return [];
    try {
        const stored = window.localStorage.getItem(MANAGED_TASK_CLIENT_RECORDS_STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) return [];
        return sortAndBound(
            parsed
                .map(normalizeManagedTaskClientRecord)
                .filter((item): item is ManagedTaskClientRecord => Boolean(item))
        );
    } catch (error) {
        console.warn('Failed to load managed task records from localStorage:', error);
        return [];
    }
}

export function saveManagedTaskClientRecords(records: ManagedTaskClientRecord[]): boolean {
    if (!canUseLocalStorage()) return false;
    try {
        window.localStorage.setItem(MANAGED_TASK_CLIENT_RECORDS_STORAGE_KEY, JSON.stringify(sortAndBound(records)));
        return true;
    } catch (error) {
        console.warn('Failed to save managed task records to localStorage:', error);
        return false;
    }
}

export function upsertManagedTaskClientRecord(record: ManagedTaskClientRecord): boolean {
    const records = loadManagedTaskClientRecords();
    const index = records.findIndex((item) => item.managedTaskId === record.managedTaskId);
    if (index >= 0) {
        records[index] = { ...records[index], ...record, updatedAt: Date.now() };
    } else {
        records.unshift({ ...record, updatedAt: record.updatedAt || Date.now() });
    }
    return saveManagedTaskClientRecords(records);
}

export function updateManagedTaskClientRecord(
    managedTaskId: string,
    update: Partial<ManagedTaskClientRecord>
): ManagedTaskClientRecord | null {
    const records = loadManagedTaskClientRecords();
    const index = records.findIndex((item) => item.managedTaskId === managedTaskId);
    if (index < 0) return null;
    const next = { ...records[index], ...update, managedTaskId, updatedAt: Date.now() };
    records[index] = next;
    saveManagedTaskClientRecords(records);
    return next;
}

export function getPendingManagedTaskClientRecords(): ManagedTaskClientRecord[] {
    return loadManagedTaskClientRecords().filter((record) => {
        if (record.importState === 'imported') return false;
        if (!TERMINAL_STATUSES.has(record.status)) return true;
        return record.status === 'succeeded';
    });
}

export function removeManagedTaskClientRecord(managedTaskId: string): boolean {
    const records = loadManagedTaskClientRecords();
    return saveManagedTaskClientRecords(records.filter((record) => record.managedTaskId !== managedTaskId));
}
