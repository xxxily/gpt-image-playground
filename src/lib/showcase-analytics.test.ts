import { normalizeShowcaseAnalyticsEvent } from './showcase-analytics';
import { describe, expect, it } from 'vitest';

describe('showcase analytics event normalization', () => {
    it('accepts the anonymous funnel allowlist without user content', () => {
        expect(
            normalizeShowcaseAnalyticsEvent({
                event: 'showcase_generation_failure',
                topicId: 'old-photo-restoration',
                caseId: 'scratch-removal',
                catalogRevision: 'published-42',
                runtime: 'tauri',
                modelId: 'openai/gpt-image-1',
                errorCategory: 'network'
            })
        ).toEqual({
            event: 'showcase_generation_failure',
            topicId: 'old-photo-restoration',
            caseId: 'scratch-removal',
            catalogRevision: 'published-42',
            runtime: 'tauri',
            modelId: 'openai/gpt-image-1',
            errorCategory: 'network'
        });
    });

    it('rejects prompts, paths, credentials, cross-site identifiers, and incomplete event shapes', () => {
        const base = {
            event: 'showcase_recipe_apply',
            topicId: 'old-photo-restoration',
            caseId: 'scratch-removal',
            catalogRevision: 'published-42',
            runtime: 'web',
            recipeVersion: 1
        };
        for (const unsafe of [
            { prompt: 'restore this photo' },
            { localPath: '/Users/example/photo.jpg' },
            { apiKey: 'secret' },
            { visitorId: 'cross-site-user' },
            { imageHash: 'abc123' }
        ]) {
            expect(normalizeShowcaseAnalyticsEvent({ ...base, ...unsafe })).toBeNull();
        }
        expect(normalizeShowcaseAnalyticsEvent({ ...base, caseId: undefined })).toBeNull();
        expect(
            normalizeShowcaseAnalyticsEvent({
                event: 'showcase_generation_failure',
                topicId: 'topic-one',
                caseId: 'case-one',
                runtime: 'web',
                modelId: 'model-one'
            })
        ).toBeNull();
    });
});
