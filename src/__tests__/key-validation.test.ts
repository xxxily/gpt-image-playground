import { describe, it, expect } from 'vitest';
import { validateObjectKey, validatePrefix, buildBasePrefix } from '@/lib/sync/key-validation';

describe('validateObjectKey', () => {
    const basePrefix = 'gpt-image-playground/v1/user-123';

    it('rejects empty key', () => {
        const r = validateObjectKey('', basePrefix);
        expect(r.valid).toBe(false);
        expect(r.reason).toContain('empty');
    });

    it('rejects leading slash', () => {
        const r = validateObjectKey('/etc/passwd', basePrefix);
        expect(r.valid).toBe(false);
        expect(r.reason).toContain('/');
    });

    it('rejects leading backslash', () => {
        const r = validateObjectKey('\\windows\\system32', basePrefix);
        expect(r.valid).toBe(false);
        expect(r.reason).toMatch(/[/\\]/);
    });

    it('rejects null byte', () => {
        const r = validateObjectKey(`${basePrefix}/file\0.txt`, basePrefix);
        expect(r.valid).toBe(false);
        expect(r.reason).toContain('null');
    });

    it('rejects path traversal', () => {
        const r = validateObjectKey(`${basePrefix}/../evil`, basePrefix);
        expect(r.valid).toBe(false);
        expect(r.reason).toContain('traversal');
    });

    it('rejects backslash in key', () => {
        const r = validateObjectKey(`${basePrefix}/path\\to/file.png`, basePrefix);
        expect(r.valid).toBe(false);
        expect(r.reason).toContain('backslash');
    });

    it('rejects key outside prefix', () => {
        const r = validateObjectKey('other-prefix/file.png', basePrefix);
        expect(r.valid).toBe(false);
        expect(r.reason).toContain('prefix');
    });

    it('accepts valid key under prefix', () => {
        const r = validateObjectKey(`${basePrefix}/manifest.json`, basePrefix);
        expect(r.valid).toBe(true);
    });

    it('accepts valid nested key under prefix', () => {
        const r = validateObjectKey(`${basePrefix}/images/photo-001.png`, basePrefix);
        expect(r.valid).toBe(true);
    });

    it('rejects double slash after prefix', () => {
        const r = validateObjectKey(`${basePrefix}//double-slash`, basePrefix);
        expect(r.valid).toBe(false);
    });
});

describe('validatePrefix', () => {
    it('rejects empty prefix', () => {
        expect(validatePrefix('').valid).toBe(false);
    });

    it('rejects leading slash', () => {
        expect(validatePrefix('/etc').valid).toBe(false);
    });

    it('rejects null byte', () => {
        expect(validatePrefix('foo\0/bar').valid).toBe(false);
    });

    it('rejects path traversal', () => {
        expect(validatePrefix('foo/../bar').valid).toBe(false);
    });

    it('rejects backslash', () => {
        expect(validatePrefix('foo\\bar').valid).toBe(false);
    });

    it('accepts valid prefix', () => {
        expect(validatePrefix('gpt-image-playground/v1/user-123').valid).toBe(true);
    });
});

describe('buildBasePrefix', () => {
    it('sanitizes profileId with special characters', () => {
        const prefix = buildBasePrefix('user@domain.com!');
        expect(prefix).toBe('gpt-image-playground/v1/user-domain-com');
    });

    it('preserves safe characters', () => {
        const prefix = buildBasePrefix('my-user_123');
        expect(prefix).toBe('gpt-image-playground/v1/my-user_123');
    });

    it('handles empty profileId', () => {
        const prefix = buildBasePrefix('');
        expect(prefix).toBe('gpt-image-playground/v1/default');
    });

    it('supports custom root prefixes', () => {
        const prefix = buildBasePrefix('team-a', 'custom/root/');
        expect(prefix).toBe('custom/root/team-a');
    });
});
