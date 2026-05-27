export type InspirationSiteOpenMode = 'drawer' | 'new-tab' | 'external-browser';

export type InspirationSiteCategory = {
    id: string;
    builtIn: boolean;
    labelKey?: string;
    customName?: string;
    order: number;
    enabled: boolean;
};

export type InspirationSite = {
    id: string;
    builtIn: boolean;
    title: string;
    url: string;
    categoryId: string;
    tags: string[];
    description?: string;
    descriptionKey?: string;
    defaultOpenMode: InspirationSiteOpenMode;
    pinned?: boolean;
    enabled: boolean;
    order: number;
    createdAt: number;
    updatedAt: number;
    lastOpenedAt?: number;
};

export type InspirationSitesState = {
    categories: InspirationSiteCategory[];
    sites: InspirationSite[];
};

