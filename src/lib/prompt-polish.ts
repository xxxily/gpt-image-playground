'use client';

import { formatApiError, readApiResponseBody } from '@/lib/api-error';
import { loadConfig, type AppConfig } from '@/lib/config';
import { CONFIGURATION_REQUIRED_MESSAGE } from '@/lib/configuration-guidance';
import { getClientDirectLinkRestriction } from '@/lib/connection-policy';
import { desktopProxyConfigFromAppConfig } from '@/lib/desktop-config';
import { appendDesktopAppGuidance, isLikelyWebDirectAccessError } from '@/lib/desktop-guidance';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import {
    buildAnthropicMessagesBody,
    buildAnthropicMessagesUrl,
    buildChatCompletionsUrl,
    buildPromptPolishMessages,
    buildPromptPolishThinkingParams,
    DEFAULT_POLISHING_PRESET_ID,
    extractAnthropicMessageText,
    extractPromptPolishText,
    isAnthropicProviderProtocol,
    normalizePromptPolishPresetId,
    resolvePolishSystemPrompt,
    type PromptPolishResolveSystemPromptResult
} from '@/lib/prompt-polish-core';
import { resolvePromptPolishCatalogSelection } from '@/lib/provider-model-catalog';

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
const MISSING_PROMPT_POLISH_MODEL_MESSAGE = CONFIGURATION_REQUIRED_MESSAGE;

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
        configCustomPrompt: cfg.polishingPrompt
    });
}

function shouldDeferProxySystemPromptToServer(cfg: AppConfig, requestSystemPrompt?: string): boolean {
    if (requestSystemPrompt?.trim()) return false;
    const presetId = normalizePromptPolishPresetId(cfg.polishingPresetId);
    return presetId === DEFAULT_POLISHING_PRESET_ID;
}

function ensurePromptPolishSelection(selection: ReturnType<typeof resolvePromptPolishCatalogSelection>): void {
    if (!selection.endpoint || !selection.modelId || !selection.apiKey) {
        throw new Error(MISSING_PROMPT_POLISH_MODEL_MESSAGE);
    }
}

async function polishPromptViaDesktop(params: PolishPromptParams): Promise<PolishPromptResult> {
    const cfg = params.config ?? loadConfig();
    const selection = resolvePromptPolishCatalogSelection(cfg);
    ensurePromptPolishSelection(selection);
    const proxyConfig = desktopProxyConfigFromAppConfig(cfg);
    const resolved = resolvePolishSystemPromptForConfig(cfg, params.systemPrompt);

    if (cfg.desktopDebugMode) {
        console.info('[Desktop proxy debug] prompt polish request', {
            model: selection.modelId,
            providerEndpointId: selection.endpoint?.id,
            protocol: selection.endpoint?.protocol,
            proxyMode: proxyConfig.mode,
            hasApiBaseUrl: Boolean(selection.apiBaseUrl),
            thinkingEnabled: selection.thinkingEnabled
        });
    }

    const result = await invokeDesktopCommand<{ polishedPrompt: string }>('proxy_prompt_polish', {
        request: {
            prompt: params.prompt,
            apiKey: selection.apiKey || undefined,
            apiBaseUrl: selection.apiBaseUrl || undefined,
            modelId: selection.modelId || undefined,
            protocol: selection.endpoint?.protocol,
            systemPrompt: shouldDeferProxySystemPromptToServer(cfg, params.systemPrompt)
                ? undefined
                : resolved.systemPrompt,
            thinkingEnabled: selection.thinkingEnabled,
            thinkingEffort: selection.thinkingEffort,
            thinkingEffortFormat: selection.thinkingEffortFormat,
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
    const selection = resolvePromptPolishCatalogSelection(cfg);
    ensurePromptPolishSelection(selection);
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
            apiKey: selection.apiKey || undefined,
            apiBaseUrl: selection.apiBaseUrl || undefined,
            modelId: selection.modelId || undefined,
            protocol: selection.endpoint?.protocol,
            systemPrompt: shouldDeferProxySystemPromptToServer(cfg, params.systemPrompt)
                ? undefined
                : resolved.systemPrompt,
            thinkingEnabled: selection.thinkingEnabled,
            thinkingEffort: selection.thinkingEffort,
            thinkingEffortFormat: selection.thinkingEffortFormat
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
    const selection = resolvePromptPolishCatalogSelection(cfg);
    ensurePromptPolishSelection(selection);
    const apiKey = selection.apiKey;
    const baseUrl = selection.apiBaseUrl;
    const modelId = selection.modelId;
    const resolved = resolvePolishSystemPromptForConfig(cfg, params.systemPrompt);
    const thinkingParams = buildPromptPolishThinkingParams({
        enabled: selection.thinkingEnabled,
        effort: selection.thinkingEffort,
        effortFormat: selection.thinkingEffortFormat
    });

    if (isAnthropicProviderProtocol(selection.endpoint?.protocol)) {
        const response = await fetch(buildAnthropicMessagesUrl(baseUrl), {
            method: 'POST',
            signal: params.signal,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(
                buildAnthropicMessagesBody({
                    prompt: params.prompt,
                    systemPrompt: resolved.systemPrompt,
                    model: modelId,
                    temperature: 0.7,
                    maxTokens: 1200,
                    thinkingEnabled: selection.thinkingEnabled,
                    thinkingEffort: selection.thinkingEffort
                })
            )
        });

        const data = await readApiResponseBody(response);
        if (!response.ok) {
            throw new Error(formatApiError(data, buildHttpErrorFallback('直连模式润色失败', response)));
        }

        const polishedPrompt = extractAnthropicMessageText(data);
        if (!polishedPrompt) {
            throw new Error('提示词润色失败：模型未返回有效内容。');
        }

        return { polishedPrompt };
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
    const selection = resolvePromptPolishCatalogSelection(cfg);
    ensurePromptPolishSelection(selection);

    if (isTauriDesktop()) {
        try {
            return await polishPromptViaDesktop({ ...params, prompt, config: cfg });
        } catch (error) {
            throw new Error(normalizeDesktopPolishError(error));
        }
    }

    const directLinkRestriction = getClientDirectLinkRestriction({
        enabled: params.clientDirectLinkPriority === true,
        providers: isAnthropicProviderProtocol(selection.endpoint?.protocol) ? ['anthropic'] : ['openai'],
        openaiApiBaseUrl: isAnthropicProviderProtocol(selection.endpoint?.protocol)
            ? undefined
            : selection.apiBaseUrl || cfg.openaiApiBaseUrl,
        anthropicApiBaseUrl: isAnthropicProviderProtocol(selection.endpoint?.protocol)
            ? selection.apiBaseUrl
            : undefined
    });
    const connectionMode = directLinkRestriction ? 'direct' : cfg.connectionMode;

    try {
        return await (connectionMode === 'direct'
            ? polishPromptDirect({ ...params, prompt, config: cfg })
            : polishPromptViaProxy({ ...params, prompt, config: cfg }));
    } catch (error) {
        const message = getPromptPolishErrorMessage(error);
        if (connectionMode === 'direct' && isLikelyWebDirectAccessError(message)) {
            throw new Error(
                appendDesktopAppGuidance(`直连模式润色失败：目标地址可能不支持 CORS。原始错误: ${message}`)
            );
        }
        throw new Error(message);
    }
}
