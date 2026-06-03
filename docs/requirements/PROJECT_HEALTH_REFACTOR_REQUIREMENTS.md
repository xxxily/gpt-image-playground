---
title: GPT Image Playground 项目健康度问题梳理与系统性改造需求
summary: 面向安全、代码组织、实现质量、运行时分支、兼容债、依赖与验证体系的项目健康度审计和阶段改造规划。
createdAt: 2026-06-03
status: draft-plan
---

# GPT Image Playground 项目健康度问题梳理与系统性改造需求

## 1. 背景与目标

当前项目已经覆盖 Web、Tauri Desktop、Tauri Mobile/Android、后台管理、分享短链、展示内容、S3 同步、视频、图生文、提示词润色和多供应商模型管理。功能扩张速度快，很多模块已经有良好的局部防护和测试，但整体仍存在“早期产品可接受、用户规模扩大后会明显变重”的工程债。

本需求的目标不是立刻做一次大爆炸重写，而是在用户量还不大时，把明显问题拆成可执行改造，提前收紧安全边界、减少兼容包袱、降低后续功能变更成本。

## 2. 审计范围与现状快照

本次梳理基于 2026-06-03 工作区代码，重点查看：

- Web App Router 页面与 API Routes：`src/app/**`
- 前端组件与工作台状态：`src/components/**`、`src/features/**`、`src/hooks/**`
- 共享业务库：`src/lib/**`
- Tauri/Rust 代理与本地文件能力：`src-tauri/src/**`
- 依赖、构建、文档：`package.json`、`next.config.ts`、`tsconfig.json`、`vitest.config.ts`、`scripts/**`、`docs/**`

关键事实：

- 最大文件集中在主工作台和设置面板：`src/app/page.tsx` 约 7211 行，`src/components/settings-dialog.tsx` 约 7127 行，`src/components/editing-form.tsx` 约 4422 行。
- API Route 数量已经达到约 50 个，覆盖公开接口、管理员接口、文件读取、S3、视频、图生文、批量规划等。
- `npm audit --omit=dev` 当前未发现生产依赖漏洞，但 `npm outdated` 显示基础依赖普遍落后，其中 `next@16.2.6` 搭配 `eslint-config-next@15.3.1` 存在版本线不一致。
- Rust 侧本机未安装 `cargo audit`，无法形成常规 Rust 依赖漏洞报告；`cargo tree -d` 显示 Tauri 依赖链里存在多版本重复依赖。
- 本地生成物没有进入 Git，但工作区存在大型未跟踪目录：`src-tauri/target` 约 7.0G，`.next` 约 1.5G，`node_modules` 约 635M，`generated-images` 约 34M。

已有正向基础：

- 管理后台已有会话、角色、mutation origin 检查和部分限流。
- 公开 Base URL 和远程图片代理已有 SSRF 地址段拦截。
- 配置导出已有 secret masking。
- Dexie 图片表避免 Blob 侧大索引，移动端热路径有性能意识。
- 多数 Tauri 调用已经集中到 `src/lib/desktop-runtime.ts`。

## 3. 总体问题判断

当前最大的风险不是某一个单点功能，而是“安全、兼容、运行时分支和 UI 状态”都靠局部约定维持。随着功能继续增加，新入口很容易绕过既有约束。

需要优先从以下方向治理：

1. 先做配置 schema v2、迁移管线和兼容退场策略，避免旧字段继续挤占主路径。
2. 把巨型工作台和设置面板拆成可测试、可替换的特性模块。
3. 收敛后台配置、公开配置和生产 secret 治理，避免公开接口和环境变量继续分散扩张。
4. 建立 i18n、依赖、类型、构建、桌面端和安全回归的基础门禁。
5. 把 Web/Tauri 能力矩阵显式化，避免桌面静态包和 Web API Route 互相隐式依赖。
6. 把分散的安全能力做成默认路径，但与计划退场的功能解耦，避免在短期废弃能力上投入过多。

## 4. 优先级定义与当前执行焦点

- P0：当前主线必须优先解决的架构债，会直接影响后续功能、迁移和多人协作成本。
- P1：明确风险或高维护成本问题，但可以在主线重构之后按模块收敛。
- P2：体验、工具链或工程卫生问题，建议阶段性收敛。
- P3：长期演进项，可与后续大版本一起处理。
- Deferred：依赖产品决策或功能成熟度，暂不进入当前执行主线。

当前执行焦点从原 Phase 2-5 前移为主线：

1. 配置 schema v2、迁移、兼容退场和存储 registry。
2. `page.tsx`、`settings-dialog.tsx` 等巨石组件拆分。
3. 后台配置、公开运行时配置、生产 secret 和 SQLite migration 治理。
4. i18n 迁移、依赖升级、类型检查、CI 和质量门禁。
5. Web/Tauri 构建与能力矩阵硬化。

当前暂缓项：

- `APP_PASSWORD`：实际使用较少，且后续计划移除。除非在移除前仍要承诺密码保护部署，否则不把统一鉴权改造作为第一批任务。
- 视频相关能力：文生视频、图生视频和桌面视频本地存储尚未完成产品闭环和实测，先冻结为待验证功能，不阻塞当前主线重构。

## 5. 安全与隐私问题（按当前执行优先级重排）

### 5.1 Deferred：APP_PASSWORD 图片读取保护缺口（待退场决策）

当前执行判断：

- 此问题只影响启用 `APP_PASSWORD` 的部署。
- 项目当前基本不会通过设置 `APP_PASSWORD` 使用，并且后续计划移除该功能。
- 因此不建议把完整统一鉴权改造放进第一批任务；更合理的路径是先确认 `APP_PASSWORD` 退场方案。

现状：

- `/api/images`、`/api/image-proxy`、`/api/history-assets`、视频和 S3 相关接口会校验 `APP_PASSWORD` 或 `passwordHash`。
- `/api/image/[filename]/route.ts` 只校验文件名并直接读取 `generated-images`，没有检查 `APP_PASSWORD`。
- 这意味着启用密码保护后，生成文件只要路径泄露或文件名被猜到，仍可能被直接读取。

影响：

- 密码保护边界不完整。
- 分享、历史、代理和生成结果的安全语义不一致。

改造要求：

- 优先做产品决策：移除 `APP_PASSWORD`、替换为正式登录体系，或仅保留私有部署兼容层。
- 如果 `APP_PASSWORD` 在下一个版本仍保留，至少补一个最小保护：`/api/image/[filename]` 在密码开启时不得无条件公开读取。
- 不建议为计划退场的 `APP_PASSWORD` 继续设计复杂的长期 token 体系。

完整保留时的要求：

- 新增统一的 server asset access helper，覆盖 `/api/image/[filename]`、删除、上传、历史资产、S3 fallback 等所有文件类 route。
- 当 `APP_PASSWORD` 启用时，文件读取必须满足以下任一条件：
  - 有合法 `x-app-password` 或短期访问 token。
  - 资源被明确标记为公开分享资源。
  - 通过短链或分享系统签发的只读 token 访问。
- 不建议继续在查询参数里传长期 `passwordHash`。

完整保留时的验收标准：

- `APP_PASSWORD` 开启时，未授权请求 `/api/image/{filename}` 返回 401。
- Web 历史图片、分享图片、Tauri 本地图片读取仍可正常展示。
- 增加 route 测试覆盖有密码、无密码、无效密码、公开分享资源四类路径。

### 5.2 Deferred：APP_PASSWORD 校验逻辑重复且强度不一致（待退场或隔离）

当前执行判断：

- 不把所有 `APP_PASSWORD` route 统一改造作为当前优先任务。
- 更高价值的改造是把 `APP_PASSWORD` 从主路径隔离出来，避免继续污染图片、批量、图生文、润色、视频等 route。

现状：

- `src/lib/api-password.ts` 已有 `verifyAppPasswordHash()`，使用格式校验和 `crypto.timingSafeEqual`。
- 多个 route 仍复制 `sha256(process.env.APP_PASSWORD)` 后直接字符串比较，例如 `/api/images`、`/api/image-proxy`、`/api/image-delete`、`/api/batch-plan`、`/api/prompt-polish`、`/api/image-to-text`、`src/lib/video-route-helpers.ts`。
- 前端将 `clientPasswordHash` 存入 `localStorage`，并在部分请求中通过 body、header 或 query 传递。

影响：

- 新增 route 容易漏鉴权或使用弱一点的比较逻辑。
- query 参数形式容易进入浏览器历史、代理日志或 referer。
- 长期 hash 实际上接近 bearer token，一旦 XSS 或本地插件读取 localStorage，就可复用。

改造要求：

- 先做兼容退场设计：`APP_PASSWORD` 标记为 deprecated，停止新增依赖它的 route 行为。
- 如果继续保留一个兼容周期，所有旧逻辑集中到单一 compatibility helper，业务 route 不再自行比较 hash。
- 禁止新增 query 参数形式的 `passwordHash`；历史兼容可临时保留但加 deprecation warning。
- 不建议在当前阶段投入短期 session token 或 signed asset token，除非产品决定保留密码保护能力。

兼容保留时的验收标准：

- `APP_PASSWORD` 有明确退场、替代或兼容隔离方案。
- 如果仍保留兼容层，`rg "sha256\\(process.env.APP_PASSWORD\\)" src/app/api src/lib` 不再出现业务 route 自行比较。
- 访问密码错误不泄露内部实现，错误码稳定。
- 有测试证明 body/header/query 三种旧输入在兼容期行为明确，并有移除计划。

### 5.3 Phase 3：生产 secret 缺失时存在开发兜底

现状：

- `src/lib/server/short-links.ts` 中短链 passphrase pepper 缺失时回退到固定字符串 `gpt-image-playground-short-link-dev`。
- 短链访问统计 hash salt 缺失时也回退到固定字符串。
- 短链目标 URL 加密 secret 缺失时，目标 URL 会以 `plain:` base64 形式存储。

影响：

- 生产部署如果漏配 secret，不会 fail closed。
- 短链目标、访问统计和 passphrase 的安全等级依赖部署者是否读懂文档。

改造要求：

- 引入 server startup/runtime config validator。
- 当短链公开创建、访问统计或目标加密启用时，缺少 `BETTER_AUTH_SECRET` / 专用 secret 应返回配置错误，而不是静默降级。
- 后台设置页显示“可运行但不安全”的明确状态，不只显示是否已配置。

验收标准：

- 缺少生产 secret 时，公开短链创建或敏感短链能力不可启用。
- 管理后台 `/admin/settings` 能显示缺失 secret 的风险级别。
- 文档更新部署必填项。

### 5.4 Phase 4：日志可能暴露用户提示词、文件路径和供应商错误细节

现状：

- `/api/images` 会打印 prompt 前 50 字、OpenAI generate params、文件保存路径、模式和模型等。
- `/api/image-delete`、`/api/image/[filename]` 会打印文件路径或 filename。
- 多个 route 直接 `console.error(error)` 返回或记录供应商错误。

影响：

- Prompt、文件路径、供应商响应可能包含用户私有信息。
- 私有部署时日志常被平台采集，后续难以做合规声明。

改造要求：

- 引入统一 server logger，默认结构化、按环境控制级别。
- 对 prompt、API Key、Authorization、S3 key、文件系统绝对路径、分享 URL、短链 target 做 redaction。
- Debug 日志必须由显式环境变量或桌面 debug mode 开启。

验收标准：

- `npm run test` 覆盖 redaction helper。
- 生产环境默认不打印 prompt 原文和本地绝对路径。
- route 返回给用户的错误和写入日志的错误分级明确。

### 5.5 Phase 5：Tauri 安全边界过宽

现状：

- `src-tauri/tauri.conf.json` 中 `app.security.csp` 为 `null`。
- `src-tauri/capabilities/default.json` 中 opener 允许 `url: "*"`.
- 前端仍有 `convertFileSrc` 直接从 `@tauri-apps/api/core` 导入，分散在 `src/app/page.tsx`、`src/components/history-panel.tsx`、`src/components/history/history-image-card.tsx`、`src/features/workbench/utils/image-files.ts`。

影响：

- 前端 XSS 一旦出现，桌面端可被放大为外链打开、本地 asset protocol 和 native command 组合风险。
- 运行时能力没有集中审计点。

改造要求：

- 为 Tauri 设置最小可用 CSP，至少限制脚本、图片、连接、frame 的来源。
- opener 改为内部 helper 校验后的 allowlist 或 command wrapper，不保留全局 `*`。
- 所有 Tauri API 直接导入收敛到 `src/lib/desktop-runtime.ts`，新增 `convertDesktopFileSrc()`。
- 按命令分组能力权限，明确哪些命令 Desktop-only，哪些 Mobile 可用。

验收标准：

- `rg "@tauri-apps/api" src` 只允许在 `desktop-runtime.ts` 和测试 mock 中出现。
- Tauri app 在图片预览、外链、更新、剪贴板、S3 同步等已完成能力下通过手工验收；视频下载随视频功能完成后补验。
- CSP 开启后 Web 静态导出和桌面加载不报资源错误。

## 6. 运行时分支与功能一致性问题

### 6.1 Deferred：桌面视频本地文件保存分支不可用（视频功能完成后处理）

当前执行判断：

- 视频功能还没有完成产品闭环，也缺少 Web、Desktop、Android 的真实验收。
- 当前不建议先投入桌面视频本地存储分支；应先冻结预期，避免其他 agent 把它当作高优先级修复。
- 等视频功能完成最小可用版本和测试计划后，再决定保留本地文件系统、统一 IndexedDB，还是只保留远程 URL。

现状：

- `src/lib/video-asset-store.ts` 调用 `invokeDesktopCommand('save_local_video', ...)`。
- `src-tauri/src/lib.rs` 的 `invoke_handler` 没有注册 `save_local_video`。
- `src-tauri/src/proxy/commands.rs` 中也未实现对应 command。
- 代码会 catch 后回退 IndexedDB，因此不一定暴露为明显错误，但桌面视频本地存储预期没有真正生效。

改造要求：

- 视频功能完成产品验收后，再明确视频资产存储策略：桌面端是否支持本地文件系统保存。
- 如果支持，补齐 Rust command、大小限制、MIME 校验、文件名校验、删除和读取路径。
- 如果不支持，移除前端无效分支和相关 UI 暗示，统一 IndexedDB/远程 URL 策略。

视频功能成熟后的验收标准：

- Tauri 桌面端视频生成结果刷新后可恢复。
- 本地文件保存、删除、同步 manifest 的 storageMode 与真实存储一致。
- 有 Rust 测试和前端单元测试覆盖 command 存在性。

### 6.2 Phase 5：桌面静态构建通过移动源码目录规避 API Route

现状：

- `scripts/build-desktop.mjs` 构建时临时把 `src/app/api`、`src/app/admin`、`src/app/s` 目录移动到 `.desktop-build-api-backup`，构建后再移回。

影响：

- 构建中断、并发构建、IDE/watch 或脚本异常都可能留下半移动状态。
- 源码移动方式让静态导出和 Web 构建的边界不可见。

改造要求：

- 改为显式路由分层或构建期条件：
  - 将 server-only route 放入不会被 desktop export 扫描的边界。
  - 或通过 Next 支持的静态导出约束重组入口。
  - 或生成 desktop 专用 app tree，而不是移动原始目录。
- 构建脚本必须支持中断恢复和 dry-run 检查。

验收标准：

- `npm run build:desktop` 不再 rename `src/app` 内源码目录。
- Web build、desktop build、Android build 的 route 差异有文档矩阵。
- 构建失败后 `git status --short` 不出现目录移动残留。

### 6.3 Phase 5：Web/Tauri 能力矩阵没有成为测试矩阵

现状：

- 规则要求 image generation、editing、prompt polish、history、sync、sharing 同时验证 Web 和 Tauri。
- 代码已有大量分支：Web API Route、Tauri Rust proxy、客户端直连、服务器中转、IndexedDB、桌面文件系统。
- 测试多为纯函数和局部 executor，缺少能力矩阵级别验证。

改造要求：

- 建立 `docs/requirements` 或 `docs/desktop-and-deployment.md` 的运行时能力矩阵。
- 每个能力明确 Web、Desktop、Android 的路径、降级行为和测试入口。
- 在单元测试中提供 runtime adapter mock，覆盖至少：
  - Web proxy
  - Web direct
  - Tauri proxy
  - Tauri local fs
  - client-direct-link-priority 禁用 server route

验收标准：

- 新增功能需求必须填写能力矩阵。
- `npm run test` 覆盖关键 runtime branch。
- `npm run build:desktop` 不依赖 Node-only route。

## 7. Phase 1/2：代码组织与模块边界问题

### 7.1 主工作台和设置面板是巨石组件

现状：

- `src/app/page.tsx` 约 7211 行，集成配置加载、URL share、密码、剪贴板、任务提交、历史、同步、工作空间、Tauri 本地文件、视频、图生文、批量等职责。
- `src/components/settings-dialog.tsx` 约 7127 行，混合供应商端点、模型目录、同步、桌面、批量、导入导出、语言、视频、图生文、润色等职责。
- 已存在 `docs/requirements/WORKBENCH_MODULARIZATION_REFACTOR_PLAN.md`，但当前仍未完成主路径拆分。

影响：

- 任意小变更都容易触及大文件，冲突和回归概率高。
- 业务逻辑难以单测，只能靠人工点流程。
- i18n、主题、移动端布局和 runtime branch 难以分层验证。

改造要求：

- 工作台按 feature slice 拆分：
  - `features/workbench/state`
  - `features/workbench/submission`
  - `features/workbench/history`
  - `features/workbench/share`
  - `features/workbench/sync`
  - `features/workbench/desktop-assets`
  - `features/workbench/video`
  - `features/workbench/vision-text`
- 视频 slice 当前只做边界隔离和降级路径整理，不补齐未完成的视频产品能力。
- 设置面板按 view + domain store 拆分：
  - provider endpoints
  - model catalog
  - image task defaults
  - vision text
  - prompt polish
  - batch
  - sync
  - desktop/runtime
  - import/export
- 大组件只保留 orchestration 和 layout，不直接做 API payload、storage migration、remote fetch。

验收标准：

- 单文件软上限：普通组件 < 500 行，复杂 feature container < 1000 行。
- `src/app/page.tsx` 降到 1500 行以内，后续继续压到 800 行以内。
- `settings-dialog.tsx` 降到 1500 行以内，并保留视图注册表。
- 提交、同步、分享、桌面资产操作都有独立纯函数或 hook 测试。

### 7.2 配置模型长期叠加，旧字段和新模型目录互相映射

现状：

- `AppConfig` 同时包含旧 provider 字段：`openaiApiKey`、`geminiApiKey`、`sensenovaApiKey`、`seedreamApiKey`。
- 同时包含新模型目录字段：`providerEndpoints`、`modelCatalog`、`modelTaskDefaultCatalogEntryIds`。
- `provider-model-catalog.ts` 大量处理 `legacyImageProvider`、`legacyVisionTextKind`、`LegacyUnifiedConfig`，新旧配置互相生成。

影响：

- 保存设置、分享链接导入、模型发现、任务默认模型选择都需要考虑新旧字段。
- 兼容层会长期进入主路径，难以判断真实数据源。

改造要求：

- 定义配置 schema v2，并明确字段状态：
  - active：当前主数据源。
  - read-only migration：只读旧字段，用于迁移。
  - deprecated：仍读取但不再写入。
  - removed：下个大版本删除。
- 将 provider credential 主数据源收敛为 `providerEndpoints`。
- 旧 provider 字段只在 `migrations/config-v1-to-v2.ts` 中读取一次，不在 UI 保存路径持续双写。
- 分享链接和导入导出必须标注 schemaVersion，并在导入时转换到最新结构。

验收标准：

- `loadConfig()` 不再承担全部历史迁移细节，而是调用版本化 migration pipeline。
- 新保存的配置不再写入已废弃字段，除非专门用于导出旧版本。
- 有测试覆盖旧配置、非法值、用户自定义端点、分享导入和同步恢复。

### 7.3 后台数据库迁移是手写 SQL 且缺少版本记录

现状：

- `src/lib/server/db.ts` 通过 `CREATE TABLE IF NOT EXISTS` 和一组 `ALTER TABLE ... ADD COLUMN` 尝试迁移。
- 没有显式 migration version table，也没有 up/down 或已执行记录。

影响：

- 表结构越复杂，手写迁移越难判断某个部署处于哪个 schema 状态。
- 失败后重试、字段类型调整、索引变更和数据 backfill 风险升高。

改造要求：

- 引入 `schema_migrations` 表，记录 migration id、执行时间和 checksum。
- 将当前建表 SQL 固化为 baseline migration。
- 后续变更按 migration 文件追加。
- 对本地 SQLite 做启动前备份或至少写入 migration audit。

验收标准：

- 新部署可从空库迁移到最新。
- 旧库可无损迁移到最新。
- migration 重复执行无副作用。
- 管理后台设置页显示数据库 schema version。

## 8. Phase 1/4：实现质量与可测试性问题

### 8.1 API Route 输入校验风格不统一

现状：

- 管理后台和短链部分使用 Zod schema。
- 图片、图生文、批量、视频等 route 大量手写 `FormData` / `request.json()` 解析和字符串归一化。
- 同类参数如 `passwordHash`、`apiBaseUrl`、`providerEndpoint`、`model`、`prompt` 在不同 route 有不同解析方式。

改造要求：

- 为每类 route 建立 schema 和 adapter：
  - app password
  - provider endpoint
  - public base URL
  - file upload
  - model catalog selection
  - storage mode
- 业务 route 只接受已解析过的 typed request。
- 用户可见错误返回稳定 `code` + `message` + `details`。

当前主线验收标准：

- 新 API Route 禁止直接散写 `request.json().catch` 或 `formData.get` 主逻辑。
- 至少覆盖 `/api/images`、`/api/image-to-text`、`/api/prompt-polish`、`/api/batch-plan`。
- `/api/video/*` 在视频功能进入实测阶段后再纳入同一 schema 规范。

### 8.2 i18n 仍依赖 legacy DOM 翻译桥

现状：

- 已有 `AppLanguageProvider` 和 `APP_MESSAGES`。
- 仍存在 `src/components/i18n-text-bridge.tsx`，通过 `MutationObserver` 扫描 DOM 文本和属性并调用 legacy 翻译。
- 大量组件和 API 仍有硬编码中文/英文用户文案。

影响：

- 运行时 DOM 翻译不可静态检查，性能和闪烁风险更高。
- 新文案容易漏翻译，测试难覆盖。
- API 返回中文字符串后，英文 UI 很难一致本地化。

改造要求：

- 按既有 `INTERNATIONALIZATION_IMPLEMENTATION_CHECKLIST.md` 继续迁移，但提高优先级。
- 禁止新增硬编码可见文案；新增文案必须进入 `APP_MESSAGES`。
- API Route 尽量返回错误码，客户端本地化。
- legacy bridge 只保留到迁移完成，并设置移除里程碑。

验收标准：

- `rg "[\\u4e00-\\u9fff]" src/components src/app` 的剩余项必须有白名单说明。
- `I18nTextBridge` 可被关闭且核心流程仍显示正确语言。
- 中英 key 集合一致性测试通过。

### 8.3 本地存储分散，缺少统一数据保留与清理策略

现状：

- 配置、prompt history、batch draft、workspace layout、asset categories、sync config、clientPasswordHash 等都直接使用 localStorage。
- IndexedDB 存图片、视频、素材 blob。
- 生成文件写入 `generated-images` 或 Tauri app local data。

影响：

- 用户数据导出、重置、清理、隐私说明和移动端容量控制难统一。
- `clientPasswordHash`、S3 credentials、API Key 等敏感值与普通偏好混在浏览器存储里。

改造要求：

- 建立 storage registry，列出所有 storage key、数据类别、是否敏感、是否同步、是否导出、保留周期。
- 重置配置、清空历史、删除工作空间、同步恢复都必须走 registry。
- 对敏感字段提供更明确的“本地明文风险”提示和可选的浏览器端加密/会话模式。

验收标准：

- 文档列出所有 localStorage key 和 Dexie table。
- 设置页可以执行分区清理：配置、历史图片、视频、素材、同步配置、登录态除外。
- 测试覆盖 reset 不误删用户素材或 secret。

## 9. Phase 1/3：过度向后兼容与产品策略问题

### 9.1 兼容代码缺少 sunset policy

现状：

- 代码中存在大量 `legacy`、`fallback`、旧字段双写和旧入口兜底。
- 旧环境变量展示内容、旧 provider 字段、旧图生文配置、旧尺寸 preset、旧 sync manifest 路径都仍在主逻辑出现。

影响：

- 每次新增能力都要考虑旧结构，主路径越来越复杂。
- 用户量不大时继续保留无限兼容，会错过低成本重构窗口。

改造要求：

- 建立兼容政策：
  - 小版本内自动迁移。
  - 一个 minor 周期内保留只读兼容。
  - 下一个大版本删除写路径。
- 每个 legacy 分支必须有 owner、移除条件和测试。
- 对暂无真实用户价值的旧兼容，允许破坏性迁移，但必须提供一次性导出/备份。

验收标准：

- 新增 `docs/requirements/COMPATIBILITY_SUNSET_POLICY.md` 或在本需求后续阶段补充。
- `legacy` 分支都有注释或 issue/doc 关联。
- 新配置保存结果不再产生无用旧字段。

### 9.2 管理后台和公开配置中心有继续扩张的趋势

现状：

- 展示内容、短链、公开 CTA、S3 fallback、桌面 promo service、环境变量 fallback 等分散在后台表、环境变量和公开 API 中。
- 已有需求文档提出统一后台配置中心，但仍未完全落地。

改造要求：

- 将站点级配置分为：
  - public runtime config
  - protected admin config
  - server secret config
  - deployment-only config
- 明确哪些可后台改，哪些必须环境变量，哪些可公开。
- 公共读取接口只返回最小字段。

验收标准：

- `/api/public-runtime-config` 的响应字段有 schema 和快照测试。
- 后台设置页不直接散读环境变量，而通过 typed config summary。
- Secret 类配置不进入 SQLite 明文，除非有加密方案和密钥轮换策略。

## 10. Phase 4：依赖、类型和工具链问题

### 10.1 依赖版本线不一致

现状：

- `next` 为 16.2.6，但 `eslint-config-next` 为 15.3.1。
- React、OpenAI、AWS SDK、Radix、Dexie、Tailwind、Vitest 等均有可升级版本。
- `npm ls --depth=0` 显示若干 extraneous 包，说明本地依赖状态可能不干净。

改造要求：

- 建立每月依赖维护节奏。
- Next/React/ESLint/Tailwind/Vitest 作为同一升级批次验证。
- `npm ci` 应作为 CI 默认安装方式，禁止依赖本地 node_modules 状态。

验收标准：

- `npm audit --omit=dev`、`npm run lint`、`npm run test`、`npm run build`、`npm run build:desktop` 在干净安装中通过。
- `eslint-config-next` 与 Next 主版本一致。
- `npm ls --depth=0` 不出现 extraneous。

### 10.2 TypeScript 严格度被配置削弱

现状：

- `tsconfig.json` 启用 `strict: true`，但同时 `allowJs: true`、`skipLibCheck: true`。
- 代码中存在较多 `unknown as`、SDK 类型绕过和 `JSON.parse(JSON.stringify(...)) as unknown as T`。

改造要求：

- 先关闭 `allowJs`，确认项目是否仍需要 JS 源码纳入 TS 编译。
- 逐步收紧 `skipLibCheck`，至少在 CI 增加周期性 full typecheck job。
- 对 SDK 类型不足的地方建立 typed adapter，避免把 `as unknown as` 扩散到业务层。

验收标准：

- `npm run typecheck` 独立存在，不只依赖 Next build。
- 新代码禁止新增无解释的双重断言。
- 关键 API payload 有类型测试或 schema 测试。

### 10.3 Rust 安全审计工具缺失

现状：

- 本机执行 `cargo audit --version` 返回 `no such command: audit`。
- 当前只依赖 `cargo tree -d` 观察重复依赖，无法发现 RustSec 漏洞。

改造要求：

- 在本地和 CI 安装 `cargo-audit` 或使用等价供应链扫描。
- 增加 `cargo audit`、`cargo test`、`cargo clippy` 的桌面端质量门禁。

验收标准：

- CI 输出 Rust dependency audit 报告。
- 漏洞处理策略与 npm audit 一致，标明是否可接受、临时豁免和修复版本。

## 11. Phase 4/P2：工程卫生与仓库维护问题

### 11.1 本地产物体积大，影响搜索和审查效率

现状：

- `.gitignore` 已忽略 `src-tauri/target`、`.next`、`out`、`generated-images` 等。
- 本地仍存在大型目录，普通 `rg --files` 如果没有排除会产生大量噪音。

改造要求：

- 增加 `npm run clean` 和 `npm run clean:deep`。
- 文档说明哪些目录可安全删除。
- 常用审查脚本默认排除 `src-tauri/target`、`.next`、`out`、`node_modules`、`generated-images`。

验收标准：

- 新增清理脚本不删除用户配置、SQLite 正式库和未备份生成资产。
- `docs/desktop-and-deployment.md` 或贡献文档说明本地清理方式。

### 11.2 私有环境文件和临时库存在工作区

现状：

- 工作区存在 `.env.local`、`.env.production`、`tmp/promo-admin.sqlite`、`tmp/release-backups/.env.production.before-v2.1.0` 等未跟踪文件。
- `.gitignore` 已覆盖这些文件，当前没有进入 Git。

改造要求：

- 增加 secret scan 脚本，只扫描 tracked 文件和可选 untracked 文件。
- 发布前检查不读取、不打印 `.env` 内容，只报告是否存在和是否被跟踪。
- tmp/release-backups 需要保留周期或清理命令。

验收标准：

- CI 阶段对 tracked 文件做 secret scan。
- 本地 release 流程提示未跟踪 secret 文件不会被复制到 worktree。

## 12. 建议分阶段路线（按当前执行优先级）

### Phase 0：执行准备和基线冻结，0.5-1 天

- 从本文拆出可执行任务单，至少覆盖配置迁移、巨石拆分、后台配置治理、i18n/依赖/CI、运行时矩阵五条主线。
- 记录当前基线命令结果：`npm run lint`、`npm run test`、`npm run build`、`npm run build:desktop`、Rust 侧可用检查。
- 补充当前执行约束：`APP_PASSWORD` 与视频能力先进入暂缓池，不作为第一批实现任务。
- 为配置、后台设置和主工作台建立回归样例或 fixture，避免后续拆分没有对照。

### Phase 1：配置 schema v2 与兼容退场，3-7 天

- 设计配置版本化 migration pipeline，并明确 active、read-only migration、deprecated、removed 四类字段状态。
- provider endpoints 成为唯一主数据源。
- 旧 provider 字段只读迁移，不再持续双写。
- 分享、同步、导入导出走 schema version。
- 敏感存储 registry 和 reset/backup 流程落地。
- 输出兼容 sunset policy，说明哪些旧字段在下一个 minor 或 major 删除。

### Phase 2：巨石组件拆分，1-2 周

- `page.tsx` 拆工作台 orchestration、submission、history、share、sync、desktop-assets、video、vision-text。
- `settings-dialog.tsx` 拆视图注册表和各设置 domain。
- 大 hook 和 executor 增加单元测试。
- 移除直接跨 domain 读写 localStorage 的调用。
- 视频相关 slice 只做边界隔离，不在本阶段补齐未完成的视频能力。

### Phase 3：后台和公开配置治理，1 周

- 引入 SQLite migration version table。
- 站点级配置分层：public runtime config、protected admin config、server secret config、deployment-only config。
- 生产 secret 缺失 fail closed。
- 短链 target 加密和访问统计 salt 做启动校验。
- 后台设置页通过 typed config summary 展示风险，不直接散读环境变量。
- `APP_PASSWORD` 只作为 deprecated compatibility 项归档，不扩大使用范围。

### Phase 4：i18n、依赖和质量门禁，持续迭代

- 迁移剩余硬编码 UI 文案，逐步移除 `I18nTextBridge`。
- 升级 Next/React/ESLint/Tailwind/Vitest/OpenAI/AWS SDK。
- 建立 `npm ci` + typecheck + lint + test + build + desktop build + cargo test/audit 的 CI 基线。
- 定期清理本地和发布产物。
- 统一 server logger 和 redaction helper，减少 prompt、路径、secret 和供应商错误细节进入生产日志。

### Phase 5：运行时矩阵与 Tauri 硬化，1 周

- 建立 Web/Desktop/Android 能力矩阵，并把关键能力映射到测试入口。
- 把 `convertFileSrc` 收敛进 `desktop-runtime.ts`。
- 改造 desktop build，不再移动源码目录。
- 收紧 Tauri CSP 和 opener 权限。
- 明确 Web API Route、Tauri Rust proxy、客户端直连、IndexedDB、本地文件系统的降级策略。

### Deferred：暂缓池

- `APP_PASSWORD`：优先做退场决策。若短期仍保留，只做最小安全兜底和 compatibility helper 隔离，不投入长期鉴权体系。
- 视频本地存储：等待视频功能完成最小可用版本、真实验收和测试计划后，再决定补齐 `save_local_video`、移除本地分支或统一存储策略。
- 视频相关 Web/Tauri 手工验收：随视频功能正式进入可测状态后再纳入运行时矩阵。

## 13. 验收总清单

- 当前主线：
  - 配置 schema v2 有版本化 migration pipeline，新保存配置不再持续写入废弃字段。
  - `page.tsx` 和 `settings-dialog.tsx` 行数显著下降，主路径逻辑进入 feature slice。
  - 后台配置、公开配置、server secret 和部署配置有清晰分层。
  - i18n、依赖、类型、构建、测试和桌面端检查进入固定门禁。

- 安全：
  - 生产 secret 缺失时敏感能力 fail closed。
  - 日志默认不包含 prompt 原文、API Key、S3 secret、绝对文件路径和完整分享 URL。
  - Tauri CSP 非空，opener 不再全局 `*`。
  - `APP_PASSWORD` 被移除，或被隔离在明确标记 deprecated 的 compatibility layer 中；如果仍保留，受密码保护的资产读取至少有最小兜底。

- 代码组织：
  - `page.tsx` 和 `settings-dialog.tsx` 行数显著下降。
  - feature 逻辑可通过独立 hook/helper 测试。
  - 配置迁移从 `loadConfig()` 中抽成版本化 pipeline。

- 运行时：
  - Web、Desktop、Android 能力矩阵清晰。
  - Desktop build 不移动源码目录。
  - 视频本地存储没有混入当前主线；视频功能完成后再验收真实可用、统一存储或明确移除。

- 兼容：
  - legacy 字段有 sunset policy。
  - 新保存配置不再产生无意义旧字段。
  - 旧配置、旧同步快照、旧分享链接有明确迁移测试。

- 质量：
  - `npm audit --omit=dev` 无高危。
  - `npm run lint`、`npm run test`、`npm run build`、`npm run build:desktop` 有固定验证记录。
  - Rust 侧有 `cargo test` 和 dependency audit。

## 14. 非目标

- 不在本需求中重写 UI 视觉风格。
- 不立即移除所有旧配置字段。
- 不把所有存储都迁移到服务端。
- 不把 Web、Desktop、Android 强行合并为同一实现路径；目标是共享契约和显式分支。

## 15. 关联文档

- [工作台大文件模块化重构规划](./WORKBENCH_MODULARIZATION_REFACTOR_PLAN.md)
- [依赖漏洞修复与依赖安全全面排查需求文档](./DEPENDENCY_SECURITY_AUDIT_REQUIREMENTS.md)
- [国际化（i18n）实施清单](./INTERNATIONALIZATION_IMPLEMENTATION_CHECKLIST.md)
- [Tauri Rust 请求代理服务规划](./TAURI_RUST_PROXY_PLAN.md)
- [云同步功能改进与协议扩展规划](./CLOUD_SYNC_IMPROVEMENT_AND_PROTOCOL_EXPANSION.md)
- [API Key 购买或使用引导入口与后台配置管理需求文档](./API_KEY_PURCHASE_CTA_ADMIN_CONFIG_REQUIREMENTS.md)
