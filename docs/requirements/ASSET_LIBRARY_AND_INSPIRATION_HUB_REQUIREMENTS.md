---
title: 素材灵感库与资源物料仓库需求文档
summary: 规划面向创作流程的资源物料仓库和素材灵感库，覆盖本地/云端资产管理、素材网站链接管理、跨端打开方式、导入导出、存储安全与后续实现阶段。
createdAt: 2026-05-27
status: proposed
relatedDocs:
  - ../workspace.md
  - ../history-and-assets.md
  - ../sharing-and-sync.md
  - ./NETWORK_STORAGE_SYNC_RESEARCH.md
  - ./CLOUD_SYNC_IMPROVEMENT_AND_PROTOCOL_EXPANSION.md
  - ./CREATIVE_RESOURCE_SPLIT_WORKSPACE_REQUIREMENTS.md
---

# 素材灵感库与资源物料仓库需求文档

## 1. 背景与问题

GPT Image Playground 现在已经具备图片生成、图片编辑、图生文、视频生成、历史资产、提示词模板、分享和 S3 兼容云同步能力。历史区能保存生成结果和部分源图，但它的语义仍然是“任务历史”，不是用户主动维护的长期素材库。

用户在创作时还存在两个高频需求：

1. **常用物料复用成本高**：品牌 Logo、商品图、人物设定、背景参考、贴纸、纹理、构图参考等常用素材散落在本地文件夹、聊天记录或设计工具中。每次编辑图片或批量创作时，都要重新翻找、拖入和筛选。
2. **创作灵感入口分散**：用户会访问 Behance、Dribbble、Pinterest、Unsplash、ArtStation、Awwwards 等网站寻找灵感，但这些入口不属于当前工作台，无法按自己的创作场景整理，也无法和当前“粘贴图片即可使用”的能力形成闭环。

因此需要新增两个互补功能：

- **资源物料仓库**：管理用户自己的素材文件，支持导入、分类、打标签、检索、预览、使用、同步和导入导出。
- **素材灵感库**：管理外部素材/灵感网站链接，内置常见网站分类，允许用户添加自定义网站，并支持新标签页或应用内抽屉打开。

这两个功能都服务于“更快找到可用素材并继续创作”，但数据边界不同：资源物料仓库保存用户文件，素材灵感库只保存网站链接和分类配置。

## 2. 目标

1. 新增可拖拽的 **全局浮动功能菜单**，默认停靠在右下角；素材相关功能作为该菜单中的一组入口，避免继续挤占当前工作台布局。
2. 资源物料仓库支持图片类常用素材的长期管理，可从文件选择、拖拽、粘贴、历史结果、文件夹导入等入口添加素材。
3. 资源物料仓库支持分类、标签、收藏、搜索、筛选、批量编辑、导入导出和云同步。
4. 资源物料仓库在未配置云存储时仍可本地使用，但必须给出容量提示、导入规模提醒和清理入口，避免 IndexedDB 或桌面本地目录被无限撑大。
5. 资源物料仓库中的素材可以一键用于当前编辑流程，例如发送到图片编辑源图、图生文源图、图生视频源图，或作为批量任务的参考素材。
6. 素材灵感库内置常见素材/设计灵感网站，并按设计灵感、摄影图库、插画矢量、UI/网页、三维与概念、色彩字体等类别管理。
7. 素材灵感库允许用户新增、编辑、删除、排序、启停自定义网站和自定义类别，并支持 JSON 导入导出。
8. 素材灵感网站支持 **外部打开**、**应用内抽屉打开** 和桌面端 **分屏工作区打开**。iframe 内嵌只作为最佳努力能力，遇到站点安全策略阻止时必须清晰回退到外部打开。
9. 全局浮动功能菜单必须做成可配置、可多级展开的通用组件，后续新功能可以通过注册菜单项接入，而不是修改主页面布局。
10. Drawer 必须做成可复用基础组件，支持不同业务模块以抽屉形式打开；素材灵感网站只是首批使用场景之一。
11. 桌面端连续浏览素材灵感或资源物料时，默认使用右侧分屏工作区，避免遮挡主工作台；短任务和低频管理继续使用 Drawer。移动端 Drawer 覆盖完整视口，确保网页可用空间。
12. Web、Tauri 桌面和 Tauri Android 必须共享核心数据模型；涉及本地文件夹、系统浏览器、桌面存储和云同步的能力要分别定义跨端路径。

> 分区工作台属于本需求的后续细化与调整，详见 [素材灵感库与资源物料仓库分区工作台需求细化](./CREATIVE_RESOURCE_SPLIT_WORKSPACE_REQUIREMENTS.md)。实现时应以该文档覆盖“桌面端长期浏览默认 Drawer”的旧假设，并把左右拖动调整工作区大小作为 P0 基础能力。

## 3. 非目标

- 不在首版爬取、镜像、批量下载或解析外部素材网站内容。
- 不绕过外部网站的登录、付费、CSP、X-Frame-Options、反盗链或版权限制。
- 不把素材灵感库做成第三方素材市场，也不代理用户在第三方站点的账号体系。
- 不把资源物料仓库混入生成历史列表，避免长期素材污染任务历史。
- 不把大体积素材写入 `localStorage`、分享 URL、日志或同步配置。
- 不为素材入口新增固定顶部导航、侧边栏或大面积页面区块，避免改变现有工作台主布局。
- 不在首版支持任意文件类型直接参与生成。非图片资源可以被归档，但“使用”能力必须按当前生成/编辑模型实际支持的输入类型降级。
- 不在首版实现多人协作权限、团队共享空间或素材审核流。

## 4. 产品边界与信息架构

### 4.1 全局浮动功能菜单

建议新增一个全局浮动功能菜单按钮，作为后续功能入口的统一承载层。按钮默认停靠在工作台右下角，用户可以拖动调整位置。点击按钮后展开一级菜单，一级菜单可以继续展开二级或三级菜单。

核心要求：

- 默认位置：右下角，避开安全区和底部系统手势区域，使用 `right: max(1rem, env(safe-area-inset-right))`、`bottom: max(1rem, env(safe-area-inset-bottom))` 这类安全区约束。
- 可拖拽：支持鼠标和触摸拖动；拖动结束后将位置限制在视口内，不允许遮挡到屏幕外。
- 位置记忆：保存用户自定义位置；窗口尺寸变化后重新归一化，避免旧位置在新视口中不可见。
- 重置能力：设置中提供“恢复默认位置”，菜单长按或上下文操作也可提供重置入口。
- 多级展开：支持父级菜单、分组、二级菜单和三级菜单；移动端不建议无限嵌套，超过二级时使用面板内返回导航。
- 通用注册：菜单项通过配置或 registry 注册，不在主页面硬编码业务细节。
- 可访问性：按钮可键盘聚焦，`Enter` / `Space` 打开菜单，`Esc` 关闭菜单，方向键可在菜单项中移动。
- 状态提示：菜单项支持徽标、禁用态、加载态、同步状态和简短说明。
- 布局保护：展开菜单不能挤压工作台布局；菜单打开时不改变当前提示词、源图、输出区或历史区状态。
- 主题适配：使用现有主题变量，浅色/深色主题都要可读；不使用硬编码纯白/纯黑。

建议新增通用组件：

```text
src/components/ui/floating-action-menu.tsx
src/components/app-feature-menu.tsx
src/lib/feature-menu-registry.ts
```

建议菜单项模型：

```ts
type FeatureMenuItem = {
    id: string;
    labelKey: string;
    descriptionKey?: string;
    icon?: React.ComponentType<{ className?: string }>;
    order: number;
    group?: string;
    badge?: string | number;
    disabled?: boolean;
    hidden?: boolean;
    action?: 'open-dialog' | 'open-drawer' | 'open-external' | 'custom';
    drawerId?: string;
    dialogId?: string;
    children?: FeatureMenuItem[];
};
```

素材相关入口建议作为内置分组接入：

```text
创作资源
├── 资源物料仓库
└── 素材灵感库
```

后续可以继续加入“批量中心”“视频任务”“同步活动”“诊断工具”等入口，而不改动页面主体布局。

### 4.2 素材模块信息架构

用户从全局浮动功能菜单进入素材模块后，展示一个响应式素材面板或 Drawer，包含 **资源物料仓库** 和 **素材灵感库** 两个 Tab：

| Tab | 主要职责 |
| --- | --- |
| 资源物料仓库 | 用户自有素材文件管理、预览、使用、同步、导入导出 |
| 素材灵感库 | 外部灵感网站链接管理、分类、打开方式、内嵌抽屉 |

入口需要遵循现有工作台风格：

- 使用现有 `app-theme-scope`、`app-panel-card`、`app-panel-subtle` 和 CSS 变量。
- 使用 Tabs、Dialog/Drawer、Popover、Tooltip、Notice、IconButton 等现有模式。
- 所有新增可见文案进入 `src/lib/i18n/*`，保持多语言资源同步。
- 不使用 `window.alert`、`window.prompt`、`window.confirm`。

### 4.3 与历史区的关系

历史区继续负责“任务复盘”和“生成结果沉淀”。资源物料仓库负责“用户主动收藏和长期复用的素材”。

两者可以互相流转：

- 历史图片可以 **保存到资源物料仓库**。
- 资源物料可以 **发送到编辑区/图生文/图生视频**。
- 资源物料可以记录来源为 `history-image`，但不应该回写历史任务。
- 删除历史不应删除资源物料仓库中的副本，除非用户在二次确认中选择“同时删除素材库副本”。

### 4.4 与云同步的关系

资源物料仓库建议复用现有 S3 兼容云存储配置，但不应强制用户配置云存储。

推荐交互：

- 未配置云存储时，素材库显示“本地模式”状态和容量提示。
- 用户首次导入大批量素材时，提示先配置云存储或控制导入规模。
- 已配置云存储时，显示素材库同步状态和手动同步入口。
- 素材库同步应作为独立同步 scope，避免每次历史同步都扫描全部长期素材。

素材灵感库只保存链接和分类配置，体积很小，可以跟随应用配置同步，也可以提供独立 JSON 导入导出。

## 5. 资源物料仓库需求

### 5.1 支持的素材类型

P0 重点支持图片类素材，因为当前图像编辑和图生视频流程主要依赖图片输入：

| 类型 | P0 行为 | 后续扩展 |
| --- | --- | --- |
| PNG / JPEG / WebP / AVIF | 可导入、预览、打标签、发送到编辑/图生文/图生视频 | 支持压缩、格式转换 |
| GIF | 可导入和预览首帧或动图；使用时按模型能力决定 | 提取帧、转视频 |
| SVG | 默认可保存为文件，但预览和使用需要沙箱化或转位图 | SVG 清洗、转 PNG |
| 视频文件 | 可归档和下载；P0 不强制用于图生视频 | 作为图生视频源或参考素材 |
| PDF / PSD / AI / ZIP 等设计源文件 | 可作为附件型物料保存；不参与生成 | 桌面端外部打开、元数据提取 |

导入时必须校验 MIME、扩展名、体积和可读性。未知类型可以保存为“文件素材”，但不展示为可直接编辑图片。

### 5.2 添加素材入口

资源物料仓库应支持以下添加方式：

1. **文件选择**：选择一个或多个本地文件。
2. **拖拽文件**：拖入素材库面板或全局拖入后选择“添加到素材库”。
3. **粘贴图片**：复用现有剪贴板图片解析能力，将剪贴板图片保存为素材。
4. **从历史保存**：历史卡片、全屏预览、输出结果增加“保存到素材库”入口。
5. **从当前源图保存**：当前编辑区已经添加的源图可以保存到素材库。
6. **文件夹导入**：
   - Web Chromium 环境可使用拖拽目录的 `webkitGetAsEntry` 或文件夹选择能力递归枚举。
   - Safari/Firefox 可能无法完整支持文件夹拖拽，需要降级到多文件选择。
   - Tauri 桌面端应新增 Rust 命令枚举本地目录，支持递归、过滤、进度和取消。
   - Android 端不要求文件夹拖入，使用系统文件选择器和多选作为降级路径。

文件夹导入必须有规模控制：

- 导入前预览文件数、总大小、可识别图片数、不可识别文件数。
- 默认不跟随符号链接，避免越界扫描。
- 默认跳过隐藏系统文件和临时文件。
- 支持最大递归深度、最大文件数、最大总大小限制。
- 支持导入中取消，并保留已完成条目。

### 5.3 管理能力

资源物料仓库应提供：

- 分类：内置“未分类”“品牌素材”“人物/角色”“商品/物件”“背景/场景”“纹理/图案”“构图参考”“临时素材”，用户可新增、重命名、排序、删除。
- 标签：素材可拥有多个标签，支持新增、移除、批量打标和标签筛选。
- 收藏：常用素材可收藏，收藏结果在列表顶部或专门筛选中展示。
- 搜索：按文件名、备注、标签、分类、来源和 MIME 类型搜索。
- 筛选：按类型、分类、标签、收藏、同步状态、创建时间、最近使用时间、文件大小筛选。
- 排序：最近使用、最近添加、名称、大小、类型、收藏优先。
- 批量操作：移动分类、添加标签、移除标签、收藏、取消收藏、导出、同步、删除。
- 详情面板：展示预览、文件名、类型、大小、尺寸、来源、导入时间、最近使用时间、同步状态、备注、标签和引用关系。
- 重命名：只改素材展示名，不一定改底层 blob key。
- 去重：导入时基于 SHA-256 识别重复素材，提示“使用已有素材 / 仍然添加副本 / 跳过”。

### 5.4 使用素材

素材卡片和详情面板应提供上下文相关操作：

| 操作 | 行为 |
| --- | --- |
| 发送到编辑 | 将图片素材追加到当前编辑源图列表，并滚动到输入区 |
| 替换当前源图 | 清空当前源图后使用该素材 |
| 加入批量参考 | 将一个或多个素材作为批量规划的参考源图 |
| 发送到图生文 | 将素材作为图生文分析源图 |
| 发送到图生视频 | 当文件类型和模型能力允许时作为视频源图 |
| 复制图片 | 复制图片到剪贴板；桌面端走 Tauri clipboard，Web 端走 Clipboard API |
| 下载 | 保存当前素材文件 |
| 在系统中打开 | 桌面端可外部打开素材或所在目录；Web 端隐藏或降级为下载 |

使用素材时需要记录 `lastUsedAt` 和 `usageCount`，但不能阻塞主流程。

### 5.5 本地存储与容量提示

资源物料仓库不能把素材 Blob 写入 `localStorage`。建议新增独立 IndexedDB/Dexie 表，并把 Blob 与元数据分表：

```ts
type AssetLibraryItem = {
    id: string;
    displayName: string;
    originalFilename: string;
    kind: 'image' | 'video' | 'design-file' | 'document' | 'archive' | 'unknown';
    mimeType: string;
    size: number;
    sha256?: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    categoryId: string;
    favorite: boolean;
    note?: string;
    source: 'file-picker' | 'drop' | 'paste' | 'folder' | 'history' | 'current-source' | 'import' | 'restored';
    sourceUrl?: string;
    blobKey: string;
    thumbnailKey?: string;
    syncStatus?: 'local_only' | 'queued' | 'syncing' | 'synced' | 'failed' | 'conflict';
    remoteKey?: string;
    createdAt: number;
    updatedAt: number;
    lastUsedAt?: number;
    usageCount?: number;
};

type AssetLibraryBlobRecord = {
    blobKey: string;
    blob: Blob;
    size?: number;
    mimeType?: string;
    sha256?: string;
    lastModifiedLocal?: number;
};

type AssetLibraryTagRecord = {
    assetId: string;
    tag: string;
};
```

实现约束：

- Blob 表只以 `blobKey` 为主键，避免在移动端升级 IndexedDB 时扫描大 Blob。
- 元数据表可以索引 `categoryId`、`kind`、`favorite`、`updatedAt`、`lastUsedAt`、`sha256` 等轻量字段。
- 标签建议单独建小表，避免在 Blob 表上建立多值索引。
- 缩略图异步生成和缓存，不阻塞导入完成。
- 使用 `navigator.storage.estimate()` 展示浏览器剩余容量估算；不可用时显示保守提示。
- 导入大于阈值的素材批次时显示非阻塞确认 Dialog。

建议默认阈值：

| 条件 | 行为 |
| --- | --- |
| 单次导入超过 100 个文件或 500 MB | 提醒建议先配置云存储，用户确认后继续 |
| 浏览器估算使用率超过 70% | 显示黄色容量提示 |
| 浏览器估算使用率超过 85% | 显示红色提示，并建议暂停大批量导入 |
| 单文件超过模型可用上限 | 可以保存，但使用时提示需要压缩或降级 |

桌面端可以继续使用 IndexedDB，也可以后续增加专门的素材目录。若新增桌面素材目录，前端必须通过 `src/lib/desktop-runtime.ts` 调用 Tauri 命令，不直接导入 Tauri API。

### 5.6 云同步

资源物料仓库建议使用独立同步命名空间，复用现有 S3 兼容配置、传输模式和安全护栏：

```text
{basePrefix}/asset-library/v1/manifest.json
{basePrefix}/asset-library/v1/assets/{sha256}/{safeFilename}
{basePrefix}/asset-library/v1/thumbnails/{assetId}.webp
{basePrefix}/asset-library/v1/snapshots/{snapshotId}/manifest.json
```

建议新增 `AssetLibraryManifest`，避免把长期素材塞进现有历史 `SnapshotManifest`，导致普通历史同步变慢：

```ts
type AssetLibraryManifest = {
    version: 1;
    snapshotId: string;
    createdAt: number;
    revision: number;
    deviceId: string;
    categories: AssetLibraryCategory[];
    items: Array<Omit<AssetLibraryItem, 'syncStatus'> & { remoteKey?: string }>;
    tags: AssetLibraryTagRecord[];
    tombstones?: Array<{
        assetId: string;
        blobKey?: string;
        remoteKey?: string;
        sha256?: string;
        deletedAt: number;
        deviceId: string;
        reason: 'local-delete';
    }>;
};
```

同步要求：

- 云同步未配置时，素材库所有操作仍可本地执行。
- 云同步配置完整时，素材库显示“同步素材库”“恢复素材库”“同步选中素材”入口。
- 自动同步必须有单独 scope，例如 `assetLibraryMetadata` 和 `assetLibraryBlobs`。
- 大批量素材同步需要独立队列、进度、失败重试和取消能力。
- 删除远端素材必须沿用现有“显式允许远端删除”的策略，默认不删除远端对象。
- 恢复素材时必须先恢复元数据，再按需恢复 Blob；支持“只恢复最近使用 / 只恢复收藏 / 全量恢复”。
- 恢复检查必须按主键或远端 key 定点读取，不能扫描全量 Blob 或重新计算所有 hash。
- 分享链接不默认包含素材库数据；如果未来支持共享素材库恢复配置，必须复用加密分享和敏感配置确认。

### 5.7 导入导出

资源物料仓库需要支持完整导入导出：

| 能力 | P0 建议 | 说明 |
| --- | --- | --- |
| 导出索引 JSON | 必做 | 导出分类、标签、元数据，不含 Blob |
| 导入索引 JSON | 必做 | 用于迁移分类和标签；缺失 Blob 标记为待补齐 |
| 导出选中素材包 | 必做 | 建议导出 `.zip`，包含 manifest 和素材文件 |
| 导入素材包 | 必做 | 读取 manifest、还原分类标签、导入 Blob |
| 导出全部素材包 | P1 | 大库导出需要流式压缩和进度 |
| 桌面端导出到文件夹 | P1 | Tauri 可直接写入用户选择目录 |

推荐素材包结构：

```text
gpt-image-playground-assets-v1.zip
├── manifest.json
└── assets/
    ├── {assetId}-{safeFilename}
    └── ...
```

安全要求：

- 导入 ZIP 必须防止 zip slip：拒绝绝对路径、`..`、反斜杠路径穿越和超长路径。
- 必须限制最大条目数、最大解压后体积和单文件体积，避免 zip bomb。
- 导入包中即使包含未知字段，也要按兼容策略忽略，不覆盖已有有效数据。
- 同名/同 hash 冲突必须展示冲突处理选项。

如果不希望新增 ZIP 依赖，首版可以先支持“导出 JSON + 批量下载选中文件”，但这不足以满足完整迁移诉求。更推荐评估引入轻量压缩库，或在 Tauri 桌面端用 Rust 流式生成 ZIP。

## 6. 素材灵感库需求

### 6.1 内置分类与站点候选

素材灵感库只保存链接，不保存第三方网站图片内容。内置站点应作为可编辑的默认种子数据，用户可以隐藏、排序或删除。

建议内置分类：

| 分类 | 站点候选 |
| --- | --- |
| 综合设计灵感 | Behance、Dribbble、Pinterest |
| 摄影与免版权图库 | Unsplash、Pexels、Pixabay |
| 插画与矢量 | Freepik、unDraw、The Noun Project |
| UI / 网页 / 产品 | Awwwards、Mobbin、SiteInspire、Lapa Ninja |
| 三维 / 概念 / 游戏美术 | ArtStation、Sketchfab、BlenderKit |
| 色彩 / 字体 / 排版 | Coolors、Adobe Color、Google Fonts、Fontshare |
| AI 创意参考 | Midjourney Explore、OpenArt、Civitai |

实现前需要复核每个站点的当前可访问性、地域可用性、登录要求、iframe 限制、版权和商用条款。内置站点列表不是下载授权清单，UI 文案需要明确“请遵守目标网站授权规则”。

### 6.2 链接管理

素材灵感库应支持：

- 新增网站：名称、URL、分类、标签、描述、默认打开方式。
- 编辑网站：修改名称、URL、分类、标签、描述、排序和启用状态。
- 删除网站：用户添加的网站直接删除；内置网站建议支持“隐藏/恢复默认”。
- 分类管理：新增、重命名、排序、删除自定义分类。
- 标签管理：给网站打标签，例如“电商”“海报”“UI”“3D”“配色”“摄影”。
- 搜索筛选：按名称、域名、描述、分类、标签搜索。
- 置顶/收藏：常用网站可置顶。
- 导入导出：导出 JSON；导入时合并自定义网站和分类，内置网站按 stable id 去重。

建议数据结构：

```ts
type InspirationSiteCategory = {
    id: string;
    builtIn: boolean;
    nameKey?: string;
    customName?: string;
    order: number;
    enabled: boolean;
};

type InspirationSite = {
    id: string;
    builtIn: boolean;
    title: string;
    url: string;
    categoryId: string;
    tags: string[];
    description?: string;
    defaultOpenMode: 'drawer' | 'new-tab' | 'external-browser';
    pinned?: boolean;
    enabled: boolean;
    order: number;
    createdAt: number;
    updatedAt: number;
    lastOpenedAt?: number;
};
```

URL 安全要求：

- 默认只允许 `https://` URL。
- 拒绝 `javascript:`、`data:`、`file:`、`blob:` 等协议。
- 不通过服务端代理任意第三方网页来绕过 iframe 限制，避免 SSRF 和版权风险。
- 外部打开统一走 `openExternalUrl`，桌面端使用系统浏览器，Web 端使用新标签页。

### 6.3 打开方式、分区工作台与可复用 Drawer

打开方式应支持：

| 打开方式 | Web | Tauri 桌面 | 移动端 |
| --- | --- | --- | --- |
| 新标签页打开 | `window.open` via `openExternalUrl` | 系统浏览器 | 系统浏览器或新 WebView |
| 分区工作台 + iframe | 右侧可调整大小的非 Modal 工作区，iframe 最佳努力 | 默认右侧分区工作台；失败可系统浏览器打开 | 不启用，降级全屏 Drawer |
| Drawer + iframe | 短任务、管理和窄屏降级使用，iframe 最佳努力 | 低频管理或用户手动选择 Drawer 时使用 | 全屏抽屉，顶部工具栏保留关闭和外部打开 |
| 外部浏览器 | 等同新标签页 | 系统浏览器 | 系统浏览器 |

桌面端连续浏览素材灵感或资源物料时，应优先使用 [分区工作台需求细化](./CREATIVE_RESOURCE_SPLIT_WORKSPACE_REQUIREMENTS.md) 中定义的 `ResizableWorkspace` / `WorkspacePane` / `WorkspaceResizeHandle` 能力。左右拖动调整主工作台与辅助面板大小是 P0 基础能力，不应退化成固定宽度侧栏。

Drawer 仍然需要保留。当前项目没有通用 Drawer/Sheet 组件，建议新增 `src/components/ui/drawer.tsx`，基于 Radix Dialog 封装。这个组件不能只服务素材灵感库，应作为短任务、低频管理、窄屏降级和移动端全屏面板的基础承载组件。

- `side = 'right' | 'left' | 'bottom'`。
- 桌面 Drawer 默认 `right`，宽度建议 `min(720px, 45vw)`；需要长期并排使用的场景不依赖 Drawer 调整大小，而走分区工作台。
- 移动端固定全屏，使用 `inset: 0` 并尊重 safe-area。
- 支持标准结构：header、toolbar、content、footer、loading、empty、error。
- 支持业务自定义工具栏动作，例如刷新、外部打开、同步、导入、导出、保存。
- 支持 Drawer 内的二级导航和返回按钮，方便多级功能面板在移动端全屏使用。
- 加载态、失败态和 iframe 被拒绝态使用项目 Notice/EmptyState 样式。
- 抽屉打开不应改变当前提示词、源图或任务状态。
- 抽屉组件本身不绑定素材、iframe 或具体业务；业务内容通过 slot/render prop 注入。

建议基础接口：

```ts
type AppDrawerSide = 'right' | 'left' | 'bottom';

type AppDrawerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    side?: AppDrawerSide;
    title: React.ReactNode;
    description?: React.ReactNode;
    toolbar?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
    fullScreenOnMobile?: boolean;
    preferredWidth?: string;
};
```

iframe 约束：

- 很多第三方网站会通过 CSP 或 `X-Frame-Options` 禁止被内嵌，应用无法可靠提前知道。
- iframe 加载超时或 `onError` 时展示“该网站不允许在应用内打开”，并提供外部打开按钮。
- iframe 使用 `sandbox` 和 `referrerPolicy`，只授予必要权限。
- 不在 iframe 中注入脚本，不读取第三方页面内容。

### 6.4 与创作流程的衔接

素材灵感库的核心闭环是：

1. 用户打开灵感网站寻找图片或创意。
2. 用户在第三方网站复制图片或图片地址。
3. 回到工作台粘贴。
4. 现有剪贴板图片解析能力把图片加入编辑区。
5. 用户也可以把粘贴进来的图片保存到资源物料仓库。

可选增强：

- 当分区工作台打开时，主工作台仍能接收粘贴；当 Drawer 打开时，可按浏览器能力继续监听全局 paste，但不能假设 iframe 内复制后父页面一定收到事件。
- 如果剪贴板同时包含图片和来源 URL，资源物料仓库保存素材时记录 `sourceUrl`。
- 允许从素材灵感库网站详情直接添加备注，例如“适合电商主图参考”。

## 7. 设置项

建议在 Settings 中新增或扩展以下设置：

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| 素材库默认打开面板 | 资源物料仓库 | 也可记忆上次打开的 Tab |
| 素材库本地容量提醒 | 开启 | 未配置云存储时必须开启，不建议关闭 |
| 大批量导入提醒阈值 | 100 文件 / 500 MB | 可调整 |
| 素材库自动同步 | 关闭 | 用户确认云存储后可开启 |
| 同步范围 | 元数据 + 收藏素材 Blob | 避免默认同步全部大文件 |
| 灵感网站桌面默认打开方式 | 分区工作台 | 用户可改为 Drawer 或新标签页 |
| 分区工作台宽度 | `min(520px, 36vw)` 或上次宽度 | 支持左右拖动调整并本地记忆 |
| 分区工作台折叠状态 | false | 折叠后保留当前站点、搜索和选中素材 |
| 桌面 Drawer 方向 | right | 用于短任务和低频管理，支持 left/right/bottom |
| 移动端 Drawer 模式 | full-screen | 不建议改 |
| 全局功能菜单位置 | 右下角 | 记录用户拖动后的位置 |
| 重置功能菜单位置 | - | 恢复默认右下角 |
| 功能菜单展开方式 | 点击展开 | 可扩展为长按展开快捷操作 |

这些设置属于用户偏好，不应包含 API Key 或云存储 Secret。云存储 Secret 继续由现有云同步配置管理。

## 8. 跨端实现要求

### 8.1 Web

- 资源物料仓库本地 Blob 默认存 IndexedDB。
- 文件夹拖拽使用浏览器能力最佳努力实现，不保证所有浏览器可用。
- 外部打开使用 `openExternalUrl`。
- iframe 分区工作台和 Drawer 都不依赖 Next API Route，因此静态桌面导出不受影响。
- 全局浮动功能菜单必须使用固定定位和 safe-area 约束，不改变现有页面布局流。
- 分区工作台必须在前端布局层完成，使用 Pointer Events 支持左右拖动调整大小，并在当前视口下约束主工作台和辅助面板最小宽度。
- 云同步继续使用现有浏览器直连或服务器中转模式；任意新增 API Route 都必须考虑桌面静态导出不可用。

### 8.2 Tauri 桌面

- 涉及系统剪贴板、系统浏览器、本地目录枚举、本地文件打开、桌面素材目录读写时，通过 `src/lib/desktop-runtime.ts` 封装命令。
- 文件夹导入应优先走 Rust 命令，避免 WebView 对目录拖拽支持不稳定。
- 若使用本地素材目录，目录路径必须规范化，拒绝目录穿越；默认保存到应用数据目录。
- 云同步继续通过现有 Tauri S3 代理绕过 CORS。
- 外部网站打开在桌面端默认先尝试分区工作台内嵌，失败后用系统浏览器；低频管理和用户手动选择时可用 Drawer。

### 8.3 Tauri Android / 移动端

- 不要求文件夹拖拽。
- 全局浮动功能菜单在移动端仍默认右下角，但需要避开键盘、底部安全区和系统手势区域。
- 素材库面板和灵感 Drawer 需要全屏或接近全屏，避免在小屏上出现不可用的窄栏；移动端不启用左右分区工作台。
- 导入和恢复需要低并发，避免移动端内存峰值。
- 大素材预览必须懒加载，列表使用虚拟滚动。

## 9. 数据安全与隐私

1. 素材 Blob 不进入 `localStorage`、URL、日志或普通分享链接。
2. 导入素材可能包含隐私或版权信息，云同步开启前需要提示“将上传到你配置的对象存储”。
3. 默认不删除远端素材对象；远端删除必须依赖用户显式开启的云同步删除权限。
4. 不自动剥离 EXIF；可在后续提供“导入时移除图片元数据”选项。
5. 外部灵感网站链接不应包含用户第三方站点 Cookie、Token 或私密查询参数；导入/保存时可检测常见敏感 query key 并提醒用户。
6. iframe 不读取第三方页面 DOM，不注入脚本，不尝试绕过站点限制。
7. 导入 ZIP 或文件夹时要防路径穿越、zip bomb、符号链接越界和超大文件。
8. 所有删除操作使用项目内 Dialog/Notice，不使用原生确认弹窗。

## 10. 性能要求

- 素材列表使用虚拟滚动或分页，不能一次性渲染全部卡片。
- 缩略图懒加载，Object URL 要复用和及时 revoke。
- 导入、hash、缩略图生成、上传和恢复全部走异步队列。
- 批量导入默认低并发，例如图片读取 2-4 并发，移动端 1 并发。
- 不在首屏加载时扫描全部 Blob、计算 hash 或读取图片尺寸。
- 不在 IndexedDB schema 升级时给 Blob 表增加会触发全量扫描的索引。
- 文件夹导入先列清单，再按批次导入，进度可见且可取消。
- 云同步预览要有数量和体积统计，避免用户误触全量上传/恢复。

## 11. 实施阶段建议

### P0 - 本地可用闭环

- 新增全局浮动功能菜单，默认右下角，可拖拽、可多级展开、可通过 registry 接入功能项。
- 新增素材模块菜单分组，包含资源物料仓库和素材灵感库两个入口。
- 新增可复用分区工作台基础能力，桌面端支持右侧辅助面板、左右拖动调整大小、折叠、关闭、尺寸约束和本地记忆。
- 新增可复用 Drawer 组件，支持桌面右侧和移动全屏；素材模块通过 Drawer/Dialog 使用该基础组件。
- 资源物料仓库支持图片导入、拖拽、粘贴、从历史保存、分类、标签、收藏、搜索、预览和发送到编辑区。
- 素材库 Blob 存 IndexedDB，元数据分表保存。
- 未配置云存储时显示容量提醒和大批量导入提醒。
- 素材灵感库内置分类和站点，支持用户自定义链接、分类、搜索、外部打开。
- 素材灵感网站在桌面端通过分区工作台打开，移动端和低频管理通过可复用 Drawer 打开；iframe 失败时回退外部打开。
- 所有新增 UI 文案完成 i18n。

### P1 - 同步与迁移

- 资源物料仓库支持独立云同步 manifest、手动同步、恢复、选中同步和同步状态。
- 支持素材包 ZIP 导入导出。
- 支持文件夹导入，Web 最佳努力，Tauri 桌面走 Rust 命令。
- 支持批量编辑、批量删除、批量导出。
- 支持从素材库发送到图生文、图生视频和批量规划参考。
- 支持灵感库 JSON 导入导出和恢复默认内置站点。

### P2 - 高级管理

- 素材库自动同步队列、失败重试、离线恢复。
- 素材冲突可视化和 keep-both 策略。
- 桌面端素材目录外部打开、目录迁移和磁盘占用管理。
- 导入时图片压缩、格式转换、EXIF 清理。
- 站点打开历史、常用站点快捷入口。
- 全局功能菜单支持用户自定义菜单排序、隐藏低频入口和快捷动作。
- 更多素材类型预览和外部应用打开。

## 12. 关键风险与调整

| 风险 / 矛盾 | 调整方案 |
| --- | --- |
| “直接 iframe 打开外部网站”与第三方站点安全策略冲突 | iframe 只作为最佳努力；默认提供外部打开回退，不代理绕过 |
| 未配置云存储也允许添加大量素材，可能撑爆本地存储 | 本地模式可用但强提醒；提供容量估算、导入阈值、清理和云同步引导 |
| Web 文件夹拖拽不是标准能力，跨浏览器不稳定 | Web 最佳努力；Tauri 桌面用 Rust 目录枚举；移动端降级多选 |
| 资源物料仓库和历史区都保存图片，可能概念混乱 | 历史是任务记录，素材库是主动收藏；两者用“保存到素材库”建立单向副本 |
| 全局浮动按钮可能遮挡移动端内容或底部操作 | 默认使用 safe-area 和边界吸附；允许拖动、记忆位置和一键重置 |
| 多级菜单后续功能变多后可能失控 | 使用 registry、分组、排序、隐藏和搜索/过滤机制；移动端超过二级改用面板返回导航 |
| 大库同步会拖慢现有历史同步 | 素材库使用独立 manifest 和独立同步 scope |
| SVG、ZIP、PSD 等非普通图片存在安全或预览问题 | P0 只保证归档；预览和使用按类型白名单逐步开放 |
| 内置灵感站点可能需要登录、付费或地域访问 | 站点作为可编辑种子数据；发布前复核可访问性和条款；UI 明确版权自理 |

## 13. 验收标准

1. 用户不配置云存储，也能添加、分类、搜索、预览和使用少量素材。
2. 全局浮动功能菜单默认显示在右下角，可以拖动、记忆位置、边界约束和重置位置。
3. 全局浮动功能菜单支持至少二级展开，素材相关入口通过菜单分组打开，不改变现有工作台布局。
4. 用户拖入或粘贴图片后，可以保存到资源物料仓库，并再次一键发送到编辑区。
5. 用户从历史结果保存到素材库后，删除历史不会误删素材库副本。
6. 用户可以给素材设置分类、标签和收藏，并通过搜索/筛选找回。
7. 大批量导入会展示容量和规模提醒，不会无提示写入大量 Blob。
8. 素材库不把 Blob 写入 `localStorage`、分享 URL 或日志。
9. 素材灵感库展示内置分类和站点，用户可以新增、编辑、隐藏和搜索链接。
10. 桌面端打开灵感网站默认从右侧分区工作台出现，主工作台仍可粘贴源图、输入提示词和发起生成。
11. 用户可以左右拖动分区分隔线调整主工作台和右侧辅助面板大小，调整结果受最小/最大宽度约束并本地记忆。
12. 移动端打开素材功能仍覆盖完整视口，不出现不可用的窄分屏。
13. Drawer 是可复用基础组件，素材灵感库不能把 Drawer 逻辑写死在业务组件里；Drawer 主要承载短任务、低频管理和移动端降级。
14. iframe 被第三方站点拒绝时，用户能看到清晰失败态并外部打开。
15. 所有新增可见文案进入 i18n，浅色/深色主题、移动/桌面布局均通过检查。
16. Web 与 Tauri 桌面路径不依赖静态导出中不存在的 Next API Route。
17. 资源物料仓库同步、导入导出和删除操作有测试覆盖，并验证移动端不会触发全库 Blob 扫描。

## 14. 建议测试范围

- 单元测试：
  - 全局功能菜单 registry、排序、隐藏、禁用和多级展开模型。
  - 浮动菜单位置 normalize、边界约束和重置逻辑。
  - 分区工作台 pane 状态 normalize、宽度 clamp、折叠恢复和 resize handle 交互。
  - Drawer side、移动端全屏和基础状态渲染。
  - 素材元数据 normalize / migrate。
  - URL 安全校验。
  - 分类、标签、导入导出 JSON 合并。
  - ZIP manifest 路径安全校验。
  - 云同步 manifest roundtrip。
- 集成测试：
  - IndexedDB 导入、删除、去重和恢复。
  - 从历史保存到素材库，再从素材库发送到编辑区。
  - 未配置云存储下的大批量导入提醒。
  - 配置 S3 后素材库同步/恢复。
- UI/E2E：
  - 浅色/深色主题。
  - 全局浮动菜单默认右下角、拖动、展开、二级菜单和重置位置。
  - 桌面端分区工作台默认右侧打开，分隔线可拖动且刷新后宽度合理恢复。
  - 移动端全屏 Drawer。
  - 桌面端短任务右侧 Drawer。
  - iframe 失败回退外部打开。
  - 文件夹导入降级路径。
