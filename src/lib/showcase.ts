import { normalizePublicRuntimeConfigUrl } from './public-runtime-config';
import { SHOWCASE_RECIPE_VERSION, normalizeShowcaseReadOnlyPrompt, normalizeShowcaseRecipe } from './showcase-recipe';
import type { ShowcaseLocalizedText, ShowcaseRecipeV1 } from './showcase-recipe';

export type {
    ShowcaseCapabilityRequirements,
    ShowcaseInputSlot,
    ShowcaseLocalizedText,
    ShowcaseRecipeOutput,
    ShowcaseRecipeV1,
    ShowcaseTaskMode
} from './showcase-recipe';

export const SHOWCASE_CATALOG_SCHEMA_VERSION = 1 as const;

export type ShowcasePlaceholderStyle = {
    label: ShowcaseLocalizedText;
    backgroundColor: string;
    foregroundColor: string;
};

export type ShowcasePlaceholderAsset = {
    id: string;
    kind: 'placeholder';
    alt: ShowcaseLocalizedText;
    placeholder: ShowcasePlaceholderStyle;
};

export type ShowcaseRemoteAsset = {
    id: string;
    kind: 'remote-image';
    alt: ShowcaseLocalizedText;
    url: string;
    thumbnailUrl?: string;
    managedAssetId?: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
    width?: number;
    height?: number;
};

export type ShowcaseAsset = ShowcasePlaceholderAsset | ShowcaseRemoteAsset;

export type ShowcaseCaseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type ShowcaseFaqItem = {
    question: ShowcaseLocalizedText;
    answer: ShowcaseLocalizedText;
};

export type ShowcaseCase = {
    id: string;
    topicId: string;
    slug: string;
    title: ShowcaseLocalizedText;
    summary: ShowcaseLocalizedText;
    resultExplanation: ShowcaseLocalizedText;
    inputGuidance: ShowcaseLocalizedText;
    cautions: ShowcaseLocalizedText;
    difficulty: ShowcaseCaseDifficulty;
    sortOrder: number;
    coverAssetId: string;
    inputAssetIds: string[];
    outputAssetIds: string[];
    recipe: ShowcaseRecipeV1;
    unsupportedRecipeVersion?: number;
    readOnlyPrompt?: ShowcaseLocalizedText;
};

export type ShowcaseTopic = {
    id: string;
    slug: string;
    title: ShowcaseLocalizedText;
    summary: ShowcaseLocalizedText;
    preparation: ShowcaseLocalizedText;
    limitations: ShowcaseLocalizedText;
    capabilities?: ShowcaseLocalizedText;
    suitableFor?: ShowcaseLocalizedText;
    unsuitableFor?: ShowcaseLocalizedText;
    recommendedInputQuality?: ShowcaseLocalizedText;
    faq?: ShowcaseFaqItem[];
    relatedTopicIds?: string[];
    tags: ShowcaseLocalizedText[];
    /** Optional operational taxonomy used by the directory filters. */
    categories?: ShowcaseLocalizedText[];
    /** Server-authored publish time for directory ordering; drafts may omit it. */
    publishedAt?: number;
    featured: boolean;
    sortOrder: number;
    coverAssetId: string;
    caseIds: string[];
};

export type ShowcaseCatalog = {
    schemaVersion: typeof SHOWCASE_CATALOG_SCHEMA_VERSION;
    catalogRevision: string;
    generatedAt: number;
    contentNotice: ShowcaseLocalizedText;
    topics: ShowcaseTopic[];
    cases: ShowcaseCase[];
    assets: ShowcaseAsset[];
};

export type NormalizeShowcaseCatalogOptions = {
    /**
     * Drafts and single-topic publication snapshots may refer to topics that
     * are published separately. The IDs are still normalized and self-links
     * remain invalid; the complete public catalog can enforce all references.
     */
    allowDanglingRelatedTopicIds?: boolean;
    /** Client-only recovery for a single case using a newer integer recipe version. */
    allowUnsupportedRecipeVersions?: boolean;
    /** Public wire extensions that old strict schema-v1 clients do not understand. */
    allowExtendedTopicMetadata?: boolean;
};

/** Non-sensitive provenance attached to a workbench task or history entry. */
export type ShowcaseAttribution = {
    topicId: string;
    caseId: string;
    recipeVersion: number;
    catalogRevision: string;
};

export function normalizeShowcaseAttribution(value: unknown): ShowcaseAttribution | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const topicId = typeof record.topicId === 'string' ? record.topicId.trim() : '';
    const caseId = typeof record.caseId === 'string' ? record.caseId.trim() : '';
    const catalogRevision = typeof record.catalogRevision === 'string' ? record.catalogRevision.trim() : '';
    const recipeVersion = record.recipeVersion;
    if (
        !topicId ||
        !caseId ||
        !catalogRevision ||
        !ID_PATTERN.test(topicId) ||
        !ID_PATTERN.test(caseId) ||
        !REVISION_PATTERN.test(catalogRevision) ||
        typeof recipeVersion !== 'number' ||
        !Number.isInteger(recipeVersion) ||
        recipeVersion < 1
    ) {
        return null;
    }
    return { topicId, caseId, recipeVersion, catalogRevision };
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const LOCALIZED_TEXT_KEYS = new Set(['zh-CN', 'en-US']);
const FAQ_KEYS = new Set(['question', 'answer']);
const PLACEHOLDER_STYLE_KEYS = new Set(['label', 'backgroundColor', 'foregroundColor']);
const ASSET_KEYS = new Set([
    'id',
    'kind',
    'alt',
    'placeholder',
    'url',
    'thumbnailUrl',
    'managedAssetId',
    'mimeType',
    'width',
    'height'
]);
const CASE_KEYS = new Set([
    'id',
    'topicId',
    'slug',
    'title',
    'summary',
    'resultExplanation',
    'inputGuidance',
    'cautions',
    'difficulty',
    'sortOrder',
    'coverAssetId',
    'inputAssetIds',
    'outputAssetIds',
    'recipe',
    'unsupportedRecipeVersion',
    'readOnlyPrompt'
]);
const TOPIC_KEYS = new Set([
    'id',
    'slug',
    'title',
    'summary',
    'preparation',
    'limitations',
    'capabilities',
    'suitableFor',
    'unsuitableFor',
    'recommendedInputQuality',
    'faq',
    'relatedTopicIds',
    'tags',
    'categories',
    'publishedAt',
    'featured',
    'sortOrder',
    'coverAssetId',
    'caseIds'
]);
const CATALOG_KEYS = new Set([
    'schemaVersion',
    'catalogRevision',
    'generatedAt',
    'contentNotice',
    'topics',
    'cases',
    'assets'
]);

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const REVISION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/iu;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/iu;
const REMOTE_IMAGE_MIME_TYPES = new Set<ShowcaseRemoteAsset['mimeType']>([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
]);
const CASE_DIFFICULTIES = new Set<ShowcaseCaseDifficulty>(['beginner', 'intermediate', 'advanced']);
const SENSITIVE_QUERY_KEYS = /(?:api[-_]?key|access[-_]?token|auth|credential|password|secret|signature)/iu;
const MANAGED_MEDIA_PATH_PATTERN = /^\/api\/showcase-media\/([a-z0-9][a-z0-9._-]{0,127})(?:\?variant=thumbnail)?$/u;

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

function normalizeDisplayText(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (
        !normalized ||
        normalized.length > maxLength ||
        normalized.includes('\0') ||
        HTML_TAG_PATTERN.test(normalized)
    ) {
        return null;
    }
    return normalized;
}

function normalizeLocalizedText(value: unknown, maxLength: number): ShowcaseLocalizedText | null {
    const record = asStrictRecord(value, LOCALIZED_TEXT_KEYS);
    if (!record) return null;

    const zhCN = normalizeDisplayText(record['zh-CN'], maxLength);
    const enUS = normalizeDisplayText(record['en-US'], maxLength);
    if (!zhCN || !enUS) return null;
    return { 'zh-CN': zhCN, 'en-US': enUS };
}

function normalizeIdentifier(value: unknown): string | null {
    const normalized = normalizeDisplayText(value, 128);
    if (!normalized || !ID_PATTERN.test(normalized)) return null;
    return normalized;
}

function normalizeInteger(value: unknown, minimum: number, maximum: number): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) return null;
    return value;
}

function normalizeEnum<T extends string>(value: unknown, values: ReadonlySet<T>): T | null {
    return typeof value === 'string' && values.has(value as T) ? (value as T) : null;
}

function normalizeIdArray(value: unknown, minimumItems: number, maximumItems: number): string[] | null {
    const source = asStrictArray(value);
    if (!source || source.length < minimumItems || source.length > maximumItems) return null;

    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of source) {
        const id = normalizeIdentifier(item);
        if (!id || seen.has(id)) return null;
        seen.add(id);
        result.push(id);
    }
    return result;
}

function normalizeHttpsAssetUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (MANAGED_MEDIA_PATH_PATTERN.test(trimmed)) return trimmed;
    if (!/^https:\/\//iu.test(trimmed)) return null;
    const normalized = normalizePublicRuntimeConfigUrl(value);
    if (!normalized) return null;

    try {
        const url = new URL(normalized);
        if (url.protocol !== 'https:' || url.username || url.password) return null;
        const hostname = url.hostname.toLowerCase().replace(/^\[/u, '').replace(/\]$/u, '');
        if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return null;
        for (const key of url.searchParams.keys()) {
            if (SENSITIVE_QUERY_KEYS.test(key)) return null;
        }
        return url.toString();
    } catch {
        return null;
    }
}

function managedAssetIdFromUrl(value: string): string | null {
    try {
        const parsed = value.startsWith('/') ? null : new URL(value);
        const pathnameAndSearch = parsed ? `${parsed.pathname}${parsed.search}` : value;
        return MANAGED_MEDIA_PATH_PATTERN.exec(pathnameAndSearch)?.[1] ?? null;
    } catch {
        return null;
    }
}

function normalizePlaceholderAsset(
    record: UnknownRecord,
    id: string,
    alt: ShowcaseLocalizedText
): ShowcaseAsset | null {
    if (
        record.url !== undefined ||
        record.thumbnailUrl !== undefined ||
        record.managedAssetId !== undefined ||
        record.mimeType !== undefined ||
        record.width !== undefined ||
        record.height !== undefined
    ) {
        return null;
    }

    const placeholderRecord = asStrictRecord(record.placeholder, PLACEHOLDER_STYLE_KEYS);
    if (!placeholderRecord) return null;
    const label = normalizeLocalizedText(placeholderRecord.label, 160);
    const backgroundColor = normalizeDisplayText(placeholderRecord.backgroundColor, 7);
    const foregroundColor = normalizeDisplayText(placeholderRecord.foregroundColor, 7);
    if (
        !label ||
        !backgroundColor ||
        !foregroundColor ||
        !HEX_COLOR_PATTERN.test(backgroundColor) ||
        !HEX_COLOR_PATTERN.test(foregroundColor)
    ) {
        return null;
    }

    return {
        id,
        kind: 'placeholder',
        alt,
        placeholder: { label, backgroundColor, foregroundColor }
    };
}

function normalizeRemoteAsset(record: UnknownRecord, id: string, alt: ShowcaseLocalizedText): ShowcaseAsset | null {
    if (record.placeholder !== undefined) return null;

    const url = normalizeHttpsAssetUrl(record.url);
    const mimeType = normalizeEnum(record.mimeType, REMOTE_IMAGE_MIME_TYPES);
    if (!url || !mimeType) return null;

    const thumbnailUrl = record.thumbnailUrl === undefined ? undefined : normalizeHttpsAssetUrl(record.thumbnailUrl);
    if (record.thumbnailUrl !== undefined && !thumbnailUrl) return null;
    const managedAssetId = record.managedAssetId === undefined ? undefined : normalizeIdentifier(record.managedAssetId);
    if (record.managedAssetId !== undefined && !managedAssetId) return null;
    const urlManagedAssetId = managedAssetIdFromUrl(url);
    if ((url.startsWith('/') && !managedAssetId) || (managedAssetId && urlManagedAssetId !== managedAssetId))
        return null;
    if (thumbnailUrl && managedAssetId) {
        const thumbnailManagedAssetId = managedAssetIdFromUrl(thumbnailUrl);
        if (thumbnailManagedAssetId !== managedAssetId || !thumbnailUrl.endsWith('?variant=thumbnail')) {
            return null;
        }
    }

    const hasWidth = record.width !== undefined;
    const hasHeight = record.height !== undefined;
    if (hasWidth !== hasHeight) return null;

    const asset: ShowcaseRemoteAsset = {
        id,
        kind: 'remote-image',
        alt,
        url,
        mimeType,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        ...(managedAssetId ? { managedAssetId } : {})
    };
    if (hasWidth && hasHeight) {
        const width = normalizeInteger(record.width, 1, 16_384);
        const height = normalizeInteger(record.height, 1, 16_384);
        if (width === null || height === null) return null;
        asset.width = width;
        asset.height = height;
    }
    return asset;
}

export function getManagedShowcaseAssetId(asset: ShowcaseAsset): string | null {
    if (asset.kind !== 'remote-image') return null;
    return asset.managedAssetId ?? managedAssetIdFromUrl(asset.url);
}

export function normalizeShowcaseAsset(value: unknown): ShowcaseAsset | null {
    const record = asStrictRecord(value, ASSET_KEYS);
    if (!record) return null;

    const id = normalizeIdentifier(record.id);
    const alt = normalizeLocalizedText(record.alt, 500);
    if (!id || !alt) return null;

    if (record.kind === 'placeholder') return normalizePlaceholderAsset(record, id, alt);
    if (record.kind === 'remote-image') return normalizeRemoteAsset(record, id, alt);
    return null;
}

export function normalizeShowcaseCase(value: unknown): ShowcaseCase | null {
    const record = asStrictRecord(value, CASE_KEYS);
    if (!record || record.unsupportedRecipeVersion !== undefined || record.readOnlyPrompt !== undefined) return null;

    const id = normalizeIdentifier(record.id);
    const topicId = normalizeIdentifier(record.topicId);
    const slug = normalizeIdentifier(record.slug);
    const title = normalizeLocalizedText(record.title, 160);
    const summary = normalizeLocalizedText(record.summary, 1_000);
    const resultExplanation = normalizeLocalizedText(record.resultExplanation, 2_000);
    const inputGuidance = normalizeLocalizedText(record.inputGuidance, 2_000);
    const cautions = normalizeLocalizedText(record.cautions, 2_000);
    const difficulty = normalizeEnum(record.difficulty, CASE_DIFFICULTIES);
    const sortOrder = normalizeInteger(record.sortOrder, 0, 1_000_000);
    const coverAssetId = normalizeIdentifier(record.coverAssetId);
    const inputAssetIds = normalizeIdArray(record.inputAssetIds, 0, 16);
    const outputAssetIds = normalizeIdArray(record.outputAssetIds, 1, 32);
    const recipe = normalizeShowcaseRecipe(record.recipe);

    if (
        !id ||
        !topicId ||
        !slug ||
        !title ||
        !summary ||
        !resultExplanation ||
        !inputGuidance ||
        !cautions ||
        !difficulty ||
        sortOrder === null ||
        !coverAssetId ||
        !inputAssetIds ||
        !outputAssetIds ||
        !recipe
    ) {
        return null;
    }

    if (recipe.taskMode === 'image-edit' && inputAssetIds.length === 0) return null;
    if (inputAssetIds.some((assetId) => outputAssetIds.includes(assetId))) return null;

    return {
        id,
        topicId,
        slug,
        title,
        summary,
        resultExplanation,
        inputGuidance,
        cautions,
        difficulty,
        sortOrder,
        coverAssetId,
        inputAssetIds,
        outputAssetIds,
        recipe
    };
}

function peekShowcaseRecipeVersion(value: unknown): number | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const version = record.version ?? record.schemaVersion;
    if (record.version !== undefined && record.schemaVersion !== undefined && record.version !== record.schemaVersion) {
        return null;
    }
    return typeof version === 'number' && Number.isInteger(version) ? version : null;
}

function normalizeShowcaseCaseForDisplay(value: unknown): ShowcaseCase | null {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const existing = value as UnknownRecord;
        const markedVersion = normalizeInteger(existing.unsupportedRecipeVersion, 2, Number.MAX_SAFE_INTEGER);
        if (markedVersion) {
            const inputAssetIds = normalizeIdArray(existing.inputAssetIds, 0, 32);
            if (!inputAssetIds) return null;
            const candidateRecord = { ...existing };
            delete candidateRecord.unsupportedRecipeVersion;
            delete candidateRecord.readOnlyPrompt;
            const normalized = normalizeShowcaseCase({
                ...candidateRecord,
                inputAssetIds: inputAssetIds.slice(0, 16)
            });
            const readOnlyPrompt = normalizeShowcaseReadOnlyPrompt(existing.readOnlyPrompt);
            return normalized
                ? {
                      ...normalized,
                      inputAssetIds,
                      unsupportedRecipeVersion: markedVersion,
                      ...(readOnlyPrompt ? { readOnlyPrompt } : {})
                  }
                : null;
        }
    }
    const supported = normalizeShowcaseCase(value);
    if (supported) return supported;

    const record = asStrictRecord(value, CASE_KEYS);
    if (!record) return null;
    const markedVersion = normalizeInteger(record.unsupportedRecipeVersion, 2, Number.MAX_SAFE_INTEGER);
    const recipeVersion = peekShowcaseRecipeVersion(record.recipe);
    const unsupportedVersion = markedVersion ?? recipeVersion;
    if (!unsupportedVersion || unsupportedVersion <= 1) return null;
    if (markedVersion && recipeVersion && recipeVersion > 1 && markedVersion !== recipeVersion) return null;

    const readOnlyPrompt =
        record.readOnlyPrompt === undefined
            ? typeof record.recipe === 'object' && record.recipe !== null && !Array.isArray(record.recipe)
                ? normalizeShowcaseReadOnlyPrompt((record.recipe as Record<string, unknown>).prompt)
                : null
            : normalizeShowcaseReadOnlyPrompt(record.readOnlyPrompt);

    const inputAssetIds = normalizeIdArray(record.inputAssetIds, 0, 32);
    if (!inputAssetIds) return null;
    const taskMode = 'image-generate';
    const fallbackRecipe: ShowcaseRecipeV1 = {
        version: 1,
        taskMode,
        promptStrategy: 'replace',
        prompt: {
            'zh-CN': '此案例使用较新的配方版本，请升级客户端后再载入工作台。',
            'en-US': 'This case uses a newer recipe version. Upgrade the client before loading it into the workbench.'
        },
        inputSlots: [],
        capabilityRequirements: {
            supportedTaskModes: [taskMode]
        }
    };
    const candidateRecord = { ...record };
    delete candidateRecord.unsupportedRecipeVersion;
    delete candidateRecord.readOnlyPrompt;
    const normalized = normalizeShowcaseCase({
        ...candidateRecord,
        inputAssetIds: inputAssetIds.slice(0, 16),
        recipe: fallbackRecipe
    });
    return normalized
        ? {
              ...normalized,
              inputAssetIds,
              unsupportedRecipeVersion: unsupportedVersion,
              ...(readOnlyPrompt ? { readOnlyPrompt } : {})
          }
        : null;
}

export function isExecutableShowcaseCase(showcaseCase: ShowcaseCase): boolean {
    return showcaseCase.unsupportedRecipeVersion === undefined;
}

export function normalizeShowcaseTopic(
    value: unknown,
    options: { allowExtendedTopicMetadata?: boolean } = {}
): ShowcaseTopic | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const raw = value as UnknownRecord;
    if (
        !options.allowExtendedTopicMetadata &&
        (Object.hasOwn(raw, 'categories') || Object.hasOwn(raw, 'publishedAt'))
    ) {
        return null;
    }
    const record = asStrictRecord(value, TOPIC_KEYS);
    if (!record || typeof record.featured !== 'boolean') return null;

    const id = normalizeIdentifier(record.id);
    const slug = normalizeIdentifier(record.slug);
    const title = normalizeLocalizedText(record.title, 160);
    const summary = normalizeLocalizedText(record.summary, 1_000);
    const preparation = normalizeLocalizedText(record.preparation, 2_000);
    const limitations = normalizeLocalizedText(record.limitations, 2_000);
    const capabilities =
        record.capabilities === undefined ? undefined : normalizeLocalizedText(record.capabilities, 2_000);
    const suitableFor =
        record.suitableFor === undefined ? undefined : normalizeLocalizedText(record.suitableFor, 2_000);
    const unsuitableFor =
        record.unsuitableFor === undefined ? undefined : normalizeLocalizedText(record.unsuitableFor, 2_000);
    const recommendedInputQuality =
        record.recommendedInputQuality === undefined
            ? undefined
            : normalizeLocalizedText(record.recommendedInputQuality, 2_000);
    const sortOrder = normalizeInteger(record.sortOrder, 0, 1_000_000);
    const coverAssetId = normalizeIdentifier(record.coverAssetId);
    const caseIds = normalizeIdArray(record.caseIds, 1, 128);
    const rawTags = asStrictArray(record.tags);
    const rawCategories = record.categories === undefined ? undefined : asStrictArray(record.categories);
    const publishedAt =
        record.publishedAt === undefined ? undefined : normalizeInteger(record.publishedAt, 1, Number.MAX_SAFE_INTEGER);
    if (
        !id ||
        !slug ||
        !title ||
        !summary ||
        !preparation ||
        !limitations ||
        (record.capabilities !== undefined && !capabilities) ||
        (record.suitableFor !== undefined && !suitableFor) ||
        (record.unsuitableFor !== undefined && !unsuitableFor) ||
        (record.recommendedInputQuality !== undefined && !recommendedInputQuality) ||
        sortOrder === null ||
        !coverAssetId ||
        !caseIds ||
        !rawTags ||
        rawTags.length === 0 ||
        rawTags.length > 16 ||
        (record.categories !== undefined && (!rawCategories || rawCategories.length === 0 || rawCategories.length > 12)) ||
        (record.publishedAt !== undefined && publishedAt === null)
    ) {
        return null;
    }

    const tags: ShowcaseLocalizedText[] = [];
    const tagKeys = new Set<string>();
    for (const rawTag of rawTags) {
        const tag = normalizeLocalizedText(rawTag, 80);
        if (!tag) return null;
        const tagKey = `${tag['zh-CN']}\0${tag['en-US']}`.toLocaleLowerCase();
        if (tagKeys.has(tagKey)) return null;
        tagKeys.add(tagKey);
        tags.push(tag);
    }

    let categories: ShowcaseLocalizedText[] | undefined;
    if (rawCategories) {
        categories = [];
        const categoryKeys = new Set<string>();
        for (const rawCategory of rawCategories) {
            const category = normalizeLocalizedText(rawCategory, 80);
            if (!category) return null;
            const categoryKey = `${category['zh-CN']}\0${category['en-US']}`.toLocaleLowerCase();
            if (categoryKeys.has(categoryKey)) return null;
            categoryKeys.add(categoryKey);
            categories.push(category);
        }
    }

    let faq: ShowcaseFaqItem[] | undefined;
    if (record.faq !== undefined) {
        const rawFaq = asStrictArray(record.faq);
        if (!rawFaq || rawFaq.length > 20) return null;
        faq = [];
        for (const rawItem of rawFaq) {
            const faqRecord = asStrictRecord(rawItem, FAQ_KEYS);
            if (!faqRecord) return null;
            const question = normalizeLocalizedText(faqRecord.question, 500);
            const answer = normalizeLocalizedText(faqRecord.answer, 2_000);
            if (!question || !answer) return null;
            faq.push({ question, answer });
        }
    }

    const relatedTopicIds =
        record.relatedTopicIds === undefined ? undefined : normalizeIdArray(record.relatedTopicIds, 0, 16);
    if (record.relatedTopicIds !== undefined && !relatedTopicIds) return null;

    return {
        id,
        slug,
        title,
        summary,
        preparation,
        limitations,
        ...(capabilities ? { capabilities } : {}),
        ...(suitableFor ? { suitableFor } : {}),
        ...(unsuitableFor ? { unsuitableFor } : {}),
        ...(recommendedInputQuality ? { recommendedInputQuality } : {}),
        ...(faq ? { faq } : {}),
        ...(relatedTopicIds ? { relatedTopicIds } : {}),
        tags,
        ...(categories ? { categories } : {}),
        ...(publishedAt !== undefined && publishedAt !== null ? { publishedAt } : {}),
        featured: record.featured,
        sortOrder,
        coverAssetId,
        caseIds
    };
}

function normalizeCollection<T>(
    value: unknown,
    normalizeItem: (item: unknown) => T | null,
    maximumItems: number
): T[] | null {
    const source = asStrictArray(value);
    if (!source || source.length > maximumItems) return null;

    const result: T[] = [];
    for (const item of source) {
        const normalized = normalizeItem(item);
        if (!normalized) return null;
        result.push(normalized);
    }
    return result;
}

function peekShowcaseCaseId(value: unknown): string | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const record = value as UnknownRecord;
    if (Object.keys(record).some((key) => DANGEROUS_KEYS.has(key))) return null;
    return normalizeIdentifier(record.id);
}

function normalizeShowcaseCasesForDisplay(
    value: unknown
): { cases: ShowcaseCase[]; skippedFutureCaseIds: Set<string> } | null {
    const source = asStrictArray(value);
    if (!source || source.length > 4_096) return null;

    const cases: ShowcaseCase[] = [];
    const skippedFutureCaseIds = new Set<string>();
    const sourceIds = new Set<string>();
    for (const item of source) {
        const caseId = peekShowcaseCaseId(item);
        if (!caseId || sourceIds.has(caseId)) return null;
        sourceIds.add(caseId);

        const supported = normalizeShowcaseCase(item);
        if (supported) {
            cases.push(supported);
            continue;
        }
        const version =
            typeof item === 'object' && item !== null && !Array.isArray(item)
                ? (normalizeInteger((item as UnknownRecord).unsupportedRecipeVersion, 2, Number.MAX_SAFE_INTEGER) ??
                  peekShowcaseRecipeVersion((item as UnknownRecord).recipe))
                : null;
        if (!version || version <= SHOWCASE_RECIPE_VERSION) return null;
        const displayCase = normalizeShowcaseCaseForDisplay(item);
        if (displayCase) cases.push(displayCase);
        else skippedFutureCaseIds.add(caseId);
    }
    return { cases, skippedFutureCaseIds };
}

function hasDuplicate<T>(items: T[], getValue: (item: T) => string): boolean {
    const seen = new Set<string>();
    for (const item of items) {
        const value = getValue(item);
        if (seen.has(value)) return true;
        seen.add(value);
    }
    return false;
}

export function normalizeShowcaseCatalog(
    value: unknown,
    options: NormalizeShowcaseCatalogOptions = {}
): ShowcaseCatalog | null {
    const record = asStrictRecord(value, CATALOG_KEYS);
    if (!record) return null;

    const schemaVersion = record.schemaVersion ?? SHOWCASE_CATALOG_SCHEMA_VERSION;
    if (schemaVersion !== SHOWCASE_CATALOG_SCHEMA_VERSION) return null;

    const catalogRevision = normalizeDisplayText(record.catalogRevision, 128);
    const generatedAt = normalizeInteger(record.generatedAt, 1, Number.MAX_SAFE_INTEGER);
    const contentNotice = normalizeLocalizedText(record.contentNotice, 1_000);
    const rawTopics = normalizeCollection(
        record.topics,
        (topic) =>
            normalizeShowcaseTopic(topic, { allowExtendedTopicMetadata: options.allowExtendedTopicMetadata }),
        256
    );
    const displayCases = options.allowUnsupportedRecipeVersions ? normalizeShowcaseCasesForDisplay(record.cases) : null;
    const cases = options.allowUnsupportedRecipeVersions
        ? (displayCases?.cases ?? null)
        : normalizeCollection(record.cases, normalizeShowcaseCase, 4_096);
    const assets = normalizeCollection(record.assets, normalizeShowcaseAsset, 16_384);
    if (
        !catalogRevision ||
        !REVISION_PATTERN.test(catalogRevision) ||
        generatedAt === null ||
        !contentNotice ||
        !rawTopics ||
        !cases ||
        !assets
    ) {
        return null;
    }

    const skippedFutureCaseIds = displayCases?.skippedFutureCaseIds ?? new Set<string>();
    const topics = rawTopics
        .map((topic) => ({
            ...topic,
            caseIds: topic.caseIds.filter((caseId) => !skippedFutureCaseIds.has(caseId))
        }))
        .filter((topic) => topic.caseIds.length > 0);
    const retainedTopicIds = new Set(topics.map((topic) => topic.id));
    const retainedCases = cases.filter((showcaseCase) => retainedTopicIds.has(showcaseCase.topicId));

    if (
        hasDuplicate(topics, (topic) => topic.id) ||
        hasDuplicate(topics, (topic) => topic.slug) ||
        hasDuplicate(retainedCases, (showcaseCase) => showcaseCase.id) ||
        hasDuplicate(assets, (asset) => asset.id)
    ) {
        return null;
    }

    const topicById = new Map(topics.map((topic) => [topic.id, topic]));
    const caseById = new Map(retainedCases.map((showcaseCase) => [showcaseCase.id, showcaseCase]));
    const assetIds = new Set(assets.map((asset) => asset.id));
    const ownedCaseIds = new Set<string>();

    for (const topic of topics) {
        if (!assetIds.has(topic.coverAssetId)) return null;
        if (
            topic.relatedTopicIds?.some(
                (id) => id === topic.id || (!options.allowDanglingRelatedTopicIds && !topicById.has(id))
            )
        ) {
            return null;
        }
        const caseSlugs = new Set<string>();
        for (const caseId of topic.caseIds) {
            const showcaseCase = caseById.get(caseId);
            if (!showcaseCase || showcaseCase.topicId !== topic.id || ownedCaseIds.has(caseId)) return null;
            if (caseSlugs.has(showcaseCase.slug)) return null;
            caseSlugs.add(showcaseCase.slug);
            ownedCaseIds.add(caseId);
        }
    }

    for (const showcaseCase of retainedCases) {
        if (!topicById.has(showcaseCase.topicId) || !ownedCaseIds.has(showcaseCase.id)) return null;
        const referencedAssetIds = [
            showcaseCase.coverAssetId,
            ...showcaseCase.inputAssetIds,
            ...showcaseCase.outputAssetIds
        ];
        if (referencedAssetIds.some((assetId) => !assetIds.has(assetId))) return null;
    }

    return {
        schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
        catalogRevision,
        generatedAt,
        contentNotice,
        topics: [...topics].sort((left, right) => left.sortOrder - right.sortOrder),
        cases: [...retainedCases].sort((left, right) => left.sortOrder - right.sortOrder),
        assets
    };
}
