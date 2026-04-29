'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { AboutDialog } from '@/components/about-dialog';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { PasswordDialog } from '@/components/password-dialog';
import { SettingsDialog } from '@/components/settings-dialog';
import { TaskTracker } from '@/components/task-tracker';
import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPresetDimensions } from '@/lib/size-utils';
import { db, type ImageRecord } from '@/lib/db';
import {
    flushImageFormPreferencesSave,
    loadImageFormPreferences,
    scheduleImageFormPreferencesSave
} from '@/lib/form-preferences';
import { loadConfig, type AppConfig } from '@/lib/config';
import { DEFAULT_IMAGE_MODEL } from '@/lib/model-registry';
import { useLiveQuery } from 'dexie-react-hooks';
import * as React from 'react';
import { useTaskManager, type SubmitParams } from '@/hooks/useTaskManager';
import type { HistoryMetadata } from '@/types/history';

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

const MAX_EDIT_IMAGES = 10;

function isEditablePasteTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function getClipboardImageFiles(dataTransfer: DataTransfer): File[] {
    return Array.from(dataTransfer.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
}

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

export default function HomePage() {
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
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

    const [outputFormat, setOutputFormat] = React.useState<EditingFormData['output_format']>('png');
    const [compression, setCompression] = React.useState([100]);
    const [background, setBackground] = React.useState<EditingFormData['background']>('auto');
    const [moderation, setModeration] = React.useState<EditingFormData['moderation']>('low');
    const [formPreferencesLoaded, setFormPreferencesLoaded] = React.useState(false);

    const [appConfig, setAppConfig] = React.useState<AppConfig>(() => loadConfig());

    const handleConfigChange = (newConfig: Partial<AppConfig>) => {
        setAppConfig((prev) => ({ ...prev, ...newConfig }));
    };

    const addImageFilesToEdit = React.useCallback((files: File[]): boolean => {
        const imageFiles = files.filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return false;

        const availableSlots = MAX_EDIT_IMAGES - editImageFiles.length;
        if (availableSlots <= 0) {
            alert(`Cannot add image: Maximum of ${MAX_EDIT_IMAGES} images reached.`);
            return false;
        }

        const filesToAdd = imageFiles.slice(0, availableSlots);
        if (filesToAdd.length < imageFiles.length) {
            alert(`Only ${availableSlots} more image${availableSlots === 1 ? '' : 's'} can be added.`);
        }

        setEditImageFiles((prevFiles) => [...prevFiles, ...filesToAdd]);
        setEditSourceImagePreviewUrls((prevUrls) => [
            ...prevUrls,
            ...filesToAdd.map((file) => URL.createObjectURL(file))
        ]);
        return true;
    }, [editImageFiles.length]);

    const scrollToEditForm = React.useCallback(() => {
        const editForm = document.querySelector<HTMLElement>('[data-editing-form-anchor]');
        if (editForm) {
            editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const [editModel, setEditModel] = React.useState<EditingFormData['model']>(DEFAULT_IMAGE_MODEL);

    // Streaming state (shared between generate and edit modes)
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);

    React.useEffect(() => {
        const preferences = loadImageFormPreferences();
        setEditModel(preferences.model);
        setEditN([preferences.n]);
        setEditSize(preferences.size);
        setEditCustomWidth(preferences.customWidth);
        setEditCustomHeight(preferences.customHeight);
        setEditQuality(preferences.quality);
        setOutputFormat(preferences.outputFormat);
        setCompression([preferences.compression]);
        setBackground(preferences.background);
        setModeration(preferences.moderation);
        setEditBrushSize([preferences.brushSize]);
        setEnableStreaming(preferences.enableStreaming);
        setPartialImages(preferences.partialImages);
        setFormPreferencesLoaded(true);
    }, []);

    React.useEffect(() => {
        if (!formPreferencesLoaded) return;

        scheduleImageFormPreferencesSave({
            model: editModel,
            n: editN[0],
            size: editSize,
            customWidth: editCustomWidth,
            customHeight: editCustomHeight,
            quality: editQuality,
            outputFormat,
            compression: compression[0],
            background,
            moderation,
            brushSize: editBrushSize[0],
            enableStreaming,
            partialImages
        });
    }, [
        formPreferencesLoaded,
        editModel,
        editN,
        editSize,
        editCustomWidth,
        editCustomHeight,
        editQuality,
        outputFormat,
        compression,
        background,
        moderation,
        editBrushSize,
        enableStreaming,
        partialImages
    ]);

    React.useEffect(() => {
        if (!formPreferencesLoaded) return;

        const flushPendingPreferences = () => flushImageFormPreferencesSave();
        window.addEventListener('beforeunload', flushPendingPreferences);
        window.addEventListener('pagehide', flushPendingPreferences);

        return () => {
            window.removeEventListener('beforeunload', flushPendingPreferences);
            window.removeEventListener('pagehide', flushPendingPreferences);
            flushPendingPreferences();
        };
    }, [formPreferencesLoaded]);

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
                addImageFilesToEdit(Array.from(files));
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
    }, [addImageFilesToEdit]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (!event.clipboardData) {
                return;
            }

            const imageFiles = getClipboardImageFiles(event.clipboardData);
            const text = event.clipboardData.getData('text/plain');
            const hasText = text.length > 0;

            if (imageFiles.length > 0 && !hasText) {
                event.preventDefault();
                addImageFilesToEdit(imageFiles);
                scrollToEditForm();
                return;
            }

            if (hasText && !isEditablePasteTarget(event.target)) {
                event.preventDefault();
                setEditPrompt(text);
                scrollToEditForm();
            }
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [addImageFilesToEdit, scrollToEditForm]);

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
        } catch (e) {
            console.error('Error hashing password:', e);
            setError('Failed to save password due to a hashing error.');
        }
    };

    const handleOpenPasswordDialog = () => {
        setPasswordDialogContext('initial');
        setIsPasswordDialogOpen(true);
    };

    const { tasks, submitTask, cancelTask } = useTaskManager(
        appConfig.maxConcurrentTasks || 3,
        React.useCallback((entry: HistoryMetadata) => {
            setHistory(prev => [entry, ...prev]);
        }, []),
        blobUrlCacheRef
    );

    const [displayedBatch, setDisplayedBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!displayedBatch) {
            const task = tasks.find(t => t.id === selectedTaskId) || tasks[tasks.length - 1];
            if (task && task.status === 'done' && task.result) {
                setImageOutputView(task.result.images.length > 1 ? 'grid' : 0);
            }
        }
    }, [tasks, selectedTaskId, displayedBatch]);

    const selectedTask = React.useMemo(
        () => tasks.find((task) => task.id === selectedTaskId) || tasks[tasks.length - 1],
        [tasks, selectedTaskId]
    );

    const { outputBatch, outputIsLoading, outputStreaming, outputMode } = React.useMemo(() => {
        if (displayedBatch || !selectedTask) {
            return {
                outputBatch: displayedBatch,
                outputIsLoading: false,
                outputStreaming: undefined,
                outputMode: selectedTask?.mode ?? 'generate'
            };
        }

        if (selectedTask.status === 'running' || selectedTask.status === 'streaming') {
            return {
                outputBatch: null,
                outputIsLoading: true,
                outputStreaming: selectedTask.streamingPreviews,
                outputMode: selectedTask.mode
            };
        }

        if (selectedTask.status === 'done' && selectedTask.result) {
            return {
                outputBatch: selectedTask.result.images,
                outputIsLoading: false,
                outputStreaming: undefined,
                outputMode: selectedTask.mode
            };
        }

        if (selectedTask.status === 'queued') {
            return {
                outputBatch: null,
                outputIsLoading: true,
                outputStreaming: undefined,
                outputMode: selectedTask.mode
            };
        }

        return {
            outputBatch: null,
            outputIsLoading: false,
            outputStreaming: undefined,
            outputMode: selectedTask.mode
        };
    }, [displayedBatch, selectedTask]);

    const buildSubmitParams = React.useCallback((formData: EditingFormData): SubmitParams => {
        const cfg = loadConfig();
        const hasSourceImages = formData.imageFiles.length > 0;
        const sizeToSend =
            formData.size === 'custom'
                ? `${formData.customWidth}x${formData.customHeight}`
                : (getPresetDimensions(formData.size, formData.model) ?? formData.size);

        if (!hasSourceImages) {
            return {
                mode: 'generate' as const,
                model: formData.model,
                prompt: formData.prompt,
                n: formData.n,
                size: sizeToSend,
                quality: formData.quality,
                output_format: formData.output_format,
                output_compression: formData.output_compression,
                background: formData.background,
                moderation: formData.moderation,
                enableStreaming,
                partialImages,
                connectionMode: cfg.connectionMode,
                apiKey: cfg.openaiApiKey || undefined,
                apiBaseUrl: cfg.openaiApiBaseUrl || undefined,
                geminiApiKey: cfg.geminiApiKey || undefined,
                geminiApiBaseUrl: cfg.geminiApiBaseUrl || undefined,
                customImageModels: cfg.customImageModels,
                passwordHash: clientPasswordHash || undefined,
                imageStorageMode: effectiveStorageModeClient,
            };
        } else {
            return {
                mode: 'edit' as const,
                model: formData.model,
                prompt: formData.prompt,
                n: formData.n,
                size: sizeToSend === 'auto' ? undefined : sizeToSend,
                quality: formData.quality === 'auto' ? undefined : formData.quality,
                imageFiles: formData.imageFiles,
                maskFile: formData.maskFile,
                enableStreaming,
                partialImages,
                connectionMode: cfg.connectionMode,
                apiKey: cfg.openaiApiKey || undefined,
                apiBaseUrl: cfg.openaiApiBaseUrl || undefined,
                geminiApiKey: cfg.geminiApiKey || undefined,
                geminiApiBaseUrl: cfg.geminiApiBaseUrl || undefined,
                customImageModels: cfg.customImageModels,
                passwordHash: clientPasswordHash || undefined,
                imageStorageMode: effectiveStorageModeClient,
            };
        }
    }, [enableStreaming, partialImages, clientPasswordHash]);

    const handleEditSubmit = React.useCallback((formData: EditingFormData) => {
        setDisplayedBatch(null);
        submitTask(buildSubmitParams(formData));
    }, [submitTask, buildSubmitParams, setDisplayedBatch]);

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata) => {
            const originalStorageMode = item.storageModeUsed || 'fs';

            const selectedBatch = item.images.map((imgInfo) => {
                let path: string | undefined;
                if (originalStorageMode === 'indexeddb') {
                    path = getImageSrc(imgInfo.filename);
                } else {
                    path = `/api/image/${imgInfo.filename}`;
                }

                if (path) {
                    return { path, filename: imgInfo.filename };
                } else {
                    setError(`Image ${imgInfo.filename} could not be loaded.`);
                    return null;
                }
            });

            const validImages = selectedBatch.filter(Boolean) as { path: string; filename: string }[];
            if (validImages.length > 0) {
                setDisplayedBatch(validImages);
                setImageOutputView(validImages.length > 1 ? 'grid' : 0);
            }
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
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (alreadyExists) {
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
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            const errorMessage = err instanceof Error ? err.message : '无法发送图片到编辑模式。';
            setError(errorMessage);
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
        <>
            <main className='app-theme-scope flex min-h-dvh flex-col items-center overflow-x-hidden p-4 text-foreground md:p-6 lg:p-8'>            {isGlobalDragOver && (
                <div className='pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center border-4 border-dashed border-violet-500/60 bg-black/70 backdrop-blur-sm'>
                    <div className='flex flex-col items-center gap-4 text-center'>
                        <div className='flex h-20 w-20 items-center justify-center rounded-full border-2 border-violet-400 bg-violet-500/20'>
                            <svg className='h-10 w-10 text-violet-400' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
                                <path strokeLinecap='round' strokeLinejoin='round' d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5' />
                            </svg>
                        </div>
                        <p className='text-2xl font-semibold text-violet-300'>释放以添加图片</p>
                        <p className='text-sm text-white/50'>添加源图片后将自动执行编辑任务</p>
                    </div>
                </div>
            )}
            <div className='fixed top-4 right-4 z-50 flex items-center gap-2'>
                <ThemeToggle />
                <AboutDialog />
                <SettingsDialog onConfigChange={handleConfigChange} />
            </div>
            <div className='mb-4 w-full max-w-screen-2xl'>
                <h1 className='text-xl font-semibold text-foreground'>GPT Image Playground</h1>
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
                    <div className='relative flex min-h-0 flex-col lg:h-[70vh] lg:min-h-[600px] lg:col-span-1' data-editing-form-anchor>
                        <EditingForm
                            onSubmit={handleEditSubmit}
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
                            outputFormat={outputFormat}
                            setOutputFormat={setOutputFormat}
                            compression={compression}
                            setCompression={setCompression}
                            background={background}
                            setBackground={setBackground}
                            moderation={moderation}
                            setModeration={setModeration}
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
                            customImageModels={appConfig.customImageModels}
                        />
                    </div>
                    <div className='flex min-h-[420px] flex-col lg:h-[70vh] lg:min-h-[600px] lg:col-span-1'>
                        {error && (
                            <Alert variant='destructive' className='mb-4 border-red-500/50 bg-red-900/20 text-red-300'>
                                <AlertTitle className='text-red-200'>错误</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ImageOutput
                            imageBatch={outputBatch}
                            viewMode={displayedBatch ? (displayedBatch.length > 1 ? 'grid' : 0) : imageOutputView}
                            onViewChange={setImageOutputView}
                            altText='Generated image output'
                            isLoading={outputIsLoading}
                            taskStartedAt={selectedTask?.startedAt}
                            onSendToEdit={handleSendToEdit}
                            currentMode={outputMode}
                            baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                            streamingPreviewImages={outputStreaming}
                        />
                    </div>
                </div>

                <div className='min-h-[150px]'>
                    <TaskTracker
                        tasks={tasks}
                        onCancel={cancelTask}
                        onSelectTask={(id) => {
                            setSelectedTaskId(id);
                            setDisplayedBatch(null);
                        }}
                        selectedTaskId={selectedTaskId || undefined}
                    />
                    <HistoryPanel
                        history={history}
                        onSelectImage={handleHistorySelect}
                        onClearHistory={handleClearHistory}
                        getImageSrc={getImageSrc}
                        onSendToEdit={handleSendToEdit}
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

    </>    );
}
