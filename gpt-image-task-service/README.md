# gpt-image-task-service

Independent managed generation task service for the server-side generation task takeover plan.

This service is intentionally not a Next.js route and is not imported by the current App. It owns its own dependencies, build, tests, Dockerfile, mock runtime, and Hatchet adapter boundary.

## Phase 1 Scope

- HTTP service skeleton for the P0 contract.
- Mock `image.generate` and `image.edit` lifecycle.
- In-memory queue with per-endpoint concurrency buckets.
- Cancel, failure, manual retry, and simulated worker crash behavior.
- Hatchet SDK dependency and probe boundary for Phase 1 integration work.
- Live Hatchet verification for worker registration, same-endpoint serialization, and crash recovery.

Phase 1 does not call real image providers.

## Phase 2 Scope

- Stable P0 domain API for `image.generate` and `image.edit`.
- `POST /v1/tasks`, `GET /v1/tasks/{id}`, `POST /v1/tasks/query`, cancel, result, events, and user retry endpoints.
- Local filesystem result asset storage with controlled download URLs, SHA-256, MIME type, size, and expiry metadata in the result manifest.
- Admin summaries for health, capabilities, queues, sanitized task summaries, and retry policy configuration.
- S3-compatible storage configuration placeholders in capabilities; P0 still uses local filesystem storage.
- Guardrails for unsupported task types, expired execution credentials, image edit input assets, idempotency conflicts, and 100-task batch query caps.

Phase 2 still uses mock provider execution. Real provider adapters and current App submission/recovery belong to later phases.

## Phase 5 Scope

- Provider `baseUrl` URL safety checks reject localhost, private, link-local, loopback, multicast, reserved, and non-public hostnames before task acceptance.
- In-memory audit events cover task submit, cancel, retry, result read, retry policy updates, and full diagnostic views without storing raw keys or download tokens.
- Admin task visibility is split between sanitized summaries and owner-only full diagnostics.
- Full diagnostics omit `keyEnvelope` and download URL tokens even for owner requests.
- Retry policy responses keep the supplier cost-risk warning visible for the current App admin UI.

Phase 5 is still a P0 safeguard layer. Audit storage remains in-memory for the mock service, and production durable audit retention belongs to a later deployment hardening pass.

## Commands

```bash
npm install
npm run build
npm test
npm run smoke
npm run start
```

The service listens on `TASK_SERVICE_PORT` or `8787`.

## Phase 2 API Notes

```bash
curl http://localhost:8787/v1/admin/health
curl http://localhost:8787/v1/admin/capabilities
curl http://localhost:8787/v1/admin/queues
curl http://localhost:8787/v1/admin/tasks
curl "http://localhost:8787/v1/admin/tasks/<taskId>?visibility=summary"
curl -H "x-managed-task-admin-role: owner" "http://localhost:8787/v1/admin/tasks/<taskId>?visibility=full"
curl http://localhost:8787/v1/admin/audit-events
curl http://localhost:8787/v1/admin/retry-policy
```

Successful mock tasks write result assets under the service-owned local filesystem root. Download URLs are served through `/v1/assets/{assetId}/download?token=...`; callers should use the manifest URL instead of reading the local directory directly.

`visibility=full` requires the `x-managed-task-admin-role: owner` header. Summary visibility is intended for regular admin surfaces and does not include execution credentials, raw provider URLs, raw prompts, or download tokens. Full diagnostics add troubleshooting context, but still redact `keyEnvelope` and any direct download URL token values.

The task service applies its own URL safety checks for provider base URLs. The current App must still keep its independent task-service URL validation and same-origin result download restrictions; the two checks are intentionally defense-in-depth rather than interchangeable.

## Hatchet Adapter

```bash
npm run hatchet:probe
npm run hatchet:worker
npm run hatchet:run
npm run hatchet:live-smoke
npm run hatchet:live-verify
```

The probe checks whether the Hatchet SDK can be loaded and whether `HATCHET_CLIENT_TOKEN` is configured.

The worker/run/live-smoke commands define and register a real Hatchet mock task when a Hatchet control plane is available. They intentionally send only safe mock payload fields to Hatchet: task type, task id, endpoint fingerprint, model id, prompt hash, attempt, and mock timing/failure controls. They do not send execution credentials, raw API keys, full prompts, image bytes, or provider URLs.

`npm run hatchet:run`, `npm run hatchet:live-smoke`, and `npm run hatchet:live-verify` skip safely when `HATCHET_CLIENT_TOKEN` is missing. `npm run hatchet:worker` requires a token because it is a long-running worker process.

`npm run hatchet:live-verify` is the Phase 1 live acceptance gate. It verifies:

- a real Hatchet worker registers and executes the mock image task;
- two tasks with the same endpoint fingerprint are serialized by Hatchet concurrency controls;
- a worker process crash leaves the run recoverable, and a replacement worker completes it.
