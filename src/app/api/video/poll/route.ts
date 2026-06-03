import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerLogger } from '@/lib/server/server-logger';
import {
    buildServerFetcher,
    ensureAdapter,
    findCatalogEntryByPayload,
    parseJsonBody,
    parseProviderEndpoint,
    validateEndpointUrl,
    validatePassword,
    videoErrorResponse
} from '@/lib/video-route-helpers';

const logger = createServerLogger('api.video.poll');

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

        const catalogEntry = findCatalogEntryByPayload(body, endpoint) ?? undefined;
        const fetcher = buildServerFetcher(endpoint);
        const result = await adapter!.poll(
            { endpoint, catalogEntry, providerJobId },
            fetcher
        );
        return NextResponse.json(result);
    } catch (error) {
        logger.error('video poll proxy failed', { error });
        return videoErrorResponse(error, 'Failed to poll video task.');
    }
}
