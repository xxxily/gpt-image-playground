# gpt-image-task-service

Independent managed generation task service PoC for the server-side generation task takeover plan.

This service is intentionally not a Next.js route and is not imported by the current App. It owns its own dependencies, build, tests, Dockerfile, mock runtime, and Hatchet adapter boundary.

## Phase 1 Scope

- HTTP service skeleton for the P0 contract.
- Mock `image.generate` and `image.edit` lifecycle.
- In-memory queue with per-endpoint concurrency buckets.
- Cancel, failure, manual retry, and simulated worker crash behavior.
- Hatchet SDK dependency and probe boundary for Phase 1 integration work.

Phase 1 does not call real image providers and does not implement durable local-file asset storage. Those belong to Phase 2.

## Commands

```bash
npm install
npm run build
npm test
npm run smoke
npm run start
```

The service listens on `TASK_SERVICE_PORT` or `8787`.

## Hatchet Probe

```bash
npm run hatchet:probe
```

The probe checks whether the Hatchet SDK can be loaded and whether `HATCHET_CLIENT_TOKEN` is configured. A full worker/control-plane run requires a running Hatchet deployment and belongs to the remaining Phase 1 validation.
