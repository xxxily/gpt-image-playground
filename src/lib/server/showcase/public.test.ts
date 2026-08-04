import { parseShowcasePublicationSnapshot, toPublicShowcaseWireCatalog } from './public';
import { DEFAULT_SHOWCASE_CATALOG } from '@/lib/default-showcases';
import { normalizeShowcaseCatalog, type ShowcaseCatalog, type ShowcaseRemoteAsset } from '@/lib/showcase';
import { describe, expect, it } from 'vitest';

const localized = (zhCN: string, enUS: string) => ({ 'zh-CN': zhCN, 'en-US': enUS });

function managedCatalog(): ShowcaseCatalog {
    const source = structuredClone(DEFAULT_SHOWCASE_CATALOG);
    const originalAsset = source.assets.find((asset) => asset.id === source.topics[0]?.coverAssetId)!;
    const managedAsset: ShowcaseRemoteAsset = {
        id: originalAsset.id,
        kind: 'remote-image',
        alt: localized('托管专题媒体', 'Managed showcase media'),
        url: '/api/showcase-media/media_0123456789abcdef0123456789abcdef',
        thumbnailUrl: '/api/showcase-media/media_0123456789abcdef0123456789abcdef?variant=thumbnail',
        managedAssetId: 'media_0123456789abcdef0123456789abcdef',
        mimeType: 'image/webp',
        width: 1200,
        height: 800
    };
    return { ...source, assets: source.assets.map((asset) => (asset.id === originalAsset.id ? managedAsset : asset)) };
}

describe('showcase public catalog wire format', () => {
    it('uses legacy-compatible absolute HTTPS media fields in public responses', () => {
        const catalog = managedCatalog();
        const wire = toPublicShowcaseWireCatalog(catalog, 'https://content.example');
        const asset = wire.assets.find((candidate) => candidate.id === catalog.topics[0]?.coverAssetId);

        expect(asset).toEqual({
            id: asset?.id,
            kind: 'remote-image',
            alt: localized('托管专题媒体', 'Managed showcase media'),
            url: 'https://content.example/api/showcase-media/media_0123456789abcdef0123456789abcdef',
            mimeType: 'image/webp',
            width: 1200,
            height: 800
        });
        expect(normalizeShowcaseCatalog(wire)).toEqual(wire);
        expect(wire.topics[0]).not.toHaveProperty('categories');
    });

    it('keeps an absolute managed thumbnail for the extended client contract', () => {
        const catalog = managedCatalog();
        const wire = toPublicShowcaseWireCatalog(catalog, 'https://content.example', {
            supportsExtendedCases: true
        });
        const asset = wire.assets.find((candidate) => candidate.id === catalog.topics[0]?.coverAssetId);

        expect(asset).toMatchObject({
            url: 'https://content.example/api/showcase-media/media_0123456789abcdef0123456789abcdef',
            thumbnailUrl:
                'https://content.example/api/showcase-media/media_0123456789abcdef0123456789abcdef?variant=thumbnail'
        });
        expect(
            normalizeShowcaseCatalog(wire, {
                allowUnsupportedRecipeVersions: true,
                allowExtendedTopicMetadata: true
            })
        ).toEqual(wire);
        expect(wire.topics[0]?.categories).toEqual(catalog.topics[0]?.categories);
    });

    it('keeps managed identifiers on local HTTP so the current client can validate relative URLs', () => {
        const wire = toPublicShowcaseWireCatalog(managedCatalog(), 'http://localhost:3000');
        const asset = wire.assets.find((candidate) => candidate.kind === 'remote-image') as ShowcaseRemoteAsset;

        expect(asset.managedAssetId).toBe('media_0123456789abcdef0123456789abcdef');
        expect(asset.thumbnailUrl).toBe('/api/showcase-media/media_0123456789abcdef0123456789abcdef?variant=thumbnail');
        expect(normalizeShowcaseCatalog(wire)).toEqual(wire);
    });

    it('keeps a future recipe case read-only without dropping valid siblings from one publication', () => {
        const source = structuredClone(DEFAULT_SHOWCASE_CATALOG);
        const topic = source.topics[0]!;
        const cases = source.cases.filter((candidate) => topic.caseIds.includes(candidate.id));
        const futureCase = {
            ...cases[0]!,
            recipe: {
                version: 2,
                prompt: localized('未来版本提示词', 'Future-version prompt'),
                unsafeAction: 'must-not-run'
            }
        };
        const snapshot = JSON.stringify({ topic, cases: [futureCase, ...cases.slice(1)], assets: source.assets });

        const parsed = parseShowcasePublicationSnapshot(snapshot);

        expect(parsed?.cases).toHaveLength(cases.length);
        expect(parsed?.cases[0]).toMatchObject({
            id: futureCase.id,
            unsupportedRecipeVersion: 2,
            readOnlyPrompt: localized('未来版本提示词', 'Future-version prompt')
        });
        expect(JSON.stringify(parsed?.cases[0])).not.toContain('unsafeAction');
        expect(parsed?.cases.slice(1).every((candidate) => candidate.unsupportedRecipeVersion === undefined)).toBe(
            true
        );

        const publicWire = toPublicShowcaseWireCatalog(
            {
                ...source,
                topics: [topic],
                cases: parsed!.cases,
                assets: parsed!.assets
            },
            'https://content.example'
        );
        expect(publicWire.cases.some((candidate) => candidate.id === futureCase.id)).toBe(false);
        expect(publicWire.topics[0]?.caseIds).not.toContain(futureCase.id);
        expect(JSON.stringify(publicWire)).not.toContain('unsupportedRecipeVersion');
        expect(JSON.stringify(publicWire)).not.toContain('readOnlyPrompt');

        const extendedWire = toPublicShowcaseWireCatalog(
            {
                ...source,
                topics: [topic],
                cases: parsed!.cases,
                assets: parsed!.assets
            },
            'https://content.example',
            { supportsExtendedCases: true }
        );
        expect(extendedWire.cases.find((candidate) => candidate.id === futureCase.id)).toMatchObject({
            unsupportedRecipeVersion: 2
        });
    });
});
