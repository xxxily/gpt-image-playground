import { ManagedTaskRuntime } from '../runtime.js';
import { sampleTaskRequest } from '../test-fixtures.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('mock image.generate reaches succeeded and exposes a result manifest', async () => {
    const runtime = new ManagedTaskRuntime();
    const accepted = runtime.createTask(sampleTaskRequest());
    const status = await waitForTask(runtime, accepted.taskId, 'succeeded');
    assert.equal(status.status, 'succeeded');
    const result = runtime.getResult(accepted.taskId);
    assert.equal(result.status, 'succeeded');
    assert.equal(result.outputs[0]?.kind, 'image');
});

test('idempotency returns the same task for an equivalent request', () => {
    const runtime = new ManagedTaskRuntime();
    const request = sampleTaskRequest();
    const first = runtime.createTask(request);
    const second = runtime.createTask(request);
    assert.equal(second.taskId, first.taskId);
});

test('idempotency conflict rejects a changed request', () => {
    const runtime = new ManagedTaskRuntime();
    runtime.createTask(sampleTaskRequest());
    assert.throws(() => runtime.createTask(sampleTaskRequest({ prompt: 'Changed prompt' })), {
        code: 'idempotency_conflict'
    });
});

test('image.edit requires an image input asset', () => {
    const runtime = new ManagedTaskRuntime();
    assert.throws(() => runtime.createTask(sampleTaskRequest({ taskType: 'image.edit', inputAssets: [] })), {
        code: 'invalid_request'
    });
});

test('failed mock task can be retried manually', async () => {
    const runtime = new ManagedTaskRuntime({ maxAttempts: 3 });
    const accepted = runtime.createTask(
        sampleTaskRequest({
            parameters: { mock: { failUntilAttempt: 1, delayMs: 1, providerDelayMs: 1, downloadDelayMs: 1 } }
        })
    );
    const failed = await waitForTask(runtime, accepted.taskId, 'failed');
    assert.equal(failed.retryable, true);

    runtime.retryTask(accepted.taskId);
    const succeeded = await waitForTask(runtime, accepted.taskId, 'succeeded');
    assert.equal(succeeded.attempt, 2);
});

test('cancel before execution transitions to cancelled', async () => {
    const runtime = new ManagedTaskRuntime({
        endpointConcurrency: { fp_gateway_example: 0 },
        defaultEndpointConcurrency: 0
    });
    const accepted = runtime.createTask(sampleTaskRequest());
    const cancelled = runtime.cancelTask(accepted.taskId, 'test cancel');
    assert.equal(cancelled.status, 'cancelled');
});

test('endpoint limiter queues second task for the same fingerprint', async () => {
    const runtime = new ManagedTaskRuntime({ defaultEndpointConcurrency: 1 });
    const slow = runtime.createTask(
        sampleTaskRequest({
            idempotencyKey: 'slow',
            clientContext: { appInstanceId: 'app-test', clientTaskId: 'slow', source: 'web' },
            parameters: { mock: { delayMs: 35, providerDelayMs: 35, downloadDelayMs: 1 } }
        })
    );
    const queued = runtime.createTask(
        sampleTaskRequest({
            idempotencyKey: 'queued',
            clientContext: { appInstanceId: 'app-test', clientTaskId: 'queued', source: 'web' },
            parameters: { mock: { delayMs: 1, providerDelayMs: 1, downloadDelayMs: 1 } }
        })
    );

    const queuedStatus = runtime.getTask(queued.taskId);
    assert.equal(queuedStatus?.status, 'queued');
    assert.equal(runtime.queues()[0]?.queued, 1);
    await waitForTask(runtime, slow.taskId, 'succeeded');
    await waitForTask(runtime, queued.taskId, 'succeeded');
});

test('simulated worker crash preserves task record and reschedules retry', async () => {
    const runtime = new ManagedTaskRuntime({ maxAttempts: 3 });
    const accepted = runtime.createTask(
        sampleTaskRequest({
            parameters: { mock: { delayMs: 30, providerDelayMs: 1, downloadDelayMs: 1 } }
        })
    );
    await waitForTask(runtime, accepted.taskId, 'running');
    const crash = runtime.simulateWorkerCrash();
    assert.deepEqual(crash.affectedTaskIds, [accepted.taskId]);
    const retryScheduled = runtime.getTask(accepted.taskId);
    assert.equal(retryScheduled?.status, 'retry_scheduled');
    await waitForTask(runtime, accepted.taskId, 'succeeded');
});

async function waitForTask(runtime: ManagedTaskRuntime, taskId: string, expectedStatus: string) {
    for (let index = 0; index < 100; index += 1) {
        const task = runtime.getTask(taskId);
        if (task?.status === expectedStatus) {
            return task;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`Task ${taskId} did not reach ${expectedStatus}. Last status: ${runtime.getTask(taskId)?.status}`);
}
