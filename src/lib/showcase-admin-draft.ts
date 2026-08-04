import type {
    ShowcaseOutputBackground,
    ShowcaseOutputFormat,
    ShowcaseOutputQuality,
    ShowcaseRecipeOutput,
    ShowcaseModeration
} from './showcase-recipe';

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
