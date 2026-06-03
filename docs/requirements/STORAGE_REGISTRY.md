---
title: Storage registry
summary: Browser, IndexedDB, and filesystem storage inventory for config, history, sync, assets, workspace, UI, auth, and cache data.
createdAt: 2026-06-03
status: active-reference
---

# Storage Registry

The runtime registry lives in `src/lib/storage-registry.ts`. It is the source of
truth for local storage classification and reset/backup helpers.

## Groups

| Group | Examples | Clearable |
| --- | --- | --- |
| config | `gpt-image-playground-config`, config import backups | Yes |
| sync | `gpt-image-playground-sync-config`, sync device id | Yes |
| history | image, prompt, vision-text, video metadata and IndexedDB blobs | Yes |
| assets | user prompt templates, custom asset categories | Yes |
| workspace | creative workspaces | Yes |
| ui | form preferences, panel layout, prompt drafts, batch drafts | Yes |
| auth | `clientPasswordHash` | No by default; deprecated compatibility credential |

## Sensitive Stores

- `gpt-image-playground-config` can contain provider endpoint API keys and is treated as `secret`.
- `gpt-image-playground-sync-config` contains S3-compatible credentials and is treated as `secret`.
- `clientPasswordHash` is treated as `sensitive` and excluded from generic clearable groups.
- Prompt, image, video, workspace, and asset entries are user content.

## Reset And Backup Rules

- Product reset flows should use registry groups rather than ad hoc key strings.
- Config import should back up the app config group before replacing it.
- Generic cleanup must not delete login/session state or server-side generated files.
- IndexedDB and filesystem entries are listed for policy visibility; destructive
  deletion should continue to use feature-specific bounded helpers.
