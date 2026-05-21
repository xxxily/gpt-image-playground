---
title: 统一供应商配置复用与设置体验重构需求文档
summary: 基于现有供应商端点、统一模型目录、图生文端点、提示词润色配置和视频生成 v2 需求，规划把 API Key、Base URL、模型发现和任务默认模型收敛到一个可复用的供应商管理体验中，让图生文、多模态、提示词润色、批量规划、视频等功能按能力选择已配置端点和模型。
createdAt: 2026-05-21
updatedAt: 2026-05-21
status: draft-requirement
---

# 统一供应商配置复用与设置体验重构需求文档

## 1. 背景

项目最初以图片生成和图片编辑为核心，供应商设置自然围绕图片模型展开。后续加入图生文、多模态文本输出、提示词润色、批量规划和视频生成后，系统配置出现了多套并行入口：

- 图片生成与编辑使用 `providerInstances` 管理 OpenAI Compatible、Google Gemini、Seedream、SenseNova 等端点。
- 图生文与多模态使用 `visionTextProviderInstances` 单独管理 API Key、Base URL、兼容模式和模型列表。
- 提示词润色使用 `polishingApiKey`、`polishingApiBaseUrl`、`polishingModelId` 等独立字段。
- 统一模型目录已经存在 `providerEndpoints`、`modelCatalog`、`modelTaskDefaultCatalogEntryIds`，并支持从端点读取模型列表，但设置 UI 和工作台选择器仍没有完全围绕它组织。

这导致用户在“供应商 API 配置”里已经填过某个中转端点和 API Key 后，仍需要在“图生文与多模态”和“提示词润色配置”中再次手动录入同一套端点和 Key。统一模型目录能发现模型，但用户在具体功能里无法自然地选择“已配置供应商 -> 已发现模型 -> 应用到当前功能”，整体体验显得割裂。

本需求文档聚焦“配置复用与设置体验重构”。它与 `UNIFIED_PROVIDER_MODEL_CAPABILITY_REQUIREMENTS.md` 和 `VIDEO_GENERATION_REQUIREMENTS_v2.md` 互补：

- `UNIFIED_PROVIDER_MODEL_CAPABILITY_REQUIREMENTS.md` 定义模型能力目录的长期架构。
- 本文定义用户如何少录入、少重复、按功能选择并安全迁移。
- `VIDEO_GENERATION_REQUIREMENTS_v2.md` 必须在本文的统一配置闭环之后推进，不能先做一套独立视频供应商设置再回头迁移。

## 2. 当前代码事实

本需求基于以下现状：

- `src/lib/provider-model-catalog.ts` 已定义统一端点和模型目录：
  - `ProviderEndpoint`
  - `ModelCatalogEntry`
  - `ModelTaskCapability`
  - `getModelCatalogEntriesForTask`
  - `resolvePromptPolishCatalogSelection`
  - `resolveVisionTextCredentialsFromCatalog`
- `src/lib/model-discovery.ts`、`src/app/api/provider-models/route.ts`、`src-tauri/src/proxy/provider_models.rs` 已提供 OpenAI-compatible 模型发现的 Web / Tauri 路径。
- `src/components/settings-dialog.tsx` 已有三个并行设置入口：
  - `providers`：图片供应商 API 配置。
  - `vision-text`：图生文与多模态专用端点。
  - `polish-prompts`：提示词润色 API Key、Base URL、模型 ID、思考参数和提示词预设。
- `src/components/editing-form.tsx` 的图生文高级选项仍基于 `appConfig.visionTextProviderInstances` 选择供应商和模型。
- `src/lib/prompt-polish.ts` 调用 `resolvePromptPolishCatalogSelection`，底层已经能从统一目录取 `prompt.polish` 默认项，但 UI 仍主要暴露单独的润色 API Key / Base URL / Model ID。
- 视频生成 v2 的当前状态是：`video.generate`、`video.imageToVideo` 能力、视频执行器、Web API 路由和本地视频历史结构已经存在，但视频模式的高级选项、设置页默认模型、历史 tab 仍未形成闭环。
- `src/lib/config.ts` 仍同时持有旧字段和统一目录字段，说明改造必须兼容旧配置、分享链接、导入导出和云同步。

结论：底层已经有统一目录雏形，主要缺口在产品信息架构、设置 UI、功能默认选择、迁移策略和工作台选择器收敛。

## 3. 问题定义

### 3.1 重复录入凭证

同一个供应商端点在以下位置重复输入：

- 图片供应商端点。
- 图生文端点。
- 提示词润色 API 配置。
- 视频、音频、批量规划如果继续各自扩展，也会继续重复。

这会带来维护成本：Key 轮换、Base URL 变更、账号切换都需要多处修改，用户容易漏改。

视频生成 v2 已经进入代码骨架阶段，如果不先完成统一配置，视频供应商、视频默认模型和工作台高级选项会先落到临时逻辑里，后续还要再次迁移。

### 3.2 模型发现结果没有自然应用到功能配置

供应商端点可以刷新模型列表，模型也进入 `modelCatalog`。但在图生文和润色设置中，用户仍需要理解“另一个端点列表”或手动输入模型 ID。用户期望的是：

1. 先选择已配置供应商端点。
2. 系统读取或复用该端点下的模型目录。
3. 按“图生文 / 提示词润色 / 文生视频”等能力筛选模型。
4. 选择模型并保存为对应功能默认值。

### 3.3 设置分区表达了错误的心智模型

当前“图生文与多模态”页面文案强调“不会混入图片生成供应商”，这在早期为了避免模型列表污染是合理的。但统一目录已经能按能力过滤，继续把端点完全分开，会让用户误以为同一 OpenAI-compatible 网关在不同功能中是不同资源。

正确心智模型应该是：

- 供应商端点是连接资源，只配置一次。
- 模型能力决定它能用于哪些任务。
- 任务设置只保存默认选择和任务参数，不重复保存凭证。

### 3.4 提示词润色缺少端点/模型选择器

润色设置目前仍以手动输入 Key、Base URL、Model ID 为主。它应该支持：

- 选择已配置端点。
- 从该端点已发现模型中选择文本模型或润色模型。
- 为润色任务保留思考模式、预设顺序、自定义润色提示词等任务级配置。
- 仍允许输入临时或自定义端点，但默认将其保存为可复用端点，而不是一次性孤立字段。

## 4. 目标

### 4.1 产品目标

1. 用户只需要在统一入口录入一次供应商端点、API Key 和 Base URL。
2. 图生文、多模态、提示词润色、批量规划、视频等功能都能选择已配置端点和该端点下的模型。
3. 任务设置页面不再默认要求重复填写 API Key / Base URL，而是以“选择已有端点 + 选择模型”为主。
4. 高级用户仍可以手动输入新的端点、Key、Base URL 和模型 ID；手动输入后应明确选择“保存为可复用端点”或“仅本次/仅此功能使用”。
5. 模型目录按能力筛选，避免图片模型、视觉理解模型、文本模型、视频模型混在同一个无差别下拉中。
6. 旧配置平滑迁移，不丢失用户已有图片供应商、图生文端点、润色模型、默认选择、ENV fallback 和历史任务参数。
7. 视频生成 v2 不新增平行供应商配置，文生视频、图生视频、Grok/xAI 等视频供应商全部通过统一端点和统一模型目录配置。

### 4.2 技术目标

1. 以 `providerEndpoints` 和 `modelCatalog` 作为新的配置主数据源。
2. 将 `providerInstances`、`visionTextProviderInstances`、`polishingApiKey` 等旧字段逐步降级为兼容读写层。
3. 将“任务默认模型”统一到 `modelTaskDefaultCatalogEntryIds` 或等价的任务绑定结构。
4. Web API Route、客户端直连、Tauri Rust 代理继续保持可用，不能因为统一配置破坏跨运行时。
5. 继续保留现有 URL 安全、密钥遮蔽、配置导出脱敏、分享链接默认不带 Key、云同步非敏感配置等安全边界。
6. 为视频任务提供可复用的端点 / 模型选择能力，让视频高级选项只消费统一配置，不再管理凭证。

## 5. 非目标

- 不要求一次性删除旧配置字段。旧字段应在至少一个兼容周期内保留。
- 不要求模型能力自动识别 100% 准确。低置信度模型必须允许用户手动标注能力。
- 不把所有模型展示到所有任务里。任务选择器必须按能力过滤。
- 不削弱 `validatePublicHttpBaseUrl`、`normalizeOpenAICompatibleBaseUrl`、`getClientDirectLinkRestriction` 等安全策略。
- 不把 API Key 明文同步到云端、分享链接或默认导出文件中。
- 不在本需求内完成视频历史、视频播放、视频同步和具体视频适配器实现；这些继续由 `VIDEO_GENERATION_REQUIREMENTS_v2.md` 承接。

## 6. 目标信息架构

### 6.1 设置首页

系统配置首页建议将相关入口调整为：

1. **供应商与模型**
   - 管理端点、API Key、Base URL、模型发现、模型能力、启用状态。
   - 替代当前“供应商 API 配置”作为主入口。
2. **功能默认模型**
   - 配置文生图、图像编辑、图生文、提示词润色、批量规划、文生视频、图生视频等默认端点和模型。
   - 可作为“供应商与模型”的子页，也可放在同一页的任务默认区。
   - 视频默认项只保存模型绑定，不保存视频任务运行态、历史或结果资产。
3. **提示词润色**
   - 只保留润色提示词预设、下拉顺序、思考参数、默认润色绑定。
   - API Key / Base URL 默认不作为主字段出现，改为“连接来源”选择。
4. **图生文与多模态**
   - 只保留图生文任务类型、视觉 detail、响应格式、流式、结构化输出、系统提示词、默认模型绑定。
   - 端点和模型从统一目录选择。

### 6.2 供应商与模型页面

页面分为四个区：

1. **端点列表**
   - 展示名称、供应商/协议、Base URL 主机名、Key 状态、最近刷新时间、模型数量、启用状态。
   - 支持新增、编辑、复制端点、设为默认、禁用、删除。
2. **模型发现**
   - 每个端点支持刷新模型。
   - 刷新失败不清空旧模型。
   - 大模型目录支持搜索、筛选、折叠、分页或虚拟列表。
3. **模型能力**
   - 模型按能力分组：图片生成、图片编辑、图生文、文本/润色、视频、音频、未分类。
   - 支持启用/禁用模型、手动标注能力、恢复自动推断。
4. **任务默认**
   - 每个任务一行：选择端点、选择模型、显示能力状态、测试连接。
   - 如果模型不具备任务能力，必须提示用户先添加能力覆盖，不应静默保存。
   - 首版任务矩阵必须包含 `image.generate`、`image.edit`、`vision.text`、`prompt.polish`、`prompt.batchPlan`、`video.generate`、`video.imageToVideo`。

## 7. 核心交互需求

### 7.1 新增或编辑供应商端点

新增端点时，用户填写：

- 端点名称。
- 供应商类型或协议。
- API Key。
- API Base URL。
- 可选标签，例如“公司中转”“OpenAI 官方”“本地网关”“视频专用”。
- 默认启用的模型发现方式。

保存后：

- 端点进入 `providerEndpoints`。
- 如果该端点与旧图片端点或图生文端点凭证相同，应去重并保留引用关系。
- 用户可以立即刷新模型，也可以稍后刷新。

### 7.2 从已配置端点选择图生文模型

图生文设置页的主路径应是：

1. 选择“连接来源”：默认显示“使用已有供应商端点”。
2. 端点下拉展示所有启用端点，并优先展示已有 `vision.text` 模型的端点。
3. 选择端点后，模型下拉只展示：
   - `vision.text`
   - 或用户勾选“显示未分类模型”后展示低置信度模型。
4. 如果该端点没有可用图生文模型，显示三种操作：
   - 刷新模型列表。
   - 手动添加模型 ID，并标注为图生文。
   - 进入统一模型目录为已发现模型添加 `vision.text` 能力。
5. 保存后，更新 `modelTaskDefaultCatalogEntryIds['vision.text']`，并保留图生文任务参数。

图生文页面不应要求用户再次录入 API Key / Base URL，除非用户主动选择“新增自定义端点”。

### 7.3 从已配置端点选择提示词润色模型

提示词润色设置页的主路径应是：

1. “连接来源”选择：
   - 使用已有供应商端点。
   - 新增并保存为供应商端点。
   - 高级：仅此功能自定义连接。
2. 模型下拉按以下优先级展示：
   - `prompt.polish`
   - `text.generate`
   - 用户勾选后展示未分类模型。
3. 选择模型后，润色模型默认值写入 `modelTaskDefaultCatalogEntryIds['prompt.polish']`。
4. 思考模式、思考强度、参数格式、润色预设、自定义提示词仍作为润色任务级配置保存，不写进供应商端点凭证。
5. 如果用户输入了自定义 Model ID：
   - 在当前端点下创建或更新 `ModelCatalogEntry`。
   - 默认添加 `prompt.polish` 和 `text.generate` 能力。
   - 标记 source 为 `custom`，confidence 为 `medium` 或用户确认后 `high`。

### 7.4 工作台高级选项选择器

工作台高级选项应逐步从旧结构迁移到统一目录：

- 图片生成/编辑：端点选择仍可按图片供应商分组展示，但数据来源应从 `providerEndpoints` + `modelCatalog` 读取。
- 图生文：端点选择不再读取 `visionTextProviderInstances`，改为读取支持 `vision.text` 的统一端点。
- 提示词润色：工具栏的润色按钮不需要用户每次选择，但设置中配置的默认目录项应直接决定请求端点和模型。
- 视频任务：继续使用统一目录中的 `video.generate`、`video.imageToVideo` 等能力，不新增并行视频供应商配置。

交互细节：

- 端点下拉文案格式建议为：`端点名称 · 供应商 · 主机名`。
- 模型下拉文案格式建议为：`显示名 / rawModelId · 来源 · 能力置信度`。
- 如果选择了来自另一个端点的模型，端点选择应同步切换，避免“端点 A + 模型 B”不一致。
- 每个选择器都要保留“手动输入模型 ID”入口，但手动模型必须绑定到当前端点。

### 7.5 视频默认模型选择

视频生成 v2 依赖本需求提供统一配置入口。首版要求：

1. “任务默认”区域新增文生视频和图生视频两行。
2. 文生视频只展示具备 `video.generate` 的模型。
3. 图生视频只展示具备 `video.imageToVideo` 的模型。
4. 如果某个端点没有视频模型，用户可以刷新模型、手动添加模型 ID，或进入能力标注界面给模型添加视频能力。
5. 视频任务默认参数如时长、比例、分辨率、提示词增强、原生音频等不写进 `ProviderEndpoint`，而写进视频任务默认配置。
6. xAI/Grok Imagine 作为视频供应商进入统一端点体系，新增 `provider: xai` 和 `protocol: xai-imagine-video`，内置模型至少包含 `grok-imagine-video`。
7. 未完成适配器的供应商可以进入目录和能力标注，但 UI 必须标注“适配器待实现”，不能让用户误以为已经可以生成。

### 7.6 自定义输入保留策略

用户仍需要能接入临时中转、自托管实验模型或尚未发现的模型。因此所有任务配置都要保留自定义路径：

- **保存为可复用端点**：默认推荐。保存后出现在供应商与模型页面。
- **仅此功能使用**：高级选项。只保存为任务绑定，不污染全局端点列表，但仍必须遵守安全校验和密钥遮蔽。
- **仅本次请求使用**：未来可选，不进入本次 P0。

如果用户选择“仅此功能使用”，UI 必须明确提示：后续其他功能不会自动复用该 Key 和端点。

## 8. 数据模型需求

### 8.1 主数据源

继续使用并强化：

```typescript
type ProviderEndpoint = {
  id: string;
  provider: ProviderKind;
  name: string;
  apiKey: string;
  apiBaseUrl: string;
  protocol: ProviderProtocol;
  enabled?: boolean;
  modelDiscovery?: ModelDiscoverySettings;
};

type ModelCatalogEntry = {
  id: string;
  rawModelId: string;
  providerEndpointId: string;
  provider: ProviderKind;
  label: string;
  source: 'builtin' | 'remote' | 'custom';
  enabled: boolean;
  capabilities: ModelCapabilities;
  defaults?: ModelTaskDefaults;
  capabilityConfidence?: 'high' | 'medium' | 'low';
};
```

任务默认值优先使用：

```typescript
type ModelTaskDefaultCatalogEntryIds = Partial<Record<ModelTaskCapability, string>>;
```

### 8.2 任务绑定扩展

如果 `modelTaskDefaultCatalogEntryIds` 无法承载任务级覆盖，应新增轻量结构：

```typescript
type FeatureModelBinding = {
  task: ModelTaskCapability;
  catalogEntryId?: string;
  providerEndpointId?: string;
  rawModelId?: string;
  customConnection?: {
    apiKey?: string;
    apiBaseUrl?: string;
    protocol?: ProviderProtocol;
  };
  taskOptions?: Record<string, unknown>;
};
```

适用场景：

- 图生文要保存 response format、detail、structured output。
- 提示词润色要保存 thinking 参数和 prompt preset。
- 批量规划复用润色连接但可能需要不同提示词。
- 视频任务要保存时长、比例、分辨率、轮询和同步策略，但不能把这些任务参数写进供应商端点。

P0 可以先不新增 `FeatureModelBinding`，但实现时要避免把任务参数硬塞到 `ProviderEndpoint`。

### 8.3 视频供应商与协议扩展

统一目录需要为视频生成 v2 预留并管理视频供应商。除当前代码已有的视频协议外，需要新增 Grok/xAI：

```typescript
type AdditionalVideoProviderKind =
  | 'xai';

type AdditionalVideoProviderProtocol =
  | 'xai-imagine-video';
```

`xai-imagine-video` 的首个内置模型目录项：

```typescript
{
  rawModelId: 'grok-imagine-video',
  provider: 'xai',
  capabilities: {
    tasks: ['video.generate', 'video.imageToVideo'],
    inputModalities: ['text', 'image'],
    outputModalities: ['video'],
    features: {
      video: {
        asyncJob: true,
        progressPolling: true,
        resultUrlExpires: true,
        inputImageUpload: 'multipart'
      }
    }
  }
}
```

官方文档同时提到 Grok Imagine 的视频编辑、视频扩展和参考图视频能力；首版可以先标注为后续能力，等适配器实现后再开启 `video.edit`、`video.extend`、`video.referenceToVideo`。

### 8.4 旧字段兼容

这些字段进入兼容层：

- `providerInstances`
- `selectedProviderInstanceId`
- `visionTextProviderInstances`
- `selectedVisionTextProviderInstanceId`
- `visionTextModelId`
- `polishingApiKey`
- `polishingApiBaseUrl`
- `polishingModelId`

视频当前没有独立旧供应商字段。实现时不能新增需要迁移的 `videoProviderInstances`，只能新增统一目录字段、任务默认绑定和视频任务默认值。

读取时：

- 旧字段生成统一端点和目录项。
- 如果旧图生文端点与已有图片端点 Key 和 Base URL 相同，应复用同一 `ProviderEndpoint`。
- 如果旧润色配置与已有端点相同，应把润色默认模型绑定到该端点，而不是创建重复端点。

保存时：

- 新 UI 优先保存统一目录字段。
- 为兼容旧代码路径，可以短期回写旧字段。
- 当所有运行路径改为统一目录后，再减少旧字段回写。

## 9. 迁移规则

### 9.1 去重规则

端点去重按以下优先级：

1. 完全相同的稳定 id。
2. 归一化后的 provider/protocol + API Base URL + API Key 指纹匹配。
3. 默认 OpenAI 空 Base URL 与 `https://api.openai.com/v1` 视为同源。
4. 只有模型相同但凭证不同，不合并。

API Key 指纹只用于本地比较，不应写入日志、同步数据或 UI。

### 9.2 图生文迁移

对每个 `visionTextProviderInstances`：

1. 查找同凭证统一端点。
2. 找到则复用端点，并把该实例 models 转成该端点下的 `ModelCatalogEntry`。
3. 未找到则创建新端点。
4. 给迁移出的模型添加 `vision.text` 和 `text.generate` 能力。
5. 将原 `selectedVisionTextProviderInstanceId` + `visionTextModelId` 映射为 `modelTaskDefaultCatalogEntryIds['vision.text']`。

### 9.3 提示词润色迁移

对 `polishingApiKey`、`polishingApiBaseUrl`、`polishingModelId`：

1. 如果 API Key / Base URL 为空，继续按 ENV 或 OpenAI fallback 解析，但 UI 应提示当前来源。
2. 如果与已有端点匹配，复用该端点。
3. 如果不匹配且任一字段非空，创建名为“Prompt Polish”或用户可编辑的端点。
4. 将 `polishingModelId` 写入对应端点下的目录项，并添加 `prompt.polish`、`prompt.batchPlan`、`text.generate` 能力。
5. 将默认润色模型映射为 `modelTaskDefaultCatalogEntryIds['prompt.polish']`。

### 9.4 视频默认模型初始化

视频任务当前没有完整设置 UI。统一配置落地时应初始化：

1. 如果已有 `modelTaskDefaultCatalogEntryIds['video.generate']` / `['video.imageToVideo']`，保留原值。
2. 如果目录中存在已完成适配器的视频模型，优先绑定真实可用模型。
3. 如果只有占位协议，不自动设为默认，只进入“可配置但适配器待实现”列表。
4. xAI/Grok 的内置项可以进入目录，但在适配器完成前不得自动成为默认模型。

### 9.5 回滚与旧版本兼容

- 新版本保存配置时保留旧字段至少一个版本周期。
- 旧版本读取新配置时仍能使用旧字段继续运行。
- 配置导入时如果发现 masked Key，不应覆盖已有真实 Key。
- 分享链接接收时，如果带 providerInstanceId，应尝试映射到统一端点。

## 10. 运行时与安全要求

1. Web 服务器中转模式继续通过 API Route 调用供应商。
2. Tauri 桌面端必须通过 `src/lib/desktop-runtime.ts` 封装和 Rust proxy，不在业务组件直接引入 Tauri API。
3. 客户端直连模式继续遵守 CORS 限制和 `getClientDirectLinkRestriction` 提示。
4. Base URL 必须继续走现有规范化和安全校验，不允许静默扩大到 localhost、私网地址或不安全协议。
5. API Key 默认遮蔽；复制、导出、同步、分享都不能默认泄露明文 Key。
6. 模型发现请求失败时保留已有模型目录和默认选择。
7. ENV fallback 需要可见但不可编辑为明文。UI 可以显示 `ENV` 状态 badge。

## 11. UI 与 i18n 要求

1. 所有新增和修改的可见文案必须进入 `src/lib/i18n/*`，保持支持语言同步。
2. 不使用 `window.alert`、`window.prompt`、`window.confirm`。
3. 设置页需要在浅色和深色主题下都可读，继续使用现有 CSS 变量和语义容器。
4. 移动端设置页必须能完成新增端点、刷新模型、选择默认模型、手动添加模型。
5. 大模型目录必须有搜索和过滤，不允许把上千模型平铺导致滚动和渲染卡顿。
6. 能力低置信度模型必须有明确视觉提示，不能伪装成已确认可用模型。
7. 删除端点前，如果它被任一任务默认值引用，必须显示影响范围，并提供改选目标。

## 12. 分阶段实施建议

### Phase 1：统一设置体验的最小闭环

- 在图生文设置页新增“使用已有供应商端点”模式。
- 在提示词润色设置页新增“使用已有供应商端点 + 模型目录选择”模式。
- 保存时更新 `modelTaskDefaultCatalogEntryIds['vision.text']` 和 `modelTaskDefaultCatalogEntryIds['prompt.polish']`。
- 保留旧字段回写，确保现有执行链路不坏。
- 在任务默认矩阵里预留 `video.generate`、`video.imageToVideo` 两行，但不在此阶段实现视频历史和视频适配器。

### Phase 2：工作台选择器切到统一目录

- `editing-form.tsx` 图生文供应商选择从 `visionTextProviderInstances` 迁到 `providerEndpoints`。
- 图片生成/编辑选择器逐步改为统一端点 + 模型目录。
- 选择模型时同步端点，避免端点和模型错配。
- 视频高级选项后续必须复用这里沉淀出的统一端点 / 模型选择组件。

### Phase 3：设置页信息架构收敛

- 将“供应商 API 配置”和“统一模型目录”合并为“供应商与模型”。
- 将图生文和润色页面里的 API Key / Base URL 输入降级到“新增自定义端点”或“高级自定义连接”。
- 增加任务默认模型矩阵。
- 增加 xAI/Grok Imagine 的供应商类型、协议、内置模型目录项和“适配器待实现”状态。

### Phase 4：对接视频生成 v2

- 视频模式高级选项读取统一目录中的 `video.generate` / `video.imageToVideo` 默认项。
- 视频设置区只保留任务参数、轮询、历史和同步策略。
- Grok/xAI、Veo、Runway 等视频协议按适配器完成度逐个从“占位”切换为“可用”。
- 开始推进 `VIDEO_GENERATION_REQUIREMENTS_v2.md` 的视频历史 tab、同步、任务恢复和真实适配器开发。

### Phase 5：清理旧字段依赖

- 执行路径改为统一目录解析。
- 旧字段只作为导入和旧版本恢复兼容。
- 更新用户文档、截图和配置说明。

## 13. 验收标准

1. 用户在供应商与模型中新增一个 OpenAI-compatible 端点并刷新模型后，图生文设置能直接选择该端点和可用视觉模型，无需再次输入 Key / Base URL。
2. 同一端点下发现的文本模型可以被设置为提示词润色默认模型，无需再次输入 Key / Base URL / Model ID。
3. 如果模型没有被自动识别为图生文或润色能力，用户可以在模型目录手动添加能力后再选择。
4. 手动输入自定义模型 ID 时，系统会把它绑定到当前端点，并可选择保存为可复用目录项。
5. 旧用户已有的图生文端点、润色配置和默认模型在升级后仍可用，并在新 UI 中能看到对应来源。
6. Web 代理、客户端直连、Tauri 桌面代理三种路径下，图生文和润色都能解析到同一个选中的端点和模型。
7. 配置导出默认不包含明文 Key；导入 masked 配置不会覆盖本机已有真实 Key。
8. 删除或禁用正在被任务默认值引用的端点时，系统提示影响范围并阻止无替代的静默删除。
9. 所有新增文案完成中英文 i18n，同一流程在浅色、深色、移动端和桌面宽屏布局下可用。
10. 视频默认模型可以在统一任务默认矩阵里配置，但不会出现第二套视频 API Key / Base URL 表单。
11. xAI/Grok Imagine 在供应商与模型中可被识别为视频供应商；适配器未完成前显示为“待实现”，不能提交视频任务。

## 14. 测试要求

建议覆盖：

- `provider-model-catalog`：
  - 旧图片端点、图生文端点、润色配置迁移成统一端点。
  - 同凭证去重。
  - 默认任务模型映射。
  - 手动能力覆盖优先级。
- `config`：
  - load/save 对旧字段和新字段的兼容。
  - masked 导入不覆盖真实 Key。
- `model-discovery`：
  - 刷新失败不清空目录。
  - 大型聚合模型 ID 不被错误合并。
- `prompt-polish`：
  - 从目录默认项解析 endpoint/model。
  - 旧 `polishingApiKey` fallback 仍可用。
- `vision-text`：
  - 从目录默认项解析 endpoint/model。
  - 旧 `visionTextProviderInstances` fallback 仍可用。
- `video`：
  - 从目录默认项解析 `video.generate` / `video.imageToVideo`。
  - 未完成适配器不会被误判为可提交。
  - xAI/Grok 内置模型具备正确能力标注。
- UI：
  - 已配置端点 -> 刷新模型 -> 图生文选择 -> 保存 -> 工作台执行。
  - 已配置端点 -> 文本模型 -> 润色选择 -> 保存 -> 润色执行。
  - 已配置视频端点 -> 视频模型选择 -> 保存默认项 -> 视频高级选项读取该默认项。
  - 手动添加模型并标注能力。
  - 浅色 / 深色 / 移动端布局。

## 15. 文档更新要求

实现该需求时需要同步更新：

- `docs/providers-and-settings.md`
- `docs/prompt-workflow.md`
- `docs/generation-editing.md`
- `docs/requirements/VIDEO_GENERATION_REQUIREMENTS_v2.md`
- `docs/desktop-and-deployment.md`
- `README.md` 中涉及供应商配置和提示词润色的说明。

如果实现只改内部迁移逻辑、不改变用户可见行为，可以在 PR 说明中明确“不需要用户文档更新”。

## 16. 待决策问题

1. P0 是否新增 `FeatureModelBinding`，还是先继续复用 `modelTaskDefaultCatalogEntryIds` + 现有任务字段。
2. “仅此功能自定义连接”是否进入首版，还是统一保存为可复用端点。
3. 端点去重是否允许用户手动合并，还是只做自动匹配并保守保留重复项。
4. 图生文和润色的默认模型是否允许选择 `text.generate` 但未标注专用能力的模型。
5. 云同步是否同步 `providerEndpoints` 中不含 Key 的端点元数据，还是继续完全依赖本地配置。
6. 视频默认模型矩阵是否允许选择适配器待实现的模型作为“未来默认”，还是只允许选择可提交模型。
