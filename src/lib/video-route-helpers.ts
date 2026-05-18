import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { formatApiError, getApiErrorStatus } from '@/lib/api-error';
import {
    findModelCatalogEntry,
    type ModelCatalogConfig,
    type ModelCatalogEntry,
    type ProviderEndpoint
} from '@/lib/provider-model-catalog';
import { validatePublicHttpBaseUrl } from '@/lib/server-url-safety';
import { VideoAdapterError, type VideoFetcher } from '@/lib/video-providers/adapter';
import { getVideoAdapter } from '@/lib/video-providers/registry';

export type VideoRouteRequestBody = {
    endpoint?: unknown;
    catalogEntryId?: unknown;
    taskMode?: unknown;
    prompt?: unknown;
    negativePrompt?: unknown;
    parameters?: unknown;
    sourceImages?: unknown;
    callbackUrl?: unknown;
    providerJobId?: unknown;
    resultRemoteUrl?: unknown;
    passwordHash?: unknown;
    catalogConfig?: unknown;
};

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function validatePassword(request: NextRequest, passwordHash: unknown): NextResponse | null {
    if (!process.env.APP_PASSWORD) return null;
    const passwordInput = request.headers.get('x-app-password') || normalizeOptionalString(passwordHash);
    if (!passwordInput) {
        return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
    }
    const serverPasswordHash = sha256(process.env.APP_PASSWORD);
    if (passwordInput !== serverPasswordHash) {
        return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
    }
    return null;
}

export function parseProviderEndpoint(value: unknown): ProviderEndpoint | null {
    if (!isRecord(value)) return null;
    if (typeof value.apiBaseUrl !== 'string' || typeof value.id !== 'string') return null;
    return value as ProviderEndpoint;
}

export function findCatalogEntryByPayload(
    body: VideoRouteRequestBody,
    endpoint: ProviderEndpoint
): ModelCatalogEntry | null {
    const catalogEntryId = normalizeOptionalString(body.catalogEntryId);
    if (!catalogEntryId) return null;
    const catalogConfig: ModelCatalogConfig = isRecord(body.catalogConfig)
        ? {
              providerEndpoints: [endpoint],
              modelCatalog: Array.isArray((body.catalogConfig as Record<string, unknown>).modelCatalog)
                  ? ((body.catalogConfig as Record<string, unknown>).modelCatalog as ModelCatalogEntry[])
                  : []
          }
        : { providerEndpoints: [endpoint], modelCatalog: [] };
    return findModelCatalogEntry(catalogConfig, { catalogEntryId });
}

export function ensureAdapter(endpoint: ProviderEndpoint) {
    const adapter = getVideoAdapter(endpoint.protocol);
    if (!adapter) {
        return {
            error: NextResponse.json(
                {
                    error: `No video adapter is registered for protocol "${endpoint.protocol}".`,
                    code: 'adapter_not_registered'
                },
                { status: 501 }
            )
        };
    }
    return { adapter };
}

export function validateEndpointUrl(endpoint: ProviderEndpoint): NextResponse | null {
    if (!endpoint.apiBaseUrl) return null;
    const safety = validatePublicHttpBaseUrl(endpoint.apiBaseUrl);
    if (!safety.ok) {
        return NextResponse.json(
            { error: `Video provider API Base URL is unsafe: ${safety.reason}` },
            { status: 400 }
        );
    }
    return null;
}

export function buildServerFetcher(endpoint: ProviderEndpoint, signal?: AbortSignal): VideoFetcher {
    return async (url: string, init: RequestInit = {}) => {
        const headers = new Headers(init.headers);
        if (endpoint.apiKey && !headers.has('Authorization') && !headers.has('x-goog-api-key')) {
            if (endpoint.provider === 'google-gemini' || endpoint.provider === 'google-vertex-ai') {
                headers.set('x-goog-api-key', endpoint.apiKey);
            } else {
                headers.set('Authorization', `Bearer ${endpoint.apiKey}`);
            }
        }
        return fetch(url, { ...init, headers, signal: init.signal ?? signal });
    };
}

export function videoErrorResponse(error: unknown, fallback = 'Video request failed.'): NextResponse {
    if (error instanceof VideoAdapterError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status ?? 500 }
        );
    }
    return NextResponse.json(
        { error: formatApiError(error, fallback) },
        { status: getApiErrorStatus(error, 500) }
    );
}

export async function parseJsonBody(request: NextRequest): Promise<VideoRouteRequestBody> {
    try {
        const value = await request.json();
        return isRecord(value) ? (value as VideoRouteRequestBody) : {};
    } catch {
        return {};
    }
}
