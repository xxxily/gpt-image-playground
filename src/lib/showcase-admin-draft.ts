import type { ShowcaseFaqItem, ShowcaseTopic } from './showcase';
import type {
    ShowcaseAcceptedMimeType,
    ShowcaseInputSlot,
    ShowcaseOutputBackground,
    ShowcaseOutputFormat,
    ShowcaseOutputQuality,
    ShowcaseRecipeOutput,
    ShowcaseRecipeV1,
    ShowcaseModeration
} from './showcase-recipe';

const ACCEPTED_MIME_TYPES = new Set<ShowcaseAcceptedMimeType>(['image/*', 'image/jpeg', 'image/png', 'image/webp']);
const USER_INSTRUCTION_PLACEHOLDER_PATTERN = /\{\{\s*user_instruction\s*\}\}/gu;
const USER_INSTRUCTION_PLACEHOLDER_TEST_PATTERN = /\{\{\s*user_instruction\s*\}\}/u;

function uniqueTrimmedValues(values: readonly string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function setShowcaseTopicFaq(topic: ShowcaseTopic, faq: ShowcaseFaqItem[]): ShowcaseTopic {
    const next = { ...topic };
    if (faq.length > 0) next.faq = faq;
    else delete next.faq;
    return next;
}

export function setShowcaseTopicRelatedIds(topic: ShowcaseTopic, values: readonly string[]): ShowcaseTopic {
    const next = { ...topic };
    const relatedTopicIds = uniqueTrimmedValues(values).filter((id) => id !== topic.id);
    if (relatedTopicIds.length > 0) next.relatedTopicIds = relatedTopicIds;
    else delete next.relatedTopicIds;
    return next;
}

export function setShowcaseRecipeUserInstruction(
    recipe: ShowcaseRecipeV1,
    enabled: boolean,
    maxLength = recipe.userInstruction?.maxLength ?? 500
): ShowcaseRecipeV1 {
    const next = { ...recipe };
    if (!enabled) {
        delete next.userInstruction;
        next.prompt = {
            'zh-CN': recipe.prompt['zh-CN'].replace(USER_INSTRUCTION_PLACEHOLDER_PATTERN, '').trim(),
            'en-US': recipe.prompt['en-US'].replace(USER_INSTRUCTION_PLACEHOLDER_PATTERN, '').trim()
        };
        return next;
    }
    next.userInstruction = {
        enabled: true,
        maxLength: Math.min(2_000, Math.max(1, Math.trunc(maxLength) || 500)),
        ...(recipe.userInstruction?.placeholderKey ? { placeholderKey: recipe.userInstruction.placeholderKey } : {})
    };
    return next;
}

export function setShowcaseRecipeUserInstructionPlaceholder(
    recipe: ShowcaseRecipeV1,
    enabled: boolean
): ShowcaseRecipeV1 {
    if (!recipe.userInstruction?.enabled) return recipe;
    const next = { ...recipe, userInstruction: { ...recipe.userInstruction } };
    if (enabled) {
        next.userInstruction.placeholderKey = 'user_instruction';
        next.prompt = {
            'zh-CN': USER_INSTRUCTION_PLACEHOLDER_TEST_PATTERN.test(recipe.prompt['zh-CN'])
                ? recipe.prompt['zh-CN']
                : `${recipe.prompt['zh-CN'].trim()}\n\n{{user_instruction}}`,
            'en-US': USER_INSTRUCTION_PLACEHOLDER_TEST_PATTERN.test(recipe.prompt['en-US'])
                ? recipe.prompt['en-US']
                : `${recipe.prompt['en-US'].trim()}\n\n{{user_instruction}}`
        };
        return next;
    }
    delete next.userInstruction.placeholderKey;
    next.prompt = {
        'zh-CN': recipe.prompt['zh-CN'].replace(USER_INSTRUCTION_PLACEHOLDER_PATTERN, '').trim(),
        'en-US': recipe.prompt['en-US'].replace(USER_INSTRUCTION_PLACEHOLDER_PATTERN, '').trim()
    };
    return next;
}

export function setShowcaseInputSlotRequired(slot: ShowcaseInputSlot, required: boolean): ShowcaseInputSlot {
    if (required) {
        return {
            ...slot,
            required: true,
            minCount: Math.max(1, slot.minCount),
            maxCount: Math.max(1, slot.maxCount)
        };
    }
    return { ...slot, required: false, minCount: 0, maxCount: Math.max(1, slot.maxCount) };
}

export function setShowcaseInputSlotCounts(
    slot: ShowcaseInputSlot,
    minCount: number,
    maxCount: number
): ShowcaseInputSlot {
    const boundedMaximum = Math.min(16, Math.max(1, Math.trunc(maxCount) || 1));
    const boundedMinimum = slot.required ? Math.min(boundedMaximum, Math.max(1, Math.trunc(minCount) || 1)) : 0;
    return { ...slot, minCount: boundedMinimum, maxCount: boundedMaximum };
}

export function setShowcaseInputSlotMimeTypes(slot: ShowcaseInputSlot, values: readonly string[]): ShowcaseInputSlot {
    const acceptedMimeTypes = uniqueTrimmedValues(values).filter((value): value is ShowcaseAcceptedMimeType =>
        ACCEPTED_MIME_TYPES.has(value as ShowcaseAcceptedMimeType)
    );
    return { ...slot, acceptedMimeTypes: acceptedMimeTypes.length > 0 ? acceptedMimeTypes : ['image/*'] };
}

export function toggleShowcaseInputSlotMimeType(
    slot: ShowcaseInputSlot,
    mimeType: ShowcaseAcceptedMimeType,
    checked: boolean
): ShowcaseInputSlot {
    if (checked && mimeType === 'image/*') return { ...slot, acceptedMimeTypes: ['image/*'] };
    if (checked) {
        return setShowcaseInputSlotMimeTypes(slot, [
            ...slot.acceptedMimeTypes.filter((value) => value !== 'image/*'),
            mimeType
        ]);
    }
    return setShowcaseInputSlotMimeTypes(
        slot,
        slot.acceptedMimeTypes.filter((value) => value !== mimeType)
    );
}

function compactOutput(output: ShowcaseRecipeOutput): ShowcaseRecipeOutput | undefined {
    return Object.keys(output).length > 0 ? output : undefined;
}

export function setShowcaseRecipeOutputSize(
    output: ShowcaseRecipeOutput | undefined,
    rawSize: string
): ShowcaseRecipeOutput | undefined {
    const remaining = { ...(output ?? {}) };
    delete remaining.size;
    delete remaining.scenarioId;
    delete remaining.customWidth;
    delete remaining.customHeight;
    const size = rawSize.trim();
    return compactOutput(size ? { ...remaining, size } : remaining);
}

export function setShowcaseRecipeOutputScenario(
    output: ShowcaseRecipeOutput | undefined,
    rawScenarioId: string
): ShowcaseRecipeOutput | undefined {
    const remaining = { ...(output ?? {}) };
    delete remaining.size;
    delete remaining.scenarioId;
    delete remaining.customWidth;
    delete remaining.customHeight;
    const scenarioId = rawScenarioId.trim();
    return compactOutput(scenarioId ? { ...remaining, scenarioId } : remaining);
}

export function setShowcaseRecipeOutputCustomSize(
    output: ShowcaseRecipeOutput | undefined,
    rawSize: string
): ShowcaseRecipeOutput | undefined {
    const parsed = parseShowcaseRecipeOutputCustomSize(rawSize);
    const remaining = { ...(output ?? {}) };
    delete remaining.size;
    delete remaining.scenarioId;
    delete remaining.customWidth;
    delete remaining.customHeight;
    return compactOutput(
        parsed && parsed !== undefined
            ? { ...remaining, customWidth: parsed.width, customHeight: parsed.height }
            : remaining
    );
}

export function parseShowcaseRecipeOutputCustomSize(
    rawSize: string
): { width: number; height: number } | null | undefined {
    const normalized = rawSize.trim();
    if (!normalized) return null;
    const match = /^(\d{2,4})\s*[x×]\s*(\d{2,4})$/iu.exec(normalized);
    if (!match) return undefined;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width < 64 || width > 8192 || height < 64 || height > 8192) return undefined;
    return { width, height };
}

export function formatShowcaseRecipeOutputCustomSize(output: ShowcaseRecipeOutput | undefined): string {
    return output?.customWidth !== undefined && output.customHeight !== undefined
        ? `${output.customWidth}×${output.customHeight}`
        : '';
}

export function setShowcaseRecipeOutputQuality(
    output: ShowcaseRecipeOutput | undefined,
    quality: ShowcaseOutputQuality | ''
): ShowcaseRecipeOutput | undefined {
    const remaining = { ...(output ?? {}) };
    delete remaining.quality;
    return compactOutput(quality ? { ...remaining, quality } : remaining);
}

export function setShowcaseRecipeOutputEnum(
    output: ShowcaseRecipeOutput | undefined,
    field: 'outputFormat' | 'background' | 'moderation',
    value: ShowcaseOutputFormat | ShowcaseOutputBackground | ShowcaseModeration | ''
): ShowcaseRecipeOutput | undefined {
    const remaining = { ...(output ?? {}) };
    delete remaining[field];
    return compactOutput(value ? { ...remaining, [field]: value } : remaining);
}

export function setShowcaseRecipeOutputInteger(
    output: ShowcaseRecipeOutput | undefined,
    field: 'n' | 'outputCompression',
    value: number | null
): ShowcaseRecipeOutput | undefined {
    const remaining = { ...(output ?? {}) };
    delete remaining[field];
    return compactOutput(value === null ? remaining : { ...remaining, [field]: value });
}
