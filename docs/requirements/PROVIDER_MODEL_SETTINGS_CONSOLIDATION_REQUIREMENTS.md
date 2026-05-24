---
title: 供应商与模型设置深度整合需求文档
summary: 将图片生成/编辑、图生文、多模态文本、提示词润色、视频等分散配置，收敛为 endpoint-first 的供应商与模型主数据体系；任务页只消费供应商与模型中的能力模型，不再各自维护凭证孤岛。
createdAt: 2026-05-23
updatedAt: 2026-05-24
status: implemented-ui-ia-baseline
---

# 供应商与模型设置深度整合需求文档

## 0. 评估结论

当前初版方向是对的：应该从“按功能各配一套供应商”改成“供应商端点配置一次，模型按能力被不同任务消费”。这个方向能解决重复录入 Key、模型列表割裂、图生文/润色凭证孤岛、视频供应商不可见等问题。

但初版还需要补强几类决策，否则后续实现容易变成“界面合并了，底层仍然分裂”：

1. 必须明确主数据方向。`providerEndpoints`、`modelCatalog`、`modelTaskDefaultCatalogEntryIds` 是最终收敛结构；旧字段只允许作为迁移、兜底或兼容路径存在。
2. 必须避免破坏性切换。当前实现先收敛信息架构和主入口，旧字段保留在折叠兼容区，等执行链路稳定后再减少写回。
3. 必须把“端点资源”和“任务默认值”分开。供应商与模型页只管理连接、发现、白名单和能力元数据；图像、图生文、润色、视频设置页管理任务如何消费这些模型。
4. 必须区分“发现模型”和“已纳管模型”。远端返回的模型可以很多，但只有用户选中的模型才进入日常任务下拉和默认绑定。
5. 必须把不可用状态设计出来。低置信度能力、未选择模型、适配器待实现、端点禁用、连接失败都不能表现成“可正常提交”。
6. 必须要求 Web、客户端直连、Tauri 桌面代理语义一致。统一配置不能只改 Web UI，桌面静态导出和 Rust proxy 也要能消费同一份主数据。

2026-05-24 的实际落地基线采用更保守的产品信息架构：**供应商与模型** 成为端点、凭证、模型读取、模型纳管和能力标注的主入口；其下新增 **供应商端点管理** 统一入口，集中维护文本、图片、视频端点、API Key、Base URL 和模型白名单；**图片模型端点管理** 与 **视频端点管理** 变为分类管理视图；**模型能力检视** 下沉为供应商与模型内的高级工具；**图生文与多模态** 负责任务默认模型与任务参数，**提示词润色配置** 只负责显式的端点/模型选择与润色参数。旧图生文连接暂时保留为折叠兼容区；旧润色 API Key/Base URL/裸模型 ID 直接移除，润色只消费统一端点管理中的 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点及其模型，且不会自动生成润色默认模型。

本文在保留原目标的基础上，把需求整理成可以直接拆任务、验收和实现的版本；后续实现应以该落地基线为准，避免再把“统一模型目录”恢复成系统设置主菜单中的并列入口。

## 1. 背景

项目当前已经出现统一配置的底座，但设置体验仍然分散：

- 图片生成/编辑主要由 `providerInstances`、`customImageModels`、图片模型 registry 驱动。
- 图生文与多模态仍有独立的 `visionTextProviderInstances`、模型列表、兼容模式和默认模型。
- 提示词润色的独立 API Key、Base URL、裸模型 ID 入口已移除，后续只从统一端点管理中选择 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点及其模型。
- 统一底座已经存在：`providerEndpoints`、`modelCatalog`、`modelTaskDefaultCatalogEntryIds`、`src/lib/provider-model-catalog.ts`。
- 视频供应商和视频能力已经进入统一能力枚举，但设置入口仍偏补丁式，尚未成为完整的信息架构。

这些问题最终体现在用户侧：

- 同一 API Key 和 Base URL 要在多个页面重复填。
- 用户分不清“供应商”“模型目录”“图生文供应商”“润色模型”之间的关系。
- 远端模型列表很多，但日常下拉不应该被海量模型淹没。
- 配置页看似完整，任务页却可能找不到模型，或者找到的是另一个配置体系里的模型。
- 视频供应商如果只是藏在 OpenAI Compatible 里，用户无法理解真实品牌、协议和适配状态。

本次改造的核心不是再加一个设置页，而是重新定义供应商、端点、模型、任务默认值之间的所有权。

## 2. 范围与非目标

### 2.1 本次范围

本次需求覆盖：

- 设置页信息架构重构。
- 统一供应商端点编辑器。
- 模型发现、批量选择、白名单纳管。
- 模型能力标注、低置信度处理、适配状态展示。
- 图像生成/编辑、图生文、多模态文本、提示词润色、批量规划、视频任务默认模型选择。
- Web API Route、客户端直连、Tauri Rust proxy 对统一配置的消费边界。
- 旧配置到新主数据的一次性导入策略。

### 2.2 非目标

本次不要求：

- 一次性接完所有视频厂商真实执行适配器。
- 实现音频、向量、对话助手等完整任务流程。
- 让模型能力自动推断 100% 准确。
- 长期保留旧配置 UI 和旧字段双写。
- 把服务端环境变量、API Key、同步数据、分享链接变成明文密钥传播渠道。

## 3. 核心决策

### 3.1 采用 endpoint-first 主数据

系统最终只保留三类核心主数据：

| 主数据 | 责任 |
| --- | --- |
| `providerEndpoints` | 端点、凭证、Base URL、协议、启用状态、发现状态、模型白名单 |
| `modelCatalog` | 端点下的模型元数据、能力、来源、置信度、默认参数、适配状态 |
| `modelTaskDefaultCatalogEntryIds` | 每个任务能力默认使用哪一个目录模型 |

旧字段不再作为产品主路径：

- `providerInstances`
- `customImageModels`
- `visionTextProviderInstances`
- `selectedVisionTextProviderInstanceId`
- `visionTextModelId`
- 提示词润色独立 API Key/Base URL/Model ID（已移除，不再作为兼容字段）

这些字段不应继续作为用户日常配置入口。当前落地策略允许图片和图生文旧字段在折叠兼容区、导入导出和旧运行路径中继续存在；提示词润色旧连接字段不再兼容，执行链路必须消费 `providerEndpoints`、`modelCatalog` 和 `modelTaskDefaultCatalogEntryIds`。

### 3.2 保守迁移，避免破坏性切换

本次不做“打开新版后立即丢弃旧配置”的破坏性迁移。推荐策略：

1. UI 信息架构先收敛：供应商与模型是主入口，其下分为供应商端点管理、图片模型端点管理、视频端点管理和模型能力检视；任务页只配置任务默认和任务参数。
2. 旧图生文连接只放在折叠兼容区，不再作为新用户主路径；旧润色 API Key/Base URL/裸模型 ID 直接移除。
3. 保存时继续保留图片与图生文必要兼容字段，保证旧配置、分享链接、云同步和桌面静态包不会突然失效；润色连接不再写回旧字段。
4. 新增端点、新默认模型和能力标注优先写入统一主数据。
5. 等 Web、客户端直连、Tauri proxy 和导入导出都稳定读取统一主数据后，再移除兼容 UI 和旧字段写回。

这比立即破坏性迁移更符合当前代码状态：用户心智先统一，运行时风险后收敛。

### 3.3 端点是资源，任务是消费者

`供应商与模型` 页面只管理资源：

- 供应商品牌。
- 协议。
- API Key。
- Base URL。
- 启用/禁用。
- 连接测试。
- 模型发现。
- 已纳管模型白名单。
- 模型能力、特性、来源、置信度。
- 只读使用情况。

任务设置页管理消费方式：

- 任务默认端点/模型。
- 任务内常用模型排序。
- 任务参数默认值。
- 任务级显示/隐藏。
- 当前任务缺模型时的修复入口。

供应商与模型页可以提示“该模型可用于文生图/图生文/视频”，但不直接承担这些任务的默认参数配置。

### 3.4 发现模型不等于纳管模型

模型列表接口返回的是“可发现候选”。只有用户选择并确认后，模型才进入“已纳管模型”：

- 远端发现结果写入 `modelCatalog`，`source = remote`。
- 用户勾选添加后，把 `rawModelId` 写入对应端点的 `modelIds` 白名单。
- 任务下拉只展示端点白名单内、已启用、能力匹配、非待适配的模型。
- 空白名单表示端点尚未完成模型纳管，不表示“全部模型可用”。

### 3.5 能力置信度必须影响可选范围

模型能力分为任务能力和特性能力：

| 类型 | 示例 | 用途 |
| --- | --- | --- |
| 任务能力 | `image.generate`、`image.edit`、`vision.text`、`prompt.polish`、`prompt.batchPlan`、`video.generate`、`video.imageToVideo` | 决定任务选择器是否展示 |
| 特性能力 | streaming、structured output、reasoning、image mask、reference images、video async job、native audio、prompt enhance | 决定参数展示、提示和提交前校验 |

置信度规则：

- `high`：可进入对应任务选择器，可作为默认候选。
- `medium`：可进入任务选择器，但需要显示“推断能力”提示。
- `low`：默认进入未分类，不进入任务默认下拉；用户手动确认能力后才能使用。
- `adapter pending`：可以展示在目录中，但不能提交任务，不能自动成为默认模型。

## 4. 信息架构

设置页应从“多个配置孤岛”调整为“一个资源主入口 + 多个任务消费者”。

| 入口 | 定位 | 主要内容 |
| --- | --- | --- |
| 供应商与模型 | 主入口 | 供应商端点管理、图片模型端点管理、视频端点管理、模型能力检视四个分级入口 |
| 供应商端点管理 | 资源主数据 | 统一新增和维护文本、图片、视频端点、Key、Base URL、发现模型、已选模型白名单 |
| 图片模型端点管理 | 分类管理 | 按图片供应商查看图片生成/编辑端点，复用统一端点卡片和模型选择弹窗 |
| 视频端点管理 | 分类管理 | 按视频供应商模板查看视频端点、模型列表和适配状态，复用统一端点卡片和模型选择弹窗 |
| 图像生成与编辑 | 任务设置 | 文生图、图像编辑、蒙版编辑默认模型、常用模型、图片参数默认值 |
| 图生文与多模态 | 任务设置 | 图生文默认模型、detail、response format、streaming、structured output、system prompt、历史开关 |
| 提示词润色 | 任务设置 | 润色模型选择、批量规划模型选择、思考参数、润色预设、自定义润色提示词 |
| 视频任务默认值 | 任务设置 | 文生视频/图生视频默认模型、时长、比例、分辨率、轮询、重试 |
| 模型能力检视 | 高级工具 | 跨端点搜索、能力审计、低置信度模型定位、能力标注 |
| 运行与存储 | 环境设置 | 连接模式、并发数、历史、存储、同步、桌面代理 |

`统一模型目录` 不再作为与 `供应商与模型` 并列的主入口。它应下沉为 `供应商与模型` 内的“模型能力检视”高级区；端点新增、凭证和模型白名单管理统一放在“供应商端点管理”里，不放在能力检视里，也不分散到提示词润色等任务页里。

## 5. 数据模型要求

### 5.1 ProviderEndpoint

端点表示一次可调用 API 配置，不等于某个功能页面。

必须支持的语义：

- `id`：稳定端点 ID。
- `provider`：品牌或供应商类型，如 `openai`、`openai-compatible`、`google-gemini`、`aliyun-dashscope`、`runway`。
- `protocol`：请求协议或适配器，如 `openai-images`、`openai-responses`、`openai-chat-completions`、`openai-videos`、`dashscope-video-generation`。
- `name`：用户可编辑名称。
- `apiKey`：端点凭证，必须继续遵守密钥遮蔽和导出规则。
- `apiBaseUrl`：端点地址，必须继续经过安全校验。
- `enabled`：端点是否参与任务选择。
- `modelDiscovery`：最近刷新时间、错误、是否支持自动发现。
- `modelIds`：用户纳管的 `rawModelId` 白名单。
- `adapterStatus` 或等价元数据：真实可用、协议预留、适配器待实现。

白名单规则：

- `modelIds` 不存在或为空，都应按“没有完成纳管模型”处理。
- 不能把空白名单解释为“允许所有远端发现模型”。
- 白名单粒度是 `endpointId + rawModelId`，不同端点同名模型不能合并。

### 5.2 ModelCatalogEntry

模型目录项表示“某个端点下某个模型可以做什么”。

必须支持的语义：

- `id`：由 `providerEndpointId + rawModelId` 稳定生成。
- `providerEndpointId`
- `provider`
- `protocol`
- `rawModelId`：真实请求值，任何展示名不得覆盖它。
- `label` / `displayLabel`
- `upstreamVendor`
- `modelFamily`
- `source`：`builtin` / `remote` / `custom`
- `enabled`
- `capabilities`
- `capabilityConfidence`
- `defaults`
- `remoteMetadata`
- `updatedAt`

能力覆盖优先级：

1. 用户手动覆盖。
2. 项目预置定义。
3. 供应商适配器返回的元数据。
4. 模型 ID 启发式推断。
5. 未分类默认值。

UI 必须能解释能力来源，至少区分“预置”“接口发现”“名称推断”“用户覆盖”。

### 5.3 任务默认绑定

任务默认模型写入 `modelTaskDefaultCatalogEntryIds`。

首批任务能力：

| 任务 | 能力 |
| --- | --- |
| 文生图 | `image.generate` |
| 图像编辑 | `image.edit` |
| 蒙版编辑 | `image.maskEdit` |
| 图生文 | `vision.text` |
| 提示词润色 | `prompt.polish`，可 fallback 到 `text.generate` |
| 批量规划 | `prompt.batchPlan`，可 fallback 到 `text.generate` |
| 文生视频 | `video.generate` |
| 图生视频 | `video.imageToVideo` |

默认绑定校验：

- 默认 entry 必须存在。
- entry 所属端点必须 enabled。
- entry 必须在端点 `modelIds` 白名单内。
- entry 必须具备任务能力。
- entry 不能是适配器待实现的占位项。
- entry 为低置信度时，必须有用户确认记录。

### 5.4 任务级偏好可新增独立字段

以下配置不应塞进端点或模型目录：

- 任务内模型排序。
- 任务内常用模型。
- 任务内隐藏模型。
- 图片默认质量、输出格式、压缩率。
- 视频默认时长、比例、分辨率、轮询间隔。
- 图生文默认 detail、response format、system prompt。
- 润色提示词预设、按钮顺序。

如现有字段不足，可以新增任务级配置字段，例如：

- `imageTaskDefaults`
- `imageTaskModelPreferences`
- `visionTextTaskDefaults`
- `promptPolishTaskDefaults`
- `videoTaskDefaults`

但这些字段只能引用 `modelCatalog`，不能再次保存 API Key / Base URL。

## 6. 统一端点编辑器

所有“新增供应商/新增端点”入口必须调用同一个端点编辑器。入口可以来自设置页、图像任务页、图生文页、润色页或视频页，但最终写入同一份 `providerEndpoints` 和 `modelCatalog`。

### 6.1 创建流程

新增端点是连续流程：

1. 选择供应商模板。
2. 填写端点名称、API Key、Base URL。
3. 执行本地校验和 URL 安全校验。
4. 可选连接测试。
5. 保存端点。
6. 读取模型或进入手动添加。
7. 勾选要纳管的模型。
8. 确认能力和置信度。
9. 可选跳转到对应任务设置页。

保存端点后不能把用户丢回列表页。没有模型的端点应显示为“待补模型”，不能出现在任务默认候选中。

### 6.2 供应商模板分组

供应商模板按用户心智分组，但模板不限制最终能力，最终可用范围由模型能力决定。

| 分组 | 示例 |
| --- | --- |
| 图像 | OpenAI Images、OpenAI Compatible、Google Gemini、Seedream、SenseNova |
| 多模态/文本 | OpenAI Responses、OpenAI Chat Completions、OpenAI Compatible |
| 视频 | OpenAI Sora、Google Veo、DashScope / Wan、Runway、Luma、MiniMax、Kling、BytePlus ModelArk、Tencent Hunyuan、fal.ai、xAI |
| 自定义 | 自定义 OpenAI-compatible、自定义 HTTP 网关 |

模板需要展示：

- 品牌名称。
- 协议名称。
- 默认 Base URL 提示。
- 是否支持模型发现。
- 是否已实现执行适配器。
- 是否只是协议预留。

### 6.3 端点状态

端点至少需要这些状态语义：

| 状态 | 含义 | 是否进入任务下拉 |
| --- | --- | --- |
| Draft | 表单未保存 | 否 |
| Missing credentials | 缺 Key 或 Base URL | 否 |
| Connection failed | 连接测试失败 | 否，除非用户明确跳过测试并手动添加模型 |
| Needs models | 端点已保存但未纳管模型 | 否 |
| Ready | 至少有一个可用纳管模型 | 是 |
| Adapter pending | 协议或执行器待实现 | 否 |
| Disabled | 用户禁用 | 否 |

## 7. 模型发现与纳管

### 7.1 发现流程

模型发现必须是“读取并选择模型”，不是“刷新完就全量加入”。

必须支持：

- 搜索。
- 能力筛选。
- 来源筛选。
- 置信度筛选。
- 复选框多选。
- 全选当前筛选结果。
- 清空选择。
- 添加所选。
- 添加全部高置信度模型。
- 手动添加模型 ID。

刷新失败不能清空已有模型，也不能清空已纳管白名单。

### 7.2 列表展示

每个发现模型至少显示：

- raw model id。
- 展示名。
- 上游厂商。
- 来源。
- 推断任务能力。
- 关键特性。
- 置信度。
- 是否已纳管。
- 是否待适配。

大模型列表必须分页、折叠或虚拟化。不能一次性渲染上千行导致移动端卡顿。

### 7.3 手动添加

手动添加始终保留，因为很多私有模型或中转模型不会出现在模型列表接口中。

手动添加要求：

- 必须先选择或创建端点。
- 输入 raw model id。
- 可选展示名和上游厂商。
- 默认能力可以根据端点协议推断，但保存前必须允许用户确认。
- 低置信度模型不能自动进入任务默认候选。

### 7.4 远端模型缓存

发现结果可缓存在本地 `modelCatalog` 中：

- 保留 `source = remote`。
- 保留 `updatedAt`。
- 保留 `remoteMetadata`。
- 保留用户手动覆盖，不被下次刷新覆盖。
- 不在远端列表中出现的手动模型不能被自动删除。

## 8. 任务设置页面要求

### 8.1 统一任务模型选择器

所有任务默认模型选择都使用同一组件。

组件包含：

- 端点选择。
- 模型选择。
- 能力摘要。
- 适配状态提示。
- 当前模型不可用的修复提示。
- “去供应商与模型管理”入口。
- “新增端点”入口。

联动规则：

- 先选端点，再选模型。
- 如果用户选择某个模型，端点自动切到该模型所属端点。
- 不允许保存“端点 A + 模型 B”这种不一致状态。
- 没有可用模型时，提供读取模型、手动添加、能力标注三条路径。

### 8.2 图像生成与编辑

图像设置页负责图片任务如何消费统一目录，不再管理凭证。

应包含：

- 文生图默认模型。
- 图像编辑默认模型。
- 蒙版编辑默认模型。
- 图片任务常用模型和排序。
- 图片任务内显示/隐藏。
- 默认尺寸、质量、输出格式、压缩率、背景、moderation。
- 快捷新增图片端点或图片模型。

不应包含：

- API Key 主输入框。
- Base URL 主输入框。
- 与 `providerEndpoints` 脱钩的图片供应商表。

### 8.3 图生文与多模态

图生文页应从“供应商配置页”改为“任务配置页”。

保留：

- 默认端点/模型。
- 默认任务类型。
- detail。
- response format。
- streaming。
- structured output。
- max output tokens。
- system prompt。
- 图生文历史开关。

移除主路径：

- 独立图生文供应商列表。
- 独立图生文 API Key。
- 独立图生文 Base URL。
- “复用 OpenAI 图片供应商凭证”这类旧心智开关。

### 8.4 提示词润色

提示词润色页应从“API 配置 + 预设配置”改为“模型绑定 + 润色行为配置”。

保留：

- 默认润色模型。
- 默认批量规划模型。
- 思考模式。
- 思考强度。
- 思考参数格式。
- 默认预设。
- 自定义润色提示词。
- 润色按钮顺序。

移除主路径：

- 独立润色 API Key。
- 独立润色 Base URL。
- 独立润色模型 ID。

若短期保留旧字段，只能作为折叠的“导入旧配置”或“临时覆盖”工具，不能和新入口并列。

### 8.5 视频任务默认值

视频任务只消费统一目录中的视频能力模型。

要求：

- 文生视频只展示 `video.generate`。
- 图生视频只展示 `video.imageToVideo`。
- 占位适配器和待实现协议可展示但不可提交。
- 视频参数继续保存在任务默认值中，不写回端点。
- 从视频页新增端点时，默认进入视频供应商模板和模型选择步骤。

## 9. 运行时与架构要求

### 9.1 统一解析层

执行器和 UI 不应各自手写配置解析。需要有统一解析层：

- 输入：任务能力、配置、运行时模式、可选端点/模型覆盖。
- 输出：端点、模型目录项、请求模型 ID、协议、凭证、默认参数、不可用原因。

建议抽象：

- `resolveTaskModelSelection(task, config, options)`
- `getModelCatalogEntriesForTask(config, task, options)`
- `resolveProviderEndpointCredentials(endpoint, runtime)`

现有 `resolvePromptPolishCatalogSelection`、`resolveVisionTextCatalogSelection` 等可以收敛到统一接口，避免继续按任务复制 resolver。

### 9.2 Web、直连、Tauri 一致

统一配置不能只服务 Web。

要求：

- Web 服务器中转继续走 API Route。
- 客户端直连继续遵守 CORS、URL 安全和直连限制。
- Tauri 桌面端通过 `src/lib/desktop-runtime.ts` 调用 Rust command 或桌面代理。
- 模型发现 Web API Route 和 Tauri Rust proxy 返回相同归一化结构。
- 静态桌面导出不能依赖 Next.js API Route 才能完成本地任务。

### 9.3 安全要求

不得削弱现有安全边界：

- 继续使用 `normalizeOpenAICompatibleBaseUrl`、`validatePublicHttpBaseUrl`、`getClientDirectLinkRestriction` 等校验。
- 公网 Web 不得静默访问 localhost、内网 IP 或不安全地址。
- API Key 不得出现在日志、分享链接、同步明文、错误详情或截图提示中。
- 配置导入导出继续遵守密钥遮蔽策略。
- 连接测试和模型发现失败信息要可理解，但不能回显密钥。

### 9.4 性能要求

- 大目录发现和渲染要分页、折叠或虚拟化。
- 刷新模型列表不能阻塞首屏。
- 任务下拉只读已纳管可用模型，不扫描或渲染远端全量候选。
- 历史、同步、图片资产查找路径不能因为模型目录改造引入全量扫描。

## 10. 迁移策略

### 10.1 推荐迁移方式

推荐“主数据优先 + 折叠兼容 + 渐进迁移”。

流程：

1. 检测到旧字段存在且统一主数据缺失或版本较旧。
2. 优先把可映射字段规范化到新版供应商与模型主数据：
   - 图片供应商导入为统一端点。
   - 自定义图片模型导入为 `modelCatalog`。
   - 图生文端点导入为统一端点。
   - 图生文默认模型绑定到 `vision.text`。
   - 润色凭证不再导入为独立文本端点；用户从已存在或新添加的兼容端点中选择模型。
   - 润色模型绑定到 `prompt.polish` 和可选 `prompt.batchPlan`。
3. 旧图生文和润色直连字段继续显示在折叠兼容区，明确标注“迁移旧配置或临时覆盖”。
4. 新增连接、新默认模型、新能力覆盖优先写入统一结构。
5. 导出配置、云同步、分享链接和 Tauri 静态包继续保留必要兼容字段，直到执行路径全部完成迁移。
6. 旧 UI 不作为主路径展示。

### 10.2 写回策略

新版主路径优先写：

- `providerEndpoints`
- `modelCatalog`
- `modelTaskDefaultCatalogEntryIds`
- 任务级 defaults / preferences

兼容区字段可以继续写回：

- `providerInstances`
- `visionTextProviderInstances`

提示词润色独立 API Key/Base URL/Model ID 已移除，不再作为兼容字段写回。写回边界必须清楚：只服务旧图片和图生文配置迁移、临时覆盖、环境变量兜底和未迁移执行路径；不得重新出现在主设置入口或任务默认选择中。

### 10.3 回滚和重置

必须提供：

- 配置导出。
- 导入失败原因。
- 恢复导入前 JSON。
- 重置供应商与模型配置。
- 只重置某个端点或模型白名单。

## 11. 选项迁移矩阵

### 11.1 图片

| 旧位置/字段 | 新位置 | 新主数据 |
| --- | --- | --- |
| 图片供应商 API Key | 供应商与模型 > 连接 | `providerEndpoints.apiKey` |
| 图片供应商 Base URL | 供应商与模型 > 连接 | `providerEndpoints.apiBaseUrl` |
| 图片供应商模型列表 | 供应商与模型 > 已选模型 | `providerEndpoints.modelIds` + `modelCatalog` |
| 自定义图片模型 | 供应商与模型或图像设置页 > 手动添加模型 | `modelCatalog` |
| 当前生图默认模型 | 图像生成与编辑 | `modelTaskDefaultCatalogEntryIds['image.generate']` |
| 当前编图默认模型 | 图像生成与编辑 | `modelTaskDefaultCatalogEntryIds['image.edit']` |

### 11.2 图生文

| 旧位置/字段 | 新位置 | 新主数据 |
| --- | --- | --- |
| 图生文供应商列表 | 移除主路径 | `providerEndpoints` |
| 图生文 API Key | 供应商与模型 > 连接 | `providerEndpoints.apiKey` |
| 图生文 Base URL | 供应商与模型 > 连接 | `providerEndpoints.apiBaseUrl` |
| 图生文模型 ID | 图生文与多模态 > 默认模型 | `modelTaskDefaultCatalogEntryIds['vision.text']` |
| API compatibility | 图生文任务参数或模型 defaults | `visionTextTaskDefaults` / `ModelTaskDefaults.visionText` |

### 11.3 提示词润色

| 旧位置/字段 | 新位置 | 新主数据 |
| --- | --- | --- |
| 润色 API Key | 供应商与模型 > 连接 | `providerEndpoints.apiKey` |
| 润色 Base URL | 供应商与模型 > 连接 | `providerEndpoints.apiBaseUrl` |
| 润色模型 ID | 提示词润色 > 模型选择 | `modelTaskDefaultCatalogEntryIds['prompt.polish']` |
| 批量规划模型 | 提示词润色 > 模型选择 | `modelTaskDefaultCatalogEntryIds['prompt.batchPlan']` |
| 思考参数 | 提示词润色 > 行为配置 | `promptPolishTaskDefaults` 或 `ModelTaskDefaults.promptPolish` |

### 11.4 视频

| 位置/字段 | 新位置 | 新主数据 |
| --- | --- | --- |
| 视频供应商 | 供应商与模型 > 连接 | `providerEndpoints.provider` / `protocol` |
| 视频模型 | 供应商与模型 > 已选模型 | `modelCatalog` + `providerEndpoints.modelIds` |
| 文生视频默认模型 | 视频任务默认值 | `modelTaskDefaultCatalogEntryIds['video.generate']` |
| 图生视频默认模型 | 视频任务默认值 | `modelTaskDefaultCatalogEntryIds['video.imageToVideo']` |
| 默认时长/比例/分辨率/轮询 | 视频任务默认值 | `videoTaskDefaults` |

## 12. UI 与可访问性要求

必须遵守项目现有 UI 约束：

- 使用现有 `Dialog`、`Select`、`Checkbox`、`Button`、`IconButton`、`Tooltip`、`ProviderSection`、`statusBadge` 等模式。
- 不使用 `window.alert`、`window.prompt`、`window.confirm`。
- 所有新增可见文案进入 i18n 资源。
- light / dark 都可读。
- 移动端不横向溢出。
- 触控可用，hover 只作为增强。
- 不引入营销式 hero 或装饰性背景。
- 大列表要有搜索、折叠、分页或虚拟化。
- API Key 字段使用现有密钥输入和遮蔽模式。

## 13. 分期建议

### Phase 1：主数据切换

- 定义统一配置版本。
- 完成旧字段一次性导入。
- 保存只写统一主数据。
- 执行器优先从统一 resolver 取端点和模型。
- 旧 UI 主路径隐藏或降级为导入工具。

### Phase 2：供应商与模型页

- 统一端点编辑器。
- 供应商模板分组。
- 连接测试。
- 发现模型与批量选择。
- 已选模型白名单。
- 能力标注。
- 使用情况只读展示。

### Phase 3：任务消费者改造

- 图像生成与编辑设置页消费统一目录。
- 图生文设置页移除独立供应商配置。
- 提示词润色页主路径复用供应商端点管理中的 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点和模型；旧独立凭证配置不再作为主路径。
- 视频任务默认值消费统一目录。
- 工作台高级选项的供应商/模型选择器切到统一目录。

### Phase 4：清理和扩展

- 删除旧字段主路径和旧 resolver。
- 下沉模型能力检视。
- 补齐 Tauri Rust proxy 与 Web API Route 的发现适配一致性。
- 为更多视频/音频/向量协议预留 provider pack + protocol adapter 扩展。

## 14. 验收标准

### 14.1 产品验收

1. 用户新增一个端点后，可以被生图、编图、图生文、润色、视频等任务按能力复用。
2. 用户不需要在图生文页和润色页重复输入同一套 Key / Base URL。
3. 模型发现后不会自动把所有远端模型塞进日常下拉。
4. 用户可以搜索、复选、全选当前结果、批量添加模型。
5. 没有纳管模型的端点会显示“待补模型”，不会伪装成可用。
6. 低置信度模型不会自动进入默认任务下拉。
7. 待适配视频模型不会被允许提交，也不会自动成为默认模型。
8. 任务模型选择器在端点和模型之间保持一致，不保存跨端点错配。
9. 图生文和润色页主路径不再出现独立供应商列表和独立凭证输入。
10. 图像生成与编辑页能管理图片任务默认模型、常用模型和图片参数。

### 14.2 技术验收

1. `providerEndpoints`、`modelCatalog`、`modelTaskDefaultCatalogEntryIds` 是唯一写入主数据。
2. 执行链路通过统一 resolver 读取端点和模型。
3. Web API Route、客户端直连、Tauri Rust proxy 都能消费同一配置语义。
4. 公网 Web 的 URL 安全策略没有放宽。
5. API Key 不出现在日志、分享链接、同步明文或错误详情中。
6. 配置导入、导出、云同步、历史恢复不因主数据切换崩溃。
7. 大目录刷新失败不会删除已有已选模型。
8. 大列表不会阻塞首屏或造成移动端明显卡顿。

### 14.3 UI 验收

1. light / dark 主题均可读。
2. mobile / desktop 布局均不溢出。
3. 所有新增可见文案都有 i18n 覆盖。
4. 所有新增弹窗使用项目 Dialog，不使用原生浏览器弹窗。
5. 错误、空状态、待适配、低置信度、待补模型都有明确展示。

## 15. 与现有文档关系

- `UNIFIED_PROVIDER_MODEL_CAPABILITY_REQUIREMENTS.md`：定义统一模型能力目录的长期数据结构。
- `UNIFIED_PROVIDER_CONFIGURATION_REUSE_REQUIREMENTS.md`：定义供应商配置复用与迁移主线。
- `VIDEO_PROVIDER_MODEL_ONBOARDING_REQUIREMENTS.md`：定义视频供应商可见性、模型发现和批量选择补齐。

本文的定位是设置层和用户交互层的总收束：它决定用户在哪里配置、主数据由谁拥有、任务页如何消费，以及哪些旧入口应该退出主路径。

## 16. 仍需确认的实现决策

以下问题建议在实施前定稿：

1. 统一配置版本号放在 `AppConfig` 顶层还是供应商子树中。
2. API Key 在配置导出时继续遮蔽，还是提供“导出含密钥”的显式危险选项。
3. `modelIds` 空数组和缺省值是否统一规范为“未纳管模型”，避免历史代码误读。
4. 图像任务常用模型和排序是新增字段，还是先复用 `modelTaskDefaultCatalogEntryIds` 加 UI 排序。
5. 模型能力“用户已确认”的标记字段名称和存储位置。
6. 哪些视频协议在首轮标记为真实可提交，哪些只做协议预留。
