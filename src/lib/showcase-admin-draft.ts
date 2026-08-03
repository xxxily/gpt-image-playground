import type { ShowcaseRecipeOutput, ShowcaseOutputQuality } from './showcase-recipe';

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

export function setShowcaseRecipeOutputQuality(
    output: ShowcaseRecipeOutput | undefined,
    quality: ShowcaseOutputQuality | ''
): ShowcaseRecipeOutput | undefined {
    const remaining = { ...(output ?? {}) };
    delete remaining.quality;
    return compactOutput(quality ? { ...remaining, quality } : remaining);
}
