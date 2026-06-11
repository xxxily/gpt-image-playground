import { AssetStorageError, LocalAssetDownload, LocalFileAssetStore } from './assets.js';
import {
    ManagedTaskAdminDiagnostic,
    ManagedTaskAdminSummary,
    ManagedTaskAdminVisibility,
    ManagedTaskAuditEvent,
    ManagedTaskErrorCode,
    ManagedGenerationTaskAccepted,
    ManagedGenerationTaskRequest,
    ManagedGenerationTaskStatusResponse,
    ManagedTaskError,
    ManagedTaskEvent,
    ManagedTaskResultManifest,
    ManagedTaskRetryPolicy,
    MockTaskParameters,
    P0_TASK_TYPES,
    TaskRecord
} from './types.js';
import { validatePublicHttpBaseUrl } from './url-safety.js';
import { createHash, randomUUID } from 'node:crypto';

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'expired']);

export type RuntimeOptions = {
    baseUrl?: string;
    assetStore?: LocalFileAssetStore;
    assetRootDir?: string;
    resultRetentionMs?: number;
    maxOutputAssetBytes?: number;
    endpointConcurrency?: Record<string, number>;
    defaultEndpointConcurrency?: number;
    maxAttempts?: number;
    retryPolicy?: Partial<ManagedTaskRetryPolicy>;
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
    private readonly auditEvents: ManagedTaskAuditEvent[] = [];
    private readonly endpointBackoffUntil = new Map<string, number>();
    private readonly limiter: EndpointLimiter;
    private readonly baseUrl: string;
    private readonly assetStore: LocalFileAssetStore;
    private readonly maxAttempts: number;
    private retryPolicy: ManagedTaskRetryPolicy;

    constructor(options: RuntimeOptions = {}) {
        this.baseUrl = options.baseUrl ?? 'http://localhost:8787';
        this.maxAttempts = options.maxAttempts ?? 2;
        this.limiter = new EndpointLimiter(options.endpointConcurrency ?? {}, options.defaultEndpointConcurrency ?? 1);
        this.assetStore =
            options.assetStore ??
            new LocalFileAssetStore({
                rootDir: options.assetRootDir,
                downloadBaseUrl: options.baseUrl,
                retentionMs: options.resultRetentionMs,
                maxOutputAssetBytes: options.maxOutputAssetBytes
            });
        this.retryPolicy = normalizeRetryPolicy(options.retryPolicy, this.maxAttempts);
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
            maxAttempts: this.retryPolicy.maxAttempts,
            retryable: false,
            cancellable: true,
            cancelRequested: false,
            events: []
        };
        this.tasks.set(taskId, record);
        this.idempotency.set(request.idempotencyKey, taskId);
        this.appendEvent(record, 'accepted', 'Task accepted and persisted by mock runtime.');
        this.appendAudit('task_submit', 'task', record.taskId, this.taskAuditMetadata(record));
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
        this.appendAudit('task_cancel', 'task', record.taskId, {
            status: record.status,
            reason: reason ?? null,
            attempt: record.attempt
        });
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
        this.appendAudit('task_retry', 'task', record.taskId, {
            attempt: record.attempt,
            maxAttempts: record.maxAttempts
        });
        return this.toAccepted(record);
    }

    getResult(taskId: string): ManagedTaskResultManifest {
        const record = this.mustGetTask(taskId);
        if (record.status !== 'succeeded' || !record.result) {
            throw taskError('task_not_found', 'Task result is not available.', false);
        }
        this.appendAudit('task_result_read', 'task', record.taskId, {
            outputCount: record.result.outputs.length,
            completedAt: record.completedAt
        });
        return record.result;
    }

    getAssetDownload(assetId: string, token: string | null): Promise<LocalAssetDownload> {
        return this.assetStore.getDownload(assetId, token);
    }

    getEvents(taskId: string): ManagedTaskEvent[] {
        return [...this.mustGetTask(taskId).events];
    }

    listTaskSummaries(limit = 100): { tasks: ManagedTaskAdminSummary[]; requestedAt: string } {
        const boundedLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
        return {
            tasks: [...this.tasks.values()]
                .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
                .slice(0, boundedLimit)
                .map((record) => this.toAdminSummary(record)),
            requestedAt: new Date().toISOString()
        };
    }

    getTaskDiagnostic(
        taskId: string,
        visibility: ManagedTaskAdminVisibility
    ): ManagedTaskAdminSummary | ManagedTaskAdminDiagnostic {
        const record = this.mustGetTask(taskId);
        if (visibility === 'summary') return this.toAdminSummary(record);
        this.appendAudit('admin_task_diagnostic_view', 'task', record.taskId, {
            visibility: 'full',
            status: record.status,
            taskType: record.request.taskType
        });
        return this.toAdminDiagnostic(record);
    }

    listAuditEvents(limit = 100): { events: ManagedTaskAuditEvent[]; requestedAt: string } {
        const boundedLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
        return {
            events: this.auditEvents.slice(-boundedLimit).reverse(),
            requestedAt: new Date().toISOString()
        };
    }

    getRetryPolicy(): ManagedTaskRetryPolicy {
        return { ...this.retryPolicy };
    }

    updateRetryPolicy(policy: Partial<ManagedTaskRetryPolicy>): ManagedTaskRetryPolicy {
        const before = this.getRetryPolicy();
        this.retryPolicy = normalizeRetryPolicy({ ...this.retryPolicy, ...policy }, this.maxAttempts);
        this.appendAudit('retry_policy_update', 'retry_policy', 'default', {
            before,
            after: this.retryPolicy,
            feeWarning: this.retryPolicy.feeWarning
        });
        return this.getRetryPolicy();
    }

    assetStorageSummary() {
        return this.assetStore.summary();
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
        if (!(await this.waitForEndpointBackoff(record, runId))) return;

        this.transition(record, 'provider_processing', 'Mock provider processing.');
        record.progress = { ...record.progress, phase: 'provider_processing', percent: 45, providerPollCount: 1 };
        await sleep(mockParameters(record).providerDelayMs ?? 10);
        if (!this.isCurrentRun(record, runId)) return;
        if (this.finishIfCancelled(record)) return;

        const parameters = mockParameters(record);
        if (parameters.fail || (parameters.failUntilAttempt ?? 0) >= record.attempt) {
            const code = parameters.failCode ?? 'provider_failed';
            const message =
                parameters.failMessage ??
                (code === 'provider_rate_limited' ? 'Mock provider rate limit.' : 'Mock provider failure.');
            this.handleProviderFailure(record, code, message);
            return;
        }

        this.transition(record, 'downloading_result', 'Mock result save started.');
        record.progress = { ...record.progress, phase: 'downloading_result', percent: 80 };
        await sleep(parameters.downloadDelayMs ?? 10);
        if (!this.isCurrentRun(record, runId)) return;
        if (this.finishIfCancelled(record)) return;

        const completedAt = new Date().toISOString();
        const outputContent = `mock ${record.request.taskType} result for ${record.taskId}`;
        let storedOutput;
        try {
            storedOutput = await this.assetStore.saveTextOutput({
                taskId: record.taskId,
                kind: 'image',
                filename: `${record.taskId}.mock.txt`,
                mimeType: 'text/plain; charset=utf-8',
                content: outputContent
            });
        } catch (error) {
            const assetError = error instanceof AssetStorageError ? error : undefined;
            this.failRecord(
                record,
                assetError?.code ?? 'asset_save_failed',
                assetError?.message ?? 'Mock result could not be saved.',
                assetError?.retryable ?? true
            );
            return;
        }

        record.expiresAt = storedOutput.expiresAt;
        record.result = {
            taskId: record.taskId,
            status: 'succeeded',
            outputs: [
                {
                    id: storedOutput.outputId,
                    kind: storedOutput.kind,
                    filename: storedOutput.filename,
                    mimeType: storedOutput.mimeType,
                    size: storedOutput.size,
                    sha256: storedOutput.sha256,
                    downloadUrl: storedOutput.downloadUrl,
                    expiresAt: storedOutput.expiresAt
                }
            ],
            providerUsage: { mock: true, attempt: record.attempt },
            providerRequestId: `mock-provider-${record.taskId}`,
            completedAt,
            expiresAt: storedOutput.expiresAt
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
        if (request.providerEndpointRef.baseUrl) {
            const validation = validatePublicHttpBaseUrl(request.providerEndpointRef.baseUrl);
            if (!validation.ok) {
                throw taskError('endpoint_blocked', validation.reason, false, {
                    field: 'providerEndpointRef.baseUrl'
                });
            }
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
        if (Date.parse(request.executionCredential.expiresAt) <= Date.now()) {
            throw taskError('credential_expired', 'Execution credential has expired.', false);
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

    private handleProviderFailure(
        record: TaskRecord,
        code: Extract<ManagedTaskErrorCode, 'provider_failed' | 'provider_rate_limited'>,
        message: string
    ): void {
        if (this.retryPolicy.enabled && record.attempt < record.maxAttempts) {
            this.scheduleAutomaticRetry(record, code, message);
            return;
        }
        this.failRecord(record, code, message, true);
    }

    private scheduleAutomaticRetry(
        record: TaskRecord,
        code: Extract<ManagedTaskErrorCode, 'provider_failed' | 'provider_rate_limited'>,
        message: string
    ): void {
        const endpointKey = record.request.providerEndpointRef.baseUrlFingerprint;
        const nextRetryAtMs = Date.now() + this.retryPolicy.backoffMs;
        const nextRetryAt = new Date(nextRetryAtMs).toISOString();
        const existingBackoff = this.endpointBackoffUntil.get(endpointKey) ?? 0;
        this.endpointBackoffUntil.set(endpointKey, Math.max(existingBackoff, nextRetryAtMs));
        record.error = taskError(code, message, true, {
            endpointBackoffKey: endpointKey,
            nextRetryAt
        });
        record.retryable = false;
        record.cancellable = true;
        record.activeRunId = undefined;
        record.progress = {
            ...record.progress,
            phase: 'retry_scheduled',
            nextRetryAt
        };
        this.transition(record, 'retry_scheduled', `${message} Automatic retry scheduled.`);
        this.appendAudit('task_retry_scheduled', 'task', record.taskId, {
            attempt: record.attempt,
            nextAttempt: record.attempt + 1,
            maxAttempts: record.maxAttempts,
            code,
            endpoint: { baseUrlFingerprint: endpointKey },
            nextRetryAt
        });
        setTimeout(() => {
            const current = this.tasks.get(record.taskId);
            if (!current || current.status !== 'retry_scheduled' || current.cancelRequested) return;
            current.attempt += 1;
            current.error = undefined;
            current.retryable = false;
            current.cancellable = true;
            current.cancelRequested = false;
            this.enqueue(current, 'retry_scheduled');
        }, this.retryPolicy.backoffMs);
    }

    private finishIfCancelled(record: TaskRecord): boolean {
        if (!record.cancelRequested) return false;
        record.cancellable = false;
        record.activeRunId = undefined;
        this.transition(record, 'cancelled', 'Task cancelled by request.');
        return true;
    }

    private async waitForEndpointBackoff(record: TaskRecord, runId: string): Promise<boolean> {
        const endpointKey = record.request.providerEndpointRef.baseUrlFingerprint;
        const backoffUntil = this.endpointBackoffUntil.get(endpointKey) ?? 0;
        const waitMs = backoffUntil - Date.now();
        if (waitMs <= 0) return true;

        record.progress = {
            ...record.progress,
            phase: 'endpoint_backoff',
            nextRetryAt: new Date(backoffUntil).toISOString()
        };
        this.appendEvent(record, 'running', 'Endpoint backoff active before provider call.');
        await sleep(waitMs);
        if (!this.isCurrentRun(record, runId)) return false;
        return !this.finishIfCancelled(record);
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

    private appendAudit(action: string, targetType: string, targetId: string, metadata: Record<string, unknown>): void {
        this.auditEvents.push({
            id: `aud_${randomUUID()}`,
            action,
            targetType,
            targetId,
            createdAt: new Date().toISOString(),
            metadata
        });
        if (this.auditEvents.length > 1000) this.auditEvents.splice(0, this.auditEvents.length - 1000);
    }

    private taskAuditMetadata(record: TaskRecord): Record<string, unknown> {
        return {
            taskType: record.request.taskType,
            status: record.status,
            endpoint: {
                id: record.request.providerEndpointRef.id,
                provider: record.request.providerEndpointRef.provider,
                protocol: record.request.providerEndpointRef.protocol,
                baseUrlFingerprint: record.request.providerEndpointRef.baseUrlFingerprint
            },
            model: record.request.model,
            credentialFingerprint: record.request.executionCredential.fingerprint,
            clientTaskId: record.request.clientContext.clientTaskId,
            source: record.request.clientContext.source
        };
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

    private toAdminSummary(record: TaskRecord): ManagedTaskAdminSummary {
        const status = this.toStatus(record);
        return {
            visibility: 'summary',
            taskId: record.taskId,
            status: record.status,
            taskType: record.request.taskType,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            completedAt: record.completedAt,
            attempt: record.attempt,
            maxAttempts: record.maxAttempts,
            retryable: record.retryable,
            cancellable: record.cancellable,
            endpoint: status.endpoint,
            model: status.model,
            credentialFingerprint: record.request.executionCredential.fingerprint,
            promptSummary: {
                sha256: createHash('sha256').update(record.request.prompt).digest('hex'),
                length: record.request.prompt.length
            },
            outputCount: record.result?.outputs.length ?? 0,
            errorCode: record.error?.code
        };
    }

    private toAdminDiagnostic(record: TaskRecord): ManagedTaskAdminDiagnostic {
        const summary = this.toAdminSummary(record);
        return {
            ...summary,
            visibility: 'full',
            prompt: record.request.prompt,
            parameters: record.request.parameters,
            inputAssets: record.request.inputAssets,
            clientContext: record.request.clientContext,
            providerEndpointRef: record.request.providerEndpointRef,
            executionCredential: {
                mode: record.request.executionCredential.mode,
                expiresAt: record.request.executionCredential.expiresAt,
                fingerprint: record.request.executionCredential.fingerprint,
                algorithm: record.request.executionCredential.algorithm,
                keyEnvelopeStored: Boolean(record.request.executionCredential.keyEnvelope)
            },
            events: [...record.events],
            result: record.result
                ? {
                      ...record.result,
                      outputs: record.result.outputs.map((output) => {
                          const { downloadUrl, ...safeOutput } = output;
                          return { ...safeOutput, downloadUrlStored: Boolean(downloadUrl) };
                      })
                  }
                : undefined
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

export function taskError(
    code: ManagedTaskError['code'],
    message: string,
    retryable: boolean,
    safeDetails?: Record<string, unknown>
): ManagedTaskError {
    return { code, message, retryable, ...(safeDetails ? { safeDetails } : {}) };
}

function normalizeRetryPolicy(
    input: Partial<ManagedTaskRetryPolicy> | undefined,
    fallbackMaxAttempts: number
): ManagedTaskRetryPolicy {
    const maxAttempts = Math.max(1, Math.min(5, Math.trunc(input?.maxAttempts ?? fallbackMaxAttempts)));
    const backoffMs = Math.max(1_000, Math.min(60_000, Math.trunc(input?.backoffMs ?? 5_000)));
    return {
        enabled: Boolean(input?.enabled ?? false),
        maxAttempts,
        backoffMs,
        feeWarning:
            input?.feeWarning ??
            'Automatic retry can call the upstream provider again and may consume provider balance or user quota.'
    };
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
