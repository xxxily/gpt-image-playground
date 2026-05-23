import { decryptShareParams } from './share-crypto';
import { buildCleanShareEntryUrl, buildEncryptedShareUrl } from './share-url-builder';
import { getSecureSharePasswordFromHash } from './url-params';
import { describe, expect, it } from 'vitest';

const TEST_CRYPTO_OPTIONS = { iterations: 1_000 };
const PASSWORD = 'correct-horse-battery-staple';

describe('share URL builder', () => {
    it('builds the clean entry URL used while encrypted share generation is pending', () => {
        expect(buildCleanShareEntryUrl('https://example.com/play?prompt=stale&apiKey=old#section')).toBe(
            'https://example.com/play#section'
        );
    });

    it('builds an encrypted share URL with public promo params and optional inline password', async () => {
        const url = await buildEncryptedShareUrl({
            currentUrl: 'https://example.com/play?prompt=stale&apiKey=old#section',
            selectedShareParams: {
                prompt: 'draw a private scene',
                model: 'gpt-image-2',
                promoProfileId: 'promo-profile-1'
            },
            password: PASSWORD,
            includePasswordInUrl: true,
            cryptoOptions: TEST_CRYPTO_OPTIONS
        });

        const parsedUrl = new URL(url);
        const encryptedPayload = parsedUrl.searchParams.get('sdata');

        expect(encryptedPayload).toBeTruthy();
        expect(parsedUrl.searchParams.get('prompt')).toBeNull();
        expect(parsedUrl.searchParams.get('apiKey')).toBeNull();
        expect(parsedUrl.searchParams.get('promoProfileId')).toBe('promo-profile-1');
        expect(getSecureSharePasswordFromHash(parsedUrl.hash)).toBe(PASSWORD);
        await expect(decryptShareParams(encryptedPayload || '', PASSWORD)).resolves.toMatchObject({
            prompt: 'draw a private scene',
            model: 'gpt-image-2',
            promoProfileId: 'promo-profile-1'
        });
    });

    it('omits the inline password when requested', async () => {
        const url = await buildEncryptedShareUrl({
            currentUrl: 'https://example.com/play',
            selectedShareParams: { prompt: 'secret prompt' },
            password: PASSWORD,
            includePasswordInUrl: false,
            cryptoOptions: TEST_CRYPTO_OPTIONS
        });

        expect(new URL(url).hash).toBe('');
    });
});
