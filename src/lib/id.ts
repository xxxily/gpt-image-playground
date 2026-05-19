// Shared ID generation utilities. SSR-safe with crypto.randomUUID fallback.

function uuid(): string {
    if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Generate a unique ID with an optional prefix, e.g. generateId('task') → "task_<uuid>".
export function generateId(prefix?: string): string {
    const id = uuid();
    return prefix ? `${prefix}_${id}` : id;
}

// Generate a short unique ID (8-char), e.g. generateShortId() → "a1b2c3d4".
export function generateShortId(): string {
    return uuid().slice(0, 8);
}

// Generate a short ID with prefix and separator, e.g. generateShortIdPrefixed('snap') → "snap-a1b2c3d4".
export function generateShortIdPrefixed(prefix: string, separator: string = '-'): string {
    return `${prefix}${separator}${generateShortId()}`;
}
