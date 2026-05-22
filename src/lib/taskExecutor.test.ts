import { executeTask, type TaskExecutionParams, type TaskProgress } from './taskExecutor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const openAIState = vi.hoisted(() => ({
    edit: vi.fn(),
    generate: vi.fn()
}));

const dbState = vi.hoisted(() => ({
    putImage: vi.fn()
}));

const configState = vi.hoisted(() => ({
    config: {}
}));

vi.mock('openai', () => ({
    default: class MockOpenAI {
        images = {
            edit: openAIState.edit,
            generate: openAIState.generate
        };
    }
}));

vi.mock('@/lib/db', () => ({
    db: {
        images: {
            put: dbState.putImage
        }
    }
}));

vi.mock('@/lib/desktop-runtime', () => ({
    invokeDesktopCommand: vi.fn(),
    invokeDesktopStreamingCommand: vi.fn(),
    isTauriDesktop: () => false
}));

vi.mock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config');
    return {
        ...actual,
        loadConfig: () => ({ ...actual.DEFAULT_CONFIG, ...configState.config })
    };
});

async function* streamEvents(events: Record<string, unknown>[]) {
    for (const event of events) {
        yield event;
    }
}

function baseParams(overrides: Partial<TaskExecutionParams> = {}): TaskExecutionParams {
    return {
        connectionMode: 'direct',
        apiKey: 'sk-test',
        imageStorageMode: 'indexeddb',
        mode: 'generate',
        model: 'gpt-image-2',
        prompt: 'draw a small icon',
        n: 1,
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        background: 'auto',
        moderation: 'auto',
        enableStreaming: true,
        partialImages: 2,
        ...overrides
    };
}

describe('executeTask image streaming', () => {
    beforeEach(() => {
        configState.config = {};
        openAIState.edit.mockReset();
        openAIState.generate.mockReset();
        dbState.putImage.mockReset();
        dbState.putImage.mockResolvedValue(undefined);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:streamed-image');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses the latest generation partial image when the stream has no completed event', async () => {
        const b64 = Buffer.from('partial-generate').toString('base64');
        const progress: TaskProgress[] = [];
        openAIState.generate.mockResolvedValue(
            streamEvents([
                {
                    type: 'image_generation.partial_image',
                    partial_image_index: 0,
                    b64_json: b64,
                    output_format: 'png'
                }
            ])
        );

        const result = await executeTask(
            baseParams({
                onProgress: (event) => progress.push(event)
            })
        );

        expect(typeof result).toBe('object');
        if (typeof result === 'string') throw new Error(result);
        expect(result.images).toEqual([{ path: 'blob:streamed-image', filename: expect.stringMatching(/\.png$/) }]);
        expect(dbState.putImage).toHaveBeenCalledWith(
            expect.objectContaining({ filename: expect.stringMatching(/\.png$/) })
        );
        expect(progress).toEqual([{ type: 'streaming_partial', index: 0, b64_json: b64 }]);
    });

    it('uses the latest edit partial image when the stream has no completed event', async () => {
        const b64 = Buffer.from('partial-edit').toString('base64');
        openAIState.edit.mockResolvedValue(
            streamEvents([
                {
                    type: 'image_edit.partial_image',
                    partial_image_index: 0,
                    b64_json: b64,
                    output_format: 'png'
                }
            ])
        );

        const result = await executeTask(
            baseParams({
                mode: 'edit',
                editImages: [new File(['input'], 'input.png', { type: 'image/png' })]
            })
        );

        expect(typeof result).toBe('object');
        if (typeof result === 'string') throw new Error(result);
        expect(result.images).toEqual([{ path: 'blob:streamed-image', filename: expect.stringMatching(/\.png$/) }]);
        expect(dbState.putImage).toHaveBeenCalledWith(
            expect.objectContaining({ filename: expect.stringMatching(/\.png$/) })
        );
    });
});

describe('executeTask web proxy provider credentials', () => {
    beforeEach(() => {
        configState.config = {};
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    images: [
                        {
                            filename: 'seedream.jpg',
                            path: 'https://cdn.example.com/seedream.jpg',
                            output_format: 'jpeg'
                        }
                    ]
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('passes the selected Seedream provider instance credentials to the Web proxy', async () => {
        configState.config = {
            connectionMode: 'proxy',
            imageStorageMode: 'indexeddb',
            providerInstances: [
                {
                    id: 'seedream:default',
                    type: 'seedream',
                    name: 'Default Seedream',
                    apiKey: 'default-key',
                    apiBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
                    models: [],
                    isDefault: true
                },
                {
                    id: 'seedream:coding-plan',
                    type: 'seedream',
                    name: 'Coding Plan Seedream',
                    apiKey: 'instance-key',
                    apiBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
                    models: ['doubao-seedream-5-0-260128']
                }
            ],
            customImageModels: []
        };

        const result = await executeTask(
            baseParams({
                connectionMode: 'proxy',
                providerInstanceId: 'seedream:coding-plan',
                model: 'doubao-seedream-5-0-260128',
                enableStreaming: false,
                seedreamApiKey: undefined,
                seedreamApiBaseUrl: undefined
            })
        );

        expect(typeof result).toBe('object');
        if (typeof result === 'string') throw new Error(result);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            '/api/images',
            expect.objectContaining({
                method: 'POST',
                body: expect.any(FormData)
            })
        );
        const body = vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as FormData;
        expect(body.get('providerInstanceId')).toBe('seedream:coding-plan');
        expect(body.get('x_config_seedream_api_key')).toBe('instance-key');
        expect(body.get('x_config_seedream_api_base_url')).toBe('https://ark.cn-beijing.volces.com/api/v3');
        expect(body.get('x_config_custom_image_models')).toBeNull();
    });
});
