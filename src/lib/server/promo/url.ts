import { validatePublicHttpBaseUrl } from '@/lib/server-url-safety';

export type PromoUrlSafetyResult =
    | { ok: true; normalizedUrl: string }
    | { ok: false; reason: string };

export function validatePromoRemoteUrl(value: string): PromoUrlSafetyResult {
    return validatePublicHttpBaseUrl(value);
}

export function normalizePromoRemoteUrl(value: string): string {
    const result = validatePromoRemoteUrl(value);
    return result.ok ? result.normalizedUrl : '';
}

export function normalizePromoImageUrl(value: string | null | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('//')) return '';
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) return trimmed;
    return normalizePromoRemoteUrl(trimmed);
}

export function validatePromoImageUrl(value: string | null | undefined): PromoUrlSafetyResult {
    const trimmed = value?.trim();
    if (!trimmed) return { ok: false, reason: '图片 URL 不能为空。' };
    const normalizedLocalPath = normalizePromoImageUrl(trimmed);
    if (normalizedLocalPath) return { ok: true, normalizedUrl: normalizedLocalPath };
    return validatePromoRemoteUrl(trimmed);
}
