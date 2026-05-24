import { formatApiError, getApiErrorStatus } from '@/lib/api-error';
import {
    discoverAnthropicModels,
    discoverOpenAICompatibleModels,
    type DiscoverProviderModelsRequest
} from '@/lib/model-discovery';
import {
    getProviderEndpointCompatibilityFamily,
    supportsProviderEndpointModelDiscovery
} from '@/lib/provider-model-binding';
import { supportsProviderModelDiscovery } from '@/lib/provider-model-catalog';
import { isAnthropicProviderProtocol } from '@/lib/prompt-polish-core';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function readBody(request: NextRequest): Promise<DiscoverProviderModelsRequest> {
    const body = await request.json().catch(() => ({}));
    return isRecord(body)
        ? (body as DiscoverProviderModelsRequest)
        : { endpoint: {} as DiscoverProviderModelsRequest['endpoint'] };
}

function validatePassword(request: NextRequest, body: DiscoverProviderModelsRequest): NextResponse | null {
    if (!process.env.APP_PASSWORD) return null;
    const passwordInput = request.headers.get('x-app-password') || normalizeOptionalString(body.passwordHash);
    if (!passwordInput) {
        return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
    }
    if (passwordInput !== sha256(process.env.APP_PASSWORD)) {
        return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await readBody(request);
        const authError = validatePassword(request, body);
        if (authError) return authError;

        const endpoint = body.endpoint;
        if (!isRecord(endpoint) || !normalizeOptionalString(endpoint.id)) {
            return NextResponse.json({ error: 'Missing provider endpoint.' }, { status: 400 });
        }
        const protocol = normalizeOptionalString(endpoint.protocol);
        const provider = normalizeOptionalString(endpoint.provider);
        if (
            !supportsProviderEndpointModelDiscovery({ provider, protocol }) &&
            !supportsProviderModelDiscovery(protocol)
        ) {
            return NextResponse.json({ error: '该供应商暂不支持自动读取模型列表。' }, { status: 400 });
        }

        const compatibilityFamily = getProviderEndpointCompatibilityFamily({ provider, protocol });
        const usesAnthropicModels =
            compatibilityFamily === 'anthropic-compatible' || isAnthropicProviderProtocol(protocol);
        const apiBaseUrl =
            normalizeOptionalString(endpoint.apiBaseUrl) ||
            (usesAnthropicModels ? process.env.ANTHROPIC_API_BASE_URL : process.env.OPENAI_API_BASE_URL) ||
            '';
        const apiKey =
            normalizeOptionalString(endpoint.apiKey) ||
            (usesAnthropicModels ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) ||
            '';
        const result = usesAnthropicModels
            ? await discoverAnthropicModels({ apiKey, apiBaseUrl })
            : await discoverOpenAICompatibleModels({ apiKey, apiBaseUrl });

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: formatApiError(error, '模型列表读取失败。') },
            { status: getApiErrorStatus(error, 500) }
        );
    }
}
