import { executeTask, type TaskExecutionParams, type TaskProgress } from './taskExecutor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const openAIState = vi.hoisted(() => ({
    edit: vi.fn(),
    generate: vi.fn()
}));

const dbState = vi.hoisted(() => ({
    putImage: vi.fn()
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
