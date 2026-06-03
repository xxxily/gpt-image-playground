---
title: Project health refactor Phase 4 progress
summary: Phase 4 checkpoint for logging redaction, dependency alignment, quality gates, i18n bridge removal, and local hygiene.
createdAt: 2026-06-03
status: phase-4-quality-gates
---

# Project Health Refactor Phase 4 Progress

This checkpoint records the Phase 4 work completed after the Phase 2 review pause.

## Logging And Redaction

- Added `src/lib/server/server-logger.ts` as the shared server logger.
- Added redaction coverage for prompt fields, API keys, Authorization/Bearer tokens, S3-style secret keys, sensitive query params, local absolute paths, and Error messages.
- Replaced direct `console.*` usage in `src/app/api/**/route.ts` with scoped structured server logs.
- Production default log level is `warn`; debug logs require `SERVER_LOG_LEVEL=debug`, `SERVER_DEBUG_LOGS=true`, or `DESKTOP_DEBUG_MODE=true`.

## Dependency And Tooling Baseline

- Upgraded the Phase 4 dependency batch across Next, React, OpenAI, AWS SDK, Radix primitives, Tailwind, Vitest, TypeScript, and related type packages.
- Aligned `eslint-config-next` with the Next major version.
- Added overrides for `@better-auth/core` and `@better-auth/utils` to keep the current `better-auth@1.6.10` graph internally consistent during unrelated dependency upgrades.
- Registered npm-installed optional WASM/native runtime packages in root `optionalDependencies` so `npm ls --depth=0` stays clean after `npm ci`.
- Added `npm run typecheck` as a first-class command.
- Added `tsconfig.typecheck.json` so standalone typecheck does not fail on stale `.next/dev` route caches that Next 16 may write back into the main project tsconfig.
- Updated `eslint.config.mjs` to consume Next 16 flat configs directly instead of routing them through `FlatCompat`.
- React Compiler lint rules introduced by the newer React Hooks plugin are explicitly disabled for now; enabling them requires a dedicated ref/effect/memoization cleanup pass across existing components.
- Added `.desktop-build-api-backup` to clean targets and Vitest excludes so interrupted desktop static builds do not pollute local test discovery.

## Quality Gates

- Added `.github/workflows/quality.yml` with `npm ci`, secret scan, production audit, typecheck, lint, test, web build, desktop static build, Rust test, Rust clippy, and Rust dependency audit gates.
- Extended the release workflow to run secret scan, env tracking checks, production audit, typecheck, lint, tests, web build, and desktop static build before release packaging.
- Added Rust quality scripts:
  - `npm run rust:test`
  - `npm run rust:clippy`
  - `npm run rust:audit`
  - `npm run rust:quality`

## Local Hygiene

- Added `npm run clean` for rebuildable JS/Next/test artifacts.
- Added `npm run clean:deep` for `node_modules`, `src-tauri/target`, and Android build output.
- Added `npm run secret-scan` for tracked files and `npm run secret-scan:untracked` for optional local untracked scans.
- Added `npm run release:env-check` to report private env file presence/tracking without reading or printing env content.

## Phase 4b: UI I18n Bridge Removal

Phase 4b was split as a dedicated UI text migration checkpoint:

1. Remove the legacy DOM translation bridge from the application shell.
2. Migrate remaining visible hard-coded UI copy in `src/app/**/*.tsx` and `src/components/**/*.tsx` to the static i18n message catalog.
3. Add a static audit gate so new JSX text, visible attributes, and legacy bridge references cannot silently return.
4. Document the new boundary and leave API/dynamic string localization for a later, narrower pass.

Completed Phase 4b changes:

- Removed `src/components/i18n-text-bridge.tsx` and the corresponding layout-level bridge render.
- Added `src/components/localized-message.tsx` for translated React text in client and server component trees.
- Moved the skip-to-content link under `AppLanguageProvider`, so it reads `a11y.skipToContent` directly instead of relying on DOM mutation.
- Migrated the remaining audited UI copy in admin pages, dialogs, history, generation/editing controls, sharing, tasks, and prompt template surfaces to `APP_MESSAGES`.
- Kept intentional user data, model/provider identifiers, generated values, URLs, and technical tokens under explicit `data-i18n-skip` annotations.
- Added `src/lib/i18n/i18n-audit.test.ts` to assert the bridge file stays removed and audited UI text/attributes stay localized.

Remaining Phase 4 i18n work after Phase 4b:

- API responses, dynamic validation messages, and persisted/default data strings still need a separate error-code/client-localization pass.
- Some generated `phase4b.*` message keys should be renamed into semantic namespaces during future feature-level edits, without reintroducing hard-coded visible copy.

## Remaining Phase 4 Iteration Pool

- `cargo-audit` is installed and runnable locally. Current audit reports 19 allowed RustSec warnings from upstream Tauri/GTK/urlpattern/rand dependency chains; no blocking command failure remains, but the warnings should be revisited when Tauri/wry/GTK bindings offer an upgrade path.
- Larger cross-major upgrades, such as `lucide-react` and `dexie-react-hooks`, remain deferred because they require separate compatibility review.
