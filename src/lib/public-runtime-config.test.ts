import {
    EMPTY_PUBLIC_RUNTIME_CONFIG,
    normalizePublicActionButtonLabel,
    normalizePublicRuntimeConfig,
    normalizePublicRuntimeConfigUrl
} from '@/lib/public-runtime-config';
import { describe, expect, it } from 'vitest';

describe('public runtime config normalization', () => {
    it('normalizes a safe API key purchase CTA', () => {
        expect(
            normalizePublicRuntimeConfig({
                apiKeyPurchaseCta: {
                    label: '购买 API Key',
                    url: 'supplier.example.com/buy'
                },
                internalId: 'not-public'
            })
        ).toEqual({
            apiKeyPurchaseCta: {
                label: '购买 API Key',
                url: 'https://supplier.example.com/buy'
            }
        });
    });

    it('rejects invalid labels', () => {
        expect(normalizePublicActionButtonLabel('')).toBe('');
        expect(normalizePublicActionButtonLabel('A')).toBe('');
        expect(normalizePublicActionButtonLabel('购买\nAPI Key')).toBe('');
        expect(normalizePublicActionButtonLabel('<b>购买</b>')).toBe('');
        expect(normalizePublicActionButtonLabel('a'.repeat(33))).toBe('');
    });

    it('rejects dangerous or local URLs on the client side', () => {
        expect(normalizePublicRuntimeConfigUrl('javascript:alert(1)')).toBe('');
        expect(normalizePublicRuntimeConfigUrl('https://user:pass@supplier.example.com/buy')).toBe('');
        expect(normalizePublicRuntimeConfigUrl('http://localhost:3000/buy')).toBe('');
        expect(normalizePublicRuntimeConfigUrl('http://127.0.0.1/buy')).toBe('');
        expect(normalizePublicRuntimeConfigUrl('http://192.168.1.10/buy')).toBe('');
    });

    it('falls back to an empty config for malformed payloads', () => {
        expect(normalizePublicRuntimeConfig(null)).toEqual(EMPTY_PUBLIC_RUNTIME_CONFIG);
        expect(
            normalizePublicRuntimeConfig({ apiKeyPurchaseCta: { label: '<script>', url: 'https://ok.example' } })
        ).toEqual(EMPTY_PUBLIC_RUNTIME_CONFIG);
    });
});
