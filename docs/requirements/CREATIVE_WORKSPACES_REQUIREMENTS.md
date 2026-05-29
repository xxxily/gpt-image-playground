---
title: 创作工作空间需求文档
summary: 规划按主题、项目或客户隔离持续创作内容的工作空间能力，覆盖功能菜单入口、左右可停靠工作面板、历史与文件归属、工作空间级清空、严格删除确认、移动端降级、云存储同步恢复和组件化底座。
createdAt: 2026-05-29
status: proposed
relatedDocs:
  - ../workspace.md
  - ../history-and-assets.md
  - ./ASSET_LIBRARY_AND_INSPIRATION_HUB_REQUIREMENTS.md
  - ./CREATIVE_RESOURCE_SPLIT_WORKSPACE_REQUIREMENTS.md
  - ./WORKBENCH_MODULARIZATION_REFACTOR_PLAN.md
  - ./NETWORK_STORAGE_SYNC_RESEARCH.md
  - ./CLOUD_SYNC_IMPROVEMENT_AND_PROTOCOL_EXPANSION.md
---

# 创作工作空间需求文档

## 1. 背景与问题

当前 GPT Image Playground 的生成、编辑、图生文、视频生成和历史记录主要以全局时间线方式组织。所有创作结果都平铺在同一个历史区里，适合快速试验，但不适合围绕一个主题、客户、商品、角色设定或长期项目持续创作。

典型问题：

1. **主题连续性弱**：用户围绕某个主题连续生成时，中途插入的临时任务会混入同一历史流，后续很难只复盘这个主题的上下文。
2. **当前历史是任务时间线，不是项目容器**：历史卡片记录了单次任务，但没有表达“这些任务属于同一个创作空间”。
3. **工作区面板能力只服务素材**：右侧分区现在主要承载资源物料仓库和素材灵感库。若工作空间也只默认挤占右侧，会打断素材交互。
4. **移动端需要更强收敛**：小屏无法同时展示主工作台、素材面板和工作空间面板，需要全屏 Drawer 或完整弹窗承载。
5. **删除风险高**：工作空间删除会关联删除历史和文件，必须采用类似 GitHub 删除仓库的强确认，而不能使用普通确认按钮。

因此需要新增 **创作工作空间** 能力：用户可以创建多个工作空间，把生成历史、源图快照、视频任务、草稿和与该主题相关的资源引用组织在一起；进入某个工作空间后，主工作台和历史区默认只展示与该工作空间相关的内容。

## 2. 概念边界

为避免和现有文档中的 `workspace` 概念混淆，后续实现建议区分三个层次：

| 概念 | 建议英文名 | 含义 |
| --- | --- | --- |
| 主工作台 | `workbench` | 当前首页生成、编辑、输出和历史的主要操作界面 |
| 分区面板 / 辅助面板 | `dock panel` / `auxiliary pane` | 左右可停靠、可拖拽调整宽度的 UI 面板，例如素材库、工作空间面板 |
| 创作工作空间 | `creative workspace` | 用户按主题或项目创建的数据容器，隔离历史、文件归属和轻量创作草稿 |

本文中的“工作空间”默认指 **创作工作空间**，不是 `ResizableWorkspace` 这类分屏布局组件。

## 3. 目标

1. 在全局功能菜单中新增 **工作空间** 入口，用户可以快速查看、切换、创建、重命名、归档和删除工作空间。
2. 工作空间面板支持网格视图和列表视图，交互形态参考资源物料仓库，但信息更偏项目管理。
3. 用户进入某个工作空间后，生成历史、图生文历史、视频历史、批量任务结果和当前草稿默认只展示或写入该工作空间。
4. 新任务提交时必须捕获当时的 `workspaceId`；用户切换工作空间不应改变已排队或处理中任务的归属。
5. 删除工作空间时删除该工作空间拥有的所有本地历史和文件；远端文件删除必须遵守现有云同步显式删除权限。
6. 删除确认必须使用项目内 Dialog，并要求用户正确输入工作空间名称后才能执行。
7. 左侧也要具备与右侧同等级的可停靠面板能力。工作空间和素材资源都可以选择停靠在左侧或右侧。
8. 当工作空间和素材资源停靠在同一侧时，使用同侧面板 Tab / Activity Bar 管理；当停靠在不同侧时，可以左右同时显示。
9. 云存储同步、恢复、删除和清空必须保留工作空间约束，不能把恢复的历史统一塞回当前空间或默认空间。
10. 移动端和窄屏不做左右分屏，统一使用全屏 Drawer 或完整弹窗，并精简统计信息和低频管理入口。
11. 数据模型、组件边界和同步协议要为后续工作空间模板、导入导出、跨设备恢复和更多面板类型预留扩展点。

## 4. 非目标

- 不在首版实现多人协作、团队权限、成员邀请或审阅流。
- 不把工作空间等同于账号或租户；它是当前用户本地/同步数据的组织方式。
- 不把供应商 API Key、云存储 Secret 等敏感配置复制进工作空间。
- 不为不同工作空间设置不同的供应商、模型、比例、运行参数、云存储配置或同步策略。配置仍然是全局配置，工作空间只负责内容归属、过滤和轻量草稿。
- 不强制用户必须创建工作空间；旧用户继续通过默认工作空间使用应用。
- 不把资源物料仓库拆成每个工作空间完全独立的一份。素材库仍是长期可复用资源池，工作空间只建立引用或工作空间专属副本。
- 不在移动端强行同时显示主工作台、素材面板和工作空间面板。
- 不通过原生 `window.alert`、`window.prompt`、`window.confirm` 承载任何删除或命名交互。

## 5. 产品形态

### 5.1 全局功能菜单入口

全局浮动功能菜单新增一级入口：

```text
创作管理
├── 工作空间
└── 创作资源
    ├── 资源物料仓库
    └── 素材灵感库
```

行为要求：

- 点击 **工作空间** 时，桌面宽屏默认打开停靠面板；移动端默认全屏 Drawer。
- 菜单项支持二级打开方式：左侧打开、右侧打开、抽屉打开。
- 如果当前窗口宽度不足以分屏，选择左/右打开时自动降级为全屏 Drawer，并显示轻量 Notice。
- 菜单主点击使用用户最近一次偏好；首次默认右侧打开，避免突然改变现有素材入口习惯。
- 菜单项、说明、Notice、按钮和删除文案都必须进入 `src/lib/i18n/*`。

### 5.2 工作空间面板

工作空间面板首屏用于浏览和切换工作空间，核心元素：

- 顶部工具栏：标题、当前活动工作空间、搜索、新建、视图切换、更多操作。
- 视图切换：网格 / 列表，沿用素材库的密度和交互模式。
- 搜索筛选：按名称、描述、标签、状态、最近打开、最近更新筛选。
- 排序：最近打开、最近更新、创建时间、名称、收藏优先。
- 状态筛选：活动、已归档、全部。
- 工作空间卡片或列表行：名称、描述、封面、颜色/图标、更新时间、历史数量、文件体积、最近任务缩略图。
- 快捷操作：进入、重命名、收藏、归档/恢复、清空当前空间内容、删除。

网格视图适合视觉浏览；列表视图适合大量项目管理。两种视图都必须保持操作等价，不能只在某一种视图提供删除或进入。

### 5.3 进入工作空间

用户点击工作空间卡片的主区域或“进入”按钮后：

1. 设置 `activeWorkspaceId`。
2. 主工作台显示当前工作空间状态，例如标题旁的胶囊标签或输入区上方的轻量状态条。
3. 历史区默认只显示该工作空间的图片、图生文、视频和批量结果。
4. 新提交任务写入该工作空间。
5. 当前输出区可以选择保留不清空，但如果输出来自其他工作空间，需要显示来源提示，并提供“切换到该输出所属工作空间”或“保存副本到当前工作空间”。
6. 工作空间面板可以保持打开，便于继续切换；也可以由用户偏好设置为进入后自动收起。

建议保留一个虚拟视图 **全部工作空间**，用于跨项目检索和全局管理。但该视图必须明确标识为“全部”，不能作为默认创作目标；提交新任务时必须落到具体工作空间。

### 5.4 新建工作空间

新建 Dialog 字段建议：

| 字段 | P0 | 说明 |
| --- | --- | --- |
| 名称 | 必填 | 用于列表展示和删除确认；同一用户内建议不允许重名 |
| 描述 | 可选 | 说明主题、客户或项目背景 |
| 颜色 / 图标 | 可选 | 轻量识别，不引入复杂封面编辑 |
| 封面 | 可选 | 可以从最近结果或素材库选择，P0 可先用首张历史缩略图自动生成 |
| 初始方式 | 可选 | 空白、从当前输入创建、从当前历史创建 |

名称规则：

- trim 后不能为空。
- 同名工作空间默认不允许创建，减少删除确认和切换歧义。
- 长名称需要在卡片、列表、移动端标题中正确截断，不允许撑破容器。
- 保留名称例如“全部工作空间”“默认工作空间”不能被普通用户创建。

### 5.5 默认工作空间与兼容

为兼容现有用户，系统需要内置一个默认工作空间：

- 旧历史在加载时若没有 `workspaceId`，归入默认工作空间。
- 默认工作空间可以重命名和更换颜色，但不建议在 P0 直接硬删除。
- 用户可以对默认工作空间执行“清空内容”类危险操作，仍需输入名称严格确认。
- 如果当前活动工作空间被删除，应用切换到最近打开的其他工作空间；没有其他工作空间时回到默认工作空间。

这样可以避免旧数据迁移时破坏历史，同时让新功能不强迫用户先配置项目结构。

## 6. 左右停靠面板生态

### 6.1 面板能力升级

现有分区工作台已经规划右侧资源面板。工作空间功能需要把这个能力升级为通用 **左右停靠面板系统**：

```text
┌──────────────┬──────────────────────────────┬──────────────┐
│ 左侧停靠面板 │ 主工作台                     │ 右侧停靠面板 │
│ 工作空间/素材│ 输入、输出、历史、任务       │ 工作空间/素材│
└──────────────┴──────────────────────────────┴──────────────┘
```

核心规则：

- 左右两侧都支持打开、关闭、收起、拖拽调整宽度、键盘调整宽度和恢复默认宽度。
- 左右两侧都有独立最小宽度、最大宽度和上次宽度偏好。
- 主工作台必须有最低可用宽度；左右同时打开时，如果空间不足，优先折叠非活动面板或降级其中一个为 Drawer。
- 面板打开、切换、折叠和关闭不能重置主工作台表单、任务队列、输出区或历史选择。
- 面板布局偏好只本机保存，P0 不随云同步跨设备同步。

### 6.2 同侧与异侧组合

为了同时满足“最大灵活度”和可用性，建议采用以下规则：

| 用户选择 | 行为 |
| --- | --- |
| 工作空间左侧，素材右侧 | 左右同时显示，主工作台居中 |
| 工作空间右侧，素材左侧 | 左右同时显示，主工作台居中 |
| 工作空间和素材都在右侧 | 右侧停靠面板内以 Tab / Activity Bar 切换，不创建两个并排右栏 |
| 工作空间和素材都在左侧 | 左侧停靠面板内以 Tab / Activity Bar 切换 |
| 窄屏同时打开多个面板 | 保留当前活动面板，其余折叠或转 Drawer |

同侧多功能不建议堆叠多个窄栏，因为会快速挤压主工作台。更稳妥的是每一侧只有一个可调整宽度的 dock，dock 内部管理多个 panel tab。

### 6.3 推荐状态模型

建议把“停靠面板布局”和“创作工作空间数据”分开，避免类型混淆：

```ts
type DockSide = 'left' | 'right';
type DockPanelFeature = 'creative-workspaces' | 'asset-library' | 'inspiration-hub' | 'task-center' | 'sync-activity';

type DockPanelInstance = {
    id: string;
    feature: DockPanelFeature;
    side: DockSide;
    active: boolean;
    collapsed: boolean;
    order: number;
};

type DockSideState = {
    side: DockSide;
    open: boolean;
    collapsed: boolean;
    sizePx?: number;
    sizeRatio?: number;
    previousSizePx?: number;
    activePanelId?: string;
    panels: DockPanelInstance[];
};

type DockLayoutState = {
    version: 1;
    left: DockSideState;
    right: DockSideState;
    lastUpdatedAt: number;
};
```

现有 `WorkspaceLayoutState` 可以继续服务当前右侧资源面板，但新增工作空间时建议逐步迁移或包一层 adapter，避免未来继续把 `workspace` 同时用于布局和项目容器。

### 6.4 推荐组件拆分

```text
src/components/ui/docked-workbench-layout.tsx
src/components/ui/dock-panel-shell.tsx
src/components/ui/dock-resize-handle.tsx
src/components/app-dock-panel-registry.tsx
src/lib/dock-layout-preferences.ts
src/types/dock-layout.ts

src/components/workspaces/creative-workspaces-panel.tsx
src/components/workspaces/workspace-list.tsx
src/components/workspaces/workspace-card.tsx
src/components/workspaces/workspace-create-dialog.tsx
src/components/workspaces/workspace-delete-dialog.tsx
src/components/workspaces/workspace-status-chip.tsx
```

职责边界：

| 模块 | 职责 |
| --- | --- |
| `DockedWorkbenchLayout` | 左/中/右布局、响应式降级、尺寸约束 |
| `DockPanelShell` | 面板标题栏、Tab、收起、关闭、侧边工具栏 |
| `DockResizeHandle` | pointer/keyboard resize、iframe 覆盖层、双击恢复 |
| `app-dock-panel-registry` | 将工作空间、素材库等业务功能注册为可停靠面板 |
| `creative-workspaces-panel` | 工作空间列表、详情、切换、管理入口 |
| `workspace-delete-dialog` | 强确认删除流程和删除后状态回收 |

业务组件不直接操作布局尺寸；布局组件不理解工作空间历史和文件删除。

## 7. 数据模型

### 7.1 工作空间元数据

```ts
type CreativeWorkspaceStatus = 'active' | 'archived';

type CreativeWorkspace = {
    id: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    coverImageRef?: WorkspaceFilePointer;
    status: CreativeWorkspaceStatus;
    favorite?: boolean;
    order?: number;
    createdAt: number;
    updatedAt: number;
    lastOpenedAt?: number;
    lastTaskAt?: number;
    stats?: {
        imageHistoryCount: number;
        visionTextHistoryCount: number;
        videoHistoryCount: number;
        fileCount: number;
        totalBytes?: number;
    };
};

type CreativeWorkspaceState = {
    version: 1;
    activeWorkspaceId: string;
    workspaces: CreativeWorkspace[];
    tombstones?: CreativeWorkspaceTombstone[];
    updatedAt: number;
};
```

统计字段可以异步维护，不能为了显示列表在首屏扫描所有 Blob 或远端对象。

### 7.2 历史归属

现有历史类型需要增加可选字段，并在 normalize 时兼容缺失值：

```ts
type WorkspaceScopedMetadata = {
    workspaceId?: string;
    workspaceNameSnapshot?: string;
};
```

建议扩展对象：

- `HistoryMetadata`
- `VisionTextHistoryMetadata`
- `VideoHistoryMetadata`
- 批量任务结果和可恢复任务快照

归属规则：

- 加载旧数据时，没有 `workspaceId` 的历史归入默认工作空间。
- 保存新历史时必须写入提交时捕获的 `workspaceId`。
- 切换工作空间不会移动已有历史。
- 用户后续可以通过“移动到工作空间”把历史转移到其他工作空间，P0 可以先不做批量移动。
- 历史卡片在“全部工作空间”视图中显示工作空间名称或颜色标识。

### 7.3 文件指针与归属

删除工作空间必须知道哪些文件是该工作空间独占的。建议为工作空间相关文件建立轻量引用模型：

```ts
type WorkspaceFileOwner =
    | 'image-history-output'
    | 'image-history-source'
    | 'vision-text-source'
    | 'video-output'
    | 'video-source'
    | 'draft-source'
    | 'workspace-cover'
    | 'asset-copy';

type WorkspaceFilePointer = {
    id: string;
    workspaceId: string;
    owner: WorkspaceFileOwner;
    storageMode: 'fs' | 'indexeddb' | 'url' | 'tauri-local' | 'remote';
    filename?: string;
    path?: string;
    blobKey?: string;
    remoteKey?: string;
    mimeType?: string;
    size?: number;
    sha256?: string;
    createdAt: number;
    shared?: boolean;
};
```

P0 可以先从历史元数据和现有 `history-assets` 路径推导文件集合；P1 应补齐显式 `WorkspaceFilePointer` 表，降低删除、同步和导出时的扫描成本。

共享规则：

- 资源物料仓库里的素材默认是全局长期素材，工作空间只保存引用，不在删除工作空间时删除素材原件。
- 如果用户把素材复制为工作空间专属文件，则该副本归工作空间所有，可以随工作空间删除。
- 同一个物理 Blob 若被多个历史或工作空间引用，删除时只移除当前工作空间引用；没有其他引用后才删除底层文件。
- 远端对象删除必须沿用现有“显式允许远端删除”的策略，不能因为删除工作空间而绕过云同步安全开关。

### 7.4 轻量草稿

为了支持持续创作，工作空间应能保存轻量草稿。草稿只描述当前创作上下文，不保存供应商、模型、比例、运行参数、同步配置等全局配置：

```ts
type CreativeWorkspaceDraft = {
    workspaceId: string;
    prompt?: string;
    mode?: 'generate' | 'edit' | 'vision-text' | 'video';
    sourceImageRefs?: WorkspaceFilePointer[];
    updatedAt: number;
};
```

要求：

- 文本、模式和可持久化源图引用可以自动保存。
- 源图文件不能写入 `localStorage`；仅保存引用或放入 IndexedDB / Tauri 本地文件后再引用。
- API Key、云存储 Secret、分享密码、供应商实例、模型选择、比例、质量、并发、代理、同步策略等配置不能进入工作空间草稿。
- 切换工作空间时，P0 至少恢复提示词和模式；源图恢复可以按已有持久化能力渐进实现。

### 7.5 全局配置不分空间

工作空间只解决内容归属和创作连续性，不承担配置分叉。以下配置继续保持全局一份：

- 供应商端点、API Key、OpenAI 兼容 Base URL 和代理策略。
- 图片、图生文、视频模型默认值和模型目录。
- 图片比例、质量、背景、输出格式、审核、视频参数等运行参数。
- 批量任务配置、提示词润色配置、同步配置、桌面设置和展示内容接口来源。
- 云存储 Bucket、Prefix、访问凭据、自动同步开关和远端删除权限。

如果用户希望某个空间复用一组输入，可以通过提示词模板、历史重试、复制历史到当前工作空间或后续“工作空间模板”解决，而不是给每个工作空间复制一套系统配置。

## 8. 历史区行为

### 8.1 工作空间过滤

历史区默认跟随 `activeWorkspaceId`：

- 图片历史：只显示当前工作空间生成/编辑结果。
- 图生文历史：只显示当前工作空间分析记录。
- 视频历史：只显示当前工作空间视频任务和结果。
- 批量任务：批量中的每个子任务都继承提交时的工作空间。

空状态不能直接显示全局示例历史，而应提示“当前工作空间暂无历史”，并提供：

- 新建一次生成。
- 从全部工作空间查看。
- 从其他工作空间移动历史。
- 打开资源物料仓库选择素材继续创作。

### 8.2 全部工作空间视图

需要保留跨空间检索能力：

- 历史区或工作空间面板提供“全部工作空间”虚拟视图。
- 在该视图中历史卡片显示所属工作空间。
- 用户可以从全局视图进入某条历史所属工作空间。
- 全局视图不能作为新任务保存目标；提交按钮附近必须提示当前实际目标工作空间。

### 8.3 清空与批量删除

引入工作空间后，所有“清空历史”“清空任务结果”“清空视频历史”这类危险操作都必须变成工作空间感知行为。

默认规则：

- 用户位于具体工作空间时，清空只作用于当前工作空间的历史、任务结果、草稿和工作空间专属文件。
- 清空当前工作空间不能删除其他工作空间的历史，不能删除全局资源物料仓库原件。
- 清空当前工作空间需要项目内确认 Dialog，文案明确显示当前工作空间名称和将清空的内容范围。
- 如果清空会删除本地文件，需要展示数量和估算体积；如果有运行中任务，需要阻止清空或要求先取消任务。
- 如果启用了云同步，清空本地当前工作空间后必须写入当前工作空间的 clear marker，而不是工作空间 tombstone，避免下次恢复又把已清空的历史带回来。
- 远端对象删除仍然受“允许远端删除”开关控制；未启用远端删除时，清空只移除本地历史和本地引用，但同步 manifest 要记录这些条目已在当前工作空间被清空。

全局清空必须降级为低频危险操作：

- 只有在“全部工作空间”管理视图或设置危险区中出现。
- 文案必须明确“清空全部工作空间”，不能沿用泛泛的“清空历史”。
- 需要比当前工作空间清空更强的确认，例如输入应用指定短语或二次确认。
- 默认产品路径不应引导用户执行全局清空。

### 8.4 任务队列

任务提交时捕获：

```ts
type WorkspaceTaskScope = {
    workspaceId: string;
    workspaceNameSnapshot: string;
};
```

行为：

- 排队、处理中、重试和完成都使用任务提交时的工作空间。
- 用户切换工作空间后，任务列表可以继续显示所有运行中任务，但要标识所属工作空间。
- 任务完成后，如果当前工作空间不是任务所属工作空间，不应把结果插入当前历史流；可以显示全局 Notice 或任务卡提醒。
- 重试任务默认仍写入原工作空间，除非用户明确选择“复制到当前工作空间重试”。

## 9. 删除工作空间

### 9.1 删除入口

删除入口只出现在工作空间卡片更多菜单、详情页危险区或归档列表中。不能把删除作为主操作按钮。

删除前建议先提供更安全动作：

- 归档工作空间。
- 导出工作空间。
- 只清空历史但保留空间。

### 9.2 强确认 Dialog

删除 Dialog 采用类似 GitHub 删除仓库的确认方式：

1. 标题明确显示正在删除的工作空间。
2. 正文说明删除不可恢复，并列出将删除的内容数量。
3. 显示工作空间准确名称，要求用户在输入框中完整输入。
4. 输入值与名称完全匹配前，删除按钮禁用。
5. 若存在运行中任务，禁止删除，并提供取消任务或稍后再删。
6. 若远端同步中存在对象，显示远端删除策略和当前权限状态。
7. 删除按钮使用危险样式，文案明确，例如“永久删除工作空间”。

示例文案方向：

```text
你正在删除工作空间「春季新品海报」。
这会删除该工作空间下的图片历史、图生文历史、视频历史、草稿和工作空间专属文件。资源物料仓库中的全局素材不会被删除，除非它们是该工作空间的专属副本。

此操作无法撤销。请输入 春季新品海报 以确认删除。
```

所有文案必须走 i18n。工作空间名称属于用户数据，展示时使用 `data-i18n-skip` 或等价处理。

### 9.3 删除执行

删除过程应是可恢复状态机，而不是同步大函数：

```ts
type WorkspaceDeletionPlan = {
    workspaceId: string;
    localHistoryIds: string[];
    localFilePointers: WorkspaceFilePointer[];
    remoteKeys: string[];
    sharedFilePointers: WorkspaceFilePointer[];
    blockedReasons: string[];
};

type WorkspaceDeletionStatus =
    | 'planning'
    | 'blocked'
    | 'deleting-history'
    | 'deleting-local-files'
    | 'deleting-remote-files'
    | 'writing-tombstone'
    | 'completed'
    | 'partial-failed';
```

执行要求：

- 先生成删除计划并展示摘要，再执行。
- 删除历史元数据和删除文件分阶段进行，任何阶段失败都要留下可诊断状态。
- 本地文件删除失败时，工作空间不应静默消失；显示部分失败并提供重试。
- 已删除工作空间写入 tombstone，避免后续云恢复把它重新带回来。
- 删除后如果当前工作空间被移除，切换到默认或最近打开工作空间。
- 删除不能阻塞 UI 主线程；文件删除、IndexedDB 删除和远端删除都走异步队列。

## 10. 同步、导入导出与迁移

### 10.1 本地兼容迁移

首版迁移原则：

- 不做破坏性一次性迁移。
- 旧历史没有 `workspaceId` 时，在 normalize 层归到默认工作空间。
- 当用户保存历史或执行同步时，再逐步写入 `workspaceId`。
- 不扫描所有 Blob，不重新计算全部 hash，不阻塞首屏。

### 10.2 云同步

工作空间同步不是可选增强；只要工作空间功能上线，现有云存储同步、恢复和清空路径都必须理解 `workspaceId`。否则用户从云端恢复后，历史会重新混回全局时间线，工作空间隔离会被破坏。

建议新增独立工作空间 manifest，并与现有历史 manifest 通过 `workspaceId` 关联：

```text
{basePrefix}/workspaces/v1/manifest.json
{basePrefix}/workspaces/v1/tombstones.json
{basePrefix}/workspaces/v1/clear-markers.json
{basePrefix}/workspaces/v1/{workspaceId}/draft.json
{basePrefix}/workspaces/v1/{workspaceId}/files-manifest.json
```

历史和资产对象可以继续使用既有云存储路径，但 manifest 必须保留工作空间归属。若后续调整对象路径，建议把工作空间放入路径前缀，便于按空间定点恢复和清理：

```text
{basePrefix}/history/v2/workspaces/{workspaceId}/image-history.json
{basePrefix}/history/v2/workspaces/{workspaceId}/vision-text-history.json
{basePrefix}/history/v2/workspaces/{workspaceId}/video-history.json
{basePrefix}/history-assets/v2/workspaces/{workspaceId}/{assetKey}
```

如果为了兼容继续使用旧路径，也必须在 manifest entry 上保存 `workspaceId`，不能只靠路径推断。

推荐 manifest 结构：

```ts
type WorkspaceCloudManifest = {
    version: 1;
    snapshotId: string;
    createdAt: number;
    deviceId: string;
    activeWorkspaceId?: string;
    workspaces: CreativeWorkspace[];
    historyScopes: Array<{
        workspaceId: string;
        imageHistoryCount: number;
        visionTextHistoryCount: number;
        videoHistoryCount: number;
        updatedAt: number;
    }>;
    tombstones: CreativeWorkspaceTombstone[];
    clearMarkers: WorkspaceClearMarker[];
};

type WorkspaceClearMarker = {
    workspaceId: string;
    clearedAt: number;
    deviceId: string;
    scopes: Array<'image-history' | 'vision-text-history' | 'video-history' | 'drafts' | 'workspace-files'>;
};
```

同步范围要求：

- 同步 UI 需要提供 **当前工作空间** 和 **全部工作空间** 两个明确范围；在具体工作空间内触发同步时默认只同步当前工作空间。
- “最近历史”“完整历史”等既有范围需要叠加工作空间过滤，不能在当前工作空间同步时上传其他空间历史。
- 工作空间元数据、工作空间 tombstone、clear marker 必须随同步上传；布局偏好、左右 dock 宽度不参与云同步。
- 历史 manifest 中必须保留 `workspaceId` 和 `workspaceNameSnapshot`；恢复时按原 `workspaceId` 归档历史。
- 文件上传队列按 `workspaceId` 分组，进度文案显示当前同步的是哪个工作空间。
- 全局素材库仍走素材库独立同步范围；工作空间只同步全局素材引用或工作空间专属副本的文件指针。

恢复要求：

- 恢复前先恢复工作空间 manifest，再恢复历史和文件；不能先把历史恢复到当前活动工作空间。
- 如果远端历史引用的 `workspaceId` 本地不存在，应恢复对应工作空间元数据；若 manifest 缺失该空间，只能创建“已恢复工作空间”占位，而不是放入默认工作空间。
- 旧云快照没有 `workspaceId` 时，才允许归入默认工作空间，并在恢复摘要中说明这是 legacy 数据。
- 当前工作空间恢复只读取该空间 manifest 和文件指针，不扫描或恢复全部工作空间。
- 全部工作空间恢复要保留每条历史原有 `workspaceId`，并合并同 id 工作空间，不能按名称粗暴合并。
- tombstone 和 clear marker 优先级高于旧历史 manifest；被删除或已清空的工作空间内容不能在后续恢复中自动回流。

删除和清空要求：

- 删除工作空间后写 tombstone；恢复时 tombstone 优先于旧 manifest。
- 远端文件删除继续受云同步“允许远端删除”开关控制。
- 如果远端删除未启用，本地删除工作空间后可以保留远端对象，但本地 manifest/tombstone 必须避免下次恢复误导用户。
- 清空当前工作空间后写 `WorkspaceClearMarker`；同步恢复时以 marker 过滤该空间在 `clearedAt` 之前的被清空 scope。
- 清空全部工作空间才允许写全局 clear marker；普通“清空历史”入口不能生成全局清空。

冲突要求：

- 同一 `workspaceId` 在多端修改时，按 `updatedAt` 合并元数据，历史采用 append-mostly 去重。
- 同名但不同 id 的工作空间不能自动合并，恢复摘要中提示用户后续手动整理。
- 远端存在本地已删除工作空间时，tombstone 胜出；用户可在恢复摘要中选择“恢复已删除工作空间”，该行为必须显式触发。

### 10.3 导入导出

P1 建议支持工作空间包：

```text
gpt-image-playground-workspace-v1.zip
├── workspace.json
├── history/
│   ├── image-history.json
│   ├── vision-text-history.json
│   └── video-history.json
├── drafts/
│   └── draft.json
└── files/
    └── ...
```

安全要求：

- ZIP 导入防 zip slip、zip bomb、超大文件和未知 MIME。
- 导入时默认创建新工作空间，不覆盖同名空间。
- 导入包中的 API Key、Secret 等敏感字段即使存在也必须忽略。
- 工作空间导出可以选择“仅元数据”和“包含文件”。

## 11. 移动端与窄屏

移动端不启用左右停靠分屏：

- 工作空间入口打开全屏 Drawer。
- 首屏只显示搜索、新建、当前空间、网格/列表和核心统计。
- 卡片信息精简为名称、最近更新、历史数量和主操作。
- 删除、导入导出、归档等低频操作放入更多菜单和二级页面。
- 进入工作空间后 Drawer 可自动关闭，并在主工作台顶部显示当前工作空间。
- 手机软键盘出现时，底部操作按钮必须避开 safe-area 和键盘遮挡。
- Drawer 返回/关闭要接入现有 dialog history 行为，移动端系统返回键可关闭面板。

平板和窄桌面建议：

| 宽度条件 | 行为 |
| --- | --- |
| `< 900px` | 强制全屏 Drawer |
| `900px - 1199px` | 默认 Drawer，允许手动开启一个侧边 dock |
| `>= 1200px` | 默认支持左右 dock |
| 左右 dock 打开后主工作台 `< 560px` | 折叠非活动 dock 或转 Drawer |

## 12. 设置与用户偏好

工作空间不新增一套独立业务配置。Settings 中的供应商、模型、运行参数、同步、桌面、展示内容等仍然是全局配置。工作空间相关设置只允许保存 UI 偏好和活动状态：

| 偏好 | 默认值 | 是否同步 |
| --- | --- | --- |
| 上次活动工作空间 | 默认工作空间 | 可同步，但恢复时要兼容缺失空间 |
| 工作空间面板默认打开侧 | 右侧 | 不同步 |
| 素材面板默认打开侧 | 右侧 | 不同步 |
| 左侧 dock 宽度 / 折叠状态 | 上次有效值 | 不同步 |
| 右侧 dock 宽度 / 折叠状态 | 上次有效值 | 不同步 |
| 工作空间列表视图 | 网格 | 可本地保存 |
| 新任务是否自动使用当前工作空间 | 开启 | 可同步 |
| 进入工作空间后是否关闭面板 | 桌面关闭否，移动关闭是 | 本地保存 |

偏好必须 normalize。非法 `workspaceId`、无效 dock side、过大宽度、过小宽度都回到安全默认。

不得新增“按工作空间覆盖模型”“按工作空间覆盖云存储”“按工作空间覆盖高级参数”之类设置。需要复用某套创作输入时，应通过模板、历史复制或草稿解决。

## 13. 架构与模块化建议

### 13.1 核心模块

```text
src/types/creative-workspace.ts
src/lib/creative-workspace-store.ts
src/lib/creative-workspace-history.ts
src/lib/creative-workspace-drafts.ts
src/lib/creative-workspace-deletion.ts
src/lib/creative-workspace-sync.ts
src/hooks/useCreativeWorkspaces.ts
src/hooks/useActiveWorkspace.ts
src/hooks/useWorkspaceScopedHistory.ts
```

职责：

| 模块 | 职责 |
| --- | --- |
| `creative-workspace-store` | load/save/normalize 工作空间元数据和活动空间 |
| `creative-workspace-history` | 给图片、图生文、视频历史补 workspace 归属和过滤 |
| `creative-workspace-drafts` | 保存和恢复工作空间草稿，不保存敏感配置 |
| `creative-workspace-deletion` | 生成删除计划、执行本地/远端删除、写 tombstone |
| `creative-workspace-sync` | manifest、恢复、冲突和 tombstone 合并 |
| `useWorkspaceScopedHistory` | 页面层按活动工作空间读取和写入历史 |

### 13.2 与主工作台拆分协同

工作空间会触达 `src/app/page.tsx`、历史、任务、同步和分屏布局。应与工作台模块化规划协同：

- 先在 `src/features/workbench/` 收敛页面状态边界，再接入工作空间状态。
- `use-workbench-history` 后续应接受 `activeWorkspaceId`，并返回当前空间历史和全局历史两套能力。
- `use-workspace-layout` 或后续 dock layout hook 只管理面板布局，不直接读取创作工作空间数据。
- 任务管理 hook 提交任务时接收 `WorkspaceTaskScope`，不要在执行器内部读全局活动空间。

## 14. 跨运行时要求

### 14.1 Web

- 工作空间元数据和历史归属可以先保存在 localStorage，但 Blob 和源图草稿必须走 IndexedDB 或既有 history asset 通道。
- 删除文件时复用现有 `/api/image-delete`、IndexedDB 删除和历史资产删除封装。
- 新增 API Route 必须考虑桌面静态导出不可用；核心工作空间能力不能依赖 Node-only 服务。

### 14.2 Tauri 桌面

- 本地文件删除、打开目录、系统剪贴板和外部链接都通过 `src/lib/desktop-runtime.ts` 封装。
- 如果工作空间后续支持桌面本地目录，每个工作空间目录必须在应用数据目录或用户明确选择目录下，拒绝路径穿越。
- 删除工作空间的本地文件必须走 Rust command，并返回逐项结果，前端显示部分失败和重试。

### 14.3 Tauri Android

- 不启用左右 dock。
- 删除和导入导出要低并发，避免移动端内存峰值。
- 大量文件统计必须异步分页，不在 Drawer 打开时扫描全部文件。

## 15. 实施阶段

### P0 - 本地工作空间闭环

- 新增 `CreativeWorkspace` 类型、默认工作空间、元数据 store 和 normalize。
- 在功能菜单中新增工作空间入口。
- 新增工作空间面板，支持网格/列表、搜索、新建、进入、重命名、归档和删除。
- 新任务写入 `workspaceId`，图片/图生文/视频历史按活动工作空间过滤。
- 任务提交时捕获工作空间归属，切换工作空间不影响运行中任务。
- 现有云同步和恢复路径必须写入并保留 `workspaceId`；当前工作空间内触发同步/恢复/清空时只作用于当前工作空间。
- 清空历史、清空视频历史、清空任务结果等危险操作默认只清空当前工作空间，不能误删其他工作空间内容。
- 删除用户创建的工作空间需要输入名称强确认，并删除本地历史和工作空间专属本地文件。
- 升级分区布局为左右 dock 基础能力；素材和工作空间都可选择左/右打开，同侧使用 Tab 管理。
- 移动端工作空间使用全屏 Drawer。
- 完成 i18n、浅色/深色、桌面/移动基本验证。

### P1 - 持续创作体验

- 工作空间草稿自动保存和恢复，包括提示词、模式和可持久化源图引用。
- 历史移动到其他工作空间、从当前历史创建工作空间、复制工作空间名称/描述/标签等结构信息。
- 工作空间统计、封面、收藏、归档列表和批量管理。
- 工作空间导入导出包。
- 工作空间元数据、历史归属、clear marker 和 tombstone 参与云同步，支持按当前工作空间或全部工作空间恢复。
- 删除工作空间时支持远端对象删除计划，但继续要求显式远端删除权限。

### P2 - 高级生态

- 工作空间模板，例如电商主图、角色设定、品牌海报、短视频封面；模板只预置内容结构和提示词，不覆盖全局模型或运行配置。
- 工作空间仪表盘：成本、任务数量、常用模型、最近素材、生成成功率。
- 多工作空间搜索和跨空间引用图谱。
- 评估团队协作和共享工作空间，但需要独立权限设计。

## 16. 风险与约束

| 风险 | 调整方案 |
| --- | --- |
| “工作空间”与现有分屏 `workspace` 命名冲突 | 产品文案使用“创作工作空间”，代码类型使用 `CreativeWorkspace`；布局层使用 `Dock` / `Panel` |
| 删除工作空间误删全局素材 | 明确区分 workspace-owned 文件和 asset-library 全局素材引用 |
| 远端对象删除绕过安全开关 | 远端删除继续受现有显式权限控制，并在删除计划中单独展示 |
| 云恢复后历史丢失工作空间归属 | 云端 manifest 和每条历史都保存 `workspaceId`，恢复先建工作空间再归档历史 |
| 当前工作空间清空误删全局历史 | 所有清空入口默认按当前 `activeWorkspaceId` 过滤，全局清空只能在专门危险区触发 |
| 为每个工作空间复制配置导致复杂度失控 | 明确工作空间不覆盖供应商、模型、比例、同步等全局配置，只保存内容和轻量草稿 |
| 左右面板同时打开挤压主工作台 | 设置主工作台最小宽度，空间不足时折叠非活动 dock 或降级 Drawer |
| 旧历史没有 workspaceId | normalize 层归入默认工作空间，渐进写回 |
| 工作空间统计导致首屏变慢 | 统计异步缓存，不扫描 Blob 和远端对象 |
| 切换工作空间后运行中任务归属混乱 | 提交时捕获 `workspaceId`，任务生命周期不读当前活动空间 |
| 移动端信息过密 | 全屏 Drawer + 精简卡片 + 二级危险操作 |

## 17. 验收标准

1. 用户可以从全局功能菜单打开工作空间面板。
2. 桌面端用户可以选择工作空间面板停靠左侧或右侧。
3. 素材面板和工作空间面板可以分别停靠左右两侧并同时显示。
4. 素材面板和工作空间面板选择同一侧时，以同侧 Tab / Activity Bar 切换，不挤出多个窄栏。
5. 用户可以用网格或列表查看工作空间，并创建、进入、重命名、归档和删除。
6. 进入工作空间后，新生成的图片、图生文记录、视频记录和批量结果都写入当前工作空间。
7. 当前工作空间历史区不会混入其他工作空间的历史。
8. “全部工作空间”视图能跨空间检索，并清晰展示每条历史所属工作空间。
9. 删除工作空间必须输入准确名称；名称不匹配时按钮禁用。
10. 删除工作空间会删除该空间拥有的本地历史和专属文件，但不会删除全局素材库原件。
11. 存在运行中任务时不能删除对应工作空间，或必须先取消任务。
12. 当前工作空间内执行清空时，只清空当前工作空间内容，不影响其他工作空间历史。
13. 云同步上传和恢复后，每条历史仍保留原工作空间归属；旧无归属快照才进入默认工作空间。
14. 工作空间功能不新增按空间覆盖供应商、模型、比例、云存储或运行参数的配置。
15. 旧用户首次打开应用时，历史归入默认工作空间且不丢失。
16. 移动端打开工作空间为全屏 Drawer，布局不横向溢出，底部操作不被安全区遮挡。
17. 所有新增 UI 文案完成多语言资源覆盖。
18. 浅色和深色主题下，工作空间卡片、删除 Dialog、dock 面板和状态标签都可读。

## 18. 建议测试范围

- 单元测试：
  - `CreativeWorkspace` normalize、默认工作空间补齐、非法状态回退。
  - `workspaceId` 缺失历史归入默认空间。
  - 历史按 `activeWorkspaceId` 过滤。
  - dock side 偏好 normalize、宽度 clamp、同侧 panel tab 选择。
  - 删除确认名称匹配、运行中任务阻断、删除计划生成。
  - 当前工作空间 clear marker 生成、恢复过滤和全局清空隔离。
  - 云同步 manifest 中 `workspaceId`、tombstone、clear marker 的 normalize 和合并。
  - workspace-owned 文件与全局素材引用的删除判断。
- 集成测试：
  - 创建工作空间 -> 进入 -> 生成图片 -> 历史只出现在该空间。
  - 切换工作空间后，旧空间历史不出现在新空间。
  - 提交任务后立刻切换空间，任务完成仍写入原空间。
  - 当前工作空间清空后，其他工作空间历史仍存在。
  - 当前工作空间同步/恢复后，历史仍回到原工作空间，不混入当前活动空间。
  - 删除工作空间后，本地历史和文件引用被清理，默认空间自动接管。
  - 素材面板和工作空间面板左右同时打开、同侧切换。
  - 旧历史数据加载后显示在默认工作空间。
- UI/E2E：
  - 桌面宽屏左工作空间 + 右素材面板同时显示，主工作台仍可输入和生成。
  - 窄屏从分屏降级到 Drawer，不产生页面级横向滚动。
  - 移动端工作空间 Drawer 的创建、进入、删除确认流程可用。
  - 删除 Dialog 在浅色/深色主题下危险态清晰，输入长工作空间名称不溢出。
  - i18n 资源完整性测试覆盖新增 key。
