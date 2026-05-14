import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { formatApiError, getApiErrorStatus } from '@/lib/api-error';
import { formatClientDirectLinkRestriction, getClientDirectLinkRestriction, isEnabledEnvFlag } from '@/lib/connection-policy';
import { normalizeOpenAICompatibleBaseUrl } from '@/lib/provider-config';
import { validatePublicHttpBaseUrl } from '@/lib/server-url-safety';
import {
    buildVisionTextChatContent,
    buildVisionTextResponsesContent,
    buildVisionTextResponsesTextFormat,
    normalizeVisionTextApiCompatibility,
    normalizeVisionTextDetail,
    normalizeVisionTextMaxOutputTokens,
    normalizeVisionTextResponseFormat,
    normalizeVisionTextStreamingEnabled,
    normalizeVisionTextStructuredOutputEnabled,
    normalizeVisionTextSystemPrompt,
    normalizeVisionTextTaskType,
    parseImageToTextStructuredResultFromText
} from '@/lib/vision-text-core';
import { DEFAULT_VISION_TEXT_MODEL } from '@/lib/vision-text-model-registry';
import type {
    ImageToTextStructuredResult,
    VisionTextApiCompatibility,
    VisionTextResponseFormat,
    VisionTextTaskType
} from '@/lib/vision-text-types';
import {
    DEFAULT_VISION_TEXT_API_COMPATIBILITY,
    DEFAULT_VISION_TEXT_DETAIL,
    DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
    DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
    DEFAULT_VISION_TEXT_SYSTEM_PROMPT,
    DEFAULT_VISION_TEXT_TASK_TYPE
} from '@/lib/vision-text-types';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 120 * 1024 * 1024;

type ImageToTextRequest = {
    providerKind: string;
    providerInstanceId: string;
    model: string;
    prompt: string;
    systemPrompt: string;
    taskType: VisionTextTaskType;
    detail: 'auto' | 'low' | 'high' | 'original';
    responseFormat: VisionTextResponseFormat;
    stream: boolean;
    structuredOutputEnabled: boolean;
    maxOutputTokens: number;
    apiCompatibility: VisionTextApiCompatibility;
    apiKey?: string;
    apiBaseUrl?: string;
    openaiApiKey?: string;
    openaiApiBaseUrl?: string;
    passwordHash?: string;
    images: File[];
};

type SseEvent =
    | { event: 'meta'; data: Record<string, unknown> }
    | { event: 'text_delta'; data: { delta: string } }
    | { event: 'usage'; data: unknown }
    | { event: 'final'; data: { text: string; structured: ImageToTextStructuredResult | null } }
    | { event: 'error'; data: { message: string; status?: number } }
    | { event: 'done'; data: Record<string, never> };

function normalizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function validatePassword(request: NextRequest, body: ImageToTextRequest): NextResponse | null {
    if (!process.env.APP_PASSWORD) return null;

    const passwordInput = request.headers.get('x-app-password') || body.passwordHash;
    if (!passwordInput) {
        return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
    }

    const serverPasswordHash = sha256(process.env.APP_PASSWORD);
    if (passwordInput !== serverPasswordHash) {
        return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
    }

    return null;
}

function getFormString(formData: FormData, key: string): string | undefined {
    return normalizeOptionalString(formData.get(key));
}

function getImageFiles(formData: FormData): File[] {
    return Array.from(formData.entries())
        .filter(([key, value]) => key.startsWith('image_') && value instanceof File)
        .map(([, value]) => value as File);
}

function readImageToTextRequest(formData: FormData): ImageToTextRequest {
    const envModel = process.env.VISION_TEXT_MODEL_ID;
    const envCompatibility = process.env.VISION_TEXT_API_COMPATIBILITY;
    const envDetail = process.env.VISION_TEXT_DEFAULT_DETAIL;
    const envStreaming = process.env.VISION_TEXT_STREAMING_ENABLED;

    return {
        providerKind: getFormString(formData, 'providerKind') || 'openai',
        providerInstanceId: getFormString(formData, 'providerInstanceId') || '',
        model: getFormString(formData, 'model') || envModel || DEFAULT_VISION_TEXT_MODEL,
        prompt: getFormString(formData, 'prompt') || '',
        systemPrompt: normalizeVisionTextSystemPrompt(
            getFormString(formData, 'systemPrompt') || process.env.VISION_TEXT_SYSTEM_PROMPT || DEFAULT_VISION_TEXT_SYSTEM_PROMPT
        ),
        taskType: normalizeVisionTextTaskType(getFormString(formData, 'taskType') || DEFAULT_VISION_TEXT_TASK_TYPE),
        detail: normalizeVisionTextDetail(getFormString(formData, 'detail') || envDetail || DEFAULT_VISION_TEXT_DETAIL),
        responseFormat: normalizeVisionTextResponseFormat(
            getFormString(formData, 'responseFormat') || DEFAULT_VISION_TEXT_RESPONSE_FORMAT
        ),
        stream: normalizeVisionTextStreamingEnabled(getFormString(formData, 'stream') ?? envStreaming),
        structuredOutputEnabled: normalizeVisionTextStructuredOutputEnabled(
            getFormString(formData, 'structuredOutputEnabled')
        ),
        maxOutputTokens: normalizeVisionTextMaxOutputTokens(
            getFormString(formData, 'maxOutputTokens') || DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS
        ),
        apiCompatibility: normalizeVisionTextApiCompatibility(
            getFormString(formData, 'apiCompatibility') || envCompatibility || DEFAULT_VISION_TEXT_API_COMPATIBILITY
        ),
        apiKey: getFormString(formData, 'x_config_vision_text_api_key'),
        apiBaseUrl: getFormString(formData, 'x_config_vision_text_api_base_url'),
        openaiApiKey: getFormString(formData, 'x_config_openai_api_key'),
        openaiApiBaseUrl: getFormString(formData, 'x_config_openai_api_base_url'),
        passwordHash: getFormString(formData, 'passwordHash'),
        images: getImageFiles(formData)
    };
}

function validateImages(images: File[]): NextResponse | null {
    if (images.length === 0) {
        return NextResponse.json({ error: '图生文至少需要一张图片。' }, { status: 400 });
    }

    let totalBytes = 0;
    for (const image of images) {
        totalBytes += image.size;
        if (image.size > MAX_IMAGE_BYTES) {
            return NextResponse.json(
                { error: `图片 ${image.name || '未命名'} 超过 50MB 限制，请压缩后重试。` },
                { status: 400 }
            );
        }
    }
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
        return NextResponse.json({ error: '图片总大小超过 120MB 限制，请减少图片或压缩后重试。' }, { status: 400 });
    }

    return null;
}

function resolveApiCredentials(body: ImageToTextRequest): { apiKey: string; apiBaseUrl?: string } {
    const apiKey =
        body.apiKey ||
        process.env.VISION_TEXT_API_KEY ||
        body.openaiApiKey ||
        process.env.OPENAI_API_KEY ||
        '';
    const apiBaseUrl =
        body.apiBaseUrl ||
        process.env.VISION_TEXT_API_BASE_URL ||
        body.openaiApiBaseUrl ||
        process.env.OPENAI_API_BASE_URL ||
        '';

    return { apiKey, apiBaseUrl: apiBaseUrl || undefined };
}

function createOpenAIClient(apiKey: string, apiBaseUrl?: string): OpenAI {
    return new OpenAI({
        apiKey,
        ...(apiBaseUrl ? { baseURL: normalizeOpenAICompatibleBaseUrl(apiBaseUrl) } : {})
    });
}

function extractTextFromResponsesOutput(response: unknown): string {
    if (typeof response !== 'object' || response === null) return '';
    const record = response as Record<string, unknown>;
    if (typeof record.output_text === 'string' && record.output_text.trim()) {
        return record.output_text.trim();
    }

    const output = Array.isArray(record.output) ? record.output : [];
    const parts: string[] = [];
    for (const item of output) {
        if (typeof item !== 'object' || item === null) continue;
        const content = Array.isArray((item as Record<string, unknown>).content)
            ? ((item as Record<string, unknown>).content as unknown[])
            : [];
        for (const part of content) {
            if (typeof part !== 'object' || part === null) continue;
            const text = (part as Record<string, unknown>).text;
            if (typeof text === 'string' && text) parts.push(text);
        }
    }

    return parts.join('').trim();
}

function extractChatText(response: OpenAI.Chat.Completions.ChatCompletion): string {
    const content = response.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    return '';
}

function buildInstructions(body: ImageToTextRequest): string {
    const structuredGuidance =
        body.structuredOutputEnabled || body.responseFormat === 'json_schema'
            ? '\n\n请严格输出 JSON，不要使用代码块，不要附加额外解释。'
            : '';
    return `${body.systemPrompt}${structuredGuidance}`;
}

function parseStructured(text: string, body: ImageToTextRequest): ImageToTextStructuredResult | null {
    if (!body.structuredOutputEnabled && body.responseFormat !== 'json_schema') return null;
    return parseImageToTextStructuredResultFromText(text);
}

function writeSse(controller: ReadableStreamDefaultController<Uint8Array>, event: SseEvent): void {
    const encoder = new TextEncoder();
    controller.enqueue(
        encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`)
    );
}

async function runNonStreaming(
    client: OpenAI,
    body: ImageToTextRequest
): Promise<{ text: string; structured: ImageToTextStructuredResult | null; usage?: unknown }> {
    const instructions = buildInstructions(body);

    if (body.apiCompatibility === 'responses') {
        const textFormat =
            body.responseFormat === 'json_schema'
                ? buildVisionTextResponsesTextFormat('json_schema', body.taskType)
                : undefined;
        const response = await client.responses.create({
            model: body.model,
            instructions,
            input: [
                {
                    role: 'user',
                    content: await buildVisionTextResponsesContent(body.images, body.taskType, body.prompt, body.detail)
                }
            ],
            max_output_tokens: body.maxOutputTokens,
            ...(textFormat ? { text: { format: textFormat } } : {})
        } as never);
        const text = extractTextFromResponsesOutput(response);
        return {
            text,
            structured: parseStructured(text, body),
            usage: (response as unknown as Record<string, unknown>).usage
        };
    }

    const response = await client.chat.completions.create({
        model: body.model,
        messages: [
            { role: 'system', content: instructions },
            {
                role: 'user',
                content: await buildVisionTextChatContent(body.images, body.taskType, body.prompt, body.detail)
            }
        ],
        max_tokens: body.maxOutputTokens,
        ...(body.responseFormat === 'json_schema' ? { response_format: { type: 'json_object' } } : {})
    } as never);
    const text = extractChatText(response);
    return {
        text,
        structured: parseStructured(text, body),
        usage: response.usage
    };
}

function createStreamingResponse(client: OpenAI, body: ImageToTextRequest, startedAt: number): Response {
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let text = '';
            try {
                writeSse(controller, {
                    event: 'meta',
                    data: {
                        provider: body.providerKind,
                        providerInstanceId: body.providerInstanceId,
                        model: body.model,
                        taskType: body.taskType,
                        apiCompatibility: body.apiCompatibility
                    }
                });

                const instructions = buildInstructions(body);
                if (body.apiCompatibility === 'responses') {
                    const textFormat =
                        body.responseFormat === 'json_schema'
                            ? buildVisionTextResponsesTextFormat('json_schema', body.taskType)
                            : undefined;
                    const upstream = await client.responses.create({
                        model: body.model,
                        instructions,
                        input: [
                            {
                                role: 'user',
                                content: await buildVisionTextResponsesContent(
                                    body.images,
                                    body.taskType,
                                    body.prompt,
                                    body.detail
                                )
                            }
                        ],
                        max_output_tokens: body.maxOutputTokens,
                        ...(textFormat ? { text: { format: textFormat } } : {}),
                        stream: true
                    } as never);

                    for await (const event of upstream as unknown as AsyncIterable<Record<string, unknown>>) {
                        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
                            text += event.delta;
                            writeSse(controller, { event: 'text_delta', data: { delta: event.delta } });
                        } else if (event.type === 'response.completed' && event.response) {
                            text = extractTextFromResponsesOutput(event.response);
                            const usage = (event.response as unknown as Record<string, unknown>).usage;
                            if (usage) writeSse(controller, { event: 'usage', data: usage });
                        }
                    }
                } else {
                    const upstream = await client.chat.completions.create({
                        model: body.model,
                        messages: [
                            { role: 'system', content: instructions },
                            {
                                role: 'user',
                                content: await buildVisionTextChatContent(
                                    body.images,
                                    body.taskType,
                                    body.prompt,
                                    body.detail
                                )
                            }
                        ],
                        max_tokens: body.maxOutputTokens,
                        stream: true,
                        ...(body.responseFormat === 'json_schema' ? { response_format: { type: 'json_object' } } : {})
                    } as never);

                    for await (const chunk of upstream as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
                        const delta = chunk.choices?.[0]?.delta?.content;
                        if (typeof delta === 'string' && delta) {
                            text += delta;
                            writeSse(controller, { event: 'text_delta', data: { delta } });
                        }
                    }
                }

                const structured = parseStructured(text, body);
                writeSse(controller, { event: 'final', data: { text, structured } });
                writeSse(controller, { event: 'done', data: {} });
            } catch (error) {
                writeSse(controller, {
                    event: 'error',
                    data: {
                        message: formatApiError(error, '图生文流式请求失败。'),
                        status: getApiErrorStatus(error, 500)
                    }
                });
            } finally {
                if (Date.now() - startedAt >= 0) controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive'
        }
    });
}

export async function POST(request: NextRequest) {
    const startedAt = Date.now();

    try {
        const formData = await request.formData();
        const body = readImageToTextRequest(formData);
        const authError = validatePassword(request, body);
        if (authError) return authError;

        const imageError = validateImages(body.images);
        if (imageError) return imageError;

        if (!body.model.trim()) {
            return NextResponse.json({ error: 'Missing required parameter: model' }, { status: 400 });
        }

        const directLinkRestriction = getClientDirectLinkRestriction({
            enabled: isEnabledEnvFlag(process.env.CLIENT_DIRECT_LINK_PRIORITY || process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY),
            openaiApiBaseUrl: body.apiBaseUrl,
            envOpenaiApiBaseUrl: process.env.VISION_TEXT_API_BASE_URL || process.env.OPENAI_API_BASE_URL,
            providers: ['openai']
        });
        if (directLinkRestriction) {
            return NextResponse.json({ error: formatClientDirectLinkRestriction(directLinkRestriction) }, { status: 400 });
        }

        const { apiKey, apiBaseUrl } = resolveApiCredentials(body);
        if (!apiKey) {
            return NextResponse.json({ error: '图生文需要配置 API Key，请在系统设置中填写。' }, { status: 400 });
        }

        if (apiBaseUrl) {
            const safety = validatePublicHttpBaseUrl(apiBaseUrl);
            if (!safety.ok) {
                return NextResponse.json({ error: `图生文 API Base URL 不安全：${safety.reason}` }, { status: 400 });
            }
        }

        const client = createOpenAIClient(apiKey, apiBaseUrl);
        if (body.stream) {
            return createStreamingResponse(client, body, startedAt);
        }

        const result = await runNonStreaming(client, body);
        return NextResponse.json({
            text: result.text,
            structured: result.structured,
            usage: result.usage,
            provider: body.providerKind,
            providerInstanceId: body.providerInstanceId,
            model: body.model,
            durationMs: Date.now() - startedAt
        });
    } catch (error) {
        return NextResponse.json(
            { error: formatApiError(error, '图生文请求失败。') },
            { status: getApiErrorStatus(error, 500) }
        );
    }
}
