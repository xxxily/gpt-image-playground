import { createTaskServiceServer } from '../server.js';
import { sampleTaskRequest } from '../test-fixtures.js';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

let baseUrl = '';
const server = createTaskServiceServer();

before(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('health and capabilities expose phase one summaries', async () => {
    const health = await getJson(`${baseUrl}/v1/admin/health`);
    assert.equal(health.status, 'ok');
    const capabilities = await getJson(`${baseUrl}/v1/admin/capabilities`);
    assert.deepEqual(capabilities.taskTypes, ['image.generate', 'image.edit']);
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

async function getJson(url: string): Promise<Record<string, any>> {
    const response = await fetch(url);
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
