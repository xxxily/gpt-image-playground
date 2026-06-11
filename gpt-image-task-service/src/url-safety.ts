import net from 'node:net';

export type UrlSafetyResult = { ok: true; normalizedUrl: string } | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

function parseHttpUrl(value: string): URL | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
        return new URL(trimmed);
    } catch {
        try {
            return new URL(`https://${trimmed}`);
        } catch {
            return null;
        }
    }
}

function normalizeHostname(hostname: string): string {
    return hostname.trim().toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '');
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
    const normalized = hostname.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fe80:')) return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('::ffff:')) {
        const mappedIpv4 = normalized.slice('::ffff:'.length);
        return net.isIP(mappedIpv4) === 4 ? isUnsafeIpv4(mappedIpv4) : true;
    }
    return false;
}

export function validatePublicHttpBaseUrl(value: string): UrlSafetyResult {
    const parsed = parseHttpUrl(value);
    if (!parsed) return { ok: false, reason: 'Base URL is not a valid URL.' };
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { ok: false, reason: 'Base URL must use http or https.' };
    }
    if (parsed.username || parsed.password) {
        return { ok: false, reason: 'Base URL must not include credentials.' };
    }
    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname) return { ok: false, reason: 'Base URL is missing a hostname.' };
    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
        return { ok: false, reason: 'Base URL must not target localhost.' };
    }
    const ipVersion = net.isIP(hostname);
    if (ipVersion === 4 && isUnsafeIpv4(hostname)) {
        return { ok: false, reason: 'Base URL must not target private, link-local, loopback, or reserved IPv4.' };
    }
    if (ipVersion === 6 && isUnsafeIpv6(hostname)) {
        return { ok: false, reason: 'Base URL must not target private, link-local, loopback, or reserved IPv6.' };
    }
    return { ok: true, normalizedUrl: parsed.toString().replace(/\/+$/u, '') };
}
