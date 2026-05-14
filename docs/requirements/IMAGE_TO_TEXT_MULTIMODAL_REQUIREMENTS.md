---
title: GPT Image Playground 图生文与多模态文本生成需求文档
summary: 为项目增加基于源图片的文本生成、图片信息提取、设计图到文生图提示词推导能力，并规划 OpenAI / OpenAI-compatible 多模态供应商管理与流式文本结果输出。
createdAt: 2026-05-14
status: draft-requirement
---

# GPT Image Playground 图生文与多模态文本生成需求文档

## 1. 背景

当前 GPT Image Playground 已经形成了较完整的图片生成/编辑工作台：

- 通过 `providerInstances` 管理 OpenAI Compatible、Google Gemini、Seedream、SenseNova 等图像供应商端点。
- 通过 `model-registry` 管理图片生成/编辑模型及其能力，例如尺寸、质量、格式、蒙版、流式图片预览。
- 通过独立的提示词润色配置接入 OpenAI-compatible Chat Completions 风格模型。
- 通过 Web API Routes 与 Tauri Rust command 分别支撑 Web 与桌面端请求代理。

但项目缺少“图生文”能力，用户无法直接从源图片中提取信息、理解设计图、反推可复用的文生图提示词，也无法把图片理解结果回填到主生成流程里。这会限制从“参考图 -> 提示词 -> 出图 -> 再编辑”的闭环效率。

本需求文档定义首版图生文能力，同时为后续文本生成、多模态对话、代码生成、文生视频等能力预留统一工作台架构。

## 2. 目标

### 2.1 首版目标

1. 用户添加源图片后，可以显式切换到“图生文”任务。
2. 图生文任务使用独立的多模态理解模型配置，优先支持 OpenAI 官方 `gpt-5.5`、`gpt-5.4`，同时支持 OpenAI-compatible 端点通过 API Key、Base URL、模型 ID 接入。
3. 用户输入框中的提示词在图生文任务中作为“用户指导词”，用于指定提取方向，例如“反推一套可用于文生图的提示词”“提取 UI 设计规范”“总结图片中的商品信息”。
4. 系统设置中支持配置图生文系统提示词、默认任务类型、模型、接口兼容模式、视觉 detail、流式输出等参数。
5. 点击提交后，当前图片结果面板切换为文本结果面板，并支持流式输出、复制、回填提示词、发送到生成器。
6. 供应商和模型能力设计不能污染现有图片生成模型列表，要为未来文本、多模态、视频模型扩展留出边界。

### 2.2 非目标

首版不做以下内容：

- 不让 `gpt-5.5` / `gpt-5.4` 直接进入现有图片生成模型列表。
- 不把图生文等同于图片编辑；添加源图片后，用户必须能在“编辑图片”和“图生文”之间显式选择。
- 不自动上传源图片进行分析，必须由用户点击提交触发。
- 不在首版强制实现多轮视觉对话。
- 不在首版实现文生视频、代码生成或完整 AI Agent 工作流，只保留模型与历史结构上的扩展口。

## 3. 需求修正与冲突处理

### 3.1 “有源图片 = 图片编辑”需要拆分

当前交互中，源图片存在时表单标题和提交语义会偏向“编辑图片”。图生文同样依赖源图片，因此不能继续用“是否有源图片”作为唯一模式判断。

修正为：

- 源图片只是输入资产，不直接决定任务类型。
- 工作台需要引入显式任务模式，例如：
  - `image-generate`
  - `image-edit`
  - `image-to-text`
- 当源图片存在时，默认仍可保持现有“编辑图片”体验，但“图生文”按钮可用，用户点击后进入独立任务模式。

### 3.2 多模态理解模型不应混入图片模型注册表

`gpt-5.5`、`gpt-5.4` 这类模型的核心语义是图片输入、文本输出，参数集合与 `gpt-image-2` 这类图片生成模型不同。

修正为：

- 新增独立的 `VisionTextModelDefinition` 或更通用的 `ContentModelDefinition`。
- 现有 `ImageModelDefinition` 继续只描述图片生成/图片编辑模型。
- 图生文供应商模型在 UI 上可以切换，但不能出现在图片生成模型下拉里。

### 3.3 “模型自动切换”需要保留用户上下文

需求里提到点击“图生文”后模型从文生图模型切换到图生文模型。这里如果直接覆盖同一个 `model` 状态，会导致用户返回图片生成时丢失原来的图片模型选择。

修正为：

- 图片任务保留 `selectedImageProviderInstanceId`、`selectedImageModelId`。
- 图生文任务单独保留 `selectedVisionTextProviderInstanceId`、`selectedVisionTextModelId`。
- 切换任务模式时只切换“当前显示的模型选择器”，不覆盖另一类任务的选择。

### 3.4 提交按钮文案可以变，但主操作位置保持

用户提出仍点击“开始生成”。为了减少认知成本，主按钮位置可以保持不变；但进入图生文模式后，按钮文案建议改为“生成文本”或“开始图生文”，避免误以为会出图。

首版建议：

- 普通文生图：`开始生成`
- 源图编辑：`开始编辑`
- 图生文：`生成文本`

### 3.5 图生文提示词应允许为空

图片编辑必须有编辑提示词，但图生文很多场景只需要用户上传图片后点击分析。

修正为：

- 图生文模式下，如果已有源图片，用户指导词可以为空。
- 用户指导词为空时，使用系统默认任务，例如“分析图片并输出可复用的文生图提示词”。
- 如果用户选择“自由问答”任务，仍建议提示用户输入问题，但不强制。

## 4. 用户场景

### 4.1 设计图反推文生图提示词

用户上传一张海报、KV、商品图或 UI 截图，点击“图生文”，模型输出：

- 可直接用于文生图的主提示词。
- 负向提示词。
- 风格、构图、光照、色彩、镜头、材质、比例建议。
- 图片中可见文字与布局说明。

用户可以一键“发送到生成器”，系统把主提示词回填到提示词框并切回图片生成模型。

### 4.2 图片信息提取

用户上传图片，输入“提取图片中的商品信息，用电商上架文案格式输出”，模型输出结构化商品信息、卖点、场景、材质和注意事项。

### 4.3 UI 设计规范提取

用户上传 UI 设计图，输入“提取可复用的界面设计规范”，模型输出布局层级、组件、色彩、字体、间距、状态和可转写为 prompt 的视觉要求。

### 4.4 历史图片复用

用户从历史图片或全屏预览中选择“图生文”，系统把该图片放入源图片区并自动切换到图生文模式。

## 5. 交互设计

### 5.1 入口

首版入口建议包括：

1. 提示词工具栏：在“润色”按钮右侧新增“图生文”按钮。
2. 源图片预览卡：每张源图可提供“分析”快捷入口。
3. 历史卡片/全屏预览：为已有图片提供“图生文”或“生成提示词”入口。

其中提示词工具栏入口是 MVP 必做。

### 5.2 “图生文”按钮状态

| 状态 | 条件 | 表现 |
| --- | --- | --- |
| 禁用 | 没有源图片 | 灰色禁用，tooltip 提示“添加源图片后可用” |
| 可用 | 已添加至少一张源图片，当前不是图生文模式 | 普通按钮状态 |
| 激活 | 当前任务模式为图生文 | 高亮选中状态，按钮 `aria-pressed=true` |
| 运行中 | 正在图生文流式输出 | 保持高亮，显示 loading 或禁用重复提交 |

### 5.3 模式切换

点击“图生文”后：

- 表单标题切换为“图生文”或“图片理解”。
- 提示词 placeholder 切换为“可选：描述你希望模型从图片中提取什么，或要求反推文生图提示词”。
- 高级选项中的供应商/模型切换为多模态文本供应商和模型。
- 图片尺寸、质量、输出格式、蒙版、压缩率等图片生成参数隐藏。
- 展示图生文专属参数：任务类型、视觉 detail、输出格式、最大输出长度、是否流式输出。
- 主按钮文案切换为“生成文本”。

再次点击已激活的“图生文”按钮，建议回到源图片编辑模式；如果没有源图片，则回到文生图模式。

### 5.4 文本结果面板

现有 `ImageOutput` 只处理图片。首版应抽象为更通用的输出面板，或新增 `TextOutput` 后由上层根据任务模式切换。

文本结果面板需要支持：

- 流式追加文本。
- Markdown 渲染或纯文本模式，首版可先显示纯文本并保留换行。
- 生成中计时、取消、错误提示。
- 复制全部。
- 复制主提示词。
- 发送到生成器。
- 替换当前提示词。
- 追加到当前提示词。
- 保存到提示词模板或历史资产，模板保存可放到二期。

### 5.5 输出结构

默认图生文任务建议输出以下结构，便于后续解析和回填：

```json
{
  "summary": "图片简述",
  "prompt": "可直接用于文生图的主提示词",
  "negativePrompt": "负向提示词",
  "styleTags": ["风格标签"],
  "subject": "主体",
  "composition": "构图与镜头",
  "lighting": "光照",
  "colorPalette": "色彩",
  "materials": "材质与细节",
  "textInImage": "图片中文字",
  "aspectRatioRecommendation": "推荐比例",
  "generationNotes": "生成注意事项",
  "warnings": ["不确定或不可见的信息"]
}
```

流式输出期间先展示自然语言文本；请求完成后再解析结构化字段。如果端点不支持结构化输出，则保留纯文本，但 UI 仍允许复制全文和发送全文到生成器。

## 6. 供应商与模型管理

### 6.1 能力域拆分

现有供应商管理以图片生成模型为中心。图生文需要新增能力域：

```typescript
type ModelCapabilityDomain =
  | 'image_generation'
  | 'image_editing'
  | 'vision_text'
  | 'text_generation'
  | 'code_generation'
  | 'video_generation';
```

首版不要求一次性重构所有供应商，但新增图生文时应避免把未来扩展堵死。

### 6.2 MVP 数据结构

为降低改造范围，首版可新增独立配置：

```typescript
type VisionTextProviderKind = 'openai' | 'openai-compatible';

type VisionTextApiCompatibility = 'responses' | 'chat-completions';

type VisionTextProviderInstance = {
  id: string;
  kind: VisionTextProviderKind;
  name: string;
  apiKey: string;
  apiBaseUrl: string;
  apiCompatibility: VisionTextApiCompatibility;
  models: VisionTextModelDefinition[];
  isDefault?: boolean;
  reuseOpenAIImageCredentials?: boolean;
};

type VisionTextModelDefinition = {
  id: string;
  label: string;
  providerInstanceId?: string;
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;
  supportsVisionDetail: boolean;
  defaultDetail: 'auto' | 'low' | 'high' | 'original';
  maxImages: number;
  maxImageBytes?: number;
  maxOutputTokens?: number;
};
```

### 6.3 默认模型

内置图生文模型建议：

- `gpt-5.5`
- `gpt-5.4`

注意：

- 具体模型可用性、名称、输入输出模态和参数以 OpenAI 官方文档和用户账号权限为准。
- 不要把模型是否存在写死为唯一判断；用户必须可以手动添加兼容端点提供的模型 ID。
- 如果官方文档或账号实际返回不支持某模型，应在连接测试和请求错误中明确提示，而不是静默回退。

### 6.4 设置页调整

系统配置主菜单建议新增一项：

- 标题：`图生文与多模态`
- 描述：`配置图片理解、提示词反推和多模态文本输出模型。`

该页面包含：

1. 多模态供应商端点列表。
2. 新增 OpenAI / OpenAI-compatible 端点。
3. API Key、API Base URL、模型 ID。
4. 兼容模式选择：
   - Responses API。
   - Chat Completions Vision 兼容。
5. 默认图生文模型。
6. 默认视觉 detail。
7. 默认系统提示词。
8. 默认任务类型。
9. 是否启用结构化输出。
10. 是否默认流式输出。
11. 连接测试。

### 6.5 环境变量建议

新增环境变量：

```bash
VISION_TEXT_API_KEY=
VISION_TEXT_API_BASE_URL=
VISION_TEXT_MODEL_ID=gpt-5.5
VISION_TEXT_API_COMPATIBILITY=responses
VISION_TEXT_SYSTEM_PROMPT=
VISION_TEXT_DEFAULT_DETAIL=auto
VISION_TEXT_STREAMING_ENABLED=true
```

回退顺序建议：

1. 图生文专用 UI 配置。
2. 图生文专用环境变量。
3. 如果用户启用“复用 OpenAI 图片供应商凭证”，再读取当前 OpenAI provider instance。
4. OpenAI 官方默认 Base URL。

不要默认复用所有 OpenAI 图片供应商端点。兼容图片生成的端点不一定支持图片输入文本输出。

### 6.6 供应商分组展示

高级选项中，图生文模式下供应商选择器只显示多模态文本供应商：

- `OpenAI 官方`
- `OpenAI Compatible`
- 用户命名端点，例如“公司中转”“本地网关”“OpenRouter Vision”

不要在这里显示 Seedream、SenseNova 等纯图片生成端点，除非后续明确声明该端点支持 `vision_text`。

## 7. 请求与流式输出

### 7.1 Web API 路由

建议新增独立路由：

```text
src/app/api/image-to-text/route.ts
```

不要复用 `/api/images`，因为两者的输入输出、鉴权、日志、错误类型、流式协议都不同。

请求使用 `FormData`：

```text
providerInstanceId
model
apiCompatibility
prompt
systemPrompt
taskType
detail
responseFormat
maxOutputTokens
stream
image[0..n]
```

### 7.2 Tauri 桌面端

桌面端静态构建不会保留 Next API Routes，因此需要新增 Rust command：

```text
proxy_image_to_text
proxy_image_to_text_streaming
```

流式输出继续采用 Tauri Channel，与现有 OpenAI 图片流式预览隔离。

### 7.3 OpenAI 官方请求策略

OpenAI 官方优先走 Responses API，因为它更适合多模态、工具、流式和未来统一内容生成。

请求组织原则：

- `system` 输入放图生文系统提示词。
- `user` 输入包含用户指导词和一张或多张源图片。
- 图片输入统一从 `File` 转成 `data:` URL 或后端上传后的可访问 URL。
- `detail` 默认为 `auto`。
- 流式时消费文本 delta，并在结束事件中收集 usage 和最终结构化结果。

### 7.4 OpenAI-compatible 兼容策略

兼容端点差异很大，首版必须让用户选择兼容模式：

| 模式 | 适合端点 | 特点 |
| --- | --- | --- |
| `responses` | 兼容 OpenAI Responses API 的网关 | 未来扩展最好，流式事件更接近官方 |
| `chat-completions` | 只兼容 Chat Completions Vision 的端点 | 覆盖面更广，但结构化输出和事件格式更不稳定 |

如果用户选择的模式与端点不匹配，连接测试和请求错误应提示用户切换兼容模式。

### 7.5 SSE 事件协议

Web 流式输出建议统一成项目内部 SSE 协议，而不是直接暴露供应商原始事件：

```text
event: meta
data: {"provider":"openai","model":"gpt-5.5","taskType":"prompt_extraction"}

event: text_delta
data: {"delta":"A clean product shot"}

event: usage
data: {"input_tokens":1234,"output_tokens":456,"image_tokens":789}

event: final
data: {"text":"完整文本","structured":{...}}

event: error
data: {"message":"错误信息","status":429}

event: done
data: {}
```

前端只依赖内部事件类型：

- `text_delta`
- `usage`
- `final`
- `error`
- `done`

这样未来替换供应商或兼容模式时不会影响 UI。

### 7.6 非流式返回

非流式接口返回：

```json
{
  "text": "完整输出文本",
  "structured": null,
  "usage": {
    "input_tokens": 1234,
    "output_tokens": 456,
    "image_tokens": 789
  },
  "provider": "openai",
  "providerInstanceId": "vision:openai:default",
  "model": "gpt-5.5",
  "durationMs": 3200
}
```

## 8. 状态与历史

### 8.1 前端状态

建议新增状态：

```typescript
type WorkbenchTaskMode = 'image-generate' | 'image-edit' | 'image-to-text';

type VisionTextState = {
  providerInstanceId: string;
  model: string;
  taskType: VisionTextTaskType;
  detail: 'auto' | 'low' | 'high' | 'original';
  stream: boolean;
  maxOutputTokens?: number;
  resultText: string;
  structuredResult?: ImageToTextStructuredResult;
};
```

### 8.2 历史记录

不要把文本结果塞进现有图片历史 `HistoryMetadata`。建议新增内容历史：

```typescript
type ContentHistoryEntry =
  | ImageHistoryEntry
  | ImageToTextHistoryEntry;

type ImageToTextHistoryEntry = {
  id: string;
  type: 'image-to-text';
  timestamp: number;
  taskType: VisionTextTaskType;
  prompt: string;
  resultText: string;
  structuredResult?: ImageToTextStructuredResult;
  sourceImages: Array<{
    filename: string;
    path?: string;
    storageModeUsed?: 'fs' | 'indexeddb' | 'remote';
  }>;
  providerInstanceId: string;
  providerInstanceName: string;
  model: string;
  durationMs: number;
  usage?: ProviderUsage;
};
```

MVP 可以先不做历史持久化，但文本结果面板至少要在当前页面保留最近一次结果。若做历史，应同步规划云同步 scope。

### 8.3 与提示词历史的关系

- 用户输入的指导词可以进入提示词历史。
- 模型生成的主提示词不应自动进入提示词历史，避免污染；用户点击“发送到生成器”或“保存为模板”后再保存。
- “发送到生成器”应切回图片生成模式，并保留源图片是否继续存在由用户决定。

## 9. 任务类型与默认系统提示词

### 9.1 内置任务类型

```typescript
type VisionTextTaskType =
  | 'prompt_extraction'
  | 'image_description'
  | 'design_spec'
  | 'ocr_and_layout'
  | 'freeform_qa';
```

首版默认 `prompt_extraction`。

### 9.2 默认系统提示词要求

默认系统提示词需要约束模型：

- 只描述图片中可见或可合理推断的视觉信息。
- 不编造人物真实身份、品牌来源、地点或不可见细节。
- 输出优先服务于“可再生成”的提示词。
- 明确区分确定信息与不确定信息。
- 保留图片中的文字信息，但不要擅自补全看不清的字。
- 生成提示词时避免依赖具体原图文件名或本地路径。

## 10. 权限、安全与隐私

1. 图生文必须由用户显式点击触发，不自动分析刚添加的图片。
2. 源图片不会因为图生文自动同步到云端；云同步是否包含源图由现有图片同步配置控制。
3. 客户端直连时 API Key 会暴露在浏览器 Network 中，设置页需沿用现有安全提示。
4. 服务器中转必须继续做 Base URL 安全校验，避免 SSRF。
5. 桌面 Rust command 也要复用现有 URL 安全策略和图片大小限制策略。
6. 错误日志不得输出完整 API Key、完整图片 base64 或敏感系统提示词。
7. 大图需要限制单文件体积和总输入体积；超过限制时提示用户压缩或自动降采样。
8. 人像、证件、医疗、财务截图等敏感图片不做特殊上传白名单，但错误和历史记录中不要泄露图片内容。

## 11. 边界情况

| 场景 | 期望行为 |
| --- | --- |
| 没有源图片 | 图生文按钮禁用 |
| 有源图片但指导词为空 | 允许提交，使用默认任务 |
| 多张源图 | 按用户添加顺序发送，系统提示词中要求逐图编号 |
| 模型只支持单图 | UI 限制或提交前提示只保留第一张 |
| 端点不支持流式 | 自动降级非流式，或提示关闭流式 |
| 端点不支持结构化输出 | 展示纯文本，隐藏字段级复制按钮 |
| 源图来自历史 IndexedDB | 提交前解析为 File/Blob |
| 源图来自远程 URL | 走现有安全图片代理或下载成 Blob 后提交 |
| 用户切回图片生成 | 保留图生文结果，不清空图片模型选择 |
| 请求中取消 | 停止追加流式文本，忽略后续 stale 事件 |
| 429/限流 | 显示供应商、模型、端点名和可重试建议 |

## 12. 分阶段实施建议

### Phase 0：需求与架构准备

- 完成本文档。
- 新建 `docs/requirements/`，迁移根目录需求/规划文档。
- 确认 OpenAI 官方当前多模态模型、Responses API、流式事件格式和 Vision 输入格式。

### Phase 1：Web MVP

- 新增图生文配置类型、默认配置和设置页入口。
- 新增 `image-to-text` API route。
- 前端新增“图生文”按钮和 `TextOutput` 面板。
- 支持 OpenAI 官方 `gpt-5.5` / `gpt-5.4`。
- 支持 OpenAI-compatible 端点手动配置 API Key、Base URL、模型 ID。
- 支持流式文本输出。
- 支持复制、发送到生成器。

### Phase 2：桌面端与历史

- 新增 Tauri Rust `proxy_image_to_text` 和 `proxy_image_to_text_streaming`。
- 文本结果进入内容历史。
- 历史卡片和全屏预览增加“图生文”入口。
- 云同步增加文本结果历史 scope。

### Phase 3：统一 AI 工作台基础

- 抽象 `ContentProviderInstance` 和 `ContentModelDefinition`。
- 统一图片、文本、图生文、未来视频模型的能力描述。
- 统一任务队列、历史记录、费用估算、流式事件和结果面板。

### Phase 4：复合型 AI 工作站

- 文本生成。
- 多模态对话。
- 代码生成。
- 文生视频/图生视频。
- 多步骤工作流：图生文 -> 文生图 -> 图像编辑 -> 视频生成 -> 文案输出。

## 13. 验收标准

### 13.1 产品验收

- 添加源图片后，“图生文”按钮可用；未添加源图片时不可用。
- 点击“图生文”后按钮高亮，表单进入图生文模式。
- 高级选项展示多模态供应商和模型，不展示图片尺寸/质量/蒙版参数。
- 可以使用默认系统提示词从图片生成文本。
- 可以用用户指导词控制输出方向。
- 文本结果面板支持流式输出。
- 流式完成后可以复制全文。
- 可以把主提示词发送回图片生成器。
- 切回图片生成器后，原图片模型选择未丢失。

### 13.2 技术验收

- OpenAI 官方和 OpenAI-compatible 分支相互隔离。
- 图生文模型没有进入 `ImageModelDefinition` 列表。
- Web 端服务器中转和客户端直连都遵循现有连接策略。
- 桌面端不依赖 Next API Route。
- 流式事件使用项目内部协议，不把供应商原始事件直接耦合到 UI。
- Abort/cancel 后不会继续写入旧结果。
- API Key、Base64 图片和系统提示词不会被完整写入日志。

### 13.3 测试用例

单元测试：

- 图生文配置归一化。
- Provider instance 选择与默认值。
- 模型能力判断。
- 请求体组装。
- SSE 事件解析。
- 结构化结果解析。
- 图生文/图片生成模型状态互不覆盖。

集成测试：

- OpenAI 官方非流式。
- OpenAI 官方流式。
- OpenAI-compatible Responses 模式。
- OpenAI-compatible Chat Completions 模式。
- 错误响应、限流、取消。

人工验收图片：

- 人像照片。
- 商品图。
- 海报/KV。
- UI 截图。
- 信息图/图表。
- 多张参考图。

## 14. 参考资料

- OpenAI Models 文档：<https://developers.openai.com/api/docs/models>
- OpenAI `gpt-5.5` 模型文档：<https://developers.openai.com/api/docs/models/gpt-5.5>
- OpenAI `gpt-5.4` 模型文档：<https://developers.openai.com/api/docs/models/gpt-5.4>
- OpenAI Images and Vision 指南：<https://developers.openai.com/api/docs/guides/images-vision>
- OpenAI Responses API 文档：<https://developers.openai.com/api/docs/api-reference/responses>
