import { generateId } from '@/lib/id';
import type {
    InspirationSite,
    InspirationSiteCategory,
    InspirationSiteOpenMode,
    InspirationSitesState
} from '@/types/inspiration-sites';

const INSPIRATION_SITES_STORAGE_KEY = 'gpt-image-playground-inspiration-sites-v1';

export const INSPIRATION_SITES_CHANGED_EVENT = 'inspiration-sites-changed';

export const DEFAULT_INSPIRATION_CATEGORIES: InspirationSiteCategory[] = [
    { id: 'cn-design', builtIn: true, labelKey: 'inspiration.category.cnDesign', order: 10, enabled: true },
    { id: 'design', builtIn: true, labelKey: 'inspiration.category.design', order: 20, enabled: true },
    { id: 'illustration', builtIn: true, labelKey: 'inspiration.category.illustration', order: 30, enabled: true },
    { id: 'ui-web', builtIn: true, labelKey: 'inspiration.category.uiWeb', order: 40, enabled: true },
    { id: 'three-d', builtIn: true, labelKey: 'inspiration.category.threeD', order: 50, enabled: true },
    { id: 'color-type', builtIn: true, labelKey: 'inspiration.category.colorType', order: 60, enabled: true },
    { id: 'ai-reference', builtIn: true, labelKey: 'inspiration.category.aiReference', order: 70, enabled: true }
];

const nowSeed = 1_714_000_000_000;
const DEFAULT_INSPIRATION_SITE_OPEN_MODE: InspirationSiteOpenMode = 'external-browser';
const RETIRED_BUILT_IN_CATEGORY_IDS = new Set(['photo']);
const RETIRED_BUILT_IN_SITE_IDS = new Set(['unsplash', 'pexels', 'pixabay']);

export const DEFAULT_INSPIRATION_SITES: InspirationSite[] = [
    site(
        'image-2-gallery',
        'image-2 案例集',
        'https://img-gallery.anzz.site/',
        'ai-reference',
        ['ai', 'case'],
        0,
        'drawer'
    ),
    site('huaban', '花瓣', 'https://huaban.com/', 'cn-design', ['design', 'moodboard', 'cn'], 10),
    site('duitang', '堆糖', 'https://www.duitang.com/', 'cn-design', ['moodboard', 'design', 'cn'], 20),
    site('zcool', '站酷', 'https://www.zcool.com.cn/', 'cn-design', ['design', 'community', 'cn'], 30),
    site('ui-cn', 'UI 中国', 'https://www.ui.cn/', 'cn-design', ['ui', 'design', 'cn'], 40),
    site('js-design', '即时设计资源社区', 'https://js.design/community', 'cn-design', ['ui', 'resource', 'cn'], 50),
    site('mastergo', 'MasterGo 社区', 'https://mastergo.com/community', 'cn-design', ['ui', 'resource', 'cn'], 60),
    site('pinterest', 'Pinterest', 'https://www.pinterest.com/', 'design', ['moodboard'], 100),
    site('dribbble', 'Dribbble', 'https://dribbble.com/', 'design', ['ui', 'visual'], 110),
    site('behance', 'Behance', 'https://www.behance.net/', 'design', ['portfolio', 'visual'], 120),
    site('freepik', 'Freepik', 'https://www.freepik.com/', 'illustration', ['vector', 'illustration'], 200),
    site('undraw', 'unDraw', 'https://undraw.co/illustrations', 'illustration', ['illustration'], 210),
    site('noun-project', 'The Noun Project', 'https://thenounproject.com/', 'illustration', ['icon'], 220),
    site('awwwards', 'Awwwards', 'https://www.awwwards.com/', 'ui-web', ['web', 'award'], 300),
    site('mobbin', 'Mobbin', 'https://mobbin.com/', 'ui-web', ['mobile', 'ui'], 310),
    site('siteinspire', 'SiteInspire', 'https://www.siteinspire.com/', 'ui-web', ['web'], 320),
    site('figma-community', 'Figma Community', 'https://www.figma.com/community', 'ui-web', ['ui', 'resource'], 330),
    site('artstation', 'ArtStation', 'https://www.artstation.com/', 'three-d', ['concept', 'game'], 400),
    site('sketchfab', 'Sketchfab', 'https://sketchfab.com/', 'three-d', ['3d'], 410),
    site('blenderkit', 'BlenderKit', 'https://www.blenderkit.com/', 'three-d', ['3d', 'assets'], 420),
    site('coolors', 'Coolors', 'https://coolors.co/', 'color-type', ['color'], 500),
    site('adobe-color', 'Adobe Color', 'https://color.adobe.com/', 'color-type', ['color'], 510),
    site('google-fonts', 'Google Fonts', 'https://fonts.google.com/', 'color-type', ['font'], 520),
    site('openart', 'OpenArt', 'https://openart.ai/', 'ai-reference', ['ai'], 600),
    site('civitai', 'Civitai', 'https://civitai.com/', 'ai-reference', ['ai', 'model'], 610)
];

function site(
    id: string,
    title: string,
    url: string,
    categoryId: string,
    tags: string[],
    order: number,
    defaultOpenMode: InspirationSiteOpenMode = DEFAULT_INSPIRATION_SITE_OPEN_MODE
): InspirationSite {
    return {
        id,
        builtIn: true,
        title,
        url,
        categoryId,
        tags,
        defaultOpenMode,
        enabled: true,
        order,
        createdAt: nowSeed,
        updatedAt: nowSeed
    };
}

function dispatchInspirationSitesChanged(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(INSPIRATION_SITES_CHANGED_EVENT));
}

function normalizeTags(tags: unknown): string[] {
    if (!Array.isArray(tags)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const tag of tags) {
        if (typeof tag !== 'string') continue;
        const normalized = tag.trim().replace(/\s+/g, ' ');
        if (!normalized) continue;
        const key = normalized.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }
    return result;
}

export function validateInspirationUrl(value: string): string | null {
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:') return null;
        url.hash = url.hash;
        return url.toString();
    } catch {
        return null;
    }
}

function normalizeCategory(value: unknown): InspirationSiteCategory | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id.trim()) return null;
    return {
        id: record.id.trim(),
        builtIn: Boolean(record.builtIn),
        labelKey: typeof record.labelKey === 'string' ? record.labelKey : undefined,
        customName: typeof record.customName === 'string' ? record.customName.trim() : undefined,
        order: typeof record.order === 'number' ? record.order : 1000,
        enabled: record.enabled !== false
    };
}

function isRetiredBuiltInCategory(category: InspirationSiteCategory): boolean {
    return category.builtIn && RETIRED_BUILT_IN_CATEGORY_IDS.has(category.id);
}

function isRetiredBuiltInSite(site: InspirationSite): boolean {
    return site.builtIn && RETIRED_BUILT_IN_SITE_IDS.has(site.id);
}

function normalizeSite(value: unknown): InspirationSite | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id.trim()) return null;
    const id = record.id.trim();
    if (typeof record.title !== 'string' || !record.title.trim()) return null;
    if (typeof record.categoryId !== 'string' || !record.categoryId.trim()) return null;
    const safeUrl = typeof record.url === 'string' ? validateInspirationUrl(record.url) : null;
    if (!safeUrl) return null;

    const builtInDefaultOpenMode = DEFAULT_INSPIRATION_SITES.find((site) => site.id === id)?.defaultOpenMode;
    const fallbackOpenMode = Boolean(record.builtIn)
        ? (builtInDefaultOpenMode ?? DEFAULT_INSPIRATION_SITE_OPEN_MODE)
        : DEFAULT_INSPIRATION_SITE_OPEN_MODE;
    const rawDefaultOpenMode =
        record.defaultOpenMode === 'drawer' ||
        record.defaultOpenMode === 'new-tab' ||
        record.defaultOpenMode === 'external-browser'
            ? record.defaultOpenMode
            : fallbackOpenMode;
    const openModeUpdatedAt =
        typeof record.openModeUpdatedAt === 'number' && record.openModeUpdatedAt > 0
            ? record.openModeUpdatedAt
            : undefined;
    const defaultOpenMode = Boolean(record.builtIn) && !openModeUpdatedAt ? fallbackOpenMode : rawDefaultOpenMode;

    return {
        id,
        builtIn: Boolean(record.builtIn),
        title: record.title.trim(),
        url: safeUrl,
        categoryId: record.categoryId.trim(),
        tags: normalizeTags(record.tags),
        description: typeof record.description === 'string' ? record.description.trim() || undefined : undefined,
        descriptionKey: typeof record.descriptionKey === 'string' ? record.descriptionKey : undefined,
        defaultOpenMode,
        pinned: Boolean(record.pinned),
        enabled: record.enabled !== false,
        order: typeof record.order === 'number' ? record.order : 1000,
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
        lastOpenedAt: typeof record.lastOpenedAt === 'number' ? record.lastOpenedAt : undefined,
        openModeUpdatedAt
    };
}

function mergeById<T extends { id: string }>(defaults: T[], stored: T[]): T[] {
    const map = new Map<string, T>();
    for (const item of defaults) map.set(item.id, item);
    for (const item of stored) map.set(item.id, { ...map.get(item.id), ...item });
    return Array.from(map.values());
}

export function loadInspirationSitesState(): InspirationSitesState {
    if (typeof window === 'undefined') {
        return { categories: DEFAULT_INSPIRATION_CATEGORIES, sites: DEFAULT_INSPIRATION_SITES };
    }

    try {
        const stored = window.localStorage.getItem(INSPIRATION_SITES_STORAGE_KEY);
        if (!stored) {
            return { categories: DEFAULT_INSPIRATION_CATEGORIES, sites: DEFAULT_INSPIRATION_SITES };
        }

        const parsed: unknown = JSON.parse(stored);
        const record =
            typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : {};
        const categories = Array.isArray(record.categories)
            ? record.categories
                  .map(normalizeCategory)
                  .filter((item): item is InspirationSiteCategory => item !== null && !isRetiredBuiltInCategory(item))
            : [];
        const sites = Array.isArray(record.sites)
            ? record.sites
                  .map(normalizeSite)
                  .filter((item): item is InspirationSite => item !== null && !isRetiredBuiltInSite(item))
            : [];

        return {
            categories: mergeById(DEFAULT_INSPIRATION_CATEGORIES, categories).sort((a, b) => a.order - b.order),
            sites: mergeById(DEFAULT_INSPIRATION_SITES, sites).sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId);
                return a.order - b.order;
            })
        };
    } catch (error) {
        console.warn('Failed to load inspiration sites:', error);
        return { categories: DEFAULT_INSPIRATION_CATEGORIES, sites: DEFAULT_INSPIRATION_SITES };
    }
}

export function saveInspirationSitesState(state: InspirationSitesState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(INSPIRATION_SITES_STORAGE_KEY, JSON.stringify(state));
    dispatchInspirationSitesChanged();
}

function sortInspirationCategories(categories: InspirationSiteCategory[]): InspirationSiteCategory[] {
    return [...categories].sort((a, b) => a.order - b.order);
}

function sortInspirationSites(sites: InspirationSite[]): InspirationSite[] {
    return [...sites].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId);
        return a.order - b.order;
    });
}

export function importInspirationSitesState(
    value: unknown,
    currentState: InspirationSitesState = loadInspirationSitesState()
): InspirationSitesState | null {
    const record =
        typeof value === 'object' && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
    if (!record) return null;

    const categories = Array.isArray(record.categories)
        ? record.categories
              .map(normalizeCategory)
              .filter((item): item is InspirationSiteCategory => item !== null && !isRetiredBuiltInCategory(item))
        : [];
    const sites = Array.isArray(record.sites)
        ? record.sites
              .map(normalizeSite)
              .filter((item): item is InspirationSite => item !== null && !isRetiredBuiltInSite(item))
        : [];

    if (categories.length === 0 && sites.length === 0) return null;

    return {
        categories: sortInspirationCategories(mergeById(currentState.categories, categories)),
        sites: sortInspirationSites(mergeById(currentState.sites, sites))
    };
}

export function restoreDefaultInspirationSites(
    currentState: InspirationSitesState = loadInspirationSitesState()
): InspirationSitesState {
    const customCategories = currentState.categories.filter((category) => !category.builtIn);
    const customSites = currentState.sites.filter((site) => !site.builtIn);
    return {
        categories: sortInspirationCategories([...DEFAULT_INSPIRATION_CATEGORIES, ...customCategories]),
        sites: sortInspirationSites([...DEFAULT_INSPIRATION_SITES, ...customSites])
    };
}

export function createInspirationSite(input: {
    title: string;
    url: string;
    categoryId: string;
    tags?: string[];
    description?: string;
    defaultOpenMode?: InspirationSiteOpenMode;
}): InspirationSite | null {
    const safeUrl = validateInspirationUrl(input.url);
    if (!safeUrl || !input.title.trim()) return null;
    const now = Date.now();
    return {
        id: generateId('inspiration-site'),
        builtIn: false,
        title: input.title.trim(),
        url: safeUrl,
        categoryId: input.categoryId,
        tags: normalizeTags(input.tags ?? []),
        description: input.description?.trim() || undefined,
        defaultOpenMode: input.defaultOpenMode === 'drawer' ? 'drawer' : DEFAULT_INSPIRATION_SITE_OPEN_MODE,
        openModeUpdatedAt: now,
        enabled: true,
        order: now,
        createdAt: now,
        updatedAt: now
    };
}

export function createInspirationCategory(name: string, order: number): InspirationSiteCategory | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    return {
        id: generateId('inspiration-category'),
        builtIn: false,
        customName: trimmed,
        order,
        enabled: true
    };
}
