import { type AppConfig } from '@/lib/config';

export type DesktopProxyMode = 'disabled' | 'system' | 'manual';
export type DesktopPromoServiceMode = 'disabled' | 'current' | 'origin' | 'endpoint';

export type DesktopProxyConfig =
    | { mode: 'disabled' }
    | { mode: 'system' }
    | { mode: 'manual'; url: string };

export type DesktopPromoServiceConfig =
    | { mode: 'disabled'; placementsUrl: null }
    | { mode: 'current'; placementsUrl: string }
    | { mode: 'origin' | 'endpoint'; url: string; placementsUrl: string };

const PROXY_URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const SUPPORTED_PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks5:', 'socks5h:']);
const HTTP_URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const PROMO_PLACEMENTS_PATH = '/api/promo/placements';

/**
 * Build a DesktopProxyConfig from the current AppConfig.
 * - 'disabled' → no proxy (direct network from Rust side)
 * - 'system' → Rust uses OS-level proxy settings
 * - 'manual' → Rust uses the explicitly configured URL when non-empty,
 *   otherwise falls back to 'disabled'.
 */
export function buildDesktopProxyConfig(
    proxyMode: DesktopProxyMode,
    proxyUrl: string
): DesktopProxyConfig {
    switch (proxyMode) {
        case 'disabled':
            return { mode: 'disabled' };
        case 'system':
            return { mode: 'system' };
        case 'manual': {
            const normalizedUrl = normalizeDesktopProxyUrl(proxyUrl);
            if (!normalizedUrl) {
                return { mode: 'disabled' };
            }
            return { mode: 'manual', url: normalizedUrl };
        }
        default:
            return { mode: 'disabled' };
    }
}

/** Normalize a desktop proxy URL. Bare host:port values default to HTTP proxy syntax. */
export function normalizeDesktopProxyUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (PROXY_URL_SCHEME_PATTERN.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
}

/** Validate a proxy URL supported by the Rust desktop backend. */
export function isValidProxyUrl(value: string): boolean {
    const normalized = normalizeDesktopProxyUrl(value);
    if (!normalized) return false;

    try {
        const url = new URL(normalized);
        return SUPPORTED_PROXY_PROTOCOLS.has(url.protocol) && Boolean(url.hostname);
    } catch {
        return false;
    }
}

/**
 * Normalize a desktop proxy mode value from persisted config.
 * Accepts the union type or any string; defaults to 'disabled' for unknown values.
 */
export function normalizeDesktopProxyMode(value: unknown): DesktopProxyMode {
    if (typeof value !== 'string') return 'disabled';
    if (value === 'disabled' || value === 'system' || value === 'manual') return value;
    return 'disabled';
}

export function normalizeDesktopPromoServiceMode(value: unknown): DesktopPromoServiceMode {
    if (typeof value !== 'string') return 'current';
    if (value === 'disabled' || value === 'current' || value === 'origin' || value === 'endpoint') return value;
    return 'current';
}

function normalizeHttpUrl(value: string): URL | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const candidate = HTTP_URL_SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const url = new URL(candidate);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        if (!url.hostname || url.username || url.password) return null;
        return url;
    } catch {
        return null;
    }
}

export function normalizeDesktopPromoServiceUrl(value: string, mode: DesktopPromoServiceMode): string {
    const url = normalizeHttpUrl(value);
    if (!url) return '';
    if (mode === 'origin') return url.origin;
    if (mode === 'endpoint') return url.toString();
    return '';
}

export function buildDesktopPromoPlacementsUrl(
    mode: DesktopPromoServiceMode,
    serviceUrl: string
): string | null {
    switch (mode) {
        case 'disabled':
            return null;
        case 'current':
            return PROMO_PLACEMENTS_PATH;
        case 'origin': {
            const origin = normalizeDesktopPromoServiceUrl(serviceUrl, mode);
            return origin ? `${origin}${PROMO_PLACEMENTS_PATH}` : null;
        }
        case 'endpoint':
            return normalizeDesktopPromoServiceUrl(serviceUrl, mode) || null;
        default:
            return PROMO_PLACEMENTS_PATH;
    }
}

/**
 * Compare two semver-ish version strings (e.g. "1.2.3" vs "1.3.0").
 * Returns:
 *   -1 if a < b
 *    0 if a == b
 *    1 if a > b
 *
 * Compares numeric segments left-to-right. Missing segments treated as 0.
 * Ignores pre-release suffixes for simplicity (treats "1.0.0-beta" same as "1.0.0").
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
    const partsA = a.replace(/^v/, '').split('.').map(Number);
    const partsB = b.replace(/^v/, '').split('.').map(Number);
    const len = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < len; i++) {
        const numA = partsA[i] ?? 0;
        const numB = partsB[i] ?? 0;
        if (numA < numB) return -1;
        if (numA > numB) return 1;
    }
    return 0;
}

/** Determine if a newer version is available compared to the current version. */
export function isNewerVersion(current: string, latest: string): boolean {
    return compareSemver(current, latest) < 0;
}

/** Build DesktopProxyConfig directly from an AppConfig object. */
export function desktopProxyConfigFromAppConfig(config: AppConfig): DesktopProxyConfig {
    const mode = 'desktopProxyMode' in config
        ? normalizeDesktopProxyMode((config as unknown as Record<string, unknown>).desktopProxyMode)
        : 'disabled';
    const url = 'desktopProxyUrl' in config
        ? String((config as unknown as Record<string, unknown>).desktopProxyUrl ?? '')
        : '';
    return buildDesktopProxyConfig(mode, url);
}

export function desktopPromoServiceConfigFromAppConfig(config: AppConfig): DesktopPromoServiceConfig {
    const mode = 'desktopPromoServiceMode' in config
        ? normalizeDesktopPromoServiceMode((config as unknown as Record<string, unknown>).desktopPromoServiceMode)
        : 'current';
    const url = 'desktopPromoServiceUrl' in config
        ? String((config as unknown as Record<string, unknown>).desktopPromoServiceUrl ?? '')
        : '';
    const placementsUrl = buildDesktopPromoPlacementsUrl(mode, url);

    if (mode === 'disabled' || !placementsUrl) return { mode: 'disabled', placementsUrl: null };
    if (mode === 'current') return { mode, placementsUrl };
    return { mode, url: normalizeDesktopPromoServiceUrl(url, mode), placementsUrl };
}
