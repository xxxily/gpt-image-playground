import { queryManagedTaskStatusBatched } from '@/lib/managed-task-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('managed task API client', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    tasks: [],
                    missingTaskIds: [],
                    requestedAt: '2026-06-11T00:00:00.000Z'
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('coalesces same-tick status lookups by task service', async () => {
        const first = queryManagedTaskStatusBatched('svc_1', 'mgt_1');
        const second = queryManagedTaskStatusBatched('svc_1', 'mgt_2');

        await vi.advanceTimersByTimeAsync(30);
        await Promise.all([first, second]);

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            '/api/managed-tasks/query',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    tasks: [
                        { taskServiceId: 'svc_1', managedTaskId: 'mgt_1' },
                        { taskServiceId: 'svc_1', managedTaskId: 'mgt_2' }
                    ]
                })
            })
        );
    });

    it('keeps status lookups with different password hashes in separate requests', async () => {
        const first = queryManagedTaskStatusBatched('svc_1', 'mgt_1', undefined, 'hash-a');
        const second = queryManagedTaskStatusBatched('svc_1', 'mgt_2', undefined, 'hash-b');

        await vi.advanceTimersByTimeAsync(30);
        await Promise.all([first, second]);

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        const bodies = vi
            .mocked(globalThis.fetch)
            .mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as { passwordHash?: string });
        expect(bodies).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ passwordHash: 'hash-a' }),
                expect.objectContaining({ passwordHash: 'hash-b' })
            ])
        );
    });
});
