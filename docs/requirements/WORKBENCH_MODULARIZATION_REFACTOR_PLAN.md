# 工作台大文件模块化重构规划

## 1. 背景

主工作台的核心路径长期集中在少数大文件中，导致阅读、评审和后续功能接入成本持续升高：

| 文件 | 当前职责 | 当前问题 |
| --- | --- | --- |
| `src/app/page.tsx` | 首页路由、配置加载、URL/share 初始化、生成任务、历史、同步、批量规划、分屏布局和弹窗编排 | 页面级状态和跨运行时副作用高度集中，任何功能改动都容易扩大回归面 |
| `src/components/settings-dialog.tsx` | 设置入口、供应商端点、模型目录、提示词润色、批量配置、图生文、同步、桌面设置 | 多个设置页面共用一个状态池，视图和业务操作交织 |
| `src/components/editing-form.tsx` | 工作台输入表单、提示词工具栏、源图、遮罩、高级参数、图生文和视频模式 | 表单状态、输入体验和高级参数 UI 混在单组件中 |

本规划是架构演进文档，不改变用户可见功能。拆分应尽量保持行为等价，并且分批提交，避免一次性重构造成难以定位的回归。

## 2. 已完成基线

第一阶段已完成一批低风险叶子组件拆分：

| 原文件 | 新模块 | 职责 |
| --- | --- | --- |
| `src/components/editing-form.tsx` | `src/components/editing-form/size-controls.tsx` | 尺寸选择按钮、供应商分辨率控件、OpenAI 场景化尺寸控件和相关纯工具 |
| `src/components/settings-dialog.tsx` | `src/components/settings/model-manager.tsx` | 模型管理弹窗、模型 option 类型、模型 ID 规范化与 option 合并 |
| `src/components/settings-dialog.tsx` | `src/components/settings/provider-endpoint-card.tsx` | 统一供应商端点卡片 |
| `src/components/settings-dialog.tsx` | `src/components/settings/secret-input.tsx` | API Key 密码输入和显示/隐藏切换 |

验证基线：

- `npm run lint` 通过。
- `npm run build` 通过；仍有既有的 `src/app/api/history-assets/route.ts` Turbopack broad-pattern 警告。
- `npm run build:desktop` 通过。
- 改动文件 TypeScript 诊断为 0。

## 3. 重构原则

1. **先搬叶子，后抽状态**：优先移动纯 UI 组件、纯函数和常量；状态 hook 化放到后续阶段。
2. **一次只改一个边界**：不要在同一提交里同时拆 UI、改状态模型、改业务行为。
3. **Web/Tauri 保持对等**：涉及 clipboard、外链、本地文件、代理、同步、历史和生成路径时，继续通过 `src/lib/desktop-runtime.ts` 或既有跨运行时封装处理。
4. **不新增硬编码文案债务**：若拆分时新增或修改可见文案，必须同步 `src/lib/i18n/*`；纯搬迁不改文案。
5. **不把 page 变成另一层转发泥球**：抽组件时同步定义清晰 props 边界，避免只是把 100 个 props 传到另一个大组件。
6. **每批可独立验证**：每个阶段至少跑 `npm run lint`、`npm run build`；触达桌面静态路径时跑 `npm run build:desktop`。

## 4. 目标目录结构

### 4.1 工作台页面

建议把 `page.tsx` 的页面级实现迁到 `src/features/workbench/`，让 `src/app/page.tsx` 最终只做路由入口：

```text
src/app/page.tsx

src/features/workbench/
  workbench-page.tsx
  workbench-header.tsx
  workbench-main-grid.tsx
  workbench-dialogs.tsx
  sync-confirmation-dialog.tsx
  batch-delete-dialogs.tsx
  hooks/
    use-workbench-config.ts
    use-workbench-history.ts
    use-workbench-sync.ts
    use-url-share-bootstrap.ts
    use-workspace-layout.ts
  utils/
    image-files.ts
    sync-scopes.ts
    url-share.ts
    video-defaults.ts
```

拆分后职责：

| 模块 | 职责 |
| --- | --- |
| `workbench-page.tsx` | 组合 hooks 和 UI，替代当前 `HomePage` 主体 |
| `workbench-header.tsx` | 顶部 logo、标题、主题、关于和设置入口 |
| `workbench-main-grid.tsx` | 左侧 `EditingForm`、右侧输出区、任务和历史区布局 |
| `workbench-dialogs.tsx` | 密码、secure share、共享配置、批量规划、素材库等页面弹窗编排 |
| `sync-confirmation-dialog.tsx` | 图片/图生文/全量同步确认弹窗 |
| `use-url-share-bootstrap` | URL 参数、secure share、共享配置选择、自动启动 |
| `use-workbench-sync` | S3 配置、自动同步队列、上传/恢复/删除远端图片 |
| `use-workbench-history` | 图片、图生文、视频历史加载、选择、删除、恢复到工作台 |
| `use-workspace-layout` | 分屏、右侧资源面板、响应式布局状态 |

### 4.2 设置对话框

建议继续沿用 `src/components/settings/`：

```text
src/components/settings-dialog.tsx

src/components/settings/
  settings-dialog.tsx
  settings-view-meta.ts
  provider-endpoint-templates.ts
  model-catalog-utils.ts
  model-manager.tsx
  provider-endpoint-card.tsx
  secret-input.tsx
  views/
    main-settings-view.tsx
    providers-view.tsx
    provider-endpoints-view.tsx
    image-endpoints-view.tsx
    video-endpoints-view.tsx
    model-catalog-view.tsx
    vision-text-settings-view.tsx
    polish-prompts-view.tsx
    batch-config-view.tsx
```

拆分后职责：

| 模块 | 职责 |
| --- | --- |
| `settings-dialog.tsx` | open/view/save/discard 总控 |
| `settings-view-meta.ts` | view 标题、描述、返回关系和导航元数据 |
| `provider-endpoint-templates.ts` | 文本/图片/视频端点模板、slug 和 endpoint id 生成 |
| `model-catalog-utils.ts` | catalog label、search text、filter option、binding option 构造 |
| `views/*` | 每个设置页面只负责渲染对应 view，不直接知道其他 view 的 JSX |

### 4.3 编辑表单

建议继续沿用 `src/components/editing-form/`：

```text
src/components/editing-form.tsx

src/components/editing-form/
  editing-form.tsx
  editing-form.types.ts
  size-controls.tsx
  prompt-editor.tsx
  prompt-toolbar.tsx
  prompt-history-picker.tsx
  prompt-polish-picker.tsx
  source-image-picker.tsx
  mask-editor.tsx
  advanced-options-dialog.tsx
  image-advanced-options.tsx
  vision-text-options.tsx
  video-options.tsx
  provider-options-editor.tsx
  hooks/
    use-prompt-draft.ts
    use-prompt-polish.ts
    use-slash-command.ts
    use-provider-advanced-options.ts
```

拆分后职责：

| 模块 | 职责 |
| --- | --- |
| `prompt-editor.tsx` | 文本框、draft banner、prompt history / template / polish 入口 |
| `prompt-toolbar.tsx` | 清空、润色、批量、图生文、视频、分享、历史等工具按钮 |
| `source-image-picker.tsx` | 源图上传、预览、删除、放大 |
| `mask-editor.tsx` | 蒙版上传、绘制、保存和状态提示 |
| `advanced-options-dialog.tsx` | 高级选项 Dialog 外壳 |
| `image-advanced-options.tsx` | 图片模型、尺寸、质量、背景、输出格式、压缩、审核 |
| `vision-text-options.tsx` | 图生文模型和输出参数 |
| `video-options.tsx` | 文生视频/图生视频模型和模式选择 |
| `provider-options-editor.tsx` | 自定义参数 JSON 和校验 |

## 5. 阶段计划

### Phase 1：`page.tsx` 纯拆分

目标：降低页面 JSX 和纯 helper 密度，不改同步/历史状态模型。

任务：

1. 抽 `utils/sync-scopes.ts`：`createEmptyAutoSyncScopes`、`hasAnyAutoSyncScope`、`intersectAutoSyncScopes`、`mergeAutoSyncScopes`、sync scope label。
2. 抽 `utils/video-defaults.ts`：`buildVideoSourceRole`、`pickVideoDefaultCatalogEntry`、`buildVideoGenerationParametersFromDefaults`。
3. 抽 `utils/image-files.ts`：文件 mime、fetchable image URL、browser-addressable 判断。
4. 抽 `workbench-header.tsx` 和 `workbench-dialogs.tsx`，先只移动 JSX。

验收：

- `src/app/page.tsx` 行数下降，仍可作为唯一入口。
- `npm run lint`、`npm run build`、`npm run build:desktop` 通过。
- 不新增用户可见文案。

### Phase 2：`settings-dialog` view 拆分

目标：让设置对话框主文件只负责状态和保存，视图 JSX 迁出。

任务：

1. 抽 `provider-endpoint-templates.ts` 和 `model-catalog-utils.ts`。
2. 抽 `views/providers-view.tsx`、`views/provider-endpoints-view.tsx`、`views/image-endpoints-view.tsx`、`views/video-endpoints-view.tsx`。
3. 抽 `views/model-catalog-view.tsx`。
4. 抽 `views/main-settings-view.tsx`、`views/vision-text-settings-view.tsx`、`views/batch-config-view.tsx`、`views/polish-prompts-view.tsx`。

验收：

- `settings-dialog.tsx` 不再直接包含大段 `settingsView === ...` JSX。
- 每个 view 的 props 命名以业务片段分组，避免单 view 传入过大的无结构对象。
- 端点新增、模型发现、模型绑定、配置保存和放弃变更流程行为不变。

### Phase 3：`editing-form` 交互块拆分

目标：把输入表单拆成可独立阅读的 UI 区块。

任务：

1. 抽 `prompt-editor.tsx` 和 `prompt-toolbar.tsx`。
2. 抽 `source-image-picker.tsx` 和 `mask-editor.tsx`。
3. 抽 `advanced-options-dialog.tsx`，再按图片、图生文、视频和 provider options 拆子内容。
4. 抽 `editing-form.types.ts`，统一导出 `EditingFormData`、`EditingFormHandle`、`WorkbenchTaskMode`。

验收：

- `editing-form.tsx` 主要保留状态组合、派生值和提交。
- 提示词 draft、润色、slash command、图片上传、遮罩和高级选项行为不变。
- 若移动了可见文案，必须补齐 i18n 或确认只是原文搬迁。

### Phase 4：hook 化状态和副作用

目标：在纯组件拆分稳定后，再提取状态机和副作用。

任务：

1. `use-url-share-bootstrap`：URL 参数、secure share、共享配置、自动启动。
2. `use-workbench-history`：图片/图生文/视频历史加载、选择、删除和恢复。
3. `use-workbench-sync`：同步配置、自动同步、防抖队列、上传/恢复/删除。
4. `use-prompt-draft`、`use-prompt-polish`、`use-slash-command`：编辑表单输入体验。

验收：

- hook 要有明确输入输出，避免直接持有所有页面状态。
- 涉及历史、同步、URL 分享和桌面路径时补充或更新测试。
- 保持移动端安全：不新增热路径全量扫描、阻塞 IO 或无界并发。

### Phase 5：props 与状态边界收敛

目标：减少跨组件的散装 props。

建议分组：

```ts
type EditingFormModelState = {
    editModel: EditingFormData['model'];
    setEditModel: React.Dispatch<React.SetStateAction<EditingFormData['model']>>;
    providerInstanceId: string;
    setProviderInstanceId: React.Dispatch<React.SetStateAction<string>>;
    videoCatalogEntryId: string;
    setVideoCatalogEntryId: React.Dispatch<React.SetStateAction<string>>;
};

type EditingFormImageState = {
    imageFiles: File[];
    sourceImagePreviewUrls: string[];
    setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
    setSourceImagePreviewUrls: React.Dispatch<React.SetStateAction<string[]>>;
};
```

原则：

- props 分组必须对应真实所有权，不为了减少行数而创建“大杂烩对象”。
- 优先在 `EditingForm` 内部子组件使用分组；对外 API 稳定后再改 `page.tsx` 调用。
- 若引入 context，只用于 settings view 或 form 子树内部，不引入全局 store。

## 6. 验证矩阵

| 改动类型 | 必跑验证 |
| --- | --- |
| 纯函数/常量搬迁 | `npm run lint`、`npm run build` |
| UI 子组件搬迁 | `npm run lint`、`npm run build`，涉及桌面静态入口时加 `npm run build:desktop` |
| 设置 view 拆分 | 配置加载、保存、放弃修改、导入导出、端点新增、模型发现、模型绑定 |
| 编辑表单拆分 | 文生图、图生图、图生文、文生视频、图生视频、提示词润色、历史选择、源图上传、遮罩 |
| 同步/history hook 化 | 本地历史、云同步上传/恢复/删除、移动端安全 lookup、Web/Tauri 分支 |
| 可见文案改动 | i18n 全语言资源同步，检查 `data-i18n-skip` 是否合理 |

## 7. 风险控制

| 风险 | 控制方式 |
| --- | --- |
| import cycle | 新模块只依赖上游基础组件和 `lib`，不要让 `settings-dialog.tsx` 与 view 互相 import |
| props 爆炸转移 | 每次抽 view 时同步定义 props 分组，禁止传入整个父组件状态包 |
| 行为回归难定位 | 每个 PR 只覆盖一个区域；纯搬迁提交不混入产品逻辑改动 |
| Web/Tauri 分支被拆散 | 桌面能力继续集中走 `desktop-runtime` 和 Rust command/proxy 层 |
| i18n 债务扩大 | 新文案必须同步 `src/lib/i18n/*`；搬迁旧文案时不改内容 |
| 性能回退 | 不在首屏、拖拽、历史恢复和大图预览路径新增同步重活 |

## 8. 推荐提交顺序

1. `refactor: split workbench page helpers`
2. `refactor: extract workbench dialogs`
3. `refactor: split settings provider views`
4. `refactor: split settings model catalog view`
5. `refactor: split editing form prompt controls`
6. `refactor: split editing form source image controls`
7. `refactor: extract workbench sync hook`
8. `refactor: group editing form state props`

每个提交都应在说明中标明“纯搬迁”或“状态边界调整”。只有状态边界调整需要更完整的手动回归说明。
