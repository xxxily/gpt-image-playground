# gpt-image-task-service

Independent managed generation task service PoC for the server-side generation task takeover plan.

This service is intentionally not a Next.js route and is not imported by the current App. It owns its own dependencies, build, tests, Dockerfile, mock runtime, and Hatchet adapter boundary.

## Phase 1 Scope

- HTTP service skeleton for the P0 contract.
- Mock `image.generate` and `image.edit` lifecycle.
- In-memory queue with per-endpoint concurrency buckets.
- Cancel, failure, manual retry, and simulated worker crash behavior.
- Hatchet SDK dependency and probe boundary for Phase 1 integration work.
- Live Hatchet verification for worker registration, same-endpoint serialization, and crash recovery.

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
