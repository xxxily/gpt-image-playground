import { ManagedTaskRuntime } from './runtime.js';
import { sampleTaskRequest } from './test-fixtures.js';
import { ManagedGenerationTaskRequest, ManagedTaskStatus } from './types.js';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type DrillResult = {
    name: string;
    evidence: Record<string, unknown>;
};

const results: DrillResult[] = [];

await runWithAssetRoot(async (assetRootDir) => {
    results.push(await drillQueuePressure(assetRootDir));
});
await runWithAssetRoot(async (assetRootDir) => {
    results.push(await drillWorkerCrashRecovery(assetRootDir));
});
await runWithAssetRoot(async (assetRootDir) => {
    results.push(await drillProviderFailureRetry(assetRootDir));
});

console.log(
    JSON.stringify(
        {
            status: 'passed',
            checkedAt: new Date().toISOString(),
            drills: results
        },
        null,
        2
    )
);

async function runWithAssetRoot(work: (assetRootDir: string) => Promise<void>): Promise<void> {
    const assetRootDir = await mkdtemp(join(tmpdir(), 'gpt-image-task-phase6-'));
    try {
        await work(assetRootDir);
    } finally {
        await rm(assetRootDir, { recursive: true, force: true });
    }
}

async function drillQueuePressure(assetRootDir: string): Promise<DrillResult> {
    const runtime = new ManagedTaskRuntime({
        assetRootDir,
        defaultEndpointConcurrency: 2
    });
    const taskIds: string[] = [];
    for (let index = 0; index < 100; index += 1) {
        const accepted = runtime.createTask(
            taskRequest(`queue-${index}`, {
                mock: {
                    delayMs: 25,
                    providerDelayMs: 25,
                    downloadDelayMs: 1
                }
            })
        );
        taskIds.push(accepted.taskId);
    }

    const initialQueue = runtime.queues()[0];
    assert.equal(taskIds.length, 100);
    assert.ok((initialQueue?.queued ?? 0) > 0, 'queue pressure should leave tasks queued behind endpoint limit');

    await Promise.all(taskIds.map((taskId) => waitForStatus(runtime, taskId, 'succeeded')));
    const query = runtime.queryTasks(taskIds);
    assert.equal(query.tasks.length, 100);
    assert.equal(
        query.tasks.every((task) => task.status === 'succeeded'),
        true
    );
    assert.equal(runtime.listTaskSummaries(100).tasks.length, 100);

    return {
        name: 'queue-pressure-100-image-tasks',
        evidence: {
            submitted: taskIds.length,
            initialActive: initialQueue?.active ?? 0,
            initialQueued: initialQueue?.queued ?? 0,
            endpointLimit: initialQueue?.limit ?? null,
            finalStatuses: countStatuses(query.tasks.map((task) => task.status))
        }
    };
}

async function drillWorkerCrashRecovery(assetRootDir: string): Promise<DrillResult> {
    const runtime = new ManagedTaskRuntime({
        assetRootDir,
        maxAttempts: 3
    });
    const accepted = runtime.createTask(
        taskRequest('worker-crash', {
            mock: {
                delayMs: 40,
                providerDelayMs: 5,
                downloadDelayMs: 1
            }
        })
    );
    await waitForStatus(runtime, accepted.taskId, 'running');
    const crash = runtime.simulateWorkerCrash();
    assert.deepEqual(crash.affectedTaskIds, [accepted.taskId]);
    const retryScheduled = runtime.getTask(accepted.taskId);
    assert.equal(retryScheduled?.status, 'retry_scheduled');

    const succeeded = await waitForStatus(runtime, accepted.taskId, 'succeeded');
    assert.equal(succeeded.attempt, 2);

    return {
        name: 'worker-crash-recovery',
        evidence: {
            affectedTaskIds: crash.affectedTaskIds,
            finalStatus: succeeded.status,
            finalAttempt: succeeded.attempt
        }
    };
}

async function drillProviderFailureRetry(assetRootDir: string): Promise<DrillResult> {
    const runtime = new ManagedTaskRuntime({
        assetRootDir,
        maxAttempts: 3,
        retryPolicy: {
            enabled: true,
            maxAttempts: 3,
            backoffMs: 1_000
        }
    });
    const rateLimited = runtime.createTask(
        taskRequest('provider-429', {
            mock: {
                delayMs: 1,
                providerDelayMs: 1,
                downloadDelayMs: 1,
                failUntilAttempt: 1,
                failCode: 'provider_rate_limited'
            }
        })
    );
    const providerFailed = runtime.createTask(
        taskRequest('provider-5xx', {
            mock: {
                delayMs: 1,
                providerDelayMs: 1,
                downloadDelayMs: 1,
                failUntilAttempt: 1,
                failCode: 'provider_failed',
                failMessage: 'Mock provider 5xx failure.'
            }
        })
    );

    const rateLimitScheduled = await waitForStatus(runtime, rateLimited.taskId, 'retry_scheduled');
    const failureScheduled = await waitForStatus(runtime, providerFailed.taskId, 'retry_scheduled');
    assert.equal(rateLimitScheduled.error?.code, 'provider_rate_limited');
    assert.equal(failureScheduled.error?.code, 'provider_failed');
    assert.match(rateLimitScheduled.progress?.nextRetryAt ?? '', /^\d{4}-\d{2}-\d{2}T/u);

    const finalRateLimited = await waitForStatus(runtime, rateLimited.taskId, 'succeeded');
    const finalProviderFailed = await waitForStatus(runtime, providerFailed.taskId, 'succeeded');
    assert.equal(finalRateLimited.attempt, 2);
    assert.equal(finalProviderFailed.attempt, 2);

    const retryAudits = runtime.listAuditEvents(20).events.filter((event) => event.action === 'task_retry_scheduled');
    assert.equal(retryAudits.length >= 2, true);

    return {
        name: 'provider-429-5xx-automatic-retry',
        evidence: {
            retryPolicy: runtime.getRetryPolicy(),
            finalStatuses: countStatuses([finalRateLimited.status, finalProviderFailed.status]),
            finalAttempts: [finalRateLimited.attempt, finalProviderFailed.attempt],
            retryAuditEvents: retryAudits.length
        }
    };
}

function taskRequest(id: string, parameters: ManagedGenerationTaskRequest['parameters']): ManagedGenerationTaskRequest {
    return sampleTaskRequest({
        idempotencyKey: `phase6-${id}`,
        parameters,
        clientContext: {
            appInstanceId: 'phase6-drill',
            clientTaskId: id,
            source: 'web',
            locale: 'zh-CN'
        }
    });
}

async function waitForStatus(
    runtime: ManagedTaskRuntime,
    taskId: string,
    expectedStatus: ManagedTaskStatus
): Promise<NonNullable<ReturnType<ManagedTaskRuntime['getTask']>>> {
    for (let index = 0; index < 800; index += 1) {
        const task = runtime.getTask(taskId);
        if (task?.status === expectedStatus) return task;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Task ${taskId} did not reach ${expectedStatus}. Last status: ${runtime.getTask(taskId)?.status}`);
}

function countStatuses(statuses: ManagedTaskStatus[]): Record<string, number> {
    return statuses.reduce<Record<string, number>>((counts, status) => {
        counts[status] = (counts[status] ?? 0) + 1;
        return counts;
    }, {});
}
