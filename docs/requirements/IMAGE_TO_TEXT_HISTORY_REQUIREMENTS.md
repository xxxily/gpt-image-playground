---
title: GPT Image Playground 图生文历史与云同步需求文档
summary: 细化图生文结果进入生成历史后的数据模型、历史面板标签切换、源图资产保存、结果回填、预览放大、同步/恢复/最近同步等开发需求。
createdAt: 2026-05-16
status: draft-requirement
---

# GPT Image Playground 图生文历史与云同步需求文档

## 1. 背景

当前项目已经具备图生文执行链路：

- `src/app/page.tsx` 可以提交 `image-to-text` 任务，并在右侧通过 `TextOutput` 展示文本结果。
- `src/hooks/useTaskManager.ts` 的 `TaskState` 已支持 `textResult` 与 `streamingText`。
- `src/lib/vision-text-*` 已抽象图生文模型、请求参数、结构化结果与 Web/Tauri 执行路径。

但生成历史仍主要服务图片生成/编辑：

- `src/types/history.ts` 的 `HistoryMetadata` 只描述图片输出结果。
- `src/lib/image-history.ts` 只持久化 `openaiImageHistory`。
- `src/components/history-panel.tsx` 只渲染图片历史卡片、图片全屏预览和图片同步操作。
- `src/lib/sync/manifest.ts` 与 `src/lib/sync/snapshot.ts` 只把 `imageHistory` 和图片 blob 放入同步快照。

因此图生文结果刷新后会丢失，源图片也没有稳定资产引用，无法从历史恢复到图生文结果面板，也无法被云同步和恢复。

本文档补充并覆盖 `IMAGE_TO_TEXT_MULTIMODAL_REQUIREMENTS.md` 中“历史可放到二期”的旧规划：图生文历史、源图资产保存和云同步应作为图生文闭环的必做能力。

## 2. 目标

1. 在生成历史面板中新增标签切换，默认仍显示现有图片生成/编辑历史。
2. 用户可以切换到“图生文”标签，查看图生文结果历史列表。
3. 每条图生文历史必须保存：
   - 用户源图片，支持多张并保留顺序。
   - 用户指导词和任务类型。
   - 完整文本结果与可选结构化结果。
   - 供应商、模型、耗时、usage、创建时间、输入图片数量等元信息。
4. 点击图生文历史条目后，右侧结果区重新渲染为图生文结果面板。
5. 选中图生文历史后，左侧源图片区也恢复对应源图片，工作台进入 `image-to-text` 模式。
6. 点击历史条目的源图片缩略图时打开放大查看，放大视图以源图为视觉主体，同时展示图生文结果信息和操作按钮。
7. 图生文历史支持与图片历史同等级的云存储管理：单条同步、批量同步、同步最近、恢复、恢复最近、强制同步/恢复、删除远端对象。
8. 所有新增数据需要兼容 Web、Tauri 桌面和 Tauri 移动/Android，Web 不能依赖桌面专属能力，桌面不能依赖 Next API Route。

## 3. 非目标

- 不把图生文结果混入现有图片历史卡片样式后简单显示。图生文列表需要独立信息架构。
- 不把源图片 base64、完整 Blob 或 API Key 写入 localStorage、日志或 manifest 元数据。
- 不要求首版实现全文搜索、多轮视觉对话、结果版本对比或自动标签分类。
- 不要求图生文历史与图片历史合并为一个时间线。首版使用标签切换，减少对现有图片历史的回归风险。
- 不在同步失败时阻塞本地历史保存。本地历史是主数据源，远端是可恢复副本。

## 4. 信息架构

### 4.1 生成历史标签

在 `HistoryPanel` 顶部标题区加入标签切换：

| 标签 | 默认 | 内容 | 空状态 |
| --- | --- | --- | --- |
| 图片 | 是 | 现有图片生成/编辑历史 | `生成的图片将显示在这里。` |
| 图生文 | 否 | 图生文结果历史 | `图生文结果将显示在这里。` |

要求：

- 默认选中“图片”，保持现有用户路径不变。
- 标签用现有 `Tabs` 或 `ToggleGroup` 风格实现，遵循 `app-panel-card`、`app-panel-subtle`、CSS 变量和明暗主题。
- 标签位置应靠近历史标题，不要新增独立大卡片或营销式区域。
- 切换标签不清空搜索、任务结果或输入区状态。
- 多选状态只在当前标签内生效；切换标签时应退出当前多选或隔离选择集，不能把图片历史和图生文历史混选。
- 云同步菜单根据当前标签显示上下文动作；全局“同步配置/恢复配置”仍可保留。

### 4.2 图片标签保持不变

图片标签继续使用现有逻辑：

- 历史来源：`HistoryMetadata[]`。
- 缩略图、全屏预览、下载、查看提示词、费用、发送到编辑、云同步等行为保持兼容。
- 现有 `onSelectImage`、`onSendToEdit`、`onSyncHistoryItem` 等 props 不因图生文改造而破坏。

### 4.3 图生文标签列表

图生文列表应参考当前图片历史密度，但重新组织内容：

- 卡片顶部显示源图片缩略图区域。
  - 单图：一张正方形缩略图。
  - 多图：最多展示前 4 张拼图或横向缩略条，并显示 `+N`。
  - 源图缺失：显示 `源图待恢复` 占位和恢复入口。
- 卡片中部显示结果摘要。
  - 优先使用 `structuredResult.summary`。
  - 没有结构化摘要时截取 `resultText` 前 80-120 字。
  - 内容最多 3 行，超出省略。
- 卡片元信息显示：
  - 任务类型，例如 `提示词反推`、`图片描述`、`设计规范`。
  - 模型 ID。
  - 图片数量。
  - 耗时。
  - 相对时间。
  - 可选 usage/cost badge。
- 卡片动作：
  - 查看详情。
  - 复制结果。
  - 发送到生成器。
  - 恢复到图生文。
  - 单条同步/同步状态。
  - 删除。

点击卡片主体的默认行为是“恢复到图生文工作台”；点击源图缩略图的默认行为是“打开放大详情”。

## 5. 图生文历史详情与放大查看

### 5.1 详情视图

新增 `VisionTextHistoryViewer` 或扩展 `ZoomViewer` 支持图生文详情模式。详情视图不是纯图片查看器，而是“源图 + 文本结果”的复合查看器。

桌面布局：

- 左侧：源图大图区域。
  - 多张源图可用缩略图条或左右切换。
  - 大图保持完整可见，允许缩放和平移。
- 右侧：图生文结果信息。
  - 任务类型、模型、创建时间、耗时、图片数量。
  - 用户指导词。
  - 完整 `resultText`，保留换行；后续可升级 Markdown 渲染。
  - 结构化字段卡片：主提示词、负向提示词、风格标签、构图、光照、色彩、文字识别、注意事项等。
  - usage/cost 明细。

移动布局：

- 源图在上，结果信息在下。
- 工具栏固定在底部或详情区域底部，避免遮挡源图和文本。
- 文本容器必须可滚动，不能让长文本撑破 viewport。

### 5.2 详情视图操作

详情视图提供以下操作：

- `恢复到图生文`：关闭详情，将源图回填到左侧源图片区，右侧显示该条图生文结果。
- `发送到生成器`：取 `structuredResult.prompt`，没有则取全文，切到图片生成模式并替换提示词。
- `替换提示词`：把可复用提示词写入当前提示词框。
- `追加提示词`：追加到当前提示词框。
- `复制全文`。
- `复制主提示词`：仅在有结构化主提示词时显示。
- `下载结果`：首版可导出 `.txt` 或 `.json`，不是 P0 必做。

### 5.3 结果回填规则

当用户选择图生文历史或点击“恢复到图生文”时：

1. `taskMode` 设置为 `image-to-text`。
2. 用户指导词恢复到提示词框。
3. 图生文任务参数恢复：
   - `visionTextTaskType`
   - `visionTextDetail`
   - `visionTextResponseFormat`
   - `visionTextStructuredOutputEnabled`
   - `visionTextMaxOutputTokens`
   - `visionTextProviderInstanceId`
   - `visionTextModelId`
   - `visionTextApiCompatibility`
4. 源图片恢复到 `imageFiles` 和 `sourceImagePreviewUrls`。
5. 右侧输出区显示历史的 `resultText` 和 `structuredResult`。
6. 不自动重新请求模型。
7. 如果源图资产缺失：
   - 仍可展示文本结果。
   - 源图片区显示缺失占位。
   - 提供“恢复源图”或“从云端恢复最近”入口。
   - 再次提交前必须有可用源图，否则提交被禁用。

## 6. 数据模型

### 6.1 本地历史类型

新增图生文历史类型，不修改现有 `HistoryMetadata` 的语义：

```typescript
export type VisionTextHistorySyncStatus =
  | 'local_only'
  | 'pending_upload'
  | 'synced'
  | 'partial'
  | 'conflict';

export type VisionTextSourceImageRef = {
  filename: string;
  path?: string;
  storageModeUsed: ImageStorageMode;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  sha256?: string;
  source: 'uploaded' | 'clipboard' | 'history-image' | 'remote-url' | 'restored';
  syncStatus?: HistoryImageSyncStatus;
};

export type VisionTextHistoryMetadata = {
  id: string;
  type: 'image-to-text';
  timestamp: number;
  durationMs: number;
  prompt: string;
  taskType: VisionTextTaskType;
  detail: VisionTextDetail;
  responseFormat: VisionTextResponseFormat;
  structuredOutputEnabled: boolean;
  maxOutputTokens: number;
  sourceImages: VisionTextSourceImageRef[];
  resultText: string;
  structuredResult?: ImageToTextStructuredResult | null;
  providerKind: VisionTextProviderKind;
  providerInstanceId: string;
  providerInstanceName?: string;
  model: string;
  apiCompatibility: VisionTextApiCompatibility;
  usage?: ProviderUsage;
  syncStatus?: VisionTextHistorySyncStatus;
};
```

约束：

- `id` 使用稳定 ID，建议 `vision_text_${timestamp}_${random}`，不能只依赖 timestamp，避免并发任务冲突。
- `sourceImages` 必须至少 1 张。
- `sourceImages` 数组顺序就是用户上传顺序。
- `resultText` 可以为空仅限失败草稿；首版只保存成功任务。
- `structuredResult` 解析失败时为 `null`，不影响全文保存。
- 不保存完整 `systemPrompt`。可以保存 `systemPromptHash`，用于排查但避免泄露自定义敏感提示词。

### 6.2 本地存储 Key

新增独立 localStorage key：

```typescript
export const VISION_TEXT_HISTORY_STORAGE_KEY = 'gpt-image-playground-vision-text-history';
```

新增文件：

```text
src/lib/vision-text-history.ts
```

职责：

- `loadVisionTextHistory()`
- `saveVisionTextHistory(history)`
- `clearVisionTextHistoryLocalStorage()`
- `normalizeVisionTextHistoryMetadata(value)`
- `mergeRestoredVisionTextHistory(current, restored)`

要求：

- 归一化逻辑必须像 `image-history.ts` 一样容错。
- 旧数据字段未知时保留可用字段并回退安全默认值。
- 解析失败时不要覆盖原 localStorage 值，返回 `shouldPreserveStoredValue`。
- 保存前按 `timestamp` 倒序排序并限制最大数量；数量上限可复用图片历史配置，或新增 `visionTextHistoryLimit`，默认不低于 100。

### 6.3 源图资产保存

图生文历史必须保存源图片，但不能把图片字节放进 localStorage。源图资产保存策略如下：

| 运行环境 | 保存方式 | 要求 |
| --- | --- | --- |
| Web + IndexedDB | 写入 `ImageDB.images` | 使用安全文件名，记录 size/mimeType/syncStatus。 |
| Web + fs 模式 | 走 Web API 保存到服务器文件系统 | 不复用图片生成 API 的生成语义，建议新增通用 history asset 保存接口。 |
| Tauri 桌面 | 走 Tauri command 保存到本地图片目录 | 不能依赖 Next API Route。 |
| 源图来自已有历史图片 | 优先引用已有资产 | 避免重复保存；删除时需要引用计数保护。 |

建议新增通用 helper：

```text
src/lib/history-assets.ts
```

核心能力：

- `persistHistorySourceImages(files, options)`
- `resolveHistoryAssetSrc(ref)`
- `loadHistoryAssetAsFile(ref)`
- `deleteUnreferencedHistoryAssets(refs)`
- `getHistoryAssetReferenceCounts(imageHistory, visionTextHistory)`

文件命名建议：

```text
vision-source-{timestamp}-{index}-{shortHash}.{ext}
```

注意：

- 保存源图时只读取必要字节，不在热路径做全库扫描。
- 计算 hash 只针对当前任务源图，不扫描历史库。
- 大图体积限制沿用图生文上传限制；超过限制时提示用户压缩或使用低 detail。
- 源图来自历史图片时，如果已有 `filename/path/storageModeUsed` 可直接引用；如果只有远程 URL，需先安全下载并持久化为本地资产。

## 7. 任务完成后的保存流程

`useTaskManager` 当前只在图片任务完成后调用 `onHistoryEntry`。需要扩展：

```typescript
export function useTaskManager(
  maxConcurrent: number,
  onImageHistoryEntry?: (entry: HistoryMetadata) => void,
  blobUrlCacheRef?: React.MutableRefObject<Map<string, string>>,
  onVisionTextHistoryEntry?: (entry: VisionTextHistoryMetadata) => void
)
```

或改为事件对象：

```typescript
onHistoryEntry?: (entry: HistoryMetadata | VisionTextHistoryMetadata) => void
```

推荐事件对象方案，但实现时要避免破坏现有调用方。

图生文完成后保存步骤：

1. 在任务提交时保留源图 File 元数据和顺序。
2. 请求成功后，先持久化源图资产。
3. 生成 `VisionTextHistoryMetadata`。
4. 更新 `visionTextHistory` state。
5. 写入 `gpt-image-playground-vision-text-history`。
6. 右侧仍显示当前任务结果。
7. 如果源图资产保存失败：
   - 不丢弃模型结果。
   - 显示“结果已生成，但源图保存失败”的非阻塞提示。
   - 历史可保存为 `sourceImages` 缺失/待恢复状态，或不写入历史；首版建议写入历史并标记 `partial`。

保存失败不能导致用户看不到本次图生文结果。

## 8. 云同步与恢复

### 8.1 同步快照扩展

在 `SnapshotManifest` 增加可选字段：

```typescript
export type SnapshotManifest = {
  // existing fields
  imageHistory: HistoryMetadata[];
  images: ManifestImageEntry[];

  // new optional fields
  visionTextHistory?: VisionTextHistoryMetadata[];
};

export type ManifestImageEntry = {
  filename: string;
  sha256: string;
  objectKey: string;
  mimeType: string;
  size: number;
  role?: 'image-output' | 'vision-text-source' | 'shared-history-asset';
  referencedBy?: Array<{
    historyType: 'image' | 'vision-text';
    historyId: string;
  }>;
};
```

兼容要求：

- `visionTextHistory` 是可选字段，旧 manifest 没有该字段时按空数组处理。
- `ManifestImageEntry.role` 是可选字段，旧 manifest 没有时按 `image-output` 或 `shared-history-asset` 推断。
- 不轻易提升 `MANIFEST_VERSION`。如果必须提升，必须实现 v1 -> v2 读取兼容。

### 8.2 快照构建范围

同步时需要把历史资产视为统一图片 blob 池：

- 图片历史输出图：来自 `imageHistory[].images`。
- 图生文源图：来自 `visionTextHistory[].sourceImages`。
- 两边引用同一 filename 时只上传一次。
- 删除前必须检查该资产是否仍被任一历史引用。

新增 scope：

```typescript
type SyncSnapshotScope = {
  appConfig?: boolean;
  promptHistory?: boolean;
  promptTemplates?: boolean;
  imageHistory?: boolean;
  imageBlobs?: boolean;
  visionTextHistory?: boolean;
  visionTextSourceImages?: boolean;
};
```

“同步配置”不上传图生文源图。

“同步历史图片”只处理图片历史。

“同步图生文历史”处理 `visionTextHistory` 元数据和源图资产。

后续可以新增“同步全部历史”，同时处理图片和图生文。

### 8.3 图生文标签云菜单

当历史标签为“图生文”时，云菜单显示：

- 同步配置。
- 同步图生文历史。
- 同步最近图生文。
- 强制同步图生文历史。
- 恢复配置。
- 恢复图生文历史。
- 恢复最近图生文。
- 强制恢复图生文历史。

单条图生文卡片右下角显示同步状态：

| 状态 | 表现 | 点击行为 |
| --- | --- | --- |
| `synced` | 云朵已同步 | 展示已同步提示 |
| `local_only` | 上传图标 | 上传该条历史和它引用的源图 |
| `pending_upload` | 进度/等待 | 禁止重复提交 |
| `partial` | 警告云朵 | 打开详情说明缺哪些源图或元数据 |
| `conflict` | 冲突标记 | 打开冲突处理 |

### 8.4 最近同步/恢复

“同步最近图生文”和“恢复最近图生文”沿用当前最近范围弹窗：

- 时间单位：小时/天。
- 数量必须为正整数。
- 范围基于 `VisionTextHistoryMetadata.timestamp`。
- 预览弹窗展示：
  - 候选历史条数。
  - 候选源图数量。
  - 需要上传/下载数量。
  - 可跳过数量。
  - 快照时间。

恢复最近时：

- 只恢复时间范围内的图生文历史和对应源图。
- 不覆盖范围外的本地图生文历史。
- 如果同一源图被范围外历史引用，也可以恢复该源图资产，但不能创建范围外历史条目。

### 8.5 恢复策略

恢复图生文历史分两层：

1. 元数据恢复：恢复 `visionTextHistory` 数组。
2. 源图恢复：下载 `sourceImages` 对应 blob。

允许用户只恢复元数据。此时：

- 图生文列表显示历史文本结果。
- 源图缩略图显示待恢复占位。
- 详情页仍可阅读文本结果，但源图区域显示缺失状态。

完整恢复时：

- 源图写入 IndexedDB 或 Tauri 本地图片目录。
- `sourceImages[].syncStatus` 更新为 `synced`。
- 列表缩略图恢复显示。

### 8.6 删除与远端清理

删除图生文历史时：

- 默认只删除本地历史条目。
- 如果源图资产没有被其它图片历史或图生文历史引用，可以删除本地源图资产。
- 如果用户勾选“同时删除远端”，才写入 tombstone 或请求远端删除。
- 远端删除也必须做引用检查；不能删除仍被其它历史条目引用的 blob。

清空图生文历史时：

- 只清空图生文标签下的历史。
- 不影响图片历史。
- 若选择远端删除，仅删除图生文独占源图资产和图生文历史元数据。

## 9. 与现有组件的改造点

### 9.1 `src/types/history.ts`

新增 `VisionTextHistoryMetadata` 相关类型。保留 `HistoryMetadata` 不变。

### 9.2 `src/lib/vision-text-history.ts`

新增历史 load/save/normalize/merge 工具，与 `image-history.ts` 保持风格一致。

### 9.3 `src/lib/history-assets.ts`

新增通用历史资产工具，避免把源图保存逻辑塞进 `page.tsx` 或 `HistoryPanel`。

### 9.4 `src/hooks/useTaskManager.ts`

图生文任务完成后产生历史条目事件。需要保留任务结果和历史保存失败的独立错误处理。

### 9.5 `src/app/page.tsx`

新增状态：

```typescript
const [visionTextHistory, setVisionTextHistory] = React.useState<VisionTextHistoryMetadata[]>([]);
const [displayedVisionTextHistoryItem, setDisplayedVisionTextHistoryItem] =
  React.useState<VisionTextHistoryMetadata | null>(null);
```

新增行为：

- 首次加载图生文历史。
- 图生文历史变化后保存 localStorage。
- 选择图生文历史时恢复源图和结果。
- 云恢复完成后刷新 `visionTextHistory` 和源图 object URL cache。
- 清空/删除/批量删除图生文历史。

### 9.6 `src/components/history-panel.tsx`

建议拆分为：

```text
src/components/history-panel.tsx
src/components/history/image-history-grid.tsx
src/components/history/vision-text-history-list.tsx
src/components/history/vision-text-history-viewer.tsx
```

如果暂不拆分，也必须避免单文件继续无限膨胀。

新增 props：

```typescript
visionTextHistory: VisionTextHistoryMetadata[];
activeHistoryTab: 'images' | 'vision-text';
onHistoryTabChange: (tab: 'images' | 'vision-text') => void;
onSelectVisionTextHistory: (item: VisionTextHistoryMetadata) => void;
onOpenVisionTextHistoryViewer: (item: VisionTextHistoryMetadata, sourceImageIndex: number) => void;
onDeleteVisionTextHistoryRequest: (item: VisionTextHistoryMetadata) => void;
onSyncVisionTextHistoryItem?: (item: VisionTextHistoryMetadata) => void | Promise<void>;
onSyncVisionTextHistoryFull?: (options?: ImageSyncActionOptions) => void | Promise<void>;
onRestoreVisionTextHistory?: (options?: ImageSyncActionOptions) => void | Promise<void>;
```

### 9.7 `src/components/text-output.tsx`

新增历史回放态支持：

- `sourceLabel?: string`，例如 `历史结果`。
- `createdAt?: number`。
- `durationMs?: number`，历史回放时不要重新计时。
- `usage?: ProviderUsage`。
- `isHistoryReplay?: boolean`。

历史回放时仍显示复制、替换、追加、发送到生成器，不显示 loading。

### 9.8 `src/lib/sync/*`

需要扩展：

- manifest validate。
- snapshot build。
- 上传范围计算。
- restore merge。
- 最近范围过滤。
- sync 状态写回。
- remote delete/tombstone 引用检查。

实现必须保持当前图片同步路径行为不变。

## 10. 安全、隐私与性能

1. 图生文源图可能比生成图更敏感，历史保存需要在设置中提供开关：
   - 默认：保存图生文历史和源图，保持历史功能完整。
   - 关闭：只在当前会话展示，不写入本地历史。
2. 云同步源图必须跟随用户显式同步动作，不因生成完成自动上传。
3. 不在 localStorage 中保存图片 base64、完整 data URL、API Key 或完整系统提示词。
4. 缩略图解析必须 lazy，不在历史面板首屏扫描所有 blob。
5. 恢复检查必须按 filename 主键查询，不能全量扫描 Dexie Blob 表。
6. 多图历史最多首屏 eager 加载有限数量缩略图，沿用图片历史的 `HISTORY_THUMBNAIL_EAGER_COUNT` 思路。
7. 删除源图资产前必须做引用计数，避免破坏图片历史或其它图生文历史。
8. Tauri 路径要使用 `src/lib/desktop-runtime.ts` 封装，不在组件中直接导入 Tauri API。
9. Web 端远程 URL 源图必须复用现有安全校验，不允许静默扩展到 localhost/private IP。

## 11. 边界情况

| 场景 | 期望行为 |
| --- | --- |
| 图生文成功但源图保存失败 | 结果仍显示，历史标记 `partial`，提示用户源图未完整保存。 |
| 多张源图部分缺失 | 卡片显示可用缩略图和缺失数量，详情页逐图标注缺失。 |
| 历史源图来自已有生成图 | 复用原资产，不重复上传；删除图生文历史不删除原生成图。 |
| 用户只恢复图生文元数据 | 文本结果可读，源图显示待恢复。 |
| 用户同步最近 1 天 | 只上传 1 天内图生文历史和其源图。 |
| 用户恢复最近 1 天 | 只新增/合并 1 天内图生文历史，不覆盖范围外本地历史。 |
| 旧客户端读取新 manifest | 不应因为 `visionTextHistory` 可选字段导致图片恢复失败。 |
| 新客户端读取旧 manifest | `visionTextHistory` 为空，图片恢复保持原行为。 |
| localStorage 中图生文历史损坏 | 返回空列表并保留原值，避免二次保存覆盖。 |
| 结构化结果字段不完整 | 全文照常展示，缺失字段隐藏。 |
| 源图文件名重复 | 保存时生成唯一 filename，引用已有历史资产时允许共享。 |

## 12. 分阶段实施

### Phase 1：本地图生文历史

- 新增 `VisionTextHistoryMetadata` 类型。
- 新增 `vision-text-history.ts`。
- 图生文任务完成后保存本地历史。
- 源图写入 IndexedDB/Tauri 本地资产。
- 历史面板新增“图片 / 图生文”标签。
- 图生文列表支持选择历史并回填结果面板和源图片区。

### Phase 2：详情查看与操作

- 新增图生文历史详情/放大查看。
- 支持多源图切换。
- 支持复制、替换、追加、发送到生成器。
- 支持缺失源图占位和恢复入口。

### Phase 3：云同步与恢复

- 扩展 manifest 和 snapshot。
- 支持同步图生文历史、同步最近图生文、恢复图生文历史、恢复最近图生文。
- 支持单条同步和同步状态 badge。
- 支持删除远端图生文历史资产。

### Phase 4：质量收敛

- 引用计数与冲突处理完善。
- 增加历史数量限制与设置项。
- 增加导出 `.txt/.json`。
- 增加全文搜索和任务类型筛选。

## 13. 验收标准

### 13.1 产品验收

- 默认打开历史面板时仍显示图片历史。
- 点击“图生文”标签后显示图生文历史列表。
- 完成一次图生文后刷新页面，结果仍在图生文历史中。
- 图生文历史卡片显示源图缩略图、结果摘要、任务类型、模型、时间和耗时。
- 多张源图按原顺序展示和恢复。
- 点击图生文卡片后，右侧结果面板显示历史文本结果，左侧源图片区恢复源图。
- 点击源图缩略图后打开详情放大视图，能同时查看源图和图生文结果。
- 详情视图可复制全文、发送到生成器、恢复到图生文。
- 图生文历史支持单条删除、批量删除和清空，不影响图片历史。
- 图生文历史支持同步、恢复、同步最近、恢复最近。

### 13.2 技术验收

- `openaiImageHistory` 结构不被破坏。
- 图生文历史使用独立 localStorage key 或兼容的新 union store，有明确迁移策略。
- 图片历史同步现有测试不回归。
- 图生文源图不以 base64/data URL 保存在 localStorage 或 manifest。
- Web 和 Tauri 都有源图持久化路径。
- 恢复源图不触发 Dexie 全量 blob 扫描。
- 删除源图资产前完成引用检查。
- 旧 manifest 和旧 localStorage 数据可以正常读取。

### 13.3 测试用例

单元测试：

- `normalizeVisionTextHistoryMetadata` 对未知/损坏字段容错。
- `saveVisionTextHistory` 排序和数量限制。
- 源图资产 filename 生成和引用计数。
- 图生文历史 merge/restore 去重。
- manifest 中 `visionTextHistory` 可选字段兼容。
- 最近同步范围过滤。

集成测试：

- 图生文任务完成后写入本地历史。
- 刷新页面后恢复图生文历史。
- 选择图生文历史回填 `TextOutput` 和源图区。
- 同步图生文历史后 manifest 包含文本历史和源图资产。
- 恢复图生文历史后列表、源图和结果可用。
- 只恢复元数据时源图缺失态可用。

人工验收：

- 单张商品图。
- 多张参考图。
- UI 截图。
- 海报/KV。
- OCR 截图。
- 从图片历史发送到图生文后再保存历史。
- 明暗主题。
- 手机宽度和桌面宽度。

## 14. 开发注意事项

- 先做本地历史，再做云同步，避免一次性改动 `HistoryPanel`、`page.tsx`、`sync-client.ts` 导致回归面过大。
- `HistoryPanel` 已经较大，新增图生文列表时优先拆子组件。
- 云同步扩展时先写纯函数测试，再接 UI 操作。
- 所有云同步按钮文案要区分图片和图生文，避免用户误以为“恢复历史图片”会恢复图生文结果。
- 图生文历史回放是历史状态，不应该进入任务队列，也不应该显示为正在运行的任务。
- 结果回填到图生文面板后，用户再次点击提交才会发起新请求。
