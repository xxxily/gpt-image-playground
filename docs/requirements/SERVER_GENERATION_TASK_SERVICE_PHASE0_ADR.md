# ADR: 服务端生成任务接管 Phase 0 架构决策

| 字段     | 内容                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日期     | 2026-06-11                                                                                                                                                                   |
| 状态     | 已接受 (Accepted)                                                                                                                                                            |
| 决策范围 | Phase 0：P0 范围冻结、独立服务边界、Hatchet 选型、状态映射、临时执行凭证方案、结果资产存储方案                                                                               |
| 关联需求 | [服务端生成任务接管与独立任务服务需求文档](./SERVER_GENERATION_TASK_ORCHESTRATION_REQUIREMENTS.md)、[Phase 0 API contract](./SERVER_GENERATION_TASK_SERVICE_API_CONTRACT.md) |
| 适用项目 | 独立任务服务项目 `gpt-image-task-service` 与当前 App 的 HTTP 接入边界                                                                                                        |

## 背景

当前 App 的 `direct` 和 `proxy` 路径仍由客户端页面、Tauri WebView、当前 Next API Route 或 Tauri Rust proxy 持有任务生命周期。长耗时图片编辑、弱网络、移动端后台、浏览器刷新和供应商异步结果下载都会让用户感知为任务丢失。

需求文档已确认 P0 引入第三种运行模式：`managed-task`。任务执行、队列、worker、重试、资产保存和容量治理必须属于独立任务服务；当前 App 只保留任务服务配置接入、策略解析、状态同步和结果回灌。

## 决策

### 1. P0 范围冻结

P0 只交付图片生成和图片编辑两类任务：

- `image.generate`
- `image.edit`

图生文、视频、批量任务、S3 生产化、多实例、多租户和计费隔离不进入 P0。后续扩展必须先更新 capabilities、API contract、需求文档和阶段报告，不能让当前 App 向未启用任务类型提交任务。

### 2. 独立服务边界

任务服务从第一天就是独立项目和独立部署单元，建议项目名为 `gpt-image-task-service`。它必须具备：

- 独立代码库或独立 workspace root。
- 独立依赖树、构建命令、测试命令和 Docker 镜像。
- 独立数据库迁移与运行时配置。
- 独立 HTTP API 和管理 API。
- 独立 worker 进程和 Hatchet 连接。
- 独立结果资产根目录和清理策略。

当前 App 不得：

- import 任务服务内部模块。
- 在 Next API Route 内运行持久队列、Hatchet worker 或 provider adapter。
- 把任务服务数据库表混入当前 App SQLite schema。
- 把 Hatchet SDK 或 Hatchet 原生任务状态暴露给浏览器。
- 把任务服务内部存储、worker、Hatchet、S3 连接等基础设施配置塞进当前 App 后台。

当前 App 只能通过稳定 HTTP contract 调用任务服务，并在后台保存接入配置、鉴权、健康摘要、capabilities 摘要和端点接管策略。

### 3. Hatchet 选型

P0 选用 Hatchet 作为独立任务服务内部编排底座。原因：

- Hatchet 面向 background tasks、durable workflows 和 AI agents，覆盖队列、持久化、重试、观测、限流、并发和 worker slots。
- Hatchet 支持 self-hosting，适合当前“独立应用服务”目标。
- Hatchet 支持 TypeScript SDK，当前 npm 元数据中 `@hatchet-dev/typescript-sdk` 为 `1.23.1`，许可证为 MIT。
- Hatchet GitHub 最新 release 在 2026-06-10 发布 `v0.89.0`，仓库许可证为 MIT。
- Trigger.dev、Temporal、BullMQ 作为备选，不进入 P0 主线。

Phase 1 可以在独立任务服务中锁定 Hatchet control plane/CLI/SDK 的具体版本。Phase 0 不把当前 App 绑定到 Hatchet 版本；当前 App 只看任务服务领域 API 和 capabilities。

### 4. Hatchet 状态映射

当前 App 和外部 HTTP API 只暴露领域状态，不暴露 Hatchet 原生 run/task 状态。

| 领域状态              | 触发来源或 Hatchet 行为                                                              | 对当前 App 的含义                                  |
| --------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `submitted`           | 当前 App 已发起提交，但尚未收到任务服务确认。                                        | 仅本地临时状态，不要求任务服务持久化。             |
| `accepted`            | 任务服务完成幂等校验、参数校验、凭证 envelope 生成和任务记录持久化。                 | 已有稳定 `managedTaskId`，断线后可恢复。           |
| `queued`              | 任务已进入 Hatchet workflow/task 等待 worker slot、并发桶或速率限制。                | 可以展示队列位置、限流原因或预计等待时间。         |
| `running`             | Hatchet worker 已领取领域任务，开始执行前置校验、输入资产解析或 mock provider 调用。 | 已开始执行，但不代表供应商已经进入异步处理。       |
| `provider_processing` | provider adapter 已提交供应商请求，或供应商异步 job 正在轮询。                       | P0 mock 图片任务可用阶段事件模拟；真实视频后续用。 |
| `downloading_result`  | worker 正在下载供应商临时 URL、生成 mock asset 或写入任务服务本地资产目录。          | 结果尚未可读；失败后可重试保存阶段。               |
| `succeeded`           | 结果 manifest 已写入，受控下载 URL 可用。                                            | 当前 App 可以拉取 manifest 并导入历史/工作空间。   |
| `failed`              | 达到最终失败条件，或不可重试错误。                                                   | P0 默认由用户手动重试。                            |
| `retry_scheduled`     | 自动重试被后台显式启用，且重试受次数、退避、配额和费用警告约束。                     | 当前 App 显示下一次重试时间。                      |
| `cancelling`          | 当前 App 或管理员请求取消，任务服务已记录取消意图。                                  | worker 应尽快停止未开始或可取消阶段。              |
| `cancelled`           | Hatchet task 未执行、worker 主动停止，或领域层标记取消完成。                         | 保留取消记录，不导入结果。                         |
| `retained`            | 任务成功且仍在保留期。                                                               | 当前 App 可继续读取 manifest。                     |
| `expired`             | 任务或结果资产超过保留期，受控 URL 不再可用。                                        | 当前 App 保留本地关联和可重试入口。                |

映射规则：

- Hatchet 内部失败、取消、重试、超时必须转换为领域错误码和领域状态。
- Hatchet run id 只作为任务服务内部诊断字段；普通管理员和当前 App 用户接口不得依赖它。
- 幂等键重复提交必须返回原任务的领域状态，不新建付费调用。
- worker crash 后，领域记录必须保持 `queued`、`running`、`retry_scheduled`、`failed` 或 `succeeded` 中的可解释状态，不允许任务静默消失。

### 5. 临时执行凭证方案

P0 支持两种执行凭证来源：

- `user-delegated`：用户本地供应商 Key 在本次任务维度临时委托。
- `admin-delegated`：当前 App 服务端持有的管理员托管端点 Key 在本次任务维度临时委托。

凭证处理原则：

- 每次任务提交都必须显式传入端点引用和短 TTL `executionCredential`。
- 任务服务不得把明文 Key 作为长期配置保存。
- Hatchet durable payload、任务服务数据库、日志、事件流、错误堆栈、metrics label、诊断包和普通管理员响应中不得出现明文 Key。
- 任务服务可以保存加密 envelope、凭证引用、fingerprint、过期时间、来源模式和审计摘要。
- worker 执行时只在内存中解密短 TTL envelope；执行结束、取消、失败或过期后清理内存引用。
- 如果 worker crash 发生在供应商付费调用前，可以安全重试；如果发生在付费调用后，必须依赖 provider request id、attempt 状态或阶段记录避免重复已完成的付费调用。

Phase 1/2 的 PoC 可使用开发密钥派生的 envelope 模型验证“不落明文”，但必须把生产级 envelope key 管理列为任务服务自身配置，不进入当前 App 浏览器 bundle。

### 6. 结果资产存储方案

P0 结果资产首选任务服务本地文件系统，不写入当前 App 文件系统。

建议任务服务配置：

- `TASK_ASSET_ROOT`：资产根目录。
- `TASK_ASSET_PUBLIC_BASE_URL` 或下载 API base URL：生成受控下载 URL。
- `TASK_ASSET_RETENTION_HOURS`：默认保留期。
- `TASK_ASSET_MAX_BYTES`：资产目录容量上限。
- `TASK_ASSET_MAX_OBJECT_BYTES`：单个输出资产上限。
- `TASK_ASSET_CLEANUP_INTERVAL_SECONDS`：清理任务周期。

文件布局建议：

```text
<TASK_ASSET_ROOT>/
  tasks/
    <yyyy>/<mm>/<dd>/<taskId>/
      manifest.json
      outputs/
        output-1.png
        output-2.png
      metadata/
        provider-usage.json
```

下载边界：

- 当前 App 只能读取 result manifest 和受控下载 URL。
- 当前 App 不直接挂载、扫描或清理任务服务资产目录。
- 下载 URL 默认短期有效，并绑定 task id、asset id、过期时间和签名。
- manifest 必须包含 `sha256`、`mimeType`、`size`、`expiresAt` 等导入校验信息。
- S3/R2/MinIO 等 S3 兼容存储仅作为 Phase 7 后续增强；Phase 2 可预留配置模型但不启用生产化路径。

### 7. 管理员可见性和自动重试策略

普通管理员只能查看脱敏摘要：任务 ID、端点摘要、模型、状态、耗时、错误分类、Key fingerprint、prompt 摘要和资产摘要。

超级管理员可以查看完整诊断信息，但所有查看行为必须进入审计日志。Key 明文仍不应出现在持久化日志中。

P0 失败任务默认由用户手动重试。自动重试只有在后台显式开启后才生效，且必须展示费用风险：自动重试可能再次调用供应商，产生额外供应商费用，并消耗用户额度或 Key 余额。

## 备选方案

| 方案                 | 处理结果 | 原因                                                                     |
| -------------------- | -------- | ------------------------------------------------------------------------ |
| Trigger.dev          | 不进 P0  | TypeScript 体验强，但本需求已确认 Hatchet；保留为 Hatchet PoC 失败备选。 |
| Temporal             | 不进 P0  | durable execution 成熟，但 P0 复杂度和运维成本过高。                     |
| BullMQ               | 不进 P0  | 适合作为轻量队列核，但需要自建更多状态机、观测、管理和恢复语义。         |
| 当前 App 内嵌 worker | 拒绝     | 违反独立项目、独立部署和压垮隔离的 P0 硬约束。                           |

## Phase 0 验收结论

Phase 0 已冻结以下决策：

- P0 只做 `image.generate` 和 `image.edit`。
- 任务服务是独立项目、独立依赖、独立部署，当前 App 不 import 内部代码。
- P0 底座选用 Hatchet；当前 App 不感知 Hatchet。
- 当前 App 与任务服务之间只通过稳定 HTTP contract 协作。
- Hatchet 原生状态必须映射为领域状态。
- 用户本地 Key 和管理员托管 Key 均以短 TTL 执行凭证临时委托，不持久化明文。
- 结果资产写入任务服务本地文件系统，S3 作为后续增强。
- 普通管理员脱敏、超级管理员审计、自动重试费用警告纳入 P0。

因此 Phase 0 标记为 `Accepted`。Phase 1 可以创建独立任务服务骨架并做 Hatchet mock 任务 PoC。

## 证据与参考

- Hatchet self-hosting 文档：<https://docs.hatchet.run/self-hosting>
- Hatchet GitHub 仓库：<https://github.com/hatchet-dev/hatchet>
- Hatchet 最新 GitHub release 查询结果：`v0.89.0`，发布于 2026-06-10。
- npm 查询结果：`@hatchet-dev/typescript-sdk@1.23.1`，MIT，修改时间 2026-06-09。
