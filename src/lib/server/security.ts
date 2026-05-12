import crypto from 'node:crypto';

type RateLimitEntry = {
    count: number;
    resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

export function hashSha256Hex(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) return false;
    return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function randomToken(bytes = 24): string {
    return crypto.randomBytes(bytes).toString('base64url');
}

export function sanitizePlainText(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

export function isValidAdminPassword(password: string): boolean {
    return password.trim().length >= 12;
}

export function checkInMemoryRateLimit(key: string, limit: number, windowMs: number): {
    ok: boolean;
    retryAfterMs?: number;
} {
    const now = Date.now();
    const current = rateLimitStore.get(key);
    if (!current || current.resetAt <= now) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true };
    }

    if (current.count >= limit) {
        return { ok: false, retryAfterMs: current.resetAt - now };
    }

    current.count += 1;
    return { ok: true };
}

export function deleteRateLimitBucket(key: string): void {
    rateLimitStore.delete(key);
}

