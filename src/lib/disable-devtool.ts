import { getSecureSharePayload, parseUrlParams } from './url-params';

export const DISABLE_DEVTOOL_SCOPE_VALUES = ['none', 'all', 'share'] as const;

export type DisableDevtoolScope = (typeof DISABLE_DEVTOOL_SCOPE_VALUES)[number];

const DEFAULT_DISABLE_DEVTOOL_SCOPE: DisableDevtoolScope = 'none';

function normalizeDisableDevtoolScope(value: string | undefined): DisableDevtoolScope {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'all' || normalized === 'share') return normalized;
    return DEFAULT_DISABLE_DEVTOOL_SCOPE;
}

/**
 * DevTools deterrence is intentionally not treated as a security boundary.
 * The default stays off so public builds do not change behavior unless the
 * operator explicitly opts in through the web env configuration.
 */
export function getDisableDevtoolScope(
    rawScope: string | undefined = process.env.NEXT_PUBLIC_DISABLE_DEVTOOL_SCOPE
): DisableDevtoolScope {
    return normalizeDisableDevtoolScope(rawScope);
}

export function isShareEntryUrl(input: string | URLSearchParams): boolean {
    const searchParams =
        typeof input === 'string' ? new URLSearchParams(input) : new URLSearchParams(input.toString());

    if (getSecureSharePayload(searchParams)) return true;

    const { parsed, consumed } = parseUrlParams(searchParams);
    return Boolean(
        consumed.prompt ||
            consumed.promoProfileId ||
            consumed.apiKey ||
            consumed.baseUrl ||
            consumed.model ||
            consumed.providerInstanceId ||
            consumed.syncConfig ||
            (consumed.autostart && typeof parsed.prompt === 'string' && parsed.prompt.trim().length > 0)
    );
}

export function shouldEnableDisableDevtoolForUrl(url: string, scope: DisableDevtoolScope): boolean {
    if (scope === 'none') return false;
    if (scope === 'all') return true;

    try {
        return isShareEntryUrl(new URL(url).search);
    } catch {
        return false;
    }
}
