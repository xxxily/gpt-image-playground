export type PublicApiKeyPurchaseCta = {
    label: string;
    url: string;
};

export type PublicRuntimeConfig = {
    apiKeyPurchaseCta: PublicApiKeyPurchaseCta | null;
};

export const EMPTY_PUBLIC_RUNTIME_CONFIG: PublicRuntimeConfig = {
    apiKeyPurchaseCta: null
};

const BUTTON_LABEL_MIN_LENGTH = 2;
const BUTTON_LABEL_MAX_LENGTH = 32;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/iu;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//iu;
const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

function codePointLength(value: string): number {
    return Array.from(value).length;
}

function normalizeHostname(hostname: string): string {
    return hostname.trim().toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '');
}

function parseClientHttpUrl(value: string): URL | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const candidate = URL_SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        return new URL(candidate);
    } catch {
        return null;
    }
}

function ipv4ToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let value = 0;
    for (const part of parts) {
        if (!/^\d+$/u.test(part)) return null;
        const octet = Number(part);
        if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
        value = (value << 8) + octet;
    }
    return value >>> 0;
}

function isIpv4InRange(ip: string, cidrBase: string, prefixLength: number): boolean {
    const ipNumber = ipv4ToNumber(ip);
    const baseNumber = ipv4ToNumber(cidrBase);
    if (ipNumber === null || baseNumber === null) return false;

    const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
    return (ipNumber & mask) === (baseNumber & mask);
}

function isUnsafeIpv4(hostname: string): boolean {
    return (
        isIpv4InRange(hostname, '0.0.0.0', 8) ||
        isIpv4InRange(hostname, '10.0.0.0', 8) ||
        isIpv4InRange(hostname, '100.64.0.0', 10) ||
        isIpv4InRange(hostname, '127.0.0.0', 8) ||
        isIpv4InRange(hostname, '169.254.0.0', 16) ||
        isIpv4InRange(hostname, '172.16.0.0', 12) ||
        isIpv4InRange(hostname, '192.168.0.0', 16) ||
        isIpv4InRange(hostname, '224.0.0.0', 4) ||
        isIpv4InRange(hostname, '240.0.0.0', 4)
    );
}

function isUnsafeIpv6(hostname: string): boolean {
    if (hostname === '::' || hostname === '::1') return true;
    if (hostname.startsWith('fe80:')) return true;
    if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true;
    if (hostname.startsWith('::ffff:')) {
        const mappedIpv4 = hostname.slice('::ffff:'.length);
        return isUnsafeIpv4(mappedIpv4);
    }
    return false;
}

export function normalizePublicActionButtonLabel(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed || /[\r\n]/u.test(trimmed) || HTML_TAG_PATTERN.test(trimmed)) return '';
    const length = codePointLength(trimmed);
    if (length < BUTTON_LABEL_MIN_LENGTH || length > BUTTON_LABEL_MAX_LENGTH) return '';
    return trimmed;
}

export function normalizePublicRuntimeConfigUrl(value: unknown): string {
    if (typeof value !== 'string') return '';
    const parsed = parseClientHttpUrl(value);
    if (!parsed) return '';
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    if (parsed.username || parsed.password) return '';

    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname) return '';
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) return '';
    if (/^\d+\.\d+\.\d+\.\d+$/u.test(hostname) && isUnsafeIpv4(hostname)) return '';
    if (hostname.includes(':') && isUnsafeIpv6(hostname)) return '';

    return parsed.toString().replace(/\/+$/u, '');
}

export function normalizePublicApiKeyPurchaseCta(value: unknown): PublicApiKeyPurchaseCta | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Record<string, unknown>;
    const label = normalizePublicActionButtonLabel(source.label);
    const url = normalizePublicRuntimeConfigUrl(source.url);
    if (!label || !url) return null;
    return { label, url };
}

export function normalizePublicRuntimeConfig(value: unknown): PublicRuntimeConfig {
    if (!value || typeof value !== 'object') return EMPTY_PUBLIC_RUNTIME_CONFIG;
    const source = value as Record<string, unknown>;
    return {
        apiKeyPurchaseCta: normalizePublicApiKeyPurchaseCta(source.apiKeyPurchaseCta)
    };
}
