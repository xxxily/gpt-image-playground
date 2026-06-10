import { buildHatchetMockInput, createManagedImageMockTask, hasHatchetToken } from './live.js';

export async function runManagedImageMockTask() {
    const input = buildHatchetMockInput();
    const task = createManagedImageMockTask();
    const result = await task.run(input, {
        additionalMetadata: {
            service: 'gpt-image-task-service',
            phase: 'phase-1',
            endpointFingerprint: input.endpointFingerprint
        }
    });
    return { input, result };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    if (!hasHatchetToken()) {
        console.log(
            JSON.stringify(
                {
                    skipped: true,
                    reason: 'HATCHET_CLIENT_TOKEN is not configured; live Hatchet run was not attempted.'
                },
                null,
                2
            )
        );
        process.exit(0);
    }

    const { input, result } = await runManagedImageMockTask();
    console.log(
        JSON.stringify(
            {
                skipped: false,
                taskId: input.taskId,
                status: result.status,
                outputCount: result.outputCount
            },
            null,
            2
        )
    );
}
