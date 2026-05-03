type UnknownRecord = Record<string, unknown>;

const MAX_ERROR_MESSAGE_LENGTH = 1200;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function getStringField(record: UnknownRecord, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' ? normalizeTextMessage(value) : undefined;
}

function normalizeTextMessage(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const readableText = trimmed
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
        .replace(/<[^>]+>/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim();
    const message = readableText || trimmed;

    return message.length > MAX_ERROR_MESSAGE_LENGTH ? `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…` : message;
}

function extractArrayMessage(value: unknown): string | undefined {
    if (!Array.isArray(value)) return undefined;

    for (const item of value) {
        const message = extractMessage(item);
        if (message) return message;
    }

    return undefined;
}

function extractMessage(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return normalizeTextMessage(value);
    }

    if (value instanceof Error) {
        const nestedFromError = isRecord(value) && 'error' in value ? extractMessage(value.error) : undefined;
        const nestedFromCause = isRecord(value) && 'cause' in value ? extractMessage(value.cause) : undefined;
        return nestedFromError || nestedFromCause || normalizeTextMessage(value.message);
    }

    if (!isRecord(value)) {
        return undefined;
    }

    if ('error' in value) {
        const nestedMessage = extractMessage(value.error);
        if (nestedMessage) return nestedMessage;
    }

    const nestedData = extractMessage(value.data) || extractMessage(value.response) || extractMessage(value.body) || extractMessage(value.cause);
    if (nestedData) return nestedData;

    const arrayMessage = extractArrayMessage(value.errors);
    if (arrayMessage) return arrayMessage;

    return (
        getStringField(value, 'message') ||
        getStringField(value, 'error_description') ||
        getStringField(value, 'detail') ||
        getStringField(value, 'reason') ||
        getStringField(value, 'title')
    );
}

function extractMetadata(value: unknown): string[] {
    const target = isRecord(value) && 'error' in value && isRecord(value.error) ? value.error : value;
    if (!isRecord(target)) return [];

    const metadata: string[] = [];
    const code = getStringField(target, 'code');
    const type = getStringField(target, 'type');

    if (code) metadata.push(`code: ${code}`);
    if (type) metadata.push(`type: ${type}`);

    return metadata;
}

export function formatApiError(value: unknown, fallback = 'An unexpected error occurred.'): string {
    const message = extractMessage(value) || fallback;
    const metadata = extractMetadata(value);

    if (metadata.length === 0 || metadata.every((item) => message.includes(item))) {
        return message;
    }

    return `${message} (${metadata.join(', ')})`;
}

export function hasApiErrorPayload(value: unknown): boolean {
    return isRecord(value) && 'error' in value && Boolean(extractMessage(value.error));
}

function extractStatus(value: unknown): number | undefined {
    if (!isRecord(value)) return undefined;

    const status = value.status;
    if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
        return status;
    }

    const statusCode = value.statusCode;
    if (typeof statusCode === 'number' && Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599) {
        return statusCode;
    }

    if ('error' in value) {
        return extractStatus(value.error);
    }

    return undefined;
}

export function getApiErrorStatus(value: unknown, fallback = 500): number {
    return extractStatus(value) ?? fallback;
}

function looksLikeJson(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
}

export async function readApiResponseBody(response: Response): Promise<unknown> {
    let text: string;
    try {
        text = await response.text();
    } catch {
        return {};
    }

    const trimmed = text.trim();
    if (!trimmed) return {};

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    if (contentType.includes('application/json') || looksLikeJson(trimmed)) {
        try {
            return JSON.parse(trimmed) as unknown;
        } catch {
            return trimmed;
        }
    }

    return trimmed;
}

export async function getApiResponseErrorMessage(response: Response, fallback: string): Promise<string> {
    const body = await readApiResponseBody(response);
    return formatApiError(body, response.statusText || fallback);
}
