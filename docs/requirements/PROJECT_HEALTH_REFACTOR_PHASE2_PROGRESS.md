---
title: Project health refactor Phase 2 progress
summary: Phase 2 modularization checkpoint for workbench and settings monolith boundaries.
createdAt: 2026-06-03
status: phase-2-entrypoint-split
---

# Project Health Refactor Phase 2 Progress

This checkpoint records the Phase 2 work completed after config schema v2.

## Extracted Workbench Slices

- `src/features/workbench/history/history-timestamps.ts`
  - Owns history image filename to timestamp indexing.
- `src/features/workbench/submission/batch-overrides.ts`
  - Owns batch override image count limits and clamping.
- `src/features/workbench/state/runtime.ts`
  - Owns server runtime config parsing, editable paste target checks, reduced motion, and large-layout checks.
- `src/app/page.tsx`
  - Reduced to a thin route entry that renders the workbench feature page.
- `src/features/workbench/page/workbench-page.tsx`
  - Owns the current workbench orchestration container while follow-up hook extraction continues.
- `src/features/workbench/page/workbench-shell.tsx`
  - Owns the main workbench layout, dialogs, editing form slot, output panel, task tracker, promo slot, history panel, and docked workspace panes.
- `src/features/workbench/workspace/workspace-history-stats.ts`
  - Owns workspace history aggregation and running-task workspace lookup.

## Extracted Settings Slices

- `src/components/settings/settings-options.ts`
  - Owns settings option lists and label-key helpers for sync scopes, prompt toolbar visibility, task defaults, video sync options, and model binding compatibility families.
- `src/components/settings/settings-config-state.ts`
  - Owns the initial settings snapshot type and factory used by `settings-dialog.tsx`.
- `src/components/settings-dialog.tsx`
  - Reduced to a compatibility export for the settings dialog entry point.
- `src/components/settings/settings-dialog-container.tsx`
  - Owns the current settings orchestration container while view/domain extraction continues.
- `src/components/settings/model-catalog-state.ts`
  - Owns model catalog filtering, grouping, and active-filter counting.

## Size Snapshot

| File | Phase 0 Lines | Phase 2 Lines |
| --- | ---: | ---: |
| `src/app/page.tsx` | 7211 | 5 |
| `src/components/settings-dialog.tsx` | 7127 | 1 |
| `src/features/workbench/page/workbench-page.tsx` | N/A | 6934 |
| `src/components/settings/settings-dialog-container.tsx` | N/A | 6944 |
| `src/features/workbench/page/workbench-shell.tsx` | N/A | 401 |

The named entry files now meet the 1500-line gate from the requirements. The
remaining risk is that the current orchestration containers are still large:
`workbench-page.tsx` and `settings-dialog-container.tsx` preserve behavior but
remain above the complex-container soft limit. Further work should continue by
extracting workbench submission/history/share/sync hooks and settings view
components/domain stores from those containers.

## Tests Added

- `src/features/workbench/history/history-timestamps.test.ts`
- `src/features/workbench/submission/batch-overrides.test.ts`
- `src/features/workbench/state/runtime.test.ts`
- `src/features/workbench/workspace/workspace-history-stats.test.ts`
- `src/components/settings/settings-options.test.ts`
- `src/components/settings/settings-config-state.test.ts`
- `src/components/settings/model-catalog-state.test.ts`

## Verification Snapshot

- `npx tsc --noEmit --pretty false`
- `npx vitest run src/features/workbench/workspace/workspace-history-stats.test.ts src/components/settings/model-catalog-state.test.ts --reporter=dot`
- `npm run lint`
