export type TaskDurationSample = {
    durationMs: number;
    model?: string;
    sizeKey?: string;
    n?: number;
};

export type EstimateEtaParams = {
    samples: readonly TaskDurationSample[];
    model?: string;
    sizeKey?: string;
    n?: number;
    sampleLimit?: number;
    minSamples?: number;
    maxBoundMs?: number;
};

const DEFAULT_SAMPLE_LIMIT = 20;
const DEFAULT_MIN_SAMPLES = 3;
const DEFAULT_MAX_BOUND_MS = 10 * 60 * 1000;

export function estimateTaskDurationMs(params: EstimateEtaParams): number | null {
    const limit = params.sampleLimit ?? DEFAULT_SAMPLE_LIMIT;
    const minSamples = params.minSamples ?? DEFAULT_MIN_SAMPLES;
    const maxBound = params.maxBoundMs ?? DEFAULT_MAX_BOUND_MS;

    const recent = params.samples
        .slice(-limit)
        .filter((sample) => sample.durationMs > 0 && Number.isFinite(sample.durationMs));
    if (recent.length === 0) return null;

    const exactKey = (sample: TaskDurationSample): boolean =>
        (params.model === undefined || sample.model === params.model) &&
        (params.sizeKey === undefined || sample.sizeKey === params.sizeKey) &&
        (params.n === undefined || sample.n === params.n);

    const modelMatch = (sample: TaskDurationSample): boolean =>
        params.model === undefined || sample.model === params.model;

    let pool = recent.filter(exactKey);
    if (pool.length < minSamples) {
        pool = recent.filter(modelMatch);
    }
    if (pool.length < minSamples) {
        pool = recent;
    }
    if (pool.length === 0) return null;

    const sum = pool.reduce((acc, sample) => acc + sample.durationMs, 0);
    const mean = sum / pool.length;
    return Math.min(maxBound, Math.round(mean));
}

export type EtaPhase = 'estimating' | 'overrun';

export type EtaState = {
    phase: EtaPhase;
    remainingMs: number;
    elapsedMs: number;
};

export function computeEtaState(elapsedMs: number, etaMs: number | null | undefined): EtaState {
    if (etaMs === null || etaMs === undefined || !Number.isFinite(etaMs) || etaMs <= 0) {
        return { phase: 'overrun', remainingMs: 0, elapsedMs };
    }
    if (elapsedMs >= etaMs) {
        return { phase: 'overrun', remainingMs: 0, elapsedMs };
    }
    return { phase: 'estimating', remainingMs: Math.max(0, etaMs - elapsedMs), elapsedMs };
}
