---
title: GPT Image Playground 文生视频与图生视频需求文档
summary: 在已落地的统一供应商模型目录、图生文链路和云同步基础上，新增文生视频与图生视频两条一等任务模式。覆盖官方 API 文档入口、首批同时支持的官方供应商、统一目录的视频能力扩展、提示词入口、异步任务生命周期、视频结果与历史、云同步、分享与跨运行时实现边界。
createdAt: 2026-05-16
updatedAt: 2026-05-17
status: draft-requirement
---

# GPT Image Playground 文生视频与图生视频需求文档

## 1. 背景

项目当前已经覆盖两条一等能力线，并已在 v2.10.0 完成统一基础设施：

- 文生图/图像编辑：以图片生成模型、源图、蒙版、输出图片和图片历史为核心。
- 图生文：以源图、多模态文本模型、文本输出、图生文历史和源图资产同步为核心（v2.9.0 上线，v2.10.0 历史升级）。
- 统一供应商模型目录：`ProviderEndpoint` + `ModelCatalogEntry` + `ModelTaskCapability` 已经把图片生成、图生文、提示词润色按供应商-端点-能力维度统一管理（v2.10.0 上线，详见 `src/lib/provider-model-catalog.ts`）。
- 桌面端 Rust 请求代理：`proxy_images`、`proxy_image_to_text`、`proxy_remote_image`、`proxy_provider_models` 等命令已落地（详见 `src-tauri/src/proxy/commands.rs`）。
- 云同步：`SnapshotManifest` 已支持 `imageHistory` 与 `visionTextHistory` 双轨同步，配套图片资产分桶（详见 `src/lib/sync/manifest.ts`）。

下一阶段扩展到视频生成时，不能把视频当成"更大的图片结果"简单塞入现有图片链路。视频模型通常具有更长的异步任务生命周期、更大的输出资产、更复杂的参考输入、更强的模型差异，以及更严格的内容与人物限制。因此本需求把视频作为第三个一等能力域设计：

- `text-to-video`：文本提示词生成视频。
- `image-to-video`：一张或多张图片作为首帧、尾帧、参考图或主体参考，生成视频。
- 后续预留 `video-edit`、`video-extend`、`reference-to-video`、`audio-to-video`、`character-to-video` 等能力，不在首版全部实现。

视频域必须复用统一目录、复用桌面 Rust 代理、复用云同步骨架，新增的 only 是视频专属能力槽位、异步任务管理器、视频历史与视频专属同步策略。

## 2. 目标

### 2.1 产品目标

1. 在工作台中新增「文生视频」和「图生视频」任务模式，并与文生图、图像编辑、图生文并列。
2. 一次性把所有列入文档的官方供应商接入到统一目录中，避免逐家集成时重复返工统一规划（具体名单见 §4）。
3. 系统设置支持视频供应商端点、视频模型、默认参数、任务轮询、视频资产保存和云同步策略。
4. 提示词输入区域新增视频相关入口按钮，点击后保持当前位置和主操作习惯，但切换任务语义、参数和输出面板。
5. 视频生成支持异步任务：提交、排队、进度轮询、取消、失败、恢复轮询、完成后下载/缓存结果。
6. 新增视频输出面板和视频历史 tab，支持视频播放、缩略图、下载、复制提示词、复用源图、重新生成、恢复任务。

### 2.2 技术目标

1. 视频能力必须以「扩展统一目录」的方式落地，不新建并行的供应商或模型注册中心。
2. 视频历史进入云同步体系，元数据、源图、缩略图和视频文件分别可控同步。
3. Web、Tauri 桌面、Tauri 移动/Android 都需要有可用路径，桌面静态导出不能依赖 Next.js API Route。
4. 视频专属的高内存/长任务路径不能阻塞首屏、拖拽、提示词输入与历史浏览。
5. 所有 UI 文案必须按 §17 通过 i18n 系统在 `zh-CN` 与 `en-US` 同时落地。

## 3. 非目标

- 不在首版实现完整视频剪辑时间线、字幕编辑器、音轨混音器或多镜头剪辑工程。
- 不把视频模型混入图片模型下拉；视频模型只在视频任务里展示。
- 不默认接入没有官方或明确授权 API 来源的第三方包装服务。
- 不默认同步大体积视频文件；视频文件同步必须有单独开关、大小限制和最近范围。
- 不自动把用户本地图片上传到第三方服务，必须在提交视频任务时由用户明确触发。
- 不在 Web 端绕过已有 URL 安全策略访问 localhost、私网地址或不可信回调地址。
- 不在首版实现服务端 Webhook 回调；首版只走轮询，Webhook 留给 P2 服务端部署形态。

## 4. 官方 API 文档入口与首批集成名单

以下链接用于需求和后续实现阶段定位官方或准官方开发者文档。本文档只记录入口和集成判断，不复制各厂商完整 API 参数。

检索时间：2026-05-17。

按用户决策，**首批所有列入下表的官方供应商均为 P0**，统一在视频骨架完成后并入 `provider-model-catalog`，不区分接入优先级。差异留在每个适配器的实现细节里，不在需求层做厂商分级。

| 厂商/模型 | 文档入口 | 当前主力模型（截至 2026-05-17） | 覆盖能力 | 接入备注 |
| --- | --- | --- | --- | --- |
| Google Veo | [Gemini API: Generate videos with Veo](https://ai.google.dev/gemini-api/docs/video)，[Vertex AI: Generate videos with Veo](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/overview) | `veo-3.1-generate-001`、`veo-3.1-fast-generate-001`（Preview）；`veo-3.0-generate-001`、`veo-3.0-fast-generate-001` 将于 2026-06-30 下线，集成时直接采用 3.1 | 文生视频、图生视频、首尾帧、参考图（≤3）、视频扩展、4K、原生音频 | 异步 `predictLongRunning` + `fetchPredictOperation`，结果落 GCS。Gemini API 与 Vertex AI 端点必须独立端点登记。 |
| OpenAI Sora | [Video generation with Sora](https://developers.openai.com/api/docs/guides/video-generation)，[Videos API reference](https://developers.openai.com/api/reference/resources/videos)，[Sora 2 prompting guide](https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide) | `sora-2`、`sora-2-pro`，含 `2025-12-08` / `2025-10-06` snapshot；2026-03 起新增 character references、最长 20s、`sora-2-pro` 1080p、最高 6× 视频扩展、Batch API、视频编辑 API | 文生视频、图片参考、角色参考（非真人）、视频扩展、视频编辑、批处理 | 提交 `POST /videos` → 轮询 `GET /videos/{id}` → 下载 `GET /videos/{id}/content`，支持 webhook（首版只用轮询）。注意 sora-2 系列 EOL 排期，提交前必须读取最新 snapshot。 |
| Runway Gen | [Runway API Reference](https://docs.dev.runwayml.com/) | `gen4.5`、`gen4_turbo`、`gen4_aleph`、`act_two`；`gen3a_turbo` 已迁移弃用 | 文生视频、图生视频、视频转视频、Act Two 主体迁移、Aleph、Lip Sync | 任务式：提交 → `taskId` → 轮询 `GET /tasks/{id}`，可配置 `replyUrl`。模型 ID 必须以官方文档实时为准，不写死。 |
| Luma Dream Machine / Ray | [Dream Machine API](https://docs.lumalabs.ai/docs/api)，[Video Generation](https://docs.lumalabs.ai/docs/video-generation) | API 仍以 `ray-2`、`ray-flash-2` 为主；Ray 3 / 3.14 已上线 Dream Machine 产品但 API 文档暂未跟进 | 文生视频、图生视频、首尾关键帧、延展、相机控制、回调 | 图生视频要求图片 URL，需规划临时上传或对象存储；首版可允许「已有公网 URL」路径并明确 fallback。 |
| MiniMax Hailuo | [MiniMax Video Generation](https://platform.minimax.io/docs/guides/video-generation) | `MiniMax-Hailuo-2.3`、`MiniMax-Hailuo-2.3-Fast`、`MiniMax-Hailuo-02` | 文生视频、图生视频、首尾帧、Subject Reference（人脸一致性） | 异步 `POST /v1/video_generation` → `GET /query/video_generation?task_id=...`。1080P，6-10s。 |
| 快手可灵 Kling | [KlingAI API Reference](https://klingai.com/document-api/apiReference/) | `kling-v3.0-t2v` / `kling-v3.0-i2v`，向下兼容 v2.6 / v2.5-turbo / v2.1-master / v1.6 / v1.5 系列 | 文生视频、图生视频、运动控制、多镜头分镜、Lip-Sync、原生音频 | 任务式 + `callback_url`。鉴权与签名走可灵开发者控制台流程，需在端点配置中支持双密钥（AccessKey/Secret）。 |
| 字节 Seedance（BytePlus / 火山方舟） | [BytePlus ModelArk Video Generation API](https://docs.byteplus.com/en/docs/ModelArk/Video_Generation_API)，火山方舟 `https://ark.cn-beijing.volces.com/api/v3` | 国际版 `seedance-2.0` / `seedance-2.0-fast` / `seedance-2.0-pro`；国内版 `doubao-seedance-2-0-260128` / `doubao-seedance-2-0-fast-260128` | 文生视频、图生视频，多模态参考（≤9 图 / 3 视频 / 3 音频）、原生音频、Lip-Sync、多镜头 | 提交 `POST /v3/contents/generations/tasks` → 轮询。结果 URL 24h 失效，必须及时落地。国际/国内属于不同端点，不能合并。 |
| 阿里通义万相 / Wan | [Video generation overview](https://www.alibabacloud.com/help/en/model-studio/use-video-generation)，[Wan T2V](https://help.aliyun.com/zh/model-studio/text-to-video-guide)，[Wan 2.7 I2V](https://help.aliyun.com/zh/model-studio/wan-image-to-video-guide)，[Wan 2.6 R2V](https://help.aliyun.com/zh/model-studio/wan2-6-reference-student-video) | `wan2.7-i2v`、`wan2.6-t2v`、`wan2.5-t2v-preview`、`wan2.6-r2v` / `wan2.6-r2v-flash`，向下兼容 `wan2.2-t2v-plus`、`wan2.1-t2v-turbo` | 文生视频、图生视频（首帧 / 首尾帧 / 视频续写）、参考图视频、AnimateAnyone 已并入 R2V 模式 | DashScope `X-DashScope-Async: enable` → 任务 ID → 轮询 / 回调。需区分国内 DashScope 与国际 Model Studio 端点。 |
| Happy Horse | [fal.ai Happy Horse](https://fal.ai/models/alibaba/happy-horse/) | `alibaba/happy-horse/text-to-video`、`alibaba/happy-horse/image-to-video`、`alibaba/happy-horse/video-edit`、`alibaba/happy-horse/reference-to-video` | 文生视频、图生视频、视频编辑、参考视频、Lip-Sync（7 语种）、原生音频 | 自 2026-04-27 起 fal.ai 是阿里 Token Hub 官方 API 合作方，无独立 REST 端点。所有 Happy Horse 流量必须走 fal.ai 队列协议，不写死成「阿里官方」端点。 |
| 腾讯混元 / Hunyuan-Video | [腾讯云 VCLM](https://cloud.tencent.com/document/product/1616/107795)，[SubmitHunyuanToVideoJob](https://cloud.tencent.com/document/api/1616/126160)，[DescribeHunyuanToVideoJob](https://cloud.tencent.com/document/api/1616/126162)，[TokenHub 视频生成](https://cloud.tencent.com/document/product/1823/130081) | T2V `hy-video-1.5`；I2V `yt-video-2.0`；衍生 `yt-video-fx`、`yt-video-humanactor` | 文生视频（混元）、图生视频（优图 2.0）、视频特效、人像驱动 | 腾讯云 VCLM 协议 + TokenHub OpenAI 兼容协议并存，适配器需要明确协议差异；TokenHub 路径优先用于跨账号统一接入。 |

不在首批接入的服务（保留二级支持，待用户明确需要时按相同模板追加）：

- **Pika Labs**：官方页指向 fal.ai，没有独立 REST API，可作为 fal.ai 聚合端点的子模型。
- **Stability AI Stable Video Diffusion API**：托管 API 已于 2025-07-24 下线，仅剩自托管，不进入首批。
- **Vidu / 生数科技**：阿里云百炼侧暂作为 Wan 端点的替代模型预留。

## 5. 任务模式

### 5.1 工作台模式

当前 `WorkbenchTaskMode`（位于 `src/hooks/useTaskManager.ts:27`）为：

```typescript
type WorkbenchTaskMode = 'generate' | 'edit' | 'image-to-text';
```

视频版本扩展为：

```typescript
type WorkbenchTaskMode =
    | 'generate'
    | 'edit'
    | 'image-to-text'
    | 'text-to-video'
    | 'image-to-video';
```

后续预留：

```typescript
type FutureVideoTaskMode =
    | 'video-edit'
    | 'video-extend'
    | 'reference-to-video'
    | 'video-to-video'
    | 'image-audio-to-video';
```

要求：

- 是否存在源图片不能直接决定任务模式。源图片可以用于图片编辑、图生文、图生视频或视频参考。
- `text-to-video` 允许没有源图片。
- `image-to-video` 必须至少有一张可用源图片，或可用历史图片引用。
- 切换任务模式时保留各能力域自己的端点、模型和参数选择，返回原模式不能丢失用户上下文（与 v2.10.1「图生文按钮在没有源图时切换回文生图」的体验保持一致）。

### 5.2 模式切换规则

| 当前输入 | 点击「文生视频」 | 点击「图生视频」 |
| --- | --- | --- |
| 无源图片 | 切换到 `text-to-video` | 禁用，tooltip 提示「添加源图片后可用」 |
| 有源图片 | 切换到 `text-to-video`，源图片保留但不作为必填输入 | 切换到 `image-to-video` |
| 正在生成图片/文本/视频 | 禁用切换或提示先取消任务 | 禁用切换或提示先取消任务 |
| 已选视频历史 | 保持视频输出，可修改参数再生成 | 若历史含源图片，可恢复到 `image-to-video` |

## 6. 交互需求

### 6.1 提示词工具栏入口

在现有提示词工具栏中新增视频入口，位置建议靠近「图生文」和「润色」按钮：

- `文生视频`：图标建议使用 lucide `Film` 或 `Clapperboard`。
- `图生视频`：图标建议使用 lucide `ImagePlay`、`FileVideo` 或组合现有图标。

按钮状态：

| 状态 | 条件 | 表现 |
| --- | --- | --- |
| 可用 | 当前无运行任务 | 普通按钮状态 |
| 激活 | 当前模式为对应视频任务 | 高亮选中，`aria-pressed=true` |
| 禁用 | 图生视频无源图片 | 禁用并显示 tooltip |
| 运行中 | 视频任务已提交未完成 | 禁止重复提交，可保留高亮和进度提示 |
| 错误 | 当前视频配置不可用 | 显示配置错误入口，引导到设置 |

### 6.2 表单变化

进入 `text-to-video` 后：

- 表单标题切换为「文生视频」。
- 提示词 placeholder 切换为「描述视频主体、动作、镜头、场景、风格和光照」。
- 主按钮文案切换为「生成视频」。
- 图片尺寸、图片质量、输出格式、蒙版等图片参数隐藏。
- 展示视频参数：模型、比例/分辨率、时长、数量、负向提示词、seed、提示词增强、是否生成音频、是否添加水印。

进入 `image-to-video` 后：

- 表单标题切换为「图生视频」。
- 源图片区保持显示，增加「首帧/尾帧/参考图/主体参考」的角色选择。
- 提示词 placeholder 切换为「描述图片如何运动、镜头如何移动、主体做什么动作」。
- 主按钮文案仍为「生成视频」。
- 如果模型只支持单图首帧，超过数量的源图要禁用提交并提示用户删除或更换模型。

### 6.3 视频专属参数

首版需要抽象统一参数，但每个模型只展示其支持项：

| 参数 | 说明 |
| --- | --- |
| `videoDurationSeconds` | 可选时长来自模型能力，不允许用户输入模型不支持的值。 |
| `videoAspectRatio` / `videoSize` | 有的厂商用比例，有的用 `width*height` 或 `widthxheight`，UI 用语义选项，适配器负责转换。 |
| `videoResolutionTier` | 例如 480p、720p、1080p、4k；和 size 不应同时冲突。 |
| `videoFrameRate` | 多数模型固定，只有模型支持时显示。 |
| `videoCount` | 每次生成视频数量，默认 1，受模型上限约束。 |
| `videoNegativePrompt` | 支持负向提示词的模型才显示。 |
| `videoSeed` | 支持 seed 的模型才显示，保留「随机」按钮。 |
| `videoPromptEnhanceEnabled` | 对应阿里 Wan `prompt_extend`、厂商 prompt rewrite 等。 |
| `videoCameraMotion` | 适配可灵、Luma、腾讯等相机控制；不支持时只作为提示词模板插入。 |
| `videoShotType` | 单镜头、多镜头、自动分镜；支持多分镜时展示分镜编辑入口。 |
| `videoNativeAudioEnabled` | 支持原生音频的模型显示；不支持时禁用。 |
| `videoWatermarkEnabled` | 默认遵守厂商要求；如果厂商不允许关闭则显示只读说明。 |
| `videoReferenceRole` | 首帧、尾帧、参考图、主体参考、角色参考、动作参考。 |
| `videoCallbackUrl` | 仅服务端部署/高级设置可用，Web 静态和 Tauri 默认不展示。 |

## 7. 供应商与模型管理

### 7.1 复用并扩展统一目录

视频能力必须沿用 v2.10.0 已落地的统一目录，不再新建独立 registry。`src/lib/provider-model-catalog.ts` 现有定义已经为视频留位：

```typescript
// provider-model-catalog.ts:70-82（已实现）
export type ModelTaskCapability =
    | 'image.generate'
    | 'image.edit'
    | 'image.maskEdit'
    | 'vision.text'
    | 'text.generate'
    | 'text.reasoning'
    | 'prompt.polish'
    | 'video.generate'        // 已就位
    | 'video.imageToVideo'    // 已就位
    | 'audio.speech'
    | 'audio.transcribe'
    | 'embedding.create';
```

视频域需要追加的能力枚举：

```typescript
// 待新增：建议在不破坏现有顺序的前提下追加
type FutureVideoTaskCapability =
    | 'video.edit'
    | 'video.extend'
    | 'video.referenceToVideo'
    | 'video.audioToVideo'
    | 'video.character';
```

`ModelCapabilities.features`（`provider-model-catalog.ts:90-101`）追加视频专属特性。建议拆出独立子结构，避免影响图片/文本布尔位：

```typescript
// 待新增：与现有 features 平级，可选结构
type VideoModelFeatures = {
    asyncJob: boolean;
    progressPolling?: boolean;
    webhooks?: boolean;
    batch?: boolean;
    cancel?: boolean;
    downloadContent?: boolean;
    resultUrlExpires?: boolean;
    inputImageUpload?: 'multipart' | 'base64' | 'publicUrl' | 'fileId';
    inputVideoUpload?: 'multipart' | 'base64' | 'publicUrl' | 'fileId';
    referenceImages?: boolean;
    startFrame?: boolean;
    endFrame?: boolean;
    videoExtension?: boolean;
    videoEdit?: boolean;
    nativeAudio?: boolean;
    externalAudio?: boolean;
    negativePrompt?: boolean;
    seed?: boolean;
    promptEnhance?: boolean;
    watermarkControl?: boolean;
    cameraControl?: boolean;
    multiShot?: boolean;
};
```

`ModelTaskDefaults`（`provider-model-catalog.ts:107-123`）新增 `video` 槽位：

```typescript
// 待新增：与 image / visionText / promptPolish 平级
type VideoModelDefaults = {
    durationSeconds?: number;
    size?: string;
    aspectRatio?: string;
    resolutionTier?: '480p' | '720p' | '1080p' | '4k';
    frameRate?: number;
    count?: number;
    promptEnhanceEnabled?: boolean;
    nativeAudioEnabled?: boolean;
    watermarkEnabled?: boolean;
};
```

### 7.2 ProviderKind 与 ProviderProtocol 扩展

当前定义（`provider-model-catalog.ts:41-48`）：

```typescript
export type ProviderKind = 'openai' | 'openai-compatible' | 'google-gemini' | 'volcengine-ark' | 'sensenova';

export type ProviderProtocol =
    | 'openai-responses'
    | 'openai-chat-completions'
    | 'openai-images'
    | 'gemini-generate-content'
    | 'ark-openai-compatible';
```

为支持 §4 列出的全部首批厂商，建议追加：

```typescript
// 待追加：与现有 ProviderKind 同级
type AdditionalProviderKind =
    | 'google-vertex-ai'
    | 'runway'
    | 'luma'
    | 'minimax'
    | 'kling'
    | 'byteplus-modelark'
    | 'aliyun-dashscope'
    | 'tencent-hunyuan-video'
    | 'tencent-tokenhub'
    | 'fal';

// 待追加：与现有 ProviderProtocol 同级
type AdditionalProviderProtocol =
    | 'openai-videos'
    | 'gemini-generate-videos'
    | 'vertex-ai-veo'
    | 'runway-api-v1'
    | 'luma-dream-machine'
    | 'minimax-video'
    | 'kling-api'
    | 'modelark-video-generation'
    | 'dashscope-video-generation'
    | 'tencent-vclm'
    | 'tencent-tokenhub-video'
    | 'fal-model-api';
```

要求：

- 官方端点和聚合端点必须在 UI 上明确区分（例如 fal.ai 必须标注「聚合平台」），避免用户误以为第三方包装就是官方 API。
- Base URL 继续使用现有 `validatePublicHttpBaseUrl` / `normalizeOpenAICompatibleBaseUrl` 进行 URL 安全校验，不能允许公共 Web 静默访问私网、localhost 或任意内网跳板。
- API Key 在 UI、分享、同步、日志中必须遮蔽。继续复用 `mask-secret` 等现有工具。
- 支持同一供应商多个端点，例如 Google Gemini API 与 Vertex AI、腾讯云 API 与 TokenHub、阿里国内与国际 endpoint、字节 BytePlus 与火山方舟。
- 模型列表发现继续复用 `proxy_provider_models`；不能列模型的供应商允许手动添加 `ModelCatalogEntry`（`source: 'custom'`）。

### 7.3 设置页

系统设置新增或扩展「视频生成」区域：

- 默认视频供应商端点。
- 默认文生视频模型（`modelTaskDefaultCatalogEntryIds['video.generate']`）。
- 默认图生视频模型（`modelTaskDefaultCatalogEntryIds['video.imageToVideo']`）。
- 默认比例/分辨率/时长。
- 默认是否启用提示词增强。
- 默认是否生成原生音频。
- 默认是否保存视频历史。
- 默认是否自动下载结果到本地历史资产。
- 视频任务轮询间隔、最大轮询时长、失败重试次数。
- 大视频文件同步策略：不同步、仅缩略图、同步最近、同步全部。
- 单个视频同步大小上限。

设置项必须通过 `src/lib/config.ts` 现有 `loadConfig()` / `normalizeUnifiedProviderModelConfig()` 通道归一化，未知旧值回退安全默认值；旧配置缺少视频字段时不能影响现有文生图、图像编辑、图生文功能。

## 8. 执行链路

### 8.1 异步任务状态

视频生成统一抽象为异步任务：

```typescript
type VideoGenerationStatus =
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'expired';

type VideoGenerationJob = {
    id: string;
    providerJobId?: string;
    providerRequestId?: string;
    status: VideoGenerationStatus;
    progress?: number;
    createdAt: number;
    updatedAt: number;
    startedAt?: number;
    completedAt?: number;
    errorCode?: string;
    errorMessage?: string;
    resultVideoUrl?: string;
    resultVideoFilename?: string;
    thumbnailUrl?: string;
    thumbnailFilename?: string;
    spritesheetFilename?: string;
};
```

通用流程：

1. 校验配置、提示词、源图、模型能力和安全限制。
2. 保存本地 `queued` 任务草稿，避免刷新页面后任务完全丢失。
3. 调用供应商创建任务，记录 `providerJobId` 和 `providerRequestId`。
4. 按模型或供应商推荐间隔轮询状态。
5. 成功后下载或缓存结果视频、缩略图、spritesheet。
6. 写入视频历史。
7. 清理运行态但保留可恢复任务记录。

实现层应新增 `src/lib/video-executor.ts`，参照 `src/lib/vision-text-executor.ts` 与 `src/lib/taskExecutor.ts` 的 `proxy / direct / desktopRustProxy` 三态切换模型，但加上长任务 / 多次轮询 / 可恢复的状态机。

### 8.2 Web 与 Tauri 分离

Web 路径：

- 通过 Next.js API Route 中转支持密钥保护、CORS 绕过、multipart 上传和结果下载。建议路径：`src/app/api/video/create`、`src/app/api/video/poll`、`src/app/api/video/download`、`src/app/api/video/cancel`。
- 客户端直连仅在端点支持 CORS 且不会暴露不该暴露的密钥时开放，遵守现有 `getClientDirectLinkRestriction` 策略。
- URL-only 图生视频供应商（如 Luma）需要临时对象存储、服务器上传或用户已有公网 URL；不能把本地 blob URL 当作公网 URL 发送。

Tauri 路径：

- 必须通过 `src/lib/desktop-runtime.ts` 调用 Rust command 或桌面代理，不在共享模块直接导入 Tauri API。复用 `invokeDesktopCommand` / `invokeDesktopStreamingCommand`。
- Rust 侧需要在 `src-tauri/src/proxy/` 下新增视频专属命令，例如 `proxy_video_create`、`proxy_video_poll`、`proxy_video_download`、`proxy_video_cancel`，与现有 `proxy_images`、`proxy_image_to_text`、`proxy_remote_image` 一致。
- 桌面静态导出不能依赖 `src/app/api/video-*` 路由。
- 下载结果优先保存到应用数据目录或用户配置的历史资产目录，并把引用写回前端历史；可参照 `save_local_image` / `serve_local_image` 现有桌面文件流。

### 8.3 轮询、取消和恢复

- 默认轮询间隔不少于 5 秒，长任务使用退避，避免热循环。
- 支持用户手动取消本地轮询；如果供应商支持远端取消（OpenAI、Runway 等），则同时发起远端取消。
- 页面刷新后，如果存在 `queued` 或 `running` 视频任务，进入工作台时提示「恢复轮询」。
- 供应商结果 URL 有效期短时（Seedance 24h、Sora 临时签名），完成后应尽快下载到本地资产；下载失败仍保留远端 URL 和过期时间，由 UI 提示「远端可能已过期」。
- 任务失败时展示厂商错误码、可读说明和「复制诊断信息」，但不能包含 API Key。

## 9. 视频输出面板

新增 `VideoOutput` 组件（建议路径 `src/components/VideoOutput.tsx`），由上层根据任务模式切换：

- 运行中：展示队列状态、进度、已耗时、预计提示、取消按钮。
- 成功：展示视频播放器、封面、基础元信息、操作按钮。
- 失败：展示错误信息、重试、复制诊断信息、修改配置入口。
- 恢复历史：展示历史视频和源参数，不自动重新请求模型。

成功态操作：

- 播放/暂停。
- 下载视频。
- 复制提示词。
- 复制任务 ID。
- 发送首帧/缩略图到图片编辑。
- 发送源图回到图生视频。
- 使用同参数重新生成。
- 保存为历史。
- 后续预留：延展视频、编辑视频、提取关键帧、生成同款分镜。

性能要求：

- 历史列表中视频只加载缩略图，不自动加载完整视频。
- 视频播放器使用 `preload="metadata"` 或更保守策略。
- Object URL 必须按现有 `object-url` 模式清理。
- 大视频下载、hash、上传都不得阻塞首屏、拖拽和输入响应。

## 10. 视频历史

### 10.1 历史 tab

`HistoryPanel` 增加第三个标签：

| 标签 | 内容 | 默认 |
| --- | --- | --- |
| 图片 | 现有图片生成/编辑历史 | 是 |
| 图生文 | 现有图生文历史 | 否 |
| 视频 | 文生视频/图生视频结果历史 | 否 |

要求：

- 默认仍为「图片」，不改变现有使用路径。
- 每个 tab 的多选状态相互隔离（沿用 v2.10.0 图生文历史多选独立的设计）。
- 云同步菜单根据当前 tab 展示视频相关动作。
- 标签和列表使用现有主题变量，不新增营销式大区域。

### 10.2 视频历史卡片

卡片信息：

- 视频缩略图或 poster。
- 任务类型：文生视频/图生视频。
- 供应商和模型。
- 提示词摘要，最多 2-3 行。
- 源图片数量和角色。
- 时长、比例/分辨率、是否有音频。
- 任务状态、耗时、创建时间。
- usage/cost，供应商有返回时展示。
- 同步状态：仅本地、待上传、已同步、部分同步、远端缺失、冲突。

卡片操作：

- 查看详情。
- 播放。
- 下载。
- 复制提示词。
- 重新生成。
- 恢复到视频工作台。
- 单条同步。
- 删除本地记录。
- 可选删除远端资产，必须遵守现有「允许同步删除远端图片/资产」的显式开关思路，并加二次确认（沿用 v2.10.1 强化的删除确认体验）。

### 10.3 详情视图

桌面布局：

- 左侧或上方为视频播放器。
- 右侧为参数、源图片、提示词、模型、任务状态、成本和操作。

移动布局：

- 视频在上，信息在下。
- 底部操作栏不遮挡播放器控件。
- 长提示词和错误信息必须可滚动，不撑破 viewport。

详情操作：

- `恢复到文生视频` 或 `恢复到图生视频`。
- `重新生成`。
- `复制提示词`。
- `下载视频`。
- `发送首帧到图片编辑`。
- `源图放大查看`。
- 后续预留 `延展视频`、`编辑视频`。

## 11. 数据模型

### 11.1 本地历史类型

新增独立类型，避免污染现有 `HistoryMetadata`（`src/types/history.ts:27-40`）和 `VisionTextHistoryMetadata`（`src/types/history.ts:55-76`）：

```typescript
type VideoHistorySyncStatus =
    | 'local_only'
    | 'pending_upload'
    | 'synced'
    | 'partial'
    | 'conflict';

type VideoSourceAssetRef = {
    filename: string;
    role: 'start_frame' | 'end_frame' | 'reference' | 'subject' | 'character' | 'motion';
    storageModeUsed: ImageStorageMode;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    sha256?: string;
    source: 'uploaded' | 'clipboard' | 'history-image' | 'generated-image' | 'remote-url' | 'restored';
    syncStatus?: HistoryImageSyncStatus;
};

type VideoResultAssetRef = {
    filename: string;
    kind: 'video' | 'thumbnail' | 'spritesheet';
    mimeType: string;
    size?: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
    remoteUrl?: string;
    remoteUrlExpiresAt?: number;
    sha256?: string;
    syncStatus?: HistoryImageSyncStatus;
};

type VideoHistoryMetadata = {
    id: string;
    type: 'text-to-video' | 'image-to-video';
    timestamp: number;
    durationMs?: number;
    prompt: string;
    negativePrompt?: string;
    providerEndpointId: string;
    providerEndpointName?: string;
    providerKind: ProviderKind;
    providerProtocol: ProviderProtocol;
    catalogEntryId?: string;
    rawModelId: string;
    sourceAssets: VideoSourceAssetRef[];
    resultAssets: VideoResultAssetRef[];
    job: VideoGenerationJob;
    parameters: {
        durationSeconds?: number;
        aspectRatio?: string;
        size?: string;
        resolutionTier?: string;
        frameRate?: number;
        seed?: number;
        count?: number;
        promptEnhanceEnabled?: boolean;
        nativeAudioEnabled?: boolean;
        watermarkEnabled?: boolean;
        cameraMotion?: string;
        shotType?: string;
    };
    usage?: ProviderUsage;
    syncStatus?: VideoHistorySyncStatus;
};
```

约束：

- `id` 使用稳定随机 ID，不只依赖 timestamp。
- `providerEndpointId` 与 `catalogEntryId` 必须指向 `ProviderEndpoint` / `ModelCatalogEntry` 主键，便于历史从配置恢复。
- `resultAssets` 中完整视频可缺失，但 metadata 必须保留任务状态和远端信息（含 `remoteUrlExpiresAt`）。
- localStorage 只保存元数据，不保存视频或图片字节。
- 源图和视频资产通过 IndexedDB、Tauri 文件路径或历史资产服务保存；复用 `src/lib/history-assets.ts` 的资产持久化通道，避免新建一套并行存储。
- 保存前按 `timestamp` 倒序，数量上限独立配置，默认可低于图片历史，例如 50-100 条。

### 11.2 存储 Key 与文件布局

新增：

```typescript
export const VIDEO_HISTORY_STORAGE_KEY = 'gpt-image-playground-video-history';
```

新增文件建议：

```text
src/lib/video-types.ts            // 状态机、参数、能力扩展、SourceAssetRef/ResultAssetRef
src/lib/video-history.ts          // load/save/normalize/dedupe，参考 vision-text-history.ts
src/lib/video-executor.ts         // proxy / direct / desktopRustProxy 三态执行
src/components/VideoOutput.tsx    // 视频输出面板
src/app/api/video/                // Web 中转路由（create/poll/download/cancel）
src-tauri/src/proxy/video.rs      // Rust 适配器主入口
src-tauri/src/proxy/video_*.rs    // 各供应商子模块（按需拆分）
```

不再单独建 `video-model-registry.ts` —— 视频模型完全走统一目录的 `ModelCatalogEntry`，避免重新引入并行 registry。

## 12. 云同步

### 12.1 同步内容拆分

视频同步必须拆为轻重两层：

- 轻量：视频历史元数据、任务参数、提示词、供应商显示信息、远端 URL 摘要、缩略图引用。
- 重量：源图片、视频文件、缩略图、spritesheet。

同步配置新增选项（沿用现有 `SyncConfig` / `SnapshotManifest` 模式）：

```typescript
type VideoSyncOptions = {
    videoHistory: boolean;
    videoSourceImages: boolean;
    videoThumbnails: boolean;
    videoFiles: boolean;
    recentVideoRangeDays?: number;
    maxVideoAssetBytes?: number;
};
```

默认建议：

- `videoHistory: true`
- `videoSourceImages: true`
- `videoThumbnails: true`
- `videoFiles: false`
- `recentVideoRangeDays: 7`
- `maxVideoAssetBytes: 100 * 1024 * 1024`（100 MB）

原因：视频文件体积大，默认同步全部视频会显著增加对象存储成本和移动端恢复压力。

### 12.2 Manifest / Snapshot

`src/lib/sync/manifest.ts` 中已有 `imageHistory`、`visionTextHistory` 双轨结构，视频沿用同一模式新增字段：

```typescript
// 待追加到 SnapshotManifest
type VideoManifestExtensions = {
    videoHistory?: VideoHistoryMetadata[];
    videoAssets?: ManifestImageEntry[]; // role 扩展为视频资产分类
};
```

`ManifestImageEntry.role` 字段需要扩展（当前仅 `'image-output' | 'vision-text-source' | 'shared-history-asset'`）：

```typescript
type ExtendedManifestRole =
    | 'image-output'
    | 'vision-text-source'
    | 'shared-history-asset'
    | 'video-output'
    | 'video-thumbnail'
    | 'video-spritesheet'
    | 'video-source';
```

兼容要求：

- 新客户端读取旧 manifest 时 `videoHistory` 按空数组处理。
- 旧客户端读取新 manifest 时不能影响图片/图生文历史恢复。
- 视频资产缺失时历史仍可展示元数据和远端过期信息。
- 恢复视频历史时不自动下载所有视频文件，先恢复 metadata 和缩略图，再按用户操作恢复大文件。

### 12.3 历史菜单动作

视频 tab 下云菜单新增：

- 同步视频历史。
- 同步视频缩略图。
- 同步最近视频文件。
- 强制同步视频文件。
- 恢复视频历史。
- 恢复视频缩略图。
- 恢复最近视频文件。
- 强制恢复视频文件。

删除远端视频文件必须遵守显式授权开关，不默认执行；触发时使用 v2.10.1 升级后的二次确认对话框风格。

## 13. 分享

分享链接可选包含：

- 当前任务模式：`text-to-video` 或 `image-to-video`。
- 当前提示词和负向提示词。
- 视频模型 ID（`catalogEntryId` 与 `rawModelId`）。
- 供应商端点名称和 Base URL。
- 视频参数。
- 源图片引用不默认写入普通 URL。
- API Key 默认不分享，和现有规则一致。
- 云同步配置可按现有分享选择机制处理。

加密分享可包含视频配置，但不应包含本地视频 blob 或大型 base64。需要分享生成视频时，应引导用户使用云同步或外部文件分享，不把视频文件塞入 URL。

## 14. 安全与合规

1. 保留并复用 `validatePublicHttpBaseUrl`、`normalizeOpenAICompatibleBaseUrl`、`getClientDirectLinkRestriction` 等安全边界。
2. 对所有 `image_url`、`video_url`、`callback_url` 做公共 URL 校验；Web 公共部署不得向私网或 localhost 发起代理请求。
3. 不在 UI、日志、同步 manifest、分享链接中暴露原始 API Key；继续遵循 `src/lib/mask-secret.ts` 等现有遮蔽工具。
4. 对结果 URL 有效期做标记（如 Seedance 24h、Sora 临时签名），避免用户误以为远端 URL 永久可用。
5. 对真人、人脸、版权角色、音乐、未成年人、政治人物等高风险视频生成场景保留供应商错误原文和通用提示，但不试图绕过厂商安全策略。Sora 真人/人脸限制、Veo 4K 与音频政策、可灵和 Wan 的政治敏感名单都按各厂商最新策略转译。
6. 自定义/聚合端点（fal.ai 上的 Pika、Happy Horse 等）必须展示「非官方来源，请自行确认授权、计费和数据政策」的提示。
7. 视频文件下载到本地时，记录文件 SHA-256 用于对账，但不向第三方上报。

## 15. UI、主题和响应式

- 视频 UI 必须同时验证亮色、暗色主题。
- 移动端优先：参数面板堆叠，播放器不溢出，按钮不挤压文本。
- 桌面端完整：左侧表单、右侧视频输出、历史列表三者保持当前工作台密度。
- 使用现有 `app-theme-scope`、`app-panel-card`、`app-panel-subtle` 和 CSS 变量。
- 不新增 landing page、hero、装饰性背景。
- 历史卡片播放器使用固定 `aspect-ratio`，缩略图缺失时保持尺寸稳定。
- 所有长模型 ID、任务 ID、错误信息都必须截断或换行，不能撑破按钮或卡片。
- 图标按钮需要 tooltip，使用 lucide 图标。
- 不允许使用浏览器原生 `alert/prompt/confirm`；进度提示、任务取消、删除确认全部使用项目内的 `dialog`、通知和确认组件（沿用 AGENTS.md 第 2 节约束）。

## 16. 测试与验证

### 16.1 单元测试

- 视频配置归一化：旧配置、未知字段、非法时长、非法分辨率、未知 `ProviderKind` / `ProviderProtocol`。
- 视频模型能力筛选：文生视频和图生视频只展示支持模型。
- provider adapter 参数转换：比例、size、duration、seed、负向提示词、源图角色。
- `video-history.ts` load/save/merge/normalize。
- sync manifest 兼容旧字段和新增视频字段。
- URL 安全校验：公共 URL、私网 URL、localhost、过期 URL。

### 16.2 集成测试

- Web API Route：创建任务、轮询、下载、错误处理。
- Tauri command：创建任务、轮询、下载、取消、文件保存。
- 任务恢复：刷新后恢复轮询，完成后写历史。
- 源图资产：上传图片、历史图片复用、源图缺失恢复。
- 云同步：只同步 metadata、同步缩略图、同步最近视频文件、恢复缺失视频文件。

### 16.3 UI 验证

- 亮色/暗色。
- 手机宽度、平板宽度、桌面宽度。
- 无源图、有源图、多源图、源图缺失。
- 运行中、成功、失败、取消、远端 URL 过期。
- 长提示词、长模型 ID、长错误信息。
- 中文（`zh-CN`）与英文（`en-US`）双语下文案、按钮、对话框完整对齐。

## 17. 国际化

视频域所有用户可见文案必须遵循 [国际化（i18n）支持需求文档](./INTERNATIONALIZATION_REQUIREMENTS.md) 与 v2.10.0 上线的 `src/lib/i18n/messages.ts` 桥接通道：

- 当前 `SUPPORTED_APP_LANGUAGES` 仅含 `zh-CN`、`en-US`，新文案两个语言必须同时落地。
- 任务模式名、按钮、状态标签、错误提示、对话框、tooltip 全部走 i18n key，不允许硬编码可见字符串。
- 模型 ID、`providerJobId`、原始厂商错误码这类技术标识保留原文，使用 `data-i18n-skip` 标注。
- 任何变更同步更新 `INTERNATIONALIZATION_IMPLEMENTATION_CHECKLIST.md` 的视频小节。

## 18. 分阶段计划

### P0：视频基础骨架与全量官方供应商接入

- 新增 `text-to-video`、`image-to-video` 任务模式。
- 在 `provider-model-catalog.ts` 中扩展 `ProviderKind`、`ProviderProtocol`、`ModelCapabilities.features`、`ModelTaskDefaults`，并完成视频专属 features 的归一化。
- 新增 `video-types.ts`、`video-history.ts`、`video-executor.ts`、`VideoOutput`。
- 新增异步任务状态模型和本地任务恢复。
- 新增视频历史 tab 和 metadata-only 历史保存。
- 接入 §4 列出的全部官方供应商：OpenAI Sora、Google Veo（Gemini API + Vertex AI）、Runway、Luma、MiniMax Hailuo、可灵、Seedance（BytePlus + 火山方舟）、阿里 Wan、Happy Horse（fal.ai）、腾讯混元（VCLM + TokenHub）。所有供应商在统一目录里以 `ProviderEndpoint` + `ModelCatalogEntry` 形式登记，UI 平等展示，不做内部优先级排序。
- Web 与 Tauri 均有执行路径，并完成首批模型的端到端样板（提交 + 轮询 + 下载 + 历史）。

### P1：资产闭环与同步打磨

- 实现源图上传策略：multipart、base64、public URL、file ID 全套。
- 完善下载并保存视频、缩略图和 spritesheet。
- 视频历史详情、重新生成、下载、恢复到工作台。
- 云同步 metadata、缩略图、源图和最近视频文件，含 `videoFiles` 大小上限与时间窗口。
- 远端 URL 过期、断网、轮询超时的恢复体验。
- 全量供应商的负向提示词、相机控制、原生音频开关在 UI 上完整支持。

### P2：高级视频能力

- 视频延展、视频编辑、首尾帧控制、多参考图、角色库、相机控制、多分镜。
- Webhook 支持，仅在服务端部署启用。
- 批量视频任务和队列管理。
- Pika/fal、其他聚合端点作为明确标注的非官方或平台型适配器。
- 视频关键帧提取、发送到图片编辑、发送到图生文分析。

## 19. 验收标准

1. 用户能在无源图时完成一次文生视频任务，并在完成后播放、下载、保存历史。
2. 用户能在有源图时完成一次图生视频任务，并在历史中恢复源图、提示词和参数。
3. 刷新页面后，未完成的视频任务可恢复轮询或明确显示不可恢复原因。
4. 视频历史 tab 不影响图片历史和图生文历史的多选、删除、同步与恢复。
5. 云同步关闭视频文件时，仍能同步和恢复视频历史 metadata 与缩略图。
6. Web 和 Tauri 对同一供应商至少各有一条可用执行路径或明确降级提示。
7. 亮色/暗色、移动/桌面布局均无文本溢出、按钮重叠或播放器撑破容器。
8. API Key、同步密钥和本地文件路径不会出现在日志、分享链接或同步 manifest 明文中。
9. §4 列出的全部官方供应商至少各有一条端到端可用路径，列表中模型 ID 至少跟进到 2026-05-17 当时的最新版本。
10. 中文与英文界面下，所有视频域文案、对话框、错误提示完整覆盖，无硬编码字符串。

## 20. 决策记录

按用户 2026-05-17 决策结合实地调研补全的关键判断：

### 20.1 供应商接入范围（已决策）

**结论**：§4 列出的全部官方供应商在 P0 同步接入，不区分优先级。

**理由**：项目过去多模态接入已经验证，逐家集成会反复返工统一目录；视频领域模型变化更快（Veo 3 到 3.1、Wan 2.6 到 2.7、Hailuo 02 到 2.3、Sora 2 EOL 排期等），一次性纳入统一目录可以让后续模型迭代只改 catalog 不动架构。Pika、SVD 这类没有独立官方 REST 的留作 P2 / 不进入。

### 20.2 端到端样板供应商（建议）

**结论**：建议从 OpenAI Sora 与阿里 Wan 同时跑端到端流程作为骨架样板。

**理由**：

- Sora 协议设计代表西方主流（提交-轮询-下载分三个 endpoint，结果 URL 短期签名，支持 webhook 与 Batch），把这条链路打通后可以套用到 Veo、Runway、Luma、MiniMax、Hailuo。
- Wan 代表 DashScope 异步家族（`X-DashScope-Async: enable` + 任务 ID + 回调），把这条链路打通后可以套用到 Seedance、可灵、Hunyuan、TokenHub。
- 两条路径并行可以暴露统一抽象层的真实差异，避免只跑一家结果设计偏向单家协议。

### 20.3 临时对象存储（建议）

**结论**：Web 公共部署默认不提供项目自有的临时对象存储；图生视频要求公网 URL 的供应商（Luma 等）走两段式：

- 桌面/Tauri：把本地图片转 base64 或经 Rust 代理的临时上传渠道注入官方 SDK。
- Web：先尝试 multipart 直传，不支持时引导用户使用「外部公网 URL」字段，并明确提示厂商对 URL 域名/HTTPS/TLS 的要求。
- 项目自托管的对象存储（同步用 S3 兼容桶）只在用户已经填好同步配置时复用，不默认承担「临时上传」职责，避免变成隐性公网网关。

**理由**：项目核心场景是单租户工作台，引入项目自有上传通道会扩大攻击面、增加运维与计费复杂度；现有云同步对象存储的目的明确是「用户自己的桶」，不应被视频任务擅自借用。

### 20.4 视频文件默认保存位置（建议）

**结论**：

- Tauri 桌面/移动：默认存到应用数据目录的 `videos/` 子目录，沿用现有历史资产的统一目录管理；用户可在设置中改写路径。
- Web 浏览器：默认存到 IndexedDB（与历史图片一致），并提供一键「下载到本地」按钮；不强制写浏览器默认下载目录。
- 共同：视频文件命名包含 `id + timestamp + 扩展名`，便于跨设备恢复时对齐。

**理由**：与图片历史资产、图生文源图保持同一套抽象（`src/lib/history-assets.ts`），减少新概念。Web 直接落用户下载目录会引发权限提示频繁、历史无法回溯，IndexedDB 更稳。

### 20.5 视频云同步默认策略（建议）

**结论**：

- 视频历史元数据、缩略图、源图：默认开。
- 视频文件：默认关；用户开启后默认 `recentVideoRangeDays = 7`、`maxVideoAssetBytes = 100 MB`。
- 强制同步全部视频文件：必须用户显式打开，并在设置中给出存储/带宽提示。

**理由**：S3 兼容桶按对象数量+存储+流量计费，全量视频同步会快速造成成本失控；移动端首次恢复 GB 级视频体验差。

### 20.6 首版音频策略（建议）

**结论**：首版支持「视频带音频播放」，但不在 UI 强制要求生成原生音频；`videoNativeAudioEnabled` 默认关闭，仅 Veo 3.1、Sora-2、Hailuo 2.3、Seedance 2.0、可灵 3.0、Happy Horse、Wan 2.6/2.7 等已落地原生音频的模型显示开关。

**理由**：原生音频会显著增加任务时延和厂商成本（部分厂商按音频额外计费），首版让用户按需启用更稳；播放器只需统一支持有/无音频两种轨道。

### 20.7 分享体系是否纳入视频（建议）

**结论**：首版分享链接默认不自动包含视频结果，但允许用户主动选择「分享视频参数」（不含视频文件）。视频文件分享走云同步桶 + 临时签名 URL 的二级流程。

**理由**：现有分享链接长度受限，视频 base64 不现实；视频参数共享能满足绝大多数协作复盘场景，又不会带来 PII / 计费风险。

## 21. 关联文档

本需求依赖并扩展以下文档，实现层应同步阅读以避免重复造轮子：

- [统一供应商与模型能力管理需求文档](./UNIFIED_PROVIDER_MODEL_CAPABILITY_REQUIREMENTS.md)：`ProviderEndpoint`、`ModelCatalogEntry`、`ModelTaskCapability` 的权威来源。
- [图生文与多模态文本生成需求文档](./IMAGE_TO_TEXT_MULTIMODAL_REQUIREMENTS.md)：异步任务/任务模式扩展的最近一次落地参考。
- [图生文历史与云同步需求文档](./IMAGE_TO_TEXT_HISTORY_REQUIREMENTS.md)：本需求中视频历史与同步策略的姊妹文档，模式高度同构。
- [网络存储同步可行性与改造规划](./NETWORK_STORAGE_SYNC_RESEARCH.md)：`SyncManifest` 与对象存储抽象的源头。
- [Tauri Rust 请求代理服务规划](./TAURI_RUST_PROXY_PLAN.md)：桌面端 Rust 代理协议、Channel、SSE 复用模板。
- [国际化（i18n）支持需求文档](./INTERNATIONALIZATION_REQUIREMENTS.md) 与 [国际化实施清单](./INTERNATIONALIZATION_IMPLEMENTATION_CHECKLIST.md)：本需求所有 UI 文案的桥接来源。
