import { beforeEach, describe, expect, it, vi } from 'vitest';

const openAIState = vi.hoisted(() => ({
    constructedOptions: [] as Record<string, unknown>[],
    edit: vi.fn(),
    generate: vi.fn(),
    post: vi.fn()
}));

vi.mock('openai', () => ({
    default: class MockOpenAI {
        images = {
            edit: openAIState.edit,
            generate: openAIState.generate
        };

        constructor(options: Record<string, unknown>) {
            openAIState.constructedOptions.push(options);
        }

        post = openAIState.post;
    }
}));

import { editOpenAICompatibleImage, type OpenAICompatibleProviderDefaults } from './openai-compatible';

describe('OpenAI-compatible image providers', () => {
    beforeEach(() => {
        openAIState.constructedOptions.length = 0;
        openAIState.edit.mockReset();
        openAIState.generate.mockReset();
        openAIState.post.mockReset();
    });

    it('routes JSON generations edits through the unified generations endpoint with base64 image input', async () => {
        openAIState.post.mockResolvedValue({ data: [{ url: 'https://cdn.example.com/seedream.jpg' }] });

        const defaults: OpenAICompatibleProviderDefaults = {
            providerLabel: 'Seedream',
            defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
            missingApiKeyMessage: 'missing seedream key',
            defaultEditParams: { response_format: 'url', size: '2K', watermark: false },
            editRequestMode: 'generations-json',
            defaultOutputFormat: 'jpeg',
            maxImages: 15
        };
        const imageFile = new File(['hello'], 'reference.txt', { type: 'text/plain' });

        const result = await editOpenAICompatibleImage(
            {
                model: 'doubao-seedream-5.0-lite',
                prompt: 'make it cinematic',
                imageFiles: [imageFile],
                n: 1,
                size: '2K',
                providerOptions: { watermark: true }
            },
            { apiKey: 'seedream-key' },
            defaults
        );

        expect(openAIState.edit).not.toHaveBeenCalled();
        expect(openAIState.post).toHaveBeenCalledWith('/images/generations', {
            body: expect.objectContaining({
                image: 'data:text/plain;base64,aGVsbG8=',
                model: 'doubao-seedream-5.0-lite',
                prompt: 'make it cinematic',
                response_format: 'url',
                size: '2K',
                watermark: true
            })
        });
        expect(result.images).toEqual([{ path: 'https://cdn.example.com/seedream.jpg', output_format: 'jpeg' }]);
    });

    it('keeps default edit mode on the multipart edits endpoint', async () => {
        openAIState.edit.mockResolvedValue({ data: [{ b64_json: 'image-data' }] });

        const defaults: OpenAICompatibleProviderDefaults = {
            providerLabel: 'Compatible Provider',
            defaultBaseUrl: 'https://compatible.example.com/v1',
            missingApiKeyMessage: 'missing key',
            defaultEditParams: { size: '1024x1024' },
            defaultOutputFormat: 'png'
        };
        const imageFile = new File(['hello'], 'reference.txt', { type: 'text/plain' });

        const result = await editOpenAICompatibleImage(
            {
                model: 'compatible-edit-model',
                prompt: 'edit it',
                imageFiles: [imageFile],
                n: 1,
                size: 'auto'
            },
            { apiKey: 'compatible-key' },
            defaults
        );

        expect(openAIState.post).not.toHaveBeenCalled();
        expect(openAIState.edit).toHaveBeenCalledWith(expect.objectContaining({
            image: [imageFile],
            model: 'compatible-edit-model',
            prompt: 'edit it',
            size: '1024x1024'
        }));
        expect(result.images).toEqual([{ b64_json: 'image-data', output_format: 'png' }]);
    });
});
