import type { ApiErrorCategory } from '@/lib/api-error-category';

export const SHOWCASE_ANALYTICS_EVENT_NAMES = [
    'showcase_impression',
    'showcase_open',
    'showcase_case_open',
    'showcase_recipe_prepare',
    'showcase_recipe_apply',
    'showcase_generation_submit',
    'showcase_generation_success',
    'showcase_generation_failure'
] as const;

export type ShowcaseAnalyticsEventName = (typeof SHOWCASE_ANALYTICS_EVENT_NAMES)[number];
export type ShowcaseAnalyticsRuntime = 'web' | 'tauri';
export type ShowcaseAnalyticsEntryPoint = 'home' | 'directory' | 'topic' | 'case' | 'workbench' | 'unknown';

export type ShowcaseAnalyticsEvent = {
    event: ShowcaseAnalyticsEventName;
    topicId: string;
    caseId?: string;
    catalogRevision?: string;
    position?: number;
    entryPoint?: ShowcaseAnalyticsEntryPoint;
    runtime: ShowcaseAnalyticsRuntime;
    recipeVersion?: number;
    modelId?: string;
    errorCategory?: ApiErrorCategory;
};

const EVENT_NAMES = new Set<string>(SHOWCASE_ANALYTICS_EVENT_NAMES);
const RUNTIMES = new Set<ShowcaseAnalyticsRuntime>(['web', 'tauri']);
const ENTRY_POINTS = new Set<ShowcaseAnalyticsEntryPoint>([
    'home',
    'directory',
    'topic',
    'case',
    'workbench',
    'unknown'
]);
const ERROR_CATEGORIES = new Set<ApiErrorCategory>(['auth', 'rate-limit', 'server', 'network', 'quota', 'unknown']);
const EVENT_KEYS = new Set([
    'event',
    'topicId',
    'caseId',
    'catalogRevision',
    'position',
    'entryPoint',
    'runtime',
    'recipeVersion',
    'modelId',
    'errorCategory'
]);
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const REVISION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/iu;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,191}$/iu;

function optionalIdentifier(value: unknown): string | undefined | null {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return IDENTIFIER_PATTERN.test(normalized) ? normalized : null;
}

function optionalInteger(value: unknown, minimum: number, maximum: number): number | undefined | null {
    if (value === undefined) return undefined;
    return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
        ? value
        : null;
}

export function normalizeShowcaseAnalyticsEvent(value: unknown): ShowcaseAnalyticsEvent | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some((key) => !EVENT_KEYS.has(key))) return null;

    const event = typeof record.event === 'string' && EVENT_NAMES.has(record.event) ? record.event : null;
    const topicId = optionalIdentifier(record.topicId);
    const caseId = optionalIdentifier(record.caseId);
    const catalogRevision =
        record.catalogRevision === undefined
            ? undefined
            : typeof record.catalogRevision === 'string' && REVISION_PATTERN.test(record.catalogRevision.trim())
              ? record.catalogRevision.trim()
              : null;
    const position = optionalInteger(record.position, 0, 255);
    const recipeVersion = optionalInteger(record.recipeVersion, 1, 10_000);
    const runtime = typeof record.runtime === 'string' && RUNTIMES.has(record.runtime as ShowcaseAnalyticsRuntime)
        ? (record.runtime as ShowcaseAnalyticsRuntime)
        : null;
    const entryPoint =
        record.entryPoint === undefined
            ? undefined
            : typeof record.entryPoint === 'string' && ENTRY_POINTS.has(record.entryPoint as ShowcaseAnalyticsEntryPoint)
              ? (record.entryPoint as ShowcaseAnalyticsEntryPoint)
              : null;
    const modelId =
        record.modelId === undefined
            ? undefined
            : typeof record.modelId === 'string' && MODEL_ID_PATTERN.test(record.modelId.trim())
              ? record.modelId.trim()
              : null;
    const errorCategory =
        record.errorCategory === undefined
            ? undefined
            : typeof record.errorCategory === 'string' && ERROR_CATEGORIES.has(record.errorCategory as ApiErrorCategory)
              ? (record.errorCategory as ApiErrorCategory)
              : null;
    if (
        !event ||
        !topicId ||
        caseId === null ||
        catalogRevision === null ||
        position === null ||
        recipeVersion === null ||
        !runtime ||
        entryPoint === null ||
        modelId === null ||
        errorCategory === null
    ) {
        return null;
    }

    const needsCase = !['showcase_impression', 'showcase_open'].includes(event);
    const needsRecipeVersion = event === 'showcase_recipe_apply';
    const needsModel = event.startsWith('showcase_generation_');
    const needsErrorCategory = event === 'showcase_generation_failure';
    if (
        (needsCase && !caseId) ||
        (event === 'showcase_impression' && (position === undefined || !catalogRevision)) ||
        (event === 'showcase_open' && !entryPoint) ||
        (needsRecipeVersion && recipeVersion === undefined) ||
        (needsModel && !modelId) ||
        (needsErrorCategory && !errorCategory) ||
        (!needsErrorCategory && errorCategory !== undefined)
    ) {
        return null;
    }

    return {
        event: event as ShowcaseAnalyticsEventName,
        topicId,
        ...(caseId ? { caseId } : {}),
        ...(catalogRevision ? { catalogRevision } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(entryPoint ? { entryPoint } : {}),
        runtime,
        ...(recipeVersion !== undefined ? { recipeVersion } : {}),
        ...(modelId ? { modelId } : {}),
        ...(errorCategory ? { errorCategory } : {})
    };
}
