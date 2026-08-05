import {
    isExecutableShowcaseCase,
    normalizeShowcaseAsset,
    normalizeShowcaseAttribution,
    normalizeShowcaseCase,
    normalizeShowcaseCatalog,
    normalizeShowcaseTopic,
    SHOWCASE_CATALOG_SCHEMA_VERSION
} from './showcase';
import type { ShowcaseAsset, ShowcaseCatalog, ShowcaseExecutableCase, ShowcaseTopic } from './showcase';
import type { ShowcaseRecipeV1 } from './showcase-recipe';
import { describe, expect, it } from 'vitest';

const localized = (zhCN: string, enUS: string) => ({ 'zh-CN': zhCN, 'en-US': enUS });

function recipe(): ShowcaseRecipeV1 {
    return {
        version: 1,
        taskMode: 'image-edit',
        promptStrategy: 'replace',
        prompt: localized('保留主体，清理背景。', 'Preserve the subject and clean the background.'),
        inputSlots: [
            {
                id: 'target',
                label: localized('主体', 'Subject'),
                description: localized('上传一张主体图片。', 'Upload one subject image.'),
                role: 'target',
                required: true,
                minCount: 1,
                maxCount: 1,
                workbenchOrder: 0,
                acceptedMimeTypes: ['image/*']
            }
        ],
        capabilityRequirements: {
            supportsEditing: true,
            minReferenceImages: 1,
            supportedTaskModes: ['image-edit']
        }
    };
}

function placeholderAsset(id: string): ShowcaseAsset {
    return {
        id,
        kind: 'placeholder',
        alt: localized(`${id} 示例占位预览`, `${id} sample placeholder preview`),
        placeholder: {
            label: localized('示例占位', 'Sample placeholder'),
            backgroundColor: '#E5E7EB',
            foregroundColor: '#334155'
        }
    };
}

function showcaseCase(overrides: Partial<ShowcaseExecutableCase> = {}): ShowcaseExecutableCase {
    return {
        id: 'case-one',
        topicId: 'topic-one',
        slug: 'case-one',
        title: localized('案例一', 'Case One'),
        summary: localized('一个可复现的示例案例。', 'A reproducible sample case.'),
        resultExplanation: localized('输出仅为示例占位预览。', 'The output is a sample placeholder preview.'),
        inputGuidance: localized('上传清晰图片。', 'Upload a clear image.'),
        cautions: localized('结果需要人工核对。', 'Review the result manually.'),
        difficulty: 'beginner',
        sortOrder: 10,
        coverAssetId: 'output-one',
        inputAssetIds: ['input-one'],
        outputAssetIds: ['output-one'],
        recipe: recipe(),
        ...overrides
    };
}

function topic(overrides: Partial<ShowcaseTopic> = {}): ShowcaseTopic {
    return {
        id: 'topic-one',
        slug: 'topic-one',
        title: localized('专题一', 'Topic One'),
        summary: localized('一个实用专题。', 'A practical topic.'),
        preparation: localized('准备清晰输入图片。', 'Prepare a clear input image.'),
        limitations: localized('结果会随输入和模型变化。', 'Results vary by input and model.'),
        tags: [localized('编辑', 'Editing')],
        featured: true,
        sortOrder: 10,
        coverAssetId: 'output-one',
        caseIds: ['case-one'],
        ...overrides
    };
}

function catalog(overrides: Partial<ShowcaseCatalog> = {}): ShowcaseCatalog {
    return {
        schemaVersion: SHOWCASE_CATALOG_SCHEMA_VERSION,
        catalogRevision: 'test-revision-1',
        generatedAt: 1_800_000_000_000,
        contentNotice: localized(
            '媒体是示例占位预览，不是真实 AI 生成素材。',
            'Media are sample placeholder previews, not actual AI-generated assets.'
        ),
        topics: [topic()],
        cases: [showcaseCase()],
        assets: [placeholderAsset('input-one'), placeholderAsset('output-one')],
        ...overrides
    };
}

function clone<T>(value: T): T {
    return structuredClone(value);
}

describe('showcase item normalizers', () => {
    it('accepts safe placeholder, built-in static, and public HTTPS image assets', () => {
        expect(normalizeShowcaseAsset(placeholderAsset('placeholder'))).toEqual(placeholderAsset('placeholder'));
        expect(
            normalizeShowcaseAsset({
                id: 'builtin-image',
                kind: 'remote-image',
                alt: localized('内置图片示例', 'Built-in image sample'),
                url: '/showcases/builtin/builtin-image.webp',
                thumbnailUrl: '/showcases/builtin/builtin-image-thumb.webp',
                mimeType: 'image/webp',
                width: 768,
                height: 768
            })
        ).toEqual({
            id: 'builtin-image',
            kind: 'remote-image',
            alt: localized('内置图片示例', 'Built-in image sample'),
            url: '/showcases/builtin/builtin-image.webp',
            thumbnailUrl: '/showcases/builtin/builtin-image-thumb.webp',
            mimeType: 'image/webp',
            width: 768,
            height: 768
        });
        expect(
            normalizeShowcaseAsset({
                id: 'remote-image',
                kind: 'remote-image',
                alt: localized('远程图片示例', 'Remote image sample'),
                url: 'https://cdn.example.com/showcase/image.webp',
                mimeType: 'image/webp',
                width: 1200,
                height: 800
            })
        ).toEqual({
            id: 'remote-image',
            kind: 'remote-image',
            alt: localized('远程图片示例', 'Remote image sample'),
            url: 'https://cdn.example.com/showcase/image.webp',
            mimeType: 'image/webp',
            width: 1200,
            height: 800
        });
    });

    it('rejects unsafe or credential-bearing media URLs', () => {
        const urls = [
            'http://cdn.example.com/image.png',
            'https://localhost/image.png',
            'https://127.0.0.1/image.png',
            'https://10.0.0.2/image.png',
            'https://user:password@cdn.example.com/image.png',
            'https://cdn.example.internal/image.png',
            'https://cdn.example.com/image.png?apiKey=value',
            '/showcases/builtin/../secret.webp',
            '/showcases/builtin/nested/image.webp',
            '/showcases/builtin/image.png',
            '/showcases/builtin/image.webp?variant=thumbnail',
            'data:image/png;base64,AAAA',
            'blob:local-object',
            'file:///tmp/image.png'
        ];

        for (const url of urls) {
            expect(
                normalizeShowcaseAsset({
                    id: 'remote-image',
                    kind: 'remote-image',
                    alt: localized('远程图片', 'Remote image'),
                    url,
                    mimeType: 'image/png'
                })
            ).toBeNull();
        }
    });

    it('strictly rejects unknown nested fields in assets, cases, and topics', () => {
        expect(normalizeShowcaseAsset({ ...placeholderAsset('asset-one'), localPath: '/tmp/image.png' })).toBeNull();
        expect(normalizeShowcaseCase({ ...showcaseCase(), enabled: true })).toBeNull();
        expect(normalizeShowcaseTopic({ ...topic(), internalNotes: [] })).toBeNull();
        expect(
            normalizeShowcaseTopic({
                ...topic(),
                title: { ...topic().title, 'ja-JP': 'トピック' }
            })
        ).toBeNull();
    });
});

describe('normalizeShowcaseCatalog', () => {
    it('normalizes safe non-sensitive task attribution and rejects malformed values', () => {
        expect(
            normalizeShowcaseAttribution({
                topicId: 'old-photo-restoration',
                caseId: 'scratch-removal',
                recipeVersion: 1,
                catalogRevision: 'builtin-2026-08'
            })
        ).toEqual({
            topicId: 'old-photo-restoration',
            caseId: 'scratch-removal',
            recipeVersion: 1,
            catalogRevision: 'builtin-2026-08'
        });
        expect(
            normalizeShowcaseAttribution({
                topicId: '../private',
                caseId: 'scratch-removal',
                recipeVersion: 1,
                catalogRevision: 'builtin'
            })
        ).toBeNull();
        expect(normalizeShowcaseAttribution(null)).toBeNull();
    });

    it('normalizes a complete catalog and preserves safe custom values', () => {
        const custom = catalog({
            catalogRevision: 'customer-curated-42',
            generatedAt: 1_900_000_000_000,
            topics: [
                topic({
                    sortOrder: 80,
                    capabilities: localized('可完成常见修图任务。', 'Supports common image-editing tasks.'),
                    suitableFor: localized('适合快速开始。', 'Good for getting started quickly.'),
                    unsuitableFor: localized('不用于法定身份材料。', 'Not for legal identity documents.'),
                    recommendedInputQuality: localized('使用清晰原图。', 'Use a clear original image.'),
                    faq: [
                        {
                            question: localized('会自动生成吗？', 'Does it auto-generate?'),
                            answer: localized('不会。', 'No.')
                        }
                    ],
                    relatedTopicIds: []
                })
            ],
            cases: [showcaseCase({ difficulty: 'advanced', sortOrder: 90 })]
        });

        expect(normalizeShowcaseCatalog(custom)).toEqual(custom);
    });

    it('treats a missing catalog schemaVersion as legacy v1 and emits standard v1', () => {
        const value = catalog();
        const legacyCatalog = { ...value } as Partial<ShowcaseCatalog>;
        delete legacyCatalog.schemaVersion;

        expect(normalizeShowcaseCatalog(legacyCatalog)).toEqual(value);
    });

    it('rejects invalid and future versions, missing required fields, and non-objects', () => {
        const value = catalog();
        const withoutRevision = { ...value } as Partial<ShowcaseCatalog>;
        delete withoutRevision.catalogRevision;

        expect(normalizeShowcaseCatalog({ ...value, schemaVersion: 2 })).toBeNull();
        expect(normalizeShowcaseCatalog({ ...value, schemaVersion: '1' })).toBeNull();
        expect(normalizeShowcaseCatalog(withoutRevision)).toBeNull();
        expect(normalizeShowcaseCatalog(null)).toBeNull();
        expect(normalizeShowcaseCatalog([])).toBeNull();
    });

    it('rejects unknown fields and dangerous keys anywhere in the payload', () => {
        expect(normalizeShowcaseCatalog({ ...catalog(), providerBaseUrl: 'https://example.com' })).toBeNull();

        const nestedUnknown = clone(catalog());
        const nestedCase = nestedUnknown.cases[0];
        if (nestedCase && isExecutableShowcaseCase(nestedCase)) {
            nestedCase.recipe.output = { autostart: true } as never;
        }
        expect(normalizeShowcaseCatalog(nestedUnknown)).toBeNull();

        const dangerous = clone(catalog());
        Object.defineProperty(dangerous.topics[0], 'constructor', {
            value: { prototype: { polluted: true } },
            enumerable: true
        });
        expect(normalizeShowcaseCatalog(dangerous)).toBeNull();
        expect(Object.prototype).not.toHaveProperty('polluted');
    });

    it('rejects duplicate topic, case, asset, slug, and ownership identifiers', () => {
        const value = catalog();
        expect(normalizeShowcaseCatalog({ ...value, topics: [topic(), topic()] })).toBeNull();
        expect(normalizeShowcaseCatalog({ ...value, cases: [showcaseCase(), showcaseCase()] })).toBeNull();
        expect(
            normalizeShowcaseCatalog({
                ...value,
                assets: [...value.assets, placeholderAsset('input-one')]
            })
        ).toBeNull();

        const duplicateSlugTopic = topic({ id: 'topic-two' });
        expect(normalizeShowcaseCatalog({ ...value, topics: [topic(), duplicateSlugTopic] })).toBeNull();

        const duplicateOwnership = catalog({ topics: [topic(), topic({ id: 'topic-two', slug: 'topic-two' })] });
        expect(normalizeShowcaseCatalog(duplicateOwnership)).toBeNull();
    });

    it('rejects dangling topic, case, and asset references', () => {
        expect(normalizeShowcaseCatalog(catalog({ topics: [topic({ caseIds: ['missing-case'] })] }))).toBeNull();
        expect(normalizeShowcaseCatalog(catalog({ cases: [showcaseCase({ topicId: 'missing-topic' })] }))).toBeNull();
        expect(normalizeShowcaseCatalog(catalog({ topics: [topic({ coverAssetId: 'missing-asset' })] }))).toBeNull();
        expect(
            normalizeShowcaseCatalog(catalog({ cases: [showcaseCase({ inputAssetIds: ['missing-asset'] })] }))
        ).toBeNull();
        expect(
            normalizeShowcaseCatalog(catalog({ topics: [topic({ relatedTopicIds: ['missing-topic'] })] }))
        ).toBeNull();
        expect(normalizeShowcaseCatalog(catalog({ topics: [topic({ relatedTopicIds: ['topic-one'] })] }))).toBeNull();
    });

    it('can defer external related-topic references for a single-topic draft while still rejecting self-links', () => {
        expect(
            normalizeShowcaseCatalog(
                catalog({ topics: [topic({ relatedTopicIds: ['topic-from-another-publication'] })] }),
                { allowDanglingRelatedTopicIds: true }
            )
        ).not.toBeNull();
        expect(
            normalizeShowcaseCatalog(catalog({ topics: [topic({ relatedTopicIds: ['topic-one'] })] }), {
                allowDanglingRelatedTopicIds: true
            })
        ).toBeNull();
    });

    it('rejects a case listed under a different topic and unlisted cases', () => {
        const secondTopic = topic({
            id: 'topic-two',
            slug: 'topic-two',
            caseIds: ['case-one']
        });
        expect(normalizeShowcaseCatalog(catalog({ topics: [secondTopic] }))).toBeNull();
        expect(normalizeShowcaseCatalog(catalog({ topics: [topic({ caseIds: [] })] }))).toBeNull();
    });

    it('isolates a future recipe to one read-only case without executing unknown fields', () => {
        const futureCase = {
            ...showcaseCase({ id: 'case-future', slug: 'case-future' }),
            recipe: {
                version: 2,
                prompt: localized('只读展示提示词。', 'Read-only display prompt.'),
                workflowScript: 'do-not-run()'
            }
        };
        const mixedCatalog = catalog({
            topics: [topic({ caseIds: ['case-one', 'case-future'] })],
            cases: [showcaseCase(), futureCase as never]
        });

        expect(normalizeShowcaseCatalog(mixedCatalog)).toBeNull();
        const normalized = normalizeShowcaseCatalog(mixedCatalog, { allowUnsupportedRecipeVersions: true });

        expect(normalized?.cases).toHaveLength(2);
        const normalizedFutureCase = normalized?.cases.find((item) => item.id === 'case-future');
        expect(normalizedFutureCase).toMatchObject({
            unsupportedRecipeVersion: 2,
            readOnlyPrompt: localized('只读展示提示词。', 'Read-only display prompt.')
        });
        expect(normalizedFutureCase && isExecutableShowcaseCase(normalizedFutureCase)).toBe(false);
        expect(JSON.stringify(normalizedFutureCase)).not.toContain('workflowScript');
        expect(normalizeShowcaseCatalog(normalized, { allowUnsupportedRecipeVersions: true })).toEqual(normalized);
    });

    it('preserves display media for a future case without turning it into executable input slots', () => {
        const futureCase = {
            ...showcaseCase({ id: 'case-future', slug: 'case-future' }),
            inputAssetIds: Array.from({ length: 17 }, (_, index) => `input-${index}`),
            recipe: { version: 2, prompt: localized('未来提示词', 'Future prompt') }
        };
        const assets = [...catalog().assets, ...futureCase.inputAssetIds.map((id) => placeholderAsset(id))];
        const normalized = normalizeShowcaseCatalog(
            catalog({
                topics: [topic({ caseIds: ['case-one', 'case-future'] })],
                cases: [showcaseCase(), futureCase as never],
                assets
            }),
            { allowUnsupportedRecipeVersions: true }
        );

        const normalizedFutureCase = normalized?.cases.find((item) => item.id === 'case-future');
        expect(normalized?.cases.map((item) => item.id)).toEqual(['case-one', 'case-future']);
        expect(normalized?.topics[0]?.caseIds).toEqual(['case-one', 'case-future']);
        expect(normalizedFutureCase?.inputAssetIds).toHaveLength(17);
        expect(normalizedFutureCase).not.toHaveProperty('recipe');
        expect(normalizedFutureCase && isExecutableShowcaseCase(normalizedFutureCase)).toBe(false);
        expect(normalizeShowcaseCatalog(normalized, { allowUnsupportedRecipeVersions: true })).toEqual(normalized);
    });
});
