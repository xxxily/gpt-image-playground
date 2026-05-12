import { parseUrlParams, type ParsedUrlParams, type ShareUrlParams } from './url-params';
import { encodeSyncConfigForShare } from '@/lib/sync/provider-config';

const SHARE_CRYPTO_VERSION = 1;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const HEADER_BYTES = 1 + 4 + SALT_BYTES + IV_BYTES;
const MIN_CIPHERTEXT_BYTES = 16;
const DEFAULT_PBKDF2_ITERATIONS = 600_000;
const MIN_PBKDF2_ITERATIONS = 1_000;
const RANDOM_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export const SHARE_PASSWORD_MIN_LENGTH = 8;

const COMMON_WEAK_PASSWORDS = new Set([
    'password',
    'password1',
    '12345678',
    '123456789',
    'qwertyui',
    'qwerty123',
    'abcdefgh',
    'aaaaaaaa',
    '11111111',
    '00000000'
]);

const SHARE_CRYPTO_AAD = new TextEncoder().encode(`gpt-image-playground-share-v${SHARE_CRYPTO_VERSION}`);

type ShareCryptoOptions = {
    iterations?: number;
};

function getCryptoApi(): Crypto {
    if (!globalThis.crypto?.subtle || typeof globalThis.crypto.getRandomValues !== 'function') {
        throw new Error('当前环境不支持安全加密分享。');
    }

    return globalThis.crypto;
}

function getIterations(options?: ShareCryptoOptions): number {
    const iterations = options?.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
    if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS) {
        throw new Error('加密迭代次数配置无效。');
    }
    return iterations;
}

export function getSharePasswordRequiredMessage(password: string): string | null {
    const trimmed = password.trim();
    if (trimmed.length === 0) {
        return '请输入用于加密分享的密码。';
    }

    return null;
}

export function getSharePasswordWarningMessage(password: string): string | null {
    const trimmed = password.trim();
    if (trimmed.length === 0) return null;

    if (trimmed.length < SHARE_PASSWORD_MIN_LENGTH) {
        return `密码至少需要 ${SHARE_PASSWORD_MIN_LENGTH} 个字符。`;
    }

    const normalized = trimmed.toLowerCase();
    if (COMMON_WEAK_PASSWORDS.has(normalized)) {
        return '密码过于常见，请换一个更难猜的密码。';
    }

    if (/^(.)\1+$/.test(trimmed)) {
        return '密码不能只由重复字符组成。';
    }

    if ('abcdefghijklmnopqrstuvwxyz'.includes(normalized) || '0123456789'.includes(normalized)) {
        return '密码不能使用连续字母或数字序列。';
    }

    return null;
}

export function getSharePasswordValidationMessage(password: string): string | null {
    return getSharePasswordRequiredMessage(password) || getSharePasswordWarningMessage(password);
}

export function generateRandomSharePassword(length = SHARE_PASSWORD_MIN_LENGTH): string {
    if (!Number.isInteger(length) || length <= 0) {
        throw new Error('随机密码长度配置无效。');
    }

    const cryptoApi = getCryptoApi();
    const maxFairByte = Math.floor(256 / RANDOM_PASSWORD_ALPHABET.length) * RANDOM_PASSWORD_ALPHABET.length;
    let password = '';

    while (password.length < length) {
        const bytes = cryptoApi.getRandomValues(new Uint8Array(length));
        for (const byte of bytes) {
            if (byte >= maxFairByte) continue;
            password += RANDOM_PASSWORD_ALPHABET[byte % RANDOM_PASSWORD_ALPHABET.length];
            if (password.length === length) break;
        }
    }

    return password;
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    if (typeof globalThis.btoa !== 'function') throw new Error('当前环境不支持安全加密分享。');

    const base64 = globalThis.btoa(binary);

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
    const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

    let binary: string;
    try {
        if (typeof globalThis.atob !== 'function') throw new Error('当前环境不支持安全加密分享。');
        binary = globalThis.atob(padded);
    } catch {
        throw new Error('加密分享链接格式无效。');
    }

    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveShareKey(
    cryptoApi: Crypto,
    password: string,
    salt: Uint8Array,
    iterations: number,
    usages: KeyUsage[]
): Promise<CryptoKey> {
    const keyMaterial = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
        'deriveKey'
    ]);

    return cryptoApi.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        usages
    );
}

function packEncryptedPayload(iterations: number, salt: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): string {
    const packed = new Uint8Array(HEADER_BYTES + ciphertext.length);
    const view = new DataView(packed.buffer);
    view.setUint8(0, SHARE_CRYPTO_VERSION);
    view.setUint32(1, iterations, false);
    packed.set(salt, 5);
    packed.set(iv, 5 + SALT_BYTES);
    packed.set(ciphertext, HEADER_BYTES);
    return bytesToBase64Url(packed);
}

function unpackEncryptedPayload(payload: string): {
    iterations: number;
    salt: Uint8Array;
    iv: Uint8Array;
    ciphertext: Uint8Array;
} {
    const packed = base64UrlToBytes(payload);
    if (packed.length < HEADER_BYTES + MIN_CIPHERTEXT_BYTES) {
        throw new Error('加密分享链接格式无效。');
    }

    const view = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
    const version = view.getUint8(0);
    if (version !== SHARE_CRYPTO_VERSION) {
        throw new Error('暂不支持这个加密分享链接版本。');
    }

    const iterations = view.getUint32(1, false);
    if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS) {
        throw new Error('加密分享链接格式无效。');
    }

    return {
        iterations,
        salt: packed.slice(5, 5 + SALT_BYTES),
        iv: packed.slice(5 + SALT_BYTES, HEADER_BYTES),
        ciphertext: packed.slice(HEADER_BYTES)
    };
}

function shareParamsToSearchParams(shareParams: ShareUrlParams): URLSearchParams {
    const params = new URLSearchParams();
    if (typeof shareParams.prompt === 'string') params.set('prompt', shareParams.prompt);
    if (typeof shareParams.apiKey === 'string') params.set('apiKey', shareParams.apiKey);
    if (shareParams.apiKeyTempOnly === true) params.set('apiKeyTempOnly', 'true');
    if (typeof shareParams.baseUrl === 'string') params.set('baseUrl', shareParams.baseUrl);
    if (typeof shareParams.model === 'string') params.set('model', shareParams.model);
    if (typeof shareParams.providerInstanceId === 'string')
        params.set('providerInstance', shareParams.providerInstanceId);
    if (typeof shareParams.autostart === 'boolean') params.set('autostart', String(shareParams.autostart));
    if (shareParams.syncConfig) {
        params.set(
            'syncConfig',
            encodeSyncConfigForShare(shareParams.syncConfig.config, shareParams.syncConfig.restoreOptions)
        );
    }
    return params;
}

export async function encryptShareParams(
    shareParams: ShareUrlParams,
    password: string,
    options?: ShareCryptoOptions
): Promise<string> {
    const passwordError = getSharePasswordRequiredMessage(password);
    if (passwordError) throw new Error(passwordError);

    const cryptoApi = getCryptoApi();
    const iterations = getIterations(options);
    const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = cryptoApi.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveShareKey(cryptoApi, password, salt, iterations, ['encrypt']);
    const plaintext = new TextEncoder().encode(JSON.stringify(shareParams));
    const ciphertext = await cryptoApi.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: SHARE_CRYPTO_AAD },
        key,
        plaintext
    );

    return packEncryptedPayload(iterations, salt, iv, new Uint8Array(ciphertext));
}

export async function decryptShareParams(payload: string, password: string): Promise<ParsedUrlParams> {
    const passwordError = getSharePasswordRequiredMessage(password);
    if (passwordError) throw new Error(passwordError);

    const cryptoApi = getCryptoApi();
    const { iterations, salt, iv, ciphertext } = unpackEncryptedPayload(payload);
    const key = await deriveShareKey(cryptoApi, password, salt, iterations, ['decrypt']);

    let decrypted: ArrayBuffer;
    try {
        decrypted = await cryptoApi.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: SHARE_CRYPTO_AAD },
            key,
            ciphertext
        );
    } catch {
        throw new Error('密码错误，或分享链接已被修改。');
    }

    let decoded: unknown;
    try {
        decoded = JSON.parse(new TextDecoder().decode(decrypted));
    } catch {
        throw new Error('加密分享内容无法解析。');
    }

    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
        throw new Error('加密分享内容格式无效。');
    }

    const searchParams = shareParamsToSearchParams(decoded as ShareUrlParams);
    return parseUrlParams(searchParams).parsed;
}
