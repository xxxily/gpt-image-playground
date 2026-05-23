# 依赖漏洞修复与依赖安全全面排查需求文档

## 1. 背景

本文档记录 `gpt-image-playground` 在 `v2.12.2` 发布后发现的 npm 依赖漏洞，以及后续依赖安全治理需求。

本项目同时覆盖 Web、Tauri 桌面、Tauri Android、两台自部署服务器和 GitHub Release 构建链路。依赖升级不能只看 Web 本地构建通过，还必须验证静态桌面导出、Tauri 打包、Android 初始化/构建、生产 Docker 镜像、129 Linux x64/glibc 运行包，以及服务器反向代理行为。

## 2. 当前审计基线

审计时间：2026-05-23  
代码基线：`v2.12.2` / `package.json` 版本 `2.12.2`  
主要命令：

```bash
npm audit --omit=dev --json
npm audit --json
npm audit fix --dry-run --json
npm ls next postcss brace-expansion --all
npm audit signatures
npm outdated --json
```

当前结果汇总：

| 范围 | 高危 | 中危 | 低危 | 总计 | 说明 |
| --- | ---: | ---: | ---: | ---: | --- |
| 生产依赖 `npm audit --omit=dev` | 1 | 1 | 0 | 2 | 影响生产运行路径 |
| 全量依赖 `npm audit` | 1 | 2 | 0 | 3 | 比生产路径多一个开发依赖漏洞 |

`npm audit signatures` 结果：633 个包有 registry signature，87 个包有 attestation。该命令可用但耗时约 65 秒，后续可考虑纳入周期性安全任务，而不是每次普通 PR 必跑。

当前 `cargo audit` 未安装：

```text
error: no such command: `audit`
```

Rust/Tauri 依赖安全扫描需要补齐工具链。

## 3. 当前漏洞清单

### 3.1 `next@16.2.4` 高危，直接生产依赖

当前版本：

```text
package.json: next ^16.2.4
package-lock.json: node_modules/next 16.2.4
```

修复目标：升级到 `next@16.2.6` 或更高的同主线安全版本。当前 npm `latest` 为 `16.2.6`。

`npm audit` 把以下 GitHub Advisory 聚合到 `next`：

| Advisory | 严重级别 | CVSS | 影响范围 | 修复版本 | 风险类型 |
| --- | --- | ---: | --- | --- | --- |
| [GHSA-8h8q-6873-q5fj](https://github.com/advisories/GHSA-8h8q-6873-q5fj) | high | 7.5 | `>=16.0.0 <16.2.5` | `16.2.5` | Server Components DoS |
| [GHSA-26hh-7cqf-hhc6](https://github.com/advisories/GHSA-26hh-7cqf-hhc6) | high | 7.5 | `>=16.0.0 <16.2.6` | `16.2.6` | App Router segment-prefetch middleware/proxy bypass follow-up |
| [GHSA-3g8h-86w9-wvmq](https://github.com/advisories/GHSA-3g8h-86w9-wvmq) | low | 3.7 | `>=16.0.0 <16.2.5` | `16.2.5` | Middleware/proxy redirect cache poisoning |
| [GHSA-ffhc-5mcf-pf4q](https://github.com/advisories/GHSA-ffhc-5mcf-pf4q) | moderate | 4.7 | `>=16.0.0 <16.2.5` | `16.2.5` | App Router CSP nonce XSS |
| [GHSA-vfv6-92ff-j949](https://github.com/advisories/GHSA-vfv6-92ff-j949) | low | 3.7 | `>=16.0.0 <16.2.5` | `16.2.5` | RSC cache-busting collision cache poisoning |
| [GHSA-gx5p-jg67-6x7h](https://github.com/advisories/GHSA-gx5p-jg67-6x7h) | moderate | 6.1 | `>=16.0.0 <16.2.5` | `16.2.5` | `beforeInteractive` untrusted input XSS |
| [GHSA-mg66-mrh9-m8jx](https://github.com/advisories/GHSA-mg66-mrh9-m8jx) | high | 7.5 | `>=16.0.0 <16.2.5` | `16.2.5` | Cache Components connection exhaustion DoS |
| [GHSA-h64f-5h5j-jqjh](https://github.com/advisories/GHSA-h64f-5h5j-jqjh) | moderate | 5.9 | `>=16.0.0 <16.2.5` | `16.2.5` | Image Optimization API DoS |
| [GHSA-c4j6-fc7j-m34r](https://github.com/advisories/GHSA-c4j6-fc7j-m34r) | high | 8.6 | `>=16.0.0 <16.2.5` | `16.2.5` | WebSocket upgrade SSRF |
| [GHSA-492v-c6pp-mqqv](https://github.com/advisories/GHSA-492v-c6pp-mqqv) | high | 8.1 | `>=16.0.0 <16.2.5` | `16.2.5` | Dynamic route parameter middleware/proxy bypass |
| [GHSA-wfc6-r584-vfw7](https://github.com/advisories/GHSA-wfc6-r584-vfw7) | moderate | 5.4 | `>=16.0.0 <16.2.5` | `16.2.5` | RSC response cache poisoning |
| [GHSA-267c-6grr-h53f](https://github.com/advisories/GHSA-267c-6grr-h53f) | high | 7.5 | `>=16.0.0 <16.2.5` | `16.2.5` | App Router segment-prefetch middleware/proxy bypass |
| [GHSA-36qx-fr4f-26g5](https://github.com/advisories/GHSA-36qx-fr4f-26g5) | high | 7.5 | `>=16.0.0 <16.2.5` | `16.2.5` | Pages Router i18n middleware/proxy bypass |

项目相关性初判：

- 当前仓库未发现 `middleware.ts`、`middleware.js`、`proxy.ts` 或 `proxy.js`。
- `next.config.ts` 当前只配置 `output`、`turbopack.root` 和 `images.unoptimized`。
- 即便没有显式 middleware，`next` 是生产直接依赖，且漏洞还覆盖 RSC、Image Optimization、WebSocket upgrade、缓存投毒和 XSS 等路径，必须升级。
- 两台生产服务器都是自部署 Next Node server，WebSocket upgrade SSRF 类风险需要按生产风险处理。

### 3.2 `postcss` 中危，生产路径间接依赖

当前版本：

```text
node_modules/postcss 8.5.3
node_modules/next/node_modules/postcss 8.4.31
```

漏洞：

| Advisory | 严重级别 | CVSS | 影响范围 | 修复版本 | 风险类型 |
| --- | --- | ---: | --- | --- | --- |
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | moderate | 6.1 | `<8.5.10` | `8.5.10+` | CSS stringify 未转义 `</style>` 导致 XSS |

依赖路径：

```text
@tailwindcss/postcss@4.1.4 -> postcss@8.5.3
@tailwindcss/vite@4.1.4 -> vite@6.4.2 -> postcss@8.5.3
next@16.2.4 -> postcss@8.4.31
```

修复目标：

- 将可控根级 `postcss` 解析到 `8.5.15` 或更新安全版本。
- 通过升级 `next@16.2.6` 修复 Next 内置的 `postcss` 副本。
- 如 Tailwind/Vite 链路仍解析到旧版，需要补充 `overrides` 或升级 `@tailwindcss/postcss`、`@tailwindcss/vite`、`tailwindcss` 到兼容版本。

### 3.3 `brace-expansion@1.1.11` 中危，仅开发依赖路径

当前版本：

```text
node_modules/brace-expansion 1.1.11
```

漏洞：

| Advisory | 严重级别 | CVSS | 影响范围 | 修复版本 | 风险类型 |
| --- | --- | ---: | --- | --- | --- |
| [GHSA-v6h2-p8h4-qcjw](https://github.com/advisories/GHSA-v6h2-p8h4-qcjw) | low | 3.1 | `>=1.0.0 <=1.1.11` | `1.1.12+` | ReDoS |
| [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | moderate | 6.5 | `<1.1.13` | `1.1.13+` | zero-step sequence hang / memory exhaustion |

依赖路径：

```text
@eslint/eslintrc@3.3.5 -> minimatch@3.1.5 -> brace-expansion@1.1.11
```

修复目标：升级到 `brace-expansion@1.1.14` 或更新安全版本。因为这是开发依赖路径，可通过 lockfile 刷新、npm overrides 或上游 `@eslint/eslintrc` 版本更新处理。

## 4. `npm audit fix --dry-run` 建议

当前 dry-run 显示会变更以下包：

| 包 | 当前 | 建议 |
| --- | --- | --- |
| `next` | `16.2.4` | `16.2.6` |
| `@next/env` | `16.2.4` | `16.2.6` |
| `@next/swc-darwin-arm64` | `16.2.4` | `16.2.6` |
| `postcss` | `8.5.3` | `8.5.15` |
| `brace-expansion` | `1.1.11` | `1.1.14` |
| `nanoid` | `3.3.11` | `3.3.12` |

要求：

- 不允许直接无脑执行并合并 `npm audit fix`，必须先在独立分支评估 diff。
- 优先使用显式升级命令和必要的 `overrides`，确保 `package.json` 能表达安全意图，而不是只依赖偶然的 lockfile 解析结果。
- 如果 `npm audit fix` 改动超出上述范围，需要重新评估风险。

## 5. 修复需求

### 5.1 紧急修复：Next.js 与 PostCSS

目标：

- 清除生产路径的 `next` 高危和 `postcss` 中危漏洞。
- 保持 Web、桌面静态导出、Tauri、Android 和服务器部署行为不退化。

建议实施：

```bash
npm install next@16.2.6
npm install -D @tailwindcss/postcss@latest @tailwindcss/vite@latest tailwindcss@latest
```

如升级 Tailwind 相关包导致样式或构建风险过大，可先用更小修复面：

```json
{
  "overrides": {
    "postcss": "^8.5.15",
    "brace-expansion": "^1.1.14"
  }
}
```

验收标准：

- `npm audit --omit=dev` 返回 0 个漏洞。
- `npm audit` 返回 0 个 high / critical；如仍有 dev-only moderate，必须写明原因和修复计划。
- `npm ls next postcss brace-expansion --all` 不再出现受影响版本。
- `package-lock.json` 中不再包含 `next@16.2.4`、`postcss <8.5.10`、`brace-expansion <=1.1.12`。

### 5.2 开发依赖修复：brace-expansion

目标：

- 清除全量依赖审计里的 `brace-expansion` 中危漏洞。

建议实施：

- 优先尝试刷新 lockfile，让 `minimatch@3` 解析到安全的 `brace-expansion@1.1.14`。
- 如果 lockfile 刷新不稳定，使用 npm `overrides` 固定 `brace-expansion@^1.1.14`。
- 评估是否同步升级 `@eslint/eslintrc` 或 `eslint-config-next`，但不要一次性跨大版本升级 ESLint 生态，避免 lint 规则行为大面积变化。

验收标准：

- `npm audit` 全量无漏洞。
- `npm run lint` 输出稳定，不出现规则升级导致的新报错。

### 5.3 Next.js 安全相关专项回归

必须覆盖：

- App Router 动态路由：`/s/[code]`、`/api/image/[filename]`、`/api/admin/*/[id]` 等。
- 管理后台鉴权跳转：`/admin`、`/admin/promo`、`/admin/settings`、`/admin/users`、`/admin/short-links`。
- 公开分享与短链：短链跳转、加密分享、临时 API Key 分享、禁用/过期分享 Key 的展示内容不可见。
- 图片接口：`/api/image-proxy`、`/api/history-assets`、`/api/images`、`/api/image-to-text`、`/api/storage/s3/*`。
- 视频接口：`/api/video/create`、`/api/video/poll`、`/api/video/download`、`/api/video/cancel`。
- Next Image 使用点：历史预览、缩放查看器、编辑表单源图预览、展示位图片。

必须验证：

- 未登录访问管理页面仍然只能跳转登录或初始化页。
- 公开 API 不因 Next 升级改变缓存头、重定向、CORS 或错误响应结构。
- 根页面 `Cache-Control` 仍为 `no-cache, no-store, must-revalidate`。
- `/_next/static` 哈希资源缓存策略不被误改。
- 自部署 Node server 不直接暴露给公网，Caddy 仍是唯一入口。
- 如果不需要 WebSocket upgrade，评估 Caddy 是否应显式拒绝非预期 upgrade 请求。

### 5.4 多运行时构建验证

升级后至少执行：

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run build:desktop
npm test
npm audit --omit=dev
npm audit
```

Tauri/Rust：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Android：

```bash
npm run sync:android-icons
npm run android:init -- --ci
npm run build:android
```

生产部署脚本干跑或实际验证：

```bash
./scripts/deploy.sh --build
./scripts/deploy-129.sh --build
```

如要实际部署，仍按 `RELEASE_PROCESS.md` 串行执行两台服务器部署，避免 `.next` 构建锁冲突。

### 5.5 生产发布与回滚要求

修复发版必须：

- 在 `CHANGELOG.md` 记录依赖安全修复和升级注意事项。
- 同步更新 `package.json`、`package-lock.json`、Tauri/Cargo 版本文件。
- 发布后确认 GitHub Release workflow 完整成功，并确认 macOS、Linux、Windows、Android APK 和 `latest.json` 资产存在。
- 部署 142 与 129 后执行 `RELEASE_PROCESS.md` 的 URL 和缓存头验证。

回滚点：

- Git tag：回滚到修复前最近稳定 tag。
- 142：Docker 镜像/源码目录可用 `docker compose` 回滚上一版。
- 129：切换 `/root/work/gpt-image-playground/current` 到上一版 `releases/` 目录并重启 systemd。

## 6. 依赖安全治理需求

### 6.1 CI 安全门禁

新增或调整 GitHub Actions：

- PR 必跑 `npm audit --omit=dev --audit-level=high`。
- 主分支每日或每周定时跑全量 `npm audit --audit-level=moderate`。
- Release workflow 在版本校验后增加 `npm audit --omit=dev --audit-level=high`，避免带高危生产依赖发版。
- 对 `npm audit` 结果生成 JSON artifact，便于回溯。
- 对已知例外建立白名单文件，必须包含 advisory、影响范围、接受原因、过期日期和责任人。

建议策略：

- production high/critical：阻断 PR 和 release。
- production moderate：允许短期合并但必须有 issue 和截止日期。
- dev high/critical：阻断涉及构建、测试、发布链路的 PR。
- dev moderate：进入周期性治理，不阻断紧急业务修复。

### 6.2 Dependabot / Renovate

需要引入自动依赖更新策略：

- npm 生态每周检查一次，security update 立即提 PR。
- GitHub Actions 版本每周检查一次。
- Rust/Cargo 每周检查一次。
- 对 Next、React、Tauri、Better Auth、Drizzle、OpenAI SDK、AWS SDK、Dexie、Tailwind 建立分组策略。
- patch/minor 自动开 PR，major 只开追踪 PR，不自动合并。

PR 必须自动附带：

- 依赖变更摘要。
- 漏洞修复 advisory。
- `npm audit --omit=dev` 结果。
- 需要人工验证的运行时清单。

### 6.3 锁文件与 overrides 策略

要求：

- `package-lock.json` 必须提交，且 CI 使用 `npm ci`。
- 禁止手改 lockfile 中的版本。
- 使用 `overrides` 时必须在需求或 PR 说明中写明原因、受影响路径、移除条件。
- 每月检查一次 overrides 是否还能移除。
- 发布脚本和 Dockerfile 必须继续使用锁文件安装，避免生产构建解析到未审计依赖。

### 6.4 多生态扫描

需要补齐：

- npm：`npm audit`、`npm audit signatures`。
- Rust：安装并使用 `cargo-audit` 或同等工具扫描 `src-tauri/Cargo.lock`。
- GitHub Actions：扫描 action 版本和权限，避免宽权限 `GITHUB_TOKEN`。
- Docker：扫描 `node:20-alpine` 基础镜像、运行镜像系统包和 native 依赖。
- Secrets：检查 `.env.production`、部署日志、GitHub Actions 日志、Release notes 不泄露密钥。
- License：对生产依赖生成 license report，识别 GPL/AGPL 等高风险许可证。
- SBOM：为 Release 产物生成 CycloneDX 或 SPDX SBOM，并随 Release 或 workflow artifact 保存。

### 6.5 供应链完整性

要求：

- 保持 `npm audit signatures` 可运行，并记录 registry signature / attestation 覆盖率。
- 评估是否启用 npm provenance 或 GitHub artifact attestation。
- Release workflow 产物需要保留校验摘要。
- Android、Tauri updater、桌面安装包签名状态需要在 Release 检查中明确展示。
- 生产部署包应继续最小化，142 只上传白名单源码，129 运行包继续排除 `.env.production`、文档、脚本和 Tauri 非运行时目录。

### 6.6 依赖盘点与分级

需要建立依赖分级清单：

| 等级 | 示例 | 要求 |
| --- | --- | --- |
| P0 运行时核心 | `next`、`react`、`react-dom`、`better-auth`、`drizzle-orm`、`better-sqlite3` | 安全更新优先处理；必须有完整回归 |
| P1 供应商 SDK | `openai`、`@aws-sdk/*`、Gemini/兼容供应商相关依赖 | 关注鉴权、网络、重试、代理行为 |
| P1 本地数据 | `dexie`、SQLite 相关依赖 | 关注 IndexedDB/SQLite 迁移兼容 |
| P2 UI 组件 | Radix、lucide、Tailwind、class variance | 关注视觉回归和可访问性 |
| P2 构建工具 | TypeScript、ESLint、Prettier、Vitest、Tauri CLI | 关注构建、lint、测试行为变化 |
| P3 开发辅助 | 格式化插件、类型包 | 可批量处理，但不能影响发布链路 |

### 6.7 监控与运营

上线后需要：

- 观察 142 Docker 日志和 129 systemd 日志至少 24 小时。
- 关注 5xx、登录跳转异常、短链跳转异常、图片生成 API 错误率。
- 验证 macOS updater `latest.json` 可被客户端读取。
- 验证 Android APK 可安装，且图标和包名不回退。
- 记录修复前后 `npm audit` 输出到对应 PR 或 issue。

## 7. 建议任务拆分

### Phase A：紧急漏洞修复

- 升级 `next` 到 `16.2.6`。
- 清除 `postcss` 受影响版本。
- 清除 `brace-expansion` 受影响版本。
- 跑完整本地校验和 audit。
- 形成安全修复 PR。

交付物：

- `package.json` / `package-lock.json` 变更。
- `CHANGELOG.md` 安全修复说明。
- audit 前后对比。
- 回归验证记录。

### Phase B：安全门禁落地

- 新增 CI audit job。
- 新增 Dependabot 或 Renovate 配置。
- 新增 Rust/Cargo audit 工具链。
- 新增安全例外白名单机制。

交付物：

- `.github/dependabot.yml` 或 Renovate 配置。
- GitHub Actions 安全扫描 workflow。
- 安全例外模板和说明。

### Phase C：供应链与发布安全增强

- 增加 SBOM。
- 增加 license report。
- 增加 Docker image 扫描。
- 增加 Release 资产签名/校验摘要报告。
- 明确 Android、桌面 updater、服务器部署包的签名与完整性检查。

交付物：

- Release workflow artifact。
- SBOM 文件。
- License report。
- 安全扫描报告。

## 8. 验收标准

基础验收：

- `npm audit --omit=dev` 为 0 个漏洞。
- `npm audit` 为 0 个 high / critical；如存在 moderate，必须有已批准例外。
- `npm audit signatures` 可稳定运行并输出签名覆盖情况。
- Rust/Cargo 安全扫描可运行。
- CI 在 PR、main 和 release 三个关键阶段执行安全检查。

功能验收：

- Web 构建和运行正常。
- Tauri desktop 静态导出正常。
- Android 初始化、图标同步和 APK 构建正常。
- 142 Docker 和 129 systemd 部署流程不退化。
- 管理后台、分享、短链、历史同步、图片生成、图生文、视频相关路径通过回归。

发布验收：

- GitHub Actions release workflow 成功。
- GitHub Release 包含 macOS、Windows、Linux、Android APK、`latest.json`。
- 生产根页面缓存头符合 `RELEASE_PROCESS.md`。
- 线上服务日志无新增启动错误或高频运行时异常。

