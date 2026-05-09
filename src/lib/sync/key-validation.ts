/**
 * Validates S3 object keys and prefixes against security constraints.
 * Pure functions, exportable for tests.
 */

export type KeyValidationResult = {
    valid: boolean;
    reason?: string;
};

const RE_TRAVERSAL = /\.\./;
const RE_NULL_BYTE = /\0/;
export const DEFAULT_SYNC_ROOT_PREFIX = 'gpt-image-playground/v1';

function trimSlashes(value: string): string {
    return value.trim().replace(/^\/+|\/+$/g, '');
}

export function validateObjectKey(key: string, basePrefix: string): KeyValidationResult {
    if (!key) return { valid: false, reason: 'Key is empty' };
    const prefixValidation = validatePrefix(basePrefix);
    if (!prefixValidation.valid) return { valid: false, reason: `Invalid base prefix: ${prefixValidation.reason}` };
    if (key.startsWith('/') || key.startsWith('\\')) {
        return { valid: false, reason: 'Key must not start with / or \\' };
    }
    if (RE_NULL_BYTE.test(key)) return { valid: false, reason: 'Key contains null byte' };
    if (RE_TRAVERSAL.test(key)) return { valid: false, reason: 'Key contains path traversal' };
    if (key.includes('\\')) return { valid: false, reason: 'Key contains backslash' };
    if (key.includes('//')) return { valid: false, reason: 'Key contains double slash' };

    const normalizedBase = trimSlashes(basePrefix);
    if (!key.startsWith(normalizedBase + '/') && key !== normalizedBase) {
        return { valid: false, reason: `Key must be under prefix ${basePrefix}` };
    }

    const suffix = key.slice(normalizedBase.length + 1);
    if (suffix.startsWith('/') || suffix.startsWith('\\')) {
        return { valid: false, reason: 'Key contains double slash after prefix' };
    }

    return { valid: true };
}

export function validatePrefix(prefix: string): KeyValidationResult {
    const normalizedPrefix = trimSlashes(prefix);
    if (!normalizedPrefix) return { valid: false, reason: 'Prefix is empty' };
    if (prefix.trim().startsWith('/') || prefix.trim().startsWith('\\')) {
        return { valid: false, reason: 'Prefix must not start with / or \\' };
    }
    if (RE_NULL_BYTE.test(normalizedPrefix)) return { valid: false, reason: 'Prefix contains null byte' };
    if (RE_TRAVERSAL.test(normalizedPrefix)) return { valid: false, reason: 'Prefix contains path traversal' };
    if (normalizedPrefix.includes('\\')) return { valid: false, reason: 'Prefix contains backslash' };
    if (normalizedPrefix.includes('//')) return { valid: false, reason: 'Prefix contains double slash' };

    return { valid: true };
}

export function sanitizeSyncProfileId(profileId: string): string {
    const sanitized = profileId.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    return sanitized || 'default';
}

export function normalizeSyncRootPrefix(prefix: string): string {
    const normalized = trimSlashes(prefix || DEFAULT_SYNC_ROOT_PREFIX);
    return validatePrefix(normalized).valid ? normalized : DEFAULT_SYNC_ROOT_PREFIX;
}

export function buildBasePrefix(profileId: string, rootPrefix: string = DEFAULT_SYNC_ROOT_PREFIX): string {
    return `${normalizeSyncRootPrefix(rootPrefix)}/${sanitizeSyncProfileId(profileId)}`;
}
