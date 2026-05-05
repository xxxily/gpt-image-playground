export type ProviderJsonPrimitive = string | number | boolean | null;
export type ProviderJsonValue = ProviderJsonPrimitive | ProviderJsonValue[] | { [key: string]: ProviderJsonValue };
export type ProviderOptions = { [key: string]: ProviderJsonValue };

export type ProviderOptionsParseResult =
    | { valid: true; value: ProviderOptions }
    | { valid: false; error: string };

export function isProviderJsonValue(value: unknown): value is ProviderJsonValue {
    if (value === null) return true;

    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') return true;

    if (Array.isArray(value)) {
        return value.every(isProviderJsonValue);
    }

    if (valueType === 'object') {
        return Object.values(value as Record<string, unknown>).every(isProviderJsonValue);
    }

    return false;
}

export function isProviderOptions(value: unknown): value is ProviderOptions {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && isProviderJsonValue(value);
}

export function parseProviderOptionsJson(value: string | undefined): ProviderOptionsParseResult {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return { valid: true, value: {} };

    try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!isProviderOptions(parsed)) {
            return { valid: false, error: '自定义参数必须是 JSON 对象，且只能包含 JSON 可序列化的值。' };
        }
        return { valid: true, value: parsed };
    } catch (error) {
        return { valid: false, error: error instanceof Error ? error.message : 'JSON 解析失败。' };
    }
}

export function mergeProviderOptions(...sources: Array<ProviderOptions | undefined>): ProviderOptions {
    return sources.reduce<ProviderOptions>((merged, source) => ({ ...merged, ...(source ?? {}) }), {});
}

export function mergeRequestParams(...sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    sources.forEach((source) => {
        if (!source) return;
        Object.entries(source).forEach(([key, value]) => {
            if (value !== undefined) merged[key] = value;
        });
    });
    return merged;
}
