// Heuristic API-error categorization (§3.2 / §3.3). Pattern-matches on the
// error message returned by taskExecutor (which already includes HTTP status
// text via formatApiError) to bucket failures into actionable categories.
// Pure: no fetch, no DOM, no side effects. Pure regex / substring matching.

export type ApiErrorCategory = 'auth' | 'rate-limit' | 'server' | 'network' | 'quota' | 'unknown';

export interface CategorizedError {
    category: ApiErrorCategory;
    message: string;
    retryable: boolean;
    retryAfterSec?: number;
    status?: number;
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

export function categorizeApiError(rawMessage: string | undefined | null): CategorizedError {
    const message = (rawMessage ?? '').trim();
    if (!message) {
        return { category: 'unknown', message: '未知错误', retryable: true };
    }
    const lower = message.toLowerCase();
    const status = extractStatusFromMessage(message);
    const retryAfterSec = extractRetryAfter(message);

    let category: ApiErrorCategory = 'unknown';
    if (matchesQuota(lower)) category = 'quota';
    else if (matchesAuth(lower, status)) category = 'auth';
    else if (matchesRateLimit(lower, status)) category = 'rate-limit';
    else if (matchesServer(status)) category = 'server';
    else if (matchesNetwork(lower)) category = 'network';

    return {
        category,
        message,
        retryable: !NON_RETRYABLE.has(category),
        retryAfterSec,
        status
    };
}
