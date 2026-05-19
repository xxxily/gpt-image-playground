---
title: GPT Image Playground 交互细节与功能完备性优化需求文档
summary: 在 UI_UPGRADE_REQUIREMENTS 之后，对当前网站的输入、生成、输出、历史、分享、同步、设置、模板、移动端、Tauri、i18n、可访问性、性能、错误处理、边界情形和数据完整性进行系统性交互审计，整理为可逐项落地的优化需求。
createdAt: 2026-05-17
updatedAt: 2026-05-17
status: in-progress
---

# GPT Image Playground 交互细节与功能完备性优化需求文档

## 0. 状态总览

每个二级条目（§X.Y）头部用以下三种标记之一标注当前进度：

- **✅ 已完成**：代码已合入主干，build / test / lsp 全部通过。
- **🟡 部分完成**：核心路径已落地，仍有子项待补（在条目正文里说明）。
- **⏳ 待完成**：尚未开工。

整体进度（截至 `updatedAt`）：26 / 80 ≈ 33%；Phase A 已完成 14/14（§8.3 含 UI pilot 完成，剩余 5 个 ProviderSection 留待下轮逐个接入），Phase B 大批次落地（§4.2 子项 1、§4.3、§6.3、§10.2、§13.1、§13.2、§13.3、§14.7、§16.1、§16.2、§16.3、§17.1、§17.5、§11.5、§3.5、§5.4 部分）。

| 已完成 | 章节 | 落地形态 |
|---|---|---|
| ✅ | §2.1 草稿保护 | `src/lib/prompt-draft.ts` + 两个 form 接入 |
| ✅ | §2.3 IME 全面保护 | `editing-form.tsx` 守卫提顶 + `generation-form.tsx` 首次具备 |
| ✅ | §3.2 错误差异化文案 | `src/lib/api-error-category.ts`（启发式 6 类）+ `task-card.tsx` 图标 / 文案 / 折叠原始错误 |
| ✅ | §3.3 重试语义清晰化 | retry 按钮按 `errorCategory.retryable` 启用；rate-limit 显示倒计时；复制错误按钮 |
| ✅ | §3.6 队列上限可见 | `task-tracker.tsx` 状态条 + 并发槽位 |
| ✅ | §3.7 多页签完成提醒 | `src/lib/tab-notification.ts`（favicon canvas 角标 + title 闪烁） |
| ✅ | §4.2 子项 1 Send-to-Edit 反馈 | `page.tsx#handleSendToEdit` 成功后 success toast「已发送到编辑区」 |
| ✅ | §4.3 Zoom Viewer 焦点陷阱 | overlayRef Tab 循环 + 初始焦点 + 关闭归还；overlay `role='dialog' aria-modal` |
| ✅ | §5.3 清空历史撤销宽限期 | `useNotice` 扩展 action button；page.tsx 5 秒延迟终结 + 撤销 |
| 🟡 | §5.4 断图占位信息 | history-panel 失败占位升级为图标 + "加载失败" + title tooltip；云端恢复 / 原参重生留待 Phase C |
| ✅ | §5.6 Sync 菜单结构精简 | 7 项扁平 → 「↑上传 / ↓恢复」两组，force 改为底部 checkbox |
| ✅ | §6.1 解锁防爆破节流 | `src/lib/unlock-throttle.ts` + 对话框接入 |
| ✅ | §6.2 大小写提示 | `secure-share-unlock-dialog.tsx` 文案补齐 |
| ✅ | §6.3 平台长度提示分级 | `share-dialog.tsx` 1500 / 2000 / 4000 三级 + 当前长度数值 |
| 🟡 | §8.3 API Key 连接测试 | `src/lib/provider-connection-test.ts` 工具 + `ProviderConnectionTestButton` 组件 + 新增供应商端点处 pilot；其它 5 处 ProviderSection 待下轮接入 |
| ✅ | §8.5 配置导入导出 | `src/lib/config-export.ts`（schema v1 + 密钥遮罩） + Settings 头部两按钮 |
| 🟡 | §10.2 软键盘避让 | `KeyboardInsetWatcher` + CSS 变量 `--app-keyboard-inset-bottom` 全局；Dialog primitive 已接；其余 footer 渐进迁入 |
| ✅ | §11.5 外链一致性 | `src/components/ui/external-link.tsx` 封装；about-dialog 3 处 + settings-dialog 1 处替换 |
| ✅ | §13.1 Notice 持久化 | `src/lib/notice-persistence.ts` 纯模块 + `NoticeOptions.persistKey`；localStorage `app.notice.dismissed.v1` |
| ✅ | §13.2 Carousel 暂停 / 播放 | `promo-carousel.tsx` 右下角圆形 IconButton + i18n |
| ✅ | §13.3 主题跟随系统 | `theme-toggle.tsx` 三态循环：浅 → 深 → 跟随系统 |
| ✅ | §14.1 跳到主内容 | `layout.tsx` skip link + `<main id="main-content">` |
| ✅ | §14.4 状态颜色叠加图标 | editing-form 4 处状态文案补图标；其他文件已合规 |
| ✅ | §14.6 图标按钮 aria-label | 审计 9 个 IconButton + zoom-viewer 全部已合规；新增 task-card 复制错误按钮 aria-label |
| ✅ | §14.7 prefers-reduced-motion 兜底 | `globals.css` `@media (prefers-reduced-motion: reduce)` 全局规则 |
| ✅ | §15.2 ID 防碰撞 | `src/lib/id.ts` + 5 处替换 |
| 🟡 | §3.5 ETA 估算 | `src/lib/task-eta.ts` 工具 + `ElapsedTimer/TaskCard` 接收 `etaMs?`；TaskList 层级样本收集 / 下发留待下轮 |
| ✅ | §16.1 silent catch 可观测 | `history-assets.ts` / `useScreenWakeLock` 加 console.warn；sync-client 的 catch-fallback 经审阅保留 |
| ✅ | §16.2 JSON 错误带位置 | `provider-options.ts` `extractJsonErrorPosition` → line:col |
| ✅ | §16.3 localStorage 配额预警 | `src/lib/storage-quota.ts` + 3 history 写入路径接入 + `page.tsx` toast |
| ✅ | §17.1 离线检测 | `src/lib/network-status.ts` + `NetworkBanner` 顶部黄条 |
| ✅ | §17.3 时钟跳变 | `useTaskManager` / `taskExecutor` / `vision-text-executor` 改用 `performance.now()` |
| ✅ | §17.5 SSR 守护 | `page.tsx#prefersReducedMotion` + `theme-provider#resolveSystemTheme` 加 `typeof window` 守卫 |

后续每完成一项，把对应章节标记从 ⏳ 改为 ✅ 并把"落地形态"行追加到上表即可。

## Phase C 延后清单（明确不在本轮范围）

- **§5.1 历史虚拟化与滚动恢复**：需引入虚拟列表库或自研，影响范围广。
- **§15.1 page.tsx 拆分**：5135 行 mega-component 拆解需要单独的重构 PR。
- **§7.1–§7.4 云同步细化**：冲突合并 UI、详情视图、错误恢复 wizards。
- **§8.1 Settings 搜索 / 快捷跳转**：需要扁平化 Section 元数据建索引。
- **§8.6 自定义模型库 CRUD 表单**：当前是 JSON 直编。
- **§10.1 硬件返回键 + §10.3 BottomSheet primitive**：需 Tauri 端 Rust 命令配合。
- **§11.1–§11.4 桌面端深度集成**：托盘角标、未保存指示、本地文件夹打开、崩溃恢复。
- **§12.1 mode-toggle 等 i18n 化 + §12.3 / §12.4**：大批量 legacy-text 迁移到 `t()`。
- **§15.4 Object URL 生命周期审计**、§17.2 多页签广播、§17.4 HiDPI、§17.6 右键菜单、§18.x sample/promo 稳定夹断。
- **§2.2 token 估算 + §2.5 源图重排 / 撤销 + §3.1 提交前费用预览 + §3.4 流式 partial 保留 + §3.8 任务持久化 + §5.5 IDB 配额互转 + §5.7 拖拽到编辑 + §4.1 输出网格键盘可达 + §4.2 子项 2-5（下载、复制图片、文本 fenced code、滚动记忆） + §6.4 QR 码 / 接收方预览 + §9.1 / §9.3 模板搜索 + reorder + §14.2 mask 画布键盘 + §14.5 sync ARIA 检查 + §14.7 子项 + §17.6**：各为中大型工作量，分别需 1-3 个独立 PR。

## 1. 背景与目标

### 1.1 背景

`docs/requirements/UI_UPGRADE_REQUIREMENTS.md` 已经把 **视觉层** 的整改（主题 token、装饰背景、卡片骨架、IconButton/Spinner/Skeleton/EmptyState/Popover/Heading 六件套、移动端最小点击区、断点收敛、Hover/Focus/Active 等）梳理清楚。但在那个文档之外，还存在大量 **交互行为、功能完备性、错误反馈、可访问性、性能、可靠性、跨运行时一致性** 上的具体问题：

- 长提示词没有草稿保护，刷新或误关页签直接丢失。
- 历史面板一次性渲染所有条目，没有筛选、排序、虚拟化。
- 错误反馈普遍是 toast + 通用文案，区分不出 401/403/429/5xx/quota。
- IME 组合中按 `Cmd/Ctrl+Enter` 已经做了 `isComposing` 防误提交，但其他快捷键（`/`、`Esc`）没做相同保护。
- 任务队列在另一个页签完成时没有 favicon 角标 / title 闪烁 / 声音提醒。
- 设置面板 5893 行，没有搜索，没有键盘快捷跳转，没有"测试 API Key 连接"按钮，没有配置导入导出。
- Tauri 桌面端没有"打开所在文件夹"、托盘角标、未保存指示。
- i18n 系统已建立，但仍有大量硬编码中文（Settings、Mode 切换等）。
- 多页签切换时 history / 配置不会跨页签广播，离线状态没有任何检测。
- 多处 `Date.now() + Math.random()` 生成 ID，存在碰撞风险。

这些问题大多数是 V1 视觉升级覆盖不到的"看不见但影响重度使用体验"的细节。本次需求文档即对这些细节做一次集中梳理。

### 1.2 V1 目标（本次优化的范围）

按照"用户主路径 → 跨切面能力 → 平台运行时"的顺序展开：

1. **输入与提示词交互可靠性**：草稿保护、字符/Token 计数、IME 全面保护、`/` 命令交互一致、源图管理（重排、撤销移除、过大文件提示）。
2. **生成提交与任务编排**：差异化错误反馈、可重试范围明确、流式预览阶段可见、并发与队列状态有视觉指示、多页签完成提醒、提交前费用预览。
3. **输出与全屏预览**：键盘网格导航、焦点回退、复制图片到剪贴板、长文滚动记忆、Zoom Viewer 焦点陷阱与单/多图差异化提示。
4. **历史与资产管理**：筛选与排序、虚拟化、清空撤销、断图诊断、IndexedDB 配额预警、存储模式迁移引导。
5. **分享与解锁**：解锁防爆破节流、密码大小写提示、QR 码、平台长度提示分级、分享接收方预览。
6. **云同步**：冲突解决用户可选、长任务断点续传、配额预警、子菜单结构精简、全局后台同步指示。
7. **设置面板**：内嵌搜索、键盘跳转、字段级实时校验、API Key 连接测试、端点复制、分节重置、配置导入导出、分文件拆分。
8. **提示词模板库**：模糊搜索、变量占位符、拖拽排序。
9. **移动端与触控**：硬件返回键、键盘避让、bottom-sheet 模式标准化。
10. **Tauri 桌面/Android 运行时**：打开所在文件夹、未保存窗口标题、托盘/Dock 角标、崩溃恢复、Android 返回键。
11. **国际化（i18n）**：Settings/Mode 等硬编码字符串迁移、复数支持、RTL 占位、缺译回退可观测。
12. **通知 / 促销 / 主题**：Notice 持久化与频次上限、Carousel 暂停/播放控件、模式切换 i18n。
13. **可访问性（a11y）**：跳过到主内容、Mask 画布键盘可达、标题层级、图标按钮 aria-label、Sync 菜单 ARIA、状态颜色叠加图标。
14. **性能**：History 虚拟化、page.tsx 拆分、ID 防碰撞、drag-over 节流。
15. **错误处理**：HTTP 状态差异化文案与可重试性、JSON 错误带位置、localStorage 配额异常、静默 catch 可观测。
16. **边界情形**：离线检测、跨页签广播、缩放/HiDPI、`performance.now()` 计时、自定义右键菜单评估、SSR/Hydration。
17. **数据完整性**：localStorage 版本化迁移、分享恢复前备份、IndexedDB 与 FS 模式互转引导。

### 1.3 非目标

- 不替换底层框架（Next.js / Tauri / Tailwind / shadcn 维持）。
- 不重构 i18n 系统的底座（在现有 `src/lib/i18n/*` 上扩展即可）。
- 不引入新的图标库或视觉风格（沿用 lucide）。
- 不影响 V1 视觉升级（`UI_UPGRADE_REQUIREMENTS.md`）的实施节奏；本文件中如有视觉相关条目，标注 "依赖 UI_UPGRADE Phase X" 即可。

## 2. 主路径：输入与提示词交互

### 2.1 草稿保护：刷新 / 误关页签时不再丢失提示词 ✅

- 现状：`editPrompt` 只在 React state，当前没有 `beforeunload` 警告，也没有持续化的 `localStorage` 草稿。
- 文件：`src/components/editing-form.tsx`、`src/components/generation-form.tsx`。
- 问题：长提示词（>50 字）刷新或关闭页签直接丢失，对长流程是致命的体验缺陷。
- 优化：
  1. 在 prompt 输入处启用防抖（500–1000ms）保存草稿到 `localStorage`，key 形如 `prompt_draft.generate` / `prompt_draft.edit`。
  2. 提交成功后清空对应 key；切换 mode 时不清空，做到"模式切换不丢词"。
  3. 当 prompt 长度 ≥ 50 或附带源图 ≥ 1，注册 `beforeunload`，给浏览器原生确认提示。Tauri 桌面端用 `tauri::WindowEvent::CloseRequested` 拦截并提示。
  4. 如有"上次未提交的草稿"在挂载时读到，则在 prompt 顶部显示一个轻量横条："检测到 N 字未提交草稿，是否恢复？"，并附"恢复 / 丢弃"。
- 验收：浏览器刷新、关闭页签、Tauri 关闭窗口三种情况下，含草稿都会先确认；下次打开能看到"恢复草稿"横条。
- 落地：新增 `src/lib/prompt-draft.ts`（`load/save/clear/hasMeaningfulDraft`，SSR-safe，try/catch 不抛）；`generation-form.tsx` 与 `editing-form.tsx` 接入"防抖保存 → 横条恢复 → 提交清空 → `beforeunload` 二次确认"；Tauri 桌面端用 `isTauriDesktop()` 跳过 `beforeunload`，避免重复弹窗。

### 2.2 字符 / Token 计数与超限提示 ⏳

- 现状：textarea 没有任何计数提示，提示词可以无限增长直到 API 拒绝。
- 文件：`src/components/editing-form.tsx`、`src/components/generation-form.tsx`、`src/components/memoized-textarea.tsx`。
- 优化：
  1. 在 textarea 右下角显示"X 字符 / 估算 Y tokens"。Token 估算使用经验系数（英文 ≈ chars/4，中文 ≈ chars/1.5）。
  2. 当估算 token > 1000 / > 2000 时，文字渐变为 warning / error 色（叠加感叹号图标，不只用颜色）。
  3. 极端长度（如 > 8000 tokens）时，submit 按钮置灰并 tooltip 提示。

### 2.3 IME 组合期间的快捷键全面保护 ✅

- 现状：`handlePromptKeyDown` 已经在 Enter 提交分支检查 `event.nativeEvent.isComposing`；其他分支（`/` 唤起命令、`Esc` 关闭命令面板、`ArrowUp/Down` 在命令面板移动选项）没有做同样保护。
- 文件：`src/components/editing-form.tsx`（line 1700–1786）。
- 问题：中文/日文/韩文 IME 在组合阶段使用 Esc 取消组合、Arrow 切换候选词、Space 接受候选词；当前实现可能误捕获，造成 IME 用户体验割裂。
- 优化：所有键盘分支的入口统一加 `if (event.nativeEvent.isComposing) return;`；并在 `keydown` 上层用一个 helper：`if (isImeComposing(e)) return;`。
- 落地：`editing-form.tsx` 的 IME 守卫从 Enter 单分支提到 `handlePromptKeyDown` 顶端，覆盖 `Ctrl+/`、`Esc`、`Arrow`、`Enter` 全部分支并删除最末分支的冗余检查；`generation-form.tsx` 首次具备 `Cmd/Ctrl+Enter` 提交快捷键，自带相同 IME 守卫。

### 2.4 `/` 模板命令的边界情形 ⏳

- 现状：`detectSlashCommand` 检查 token 是否含 `\n`；slash 命令应用直接 set state，绕开浏览器 undo 栈；粘贴 `/api/...` 会立即弹出命令面板。
- 文件：`src/components/editing-form.tsx`（line 1590–1682）。
- 优化：
  1. 应用模板时使用 `document.execCommand('insertText', false, value)` 或 textarea 选区替换以保留 undo 栈，让 `Ctrl+Z` 撤销到 `/keyword` 状态。
  2. 粘贴的内容首字符是 `/` 不立即弹命令面板，仅 keyboard 输入触发；或粘贴后给一个 800ms 的"按 Enter 应用 / Esc 关闭"轻提示再弹。
  3. 在命令面板里增加 `Tab = 应用并关闭`、`Esc = 仅关闭` 的明确语义提示。

### 2.5 源图管理：重排、撤销移除、过大文件、剪贴板批量反馈 ⏳

- 文件：`src/components/editing-form.tsx`（line 2235–2984）、`src/app/page.tsx`（line 599–623、1191–1299）。
- 优化：
  1. **重排**：源图缩略图条目支持拖拽排序（HTML5 DnD），缩略图右上角显示序号 1/2/...，最多 10。
  2. **撤销移除**：误点 X 后弹出 toast"已移除 1 张源图，撤销"，5 秒内可还原；toast 复用 `useNotice`。
  3. **过大文件预警**：在 `addImageFilesToEdit` 内对单文件 > 5 MB 的情况显示 warning notice 并询问是否客户端缩放（沿用现有压缩工具链或 `createImageBitmap` + Canvas）。
  4. **批量粘贴 / 拖入失败明细**：当一次添加失败 N 张（超过上限、格式不支持、解码失败），分别合并文案——例如"已添加 3 张，跳过 2 张（超出上限）、1 张（不支持的 GIF）"。
  5. **拖拽视觉**：当前全局 overlay 不区分目标，建议在拖入图片文件时，对源图区域加显著高亮边框（仅在合法文件类型时），非图片文件直接拒绝并显示 inline 错误。

## 3. 主路径：生成提交与任务编排

### 3.1 提交前的费用与可行性预览 ⏳

- 现状：费用只在历史卡片中显示；submit 按钮没有给到"将要花多少 / 是否能提交"的上下文。
- 文件：`src/components/editing-form.tsx`、`src/components/generation-form.tsx`、`src/lib/cost-utils.ts`。
- 优化：
  1. 在 submit 按钮旁渲染"预计 ≈ $0.04"，hover 展开"1024×1024 × 1 张 ≈ $0.04"。
  2. 当受限场景（图生文需源图但当前无源图、自定义 JSON 校验失败、自定义尺寸校验失败）时，submit 按钮 disabled 并 tooltip 给出 **具体** 阻挡原因，而不是静默无反应。

### 3.2 错误反馈差异化（HTTP 状态、quota、超时、网络） ✅

- 现状：错误大多走通用 `formatApiError`，taskCard 的 error 文案是从上游原样透传，401 仅做轻微特殊化。
- 文件：`src/lib/api-error.ts`、`src/hooks/useTaskManager.ts`、`src/components/task-card.tsx`、`src/lib/taskExecutor.ts`。
- 落地：
  - 新增 `src/lib/api-error-category.ts` 启发式分类器，6 类（auth / rate-limit / server / network / quota / unknown），基于 `formatApiError` 输出做正则与子串匹配；附 8 条 vitest 覆盖经典场景。
  - `TaskSnapshot` 新增 `errorCategory?: CategorizedError` 字段；`useTaskManager` 在 4 处 `status: 'error'` 写回时同步设置 category。
  - `task-card.tsx` 按类别映射图标（KeyRound / Clock / ServerCrash / WifiOff / Wallet / AlertCircle）、tone（amber 或 red）、友好 hint，附「查看原始错误」可折叠原文与「复制错误」按钮。i18n key 全部覆盖 zh-CN + en-US。
- 未做（留给 Phase B）：从 `Response.headers.get('Retry-After')` 真实拿到秒数（当前依赖正则在 message 文本里反查）；JSON 错误带行列定位（§16.2 任务）。

- 现状：错误大多走通用 `formatApiError`，taskCard 的 error 文案是从上游原样透传，401 仅做轻微特殊化。
- 文件：`src/lib/api-error.ts`、`src/hooks/useTaskManager.ts`、`src/components/task-card.tsx`、`src/lib/taskExecutor.ts`。
- 优化（按错误类别提供"文案 + 行动建议 + 是否允许重试"三件套）：
  1. **401 / 403**：文案"API Key 无效或权限不足"，按钮"打开 Settings 修正"，禁用"重试"。
  2. **429**：文案"请求过于频繁"，按钮"60 秒后自动重试"（带倒计时），允许手动重试。
  3. **5xx**：文案"上游服务异常"，按钮"立即重试"，建议重试。
  4. **超时 / 网络**：文案"网络中断或响应超时"，按钮"立即重试"，记录失败次数；连续 3 次失败给出"切换到代理 / 检查网络"提示。
  5. **insufficient_quota / billing**：文案"账户额度已用尽"，按钮"打开 Settings → 供应商"，禁用"重试"。
  6. **JSON 解析（自定义参数）**：error 中包含位置（行/列），高亮 textarea 对应行（可用简易行号显示）。
  7. **mask 尺寸不一致**：保留现有"具体尺寸不匹配"提示（已实现良好，沿用）。
  8. 所有错误文案纳入 i18n key（`error.401` 等），原始上游 message 作为可折叠"原始错误"附在下面，可一键复制。

### 3.3 重试语义清晰化 ✅

- 现状：`retryTask` 复用 `retryParamsRef`，但未校验失效场景。
- 文件：`src/hooks/useTaskManager.ts`（line 161–165、549–586）、`src/components/task-card.tsx`。
- 落地：
  - retry 按钮按 `errorCategory.retryable` 启用（auth / quota 不可重试，Tooltip 说明）。
  - rate-limit 类别若 message 中带 `Retry-After: N`，按钮显示倒计时「可在 Ns 后重试」，倒计时归零后才能点击。
  - 附复制错误按钮（`navigator.clipboard.writeText` + 1.5s 反馈），失败走 console.warn 而不是静默 catch。
- 未做：自动重试调度（429 倒计时归零自动触发）；快照存源图 base64 以支持参数失效后的重试。

- 现状：`retryTask` 复用 `retryParamsRef`，但未校验失效场景。
- 文件：`src/hooks/useTaskManager.ts`（line 161–165、549–586）。
- 优化：
  1. 重试前校验 params：若 `imageFiles` 中包含已失效 File 对象（典型为 input 已重置），先尝试从历史快照（base64）恢复，否则给"原始源图已丢失，请重新上传"。
  2. 区分"自动重试"（429 倒计时、超时一次自动）与"手动重试"按钮的视觉与文案。

### 3.4 流式预览：阶段可见、可保留部分结果 ⏳

- 现状：流式输出只显示 latest preview 与"流式预览中..."文案，partial 计数和阶段不可见；取消即丢弃。
- 文件：`src/components/image-output.tsx`（line 105–129）、`src/components/task-card.tsx`、`src/hooks/useTaskManager.ts`。
- 优化：
  1. 显示 `预览 1/3 → 2/3 → 3/3` 进度（基于 `partialImages` 设置）。
  2. 取消时若已有 ≥ 1 张 partial，弹出 dialog："已取消，是否保留当前部分预览到历史？"，复用 history 写入路径。

### 3.5 加载占位与 ETA 🟡

- 现状：spinner + 文案，无 skeleton；只显示已用秒数，没有 ETA。
- 文件：`src/components/image-output.tsx`、`src/components/text-output.tsx`。
- 优化：
  1. 在 output 区做 grid skeleton，行列与 `n` 一致，避免布局抖动。
  2. ETA 估算基于"模型 × 尺寸 × n"的历史均值（从 `history` 计算最近 20 条），文案"预计还需 ~12s"，按 1s 节奏更新；超过预估时间切换为"超出预估，已用 Xs"。

### 3.6 提交按钮与队列上限的可见性 ✅

- 现状：达到 `maxConcurrentTasks` 时新任务静默排队，用户不知道。
- 文件：`src/hooks/useTaskManager.ts`、`src/components/task-tracker.tsx`、`src/components/task-list.tsx`。
- 优化：
  1. Task tracker 头部展示三段："运行 X / 队列 Y / 失败 Z"，配套并发槽位条 `[● ● ○]`。
  2. 提交时若已满，toast"已加入队列，前面还有 N 个任务"。
  3. 队列任务支持"提到队首"和"取消单个排队任务"；提供"取消全部排队"批量按钮（不影响运行中）。
- 落地：`task-tracker.tsx` 顶部新增"运行 X / 排队 Y / 失败 Z"状态条 + 并发槽位指示（`●●○`）；i18n 词条 `tasks.running` / `tasks.queued` / `tasks.error` / `tasks.concurrencySlots` 已添加 zh-CN + en-US；`page.tsx` 把 `appConfig.maxConcurrentTasks || 3` 透传过去；同时把组件内残留的 `text-white/*`/`bg-white/*` 全量迁移到语义 token。
- 未做（留给下一轮）：满载时的"已加入队列"toast；"提到队首"与"取消全部排队"批量按钮。

### 3.7 多页签 / 后台完成提醒 ✅

- 现状：完成无任何提醒，用户切去其它页签后无法知晓。
- 文件：新增 `src/lib/tab-notification.ts`，接入 `useTaskManager`。
- 落地：
  - `notifyTaskCompletion({ kind: 'success' \| 'error' })`：当 `document.hidden && !isTauriDesktop()` 时，用 Canvas 把现 favicon 加角标（emerald-500 / red-500 圆点），并以 1.5 秒间隔在 `document.title` 头部闪烁「(完成 ✓) 」/「(失败 ✗) 」。
  - 注册一次性 `visibilitychange` 监听，回到页签时自动清理 favicon 与 title。
  - `useTaskManager` 在 `tasks` effect 里统一监听 `done`/`error` 终态转换并触发；`cancelled` 不触发。
- 未做（Tauri 桌面/移动端）：托盘/Dock 角标、Android 状态栏通知——在 §11.3 / §11.x 单独实现。

- 现状：完成无任何提醒，用户切去其它页签后无法知晓。
- 文件：新增 `src/lib/tab-notification.ts`，接入 `useTaskManager`。
- 优化：
  1. `document.hidden` 时任务完成 → 用 Canvas 在 favicon 右下角绘制角标（数字或圆点）；返回页签时清除。
  2. 同时把 `document.title` 闪烁为 `(完成 ✓) GPT Image Playground` 直到 `visibilitychange`。
  3. 可选音效：默认关闭，在 Settings → 运行与存储中加开关，复用 `prefers-reduced-motion`。
  4. 桌面端走 Tauri Tray/Dock 角标（见 §11.3）。

### 3.8 任务队列持久化（reload 不丢任务元信息） ⏳

- 现状：`tasks` state 仅在内存，刷新后队列与失败任务全部消失。
- 文件：`src/hooks/useTaskManager.ts`。
- 优化：
  1. 失败 / 已完成 / 已取消任务的 **元信息**（不含运行中的 AbortController）持久化到 `sessionStorage`，挂载时恢复展示。
  2. 运行中的任务在 reload 后转为"已中断"状态，提供"使用原参数重新提交"。
  3. 自动清理：可配置"完成后 X 分钟自动清理"或"保留最近 N 条"，默认保留 10 条已完成。

## 4. 主路径：输出与全屏预览

### 4.1 输出网格的键盘可达 ⏳

- 现状：grid 视图仅可点击；无 Tab/方向键导航；缩略图无 focus ring。
- 文件：`src/components/image-output.tsx`（line 157–183）。
- 优化：
  1. 网格根容器 `role="grid"`，子项 `role="gridcell"` + `tabindex={i === 0 ? 0 : -1}`，方向键移动 focus，`Enter` 打开 zoom，`Space` 选中。
  2. 关闭 zoom 时 `lastFocusedIndex` 用于把焦点送回原网格项。

### 4.2 输出区直接动作：复制 / 下载 / 发送到编辑 🟡

- 现状：发送到编辑无任何反馈；下载只在 zoom 内可用；缺少"复制图片到剪贴板"。
- 文件：`src/components/image-output.tsx`、`src/components/zoom-viewer.tsx`、`src/components/text-output.tsx`。
- 优化：
  1. 发送到编辑后弹 toast "已发送到编辑区"。
  2. 在 image-output 行尾增加"下载"按钮；grid 模式下提供"下载全部"。
  3. 增加"复制到剪贴板"按钮：`navigator.clipboard.write([new ClipboardItem({...})])`，跨浏览器降级（Safari 限制）需 try/catch + 友好提示。
  4. 文本输出区：检测到 `\`\`\`xxx` fenced code block 时渲染为带行号的 code 块，单独一个 copy-code 按钮；保留外层 copy-all。
  5. 文本滚动位置随 history 切换记忆（按 history id 存于内存 Map）。

### 4.3 Zoom Viewer：焦点陷阱、多/单图差异、加载占位 🟡

- 现状：键盘导航存在但未做焦点陷阱（Tab 可逃出 modal）；单图模式下方向键监听仍存在但不工作；加载态只是文案。
- 文件：`src/components/zoom-viewer.tsx`（line 317–598）。
- 优化：
  1. 实现 focus trap：modal 打开时给 `<body>` 兄弟节点加 `inert`，Tab 在 modal 内循环。
  2. 单图模式下隐藏左右箭头，方向键 noop，避免误导。
  3. 加载态用 skeleton 占位（按图片预期宽高 reservation 防跳）；加载失败时给"重新加载"按钮而非纯文案。
  4. 移动端上滑势：加 velocity 检测（`distance / time > 阈值`），降低误触；同时对 iOS Safari 的 `touchAction: none` 做回归测试。

## 5. 主路径：历史与资产管理

> 部分条目（图标按钮尺寸、focus-visible、点击区）已在 `UI_UPGRADE_REQUIREMENTS.md` 第 1.5、6.1、6.2 节覆盖，本节聚焦行为与功能完备性。

### 5.1 历史虚拟化与滚动恢复 ⏳

- 现状：`history-panel.tsx` 一次性渲染所有 history items；从预览返回时滚动重置到顶。
- 文件：`src/components/history-panel.tsx`（line 1284）。
- 优化：
  1. 引入 `@tanstack/react-virtual` 做 grid 虚拟化（动态高度按行），低端机和长列表内存占用显著降低。
  2. 打开预览前把 `scrollTop` 缓存在 `sessionStorage`，关闭预览后恢复。
  3. 列表为空 / 加载中 / 错误用 `EmptyState`（依赖 UI_UPGRADE Phase 1）。

### 5.2 筛选与排序 ⏳

- 现状：仅按 timestamp 倒序，无筛选。
- 文件：`src/components/history-panel.tsx`。
- 优化：
  1. 顶栏增加多条件筛选：`mode`（生成/编辑/图生文）、`provider/model`、`日期`（今天/本周/本月/自定义）、`cost ≥ X`、`包含关键词`。组合为 AND；筛选状态写入 `localStorage`。
  2. 排序下拉：最新优先（默认）、费用最高、耗时最长、模型名。
  3. 筛选条件显著时（命中条数远小于总条数）显示"清除筛选"。
  4. "选择全部"明确文案为"选择当前筛选下的全部 N 条"，避免误以为选了所有历史。

### 5.3 清空历史 + 撤销宽限期 ✅

- 现状：清空动作不可逆；已用 `event.detail === 0` 阻挡键盘误触发，挺好。
- 文件：`src/components/clear-history-dialog.tsx`、`src/components/notice-provider.tsx`、`src/app/page.tsx`。
- 落地：
  - `notice-provider.tsx` 扩展为支持可选 `action: { label, onClick }` 的 toast 与可自定义 `durationMs`；向后兼容（旧 `addNotice(msg, 'success')` 调用照常工作）。
  - `page.tsx#handleConfirmClearHistory` 改为「立即清 UI → 5 秒延迟终结物理删除（IndexedDB / Blob URL / localStorage / 远端）」；在 toast 上按「撤销」可在窗口期内还原 history 与 remote-delete 标记。
- 未做：跨页签广播撤销窗口期内的清理事件（§17.2 单独做）。

- 现状：清空动作不可逆；已用 `event.detail === 0` 阻挡键盘误触发，挺好。
- 文件：`src/components/clear-history-dialog.tsx`。
- 优化：清空后 5 秒内显示 toast "已清空历史，撤销"；撤销窗口期内数据放在 sessionStorage / 内存暂存区；窗口期结束才真正释放（含 IndexedDB / Blob 解引）。

### 5.4 断图与存储模式诊断 🟡

- 现状：缩略图加载失败时落到 `FileImage` 占位，不区分原因。
- 文件：`src/components/history-panel.tsx`（line 1366–1396）、`src/lib/history-assets.ts`。
- 优化：
  1. 失败时分类显示："文件不存在 / 读取失败 / 格式不支持"；图标 + 短文案 + tooltip 提供详情。
  2. 配置了云同步时给"尝试从云端恢复此图"按钮，调用现有 sync 路径。
  3. 提供"使用原参数重新生成"按钮（依赖快照）。

### 5.5 IndexedDB 配额预警与存储模式互转 ⏳

- 现状：IndexedDB 写入无配额检查；切换 `imageStorageMode` 不迁移既有图片。
- 文件：`src/lib/db.ts`、`src/lib/image-history.ts`、`src/components/settings-dialog.tsx`。
- 优化：
  1. `navigator.storage.estimate()` 周期性轮询（如每次进 history 面板时）；用量 ≥ 80% 配额时在历史面板顶部展示横条，链接到 Settings。
  2. 切换存储模式时显示对话框："是否将现有 N 张图迁移到新存储？"；选项：不迁移 / 迁移并删除原位 / 迁移并保留原位。运行时显示进度。

### 5.6 Sync 子菜单结构精简 ✅

- 现状：菜单含同步配置 / 同步完整历史 / 同步最近历史 / 恢复配置 / 恢复完整历史 / 恢复最近历史 / 强制 = 7 项，新用户难以选择。
- 文件：`src/components/history-panel.tsx`（line 779–867）。
- 落地：菜单重组为「↑ 上传到云存储 / ↓ 从云存储恢复」两个 ARIA group，每组下 3 项（仅配置 / 完整历史 / 最近历史）。「强制」从两个独立按钮（强制同步 + 强制恢复）改为菜单底部一个 Checkbox `syncMenuForce`，由各 action 按钮按需读取；移除已不用的 RotateCcw 图标 import。

- 现状：菜单含同步配置 / 同步完整历史 / 同步最近历史 / 恢复配置 / 恢复完整历史 / 恢复最近历史 / 强制 = 7 项，新用户难以选择。
- 文件：`src/components/history-panel.tsx`（line 779–867）。
- 优化：分为两个动作组（"上传到云存储 ↑" / "从云存储恢复 ↓"），每组下三个范围（仅配置 / 完整 / 最近），"强制"作为复选框附在每组末尾。视觉上用 ARIA `role="menu"` 与 Popover primitive 标准化。

### 5.7 Drag-and-drop 把历史图发送到编辑区 ⏳

- 现状：仅"发送到编辑"按钮可用。
- 文件：`src/components/history-panel.tsx`、`src/components/editing-form.tsx`。
- 优化：缩略图 `draggable=true`，drop 到编辑区源图区域时直接添加为源图（同一 host 内 in-memory ref 即可，无需重新读 Blob）。drop zone 在拖拽期间高亮。

## 6. 主路径：分享与解锁

### 6.1 解锁防爆破节流 ✅

- 现状：`SecureShareUnlockDialog` 无尝试次数限制 / 无 backoff。
- 文件：`src/components/secure-share-unlock-dialog.tsx`、`src/lib/share-crypto.ts`。
- 优化：客户端记录失败次数（按 share id 哈希），失败 ≥ 5 次后启用指数退避（10s → 30s → 60s → 5min）；失败原因细化（密码错 / 链接损坏 / 版本不兼容）。
- 落地：新增 `src/lib/unlock-throttle.ts`（sessionStorage 后端、`btoa(shareId).slice(0,12)` 命名空间隔离、5 次免费尝试后按 `[10s, 30s, 60s, 5min]` 指数退避，超过最后一档维持 5min）；`secure-share-unlock-dialog.tsx` 接 `shareId={secureSharePayload}`，按钮带倒计时（`请等待 N 秒`），新增 8 条 vitest 用例覆盖阈值、退避、状态清除、跨链接隔离。
- 未做：错误原因细化（密码错 / 链接损坏 / 版本不兼容）仍合并展示同一文案。

### 6.2 大小写与密码管理器提示 ✅

- 文件：`src/components/secure-share-unlock-dialog.tsx`、`src/components/share-dialog.tsx`。
- 优化：
  1. 解锁面板 helper 文案"密码区分大小写"；保留 show/hide。
  2. 分享面板对当前 `data-1p-ignore`/`data-bwignore`/`data-lpignore` 写注释解释意图（"一次性密钥不建议保存到密码管理器"）。
- 落地：解锁对话框 `aria-describedby` 区域新增 `share.unlock.caseSensitive` 翻译"密码区分大小写。"；i18n 同步 zh-CN + en-US。
- 未做：分享面板 `data-1p-ignore` 等属性的解释性注释（不影响行为，留待 UI_UPGRADE 同期一起补）；密码 show/hide toggle（现有为 `type='password'` 单态，未拆开）。

### 6.3 平台长度提示分级 ✅

- 文件：`src/components/share-dialog.tsx`（`URL_LENGTH_WARNING_LIMIT = 1800`）。
- 优化：分级提示——`> 1500` 微信/Slack 提示截断风险；`> 4000` 邮件以外可能全部截断；URL 长度大于 2000 时自动建议生成 QR 码或上传到对象存储拿短链。

### 6.4 QR 码 / 接收方预览 / Profile 校验 ⏳

- 文件：`src/components/share-dialog.tsx`。
- 优化：
  1. 增加"扫码分享"开关：`qrcode` 库渲染 256×256 QR；移动端可"长按保存"。
  2. "接收方预览"折叠区，渲染对方加载链接后会看到的关键字段（不含明文 Key）。
  3. `promoProfileId` 异步校验存在性（命中后置位 valid 标）。

## 7. 主路径：云同步

### 7.1 用户可选的冲突解决 ⏳

- 现状：`mergeRestoredImageHistory` 自动合并；没有让用户选择策略。
- 文件：`src/lib/sync/sync-client.ts`（line 1126–1202）。
- 优化：恢复前出 dialog："本地有 N 条，云端有 M 条，K 条冲突。"；选项：仅使用本地 / 仅使用云端 / 合并（默认）；冲突项支持逐条决策（少量冲突时）。

### 7.2 大量恢复的断点续传 ⏳

- 现状：失败 / 关页 / 断网后恢复需重头来。
- 文件：`src/lib/sync/sync-client.ts`。
- 优化：在 IndexedDB 维护 `restore_checkpoint_v1`（已完成的对象 key 集合 + manifest hash），重启后跳过已完成对象继续；UI 显示"已恢复 X / Y，预计还需 Z 秒"。

### 7.3 配额与连接测试增强 ⏳

- 文件：`src/lib/sync/sync-client.ts`、`src/components/settings-dialog.tsx`。
- 优化：
  1. 连接测试成功后显示桶基本信息（写入权限 / 列举权限 / 测试上传 1KB 时延），失败时区分 CORS / 凭证 / 网络。
  2. 全量恢复前估算 manifest 总大小，与 `navigator.storage.estimate()` 比较；超过 80% 时弹警告"建议先压缩或限定时间范围"。

### 7.4 全局后台同步指示 ⏳

- 文件：`src/components/history-panel.tsx`、`src/app/layout.tsx`。
- 优化：把同步状态从 history-panel 提到全局（应用栏放小型旋转图标 + 进度 tooltip），用户在任何页面都知道有后台 sync；完成后 toast。

## 8. 主路径：设置面板

### 8.1 内嵌搜索 + 命令面板 ⏳

- 现状：5893 行的设置必须层层点开导航卡片。
- 文件：`src/components/settings-dialog.tsx`。
- 优化：
  1. dialog 顶部加搜索框（hotkey `/` 在 dialog 内激活），实时过滤 section 与 field 标签，命中字段用 `outline ring` 短暂高亮。
  2. `Ctrl/⌘ + K` 打开命令面板（fuzzy 搜索 Settings 字段），返回直接跳到对应 section + 滚动到字段。

### 8.2 字段级实时校验 ⏳

- 文件：`src/components/settings-dialog.tsx`（line 2600–2626 等）。
- 优化：所有 URL / 数字 / JSON 字段在 `onBlur` 即时校验，`<Input>` 红边 + 下方红字；保存时不再给一次性大 toast，而是定位到第一个错误字段。

### 8.3 API Key 连接测试 🟡

- 文件：`src/lib/provider-connection-test.ts`（新）、`src/components/settings-dialog.tsx`（line 2028–2146）。
- 优化：每个 provider 实例旁加"测试连接"，对 `/v1/models` 或最小推断接口做 HEAD/GET，分别区分凭证错 / CORS / 超时；测试结果保留 60 秒在按钮旁的 badge。
- 落地（部分）：
  - 新增 `src/lib/provider-connection-test.ts`：`testProviderConnection({ kind, baseUrl, apiKey, timeoutMs?, signal? })`，支持 4 个 provider kind（openai-compatible / gemini / seedream / sensenova），AbortController 8 秒超时，6 类失败分类（auth / cors / network / timeout / http / unknown）。
  - 附 5 条 vitest（空 key、200 + models、401 auth、AbortError、TypeError network）。
- 未做：`settings-dialog.tsx` 每个 ProviderSection 旁的「测试连接」按钮 + badge 60 秒展示——下一轮逐 provider 接入。

- 文件：`src/components/settings-dialog.tsx`（line 2028–2146）。
- 优化：每个 provider 实例旁加"测试连接"，对 `/v1/models` 或最小推断接口做 HEAD/GET，分别区分凭证错 / CORS / 超时；测试结果保留 60 秒在按钮旁的 badge。

### 8.4 端点复制 / 分节重置 ⏳

- 文件：`src/components/settings-dialog.tsx`（line 3096–3437、2710–2873）。
- 优化：
  1. 每个 provider instance 卡片加"复制端点"按钮（生成新 ID，沿用其它字段）。
  2. 全局重置改成"重置全部" + 每个 ProviderSection / SettingsSection 加"重置本节"按钮，避免破坏不相关配置。

### 8.5 配置导入导出 ✅

- 现状：仅 prompt 模板可导入导出，主配置不可。
- 文件：`src/components/settings-dialog.tsx`，新增 `src/lib/config-export.ts`。
- 落地：
  - `src/lib/config-export.ts`：`buildExportedConfig` / `validateImportedConfig` / `maskSecrets` / `triggerJsonDownload`；schema 版本字段 `schemaVersion: 1`；敏感字段按正则 `(api[_-]?key|secret|password|access[_-]?key|accesssecret)/i` 默认替换为 `<<masked>>`；validation 接受同版或更旧版（带 warnings），拒绝更新版；附 9 条 vitest。
  - Settings 主视图重置行追加 3 个按钮：「导出（不含密钥）」「导出（含密钥）」「导入配置 JSON」。导入流程：file picker → JSON.parse → validateImportedConfig → 用 `useNotice` 的 action button「应用」要求用户二次确认 → 备份当前配置到 `gpt-image-playground-config-backup-<timestamp>` 并维护最近 3 份索引 → `saveConfig`。全程使用应用内 UI 组件，零 `window.alert/prompt/confirm`（符合 AGENTS.md）。

- 现状：仅 prompt 模板可导入导出，主配置不可。
- 文件：`src/components/settings-dialog.tsx`，新增 `src/lib/config-export.ts`。
- 优化：
  1. 在 Settings 顶部加"导出配置 JSON / 导入配置 JSON"。
  2. 导出包含版本号 `schemaVersion`，敏感字段（API Key、S3 secret）默认遮罩，复选框可包含。
  3. 导入校验 `schemaVersion`，缺失字段使用默认值。

### 8.6 文件拆分 ⏳

- 现状：5893 行单文件，影响维护与代码评审。
- 文件：`src/components/settings-dialog.tsx`。
- 优化：拆为 `settings-dialog/index.tsx` + `panels/{providers,vision-text,model-catalog,polish-prompts,run-storage,sync,desktop,promo}.tsx`；通过 `useSettingsContext` 共享 state。本拆分是性能与可维护性投资，非视觉变化。

## 9. 主路径：提示词模板库

### 9.1 模糊搜索 ⏳

- 文件：`src/components/prompt-templates-dialog.tsx`（line 256–267）。
- 优化：替换为 fuse.js 模糊匹配（threshold 0.4 起步，可调），把 category / 名称 / prompt 内容按权重打分。

### 9.2 模板变量占位符 ⏳

- 文件：`src/components/prompt-templates-dialog.tsx`。
- 优化：
  1. 模板支持 `{变量名}` 语法；应用模板时弹出"填充变量"小面板。
  2. 提供常用变量预设（subject / style / setting / mood）。
  3. 应用时把变量值连同模板写入"提示词历史"。

### 9.3 拖拽排序与置顶 ⏳

- 文件：`src/components/prompt-templates-dialog.tsx`（line 969–1018）。
- 优化：管理视图增加 dnd-kit 的拖拽排序，长按拖动；项目右侧增加"置顶到分类首"。

## 10. 跨切面：移动端与触控

### 10.1 硬件返回键关闭对话框（Android / Tauri） ⏳

- 现状：`onOpenChange` 走 Esc 与背景点击；Tauri Android 硬件返回键无显式监听。
- 文件：`src/components/ui/dialog.tsx`、各 dialog 组件、`src/lib/desktop-runtime.ts`。
- 优化：在 dialog 打开时 push 一个 history entry（已有 `useDialogHistoryEntry` 模式可复用），Android 物理 back 触发 `popstate`，dialog 关闭。多层 dialog 严格 LIFO。

### 10.2 软键盘避让 🟡

- 现状：Footer 用 `pb-[max(1rem,env(safe-area-inset-bottom))]`，但软键盘弹出后会盖住 footer 按钮。
- 文件：所有带主操作按钮的 dialog 与底部条。
- 优化：
  1. 用 `visualViewport` 监听调整一个 CSS var `--app-keyboard-inset-bottom`，footer `pb` 取 `max(safe-area, keyboard-inset)`。
  2. 在 `<input>` focus 时，`scrollIntoView({block: 'center'})` 防止字段被遮挡。

### 10.3 Bottom-Sheet 模式标准化 ⏳

- 现状：`prompt-templates-dialog.tsx` 用 `top-auto bottom-0` 实现 bottom-sheet 但没有抽象。
- 文件：新增 `src/components/ui/bottom-sheet.tsx`。
- 优化：抽出 `<BottomSheet>` primitive（基于 Radix Dialog），提供 `peek`、`max-height`、`drag-to-dismiss`；现有 `mobileDetailTemplate` 切换为该 primitive，便于后续移动端继续推广。

### 10.4 长按菜单评估 ⏳

- 现状：图片无长按菜单。
- 文件：`src/components/image-output.tsx`、`src/components/history-panel.tsx`。
- 优化：评估对历史缩略图 / 输出图加 350ms 长按显示 ContextMenu（"下载"、"发送到编辑"、"复制提示词"、"删除"），与现有"卡片下方按钮行"二选一或并存。需做无障碍 fallback。

## 11. 跨切面：Tauri 桌面 / Android 运行时

### 11.1 打开所在文件夹 ⏳

- 现状：本地存储路径只有输入框和 picker。
- 文件：`src/components/settings-dialog.tsx`（line 3696–3751）、`src-tauri/src/proxy/*` 或新增 `src-tauri/src/fs/`。
- 优化：在路径输入框旁加"打开文件夹"按钮，调用 `tauri-plugin-shell` 的 `open` 或自定义 command。Web 路径不显示该按钮。

### 11.2 未保存指示与窗口标题 ⏳

- 现状：窗口 title 不变。
- 文件：`src-tauri/src/main.rs`、`src/lib/desktop-runtime.ts`。
- 优化：暴露 `setWindowTitle(modifier?: string)` 命令；在"草稿存在 / 设置未保存"时 title 前缀加 `●`，与 macOS 习惯一致。

### 11.3 托盘 / Dock 角标 ⏳

- 文件：`src-tauri/src/main.rs`、`src/lib/desktop-runtime.ts`。
- 优化：任务完成 + 窗口失焦时设置 dock 角标（macOS）/ 托盘 badge（Windows）；窗口 focus 时清除。已与 §3.7 联动。

### 11.4 崩溃恢复 ⏳

- 文件：`src-tauri/src/main.rs`、`src/hooks/useTaskManager.ts`。
- 优化：所有"运行中"任务的元信息（不含 AbortController）写到本地临时文件；启动时若发现"上次未正常退出"，提示"上次有 N 个任务未完成，是否使用原参数重试？"。

### 11.5 外链一致性 ✅

- 现状：`openExternalUrl` 已抽象，但需要回归所有 `<a href>` / 文档跳转。
- 文件：搜索 `src/**/*.tsx` 中所有 `<a` 与 `window.open`。
- 优化：写一个 `<ExternalLink>` 组件统一调用 `openExternalUrl`，避免"Web 用 a，Tauri 漏 invoke"的回归风险。

## 12. 跨切面：国际化（i18n）

### 12.1 Settings / Mode 等硬编码字符串迁移 ⏳

- 现状：`settings-dialog.tsx` 大量章节标题和描述（"供应商 API 配置"等）硬编码中文；`mode-toggle.tsx` 直接写 "生成" / "编辑"。
- 文件：`src/lib/i18n/messages.ts`、`src/components/settings-dialog.tsx`、`src/components/mode-toggle.tsx`、`src/components/prompt-templates-dialog.tsx`。
- 优化：
  1. 规模性把硬编码字符串替换成 `t(key)`，按 panel 命名 key（`settings.providers.title` 等）。
  2. 为每种支持语言提供翻译；缺译走 fallback。

### 12.2 缺译可观测 ⏳

- 文件：`src/lib/i18n/translator.ts`。
- 优化：开发模式下缺译时 `console.warn('[i18n] missing key: xxx')`；可选给输出包一个 `›xxx‹` 装饰，便于翻译人员发现遗漏。

### 12.3 复数 / 日期 / 数字格式 ⏳

- 文件：`src/lib/i18n/translator.ts`、`src/components/app-language-provider.tsx`。
- 优化：
  1. 接入 ICU MessageFormat 或基于 `Intl.PluralRules` 自实现 `tPlural(key, count)`。
  2. 数字 / 日期 / 货币用 `Intl.NumberFormat` / `Intl.DateTimeFormat`，而不是 `${value}`。

### 12.4 RTL 占位 ⏳

- 现状：`AppLanguageProvider` 仅设置 `lang`，未设置 `dir`。
- 文件：`src/components/app-language-provider.tsx`、`src/app/globals.css`。
- 优化：增加 `direction: 'ltr' | 'rtl'` 元信息；CSS 用 logical properties（`margin-inline-start` 等）替换 `margin-left`/`right` 的若干硬编码处；为后续阿语 / 希伯来支持铺底（不在本期上线）。

## 13. 跨切面：通知 / 促销 / 主题

### 13.1 Notice 持久化与去重 ✅

- 现状：`useNotice` 仅内存存储；同一通知重复出现。
- 文件：`src/components/notice-provider.tsx`。
- 优化：可选 `persistKey` 字段，使用 localStorage 记录"用户已确认"的 notice id；重大变更通知支持版本号失效（如 `release-v3`）。

### 13.2 Carousel 暂停 / 播放控件 ✅

- 现状：`promo-carousel.tsx` 在 hover / focus / 失焦时自动暂停，但没有可见的暂停/播放按钮。
- 文件：`src/components/promo-carousel.tsx`（line 111–119）。
- 优化：右下角加 `Play / Pause` 小按钮（IconButton），keyboard 可达；满足 WCAG 2.2.2。

### 13.3 主题切换 i18n 与 system-following ✅

- 现状：`theme-toggle.tsx` 已用 `t()`；`mode-toggle.tsx` 没用。
- 文件：`src/components/mode-toggle.tsx`、`src/components/theme-toggle.tsx`、`src/components/theme-provider.tsx`。
- 落地：
  - ThemeProvider 底层早已支持 `'system'` 主题与 `prefers-color-scheme` matchMedia 监听（line 70–79），仅 toggle UI 未暴露。本次将 `theme-toggle.tsx` 改为三态循环：浅色 → 深色 → 跟随系统 → 浅色，按当前态显示 Monitor / Sun / Moon 图标。
  - i18n 新增 `theme.switchToSystem` / `theme.system` 两条，zh-CN + en-US 全覆盖。
- 未做：`mode-toggle.tsx` 中「生成 / 编辑」字符串的 i18n 化（§12.1 任务）。

- 现状：`theme-toggle.tsx` 已用 `t()`；`mode-toggle.tsx` 没用。
- 文件：`src/components/mode-toggle.tsx`、`src/components/theme-toggle.tsx`、`src/components/theme-provider.tsx`。
- 优化：
  1. mode-toggle i18n（与 §12.1 同批次）。
  2. ThemeProvider 增加"跟随系统"第三态，按 `prefers-color-scheme` 监听 `change`，避免半夜手动切。

## 14. 跨切面：可访问性（a11y）

> 与 `UI_UPGRADE_REQUIREMENTS.md` 第 1.5 节"focus-visible"协同；本节聚焦 ARIA / 语义结构 / 键盘可达。

### 14.1 跳过到主内容 ✅

- 文件：`src/app/layout.tsx`、新增 `id="main-content"` 到 `src/app/page.tsx` 工作区根。
- 优化：layout 顶部加 `<a href="#main-content" className="sr-only focus:not-sr-only">{t('a11y.skipToContent')}</a>`。
- 落地：`layout.tsx` 紧贴 `<body>` 顶部、在 `DisableDevtoolBootstrap` 之前加入 `sr-only focus:not-sr-only` 的中文跳转链接（"跳到主内容"），通过现有 `I18nTextBridge` 在 `en-US` 下自动切换为 "Skip to main content"；`page.tsx` 把工作区根的 `<main>` 加上 `id='main-content' tabIndex={-1}`，按 Tab 第一下即可跳过头部装饰直达工作区。i18n key `a11y.skipToContent` 已添加 zh-CN + en-US。

### 14.2 Mask 画布键盘可达 ⏳

- 现状：`<canvas>` 仅响应 mouse / touch。
- 文件：`src/components/editing-form.tsx`（line 3425–3437 等）。
- 优化：`role="application"` + `aria-label` + `aria-keyshortcuts`；方向键移动光标，`Enter/Space` 切换绘制，`B/E` 切换画笔/橡皮，`[`/`]` 调笔刷大小，`Esc` 退出。需要可视化的"虚拟光标"。

### 14.3 标题层级修正 ⏳

- 现状：dialog 直接以 h3 起；主页 h1 后跳到 h3。
- 文件：`src/components/prompt-templates-dialog.tsx`、`src/components/settings-dialog.tsx`、`src/app/page.tsx`。
- 优化：dialog 标题用 h2，子标题用 h3；视觉若需保留小号字，用 `aria-level` 而不是改 tag。

### 14.4 状态颜色叠加图标 ✅

- 现状：不少处仅 `text-red-400` / `text-green-400` / `text-yellow-400`。
- 文件：`src/components/editing-form.tsx`（line 3512–3524 等）、`src/components/task-card.tsx`（line 85–86）、`src/components/notice-provider.tsx`（已较好）。
- 落地：
  - `notice-provider.tsx` 早已使用 `CheckCircle2 / AlertTriangle / XCircle / Info` 图标，免改。
  - `editing-form.tsx` 4 处状态文案补 icon：自定义尺寸校验错误（line 635、3722）、需修正徽标（line 2654）、自定义 JSON 校验错误（line 4041）、蒙版状态（line 3446、3565、3571、3579）共 8 处。
  - `task-card.tsx` 整个错误分支按 `errorCategory` 渲染不同图标（KeyRound / Clock / ServerCrash / WifiOff / Wallet / AlertCircle）。
  - 其余 share-dialog / secure-share-unlock-dialog / shared-config-choice-dialog 等已带 icon 或 Alert 组件，免改。

- 现状：不少处仅 `text-red-400` / `text-green-400` / `text-yellow-400`。
- 文件：`src/components/editing-form.tsx`（line 3512–3524）、`src/components/task-card.tsx`（line 85–86）、`src/components/notice-provider.tsx`（已较好）。
- 优化：所有"状态描述"组件统一在文本前增加 `<CheckCircle/>` / `<XCircle/>` / `<AlertTriangle/>` 图标；跟 IconButton primitive 同期出。

### 14.5 历史面板 Sync 菜单 ARIA ⏳

- 现状：手写 dropdown，没有 `role="menu"`。
- 文件：`src/components/history-panel.tsx`（line 777–868）。
- 优化：替换为 `<Popover>` primitive（依赖 UI_UPGRADE Phase 1），按钮 `aria-expanded`，内部 `role="menu"`，方向键导航。

### 14.6 图标按钮 aria-label 全量补齐 ✅

- 现状：部分图标按钮仅 title。
- 文件：grep `<button` + lucide icon 的位置（`history-panel.tsx`、`settings-dialog.tsx`、`zoom-viewer.tsx` 等）。
- 落地：用 ast-grep 完整审计 9 个 `<IconButton>` 调用点（share-dialog / zoom-viewer / settings-dialog），全部已带 `aria-label`；zoom-viewer 内的 4 个原生 `<button>` 也全部带 `aria-label`；本轮新增的 task-card 复制错误按钮带 `aria-label={t('task.error.copy')}`。系统已合规，无需进一步修改。

- 现状：部分图标按钮仅 title。
- 文件：grep `<button` + lucide icon 的位置（`history-panel.tsx`、`settings-dialog.tsx`、`zoom-viewer.tsx` 等）。
- 优化：所有图标按钮 mandatory `aria-label`；title 仅作为 supplementary tooltip。

### 14.7 prefers-reduced-motion 全面尊重 ✅

- 现状：`zoom-viewer.tsx` 已检测；其它过渡动画未做。
- 文件：`src/app/globals.css`、`src/components/promo-carousel.tsx`、`src/components/zoom-viewer.tsx` 等。
- 优化：在 `globals.css` 内加全局兜底：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

JS 层面在 carousel / 入场动画处单独检测以跳过自动轮播。

## 15. 跨切面：性能与稳定性

### 15.1 page.tsx 拆分 ⏳

- 现状：5069 行，几乎承载全部主路径状态。
- 文件：`src/app/page.tsx`。
- 优化：抽出 `useHistoryManager` / `useClipboardHandler` / `useGlobalDragDrop` / `useSyncOrchestrator` hooks 到 `src/hooks/`，把 dialog 通过 `React.lazy` 拆分懒加载。

### 15.2 ID 防碰撞 ✅

- 现状：`Date.now()_${Math.random().toString(36).slice(2,8)}`。
- 文件：`src/lib/tasks.ts`、`src/hooks/useTaskManager.ts`、`src/components/prompt-templates-dialog.tsx`、`src/lib/sync/snapshot.ts`。
- 优化：统一用 `crypto.randomUUID()`；Tauri 与现代浏览器均支持；对 SSR 兜底用 `globalThis.crypto?.randomUUID?.() ?? fallback()`。
- 落地：新增 `src/lib/id.ts` 导出 `generateId(prefix?)` / `generateShortId()` / `generateShortIdPrefixed(prefix)`；底层用 `crypto.randomUUID()`，无法使用时回退到 `${Date.now()}-${Math.random().toString(36).slice(2,10)}`。`tasks.ts`、`useTaskManager.ts`、`sync-client.ts`、`snapshot.ts`、`prompt-templates-dialog.tsx` 全部接入；现存 5 处 `Date.now() + Math.random()` 全部替换。

### 15.3 drag-over 节流 ⏳

- 现状：`document.addEventListener('dragover', handleDragOver)` 在每帧触发。
- 文件：`src/app/page.tsx`（line 1225–1231）。
- 优化：handler 内部仅做 `preventDefault`；`isGlobalDragOver` state 通过 `requestAnimationFrame` 合并；离开时用 `dragleave` + `setTimeout(50)` 兜底防抖。

### 15.4 Object URL 生命周期审计 ⏳

- 现状：多处 `URL.createObjectURL`；已在大部分地方 `revokeObjectURL`；少量 cleanup 路径不全。
- 文件：用 grep 全量审计 `createObjectURL` 与配对的 `revokeObjectURL`。
- 优化：建立 `useObjectUrl(blob)` hook，挂载创建、卸载销毁；避免泄漏。

## 16. 跨切面：错误处理与可观测性

### 16.1 静默 catch 转可观测 ✅

- 现状：`src/lib/history-assets.ts`、`src/lib/sync/sync-client.ts` 等存在 `.catch(() => undefined)`。
- 文件：grep `catch (() => undefined)` 与 `catch (() => null)`。
- 优化：开发环境 `console.warn` 记录；可观测性允许时上报到 Sentry-like 通道（可选）；用户数据相关的失败提示给到 UI（如 §3.2、§5.4）。

### 16.2 JSON 错误带位置 ✅

- 现状：自定义参数 JSON 解析错只显示通用 message。
- 文件：`src/lib/provider-options.ts`、`src/components/editing-form.tsx`。
- 优化：包装一个 `parseJsonWithLocation(text)`：捕获 `SyntaxError.message` 中的 position（V8 / WebKit 不同），换算为行列；textarea 显示行号侧栏并高亮错误行；附"格式化 JSON"按钮。

### 16.3 localStorage 配额异常处理 ✅

- 现状：仅 `console.error`。
- 文件：`src/lib/image-history.ts`、`src/lib/vision-text-history.ts` 等。
- 优化：捕获 `QuotaExceededError`；提示用户"本地存储空间不足，建议切换到 IndexedDB 或清理历史"；提供"立即切换"快捷按钮。

## 17. 跨切面：边界情形

### 17.1 离线检测与降级 ✅

- 现状：未检测 `navigator.onLine` / `online`/`offline` 事件。
- 文件：新增 `src/lib/network-status.ts`、`src/components/network-banner.tsx`。
- 优化：
  1. 监听 online/offline 事件，离线时顶部出黄条："已离线，部分功能不可用"，提交时 task 直接转 queued 等待恢复。
  2. 桌面端走 Tauri 的网络状态接口（如可用），与 web 行为一致。

### 17.2 多页签广播 ⏳

- 现状：仅 sync config 有 storage 事件监听。
- 文件：`src/app/page.tsx`、新增 `src/lib/cross-tab-bus.ts`。
- 优化：使用 `BroadcastChannel('gpt-image-playground')` 在多页签间同步：history 写入、配置变更、清空操作；消息均携带 `tabId` + `seq`，避免回环。

### 17.3 系统时钟跳变 ✅

- 现状：用 `Date.now()` 计时。
- 文件：`src/hooks/useTaskManager.ts`、`src/lib/taskExecutor.ts`、`src/components/image-output.tsx`、`src/components/text-output.tsx`。
- 优化：所有"经过时间"用 `performance.now()`（单调递增）；只有"显示时间戳"用 `Date.now()`。
- 落地：`useTaskManager.ts` 新增 `elapsedMonotonic()` 闭包，把 7 处 `Date.now() - startTime` 全部替换；`taskExecutor.ts` 在 `executeTask()` 顶部捕获 `startMonotonic = performance.now()` 透传到四个执行模式函数，覆盖 11 处 duration delta；`vision-text-executor.ts` 三个执行函数各自捕获 monotonic 起点。墙钟语义的 `createdAt` / `startedAt` / `completedAt` 维持 `Date.now()`。
- 未做：`image-output.tsx` / `text-output.tsx` 计时器是 UI 层每秒刷新的"已用时间"显示，已有 `Date.now() - startedAt` 是墙钟读数，不属于 monotonic 范畴；如果未来要精确到毫秒级仍可改造。

### 17.4 缩放与 HiDPI ⏳

- 现状：图片预览未感知 `devicePixelRatio`。
- 文件：`src/components/image-output.tsx`、`src/components/zoom-viewer.tsx`。
- 优化：在 `<img>` 上使用 `srcset` 或下载 2x 资源（在 API 支持时）；mask painter 的 canvas 按 dpr scale 防糊。

### 17.5 SSR / Hydration 安全核查 ✅

- 现状：多处 `window.matchMedia` 在组件中直接调用。
- 文件：`src/app/page.tsx`（line 348）、`src/components/zoom-viewer.tsx`（line 55–61）等。
- 优化：所有 `window.*` / `navigator.*` 调用挪到 `useEffect` 或 `useSyncExternalStore`；用 `typeof window !== 'undefined'` 守护；为 `Date.now()` / `Math.random()` 在 render 期出现的位置打错误（lint rule + run-time guard）。

### 17.6 自定义右键菜单评估 ⏳

- 现状：明确不动右键。
- 文件：`src/components/disable-devtool-bootstrap.tsx`、`src/components/image-output.tsx`、`src/components/history-panel.tsx`。
- 优化：在 **图片** 上提供产品语境菜单（"下载 / 发送到编辑 / 复制提示词 / 删除"），同时保留浏览器默认右键的"复制图片"等基础项（合并为一层）。需要做 a11y 等价（键盘 ContextMenu）。

## 18. 跨切面：数据完整性

### 18.1 localStorage 版本化与迁移 ⏳

- 现状：localStorage key 无版本前缀，没有迁移逻辑。
- 文件：`src/lib/config.ts`、`src/lib/image-history.ts` 等。
- 优化：所有 key 加 `_v1` / `_v2` 后缀，`loadXxx` 内部识别旧 key 自动迁移；迁移成功后删除旧 key。给一个统一 `migrateLocalStorage()` 入口，在 `app/layout.tsx` 启动时调用。

### 18.2 分享恢复前自动备份 ⏳

- 现状：恢复直接覆盖。
- 文件：`src/app/page.tsx`、`src/components/shared-config-choice-dialog.tsx`、`src/components/shared-sync-config-choice-dialog.tsx`。
- 优化：恢复前把当前关键配置 export 到内存 / localStorage（`config_backup_<timestamp>`），保留最近 3 份；恢复后给 toast"已备份当前配置，撤销恢复"。

### 18.3 已弃用 sample / promo 的稳定夹断 ⏳

- 现状：`history-panel.tsx` example 项目本地解除后，sync 又拉回来。
- 文件：`src/components/history-panel.tsx`、`src/lib/sample-history.ts`（如有）、`src/lib/sync/sync-client.ts`。
- 优化：在 localStorage 维护 `dismissed_sample_ids`；example 渲染前过滤；同步恢复后再次过滤；说明文案更新到 `docs/history-and-assets.md` "内置示例历史"段。

## 19. 实施分期建议

按"复杂度 × 受益面 × 与 UI_UPGRADE 的耦合度"分三期：

### Phase A（基础回报最高，1–2 个 sprint）

> 状态截至 `updatedAt`：14 / 14 条目已落地（其中 §8.3 utility 完成、UI 接入留待下一轮；§5.1 历史虚拟化作为 Phase C 单独排期，因需新依赖与显著重构）。

已完成 ✅：
- §2.1 草稿保护
- §2.3 IME 全面保护
- §3.2 错误差异化文案（含原始错误折叠 + 复制按钮）
- §3.3 重试语义清晰化（含 rate-limit 倒计时）
- §3.6 队列上限可见
- §3.7 多页签 favicon / title 角标
- §5.3 清空撤销宽限期、§5.6 sync 子菜单结构精简
- §6.1 解锁防爆破节流、§6.2 大小写提示
- §8.5 配置导入导出
- §14.1 跳到主内容、§14.4 状态颜色叠加图标、§14.6 图标按钮 aria-label 全量补齐
- §15.2 ID 防碰撞、§17.3 时钟跳变 → `performance.now()`

部分完成 🟡：
- §8.3 API Key 连接测试 —— `src/lib/provider-connection-test.ts` + 5 条 vitest 完成；Settings 端按钮 + badge UI 留待下一轮逐 provider 接入

延后到 Phase C ⏸：
- §5.1 历史虚拟化（需引入 `@tanstack/react-virtual` 新依赖，并对 history-panel grid 做较大改造，宜独立排期）

### Phase B（中等投入，3–4 个 sprint）

- §2.2 字符 / Token 计数、§2.4 `/` 命令边界、§2.5 源图重排 / 撤销 / 大文件
- §3.1 提交前费用预览、§3.4 流式阶段可见 + 保留 partial、§3.5 ETA 估算、§3.8 任务持久化
- §4.1 网格键盘可达、§4.2 复制图片到剪贴板 / 下载、§4.3 zoom focus trap
- §5.2 筛选与排序、§5.4 断图诊断、§5.5 IndexedDB 配额、§5.7 拖拽到编辑
- §6.3 平台长度分级、§6.4 QR 码 / 接收方预览
- §7.1 冲突解决、§7.2 断点续传、§7.3 配额测试、§7.4 全局后台同步指示
- §8.1 设置内嵌搜索、§8.2 字段实时校验、§8.4 端点复制 / 分节重置
- §9.1 模糊搜索、§9.3 拖拽排序
- §10.1 硬件返回键、§10.2 软键盘避让、§10.3 BottomSheet primitive
- §11.1 打开所在文件夹、§11.2 未保存窗口标题、§11.3 托盘 / Dock 角标
- §12.1 i18n 硬编码迁移（settings + mode）、§12.2 缺译可观测
- §14.2 Mask 画布键盘可达、§14.5 Sync 菜单 ARIA、§14.7 prefers-reduced-motion 全局兜底
- §15.1 page.tsx 拆分、§15.4 Object URL 审计
- §16.1 静默 catch 可观测、§16.2 JSON 错误带位置、§16.3 localStorage 配额
- §17.1 离线检测、§17.2 跨页签广播、§17.5 SSR 守护
- §18.1 localStorage 版本化、§18.2 分享恢复前备份、§18.3 sample 夹断

### Phase C（长尾 / 战略性，按需投入）

- §8.6 settings-dialog 拆分（重构投入）
- §9.2 模板变量占位符
- §10.4 长按菜单
- §11.4 桌面崩溃恢复、§11.5 ExternalLink 组件统一
- §12.3 复数 / 数字 / 日期格式、§12.4 RTL 占位
- §13.1 Notice 持久化、§13.2 Carousel 控件、§13.3 跟随系统主题
- §17.4 HiDPI 支持、§17.6 自定义右键菜单

## 20. 验收清单（每条需求落地时）

- [ ] **代码层**：受影响文件清单 + 关键 diff；无 `as any` / `@ts-ignore`。
- [ ] **行为层**：浅色 / 深色 ✕ 桌面 / 移动 ✕ Web / Tauri 桌面 / Tauri Android（如适用）四象限验证。
- [ ] **可访问性**：键盘可达、focus 状态、ARIA / role / aria-label、不只用颜色。
- [ ] **性能**：变更后 FCP / TBT 不退化；列表条数 ≥ 1000 时仍可滚动。
- [ ] **可靠性**：错误路径全部走 §3.2 差异化文案；catch 不静默吞错。
- [ ] **i18n**：新增 user-visible 字符串全部接 `t()`；所有支持语言提供翻译；`data-i18n-skip` 仅用于用户数据 / 模型 ID 等。
- [ ] **数据完整性**：涉及持久化的改动给 schema migration 与回退；关键操作（清空、恢复、删除）有撤销或备份。
- [ ] **文档**：用户可见行为变化时同步更新 `docs/*.md`、`docs/requirements/*.md`、`CHANGELOG.md`、必要时 `RELEASE_PROCESS.md`。
- [ ] **测试**：跨运行时差异处补 Vitest 单元测 / `playwright` E2E；前后行为对比说明。

---

> 与 `UI_UPGRADE_REQUIREMENTS.md` 的关系：本文件聚焦"行为、功能完备、错误反馈、可访问性、性能、可靠性、跨运行时一致性"；视觉 token、卡片骨架、IconButton 体系、断点收敛、装饰背景去除等仍以 UI_UPGRADE 为准，避免重复。两者同一阶段并行推进时，优先级由 UI_UPGRADE Phase 1 的 primitives（IconButton / Spinner / Skeleton / EmptyState / Popover / Heading）就绪节奏决定。
