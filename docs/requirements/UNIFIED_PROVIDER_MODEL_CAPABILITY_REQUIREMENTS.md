---
title: 统一供应商与模型能力管理需求文档
summary: 将当前按功能分散的图片生成、图片编辑、图生文、提示词润色供应商配置，演进为统一供应商端点与模型能力目录，支持预置模型、模型列表接口发现、大型聚合中转归一化、自定义模型 ID 与用户能力覆盖。
createdAt: 2026-05-15
status: draft-requirement
---

# 统一供应商与模型能力管理需求文档

## 1. 背景

GPT Image Playground 当前已经支持多类模型能力：

- 图片生成与图片编辑：通过 `providerInstances`、`customImageModels`、`model-registry` 管理 OpenAI Compatible、Google Gemini、Seedream、SenseNova 等供应商和模型能力。
- 图生文与多模态文本输出：通过 `visionTextProviderInstances`、`vision-text-model-registry`、`vision-text-executor` 管理独立的端点、模型和请求兼容模式。
- 提示词润色：通过 `polishingApiKey`、`polishingApiBaseUrl`、`polishingModelId` 等字段维护另一套 OpenAI-compatible 文本模型配置。

这种实现能支撑当前功能，但随着文生图、图像编辑、图生文、文生视频、图生视频、音频、推理/思考模型、多模态模型继续扩展，会出现明显问题：

- 同一个供应商或同一个中转端点需要在多个设置区重复填写 API Key、Base URL 和模型 ID。
- 模型能力被写死在功能专属 registry 中，跨功能复用困难。
- 模型列表接口尚未接入，用户无法从端点自动读取可用模型。
- 大型聚合中转可能一次返回很多上游厂商的很多模型，命名规则和能力标注方式会更杂，不能继续用简单字符串下拉处理。
- 用户自定义模型 ID 只能局部生效，能力标注也只覆盖当前功能域。
- 前端任务选择模型时缺少统一筛选逻辑，后续新增视频、音频会继续复制一套配置。

本需求文档定义新的目标形态：一个供应商端点只配置一次，端点下的模型统一进入模型能力目录；不同前端任务按能力筛选模型并调用对应执行器。

## 2. 目标

### 2.1 产品目标

1. 用户在一个统一入口中管理所有供应商端点，包括官方 API、OpenAI-compatible 中转、自托管网关、公司代理和不同账号额度池。
2. 每个端点可以自动读取模型列表，也可以继续使用项目预置模型和用户手动添加的自定义模型 ID。
3. 每个模型拥有统一能力标注，用来表示它支持图片生成、图片编辑、图生文、文本生成、推理、文生视频、图生视频、音频等能力。
4. 系统能根据预置规则、模型列表元数据和模型 ID 启发式推断默认能力；默认推断无法覆盖或不准确时，用户可以手动覆盖。
5. 前端所有功能入口只展示当前任务可用的模型，同时允许高级用户显式启用“未分类/自定义标注”的模型。
6. 现有配置需要平滑迁移，不能破坏用户已有 API Key、Base URL、自定义图片模型、图生文端点、润色模型和默认选择。

### 2.2 技术目标

1. 将“供应商凭证/端点”和“模型能力”解耦。
2. 将图片模型 registry、图生文模型 registry、润色模型配置逐步收敛到统一模型目录。
3. 为 Web API Route、客户端直连、Tauri Rust 代理保留各自请求路径，不因统一配置破坏跨运行时能力。
4. 保留 URL 安全、密钥遮蔽、客户端直连限制、桌面端代理等现有安全边界。
5. 为后续新增视频、音频等模型类型提供扩展点，而不是每新增一个功能就新增一套供应商设置。

## 3. 非目标

首轮不要求一次性实现所有未来能力：

- 不要求立刻实现文生视频、图生视频、音频生成、语音识别等执行链路。
- 不要求所有供应商的模型列表接口一次性全部接入；可以先支持 OpenAI-compatible，再按适配器扩展。
- 不要求模型能力自动推断 100% 准确；必须允许用户手动覆盖。
- 不把 API Key、环境变量、服务端密钥同步到模型目录或云同步明文数据中。
- 不削弱 `validatePublicHttpBaseUrl`、`getClientDirectLinkRestriction`、`normalizeOpenAICompatibleBaseUrl` 等安全检查。

## 4. 核心概念

### 4.1 供应商端点

供应商端点表示一次可调用的 API 配置，而不是某个单一功能。

建议数据概念：

```typescript
type ProviderEndpoint = {
  id: string;
  provider: ProviderKind;
  name: string;
  apiKey: string;
  apiBaseUrl: string;
  protocol: ProviderProtocol;
  isDefault?: boolean;
  enabled?: boolean;
  modelDiscovery?: ModelDiscoverySettings;
};
```

其中：

- `provider` 表示供应商或兼容类型，例如 `openai-compatible`、`openai`、`google-gemini`、`volcengine-ark`、`sensenova`。
- `protocol` 表示请求协议或兼容接口，例如 `openai-responses`、`openai-chat-completions`、`openai-images`、`gemini-generate-content`、`ark-openai-compatible`。
- 一个供应商可以有多个端点，例如官方端点、公司中转、不同账号、不同地域。
- 同一个端点可以服务多个任务，只要模型能力和执行器支持。

### 4.2 模型能力目录

模型能力目录表示“某个端点下某个模型能做什么”。

建议数据概念：

```typescript
type ModelCatalogEntry = {
  id: string;
  rawModelId: string;
  providerEndpointId: string;
  provider: ProviderKind;
  label: string;
  displayLabel?: string;
  upstreamVendor?: string;
  source: 'builtin' | 'remote' | 'custom';
  enabled: boolean;
  capabilities: ModelCapabilities;
  defaults?: ModelTaskDefaults;
  capabilityConfidence?: 'high' | 'medium' | 'low';
  remoteMetadata?: Record<string, unknown>;
  updatedAt?: number;
};
```

能力建议拆成任务域和特性域：

```typescript
type ModelTaskCapability =
  | 'image.generate'
  | 'image.edit'
  | 'image.maskEdit'
  | 'vision.text'
  | 'text.generate'
  | 'text.reasoning'
  | 'prompt.polish'
  | 'video.generate'
  | 'video.imageToVideo'
  | 'audio.speech'
  | 'audio.transcribe'
  | 'embedding.create';

type ModelCapabilities = {
  tasks: ModelTaskCapability[];
  inputModalities: Array<'text' | 'image' | 'audio' | 'video'>;
  outputModalities: Array<'text' | 'image' | 'audio' | 'video' | 'embedding'>;
  features?: {
    streaming?: boolean;
    structuredOutput?: boolean;
    toolUse?: boolean;
    reasoning?: boolean;
    imageMask?: boolean;
    customImageSize?: boolean;
    outputFormat?: boolean;
    outputCompression?: boolean;
    background?: boolean;
    moderation?: boolean;
  };
};
```

### 4.3 能力标注来源与覆盖优先级

同一个模型的能力可能来自多个来源，需要明确优先级：

1. 用户手动覆盖：最高优先级，可启用/禁用任务能力、修改默认尺寸、输出格式、流式、结构化输出等。
2. 项目预置模型定义：例如 `gpt-image-2`、Seedream、Gemini、SenseNova 的已知能力。
3. 供应商适配器推断：根据 `/models`、`listModels` 等返回元数据推断。
4. 模型 ID 启发式：例如 `gpt-image` 倾向图片生成/编辑，`gemini` 可能多模态，`seedream` 倾向图片生成。
5. 未分类默认值：只进入“未分类模型”，不自动出现在具体任务下拉中，除非用户手动标注。

覆盖结果需要可解释：UI 中应能看到某个能力来自“预置”“接口发现”“名称推断”还是“用户覆盖”。

### 4.4 大型聚合中转的模型发现与归一化

大型中转或聚合网关的模型目录通常有几个特征：

- 模型数量大，且会随账号、地域、套餐、权限变化。
- 同一端点下会混入多个上游厂商的模型。
- 模型 ID 可能带有厂商前缀、路由前缀、版本号、区域标记或运营商自定义前缀。
- 有些端点会返回更接近“展示名”的字段，有些只返回裸模型 ID。
- 模型列表里往往同时存在图片、文本、推理、向量、音频、视频等多种类型。

建议采用以下归一化原则：

1. 永远保留 `rawModelId` 作为真实请求值，任何展示或归一化都不得覆盖它。
2. 为目录条目增加稳定的 `catalogEntryId`，至少保证 `endpointId + rawModelId` 唯一。
3. 将 `displayLabel`、`upstreamVendor`、`modelFamily`、`capabilityConfidence`、`source` 视为展示与筛选字段，不作为请求真值。
4. 对 `vendor/model`、`vendor:model`、`vendor::model`、`vendor-model` 这类格式，只把前缀当作提示，不把它当作能力事实。
5. 如果上游返回 `owned_by`、`provider`、`family`、`modalities`、`capabilities` 之类字段，优先当作提示元数据使用，但仍要允许用户覆盖。
6. 默认只在任务可用、已启用、最近使用、搜索命中的子集里展示大目录模型，其余折叠到“全部发现模型”。
7. 大目录必须支持搜索、筛选、虚拟渲染或分页式浏览，不能把上千个模型一次性铺到设置页里。
8. 同名模型在不同端点下不能自动合并。不同端点即使 rawModelId 相同，也必须分别管理。
9. 对低置信度模型，默认进入“未分类”而不是自动进入具体任务下拉，避免误选。

### 4.5 参考 Cherry Studio 的取舍

Cherry Studio 的供应商管理思路对本项目有直接参考价值，尤其是以下几点：

- 默认内置很多供应商，而不是要求用户先理解“怎么接一个 provider”。
- 支持自动获取完整模型列表，降低手工维护成本。
- 支持多个 API Key 和自定义供应商，适合中转、聚合和多账号场景。
- 用更强的品牌/图标/来源标识，帮助用户区分模型来源。
- 以供应商层做参数适配，而不是为每个模型单独硬编码参数。

但本项目不能直接照搬 Cherry Studio 的产品重心：

- Cherry Studio 以通用对话、助手、知识库和工具市场为中心。
- 本项目的核心是图形、视频、音频与相关的创作工作流，文本对话只是辅助面。
- 因此供应商管理要服务于“创作模型选择”和“能力驱动任务执行”，不能服务于聊天列表本身。
- 不建议把助手市场、会话驱动的多模型对比，作为供应商设置主线。

因此，建议采用“骨架相似，重心不同”的方案：

1. 借鉴其“内置很多厂商 + 一键获取模型 + 自定义供应商”的骨架。
2. 将供应商包按任务域分层，默认优先展示创作相关模型，而不是把所有通用文本模型平铺到首屏。
3. 对于通用大模型、推理模型、聚合中转、图像模型、视频模型、音频模型，全部纳入同一目录，但在 UI 中按能力分区。
4. 仅在多账号或大目录场景中启用多秘钥轮询、收藏、最近使用、默认优先级等增强能力，避免让普通用户被复杂度淹没。
5. 对接入层保持 `provider pack + protocol adapter` 的双层结构，以便像 Cherry Studio 一样快速增加新厂商，但又不会把创作场景的参数适配做碎。

## 5. 功能需求

### 5.1 统一供应商设置

1. 系统设置中新增或改造为“供应商与模型”入口，替代当前图片供应商、图生文端点、提示词润色凭证的分散配置，并内置一批默认供应商包，参考 Cherry Studio 的“开箱即用”思路。
2. 用户新增端点时选择供应商/协议，填写名称、API Key、Base URL，可选设置默认端点。
3. 同一个端点下展示模型列表，并按能力分组或筛选：
   - 图片生成
   - 图片编辑
   - 图片理解/图生文
   - 文本/润色
   - 推理/思考
   - 视频
   - 音频
   - 未分类
4. 用户可以在端点中手动添加自定义模型 ID。添加后模型进入目录，但默认只应用保守能力，需要用户确认或系统推断后才出现在任务选择器中。
5. 用户可以隐藏某个模型、禁用某个能力，避免模型列表过长或误用。
6. 仍需支持多个端点和默认端点；默认端点应可以按任务域分别设置，例如默认图片生成端点、默认图生文端点、默认润色端点。
7. 默认内置供应商包不应以对话产品为中心排序，而应优先覆盖图形、视频、音频和多模态理解场景；通用文本/推理模型可作为辅助层。

### 5.2 模型列表接口读取

1. 每个支持发现的端点提供“刷新模型列表”操作。
2. 刷新时根据端点协议调用对应模型列表接口，但要把“发现模型”和“决定可用模型”拆开。
   - OpenAI-compatible：优先走标准模型列表接口。
   - Gemini：使用 Gemini 模型列表适配器。
   - 大型聚合中转：优先保留原始模型 ID、原始显示名和上游厂商提示，不要先做强行去前缀或合并。
   - 其他供应商：先保留适配器接口，未实现时展示“不支持自动读取”。
3. Web 服务器中转模式应通过 API Route 调用模型列表，避免浏览器 CORS 和密钥暴露。
4. 客户端直连模式可在端点支持 CORS 时直接读取；不支持时提示切换中转或手动添加模型。
5. Tauri 桌面端需要对应 Rust command 或复用桌面请求代理，不能只实现 Web API Route。
6. 刷新结果要本地缓存，记录来源、刷新时间、错误信息。刷新失败不能清空已有模型。
7. 对超大模型目录，刷新和渲染都要支持增量化：
   - 如果适配器支持分页或搜索参数，优先做服务器侧过滤。
   - 如果不支持，前端只做本地搜索和分组，不在初次打开时强制展开全量列表。
   - 低置信度或未分类模型默认不进入任务下拉，只在“全部发现模型”中可见。
8. 模型列表接口通常无法完整说明能力，因此刷新只负责发现模型 ID 和基础元数据，能力仍需预置、推断或用户覆盖。
9. 刷新后的目录应能保存 `rawModelId`、`displayLabel`、`upstreamVendor`、`source`、`capabilityConfidence` 等信息，但不要求把完整远程原始响应长期同步保存。

### 5.3 自定义模型 ID

1. 用户可以在任意端点下添加任意非空模型 ID。
2. 自定义模型 ID 需要绑定端点，避免同名模型在不同中转中含义不同。
3. 如果同一个模型 ID 在多个端点出现，应显示为多个目录条目，而不是合并成一个全局模型。
4. 用户可以为自定义模型设置：
   - 显示名称。
   - 支持的任务能力。
   - 输入/输出模态。
   - 默认参数，例如图片尺寸、输出格式、最大输出 token、视觉 detail。
   - 供应商专用默认参数，例如 Seedream 的 `response_format`、`watermark`。
5. 自定义模型必须通过配置规范化保护旧数据，未知字段忽略，非法值回退安全默认值。

### 5.4 模型选择与任务执行

1. 前端各任务不再直接读功能专属模型列表，而是向模型目录查询“当前任务可用模型”。
2. 任务选择器的值必须绑定到 `catalogEntryId`，而不是只绑定裸模型字符串；真正请求时再映射回 `rawModelId`。
3. 图片生成只显示具备 `image.generate` 的模型。
4. 图片编辑只显示具备 `image.edit` 的模型；蒙版编辑入口只对具备 `image.maskEdit` 的模型启用。
5. 图生文只显示具备 `vision.text` 的模型。
6. 提示词润色应使用具备 `prompt.polish` 或 `text.generate` 的模型，而不是单独维护一套 API Key/Base URL。
7. 未来文生视频、图生视频、音频任务按相同模型目录筛选。
8. 如果当前选中模型失效或能力被移除，UI 应回退到该任务默认模型，并提示用户。
9. 未分类模型默认不进入任务下拉；用户手动标注能力后立即可用。

### 5.5 能力覆盖 UI

1. 模型详情中展示能力卡片，允许用户按任务启用/禁用。
2. 对图片能力保留现有高级字段：
   - 支持编辑。
   - 支持蒙版。
   - 支持自定义尺寸。
   - 支持质量、格式、背景、审核、压缩、流式预览。
   - 默认尺寸和尺寸预设。
3. 对图生文/文本能力新增字段：
   - API 兼容模式：Responses / Chat Completions。
   - 是否支持流式输出。
   - 是否支持结构化输出。
   - 默认视觉 detail。
   - 最大输入图片数、最大图片大小、最大输出 token。
4. 对推理模型新增字段：
   - 是否支持 reasoning/thinking。
   - thinking 参数格式和默认 effort。
5. 覆盖 UI 需要有“恢复自动推断/恢复预置”的入口，避免用户改错后只能删除重建。

## 6. 配置与迁移需求

### 6.1 现有配置迁移

迁移必须读取并保留以下现有字段：

- `providerInstances`
- `selectedProviderInstanceId`
- `customImageModels`
- `visionTextProviderInstances`
- `selectedVisionTextProviderInstanceId`
- `visionTextModelId`
- `visionTextTaskType`
- `visionTextDetail`
- `visionTextResponseFormat`
- `visionTextStreamingEnabled`
- `visionTextStructuredOutputEnabled`
- `visionTextMaxOutputTokens`
- `visionTextSystemPrompt`
- `visionTextApiCompatibility`
- `polishingApiKey`
- `polishingApiBaseUrl`
- `polishingModelId`
- `polishingThinkingEnabled`
- `polishingThinkingEffort`
- `polishingThinkingEffortFormat`

迁移规则：

1. 现有 `providerInstances` 转为统一端点，保留原 ID 或建立可追踪映射。
2. 现有 `customImageModels` 转为端点绑定的模型目录条目和用户能力覆盖。
3. 现有 `visionTextProviderInstances` 转为统一端点；如果 `reuseOpenAIImageCredentials` 为真，应优先映射到现有 OpenAI 图片端点。
4. 现有图生文默认模型和任务默认值迁移为 `vision.text` 任务配置。
5. 现有润色 API Key/Base URL 如与某端点相同则复用端点；否则创建一个文本端点并标记为提示词润色默认端点。
6. 老字段在至少一个版本周期内继续读取，避免旧 localStorage、云同步配置、分享配置直接失效。

### 6.2 持久化要求

1. 新配置仍保存在 localStorage 的应用配置中，结构必须可规范化、可忽略未知字段。
2. 密钥仍只作为端点配置字段存在，不写入模型能力目录的远程元数据中。
3. 云同步时沿用现有敏感信息处理策略，不新增明文泄露面。
4. 配置导入旧版本后如果无法识别新模型目录，至少不能破坏旧字段读取。

## 7. Web 与 Tauri 运行时需求

1. Web 中转路径新增模型发现 API Route，例如 `/api/provider-models` 或等价命名。
2. 桌面端新增或复用 Tauri Rust 代理命令读取模型列表，遵守桌面代理模式、调试模式和错误格式。
3. 功能代码不得直接导入 Tauri API，应继续通过 `src/lib/desktop-runtime.ts`。
4. 客户端直连读取模型列表时必须继续执行公开 URL 安全检查，不能允许 Base URL 静默指向 localhost、私网 IP 或其他不安全目标。
5. 模型发现失败时只影响刷新动作，不能阻塞已有生成、编辑、图生文、润色任务。

## 8. UI 与体验要求

1. 设置页保持 utilitarian 工作台风格，不引入营销页式布局。
2. 能力标签、筛选器、启用开关、刷新按钮、恢复默认按钮应支持移动端触控。
3. 每个 UI 改动必须在浅色和深色主题下检查。
4. 模型列表较长时需要搜索和按能力筛选，不能让设置页无限增长到不可用。
5. 搜索应同时匹配原始模型 ID、显示名、上游厂商、能力标签和当前任务能力，不要只按文本前缀做模糊过滤。
6. 任务表单里的模型选择器应显示端点名、模型名和关键能力标签，避免同名模型来自不同端点时混淆。
7. 大型聚合中转下的模型列表需要支持折叠分组或虚拟列表，避免一次性渲染大量条目。
8. 用户选择未知能力模型执行任务时，必须先显式标注能力；不能让用户点提交后才得到“unsupported model”。
9. 自动刷新模型列表不应发生在首次渲染热路径；默认采用用户手动刷新，后续可增加可控的后台刷新。

## 9. 测试与验收

### 9.1 单元测试

需要覆盖：

1. 旧配置到新配置的迁移和规范化。
2. 模型能力合并优先级：用户覆盖 > 预置 > 接口元数据 > 启发式 > 未分类。
3. 同名模型在不同端点下不会错误合并。
4. 自定义模型 ID 的能力覆盖、默认参数、非法字段回退。
5. 按任务能力筛选模型。
6. 模型发现失败不会清空已有模型。
7. OpenAI-compatible Base URL 继续按现有规则规范化和安全校验。

### 9.2 集成测试

需要覆盖：

1. 图片生成、图片编辑、图生文、提示词润色都能从统一端点和模型目录取得凭证与模型。
2. Web API Route 与 Tauri Rust 代理分支行为一致，至少覆盖成功、401/403、网络失败、返回空模型列表。
3. 客户端直连模式下不支持 CORS 时给出明确提示，手动模型仍可使用。
4. 迁移后现有用户配置不丢失，默认模型仍能正确回填。

### 9.3 UI 验收

需要覆盖：

1. 浅色/深色主题下设置页、模型列表、能力覆盖、任务模型选择器都可读。
2. 移动端设置页模型列表不溢出、不遮挡、不出现横向滚动。
3. 同一个端点只填写一次凭证，图片生成、图生文、润色可以按能力复用同一端点。
4. 用户手动添加一个模型 ID 后，可以通过能力标注让它出现在指定任务中。
5. 刷新模型列表后，新发现模型进入未分类或推断分组，并可被用户标注。

## 10. 分阶段实施建议

### 阶段一：统一数据模型与迁移

- 新增 `ProviderEndpoint`、`ModelCatalogEntry`、`ModelCapabilities` 类型和规范化函数。
- 把默认供应商包抽象为可扩展的 registry，后续通过 pack / adapter 增量补厂商，而不是把厂商逻辑写进页面。
- 将现有 `providerInstances`、`customImageModels`、`visionTextProviderInstances`、润色配置迁移到新结构。
- 保留旧字段读取和必要的镜像写入，降低一次性改造风险。

### 阶段二：模型目录查询与任务筛选

- 将图片生成/编辑、图生文、润色的模型选择器改为从统一目录按能力查询。
- 现有执行链路可暂时保持，只改凭证和模型解析来源。
- 添加能力覆盖 UI，先覆盖当前已存在的图片、图生文、润色能力。

### 阶段三：模型列表自动发现

- 实现 OpenAI-compatible 模型列表读取。
- 增加 Web API Route 与 Tauri Rust 命令。
- 增加刷新缓存、错误状态、手动刷新 UI。
- 后续补 Gemini、Seedream、SenseNova 等供应商适配器。

### 阶段四：扩展新任务域

- 按相同模型目录扩展文生视频、图生视频、音频、更多推理模型能力。
- 每新增一个任务，只新增任务执行器和能力字段，不再新增一套供应商凭证设置。

## 11. 开放问题与建议结论

1. 统一端点的 `provider` 枚举不建议同时承担“品牌”和“协议”两种职责。最佳实践是拆成两层：`providerFamily` 负责 UI、权限和凭证归类，`protocol` 负责请求适配器和序列化方式。这样以后聚合中转、原厂接口和不同兼容协议可以共存，不会把一个枚举撑爆。
2. 模型列表接口返回的远程元数据不建议完整长期持久化。建议只持久化白名单字段和用于展示/筛选的安全元数据，完整原始响应只放短期缓存或调试日志，并做大小限制。这样既能回溯问题，又不会让配置膨胀或意外同步敏感内容。
3. 云同步不建议默认同步模型发现缓存。更合理的是只同步用户手动添加的模型、能力覆盖、启用状态和默认选择；发现缓存应视为设备本地的可再生数据。原因是模型列表会随账号、地域、上游商户和权限频繁变化，同步缓存反而容易造成脏数据。
4. 提示词润色建议保留独立的专用 UI 区块，但底层凭证和模型选择应接入统一端点与模型目录。因为润色流程有独立的系统提示词、预设和思考参数，完全并入通用模型设置会损失可用性；保留专用入口更符合用户心智，也利于渐进迁移。
5. 对同一个端点下大量模型，默认不建议直接展示全部。默认视图应优先显示“已启用”“当前任务可用”“最近使用”“搜索命中”，其余模型折叠进“全部发现模型”或“未分类”区域。这样既减少设置页噪音，也避免聚合中转目录把用户淹没。
