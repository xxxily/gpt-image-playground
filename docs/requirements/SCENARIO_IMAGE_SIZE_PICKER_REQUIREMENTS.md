---
title: 场景化比例与分辨率选择器需求文档
summary: 为 gpt-image-2、Gemini Nano Banana 2 及后续多供应商图片模型设计一个可复用的场景化比例/分辨率选择弹层，按社媒、广告、印刷、电商、屏幕等场景筛选合规模型尺寸，并将选择结果回填到现有生成/编辑高级选项。
createdAt: 2026-05-26
status: draft-requirement
---

# 场景化比例与分辨率选择器需求文档

## 1. 背景

当前生成图片的高级选项里，尺寸选择仍偏向基础形态：自动、横向、纵向、正方形、自定义。对 `gpt-image-2` 这类支持自定义 `WIDTHxHEIGHT` 的模型来说，这只能覆盖少数通用场景，不能帮助运营、设计、广告、电商和内容团队快速定位具体发布场景需要的比例与分辨率。

用户已经整理了两份尺寸资料，作为本需求的数据输入来源：

- `/Users/blaze/work/github/notes/serverinfo/local_notes/discoveries/2026-05-25_国内外主流社交媒体发布图片尺寸最新指南.md`
- `/Users/blaze/work/github/notes/serverinfo/local_notes/discoveries/2026-05-25_常见场景图例尺寸与比例完整指南.md`

OpenAI 当前图片生成接口对 `gpt-image-2` 的自定义尺寸有硬约束：尺寸使用 `WIDTHxHEIGHT` 字符串；宽高都需要是 16 的倍数；宽高比需要在 `1:3` 到 `3:1` 之间；最长边不超过 `3840px`；总像素需要满足模型当前上下限。项目本地 `src/lib/size-utils.ts` 已将 `gpt-image-2` 约束实现为：总像素 `655,360` 到 `8,294,400`、最长边 `3840`、长短边比例不超过 `3:1`、宽高为 16 的倍数。

同时，项目已经接入 Gemini Nano Banana 2（`gemini-3.1-flash-image-preview`），其尺寸能力不是任意自定义 `WIDTHxHEIGHT`，而是来自 `src/lib/provider-advanced-options.ts` 的 `GEMINI_SIZE_OPTIONS`：按 `512`、`1K`、`2K`、`4K` 档位和多组官方比例展开。Seedream、SenseNova 等模型也有自己的尺寸枚举、语义档位或供应商特定规则。因此，本组件不能以 `gpt-image-2` 的自定义尺寸规则作为底层假设；`gpt-image-2` 只能是首个适配器，Gemini Nano Banana 2 应作为首版适配器设计的对照样例。

因此，本功能不能直接照搬平台原始尺寸表，而要把原始场景尺寸转换为模型可提交的合规尺寸，并清楚展示“原始推荐尺寸”和“模型提交尺寸”的关系。

## 2. 目标

### 2.1 产品目标

1. 在生成图片高级选项中增加一个独立入口“按场景选择尺寸”，通过弹层打开场景化比例/分辨率选择器，而不是把大量选项直接塞进当前高级选项。
2. 用户可以按用途、平台、内容形态、比例、清晰度档位、方向、可信度快速筛选尺寸。
3. 每个候选项都展示场景名称、平台/用途、比例、原始推荐尺寸、模型实际提交尺寸、清晰度档位、适用说明和安全区提示。
4. 选择后将结果回填到现有 `size` 字段；对 `gpt-image-2` 使用具体 `WIDTHxHEIGHT`，对 Gemini Nano Banana 2 使用其枚举尺寸值，对其他不支持自定义尺寸的模型只展示该模型可用尺寸或降级说明。
5. 组件设计为通用能力，后续能接入更多模型、更多供应商和更多清晰度档位，不与 `gpt-image-2` UI 写死绑定。
6. 同一个场景可以根据当前模型映射出不同候选值，例如“小红书图文首图”在 `gpt-image-2` 下推荐 `1536x2048`，在 Gemini Nano Banana 2 下推荐最接近的 Gemini `3:4` 档位。

### 2.2 技术目标

1. 建立可复用的尺寸能力层，将“场景原始推荐”“模型尺寸能力”“最终提交值”三者解耦。
2. 复用并扩展 `src/lib/size-utils.ts` 中的 `validateGptImage2Size`、`recommendGptImage2Sizes`、`GPT_IMAGE_2_SIZE_PRESETS` 等能力。
3. 为后续模型提供统一接口，例如 `getScenarioSizeOptions(modelDefinition)`、`normalizeScenarioSizeForModel(...)`。
4. 首版底层至少提供两个适配器验证：`gpt-image-2` 的自定义尺寸适配器、Gemini Nano Banana 2 的枚举尺寸适配器。即使首屏先只给 `gpt-image-2` 露出入口，底层也不能写成单模型专用实现。
5. UI 组件只消费归一化后的候选数据，不在组件内部写 `if model === 'gpt-image-2'`、`if provider === 'google'` 这类分支。
6. UI 文案纳入 `src/lib/i18n/messages.ts`，至少保持中文和英文同步。
7. 保持 Web、Tauri desktop、Tauri mobile/Android 一致；本功能应为纯前端选择与参数生成能力，不依赖 Node-only API route。

## 3. 非目标

- 不在本轮实现图片生成模型的真实 API 调用改造，除非现有请求路径不能接收适配器返回的提交值。
- 不把平台尺寸资料做成远程动态更新系统；初版先用项目内置静态数据。
- 不保证所有平台尺寸都是平台强制规格；需要区分“官方明确”“官方广告端”“平台实务”“实务建议”。
- 不为印刷场景提供出血、CMYK、PDF、矢量源文件等完整印前工作流；只提供适合模型生成阶段的比例/像素建议。
- 不削弱当前 `gpt-image-2`、Gemini Nano Banana 2 以及其他模型已有尺寸校验，也不允许用户选择当前模型不可提交的尺寸。

## 4. 用户场景

1. 内容运营要做小红书首图，打开选择器，筛选“国内平台 / 小红书 / 图文首图”，看到原始 `1242x1660` 与合规模型尺寸，例如 `1536x2048` 或 `2304x3072`，选择后直接生成。
2. 广告投放要做 Meta / X / LinkedIn 链接卡片，筛选“广告 / 链接卡片 / 1.91:1”，选择 `2048x1072` 或更高清档位。
3. 短视频运营要做 Stories/Reels/抖音/快手封面，筛选“全屏竖版 / 9:16”，选择 2K 或 4K 档位。
4. 电商团队要做商品主图，筛选“电商 / 商品主图 / 1:1”，选择 `2048x2048` 或 `2880x2880`。
5. 设计团队要做 A4 风格海报概念图，筛选“印刷 / A 系列 / 竖版”，选择接近 `1:1.414` 的合规尺寸，并看到“最终印刷仍需按印厂模板与 300ppi 复核”的提示。

## 5. 信息架构

### 5.1 弹层入口

- 入口位置：生成图片高级选项的“尺寸”区域，必须放在原有清晰度、比例、分辨率选择控件之后，不能替代或收窄原有完整选择入口。
- 推荐控件：带图标按钮，文案“按场景选择尺寸”。
- 打开方式：使用现有 `src/components/ui/dialog.tsx`，不使用 `window.alert/prompt/confirm`。
- 回填方式：
    - 用户点“应用”后，关闭弹层并设置 `size` 为具体尺寸值。
    - 回填后，在“按场景选择尺寸”按钮下方展示与原控件风格一致的回填区，包含清晰度、比例、分辨率，并允许继续在当前场景比例上切换清晰度、当前比例及其对调比例、当前比例下的分辨率。
    - 如果当前比例是 `1:1`，不重复展示对调后的 `1:1`。
    - 如选择结果是模型自定义尺寸，`size` 可直接使用 `1536x2048` 这类值；不应强制进入 `custom` 再填宽高，避免隐藏真实来源。
    - 如果现有表单仍只支持 `customWidth/customHeight` 提交，则首轮可以回填为 `size='custom'` + 设置宽高，但需求上建议支持具体尺寸值成为一等 size preset。
    - 场景选择的回填状态需要随表单偏好持久化。刷新页面后，如果当前模型和 `size` 仍匹配该场景尺寸，应继续显示回填摘要和清晰度/比例/分辨率细化控件；如果用户改用原有尺寸控件、切换模型或尺寸不再匹配，则应清除场景来源标记。

### 5.2 弹层布局

弹层应移动端优先、桌面增强：

- 顶部：搜索框，可搜索平台、场景、比例、尺寸、标签，例如“小红书”“A4”“9:16”“链接卡片”。
- 快捷筛选：
    - 场景大类：社交媒体、广告、网页/SEO、视频封面、屏幕/标牌、电商、印刷/纸张、照片/摄影、办公/演示、品牌资产、应用商店。
    - 平台：Instagram、Facebook、X、LinkedIn、YouTube、Pinterest、TikTok、Snapchat、Threads、Bluesky、微信公众号、视频号、小红书、抖音、微博、B站、快手、Google Ads、App Store、Google Play 等。
    - 方向：方形、横版、竖版、超宽、长图。
    - 比例：`1:1`、`4:5`、`5:4`、`3:4`、`4:3`、`2:3`、`3:2`、`9:16`、`16:9`、`1.91:1`、`2:1`、`1:2`、`3:1`、`1:3`、`2.35:1`、`1:1.414`。
    - 清晰度档位：低成本、1K、2K、3K、4K、实验高分辨率。
    - 可信度：官方明确、官方广告端、平台实务、实务建议。
- 主列表：按匹配度与常用程度排序，支持卡片或紧凑列表。
- 详情区：展示选中项的原始资料、模型转换结果、适用提示、安全区、可能裁切风险。

### 5.3 候选项展示字段

每个候选项至少包含：

- 标题：例如“小红书图文首图”“Instagram Feed 竖图”“Open Graph 分享图”。
- 场景路径：例如“社交媒体 / 国内平台 / 小红书”。
- 原始推荐尺寸：例如 `1242x1660`。
- 原始比例：例如 `3:4`。
- 模型提交尺寸：例如 `1536x2048`。
- 清晰度档位：例如 `2K`。
- 可信度：例如“实务建议”。
- 标签：例如“首图”“信息流”“移动端优先”“安全区”。
- 说明：例如“文字不要贴边，标题区可放在上三分之一”。

## 6. 数据模型

建议新增纯数据与纯函数层，避免把场景表写死在组件里。

```typescript
type ScenarioSizeSourceConfidence =
    | 'official'
    | 'officialAds'
    | 'platformPractice'
    | 'industryStandard'
    | 'practical';

type ScenarioSizeCategory =
    | 'social'
    | 'ads'
    | 'web'
    | 'videoCover'
    | 'screen'
    | 'ecommerce'
    | 'print'
    | 'photo'
    | 'office'
    | 'brand'
    | 'appStore';

type ScenarioSizeSource = {
    id: string;
    titleKey: string;
    category: ScenarioSizeCategory;
    platforms: string[];
    useCases: string[];
    sourceWidth?: number;
    sourceHeight?: number;
    ratio: string;
    confidence: ScenarioSizeSourceConfidence;
    tags: string[];
    noteKey?: string;
    safeAreaKey?: string;
    popularity?: number;
};
```

模型适配层必须是本功能的核心边界。场景数据只描述“用户想做什么”，模型适配器负责回答“当前模型能不能做、用哪个提交值做、匹配程度如何”。建议：

```typescript
type ModelSizeTier = 'low' | '1K' | '2K' | '3K' | '4K' | 'experimental';

type ModelSizeConstraints = {
    supported: boolean;
    minPixels?: number;
    maxPixels?: number;
    maxEdge?: number;
    edgeMultiple?: number;
    minAspect?: number;
    maxAspect?: number;
    allowedSizes?: string[];
    supportsAuto?: boolean;
    supportsCustomSize?: boolean;
    experimentalAbovePixels?: number;
};

type ScenarioSizeAdapterKind = 'customPixels' | 'enumeratedPixels' | 'semanticTier' | 'fixedPreset';

type ScenarioSizeMatchQuality = 'exact' | 'near' | 'fallback' | 'unavailable';

type ScenarioSizeAdapter = {
    id: string;
    provider: ImageProviderId;
    modelIds?: string[];
    kind: ScenarioSizeAdapterKind;
    constraints: ModelSizeConstraints;
    options?: readonly ModelDeclaredSizeOption[];
    normalize: (source: ScenarioSizeSource, request: ScenarioSizeRequest) => ScenarioModelSizeOption[];
    validate: (value: string) => SizeValidation;
};

type ModelDeclaredSizeOption = {
    value: string;
    width?: number;
    height?: number;
    ratio?: string;
    tier?: string;
    label?: string;
    description?: string;
};

type ScenarioSizeRequest = {
    preferredTier?: ModelSizeTier;
    includeExperimental?: boolean;
    includeUnavailable?: boolean;
};

type ScenarioModelSizeOption = {
    source: ScenarioSizeSource;
    adapterId: string;
    provider: ImageProviderId;
    modelId: string;
    modelSize: string;
    width: number;
    height: number;
    tier: ModelSizeTier;
    ratioLabel: string;
    exactRatioMatch: boolean;
    matchQuality: ScenarioSizeMatchQuality;
    ratioDelta?: number;
    transformed: boolean;
    transformReason?: 'edgeMultiple' | 'pixelLimit' | 'aspectLimit' | 'modelPresetOnly';
    valid: boolean;
    disabledReasonKey?: string;
};
```

适配器规则：

1. `customPixels`：适合 `gpt-image-2` 这类支持任意合规像素值的模型。适配器按原始比例和清晰度目标生成候选，再用模型 validator 过滤。
2. `enumeratedPixels`：适合 Gemini Nano Banana 2 这类有官方枚举尺寸表的模型。适配器从 `GEMINI_SIZE_OPTIONS` 这类声明列表中按比例差、档位、方向、像素数排序，返回最接近候选。
3. `semanticTier`：适合 Seedream 这类接受 `1K`、`2K`、`4K` 或供应商别名的模型。适配器需要同时展示语义提交值和其代表的参考像素。
4. `fixedPreset`：适合旧模型或仅支持少量预设的模型。适配器只能返回固定预设，并把不匹配场景置为 `fallback` 或 `unavailable`。
5. UI 组件只接收 `ScenarioModelSizeOption[]`，不关心候选来自哪种适配器。
6. 新增模型时优先新增/配置适配器，不改选择器弹层组件。

## 7. gpt-image-2 合规转换规则

### 7.1 基础规则

对 `gpt-image-2`：

1. 输入场景可以来自任意原始尺寸，例如 `1080x1350`、`1200x628`、`2480x3508`。
2. 转换时先保留原始比例，再按目标清晰度档位寻找最接近的合规 `WIDTHxHEIGHT`。
3. 宽高必须四舍五入到 16 的倍数。
4. 如果原始比例超出 `1:3` 到 `3:1`，候选项应禁用或标记为“已夹到模型上限比例”，默认不自动推荐。
5. 如果原始像素低于下限或高于上限，按目标档位重新生成候选，不直接提交原始尺寸。
6. 对超过 `2560x1440` 等级的结果，展示“高分辨率/实验”提示，避免用户误以为所有上游都稳定支持。
7. 所有最终提交值必须通过 `validateGptImage2Size`。

### 7.2 初版常用比例与推荐合规尺寸

以下是初版可内置的 `gpt-image-2` 典型候选。具体实现应由算法生成并由测试锁定，不建议在 UI 组件里手写。

| 比例 | 典型场景 | 1K/低成本 | 2K | 3K | 4K/高分辨率 |
|---|---|---:|---:|---:|---:|
| `1:1` | 方图、头像、电商主图 | `1280x1280` | `2048x2048` | - | `2880x2880` |
| `4:5` | Instagram/X/LinkedIn 竖版信息流 | `1024x1280` | `1664x2080` | `2448x3056` | - |
| `3:4` | 小红书首图、中文图文平台 | `960x1280` | `1536x2048` | `2304x3072` | - |
| `2:3` | Pinterest、展板、照片竖图 | `864x1296` | `1376x2064` | `2048x3072` | `2304x3584` |
| `9:16` | Stories、Reels、Shorts、抖音、快手 | `720x1280` | `1152x2048` | `1728x3072` | `2160x3840` |
| `16:9` | 视频封面、PPT、横屏屏幕 | `1280x720` | `2048x1152` | `3072x1728` | `3840x2160` |
| `1.91:1` | Open Graph、X/LinkedIn/Facebook 链接卡片 | `1280x672` | `2048x1072` | `3056x1600` | `3824x2000` |
| `2.35:1` | 公众号首图近似、电影感横幅 | `1280x544` | `2032x864` | `3088x1312` | `3840x1632` |
| `3:1` | 社媒头图、品牌封面横图 | `1440x480` | `2064x688` | `3072x1024` | `3840x1280` |
| `1:3` | 极竖海报、窄竖屏 | `480x1440` | `688x2064` | `1024x3072` | `1280x3840` |
| `6:5` | Google Display 中矩形近似 | `1248x1040` | `2016x1680` | `3072x2560` | - |
| `1:1.414` | A 系列纸张竖版近似 | `928x1312` | `1472x2080` | `2160x3056` | - |

说明：

- 表中的 `4K/高分辨率` 不等于质量参数 `quality=high`，它只表示输出像素档位。
- 对 `1:1`，`3840x3840` 会超过当前总像素上限，因此最高推荐为 `2880x2880`。
- 对 `4:5`、`3:4`、`6:5`、A 系列等比例，部分 4K 长边候选会超过总像素上限，因此不展示或降级到最高合规档位。
- 现有 `GPT_IMAGE_2_SIZE_PRESETS` 已覆盖一部分基础比例，后续应扩展比例枚举或改为数据驱动。

## 8. 初版场景目录

### 8.1 社交媒体

首批必须覆盖：

- Instagram：Feed 方图、Feed 竖图、Feed 横图、Stories/Reels、头像。
- Facebook：Feed 方图/横图/竖图、Stories/Reels、链接预览、Page 封面。
- X / Twitter：单图横版、链接卡片、方图、竖版、全屏竖版广告、头像、头图。
- LinkedIn：个人动态横图、方图、单图广告竖版、个人背景图、公司页 Logo、公司页封面。
- YouTube：标准视频缩略图、Shorts 视觉母版、频道横幅、头像、社区图片。
- Pinterest：标准 Pin、方图 Pin、长图 Pin、视频/Idea Pin。
- TikTok、Snapchat、Threads、Bluesky：常用方图、竖图、横图、全屏竖版。
- 微信公众号、视频号、小红书、抖音、微博、B站、快手：图文首图、视频封面、头像、横版封面、长图/文章封面等。

### 8.2 通用制作场景

首批必须覆盖：

- 广告图：Google Display 常用固定尺寸、信息流方图、信息流竖图、全屏竖版、横向链接图、Pinterest 标准图。
- 网页/SEO：Open Graph、X Summary Large Image、网站 Hero、博客封面、文章内图、PWA/Favicon/Logo 图。
- 电商：通用主图、Shopify、Amazon、Etsy、eBay、淘宝/天猫、京东、活动海报、移动端 Banner。
- 屏幕/标牌：横屏 Full HD、横屏 4K、竖屏 Full HD、竖屏 4K、方屏、超宽屏、LED 大屏。
- 印刷/纸张：A 系列、Letter、Legal、名片、传单、海报、展板、易拉宝。印刷类需要提示“模型尺寸只用于生成视觉母版，交付仍需印刷模板”。
- 照片/摄影：4R、5x7、8x10、8x12、方形照片、常用摄影比例。
- 办公/演示：PowerPoint 16:9、PowerPoint 4:3、报告封面、流程图/架构图、PDF 插图。
- 品牌资产：Logo 方图、Logo 横版、头像/品牌图标、品牌封面横图、二维码。
- 应用商店：Apple App Store 截图比例、App Icon、Google Play Feature Graphic、Phone/Tablet Screenshot。

## 9. 交互细节

1. 弹层打开时默认带入当前模型和当前尺寸。若当前尺寸匹配某个场景候选，应高亮“当前已选”。
2. 用户选择平台后，自动推荐该平台最常用尺寸；例如小红书优先 `3:4`，Instagram Feed 优先 `4:5`，短视频平台优先 `9:16`。
3. 搜索和筛选结果为空时，展示可操作的空状态：清除筛选、改用自定义尺寸。
4. 对不可用项不隐藏，优先置灰并说明原因，例如“该模型只支持 1024x1024 / 1536x1024 / 1024x1536”。
5. 支持“只看当前模型可提交”开关，默认开启。
6. 支持“显示原始平台尺寸”开关，帮助高级用户对照资料。
7. 支持最近使用和常用场景优先排序，但不得把最近使用写入同步敏感配置；可以使用 localStorage。
8. 移动端弹层应接近 bottom-sheet 体验：筛选不挤压列表，底部应用按钮固定且避让安全区。
9. 需要提供键盘可达性：搜索框自动聚焦、方向键浏览结果、Enter 应用、Esc 关闭。
10. 所有图标按钮必须有 aria-label，陌生图标提供 Tooltip。

## 10. 与现有高级选项关系

现有高级选项仍保留原有尺寸入口，场景选择只能作为补充入口：

- “自动”保留，适合不关心尺寸的用户。
- “横向 / 纵向 / 正方形”保留，作为最快路径。
- “自定义”保留，适合直接输入尺寸。
- `gpt-image-2` 原有“清晰度 / 比例 / 分辨率”完整选择控件必须保留，用户仍可直接选择所有内置清晰度、比例和分辨率。
- 新增“按场景选择尺寸”入口，承担复杂筛选和解释工作，位置在原完整尺寸选择控件下方。

选择器应用后，当前尺寸区域应清楚展示结果，例如：

- `2K · 3:4 · 1536 × 2048`
- `2K · 1.91:1 · 2048 × 1072`

回填结果下方应继续提供同风格的 pill 选择：

- 清晰度：切换当前场景比例下的 `1K / 2K / 3K / 4K` 或当前模型支持的档位。
- 比例：展示当前比例和对调比例，例如 `3:4` 与 `4:3`；`1:1` 只展示一次。
- 分辨率：展示当前比例下可提交的合规分辨率，并保持与原分辨率控件一致的选中效果。

如果用户之后手动切换为横向/纵向/自定义，应清除场景来源标记，只保留实际尺寸。

## 11. 跨模型复用设计

本章是硬性架构约束。场景选择器首版实现如果只围绕 `gpt-image-2` 的自定义像素能力建模，后续接入 Gemini Nano Banana 2、Seedream、SenseNova 或更多供应商时会被迫重构。因此首版就要把“模型尺寸能力适配器”作为底座。

### 11.1 模型能力差异

不同模型的尺寸能力至少分为三类：

1. 固定尺寸模型：只支持有限枚举，例如旧 GPT 图片模型或某些供应商。
2. 自定义尺寸模型：支持一定范围内的 `WIDTHxHEIGHT`，例如 `gpt-image-2`。
3. 枚举像素模型：支持一张官方尺寸表，例如 Gemini Nano Banana 2 当前的 `512`、`1K`、`2K`、`4K` 档位和多比例组合。
4. 语义档位模型：使用 `1K`、`2K`、`4K` 或供应商特定别名，例如部分 Seedream 模型。

选择器不应假设所有模型都支持像素级自定义。它应该根据模型能力返回：

- 可直接提交的候选。
- 可近似映射的候选。
- 不可提交但可作为参考的原始尺寸。

### 11.2 组件边界

推荐分层：

1. `scenario-size-sources`：只维护场景、平台、原始尺寸、比例、可信度、说明，不包含任何模型逻辑。
2. `model-size-adapters`：维护各模型/供应商尺寸能力和转换规则，例如 `gptImage2ScenarioSizeAdapter`、`geminiBananaScenarioSizeAdapter`。
3. `scenario-size-resolver`：输入当前模型、场景数据、筛选条件，输出统一候选列表。
4. `ScenarioSizePickerDialog`：纯 UI，负责搜索、筛选、展示、选择，不直接了解模型私有规则。
5. 表单接入层：负责把选择结果映射回当前表单状态和请求参数。

禁止事项：

- 禁止在弹层组件内直接导入 `GPT_IMAGE_2_SIZE_PRESETS` 或 `GEMINI_SIZE_OPTIONS` 后写模型分支。
- 禁止让场景数据保存模型提交值，例如不要在“小红书首图”数据里写死 `gptImage2Size: '1536x2048'`。
- 禁止把清晰度档位解释写死为 OpenAI 语义；Gemini 的 `512`、`1K`、`2K`、`4K`，Seedream 的语义档位，OpenAI 的像素档位需要通过 adapter 归一化。
- 禁止让不可用候选直接消失；应该能在“显示不可用”时解释当前模型为什么不能做。

### 11.3 与模型注册表的关系

后续可在 `ImageModelDefinition` 或统一模型能力目录中增加尺寸能力描述：

```typescript
type ImageModelSizeCapability = {
    mode: 'fixed' | 'custom' | 'enumeratedPixels' | 'semanticTier';
    constraints?: ModelSizeConstraints;
    fixedOptions?: string[];
    enumeratedOptions?: ModelDeclaredSizeOption[];
    semanticOptions?: ModelDeclaredSizeOption[];
    adapterId?: string;
};
```

短期可以先在尺寸能力模块中注册适配器；中长期应迁移到模型能力元数据，避免每个组件手写判断。

### 11.4 Gemini Nano Banana 2 适配要求

Gemini Nano Banana 2 是首版必须纳入设计验证的第二模型，即使 UI 首批入口只对 `gpt-image-2` 开放，也要保证 resolver 和 adapter 能处理 Gemini。

当前代码中 Gemini 尺寸表位于 `src/lib/provider-advanced-options.ts`：

- 档位：`512`、`1K`、`2K`、`4K`。
- 比例：`1:1`、`1:4`、`1:8`、`2:3`、`3:2`、`3:4`、`4:1`、`4:3`、`4:5`、`5:4`、`8:1`、`9:16`、`16:9`、`21:9`。
- 提交值是枚举尺寸，例如 `848x1264`、`1264x848`、`1536x2752`、`6336x2688`。

Gemini 适配器要求：

1. 不生成任意尺寸，只能从 `GEMINI_SIZE_OPTIONS` 中选择。
2. 先按比例接近度匹配，再按用户选择的清晰度档位匹配。
3. 如果场景比例在 Gemini 表中有完全对应比例，优先返回同档位完全比例项。
4. 如果没有完全比例，例如 `1.91:1`，返回最接近的 `16:9` 或 `21:9`，并标记 `matchQuality='near'`、展示比例差异。
5. 如果用户选择的档位不存在或当前模型不支持，返回最近可用档位并说明。
6. 所有候选都必须是 Gemini provider 能实际提交的 `size` 值。

### 11.5 首版适配器验收矩阵

| 场景 | 原始比例 | gpt-image-2 期望 | Gemini Nano Banana 2 期望 |
|---|---|---|---|
| 小红书图文首图 | `3:4` | 生成 `1536x2048` 等合规自定义尺寸 | 选择 Gemini `3:4` 同档位枚举，例如 `896x1200` / `1792x2400` |
| Stories/Reels/抖音封面 | `9:16` | 生成 `1152x2048` / `2160x3840` 等 | 选择 Gemini `9:16` 枚举，例如 `768x1376` / `1536x2752` |
| Open Graph 分享图 | `1.91:1` | 生成接近 `2048x1072` 的合规尺寸 | 映射到最接近的 `16:9` 或 `21:9`，并标记近似 |
| 电商主图 | `1:1` | 生成 `2048x2048` / `2880x2880` | 选择 Gemini `1:1` 枚举，例如 `1024x1024` / `2048x2048` |
| Pinterest 标准 Pin | `2:3` | 生成 `1376x2064` / `2048x3072` | 选择 Gemini `2:3` 枚举，例如 `848x1264` / `1696x2528` |

## 12. 数据维护与来源标注

1. 初版数据应来自本需求背景中列出的两份 2026-05-25 资料。
2. 每条场景数据应保留来源类别、可信度和备注，不只保留尺寸。
3. 对广告平台、应用商店、电商平台等更新较快的规格，UI 需要提示“提交前以当前平台后台为准”。
4. 后续新增场景时，应通过数据文件添加，不改组件逻辑。
5. 建议新增测试确保所有内置 `gpt-image-2` 候选都通过 `validateGptImage2Size`，所有 Gemini 候选都来自 `GEMINI_SIZE_OPTIONS`。

## 13. 国际化与文案

1. 所有用户可见文案必须进入 i18n 资源。
2. 场景标题和说明不要只写中文；英文资源至少提供可理解翻译。
3. 技术标识如 `gpt-image-2`、`Gemini Nano Banana 2`、`WIDTHxHEIGHT`、`1:1`、平台品牌名可以作为不可翻译内容。
4. 安全区提示、不可用原因、转换说明需要支持参数插值，例如 `{sourceSize}`、`{modelSize}`、`{ratio}`。

## 14. 验收标准

1. 在 `gpt-image-2` 生成图片高级选项中，原有清晰度、比例、分辨率控件完整保留，且可以通过其下方“按场景选择尺寸”打开弹层。
2. 弹层可按场景大类、平台、比例、方向、清晰度档位、可信度筛选。
3. 选择小红书首图、Instagram Feed 竖图、Open Graph、YouTube 缩略图、抖音封面、电商主图、A4 竖版等代表场景后，回填尺寸均为 `gpt-image-2` 合规值。
4. 场景回填后显示 `清晰度 · 比例 · 分辨率` 摘要，并在下方允许继续切换当前比例的清晰度、当前比例及其对调比例、当前比例下分辨率；`1:1` 不重复展示对调比例。
5. 所有 `gpt-image-2` 内置候选通过 `validateGptImage2Size`。
6. resolver 层可以在不渲染 UI 的情况下，为 Gemini Nano Banana 2 输出同一批场景的可提交候选，且候选值全部来自 `GEMINI_SIZE_OPTIONS`。
7. 对不支持自定义尺寸的模型，选择器不会让用户应用不可提交尺寸。
8. 生成请求最终发送的 `size` 与 UI 展示一致。
9. light/dark、移动端/桌面端布局无文字溢出、重叠或不可点击区域。
10. 新增文案覆盖中文和英文。
11. 不使用原生浏览器 modal。
12. Web 与 Tauri 静态导出路径均可使用该选择器。

## 15. 建议实施阶段

### Phase 1：多模型适配底座 + gpt-image-2 UI 闭环

- 新增场景尺寸数据文件。
- 新增模型尺寸约束、适配器注册表与转换函数。
- 实现 `gpt-image-2` 自定义像素适配器。
- 实现 Gemini Nano Banana 2 枚举像素适配器，并用单元测试证明同一批场景可被解析。
- 新增选择器弹层组件。
- 接入生成图片高级选项。
- 覆盖核心场景与单元测试。

### Phase 2：体验增强

- 最近使用、常用平台置顶、详情区安全区说明。
- 更完整的搜索与多条件筛选。
- 批量场景数据补齐到两份资料中的全部平台。
- 编辑图片模式和 Gemini 尺寸控件复用同一选择器。

### Phase 3：跨模型能力化

- 将尺寸能力接入统一模型能力目录。
- 适配 Seedream、SenseNova 等更多模型的尺寸规则。
- 支持供应商特定清晰度档位、语义尺寸别名和不可用解释。

## 16. 测试建议

- `size-utils` 单元测试：比例转换、16 倍数、像素上下限、长边上限、超出比例禁用。
- 适配器单元测试：`gpt-image-2` 自定义候选全部合法；Gemini 候选全部来自 `GEMINI_SIZE_OPTIONS`；`1.91:1` 这类非 Gemini 原生比例会标记为近似。
- 场景数据测试：每条数据有唯一 ID、标题 key、类别、比例、可信度；同一场景数据不能包含模型专属提交值。
- 组件测试：筛选、搜索、选择、取消、应用、不可用项说明。
- i18n 测试：新增 key 中英文齐全。
- Playwright 视觉检查：桌面/移动、light/dark，至少覆盖弹层打开、筛选后、详情区、不可用项。

## 17. 开放问题

1. 是否需要在首版支持“编辑图片”模式，还是先只接入“生成图片”模式？
2. `size` 状态是否应正式允许任意合规 `WIDTHxHEIGHT` 作为 preset 值，而不是只依赖 `customWidth/customHeight`？
3. 最近使用是否要参与配置导出/同步，还是只保留本机 localStorage？
4. 对印刷类尺寸，是否需要在 UI 中默认折叠，避免普通用户误以为可以直接交付印刷？
5. 后续场景数据是否需要独立维护成 JSON，便于非工程人员更新？
6. Gemini 的 `512` 档位是否要默认隐藏为低清/测试用途，还是与 1K、2K、4K 同级展示？
