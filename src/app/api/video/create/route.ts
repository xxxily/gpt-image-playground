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
import {
    type VideoAdapterSourceImage,
    type VideoAdapterSubmitInput
} from '@/lib/video-providers/adapter';

const logger = createServerLogger('api.video.create');

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

        const catalogEntry = findCatalogEntryByPayload(body, endpoint);
        if (!catalogEntry) {
            return NextResponse.json({ error: 'Missing or unknown catalog entry id.' }, { status: 400 });
        }

        const taskMode = body.taskMode === 'image-to-video' ? 'image-to-video' : 'text-to-video';
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        if (!prompt) {
            return NextResponse.json({ error: 'Missing required parameter: prompt.' }, { status: 400 });
        }

        const { adapter, error } = ensureAdapter(endpoint);
        if (error) return error;

        const sourceImages: VideoAdapterSourceImage[] = Array.isArray(body.sourceImages)
            ? (body.sourceImages as VideoAdapterSourceImage[])
            : [];

        const submitInput: VideoAdapterSubmitInput = {
            endpoint,
            catalogEntry,
            taskMode,
            prompt,
            negativePrompt: typeof body.negativePrompt === 'string' ? body.negativePrompt : undefined,
            parameters: typeof body.parameters === 'object' && body.parameters !== null
                ? (body.parameters as VideoAdapterSubmitInput['parameters'])
                : {},
            sourceImages,
            ...(typeof body.callbackUrl === 'string' && body.callbackUrl
                ? { callbackUrl: body.callbackUrl }
                : {})
        };

        const fetcher = buildServerFetcher(endpoint);
        const result = await adapter!.submit(submitInput, fetcher);
        return NextResponse.json(result);
    } catch (error) {
        logger.error('video create proxy failed', { error });
        return videoErrorResponse(error, 'Failed to submit video task.');
    }
}
