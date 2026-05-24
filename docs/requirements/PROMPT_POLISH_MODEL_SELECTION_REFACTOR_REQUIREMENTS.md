---
title: 提示词润色模型选择重构需求文档
summary: 将提示词润色模型从独立配置重构为基于现有 OpenAI/OpenAI 兼容与 Anthropic/Anthropic 兼容端点的端点选择、模型读取和单模型绑定流程。
createdAt: 2026-05-24
updatedAt: 2026-05-24
status: proposed
---

# 提示词润色模型选择重构需求文档

## 0. 结论

提示词润色模型不应再维护独立的 API Key、Base URL 或裸模型 ID。它应该只消费 **供应商与模型 -> 供应商端点管理** 中已经存在的 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点，并在润色设置里完成“选择供应商端点 -> 点击模型框读取最新模型列表 -> 单选润色模型并关联”的任务绑定。

结合当前代码状态，本需求采用以下产品决策：

1. 润色模型只允许来自 OpenAI/OpenAI 兼容与 Anthropic/Anthropic 兼容端点族，不再要求端点必须是某个指定的文本端点模板。
2. 产品文案可以统一说“OpenAI 兼容”和“Anthropic 兼容”，但实现上需要覆盖官方 OpenAI、官方 Anthropic 与第三方兼容端点。
3. 端点、凭证、Base URL、模型发现和模型白名单仍归 **供应商端点管理** 所有；润色设置只是消费已有端点。
4. **提示词润色配置** 只负责选择任务默认模型、思考参数、自定义润色提示词和下拉顺序。
5. 润色设置中不再展示模型下拉或要求先纳管模型；选择端点后，用户点击“尚未选择模型/已选模型”状态框即可复用供应商端点管理的模型列表弹窗，自动读取该端点最新模型列表，并以单选方式完成绑定。
6. 如果没有符合条件的端点，润色设置只给出空状态和“添加端点”入口，点击后跳到 **供应商端点管理** 并预选 OpenAI 兼容端点模板。
7. 批量规划模型使用同一类端点和同一套交互，但保存为独立任务默认值，不能自动继承润色模型。
8. “选择供应商端点 -> 读取模型 -> 单选/关联模型”的逻辑必须做成可复用组件和可复用数据处理函数，后续图生文、视频或其他任务默认模型选择也要能复用，而不是写死在润色设置里。

## 1. 当前项目基线

当前项目已经具备本重构所需的大部分底座：

- 统一主数据已存在：`providerEndpoints`、`modelCatalog`、`modelTaskDefaultCatalogEntryIds`。
- OpenAI/OpenAI 兼容与 Anthropic/Anthropic 兼容端点族已存在，当前包括：
  - `openai-compatible` + `openai-chat-completions`
  - `openai` + `openai-responses`
  - `anthropic` + `anthropic-messages`
  - `anthropic-compatible` + `anthropic-compatible-messages`
- 当前润色候选端点由 `isPromptPolishProviderEndpoint` 判断，逻辑偏向协议白名单。后续需要改为或补充为兼容族选择器：只要端点属于 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点族，就可以进入润色端点选择，不应因为它当前挂在图片、视频或 Responses 模板下而被直接排除。
- 模型读取链路已存在：
  - Web: `/api/provider-models`
  - Tauri: `proxy_provider_models`
  - OpenAI 兼容端点读取 `GET /models`，使用 Bearer token。
  - Anthropic 端点读取 `GET /models`，使用 `x-api-key` 与 `anthropic-version`。
- 远端模型写入 `modelCatalog` 时，当前会按模型 ID 和端点协议推断能力。后续润色选择流程不应只展示已经被推断为 `prompt.polish` 的模型；它应先展示所选端点读取到的模型，再由用户把其中一个模型绑定为润色模型。
- 运行链路已存在：
  - Web 服务器中转: `/api/prompt-polish`
  - Web 客户端直连: `polishPromptDirect`
  - Tauri 桌面代理: `proxy_prompt_polish`
- 当前 `resolvePromptPolishCatalogSelection` 已经要求用户显式选择 `modelTaskDefaultCatalogEntryIds['prompt.polish']`。没有选择时不会自动挑选模型。

当前缺口主要在 UI 体验：

- 润色设置页当前更偏向展示已经具备润色能力的端点模型，容易和供应商端点管理里的模型纳管概念混在一起。
- 如果端点已存在但还没有读取模型，用户需要能在选择端点后直接点击模型状态框，由弹窗读取最新模型列表。
- “获取模型列表”弹窗主要在供应商端点管理卡片里，本次需要将同一个弹窗组件改造成可复用的单选/多选模型选择组件。
- 润色模型选择需要更明确地表达“端点可返回很多模型，但当前润色任务默认值只能单选一个模型”。
- 端点选择、模型读取、模型目录写入、任务能力补充和任务默认值绑定还缺少一套通用抽象，后续其他任务复用会困难。

## 2. 范围

### 2.1 本次范围

本需求覆盖：

- 提示词润色模型选择 UI。
- 批量规划模型选择 UI，因为它复用同一类端点族和同一套“读取模型后绑定任务默认值”的交互。
- OpenAI/OpenAI 兼容与 Anthropic/Anthropic 兼容端点筛选。
- 从润色设置跳转到供应商端点管理新增或编辑端点。
- 在润色设置中触发模型读取。
- 模型读取结果写入统一模型目录，并把用户在弹窗中的单选结果保存为任务默认模型。
- Web、客户端直连、Tauri 桌面代理的行为边界。
- 配置导入导出、同步和分享场景下的兼容要求。

### 2.2 非目标

本需求不覆盖：

- 新增独立的润色供应商表。
- 恢复旧的润色 API Key、Base URL、模型 ID 输入框。
- 支持 Google Gemini、Runway 等非 OpenAI/Anthropic 兼容族端点作为润色模型来源。
- 一次性重写所有模型能力管理界面。
- 自动替用户选择第一个模型作为默认润色模型。

## 3. 核心对象

### 3.1 端点资格

润色设置页可选择的端点按兼容族判断，而不是按“文本端点模板”判断。端点必须同时满足：

| 字段 | 要求 |
| --- | --- |
| `enabled` | 不能为 `false` |
| 兼容族 | OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容。可由 `provider`、`protocol`、模板元数据或后续显式 `compatibilityFamily` 推导 |
| `protocol` | 不作为端点资格硬过滤；仅用于展示、默认请求适配和兼容性提示 |
| `apiKey` | 正常执行和模型读取需要可用 API Key |
| `apiBaseUrl` | 可以为空，空值按协议默认地址处理 |

展示上建议分成两组：

| 展示分组 | 包含实现值 |
| --- | --- |
| OpenAI 兼容 | 官方 OpenAI、OpenAI Compatible，以及明确标记为 OpenAI 兼容调用族的端点 |
| Anthropic 兼容 | 官方 Anthropic、Anthropic Compatible，以及明确标记为 Anthropic Messages 兼容调用族的端点 |

这样既符合用户心智，也不丢失当前代码中官方 OpenAI 与官方 Anthropic 的专用 provider kind。

重要约束：

- OpenAI/OpenAI 兼容端点即使当前在系统里归类为图片、视频、Responses 或其他 OpenAI 兼容模板，也可以出现在润色端点选择中。
- Anthropic/Anthropic 兼容端点同理，只要属于 Anthropic Messages 兼容调用族即可。
- 非 OpenAI/Anthropic 兼容族端点继续排除。
- 端点能读取出哪些模型由端点自身决定，用户根据自己的账号、中转和模型能力选择具体模型。

### 3.2 模型资格

润色模型必须来自用户选择的端点。模型列表应在用户点击“尚未选择模型/已选模型”状态框后由弹窗读取该端点最新返回结果，不应只依赖预先推断出的 `prompt.polish` 能力，也不应要求用户先在端点管理里多选纳管模型。

- `entry.enabled !== false`。
- 端点未禁用。
- 模型来自当前选中的端点，不能跨端点混用同名模型。
- 用户确认绑定时，系统可在内部把该模型写入端点 `modelIds` 以保证运行链路可解析，但润色 UI 不把这个步骤表现为“纳管模型”的前置条件。
- 用户把模型绑定到 `prompt.polish` 时，应确保该目录项具备或被补充 `prompt.polish` 能力。
- 用户把模型绑定到 `prompt.batchPlan` 时，应确保该目录项具备或被补充 `prompt.batchPlan` 能力。
- 非当前端点下的同名模型不能混入候选。

当前代码中，远端读取到的未知文本模型通常会被推断为 `prompt.polish` 和 `prompt.batchPlan`。但新交互不能依赖这个推断一定正确：端点可能返回图片、视频、文本、推理或聚合模型，用户需要能根据自己的情况选择。UI 可以展示能力推断、来源和风险提示，但不应因为缺少自动推断结果而阻止用户绑定。

如果用户选择的模型后续调用失败，应在执行错误中明确返回供应商错误，不把失败伪装成配置丢失。

### 3.3 任务默认值

保存规则：

| 任务 | 保存字段 |
| --- | --- |
| 提示词润色 | `modelTaskDefaultCatalogEntryIds['prompt.polish']` |
| 批量规划 | `modelTaskDefaultCatalogEntryIds['prompt.batchPlan']` |

两个任务默认值互相独立：

- 用户选择润色模型，不自动设置批量规划模型。
- 用户选择批量规划模型，不自动改动润色模型。
- 同一个模型可以被用户分别选为两个任务的默认值。

## 4. 用户流程

### 4.1 没有可用端点

进入 **Settings -> 提示词润色配置** 时：

1. 系统检查是否存在符合资格的 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点。
2. 如果没有，显示空状态：
   - 标题：还没有可用于润色的端点。
   - 说明：请先添加 OpenAI 兼容或 Anthropic 兼容端点，再回到这里选取模型。
   - 主按钮：添加端点。
3. 点击 **添加端点** 后跳到 **供应商端点管理**。
4. 新增端点表单默认预选一个通用 OpenAI 兼容端点模板。
5. 用户仍可在端点模板下拉中改选 OpenAI 官方、OpenAI 兼容、Anthropic 官方或 Anthropic 兼容端点模板。

该流程不能使用 `window.alert`、`window.prompt` 或 `window.confirm`。

### 4.2 有端点但尚未选择任务模型

进入润色设置时，如果已存在符合资格的端点，但当前任务还没有选择模型：

1. 不应继续只显示“添加端点”。
2. 应展示符合资格的端点列表。
3. 用户可以选择一个端点。
4. 选择端点后展示：
   - 可点击的模型状态框。未绑定时显示“尚未选择模型”，已绑定时显示当前模型。
   - 管理此端点按钮，位置应跟随端点下拉，不放到任务卡片标题区。
   - 当前端点名称、协议、Base URL 简要信息。
5. 点击模型状态框后，打开复用的模型列表弹窗，并自动读取该端点最新 `/models` 结果。
6. 弹窗以单选模式展示最新模型列表；当前选择可标记为“当前选中”。
7. 用户选择一个模型并确认后：
   - 将远端模型写入或更新 `modelCatalog`。
   - 补充当前任务能力。
   - 将选中的目录项 ID 写入 `modelTaskDefaultCatalogEntryIds['prompt.polish']` 或对应任务默认值。

如果端点的 `/models` 不可用或第三方中转隐藏模型列表，弹窗可以允许用户手动添加隐藏模型 ID，并直接单选关联当前任务。

### 4.3 有端点且已有候选模型

润色模型选择区应按任务展示两行：

1. 提示词润色模型。
2. 批量规划模型。

每一行的交互一致：

1. 先选择供应商端点。
2. 点击“尚未选择模型/已选模型”状态框打开模型列表弹窗。
3. 弹窗自动读取该端点最新模型列表。
4. 模型选择是单选。
5. 确认模型后立即更新该任务的本地设置状态。
6. 点击设置弹窗保存后持久化到 `modelTaskDefaultCatalogEntryIds`。

端点下拉应包含所有符合资格的 OpenAI/OpenAI 兼容与 Anthropic/Anthropic 兼容端点，不应只包含已经有可选模型的端点。这样用户可以从润色设置里先选择供应商端点，再通过弹窗实时读取该端点模型。

润色设置页不展示模型下拉，也不再单独展示“选取模型”按钮。模型列表只在点击模型状态框后的弹窗中出现；弹窗可复用供应商端点管理的模型列表组件，但以单选模式运行。

### 4.4 切换供应商或端点

用户后续可以随时切换到其他供应商或其他端点：

1. 选择新的端点后，当前任务的模型选择进入“待选择模型”状态。
2. 原端点、原模型白名单和模型目录不删除。
3. 只有用户单选新模型后，才更新任务默认值。
4. 如果用户取消设置弹窗，变更不落盘。
5. 如果用户保存，新的 `modelTaskDefaultCatalogEntryIds` 覆盖旧任务默认值。

### 4.5 跳转端点管理

润色设置里需要提供两个跳转入口：

- 没有符合资格端点时：添加端点。
- 选中某个端点时：管理此端点。

跳转行为：

- 进入 **供应商端点管理** 子视图。
- 新增场景预选 OpenAI 兼容端点模板。
- 编辑场景尽量滚动或展开目标端点卡片。
- 返回润色设置时保留用户刚才的任务选择上下文。

## 5. 模型读取与选择

### 5.1 模型选择弹窗

润色设置中的模型状态框必须复用供应商端点管理里的模型列表弹窗能力，并将该弹窗抽象为可配置的模型选择组件：

- `selectionMode = single | multiple`。
- 供应商端点管理使用 `multiple`，继续管理端点模型白名单。
- 提示词润色和批量规划当前使用 `single`，只把一个模型关联到对应任务默认值。
- 后续其他任务可以复用同一弹窗，按任务需要选择单选或多选。

点击模型状态框时必须自动触发现有发现能力：

- Web 使用 `discoverProviderModelsViaServer` 和 `/api/provider-models`。
- Tauri 使用 `proxy_provider_models`。
- 请求使用当前选择的 `ProviderEndpoint`，不再读取旧润色专用字段。
- OpenAI/OpenAI 兼容端点族读取 `{baseUrl}/models`，使用 Bearer token。
- Anthropic/Anthropic 兼容端点族读取 `{baseUrl}/models`，使用 `x-api-key` 与 `anthropic-version`。
- 读取模型的 adapter 应按兼容族选择，不应只按当前端点的 `protocol` 白名单选择。

读取成功后：

1. 调用 `upsertDiscoveredModelCatalogEntries` 合并远端模型。
2. 保留已有用户手动能力标注。
3. 更新端点 `modelDiscovery.lastRefreshedAt`。
4. 清除该端点上一次 `lastError`。
5. 用本次返回的最新模型刷新弹窗选项。

读取失败后：

1. 不清空已有 `modelCatalog`。
2. 记录 `modelDiscovery.lastError`。
3. 在模型选择弹窗中显示错误。
4. 保留“管理此端点”和“手动添加隐藏模型 ID”的修复路径。

### 5.2 单选与白名单

用户在润色设置里单选模型时，系统应同时保证：

- 该模型存在于 `modelCatalog`。
- 该模型存在于端点 `modelIds` 白名单。
- 该模型 ID 写入当前任务默认值。
- 该模型目录项补充当前任务能力；例如绑定润色时包含 `prompt.polish`，绑定批量规划时包含 `prompt.batchPlan`。

如果用户从远端读取结果中直接单选一个模型，系统应在确认时完成关联所需的内部写入。用户不需要先在另一个弹窗多选纳管，再回来单选默认模型。

这不改变供应商端点管理的语义。端点管理仍然可以多选管理多个模型；润色设置只是为当前任务选择其中一个默认模型，不把“纳管模型”作为用户必须理解的前置步骤。

### 5.3 手动添加隐藏模型

第三方 OpenAI 兼容或 Anthropic 兼容端点可能不实现 `/models`，但仍能调用具体模型 ID。此时需要保留手动补充路径：

- 在获取失败或结果为空时提供“手动添加模型”入口。
- 手动添加模型需要写入 `modelCatalog`，`source = custom`。
- 默认能力应按当前绑定任务补充。例如从润色设置手动添加时至少补充 `prompt.polish`，从批量规划设置手动添加时至少补充 `prompt.batchPlan`；如果同一模型也适合文本生成，可同时补充 `text.generate`，置信度可为 `medium`。
- 用户确认后同样可以单选为润色模型。

## 6. 执行链路要求

### 6.1 提示词润色

执行润色时必须从 `resolvePromptPolishCatalogSelection(config, 'prompt.polish')` 或等价逻辑得到：

- 端点。
- 协议。
- API Key。
- API Base URL。
- `rawModelId`。
- 思考参数。

没有选中模型时：

- 前端不应发起模型请求。
- 用户看到明确错误：需要先在供应商端点管理中添加 OpenAI 兼容或 Anthropic 兼容端点，并为端点添加可用模型。

### 6.2 批量规划

批量规划使用 `resolvePromptPolishCatalogSelection(config, 'prompt.batchPlan')` 或等价逻辑。

批量规划不能因为润色模型已选就自动可用。用户必须显式选择批量规划模型，或者在 UI 中明确提供“一键使用同一个模型”的用户动作。

### 6.3 协议处理

Anthropic 协议必须走 Messages 请求：

- `anthropic-messages`
- `anthropic-compatible-messages`

OpenAI/OpenAI 兼容端点族的执行 adapter 不应再简单等同于端点当前 `protocol` 字段。因为同一个 OpenAI 兼容 Base URL 可能同时暴露 `/models`、Chat Completions、Responses、Images 或 Videos，端点分类不能代表用户最终选择的模型只能做某一类任务。

后续实现必须明确以下策略：

- 模型读取按兼容族走 `/models`。
- 润色执行按用户选择的任务 adapter 走 OpenAI 兼容文本生成请求或 Anthropic Messages 请求。
- 如果 OpenAI 兼容端点需要区分 Chat Completions 与 Responses，应把“任务调用协议”作为绑定元数据或端点能力提示，而不是用端点原始分类把整个端点排除。
- 如果用户选择的模型实际不支持润色请求，由供应商错误提示用户更换模型或端点。

## 7. 配置、同步、分享和安全

### 7.1 配置持久化

本需求只写入统一配置：

- `providerEndpoints`
- `modelCatalog`
- `modelTaskDefaultCatalogEntryIds`
- 现有润色思考参数与自定义提示词字段

不得新增或恢复：

- `polishingApiKey`
- `polishingApiBaseUrl`
- `polishingModelId`
- 其他润色专用连接字段

### 7.2 导入导出与云同步

导入、导出和云同步需要保留：

- 端点元数据。
- 模型目录。
- 任务默认模型绑定。

密钥处理必须继续遵守现有安全规则：

- 默认导出不包含 API Key。
- 含密钥导出需要用户显式选择。
- 分享链接默认不包含 API Key。
- UI、日志和错误信息不得暴露原始密钥。

### 7.3 分享链接

如果分享链接包含润色配置：

- 可以包含任务默认模型绑定和端点 ID。
- 不应因为缺少 API Key 而静默使用分享者密钥。
- 接收者如果没有可用凭证，应看到“需要配置端点凭证或重新选择润色模型”的提示。

### 7.4 URL 安全

执行润色请求时仍需要保留现有安全检查：

- Web 服务器中转不得放宽 `validatePublicHttpBaseUrl` 对执行请求的限制。
- 客户端直连仍需要遵守 `getClientDirectLinkRestriction`。
- 模型发现可以继续支持内网、自托管和局域网 Base URL，保持当前 `/api/provider-models` 行为。

## 8. UI 与国际化要求

所有新增或调整的可见文案必须进入 `src/lib/i18n/messages.ts`，并保持中文和英文同步。

建议新增或复用的文案语义：

- 选择供应商端点。
- 尚未选择模型。
- 已选模型。
- 读取该端点最新模型列表。
- 刷新模型列表。
- 管理此端点。
- 手动添加模型。
- 选择一个模型作为提示词润色模型。
- 选择一个模型作为批量规划模型。
- OpenAI 兼容端点。
- Anthropic 兼容端点。

布局要求：

- 支持移动端单列和桌面双列。
- 按钮高度满足触控使用。
- 不依赖 hover 才能完成关键操作。
- 明暗主题都要检查。
- 不使用原生浏览器弹窗。
- 使用现有 `Button`、`Select`、`Dialog`、`RadioGroup`、`Alert`、`Tooltip` 等组件。

## 9. 验收标准

### 9.1 空状态

- 全新配置且没有 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点时，润色设置显示空状态和 **添加端点**。
- 点击 **添加端点** 进入供应商端点管理，并预选 OpenAI 兼容端点模板。

### 9.2 已有端点但无模型

- 已存在符合资格的 OpenAI 兼容或 Anthropic 兼容端点但 `modelIds` 为空时，润色设置能显示这些端点。
- 选择端点后显示可点击的模型状态框。
- 点击模型状态框后打开模型列表弹窗，并自动读取该端点最新模型列表。
- 模型列表读取成功后，用户可以在弹窗里单选一个模型作为润色模型。
- 保存后 `modelTaskDefaultCatalogEntryIds['prompt.polish']` 指向所选模型目录项。

### 9.3 切换模型

- 用户可以从 OpenAI 兼容端点切换到 Anthropic 兼容端点。
- 切换端点不会删除旧端点和旧模型。
- 只有重新单选模型并保存后，润色默认模型才变化。

### 9.4 候选范围

- OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点都可以出现在润色端点选择中，即使该端点当前在设置里归类为图片、视频或其他模板。
- Google Gemini、Runway 等非 OpenAI/Anthropic 兼容族端点不出现在润色端点选择中。
- 禁用端点不出现在可选列表中。
- 读取模型列表后，用户可以从该端点返回的模型中单选一个绑定到润色或批量规划。
- 不在端点白名单中的模型如果被用户从读取结果中明确选择，系统应完成运行所需的内部关联。

### 9.5 批量规划独立

- 只选择润色模型时，批量规划仍保持未选择。
- 只选择批量规划模型时，润色模型不被改动。
- 两者可以选择同一个目录项，也可以选择不同端点下的不同模型。

### 9.6 执行行为

- 润色执行请求使用所选端点的 API Key、Base URL、协议和模型 ID。
- 未选择模型时不发起远端请求。
- Web 服务器中转、Web 客户端直连、Tauri 桌面代理都能使用同一份选择。
- Anthropic 端点走 Messages 请求。
- OpenAI/OpenAI 兼容端点的任务调用协议策略必须明确，不能出现 UI 允许选择但执行层协议错误且没有可理解提示的状态。

### 9.7 模型读取

- Web 端可以通过 `/api/provider-models` 获取 OpenAI 兼容和 Anthropic 兼容模型。
- Tauri 桌面可以通过 `proxy_provider_models` 获取同样结果。
- 获取失败不会清空已有模型。
- 获取结果为空时在弹窗中提供手动添加模型入口。

### 9.8 安全与同步

- 默认导出和分享不泄露 API Key。
- 含密钥导出仍需要显式用户动作。
- 云同步保留任务默认模型绑定。
- 错误提示不包含原始密钥。

## 10. 建议实现拆分

### 10.1 可复用数据逻辑

新增或调整统一的数据处理函数，建议放在 `src/lib/provider-model-binding.ts` 或 `src/lib/provider-model-catalog.ts` 附近，供润色、图生文、视频和后续任务复用：

- 按兼容族获取可用端点，不把逻辑写死成润色专用。
- 获取某端点下最新读取、手动添加和可绑定的模型。
- 判断端点是否支持读取模型列表。
- 将远端单选模型同时写入 `modelCatalog`、端点 `modelIds` 和任务默认值。
- 为用户选中的模型补充当前任务能力。
- 支持不同任务传入不同的兼容族过滤、任务能力、默认值字段和单选/多选模式。

### 10.2 UI 组件

必须抽出一个通用内部组件，而不是写成 `settings-dialog.tsx` 里的润色专用分支：

`ProviderEndpointModelBindingPicker`

输入：

- `task`: 目标任务能力，例如 `prompt.polish`、`prompt.batchPlan`、`vision.text`、`video.generate`
- `allowedCompatibilityFamilies`: 例如 `['openai-compatible', 'anthropic-compatible']`
- `providerEndpoints`
- `modelCatalog`
- `modelTaskDefaultCatalogEntryIds`
- `onChooseModel(endpoint)`
- `onManageEndpoint(endpointId)`
- `onAddEndpoint()`
- `selectionMode`: `single` 或后续需要的 `multiple`

输出：

- 当前选择状态。
- 端点选择。
- 模型状态框选择动作。
- 当前任务绑定结果。

### 10.3 模型管理弹窗复用

现有供应商端点管理的模型管理弹窗可以继续保留多选管理能力。通用模型列表弹窗需要支持单选和多选两种模式：

- `selectionMode = multiple`：供应商端点管理使用，确认时写入端点模型列表。
- `selectionMode = single`：润色模型选择使用，确认时写入任务默认值并补充任务能力。

推荐复用同一弹窗组件，而不是在润色设置里再写一套模型下拉。它更贴近任务设置中的目标：先选端点，再通过弹窗读取最新模型，然后把一个模型关联到当前任务。该方案后续也能复用于图生文默认模型、视频默认模型或其他任务默认模型。

### 10.4 测试

至少补充以下测试：

- `provider-model-catalog` 或新增 binding helper：符合兼容族的端点即使没有 `modelIds` 也能被端点模型绑定组件列出。
- `provider-model-catalog` 或新增 binding helper：OpenAI/OpenAI 兼容图片或视频分类端点仍可进入润色端点候选；非 OpenAI/Anthropic 兼容族端点不能进入。
- `provider-model-catalog` 或新增 binding helper：单选远端模型会加入端点白名单、补充任务能力并写入 `modelTaskDefaultCatalogEntryIds['prompt.polish']`。
- `settings-dialog` 或组件测试：无端点、端点无模型、读取成功、切换端点四种 UI 状态。
- `prompt-polish`：未选择模型不发请求。
- `prompt-polish`：Anthropic 端点使用 Messages 协议。
- `model-discovery` 与 Tauri Rust：OpenAI/OpenAI 兼容和 Anthropic/Anthropic 兼容端点按兼容族读取模型，不能只按原始 endpoint protocol 判断。

## 11. 文档更新要求

实现该需求时，需要同步更新：

- `docs/providers-and-settings.md` 的提示词润色配置章节。
- `docs/prompt-workflow.md` 的一键润色章节。
- 必要时更新 `README.md` 中“管理提示词资产”和“连接多个模型供应商”的描述。

如果实现只调整内部代码但不改变用户可见流程，需要在交付说明中明确“不需要更新用户手册”的原因。
