---
title: Compatibility sunset policy
summary: Compatibility lifecycle for legacy config fields, storage keys, routes, and runtime branches.
createdAt: 2026-06-03
status: active-policy
---

# Compatibility Sunset Policy

This policy applies to legacy config fields, storage keys, API inputs, runtime
branches, and deprecated feature flags.

## Lifecycle

| Status | Meaning | Write Policy | Removal Window |
| --- | --- | --- | --- |
| active | Current source of truth. | Read and write normally. | None. |
| read-only migration | Old source read only to migrate into active fields. | Do not write during normal saves. | Remove after one minor version with migration coverage. |
| deprecated | Still accepted for compatibility, but no longer part of the product path. | Do not add new writes. | Remove in the next major version unless usage data says otherwise. |
| removed | Not supported by current code. | Never write. | Keep only documented migration notes. |

## Current Phase 1 Decisions

- Config schema v2 is the current write format.
- `providerEndpoints`, `modelCatalog`, and `modelTaskDefaultCatalogEntryIds` are the canonical provider/model data.
- Legacy flat provider credentials are read-only migration fields:
  - `openaiApiKey`
  - `openaiApiBaseUrl`
  - `geminiApiKey`
  - `geminiApiBaseUrl`
  - `sensenovaApiKey`
  - `sensenovaApiBaseUrl`
  - `seedreamApiKey`
  - `seedreamApiBaseUrl`
- `customPolishPrompts` is deprecated and migrates to `polishingCustomPrompts`.
- `clientPasswordHash` is a deprecated `APP_PASSWORD` compatibility credential and must not become a broader auth mechanism.

## Required For New Compatibility Branches

Every new legacy branch must state:

- owner module,
- active replacement field or route,
- migration behavior,
- write policy,
- removal condition,
- test coverage.

Branches that cannot satisfy these points should be rejected or isolated behind a
short-lived migration helper instead of entering product logic.
