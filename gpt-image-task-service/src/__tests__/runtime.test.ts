import { ManagedTaskRuntime } from '../runtime.js';
import { sampleTaskRequest } from '../test-fixtures.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('mock image.generate reaches succeeded and exposes a result manifest', async () => {
    const assetRootDir = await mkdtemp(join(tmpdir(), 'gpt-image-task-assets-'));
    const runtime = new ManagedTaskRuntime({ assetRootDir, baseUrl: 'http://task-service.test' });
    const accepted = runtime.createTask(sampleTaskRequest());
    const status = await waitForTask(runtime, accepted.taskId, 'succeeded');
    assert.equal(status.status, 'succeeded');
    const result = runtime.getResult(accepted.taskId);
    assert.equal(result.status, 'succeeded');
    assert.equal(result.outputs[0]?.kind, 'image');
    assert.match(result.outputs[0]?.downloadUrl ?? '', /^http:\/\/task-service\.test\/v1\/assets\/asset_/);
    assert.equal(result.outputs[0]?.inlineText, undefined);
    assert.match(result.outputs[0]?.sha256 ?? '', /^[a-f0-9]{64}$/);

    const downloadUrl = new URL(result.outputs[0]?.downloadUrl ?? '');
    const assetId = downloadUrl.pathname.split('/')[3];
    const download = await runtime.getAssetDownload(assetId, downloadUrl.searchParams.get('token'));
    const content = await readFile(download.filePath, 'utf8');
    assert.equal(download.size, Buffer.byteLength(content));
    assert.match(content, new RegExp(accepted.taskId));
    await rm(assetRootDir, { recursive: true, force: true });
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

test('expired execution credentials are rejected before enqueue', () => {
    const runtime = new ManagedTaskRuntime();
    assert.throws(
        () =>
            runtime.createTask(
                sampleTaskRequest({
                    executionCredential: {
                        mode: 'user-delegated',
                        keyEnvelope: 'sealed-test-key',
                        expiresAt: new Date(Date.now() - 1_000).toISOString(),
                        fingerprint: 'key_fp_test',
                        algorithm: 'sealed-box-v1'
                    }
                })
            ),
        { code: 'credential_expired' }
    );
});

test('provider base URLs reject localhost and private targets', () => {
    const runtime = new ManagedTaskRuntime();
    assert.throws(
        () =>
            runtime.createTask(
                sampleTaskRequest({
                    providerEndpointRef: {
                        id: 'local-provider',
                        provider: 'openai-compatible',
                        protocol: 'openai-images',
                        baseUrl: 'http://127.0.0.1:11434/v1',
                        baseUrlFingerprint: 'fp_local'
                    }
                })
            ),
        { code: 'endpoint_blocked' }
    );
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

test('batch query is capped to 100 tasks', () => {
    const runtime = new ManagedTaskRuntime({
        endpointConcurrency: { fp_gateway_example: 0 },
        defaultEndpointConcurrency: 0
    });
    const taskIds: string[] = [];
    for (let index = 0; index < 101; index += 1) {
        const accepted = runtime.createTask(
            sampleTaskRequest({
                idempotencyKey: `batch-${index}`,
                clientContext: {
                    appInstanceId: 'app-test',
                    clientTaskId: `batch-${index}`,
                    source: 'web'
                }
            })
        );
        taskIds.push(accepted.taskId);
    }
    const query = runtime.queryTasks(taskIds);
    assert.equal(query.tasks.length, 100);
    assert.equal(query.missingTaskIds.length, 0);
});

test('admin task summaries omit credential, prompt, and provider URL', async () => {
    const runtime = new ManagedTaskRuntime();
    const accepted = runtime.createTask(sampleTaskRequest());
    await waitForTask(runtime, accepted.taskId, 'succeeded');
    const summary = runtime.listTaskSummaries();
    assert.equal(summary.tasks[0]?.taskId, accepted.taskId);
    assert.equal(summary.tasks[0]?.outputCount, 1);
    const serialized = JSON.stringify(summary);
    assert.equal(serialized.includes('sealed-test-key'), false);
    assert.equal(serialized.includes('Draw a compact phase one mock image.'), false);
    assert.equal(serialized.includes('https://gateway.example.com'), false);
    assert.equal(summary.tasks[0]?.visibility, 'summary');
    assert.equal(summary.tasks[0]?.credentialFingerprint, 'key_fp_test');
    assert.match(summary.tasks[0]?.promptSummary.sha256 ?? '', /^[a-f0-9]{64}$/);
});

test('full admin diagnostics expose troubleshooting context without key envelope or download URLs and write audit', async () => {
    const runtime = new ManagedTaskRuntime();
    const accepted = runtime.createTask(sampleTaskRequest());
    await waitForTask(runtime, accepted.taskId, 'succeeded');

    const diagnostic = runtime.getTaskDiagnostic(accepted.taskId, 'full');
    assert.equal(diagnostic.visibility, 'full');
    assert.equal('prompt' in diagnostic, true);
    assert.equal((diagnostic as { prompt: string }).prompt, 'Draw a compact phase one mock image.');
    const serialized = JSON.stringify(diagnostic);
    assert.equal(serialized.includes('sealed-test-key'), false);
    assert.equal(serialized.includes('"keyEnvelope"'), false);
    assert.equal(serialized.includes('/download?token='), false);

    const audits = runtime.listAuditEvents();
    assert.equal(
        audits.events.some((event) => event.action === 'admin_task_diagnostic_view'),
        true
    );
});

test('retry policy normalizes conservative bounds and fee warning', () => {
    const runtime = new ManagedTaskRuntime({ maxAttempts: 3 });
    const policy = runtime.updateRetryPolicy({ enabled: true, maxAttempts: 99, backoffMs: 10 });
    assert.equal(policy.enabled, true);
    assert.equal(policy.maxAttempts, 5);
    assert.equal(policy.backoffMs, 1_000);
    assert.match(policy.feeWarning, /provider/i);

    const accepted = runtime.createTask(sampleTaskRequest({ idempotencyKey: 'retry-policy-new-task' }));
    assert.equal(runtime.getTask(accepted.taskId)?.maxAttempts, 5);
    const audits = runtime.listAuditEvents();
    assert.equal(
        audits.events.some((event) => event.action === 'retry_policy_update'),
        true
    );
    assert.equal(JSON.stringify(audits).includes('sealed-test-key'), false);
});

test('automatic retry honors retry policy and reports provider rate limits safely', async () => {
    const runtime = new ManagedTaskRuntime({
        maxAttempts: 3,
        retryPolicy: { enabled: true, maxAttempts: 3, backoffMs: 1_000 }
    });
    const accepted = runtime.createTask(
        sampleTaskRequest({
            idempotencyKey: 'auto-provider-rate-limit',
            parameters: {
                mock: {
                    delayMs: 1,
                    providerDelayMs: 1,
                    downloadDelayMs: 1,
                    failUntilAttempt: 1,
                    failCode: 'provider_rate_limited'
                }
            }
        })
    );

    const scheduled = await waitForTask(runtime, accepted.taskId, 'retry_scheduled');
    assert.equal(scheduled.error?.code, 'provider_rate_limited');
    assert.equal(scheduled.retryable, false);
    assert.match(scheduled.progress?.nextRetryAt ?? '', /^\d{4}-\d{2}-\d{2}T/u);

    const succeeded = await waitForTask(runtime, accepted.taskId, 'succeeded');
    assert.equal(succeeded.attempt, 2);
    assert.equal(succeeded.error, undefined);

    const audits = runtime.listAuditEvents();
    assert.equal(
        audits.events.some((event) => event.action === 'task_retry_scheduled'),
        true
    );
    assert.equal(JSON.stringify(audits).includes('sealed-test-key'), false);
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
    for (let index = 0; index < 400; index += 1) {
        const task = runtime.getTask(taskId);
        if (task?.status === expectedStatus) {
            return task;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`Task ${taskId} did not reach ${expectedStatus}. Last status: ${runtime.getTask(taskId)?.status}`);
}
