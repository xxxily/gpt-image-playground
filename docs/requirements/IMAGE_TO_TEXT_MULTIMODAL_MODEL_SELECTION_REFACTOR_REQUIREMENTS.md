---
title: 图生文与多模态模型选择重构需求文档
summary: 将图生文与多模态从专用高级自定义连接重构为基于统一供应商端点管理的端点选择、模型读取和单模型绑定流程，并重新梳理任务选项的产品价值。
createdAt: 2026-05-25
updatedAt: 2026-05-25
status: implemented
---

# 图生文与多模态模型选择重构需求文档

## 0. 结论

图生文与多模态不应继续维护“高级自定义连接”、专用 API Key、专用 Base URL、专用模型 ID 或内置默认指定模型。它应该和提示词润色模型选择保持一致：只消费 **供应商与模型 -> 供应商端点管理** 中已经存在的 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点，用户选择端点后，点击“尚未选择模型/已选模型”状态框读取该端点最新模型列表，并单选一个模型绑定为 `vision.text` 默认模型。

本次重构采用以下产品决策：

1. 图生文与多模态只从统一供应商端点管理读取端点、凭证、Base URL 和模型列表，不再在图生文设置页提供“高级自定义连接”。
2. 新用户不再获得硬编码图生文默认模型，例如 `gpt-5.5` 或 `gpt-5.4`；未显式选择模型时，图生文提交前应提示用户先选择端点和模型。
3. 可选端点范围与提示词润色保持同一心智：OpenAI/OpenAI 兼容与 Anthropic/Anthropic 兼容端点都可作为候选，具体模型由端点实时返回，用户根据自己的账号、网关和模型能力选择。
4. 图生文设置页只负责任务默认值和任务行为选项；端点新增、凭证编辑、Base URL、模型读取、多模型纳管继续归供应商端点管理所有。
5. 图生文模型选择交互必须复用润色模型的端点-模型绑定组件：选择端点、管理此端点、点击模型状态框打开模型列表弹窗、单选模型并绑定。
6. 模型列表弹窗继续复用供应商端点管理的远端模型读取能力，但在图生文场景使用单选模式，并在确认时补充 `vision.text` 能力。
7. 其他图生文配置项应按用户能理解的任务价值重组，减少协议细节和重复开关，不为了暴露选项而暴露选项。

## 1. 当前项目基线

项目已经具备重构所需的大部分底座：

- 统一端点主数据：`providerEndpoints`。
- 统一模型目录：`modelCatalog`。
- 统一任务默认模型：`modelTaskDefaultCatalogEntryIds`，其中图生文任务为 `vision.text`。
- 可复用端点-模型绑定组件：`ProviderEndpointModelBindingPicker`。
- 可复用绑定逻辑：`getProviderModelBindingEndpoints`、`bindProviderModelToTask`、`ensureCatalogEntryTaskCapability`。
- 模型读取链路：
  - Web: `/api/provider-models`。
  - Tauri: `proxy_provider_models`。
  - OpenAI/OpenAI 兼容端点：`GET /models` + Bearer token。
  - Anthropic/Anthropic 兼容端点：`GET /models` + `x-api-key` + `anthropic-version`。
- 图生文执行链路已经拆出：
  - Web API: `/api/image-to-text`。
  - Tauri: `proxy_image_to_text` 与流式代理。
  - 前端执行：`executeVisionTextTask`、`executeVisionTextWebProxyRequest`、`executeVisionTextDesktopProxyRequest`。

重构前主要问题：

- 图生文设置仍保留“高级自定义连接”，包括专用 API Key、Base URL、兼容模式、模型列表和“复用 OpenAI 图片供应商凭证”等字段。
- 图生文默认模型仍可能从 `DEFAULT_VISION_TEXT_MODEL` 或旧 `visionTextModelId` 自动回退，容易让用户误以为系统内置模型一定可用。
- 设置页的图生文默认模型仍是普通下拉，只能选择已经具备 `vision.text` 能力的目录项，不符合“选择端点后实时读取模型再单选绑定”的新交互。
- 工作台高级选项里的图生文供应商和模型选择仍偏向旧的 provider instance 与模型下拉，没有和润色模型选择形成统一体验。
- “默认兼容模式”“默认输出格式”“默认结构化输出”等选项存在重叠，用户需要理解协议细节才能配置，不够面向任务价值。

## 2. 范围

### 2.1 本次范围

本需求覆盖：

- **Settings -> 图生文与多模态** 的模型选择和任务选项重构。
- 工作台 **高级选项 -> 图生文模式** 的供应商、模型和任务选项重构。
- OpenAI/OpenAI 兼容与 Anthropic/Anthropic 兼容端点筛选。
- 图生文模型列表读取、单选绑定、手动添加隐藏模型 ID。
- 旧 `visionTextProviderInstances`、`selectedVisionTextProviderInstanceId`、`visionTextModelId`、`visionTextApiCompatibility` 等配置向统一端点和模型目录迁移。
- Web、客户端直连和 Tauri 桌面代理的执行边界。
- 图生文历史、配置导入导出、分享链接和同步中的兼容要求。

### 2.2 非目标

本需求不覆盖：

- 新增独立的图生文供应商表。
- 恢复旧的图生文 API Key、Base URL、裸模型 ID 输入框。
- 在图生文设置页纳管多模型白名单；多模型纳管只在供应商端点管理中完成。
- 将图生文模型混入图片生成/图片编辑模型注册表。
- 自动替用户选择第一个远端模型作为默认图生文模型。
- 一次性重写所有图生文结果面板和历史展示。

## 3. 端点资格

图生文可选择的端点按兼容族判断，而不是按“图生文专用端点”判断。

| 规则 | 要求 |
| --- | --- |
| 启用状态 | `enabled !== false` |
| 兼容族 | OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容 |
| 凭证 | 执行和读取模型需要可用 API Key |
| Base URL | 可以为空，空值按端点协议默认地址处理 |
| 协议 | 不作为 UI 端点资格的唯一硬过滤，但用于选择请求适配器 |

展示分组建议：

| 展示分组 | 包含实现值 |
| --- | --- |
| OpenAI 兼容 | 官方 OpenAI、OpenAI Compatible，以及明确走 OpenAI Responses / Chat Completions / OpenAI 兼容调用族的端点 |
| Anthropic 兼容 | 官方 Anthropic、Anthropic Compatible，以及明确走 Anthropic Messages 兼容调用族的端点 |

重要约束：

- OpenAI/OpenAI 兼容端点即使是从图片、视频或 Responses 模板创建，只要属于 OpenAI 兼容调用族，也可以进入图生文端点选择。
- Anthropic/Anthropic 兼容端点同理，只要能走 Anthropic Messages 兼容调用族，就可以进入图生文端点选择。
- Gemini、Seedream、Runway、Luma 等非 OpenAI/Anthropic 兼容族端点不进入本次图生文模型选择范围，除非后续明确给这些供应商增加 `vision.text` 适配器和端点族定义。

## 4. 模型资格与绑定

图生文模型必须来自当前选择的端点。模型列表应在用户点击“尚未选择模型/已选模型”状态框后，由模型选择弹窗读取该端点最新返回结果。

模型绑定规则：

1. 模型来自当前端点，不能跨端点混用同名模型。
2. 绑定时将模型写入或更新 `modelCatalog`。
3. 绑定时确保目录项具备：
   - `capabilities.tasks` 包含 `vision.text`。
   - `inputModalities` 包含 `text` 和 `image`。
   - `outputModalities` 包含 `text`。
4. 绑定时可以把该模型写入端点 `modelIds`，保证运行链路能解析；但 UI 不把这个步骤表述为“先纳管模型”。
5. 绑定结果保存到 `modelTaskDefaultCatalogEntryIds['vision.text']`。
6. 如果用户选择的模型实际不支持图片输入，提交时展示供应商返回的明确错误，不自动回退到其他模型。

图生文设置页不应只展示已经被自动推断为 `vision.text` 的模型。端点可能返回文本、多模态、推理、聚合或路由模型，系统可以展示能力推断和风险提示，但是否选择由用户决定。

## 5. 用户流程

### 5.1 没有可用端点

进入 **Settings -> 图生文与多模态** 时：

1. 系统检查是否存在符合资格的 OpenAI/OpenAI 兼容或 Anthropic/Anthropic 兼容端点。
2. 如果没有，显示空状态：
   - 标题：还没有可用于图生文的端点。
   - 说明：请先添加 OpenAI 兼容或 Anthropic 兼容端点，再回来选择图生文模型。
   - 主按钮：添加端点。
3. 点击 **添加端点** 后跳到 **供应商端点管理**。
4. 新增端点表单默认预选通用 OpenAI 兼容模板，用户也可以改选 OpenAI 官方、Anthropic 官方或 Anthropic 兼容模板。

该流程不能使用 `window.alert`、`window.prompt` 或 `window.confirm`。

### 5.2 有端点但尚未选择模型

如果已经存在符合资格的端点，但当前没有 `vision.text` 默认模型：

1. 展示端点选择器。
2. 用户选择端点。
3. 端点选择器旁边或下方展示：
   - **管理此端点** 按钮。
   - 可点击的模型状态框，显示“尚未选择模型”。
4. 用户点击模型状态框后，打开模型列表弹窗。
5. 弹窗自动读取当前端点最新模型列表。
6. 用户单选模型并确认。
7. 系统写入模型目录、补充 `vision.text` 能力，并设置 `modelTaskDefaultCatalogEntryIds['vision.text']`。

如果端点无法读取模型列表，应保留错误提示和手动添加隐藏模型 ID 的入口。

### 5.3 已选择模型

已绑定图生文模型时：

1. 端点选择器显示模型所属端点。
2. 模型状态框显示当前模型名称。
3. 用户点击模型状态框可重新读取最新模型列表并改选。
4. 用户切换端点后，模型状态进入“尚未选择模型”，原模型目录和原端点模型白名单不删除。
5. 只有用户确认选择新模型后，才更新 `vision.text` 默认值。

### 5.4 工作台高级选项

工作台进入图生文模式后，高级选项里的供应商与模型选择应和设置页保持一致：

1. 默认使用 `modelTaskDefaultCatalogEntryIds['vision.text']` 指向的模型。
2. 如果没有默认模型，展示“先选择图生文模型”的状态和跳转设置入口。
3. 如果允许本次任务临时改选模型，也必须复用同一端点-模型绑定交互，而不是旧的供应商下拉 + 模型下拉。
4. 运行时记录使用的端点 ID、模型 ID 和目录项 ID，历史记录继续可追溯。

## 6. 设置项重组

图生文与多模态设置页应从“协议配置页”转为“任务默认设置页”。以下配置应保留、重命名或合并。

### 6.1 保留并强化的选项

| 选项 | 建议形态 | 用户价值 |
| --- | --- | --- |
| 图生文模型 | 端点选择 + 点击模型状态框单选 | 决定由哪个供应商和模型理解图片 |
| 默认任务类型 | 分段控件或下拉：提示词反推、图片描述、设计规范、OCR 与版式、自由问答 | 决定系统提示词和输出侧重点 |
| 视觉 detail | 自动、低成本、高细节、原图细节 | 在成本、速度和识别精度之间取舍 |
| 输出目标 | 自然文本、结构化字段 | 决定结果更适合阅读还是回填/解析 |
| 实时输出 | 开关：实时显示生成过程 | 长文本场景下减少等待感 |
| 输出长度 | 简短、标准、详细、自定义 Token 上限 | 用用户能理解的长度概念替代裸 Token 优先 |
| 系统指令模板 | 折叠高级项，支持恢复默认 | 让高级用户约束风格和安全边界 |
| 保存图生文历史 | 开关 | 控制是否保留结果与源图引用 |

### 6.2 合并或降级的选项

| 当前选项 | 调整 |
| --- | --- |
| 默认输出格式 + 默认结构化输出 | 合并为“输出目标”。选择结构化字段时内部启用结构化解析。 |
| 最大输出 Token | 默认折叠到“输出长度”的自定义项，避免普通用户直接面对协议参数。 |
| 系统提示词 | 改名为“系统指令模板”，默认折叠，仅高级用户编辑。 |
| 流式输出 | 文案改为“实时输出”，并根据模型/协议能力自动禁用或降级。 |

### 6.3 移除的选项

以下选项不应继续出现在图生文设置页或工作台高级选项里：

- 高级自定义连接。
- 图生文专用 API Key。
- 图生文专用 API Base URL。
- 图生文专用裸模型 ID 输入。
- 图生文专用端点列表。
- 复用 OpenAI 图片供应商凭证。
- 默认兼容模式。
- 设为默认图生文端点。

这些能力分别迁移到：

- API Key、Base URL、协议模板：供应商端点管理。
- 模型读取和多模型白名单：供应商端点管理。
- 任务默认模型：图生文与多模态设置页的端点-模型绑定。
- 协议适配：由端点 `provider`、`protocol` 和兼容族自动决定。

## 7. 模型读取弹窗复用

模型选择弹窗需要支持两种使用方式：

| 场景 | 模式 | 行为 |
| --- | --- | --- |
| 供应商端点管理 | 多选 | 读取模型列表并维护端点模型白名单 |
| 图生文与多模态 | 单选 | 读取模型列表并绑定 `vision.text` 默认模型 |

图生文单选模式要求：

1. 打开弹窗即读取最新模型列表。
2. 当前已选模型标记为“当前选中”。
3. 用户确认后只绑定一个模型。
4. 支持搜索模型 ID、显示名和供应商。
5. 支持手动添加隐藏模型 ID。
6. 支持展示模型来源：远端读取、自定义添加、已有目录项。
7. 读取失败不清空已有模型目录。
8. 弹窗内提供“管理此端点”修复路径。

## 8. 执行链路

图生文执行时应只依赖统一模型目录选择，不再读取旧专用图生文连接作为主路径。

提交前解析：

1. 读取 `modelTaskDefaultCatalogEntryIds['vision.text']` 或本次任务临时选择的目录项 ID。
2. 找到对应 `modelCatalog` 条目。
3. 找到对应 `providerEndpoints` 条目。
4. 根据端点兼容族和协议选择请求适配器。
5. 使用端点的 API Key、Base URL 和模型 ID 发起请求。

适配器要求：

| 端点族 | 协议/适配器 | 图像输入方式 |
| --- | --- | --- |
| OpenAI 兼容 | Responses API | content input image 或等价兼容格式 |
| OpenAI 兼容 | Chat Completions Vision | message content image_url/data URL |
| Anthropic 兼容 | Messages API | image content block + text block |

Web 与 Tauri 要求：

- Web 服务器中转继续走 `/api/image-to-text`。
- 客户端直连继续遵守现有连接策略和 CORS 限制。
- Tauri 桌面继续走 Rust proxy，不依赖 Next API Route。
- URL 安全校验、密钥遮蔽、图片大小限制、取消请求和流式事件边界不能弱化。

## 9. 迁移与兼容

旧配置需要平滑迁移，但新 UI 不再展示旧专用连接。

迁移规则：

1. 读取旧 `visionTextProviderInstances` 时，转换为统一 `providerEndpoints`。
2. 旧实例中的 `apiKey`、`apiBaseUrl`、`kind` 和 `apiCompatibility` 映射到端点字段和协议模板。
3. 旧实例中的 `models` 写入对应端点的 `modelIds`，并生成 `modelCatalog` 条目。
4. 如果旧配置明确保存了 `selectedVisionTextProviderInstanceId` 和 `visionTextModelId`，迁移后可以设置 `modelTaskDefaultCatalogEntryIds['vision.text']`，这是保留用户既有选择，不属于新用户自动默认。
5. 如果旧配置只有系统内置默认模型，没有用户显式保存过端点和模型，不应自动绑定默认模型。
6. 保存新配置时，不再写入新的 `visionTextProviderInstances` 作为主数据；旧字段仅用于导入旧配置和向后兼容。
7. 导出配置时优先导出统一端点和模型目录；旧字段可保留为兼容字段，但不能作为 UI 主路径。

需要废弃的环境变量或旧配置入口：

- `VISION_TEXT_API_KEY`
- `VISION_TEXT_API_BASE_URL`
- `VISION_TEXT_MODEL_ID`
- `VISION_TEXT_API_COMPATIBILITY`

如果运行环境仍提供这些值，可以作为一次性迁移来源或服务器默认端点创建来源，但不应在产品 UI 中表现为图生文专用连接。

## 10. 边界情况

| 场景 | 期望行为 |
| --- | --- |
| 没有可用端点 | 图生文设置显示添加端点入口；工作台提交前提示先配置 |
| 有端点但未选模型 | 可以选择端点并点击模型状态框读取模型 |
| 端点读取模型失败 | 弹窗展示错误，保留手动添加模型 ID |
| 模型同名但来自不同端点 | 按端点隔离，不能跨端点复用目录项 |
| 用户切换端点 | 当前任务模型清空为待选择，不删除旧模型 |
| 用户取消设置弹窗 | 不落盘端点选择和模型绑定草稿 |
| 模型不支持图片输入 | 运行时报供应商错误，不自动换模型 |
| 端点不支持流式 | 实时输出自动禁用或降级非流式 |
| 端点不支持结构化输出 | 输出目标降级自然文本，保留全文复制 |
| Anthropic 模型被选择 | 使用 Anthropic Messages 适配器，不走 OpenAI 请求体 |
| 分享链接包含旧图生文字段 | 导入时迁移到统一端点和任务默认模型 |

## 11. 分阶段实施建议

### Phase 1：设置页模型选择收敛

- 在图生文设置页复用 `ProviderEndpointModelBindingPicker`。
- 允许 OpenAI/OpenAI 兼容与 Anthropic/Anthropic 兼容端点进入候选。
- 点击模型状态框打开单选模型列表弹窗。
- 移除图生文设置页的“高级自定义连接”展示。
- 新用户不再自动绑定 `DEFAULT_VISION_TEXT_MODEL`。

### Phase 2：执行链路和迁移

- `resolveVisionTextCatalogSelection` 改为优先且显式依赖 `modelTaskDefaultCatalogEntryIds['vision.text']`。
- 旧 `visionTextProviderInstances` 只作为迁移输入。
- Web `/api/image-to-text` 和 Tauri proxy 使用统一端点与模型目录。
- 增加 Anthropic Messages 图生文适配器。
- 补齐配置导入导出和分享链接迁移测试。

### Phase 3：工作台高级选项统一

- 图生文模式高级选项移除旧供应商下拉和模型下拉。
- 复用同一端点-模型绑定交互。
- 将“兼容模式”从任务选项移除，由端点协议决定。
- 将输出格式、结构化输出和最大 Token 重组为更面向用户价值的选项。

### Phase 4：体验细化

- 模型弹窗展示端点协议、能力推断和风险提示。
- 输出长度使用预设 + 自定义模式。
- 系统指令模板支持恢复默认、按任务类型切换模板。
- 在历史记录中保存目录项 ID、端点 ID、模型 ID 和任务选项快照。

## 12. 验收标准

### 12.1 产品验收

- 图生文设置页不存在“高级自定义连接”。
- 图生文设置页不存在专用 API Key、Base URL、裸模型 ID 输入。
- 新用户未选择模型时，不会自动使用内置默认模型。
- 有可用端点时，用户可以选择端点并点击模型状态框读取最新模型列表。
- 模型选择弹窗为单选，确认后绑定为 `vision.text` 默认模型。
- 没有可用端点时，用户可以跳转到供应商端点管理添加端点。
- 工作台图生文高级选项与设置页模型选择体验一致。
- OpenAI/OpenAI 兼容和 Anthropic/Anthropic 兼容端点都能作为候选进入选择流程。

### 12.2 技术验收

- 端点和模型主数据只使用 `providerEndpoints`、`modelCatalog`、`modelTaskDefaultCatalogEntryIds`。
- `bindProviderModelToTask` 能正确补充 `vision.text` 能力和输入输出模态。
- 图生文执行链路使用目录项解析端点、凭证、Base URL 和模型 ID。
- Web 与 Tauri 分支都不依赖旧图生文专用连接作为主路径。
- 旧配置导入后能迁移到统一端点和模型目录。
- API Key、Base64 图片、系统指令模板不会完整写入日志。
- 所有新增或修改的可见文案进入 i18n 资源。

### 12.3 测试建议

单元测试：

- OpenAI/Anthropic 兼容端点筛选。
- 图生文模型绑定补充 `vision.text` 能力。
- 未选择 `vision.text` 默认模型时不自动回退默认模型。
- 旧 `visionTextProviderInstances` 迁移。
- OpenAI Responses、OpenAI Chat Completions Vision、Anthropic Messages 请求体组装。
- 输出目标、实时输出、输出长度选项归一化。

集成测试：

- Web `/api/provider-models` 读取 OpenAI 兼容模型并单选绑定。
- Web `/api/provider-models` 读取 Anthropic 兼容模型并单选绑定。
- Web `/api/image-to-text` 使用绑定目录项提交。
- Tauri `proxy_provider_models` 和 `proxy_image_to_text` 使用同一配置提交。

人工验收：

- 桌面和移动布局下，端点选择、管理此端点、模型状态框不拥挤不溢出。
- 浅色和深色主题下模型弹窗、空状态、错误状态可读。
- 用户从无端点到添加端点、读取模型、绑定模型、回到图生文提交的闭环顺畅。
