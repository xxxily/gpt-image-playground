import { createTaskServiceServer } from '../server.js';
import { sampleTaskRequest } from '../test-fixtures.js';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

let baseUrl = '';
let assetRootDir = '';
let server: ReturnType<typeof createTaskServiceServer>;

before(async () => {
    assetRootDir = await mkdtemp(join(tmpdir(), 'gpt-image-task-http-assets-'));
    server = createTaskServiceServer({ assetRootDir });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await rm(assetRootDir, { recursive: true, force: true });
});

test('health and capabilities expose phase one summaries', async () => {
    const health = await getJson(`${baseUrl}/v1/admin/health`);
    assert.equal(health.status, 'ok');
    const capabilities = await getJson(`${baseUrl}/v1/admin/capabilities`);
    assert.deepEqual(capabilities.taskTypes, ['image.generate', 'image.edit']);
    assert.equal(capabilities.storage?.primary, 'local-filesystem');
    assert.equal(capabilities.storage?.local?.provider, 'local-filesystem');
    assert.equal(capabilities.retryPolicy?.enabled, false);
});

test('HTTP task lifecycle reaches result manifest', async () => {
    const accepted = await postJson(`${baseUrl}/v1/tasks`, sampleTaskRequest({ idempotencyKey: 'http-1' }));
    assert.equal(typeof accepted.taskId, 'string');
    await waitForStatus(accepted.taskId as string, 'succeeded');

    const query = await postJson(`${baseUrl}/v1/tasks/query`, { taskIds: [accepted.taskId] });
    assert.equal(Array.isArray(query.tasks), true);
    assert.equal((query.tasks as Array<{ status: string }>)[0]?.status, 'succeeded');

    const result = await getJson(`${baseUrl}/v1/tasks/${accepted.taskId}/result`);
    assert.equal(result.status, 'succeeded');
    assert.equal(result.outputs?.[0]?.kind, 'image');
    assert.match(result.outputs?.[0]?.downloadUrl, /^\/v1\/assets\/asset_|^http/);

    const assetResponse = await fetch(toAbsoluteUrl(result.outputs?.[0]?.downloadUrl as string));
    assert.equal(assetResponse.ok, true);
    assert.match(assetResponse.headers.get('content-type') ?? '', /^text\/plain/);
    assert.match(await assetResponse.text(), new RegExp(accepted.taskId as string));

    const adminTasks = await getJson(`${baseUrl}/v1/admin/tasks?limit=1`);
    assert.equal(adminTasks.tasks?.[0]?.taskId, accepted.taskId);
    assert.equal(adminTasks.tasks?.[0]?.outputCount, 1);
    assert.equal(adminTasks.tasks?.[0]?.visibility, 'summary');
    const adminSerialized = JSON.stringify(adminTasks);
    assert.equal(adminSerialized.includes('sealed-test-key'), false);
    assert.equal(adminSerialized.includes('https://gateway.example.com'), false);
    assert.equal(adminSerialized.includes('Draw a compact phase one mock image.'), false);

    const fullDenied = await fetch(`${baseUrl}/v1/admin/tasks/${accepted.taskId}?visibility=full`);
    assert.equal(fullDenied.status, 403);
    const fullDiagnostic = await getJson(`${baseUrl}/v1/admin/tasks/${accepted.taskId}?visibility=full`, {
        'x-managed-task-admin-role': 'owner'
    });
    assert.equal(fullDiagnostic.task?.visibility, 'full');
    assert.equal(fullDiagnostic.task?.prompt, 'Draw a compact phase one mock image.');
    const fullSerialized = JSON.stringify(fullDiagnostic);
    assert.equal(fullSerialized.includes('sealed-test-key'), false);
    assert.equal(fullSerialized.includes('"keyEnvelope"'), false);

    const auditEvents = await getJson(`${baseUrl}/v1/admin/audit-events`);
    assert.equal(
        auditEvents.events?.some((event: { action?: string }) => event.action === 'admin_task_diagnostic_view'),
        true
    );
});

test('HTTP cancel endpoint cancels queued task', async () => {
    const accepted = await postJson(
        `${baseUrl}/v1/tasks`,
        sampleTaskRequest({
            idempotencyKey: 'http-cancel',
            parameters: { mock: { delayMs: 50, providerDelayMs: 50, downloadDelayMs: 1 } }
        })
    );
    const cancelled = await postJson(`${baseUrl}/v1/tasks/${accepted.taskId}/cancel`, { reason: 'http test cancel' });
    assert.equal(['cancelled', 'cancelling'].includes(cancelled.status as string), true);
});

test('HTTP retry endpoint creates a new attempt for retryable failures', async () => {
    const accepted = await postJson(
        `${baseUrl}/v1/tasks`,
        sampleTaskRequest({
            idempotencyKey: 'http-retry',
            parameters: {
                mock: {
                    failUntilAttempt: 1,
                    delayMs: 1,
                    providerDelayMs: 1,
                    downloadDelayMs: 1
                }
            }
        })
    );
    await waitForStatus(accepted.taskId as string, 'failed');
    const retry = await postJson(`${baseUrl}/v1/tasks/${accepted.taskId}/retry`, {});
    assert.equal(retry.taskId, accepted.taskId);
    await waitForStatus(accepted.taskId as string, 'succeeded');
    const status = await getJson(`${baseUrl}/v1/tasks/${accepted.taskId}`);
    assert.equal(status.attempt, 2);
});

test('HTTP batch query caps requests at 100 task ids', async () => {
    const taskIds = Array.from({ length: 101 }, (_, index) => `missing-${index}`);
    const query = await postJson(`${baseUrl}/v1/tasks/query`, { taskIds });
    assert.equal(query.tasks?.length, 0);
    assert.equal(query.missingTaskIds?.length, 100);
});

test('HTTP retry policy endpoint normalizes fee-risk settings', async () => {
    const updated = await postJson(`${baseUrl}/v1/admin/retry-policy`, {
        enabled: true,
        maxAttempts: 99,
        backoffMs: 10
    });
    assert.equal(updated.enabled, true);
    assert.equal(updated.maxAttempts, 5);
    assert.equal(updated.backoffMs, 1_000);
    assert.match(updated.feeWarning as string, /provider/i);

    const fetched = await getJson(`${baseUrl}/v1/admin/retry-policy`);
    assert.equal(fetched.enabled, true);
});

async function getJson(url: string, headers?: Record<string, string>): Promise<Record<string, any>> {
    const response = await fetch(url, headers ? { headers } : undefined);
    if (!response.ok) {
        assert.fail(`${url} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as Record<string, any>;
}

async function postJson(url: string, body: unknown): Promise<Record<string, any>> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        assert.fail(`${url} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as Record<string, any>;
}

async function waitForStatus(taskId: string, expectedStatus: string): Promise<void> {
    for (let index = 0; index < 100; index += 1) {
        const task = await getJson(`${baseUrl}/v1/tasks/${taskId}`);
        if (task.status === expectedStatus) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error(`HTTP task ${taskId} did not reach ${expectedStatus}.`);
}

function toAbsoluteUrl(url: string): string {
    return url.startsWith('http') ? url : `${baseUrl}${url}`;
}
