type UnknownRecord = Record<string, unknown>;

export type ServerLogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_ORDER: Record<ServerLogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const SENSITIVE_KEY_PATTERN =
    /(api[_-]?key|authorization|bearer|cookie|password|passphrase|secret|token|access[_-]?key|accesskey|session)/i;
const PROMPT_KEY_PATTERN = /(^|[_-])(prompt|negativeprompt|systemprompt|userprompt)([_-]|$)/i;
const URL_TARGET_KEY_PATTERN = /(share[_-]?url|target[_-]?url|short[_-]?link|callback[_-]?url)/i;
const SENSITIVE_QUERY_PATTERN =
    /([?&](?:apiKey|apikey|api_key|key|token|secret|password|passphrase|prompt|target|syncConfig|auth|authorization)=)[^&#\s]+/giu;
const AUTHORIZATION_VALUE_PATTERN = /(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;]+/giu;
const BEARER_VALUE_PATTERN = /\b(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/giu;
const OPENAI_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}\b/gu;
const ABSOLUTE_PATH_PATTERN =
    /(?:\/Users|\/Volumes|\/private|\/var|\/tmp|\/home|\/mnt|\/opt|[A-Za-z]:\\)[^\s'",;)}\]]+/gu;

const REDACTED_SECRET = '[redacted-secret]';
const REDACTED_PROMPT = '[redacted-prompt]';
const REDACTED_PATH = '[redacted-path]';
const REDACTED_URL = '[redacted-url]';

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function normalizeLogLevel(value: string | undefined): ServerLogLevel | null {
    if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') return value;
    return null;
}

function isEnabledEnvFlag(value: string | undefined): boolean {
    return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}

export function getServerLogLevel(): ServerLogLevel {
    const configuredLevel = normalizeLogLevel(process.env.SERVER_LOG_LEVEL);
    if (configuredLevel) return configuredLevel;

    if (isEnabledEnvFlag(process.env.SERVER_DEBUG_LOGS) || isEnabledEnvFlag(process.env.DESKTOP_DEBUG_MODE)) {
        return 'debug';
    }

    return process.env.NODE_ENV === 'production' ? 'warn' : 'info';
}

function shouldLog(level: ServerLogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[getServerLogLevel()];
}

export function redactLogString(value: string): string {
    return value
        .replace(SENSITIVE_QUERY_PATTERN, `$1${REDACTED_SECRET}`)
        .replace(AUTHORIZATION_VALUE_PATTERN, `$1${REDACTED_SECRET}`)
        .replace(BEARER_VALUE_PATTERN, `$1${REDACTED_SECRET}`)
        .replace(OPENAI_KEY_PATTERN, REDACTED_SECRET)
        .replace(ABSOLUTE_PATH_PATTERN, REDACTED_PATH);
}

export function redactLogValue(value: unknown, key = ''): unknown {
    if (PROMPT_KEY_PATTERN.test(key)) return REDACTED_PROMPT;
    if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED_SECRET;
    if (URL_TARGET_KEY_PATTERN.test(key) && typeof value === 'string') return redactLogString(value).replace(/^.+$/u, REDACTED_URL);

    if (typeof value === 'string') return redactLogString(value);
    if (typeof value !== 'object' || value === null) return value;

    if (value instanceof Error) {
        const errorRecord = value as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
        return {
            name: value.name,
            message: redactLogString(value.message),
            code: typeof errorRecord.code === 'string' || typeof errorRecord.code === 'number' ? errorRecord.code : undefined,
            status: typeof errorRecord.status === 'number' ? errorRecord.status : errorRecord.statusCode
        };
    }

    if (Array.isArray(value)) {
        return value.map((item) => redactLogValue(item));
    }

    if (!isRecord(value)) return value;

    const redacted: UnknownRecord = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
        redacted[entryKey] = redactLogValue(entryValue, entryKey);
    }
    return redacted;
}

export function createServerLogger(scope: string) {
    const emit = (level: ServerLogLevel, event: string, details?: UnknownRecord) => {
        if (!shouldLog(level)) return;

        const payload = {
            level,
            scope,
            event: redactLogString(event),
            ...(details ? { details: redactLogValue(details) } : {})
        };

        const method = level === 'debug' || level === 'info' ? 'log' : level;
        console[method](payload);
    };

    return {
        debug: (event: string, details?: UnknownRecord) => emit('debug', event, details),
        info: (event: string, details?: UnknownRecord) => emit('info', event, details),
        warn: (event: string, details?: UnknownRecord) => emit('warn', event, details),
        error: (event: string, details?: UnknownRecord) => emit('error', event, details)
    };
}
