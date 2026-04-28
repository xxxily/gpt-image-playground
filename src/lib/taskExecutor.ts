import OpenAI from 'openai';
import { db } from '@/lib/db';
import { calculateApiCost, type GptImageModel } from '@/lib/cost-utils';
import { loadConfig } from '@/lib/config';
import type { HistoryMetadata, ImageBackground, ImageModeration, ImageOutputFormat, ImageQuality } from '@/types/history';

export type TaskExecutionParams = {
    connectionMode: 'proxy' | 'direct';
    apiKey?: string;
    apiBaseUrl?: string;
    passwordHash?: string;
    imageStorageMode: 'fs' | 'indexeddb' | 'auto';

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

function getMimeTypeFromFormat(format: string): string {
    if (format === 'jpeg') return 'image/jpeg';
    if (format === 'webp') return 'image/webp';
    return 'image/png';
}

async function processImagesForTask(
    inputImages: { filename: string; b64_json?: string; path?: string; output_format?: string }[],
    storageMode: 'fs' | 'indexeddb'
): Promise<{ results: { path: string; filename: string }[]; actualStorageMode: 'fs' | 'indexeddb' }> {
    console.log(`[TaskExecutor] processImagesForTask: Input ${inputImages.length} images, requested storageMode: ${storageMode}`);
    inputImages.forEach((img, idx) => {
        console.log(`  [${idx}] ${img.filename}: hasPath=${!!img.path}, hasB64=${!!img.b64_json}`);
    });

    const results: { path: string; filename: string }[] = [];
    let usedFallback = false;

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
                const blob = new Blob([new Uint8Array(byteNums)], { type: getMimeTypeFromFormat(img.output_format || 'png') });
                const blobUrl = URL.createObjectURL(blob);

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
            } catch (e) {
                console.error(`Failed to process image ${img.filename}`, e);
            }
        }
    }

    // Determine actual storage mode used
    const actualStorageMode = usedFallback ? 'indexeddb' : storageMode;
    console.log(`[TaskExecutor] processImagesForTask: Completed, actualStorageMode: ${actualStorageMode}`);

    return { results, actualStorageMode };
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
    storageModeUsed: 'fs' | 'indexeddb',
    usage: OpenAI.Images.ImagesResponse['usage'] | undefined
): HistoryMetadataEntry {
    return {
        timestamp: Date.now(),
        images: images.map(img => ({ filename: img.filename })),
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

        if (params.connectionMode === 'direct') {
            return executeDirectMode(params, startTime);
        } else {
            return executeProxyMode(params, startTime);
        }
    } catch (err: unknown) {
        if (params.signal?.aborted) {
            return '任务已取消';
        }
        const msg = err instanceof Error ? err.message : '未知错误';
        if (params.connectionMode === 'direct' && (msg.toLowerCase().includes('cors') || msg.toLowerCase().includes('fetch'))) {
            return `直连模式请求失败：目标地址可能不支持 CORS。原始错误: ${msg}`;
        }
        return msg;
    }
}

async function executeDirectMode(
    params: TaskExecutionParams,
    startTime: number
): Promise<TaskResult | TaskError> {
    const { apiKey, apiBaseUrl, signal, onProgress } = params;

    if (!apiKey) {
        return '直连模式需要配置 API Key，请在系统设置中填写。';
    }

    const directClient = new OpenAI({
        apiKey,
        ...(apiBaseUrl && { baseURL: apiBaseUrl }),
        dangerouslyAllowBrowser: true,
    });

    const storageMode = params.imageStorageMode === 'fs' ? 'fs' : 'indexeddb';

    if (params.mode === 'generate') {
        const baseParams: OpenAI.Images.ImageGenerateParams = {
            model: params.model,
            prompt: params.prompt,
            n: Math.max(1, Math.min(params.n, 10)),
            size: (params.size ?? 'auto') as OpenAI.Images.ImageGenerateParams['size'],
            quality: params.quality,
            output_format: params.output_format,
            background: params.background,
            moderation: params.moderation,
        };

        if ((params.output_format === 'jpeg' || params.output_format === 'webp') && params.output_compression !== undefined) {
            baseParams.output_compression = params.output_compression;
        }

        if (params.enableStreaming) {
            const actualPartial = Math.max(1, Math.min(params.partialImages, 3)) as 1 | 2 | 3;
            const stream = await directClient.images.generate({
                ...baseParams,
                stream: true as const,
                partial_images: actualPartial,
            });

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

            const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode);
            const historyEntry = buildHistoryEntry(
                completedImages, startTime, durationMs, params.model, 'generate',
                params.quality ?? 'auto', params.background ?? 'auto', params.moderation ?? 'auto',
                params.output_format ?? 'png', params.prompt, actualStorageMode, finalUsage
            );

            return { images: paths, historyEntry, durationMs };
        }

        const result = await directClient.images.generate(baseParams);
        if (!result.data?.length) return 'API 响应中没有有效的图片数据。';

        const durationMs = Date.now() - startTime;
        const completedImages: CompletedImage[] = result.data.map((img, i) => ({
            filename: `${Date.now()}-${i}.png`,
            b64_json: img.b64_json || '',
            output_format: params.output_format ?? 'png',
        }));

        const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode);
        const historyEntry = buildHistoryEntry(
            completedImages, startTime, durationMs, params.model, 'generate',
            params.quality ?? 'auto', params.background ?? 'auto', params.moderation ?? 'auto',
            params.output_format ?? 'png', params.prompt, actualStorageMode, result.usage
        );

        return { images: paths, historyEntry, durationMs };

    } else {
        const editImages = params.editImages ?? [];
        if (editImages.length === 0) return '编辑模式至少需要一张图片。';

        const editParams: OpenAI.Images.ImageEditParams = {
            model: params.model,
            prompt: params.prompt,
            image: editImages,
            n: Math.max(1, Math.min(params.n, 10)),
            size: params.size === 'auto' ? undefined : (params.size as OpenAI.Images.ImageEditParams['size']),
            quality: params.quality === 'auto' ? undefined : params.quality,
            ...(params.editMaskFile ? { mask: params.editMaskFile } : {}),
        };

        if (params.enableStreaming) {
            const actualPartial = Math.max(1, Math.min(params.partialImages, 3)) as 1 | 2 | 3;
            const stream = await directClient.images.edit({
                ...editParams,
                stream: true as const,
                partial_images: actualPartial,
            });

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

            const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode);
            const historyEntry = buildHistoryEntry(
                completedImages, startTime, durationMs, params.model, 'edit',
                params.quality ?? 'auto', 'auto', 'auto', 'png', params.prompt, actualStorageMode, finalUsage
            );

            return { images: paths, historyEntry, durationMs };
        }

        const result = await directClient.images.edit(editParams);
        if (!result.data?.length) return 'API 响应中没有有效的图片数据。';

        const durationMs = Date.now() - startTime;
        const completedImages: CompletedImage[] = result.data.map((img, i) => ({
            filename: `${Date.now()}-${i}.png`,
            b64_json: img.b64_json || '',
            output_format: 'png',
        }));

        const { results: paths, actualStorageMode } = await processImagesForTask(completedImages, storageMode);
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
    if (cfg.openaiApiKey) apiFormData.append('x_config_api_key', cfg.openaiApiKey);
    if (cfg.openaiApiBaseUrl) apiFormData.append('x_config_api_base_url', cfg.openaiApiBaseUrl);
    if (cfg.imageStorageMode && cfg.imageStorageMode !== 'auto') apiFormData.append('x_config_storage_mode', cfg.imageStorageMode);

    const headers: HeadersInit = {};
    if (passwordHash) headers['x-app-password'] = passwordHash;

    const response = await fetch('/api/images', {
        method: 'POST',
        body: apiFormData,
        headers,
        signal,
    });

    const contentType = response.headers.get('content-type');
    const storageMode = (() => {
        const mode = params.imageStorageMode;
        if (mode && mode !== 'auto') return mode as 'fs' | 'indexeddb';
        const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
        if (vercelEnv === 'production' || vercelEnv === 'preview') return 'indexeddb';
        return 'indexeddb';
    })();

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
                        throw new Error(event.error || 'Streaming error occurred');
                    } else if (event.type === 'done') {
                        if (event.images) {
                            const completionImages = event.images.map((img: CompletedImage) => ({
                                filename: img.filename,
                                b64_json: img.b64_json,
                                path: img.path,
                                output_format: img.output_format || params.output_format || 'png',
                            }));

                            const { results: paths, actualStorageMode } = await processImagesForTask(completionImages, storageMode);
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

    const result = await response.json();

    if (!response.ok) {
        if (response.status === 401 && params.passwordHash) {
            return '密码错误。请重新输入。';
        }
        return result.error || `API request failed with status ${response.status}`;
    }

    if (!result.images?.length) return 'API 响应中没有有效的图片数据或文件名。';

    const durationMs = Date.now() - startTime;
    const completionImages = result.images.map((img: CompletedImage) => ({
        filename: img.filename,
        b64_json: img.b64_json,
        path: img.path,
        output_format: img.output_format || params.output_format || 'png',
    }));

    const { results: paths, actualStorageMode } = await processImagesForTask(completionImages, storageMode);
    const historyEntry = buildHistoryEntry(
        completionImages, startTime, durationMs, params.model,
        params.mode, params.quality ?? 'auto',
        params.mode === 'generate' ? (params.background ?? 'auto') : 'auto',
        params.mode === 'generate' ? (params.moderation ?? 'auto') : 'auto',
        params.output_format ?? 'png', params.prompt, actualStorageMode, result.usage
    );

    return { images: paths, historyEntry, durationMs };
}
