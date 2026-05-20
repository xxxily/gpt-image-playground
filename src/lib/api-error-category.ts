import { formatApiError } from '@/lib/api-error';

export type ApiErrorCategory = 'auth' | 'rate-limit' | 'server' | 'network' | 'quota' | 'unknown';

export interface CategorizedError {
    category: ApiErrorCategory;
    message: string;
    rawMessage?: string;
    retryable: boolean;
    retryAfterSec?: number;
    status?: number;
}

/** Error carrying HTTP status and Retry-After header info from taskExecutor to useTaskManager. */
export class TaskExecutionError extends Error {
    status?: number;
    retryAfter?: string;

    constructor(message: string, options?: { status?: number; retryAfter?: string }) {
        super(message);
        this.name = 'TaskExecutionError';
        this.status = options?.status;
        this.retryAfter = options?.retryAfter;
    }
}

const NON_RETRYABLE: ReadonlySet<ApiErrorCategory> = new Set(['auth', 'quota']);

function extractStatusFromMessage(msg: string): number | undefined {
    const m = msg.match(/status[:\s]+(\d{3})/i) || msg.match(/HTTP\s+(\d{3})/i) || msg.match(/\b(4\d{2}|5\d{2})\b/);
    if (!m) return undefined;
    const status = Number(m[1] ?? m[2]);
    return Number.isFinite(status) && status >= 100 && status <= 599 ? status : undefined;
}

function extractRetryAfter(msg: string): number | undefined {
    const m = msg.match(/retry[-\s]?after[:\s=]+(\d+)/i);
    if (!m) return undefined;
    const sec = Number(m[1]);
    return Number.isFinite(sec) && sec > 0 ? sec : undefined;
}

function matchesAuth(lower: string, status?: number): boolean {
    if (status === 401 || status === 403) return true;
    return (
        lower.includes('密码错误') ||
        lower.includes('unauthorized') ||
        lower.includes('forbidden') ||
        lower.includes('invalid api key') ||
        lower.includes('invalid_api_key') ||
        lower.includes('api key 无效') ||
        lower.includes('incorrect api key') ||
        lower.includes('authentication')
    );
}

function matchesRateLimit(lower: string, status?: number): boolean {
    if (status === 429) return true;
    return lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('请求过于频繁');
}

function matchesQuota(lower: string): boolean {
    return (
        lower.includes('insufficient_quota') ||
        lower.includes('quota_exceeded') ||
        lower.includes('billing_hard_limit') ||
        lower.includes('exceeded your current quota') ||
        lower.includes('额度已用尽') ||
        lower.includes('余额不足')
    );
}

function matchesServer(status?: number): boolean {
    return typeof status === 'number' && status >= 500 && status < 600;
}

function matchesNetwork(lower: string): boolean {
    return (
        lower.includes('failed to fetch') ||
        lower.includes('network error') ||
        lower.includes('networkerror') ||
        lower.includes('connection refused') ||
        lower.includes('econnrefused') ||
        lower.includes('econnreset') ||
        lower.includes('etimedout') ||
        lower.includes('socket hang up') ||
        lower.includes('the operation was aborted') ||
        lower.includes('aborterror') ||
        lower.includes('请求超时') ||
        lower.includes('网络') ||
        lower.includes('timeout')
    );
}

function parseRetryAfterHeader(header: string | null | undefined): number | undefined {
    if (!header) return undefined;
    const trimmed = header.trim();
    if (!trimmed) return undefined;

    // Try delta-seconds first
    const parsed = parseInt(trimmed, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;

    // Try HTTP-date
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
        const diff = Math.round((date.getTime() - Date.now()) / 1000);
        return diff > 0 ? diff : undefined;
    }

    return undefined;
}

export function categorizeApiError(error: unknown, status?: number, retryAfterHeader?: string | null): CategorizedError {
    // Derive status from argument or extract from TaskExecutionError / string message
    let resolvedStatus = status;
    if (resolvedStatus === undefined && typeof error === 'object' && error !== null && 'status' in error) {
        const candidate = (error as { status?: unknown }).status;
        if (typeof candidate === 'number' && candidate >= 100 && candidate <= 599) {
            resolvedStatus = candidate;
        }
    }
    if (resolvedStatus === undefined && typeof error === 'string') {
        resolvedStatus = extractStatusFromMessage(error);
    }
    if (resolvedStatus === undefined && error instanceof Error && 'status' in error) {
        const candidate = (error as { status?: unknown }).status;
        if (typeof candidate === 'number' && candidate >= 100 && candidate <= 599) {
            resolvedStatus = candidate;
        }
    }

    // Derive retryAfter from header arg, TaskExecutionError.retryAfter, or message
    let retryAfterSec: number | undefined = parseRetryAfterHeader(retryAfterHeader);
    const message = typeof error === 'string' ? error : formatApiError(error, '');

    if (retryAfterSec === undefined && typeof error === 'object' && error !== null && 'retryAfter' in error) {
        retryAfterSec = parseRetryAfterHeader((error as { retryAfter?: string }).retryAfter);
    }

    if (retryAfterSec === undefined && message) {
        retryAfterSec = extractRetryAfter(message);
    }

    if (!message) {
        const fallbackMsg = error instanceof Error ? error.message : '未知错误';
        return {
            category: 'unknown',
            message: fallbackMsg,
            rawMessage: fallbackMsg || undefined,
            retryable: true,
            retryAfterSec,
            status: resolvedStatus
        };
    }

    const lower = message.toLowerCase();

    let category: ApiErrorCategory = 'unknown';
    if (matchesQuota(lower)) category = 'quota';
    else if (matchesAuth(lower, resolvedStatus)) category = 'auth';
    else if (matchesRateLimit(lower, resolvedStatus)) category = 'rate-limit';
    else if (matchesServer(resolvedStatus)) category = 'server';
    else if (matchesNetwork(lower)) category = 'network';

    return {
        category,
        message,
        rawMessage: message || undefined,
        retryable: !NON_RETRYABLE.has(category),
        retryAfterSec,
        status: resolvedStatus
    };
}
