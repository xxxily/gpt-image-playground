<div align="center">
  <img src="./public/favicon.svg" alt="GPT Image Playground Logo" width="120" height="120" />
  <h1>GPT Image Playground</h1>
  <p>一个可自托管、多供应商、跨设备同步的 AI 图像创作工作台。</p>
</div>

<div align="center">

[![Docs](https://img.shields.io/badge/docs-user%20manual-4A90E2?logo=gitbook&logoColor=white)](./docs/README.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/xxxily/gpt-image-playground?style=social)](https://github.com/xxxily/gpt-image-playground)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Self-hosted](https://img.shields.io/badge/self--hosted-ready-2E7D32)](./docs/desktop-and-deployment.md)

</div>

---

GPT Image Playground 是一个面向创作者、运营、设计师和产品团队的 AI 图像工作台。它不只是一个文生图页面，而是把图片生成、图片编辑、提示词资产、历史资产、多供应商模型、分享协作和跨设备同步组织在同一个可持续使用的工作流里。

![工作台总览](./docs/images/overview-workbench.png)

## 项目特色

- **不把创作流程绑死在某一家服务商上**：内置 OpenAI Compatible、Google Gemini、Seedream、SenseNova 等图片供应商，也支持为同一类供应商保存多个命名端点。官方 API、第三方中转、团队网关和自托管兼容服务可以并存，任务提交时直接切换。
- **可以完全自托管，做自己的私人生图工作台**：支持本地运行、服务器部署、Vercel 部署和 Tauri 桌面端。API Key、供应商端点、历史记录、提示词模板和同步方式都由你自己掌控，适合个人长期使用，也适合团队内部部署。
- **从提示词到资产沉淀是一条完整链路**：模板库、`/` 快速搜索、提示词历史、一键润色、批量规划、参考图编辑、蒙版、历史预览、费用估算、下载和继续编辑都在同一个工作台里，不需要在多个工具之间反复搬运素材。
- **移动端也能流畅使用**：界面按触摸和窄屏重新组织，设置、历史、源图、工作空间和素材面板会在小屏幕上自然收拢，适合在手机或平板上查看结果、改提示词、继续编辑和同步。
- **分享和同步可控**：可以只分享提示词和模型，也可以按需分享端点、临时 API 配置或云同步配置；支持密码加密分享、短链、临时使用和批量能力限制。跨设备同步基于 S3 兼容对象存储，配置和历史可以跟着你走。
- **适合长期迭代，而不是只生成一次**：工作空间、历史资产、源图顺序、任务队列、模型能力管理和桌面本地存储，让商品图、活动图、角色设定、品牌视觉等反复修改的任务更容易沉淀和复用。

## 它解决什么问题

当你需要反复产出商品图、封面图、活动 KV、风格稿、角色设定、社媒素材或参考图编辑时，单次生成页面很快会变得不够用。这个项目把常用能力做成一个完整工作台：

- **从文字生成图片**：输入提示词，选择模型、数量、尺寸、质量和输出格式。
- **用参考图继续编辑**：上传、拖入、粘贴或从历史发送图片到编辑区，继续改图、换风格、做局部调整。
- **文生视频 / 图生视频**：通过提示词工具栏切换到视频模式，把文字创意或参考图延展成动态素材；已配置的视频端点会进入同一套模型和任务流程。
- **管理提示词资产**：内置多行业模板库，支持 `/` 快速搜索、提示词历史、一键润色、自定义模板、导入导出。
- **管理生成资产**：历史面板记录图片、模型、参数、耗时、提示词、费用估算和多图结果，支持预览、下载、多选和继续编辑。
- **连接多个模型供应商**：内置 OpenAI Compatible、Google Gemini、Seedream、SenseNova，也可以为同一供应商保存多个命名端点。
- **把工作流分享给别人或自己的新设备**：分享提示词、模型、端点配置，支持密码加密链接；Web 端默认对分享页做 DevTools 抑制，也可以按环境变量调整，进一步降低 key 被直接拷走的风险；也支持通过 S3 兼容对象存储同步配置、提示词、历史和图片。
- **本地、Web、桌面多种使用方式**：可自托管、Vercel 部署，也可构建 Tauri 桌面应用。

## 适合谁使用

- **内容运营**：批量做小红书封面、短视频封面、节日物料、活动预告图。
- **电商团队**：生成商品主图、场景图、卖点图、材质细节图、套装陈列图。
- **设计师与品牌团队**：快速探索 KV、海报、包装方向、风格迁移和提案视觉。
- **游戏与创意团队**：制作角色、道具、场景、卡牌和世界观概念图。
- **开发者和自托管用户**：把多个兼容端点、模型能力、存储和同步集中配置。

## 快速上手

1. 打开应用，点击右上角 **Settings**。
2. 在 **供应商与模型** 中填入你要使用的 API Key 和 Base URL。只使用官方 OpenAI 时，Base URL 可以留空。
3. 回到主界面，在提示词框输入需求，或点击 **提示词模板** 从模板库选择。
4. 点击 **高级** 选择供应商、模型、尺寸、质量、输出格式等参数。
5. 点击 **开始生成**。结果会显示在输出区，并自动进入右侧历史。
6. 需要继续改图时，点击图片上的 **编辑**，或在历史预览中发送到编辑区。

详细步骤请阅读 [快速开始](./docs/getting-started.md)。

## 文档入口

文档按用户手册组织，根 README 只保留概要。按你的使用场景阅读：

- [文档首页](./docs/README.md)：所有用户手册入口。
- [快速开始](./docs/getting-started.md)：第一次打开应用时应该怎么配置和生成第一张图。
- [工作台界面说明](./docs/workspace.md)：主界面、输出区、历史区、全屏预览、拖拽粘贴和任务队列。
- [生成与编辑图片](./docs/generation-editing.md)：文生图、参考图编辑、蒙版、流式预览、Seedream/SenseNova 等高级参数。
- [提示词工作流](./docs/prompt-workflow.md)：模板库、`/` 搜索、历史、一键润色、自定义模板。
- [历史与资产管理](./docs/history-and-assets.md)：查看、下载、多选、费用、继续编辑和存储模式。
- [供应商与系统设置](./docs/providers-and-settings.md)：多供应商端点、自定义模型、运行参数、密码和桌面端设置。
- [分享与云同步](./docs/sharing-and-sync.md)：普通分享、加密分享、S3 兼容对象存储同步与恢复。
- [安装、部署与桌面端](./docs/desktop-and-deployment.md)：本地运行、Vercel、自托管、Tauri 桌面应用和常用环境变量。
- [需求与规划文档](./docs/requirements/README.md)：产品需求、技术调研和阶段规划。

## 界面预览

| 提示词模板库                                               | 高级选项                                        |
| ---------------------------------------------------------- | ----------------------------------------------- |
| ![提示词模板库](./docs/images/prompt-template-library.png) | ![高级选项](./docs/images/advanced-options.png) |

| 供应商设置                                          | 分享链接                                    |
| --------------------------------------------------- | ------------------------------------------- |
| ![供应商设置](./docs/images/settings-providers.png) | ![分享链接](./docs/images/share-dialog.png) |

## 本地运行

```bash
npm install
npm run dev
```

然后访问 <http://localhost:3000>。

Node.js 需要 20 或更高版本。更多部署、桌面端打包和环境变量说明见 [安装、部署与桌面端](./docs/desktop-and-deployment.md)。

## 许可证

MIT
