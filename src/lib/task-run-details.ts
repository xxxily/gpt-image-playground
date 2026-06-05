import type { ImageProviderId } from '@/lib/model-registry';
import type { ProviderKind, ProviderProtocol } from '@/lib/provider-model-catalog';
import type { ProviderOptions, ProviderJsonValue } from '@/lib/provider-options';
import type {
    VisionTextApiCompatibility,
    VisionTextDetail,
    VisionTextResponseFormat,
    VisionTextTaskType
} from '@/lib/vision-text-types';

export type TaskRunDetailParams = Record<string, string | number | boolean | null | undefined>;

export type TaskRunDetailItem = {
    labelKey: string;
    value?: string;
    valueKey?: string;
    valueParams?: TaskRunDetailParams;
    monospace?: boolean;
};

export type TaskRunDetails = {
    items: TaskRunDetailItem[];
};

export type ImageTaskRunDetailsInput = {
    mode: 'generate' | 'edit';
    provider: ImageProviderId;
    providerLabel: string;
    providerInstanceName?: string;
    providerInstanceId?: string;
    apiBaseUrl?: string;
    connectionMode: 'proxy' | 'direct';
    model: string;
    modelLabel?: string;
    n: number;
    size?: string;
    quality?: string;
    outputFormat?: string;
    outputCompression?: number;
    background?: string;
    moderation?: string;
    imageCount?: number;
    hasMask?: boolean;
    enableStreaming?: boolean;
    partialImages?: number;
    providerOptions?: ProviderOptions;
    batchLabel?: string;
    batchIndex?: number;
    batchTotal?: number;
};

export type VisionTextTaskRunDetailsInput = {
    providerKind: string;
    providerLabel: string;
    providerProtocol?: ProviderProtocol | string;
    providerInstanceName?: string;
    providerInstanceId?: string;
    apiBaseUrl?: string;
    connectionMode: 'proxy' | 'direct';
    model: string;
    endpointName?: string;
    endpointId?: string;
    taskType: VisionTextTaskType;
    detail: VisionTextDetail;
    responseFormat: VisionTextResponseFormat;
    streamingEnabled: boolean;
    structuredOutputEnabled: boolean;
    maxOutputTokens: number;
    systemPrompt?: string;
    imageCount: number;
    apiCompatibility: VisionTextApiCompatibility;
};

export type VideoTaskRunDetailsInput = {
    provider: ProviderKind;
    providerLabel: string;
    providerProtocol?: ProviderProtocol | string;
    endpointName?: string;
    endpointId?: string;
    apiBaseUrl?: string;
    connectionMode: 'proxy' | 'direct';
    model: string;
    modelLabel?: string;
    durationSeconds?: number;
    aspectRatio?: string;
    size?: string;
    resolutionTier?: string;
    frameRate?: number;
    count?: number;
    promptEnhanceEnabled?: boolean;
    nativeAudioEnabled?: boolean;
    watermarkEnabled?: boolean;
    sourceImageCount?: number;
};

const SENSITIVE_OPTION_KEY =
    /(api[_-]?key|secret|password|token|authorization|bearer|access[_-]?key|accesssecret|credential)/i;
const MAX_PROVIDER_OPTIONS_SUMMARY_LENGTH = 320;

function addItem(items: TaskRunDetailItem[], item: TaskRunDetailItem | null | undefined): void {
    if (!item) return;
    if (!item.value && !item.valueKey) return;
    items.push(item);
}

function normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function stringValue(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return normalizeText(value);
}

function booleanValueKey(value: boolean | undefined): string | undefined {
    if (value === undefined) return undefined;
    return value ? 'tasks.details.value.enabled' : 'tasks.details.value.disabled';
}

function formatModelValue(model: string, label?: string): string {
    const trimmedModel = normalizeText(model);
    const trimmedLabel = normalizeText(label);
    if (!trimmedLabel || trimmedLabel === trimmedModel) return trimmedModel;
    return `${trimmedLabel} (${trimmedModel})`;
}

function formatEndpointName(name?: string, id?: string): string {
    const trimmedName = normalizeText(name);
    const trimmedId = normalizeText(id);
    if (trimmedName && trimmedId && trimmedName !== trimmedId) return `${trimmedName} (${trimmedId})`;
    return trimmedName || trimmedId;
}

export function sanitizeTaskRunUrl(value?: string): string {
    const trimmed = normalizeText(value);
    if (!trimmed) return '';

    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
    const candidate = hasProtocol ? trimmed : `https://${trimmed}`;

    try {
        const parsed = new URL(candidate);
        parsed.username = '';
        parsed.password = '';
        parsed.search = '';
        parsed.hash = '';
        parsed.pathname = parsed.pathname.replace(/\/+$/g, '') || '/';
        const display = `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}`;
        return hasProtocol ? display : display.replace(/^https:\/\//i, '');
    } catch {
        const withoutCredentials = trimmed.replace(/^([a-z][a-z0-9+.-]*:\/\/)(?:[^/@]+@)/i, '$1');
        return withoutCredentials.split(/[?#]/)[0] ?? '';
    }
}

function redactProviderOptionValue(key: string, value: ProviderJsonValue): ProviderJsonValue | string {
    if (SENSITIVE_OPTION_KEY.test(key)) return '<<redacted>>';
    if (Array.isArray(value)) {
        return value.map((item) => redactProviderOptionValue('', item)) as ProviderJsonValue[];
    }
    if (value && typeof value === 'object') {
        const redacted: Record<string, ProviderJsonValue | string> = {};
        Object.entries(value).forEach(([childKey, childValue]) => {
            redacted[childKey] = redactProviderOptionValue(childKey, childValue);
        });
        return redacted as ProviderJsonValue;
    }
    return value;
}

export function summarizeProviderOptions(providerOptions?: ProviderOptions): string {
    if (!providerOptions || Object.keys(providerOptions).length === 0) return '';

    const redacted: Record<string, ProviderJsonValue | string> = {};
    Object.entries(providerOptions).forEach(([key, value]) => {
        redacted[key] = redactProviderOptionValue(key, value);
    });

    const serialized = JSON.stringify(redacted);
    if (serialized.length <= MAX_PROVIDER_OPTIONS_SUMMARY_LENGTH) return serialized;
    return `${serialized.slice(0, MAX_PROVIDER_OPTIONS_SUMMARY_LENGTH - 3)}...`;
}

export function createImageTaskRunDetails(input: ImageTaskRunDetailsInput): TaskRunDetails {
    const items: TaskRunDetailItem[] = [];
    const baseUrl = sanitizeTaskRunUrl(input.apiBaseUrl);
    const providerOptionsSummary = summarizeProviderOptions(input.providerOptions);
    const endpointName = formatEndpointName(input.providerInstanceName, input.providerInstanceId);

    addItem(items, { labelKey: 'tasks.details.taskType', valueKey: `tasks.details.taskType.${input.mode}` });
    addItem(items, { labelKey: 'tasks.details.provider', value: input.providerLabel || input.provider });
    addItem(items, { labelKey: 'tasks.details.endpoint', value: endpointName });
    addItem(items, { labelKey: 'tasks.details.baseUrl', value: baseUrl, monospace: true });
    addItem(items, {
        labelKey: 'tasks.details.connectionMode',
        valueKey: `tasks.details.connectionMode.${input.connectionMode}`
    });
    addItem(items, {
        labelKey: 'tasks.details.model',
        value: formatModelValue(input.model, input.modelLabel),
        monospace: true
    });
    addItem(items, { labelKey: 'tasks.details.outputCount', value: stringValue(input.n) });
    addItem(items, { labelKey: 'tasks.details.size', value: input.size });
    addItem(items, { labelKey: 'tasks.details.quality', value: input.quality });
    addItem(items, { labelKey: 'tasks.details.outputFormat', value: input.outputFormat });
    addItem(items, { labelKey: 'tasks.details.outputCompression', value: stringValue(input.outputCompression) });
    addItem(items, { labelKey: 'tasks.details.background', value: input.background });
    addItem(items, { labelKey: 'tasks.details.moderation', value: input.moderation });
    addItem(items, { labelKey: 'tasks.details.sourceImages', value: stringValue(input.imageCount) });
    addItem(items, { labelKey: 'tasks.details.mask', valueKey: booleanValueKey(input.hasMask) });
    addItem(items, { labelKey: 'tasks.details.streaming', valueKey: booleanValueKey(input.enableStreaming) });
    addItem(items, { labelKey: 'tasks.details.partialImages', value: stringValue(input.partialImages) });
    addItem(items, { labelKey: 'tasks.details.customParameters', value: providerOptionsSummary, monospace: true });
    addItem(items, { labelKey: 'tasks.details.batch', value: input.batchLabel });
    if (typeof input.batchIndex === 'number' && typeof input.batchTotal === 'number') {
        addItem(items, { labelKey: 'tasks.details.batchIndex', value: `${input.batchIndex}/${input.batchTotal}` });
    }

    return { items };
}

export function createVisionTextTaskRunDetails(input: VisionTextTaskRunDetailsInput): TaskRunDetails {
    const items: TaskRunDetailItem[] = [];
    const baseUrl = sanitizeTaskRunUrl(input.apiBaseUrl);
    const endpointName = formatEndpointName(
        input.endpointName || input.providerInstanceName,
        input.endpointId || input.providerInstanceId
    );
    const systemPromptLength = normalizeText(input.systemPrompt).length;

    addItem(items, { labelKey: 'tasks.details.taskType', valueKey: 'tasks.details.taskType.image-to-text' });
    addItem(items, { labelKey: 'tasks.details.provider', value: input.providerLabel || input.providerKind });
    addItem(items, { labelKey: 'tasks.details.endpoint', value: endpointName });
    addItem(items, { labelKey: 'tasks.details.baseUrl', value: baseUrl, monospace: true });
    addItem(items, { labelKey: 'tasks.details.protocol', value: input.providerProtocol, monospace: true });
    addItem(items, {
        labelKey: 'tasks.details.connectionMode',
        valueKey: `tasks.details.connectionMode.${input.connectionMode}`
    });
    addItem(items, { labelKey: 'tasks.details.model', value: input.model, monospace: true });
    addItem(items, { labelKey: 'tasks.details.visionTask', value: input.taskType });
    addItem(items, { labelKey: 'tasks.details.detail', value: input.detail });
    addItem(items, { labelKey: 'tasks.details.responseFormat', value: input.responseFormat });
    addItem(items, { labelKey: 'tasks.details.apiCompatibility', value: input.apiCompatibility });
    addItem(items, { labelKey: 'tasks.details.sourceImages', value: stringValue(input.imageCount) });
    addItem(items, { labelKey: 'tasks.details.streaming', valueKey: booleanValueKey(input.streamingEnabled) });
    addItem(items, {
        labelKey: 'tasks.details.structuredOutput',
        valueKey: booleanValueKey(input.structuredOutputEnabled)
    });
    addItem(items, { labelKey: 'tasks.details.maxOutputTokens', value: stringValue(input.maxOutputTokens) });
    if (systemPromptLength > 0) {
        addItem(items, {
            labelKey: 'tasks.details.systemPrompt',
            valueKey: 'tasks.details.systemPromptConfigured',
            valueParams: { count: systemPromptLength }
        });
    }

    return { items };
}

export function createVideoTaskRunDetails(input: VideoTaskRunDetailsInput): TaskRunDetails {
    const items: TaskRunDetailItem[] = [];
    const baseUrl = sanitizeTaskRunUrl(input.apiBaseUrl);
    const endpointName = formatEndpointName(input.endpointName, input.endpointId);

    addItem(items, { labelKey: 'tasks.details.taskType', valueKey: 'tasks.details.taskType.video' });
    addItem(items, { labelKey: 'tasks.details.provider', value: input.providerLabel || input.provider });
    addItem(items, { labelKey: 'tasks.details.endpoint', value: endpointName });
    addItem(items, { labelKey: 'tasks.details.baseUrl', value: baseUrl, monospace: true });
    addItem(items, { labelKey: 'tasks.details.protocol', value: input.providerProtocol, monospace: true });
    addItem(items, {
        labelKey: 'tasks.details.connectionMode',
        valueKey: `tasks.details.connectionMode.${input.connectionMode}`
    });
    addItem(items, {
        labelKey: 'tasks.details.model',
        value: formatModelValue(input.model, input.modelLabel),
        monospace: true
    });
    addItem(items, { labelKey: 'tasks.details.durationSeconds', value: stringValue(input.durationSeconds) });
    addItem(items, { labelKey: 'tasks.details.aspectRatio', value: input.aspectRatio });
    addItem(items, { labelKey: 'tasks.details.size', value: input.size });
    addItem(items, { labelKey: 'tasks.details.resolutionTier', value: input.resolutionTier });
    addItem(items, { labelKey: 'tasks.details.frameRate', value: stringValue(input.frameRate) });
    addItem(items, { labelKey: 'tasks.details.outputCount', value: stringValue(input.count) });
    addItem(items, { labelKey: 'tasks.details.sourceImages', value: stringValue(input.sourceImageCount) });
    addItem(items, { labelKey: 'tasks.details.promptEnhance', valueKey: booleanValueKey(input.promptEnhanceEnabled) });
    addItem(items, { labelKey: 'tasks.details.nativeAudio', valueKey: booleanValueKey(input.nativeAudioEnabled) });
    addItem(items, { labelKey: 'tasks.details.watermark', valueKey: booleanValueKey(input.watermarkEnabled) });

    return { items };
}
