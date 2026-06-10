import {
    ManagedGenerationTaskAccepted,
    ManagedGenerationTaskRequest,
    ManagedGenerationTaskStatusResponse,
    ManagedTaskError,
    ManagedTaskEvent,
    ManagedTaskResultManifest,
    MockTaskParameters,
    P0_TASK_TYPES,
    TaskRecord
} from './types.js';
import { createHash, randomUUID } from 'node:crypto';

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'expired']);

export type RuntimeOptions = {
    baseUrl?: string;
    endpointConcurrency?: Record<string, number>;
    defaultEndpointConcurrency?: number;
    maxAttempts?: number;
};

type QueueEntry = {
    taskId: string;
    run: () => Promise<void>;
};

export class EndpointLimiter {
    private readonly active = new Map<string, number>();
    private readonly queues = new Map<string, QueueEntry[]>();

    constructor(
        private readonly endpointConcurrency: Record<string, number>,
        private readonly defaultConcurrency: number
    ) {}

    enqueue(key: string, entry: QueueEntry): number {
        const queue = this.queues.get(key) ?? [];
        this.queues.set(key, queue);
        const active = this.active.get(key) ?? 0;
        const limit = this.endpointConcurrency[key] ?? this.defaultConcurrency;

        if (active < limit) {
            this.start(key, entry);
            return 0;
        }

        queue.push(entry);
        return queue.length;
    }

    snapshot(): Array<{ key: string; active: number; queued: number; limit: number }> {
        const keys = new Set([...this.active.keys(), ...this.queues.keys(), ...Object.keys(this.endpointConcurrency)]);
        return [...keys].sort().map((key) => ({
            key,
            active: this.active.get(key) ?? 0,
            queued: this.queues.get(key)?.length ?? 0,
            limit: this.endpointConcurrency[key] ?? this.defaultConcurrency
        }));
    }

    private start(key: string, entry: QueueEntry): void {
        this.active.set(key, (this.active.get(key) ?? 0) + 1);
        void entry.run().finally(() => {
            const active = Math.max(0, (this.active.get(key) ?? 1) - 1);
            this.active.set(key, active);
            const next = this.queues.get(key)?.shift();
            if (next) {
                this.start(key, next);
            }
        });
    }
}

export class ManagedTaskRuntime {
    private readonly tasks = new Map<string, TaskRecord>();
    private readonly idempotency = new Map<string, string>();
    private readonly limiter: EndpointLimiter;
    private readonly baseUrl: string;
    private readonly maxAttempts: number;

    constructor(options: RuntimeOptions = {}) {
        this.baseUrl = options.baseUrl ?? 'http://localhost:8787';
        this.maxAttempts = options.maxAttempts ?? 2;
        this.limiter = new EndpointLimiter(options.endpointConcurrency ?? {}, options.defaultEndpointConcurrency ?? 1);
    }

    createTask(request: ManagedGenerationTaskRequest): ManagedGenerationTaskAccepted {
        this.validateTaskRequest(request);
        const requestHash = hashRequestForIdempotency(request);
        const existingTaskId = this.idempotency.get(request.idempotencyKey);
        if (existingTaskId) {
            const existing = this.mustGetTask(existingTaskId);
            if (existing.requestHash !== requestHash) {
                throw taskError(
                    'idempotency_conflict',
                    'Idempotency key was already used with a different request.',
                    false
                );
            }
            return this.toAccepted(existing);
        }

        const now = new Date().toISOString();
        const taskId = `mgt_${randomUUID()}`;
        const record: TaskRecord = {
            taskId,
            idempotencyKey: request.idempotencyKey,
            requestHash,
            request,
            status: 'accepted',
            createdAt: now,
            updatedAt: now,
            attempt: 1,
            maxAttempts: this.maxAttempts,
            retryable: false,
            cancellable: true,
            cancelRequested: false,
            events: []
        };
        this.tasks.set(taskId, record);
        this.idempotency.set(request.idempotencyKey, taskId);
        this.appendEvent(record, 'accepted', 'Task accepted and persisted by mock runtime.');
        this.enqueue(record, 'accepted');
        return this.toAccepted(record);
    }

    getTask(taskId: string): ManagedGenerationTaskStatusResponse | undefined {
        const record = this.tasks.get(taskId);
        return record ? this.toStatus(record) : undefined;
    }

    queryTasks(taskIds: string[]): {
        tasks: ManagedGenerationTaskStatusResponse[];
        missingTaskIds: string[];
        requestedAt: string;
    } {
        const tasks: ManagedGenerationTaskStatusResponse[] = [];
        const missingTaskIds: string[] = [];
        for (const taskId of taskIds.slice(0, 100)) {
            const task = this.getTask(taskId);
            if (task) {
                tasks.push(task);
            } else {
                missingTaskIds.push(taskId);
            }
        }
        return { tasks, missingTaskIds, requestedAt: new Date().toISOString() };
    }

    cancelTask(taskId: string, reason?: string): ManagedGenerationTaskStatusResponse {
        const record = this.mustGetTask(taskId);
        if (!record.cancellable || TERMINAL_STATUSES.has(record.status)) {
            throw taskError('task_not_cancellable', 'Task cannot be cancelled in its current state.', false);
        }

        record.cancelRequested = true;
        if (record.status === 'accepted' || record.status === 'queued' || record.status === 'retry_scheduled') {
            this.transition(record, 'cancelled', reason ?? 'Task cancelled before worker execution.');
            record.cancellable = false;
        } else {
            this.transition(record, 'cancelling', reason ?? 'Cancellation requested.');
        }
        return this.toStatus(record);
    }

    retryTask(taskId: string): ManagedGenerationTaskAccepted {
        const record = this.mustGetTask(taskId);
        if (!record.retryable || record.status !== 'failed') {
            throw taskError('task_not_retryable', 'Task cannot be retried in its current state.', false);
        }
        if (record.attempt >= record.maxAttempts) {
            throw taskError('task_not_retryable', 'Task exhausted retry attempts.', false);
        }

        record.attempt += 1;
        record.error = undefined;
        record.result = undefined;
        record.retryable = false;
        record.cancellable = true;
        record.cancelRequested = false;
        this.enqueue(record, 'retry_scheduled');
        return this.toAccepted(record);
    }

    getResult(taskId: string): ManagedTaskResultManifest {
        const record = this.mustGetTask(taskId);
        if (record.status !== 'succeeded' || !record.result) {
            throw taskError('task_not_found', 'Task result is not available.', false);
        }
        return record.result;
    }

    getEvents(taskId: string): ManagedTaskEvent[] {
        return [...this.mustGetTask(taskId).events];
    }

    queues(): Array<{ key: string; active: number; queued: number; limit: number }> {
        return this.limiter.snapshot();
    }

    simulateWorkerCrash(): { affectedTaskIds: string[] } {
        const affectedTaskIds: string[] = [];
        for (const record of this.tasks.values()) {
            if (
                record.status === 'running' ||
                record.status === 'provider_processing' ||
                record.status === 'downloading_result'
            ) {
                affectedTaskIds.push(record.taskId);
                record.activeRunId = undefined;
                record.retryable = record.attempt < record.maxAttempts;
                if (record.retryable) {
                    record.attempt += 1;
                    this.enqueue(record, 'retry_scheduled');
                } else {
                    this.failRecord(
                        record,
                        'provider_failed',
                        'Mock worker crashed and no retry attempts remain.',
                        false
                    );
                }
            }
        }
        return { affectedTaskIds };
    }

    private enqueue(record: TaskRecord, fromStatus: 'accepted' | 'retry_scheduled'): void {
        this.transition(
            record,
            fromStatus === 'accepted' ? 'queued' : 'retry_scheduled',
            'Task waiting for endpoint worker slot.'
        );
        const key = record.request.providerEndpointRef.baseUrlFingerprint;
        const position = this.limiter.enqueue(key, {
            taskId: record.taskId,
            run: async () => this.runMockTask(record.taskId)
        });
        record.progress = {
            ...record.progress,
            queuePosition: position || undefined,
            phase: position ? 'queued' : 'dispatching'
        };
    }

    private async runMockTask(taskId: string): Promise<void> {
        const record = this.mustGetTask(taskId);
        const runId = randomUUID();
        record.activeRunId = runId;
        if (record.cancelRequested) {
            record.activeRunId = undefined;
            this.transition(record, 'cancelled', 'Task cancelled before execution.');
            return;
        }

        this.transition(record, 'running', 'Mock worker started.');
        record.startedAt = record.startedAt ?? new Date().toISOString();
        await sleep(mockParameters(record).delayMs ?? 10);
        if (!this.isCurrentRun(record, runId)) return;
        if (this.finishIfCancelled(record)) return;

        this.transition(record, 'provider_processing', 'Mock provider processing.');
        record.progress = { ...record.progress, phase: 'provider_processing', percent: 45, providerPollCount: 1 };
        await sleep(mockParameters(record).providerDelayMs ?? 10);
        if (!this.isCurrentRun(record, runId)) return;
        if (this.finishIfCancelled(record)) return;

        const parameters = mockParameters(record);
        if (parameters.fail || (parameters.failUntilAttempt ?? 0) >= record.attempt) {
            this.failRecord(record, 'provider_failed', 'Mock provider failure.', true);
            return;
        }

        this.transition(record, 'downloading_result', 'Mock result save started.');
        record.progress = { ...record.progress, phase: 'downloading_result', percent: 80 };
        await sleep(parameters.downloadDelayMs ?? 10);
        if (!this.isCurrentRun(record, runId)) return;
        if (this.finishIfCancelled(record)) return;

        const completedAt = new Date().toISOString();
        record.result = {
            taskId: record.taskId,
            status: 'succeeded',
            outputs: [
                {
                    id: 'mock-output-1',
                    kind: 'image',
                    filename: `${record.taskId}.mock.txt`,
                    mimeType: 'text/plain',
                    size: 42,
                    sha256: createHash('sha256').update(record.taskId).digest('hex'),
                    inlineText: `mock ${record.request.taskType} result`
                }
            ],
            providerUsage: { mock: true, attempt: record.attempt },
            providerRequestId: `mock-provider-${record.taskId}`,
            completedAt
        };
        record.completedAt = completedAt;
        record.retryable = false;
        record.cancellable = false;
        record.activeRunId = undefined;
        record.progress = { phase: 'succeeded', percent: 100 };
        this.transition(record, 'succeeded', 'Mock task completed.');
    }

    private validateTaskRequest(request: ManagedGenerationTaskRequest): void {
        if (!P0_TASK_TYPES.includes(request.taskType)) {
            throw taskError('unsupported_task_type', 'P0 only supports image.generate and image.edit.', false);
        }
        if (!request.idempotencyKey || !request.providerEndpointRef?.baseUrlFingerprint || !request.model?.rawModelId) {
            throw taskError('invalid_request', 'Missing required idempotency, endpoint, or model fields.', false);
        }
        if (request.taskType === 'image.edit' && !request.inputAssets.some((asset) => asset.kind === 'image')) {
            throw taskError('invalid_request', 'image.edit requires at least one image input asset.', false);
        }
        if (!request.executionCredential?.keyEnvelope || !request.executionCredential?.fingerprint) {
            throw taskError(
                'credential_rejected',
                'Execution credential envelope and fingerprint are required.',
                false
            );
        }
    }

    private transition(record: TaskRecord, status: TaskRecord['status'], safeMessage: string): void {
        record.status = status;
        record.updatedAt = new Date().toISOString();
        this.appendEvent(record, status, safeMessage);
    }

    private failRecord(record: TaskRecord, code: ManagedTaskError['code'], message: string, retryable: boolean): void {
        record.error = taskError(code, message, retryable);
        record.retryable = retryable && record.attempt < record.maxAttempts;
        record.cancellable = false;
        record.activeRunId = undefined;
        record.completedAt = new Date().toISOString();
        this.transition(record, 'failed', message);
    }

    private finishIfCancelled(record: TaskRecord): boolean {
        if (!record.cancelRequested) return false;
        record.cancellable = false;
        record.activeRunId = undefined;
        this.transition(record, 'cancelled', 'Task cancelled by request.');
        return true;
    }

    private isCurrentRun(record: TaskRecord, runId: string): boolean {
        return record.activeRunId === runId;
    }

    private appendEvent(record: TaskRecord, status: TaskRecord['status'], safeMessage: string): void {
        record.events.push({
            id: `evt_${randomUUID()}`,
            taskId: record.taskId,
            status,
            createdAt: new Date().toISOString(),
            safeMessage
        });
    }

    private toAccepted(record: TaskRecord): ManagedGenerationTaskAccepted {
        return {
            taskId: record.taskId,
            status: record.status === 'accepted' ? 'accepted' : 'queued',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            statusUrl: `${this.baseUrl}/v1/tasks/${record.taskId}`,
            eventsUrl: `${this.baseUrl}/v1/tasks/${record.taskId}/events`,
            resultUrl: `${this.baseUrl}/v1/tasks/${record.taskId}/result`,
            queue: {
                position: record.progress?.queuePosition,
                reason: record.progress?.phase
            }
        };
    }

    private toStatus(record: TaskRecord): ManagedGenerationTaskStatusResponse {
        return {
            taskId: record.taskId,
            status: record.status,
            taskType: record.request.taskType,
            clientTaskId: record.request.clientContext.clientTaskId,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            startedAt: record.startedAt,
            completedAt: record.completedAt,
            expiresAt: record.expiresAt,
            progress: record.progress,
            retryable: record.retryable,
            cancellable: record.cancellable,
            attempt: record.attempt,
            maxAttempts: record.maxAttempts,
            endpoint: {
                id: record.request.providerEndpointRef.id,
                provider: record.request.providerEndpointRef.provider,
                protocol: record.request.providerEndpointRef.protocol,
                baseUrlFingerprint: record.request.providerEndpointRef.baseUrlFingerprint
            },
            model: record.request.model,
            error: record.error,
            resultUrl: record.result ? `${this.baseUrl}/v1/tasks/${record.taskId}/result` : undefined
        };
    }

    private mustGetTask(taskId: string): TaskRecord {
        const record = this.tasks.get(taskId);
        if (!record) {
            throw taskError('task_not_found', 'Task not found.', false);
        }
        return record;
    }
}

export function taskError(code: ManagedTaskError['code'], message: string, retryable: boolean): ManagedTaskError {
    return { code, message, retryable };
}

function hashRequestForIdempotency(request: ManagedGenerationTaskRequest): string {
    const safeRequest = {
        ...request,
        executionCredential: {
            ...request.executionCredential,
            keyEnvelope: createHash('sha256').update(request.executionCredential.keyEnvelope).digest('hex')
        }
    };
    return createHash('sha256').update(JSON.stringify(safeRequest)).digest('hex');
}

function mockParameters(record: TaskRecord): MockTaskParameters {
    const mock = record.request.parameters.mock;
    if (!mock || typeof mock !== 'object' || Array.isArray(mock)) return {};
    return mock as MockTaskParameters;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, Math.max(0, ms));
    });
}
