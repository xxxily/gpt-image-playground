export const DESKTOP_APP_DOWNLOAD_URL = 'https://github.com/xxxily/gpt-image-playground/releases/latest';

export const DESKTOP_APP_GUIDANCE_TITLE = '建议使用桌面端';

export const DESKTOP_APP_GUIDANCE_MESSAGE =
    '如果浏览器因为 CORS 跨域策略、直链访问限制或服务器中转资源不足导致请求不可用，请下载并使用桌面端。桌面端内置 Rust 中转能力，可以在不消耗服务器中转资源的情况下继续访问第三方服务。';

export const DESKTOP_ONLY_SETTINGS_MESSAGE =
    '当前配置仅桌面端可用。Web 应用无法使用本机 Rust 中转代理、系统代理或桌面调试模式；如需这些能力，请下载并使用桌面端。';

export function appendDesktopAppGuidance(message: string): string {
    const trimmed = message.trim();
    if (!trimmed) return DESKTOP_APP_GUIDANCE_MESSAGE;
    return `${trimmed} ${DESKTOP_APP_GUIDANCE_MESSAGE}`;
}

export function isLikelyWebDirectAccessError(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
        normalized.includes('cors') ||
        normalized.includes('access-control') ||
        normalized.includes('failed to fetch') ||
        normalized.includes('fetch failed') ||
        normalized.includes('networkerror') ||
        normalized.includes('load failed')
    );
}
