---
title: Project health refactor Phase 0 baseline
summary: Phase 0 baseline commands, code-size snapshot, scope constraints, and deferred items for the project health refactor.
createdAt: 2026-06-03
status: phase-0-baseline
---

# Project Health Refactor Phase 0 Baseline

This baseline freezes the state used before implementing Phase 1 and Phase 2 of
`PROJECT_HEALTH_REFACTOR_REQUIREMENTS.md`.

## Command Baseline

| Check | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Passed | `eslint src` completed successfully. |
| `npm run test` | Passed | Vitest: 88 test files, 946 tests passed. |
| `npm run build` | Passed | Next.js 16.2.6 production build passed. Existing `src/app/api/history-assets/route.ts` Turbopack broad-pattern warning remains. |
| `npm run build:desktop` | Passed | Desktop static export produced `/` and `/_not-found`. |
| `cargo --version` | Passed | `cargo 1.95.0 (f2d3ce0bd 2026-03-21)`. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed | 83 Rust tests passed across 3 suites. |
| `cargo tree -d --manifest-path src-tauri/Cargo.toml` | Informational | Duplicate dependency families remain in the Tauri dependency graph, mostly through upstream Tauri and plugin chains. |
| `cargo audit --version` | Failed | `cargo audit` is not installed; this remains a Phase 4 tooling gap. |

## Size Snapshot

| File | Lines |
| --- | ---: |
| `src/app/page.tsx` | 7211 |
| `src/components/settings-dialog.tsx` | 7127 |
| `src/components/editing-form.tsx` | 4422 |

## Execution Constraints

- Stop the current implementation after Phase 2 and wait for user review.
- Commit after Phase 0, Phase 1, and Phase 2.
- Treat `APP_PASSWORD` as deprecated/deferred. Do not expand its product surface during Phase 1 or Phase 2.
- Treat desktop video local storage as deferred. Phase 2 may isolate video boundaries, but must not imply that unfinished local video storage is now product-complete.
- Keep Web and Tauri paths separated. New shared logic must degrade gracefully in desktop static export.
- New visible UI copy must go through the existing i18n system.

## Regression Fixtures

Phase 0 adds `src/lib/project-health-regression-fixtures.ts` and
`src/lib/project-health-regression-fixtures.test.ts` as stable examples for:

- A legacy v1 app config with flat provider credentials that must migrate to provider endpoints.
- A backend configuration summary shape that distinguishes public runtime, protected admin, server secret, and deployment-only settings.
- A workbench scenario covering submission, history, share, sync, desktop assets, video boundary isolation, and vision-text flows.

These fixtures are intentionally small and serializable so later phases can reuse
them without requiring browser UI setup.
