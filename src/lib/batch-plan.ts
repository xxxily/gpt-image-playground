'use client';

import { formatApiError, readApiResponseBody } from '@/lib/api-error';
import { loadConfig, type AppConfig } from '@/lib/config';
import { getBatchPlanningSystemPrompt, planningModeToBatchStrategyId } from '@/lib/batch-config';
import { getClientDirectLinkRestriction } from '@/lib/connection-policy';
import { appendDesktopAppGuidance, isLikelyWebDirectAccessError } from '@/lib/desktop-guidance';
import { desktopProxyConfigFromAppConfig } from '@/lib/desktop-config';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import { resolvePromptPolishCatalogSelection } from '@/lib/provider-model-catalog';
import {
    buildAnthropicMessagesBody,
    buildAnthropicMessagesUrl,
    buildChatCompletionsUrl,
    buildPromptPolishThinkingParams,
    extractAnthropicMessageText,
    extractPromptPolishText,
    isAnthropicProviderProtocol
} from '@/lib/prompt-polish-core';
import {
    buildBatchPlanPrompt,
    DEFAULT_BATCH_PLAN_MAX_COUNT,
    DEFAULT_BATCH_PLAN_MAX_TOKENS,
    parseBatchPlanText,
    type BatchCountMode,
    type BatchPlan,
    type BatchPlanningMode,
    type BuildBatchPlanPromptParams
} from '@/lib/batch-plan-core';

export type PlanBatchParams = {
    sourceText: string;
    sourceImageCount: number;
    planningMode: BatchPlanningMode;
    countMode: BatchCountMode;
    targetCount?: number;
    maxCount?: number;
    adjustmentInstruction?: string;
    previousPlan?: BatchPlan | null;
    config?: AppConfig;
    clientDirectLinkPriority?: boolean;
    passwordHash?: string | null;
    signal?: AbortSignal;
};

export type PlanBatchResult = {
    plan: BatchPlan;
    rawText: string;
};

const DEFAULT_BATCH_PLAN_ERROR_MESSAGE = '批量规划失败，请稍后重试。';
const MISSING_BATCH_PLAN_MODEL_MESSAGE =
    '批量规划需要先在供应商端点管理中添加 OpenAI 兼容或 Anthropic 兼容端点，并为端点添加可用模型。';

function buildFallback(params: PlanBatchParams): BuildBatchPlanPromptParams {
    return {
        sourceText: params.sourceText,
        sourceImageCount: params.sourceImageCount,
        planningMode: params.planningMode,
        countMode: params.countMode,
        targetCount: params.targetCount,
        maxCount: params.maxCount ?? DEFAULT_BATCH_PLAN_MAX_COUNT,
        adjustmentInstruction: params.adjustmentInstruction,
        previousPlan: params.previousPlan
    };
}

function getBatchPlanErrorMessage(error: unknown): string {
    const message = formatApiError(error, DEFAULT_BATCH_PLAN_ERROR_MESSAGE).trim();
    return message || DEFAULT_BATCH_PLAN_ERROR_MESSAGE;
}

function buildHttpErrorFallback(prefix: string, response: Response): string {
    return `${prefix}：${response.statusText || `HTTP ${response.status}`}`;
}

function buildRequestPrompt(params: PlanBatchParams): string {
    return buildBatchPlanPrompt(buildFallback(params));
}

function resolveBatchPlanSystemPrompt(config: AppConfig, planningMode: BatchPlanningMode): string {
    return getBatchPlanningSystemPrompt(config.batchFeature, planningModeToBatchStrategyId(planningMode));
}

function ensureBatchPlanSelection(selection: ReturnType<typeof resolvePromptPolishCatalogSelection>): void {
    if (!selection.endpoint || !selection.modelId || !selection.apiKey) {
        throw new Error(MISSING_BATCH_PLAN_MODEL_MESSAGE);
    }
}

async function planBatchViaDesktop(params: PlanBatchParams): Promise<PlanBatchResult> {
    const cfg = params.config ?? loadConfig();
    const selection = resolvePromptPolishCatalogSelection(cfg, 'prompt.batchPlan');
    ensureBatchPlanSelection(selection);
    const proxyConfig = desktopProxyConfigFromAppConfig(cfg);
    const prompt = buildRequestPrompt(params);
    const systemPrompt = resolveBatchPlanSystemPrompt(cfg, params.planningMode);

    if (cfg.desktopDebugMode) {
        console.info('[Desktop proxy debug] batch plan request', {
            model: selection.modelId,
            providerEndpointId: selection.endpoint?.id,
            protocol: selection.endpoint?.protocol,
            proxyMode: proxyConfig.mode,
            hasApiBaseUrl: Boolean(selection.apiBaseUrl),
            sourceImageCount: params.sourceImageCount
        });
    }

    const result = await invokeDesktopCommand<{ planText: string }>('proxy_batch_plan', {
        request: {
            prompt,
            apiKey: selection.apiKey || undefined,
            apiBaseUrl: selection.apiBaseUrl || undefined,
            modelId: selection.modelId || undefined,
            protocol: selection.endpoint?.protocol,
            systemPrompt,
            thinkingEnabled: selection.thinkingEnabled,
            thinkingEffort: selection.thinkingEffort,
            thinkingEffortFormat: selection.thinkingEffortFormat,
            proxyConfig,
            debugMode: cfg.desktopDebugMode
        }
    });

    if (!result.planText?.trim()) {
        throw new Error('批量规划失败：模型未返回有效内容。');
    }

    return {
        plan: parseBatchPlanText(result.planText, buildFallback(params)),
        rawText: result.planText
    };
}

async function planBatchViaProxy(params: PlanBatchParams): Promise<PlanBatchResult> {
    const cfg = params.config ?? loadConfig();
    const selection = resolvePromptPolishCatalogSelection(cfg, 'prompt.batchPlan');
    ensureBatchPlanSelection(selection);
    const systemPrompt = resolveBatchPlanSystemPrompt(cfg, params.planningMode);
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (params.passwordHash) headers['x-app-password'] = params.passwordHash;

    const response = await fetch('/api/batch-plan', {
        method: 'POST',
        headers,
        signal: params.signal,
        body: JSON.stringify({
            prompt: buildRequestPrompt(params),
            passwordHash: params.passwordHash || undefined,
            apiKey: selection.apiKey || undefined,
            apiBaseUrl: selection.apiBaseUrl || undefined,
            modelId: selection.modelId || undefined,
            protocol: selection.endpoint?.protocol,
            systemPrompt,
            thinkingEnabled: selection.thinkingEnabled,
            thinkingEffort: selection.thinkingEffort,
            thinkingEffortFormat: selection.thinkingEffortFormat
        })
    });

    const data = await readApiResponseBody(response);
    if (!response.ok) {
        throw new Error(formatApiError(data, buildHttpErrorFallback('批量规划失败', response)));
    }

    const planText = typeof data === 'object' && data && 'planText' in data ? String(data.planText || '') : '';
    if (!planText.trim()) {
        throw new Error('批量规划失败：模型未返回有效内容。');
    }

    return {
        plan: parseBatchPlanText(planText, buildFallback(params)),
        rawText: planText
    };
}

async function planBatchDirect(params: PlanBatchParams): Promise<PlanBatchResult> {
    const cfg = params.config ?? loadConfig();
    const selection = resolvePromptPolishCatalogSelection(cfg, 'prompt.batchPlan');
    ensureBatchPlanSelection(selection);
    const apiKey = selection.apiKey;
    const baseUrl = selection.apiBaseUrl;
    const modelId = selection.modelId;
    const systemPrompt = resolveBatchPlanSystemPrompt(cfg, params.planningMode);
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
                    prompt: buildRequestPrompt(params),
                    systemPrompt,
                    model: modelId,
                    temperature: 0.4,
                    maxTokens: DEFAULT_BATCH_PLAN_MAX_TOKENS,
                    thinkingEnabled: selection.thinkingEnabled,
                    thinkingEffort: selection.thinkingEffort
                })
            )
        });

        const data = await readApiResponseBody(response);
        if (!response.ok) {
            throw new Error(formatApiError(data, buildHttpErrorFallback('直连模式批量规划失败', response)));
        }

        const planText = extractAnthropicMessageText(data);
        if (!planText) {
            throw new Error('批量规划失败：模型未返回有效内容。');
        }

        return {
            plan: parseBatchPlanText(planText, buildFallback(params)),
            rawText: planText
        };
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
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: buildRequestPrompt(params) }
            ],
            temperature: 0.4,
            max_tokens: DEFAULT_BATCH_PLAN_MAX_TOKENS,
            ...thinkingParams
        })
    });

    const data = await readApiResponseBody(response);
    if (!response.ok) {
        throw new Error(formatApiError(data, buildHttpErrorFallback('直连模式批量规划失败', response)));
    }

    const planText = extractPromptPolishText(data);
    if (!planText) {
        throw new Error('批量规划失败：模型未返回有效内容。');
    }

    return {
        plan: parseBatchPlanText(planText, buildFallback(params)),
        rawText: planText
    };
}

export async function planBatchPrompts(params: PlanBatchParams): Promise<PlanBatchResult> {
    const sourceText = params.sourceText.trim();
    if (!sourceText) {
        throw new Error('请先输入文案、文章或创作需求，再进行批量规划。');
    }

    const cfg = params.config ?? loadConfig();

    if (isTauriDesktop()) {
        try {
            return await planBatchViaDesktop({ ...params, sourceText, config: cfg });
        } catch (error) {
            throw new Error(getBatchPlanErrorMessage(error));
        }
    }

    const selection = resolvePromptPolishCatalogSelection(cfg, 'prompt.batchPlan');
    ensureBatchPlanSelection(selection);
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
            ? planBatchDirect({ ...params, sourceText, config: cfg })
            : planBatchViaProxy({ ...params, sourceText, config: cfg }));
    } catch (error) {
        const message = getBatchPlanErrorMessage(error);
        if (connectionMode === 'direct' && isLikelyWebDirectAccessError(message)) {
            throw new Error(appendDesktopAppGuidance(`直连模式批量规划失败：目标地址可能不支持 CORS。原始错误: ${message}`));
        }
        throw new Error(message);
    }
}
