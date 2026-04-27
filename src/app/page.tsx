'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { PasswordDialog } from '@/components/password-dialog';
import { SettingsDialog } from '@/components/settings-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { calculateApiCost, type CostDetails, type GptImageModel } from '@/lib/cost-utils';
import { getPresetDimensions } from '@/lib/size-utils';
import { db, type ImageRecord } from '@/lib/db';
import { loadConfig, saveConfig, type AppConfig } from '@/lib/config';
import OpenAI from 'openai';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';

type HistoryImage = {
    filename: string;
};

export type HistoryMetadata = {
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: 'fs' | 'indexeddb';
    durationMs: number;
    quality: GenerationFormData['quality'];
    background: GenerationFormData['background'];
    moderation: GenerationFormData['moderation'];
    prompt: string;
    mode: 'generate' | 'edit';
    costDetails: CostDetails | null;
    output_format?: GenerationFormData['output_format'];
    model?: GptImageModel;
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

const MAX_EDIT_IMAGES = 10;

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;

const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}
console.log(
    `Client Effective Storage Mode: ${effectiveStorageModeClient} (Explicit: ${explicitModeClient || 'unset'}, Vercel Env: ${vercelEnvClient || 'N/A'})`
);

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: string;
    path?: string;
};

export default function HomePage() {
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [lastApiCallArgs, setLastApiCallArgs] = React.useState<[GenerationFormData | EditingFormData] | null>(null);
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);
    const [isGlobalDragOver, setIsGlobalDragOver] = React.useState(false);

    const allDbImages = useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const [editPrompt, setEditPrompt] = React.useState('');
    const [editN, setEditN] = React.useState([1]);
    const [editSize, setEditSize] = React.useState<EditingFormData['size']>('auto');
    const [editCustomWidth, setEditCustomWidth] = React.useState<number>(1024);
    const [editCustomHeight, setEditCustomHeight] = React.useState<number>(1024);
    const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>('auto');
    const [editBrushSize, setEditBrushSize] = React.useState([20]);
    const [editShowMaskEditor, setEditShowMaskEditor] = React.useState(false);
    const [editGeneratedMaskFile, setEditGeneratedMaskFile] = React.useState<File | null>(null);
    const [editIsMaskSaved, setEditIsMaskSaved] = React.useState(false);
    const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(
        null
    );
    const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
    const [editMaskPreviewUrl, setEditMaskPreviewUrl] = React.useState<string | null>(null);

    const [genModel, setGenModel] = React.useState<GenerationFormData['model']>('gpt-image-2');
    const [genPrompt, setGenPrompt] = React.useState('');
    const [genN, setGenN] = React.useState([1]);
    const [genSize, setGenSize] = React.useState<GenerationFormData['size']>('portrait');
    const [genCustomWidth, setGenCustomWidth] = React.useState<number>(1024);
    const [genCustomHeight, setGenCustomHeight] = React.useState<number>(1024);
    const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>('auto');
    const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>('png');
    const [genCompression, setGenCompression] = React.useState([100]);
    const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>('auto');
    const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>('low');

    React.useEffect(() => {
        if (mode === 'edit') {
            setEditSize('auto');
        }
    }, [mode, setEditSize]);

    const [appConfig, setAppConfig] = React.useState<AppConfig>(() => loadConfig());

    const handleConfigChange = (newConfig: Partial<AppConfig>) => {
        setAppConfig((prev) => ({ ...prev, ...newConfig }));
    };

    const getConfigHeaders = (): HeadersInit => {
        const headers: HeadersInit = {};
        if (clientPasswordHash) headers['x-app-password'] = clientPasswordHash;
        return headers;
    };

    const appendConfigToFormData = (fd: FormData) => {
        const cfg = loadConfig();
        console.log(`[appendConfig] apiKey=${cfg.openaiApiKey ? cfg.openaiApiKey.substring(0, 8) + '...' : '(none)'}, baseUrl=${cfg.openaiApiBaseUrl || '(none, using ENV)'}`);
        if (cfg.openaiApiKey) fd.append('x_config_api_key', cfg.openaiApiKey);
        if (cfg.openaiApiBaseUrl) fd.append('x_config_api_base_url', cfg.openaiApiBaseUrl);
        if (cfg.imageStorageMode && cfg.imageStorageMode !== 'auto') fd.append('x_config_storage_mode', cfg.imageStorageMode);
    };

    const [editModel, setEditModel] = React.useState<EditingFormData['model']>('gpt-image-2');

    // Streaming state (shared between generate and edit modes)
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);
    // Streaming preview images (base64 data URLs for partial images during streaming)
    const [streamingPreviewImages, setStreamingPreviewImages] = React.useState<Map<number, string>>(new Map());

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => {
            const cached = blobUrlCacheRef.current.get(filename);
            if (cached) return cached;

            const record = allDbImages?.find((img) => img.filename === filename);
            if (record?.blob) {
                const url = URL.createObjectURL(record.blob);
                blobUrlCacheRef.current.set(filename, url);
                return url;
            }

            return undefined;
        },
        [allDbImages]
    );

    React.useEffect(() => {
        const cache = blobUrlCacheRef.current;
        return () => {
            cache.forEach((url) => URL.revokeObjectURL(url));
            cache.clear();
        };
    }, []);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('openaiImageHistory');
            if (storedHistory) {
                const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
                if (Array.isArray(parsedHistory)) {
                    setHistory(parsedHistory);
                } else {
                    console.warn('Invalid history data found in localStorage.');
                    localStorage.removeItem('openaiImageHistory');
                }
            }
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem('openaiImageHistory');
        }
        setIsInitialLoad(false);
    }, []);

    React.useEffect(() => {
        const fetchAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }
                const data = await response.json();
                setIsPasswordRequiredByBackend(data.passwordRequired);
            } catch (error) {
                console.error('Error fetching auth status:', error);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();
        const storedHash = localStorage.getItem('clientPasswordHash');
        if (storedHash) {
            setClientPasswordHash(storedHash);
        }
    }, []);

    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem('openaiImageHistory', JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        const storedPref = localStorage.getItem('imageGenSkipDeleteConfirm');
        if (storedPref === 'true') {
            setSkipDeleteConfirmation(true);
        } else if (storedPref === 'false') {
            setSkipDeleteConfirmation(false);
        }
    }, []);

    React.useEffect(() => {
        localStorage.setItem('imageGenSkipDeleteConfirm', String(skipDeleteConfirmation));
    }, [skipDeleteConfirmation]);

    React.useEffect(() => {
        let dragCounter = 0;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter++;
            if (e.dataTransfer?.types?.includes('Files')) {
                setIsGlobalDragOver(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                setIsGlobalDragOver(false);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            dragCounter = 0;
            setIsGlobalDragOver(false);
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
                if (imageFiles.length === 0) return;

                setEditImageFiles((prev: File[]) => prev.length + imageFiles.length > MAX_EDIT_IMAGES
                    ? prev
                    : [...prev, ...imageFiles.slice(0, MAX_EDIT_IMAGES - prev.length)]
                );
                setEditSourceImagePreviewUrls((prev: string[]) => {
                    const available = MAX_EDIT_IMAGES - prev.length;
                    if (available <= 0) return prev;
                    const toAdd = imageFiles.slice(0, available);
                    return [...prev, ...toAdd.map((file) => URL.createObjectURL(file))];
                });

                if (mode === 'generate') {
                    setMode('edit');
                }
            }
        };

        document.addEventListener('dragenter', handleDragEnter);
        document.addEventListener('dragleave', handleDragLeave);
        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('drop', handleDrop);

        return () => {
            document.removeEventListener('dragenter', handleDragEnter);
            document.removeEventListener('dragleave', handleDragLeave);
            document.removeEventListener('dragover', handleDragOver);
            document.removeEventListener('drop', handleDrop);
        };
    }, [mode]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (!event.clipboardData) {
                return;
            }

            if (editImageFiles.length >= MAX_EDIT_IMAGES) {
                alert(`Cannot paste: Maximum of ${MAX_EDIT_IMAGES} images reached.`);
                return;
            }

            const items = event.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();

                        const previewUrl = URL.createObjectURL(file);

                        setEditImageFiles((prevFiles) => [...prevFiles, file]);
                        setEditSourceImagePreviewUrls((prevUrls) => [...prevUrls, previewUrl]);

                        if (mode === 'generate') {
                            setMode('edit');
                        }

                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [mode, editImageFiles.length]);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
                setError('密码无效。请输入有效密码。');
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
            if (passwordDialogContext === 'retry' && lastApiCallArgs) {
                await handleApiCall(...lastApiCallArgs);
            }
        } catch (e) {
            console.error('Error hashing password:', e);
            setError('Failed to save password due to a hashing error.');
        }
    };

    const handleOpenPasswordDialog = () => {
        setPasswordDialogContext('initial');
        setIsPasswordDialogOpen(true);
    };

    const getMimeTypeFromFormat = (format: string): string => {
        if (format === 'jpeg') return 'image/jpeg';
        if (format === 'webp') return 'image/webp';

        return 'image/png';
    };

    const processDirectResponseData = (
        data: OpenAI.Images.ImagesResponse['data'],
        usage: OpenAI.Images.ImagesResponse['usage'] | undefined,
        startTime: number,
        model: GptImageModel,
        quality: GenerationFormData['quality'],
        background: GenerationFormData['background'],
        moderation: GenerationFormData['moderation'],
        outputFormat: GenerationFormData['output_format'],
        prompt: string,
        callMode: 'generate' | 'edit'
    ) => {
        if (!data) throw new Error('API 响应中没有图片数据');
        const timestamp = Date.now();
        const duration = Date.now() - startTime;
        const images = data.map((img, i) => {
            const b64 = img.b64_json;
            if (!b64) throw new Error(`图片 ${i} 缺少 base64 数据`);
            const ext = outputFormat === 'jpeg' ? 'jpeg' : 'png';
            const filename = `${timestamp}-${i}.${ext}`;
            const byteChars = atob(b64);
            const byteNums = new Array(byteChars.length);
            for (let j = 0; j < byteChars.length; j++) byteNums[j] = byteChars.charCodeAt(j);
            const blob = new Blob([new Uint8Array(byteNums)], { type: getMimeTypeFromFormat(ext) });
            const blobUrl = URL.createObjectURL(blob);
            blobUrlCacheRef.current.set(filename, blobUrl);
            return { path: blobUrl, filename, blob };
        });

        const entry: HistoryMetadata = {
            timestamp,
            images: images.map((img) => ({ filename: img.filename })),
            storageModeUsed: 'indexeddb',
            durationMs: duration,
            quality,
            background,
            moderation,
            output_format: outputFormat,
            prompt,
            mode: callMode,
            costDetails: calculateApiCost(usage, model),
            model,
        };
        return { paths: images, entry, imagesWithBlobs: images };
    };

    const handleDirectApiCall = React.useCallback(async (formData: GenerationFormData | EditingFormData) => {
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setError(null);
        setLatestImageBatch(null);
        setImageOutputView('grid');
        setStreamingPreviewImages(new Map());

        const cfg = loadConfig();
        const apiKey = cfg.openaiApiKey;
        const apiBaseUrl = cfg.openaiApiBaseUrl || undefined;

        if (!apiKey) {
            setError('直连模式需要配置 API Key，请在系统设置中填写。');
            setIsLoading(false);
            return;
        }

        const directClient = new OpenAI({
            apiKey,
            ...(apiBaseUrl && { baseURL: apiBaseUrl }),
            dangerouslyAllowBrowser: true,
        });

        try {
            if (mode === 'generate') {
                const genData = formData as GenerationFormData;
                const genSizeToSend =
                    genSize === 'custom'
                        ? `${genCustomWidth}x${genCustomHeight}`
                        : (getPresetDimensions(genSize, genModel) ?? genSize);

                const baseParams: OpenAI.Images.ImageGenerateParams = {
                    model: genModel,
                    prompt: genPrompt,
                    n: Math.max(1, Math.min(genN[0] || 1, 10)),
                    size: genSizeToSend as OpenAI.Images.ImageGenerateParams['size'],
                    quality: genQuality,
                    output_format: genOutputFormat,
                    background: genBackground,
                    moderation: genModeration,
                };

                if ((genOutputFormat === 'jpeg' || genOutputFormat === 'webp') && genData.output_compression !== undefined) {
                    baseParams.output_compression = genData.output_compression;
                }

                if (enableStreaming) {
                    const actualPartial = Math.max(1, Math.min(partialImages, 3)) as 1 | 2 | 3;
                    const stream = await directClient.images.generate({
                        ...baseParams,
                        stream: true as const,
                        partial_images: actualPartial,
                    });

                    let imageIndex = 0;
                    const completedImages: Array<{ filename: string; b64_json: string; output_format: string }> = [];
                    let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;

                    for await (const event of stream) {
                        if (event.type === 'image_generation.partial_image') {
                            setStreamingPreviewImages((prev) => {
                                const newMap = new Map(prev);
                                newMap.set(imageIndex, `data:image/png;base64,${event.b64_json}`);
                                return newMap;
                            });
                        } else if (event.type === 'image_generation.completed') {
                            const filename = `${Date.now()}-${imageIndex}.png`;
                            const idx = imageIndex;
                            completedImages.push({ filename, b64_json: event.b64_json || '', output_format: genOutputFormat });
                            if ('usage' in event && event.usage) {
                                finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                            }
                            imageIndex++;
                        }
                    }

                    durationMs = Date.now() - startTime;
                    if (completedImages.length > 0) {
                        const costDetails = calculateApiCost(finalUsage, genModel);
                        const newEntry: HistoryMetadata = {
                            timestamp: Date.now(),
                            images: completedImages.map((img) => ({ filename: img.filename })),
                            storageModeUsed: 'indexeddb',
                            durationMs,
                            quality: genQuality,
                            background: genBackground,
                            moderation: genModeration,
                            output_format: genOutputFormat,
                            prompt: genPrompt,
                            mode: 'generate',
                            costDetails,
                            model: genModel,
                        };
                        const processedImages = completedImages.map((img) => {
                            const b64 = img.b64_json;
                            const byteChars = atob(b64);
                            const byteNums = new Array(byteChars.length);
                            for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
                            const blob = new Blob([new Uint8Array(byteNums)], { type: getMimeTypeFromFormat(img.output_format) });
                            const blobUrl = URL.createObjectURL(blob);
                            blobUrlCacheRef.current.set(img.filename, blobUrl);
                            return { path: blobUrl, filename: img.filename, blob };
                        });
                        await Promise.all(processedImages.map((img) => db.images.put({ filename: img.filename, blob: img.blob })));
                        setLatestImageBatch(processedImages.map(({ path, filename }) => ({ path, filename })));
                        setImageOutputView(processedImages.length > 1 ? 'grid' : 0);
                        setStreamingPreviewImages(new Map());
                        setHistory((prev) => [newEntry, ...prev]);
                    }
                    return;
                }

                const result = await directClient.images.generate(baseParams);
                if (!result.data || result.data.length === 0) {
                    throw new Error('API 响应中没有有效的图片数据。');
                }
                const resultUsage = result.usage;
                const processed = processDirectResponseData(result.data, resultUsage, startTime, genModel, genQuality, genBackground, genModeration, genOutputFormat, genPrompt, 'generate');
                await Promise.all(processed.imagesWithBlobs.map((img) => db.images.put({ filename: img.filename, blob: img.blob })));
                const processedPaths = processed.imagesWithBlobs.map(({ path, filename }) => ({ path, filename }));
                setLatestImageBatch(processedPaths);
                setImageOutputView(processedPaths.length > 1 ? 'grid' : 0);
                setHistory((prev) => [processed.entry, ...prev]);

            } else {
                const editImages = editImageFiles.map((f) => f);
                const editSizeToSend =
                    editSize === 'custom'
                        ? `${editCustomWidth}x${editCustomHeight}`
                        : (getPresetDimensions(editSize, editModel) ?? editSize);

                const editParams: OpenAI.Images.ImageEditParams = {
                    model: editModel,
                    prompt: editPrompt,
                    image: editImages,
                    n: Math.max(1, Math.min(editN[0] || 1, 10)),
                    size: editSizeToSend === 'auto' ? undefined : (editSizeToSend as OpenAI.Images.ImageEditParams['size']),
                    quality: editQuality === 'auto' ? undefined : editQuality,
                    ...(editGeneratedMaskFile ? { mask: editGeneratedMaskFile } : {}),
                };

                if (enableStreaming) {
                    const actualPartial = Math.max(1, Math.min(partialImages, 3)) as 1 | 2 | 3;
                    const stream = await directClient.images.edit({
                        ...editParams,
                        stream: true as const,
                        partial_images: actualPartial,
                    });

                    let imageIndex = 0;
                    const completedImages: Array<{ filename: string; b64_json: string; output_format: string }> = [];
                    let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;

                    for await (const event of stream) {
                        if (event.type === 'image_edit.partial_image') {
                            setStreamingPreviewImages((prev) => {
                                const newMap = new Map(prev);
                                newMap.set(imageIndex, `data:image/png;base64,${event.b64_json}`);
                                return newMap;
                            });
                        } else if (event.type === 'image_edit.completed') {
                            const filename = `${Date.now()}-${imageIndex}.png`;
                            completedImages.push({ filename, b64_json: event.b64_json || '', output_format: 'png' });
                            if ('usage' in event && event.usage) {
                                finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                            }
                            imageIndex++;
                        }
                    }

                    durationMs = Date.now() - startTime;
                    if (completedImages.length > 0) {
                        const costDetails = calculateApiCost(finalUsage, editModel);
                        const newEntry: HistoryMetadata = {
                            timestamp: Date.now(),
                            images: completedImages.map((img) => ({ filename: img.filename })),
                            storageModeUsed: 'indexeddb',
                            durationMs,
                            quality: editQuality,
                            background: 'auto',
                            moderation: 'auto',
                            output_format: 'png',
                            prompt: editPrompt,
                            mode: 'edit',
                            costDetails,
                            model: editModel,
                        };
                        const processedEditImages = completedImages.map((img) => {
                            const b64 = img.b64_json;
                            const byteChars = atob(b64);
                            const byteNums = new Array(byteChars.length);
                            for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
                            const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/png' });
                            const blobUrl = URL.createObjectURL(blob);
                            blobUrlCacheRef.current.set(img.filename, blobUrl);
                            return { path: blobUrl, filename: img.filename, blob };
                        });
                        await Promise.all(processedEditImages.map((img) => db.images.put({ filename: img.filename, blob: img.blob })));
                        setLatestImageBatch(processedEditImages.map(({ path, filename }) => ({ path, filename })));
                        setImageOutputView(processedEditImages.length > 1 ? 'grid' : 0);
                        setStreamingPreviewImages(new Map());
                        setHistory((prev) => [newEntry, ...prev]);
                    }
                    return;
                }

                const result = await directClient.images.edit(editParams);
                if (!result.data || result.data.length === 0) {
                    throw new Error('API 响应中没有有效的图片数据。');
                }
                const resultUsage = result.usage;
                const processed = processDirectResponseData(result.data, resultUsage, startTime, editModel, editQuality, 'auto', 'auto', 'png', editPrompt, 'edit');
                await Promise.all(processed.imagesWithBlobs.map((img) => db.images.put({ filename: img.filename, blob: img.blob })));
                const processedPaths = processed.imagesWithBlobs.map(({ path, filename }) => ({ path, filename }));
                setLatestImageBatch(processedPaths);
                setImageOutputView(processedPaths.length > 1 ? 'grid' : 0);
                setHistory((prev) => [processed.entry, ...prev]);
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            const msg = err instanceof Error ? err.message : '直连模式调用失败。';
            console.error('Direct API Call Error:', err);
            if (msg.toLowerCase().includes('cors') || msg.toLowerCase().includes('fetch')) {
                setError(`直连模式请求失败：目标地址可能不支持 CORS。请确认 API Base URL 允许浏览器跨域访问。原始错误: ${msg}`);
            } else {
                setError(msg);
            }
            setLatestImageBatch(null);
            setStreamingPreviewImages(new Map());
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, enableStreaming, partialImages,
        genModel, genPrompt, genN, genSize, genCustomWidth, genCustomHeight, genQuality, genOutputFormat,
        genBackground, genModeration, editModel, editPrompt, editN, editSize, editCustomWidth, editCustomHeight,
        editQuality, editImageFiles, editGeneratedMaskFile]);

    const handleApiCall = React.useCallback(async (formData: GenerationFormData | EditingFormData) => {
        const cfg = loadConfig();
        if (cfg.connectionMode === 'direct') {
            return handleDirectApiCall(formData);
        }

        // Proxy mode (default) — existing server-side routing
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setError(null);
        setLatestImageBatch(null);
        setImageOutputView('grid');
        setStreamingPreviewImages(new Map());

        const apiFormData = new FormData();
        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        } else if (isPasswordRequiredByBackend && !clientPasswordHash) {
                setError('服务器需要密码认证。请点击锁形图标设置密码。');
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            setIsLoading(false);
            return;
        }
        apiFormData.append('mode', mode);

        // Add streaming parameters if enabled
        if (enableStreaming) {
            apiFormData.append('stream', 'true');
            apiFormData.append('partial_images', partialImages.toString());
        }

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            apiFormData.append('model', genModel);
            apiFormData.append('prompt', genPrompt);
            apiFormData.append('n', genN[0].toString());
            const genSizeToSend =
                genSize === 'custom'
                    ? `${genCustomWidth}x${genCustomHeight}`
                    : (getPresetDimensions(genSize, genModel) ?? genSize);
            apiFormData.append('size', genSizeToSend);
            apiFormData.append('quality', genQuality);
            apiFormData.append('output_format', genOutputFormat);
            if (
                (genOutputFormat === 'jpeg' || genOutputFormat === 'webp') &&
                genData.output_compression !== undefined
            ) {
                apiFormData.append('output_compression', genData.output_compression.toString());
            }
            apiFormData.append('background', genBackground);
            apiFormData.append('moderation', genModeration);
        } else {
            apiFormData.append('model', editModel);
            apiFormData.append('prompt', editPrompt);
            apiFormData.append('n', editN[0].toString());
            const editSizeToSend =
                editSize === 'custom'
                    ? `${editCustomWidth}x${editCustomHeight}`
                    : (getPresetDimensions(editSize, editModel) ?? editSize);
            apiFormData.append('size', editSizeToSend);
            apiFormData.append('quality', editQuality);

            editImageFiles.forEach((file, index) => {
                apiFormData.append(`image_${index}`, file, file.name);
            });
            if (editGeneratedMaskFile) {
                apiFormData.append('mask', editGeneratedMaskFile, editGeneratedMaskFile.name);
            }
        }

        try {
            appendConfigToFormData(apiFormData);
            const response = await fetch('/api/images', {
                method: 'POST',
                body: apiFormData,
                headers: getConfigHeaders()
            });

            // Check if response is SSE (streaming)
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/event-stream')) {
                if (!response.body) {
                    throw new Error('Response body is null');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Process complete SSE events
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep incomplete event in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6);
                            try {
                                const event = JSON.parse(jsonStr);

                                if (event.type === 'partial_image') {
                                    // Update streaming preview with partial image
                                    const imageIndex = event.index ?? 0;
                                    const dataUrl = `data:image/png;base64,${event.b64_json}`;
                                    setStreamingPreviewImages((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(imageIndex, dataUrl);
                                        return newMap;
                                    });
                                } else if (event.type === 'error') {
                                    throw new Error(event.error || 'Streaming error occurred');
                                } else if (event.type === 'done') {
                                    // Finalize with all completed images
                                    durationMs = Date.now() - startTime;

                                    if (event.images && event.images.length > 0) {
                                        let historyQuality: GenerationFormData['quality'] = 'auto';
                                        let historyBackground: GenerationFormData['background'] = 'auto';
                                        let historyModeration: GenerationFormData['moderation'] = 'auto';
                                        let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                                        let historyPrompt: string = '';

                                        if (mode === 'generate') {
                                            historyQuality = genQuality;
                                            historyBackground = genBackground;
                                            historyModeration = genModeration;
                                            historyOutputFormat = genOutputFormat;
                                            historyPrompt = genPrompt;
                                        } else {
                                            historyQuality = editQuality;
                                            historyBackground = 'auto';
                                            historyModeration = 'auto';
                                            historyOutputFormat = 'png';
                                            historyPrompt = editPrompt;
                                        }

                                        const currentModel = mode === 'generate' ? genModel : editModel;
                                        const costDetails = calculateApiCost(event.usage, currentModel);

                                        const batchTimestamp = Date.now();
                                        const newHistoryEntry: HistoryMetadata = {
                                            timestamp: batchTimestamp,
                                            images: event.images.map((img: { filename: string }) => ({
                                                filename: img.filename
                                            })),
                                            storageModeUsed: effectiveStorageModeClient,
                                            durationMs: durationMs,
                                            quality: historyQuality,
                                            background: historyBackground,
                                            moderation: historyModeration,
                                            output_format: historyOutputFormat,
                                            prompt: historyPrompt,
                                            mode: mode,
                                            costDetails: costDetails,
                                            model: currentModel
                                        };

                                        let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] =
                                            [];
                                        if (effectiveStorageModeClient === 'indexeddb') {
                                            newImageBatchPromises = event.images.map(async (img: ApiImageResponseItem) => {
                                                if (img.b64_json) {
                                                    try {
                                                        const byteCharacters = atob(img.b64_json);
                                                        const byteNumbers = new Array(byteCharacters.length);
                                                        for (let i = 0; i < byteCharacters.length; i++) {
                                                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                                                        }
                                                        const byteArray = new Uint8Array(byteNumbers);

                                                        const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                                        const blob = new Blob([byteArray], { type: actualMimeType });

                                                        await db.images.put({ filename: img.filename, blob });

                                                        const blobUrl = URL.createObjectURL(blob);
                                                        blobUrlCacheRef.current.set(img.filename, blobUrl);

                                                        return { filename: img.filename, path: blobUrl };
                                                    } catch (dbError) {
                                                        console.error(
                                                            `Error saving blob ${img.filename} to IndexedDB:`,
                                                            dbError
                                                        );
                                                        setError(
                                                            `Failed to save image ${img.filename} to local database.`
                                                        );
                                                        return null;
                                                    }
                                                } else {
                                                    console.warn(
                                                        `Image ${img.filename} missing b64_json in indexeddb mode.`
                                                    );
                                                    return null;
                                                }
                                            });
                                        } else {
                                            newImageBatchPromises = event.images
                                                .filter((img: ApiImageResponseItem) => !!img.path)
                                                .map((img: ApiImageResponseItem) =>
                                                    Promise.resolve({
                                                        path: img.path!,
                                                        filename: img.filename
                                                    })
                                                );
                                        }

                                        const processedImages = (await Promise.all(newImageBatchPromises)).filter(
                                            Boolean
                                        ) as {
                                            path: string;
                                            filename: string;
                                        }[];

                                        setLatestImageBatch(processedImages);
                                        setImageOutputView(processedImages.length > 1 ? 'grid' : 0);
                                        setStreamingPreviewImages(new Map()); // Clear streaming previews

                                        setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
                                    }
                                }
                            } catch (parseError) {
                                console.error('Error parsing SSE event:', parseError);
                            }
                        }
                    }
                }

                return; // Exit early for streaming
            }

            // Non-streaming response handling (original code)
            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401 && isPasswordRequiredByBackend) {
                    setError('密码错误。请重新输入。');
                    setPasswordDialogContext('retry');
                    setLastApiCallArgs([formData]);
                    setIsPasswordDialogOpen(true);

                    return;
                }
                throw new Error(result.error || `API request failed with status ${response.status}`);
            }

            if (result.images && result.images.length > 0) {
                durationMs = Date.now() - startTime;

                let historyQuality: GenerationFormData['quality'] = 'auto';
                let historyBackground: GenerationFormData['background'] = 'auto';
                let historyModeration: GenerationFormData['moderation'] = 'auto';
                let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                let historyPrompt: string = '';

                if (mode === 'generate') {
                    historyQuality = genQuality;
                    historyBackground = genBackground;
                    historyModeration = genModeration;
                    historyOutputFormat = genOutputFormat;
                    historyPrompt = genPrompt;
                } else {
                    historyQuality = editQuality;
                    historyBackground = 'auto';
                    historyModeration = 'auto';
                    historyOutputFormat = 'png';
                    historyPrompt = editPrompt;
                }

                const currentModel = mode === 'generate' ? genModel : editModel;
                const costDetails = calculateApiCost(result.usage, currentModel);

                const batchTimestamp = Date.now();
                const newHistoryEntry: HistoryMetadata = {
                    timestamp: batchTimestamp,
                    images: result.images.map((img: { filename: string }) => ({ filename: img.filename })),
                    storageModeUsed: effectiveStorageModeClient,
                    durationMs: durationMs,
                    quality: historyQuality,
                    background: historyBackground,
                    moderation: historyModeration,
                    output_format: historyOutputFormat,
                    prompt: historyPrompt,
                    mode: mode,
                    costDetails: costDetails,
                    model: currentModel
                };

                let newImageBatchPromises: Promise<{ path: string; filename: string } | null>[] = [];
                if (effectiveStorageModeClient === 'indexeddb') {
                    newImageBatchPromises = result.images.map(async (img: ApiImageResponseItem) => {
                        if (img.b64_json) {
                            try {
                                const byteCharacters = atob(img.b64_json);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);

                                const actualMimeType = getMimeTypeFromFormat(img.output_format);
                                const blob = new Blob([byteArray], { type: actualMimeType });

                                await db.images.put({ filename: img.filename, blob });

                                const blobUrl = URL.createObjectURL(blob);
                                blobUrlCacheRef.current.set(img.filename, blobUrl);

                                return { filename: img.filename, path: blobUrl };
                            } catch (dbError) {
                                console.error(`Error saving blob ${img.filename} to IndexedDB:`, dbError);
                                setError(`Failed to save image ${img.filename} to local database.`);
                                return null;
                            }
                        } else {
                            console.warn(`Image ${img.filename} missing b64_json in indexeddb mode.`);
                            return null;
                        }
                    });
                } else {
                    newImageBatchPromises = result.images
                        .filter((img: ApiImageResponseItem) => !!img.path)
                        .map((img: ApiImageResponseItem) =>
                            Promise.resolve({
                                path: img.path!,
                                filename: img.filename
                            })
                        );
                }

                const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as {
                    path: string;
                    filename: string;
                }[];

                setLatestImageBatch(processedImages);
                setImageOutputView(processedImages.length > 1 ? 'grid' : 0);

                setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
            } else {
                setLatestImageBatch(null);
                throw new Error('API 响应中没有有效的图片数据或文件名。');
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(errorMessage);
            setLatestImageBatch(null);
            setStreamingPreviewImages(new Map());
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPasswordRequiredByBackend, clientPasswordHash, mode, enableStreaming, partialImages,
        genModel, genPrompt, genN, genSize, genCustomWidth, genCustomHeight, genQuality, genOutputFormat,
        genBackground, genModeration, editModel, editPrompt, editN, editSize, editCustomWidth, editCustomHeight,
        editQuality, editImageFiles, editGeneratedMaskFile, appConfig]);

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata) => {
            const originalStorageMode = item.storageModeUsed || 'fs';

            const selectedBatchPromises = item.images.map(async (imgInfo) => {
                let path: string | undefined;
                if (originalStorageMode === 'indexeddb') {
                    path = getImageSrc(imgInfo.filename);
                } else {
                    path = `/api/image/${imgInfo.filename}`;
                }

                if (path) {
                    return { path, filename: imgInfo.filename };
                } else {
                    console.warn(
                        `Could not get image source for history item: ${imgInfo.filename} (mode: ${originalStorageMode})`
                    );
                    setError(`Image ${imgInfo.filename} could not be loaded.`);
                    return null;
                }
            });

            Promise.all(selectedBatchPromises).then((resolvedBatch) => {
                const validImages = resolvedBatch.filter(Boolean) as { path: string; filename: string }[];

                if (validImages.length !== item.images.length) {
                    setError(
                        'Some images from this history entry could not be loaded (they might have been cleared or are missing).'
                    );
                } else {
                    setError(null);
                }

                setLatestImageBatch(validImages.length > 0 ? validImages : null);
                setImageOutputView(validImages.length > 1 ? 'grid' : 0);
            });
        },
        [getImageSrc]
    );

    const handleClearHistory = React.useCallback(async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? 'Are you sure you want to clear the entire image history? In IndexedDB mode, this will also permanently delete all stored images. This cannot be undone.'
                : 'Are you sure you want to clear the entire image history? This cannot be undone.';

        if (window.confirm(confirmationMessage)) {
            setHistory([]);
            setLatestImageBatch(null);
            setImageOutputView('grid');
            setError(null);

            try {
                localStorage.removeItem('openaiImageHistory');

                if (effectiveStorageModeClient === 'indexeddb') {
                    await db.images.clear();
                    blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                    blobUrlCacheRef.current.clear();
                }
            } catch (e) {
                console.error('Failed during history clearing:', e);
                setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }, []);

    const handleSendToEdit = async (filename: string) => {
        if (isSendingToEdit) return;
        setIsSendingToEdit(true);
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (mode === 'edit' && alreadyExists) {
            setIsSendingToEdit(false);
            return;
        }

        if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
            setError(`Cannot add more than ${MAX_EDIT_IMAGES} images to the edit form.`);
            setIsSendingToEdit(false);
            return;
        }

        try {
            let blob: Blob | undefined;
            let mimeType: string = 'image/png';

            const cachedUrl = blobUrlCacheRef.current.get(filename);
            if (cachedUrl) {
                const response = await fetch(cachedUrl);
                blob = await response.blob();
                mimeType = blob.type || mimeType;
            } else {
                const record = allDbImages?.find((img) => img.filename === filename);
                if (record?.blob) {
                    blob = record.blob;
                    mimeType = blob.type || mimeType;
                } else if (effectiveStorageModeClient === 'fs') {
                    const response = await fetch(`/api/image/${filename}`);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch image: ${response.statusText}`);
                    }
                    blob = await response.blob();
                    mimeType = response.headers.get('Content-Type') || mimeType;
                } else {
                    throw new Error(`Image ${filename} not found.`);
                }
            }

            if (!blob) {
                throw new Error(`Could not retrieve image data for ${filename}.`);
            }

            const newFile = new File([blob], filename, { type: mimeType });
            const newPreviewUrl = URL.createObjectURL(blob);

            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

            setEditImageFiles([newFile]);
            setEditSourceImagePreviewUrls([newPreviewUrl]);

            if (mode === 'generate') {
                setMode('edit');
            }
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            const errorMessage = err instanceof Error ? err.message : '无法发送图片到编辑模式。';
            setError(errorMessage);
        } finally {
            setIsSendingToEdit(false);
        }
    };

    const executeDeleteItem = React.useCallback(
        async (item: HistoryMetadata) => {
            if (!item) return;
            setError(null);

            const { images: imagesInEntry, storageModeUsed, timestamp } = item;
            const filenamesToDelete = imagesInEntry.map((img) => img.filename);

            try {
                if (storageModeUsed === 'indexeddb') {
                    await db.images.where('filename').anyOf(filenamesToDelete).delete();
                    filenamesToDelete.forEach((fn) => {
                        const url = blobUrlCacheRef.current.get(fn);
                        if (url) URL.revokeObjectURL(url);
                        blobUrlCacheRef.current.delete(fn);
                    });
                } else if (storageModeUsed === 'fs') {
                    const apiPayload: { filenames: string[]; passwordHash?: string } = {
                        filenames: filenamesToDelete
                    };
                    if (isPasswordRequiredByBackend && clientPasswordHash) {
                        apiPayload.passwordHash = clientPasswordHash;
                    }

                    const response = await fetch('/api/image-delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(apiPayload)
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || `API deletion failed with status ${response.status}`);
                    }
                }

                setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
                setLatestImageBatch((prev) =>
                    prev && prev.some((img) => filenamesToDelete.includes(img.filename)) ? null : prev
                );
            } catch (e: unknown) {
                console.error('Error during item deletion:', e);
                setError(e instanceof Error ? e.message : 'An unexpected error occurred during deletion.');
            } finally {
                setItemToDeleteConfirm(null);
            }
        },
        [isPasswordRequiredByBackend, clientPasswordHash]
    );

    const handleRequestDeleteItem = React.useCallback(
        (item: HistoryMetadata) => {
            if (!skipDeleteConfirmation) {
                setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
                setItemToDeleteConfirm(item);
            } else {
                executeDeleteItem(item);
            }
        },
        [skipDeleteConfirmation, executeDeleteItem]
    );

    const handleConfirmDeletion = React.useCallback(() => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm);
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    }, [itemToDeleteConfirm, executeDeleteItem, dialogCheckboxStateSkipConfirm]);

    const handleCancelDeletion = React.useCallback(() => {
        setItemToDeleteConfirm(null);
    }, []);

    return (
        <main className='flex min-h-screen flex-col items-center p-4 text-white md:p-6 lg:p-8'>
            {isGlobalDragOver && (
                <div className='pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center border-4 border-dashed border-violet-500/60 bg-black/70 backdrop-blur-sm'>
                    <div className='flex flex-col items-center gap-4 text-center'>
                        <div className='flex h-20 w-20 items-center justify-center rounded-full border-2 border-violet-400 bg-violet-500/20'>
                            <svg className='h-10 w-10 text-violet-400' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5' />
                            </svg>
                        </div>
                        <p className='text-2xl font-semibold text-violet-300'>释放以添加图片</p>
                        <p className='text-sm text-white/50'>图片将自动添加到编辑模式</p>
                    </div>
                </div>
            )}
            <div className='fixed top-4 right-4 z-50 flex items-center gap-2'>
                <SettingsDialog onConfigChange={handleConfigChange} />
            </div>
            <div className='mb-4 w-full max-w-screen-2xl'>
                <h1 className='text-xl font-semibold text-white'>GPT Image Playground</h1>
            </div>
            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
                onSave={handleSavePassword}
                title={passwordDialogContext === 'retry' ? '需要密码认证' : '设置密码'}
                description={
                    passwordDialogContext === 'retry'
                        ? '服务器需要密码，或之前输入的密码不正确。请输入密码以继续。'
                        : '为 API 请求设置密码。'
                }
            />
            <div className='w-full max-w-screen-2xl space-y-6'>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                    <div className='relative flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                            <GenerationForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                model={genModel}
                                setModel={setGenModel}
                                prompt={genPrompt}
                                setPrompt={setGenPrompt}
                                n={genN}
                                setN={setGenN}
                                size={genSize}
                                setSize={setGenSize}
                                customWidth={genCustomWidth}
                                setCustomWidth={setGenCustomWidth}
                                customHeight={genCustomHeight}
                                setCustomHeight={setGenCustomHeight}
                                quality={genQuality}
                                setQuality={setGenQuality}
                                outputFormat={genOutputFormat}
                                setOutputFormat={setGenOutputFormat}
                                compression={genCompression}
                                setCompression={setGenCompression}
                                background={genBackground}
                                setBackground={setGenBackground}
                                moderation={genModeration}
                                setModeration={setGenModeration}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                            />
                        </div>
                        <div className={mode === 'edit' ? 'block h-full w-full' : 'hidden'}>
                            <EditingForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading || isSendingToEdit}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                editModel={editModel}
                                setEditModel={setEditModel}
                                imageFiles={editImageFiles}
                                sourceImagePreviewUrls={editSourceImagePreviewUrls}
                                setImageFiles={setEditImageFiles}
                                setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                                maxImages={MAX_EDIT_IMAGES}
                                editPrompt={editPrompt}
                                setEditPrompt={setEditPrompt}
                                editN={editN}
                                setEditN={setEditN}
                                editSize={editSize}
                                setEditSize={setEditSize}
                                editCustomWidth={editCustomWidth}
                                setEditCustomWidth={setEditCustomWidth}
                                editCustomHeight={editCustomHeight}
                                setEditCustomHeight={setEditCustomHeight}
                                editQuality={editQuality}
                                setEditQuality={setEditQuality}
                                editBrushSize={editBrushSize}
                                setEditBrushSize={setEditBrushSize}
                                editShowMaskEditor={editShowMaskEditor}
                                setEditShowMaskEditor={setEditShowMaskEditor}
                                editGeneratedMaskFile={editGeneratedMaskFile}
                                setEditGeneratedMaskFile={setEditGeneratedMaskFile}
                                editIsMaskSaved={editIsMaskSaved}
                                setEditIsMaskSaved={setEditIsMaskSaved}
                                editOriginalImageSize={editOriginalImageSize}
                                setEditOriginalImageSize={setEditOriginalImageSize}
                                editDrawnPoints={editDrawnPoints}
                                setEditDrawnPoints={setEditDrawnPoints}
                                editMaskPreviewUrl={editMaskPreviewUrl}
                                setEditMaskPreviewUrl={setEditMaskPreviewUrl}
                                enableStreaming={enableStreaming}
                                setEnableStreaming={setEnableStreaming}
                                partialImages={partialImages}
                                setPartialImages={setPartialImages}
                            />
                        </div>
                    </div>
                    <div className='flex h-[70vh] min-h-[600px] flex-col lg:col-span-1'>
                        {error && (
                <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                <AlertTitle className='text-red-200'>错误</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ImageOutput
                            imageBatch={latestImageBatch}
                            viewMode={imageOutputView}
                            onViewChange={setImageOutputView}
                            altText='Generated image output'
                            isLoading={isLoading || isSendingToEdit}
                            onSendToEdit={handleSendToEdit}
                            currentMode={mode}
                            baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                            streamingPreviewImages={streamingPreviewImages}
                        />
                    </div>
                </div>

                <div className='min-h-[450px]'>
                    <HistoryPanel
                        history={history}
                        onSelectImage={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getImageSrc={getImageSrc}
                        onDeleteItemRequest={handleRequestDeleteItem}
                        itemPendingDeleteConfirmation={itemToDeleteConfirm}
                        onConfirmDeletion={handleConfirmDeletion}
                        onCancelDeletion={handleCancelDeletion}
                        deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                        onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                    />
                </div>
            </div>
        </main>
    );
}
