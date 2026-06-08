# 批量 AI 配置与历史分辨率修复

| 字段 | 内容 |
| --- | --- |
| 日期 | 2026-06-08 |
| 状态 | 已完成 (Completed) |
| 相关请求 | 修复批量规划 AI 选择保存后丢失；将大批量确认阈值改为超过 100；图片历史不要显示 `背景 auto`，改为显示用户设定分辨率 |
| 相关文档 | [供应商与设置](../providers-and-settings.md)、[生成与编辑](../generation-editing.md)、[历史与资产管理](../history-and-assets.md)、[批量配置需求](../requirements/BATCH_CONFIGURATION_MANAGEMENT_REQUIREMENTS.md)、[CHANGELOG](../../CHANGELOG.md) |
| 改动范围 | 供应商模型目录归一化、任务默认模型绑定、批量配置、工作台批量确认、历史记录元数据、历史卡片展示、i18n、文档 |
| 提交状态 | 未提交 |

## 范围核对

| 请求目标 | 实际结果 | 证据 | 状态 |
| --- | --- | --- | --- |
| 批量任务规划 AI 选择在新增端点或保存其他设置后不能丢失 | `prompt.batchPlan` 显式任务默认模型在端点 `modelIds: []` 时仍会被归一化保留，并可被解析执行；不把开放模型列表端点改写成单模型白名单 | `src/lib/provider-model-catalog.ts`、`src/lib/provider-model-binding.test.ts`、`src/lib/provider-model-catalog.test.ts` | 已完成 (Completed) |
| 一并分析并修复图生文与多模态、提示词润色配置的同类问题 | 同一显式默认模型保留逻辑覆盖 `vision.text` 与 `prompt.polish`，新增回归测试覆盖绑定后再归一化保存 | `resolveExplicitTaskDefaultEntry`、`resolveVisionTextCatalogSelection`、`resolvePromptPolishCatalogSelection` 相关测试 | 已完成 (Completed) |
| 大批量确认阈值从 12 改为超过 100 才提示 | 默认值改为 `100`，旧默认 `12` 自动迁移为 `100`；确认条件改为 `enabledCount > threshold`；设置输入最大值放宽到 `1000` | `src/lib/batch-config.ts`、`src/features/workbench/page/workbench-page.tsx`、Playwright 读取 `batch-confirm-threshold=100,max=1000` | 已完成 (Completed) |
| 图片历史不要显示 `背景 auto`，改为显示用户分辨率 | 历史记录保存请求 `size`，读取时保留；历史卡片显示请求分辨率，且隐藏值为 `auto` 的背景与审核字段 | `src/lib/taskExecutor.ts`、`src/lib/image-history.ts`、`src/components/history/history-image-card.tsx`、Playwright 历史卡片文本包含 `1536x2048` 且不含 `背景 auto` | 已完成 (Completed) |
| 文档同步 | 更新供应商设置、生成编辑、历史说明、批量需求和未发布日志 | `docs/providers-and-settings.md`、`docs/generation-editing.md`、`docs/history-and-assets.md`、需求文档、`CHANGELOG.md` | 已完成 (Completed) |

## 问题与解决

| 问题 | 解决办法 | 剩余风险 |
| --- | --- | --- |
| `getModelCatalogEntriesForTask` 会把 `modelIds: []` 端点视为没有可选模型，导致任务默认模型归一化时丢弃已选 AI | 对 `vision.text`、`prompt.polish`、`prompt.batchPlan` 增加显式默认模型资格检查和解析兜底，只接受启用端点、启用目录项和匹配任务能力的条目 | 如果极旧配置里的目录项没有任务能力，仍不会被当成有效默认模型；当前设置绑定流程和模型发现路径会写入能力 |
| 不能为了保留默认模型而把开放模型列表端点改成单模型白名单 | 保留 `modelIds: []` 语义，不在绑定或归一化时回写端点白名单 | 普通模型选择列表仍按现有语义隐藏 `modelIds: []` 端点下的任务条目，显式任务默认解析单独处理 |
| 12 个任务就弹确认过于保守 | 默认阈值迁移到 100，提交确认改为严格大于阈值 | 用户自定义为其他非 12 值会保留，最大限制为 1000 |
| 历史卡片长期显示默认背景参数，信息价值低 | 保存并显示请求分辨率，默认 `auto` 背景/审核不再占用历史卡片行 | 旧历史没有 `size` 时不会凭空推断分辨率，只隐藏默认背景/审核 |

## 验证

| 检查项 | 命令或场景 | 结果 |
| --- | --- | --- |
| 目标单元测试 | `rtk npm test -- src/lib/provider-model-catalog.test.ts src/lib/provider-model-binding.test.ts src/lib/batch-config.test.ts src/lib/image-history.test.ts` | 通过，4 个测试文件，92 个用例 |
| 类型检查 | `rtk npm run typecheck` | 通过 |
| Lint | `rtk npm run lint` | 通过 |
| 桌面浅色 UI | `rtk npm run dev` + Playwright，1440x1000，`theme=light`，注入一条历史记录 | 页面无 console error；历史卡片显示 `1536x2048`，未显示 `背景 auto` |
| 移动深色 UI | Playwright，390x844，`theme=dark` | `htmlClass=dark`；历史卡片显示 `1536x2048`，未显示 `背景 auto` |
| 设置页阈值 UI | 移动深色设置页进入“批量配置 -> 数量与安全” | `batch-confirm-threshold` 值为 `100`，`max` 为 `1000` |
| Tauri 运行时 | 未启动 Tauri 桌面/Android | 本次没有新增桌面专属 API；共享配置、历史保存和 Web UI 已验证，Tauri 静态运行时未单独启动 |

## 后续建议

- 后续如果要支持从旧历史图片实际尺寸反推历史分辨率，应走异步、按需、缓存化路径，避免扫描历史图片字节。
- 可以在批量提交流程补一个更小的纯函数或组件测试，直接覆盖 `enabledCount === 100` 不弹、`enabledCount === 101` 弹的交互边界。
