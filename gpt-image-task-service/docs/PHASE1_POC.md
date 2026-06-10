# Phase 1 PoC Notes

| 字段 | 内容                                         |
| ---- | -------------------------------------------- |
| 日期 | 2026-06-11                                   |
| 阶段 | Phase 1：独立任务服务骨架与 Hatchet 接入 PoC |
| 状态 | 部分完成 (Partial)                           |

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
- 安装并验证 Hatchet CLI `0.89.0`；`server start` 会创建本地 profile/token，但本机 Docker daemon 不可达，未能启动 control plane。

## 未完成

- 尚未在本机启动真实 Hatchet control plane。
- 尚未注册真实 Hatchet worker 并执行 mock task。
- worker crash 目前通过领域 mock runtime 演示，不是 Hatchet control plane 恢复证据。
- 端点级限流目前由领域层 `EndpointLimiter` 验证；Hatchet dynamic rate limit/concurrency 的真实映射仍需后续验证。

## 验证记录

| 检查项                | 命令或场景                                                                                                                      | 结果                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 独立依赖安装          | `npm install`                                                                                                                   | 通过，生成独立 `package-lock.json`。                                                            |
| 构建                  | `npm run build`                                                                                                                 | 通过。                                                                                          |
| 单元与 HTTP 测试      | `npm test`                                                                                                                      | 通过，覆盖 mock lifecycle、idempotency、取消、失败重试、worker crash 模拟和端点限流。           |
| smoke                 | `npm run smoke`                                                                                                                 | 通过，HTTP 提交 mock 图片任务并读取结果 manifest。                                              |
| Hatchet SDK probe     | `npm run hatchet:probe`                                                                                                         | 通过 SDK 加载；无 `HATCHET_CLIENT_TOKEN` 时按预期跳过 live control-plane connection。           |
| Hatchet CLI           | `hatchet --version`                                                                                                             | 通过，CLI 版本 `0.89.0`。                                                                       |
| Hatchet control plane | `hatchet server start --project-name gpt-image-task-phase1 --profile gpt-image-task-phase1 --tag v0.89.0 --pull-policy missing` | 失败：Docker daemon 不可达，无法列出 Docker networks；未创建 profile/token，未执行真实 worker。 |

## 续跑验证记录

2026-06-11 根据自动续跑要求重新收集证据：

| 检查项                  | 命令或场景                                                   | 结果                                                                                   |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| post-commit 单元与 HTTP | `rtk npm test`                                               | 通过，11 项测试全部通过。                                                              |
| post-commit smoke       | `rtk npm run smoke`                                          | 通过，HTTP mock 任务进入 `succeeded`，返回 1 个 output。                               |
| post-commit SDK probe   | `rtk npm run hatchet:probe`                                  | 通过 SDK 加载；仍无 `HATCHET_CLIENT_TOKEN`，按预期跳过 live control-plane connection。 |
| 本机工具存在性          | `limactl --version`、`docker --version`、`hatchet --version` | `limactl 2.1.0`、Docker `29.1.4`、Hatchet CLI `0.89.0` 均存在。                        |
| Lima 状态               | `limactl list`                                               | 返回 no instance found；没有可复用的运行中 Docker VM。                                 |
| Docker context          | `docker context ls` / `docker context inspect`               | 默认 context 指向 `unix:///var/run/docker.sock`。                                      |
| Docker daemon           | `docker info`                                                | 仍无法连接 Docker daemon；因此 Hatchet local server 仍无法启动。                       |
| Lima Docker bootstrap   | `limactl ... start/create --name=gpt-image-task-docker ...`  | 通过当前命令环境未得到可用 Lima Docker 实例；未产生可供 Hatchet 使用的 Docker daemon。 |

## 下一步

1. 使用 `hatchet server start` 或 Docker Compose 启动 self-hosted Hatchet。
2. 用 `HATCHET_CLIENT_TOKEN` 跑 `npm run hatchet:probe`。
3. 新增真实 Hatchet worker adapter，把 mock task 注册到 Hatchet。
4. 重跑 worker crash、取消、失败、手动重试和端点级限流演示。
5. 通过后将 Phase 1 从 `Partial` 更新为 `Accepted`。
