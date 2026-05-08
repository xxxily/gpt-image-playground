'use client';

import { AboutDialog } from '@/components/about-dialog';
import { ClearHistoryDialog } from '@/components/clear-history-dialog';
import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { useNotice } from '@/components/notice-provider';
import { PasswordDialog } from '@/components/password-dialog';
import { SecureShareUnlockDialog } from '@/components/secure-share-unlock-dialog';
import { SettingsDialog } from '@/components/settings-dialog';
import { SharedConfigChoiceDialog } from '@/components/shared-config-choice-dialog';
import { TaskTracker } from '@/components/task-tracker';
import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose
} from '@/components/ui/dialog';
import { useTaskManager, type SubmitParams } from '@/hooks/useTaskManager';
import { getApiResponseErrorMessage } from '@/lib/api-error';
import { DEFAULT_CONFIG, loadConfig, saveConfig, type AppConfig } from '@/lib/config';
import { isEnabledEnvFlag } from '@/lib/connection-policy';
import { db, type ImageRecord } from '@/lib/db';
import { desktopProxyConfigFromAppConfig } from '@/lib/desktop-config';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import {
    flushImageFormPreferencesSave,
    loadImageFormPreferences,
    scheduleImageFormPreferencesSave
} from '@/lib/form-preferences';
import { DEFAULT_IMAGE_MODEL, getImageModel } from '@/lib/model-registry';
import { getProviderCredentialConfig } from '@/lib/provider-config';
import { clearImageHistoryLocalStorage, loadImageHistory, saveImageHistory } from '@/lib/image-history';
import { decryptShareParams } from '@/lib/share-crypto';
import {
    buildPromptOnlyUrlParams,
    buildSharedConfigUpdates,
    hasMatchingStoredSharedConfig,
    resolveClientDirectLinkConnectionMode,
    shouldPromptForConfigPersistence
} from '@/lib/shared-config';
import { resolveImageRequestSize } from '@/lib/size-utils';
import {
    parseUrlParams,
    buildCleanedUrl,
    getSecureSharePayload,
    getSecureSharePasswordFromHash,
    shouldAutoStartFromUrl,
    type ConsumedKeys,
    type ParsedUrlParams
} from '@/lib/url-params';
import type { HistoryImage, HistoryMetadata, ImageStorageMode } from '@/types/history';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useLiveQuery } from 'dexie-react-hooks';
import Image from 'next/image';
import * as React from 'react';

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

type UrlAutostartFormDefaults = Omit<EditingFormData, 'prompt' | 'imageFiles' | 'maskFile'>;

type PendingSharedConfigChoice = {
    parsed: ParsedUrlParams;
    consumed: ConsumedKeys;
    currentUrl: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    providerLabel: string;
};

type ApplyUrlParamsOptions = {
    persistConfig?: boolean;
    suppressModelPreferenceSave?: boolean;
};

type ServerRuntimeConfig = {
    clientDirectLinkPriority?: boolean;
};

type DesktopRemoteImageResponse = {
    bytes: number[];
    contentType: string;
};

function parseServerRuntimeConfig(value: unknown): ServerRuntimeConfig {
    if (typeof value !== 'object' || value === null || !('clientDirectLinkPriority' in value)) return {};

    const { clientDirectLinkPriority } = value;
    return typeof clientDirectLinkPriority === 'boolean' ? { clientDirectLinkPriority } : {};
}

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

function getFetchableImageUrl(pathOrUrl: string, passwordHash?: string | null): string {
    try {
        const url = new URL(pathOrUrl, window.location.href);
        if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== window.location.origin) {
            if (isTauriDesktop()) {
                return '';
            }
            const params = new URLSearchParams({ url: url.href });
            if (passwordHash) params.set('passwordHash', passwordHash);
            return `/api/image-proxy?${params.toString()}`;
        }
    } catch {
        return pathOrUrl;
    }

    return pathOrUrl;
}

function isBrowserAddressableImagePath(pathOrUrl: string): boolean {
    try {
        const url = new URL(pathOrUrl, window.location.href);
        return ['http:', 'https:', 'blob:', 'data:', 'asset:'].includes(url.protocol);
    } catch {
        return false;
    }
}

function getDesktopDisplayImagePath(pathOrUrl: string): string {
    if (!isTauriDesktop() || isBrowserAddressableImagePath(pathOrUrl)) return pathOrUrl;
    return convertFileSrc(pathOrUrl);
}

function prefersReducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isLargeLayout(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
}

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
const clientDirectLinkPriorityEnv = isEnabledEnvFlag(process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY);

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
if (process.env.NODE_ENV === 'development') {
    console.info(
        `Client Effective Storage Mode: ${effectiveStorageModeClient} (Explicit: ${explicitModeClient || 'unset'}, Vercel Env: ${vercelEnvClient || 'N/A'})`
    );
}

export default function HomePage() {
    const { addNotice } = useNotice();
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const skipNextHistorySaveRef = React.useRef(false);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const imageOutputAnchorRef = React.useRef<HTMLDivElement>(null);
    const generationAnnouncementTimerRef = React.useRef<number | null>(null);
    const urlInitDoneRef = React.useRef(false);
    const urlConfigOverridesRef = React.useRef<Partial<AppConfig>>({});
    const temporarySharedModelRef = React.useRef<string | null>(null);
    const secureShareUrlRef = React.useRef<string>('');
    const secureShareConsumedRef = React.useRef<ConsumedKeys | null>(null);
    const secureShareAutoPasswordRef = React.useRef<string | null>(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [secureSharePayload, setSecureSharePayload] = React.useState<string | null>(null);
    const [secureShareDismissed, setSecureShareDismissed] = React.useState(false);
    const [secureShareError, setSecureShareError] = React.useState('');
    const [isUnlockingSecureShare, setIsUnlockingSecureShare] = React.useState(false);
    const [isAutoUnlockingSecureShare, setIsAutoUnlockingSecureShare] = React.useState(false);
    const [pendingSharedConfigChoice, setPendingSharedConfigChoice] = React.useState<PendingSharedConfigChoice | null>(
        null
    );
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [pendingBatchDelete, setPendingBatchDelete] = React.useState<number>(0);
    const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = React.useState(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);
    const [isGlobalDragOver, setIsGlobalDragOver] = React.useState(false);
    const [generationAnnouncement, setGenerationAnnouncement] = React.useState('');

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

    const [appConfig, setAppConfig] = React.useState<AppConfig>(() => ({
        ...DEFAULT_CONFIG,
        providerInstances: [...DEFAULT_CONFIG.providerInstances],
        customImageModels: [...DEFAULT_CONFIG.customImageModels]
    }));
    const desktopProxyConfig = React.useMemo(() => desktopProxyConfigFromAppConfig(appConfig), [appConfig]);
    const [serverRuntimeConfigLoaded, setServerRuntimeConfigLoaded] = React.useState(false);
    const [clientDirectLinkPriority, setClientDirectLinkPriority] = React.useState(clientDirectLinkPriorityEnv);

    const handleConfigChange = (newConfig: Partial<AppConfig>) => {
        setAppConfig((prev) => ({ ...prev, ...newConfig }));
    };

    React.useEffect(() => {
        let active = true;

        async function loadServerRuntimeConfig() {
            try {
                const response = await fetch('/api/config');
                if (response.ok) {
                    const runtimeConfig = parseServerRuntimeConfig(await response.json());
                    if (active && runtimeConfig.clientDirectLinkPriority !== undefined) {
                        setClientDirectLinkPriority(runtimeConfig.clientDirectLinkPriority);
                    }
                }
            } catch (error) {
                console.warn('Failed to load server runtime configuration:', error);
            } finally {
                if (active) setServerRuntimeConfigLoaded(true);
            }
        }

        void loadServerRuntimeConfig();

        return () => {
            active = false;
        };
    }, []);

    const addImageFilesToEdit = React.useCallback(
        (files: File[]): boolean => {
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
        },
        [editImageFiles.length]
    );

    const scrollToEditForm = React.useCallback(() => {
        const editForm = document.querySelector<HTMLElement>('[data-editing-form-anchor]');
        if (editForm) {
            editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const announceGenerationStatus = React.useCallback((message: string) => {
        setGenerationAnnouncement('');

        if (generationAnnouncementTimerRef.current !== null) {
            window.clearTimeout(generationAnnouncementTimerRef.current);
        }

        generationAnnouncementTimerRef.current = window.setTimeout(() => {
            setGenerationAnnouncement(message);
            generationAnnouncementTimerRef.current = null;
        }, 50);
    }, []);

    const scrollToImageOutputOnMobile = React.useCallback(() => {
        if (isLargeLayout()) return;

        window.setTimeout(() => {
            const outputAnchor = imageOutputAnchorRef.current;
            if (!outputAnchor) return;

            try {
                outputAnchor.scrollIntoView({
                    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            } catch (error) {
                console.warn('Falling back to basic output section scroll:', error);
                outputAnchor.scrollIntoView();
            }
        }, 250);
    }, []);

    const [editModel, setEditModel] = React.useState<EditingFormData['model']>(DEFAULT_IMAGE_MODEL);
    const [providerInstanceId, setProviderInstanceId] = React.useState('');
    const shareModelProvider = React.useMemo(
        () => getImageModel(editModel, appConfig.customImageModels).provider,
        [editModel, appConfig.customImageModels]
    );
    const shareProviderConfig = React.useMemo(
        () => getProviderCredentialConfig(appConfig, shareModelProvider, providerInstanceId),
        [appConfig, providerInstanceId, shareModelProvider]
    );
    const shareApiKey = shareProviderConfig.apiKey;
    const shareApiBaseUrl = shareProviderConfig.apiBaseUrl;
    const shareProviderInstanceId = shareProviderConfig.providerInstanceId;
    const shareProviderLabel = shareProviderConfig.providerLabel;

    // Streaming state (shared between generate and edit modes)
    const [enableStreaming, setEnableStreaming] = React.useState(false);
    const [partialImages, setPartialImages] = React.useState<1 | 2 | 3>(2);

    React.useEffect(() => {
        setAppConfig(loadConfig());
        const preferences = loadImageFormPreferences();
        setProviderInstanceId(preferences.providerInstanceId);
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
        const temporarySharedModel = temporarySharedModelRef.current;
        const storedPreferences = temporarySharedModel ? loadImageFormPreferences() : null;

        scheduleImageFormPreferencesSave({
            model: temporarySharedModel === editModel ? storedPreferences?.model || DEFAULT_IMAGE_MODEL : editModel,
            providerInstanceId,
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
        providerInstanceId,
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

    const getHistoryImagePath = React.useCallback(
        (image: HistoryImage, storageMode: ImageStorageMode): string | undefined => {
            if (image.path) return getDesktopDisplayImagePath(image.path);

            if (storageMode === 'indexeddb') {
                return getImageSrc(image.filename);
            }

            if (isTauriDesktop()) {
                return '';
            }

            return `/api/image/${image.filename}`;
        },
        [getImageSrc]
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
        return () => {
            if (generationAnnouncementTimerRef.current !== null) {
                window.clearTimeout(generationAnnouncementTimerRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        const stored = loadImageHistory();
        skipNextHistorySaveRef.current = stored.shouldPreserveStoredValue;
        setHistory(stored.history);
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
            if (skipNextHistorySaveRef.current) {
                skipNextHistorySaveRef.current = false;
                return;
            }

            const saved = saveImageHistory(history);
            if (!saved) {
                setError('生成历史保存失败：浏览器存储空间可能不足，或当前浏览器禁止本地存储。');
            }
        }
    }, [history, isInitialLoad]);

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
            setHistory((prev) => [entry, ...prev]);
        }, []),
        blobUrlCacheRef
    );

    const handleTaskCancelOrDismiss = React.useCallback(
        (id: string) => {
            const task = tasks.find((item) => item.id === id);
            cancelTask(id);
            if (task?.status === 'error') {
                setError(null);
            }
        },
        [cancelTask, tasks]
    );

    const [displayedBatch, setDisplayedBatch] = React.useState<{ path: string; filename: string }[] | null>(null);
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!displayedBatch) {
            const task = tasks.find((t) => t.id === selectedTaskId) || tasks[tasks.length - 1];
            if (task && task.status === 'done' && task.result) {
                setImageOutputView(task.result.images.length > 1 ? 'grid' : 0);
            }
        }
    }, [tasks, selectedTaskId, displayedBatch]);

    const selectedTask = React.useMemo(
        () => tasks.find((task) => task.id === selectedTaskId) || tasks[tasks.length - 1],
        [tasks, selectedTaskId]
    );

    const latestTaskError = React.useMemo(
        () => [...tasks].reverse().find((task) => task.status === 'error' && task.error),
        [tasks]
    );

    React.useEffect(() => {
        if (latestTaskError?.error) {
            setError(latestTaskError.error);
        }
    }, [latestTaskError?.error, latestTaskError?.id]);

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

    const buildSubmitParams = React.useCallback(
        (formData: EditingFormData): SubmitParams => {
            const cfg = { ...loadConfig(), ...urlConfigOverridesRef.current };
            const provider = getImageModel(formData.model, cfg.customImageModels).provider;
            const providerConfig = getProviderCredentialConfig(cfg, provider, formData.providerInstanceId);
            const submitOpenaiApiKey = provider === 'openai' ? providerConfig.apiKey : cfg.openaiApiKey;
            const submitOpenaiApiBaseUrl = provider === 'openai' ? providerConfig.apiBaseUrl : cfg.openaiApiBaseUrl;
            const submitGeminiApiKey = provider === 'google' ? providerConfig.apiKey : cfg.geminiApiKey;
            const submitGeminiApiBaseUrl = provider === 'google' ? providerConfig.apiBaseUrl : cfg.geminiApiBaseUrl;
            const submitSensenovaApiKey = provider === 'sensenova' ? providerConfig.apiKey : cfg.sensenovaApiKey;
            const submitSensenovaApiBaseUrl = provider === 'sensenova' ? providerConfig.apiBaseUrl : cfg.sensenovaApiBaseUrl;
            const submitSeedreamApiKey = provider === 'seedream' ? providerConfig.apiKey : cfg.seedreamApiKey;
            const submitSeedreamApiBaseUrl = provider === 'seedream' ? providerConfig.apiBaseUrl : cfg.seedreamApiBaseUrl;
            const connectionMode = resolveClientDirectLinkConnectionMode(cfg, {
                clientDirectLinkPriority,
                model: formData.model,
                providerInstanceId: formData.providerInstanceId
            });
            const hasSourceImages = formData.imageFiles.length > 0;
            const sizeToSend = resolveImageRequestSize(
                formData.size,
                formData.model,
                formData.customWidth,
                formData.customHeight,
                cfg.customImageModels
            );

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
                    connectionMode,
                    providerInstanceId: formData.providerInstanceId,
                    apiKey: submitOpenaiApiKey || undefined,
                    apiBaseUrl: submitOpenaiApiBaseUrl || undefined,
                    geminiApiKey: submitGeminiApiKey || undefined,
                    geminiApiBaseUrl: submitGeminiApiBaseUrl || undefined,
                    sensenovaApiKey: submitSensenovaApiKey || undefined,
                    sensenovaApiBaseUrl: submitSensenovaApiBaseUrl || undefined,
                    seedreamApiKey: submitSeedreamApiKey || undefined,
                    seedreamApiBaseUrl: submitSeedreamApiBaseUrl || undefined,
                    customImageModels: cfg.customImageModels,
                    providerOptions: formData.providerOptions,
                    passwordHash: clientPasswordHash || undefined,
                    imageStorageMode: cfg.imageStorageMode,
                    imageStoragePath: cfg.imageStoragePath || undefined
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
                    connectionMode,
                    providerInstanceId: formData.providerInstanceId,
                    apiKey: submitOpenaiApiKey || undefined,
                    apiBaseUrl: submitOpenaiApiBaseUrl || undefined,
                    geminiApiKey: submitGeminiApiKey || undefined,
                    geminiApiBaseUrl: submitGeminiApiBaseUrl || undefined,
                    sensenovaApiKey: submitSensenovaApiKey || undefined,
                    sensenovaApiBaseUrl: submitSensenovaApiBaseUrl || undefined,
                    seedreamApiKey: submitSeedreamApiKey || undefined,
                    seedreamApiBaseUrl: submitSeedreamApiBaseUrl || undefined,
                    customImageModels: cfg.customImageModels,
                    providerOptions: formData.providerOptions,
                    passwordHash: clientPasswordHash || undefined,
                    imageStorageMode: cfg.imageStorageMode,
                    imageStoragePath: cfg.imageStoragePath || undefined
                };
            }
        },
        [enableStreaming, partialImages, clientPasswordHash, clientDirectLinkPriority]
    );

    const handleEditSubmit = React.useCallback(
        (formData: EditingFormData) => {
            setError(null);
            setDisplayedBatch(null);
            const taskId = submitTask(buildSubmitParams(formData));
            setSelectedTaskId(taskId);
            announceGenerationStatus(
                formData.imageFiles.length > 0
                    ? '已提交编辑任务，结果区会显示处理进度。'
                    : '已提交生成任务，结果区会显示处理进度。'
            );
            scrollToImageOutputOnMobile();
        },
        [announceGenerationStatus, scrollToImageOutputOnMobile, submitTask, buildSubmitParams, setDisplayedBatch]
    );

    const urlAutostartDefaultsRef = React.useRef<UrlAutostartFormDefaults>({
        n: editN[0],
        providerInstanceId,
        size: editSize,
        customWidth: editCustomWidth,
        customHeight: editCustomHeight,
        quality: editQuality,
        output_format: outputFormat,
        output_compression: compression[0],
        background,
        moderation,
        model: editModel
    });
    urlAutostartDefaultsRef.current = {
        n: editN[0],
        providerInstanceId,
        size: editSize,
        customWidth: editCustomWidth,
        customHeight: editCustomHeight,
        quality: editQuality,
        output_format: outputFormat,
        output_compression: compression[0],
        background,
        moderation,
        model: editModel
    };

    const handleEditSubmitRef = React.useRef(handleEditSubmit);
    React.useEffect(() => {
        handleEditSubmitRef.current = handleEditSubmit;
    }, [handleEditSubmit]);

    const applyResolvedUrlParams = React.useCallback(
        (parsed: ParsedUrlParams, consumed: ConsumedKeys, currentUrl: string, options: ApplyUrlParamsOptions = {}) => {
            if (parsed.prompt) {
                setEditPrompt(parsed.prompt);
            }

            const currentConfig: AppConfig = { ...loadConfig(), ...urlConfigOverridesRef.current };
            const configUpdates = buildSharedConfigUpdates(parsed, currentConfig, {
                clientDirectLinkPriority,
                modelFallback: urlAutostartDefaultsRef.current.model
            });

            if (parsed.model) {
                temporarySharedModelRef.current = options.suppressModelPreferenceSave ? parsed.model : null;
                setEditModel(parsed.model);
            }

            if (Object.keys(configUpdates).length > 0) {
                if (options.persistConfig) saveConfig(configUpdates);
                urlConfigOverridesRef.current = { ...urlConfigOverridesRef.current, ...configUpdates };
                setAppConfig((prev) => ({ ...prev, ...configUpdates }));
            }

            const resolvedProviderInstanceId =
                typeof configUpdates.selectedProviderInstanceId === 'string'
                    ? configUpdates.selectedProviderInstanceId
                    : parsed.providerInstanceId;
            if (resolvedProviderInstanceId) setProviderInstanceId(resolvedProviderInstanceId);

            const cleanedUrl = buildCleanedUrl(currentUrl, consumed);
            if (cleanedUrl !== currentUrl) {
                window.history.replaceState(null, '', cleanedUrl);
            }

            if (shouldAutoStartFromUrl(parsed)) {
                const formDefaults = urlAutostartDefaultsRef.current;
                handleEditSubmitRef.current({
                    prompt: parsed.prompt,
                    n: formDefaults.n,
                    size: formDefaults.size,
                    customWidth: formDefaults.customWidth,
                    customHeight: formDefaults.customHeight,
                    quality: formDefaults.quality,
                    output_format: formDefaults.output_format,
                    output_compression: formDefaults.output_compression,
                    background: formDefaults.background,
                    moderation: formDefaults.moderation,
                    imageFiles: [],
                    maskFile: null,
                    providerInstanceId: resolvedProviderInstanceId ?? formDefaults.providerInstanceId,
                    model: parsed.model ?? formDefaults.model
                });
            }
        },
        [clientDirectLinkPriority]
    );

    const applyUrlParams = React.useCallback(
        (parsed: ParsedUrlParams, consumed: ConsumedKeys, currentUrl: string) => {
            const storedConfig = loadConfig();
            if (hasMatchingStoredSharedConfig(parsed, storedConfig)) {
                applyResolvedUrlParams(parsed, consumed, currentUrl, {
                    suppressModelPreferenceSave: true
                });
                return;
            }

            if (shouldPromptForConfigPersistence(parsed)) {
                const currentConfig = { ...storedConfig, ...urlConfigOverridesRef.current };
                const provider = getImageModel(parsed.model, currentConfig.customImageModels).provider;
                setPendingSharedConfigChoice({
                    parsed,
                    consumed,
                    currentUrl,
                    apiKey: parsed.apiKey,
                    baseUrl: parsed.baseUrl,
                    model: parsed.model,
                    providerLabel: provider === 'google' ? 'Google Gemini' : 'OpenAI Compatible'
                });
                return;
            }

            applyResolvedUrlParams(parsed, consumed, currentUrl);
        },
        [applyResolvedUrlParams]
    );

    const handleUseSharedConfigTemporarily = React.useCallback(() => {
        if (!pendingSharedConfigChoice) return;
        const pending = pendingSharedConfigChoice;
        setPendingSharedConfigChoice(null);
        applyResolvedUrlParams(pending.parsed, pending.consumed, pending.currentUrl, {
            suppressModelPreferenceSave: true
        });
    }, [applyResolvedUrlParams, pendingSharedConfigChoice]);

    const handleSaveSharedConfigLocally = React.useCallback(() => {
        if (!pendingSharedConfigChoice) return;
        const pending = pendingSharedConfigChoice;
        setPendingSharedConfigChoice(null);
        applyResolvedUrlParams(pending.parsed, pending.consumed, pending.currentUrl, {
            persistConfig: true
        });
    }, [applyResolvedUrlParams, pendingSharedConfigChoice]);

    const handleIgnoreSharedConfig = React.useCallback(() => {
        if (!pendingSharedConfigChoice) return;
        const pending = pendingSharedConfigChoice;
        setPendingSharedConfigChoice(null);
        applyResolvedUrlParams(buildPromptOnlyUrlParams(pending.parsed), pending.consumed, pending.currentUrl, {
            suppressModelPreferenceSave: true
        });
    }, [applyResolvedUrlParams, pendingSharedConfigChoice]);

    React.useEffect(() => {
        if (!formPreferencesLoaded || !serverRuntimeConfigLoaded || urlInitDoneRef.current) return;
        urlInitDoneRef.current = true;

        if (typeof window === 'undefined') return;
        try {
            const currentUrl = window.location.href;
            const encryptedPayload = getSecureSharePayload(window.location.search);
            if (encryptedPayload) {
                const autoUnlockPassword = getSecureSharePasswordFromHash(window.location.hash);
                secureShareUrlRef.current = currentUrl;
                secureShareConsumedRef.current = {
                    prompt: true,
                    apiKey: true,
                    baseUrl: true,
                    model: true,
                    providerInstanceId: true,
                    autostart: true,
                    secureShare: true,
                    secureShareKey: Boolean(autoUnlockPassword)
                };
                secureShareAutoPasswordRef.current = autoUnlockPassword ?? null;
                setIsAutoUnlockingSecureShare(Boolean(autoUnlockPassword));
                setSecureSharePayload(encryptedPayload);
                setSecureShareDismissed(false);
                setSecureShareError('');
                return;
            }

            const { parsed, consumed } = parseUrlParams(window.location.search);
            applyUrlParams(parsed, consumed, currentUrl);
        } catch {
            console.error('Failed to initialize from URL params.');
        }
    }, [applyUrlParams, formPreferencesLoaded, serverRuntimeConfigLoaded]);

    const handleSecureShareUnlock = React.useCallback(
        async (password: string) => {
            if (!secureSharePayload) return;
            setIsUnlockingSecureShare(true);
            setSecureShareError('');

            try {
                const parsed = await decryptShareParams(secureSharePayload, password);
                let currentSecureShareUrl = secureShareUrlRef.current || window.location.href;
                let consumedForApply: ConsumedKeys =
                    secureShareConsumedRef.current ?? {
                        prompt: false,
                        apiKey: false,
                        baseUrl: false,
                        model: false,
                        providerInstanceId: false,
                        autostart: false,
                        secureShare: true
                    };

                if (consumedForApply.secureShareKey) {
                    const keylessUrl = buildCleanedUrl(currentSecureShareUrl, {
                        prompt: false,
                        apiKey: false,
                        baseUrl: false,
                        model: false,
                        providerInstanceId: false,
                        autostart: false,
                        secureShare: false,
                        secureShareKey: true
                    });
                    if (keylessUrl !== currentSecureShareUrl) window.history.replaceState(null, '', keylessUrl);
                    currentSecureShareUrl = keylessUrl;
                    consumedForApply = { ...consumedForApply, secureShareKey: false };
                    secureShareUrlRef.current = keylessUrl;
                    secureShareConsumedRef.current = consumedForApply;
                }

                applyUrlParams(parsed, consumedForApply, currentSecureShareUrl);
                setSecureSharePayload(null);
                setSecureShareDismissed(false);
            } catch (error) {
                const consumed = secureShareConsumedRef.current;
                if (consumed?.secureShareKey) {
                    const currentSecureShareUrl = secureShareUrlRef.current || window.location.href;
                    const cleanedUrl = buildCleanedUrl(currentSecureShareUrl, {
                        prompt: false,
                        apiKey: false,
                        baseUrl: false,
                        model: false,
                        providerInstanceId: false,
                        autostart: false,
                        secureShare: false,
                        secureShareKey: true
                    });
                    if (cleanedUrl !== currentSecureShareUrl) window.history.replaceState(null, '', cleanedUrl);
                    secureShareUrlRef.current = cleanedUrl;
                    secureShareConsumedRef.current = { ...consumed, secureShareKey: false };
                }
                setSecureShareError(error instanceof Error ? error.message : '加密分享链接解密失败。');
            } finally {
                setIsUnlockingSecureShare(false);
                setIsAutoUnlockingSecureShare(false);
            }
        },
        [applyUrlParams, secureSharePayload]
    );

    React.useEffect(() => {
        if (!secureSharePayload || isUnlockingSecureShare) return;
        const autoUnlockPassword = secureShareAutoPasswordRef.current;
        if (!autoUnlockPassword) return;
        secureShareAutoPasswordRef.current = null;
        void handleSecureShareUnlock(autoUnlockPassword);
    }, [handleSecureShareUnlock, isUnlockingSecureShare, secureSharePayload]);

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata) => {
            const originalStorageMode = item.storageModeUsed || 'fs';

            const selectedBatch = item.images.map((imgInfo) => {
                const path = getHistoryImagePath(imgInfo, originalStorageMode);

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
        [getHistoryImagePath]
    );
    const handleOpenClearHistoryDialog = React.useCallback(() => {
        setIsClearHistoryDialogOpen(true);
    }, []);

    const handleConfirmClearHistory = React.useCallback(async () => {
        setIsClearHistoryDialogOpen(false);
        setError(null);

        try {
            if (effectiveStorageModeClient === 'indexeddb') {
                await db.images.clear();
                blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                blobUrlCacheRef.current.clear();
            }

            const localStorageCleared = clearImageHistoryLocalStorage();
            if (!localStorageCleared) {
                throw new Error('无法清除浏览器中的生成历史记录。');
            }

            skipNextHistorySaveRef.current = true;
            setHistory([]);
        } catch (e) {
            console.error('Failed during history clearing:', e);
            setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
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
            const historyImage = history
                .flatMap((entry) => entry.images)
                .find((image) => image.filename === filename);
            const record = allDbImages?.find((img) => img.filename === filename);

            if (record?.blob) {
                blob = record.blob;
                mimeType = blob.type || mimeType;
            } else if (cachedUrl) {
                const proxyUrl = getFetchableImageUrl(cachedUrl, clientPasswordHash);
                if (isTauriDesktop()) {
                    try {
                        const extUrl = new URL(cachedUrl, window.location.href);
                        if ((extUrl.protocol === 'http:' || extUrl.protocol === 'https:') && extUrl.origin !== window.location.origin) {
                            const image = await invokeDesktopCommand<DesktopRemoteImageResponse>('proxy_remote_image_with_type', {
                                url: cachedUrl,
                                proxyConfig: desktopProxyConfig
                            });
                            blob = new Blob([new Uint8Array(image.bytes)], { type: image.contentType });
                            mimeType = blob.type || mimeType;
                        } else if (proxyUrl) {
                            const response = await fetch(proxyUrl);
                            if (!response.ok) throw new Error(await getApiResponseErrorMessage(response, 'Failed to fetch image.'));
                            blob = await response.blob();
                            mimeType = blob.type || mimeType;
                        }
                    } catch (proxyError) {
                        console.warn('Desktop remote cached image proxy failed while sending to edit:', proxyError);
                    }
                } else if (proxyUrl) {
                    const response = await fetch(proxyUrl);
                    if (!response.ok) {
                        throw new Error(await getApiResponseErrorMessage(response, 'Failed to fetch image.'));
                    }
                    blob = await response.blob();
                    mimeType = blob.type || mimeType;
                }
            } else if (historyImage?.path) {
                if (isTauriDesktop() && !isBrowserAddressableImagePath(historyImage.path)) {
                    const response = await fetch(convertFileSrc(historyImage.path));
                    if (!response.ok) {
                        throw new Error(await getApiResponseErrorMessage(response, 'Failed to fetch local desktop image.'));
                    }
                    blob = await response.blob();
                    mimeType = response.headers.get('Content-Type') || blob.type || mimeType;
                } else {
                    const proxyUrl = getFetchableImageUrl(historyImage.path, clientPasswordHash);
                    if (isTauriDesktop()) {
                        try {
                            const extUrl = new URL(historyImage.path, window.location.href);
                            if ((extUrl.protocol === 'http:' || extUrl.protocol === 'https:') && extUrl.origin !== window.location.origin) {
                                const image = await invokeDesktopCommand<DesktopRemoteImageResponse>('proxy_remote_image_with_type', {
                                    url: historyImage.path,
                                    proxyConfig: desktopProxyConfig
                                });
                                blob = new Blob([new Uint8Array(image.bytes)], { type: image.contentType });
                                mimeType = blob.type || mimeType;
                            } else if (proxyUrl) {
                                const response = await fetch(proxyUrl);
                                if (!response.ok) throw new Error(await getApiResponseErrorMessage(response, 'Failed to fetch image.'));
                                blob = await response.blob();
                                mimeType = response.headers.get('Content-Type') || blob.type || mimeType;
                            }
                        } catch (proxyError) {
                            console.warn('Desktop remote history image proxy failed while sending to edit:', proxyError);
                        }
                    } else if (proxyUrl) {
                        const response = await fetch(proxyUrl);
                        if (!response.ok) {
                            throw new Error(await getApiResponseErrorMessage(response, 'Failed to fetch image.'));
                        }
                        blob = await response.blob();
                        mimeType = response.headers.get('Content-Type') || blob.type || mimeType;
                    }
                }
            } else if (effectiveStorageModeClient === 'fs') {
                if (isTauriDesktop()) {
                    const bytes = await invokeDesktopCommand<number[]>('serve_local_image', {
                        filename,
                        customStoragePath: appConfig.imageStoragePath || undefined
                    });
                    blob = new Blob([new Uint8Array(bytes)]);
                    mimeType = blob.type || mimeType;
                } else {
                    const response = await fetch(`/api/image/${filename}`);
                    if (!response.ok) {
                        throw new Error(await getApiResponseErrorMessage(response, 'Failed to fetch image.'));
                    }
                    blob = await response.blob();
                    mimeType = response.headers.get('Content-Type') || mimeType;
                }
            } else {
                throw new Error(`Image ${filename} not found.`);
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
                    if (isTauriDesktop()) {
                        const results = await invokeDesktopCommand<Array<{ filename: string; success: boolean; error?: string }>>(
                            'delete_local_images',
                            { filenames: filenamesToDelete, customStoragePath: appConfig.imageStoragePath || undefined }
                        );
                        const failed = results.filter((r) => !r.success);
                        if (failed.length > 0 && failed.length === results.length) {
                            throw new Error(failed.map((r) => r.error).filter(Boolean).join('; '));
                        }
                        if (failed.length > 0) {
                            addNotice(`历史条目已移除，但 ${failed.length} 个本地文件删除失败。`, 'warning');
                            setError(failed.slice(0, 3).map((r) => `${r.filename}: ${r.error || '删除失败'}`).join('\n'));
                        }
                    } else {
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
                }

                setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
            } catch (e: unknown) {
                console.error('Error during item deletion:', e);
                const message = e instanceof Error ? e.message : 'An unexpected error occurred during deletion.';
                setError(message);
                addNotice(message, 'error');
            } finally {
                setItemToDeleteConfirm(null);
            }
        },
        [addNotice, appConfig.imageStoragePath, isPasswordRequiredByBackend, clientPasswordHash]
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

    const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
    const [selectionMode, setSelectionMode] = React.useState(false);

    const handleToggleSelectionMode = React.useCallback(() => {
        setSelectionMode((prev) => !prev);
        setSelectedIds(new Set());
    }, []);

    const handleSelectItem = React.useCallback((id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleSelectAll = React.useCallback((ids: number[]) => {
        setSelectedIds(new Set(ids));
    }, []);

    const handleReplaceSelectedItems = React.useCallback((ids: number[]) => {
        setSelectedIds(new Set(ids));
    }, []);

    const handleCancelSelection = React.useCallback(() => {
        setSelectedIds(new Set());
        setSelectionMode(false);
    }, []);

    const resolveHistoryImageBlob = React.useCallback(
        async (image: HistoryImage, storageMode: ImageStorageMode) => {
            if (image.path) {
                if (isTauriDesktop() && !isBrowserAddressableImagePath(image.path)) {
                    const response = await fetch(convertFileSrc(image.path));
                    if (!response.ok) {
                        throw new Error(await getApiResponseErrorMessage(response, `图片下载失败：${image.filename}`));
                    }
                    return response.blob();
                }

                if (isTauriDesktop()) {
                    try {
                        const extUrl = new URL(image.path, window.location.href);
                        if ((extUrl.protocol === 'http:' || extUrl.protocol === 'https:') && extUrl.origin !== window.location.origin) {
                            const proxiedImage = await invokeDesktopCommand<DesktopRemoteImageResponse>('proxy_remote_image_with_type', {
                                url: image.path,
                                proxyConfig: desktopProxyConfig
                            });
                            return new Blob([new Uint8Array(proxiedImage.bytes)], { type: proxiedImage.contentType });
                        }
                    } catch (proxyError) {
                        console.warn('Desktop remote image proxy failed, falling back to fetch:', proxyError);
                    }
                }
                const proxyUrl = getFetchableImageUrl(image.path, clientPasswordHash);
                if (proxyUrl) {
                    const response = await fetch(proxyUrl);
                    if (!response.ok) {
                        throw new Error(await getApiResponseErrorMessage(response, `图片下载失败：${image.filename}`));
                    }
                    return response.blob();
                }
            }

            const { filename } = image;

            if (storageMode === 'indexeddb') {
                const cachedUrl = blobUrlCacheRef.current.get(filename);
                if (cachedUrl) {
                    const response = await fetch(cachedUrl);
                    if (!response.ok) {
                        throw new Error(await getApiResponseErrorMessage(response, `无法读取图片缓存：${filename}`));
                    }

                    return response.blob();
                }

                const record = allDbImages?.find((img) => img.filename === filename);
                if (record?.blob) {
                    return record.blob;
                }

                throw new Error(`图片不存在：${filename}`);
            }

            if (isTauriDesktop()) {
                const bytes = await invokeDesktopCommand<number[]>('serve_local_image', {
                    filename,
                    customStoragePath: appConfig.imageStoragePath || undefined
                });
                return new Blob([new Uint8Array(bytes)]);
            }

            const response = await fetch(`/api/image/${filename}`);
            if (!response.ok) {
                throw new Error(await getApiResponseErrorMessage(response, `图片下载失败：${filename}`));
            }
            return response.blob();
        },

        [allDbImages, appConfig.imageStoragePath, clientPasswordHash, desktopProxyConfig]
    );

    const triggerBrowserDownload = React.useCallback((blob: Blob, downloadName: string) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = downloadName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, []);

    const saveImageToDesktopDownloads = React.useCallback(
        async (imageBytes: number[], downloadName: string): Promise<{ path: string; filename: string } | null> => {
            if (!isTauriDesktop()) return null;
            return invokeDesktopCommand<{ path: string; filename: string }>('save_image_to_downloads', {
                filename: downloadName,
                bytes: imageBytes
            });
        },
        []
    );

    const handleDownloadSingle = React.useCallback(
        async (item: HistoryMetadata) => {
            const storageMode = item.storageModeUsed || 'fs';
            const ext = item.output_format || 'png';
            const timestamp = item.timestamp;

            setError(null);
            const totalImages = item.images.length;
            if (totalImages > 0) {
                addNotice(`开始下载 ${totalImages} 张图片...`, 'info');
            }

            try {
                let downloadedCount = 0;
                for (let i = 0; i < item.images.length; i++) {
                    const image = item.images[i];
                    const blob = await resolveHistoryImageBlob(image, storageMode);
                    const downloadName = `history-${timestamp}-${i + 1}.${ext}`;

                    if (isTauriDesktop()) {
                        const saveResult = await saveImageToDesktopDownloads(
                            Array.from(new Uint8Array(await blob.arrayBuffer())),
                            downloadName
                        );
                        if (saveResult) {
                            console.log(`Saved to downloads: ${saveResult.path}`);
                        } else {
                            triggerBrowserDownload(blob, downloadName);
                        }
                    } else {
                        triggerBrowserDownload(blob, downloadName);
                    }
                    downloadedCount += 1;
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
                addNotice(
                    isTauriDesktop()
                        ? `已保存 ${downloadedCount} 张图片到系统下载目录。`
                        : `已触发 ${downloadedCount} 张图片下载。`,
                    'success'
                );
            } catch (e: unknown) {
                console.error('Error downloading history item:', e);
                const message = e instanceof Error ? e.message : '下载图片时发生未知错误。';
                setError(message);
                addNotice(message, 'error');
            }
        },
        [addNotice, resolveHistoryImageBlob, triggerBrowserDownload, saveImageToDesktopDownloads]
    );

    const handleDownloadAllSelected = React.useCallback(async () => {
        const selectedItems = history.filter((h) => selectedIds.has(h.timestamp));
        const totalImages = selectedItems.reduce((total, item) => total + item.images.length, 0);

        setError(null);

        if (totalImages === 0) {
            addNotice('没有可下载的选中图片。', 'warning');
            return;
        }

        addNotice(`开始批量下载 ${totalImages} 张图片...`, 'info');

        let processedCount = 0;
        let downloadedCount = 0;
        const failures: string[] = [];

        for (const item of selectedItems) {
            const storageMode = item.storageModeUsed || 'fs';
            const ext = item.output_format || 'png';
            const timestamp = item.timestamp;

            for (let i = 0; i < item.images.length; i++) {
                const downloadName = `history-${timestamp}-${i + 1}.${ext}`;
                try {
                    const image = item.images[i];
                    const blob = await resolveHistoryImageBlob(image, storageMode);

                    if (isTauriDesktop()) {
                        const saveResult = await saveImageToDesktopDownloads(
                            Array.from(new Uint8Array(await blob.arrayBuffer())),
                            downloadName
                        );
                        if (saveResult) {
                            console.log(`Saved to downloads: ${saveResult.path}`);
                        } else {
                            triggerBrowserDownload(blob, downloadName);
                        }
                    } else {
                        triggerBrowserDownload(blob, downloadName);
                    }
                    downloadedCount += 1;
                } catch (e: unknown) {
                    console.error(`Error downloading ${downloadName}:`, e);
                    const message = e instanceof Error ? e.message : '未知错误';
                    failures.push(`${downloadName}: ${message}`);
                } finally {
                    processedCount += 1;
                    if (processedCount === 1 || processedCount === totalImages || processedCount % 5 === 0) {
                        addNotice(`批量下载进度 ${processedCount}/${totalImages}`, 'info');
                    }
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }
            }
        }

        if (failures.length > 0) {
            const message = `批量下载完成 ${downloadedCount}/${totalImages} 张，${failures.length} 张失败。`;
            setError(`${message}\n${failures.slice(0, 3).join('\n')}`);
            addNotice(message, downloadedCount > 0 ? 'warning' : 'error');
            return;
        }

        addNotice(
            isTauriDesktop()
                ? `已保存 ${downloadedCount} 张图片到系统下载目录。`
                : `已触发 ${downloadedCount} 张图片下载。`,
            'success'
        );
    }, [addNotice, history, selectedIds, resolveHistoryImageBlob, triggerBrowserDownload, saveImageToDesktopDownloads]);

    const executeBatchDelete = React.useCallback(async () => {
        setError(null);
        const itemsToDelete = history.filter((h) => selectedIds.has(h.timestamp));
        if (itemsToDelete.length === 0) {
            addNotice('没有选中的历史条目可删除。', 'warning');
            return;
        }

        const fsFilenames: string[] = [];
        const indexedDbFilenames: string[] = [];
        const timestampsToDelete = new Set<number>();
        const partialDeleteFailures: string[] = [];

        for (const item of itemsToDelete) {
            const storageMode = item.storageModeUsed || 'fs';
            const filenames = item.images.map((img) => img.filename);
            if (storageMode === 'indexeddb') {
                indexedDbFilenames.push(...filenames);
            } else {
                fsFilenames.push(...filenames);
            }
            timestampsToDelete.add(item.timestamp);
        }

        try {
            if (indexedDbFilenames.length > 0) {
                await db.images.where('filename').anyOf(indexedDbFilenames).delete();
                indexedDbFilenames.forEach((fn) => {
                    const url = blobUrlCacheRef.current.get(fn);
                    if (url) URL.revokeObjectURL(url);
                    blobUrlCacheRef.current.delete(fn);
                });
            }

            if (fsFilenames.length > 0) {
                if (isTauriDesktop()) {
                    const results = await invokeDesktopCommand<Array<{ filename: string; success: boolean; error?: string }>>(
                            'delete_local_images',
                            { filenames: fsFilenames, customStoragePath: appConfig.imageStoragePath || undefined }
                        );
                    const failed = results.filter((r) => !r.success);
                    if (failed.length > 0 && failed.length === results.length) {
                        throw new Error(failed.map((r) => r.error).filter(Boolean).join('; '));
                    }
                    if (failed.length > 0) {
                        partialDeleteFailures.push(...failed.map((r) => `${r.filename}: ${r.error || '删除失败'}`));
                    }
                } else {
                    const apiPayload: { filenames: string[]; passwordHash?: string } = {
                        filenames: fsFilenames
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
            }

            setHistory((prev) => prev.filter((h) => !timestampsToDelete.has(h.timestamp)));
            setSelectedIds(new Set());
            setSelectionMode(false);
            if (partialDeleteFailures.length > 0) {
                addNotice(`已删除 ${itemsToDelete.length} 个历史条目，${partialDeleteFailures.length} 个本地文件删除失败。`, 'warning');
                setError(partialDeleteFailures.slice(0, 3).join('\n'));
            } else {
                addNotice(`已删除 ${itemsToDelete.length} 个历史条目。`, 'success');
            }
        } catch (e: unknown) {
            console.error('Error during bulk deletion:', e);
            const message = e instanceof Error ? e.message : 'An unexpected error occurred during bulk deletion.';
            setError(message);
            addNotice(message, 'error');
        }
    }, [addNotice, appConfig.imageStoragePath, selectedIds, history, isPasswordRequiredByBackend, clientPasswordHash]);

    const handleDeleteSelected = React.useCallback(() => {
        if (selectedIds.size === 0) return;
        if (skipDeleteConfirmation) {
            void executeBatchDelete();
            return;
        }
        setPendingBatchDelete(selectedIds.size);
    }, [selectedIds.size, skipDeleteConfirmation, executeBatchDelete]);

    const confirmBatchDelete = React.useCallback(() => {
        setPendingBatchDelete(0);
        void executeBatchDelete();
    }, [executeBatchDelete]);

    return (
        <>
            <main className='app-theme-scope text-foreground flex min-h-dvh flex-col items-center overflow-x-hidden px-0 py-4 md:p-6 lg:p-8'>
                {' '}
                {isGlobalDragOver && (
                    <div className='pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center border-4 border-dashed border-violet-500/60 bg-black/70 backdrop-blur-sm'>
                        <div className='flex flex-col items-center gap-4 text-center'>
                            <div className='flex h-20 w-20 items-center justify-center rounded-full border-2 border-violet-400 bg-violet-500/20'>
                                <svg
                                    className='h-10 w-10 text-violet-400'
                                    fill='none'
                                    viewBox='0 0 24 24'
                                    stroke='currentColor'
                                    strokeWidth={1.5}>
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5'
                                    />
                                </svg>
                            </div>
                            <p className='text-2xl font-semibold text-violet-300'>释放以添加图片</p>
                            <p className='text-sm text-white/50'>添加源图片后将自动执行编辑任务</p>
                        </div>
                    </div>
                )}
                <div className='mb-4 w-full max-w-screen-2xl [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] md:px-0'>
                    <div className='flex w-full items-center justify-between gap-3 py-1 sm:py-1.5'>
                        <div className='flex min-w-0 items-center gap-3'>
                            <span className='ring-border flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white to-violet-50 shadow-inner ring-1 sm:h-10 sm:w-10 sm:rounded-xl dark:from-white/95 dark:to-sky-100/90'>
                                <Image
                                    src='/favicon.svg'
                                    alt=''
                                    aria-hidden='true'
                                    width={28}
                                    height={28}
                                    className='h-5 w-5 sm:h-7 sm:w-7'
                                />
                            </span>
                            <div className='min-w-0'>
                                <h1 className='from-foreground truncate bg-gradient-to-r via-violet-700 to-sky-700 bg-clip-text text-lg font-black tracking-tight text-transparent sm:text-2xl md:text-3xl dark:via-violet-200 dark:to-sky-200'>
                                    GPT Image Playground
                                </h1>
                                <p className='text-muted-foreground -mt-0.5 truncate text-[10px] font-semibold tracking-[0.22em] uppercase sm:mt-0.5 sm:text-[11px]'>
                                    AI image generation studio
                                </p>
                            </div>
                        </div>
                        <div className='flex shrink-0 items-center gap-1 sm:gap-2'>
                            <ThemeToggle />
                            <AboutDialog />
                            <SettingsDialog onConfigChange={handleConfigChange} />
                        </div>
                    </div>
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
                <SecureShareUnlockDialog
                    // When the URL includes #key, auto-unlock first; only show this dialog if manual input is needed.
                    open={Boolean(secureSharePayload) && !secureShareDismissed && !isAutoUnlockingSecureShare}
                    isUnlocking={isUnlockingSecureShare}
                    errorMessage={secureShareError}
                    onUnlock={handleSecureShareUnlock}
                    onOpenChange={(nextOpen) => {
                        setSecureShareDismissed(!nextOpen);
                        if (nextOpen) setSecureShareError('');
                    }}
                />
                {pendingSharedConfigChoice && (
                    <SharedConfigChoiceDialog
                        open={true}
                        providerLabel={pendingSharedConfigChoice.providerLabel}
                        apiKey={pendingSharedConfigChoice.apiKey}
                        baseUrl={pendingSharedConfigChoice.baseUrl}
                        model={pendingSharedConfigChoice.model}
                        onUseTemporarily={handleUseSharedConfigTemporarily}
                        onSaveLocally={handleSaveSharedConfigLocally}
                        onIgnoreConfig={handleIgnoreSharedConfig}
                    />
                )}
                <div className='sr-only' aria-live='polite' aria-atomic='true'>
                    {generationAnnouncement}
                </div>
                <div className='w-full max-w-screen-2xl space-y-6'>
                    <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
                        <div
                            className='relative flex min-h-0 flex-col lg:col-span-1 lg:h-[70vh] lg:min-h-[600px]'
                            data-editing-form-anchor>
                            <EditingForm
                                onSubmit={handleEditSubmit}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                editModel={editModel}
                                setEditModel={setEditModel}
                                providerInstanceId={providerInstanceId}
                                setProviderInstanceId={setProviderInstanceId}
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
                                promptHistoryLimit={appConfig.promptHistoryLimit}
                                customImageModels={appConfig.customImageModels}
                                appConfig={appConfig}
                                clientDirectLinkPriority={clientDirectLinkPriority}
                                shareApiKey={shareApiKey}
                                shareApiBaseUrl={shareApiBaseUrl}
                                shareProviderInstanceId={shareProviderInstanceId}
                                shareProviderLabel={shareProviderLabel}
                            />
                        </div>
                        <div
                            ref={imageOutputAnchorRef}
                            className='flex min-h-[420px] scroll-mt-4 flex-col lg:col-span-1 lg:h-[70vh] lg:min-h-[600px]'>
                            {error && (
                                <Alert
                                    variant='destructive'
                                    className='mb-4 border-red-200 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-900/20 dark:text-red-300'>
                                    <AlertTitle className='text-red-800 dark:text-red-200'>错误</AlertTitle>
                                    <AlertDescription className='text-red-700 dark:text-red-300'>{error}</AlertDescription>
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
                            onCancel={handleTaskCancelOrDismiss}
                            onSelectTask={(id) => {
                                setSelectedTaskId(id);
                                setDisplayedBatch(null);
                            }}
                            selectedTaskId={selectedTaskId || undefined}
                        />
                        <HistoryPanel
                            history={history}
                            onSelectImage={handleHistorySelect}
                            onClearHistory={handleOpenClearHistoryDialog}
                            getImageSrc={getImageSrc}
                            onSendToEdit={handleSendToEdit}
                            onDeleteItemRequest={handleRequestDeleteItem}
                            itemPendingDeleteConfirmation={itemToDeleteConfirm}
                            onConfirmDeletion={handleConfirmDeletion}
                            onCancelDeletion={handleCancelDeletion}
                            deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                            onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                            selectionMode={selectionMode}
                            selectedIds={selectedIds}
                            onSelectItem={handleSelectItem}
                            onSelectAll={handleSelectAll}
                            onReplaceSelectedItems={handleReplaceSelectedItems}
                            onToggleSelectionMode={handleToggleSelectionMode}
                            onDownloadSingle={handleDownloadSingle}
                            onDownloadAllSelected={handleDownloadAllSelected}
                            onDeleteSelected={handleDeleteSelected}
                            onCancelSelection={handleCancelSelection}
                        />
                    </div>
                </div>

                <Dialog open={pendingBatchDelete > 0} onOpenChange={(open) => { if (!open) setPendingBatchDelete(0); }}>
                    <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle>确认批量删除</DialogTitle>
                            <DialogDescription className='pt-2'>
                                确定要删除选中的 {pendingBatchDelete} 个条目吗？将移除相关图片。此操作不可撤销。
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className='gap-2 sm:justify-end'>
                            <DialogClose asChild>
                                <Button variant='outline' onClick={() => setPendingBatchDelete(0)}>取消</Button>
                            </DialogClose>
                            <Button variant='destructive' onClick={confirmBatchDelete}>删除</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <ClearHistoryDialog
                    open={isClearHistoryDialogOpen}
                    onOpenChange={setIsClearHistoryDialogOpen}
                    onConfirm={handleConfirmClearHistory}
                    isIndexedDBMode={effectiveStorageModeClient === 'indexeddb'}
                />
            </main>
        </>
    );
}
