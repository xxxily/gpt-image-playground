# GPT Image Playground Agent Guide

This file is the repository-level startup read for AI agents.

## 1. Project boundary

- This repo is a multi-runtime image workbench: Web, Tauri desktop, and Tauri mobile/Android are all in scope.
- Shared features should work across runtimes or fail gracefully.
- Web deployment uses Next.js pages/API routes; the desktop bundle is a static export and cannot depend on Node-only server behavior.

## 2. UI and layout rules

- Every UI change must be checked in both light and dark themes.
- Prefer the existing theme system and semantic surfaces (`app-theme-scope`, `app-panel-card`, `app-panel-subtle`, CSS variables, `ThemeProvider`).
- Avoid hard-coded white/black styling unless the existing component already uses it intentionally.
- Keep layouts mobile-first and desktop-complete: panels should stack cleanly on small screens and expand into richer layouts on large screens.
- Treat touch/pointer use as first-class. Hover states must stay optional, not required.
- Respect safe-area insets, text truncation, and container bounds. Text must not overflow or overlap adjacent controls.
- Keep the experience utilitarian. Do not introduce landing-page-style hero sections or extra decorative blobs; the first screen should stay the actual tool.
- Reuse the existing component patterns: icon buttons, toggles, selects, sliders, and tooltips. Prefer lucide icons.
- UI changes that add or change user-visible copy must go through the existing i18n system (`src/lib/i18n/*`, app language provider, and translation helpers) and keep every supported language in sync. Use `data-i18n-skip` only for intentionally non-translated content such as user data, model names, or technical identifiers.
- Do not use native browser modal controls (`window.alert`, `window.prompt`, `window.confirm`) for product interactions. Use the project Web UI components instead, especially `src/components/ui/dialog.tsx`, feature dialogs, and notice-style components, so theming, accessibility, history behavior, and mobile layouts stay consistent.

## 3. Web vs Tauri rules

- If a feature needs clipboard, external links, local files, native updates, desktop proxying, or other desktop-only capability, it must also have a Tauri path.
- Use `src/lib/desktop-runtime.ts` (`isTauriDesktop`, `invokeDesktopCommand`, `invokeDesktopStreamingCommand`, `openExternalUrl`) instead of importing Tauri APIs directly in feature code.
- If Web uses an API route, keep the Web path working and add the corresponding Tauri/Rust implementation when the desktop client needs the same behavior.
- Desktop-only logic belongs in `src-tauri/src/proxy/*` or nearby Rust command code, not in shared browser modules.
- New top-level routes must still make sense in the static desktop export; confirm whether the desktop bundle can actually reach them before relying on them.

## 4. Data, config, and safety rules

- Treat persisted config, localStorage, IndexedDB, and SQLite data as backward compatible. Normalize unknown values to safe defaults instead of breaking old data.
- Reuse existing helpers for provider URLs and policy checks: `normalizeOpenAICompatibleBaseUrl`, `validatePublicHttpBaseUrl`, `getClientDirectLinkRestriction`, and related config normalizers.
- Do not weaken URL safety checks. Public Base URLs must not silently expand to localhost, private IPs, or other unsafe targets.
- Preserve password, share, sync, and secret-masking behavior. Do not expose raw secrets in UI or logs.

## 5. Performance rules

- Keep history, sync, restore, and image lookup paths bounded and asynchronous.
- Do not add Blob-byte scans, full DB scans, or expensive hashing on hot paths, especially on mobile.
- Preserve existing concurrency caps, timeouts, lazy loading, and object-URL caching patterns.
- Do not add blocking work to first paint, drag/drop handling, or large image preview flows.

## 6. Runtime-specific product rules

- If a change touches image generation, image editing, prompt polishing, history, sync, or sharing, verify the flow in both the Web path and the Tauri path.
- Desktop-specific features such as system-browser opening, local image access, updater behavior, proxying, and promo/service fetching must degrade cleanly on Web.
- Keep the current separation between direct/client mode and proxy/server mode intact; do not collapse them into one path.

## 7. Documentation rules

- When a feature, workflow, setting, requirement, or behavior changes, update the matching documentation in the same change. Prefer the existing surfaces (`README.md`, `docs/*`, `docs/requirements/*`, `CHANGELOG.md`, or `RELEASE_PROCESS.md`) instead of creating one-off notes.
- Keep documented UI labels, screenshots, configuration examples, Web/Tauri differences, and known limitations aligned with the shipped behavior. If a code change intentionally needs no docs update, make that explicit in the handoff.
- For any task that changes code, docs, config, release behavior, or implementation status, create or update a persistent task report under `docs/agent-reports/`. Use the report to preserve what was requested, what was actually completed, what was skipped, verification evidence, known risks, and follow-up recommendations.
- If the task is a continuation of an existing requirement or report, update the existing report instead of creating a disconnected duplicate. Cross-link the related requirement document, implementation plan, changelog, or release note when one exists.

## 8. Verification rules

- For UI work, verify light/dark themes and mobile/desktop layouts.
- For UI text changes, verify that the new or changed copy is covered by the i18n resources for every supported language and does not rely on hard-coded visible strings.
- For cross-runtime logic, add or update tests for both branches when behavior differs by runtime.
- For sync/history changes, verify the mobile-safe lookup and restore behavior does not regress.
- Prefer existing test helpers and existing abstractions over new one-off code.

## 9. Execution workflow rules

- Before changing code, inspect the current git status and recent context. If the user asks to checkpoint existing work first, commit that baseline before starting the new task.
- Break multi-part requests into explicit behavioral targets, then map each target to the owning modules, persisted data, UI surfaces, and documentation that may be affected.
- Before claiming completion, re-check the original user request and any referenced requirement documents against the final diff. Treat each requested behavior, acceptance criterion, runtime branch, documentation update, and verification item as either completed, partially completed, blocked, or not applicable.
- Reproduce or simulate the reported behavior when practical before and after the fix. For client-persisted state bugs, verify the actual storage state and the refreshed UI state, not only the in-memory interaction path.
- Keep the final diff scoped to the requested behavior. Review the diff before handoff for unrelated churn, accidental formatting-only edits, hard-coded visible copy, and missed runtime branches.
- For persisted data changes, include normalization or migration behavior and tests for legacy values, invalid values, and user-customized values that must be preserved.
- For external navigation, iframe, clipboard, local-file, or desktop-sensitive behavior, route through the shared runtime helpers and verify that Web and Tauri expectations remain separated.
- After browser or dev-server verification, close any agent-started browser sessions and stop any agent-started dev servers unless the user explicitly asks to keep them running.
- In the handoff, report the commit status, verification commands, browser scenarios checked, and any checks that were intentionally skipped or not applicable.

## 10. Completion reporting rules

- Do not summarize a non-trivial task only as "done", "completed", or similar. The final handoff must include enough detail for the user or a later agent to audit the actual scope delivered without asking follow-up questions.
- Write the final handoff and persistent report in the user's primary language, unless the user explicitly requests another language. Translate section headings, table labels, and explanatory prose; preserve code identifiers, file paths, commands, API names, and exact requirement names when translating them would reduce clarity.
- Use a table or another clearly scannable structure for multi-part tasks. At minimum, cover: requested target, actual result, changed files or modules, verification status, unresolved gaps, problems encountered, solution applied, and recommended next steps.
- Mark the overall status honestly as `Completed`, `Partial`, or `Blocked`, or as a localized label paired with the canonical status such as `已完成 (Completed)`. Use `Partial` when any requested item or requirement acceptance criterion remains unfinished, even if other parts were completed. Use `Blocked` only when progress cannot continue without missing input, unavailable systems, or another external dependency.
- Every final handoff for a repository-changing task must mention the persistent report path under `docs/agent-reports/`, the commit status, verification commands run, browser/device/theme scenarios checked when relevant, and checks that were skipped with concrete reasons.
- The persistent report must follow the structure documented in `docs/agent-reports/README.md`. It must avoid raw secrets, tokens, private URLs with credentials, and unrelated local-machine details.
