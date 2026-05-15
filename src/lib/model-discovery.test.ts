import { describe, expect, it } from 'vitest';
import { parseOpenAICompatibleModelsResponse } from './model-discovery';

describe('parseOpenAICompatibleModelsResponse', () => {
    it('keeps raw model IDs and safe display metadata from OpenAI-compatible model lists', () => {
        const models = parseOpenAICompatibleModelsResponse({
            data: [
                {
                    id: 'openai/gpt-image-2',
                    display_name: 'GPT Image 2',
                    owned_by: 'openai',
                    object: 'model',
                    created: 1760000000,
                    secret: 'should-not-copy'
                },
                {
                    id: 'vendor:custom-vl',
                    provider: 'vendor',
                    modalities: ['text', 'image']
                },
                {
                    id: 'openai/gpt-image-2',
                    owned_by: 'duplicate'
                }
            ]
        });

        expect(models).toHaveLength(2);
        expect(models[0]).toMatchObject({
            id: 'openai/gpt-image-2',
            displayLabel: 'GPT Image 2',
            upstreamVendor: 'openai',
            remoteMetadata: {
                object: 'model',
                owned_by: 'openai',
                created: 1760000000
            }
        });
        expect(models[0].remoteMetadata).not.toHaveProperty('secret');
        expect(models[1]).toMatchObject({
            id: 'vendor:custom-vl',
            upstreamVendor: 'vendor',
            remoteMetadata: {
                provider: 'vendor',
                modalities: ['text', 'image']
            }
        });
    });

    it('returns an empty list for malformed model list payloads', () => {
        expect(parseOpenAICompatibleModelsResponse(null)).toEqual([]);
        expect(parseOpenAICompatibleModelsResponse({ data: [{ id: '' }, { name: 'missing-id' }] })).toEqual([]);
    });
});
