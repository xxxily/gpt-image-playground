import { DEFAULT_SHOWCASE_CATALOG } from './default-showcases';
import { normalizeShowcaseCatalog } from './showcase';
import type { ShowcaseLocalizedText } from './showcase';
import { GPT_IMAGE_2_SIZE_PRESETS } from './size-utils';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function expectCompleteLocalization(value: ShowcaseLocalizedText): void {
    expect(value['zh-CN'].trim()).not.toBe('');
    expect(value['en-US'].trim()).not.toBe('');
}

describe('DEFAULT_SHOWCASE_CATALOG', () => {
    it('is a valid normalized v1 catalog with six topics and twenty-four cases', () => {
        const normalized = normalizeShowcaseCatalog(DEFAULT_SHOWCASE_CATALOG, { allowExtendedTopicMetadata: true });

        expect(normalized).toEqual(DEFAULT_SHOWCASE_CATALOG);
        expect(DEFAULT_SHOWCASE_CATALOG.schemaVersion).toBe(1);
        expect(DEFAULT_SHOWCASE_CATALOG.topics).toHaveLength(6);
        expect(DEFAULT_SHOWCASE_CATALOG.cases.length).toBeGreaterThanOrEqual(24);
        expect(DEFAULT_SHOWCASE_CATALOG.topics.every((topic) => topic.caseIds.length >= 3)).toBe(true);
    });

    it('includes the required launch topics and exactly four cases per topic', () => {
        const topicIds = DEFAULT_SHOWCASE_CATALOG.topics.map((topic) => topic.id);

        expect(topicIds).toEqual(
            expect.arrayContaining(['old-photo-restoration', 'virtual-try-on', 'creative-stylization'])
        );
        expect(DEFAULT_SHOWCASE_CATALOG.topics.every((topic) => topic.caseIds.length === 4)).toBe(true);
    });

    it('provides complete Chinese and English copy for topics, cases, recipes, slots, and assets', () => {
        expectCompleteLocalization(DEFAULT_SHOWCASE_CATALOG.contentNotice);

        for (const topic of DEFAULT_SHOWCASE_CATALOG.topics) {
            expectCompleteLocalization(topic.title);
            expectCompleteLocalization(topic.summary);
            expectCompleteLocalization(topic.preparation);
            expectCompleteLocalization(topic.limitations);
            expect(topic.tags.length).toBeGreaterThan(0);
            topic.tags.forEach(expectCompleteLocalization);
            expect(topic.categories?.length).toBeGreaterThan(0);
            topic.categories?.forEach(expectCompleteLocalization);
        }

        for (const showcaseCase of DEFAULT_SHOWCASE_CATALOG.cases) {
            expectCompleteLocalization(showcaseCase.title);
            expectCompleteLocalization(showcaseCase.summary);
            expectCompleteLocalization(showcaseCase.resultExplanation);
            expectCompleteLocalization(showcaseCase.inputGuidance);
            expectCompleteLocalization(showcaseCase.cautions);
            expectCompleteLocalization(showcaseCase.recipe.prompt);
            for (const slot of showcaseCase.recipe.inputSlots) {
                expectCompleteLocalization(slot.label);
                expectCompleteLocalization(slot.description);
            }
        }

        for (const asset of DEFAULT_SHOWCASE_CATALOG.assets) {
            expectCompleteLocalization(asset.alt);
            if (asset.kind === 'placeholder') expectCompleteLocalization(asset.placeholder.label);
        }
    });

    it('keeps every topic, case, recipe, and asset reference complete', () => {
        const topicById = new Map(DEFAULT_SHOWCASE_CATALOG.topics.map((topic) => [topic.id, topic]));
        const caseById = new Map(DEFAULT_SHOWCASE_CATALOG.cases.map((showcaseCase) => [showcaseCase.id, showcaseCase]));
        const assetIds = new Set(DEFAULT_SHOWCASE_CATALOG.assets.map((asset) => asset.id));

        expect(topicById.size).toBe(DEFAULT_SHOWCASE_CATALOG.topics.length);
        expect(caseById.size).toBe(DEFAULT_SHOWCASE_CATALOG.cases.length);
        expect(assetIds.size).toBe(DEFAULT_SHOWCASE_CATALOG.assets.length);

        for (const topic of DEFAULT_SHOWCASE_CATALOG.topics) {
            expect(assetIds.has(topic.coverAssetId)).toBe(true);
            for (const caseId of topic.caseIds) {
                expect(caseById.get(caseId)?.topicId).toBe(topic.id);
            }
        }

        for (const showcaseCase of DEFAULT_SHOWCASE_CATALOG.cases) {
            expect(topicById.has(showcaseCase.topicId)).toBe(true);
            expect(assetIds.has(showcaseCase.coverAssetId)).toBe(true);
            expect(showcaseCase.inputAssetIds.every((assetId) => assetIds.has(assetId))).toBe(true);
            expect(showcaseCase.outputAssetIds.every((assetId) => assetIds.has(assetId))).toBe(true);
        }
    });

    it('covers both single-image and multi-image guided recipes', () => {
        const slotCounts = DEFAULT_SHOWCASE_CATALOG.cases.map((showcaseCase) => showcaseCase.recipe.inputSlots.length);

        expect(slotCounts.some((count) => count === 1)).toBe(true);
        expect(slotCounts.some((count) => count >= 2)).toBe(true);
        expect(
            DEFAULT_SHOWCASE_CATALOG.cases.some((showcaseCase) =>
                showcaseCase.recipe.inputSlots.some((slot) => slot.required === false)
            )
        ).toBe(true);
    });

    it('uses only supported GPT Image 2 size presets in built-in recipes', () => {
        const supportedSizes = new Set(GPT_IMAGE_2_SIZE_PRESETS.map((preset) => preset.value));

        for (const showcaseCase of DEFAULT_SHOWCASE_CATALOG.cases) {
            const size = showcaseCase.recipe.output?.size;
            expect(size === undefined || size === 'auto' || supportedSizes.has(size)).toBe(true);
        }
    });

    it('uses bounded built-in WebP media and never embeds credentials, local paths, bytes, or auto-submit state', () => {
        const serialized = JSON.stringify(DEFAULT_SHOWCASE_CATALOG);

        expect(DEFAULT_SHOWCASE_CATALOG.assets).toHaveLength(62);
        expect(DEFAULT_SHOWCASE_CATALOG.assets.every((asset) => asset.kind === 'remote-image')).toBe(true);
        expect(DEFAULT_SHOWCASE_CATALOG.contentNotice['zh-CN']).toContain('AI 生成示意素材');
        expect(DEFAULT_SHOWCASE_CATALOG.contentNotice['en-US']).toContain('AI-generated illustrative launch assets');
        for (const asset of DEFAULT_SHOWCASE_CATALOG.assets) {
            expect(asset.kind).toBe('remote-image');
            if (asset.kind !== 'remote-image') continue;
            expect(asset.url).toMatch(/^\/showcases\/builtin\/[a-z0-9-]+\.webp$/u);
            expect(asset.thumbnailUrl).toMatch(/^\/showcases\/builtin\/[a-z0-9-]+-thumb\.webp$/u);
            expect(asset.mimeType).toBe('image/webp');
            expect(asset.width).toBeGreaterThan(0);
            expect(asset.height).toBeGreaterThan(0);
        }
        expect(DEFAULT_SHOWCASE_CATALOG.topics.every((topic) => topic.coverAssetId.endsWith('-cover'))).toBe(true);

        expect(serialized).not.toMatch(
            /autostart|autoSubmit|apiKey|baseUrl|providerConfig|accessToken|secret|password/iu
        );
        expect(serialized).not.toMatch(/(?:file|blob|data):|base64|https?:\/\//iu);
        expect(serialized).not.toMatch(/\/(?:Users|home|private|tmp|var|etc)\/|[a-z]:[\\/]/iu);
    });

    it('ships every built-in catalog image and thumbnail referenced by the wire contract', () => {
        for (const asset of DEFAULT_SHOWCASE_CATALOG.assets) {
            expect(asset.kind).toBe('remote-image');
            if (asset.kind !== 'remote-image') continue;

            expect(existsSync(resolve(process.cwd(), 'public', asset.url.slice(1)))).toBe(true);
            expect(asset.thumbnailUrl).toBeDefined();
            if (!asset.thumbnailUrl) continue;
            expect(existsSync(resolve(process.cwd(), 'public', asset.thumbnailUrl.slice(1)))).toBe(true);
        }
    });
});
