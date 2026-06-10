# 历史审核标签与离页拦截优化

| 字段     | 内容                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日期     | 2026-06-10                                                                                                                                        |
| 状态     | 已完成 (Completed)                                                                                                                                |
| 相关请求 | 1. 图片生成历史列表中审核信息不要单独一行，改为和文件大小、后缀、模型等参数一样用标签展示。2. 只有存在运行中任务时才阻止刷新或关闭页面。        |
| 相关文档 | [历史与资产管理](../history-and-assets.md)、[工作台界面说明](../workspace.md)                                                                     |
| 改动范围 | 历史图片卡片元信息布局、Web 离页拦截条件、工作台运行时辅助函数与测试、相关用户文档。                                                             |
| 提交状态 | 未提交；工作树中另有本次未改动的既有变更：`docs/README.md`、`docs/community-outreach/`、`docs/agent-reports/2026-06-07-community-demand-discovery.md` |

## 范围核对

| 请求目标 | 实际结果 | 证据 | 状态 |
| -------- | -------- | ---- | ---- |
| 审核信息不再单独占一行 | `src/components/history/history-image-card.tsx` 将非默认 `background` 与 `moderation` 合并到模型、质量、尺寸、格式、文件大小同一标签行；删除原来的二级说明行。 | Playwright DOM 验证：历史卡片行内容为 `gpt-image-1 high 1024x1024 webp 背景 transparent 审核 low 2.00 KB`，`moderationTagCount: 1`，标签 class 为 `bg-muted/60 ... rounded-md ...`。截图：`.playwright-cli/history-moderation-tag-light-desktop.png`、`.playwright-cli/history-moderation-tag-dark-desktop.png`、`.playwright-cli/history-moderation-tag-light-mobile.png`、`.playwright-cli/history-moderation-tag-dark-mobile.png`。 | 已完成 (Completed) |
| 仅运行中任务阻止刷新/关闭 | 移除生成表单和编辑表单中基于长提示词、源图片数量的 `beforeunload` 拦截；新增 `hasBlockingUnloadTask`，只在图片/图生文任务 `queued/running/streaming` 或视频任务 `queued/running/polling` 时注册 Web `beforeunload`。 | 单元测试覆盖终态不拦截、图片/视频活跃态拦截；浏览器上传源图后刷新返回 `dialogCount: 0`。 | 已完成 (Completed) |
| 保持 Web/Tauri 差异 | 新的阻止刷新逻辑仍在 `isTauriDesktop()` 时跳过；桌面端不新增浏览器确认框。 | `src/features/workbench/page/workbench-page.tsx` 中 `if (isTauriDesktop() || !shouldBlockPageUnload) return;`；`rtk npm run build:desktop` 通过。 | 已完成 (Completed) |
| 文档同步 | 更新历史卡片包含内容说明和 Web 离页确认规则。 | `docs/history-and-assets.md`、`docs/workspace.md`。 | 已完成 (Completed) |

## 问题与解决

| 问题 | 解决办法 | 剩余风险 |
| ---- | -------- | -------- |
| 历史卡片审核参数单独成行，和其他参数展示不一致。 | 将 `moderation` 迁入已有参数标签行，复用现有 i18n 文案和标签样式。 | 非默认背景和审核同时存在时同处一行；窄屏会自然换行，但不再新增独立说明行。 |
| 旧逻辑只要有源图或长提示词就阻止刷新，影响普通退出。 | 删除表单内离页拦截，把判断集中到工作台任务队列状态。 | 浏览器原生 `beforeunload` 文案仍由浏览器控制；这是平台限制。 |
| Browser 插件的首选控制入口在本会话未暴露。 | 已按插件说明做工具发现，未找到 Node REPL `js` 入口；改用已安装的 `playwright-cli` 回退验证。 | 使用的是回退浏览器验证路径，不是 in-app Browser 插件路径。 |
| 验证期间同时执行生产/桌面构建，dev 页面出现临时 404 和 Fast Refresh 控制台噪声。 | 复核 DOM 和截图结果，判断为构建产物切换导致的本地验证噪声；构建命令本身通过。 | 不影响本次功能验证；后续若要做严格控制台零错误检查，应避免边构建边浏览。 |

## 验证

| 检查项 | 命令或场景 | 结果 |
| ------ | ---------- | ---- |
| 定向单元测试 | `rtk npm test -- src/features/workbench/state/runtime.test.ts` | 通过，1 个测试文件，4 个测试。 |
| Lint | `rtk npm run lint` | 通过。 |
| Typecheck | `rtk npm run typecheck` | 通过。 |
| Web 构建 | `rtk npm run build` | 通过；仍有既有 `src/app/api/history-assets/route.ts` Turbopack broad-pattern 警告，非本次引入。 |
| 桌面静态构建 | `rtk npm run build:desktop` | 通过。 |
| Diff 空白检查 | `rtk git diff --check` | 通过。 |
| Prettier 检查 | `rtk npx prettier --check ...` | 输出 `Prettier: All files formatted correctly`；RTK 返回码异常为 1，按输出判断格式正确。 |
| 桌面浅色 UI | Playwright CLI 注入一条带 `moderation: low` 的历史记录，截图 `.playwright-cli/history-moderation-tag-light-desktop.png` | 审核信息显示为同一参数标签行。 |
| 桌面深色 UI | Playwright CLI 切换 `theme=dark`，截图 `.playwright-cli/history-moderation-tag-dark-desktop.png` | 标签可见，布局未出现单独审核行。 |
| 移动深色 UI | Playwright CLI `390x844`，截图 `.playwright-cli/history-moderation-tag-dark-mobile.png` | DOM 确认 `hasModerationTag: true`，截图保存成功。 |
| 移动浅色 UI | Playwright CLI `390x844`，截图 `.playwright-cli/history-moderation-tag-light-mobile.png` | DOM 确认 `hasModerationTag: true`，截图保存成功。 |
| 源图刷新体验 | Playwright CLI 上传 `.playwright-cli/batch-edit-a.png` 后刷新页面，监听 `dialog` | 返回 `dialogCount: 0`，仅存在源图不会阻止刷新。 |

## 后续建议

- 若产品希望“有未提交草稿时提醒但不使用原生浏览器弹窗”，可以后续在应用内提供轻量草稿恢复提示；本次已保留现有 prompt draft 自动保存。
- 后续严格 UI 验证时建议单独运行 dev server，不与 `next build` 并发，避免控制台噪声干扰判断。
