'use client';

import { formatApiError } from '@/lib/api-error';
import { loadConfig } from '@/lib/config';
import {
    buildChatCompletionsUrl,
    buildPromptPolishMessages,
    DEFAULT_PROMPT_POLISH_MODEL,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    extractPromptPolishText
} from '@/lib/prompt-polish-core';

export type PolishPromptParams = {
    prompt: string;
    passwordHash?: string | null;
    signal?: AbortSignal;
};

export type PolishPromptResult = {
    polishedPrompt: string;
};

type PromptPolishProxyResponse = {
    polishedPrompt?: unknown;
    error?: unknown;
};

function getResponseMessage(value: PromptPolishProxyResponse, fallback: string): string {
    if (typeof value.error === 'string' && value.error.trim()) return value.error;
    return fallback;
}

async function readJsonResponse(response: Response): Promise<PromptPolishProxyResponse> {
    try {
        const data = await response.json();
        return typeof data === 'object' && data !== null ? data as PromptPolishProxyResponse : {};
    } catch (error) {
        console.warn('Failed to parse prompt polish response JSON:', error);
        return {};
    }
}

async function polishPromptViaProxy(params: PolishPromptParams): Promise<PolishPromptResult> {
    const cfg = loadConfig();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (params.passwordHash) headers['x-app-password'] = params.passwordHash;

    const response = await fetch('/api/prompt-polish', {
        method: 'POST',
        headers,
        signal: params.signal,
        body: JSON.stringify({
            prompt: params.prompt,
            passwordHash: params.passwordHash || undefined,
            apiKey: cfg.polishingApiKey || undefined,
            apiBaseUrl: cfg.polishingApiBaseUrl || undefined,
            modelId: cfg.polishingModelId || undefined,
            systemPrompt: cfg.polishingPrompt || undefined
        })
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error(getResponseMessage(data, `提示词润色失败：${response.statusText || response.status}`));
    }

    if (typeof data.polishedPrompt !== 'string' || !data.polishedPrompt.trim()) {
        throw new Error('提示词润色失败：模型未返回有效内容。');
    }

    return { polishedPrompt: data.polishedPrompt.trim() };
}

async function polishPromptDirect(params: PolishPromptParams): Promise<PolishPromptResult> {
    const cfg = loadConfig();
    const apiKey = cfg.polishingApiKey || cfg.openaiApiKey;
    const baseUrl = cfg.polishingApiBaseUrl || cfg.openaiApiBaseUrl;
    const modelId = cfg.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL;
    const systemPrompt = cfg.polishingPrompt || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT;

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
            max_tokens: 1200
        })
    });

    const data = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error(getResponseMessage(data, `直连模式润色失败：${response.statusText || response.status}`));
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

    const cfg = loadConfig();

    try {
        return cfg.connectionMode === 'direct' ? polishPromptDirect({ ...params, prompt }) : polishPromptViaProxy({ ...params, prompt });
    } catch (error) {
        const message = formatApiError(error, '提示词润色失败。');
        if (cfg.connectionMode === 'direct' && (message.toLowerCase().includes('cors') || message.toLowerCase().includes('fetch'))) {
            throw new Error(`直连模式润色失败：目标地址可能不支持 CORS。原始错误: ${message}`);
        }
        throw new Error(message);
    }
}
