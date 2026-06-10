---
title: 服务端生成任务接管与独立任务服务需求文档
summary: 将现有“客户端直连 / 服务器中转”扩展为可按供应商端点开启的服务端任务接管模式；任务管理服务首版即作为独立项目和独立应用服务建设，底座选用 Hatchet，当前应用只保留配置接入、策略解析、状态同步和结果回灌能力。
createdAt: 2026-06-10
status: draft-requirement
relatedDocs:
    - ./UNIFIED_PROVIDER_CONFIGURATION_REUSE_REQUIREMENTS.md
    - ./VIDEO_GENERATION_REQUIREMENTS_v2.md
    - ./BATCH_IMAGE_GENERATION_REQUIREMENTS.md
    - ./CLOUD_SYNC_IMPROVEMENT_AND_PROTOCOL_EXPANSION.md
    - ./PROJECT_HEALTH_REFACTOR_REQUIREMENTS.md
---

# 服务端生成任务接管与独立任务服务需求文档

## 1. 背景与目标

当前生成任务主要在两个模式之间切换：

1. **服务器中转**：客户端把请求交给当前 Web 服务，由 Next API Route 或 Tauri Rust proxy 代为访问供应商。
2. **客户端直连**：浏览器或桌面端直接访问供应商端点，适合自带 Key、低服务器成本、规避共享部署流量压力的场景。

这两种模式仍然把“任务生命周期”绑定在当前客户端页面或当前 Web 请求上。移动端切后台、浏览器断网、页面刷新、设备休眠、代理超时、长耗时视频任务等场景，都会导致用户感知上的任务中断或状态丢失。

本需求提出第三种运行方式：

> **服务端任务接管**：用户只提交生成意图，当前应用根据后台配置把指定 `baseUrl` / `ProviderEndpoint` 的任务交给独立任务服务。任务服务负责排队、调用供应商、轮询、重试、保存结果、暴露状态。用户关闭页面或网络断开后，任务仍继续执行；下次打开页面或重连后可以同步任务状态和结果。

核心目标：

- 降低移动端、弱网络、长耗时任务导致的生成失败。
- 按端点精细配置任务接管，不强制所有供应商都走同一种模式。
- 任务管理服务首版即作为**单独项目 / 单独应用服务**建设，不做内嵌同进程适配层，避免后续再从当前项目中拆分。
- 当前应用只保留任务服务配置接入、端点接管策略解析、任务状态同步和结果回灌；队列、worker、重试、资产保存和容量治理由独立任务服务负责。
- 优先评估可自托管的开源任务/工作流底座；如果已有底座能满足可靠性、并发、观测和部署要求，则在独立任务服务项目中基于它构建领域层，避免重复造轮子。
- 任务管理服务可以独立部署、扩容、限流和熔断，避免被任务高并发拖垮当前 Web 服务。
- 当前应用后台可管理任务服务链接、鉴权、容量摘要、端点接管策略和观测入口。
- 保持现有客户端直连、服务器中转、Tauri 桌面路径继续可用，不把三种模式混成一条不可控路径。

## 2. 当前代码事实

| 事实                                       | 现状                                                                                                                          | 对本需求的影响                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 应用配置已有 `connectionMode` 二值模式     | `src/lib/config.ts` 中 `AppConfig.connectionMode` 默认 `proxy`，类型当前只覆盖同步中转和客户端直连。                          | 新增任务接管不能直接复用二值字段，需要引入更明确的运行策略。                              |
| 统一端点主数据已存在                       | `ProviderEndpoint` 包含 `id`、`provider`、`apiKey`、`apiBaseUrl`、`protocol`；`ModelCatalogEntry` 关联 `providerEndpointId`。 | 任务接管配置应绑定 `ProviderEndpoint.id`，同时支持按 normalized `apiBaseUrl` 做规则匹配。 |
| 图片与图生文任务仍是客户端内存队列         | `useTaskManager` 用 React state/ref 保存队列和参数，刷新后运行中任务不可恢复。                                                | 任务服务要提供持久化任务 ID、状态查询和结果恢复。                                         |
| 图片服务器中转是同步请求                   | `/api/images` 在一次请求内访问供应商并返回结果或流式事件。                                                                    | 长耗时任务不应继续依赖单个 HTTP 请求生命周期。                                            |
| 视频已有异步 job 雏形                      | `video-types.ts` 定义 `VideoGenerationJob`，`video-executor.ts` 有 submit/poll/download/cancel。                              | 可复用视频任务思想，但要扩展为跨图片、图生文、视频的通用任务接管协议。                    |
| 视频 Web proxy 仍由当前 App 直接代调供应商 | `/api/video/create` 接收完整 endpoint，校验 Base URL 后调用 adapter。                                                         | 新任务服务应避免把原始端点和密钥无限制透传到公共接口。                                    |
| 后台管理已有认证、角色、审计基础           | `src/app/admin/*`、`requireAdminApi`、`auditLogs` 已存在。                                                                    | 任务服务配置应归入后台管理和审计，不放在普通用户本地设置里。                              |
| URL 安全校验已有公共 helper                | `validatePublicHttpBaseUrl` 会阻止 localhost、私网、链路本地、保留地址等。                                                    | 任务服务地址、供应商 Base URL、结果回调 URL 都必须继承同等级别安全约束。                  |

## 3. 产品视角需求

### 3.1 用户价值

- 用户点击生成后，页面可以关闭、刷新或网络断开，任务仍继续。
- 页面重连后能看到“排队中 / 执行中 / 供应商处理中 / 下载结果中 / 已完成 / 失败可重试”等状态。
- 任务完成后，结果自动进入当前工作台、历史和对应工作空间；若用户稍后再打开，也能从任务中心找回。
- 弱网络下客户端只承担提交、查看状态、读取结果，不再长时间持有大请求。
- 批量任务可以先全部提交给任务服务，再由任务服务按后台容量策略执行。

### 3.2 管理员价值

- 管理后台可以配置一个或多个任务服务实例。
- 管理后台可以针对特定端点、特定 `baseUrl`、特定供应商协议或特定模型开启任务接管。
- 管理员可以设置最大并发、队列长度、每用户/每 IP/每端点配额、单任务超时、重试策略、结果保存时长和熔断策略。
- 任务服务可以单独部署和扩容；任务服务不可用时，当前 Web 服务仍能继续提供客户端直连或普通中转。
- 管理员可以看到任务服务健康状态、队列压力、失败率、供应商错误分布和最近任务审计。

### 3.3 产品边界

首版不做“全托管平台”：

- P0 先按单部署实例处理，不引入多租户计费系统；后续模式跑通后再扩展租户隔离和计费能力。
- 允许用户本地供应商 Key 在“本次任务”维度临时委托给任务服务作为执行凭证，但任务服务不得持久化用户 Key；每次任务执行都必须显式传入端点和 Key 引用或密文参数。
- 不把所有任务强制迁移到任务服务；客户端直连和普通服务器中转仍保留。
- 不要求静态 Tauri 桌面包内置任务服务；桌面端只需要能连接已配置的远端任务服务。
- 不支持“内嵌同进程适配层”作为首版部署形态，也不把 worker、队列、provider adapter 作为当前项目内部 package 交付。
- 当前管理后台不是任务服务的完整管理后台，只负责配置接入、策略绑定、健康摘要和跳转诊断；任务执行详情、worker、队列和底层运行状态由独立任务服务自身提供。

## 4. 运行模式定义

建议把任务运行模式从二值 `connectionMode` 扩展为更明确的策略。

| 模式           | 建议标识       | 执行位置                               | 生命周期                     | 适用场景                                     |
| -------------- | -------------- | -------------------------------------- | ---------------------------- | -------------------------------------------- |
| 客户端直连     | `direct`       | 浏览器 / Tauri WebView                 | 页面或桌面进程持有           | 用户自带 Key、供应商 CORS 可用、低服务器成本 |
| 当前服务中转   | `proxy`        | 当前 Next API Route / Tauri Rust proxy | 单次 HTTP 请求或本地命令持有 | 短任务、规避 CORS、当前服务有能力承载        |
| 服务端任务接管 | `managed-task` | 独立任务服务                           | 持久化任务服务持有           | 长耗时、弱网络、移动端、批量、高可靠任务     |
| 自动策略       | `auto`         | 按后台策略决策                         | 根据任务类型与端点切换       | 管理员希望统一配置，用户少做选择             |

普通用户 UI 可以继续展示“客户端直连 / 服务器中转”这种易懂表达，但内部需要区分：

- “服务器中转（同步）”：请求仍由当前 Web 服务立即执行。
- “服务端任务接管（异步）”：请求提交给任务服务，返回 `managedTaskId` 后进入同步状态。

## 5. 端点接管策略

### 5.1 绑定粒度

任务接管策略必须至少支持四层匹配，优先级从高到低：

1. **模型级**：`ModelCatalogEntry.id`，例如只接管某个视频模型。
2. **端点级**：`ProviderEndpoint.id`，例如只接管“公司网关 A”。
3. **Base URL 级**：normalized `apiBaseUrl`，例如所有 `https://gateway.example.com/v1` 都接管。
4. **协议 / 供应商级**：`protocol`、`provider`，例如所有 `openai-videos` 任务接管。

如果多个规则命中，使用“最具体规则优先”。管理员后台必须展示最终生效规则，避免配置后用户不知道为什么某个端点走了任务服务。

### 5.2 建议数据结构

```typescript
export type GenerationExecutionMode = 'direct' | 'proxy' | 'managed-task' | 'auto';

export type ManagedTaskTakeoverPolicy = {
    id: string;
    name: string;
    enabled: boolean;
    priority: number;
    match: {
        providerEndpointIds?: string[];
        normalizedBaseUrls?: string[];
        providerKinds?: string[];
        providerProtocols?: string[];
        modelCatalogEntryIds?: string[];
        taskCapabilities?: string[];
    };
    mode: GenerationExecutionMode;
    taskServiceId?: string;
    fallbackMode: 'proxy' | 'direct' | 'fail-closed' | 'ask-user';
    limits?: {
        maxSubmittedTasksPerUserPerHour?: number;
        maxQueuedTasksPerUser?: number;
        maxInputAssetBytes?: number;
        maxOutputAssetBytes?: number;
        timeoutSeconds?: number;
    };
    createdAt: number;
    updatedAt: number;
};
```

`ProviderEndpoint` 本身可以保留纯供应商连接信息，不建议把所有任务服务字段硬塞进端点结构。更好的方式是新增“任务接管策略”表，通过 endpoint id / baseUrl / model id 关联。

## 6. 独立任务服务架构

### 6.1 模块边界

```text
Browser / Tauri
  -> Current App (Next.js / static desktop shell)
      -> Runtime strategy resolver
      -> Managed task client
      -> History / workspace / local asset bridge
      -> Admin UI for policy and service config
          -> Managed Task Service (separate deployable module)
              -> Auth & tenant boundary
              -> Persistent queue
              -> Worker pool
              -> Provider adapters
              -> Poller / retry scheduler
              -> Result asset storage
              -> Webhook / status API
              -> Metrics / audit logs
```

当前 App 不应该直接承担高并发队列和 worker 池职责，也不应该把任务服务作为同进程模块加载。它负责：

- 根据配置判断某个任务是否需要接管。
- 把用户提交转成标准 `ManagedGenerationTaskRequest`。
- 将请求提交给任务服务并保存本地关联。
- 轮询或订阅任务状态。
- 在任务完成后拉取结果，写入历史、工作空间和资产库。

独立任务服务负责：

- 接收任务、持久化任务、返回稳定任务 ID。
- 管理队列、并发、重试、超时、取消、过期。
- 调用供应商 API，包括同步图片任务、异步视频任务和后续批量任务。
- 将结果资产保存到配置的对象存储或服务本地存储。
- 对外暴露状态、结果下载、诊断和管理 API。

### 6.2 独立项目边界

任务管理服务必须作为单独项目建设，例如独立仓库或独立 package workspace，但不能作为当前 Next.js 应用的内部模块交付。边界要求：

- 独立代码库、独立依赖树、独立构建、独立 Docker 镜像。
- 独立数据库迁移和运行时配置，不复用当前项目的 SQLite schema 或前端配置对象。
- 独立 HTTP API / SDK contract，当前 App 只能通过稳定 API 调用，不直接 import 任务服务内部代码。
- 独立管理控制台或至少独立管理 API，负责 worker、队列、任务详情、底层日志、运行指标和任务服务自身密钥轮换。
- 当前 App 后台只保留接入配置：任务服务地址、鉴权密钥、健康检查、能力摘要、端点接管策略和诊断入口。
- 当前 App 与任务服务版本通过 `/v1/admin/capabilities` 做能力协商，避免两个项目发布节奏互相锁死。

这条边界是 P0 硬约束。不得先做内嵌版本再计划未来拆分，因为拆分会把当前项目的依赖、配置、数据库、日志和业务假设带入任务服务，削弱它作为通用应用服务的价值。

### 6.3 部署形态

首版只支持独立部署形态：

| 形态                 | 说明                                                                                    | 推荐场景                                 |
| -------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| 单节点独立任务服务   | `gpt-image-task-service` 作为独立服务部署，内含 API、队列、worker、结果资产存储适配器。 | P0、自托管、小团队、低到中等并发。       |
| 分布式任务服务集群   | API 节点、队列/工作流底座、数据库、worker 节点、对象存储分离。                          | 高并发、批量任务、多人共用部署。         |
| 本机独立进程开发形态 | 开发环境可在本机启动任务服务，但仍通过 HTTP 访问，不能 import 当前 App 代码。           | 本地开发、调试和桌面端连接本机任务服务。 |

任务服务被压垮时，当前 App 必须能继续响应首页、设置、历史、客户端直连和普通中转。任务服务健康检查失败时，策略按 `fallbackMode` 处理。

不支持的形态：

- 当前 App 同进程内嵌 worker。
- 当前 App API Route 内直接运行持久队列。
- 当前 App 内部 package 暴露任务服务核心代码。
- Tauri 桌面包内置任务服务作为默认执行路径。

### 6.4 开源底座选型结论

任务接管服务不应从零实现队列、重试、worker 调度和观测。基于 2026-06-10 对 Hatchet、Trigger.dev、Temporal、BullMQ 的调研，P0 底座决策为：

> **独立任务服务底座选用 Hatchet。**

Hatchet 只作为独立任务服务的内部任务编排底座，不能改变当前 App 与任务服务之间的 HTTP contract。当前 App 不直接调用 Hatchet API、不 import Hatchet SDK、不感知 Hatchet task/run/workflow 细节，只调用任务服务暴露的稳定领域 API：`/v1/tasks`、`/v1/tasks/query`、`/v1/tasks/{id}/result`、`/v1/admin/capabilities`。

| 候选        | 结论                   | 原因                                                                                                                         | 后续定位                                                                                   |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Hatchet     | P0 选定底座            | 面向 background tasks、durable workflows、AI agents；支持自托管、任务持久化、自动重试、实时监控、日志、并发、限流和 worker。 | 作为独立任务服务内部编排底座；领域层仍需自建端点策略、供应商 adapter、资产保存和结果回灌。 |
| Trigger.dev | 备选 / 对照            | TypeScript-first、Realtime 和 AI workflow 体验强。                                                                           | 如果 Hatchet PoC 失败或后续需要更强前端 Realtime 工作流体验，再作为第二候选。              |
| Temporal    | 高可靠复杂工作流储备   | durable execution 成熟度最高，适合复杂长流程和补偿工作流。                                                                   | 当前 P0 不采用；后续任务复杂度显著提升时重新评估。                                         |
| BullMQ      | 自研最小服务时的队列核 | Node.js + Redis 队列成熟轻量。                                                                                               | 当前 P0 不采用；仅在放弃完整任务底座、转自研最小服务时作为队列层候选。                     |

Hatchet 接入验证不再是“是否选择底座”的开放决策，而是 P0 实施的前置验收项。独立任务服务项目仍必须输出 ADR，记录以下内容：

1. 选用 Hatchet 的版本、授权、部署形态和运行依赖。
2. Hatchet task/workflow 与本需求领域状态机的映射。
3. 用户临时 Key 委托时的执行凭证传递方式，确保 Key 不以明文写入 Hatchet durable payload、日志或事件。
4. 端点级并发、动态限流、worker slots、重试和失败策略如何映射到 Hatchet。
5. 结果资产本地文件系统与后续 S3 兼容存储如何在任务服务领域层实现。
6. Hatchet Dashboard 与任务服务自有管理 API/UI 的职责边界。

Hatchet 接入 PoC 验收问题：

1. worker 进程崩溃后任务可恢复，且不会重复执行已完成的付费供应商调用。
2. 可按端点、模型、用户维度做并发和限流。
3. 可批量查询 100+ 任务状态，并由任务服务领域 API 返回稳定状态。
4. 可保存任务事件流和错误，但不泄漏 prompt 全量、Key、Authorization、下载 URL 等敏感数据。
5. 可把结果资产保存到任务服务本地文件系统并返回 manifest；S3 兼容存储接口有清晰扩展点。
6. 可独立部署、升级和回滚，不影响当前 App。
7. P0 关键能力可由 Hatchet 开源版和自建领域层满足，不把核心路径锁进商业版。

参考入口：

- Hatchet: <https://docs.hatchet.run/>
- Hatchet self-hosting: <https://docs.hatchet.run/self-hosting>
- Trigger.dev self-hosting: <https://trigger.dev/docs/self-hosting/overview>
- Temporal self-hosted guide: <https://docs.temporal.io/self-hosted-guide>
- BullMQ: <https://docs.bullmq.io/>

## 7. 任务生命周期

### 7.1 状态机

```text
draft -> submitted -> accepted -> queued -> running -> provider_processing
    -> downloading_result -> succeeded -> retained -> expired
                         \-> failed
                         \-> cancelling -> cancelled
                         \-> retry_scheduled -> queued
```

状态含义：

| 状态                  | 含义                                        | 用户可见行为                         |
| --------------------- | ------------------------------------------- | ------------------------------------ |
| `submitted`           | 客户端已提交，等待任务服务确认。            | 显示“正在提交”。                     |
| `accepted`            | 任务服务已持久化，返回稳定 ID。             | 断网后仍可恢复。                     |
| `queued`              | 等待 worker 空位。                          | 显示队列位置或估算等待。             |
| `running`             | worker 已开始处理。                         | 显示已开始。                         |
| `provider_processing` | 供应商异步处理中。                          | 显示供应商进度、轮询次数或阶段信息。 |
| `downloading_result`  | 任务服务正在拉取供应商临时 URL 或保存资产。 | 显示“正在保存结果”。                 |
| `succeeded`           | 结果可读取。                                | 客户端拉取结果并写入历史。           |
| `failed`              | 最终失败。                                  | 显示可读错误、是否可重试。           |
| `cancelled`           | 用户或系统取消。                            | 保留取消记录。                       |
| `expired`             | 结果或任务记录超过保留期。                  | 显示过期，不再重试。                 |

### 7.2 客户端恢复

客户端提交后必须在本地保存：

- `managedTaskId`
- `clientTaskId`
- `providerEndpointId`
- `modelCatalogEntryId`
- `workspaceId`
- prompt 摘要和参数摘要
- 创建时间、最后同步时间
- 任务服务 ID
- 结果历史写入状态

恢复策略：

1. 页面启动或网络恢复时，读取本地 pending managed tasks。
2. 按任务服务分组批量查询状态。
3. 对 `succeeded` 且本地未导入结果的任务，拉取 result manifest。
4. 将结果写入现有图片历史、图生文历史、视频历史或工作空间。
5. 对任务服务已过期但本地没有结果的任务，显示“结果已过期”并保留可重试入口。

## 8. 任务服务 API 草案

### 8.1 客户端任务 API

```text
POST   /v1/tasks
GET    /v1/tasks/{taskId}
POST   /v1/tasks/query
POST   /v1/tasks/{taskId}/cancel
POST   /v1/tasks/{taskId}/retry
GET    /v1/tasks/{taskId}/result
GET    /v1/tasks/{taskId}/events
```

`/v1/tasks` 请求体：

```typescript
export type ManagedGenerationTaskRequest = {
    idempotencyKey: string;
    taskType: 'image.generate' | 'image.edit';
    providerEndpointRef: {
        id: string;
        provider: string;
        protocol: string;
        baseUrl?: string;
        baseUrlFingerprint: string;
    };
    executionCredential: {
        mode: 'user-delegated' | 'admin-delegated';
        keyEnvelope: string;
        expiresAt?: string;
        fingerprint?: string;
    };
    model: {
        catalogEntryId?: string;
        rawModelId: string;
    };
    prompt: string;
    parameters: Record<string, unknown>;
    inputAssets: Array<{
        kind: 'image' | 'mask' | 'video' | 'audio' | 'json';
        uploadRef: string;
        filename?: string;
        mimeType?: string;
        size?: number;
        sha256?: string;
    }>;
    clientContext: {
        appInstanceId: string;
        workspaceId?: string;
        source: 'web' | 'tauri-desktop' | 'tauri-mobile';
        locale?: string;
    };
};
```

P0 首批实际允许的 `taskType` 只有 `image.generate` 和 `image.edit`。图生文、视频、批量任务先放到后续阶段；后续扩展必须通过新的 capabilities 声明、任务服务版本协商和需求文档更新进入协议，当前 App 不得向未启用任务类型提交任务。

`executionCredential` 是本次任务执行凭证，不是任务服务的长期配置。无论来自用户本地 Key 还是管理员托管端点 Key，每次执行任务时都必须随任务提交传入端点和执行凭证；任务服务不得持久化明文 Key。实现上应优先使用短 TTL 加密 envelope、内存凭证缓存或 worker handoff，Hatchet durable payload 中只保存引用、密文 envelope、fingerprint 和过期时间，不能保存明文 Key。

响应体：

```typescript
export type ManagedGenerationTaskAccepted = {
    taskId: string;
    status: 'accepted' | 'queued';
    createdAt: string;
    statusUrl: string;
    eventsUrl?: string;
    resultUrl?: string;
};
```

### 8.2 管理 API

```text
GET    /v1/admin/health
GET    /v1/admin/capabilities
GET    /v1/admin/queues
GET    /v1/admin/tasks
GET    /v1/admin/tasks/{taskId}
POST   /v1/admin/tasks/{taskId}/cancel
POST   /v1/admin/tasks/{taskId}/retry
POST   /v1/admin/policies/test
POST   /v1/admin/service-keys/rotate
```

管理 API 只能由当前 App 后台调用，普通浏览器客户端不得直接访问。

### 8.3 事件通道

任务状态同步首选顺序：

1. **SSE**：`GET /v1/tasks/{taskId}/events`，适合 Web 和桌面，简单可代理。
2. **批量轮询**：`POST /v1/tasks/query`，适合移动端恢复、后台切前台。
3. **Web Push / native notification**：后续可选，不作为 P0。
4. **Webhook 回调当前 App**：仅在当前 App 可公网访问且配置签名密钥时启用。

P0 不能只依赖 WebSocket，因为移动端后台、代理和 serverless 环境稳定性更差。

## 9. 输入与结果资产

### 9.1 输入资产

图片编辑、视频图生视频、批量任务会携带图片或 mask。任务接管不能把大文件直接塞进 JSON。

推荐流程：

1. 客户端向当前 App 申请上传凭证或由当前 App 代传到任务服务。
2. 任务服务返回 `uploadRef`。
3. 客户端提交任务时只引用 `uploadRef`。
4. 任务服务按大小、类型、SHA-256、图片尺寸做校验。

P0 可以先支持当前 App 代传，后续再支持预签名直传到对象存储。

### 9.2 结果资产

结果资产首选存储在**独立任务服务的本地文件系统**，不得写入当前 App 所在文件系统。任务服务应拥有自己的资产根目录、保留策略、清理任务、容量上限和下载授权策略。当前 App 只读取任务服务返回的 manifest 和受控下载 URL，不直接管理任务服务的文件目录。

后续必须支持 S3 兼容对象存储，例如 S3、R2、MinIO 或其他兼容服务。对象存储 endpoint、bucket、region、access key、secret key、path prefix、public/private 下载模式、签名 URL 过期时间等基础配置属于任务服务专有配置，应由任务服务自身管理 UI/API 可视化配置。当前 App 只能读取封装后的能力摘要、健康状态和结果 manifest，避免在当前 App 下管理托管服务内部基础设施。

任务服务完成后返回 result manifest：

```typescript
export type ManagedTaskResultManifest = {
    taskId: string;
    status: 'succeeded';
    outputs: Array<{
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
};
```

客户端拿到 manifest 后：

- 图片结果写入现有图片历史。
- 图生文结果写入图生文历史。
- 视频结果写入视频历史和视频资产存储。
- 如果结果 URL 有过期时间，客户端必须尽快导入到本地资产或云同步资产。

## 10. 后台配置需求

### 10.1 任务服务配置页

后台新增“任务服务”管理页，支持：

- 服务名称、服务 URL、启用状态。
- 鉴权方式：服务端 API Key、mTLS 预留、HMAC 签名。
- 健康检查路径和超时时间。
- 默认结果保留时长。
- 是否允许当前 App 把用户本地端点密钥委托给任务服务。
- 是否允许任务服务读取管理员托管端点密钥。
- 连接测试、能力读取、队列压力读取。
- 最近错误、最近健康检查时间、版本号、capabilities。

任务服务配置页只管理当前 App 对任务服务的接入信息，不管理任务服务内部基础设施。任务服务自己的 Hatchet 连接、worker、存储、资产目录、S3 兼容存储、保留清理、provider adapter 运行参数等，应在任务服务自身管理界面/API 中配置。当前 App 最多展示任务服务通过 `/v1/admin/capabilities` 暴露的只读摘要和诊断入口。

任务服务 URL 必须通过 `validatePublicHttpBaseUrl` 同等级别校验，默认不允许 localhost、私网、链路本地、保留地址。开发环境如需本地任务服务，应通过显式 dev-only 开关，并在生产构建拒绝。

### 10.2 端点任务接管页

在供应商端点管理或独立策略页中提供：

- 对指定端点开启 / 关闭任务接管。
- 对同一 baseUrl 批量开启 / 关闭任务接管。
- 选择任务服务实例。
- 设置生效任务类型：P0 仅图片生成、图片编辑；图生文、视频、批量先保留为后续能力，不在 P0 开启。
- 设置 fallback：任务服务不可用时失败、询问用户、回退同步中转、回退直连。
- 显示命中的策略来源与优先级。
- 显示此端点是否会把 API Key 以“本次执行凭证”临时委托给任务服务，以及该凭证不会被任务服务持久化存储。

### 10.3 容量与安全配置

后台必须能配置：

- 全局最大并发。
- 每端点最大并发。
- 每模型最大并发。
- 每用户最大运行中任务数。
- 每用户每小时提交数。
- 每 IP 提交数。
- 队列最大长度和超过后的行为。
- 单任务最大执行时间。
- 输入资产大小上限。
- 结果资产大小上限。
- 失败自动重试开关、重试次数、退避策略。
- 供应商 429 / 5xx 熔断阈值。
- 任务记录和结果资产保留期。

这些配置要有安全默认值。缺失或非法值必须 normalize 到保守配置，不得无限并发。自动重试默认关闭或保守开启；管理后台启用自动重试时必须显示明确警告：自动重试会再次调用供应商，可能产生额外供应商费用，并可能消耗用户额度或 Key 余额。

## 11. 安全与隐私要求

### 11.1 密钥边界

任务接管涉及三类密钥：

| 密钥                    | 存放位置                                        | 要求                                                                                          |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 用户本地供应商 Key      | 用户设备 localStorage / Tauri keychain 后续能力 | 允许在本次任务维度临时委托给任务服务作为执行凭证；任务服务不得持久化明文 Key。                |
| 管理员托管端点 Key      | 当前 App server secret 或后台加密存储           | 由当前 App 服务端按策略解密，再作为本次任务执行凭证传给任务服务；任务服务不得持久化明文 Key。 |
| 当前 App 到任务服务 Key | 当前 App server secret                          | 只能服务端持有，不能进入浏览器 bundle 或分享链接。                                            |

P0 明确允许“用户本地 Key 临时委托”和“管理员托管端点临时委托”两种执行凭证来源。原因是：当管理员已针对特定可信端点开启任务接管后，任务服务必须拿到可执行供应商请求的端点与 Key，否则无法替用户完成生成任务。此时 Key 是任务执行凭证，不是任务服务长期配置。

执行凭证要求：

- 每次执行任务都必须把端点与执行凭证作为任务参数的一部分传入任务服务。
- 任务服务不得把用户本地 Key 或管理员端点 Key 作为长期配置保存。
- 任务服务不得把明文 Key 写入 Hatchet payload、数据库、日志、事件流、错误堆栈、metrics label、导出诊断包或管理后台列表。
- 任务服务可保存短 TTL 的加密 envelope、凭证引用、fingerprint、过期时间和审计摘要，用于 worker 执行与幂等恢复。
- 后续如果项目出现自己的用户体系，可以只支持管理员托管端点；但执行模型仍保持一致：任务执行时传入的是管理员指定端点和 Key 的短期执行凭证，而不是让任务服务永久托管任意用户 Key。

### 11.2 请求签名

当前 App 调任务服务时必须带：

- `Authorization: Bearer <service_api_key>` 或 HMAC 签名。
- `X-Request-Id`
- `X-Idempotency-Key`
- `X-App-Instance-Id`
- `X-Timestamp`

任务服务需校验时间窗口、签名、重放和幂等。所有任务创建必须支持 idempotency，避免移动端重试导致重复扣费。

### 11.3 SSRF 与 URL 安全

必须继续沿用并加强现有 URL 安全策略：

- 任务服务 URL 不允许私网、localhost、链路本地、metadata 地址。
- 供应商 Base URL 在当前 App 后台保存和任务服务执行前都要校验。
- 结果下载 URL 只能由任务服务按 allowlist 或供应商响应上下文读取，不允许用户任意提交 URL 让任务服务下载。
- Webhook callback URL 默认关闭，开启时必须校验公开 HTTPS origin 和签名。
- 不能把 provider 原始错误、请求头、Authorization、完整 prompt 或用户文件路径写入公开日志。

### 11.4 数据保留

- prompt、输入资产、输出资产保留期可配置。
- 管理员可选择“只保留任务元数据，不保留输入资产”。
- 删除任务时需要区分“删除客户端关联”“删除任务服务记录”“删除结果资产”。
- 任务服务导出诊断包时必须脱敏 prompt、Key、下载 URL 和用户标识。

### 11.5 管理员可见性

任务服务和当前 App 后台都必须区分普通管理员与超级管理员的可见性：

| 角色       | 可见范围                                                                                              | 脱敏要求                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 普通管理员 | 任务 ID、端点摘要、模型、状态、耗时、错误分类、费用风险提示、Key fingerprint、prompt 摘要、资产摘要。 | 必须脱敏 prompt 全量、Key、Authorization、下载 URL、用户本地路径和供应商原始请求/响应。      |
| 超级管理员 | 可查看完整任务诊断信息，用于排障、审计和合规处理。                                                    | 不对超级管理员做强制脱敏，但所有查看行为必须记录审计日志。Key 明文仍不应出现在持久化日志中。 |

如果任务服务自身提供管理 UI，必须实现同等角色边界。当前 App 只展示任务服务封装后的摘要信息和诊断入口，不复制任务服务的完整管理面。

## 12. 压力、容量与降级

### 12.1 最大压力场景

设计时必须覆盖：

- 批量一次提交 100+ 图片任务。
- 多用户同时提交视频长任务。
- 供应商 429 导致大量重试。
- 任务服务本地文件系统或后续对象存储写入慢。
- 当前 App 与任务服务之间网络抖动。
- 任务服务 worker 被压满但 API 节点仍可响应。
- 任务服务完全不可用。

### 12.2 限流与熔断

任务服务必须实现：

- API 层限流：按 service key、用户、IP、端点。
- 队列层限流：超过队列长度直接拒绝或延迟接收。
- Worker 并发：按端点/模型/供应商分桶。
- 供应商熔断：429/5xx 达阈值时暂停对应端点，并把任务转为 `retry_scheduled` 或 `failed_retryable`。
- 结果下载限速：避免大量完成任务同时拉取大文件。

当前 App 必须实现：

- 任务服务健康检查缓存。
- 任务服务不可用时按 `fallbackMode` 降级。
- 状态轮询退避。
- 批量状态查询合并，避免 N 个任务触发 N 个请求。

### 12.3 压垮隔离

任务服务被压垮时，不应影响：

- 首页加载。
- 本地配置和历史查看。
- 客户端直连生成。
- 普通服务器中转生成。
- 后台登录和配置。

当前 App 与任务服务之间必须有短超时和断路器，不允许用户请求被任务服务健康检查拖死。

## 13. Web、Tauri 与移动端行为

| Runtime                | P0 行为                                                                                     | 后续增强                                    |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Web                    | 通过当前 App API 提交任务接管；页面恢复后批量查询任务状态。                                 | SSE 实时事件、浏览器通知。                  |
| Tauri Desktop          | 通过共享 TypeScript client 访问任务服务；外链、下载和本地文件保存继续走 `desktop-runtime`。 | Tauri keychain 保存任务服务用户委托 token。 |
| Tauri Mobile / Android | 优先使用任务接管，减少后台断连影响；App 前台恢复时同步状态。                                | 系统通知、后台 fetch 能力。                 |
| 静态桌面导出           | 不依赖 Next API Route 执行任务，只访问远端任务服务或走 Tauri Rust proxy。                   | 支持本地 sidecar 任务服务。                 |

## 14. 与现有功能关系

### 14.1 图片生成与编辑

P0 优先接入图片生成与图片编辑：

- 可以立即缓解移动端和弱网络问题。
- 现有 `/api/images` 同步中转逻辑可作为 worker adapter 的参考。
- 需要补齐输入资产上传、结果 manifest、历史导入。

### 14.2 图生文

图生文通常耗时较短，但多图 OCR、结构化输出和弱网络仍有价值。P1 接入：

- 保留 text result。
- 支持 streaming 文本退化为阶段状态，不要求断线后恢复每个 token。

### 14.3 视频

视频天然是异步任务，适合作为任务接管的重点：

- 现有 `VideoGenerationJob`、submit/poll/download/cancel 可作为协议基础。
- 任务服务可统一承担 provider polling，客户端不再长时间轮询供应商。
- 结果 URL 往往临时有效，任务服务应先保存到结果资产存储。

### 14.4 批量任务

批量任务不应在客户端一次性展开后全部由浏览器运行。接入任务服务后：

- 客户端仍可保留批量预览和确认。
- 确认后创建一个 `batchId`，每个子任务进入任务服务。
- 任务服务负责并发、失败重试和批次聚合状态。
- 客户端任务面板按批次显示完成率。

## 15. 数据模型建议

当前 App 后台数据库建议新增：

```text
managed_task_services
managed_task_takeover_policies
managed_task_endpoint_bindings
managed_task_client_records
managed_task_audit_events
```

任务服务数据库建议至少包含：

```text
tasks
task_attempts
task_events
task_assets
task_batches
provider_circuit_breakers
queue_metrics_snapshots
```

`managed_task_client_records` 是当前 App 的本地关联表，用于把远端任务与用户历史、工作空间、客户端任务面板关联。不要只依赖任务服务远端记录，否则当前 App 无法稳定知道哪些结果已经导入本地历史。

## 16. 配置兼容与迁移

- 旧配置没有任务接管字段时，行为保持现状。
- `connectionMode` 继续保留，新增 `executionMode` 或 `generationExecutionStrategy` 时需要 migration。
- `ProviderEndpoint` 缺少任务策略时，不接管。
- 后台任务服务配置缺失时，不显示“任务接管可用”。
- 分享链接不能默认携带任务服务 secret；如分享任务接管策略，只能分享公开的策略引用和用户可见提示。

## 17. 分阶段实施任务清单

本节是后续 agent 的主执行清单。实施时必须按阶段推进：一个阶段未通过验收前，不应进入会依赖该阶段产物的下一阶段。每完成一个阶段或阶段内关键子任务，都要回写本节的状态、备注、证据链接和遗留风险。

状态枚举：

- `Not Started`：未开始。
- `In Progress`：正在实施。
- `Blocked`：受阻，需要用户决策或外部依赖。
- `Partial`：阶段内部分完成，但仍有验收缺口。
- `Accepted`：阶段验收通过，可以进入下一阶段。

### 17.1 总览状态表

| 阶段    | 名称                                | 当前状态    | 依赖             | 主要产物                                                               | 下一步备注                                              |
| ------- | ----------------------------------- | ----------- | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Phase 0 | 需求冻结与 Hatchet ADR              | Not Started | 本文档评审通过   | 独立任务服务 ADR、API contract、状态映射、凭证方案                     | 先创建独立任务服务项目，不在当前 App 内实现 worker。    |
| Phase 1 | 独立任务服务骨架与 Hatchet 接入 PoC | Not Started | Phase 0          | 可启动任务服务、Hatchet 连接、mock 任务闭环                            | 只验证图片生成/编辑 mock，不接真实供应商。              |
| Phase 2 | 任务服务 P0 领域 API 与资产存储     | Not Started | Phase 1          | `/v1/tasks`、状态查询、取消、用户重试、结果 manifest、本地文件资产存储 | 任务服务本地文件系统是首选结果存储。                    |
| Phase 3 | 当前 App 管理后台接入配置与策略解析 | Not Started | Phase 0          | 任务服务配置、端点接管策略、resolver、健康检查                         | 当前 App 只做接入配置，不管理任务服务内部存储/Hatchet。 |
| Phase 4 | 当前 App 用户侧提交、恢复与结果导入 | Not Started | Phase 2、Phase 3 | managed-task 提交、pending 记录、批量状态同步、历史导入                | 保证直连/中转旧路径不回归。                             |
| Phase 5 | 安全、角色、审计与费用风险治理      | Not Started | Phase 2、Phase 3 | 临时凭证保护、管理员/超管可见性、自动重试警告、审计                    | 普通管理员只看脱敏摘要，超管可看完整信息。              |
| Phase 6 | P0 验收与故障演练                   | Not Started | Phase 4、Phase 5 | P0 验收报告、压测/断线/worker crash/fallback 证据                      | 验收通过后才能扩展任务类型。                            |
| Phase 7 | 后续增强：S3、视频、批量、多租户    | Not Started | Phase 6          | S3 兼容存储、视频/批量任务、多实例/多租户设计                          | 不属于 P0，单独立项。                                   |

### 17.2 Phase 0：需求冻结与 Hatchet ADR

目标：把本文档转化为独立任务服务项目可以执行的架构决策，冻结 P0 范围。

| 子任务            | 状态        | 验收标准                                                                                                     | 备注                                        |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| 确认 P0 范围      | Not Started | ADR 明确 P0 只做 `image.generate` 与 `image.edit`，图生文、视频、批量、多租户列入后续。                      | 必须与本文第 21 节一致。                    |
| 固化服务边界      | Not Started | ADR 明确任务服务是独立项目、独立依赖、独立部署；当前 App 不 import 任务服务内部代码。                        | 禁止同进程内嵌 worker。                     |
| 固化 Hatchet 选型 | Not Started | ADR 记录 Hatchet 版本、部署形态、依赖、授权、备选方案放弃原因。                                              | 调研结论已选 Hatchet。                      |
| 状态机映射        | Not Started | 文档说明 Hatchet run/task 状态如何映射本文 `queued/running/provider_processing/succeeded/failed/cancelled`。 | 不能把 Hatchet 原生状态直接暴露给当前 App。 |
| 临时执行凭证方案  | Not Started | 文档说明用户本地 Key 与管理员 Key 如何变成短 TTL `executionCredential`，且不以明文持久化。                   | Hatchet payload 不能保存明文 Key。          |
| 资产存储方案      | Not Started | 文档说明 P0 使用任务服务本地文件系统，列出目录、URL、保留期、容量上限、清理任务；S3 为后续扩展。             | 当前 App 文件系统不得作为任务服务结果存储。 |

阶段验收：ADR 与 API contract 评审通过；P0 范围、Hatchet、Key 委托、资产存储、角色可见性和自动重试策略都无待确认项。

### 17.3 Phase 1：独立任务服务骨架与 Hatchet 接入 PoC

目标：先证明独立任务服务可以基于 Hatchet 完成任务生命周期闭环。

| 子任务             | 状态        | 验收标准                                                                       | 备注                                          |
| ------------------ | ----------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| 创建独立项目       | Not Started | 新项目可独立安装依赖、启动、测试、构建；不依赖当前 App runtime。               | 技术栈优先跟随 Hatchet 推荐栈。               |
| 接入 Hatchet       | Not Started | 本地或测试环境可连接 Hatchet control plane，worker 可注册并执行 mock task。    | 不在当前 App 启动 worker。                    |
| 实现 mock 图片任务 | Not Started | mock `image.generate` 与 `image.edit` 支持延迟、进度、失败、取消、成功结果。   | 不接真实供应商 Key。                          |
| 验证 worker crash  | Not Started | 运行中终止 worker 后，任务可恢复或进入明确 retry/failed 状态，不丢失任务记录。 | 记录实际 Hatchet 行为。                       |
| 验证端点级限流     | Not Started | 不同 `baseUrlFingerprint` 可应用不同并发或速率策略。                           | 若 Hatchet 无法直接满足，记录领域层补偿方案。 |

阶段验收：可通过 HTTP 提交 mock 任务并由 Hatchet worker 完成；worker crash、取消、失败、重试、限流行为有测试或演示记录。

### 17.4 Phase 2：任务服务 P0 领域 API 与资产存储

目标：实现任务服务自己的稳定领域 API，让当前 App 后续只接入该 API。

| 子任务           | 状态        | 验收标准                                                                                                     | 备注                                     |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `POST /v1/tasks` | Not Started | 支持 `idempotencyKey`、`taskType`、`providerEndpointRef`、`executionCredential`、prompt、参数、inputAssets。 | P0 拒绝非图片生成/编辑任务类型。         |
| 状态查询 API     | Not Started | `GET /v1/tasks/{id}` 和 `POST /v1/tasks/query` 返回领域状态，不泄漏 Hatchet 内部结构。                       | 100 个任务批量查询走单请求。             |
| 取消与用户重试   | Not Started | 用户可取消、失败后可手动重试；重试生成新的 attempt 并保留审计。                                              | P0 失败任务暂由用户重试。                |
| 自动重试配置     | Not Started | 管理 API 支持自动重试开关、次数、退避；默认关闭或保守开启，并暴露费用风险提示。                              | 自动重试会产生额外供应商费用。           |
| 本地文件资产存储 | Not Started | 结果写入任务服务本地文件系统；manifest 返回受控下载 URL、sha256、mime、size、expiresAt。                     | 当前 App 不直接访问文件目录。            |
| S3 兼容扩展点    | Not Started | 配置模型预留 S3 endpoint/bucket/region/path/sign URL 等字段；P0 可不启用。                                   | 任务服务自身管理 UI/API 负责可视化配置。 |
| 任务服务管理摘要 | Not Started | 提供 health、capabilities、queues、tasks 摘要 API。                                                          | 当前 App 只读摘要。                      |

阶段验收：任务服务在无当前 App 参与的情况下，可完整完成图片 mock 任务的提交、执行、状态查询、取消、用户重试和结果 manifest 下载。

### 17.5 Phase 3：当前 App 管理后台接入配置与策略解析

目标：当前 App 能配置和选择任务服务，但不管理任务服务内部基础设施。

| 子任务              | 状态        | 验收标准                                                                        | 备注                                  |
| ------------------- | ----------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| 任务服务配置模型    | Not Started | 可保存服务 URL、鉴权、启用状态、健康检查配置、capabilities 摘要。               | 不保存任务服务内部 Hatchet/存储配置。 |
| 端点接管策略模型    | Not Started | 支持按 `ProviderEndpoint.id`、normalized `apiBaseUrl`、模型、任务类型匹配。     | P0 任务类型只开放图片生成/编辑。      |
| resolver            | Not Started | 对未命中策略的端点保持现有 direct/proxy 行为；命中后选择 `managed-task`。       | 不破坏旧配置。                        |
| 后台 UI 与 i18n     | Not Started | 新增文案覆盖所有支持语言；浅色/深色、移动/桌面布局可用。                        | 遵守现有 i18n 规则。                  |
| 健康检查与 fallback | Not Started | 任务服务不可用时按策略 fail-closed、ask-user、proxy 或 direct；默认不悄悄回退。 | 避免绕过安全边界。                    |

阶段验收：后台可以配置任务服务和端点接管策略；测试连接、capabilities 读取、策略命中展示和 fallback 行为都有测试。

### 17.6 Phase 4：当前 App 用户侧提交、恢复与结果导入

目标：用户可以真实使用 managed-task 路径，且断线/刷新后恢复。

| 子任务            | 状态        | 验收标准                                                                           | 备注                      |
| ----------------- | ----------- | ---------------------------------------------------------------------------------- | ------------------------- |
| managed-task 提交 | Not Started | 被接管端点的图片生成/编辑提交到任务服务，立即返回稳定 `managedTaskId`。            | 用户本地 Key 可临时委托。 |
| 本地 pending 记录 | Not Started | 保存 `managedTaskId`、endpoint、model、workspace、任务服务 ID、导入状态等。        | 刷新后可恢复。            |
| 状态同步          | Not Started | 页面启动、网络恢复、前台恢复时批量查询状态，显示 queued/running/failed/succeeded。 | 避免 N 个任务 N 个请求。  |
| 结果导入          | Not Started | `succeeded` 后读取 manifest，将图片结果导入历史和当前工作空间。                    | 结果 URL 过期前尽快导入。 |
| 旧路径回归        | Not Started | 未开启接管的 direct/proxy 图片生成和编辑行为不变。                                 | Web 与 Tauri 都要覆盖。   |

阶段验收：用户提交接管任务后关闭页面，任务继续执行；重新打开页面可同步状态并导入结果；旧 direct/proxy 路径无回归。

### 17.7 Phase 5：安全、角色、审计与费用风险治理

目标：把 P0 的关键安全与费用风险降到可运营状态。

| 子任务       | 状态        | 验收标准                                                                                | 备注                            |
| ------------ | ----------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| 临时凭证保护 | Not Started | 用户 Key/管理员 Key 不以明文进入任务服务持久化、Hatchet payload、日志、错误和前端响应。 | 用测试和日志抽样验证。          |
| 管理员可见性 | Not Started | 普通管理员只看脱敏摘要；超级管理员可看完整诊断；查看完整信息有审计。                    | 超管不强制脱敏。                |
| 自动重试警告 | Not Started | 管理后台启用自动重试时显示供应商费用警告；默认策略保守。                                | 用户失败任务默认手动重试。      |
| 审计日志     | Not Started | 记录策略变更、任务提交、取消、重试、自动重试配置、结果读取和超管查看完整信息。          | 不记录敏感明文。                |
| URL 安全     | Not Started | 任务服务 URL、供应商 Base URL、结果下载 URL 都有 SSRF/私网防护。                        | 复用或等价实现现有安全 helper。 |

阶段验收：安全测试证明 Key 不泄漏；角色权限、审计、自动重试警告、URL 安全测试通过。

### 17.8 Phase 6：P0 验收与故障演练

目标：在进入真实灰度前，用故障演练证明 P0 可控可靠。

| 子任务         | 状态        | 验收标准                                                          | 备注                              |
| -------------- | ----------- | ----------------------------------------------------------------- | --------------------------------- |
| 断线恢复       | Not Started | 提交任务后关闭页面/断网，恢复后能同步状态和结果。                 | Web 移动视口必须覆盖。            |
| worker crash   | Not Started | worker 停止/重启后任务不丢失，不重复已完成付费调用。              | 记录 Hatchet 行为证据。           |
| 队列压力       | Not Started | 100 个图片任务批量提交时，当前 App 首页、历史、非接管任务仍可用。 | P0 不要求 10,000 任务生产承诺。   |
| 供应商 429/5xx | Not Started | 触发端点级退避/熔断，任务状态可解释，自动重试遵守配置。           | mock provider 验证。              |
| 任务服务不可用 | Not Started | 当前 App 短超时和断路器生效，按 fallback 处理，不拖垮其他业务。   | fail-closed/ask-user 为推荐默认。 |
| 验收报告       | Not Started | 产出 P0 验收报告，记录命令、截图、风险、未覆盖项。                | 更新 `docs/agent-reports/`。      |

阶段验收：P0 验收报告标记为 `Accepted`，所有 P0 阻断级风险关闭或有明确上线前处理计划。

### 17.9 Phase 7：后续增强

这些能力不进入 P0，需单独立项：

| 能力            | 触发条件                                     | 备注                                              |
| --------------- | -------------------------------------------- | ------------------------------------------------- |
| S3 兼容对象存储 | 本地文件系统容量、备份、跨实例访问成为瓶颈。 | 任务服务自身可视化配置，当前 App 只读取摘要。     |
| 视频任务        | P0 图片路径稳定后。                          | 复用现有 video submit/poll/download/cancel 思路。 |
| 批量任务        | 单任务路径稳定且需要批量削峰。               | 引入 batchId、子任务状态聚合。                    |
| 图生文          | 图片任务接管体验稳定后。                     | 可把 streaming 降级为阶段状态。                   |
| 多实例 / 多租户 | 单部署实例跑通，出现共享部署和隔离诉求后。   | P0 先按单部署实例处理。                           |

## 18. P0 总体验收标准

P0 完成必须同时满足以下标准：

- 独立任务服务基于 Hatchet 实现，独立项目、独立依赖、独立部署，当前 App 不 import 任务服务内部代码。
- 当前 App 后台可以新增任务服务，保存 URL、鉴权、健康检查配置，并读取任务服务 capabilities 摘要。
- 当前 App 后台可以针对指定 `ProviderEndpoint.id` 或 normalized `apiBaseUrl` 开启图片生成/编辑任务接管。
- 对未开启任务接管的端点，现有 direct/proxy 行为不变。
- 用户本地 Key 和管理员托管端点 Key 都可以作为单次任务执行凭证委托给任务服务，但任务服务不持久化明文 Key。
- 用户提交被接管端点任务后，客户端立即拿到稳定任务 ID；关闭页面后任务服务继续执行。
- 重新打开页面或网络恢复后，当前 App 能批量同步任务状态。
- 任务完成后，当前 App 能读取 manifest 并把图片结果导入工作台/历史。
- 结果资产首选保存到任务服务本地文件系统，不写入当前 App 文件系统；S3 兼容存储有后续扩展模型。
- 失败任务默认由用户手动重试；若管理员开启自动重试，后台必须展示供应商费用风险警告。
- 普通管理员只能查看脱敏摘要；超级管理员可以查看完整诊断信息，且查看行为进入审计。
- 任务服务不可用时，当前 App 按 fallback 策略处理，不拖垮首页、历史、设置、direct/proxy 等其他业务。
- URL 安全、密钥保护、审计日志、基础限流、幂等和状态机都有测试覆盖。
- Web 和 Tauri 桌面分支都有验证；桌面静态导出不依赖 Next API Route 执行任务。

## 19. 测试计划

### 19.1 单元测试

- 端点策略匹配优先级。
- Base URL normalize 与安全校验。
- execution mode resolver。
- 任务状态机合法迁移。
- 幂等键生成与重复提交处理。
- 配置 normalize：缺失、非法、旧值、用户自定义值。
- `executionCredential` 生成、过期、fingerprint、脱敏与明文禁止持久化。
- 普通管理员 / 超级管理员可见字段过滤。
- 自动重试配置 normalize 和费用风险警告条件。

### 19.2 集成测试

- 当前 App 后台创建任务服务配置。
- 当前 App 提交接管任务到 mock task service。
- 当前 App 测试中使用 mock HTTP 任务服务，不 import 独立任务服务实现。
- mock task service 模拟 queued/running/succeeded/failed/cancelled。
- 任务完成后结果 manifest 导入图片历史。
- 任务服务超时、500、401、429、队列满的 fallback 行为。
- 密钥不进入浏览器响应、日志和分享 payload。
- Hatchet worker 执行 mock 图片生成/编辑任务，状态由任务服务领域 API 返回。
- 任务服务本地文件系统写入结果资产，并通过 manifest 返回受控下载 URL。
- 用户本地 Key 与管理员托管 Key 均可作为临时执行凭证完成 mock 任务。

### 19.3 E2E 测试

- Web 桌面浅色 / 深色：开启策略、提交任务、刷新、恢复结果。
- Web 移动浅色 / 深色：提交任务后模拟离线，重连后同步状态。
- Tauri 桌面：静态导出下访问远端任务服务，完成后保存结果。
- 管理后台：普通管理员只看脱敏摘要，超级管理员可以查看完整诊断并记录审计。
- 自动重试配置：开启时展示供应商费用风险警告；关闭时失败任务由用户手动重试。

### 19.4 压测与故障演练

- 100 个图片生成/编辑任务批量提交，检查当前 App 首页、历史、设置、direct/proxy 旧路径仍可用。
- 单供应商 429 熔断。
- 任务服务 worker 全部停止。
- 任务服务本地资产目录不可写、磁盘容量不足、清理任务异常。
- 当前 App 与任务服务网络中断。
- 结果 URL 过期前后的导入行为。
- Hatchet control plane 不可用或连接抖动时的任务状态和 fallback 行为。

## 20. 关键风险与对策

| 风险                                    | 影响 | 对策                                                                                                          |
| --------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| 用户本地 Key 临时委托扩大泄漏面         | 高   | 只允许可信端点开启任务接管；Key 作为短 TTL 执行凭证传入；禁止明文持久化、日志、事件、Hatchet payload。        |
| 自动重试产生额外供应商费用              | 高   | 默认用户手动重试；自动重试需后台显式开启并显示费用风险警告；所有重试写审计并受配额限制。                      |
| 任务服务被刷爆产生供应商费用            | 高   | 幂等、配额、限流、队列上限、后台禁用开关、端点熔断、审计。                                                    |
| 结果资产保存失败导致供应商临时 URL 过期 | 高   | 任务完成阶段先进入 `downloading_result`；P0 写任务服务本地文件系统，保存失败可重试并告警。                    |
| 任务服务本地文件系统容量不足            | 中   | 配置资产根目录、容量上限、保留期、清理任务和健康检查；S3 兼容存储作为后续扩展。                               |
| 当前 App 和任务服务版本不兼容           | 中   | `/v1/admin/capabilities` 声明 schemaVersion、taskTypes、storage、credentialModes，当前 App 做能力协商。       |
| 当前 App 越界管理任务服务内部配置       | 中   | 当前 App 只配置接入和策略；Hatchet、worker、本地资产、S3、provider adapter 等由任务服务自身管理 UI/API 管理。 |
| 普通管理员看到敏感信息                  | 高   | 普通管理员只看脱敏摘要；超级管理员可看完整诊断且记录审计；Key 明文仍不持久化。                                |
| 用户看不懂“中转”和“接管”区别            | 中   | UI 使用任务状态表达，不强迫用户理解架构；设置里说明“断线后继续”。                                             |
| 静态桌面导出误依赖 Next API             | 中   | managed-task client 必须能直连远端任务服务；涉及本地能力走 `desktop-runtime`。                                |
| 先做内嵌版本导致后续难以分离            | 高   | P0 明确禁止内嵌同进程适配层；任务服务从第一天就是独立项目和独立部署单元。                                     |
| Hatchet 接入复杂度高于预期              | 中   | Phase 1 先做 Hatchet PoC；如果端点限流、凭证安全或恢复语义不能满足 P0，必须回写 ADR 并重新评估备选。          |

## 21. 已确认决策

本节原为“待确认问题”。截至 2026-06-10，以下问题已按用户最新决策确认，后续 agent 不应再按旧假设推进。

| 编号 | 问题                                         | 已确认决策                                                                                                                                                         | 实施影响                                                                                                                     |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1    | P0 是否允许用户本地 Key 临时委托给任务服务？ | 允许。针对管理员配置为任务接管的可信端点，用户本地 Key 可以作为本次任务执行凭证临时委托给任务服务。任务服务不得持久化用户 Key；每次执行都必须传入端点与执行凭证。  | API 必须支持 `executionCredential.mode = user-delegated`；安全测试必须验证 Key 不落库、不进日志、不进 Hatchet 明文 payload。 |
| 2    | 结果资产首选存储在哪里？                     | P0 首选任务服务自己的本地文件系统，不得使用当前 App 文件系统。后续支持 S3 兼容云存储。任务服务应提供自身存储配置的可视化管理；当前 App 只读取封装摘要和 manifest。 | 任务服务要实现本地资产根目录、保留期、清理任务、容量检查、受控下载 URL；S3 配置模型作为后续扩展。                            |
| 3    | 独立任务服务项目技术栈如何选择？             | 优先跟随选定底座 Hatchet 的推荐技术栈和 SDK 生态，不受当前项目依赖或技术栈约束。                                                                                   | 独立任务服务可以选择更适合 Hatchet 的语言/框架；当前 App 只依赖 HTTP contract。                                              |
| 4    | 管理员是否可以查看完整信息？                 | 普通管理员只能查看脱敏后的摘要信息；超级管理员可以查看完整信息，不对超管强制脱敏。                                                                                 | 需要角色权限、字段过滤和审计；超管查看完整信息必须记录审计日志。                                                             |
| 5    | P0 首批任务类型是什么？                      | P0 只做图片生成和图片编辑；图生文、视频、批量先放到后续阶段。                                                                                                      | capabilities、策略 UI、任务服务 API 都要拒绝 P0 未启用任务类型。                                                             |
| 6    | 失败任务如何重试？                           | 失败任务暂由用户手动重试；管理后台可配置是否自动重试。启用自动重试必须明确警告：自动重试会产生额外供应商费用，可能消耗用户额度或 Key 余额。                        | 默认策略保守；自动重试配置、审计、UI 警告和费用风险说明必须纳入 P0。                                                         |
| 7    | 是否 P0 支持多租户？                         | P0 先按单部署实例处理；模式跑通后再考虑多租户、多实例和计费隔离。                                                                                                  | 数据模型可以预留 owner/project 字段，但 P0 验收不要求完整多租户。                                                            |
| 8    | 开源底座选择什么？                           | 根据调研报告，P0 底座选择 Hatchet。                                                                                                                                | Phase 0 输出 Hatchet ADR，Phase 1 做 Hatchet 接入 PoC；Trigger.dev、Temporal、BullMQ 仅作为备选。                            |

## 22. 后续执行与文档跟踪要求

后续开发必须按第 17 节阶段清单推进，并把阶段状态回写到本文档或与本文档交叉链接的阶段报告中。要求如下：

1. 每个阶段开始时，将对应总览状态从 `Not Started` 改为 `In Progress`，并在备注中写明执行 agent、开始日期和目标范围。
2. 每个子任务完成后，更新该行状态或备注，补充代码路径、测试命令、PR/commit、截图或运行日志等证据。
3. 阶段验收未通过时，不进入依赖该阶段的下一阶段；如果必须并行推进，必须在备注中写明隔离方式和风险。
4. 阶段完成后，只有在验收标准全部满足时才能标记为 `Accepted`；存在缺口时标记为 `Partial` 并列出缺口。
5. 每个阶段都要更新 `docs/agent-reports/` 下对应报告，记录实际完成、跳过项、验证证据、剩余风险和后续建议。
6. 当前 App 与独立任务服务的边界不得被阶段执行弱化：当前 App 只做接入、策略、状态同步和结果导入；任务执行、Hatchet、worker、队列、资产存储、存储配置由独立任务服务负责。
7. P0 未完成前，不扩展视频、批量、图生文、多租户或 S3 生产化能力，除非单独创建后续阶段任务并明确不阻塞 P0。
