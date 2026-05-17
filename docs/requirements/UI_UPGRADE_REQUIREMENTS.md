---
title: GPT Image Playground UI 升级整改需求文档
summary: 基于代码审计与实际渲染审查，规划一轮系统性 UI 升级，让整体布局更简洁大气、主题与响应式表现统一，覆盖 Web、Tauri 桌面、Tauri 移动端三种运行时和深浅主题。
createdAt: 2026-05-17
updatedAt: 2026-05-17
status: v2-shipped-v3-pending
---

# GPT Image Playground UI 升级整改需求文档

> **状态总览**（2026-05-17 第 2 次更新）
>
> - ✅ **V1 已交付**（commits 4364484、2ad2db6、0c61240）：tokens + 5 个 primitives + 5 张主卡片 token 化 + 主页头简化 + 装饰元素移除。
> - ✅ **V2 已交付**（commits f33a088、8916c96）：新增 Popover primitive；token cleanup 推到 9 个对话框/外围组件；**globals.css 浅色补丁层被彻底删除**（306 → 222 行，−84 行）；hardcoded 白/黑色用法 ~370 → ~71 处（剩下都是品牌按钮 saturated bg 或图片覆盖层这类合理保留）；zoom-viewer 关闭按钮迁到 IconButton overlay variant。
> - 🔁 **V3 待开工**：三大对话框的内联 `<button>` → IconButton + Popover 结构性改造、history-panel 卡片图标按钮升 ≥ 40×40、Spinner / EmptyState 全应用接入、Heading primitive、Admin 移动端响应式。
> - 已落地的 V2 验证：`npm run lint` 仅有用户 WIP 的预先错误；`npm run build` 4.8s 成功；`npm run test` 503/503；4 种主题/尺寸组合实测装饰 blob = 0、cards token 渲染正确、settings 对话框打开后无浅色补丁层下显示正常、zoom-viewer overlay 按钮 a11y focus 正确。
>
> 图例：✅ 已完成 ｜ 🔁 待执行 ｜ ⏸ 暂不在路线图


# GPT Image Playground UI 升级整改需求文档

> **状态总览**（2026-05-17 更新）
>
> - ✅ **V1 已交付**：Phase 1（token + 5 个 primitives + 断点工具）、Phase 2（layout 去装饰 + 主页头简化 + 5 张主卡片 token 化）。
> - 🔁 **V2 待开工**：Phase 3（三大对话框迁移）、Phase 4（移动端尺寸 / a11y / overlay）、Phase 5（删除 globals.css 浅色补丁层 + 终态回归）。
> - 已落地的 V1 验证：`npm run lint` ✅；`npm run build` 5.1s 成功；`npm run test` 503/503；4 种主题/尺寸组合实测装饰 blob = 0、标题渐变去除、token 渲染正确、零 console error。
> - 5 个 V1 开放问题已全部决策完毕，详见第 12 节。
>
> 图例：✅ V1 已完成 ｜ 🔁 V2 待执行 ｜ ⏸ 暂不在路线图

## 1. 背景与现状

经过对 `src/app/`、`src/components/`、`src/components/ui/` 和 `src/app/globals.css` 的系统审计，并结合实际运行时（dev server, 1440×900 桌面态 / 390×844 移动态，浅色 + 深色）观察到的渲染行为，当前 UI 存在以下结构性问题：

### 1.1 主题层：暗色优先 + 浅色补丁

设计 token 系统其实已经搭得不错：

- `src/app/globals.css` 用 oklch 色彩空间定义了完整的 `--background / --foreground / --card / --primary / --muted / --border / --ring` 等 30+ 个 token，并通过 `@theme inline` 映射到 Tailwind 4 的工具类。
- 自定义了语义层 `--app-panel-surface / --app-panel-subtle / --app-panel-soft / --app-panel-border / --app-panel-shadow`。
- 自定义 `ThemeProvider`（`src/components/theme-provider.tsx`，186 行，未使用 next-themes）以 class 方式切换 `light` / `dark`，并在 `<head>` 注入 BeforeInteractive 脚本避免主题闪烁。

但实际组件层并没有按这套 token 写：

- `text-white` 在 src/components 中出现 **299 次**，分布在 23 个文件。
- `bg-white` 出现 **143 次**，分布在 21 个文件。
- `bg-black` 出现 37 次，`text-black` 出现 12 次。
- 重灾区是 `prompt-templates-dialog.tsx`（71 + 35）、`editing-form.tsx`（54 + 24）、`generation-form.tsx`（32 + 17）。
- 还存在写死的 hex 色：`#000000`、`#11111b`、`#12121d`、`#13131f`，以及 `bg-white/[0.02]`、`border-white/[0.06]`、`text-white/40` 这类透明度变体。

`src/app/globals.css` 内甚至专门写了一段 **浅色补丁层**（行 182–275）：在 `app-theme-scope` 作用域内，对 `text-white`、`bg-white`、`bg-black` 等暗色优先类进行强制浅色覆盖。这等于承认了"组件是按深色一刀切写的，靠 CSS 层在浅色下打补丁来兜底"。

这种结构带来三个直接后果：

1. **浅色主题视觉一致性差**：组件作者写 `text-white/60`，CSS 补丁强制改成深色文字，但语义不对（"60% 不透明度的白" 翻译成深色后含义已经变形），出现局部对比度不足或颜色偏色的情况。
2. **新增组件容易再次走回老路**：因为没有"必须用 token"的硬约束，新代码很自然又写 `text-white`。
3. **难以让 UI 升级**：想统一调整卡片质感、阴影、描边时，需要改的不是 5 个 token 而是 23 个文件。

### 1.2 装饰层：背景色块违反 AGENTS.md 的"功利主义"约定

`src/app/layout.tsx` 在根 body 下方直接放了 3 个固定装饰性渐变色块：

```tsx
<div className='absolute top-[-10%] right-[-5%] h-[800px] w-[800px] rounded-full bg-violet-500/10 blur-[160px]' />
<div className='absolute bottom-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-blue-600/8 blur-[140px]' />
<div className='absolute top-[40%] left-[50%] h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[120px]' />
```

加上 `app-grid-pattern` 的网格，整个背景在浅色模式下显得"花"，且不符合 AGENTS.md 中"不要引入 landing-page 风格的 hero 区或装饰性色块；首屏应保持是工具本身"的明确约定。

主页头部也有偏装饰倾向的渐变：

```tsx
<h1 className='from-foreground bg-gradient-to-r via-violet-700 to-sky-700 bg-clip-text text-transparent ...'>
    GPT Image Playground
</h1>
```

LOGO 容器使用 `bg-gradient-to-br from-white to-violet-50 ... dark:from-white/95 dark:to-sky-100/90`，深色模式下浅色底也偏"宣传味"。

### 1.3 卡片层：写法发散，但都通过 `app-panel-card`

主要工作区有 3 张大卡：`generation-form` / `editing-form`、`image-output` / `text-output`、`history-panel`。它们都用了 `.app-panel-card` 类，但每张卡都额外手写了一长串：

```tsx
'app-panel-card group flex h-full w-full flex-col gap-0 overflow-hidden rounded-2xl border py-0 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent'
```

问题：

- `border-white/[0.06]` 用于卡内分隔线（CardHeader 的下边框），在浅色模式下要靠浅色补丁层强转，颜色不可控。
- `before:via-white/10` 这种"卡顶高光线"在浅色下基本看不见，深色下又过强，缺乏 token 化。
- 三张卡都重复粘贴了同一长串 class，已经成为复制源；想改一处需要改三处。

### 1.4 组件层：Button 体系良好，但 Icon Button / 下拉 / 折叠分裂严重

shadcn/ui 基础库齐全，`src/components/ui/` 共 18 个 primitives，icon 库统一为 lucide（无任何其他图标库引用）。但应用层有显著漂移：

- 内联 `<button>`（不走 Button primitive）共 **50+ 处**，集中在 `settings-dialog.tsx`（18+）、`history-panel.tsx`（14+）、`zoom-viewer.tsx`、`share-dialog.tsx`、`prompt-templates-dialog.tsx` 等。
- 没有专门的 IconButton primitive。结果是 "高 28 / 32 / 36 / 40 px" 四套尺寸混用，圆角也在 `rounded-md` / `rounded-lg` / `rounded-full` 之间游走。
- 没有 Popover primitive。`history-panel.tsx` 同步菜单是手写下拉。
- 没有 Skeleton primitive。loading 状态全靠 `Loader2 + animate-spin`，尺寸有 `h-4 w-4`、`size={15}`、`h-3.5` 等多种。
- 没有 EmptyState 共享组件。
- 没有 Heading / Typography primitive，标题尺寸（`text-lg` / `text-xl` / `text-2xl` / `text-3xl`）随手写。

### 1.5 移动端：基础规范到位，细节有违反

通过 `playwright-cli` 在 390×844 视口实际测量发现：

- 安全区适配做得很好，9 个文件正确使用 `max(base, env(safe-area-inset-*))` 模式。
- `window.alert / prompt / confirm` 零违反，符合 AGENTS.md。
- 但是图片历史卡片上的"下载"、"查看提示词"、"删除"按钮渲染尺寸是 **28×28** 和 **24×24**，远低于 iOS HIG 要求的 44×44 和 Material 的 48×48 最小可点击区域。
- `mobile detection` 阈值在 `page.tsx`（1024px）、`promo-slot.tsx`（767px）、`editing-form.tsx`（640px）、`prompt-templates-dialog.tsx`（1024px）四处使用了不同的断点。
- `zoom-viewer.tsx` 的关闭按钮和缩放按钮（line 520, 626, 633）只有 `hover:` 没有 `focus-visible:`，键盘和触控用户没有反馈。
- `history-panel.tsx` 的标签按钮（line 747）也缺少明确的 focus 状态。
- 管理后台的促销列表 `promo-admin-client.tsx:567` 用 `min-w-[1120px]` 强制横向滚动而不是响应式重排。

### 1.6 阴影 / 描边 / 圆角：尺度不统一

| 维度 | 当前混用情况 |
| --- | --- |
| Shadow | `shadow-sm`、`shadow-md`、`shadow-lg`、`shadow-xl`、`shadow-2xl`、`shadow-inner`、`shadow-violet-600/20`、`shadow-violet-500/5`、`shadow-black/10`、`shadow-slate-900/15` 全部都有 |
| Border 颜色 | `border-border`（语义） + `border-white/[0.06]` + `border-neutral-400` + `border-slate-200` + `border-violet-500/...` 混用 |
| Radius | `rounded-md` / `rounded-lg` / `rounded-xl` / `rounded-2xl` / `rounded-3xl` / `rounded-full` 同一类元素出现多种 |

## 2. 目标

### 2.1 V1+V2 目标完成情况

| # | 目标 | V1 状态 | V2 状态 |
| --- | --- | --- | --- |
| 1 | **主题语义统一** | ✅ 5 张主卡完成 | ✅ 9 个对话框/外围组件完成；token 化覆盖 src/components 全部组件，剩余 71 处都是合理保留（品牌 saturated bg 或图片 overlay scrim） |
| 2 | **去掉 globals.css 浅色补丁层** | 🔁 推迟到 V2 | ✅ **已完整删除（行 220-304 共 84 行）**，应用在浅色模式下视觉无回退 |
| 3 | **首屏更简洁** | ✅ 装饰 blob 全部移除 | — 已完成 |
| 4 | **统一卡片骨架** | ✅ 5 张主卡迁到 `<WorkbenchCard>` | — 已完成 |
| 5 | **补齐基础 primitives** | ✅ 5 个（IconButton / Spinner / Skeleton / EmptyState / WorkbenchCard） | ✅ +1 个（Popover）；剩 Heading 推迟到 V3 |
| 6 | **移动端可点击区域达标** | 🔁 推迟到 V2 | 🔁 部分进度：IconButton primitive 默认 40×40 已就绪、zoom-viewer 控件已升至 h-11；history-panel 卡片图标按钮（28×28）需要 V3 改造 |
| 7 | **一致的 hover/focus/active** | ✅ 主卡片完成 | ✅ zoom-viewer 工具栏全部加 focus-visible:ring；其余对话框待 V3 用 IconButton 替换时一并补齐 |
| 8 | **断点和媒体查询统一** | ✅ 工具就绪 | 🔁 4 处旧字面量未替换（推迟到 V3，纯重构、风险高于收益） |
| 9 | **深浅主题双向验证** | ✅ V1 截图通过 | ✅ V2 实测 settings 对话框 + 主页 4 种状态，patch 层删除后无回退 |

### 2.2 非目标

首版不做以下内容：

- 不做完整的视觉品牌升级（更换主色、字体、Logo、配图风格）。
- 不做信息架构改造，不重排页面结构和入口。
- 不引入 sonner 等第三方 toast 替换 NoticeProvider。
- 不重写 admin 后台的内容信息架构（仅修响应式 / token 级问题）。
- 不重写 `app-panel-card` 的视觉本身（高斯模糊、`before:` 顶部高光线等暂时保留）。
- 不引入 Storybook、Chromatic 等组件文档/视觉回归基础设施。

## 3. 设计系统升级

### 3.1 Token 增量 ✅ V1 已落地

`src/app/globals.css` 已新增以下 token，并通过 `@theme inline` 暴露成 Tailwind utility（`bg-panel-{surface|subtle|soft|ghost}`、`border-panel-divider`、`via-panel-highlight`、`text-on-panel-{muted|faint}`、`shadow-panel-{sm|md|lg}`）。

| Token | 用途 | 浅色实测值 | 深色实测值 | 状态 |
| --- | --- | --- | --- | --- |
| `--app-panel-ghost` | 面板"次次级"背景（替换 `bg-white/[0.02]`） | `oklch(0.99 0.002 264)` | `oklch(1 0 0 / 0.02)` | ✅ |
| `--app-panel-divider` | 卡内分隔线（替换 `border-white/[0.06]`） | `oklch(0.92 0.004 264)` | `oklch(1 0 0 / 0.06)` | ✅ |
| `--app-panel-highlight` | 卡顶高光线渐变中点（替换 `via-white/10`） | `oklch(0 0 0 / 0)` | `oklch(1 0 0 / 0.10)` | ✅ |
| `--app-text-on-panel-muted` | 面板内"中等弱化文字"（替换 `text-white/60`） | `oklch(0.45 0.02 264)` | `oklch(1 0 0 / 0.65)` | ✅ |
| `--app-text-on-panel-faint` | 面板内"最弱文字 / 占位"（替换 `text-white/40`） | `oklch(0.55 0.015 264)` | `oklch(1 0 0 / 0.45)` | ✅ |
| `--app-shadow-panel-sm` | 卡片浮起 sm | `0 1px 2px oklch(0 0 0 / 4%)` | `0 1px 2px oklch(0 0 0 / 35%)` | ✅ |
| `--app-shadow-panel-md` | 卡片浮起 md（默认） | `0 1px 3px oklch(0 0 0 / 6%), 0 8px 24px oklch(0 0 0 / 4%)` | `0 8px 32px oklch(0 0 0 / 30%)` | ✅ |
| `--app-shadow-panel-lg` | 对话框、悬浮 lg | `0 4px 8px oklch(0 0 0 / 6%), 0 20px 48px oklch(0 0 0 / 8%)` | `0 20px 56px oklch(0 0 0 / 45%)` | ✅ |

附加增强（V1 实施时一并完成）：

- ✅ `.app-panel-card::before` 现在自动渲染顶部 1px 高光线，组件不再需要重复粘贴 `before:via-white/10 before:from-transparent before:to-transparent` 这类长串。
- ✅ 删除了 `globals.css` 末尾的"装饰色块在浅色下抑制"override 块（行 270-274），因为色块本身已不存在。

### 3.2 Radius / 间距 / 排版尺度收敛 🔁 V2 推进

V1 内**已落地的部分**：

- ✅ 主页 H1 已改为 `text-lg sm:text-2xl md:text-3xl`，副标题 `text-[10px]/[11px]` 改为 `text-xs`，移除了任意像素值。
- ✅ 所有新建 primitives（IconButton / Spinner / Skeleton / EmptyState / WorkbenchCard）的 radius 严格落在 `rounded-md / lg / xl / 2xl / full` 范围内。

V1 **未做、留给 V2** 的部分：

- 🔁 settings-dialog / share-dialog / prompt-templates-dialog 内仍存在 `text-[10px]`、`text-[11px]` 等任意像素值，需在对话框迁移时一并清理。
- 🔁 全局 `rounded-3xl` 排查仍未做。

定义一个 V1 内强约束的尺度表，新写代码必须从这里挑：

| 尺度族 | 取值 | 使用场景 |
| --- | --- | --- |
| Radius | `rounded-md (6px)` / `rounded-lg (8px)` / `rounded-xl (12px)` / `rounded-2xl (16px)` / `rounded-full` | 表单元素 / 按钮 / Toast / 卡片 / 圆形头像 |
| Heading | `text-sm` / `text-base` / `text-lg` / `text-xl` / `text-2xl` / `text-3xl` | 元数据 / 正文 / 卡片标题 / 对话框标题 / 页面标题 / Hero（主页只有一处） |
| Card padding | `p-4` 移动端 / `sm:p-5` 桌面 | 主面板内容区 |
| Section gap | `space-y-5` | 表单内分区 |

### 3.3 Hard-coded color 清理总策略

| 当前写法 | V1 替换为 | V1 状态 | 备注 |
| --- | --- | --- | --- |
| `text-white` / `text-black` | `text-foreground` 或 `text-on-panel-muted` 等语义类 | ✅ 5 张主卡完成 / 🔁 三大对话框待办 | 视语义而定 |
| `text-white/60` | `text-on-panel-muted` | ✅ 5 张主卡完成 / 🔁 对话框待办 | 不再用透明度表达"弱化" |
| `text-white/40` | `text-on-panel-faint` | ✅ 5 张主卡完成 / 🔁 对话框待办 | |
| `bg-white` / `bg-black` | `bg-card` / `bg-popover` / `bg-background` | ✅ 5 张主卡完成 / 🔁 对话框待办 | |
| `bg-white/[0.02]` / `bg-black/[0.02]` | `bg-panel-ghost` | ✅ 5 张主卡完成 / 🔁 对话框待办 | |
| `bg-white/[0.04]` | `bg-panel-subtle` | ✅ 5 张主卡完成 / 🔁 对话框待办 | 复用现有 `--app-panel-subtle` |
| `border-white/[0.06]` | `border-panel-divider` | ✅ 5 张主卡完成 / 🔁 对话框待办 | |
| `via-white/10` 渐变 | 由 `app-panel-card::before` 自动渲染 | ✅ 已抽到 CSS | 组件不再写 |
| 写死 `#11111b` / `#12121d` 等 | `bg-popover` 或新增 token | 🔁 V2 | 三大对话框中仍存在 |
| 写死 `#000000`（canvas fill） | 业务算法用色，保留但加注释说明非主题色 | ⏸ 保留 | editing-form.tsx:2169 是 mask canvas fill |

**V1 实测减负**（5 个核心面板）：
- generation-form.tsx：`text-white` 32 → 1（剩 1 处是品牌渐变按钮上的 `text-white`，故意保留）
- editing-form.tsx：54 → 3（同上 + 1 处 saturated bg badge）
- image-output.tsx：13 → 0
- text-output.tsx：~5 → 1（同上）
- history-panel.tsx：8 → 0（`bg-white/border-white` 剩 5 处都是图片 thumbnail 上的 scrim 遮罩，故意保留）

总计：~112 处 → ~10 处（减少 91%），剩余都是品牌按钮 saturated bg 或图片覆盖层这类合理保留场景。

### 3.4 装饰元素清理 ✅ V1 已完成

采用 **方案 A**（用户决议）：

- ✅ `src/app/layout.tsx` 删除三个 blur 色块（`bg-violet-500/10 blur-[160px]` 等）。
- ✅ 保留 `app-grid-pattern`，浅色 `5%` / 深色 `10%` 当前对比度合理，不再调整。
- ✅ 主页 H1 移除三色渐变（`bg-clip-text text-transparent`），改为 `text-foreground` 单色。
- ✅ LOGO 容器从 `bg-gradient-to-br from-white to-violet-50` 改为 `bg-card border`。
- ✅ 全局拖拽提示遮罩从 `bg-black/70 + text-violet-300` 改为 `bg-background/85 + text-primary`，浅深双向自然。

## 4. 共享组件升级

新增以下基础组件，并在本次升级中替换调用方。

### 4.1 `<IconButton>` ✅ V1 已交付（接入待 V2）

- ✅ 位置：`src/components/ui/icon-button.tsx`。
- ✅ API：`<IconButton size="sm|md|lg" variant="ghost|subtle|solid|overlay" tone="neutral|primary|destructive" aria-label tooltip tooltipSide />`。
- ✅ 渲染尺寸：sm = 32×32、md = 40×40、lg = 44×44。**默认 md 起步**（移动端达标）。
- ✅ 自带 `focus-visible:ring-[3px]`、`active:scale-[0.97]`、可选 Tooltip slot（Tooltip + TooltipTrigger 内置封装）。
- ✅ 新增 `overlay` variant，专门用于 zoom-viewer / 历史 thumbnail 上的浮动按钮，浅深双色都自然。
- 🔁 **V2 接入清单**（本轮未接入，仅创建组件）：
  - `src/components/zoom-viewer.tsx:520, 600, 617, 626, 633` — 改为 `<IconButton variant=overlay>`
  - `src/components/history-panel.tsx:740-887` — 标签按钮 + 同步菜单 + 卡片操作按钮
  - `src/components/settings-dialog.tsx:5709, 5724, 5823` — 分页器
  - `src/components/settings-dialog.tsx:469` — 密码可见切换
  - `src/components/share-dialog.tsx` — 密码切换、复制按钮

### 4.2 `<Spinner>` / `<Skeleton>` ✅ V1 已交付（Skeleton 接入留 V2）

- ✅ `src/components/ui/spinner.tsx`：封装 `Loader2 + animate-spin`，固定 sm/md/lg 三档（h-3.5 / h-4 / h-5），自带 `role=status` + `aria-label`。
- ✅ `src/components/ui/skeleton.tsx`：基于 `bg-panel-subtle animate-pulse rounded-md` 的占位组件。
- ⏸ **本轮按用户决议**：Skeleton 只引入 primitive，不接入实际页面，下一轮再决定哪些列表（历史卡片 / 模板列表 / 设置 promo 列表）先上。
- 🔁 **V2 待替换**：现有 14 处散落的 `Loader2 className='h-4 w-4 animate-spin'` 应统一替换为 `<Spinner size="md" />`。

### 4.3 `<EmptyState>` ✅ V1 已交付（接入留 V2）

- ✅ 位置：`src/components/ui/empty-state.tsx`。
- ✅ API：`<EmptyState icon? title description action?/>`，自动套用 `text-on-panel-faint` 图标颜色和 `text-on-panel-muted` 描述色。
- 🔁 **V2 待替换**：`image-output.tsx`（"生成的图片将显示在这里" 段落）、`text-output.tsx`、历史空状态、模板库空筛选状态等。

### 4.4 `<Popover>` 🔁 V2 推进

- ⏸ V1 跳过：需要新增 `@radix-ui/react-popover` 依赖，且 `history-panel.tsx` 同步菜单和 `settings-dialog.tsx` 折叠 section 都属于 V2 整改范围，没有"V1 现成可替换的孤立目标"，单独引入 primitive 没收益。
- 🔁 **V2 接入计划**：
  - 新建 `src/components/ui/popover.tsx`（基于 `@radix-ui/react-popover`，与 Tooltip / Dialog 风格一致）。
  - 替换 `history-panel.tsx` 同步菜单（line 778-868）当前手写下拉。
  - 替换 `settings-dialog.tsx` 中各处可折叠 section 的"展开器按钮"（如 line 411）。

### 4.5 `<Heading>` / `<SectionTitle>` 🔁 V2 推进

- ⏸ V1 跳过：本轮主页 H1 已就地修复，剩余 13 个文件的 `<h1-h6>` 改造面积大、产出收益相对低，留 V2。
- 🔁 **V2 计划**：API `<Heading level={1|2|3} size="page|section|card|sub">{children}</Heading>`，统一 dialog title / page title / section title 的字号。

### 4.6 `<WorkbenchCard>` ✅ V1 已交付并接入

- ✅ 位置：`src/components/ui/workbench-card.tsx`，导出 `WorkbenchCard`、`WorkbenchCardHeader`、`WorkbenchCardBody`。
- ✅ 已接入：
  - `src/components/generation-form.tsx:277`
  - `src/components/editing-form.tsx:2379`
  - `src/components/image-output.tsx:101`
  - `src/components/text-output.tsx:89`
  - `src/components/history-panel.tsx:875`
- ✅ 内部封装 `app-panel-card` + 顶部 1px 高光线（由 `::before` 自动渲染）+ 卡顶分隔线。
- ✅ 调用方支持 `className` 透传，所以局部尺寸/最小高度差异（如 image-output 的 `min-h-[300px]`）仍可以表达。

## 5. 页面级整改清单

### 5.1 根 layout（`src/app/layout.tsx`） ✅ V1 已完成

| 项目 | 现状 → V1 实施结果 | 状态 |
| --- | --- | --- |
| 装饰色块 | 三个 blur gradient（violet / blue / purple）→ **已删除** | ✅ |
| 网格背景 | `app-grid-pattern` 浅色 5% / 深色 10% → 保持当前对比度 | ✅ |
| 触控 / 缩放 | `prevent-page-zoom`、`touch-manipulation` → 不动 | ✅ |

### 5.2 主页头部（page.tsx:4540-4576） ✅ V1 已完成（除 Promo）

| 项目 | 现状 → V1 实施结果 | 状态 |
| --- | --- | --- |
| LOGO 容器 | `bg-gradient-to-br from-white to-violet-50` → `bg-card border` | ✅ |
| 标题 | 三色渐变 `text-transparent` → 单色 `text-foreground` | ✅ |
| 副标题 | `text-[10px]/[11px]` 自定义像素 → `text-xs tracking-widest` | ✅ |
| 全局拖拽提示遮罩 | `bg-black/70 + text-white/50 + text-violet-300/400` → `bg-background/85 + text-primary + text-muted-foreground` | ✅ |
| Top banner Promo 移动端处理 | 按用户决议 → **保持原样**，避免误伤业务 | ⏸ 决议保留 |

### 5.3 GenerationForm（`src/components/generation-form.tsx`） ✅ V1 已完成

| 项目 | 现状 → V1 实施结果 | 状态 |
| --- | --- | --- |
| 卡片 class | 复制粘贴的长串 + `border-b border-white/[0.06]` → `<WorkbenchCard>` | ✅ |
| 标题 | `text-white` → `text-foreground` | ✅ |
| 描述 | `text-white/60` → `text-on-panel-muted` | ✅ |
| Lock 按钮 | `text-white/60 hover:text-white` → `text-on-panel-muted hover:text-foreground`（仍是 Button ghost）| ✅ |
| 32 处 `text-white` / 17 处 `bg-white` | 减到 1 处（品牌渐变按钮 saturated bg 故意保留） | ✅ |
| Slider 深度 selector `[&>button]:ring-offset-black` / `[&>span:first-child>span]:bg-white` | 改为 `ring-offset-background` / `bg-foreground` | ✅ |
| 🔁 V2：Lock 按钮替换为 `<IconButton>` | 当前仍用 Button，V2 接入 IconButton 时一并换 | 🔁 |

### 5.4 EditingForm（`src/components/editing-form.tsx`） ✅ V1 主体完成（细节留 V2）

> 单文件最复杂部分（4049 行），V1 重点：卡片骨架 + token 化。

| 项目 | 现状 → V1 实施结果 | 状态 |
| --- | --- | --- |
| 卡片 class | 复制 → `<WorkbenchCard>` | ✅ |
| 54 处 `text-white` / 24 处 `bg-white` | 减到 3 处（品牌渐变按钮 + 1 处 saturated bg badge，故意保留） | ✅ |
| `#11111b` / `#12121d` 等 hex 下拉背景 | 6 个手写下拉面板（提示词历史 / 模板搜索 / 选择器）改为 `bg-popover border-border`，删除冗余 `dark:` 反向覆盖 | ✅ |
| 工具栏按钮 light/dark 双套色（`text-slate-600 ... dark:text-on-panel-muted ...`） | 折叠为单套语义类 `text-on-panel-muted hover:bg-accent hover:text-foreground active:bg-accent/70` | ✅ |
| 图片 hover 遮罩 `bg-black/0 → bg-black/30` | 改为 `bg-foreground/0 → bg-foreground/30`，浅深双向自然 | ✅ |
| Mask preview chip `bg-white p-1` | 改为 `bg-card p-1` | ✅ |
| `#000000` canvas fill (line 2169) | 业务算法用色，保留 | ⏸ 故意保留 |
| Header 高度固定 `h-[72px]` 含 GenerationHeaderAd | V1 不动；V2 评估在窄屏隐藏内嵌 ad | 🔁 |
| 蒙版编辑器在移动端复测 | V1 未单独复测 | 🔁 |
| 触控反馈 `active:scale-[0.98]` 全覆盖 | 已部分覆盖（toolbar 按钮已带）；V2 检查剩余 | 🔁 |

### 5.5 ImageOutput / TextOutput ✅ V1 已完成（EmptyState 接入留 V2）

| 项目 | 现状 → V1 实施结果 | 状态 |
| --- | --- | --- |
| 卡片 class | 复制 → `<WorkbenchCard>` | ✅ |
| `text-white` (image-output 13 处) → 0 | 全部 token 化 | ✅ |
| `bg-white/[0.01]`（preview 区底色） | `bg-panel-ghost` | ✅ |
| `bg-white/20 text-white`（active 切换 pill）| `bg-accent text-foreground` | ✅ |
| `bg-black/30/50/70`（图上时间 pill / streaming overlay） | 故意保留：图片之上的 scrim 不能跟主题反向 | ⏸ |
| 空状态文案 `<p>生成的图片将显示在这里。</p>` | V1 未替换为 `<EmptyState>`，文案保持 | 🔁 |
| Edit 按钮 | 已用 `<Button disabled>`，V1 未动 | ✅（不动） |
| `text-output.tsx` "发送到生成器" 渐变按钮 | 修复 V1 早期误转：`text-foreground` 改回 `text-white`（saturated bg 上必须 white）| ✅ |

### 5.6 HistoryPanel（`src/components/history-panel.tsx`） ✅ V1 已完成 token / 卡片层；其它留 V2

| 项目 | 现状 → V1 实施结果 | 状态 |
| --- | --- | --- |
| 卡片骨架 | `Card` + 长串 → `<WorkbenchCard>` | ✅ |
| 8 处 `text-white` → 0 | 全部 token 化 | ✅ |
| 调试详情面板 `bg-black/10` | `bg-panel-soft border-panel-divider` | ✅ |
| `app-panel-subtle` 用法 (line 1191, 1241) | V1 已正确，保留 | ✅ |
| 14+ 处内联 `<button>`（标签 / 同步菜单 / 卡片操作） | V1 仍是 inline `<button>`；V2 用 IconButton + Popover 替换 | 🔁 |
| 卡片图标按钮渲染 28×28 | V1 未改尺寸；V2 升 ≥ 40×40 | 🔁 |
| 标签按钮缺 focus（line 747） | V1 未补；V2 与按钮替换一并修 | 🔁 |
| 同步菜单 (line 778-868) | 仍是手写下拉；V2 用 `<Popover>` | 🔁 |
| `drop-shadow-[0_1px_2px_rgb(...)]` (line 1456, 1473) | V1 保留：浮在图上的勾选标志，scrim 性质，不替换为主题 token | ⏸ 故意保留 |
| 图片缩略图上的 scrim：`bg-white/80`、`bg-black/70/80`、`border-white/70` 等 5 处 | V1 故意保留：图上覆盖层不能跟主题反向，否则在亮图上不可读 | ⏸ 故意保留 |

### 5.7 SettingsDialog（`src/components/settings-dialog.tsx`） 🔁 V2 整改

> 18+ 处内联 button，分页器 / 折叠 section / 密码可见切换都自己写。**V1 完全未触碰，patch 层兜底浅色显示。**

| 项目 | 目标 | 状态 |
| --- | --- | --- |
| Section 折叠展开按钮 (line 411) | `<Button variant=ghost>` 或新封装 `<DisclosureRow>` | 🔁 |
| 分页器 (line 5709, 5724, 5823) | `<IconButton size=sm>` | 🔁 |
| 密码可见切换 (line 469) | 用现有 `<PasswordInput>` 或 `<IconButton>` | 🔁 |
| 颜色点（如有） | 从写死颜色改 token | 🔁 |
| 顶部 dialog 头一致性 | 与 ShareDialog、PromptTemplatesDialog 头部对齐：相同高度、相同关闭按钮位置、相同 H1 字号 | 🔁 |

### 5.8 ShareDialog / PromptTemplatesDialog 🔁 V2 整改

**V1 完全未触碰，patch 层兜底浅色显示。**

| 项目 | 目标 | 状态 |
| --- | --- | --- |
| 头部 / 关闭 / 安全区 | 与 SettingsDialog 对齐 | 🔁 |
| `text-white` (prompt-templates-dialog 71 处、share-dialog 10 处) | 全部替换 | 🔁 |
| 写死 hex `#12121d`、`#13131f` | `bg-popover` | 🔁 |
| 移动端模板编辑底部抽屉 (prompt-templates-dialog.tsx:1032) | 保留 dialog 实现，但在结构上明确为"bottom-aligned dialog"，加注释 | 🔁 |

### 5.9 ZoomViewer 🔁 V2 整改

| 项目 | 目标 | 状态 |
| --- | --- | --- |
| 关闭按钮 (line 520) `bg-white/20 text-white` | `<IconButton variant=overlay>`（V1 已新增此 variant，等待接入） | 🔁 |
| 缩放 +/- (line 626, 633) | 同上 | 🔁 |
| 缺 focus 状态 | 全部加 focus-visible（IconButton 默认带，接入即修复） | 🔁 |
| 安全区适配 | V1 未单独复测 | 🔁 |

### 5.10 Admin Shell（`src/components/admin/admin-shell.tsx`） 🔁 V2 推迟

按用户决议：本轮 admin 只修必要 token，结构改造（移动端导航、表格转卡片）延到下一轮。

| 项目 | 目标 | 状态 |
| --- | --- | --- |
| 移动端 sidebar 入口 | 在 < lg 提供顶部 dropdown 导航或 `<Popover>` 抽屉 | 🔁 V2 |
| 表格强制 `min-w-[1120px]`（promo-admin-client.tsx:567） | 在 < md 切换为卡片列表布局；保留宽屏表格 | 🔁 V2 |
| `shadow-[-8px_0_12px_-12px_rgb(0_0_0/0.35)]` 写死 | 用 `shadow-panel-md` token | 🔁 V2 |

## 6. 响应式与移动端规范

### 6.1 统一断点 ✅ V1 已交付工具（接入留 V2）

✅ 已在 `src/lib/breakpoints.ts` 实现：

```ts
export const BREAKPOINTS = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536
} as const;

export const isMobileViewport = () => isBelowBreakpoint('lg');
export function useIsMobileViewport(): boolean { /* SSR-safe + listener */ }
export function useMediaQueryAtLeast(bp: Breakpoint): boolean { /* SSR-safe + listener */ }
```

替换以下分散点：
- 🔁 `src/app/page.tsx:352` (`min-width: 1024px`) — 改 `BREAKPOINTS.lg`（V2）。
- 🔁 `src/components/promo-slot.tsx:54-61` (`max-width: 767px`) — 改 `BREAKPOINTS.md`（V2）。
- 🔁 `src/components/editing-form.tsx:1832` (`window.innerWidth < 640`) — 改 `BREAKPOINTS.sm`（V2）。
- 🔁 `src/components/prompt-templates-dialog.tsx:345` (`min-width: 1024px`) — 改 `BREAKPOINTS.lg`（V2）。

### 6.2 最小可点击区域 🔁 V2 推进

> 强约束：所有 `role=button` / `<button>` / `<a>` 在移动端最小 40×40，理想 44×44。

V1 状态：
- ✅ `<IconButton>` 默认 `size="md"=40` 已就绪，新代码可直接达标。
- 🔁 历史卡片操作（下载、查看提示词、删除）— **仍是 28×28**，V2 用 IconButton 替换。
- 🔁 历史标签 — 36×36，V2 复测。
- 🔁 工具栏（提示词清空 / 润色 / 图生文 / 分享 / 模板 / 历史 / 高级）— 36×36，V2 复测移动端间距。

实施方法：在 `<IconButton>` 默认 `size="md"=40` 的基础上，全应用搜索替换 `h-7 w-7` / `h-8 w-8` 类内联尺寸，逐处评估。

### 6.3 焦点与触控反馈

| 类别 | 要求 | V1 状态 |
| --- | --- | --- |
| 所有 button / link / 自定义可点击 | 必须有 `focus-visible:ring-[3px] ring-ring` | ✅ IconButton/Button/Toggle/Slider/Select 等 primitives 都已带；🔁 历史 tab 按钮、zoom-viewer 控件 V2 修 |
| 触控为主的元素 | 必须有 `active:scale-[0.97]` 或 `active:opacity-80` | ✅ IconButton 默认带；🔁 旧组件 V2 检查 |
| 仅 hover 触发的额外信息 | 必须有触控等价路径（如 long-press menu 或专门入口） | 🔁 V2 统一审查 |

### 6.4 安全区 ✅ V1 保持不动

保持现有 `max(base, env(safe-area-inset-*))` 模式不变。9 个文件已正确实现，新增页面 / dialog 强约束沿用。

### 6.5 Dialog 在移动端 ✅ V1 保持不动

保持 "mobile fullscreen / sm: 居中" 的现有模式。本轮不引入 bottom-sheet / drawer。

## 7. 主题双向验收

每个改动到的页面、面板、对话框都需要在以下 4 种状态下截图比对，附在 PR 中：

1. Desktop 1440×900 · Light
2. Desktop 1440×900 · Dark
3. Mobile 390×844 · Light
4. Mobile 390×844 · Dark

可以用 `playwright-cli` 实现：

```bash
playwright-cli -s=ui resize 1440 900
playwright-cli -s=ui goto http://localhost:3030/
playwright-cli -s=ui eval "() => document.documentElement.classList.replace('dark','light')"
playwright-cli -s=ui screenshot --filename=tmp-qa/ui/desktop-light-home.png --full-page
# 对深色 / 移动端 / 各 dialog 重复
```

PR Checklist 必填项：
- [ ] 4 张截图（每个改动页 / dialog）
- [ ] 浅色截图中无 `text-white` 直显黑底 / `bg-white` 直显白底导致的对比度问题
- [ ] 深色截图中无浅色补丁层强转后偏色
- [ ] 移动端无横向滚动（除非 admin 表格已转卡片列表）
- [ ] 所有改动控件最小 ≥ 40×40

**V1 实测结果**（已完成项）：
- ✅ 主页 4 种状态实测：装饰 blob = 0、标题渐变 `bg: none`、3 张主卡 token 渲染正确、零 console error。
- ✅ `npm run lint` 通过、`npm run build` 5.1s 成功（40 routes）、`npm run test` 503/503。
- 🔁 V2 完成对话框迁移后需复测对话框 4 种状态。

## 8. 实施阶段

### Phase 1：Token & primitives 基建（1–2 天） ✅ V1 已完成

- ✅ 在 `globals.css` 新增 §3.1 token，并通过 `@theme inline` 暴露。
- ✅ 新增 `<IconButton>`、`<Spinner>`、`<Skeleton>`、`<EmptyState>`、`<WorkbenchCard>`（5 个）。
- ⏸ `<Popover>`、`<Heading>` 推迟到 V2（理由见 §4.4 / §4.5）。
- ✅ 在 `src/lib/breakpoints.ts` 中实现 §6.1 工具函数。
- ⏸ 单元测试覆盖新 primitives 的 a11y — V1 未单独写，靠 build / lint / 现有 503 个测试兜底；V2 视情况补。

### Phase 2：主页 + 主卡片（1–2 天） ✅ V1 已完成

- ✅ 改 `src/app/layout.tsx`（去装饰、网格保持 5%/10% 对比度）。
- ✅ 改 `src/app/page.tsx` 头部（LOGO 容器、标题渐变、像素级字号、拖拽提示遮罩）。
- ✅ 把 `generation-form` / `editing-form` / `image-output` / `text-output` / `history-panel` 5 张卡迁到 `<WorkbenchCard>`。
- ✅ 替换这 5 个文件内的 `text-white` / `bg-white` / `border-white/...`（112 处 → ~10 处合理保留）。
- ✅ 4 种状态实测，零 console error。

### Phase 3：Dialog 三件套（2 天） 🔁 V2 待执行

- 🔁 `settings-dialog.tsx` 内 18 处内联 button 改 IconButton / Popover。
- 🔁 `share-dialog.tsx` 同步整改。
- 🔁 `prompt-templates-dialog.tsx` 同步整改（重灾区 71 + 35）。
- 🔁 三个 dialog 头部对齐：相同高度、相同关闭按钮位置、相同 H1 字号。
- 🔁 PR 内交 4×3=12 张截图。

### Phase 4：移动端 / a11y / overlay（1 天） 🔁 V2 待执行

- 🔁 `zoom-viewer.tsx`：IconButton (overlay variant) + focus-visible。
- 🔁 `history-panel.tsx`：图标按钮升至 ≥ 40×40。
- 🔁 全应用断点收敛到 §6.1（4 处字面量替换）。
- 🔁 `text-white/40`、`text-white/60` 在剩余文件（主要是三大对话框）替换为 `text-on-panel-faint` / `muted`。

### Phase 5：清理与回归（0.5 天） 🔁 V2 待执行

- 🔁 移除 `globals.css` 行 182–275 的浅色补丁层（**前置**：Phase 3+4 完成后才能安全删除）。
- 🔁 跑 `npm run lint && npm run test`。
- 🔁 在 desktop（Tauri）模式下手动验证关键流程（对照 AGENTS.md §3 Web vs Tauri 规则）。
- 🔁 在桌面端静态导出 (`npm run build:desktop`) 验证 admin 路由是否仍可达 / 退化。

## 9. 验收标准

V2 完结时（即整个升级路线收尾时），应满足：

| # | 标准 | V1 状态 | V2 目标 |
| --- | --- | --- | --- |
| 1 | `rg -n 'text-white' src/components` 返回 0 条（除 lucide stroke、品牌按钮 saturated bg、图片 scrim 例外） | 5 张主卡 ✅ / 三大对话框 🔁 | 全应用 0 条（带例外清单） |
| 2 | `rg -n 'bg-white' src/components` 返回 0 条 | 5 张主卡 ✅ / 三大对话框 🔁 | 全应用 0 条（带例外清单） |
| 3 | `rg -n 'bg-black' src/components` 返回 0 条（除 zoom-viewer overlay、image scrim） | 5 张主卡基本 ✅ / 三大对话框 🔁 | 全应用 0 条（带例外清单） |
| 4 | `rg -n '#[0-9a-fA-F]{3,8}' src/components --pcre2` 仅剩 `editing-form.tsx` 的 `#000000` (canvas fill) | 5 张主卡 ✅ / 三大对话框还有 `#11111b` 等 🔁 | 仅业务示例色，每条带注释 |
| 5 | `globals.css` 行 182–275 的浅色补丁层被删除，应用在浅色模式下视觉无回退 | 🔁 V1 保留兜底 | 删除 |
| 6 | `src/components/ui/` 下新增 primitives 都有：导出、TS 类型、`aria-label` 必填或可选 ARIA prop | ✅ 5 个 primitives 已交付 | 加 `<Popover>` / `<Heading>` 共 7 个 |
| 7 | 所有改动到的页面 / dialog 在 4 种状态下截图都通过 review | ✅ 5 张主卡 | 加三大对话框 + zoom-viewer |
| 8 | `npm run lint`、`npm run test`、`npm run build` 全部通过 | ✅ V1 全部通过 | 持续保持 |
| 9 | 移动端（390×844）所有可点击控件 ≥ 40×40，无横向滚动（admin 表格转卡片后） | 🔁 V1 未达标 | 历史卡片图标按钮升至 ≥ 40×40 |
| 10 | 所有 dialog 在移动端 fullscreen + 安全区适配仍正确 | ✅ 安全区已就绪 | V2 复测 |

## 10. 文档同步

按 AGENTS.md §7 的要求，本次升级会改用户可见 UI，需要同步更新：

| 文档 | V1 状态 | V2 状态 |
| --- | --- | --- |
| `docs/workspace.md` 截图替换、按钮位置/尺寸说明 | ⏸ V1 主卡片视觉变化轻微（去装饰、去渐变标题），用户感知低，可不必现在换图 | 🔁 V2 完成对话框/历史按钮尺寸改造后统一替换 |
| `docs/history-and-assets.md` 历史卡片图标按钮变化（位置 / 尺寸） | ⏸ V1 未改尺寸 | 🔁 V2 升 40×40 后更新 |
| `docs/providers-and-settings.md` 设置对话框新结构截图 | — | 🔁 V2 |
| `docs/sharing-and-sync.md` 分享对话框、同步菜单新结构截图 | — | 🔁 V2 |
| `docs/prompt-workflow.md` 模板对话框新结构截图 | — | 🔁 V2 |
| `CHANGELOG.md` 升级记录 | ✅ 已新增"UI 升级整改 V1"条目，列出 token / primitives / 主卡片 token 化 / patch 层暂保留 4 个重点 | 🔁 V2 完成后补"UI 升级整改 V2"条目 |

## 11. 风险与缓解

| 风险 | 缓解 | V1 实测情况 |
| --- | --- | --- |
| Phase 5 删除浅色补丁层后，发现某些组件忘了迁移导致浅色显示坏 | 删除前在一台真实浅色设备上完整跑一次 4 个主流程；`rg` 各种 `text-white` 全文检查零残留再删 | V1 选择保留 patch 层，等三大对话框迁移完毕一并删除 |
| `<WorkbenchCard>` 抽象过早 / 接口不够通用 | 先做"哑组件"把 class 串集中；3 张卡都迁完后再 review 接口是否值得保留 | ✅ 5 张卡全部迁入，`className` 透传机制覆盖了所有局部差异，接口可保留 |
| 触控反馈 `active:scale-[0.97]` 在嵌套的 group-hover 中影响布局 | 限定 `transform: scale` 仅作用于 leaf node；如有冲突改 `active:opacity-80` | V1 IconButton 已采用，无观察到布局抖动 |
| 移除背景装饰色块后被认为太朴素 | 在 PR 中提供 A / B 对比截图给用户确认；如确需保留，把 blur 渐变 token 化（`--app-decoration-*`），并降到 5% 以下不透明度 | ✅ 用户决议方案 A，已删除 |
| 切到 IconButton 后，旧 Tooltip 集成丢失 | IconButton 实现内置 `tooltip?: string` prop，失败也保留 `aria-label` 兜底 | ✅ V1 IconButton 已实现 tooltip slot |
| **新增**：bulk replace `text-white → text-foreground` 误伤 saturated bg 上的按钮文字 | 替换后做一次"saturated bg + text-foreground" 反向扫描，把误伤的改回 `text-white`；建立"saturated bg 上 text-white 是合理"的例外约定 | ⚠️ V1 实施时确实命中 4 处误伤（generation-form / editing-form / text-output 的渐变按钮、editing-form 的 violet/red 按钮），均已修正 |

## 12. 开放问题（已全部决议）

| # | 问题 | 决议 | 落地状态 |
| --- | --- | --- | --- |
| 1 | §3.4 装饰元素：方案 A vs B | **方案 A**：保留淡化 grid，去 blur 色块 | ✅ V1 落地 |
| 2 | §5.2 标题渐变保留 vs 去除 | **去除**，统一 `text-foreground`，符合 AGENTS.md "首屏即工具" | ✅ V1 落地 |
| 3 | §5.10 Admin 移动端响应式：本轮做 vs 下一轮 | **下一轮**做。V2 才考虑表格转卡片 | 🔁 V2 |
| 4 | §5.2 Top banner Promo 在移动端：默认隐藏 / 极简文字 / 保持原样 | **保持原样**，避免误伤业务 | ✅ V1 决议保持 |
| 5 | §4.2 Skeleton 接入范围：本轮接入页面 vs 仅引入 primitive | **仅引入 primitive**，下一轮再决定接入哪些列表 | ✅ V1 落地 primitive，🔁 V2 评估接入 |

## 13. V3 启动清单（V2 收尾后下一轮）

> V2 已完成 token 化 + patch 层删除，剩下的工作是结构性重构（主要是把内联 `<button>` 替换为 IconButton + Popover），单个文件改造面积大、风险高于收益。所以拆出 V3 单独一轮。

### 13.1 V3 推进顺序

1. 🔁 settings-dialog.tsx：18 处内联 button 改 IconButton + Popover 折叠 section（重灾区，5800 行单文件）
2. 🔁 share-dialog.tsx：4 处内联 button 改 IconButton；与 settings 对话框头部对齐
3. 🔁 prompt-templates-dialog.tsx：4 处内联 button 改 IconButton；分类侧栏 Popover 化
4. 🔁 history-panel.tsx：14+ 处内联 button 改 IconButton（标签 / 同步菜单 / 卡片操作）；卡片图标按钮升至 ≥ 40×40；同步菜单用 `<Popover>` 替换手写下拉
5. 🔁 全应用 14 处 `Loader2 + animate-spin` 替换为 `<Spinner>`
6. 🔁 `<EmptyState>` 接入：image-output、text-output、历史空状态、模板空筛选状态
7. 🔁 4 处 viewport 字面量替换为 `BREAKPOINTS` / `useIsMobileViewport`
   - `src/app/page.tsx:352`、`src/components/promo-slot.tsx:54-61`、`src/components/editing-form.tsx:1832`、`src/components/prompt-templates-dialog.tsx:345`
8. 🔁 引入 `<Heading>` primitive，替换 13 个文件里的 `<h1-h6>` 内联字号
9. 🔁 admin shell 移动端响应式（表格转卡片，移动端 sidebar 入口）
10. 🔁 4 种状态全量截图回归 + lint/test/build + Tauri desktop 验证

### 13.2 V3 退出标准

- [ ] 全应用 0 处内联 `<button>` 用做 IconButton（除非有特殊语义）
- [ ] 全应用所有可点击控件 ≥ 40×40（除超紧凑表格外）
- [ ] 全应用 0 处 `Loader2 + animate-spin` 散落用法
- [ ] 4 处 viewport 字面量收敛到 `BREAKPOINTS`
- [ ] Settings / Share / PromptTemplates 三大对话框头部 (高度 / 关闭按钮位置 / H1 字号) 严格对齐
- [ ] admin 在 ≤ md 断点下不出现强制横向滚动
- [ ] 4 种状态截图全部通过 review
