# Web 图像编辑器接入调研

调研日期：2026-05-28

本文评估 GPT Image Playground 是否适合接入第三方开源 Web 图像编辑器，为用户提供临时性的图片二次编辑能力。目标不是替代现有 AI 图片编辑流程，而是在生成结果、历史资产、源图和后续素材库之间增加一个快速处理层，例如裁剪、旋转、加文字/水印/贴图、涂鸦、打码、局部遮挡、简单滤镜和导出。

本次只做调研和选型建议，不涉及工程改动。

## 结论摘要

优先推荐两条路径并行规划：

1. **短期最快落地：Filerobot Image Editor**
   - 适合作为“快速编辑”入口，覆盖裁剪、调整、标注、绘制、水印、滤镜、导出。
   - MIT，仓库 2026-05 仍有提交，React 包已声明 React 19 peer dependencies。
   - 与本项目 Next + React 19 + Tauri 静态包的形态较匹配，首版可以做成客户端动态加载的弹层或独立路由。

2. **完整外部编辑器：miniPaint**
   - 适合作为“高级编辑器/外部编辑器”入口，功能接近轻量 Photoshop：图层、选区、马赛克、滤镜、文字、画笔、裁剪、内容填充、JSON 图层数据等。
   - MIT，2026-04 仍有提交，支持 iframe 嵌入；仓库代码支持 `?image=<url>` 载入远程图片，也有同源 iframe 示例可直接向图层写入 data URL。
   - 不像 React 组件，需要自托管或作为独立静态子应用接入；UI 风格、i18n 和移动体验需要验收。

长期如果希望“基础编辑能力完全融入本项目 UI”，更推荐自己用 **Cropper.js/react-easy-crop + Fabric.js 或 Konva** 做第一方轻量编辑器。这样主题、i18n、Tauri、资产保存和历史回写都最好控，但开发量比直接接入 Filerobot 更高。

不建议作为首选：

- **Toast UI Image Editor**：功能完整且最有历史知名度，但 npm 最近版本仍停在 2022，仓库最近代码提交为 2023-11，依赖 Fabric 4.x，维护风险偏高。
- **RapidRAW**：非常活跃、功能强，但是 AGPL-3.0、RAW/Lightroom 型工作流、Tauri/本地应用定位，不适合本项目的临时 Web 编辑入口。
- **IOPaint**：AI 擦除/扩图能力强，但仓库已 archived，且是 Python 后端 + 模型服务，不适合作为首个轻量 Web 编辑器。
- **marker.js 2**：标注能力简单，但采用 Linkware 许可且 README 已提示未来开发转向 marker.js 3，不适合作为主依赖。

## 项目接入约束

当前项目对第三方编辑器的关键约束：

- **跨运行时**：Web、Tauri 桌面、Tauri Android 都在范围内；不能只依赖 Next API Route，因为桌面端静态导出不能依赖 Node-only 服务行为。
- **数据安全**：生成结果、历史图片、源图、素材库图片可能包含私有内容；默认不应上传到第三方托管编辑器。
- **图片传递**：最稳妥的是在同一前端运行时内传 `Blob` / `File` / `Object URL` / `dataURL`，编辑完成后返回 `Blob` 或 data URL，再复用现有保存/发送到编辑/下载链路。
- **独立窗口/路由**：如果是外部编辑器，优先自托管到同源静态路由。跨域编辑器只能传公开 URL，容易遇到 CORS/canvas taint，也不适合私有图片。
- **Tauri**：如果涉及本地文件、系统浏览器、剪贴板或本地图片服务，后续实现必须走 `src/lib/desktop-runtime.ts` 和 Tauri command 封装。
- **性能**：大图编辑要避免首次加载阻塞；不应在 IndexedDB 升级、历史恢复或图片预览热路径上做 Blob 全量扫描。
- **产品一致性**：若嵌入到主工作台，用户可见文案要走 i18n；第三方完整编辑器作为外部工具时可以视作技术标识/外部 UI，但入口和提示仍应本地化。

## 评估维度

| 维度 | 关注点 |
| --- | --- |
| 许可证 | MIT/Apache/ISC 优先；AGPL、Linkware、商业授权要谨慎。 |
| 维护活跃度 | 以 GitHub `pushed_at`、npm 发布时间、是否 archived 为主，不单看 `updated_at`。 |
| 流行度 | GitHub stars、npm 近 30 天下载量、生态使用情况。 |
| 功能覆盖 | 裁剪、旋转、翻转、滤镜、调色、文字、形状、贴图/图标、水印、马赛克/模糊、图层、导出。 |
| 集成形态 | React 组件、Vanilla 组件、iframe/独立应用、基础 canvas 库、服务端 WebUI。 |
| 数据回传 | 是否能通过回调拿到 Blob/data URL/canvas/design state；是否能从 URL/dataURL/文件加载。 |
| 跨端风险 | Web/Tauri 静态包、移动触控、CORS、canvas taint、离线和大图性能。 |
| UI 一致性 | 是否可主题化、本地化、裁剪成工具型界面，是否会像外部产品。 |

## 核心候选对比

数据口径：GitHub 与 npm 数据均在 2026-05-28 查询；npm 下载量为 npm downloads API 的 `last-month` 近 30 天统计，随时间变化。

| 项目 | 定位 | 许可证 | 热度与活跃度 | 功能覆盖 | 接入形态 | 初步结论 |
| --- | --- | --- | --- | --- | --- | --- |
| [Filerobot Image Editor](https://github.com/scaleflex/filerobot-image-editor) | 快速图片编辑组件 | MIT | 1,813 stars；2026-05-22 pushed；`react-filerobot-image-editor` 近 30 天约 87,978 downloads | 裁剪、resize、flip、finetune、annotate、watermark、filters、undo/redo、design state | React/Vanilla/CDN；React 包 latest 为 5 beta，peer 支持 React 19 | **首选短期方案** |
| [miniPaint](https://github.com/viliusle/miniPaint) | 完整浏览器图片编辑器 | README 标 MIT；GitHub license 识别为 NOASSERTION | 3,336 stars；2026-04-20 pushed；无 npm 主包 | 图层、裁剪、文字、画笔、选区、马赛克、滤镜、内容填充、URL/dataURL/JSON 导入导出 | 独立静态应用/iframe；支持 `?image=<url>`；同源 iframe 可直接插入图层 | **首选高级外部编辑器** |
| [Toast UI Image Editor](https://github.com/nhn/tui.image-editor) | 完整图片编辑组件 | MIT | 7,638 stars；2023-11-20 pushed；npm 3.15.3，2022-05 modified，近 30 天约 118,639 downloads | 裁剪、翻转、旋转、绘制、形状、图标、文字、mask/filter、resize、undo/redo | Vanilla/React/Vue wrapper；依赖 Fabric 4.2 | 功能强但维护陈旧，**不建议新接入为主方案** |
| [Fabritor](https://github.com/sleepy-zone/fabritor-web) | Fabric.js 创意设计/图片编辑器 | MIT | 1,186 stars；2024-08-30 pushed | 文字特效、图片裁剪/滤镜、形状、画笔、二维码、emoji、导出 JPG/PNG/SVG/JSON、模板 | 独立 React 应用，中文文档，适合设计器二次开发 | 候选；更像海报/模板设计器，需评估维护节奏 |
| [Uppy Image Editor](https://uppy.io/docs/image-editor/) | 上传流程里的裁剪编辑插件 | MIT | Uppy 30,793 stars；2026-05-26 pushed；`@uppy/image-editor` 近 30 天约 838,306 downloads | 主要是裁剪/基础编辑，服务于 Uppy Dashboard | Uppy 插件，README 标 beta，依赖 `@uppy/core` | 若未来引入 Uppy 上传器可顺带用；当前不适合作为独立图片编辑入口 |
| [Fabric.js](https://github.com/fabricjs/fabric.js) | Canvas 编辑器底座 | MIT | 31,195 stars；2026-05-27 pushed；近 30 天约 3,388,643 downloads | 对象变换、图形、文本、滤镜、画笔、SVG/JSON/JPG/PNG I/O | 底层库，需要自建 UI | 适合长期做第一方轻量编辑器 |
| [Konva](https://github.com/konvajs/konva) | Canvas 交互/设计器底座 | npm MIT | 14,497 stars；2026-05-04 pushed；近 30 天约 6,429,524 downloads | 高性能图形、层、事件、拖拽、缩放、滤镜、移动端交互 | 底层库，React 生态好 | 适合标注、贴图、设计器；像素级编辑需自己补 |
| [Cropper.js](https://github.com/fengyuanchen/cropperjs) | 裁剪核心库 | MIT | 13,817 stars；2026-04-11 pushed；近 30 天约 5,903,014 downloads | 裁剪、缩放、旋转、选择框 | Web Components/Vanilla；有 React wrapper | 裁剪能力首选底座之一 |
| [react-easy-crop](https://github.com/ValentinH/react-easy-crop) | React 裁剪 UI | MIT | 2,732 stars；2026-05-22 pushed；近 30 天约 8,425,843 downloads | 拖拽、缩放、旋转、图片/视频、移动友好；输出裁剪坐标 | React 组件；需自己用 canvas 生成结果 | 若只要裁剪，落地成本很低 |
| [react-image-crop](https://github.com/dominictobias/react-image-crop) | React 裁剪 UI | ISC | 4,094 stars；2025-11-23 pushed；近 30 天约 7,489,900 downloads | 响应式、触控、固定/自由比例、键盘可访问、无依赖 | React 组件；需自己生成裁剪结果 | 轻量、a11y 好，适合简单裁剪 |
| [react-advanced-cropper](https://github.com/advanced-cropper/react-advanced-cropper) | 高可定制裁剪器 | README/npm MIT | 874 stars；2025-03-01 pushed；近 30 天约 441,959 downloads | 多种裁剪器、canvas/coordinates、zoom/rotate/resize、限制条件 | React 组件；README 提示 beta | 适合复杂裁剪 UI，但稳定性需验证 |
| [react-avatar-editor](https://github.com/mosch/react-avatar-editor) | 头像/方形裁剪 | MIT | 2,495 stars；2026-04-22 pushed；近 30 天约 3,284,477 downloads | resize、crop、rotate、圆形/方形、canvas 导出 | React 组件，支持 React 19 | 适合头像/封面小场景，不是通用图片编辑器 |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | 白板/标注/贴图 | MIT | 124,155 stars；2026-05-25 pushed；近 30 天约 1,166,310 downloads | 手绘风格形状、线条、文字、图片、导出 PNG/SVG/clipboard、i18n/dark mode | React npm package 或独立应用 | 很适合批注，不适合裁剪、滤镜、马赛克等照片编辑 |
| [Fabric Photo](https://github.com/ximing/fabric-photo) | 纯前端轻量图片编辑器 | MIT | 264 stars；2026-05-21 pushed；npm 近 30 天约 5 downloads | 图片加载、缩放、拖拽、旋转、涂鸦、线条、箭头、形状、文字、马赛克、裁剪、导出 | npm 包 + React 示例 | 功能贴近需求，但生态太小，适合观察或参考实现 |
| [mtsee/image-editor](https://github.com/mtsee/image-editor) | 国产在线图片设计器 | MIT | 614 stars；2024-05-24 pushed | 模板、多页面、素材、文字、图片裁剪、AI 抠图计划、主题切换 | 独立应用/SDK 文档 | 偏设计器，维护节奏和 npm 分发需进一步确认 |
| [swimmingkiim/react-image-editor](https://github.com/swimmingkiim/react-image-editor) | React + Konva 设计器示例 | MIT | 541 stars；2024-05-26 pushed | 导入图片、亮度/滤镜、图标、形状、文字、frame、导出 | 示例型 React app | 可参考，不建议直接作为核心依赖 |

## 深度分析

### 1. Filerobot Image Editor

来源：[GitHub](https://github.com/scaleflex/filerobot-image-editor)、[npm: react-filerobot-image-editor](https://www.npmjs.com/package/react-filerobot-image-editor)、[Demo](https://scaleflex.github.io/filerobot-image-editor/)

优点：

- 功能和本项目“临时编辑”需求高度重合：resize、crop、flip、finetune、annotate、watermark、filters、history、save customization。
- React 版本可直接嵌入工作台弹层或独立客户端路由，`source` 可传图片 URL/data URL，`onSave` 返回编辑后的图片对象和 design state。
- 2026 年仍有仓库提交；React 包 5 beta 的 peer dependencies 已要求 React/ReactDOM/react-konva `>=19.0.0`，与当前项目 React 19 方向一致。
- 支持移动和桌面，README 明确强调 touch/mobile/desktop friendly。
- MIT，商业风险低。

风险：

- React 包 latest 为 `5.0.0-beta.156`，需要验证 API 稳定性；Vanilla 包 latest `4.8.1` 更稳定但依赖 React 18 系列。
- 依赖 `react-konva`、`styled-components`、Scaleflex UI/Icon 包，会增加 bundle 和样式隔离成本。
- UI 不是项目现有设计系统，入口可以本地化，但内部工具栏文案和主题要接受第三方 UI 或单独适配。
- 滤镜/标注能力足够，但不一定覆盖强马赛克、图层式复杂编辑；高级需求仍要 miniPaint 或自研。

适配建议：

- 首版作为“快速编辑”弹层或 `/tools/image-editor` 客户端路由，使用动态 import，避免影响主工作台首屏。
- 只对当前选中图片打开，编辑完成后回写为新结果：可下载、发送到编辑源图、保存到历史/素材库。
- Web/Tauri 都优先传同源 Object URL 或 data URL，不把私有图片传到第三方托管 Demo。
- 将第三方 UI 定义成外部编辑器，不强求完全主题一致；入口、错误提示、保存动作必须走本项目 i18n。

### 2. miniPaint

来源：[GitHub](https://github.com/viliusle/miniPaint)、[在线版](https://viliusle.github.io/miniPaint/)、[README](https://github.com/viliusle/miniPaint#readme)

优点：

- 功能最完整，覆盖图层、选区、画笔、文字、马赛克、模糊/锐化、滤镜、调色、裁剪、内容填充、JSON 图层数据、PNG/JPG/BMP/WEBP/animated GIF/TIFF 导出。
- 纯浏览器运行，README 明确说明图片不发送到服务器。
- 支持 iframe 嵌入；源码 `open.js` 支持 `?image=<url>` 方式从 URL 加载图片，也提供 `examples/add-edit-imgData.html` 同源 iframe 示例，可通过 `contentWindow.Layers.insert({ data: canvas.toDataURL(...) })` 写入图层。
- 仓库 2026-04 仍有提交，历史长，功能成熟。

风险：

- 不是 React 组件，更像独立产品；要么自托管静态子应用，要么 iframe 嵌入。
- UI 风格与当前工作台差异大；移动端、暗色主题和可访问性需要实际验证。
- 用 `?image=` 传图要求图片 URL 可被 miniPaint 读取且不触发 canvas taint；本项目历史资产、IndexedDB Blob、Tauri 本地文件不能直接当作跨域 URL 传给第三方托管版。
- 如果要把编辑结果自动回写主应用，需要同源 iframe bridge、postMessage 或约定 IndexedDB/临时资产 ID；这比 Filerobot 弹层复杂。

适配建议：

- 作为“高级编辑器”单独入口，而不是默认快速编辑器。
- 优先自托管到同源静态路径，例如后续工程中打包到静态资源或子路由。Tauri 桌面静态包也要能访问。
- 传图不要依赖第三方 hosted demo；建议后续设计为 `assetId` 方案：主应用把 Blob 写到同源 IndexedDB/临时资产表，miniPaint 同源读取或通过 bridge 注入图层，保存后把 data URL/Blob 回写。
- 如果首版只做“打开外部高级编辑器”，可以先支持公开 URL 或下载后手动上传，但这不是最佳用户体验。

### 3. Toast UI Image Editor

来源：[GitHub](https://github.com/nhn/tui.image-editor)、[npm](https://www.npmjs.com/package/tui-image-editor)、[示例/API](https://nhn.github.io/tui.image-editor/latest/)

优点：

- 功能完整：Crop、Flip、Rotation、Drawing、Shape、Icon、Text、Mask Filter、Image Filter、Resize、Undo/Redo。
- MIT，stars 高，历史资料多。
- 提供 Vanilla、React、Vue wrapper。

风险：

- 维护明显落后：npm latest 仍是 3.15.3，npm modified 为 2022-05；仓库最近代码提交为 2023-11。
- 依赖 Fabric 4.2，落后于 Fabric 7.x，后续安全和兼容维护压力会落到项目自己身上。
- React wrapper 对 React 19 的兼容性需要验证，且 UI 老旧。

结论：不作为新接入首选。除非 Filerobot 在验证中出现不可接受问题，且团队能接受维护陈旧依赖，才考虑作为备选。

### 4. Fabritor / mtsee / Fabric Photo

来源：[Fabritor](https://github.com/sleepy-zone/fabritor-web)、[mtsee/image-editor](https://github.com/mtsee/image-editor)、[Fabric Photo](https://github.com/ximing/fabric-photo)

这类项目更偏“海报/封面/设计器”，而不是单张照片快速编辑。

Fabritor：

- 基于 Fabric.js，支持文字特效、图片裁剪/滤镜、形状、画笔、二维码、emoji、导出 JPG/PNG/SVG/模板 JSON。
- 中文文档和设计器思路对本项目商品图、封面、海报场景有参考价值。
- 最近代码提交停在 2024-08，维护活跃度不如 Filerobot/miniPaint/Fabric/Konva。

mtsee/image-editor：

- MIT，支持主题、素材、模板、多页面、文字/图片元素和部分 AI 能力规划。
- 更像完整在线设计工具，直接接入成本和产品边界都偏大。

Fabric Photo：

- 功能非常贴近“临时编辑”：涂鸦、线条、箭头、形状、文字、马赛克、裁剪、导出 PNG/Blob。
- 仓库 2026-05 仍有提交，但 npm 包近 30 天下载量约 5，生态和 API 稳定性风险高。

结论：这些项目适合后续参考交互和实现思路，不建议首个版本直接引入为主编辑器。

### 5. 基础库：Cropper.js、react-easy-crop、react-image-crop

来源：[Cropper.js](https://github.com/fengyuanchen/cropperjs)、[react-easy-crop](https://github.com/ValentinH/react-easy-crop)、[react-image-crop](https://github.com/dominictobias/react-image-crop)

适合只做裁剪/旋转/缩放：

- Cropper.js：通用裁剪核心，v2 使用 Web Components，活跃度高，下载量大。
- react-easy-crop：移动交互好，支持图片/视频、拖拽/缩放/旋转，输出坐标；需要自己用 canvas 生成最终图片。
- react-image-crop：非常轻，a11y 好，无依赖；更适合标准裁剪 UI。

结论：如果短期只做“裁剪并回填”，`react-easy-crop` 或 `react-image-crop` 比引入完整编辑器更轻。但用户需求包含水印、贴图、打码等，单独裁剪库不足以覆盖完整场景。

### 6. 基础库：Fabric.js 和 Konva

来源：[Fabric.js](https://github.com/fabricjs/fabric.js)、[Konva](https://github.com/konvajs/konva)

适合作为第一方轻量编辑器底座：

- Fabric.js 更偏对象编辑和图片/滤镜/SVG/JSON I/O，适合做照片上的文字、水印、贴图、形状、导出。
- Konva 更偏高性能交互图形、图层和移动事件，适合设计器、标注、拖拽、缩放、贴图。
- 两者都需要自己实现工具栏、属性面板、i18n、主题、历史栈和导出流程。

结论：如果项目中期想把“基础编辑”沉淀为原生能力，优先评估 Fabric.js，因为它的图片滤镜、对象序列化和 SVG/PNG/JPG I/O 更贴近图像编辑；Konva 适合作为标注/设计器交互底座。

### 7. Excalidraw

来源：[GitHub](https://github.com/excalidraw/excalidraw)、[npm](https://www.npmjs.com/package/@excalidraw/excalidraw)

优点：

- 极高热度和活跃度，MIT，React 包支持 React 17/18/19。
- 支持图片、形状、线条、手绘风格、i18n、dark mode、导出 PNG/SVG/clipboard。
- 如果用户想“在图上画箭头、圈重点、写说明”，体验很好。

风险：

- 它不是照片编辑器：不做真实裁剪、滤镜、马赛克、像素级打码。
- 输出更像白板合成图，可能改变图片编辑的语义。

结论：不作为通用图像编辑器，但可以作为“图片批注/讲解图”独立能力候选。

### 8. AI/专业编辑器：IOPaint 和 RapidRAW

来源：[IOPaint](https://github.com/Sanster/IOPaint)、[RapidRAW](https://github.com/CyberTimon/RapidRAW)

IOPaint：

- 功能强：AI 擦除、替换对象、扩图、文字绘制、背景移除、超分、修复等。
- 但仓库已 archived，且需要 Python 后端和模型下载，不适合作为本项目首个 Web 临时编辑器。

RapidRAW：

- 非常活跃，定位类似 Lightroom，支持 RAW、非破坏式编辑、GPU/WGPU、批量、遮罩、调色、导出、水印等。
- 许可证 AGPL-3.0，且是 Tauri/本地应用工作流，不适合直接嵌入本项目 Web/Tauri 静态包。

结论：两者都不适合作为当前第三方 Web 编辑器接入；IOPaint 可作为未来“AI 擦除服务”单独调研，RapidRAW 可作为专业照片调色方向参考。

## 推荐方案分层

### P0：快速编辑入口

推荐：**Filerobot Image Editor**

目标能力：

- 从生成结果、历史预览、全屏预览、源图缩略图打开。
- 编辑：裁剪、旋转/翻转、resize、亮度/对比等微调、文字/形状/涂鸦、水印、简单滤镜。
- 保存：生成一个新图片 Blob，允许下载、发送到编辑源图、保存到历史或素材库。

为什么不是 Toast UI：

- Toast UI 功能也满足，但维护状态落后；Filerobot 在 2026 年仍有提交，React 19 包也更贴近当前项目。

### P1：高级外部编辑器

推荐：**miniPaint 自托管**

目标能力：

- 入口命名为“高级编辑器”或“在 miniPaint 中打开”。
- 支持图层、马赛克、复杂滤镜、内容填充、JSON 图层数据。
- 用同源 bridge 或临时资产 ID 传图和回写，不使用第三方 hosted demo 处理私有图片。

适用场景：

- 用户需要一次性做较复杂的像素和图层编辑。
- 项目不希望短期自研 Photoshop-like 功能。

### P2：第一方轻量工具

推荐组合：

- 裁剪：`react-easy-crop` 或 `Cropper.js`
- 水印/贴图/文字/形状/打码：`Fabric.js`
- 标注/白板式批注：可评估 `Excalidraw` 或基于 `Konva` 自建

适用场景：

- 需要完全遵守项目主题、i18n、移动布局和 Tauri 存储规则。
- 希望编辑能力与未来素材库、历史资产、批量任务深度融合。

## 数据传递方案建议

### 方案 A：同页面组件

适用：Filerobot、Cropper、Fabric/Konva 自研。

流程：

1. 主应用把图片 Blob/File 转为 Object URL 或 data URL。
2. 编辑器组件加载图片。
3. 保存时拿到 Blob/data URL/canvas。
4. 复用现有下载、发送到编辑、历史/素材库保存逻辑。

优点：Web/Tauri 最稳，隐私最好，CORS 风险最低。

缺点：第三方 UI 进入主应用，需要处理样式、i18n 和 bundle。

### 方案 B：同源独立路由或 iframe

适用：miniPaint、Fabritor、mtsee 这类完整外部编辑器。

流程：

1. 主应用将图片写入临时资产表或 IndexedDB。
2. 打开 `/tools/advanced-image-editor?assetId=...`。
3. 子编辑器通过同源 bridge 读取图片 Blob，或父窗口用 postMessage/dataURL 注入。
4. 保存时子编辑器把结果写回 IndexedDB 或 postMessage 给 opener。

优点：隔离复杂 UI，静态部署可控，适合高级编辑器。

缺点：需要设计 bridge；Tauri 静态包也要包含该路由和资源；跨窗口对象 URL 不能直接复用。

### 方案 C：第三方托管外链

适用：只编辑公开图片，或用户手动上传/下载。

流程：

1. 打开第三方 hosted editor。
2. 如果图片有公开 URL 且允许 CORS，可传 URL；否则用户手动上传。
3. 用户手动下载结果再导入项目。

优点：工程成本低。

缺点：隐私、CORS、回写体验和 Tauri 离线体验都差。对本项目不推荐作为默认路径。

## 风险与验证清单

后续进入工程前建议至少验证：

- Filerobot 在 React 19、Next 16 客户端组件、Tauri WebView 中是否正常加载。
- Filerobot 5 beta 的 API 是否稳定，是否能固定版本，是否有非预期远程请求。
- miniPaint 自托管后，`?image=`、同源 iframe `Layers.insert`、导出 data URL/Blob 的可行性。
- 大图（例如 4096px、10MB、透明 PNG、WebP）在 Web、Tauri 桌面、移动浏览器中的内存和响应。
- CORS/canvas taint：远程 URL、对象存储 URL、Tauri 本地图片服务 URL 是否能安全导出。
- 入口文案、保存结果、错误提示是否覆盖所有 i18n 语言。
- 编辑结果是否要新增历史记录、覆盖原图、作为源图继续编辑，还是只下载。
- 第三方依赖许可证是否能进入当前项目分发包，尤其避免 AGPL/Linkware 误引入。

## 最终建议

建议产品路线：

1. **首版接 Filerobot Image Editor**，作为“快速编辑”能力，覆盖 80% 临时编辑需求。
2. **并行保留 miniPaint 方案设计**，作为“高级编辑器”后续接入，重点解决同源自托管和图片回写桥接。
3. **不要用 Toast UI Image Editor 做新主线**，除非 Filerobot 验证失败。
4. **未来第一方轻量编辑器优先考虑 Fabric.js + 裁剪库**，将常用能力沉淀到项目自己的主题、i18n、历史和素材体系内。

## 来源与检索摘要

主要来源：

- GitHub 仓库与 README：Filerobot、miniPaint、Toast UI Image Editor、Fabritor、Cropper.js、Fabric.js、Konva、Excalidraw、react-easy-crop、react-image-crop、react-advanced-cropper、react-avatar-editor、Uppy、Fabric Photo、mtsee/image-editor、swimmingkiim/react-image-editor、IOPaint、RapidRAW、marker.js 2。
- npm registry：版本、许可证、peer dependencies、近 30 天下载量。
- 项目本地资料：`AGENTS.md`、`package.json`、`docs/generation-editing.md`、`docs/requirements/README.md`、相关历史/资产/同步规划文档。

搜索摘要：

- 网站：opencli gemini | 查询词：开源 Web 图像编辑器/图片编辑组件、2026、功能/许可证/维护/集成难度 | 次数：1 | 结果：90 秒内未返回内容，未继续重试。
- 网站：GitHub API / `gh api` / `gh search code` | 查询词：候选仓库元数据、README、license、`web image editor`、`image editor react`、miniPaint `?image`/iframe 能力 | 次数：多次一手校验。
- 网站：npm registry / npm downloads API | 查询词：候选 npm 包版本、许可证、peerDependencies、last-month downloads | 次数：多次一手校验。
