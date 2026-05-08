import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { normalizeOpenAICompatibleBaseUrl } from '@/lib/provider-config';
import path from 'path';
import { formatApiError, getApiErrorStatus, hasApiErrorPayload } from '@/lib/api-error';
import { formatClientDirectLinkRestriction, getClientDirectLinkRestriction, isEnabledEnvFlag } from '@/lib/connection-policy';
import type { GptImageModel } from '@/lib/cost-utils';
import { DEFAULT_IMAGE_MODEL, getImageModel, getModelProvider, isImageModelId, isOpenAIImageModel, normalizeCustomImageModels, type StoredCustomImageModel } from '@/lib/model-registry';
import { mergeRequestParams, parseProviderOptionsJson, type ProviderOptions } from '@/lib/provider-options';
import { editGeminiImage, generateGeminiImage } from '@/lib/providers/google-gemini';
import { editOpenAICompatibleImage, generateOpenAICompatibleImage } from '@/lib/providers/openai-compatible';
import { getOpenAICompatibleProviderDefaults } from '@/lib/providers/openai-compatible-presets';
import type { ImageOutputFormat } from '@/types/history';

// Streaming event types
type StreamingEvent = {
    type: 'partial_image' | 'completed' | 'error' | 'done';
    index?: number;
    partial_image_index?: number;
    b64_json?: string;
    filename?: string;
    path?: string;
    output_format?: string;
    usage?: OpenAI.Images.ImagesResponse['usage'];
    images?: Array<{
        filename: string;
        b64_json: string;
        path?: string;
        output_format: string;
    }>;
    error?: string;
};

type SavedImageData = {
    filename: string;
    b64_json?: string;
    path?: string;
    output_format: string;
};

type OpenAIImageData = {
    b64_json?: string | null;
    url?: string | null;
};

const outputDir = path.resolve(process.cwd(), 'generated-images');

// Define valid output formats for type safety
const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

// Validate and normalize output format
function validateOutputFormat(format: unknown): ValidOutputFormat {
    const normalized = String(format || 'png').toLowerCase();

    // Handle jpg -> jpeg normalization
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

    if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
        return mapped as ValidOutputFormat;
    }

    return 'png'; // default fallback
}

function formatEditParamsForLog(
    params: object,
    imageFiles: File[],
    maskFile: File | null,
    extras: Record<string, unknown> = {}
): Record<string, unknown> {
    const record = params as { model?: unknown; n?: unknown; size?: unknown; quality?: unknown };
    const standardKeys = new Set(['model', 'prompt', 'image', 'n', 'size', 'quality', 'mask', 'stream', 'partial_images']);
    return {
        model: record.model,
        n: record.n,
        size: record.size,
        quality: record.quality,
        ...extras,
        providerOptionKeys: Object.keys(params).filter((key) => !standardKeys.has(key)),
        image: `[${imageFiles.map((file) => file.name).join(', ')}]`,
        mask: maskFile ? maskFile.name : 'N/A'
    };
}

function normalizeModel(value: FormDataEntryValue | null): GptImageModel {
    return isImageModelId(value) ? value.trim() : DEFAULT_IMAGE_MODEL;
}

function getCustomImageModels(formData: FormData): StoredCustomImageModel[] {
    const raw = formData.get('x_config_custom_image_models');
    if (typeof raw !== 'string' || raw.trim().length === 0) return [];

    try {
        return normalizeCustomImageModels(JSON.parse(raw));
    } catch (error) {
        console.warn('Failed to parse custom image models:', error);
        return [];
    }
}

function getGeminiConfig(formData: FormData, request: NextRequest) {
    return {
        apiKey:
            (formData.get('x_config_gemini_api_key') as string | null) ||
            request.headers.get('x-gemini-api-key') ||
            process.env.GEMINI_API_KEY ||
            undefined,
        baseUrl:
            (formData.get('x_config_gemini_api_base_url') as string | null) ||
            request.headers.get('x-gemini-api-base-url') ||
            process.env.GEMINI_API_BASE_URL ||
            undefined
    };
}

function getSenseNovaConfig(formData: FormData, request: NextRequest) {
    return {
        apiKey:
            (formData.get('x_config_sensenova_api_key') as string | null) ||
            request.headers.get('x-sensenova-api-key') ||
            process.env.SENSENOVA_API_KEY ||
            undefined,
        baseUrl:
            (formData.get('x_config_sensenova_api_base_url') as string | null) ||
            request.headers.get('x-sensenova-api-base-url') ||
            process.env.SENSENOVA_API_BASE_URL ||
            undefined
    };
}

function getSeedreamConfig(formData: FormData, request: NextRequest) {
    return {
        apiKey:
            (formData.get('x_config_seedream_api_key') as string | null) ||
            request.headers.get('x-seedream-api-key') ||
            process.env.SEEDREAM_API_KEY ||
            undefined,
        baseUrl:
            (formData.get('x_config_seedream_api_base_url') as string | null) ||
            request.headers.get('x-seedream-api-base-url') ||
            process.env.SEEDREAM_API_BASE_URL ||
            undefined
    };
}

function getProviderOptions(formData: FormData): ProviderOptions | Response {
    const raw = formData.get('provider_options');
    if (typeof raw !== 'string') return {};

    const parsed = parseProviderOptionsJson(raw);
    if (parsed.valid) return parsed.value;

    return NextResponse.json({ error: `自定义参数 JSON 无效：${parsed.error}` }, { status: 400 });
}

async function saveProviderImages(
    images: Array<{ b64_json?: string; path?: string; output_format: ImageOutputFormat }>,
    effectiveStorageMode: 'fs' | 'indexeddb'
): Promise<SavedImageData[]> {
    const timestamp = Date.now();
    return Promise.all(
        images.map(async (image, index) => {
            const filename = `${timestamp}-${index}.${image.output_format}`;
            const imageResult: SavedImageData = {
                filename,
                output_format: image.output_format
            };

            if (image.path) {
                imageResult.path = image.path;
                return imageResult;
            }

            if (!image.b64_json) {
                throw new Error(`Provider image data at index ${index} is missing base64 data or URL.`);
            }

            imageResult.b64_json = image.b64_json;

            if (effectiveStorageMode === 'fs') {
                const buffer = Buffer.from(image.b64_json, 'base64');
                const filepath = path.join(outputDir, filename);
                await fs.writeFile(filepath, buffer);
                imageResult.path = `/api/image/${filename}`;
            }

            return imageResult;
        })
    );
}

async function saveOpenAIImages(
    images: OpenAIImageData[],
    effectiveStorageMode: 'fs' | 'indexeddb',
    outputFormat: ImageOutputFormat
): Promise<SavedImageData[]> {
    const timestamp = Date.now();

    return Promise.all(
        images.map(async (imageData, index) => {
            const filename = `${timestamp}-${index}.${outputFormat}`;
            const imageResult: SavedImageData = {
                filename,
                output_format: outputFormat
            };

            if (imageData.b64_json) {
                imageResult.b64_json = imageData.b64_json;

                if (effectiveStorageMode === 'fs') {
                    const buffer = Buffer.from(imageData.b64_json, 'base64');
                    const filepath = path.join(outputDir, filename);
                    console.log(`Attempting to save image to: ${filepath}`);
                    await fs.writeFile(filepath, buffer);
                    console.log(`Successfully saved image: ${filename}`);
                    imageResult.path = `/api/image/${filename}`;
                }

                return imageResult;
            }

            if (imageData.url) {
                imageResult.path = imageData.url;
                return imageResult;
            }

            throw new Error(`Image data at index ${index} is missing base64 data or URL.`);
        })
    );
}

async function ensureOutputDirExists() {
    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            try {
                await fs.mkdir(outputDir, { recursive: true });
                console.log(`Created output directory: ${outputDir}`);
            } catch (mkdirError) {
                console.error(`Error creating output directory ${outputDir}:`, mkdirError);
                throw new Error('Failed to create image output directory.');
            }
        } else {
            console.error(`Error accessing output directory ${outputDir}:`, error);
            throw new Error(
                `Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/images');

    const formData = await request.formData();

    const configApiKey = formData.get('x_config_api_key') as string | null || request.headers.get('x-openai-api-key') || null;
    const configApiBaseUrl = formData.get('x_config_api_base_url') as string | null || request.headers.get('x-openai-api-base-url') || null;
    const configStorageMode = formData.get('x_config_storage_mode') as string | null || request.headers.get('x-storage-mode') || null;

    const apiKey = configApiKey || process.env.OPENAI_API_KEY;
    const apiBaseUrl = normalizeOpenAICompatibleBaseUrl(configApiBaseUrl || process.env.OPENAI_API_BASE_URL || undefined);
    const uiStorageMode = configStorageMode || '';
    const apiBaseUrlSource = configApiBaseUrl ? 'ui' : process.env.OPENAI_API_BASE_URL ? 'env' : 'default';

    console.log(
        `[UI Config] apiKeySource=${configApiKey ? 'ui' : process.env.OPENAI_API_KEY ? 'env' : 'none'}, baseUrlSource=${apiBaseUrlSource}`
    );

    const dynamicOpenai = apiKey ? new OpenAI({ apiKey, ...(apiBaseUrl && { baseURL: apiBaseUrl }) }) : null;

    try {
        let effectiveStorageMode: 'fs' | 'indexeddb';
        const envMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
        const explicitMode = uiStorageMode || envMode;
        const isOnVercel = process.env.VERCEL === '1';

        if (explicitMode === 'fs') {
            effectiveStorageMode = 'fs';
        } else if (explicitMode === 'indexeddb') {
            effectiveStorageMode = 'indexeddb';
        } else if (isOnVercel) {
            effectiveStorageMode = 'indexeddb';
        } else {
            effectiveStorageMode = 'fs';
        }
        console.log(
            `Effective Image Storage Mode: ${effectiveStorageMode} (UI: ${uiStorageMode || 'unset'}, Env: ${envMode || 'unset'}, Vercel: ${isOnVercel})`
        );

        if (effectiveStorageMode === 'fs') {
            await ensureOutputDirExists();
        }

        if (process.env.APP_PASSWORD) {
            const passwordInput = request.headers.get('x-app-password') || formData.get('passwordHash') as string | null;
            const clientPasswordHash = passwordInput;
            if (!clientPasswordHash) {
                console.error('Missing password hash.');
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                console.error('Invalid password hash.');
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const mode = formData.get('mode') as 'generate' | 'edit' | null;
        const prompt = formData.get('prompt') as string | null;
        const model = normalizeModel(formData.get('model'));
        const customImageModels = getCustomImageModels(formData);
        const parsedProviderOptions = getProviderOptions(formData);
        if (parsedProviderOptions instanceof Response) return parsedProviderOptions;

        console.log(`Mode: ${mode}, Model: ${model}, Prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'N/A'}`);

        if (!mode || !prompt) {
            return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
        }

        // Check for streaming mode
        const streamEnabled = formData.get('stream') === 'true';
        const partialImagesCount = parseInt((formData.get('partial_images') as string) || '2', 10);

        const provider = getModelProvider(model, customImageModels);
        const modelDefinition = getImageModel(model, customImageModels);
        const providerOptions = { ...(modelDefinition.providerOptions ?? {}), ...parsedProviderOptions };
        const directLinkRestriction = getClientDirectLinkRestriction({
            enabled: isEnabledEnvFlag(process.env.CLIENT_DIRECT_LINK_PRIORITY || process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY),
            openaiApiBaseUrl: configApiBaseUrl || undefined,
            envOpenaiApiBaseUrl: process.env.OPENAI_API_BASE_URL,
            geminiApiBaseUrl: (formData.get('x_config_gemini_api_base_url') as string | null) || request.headers.get('x-gemini-api-base-url') || undefined,
            envGeminiApiBaseUrl: process.env.GEMINI_API_BASE_URL,
            sensenovaApiBaseUrl: (formData.get('x_config_sensenova_api_base_url') as string | null) || request.headers.get('x-sensenova-api-base-url') || undefined,
            envSensenovaApiBaseUrl: process.env.SENSENOVA_API_BASE_URL,
            seedreamApiBaseUrl: (formData.get('x_config_seedream_api_base_url') as string | null) || request.headers.get('x-seedream-api-base-url') || undefined,
            envSeedreamApiBaseUrl: process.env.SEEDREAM_API_BASE_URL,
            providers: [provider]
        });
        if (directLinkRestriction) {
            return NextResponse.json({ error: formatClientDirectLinkRestriction(directLinkRestriction) }, { status: 400 });
        }

        if (provider === 'google') {
            if (streamEnabled) {
                return NextResponse.json({ error: 'Gemini Nano Banana 2 暂不支持流式预览，请关闭流式预览后重试。' }, { status: 400 });
            }

            const n = parseInt((formData.get('n') as string) || '1', 10);
            const size = (formData.get('size') as string) || 'auto';
            const quality = (formData.get('quality') as 'low' | 'medium' | 'high' | 'auto' | null) || 'auto';
            const geminiConfig = getGeminiConfig(formData, request);
            const geminiImages = Array.from(formData.entries())
                .filter(([key, value]) => key.startsWith('image_') && value instanceof File)
                .map(([, value]) => value as File);
            if (mode === 'edit' && formData.get('mask')) {
                return NextResponse.json({ error: 'Gemini Nano Banana 2 暂不支持蒙版编辑，请移除蒙版后重试。' }, { status: 400 });
            }
            if (mode === 'edit' && geminiImages.length === 0) {
                return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
            }
            const providerResult = mode === 'generate'
                ? await generateGeminiImage(
                    {
                        model,
                        prompt,
                        n,
                        size,
                        quality,
                        output_format: validateOutputFormat(formData.get('output_format')),
                        background: (formData.get('background') as 'transparent' | 'opaque' | 'auto' | null) || 'auto',
                        moderation: (formData.get('moderation') as 'low' | 'auto' | null) || 'auto'
                    },
                    geminiConfig
                )
                : await editGeminiImage(
                    {
                        model,
                        prompt,
                        imageFiles: geminiImages,
                        maskFile: formData.get('mask') as File | null,
                        n,
                        size,
                        quality
                    },
                    geminiConfig
                );

            const savedImagesData = await saveProviderImages(providerResult.images, effectiveStorageMode);
            return NextResponse.json({ images: savedImagesData, usage: providerResult.usage });
        }

        const openAICompatibleProviderDefaults = getOpenAICompatibleProviderDefaults(provider);
        if (openAICompatibleProviderDefaults) {
            if (streamEnabled) {
                return NextResponse.json({ error: `${openAICompatibleProviderDefaults.providerLabel} 暂不支持流式预览，请关闭流式预览后重试。` }, { status: 400 });
            }

            const n = parseInt((formData.get('n') as string) || '1', 10);
            const size = (formData.get('size') as string | null) || modelDefinition.defaultSize;
            const quality = (formData.get('quality') as 'low' | 'medium' | 'high' | 'auto' | null) || 'auto';
            const providerConfig = provider === 'sensenova'
                ? getSenseNovaConfig(formData, request)
                : getSeedreamConfig(formData, request);
            const providerImages = Array.from(formData.entries())
                .filter(([key, value]) => key.startsWith('image_') && value instanceof File)
                .map(([, value]) => value as File);

            if (mode === 'edit' && !modelDefinition.supportsEditing) {
                return NextResponse.json({ error: `${modelDefinition.label} 暂不支持图像编辑。` }, { status: 400 });
            }
            if (mode === 'edit' && formData.get('mask')) {
                return NextResponse.json({ error: `${modelDefinition.label} 暂不支持蒙版编辑，请移除蒙版后重试。` }, { status: 400 });
            }
            if (mode === 'edit' && providerImages.length === 0) {
                return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
            }

            const providerResult = mode === 'generate'
                ? await generateOpenAICompatibleImage(
                    {
                        model,
                        prompt,
                        n,
                        size,
                        quality,
                        output_format: validateOutputFormat(formData.get('output_format')),
                        output_compression: formData.get('output_compression')
                            ? parseInt(formData.get('output_compression') as string, 10)
                            : undefined,
                        background: (formData.get('background') as 'transparent' | 'opaque' | 'auto' | null) || 'auto',
                        moderation: (formData.get('moderation') as 'low' | 'auto' | null) || 'auto',
                        providerOptions
                    },
                    providerConfig,
                    openAICompatibleProviderDefaults
                )
                : await editOpenAICompatibleImage(
                    {
                        model,
                        prompt,
                        imageFiles: providerImages,
                        maskFile: null,
                        n,
                        size,
                        quality,
                        providerOptions
                    },
                    providerConfig,
                    openAICompatibleProviderDefaults
                );

            const savedImagesData = await saveProviderImages(providerResult.images, effectiveStorageMode);
            return NextResponse.json({ images: savedImagesData, usage: providerResult.usage });
        }

        if (!isOpenAIImageModel(model, customImageModels)) {
            return NextResponse.json({ error: `Unsupported image model: ${model}` }, { status: 400 });
        }

        if (!dynamicOpenai) {
            console.error('OPENAI_API_KEY is not set. UI: ' + (configApiKey ? 'present' : 'none') + ', Env: ' + (process.env.OPENAI_API_KEY ? 'present' : 'none'));
            return NextResponse.json(
                { error: '服务器中转模式需要配置 API Key。请在系统设置中填写 API Key，或在服务端环境变量 OPENAI_API_KEY 中配置。' },
                { status: 400 }
            );
        }

        let result: OpenAI.Images.ImagesResponse;

        if (mode === 'generate') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            // gpt-image-2 accepts arbitrary WxH strings that the SDK's narrow literal union doesn't express.
            const size = ((formData.get('size') as string) || '1024x1024') as OpenAI.Images.ImageGenerateParams['size'];
            const quality = (formData.get('quality') as OpenAI.Images.ImageGenerateParams['quality']) || 'auto';
            const output_format =
                (formData.get('output_format') as OpenAI.Images.ImageGenerateParams['output_format']) || 'png';
            const output_compression_str = formData.get('output_compression') as string | null;
            const background =
                (formData.get('background') as OpenAI.Images.ImageGenerateParams['background']) || 'auto';
            const moderation =
                (formData.get('moderation') as OpenAI.Images.ImageGenerateParams['moderation']) || 'auto';

            const baseFields: Record<string, unknown> = {
                model,
                prompt,
                n: Math.max(1, Math.min(n || 1, 10)),
                size,
                quality,
                output_format,
                background,
                moderation
            };

            if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
                const compression = parseInt(output_compression_str, 10);
                if (!isNaN(compression) && compression >= 0 && compression <= 100) {
                    baseFields.output_compression = compression;
                }
            }
            const baseParams = mergeRequestParams(baseFields, providerOptions);

            // Handle streaming mode for generation
            if (streamEnabled) {
                const actualPartialImages = Math.max(1, Math.min(partialImagesCount, 3)) as 1 | 2 | 3;

                const streamParams = {
                    ...baseParams,
                    stream: true as const,
                    partial_images: actualPartialImages
                } as unknown as OpenAI.Images.ImageGenerateParamsStreaming;

                console.log(`[OpenAI SDK stream] apiKey=present, baseUrlSource=${apiBaseUrlSource}`);
                const stream = await dynamicOpenai.images.generate(streamParams);

                // Create SSE response
                const encoder = new TextEncoder();
                const timestamp = Date.now();
                const fileExtension = validateOutputFormat(output_format);

                const readableStream = new ReadableStream({
                    async start(controller) {
                        try {
                            const completedImages: Array<{
                                filename: string;
                                b64_json: string;
                                path?: string;
                                output_format: string;
                            }> = [];
                            let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
                            let imageIndex = 0;

                            for await (const event of stream) {
                                if (event.type === 'image_generation.partial_image') {
                                    const partialEvent: StreamingEvent = {
                                        type: 'partial_image',
                                        index: imageIndex,
                                        partial_image_index: event.partial_image_index,
                                        b64_json: event.b64_json
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));
                                } else if (event.type === 'image_generation.completed') {
                                    const currentIndex = imageIndex;
                                    const filename = `${timestamp}-${currentIndex}.${fileExtension}`;

                                    // Save to filesystem if in fs mode
                                    if (effectiveStorageMode === 'fs' && event.b64_json) {
                                        const buffer = Buffer.from(event.b64_json, 'base64');
                                        const filepath = path.join(outputDir, filename);
                                        await fs.writeFile(filepath, buffer);
                                        console.log(`Streaming: Saved image ${filename}`);
                                    }

                                    const imageData = {
                                        filename,
                                        b64_json: event.b64_json || '',
                                        output_format: fileExtension,
                                        ...(effectiveStorageMode === 'fs' ? { path: `/api/image/${filename}` } : {})
                                    };
                                    completedImages.push(imageData);

                                    const completedEvent: StreamingEvent = {
                                        type: 'completed',
                                        index: currentIndex,
                                        filename,
                                        b64_json: event.b64_json,
                                        path: effectiveStorageMode === 'fs' ? `/api/image/${filename}` : undefined,
                                        output_format: fileExtension
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`));

                                    imageIndex++;

                                    // Capture usage from completed event if available
                                    if ('usage' in event && event.usage) {
                                        finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                                    }
                                }
                            }

                            // Send final done event with all images and usage
                            const doneEvent: StreamingEvent = {
                                type: 'done',
                                images: completedImages,
                                usage: finalUsage
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                            controller.close();
                        } catch (error) {
                            console.error('Streaming error:', error);
                            const errorEvent: StreamingEvent = {
                                type: 'error',
                                error: formatApiError(error, 'Streaming error occurred')
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                            controller.close();
                        }
                    }
                });

                return new Response(readableStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    }
                });
            }

            const params = baseParams as unknown as OpenAI.Images.ImageGenerateParamsNonStreaming;
            console.log(`[OpenAI SDK] Using apiKey=present, baseUrlSource=${apiBaseUrlSource}`);
            console.log('Calling OpenAI generate with params:', params);
            result = await dynamicOpenai.images.generate(params);
        } else if (mode === 'edit') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            // gpt-image-2 accepts arbitrary WxH strings that the SDK's narrow literal union doesn't express.
            const size = ((formData.get('size') as string) || 'auto') as OpenAI.Images.ImageEditParams['size'];
            const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'auto';

            const imageFiles: File[] = [];
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('image_') && value instanceof File) {
                    imageFiles.push(value);
                }
            }

            if (imageFiles.length === 0) {
                return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
            }

            const maskFile = formData.get('mask') as File | null;

            const baseEditParams = mergeRequestParams({
                model,
                prompt,
                image: imageFiles,
                n: Math.max(1, Math.min(n || 1, 10)),
                size: size === 'auto' ? undefined : size,
                quality: quality === 'auto' ? undefined : quality
            }, providerOptions);

            // Handle streaming mode for editing
            if (streamEnabled) {
                console.log('Calling OpenAI edit with streaming, params:', formatEditParamsForLog(
                    baseEditParams,
                    imageFiles,
                    maskFile,
                    { stream: true, partial_images: partialImagesCount }
                ));

                console.log(`[OpenAI SDK edit stream] apiKey=present, baseUrlSource=${apiBaseUrlSource}`);
                const streamEditParams = {
                    ...baseEditParams,
                    stream: true as const,
                    partial_images: Math.max(1, Math.min(partialImagesCount, 3)) as 1 | 2 | 3,
                    ...(maskFile ? { mask: maskFile } : {})
                } as unknown as OpenAI.Images.ImageEditParamsStreaming;

                const stream = await dynamicOpenai.images.edit(streamEditParams);

                // Create SSE response for edit
                const encoder = new TextEncoder();
                const timestamp = Date.now();
                const fileExtension = 'png'; // Edit mode always outputs PNG

                const readableStream = new ReadableStream({
                    async start(controller) {
                        try {
                            const completedImages: Array<{
                                filename: string;
                                b64_json: string;
                                path?: string;
                                output_format: string;
                            }> = [];
                            let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
                            let imageIndex = 0;

                            for await (const event of stream) {
                                if (event.type === 'image_edit.partial_image') {
                                    const partialEvent: StreamingEvent = {
                                        type: 'partial_image',
                                        index: imageIndex,
                                        partial_image_index: event.partial_image_index,
                                        b64_json: event.b64_json
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));
                                } else if (event.type === 'image_edit.completed') {
                                    const currentIndex = imageIndex;
                                    const filename = `${timestamp}-${currentIndex}.${fileExtension}`;

                                    // Save to filesystem if in fs mode
                                    if (effectiveStorageMode === 'fs' && event.b64_json) {
                                        const buffer = Buffer.from(event.b64_json, 'base64');
                                        const filepath = path.join(outputDir, filename);
                                        await fs.writeFile(filepath, buffer);
                                        console.log(`Streaming edit: Saved image ${filename}`);
                                    }

                                    const imageData = {
                                        filename,
                                        b64_json: event.b64_json || '',
                                        output_format: fileExtension,
                                        ...(effectiveStorageMode === 'fs' ? { path: `/api/image/${filename}` } : {})
                                    };
                                    completedImages.push(imageData);

                                    const completedEvent: StreamingEvent = {
                                        type: 'completed',
                                        index: currentIndex,
                                        filename,
                                        b64_json: event.b64_json,
                                        path: effectiveStorageMode === 'fs' ? `/api/image/${filename}` : undefined,
                                        output_format: fileExtension
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`));

                                    imageIndex++;

                                    // Capture usage from completed event if available
                                    if ('usage' in event && event.usage) {
                                        finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                                    }
                                }
                            }

                            // Send final done event with all images and usage
                            const doneEvent: StreamingEvent = {
                                type: 'done',
                                images: completedImages,
                                usage: finalUsage
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneEvent)}\n\n`));
                            controller.close();
                        } catch (error) {
                            console.error('Streaming edit error:', error);
                            const errorEvent: StreamingEvent = {
                                type: 'error',
                                error: formatApiError(error, 'Streaming error occurred')
                            };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
                            controller.close();
                        }
                    }
                });

                return new Response(readableStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    }
                });
            }

            const params = {
                ...baseEditParams,
                ...(maskFile ? { mask: maskFile } : {})
            } as unknown as OpenAI.Images.ImageEditParamsNonStreaming;

            console.log(`[OpenAI SDK] Using apiKey=present, baseUrlSource=${apiBaseUrlSource}`);
            console.log('Calling OpenAI edit with params:', formatEditParamsForLog(params, imageFiles, maskFile));
            result = await dynamicOpenai.images.edit(params);
        } else {
            return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 });
        }

        console.log('OpenAI API call successful.');

        if (hasApiErrorPayload(result)) {
            return NextResponse.json({ error: formatApiError(result) }, { status: 502 });
        }

        if (!result || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('Invalid or empty data received from OpenAI API:', result);
            return NextResponse.json({ error: 'Failed to retrieve image data from API.' }, { status: 500 });
        }

        const savedImagesData = await saveOpenAIImages(
            result.data,
            effectiveStorageMode,
            mode === 'edit' ? 'png' : validateOutputFormat(formData.get('output_format'))
        );

        console.log(`All images processed. Mode: ${effectiveStorageMode}`);

        return NextResponse.json({ images: savedImagesData, usage: result.usage });
    } catch (error: unknown) {
        console.error('Error in /api/images:', error);

        const errorMessage = formatApiError(error, 'An unexpected error occurred.');
        const status = getApiErrorStatus(error, 500);

        return NextResponse.json({ error: errorMessage }, { status });
    }
}
