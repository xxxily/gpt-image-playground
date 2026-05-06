# Tauri Rust 请求代理服务规划

## 文档状态

- **状态**：Phase 2/3/4 已完成编码、全量验证、5 路审查与 macOS arm64 Tauri release 打包；桌面端 Rust 已覆盖 `proxy_images` 主链路、流式预览（OpenAI-only）、远程图片代理、本地图片文件服务与删除、提示词润色代理。
- **目标读者**：项目维护者、实现者、审查者。
- **适用范围**：GPT Image Playground 的 Tauri 桌面端请求代理服务规划。
- **核心边界**：本文持续记录分析、实施方案、阶段推进、已完成对接和后续跟进项。

## 阶段推进记录

### Phase 1：Rust `proxy_images` 主链路第一版

**实施状态**：已完成首轮编码与验证。

**范围摘要**：桌面端“服务器中转”通过 `invoke('proxy_images')` 进入 Rust `reqwest` 代理；Web / Docker / Vercel 继续保留 `/api/images`。

### Phase 2：Gemini Rust 图像代理 + Rust 提示词润色 Tauri command

**实施状态**：已完成编码、验证与可实测 release 产物构建。

**已完成对接**：

1. **Gemini Rust 图像生成与编辑**
   - 新增 `src-tauri/src/proxy/gemini.rs`：`generate()`、`edit()` 函数，调用 Gemini `generateContent` API。
   - `ProxyProvider` 枚举新增 `Google` 变体。
   - `proxy_images` command 按 provider 路由到 Gemini 或 OpenAI 兼容链路。
   - 支持生成（单文本 prompt）和编辑（prompt + inline base64 图片）。
   - 请求体显式设置 `generationConfig.responseModalities = ["IMAGE"]`，并支持 size → aspectRatio 映射（1:1、3:2、2:3）。
   - 解析 Gemini 响应中的 `inlineData` 图片，返回与现有结构兼容的 `{ images, usage }`。
   - Gemini 编辑不支持蒙版：在 TS `buildDesktopProxyImagesRequest()` 中已拦截。
   - Gemini 自定义 Base URL 复用 Rust `validate_public_http_base_url()`，默认拒绝 localhost / 私网 / metadata 地址。

2. **Rust 提示词润色 Tauri command**
   - 新增 `src-tauri/src/proxy/prompt_polish.rs`：`prompt_polish()` 函数，调用 OpenAI-compatible Chat Completions API。
   - 新增 `proxy_prompt_polish` Tauri command，注册于 `lib.rs`。
   - 自动构造 `/v1/chat/completions` URL（兼容多种 base URL 格式）。
   - 内置默认 system prompt，支持自定义 model / system prompt / thinking 参数。
   - 提示词润色自定义 Base URL 复用 Rust URL 安全校验。
   - 前端 `src/lib/prompt-polish.ts` 增加 Tauri 桌面分支：`isTauriDesktop()` → `invoke('proxy_prompt_polish')`。

3. **Tauri 版本链路对齐**：
   - 前端 `@tauri-apps/api` 固定为 `2.11.0`，避免 caret 自动漂移造成 CLI minor mismatch。
   - Rust `tauri` 升级到 `2.11.0`，`tauri-build` 升级到 `2.6.0`。
   - 保持桌面端不引入 Node runtime / Node server。

4. **验证结果**：
    - `npm ci --dry-run --ignore-scripts` 已通过，确认 `package.json` 与 `package-lock.json` 一致。
    - Rust `cargo check` 已通过。
    - Rust `cargo test` 已通过：55 个测试。
    - 前端 LSP 对 `src/lib/taskExecutor.ts`、`src/lib/prompt-polish.ts`、`src/lib/desktop-runtime.ts` 无诊断。
    - `npm run lint` 已通过。
    - `npm run test` 已通过：198 个测试。
   - `npm run build` 已通过，Web / API Routes 行为保持。
   - `npm run build:desktop` 已通过，桌面静态导出只包含 `/` 和 `/_not-found`。
   - `npx @tauri-apps/cli build --verbose` 已通过并产出可实测 macOS arm64 release 文件。

5. **本地实测产物**：
   - 可执行二进制：`src-tauri/target/release/app`
   - macOS App：`src-tauri/target/release/bundle/macos/GPT Image Playground.app`
   - macOS DMG：`src-tauri/target/release/bundle/dmg/GPT Image Playground_2.4.1_aarch64.dmg`

**本阶段明确未完成 / 下一阶段跟进**：

1. **流式预览尚未接入桌面 Rust 中转**
   - 当前桌面端 Rust 中转遇到 `enableStreaming=true` 会返回明确提示：请关闭流式预览后重试。
   - 后续可用 Tauri event/channel 模拟现有 SSE partial image 事件。

2. **`/api/image-proxy` 尚未迁移到 Rust**
   - 远程图片安全代理仍是第三阶段跟进项。

3. **本地文件服务 / `/api/image/[filename]` 尚未迁移**
   - 当前桌面端 Rust 返回 base64 后仍会走前端 IndexedDB fallback。
   - 后续如果要在桌面端使用 Rust 文件落盘，需要单独设计本地文件读写和安全访问策略。

4. **高级选项：允许本机 / 内网 Base URL 尚未开放**
   - 当前 Rust 安全策略默认拒绝 localhost 和私网地址。
   - 如果要支持本地模型服务，应新增显式高级开关，而不是默认放开。

5. **桌面端 `/api/config`、`/api/auth-status`、`/api/prompt-templates` 尚未 Rust 化**
   - 这些接口复杂度低，但仍属于桌面静态导出下不可用的 Next API Route。
   - 下一阶段可以和 `image-proxy` / 文件服务一起做“桌面 API Route 清零”收尾。

**实现后 5 路审查结果**：

- **总体结论**：PASS，无阻塞项。
- **Goal & Constraint Verification**：PASS，高置信；确认 Rust-only 桌面代理、Web API Routes 保持、`src/app/api` 恢复、文档记录和可实测产物均满足要求。
- **Code Quality Review**：PASS，高置信；架构分层清晰，TS/Rust IPC camelCase 映射一致，桌面/Web 分支隔离良好。非阻塞建议包括 Gemini `finishReason` 更细错误映射、IPC 大图传输上限和少量工具函数抽取。
- **Security Review**：PASS，最高发现为 MEDIUM；当前 SSRF 防护、禁止重定向、Rustls TLS、无本地 HTTP server 和错误输出截断满足 Phase 2。DNS pinning、provider 返回 URL 校验、IDN 规范化和 IPC 大小限制已列入后续硬化。
- **QA Execution**：PASS；重新验证了 `npm ci --dry-run --ignore-scripts`、Rust `cargo check/test`、`npm run lint`、`npm run test`、`npm run build`、`npm run build:desktop`、release 产物存在，以及 `src/app/api` 可恢复且当前已恢复。
- **Context Mining**：PASS with conditions；发现 `/api/image-proxy`、streaming、`CLIENT_DIRECT_LINK_PRIORITY` 桌面例外、其它 API Route Rust 化等仍是 Phase 3+ 用户可见跟进项，均已在本文列入 backlog。

**实现后审查补充的非阻塞跟进项**：

1. **DNS 绑定一致性增强**
   - 当前 Rust 端会在请求前解析域名并校验解析结果，但 `reqwest` 实际请求时会再次解析。
   - 下一阶段可考虑使用 `reqwest` 的固定解析 / address pinning 能力，避免极端 DNS rebinding 时间窗。

2. **IPC 图片大小限制**
   - 当前编辑模式通过 Tauri IPC 传递 `bytes: Vec<u8>` / `number[]`。
   - 下一阶段建议在 Rust `validate_request()` 中加入单文件和总大小限制，例如 50MB 单文件上限，避免异常大图片造成内存压力。

3. **IDN / Unicode hostname 规范化**
   - 当前 Base URL 会做协议、账号密码、localhost、私网 IP 和 DNS 解析校验。
   - 下一阶段可补充 IDN/punycode 规范化或直接要求 hostname 为 ASCII，降低同形异义域名混淆风险。

4. **Provider 返回 URL 的二次校验**
   - 当前 Rust 代理会接受 provider 返回的 `url` 并转成 `CompletedImage.path`。
   - 下一阶段建议对 provider 返回 URL 至少校验 scheme，例如只允许 `https://` 或明确支持的 `data:`。

5. **前端桌面分支单元测试**
   - 当前已有 Rust 单测、LSP、lint、Vitest 全量回归和 Web/Desktop build 验证。
   - 下一阶段建议新增 `desktop-runtime` / `executeProxyMode` 相关前端单测，mock `isTauriDesktop()` 和 `invoke()`，覆盖 Web 路由保持、Tauri invoke、Rust 错误展示。

 6. **`CLIENT_DIRECT_LINK_PRIORITY` 的桌面端例外策略**
    - 当前连接策略仍是 Web / Desktop 共用；如果配置了非官方 Base URL 且启用直连优先，UI 可能仍锁定直连。
    - 因桌面 Rust 中转发生在用户本机且已有 URL 安全校验，下一阶段可评估在 Tauri 桌面端允许"服务器中转"代理自定义 Base URL。

### Phase 3：文件服务/删除 + 上传大小限制

**实施状态**：已完成编码、验证与测试集成。

**已完成对接**：

1. **远程图片安全代理（`/api/image-proxy` 替代）**
   - 已实现 `src-tauri/src/proxy/remote_image.rs`：`fetch_remote_image_with_proxy_check()` 函数。
   - 包含 SSRF 防护：`security::validate_url_domain()` 拒绝 localhost/私网/保留 IP/metadata 地址。
   - 限制重定向次数（3 次）和超时（20s）。
   - 校验 Content-Type 为 `image/*`，限制文件大小 30MB。
   - 前端通过 `invoke('proxy_remote_image')` 和 `invoke('proxy_remote_image_with_type')` 调用。

2. **本地图片文件服务/删除（`/api/image/[filename]` + `/api/image-delete` 替代）**
   - 已实现 `src-tauri/src/proxy/local_image.rs`：`serve_local_image`、`delete_local_images`、`save_local_image` commands。
   - 文件路径安全：`validate_filename()` 拒绝 `..`、`/`、`\` 等路径穿越。
   - 存储目录：`app.path().app_local_data_dir()/generated-images/`。
   - 前端通过 `invoke('serve_local_image')`、`invoke('delete_local_images')`、`invoke('save_local_image')` 调用。

3. **上传文件大小限制**
   - `save_local_image` 从 100MB 调整为 50MB 上限，与非流式 `MAX_FILE_BYTES` 保持一致。
   - `remote_image.rs` 已有 30MB 远程图片上限。

4. **编辑模式上传路径保持现有**
   - 编辑模式通过 IPC byte array (`ProxyImageFile { bytes: Vec<u8> }`) 传递文件，未重写。
   - `validate_request()` 在 `openai.rs` 中已有单文件 50MB 上限检查。

### Phase 4：OpenAI-only 桌面流式预览

**实施状态**：已完成编码、验证与前端 AbortSignal 防 stale 事件集成。

**已完成对接**：

1. **流式 SSE 基础设施**
   - `src-tauri/src/proxy/openai_streaming.rs`：`proxy_images_streaming()` command。
   - 使用 Tauri v2 `Channel<T>` 从 Rust 向 TS 推送事件。
   - **仅限 OpenAI**：Gemini/SenseNova/Seedream 返回明确错误提示，不启用流式。
   - 支持生成与编辑两种模式的流式请求。

2. **OpenAI SSE 事件解析**
   - `src-tauri/src/proxy/sse_parser.rs`：`parse_sse_events()` 函数。
   - 支持 `image_generation.partial_image`、`image_generation.completed`、`image_edit.partial_image`、`image_edit.completed`、`error`、`done` 六种事件类型。
   - 流式 chunk 解析：逐块读取 SSE stream 并转发到 Channel。
   - `partial_images` 参数使用 request 字段而非硬编码。

3. **TypeScript 流式处理**
   - `taskExecutor.ts`：`executeDesktopStreamingProxyMode()` 接收 Channel 事件。
   - 映射 `eventType` 到 `TaskProgress { type: 'streaming_partial', index, b64_json }`。
   - 通过 `processImagesForTask()` 和 `buildHistoryEntry()` 返回最终结果。
   - **仅限 OpenAI**：非 OpenAI provider 返回明确错误。

4. **AbortSignal 防 stale 事件支持**
   - Rust：不保留全局 abort flag，`ProxyState` 只持有共享 `reqwest::Client`，避免并发流式任务互相误取消。
   - TS：`signal.aborted` 后忽略后续 partial / done / error 事件，防止已取消任务继续污染 UI 或历史记录。
   - 后续如果需要硬取消网络请求，应实现 per-task cancellation token，而不是全局 `AtomicBool`。

5. **防御性编程**
   - Rust + TS 双重 provider 校验（`ProxyProvider::Openai` only）。
   - 流式请求前 `validate_streaming_request()` 检查 `enableStreaming`、prompt、model、文件大小。

6. **单元测试与验证**
   - SSE parser 覆盖 partial / completed / error / done、OpenAI `type` 数据行、`[DONE]` sentinel、多事件块、未知事件、畸形 JSON、尾随换行等边缘场景。
   - Rust `cargo check` 与 `cargo test` 已验证 streaming 模块签名、Channel 发送和上传大小限制可编译通过。

**Phase 3/4 全量验证结果**：

- `npm ci --dry-run --ignore-scripts` 已通过，确认 lockfile 与依赖声明一致。
- `rtk cargo check` 已通过。
- `rtk cargo test` 已通过：55 个 Rust 测试。
- 前端 LSP 对 `src/app/page.tsx`、`src/lib/desktop-runtime.ts`、`src/lib/taskExecutor.ts`、`src/lib/desktop-runtime.test.ts` 无诊断。
- `npm run lint` 已通过。
- `npm run test` 已通过：20 个测试文件 / 201 个测试。
- `npm run build` 已通过，Web build 保留 8 个 Next API Routes。
- `npm run build:desktop` 已通过，桌面静态导出只包含 `/` 和 `/_not-found`。
- `npx @tauri-apps/cli build --verbose` 已通过并产出 macOS arm64 release 文件。
- 桌面构建后已恢复 `src/app/api`，当前文件系统确认 8 个 `route.ts` 均存在。

**Phase 3/4 本地实测产物**：

- 可执行二进制：`src-tauri/target/release/app`（12,320,368 bytes）
- macOS App：`src-tauri/target/release/bundle/macos/GPT Image Playground.app`
- macOS DMG：`src-tauri/target/release/bundle/dmg/GPT Image Playground_2.4.1_aarch64.dmg`（约 5.0MB）

**Phase 3/4 5 路审查结果**：

- **总体结论**：PASS，无阻塞项。
- **Goal & Constraint Verification**：PASS，高置信；确认 Phase 3 远程/本地图片处理、Phase 4 OpenAI-only streaming、Rust-only 桌面代理、Web API Routes 保持、`src/app/api` 恢复、release 产物均满足目标。
- **QA Execution**：PASS；验证了 29 个场景，包括 Web build API Routes、desktop export 静态路由、Tauri release 打包、8 个 API route 恢复、OpenAI-only streaming gate、AbortSignal 防 stale 事件、远程图片 SSRF 防护、本地路径穿越防护与上传大小限制。
- **Code Quality Review**：PASS，高置信；实现分层清晰，Tauri Channel、SSE parser、Rust/TS IPC 类型映射、错误处理与测试覆盖均达到合并标准。非阻塞建议包括 streaming buffer 分配优化、未知 SSE 事件日志、`delete_local_images` 路径解析错误批处理一致性。
- **Security Review**：PASS，最高发现为 MEDIUM；SSRF、路径穿越、文件删除、IPC 尺寸、secret logging、依赖供应链均无阻塞问题。保留的中等风险是 redirect 目标 DNS 校验存在 TOCTOU 窗口，桌面 threat model 下不阻塞发布。
- **Context Mining**：PASS with conditions；未发现漏掉的 Phase 3/4 必做项，确认测试/构建/路由恢复闭环。非阻塞上下文包括后续可补 taskExecutor desktop branch 单测、DNS pinning、IDN 规范化与 provider 返回 URL 二次校验。

**Phase 3/4 后续非阻塞跟进项**：

1. **Rust-side hard cancellation**：当前 AbortSignal 只在前端防 stale progress/result；后续如需真正停止网络请求，应实现 per-task cancellation token，而不是全局 `AtomicBool`。
2. **Redirect DNS TOCTOU 硬化**：`remote_image.rs` redirect policy 当前同步校验 URL 语法/字面 host，DNS 私网校验在最终响应后执行；后续可实现 redirect target 预解析或 fixed resolver/address pinning。
3. **Streaming 总字节上限**：`openai_streaming.rs` 已逐 chunk 转发，但未设置总 SSE 字节上限；后续可加入累计 byte guard 防异常 provider 无限流。
4. **前端桌面分支更细单测**：当前已覆盖 `desktop-runtime` Tauri invoke/Channel；后续可 mock `isTauriDesktop()` / `invoke()` 增补 `taskExecutor` 桌面非流式与流式分支测试。
5. **桌面 API Route 清零收尾**：`/api/config`、`/api/auth-status`、`/api/prompt-templates` 仍是桌面静态导出下不可用的低复杂度接口，可在后续阶段 Rust 化。

## 结论先行

推荐方案：桌面端使用 **Tauri Commands + Rust reqwest** 实现代理转发；Web 部署继续保留现有 Next.js API Routes。

也就是说：

- **Web / Docker / Vercel**：继续走现有 `/api/images`、`/api/prompt-polish`、`/api/image-proxy`。
- **Tauri 桌面端**：当用户选择 **“服务器中转”** 时，不再请求被桌面构建删除的 `/api/images`，而是通过 Tauri `invoke()` 调用 Rust 后端，由 Rust 代理转发到 OpenAI / Gemini / SenseNova / Seedream / 自定义 Base URL；提示词润色也已在桌面端改走 Rust `proxy_prompt_polish`。
- **不引入 Node runtime / Node server 到桌面包**，避免明显增加用户安装体积。

第一版建议目标定义为：

> 在 Tauri 桌面端，当用户选择“服务器中转”时，前端不再请求 `/api/images`，而是调用 Rust `proxy_images` command；Rust 使用 `reqwest` 代理 OpenAI / OpenAI-compatible 图像生成与编辑请求，返回与现有 `/api/images` 兼容的 `{ images, usage }` 结构。Web 部署保持现状，不引入 Node 到桌面包。

## 当前代码链路确认

### 桌面构建会删除所有 Next API Routes

依据：`next.config.ts:5-20`

```ts
const isDesktop = !!process.env.DESKTOP_BUILD;

if (isDesktop) {
  const apiDir = resolve(process.cwd(), 'src/app/api');
  // 删除 src/app/api 下的所有目录
}

const nextConfig = {
  output: isDesktop ? 'export' : undefined,
}
```

这意味着桌面端打包后：

- `/api/images` 不存在。
- `/api/image-proxy` 不存在。
- `/api/prompt-polish` 不存在。
- `/api/image/[filename]` 不存在。

所以桌面端当前的“服务器中转”不是缺少一个 Node 进程，而是 **Next 服务端接口本来就被静态导出流程删除了**。

### 当前 Tauri Rust 后端几乎为空

依据：`src-tauri/src/lib.rs:1-16`

当前只有 Tauri Builder 和 debug log 插件，没有任何：

- Tauri command
- HTTP client
- Rust state
- Rust proxy
- capabilities 权限

依据：`src-tauri/Cargo.toml:20-25`

```toml
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
log = "0.4"
tauri = { version = "2.10.3", features = [] }
tauri-plugin-log = "2"
```

### 前端“服务器中转”核心入口

依据：`src/lib/config.ts:33,56`

```ts
connectionMode: 'proxy' | 'direct';
connectionMode: 'proxy',
```

默认是 `proxy`，即服务器中转。

依据：`src/lib/taskExecutor.ts:207-240`

```ts
if (params.connectionMode === 'direct') {
  return executeDirectMode(params, startTime);
} else {
  return executeProxyMode(params, startTime);
}
```

真正的中转请求在 `executeProxyMode()`：`src/lib/taskExecutor.ts:578-763`。

关键点：

- 构造 `FormData`。
- 添加 `mode`、`model`、`prompt`、`image_0`、`mask`、各种 provider API Key/Base URL。
- `fetch('/api/images', { method: 'POST', body: apiFormData })`。
- 支持 `text/event-stream` 流式预览。
- 非流式返回 `{ images, usage }`。

桌面端问题就在这里：桌面构建后 `/api/images` 已不存在。

### 受桌面删除 API Routes 影响的三个前端入口

核对到三个关键入口：

1. `src/lib/taskExecutor.ts:650`：`fetch('/api/images')`，主图像生成 / 编辑代理，最高优先级。
2. `src/lib/prompt-polish.ts:68`：`fetch('/api/prompt-polish')`，提示词润色代理，第二优先级。
3. `src/app/page.tsx:100-106`：`/api/image-proxy?url=...`，远程图片安全代理，第三优先级。

## 不推荐的路线

### 不推荐把 Node 集成进桌面应用

原因：

- Node runtime / Next server 会显著增加桌面包体积和复杂度。
- 还要处理端口、生命周期、日志、平台差异、Node 二进制打包。
- 当前桌面构建已经明确设计成 `output: 'export'` 静态资源模式，强行塞 Node 会逆着现有架构走。

### 不推荐嵌入 localhost HTTP server 作为第一方案

可以做，但不作为首选。

优点：

- 可以最大程度复用 `fetch('/api/images')` 的 HTTP/SSE 思维模型。
- `FormData`、SSE、文件上传语义天然接近现有 Next API。

缺点：

- 引入 Axum / Hyper / Tower 等服务端栈，体积和攻击面都更大。
- 需要本地端口管理，避免端口冲突。
- Windows / macOS 防火墙、安全软件可能对本地监听更敏感。
- 还要解决前端如何知道端口、CORS、生命周期关闭等问题。

用户核心诉求是 **不要因为 Node 增加体积负担**，所以 localhost server 不是最克制的方案。

## 推荐架构

### 桌面端新增 Rust 代理适配

```txt
UI 选择“服务器中转”
  ↓
taskExecutor.executeProxyMode()
  ↓
运行在 Tauri 桌面？
  ├─ 是：invoke('proxy_images', payload) → Rust reqwest → Provider API
  └─ 否：fetch('/api/images') → Next API Route → Provider API
```

优势：

- 不需要 Node。
- 不需要本地端口。
- 不暴露 localhost server。
- Rust 端可统一做 URL 安全校验、超时、错误映射。
- 前端只需要在 `executeProxyMode()` 内部增加桌面分支，UI 和任务管理基本不用动。
- Web 部署不受影响。

## 功能边界建议

### 第一阶段必须覆盖

第一阶段建议聚焦 `/api/images` 的等价能力，因为它直接对应“服务器中转”。

覆盖范围：

- OpenAI 图像生成：`mode=generate`。
- OpenAI 图像编辑：`mode=edit`。
- API Key / Base URL 从 UI 配置传入 Rust。
- 自定义 Base URL。
- 基础 `provider_options`。
- 非流式返回 `{ images, usage }`。
- 返回结构保持兼容 `ProxyImagesResponse`。

也就是前端最终仍然拿到：

```ts
{
  images: CompletedImage[];
  usage?: ProviderUsage;
}
```

这样可以最大程度复用 `processImagesForTask()`、history、任务状态、错误展示。

### 第一阶段不要完整复制 800 行 `/api/images`

`src/app/api/images/route.ts` 有 803 行，里面包含：

- OpenAI
- Gemini
- SenseNova
- Seedream
- 自定义模型
- 文件系统保存
- IndexedDB 模式
- `APP_PASSWORD`
- `CLIENT_DIRECT_LINK_PRIORITY`
- SSE streaming
- 多 provider 参数合并
- 错误格式化
- usage 统计

一次性完整迁移到 Rust 风险很高。建议按阶段推进：

1. OpenAI generate/edit 非流式打通。
2. 多 provider parity。
3. streaming partial images。
4. prompt polish。
5. image proxy。
6. 本地文件服务 / 更完整安全策略。

## 具体实现规划

### Phase 0：桌面运行时检测与传输适配

新增一个前端运行时判断工具，例如：

- `src/lib/desktop-runtime.ts`
- 或 `src/lib/tauri-runtime.ts`

职责：

- 判断当前是否运行在 Tauri 桌面端。
- 懒加载 `@tauri-apps/api/core` 的 `invoke`，避免影响 Web 构建。
- 封装 `invokeDesktopCommand()`，避免业务代码到处直接 import Tauri API。

需要新增前端依赖：

```json
"@tauri-apps/api": "^2"
```

这是前端 JS API，不是 Node runtime，不会引入 Node 服务端体积。

### Phase 1：Rust 代理核心模块

建议 Rust 目录结构：

```txt
src-tauri/src/
  lib.rs
  proxy/
    mod.rs
    commands.rs
    error.rs
    security.rs
    openai.rs
    types.rs
```

#### `types.rs`

定义前端传入 Rust 的结构：

- `ProxyImagesRequest`
- `ProxyImageGenerateRequest`
- `ProxyImageEditRequest`
- `ProxyCredentialConfig`
- `ProxyProviderOptions`
- `ProxyImagesResponse`
- `CompletedImage`
- `ProviderUsage`

这里要尽量对齐前端 `TaskExecutionParams` 和现有 `/api/images` contract。

#### `commands.rs`

注册 Tauri command：

```rust
#[tauri::command]
async fn proxy_images(request: ProxyImagesRequest) -> Result<ProxyImagesResponse, ProxyError>
```

后续再加：

```rust
#[tauri::command]
async fn proxy_prompt_polish(...)

#[tauri::command]
async fn proxy_remote_image(...)
```

#### `openai.rs`

用 `reqwest` 直接请求 OpenAI-compatible API：

- `POST /v1/images/generations`
- `POST /v1/images/edits`
- 支持自定义 `base_url`
- 支持 `Authorization: Bearer ...`
- 支持 multipart edit 请求
- 解析返回的 `b64_json` / `usage`

#### `security.rs`

实现 URL 安全校验：

- 只允许 `http://` / `https://`。
- 默认拒绝：
  - `localhost`
  - `127.0.0.0/8`
  - `::1`
  - `169.254.169.254`
  - RFC1918 私网地址
  - IPv6 local / link-local / unique-local
- 限制 redirect 次数。
- 限制请求超时。
- 对用户自定义 Base URL 做 DNS 解析后校验。

注意：桌面端用户可能需要连本地模型服务。如果要支持 `localhost`，建议不要默认开放，而是后续加一个高级选项，例如“允许本机/内网 API Base URL”。

### Phase 2：前端 `executeProxyMode()` 桌面分支

修改点集中在 `src/lib/taskExecutor.ts:578-763`。

当前：

```ts
const response = await fetch('/api/images', {
  method: 'POST',
  body: apiFormData,
  headers,
  signal,
});
```

计划改为：

```txt
executeProxyMode()
  ↓
if isTauriDesktop()
  → executeDesktopRustProxyMode(params, startTime)
else
  → executeWebProxyMode(params, startTime)
```

其中：

- `executeWebProxyMode()` 保留现有 `/api/images` 逻辑。
- `executeDesktopRustProxyMode()` 把 `TaskExecutionParams` 转换成 Rust command payload。
- 返回值统一转回 `TaskResult | TaskError`。

这样 Web 行为不变，桌面行为变成 Rust 代理。

### Phase 3：文件上传处理

当前编辑模式使用浏览器 `File`：`src/lib/taskExecutor.ts:611-618`。

```ts
params.editImages.forEach((file, index) => {
  apiFormData.append(`image_${index}`, file, file.name);
});
apiFormData.append('mask', params.editMaskFile, params.editMaskFile.name);
```

桌面 Rust IPC 下不能直接把 `FormData` 原样给 Rust。建议第一版用：

```ts
{
  name: file.name,
  mimeType: file.type,
  bytes: Array.from(new Uint8Array(await file.arrayBuffer()))
}
```

或 base64。

更推荐 byte array，但要注意大图 IPC 成本。图片编辑通常数量有限，可接受；如果后续发现性能问题，再改为：

- 先写临时文件。
- Rust 读取临时路径。
- 或使用 Tauri FS / upload 插件能力。

第一阶段可以先用 bytes，降低实现复杂度。

### Phase 4：流式预览

当前 Web 代理支持 SSE：`src/lib/taskExecutor.ts:671-725`。

Rust command 不能直接返回浏览器 `ReadableStream`。建议分两步：

#### v1

先不支持桌面端 streaming。桌面端用户如果开启流式预览，返回明确提示：

```txt
桌面端 Rust 中转暂不支持流式预览，请关闭流式预览后重试。
```

这和当前 Gemini / SenseNova / Seedream 不支持 streaming 的处理方式一致。

#### v2

用 Tauri event/channel 模拟当前 SSE 事件。

Rust 解析 OpenAI SSE：

```txt
image_generation.partial_image
image_generation.completed
error
```

然后发 Tauri events：

```txt
image-proxy:partial
image-proxy:completed
image-proxy:done
image-proxy:error
```

前端 `executeDesktopRustProxyMode()` 订阅事件，并调用现有：

```ts
onProgress?.({ type: 'streaming_partial', index, b64_json })
```

这样 UI 的 streaming preview 逻辑可以继续复用。

## 多 Provider 迁移策略

现有 `/api/images` 已支持：

- OpenAI
- Google Gemini
- SenseNova
- Seedream
- OpenAI-compatible 自定义模型

建议不要第一期全量 Rust 重写。推荐顺序：

### v1：OpenAI 官方 / OpenAI-compatible

优先覆盖：

- `api.openai.com`
- 用户自定义 OpenAI-compatible Base URL

原因：

- 当前 `executeProxyMode()` 最核心路径就是 OpenAI 图像生成/编辑。
- OpenAI-compatible 可以复用一套 HTTP 逻辑。
- 解决用户最常见的 CORS 问题。

### v2：SenseNova / Seedream

这两个本身是 OpenAI-compatible provider，迁移成本相对可控。

### v3：Gemini

Gemini 的请求/响应模型不同，单独迁移。

## `APP_PASSWORD` 与 `CLIENT_DIRECT_LINK_PRIORITY`

### `APP_PASSWORD`

Web 端 `/api/images` 会校验 `APP_PASSWORD`：`src/app/api/images/route.ts:302-314`。

桌面端是否需要继续校验，需要审查时明确。

建议：

- **桌面端不强制复用 APP_PASSWORD**。
- 原因：桌面端请求发生在用户本机，不是公开 Web 服务。
- 但如果前端已有 `passwordHash`，Rust command 可以接受并保留字段，不作为 v1 必需逻辑。

### `CLIENT_DIRECT_LINK_PRIORITY`

现有逻辑会在非官方 Base URL 时锁定“客户端直连”：`src/lib/connection-policy.ts:95-134`。

这个策略对 Web 端合理：避免第三方中转流量消耗部署服务器带宽。

但桌面端 Rust 代理是在用户本机发请求，不消耗公共服务器，所以建议：

- Web 端维持现有锁定策略。
- Tauri 桌面端如果 Rust proxy 可用，可以允许“服务器中转”代理自定义 Base URL。
- Rust 必须做 URL 安全校验，避免恶意分享链接诱导访问内网 / metadata 地址。

## 需要修改的文件清单

### 必改

1. `src-tauri/Cargo.toml`：添加 Rust HTTP / base64 / URL / 错误处理相关依赖。
2. `src-tauri/src/lib.rs`：注册 command、管理共享 `reqwest::Client` 状态。
3. `src-tauri/src/proxy/*`：新增 Rust 代理模块。
4. `package.json`：添加 `@tauri-apps/api`。
5. `src/lib/taskExecutor.ts`：拆分 Web proxy 与 desktop Rust proxy 分支。
6. `src/lib/desktop-runtime.ts` 或类似文件：新增 Tauri runtime 检测和 invoke 封装。

### 第二阶段再改

1. `src/lib/prompt-polish.ts`：桌面端 `/api/prompt-polish` 改 Rust command。
2. `src/app/page.tsx`：桌面端 `/api/image-proxy` 改 Rust command 或 Rust 代理 URL 处理。
3. `src-tauri/capabilities/default.json`：如果使用 Tauri 插件权限，需要补充能力；纯 command + Rust `reqwest` 一般不需要开放前端 HTTP 权限。

## 测试与验收计划

编码阶段通过后，建议验收标准如下。

### Rust 单元测试

覆盖：

- Base URL 安全校验。
- 私网 IP 拒绝。
- Metadata 地址拒绝：`http://169.254.169.254/`。
- Redirect 次数限制。
- OpenAI 请求 payload 构造。
- 错误响应映射。
- 图片响应解析。

命令：

```bash
cd src-tauri
cargo test
```

### 前端单元测试

覆盖：

- Tauri desktop 检测逻辑。
- `executeProxyMode()` 在 Web 下仍走 `/api/images`。
- `executeProxyMode()` 在 Tauri 下走 `invoke('proxy_images')`。
- Rust command 返回错误时，前端展示 `TaskError`。

命令：

```bash
npm run test
```

### 类型与构建

```bash
npm run lint
npm run build
npm run build:desktop
cd src-tauri && cargo check
```

### 桌面端人工 / 自动验收

核心场景：

1. 桌面端选择“服务器中转”。
2. 填写 OpenAI API Key。
3. 使用官方 Base URL 生成图片。
4. 使用自定义 OpenAI-compatible Base URL 生成图片。
5. 编辑模式上传图片并生成。
6. 错误 API Key 返回可读错误，不崩溃。
7. 目标服务不支持 CORS 时，桌面端 Rust 中转仍可请求成功。
8. Web 模式 `/api/images` 不受影响。

## 建议实施顺序

如果审查通过，建议下一步按这个顺序编码：

1. 新增 Tauri runtime 检测与 `invoke` 封装。
2. 新增 Rust `proxy_images` command，先支持 OpenAI generate 非流式。
3. 接入 `executeProxyMode()` 桌面分支。
4. 支持 OpenAI edit 文件上传。
5. 加 URL 安全校验与超时。
6. 补 Rust / TS 测试。
7. 再扩展 SenseNova / Seedream / Gemini。
8. 最后处理 streaming、prompt polish、image proxy。

## 审查关注点

请重点审查以下问题：

1. 第一版是否接受 **OpenAI / OpenAI-compatible 非流式** 作为最小可交付范围？
2. 桌面端是否允许绕过 `CLIENT_DIRECT_LINK_PRIORITY`，改由 Rust 安全校验保护？
3. 桌面端是否需要复用 `APP_PASSWORD`？
4. 是否接受第一版用 IPC byte array 传编辑图片，后续再优化为临时文件路径？
5. streaming partial images 是否可以放到第二阶段？

## 最终建议

这个版本范围足够小，能先解决核心 CORS 问题，也不会一开始就陷入完整重写 Next API Routes 的大坑。

推荐审查通过后按 **OpenAI / OpenAI-compatible 非流式代理** 先打通桌面端“服务器中转”，再逐步补齐多 provider、streaming、prompt polish 和 image proxy。
