import net, { BlockList } from 'node:net';

export type UrlSafetyResult = { ok: true; normalizedUrl: string } | { ok: false; reason: string };

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

const BLOCKED_IPV4_NETWORKS = new BlockList();
for (const [address, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
] as const) {
    BLOCKED_IPV4_NETWORKS.addSubnet(address, prefix, 'ipv4');
}

const BLOCKED_IPV6_NETWORKS = new BlockList();
for (const [address, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['::ffff:0:0', 96],
    ['64:ff9b:1::', 48],
    ['100::', 64],
    ['2001::', 32],
    ['2001:2::', 48],
    ['2001:10::', 28],
    ['2001:20::', 28],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8]
] as const) {
    BLOCKED_IPV6_NETWORKS.addSubnet(address, prefix, 'ipv6');
}

export function isPublicNetworkAddress(value: string): boolean {
    const address = normalizeHostname(value);
    const version = net.isIP(address);
    if (version === 4) return !BLOCKED_IPV4_NETWORKS.check(address, 'ipv4');
    if (version === 6) return !BLOCKED_IPV6_NETWORKS.check(address, 'ipv6');
    return false;
}

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
    return hostname.trim().toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '').replace(/\.$/u, '');
}

export function validatePublicHttpBaseUrl(value: string): UrlSafetyResult {
    const parsed = parseHttpUrl(value);
    if (!parsed) {
        return { ok: false, reason: 'Base URL 格式无效。' };
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { ok: false, reason: 'Base URL 只支持 http 或 https 协议。' };
    }

    if (parsed.username || parsed.password) {
        return { ok: false, reason: 'Base URL 不允许包含用户名或密码。' };
    }

    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname) {
        return { ok: false, reason: 'Base URL 缺少主机名。' };
    }

    if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
        return { ok: false, reason: 'Base URL 不允许指向 localhost 或本机服务。' };
    }

    const ipVersion = net.isIP(hostname);
    if (ipVersion === 4 && !isPublicNetworkAddress(hostname)) {
        return { ok: false, reason: 'Base URL 不允许指向私网、链路本地、回环或保留 IPv4 地址。' };
    }
    if (ipVersion === 6 && !isPublicNetworkAddress(hostname)) {
        return { ok: false, reason: 'Base URL 不允许指向私网、链路本地、回环或保留 IPv6 地址。' };
    }

    return { ok: true, normalizedUrl: parsed.toString().replace(/\/+$/u, '') };
}
