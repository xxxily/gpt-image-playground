import { afterEach, describe, expect, it } from 'vitest';

import { VideoAdapterError } from './adapter';
import {
    bootstrapVideoAdapters,
    getBootstrappedVideoAdapters,
    isVideoAdapterBootstrapped,
    resetVideoAdapterBootstrapForTests
} from './bootstrap';
import { clearVideoAdapterRegistry, getVideoAdapter } from './registry';

afterEach(() => {
    clearVideoAdapterRegistry();
    resetVideoAdapterBootstrapForTests();
});

describe('bootstrapVideoAdapters', () => {
    it('registers all 12 video adapters', () => {
        bootstrapVideoAdapters();
        expect(isVideoAdapterBootstrapped()).toBe(true);
        expect(getBootstrappedVideoAdapters()).toHaveLength(12);
    });

    it('is idempotent', () => {
        bootstrapVideoAdapters();
        bootstrapVideoAdapters();
        bootstrapVideoAdapters();
        expect(getBootstrappedVideoAdapters()).toHaveLength(12);
    });

    it('registers the two reference adapters by protocol', () => {
        bootstrapVideoAdapters();
        const sora = getVideoAdapter('openai-videos');
        const wan = getVideoAdapter('dashscope-video-generation');
        expect(sora).not.toBeNull();
        expect(wan).not.toBeNull();
        expect(sora?.displayName).toBe('OpenAI Sora');
        expect(wan?.displayName).toBe('Aliyun Wan (DashScope)');
    });

    it('registers all 10 placeholder protocols', () => {
        bootstrapVideoAdapters();
        const placeholders = [
            'gemini-generate-videos',
            'vertex-ai-veo',
            'runway-api-v1',
            'luma-dream-machine',
            'minimax-video',
            'kling-api',
            'modelark-video-generation',
            'tencent-vclm',
            'tencent-tokenhub-video',
            'fal-model-api'
        ] as const;
        for (const protocol of placeholders) {
            const adapter = getVideoAdapter(protocol);
            expect(adapter).not.toBeNull();
            expect(adapter?.protocol).toBe(protocol);
        }
    });

    it('placeholder adapters throw VideoAdapterError when invoked', async () => {
        bootstrapVideoAdapters();
        const runway = getVideoAdapter('runway-api-v1');
        expect(runway).not.toBeNull();
        await expect(
            runway!.submit(
                {
                    endpoint: {
                        id: 'r',
                        provider: 'runway',
                        name: 'Runway',
                        apiKey: 'k',
                        apiBaseUrl: 'https://api.dev.runwayml.com',
                        protocol: 'runway-api-v1',
                        enabled: true
                    },
                    catalogEntry: {
                        id: 'r::gen4',
                        rawModelId: 'gen4_turbo',
                        providerEndpointId: 'r',
                        provider: 'runway',
                        label: 'Gen 4 Turbo',
                        source: 'remote',
                        enabled: true,
                        capabilities: {
                            tasks: ['video.generate'],
                            inputModalities: ['text'],
                            outputModalities: ['video']
                        }
                    },
                    taskMode: 'text-to-video',
                    prompt: 'test',
                    parameters: {},
                    sourceImages: []
                },
                async () => new Response('')
            )
        ).rejects.toBeInstanceOf(VideoAdapterError);
    });
});
