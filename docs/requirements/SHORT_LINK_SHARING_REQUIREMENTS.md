---
title: GPT Image Playground 分享短链功能需求文档
summary: 在现有普通分享、密码加密分享、分享 Profile、展示内容后台和审计体系基础上，新增由用户显式创建的短链能力，并补齐后台管理、访问统计、推荐内容关联、功能开关、创建口令、长度与安全护栏。
createdAt: 2026-05-21
status: planning
relatedDocs:
  - ../sharing-and-sync.md
  - ../展示内容与后台管理使用手册.md
  - ./INTERACTION_OPTIMIZATION_REQUIREMENTS.md
---

# GPT Image Playground 分享短链功能需求文档

## 0. 结论摘要

- 短链是 **Web 服务端能力**，不替代现有普通分享和密码加密分享；它只把已经生成好的分享 URL 存成一个短码，并通过 `/s/{code}` 跳转。
- 前端必须由用户点击 **创建短链** 才能调用创建接口。打开分享面板、切换选项、复制普通链接、生成加密链接、长度达到阈值都不得自动创建短链。
- 后台需要提供短链总开关、创建权限模式、创建口令、短码长度、过期策略、创建频控、敏感参数策略、统计保留期和推荐内容关联配置。
- 短链不能成为任意外链跳转器。普通用户创建的短链只允许指向当前站点可识别的分享入口；外部 URL 只允许管理员在后台显式创建或放行。
- 推荐内容复用现有分享展示内容体系：短链可绑定一个 `promoProfileId`，打开短链时由服务端把该 Profile 注入最终分享 URL，从而让不同短链展示不同推荐内容。
- 访问统计要可用但克制：记录总访问、唯一访客近似值、时间分布、来源域名、设备类型和最近访问；IP 只保存哈希或截断后的不可逆标识，并设置保留期。

## 1. 背景与现状

### 1.1 现有分享能力

当前项目已经具备：

- 普通分享：`src/lib/url-params.ts` 将提示词、模型、供应商端点、Base URL、API Key、自动生成、云同步配置、`promoProfileId` 等参数写入 URL。
- 密码加密分享：`src/lib/share-crypto.ts` 使用 PBKDF2 + AES-GCM 把分享参数加密到 `sdata`，可选用 `#key=` 携带解密密码。
- 分享面板长度提示：`src/components/share-dialog.tsx` 已按 1500 / 2000 / 4000 字符给出 URL 长度风险提示，并在严重长度时提示“建议生成短链或二维码”。
- 分享展示内容：后台创建分享展示组后生成公开 `Profile ID`，分享链接可携带 `promoProfileId`，前端按分享展示组 > 全局展示组 > 旧环境变量兜底的优先级读取。
- 后台基础能力：`/admin` 已有 SQLite 存储、管理员角色、审计日志、展示位/展示组/素材管理、系统设置页。

### 1.2 现有短板

- 长分享 URL 在微信、Slack、邮件客户端、二维码和社交平台中容易被截断。
- 含 `sdata`、云同步配置或长提示词的链接可读性差，也不便统计传播效果。
- 当前没有服务端短链实体，后台无法查看某个分享链接被访问多少次。
- 现有分享 Profile 只能由用户手动填入分享面板；后台无法在一个已分发短链上后置调整推荐内容。
- 如果短链自动生成，会随着用户每次改分享选项产生大量无用记录，因此必须采用显式创建。

## 2. 目标与非目标

### 2.1 V1 目标

1. **显式创建短链**：分享面板中新增“创建短链”按钮，只有用户点击按钮才创建短链。
2. **保留现有分享语义**：短链目标可以是普通分享 URL，也可以是密码加密分享 URL；打开短链后最终仍走现有 `parseUrlParams` / `decryptShareParams` / 分享配置确认流程。
3. **后台统一管理**：管理员可查看、搜索、停用、删除、编辑备注、设置过期时间、绑定推荐内容、查看访问统计。
4. **后台开关与口令**：管理员可开启/关闭短链功能，并设置创建短链时需要输入的口令。
5. **推荐内容关联**：每个短链可关联不同分享展示 Profile，使同一长链接在不同短链渠道下展示不同推荐内容。
6. **访问统计**：后台可查看短链访问总量、唯一访客近似值、最近访问、按天趋势、来源域名、设备类型。
7. **安全护栏**：短码不可枚举，目标 URL 严格校验，敏感参数有额外限制，创建和访问都有频控。
8. **跨运行时降级**：Web 自部署可完整使用；Tauri 静态包在未配置远端短链服务时隐藏或禁用创建入口。

### 2.2 非目标

- V1 不接入第三方短链平台。
- V1 不做营销自动化、AB 实验、归因转化漏斗，只提供基础访问统计。
- V1 不允许普通用户创建任意外部跳转短链。
- V1 不把短链创建做成分享面板的默认行为，也不按 URL 长度自动创建。
- V1 不在桌面本地维护一套离线短链服务；桌面端只能调用已部署的 Web 短链服务。

## 3. 核心概念

### 3.1 短链

短链是服务器保存的一条映射：

```text
https://当前站点/s/{code} -> 原始分享 URL
```

`code` 是服务端生成的随机短码。短链只负责跳转、统计和推荐内容注入，不重新解释分享参数。

### 3.2 目标 URL

目标 URL 是分享面板当前生成的完整 URL，可能包含：

- 普通查询参数：`prompt`、`model`、`providerInstance`、`baseUrl`、`apiKey`、`syncConfig`、`autostart`、`promoProfileId`。
- 加密参数：`sdata`。
- URL Fragment：`#key=`，用于自带解密密码的加密分享。

注意：浏览器访问某个 URL 时不会把 fragment 发送给服务器。但创建短链时前端可以把完整目标 URL 作为 POST body 发送给短链接口。因此 V1 必须明确处理是否允许把 `#key=` 存入短链目标。

### 3.3 推荐内容

推荐内容沿用现有“分享展示组 / 分享 Profile”体系：

- 后台继续通过 `/admin/promo` 创建分享展示组和素材。
- 短链只保存可选的 `promoProfileId` 关联。
- 打开短链时，如果短链绑定了 Profile，服务端在最终跳转 URL 中注入或覆盖公开 `promoProfileId` 参数。

## 4. 用户侧交互需求

### 4.1 分享面板入口

在现有分享面板的“生成的分享链接”区域新增短链区域：

- 显示当前长链接字符数。
- 保留现有“复制链接”按钮。
- 新增 **创建短链** 按钮。
- 创建成功后显示短链输入框和 **复制短链** 按钮。
- 若管理员关闭短链功能，显示“短链功能未开启”或直接隐藏创建入口。
- 若管理员要求创建口令，点击创建后出现口令输入框或弹窗。

按钮行为必须满足：

1. 打开分享面板不创建短链。
2. 修改任何分享选项不创建短链。
3. 普通复制长链接不创建短链。
4. URL 长度达到严重阈值也只提示，不自动创建短链。
5. 点击“创建短链”后按钮进入 loading/disabled，防止双击重复创建。
6. 同一次点击使用 `clientRequestId` 幂等；网络重试不得产生重复短链。

### 4.2 选项变化后的状态

短链是某一刻长链接的快照。创建后如果用户继续修改分享选项：

- 已生成短链仍展示，但标记为“基于上一次选择创建”。
- “复制短链”仍可用。
- “创建短链”按钮变为可再次点击，文案可为“为当前选择创建新短链”。
- 不自动更新旧短链目标，除非管理员在后台编辑。

### 4.3 口令输入

当后台设置创建模式为“需要口令”时：

- 前端点击“创建短链”后要求输入口令。
- 口令不写入 URL，不写入 localStorage。
- 可选支持“本次会话记住”，只放内存 state，刷新即清空。
- 口令错误显示统一错误，不暴露口令是否存在、是否过期、是否仅频控。
- 连续错误触发客户端和服务端节流。

### 4.4 敏感参数提示

如果目标 URL 包含敏感内容：

- 明文 `apiKey`：默认不允许创建短链；用户必须改用密码加密分享，除非后台显式允许。
- 明文 `syncConfig`：默认不允许创建短链；应使用密码加密分享。
- 加密 `sdata`：允许创建，但仍标记为“加密分享”。
- `#key=`：默认不建议存入短链；如果后台允许，前端必须显示二次确认，说明“短链数据库拿到完整目标 URL 的人也等同拿到解密密码”。

### 4.5 Tauri 与移动端

- Web 部署：完整支持创建和访问短链。
- Tauri 桌面静态包：如果能解析到 `NEXT_PUBLIC_SITE_URL` 或后台配置的短链服务地址，则调用远端接口；否则隐藏或禁用创建短链按钮。
- Tauri 桌面打开短链：短链是 Web URL，默认走系统浏览器或应用内 WebView 的现有分享接收逻辑。
- 移动端布局：短链创建区域必须堆叠良好，按钮高度满足触控要求，长短链输入框文本不溢出。

## 5. 后台管理需求

### 5.1 导航与页面

新增后台页面：

```text
/admin/short-links
/admin/short-links/{id}
/admin/settings 或 /admin/short-links/settings
```

后台导航新增“短链”入口。页面沿用现有 `Card`、`Tabs`、`Button`、`Input`、`Select`、`Dialog` 等组件，不使用浏览器原生 alert/confirm/prompt。

### 5.2 短链列表

列表字段：

- 短码。
- 短链 URL。
- 备注/标题。
- 状态：active / disabled / expired / deleted。
- 目标类型：普通分享 / 加密分享 / 含敏感参数 / 管理员外链。
- 绑定推荐内容：继承 / 无 / 指定 Profile。
- 访问次数。
- 唯一访客近似值。
- 最近访问时间。
- 过期时间。
- 创建来源：用户口令 / 管理员 / 系统导入。
- 创建时间。

列表能力：

- 搜索短码、备注、目标 URL hash、Profile ID。
- 按状态、创建来源、推荐 Profile、时间范围筛选。
- 按访问量、最近访问、创建时间排序。
- 单条复制短链。
- 单条停用/启用。
- 单条删除或软删除。
- 批量停用、批量导出 CSV。

### 5.3 短链详情

详情页展示：

- 短链 URL 和二维码占位能力（二维码可作为 P2）。
- 原始目标 URL 的脱敏预览。
- 敏感参数标记。
- 当前生效的最终跳转 URL 预览。
- 推荐内容关联。
- 访问统计卡片。
- 最近访问列表。
- 审计日志入口。

可编辑字段：

- 备注/标题。
- 状态。
- 过期时间。
- 最大访问次数。
- 推荐内容策略。
- 目标 URL（仅 owner/admin，且重新走安全校验）。

### 5.4 推荐内容绑定

短链推荐内容策略包含三种：

1. **继承长链接**：不改写目标 URL，保留目标 URL 中已有的 `promoProfileId`。
2. **不展示分享推荐**：跳转时移除目标 URL 中的 `promoProfileId`。
3. **绑定指定 Profile**：跳转时注入或覆盖为后台选择的分享 Profile。

绑定指定 Profile 时：

- 只能选择现有 `promo_share_profiles`。
- 列表显示 Profile 名称、公开 ID、状态、最近发布时间。
- 如果 Profile 被停用或删除，短链仍可跳转，但推荐内容降级为“无有效分享推荐”，前端继续走全局展示组兜底。
- 修改短链绑定后立即生效，短链 URL 不变。

### 5.5 访问统计

后台至少提供：

- 总访问次数。
- 近似唯一访客数。
- 今日 / 7 天 / 30 天访问次数。
- 最近访问时间。
- 按天趋势图或表格。
- 来源域名 Top N。
- 设备类型：desktop / mobile / tablet / bot / unknown。
- 浏览器/系统粗粒度统计。
- 最近访问列表：时间、来源域名、设备类型、国家/地区（如果不接 GeoIP 则不显示）、状态码。

隐私约束：

- 不保存原始 IP。
- `ipHash` 使用服务端密钥加盐哈希；盐应可按天或按部署固定密钥派生。
- `User-Agent` 可保存原文上限 512 字符，或保存解析后的粗粒度字段；后台默认展示粗粒度字段。
- `Referer` 只保存 origin/host，不保存完整路径和 query。
- 访问明细有保留期，默认 90 天；聚合日表可保留更久。

### 5.6 设置页

后台可配置：

- 短链功能：开启 / 关闭。
- 创建权限模式：
  - 关闭创建：已有短链仍可按状态跳转。
  - 仅管理员创建。
  - 管理员 + 口令创建。
  - 公开创建（不建议，默认关闭）。
- 创建口令：设置 / 重置 / 清除；只显示“已配置/未配置”，不回显明文。
- 短码默认长度：建议默认 10 或 12，允许范围 8-32。
- 是否允许自定义短码：默认仅管理员允许。
- 默认过期时间：永不过期 / 7 天 / 30 天 / 90 天 / 自定义。
- 最大有效期：防止口令创建永久链接，默认可设 180 天或不限。
- 单 IP / 单口令创建频控：例如 10 次/小时、100 次/天。
- 单目标 URL 最大长度：默认 8192，最高不超过 32768。
- 是否允许明文敏感目标：默认关闭。
- 是否允许保存 `#key=`：默认关闭或需要二次确认。
- 允许的目标来源：默认当前站点；可由管理员增加可信域名。
- 访问明细保留期。
- 无效短码访问频控。

设置应存入服务端数据库，并支持环境变量作为初始默认值。环境变量只做 bootstrap，不应成为后台唯一配置来源，否则无法满足“管理后台可以设置是否开启短链功能”的要求。

## 6. 服务端与 API 需求

### 6.1 公共创建接口

建议接口：

```text
GET  /api/share/short-links/settings
POST /api/share/short-links
GET  /s/{code}
HEAD /s/{code}
```

`GET /api/share/short-links/settings` 返回：

- `enabled`。
- `creationMode`。
- `passphraseRequired`。
- `minCodeLength` / `maxCodeLength`。
- `maxTargetUrlLength`。
- `allowInlineSecurePassword`。
- `sensitiveTargetPolicy`。

不得返回口令、hash、密钥或后台内部配置。

`POST /api/share/short-links` 请求：

```json
{
  "targetUrl": "https://example.com/?sdata=...",
  "clientRequestId": "uuid-or-random-id",
  "creationPassphrase": "optional",
  "requestedCode": "optional-admin-only-or-if-enabled",
  "note": "optional",
  "expiresAt": "optional ISO date"
}
```

响应：

```json
{
  "shortUrl": "https://example.com/s/abc123def0",
  "code": "abc123def0",
  "expiresAt": "2026-08-19T00:00:00.000Z",
  "warnings": ["encrypted-share", "inline-password-stored"]
}
```

创建接口要求：

- 校验功能开关和创建模式。
- 校验口令，口令错误统一返回 401/403。
- 校验 `targetUrl` 是当前站点可识别分享 URL。
- 拒绝 `javascript:`、`data:`、`file:`、协议相对 URL、localhost/private IP、未知外域。
- 拒绝递归短链目标，例如 `/s/{code}` 指向另一个 `/s/{code}`，避免链式跳转和统计污染。
- 按敏感策略拒绝或警告包含明文敏感参数的目标。
- 使用 `clientRequestId` 做幂等，防止双击或网络重试重复创建。
- 写审计日志。

### 6.2 跳转接口

`GET /s/{code}` 行为：

1. 校验短码格式。
2. 查询短链。
3. 判断状态、过期时间、最大访问次数。
4. 生成最终目标 URL。
5. 异步或快速同步记录访问事件。
6. 返回 302 或 307 跳转。

响应要求：

- 成功跳转设置 `Cache-Control: no-store` 或非常短 TTL，确保后台修改推荐 Profile 或停用后及时生效。
- 不存在、停用、过期统一返回主题化 404/410 页面，不泄露短码是否曾存在。
- 不把原始目标 URL 暴露在错误响应 body。
- HEAD 请求不记录完整访问，可只用于健康检查或记录为 `method=head`。

### 6.3 管理接口

建议接口：

```text
GET    /api/admin/short-links
POST   /api/admin/short-links
GET    /api/admin/short-links/{id}
PATCH  /api/admin/short-links/{id}
DELETE /api/admin/short-links/{id}
GET    /api/admin/short-links/{id}/visits
GET    /api/admin/short-links/{id}/stats
GET    /api/admin/short-link-settings
PATCH  /api/admin/short-link-settings
```

权限：

- `viewer` 可读列表、详情和统计。
- `admin` 可创建、编辑、停用、绑定推荐内容。
- `owner` 可删除、修改全局设置、允许外部域名、允许明文敏感目标。

所有 mutation 必须复用后台现有 CSRF/origin/session 校验和审计日志机制。

## 7. 数据模型建议

### 7.1 `short_links`

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | text primary key | 内部 ID |
| `code` | text unique | 短码 |
| `targetUrlEncrypted` | text | 加密后的目标 URL |
| `targetUrlHash` | text index | 目标 URL 的 SHA-256，用于搜索和幂等，不展示 |
| `targetSummaryJson` | text | 脱敏摘要：参数类型、是否加密、是否含敏感信息 |
| `status` | text | active / disabled / deleted |
| `promoMode` | text | inherit / none / override |
| `promoProfileId` | text nullable | 关联 `promo_share_profiles.id` |
| `note` | text nullable | 后台备注 |
| `createdByUserId` | text nullable | 管理员创建者 |
| `createdByType` | text | admin / passphrase / public |
| `creationKeyHash` | text nullable | 创建口令或授权来源的不可逆标识 |
| `expiresAt` | integer nullable | 过期时间 |
| `maxVisits` | integer nullable | 最大访问次数 |
| `visitCount` | integer | 总访问数缓存 |
| `uniqueVisitorCount` | integer | 近似唯一访客缓存 |
| `lastVisitedAt` | integer nullable | 最近访问 |
| `clientRequestId` | text nullable | 幂等键 |
| `createdAt` | integer | 创建时间 |
| `updatedAt` | integer | 更新时间 |

目标 URL 建议加密存储。可用服务端密钥派生 AES-GCM key；如果缺少加密密钥，至少必须禁止创建含明文敏感参数的短链。

### 7.2 `short_link_visits`

建议字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | text primary key | 访问记录 ID |
| `shortLinkId` | text index | 短链 ID |
| `visitedAt` | integer index | 访问时间 |
| `ipHash` | text index | 加盐 IP hash |
| `userAgentHash` | text nullable | UA hash |
| `refererHost` | text nullable | 来源域名 |
| `deviceType` | text | desktop / mobile / tablet / bot / unknown |
| `browser` | text nullable | 粗粒度浏览器 |
| `os` | text nullable | 粗粒度系统 |
| `country` | text nullable | 可选 GeoIP |
| `method` | text | GET / HEAD |
| `status` | text | redirected / expired / disabled / not_found |

### 7.3 `short_link_daily_stats`

为避免后台统计扫描明细表，建议维护日聚合表：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `shortLinkId` | text | 短链 ID |
| `dateKey` | text | YYYY-MM-DD |
| `visits` | integer | 当日访问 |
| `uniqueVisitors` | integer | 当日唯一访客近似值 |
| `topReferersJson` | text | Top 来源域名 |
| `deviceCountsJson` | text | 设备分布 |

### 7.4 `short_link_settings`

可以使用 key-value 表，也可以在已有后台设置模型中扩展。至少覆盖第 5.6 节配置项。

## 8. 短码生成与长度要求

### 8.1 默认策略

- 默认使用服务端 CSPRNG 生成。
- 字符集使用 URL-safe 且避免易混淆字符的 Base58，或使用 Base62。
- 默认长度建议为 10-12 位。
- 最小长度 8 位；小于 8 不允许配置。
- 最大长度 32 位；超出没有必要且影响可读性。
- 生成时最多重试 5 次碰撞；仍碰撞则提升长度或返回服务端错误。

参考熵：

| 字符集和长度 | 近似熵 | 建议 |
| --- | --- | --- |
| Base58 x 8 | 约 47 bit | 仅适合低流量且有频控 |
| Base58 x 10 | 约 58 bit | V1 默认下限 |
| Base58 x 12 | 约 70 bit | 更推荐的公共默认 |
| Base62 x 12 | 约 71 bit | 可选 |

### 8.2 自定义短码

自定义短码默认仅管理员可用。若后台允许口令创建者自定义短码，必须：

- 长度 4-64。
- 仅允许 `[A-Za-z0-9_-]`。
- 禁止 `admin`、`api`、`s`、`login`、`settings`、`promo`、`assets`、`_next` 等保留词。
- 禁止大小写混淆冲突；如果路由大小写敏感，后台列表仍应警告。
- 已占用时返回统一错误，不泄露其他短链详情。

## 9. URL 校验与安全要求

### 9.1 目标 URL 白名单

普通用户创建的目标 URL 必须满足：

- origin 是当前 Web 部署域名，或后台显式配置的可信域名。
- path 是应用分享入口路径，V1 可先限制为 `/`。
- query 中至少包含一个现有分享参数：`prompt`、`model`、`providerInstance`、`baseUrl`、`apiKey`、`syncConfig`、`autostart`、`promoProfileId`、`sdata`。
- 不允许目标继续指向 `/s/{code}`。

管理员后台创建可以放宽到可信外链，但必须显示“外部跳转”标记，并写入审计日志。

### 9.2 敏感信息策略

短链服务会把目标 URL 存入服务器数据库，因此比“复制长链接”多一个服务端持久化风险。

默认策略：

- 明文 API Key：拒绝。
- 明文云同步配置：拒绝。
- 加密 `sdata`：允许。
- `#key=`：拒绝或二次确认后允许，具体由后台开关控制。
- 私有/内网 Base URL：沿用现有公开 URL 安全策略，不得静默放行。

### 9.3 创建口令安全

- 创建口令不保存明文。
- 不使用裸 SHA-256 保存口令；应使用 Argon2id、scrypt、bcrypt，或至少使用强盐 + pepper 的慢哈希。
- 口令重置后，旧口令立即失效。
- 口令只控制“谁可以创建短链”，不应成为“谁可以访问短链”的密码。
- 如果后续需要访问密码，应另建短链访问密码功能，不复用创建口令。

### 9.4 防枚举和频控

- 短码足够长且随机。
- `/s/{code}` 对无效、删除、禁用、过期响应尽量统一，不返回“这个码存在但不可用”等细节。
- 对短时间大量无效短码访问做 IP 级频控。
- 对创建接口按 IP、口令、`clientRequestId`、User-Agent 做频控。
- 后台统计要过滤明显 bot，可记录但默认不计入唯一访客。

## 10. 与现有分享和推荐内容的集成

### 10.1 普通分享

普通分享短链打开后：

1. `/s/{code}` 跳转到最终 URL。
2. 首页按现有逻辑解析 query。
3. 应用参数后清理地址栏中的已消费参数。

短链不改变普通分享的接收方选择逻辑，例如是否保存 API 配置到本地。

### 10.2 密码加密分享

加密分享短链打开后：

1. `/s/{code}` 跳转到包含 `sdata` 的 URL。
2. 如果最终 URL 带 `#key=`，前端自动解密。
3. 如果不带 `#key=`，前端显示现有解锁对话框。

由于 `#key=` 等同解密密码，默认不应保存到短链目标。若管理员允许，创建时必须要求用户二次确认。

### 10.3 推荐内容注入

服务端生成最终跳转 URL 时处理 `promoProfileId`：

- `promoMode=inherit`：不改写。
- `promoMode=none`：删除公开 `promoProfileId`。
- `promoMode=override`：设置为绑定 Profile 的 `publicId`。

对于加密分享，不修改 `sdata` 内部内容，只在公开 query 层设置 `promoProfileId`。现有 `buildSecureShareUrl` 已支持把 `promoProfileId` 作为公开参数放在加密 payload 外部，这与当前分享接收逻辑兼容。

## 11. 错误与边界情形

- 短链功能关闭：创建接口返回 403；已存在短链是否继续跳转由后台设置决定，默认继续跳转。
- 口令错误：统一返回“无法创建短链，请检查口令或稍后再试”。
- 目标 URL 太长：返回 413 或 400，并显示最大长度。
- 目标 URL 不安全：返回明确但不泄露内部策略的错误，例如“只能为当前站点的分享链接创建短链”。
- 短码碰撞：服务端重试，不让用户感知；多次失败返回 500。
- 短链过期：返回 410 主题化页面。
- 短链被停用：返回 404 或 410 主题化页面。
- 统计写入失败：不得影响跳转；记录 server log 并降级。
- 数据库不可用：创建失败；跳转可选择失败关闭，不应跳到错误目标。
- 管理员修改推荐内容时：短链 URL 不变，下次访问生效。

## 12. i18n、UI 和可访问性要求

- 所有新增前台可见文案进入 `src/lib/i18n/*`，中英文同步。
- 后台文案如果当前仍以中文为主，可以跟随后台现状；若后台后续纳入 i18n，本功能需同步迁移。
- 不使用 `window.alert`、`window.prompt`、`window.confirm`。
- 口令输入使用项目现有密码输入或 Dialog 组件。
- 按钮必须有清晰 loading、disabled 和错误状态。
- 短链输入框支持一键复制，复制失败时允许用户手动选择。
- 深色/浅色主题都要检查。
- 移动端宽度下不出现文本溢出或按钮挤压。

## 13. 验收标准

### 13.1 用户侧

- 打开分享面板不会请求短链创建接口。
- 切换分享选项不会请求短链创建接口。
- 点击“复制链接”不会创建短链。
- 只有点击“创建短链”才会创建短链。
- 双击“创建短链”或网络重试只产生一条短链。
- 管理员关闭短链功能后，前端不允许创建。
- 需要口令时，正确口令可创建，错误口令不可创建且会节流。
- 创建成功后可以复制短链，访问短链能打开原分享内容。
- 修改选项后已有短链标记为旧选择，不自动更新。

### 13.2 后台侧

- 管理员可以查看短链列表、搜索、筛选、停用、删除。
- 管理员可以查看单条短链访问统计和最近访问。
- 管理员可以给短链绑定、取消或覆盖推荐 Profile。
- 绑定不同 Profile 的两个短链打开后展示不同分享推荐内容。
- 停用或过期短链不再跳转到目标 URL。
- 所有创建、更新、停用、删除、设置变更写入审计日志。

### 13.3 安全侧

- `javascript:`、`data:`、`file:`、协议相对 URL 被拒绝。
- 未配置可信外域时，外部 URL 被拒绝。
- 指向 `/s/{code}` 的递归短链被拒绝。
- 明文 API Key 目标按默认策略被拒绝。
- `#key=` 目标按后台策略拒绝或二次确认。
- 无效短码大量访问触发频控。
- 后台不展示原始敏感目标 URL，只展示脱敏摘要。

### 13.4 跨运行时

- Web 部署完整可用。
- Tauri 未配置远端短链服务时，创建入口隐藏或禁用，并不影响普通分享。
- Tauri 配置远端短链服务时，可以创建短链并复制到系统剪贴板。
- 移动端分享面板布局正常。

## 14. 测试建议

### 14.1 单元测试

- 短码生成长度、字符集、碰撞重试。
- 目标 URL 校验：当前站点、外域、危险协议、递归短链、无分享参数。
- 敏感参数识别：`apiKey`、`syncConfig`、`sdata`、`#key=`。
- 推荐 Profile 注入：inherit / none / override。
- 目标 URL 脱敏摘要生成。

### 14.2 API 测试

- 创建开关关闭。
- 创建口令正确/错误/节流。
- `clientRequestId` 幂等。
- 过期和停用短链跳转失败。
- 访问统计写入和聚合。
- 管理员权限区分 viewer/admin/owner。

### 14.3 前端测试

- 分享面板打开不创建短链。
- 修改 checkbox/input 不创建短链。
- 点击创建短链才 POST。
- 创建过程中按钮 disabled。
- 创建后修改选项显示旧短链提示。
- 深色/浅色和移动端截图检查。

## 15. 分阶段实施建议

### Phase 1：最小可用短链

- 数据表：`short_links`、基础 settings。
- 公共接口：settings、create、redirect。
- 分享面板显式“创建短链”按钮。
- 后台设置：开关、口令、短码长度。
- 后台列表：查看、停用、复制。
- 基础安全：目标 URL 白名单、敏感参数策略、频控、审计。

### Phase 2：推荐内容和统计

- 绑定分享 Profile。
- 跳转时注入/移除/继承 `promoProfileId`。
- `short_link_visits` 和日聚合统计。
- 短链详情页和最近访问。
- 列表筛选、排序、导出。

### Phase 3：高级治理

- 自定义短码。
- 二维码。
- 外部可信域名白名单。
- 更细粒度 bot 过滤。
- 统计保留期自动清理。
- 敏感目标加密密钥轮换。

## 16. 待确认问题

1. 生产域名是否固定为单一 Web 域名，还是需要支持多个可信域名同时创建短链。
2. 是否允许管理员创建外部跳转短链；如果允许，是否需要单独的“外链风险”标记和更严格权限。
3. `#key=` 是否在 V1 完全禁止存入短链，还是允许 owner 开启后由用户二次确认。
4. 默认短码长度采用 10 还是 12；如果面向公开互联网，建议 12。
5. 访问统计是否需要 GeoIP；如果没有明确运营需求，V1 建议不做，避免引入额外数据源和隐私成本。
6. 口令创建的短链默认有效期是多少；建议默认 90 天，管理员创建可不限期。
