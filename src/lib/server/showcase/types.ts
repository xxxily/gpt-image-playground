import type { ShowcaseAsset, ShowcaseCase, ShowcaseCatalog, ShowcaseTopic } from '@/lib/showcase';

export type ShowcaseTopicDraft = {
    topic: ShowcaseTopic;
    cases: ShowcaseCase[];
    assets: ShowcaseAsset[];
};

export type ShowcaseAdminActor = {
    userId: string;
    email: string;
    role: string;
    request: Request;
};

export type ShowcaseTopicWriteInput = {
    draft: unknown;
    startsAt?: Date | null;
    endsAt?: Date | null;
};

export type ShowcaseAdminTopic = {
    id: string;
    slug: string;
    status: 'draft' | 'scheduled' | 'published' | 'unpublished' | 'archived';
    featured: boolean;
    sortOrder: number;
    startsAt: number | null;
    endsAt: number | null;
    draftRevision: number;
    publishedPublicationId: string | null;
    publishedAt: number | null;
    archivedAt: number | null;
    createdAt: number;
    updatedAt: number;
    draft: ShowcaseTopicDraft;
};

export type ShowcasePublicationSummary = {
    id: string;
    topicId: string;
    revision: number;
    schemaVersion: number;
    catalogRevision: string;
    contentHash: string;
    sourcePublicationId: string | null;
    publishedAt: number;
    active: boolean;
};

export type ShowcasePublicCatalogResult = {
    catalog: ShowcaseCatalog;
    source: 'published' | 'builtin';
    etag: string;
};
