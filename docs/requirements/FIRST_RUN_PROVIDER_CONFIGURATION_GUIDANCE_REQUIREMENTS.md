---
title: 首次使用缺配置引导与快捷入口需求文档
summary: 将首次生图、图生文、批量 AI 规划、提示词润色和视频等缺少端点/API Key/模型时的专业报错，收敛为短提示加“点我配置”纯文字按钮，并按当前任务直达最短配置入口。
createdAt: 2026-06-02
status: proposed
relatedDocs:
    - ../providers-and-settings.md
    - ./PROVIDER_MODEL_SETTINGS_CONSOLIDATION_REQUIREMENTS.md
    - ./UNIFIED_PROVIDER_CONFIGURATION_REUSE_REQUIREMENTS.md
    - ./IMAGE_TO_TEXT_MULTIMODAL_MODEL_SELECTION_REFACTOR_REQUIREMENTS.md
    - ./PROMPT_POLISH_MODEL_SELECTION_REFACTOR_REQUIREMENTS.md
    - ./BATCH_CONFIGURATION_MANAGEMENT_REQUIREMENTS.md
    - ./VIDEO_PROVIDER_MODEL_ONBOARDING_REQUIREMENTS.md
---

# 首次使用缺配置引导与快捷入口需求文档

## 1. 背景

新用户首次进入 GPT Image Playground 时，最常见路径是直接输入提示词并点击生成，或者上传图片后尝试图生文。此时如果本地没有配置任何供应商端点、API Key 或任务模型，当前生图路径会返回：

```text
服务器中转模式需要配置 API Key。请在系统设置中填写 API Key，或在服务端环境变量 OPENAI_API_KEY 中配置。
```

这条提示对新用户不友好，原因有三点：

1. “服务器中转模式”“服务端环境变量”“OPENAI_API_KEY”是部署和开发概念，不是用户当下要完成的动作。
2. 它只告诉用户缺 API Key，没有把用户带到正确的配置页面。
3. 生图、图生文、批量 AI 规划、提示词润色、视频等功能需要配置的入口不同，泛泛地说“去系统设置”会让用户继续迷路。

本需求的目标是把“缺配置”从专业报错改成任务上下文里的快捷引导：用户不需要理解架构，只需要点击 **点我配置**，就能到达当前功能最该去的配置位置。

## 2. 目标

1. 所有首次使用时的缺端点、缺 API Key、缺任务模型错误，都使用简短提示：

    ```text
    请先配置服务供应商端点和填写 API Key。
    ```

2. 提示后紧跟一个纯文字按钮：

    ```text
    点我配置
    ```

3. 点击 **点我配置** 后，必须按当前任务直达最短配置入口：

    | 当前任务            | 点击后进入                         | 进一步要求                                                   |
    | ------------------- | ---------------------------------- | ------------------------------------------------------------ |
    | 生图 / 图片编辑     | `供应商与模型 -> 图片模型端点管理` | 效果必须等同于在图片模型端点管理里点击“添加端点”             |
    | 图生文 / 多模态文本 | `图生文与多模态`                   | 聚焦端点和模型绑定区；无可用端点时展示添加端点入口           |
    | 提示词润色          | `提示词润色配置`                   | 聚焦润色模型绑定区；无可用端点时展示添加端点入口             |
    | 批量 AI 规划        | `批量配置`                         | 聚焦批量规划模型绑定区；文本切分和 JSON 导入不需要触发该提示 |
    | 文生视频 / 图生视频 | `供应商与模型 -> 视频端点管理`     | 效果必须等同于在视频端点管理里点击“添加端点”                 |

4. 配置入口必须按当前场景预选合理模板，减少用户二次判断：

    | 场景                                            | 推荐预选                                                             |
    | ----------------------------------------------- | -------------------------------------------------------------------- |
    | 当前选中 OpenAI 图片模型                        | OpenAI 图片端点模板                                                  |
    | 当前选中 OpenAI 兼容图片模型或无法判断          | OpenAI 兼容图片端点模板                                              |
    | 当前选中 Gemini / Seedream / SenseNova 图片模型 | 对应图片供应商模板                                                   |
    | 图生文、润色、批量规划无端点                    | OpenAI 兼容端点模板，并允许切换 Anthropic 兼容                       |
    | 文生视频 / 图生视频                             | 对应视频任务可用的首个真实适配器模板；无法判断时进入视频端点模板选择 |

5. 所有配置引导都必须保留用户当前输入状态，包括提示词、源图、批量草稿、视频模式、参数选择和结果区状态。
6. Web、Tauri 桌面和 Tauri Android 必须保持同一交互语义；不能只在 Web API route 上改文案。

## 3. 非目标

- 不在本需求中实现供应商自动开户、自动获取 API Key 或自动代填用户密钥。
- 不改变现有 URL 安全策略，不允许公共 Web 静默访问 localhost、私网地址或不安全端点。
- 不弱化服务端环境变量兜底能力；开发者和自部署者仍可使用环境变量，只是不把它作为普通用户的首屏错误文案。
- 不把已配置后的真实供应商错误统一改成缺配置提示。API Key 无效、余额不足、权限不足、限流、模型不存在等错误要继续显示对应原因。
- 不新增一套平行的供应商配置系统；仍然复用 `providerEndpoints`、`modelCatalog` 和 `modelTaskDefaultCatalogEntryIds`。

## 4. 用户体验原则

### 4.1 面向小白用户

缺配置提示只回答两个问题：

1. 现在为什么不能用：还没配置服务供应商端点和 API Key。
2. 下一步点哪里：点我配置。

默认提示里不出现以下词语：

- 服务器中转模式。
- 服务端环境变量。
- `OPENAI_API_KEY`。
- API Route。
- Tauri proxy。
- OpenAI Compatible / Anthropic Compatible 的协议解释。

这些信息可以保留在控制台日志、服务端日志、开发者文档或可展开的高级诊断里，但不能作为普通用户主提示。

### 4.2 按任务直达

不能把所有缺配置都导向设置首页。用户从哪个功能触发错误，就应该进入哪个功能最短的配置路径：

- 生图用户需要先配置图片供应商端点，不应先落到图生文或通用设置页。
- 图生文用户需要进入图生文与多模态任务设置，不应先看到图片模型端点。
- 批量用户需要进入批量配置，不应被带到提示词润色配置。
- 视频用户需要进入视频端点管理，不应被带到图片模型端点。

### 4.3 文案短，动作明确

推荐视觉结构：

```text
请先配置服务供应商端点和填写 API Key。 点我配置
```

要求：

1. “点我配置”是纯文字按钮，不使用填充按钮、卡片按钮或大面积 CTA。
2. 按钮可以使用现有 Button 的 link / ghost 语义，但视觉上必须像文字动作。
3. 按钮必须可键盘聚焦，具备清晰 focus ring。
4. 移动端不能因为提示和按钮放在同一行而溢出；空间不足时按钮换行。
5. 同一处提示不要同时出现多个配置按钮，避免用户不知道点哪一个。

## 5. 缺配置状态定义

缺配置不是只有“API Key 为空”。至少要覆盖以下状态：

| 状态             | 判断                                                  | 用户动作                                         |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------ |
| 缺供应商端点     | 当前任务找不到可用 `providerEndpoint`                 | 进入对应端点新增流程                             |
| 缺 API Key       | 端点存在但没有可用 `apiKey`，且运行时没有可用临时 Key | 进入对应端点编辑或新增流程                       |
| 缺 Base URL      | 当前供应商模板要求 Base URL 但未填写                  | 进入对应端点编辑流程                             |
| 缺任务模型       | 端点和 Key 存在，但没有绑定当前任务能力的模型         | 进入对应任务模型绑定区                           |
| 端点未纳管模型   | 端点已保存但 `modelIds` 为空，任务下拉没有可用模型    | 进入模型读取 / 手动添加模型流程                  |
| 视频适配器不可用 | 视频模型是协议预留或适配器待实现                      | 进入视频端点管理或视频模型选择，选择真实可用模型 |

这些状态都可以使用同一条短提示，但 **点我配置** 的目标必须不同。

## 6. 配置目标映射

### 6.1 生图与图片编辑

触发场景：

- 用户在文生图模式提交。
- 用户上传源图后提交图片编辑。
- Web API `/api/images` 返回缺 API Key。
- 客户端直连或 Tauri 图片路径在提交前发现缺配置。

目标行为：

1. 前端应尽量在提交前完成缺配置预检，避免等 API route 返回专业报错后再转换。
2. 如果仍由 API route 返回错误，前端必须把错误归一化为缺配置引导。
3. 点击 **点我配置** 后打开设置弹窗：
    - 进入 `供应商与模型 -> 图片模型端点管理`。
    - 自动触发与“图片模型端点管理”里点击“添加端点”相同的流程。
    - 按当前选中的图片模型或供应商预选模板。
4. 如果已经有图片端点但 Key 为空，优先打开该端点编辑状态，而不是新建一个重复端点。
5. 如果 Key 存在但当前模型不在端点模型白名单中，优先打开该端点的模型列表弹窗。

### 6.2 图生文与多模态

触发场景：

- 用户切换到图生文模式后提交。
- 工作台高级选项发现没有 `vision.text` 默认模型。
- `/api/image-to-text` 或 Tauri 图生文代理发现缺 API Key、缺端点或缺模型。

目标行为：

1. 点击 **点我配置** 后进入 `图生文与多模态` 设置页。
2. 如果没有符合条件的 OpenAI / OpenAI 兼容或 Anthropic / Anthropic 兼容端点，图生文设置页显示短提示和添加端点入口。
3. 如果已有端点但未选择模型，聚焦端点选择器和“尚未选择模型”状态框。
4. 用户点击模型状态框后，复用模型列表弹窗读取最新模型并单选绑定 `vision.text`。
5. 不再引导用户到旧的图生文专用 API Key、Base URL 或裸模型 ID 输入框。

### 6.3 提示词润色

触发场景：

- 用户点击提示词润色。
- 润色请求发现没有 `prompt.polish` 默认模型。
- 润色 API route、客户端直连或 Tauri 代理发现缺端点、缺 Key 或缺模型。

目标行为：

1. 点击 **点我配置** 后进入 `提示词润色配置`。
2. 如果没有可用端点，润色配置页显示添加端点入口，并预选 OpenAI 兼容端点模板。
3. 如果已有端点但未绑定模型，聚焦润色模型状态框。
4. 批量规划模型不自动继承润色模型；只允许用户显式选择或显式复用。

### 6.4 批量 AI 规划

触发场景：

- 用户在批量面板选择 AI 类规划方式并生成预览。
- 批量规划请求发现没有 `prompt.batchPlan` 默认模型。
- `/api/batch-plan` 返回缺 API Key 或缺模型。

目标行为：

1. 点击 **点我配置** 后进入 `批量配置`。
2. 聚焦批量规划模型绑定区。
3. 如果没有可用端点，批量配置页显示添加端点入口，并预选 OpenAI 兼容端点模板。
4. 文本切分和 JSON 导入不调用 AI，不应触发缺模型提示。
5. 打开设置时必须保留批量草稿和已生成的本地预览，用户配置完成后能继续原流程。

### 6.5 文生视频与图生视频

触发场景：

- 用户从视频入口提交文生视频。
- 用户带源图提交图生视频。
- 视频默认模型缺失、视频端点缺失、视频端点 Key 为空。
- 用户选择了协议预留或适配器待实现的视频模型。

目标行为：

1. 点击 **点我配置** 后进入 `供应商与模型 -> 视频端点管理`。
2. 自动触发与“视频端点管理”里点击“添加端点”相同的流程。
3. 如果当前任务是图生视频，优先展示支持 `video.imageToVideo` 的真实适配器模板。
4. 如果当前任务是文生视频，优先展示支持 `video.generate` 的真实适配器模板。
5. 协议预留供应商可以出现在高级区域，但不能成为默认推荐配置路径。

## 7. 技术要求

### 7.1 统一配置引导模型

建议新增一个轻量的配置引导模型，避免每个功能自己拼文案和跳转：

```ts
type ConfigurationGuidanceTarget = {
    view:
        | 'provider-endpoints'
        | 'image-endpoints'
        | 'video-endpoints'
        | 'vision-text'
        | 'polish-prompts'
        | 'batch-config';
    intent: 'add-endpoint' | 'edit-endpoint' | 'select-task-model' | 'manage-endpoint-models';
    taskCapability?:
        | 'image.generate'
        | 'image.edit'
        | 'vision.text'
        | 'prompt.polish'
        | 'prompt.batchPlan'
        | 'video.generate'
        | 'video.imageToVideo';
    providerEndpointId?: string;
    providerTemplateId?: string;
    source?: 'workbench' | 'api-error' | 'settings-empty-state' | 'tauri-proxy';
};
```

这个对象只表达 UI 跳转意图，不保存 API Key、Base URL 或用户输入内容。

### 7.2 设置弹窗 deep link

当前 `SettingsDialog` 已支持通过 `openTarget.view` 程序化打开 `batch-config` 和 `vision-text`。本需求需要把它扩展为通用 deep link：

1. `settingsOpenTarget.view` 支持所有相关设置页：`image-endpoints`、`video-endpoints`、`provider-endpoints`、`vision-text`、`polish-prompts`、`batch-config`。
2. `openTarget` 支持 `intent`、`providerEndpointId`、`providerTemplateId`、`taskCapability`。
3. `SettingsDialog` 收到 `intent = add-endpoint` 时，只触发一次新增端点流程，不能因 React StrictMode 或重复 render 创建多个草稿。
4. `intent = edit-endpoint` 时，滚动并聚焦对应端点卡片的 API Key / Base URL 区。
5. `intent = select-task-model` 时，聚焦对应任务的模型状态框。
6. `intent = manage-endpoint-models` 时，打开对应端点的模型列表弹窗。

### 7.3 错误归一化

缺配置错误需要从“字符串匹配”升级为结构化状态。

建议 API route、客户端直连和 Tauri 代理统一返回或抛出类似结构：

```ts
type UserRecoverableError = {
    code:
        | 'configuration_required'
        | 'missing_provider_endpoint'
        | 'missing_api_key'
        | 'missing_task_model'
        | 'endpoint_model_incomplete';
    message: string;
    guidanceTarget?: ConfigurationGuidanceTarget;
    debugMessage?: string;
};
```

要求：

1. 用户可见 `message` 使用短提示，不包含服务端环境变量说明。
2. `debugMessage` 可以包含环境变量、API route、proxy 等开发信息，但只进入日志或高级诊断。
3. 前端 notice、任务卡片错误、批量弹窗错误和设置空状态都通过同一个渲染组件显示 `message + 点我配置`。
4. 旧字符串仍需短期兼容，例如识别旧的“服务器中转模式需要配置 API Key”并转换为新的配置引导。

### 7.4 i18n 要求

所有新增或变更的用户可见文案必须进入 `src/lib/i18n/*`。

建议中文文案：

| key                                      | zh-CN                                    |
| ---------------------------------------- | ---------------------------------------- |
| `configuration.required.message`         | `请先配置服务供应商端点和填写 API Key。` |
| `configuration.required.action`          | `点我配置`                               |
| `configuration.required.image.aria`      | `打开图片模型端点配置`                   |
| `configuration.required.visionText.aria` | `打开图生文与多模态配置`                 |
| `configuration.required.polish.aria`     | `打开提示词润色配置`                     |
| `configuration.required.batch.aria`      | `打开批量配置`                           |
| `configuration.required.video.aria`      | `打开视频端点配置`                       |

英文和其他已支持语言需要同步补齐，不能只改中文硬编码。

### 7.5 Web 与 Tauri 边界

1. Web API route 可以继续使用环境变量作为兜底，但返回给浏览器的普通错误不再提环境变量。
2. Tauri 桌面代理的缺配置错误要映射到同一套 `ConfigurationGuidanceTarget`。
3. 功能代码不得直接 import Tauri API；仍然通过 `src/lib/desktop-runtime.ts`。
4. 客户端直连模式缺 Key 时，也显示同样的引导，不要提示用户去配置服务端环境变量。

## 8. 界面落点

### 8.1 Notice / Toast

适用于提交后立即失败的场景：

```text
请先配置服务供应商端点和填写 API Key。 点我配置
```

要求：

1. notice 中的按钮是纯文字动作。
2. 点击后打开设置弹窗，不丢失当前 notice 上下文。
3. 如果同一缺配置错误重复触发，合并 notice，避免刷屏。

### 8.2 Inline Empty State

适用于设置页和工作台高级选项内的空状态：

```text
请先配置服务供应商端点和填写 API Key。
点我配置
```

要求：

1. 空状态不使用大面积营销式卡片。
2. 使用现有 `app-panel-subtle`、Notice 或轻量 inline block。
3. 可以在辅助文案中说明当前任务需要哪个模型，但不要把协议细节放在主文案。

### 8.3 Task Card Error

适用于任务已经进入队列后失败的场景：

1. 任务卡片错误摘要显示短提示。
2. 错误详情折叠区可以展示原始调试信息。
3. 摘要区提供 **点我配置**。
4. 重试按钮在缺配置修复前可以保持禁用或提示先配置。

## 9. 验收标准

1. 清空本地配置、无服务端环境变量时，首次点击生图只显示“请先配置服务供应商端点和填写 API Key。”和“点我配置”，不再显示“服务器中转模式”“OPENAI_API_KEY”等专业文案。
2. 生图缺配置点击 **点我配置** 后，进入图片模型端点管理，并自动打开与“添加端点”相同的新增端点流程。
3. 图片编辑缺配置与生图一致，但必须保留已上传源图。
4. 图生文缺配置点击 **点我配置** 后，进入图生文与多模态配置界面，聚焦端点和模型选择。
5. 批量 AI 规划缺配置点击 **点我配置** 后，进入批量配置；文本切分和 JSON 导入不触发该引导。
6. 提示词润色缺配置点击 **点我配置** 后，进入提示词润色配置。
7. 文生视频 / 图生视频缺配置点击 **点我配置** 后，进入视频端点管理，并打开新增视频端点流程。
8. 已存在端点但缺 API Key 时，优先编辑已有端点，不创建重复端点。
9. 已存在端点和 Key 但缺任务模型时，优先进入模型绑定或模型读取流程。
10. 轻色 / 深色主题下提示和文字按钮都可读。
11. 移动端 320px 宽度下提示不溢出，按钮可点击，安全区不被遮挡。
12. 所有新增文案都有 i18n 覆盖。
13. Web、客户端直连、Tauri 桌面代理路径都使用同一套缺配置引导语义。
14. 服务端日志或开发者诊断仍能看到足够的原始错误信息，便于自部署排查。

## 10. 测试建议

### 10.1 单元测试

- 配置状态到 `ConfigurationGuidanceTarget` 的映射。
- API route 缺 Key / 缺模型返回结构化错误。
- 旧错误字符串到新引导的兼容转换。
- `SettingsDialog` deep link 去重，确保一次 openTarget 只创建一个新增端点草稿。

### 10.2 组件测试

- Notice 渲染短提示和纯文字按钮。
- 任务卡片错误渲染 `点我配置`。
- 图生文、润色、批量配置页的空状态按钮跳转正确。

### 10.3 浏览器验证

至少覆盖：

1. 桌面轻色：无配置点击生图 -> 点我配置 -> 图片端点新增流程。
2. 桌面深色：无配置点击图生文 -> 点我配置 -> 图生文与多模态。
3. 移动轻色：无配置点击批量 AI 规划 -> 点我配置 -> 批量配置。
4. 移动深色：无配置点击视频 -> 点我配置 -> 视频端点管理。

### 10.4 Tauri 验证

- 桌面静态导出没有 API route 环境变量时，缺配置提示仍然是短提示。
- Tauri 代理返回缺配置时，前端仍能拿到正确 `guidanceTarget`。
- 打开设置后不依赖 Node-only 行为。

## 11. 实施顺序

1. 新增配置引导类型、映射函数和 i18n 文案。
2. 扩展 `SettingsDialog` 的 `openTarget`，支持 `image-endpoints`、`video-endpoints`、`polish-prompts`、`provider-endpoints` 和 intent。
3. 改造 notice / task error / inline empty state，使其支持纯文字动作按钮。
4. 生图和图片编辑路径先接入，替换旧的服务器中转 API Key 文案。
5. 接入图生文、提示词润色、批量 AI 规划和视频缺配置路径。
6. 补齐 Web、客户端直连和 Tauri 代理的结构化错误归一化。
7. 最后做 light / dark、mobile / desktop 和无配置首访回归验证。

## 12. 与现有文档关系

- `PROVIDER_MODEL_SETTINGS_CONSOLIDATION_REQUIREMENTS.md` 定义供应商与模型的主信息架构；本文只定义缺配置时如何把用户带到正确入口。
- `IMAGE_TO_TEXT_MULTIMODAL_MODEL_SELECTION_REFACTOR_REQUIREMENTS.md` 定义图生文模型绑定流程；本文要求图生文缺配置时直达该流程。
- `PROMPT_POLISH_MODEL_SELECTION_REFACTOR_REQUIREMENTS.md` 和 `BATCH_CONFIGURATION_MANAGEMENT_REQUIREMENTS.md` 定义润色与批量模型选择；本文补充它们的错误引导和快捷入口。
- `VIDEO_PROVIDER_MODEL_ONBOARDING_REQUIREMENTS.md` 定义视频端点和模型接入；本文要求视频缺配置时直达视频端点管理。
- `docs/providers-and-settings.md` 是用户手册。本文实现落地后，需要同步更新用户手册中的缺配置提示说明。
