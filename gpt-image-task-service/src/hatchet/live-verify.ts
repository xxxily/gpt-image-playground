import {
    HatchetManagedImageMockOutput,
    buildHatchetMockInput,
    createHatchetClient,
    createManagedImageMockTask,
    createManagedImageWorker,
    hasHatchetToken
} from './live.js';
import { spawn } from 'node:child_process';

type LiveVerifyResult =
    | {
          skipped: true;
          reason: string;
      }
    | {
          skipped: false;
          execution: {
              worker: string;
              taskId: string;
              status: 'succeeded';
              outputCount: number;
          };
          concurrency: {
              endpointFingerprint: string;
              firstTaskId: string;
              secondTaskId: string;
              firstStartedAt: number;
              firstCompletedAt: number;
              secondStartedAt: number;
              secondCompletedAt: number;
              overlapped: boolean;
              sameEndpointSerialized: boolean;
          };
          crash: {
              taskId: string;
              runId: string;
              crashedWorkerExitCode: number | null;
              statusAfterCrash: string;
              finalStatus: string;
              recovered: boolean;
              outputCount: number;
          };
      };

export async function runHatchetLiveVerify(): Promise<LiveVerifyResult> {
    if (!hasHatchetToken()) {
        return {
            skipped: true,
            reason: 'HATCHET_CLIENT_TOKEN is not configured; live Hatchet verification was not attempted.'
        };
    }

    process.env.HATCHET_ENDPOINT_MAX_RUNS = process.env.HATCHET_ENDPOINT_MAX_RUNS ?? '1';
    process.env.HATCHET_ENDPOINT_RATE_LIMIT = process.env.HATCHET_ENDPOINT_RATE_LIMIT ?? '120';
    process.env.HATCHET_TASK_EXECUTION_TIMEOUT = process.env.HATCHET_TASK_EXECUTION_TIMEOUT ?? '5s';
    process.env.HATCHET_TASK_SCHEDULE_TIMEOUT = process.env.HATCHET_TASK_SCHEDULE_TIMEOUT ?? '45s';

    const client = createHatchetClient();
    const task = createManagedImageMockTask(client);
    const worker = await createManagedImageWorker(client);
    void worker.start();
    await worker.waitUntilReady(Number(process.env.HATCHET_WORKER_READY_TIMEOUT_MS ?? 30_000));

    let execution: Extract<LiveVerifyResult, { skipped: false }>['execution'];
    let concurrency: Extract<LiveVerifyResult, { skipped: false }>['concurrency'];
    try {
        execution = await verifyExecution(task, worker.name);
        concurrency = await verifyEndpointConcurrency(task);
    } finally {
        await worker.stop();
    }

    const crash = await verifyCrashRecovery(task, client);
    assertLiveVerification(concurrency, crash);
    return {
        skipped: false,
        execution,
        concurrency,
        crash
    };
}

async function verifyExecution(
    task: ReturnType<typeof createManagedImageMockTask>,
    workerName: string
): Promise<Extract<LiveVerifyResult, { skipped: false }>['execution']> {
    const input = buildHatchetMockInput({
        taskId: `hatchet-live-exec-${Date.now()}`
    });
    const result = await withTimeout(
        task.run(input, {
            additionalMetadata: phaseMetadata(input.endpointFingerprint, 'execution')
        }),
        30_000,
        'live execution task timed out'
    );

    return {
        worker: workerName,
        taskId: input.taskId,
        status: result.status,
        outputCount: result.outputCount
    };
}

async function verifyEndpointConcurrency(
    task: ReturnType<typeof createManagedImageMockTask>
): Promise<Extract<LiveVerifyResult, { skipped: false }>['concurrency']> {
    const endpointFingerprint = `fp_live_concurrency_${Date.now()}`;
    const firstInput = buildHatchetMockInput({
        taskId: `hatchet-live-concurrency-a-${Date.now()}`,
        endpointFingerprint,
        mock: {
            delayMs: 150,
            providerDelayMs: 750,
            downloadDelayMs: 150
        }
    });
    const secondInput = buildHatchetMockInput({
        taskId: `hatchet-live-concurrency-b-${Date.now()}`,
        endpointFingerprint,
        mock: {
            delayMs: 150,
            providerDelayMs: 750,
            downloadDelayMs: 150
        }
    });

    const refs = await withTimeout(
        task.runNoWait([firstInput, secondInput], {
            additionalMetadata: phaseMetadata(endpointFingerprint, 'concurrency')
        }),
        30_000,
        'live concurrency run enqueue timed out'
    );
    const [firstResult, secondResult] = await withTimeout(
        Promise.all(refs.map((ref) => ref.result())),
        60_000,
        'live concurrency tasks timed out'
    );

    return {
        endpointFingerprint,
        firstTaskId: firstInput.taskId,
        secondTaskId: secondInput.taskId,
        firstStartedAt: firstResult.startedAt,
        firstCompletedAt: firstResult.completedAt,
        secondStartedAt: secondResult.startedAt,
        secondCompletedAt: secondResult.completedAt,
        overlapped: rangesOverlap(firstResult, secondResult),
        sameEndpointSerialized: !rangesOverlap(firstResult, secondResult)
    };
}

async function verifyCrashRecovery(
    task: ReturnType<typeof createManagedImageMockTask>,
    client: ReturnType<typeof createHatchetClient>
): Promise<Extract<LiveVerifyResult, { skipped: false }>['crash']> {
    const taskId = `hatchet-live-crash-${Date.now()}`;
    const crashKey = `crash-${taskId}`;
    const ref = await task.runNoWait(
        buildHatchetMockInput({
            taskId,
            endpointFingerprint: `fp_live_crash_${Date.now()}`,
            mock: {
                delayMs: 50,
                providerDelayMs: 100,
                downloadDelayMs: 50,
                crashOnceKey: crashKey
            }
        }),
        {
            additionalMetadata: phaseMetadata('fp_live_crash', 'crash')
        }
    );
    const runId = await ref.getWorkflowRunId();

    const crashedWorkerExitCode = await runCrashWorker();
    const statusAfterCrash = await pollRunStatus(client, runId, 15_000);
    const replacementWorker = await createManagedImageWorker(client);
    void replacementWorker.start();
    await replacementWorker.waitUntilReady(Number(process.env.HATCHET_WORKER_READY_TIMEOUT_MS ?? 30_000));

    try {
        const result = await withTimeout(ref.result(), 60_000, 'live crash recovery task timed out');
        const finalStatus = await pollRunStatus(client, runId, 10_000);
        return {
            taskId,
            runId,
            crashedWorkerExitCode,
            statusAfterCrash,
            finalStatus,
            recovered: result.status === 'succeeded' && finalStatus === 'COMPLETED',
            outputCount: result.outputCount
        };
    } finally {
        await replacementWorker.stop();
    }
}

function runCrashWorker(): Promise<number | null> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['dist/hatchet/worker.js'], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                HATCHET_WORKER_SLOTS: '1',
                HATCHET_ENDPOINT_MAX_RUNS: '1',
                HATCHET_ENDPOINT_RATE_LIMIT: '120',
                HATCHET_TASK_EXECUTION_TIMEOUT: '5s',
                HATCHET_TASK_SCHEDULE_TIMEOUT: '45s'
            },
            stdio: ['ignore', 'ignore', 'pipe']
        });
        let stderr = '';
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.once('error', reject);
        child.once('exit', (code) => {
            if (code === 42 || code === 1 || code === null) {
                resolve(code);
                return;
            }
            reject(new Error(`Crash worker exited unexpectedly with code ${code}: ${stderr.slice(-500)}`));
        });
    });
}

async function pollRunStatus(
    client: ReturnType<typeof createHatchetClient>,
    runId: string,
    timeoutMs: number
): Promise<string> {
    const startedAt = Date.now();
    let lastStatus = 'UNKNOWN';
    while (Date.now() - startedAt < timeoutMs) {
        try {
            lastStatus = await client.runs.get_status(runId);
            if (lastStatus === 'COMPLETED' || lastStatus === 'FAILED' || lastStatus === 'CANCELLED') {
                return lastStatus;
            }
        } catch {
            // Retry until the run is visible through the REST API.
        }
        await sleep(500);
    }
    return lastStatus;
}

function phaseMetadata(endpointFingerprint: string, check: string) {
    return {
        service: 'gpt-image-task-service',
        phase: 'phase-1',
        check,
        endpointFingerprint
    };
}

function rangesOverlap(first: HatchetManagedImageMockOutput, second: HatchetManagedImageMockOutput): boolean {
    return first.startedAt < second.completedAt && second.startedAt < first.completedAt;
}

function assertLiveVerification(
    concurrency: Extract<LiveVerifyResult, { skipped: false }>['concurrency'],
    crash: Extract<LiveVerifyResult, { skipped: false }>['crash']
): void {
    if (!concurrency.sameEndpointSerialized) {
        throw new Error('Live Hatchet verification failed: same endpoint tasks overlapped.');
    }
    if (crash.crashedWorkerExitCode !== 42) {
        throw new Error(`Live Hatchet verification failed: crash worker exited with ${crash.crashedWorkerExitCode}.`);
    }
    if (!crash.recovered) {
        throw new Error(
            `Live Hatchet verification failed: crash run did not recover, final status was ${crash.finalStatus}.`
        );
    }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const result = await runHatchetLiveVerify();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.skipped ? 0 : 0);
}
