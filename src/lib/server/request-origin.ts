type EnvLike = Record<string, string | undefined>;

const DEFAULT_LOCAL_ORIGIN = 'http://localhost:3000';
const ORIGIN_LIST_SEPARATOR = /[\s,]+/u;

export function firstHeaderValue(value: string | null): string {
    return value?.split(',')[0]?.trim() || '';
}

export function normalizeOrigin(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;

    if (!trimmed.includes('://')) {
        try {
            const parsed = new URL(`https://${trimmed}`);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
            return parsed.origin;
        } catch {
            return null;
        }
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.origin;
    } catch {
        return null;
    }
}

export function parseConfiguredOrigins(values: Array<string | null | undefined>): string[] {
    const origins = values.flatMap((value) =>
        (value || '')
            .split(ORIGIN_LIST_SEPARATOR)
            .map((item) => normalizeOrigin(item))
            .filter((origin): origin is string => Boolean(origin))
    );
    return Array.from(new Set(origins));
}

function normalizeHeaderHost(value: string | null): string {
    const host = firstHeaderValue(value);
    if (!host || /[\s/@\\]/u.test(host)) return '';
    return host;
}

function normalizeHeaderProto(value: string | null): 'http' | 'https' | null {
    const proto = firstHeaderValue(value).toLowerCase();
    return proto === 'http' || proto === 'https' ? proto : null;
}

function getRequestUrlProtocol(requestUrl: string): 'http' | 'https' | null {
    try {
        const protocol = new URL(requestUrl).protocol;
        return protocol === 'http:' || protocol === 'https:' ? protocol.slice(0, -1) as 'http' | 'https' : null;
    } catch {
        return null;
    }
}

function getRequestUrlHost(requestUrl: string): string {
    try {
        return new URL(requestUrl).host;
    } catch {
        return '';
    }
}

function isLoopbackHost(host: string): boolean {
    const hostname = host.replace(/:\d+$/u, '').replace(/^\[|\]$/gu, '').toLowerCase();
    return hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.');
}

export function getForwardedRequestOrigin(headers: Headers, requestUrl?: string): string | null {
    const host = normalizeHeaderHost(headers.get('x-forwarded-host')) || normalizeHeaderHost(headers.get('host'));
    if (!host) return null;

    const requestUrlProtocol = requestUrl ? getRequestUrlProtocol(requestUrl) : null;
    const requestUrlHost = requestUrl ? getRequestUrlHost(requestUrl) : '';
    const proto =
        normalizeHeaderProto(headers.get('x-forwarded-proto')) ||
        (requestUrlHost === host ? requestUrlProtocol : null) ||
        (isLoopbackHost(host) ? requestUrlProtocol || 'http' : 'https');
    return normalizeOrigin(`${proto}://${host}`);
}

export function getRequestPublicOrigin(request: Request): string {
    return getForwardedRequestOrigin(request.headers, request.url) || normalizeOrigin(request.url) || DEFAULT_LOCAL_ORIGIN;
}

export function getHeadersPublicOrigin(headers: Headers, fallbackOrigin = DEFAULT_LOCAL_ORIGIN): string {
    return getForwardedRequestOrigin(headers) || normalizeOrigin(headers.get('origin')) || normalizeOrigin(headers.get('referer')) || fallbackOrigin;
}

export function getConfiguredSiteOrigins(env: EnvLike = process.env): string[] {
    return parseConfiguredOrigins([
        env.NEXT_PUBLIC_SITE_URL,
        env.NEXT_PUBLIC_APP_URL,
        env.AUTH_BASE_URL,
        env.AUTH_TRUSTED_ORIGINS
    ]);
}
