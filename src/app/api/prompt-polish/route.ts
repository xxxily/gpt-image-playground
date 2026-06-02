import { formatApiError, getApiErrorStatus, hasApiErrorPayload } from '@/lib/api-error';
import { CONFIGURATION_REQUIRED_MESSAGE } from '@/lib/configuration-guidance';
import {
    formatClientDirectLinkRestriction,
    getClientDirectLinkRestriction,
    isEnabledEnvFlag
} from '@/lib/connection-policy';
import {
    buildAnthropicMessagesBody,
    buildAnthropicMessagesUrl,
    buildPromptPolishMessages,
    buildPromptPolishThinkingParams,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    extractAnthropicMessageText,
    isAnthropicProviderProtocol,
    normalizePromptPolishThinkingEffort,
    normalizePromptPolishThinkingEffortFormat,
    normalizePromptPolishThinkingEnabled,
    normalizePolishedPrompt
} from '@/lib/prompt-polish-core';
import { validatePublicHttpBaseUrl } from '@/lib/server-url-safety';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

type PromptPolishBody = {
    prompt?: unknown;
    apiKey?: unknown;
    apiBaseUrl?: unknown;
    modelId?: unknown;
    protocol?: unknown;
    systemPrompt?: unknown;
    thinkingEnabled?: unknown;
    thinkingEffort?: unknown;
    thinkingEffortFormat?: unknown;
    passwordHash?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

async function readPromptPolishBody(request: NextRequest): Promise<PromptPolishBody> {
    const contentType = request.headers.get('content-type')?.toLowerCase() || '';

    if (contentType.includes('application/json')) {
        const body = await request.json();
        return isRecord(body) ? body : {};
    }

    const formData = await request.formData();
    return {
        prompt: formData.get('prompt'),
        apiKey: formData.get('x_config_provider_api_key'),
        apiBaseUrl: formData.get('x_config_provider_api_base_url'),
        modelId: formData.get('x_config_provider_model_id'),
        protocol: formData.get('x_config_provider_protocol'),
        systemPrompt: formData.get('x_config_polishing_prompt'),
        thinkingEnabled: formData.get('x_config_polishing_thinking_enabled'),
        thinkingEffort: formData.get('x_config_polishing_thinking_effort'),
        thinkingEffortFormat: formData.get('x_config_polishing_thinking_effort_format'),
        passwordHash: formData.get('passwordHash')
    };
}

function normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function validatePassword(request: NextRequest, body: PromptPolishBody): NextResponse | null {
    if (!process.env.APP_PASSWORD) return null;

    const passwordInput = request.headers.get('x-app-password') || normalizeOptionalString(body.passwordHash);
    if (!passwordInput) {
        return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
    }

    const serverPasswordHash = sha256(process.env.APP_PASSWORD);
    if (passwordInput !== serverPasswordHash) {
        return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
    }

    return null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await readPromptPolishBody(request);
        const authError = validatePassword(request, body);
        if (authError) return authError;

        const prompt = normalizeOptionalString(body.prompt);
        if (!prompt) {
            return NextResponse.json({ error: 'Missing required parameter: prompt' }, { status: 400 });
        }

        const bodyApiBaseUrl = normalizeOptionalString(body.apiBaseUrl);
        const protocol = normalizeOptionalString(body.protocol);
        const usesAnthropicMessages = isAnthropicProviderProtocol(protocol);
        const envPolishingApiBaseUrl = usesAnthropicMessages
            ? process.env.ANTHROPIC_API_BASE_URL
            : process.env.OPENAI_API_BASE_URL;
        const directLinkRestriction = getClientDirectLinkRestriction({
            enabled: isEnabledEnvFlag(
                process.env.CLIENT_DIRECT_LINK_PRIORITY || process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY
            ),
            additionalOpenaiCompatibleBaseUrl: usesAnthropicMessages ? undefined : bodyApiBaseUrl,
            envAdditionalOpenaiCompatibleBaseUrl: usesAnthropicMessages ? undefined : envPolishingApiBaseUrl,
            anthropicApiBaseUrl: usesAnthropicMessages ? bodyApiBaseUrl : undefined,
            envAnthropicApiBaseUrl: usesAnthropicMessages ? envPolishingApiBaseUrl : undefined,
            providers: usesAnthropicMessages ? ['anthropic'] : ['openai']
        });
        if (directLinkRestriction) {
            return NextResponse.json(
                { error: formatClientDirectLinkRestriction(directLinkRestriction) },
                { status: 400 }
            );
        }

        if (bodyApiBaseUrl) {
            const safety = validatePublicHttpBaseUrl(bodyApiBaseUrl);
            if (!safety.ok) {
                return NextResponse.json(
                    { error: `提示词润色 API Base URL 不安全：${safety.reason}` },
                    { status: 400 }
                );
            }
        }

        const apiKey =
            normalizeOptionalString(body.apiKey) ||
            request.headers.get('x-provider-api-key') ||
            (usesAnthropicMessages ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);
        const apiBaseUrl = bodyApiBaseUrl || request.headers.get('x-provider-api-base-url') || envPolishingApiBaseUrl;
        const modelId = normalizeOptionalString(body.modelId);
        const systemPrompt =
            normalizeOptionalString(body.systemPrompt) ||
            process.env.POLISHING_PROMPT ||
            DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT;
        const thinkingEnabled = normalizePromptPolishThinkingEnabled(
            body.thinkingEnabled ?? process.env.POLISHING_THINKING_ENABLED
        );
        const thinkingEffort = normalizePromptPolishThinkingEffort(
            body.thinkingEffort ?? process.env.POLISHING_THINKING_EFFORT
        );
        const thinkingEffortFormat = normalizePromptPolishThinkingEffortFormat(
            body.thinkingEffortFormat ?? process.env.POLISHING_THINKING_EFFORT_FORMAT
        );

        if (!apiKey) {
            return NextResponse.json(
                { code: 'configuration_required', error: CONFIGURATION_REQUIRED_MESSAGE },
                { status: 400 }
            );
        }
        if (!modelId) {
            return NextResponse.json(
                { code: 'configuration_required', error: CONFIGURATION_REQUIRED_MESSAGE },
                { status: 400 }
            );
        }

        if (usesAnthropicMessages) {
            const response = await fetch(buildAnthropicMessagesUrl(apiBaseUrl), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(
                    buildAnthropicMessagesBody({
                        prompt,
                        systemPrompt,
                        model: modelId,
                        temperature: 0.7,
                        maxTokens: 1200,
                        thinkingEnabled,
                        thinkingEffort
                    })
                )
            });
            const data: unknown = await response.json().catch(() => ({}));
            if (!response.ok) {
                return NextResponse.json(
                    { error: formatApiError(data, `提示词润色失败：HTTP ${response.status}`) },
                    { status: response.status }
                );
            }
            const content = extractAnthropicMessageText(data);
            if (!content) {
                return NextResponse.json({ error: '提示词润色失败：模型未返回有效内容。' }, { status: 502 });
            }
            return NextResponse.json({ polishedPrompt: content });
        }

        const thinkingParams = buildPromptPolishThinkingParams({
            enabled: thinkingEnabled,
            effort: thinkingEffort,
            effortFormat: thinkingEffortFormat
        });

        const client = new OpenAI({
            apiKey,
            ...(apiBaseUrl && { baseURL: apiBaseUrl })
        });

        const completion = await client.post<OpenAI.ChatCompletion>('/chat/completions', {
            body: {
                model: modelId,
                messages: buildPromptPolishMessages(prompt, systemPrompt),
                temperature: 0.7,
                max_tokens: 1200,
                ...thinkingParams
            }
        });

        if (hasApiErrorPayload(completion)) {
            return NextResponse.json(
                { error: formatApiError(completion) },
                { status: getApiErrorStatus(completion, 500) }
            );
        }

        const content = completion.choices[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
            return NextResponse.json({ error: '提示词润色失败：模型未返回有效内容。' }, { status: 502 });
        }

        return NextResponse.json({ polishedPrompt: normalizePolishedPrompt(content) });
    } catch (error: unknown) {
        console.error('Prompt polish failed:', error);
        return NextResponse.json(
            { error: formatApiError(error, '提示词润色失败。') },
            { status: getApiErrorStatus(error, 500) }
        );
    }
}
