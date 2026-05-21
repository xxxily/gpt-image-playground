---
title: GPT Image Playground 云同步功能改进与协议扩展规划
summary: 在已落地 S3 兼容对象存储同步的基础上，系统化梳理现状、识别可改进点，并规划 WebDAV、网盘、Git、本地组网等更多云同步协议的支持路径。
createdAt: 2026-05-18
status: planning
relatedDocs:
  - ./NETWORK_STORAGE_SYNC_RESEARCH.md
  - ../sharing-and-sync.md
---

# GPT Image Playground 云同步功能改进与协议扩展规划

> 本文是 [`NETWORK_STORAGE_SYNC_RESEARCH.md`](./NETWORK_STORAGE_SYNC_RESEARCH.md) 的延续。前者是 0→1 的可行性研究，本文档面向 1→N：在 S3 兼容同步已实现的前提下，盘点当前实现的能力与缺口，规划下一阶段的可靠性、安全、可观测性提升，以及多种新协议的接入路径。

## 0. TL;DR

- **当前实现已覆盖**：S3 兼容协议（含 R2 / MinIO / B2 / 阿里云 OSS S3 兼容层）；浏览器直连 / Next 服务器中转 / Tauri 桌面三种传输模式；快照 + 内容寻址 + tombstone + 批量删除护栏；分作用域的自动同步与手动同步；分享链接携带同步配置；快照清单内置版本、device-id、父链路与备份指针。
- **优先级最高的改进**：① 持久化同步队列与离线恢复；② 端到端加密敏感配置；③ Tauri 端引入系统钥匙串；④ 引入冲突可视化与 keep-both 策略；⑤ 完善 manifest 紧凑化与 tombstone GC。
- **协议扩展首选**：WebDAV（Nextcloud / 坚果云 / Synology / QNAP）—— 用户基数大，桌面端可直连，Web 端用代理；之后是 OneDrive / Google Drive（OAuth），再是 Git/Gitea、阿里云 OSS / 腾讯云 COS 原生 SDK、SFTP、LAN/Syncthing。
- **新增交付物**：统一 `SyncBackend` 抽象（取代当前以 S3 为主线的实现），路由器式 provider 注册表，capability 声明，配置 schema 自适应渲染。

## 1. 当前云同步实现盘点

### 1.1 协议与传输

| 维度 | 当前状态 | 关键文件 |
| --- | --- | --- |
| 唯一支持的远端协议 | S3 兼容对象存储（AWS S3 / R2 / MinIO / B2 / 阿里云 OSS S3 兼容层） | `src/lib/sync/provider-config.ts` 中 `SyncProviderType = 's3'` |
| 浏览器直连 | 用 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` 在浏览器签名直连 | `src/lib/sync/sync-client.ts` 的 `createBrowserS3Client` |
| 服务器中转 | `/api/storage/s3/{object,sign,list,test,status}` 用环境变量保存凭据，APP_PASSWORD 鉴权 | `src/app/api/storage/s3/*` |
| Tauri 桌面 | 浏览器侧仍签名，PUT/GET/HEAD/DELETE 通过 `proxy_s3_*` Rust 命令绕过浏览器 CORS | `src-tauri/src/proxy/commands.rs` |
| 单租户隔离 | `profileId` + `prefix` 拼成 `gpt-image-playground/v1/{profileId}` | `src/lib/sync/key-validation.ts` |

### 1.2 数据模型与快照

- **`SnapshotManifest`**（`src/lib/sync/manifest.ts`）：schemaVersion 固定 v1；包含 `revision`、`deviceId`、`parentSnapshotId`、`previousManifestBackupKey`、`tombstones`、`syncMode`、`imageScopeSince`、可选 `visionTextHistory`。
- **内容寻址对象 key**：`{base}/images/{sha256}/{filename}`，新上传直接走内容寻址；旧 `{base}/images/{filename}` 仅作为遗留路径兼容。
- **快照目录**：`{base}/snapshots/{snapshotId}/manifest.json`，全局指针写入 `{base}/manifest.json`，并将上一份 manifest 备份到 `{base}/snapshots/{snapshotId}/backups/{previousSnapshotId}-manifest.json`。
- **AppConfig 脱敏**：`sanitizeAppConfigForSync` 删除全部 API key 字段（OpenAI / Gemini / SenseNova / Seedream / Polishing）以及 4 个设备本地字段；并把 `providerInstances` / `providerEndpoints` / `visionTextProviderInstances` 中的 `apiKey` 全部置空。
- **Dexie schema v4**：`images` 表只索引 filename，blob 配套字段含 `sha256`、`size`、`remoteKey`、`mimeType`、`syncStatus`、`lastModifiedLocal`。

### 1.3 同步算法

- **手动上传** (`uploadSnapshot`)：加载上一份 manifest → 构建新 manifest（计算 SHA-256，跳过已存在的内容寻址对象）→ 检查批量删除护栏（默认 50 个或 50%）→ 上传 manifest 备份 → 上传 snapshot manifest → 覆盖 `{base}/manifest.json`。
- **手动恢复** (`restoreFromSnapshot`)：下载 manifest → 选择 metadata / images / full → 跳过本地已经匹配 sha256 的对象 → 批量写 IndexedDB。
- **自动同步**：`src/app/page.tsx` 内 `autoSync*` refs 维护 in-memory 防抖队列；按 scope（appConfig / polishingPrompts / promptHistory / promptTemplates / imageHistory / imageBlobs / visionTextHistory / visionTextSourceImages）合并，默认 debounce 3s。
- **删除策略**：默认不开 `allowRemoteDeletion`，本地删除只产生 warning + 保留远端引用；显式开启后才发布 tombstone 并 `DeleteObject`。批量删除护栏（>50 张 或 >50%）默认拦截。
- **手机端优化**：`getRestoreImageDownloadConcurrency()` 在移动端 / ≤4 核降为 1 并发；恢复时只用 size + remoteKey 判断 skip，不在主线程读 blob。

### 1.4 配置与分享

- **配置存储**：`localStorage` key = `gpt-image-playground-sync-config`，结构含 `s3{endpoint,region,bucket,accessKeyId,secretAccessKey,forcePathStyle,allowRemoteDeletion,requestMode,prefix,profileId}` 与 `autoSync{enabled,scopes,debounceMs}`。
- **同步配置分享**：`encodeSyncConfigForShare` 把配置 base64 URL-safe 编码塞进分享链接的 `sdata` 字段；可选 `restoreOptions{autoRestore, restoreMetadata, imageRestoreScope, recentMs}`；建议配合分享密码加密（已支持）。
- **服务器中转门控**：`CLIENT_DIRECT_LINK_PRIORITY=1` 时强制走客户端直连/桌面，禁用中转，避免共享部署 DDoS 服务器流量。
- **profile 派生**：`S3_PROFILE_ID` 或 `APP_PASSWORD` 的 sha256 前 16 位，作为远端命名空间隔离。

### 1.5 已经具备的安全护栏

- 服务端中转接口：APP_PASSWORD 验证、basePrefix 与服务端配置精确匹配、object key 必须在 prefix 下、路径不含 `..` / `\` / null byte / 双斜杠。
- `verifyManifestRoundtrip`：再次校验文件名格式、object key 后缀必须是 `/images/{filename}` 或 `/images/{sha256}/{filename}`、appConfig 中不能出现敏感字段。
- 默认凭据权限：不要求 DeleteObject，本地删除不传播。
- 批量删除护栏 + manifest backup 双保险。
- 分享面板默认不勾选 API Key；DevTools 抑制 (`NEXT_PUBLIC_DISABLE_DEVTOOL_SCOPE=share`)。

## 2. 缺口与可改进点

按 **严重度**（影响数据安全/可用性）× **改造成本** 分级：

### 2.1 P0 — 数据安全 / 可用性硬伤

1. **明文 S3 密钥写入 localStorage**
   - 现状：客户端直连模式下，`accessKeyId` / `secretAccessKey` 以明文存进 `localStorage`，任何 XSS 都能直接窃取整桶访问权。`buildSyncConfigSharePayload` 也会把这些字段一起 base64 进分享链接。
   - 改造：为本地配置提供「口令派生密钥 + AES-GCM 加密」可选模式（PBKDF2 / Argon2 派生），开启后只在内存中持有解密结果；非加密模式 UI 显式标红。分享链接的 secret 字段强制要求分享密码加密。
2. **服务端 S3 配置无法在 UI 切换**
   - 现状：浏览器侧能填，但服务器中转走 `process.env`，部署后无法在前端切换 endpoint/bucket；多租户/不同 bucket 必须改 env 重启。
   - 改造：在 SSR 环境提供可选「服务端管理面板（仅 APP_PASSWORD 持有者）」或允许把服务端配置写入持久化 store（KV/Redis/file）。
3. **自动同步队列不持久化**
   - 现状：`autoSync*Ref` 全部在 React refs 里，浏览器关闭、刷新或意外崩溃都会丢失「待上传」状态。第二次进入时只能整体扫一遍，但生成中的图片若刚好上传到一半，没有 retry。
   - 改造：把队列落到 IndexedDB（新增 `syncQueue` 表），含 `kind / payload / attempts / nextRunAt / error`，刷新后可自恢复；与 sw/PWA 配合时考虑 Background Sync API。
4. **大对象只用单次 PUT**
   - 现状：图片或后续视频文件以单次 `PutObjectCommand` 写入，超过 5 MB 起就有网络波动失败重传整文件的代价；R2 单 PUT 最大 5 GB，但中间断网就要重来。
   - 改造：超过阈值（默认 8 MB）走 Multipart Upload（AWS SDK 自带 `Upload` helper）；记录已完成 partETag 以支持续传。
5. **Manifest 持续膨胀，没有压缩与 GC**
   - 现状：`JSON.stringify(manifest, null, 2)`，每次同步全量重写，imageHistory + visionTextHistory + images 会随使用线性增长；tombstones 只追加，从不清理。
   - 改造：① 写入时用紧凑 JSON + gzip（`Content-Encoding: gzip`）；② tombstone GC：保留 N 天 / N 次成功同步后裁剪；③ snapshot 历史按月归档，只保留最近 K 份在 `snapshots/`。
6. **缺少 manifest schema 迁移框架**
   - 现状：`MANIFEST_VERSION = 1` 写死，未来想加字段只能继续往可选字段里塞。
   - 改造：引入 `migrateManifest(from, to)` 注册表，每次升版本写一对 `up/down`；本次没改变结构时也至少补 `appVersion` 与 `producedBy` 元数据。

### 2.2 P1 — 体验与可靠性

7. **冲突无可视化，只有 keep-newer / merge-by-key**
   - 现状：`promptHistory` 走「同 prompt 去重」；`imageHistory` 走时间戳合并；图片 blob 看 sha256 + remoteKey，但若两台设备生成了同 filename 但 sha256 不同的图片，新设备会被旧 sha256 覆盖，没有提示。
   - 改造：① 检测到 filename 同、sha256 不同的图片时，自动产出 `{filename}.conflict.{deviceId}.png` 副本；② `HistoryPanel` 增加「冲突」徽标与手动选择面板；③ AppConfig 改为 per-field LWW + `updatedAt` 戳。
8. **Tauri 端没有用系统钥匙串**
   - 现状：桌面端的 S3 secret 仍走 localStorage（Tauri webview 的存储），不进 macOS Keychain / Windows DPAPI / Linux Secret Service。
   - 改造：引入 Rust `keyring` 或 `tauri-plugin-stronghold`，新增 `sync_get_secret` / `sync_set_secret` 命令；前端切到 secret-mode = `tauri-keychain` 后，secret 不再回写 localStorage。
9. **没有「下一次同步会做什么」的预览/差异面板**
   - 现状：`previewUploadSnapshot` / `previewRestoreSnapshot` 只返回数量统计，缺一个可读的「即将新增 X、覆盖 Y、删除 Z」清单 UI。
   - 改造：在 Settings 与 HistoryPanel 增加「预演」抽屉；删除/覆盖类操作必须先看预览再 confirm。
10. **SHA-256 重复计算 / 没有 mtime 短路**
    - 现状：每次上传扫描时对每个 blob 重新 `crypto.subtle.digest('SHA-256', ...)`，blob 没变化时也算一遍。
    - 改造：以 `(size, lastModifiedLocal)` 短路；只有元数据变化或上次失败的对象才重算 sha256。
11. **同步进度只到「张/件」粒度**
    - 现状：单张图片上传无字节级进度，进度条体感卡顿。
    - 改造：multipart upload 后天然有分片粒度；非 multipart 走 `XMLHttpRequest` + `progress` event 上报。
12. **断网/退化通信路径不够智能**
    - 现状：直连失败时返回 normalized error，但用户必须手动到 Settings 改 `requestMode`；不自动 fallback 到服务器中转或桌面端。
    - 改造：① 提供「智能模式」：直连 → 失败 → 自动询问用户是否切到 server / 桌面（如可用）；② 在线/离线检测：`navigator.onLine` + 周期性 HEAD `/manifest.json` 探活。
13. **没有 sync health / 活动历史 UI**
    - 现状：debug breadcrumbs 只保留最近 12 条，每次同步独立；用户看不到 30 天内的同步记录、错误率。
    - 改造：把 `SyncResult` 落地到 IndexedDB（`syncActivity` 表），新增「同步活动」抽屉；提供「导出诊断包」按钮（用于 issue）。

### 2.3 P2 — 长期与生态

14. **`StorageProvider` 接口被 S3 占据，没有真正的多 provider 抽象**
    - 现状：`createS3StorageProvider` 返回 `StorageProvider`，但所有上层算法（`uploadSnapshot` / `restoreFromSnapshot` / `signOperations` 等）直接吃 `SyncProviderConfig` 与 S3 API 形状，provider 只是个适配壳。
    - 改造：把 `SyncBackend` 拆出来：`SyncBackend.put/get/list/head/delete/multipartInit/multipartPart/multipartComplete`；上层算法只依赖 `SyncBackend`；S3、WebDAV、Drive 等通过工厂注入。
15. **没有 capability 声明**
    - 现状：算法默认所有 backend 都支持 `prefix list / metadata / sha256 metadata`，对 WebDAV/Drive 来说并不一定成立。
    - 改造：新增 `BackendCapabilities = { listing, customMetadata, contentAddressing, atomicRename, multipart, presignedUrl, range }`；同步算法依据能力分支。
16. **没有跨 backend 迁移**
    - 现状：从 S3 切到别的 provider 必须自己导出导入；缺一键迁移。
    - 改造：等多 backend 落地后提供「将远端 A 镜像到远端 B」一次性 job。
17. **没有端到端加密图片**
    - 现状：明文图片直接放对象存储。「私有桶 + 服务端凭据」=「provider 可读」。
    - 改造：可选 E2EE 模式：用户口令派生 key，逐文件 AES-GCM 加密（含原始 sha256/filename → manifest 内 nonce/cipherKey 索引），manifest 也加密；忘记口令 = 不可恢复，UI 强提醒。
18. **多语言：错误文案中英文混杂**
    - 现状：`normalizeS3Error` 拼接中文短语，但抛回的底层错误是英文。
    - 改造：归入 i18n（`src/lib/i18n/messages.ts`），按 locale 输出。
19. **没有自动化 E2E 测试**
    - 现状：只有 `sync-client.test.ts` 几个纯函数单测。
    - 改造：用 `@aws-sdk/client-s3` + Vitest + MinIO docker container（或 `s3rver`）做集成测试；用 Playwright 跑两 context 模拟两设备。
20. **设置面板膨胀**
    - 现状：`settings-dialog.tsx` 5900+ 行，云同步配置散在内部；新增 provider 后会更乱。
    - 改造：抽 `src/components/settings/cloud-sync/` 子目录：`backend-picker.tsx`、`s3-form.tsx`、`webdav-form.tsx`、`auto-sync-scope.tsx`、`secret-mode-picker.tsx`、`sync-health-panel.tsx`。

### 2.4 设计层面遗留问题

- **profile 复用 APP_PASSWORD**：若部署改了 APP_PASSWORD，远端命名空间会变，旧数据看不到——需要明示「迁移」流程或允许设置静态 `S3_PROFILE_ID`。
- **`sourceLabel` 字段未在 UI 暴露**：可在「快照浏览器」里展示「这份快照来自 device X / 浏览器 Y」。
- **未对接图片视频生成的新文件类型**：`VIDEO_GENERATION_REQUIREMENTS.md` 引入的视频文件如何同步？需要扩展 manifest 的 `images` 表为 `assets`，区分 image / video / audio。

## 3. 协议扩展规划

### 3.1 总览与决策矩阵

| 协议 / 平台 | 用户价值 | Web 端可行性 | 桌面端可行性 | 鉴权方式 | 建议优先级 |
| --- | --- | --- | --- | --- | --- |
| S3 兼容（已落地） | 高 | ✅ 已 | ✅ 已 | Access Key | — |
| WebDAV (Nextcloud / 坚果云 / Synology / QNAP / Box) | 极高 | ⚠️ 必须代理或 CORS 配置 | ✅ Rust `reqwest` 直连 | Basic / Bearer | **P0** |
| 阿里云 OSS（原生 SDK） | 高（中国大陆用户） | ✅ STS + Browser SDK | ✅ 通用 HTTP | STS / RAM Key | P1 |
| 腾讯云 COS | 中高 | ✅ STS / 临时签名 | ✅ | STS | P1 |
| OneDrive（个人 / 商业） | 高 | ✅ Graph API + OAuth | ✅ | OAuth2 | P1 |
| Google Drive | 高 | ✅ Drive API + OAuth | ⚠️ 桌面 OAuth 流程稍复杂 | OAuth2 | P1 |
| Dropbox | 中 | ✅ HTTP API | ✅ | OAuth2 | P2 |
| iCloud Drive | 中（仅 macOS / iOS） | ❌ | ✅ Tauri + FileProvider / mounted volume | 系统级 | P2 |
| Git / Gitea / GitHub | 中（适合 prompts 与配置，不适合大图） | ⚠️ via API（rate limit） | ✅ libgit2/rust git2 | PAT / OAuth | P2 |
| SFTP / SSH | 中 | ❌（浏览器无 SSH） | ✅ Rust `russh` | Key / Password | P2 |
| Syncthing / LAN 同步 | 中 | ❌ | ✅ 起 Syncthing 进程或挂载共享目录 | 设备 ID | P3 |
| IPFS / Filecoin | 低（特殊场景） | ✅ HTTP gateway | ✅ | gateway | P3 |
| 百度网盘 / 阿里云盘 | 中（中国大陆） | ⚠️ 私有 SDK + 反爬 | ✅ Rust 第三方 SDK（不稳定） | OAuth | P3 |

### 3.2 统一抽象：`SyncBackend` 与 `BackendCapabilities`

提议新增 `src/lib/sync/backend.ts`：

```typescript
export type SyncBackendKind = 's3' | 'webdav' | 'aliyun-oss' | 'tencent-cos' | 'onedrive' |
    'gdrive' | 'dropbox' | 'sftp' | 'git' | 'icloud-local' | 'syncthing' | 'fs-local';

export type BackendCapabilities = {
    listing: 'flat' | 'hierarchical';
    customMetadata: boolean;        // 能否在对象上挂 sha256 元数据
    contentAddressing: boolean;     // 路径里允许 hash 段
    atomicRename: boolean;          // 是否支持 atomic move / rename
    multipart: boolean;             // 是否支持分片上传
    presignedUrl: boolean;          // 是否能给浏览器签名直传 URL
    range: boolean;                 // GET 是否支持 Range
    deleteRequiresPermission: 'optional' | 'always';
    maxObjectSize?: number;         // 单对象大小上限
};

export interface SyncBackend {
    readonly kind: SyncBackendKind;
    readonly displayName: string;
    readonly capabilities: BackendCapabilities;
    testConnection(): Promise<{ ok: true } | { ok: false; message: string }>;
    put(input: { key: string; blob: Blob; contentType: string; sha256?: string;
        onProgress?: (sent: number, total: number) => void }): Promise<void>;
    get(key: string, opts?: { range?: { start: number; end?: number } }): Promise<Blob>;
    head(key: string): Promise<{ size: number; sha256?: string; etag?: string } | null>;
    list(prefix: string, opts?: { cursor?: string }): AsyncIterable<{ key: string; size: number; lastModified: string }>;
    delete(key: string): Promise<void>;
    // 可选：分片上传，只有 capabilities.multipart=true 时实现
    multipart?: {
        init(key: string, contentType: string): Promise<string>;
        part(uploadId: string, partNumber: number, blob: Blob): Promise<{ etag: string }>;
        complete(uploadId: string, parts: Array<{ partNumber: number; etag: string }>): Promise<void>;
        abort(uploadId: string): Promise<void>;
    };
}
```

上层算法（snapshot / restore / preview / queue）只依赖 `SyncBackend`：

- 没有 `customMetadata` 的 backend → 把 sha256 写进路径（content-addressed）或写一份 `_meta.json` 同伴文件。
- 没有 `multipart` 的 backend → 退化为单次 PUT；大文件预先用 `Blob.slice` 切并上传到 `parts/{hash}-{i}`，下载时再拼。
- 没有 `presignedUrl` 的 backend（WebDAV、Drive）→ Web 端必须走 server 代理或 Tauri 直连。

### 3.3 WebDAV 接入（P0）

#### 价值

NAS 家庭用户存量大（Synology / QNAP / TrueNAS），Nextcloud 是开源生态主流，坚果云覆盖中国办公场景，几乎所有「私有云盘」都暴露 WebDAV。

#### Web 端方案

- 默认走 **Next API 代理**：
  - `POST /api/storage/webdav/test` → 在服务端用 `fetch` 做 PROPFIND，把诊断结果返回前端。
  - `POST /api/storage/webdav/proxy` → body 描述 `{op: 'put'|'get'|'head'|'delete'|'propfind', path, headers, body}`，服务端透传到目标 WebDAV，凭据存在 `process.env.WEBDAV_*` 或服务端 KV。
  - 上传大文件用 chunked transfer encoding；下载用 stream + range（如目标 WebDAV 支持）。
- **不**默认浏览器直连 WebDAV（CORS + PROPFIND/MKCOL/MOVE 预检多半失败）。
- 提供「高级实验：浏览器直连」开关，文档列出反代要求与 CORS 头清单（已在研究文档 §3.2 给出）。

#### 桌面端方案

- Rust 侧用 `reqwest` + 简单 PROPFIND XML 解析（或引入 `hyper-rustls` + `quick-xml`）。
- 暴露 `webdav_test_connection / webdav_put / webdav_get / webdav_head / webdav_list / webdav_delete` 命令。
- 凭据写入 keyring。

#### 数据模型

- WebDAV 没有原生 metadata，sha256 必须走 **内容寻址 path**（已经是当前规范）或同伴 `.meta.json`。
- WebDAV `ETag` 可用作 head 校验；`Last-Modified` 可缓存。
- `PROPFIND Depth: 1` 返回 XML，需要 backend 内统一转 `{key, size, lastModified}`。

#### 注意事项

- 文件名转义：路径里出现中文/空格/`%`，必须使用标准 URL encoding，否则坚果云会 400。
- 部分 WebDAV（Synology）首次创建目录需要 `MKCOL`，需要在 `put` 内自动尝试 `MKCOL` 父目录。
- 删除护栏与 S3 一致。
- 上传巨量小文件时，PROPFIND list 性能差；按月分目录 `images/2026/05/`。

### 3.4 阿里云 OSS / 腾讯云 COS 原生（P1）

- 即便 S3 兼容层可用，原生 SDK 在以下方面更优：① 中国大陆访问稳定性；② STS 临时凭证只暴露读写部分前缀，比固定 Access Key 安全；③ 国内 CDN 联动。
- 推荐策略：在已有 `s3` backend 之外，新增 `aliyun-oss` 与 `tencent-cos`，复用 95% 算法，仅替换签名 / endpoint / metadata 命名（`x-oss-meta-` / `x-cos-meta-`）。
- STS：要求部署侧暴露一个「发 STS」的 API（不能在客户端直接持 RAM 主账号 secret），临时凭证 1h 有效。

### 3.5 OAuth 类网盘：OneDrive / Google Drive / Dropbox（P1–P2）

#### 共同点

- 鉴权：OAuth2 Authorization Code（带 PKCE）。Web 端走「弹窗」+ 回调 `/api/oauth/{provider}/callback`，桌面端走「打开默认浏览器 → loopback HTTP server 接 code」（Tauri 已有 `tauri-plugin-shell` + `tauri-plugin-deep-link`）。
- Token 管理：access token 短期，refresh token 长期；强烈建议存系统钥匙串（桌面）或服务端 KV（Web）。
- 单个文件 4 MB 以上必须用 upload session / resumable upload，强制要求 `multipart` 能力。

#### OneDrive

- API：Microsoft Graph `/me/drive/root:/{path}:/content`，大文件用 `createUploadSession` + 字节范围 PUT。
- 自定义元数据：可以放 `description`（极不优雅），更推荐同伴 `.meta.json`。

#### Google Drive

- API：Drive v3 `files.create` resumable upload；用 `appDataFolder` 隔离命名空间（普通用户看不到，反向避免误删）。
- 列表性能：必须用 `files.list` + `pageToken` + `q='parent' in parents`，list cost 高。
- 共享有 quota 限制：避免一次性几百次 list。

#### Dropbox

- API：`/files/upload` 单文件 ≤150 MB；超过用 `/files/upload_session/`。
- 元数据：`property_groups` 但需要预注册 template，推荐直接同伴 `.meta.json`。

### 3.6 Git / Gitea / GitHub（P2）

- 适合存 **prompts、模板、appConfig、manifest 元数据**；不适合存 GB 级图片库（需配合 Git LFS，并不是所有 self-hosted Gitea 都开 LFS）。
- 实现路径：桌面端用 `git2`（libgit2 binding）或调用系统 `git`；Web 端只能用 REST API（GitHub `repos/{owner}/{repo}/contents/{path}`），rate limit 5000/h 是硬上限。
- 优势：天然的版本历史、PR 评审、灾难恢复（一键 clone）；可发挥「prompt 仓库」的协作能力。
- 推荐放在「次要 backend」位置：仅同步 prompts / config，图片走另一个 backend。

### 3.7 SFTP（P2）

- 仅桌面端实现，Rust 用 `ssh2` / `russh-sftp`；提供 host/port/username/private-key/passphrase。
- 适合极客用户的家用服务器，操作语义最接近 fs；速度好。

### 3.8 iCloud Drive / 系统级文件同步（P2）

- 桌面端：把同步根目录设置为系统挂载的 iCloud Drive / OneDrive 客户端文件夹；本质上是「文件系统 backend (fs-local)」，让 OS 自带的同步软件接管。
- 优势：零代码、零运维、跨设备一致。劣势：Web 端没法访问。
- 实现成本最低，可作为「最简陋的 backend」首先落地。

### 3.9 LAN / Syncthing（P3）

- 通过 Tauri 启动 Syncthing 子进程，把同步根目录加入 Syncthing 设备组；适合在家庭多设备无云的场景。
- 不建议作为默认 backend，只作为 «高级» 提供。

## 4. 推荐分阶段路线

### Phase A — 抽象层与可靠性（与 P0 改进并行）

1. 抽取 `SyncBackend` / `BackendCapabilities` 接口（§3.2），把 S3 实现迁过去。
2. 引入 IndexedDB 持久化同步队列与活动日志（§2.2 改进 #3、#13）。
3. 接入 multipart upload；引入 byte-level 进度（§2.2 改进 #4、#11）。
4. 引入 tombstone GC + manifest 压缩（§2.1 改进 #5）；增加 manifest schema 迁移框架（§2.1 改进 #6）。
5. 智能传输模式选择（§2.2 改进 #12）。
6. Tauri 钥匙串集成（§2.2 改进 #8）。
7. 端到端加密敏感配置（§2.1 改进 #1，先做 config-only，图片 E2EE 留到后期）。

### Phase B — WebDAV（P0 协议）

1. 新增 `WebDavBackend`：Web 端代理 + Tauri 直连；CORS 文档化（参考 NETWORK_STORAGE_SYNC_RESEARCH §3.2）。
2. UI：BackendPicker → "S3 兼容" / "WebDAV / Nextcloud / 坚果云"；表单字段：base URL / username / password / remote path / 自签证书信任。
3. 同步算法适配：检测 capability，sha256 写入同伴 `_meta.json` 或内容寻址 path。
4. 端到端测试：Nextcloud Docker、Synology / QNAP 模拟器、坚果云真实账号。

### Phase C — 国内云原生 SDK

1. `AliyunOssBackend`（先支持 STS 模式，要求部署侧出 STS API）。
2. `TencentCosBackend`（同上）。
3. UI 表单与 i18n。
4. 文档：与现有 R2 / MinIO 推荐方案并列，给出"国内访问最稳"建议矩阵。

### Phase D — OAuth 网盘

1. 接入 OneDrive（首选，企业版用户多）。
2. 接入 Google Drive（用 `appDataFolder` 隔离）。
3. 接入 Dropbox。
4. OAuth Token 管理：Web 端服务端持久化（推荐自部署）；桌面端钥匙串。

### Phase E — 极客向 backend

1. SFTP（桌面端）。
2. Git / Gitea（只同步轻量元数据，配合 Git LFS）。
3. iCloud / fs-local（直接挂载系统文件夹）。
4. Syncthing 联动。
5. 跨 backend 迁移工具（§2.3 改进 #16）。

### Phase F — 长期演进

1. 全量端到端加密（图片 / 视频 / 配置一起）。
2. Manifest CRDT 化（替换 LWW 为 Yjs / Automerge），多设备频繁写不再冲突。
3. PWA Background Sync + Web Push 通知。
4. 多用户身份系统（如果业务需要）。

## 5. 与现有架构的具体对接点

| 改造对象 | 当前文件 | 改造方向 |
| --- | --- | --- |
| Provider 抽象 | `src/lib/sync/storage-provider.ts`（24 行壳） | 升级为 `SyncBackend` + 工厂注册表；保持向后兼容 |
| 算法层 | `src/lib/sync/sync-client.ts`（2648 行） | 把直接吃 `SyncProviderConfig.s3` 的位置抽走，改成 `backend: SyncBackend`；按 capability 分支 |
| 配置 schema | `src/lib/sync/provider-config.ts` | `SyncProviderType` 由 `'s3'` 改为联合类型；按 `type` 区分嵌套子配置；现有 `s3` 字段保留以维持兼容 |
| API 路由 | `src/app/api/storage/s3/*` | 新增 `src/app/api/storage/webdav/*` 同形态目录；进一步抽出 `src/app/api/storage/{backend}/...`，共享 `validateObjectKey` |
| Tauri 命令 | `src-tauri/src/proxy/commands.rs` | 新增 `webdav_*` / `oauth_*` / `keychain_*` 模块；建议拆出 `src-tauri/src/sync/` 子模块 |
| Settings UI | `src/components/settings-dialog.tsx`（5900 行） | 拆 `src/components/settings/cloud-sync/`，按 backend 类型动态渲染表单 |
| HistoryPanel | `src/components/history-panel.tsx` | 增加冲突徽标、按 backend 显示来源 |
| 自动同步逻辑 | `src/app/page.tsx`（5073 行）顶部的 `autoSync*Ref` | 迁出到 `src/hooks/useAutoSync.ts`，引入持久化队列 |
| Dexie schema | `src/lib/db.ts`（v4） | 新增 `syncQueue` 与 `syncActivity` 表 (v5)；保持 `images` 表不变以避免移动端升级阻塞 |
| 国际化 | `src/lib/i18n/messages.ts` | 同步错误文案 i18n 化 |
| 测试 | `src/__tests__/sync-client.test.ts` | 引入 `vitest-environment-node` + MinIO docker 集成；用 mock backend 跑算法单元 |

## 6. 风险与对策

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 接口抽象期间破坏现有 S3 流程 | 老用户同步失败 | 灰度开关 `NEXT_PUBLIC_SYNC_BACKEND_V2=1`；同时保留旧路径直至 N+1 版本 |
| WebDAV 代理被滥用为开放代理 | 安全 | 服务端强校验 base URL / host allowlist；APP_PASSWORD 鉴权 |
| OAuth refresh token 泄露 | 整个网盘账号被接管 | 仅在服务端 KV 或桌面钥匙串保存；UI 提供"撤销授权"按钮 |
| 多 backend 后 manifest 兼容性 | 跨 backend 迁移失败 | manifest 引入 `producedByBackend` 字段；迁移工具走「逐对象 copy」而非 manifest 共享 |
| Tauri keyring 在 Linux 桌面环境不一致 | 凭据保存失败 | 提供 fallback：用户口令加密文件保存到 `$XDG_DATA_HOME/gpt-image-playground/secrets.aes` |
| Manifest 压缩与旧客户端不兼容 | 老版本读不出新 manifest | 引入 `Content-Encoding: gzip` 时同步 manifest 内 `compressed: true` 字段；旧客户端检测到不识别字段则提示升级 |
| 图片 E2EE 后忘记口令 | 数据完全不可恢复 | 强提示 + 复原码（24 词 BIP39 风格）打印/导出 |

## 7. 测试与可观测性补强

- **单元**：`SyncBackend` mock；capability 分支；manifest 迁移；tombstone GC；queue 调度。
- **集成**：MinIO（S3）、Apache `mod_dav`（WebDAV）、Nextcloud docker（WebDAV 实战）、`s3rver` 备用。
- **E2E**：Playwright 模拟两浏览器 context 交替生成 / 删除 / 离线 / 恢复；恢复后 manifest 校验 + 图片 sha256 校验。
- **观察**：把 `SyncResult.debug` 接入 OpenTelemetry-like 日志（仅本地写入 IndexedDB，不外发）。提供"导出诊断"按钮。

## 8. 决策清单（需在动手前确认）

1. `SyncBackend` 抽象层是否在 v2 一次性切换，还是与 v1 并行？建议并行至少一个版本。
2. WebDAV Web 代理在 Vercel 部署能否承担大图片？大概率不行——文档需明确"WebDAV 大图请用桌面端或自托管 Node 服务"。
3. OAuth 类 backend 是否要求自部署（即 Web 端需要服务端 callback / token 储存）？建议是，并在 README 标注"OneDrive/Google Drive 仅在自部署模式下可用"。
4. 是否在 v2 加入图片 E2EE？建议先做 config E2EE，图片 E2EE 留下个 milestone（涉及 manifest 加密、迁移复杂度高）。
5. 多 backend 后的同步策略：是「同时同步到 A 与 B」还是「主备」？建议先做「单主 backend」+「跨 backend 迁移工具」，避免双写一致性陷阱。
6. profile 迁移：APP_PASSWORD 变更后是否提供「迁移旧 profile 命名空间到新 profile」？建议提供，并在 UI 增加"复制旧命名空间到当前 profile"按钮。

## 9. 近期可立刻动手的 6 件事

1. 抽取 `SyncBackend` 接口与 capability 模型（不改算法，先做编译期适配）。
2. IndexedDB v5：新增 `syncQueue` + `syncActivity` 表。
3. 切换 manifest 为紧凑 JSON + `Content-Encoding: gzip`，对端 fallback。
4. 引入 `tauri-plugin-keyring`（或 `tauri-plugin-stronghold`），让桌面端 secret 不进 localStorage。
5. 新增「同步预演」抽屉，可视化新增/覆盖/删除清单。
6. 在 `docs/sharing-and-sync.md` 增加「敏感凭据保存策略」章节，跟当前 P0 改进同步落地。

## 10. 参考实现与外部资料

- 已有研究：[`NETWORK_STORAGE_SYNC_RESEARCH.md`](./NETWORK_STORAGE_SYNC_RESEARCH.md)。
- 用户手册：[`docs/sharing-and-sync.md`](../sharing-and-sync.md)。
- 关键代码：`src/lib/sync/sync-client.ts`、`src/lib/sync/manifest.ts`、`src/lib/sync/provider-config.ts`、`src/lib/sync/key-validation.ts`、`src/app/api/storage/s3/*`、`src-tauri/src/proxy/commands.rs`。
- 外部参考：
  - Microsoft Graph Drive API（OneDrive）。
  - Google Drive v3 + `appDataFolder`。
  - Nextcloud WebDAV 规范 + 坚果云 WebDAV 兼容性说明。
  - Aliyun OSS / Tencent COS STS 文档。
  - rclone backend 列表（可作为「常见私有云盘」清单）。
  - Syncthing REST API（可作为 LAN 同步基础）。
  - libgit2 / git2-rs（Tauri 端 Git backend）。
