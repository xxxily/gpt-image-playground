import { createTaskServiceServer } from './server.js';
import { sampleTaskRequest } from './test-fixtures.js';

const port = await listenOnRandomPort();
const baseUrl = `http://127.0.0.1:${port.port}`;

try {
    const accepted = await postJson(`${baseUrl}/v1/tasks`, sampleTaskRequest({ idempotencyKey: 'smoke-1' }));
    const taskId = accepted.taskId as string;
    await waitForStatus(baseUrl, taskId, 'succeeded');
    const result = await fetch(`${baseUrl}/v1/tasks/${taskId}/result`).then((response) => response.json());
    console.log(JSON.stringify({ taskId, status: result.status, outputs: result.outputs?.length ?? 0 }, null, 2));
} finally {
    await port.close();
}

async function listenOnRandomPort(): Promise<{ port: number; close: () => Promise<void> }> {
    const server = createTaskServiceServer();
    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to bind smoke server.');
    return {
        port: address.port,
        close: () =>
            new Promise((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            })
    };
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as Record<string, unknown>;
}

async function waitForStatus(baseUrl: string, taskId: string, status: string): Promise<void> {
    for (let index = 0; index < 50; index += 1) {
        const task = (await fetch(`${baseUrl}/v1/tasks/${taskId}`).then((response) => response.json())) as {
            status?: string;
        };
        if (task.status === status) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Task ${taskId} did not reach ${status}.`);
}
