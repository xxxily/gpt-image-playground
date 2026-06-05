# 运行任务详情展开

| 字段     | 内容                                                                 |
| -------- | -------------------------------------------------------------------- |
| 日期     | 2026-06-05                                                           |
| 状态     | 已完成 (Completed)                                                   |
| 相关请求 | 运行任务栏在用户需要时展示当前供应商接口、模型和参数等高级概要信息。 |
| 相关文档 | [CHANGELOG.md](../../CHANGELOG.md)                                   |
| 改动范围 | 任务提交快照、运行任务栏 UI、i18n、运行详情格式化工具和测试。        |
| 提交状态 | 未提交                                                               |

## 范围核对

| 请求目标                     | 实际结果                                                                                         | 证据                                                                            | 状态               |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------ |
| 默认不直接展示详细信息       | 任务栏默认仍只显示提示词、状态、耗时和操作按钮；详情仅在点击箭头按钮后展开。                     | `src/components/task-tracker.tsx`                                               | 已完成 (Completed) |
| 显示供应商、端点、模型和参数 | 图片与图生文提交时保存 `runDetails` 快照，展示供应商、端点、Base URL、连接模式、模型和关键参数。 | `src/features/workbench/page/workbench-page.tsx`、`src/hooks/useTaskManager.ts` | 已完成 (Completed) |
| 方便频繁切换端点后的故障定位 | 运行详情在任务入队时保存，不受提交后表单再次切换端点或模型影响。                                 | `createQueuedTaskState` 保存 `params.runDetails`                                | 已完成 (Completed) |
| 移动端可用                   | 使用可点击、可聚焦图标按钮展开详情；面板移动端单列、桌面双列，长 URL/JSON 自动换行。             | `TaskRunDetailsPanel` 的响应式 grid 和 `break-words`                            | 已完成 (Completed) |
| 不暴露敏感信息               | API Key 不进入详情；Base URL 清理凭证、query、hash；供应商参数敏感键脱敏为 `<<redacted>>`。      | `src/lib/task-run-details.ts`、`src/lib/task-run-details.test.ts`               | 已完成 (Completed) |
| UI 文案走 i18n               | 新增 `tasks.details.*` 中英文消息，并通过 i18n key 集合测试。                                    | `src/lib/i18n/messages.ts`、`src/lib/i18n/messages.test.ts`                     | 已完成 (Completed) |
| 视频任务覆盖                 | 当前首页运行任务栏不承载视频任务；本次预留视频运行详情 helper，未改变视频输出区行为。            | `src/lib/task-run-details.ts`                                                   | 不适用 (N/A)       |

## 问题与解决

| 问题                                            | 解决办法                                                                             | 剩余风险                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| hover 详情不适合移动端                          | 改为显式箭头按钮展开，桌面 tooltip 只解释按钮用途，不承载详情内容。                  | 无明显剩余风险。                                         |
| 详情可能泄露凭证或自定义参数中的敏感值          | 不传 API Key；URL 展示前移除凭证、query、hash；JSON 参数按敏感键递归脱敏。           | 用户若把敏感内容放在非敏感命名字段中，系统无法语义识别。 |
| 批量任务在 `buildSubmitParams` 之后才追加元数据 | 队列创建时统一把批次名和批次序号追加到 `runDetails`，避免批量任务丢失上下文。        | 无明显剩余风险。                                         |
| 适配器和模型可能有内置供应商参数                | 图片详情合并适配器默认参数、模型内置参数和用户自定义覆盖，并统一显示为“供应商参数”。 | 极少数运行时内部派生参数仍可能没有逐项展示。             |

## 验证

| 检查项             | 命令或场景                                                                                                                      | 结果                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 格式化             | `npx prettier --write ...`                                                                                                      | 通过                                                                 |
| 类型检查           | `npm run typecheck`                                                                                                             | 通过                                                                 |
| Lint               | `npm run lint`                                                                                                                  | 通过                                                                 |
| 单元测试           | `npx vitest run src/lib/task-run-details.test.ts src/lib/i18n/messages.test.ts`                                                 | 通过，2 个文件 5 个测试                                              |
| 全量测试           | `npm test`                                                                                                                      | 通过，102 个文件 988 个测试                                          |
| Web build          | `npm run build`                                                                                                                 | 通过；仍有既有 `history-assets` broad-pattern Turbopack warning      |
| 桌面静态构建       | `npm run build:desktop`                                                                                                         | 通过                                                                 |
| 浏览器桌面浅色主题 | Playwright CLI 打开 `http://localhost:3000`，提交测试任务，展开运行详情。截图：`.playwright-cli/task-details-desktop-light.png` | 通过，详情按钮默认收起，展开后显示供应商、端点、Base URL、模型和参数 |
| 浏览器桌面深色主题 | 同一任务切到深色主题并截取任务栏元素。截图：`.playwright-cli/task-details-desktop-dark-element.png`                             | 通过，详情面板可读，无明显重叠                                       |
| 浏览器移动深色布局 | 视口 `390x844`，深色主题，截取任务栏元素。截图：`.playwright-cli/task-details-mobile-dark-element.png`                          | 通过，详情单列显示，按钮可点                                         |
| 浏览器移动浅色布局 | 视口 `390x844`，浅色主题，截取任务栏元素。截图：`.playwright-cli/task-details-mobile-light-element.png`                         | 通过，详情单列显示，按钮可点                                         |
| Tauri 路径         | `npm run build:desktop`                                                                                                         | 通过静态导出；未启动桌面客户端交互                                   |

## 浏览器验证说明

- in-app browser 所需的 JavaScript 控制工具在本会话未暴露，已改用 `playwright-cli` 验证本地页面。
- 测试任务使用本机现有配置提交，因 API Key 无效而进入失败状态；这是为了触发运行任务栏，未记录或写入任何 raw API Key。
- Playwright 浏览器与本次启动的 dev server 均已关闭。

## 后续建议

- 如果后续希望视频任务也出现在同一个运行任务栏，可把 `VideoTaskRecord.runDetails` 映射到 `TaskTracker`，并为视频取消/重试单独路由操作。
- 若需要更完整的端点调试，可在详情中增加供应商 request id 或响应侧 trace id，但需要确认各接口返回字段和脱敏规则。
