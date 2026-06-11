import type { GenerationExecutionMode, ManagedTaskResolvedExecutionMode } from '@/lib/managed-task-config';
import type { ModelTaskCapability, ProviderKind, ProviderProtocol } from '@/lib/provider-model-catalog';
import type { ProviderUsage } from '@/lib/provider-types';
import type {
    ImageBackground,
    ImageModeration,
    ImageOutputFormat,
    ImageQuality,
    ImageStorageMode
} from '@/types/history';

export type ManagedGenerationTaskType = 'image.generate' | 'image.edit';

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

export type ManagedTaskError = {
    code: string;
    message: string;
    retryable: boolean;
    safeDetails?: Record<string, unknown>;
    requestId?: string;
};

export type ManagedTaskEndpointDescriptor = {
    id: string;
    provider: ProviderKind | string;
    protocol: ProviderProtocol | string;
    apiBaseUrl?: string;
    name?: string;
};

export type ManagedTaskModelDescriptor = {
    catalogEntryId?: string;
    rawModelId: string;
    providerEndpointId?: string;
    provider?: ProviderKind | string;
    protocol?: ProviderProtocol | string;
    capabilities?: {
        tasks?: Array<ModelTaskCapability | string>;
    };
};

export type ManagedTaskInputAssetDescriptor = {
    kind: 'image' | 'mask' | 'video' | 'audio' | 'json';
    uploadRef: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    sha256?: string;
    width?: number;
    height?: number;
};

export type ManagedTaskClientSource = 'web' | 'tauri-desktop' | 'tauri-mobile';

export type ManagedTaskExecutionCredentialInput = {
    mode: 'user-delegated' | 'admin-delegated';
    apiKey?: string;
};

export type ManagedTaskResolveRequest = {
    taskType: ManagedGenerationTaskType;
    endpoint: ManagedTaskEndpointDescriptor;
    model: ManagedTaskModelDescriptor;
    defaultMode: Extract<GenerationExecutionMode, 'direct' | 'proxy'>;
    passwordHash?: string;
};

export type ManagedTaskResolveResponse = {
    mode: ManagedTaskResolvedExecutionMode;
    reason: string;
    policyId?: string;
    policyName?: string;
    taskServiceId?: string;
    taskServiceName?: string;
    fallbackMode?: string;
};

export type ManagedTaskSubmitHistoryInput = {
    mode: 'generate' | 'edit';
    model: string;
    n: number;
    size?: string;
    quality?: ImageQuality;
    outputFormat?: ImageOutputFormat;
    outputCompression?: number;
    background?: ImageBackground;
    moderation?: ImageModeration;
    imageStorageMode: ImageStorageMode | 'auto';
};

export type ManagedTaskSubmitRequest = {
    clientTaskId: string;
    idempotencyKey: string;
    taskType: ManagedGenerationTaskType;
    endpoint: ManagedTaskEndpointDescriptor;
    model: ManagedTaskModelDescriptor;
    defaultMode: Extract<GenerationExecutionMode, 'direct' | 'proxy'>;
    prompt: string;
    parameters: Record<string, unknown>;
    inputAssets: ManagedTaskInputAssetDescriptor[];
    credential: ManagedTaskExecutionCredentialInput;
    clientContext: {
        appInstanceId: string;
        workspaceId?: string;
        source: ManagedTaskClientSource;
        locale?: string;
    };
    historyInput: ManagedTaskSubmitHistoryInput;
    passwordHash?: string;
};

export type ManagedTaskAcceptedResponse = {
    accepted: true;
    managedTaskId: string;
    status: Extract<ManagedTaskStatus, 'accepted' | 'queued'>;
    createdAt: string;
    updatedAt: string;
    taskServiceId: string;
    taskServiceName: string;
    policyId?: string;
    policyName?: string;
};

export type ManagedTaskSubmitResponse =
    | ManagedTaskAcceptedResponse
    | {
          accepted: false;
          resolution: ManagedTaskResolveResponse;
      };

export type ManagedTaskStatusResponse = {
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

export type ManagedTaskQueryRequest = {
    tasks: Array<{
        managedTaskId: string;
        taskServiceId: string;
    }>;
    passwordHash?: string;
};

export type ManagedTaskQueryResponse = {
    tasks: ManagedTaskStatusResponse[];
    missingTaskIds: string[];
    requestedAt: string;
};

export type ManagedTaskImportRequest = {
    managedTaskId: string;
    taskServiceId: string;
    passwordHash?: string;
};

export type ManagedTaskImportedImage = {
    filename: string;
    b64_json: string;
    output_format: ImageOutputFormat;
    size?: number;
};

export type ManagedTaskImportResponse = {
    managedTaskId: string;
    completedAt?: string;
    expiresAt?: string;
    providerUsage?: ProviderUsage;
    images: ManagedTaskImportedImage[];
};

export type ManagedTaskRecordImportState = 'pending' | 'importing' | 'imported' | 'failed';

export type ManagedTaskHistoryParams = {
    mode: 'generate' | 'edit';
    model: string;
    n: number;
    size?: string;
    quality?: ImageQuality;
    outputFormat?: ImageOutputFormat;
    outputCompression?: number;
    background?: ImageBackground;
    moderation?: ImageModeration;
    imageStorageMode?: ImageStorageMode | 'auto';
};

export type ManagedTaskBatchMetadata = {
    batchId?: string;
    batchIndex?: number;
    batchTotal?: number;
    batchLabel?: string;
    batchInputImageId?: string;
    batchInputImageFilename?: string;
    batchInputImageRelativePath?: string;
    batchInputImageOrder?: number;
    batchVariantIndex?: number;
    batchVariantTotal?: number;
};

export type ManagedTaskClientRecord = {
    managedTaskId: string;
    clientTaskId: string;
    taskServiceId: string;
    taskServiceName?: string;
    providerEndpointId: string;
    modelCatalogEntryId?: string;
    rawModelId: string;
    workspaceId?: string;
    workspaceNameSnapshot?: string;
    taskType: ManagedGenerationTaskType;
    promptDigest: string;
    promptPreview: string;
    parameterDigest: string;
    historyParams: ManagedTaskHistoryParams;
    batch?: ManagedTaskBatchMetadata;
    createdAt: number;
    updatedAt: number;
    lastSyncedAt?: number;
    status: ManagedTaskStatus;
    importState: ManagedTaskRecordImportState;
    resultImportedAt?: number;
    resultImportError?: string;
    completedAt?: number;
};
