'use client';

import { formatApiError, readApiResponseBody } from '@/lib/api-error';
import { loadConfig, type AppConfig } from '@/lib/config';
import { getClientDirectLinkRestriction } from '@/lib/connection-policy';
import { appendDesktopAppGuidance, isLikelyWebDirectAccessError } from '@/lib/desktop-guidance';
import { desktopProxyConfigFromAppConfig } from '@/lib/desktop-config';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import {
    buildChatCompletionsUrl,
    buildPromptPolishMessages,
    buildPromptPolishThinkingParams,
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_MODEL,
    extractPromptPolishText,
    normalizePromptPolishPresetId,
    resolvePolishSystemPrompt,
    type PromptPolishResolveSystemPromptResult
} from '@/lib/prompt-polish-core';

export type PolishPromptParams = {
    prompt: string;
    config?: AppConfig;
    clientDirectLinkPriority?: boolean;
    passwordHash?: string | null;
    signal?: AbortSignal;
    systemPrompt?: string;
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

function normalizeDesktopPolishError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null) {
        const record = error as { message?: string; kind?: string };
        if (typeof record.message === 'string' && record.message.trim()) return record.message;
    }
    return DEFAULT_PROMPT_POLISH_ERROR_MESSAGE;
}

export function getPromptPolishErrorMessage(error: unknown): string {
    const message = formatApiError(error, DEFAULT_PROMPT_POLISH_ERROR_MESSAGE).trim();
    return message || DEFAULT_PROMPT_POLISH_ERROR_MESSAGE;
}

function resolvePolishSystemPromptForConfig(
    cfg: AppConfig,
    requestSystemPrompt?: string
): PromptPolishResolveSystemPromptResult {
    return resolvePolishSystemPrompt({
        requestSystemPrompt,
        presetId: cfg.polishingPresetId,
        configCustomPrompt: cfg.polishingPrompt,
    });
}

function shouldDeferProxySystemPromptToServer(cfg: AppConfig, requestSystemPrompt?: string): boolean {
    if (requestSystemPrompt?.trim()) return false;
    const presetId = normalizePromptPolishPresetId(cfg.polishingPresetId);
    return presetId === DEFAULT_POLISHING_PRESET_ID;
}

async function polishPromptViaDesktop(params: PolishPromptParams): Promise<PolishPromptResult> {
    const cfg = params.config ?? loadConfig();
    const apiKey = cfg.polishingApiKey || cfg.openaiApiKey;
    const apiBaseUrl = cfg.polishingApiBaseUrl || cfg.openaiApiBaseUrl;
    const proxyConfig = desktopProxyConfigFromAppConfig(cfg);
    const resolved = resolvePolishSystemPromptForConfig(cfg, params.systemPrompt);

    if (cfg.desktopDebugMode) {
        console.info('[Desktop proxy debug] prompt polish request', {
            model: cfg.polishingModelId || DEFAULT_PROMPT_POLISH_MODEL,
            proxyMode: proxyConfig.mode,
            hasApiBaseUrl: Boolean(apiBaseUrl),
            thinkingEnabled: cfg.polishingThinkingEnabled,
        });
    }

    const result = await invokeDesktopCommand<{ polishedPrompt: string }>('proxy_prompt_polish', {
        request: {
            prompt: params.prompt,
            apiKey: apiKey || undefined,
            apiBaseUrl: apiBaseUrl || undefined,
            modelId: cfg.polishingModelId || undefined,
            systemPrompt: shouldDeferProxySystemPromptToServer(cfg, params.systemPrompt) ? undefined : resolved.systemPrompt,
            thinkingEnabled: cfg.polishingThinkingEnabled,
            thinkingEffort: cfg.polishingThinkingEffort,
            thinkingEffortFormat: cfg.polishingThinkingEffortFormat,
            proxyConfig,
            debugMode: cfg.desktopDebugMode
        }
    });

    if (!result.polishedPrompt) {
        throw new Error('提示词润色失败：模型未返回有效内容。');
    }

    return { polishedPrompt: result.polishedPrompt };
}

async function polishPromptViaProxy(params: PolishPromptParams): Promise<PolishPromptResult> {
    const cfg = params.config ?? loadConfig();
    const apiKey = cfg.polishingApiKey || cfg.openaiApiKey;
    const apiBaseUrl = cfg.polishingApiBaseUrl || cfg.openaiApiBaseUrl;
    const resolved = resolvePolishSystemPromptForConfig(cfg, params.systemPrompt);
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
            systemPrompt: shouldDeferProxySystemPromptToServer(cfg, params.systemPrompt) ? undefined : resolved.systemPrompt,
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
    const resolved = resolvePolishSystemPromptForConfig(cfg, params.systemPrompt);
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
            messages: buildPromptPolishMessages(params.prompt, resolved.systemPrompt),
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

    if (isTauriDesktop()) {
        try {
            return await polishPromptViaDesktop({ ...params, prompt, config: cfg });
        } catch (error) {
            throw new Error(normalizeDesktopPolishError(error));
        }
    }

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
        if (connectionMode === 'direct' && isLikelyWebDirectAccessError(message)) {
            throw new Error(appendDesktopAppGuidance(`直连模式润色失败：目标地址可能不支持 CORS。原始错误: ${message}`));
        }
        throw new Error(message);
    }
}
