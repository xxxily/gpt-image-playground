---
title: GPT Image Playground 国际化（i18n）实施清单
summary: 将国际化需求拆解为后续 AI 可直接执行的分阶段任务，覆盖语言检测、配置持久化、翻译资源、设置入口、文案迁移、错误消息和验证标准。
createdAt: 2026-05-15
status: draft-plan
---

# GPT Image Playground 国际化（i18n）实施清单

关联需求文档：[国际化（i18n）支持需求文档](./INTERNATIONALIZATION_REQUIREMENTS.md)

## 1. 执行边界

- 首版只实现 `zh-CN` 与 `en-US`。
- 不新增 `/zh`、`/en` 路由段，不破坏桌面端静态导出。
- 优先实现轻量内部 i18n 层，不先引入依赖路由结构的国际化框架。
- 语言优先级固定为：已保存设置 -> 运行时语言信息 -> `zh-CN`。
- 用户输入、历史 prompt、AI 输出、模型 ID、供应商 ID、URL、文件路径、原始调试信息不自动翻译。
- Web、Tauri Desktop、Mobile/Android 使用同一套前端语言逻辑；V1 可先用 `navigator.languages` / `navigator.language` 作为跨运行时语言信号。

## 2. 推荐实现路线

1. 先建立语言类型、归一化、初始化脚本、React Provider 与翻译资源结构。
2. 再把 `appLanguage` 接入 `AppConfig`、本地存储、配置变更事件和同步快照。
3. 先完成系统设置“常规”里的语言切换入口，验证语言切换链路。
4. 按模块迁移文案：主工作台 -> 设置 -> 历史/分享/同步 -> 桌面提示 -> 管理页。
5. 最后处理 API/工具层用户可见错误，尽量转成稳定错误码，由客户端按语言渲染。

## 3. 任务清单

### Phase 0：文案盘点与迁移约定

- [ ] 用 `rg` 盘点 `src/app`、`src/components`、`src/lib` 中用户可见的硬编码文案。
- [ ] 将文案分为三类：必须本地化、保留原样、仅日志/调试使用。
- [ ] 确定 key 命名规范，建议按功能命名空间组织：
  - `common.*`
  - `settings.*`
  - `workspace.*`
  - `history.*`
  - `share.*`
  - `sync.*`
  - `about.*`
  - `admin.*`
  - `errors.*`
- [ ] 不使用中文或英文原句作为翻译 key，key 必须表达语义。

完成标准：形成清晰的文案迁移边界，后续改代码时不会把用户输入、模型名、URL 等误翻译。

### Phase 1：语言核心模块

主要新增目录建议：`src/lib/i18n/`

- [ ] 新增 `AppLanguage` 类型：`'zh-CN' | 'en-US'`。
- [ ] 新增受支持语言列表、默认语言常量、语言显示名。
- [ ] 新增 `normalizeAppLanguage(value)`，覆盖 `zh`、`zh-CN`、`zh-Hans`、`zh-TW`、`en`、`en-US` 等常见输入。
- [ ] 新增 `detectRuntimeLanguage()`，按 `navigator.languages` -> `navigator.language` -> fallback 解析。
- [ ] 新增 `resolveInitialAppLanguage(storedLanguage, runtimeLanguages)`。
- [ ] 新增单元测试，覆盖未知值、空值、大小写、区域变体和中文繁体变体。

完成标准：不依赖 React 和浏览器 UI，也能通过纯函数稳定得到 `zh-CN` 或 `en-US`。

### Phase 2：配置与同步接入

主要文件：

- `src/lib/config.ts`
- `src/lib/sync/*`
- 相关 Vitest 测试文件

- [ ] 在 `AppConfig` 中新增 `appLanguage: AppLanguage`。
- [ ] 在 `DEFAULT_CONFIG` 中提供默认语言。默认值应通过统一常量表达，不在多处硬编码。
- [ ] 在 `loadConfig()` 中归一化历史配置；老配置缺少 `appLanguage` 时自动补齐。
- [ ] 在 `saveConfig()` 合并配置时保留 `appLanguage`。
- [ ] 检查同步快照、manifest、restore、sanitize/allowlist 逻辑，确保 `appLanguage` 随 `appConfig` 范围同步。
- [ ] 增加配置兼容测试：旧 localStorage、非法语言值、同步恢复后的语言值。

完成标准：语言偏好能随现有配置保存、恢复、同步，不破坏旧用户配置。

### Phase 3：首屏初始化与 Provider

主要文件：

- `src/app/layout.tsx`
- `src/components/*provider*.tsx`
- `src/lib/i18n/*`

- [ ] 新增类似 `buildThemeInitializerScript()` 的语言初始化脚本。
- [ ] 初始化脚本在 React hydration 前执行，读取本地配置或运行时语言，设置：
  - `document.documentElement.lang`
  - `document.documentElement.dataset.appLanguage`
- [ ] 新增 `AppLanguageProvider` 或等价 Provider，提供：
  - 当前语言 `language`
  - `setLanguage(next)`
  - 翻译函数 `t(key, params?)`
  - 日期/数字格式化辅助函数
- [ ] Provider 初始值优先读取初始化脚本写入的 `data-app-language`，避免首屏语言闪烁。
- [ ] Provider 与现有 `CONFIG_CHANGED_EVENT` 或顶层 `appConfig` 状态联动，设置保存后当前页面立即更新。
- [ ] 切换语言时同步更新 `html lang`。
- [ ] 新增客户端 meta 同步组件，按当前语言更新 `document.title` 和 `meta[name="description"]`。`layout.tsx` 的静态 `metadata` 只作为 fallback。

完成标准：首次打开、刷新、设置切换都能让 `html lang`、标题和 Provider 状态保持一致。

### Phase 4：翻译资源与格式化

主要新增目录建议：

```text
src/lib/i18n/
  messages/
    zh-CN.ts
    en-US.ts
  formatters.ts
  translator.ts
```

- [ ] 建立 `zh-CN` 和 `en-US` 两个语言包。
- [ ] 翻译函数支持参数插值，例如图片数量、任务数量、状态值。
- [ ] 缺失 key 必须有兜底策略：开发环境可警告，生产环境显示 fallback 文案或 key，不允许空白。
- [ ] 用 `Intl.DateTimeFormat`、`Intl.NumberFormat`、`Intl.RelativeTimeFormat` 替换固定中文格式拼接。
- [ ] 建立语言包 key 覆盖校验测试，确保两种语言 key 集合一致。

完成标准：新增文案必须进入语言包；缺失翻译能被测试或开发警告发现。

### Phase 5：系统设置语言入口

主要文件：

- `src/components/settings-dialog.tsx`
- `src/app/page.tsx`

- [ ] 在设置面板主视图顶部新增“常规”区块。
- [ ] 在“常规”区块中新增“界面语言”选择控件。
- [ ] 中文界面显示 `简体中文`、`English`；英文界面显示 `Chinese (Simplified)`、`English`。
- [ ] 选择语言后通过现有保存配置路径写入 `appLanguage`，并触发当前页面重渲染。
- [ ] 重置所有配置时，语言回到当前运行时检测到的默认语言，而不是固定写死。
- [ ] 切换语言不得清空当前 prompt、源图片、历史筛选、弹窗输入和未保存设置项。

完成标准：用户可以在设置面板里切换语言，保存后立即生效，刷新后保持。

### Phase 6：核心 UI 文案迁移

建议按以下顺序迁移，避免一次性改动过大。

- [ ] App shell 与全局组件：
  - `src/app/layout.tsx`
  - `src/app/page.tsx`
  - `src/components/notice-provider.tsx`
  - `src/components/theme-toggle.tsx`
- [ ] 主工作台与生成表单：
  - `src/components/editing-form.tsx`
  - 生成、编辑、图生文相关按钮、placeholder、状态、校验提示。
- [ ] 设置面板：
  - `src/components/settings-dialog.tsx`
  - 供应商、运行与存储、桌面端设置、云同步、提示词润色、图生文配置。
- [ ] 历史与资产：
  - `src/components/history-panel.tsx`
  - 下载、删除、筛选、空状态、批量操作、历史图片错误提示。
- [ ] 分享与恢复：
  - `src/components/share-dialog.tsx`
  - `src/components/shared-config-choice-dialog.tsx`
  - 密码、加密分享、同步恢复、配置确认文案。
- [ ] 辅助弹窗：
  - `src/components/about-dialog.tsx`
  - `src/components/password-dialog.tsx`
  - `src/components/prompt-templates-dialog.tsx`
- [ ] 管理页和展示内容后台：
  - `src/app/admin/**`
  - `src/components/admin/**`

完成标准：核心路径中不再出现裸露的中文/英文 UI 文案；主题切换、移动端布局和桌面宽度下文本不溢出。

### Phase 7：错误与业务消息迁移

主要文件：

- `src/lib/api-error.ts`
- `src/lib/connection-policy.ts`
- `src/lib/desktop-guidance.ts`
- `src/lib/taskExecutor.ts`
- `src/lib/vision-text-executor.ts`
- `src/lib/prompt-polish.ts`
- `src/lib/sync/**`
- `src/app/api/**/route.ts`

- [ ] 区分用户可见错误、开发日志、供应商原始错误。
- [ ] 前端 `addNotice()`、`setError()`、表单验证错误必须使用翻译 key。
- [ ] API Routes 尽量返回稳定错误码和参数，由客户端本地化展示。
- [ ] 供应商返回的原始错误保留为 detail，不翻译、不丢失。
- [ ] 桌面端 Rust/Tauri 返回的用户可见错误也要进入同一套错误映射。
- [ ] 保留 console 日志中的英文调试信息，不强制翻译日志。

完成标准：用户看到的错误跟随语言切换；调试信息仍足够定位问题。

### Phase 8：测试与验收

- [ ] `npm run test` 增加并通过以下覆盖：
  - 语言归一化。
  - 初始语言解析。
  - 配置读写和旧配置迁移。
  - 语言包 key 覆盖一致性。
  - 格式化 helper。
- [ ] `npm run lint` 通过。
- [ ] `npm run build` 通过。
- [ ] `npm run build:desktop` 通过，确认静态导出不依赖动态 locale route。
- [ ] 人工验证 Web：
  - 中文浏览器首次进入显示中文。
  - 英文浏览器首次进入显示英文。
  - 手动切换语言后刷新仍保持。
  - 浅色/深色主题都正常。
  - 手机宽度和桌面宽度都无文字溢出。
- [ ] 人工验证 Tauri Desktop：
  - 桌面端首次语言推断可用。
  - 设置切换立即生效。
  - 桌面端专属提示、外链、更新、代理和本地文件文案已本地化。

完成标准：满足需求文档第 9 节验收标准，且没有引入 Web/Desktop 分支行为回归。

## 4. 预计改动面

新增优先：

- `src/lib/i18n/*`
- `src/components/app-language-provider.tsx`
- `src/components/document-language-meta-sync.tsx`

重点修改：

- `src/lib/config.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/editing-form.tsx`
- `src/components/history-panel.tsx`
- `src/components/share-dialog.tsx`
- `src/components/about-dialog.tsx`
- `src/components/password-dialog.tsx`
- `src/components/prompt-templates-dialog.tsx`
- `src/components/shared-config-choice-dialog.tsx`
- `src/components/admin/**`
- `src/lib/api-error.ts`
- `src/lib/connection-policy.ts`
- `src/lib/desktop-guidance.ts`
- `src/lib/sync/**`
- `src/app/api/**/route.ts`

## 5. 风险与处理

| 风险 | 处理方式 |
| --- | --- |
| 首屏语言闪烁 | 复用主题初始化思路，增加 beforeInteractive 语言脚本。 |
| 大量文案一次性迁移造成回归 | 按 Phase 6 的模块顺序分批迁移，每批都跑测试。 |
| API Route 无法知道客户端语言 | 返回错误码和参数，客户端本地化；原始错误放 detail。 |
| 静态桌面导出不能使用动态 locale 路由 | 不引入 locale route，语言由客户端配置和 Provider 控制。 |
| 英文文案变长导致布局挤压 | 迁移时同步检查移动端、桌面端、浅色/深色主题。 |
| 翻译 key 漏项 | 增加语言包 key 覆盖测试和开发环境缺失 key 警告。 |

## 6. Definition of Done

- 用户可以在系统设置“常规”中切换中文/英文。
- 首次进入能按运行时语言自动选择显示语言。
- 刷新、重启、同步恢复后语言设置稳定。
- `html lang`、页面标题、ARIA 标签、主要用户可见错误都随语言切换。
- 主工作台、设置、历史、分享、同步、桌面提示、管理页核心文案完成中英文覆盖。
- `npm run lint`、`npm run test`、`npm run build`、`npm run build:desktop` 通过。
