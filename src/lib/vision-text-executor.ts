import OpenAI from 'openai';
import { formatApiError } from '@/lib/api-error';
import { loadConfig } from '@/lib/config';
import { desktopProxyConfigFromAppConfig } from '@/lib/desktop-config';
import {
    invokeDesktopCommand,
    invokeDesktopStreamingCommand
} from '@/lib/desktop-runtime';
import { normalizeOpenAICompatibleBaseUrl } from '@/lib/provider-config';
import {
    getVisionTextProviderInstance,
    resolveVisionTextProviderInstanceCredentials,
    type VisionTextProviderInstance
} from '@/lib/vision-text-provider-instances';
import type {
    ImageToTextStructuredResult,
    VisionTextApiCompatibility,
    VisionTextDetail,
    VisionTextResponseFormat,
    VisionTextTaskType
} from '@/lib/vision-text-types';
import {
    buildVisionTextChatContent,
    buildVisionTextResponsesContent,
    buildVisionTextResponsesTextFormat,
    parseImageToTextStructuredResultFromText
} from '@/lib/vision-text-core';
import type { VisionTextProviderKind } from '@/lib/vision-text-types';

type FileLike = File;

export type VisionTextTaskProgress =
    | { type: 'text_delta'; delta: string }
    | { type: 'usage'; usage?: unknown }
    | { type: 'streaming_complete'; text: string; structured?: ImageToTextStructuredResult | null };

export type VisionTextTaskResult = {
    text: string;
    structured: ImageToTextStructuredResult | null;
    durationMs: number;
    provider: VisionTextProviderKind;
    providerInstanceId: string;
    model: string;
    usage?: unknown;
};

export type VisionTextTaskError = string;

export type VisionTextTaskExecutionParams = {
    connectionMode: 'proxy' | 'direct';
    providerKind: VisionTextProviderKind;
    providerInstances: readonly VisionTextProviderInstance[];
    providerInstanceId?: string;
    model: string;
    prompt: string;
    imageFiles: FileLike[];
    taskType: VisionTextTaskType;
    detail: VisionTextDetail;
    responseFormat: VisionTextResponseFormat;
    streamingEnabled: boolean;
    structuredOutputEnabled: boolean;
    maxOutputTokens: number;
    systemPrompt: string;
    apiCompatibility: VisionTextApiCompatibility;
    apiKey?: string;
    apiBaseUrl?: string;
    openaiApiKey?: string;
    openaiApiBaseUrl?: string;
    passwordHash?: string;
    signal?: AbortSignal;
    onProgress?: (progress: VisionTextTaskProgress) => void;
};

type VisionTextProxyRequest = {
    providerKind: VisionTextProviderKind;
    providerInstanceId: string;
    model: string;
    prompt: string;
    systemPrompt: string;
    taskType: VisionTextTaskType;
    detail: VisionTextDetail;
    responseFormat: VisionTextResponseFormat;
    streamingEnabled: boolean;
    structuredOutputEnabled: boolean;
    maxOutputTokens: number;
    apiCompatibility: VisionTextApiCompatibility;
    apiKey?: string;
    apiBaseUrl?: string;
    images: Array<{
        name: string;
        mimeType: string;
        bytes: number[];
    }>;
    proxyConfig?: ReturnType<typeof desktopProxyConfigFromAppConfig>;
    debugMode?: boolean;
};

type VisionTextProxyResponse = {
    text: string;
    structured?: ImageToTextStructuredResult | null;
    usage?: unknown;
    provider?: string;
    providerInstanceId?: string;
    model?: string;
    durationMs?: number;
};

type VisionTextStreamingPayload = {
    eventType: string;
    data: Record<string, unknown>;
};

function bytesToNumberArray(bytes: Uint8Array): number[] {
    return Array.from(bytes);
}

async function fileToDesktopProxyImage(file: FileLike): Promise<{ name: string; mimeType: string; bytes: number[] }> {
    return {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        bytes: bytesToNumberArray(new Uint8Array(await file.arrayBuffer()))
    };
}

function getOpenAIClient(apiKey: string, apiBaseUrl?: string): OpenAI {
    return new OpenAI({
        apiKey,
        ...(apiBaseUrl ? { baseURL: normalizeOpenAICompatibleBaseUrl(apiBaseUrl) } : {}),
        dangerouslyAllowBrowser: true
    });
}

function buildStructuredOutputGuidance(responseFormat: VisionTextResponseFormat, structuredEnabled: boolean): string {
    if (!structuredEnabled && responseFormat !== 'json_schema') return '';
    return '\n\n请严格输出 JSON，不要使用代码块，不要附加额外解释。';
}

function extractTextFromResponsesOutput(response: unknown): string {
    if (typeof response !== 'object' || response === null) return '';
    const record = response as Record<string, unknown>;
    const outputText = record.output_text;
    if (typeof outputText === 'string' && outputText.trim()) return outputText.trim();

    const output = Array.isArray(record.output) ? record.output : [];
    const parts: string[] = [];
    for (const item of output) {
        if (typeof item !== 'object' || item === null) continue;
        const message = item as Record<string, unknown>;
        const content = Array.isArray(message.content) ? message.content : [];
        for (const part of content) {
            if (typeof part !== 'object' || part === null) continue;
            const contentPart = part as Record<string, unknown>;
            if (typeof contentPart.text === 'string' && contentPart.text.trim()) {
                parts.push(contentPart.text);
            }
        }
    }
    return parts.join('').trim();
}

function normalizeUsage(value: unknown): unknown {
    return value ?? undefined;
}

function parseStructuredOutput(text: string, structuredEnabled: boolean): ImageToTextStructuredResult | null {
    if (!structuredEnabled) return null;
    return parseImageToTextStructuredResultFromText(text);
}

function parseSseBlock(block: string): { eventType: string; data: Record<string, unknown> | null } | null {
    const lines = block.split(/\r?\n/u);
    let eventType = '';
    const dataLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith('event:')) {
            eventType = line.slice('event:'.length).trim();
            continue;
        }
        if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trimStart());
        }
    }

    if (!dataLines.length) return null;
    const dataText = dataLines.join('\n');
    try {
        const parsed = JSON.parse(dataText) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return null;
        }
        return { eventType, data: parsed as Record<string, unknown> };
    } catch {
        return null;
    }
}

async function submitVisionTextRequest(
    params: VisionTextTaskExecutionParams,
    providerInstance: VisionTextProviderInstance,
    client: OpenAI
): Promise<VisionTextProxyResponse | VisionTextTaskError> {
    const instructions = `${params.systemPrompt}${buildStructuredOutputGuidance(
        params.responseFormat,
        params.structuredOutputEnabled
    )}`;
    const textFormat =
        params.responseFormat === 'json_schema'
            ? buildVisionTextResponsesTextFormat('json_schema', params.taskType)
            : undefined;

    try {
        if (params.apiCompatibility === 'responses') {
            const content = await buildVisionTextResponsesContent(
                params.imageFiles,
                params.taskType,
                params.prompt,
                params.detail
            );

            if (params.streamingEnabled) {
                let text = '';
                let structured: ImageToTextStructuredResult | null = null;
                const stream = await client.responses.create({
                    model: params.model,
                    instructions,
                    input: [
                        {
                            role: 'user',
                            content
                        }
                    ],
                    max_output_tokens: params.maxOutputTokens,
                    ...(textFormat ? { text: { format: textFormat } } : {}),
                    stream: true
                } as never);

                for await (const event of stream as unknown as AsyncIterable<{ type: string; delta?: string; response?: unknown; usage?: unknown }>) {
                    if (params.signal?.aborted) return '任务已取消';

                    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
                        text += event.delta;
                        params.onProgress?.({ type: 'text_delta', delta: event.delta });
                    } else if (event.type === 'response.completed' && event.response) {
                        text = extractTextFromResponsesOutput(event.response);
                        structured = parseStructuredOutput(text, params.structuredOutputEnabled);
                        params.onProgress?.({ type: 'streaming_complete', text, structured });
                        return {
                            text,
                            structured,
                            usage: normalizeUsage((event.response as unknown as Record<string, unknown>).usage),
                            provider: providerInstance.kind,
                            providerInstanceId: providerInstance.id,
                            model: params.model
                        };
                    }
                }

                return {
                    text,
                    structured: parseStructuredOutput(text, params.structuredOutputEnabled),
                    provider: providerInstance.kind,
                    providerInstanceId: providerInstance.id,
                    model: params.model
                };
            }

            const response = await client.responses.create({
                model: params.model,
                instructions,
                input: [
                    {
                        role: 'user',
                        content
                    }
                ],
                max_output_tokens: params.maxOutputTokens,
                ...(textFormat ? { text: { format: textFormat } } : {})
            } as never);

            const text = extractTextFromResponsesOutput(response);
            const structured = parseStructuredOutput(text, params.structuredOutputEnabled);
            return {
                text,
                structured,
                usage: normalizeUsage((response as unknown as Record<string, unknown>).usage),
                provider: providerInstance.kind,
                providerInstanceId: providerInstance.id,
                model: params.model
            };
        }

        const messages = [
            { role: 'system', content: instructions },
            {
                role: 'user',
                content: await buildVisionTextChatContent(
                    params.imageFiles,
                    params.taskType,
                    params.prompt,
                    params.detail
                )
            }
        ];

        if (params.streamingEnabled) {
            let text = '';
            const stream = await client.chat.completions.create({
                model: params.model,
                messages,
                max_tokens: params.maxOutputTokens,
                stream: true,
                ...(params.responseFormat === 'json_schema'
                    ? { response_format: { type: 'json_object' } }
                    : {})
            } as never);

            for await (const chunk of stream as unknown as AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>) {
                if (params.signal?.aborted) return '任务已取消';
                const delta = chunk.choices?.[0]?.delta?.content;
                if (typeof delta === 'string' && delta) {
                    text += delta;
                    params.onProgress?.({ type: 'text_delta', delta });
                }
            }

            const structured = parseStructuredOutput(text, params.structuredOutputEnabled);
            params.onProgress?.({ type: 'streaming_complete', text, structured });
            return {
                text,
                structured,
                provider: providerInstance.kind,
                providerInstanceId: providerInstance.id,
                model: params.model
            };
        }

        const response = await client.chat.completions.create({
            model: params.model,
            messages,
            max_tokens: params.maxOutputTokens,
            ...(params.responseFormat === 'json_schema'
                ? { response_format: { type: 'json_object' } }
                : {})
        } as never);
        const text = response.choices?.[0]?.message?.content ?? '';
        const structured = parseStructuredOutput(text, params.structuredOutputEnabled);
        return {
            text,
            structured,
            usage: normalizeUsage((response as unknown as Record<string, unknown>).usage),
            provider: providerInstance.kind,
            providerInstanceId: providerInstance.id,
            model: params.model
        };
    } catch (error) {
        return formatApiError(error, '图生文请求失败。');
    }
}

export async function executeVisionTextTask(
    params: VisionTextTaskExecutionParams
): Promise<VisionTextTaskResult | VisionTextTaskError> {
    const startTime = Date.now();
    const providerInstance = getVisionTextProviderInstance(
        params.providerInstances,
        params.providerKind,
        params.providerInstanceId
    );
    const credentials = resolveVisionTextProviderInstanceCredentials(providerInstance, {
        apiKey: params.openaiApiKey,
        apiBaseUrl: params.openaiApiBaseUrl
    });

    if (!credentials.apiKey) {
        return '图生文需要配置 API Key，请在系统设置中填写。';
    }

    if (!params.imageFiles.length) {
        return '图生文至少需要一张图片。';
    }

    const client = getOpenAIClient(credentials.apiKey, credentials.apiBaseUrl);
    const result = await submitVisionTextRequest(params, providerInstance, client);
    if (typeof result === 'string') return result;
    const provider =
        result.provider === 'openai' || result.provider === 'openai-compatible'
            ? result.provider
            : providerInstance.kind;

    return {
        text: result.text,
        structured: result.structured ?? null,
        durationMs: Date.now() - startTime,
        provider,
        providerInstanceId: result.providerInstanceId ?? providerInstance.id,
        model: result.model ?? params.model,
        usage: result.usage
    };
}

export type {
    VisionTextProxyRequest,
    VisionTextStreamingPayload
};

export async function executeVisionTextDesktopProxyRequest(
    params: VisionTextTaskExecutionParams
): Promise<VisionTextTaskResult | VisionTextTaskError> {
    if (params.signal?.aborted) return '任务已取消';

    const appConfig = loadConfig();
    const proxyConfig = desktopProxyConfigFromAppConfig(appConfig);
    const providerInstance = getVisionTextProviderInstance(
        params.providerInstances,
        params.providerKind,
        params.providerInstanceId
    );
    const credentials = resolveVisionTextProviderInstanceCredentials(providerInstance, {
        apiKey: params.openaiApiKey,
        apiBaseUrl: params.openaiApiBaseUrl
    });
    const request: VisionTextProxyRequest = {
        providerKind: params.providerKind,
        providerInstanceId: providerInstance.id,
        model: params.model,
        prompt: params.prompt,
        systemPrompt: params.systemPrompt,
        taskType: params.taskType,
        detail: params.detail,
        responseFormat: params.responseFormat,
        streamingEnabled: params.streamingEnabled,
        structuredOutputEnabled: params.structuredOutputEnabled,
        maxOutputTokens: params.maxOutputTokens,
        apiCompatibility: params.apiCompatibility,
        apiKey: credentials.apiKey,
        apiBaseUrl: credentials.apiBaseUrl,
        images: await Promise.all(params.imageFiles.map(fileToDesktopProxyImage)),
        proxyConfig,
        debugMode: appConfig.desktopDebugMode
    };

    if (params.streamingEnabled) {
        let streamingError: string | null = null;
        let text = '';
        let structured: ImageToTextStructuredResult | null = null;
        const startTime = Date.now();

        try {
            await invokeDesktopStreamingCommand<VisionTextStreamingPayload>(
                'proxy_image_to_text_streaming',
                { request },
                (event) => {
                    if (params.signal?.aborted) return;
                    if (event.eventType === 'text_delta') {
                        const delta = typeof event.data.delta === 'string' ? event.data.delta : '';
                        if (delta) {
                            text += delta;
                            params.onProgress?.({ type: 'text_delta', delta });
                        }
                    } else if (event.eventType === 'final') {
                        const finalText = typeof event.data.text === 'string' ? event.data.text : text;
                        const finalStructured = parseImageToTextStructuredResultFromText(
                            typeof event.data.text === 'string' ? event.data.text : text
                        );
                        text = finalText;
                        structured = finalStructured;
                        params.onProgress?.({ type: 'streaming_complete', text, structured });
                    } else if (event.eventType === 'error') {
                        streamingError = formatApiError(event.data.error, '图生文流式请求失败。');
                    }
                }
            );
        } catch (error) {
            return formatApiError(error, '桌面端图生文中转请求失败。');
        }

        if (params.signal?.aborted) return '任务已取消';
        if (streamingError) return streamingError;

        return {
            text,
            structured,
            durationMs: Date.now() - startTime,
            provider: providerInstance.kind,
            providerInstanceId: providerInstance.id,
            model: params.model
        };
    }

    try {
        const result = await invokeDesktopCommand<VisionTextProxyResponse>('proxy_image_to_text', { request });
        return {
            text: result.text,
            structured: result.structured ?? null,
            durationMs: result.durationMs ?? 0,
            provider: (result.provider as VisionTextProviderKind) || providerInstance.kind,
            providerInstanceId: result.providerInstanceId || providerInstance.id,
            model: result.model || params.model,
            usage: result.usage
        };
    } catch (error) {
        return formatApiError(error, '桌面端图生文中转请求失败。');
    }
}

export async function executeVisionTextWebProxyRequest(
    params: VisionTextTaskExecutionParams
): Promise<VisionTextTaskResult | VisionTextTaskError> {
    const startTime = Date.now();
    const formData = new FormData();
    if (params.passwordHash) formData.append('passwordHash', params.passwordHash);
    formData.append('providerKind', params.providerKind);
    formData.append('providerInstanceId', params.providerInstanceId || '');
    formData.append('model', params.model);
    formData.append('prompt', params.prompt);
    formData.append('systemPrompt', params.systemPrompt);
    formData.append('taskType', params.taskType);
    formData.append('detail', params.detail);
    formData.append('responseFormat', params.responseFormat);
    formData.append('stream', params.streamingEnabled ? 'true' : 'false');
    formData.append('structuredOutputEnabled', params.structuredOutputEnabled ? 'true' : 'false');
    formData.append('maxOutputTokens', String(params.maxOutputTokens));
    formData.append('apiCompatibility', params.apiCompatibility);
    if (params.apiKey) formData.append('x_config_vision_text_api_key', params.apiKey);
    if (params.apiBaseUrl) formData.append('x_config_vision_text_api_base_url', params.apiBaseUrl);
    if (params.openaiApiKey) formData.append('x_config_openai_api_key', params.openaiApiKey);
    if (params.openaiApiBaseUrl) formData.append('x_config_openai_api_base_url', params.openaiApiBaseUrl);
    for (const [index, file] of params.imageFiles.entries()) {
        formData.append(`image_${index}`, file, file.name);
    }

    const headers: HeadersInit = {};
    if (params.passwordHash) headers['x-app-password'] = params.passwordHash;

    const response = await fetch('/api/image-to-text', {
        method: 'POST',
        body: formData,
        headers,
        signal: params.signal
    });

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
        if (!response.body) return 'Response body is null';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let text = '';
        let structured: ImageToTextStructuredResult | null = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (params.signal?.aborted) {
                reader.releaseLock();
                return '任务已取消';
            }

            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';

            for (const block of blocks) {
                const parsed = parseSseBlock(block);
                if (!parsed) continue;
                const { eventType, data } = parsed;
                if (!data) continue;

                if (eventType === 'text_delta' && typeof data.delta === 'string') {
                    text += data.delta;
                    params.onProgress?.({ type: 'text_delta', delta: data.delta });
                } else if (eventType === 'final') {
                    const finalText = typeof data.text === 'string' ? data.text : text;
                    text = finalText;
                    structured = parseImageToTextStructuredResultFromText(finalText);
                    params.onProgress?.({ type: 'streaming_complete', text, structured });
                } else if (eventType === 'error') {
                    return formatApiError(data.error, '图生文流式请求失败。');
                }
            }
        }

        return {
            text,
            structured,
            durationMs: Date.now() - startTime,
            provider: params.providerKind,
            providerInstanceId: params.providerInstanceId || '',
            model: params.model
        };
    }

    const result = await response.json().catch((error) => ({ error: formatApiError(error, '图生文请求失败。') }));
    if (!response.ok) {
        return formatApiError(result, `API request failed with status ${response.status}`);
    }

    return {
        text: typeof result.text === 'string' ? result.text : '',
        structured: result.structured ?? null,
        durationMs: typeof result.durationMs === 'number' ? result.durationMs : 0,
        provider: params.providerKind,
        providerInstanceId: params.providerInstanceId || '',
        model: params.model,
        usage: result.usage
    };
}
