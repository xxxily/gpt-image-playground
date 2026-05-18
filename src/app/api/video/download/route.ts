import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
    buildServerFetcher,
    ensureAdapter,
    parseJsonBody,
    parseProviderEndpoint,
    validateEndpointUrl,
    validatePassword,
    videoErrorResponse
} from '@/lib/video-route-helpers';

export async function POST(request: NextRequest) {
    try {
        const body = await parseJsonBody(request);
        const auth = validatePassword(request, body.passwordHash);
        if (auth) return auth;

        const endpoint = parseProviderEndpoint(body.endpoint);
        if (!endpoint) {
            return NextResponse.json({ error: 'Missing or invalid provider endpoint.' }, { status: 400 });
        }
        const safetyError = validateEndpointUrl(endpoint);
        if (safetyError) return safetyError;

        const providerJobId = typeof body.providerJobId === 'string' ? body.providerJobId.trim() : '';
        const resultRemoteUrl = typeof body.resultRemoteUrl === 'string' ? body.resultRemoteUrl.trim() : '';
        if (!providerJobId && !resultRemoteUrl) {
            return NextResponse.json(
                { error: 'Missing required parameter: providerJobId or resultRemoteUrl.' },
                { status: 400 }
            );
        }

        const { adapter, error } = ensureAdapter(endpoint);
        if (error) return error;

        const fetcher = buildServerFetcher(endpoint);
        const upstream = await adapter!.download(
            {
                endpoint,
                ...(providerJobId ? { providerJobId } : {}),
                ...(resultRemoteUrl ? { resultRemoteUrl } : {})
            },
            fetcher
        );

        if (!upstream.ok) {
            const text = await upstream.text().catch(() => '');
            return NextResponse.json(
                { error: text || `Upstream download failed with status ${upstream.status}` },
                { status: upstream.status }
            );
        }

        const headers = new Headers();
        const contentType = upstream.headers.get('content-type');
        if (contentType) headers.set('content-type', contentType);
        const contentLength = upstream.headers.get('content-length');
        if (contentLength) headers.set('content-length', contentLength);
        return new NextResponse(upstream.body, { status: 200, headers });
    } catch (error) {
        console.error('proxy_video_download failed:', error);
        return videoErrorResponse(error, 'Failed to download video result.');
    }
}
