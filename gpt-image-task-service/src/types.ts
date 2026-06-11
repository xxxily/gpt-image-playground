export const P0_TASK_TYPES = ['image.generate', 'image.edit'] as const;

export type ManagedGenerationTaskType = (typeof P0_TASK_TYPES)[number];

export type ManagedTaskStatus =
    | 'submitted'
    | 'accepted'
    | 'queued'
    | 'running'
    | 'provider_processing'
    | 'downloading_result'
    | 'succeeded'
    | 'failed'
    | 'retry_scheduled'
    | 'cancelling'
    | 'cancelled'
    | 'retained'
    | 'expired';

export type ManagedTaskErrorCode =
    | 'invalid_request'
    | 'unsupported_task_type'
    | 'unsupported_capability'
    | 'unauthorized'
    | 'forbidden'
    | 'idempotency_conflict'
    | 'credential_expired'
    | 'credential_rejected'
    | 'endpoint_blocked'
    | 'rate_limited'
    | 'queue_full'
    | 'provider_rate_limited'
    | 'provider_failed'
    | 'asset_upload_failed'
    | 'asset_save_failed'
    | 'asset_download_failed'
    | 'asset_retention_expired'
    | 'task_not_found'
    | 'task_not_cancellable'
    | 'task_not_retryable'
    | 'internal_error'
    | 'service_unavailable';

export type ManagedTaskError = {
    code: ManagedTaskErrorCode;
    message: string;
    retryable: boolean;
    safeDetails?: Record<string, unknown>;
    requestId?: string;
};

export type ManagedProviderEndpointRef = {
    id: string;
    provider: string;
    protocol: string;
    baseUrl?: string;
    baseUrlFingerprint: string;
    displayName?: string;
};

export type ManagedExecutionCredential = {
    mode: 'user-delegated' | 'admin-delegated';
    keyEnvelope: string;
    expiresAt: string;
    fingerprint: string;
    algorithm?: 'sealed-box-v1';
};

export type ManagedInputAssetRef = {
    kind: 'image' | 'mask' | 'video' | 'audio' | 'json';
    uploadRef: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    sha256?: string;
    width?: number;
    height?: number;
};

export type ManagedTaskClientContext = {
    appInstanceId: string;
    clientTaskId: string;
    workspaceId?: string;
    source: 'web' | 'tauri-desktop' | 'tauri-mobile';
    locale?: string;
    userRef?: string;
};

export type ManagedGenerationTaskRequest = {
    idempotencyKey: string;
    taskType: ManagedGenerationTaskType;
    providerEndpointRef: ManagedProviderEndpointRef;
    executionCredential: ManagedExecutionCredential;
    model: {
        catalogEntryId?: string;
        rawModelId: string;
    };
    prompt: string;
    parameters: Record<string, unknown>;
    inputAssets: ManagedInputAssetRef[];
    clientContext: ManagedTaskClientContext;
};

export type ManagedGenerationTaskAccepted = {
    taskId: string;
    status: 'accepted' | 'queued';
    createdAt: string;
    updatedAt: string;
    statusUrl: string;
    eventsUrl?: string;
    resultUrl?: string;
    queue?: {
        position?: number;
        reason?: string;
    };
};

export type ManagedGenerationTaskStatusResponse = {
    taskId: string;
    status: ManagedTaskStatus;
    taskType: ManagedGenerationTaskType;
    clientTaskId?: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    completedAt?: string;
    expiresAt?: string;
    progress?: {
        phase?: string;
        percent?: number;
        queuePosition?: number;
        providerPollCount?: number;
        nextRetryAt?: string;
    };
    retryable: boolean;
    cancellable: boolean;
    attempt: number;
    maxAttempts: number;
    endpoint: {
        id: string;
        provider: string;
        protocol: string;
        baseUrlFingerprint: string;
    };
    model: {
        catalogEntryId?: string;
        rawModelId: string;
    };
    error?: ManagedTaskError;
    resultUrl?: string;
};

export type ManagedTaskResultManifest = {
    taskId: string;
    status: 'succeeded';
    outputs: Array<{
        id: string;
        kind: 'image' | 'video' | 'text' | 'thumbnail' | 'metadata';
        filename?: string;
        mimeType?: string;
        size?: number;
        width?: number;
        height?: number;
        durationSeconds?: number;
        sha256?: string;
        downloadUrl?: string;
        expiresAt?: string;
        inlineText?: string;
    }>;
    providerUsage?: Record<string, unknown>;
    providerRequestId?: string;
    completedAt: string;
    expiresAt?: string;
};

export type ManagedTaskEvent = {
    id: string;
    taskId: string;
    status: ManagedTaskStatus;
    createdAt: string;
    safeMessage?: string;
    safeDetails?: Record<string, unknown>;
};

export type TaskRecord = {
    taskId: string;
    idempotencyKey: string;
    requestHash: string;
    request: ManagedGenerationTaskRequest;
    status: ManagedTaskStatus;
    createdAt: string;
    updatedAt: string;
    startedAt?: string;
    completedAt?: string;
    expiresAt?: string;
    progress?: ManagedGenerationTaskStatusResponse['progress'];
    attempt: number;
    maxAttempts: number;
    retryable: boolean;
    cancellable: boolean;
    cancelRequested: boolean;
    activeRunId?: string;
    result?: ManagedTaskResultManifest;
    error?: ManagedTaskError;
    events: ManagedTaskEvent[];
};

export type MockTaskParameters = {
    delayMs?: number;
    providerDelayMs?: number;
    downloadDelayMs?: number;
    fail?: boolean;
    failUntilAttempt?: number;
    failCode?: Extract<ManagedTaskErrorCode, 'provider_failed' | 'provider_rate_limited'>;
    failMessage?: string;
};

export type ManagedTaskRetryPolicy = {
    enabled: boolean;
    maxAttempts: number;
    backoffMs: number;
    feeWarning: string;
};

export type ManagedTaskAdminVisibility = 'summary' | 'full';

export type ManagedTaskAdminSummary = {
    visibility: 'summary';
    taskId: string;
    status: ManagedTaskStatus;
    taskType: ManagedGenerationTaskType;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    attempt: number;
    maxAttempts: number;
    retryable: boolean;
    cancellable: boolean;
    endpoint: ManagedGenerationTaskStatusResponse['endpoint'];
    model: ManagedGenerationTaskStatusResponse['model'];
    credentialFingerprint: string;
    promptSummary: {
        sha256: string;
        length: number;
    };
    outputCount: number;
    errorCode?: ManagedTaskErrorCode;
};

export type ManagedTaskAdminDiagnostic = Omit<ManagedTaskAdminSummary, 'visibility'> & {
    visibility: 'full';
    prompt: string;
    parameters: Record<string, unknown>;
    inputAssets: ManagedInputAssetRef[];
    clientContext: ManagedTaskClientContext;
    providerEndpointRef: Omit<ManagedProviderEndpointRef, 'baseUrl'> & {
        baseUrl?: string;
    };
    executionCredential: Omit<ManagedExecutionCredential, 'keyEnvelope'> & {
        keyEnvelopeStored: boolean;
    };
    events: ManagedTaskEvent[];
    result?: Omit<ManagedTaskResultManifest, 'outputs'> & {
        outputs: Array<
            Omit<ManagedTaskResultManifest['outputs'][number], 'downloadUrl'> & { downloadUrlStored: boolean }
        >;
    };
};

export type ManagedTaskAuditEvent = {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
    metadata: Record<string, unknown>;
};
