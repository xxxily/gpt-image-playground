import { decodeSyncConfigFromShare, encodeSyncConfigForShare, type SharedSyncConfig } from '@/lib/sync/provider-config';

const PROMPT_KEYS = ['prompt'] as const;
const PROMO_PROFILE_KEYS = ['promoProfileId'] as const;
const API_KEY_KEYS = ['apikey', 'apiKey'] as const;
const API_KEY_TEMP_ONLY_KEYS = ['apiKeyTempOnly', 'apiKeyTemporaryOnly'] as const;
const BASE_URL_KEYS = ['baseurl', 'baseUrl'] as const;
const MODEL_KEYS = ['model'] as const;
const PROVIDER_INSTANCE_KEYS = ['providerInstance', 'providerInstanceId', 'instance'] as const;
const AUTOSTART_KEYS = ['autostart', 'autoStart', 'auto', 'generate'] as const;
const SYNC_CONFIG_KEYS = ['syncConfig', 'sync'] as const;
const SECURE_SHARE_KEYS = ['sdata'] as const;
const SECURE_SHARE_PASSWORD_HASH_KEY = 'key';
const SHARE_SOURCE_KEYS = ['source', 'shareSource'] as const;
const APP_SHARE_SOURCE = 'gpt-image-playground';

export type ParsedUrlParams = {
    prompt?: string;
    promoProfileId?: string;
    apiKey?: string;
    apiKeyTempOnly?: boolean;
    baseUrl?: string;
    model?: string;
    providerInstanceId?: string;
    autostart?: boolean;
    syncConfig?: SharedSyncConfig;
};

export type ConsumedKeys = {
    prompt: boolean;
    promoProfileId?: boolean;
    apiKey: boolean;
    apiKeyTempOnly: boolean;
    baseUrl: boolean;
    model: boolean;
    providerInstanceId?: boolean;
    autostart: boolean;
    syncConfig?: boolean;
    secureShare?: boolean;
    secureShareKey?: boolean;
    shareSource?: boolean;
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

    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const url = new URL(candidate);
        if (url.protocol === 'http:' || url.protocol === 'https:') return candidate;
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
    const rawPromoProfileId = resolveFirstValue(params, PROMO_PROFILE_KEYS);
    const rawApiKey = resolveFirstValue(params, API_KEY_KEYS);
    const rawApiKeyTempOnly = resolveFirstValue(params, API_KEY_TEMP_ONLY_KEYS);
    const rawBaseUrl = resolveFirstValue(params, BASE_URL_KEYS);
    const rawModel = resolveFirstValue(params, MODEL_KEYS);
    const rawProviderInstanceId = resolveFirstValue(params, PROVIDER_INSTANCE_KEYS);
    const rawSyncConfig = resolveFirstValue(params, SYNC_CONFIG_KEYS);
    const rawShareSource = resolveFirstValue(params, SHARE_SOURCE_KEYS);

    let autostart: boolean | undefined = undefined;
    for (const key of AUTOSTART_KEYS) {
        if (params.has(key)) {
            autostart = parseBoolLenient(params.get(key));
            break;
        }
    }

    const prompt = rawPrompt ?? undefined;
    const apiKey = rawApiKey ?? undefined;
    const apiKeyTempOnly =
        rawApiKeyTempOnly === undefined ? undefined : parseBoolLenient(rawApiKeyTempOnly);
    const baseUrl = rawBaseUrl === undefined ? undefined : normalizeBaseUrl(rawBaseUrl);
    const model = rawModel ?? undefined;
    const providerInstanceId = rawProviderInstanceId?.trim() || undefined;
    const syncConfig =
        rawSyncConfig === undefined ? undefined : (decodeSyncConfigFromShare(rawSyncConfig) ?? undefined);

    return {
        parsed: {
            ...(prompt !== undefined && { prompt }),
            ...(rawPromoProfileId !== undefined && { promoProfileId: rawPromoProfileId }),
            ...(apiKey !== undefined && { apiKey }),
            ...(apiKeyTempOnly !== undefined && { apiKeyTempOnly }),
            ...(baseUrl !== undefined && { baseUrl }),
            ...(model !== undefined && { model }),
            ...(providerInstanceId !== undefined && { providerInstanceId }),
            ...(autostart !== undefined && { autostart }),
            ...(syncConfig !== undefined && { syncConfig })
        },
        consumed: {
            prompt: prompt !== undefined,
            promoProfileId: rawPromoProfileId !== undefined,
            apiKey: apiKey !== undefined,
            apiKeyTempOnly: rawApiKeyTempOnly !== undefined,
            baseUrl: rawBaseUrl !== undefined,
            model: model !== undefined,
            ...(rawProviderInstanceId !== undefined && { providerInstanceId: true }),
            autostart: autostart !== undefined,
            ...(rawSyncConfig !== undefined && { syncConfig: true }),
            ...(rawShareSource !== undefined && { shareSource: true })
        }
    };
}

const CANONICAL_TO_ALIASES: Record<string, readonly string[]> = {
    prompt: PROMPT_KEYS,
    apiKey: API_KEY_KEYS,
    apiKeyTempOnly: API_KEY_TEMP_ONLY_KEYS,
    baseUrl: BASE_URL_KEYS,
    model: MODEL_KEYS,
    providerInstanceId: PROVIDER_INSTANCE_KEYS,
    autostart: AUTOSTART_KEYS,
    syncConfig: SYNC_CONFIG_KEYS,
    secureShare: SECURE_SHARE_KEYS,
    shareSource: SHARE_SOURCE_KEYS
};

export function buildCleanedUrl(currentUrl: string, consumed: ConsumedKeys): string {
    const url = new URL(currentUrl);

    const keysToRemove = new Set<string>();
    if (consumed.prompt) for (const key of CANONICAL_TO_ALIASES.prompt) keysToRemove.add(key);
    if (consumed.promoProfileId) for (const key of PROMO_PROFILE_KEYS) keysToRemove.add(key);
    if (consumed.apiKey) for (const key of CANONICAL_TO_ALIASES.apiKey) keysToRemove.add(key);
    if (consumed.apiKeyTempOnly) for (const key of CANONICAL_TO_ALIASES.apiKeyTempOnly) keysToRemove.add(key);
    if (consumed.baseUrl) for (const key of CANONICAL_TO_ALIASES.baseUrl) keysToRemove.add(key);
    if (consumed.model) for (const key of CANONICAL_TO_ALIASES.model) keysToRemove.add(key);
    if (consumed.providerInstanceId) for (const key of CANONICAL_TO_ALIASES.providerInstanceId) keysToRemove.add(key);
    if (consumed.autostart) for (const key of CANONICAL_TO_ALIASES.autostart) keysToRemove.add(key);
    if (consumed.syncConfig) for (const key of CANONICAL_TO_ALIASES.syncConfig) keysToRemove.add(key);
    if (consumed.secureShare) for (const key of CANONICAL_TO_ALIASES.secureShare) keysToRemove.add(key);
    if (consumed.shareSource) for (const key of CANONICAL_TO_ALIASES.shareSource) keysToRemove.add(key);

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
    promoProfileId: PROMO_PROFILE_KEYS[0],
    apiKey: API_KEY_KEYS[0],
    apiKeyTempOnly: API_KEY_TEMP_ONLY_KEYS[0],
    baseUrl: BASE_URL_KEYS[0],
    model: MODEL_KEYS[0],
    providerInstanceId: PROVIDER_INSTANCE_KEYS[0],
    autostart: AUTOSTART_KEYS[0],
    syncConfig: SYNC_CONFIG_KEYS[0]
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
    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.promoProfileId, shareParams.promoProfileId);
    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.apiKey, shareParams.apiKey);
    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.baseUrl, shareParams.baseUrl);
    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.model, shareParams.model);
    setNonEmptyParam(params, CANONICAL_SHARE_KEYS.providerInstanceId, shareParams.providerInstanceId);
    if (shareParams.syncConfig) {
        params.set(
            CANONICAL_SHARE_KEYS.syncConfig,
            encodeSyncConfigForShare(shareParams.syncConfig.config, shareParams.syncConfig.restoreOptions)
        );
    }

    if (shareParams.apiKeyTempOnly === true) {
        params.set(CANONICAL_SHARE_KEYS.apiKeyTempOnly, 'true');
    }

    if (shareParams.autostart !== undefined) {
        params.set(CANONICAL_SHARE_KEYS.autostart, String(shareParams.autostart));
    }

    if (Array.from(params.keys()).length > 0) {
        params.set(SHARE_SOURCE_KEYS[0], APP_SHARE_SOURCE);
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

export function buildSecureShareUrl(
    currentUrl: string,
    encryptedPayload: string,
    password?: string,
    publicShareParams: ShareUrlParams = {}
): string {
    const url = new URL(currentUrl);
    const params = new URLSearchParams();
    const trimmedPayload = encryptedPayload.trim();
    if (trimmedPayload) params.set(SECURE_SHARE_KEYS[0], trimmedPayload);

    const publicParams = buildShareQuery(publicShareParams);
    for (const [key, value] of publicParams) {
        if (key === SHARE_SOURCE_KEYS[0]) continue;
        params.set(key, value);
    }

    if (trimmedPayload || Array.from(publicParams.keys()).length > 0) {
        params.set(SHARE_SOURCE_KEYS[0], APP_SHARE_SOURCE);
    }

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

export function isLikelyShareTextCandidate(text: string): boolean {
    const trimmed = text.trimStart();
    if (!trimmed) return false;
    return trimmed.startsWith('?') || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
}

function stripLikelyTrailingUrlPunctuation(value: string): string {
    return value.replace(/[)\].,!?;:，。！？；：]+$/u, '');
}

function isRecognizedShareUrl(url: URL): boolean {
    if (getSecureSharePayload(url.search)) return true;

    const { parsed, consumed } = parseUrlParams(url.search);
    return Boolean(
        parsed.promoProfileId ||
            consumed.prompt ||
            consumed.apiKey ||
            consumed.baseUrl ||
            consumed.model ||
            consumed.providerInstanceId ||
            consumed.syncConfig ||
            (consumed.autostart && parsed.prompt)
    );
}

export function findShareUrlInText(text: string, baseUrl: string = 'https://example.invalid/'): URL | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const candidates: string[] = [];
    const urlMatches = trimmed.match(/[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+/gi);
    if (urlMatches) candidates.push(...urlMatches);
    if (trimmed.startsWith('?')) candidates.push(trimmed);
    candidates.push(trimmed);

    for (const candidate of candidates) {
        try {
            const url = new URL(stripLikelyTrailingUrlPunctuation(candidate), baseUrl);
            if (isRecognizedShareUrl(url)) return url;
        } catch {
            // Continue scanning other candidates.
        }
    }

    return null;
}
