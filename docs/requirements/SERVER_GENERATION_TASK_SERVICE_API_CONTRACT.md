# 服务端生成任务服务 API Contract

| 字段     | 内容                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日期     | 2026-06-11                                                                                                                                                        |
| 状态     | 已接受 (Accepted)                                                                                                                                                 |
| 版本     | `managed-generation-task/v1`                                                                                                                                      |
| 关联需求 | [服务端生成任务接管与独立任务服务需求文档](./SERVER_GENERATION_TASK_ORCHESTRATION_REQUIREMENTS.md)、[Phase 0 ADR](./SERVER_GENERATION_TASK_SERVICE_PHASE0_ADR.md) |
| 适用范围 | 当前 App 与独立任务服务之间的稳定 HTTP contract；不暴露 Hatchet 内部 API                                                                                          |

## 1. Contract 原则

- 当前 App 只调用任务服务 HTTP API，不 import 任务服务内部代码。
- 当前 App 不直接调用 Hatchet API，不依赖 Hatchet run id、workflow name、task event schema 或 Dashboard URL。
- P0 只允许 `image.generate` 和 `image.edit`。
- 任务服务必须支持幂等提交，避免移动端重试导致重复付费调用。
- 所有响应中的 Key、Authorization、下载 URL 签名源、完整本地路径、Hatchet payload 和 provider 原始请求头都必须脱敏或不返回。
- 时间字段使用 ISO 8601 UTC 字符串。
- 金额、token、provider usage 等不稳定字段放在 `providerUsage`，当前 App 不应依赖其结构。

## 2. 鉴权与通用 Header

当前 App 服务端、Tauri 桌面或受信任客户端访问任务服务时必须按部署策略携带鉴权。P0 推荐当前 App 服务端代理提交；静态桌面导出可在用户显式配置远端任务服务用户 token 后直连。

请求 Header：

```text
Authorization: Bearer <service_api_key_or_user_task_token>
X-Request-Id: <uuid>
X-Idempotency-Key: <stable-idempotency-key>
X-App-Instance-Id: <app-instance-id>
X-Timestamp: <iso-8601-utc>
Content-Type: application/json
```

任务服务必须校验时间窗口、鉴权、幂等键和重放风险。

## 3. 状态枚举

```typescript
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
```

`submitted` 可以只存在于当前 App 本地；任务服务持久化后至少返回 `accepted` 或 `queued`。

## 4. 错误模型

```typescript
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
```

`safeDetails` 不得包含明文 Key、Authorization、完整 prompt、下载 URL 签名源、用户本地路径或 provider 原始请求/响应。

## 5. 数据类型

### 5.1 Task Type

```typescript
export type ManagedGenerationTaskType = 'image.generate' | 'image.edit';
```

P0 请求若传入其他任务类型，任务服务必须返回 `unsupported_task_type`。

### 5.2 Provider Endpoint Ref

```typescript
export type ManagedProviderEndpointRef = {
    id: string;
    provider: string;
    protocol: string;
    baseUrl?: string;
    baseUrlFingerprint: string;
    displayName?: string;
};
```

`baseUrlFingerprint` 由当前 App 对 normalized base URL 生成，不泄漏完整私密配置。任务服务执行前仍必须对 `baseUrl` 做 SSRF/私网校验；缺少 `baseUrl` 时只能使用受信任端点引用或拒绝。

### 5.3 Execution Credential

```typescript
export type ManagedExecutionCredential = {
    mode: 'user-delegated' | 'admin-delegated';
    keyEnvelope: string;
    expiresAt: string;
    fingerprint: string;
    algorithm?: 'sealed-box-v1';
};
```

`keyEnvelope` 是短 TTL 加密 envelope 或一次性凭证引用，不是明文 Key。

### 5.4 Input Asset

```typescript
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
```

P0 `image.generate` 可以为空数组；`image.edit` 至少需要一个 `image`，mask 按模型能力决定。

### 5.5 Client Context

```typescript
export type ManagedTaskClientContext = {
    appInstanceId: string;
    clientTaskId: string;
    workspaceId?: string;
    source: 'web' | 'tauri-desktop' | 'tauri-mobile';
    locale?: string;
    userRef?: string;
};
```

`userRef` 必须是当前 App 可公开记录的稳定引用或匿名摘要，不得是邮箱、手机号、访问 token 或其他敏感标识。

## 6. 客户端任务 API

### 6.1 创建任务

```text
POST /v1/tasks
```

请求：

```typescript
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
```

响应：

```typescript
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
```

幂等语义：

- 相同 `idempotencyKey` 和等价请求体返回原 `taskId`。
- 相同 `idempotencyKey` 但请求体冲突返回 `409 idempotency_conflict`。
- 幂等记录至少保留到任务记录过期。

### 6.2 查询单个任务

```text
GET /v1/tasks/{taskId}
```

响应：

```typescript
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
```

### 6.3 批量查询

```text
POST /v1/tasks/query
```

请求：

```typescript
export type ManagedTaskQueryRequest = {
    taskIds: string[];
};
```

响应：

```typescript
export type ManagedTaskQueryResponse = {
    tasks: ManagedGenerationTaskStatusResponse[];
    missingTaskIds: string[];
    requestedAt: string;
};
```

P0 必须支持 100 个任务一次查询，当前 App 不应为 100 个 pending 任务发起 100 个请求。

### 6.4 取消任务

```text
POST /v1/tasks/{taskId}/cancel
```

请求：

```typescript
export type ManagedTaskCancelRequest = {
    reason?: string;
    clientTaskId?: string;
};
```

响应返回最新 `ManagedGenerationTaskStatusResponse`。已成功且结果已生成的任务通常不可取消。

### 6.5 手动重试

```text
POST /v1/tasks/{taskId}/retry
```

请求：

```typescript
export type ManagedTaskRetryRequest = {
    idempotencyKey: string;
    reason?: string;
};
```

响应返回新的或更新后的 `ManagedGenerationTaskAccepted`。P0 默认只允许用户手动重试失败且可重试的任务。

### 6.6 读取结果

```text
GET /v1/tasks/{taskId}/result
```

响应：

```typescript
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
```

P0 图片结果必须包含 `downloadUrl`、`mimeType`、`size` 和 `sha256`，方便当前 App 导入历史后做基本校验。

### 6.7 事件流

```text
GET /v1/tasks/{taskId}/events
```

P0 可先以 SSE 提供，当前 App 可降级到批量轮询。

事件：

```typescript
export type ManagedTaskEvent = {
    id: string;
    taskId: string;
    status: ManagedTaskStatus;
    createdAt: string;
    safeMessage?: string;
    safeDetails?: Record<string, unknown>;
};
```

## 7. 输入资产 API

P0 可以由当前 App 代传输入资产，也可以由任务服务提供简单上传入口。任务请求中不得内联大文件。

```text
POST /v1/assets/uploads
```

请求：

```typescript
export type ManagedAssetUploadCreateRequest = {
    filename?: string;
    mimeType: string;
    size: number;
    sha256?: string;
    purpose: 'task-input';
};
```

响应：

```typescript
export type ManagedAssetUploadCreateResponse = {
    uploadRef: string;
    uploadUrl?: string;
    method: 'app-proxy' | 'direct-put';
    expiresAt: string;
    maxBytes: number;
};
```

Phase 2 可先只实现 `app-proxy`，后续再加入对象存储预签名直传。

## 8. 管理 API

管理 API 只能由当前 App 后台服务端调用，普通浏览器客户端不得直接访问。

### 8.1 健康检查

```text
GET /v1/admin/health
```

响应：

```typescript
export type ManagedTaskServiceHealth = {
    status: 'ok' | 'degraded' | 'unavailable';
    version: string;
    schemaVersion: 'managed-generation-task/v1';
    checkedAt: string;
    dependencies: Array<{
        name: 'hatchet' | 'database' | 'asset-storage' | 'worker';
        status: 'ok' | 'degraded' | 'unavailable';
        safeMessage?: string;
    }>;
};
```

### 8.2 Capabilities

```text
GET /v1/admin/capabilities
```

响应：

```typescript
export type ManagedTaskServiceCapabilities = {
    schemaVersion: 'managed-generation-task/v1';
    serviceVersion: string;
    taskTypes: ManagedGenerationTaskType[];
    credentialModes: Array<'user-delegated' | 'admin-delegated'>;
    storage: {
        primary: 'local-filesystem';
        s3CompatibleAvailable: boolean;
        maxInputAssetBytes: number;
        maxOutputAssetBytes: number;
        defaultRetentionHours: number;
    };
    events: {
        sse: boolean;
        batchPolling: boolean;
        webhook: boolean;
    };
    limits: {
        maxBatchQueryTasks: number;
        maxQueuedTasksPerUser?: number;
        maxSubmittedTasksPerUserPerHour?: number;
    };
    diagnosticsUrl?: string;
};
```

### 8.3 队列摘要

```text
GET /v1/admin/queues
```

返回队列长度、运行中数量、失败率、端点限流摘要和 worker 摘要，所有字段必须脱敏。

### 8.4 任务摘要

```text
GET /v1/admin/tasks
GET /v1/admin/tasks/{taskId}
POST /v1/admin/tasks/{taskId}/cancel
POST /v1/admin/tasks/{taskId}/retry
```

普通管理员响应只返回脱敏摘要。超级管理员完整诊断必须要求额外权限，并记录审计。

### 8.5 策略测试

```text
POST /v1/admin/policies/test
```

任务服务可提供自身限流/容量策略测试；当前 App 的端点接管策略 resolver 仍属于当前 App。

### 8.6 服务密钥轮换

```text
POST /v1/admin/service-keys/rotate
```

任务服务负责自身 service key 生命周期。当前 App 后台只保存用于调用任务服务的密钥，不展示明文历史值。

## 9. 当前 App 本地关联记录

当前 App 需要独立保存 pending managed task 关联，不只依赖远端任务服务。

```typescript
export type ManagedTaskClientRecord = {
    managedTaskId: string;
    clientTaskId: string;
    taskServiceId: string;
    providerEndpointId: string;
    modelCatalogEntryId?: string;
    workspaceId?: string;
    taskType: ManagedGenerationTaskType;
    promptDigest: string;
    parameterDigest: string;
    createdAt: number;
    lastSyncedAt?: number;
    status: ManagedTaskStatus;
    resultImportedAt?: number;
    resultImportError?: string;
};
```

该记录是 Phase 4 当前 App 恢复、批量同步和结果导入的依据。

## 10. 兼容性要求

- 旧 direct/proxy 路径不依赖本 contract。
- 未配置任务服务或未命中接管策略时，当前 App 行为保持现状。
- 静态 Tauri 桌面导出不能依赖 Next API Route 执行 managed task；它只能访问远端任务服务或走 Tauri runtime helper。
- 当前 App 测试中可使用 mock HTTP 任务服务，但不得 import 独立任务服务内部实现。

## 11. Phase 0 验收结论

本 contract 覆盖 Phase 0 要求的 P0 范围、独立边界、状态映射、临时凭证、资产 manifest、管理 capabilities 和当前 App 本地关联记录。Phase 1/2 实现必须以此 contract 为外部边界；如实现发现缺口，必须先更新本文件和阶段报告。
