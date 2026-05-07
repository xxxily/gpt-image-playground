import OpenAI from 'openai';
import { formatApiError, hasApiErrorPayload } from '@/lib/api-error';
import { db } from '@/lib/db';
import { appendDesktopAppGuidance, isLikelyWebDirectAccessError } from '@/lib/desktop-guidance';
import { invokeDesktopCommand, invokeDesktopStreamingCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import { calculateApiCost, type GptImageModel } from '@/lib/cost-utils';
import { loadConfig } from '@/lib/config';
import { desktopProxyConfigFromAppConfig, type DesktopProxyConfig } from '@/lib/desktop-config';
import { getImageModel, getModelProvider, isOpenAIImageModel, type StoredCustomImageModel } from '@/lib/model-registry';
import { getProviderCredentialConfig, getProviderDefaultBaseUrl } from '@/lib/provider-config';
import { mergeProviderOptions, type ProviderOptions } from '@/lib/provider-options';
import { editGeminiImage, generateGeminiImage } from '@/lib/providers/google-gemini';
import { editOpenAICompatibleImage, generateOpenAICompatibleImage, type OpenAICompatibleProviderDefaults } from '@/lib/providers/openai-compatible';
import { getOpenAICompatibleProviderDefaults } from '@/lib/providers/openai-compatible-presets';
import type { ProviderUsage } from '@/lib/provider-types';
import type { HistoryMetadata, ImageBackground, ImageModeration, ImageOutputFormat, ImageQuality, ImageStorageMode } from '@/types/history';

export type TaskExecutionParams = {
    connectionMode: 'proxy' | 'direct';
    apiKey?: string;
    apiBaseUrl?: string;
    geminiApiKey?: string;
    geminiApiBaseUrl?: string;
    sensenovaApiKey?: string;
    sensenovaApiBaseUrl?: string;
    seedreamApiKey?: string;
    seedreamApiBaseUrl?: string;
    customImageModels?: StoredCustomImageModel[];
    providerOptions?: ProviderOptions;
    passwordHash?: string;
    imageStorageMode: 'fs' | 'indexeddb' | 'auto';
    imageStoragePath?: string;

    mode: 'generate' | 'edit';
    model: GptImageModel;
    prompt: string;
    n: number;
    size?: string;
    quality?: 'low' | 'medium' | 'high' | 'auto';
    output_format?: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background?: 'transparent' | 'opaque' | 'auto';
    moderation?: 'low' | 'auto';

    editImages?: File[];
    editMaskFile?: File | null;

    enableStreaming: boolean;
    partialImages: 1 | 2 | 3;

    onProgress?: (progress: TaskProgress) => void;
    signal?: AbortSignal;
};

export type TaskProgress =
    | { type: 'streaming_partial'; index: number; b64_json: string }
    | { type: 'streaming_complete'; imageCount: number; data: CompletedImage[] };

export type CompletedImage = {
    filename: string;
    b64_json?: string;
    path?: string;
    output_format: string;
};

export type TaskResult = {
    images: { path: string; filename: string }[];
    historyEntry: HistoryMetadataEntry;
    durationMs: number;
};

export type HistoryMetadataEntry = HistoryMetadata;

export type TaskError = string;

type ProxyImagesResponse = {
    images: CompletedImage[];
    usage?: ProviderUsage;
};

type OpenAIImageData = {
    b64_json?: string | null;
    url?: string | null;
};

type DesktopProxyProvider = 'openai' | 'google' | 'sensenova' | 'seedream';

type DesktopProxyImageFile = {
    name: string;
    mimeType: string;
    bytes: number[];
};

type DesktopProxyImagesRequest = {
    mode: 'generate' | 'edit';
    model: string;
    prompt: string;
    n: number;
    size?: string;
    quality?: string;
    outputFormat?: string;
    outputCompression?: number;
    background?: string;
    moderation?: string;
    provider: DesktopProxyProvider;
    apiKey?: string;
    apiBaseUrl?: string;
    providerOptions: ProviderOptions;
    editImages: DesktopProxyImageFile[];
    editMaskFile?: DesktopProxyImageFile;
    enableStreaming: boolean;
    partialImages: 1 | 2 | 3;
    proxyConfig?: DesktopProxyConfig;
    debugMode?: boolean;
};

type DesktopProxyError = {
    message?: string;
    status?: number;
};

type DesktopLocalImageSaveResult = {
    path: string;
    filename: string;
};

type DesktopStreamingEventPayload = {
    eventType: string;
    data: Record<string, unknown>;
};

function isProxyImagesResponse(value: unknown): value is ProxyImagesResponse {
    if (typeof value !== 'object' || value === null) return false;

    const record = value as { images?: unknown };
    return Array.isArray(record.images) && record.images.length > 0;
}

function getMimeTypeFromFormat(format: string): string {
    if (format === 'jpeg') return 'image/jpeg';
    if (format === 'webp') return 'image/webp';
    return 'image/png';
}

function normalizeImageOutputFormat(value: string | undefined): ImageOutputFormat {
    if (value === 'jpeg' || value === 'webp' || value === 'png') return value;
    return 'png';
}

function getStorageMode(params: TaskExecutionParams): 'fs' | 'indexeddb' {
    const mode = params.imageStorageMode;
    if (mode && mode !== 'auto') return mode as 'fs' | 'indexeddb';

    const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
    const isOnVercel = vercelEnv === 'production' || vercelEnv === 'preview';

    if (explicitMode === 'fs') return 'fs';
    if (explicitMode === 'indexeddb') return 'indexeddb';
    return isOnVercel ? 'indexeddb' : 'fs';
}

function isDesktopProxyProvider(value: string): value is DesktopProxyProvider {
    return value === 'openai' || value === 'google' || value === 'sensenova' || value === 'seedream';
}

function bytesToNumberArray(bytes: Uint8Array): number[] {
    return Array.from(bytes);
}

async function fileToDesktopProxyImage(file: File): Promise<DesktopProxyImageFile> {
    return {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        bytes: bytesToNumberArray(new Uint8Array(await file.arrayBuffer()))
    };
}

function normalizeDesktopProxyError(error: unknown): string {
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null) {
        const record = error as DesktopProxyError;
        if (typeof record.message === 'string' && record.message.trim()) return record.message;
    }
    return formatApiError(error, '桌面端 Rust 中转请求失败。');
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function parseProviderUsage(value: unknown): ProviderUsage | undefined {
    const record = asRecord(value);
    if (!record) return undefined;

    const usage: ProviderUsage = {};
    const outputTokens = record.output_tokens;
    if (outputTokens !== undefined) {
        if (typeof outputTokens !== 'number') return undefined;
        usage.output_tokens = outputTokens;
    }

    const detailsRecord = asRecord(record.input_tokens_details);
    if (detailsRecord) {
        const details: NonNullable<ProviderUsage['input_tokens_details']> = {};
        const textTokens = detailsRecord.text_tokens;
        const imageTokens = detailsRecord.image_tokens;

        if (textTokens !== undefined) {
            if (typeof textTokens !== 'number') return undefined;
            details.text_tokens = textTokens;
        }
        if (imageTokens !== undefined) {
            if (typeof imageTokens !== 'number') return undefined;
            details.image_tokens = imageTokens;
        }
        usage.input_tokens_details = details;
    } else if (record.input_tokens_details !== undefined) {
        return undefined;
    }

    return usage;
}

async function buildDesktopProxyImagesRequest(params: TaskExecutionParams): Promise<DesktopProxyImagesRequest | TaskError> {
    const provider = getModelProvider(params.model, params.customImageModels);
    if (!isDesktopProxyProvider(provider)) {
        return `${provider} 暂未接入桌面端 Rust 中转，请切换到客户端直连或等待支持。`;
    }

    const cfg = loadConfig();
    const mergedConfig = {
        ...cfg,
        ...(params.apiKey !== undefined ? { openaiApiKey: params.apiKey } : {}),
        ...(params.apiBaseUrl !== undefined ? { openaiApiBaseUrl: params.apiBaseUrl } : {}),
        ...(params.geminiApiKey !== undefined ? { geminiApiKey: params.geminiApiKey } : {}),
        ...(params.geminiApiBaseUrl !== undefined ? { geminiApiBaseUrl: params.geminiApiBaseUrl } : {}),
        ...(params.sensenovaApiKey !== undefined ? { sensenovaApiKey: params.sensenovaApiKey } : {}),
        ...(params.sensenovaApiBaseUrl !== undefined ? { sensenovaApiBaseUrl: params.sensenovaApiBaseUrl } : {}),
        ...(params.seedreamApiKey !== undefined ? { seedreamApiKey: params.seedreamApiKey } : {}),
        ...(params.seedreamApiBaseUrl !== undefined ? { seedreamApiBaseUrl: params.seedreamApiBaseUrl } : {})
    };
    const providerConfig = getProviderCredentialConfig(mergedConfig, provider);
    const modelDefinition = getImageModel(params.model, params.customImageModels);
    const openAICompatibleProviderDefaults = getOpenAICompatibleProviderDefaults(provider);
    const defaultProviderOptions = openAICompatibleProviderDefaults
        ? params.mode === 'edit'
            ? openAICompatibleProviderDefaults.defaultEditParams
            : openAICompatibleProviderDefaults.defaultGenerateParams
        : undefined;
    const providerOptions = mergeProviderOptions(
        defaultProviderOptions,
        modelDefinition.providerOptions,
        params.providerOptions
    );

    if (params.mode === 'edit' && !modelDefinition.supportsEditing) {
        return `${modelDefinition.label} 暂不支持图像编辑。`;
    }
    if (params.mode === 'edit' && params.editMaskFile && !modelDefinition.supportsMask && provider !== 'openai') {
        return `${modelDefinition.label} 暂不支持蒙版编辑，请移除蒙版后重试。`;
    }

    const editImages = params.mode === 'edit'
        ? await Promise.all((params.editImages ?? []).map(fileToDesktopProxyImage))
        : [];
    if (params.mode === 'edit' && editImages.length === 0) {
        return '编辑模式至少需要一张图片。';
    }
    const editMaskFile = params.editMaskFile ? await fileToDesktopProxyImage(params.editMaskFile) : undefined;

    const proxyConfig = desktopProxyConfigFromAppConfig(cfg);

    const request = {
        mode: params.mode,
        model: params.model,
        prompt: params.prompt,
        n: params.n,
        size: params.size ?? modelDefinition.defaultSize ?? (params.mode === 'generate' ? 'auto' : undefined),
        quality: params.quality,
        outputFormat: params.output_format,
        outputCompression: params.output_compression,
        background: params.background,
        moderation: params.moderation,
        provider,
        apiKey: providerConfig.apiKey || undefined,
        apiBaseUrl: providerConfig.apiBaseUrl || getProviderDefaultBaseUrl(provider),
        providerOptions,
        editImages,
        enableStreaming: params.enableStreaming,
        partialImages: params.partialImages,
        proxyConfig,
        debugMode: cfg.desktopDebugMode,
        ...(editMaskFile ? { editMaskFile } : {})
    };

    if (cfg.desktopDebugMode) {
        console.info('[Desktop proxy debug] image request', {
            provider,
            mode: params.mode,
            model: params.model,
            imageCount: params.n,
            streaming: params.enableStreaming,
            proxyMode: proxyConfig.mode,
            hasApiBaseUrl: Boolean(providerConfig.apiBaseUrl),
            hasProviderOptions: Object.keys(providerOptions).length > 0,
        });
    }

    return request;
}

async function processImagesForTask(
    inputImages: { filename: string; b64_json?: string; path?: string; output_format?: string }[],
    storageMode: 'fs' | 'indexeddb',
    options: { desktopStoragePath?: string } = {}
): Promise<{ results: { path: string; filename: string }[]; actualStorageMode: ImageStorageMode }> {
    console.log(`[TaskExecutor] processImagesForTask: Input ${inputImages.length} images, requested storageMode: ${storageMode}`);
    inputImages.forEach((img, idx) => {
        console.log(`  [${idx}] ${img.filename}: hasPath=${!!img.path}, hasB64=${!!img.b64_json}`);
    });

    const results: { path: string; filename: string }[] = [];
    let usedFallback = false;
    let usedDesktopFilesystem = false;

    for (const img of inputImages) {
        if (img.path) {
            console.log(`  ✓ Using existing path for ${img.filename}: ${img.path}`);
            results.push({ path: img.path, filename: img.filename });
        } else if (img.b64_json) {
            console.log(`  → Processing base64 data for ${img.filename}`);
            try {
                const byteChars = atob(img.b64_json);
                const byteNums = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
                const byteArray = new Uint8Array(byteNums);
                const blob = new Blob([byteArray], { type: getMimeTypeFromFormat(img.output_format || 'png') });
                const blobUrl = URL.createObjectURL(blob);

                if (storageMode === 'fs' && isTauriDesktop()) {
                    const saveResult = await invokeDesktopCommand<DesktopLocalImageSaveResult>('save_local_image', {
                        filename: img.filename,
                        bytes: bytesToNumberArray(byteArray),
                        customStoragePath: options.desktopStoragePath?.trim() || undefined
                    });
                    img.filename = saveResult.filename;
                    img.path = saveResult.path;
                    delete img.b64_json;
                    usedDesktopFilesystem = true;
                    console.log(`  ✓ Saved ${saveResult.filename} to desktop filesystem: ${saveResult.path}`);
                    results.push({ path: blobUrl, filename: saveResult.filename });
                    continue;
                }

                // Direct Mode Fallback: Always save to IndexedDB if no path exists
                // (browser cannot write to server filesystem)
                if (!img.path && img.b64_json) {
                    if (storageMode === 'fs') {
                        console.warn(`⚠️ [TaskExecutor] Storage mode conflict: Fallback to IndexedDB for ${img.filename} because base64 data received without file path (Direct Mode).`);
                        usedFallback = true;
                    }
                    await db.images.put({ filename: img.filename, blob });
                    console.log(`  ✓ Saved ${img.filename} to IndexedDB`);
                }

                results.push({ path: blobUrl, filename: img.filename });
            } catch (e: unknown) {
                console.error(`Failed to process image ${img.filename}`, e);
                const message = e instanceof Error ? e.message : '未知错误';
                throw new Error(`处理图片 ${img.filename} 失败：${message}`);
            }
        }
    }

    // Determine actual storage mode used
    const actualStorageMode: ImageStorageMode = usedDesktopFilesystem
        ? 'fs'
        : inputImages.every((img) => Boolean(img.path) && !img.b64_json)
        ? 'url'
        : usedFallback
            ? 'indexeddb'
            : storageMode;
    console.log(`[TaskExecutor] processImagesForTask: Completed, actualStorageMode: ${actualStorageMode}`);

    return { results, actualStorageMode };
}

function normalizeOpenAIImages(
    data: OpenAIImageData[],
    outputFormat: string,
    timestamp: number = Date.now()
): CompletedImage[] {
    return data
        .map((img, index): CompletedImage | null => {
            if (img.b64_json) {
                return {
                    filename: `${timestamp}-${index}.${outputFormat}`,
                    b64_json: img.b64_json,
                    output_format: outputFormat
                };
            }

            if (img.url) {
                return {
                    filename: `${timestamp}-${index}.${outputFormat}`,
                    path: img.url,
                    output_format: outputFormat
                };
            }

            return null;
        })
        .filter((image): image is CompletedImage => image !== null);
}

function buildHistoryEntry(
    images: { filename: string; b64_json?: string; path?: string; output_format?: string }[],
    startTime: number,
    durationMs: number,
    model: GptImageModel,
    mode: 'generate' | 'edit',
    quality: ImageQuality,
    background: ImageBackground,
    moderation: ImageModeration,
    outputFormat: ImageOutputFormat,
    prompt: string,
    storageModeUsed: ImageStorageMode,
    usage: ProviderUsage | undefined
): HistoryMetadataEntry {
    return {
        timestamp: Date.now(),
        images: images.map(img => ({ filename: img.filename, path: img.path })),
        storageModeUsed,
        durationMs,
        quality,
        background,
        moderation,
        output_format: outputFormat,
        prompt,
        mode,
        costDetails: calculateApiCost(usage, model),
        model,
    };
}

export async function executeTask(params: TaskExecutionParams): Promise<TaskResult | TaskError> {
    const startTime = Date.now();

    try {
        if (params.signal?.aborted) {
            return '任务已取消';
        }

        const provider = getModelProvider(params.model, params.customImageModels);
        const openAICompatibleProviderDefaults = getOpenAICompatibleProviderDefaults(provider);

        if (openAICompatibleProviderDefaults) {
            if (params.enableStreaming) {
                return `${openAICompatibleProviderDefaults.providerLabel} 暂不支持流式预览，请关闭流式预览后重试。`;
            }

            return params.connectionMode === 'direct'
                ? executeOpenAICompatibleProviderMode(params, startTime, openAICompatibleProviderDefaults)
                : executeProxyMode(params, startTime);
        }

        if (provider === 'google') {
            if (params.enableStreaming) {
                return 'Gemini Nano Banana 2 暂不支持流式预览，请关闭流式预览后重试。';
            }
            return params.connectionMode === 'direct'
                ? executeGeminiMode(params, startTime)
                : executeProxyMode(params, startTime);
        }

        if (params.connectionMode === 'direct') {
            return executeDirectMode(params, startTime);
        } else {
            return executeProxyMode(params, startTime);
        }
    } catch (err: unknown) {
        if (params.signal?.aborted) {
            return '任务已取消';
        }
        const msg = formatApiError(err, '未知错误');
        if (params.connectionMode === 'direct' && isLikelyWebDirectAccessError(msg)) {
            return appendDesktopAppGuidance(`直连模式请求失败：目标地址可能不支持 CORS。原始错误: ${msg}`);
        }
        return msg;
    }
}

async function executeGeminiMode(
    params: TaskExecutionParams,
    startTime: number
): Promise<TaskResult | TaskError> {
    const cfg = loadConfig();
    const providerConfig = {
        apiKey: params.geminiApiKey || cfg.geminiApiKey || undefined,
        baseUrl: params.geminiApiBaseUrl || cfg.geminiApiBaseUrl || undefined
    };
    const storageMode = params.imageStorageMode === 'fs' && params.connectionMode === 'proxy' ? 'fs' : 'indexeddb';
    const providerResult = params.mode === 'generate'
        ? await generateGeminiImage(
            {
                model: params.model,
                prompt: params.prompt,
                n: Math.max(1, Math.min(params.n, 10)),
                size: params.size,
                quality: params.quality,
                output_format: params.output_format,
                output_compression: params.output_compression,
                background: params.background,
                moderation: params.moderation,
                signal: params.signal
            },
            providerConfig
        )
        : await editGeminiImage(
            {
                model: params.model,
                prompt: params.prompt,
                imageFiles: params.editImages ?? [],
                maskFile: params.editMaskFile,
                n: Math.max(1, Math.min(params.n, 10)),
                size: params.size,
                quality: params.quality,
                signal: params.signal
            },
            providerConfig
        );

    const completedImages: CompletedImage[] = providerResult.images.map((image, index) => ({
        filename: `${Date.now()}-${index}.${image.output_format}`,
        b64_json: image.b64_json,
        output_format: image.output_format
    }));

    const durationMs = Date.now() - startTime;
    const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode, { desktopStoragePath: params.imageStoragePath });
    const historyEntry = buildHistoryEntry(
        completedImages,
        startTime,
        durationMs,
        params.model,
        params.mode,
        params.quality ?? 'auto',
        params.mode === 'generate' ? (params.background ?? 'auto') : 'auto',
        params.mode === 'generate' ? (params.moderation ?? 'auto') : 'auto',
        providerResult.images[0]?.output_format ?? params.output_format ?? 'png',
        params.prompt,
        actualStorageMode,
        providerResult.usage
    );

    return { images: paths, historyEntry, durationMs };
}

async function executeOpenAICompatibleProviderMode(
    params: TaskExecutionParams,
    startTime: number,
    providerDefaults: OpenAICompatibleProviderDefaults
): Promise<TaskResult | TaskError> {
    const cfg = loadConfig();
    const provider = getModelProvider(params.model, params.customImageModels);
    const providerConfig = getProviderCredentialConfig(
        {
            ...cfg,
            ...(provider === 'sensenova' && params.sensenovaApiKey !== undefined ? { sensenovaApiKey: params.sensenovaApiKey } : {}),
            ...(provider === 'sensenova' && params.sensenovaApiBaseUrl !== undefined ? { sensenovaApiBaseUrl: params.sensenovaApiBaseUrl } : {}),
            ...(provider === 'seedream' && params.seedreamApiKey !== undefined ? { seedreamApiKey: params.seedreamApiKey } : {}),
            ...(provider === 'seedream' && params.seedreamApiBaseUrl !== undefined ? { seedreamApiBaseUrl: params.seedreamApiBaseUrl } : {})
        },
        provider
    );
    const modelDefinition = getImageModel(params.model, params.customImageModels);
    const providerOptions = { ...(modelDefinition.providerOptions ?? {}), ...(params.providerOptions ?? {}) };
    const storageMode = params.imageStorageMode === 'fs' && params.connectionMode === 'proxy' ? 'fs' : 'indexeddb';
    const providerResult = params.mode === 'generate'
        ? await generateOpenAICompatibleImage(
            {
                model: params.model,
                prompt: params.prompt,
                n: params.n,
                size: params.size ?? modelDefinition.defaultSize,
                quality: params.quality,
                output_format: params.output_format,
                output_compression: params.output_compression,
                background: params.background,
                moderation: params.moderation,
                providerOptions,
                signal: params.signal
            },
            { apiKey: providerConfig.apiKey || undefined, baseUrl: providerConfig.apiBaseUrl || undefined },
            providerDefaults
        )
        : await editOpenAICompatibleImage(
            {
                model: params.model,
                prompt: params.prompt,
                imageFiles: params.editImages ?? [],
                maskFile: params.editMaskFile,
                n: params.n,
                size: params.size ?? modelDefinition.defaultSize,
                quality: params.quality,
                providerOptions,
                signal: params.signal
            },
            { apiKey: providerConfig.apiKey || undefined, baseUrl: providerConfig.apiBaseUrl || undefined },
            providerDefaults
        );

    const completedImages: CompletedImage[] = providerResult.images.map((image, index) => ({
        filename: `${Date.now()}-${index}.${image.output_format}`,
        ...(image.b64_json ? { b64_json: image.b64_json } : {}),
        ...(image.path ? { path: image.path } : {}),
        output_format: image.output_format
    }));

    const durationMs = Date.now() - startTime;
    const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode, { desktopStoragePath: params.imageStoragePath });
    const historyEntry = buildHistoryEntry(
        completedImages,
        startTime,
        durationMs,
        params.model,
        params.mode,
        params.quality ?? 'auto',
        params.mode === 'generate' ? (params.background ?? 'auto') : 'auto',
        params.mode === 'generate' ? (params.moderation ?? 'auto') : 'auto',
        providerResult.images[0]?.output_format ?? params.output_format ?? 'png',
        params.prompt,
        actualStorageMode,
        providerResult.usage
    );

    return { images: paths, historyEntry, durationMs };
}

async function executeDirectMode(
    params: TaskExecutionParams,
    startTime: number
): Promise<TaskResult | TaskError> {
    const { apiKey, apiBaseUrl, signal, onProgress } = params;

    if (!apiKey) {
        return '直连模式需要配置 API Key，请在系统设置中填写。';
    }

    if (!isOpenAIImageModel(params.model, params.customImageModels)) {
        return `OpenAI 执行器不支持模型 ${params.model}`;
    }

    const directClient = new OpenAI({
        apiKey,
        ...(apiBaseUrl && { baseURL: apiBaseUrl }),
        dangerouslyAllowBrowser: true,
    });

    const storageMode = params.imageStorageMode === 'fs' ? 'fs' : 'indexeddb';

    if (params.mode === 'generate') {
        const modelDefinition = getImageModel(params.model, params.customImageModels);
        const providerOptions = { ...(modelDefinition.providerOptions ?? {}), ...(params.providerOptions ?? {}) };
        const baseParams: Record<string, unknown> = {
            model: params.model,
            prompt: params.prompt,
            n: Math.max(1, Math.min(params.n, 10)),
            size: (params.size ?? 'auto') as OpenAI.Images.ImageGenerateParams['size'],
            quality: params.quality,
            output_format: params.output_format,
            background: params.background,
            moderation: params.moderation,
            ...providerOptions
        };

        if ((params.output_format === 'jpeg' || params.output_format === 'webp') && params.output_compression !== undefined) {
            baseParams.output_compression = params.output_compression;
        }

        if (params.enableStreaming) {
            const actualPartial = Math.max(1, Math.min(params.partialImages, 3)) as 1 | 2 | 3;
            const streamParams = {
                ...baseParams,
                stream: true as const,
                partial_images: actualPartial,
            } as unknown as OpenAI.Images.ImageGenerateParamsStreaming;
            const stream = await directClient.images.generate(streamParams);

            let imageIndex = 0;
            const completedImages: CompletedImage[] = [];
            let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;

            for await (const event of stream) {
                if (signal?.aborted) return '任务已取消';

                if (event.type === 'image_generation.partial_image') {
                    onProgress?.({ type: 'streaming_partial', index: imageIndex, b64_json: event.b64_json! });
                } else if (event.type === 'image_generation.completed') {
                    const filename = `${Date.now()}-${imageIndex}.png`;
                    completedImages.push({ filename, b64_json: event.b64_json || '', output_format: params.output_format! });
                    if ('usage' in event && event.usage) {
                        finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                    }
                    imageIndex++;
                }
            }

            const durationMs = Date.now() - startTime;
            if (completedImages.length === 0) {
                return '未生成任何图片';
            }

    const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode, { desktopStoragePath: params.imageStoragePath });
            const historyEntry = buildHistoryEntry(
                completedImages, startTime, durationMs, params.model, 'generate',
                params.quality ?? 'auto', params.background ?? 'auto', params.moderation ?? 'auto',
                params.output_format ?? 'png', params.prompt, actualStorageMode, finalUsage
            );

            return { images: paths, historyEntry, durationMs };
        }

        const result = await directClient.images.generate(baseParams as unknown as OpenAI.Images.ImageGenerateParamsNonStreaming);
        if (hasApiErrorPayload(result)) return formatApiError(result);
        if (!result.data?.length) return 'API 响应中没有有效的图片数据。';

        const durationMs = Date.now() - startTime;
        const outputFormat = params.output_format ?? 'png';
        const completedImages = normalizeOpenAIImages(result.data, outputFormat);
        if (completedImages.length === 0) return 'API 响应中没有有效的图片数据。';

        const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode, { desktopStoragePath: params.imageStoragePath });
        const historyEntry = buildHistoryEntry(
            completedImages, startTime, durationMs, params.model, 'generate',
            params.quality ?? 'auto', params.background ?? 'auto', params.moderation ?? 'auto',
            outputFormat, params.prompt, actualStorageMode, result.usage
        );

        return { images: paths, historyEntry, durationMs };

    } else {
        const editImages = params.editImages ?? [];
        if (editImages.length === 0) return '编辑模式至少需要一张图片。';

        const modelDefinition = getImageModel(params.model, params.customImageModels);
        const providerOptions = { ...(modelDefinition.providerOptions ?? {}), ...(params.providerOptions ?? {}) };
        const editParams: Record<string, unknown> = {
            model: params.model,
            prompt: params.prompt,
            image: editImages,
            n: Math.max(1, Math.min(params.n, 10)),
            size: params.size === 'auto' ? undefined : (params.size as OpenAI.Images.ImageEditParams['size']),
            quality: params.quality === 'auto' ? undefined : params.quality,
            ...providerOptions,
            ...(params.editMaskFile ? { mask: params.editMaskFile } : {}),
        };

        if (params.enableStreaming) {
            const actualPartial = Math.max(1, Math.min(params.partialImages, 3)) as 1 | 2 | 3;
            const streamEditParams = {
                ...editParams,
                stream: true as const,
                partial_images: actualPartial,
            } as unknown as OpenAI.Images.ImageEditParamsStreaming;
            const stream = await directClient.images.edit(streamEditParams);

            let imageIndex = 0;
            const completedImages: CompletedImage[] = [];
            let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;

            for await (const event of stream) {
                if (signal?.aborted) return '任务已取消';

                if (event.type === 'image_edit.partial_image') {
                    onProgress?.({ type: 'streaming_partial', index: imageIndex, b64_json: event.b64_json! });
                } else if (event.type === 'image_edit.completed') {
                    const filename = `${Date.now()}-${imageIndex}.png`;
                    completedImages.push({ filename, b64_json: event.b64_json || '', output_format: 'png' });
                    if ('usage' in event && event.usage) {
                        finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                    }
                    imageIndex++;
                }
            }

            const durationMs = Date.now() - startTime;
            if (completedImages.length === 0) return '未生成任何图片';

    const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode, { desktopStoragePath: params.imageStoragePath });
            const historyEntry = buildHistoryEntry(
                completedImages, startTime, durationMs, params.model, 'edit',
                params.quality ?? 'auto', 'auto', 'auto', 'png', params.prompt, actualStorageMode, finalUsage
            );

            return { images: paths, historyEntry, durationMs };
        }

        const result = await directClient.images.edit(editParams as unknown as OpenAI.Images.ImageEditParamsNonStreaming);
        if (hasApiErrorPayload(result)) return formatApiError(result);
        if (!result.data?.length) return 'API 响应中没有有效的图片数据。';

        const durationMs = Date.now() - startTime;
        const completedImages = normalizeOpenAIImages(result.data, 'png');
        if (completedImages.length === 0) return 'API 响应中没有有效的图片数据。';

        const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode, { desktopStoragePath: params.imageStoragePath });
        const historyEntry = buildHistoryEntry(
            completedImages, startTime, durationMs, params.model, 'edit',
            params.quality ?? 'auto', 'auto', 'auto', 'png', params.prompt, actualStorageMode, result.usage
        );

    return { images: paths, historyEntry, durationMs };
    }
}

async function executeProxyMode(
    params: TaskExecutionParams,
    startTime: number
): Promise<TaskResult | TaskError> {
    if (isTauriDesktop()) {
        return executeDesktopRustProxyMode(params, startTime);
    }

    const { signal, passwordHash, onProgress } = params;

    const apiFormData = new FormData();
    if (params.passwordHash) apiFormData.append('passwordHash', params.passwordHash);
    apiFormData.append('mode', params.mode);

    if (params.enableStreaming) {
        apiFormData.append('stream', 'true');
        apiFormData.append('partial_images', params.partialImages.toString());
    }

    if (params.mode === 'generate') {
        apiFormData.append('model', params.model);
        apiFormData.append('prompt', params.prompt);
        apiFormData.append('n', params.n.toString());
        apiFormData.append('size', params.size ?? 'auto');
        apiFormData.append('quality', params.quality ?? 'auto');
        apiFormData.append('output_format', params.output_format ?? 'png');
        if ((params.output_format === 'jpeg' || params.output_format === 'webp') && params.output_compression !== undefined) {
            apiFormData.append('output_compression', params.output_compression.toString());
        }
        apiFormData.append('background', params.background ?? 'auto');
        apiFormData.append('moderation', params.moderation ?? 'auto');
    } else {
        apiFormData.append('model', params.model);
        apiFormData.append('prompt', params.prompt);
        apiFormData.append('n', params.n.toString());
        apiFormData.append('size', params.size ?? 'auto');
        apiFormData.append('quality', params.quality ?? 'auto');
        if (params.editImages) {
            params.editImages.forEach((file, index) => {
                apiFormData.append(`image_${index}`, file, file.name);
            });
        }
        if (params.editMaskFile) {
            apiFormData.append('mask', params.editMaskFile, params.editMaskFile.name);
        }
    }

    const cfg = loadConfig();
    const proxyApiKey = params.apiKey || cfg.openaiApiKey;
    const proxyApiBaseUrl = params.apiBaseUrl || cfg.openaiApiBaseUrl;
    const proxyGeminiApiKey = params.geminiApiKey || cfg.geminiApiKey;
    const proxyGeminiApiBaseUrl = params.geminiApiBaseUrl || cfg.geminiApiBaseUrl;
    const proxySensenovaApiKey = params.sensenovaApiKey || cfg.sensenovaApiKey;
    const proxySensenovaApiBaseUrl = params.sensenovaApiBaseUrl || cfg.sensenovaApiBaseUrl;
    const proxySeedreamApiKey = params.seedreamApiKey || cfg.seedreamApiKey;
    const proxySeedreamApiBaseUrl = params.seedreamApiBaseUrl || cfg.seedreamApiBaseUrl;
    const proxyCustomImageModels = params.customImageModels ?? cfg.customImageModels;
    const proxyStorageMode = params.imageStorageMode !== 'auto' ? params.imageStorageMode : cfg.imageStorageMode;

    if (proxyApiKey) apiFormData.append('x_config_api_key', proxyApiKey);
    if (proxyApiBaseUrl) apiFormData.append('x_config_api_base_url', proxyApiBaseUrl);
    if (proxyGeminiApiKey) apiFormData.append('x_config_gemini_api_key', proxyGeminiApiKey);
    if (proxyGeminiApiBaseUrl) apiFormData.append('x_config_gemini_api_base_url', proxyGeminiApiBaseUrl);
    if (proxySensenovaApiKey) apiFormData.append('x_config_sensenova_api_key', proxySensenovaApiKey);
    if (proxySensenovaApiBaseUrl) apiFormData.append('x_config_sensenova_api_base_url', proxySensenovaApiBaseUrl);
    if (proxySeedreamApiKey) apiFormData.append('x_config_seedream_api_key', proxySeedreamApiKey);
    if (proxySeedreamApiBaseUrl) apiFormData.append('x_config_seedream_api_base_url', proxySeedreamApiBaseUrl);
    if (proxyCustomImageModels.length > 0) apiFormData.append('x_config_custom_image_models', JSON.stringify(proxyCustomImageModels));
    if (params.providerOptions && Object.keys(params.providerOptions).length > 0) {
        apiFormData.append('provider_options', JSON.stringify(params.providerOptions));
    }
    if (proxyStorageMode && proxyStorageMode !== 'auto') apiFormData.append('x_config_storage_mode', proxyStorageMode);

    const headers: HeadersInit = {};
    if (passwordHash) headers['x-app-password'] = passwordHash;

    const response = await fetch('/api/images', {
        method: 'POST',
        body: apiFormData,
        headers,
        signal,
    });

    const contentType = response.headers.get('content-type');
    const storageMode = getStorageMode(params);

    if (contentType?.includes('text/event-stream')) {
        if (!response.body) return 'Response body is null';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (signal?.aborted) { reader.releaseLock(); return '任务已取消'; }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6);
                try {
                    const event = JSON.parse(jsonStr);

                    if (event.type === 'partial_image') {
                        onProgress?.({ type: 'streaming_partial', index: event.index ?? 0, b64_json: event.b64_json });
                    } else if (event.type === 'error') {
                        return formatApiError(event.error, 'Streaming error occurred');
                    } else if (event.type === 'done') {
                        if (event.images) {
                            const completionImages = event.images.map((img: CompletedImage) => ({
                                filename: img.filename,
                                b64_json: img.b64_json,
                                path: img.path,
                                output_format: img.output_format || params.output_format || 'png',
                            }));

                            const { results: paths, actualStorageMode } = await processImagesForTask(completionImages, storageMode, { desktopStoragePath: params.imageStoragePath });
                            const historyEntry = buildHistoryEntry(
                                completionImages, startTime, event.durationMs ?? Date.now() - startTime, params.model,
                                params.mode, params.quality ?? 'auto',
                                params.mode === 'generate' ? (params.background ?? 'auto') : 'auto',
                                params.mode === 'generate' ? (params.moderation ?? 'auto') : 'auto',
                                params.output_format ?? 'png', params.prompt, actualStorageMode, event.usage
                            );

                            return { images: paths, historyEntry, durationMs: event.durationMs ?? Date.now() - startTime };
                        }
                    }
                } catch (parseError) {
                    console.error('Error parsing SSE event:', parseError);
                }
            }
        }

        return '流式响应未返回完整数据';
    }

    let result: unknown;
    try {
        result = await response.json();
    } catch (error) {
        return formatApiError(error, `API request failed with status ${response.status}`);
    }

    if (!response.ok) {
        if (response.status === 401 && params.passwordHash) {
            return '密码错误。请重新输入。';
        }
        return formatApiError(result, `API request failed with status ${response.status}`);
    }

    if (hasApiErrorPayload(result)) return formatApiError(result);

    if (!isProxyImagesResponse(result)) return 'API 响应中没有有效的图片数据或文件名。';

    const durationMs = Date.now() - startTime;
    const completionImages = result.images.map((img: CompletedImage) => ({
        filename: img.filename,
        b64_json: img.b64_json,
        path: img.path,
        output_format: img.output_format || params.output_format || 'png',
    }));

    const { results: paths, actualStorageMode } = await processImagesForTask(completionImages, storageMode, { desktopStoragePath: params.imageStoragePath });
    const historyEntry = buildHistoryEntry(
        completionImages, startTime, durationMs, params.model,
        params.mode, params.quality ?? 'auto',
        params.mode === 'generate' ? (params.background ?? 'auto') : 'auto',
        params.mode === 'generate' ? (params.moderation ?? 'auto') : 'auto',
        params.output_format ?? 'png', params.prompt, actualStorageMode, result.usage
    );

    return { images: paths, historyEntry, durationMs };
}

async function executeDesktopRustProxyMode(
    params: TaskExecutionParams,
    startTime: number
): Promise<TaskResult | TaskError> {
    if (params.signal?.aborted) return '任务已取消';

    const request = await buildDesktopProxyImagesRequest(params);
    if (typeof request === 'string') return request;

    if (params.enableStreaming) {
        return executeDesktopStreamingProxyMode(params, request, startTime);
    }

    let result: ProxyImagesResponse;
    try {
        result = await invokeDesktopCommand<ProxyImagesResponse>('proxy_images', { request });
    } catch (error) {
        if (params.signal?.aborted) return '任务已取消';
        return normalizeDesktopProxyError(error);
    }

    if (params.signal?.aborted) return '任务已取消';
    if (hasApiErrorPayload(result)) return formatApiError(result);
    if (!isProxyImagesResponse(result)) return 'API 响应中没有有效的图片数据或文件名。';

    const durationMs = Date.now() - startTime;
    const completionImages = result.images.map((img: CompletedImage) => ({
        filename: img.filename,
        b64_json: img.b64_json,
        path: img.path,
        output_format: img.output_format || params.output_format || 'png',
    }));
    const storageMode = getStorageMode(params);
    const { results: paths, actualStorageMode } = await processImagesForTask(completionImages, storageMode, { desktopStoragePath: params.imageStoragePath });
    const historyEntry = buildHistoryEntry(
        completionImages, startTime, durationMs, params.model,
        params.mode, params.quality ?? 'auto',
        params.mode === 'generate' ? (params.background ?? 'auto') : 'auto',
        params.mode === 'generate' ? (params.moderation ?? 'auto') : 'auto',
        normalizeImageOutputFormat(params.output_format ?? completionImages[0]?.output_format), params.prompt, actualStorageMode, result.usage
    );

    return { images: paths, historyEntry, durationMs };
}

async function executeDesktopStreamingProxyMode(
    params: TaskExecutionParams,
    request: DesktopProxyImagesRequest,
    startTime: number
): Promise<TaskResult | TaskError> {
    const provider = getModelProvider(params.model, params.customImageModels);
    if (provider !== 'openai') {
        return `${provider} 暂不支持桌面端流式预览，请关闭流式预览后重试。`;
    }

    let streamingError: string | null = null;
    const completedImages: CompletedImage[] = [];
    let imageIndex = 0;
    let finalUsage: ProviderUsage | undefined;
    if (params.signal?.aborted) return '任务已取消';

    try {
        await invokeDesktopStreamingCommand<DesktopStreamingEventPayload>(
            'proxy_images_streaming',
            { request },
            (event) => {
                if (params.signal?.aborted) return;

                if (event.eventType === 'image_generation.partial_image' || event.eventType === 'image_edit.partial_image') {
                    const b64Value = event.data.b64_json;
                    const indexValue = event.data.index;
                    const b64 = typeof b64Value === 'string' ? b64Value : undefined;
                    const idx = typeof indexValue === 'number' ? indexValue : imageIndex;
                    if (b64) {
                        params.onProgress?.({ type: 'streaming_partial', index: idx, b64_json: b64 });
                    }
                } else if (event.eventType === 'image_generation.completed' || event.eventType === 'image_edit.completed') {
                    const b64Value = event.data.b64_json;
                    const indexValue = event.data.index;
                    const outputFormatValue = event.data.output_format;
                    const b64 = typeof b64Value === 'string' ? b64Value : undefined;
                    const idx = typeof indexValue === 'number' ? indexValue : imageIndex;
                    const outputFormat = typeof outputFormatValue === 'string'
                        ? normalizeImageOutputFormat(outputFormatValue)
                        : normalizeImageOutputFormat(params.mode === 'edit' ? 'png' : params.output_format ?? 'png');
                    if (b64) {
                        completedImages.push({
                            filename: `${Date.now()}-${idx}.png`,
                            b64_json: b64,
                            output_format: outputFormat,
                        });
                        imageIndex = idx + 1;
                    }
                    const parsedUsage = parseProviderUsage(event.data.usage);
                    if (parsedUsage) {
                        finalUsage = parsedUsage;
                    }
                } else if (event.eventType === 'error') {
                    const errorValue = event.data.error;
                    const errorMessage = typeof errorValue === 'string'
                        ? errorValue
                        : typeof errorValue === 'object' && errorValue !== null && 'message' in errorValue && typeof errorValue.message === 'string'
                            ? errorValue.message
                            : undefined;
                    const messageValue = event.data.message;
                    const errMsg = errorMessage || (typeof messageValue === 'string' ? messageValue : undefined) || 'Streaming error';
                    streamingError = errMsg;
                }
            }
        );
    } catch (error) {
        if (params.signal?.aborted) return '任务已取消';
        return normalizeDesktopProxyError(error);
    }

    if (params.signal?.aborted) return '任务已取消';
    if (streamingError) return streamingError;

    if (completedImages.length === 0) {
        return '流式响应未生成任何图片';
    }

    const durationMs = Date.now() - startTime;
    const completionImages: { filename: string; b64_json?: string; path?: string; output_format?: string }[] = completedImages.map((img) => ({
        filename: img.filename,
        b64_json: img.b64_json,
        output_format: img.output_format,
    }));

    const storageMode = getStorageMode(params);
    const { results: paths, actualStorageMode } = await processImagesForTask(completionImages, storageMode, { desktopStoragePath: params.imageStoragePath });
    const historyEntry = buildHistoryEntry(
        completionImages, startTime, durationMs, params.model,
        params.mode, params.quality ?? 'auto',
        params.mode === 'generate' ? (params.background ?? 'auto') : 'auto',
        params.mode === 'generate' ? (params.moderation ?? 'auto') : 'auto',
        normalizeImageOutputFormat(params.output_format ?? completionImages[0]?.output_format), params.prompt, actualStorageMode, finalUsage
    );

    return { images: paths, historyEntry, durationMs };
}
