'use client';

import { formatApiError, readApiResponseBody } from '@/lib/api-error';
import { loadConfig, type AppConfig } from '@/lib/config';
import { getClientDirectLinkRestriction } from '@/lib/connection-policy';
import {
    buildChatCompletionsUrl,
    buildPromptPolishMessages,
    buildPromptPolishThinkingParams,
    DEFAULT_PROMPT_POLISH_MODEL,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    extractPromptPolishText
} from '@/lib/prompt-polish-core';

export type PolishPromptParams = {
    prompt: string;
    config?: AppConfig;
    clientDirectLinkPriority?: boolean;
    passwordHash?: string | null;
    signal?: AbortSignal;
};

export type PolishPromptResult = {
    polishedPrompt: string;
};

const DEFAULT_PROMPT_POLISH_ERROR_MESSAGE = '提示词润色失败，请稍后重试。';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function extractProxyPolishedPrompt(value: unknown): string | null {
    if (!isRecord(value)) return null;

    const polishedPrompt = value.polishedPrompt;
    return typeof polishedPrompt === 'string' && polishedPrompt.trim() ? polishedPrompt.trim() : null;
}

function buildHttpErrorFallback(prefix: string, response: Response): string {
    return `${prefix}：${response.statusText || `HTTP ${response.status}`}`;
}

function isLikelyCorsOrNetworkFetchError(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
        normalized.includes('cors') ||
        normalized.includes('access-control') ||
        normalized.includes('failed to fetch') ||
        normalized.includes('fetch failed') ||
        normalized.includes('networkerror') ||
        normalized.includes('load failed')
    );
}

export function getPromptPolishErrorMessage(error: unknown): string {
    const message = formatApiError(error, DEFAULT_PROMPT_POLISH_ERROR_MESSAGE).trim();
    return message || DEFAULT_PROMPT_POLISH_ERROR_MESSAGE;
}

async function polishPromptViaProxy(params: PolishPromptParams): Promise<PolishPromptResult> {
    const cfg = params.config ?? loadConfig();
    const apiKey = cfg.polishingApiKey || cfg.openaiApiKey;
    const apiBaseUrl = cfg.polishingApiBaseUrl || cfg.openaiApiBaseUrl;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (params.passwordHash) headers['x-app-password'] = params.passwordHash;

    const response = await fetch('/api/prompt-polish', {
        method: 'POST',
        headers,
        signal: params.signal,
        body: JSON.stringify({
            prompt: params.prompt,
            passwordHash: params.passwordHash || undefined,
            apiKey: apiKey || undefined,
            apiBaseUrl: apiBaseUrl || undefined,
            modelId: cfg.polishingModelId || undefined,
            systemPrompt: cfg.polishingPrompt || undefined,
            thinkingEnabled: cfg.polishingThinkingEnabled,
            thinkingEffort: cfg.polishingThinkingEffort,
            thinkingEffortFormat: cfg.polishingThinkingEffortFormat
        })
    });

    const data = await readApiResponseBody(response);
    if (!response.ok) {
        throw new Error(formatApiError(data, buildHttpErrorFallback('提示词润色失败', response)));
    }

    const polishedPrompt = extractProxyPolishedPrompt(data);
    if (!polishedPrompt) {
        throw new Error('提示词润色失败：模型未返回有效内容。');
    }

    return { polishedPrompt };
}

async function polishPromptDirect(params: PolishPromptParams): Promise<PolishPromptResult> {
    const cfg = params.config ?? loadConfig();
    const apiKey = cfg.polishingApiKey || cfg.openaiApiKey;
    const baseUrl = cfg.polishingApiBaseUrl || cfg.openaiApiBaseUrl;
    const modelId = cfg.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL;
    const systemPrompt = cfg.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT;
    const thinkingParams = buildPromptPolishThinkingParams({
        enabled: cfg.polishingThinkingEnabled,
        effort: cfg.polishingThinkingEffort,
        effortFormat: cfg.polishingThinkingEffortFormat
    });

    if (!apiKey) {
        throw new Error('直连模式润色提示词需要配置 API Key，请在系统配置的“提示词润色”中填写。');
    }

    const response = await fetch(buildChatCompletionsUrl(baseUrl), {
        method: 'POST',
        signal: params.signal,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: modelId,
            messages: buildPromptPolishMessages(params.prompt, systemPrompt),
            temperature: 0.7,
            max_tokens: 1200,
            ...thinkingParams
        })
    });

    const data = await readApiResponseBody(response);
    if (!response.ok) {
        throw new Error(formatApiError(data, buildHttpErrorFallback('直连模式润色失败', response)));
    }

    const polishedPrompt = extractPromptPolishText(data);
    if (!polishedPrompt) {
        throw new Error('提示词润色失败：模型未返回有效内容。');
    }

    return { polishedPrompt };
}

export async function polishPrompt(params: PolishPromptParams): Promise<PolishPromptResult> {
    const prompt = params.prompt.trim();
    if (!prompt) {
        throw new Error('请先输入提示词，再进行润色。');
    }

    const cfg = params.config ?? loadConfig();

    const directLinkRestriction = getClientDirectLinkRestriction({
        enabled: params.clientDirectLinkPriority === true,
        providers: ['openai'],
        openaiApiBaseUrl: cfg.polishingApiBaseUrl || cfg.openaiApiBaseUrl
    });
    const connectionMode = directLinkRestriction ? 'direct' : cfg.connectionMode;

    try {
        return await (connectionMode === 'direct'
            ? polishPromptDirect({ ...params, prompt, config: cfg })
            : polishPromptViaProxy({ ...params, prompt, config: cfg }));
    } catch (error) {
        const message = getPromptPolishErrorMessage(error);
        if (connectionMode === 'direct' && isLikelyCorsOrNetworkFetchError(message)) {
            throw new Error(`直连模式润色失败：目标地址可能不支持 CORS。原始错误: ${message}`);
        }
        throw new Error(message);
    }
}
