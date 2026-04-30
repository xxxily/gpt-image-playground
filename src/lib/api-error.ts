type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function getStringField(record: UnknownRecord, key: string): string | undefined {
    const value = record[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function extractMessage(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value.trim().length > 0 ? value : undefined;
    }

    if (value instanceof Error) {
        const nestedFromError = isRecord(value) && 'error' in value ? extractMessage(value.error) : undefined;
        return nestedFromError || value.message;
    }

    if (!isRecord(value)) {
        return undefined;
    }

    if ('error' in value) {
        const nestedMessage = extractMessage(value.error);
        if (nestedMessage) return nestedMessage;
    }

    return getStringField(value, 'message') || getStringField(value, 'error_description') || getStringField(value, 'detail');
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
