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

## 7. Verification rules

- For UI work, verify light/dark themes and mobile/desktop layouts.
- For cross-runtime logic, add or update tests for both branches when behavior differs by runtime.
- For sync/history changes, verify the mobile-safe lookup and restore behavior does not regress.
- Prefer existing test helpers and existing abstractions over new one-off code.
