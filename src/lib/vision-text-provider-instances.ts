import {
    getVisionTextModelDefinitions,
    normalizeVisionTextModelIds
} from '@/lib/vision-text-model-registry';
import { normalizeVisionTextApiCompatibility } from '@/lib/vision-text-core';
import type {
    VisionTextApiCompatibility,
    VisionTextProviderKind
} from '@/lib/vision-text-types';

export type VisionTextProviderInstance = {
    id: string;
    kind: VisionTextProviderKind;
    name: string;
    apiKey: string;
    apiBaseUrl: string;
    apiCompatibility: VisionTextApiCompatibility;
    models: string[];
    isDefault?: boolean;
    reuseOpenAIImageCredentials?: boolean;
};

export function isVisionTextProviderKind(value: unknown): value is VisionTextProviderKind {
    return (
        value === 'openai' ||
        value === 'openai-compatible' ||
        value === 'anthropic' ||
        value === 'anthropic-compatible'
    );
}

export function getVisionTextProviderKindLabel(kind: VisionTextProviderKind): string {
    if (kind === 'anthropic') return 'Anthropic';
    if (kind === 'anthropic-compatible') return 'Anthropic Compatible';
    return kind === 'openai-compatible' ? 'OpenAI Compatible' : 'OpenAI';
}

export function getVisionTextProviderInstanceDefaultId(kind: VisionTextProviderKind): string {
    return `vision:${kind}:default`;
}

export function getVisionTextProviderInstanceHostname(apiBaseUrl: string): string | null {
    const trimmed = apiBaseUrl.trim();
    if (!trimmed) return null;

    try {
        return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
    } catch {
        return null;
    }
}

export function getDefaultVisionTextProviderInstanceName(kind: VisionTextProviderKind, apiBaseUrl: string): string {
    return getVisionTextProviderInstanceHostname(apiBaseUrl) || getVisionTextProviderKindLabel(kind);
}

export function createVisionTextProviderInstanceId(
    kind: VisionTextProviderKind,
    nameOrBaseUrl: string,
    existingIds: readonly string[] = []
): string {
    const hostname = getVisionTextProviderInstanceHostname(nameOrBaseUrl);
    const base = `vision:${kind}:${normalizeSlug(hostname || nameOrBaseUrl)}`;
    const used = new Set(existingIds);
    if (!used.has(base)) return base;

    let index = 2;
    while (used.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
}

export function normalizeVisionTextProviderInstances(value: unknown): VisionTextProviderInstance[] {
    const instances: VisionTextProviderInstance[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(value)) {
        for (const item of value) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
            const record = item as Record<string, unknown>;
            if (!isVisionTextProviderKind(record.kind)) continue;

            const kind = record.kind;
            const apiKey = trimString(record.apiKey);
            const apiBaseUrl = trimString(record.apiBaseUrl);
            const rawName = trimString(record.name);
            const name = rawName || getDefaultVisionTextProviderInstanceName(kind, apiBaseUrl);
            const rawId = trimString(record.id);
            const id = rawId && !seenIds.has(rawId)
                ? rawId
                : createVisionTextProviderInstanceId(kind, apiBaseUrl || name, Array.from(seenIds));
            seenIds.add(id);

            instances.push({
                id,
                kind,
                name,
                apiKey,
                apiBaseUrl,
                apiCompatibility: normalizeVisionTextApiCompatibility(record.apiCompatibility),
                models: normalizeVisionTextModelIds(record.models),
                ...(record.isDefault === true ? { isDefault: true } : {}),
                ...(record.reuseOpenAIImageCredentials === true ? { reuseOpenAIImageCredentials: true } : {})
            });
        }
    }

    instances.forEach((instance) => {
        if (instance.kind === 'openai' && instance.apiCompatibility !== 'responses') {
            instance.apiCompatibility = 'responses';
        }
        if (
            (instance.kind === 'openai-compatible' ||
                instance.kind === 'anthropic' ||
                instance.kind === 'anthropic-compatible') &&
            !instance.models.length
        ) {
            instance.models = [];
        }
    });

    return instances;
}

export const DEFAULT_VISION_TEXT_PROVIDER_INSTANCES: VisionTextProviderInstance[] =
    normalizeVisionTextProviderInstances(undefined);

export function getVisionTextProviderInstancesForKind(
    providerInstances: readonly VisionTextProviderInstance[],
    kind: VisionTextProviderKind
): readonly VisionTextProviderInstance[] {
    return providerInstances.filter((instance) => instance.kind === kind);
}

export function getVisionTextProviderInstance(
    providerInstances: readonly VisionTextProviderInstance[],
    kind: VisionTextProviderKind,
    providerInstanceId?: string
): VisionTextProviderInstance {
    const instancesForKind = getVisionTextProviderInstancesForKind(providerInstances, kind);
    return (
        instancesForKind.find((instance) => instance.id === providerInstanceId) ||
        instancesForKind.find((instance) => instance.isDefault) ||
        instancesForKind[0] ||
        {
            id: getVisionTextProviderInstanceDefaultId(kind),
            kind,
            name: getDefaultVisionTextProviderInstanceName(kind, ''),
            apiKey: '',
            apiBaseUrl: '',
            apiCompatibility:
                kind === 'openai-compatible' || kind === 'anthropic' || kind === 'anthropic-compatible'
                    ? 'chat-completions'
                    : 'responses',
            models: []
        }
    );
}

export function getVisionTextProviderInstanceModelDefinitions(providerInstance: VisionTextProviderInstance) {
    return getVisionTextModelDefinitions(providerInstance.models, providerInstance.kind);
}

export function resolveVisionTextProviderInstanceCredentials(
    providerInstance: VisionTextProviderInstance,
    fallback?: { apiKey?: string; apiBaseUrl?: string }
): { apiKey: string; apiBaseUrl: string } {
    const shouldReuseOpenAI =
        (providerInstance.kind === 'openai' || providerInstance.reuseOpenAIImageCredentials === true) &&
        providerInstance.kind !== 'anthropic' &&
        providerInstance.kind !== 'anthropic-compatible';
    return {
        apiKey: providerInstance.apiKey || (shouldReuseOpenAI ? fallback?.apiKey || '' : ''),
        apiBaseUrl: providerInstance.apiBaseUrl || (shouldReuseOpenAI ? fallback?.apiBaseUrl || '' : '')
    };
}

function trimString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeSlug(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);

    return slug || 'default';
}
