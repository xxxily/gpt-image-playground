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
        if (!providerJobId) {
            return NextResponse.json({ error: 'Missing required parameter: providerJobId.' }, { status: 400 });
        }

        const { adapter, error } = ensureAdapter(endpoint);
        if (error) return error;

        if (!adapter!.cancel) {
            return NextResponse.json({ ok: false, reason: 'cancel_not_supported' }, { status: 200 });
        }

        const fetcher = buildServerFetcher(endpoint);
        await adapter!.cancel({ endpoint, providerJobId }, fetcher);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('proxy_video_cancel failed:', error);
        return videoErrorResponse(error, 'Failed to cancel video task.');
    }
}
