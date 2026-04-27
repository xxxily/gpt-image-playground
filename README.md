# <img src="./public/favicon.svg" alt="Project Logo" width="30" height="30" style="vertical-align: middle; margin-right: 8px;"> GPT Image Playground

基于 Web 的交互平台，使用 OpenAI 的 GPT 图像模型（`gpt-image-2`、`gpt-image-1.5`、`gpt-image-1` 和 `gpt-image-1-mini`）生成和编辑图片。

> **注意:** 默认模型为 `gpt-image-2`，这是 OpenAI 最新的 GPT 图像模型。除了旧版固定尺寸外，还支持最高 4K 的任意分辨率（带约束验证）。

<p align="center">
  <img src="./readme-images/interface.jpg" alt="Interface" width="600"/>
</p>

## ✨ 功能特性

*   **🎨 图片生成:** 通过文本提示词创建新图片。
*   **🖌️ 图片编辑:** 基于文本提示词和可选蒙版修改现有图片。
*   **⚙️ 完整的 API 参数控制:** 直接在 UI 中调整 OpenAI Images API 的所有相关参数（尺寸、质量、输出格式、压缩率、背景、内容审核、图片数量）。
*   **📐 自定义分辨率 (gpt-image-2):** 选择 2K/4K 预设或输入任意 Width × Height，系统会实时验证模型约束（16 的倍数、边长最大 3840px、宽高比 ≤ 3:1、总像素 655,360 至 8,294,400）。
*   **🎭 内置蒙版工具:** 在编辑模式中轻松创建或上传蒙版，指定需要修改的区域。直接在图片上绘制以生成蒙版。

     > ⚠️ 请注意，`gpt-image-1` 的蒙版功能目前不能保证 100% 精确控制。<br>1) [这是已知的模型限制。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/37) <br>2) [OpenAI 计划在后续更新中改进。](https://community.openai.com/t/gpt-image-1-problems-with-mask-edits/1240639/41)
<p align="center">
  <img src="./readme-images/mask-creation.jpg" alt="Interface" width="350"/>
</p>

*   **📜 详细的历史与费用追踪:**
    *   查看所有图片生成和编辑的完整历史。**点击缩略图可放大查看。**
    *   查看每次请求使用的参数。
    *   获取详细的 API Token 用量和估算费用（`$USD`）。（提示：点击图片上的金额即可查看明细）
    *   查看每次生成使用的完整提示词。
    *   查看历史总费用。
    *   从历史中删除不需要的条目。

<p align="center">
  <img src="./readme-images/history.jpg" alt="Interface" width="1306"/>
</p>

<p align="center">
  <img src="./readme-images/cost-breakdown.jpg" alt="Interface" width="350"/>
</p>

*   **🖼️ 灵活的图片查看模式:** 以网格形式浏览图片，或单独全屏查看每张图片。**点击图片可放大查看完整尺寸。**
*   **🚀 发送到编辑:** 快速将生成的图片或历史图片发送到编辑模式。
*   **📋 灵活的图片输入:** 三种方式将图片输入编辑模式：
    *   **全局粘贴:** 页面任意位置 `Ctrl+V` 粘贴图片，自动进入编辑模式
    *   **全局拖拽:** 从桌面或文件管理器拖入页面任意位置，全屏覆盖层确认后自动加载
    *   **文件选择器与发送到编辑:** 传统文件选择或从历史中发送已生成图片
*   **⚙️ 多用户隔离:** UI 配置存储在 `localStorage`，不同浏览器独立，互不影响
*   **🔍 全屏图片预览:** 点击图片进入全屏预览，支持滚轮缩放（±8%步进）、鼠标拖拽移动、自适应屏幕居中、ESC 键退出。
*   **⚙️ 系统设置面板:** 通过 UI 界面直接配置 API Key、Base URL、存储模式和连接模式，配置实时生效无需重启。优先级：UI 配置 > .env 配置。
*   **🔗 API 连接模式:**
    *   **服务器中转（默认）:** 请求经服务器转发，API Key 安全不暴露。
    *   **客户端直连:** 浏览器直接调用 API 端点，需目标地址支持 CORS，适用于第三方中转服务。

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

如需将此项目打包为桌面应用，推荐使用 [Tauri](https://tauri.app/) 或 [Electron](https://www.electronjs.org/)。

**推荐方案：Tauri**（体积小、性能更好）

```bash
# 安装 Tauri CLI
npm install -D @tauri-apps/cli

# 初始化 Tauri 项目
npx tauri init

# 构建桌面应用
npx tauri build
```

构建完成后，桌面应用会自动将 Next.js 静态资源打包进原生窗口，用户无需安装浏览器即可使用。

## ▲ 部署到 Vercel

🚨 *注意: 如果从 `main` 或 `master` 分支部署，你的 Vercel 部署将对任何拥有 URL 的人公开。从其他分支部署需要用户登录 Vercel（在你的团队中）才能访问。* 🚨

你可以一键部署自己的实例到 Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/alasano/gpt-image-1-playground&env=OPENAI_API_KEY,NEXT_PUBLIC_IMAGE_STORAGE_MODE,APP_PASSWORD&envDescription=OpenAI%20API%20Key%20is%20required.%20Set%20storage%20mode%20to%20indexeddb%20for%20Vercel%20deployments.&project-name=gpt-image-playground&repository-name=gpt-image-playground)

部署设置时需要输入 `OPENAI_API_KEY` 和 `APP_PASSWORD`。对于 Vercel 部署，需要设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE` 为 `indexeddb`。

注意：如果没有设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE`，应用会自动检测是否运行在 Vercel 上（通过 `VERCEL` 或 `NEXT_PUBLIC_VERCEL_ENV` 环境变量），并自动使用 `indexeddb` 模式。否则（例如本地运行），默认使用 `fs` 模式。你也可以显式设置为 `fs` 或 `indexeddb` 来覆盖自动行为。

## 🚀 快速开始 [本地部署]

按照以下步骤在本地运行。

### 环境要求

*   [Node.js](https://nodejs.org/)（需要 20 或更高版本）
*   [npm](https://www.npmjs.com/)、[yarn](https://yarnpkg.com/)、[pnpm](https://pnpm.io/) 或 [bun](https://bun.sh/)

### 1. 设置 API Key 🟢

你需要一个 OpenAI API Key 才能使用此应用。

⚠️ [你的 OpenAI 组织需要通过验证才能使用 GPT 图像模型](https://help.openai.com/en/articles/10910291-api-organization-verification)

1.  如果没有 `.env.local` 文件，请创建一个。
2.  在 `.env.local` 文件中添加你的 OpenAI API Key:

    ```dotenv
    OPENAI_API_KEY=your_openai_api_key_here
    ```

    **重要:** 妥善保管你的 API Key。`.env.local` 文件默认加入 `.gitignore` 以防止意外提交。

---

#### 🟡 (可选) IndexedDB 模式 (适合无服务器部署) [例如 Vercel]

对于文件系统只读或临时环境（如 Vercel 无服务器函数），可以配置应用将生成的图片直接保存在浏览器的 IndexedDB 中（使用 Dexie.js）。

在 `.env.local` 文件或托管提供的 UI 中（如 Vercel）设置以下环境变量：

```dotenv
NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb
```

设置此变量为 `indexeddb` 时：
*   服务端 API（`/api/images`）将返回 base64 格式（`b64_json`）的图片数据，而不是保存到磁盘。
*   客户端应用将解码 base64 数据并将图片 Blob 存储在 IndexedDB 中。
*   图片将直接通过浏览器的 Blob URL 提供。

如果此变量**未设置**或为其他值，应用默认使用标准行为，即将图片保存到服务器的 `./generated-images` 目录。

**注意：** 如果没有设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE`，应用会自动检测是否运行在 Vercel 上（通过 `VERCEL` 或 `NEXT_PUBLIC_VERCEL_ENV` 环境变量），并自动使用 `indexeddb` 模式。否则（例如本地运行），默认使用 `fs` 模式。你也可以显式设置为 `fs` 或 `indexeddb` 来覆盖自动行为。

#### 🟡 (可选) 使用自定义 API 端点

如果需要使用兼容 OpenAI API 的端点（如本地模型服务器或其他提供商），可以在 `.env.local` 文件中通过 `OPENAI_API_BASE_URL` 环境变量指定基础 URL：

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_BASE_URL=your_compatible_api_endpoint_here
```

如果未设置 `OPENAI_API_BASE_URL`，应用将使用标准 OpenAI API 端点。

---

#### 🟡 (可选) 系统设置面板 [推荐]

应用内置了**系统设置面**（右上角 ⚙️ 图标），支持通过 UI 界面直接配置所有参数，**配置实时生效，无需重启服务器**。

| 配置项 | 说明 |
|--------|------|
| **API Key** | OpenAI API 认证密钥（支持显示/隐藏切换） |
| **API Base URL** | 自定义 API 端点地址 |
| **图片存储模式** | 自动检测 / 文件系统 / IndexedDB |
| **API 连接模式** | 服务器中转（默认）/ 客户端直连 |

**配置优先级**: UI 设置 > .env 文件 > 系统默认值

---

#### 🔗 API 连接模式说明

| 模式 | 数据流 | 安全性 | 适用场景 |
|------|--------|--------|----------|
| **服务器中转** | 浏览器 → 服务器 → OpenAI | 高（API Key 不暴露） | 默认模式，所有场景 |
| **客户端直连** | 浏览器 → OpenAI API | 中（Network 面板可见） | 持 CORS 的第三方中转服务 |

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
