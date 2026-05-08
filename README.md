# <img src="./public/favicon.svg" alt="Project Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT Image Playground

基于 Web 的多供应商图像生成与编辑平台，支持 OpenAI GPT 图像模型、Google Gemini、SenseNova U1 Fast 和 Seedream（豆包/火山方舟）等模型。

> **注意:** 默认模型为 `gpt-image-2`，这是 OpenAI 最新的 GPT 图像模型。除了旧版固定尺寸外，还支持最高 4K 的任意分辨率（带约束验证）。

<p align="center">
  <img src="./readme-images/interface.jpg" alt="Interface" width="600"/>
</p>

## ✨ 功能特性

- **🎨 图片生成:** 通过文本提示词创建新图片。
- **🖌️ 图片编辑:** 基于文本提示词和可选蒙版修改现有图片。
- **🧩 多供应商模型选择:** 高级选项中先选择供应商，再选择该供应商下的模型，避免模型列表随接入增多变得难以筛选。
- **⚙️ Provider-aware API 参数控制:** OpenAI 展示质量、输出格式、背景、审核等通用参数；SenseNova/Seedream 展示各自文档化的尺寸、`response_format`、水印、组图、Seed、Guidance、输出格式、提示词优化和联网搜索等专属参数。
- **📐 自定义分辨率与自定义模型:** `gpt-image-2` 支持 2K/4K 预设和任意 Width × Height 校验；自定义模型可配置尺寸预设、默认尺寸、能力开关和 providerOptions 默认参数。
- **🎭 内置蒙版工具:** 在编辑模式中轻松创建或上传蒙版，指定需要修改的区域。直接在图片上绘制以生成蒙版。

    > ⚠️ 请注意，`gpt-image-1` 的蒙版功能目前不能保证 100% 精确控制。<br>1) [这是已知的模型限制。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/37) <br>2) [OpenAI 计划在后续更新中改进。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/41)

<p align="center">
  <img src="./readme-images/mask-creation.jpg" alt="Interface" width="350"/>
</p>

- **📜 详细的历史与费用追踪:**
    - 查看所有图片生成和编辑的完整历史。**点击缩略图可在输出区查看，双击缩略图可直接打开全屏大图预览。**
    - 查看每次请求使用的参数。
    - 获取详细的 API Token 用量和估算费用（`$USD`）。（提示：点击图片上的金额即可查看明细）
    - 查看每次生成使用的完整提示词。
    - 查看历史总费用。
    - 从历史中删除不需要的条目。

<p align="center">
  <img src="./readme-images/history.jpg" alt="Interface" width="1306"/>
</p>

<p align="center">
  <img src="./readme-images/cost-breakdown.jpg" alt="Interface" width="350"/>
</p>

- **🖼️ 灵活的图片查看模式:** 以网格形式浏览图片，或单独全屏查看每张图片。**点击图片可放大查看完整尺寸；多图预览中可通过左右滑动/拖拽或键盘方向键切换上、下一张。**
- **🚀 发送到编辑:** 快速将生成的图片、历史图片或全屏预览中的图片发送到编辑模式；从历史预览发送时会自动回到顶部编辑区。
- **📋 灵活的图片输入:** 三种方式将图片输入编辑模式：
    - **全局粘贴:** 页面任意位置 `Ctrl+V` 粘贴图片，自动进入编辑模式
    - **全局拖拽:** 从桌面或文件管理器拖入页面任意位置，全屏覆盖层确认后自动加载
    - **文件选择器与发送到编辑:** 传统文件选择或从历史中发送已生成图片
- **⚙️ 多用户隔离:** UI 配置存储在 `localStorage`，不同浏览器独立，互不影响
- **🔍 全屏图片预览:** 点击图片进入全屏预览，支持滚轮缩放（±8%步进）、双指缩放、鼠标/触摸拖拽移动、自适应屏幕居中、ESC 键退出；多图时无需额外上一张/下一张按钮，左右拖拽会先露出相邻图片，松手距离不足会平滑回弹取消切换，持续拖过阈值才缓动切图，也可用 `←` / `→` 快捷键切换图片。
- **⚙️ 系统设置面板:** 通过 UI 界面直接配置 API Key、Base URL、存储模式和连接模式，配置实时生效无需重启。优先级：UI 配置 > .env 配置。
- **✨ 提示词润色:** 在分享按钮右侧一键润色当前提示词，可通过系统设置指定独立的润色 Base URL、API Key、模型 ID 和润色提示词。
- **🔗 安全分享链接:** 可选择分享提示词、模型 ID、API Base URL、API Key 和自动生成开关；API Key 默认不包含且需要二次确认。也可启用密码加密分享，链接只暴露 `sdata` 参数；如勾选附带解密密码，会通过 `#key=` 生成可自动解密的完整链接。
- **🔗 API 连接模式:**
    - **服务器中转（默认）:** 请求经服务器转发，API Key 安全不暴露。
    - **客户端直连:** 浏览器直接调用 API 端点，需目标地址支持 CORS，适用于第三方中转服务。

## 🏗️ 构建与部署

### 构建生产版本

```bash
npm install
npm run build
```

构建产物位于 `.next/` 目录，可通过以下方式启动生产服务器：

```bash
npm run start
```

### 桌面应用打包（可选）

本项目已内置 [Tauri](https://tauri.app/) 桌面应用配置，可在本地或 GitHub Actions 中构建跨平台安装包。

**本地构建：**

```bash
npm install
npm run build:desktop
npx @tauri-apps/cli build --verbose
```

构建完成后，桌面应用会自动将 Next.js 静态资源打包进原生窗口，用户无需安装浏览器即可使用。发布版本由 GitHub Actions 在推送 `v*` 标签时自动完成：工作流会校验 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json` 与 `src-tauri/Cargo.toml` 的版本一致性，读取 `CHANGELOG.md` 中对应版本的中文更新说明，并将 macOS、Windows、Linux 安装包上传到 GitHub Release。

## ▲ 部署到 Vercel

🚨 _注意: 如果从 `main` 或 `master` 分支部署，你的 Vercel 部署将对任何拥有 URL 的人公开。从其他分支部署需要用户登录 Vercel（在你的团队中）才能访问。_ 🚨

你可以一键部署自己的实例到 Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/alasano/gpt-image-1-playground&env=OPENAI_API_KEY,NEXT_PUBLIC_IMAGE_STORAGE_MODE,APP_PASSWORD&envDescription=OpenAI%20API%20Key%20is%20required.%20Set%20storage%20mode%20to%20indexeddb%20for%20Vercel%20deployments.&project-name=gpt-image-playground&repository-name=gpt-image-playground)

部署设置时需要输入 `OPENAI_API_KEY` 和 `APP_PASSWORD`。对于 Vercel 部署，需要设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE` 为 `indexeddb`。

注意：如果没有设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE`，应用会自动检测是否运行在 Vercel 上（通过 `VERCEL` 或 `NEXT_PUBLIC_VERCEL_ENV` 环境变量），并自动使用 `indexeddb` 模式。否则（例如本地运行），默认使用 `fs` 模式。你也可以显式设置为 `fs` 或 `indexeddb` 来覆盖自动行为。

## 🚀 快速开始 [本地部署]

按照以下步骤在本地运行。

### 环境要求

- [Node.js](https://nodejs.org/)（需要 20 或更高版本）
- [npm](https://www.npmjs.com/)、[yarn](https://yarnpkg.com/)、[pnpm](https://pnpm.io/) 或 [bun](https://bun.sh/)

### 1. 设置 API Key 🟢

默认 OpenAI 模型需要 OpenAI API Key；如使用 Gemini、SenseNova 或 Seedream，可在系统设置或 `.env.local` 中配置对应供应商的 API Key。

⚠️ [你的 OpenAI 组织需要通过验证才能使用 GPT 图像模型](https://help.openai.com/en/articles/10910291-api-organization-verification)

1.  如果没有 `.env.local` 文件，请创建一个。
2.  在 `.env.local` 文件中添加你的 OpenAI API Key:

    ```dotenv
    OPENAI_API_KEY=your_openai_api_key_here
    ```

    **重要:** 妥善保管你的 API Key。`.env.local` 文件默认加入 `.gitignore` 以防止意外提交。

#### 🟡 (可选) 配置 Gemini / SenseNova / Seedream

如果要使用非 OpenAI 的内置供应商，可继续在 `.env.local` 添加对应配置。Base URL 留空时会使用系统默认值。

```dotenv
# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_BASE_URL=

# SenseNova U1 Fast，默认 https://token.sensenova.cn/v1
SENSENOVA_API_KEY=your_sensenova_api_key_here
SENSENOVA_API_BASE_URL=

# Seedream / 火山方舟，默认 https://ark.cn-beijing.volces.com/api/v3
SEEDREAM_API_KEY=your_seedream_api_key_here
SEEDREAM_API_BASE_URL=
```

也可以只通过右上角 **系统设置** 面板配置这些 Key 和 Base URL；UI 设置优先级高于 `.env`。

---

#### 🟡 (可选) IndexedDB 模式 (适合无服务器部署) [例如 Vercel]

对于文件系统只读或临时环境（如 Vercel 无服务器函数），可以配置应用将生成的图片直接保存在浏览器的 IndexedDB 中（使用 Dexie.js）。

在 `.env.local` 文件或托管提供的 UI 中（如 Vercel）设置以下环境变量：

```dotenv
NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb
```

设置此变量为 `indexeddb` 时：

- 服务端 API（`/api/images`）将返回 base64 格式（`b64_json`）的图片数据，而不是保存到磁盘。
- 客户端应用将解码 base64 数据并将图片 Blob 存储在 IndexedDB 中。
- 图片将直接通过浏览器的 Blob URL 提供。

如果此变量**未设置**或为其他值，应用默认使用标准行为，即将图片保存到服务器的 `./generated-images` 目录。

**注意：** 如果没有设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE`，应用会自动检测是否运行在 Vercel 上（通过 `VERCEL` 或 `NEXT_PUBLIC_VERCEL_ENV` 环境变量），并自动使用 `indexeddb` 模式。否则（例如本地运行），默认使用 `fs` 模式。你也可以显式设置为 `fs` 或 `indexeddb` 来覆盖自动行为。

#### 🟡 (可选) 使用自定义 API 端点

如果需要使用兼容 OpenAI API 的端点（如本地模型服务器或其他提供商），可以在 `.env.local` 文件中通过 `OPENAI_API_BASE_URL` 环境变量指定基础 URL：

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_BASE_URL=your_compatible_api_endpoint_here
```

如果未设置 `OPENAI_API_BASE_URL`，应用将使用标准 OpenAI API 端点。

提示词输入框的“润色”按钮使用 OpenAI-compatible Chat Completions 模型。可在系统设置中配置，也可通过 `.env.local` 提供默认值；留空时会复用 OpenAI 配置与内置默认值：

```dotenv
POLISHING_API_KEY=your_polishing_api_key_here
POLISHING_API_BASE_URL=https://your-compatible-endpoint.example.com/v1
POLISHING_MODEL_ID=gpt-4o-mini
POLISHING_PROMPT=你是一名专业的 AI 图像提示词润色助手...
```

如果你在 `.env` 中配置的是第三方中转/服务站点地址，并希望保护部署站点、避免图片流量经服务器中转消耗带宽，可以启用客户端直链优先：

```dotenv
CLIENT_DIRECT_LINK_PRIORITY=true
```

也兼容 `NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY=true`，但推荐使用不带 `NEXT_PUBLIC_` 的服务端环境变量。

启用后，当 UI 输入或 `.env` 中的 OpenAI/Gemini/SenseNova/Seedream/提示词润色 Base URL 指向非官方域名时：

- 系统设置面板会锁定为 **客户端直连**，不允许选择 **服务器中转**。
- `/api/images` 服务器中转接口会拒绝继续代理该服务站点请求，提示用户改用客户端直连。
- 浏览器直连仍需要在系统设置中配置可用于客户端的 API Key，并确保目标地址支持 CORS。

---

#### 🟡 (可选) 系统设置面板 [推荐]

应用内置了**系统设置面**（右上角 ⚙️ 图标），支持通过 UI 界面直接配置所有参数，**配置实时生效，无需重启服务器**。

| 配置项           | 说明                                     |
| ---------------- | ---------------------------------------- |
| **供应商 API 配置** | OpenAI、Gemini、SenseNova、Seedream 等供应商认证密钥与 Base URL；同一供应商类型可保存多个命名端点并在高级选项中切换 |
| **可用模型**     | 每个命名供应商端点可选择显示哪些模型，并可添加该端点提供的自定义模型 ID |
| **提示词润色**   | 润色模型的 Base URL、API Key、模型 ID 与润色提示词 |
| **图片存储模式** | 自动检测 / 文件系统 / IndexedDB          |
| **API 连接模式** | 服务器中转（默认）/ 客户端直连           |

**配置优先级**: UI 设置 > .env 文件 > 系统默认值

---

#### 🔗 (可选) URL 参数与分享链接

你可以通过 URL 参数预填提示词、模型和 API 配置，适合把当前工作流分享给别人或在自动化场景中快速打开指定配置。

| 参数                                            | 说明                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `prompt`                                        | 预填输入框中的提示词                                                                  |
| `model`                                         | 指定模型 ID，例如 `gpt-image-2`、`sensenova-u1-fast`、`doubao-seedream-5.0-lite` 或兼容端点提供的自定义模型 |
| `apikey` / `apiKey`                             | 临时使用的 API Key                                                                    |
| `baseurl` / `baseUrl`                           | 临时使用的 API Base URL（接受 `http` / `https`，未写协议时默认按 `https://` 解析；OpenAI 兼容端点请求时会在仅填写域名的情况下补 `/v1`） |
| `providerInstance` / `providerInstanceId` / `instance` | 指定要切换到的命名供应商端点 ID，适合分享同一类型下的某个 OpenAI 兼容中转或自定义端点 |
| `autostart` / `autoStart` / `auto` / `generate` | 为 `true` / `1` / `yes` / `on` 时，在包含非空 `prompt` 的前提下打开后自动提交一次生成 |
| `sdata`                                         | 密码加密后的分享数据；接收者需要输入分享者提供的密码，或打开带 `#key=` 的完整链接自动解密 |
| `#key`                                         | 可选的 URL 片段密码，仅用于 `sdata` 加密分享自动解密；拿到完整链接的人等同拿到密码     |

读取完成后，应用会自动从地址栏清理已消费的参数，减少再次复制链接时误分享敏感信息的风险。

**分享按钮：** 输入框上方的“分享”按钮可以选择要写入链接的内容。默认包含提示词、模型和当前命名供应商端点，API Base URL 可选包含，API Key 默认不包含；如果勾选 API Key，需要再次确认风险后才能复制。

**密码加密分享：** 勾选“使用密码加密整个分享链接”后，提示词、模型、命名供应商端点、API Base URL、API Key 和自动生成开关会被整体加密到 `sdata` 中，链接表面不会暴露明文参数。可以点击“随机”生成 8 位解密密码；默认密码不会写入链接或保存到浏览器，请通过其他可信渠道告诉接收者。如需更便捷转发，可以勾选“复制时附带解密密码”，生成 `?sdata=...#key=...` 形式的完整链接，接收者打开后会自动解密并清理地址栏中的密码片段。请注意：拿到这个完整链接的人也等同拿到了密码。

**接收者配置保存选择：** 当分享链接同时包含 API Key、API Base URL 和模型 ID 时，接收者会看到提示，可以选择：

- **仅本次使用：** 配置只在当前页面会话临时生效，刷新或重新打开页面后不会保留。
- **保存到本地设置：** 配置会写入当前浏览器的 `localStorage`，后续继续优先使用。
- **忽略这些配置：** 不应用分享来的 API 配置；如链接包含提示词，仍会填入提示词。

> ⚠️ 安全提醒：URL 参数即使会被应用清理，也可能已经进入浏览器历史、聊天工具预览或服务器日志。分享 API Key 时请尽量使用临时、受限额度或可随时撤销的 Key，并确认接收方可信。

---

#### 🔗 API 连接模式说明

| 模式           | 数据流                   | 安全性                 | 适用场景                 |
| -------------- | ------------------------ | ---------------------- | ------------------------ |
| **服务器中转** | 浏览器 → 服务器 → 供应商 API | 高（API Key 不暴露）   | 默认模式，所有场景       |
| **客户端直连** | 浏览器 → 供应商 API          | 中（Network 面板可见） | 持 CORS 的第三方中转服务 |

**直连模式要求：**

1. 必须在系统设置中填写 **API Key** 和 **API Base URL**
2. 目标 Base URL 必须支持 **CORS 跨域访问**（返回 `Access-Control-Allow-Origin` 等响应头）
3. 如中转地址不支持 CORS，请求会报错 `OPTIONS 405 Method Not Allowed`，需联系中转服务提供方修改配置
4. 直连模式不经过服务器，**不会触发 APP_PASSWORD 验证**

---

#### 🟡 (可选) 启用密码验证

```dotenv
APP_PASSWORD=your_password_here
```

设置 `APP_PASSWORD` 后，前端会提示输入密码以验证请求。

<p align="center">
  <img src="./readme-images/password-dialog.jpg" alt="Password Dialog" width="460"/>
</p>

---

#### 🟡 (可选) Umami 统计分析

如果需要在页面中启用 [Umami](https://umami.is/) 统计分析，可以在 `.env.local`、`.env.production` 或部署平台的环境变量中配置：

```dotenv
UMAMI_SCRIPT_URL=https://your-umami-instance.example.com/script.js
UMAMI_WEBSITE_ID=your-umami-website-id
```

当 `UMAMI_SCRIPT_URL` 和 `UMAMI_WEBSITE_ID` 都有值时，应用会自动在页面中注入统计脚本：

```html
<script defer src="https://your-umami-instance.example.com/script.js" data-website-id="your-umami-website-id"></script>
```

如果任意一个变量为空，则不会加载 Umami 脚本。

---

### 2. 安装依赖 🟢

在终端中进入项目目录并安装所需包：

```bash
npm install
# 或
# yarn install
# 或
# pnpm install
# 或
# bun install
```

### 3. 运行开发服务器 🟢

启动 Next.js 开发服务器：

```bash
npm run dev
# 或
# yarn dev
# 或
# pnpm dev
# 或
# bun dev
```

### 4. 打开 Playground 🟢

在浏览器中访问 [http://localhost:3000](http://localhost:3000) 即可开始使用！

## 🤝 贡献

欢迎提交 Issue 和功能建议！

## 📄 许可证

MIT
