import type { ShowcaseTopicDraft } from './types';
import { SHOWCASE_CATALOG_SCHEMA_VERSION, normalizeShowcaseCatalog } from '@/lib/showcase';
import type { ShowcaseCatalog } from '@/lib/showcase';

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;

export const DEFAULT_SHOWCASE_CONTENT_NOTICE = {
    'zh-CN': '专题案例用于演示可复现的创作流程。生成结果会因模型、输入图片和用户调整而变化。',
    'en-US':
        'Showcase cases demonstrate reproducible creative workflows. Results vary by model, input images, and user adjustments.'
} as const;

export function normalizeShowcaseIdentifier(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return IDENTIFIER_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeShowcaseTopicDraft(value: unknown): ShowcaseTopicDraft | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some((key) => !['topic', 'cases', 'assets'].includes(key))) return null;

    const generatedAt = Date.now();
    const candidate = normalizeShowcaseCatalog(
        {
            schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
            catalogRevision: `draft-${generatedAt}`,
            generatedAt,
            contentNotice: DEFAULT_SHOWCASE_CONTENT_NOTICE,
            topics: record.topic ? [record.topic] : [],
            cases: record.cases,
            assets: record.assets
        },
        { allowDanglingRelatedTopicIds: true, allowExtendedTopicMetadata: true }
    );
    if (!candidate || candidate.topics.length !== 1) return null;

    const topic = candidate.topics[0];
    if (!topic || candidate.cases.some((showcaseCase) => showcaseCase.topicId !== topic.id)) return null;
    return { topic, cases: candidate.cases, assets: candidate.assets };
}

export function buildCatalogFromTopicDraft(
    draft: ShowcaseTopicDraft,
    catalogRevision: string,
    generatedAt = Date.now()
): ShowcaseCatalog {
    const catalog = normalizeShowcaseCatalog(
        {
            schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
            catalogRevision,
            generatedAt,
            contentNotice: DEFAULT_SHOWCASE_CONTENT_NOTICE,
            topics: [draft.topic],
            cases: draft.cases,
            assets: draft.assets
        },
        { allowDanglingRelatedTopicIds: true, allowExtendedTopicMetadata: true }
    );
    if (!catalog) throw new Error('专题草稿不完整或包含不安全内容。');
    return catalog;
}
