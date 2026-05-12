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

### 后台与分享广告

```dotenv
ADMIN_BOOTSTRAP_SECRET=
ADMIN_DATABASE_PATH=/tmp/gpt-image-playground/promo-admin.sqlite
PROMO_SHARE_CONFIG_ENABLED=true
```

- `ADMIN_BOOTSTRAP_SECRET` 用于初始化或重置后台管理员账号。
- `ADMIN_DATABASE_PATH` 指向后台 SQLite 文件；本地开发默认可以直接用 `/tmp/gpt-image-playground/promo-admin.sqlite`。
- `PROMO_SHARE_CONFIG_ENABLED` 控制是否允许创建和编辑分享广告 Profile，建议在本地验收时保持开启。

### 客户端直连优先

```dotenv
CLIENT_DIRECT_LINK_PRIORITY=true
```

当 Base URL 指向非官方服务站点时，可以强制使用客户端直连，避免服务器代理第三方图片流量。

### Web 端 DevTools 抑制（可选）

```dotenv
NEXT_PUBLIC_DISABLE_DEVTOOL_SCOPE=none
```

可选值：

- `none`：关闭，默认值。
- `all`：整个 Web 应用都启用。
- `share`：只在临时分享入口页面启用。

这个开关只针对 Web 端，桌面端会忽略它。

它的目标不是做“绝对安全”，而是给分享页加一点额外摩擦，减少别人一打开开发者工具就直接看到临时 API Key 的概率。真正的安全边界仍然应该放在 Provider 侧的 Key 限制、额度限制和过期策略上。

像所有 `NEXT_PUBLIC_*` 配置一样，改完后需要重新构建或重启 Web 部署，客户端里才会读到新的值。

### 生成卡片头部广告位（可选）

```dotenv
NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED=false
NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL=
NEXT_PUBLIC_GENERATION_HEADER_AD_LINK_URL=
NEXT_PUBLIC_GENERATION_HEADER_AD_ALT=
```

配置后，输入区卡片标题右侧会显示一张赞助广告图。只有当开关为 `true`/`1`/`yes`/`on`，并且图片 URL、点击 URL 都有效时才会渲染。
这些都是 `NEXT_PUBLIC_*` 配置，修改后需要重新构建或重启 Web 部署、桌面端也需要重新打包。
广告容器会先保留位置，图片节点会等页面 `load` 事件之后再通过浏览器空闲时段挂载，避免让广告图片参与首屏主内容加载。

- `NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL`：广告图片地址。可以是 `public` 目录下的路径，例如 `/ad/header-banner.webp`，也可以是 `https://` 图片地址。
- `NEXT_PUBLIC_GENERATION_HEADER_AD_LINK_URL`：点击跳转地址，只接受 `http://` 或 `https://`。
- `NEXT_PUBLIC_GENERATION_HEADER_AD_ALT`：图片替代文本，留空时使用“赞助广告”。

点击行为：

- Web 端使用新窗口打开。
- Tauri 客户端使用系统默认浏览器打开。
- Android Tauri 客户端如果无法唤起默认浏览器，会复制广告链接，并提示用户手动打开访问。

图片尺寸建议：

- 推荐使用一张 `4:1` 横幅图，`1200 x 300 px` 比较稳妥；如果希望文件更小，最低建议 `960 x 240 px`。
- 实际展示尺寸约为桌面端 `224-248 x 56-62 px`，移动端会铺满卡片宽度并保持 `4:1`，通常约 `320-380 x 80-95 px`。
- 建议导出 WebP/AVIF，控制在 `150 KB` 以内；文字和 Logo 放在画面中间安全区，避免贴边和过小文字。

### 分享广告与桌面读取

分享页可以携带公开的 `promoProfileId`。当链接里有这个参数时，主工作台会优先读取对应的分享广告配置；如果没有配置或配置失效，则继续降级到后台全局广告或旧环境变量广告兜底。

桌面端在 **Settings -> 桌面端设置** 里增加了广告读取模式：

- `关闭`：不请求广告接口。
- `当前站点`：请求当前站点的 `/api/promo/placements`。
- `自定义域名`：填写域名，自动拼接 `/api/promo/placements`。
- `完整接口`：直接填写完整广告接口地址。

默认请求超时为 2 秒，请求失败、离线或接口不可用时，广告会直接隐藏，不影响生成和编辑。

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
