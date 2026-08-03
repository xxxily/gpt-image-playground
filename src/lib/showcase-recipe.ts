import type { AppLanguage } from './i18n/language';

export const SHOWCASE_RECIPE_VERSION = 1 as const;

export type ShowcaseLocalizedText = Record<AppLanguage, string>;

export type ShowcaseTaskMode = 'image-generate' | 'image-edit';

export type ShowcasePromptStrategy = 'replace' | 'append';

export type ShowcaseInputRole = 'target' | 'person' | 'garment' | 'product' | 'style-reference' | 'other';

export type ShowcaseAcceptedMimeType = 'image/*' | 'image/jpeg' | 'image/png' | 'image/webp';

export type ShowcaseOutputQuality = 'low' | 'medium' | 'high' | 'auto';

export type ShowcaseOutputFormat = 'png' | 'jpeg' | 'webp';

export type ShowcaseOutputBackground = 'transparent' | 'opaque' | 'auto';

export type ShowcaseModeration = 'low' | 'auto';

export type ShowcaseInputSlot = {
    id: string;
    label: ShowcaseLocalizedText;
    description: ShowcaseLocalizedText;
    role: ShowcaseInputRole;
    required: boolean;
    minCount: number;
    maxCount: number;
    workbenchOrder: number;
    acceptedMimeTypes: ShowcaseAcceptedMimeType[];
};

export type ShowcaseCapabilityRequirements = {
    supportsEditing?: boolean;
    supportsMask?: boolean;
    supportsCustomSize?: boolean;
    minReferenceImages?: number;
    supportedTaskModes?: ShowcaseTaskMode[];
};

export type ShowcaseRecipeOutput = {
    n?: number;
    scenarioId?: string;
    size?: string;
    customWidth?: number;
    customHeight?: number;
    quality?: ShowcaseOutputQuality;
    outputFormat?: ShowcaseOutputFormat;
    outputCompression?: number;
    background?: ShowcaseOutputBackground;
    moderation?: ShowcaseModeration;
};

export type ShowcaseUserInstruction = {
    enabled: boolean;
    maxLength: number;
    placeholderKey?: 'user_instruction';
};

export type ShowcaseRecipeV1 = {
    version: typeof SHOWCASE_RECIPE_VERSION;
    taskMode: ShowcaseTaskMode;
    promptStrategy: ShowcasePromptStrategy;
    prompt: ShowcaseLocalizedText;
    inputSlots: ShowcaseInputSlot[];
    capabilityRequirements: ShowcaseCapabilityRequirements;
    preferredModelIds?: string[];
    output?: ShowcaseRecipeOutput;
    userInstruction?: ShowcaseUserInstruction;
};

export type ShowcasePromptApplyMode = 'replace' | 'append' | 'keep';

export type ShowcaseRecipeWorkbenchValues = {
    taskMode: ShowcaseTaskMode;
    prompt: string;
    n?: number;
    scenarioId?: string;
    size?: string;
    customWidth?: number;
    customHeight?: number;
    quality?: ShowcaseOutputQuality;
    outputFormat?: ShowcaseOutputFormat;
    outputCompression?: number;
    background?: ShowcaseOutputBackground;
    moderation?: ShowcaseModeration;
};

export type ShowcaseModelCapabilityInput = {
    id: string;
    label: string;
    supportsEditing: boolean;
    supportsMask: boolean;
    supportsCustomSize: boolean;
    maxReferenceImages?: number;
};

export type ShowcaseModelCompatibilityReason = 'task-mode' | 'editing' | 'mask' | 'custom-size' | 'reference-images';

export type ShowcaseModelCompatibility = {
    compatible: boolean;
    reasons: ShowcaseModelCompatibilityReason[];
};

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const TASK_MODES = new Set<ShowcaseTaskMode>(['image-generate', 'image-edit']);
const PROMPT_STRATEGIES = new Set<ShowcasePromptStrategy>(['replace', 'append']);
const INPUT_ROLES = new Set<ShowcaseInputRole>(['target', 'person', 'garment', 'product', 'style-reference', 'other']);
const ACCEPTED_MIME_TYPES = new Set<ShowcaseAcceptedMimeType>(['image/*', 'image/jpeg', 'image/png', 'image/webp']);
const OUTPUT_QUALITIES = new Set<ShowcaseOutputQuality>(['low', 'medium', 'high', 'auto']);
const OUTPUT_FORMATS = new Set<ShowcaseOutputFormat>(['png', 'jpeg', 'webp']);
const OUTPUT_BACKGROUNDS = new Set<ShowcaseOutputBackground>(['transparent', 'opaque', 'auto']);
const MODERATION_VALUES = new Set<ShowcaseModeration>(['low', 'auto']);

const RECIPE_KEYS = new Set([
    'version',
    'schemaVersion',
    'taskMode',
    'promptStrategy',
    'prompt',
    'inputSlots',
    'capabilityRequirements',
    'preferredModelIds',
    'output',
    'userInstruction'
]);
const LOCALIZED_TEXT_KEYS = new Set(['zh-CN', 'en-US']);
const INPUT_SLOT_KEYS = new Set([
    'id',
    'label',
    'description',
    'role',
    'required',
    'minCount',
    'maxCount',
    'workbenchOrder',
    'acceptedMimeTypes'
]);
const CAPABILITY_KEYS = new Set([
    'supportsEditing',
    'supportsMask',
    'supportsCustomSize',
    'minReferenceImages',
    'supportedTaskModes'
]);
const OUTPUT_KEYS = new Set([
    'n',
    'scenarioId',
    'size',
    'customWidth',
    'customHeight',
    'quality',
    'outputFormat',
    'outputCompression',
    'background',
    'moderation'
]);
const USER_INSTRUCTION_KEYS = new Set(['enabled', 'maxLength', 'placeholderKey']);

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,191}$/iu;
const SIZE_PATTERN = /^(?:auto|[1-9]\d{1,4}x[1-9]\d{1,4})$/u;
const FORBIDDEN_RECIPE_TEXT_PATTERNS = [
    /(?:^|[\s"'=])(?:file|blob|data|javascript):/iu,
    /\b(?:https?|wss?):\/\//iu,
    /(?:^|[\s"'=])(?:[a-z]:[\\/]|\\\\|\/(?:Users|home|private|tmp|var|etc)\/)/iu,
    /\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password)\s*[:=]\s*\S+/iu,
    /\bbearer\s+[a-z0-9._~+/=-]{8,}/iu,
    /\bsk-[a-z0-9_-]{8,}\b/iu,
    /<script\b|on(?:error|load|click)\s*=/iu,
    /(?:^|[\s"'=])[a-z0-9+/]{256,}={0,2}(?:$|[\s"'])/iu
];

type UnknownRecord = Record<string, unknown>;

function asStrictRecord(value: unknown, allowedKeys: ReadonlySet<string>): UnknownRecord | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const record = value as UnknownRecord;
    for (const key of Object.keys(record)) {
        if (DANGEROUS_KEYS.has(key) || !allowedKeys.has(key)) return null;
    }
    return record;
}

function asStrictArray(value: unknown): unknown[] | null {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;

    const keys = Object.keys(value);
    if (keys.some((key) => !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length)) return null;
    for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) return null;
    }
    return value;
}

function hasForbiddenRecipeText(value: string): boolean {
    return FORBIDDEN_RECIPE_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeText(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength || normalized.includes('\0')) return null;
    if (hasForbiddenRecipeText(normalized)) return null;
    return normalized;
}

function normalizeLocalizedText(value: unknown, maxLength: number): ShowcaseLocalizedText | null {
    const record = asStrictRecord(value, LOCALIZED_TEXT_KEYS);
    if (!record) return null;

    const zhCN = normalizeText(record['zh-CN'], maxLength);
    const enUS = normalizeText(record['en-US'], maxLength);
    if (!zhCN || !enUS) return null;
    return { 'zh-CN': zhCN, 'en-US': enUS };
}

function normalizeInteger(value: unknown, minimum: number, maximum: number): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) return null;
    return value;
}

function normalizeIdentifier(value: unknown): string | null {
    const normalized = normalizeText(value, 128);
    if (!normalized || !IDENTIFIER_PATTERN.test(normalized)) return null;
    return normalized;
}

function normalizeModelId(value: unknown): string | null {
    const normalized = normalizeText(value, 192);
    if (!normalized || !MODEL_ID_PATTERN.test(normalized) || normalized.includes('..')) return null;
    return normalized;
}

function normalizeEnum<T extends string>(value: unknown, values: ReadonlySet<T>): T | null {
    return typeof value === 'string' && values.has(value as T) ? (value as T) : null;
}

function normalizeStringArray<T extends string>(
    value: unknown,
    normalizeItem: (item: unknown) => T | null,
    minimumItems: number,
    maximumItems: number
): T[] | null {
    const source = asStrictArray(value);
    if (!source || source.length < minimumItems || source.length > maximumItems) return null;

    const result: T[] = [];
    const seen = new Set<string>();
    for (const item of source) {
        const normalized = normalizeItem(item);
        if (!normalized || seen.has(normalized)) return null;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

function normalizeInputSlot(value: unknown): ShowcaseInputSlot | null {
    const record = asStrictRecord(value, INPUT_SLOT_KEYS);
    if (!record) return null;

    const id = normalizeIdentifier(record.id);
    const label = normalizeLocalizedText(record.label, 120);
    const description = normalizeLocalizedText(record.description, 500);
    const role = normalizeEnum(record.role, INPUT_ROLES);
    if (!id || !label || !description || !role || typeof record.required !== 'boolean') return null;

    const minCount = normalizeInteger(record.minCount, 0, 16);
    const maxCount = normalizeInteger(record.maxCount, 1, 16);
    const workbenchOrder = normalizeInteger(record.workbenchOrder, 0, 63);
    const acceptedMimeTypes = normalizeStringArray(
        record.acceptedMimeTypes,
        (item) => normalizeEnum(item, ACCEPTED_MIME_TYPES),
        1,
        ACCEPTED_MIME_TYPES.size
    );
    if (minCount === null || maxCount === null || workbenchOrder === null || !acceptedMimeTypes) return null;
    if (minCount > maxCount || (record.required && minCount === 0) || (!record.required && minCount > 0)) return null;

    return {
        id,
        label,
        description,
        role,
        required: record.required,
        minCount,
        maxCount,
        workbenchOrder,
        acceptedMimeTypes
    };
}

function normalizeCapabilityRequirements(value: unknown): ShowcaseCapabilityRequirements | null {
    const record = asStrictRecord(value, CAPABILITY_KEYS);
    if (!record) return null;

    const result: ShowcaseCapabilityRequirements = {};
    for (const key of ['supportsEditing', 'supportsMask', 'supportsCustomSize'] as const) {
        const rawValue = record[key];
        if (rawValue === undefined) continue;
        if (typeof rawValue !== 'boolean') return null;
        result[key] = rawValue;
    }

    if (record.minReferenceImages !== undefined) {
        const minReferenceImages = normalizeInteger(record.minReferenceImages, 0, 16);
        if (minReferenceImages === null) return null;
        result.minReferenceImages = minReferenceImages;
    }

    if (record.supportedTaskModes !== undefined) {
        const supportedTaskModes = normalizeStringArray(
            record.supportedTaskModes,
            (item) => normalizeEnum(item, TASK_MODES),
            1,
            TASK_MODES.size
        );
        if (!supportedTaskModes) return null;
        result.supportedTaskModes = supportedTaskModes;
    }

    return result;
}

function normalizeOutput(value: unknown): ShowcaseRecipeOutput | null {
    const record = asStrictRecord(value, OUTPUT_KEYS);
    if (!record) return null;

    const result: ShowcaseRecipeOutput = {};
    if (record.n !== undefined) {
        const n = normalizeInteger(record.n, 1, 10);
        if (n === null) return null;
        result.n = n;
    }

    if (record.scenarioId !== undefined) {
        const scenarioId = normalizeIdentifier(record.scenarioId);
        if (!scenarioId) return null;
        result.scenarioId = scenarioId;
    }

    if (record.size !== undefined) {
        const size = normalizeText(record.size, 32);
        if (!size || !SIZE_PATTERN.test(size)) return null;
        result.size = size;
    }

    const hasCustomWidth = record.customWidth !== undefined;
    const hasCustomHeight = record.customHeight !== undefined;
    if (hasCustomWidth !== hasCustomHeight) return null;
    if (hasCustomWidth && hasCustomHeight) {
        const customWidth = normalizeInteger(record.customWidth, 64, 8192);
        const customHeight = normalizeInteger(record.customHeight, 64, 8192);
        if (customWidth === null || customHeight === null) return null;
        result.customWidth = customWidth;
        result.customHeight = customHeight;
    }

    const sizeModes = [record.scenarioId !== undefined, record.size !== undefined, hasCustomWidth].filter(
        Boolean
    ).length;
    if (sizeModes > 1) return null;

    if (record.quality !== undefined) {
        const quality = normalizeEnum(record.quality, OUTPUT_QUALITIES);
        if (!quality) return null;
        result.quality = quality;
    }
    if (record.outputFormat !== undefined) {
        const outputFormat = normalizeEnum(record.outputFormat, OUTPUT_FORMATS);
        if (!outputFormat) return null;
        result.outputFormat = outputFormat;
    }
    if (record.outputCompression !== undefined) {
        const outputCompression = normalizeInteger(record.outputCompression, 0, 100);
        if (outputCompression === null) return null;
        result.outputCompression = outputCompression;
    }
    if (record.background !== undefined) {
        const background = normalizeEnum(record.background, OUTPUT_BACKGROUNDS);
        if (!background) return null;
        result.background = background;
    }
    if (record.moderation !== undefined) {
        const moderation = normalizeEnum(record.moderation, MODERATION_VALUES);
        if (!moderation) return null;
        result.moderation = moderation;
    }

    return result;
}

function normalizeUserInstruction(value: unknown): ShowcaseUserInstruction | null {
    const record = asStrictRecord(value, USER_INSTRUCTION_KEYS);
    if (!record || typeof record.enabled !== 'boolean') return null;

    const maxLength = normalizeInteger(record.maxLength, 1, 2_000);
    if (maxLength === null) return null;

    const result: ShowcaseUserInstruction = { enabled: record.enabled, maxLength };
    if (record.placeholderKey !== undefined) {
        if (record.placeholderKey !== 'user_instruction' || !record.enabled) return null;
        result.placeholderKey = 'user_instruction';
    }
    return result;
}

function resolveRecipeVersion(record: UnknownRecord): number | null {
    const version = record.version;
    const schemaVersion = record.schemaVersion;
    if (version === undefined && schemaVersion === undefined) return null;
    if (version !== undefined && schemaVersion !== undefined && version !== schemaVersion) return null;
    const resolved = version ?? schemaVersion;
    return typeof resolved === 'number' && Number.isInteger(resolved) ? resolved : null;
}

export function normalizeShowcaseRecipe(value: unknown): ShowcaseRecipeV1 | null {
    const record = asStrictRecord(value, RECIPE_KEYS);
    if (!record || resolveRecipeVersion(record) !== SHOWCASE_RECIPE_VERSION) return null;

    const taskMode = normalizeEnum(record.taskMode, TASK_MODES);
    const promptStrategy = normalizeEnum(record.promptStrategy, PROMPT_STRATEGIES);
    const prompt = normalizeLocalizedText(record.prompt, 12_000);
    const rawInputSlots = asStrictArray(record.inputSlots);
    const capabilityRequirements = normalizeCapabilityRequirements(record.capabilityRequirements);
    if (!taskMode || !promptStrategy || !prompt || !rawInputSlots || !capabilityRequirements) return null;
    if (rawInputSlots.length > 16) return null;

    const inputSlots: ShowcaseInputSlot[] = [];
    const slotIds = new Set<string>();
    const workbenchOrders = new Set<number>();
    for (const rawSlot of rawInputSlots) {
        const slot = normalizeInputSlot(rawSlot);
        if (!slot || slotIds.has(slot.id) || workbenchOrders.has(slot.workbenchOrder)) return null;
        slotIds.add(slot.id);
        workbenchOrders.add(slot.workbenchOrder);
        inputSlots.push(slot);
    }
    inputSlots.sort((left, right) => left.workbenchOrder - right.workbenchOrder);

    if (taskMode === 'image-edit' && inputSlots.length === 0) return null;
    if (capabilityRequirements.supportedTaskModes?.includes(taskMode) === false) return null;
    const totalMaximumReferences = inputSlots.reduce((total, slot) => total + slot.maxCount, 0);
    if ((capabilityRequirements.minReferenceImages ?? 0) > totalMaximumReferences) return null;

    const result: ShowcaseRecipeV1 = {
        version: SHOWCASE_RECIPE_VERSION,
        taskMode,
        promptStrategy,
        prompt,
        inputSlots,
        capabilityRequirements
    };

    if (record.preferredModelIds !== undefined) {
        const preferredModelIds = normalizeStringArray(record.preferredModelIds, normalizeModelId, 1, 16);
        if (!preferredModelIds) return null;
        result.preferredModelIds = preferredModelIds;
    }

    if (record.output !== undefined) {
        const output = normalizeOutput(record.output);
        if (!output) return null;
        result.output = output;
    }

    if (record.userInstruction !== undefined) {
        const userInstruction = normalizeUserInstruction(record.userInstruction);
        if (!userInstruction) return null;
        result.userInstruction = userInstruction;
    }

    const placeholderPattern = /\{\{\s*([^{}]+?)\s*\}\}/gu;
    for (const localizedPrompt of Object.values(prompt)) {
        for (const match of localizedPrompt.matchAll(placeholderPattern)) {
            if (match[1] !== 'user_instruction' || result.userInstruction?.enabled !== true) return null;
        }
    }

    return result;
}

export function localizeShowcaseText(text: ShowcaseLocalizedText, language: AppLanguage): string {
    return text[language] || text['zh-CN'] || text['en-US'];
}

export function applyShowcasePrompt(
    currentPrompt: string,
    recipePrompt: string,
    mode: ShowcasePromptApplyMode
): string {
    const current = currentPrompt.trim();
    const recipe = recipePrompt.trim();
    if (mode === 'keep') return currentPrompt;
    if (mode === 'replace') return recipe;
    if (!current) return recipe;
    if (!recipe) return currentPrompt;
    return `${current}\n\n${recipe}`;
}

export function buildShowcaseRecipePrompt(
    recipe: ShowcaseRecipeV1,
    language: AppLanguage,
    userInstruction: string
): string {
    const prompt = localizeShowcaseText(recipe.prompt, language);
    const instruction = recipe.userInstruction?.enabled
        ? userInstruction.trim().slice(0, recipe.userInstruction.maxLength)
        : '';
    if (!instruction) return prompt.replace(/\{\{\s*user_instruction\s*\}\}/gu, '').trim();
    if (/\{\{\s*user_instruction\s*\}\}/u.test(prompt)) {
        return prompt.replace(/\{\{\s*user_instruction\s*\}\}/gu, instruction).trim();
    }
    return `${prompt.trim()}\n\n${instruction}`;
}

export function syncShowcasePromptWithUserInstruction(
    recipe: ShowcaseRecipeV1,
    language: AppLanguage,
    previousInstruction: string,
    nextInstruction: string,
    currentPrompt: string
): string {
    const previousGeneratedPrompt = buildShowcaseRecipePrompt(recipe, language, previousInstruction);
    if (currentPrompt !== previousGeneratedPrompt) return currentPrompt;
    return buildShowcaseRecipePrompt(recipe, language, nextInstruction);
}

export function evaluateShowcaseModelCompatibility(
    recipe: ShowcaseRecipeV1,
    model: ShowcaseModelCapabilityInput
): ShowcaseModelCompatibility {
    const reasons: ShowcaseModelCompatibility['reasons'] = [];
    const requirements = recipe.capabilityRequirements;
    if (requirements.supportedTaskModes && !requirements.supportedTaskModes.includes(recipe.taskMode)) {
        reasons.push('task-mode');
    }
    if ((recipe.taskMode === 'image-edit' || requirements.supportsEditing) && !model.supportsEditing) {
        reasons.push('editing');
    }
    if (requirements.supportsMask && !model.supportsMask) reasons.push('mask');
    if (requirements.supportsCustomSize && !model.supportsCustomSize) reasons.push('custom-size');
    const minimumReferences = requirements.minReferenceImages ?? 0;
    if (model.maxReferenceImages !== undefined && model.maxReferenceImages < minimumReferences) {
        reasons.push('reference-images');
    }
    return { compatible: reasons.length === 0, reasons };
}

export function resolveShowcaseRecipeWorkbenchValues(
    recipe: ShowcaseRecipeV1,
    prompt: string
): ShowcaseRecipeWorkbenchValues {
    return {
        taskMode: recipe.taskMode,
        prompt,
        ...(recipe.output?.n !== undefined ? { n: recipe.output.n } : {}),
        ...(recipe.output?.scenarioId ? { scenarioId: recipe.output.scenarioId } : {}),
        ...(recipe.output?.size ? { size: recipe.output.size } : {}),
        ...(recipe.output?.customWidth !== undefined ? { customWidth: recipe.output.customWidth } : {}),
        ...(recipe.output?.customHeight !== undefined ? { customHeight: recipe.output.customHeight } : {}),
        ...(recipe.output?.quality ? { quality: recipe.output.quality } : {}),
        ...(recipe.output?.outputFormat ? { outputFormat: recipe.output.outputFormat } : {}),
        ...(recipe.output?.outputCompression !== undefined
            ? { outputCompression: recipe.output.outputCompression }
            : {}),
        ...(recipe.output?.background ? { background: recipe.output.background } : {}),
        ...(recipe.output?.moderation ? { moderation: recipe.output.moderation } : {})
    };
}
