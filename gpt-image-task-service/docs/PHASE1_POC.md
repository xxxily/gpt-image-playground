# Phase 1 PoC Notes

| 字段 | 内容                                         |
| ---- | -------------------------------------------- |
| 日期 | 2026-06-11                                   |
| 阶段 | Phase 1：独立任务服务骨架与 Hatchet 接入 PoC |
| 状态 | 已验收 (Accepted)                            |

## 已完成

- 创建独立目录 `gpt-image-task-service/`，包含独立 `package.json`、`tsconfig.json`、`Dockerfile`、源码、测试和 README。
- 任务服务不接入根项目 workspace，不修改当前 App 依赖，也不被当前 App import。
- 实现 mock HTTP API：
    - `POST /v1/tasks`
    - `GET /v1/tasks/{taskId}`
    - `POST /v1/tasks/query`
    - `POST /v1/tasks/{taskId}/cancel`
    - `POST /v1/tasks/{taskId}/retry`
    - `GET /v1/tasks/{taskId}/result`
    - `GET /v1/tasks/{taskId}/events`
    - `GET /v1/admin/health`
    - `GET /v1/admin/capabilities`
    - `GET /v1/admin/queues`
- mock `image.generate` 与 `image.edit` 支持 queued/running/provider_processing/downloading_result/succeeded/failed/cancelled/retry_scheduled。
- 端点并发按 `baseUrlFingerprint` 分桶。
- `POST /v1/admin/test/simulate-worker-crash` 可模拟 worker crash，并验证任务记录不丢失、可重新排队。
- 增加 Hatchet SDK 依赖与 `npm run hatchet:probe`，确认 adapter 边界在独立服务内部。
- 增加真实 Hatchet adapter 入口：`npm run hatchet:worker`、`npm run hatchet:run`、`npm run hatchet:live-smoke`、`npm run hatchet:live-verify`。这些命令在有 `HATCHET_CLIENT_TOKEN` 和可用 control plane 时注册并执行 mock task；无 token 时 `run`、`live-smoke` 与 `live-verify` 安全跳过。
- 安装并验证 Hatchet CLI `0.89.0`；通过 Lima Docker 启动本地 Hatchet control plane，并使用本地 profile 注入环境完成 live 验收。
- `hatchet:live-verify` 覆盖真实 Hatchet 执行、同端点任务串行和 worker crash 后替换 worker 恢复；如果同端点任务重叠、crash worker 未按预期退出或恢复失败，命令会失败。

## 未完成

- Phase 1 范围内无阻塞缺口。
- 真实供应商调用、持久化本地文件资产存储、管理 API 生产化、自动重试策略和当前 App 接入属于 Phase 2 及后续阶段。

## 验证记录

| 检查项                | 命令或场景                                                                                                                      | 结果                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 独立依赖安装          | `npm install`                                                                                                                   | 通过，生成独立 `package-lock.json`。                                                        |
| 构建                  | `npm run build`                                                                                                                 | 通过。                                                                                      |
| 单元与 HTTP 测试      | `npm test`                                                                                                                      | 通过，覆盖 mock lifecycle、idempotency、取消、失败重试、worker crash 模拟和端点限流。       |
| smoke                 | `npm run smoke`                                                                                                                 | 通过，HTTP 提交 mock 图片任务并读取结果 manifest。                                          |
| Hatchet SDK probe     | `npm run hatchet:probe`                                                                                                         | 通过 SDK 加载；无 `HATCHET_CLIENT_TOKEN` 时按预期跳过 live control-plane connection。       |
| Hatchet CLI           | `hatchet --version`                                                                                                             | 通过，CLI 版本 `0.89.0`。                                                                   |
| Hatchet control plane | `hatchet server start --project-name gpt-image-task-phase1 --profile gpt-image-task-phase1 --tag v0.89.0 --pull-policy missing` | 初次因 Docker daemon 不可达失败；后续通过 Lima Docker 启动本地 Hatchet 服务并生成 profile。 |

## 续跑验证记录

2026-06-11 根据自动续跑要求重新收集证据：

| 检查项                  | 命令或场景                                                   | 结果                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| post-commit 单元与 HTTP | `rtk npm test`                                               | 通过，12 项测试全部通过。                                                                                                                         |
| post-commit smoke       | `rtk npm run smoke`                                          | 通过，HTTP mock 任务进入 `succeeded`，返回 1 个 output。                                                                                          |
| post-commit SDK probe   | `rtk npm run hatchet:probe`                                  | 通过 SDK 加载；仍无 `HATCHET_CLIENT_TOKEN`，按预期跳过 live control-plane connection。                                                            |
| Hatchet adapter 编译    | `rtk npm run hatchet:run`、`rtk npm run hatchet:live-smoke`  | 无 `HATCHET_CLIENT_TOKEN` 时安全跳过；有本地 profile 时可注册 worker 并执行 mock task。                                                           |
| Hatchet payload 安全    | `rtk npm test`                                               | 新增测试证明 Hatchet mock input 只包含安全执行元数据，不包含 credential、原始 prompt、provider URL 或 inputAssets。                               |
| Hatchet worker gate     | `rtk npm run hatchet:worker`                                 | 无 `HATCHET_CLIENT_TOKEN` 时以退出码 2 拒绝启动长运行 worker，避免假装 live worker 已连接。                                                       |
| 本机工具存在性          | `limactl --version`、`docker --version`、`hatchet --version` | `limactl 2.1.0`、Docker `29.1.4`、Hatchet CLI `0.89.0` 均存在。                                                                                   |
| Lima 状态               | `limactl list`                                               | 返回 no instance found；没有可复用的运行中 Docker VM。                                                                                            |
| Docker context          | `docker context ls` / `docker context inspect`               | 默认 context 指向 `unix:///var/run/docker.sock`。                                                                                                 |
| Docker daemon           | `docker info`                                                | 初次默认 Docker socket 不可用；后续通过 `DOCKER_HOST=unix://$HOME/.lima-gpt-image-task/gpt-image-task-docker/sock/docker.sock` 使用 Lima Docker。 |
| Lima Docker bootstrap   | `limactl ... start/create --name=gpt-image-task-docker ...`  | 已创建并运行 `gpt-image-task-docker`，用于本地 Hatchet control plane。                                                                            |

## live 验收记录

2026-06-11 使用本地 Hatchet profile `gpt-image-task-phase1` 注入环境变量，未打印 token：

| 检查项          | 命令或场景                                                                                                                                                                                      | 结果                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| SDK 与 profile  | `rtk proxy /usr/bin/ruby -ryaml -e '... exec "npm", "run", "hatchet:probe"'`                                                                                                                    | 通过，`sdkLoaded: true`、`tokenConfigured: true`、`tlsStrategy: "none"`。                                                                |
| live smoke      | `rtk proxy /usr/bin/ruby -ryaml -e '... exec "npm", "run", "hatchet:live-smoke"'`                                                                                                               | 通过，worker `gpt-image-managed-image-worker-phase1` 连接 Hatchet，mock task `status: "succeeded"`、`outputCount: 1`，CLI 正常退出。     |
| live verify     | `rtk proxy /usr/bin/ruby -ryaml -e '... exec "npm", "run", "hatchet:live-verify"'`                                                                                                              | 通过，执行任务 `status: "succeeded"`；同 endpoint 任务 `overlapped: false`、`sameEndpointSerialized: true`；crash run 最终 `COMPLETED`。 |
| crash recovery  | `hatchet:live-verify` 内部触发 `crashOnceKey` 并启动替换 worker                                                                                                                                 | 通过，崩溃 worker 退出码 42，崩溃后 run 状态 `QUEUED`，替换 worker 完成任务，`recovered: true`、`outputCount: 1`。                       |
| worker 进程清理 | `rtk ps -axo pid,command \| rtk rg 'dist/hatchet\|hatchet/worker\|gpt-image-managed-image-worker-phase1'`                                                                                       | 无匹配进程，未遗留 agent 启动的 Hatchet worker。                                                                                         |
| 格式与空白检查  | `rtk proxy npx prettier --check package.json src/hatchet/live.ts src/hatchet/live-smoke.ts src/hatchet/run.ts src/hatchet/live-verify.ts`、`rtk git diff --check -- gpt-image-task-service/...` | 通过。                                                                                                                                   |

## 下一步

1. 进入 Phase 2：实现任务服务 P0 领域 API 的持久化形态、本地文件资产存储、结果 manifest 下载授权、自动重试配置和管理摘要。
2. 保持当前 App 与任务服务边界：当前 App 后续只通过 HTTP contract 接入，不 import 任务服务内部代码或 Hatchet SDK。
3. 继续避免把执行凭证、原始 prompt、provider URL、Authorization 或输入资产写入 Hatchet payload、日志或诊断输出。
