# 版本发布规范

本文档记录 `gpt-image-playground` 的标准发版流程。以后只要对 AI 说“发布 x.y.z 版本”，就按本文档逐步执行，确保版本号、变更日志、GitHub Release、桌面端构建和两台服务器部署一致。

## 适用范围

- Web 应用版本发布。
- Tauri 桌面端 tag 驱动构建发布。
- 服务器 `142`（Oracle / Docker）与 `129`（生产 / PM2）部署。

## 关键文件

每次发布都必须同步以下文件：

| 文件 | 要求 |
| --- | --- |
| `package.json` | `version` 必须等于目标版本（不带 `v`） |
| `package-lock.json` | 根版本与 `packages[""].version` 必须等于目标版本 |
| `src-tauri/tauri.conf.json` | `version` 必须等于目标版本 |
| `src-tauri/Cargo.toml` | `[package].version` 必须等于目标版本 |
| `CHANGELOG.md` | 顶部必须存在 `## v目标版本 - YYYY-MM-DD` 中文更新说明 |

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
npm run lint
npx tsc --noEmit
npm run build
npm test
```

同时检查版本一致性：

```bash
node -e "const fs=require('fs'); const pkg=require('./package.json'); const lock=require('./package-lock.json'); const tauri=require('./src-tauri/tauri.conf.json'); const cargo=fs.readFileSync('./src-tauri/Cargo.toml','utf8').match(/^version = \"(.+)\"/m)?.[1]; console.log({package:pkg.version, lock:lock.version, lockRoot:lock.packages[''].version, tauri:tauri.version, cargo}); if([pkg.version, lock.version, lock.packages[''].version, tauri.version, cargo].some(v=>v!==pkg.version)) process.exit(1);"
```

### 5. 提交与 tag

1. 查看变更：`git diff --stat` 与 `git diff`。
2. 暂存版本文件、变更日志和发布文档。
3. 创建发布提交：

```bash
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md RELEASE_PROCESS.md
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

发布时需要等待该 workflow 至少进入运行状态；如需严格交付桌面包，必须等待 workflow 全部成功。

### 7. 部署两台服务器

确认 GitHub Actions 已触发后，执行两个部署脚本：

```bash
./scripts/deploy.sh
./scripts/deploy-129.sh
```

脚本目标：

| 脚本 | 服务器 | 域名 | 运行方式 |
| --- | --- | --- | --- |
| `scripts/deploy.sh` | `142` / `146.56.184.142` | `img-playground.ora.anzz.top` | Docker + Caddy |
| `scripts/deploy-129.sh` | `129` / `159.75.70.129` | `img-playground.anzz.site` | Node.js + PM2 + Caddy |

两个脚本目标服务器、端口和运行方式不同，但两个脚本都会在当前本地工作区执行 `npm run build`。如果在同一工作区直接并行启动，可能触发 Next.js 的构建锁错误：`Another next build process is already running`。推荐做法：

1. 在同一工作区内按顺序执行两个脚本；或
2. 如必须并行部署，分别在独立 git worktree / 独立目录中运行，避免共享 `.next` 构建锁。

若网络需要代理，按脚本支持传入 `--proxy host:port`。

### 8. 部署后验证

至少验证：

```bash
curl -sI https://img-playground.ora.anzz.top
curl -sI https://img-playground.anzz.site
```

期望返回 `200`、`301` 或 `302`。如脚本输出包含容器状态或 PM2 状态，也要确认：

- `142`：Docker 容器处于 `Up`。
- `129`：`pm2 status gpt-image-playground` 为 `online`。

同时必须检查根页面缓存头，避免发版后继续命中旧 HTML：

```bash
curl -sI https://img-playground.ora.anzz.top | grep -i '^cache-control:'
curl -sI https://img-playground.anzz.site | grep -i '^cache-control:'
```

期望根页面返回 `Cache-Control: no-cache, no-store, must-revalidate`。部署脚本会在 Caddy 中为 `/` 入口配置专用 `reverse_proxy @html ... { header_down ... }`，只覆盖 HTML 入口缓存头，不影响 `/_next/static` 哈希静态资源缓存。

### 9. 交付总结

发布完成后，向用户汇报：

1. 目标版本与 tag。
2. 更新的版本文件和 changelog 小节。
3. 本地校验命令及结果。
4. GitHub Actions 触发情况和链接/状态。
5. 两台服务器部署结果和访问地址。
6. 风险、回滚点和后续建议。

## 常见失败与处理

| 失败点 | 处理方式 |
| --- | --- |
| 本地 lint/typecheck/build 失败 | 修复后重新执行校验，不得跳过 |
| tag 已推送但 Actions 版本校验失败 | 删除远端 tag，修复版本文件或 changelog 后重新 tag |
| GitHub Release 构建失败 | 查看 workflow 日志，修复后可通过重新推 tag 或 workflow_dispatch 重新构建 |
| `142` Docker 部署失败 | 重新运行 `scripts/deploy.sh`；必要时 SSH 到服务器查看 Docker/Caddy 日志 |
| `129` PM2 部署失败 | 查看 PM2 日志；必要时恢复上一版本代码并 `pm2 startOrReload` |
| HTTPS 检查失败 | 等待 Caddy 证书签发 1-2 分钟；仍失败则检查 Caddyfile 和域名解析 |

## 注意事项

- `.env.local` 可能包含本地敏感信息，绝不能提交。
- `.env.production` 当前主要用于生产默认配置；API Key 可由用户在 UI 系统设置中配置。
- 发版提交不要混入与版本发布无关的功能改动。
- 没有用户明确要求时，不要 force push；如必须重发 tag，先删除远端 tag 再重新创建。
