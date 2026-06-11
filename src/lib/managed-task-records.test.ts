import {
    MANAGED_TASK_CLIENT_RECORDS_STORAGE_KEY,
    getPendingManagedTaskClientRecords,
    loadManagedTaskClientRecords,
    saveManagedTaskClientRecords,
    updateManagedTaskClientRecord,
    upsertManagedTaskClientRecord
} from '@/lib/managed-task-records';
import type { ManagedTaskClientRecord } from '@/lib/managed-task-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installLocalStorage() {
    const values = new Map<string, string>();
    const localStorage = {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            values.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
            values.delete(key);
        }),
        clear: vi.fn(() => values.clear())
    };
    vi.stubGlobal('window', { localStorage });
    return { values, localStorage };
}

function record(overrides: Partial<ManagedTaskClientRecord> = {}): ManagedTaskClientRecord {
    return {
        managedTaskId: 'mgt_1',
        clientTaskId: 'task_1',
        taskServiceId: 'svc_1',
        taskServiceName: 'Primary task service',
        providerEndpointId: 'openai:default',
        modelCatalogEntryId: 'openai:default::gpt-image-2',
        rawModelId: 'gpt-image-2',
        taskType: 'image.generate',
        promptDigest: 'abc',
        promptPreview: 'draw an icon',
        parameterDigest: 'def',
        historyParams: {
            mode: 'generate',
            model: 'gpt-image-2',
            n: 1,
            outputFormat: 'png',
            imageStorageMode: 'indexeddb'
        },
        createdAt: 100,
        updatedAt: 100,
        status: 'queued',
        importState: 'pending',
        ...overrides
    };
}

describe('managed task client records', () => {
    beforeEach(() => {
        installLocalStorage();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('normalizes stored records and drops invalid entries', () => {
        window.localStorage.setItem(
            MANAGED_TASK_CLIENT_RECORDS_STORAGE_KEY,
            JSON.stringify([
                { nope: true },
                {
                    managedTaskId: 'mgt_valid',
                    clientTaskId: 'task_valid',
                    taskServiceId: 'svc_valid',
                    providerEndpointId: 'endpoint_valid',
                    rawModelId: 'gpt-image-2',
                    taskType: 'image.generate',
                    status: 'unknown',
                    importState: 'unknown',
                    historyParams: { n: 2, outputFormat: 'webp' },
                    createdAt: 200
                }
            ])
        );

        expect(loadManagedTaskClientRecords()).toEqual([
            expect.objectContaining({
                managedTaskId: 'mgt_valid',
                status: 'submitted',
                importState: 'pending',
                historyParams: expect.objectContaining({
                    mode: 'generate',
                    model: 'gpt-image-2',
                    n: 2,
                    outputFormat: 'webp'
                })
            })
        ]);
    });

    it('upserts, updates, and filters pending records without raw credential fields', () => {
        expect(saveManagedTaskClientRecords([record()])).toBe(true);
        expect(upsertManagedTaskClientRecord(record({ status: 'succeeded' }))).toBe(true);
        const updated = updateManagedTaskClientRecord('mgt_1', { importState: 'imported', resultImportedAt: 300 });

        expect(updated).toMatchObject({ managedTaskId: 'mgt_1', importState: 'imported' });
        expect(getPendingManagedTaskClientRecords()).toEqual([]);
        expect(window.localStorage.getItem(MANAGED_TASK_CLIENT_RECORDS_STORAGE_KEY)).not.toContain('sk-');
    });
});
