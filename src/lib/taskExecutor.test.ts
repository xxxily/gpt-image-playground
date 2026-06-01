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

const desktopState = vi.hoisted(() => ({
    invokeDesktopCommand: vi.fn(),
    invokeDesktopStreamingCommand: vi.fn(),
    isTauriDesktop: false
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
    invokeDesktopCommand: desktopState.invokeDesktopCommand,
    invokeDesktopStreamingCommand: desktopState.invokeDesktopStreamingCommand,
    isTauriDesktop: () => desktopState.isTauriDesktop
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
        desktopState.isTauriDesktop = false;
        desktopState.invokeDesktopCommand.mockReset();
        desktopState.invokeDesktopStreamingCommand.mockReset();
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
        expect(result.images).toEqual([
            { path: 'blob:streamed-image', filename: expect.stringMatching(/\.png$/), size: Buffer.byteLength('partial-generate') }
        ]);
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
        expect(result.images).toEqual([
            { path: 'blob:streamed-image', filename: expect.stringMatching(/\.png$/), size: Buffer.byteLength('partial-edit') }
        ]);
        expect(dbState.putImage).toHaveBeenCalledWith(
            expect.objectContaining({ filename: expect.stringMatching(/\.png$/) })
        );
    });
});

describe('executeTask web proxy provider credentials', () => {
    beforeEach(() => {
        configState.config = {};
        desktopState.isTauriDesktop = false;
        desktopState.invokeDesktopCommand.mockReset();
        desktopState.invokeDesktopStreamingCommand.mockReset();
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

    it('appends edit images to the Web proxy request in the current source image order', async () => {
        const result = await executeTask(
            baseParams({
                connectionMode: 'proxy',
                mode: 'edit',
                enableStreaming: false,
                editImages: [
                    new File(['second'], 'second.png', { type: 'image/png' }),
                    new File(['first'], 'first.png', { type: 'image/png' }),
                    new File(['third'], 'third.png', { type: 'image/png' })
                ]
            })
        );

        expect(typeof result).toBe('object');
        if (typeof result === 'string') throw new Error(result);
        const body = vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body as FormData;
        expect((body.get('image_0') as File | null)?.name).toBe('second.png');
        expect((body.get('image_1') as File | null)?.name).toBe('first.png');
        expect((body.get('image_2') as File | null)?.name).toBe('third.png');
    });
});

describe('executeTask desktop proxy source image order', () => {
    beforeEach(() => {
        configState.config = {};
        desktopState.isTauriDesktop = true;
        desktopState.invokeDesktopCommand.mockReset();
        desktopState.invokeDesktopCommand.mockResolvedValue({
            images: [{ filename: 'desktop.png', path: 'https://cdn.example.com/desktop.png', output_format: 'png' }]
        });
        desktopState.invokeDesktopStreamingCommand.mockReset();
    });

    afterEach(() => {
        desktopState.isTauriDesktop = false;
        vi.restoreAllMocks();
    });

    it('passes edit images to the Rust proxy in the current source image order', async () => {
        const result = await executeTask(
            baseParams({
                connectionMode: 'proxy',
                mode: 'edit',
                enableStreaming: false,
                editImages: [
                    new File(['second'], 'second.png', { type: 'image/png' }),
                    new File(['first'], 'first.png', { type: 'image/png' }),
                    new File(['third'], 'third.png', { type: 'image/png' })
                ]
            })
        );

        expect(typeof result).toBe('object');
        if (typeof result === 'string') throw new Error(result);
        expect(desktopState.invokeDesktopCommand).toHaveBeenCalledWith(
            'proxy_images',
            expect.objectContaining({
                request: expect.objectContaining({
                    editImages: [
                        expect.objectContaining({ name: 'second.png' }),
                        expect.objectContaining({ name: 'first.png' }),
                        expect.objectContaining({ name: 'third.png' })
                    ]
                })
            })
        );
    });
});
