import { createHash } from 'crypto';
import { lookup } from 'dns/promises';
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type RequestOptions } from 'http';
import { request as httpsRequest } from 'https';
import { isIP } from 'net';
import { NextRequest, NextResponse } from 'next/server';
import { isEnabledEnvFlag } from '@/lib/connection-policy';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 20_000;

type ResolvedAddress = {
    address: string;
    family: 4 | 6;
};

type RemoteImageResponse = {
    status: number;
    headers: IncomingHttpHeaders;
    body: Buffer;
};

type RemoteImageRedirect = {
    status: number;
    location: string;
};

function sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
}

function normalizeHostname(hostname: string): string {
    return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function isPrivateIPv4(address: string): boolean {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;

    const [a, b] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
    );
}

function isPrivateIPv6(address: string): boolean {
    const normalized = address.toLowerCase();
    return (
        normalized === '::' ||
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe8') ||
        normalized.startsWith('fe9') ||
        normalized.startsWith('fea') ||
        normalized.startsWith('feb') ||
        normalized.startsWith('ff')
    );
}

function isBlockedAddress(address: string): boolean {
    const ipv4MappedPrefix = '::ffff:';
    if (address.toLowerCase().startsWith(ipv4MappedPrefix)) {
        return isPrivateIPv4(address.slice(ipv4MappedPrefix.length));
    }

    const version = isIP(address);
    if (version === 4) return isPrivateIPv4(address);
    if (version === 6) return isPrivateIPv6(address);
    return true;
}

function parseRemoteImageUrl(rawUrl: string | null): URL | string {
    if (!rawUrl || rawUrl.length > 8192) return '缺少或无效的图片 URL。';

    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return '图片 URL 格式无效。';
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return '只支持代理 HTTP/HTTPS 图片 URL。';
    }

    if (url.username || url.password) {
        return '图片 URL 不允许包含认证信息。';
    }

    if (url.port && url.port !== '80' && url.port !== '443') {
        return '图片 URL 端口不受支持。';
    }

    const hostname = normalizeHostname(url.hostname).toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        return '不允许代理本机地址。';
    }

    return url;
}

async function resolvePublicRemoteUrl(url: URL): Promise<ResolvedAddress | string> {
    const hostname = normalizeHostname(url.hostname);
    const directIpVersion = isIP(hostname);
    if (directIpVersion === 4 || directIpVersion === 6) {
        if (isBlockedAddress(hostname)) return '不允许代理内网或保留 IP 地址。';
        return { address: hostname, family: directIpVersion };
    }

    let addresses: Array<{ address: string; family: number }>;
    try {
        addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
        return '无法解析图片 URL 域名。';
    }

    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
        return '不允许代理解析到内网或保留 IP 的图片 URL。';
    }

    const resolved = addresses.find((entry): entry is ResolvedAddress => (
        (entry.family === 4 || entry.family === 6) && !isBlockedAddress(entry.address)
    ));

    return resolved ?? '无法解析可用的公网图片地址。';
}

function isRedirect(status: number): boolean {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function getHeaderValue(headers: IncomingHttpHeaders, key: string): string | undefined {
    const value = headers[key.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value;
}

function requestRemoteImage(url: URL, resolvedAddress: ResolvedAddress): Promise<RemoteImageResponse | RemoteImageRedirect | string> {
    return new Promise((resolve) => {
        const hostname = normalizeHostname(url.hostname);
        const requestOptions: RequestOptions = {
            protocol: url.protocol,
            hostname,
            port: url.port || (url.protocol === 'https:' ? '443' : '80'),
            path: `${url.pathname}${url.search}`,
            method: 'GET',
            headers: {
                Accept: 'image/*,*/*;q=0.8',
                'User-Agent': 'gpt-image-playground-image-proxy/1.0'
            },
            lookup: (_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
                callback(null, resolvedAddress.address, resolvedAddress.family);
            }
        };

        const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(requestOptions, (response: IncomingMessage) => {
            const status = response.statusCode ?? 0;
            if (isRedirect(status)) {
                const location = getHeaderValue(response.headers, 'location');
                response.resume();
                resolve(location ? { status, location } : '远程图片重定向缺少目标地址。');
                return;
            }

            const contentLength = getHeaderValue(response.headers, 'content-length');
            if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
                response.resume();
                resolve('远程图片超过大小限制。');
                return;
            }

            const chunks: Buffer[] = [];
            let totalBytes = 0;
            let settled = false;

            response.on('data', (chunk: Buffer | string) => {
                if (settled) return;
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                totalBytes += buffer.byteLength;

                if (totalBytes > MAX_IMAGE_BYTES) {
                    settled = true;
                    request.destroy();
                    response.destroy();
                    resolve('远程图片超过大小限制。');
                    return;
                }

                chunks.push(buffer);
            });

            response.on('end', () => {
                if (settled) return;
                settled = true;
                resolve({ status, headers: response.headers, body: Buffer.concat(chunks) });
            });

            response.on('error', (error: Error) => {
                if (settled) return;
                settled = true;
                resolve(`远程图片响应失败：${error.message}`);
            });
        });

        request.setTimeout(FETCH_TIMEOUT_MS, () => {
            request.destroy(new Error('请求超时'));
        });

        request.on('error', (error: Error) => {
            resolve(`远程图片请求失败：${error.message}`);
        });

        request.end();
    });
}

async function fetchRemoteImage(initialUrl: URL): Promise<RemoteImageResponse | string> {
    let currentUrl = initialUrl;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
        const resolvedAddress = await resolvePublicRemoteUrl(currentUrl);
        if (typeof resolvedAddress === 'string') return resolvedAddress;

        const response = await requestRemoteImage(currentUrl, resolvedAddress);
        if (typeof response === 'string') return response;

        if ('location' in response) {
            try {
                currentUrl = new URL(response.location, currentUrl);
            } catch {
                return '远程图片重定向地址无效。';
            }
            continue;
        }

        return response;
    }

    return '远程图片重定向次数过多。';
}

export async function GET(request: NextRequest) {
    if (process.env.APP_PASSWORD) {
        const passwordHash = request.headers.get('x-app-password') || request.nextUrl.searchParams.get('passwordHash');
        if (!passwordHash) {
            return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
        }

        if (passwordHash !== sha256(process.env.APP_PASSWORD)) {
            return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
        }
    }

    if (isEnabledEnvFlag(process.env.CLIENT_DIRECT_LINK_PRIORITY || process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY)) {
        return NextResponse.json({ error: '当前部署启用了客户端直链优先，服务器图片代理不可用。' }, { status: 400 });
    }

    const parsed = parseRemoteImageUrl(request.nextUrl.searchParams.get('url'));
    if (typeof parsed === 'string') {
        return NextResponse.json({ error: parsed }, { status: 400 });
    }

    const response = await fetchRemoteImage(parsed);
    if (typeof response === 'string') {
        return NextResponse.json({ error: response }, { status: 502 });
    }

    if (response.status < 200 || response.status >= 300) {
        return NextResponse.json({ error: `远程图片请求失败：HTTP ${response.status}` }, { status: 502 });
    }

    const contentType = getHeaderValue(response.headers, 'content-type')?.split(';')[0]?.trim().toLowerCase() || '';
    if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
        return NextResponse.json({ error: '远程 URL 返回的不是图片内容。' }, { status: 415 });
    }

    return new NextResponse(response.body, {
        status: 200,
        headers: {
            'Cache-Control': 'private, max-age=300',
            'Content-Length': response.body.byteLength.toString(),
            'Content-Type': contentType || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff'
        }
    });
}
