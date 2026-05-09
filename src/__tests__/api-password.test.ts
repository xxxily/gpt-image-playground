import crypto from 'crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyAppPasswordHash } from '@/lib/api-password';

const originalAppPassword = process.env.APP_PASSWORD;

afterEach(() => {
    if (originalAppPassword === undefined) {
        delete process.env.APP_PASSWORD;
    } else {
        process.env.APP_PASSWORD = originalAppPassword;
    }
});

describe('verifyAppPasswordHash', () => {
    it('rejects server-side storage route use when APP_PASSWORD is not configured', () => {
        delete process.env.APP_PASSWORD;

        const result = verifyAppPasswordHash(null);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(403);
            expect(result.error).toContain('APP_PASSWORD');
        }
    });

    it('rejects missing or malformed hashes', () => {
        process.env.APP_PASSWORD = 'secret';

        expect(verifyAppPasswordHash(null).ok).toBe(false);
        expect(verifyAppPasswordHash('not-a-sha256').ok).toBe(false);
    });

    it('accepts the expected SHA-256 hash and rejects a different hash', () => {
        process.env.APP_PASSWORD = 'secret';
        const goodHash = crypto.createHash('sha256').update('secret').digest('hex');
        const badHash = crypto.createHash('sha256').update('wrong').digest('hex');

        expect(verifyAppPasswordHash(goodHash).ok).toBe(true);
        expect(verifyAppPasswordHash(badHash).ok).toBe(false);
    });
});
