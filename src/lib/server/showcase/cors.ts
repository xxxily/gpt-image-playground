import { getConfiguredSiteOrigins } from '@/lib/server/request-origin';

const ORIGIN_SEPARATOR = /[\s,]+/u;

function configuredShowcaseOrigins(): Set<string> {
    const configured = (process.env.SHOWCASE_PUBLIC_ALLOWED_ORIGINS || '')
        .split(ORIGIN_SEPARATOR)
        .map((origin) => origin.trim())
        .filter(Boolean);
    return new Set([...getConfiguredSiteOrigins(), ...configured]);
}

export function getShowcaseCorsHeaders(request: Request): Headers {
    const headers = new Headers({
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'Accept, If-None-Match',
        'access-control-expose-headers': 'ETag',
        vary: 'Origin, Accept-Encoding'
    });
    const origin = request.headers.get('origin')?.trim();
    if (origin && configuredShowcaseOrigins().has(origin)) {
        headers.set('access-control-allow-origin', origin);
    }
    return headers;
}
