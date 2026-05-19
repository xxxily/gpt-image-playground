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
        const message = error instanceof Error ? error.message : 'JSON 解析失败。';
        const location = extractJsonErrorLocation(message, trimmed);
        const annotated = location ? `JSON 解析失败（第 ${location.line} 行，第 ${location.column} 列）：${message}` : message;
        return { valid: false, error: annotated };
    }
}

function extractJsonErrorLocation(message: string, source: string): { line: number; column: number } | null {
    const positionMatch = message.match(/position\s+(\d+)/i);
    if (positionMatch) {
        const position = Number(positionMatch[1]);
        if (Number.isFinite(position) && position >= 0) {
            return positionToLineColumn(source, Math.min(position, source.length));
        }
    }
    const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineColMatch) {
        return {
            line: Math.max(1, Number(lineColMatch[1])),
            column: Math.max(1, Number(lineColMatch[2]))
        };
    }
    return null;
}

function positionToLineColumn(source: string, position: number): { line: number; column: number } {
    let line = 1;
    let column = 1;
    for (let i = 0; i < position && i < source.length; i++) {
        if (source.charCodeAt(i) === 10) {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }
    return { line, column };
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
