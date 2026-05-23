---
title: 视频供应商与模型接入补齐需求文档
summary: 基于统一供应商配置与视频生成现状，补齐视频相关供应商端点的可见性、模型发现、多选添加、手动添加与默认模型绑定闭环，确保新增供应商时能直接选择可用的视频模型，而不是只新增一个空端点。
createdAt: 2026-05-23
updatedAt: 2026-05-23
status: implemented
---

# 视频供应商与模型接入补齐需求文档

## 1. 范围说明

本文只处理一件事：把视频相关供应商端点和视频模型接入，真正收敛到统一供应商配置里。

它不重复定义视频任务执行链路、历史、同步、下载和恢复，这些继续以 `VIDEO_GENERATION_REQUIREMENTS.md` 和 `VIDEO_GENERATION_REQUIREMENTS_v2.md` 为主。
它也不重复定义统一供应商目录的长期架构，这部分继续以 `UNIFIED_PROVIDER_CONFIGURATION_REUSE_REQUIREMENTS.md` 为主。

本文要解决的是用户最直接的痛点：

1. 新增供应商端点时，看不到视频厂商。
2. 点击获取模型列表后，不能批量勾选，只能一个个加。
3. 刷新模型和选择模型被拆成了两步，流程割裂。
4. 自定义添加虽然存在，但没有和发现模型形成一个完整闭环。
5. 视频模型默认值已经在目录里预留，但端点和模型没有被正确暴露出来。

## 2. 当前实现盘点

| 模块 | 当前状态 | 影响 |
| --- | --- | --- |
| `src/components/settings-dialog.tsx` 的“新增供应商端点” | 只提供 OpenAI、Google Gemini、Seedream、SenseNova | 视频厂商不能在新增端点时被直接选择 |
| `src/components/settings-dialog.tsx` 的模型发现 | 发现结果是单条追加逻辑，缺少批量勾选流 | 用户必须一个个添加模型 |
| `src/lib/model-discovery.ts`、`src/app/api/provider-models/route.ts`、`src-tauri/src/proxy/provider_models.rs` | 目前只支持 OpenAI-compatible / Ark 一类模型列表读取 | 多数视频厂商不能按各自模型列接口自动发现 |
| `src/lib/provider-model-catalog.ts` | 已有 `ProviderKind`、`ProviderProtocol`、`video.generate`、`video.imageToVideo`、`VideoModelFeatures` | 底座已在，但前端没有把视频厂商真正露出来 |
| `src/lib/video-providers/bootstrap.ts` | OpenAI Sora、DashScope 为真实适配器，其余大多是 placeholder | 占位协议不能当作已交付能力对外呈现 |
| `src/components/editing-form.tsx` | 视频模式会读统一目录，但前提是目录里已经有可用视频模型 | 如果端点和模型没接好，视频入口还是会落空 |

结论很明确：代码已经有统一目录和视频能力枚举，缺的是“供应商端点可见性”和“模型批量接入”这两段闭环。

## 3. 目标

1. 新增供应商端点时，视频厂商必须是可选项，不能只剩通用 OpenAI-compatible。
2. 新增端点后，用户可以在同一流程里读取模型、批量勾选、批量添加。
3. 刷新模型与选择模型合并为一个主流程，主按钮语义应是“选择模型”或“读取并选择模型”。
4. 自定义添加必须保留，因为有些厂商会隐藏模型，不在列表里显示。
5. 视频模型必须真正绑定到统一目录和任务默认值，不能只留下一个空端点配置。
6. 视频生成能力的默认模型、可选模型和能力标记，要和端点配置一起可见、可维护、可验证。
7. Web 与 Tauri 的行为要一致，不能只在一个运行时里看得到视频厂商。

## 4. 术语

- 供应商品牌：用户能看懂的厂商品牌，如 OpenAI、Google Veo、Runway、Luma、MiniMax、Kling、Seedance、Hunyuan、fal.ai、xAI。
- 供应商端点：某个品牌下的一次可调用 API 配置，包含名称、Key、Base URL、协议和启用状态。
- 协议：具体的 HTTP / SDK 适配方式，不等于品牌。
- 模型目录项：端点下的某个模型在统一目录中的记录。
- 任务能力：`video.generate`、`video.imageToVideo` 等任务级能力。

## 5. 视频供应商暴露规则

视频供应商必须作为一等可选项出现在“新增供应商端点”里。即使某些供应商在传输层兼容 OpenAI，也不能只显示成 `OpenAI Compatible`，否则用户看不到真实品牌，也看不到不同端点地址的差异。

下面这些供应商必须被明确暴露，且要区分品牌与协议：

| 供应商品牌 | 推荐展示名 | 协议 / 端点差异 | 当前要求 |
| --- | --- | --- | --- |
| OpenAI Sora | OpenAI / Sora | `openai-videos` | 已实现，必须可选 |
| Google Veo | Google Veo (Gemini API) / Google Veo (Vertex AI) | `gemini-generate-videos` / `vertex-ai-veo` | 必须可选 |
| Runway | Runway | `runway-api-v1` | 必须可选 |
| Luma | Luma Dream Machine | `luma-dream-machine` | 必须可选 |
| MiniMax | MiniMax Hailuo | `minimax-video` | 必须可选 |
| Kling | Kling | `kling-api` | 必须可选 |
| BytePlus ModelArk / Seedance | BytePlus ModelArk | `modelark-video-generation` | 必须可选 |
| Tencent Hunyuan / TokenHub | Tencent Hunyuan / TokenHub Video | `tencent-vclm` / `tencent-tokenhub-video` | 必须可选 |
| fal.ai / Happy Horse | fal.ai | `fal-model-api` | 必须可选 |
| xAI Grok Imagine | xAI | `xai-imagine-video` | 必须可选，但必须明确标注适配状态 |

要求：

1. 视频供应商下拉必须按品牌分组，不得把所有视频厂商折叠进一个 `OpenAI Compatible` 选项。
2. 同一品牌如果存在多个协议根路径，必须拆成独立选项。
3. 每个供应商选项都要给出默认 Base URL 提示。
4. 如果某个供应商的适配器尚未完成，UI 必须明确标注“协议预留”或“适配器待实现”，不能伪装成已经可交付。

## 6. 新增供应商端点流程

新增供应商端点时，流程必须是一个连续步骤，而不是只保存凭证后把用户扔回列表页。

### 6.1 端点创建

1. 用户进入“新增供应商端点”。
2. 先选择供应商品牌和协议模板。
3. 再填写名称、API Key、Base URL。
4. 可选执行连接测试。
5. 保存后自动进入“选择模型”步骤。

### 6.2 模型绑定

1. 模型绑定是端点创建后的同一流程，不是另一个孤立页面。
2. 主按钮语义应是“选择模型”或“读取并选择模型”，不是单纯“刷新模型”。
3. 读取成功后，直接展示可勾选的模型列表。
4. 用户可以一次勾选多个模型并批量添加。
5. 用户仍然可以随时手动添加模型 ID。
6. 如果用户跳过模型绑定，端点可以保存，但必须标记为“未完成”或“待补模型”，不能默认参与视频生成。

### 6.3 端点完成状态

1. 一个视频端点只有在至少绑定一个真实可用的视频模型后，才应进入默认可选视频端点列表。
2. 如果只有空端点，没有模型，系统必须提示用户这是未完成配置。
3. 不允许把“只有端点，没有视频模型”伪装成已可用能力。

## 7. 模型发现与多选添加

模型发现必须和模型选择合并成一个流，不再拆成两个主要动作。

### 7.1 发现流程

1. 用户点击“选择模型”。
2. 系统按当前端点的品牌与协议读取相应模型列表。
3. 如果该协议支持模型列表接口，返回后直接进入可选择界面。
4. 如果该协议没有列表接口，则显示清晰的“该供应商暂不支持自动读取”，同时保留手动添加。

### 7.2 多选要求

1. 模型列表必须支持复选框多选。
2. 必须支持当前筛选结果的批量添加。
3. 必须支持搜索。
4. 必须支持“全选当前结果”和“清空选择”。
5. 批量添加必须按 `providerEndpointId + rawModelId` 去重。
6. 添加动作要保持原子性，不能只加一半。

### 7.3 展示字段

每个发现到的模型至少要显示：

1. raw model id。
2. display label。
3. upstream vendor。
4. 能力标签。
5. 置信度。
6. 来源类型。

### 7.4 保留手动添加

1. 手动添加模型 ID 必须一直保留。
2. 手动添加允许填写显示名和能力覆盖。
3. 手动添加要允许把隐藏模型、未返回模型、私有模型加入目录。
4. 手动添加的模型不能因为“没出现在列表里”就被删掉或覆盖。

## 8. 视频模型接入要求

视频模型最终必须落到统一目录里，并参与默认任务绑定。

### 8.1 统一目录要求

1. 视频模型必须写入 `modelCatalog`。
2. 不能新建并行的 `videoProviderInstances` 或另一套视频模型 registry。
3. 视频模型条目必须保留 `providerEndpointId`、`provider`、`protocol`、`rawModelId`、`capabilities`、`defaults`、`capabilityConfidence`。
4. `video.generate` 与 `video.imageToVideo` 的默认绑定必须写入 `modelTaskDefaultCatalogEntryIds`。

### 8.2 能力要求

1. 支持 `video.generate` 和 `video.imageToVideo` 的模型必须明确标记。
2. 后续 `video.edit`、`video.extend`、`video.referenceToVideo` 等能力要保留扩展位。
3. 支持的视频特性必须进入 `VideoModelFeatures`，不能只靠字符串备注。
4. 需要展示的默认参数包括时长、比例、分辨率档位、帧率、数量、负向提示词、seed、提示词增强、原生音频、水印等。

### 8.3 占位与真实能力分离

1. 占位适配器只能算协议预留。
2. 只要适配器没有真实实现，就不能当作可交付生成能力。
3. 如果用户选中了占位模型，提交时必须明确阻止并给出原因。
4. 不能在默认模型选择里自动偏向占位模型。

## 9. 模型发现的运行时要求

1. Web 端继续走 API Route，但路由必须支持视频厂商的发现能力，不局限于 OpenAI-compatible。
2. Tauri 端继续走 Rust proxy，但实现要和 Web 的归一化结果一致。
3. 如果某个视频厂商没有统一的列表接口，必须在 UI 上明确说明，并保留手动添加。
4. 不得削弱现有 URL 安全策略。
5. 公网 Web 不能静默访问不安全的地址。
6. 直连模式、代理模式、桌面端都要保留一致的交互语义。

## 10. 设置页交互要求

1. “新增供应商端点”里必须能看到视频品牌。
2. 每个品牌卡片里要能直接进入模型选择。
3. 模型列表不能只显示“添加所选”却不支持多选。
4. 刷新模型和从已读模型里选择，不应再拆成两个彼此独立的主动作。
5. 视频供应商的默认模型选择，要能直接回填到视频任务默认项。
6. 如果端点绑定了视频模型，视频模式就应该能在统一目录里找到它。
7. 如果没有绑定成功，系统要明确提示缺少可用视频模型，而不是只给一个空端点。

## 11. 验收标准

1. 新增供应商端点时，视频供应商能正常出现在下拉中。
2. 保存端点后，系统会直接进入模型选择流。
3. 发现模型时，用户能一次勾选多个并批量添加。
4. 手动添加模型依然可用。
5. 视频模型会写入统一目录，并能绑定 `video.generate` / `video.imageToVideo` 默认值。
6. 占位适配器不会被误认为已可交付。
7. 轻色 / 深色主题都可读，移动端 / 桌面端都不溢出。
8. Web 与 Tauri 的行为一致。
9. 新增的视频端点可以真正支撑视频生成，而不是只保存一组看起来完整的配置字段。

## 12. 与现有文档关系

1. `UNIFIED_PROVIDER_CONFIGURATION_REUSE_REQUIREMENTS.md` 定义统一端点和统一模型目录的主架构。
2. `VIDEO_GENERATION_REQUIREMENTS_v2.md` 定义视频任务、历史、同步和执行闭环。
3. 本文只补“视频供应商可见性 + 模型发现 + 多选添加 + 默认绑定”的缺口。

后续实施时，建议按这个顺序推进：

1. 先把视频供应商暴露到新增端点 UI。
2. 再把模型发现改成“选择模型”式批量流。
3. 再把发现结果写回统一目录和视频默认模型。
4. 最后补齐各视频厂商的真实适配器。

## 13. 本轮实现记录

本轮已完成本文要求中的供应商端点与模型接入闭环：

1. 统一模型目录页新增视频供应商端点模板，覆盖 OpenAI Sora、Google Veo、Runway、Luma、MiniMax、Kling、BytePlus ModelArk、DashScope / Wan、Tencent Hunyuan、Tencent TokenHub、fal.ai、xAI。
2. 新增视频端点默认带空 `modelIds` 白名单，只有绑定模型后才会进入视频任务可选模型；空端点会显示“待补模型”。
3. 支持模型列表接口的协议可点击“选择模型”读取远端模型，并在同一区域搜索、全选当前结果、清空选择和批量添加。
4. 手动添加模型 ID、显示名和上游厂商继续保留，用于隐藏模型、私有模型和未返回模型。
5. 发现模型和手动模型都会写入 `modelCatalog`，并按端点协议推断视频能力；已实现协议的可用视频模型会自动补 `video.generate` / `video.imageToVideo` 默认绑定。
6. OpenAI Sora 与 DashScope / Wan 作为真实已实现视频适配器；其他视频协议继续标为“协议预留 / 适配器待实现”，不会自动成为可提交默认模型。
7. Web `/api/provider-models` 与 Tauri `proxy_provider_models` 均允许 `openai-videos`、`tencent-tokenhub-video` 这类可复用 OpenAI-compatible `/models` 的视频协议读取模型列表。
