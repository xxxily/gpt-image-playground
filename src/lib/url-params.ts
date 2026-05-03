const PROMPT_KEYS = ['prompt'] as const;
const API_KEY_KEYS = ['apikey', 'apiKey'] as const;
const BASE_URL_KEYS = ['baseurl', 'baseUrl'] as const;
const MODEL_KEYS = ['model'] as const;
const AUTOSTART_KEYS = ['autostart', 'autoStart', 'auto', 'generate'] as const;
const SECURE_SHARE_KEYS = ['sdata'] as const;
const SECURE_SHARE_PASSWORD_HASH_KEY = 'key';

export type ParsedUrlParams = {
    prompt?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    autostart?: boolean;
};

export type ConsumedKeys = {
    prompt: boolean;
    apiKey: boolean;
    baseUrl: boolean;
    model: boolean;
    autostart: boolean;
    secureShare?: boolean;
    secureShareKey?: boolean;
};

export interface ParseResult {
    parsed: ParsedUrlParams;
    consumed: ConsumedKeys;
}

export type ShareUrlParams = Partial<ParsedUrlParams>;

function resolveFirstValue(params: URLSearchParams, keys: readonly string[]): string | undefined {
    for (const key of keys) {
        const value = params.getAll(key);
        if (value.length > 0) return value[0];
    }
    return undefined;
}

function parseBoolLenient(value: string | null): boolean {
    if (value === null) return true;
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') return true;
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') return false;
    return true;
}

function normalizeBaseUrl(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
        const url = new URL(trimmed);
        if (url.protocol === 'http:' || url.protocol === 'https:') return trimmed;
    } catch {
        return undefined;
    }

    return undefined;
}

export function parseUrlParams(inputSearchParams: URLSearchParams | string): ParseResult {
    const params =
        typeof inputSearchParams === 'string'
            ? new URLSearchParams(inputSearchParams)
            : new URLSearchParams(inputSearchParams.toString());

    const rawPrompt = resolveFirstValue(params, PROMPT_KEYS);
    const rawApiKey = resolveFirstValue(params, API_KEY_KEYS);
    const rawBaseUrl = resolveFirstValue(params, BASE_URL_KEYS);
    const rawModel = resolveFirstValue(params, MODEL_KEYS);

    let autostart: boolean | undefined = undefined;
    for (const key of AUTOSTART_KEYS) {
        if (params.has(key)) {
            autostart = parseBoolLenient(params.get(key));
            break;
        }
    }

    const prompt = rawPrompt ?? undefined;
    const apiKey = rawApiKey ?? undefined;
    const baseUrl = rawBaseUrl === undefined ? undefined : normalizeBaseUrl(rawBaseUrl);
    const model = rawModel ?? undefined;

    return {
        parsed: {
            ...(prompt !== undefined && { prompt }),
            ...(apiKey !== undefined && { apiKey }),
            ...(baseUrl !== undefined && { baseUrl }),
            ...(model !== undefined && { model }),
            ...(autostart !== undefined && { autostart })
        },
        consumed: {
            prompt: prompt !== undefined,
            apiKey: apiKey !== undefined,
            baseUrl: rawBaseUrl !== undefined,
            model: model !== undefined,
            autostart: autostart !== undefined
        }
    };
}

const CANONICAL_TO_ALIASES: Record<string, readonly string[]> = {
    prompt: PROMPT_KEYS,
    apiKey: API_KEY_KEYS,
    baseUrl: BASE_URL_KEYS,
    model: MODEL_KEYS,
    autostart: AUTOSTART_KEYS,
    secureShare: SECURE_SHARE_KEYS
};

export function buildCleanedUrl(currentUrl: string, consumed: ConsumedKeys): string {
    const url = new URL(currentUrl);

    const keysToRemove = new Set<string>();
    if (consumed.prompt) for (const key of CANONICAL_TO_ALIASES.prompt) keysToRemove.add(key);
    if (consumed.apiKey) for (const key of CANONICAL_TO_ALIASES.apiKey) keysToRemove.add(key);
    if (consumed.baseUrl) for (const key of CANONICAL_TO_ALIASES.baseUrl) keysToRemove.add(key);
    if (consumed.model) for (const key of CANONICAL_TO_ALIASES.model) keysToRemove.add(key);
    if (consumed.autostart) for (const key of CANONICAL_TO_ALIASES.autostart) keysToRemove.add(key);
    if (consumed.secureShare) for (const key of CANONICAL_TO_ALIASES.secureShare) keysToRemove.add(key);

    if (keysToRemove.size === 0 && !consumed.secureShareKey) return currentUrl;

    const cleanedParams = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
        if (!keysToRemove.has(key)) cleanedParams.append(key, value);
    }

    url.search = cleanedParams.toString();
    if (consumed.secureShareKey) {
        url.hash = '';
    }
    return url.toString();
}

const CANONICAL_SHARE_KEYS = {
    prompt: PROMPT_KEYS[0],
    apiKey: API_KEY_KEYS[0],
    baseUrl: BASE_URL_KEYS[0],
    model: MODEL_KEYS[0],
    autostart: AUTOSTART_KEYS[0]
} as const;

function setNonEmptyParam(params: URLSearchParams, key: string, value: string | undefined): void {
    if (value === undefined) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    params.set(key, trimmed);
}

export function buildShareQuery(shareParams: ShareUrlParams): URLSearchParams {
    const params = new URLSearchParams();

    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.prompt, shareParams.prompt);
    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.apiKey, shareParams.apiKey);
    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.baseUrl, shareParams.baseUrl);
    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.model, shareParams.model);

    if (shareParams.autostart !== undefined) {
        params.set(CANONICAL_SHARE_KEYS.autostart, String(shareParams.autostart));
    }

    return params;
}

export function buildShareUrl(currentUrl: string, shareParams: ShareUrlParams): string {
    const url = new URL(currentUrl);
    const params = buildShareQuery(shareParams);
    url.search = params.toString();
    return url.toString();
}

export function getSecureSharePayload(inputSearchParams: URLSearchParams | string): string | undefined {
    const params =
        typeof inputSearchParams === 'string'
            ? new URLSearchParams(inputSearchParams)
            : new URLSearchParams(inputSearchParams.toString());

    return resolveFirstValue(params, SECURE_SHARE_KEYS);
}

function normalizeHashParams(inputHash: string): URLSearchParams {
    const hash = inputHash.startsWith('#') ? inputHash.slice(1) : inputHash;
    return new URLSearchParams(hash);
}

export function getSecureSharePasswordFromHash(inputHash: string): string | undefined {
    const value = resolveFirstValue(normalizeHashParams(inputHash), [SECURE_SHARE_PASSWORD_HASH_KEY]);
    if (value === undefined || value.trim().length === 0) return undefined;
    return value;
}

export function buildSecureShareUrl(currentUrl: string, encryptedPayload: string, password?: string): string {
    const url = new URL(currentUrl);
    const params = new URLSearchParams();
    const trimmedPayload = encryptedPayload.trim();
    if (trimmedPayload) params.set(SECURE_SHARE_KEYS[0], trimmedPayload);
    url.search = params.toString();
    if (password !== undefined && password.trim().length > 0) {
        const hashParams = new URLSearchParams();
        hashParams.set(SECURE_SHARE_PASSWORD_HASH_KEY, password);
        url.hash = hashParams.toString();
    }
    return url.toString();
}

export function shouldAutoStartFromUrl(
    parsed: ParsedUrlParams
): parsed is ParsedUrlParams & { autostart: true; prompt: string } {
    return parsed.autostart === true && typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0;
}
