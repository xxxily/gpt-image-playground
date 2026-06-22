# 版本发布规范

本文档记录 `gpt-image-playground` 的标准发版流程。以后只要对 AI 说“发布 x.y.z 版本”，就按本文档逐步执行，确保版本号、变更日志、GitHub Release、桌面端构建、Android APK 和 `129` 生产服务器部署一致。

## 适用范围

- Web 应用版本发布。
- Tauri 桌面端 tag 驱动构建发布。
- Tauri Android APK tag 驱动构建发布。
- 服务器 `129`（生产 / systemd + 本地运行包）部署。

`142`（Oracle / Docker）服务器当前暂停发版。在用户明确通知 `142` 已恢复、要求恢复发布流程或要求单独补发前，标准发布流程不得执行 `scripts/deploy.sh`，也不验证 `img-playground.ora.anzz.top`。

## 关键文件

每次发布都必须同步以下文件：

| 文件                                | 要求                                                  |
| ----------------------------------- | ----------------------------------------------------- |
| `package.json`                      | `version` 必须等于目标版本（不带 `v`）                |
| `package-lock.json`                 | 根版本与 `packages[""].version` 必须等于目标版本      |
| `src-tauri/tauri.conf.json`         | `version` 必须等于目标版本                            |
| `src-tauri/tauri.android.conf.json` | Android 包名配置必须存在，且包名不能包含连字符        |
| `src-tauri/Cargo.toml`              | `[package].version` 必须等于目标版本                  |
| `src-tauri/Cargo.lock`              | 必须提交到仓库，确保桌面端和 Android Release 依赖锁定 |
| `CHANGELOG.md`                      | 顶部必须存在 `## v目标版本 - YYYY-MM-DD` 中文更新说明 |

GitHub Actions 会在 tag 推送后校验这些版本是否与 tag 匹配；任一文件不一致都会导致 Release 构建失败。

## 标准流程

### 1. 发版前确认

1. 确认当前分支是 `master`，并且跟踪 `origin/master`。
2. 确认工作区干净：`git status --short --branch`。
3. 找到上一版本 tag：`git tag --sort=-v:refname`，通常取最新的 `v*`。
4. 提取变更：`git log 上一版本..HEAD --oneline`，并结合 changed files 汇总用户可感知变化。
5. 检查本次是否包含破坏性变更；如有，必须在 `CHANGELOG.md` 中写明升级注意事项。

### 2. 更新版本号

用 npm 更新 Web 侧版本，但不要让 npm 自动提交或打 tag：

```bash
npm version --no-git-tag-version x.y.z
```

然后手动更新：

```text
src-tauri/tauri.conf.json  -> "version": "x.y.z"
src-tauri/Cargo.toml       -> version = "x.y.z"
```

### 3. 更新中文变更日志

在 `CHANGELOG.md` 顶部 `# 更新日志` 后插入：

```markdown
## vx.y.z - YYYY-MM-DD

### 重点更新

- 用中文写清楚本版本最重要的用户可感知变化。

### 稳定性与错误处理

- 写清楚修复、兼容性和可靠性提升。

### 文档与发布

- 写清楚文档、配置、发布流程和版本一致性事项。

### 升级注意事项

- 写清楚部署或使用时需要额外确认的事项。
```

只保留有内容的分组；不要把纯内部重排写成用户侧重大变化。

### 4. 本地校验

至少执行：

```bash
npm ci
npm run secret-scan
npm run release:env-check
npm run audit:prod
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:desktop
```

桌面 Rust 侧在本机工具链可用时执行：

```bash
npm run rust:test
npm run rust:clippy
npm run rust:audit
```

如果本机缺少 `cargo-audit`，先安装：

```bash
cargo install cargo-audit --locked
```

`secret-scan` 不打印疑似 secret 内容；`release:env-check` 只报告 `.env*` 文件是否存在及是否被 Git 跟踪，不能把 `.env` 内容复制到日志或发布说明。

同时检查版本一致性：

```bash
node -e "const fs=require('fs'); const pkg=require('./package.json'); const lock=require('./package-lock.json'); const tauri=require('./src-tauri/tauri.conf.json'); const cargo=fs.readFileSync('./src-tauri/Cargo.toml','utf8').match(/^version = \"(.+)\"/m)?.[1]; console.log({package:pkg.version, lock:lock.version, lockRoot:lock.packages[''].version, tauri:tauri.version, cargo}); if([pkg.version, lock.version, lock.packages[''].version, tauri.version, cargo].some(v=>v!==pkg.version)) process.exit(1);"
```

并确认 Rust Release 依赖锁定可用：

```bash
cargo metadata --manifest-path src-tauri/Cargo.toml --locked --format-version 1 >/dev/null
```

### 5. 提交与 tag

1. 查看变更：`git diff --stat` 与 `git diff`。
2. 暂存版本文件、变更日志和发布文档。
   如果本次同步了生产默认值，也要把 `.env.production` 一并暂存，必要时使用 `git add -f`。
   这里不要直接清空已有的非密钥默认值，至少要保留原先的生产配置并合并本次新增的站点、后台与展示相关默认值。
3. 创建发布提交：

```bash
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock CHANGELOG.md RELEASE_PROCESS.md docs/agent-reports/YYYY-MM-DD-release-x.y.z.md
git commit -m "chore: release vx.y.z"
git tag vx.y.z
```

4. 推送代码与 tag：

```bash
CURRENT_BRANCH=$(git branch --show-current)
git push origin "$CURRENT_BRANCH"
git push origin vx.y.z
```

在当前 OpenCode 环境中，如已加载 `git-master`，所有 `git` 命令都应加 `GIT_MASTER=1` 前缀。

如果 tag 已经推送但 GitHub Actions 因版本或 changelog 校验失败，应先删除远端 tag，修复后重新打 tag：

```bash
git push --delete origin vx.y.z
git tag -d vx.y.z
```

### 6. 确认 GitHub Actions 构建

推送 `v*` tag 会触发 `.github/workflows/build-release.yml`，该 workflow 会：

1. 校验 tag 格式。
2. 校验 Web、package-lock、Tauri 和 Cargo 版本一致。
3. 校验 `CHANGELOG.md` 存在对应版本小节。
4. 运行 lint、TypeScript 检查和 Web build。
5. 创建或更新 GitHub Release。
6. 构建并上传 macOS、Windows、Linux 桌面安装包。
7. 初始化 Tauri Android 工程，构建并上传 Android APK。

桌面包和 Android 产物全部成功后，workflow 会把对应的草稿 Release 发布为正式版本；在此之前 release 保持 draft，便于失败重跑时继续复用同一个 tag。

发布时需要等待该 workflow 至少进入运行状态；如需严格交付桌面包和 APK，必须等待 workflow 全部成功。

macOS 桌面包规则：

- 桌面端启用 Tauri 官方 updater，Release workflow 会通过 `src-tauri/tauri.updater.conf.json` 生成并上传 `latest.json` 以及对应安装包签名，客户端才能在“关于 -> 检查更新”里一键安装新版。
- GitHub Secrets 必须配置 `TAURI_SIGNING_PRIVATE_KEY`；如果 updater 私钥设置了密码，还要配置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。当前客户端内置的公钥对应本机私钥文件 `~/.tauri/gpt-image-playground-updater.key`，私钥绝不能提交到仓库。
- 本项目免费开源，默认不强制购买 Apple Developer 账号；未配置 Apple secrets 时，GitHub Release 会上传未签名/未公证的 macOS DMG。
- 未签名/未公证的 DMG 可能触发 Gatekeeper “应用已损坏”提示；release workflow 会在 GitHub Release notes 中自动追加 macOS 用户打开说明。
- 如果配置 `APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_API_ISSUER`、`APPLE_API_KEY`、`APPLE_API_KEY_P8` 五个 GitHub Secrets，macOS job 会启用 Developer ID 签名和 Apple notarization。
- 五个 Apple secrets 必须同时配置；如果只配置了一部分，macOS job 会失败，避免产出状态不明确的安装包。
- `APPLE_CERTIFICATE` 保存 base64 编码后的 `.p12` Developer ID Application 证书，`APPLE_API_KEY_P8` 保存 App Store Connect 下载的 `.p8` 私钥文件内容。

Android APK 产物规则：

- GitHub Release 必须出现 `GPT.Image.Playground_x.y.z_android_*.apk` 资产。
- 如果仓库配置了 `ANDROID_KEY_BASE64`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD` 三个 GitHub Secrets，workflow 会构建 release-signed APK。
- 如果未配置 Android 签名 secrets，workflow 会构建并上传 debug-signed APK；该 APK 可用于直接安装验证，但不应作为长期生产签名包使用。
- 对已经发布过的 tag 补 APK 时，使用 `workflow_dispatch` 运行 `.github/workflows/build-release.yml`，填写目标 tag，并勾选 `android_only`，避免重复构建/上传桌面端产物。
- GitHub Actions 会在 `ubuntu-latest` 上自动安装 Android SDK / NDK / JDK 17；当前 workflow 固定安装 `platform-tools`、`platforms;android-35`、`build-tools;35.0.0` 和 `ndk;27.2.12479018`，因此 Release CI 不依赖 runner 预装 Android Studio。
- 如果三个签名 secrets 任何一个缺失，workflow 会明确降级为 debug-signed APK 并继续上传；这类 APK 适合临时验证，不适合作为长期生产签名包。
- 已发布 tag 的补发只需要重跑 Android job，不需要重新构建桌面端产物，所以补发时务必勾选 `android_only=true`。
- Release workflow 默认只构建 `aarch64` / `arm64-v8a` 手机 APK，避免上传包含 `arm64-v8a`、`armeabi-v7a`、`x86`、`x86_64` 四套 native 库的超大 universal APK。
- `npm run android:init -- --ci` 会重新生成被忽略的 Android 工程；Release workflow 会随后执行 `npm run sync:android-icons`，把 `src-tauri/icons/android` 中的自定义 launcher icon 复制到 `src-tauri/gen/android/app/src/main/res`。本地 `npm run build:android` 也会通过 `prebuild:android` 自动同步，避免 APK 回退到 Tauri 默认图标。

### 7. 部署 129 服务器

确认 GitHub Actions 已触发后，仅执行 `129` 部署脚本：

```bash
./scripts/deploy-129.sh
```

脚本目标：

| 脚本                    | 服务器                  | 域名                       | 运行方式                           |
| ----------------------- | ----------------------- | -------------------------- | ---------------------------------- |
| `scripts/deploy-129.sh` | `129` / `159.75.70.129` | `img-playground.anzz.site` | Linux x64 运行包 + systemd + Caddy |

`142` 暂停发版期间，不执行 `scripts/deploy.sh`，不创建 `gpt-image-playground-deploy-142` worktree，也不把 `img-playground.ora.anzz.top` 作为发布验收项。用户明确通知恢复或补发后，再从对应 tag 单独执行 `142` 补发和验证。

推荐从已验证的 release commit/tag 建独立 worktree 运行部署，避免当前工作区的脏文件或构建产物影响发布：

```bash
RELEASE_REF="$(git rev-parse HEAD)"
BETTER_AUTH_SECRET="$(node -e "const fs=require('fs'); const p='.env.local'; const m=fs.existsSync(p)&&fs.readFileSync(p,'utf8').match(/^BETTER_AUTH_SECRET=(.+)$/m); if(!m) process.exit(1); process.stdout.write(m[1].trim().replace(/^['\\\"]|['\\\"]$/g,''));")"
git worktree add --detach ../gpt-image-playground-deploy-129 "$RELEASE_REF"

cd ../gpt-image-playground-deploy-129
npm ci
BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" ./scripts/deploy-129.sh

cd -
git worktree remove ../gpt-image-playground-deploy-129
```

独立 worktree 不会自动带上未跟踪的 `.env.local`，所以不能依赖 `.env.local` 在部署脚本内部读取生产密钥。部署前必须显式把 `BETTER_AUTH_SECRET` 传入 `scripts/deploy-129.sh`；如本次发布涉及后台初始化，也要同样传入 `ADMIN_BOOTSTRAP_SECRET`。否则脚本只会按 `.env.production` 生成远端环境，可能覆盖远端持久化 `.env` 并导致后台路由因 Better Auth 默认 secret 返回 `500`。

如果临时只能在当前工作区部署，仍可运行 `scripts/deploy-129.sh`；发布前必须确认暂存和提交范围不包含无关文件。`scripts/deploy-129.sh` 默认会优先使用 `161` 或 Mac Docker 构建运行包，但其回退路径仍可能在当前工作区执行 `npm run build`，所以发布规范以独立 worktree 为准。

若网络需要代理，按脚本支持传入 `--proxy host:port`。

`129` 服务器资源较小，`scripts/deploy-129.sh` 不应在服务器上执行 `npm ci`、`npm run build` 或 native 依赖重建。脚本会在本地生成 Linux x64/glibc 生产依赖，下载固定版本 Linux x64 Node.js，并把 `.next`、`public`、`node_modules` 和 `bin/node` 打成运行包上传到 `129`。服务器端只负责解压到 `releases/`、切换 `current` 软链并重启 `gpt-image-playground.service`。`.env.production` 是生产配置源，发布时只能合并新增默认值，不能清空既有配置。

`129` 的部署打包必须保持最小化：运行包在封装后必须剔除 `.env.production`、文档、脚本、Tauri 目录和其他非运行时文件，避免把不该发布的内容带进服务器。

### 8. 部署后验证

至少验证：

```bash
curl -sI https://img-playground.anzz.site
curl -sI https://img-playground.anzz.site/admin
curl -sI https://img-playground.anzz.site/admin/promo
```

期望返回 `200`、`301` 或 `302`。管理后台和展示管理页也要至少返回 `200` 或 `302`，确认后台链路没有被部署改动卡住。如脚本输出包含容器状态或 systemd 状态，也要确认：

- `129`：`systemctl status gpt-image-playground --no-pager` 为 `active (running)`，并确认 `readlink -f /root/work/gpt-image-playground/current` 指向本次 `releases/` 目录。

同时必须检查根页面缓存头，避免发版后继续命中旧 HTML：

```bash
curl -sI https://img-playground.anzz.site | grep -i '^cache-control:'
```

期望根页面返回 `Cache-Control: no-cache, no-store, must-revalidate`。部署脚本会在 Caddy 中为 `/` 入口配置专用 `reverse_proxy @html ... { header_down ... }`，只覆盖 HTML 入口缓存头，不影响 `/_next/static` 哈希静态资源缓存。

### 9. 交付总结

发布完成后，向用户汇报：

1. 目标版本与 tag。
2. 更新的版本文件和 changelog 小节。
3. 本地校验命令及结果。
4. GitHub Actions 触发情况和链接/状态。
5. `129` 服务器部署结果和访问地址；如果 `142` 仍暂停，说明跳过原因。
6. GitHub Release 的桌面端产物和 Android APK 资产检查结果。
7. 风险、回滚点和后续建议。

## 常见失败与处理

| 失败点                            | 处理方式                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 本地 lint/typecheck/build 失败    | 修复后重新执行校验，不得跳过                                                                                                                               |
| tag 已推送但 Actions 版本校验失败 | 删除远端 tag，修复版本文件或 changelog 后重新 tag                                                                                                          |
| updater 签名失败或缺少私钥        | 确认 GitHub Secrets 已配置 `TAURI_SIGNING_PRIVATE_KEY`，并且与 `src-tauri/tauri.conf.json` 中的 updater 公钥匹配                                           |
| GitHub Release 构建失败           | 查看 workflow 日志，修复后可通过重新推 tag 或 workflow_dispatch 重新构建                                                                                   |
| macOS DMG 提示应用已损坏          | 这是未签名/未公证包被 Gatekeeper 拦截；按 Release notes 执行 `xattr -dr com.apple.quarantine "/Applications/GPT Image Playground.app"` 后右键打开          |
| Android APK 未产出                | 先确认 `Build and upload Android APK` job 是否成功；如 tag 已发布，使用 `workflow_dispatch` + `android_only` 补产物                                        |
| Android release 签名失败          | 检查 `ANDROID_KEY_BASE64`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD` 是否一致；必要时先删除错误 APK asset 后重跑 `android_only`                          |
| `142` 恢复后需要补发              | 等用户明确通知恢复或补发后，从目标 tag 单独运行 `scripts/deploy.sh`，再补做 `img-playground.ora.anzz.top` 根页面、后台和缓存头验证                         |
| `129` systemd 部署失败            | 查看 `journalctl -u gpt-image-playground -n 100 --no-pager`；必要时把 `current` 软链切回上一版 `releases/` 目录并 `systemctl restart gpt-image-playground` |
| HTTPS 检查失败                    | 等待 Caddy 证书签发 1-2 分钟；仍失败则检查 Caddyfile 和域名解析                                                                                            |

## 注意事项

- `.env.local` 可能包含本地敏感信息，绝不能提交。
- `.env.production` 当前主要用于生产默认配置；建议至少统一设置 `AUTH_BASE_URL`、`NEXT_PUBLIC_SITE_URL` 和 `NEXT_PUBLIC_APP_URL` 为线上主域名，桌面端打包和后台认证才会读取同一套线上站点。API Key 可由用户在 UI 系统设置中配置。
- 发版提交不要混入与版本发布无关的功能改动。
- 没有用户明确要求时，不要 force push；如必须重发 tag，先删除远端 tag 再重新创建。
