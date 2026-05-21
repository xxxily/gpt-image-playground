---
title: GPT Image Playground 视频生成需求文档 v2
summary: 基于当前仓库实现状态重整视频生成需求，并与统一供应商配置复用需求对齐，明确视频能力依赖统一端点/模型目录后再补齐高级选项、历史、同步和运行时闭环。
createdAt: 2026-05-21
updatedAt: 2026-05-21
status: draft-requirement
---

# GPT Image Playground 视频生成需求文档 v2

## 1. 目的

旧版视频需求文档写得偏早，里面有不少“应该会有”的内容，和当前仓库代码已经落地的能力不完全一致。
这份 v2 的目标不是继续扩写愿景，而是把现状重新梳理清楚，形成可执行的闭环需求。

本版只保留三件事：

1. 明确当前已经实现了什么。
2. 明确哪些地方只是半成品。
3. 明确下一步必须补齐的任务。

## 2. 与统一供应商配置需求的关系

视频功能不能再新增一套独立供应商配置。后续实施顺序必须是：

1. 先完成 `UNIFIED_PROVIDER_CONFIGURATION_REUSE_REQUIREMENTS.md` 的统一供应商与模型配置改造。
2. 再推进本视频需求文档里的视频高级选项、历史、同步和适配器闭环。

本需求中的“视频供应商 / 视频模型设置”不是指新增 `videoProviderInstances`，而是指在统一配置里增加：

- 支持视频能力的 `ProviderEndpoint`。
- 支持 `video.generate`、`video.imageToVideo`、后续 `video.edit`、`video.extend`、`video.referenceToVideo` 的 `ModelCatalogEntry`。
- `modelTaskDefaultCatalogEntryIds['video.generate']` 和 `modelTaskDefaultCatalogEntryIds['video.imageToVideo']` 的默认绑定。
- 视频任务默认参数和同步策略。

## 3. 当前代码事实

### 3.1 已经落地的部分

| 模块 | 现状 | 结论 |
| --- | --- | --- |
| 工作台入口 | `src/components/editing-form.tsx` 已有统一的视频按钮，内部会在 `text-to-video` 与 `image-to-video` 间切换。 | 入口已经存在，当前不是两个独立按钮。 |
| 执行链路 | `src/lib/video-executor.ts`、`src/hooks/useVideoTaskManager.ts`、`src/app/api/video/*` 已存在，包含提交、轮询、下载、取消、恢复和历史写入。 | 任务引擎和 Web 中转路由已经起步。 |
| 视频数据结构 | `src/lib/video-types.ts` 已定义任务模式、状态、资产引用、历史元数据、任务默认值和同步选项。 | 数据模型已经预留完整。 |
| 统一目录 | `src/lib/provider-model-catalog.ts` 已扩展 `video.generate`、`video.imageToVideo` 等能力与视频协议。 | 视频必须继续走统一目录，不应再建并行 registry。 |
| 视频输出 | `src/components/video-output.tsx` 已有视频结果面板。 | 结果展示壳子已存在。 |
| 本地存储 | `src/lib/video-history.ts`、`src/lib/video-job-store.ts`、`src/lib/video-asset-store.ts` 已存在。 | 本地历史、任务、资产三层存储已经有基础。 |

### 3.2 只做到一半的部分

| 模块 | 现状 | 问题 |
| --- | --- | --- |
| 高级选项 | 视频模式下仍然会落到图片相关的选择器分支。 | 视频任务没有自己的供应商 / 模型选择面。 |
| 设置页 | `videoTaskDefaults`、`videoSyncOptions` 已进配置结构，但设置 UI 里只露了轮询、默认时长、保存历史、自动下载等少数项。 | 没有真正的视频供应商 / 模型配置入口。 |
| 供应商覆盖 | `src/lib/video-providers/bootstrap.ts` 只真正注册了少数适配器，其余是占位协议。 | 占位协议不能当作已完成产品能力对外呈现。 |
| 历史持久化 | 视频历史会写入本地，但工作台历史面板没有视频 tab。 | 数据有了，产品闭环没接上。 |

### 3.3 仍然缺失的部分

1. 视频模式的专属高级选项。
2. 统一供应商配置中的视频默认模型入口。
3. 视频历史 tab 与详情页。
4. 视频同步策略在 UI 和恢复链路上的完整接入。
5. 真实适配器和占位适配器的产品级区分。

## 4. 旧版文档与当前现状的偏差

v1 文档有几个地方现在需要纠正：

1. 旧版把首批很多视频厂商写成了“P0 已接入”，但当前代码里真正完成实现的只有少数适配器，其余大多还是占位协议。
2. 旧版默认视频历史、同步、设置、供应商选择都已经闭环，但现在实际上只完成了数据和引擎层，UI 还没补齐。
3. 旧版更像架构愿景，v2 必须变成“按当前代码推进的任务清单”。

## 5. 需求原则

1. 视频只保留一个对外入口按钮，不拆成“文生视频”和“图生视频”两个独立按钮。
2. 按钮不应进入禁用态，内部模式由当前输入和可用资产自动解析。
3. 视频必须继续使用统一供应商模型目录，不新增独立的视频 registry。
4. 视频配置不能再依赖一套平行的 `videoProviderInstances` 之类结构，也不能在视频设置区重复录入 API Key / Base URL。
5. 视频历史、视频资产、视频任务要分层存储，元数据和大文件分开处理。
6. Web 与 Tauri 走各自可用路径，但行为要一致。
7. 任何占位适配器都只能算“协议预留”，不能当成可交付能力。

## 6. 视频供应商范围

视频供应商进入统一目录时，至少需要覆盖下面的协议池。是否默认展示由适配器完成度决定；未完成适配器只能显示为“占位 / 待实现”。

| 供应商 | 统一目录要求 | 首版任务能力 | 适配器状态 |
| --- | --- | --- | --- |
| OpenAI Sora | `provider: openai`，`protocol: openai-videos` | `video.generate`、`video.imageToVideo` | 已有真实适配器 |
| 阿里 DashScope / Wan | `provider: aliyun-dashscope`，`protocol: dashscope-video-generation` | `video.generate`、`video.imageToVideo` | 已有真实适配器 |
| Google Veo | `provider: google-gemini` / `google-vertex-ai`，`protocol: gemini-generate-videos` / `vertex-ai-veo` | `video.generate`、`video.imageToVideo` | 占位 |
| Runway | `provider: runway`，`protocol: runway-api-v1` | `video.generate`、`video.imageToVideo`，后续视频编辑 | 占位 |
| Luma | `provider: luma`，`protocol: luma-dream-machine` | `video.generate`、`video.imageToVideo` | 占位 |
| MiniMax | `provider: minimax`，`protocol: minimax-video` | `video.generate`、`video.imageToVideo` | 占位 |
| 可灵 Kling | `provider: kling`，`protocol: kling-api` | `video.generate`、`video.imageToVideo` | 占位 |
| 字节 Seedance / ModelArk | `provider: byteplus-modelark`，`protocol: modelark-video-generation` | `video.generate`、`video.imageToVideo` | 占位 |
| 腾讯混元 / TokenHub | `provider: tencent-hunyuan-video` / `tencent-tokenhub`，`protocol: tencent-vclm` / `tencent-tokenhub-video` | `video.generate`、`video.imageToVideo` | 占位 |
| fal.ai / Happy Horse | `provider: fal`，`protocol: fal-model-api` | `video.generate`、`video.imageToVideo`，后续参考视频 | 占位 |
| xAI Grok Imagine | 新增 `provider: xai`，新增 `protocol: xai-imagine-video` | `video.generate`、`video.imageToVideo`，后续 `video.edit`、`video.extend`、`video.referenceToVideo` | 新增待实现 |

xAI Grok Imagine 的官方文档显示 `grok-imagine-video` 支持文本生成视频、图片生成视频、参考图视频、视频编辑和视频扩展，采用提交请求后轮询结果的异步模式，结果 URL 为临时地址。实现时必须把 `xai` 作为正式供应商种类纳入统一目录，而不是放进 OpenAI-compatible 的兜底协议。

参考入口：

- <https://docs.x.ai/developers/model-capabilities/imagine>
- <https://docs.x.ai/developers/models/grok-imagine-video>

## 7. 需求任务

### 7.1 工作台视频高级选项接线

**目标**

视频模式进入高级选项时，应该显示视频专属的供应商和模型选择，而不是图片供应商和图片配置。

**要求**

1. 视频模式必须根据 `video.generate` / `video.imageToVideo` 能力筛选模型。
2. 文生视频和图生视频共用一个视频入口，但内部默认模式要根据是否存在源图自动切换。
3. 如果没有源图，默认走文生视频。
4. 如果有源图，默认走图生视频。
5. 选中的视频模型必须驱动正确的端点、默认参数和能力显示。
6. 图片专属参数在视频模式下必须隐藏，不得混进来。
7. 供应商和模型选择控件必须复用统一供应商配置改造后的通用组件，不在视频表单里复制一套端点管理逻辑。

**验收**

- 视频模式下看不到图片供应商选择器。
- 视频模式下能看到视频模型与视频参数。
- 移动端和桌面端都不会出现按钮挤压或内容溢出。

### 7.2 统一配置中的视频默认项补齐

**目标**

统一供应商设置页要能配置视频任务默认模型；视频任务设置区只保留任务参数，不重复录入凭证。

**要求**

1. 在统一供应商 / 模型配置中增加视频默认模型绑定。
2. 至少暴露 `video.generate` 和 `video.imageToVideo` 两个默认模型入口。
3. 暴露视频默认时长、默认宽高比、默认分辨率档位、默认提示词增强、默认原生音频。
4. 暴露视频轮询间隔、最大轮询时长、失败重试次数、是否自动下载、是否保存历史。
5. `videoSyncOptions` 必须在设置页可见，并支持视频历史、源图、缩略图、视频文件的独立开关。
6. 所有旧配置字段缺失时必须回退到安全默认值。
7. 视频供应商新增、编辑、模型发现、模型能力标注全部归属 `UNIFIED_PROVIDER_CONFIGURATION_REUSE_REQUIREMENTS.md` 的“供应商与模型”页面。

**验收**

- 关闭 / 打开设置后值能正确恢复。
- 旧配置不影响现有图片、图生文功能。
- 设置页不再只显示“视频默认时长”和轮询项，也不出现重复的 API Key / Base URL 输入。

### 7.3 视频历史 tab 与详情闭环

**目标**

历史面板要有第三个视频 tab，和图片、图生文并列。

**要求**

1. `HistoryPanel` 需要新增 `video` tab，默认仍停留在图片 tab。
2. 视频列表项需要展示封面 / 缩略图、任务类型、供应商、模型、时长、状态和创建时间。
3. 视频详情需要支持播放、下载、复制提示词、复制任务 ID、重新生成、恢复到工作台。
4. 视频历史里的源图和结果图不能和图片历史混淆。
5. 视频 tab 的多选、批量操作状态必须独立于图片 tab 和图生文 tab。

**验收**

- 历史里能看到视频记录。
- 视频结果能直接播放。
- 视频记录能回到工作台重跑。

### 7.4 视频任务、资产与同步闭环

**目标**

视频数据要形成完整闭环：提交、轮询、完成、落盘、恢复、同步、恢复同步。

**要求**

1. 本地只把元数据放在 localStorage 或等价轻量存储。
2. 视频文件、缩略图、spritesheet、源图必须走独立资产存储。
3. 恢复时先恢复元数据和缩略图，不强制一次性拉回所有大视频文件。
4. 同步策略必须支持只同步元数据、只同步缩略图、同步最近视频文件、同步全部视频文件。
5. 大文件同步必须有大小上限和最近范围限制。
6. 任务恢复逻辑必须支持刷新页面后继续轮询。

**验收**

- 刷新后还能恢复轮询中的视频任务。
- 视频历史和资产可分层恢复。
- 没有大文件时，历史元数据仍可正常浏览。

### 7.5 供应商适配器分层

**目标**

把“已经真的能用”和“只是协议占位”分开。

**要求**

1. 现在的真实实现必须明确标注，只把已完成的适配器当作默认可选项。
2. 占位协议只能出现在“待实现 / 占位”区域，不能伪装成完整接入。
3. 后续新增供应商时，必须先进入统一目录，再补适配器，再接入设置和历史。
4. 官方源和聚合平台必须在 UI 上明确区分。

**当前状态**

- 已实现：`openai-videos`、`dashscope-video-generation`
- 占位预留：`gemini-generate-videos`、`vertex-ai-veo`、`runway-api-v1`、`luma-dream-machine`、`minimax-video`、`kling-api`、`modelark-video-generation`、`tencent-vclm`、`tencent-tokenhub-video`、`fal-model-api`
- 新增待接入：`xai-imagine-video`

### 7.6 工具栏与可见性

**目标**

视频入口要在提示词工具栏里稳定可见，不被其他按钮挤掉。

**要求**

1. 工具栏宽度不足时，要优先保证视频按钮可见。
2. 模板按钮可以作为低优先级项先隐藏。
3. PC 端和移动端都要支持横向滑动或等价的溢出处理。
4. 按钮可见性继续走现有设置，不要新增一套平行逻辑。

## 8. 数据约束

1. `VideoHistoryMetadata` 需要保留任务模式、供应商端点、模型、源图、结果资产、参数和同步状态。
2. `VideoGenerationJob` 需要保留 provider job id、进度、远端结果地址、过期时间和错误信息。
3. `VideoTaskDefaults` 负责轮询与默认参数。
4. `VideoSyncOptions` 负责视频历史和大文件同步策略。
5. 大资产不得直接写进分享链接，也不得进明文日志。
6. 新增 Grok/xAI 时，`ProviderKind` 需要增加 `xai`，`ProviderProtocol` 需要增加 `xai-imagine-video`，模型目录内置项至少包含 `grok-imagine-video`。

## 9. 运行时边界

1. Web 路径继续使用 `src/app/api/video/*`。
2. Tauri 路径继续使用桌面代理，不允许共享模块直接依赖 Tauri API。
3. 公网 Web 不能静默访问私网、localhost 或不安全的回调地址。
4. 直连模式和代理模式都要保留。
5. 任何 API Key 都必须遮蔽。

## 10. 实施顺序

1. 先完成统一供应商配置复用需求：统一端点管理、统一模型目录、任务默认模型矩阵、图生文 / 润色迁移。
2. 在统一配置中预留视频任务默认行：`video.generate`、`video.imageToVideo`，并补充 `xai` / `xai-imagine-video` 类型。
3. 再实现本视频文档的工作台高级选项接线，直接复用统一配置产物。
4. 然后补齐视频历史、同步、任务恢复和真实适配器。

如果跳过第 1 步直接做视频设置，后续统一供应商配置落地时会再次改动视频供应商选择、默认模型保存、配置迁移和工作台高级选项。

## 11. 验收标准

1. 选择视频后，高级选项不再显示图片供应商配置。
2. 设置页能配置视频默认模型和视频同步策略。
3. 历史页出现视频 tab，并能播放 / 下载 / 复用视频。
4. 任务刷新后仍能恢复视频轮询。
5. Web 和 Tauri 的行为一致。
6. 亮色 / 暗色、移动端 / 桌面端都不溢出、不重叠、不掉按钮。
7. 视频默认模型来自统一供应商配置，不存在第二套视频 API Key / Base URL 配置。
8. Grok/xAI 作为可规划供应商进入统一目录，未实现前不会伪装成可用适配器。

## 12. 结论

v2 的核心不是“再写一遍视频愿景”，而是把当前已经存在的代码骨架补成闭环：

- 统一视频入口已经有了。
- 执行器和 API 路由已经有了。
- 数据模型和本地存储已经有了。
- 真正缺的是视频专属设置、视频专属高级选项、视频历史 tab、同步闭环，以及对真实适配器和占位适配器的清晰分层。
- 在实施层面，统一供应商配置复用是视频配置闭环的前置任务。
