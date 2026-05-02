import type { ParsedUrlParams } from '@/lib/url-params';

function hasNonEmptyValue(value: string | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export function shouldPromptForConfigPersistence(parsed: ParsedUrlParams): parsed is ParsedUrlParams & {
    apiKey: string;
    baseUrl: string;
    model: string;
} {
    return hasNonEmptyValue(parsed.apiKey) && hasNonEmptyValue(parsed.baseUrl) && hasNonEmptyValue(parsed.model);
}

export function buildPromptOnlyUrlParams(parsed: ParsedUrlParams): ParsedUrlParams {
    return parsed.prompt === undefined ? {} : { prompt: parsed.prompt };
}

export function maskSharedSecret(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '未提供';
    if (trimmed.length <= 8) return '已提供';
    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
