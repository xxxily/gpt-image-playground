---
title: Project health refactor execution task list
summary: Executable task map split from the project health refactor requirements.
createdAt: 2026-06-03
status: active-task-map
---

# Project Health Refactor Execution Task List

This file turns `PROJECT_HEALTH_REFACTOR_REQUIREMENTS.md` into implementation
tracks. The current run is scoped to Phase 0 through Phase 2.

## Phase 0 - Baseline And Guardrails

- Record the command baseline for lint, tests, Web build, desktop build, and Rust checks.
- Freeze the current large-file size snapshot for `page.tsx`, `settings-dialog.tsx`, and `editing-form.tsx`.
- Add regression fixtures for legacy app config, backend settings summary, and workbench runtime scenarios.
- Explicitly mark `APP_PASSWORD` and unfinished video local storage as deferred for this run.
- Commit the requirement document, task map, baseline, and fixtures.

## Phase 1 - Config Schema V2 And Compatibility Sunset

- Add a versioned config migration pipeline with schema v2 as the current write format.
- Classify config fields as active, read-only migration, deprecated, or removed.
- Make `providerEndpoints` the canonical provider credential data source for new writes.
- Keep legacy flat provider credentials readable during migration, but stop writing them during normal saves.
- Ensure import/export, share-ready config payloads, and sync restore paths carry or normalize `schemaVersion`.
- Add a storage registry that lists localStorage keys, IndexedDB stores, sensitivity, export/sync policy, and cleanup grouping.
- Add reset/backup helpers that operate through the storage registry for non-login product data.
- Add compatibility sunset policy documentation.
- Cover legacy config, invalid values, user-customized endpoints, import/export, and sync-style restore with tests.
- Commit Phase 1 after verification.

## Phase 2 - Workbench And Settings Modularization

- Continue reducing `page.tsx` by moving workbench orchestration surfaces into `src/features/workbench/**`.
- Isolate submission, history, share, sync, desktop-assets, video, and vision-text boundaries behind feature modules or typed hooks/helpers.
- Continue reducing `settings-dialog.tsx` by moving view/domain metadata and domain-specific operations into `src/components/settings/**`.
- Keep video changes to boundary isolation and graceful degradation only.
- Remove or wrap direct cross-domain localStorage access in newly extracted helpers where touched.
- Add unit tests for extracted hooks/helpers and executor-facing pure functions.
- Commit Phase 2 after verification, then stop for user review.

## Deferred Pool

- `APP_PASSWORD`: only keep deprecated compatibility behavior unless a separate product decision keeps it.
- Desktop video local storage: do not implement `save_local_video` in this run; wait until video has a validated minimum product flow.
- Runtime matrix/Tauri hardening: remains Phase 5 unless a touched file requires a small compatibility helper.
