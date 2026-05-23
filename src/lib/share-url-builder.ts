import { encryptShareParams, type ShareCryptoOptions } from './share-crypto';
import { buildSecureShareUrl, buildShareUrl, type ShareUrlParams } from '@/lib/url-params';

export type SecureShareUrlBuildInput = {
    currentUrl: string;
    selectedShareParams: ShareUrlParams;
    password: string;
    includePasswordInUrl: boolean;
    cryptoOptions?: ShareCryptoOptions;
};

export function buildCleanShareEntryUrl(currentUrl: string): string {
    return buildShareUrl(currentUrl, {});
}

export async function buildEncryptedShareUrl({
    currentUrl,
    selectedShareParams,
    password,
    includePasswordInUrl,
    cryptoOptions
}: SecureShareUrlBuildInput): Promise<string> {
    const encryptedPayload = await encryptShareParams(selectedShareParams, password, cryptoOptions);

    return buildSecureShareUrl(
        currentUrl,
        encryptedPayload,
        includePasswordInUrl ? password : undefined,
        selectedShareParams.promoProfileId ? { promoProfileId: selectedShareParams.promoProfileId } : {}
    );
}
