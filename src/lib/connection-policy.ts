import { appendDesktopAppGuidance } from '@/lib/desktop-guidance';
import type { ProviderInstance } from '@/lib/provider-instances';

export type ApiProviderId = 'openai' | 'google' | 'sensenova' | 'seedream';
export type BaseUrlSource = 'UI' | 'ENV';

export type ClientDirectLinkRestriction = {
    provider: ApiProviderId;
    source: BaseUrlSource;
    url: string;
    serviceLabel?: string;
};

type ClientDirectLinkOptions = {
    enabled: boolean;
    openaiApiBaseUrl?: string;
    envOpenaiApiBaseUrl?: string;
    geminiApiBaseUrl?: string;
    envGeminiApiBaseUrl?: string;
    sensenovaApiBaseUrl?: string;
    envSensenovaApiBaseUrl?: string;
    seedreamApiBaseUrl?: string;
    envSeedreamApiBaseUrl?: string;
    polishingApiBaseUrl?: string;
    envPolishingApiBaseUrl?: string;
    providers?: ApiProviderId[];
    providerInstances?: readonly ProviderInstance[];
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

function formatRestrictedBaseUrl(url: string): string {
    const trimmed = normalizeUrl(url);
    if (!trimmed) return '空地址';

    try {
        const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
        parsed.username = '';
        parsed.password = '';
        parsed.search = '';
        parsed.hash = '';
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return '无法解析的地址';
    }
}

export function isOfficialProviderBaseUrl(provider: ApiProviderId, url: string): boolean {
    const hostname = parseHostname(url);
    if (!hostname) return false;

    if (provider === 'google') {
        return hostname === 'generativelanguage.googleapis.com';
    }

    if (provider === 'sensenova') {
        return hostname === 'token.sensenova.cn';
    }

    if (provider === 'seedream') {
        return hostname === 'ark.cn-beijing.volces.com';
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

    const providers = options.providers ?? ['openai', 'google', 'sensenova', 'seedream'];

    const restrictedInstance = options.providerInstances?.find((instance) =>
        providers.includes(instance.type) &&
        normalizeUrl(instance.apiBaseUrl) &&
        !isOfficialProviderBaseUrl(instance.type, instance.apiBaseUrl)
    );
    if (restrictedInstance) {
        return { provider: restrictedInstance.type, source: 'UI', url: restrictedInstance.apiBaseUrl, serviceLabel: restrictedInstance.name };
    }

    if (providers.includes('openai')) {
        const openaiUrl = getEffectiveUrl(options.openaiApiBaseUrl, options.envOpenaiApiBaseUrl);
        if (openaiUrl && !isOfficialProviderBaseUrl('openai', openaiUrl.url)) {
            return { provider: 'openai', ...openaiUrl };
        }

        const polishingUrl = getEffectiveUrl(options.polishingApiBaseUrl, options.envPolishingApiBaseUrl);
        if (polishingUrl && !isOfficialProviderBaseUrl('openai', polishingUrl.url)) {
            return { provider: 'openai', serviceLabel: '提示词润色', ...polishingUrl };
        }
    }

    if (providers.includes('google')) {
        const geminiUrl = getEffectiveUrl(options.geminiApiBaseUrl, options.envGeminiApiBaseUrl);
        if (geminiUrl && !isOfficialProviderBaseUrl('google', geminiUrl.url)) {
            return { provider: 'google', ...geminiUrl };
        }
    }

    if (providers.includes('sensenova')) {
        const sensenovaUrl = getEffectiveUrl(options.sensenovaApiBaseUrl, options.envSensenovaApiBaseUrl);
        if (sensenovaUrl && !isOfficialProviderBaseUrl('sensenova', sensenovaUrl.url)) {
            return { provider: 'sensenova', ...sensenovaUrl };
        }
    }

    if (providers.includes('seedream')) {
        const seedreamUrl = getEffectiveUrl(options.seedreamApiBaseUrl, options.envSeedreamApiBaseUrl);
        if (seedreamUrl && !isOfficialProviderBaseUrl('seedream', seedreamUrl.url)) {
            return { provider: 'seedream', ...seedreamUrl };
        }
    }

    return null;
}

export function formatClientDirectLinkRestriction(restriction: ClientDirectLinkRestriction): string {
    const providerName = restriction.serviceLabel || (restriction.provider === 'google'
        ? 'Gemini'
        : restriction.provider === 'sensenova'
            ? 'SenseNova'
            : restriction.provider === 'seedream'
                ? 'Seedream'
                : 'OpenAI');
    const sourceName = restriction.source === 'ENV' ? '.env' : 'UI';
    return appendDesktopAppGuidance(`${sourceName} 中的 ${providerName} API Base URL 指向非官方服务站点（${formatRestrictedBaseUrl(restriction.url)}），当前部署启用了客户端直链优先，因此服务器中转不可用。请在系统配置中使用客户端直连。`);
}
