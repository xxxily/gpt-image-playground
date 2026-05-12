import { isEnabledEnvFlag } from '@/lib/connection-policy';

export type GenerationHeaderAdConfig = {
    imageUrl: string;
    linkUrl: string;
    alt: string;
};

const DEFAULT_GENERATION_HEADER_AD_ALT = '赞助广告';

type AdEnv = Record<string, string | undefined>;

function normalizeAbsoluteHttpUrl(value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) return '';

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
        return parsed.href;
    } catch {
        return '';
    }
}

export function normalizeAdImageUrl(value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
    return normalizeAbsoluteHttpUrl(trimmed);
}

export function normalizeAdLinkUrl(value: string | undefined): string {
    return normalizeAbsoluteHttpUrl(value);
}

export function getGenerationHeaderAdConfig(env: AdEnv = process.env): GenerationHeaderAdConfig | null {
    if (!isEnabledEnvFlag(env.NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED)) return null;

    const imageUrl = normalizeAdImageUrl(env.NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL);
    const linkUrl = normalizeAdLinkUrl(env.NEXT_PUBLIC_GENERATION_HEADER_AD_LINK_URL);
    if (!imageUrl || !linkUrl) return null;

    return {
        imageUrl,
        linkUrl,
        alt: env.NEXT_PUBLIC_GENERATION_HEADER_AD_ALT?.trim() || DEFAULT_GENERATION_HEADER_AD_ALT
    };
}
