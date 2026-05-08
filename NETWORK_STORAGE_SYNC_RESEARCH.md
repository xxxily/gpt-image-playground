---
title: GPT Image Playground 网络存储同步可行性与改造规划
summary: 面向 S3 兼容对象存储与 WebDAV 的跨设备配置、历史图片同步调研与分阶段实施方案。
createdAt: 2026-05-07
status: research-plan
---

# GPT Image Playground 网络存储同步可行性与改造规划

> 目标：为当前项目增加兼容 S3 协议对象存储与 WebDAV 的网络存储能力，用于跨设备、跨平台同步应用配置、提示词/模板、历史生成记录与历史图片。

## 1. 结论摘要

### 1.1 可行性结论

| 方向 | 可行性 | 推荐优先级 | 结论 |
| --- | --- | --- | --- |
| S3 兼容对象存储 | 高 | P0 | 适合作为 MVP 首选。Web 端推荐“服务端签名 + 浏览器直传图片”，桌面端可走 Tauri 原生命令或同一签名协议。 |
| WebDAV | 中高 | P1 | 技术可行，但浏览器直连经常被 CORS、OPTIONS 鉴权、Basic Auth 暴露风险卡住。Web 端应走 Next API 代理，Tauri 桌面端可用原生 HTTP 直连。 |
| 全量自动同步 | 中 | P2 | 需要 manifest、同步队列、冲突处理、删除墓碑和限流重试。建议先手动同步，再做自动同步。 |
| 跨设备敏感配置同步 | 中 | P2 | API Key、S3 Secret、WebDAV 密码不能默认明文进 localStorage 或远端。必须默认脱敏，若同步则需要用户口令派生密钥加密或服务端/系统钥匙串托管。 |

### 1.2 推荐路线

1. **先把本地数据收敛成可导入/导出的同步快照**：配置、提示词历史、用户模板、图片历史、IndexedDB 图片 Blob、文件系统图片统一走 `SyncSnapshot` / `SyncManifest`。
2. **MVP 优先做 S3**：单租户、固定 bucket/prefix、服务端环境变量保存 S3 凭证、API 路由签发短期 presigned URL，浏览器用 PUT/GET 直传大图片。
3. **WebDAV 不做浏览器直连默认路径**：Web 端通过 `/api/storage/webdav/*` 代理；Tauri 端通过 Rust `reqwest` 直接访问 WebDAV，绕开 CORS。
4. **默认不同步敏感密钥**：应用 provider API Key、S3 Secret、WebDAV Password 只保存在当前设备或服务端环境；若用户明确开启“加密同步敏感配置”，再用口令派生密钥加密后同步。
5. **桌面端单独设计通道**：当前桌面构建会静态导出并隐藏 `src/app/api`，不能依赖 Next API 路由；必须新增 Tauri sync commands，或要求桌面端连接一个外部同步服务端。

## 2. 当前项目现状

### 2.1 技术栈与运行形态

- `package.json`：Next.js `16.2.4`、React `19`、Tauri `2.11.0`、Dexie `4.0.11`、OpenAI SDK `6.34.0`。
- `next.config.ts`：桌面构建时 `DESKTOP_BUILD=1`，`output: 'export'`，图片 `unoptimized`。
- `scripts/build-desktop.mjs`：桌面构建前会临时隐藏 `src/app/api`，构建结束再恢复，说明桌面包内没有 Next API 路由。
- `src-tauri/Cargo.toml`：已有 `reqwest`、`tokio`、`serde`、`base64` 等网络与异步基础，适合扩展 WebDAV/Tauri 原生命令。
- `src-tauri/src/lib.rs`：已通过 `invoke_handler` 暴露多项图片代理与本地图片命令，是新增 sync commands 的自然入口。

### 2.2 现有数据存储分布

| 数据 | 当前位置 | 文件证据 | 说明 |
| --- | --- | --- | --- |
| 应用配置 | `localStorage` key `gpt-image-playground-config` | `src/lib/config.ts` | `AppConfig` 包含 provider API Key/Base URL、自定义模型、图片存储模式、连接模式、桌面代理等。 |
| 图片历史元数据 | `localStorage` key `openaiImageHistory` | `src/lib/image-history.ts` | `HistoryMetadata[]`，记录 timestamp、prompt、model、cost、images、storageModeUsed 等。 |
| IndexedDB 图片 Blob | Dexie DB `ImageDB`，table `images` | `src/lib/db.ts` | 当前 schema 仅 `{ filename, blob }`，缺少 hash、mtime、syncStatus。 |
| Prompt 历史 | `localStorage` key `gpt-image-playground-prompt-history` | `src/lib/prompt-history.ts` | 简单数组，保留数量由配置控制。 |
| 用户提示词模板 | `localStorage` key `gpt-image-playground-user-prompt-templates` | `src/lib/prompt-template-storage.ts` | 已有 export/import JSON 结构，是同步快照的好基础。 |
| 文件系统图片 | `./generated-images` | `src/app/api/images/route.ts`、`src/app/api/image/[filename]/route.ts` | 本地/非 Vercel 默认保存到服务器文件系统。 |
| 删除确认偏好 | `localStorage` key `imageGenSkipDeleteConfirm` | `src/app/page.tsx` | 可并入设备偏好，不一定需要跨设备同步。 |

### 2.3 现有图片流

1. `src/lib/taskExecutor.ts` 根据 `imageStorageMode` 与运行环境决定 `fs` / `indexeddb`。
2. `src/app/api/images/route.ts` 在 `fs` 模式下把 base64 图片写入 `generated-images/`，并返回 `/api/image/{filename}`。
3. 若服务端返回 `b64_json` 且没有路径，`processImagesForTask()` 会把 Blob 写入 Dexie `db.images.put({ filename, blob })`，并使用 `URL.createObjectURL(blob)` 做展示。
4. `src/app/page.tsx` 首次加载 `loadImageHistory()`，history 变化后 `saveImageHistory(history)` 回写 localStorage。
5. `src/components/history-panel.tsx` 按 `storageModeUsed` 决定历史图来源：已有 `path` 直接用、`indexeddb` 走 `getImageSrc(filename)`、否则回退 `/api/image/{filename}`。

### 2.4 现有 UI 切入点

- `src/components/settings-dialog.tsx` 已有 `ProviderSection`、`SecretInput`、配置状态 badge、运行与存储配置区，适合新增“云存储同步”区块。
- `src/components/history-panel.tsx` 已有多选、下载、删除、预览、发送到编辑，适合新增同步状态 badge、手动上传/下载、冲突处理、迁移入口。
- `src/app/page.tsx` 是单页状态中心，当前用 React hooks + localStorage，没有全局 store。同步引擎应尽量封装在 `src/lib/sync/*` 与 hooks 中，避免继续膨胀 `page.tsx`。

## 3. 外部方案调研

### 3.1 S3 兼容对象存储

#### 推荐通信模式

| 模式 | 说明 | 适用性 |
| --- | --- | --- |
| 服务端代理全量转发 | 浏览器把文件发给 Next API，Next API 再上传 S3 | 安全但占用服务器带宽，Vercel/serverless 大文件容易超时。 |
| 服务端签名 + 浏览器直传 | Next API 只生成短期 presigned PUT/GET URL，浏览器直接和 S3 通信 | 推荐。凭证不进浏览器，图片大流量不经过应用服务器。 |
| 浏览器保存长期 S3 Secret 后直连 | 浏览器直接用 Access Key/Secret 签名 | 不推荐。XSS 可读取长期密钥。仅可作为高级自担风险模式，且必须加密存储。 |

#### 推荐库与服务差异

| 目标 | 推荐实现 | 关键注意事项 |
| --- | --- | --- |
| AWS S3 | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | 凭证在服务端；bucket CORS 需允许 GET/PUT/HEAD/DELETE 并暴露 ETag。 |
| Cloudflare R2 | AWS SDK v3 + R2 endpoint | 无出站流量费，适合图片历史；不支持 POST form upload；签名时的 Content-Type 必须和实际请求一致。 |
| MinIO | AWS SDK v3，`forcePathStyle: true` | 自托管友好；反向代理、CORS、路径风格和签名头容易踩坑。 |
| Backblaze B2 S3 | AWS SDK v3 + `https://s3.{region}.backblazeb2.com` | 不能用 Master Key，需创建 bucket 级 scoped application key。 |
| Aliyun OSS | 优先考虑官方 OSS Browser SDK/STS；S3 兼容层需单独验证 | Browser SDK 更成熟；CDN 与 bucket CORS 分开配置。 |

#### 基础 CORS 示例

```json
[
  {
    "AllowedOrigins": ["https://your-app.example.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 3.2 WebDAV

#### 可行性判断

WebDAV 对“用户已有 NAS/Nextcloud/ownCloud/Synology/QNAP”的吸引力很强，但浏览器环境里经常遇到以下问题：

- 默认不返回 `Access-Control-Allow-Origin`。
- `OPTIONS` 预检也要求认证，导致浏览器请求在真正发送前失败。
- `PROPFIND`、`MKCOL`、`MOVE`、`COPY`、`LOCK` 等方法需要额外 CORS methods。
- Basic/Digest Auth 每次请求都带凭证，浏览器侧保存风险高。
- 不同服务对 ETag、Depth、XML response 的格式差异较大。

#### 推荐实现

| 运行环境 | 推荐路径 | 说明 |
| --- | --- | --- |
| Web + Next API 可用 | 浏览器 -> `/api/storage/webdav/*` -> WebDAV server | 默认路径。凭证留服务端，绕开目标 WebDAV CORS。 |
| Vercel/serverless | 小文件配置可代理，大图片需谨慎 | WebDAV 大图片上传可能触发函数超时与请求体限制。 |
| Tauri 桌面端 | Tauri Rust `reqwest` 直接 WebDAV | 无浏览器 CORS 限制，适合 NAS 用户。 |
| 浏览器直连 WebDAV | 仅高级实验模式 | 需要用户自己配置反向代理 CORS，并接受凭证暴露风险。 |

#### WebDAV CORS 理想配置

```http
Access-Control-Allow-Origin: https://your-app.example.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: origin, content-type, accept, authorization, if-match, destination, overwrite, depth
Access-Control-Allow-Methods: GET, HEAD, POST, PUT, OPTIONS, MOVE, DELETE, COPY, LOCK, UNLOCK, PROPFIND, PROPPATCH, MKCOL
Access-Control-Expose-Headers: ETag, DAV, Last-Modified
Access-Control-Max-Age: 86400
```

## 4. 推荐总体架构

### 4.1 核心原则

1. **本地优先**：本地 IndexedDB / 文件系统仍是主数据源，远端是同步副本，不让网络故障阻塞图片生成。
2. **同步协议统一**：S3、WebDAV、Tauri 都实现同一套 `StorageProvider` 接口和 manifest/diff 逻辑。
3. **密钥默认不跨设备同步**：敏感凭证默认只保存在当前设备或服务端环境。
4. **图片大文件走直传或原生通道**：避免 Next API 代理成为带宽与超时瓶颈。
5. **删除必须可恢复**：使用 tombstone，不直接把“远端缺失”当作用户删除。
6. **单租户先行**：当前应用没有真实多用户身份系统，v1 按“单个部署/单个用户/一个 remote prefix”设计。

### 4.2 运行时拓扑

```text
Web 浏览器
  ├─ localStorage: 现有配置、历史元数据、提示词历史
  ├─ IndexedDB/Dexie: 图片 Blob + sync metadata + sync queue
  ├─ S3: 通过 Next API 签名后直传 PUT/GET
  └─ WebDAV: 通过 Next API 代理

Next.js 服务端 / Serverless
  ├─ /api/storage/s3/sign: 生成 presigned URL
  ├─ /api/storage/s3/list: 服务端 list/head/delete 可选代理
  ├─ /api/storage/webdav/*: WebDAV 代理与连接测试
  └─ 环境变量保存单租户远端存储凭证

Tauri 桌面端
  ├─ 静态导出页面，无内置 Next API 路由
  ├─ Rust commands: sync_test_connection / sync_upload / sync_download / sync_delete / sync_list
  ├─ WebDAV: reqwest 直连
  └─ S3: Rust SDK 或 SigV4 签名实现；凭证进入 OS keychain 或本地加密 vault
```

### 4.3 远端目录布局

建议使用版本化目录，便于未来升级：

```text
gpt-image-playground/
  v1/
    {syncProfileId}/
      manifest.json
      manifest.backup.json
      config/
        app-config.json
        prompt-history.json
        prompt-templates.json
      images/
        2026/
          05/
            1746612345678-0.png
      tombstones/
        tombstones.json
      devices/
        {deviceId}.json
```

说明：

- `syncProfileId`：v1 可由用户手动设置，或由 `APP_PASSWORD` hash / 随机安装 ID 派生。不要直接用邮箱或明文用户标识。
- `manifest.json`：远端同步事实表，所有客户端先读它再决定上传/下载/删除。
- `manifest.backup.json`：每次覆盖 manifest 前先备份，降低误同步风险。
- `devices/{deviceId}.json`：记录每台设备最后同步时间、客户端版本、能力标记。

## 5. 数据模型设计

### 5.1 AppConfig 扩展建议

`src/lib/config.ts` 可扩展非敏感同步配置：

```typescript
export type SyncProvider = 'none' | 's3' | 'webdav';
export type SyncMode = 'manual' | 'auto';
export type SyncSecretMode = 'server' | 'tauri-keychain' | 'encrypted-local' | 'insecure-local-dev';

export interface SyncConfig {
  enabled: boolean;
  provider: SyncProvider;
  mode: SyncMode;
  profileId: string;
  basePath: string;
  secretMode: SyncSecretMode;
  syncImages: boolean;
  syncHistory: boolean;
  syncPromptHistory: boolean;
  syncPromptTemplates: boolean;
  syncAppConfig: boolean;
  syncSensitiveConfig: boolean;
  conflictPolicy: 'newer-wins' | 'keep-both' | 'manual';
  maxConcurrentTransfers: number;
}
```

不要在 `AppConfig` 里默认增加明文 `s3SecretKey` / `webdavPassword`。可保存的远端非敏感字段包括：

- S3 endpoint、region、bucket、prefix、forcePathStyle。
- WebDAV base URL、remote path。
- 连接方式、是否自动同步、是否同步图片。

### 5.2 敏感凭证存储策略

| 模式 | Web | Tauri | 建议 |
| --- | --- | --- | --- |
| server env | 支持 | 不适用静态桌面 | Web MVP 默认。`.env.local` 保存 S3/WebDAV 凭证。 |
| tauri-keychain | 不支持 | 支持 | 桌面端推荐。可用 Rust `keyring` 或 Tauri store + OS keychain。 |
| encrypted-local | 支持 | 支持 | 用户输入同步口令，PBKDF2/Argon2 派生 AES-GCM key，加密后存 localStorage/IndexedDB。 |
| insecure-local-dev | 支持 | 支持 | 仅开发/高级实验，UI 必须强提醒，不作为默认。 |

### 5.3 Dexie schema 升级

当前 `src/lib/db.ts` 只有：

```typescript
images: '&filename'
```

建议升级为 v2：

```typescript
export type ImageSyncStatus =
  | 'local_only'
  | 'queued_upload'
  | 'synced'
  | 'queued_download'
  | 'queued_delete'
  | 'conflict'
  | 'error';

export interface ImageRecord {
  filename: string;
  blob: Blob;
  mimeType?: string;
  size?: number;
  localHash?: string;
  remoteHash?: string;
  remoteKey?: string;
  remoteProvider?: 's3' | 'webdav';
  lastModifiedLocal?: number;
  lastModifiedRemote?: number;
  syncStatus?: ImageSyncStatus;
  syncError?: string;
}
```

Dexie store 建议：

```typescript
this.version(2).stores({
  images: '&filename, syncStatus, remoteKey, localHash, lastModifiedLocal'
});
```

迁移策略：旧数据自动补 `lastModifiedLocal = Date.now()`、`syncStatus = 'local_only'`，hash 可延迟后台计算，避免升级时卡 UI。

### 5.4 HistoryMetadata 扩展建议

`src/types/history.ts` 当前 `HistoryImage` 只有 `filename` 与可选 `path`。建议扩展：

```typescript
export type HistoryImage = {
  filename: string;
  path?: string;
  remoteKey?: string;
  remoteUrl?: string;
  localHash?: string;
  remoteHash?: string;
  syncStatus?: ImageSyncStatus;
};
```

注意：`remoteUrl` 如果是 presigned URL 会过期，不能长期写入历史；更推荐长期保存 `remoteKey`，展示时再换短期下载 URL。

### 5.5 Manifest 设计

```typescript
export interface SyncManifest {
  schemaVersion: 1;
  appVersion: string;
  profileId: string;
  provider: 's3' | 'webdav';
  basePath: string;
  revision: string;
  updatedAt: string;
  updatedByDeviceId: string;
  entries: Record<string, SyncManifestEntry>;
  tombstones: Record<string, SyncTombstone>;
}

export interface SyncManifestEntry {
  kind: 'config' | 'prompt-history' | 'prompt-template' | 'image-history' | 'image-blob';
  key: string;
  remoteKey: string;
  size: number;
  hash: string;
  etag?: string;
  contentType?: string;
  createdAt: number;
  updatedAt: number;
  updatedByDeviceId: string;
}

export interface SyncTombstone {
  key: string;
  kind: SyncManifestEntry['kind'];
  deletedAt: number;
  deletedByDeviceId: string;
  remoteKey?: string;
  reason?: 'user_delete' | 'migration_cleanup';
}
```

## 6. 同步算法

### 6.1 手动同步流程

```text
用户点击“立即同步”
  1. 加载本地快照
     - AppConfig 非敏感字段
     - Prompt history
     - User prompt templates
     - Image history metadata
     - Dexie images / fs images 的 hash 与 mtime
  2. 测试远端连接
  3. 下载 remote manifest
  4. 三方比较：local snapshot / last synced snapshot / remote manifest
  5. 生成 sync plan
     - upload config/history/images
     - download remote-only entries
     - apply tombstones
     - conflict entries
  6. 用户确认高风险操作
     - 批量删除
     - 覆盖配置
     - 下载大量图片
  7. 执行队列，逐项更新状态
  8. 上传新 manifest，并保存 manifest.backup.json
```

### 6.2 冲突策略

| 数据 | 默认策略 | 说明 |
| --- | --- | --- |
| AppConfig 非敏感字段 | per-field LWW | 每个字段独立比较 `updatedAt`，减少覆盖范围。 |
| API Key 等敏感字段 | 不默认同步 | 若启用加密同步，按整体 encrypted vault LWW。 |
| Prompt history | 合并去重 | 按 prompt 文本去重，保留较新 timestamp。 |
| Prompt templates | ID 优先，冲突 keep-both | 同 ID 内容不同则保留双方，远端版本加后缀。 |
| Image history | append-mostly 合并 | 按 timestamp + image filename 去重。 |
| Image Blob | hash 优先，冲突 keep-both | 同 filename 不同 hash，生成 `_conflict_{deviceId}` 副本，历史记录指向各自版本。 |
| 删除 | tombstone | 不直接传播“远端缺失”，必须有 tombstone 才算删除。 |

### 6.3 删除安全

- 删除图片时先写 tombstone，再删除本地/远端对象。
- manifest 中 tombstone 至少保留 30 天或 10 次成功同步。
- 如果远端 manifest 对比发现超过 50% 对象突然缺失，视为“远端被清空/配置错误”，停止同步并要求用户确认，不自动把缺失传播到本地。
- 删除 API 需同时覆盖：
  - `src/app/api/image-delete/route.ts` 文件系统模式。
  - Dexie `db.images.delete(filename)`。
  - 远端 provider `delete(remoteKey)`。
  - History 元数据与 tombstone 更新。

### 6.4 自动同步策略

MVP 不建议默认开启自动同步。后续可分三层：

1. **启动时拉取**：应用加载后检查 manifest，有变更则提示用户。
2. **生成后上传**：每次生成图片后把图片与历史记录加入上传队列。
3. **后台周期同步**：在线状态下每 N 分钟同步一次，失败后指数退避。

浏览器可监听 `online/offline`，但不要假设 Background Sync API 在所有平台可用。Tauri 可用更稳定的原生后台任务，但要避免静默消耗用户流量。

## 7. 具体改造规划

### 7.1 新增目录建议

```text
src/lib/sync/
  types.ts
  manifest.ts
  snapshot.ts
  diff.ts
  merge.ts
  queue.ts
  hash.ts
  errors.ts
  storage-provider.ts
  providers/
    s3-client.ts
    webdav-client.ts
    local-mock.ts
  runtime/
    browser.ts
    server.ts
    tauri.ts

src/hooks/
  useSyncManager.ts

src/app/api/storage/
  s3/sign/route.ts
  s3/list/route.ts
  s3/delete/route.ts
  webdav/test/route.ts
  webdav/proxy/[...path]/route.ts
```

Tauri：

```text
src-tauri/src/sync/
  mod.rs
  types.rs
  s3.rs
  webdav.rs
  keychain.rs
  commands.rs
```

### 7.2 StorageProvider 接口

```typescript
export interface StorageProviderObject {
  key: string;
  size: number;
  etag?: string;
  hash?: string;
  lastModified?: number;
  contentType?: string;
}

export interface StorageProvider {
  readonly id: 's3' | 'webdav' | 'local-mock';
  testConnection(): Promise<{ ok: true } | { ok: false; message: string }>;
  putObject(input: {
    key: string;
    blob: Blob;
    contentType: string;
    expectedHash?: string;
  }): Promise<{ key: string; etag?: string; hash?: string }>;
  getObject(key: string): Promise<Blob>;
  headObject(key: string): Promise<StorageProviderObject | null>;
  listObjects(prefix: string): Promise<StorageProviderObject[]>;
  deleteObject(key: string): Promise<void>;
}
```

### 7.3 S3 API 设计

Web MVP 推荐服务端签名：

- `POST /api/storage/s3/sign-upload`
  - 输入：`key`、`contentType`、`contentLength`、`sha256`。
  - 输出：`url`、`method: 'PUT'`、`headers`、`expiresAt`。
  - 服务端必须校验 key 在允许 prefix 内，限制 size。
- `POST /api/storage/s3/sign-download`
  - 输入：`key`。
  - 输出：短期 GET URL。
- `POST /api/storage/s3/delete`
  - 输入：`keys[]`。
  - 服务端删除并返回逐项结果。
- `GET /api/storage/s3/list?prefix=...`
  - 服务端列举 remote objects，避免把 list 权限暴露给浏览器。

环境变量建议：

```dotenv
SYNC_PROVIDER=s3
SYNC_PROFILE_ID=default
SYNC_REMOTE_BASE_PATH=gpt-image-playground/v1/default

S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=gpt-image-playground
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_BASE_URL=
```

### 7.4 WebDAV API 设计

Web 端不默认直连 WebDAV，新增代理：

- `POST /api/storage/webdav/test`：校验 URL、认证、创建/读取测试文件。
- `PUT /api/storage/webdav/proxy/{encodedRemoteKey}`：上传对象。
- `GET /api/storage/webdav/proxy/{encodedRemoteKey}`：下载对象。
- `DELETE /api/storage/webdav/proxy/{encodedRemoteKey}`：删除对象。
- `PROPFIND` 可在服务端内部实现为 `listObjects(prefix)`，不要直接把 WebDAV XML 暴露给前端。

环境变量建议：

```dotenv
SYNC_PROVIDER=webdav
WEBDAV_BASE_URL=https://dav.example.com/remote.php/dav/files/user
WEBDAV_USERNAME=
WEBDAV_PASSWORD=
WEBDAV_REMOTE_BASE_PATH=gpt-image-playground/v1/default
```

注意：Vercel/serverless 上大图片经 WebDAV 代理上传会受超时与请求体限制影响，应在文档中标注“WebDAV 大图片推荐桌面端或自托管 Node 服务”。

### 7.5 UI 改造

#### SettingsDialog

在 `src/components/settings-dialog.tsx` 的“运行与存储”后新增 `ProviderSection title='云存储同步'`：

- 总开关：启用同步。
- Provider：无 / S3 / WebDAV。
- 同步模式：手动 / 自动。
- 同步内容：应用配置、提示词历史、用户模板、图片历史、图片文件。
- 敏感配置：默认关闭，开启时进入加密说明与口令设置。
- 运行环境提示：
  - Web + server env：推荐。
  - Web + 本地明文凭证：不推荐。
  - Tauri：建议使用系统钥匙串。
- 操作按钮：测试连接、立即同步、从远端恢复、迁移本地历史到远端、导出诊断信息。

#### HistoryPanel

在 `src/components/history-panel.tsx` 增加：

- 卡片级同步状态：本地、已同步、待上传、冲突、同步失败。
- 批量操作：上传已选、重新下载已选、解决冲突、同步删除。
- 冲突弹窗：保留本地、保留远端、保留两者。
- 远端缺失提示：如果缩略图本地缺失但远端存在，允许点击下载。

#### Page / Hook

新增 `useSyncManager`，避免把同步状态直接散落在 `src/app/page.tsx`：

- 管理同步队列、进度、错误、最后同步时间。
- 给 `HistoryPanel` 提供状态映射。
- 在生成完成后接收 `HistoryMetadata`，按配置决定是否入队上传。

### 7.6 桌面端改造

当前桌面端静态导出，无 Next API。需要新增 Tauri commands：

- `sync_test_connection`
- `sync_list_objects`
- `sync_upload_object`
- `sync_download_object`
- `sync_delete_object`
- `sync_get_secret` / `sync_set_secret`

WebDAV 可直接使用已有 `reqwest`。S3 有两种实现路线：

1. 引入 Rust AWS SDK / SigV4 签名，在 Tauri 端直接操作 S3。
2. 桌面端仍连接一个用户自托管 Next 服务获取 presigned URL。

推荐 v1 桌面独立可用，因此优先评估 Rust 端直接 S3；若包体或复杂度过高，可先把桌面 S3 标为 P1。

## 8. 分阶段实施路线

### Phase 0：数据盘点与本地快照能力

目标：不接入任何远端，先让本地数据可完整导出/导入。

- 定义 `SyncSnapshot`、`SyncManifest`、`StorageProvider` 类型。
- 实现 local snapshot：读取 `AppConfig`、image history、prompt history、prompt templates、Dexie images。
- 实现 hash 计算与进度回调。
- 实现导出 zip/json 功能，作为安全兜底。
- 为 Dexie 加 v2 schema，但保持旧数据兼容。

验收：

- 老用户打开不丢历史。
- 能导出所有本地历史元数据和 IndexedDB 图片。
- 能在新浏览器导入并恢复历史图片。

### Phase 1：S3 MVP（手动同步）

目标：单租户 Web 部署可把历史图片和元数据同步到 S3/R2/MinIO。

- 新增 S3 env 配置与 `/api/storage/s3/*` 签名接口。
- Settings UI 新增 S3 非敏感配置与连接测试。
- 实现 manifest 上传/下载。
- 手动“同步到远端”和“从远端恢复”。
- 图片上传使用 presigned PUT；历史展示下载使用短期 GET URL 或本地缓存。

验收：

- Cloudflare R2 或 MinIO 至少一个目标跑通。
- 浏览器不出现长期 S3 Secret。
- 断网/失败时队列可重试，不破坏本地历史。

### Phase 2：同步队列、删除墓碑与冲突处理

目标：从“手动备份”升级为可靠同步。

- 新增 sync queue 与 retry/backoff。
- 实现 tombstone 删除传播。
- 实现 bulk remote deletion guard。
- 实现图片 filename/hash 冲突 keep-both。
- HistoryPanel 展示同步状态和冲突处理。

验收：

- 两个浏览器设备交替生成/删除后能收敛。
- 远端误删不会自动清空本地。
- 冲突不会静默覆盖。

### Phase 3：WebDAV 支持

目标：支持 Nextcloud、Synology、QNAP、自托管 WebDAV。

- Web：实现 `/api/storage/webdav/*` 代理。
- Tauri：实现 Rust WebDAV 直连 commands。
- 文档明确 CORS/反代要求；浏览器直连仅实验。
- 对 PROPFIND XML 做统一解析，输出 provider-agnostic list 结果。

验收：

- 至少一个标准 WebDAV 服务跑通。
- Nextcloud/Synology 不能直连时，错误提示清晰说明原因。
- Tauri 可不依赖 Next API 访问 WebDAV。

### Phase 4：自动同步与加密同步

目标：改善体验与隐私。

- 启动时检查远端更新。
- 生成后自动入队上传。
- 用户口令派生密钥，加密同步敏感配置或全部 config payload。
- 可选端到端加密图片 Blob。

验收：

- 用户可选择只同步图片，不同步 API Key。
- 加密 payload 在远端不可读。
- 忘记口令时有明确不可恢复提示。

### Phase 5：生产硬化

目标：让功能可维护、可诊断。

- 同步诊断面板与日志导出。
- Provider 兼容性文档：R2、AWS S3、MinIO、Backblaze B2、Aliyun OSS、Nextcloud、Synology、QNAP。
- 限流、配额检测、大文件分片或续传评估。
- E2E 测试覆盖生成、同步、恢复、删除、冲突。

## 9. 安全风险与红线

### 9.1 必须遵守

- 不默认把 S3 Secret、WebDAV Password、provider API Key 明文写入 localStorage 或远端。
- 不记录完整 presigned URL 到日志，因为 URL 本身就是短期凭证。
- 服务端签名接口必须校验 object key 前缀，不能允许客户端传任意 bucket/key。
- 删除远端对象前必须有 tombstone 或用户明确操作。
- WebDAV 代理不能成为开放代理，必须限定目标 host/path。
- 若 `APP_PASSWORD` 是唯一访问控制，文档中必须标注这是单租户保护，不是多用户身份系统。

### 9.2 主要风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| XSS 读取本地密钥 | 远端存储被接管 | 默认服务端/钥匙串保存密钥；本地加密；CSP 加固。 |
| WebDAV CORS 失败 | 用户配置后无法连接 | 默认代理；清晰错误诊断；Tauri 直连。 |
| Vercel 函数超时 | WebDAV 大图同步失败 | S3 直传优先；WebDAV 大图推荐桌面/自托管。 |
| IndexedDB 配额不足 | 高分辨率历史丢失或保存失败 | 同步后可提供“仅保留缩略图/清理本地原图”；未来评估 OPFS。 |
| 远端误删被传播 | 本地历史被清空 | tombstone、bulk deletion guard、manifest backup。 |
| 多设备时钟漂移 | LWW 判断错误 | 尽量使用服务端响应时间/manifest revision；冲突时 keep-both。 |
| provider 兼容差异 | 某些 S3/WebDAV 失败 | provider profiles、连接测试、集成测试矩阵。 |

## 10. 测试计划

### 10.1 单元测试（Vitest）

- manifest parse/serialize/upgrade。
- diff local/remote snapshot。
- per-field LWW merge。
- prompt history 合并去重。
- image filename/hash 冲突 keep-both。
- tombstone GC 与 bulk deletion guard。
- object key sanitize，防路径穿越。

### 10.2 Provider Mock 测试

- `local-mock` provider 模拟 put/get/list/delete/head。
- S3 mock：本地 MinIO 或 fake provider。
- WebDAV mock：本地 WebDAV server 或 mock `StorageProvider`。

### 10.3 集成测试

- Next API：S3 sign upload/download/delete/list。
- WebDAV proxy：认证、路径限制、PROPFIND list、PUT/GET/DELETE。
- Dexie migration：v1 数据升级到 v2 后仍可读取旧图片。
- Tauri commands：Rust WebDAV list/upload/download/delete。

### 10.4 E2E 测试

- 生成图片 -> 入历史 -> 上传 -> 清空本地 -> 从远端恢复。
- 两个浏览器上下文模拟两台设备，交替生成与删除。
- 网络失败/恢复后队列重试。
- 冲突创建与 UI 解决。

### 10.5 安全测试

- localStorage 不出现 S3 Secret/WebDAV Password，除非显式 insecure dev 模式。
- 日志不出现 presigned URL、Authorization header、Secret。
- WebDAV proxy 拒绝非配置 host 和 `..` 路径。
- S3 sign API 拒绝超出 prefix、超大小、非法 contentType。

## 11. 需要提前决定的问题

1. **v1 是否只支持单租户？** 推荐是。当前项目没有多用户身份系统，多租户会显著扩大范围。
2. **默认远端 provider 是 R2 还是通用 S3？** 推荐文档以通用 S3 表达，示例用 Cloudflare R2 + MinIO。
3. **是否同步 provider API Key？** 推荐默认不同步，只同步非敏感 UI 配置；敏感项进入单独加密 vault。
4. **桌面端 S3 首版是否必须独立可用？** 如果必须，需要 Rust S3/SigV4；如果可以依赖外部服务端，可复用 presigned URL。
5. **本地图片同步后是否清理本地原图？** 推荐先不自动清理，后续提供“释放本地空间”手动功能。
6. **同步失败是否阻止图片生成？** 不阻止。同步是后台增强能力，生成主流程不能被远端故障拖垮。

## 12. 推荐近期行动清单

1. 新建 `src/lib/sync/types.ts`、`manifest.ts`、`snapshot.ts`，先完成本地 snapshot 导出。
2. 升级 Dexie schema 到 v2，补齐 sync metadata，但延迟 hash 计算。
3. 新增 SettingsDialog 的“云存储同步”UI，仅展示配置与测试连接，不接入自动同步。
4. 实现 S3 server env + presigned URL 的最小闭环，先支持 Cloudflare R2/MinIO。
5. 在 HistoryPanel 增加同步状态字段展示，先不做复杂冲突 UI。
6. 写 provider 文档与 CORS 示例，降低用户配置成本。

## 13. 调研来源与依据

- 项目代码：`package.json`、`next.config.ts`、`scripts/build-desktop.mjs`、`src/lib/config.ts`、`src/lib/image-history.ts`、`src/lib/db.ts`、`src/lib/taskExecutor.ts`、`src/app/api/images/route.ts`、`src/components/settings-dialog.tsx`、`src/components/history-panel.tsx`、`src-tauri/src/lib.rs`、`src-tauri/src/proxy/commands.rs`。
- 外部技术调研：S3 presigned URL、Cloudflare R2、MinIO、Backblaze B2、Aliyun OSS、WebDAV/Nextcloud/Synology/QNAP CORS、`webdav`/`tsdav` 客户端、IndexedDB/OPFS、本地优先同步与 tombstone 策略。
- 架构审查结论：强调 WebDAV 浏览器直连风险、凭证不能默认明文进 localStorage、桌面端无 Next API、必须先定义单租户 sync identity 与 Dexie 迁移策略。
