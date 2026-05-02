import {
    decryptShareParams,
    encryptShareParams,
    getSharePasswordValidationMessage,
    SHARE_PASSWORD_MIN_LENGTH
} from './share-crypto';
import { describe, expect, it } from 'vitest';

const TEST_CRYPTO_OPTIONS = { iterations: 1_000 };
const PASSWORD = 'correct-horse-battery-staple';

describe('share crypto', () => {
    it('encrypts and decrypts share params without exposing plaintext in the payload', async () => {
        const payload = await encryptShareParams(
            {
                prompt: 'draw a locked vault',
                apiKey: 'sk-secret-123',
                baseUrl: 'https://api.example.com/v1',
                model: 'gpt-image-2',
                autostart: true
            },
            PASSWORD,
            TEST_CRYPTO_OPTIONS
        );

        expect(payload).not.toContain('draw');
        expect(payload).not.toContain('sk-secret-123');
        expect(payload).not.toContain('gpt-image-2');

        const decrypted = await decryptShareParams(payload, PASSWORD);
        expect(decrypted).toEqual({
            prompt: 'draw a locked vault',
            apiKey: 'sk-secret-123',
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-image-2',
            autostart: true
        });
    });

    it('uses random salt and IV so identical inputs produce different payloads', async () => {
        const first = await encryptShareParams({ prompt: 'same prompt' }, PASSWORD, TEST_CRYPTO_OPTIONS);
        const second = await encryptShareParams({ prompt: 'same prompt' }, PASSWORD, TEST_CRYPTO_OPTIONS);

        expect(first).not.toBe(second);
        await expect(decryptShareParams(first, PASSWORD)).resolves.toEqual({ prompt: 'same prompt' });
        await expect(decryptShareParams(second, PASSWORD)).resolves.toEqual({ prompt: 'same prompt' });
    });

    it('rejects wrong passwords and tampered payloads', async () => {
        const payload = await encryptShareParams({ prompt: 'safe' }, PASSWORD, TEST_CRYPTO_OPTIONS);
        const lastChar = payload.at(-1);
        const tampered = `${payload.slice(0, -1)}${lastChar === 'A' ? 'B' : 'A'}`;

        await expect(decryptShareParams(payload, 'wrong-password')).rejects.toThrow('密码错误');
        await expect(decryptShareParams(tampered, PASSWORD)).rejects.toThrow();
    });

    it('validates minimum password length', async () => {
        const shortPassword = '1234567';

        expect(getSharePasswordValidationMessage(shortPassword)).toBe(
            `密码至少需要 ${SHARE_PASSWORD_MIN_LENGTH} 个字符。`
        );
        await expect(encryptShareParams({ prompt: 'x' }, shortPassword, TEST_CRYPTO_OPTIONS)).rejects.toThrow(
            '密码至少需要'
        );
    });

    it('rejects common, repeated, and sequential weak passwords', () => {
        expect(getSharePasswordValidationMessage('password')).toBe('密码过于常见，请换一个更难猜的密码。');
        expect(getSharePasswordValidationMessage('aaaaaaaa')).toBe('密码过于常见，请换一个更难猜的密码。');
        expect(getSharePasswordValidationMessage('zzzzzzzz')).toBe('密码不能只由重复字符组成。');
        expect(getSharePasswordValidationMessage('23456789')).toBe('密码不能使用连续字母或数字序列。');
        expect(getSharePasswordValidationMessage(PASSWORD)).toBeNull();
    });
});
