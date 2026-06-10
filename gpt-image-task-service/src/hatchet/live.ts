import { MockTaskParameters } from '../types.js';
import { RateLimitDuration } from '@hatchet-dev/typescript-sdk/protoc/v1/workflows.js';
import { Duration } from '@hatchet-dev/typescript-sdk/v1/client/duration.js';
import { HatchetClient, ConcurrencyLimitStrategy } from '@hatchet-dev/typescript-sdk/v1/index.js';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const HATCHET_MANAGED_IMAGE_MOCK_TASK_NAME = 'gpt-image.managed-image.mock.v1';
export const HATCHET_MANAGED_IMAGE_WORKER_NAME = 'gpt-image-managed-image-worker-phase1';

export type HatchetManagedImageMockInput = {
    taskType: 'image.generate' | 'image.edit';
    taskId: string;
    endpointFingerprint: string;
    modelId: string;
    promptHash: string;
    attempt: number;
    mock?: MockTaskParameters & {
        crashOnceKey?: string;
    };
};

export type HatchetManagedImageMockOutput = {
    status: 'succeeded';
    taskId: string;
    outputCount: number;
    endpointFingerprint: string;
    startedAt: number;
    completedAt: number;
    durationMs: number;
    providerUsage: {
        mock: true;
        attempt: number;
    };
};

export function createHatchetClient(): HatchetClient {
    return HatchetClient.init();
}

export function createManagedImageMockTask(client = createHatchetClient()) {
    return client.task<HatchetManagedImageMockInput, HatchetManagedImageMockOutput>({
        name: HATCHET_MANAGED_IMAGE_MOCK_TASK_NAME,
        retries: 1,
        executionTimeout: hatchetDuration(process.env.HATCHET_TASK_EXECUTION_TIMEOUT, '30s'),
        scheduleTimeout: hatchetDuration(process.env.HATCHET_TASK_SCHEDULE_TIMEOUT, '2m'),
        concurrency: {
            maxRuns: Number(process.env.HATCHET_ENDPOINT_MAX_RUNS ?? 1),
            limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
            expression: 'input.endpointFingerprint'
        },
        rateLimits: [
            {
                dynamicKey: 'input.endpointFingerprint',
                units: 1,
                limit: Number(process.env.HATCHET_ENDPOINT_RATE_LIMIT ?? 10),
                duration: RateLimitDuration.MINUTE
            }
        ],
        fn: async (input, ctx) => {
            const startedAt = Date.now();
            ctx.logger.info('Starting managed image mock task.', {
                taskId: input.taskId,
                taskType: input.taskType,
                endpointFingerprint: input.endpointFingerprint,
                modelId: input.modelId,
                attempt: input.attempt
            });

            await sleep(input.mock?.delayMs ?? 10);
            maybeCrashOnce(input.mock?.crashOnceKey);
            if (ctx.cancelled) {
                throw new Error('Managed image mock task was cancelled before provider processing.');
            }

            await sleep(input.mock?.providerDelayMs ?? 10);
            if (input.mock?.fail || (input.mock?.failUntilAttempt ?? 0) >= input.attempt) {
                throw new Error('Mock provider failure.');
            }

            await sleep(input.mock?.downloadDelayMs ?? 10);
            const completedAt = Date.now();
            return {
                status: 'succeeded',
                taskId: input.taskId,
                outputCount: 1,
                endpointFingerprint: input.endpointFingerprint,
                startedAt,
                completedAt,
                durationMs: completedAt - startedAt,
                providerUsage: {
                    mock: true,
                    attempt: input.attempt
                }
            };
        }
    });
}

export function buildHatchetMockInput(
    overrides: Partial<HatchetManagedImageMockInput> = {}
): HatchetManagedImageMockInput {
    const prompt = 'Draw a compact phase one Hatchet mock image.';
    return {
        taskType: 'image.generate',
        taskId: `hatchet-phase1-${Date.now()}`,
        endpointFingerprint: 'fp_gateway_example',
        modelId: 'gpt-image-1',
        promptHash: hashPrompt(prompt),
        attempt: 1,
        mock: {
            delayMs: 5,
            providerDelayMs: 5,
            downloadDelayMs: 5
        },
        ...overrides
    };
}

export async function createManagedImageWorker(client = createHatchetClient()) {
    const task = createManagedImageMockTask(client);
    return client.worker(HATCHET_MANAGED_IMAGE_WORKER_NAME, {
        workflows: [task],
        slots: Number(process.env.HATCHET_WORKER_SLOTS ?? 2),
        labels: {
            service: 'gpt-image-task-service',
            phase: 'phase-1'
        }
    });
}

export function hasHatchetToken(): boolean {
    return Boolean(process.env.HATCHET_CLIENT_TOKEN);
}

function hashPrompt(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
}

function hatchetDuration(value: string | undefined, fallback: Duration): Duration {
    return (value ?? fallback) as Duration;
}

function maybeCrashOnce(key?: string): void {
    if (!key) {
        return;
    }
    const markerPath = crashMarkerPath(key);
    if (existsSync(markerPath)) {
        return;
    }
    mkdirSync(join(tmpdir(), 'gpt-image-task-service-hatchet-crash'), { recursive: true });
    writeFileSync(markerPath, new Date().toISOString(), { encoding: 'utf8' });
    process.exit(42);
}

function crashMarkerPath(key: string): string {
    const safeKey = createHash('sha256').update(key).digest('hex');
    return join(tmpdir(), 'gpt-image-task-service-hatchet-crash', `${safeKey}.marker`);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, Math.max(0, ms));
    });
}
