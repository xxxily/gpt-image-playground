// Connection ping for image-generation providers (§8.3 utility). Provider-
// kind-specific endpoints, AbortController-driven timeout, granular failure
// taxonomy that the UI can map to actionable labels. No DOM, no React.
import { isLikelyWebDirectAccessError } from '@/lib/desktop-guidance';

export type ConnectionFailureReason = 'auth' | 'cors' | 'network' | 'timeout' | 'http' | 'unknown';

export type ConnectionTestResult =
    | { ok: true; latencyMs: number; modelsFound?: number; note?: string }
    | { ok: false; reason: ConnectionFailureReason; message: string; status?: number };

export type ConnectionProviderKind = 'openai-compatible' | 'gemini' | 'seedream' | 'sensenova';

interface TestParams {
    kind: ConnectionProviderKind;
    baseUrl: string;
    apiKey: string;
    timeoutMs?: number;
    signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function trimTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '');
}

function resolveModelsUrl(kind: ConnectionProviderKind, baseUrl: string, apiKey: string): string {
    const trimmed = trimTrailingSlash(baseUrl || '');
    switch (kind) {
        case 'openai-compatible':
            return `${trimmed || DEFAULT_OPENAI_BASE_URL}/models`;
        case 'gemini': {
            const base = trimmed || DEFAULT_GEMINI_BASE_URL;
            return `${base}/models?key=${encodeURIComponent(apiKey)}`;
        }
        case 'seedream':
        case 'sensenova':
            return `${trimmed}/models`;
    }
}

function buildHeaders(kind: ConnectionProviderKind, apiKey: string): Record<string, string> {
    if (kind === 'gemini') return {};
    return { Authorization: `Bearer ${apiKey}` };
}

function classifyError(error: unknown): { reason: ConnectionFailureReason; message: string } {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return { reason: 'timeout', message: 'Request timed out' };
    }
    if (error instanceof TypeError) {
        const message = error.message || 'Failed to fetch';
        const msg = message.toLowerCase();
        if (msg.includes('cors') || msg.includes('cross-origin') || isLikelyWebDirectAccessError(message)) {
            return { reason: 'cors', message };
        }
        return { reason: 'network', message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { reason: 'unknown', message };
}

function countModelsInBody(body: unknown): number | undefined {
    if (typeof body !== 'object' || body === null) return undefined;
    const candidate = (body as { data?: unknown; models?: unknown }).data ?? (body as { models?: unknown }).models;
    return Array.isArray(candidate) ? candidate.length : undefined;
}

export async function testProviderConnection(params: TestParams): Promise<ConnectionTestResult> {
    const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!params.apiKey.trim()) {
        return { ok: false, reason: 'auth', message: 'API Key 为空' };
    }

    const url = resolveModelsUrl(params.kind, params.baseUrl, params.apiKey);
    const headers = buildHeaders(params.kind, params.apiKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const compositeSignal = params.signal ? mergeSignals(controller.signal, params.signal) : controller.signal;

    const startMonotonic = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
        const response = await fetch(url, { method: 'GET', headers, signal: compositeSignal });
        const latencyMs = Math.round(
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMonotonic
        );
        if (response.status === 401 || response.status === 403) {
            return {
                ok: false,
                reason: 'auth',
                message: response.statusText || `HTTP ${response.status}`,
                status: response.status
            };
        }
        if (!response.ok) {
            return {
                ok: false,
                reason: 'http',
                message: response.statusText || `HTTP ${response.status}`,
                status: response.status
            };
        }
        let body: unknown = null;
        try {
            body = await response.json();
        } catch {
            body = null;
        }
        const modelsFound = countModelsInBody(body);
        if (params.kind === 'seedream' || params.kind === 'sensenova') {
            if (modelsFound === undefined) {
                return {
                    ok: true,
                    latencyMs,
                    note: '该供应商未返回模型列表，仅验证了 Key 可访问 /models 接口'
                };
            }
        }
        return { ok: true, latencyMs, modelsFound };
    } catch (err) {
        return { ok: false, ...classifyError(err) };
    } finally {
        clearTimeout(timer);
    }
}

function mergeSignals(...signals: AbortSignal[]): AbortSignal {
    if (signals.length === 1) return signals[0];
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort();
            break;
        }
        signal.addEventListener('abort', onAbort, { once: true });
    }
    return controller.signal;
}
