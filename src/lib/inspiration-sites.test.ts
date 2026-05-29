import {
    DEFAULT_INSPIRATION_CATEGORIES,
    DEFAULT_INSPIRATION_SITES,
    loadInspirationSitesState,
    saveInspirationSitesState
} from './inspiration-sites';
import type { InspirationSite, InspirationSiteCategory, InspirationSitesState } from '@/types/inspiration-sites';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createLocalStorageMock() {
    const data = new Map<string, string>();
    return {
        getItem: vi.fn((key: string) => data.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            data.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
            data.delete(key);
        }),
        clear: vi.fn(() => {
            data.clear();
        })
    };
}

function makeCategory(overrides: Partial<InspirationSiteCategory> = {}): InspirationSiteCategory {
    return {
        id: 'custom-category',
        builtIn: false,
        customName: 'Custom category',
        order: 1000,
        enabled: true,
        ...overrides
    };
}

function makeSite(overrides: Partial<InspirationSite> = {}): InspirationSite {
    return {
        id: 'custom-site',
        builtIn: false,
        title: 'Custom Site',
        url: 'https://example.com/',
        categoryId: 'custom-category',
        tags: ['custom'],
        defaultOpenMode: 'drawer',
        enabled: true,
        order: 1000,
        createdAt: 1,
        updatedAt: 1,
        ...overrides
    };
}

class TestCustomEvent {
    type: string;

    constructor(type: string) {
        this.type = type;
    }
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('inspiration sites defaults', () => {
    it('prioritizes design communities and excludes photography-first defaults', () => {
        const categoryIds = DEFAULT_INSPIRATION_CATEGORIES.map((category) => category.id);
        const siteIds = DEFAULT_INSPIRATION_SITES.map((site) => site.id);

        expect(categoryIds).toContain('cn-design');
        expect(categoryIds).not.toContain('photo');
        expect(siteIds).toEqual(
            expect.arrayContaining(['huaban', 'duitang', 'zcool', 'pinterest', 'dribbble', 'behance'])
        );
        expect(siteIds).not.toContain('unsplash');
        expect(siteIds).not.toContain('pexels');
        expect(siteIds).not.toContain('pixabay');
    });

    it('drops retired built-in photography sites from stored state', () => {
        const localStorage = createLocalStorageMock();
        vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() });
        vi.stubGlobal('CustomEvent', TestCustomEvent);

        const storedState: InspirationSitesState = {
            categories: [
                makeCategory({ id: 'photo', builtIn: true, labelKey: 'inspiration.category.photo', order: 20 }),
                makeCategory()
            ],
            sites: [
                makeSite({
                    id: 'unsplash',
                    builtIn: true,
                    title: 'Unsplash',
                    url: 'https://unsplash.com/',
                    categoryId: 'photo'
                }),
                makeSite()
            ]
        };

        saveInspirationSitesState(storedState);

        const loaded = loadInspirationSitesState();
        expect(loaded.categories.some((category) => category.id === 'photo')).toBe(false);
        expect(loaded.sites.some((site) => site.id === 'unsplash')).toBe(false);
        expect(loaded.categories.some((category) => category.id === 'custom-category')).toBe(true);
        expect(loaded.sites.some((site) => site.id === 'custom-site')).toBe(true);
    });
});
