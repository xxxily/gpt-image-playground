import {
    buildHatchetMockInput,
    createHatchetClient,
    createManagedImageMockTask,
    createManagedImageWorker,
    hasHatchetToken
} from './live.js';

export async function runHatchetLiveSmoke() {
    if (!hasHatchetToken()) {
        return {
            skipped: true,
            reason: 'HATCHET_CLIENT_TOKEN is not configured; live Hatchet worker smoke was not attempted.'
        };
    }

    const client = createHatchetClient();
    const task = createManagedImageMockTask(client);
    const worker = await createManagedImageWorker(client);
    void worker.start();
    await worker.waitUntilReady(Number(process.env.HATCHET_WORKER_READY_TIMEOUT_MS ?? 30_000));

    try {
        const input = buildHatchetMockInput();
        const result = await task.run(input, {
            additionalMetadata: {
                service: 'gpt-image-task-service',
                phase: 'phase-1',
                endpointFingerprint: input.endpointFingerprint
            }
        });

        return {
            skipped: false,
            worker: worker.name,
            taskId: input.taskId,
            status: result.status,
            outputCount: result.outputCount
        };
    } finally {
        await worker.stop();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const result = await runHatchetLiveSmoke();
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}
