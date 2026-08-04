import type { ShowcaseTopicDraft } from './types';
import { isPublicNetworkAddress } from '@/lib/server-url-safety';
import type { ShowcaseRemoteAsset } from '@/lib/showcase';
import { lookup as dnsLookup } from 'node:dns/promises';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { isIP } from 'node:net';
import sharp from 'sharp';

export const SHOWCASE_REMOTE_MEDIA_MAX_BYTES = 12 * 1024 * 1024;
export const SHOWCASE_REMOTE_MEDIA_MAX_REDIRECTS = 3;
export const SHOWCASE_REMOTE_MEDIA_TIMEOUT_MS = 10_000;
export const SHOWCASE_REMOTE_MEDIA_CONCURRENCY = 4;
const SENSITIVE_QUERY_KEYS = /(?:api[-_]?key|access[-_]?token|auth|credential|password|secret|signature)/iu;

type ResolvedAddress = {
    address: string;
    family: 4 | 6;
};

type RemoteResponse = {
    kind: 'response';
    status: number;
    headers: IncomingHttpHeaders;
    body: Buffer;
};

type RemoteRedirect = {
    kind: 'redirect';
    status: number;
    location: string;
};

type RemoteRequestResult = RemoteResponse | RemoteRedirect;

export type ShowcaseRemoteMediaProbeOptions = {
    lookup?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
    request?: (
        url: URL,
        resolvedAddress: ResolvedAddress,
        limits: { maximumBytes: number; timeoutMs: number }
    ) => Promise<RemoteRequestResult>;
    maximumBytes?: number;
    timeoutMs?: number;
    maximumRedirects?: number;
    concurrency?: number;
};

type RemoteProbeTarget = {
    assetId: string;
    url: string;
    mimeType: ShowcaseRemoteAsset['mimeType'];
    width?: number;
    height?: number;
    variant: 'display' | 'thumbnail';
};

function normalizeHostname(hostname: string): string {
    return hostname.trim().toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '').replace(/\.$/u, '');
}

function parseRemoteMediaUrl(value: string): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error('远程媒体 URL 格式无效。');
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('远程媒体必须使用无凭证 HTTPS URL。');
    }
    if (url.port && url.port !== '443') {
        throw new Error('远程媒体只允许使用 HTTPS 默认端口。');
    }
    const hostname = normalizeHostname(url.hostname);
    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.lan')
    ) {
        throw new Error('远程媒体不允许指向本机或内部域名。');
    }
    for (const key of url.searchParams.keys()) {
        if (SENSITIVE_QUERY_KEYS.test(key)) throw new Error('远程媒体 URL 不允许包含敏感查询参数。');
    }
    return url;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    if (timeoutMs <= 0) throw new Error('远程媒体探测超时。');
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_resolve, reject) => {
                timeoutId = setTimeout(() => reject(new Error('远程媒体探测超时。')), timeoutMs);
            })
        ]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

async function resolvePublicAddress(
    url: URL,
    lookup: NonNullable<ShowcaseRemoteMediaProbeOptions['lookup']>
): Promise<ResolvedAddress> {
    const hostname = normalizeHostname(url.hostname);
    const literalFamily = isIP(hostname);
    if (literalFamily === 4 || literalFamily === 6) {
        if (!isPublicNetworkAddress(hostname)) throw new Error('远程媒体不允许指向内网或保留 IP。');
        return { address: hostname, family: literalFamily };
    }

    let addresses: Array<{ address: string; family: number }>;
    try {
        addresses = await lookup(hostname);
    } catch {
        throw new Error('远程媒体域名无法解析。');
    }
    const supported = addresses.filter((entry): entry is ResolvedAddress => entry.family === 4 || entry.family === 6);
    if (
        supported.length === 0 ||
        supported.length !== addresses.length ||
        supported.some((entry) => !isPublicNetworkAddress(entry.address))
    ) {
        throw new Error('远程媒体域名解析到了内网、保留或无效 IP。');
    }
    return supported[0]!;
}

function isRedirect(status: number): boolean {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function firstHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
    const value = headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
}

function requestRemoteMedia(
    url: URL,
    resolvedAddress: ResolvedAddress,
    limits: { maximumBytes: number; timeoutMs: number }
): Promise<RemoteRequestResult> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (result: RemoteRequestResult) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        const hostname = normalizeHostname(url.hostname);
        const options: RequestOptions = {
            protocol: 'https:',
            hostname,
            port: url.port || '443',
            path: `${url.pathname}${url.search}`,
            method: 'GET',
            headers: {
                Accept: 'image/jpeg,image/png,image/webp,image/avif',
                'Accept-Encoding': 'identity',
                'User-Agent': 'gpt-image-playground-showcase-publisher/1.0'
            },
            lookup: (_hostname, _options, callback) => {
                callback(null, resolvedAddress.address, resolvedAddress.family);
            }
        };
        const request = httpsRequest(options, (response: IncomingMessage) => {
            const status = response.statusCode ?? 0;
            if (isRedirect(status)) {
                const location = firstHeader(response.headers, 'location');
                response.resume();
                if (!location) {
                    fail(new Error('远程媒体重定向缺少目标地址。'));
                    return;
                }
                finish({ kind: 'redirect', status, location });
                return;
            }
            if (status < 200 || status >= 300) {
                response.resume();
                finish({ kind: 'response', status, headers: response.headers, body: Buffer.alloc(0) });
                return;
            }

            const contentLength = Number(firstHeader(response.headers, 'content-length'));
            if (Number.isFinite(contentLength) && contentLength > limits.maximumBytes) {
                response.resume();
                fail(new Error('远程媒体超过大小限制。'));
                return;
            }

            const chunks: Buffer[] = [];
            let totalBytes = 0;
            response.on('data', (chunk: Buffer | string) => {
                if (settled) return;
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                totalBytes += buffer.byteLength;
                if (totalBytes > limits.maximumBytes) {
                    response.destroy();
                    request.destroy();
                    fail(new Error('远程媒体超过大小限制。'));
                    return;
                }
                chunks.push(buffer);
            });
            response.once('end', () =>
                finish({ kind: 'response', status, headers: response.headers, body: Buffer.concat(chunks) })
            );
            response.once('error', fail);
        });
        request.setTimeout(limits.timeoutMs, () => request.destroy(new Error('远程媒体请求超时。')));
        request.once('error', fail);
        request.end();
    });
}

function decodedMimeType(metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>): string | null {
    if (metadata.format === 'jpeg') return 'image/jpeg';
    if (metadata.format === 'png') return 'image/png';
    if (metadata.format === 'webp') return 'image/webp';
    if (metadata.format === 'heif' && metadata.compression === 'av1') return 'image/avif';
    return null;
}

async function validateRemoteResponse(
    target: RemoteProbeTarget,
    response: RemoteResponse,
    maximumBytes: number
): Promise<void> {
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`远程媒体返回 HTTP ${response.status}。`);
    }
    const declaredLength = Number(firstHeader(response.headers, 'content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
        throw new Error('远程媒体超过大小限制。');
    }
    if (response.body.byteLength <= 0 || response.body.byteLength > maximumBytes) {
        throw new Error('远程媒体为空或超过大小限制。');
    }
    const contentType = firstHeader(response.headers, 'content-type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType !== target.mimeType) {
        throw new Error(`远程媒体 MIME 不匹配：期望 ${target.mimeType}。`);
    }

    let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
    try {
        metadata = await sharp(response.body, {
            failOn: 'error',
            limitInputPixels: 40_000_000
        }).metadata();
    } catch {
        throw new Error('远程媒体无法安全解码或像素数量超过限制。');
    }
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (
        decodedMimeType(metadata) !== target.mimeType ||
        width <= 0 ||
        height <= 0 ||
        width > 12_000 ||
        height > 12_000 ||
        width * height > 40_000_000
    ) {
        throw new Error('远程媒体真实格式、尺寸或像素数量不符合要求。');
    }
    if (target.variant === 'display' && target.width !== undefined && target.height !== undefined) {
        if (width !== target.width || height !== target.height) {
            throw new Error('远程媒体声明尺寸与真实尺寸不一致。');
        }
    }
}

async function probeTarget(target: RemoteProbeTarget, options: ShowcaseRemoteMediaProbeOptions): Promise<void> {
    const lookup = options.lookup ?? ((hostname: string) => dnsLookup(hostname, { all: true, verbatim: true }));
    const request = options.request ?? requestRemoteMedia;
    const maximumBytes = options.maximumBytes ?? SHOWCASE_REMOTE_MEDIA_MAX_BYTES;
    const timeoutMs = options.timeoutMs ?? SHOWCASE_REMOTE_MEDIA_TIMEOUT_MS;
    const maximumRedirects = options.maximumRedirects ?? SHOWCASE_REMOTE_MEDIA_MAX_REDIRECTS;
    const deadline = Date.now() + timeoutMs;
    let currentUrl = parseRemoteMediaUrl(target.url);

    try {
        for (let redirectCount = 0; redirectCount <= maximumRedirects; redirectCount += 1) {
            const resolvedAddress = await withTimeout(resolvePublicAddress(currentUrl, lookup), deadline - Date.now());
            const remainingMs = deadline - Date.now();
            if (remainingMs <= 0) throw new Error('远程媒体探测超时。');
            const result = await withTimeout(
                request(currentUrl, resolvedAddress, { maximumBytes, timeoutMs: remainingMs }),
                remainingMs
            );
            if (result.kind === 'redirect') {
                if (redirectCount === maximumRedirects) throw new Error('远程媒体重定向次数过多。');
                currentUrl = parseRemoteMediaUrl(new URL(result.location, currentUrl).toString());
                continue;
            }
            await withTimeout(validateRemoteResponse(target, result, maximumBytes), deadline - Date.now());
            return;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : '远程媒体探测失败。';
        throw new Error(`专题媒体 ${target.assetId}（${target.variant}）发布校验失败：${message}`);
    }
}

function getReferencedRemoteTargets(draft: ShowcaseTopicDraft): RemoteProbeTarget[] {
    const referencedIds = new Set<string>([draft.topic.coverAssetId]);
    const casesById = new Map(draft.cases.map((showcaseCase) => [showcaseCase.id, showcaseCase]));
    for (const caseId of draft.topic.caseIds) {
        const showcaseCase = casesById.get(caseId);
        if (!showcaseCase) continue;
        referencedIds.add(showcaseCase.coverAssetId);
        showcaseCase.inputAssetIds.forEach((id) => referencedIds.add(id));
        showcaseCase.outputAssetIds.forEach((id) => referencedIds.add(id));
    }

    const targets: RemoteProbeTarget[] = [];
    for (const asset of draft.assets) {
        if (
            !referencedIds.has(asset.id) ||
            asset.kind !== 'remote-image' ||
            asset.managedAssetId ||
            !asset.url.startsWith('https://')
        ) {
            continue;
        }
        targets.push({
            assetId: asset.id,
            url: asset.url,
            mimeType: asset.mimeType,
            width: asset.width,
            height: asset.height,
            variant: 'display'
        });
        if (asset.thumbnailUrl?.startsWith('https://')) {
            targets.push({
                assetId: asset.id,
                url: asset.thumbnailUrl,
                mimeType: asset.mimeType,
                variant: 'thumbnail'
            });
        }
    }
    const seen = new Set<string>();
    return targets.filter((target) => {
        const key = `${target.url}\0${target.mimeType}\0${target.width ?? ''}\0${target.height ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function runBounded<T>(
    items: readonly T[],
    concurrency: number,
    task: (item: T) => Promise<void>
): Promise<void> {
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            await task(items[index]!);
        }
    };
    await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, concurrency)) }, () => worker()));
}

export async function assertRemoteShowcaseAssetsHealthy(
    draft: ShowcaseTopicDraft,
    options: ShowcaseRemoteMediaProbeOptions = {}
): Promise<string[]> {
    const targets = getReferencedRemoteTargets(draft);
    await runBounded(targets, options.concurrency ?? SHOWCASE_REMOTE_MEDIA_CONCURRENCY, (target) =>
        probeTarget(target, options)
    );
    return targets.map((target) => target.url);
}
