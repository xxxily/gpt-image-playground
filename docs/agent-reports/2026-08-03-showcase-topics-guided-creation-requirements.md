# 专题案例与引导式创作能力实现与发布报告

| 字段     | 内容                                                                                                                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日期     | 2026-08-03（2026-08-04 继续补齐托管媒体、兼容降级、匿名漏斗并准备 `v2.15.8`）                                                                                                                                             |
| 状态     | 部分完成 (Partial)：核心专题发现、引导式创作、托管媒体、结构化后台、跨端目录和匿名漏斗主体已可用；24 个真实 AI 案例资产、外部 HTTPS 媒体主动健康探测、5 名非专业用户测试和真机安装验收仍缺证据。 |
| 相关请求 | 梳理并实现“老照片修复、试衣间、创意风格化等专题 + 案例展示 + 点击复现 + 后台管理”，完成后发布新补丁版本、触发 Action 产物并部署 129。                                                                                 |
| 相关文档 | [专题案例与引导式创作能力需求文档](../requirements/SHOWCASE_TOPICS_AND_GUIDED_CREATION_REQUIREMENTS.md)、[展示内容与后台管理使用手册](../展示内容与后台管理使用手册.md)、[发布流程](../../RELEASE_PROCESS.md)         |
| 改动范围 | showcase 领域契约、默认目录、Web/Tauri 目录读取、专题前台、工作台引导、来源归因、后台 API/UI、SQLite schema、i18n、需求与用户文档。                                                                                   |
| 提交状态 | 功能提交 `ef1fa43`、发布提交 `23f9cba`、发布后报告收尾提交 `1492844`、annotated tag `v2.15.8`、`master` 与 tag push 均已完成；Action 和 129 部署已验收。工作区内用户既有的任务服务、社区调研和 PSD 研究文件继续显式排除。 |

## 范围核对

| 请求目标             | 实际结果                                                                                                                                                                   | 证据                                                                                                | 状态                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 专业、全面地细化需求 | 完成产品定位、术语、前后台流程、数据、接口、安全、跨端、验收和阶段规划                                                                                                     | 需求文档                                                                                            | 已完成 (Completed)                                                                           |
| 默认实用专题         | 内置 6 个双语专题、24 个案例，覆盖老照片修复、虚拟试衣、创意风格化等；媒体为明确标识的 CSS 演示占位                                                                        | `src/lib/default-showcases.ts`、需求第 24 章                                                        | 部分完成 (Partial)：尚未补齐真实 AI 输入/输出案例与内部生成审计                              |
| 首页和专题中心       | 工作台下方专题区、全局功能菜单、静态 `/topics` 页面壳、专题/案例详情和深链                                                                                                 | `src/components/showcase/*`、`src/app/topics/page.tsx`                                              | 已完成 (Completed)                                                                           |
| 跟着案例复现         | 按角色支持本地文件、粘贴、系统剪贴板、素材库和历史图片；源图替换/追加、提示词 replace/append/keep、可编辑/复制提示词、模型能力检查、场景尺寸解析和安全参数载入；不自动生成 | `showcase-guide-dialog.tsx`、`workbench-page.tsx`                                                   | 已完成 (Completed)                                                                           |
| 来源归因             | 显示可返回/可单独清除的来源 Chip；普通任务、托管任务恢复和历史均可保留 `topicId/caseId/recipeVersion/catalogRevision`                                                      | `showcase-attribution-chip.tsx`、`useTaskManager.ts`、`managed-task-records.ts`、`image-history.ts` | 已完成 (Completed)                                                                           |
| 公开目录与跨端回退   | Web 同源 API；Tauri 可信远端；远端 → endpoint 缓存 → 内置目录；ETag/304                                                                                                    | `showcase-client.ts`、`desktop-config.ts`、公开 API                                                 | 已完成 (Completed)                                                                           |
| 后台管理             | `/admin/showcases` 支持列表筛选、专题/案例/主要配方字段、媒体上传与指派、匿名漏斗汇总、复制、预览、发布、下线、归档、版本回滚，并保留高级 JSON；viewer 只读 | 后台 UI/API、SQLite schema | 部分完成 (Partial)：FAQ、相关专题、用户补充要求等少数字段仍需高级 JSON |
| 权限、审计与发布安全 | owner/admin 可写、viewer 只读；写操作审计；发布快照与线上指针原子切换                                                                                                      | `src/lib/server/showcase/*`                                                                         | 已完成 (Completed)                                                                           |
| i18n、主题与响应式   | 新增固定文案全部进入中英文资源；前台和后台均完成浅色/深色、桌面/移动验证，无横向溢出；reduced-motion 下无持续旋转或位移动效依赖                                               | `messages.ts`、Playwright 验证                                                                      | 已完成 (Completed)                                                                           |
| 发布新版本和构建产物 | 目标 `v2.15.8`；本地完整质量门已通过，等待功能提交、版本提交、tag、Action Release 资产和 129 部署                                                                           | 本报告“本轮验证”与后续发布回填                                                                       | 部分完成 (Partial)                                                                           |

## 实际完成范围

- 领域层使用严格白名单归一化，拒绝未知字段、未来版本、凭证、脚本、私网/本地路径、base64 和自动提交字段。
- 内置媒体明确为 CSS 演示占位素材，不冒充真实 AI 生成案例。
- 公开 `GET /api/showcases`、`GET /api/showcases/[slug]` 支持 ETag、受控 CORS、发布快照、损坏快照隔离和内置回退。
- 后台 SQLite 增加 `showcase_topics` 草稿表和 `showcase_publications` 不可变快照表。
- 工作台引导只载入图片、提示词和允许参数，不修改 API Key、Base URL、代理、同步或分享配置。
- 当前模型不兼容时显示用户可理解原因，并只优先列出当前已配置凭证的兼容模型。
- 当前工作台已有源图时可明确选择替换或追加；模型不兼容时可直接打开现有模型设置。
- 个性化要求只会在提示词仍等于系统生成值时同步；用户手动改写后不会被后续输入覆盖。
- 后台结构化输出编辑会清理互斥尺寸模式，清空尺寸/质量不会残留旧字段。
- 后台自定义尺寸使用单个“宽×高”输入，编辑半成品不会被受控状态提前清空；保存时再拆分为数值字段。
- `preferredModelIds` 会在满足能力和凭证条件的兼容模型中优先排序，不强制覆盖用户供应商配置。
- 专题草稿写入、托管媒体复查与审计，以及媒体引用复查、文件隔离、删除与审计，分别收敛到 SQLite `IMMEDIATE` 写事务。
- 扩展客户端保留绝对 HTTPS 缩略图；严格旧客户端继续移除扩展字段，未来 recipe 仅保留安全只读信息。
- 托管任务客户端记录与恢复路径会归一化并保留非敏感专题归因，旧记录或非法字段仍安全降级。
- 后台所有破坏性操作使用项目 Dialog，不使用 `window.alert`、`prompt` 或 `confirm`。
- 生产依赖安全门将 `better-auth`、Next.js、PostCSS 和 Sharp 更新到已修复的兼容 patch 版本，`npm audit --omit=dev` 回到 0 vulnerabilities。
- Rust 锁文件将 `quinn-proto` 从 `0.11.14` 提升到兼容修复版本 `0.11.15`，消除 `RUSTSEC-2026-0185`。

## 主要文件与模块

| 领域           | 文件/模块                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 需求与报告     | `docs/requirements/SHOWCASE_TOPICS_AND_GUIDED_CREATION_REQUIREMENTS.md`、本报告                                                             |
| 领域与默认内容 | `src/lib/showcase.ts`、`src/lib/showcase-recipe.ts`、`src/lib/default-showcases.ts`                                                         |
| 客户端目录     | `src/lib/showcase-client.ts`、`src/lib/desktop-config.ts`                                                                                   |
| 前台与引导     | `src/app/topics/page.tsx`、`src/components/showcase/*`                                                                                      |
| 工作台         | `src/features/workbench/page/workbench-page.tsx`、`workbench-shell.tsx`、`editing-form.tsx`                                                 |
| 后台           | `src/app/admin/(shell)/showcases/page.tsx`、`src/components/admin/showcase-admin-client.tsx`                                                |
| 服务端         | `src/app/api/showcases/*`、`src/app/api/admin/showcases/*`、`src/lib/server/showcase/*`、`src/lib/server/schema.ts`、`src/lib/server/db.ts` |
| 归因与历史     | `src/hooks/useTaskManager.ts`、`src/lib/taskExecutor.ts`、`src/lib/image-history.ts`、`src/types/history.ts`                                |

## 问题与解决

| 问题                                                                              | 解决办法                                                                                                                             | 剩余风险                                                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Promo 和专题都有“展示内容”特征                                                    | Promo 继续负责投放入口，showcase 独立负责专题、案例和执行配方                                                                        | 后续可增加 Promo 引用专题的结构化选择器                                                                                                                     |
| 桌面静态导出不能依赖动态 SSR slug                                                 | 使用静态 `/topics` 壳和 query 深链，目录从可信远端读取并带缓存/内置回退                                                              | Web SEO 动态落地页仍是后续增强                                                                                                                              |
| 配方可能注入危险配置                                                              | 客户端和服务端复用同一严格 schema，只允许工作台安全字段                                                                              | 新字段必须先升级 schema 和兼容策略                                                                                                                          |
| 当前工作台已有 prompt/图片                                                        | prompt 提供替换、追加、保留选择；源图提供替换、追加、取消后返回调整                                                                  | 追加后仍受当前模型参考图数量和文件限制校验                                                                                                                  |
| 后台字段很多且存在互斥尺寸模式                                                    | 增加结构化专题/案例表单并保留高级 JSON；抽取输出字段 helper，在切换/清空尺寸或质量时删除旧字段；自定义尺寸改为单个“宽×高”输入          | FAQ、相关专题、用户补充要求和少数诊断字段仍需高级 JSON                                                                                                      |
| 个性化要求 effect 会覆盖用户手改 prompt                                           | 改为比较“上一次系统生成 prompt”，只有用户尚未改写时才同步下一次个性化要求                                                            | 已增加纯函数与浏览器回归验证                                                                                                                                |
| 多协作者外部模型通道返回 503                                                      | 保留已完成协作者结果，其余工作由主代理继续实现和验证                                                                                 | 不影响代码运行，但少了一轮独立 UI/需求审阅                                                                                                                  |
| RustSec 发现 `quick-xml 0.39.2` 两项高危告警和 `quinn-proto 0.11.14` 一项高危告警 | 在现有 `0.11.x` 约束内把 `quinn-proto` 升至 `0.11.15`；核对 `quick-xml` 依赖树与修复版本要求                                         | `quick-xml >=0.41.0` 需要同时跨越 Tauri 间接依赖约束，且 `plist 1.10.0` 的 MSRV 为 Rust 1.88，高于项目声明的 1.77.2；本补丁不做未经全平台验证的强制跨代覆盖 |
| 首次 Release Action 因后台预览提示残留硬编码中文失败                              | 将文案迁移到中英文 i18n 资源，提交 `301dbc2`，重建 `v2.15.5` tag 并重新触发正式 Release workflow                                     | 后续继续依靠 CI 的可见文案检查阻止同类回归                                                                                                                  |
| 161 的 Debian 10 构建容器访问归档源和 Node headers 出现间歇性网络失败             | 归档源恢复后重试；最终在 detached 部署 worktree 中让 `node-gyp` 使用 Node 二进制缓存自带的 `include/node`，不再二次访问 `nodejs.org` | 此构建辅助修正未进入本次已发布 tag；建议在后续版本正式合入并为 apt 下载增加重试                                                                             |

## 验证

| 检查项              | 命令或场景                                                                                                                                                                                                                                                        | 结果                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 定向专题测试        | `rtk npm run test -- --run src/lib/showcase.test.ts src/lib/showcase-recipe.test.ts src/lib/default-showcases.test.ts src/lib/showcase-client.test.ts src/lib/image-history.test.ts src/lib/server/showcase/showcase.test.ts src/app/api/showcases/route.test.ts` | 7 个文件、59 项通过                                                                                                                                                                                                                  |
| i18n 同步           | `rtk npm run test -- --run src/lib/i18n/messages.test.ts`                                                                                                                                                                                                         | 通过                                                                                                                                                                                                                                 |
| TypeScript          | `rtk npm run typecheck`                                                                                                                                                                                                                                           | 通过                                                                                                                                                                                                                                 |
| ESLint              | `rtk npm run lint -- --no-cache`                                                                                                                                                                                                                                  | 通过，无 warning                                                                                                                                                                                                                     |
| Web build           | `rtk npm run build`                                                                                                                                                                                                                                               | 通过；包含 `/admin/showcases`、公开/后台 API 和静态 `/topics`                                                                                                                                                                        |
| Desktop build       | `rtk npm run build:desktop`                                                                                                                                                                                                                                       | 前台协作者执行通过，`/topics` 静态导出                                                                                                                                                                                               |
| 格式与空白          | Prettier、`rtk git diff --check`                                                                                                                                                                                                                                  | 通过                                                                                                                                                                                                                                 |
| 前台浏览器          | 1440 桌面、390×844 移动端；浅色/深色；无横向溢出；案例工作台 href 正确                                                                                                                                                                                            | 通过；浏览器和 dev server 已关闭                                                                                                                                                                                                     |
| 后台浏览器          | 独立临时 SQLite + 测试 owner；1440×900 浅色、1280×800 深色、390×844 浅色/深色；创建、预览、发布、公开读取、下线、回滚                                                                                                                                             | 通过；移动端 `scrollWidth === clientWidth === 390`，控制台 0 error / 0 warning；浏览器、dev server 和临时数据已清理                                                                                                                  |
| 本轮前台增量验证    | 1280×800 深色专题目录/案例、390×844 深色双图试衣全屏引导；手改 prompt 保护、素材库子 Dialog、双图角色顺序、载入后无生成请求                                                                                                                                       | 通过；`scrollWidth === clientWidth`，console 0 error / 0 warning；浏览器与 dev server 已关闭                                                                                                                                         |
| 本轮后台增量验证    | 未登录访问 `/admin/showcases`                                                                                                                                                                                                                                     | 正确跳转 `/admin/login`；结构化编辑由 helper 单测、TypeScript、ESLint 和构建覆盖，真实管理员会话 UI 需在发布后生产验收补充                                                                                                           |
| 安全依赖审计        | `rtk npm run audit:prod`                                                                                                                                                                                                                                          | 初次发现 4 个 high；升级兼容 patch 后复验为 0 vulnerabilities                                                                                                                                                                        |
| 发布前安全与环境    | `rtk npm run secret-scan`、`rtk npm run release:env-check`                                                                                                                                                                                                        | 通过；私有 `.env.local` 未被 Git 跟踪，跟踪文件未发现疑似密钥                                                                                                                                                                        |
| 全量单元测试        | `rtk npm run test`                                                                                                                                                                                                                                                | 116 个测试文件、1074 项测试全部通过                                                                                                                                                                                                  |
| Rust 测试           | `rtk npm run rust:test`                                                                                                                                                                                                                                           | 83 项测试通过                                                                                                                                                                                                                        |
| Rust Clippy         | `rtk npm run rust:clippy`                                                                                                                                                                                                                                         | 通过，`-D warnings` 下无警告                                                                                                                                                                                                         |
| Rust 依赖审计       | `rtk npm run rust:audit`、依赖树与修复版本约束核对                                                                                                                                                                                                                | 部分通过：`quinn-proto` 已从 `0.11.14` 升至 `0.11.15` 并消除 `RUSTSEC-2026-0185`；仍命中 `RUSTSEC-2026-0194`、`RUSTSEC-2026-0195`（`quick-xml 0.39.2`），兼容修复受 Tauri 间接依赖和项目 Rust 1.77.2 MSRV 约束，作为已知发布风险跟踪 |
| 版本一致性          | Node 版本检查脚本、`rtk cargo metadata --manifest-path src-tauri/Cargo.toml --locked --format-version 1`                                                                                                                                                          | `package.json`、package-lock 根版本、Tauri、Cargo 均为 `2.15.6`，锁文件可解析                                                                                                                                                        |
| 可用性测试          | 5 名非专业用户，30/60 秒目标                                                                                                                                                                                                                                      | 未执行，无可虚报的受试者证据                                                                                                                                                                                                         |
| Tauri 真机/Android  | 真实桌面运行时和 Android 真机                                                                                                                                                                                                                                     | 未执行；CI 产物不能替代安装级验证                                                                                                                                                                                                    |
| GitHub Actions      | `rtk gh run view 30857545674`                                                                                                                                                                                                                                    | Run `completed/success`；Validate/Web、macOS、Windows、Linux、Android、Publish Release jobs 全部成功；URL：<https://github.com/xxxily/gpt-image-playground/actions/runs/30857545674> |
| Release 资产        | `rtk gh release view v2.15.6`                                                                                                                                                                                                                                    | 正式 Release（非 draft、非 prerelease），15 个资产齐全：DMG/updater、EXE/MSI、deb/rpm/AppImage、签名、`latest.json` 与 universal release APK                       |
| 129 生产部署        | `rtk ./scripts/deploy-129.sh --backend 161`                                                                                                                                                                                                                      | 161 Docker 生成约 47 MB、glibc 2.28 兼容运行包；129 `current` 指向 `releases/20260804062651-v2.15.6`，systemd `active`；旧版本保留为回滚点                   |
| 129 线上路由        | `curl` 检查 `/`、`/topics`、`/admin/showcases`、专题 API 与缓存头                                                                                                                                                                                                | `/`、`/topics` 为 200；后台入口 307 → `/admin/login`；专题 API 为 200，ETag 条件请求 304，根页和 API 缓存策略符合预期                                   |
| 129 专题 API 与缓存 | `curl -I /api/showcases`、`curl /api/showcases/old-photo-restoration`                                                                                                                                                                                             | API 为 200，返回 ETag 和 `public, max-age=60, stale-while-revalidate=300`；专题详情可读取；条件请求返回 304                                                                                                                        |
| 129 native 运行时   | 在当前 release 的 bundled Node 中创建 `better-sqlite3 :memory:` 并执行 `select 1`                                                                                                                                                                                 | 通过；部署元数据为 Node `20.20.2`、`linux-x64-glibc`、`native_mode=linux-glibc228`、builder `161-docker`                                                                                                                             |
| Outline 文档同步    | 先检索同名文档，再更新需求/报告并创建本版本操作日志                                                                                                                                                                                                               | 需求文档与报告已更新；129/161 v2.15.6 日志已创建并回读，均位于「操作记录」且为已发布状态（链接见“发布与部署”）                                             |

## 发布与部署

| 项目                 | 状态                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目标版本             | `2.15.6`（当前基线 `2.15.5`）                                                                                                                                                                 |
| 版本文件与 Changelog | 已更新为 `2.15.6` 并通过版本一致性检查；`CHANGELOG.md` 已加入 `v2.15.6` 小节                                                                                                                  |
| commit/tag/push      | 功能提交 `0e34a00`、发布提交 `32f00e1`、annotated tag `v2.15.6` 均已推送到远端                                                                                                                  |
| GitHub Actions       | Run `30857545674` 已完成且全部 7 个 jobs 成功；正式 Release 已发布                                                                                                                              |
| Release 产物         | 15 个资产已核验，包含 DMG/updater、Windows、Linux、Android APK 及签名/元数据                                                                                                                     |
| 129 部署             | 已通过独立 deployment worktree 和 161 Docker builder 部署；`current` 指向 `20260804062651-v2.15.6`，服务 `active`，线上路由/API 核验通过                                                    |
| 142 部署             | 明确跳过；按 `RELEASE_PROCESS.md` 当前暂停                                                                                                                                                    |
| Outline              | 需求：`/doc/gpt-image-playground-U4dlPsf2LV`；报告：`/doc/v2156-RIyic3iPPT`；129：`/doc/gpt-image-playground-v2156-129-HCPCI4ob6j`；161：`/doc/gpt-image-playground-v2156-161-kRmY7F7XZY` |

## Autopilot 收尾复验（2026-08-04 07:25–07:52 CST）

停止钩子发现 OMX autopilot 仍遗留在 `planning`。本轮没有重复修改已发布功能，而是将状态推进到 QA / validation，重新采集以下证据后再清理 mode 状态。

| 视角 | 新鲜验证 | 结果 |
| ---- | -------- | ---- |
| 功能 | 专题/i18n 定向测试、生产 `/topics`、专题列表/详情 API、未登录后台跳转 | 8 个测试文件、64 项通过；线上路由分别为 200/307，行为符合预期 |
| 质量 | `npm run typecheck`、`npm run lint -- --no-cache`、`npm run test`、`npm run build`、`npm run build:desktop`、`git diff --check` | 全部通过；全量为 116 个测试文件、1074 项。desktop 首次与 Web build 并行时命中 Next build lock，Web 完成后串行重跑通过 |
| Rust | `npm run rust:test`、`npm run rust:clippy` | 83 项测试通过；Clippy 在 `-D warnings` 下通过 |
| 依赖与密钥 | `npm run audit:prod`、`npm run secret-scan`、`npm run release:env-check` | npm audit 首次因 registry TLS 断开失败，重试后为 0 vulnerabilities；密钥与环境检查通过 |
| Rust 依赖 | `cargo audit --no-fetch --stale --file src-tauri/Cargo.lock` | 缓存库扫描仍为 2 个已知 `quick-xml 0.39.2` 高危项；`quinn-proto` 告警未复现。另有 21 个允许的维护/unsound warning，继续作为 Tauri 依赖链风险跟踪 |
| 发布 | `gh run view 30857545674`、`gh release view v2.15.6` | Action 7 个 jobs 全部成功；正式 Release 仍为非 draft/非 prerelease，15 个资产齐全 |
| 生产 | 129 release/systemd/Node、ETag 条件请求、bundled `better-sqlite3`、回滚点 | 当前为 `20260804062651-v2.15.6`、服务 `active`、Node `20.20.2`；ETag 返回 304；SQLite 查询返回 1；`v2.15.5` 回滚目录仍在 |
| 清理 | 161 source 环境、本地 worktree、浏览器会话、Outline 回读 | 161 `.env.production`/`.env.local` 均不存在；部署 worktree 已移除；无活跃浏览器会话；Outline 无待同步占位 |

## 需求二次审计（2026-08-04 08:30 CST）

本轮针对用户最初的“专业、全面地梳理专题能力需求”目标重新核对已发布基线 `v2.15.6`，并将实现状态与需求目标逐项对齐。审计只读取已提交基线；工作区中尚未提交的专题媒体实验代码不计入完成状态，也未被修改、暂存或纳入发布范围。

| 审计目标 | 结论 | 文档处理 | 状态 |
| -------- | ---- | -------- | ---- |
| 媒体管理与真实案例 | 仍缺结构化媒体 CRUD、上传/存储闭环、来源授权、EXIF 和引用删除保护；CSS 占位不能作为真实案例验收 | 在需求第 29 章补充 P0 上线门槛与最低证据 | 部分完成 (Partial) |
| 完整模型能力与配方字段 | 领域契约覆盖较多，但后台结构化表单和优选模型应用仍不完整，并存在隐藏字段 round-trip 风险 | 明确完整字段矩阵、尺寸模式、`preferredModelIds` 行为和 round-trip 验收 | 部分完成 (Partial) |
| 未知配方版本兼容 | 当前会拒绝未知版本，尚不能保留单案例只读展示，单个异常可能扩大为目录回退 | 明确 `canApply=false`、禁止执行未知字段和单案例故障隔离 | 部分完成 (Partial) |
| reduced motion | 卡片位移已部分降级，spinner 尚未逐项停用 | 明确静态状态、live region 与 Playwright reduced-motion 场景 | 部分完成 (Partial) |
| 专题漏斗 | 只有任务/历史归因，没有曝光、打开、准备、应用和生成结果事件链 | 明确匿名事件白名单、脱敏、去重、失败隔离和跨运行时验收 | 未完成 (Not Completed) |

本轮只修改需求和报告，不改变用户可见 UI、运行时逻辑、数据库或配置，因此浏览器、主题、移动端和 Tauri 真机验证不适用；发布质量门与线上验证将在 `v2.15.7` 发布报告中单独记录。

## v2.15.7 需求审计发布复验（2026-08-04 08:30–09:00 CST）

| 项目 | 结果 |
| ---- | ---- |
| 文档 | 需求第 29 章和本报告的二次审计已提交；文档目标完成，专题产品闭环仍按真实证据保持 `Partial` |
| 发布 | `14c0775 chore: release v2.15.7` 与 annotated tag `v2.15.7` 已推送 |
| Action | Run `30866508400` 全部 7 个 jobs 成功，正式 Release 已发布，15 个桌面/Android/updater 资产齐全 |
| 129 | `current` 指向 `20260804084729-v2.15.7`，systemd `active`；根页、专题页、后台跳转、专题 API、ETag 304 和 SQLite 自检通过 |
| Outline | 需求与持续报告已更新；发布报告 `/doc/gpt-image-playground-v2157-GE5qvV4SZJ`、129 `/doc/gpt-image-playground-v2157-129-TVg41HrYPu`、161 `/doc/gpt-image-playground-v2157-161-RcMeCPbMm5` 已发布 |
| 明确跳过 | 142 按发布规范暂停；本次无 UI 代码，不重复浏览器/主题验证；桌面与 Android 安装级冒烟未执行 |

详细命令、质量门、已知 Rust 依赖风险和资产清单见 [v2.15.7 发布与构建报告](./2026-08-04-release-2.15.7.md)。

## 托管媒体、兼容降级与匿名漏斗增量（2026-08-04）

| 请求目标 | 实际结果 | 主要证据 | 状态 |
| -------- | -------- | -------- | ---- |
| 后台管理专题媒体 | 新增 JPEG/PNG/WebP/AVIF 上传、版权/授权与双语 alt、展示图/缩略图、媒体库、专题/案例 cover/input/output 指派和永久删除 | `src/lib/server/showcase/media.ts`、`src/app/api/admin/showcase-assets/*`、`src/components/admin/showcase-admin-client.tsx` | 已完成 (Completed) |
| 发布媒体安全 | 发布前复查托管文件存在性、大小、checksum、尺寸和 Sharp 解码；只记录实际引用媒体；引用中的媒体删除返回 409 | media/admin 集成测试 | 已完成 (Completed) |
| 未来 recipe 兼容 | 当前客户端声明扩展版本，安全保留单案例只读文案/媒体并阻止执行；旧 v1 客户端过滤未来案例，不影响正常案例 | `showcase.ts`、`public.ts`、客户端/服务端测试 | 已完成 (Completed) |
| 匿名专题漏斗 | 实现曝光到生成结果事件链、白名单校验、异步批量发送、保留上限与后台 30 天汇总；不记录图片、完整 prompt、路径、凭证、IP 或跨站 ID | `showcase-analytics*.ts`、事件/指标 API、后台指标卡 | 部分完成 (Partial)：尚缺生产口径复核和多实例集中存储 |
| reduced motion | 专题目录、引导和后台加载 spinner 均补充 `motion-reduce:animate-none`，状态文字继续通过 live region / status 表达 | 前端组件、后续浏览器验证 | 已完成 (Completed) |
| 默认真实案例 | 内置 6 专题、24 案例仍使用明确标识的 CSS 演示占位 | `src/lib/default-showcases.ts` | 部分完成 (Partial) |

### 本轮问题与解决

| 问题 | 解决办法 | 剩余风险 |
| ---- | -------- | -------- |
| 草稿保存、托管媒体复查与审计原先分散提交，媒体删除也可能在引用复查后遇到竞态 | 专题 create/update 将托管媒体复查、草稿写入和审计放入同一 `IMMEDIATE` 事务；媒体删除将引用复查、文件隔离、DB 删除和审计放入同一写事务，失败时恢复隔离文件 | 跨进程文件系统故障仍需依赖隔离文件恢复；多实例部署仍应使用共享存储或对象存储 |
| 发布只检查 DB 行，不检查物理文件 | 发布前读取展示图和缩略图，核对 byte size、checksum、WebP 格式、尺寸和解码 | 外部 HTTPS 媒体尚未主动探测可达性、重定向安全和 MIME |
| schema v1 无法表达未来案例只读字段 | 当前客户端发送 `X-Showcase-Client-Version: 2`；未声明的旧客户端获取过滤后的严格 v1 响应 | 正式 catalog v2 仍应在未来单独版本化，而不是长期依赖扩展 header |
| 托管目录草稿中含未引用媒体会被永久锁定 | 发布快照只保留专题/案例实际引用的资产，并只写这些 publication refs | 本地磁盘是唯一存储后端；多实例需共享持久卷 |
| 自定义尺寸拆成宽、高两个受控输入时，首次只填写一边会被归一化逻辑清空 | 后台改成单个“宽×高”文本输入，编辑阶段保留半成品，保存时再解析为 `customWidth` / `customHeight` | 仍需在输入提示中明确合法范围，非法完整值会在保存校验时拒绝 |
| 媒体删除确认嵌套在媒体库 Dialog 内，焦点与移动端历史行为不稳定 | 先关闭媒体库再打开确认 Dialog；取消、删除成功或引用保护失败后均返回媒体库 | 无已知剩余交互风险；继续依赖项目 Dialog 回归测试 |

### 本轮验证

| 检查项 | 命令或场景 | 结果 |
| ------ | ---------- | ---- |
| 定向增量测试 | `rtk npm run test -- --run 'src/app/api/showcase-media/[id]/route.test.ts' src/app/api/showcases/route.test.ts src/lib/server/showcase/analytics.test.ts src/lib/server/showcase/media.test.ts src/lib/server/showcase/public.test.ts src/lib/showcase-admin-draft.test.ts src/lib/showcase-analytics.test.ts src/lib/showcase-client.test.ts src/lib/showcase-recipe.test.ts src/lib/showcase.test.ts` | 10 个文件、53 项通过 |
| TypeScript / ESLint | `rtk npm run typecheck`；`rtk npm run lint -- --no-cache` | 通过 |
| 完整前端质量门 | `rtk npm ci`；`rtk npm run secret-scan`；`rtk npm run release:env-check`；`rtk npm run audit:prod`；`rtk npm run typecheck`；`rtk npm run lint`；`rtk npm run test`；`rtk npm run build`；`rtk npm run build:desktop` | 全部通过；全量 121 个测试文件、1093 项通过；`npm audit` 第三次在 registry TLS 恢复后为 0 vulnerabilities |
| Rust 质量门 | `rtk npm run rust:test`；`rtk npm run rust:clippy`；`rtk cargo metadata --manifest-path src-tauri/Cargo.toml --locked --format-version 1` | 83 项测试通过；Clippy 通过；锁文件 metadata 可解析 |
| Rust 依赖审计 | 在线 `cargo audit`；`rtk cargo audit --no-fetch --stale --file src-tauri/Cargo.lock` | 在线 advisory DB 更新因 GitHub 网络失败；离线扫描完成但仍因 `quick-xml 0.39.2` 的 `RUSTSEC-2026-0194`、`RUSTSEC-2026-0195` 非零退出，另有 21 个允许的维护/unsound warning |
| 前台浏览器 | 1440×900 浅色专题中心、老照片专题/案例、Guide；1280×800 深色；390×844 浅色/深色；reduced-motion | 6 个专题完整，无横向溢出，console 0 error / 0 warning；Guide 不自动提交，提示词、输入槽和兼容性可见；reduced-motion 下卡片 transform 为 `none` 且无持续 animation |
| 后台浏览器 | 独立临时 SQLite + 测试 owner；专题指标、结构化字段、单字段自定义尺寸、媒体上传/指派/删除保护；390×844 深色 | 指标卡加载；`1200` 半成品不被清空，`1200×1600` 和推荐模型保存成功；被草稿引用媒体删除返回 409；确认仅 1 个顶层 Dialog；取消/成功删除后返回媒体库；无横向溢出，刷新后 console 0 error / 0 warning |
| 未来 recipe 浏览器 | 拦截 `/api/showcases`，把一个真实案例改为 recipe v2 并加入未知 `workflowScript` | 卡片显示“需要更新客户端”且无“跟着创作”；详情显示“输入要求未知”和只读 prompt；deep-link 被消费后不打开 Guide、不写入 prompt、不执行未知字段 |
| 清理 | 关闭 `v2158` / `v2158future` 浏览器会话并停止 3108 临时服务 | 已完成；临时 DB 与媒体目录位于 `/tmp`，不纳入仓库 |

## v2.15.8 发布与生产复验（2026-08-04 11:14–11:45 CST）

| 项目 | 结果 |
| ---- | ---- |
| 提交与 tag | `ef1fa43 feat(showcase): add managed media and funnel insights`；`23f9cba chore: release v2.15.8`；annotated tag `v2.15.8`，`master` 与 tag 均已推送 |
| Action | Run `30874164460` 完成且为 `success`；发布元数据/Web、Release notes、Android、Windows、Linux、macOS、Publish Release 共 7 个 jobs 全部成功 |
| Release | 正式 Release 非 draft、非 prerelease，共 15 个资产；包含 DMG/app updater、EXE/MSI、deb/rpm/AppImage、相应签名、release-signed Android APK 和 `latest.json` |
| 129 | `current` 指向 `20260804112334-v2.15.8`，systemd `active`，Node `20.20.2`，构建后端 `161-docker`，native `linux-glibc228`；运行包约 47 MB，目录约 147 MB |
| HTTP | `/`、`/topics`、`/api/showcases` 返回 200；`/admin`、`/admin/showcases` 返回 307 并跳转 `/admin/login`；目录为 6 个专题、24 个案例、56 个媒体，ETag 条件请求返回 304 |
| SQLite | 按 `src/lib/server/db.ts` 的真实路径规则只读打开生产库；`showcase_assets`、`showcase_publication_assets`、`showcase_events` 均存在且当前 0 行，`PRAGMA quick_check = ok` |
| 安全与回滚 | 两项认证 secret 只检查存在性且均保留；最新环境备份 `.env.20260804113001`；上一回滚目录 `20260804084729-v2.15.7` |
| 161 | artifact 48,698,129 bytes，SHA-256 `7d6a60c0ea2dd7a49ddbd5ae7b94254ff47a548f336bc5465126b2f78a2ab616`；source 中无 `.env.production` / `.env.local` |
| 明确跳过 | 142 按 `RELEASE_PROCESS.md` 暂停；桌面包与 Android APK 未执行安装级真机验收 |

详细发布证据见 [v2.15.8 发布与构建报告](./2026-08-04-release-2.15.8.md)。Outline：需求 `/doc/gpt-image-playground-U4dlPsf2LV`，持续报告 `/doc/5lit6aky5qgi5l6l5lio5byv5a85byp5yib5l2c6io95yqb5a6e546w5lio5yr5bid5oql5zgk-RIyic3iPPT`，发布报告 `/doc/gpt-image-playground-v2158-hDVXX80dEC`，129 `/doc/gpt-image-playground-v2158-129-oxWHSApp9m`，161 `/doc/gpt-image-playground-v2158-161-2oR6uARHmD`。

## 后续建议

- 补齐 24 个经过真实流程生成、授权和人工核验的输入/输出案例，记录模型、配方版本、日期与候选次数。
- 补齐 FAQ、相关专题、用户补充要求和输入 MIME/数量的结构化编辑；推荐模型排序已经生效并有单测覆盖。
- 为外部 HTTPS 媒体增加受限探测、DNS/重定向复检、MIME/体积/解码校验；为多实例提供共享存储或 S3 后端。
- 复核匿名漏斗生产口径，并完成至少 5 名非专业用户的定性可用性测试。
- 后续随 Tauri / `plist` / Wayland 依赖链兼容升级处理 `quick-xml 0.39.2` 的两项 RustSec 风险；升级前需先确认 Rust MSRV 和全平台构建兼容性。
- 将本次 detached worktree 中验证有效的本地 Node headers 构建方式正式合入 `scripts/build-129-runtime-docker.sh`，并为 Debian archive 的 `apt-get update` 增加有限重试，降低 161 构建链路对瞬时网络的敏感度。
- 对 macOS、Windows、Linux 和 Android Release 包补做安装级冒烟；本次仅验证了 CI 构建和资产完整性，未在真机安装。
