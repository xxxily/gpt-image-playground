import {
    decryptShareParams,
    encryptShareParams,
    generateRandomSharePassword,
    getSharePasswordRequiredMessage,
    getSharePasswordValidationMessage,
    getSharePasswordWarningMessage,
    SHARE_PASSWORD_MIN_LENGTH
} from './share-crypto';
import { DEFAULT_SYNC_CONFIG, normalizeSyncConfig } from '@/lib/sync/provider-config';
import { describe, expect, it } from 'vitest';

const TEST_CRYPTO_OPTIONS = { iterations: 1_000 };
const PASSWORD = 'correct-horse-battery-staple';
const syncConfigFixture = normalizeSyncConfig({
    type: 's3',
    s3: {
        ...DEFAULT_SYNC_CONFIG.s3,
        endpoint: 'https://s3.example.com',
        bucket: 'images',
        accessKeyId: 'ak-share',
        secretAccessKey: 'sk-share'
    }
});

describe('share crypto', () => {
    it('encrypts and decrypts share params without exposing plaintext in the payload', async () => {
        const payload = await encryptShareParams(
            {
                prompt: 'draw a locked vault',
                apiKey: 'sk-secret-123',
                apiKeyTempOnly: true,
                baseUrl: 'https://api.example.com/v1',
                model: 'gpt-image-2',
                providerInstanceId: 'openai:relay',
                autostart: true,
                syncConfig: {
                    config: syncConfigFixture,
                    restoreOptions: {
                        autoRestore: false,
                        restoreMetadata: true,
                        imageRestoreScope: 'recent',
                        recentMs: 86400000
                    }
                }
            },
            PASSWORD,
            TEST_CRYPTO_OPTIONS
        );

        expect(payload).not.toContain('draw');
        expect(payload).not.toContain('sk-secret-123');
        expect(payload).not.toContain('sk-share');
        expect(payload).not.toContain('gpt-image-2');

        const decrypted = await decryptShareParams(payload, PASSWORD);
        expect(decrypted.apiKey).not.toBe(PASSWORD);
        expect(decrypted).toMatchObject({
            prompt: 'draw a locked vault',
            apiKey: 'sk-secret-123',
            apiKeyTempOnly: true,
            baseUrl: 'https://api.example.com/v1',
            model: 'gpt-image-2',
            providerInstanceId: 'openai:relay',
            autostart: true,
            syncConfig: {
                config: {
                    type: 's3',
                    s3: syncConfigFixture.s3
                },
                restoreOptions: {
                    autoRestore: false,
                    restoreMetadata: true,
                    imageRestoreScope: 'recent',
                    recentMs: 86400000
                }
            }
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

    it('requires a non-empty password before encrypting', async () => {
        const blankPassword = '   ';

        expect(getSharePasswordRequiredMessage(blankPassword)).toBe('请输入用于加密分享的密码。');
        await expect(encryptShareParams({ prompt: 'x' }, blankPassword, TEST_CRYPTO_OPTIONS)).rejects.toThrow(
            '请输入用于加密分享的密码。'
        );
    });

    it('warns about short passwords without blocking encryption or decryption', async () => {
        const shortPassword = '1234567';

        expect(getSharePasswordWarningMessage(shortPassword)).toBe(
            `密码至少需要 ${SHARE_PASSWORD_MIN_LENGTH} 个字符。`
        );
        expect(getSharePasswordRequiredMessage(shortPassword)).toBeNull();

        const payload = await encryptShareParams({ prompt: 'x' }, shortPassword, TEST_CRYPTO_OPTIONS);
        await expect(decryptShareParams(payload, shortPassword)).resolves.toEqual({ prompt: 'x' });
    });

    it('warns about common, repeated, and sequential weak passwords', () => {
        expect(getSharePasswordWarningMessage('password')).toBe('密码过于常见，请换一个更难猜的密码。');
        expect(getSharePasswordWarningMessage('aaaaaaaa')).toBe('密码过于常见，请换一个更难猜的密码。');
        expect(getSharePasswordWarningMessage('zzzzzzzz')).toBe('密码不能只由重复字符组成。');
        expect(getSharePasswordWarningMessage('23456789')).toBe('密码不能使用连续字母或数字序列。');
        expect(getSharePasswordValidationMessage(PASSWORD)).toBeNull();
    });

    it('generates an 8-character random share password by default', () => {
        const password = generateRandomSharePassword();

        expect(password).toHaveLength(SHARE_PASSWORD_MIN_LENGTH);
        expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
        expect(getSharePasswordRequiredMessage(password)).toBeNull();
    });

    it('uses generated passwords for encrypted share links', async () => {
        const password = generateRandomSharePassword();
        const payload = await encryptShareParams({ prompt: 'random password share' }, password, TEST_CRYPTO_OPTIONS);

        await expect(decryptShareParams(payload, password)).resolves.toEqual({ prompt: 'random password share' });
    });

    it('rejects invalid random password lengths', () => {
        expect(() => generateRandomSharePassword(0)).toThrow('随机密码长度配置无效。');
        expect(() => generateRandomSharePassword(1.5)).toThrow('随机密码长度配置无效。');
    });
});
