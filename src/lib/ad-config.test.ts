import { getGenerationHeaderAdConfig, normalizeAdImageUrl, normalizeAdLinkUrl } from './ad-config';
import { describe, expect, it } from 'vitest';

describe('ad config', () => {
    it('keeps the generation header ad disabled by default', () => {
        expect(getGenerationHeaderAdConfig({})).toBeNull();
    });

    it('requires an enabled flag, image URL, and HTTP link URL', () => {
        expect(
            getGenerationHeaderAdConfig({
                NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED: 'true',
                NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL: '/ads/banner.webp'
            })
        ).toBeNull();

        expect(
            getGenerationHeaderAdConfig({
                NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED: 'true',
                NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL: '/ads/banner.webp',
                NEXT_PUBLIC_GENERATION_HEADER_AD_LINK_URL: 'javascript:alert(1)'
            })
        ).toBeNull();
    });

    it('normalizes a valid generation header ad config', () => {
        expect(
            getGenerationHeaderAdConfig({
                NEXT_PUBLIC_GENERATION_HEADER_AD_ENABLED: '1',
                NEXT_PUBLIC_GENERATION_HEADER_AD_IMAGE_URL: ' /ads/banner.webp ',
                NEXT_PUBLIC_GENERATION_HEADER_AD_LINK_URL: ' https://sponsor.example/path ',
                NEXT_PUBLIC_GENERATION_HEADER_AD_ALT: ' Sponsor '
            })
        ).toEqual({
            imageUrl: '/ads/banner.webp',
            linkUrl: 'https://sponsor.example/path',
            alt: 'Sponsor'
        });
    });

    it('accepts local or absolute HTTP image URLs', () => {
        expect(normalizeAdImageUrl('/ads/banner.webp')).toBe('/ads/banner.webp');
        expect(normalizeAdImageUrl('https://cdn.example/banner.webp')).toBe('https://cdn.example/banner.webp');
        expect(normalizeAdImageUrl('//cdn.example/banner.webp')).toBe('');
        expect(normalizeAdImageUrl('data:image/svg+xml;base64,abc')).toBe('');
    });

    it('accepts only absolute HTTP click URLs', () => {
        expect(normalizeAdLinkUrl('https://sponsor.example')).toBe('https://sponsor.example/');
        expect(normalizeAdLinkUrl('http://sponsor.example')).toBe('http://sponsor.example/');
        expect(normalizeAdLinkUrl('/internal')).toBe('');
        expect(normalizeAdLinkUrl('javascript:alert(1)')).toBe('');
    });
});
