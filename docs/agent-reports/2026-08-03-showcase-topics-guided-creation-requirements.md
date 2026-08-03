# 专题案例与引导式创作能力实现与发布报告

| 字段 | 内容 |
| --- | --- |
| 日期 | 2026-08-03 |
| 状态 | 部分完成 (Partial)：功能、版本同步与本地验收已完成，等待 `v2.15.5` tag、Action 产物和 129 部署闭环。 |
| 相关请求 | 梳理并实现“老照片修复、试衣间、创意风格化等专题 + 案例展示 + 点击复现 + 后台管理”，完成后发布新补丁版本、触发 Action 产物并部署 129。 |
| 相关文档 | [专题案例与引导式创作能力需求文档](../requirements/SHOWCASE_TOPICS_AND_GUIDED_CREATION_REQUIREMENTS.md)、[展示内容与后台管理使用手册](../展示内容与后台管理使用手册.md)、[发布流程](../../RELEASE_PROCESS.md) |
| 改动范围 | showcase 领域契约、默认目录、Web/Tauri 目录读取、专题前台、工作台引导、来源归因、后台 API/UI、SQLite schema、i18n、需求与用户文档。 |
| 提交状态 | 功能与版本提交 `3502760 feat(showcase): add topic cases and guided creation` 已创建；发布状态回写提交待最终闭环。工作区保留用户既有无关改动。 |

## 范围核对

| 请求目标 | 实际结果 | 证据 | 状态 |
| --- | --- | --- | --- |
| 专业、全面地细化需求 | 完成产品定位、术语、前后台流程、数据、接口、安全、跨端、验收和阶段规划 | 需求文档 | 已完成 (Completed) |
| 默认实用专题 | 内置 6 个双语专题、24 个案例，覆盖老照片修复、虚拟试衣、创意风格化等 | `src/lib/default-showcases.ts` | 已完成 (Completed) |
| 首页和专题中心 | 工作台下方专题区、全局功能菜单、静态 `/topics` 页面壳、专题/案例详情和深链 | `src/components/showcase/*`、`src/app/topics/page.tsx` | 已完成 (Completed) |
| 跟着案例复现 | 按角色选择图片、源图替换/追加、个性化要求、提示词 replace/append/keep、模型能力检查、模型设置入口和安全参数载入；不自动生成 | `showcase-guide-dialog.tsx`、工作台接入 | 已完成 (Completed) |
| 来源归因 | 显示可返回/可单独清除的来源 Chip；普通任务、托管任务恢复和历史均可保留 `topicId/caseId/recipeVersion/catalogRevision` | `showcase-attribution-chip.tsx`、`useTaskManager.ts`、`managed-task-records.ts`、`image-history.ts` | 已完成 (Completed) |
| 公开目录与跨端回退 | Web 同源 API；Tauri 可信远端；远端 → endpoint 缓存 → 内置目录；ETag/304 | `showcase-client.ts`、`desktop-config.ts`、公开 API | 已完成 (Completed) |
| 后台管理 | `/admin/showcases` 支持列表筛选、整目录草稿 JSON 编辑、预览、发布、下线、归档、版本回滚；viewer 只读 | 后台 UI/API、SQLite schema | 已完成 (Completed)：结构化表单与服务端媒体上传在需求中已列为 P0 后续增强/运维选项 |
| 权限、审计与发布安全 | owner/admin 可写、viewer 只读；写操作审计；发布快照与线上指针原子切换 | `src/lib/server/showcase/*` | 已完成 (Completed) |
| i18n、主题与响应式 | 新增固定文案全部进入中英文资源；前台和后台均验证浅色/深色、桌面/移动，无横向溢出 | `messages.ts`、Playwright 验证 | 已完成 (Completed) |
| 发布新版本和构建产物 | 版本已同步为 `2.15.5` 并创建提交，尚未完成 Tag、Action 产物与 129 部署 | 本报告“发布与部署” | 部分完成 (Partial) |

## 实际完成范围

- 领域层使用严格白名单归一化，拒绝未知字段、未来版本、凭证、脚本、私网/本地路径、base64 和自动提交字段。
- 内置媒体明确为 CSS 演示占位素材，不冒充真实 AI 生成案例。
- 公开 `GET /api/showcases`、`GET /api/showcases/[slug]` 支持 ETag、受控 CORS、发布快照、损坏快照隔离和内置回退。
- 后台 SQLite 增加 `showcase_topics` 草稿表和 `showcase_publications` 不可变快照表。
- 工作台引导只载入图片、提示词和允许参数，不修改 API Key、Base URL、代理、同步或分享配置。
- 当前模型不兼容时显示用户可理解原因，并只优先列出当前已配置凭证的兼容模型。
- 当前工作台已有源图时可明确选择替换或追加；模型不兼容时可直接打开现有模型设置。
- 托管任务客户端记录与恢复路径会归一化并保留非敏感专题归因，旧记录或非法字段仍安全降级。
- 后台所有破坏性操作使用项目 Dialog，不使用 `window.alert`、`prompt` 或 `confirm`。
- 生产依赖安全门将 `better-auth`、Next.js、PostCSS 和 Sharp 更新到已修复的兼容 patch 版本，`npm audit --omit=dev` 回到 0 vulnerabilities。

## 主要文件与模块

| 领域 | 文件/模块 |
| --- | --- |
| 需求与报告 | `docs/requirements/SHOWCASE_TOPICS_AND_GUIDED_CREATION_REQUIREMENTS.md`、本报告 |
| 领域与默认内容 | `src/lib/showcase.ts`、`src/lib/showcase-recipe.ts`、`src/lib/default-showcases.ts` |
| 客户端目录 | `src/lib/showcase-client.ts`、`src/lib/desktop-config.ts` |
| 前台与引导 | `src/app/topics/page.tsx`、`src/components/showcase/*` |
| 工作台 | `src/features/workbench/page/workbench-page.tsx`、`workbench-shell.tsx`、`editing-form.tsx` |
| 后台 | `src/app/admin/(shell)/showcases/page.tsx`、`src/components/admin/showcase-admin-client.tsx` |
| 服务端 | `src/app/api/showcases/*`、`src/app/api/admin/showcases/*`、`src/lib/server/showcase/*`、`src/lib/server/schema.ts`、`src/lib/server/db.ts` |
| 归因与历史 | `src/hooks/useTaskManager.ts`、`src/lib/taskExecutor.ts`、`src/lib/image-history.ts`、`src/types/history.ts` |

## 问题与解决

| 问题 | 解决办法 | 剩余风险 |
| --- | --- | --- |
| Promo 和专题都有“展示内容”特征 | Promo 继续负责投放入口，showcase 独立负责专题、案例和执行配方 | 后续可增加 Promo 引用专题的结构化选择器 |
| 桌面静态导出不能依赖动态 SSR slug | 使用静态 `/topics` 壳和 query 深链，目录从可信远端读取并带缓存/内置回退 | Web SEO 动态落地页仍是后续增强 |
| 配方可能注入危险配置 | 客户端和服务端复用同一严格 schema，只允许工作台安全字段 | 新字段必须先升级 schema 和兼容策略 |
| 当前工作台已有 prompt/图片 | prompt 提供替换、追加、保留选择；源图提供替换、追加、取消后返回调整 | 追加后仍受当前模型参考图数量和文件限制校验 |
| 后台结构化表单工作量较大 | P0 交付经过同一 schema 校验的完整 JSON 编辑器、前台组件预览和版本操作 | 普通运营人员仍需要理解目录 JSON，后续应结构化 |
| 多协作者外部模型通道返回 503 | 保留已完成协作者结果，其余工作由主代理继续实现和验证 | 不影响代码运行，但少了一轮独立 UI/需求审阅 |

## 验证

| 检查项 | 命令或场景 | 结果 |
| --- | --- | --- |
| 定向专题测试 | `rtk npm run test -- --run src/lib/showcase.test.ts src/lib/showcase-recipe.test.ts src/lib/default-showcases.test.ts src/lib/showcase-client.test.ts src/lib/image-history.test.ts src/lib/server/showcase/showcase.test.ts src/app/api/showcases/route.test.ts` | 7 个文件、59 项通过 |
| i18n 同步 | `rtk npm run test -- --run src/lib/i18n/messages.test.ts` | 通过 |
| TypeScript | `rtk npm run typecheck` | 通过 |
| ESLint | `rtk npm run lint -- --no-cache` | 通过，无 warning |
| Web build | `rtk npm run build` | 通过；包含 `/admin/showcases`、公开/后台 API 和静态 `/topics` |
| Desktop build | `rtk npm run build:desktop` | 前台协作者执行通过，`/topics` 静态导出 |
| 格式与空白 | Prettier、`rtk git diff --check` | 通过 |
| 前台浏览器 | 1440 桌面、390×844 移动端；浅色/深色；无横向溢出；案例工作台 href 正确 | 通过；浏览器和 dev server 已关闭 |
| 后台浏览器 | 独立临时 SQLite + 测试 owner；1440×900 浅色、1280×800 深色、390×844 浅色/深色；创建、预览、发布、公开读取、下线、回滚 | 通过；移动端 `scrollWidth === clientWidth === 390`，控制台 0 error / 0 warning；浏览器、dev server 和临时数据已清理 |
| 安全依赖审计 | `rtk npm run audit:prod` | 初次发现 4 个 high；升级兼容 patch 后复验为 0 vulnerabilities |
| 发布前安全与环境 | `rtk npm run secret-scan`、`rtk npm run release:env-check` | 通过；私有 `.env.local` 未被 Git 跟踪，跟踪文件未发现疑似密钥 |
| 全量单元测试 | `rtk npm run test` | 115 个测试文件、1068 项测试全部通过 |
| Rust 测试 | `rtk npm run rust:test` | 83 项测试通过 |
| Rust Clippy | `rtk npm run rust:clippy` | 通过，`-D warnings` 下无警告 |
| Rust 依赖审计 | `rtk npm run rust:audit`、`rtk cargo audit --file src-tauri/Cargo.lock --json` | 未通过：锁文件中的 Tauri/跨平台间接依赖命中 `RUSTSEC-2026-0194`、`RUSTSEC-2026-0195`（`quick-xml 0.39.2`）和 `RUSTSEC-2026-0185`（`quinn-proto 0.11.14`）；本次未通过强制跨代覆盖改写 Tauri 依赖图，作为发布已知风险跟踪 |
| 版本一致性 | Node 版本检查脚本、`rtk cargo metadata --manifest-path src-tauri/Cargo.toml --locked --format-version 1` | `package.json`、package-lock 根版本、Tauri、Cargo 均为 `2.15.5`，锁文件可解析 |
| Tauri 真机/Android | 真实桌面运行时和 Android 真机 | 未执行；由 release Action 构建产物，并在后续版本验证安装 |

## 发布与部署

| 项目 | 状态 |
| --- | --- |
| 目标版本 | `2.15.5`（当前基线 `2.15.4`） |
| 版本文件与 Changelog | 已更新 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`CHANGELOG.md` |
| commit/tag/push | 已提交 `3502760`；tag 与 push 待执行 |
| GitHub Actions | 尚未触发；推送 `v2.15.5` 后检查 `.github/workflows/build-release.yml` |
| Release 产物 | 尚未检查 macOS/Windows/Linux、updater 文件和 Android APK |
| 129 部署 | 尚未执行；应从已验证 release ref 的独立 worktree 运行 `scripts/deploy-129.sh` |
| 142 部署 | 明确跳过；按 `RELEASE_PROCESS.md` 当前暂停 |

## 后续建议

- 按 `RELEASE_PROCESS.md` 完成 secret、audit、Web/Desktop/Rust 全量校验，再只暂存本任务文件。
- 推送 tag 后等待 Action 全部成功，核对桌面包、`latest.json`/签名文件和 Android APK。
- 129 部署后验证根页、`/admin`、`/admin/showcases` 以及根页 `Cache-Control: no-cache, no-store, must-revalidate`。
- 后续将后台 JSON 编辑器升级为结构化专题/案例/媒体表单，并增加媒体上传、版权归因、指标和真实案例回归审核。
