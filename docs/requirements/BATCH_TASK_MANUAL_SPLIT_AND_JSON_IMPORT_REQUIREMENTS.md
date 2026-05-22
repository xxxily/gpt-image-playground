---
title: GPT Image Playground 批量任务手动切分与 JSON 导入需求文档
summary: 在现有 AI 批量规划之外，补充不依赖 AI 的批量任务创建方式：按文本规则切分生成任务，以及按约定 JSON 格式导入外部批量任务。
createdAt: 2026-05-21
updatedAt: 2026-05-21
status: draft-requirement
---

# GPT Image Playground 批量任务手动切分与 JSON 导入需求文档

## 1. 背景与现状

`BATCH_IMAGE_GENERATION_REQUIREMENTS.md` 已定义一套以 AI 自动规划为核心的批量生图工作流：用户输入长文本、创作需求或参考图上下文后，由 AI 生成结构化 `BatchPlan`，再在右侧预览区编辑并确认创建任务。

但批量任务不应该只能依赖 AI 规划。实际使用中有两类高频场景不需要 AI：

- 用户已经准备好一组任务文本，例如多行 prompt、分段脚本、商品卖点、社媒标题或镜头列表，只需要按换行、空行或特殊分隔符拆成多条任务。
- 外部工具、脚本、表格、低代码平台或团队工作流已经生成批量任务 JSON，用户只想粘贴到应用里预览并执行。

如果这些场景仍强制走 AI 规划，会带来额外成本、等待时间、API Key 依赖和不可控改写。新增“文本切分”和“JSON 导入”后，批量能力可以覆盖从手工粘贴到外部自动化的完整输入链路。

## 2. 目标

1. 批量入口支持三种创建方式：`AI 规划`、`文本切分`、`JSON 导入`。
2. `文本切分` 和 `JSON 导入` 不调用 AI、不依赖提示词润色模型、不发起网络规划请求。
3. 用户可以粘贴一段已包含多任务的长文本，按换行、空行或自定义分隔符切分为多条任务。
4. 用户可以粘贴符合规范的 JSON，导入外部创建好的批量任务。
5. 两种新入口最终都生成同一类 `BatchPlan` 预览，继续复用现有预览、编辑、禁用、重排、确认入队和批次元数据能力。
6. 导入和切分都必须保留人工可控性：确认前不直接创建真实任务。
7. 支持当前源图片区的继承策略：任务可以统一继承当前源图，也可以按条目声明不使用源图。
8. JSON 格式要稳定、可文档化，方便外部工具生成。
9. Web 与 Tauri 静态桌面导出都能工作，不引入 Node-only 依赖。

## 3. 非目标

- 不移除现有 AI 批量规划；AI 规划仍用于“需要理解、改写、多版本探索”的场景。
- P0 不要求从文件系统选择 `.json` 文件导入；先支持粘贴 JSON 文本。
- P0 不支持在 JSON 中内嵌图片、base64、远程图片 URL 或本地文件路径作为源图。
- P0 不允许 JSON 导入 API Key、Base URL、密码、代理配置或其他敏感运行时配置。
- P0 不要求 JSON 直接绕过预览创建任务；必须经过统一预览确认。
- P0 不要求支持批量视频、批量图生文或多运行时专属能力。
- P0 不做复杂表格/CSV 解析。若需要 CSV，可由外部工具先转成规范 JSON。

## 4. 与现有批量能力的关系

### 4.1 统一输出到 BatchPlan

新增入口不另建队列模型。无论来源是 AI、文本切分还是 JSON 导入，最终都应该归一化为同一份预览数据：

```ts
type BatchPlan = {
    batchId: string;
    sourceText: string;
    sourceImageCount: number;
    planningMode: BatchPlanningMode;
    resolvedIntent: BatchResolvedIntent;
    countMode: BatchCountMode;
    targetCount?: number;
    recommendedCount: number;
    summary: string;
    strategyReason: string;
    warnings: string[];
    tasks: BatchPlanItem[];
};
```

建议扩展规划来源枚举：

```ts
type BatchPlanningMode =
    | 'auto'
    | 'content-split'
    | 'variant-exploration'
    | 'reference-variant'
    | 'mixed'
    | 'manual-split'
    | 'json-import';

type BatchResolvedIntent =
    | 'content-split'
    | 'variant-exploration'
    | 'reference-variant'
    | 'mixed'
    | 'manual-split'
    | 'json-import';
```

如果首轮实现暂不扩展枚举，也可以临时把 `manual-split` 映射到 `content-split`，把 `json-import` 映射到 `mixed`，但预览区应保留来源文案，避免用户误以为内容经过 AI 改写。

### 4.2 复用现有确认逻辑

确认创建任务时继续复用现有逻辑：

- 当前表单中的模型、尺寸、质量、输出格式、背景、moderation、provider 等作为共享默认参数。
- 每条导入任务至少覆盖 `prompt`。
- 导入数据里如果声明了 `sourceImagePolicy`，客户端仍然会按当前源图状态统一归一化：有源图时全部继承，没有源图时全部不使用。
- 批次元数据继续写入 `batchId`、`batchIndex`、`batchTotal`、`batchLabel`。

## 5. 用户流程

### 5.1 批量入口

1. 用户在编辑区输入或粘贴文本，也可以先添加源图片。
2. 点击 `批量`。
3. 批量面板顶部展示创建方式选择：
    - `AI 规划`
    - `文本切分`
    - `JSON 导入`
4. 用户选择一种方式并生成预览。
5. 右侧结果区显示统一批量预览。
6. 用户可逐条编辑、禁用、删除、复制、重排。
7. 用户点击 `确认创建批量任务` 后，任务进入现有队列。

### 5.2 文本切分流程

1. 批量面板默认把当前 prompt 带入文本输入框。
2. 用户选择切分方式，例如按非空行、按空行段落、按自定义分隔符。
3. 用户可选择是否去除空白、忽略空片段、合并连续空白。
4. 点击 `生成预览`。
5. 系统在客户端同步或轻量异步切分文本，生成 `BatchPlan`。
6. 预览区展示每条任务的 prompt、来源片段和序号。

### 5.3 JSON 导入流程

1. 用户在外部工具中生成批量任务 JSON。
2. 在批量面板选择 `JSON 导入`。
3. 粘贴 JSON 文本。
4. 点击 `校验并生成预览`。
5. 系统解析、校验、归一化 JSON。
6. 如果存在问题，展示字段级错误和行列位置；如果可部分修复，展示 warnings。
7. 校验通过后生成 `BatchPlan`，进入统一预览。

## 6. 文本切分需求

### 6.1 切分方式

P0 必须支持：

| 切分方式       | 说明                                                     | 适用场景                         |
| -------------- | -------------------------------------------------------- | -------------------------------- |
| 按非空行       | 每个非空行生成一条任务，空行忽略                         | 一行一个 prompt、标题列表、卖点  |
| 按空行段落     | 连续空行作为任务边界，段落内部换行保留或合并             | 分段脚本、文章段落、镜头说明     |
| 按自定义分隔符 | 用户输入一个分隔符字符串，例如 `---`、`###`、`<TASK>`    | 外部工具生成的纯文本任务包       |

P1 可扩展：

- 正则分隔符模式，但必须默认关闭，并明确标注为高级选项。
- 编号/项目符号识别，例如 `1.`、`-`、`*`、`•` 开头的列表。
- Markdown 标题切分，例如按 `##` 或 `###` 切分。

### 6.2 切分选项

切分面板建议提供以下选项：

- `去除首尾空白`：默认开启。
- `忽略空任务`：默认开启。
- `合并连续空白为单个空格`：默认关闭；开启后把多余空白压缩，适合一行 prompt。
- `保留段落内部换行`：按空行段落时默认开启。
- `统一前缀`：可选，把同一段文本追加到每条 prompt 前。
- `统一后缀`：可选，把同一段文本追加到每条 prompt 后。
- `源图策略`：无需单独选择。只要当前有源图，所有导入任务统一继承当前源图；没有源图则统一不使用源图。

统一前缀/后缀适合用户输入“所有任务都使用同一画风、比例或品牌约束”的场景。前后缀只在生成预览时拼接，不修改原始输入文本。

### 6.3 生成规则

文本切分必须是确定性操作：

- 不改写用户文本。
- 不补充用户没有输入的风格、构图、品牌或事实。
- 不翻译、不总结、不润色。
- 每个片段生成一条 `BatchPlanItem.prompt`。
- `sourceExcerpt` 使用切分前的原始片段，最长可截断到 120-200 字。
- `title` 可以使用片段首行或前 20-30 字自动生成，但必须允许为空或编辑。
- `variationAxis` 可留空，或写入 `按文本切分`。
- `notes` 可记录切分方式，例如 `由第 3 个非空行生成`。

### 6.4 数量与边界

- 切分结果不设置额外的最大任务数，切分出多少就生成多少。
- 如果切分后没有有效任务，显示 inline 错误，不生成预览。
- 如果存在重复 prompt，不阻止创建，但在 warnings 中提示重复数量。
- 如果单条 prompt 过长，只提示风险，不自动截断。
- 输入文本过大时应提示用户缩减；建议 P0 把纯文本输入上限控制在 256KB 以内。

### 6.5 文本切分生成的 BatchPlan

示例：

```json
{
  "batchId": "batch_manual_...",
  "sourceText": "用户粘贴的原始文本",
  "sourceImageCount": 0,
  "planningMode": "manual-split",
  "resolvedIntent": "manual-split",
  "countMode": "fixed",
  "targetCount": 3,
  "recommendedCount": 3,
  "summary": "已按非空行切分为 3 条批量任务。",
  "strategyReason": "未调用 AI；每个非空文本片段按原文生成一条任务。",
  "warnings": [],
  "tasks": []
}
```

## 7. JSON 导入格式规范

### 7.1 顶层格式

JSON 导入使用稳定 schema：

```ts
type BatchTaskImportV1 = {
    schemaVersion: 'gpt-image-playground.batch-tasks.v1';
    batchId?: string;
    batchLabel?: string;
    sourceText?: string;
    defaults?: BatchTaskDefaults;
    tasks: BatchTaskImportItem[];
};
```

字段说明：

| 字段            | 必填 | 说明                                                                 |
| --------------- | ---- | -------------------------------------------------------------------- |
| `schemaVersion` | 是   | 固定为 `gpt-image-playground.batch-tasks.v1`                          |
| `batchId`       | 否   | 外部批次 ID；不合法或缺失时客户端生成                                 |
| `batchLabel`    | 否   | 批次显示名；缺失时用 summary 或默认文案                               |
| `sourceText`    | 否   | 外部生成任务的来源文本摘要，用于预览和草稿恢复                         |
| `defaults`      | 否   | 任务默认值，作用于未单独声明的 task                                   |
| `tasks`         | 是   | 批量任务数组，至少 1 条                                                |

### 7.2 默认值格式

```ts
type BatchTaskDefaults = {
    enabled?: boolean;
    sourceImagePolicy?: 'inherit-all' | 'none';
    negativePrompt?: string;
    notes?: string;
    overrides?: BatchTaskOverrides;
};
```

说明：

- `enabled` 默认 `true`。
- `sourceImagePolicy` 不需要用户单独选择，客户端会根据当前源图数量统一归一化：有源图时继承，无源图时不使用。
- `negativePrompt` 和 `notes` 可被单条 task 覆盖。
- `overrides` 是安全子集能力；客户端会在确认执行前按当前模型和任务类型校验后应用，不能执行的字段会进入 warning。

### 7.3 任务条目格式

```ts
type BatchTaskImportItem = {
    id?: string;
    externalId?: string;
    order?: number;
    enabled?: boolean;
    title?: string;
    prompt: string;
    negativePrompt?: string;
    sourceExcerpt?: string;
    variationAxis?: string;
    notes?: string;
    sourceImagePolicy?: 'inherit-all' | 'none';
    overrides?: BatchTaskOverrides;
    metadata?: Record<string, string | number | boolean | null>;
};
```

字段说明：

| 字段                | 必填 | 说明                                                                    |
| ------------------- | ---- | ----------------------------------------------------------------------- |
| `prompt`            | 是   | 最终提交给图像模型的提示词，必须是非空字符串                            |
| `id`                | 否   | 导入条目 ID；缺失、不唯一或不合法时客户端重新生成                        |
| `externalId`        | 否   | 外部系统 ID，仅用于展示或排查，不参与执行                                |
| `order`             | 否   | 排序序号；缺失时按数组顺序                                              |
| `enabled`           | 否   | 是否默认启用；默认 `true`                                                |
| `title`             | 否   | 预览标题                                                                |
| `negativePrompt`    | 否   | 负向提示词；当前模型不支持时保留展示但不强制发送                         |
| `sourceExcerpt`     | 否   | 来源片段说明                                                            |
| `variationAxis`     | 否   | 差异点说明，例如风格、构图、镜头或外部分类                               |
| `notes`             | 否   | 备注，只用于预览和排查                                                  |
| `sourceImagePolicy` | 否   | 兼容字段；客户端最终会按当前源图状态统一归一化                           |
| `overrides`         | 否   | 单条参数覆盖，支持安全子集                                             |
| `metadata`          | 否   | 外部元数据；只允许简单 JSON 值，不参与执行                               |

### 7.4 参数覆盖格式

支持安全子集的 per-task 参数覆盖，便于外部工具按任务精细调参：

```ts
type BatchTaskOverrides = {
    n?: number;
    size?: string;
    quality?: 'low' | 'medium' | 'high' | 'auto';
    output_format?: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background?: 'transparent' | 'opaque' | 'auto';
    moderation?: 'low' | 'auto';
    model?: string;
    providerInstanceId?: string;
};
```

覆盖规则：

- 所有覆盖值都必须经过现有表单和模型能力校验。
- 不支持的覆盖项不能静默执行，应在预览中显示 warning。
- `model` 必须存在于当前模型目录或自定义模型库。
- 如果当前存在源图，对应模型必须支持图片编辑。
- `size`、`output_format` 和 `output_compression` 会按当前模型能力进一步校验。
- 不允许覆盖 API Key、Base URL、连接模式、密码、存储路径或安全策略。

### 7.5 最小 JSON 示例

```json
{
  "schemaVersion": "gpt-image-playground.batch-tasks.v1",
  "tasks": [
    {
      "prompt": "A clean product poster for a white ceramic mug on a light gray background."
    },
    {
      "prompt": "A lifestyle photo of the same white ceramic mug on a wooden breakfast table."
    }
  ]
}
```

### 7.6 完整 JSON 示例

```json
{
  "schemaVersion": "gpt-image-playground.batch-tasks.v1",
  "batchId": "external_campaign_20260521",
  "batchLabel": "五月新品海报",
  "sourceText": "外部营销脚本生成的 3 条海报任务",
  "defaults": {
    "enabled": true,
    "sourceImagePolicy": "inherit-all",
    "negativePrompt": "blurry, low quality, distorted text"
  },
  "tasks": [
    {
      "externalId": "poster_001",
      "order": 1,
      "title": "主视觉海报",
      "prompt": "基于当前参考图，保留产品主体轮廓和配色，生成一张高端简洁的新品主视觉海报。",
      "sourceExcerpt": "新品主视觉",
      "variationAxis": "高端极简",
      "notes": "来自外部 campaign builder"
    },
    {
      "externalId": "poster_002",
      "order": 2,
      "title": "社媒封面",
      "prompt": "基于当前参考图，生成适合社媒封面的年轻化视觉，强调明亮色彩、轻快构图和清晰主体。",
      "variationAxis": "社媒传播",
      "sourceImagePolicy": "inherit-all"
    },
    {
      "externalId": "poster_003",
      "order": 3,
      "title": "纯文生图备选",
      "prompt": "A minimal editorial poster with abstract product-inspired shapes, soft studio lighting, premium retail mood.",
      "variationAxis": "不使用参考图",
      "sourceImagePolicy": "none"
    }
  ]
}
```

## 8. JSON 校验与归一化

### 8.1 解析要求

- 必须使用标准 JSON 解析，不支持 JavaScript 对象字面量、注释、尾逗号或单引号。
- 解析失败时显示错误行列位置和附近片段。
- 可提供 `格式化 JSON` 或 `复制错误` 操作，但不能用 `window.alert`、`window.prompt`、`window.confirm`。
- 粘贴内容为空时不解析，显示 inline 提示。

### 8.2 Schema 校验

必须校验：

- `schemaVersion` 是否匹配。
- `tasks` 是否为数组。
- `tasks.length` 是否大于 0。
- 每条 `prompt` 是否为非空字符串。
- `sourceImagePolicy` 如果存在，只作为兼容输入，不改变统一归一化结果。
- `order` 是否为有限数字。
- `enabled` 是否为 boolean。
- `metadata` 是否只包含可序列化的简单 JSON 值。

建议行为：

- `schemaVersion` 缺失但存在合法 `tasks` 时，可以允许导入，但加入 warning。
- 未知字段默认忽略；如需要保留，仅能放入非执行用途的 metadata。
- 重复 `id` 不报错，客户端重新生成并提示。
- `order` 冲突不报错，按 `order` + 数组顺序稳定排序。
- 不再对文本切分或 JSON 导入做额外数量截断。

### 8.3 安全规则

- JSON 中出现 `apiKey`、`password`、`baseUrl`、`imageStoragePath`、`connectionMode` 等敏感或运行时字段时必须忽略，并加入 warning。
- JSON 不得改变客户端直连限制、URL 安全策略、公开 Base URL 校验或桌面代理策略。
- JSON 不得引用本地文件路径执行读取。
- JSON 不得让远程 URL 自动进入源图片区。
- 所有 imported prompt 都按用户输入内容处理，不做 HTML 渲染，避免 XSS。

## 9. 预览区要求

手动切分和 JSON 导入生成预览后，右侧 `BatchPlanOutput` 应保持一致体验：

- 标明来源：`文本切分` 或 `JSON 导入`。
- 显示有效任务数量和总任务数量。
- 显示 warnings，尤其是截断、重复、忽略字段、缺少 schema、模型覆盖不支持等问题。
- 每条任务可编辑 prompt。
- 每条任务可启用/禁用、删除、复制、上移/下移。
- JSON 导入的 `externalId` 和 `metadata` 可以折叠展示，但不要挤占主编辑区。
- 用户修改导入任务后，标记 `lockedByUser: true`。
- 确认按钮显示实际将创建的任务数量。

## 10. 草稿与恢复

批量草稿需要扩展保存来源：

```ts
type BatchPlanDraftSource = 'ai-plan' | 'manual-split' | 'json-import';
```

草稿至少保存：

- 创建方式。
- 原始输入文本或 JSON 文本摘要。
- 文本切分方式和切分选项。
- JSON 导入校验后的预览结果。
- 当前源图数量和源图文件名摘要。
- 最近一次生成的 `BatchPlan`。

草稿限制：

- 不把图片 Blob/base64 写入 localStorage。
- JSON 原文过大时只保存摘要和归一化后的轻量预览。
- 草稿恢复后不应覆盖用户当前 prompt，除非用户显式点击恢复。
- 已保存预览不应在刷新页面后自动占用右侧结果区；用户重新打开批量面板后再决定恢复或丢弃。

## 11. UI 与 i18n

- 所有新增可见文案必须进入 `src/lib/i18n/*`。
- 创建方式建议使用分段控件或 tabs，不要把三个入口堆成多个同级大按钮。
- 文本切分和 JSON 导入的主按钮文案应避免“AI 生成”表述，例如：
    - `生成切分预览`
    - `校验并生成预览`
- 文本切分区要清楚展示“不会调用 AI，不会改写文本”。
- JSON 导入区要提供格式提示和示例入口，但不要在主界面塞入大段说明。
- 移动端面板必须可滚动，切分选项和 JSON 错误不能溢出。
- 深色和浅色主题都要检查错误、warning、badge 和代码块可读性。

## 12. Web 与 Tauri 要求

- 文本切分和 JSON 解析应在前端纯客户端完成。
- Tauri 桌面静态导出不依赖 `/api/batch-plan`。
- 不新增 Node-only 运行时依赖。
- JSON 导入后的确认执行继续使用现有 Web/direct/proxy/Tauri 任务执行路径。
- 如果导入任务需要源图但当前没有源图，Web 和 Tauri 都必须给出一致错误。

## 13. 性能要求

- 纯文本切分应避免阻塞主线程；大文本可在点击生成预览后处理，不在输入过程中实时全量切分。
- JSON 输入不应在每次键入时完整 parse；可在失焦、点击校验或防抖后解析。
- 预览不设置额外数量上限，按导入结果渲染；如任务过多可后续考虑虚拟化。
- 不在热路径上对全文做昂贵 hash；`batchId` 用现有 ID 生成工具。
- 不扫描 Blob、不读取本地文件、不做远程请求。

## 14. 验收标准

1. 未配置 AI/API Key 时，用户仍可通过 `文本切分` 创建批量任务预览。
2. 用户粘贴 5 行 prompt，选择按非空行切分，可以得到 5 条可编辑任务。
3. 用户粘贴用 `---` 分隔的长文本，选择自定义分隔符，可以按分隔符生成任务。
4. 用户粘贴合法 JSON，可以导入为批量预览并确认入队。
5. JSON 缺少必填 `prompt` 时，界面能指出具体条目错误。
6. JSON 语法错误时，界面显示行列位置，不使用原生浏览器弹窗。
7. 文本切分和 JSON 导入都不需要用户额外选择源图策略，当前有源图时统一继承，没有源图时统一不使用。
8. 导入任务包含敏感字段时，这些字段不会生效，并在 warnings 中提示已忽略。
9. 生成预览后，用户可以编辑、禁用、删除、重排任务，并按实际启用数量入队。
10. Web 与 Tauri 桌面端都能完成文本切分和 JSON 导入预览。
11. 所有新增 UI 文案均覆盖当前支持语言。

## 15. 分期建议

### 15.1 P0

- 批量面板新增创建方式：`AI 规划`、`文本切分`、`JSON 导入`。
- 文本切分支持非空行、空行段落、自定义字面量分隔符。
- 文本切分支持 trim、忽略空任务、源图策略。
- JSON 导入支持 `schemaVersion + tasks[].prompt` 最小格式。
- JSON 导入支持 title、enabled、negativePrompt、sourceExcerpt、variationAxis、notes；`sourceImagePolicy` 作为兼容字段保留，但最终统一归一化。
- JSON 导入支持安全子集 `overrides`，并在确认执行前应用到单条任务。
- JSON 导入区提供完整字段示例下载。
- 导入结果归一化为 `BatchPlan`。
- 复用现有批量预览和确认入队逻辑。
- 解析错误、schema 错误、warnings 进入应用内 UI。

### 15.2 P1

- 支持正则分隔符、编号列表切分、Markdown 标题切分。
- 支持从预览导出 JSON，形成“导出 -> 外部修改 -> 导入”的闭环。
- 支持从 `.json` 文件导入。

### 15.3 P2

- 支持批量任务模板。
- 支持从表格复制内容后快速映射到 JSON 字段。
- 支持更高任务数量时的虚拟化预览和分批入队。
- 支持外部 JSON schema 下载或复制。

## 16. 开放问题

- `AI 规划` 是否继续作为批量面板默认创建方式，还是记住用户上次使用的方式。
- 文本切分后的统一前缀/后缀是否需要保存为批量模板。
