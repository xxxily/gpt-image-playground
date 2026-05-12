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

