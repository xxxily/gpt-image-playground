import { readJsonBody, sendJson, sendNoContent } from './http.js';
import { ManagedTaskRuntime, taskError } from './runtime.js';
import { ManagedGenerationTaskRequest, ManagedTaskError } from './types.js';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { URL } from 'node:url';

export type TaskServiceServerOptions = {
    runtime?: ManagedTaskRuntime;
    baseUrl?: string;
};

export function createTaskServiceServer(options: TaskServiceServerOptions = {}): Server {
    const runtime = options.runtime ?? new ManagedTaskRuntime({ baseUrl: options.baseUrl });

    return createServer(async (request, response) => {
        try {
            await routeRequest(runtime, request, response);
        } catch (error) {
            const taskErrorValue = normalizeError(error);
            const statusCode = statusCodeForError(taskErrorValue.code);
            sendJson(response, statusCode, { error: taskErrorValue });
        }
    });
}

async function routeRequest(
    runtime: ManagedTaskRuntime,
    request: IncomingMessage,
    response: ServerResponse
): Promise<void> {
    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', 'http://task-service.local');
    const pathname = url.pathname;

    if (method === 'GET' && pathname === '/v1/admin/health') {
        sendJson(response, 200, {
            status: 'ok',
            version: '0.1.0-phase1',
            schemaVersion: 'managed-generation-task/v1',
            checkedAt: new Date().toISOString(),
            dependencies: [
                {
                    name: 'hatchet',
                    status: process.env.HATCHET_CLIENT_TOKEN ? 'ok' : 'degraded',
                    safeMessage: process.env.HATCHET_CLIENT_TOKEN
                        ? 'Hatchet client token is configured for adapter use.'
                        : 'Hatchet token is not configured; mock runtime remains available.'
                },
                { name: 'database', status: 'degraded', safeMessage: 'Phase 1 uses an in-memory task store.' },
                {
                    name: 'asset-storage',
                    status: 'degraded',
                    safeMessage: 'Phase 2 will add local file result storage.'
                },
                { name: 'worker', status: 'ok', safeMessage: 'Mock in-process worker runtime is available.' }
            ]
        });
        return;
    }

    if (method === 'GET' && pathname === '/v1/admin/capabilities') {
        sendJson(response, 200, {
            schemaVersion: 'managed-generation-task/v1',
            serviceVersion: '0.1.0-phase1',
            taskTypes: ['image.generate', 'image.edit'],
            credentialModes: ['user-delegated', 'admin-delegated'],
            storage: {
                primary: 'local-filesystem',
                s3CompatibleAvailable: false,
                maxInputAssetBytes: 10 * 1024 * 1024,
                maxOutputAssetBytes: 25 * 1024 * 1024,
                defaultRetentionHours: 24
            },
            events: { sse: false, batchPolling: true, webhook: false },
            limits: { maxBatchQueryTasks: 100 },
            diagnosticsUrl: '/v1/admin/queues'
        });
        return;
    }

    if (method === 'GET' && pathname === '/v1/admin/queues') {
        sendJson(response, 200, { queues: runtime.queues(), checkedAt: new Date().toISOString() });
        return;
    }

    if (method === 'POST' && pathname === '/v1/admin/test/simulate-worker-crash') {
        sendJson(response, 200, runtime.simulateWorkerCrash());
        return;
    }

    if (method === 'POST' && pathname === '/v1/tasks') {
        const body = (await readJsonBody(request)) as ManagedGenerationTaskRequest;
        sendJson(response, 202, runtime.createTask(body));
        return;
    }

    if (method === 'POST' && pathname === '/v1/tasks/query') {
        const body = (await readJsonBody(request)) as { taskIds?: unknown };
        const taskIds = Array.isArray(body.taskIds)
            ? body.taskIds.filter((id): id is string => typeof id === 'string')
            : [];
        sendJson(response, 200, runtime.queryTasks(taskIds));
        return;
    }

    const taskMatch = pathname.match(/^\/v1\/tasks\/([^/]+)(?:\/([^/]+))?$/);
    if (taskMatch) {
        const taskId = taskMatch[1];
        const action = taskMatch[2];
        if (method === 'GET' && !action) {
            const task = runtime.getTask(taskId);
            if (!task) throw taskError('task_not_found', 'Task not found.', false);
            sendJson(response, 200, task);
            return;
        }
        if (method === 'POST' && action === 'cancel') {
            const body = (await readJsonBody(request)) as { reason?: string };
            sendJson(response, 200, runtime.cancelTask(taskId, body.reason));
            return;
        }
        if (method === 'POST' && action === 'retry') {
            sendJson(response, 202, runtime.retryTask(taskId));
            return;
        }
        if (method === 'GET' && action === 'result') {
            sendJson(response, 200, runtime.getResult(taskId));
            return;
        }
        if (method === 'GET' && action === 'events') {
            sendJson(response, 200, { events: runtime.getEvents(taskId) });
            return;
        }
    }

    if (method === 'OPTIONS') {
        sendNoContent(response);
        return;
    }

    throw taskError('task_not_found', 'Route not found.', false);
}

function normalizeError(error: unknown): ManagedTaskError {
    if (error && typeof error === 'object' && 'code' in error && 'message' in error && 'retryable' in error) {
        return error as ManagedTaskError;
    }
    if (error instanceof SyntaxError) {
        return taskError('invalid_request', 'Request body is not valid JSON.', false);
    }
    if (error instanceof Error && error.message === 'request_body_too_large') {
        return taskError('invalid_request', 'Request body is too large.', false);
    }
    return taskError('internal_error', 'Unexpected task service error.', false);
}

function statusCodeForError(code: ManagedTaskError['code']): number {
    switch (code) {
        case 'invalid_request':
        case 'unsupported_task_type':
        case 'unsupported_capability':
        case 'credential_expired':
        case 'credential_rejected':
        case 'task_not_cancellable':
        case 'task_not_retryable':
            return 400;
        case 'unauthorized':
            return 401;
        case 'forbidden':
        case 'endpoint_blocked':
            return 403;
        case 'task_not_found':
            return 404;
        case 'idempotency_conflict':
            return 409;
        case 'rate_limited':
        case 'queue_full':
        case 'provider_rate_limited':
            return 429;
        case 'service_unavailable':
            return 503;
        default:
            return 500;
    }
}
