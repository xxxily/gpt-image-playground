export type ApiProviderId = 'openai' | 'google';
export type BaseUrlSource = 'UI' | 'ENV';

export type ClientDirectLinkRestriction = {
    provider: ApiProviderId;
    source: BaseUrlSource;
    url: string;
};

type ClientDirectLinkOptions = {
    enabled: boolean;
    openaiApiBaseUrl?: string;
    envOpenaiApiBaseUrl?: string;
    geminiApiBaseUrl?: string;
    envGeminiApiBaseUrl?: string;
    providers?: ApiProviderId[];
};

function normalizeUrl(value?: string): string {
    return value?.trim() ?? '';
}

export function isEnabledEnvFlag(value?: string): boolean {
    const normalized = normalizeUrl(value).toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseHostname(url: string): string | null {
    const trimmed = normalizeUrl(url);
    if (!trimmed) return null;

    try {
        return new URL(trimmed).hostname.toLowerCase();
    } catch {
        try {
            return new URL(`https://${trimmed}`).hostname.toLowerCase();
        } catch {
            return null;
        }
    }
}

export function isOfficialProviderBaseUrl(provider: ApiProviderId, url: string): boolean {
    const hostname = parseHostname(url);
    if (!hostname) return false;

    if (provider === 'google') {
        return hostname === 'generativelanguage.googleapis.com';
    }

    return hostname === 'api.openai.com';
}

function getEffectiveUrl(uiValue: string | undefined, envValue: string | undefined): { source: BaseUrlSource; url: string } | null {
    const uiUrl = normalizeUrl(uiValue);
    if (uiUrl) return { source: 'UI', url: uiUrl };

    const envUrl = normalizeUrl(envValue);
    if (envUrl) return { source: 'ENV', url: envUrl };

    return null;
}

export function getClientDirectLinkRestriction(options: ClientDirectLinkOptions): ClientDirectLinkRestriction | null {
    if (!options.enabled) return null;

    const providers = options.providers ?? ['openai', 'google'];

    if (providers.includes('openai')) {
        const openaiUrl = getEffectiveUrl(options.openaiApiBaseUrl, options.envOpenaiApiBaseUrl);
        if (openaiUrl && !isOfficialProviderBaseUrl('openai', openaiUrl.url)) {
            return { provider: 'openai', ...openaiUrl };
        }
    }

    if (providers.includes('google')) {
        const geminiUrl = getEffectiveUrl(options.geminiApiBaseUrl, options.envGeminiApiBaseUrl);
        if (geminiUrl && !isOfficialProviderBaseUrl('google', geminiUrl.url)) {
            return { provider: 'google', ...geminiUrl };
        }
    }

    return null;
}

export function formatClientDirectLinkRestriction(restriction: ClientDirectLinkRestriction): string {
    const providerName = restriction.provider === 'google' ? 'Gemini' : 'OpenAI';
    const sourceName = restriction.source === 'ENV' ? '.env' : 'UI';
    return `${sourceName} 中的 ${providerName} API Base URL 指向非官方服务站点（${restriction.url}），当前部署启用了客户端直链优先，因此服务器中转不可用。请在系统配置中使用客户端直连。`;
}
