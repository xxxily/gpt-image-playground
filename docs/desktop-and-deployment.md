# 安装、部署与桌面端

这一页面向需要自己运行或发布应用的用户。日常使用只需要在系统设置里填 API Key；只有本地开发、自托管、Vercel 或桌面端打包时才需要看这里。

## 环境要求

- Node.js 20 或更高版本。
- npm、yarn、pnpm 或 bun 任选其一。

## 本地运行

```bash
npm install
npm run dev
```

然后打开：

```text
http://localhost:3000
```

## 构建生产版本

```bash
npm install
npm run build
npm run start
```

## 常用环境变量

多数配置都可以在界面里完成。环境变量适合部署默认值或服务器侧配置。

### 图像供应商

```dotenv
OPENAI_API_KEY=
OPENAI_API_BASE_URL=

GEMINI_API_KEY=
GEMINI_API_BASE_URL=

SENSENOVA_API_KEY=
SENSENOVA_API_BASE_URL=

SEEDREAM_API_KEY=
SEEDREAM_API_BASE_URL=
```

Base URL 留空时会使用供应商默认地址。

### 图片存储

```dotenv
NEXT_PUBLIC_IMAGE_STORAGE_MODE=auto
```

可选值：

- `auto`：自动判断。
- `fs`：文件系统。
- `indexeddb`：浏览器 IndexedDB，适合 Vercel 等无服务器环境。

### 访问密码

```dotenv
APP_PASSWORD=
```

设置后，服务器中转请求需要在前端输入密码。

### 客户端直连优先

```dotenv
CLIENT_DIRECT_LINK_PRIORITY=true
```

当 Base URL 指向非官方服务站点时，可以强制使用客户端直连，避免服务器代理第三方图片流量。

### 提示词润色

```dotenv
POLISHING_API_KEY=
POLISHING_API_BASE_URL=
POLISHING_MODEL_ID=gpt-4o-mini
POLISHING_PROMPT=
```

留空时，润色会尽量复用 OpenAI 兼容配置和内置提示词。

### S3 兼容对象存储

优先推荐在应用内 **Settings -> 云存储同步** 中按设备配置。需要服务器中转 fallback 时，可以使用：

```dotenv
S3_ENDPOINT=
S3_REGION=us-east-1
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=true
S3_PREFIX=gpt-image-playground/v1
S3_PROFILE_ID=
```

## Vercel 部署

Vercel 环境建议使用 IndexedDB 存储：

```dotenv
NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb
```

如果没有显式设置，应用会尝试根据 Vercel 环境自动选择 IndexedDB。

需要公开访问时，请务必考虑：

- 是否设置 `APP_PASSWORD`。
- 是否允许用户在浏览器里保存自己的 API Key。
- 是否要开启客户端直连优先。
- 不要在公开部署中硬编码长期有效的共享 API Key。

## 桌面应用

项目内置 Tauri 桌面端配置。桌面端适合：

- 不想依赖浏览器使用。
- 想把图片保存到本机目录。
- Web 端对象存储 CORS 不方便配置。
- 需要桌面 Rust 网络层辅助请求。

本地构建：

```bash
npm install
npm run build:desktop
npx @tauri-apps/cli build --verbose
```

发布版本可通过 GitHub Actions 在推送 `v*` 标签时构建 macOS、Windows、Linux 安装包。

### 桌面端自动更新

Tauri 桌面端已接入官方 updater。用户在“关于”弹窗里点击“检查更新”后，如果 GitHub Release 的 `latest.json` 指向更新版本，会出现“安装新版本”按钮，客户端下载、验证签名、安装完成后会自动重启。

发布前必须配置 GitHub Secrets：

- `TAURI_SIGNING_PRIVATE_KEY`：Tauri updater 私钥内容。当前公钥对应的本机私钥在 `~/.tauri/gpt-image-playground-updater.key`，只用于复制到 GitHub Secrets，不得提交到仓库。
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码；当前生成的私钥未设置密码，可以不填。

Release workflow 会通过 `src-tauri/tauri.updater.conf.json` 生成并上传 `latest.json` 和签名后的 updater 产物。缺少 `TAURI_SIGNING_PRIVATE_KEY` 时桌面端构建会直接失败，避免发布一个看得到新版本但无法一键安装的版本。

### macOS 签名与公证

从浏览器或 GitHub Release 下载的 macOS DMG 如果没有经过 Developer ID 签名和 Apple notarization，Gatekeeper 可能会提示应用“已损坏”或阻止打开。这个提示不代表 DMG 文件真的损坏，而是系统无法确认这个下载来源的应用是否可信。

最平滑的公开分发方案是使用 Apple Developer 账号的 **Developer ID Application** 证书签名，并完成 notarization。这个项目是免费开源应用，默认不强制配置付费 Apple 开发者账号；未配置签名凭证时，release workflow 会继续上传未签名/未公证的 DMG，并在 GitHub Release 页面自动追加 macOS 打开说明。

如果以后需要启用签名和公证，可以配置以下 GitHub Secrets；必须五项同时存在，workflow 才会执行 macOS 签名/公证：

- `APPLE_CERTIFICATE`：导出的 `.p12` Developer ID Application 证书，base64 编码后保存。
- `APPLE_CERTIFICATE_PASSWORD`：导出 `.p12` 时设置的密码。
- `APPLE_API_ISSUER`：App Store Connect API Issuer ID。
- `APPLE_API_KEY`：App Store Connect API Key ID。
- `APPLE_API_KEY_P8`：App Store Connect 下载的 `.p8` 私钥文件内容。

未签名/未公证包的用户侧打开方式：

```bash
xattr -dr com.apple.quarantine "/Applications/GPT Image Playground.app"
```

执行前先把 DMG 里的 `GPT Image Playground.app` 拖到“应用程序”目录。执行后再右键点击应用并选择“打开”。

## Umami 统计

如果需要统计访问情况：

```dotenv
UMAMI_SCRIPT_URL=
UMAMI_WEBSITE_ID=
```

两个变量都有值时，页面会自动注入 Umami 脚本。
