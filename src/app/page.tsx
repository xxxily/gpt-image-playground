'use client';

import { AboutDialog } from '@/components/about-dialog';
import { ClearHistoryDialog } from '@/components/clear-history-dialog';
import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { useNotice } from '@/components/notice-provider';
import { PasswordDialog } from '@/components/password-dialog';
import { PromoSlot } from '@/components/promo-slot';
import { SecureShareUnlockDialog } from '@/components/secure-share-unlock-dialog';
import { SettingsDialog } from '@/components/settings-dialog';
import { SharedConfigChoiceDialog } from '@/components/shared-config-choice-dialog';
import { SharedSyncConfigChoiceDialog } from '@/components/shared-sync-config-choice-dialog';
import { TaskTracker } from '@/components/task-tracker';
import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose
} from '@/components/ui/dialog';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useTaskManager, type SubmitParams } from '@/hooks/useTaskManager';
import { getApiResponseErrorMessage } from '@/lib/api-error';
import {
    getClipboardImageFiles,
    getClipboardImageSources,
    getClipboardText,
    isImageFileLike
} from '@/lib/clipboard-images';
import { CONFIG_CHANGED_EVENT, DEFAULT_CONFIG, loadConfig, saveConfig, type AppConfig } from '@/lib/config';
import { isEnabledEnvFlag } from '@/lib/connection-policy';
import { db } from '@/lib/db';
import { desktopProxyConfigFromAppConfig } from '@/lib/desktop-config';
import { invokeDesktopCommand, isTauriDesktop } from '@/lib/desktop-runtime';
import {
    getVisibleExampleHistory,
    loadHiddenExampleHistoryIds,
    normalizeExampleHistoryMode,
    saveHiddenExampleHistoryIds,
    shouldShowExampleHistory,
    type ExampleHistoryMetadata
} from '@/lib/example-history';
import {
    flushImageFormPreferencesSave,
    loadImageFormPreferences,
    scheduleImageFormPreferencesSave
} from '@/lib/form-preferences';
import { clearImageHistoryLocalStorage, loadImageHistory, saveImageHistory } from '@/lib/image-history';
import { DEFAULT_IMAGE_MODEL, getImageModel } from '@/lib/model-registry';
import { getRemovedBlobObjectUrls, revokeBlobObjectUrls } from '@/lib/object-url';
import { PROMPT_HISTORY_CHANGED_EVENT } from '@/lib/prompt-history';
import { USER_PROMPT_TEMPLATES_CHANGED_EVENT } from '@/lib/prompt-template-storage';
import { getProviderCredentialConfig } from '@/lib/provider-config';
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
    uploadSnapshot,
    deleteRemoteImages,
    previewUploadSnapshot,
    previewRestoreSnapshot,
    downloadAndRestoreSnapshot,
    loadSyncConfig,
    saveSyncConfig,
    isS3SyncConfigConfigured,
    SYNC_CONFIG_CHANGED_EVENT,
    buildBasePrefix,
    createSyncStatusDetails,
    type ImageSyncPreview,
    type RestoreSyncMode,
    type SyncDebugEntry,
    type SyncResult,
    type SyncStatusDetails,
    type SyncProviderConfig,
    type SyncAutoSyncScopes,
    type SharedSyncConfig,
    type SharedSyncRestoreOptions
} from '@/lib/sync';
import {
    parseUrlParams,
    buildCleanedUrl,
    findShareUrlInText,
    isLikelyShareTextCandidate,
    getSecureSharePayload,
    getSecureSharePasswordFromHash,
    shouldAutoStartFromUrl,
    type ConsumedKeys,
    type ParsedUrlParams
} from '@/lib/url-params';
import type { HistoryImage, HistoryMetadata, ImageStorageMode } from '@/types/history';
import { convertFileSrc } from '@tauri-apps/api/core';
import { readImage } from '@tauri-apps/plugin-clipboard-manager';
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

type PendingSharedSyncConfigChoice = {
    sharedSyncConfig: SharedSyncConfig;
};

type ApplyUrlParamsOptions = {
    persistConfig?: boolean;
    suppressModelPreferenceSave?: boolean;
};

type ShareTextApplyResult =
    | {
          recognized: false;
      }
    | {
          recognized: true;
          kind: 'secure';
      }
    | {
          recognized: true;
          kind: 'plain';
          hasPrompt: boolean;
      };

type ImageSyncActionOptions = {
    force?: boolean;
    since?: number;
    manifestKey?: string;
};

type PendingImageSyncConfirmation = {
    operation: 'upload' | 'restore';
    options: ImageSyncActionOptions;
    title: string;
    description: string;
    confirmLabel: string;
    preview: ImageSyncPreview;
};

type AutoSyncPendingState = {
    scopes: SyncAutoSyncScopes;
    since?: number;
};

const EMPTY_AUTO_SYNC_SCOPES: SyncAutoSyncScopes = {
    appConfig: false,
    polishingPrompts: false,
    promptHistory: false,
    promptTemplates: false,
    imageHistory: false,
    imageBlobs: false
};

const POLISHING_PROMPT_CONFIG_KEYS = new Set<keyof AppConfig>([
    'polishingPrompt',
    'polishingPresetId',
    'polishingCustomPrompts',
    'polishPickerOrder'
]);

function createEmptyAutoSyncScopes(): SyncAutoSyncScopes {
    return { ...EMPTY_AUTO_SYNC_SCOPES };
}

function hasAnyAutoSyncScope(scopes: SyncAutoSyncScopes): boolean {
    return Object.values(scopes).some(Boolean);
}

function intersectAutoSyncScopes(
    requested: Partial<SyncAutoSyncScopes>,
    enabled: SyncAutoSyncScopes
): SyncAutoSyncScopes {
    return {
        appConfig: Boolean(requested.appConfig && enabled.appConfig),
        polishingPrompts: Boolean(requested.polishingPrompts && enabled.polishingPrompts),
        promptHistory: Boolean(requested.promptHistory && enabled.promptHistory),
        promptTemplates: Boolean(requested.promptTemplates && enabled.promptTemplates),
        imageHistory: Boolean(requested.imageHistory && enabled.imageHistory),
        imageBlobs: Boolean(requested.imageBlobs && enabled.imageBlobs)
    };
}

function mergeAutoSyncScopes(current: SyncAutoSyncScopes, incoming: SyncAutoSyncScopes): SyncAutoSyncScopes {
    return {
        appConfig: current.appConfig || incoming.appConfig,
        polishingPrompts: current.polishingPrompts || incoming.polishingPrompts,
        promptHistory: current.promptHistory || incoming.promptHistory,
        promptTemplates: current.promptTemplates || incoming.promptTemplates,
        imageHistory: current.imageHistory || incoming.imageHistory,
        imageBlobs: current.imageBlobs || incoming.imageBlobs
    };
}

function collectHistoryImageTimestamps(history: HistoryMetadata[]): Map<string, number> {
    const timestamps = new Map<string, number>();
    for (const entry of history) {
        for (const image of entry.images) {
            timestamps.set(image.filename, entry.timestamp);
        }
    }
    return timestamps;
}

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

function getImageMimeTypeFromFilename(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'webp') return 'image/webp';
    if (extension === 'gif') return 'image/gif';
    return 'image/png';
}

function prefersReducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isLargeLayout(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
}

function formatImageSyncScopeLabel(since?: number): string {
    if (since === undefined) return '全部历史图片';

    const elapsedMs = Math.max(0, Date.now() - since);
    const elapsedHours = Math.max(1, Math.round(elapsedMs / 3600000));
    if (elapsedHours < 24) return `最近 ${elapsedHours} 小时图片`;

    const elapsedDays = Math.max(1, Math.round(elapsedHours / 24));
    return `最近 ${elapsedDays} 天图片`;
}

function getLatestSyncManifestKey(config: SyncProviderConfig): string {
    return `${buildBasePrefix(config.s3.profileId, config.s3.prefix)}/manifest.json`;
}

function createSyncDebugEntry(step: string, message: string, startedAt: number): SyncDebugEntry {
    const at = Date.now();
    return { at, step, message, elapsedMs: at - startedAt };
}

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
const clientDirectLinkPriorityEnv = isEnabledEnvFlag(process.env.NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY);
const exampleHistoryMode = normalizeExampleHistoryMode(process.env.NEXT_PUBLIC_EXAMPLE_HISTORY);

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
    const [showExampleHistory, setShowExampleHistory] = React.useState(false);
    const [hiddenExampleHistoryIds, setHiddenExampleHistoryIds] = React.useState<Set<number>>(() => new Set());
    const skipNextHistorySaveRef = React.useRef(false);
    const skipNextHistoryAutoSyncRef = React.useRef(false);
    const historyAutoSyncBaselineRef = React.useRef<HistoryMetadata[] | null>(null);
    const autoSyncSuppressedRef = React.useRef(false);
    const autoSyncTimerRef = React.useRef<number | null>(null);
    const autoSyncPendingRef = React.useRef<AutoSyncPendingState | null>(null);
    const autoSyncInFlightRef = React.useRef(false);
    const wakeLockNoticeShownRef = React.useRef(false);
    const backgroundWorkNoticeShownRef = React.useRef(false);
    const deleteRemoteHistoryImagesRef = React.useRef<
        (filenames: string[], nextHistory: HistoryMetadata[]) => Promise<boolean>
    >(async () => false);
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const pendingBlobUrlLoadsRef = React.useRef<Set<string>>(new Set());
    const failedBlobUrlLoadsRef = React.useRef<Set<string>>(new Set());
    const [blobUrlRevision, bumpBlobUrlRevision] = React.useReducer((value: number) => value + 1, 0);
    const blobUrlRevisionRafRef = React.useRef<number | null>(null);
    const imageOutputAnchorRef = React.useRef<HTMLDivElement>(null);
    const generationAnnouncementTimerRef = React.useRef<number | null>(null);
    const urlInitDoneRef = React.useRef(false);
    const urlConfigOverridesRef = React.useRef<Partial<AppConfig>>({});
    const temporarySharedModelRef = React.useRef<string | null>(null);
    const secureShareUrlRef = React.useRef<string>('');
    const secureShareConsumedRef = React.useRef<ConsumedKeys | null>(null);
    const secureSharePublicParamsRef = React.useRef<ParsedUrlParams | null>(null);
    const secureShareAutoPasswordRef = React.useRef<string | null>(null);
    const applyShareUrlTextRef = React.useRef<(text: string) => ShareTextApplyResult>(() => ({ recognized: false }));
    const lastPromptShareRecognitionRef = React.useRef<string | null>(null);
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
    const [pendingSharedSyncConfigChoice, setPendingSharedSyncConfigChoice] =
        React.useState<PendingSharedSyncConfigChoice | null>(null);
    const [promoProfileId, setPromoProfileId] = React.useState<string | null>(null);
    const isMobileTauriClient = React.useMemo(() => {
        if (!isTauriDesktop() || typeof navigator === 'undefined') return false;
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    }, []);
    const runSharedSyncRestoreRef = React.useRef<((restoreOptions: SharedSyncRestoreOptions) => void) | null>(null);
    const sharedSyncAutoRestoreConsumedRef = React.useRef(false);
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [pendingBatchDelete, setPendingBatchDelete] = React.useState<number>(0);
    const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = React.useState(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);
    const [deleteRemoteWithLocal, setDeleteRemoteWithLocal] = React.useState(false);
    const [batchDeleteRemoteWithLocal, setBatchDeleteRemoteWithLocal] = React.useState(false);
    const [clearHistoryRemoteWithLocal, setClearHistoryRemoteWithLocal] = React.useState(false);
    const [isGlobalDragOver, setIsGlobalDragOver] = React.useState(false);
    const [generationAnnouncement, setGenerationAnnouncement] = React.useState('');

    const visibleExampleHistory = React.useMemo(
        () => getVisibleExampleHistory(hiddenExampleHistoryIds),
        [hiddenExampleHistoryIds]
    );

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const editSourceImagePreviewUrlsRef = React.useRef<string[]>([]);
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
        customImageModels: [...DEFAULT_CONFIG.customImageModels],
        polishingCustomPrompts: [...DEFAULT_CONFIG.polishingCustomPrompts],
        polishPickerOrder: [...DEFAULT_CONFIG.polishPickerOrder]
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
            const imageFiles = files.filter((file) => isImageFileLike(file));
            if (imageFiles.length === 0) return false;

            const availableSlots = MAX_EDIT_IMAGES - editImageFiles.length;
            if (availableSlots <= 0) {
                addNotice(`最多只能添加 ${MAX_EDIT_IMAGES} 张编辑图片。`, 'warning');
                return false;
            }

            const filesToAdd = imageFiles.slice(0, availableSlots);
            if (filesToAdd.length < imageFiles.length) {
                addNotice(`仅还能添加 ${availableSlots} 张图片，已自动忽略多余文件。`, 'warning');
            }

            setEditImageFiles((prevFiles) => [...prevFiles, ...filesToAdd]);
            setEditSourceImagePreviewUrls((prevUrls) => [
                ...prevUrls,
                ...filesToAdd.map((file) => URL.createObjectURL(file))
            ]);
            return true;
        },
        [addNotice, editImageFiles.length]
    );

    const readDesktopClipboardImageFile = React.useCallback(async (): Promise<File | null> => {
        if (!isTauriDesktop()) return null;

        try {
            const clipboardImage = await readImage();
            const { width, height } = await clipboardImage.size();
            const rgba = await clipboardImage.rgba();
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d');
            if (!context) return null;

            const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
            context.putImageData(imageData, 0, 0);

            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((value) => resolve(value), 'image/png');
            });
            if (!blob) return null;

            return new File([blob], 'clipboard-image.png', { type: 'image/png' });
        } catch (error) {
            console.warn('Failed to read desktop clipboard image:', error);
            return null;
        }
    }, []);

    const resolveClipboardImageFileFromSource = React.useCallback(
        async (source: string, index: number): Promise<File | null> => {
            const trimmedSource = source.trim();
            if (!trimmedSource) return null;

            try {
                const parsedUrl = new URL(trimmedSource, window.location.href);
                const isRemoteHttp =
                    (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
                    parsedUrl.origin !== window.location.origin;

                if (isTauriDesktop() && isRemoteHttp) {
                    const image = await invokeDesktopCommand<DesktopRemoteImageResponse>(
                        'proxy_remote_image_with_type',
                        {
                            url: trimmedSource,
                            proxyConfig: desktopProxyConfig
                        }
                    );
                    const blob = new Blob([new Uint8Array(image.bytes)], {
                        type: image.contentType || 'image/png'
                    });
                    return new File([blob], `clipboard-image-${index + 1}.png`, {
                        type: image.contentType || blob.type || 'image/png'
                    });
                }
            } catch (error) {
                console.warn('Desktop clipboard image proxy failed:', error);
            }

            try {
                const fetchUrl = getFetchableImageUrl(trimmedSource, clientPasswordHash);

                if (!fetchUrl) return null;

                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    throw new Error(await getApiResponseErrorMessage(response, 'Failed to fetch image.'));
                }

                const blob = await response.blob();
                const contentType = response.headers.get('Content-Type') || blob.type || 'image/png';
                return new File([blob], `clipboard-image-${index + 1}.png`, { type: contentType });
            } catch (error) {
                console.warn('Failed to resolve clipboard image source:', error);
                return null;
            }
        },
        [clientPasswordHash, desktopProxyConfig]
    );

    const resolveClipboardImageFiles = React.useCallback(
        async (dataTransfer: DataTransfer): Promise<File[]> => {
            const directFiles = getClipboardImageFiles(dataTransfer);
            if (directFiles.length > 0) return directFiles;

            const imageSources = getClipboardImageSources(dataTransfer);
            if (imageSources.length > 0) {
                const resolvedFiles: File[] = [];
                for (const [index, source] of imageSources.entries()) {
                    const file = await resolveClipboardImageFileFromSource(source, index);
                    if (file) resolvedFiles.push(file);
                }
                if (resolvedFiles.length > 0) return resolvedFiles;
            }

            const desktopFile = await readDesktopClipboardImageFile();
            if (desktopFile) return [desktopFile];

            return [];
        },
        [readDesktopClipboardImageFile, resolveClipboardImageFileFromSource]
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

    const scheduleBlobUrlRevisionBump = React.useCallback(() => {
        if (blobUrlRevisionRafRef.current !== null) return;

        blobUrlRevisionRafRef.current = window.requestAnimationFrame(() => {
            blobUrlRevisionRafRef.current = null;
            bumpBlobUrlRevision();
        });
    }, []);

    React.useEffect(() => {
        return () => {
            if (blobUrlRevisionRafRef.current !== null) {
                window.cancelAnimationFrame(blobUrlRevisionRafRef.current);
            }
        };
    }, []);

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => {
            const cached = blobUrlCacheRef.current.get(filename);
            if (cached) return cached;
            if (failedBlobUrlLoadsRef.current.has(filename)) return undefined;

            if (!pendingBlobUrlLoadsRef.current.has(filename)) {
                pendingBlobUrlLoadsRef.current.add(filename);
                void db.images
                    .get(filename)
                    .then(async (record) => {
                        if (blobUrlCacheRef.current.has(filename)) return;

                        let blob = record?.blob;
                        if (!blob && isTauriDesktop()) {
                            const bytes = await invokeDesktopCommand<number[]>('serve_local_image', {
                                filename,
                                customStoragePath: appConfig.imageStoragePath || undefined
                            });
                            blob = new Blob([new Uint8Array(bytes)], {
                                type: getImageMimeTypeFromFilename(filename)
                            });
                        }

                        if (!blob) {
                            failedBlobUrlLoadsRef.current.add(filename);
                            return;
                        }
                        if (blobUrlCacheRef.current.has(filename)) return;
                        const url = URL.createObjectURL(blob);
                        blobUrlCacheRef.current.set(filename, url);
                        scheduleBlobUrlRevisionBump();
                    })
                    .catch((error) => {
                        failedBlobUrlLoadsRef.current.add(filename);
                        console.warn(`Failed to load local image ${filename}:`, error);
                    })
                    .finally(() => {
                        pendingBlobUrlLoadsRef.current.delete(filename);
                    });
            }

            return undefined;
        },
        [appConfig.imageStoragePath, scheduleBlobUrlRevisionBump]
    );

    const getHistoryImagePath = React.useCallback(
        (image: HistoryImage, storageMode: ImageStorageMode): string | undefined => {
            if (image.path) {
                if (isTauriDesktop() && !isBrowserAddressableImagePath(image.path)) {
                    return getImageSrc(image.filename);
                }

                return getDesktopDisplayImagePath(image.path);
            }

            if (storageMode === 'indexeddb') {
                return getImageSrc(image.filename);
            }

            if (isTauriDesktop()) {
                return getImageSrc(image.filename);
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
        const removedUrls = getRemovedBlobObjectUrls(editSourceImagePreviewUrlsRef.current, editSourceImagePreviewUrls);
        revokeBlobObjectUrls(removedUrls);
        editSourceImagePreviewUrlsRef.current = editSourceImagePreviewUrls;
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        return () => {
            revokeBlobObjectUrls(editSourceImagePreviewUrlsRef.current);
            editSourceImagePreviewUrlsRef.current = [];
        };
    }, []);

    React.useEffect(() => {
        failedBlobUrlLoadsRef.current.clear();
    }, [appConfig.imageStoragePath]);

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
        historyAutoSyncBaselineRef.current = stored.history;
        setHiddenExampleHistoryIds(new Set(loadHiddenExampleHistoryIds()));
        setHistory(stored.history);
        setIsInitialLoad(false);
    }, []);

    React.useEffect(() => {
        if (isInitialLoad) return;

        if (history.length > 0) {
            setShowExampleHistory(false);
            return;
        }

        if (
            !shouldShowExampleHistory({
                mode: exampleHistoryMode,
                historyLength: history.length,
                visibleExampleCount: visibleExampleHistory.length
            })
        ) {
            setShowExampleHistory(false);
            return;
        }

        let cancelled = false;
        let timeoutId: number | null = null;
        let idleId: number | null = null;
        const browserWindow = window as Window &
            typeof globalThis & {
                requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
                cancelIdleCallback?: (handle: number) => void;
            };

        const revealExamples = () => {
            const reveal = () => {
                if (cancelled) return;
                setShowExampleHistory(true);
            };

            if (typeof browserWindow.requestIdleCallback === 'function') {
                idleId = browserWindow.requestIdleCallback(reveal, { timeout: 1600 });
            } else {
                timeoutId = browserWindow.setTimeout(reveal, 450);
            }
        };

        if (document.readyState === 'complete') {
            revealExamples();
        } else {
            browserWindow.addEventListener('load', revealExamples, { once: true });
        }

        return () => {
            cancelled = true;
            browserWindow.removeEventListener('load', revealExamples);
            if (idleId !== null && typeof browserWindow.cancelIdleCallback === 'function') {
                browserWindow.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                browserWindow.clearTimeout(timeoutId);
            }
        };
    }, [history.length, isInitialLoad, visibleExampleHistory.length]);

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

    const flushImageHistoryForSync = React.useCallback((): boolean => {
        if (isInitialLoad || skipNextHistorySaveRef.current) return true;

        const saved = saveImageHistory(history);
        if (!saved) {
            const message = '生成历史保存失败：浏览器存储空间可能不足，或当前浏览器禁止本地存储。';
            setError(message);
            addNotice(message, 'error');
        }
        return saved;
    }, [addNotice, history, isInitialLoad]);

    const refreshImageHistoryFromStorage = React.useCallback(() => {
        const refreshed = loadImageHistory();
        skipNextHistoryAutoSyncRef.current = true;
        setHistory(refreshed.history);
        historyAutoSyncBaselineRef.current = refreshed.history;
        return refreshed.history;
    }, []);

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
            const clipboardData = event.clipboardData;
            if (!clipboardData) {
                return;
            }

            const imageFiles = getClipboardImageFiles(clipboardData);
            const imageSources = getClipboardImageSources(clipboardData);
            const text = getClipboardText(clipboardData);
            const hasText = text.trim().length > 0;
            const isEditPromptTarget = event.target instanceof HTMLElement && event.target.id === 'edit-prompt';
            const shouldRouteClipboardImagesToEdit = isEditPromptTarget || !isEditablePasteTarget(event.target);

            if (hasText && applyShareUrlTextRef.current(text).recognized) {
                event.preventDefault();
                return;
            }

            if (shouldRouteClipboardImagesToEdit && (imageFiles.length > 0 || imageSources.length > 0)) {
                event.preventDefault();
                void (async () => {
                    try {
                        const resolvedFiles = await resolveClipboardImageFiles(clipboardData);
                        if (resolvedFiles.length === 0) {
                            addNotice('无法读取剪贴板中的图片。', 'warning');
                            return;
                        }

                        if (addImageFilesToEdit(resolvedFiles)) {
                            scrollToEditForm();
                        }
                    } catch (error) {
                        console.warn('Failed to handle clipboard image paste:', error);
                        addNotice('无法读取剪贴板中的图片。', 'warning');
                    }
                })();
                return;
            }

            if (hasText && !isEditablePasteTarget(event.target)) {
                event.preventDefault();
                setEditPrompt(text);
                scrollToEditForm();
            }
        };

        const handleBeforeInput = (event: InputEvent) => {
            if (event.inputType !== 'insertFromPaste') return;
            const text = typeof event.data === 'string' ? event.data : '';
            if (!text.trim()) return;
            if (applyShareUrlTextRef.current(text).recognized) {
                event.preventDefault();
            }
        };

        window.addEventListener('paste', handlePaste, { capture: true });
        window.addEventListener('beforeinput', handleBeforeInput, { capture: true });

        return () => {
            window.removeEventListener('paste', handlePaste, { capture: true });
            window.removeEventListener('beforeinput', handleBeforeInput, { capture: true });
        };
    }, [addImageFilesToEdit, addNotice, resolveClipboardImageFiles, scrollToEditForm]);

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
            const submitSensenovaApiBaseUrl =
                provider === 'sensenova' ? providerConfig.apiBaseUrl : cfg.sensenovaApiBaseUrl;
            const submitSeedreamApiKey = provider === 'seedream' ? providerConfig.apiKey : cfg.seedreamApiKey;
            const submitSeedreamApiBaseUrl =
                provider === 'seedream' ? providerConfig.apiBaseUrl : cfg.seedreamApiBaseUrl;
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
            setPromoProfileId(parsed.promoProfileId ?? null);
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

    const promptForSharedSyncConfig = React.useCallback((syncConfigFromShare: SharedSyncConfig | undefined) => {
        if (!syncConfigFromShare) return;
        setPendingSharedSyncConfigChoice({ sharedSyncConfig: syncConfigFromShare });
    }, []);

    const applyUrlParams = React.useCallback(
        (parsed: ParsedUrlParams, consumed: ConsumedKeys, currentUrl: string) => {
            const storedConfig = loadConfig();
            if (hasMatchingStoredSharedConfig(parsed, storedConfig)) {
                applyResolvedUrlParams(parsed, consumed, currentUrl, {
                    suppressModelPreferenceSave: true
                });
                promptForSharedSyncConfig(parsed.syncConfig);
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
            promptForSharedSyncConfig(parsed.syncConfig);
        },
        [applyResolvedUrlParams, promptForSharedSyncConfig]
    );

    const applyShareUrlText = React.useCallback(
        (text: string): ShareTextApplyResult => {
            if (typeof window === 'undefined') return { recognized: false };

            const shareUrl = findShareUrlInText(text, window.location.href);
            if (!shareUrl) return { recognized: false };

            const encryptedPayload = getSecureSharePayload(shareUrl.search);
            if (encryptedPayload) {
                const { parsed: publicParsed, consumed: publicConsumed } = parseUrlParams(shareUrl.search);
                const autoUnlockPassword = getSecureSharePasswordFromHash(shareUrl.hash);
                if (publicParsed.promoProfileId?.trim()) setPromoProfileId(publicParsed.promoProfileId.trim());
                secureSharePublicParamsRef.current = publicParsed;
                secureShareUrlRef.current = window.location.href;
                secureShareConsumedRef.current = {
                    prompt: true,
                    promoProfileId: publicConsumed.promoProfileId,
                    apiKey: true,
                    baseUrl: true,
                    model: true,
                    providerInstanceId: true,
                    autostart: true,
                    syncConfig: true,
                    apiKeyTempOnly: true,
                    secureShare: true,
                    secureShareKey: Boolean(autoUnlockPassword),
                    shareSource: true
                };
                secureShareAutoPasswordRef.current = autoUnlockPassword ?? null;
                setIsAutoUnlockingSecureShare(Boolean(autoUnlockPassword));
                setSecureSharePayload(encryptedPayload);
                setSecureShareDismissed(false);
                setSecureShareError('');
                addNotice(
                    autoUnlockPassword ? '已识别加密分享链接，正在自动解密。' : '已识别加密分享链接，请输入解密密码。',
                    'info'
                );
                return { recognized: true, kind: 'secure' };
            }

            const { parsed, consumed } = parseUrlParams(shareUrl.search);
            applyUrlParams(parsed, consumed, window.location.href);
            addNotice('已识别分享链接并应用参数。', 'success');
            return {
                recognized: true,
                kind: 'plain',
                hasPrompt: parsed.prompt !== undefined
            };
        },
        [addNotice, applyUrlParams]
    );

    React.useEffect(() => {
        applyShareUrlTextRef.current = applyShareUrlText;
    }, [applyShareUrlText]);

    React.useEffect(() => {
        if (!isMobileTauriClient) return;

        if (!isLikelyShareTextCandidate(editPrompt)) {
            lastPromptShareRecognitionRef.current = null;
            return;
        }

        if (lastPromptShareRecognitionRef.current === editPrompt) return;

        const result = applyShareUrlTextRef.current(editPrompt);
        if (!result.recognized) return;

        lastPromptShareRecognitionRef.current = editPrompt;
        if (result.kind === 'secure' || !result.hasPrompt) {
            setEditPrompt('');
        }
    }, [editPrompt, isMobileTauriClient]);

    const handleUseSharedConfigTemporarily = React.useCallback(() => {
        if (!pendingSharedConfigChoice) return;
        const pending = pendingSharedConfigChoice;
        setPendingSharedConfigChoice(null);
        applyResolvedUrlParams(pending.parsed, pending.consumed, pending.currentUrl, {
            suppressModelPreferenceSave: true
        });
        promptForSharedSyncConfig(pending.parsed.syncConfig);
    }, [applyResolvedUrlParams, pendingSharedConfigChoice, promptForSharedSyncConfig]);

    const handleSaveSharedConfigLocally = React.useCallback(() => {
        if (!pendingSharedConfigChoice) return;
        const pending = pendingSharedConfigChoice;
        setPendingSharedConfigChoice(null);
        applyResolvedUrlParams(pending.parsed, pending.consumed, pending.currentUrl, {
            persistConfig: true
        });
        promptForSharedSyncConfig(pending.parsed.syncConfig);
    }, [applyResolvedUrlParams, pendingSharedConfigChoice, promptForSharedSyncConfig]);

    const handleIgnoreSharedConfig = React.useCallback(() => {
        if (!pendingSharedConfigChoice) return;
        const pending = pendingSharedConfigChoice;
        setPendingSharedConfigChoice(null);
        applyResolvedUrlParams(buildPromptOnlyUrlParams(pending.parsed), pending.consumed, pending.currentUrl, {
            suppressModelPreferenceSave: true
        });
        promptForSharedSyncConfig(pending.parsed.syncConfig);
    }, [applyResolvedUrlParams, pendingSharedConfigChoice, promptForSharedSyncConfig]);

    const handleSaveSharedSyncConfigOnly = React.useCallback(() => {
        if (!pendingSharedSyncConfigChoice) return;
        saveSyncConfig(pendingSharedSyncConfigChoice.sharedSyncConfig.config);
        setPendingSharedSyncConfigChoice(null);
        addNotice('云存储同步配置已保存。可以在历史面板右上角继续手动同步或恢复。', 'success');
    }, [addNotice, pendingSharedSyncConfigChoice]);

    const handleSaveSharedSyncConfigAndRestore = React.useCallback(() => {
        if (!pendingSharedSyncConfigChoice) return;
        const { sharedSyncConfig } = pendingSharedSyncConfigChoice;
        saveSyncConfig(sharedSyncConfig.config);
        setPendingSharedSyncConfigChoice(null);
        const runSharedRestore = runSharedSyncRestoreRef.current;
        if (runSharedRestore) {
            runSharedRestore(sharedSyncConfig.restoreOptions);
        } else {
            addNotice('云存储配置已保存。稍后可在历史面板右上角点击云同步恢复。', 'success');
        }
    }, [addNotice, pendingSharedSyncConfigChoice]);

    const handleIgnoreSharedSyncConfig = React.useCallback(() => {
        setPendingSharedSyncConfigChoice(null);
    }, []);

    React.useEffect(() => {
        if (!pendingSharedSyncConfigChoice?.sharedSyncConfig.restoreOptions.autoRestore) {
            sharedSyncAutoRestoreConsumedRef.current = false;
            return;
        }
        if (sharedSyncAutoRestoreConsumedRef.current) return;
        sharedSyncAutoRestoreConsumedRef.current = true;
        handleSaveSharedSyncConfigAndRestore();
    }, [handleSaveSharedSyncConfigAndRestore, pendingSharedSyncConfigChoice]);

    React.useEffect(() => {
        if (!formPreferencesLoaded || !serverRuntimeConfigLoaded || urlInitDoneRef.current) return;
        urlInitDoneRef.current = true;

        if (typeof window === 'undefined') return;
        try {
            const currentUrl = window.location.href;
            const encryptedPayload = getSecureSharePayload(window.location.search);
            if (encryptedPayload) {
                const { parsed: publicParsed, consumed: publicConsumed } = parseUrlParams(window.location.search);
                const autoUnlockPassword = getSecureSharePasswordFromHash(window.location.hash);
                if (publicParsed.promoProfileId?.trim()) setPromoProfileId(publicParsed.promoProfileId.trim());
                secureSharePublicParamsRef.current = publicParsed;
                secureShareUrlRef.current = currentUrl;
                secureShareConsumedRef.current = {
                    prompt: true,
                    promoProfileId: publicConsumed.promoProfileId,
                    apiKey: true,
                    baseUrl: true,
                    model: true,
                    providerInstanceId: true,
                    autostart: true,
                    syncConfig: true,
                    apiKeyTempOnly: true,
                    secureShare: true,
                    secureShareKey: Boolean(autoUnlockPassword),
                    shareSource: true
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
                let consumedForApply: ConsumedKeys = secureShareConsumedRef.current ?? {
                    prompt: false,
                    apiKey: false,
                    apiKeyTempOnly: false,
                    baseUrl: false,
                    model: false,
                    providerInstanceId: false,
                    autostart: false,
                    syncConfig: false,
                    secureShare: true
                };

                if (consumedForApply.secureShareKey) {
                    const keylessUrl = buildCleanedUrl(currentSecureShareUrl, {
                        prompt: false,
                        apiKey: false,
                        apiKeyTempOnly: false,
                        baseUrl: false,
                        model: false,
                        providerInstanceId: false,
                        autostart: false,
                        syncConfig: false,
                        secureShare: false,
                        secureShareKey: true
                    });
                    if (keylessUrl !== currentSecureShareUrl) window.history.replaceState(null, '', keylessUrl);
                    currentSecureShareUrl = keylessUrl;
                    consumedForApply = { ...consumedForApply, secureShareKey: false };
                    secureShareUrlRef.current = keylessUrl;
                    secureShareConsumedRef.current = consumedForApply;
                }

                const publicParsed = secureSharePublicParamsRef.current;
                const parsedForApply: ParsedUrlParams = { ...parsed };
                if (publicParsed?.promoProfileId && !parsedForApply.promoProfileId) {
                    parsedForApply.promoProfileId = publicParsed.promoProfileId;
                }

                applyUrlParams(parsedForApply, consumedForApply, currentSecureShareUrl);
                secureSharePublicParamsRef.current = null;
                setSecureSharePayload(null);
                setSecureShareDismissed(false);
            } catch (error) {
                const consumed = secureShareConsumedRef.current;
                if (consumed?.secureShareKey) {
                    const currentSecureShareUrl = secureShareUrlRef.current || window.location.href;
                    const cleanedUrl = buildCleanedUrl(currentSecureShareUrl, {
                        prompt: false,
                        apiKey: false,
                        apiKeyTempOnly: false,
                        baseUrl: false,
                        model: false,
                        providerInstanceId: false,
                        autostart: false,
                        syncConfig: false,
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
        setClearHistoryRemoteWithLocal(false);
        setIsClearHistoryDialogOpen(true);
    }, []);

    const handleDeleteExampleHistoryItem = React.useCallback((item: ExampleHistoryMetadata) => {
        setHiddenExampleHistoryIds((prev) => {
            const next = new Set(prev);
            next.add(item.timestamp);
            saveHiddenExampleHistoryIds(Array.from(next));
            return next;
        });
    }, []);

    const handleConfirmClearHistory = React.useCallback(async () => {
        setIsClearHistoryDialogOpen(false);
        setError(null);

        try {
            const filenamesToDelete = Array.from(
                new Set(history.flatMap((entry) => entry.images.map((image) => image.filename)))
            );
            const latestSyncConfig = loadSyncConfig();
            const shouldDeleteRemote = Boolean(
                clearHistoryRemoteWithLocal &&
                    isS3SyncConfigConfigured(latestSyncConfig?.s3) &&
                    latestSyncConfig?.s3.allowRemoteDeletion
            );

            if (effectiveStorageModeClient === 'indexeddb') {
                await db.images.clear();
                blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                blobUrlCacheRef.current.clear();
                failedBlobUrlLoadsRef.current.clear();
                scheduleBlobUrlRevisionBump();
            }

            const localStorageCleared = clearImageHistoryLocalStorage();
            if (!localStorageCleared) {
                throw new Error('无法清除浏览器中的生成历史记录。');
            }

            skipNextHistorySaveRef.current = true;
            setHistory([]);
            setClearHistoryRemoteWithLocal(false);
            if (shouldDeleteRemote && filenamesToDelete.length > 0) {
                void deleteRemoteHistoryImagesRef.current(filenamesToDelete, []);
            }
        } catch (e) {
            console.error('Failed during history clearing:', e);
            setError(`Failed to clear history: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [clearHistoryRemoteWithLocal, history, scheduleBlobUrlRevisionBump]);

    const handleSendToEdit = React.useCallback(
        async (filename: string) => {
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
                const record = await db.images.get(filename);

                if (record?.blob) {
                    blob = record.blob;
                    mimeType = blob.type || mimeType;
                } else if (cachedUrl) {
                    const proxyUrl = getFetchableImageUrl(cachedUrl, clientPasswordHash);
                    if (isTauriDesktop()) {
                        try {
                            const extUrl = new URL(cachedUrl, window.location.href);
                            if (
                                (extUrl.protocol === 'http:' || extUrl.protocol === 'https:') &&
                                extUrl.origin !== window.location.origin
                            ) {
                                const image = await invokeDesktopCommand<DesktopRemoteImageResponse>(
                                    'proxy_remote_image_with_type',
                                    {
                                        url: cachedUrl,
                                        proxyConfig: desktopProxyConfig
                                    }
                                );
                                blob = new Blob([new Uint8Array(image.bytes)], { type: image.contentType });
                                mimeType = blob.type || mimeType;
                            } else if (proxyUrl) {
                                const response = await fetch(proxyUrl);
                                if (!response.ok)
                                    throw new Error(
                                        await getApiResponseErrorMessage(response, 'Failed to fetch image.')
                                    );
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
                        try {
                            const bytes = await invokeDesktopCommand<number[]>('serve_local_image', {
                                filename,
                                customStoragePath: appConfig.imageStoragePath || undefined
                            });
                            blob = new Blob([new Uint8Array(bytes)], {
                                type: getImageMimeTypeFromFilename(filename)
                            });
                            mimeType = blob.type || mimeType;
                        } catch (localError) {
                            console.warn('Desktop local history image read failed while sending to edit:', localError);
                            const response = await fetch(convertFileSrc(historyImage.path));
                            if (!response.ok) {
                                throw new Error(
                                    await getApiResponseErrorMessage(response, 'Failed to fetch local desktop image.')
                                );
                            }
                            blob = await response.blob();
                            mimeType = response.headers.get('Content-Type') || blob.type || mimeType;
                        }
                    } else {
                        const proxyUrl = getFetchableImageUrl(historyImage.path, clientPasswordHash);
                        if (isTauriDesktop()) {
                            try {
                                const extUrl = new URL(historyImage.path, window.location.href);
                                if (
                                    (extUrl.protocol === 'http:' || extUrl.protocol === 'https:') &&
                                    extUrl.origin !== window.location.origin
                                ) {
                                    const image = await invokeDesktopCommand<DesktopRemoteImageResponse>(
                                        'proxy_remote_image_with_type',
                                        {
                                            url: historyImage.path,
                                            proxyConfig: desktopProxyConfig
                                        }
                                    );
                                    blob = new Blob([new Uint8Array(image.bytes)], { type: image.contentType });
                                    mimeType = blob.type || mimeType;
                                } else if (proxyUrl) {
                                    const response = await fetch(proxyUrl);
                                    if (!response.ok)
                                        throw new Error(
                                            await getApiResponseErrorMessage(response, 'Failed to fetch image.')
                                        );
                                    blob = await response.blob();
                                    mimeType = response.headers.get('Content-Type') || blob.type || mimeType;
                                }
                            } catch (proxyError) {
                                console.warn(
                                    'Desktop remote history image proxy failed while sending to edit:',
                                    proxyError
                                );
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

                setEditImageFiles([newFile]);
                setEditSourceImagePreviewUrls([newPreviewUrl]);
            } catch (err: unknown) {
                console.error('Error sending image to edit:', err);
                const errorMessage = err instanceof Error ? err.message : '无法发送图片到编辑模式。';
                setError(errorMessage);
            }
        },
        [
            appConfig.imageStoragePath,
            clientPasswordHash,
            desktopProxyConfig,
            editImageFiles,
            history
        ]
    );

    const executeDeleteItem = React.useCallback(
        async (item: HistoryMetadata, options?: { deleteRemote?: boolean }) => {
            if (!item) return;
            setError(null);

            const { images: imagesInEntry, storageModeUsed, timestamp } = item;
            const filenamesToDelete = imagesInEntry.map((img) => img.filename);
            const nextHistory = history.filter((h) => h.timestamp !== timestamp);

            try {
                if (storageModeUsed === 'indexeddb') {
                    await db.images.where('filename').anyOf(filenamesToDelete).delete();
                    filenamesToDelete.forEach((fn) => {
                        const url = blobUrlCacheRef.current.get(fn);
                        if (url) URL.revokeObjectURL(url);
                        blobUrlCacheRef.current.delete(fn);
                        failedBlobUrlLoadsRef.current.delete(fn);
                    });
                } else if (storageModeUsed === 'fs') {
                    if (isTauriDesktop()) {
                        const results = await invokeDesktopCommand<
                            Array<{ filename: string; success: boolean; error?: string }>
                        >('delete_local_images', {
                            filenames: filenamesToDelete,
                            customStoragePath: appConfig.imageStoragePath || undefined
                        });
                        const failed = results.filter((r) => !r.success);
                        if (failed.length > 0 && failed.length === results.length) {
                            throw new Error(
                                failed
                                    .map((r) => r.error)
                                    .filter(Boolean)
                                    .join('; ')
                            );
                        }
                        if (failed.length > 0) {
                            addNotice(`历史条目已移除，但 ${failed.length} 个本地文件删除失败。`, 'warning');
                            setError(
                                failed
                                    .slice(0, 3)
                                    .map((r) => `${r.filename}: ${r.error || '删除失败'}`)
                                    .join('\n')
                            );
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

                setHistory(nextHistory);
                if (options?.deleteRemote) {
                    void deleteRemoteHistoryImagesRef.current(filenamesToDelete, nextHistory);
                }
            } catch (e: unknown) {
                console.error('Error during item deletion:', e);
                const message = e instanceof Error ? e.message : 'An unexpected error occurred during deletion.';
                setError(message);
                addNotice(message, 'error');
            } finally {
                setItemToDeleteConfirm(null);
                setDeleteRemoteWithLocal(false);
            }
        },
        [addNotice, appConfig.imageStoragePath, isPasswordRequiredByBackend, clientPasswordHash, history]
    );

    const handleRequestDeleteItem = React.useCallback(
        (item: HistoryMetadata) => {
            const latestConfig = loadSyncConfig();
            const shouldOfferRemoteDelete =
                isS3SyncConfigConfigured(latestConfig?.s3) && Boolean(latestConfig?.s3.allowRemoteDeletion);
            if (!skipDeleteConfirmation || shouldOfferRemoteDelete) {
                setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
                setDeleteRemoteWithLocal(false);
                setItemToDeleteConfirm(item);
            } else {
                executeDeleteItem(item, { deleteRemote: false });
            }
        },
        [skipDeleteConfirmation, executeDeleteItem]
    );

    const handleConfirmDeletion = React.useCallback(() => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm, { deleteRemote: deleteRemoteWithLocal });
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    }, [itemToDeleteConfirm, executeDeleteItem, deleteRemoteWithLocal, dialogCheckboxStateSkipConfirm]);

    const handleCancelDeletion = React.useCallback(() => {
        setItemToDeleteConfirm(null);
        setDeleteRemoteWithLocal(false);
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
            const { filename } = image;

            if (image.path) {
                if (isTauriDesktop() && !isBrowserAddressableImagePath(image.path)) {
                    try {
                        const bytes = await invokeDesktopCommand<number[]>('serve_local_image', {
                            filename,
                            customStoragePath: appConfig.imageStoragePath || undefined
                        });
                        return new Blob([new Uint8Array(bytes)], {
                            type: getImageMimeTypeFromFilename(filename)
                        });
                    } catch (localError) {
                        console.warn(
                            'Desktop local history image read failed, falling back to asset fetch:',
                            localError
                        );
                        const response = await fetch(convertFileSrc(image.path));
                        if (!response.ok) {
                            throw new Error(
                                await getApiResponseErrorMessage(response, `图片下载失败：${image.filename}`)
                            );
                        }
                        return response.blob();
                    }
                }

                if (isTauriDesktop()) {
                    try {
                        const extUrl = new URL(image.path, window.location.href);
                        if (
                            (extUrl.protocol === 'http:' || extUrl.protocol === 'https:') &&
                            extUrl.origin !== window.location.origin
                        ) {
                            const proxiedImage = await invokeDesktopCommand<DesktopRemoteImageResponse>(
                                'proxy_remote_image_with_type',
                                {
                                    url: image.path,
                                    proxyConfig: desktopProxyConfig
                                }
                            );
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

            if (storageMode === 'indexeddb') {
                const cachedUrl = blobUrlCacheRef.current.get(filename);
                if (cachedUrl) {
                    const response = await fetch(cachedUrl);
                    if (!response.ok) {
                        throw new Error(await getApiResponseErrorMessage(response, `无法读取图片缓存：${filename}`));
                    }

                    return response.blob();
                }

                const record = await db.images.get(filename);
                if (record?.blob) {
                    return record.blob;
                }

                throw new Error(`图片不存在：${filename}`);
            }

            if (isTauriDesktop()) {
                try {
                    const bytes = await invokeDesktopCommand<number[]>('serve_local_image', {
                        filename,
                        customStoragePath: appConfig.imageStoragePath || undefined
                    });
                    return new Blob([new Uint8Array(bytes)], {
                        type: getImageMimeTypeFromFilename(filename)
                    });
                } catch (localError) {
                    console.warn(
                        'Desktop local history image read failed, falling back to API image route:',
                        localError
                    );
                }
            }

            const response = await fetch(`/api/image/${filename}`);
            if (!response.ok) {
                throw new Error(await getApiResponseErrorMessage(response, `图片下载失败：${filename}`));
            }
            return response.blob();
        },

        [appConfig.imageStoragePath, clientPasswordHash, desktopProxyConfig]
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

    const executeBatchDelete = React.useCallback(
        async (options?: { deleteRemote?: boolean }) => {
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
                        failedBlobUrlLoadsRef.current.delete(fn);
                    });
                }

                if (fsFilenames.length > 0) {
                    if (isTauriDesktop()) {
                        const results = await invokeDesktopCommand<
                            Array<{ filename: string; success: boolean; error?: string }>
                        >('delete_local_images', {
                            filenames: fsFilenames,
                            customStoragePath: appConfig.imageStoragePath || undefined
                        });
                        const failed = results.filter((r) => !r.success);
                        if (failed.length > 0 && failed.length === results.length) {
                            throw new Error(
                                failed
                                    .map((r) => r.error)
                                    .filter(Boolean)
                                    .join('; ')
                            );
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

                const nextHistory = history.filter((h) => !timestampsToDelete.has(h.timestamp));
                setHistory(nextHistory);
                setSelectedIds(new Set());
                setSelectionMode(false);
                if (options?.deleteRemote) {
                    void deleteRemoteHistoryImagesRef.current([...indexedDbFilenames, ...fsFilenames], nextHistory);
                }
                if (partialDeleteFailures.length > 0) {
                    addNotice(
                        `已删除 ${itemsToDelete.length} 个历史条目，${partialDeleteFailures.length} 个本地文件删除失败。`,
                        'warning'
                    );
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
        },
        [addNotice, appConfig.imageStoragePath, selectedIds, history, isPasswordRequiredByBackend, clientPasswordHash]
    );

    const handleDeleteSelected = React.useCallback(() => {
        if (selectedIds.size === 0) return;
        const latestConfig = loadSyncConfig();
        const shouldOfferRemoteDelete =
            isS3SyncConfigConfigured(latestConfig?.s3) && Boolean(latestConfig?.s3.allowRemoteDeletion);
        if (skipDeleteConfirmation && !shouldOfferRemoteDelete) {
            void executeBatchDelete({ deleteRemote: false });
            return;
        }
        setBatchDeleteRemoteWithLocal(false);
        setPendingBatchDelete(selectedIds.size);
    }, [selectedIds.size, skipDeleteConfirmation, executeBatchDelete]);

    const confirmBatchDelete = React.useCallback(() => {
        setPendingBatchDelete(0);
        void executeBatchDelete({ deleteRemote: batchDeleteRemoteWithLocal });
    }, [executeBatchDelete, batchDeleteRemoteWithLocal]);

    // --- S3 Snapshot Sync ---
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatusDetails | null>(null);
    const [syncConfig, setSyncConfig] = React.useState<SyncProviderConfig | null>(null);
    const [pendingImageSyncConfirmation, setPendingImageSyncConfirmation] =
        React.useState<PendingImageSyncConfirmation | null>(null);
    const hasConfiguredNetworkSync = isS3SyncConfigConfigured(syncConfig?.s3);
    const showRemoteDeleteOption = hasConfiguredNetworkSync && Boolean(syncConfig?.s3.allowRemoteDeletion);
    const hasActiveImageTasks = React.useMemo(
        () =>
            tasks.some((task) => task.status === 'queued' || task.status === 'running' || task.status === 'streaming'),
        [tasks]
    );
    const hasForegroundLongRunningWork = isSyncing || hasActiveImageTasks;
    const wakeLock = useScreenWakeLock(hasForegroundLongRunningWork);

    React.useEffect(() => {
        if (!hasForegroundLongRunningWork) {
            wakeLockNoticeShownRef.current = false;
            backgroundWorkNoticeShownRef.current = false;
            return;
        }

        if (wakeLockNoticeShownRef.current) return;
        if (!wakeLock.supported || wakeLock.error) {
            wakeLockNoticeShownRef.current = true;
            addNotice(
                '当前浏览器无法保持屏幕唤醒。同步或生成图片时请保持页面前台运行，锁屏/切后台可能会暂停请求。',
                'warning'
            );
        }
    }, [addNotice, hasForegroundLongRunningWork, wakeLock.error, wakeLock.supported]);

    React.useEffect(() => {
        if (!hasForegroundLongRunningWork) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'hidden' || backgroundWorkNoticeShownRef.current) return;
            backgroundWorkNoticeShownRef.current = true;
            addNotice('页面进入后台后，移动浏览器可能暂停同步或图片生成请求。', 'warning');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [addNotice, hasForegroundLongRunningWork]);

    const getSyncContext = React.useCallback(
        (config: SyncProviderConfig, startedAt: number): Partial<SyncResult> => ({
            bucket: config.s3.bucket,
            basePrefix: buildBasePrefix(config.s3.profileId, config.s3.prefix),
            startedAt
        }),
        []
    );

    const updateSyncStatus = React.useCallback(
        (
            operationLabel: string,
            result?: Partial<SyncResult>,
            options?: Parameters<typeof createSyncStatusDetails>[2]
        ) => {
            setSyncStatus(createSyncStatusDetails(operationLabel, result, options));
        },
        []
    );

    const addSyncWarnings = React.useCallback(
        (warnings: string[] | undefined) => {
            for (const warning of warnings ?? []) {
                addNotice(warning, 'warning');
            }
        },
        [addNotice]
    );

    React.useEffect(() => {
        const refreshSyncConfig = () => setSyncConfig(loadSyncConfig());
        refreshSyncConfig();
        window.addEventListener(SYNC_CONFIG_CHANGED_EVENT, refreshSyncConfig);
        window.addEventListener('storage', refreshSyncConfig);
        return () => {
            window.removeEventListener(SYNC_CONFIG_CHANGED_EVENT, refreshSyncConfig);
            window.removeEventListener('storage', refreshSyncConfig);
        };
    }, []);

    const requireSyncConfig = React.useCallback((): SyncProviderConfig | null => {
        const config = loadSyncConfig();
        setSyncConfig(config);
        if (!isS3SyncConfigConfigured(config?.s3)) {
            const message = '请先在系统设置中配置 S3 兼容对象存储。';
            setError(message);
            addNotice(message, 'warning');
            return null;
        }
        return config;
    }, [addNotice]);

    const performAutoSync = React.useCallback(async () => {
        if (autoSyncInFlightRef.current) return;
        const pending = autoSyncPendingRef.current;
        if (!pending || !hasAnyAutoSyncScope(pending.scopes)) return;

        const config = loadSyncConfig();
        setSyncConfig(config);
        if (!config?.autoSync.enabled || !isS3SyncConfigConfigured(config.s3)) {
            autoSyncPendingRef.current = null;
            return;
        }

        const scopes = intersectAutoSyncScopes(pending.scopes, config.autoSync.scopes);
        if (!hasAnyAutoSyncScope(scopes)) {
            autoSyncPendingRef.current = null;
            return;
        }

        autoSyncPendingRef.current = null;
        autoSyncInFlightRef.current = true;
        const startedAt = Date.now();
        const shouldUploadImages = scopes.imageBlobs && pending.since !== undefined;
        const mode = shouldUploadImages ? 'full' : 'metadata';
        const scopeLabel = shouldUploadImages ? formatImageSyncScopeLabel(pending.since) : '配置和记录';
        const context = getSyncContext(config, startedAt);

        setIsSyncing(true);
        updateSyncStatus(
            `自动同步${scopeLabel}…`,
            { ...context, operation: 'upload', mode, phase: 'snapshot' },
            { operation: shouldUploadImages ? 'upload-images' : 'upload-metadata', inProgress: true, done: false }
        );

        try {
            const result = await uploadSnapshot({
                config,
                appConfig: loadConfig(),
                mode,
                since: shouldUploadImages ? pending.since : undefined,
                syncScopes: scopes,
                onProgress: (r) => {
                    const operation = shouldUploadImages ? 'upload-images' : 'upload-metadata';
                    const progressResult = { ...context, ...r };
                    if (r.phase === 'upload-images' && shouldUploadImages) {
                        updateSyncStatus(
                            r.totalImages > 0
                                ? `自动上传${scopeLabel} ${r.completedImages}/${r.totalImages}`
                                : `自动同步${scopeLabel}清单…`,
                            progressResult,
                            { operation, inProgress: true, done: false }
                        );
                    } else if (r.phase === 'upload-manifest') {
                        updateSyncStatus(`自动上传${scopeLabel}清单…`, progressResult, {
                            operation,
                            inProgress: true,
                            done: false
                        });
                    } else {
                        updateSyncStatus(`自动同步${scopeLabel}…`, progressResult, {
                            operation,
                            inProgress: true,
                            done: false
                        });
                    }
                }
            });

            if (result.ok) {
                updateSyncStatus(
                    `自动同步${scopeLabel}完成`,
                    { ...context, ...result },
                    {
                        operation: shouldUploadImages ? 'upload-images' : 'upload-metadata',
                        inProgress: false,
                        done: true,
                        success: true
                    }
                );
                addSyncWarnings(result.warnings);
                if (shouldUploadImages) {
                    refreshImageHistoryFromStorage();
                }
            } else {
                const message = result.error || '自动同步失败。';
                updateSyncStatus(
                    `自动同步${scopeLabel}失败`,
                    { ...context, ...result, error: message },
                    {
                        operation: shouldUploadImages ? 'upload-images' : 'upload-metadata',
                        inProgress: false,
                        done: true,
                        success: false
                    }
                );
                addNotice(message, 'error');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : '自动同步失败。';
            updateSyncStatus(
                `自动同步${scopeLabel}失败`,
                {
                    ...context,
                    operation: 'upload',
                    mode,
                    phase: 'snapshot',
                    completedAt: Date.now(),
                    error: message
                },
                {
                    operation: shouldUploadImages ? 'upload-images' : 'upload-metadata',
                    inProgress: false,
                    done: true,
                    success: false
                }
            );
            addNotice(message, 'error');
        } finally {
            autoSyncInFlightRef.current = false;
            setIsSyncing(false);
            const queuedAutoSync = autoSyncPendingRef.current as AutoSyncPendingState | null;
            if (queuedAutoSync && hasAnyAutoSyncScope(queuedAutoSync.scopes)) {
                const latestConfig = loadSyncConfig();
                const delay = latestConfig?.autoSync.debounceMs ?? 3000;
                autoSyncTimerRef.current = window.setTimeout(() => {
                    autoSyncTimerRef.current = null;
                    void performAutoSync();
                }, delay);
            }
        }
    }, [addNotice, addSyncWarnings, getSyncContext, refreshImageHistoryFromStorage, updateSyncStatus]);

    const scheduleAutoSync = React.useCallback(
        (requestedScopes: Partial<SyncAutoSyncScopes>, options?: { since?: number }) => {
            if (autoSyncSuppressedRef.current) return;

            const config = loadSyncConfig();
            setSyncConfig(config);
            if (!config?.autoSync.enabled || !isS3SyncConfigConfigured(config.s3)) return;

            const scopes = intersectAutoSyncScopes(requestedScopes, config.autoSync.scopes);
            if (!hasAnyAutoSyncScope(scopes)) return;

            const current = autoSyncPendingRef.current ?? { scopes: createEmptyAutoSyncScopes() };
            const nextSince =
                options?.since === undefined
                    ? current.since
                    : current.since === undefined
                      ? options.since
                      : Math.min(current.since, options.since);
            autoSyncPendingRef.current = {
                scopes: mergeAutoSyncScopes(current.scopes, scopes),
                since: nextSince
            };

            if (autoSyncTimerRef.current !== null) {
                window.clearTimeout(autoSyncTimerRef.current);
            }
            autoSyncTimerRef.current = window.setTimeout(() => {
                autoSyncTimerRef.current = null;
                void performAutoSync();
            }, config.autoSync.debounceMs);
        },
        [performAutoSync]
    );

    React.useEffect(() => {
        return () => {
            if (autoSyncTimerRef.current !== null) {
                window.clearTimeout(autoSyncTimerRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        const handleConfigAutoSync = (event: Event) => {
            const changedKeys = (event as CustomEvent<{ changedKeys?: string[] }>).detail?.changedKeys ?? [];
            if (changedKeys.length === 0) return;

            const hasPolishingChange = changedKeys.some((key) =>
                POLISHING_PROMPT_CONFIG_KEYS.has(key as keyof AppConfig)
            );
            const hasAppConfigChange = changedKeys.some(
                (key) => !POLISHING_PROMPT_CONFIG_KEYS.has(key as keyof AppConfig)
            );
            scheduleAutoSync({
                appConfig: hasAppConfigChange,
                polishingPrompts: hasPolishingChange
            });
        };
        const handlePromptHistoryAutoSync = () => scheduleAutoSync({ promptHistory: true });
        const handlePromptTemplatesAutoSync = () => scheduleAutoSync({ promptTemplates: true });

        window.addEventListener(CONFIG_CHANGED_EVENT, handleConfigAutoSync);
        window.addEventListener(PROMPT_HISTORY_CHANGED_EVENT, handlePromptHistoryAutoSync);
        window.addEventListener(USER_PROMPT_TEMPLATES_CHANGED_EVENT, handlePromptTemplatesAutoSync);
        return () => {
            window.removeEventListener(CONFIG_CHANGED_EVENT, handleConfigAutoSync);
            window.removeEventListener(PROMPT_HISTORY_CHANGED_EVENT, handlePromptHistoryAutoSync);
            window.removeEventListener(USER_PROMPT_TEMPLATES_CHANGED_EVENT, handlePromptTemplatesAutoSync);
        };
    }, [scheduleAutoSync]);

    React.useEffect(() => {
        if (isInitialLoad) return;

        const previousHistory = historyAutoSyncBaselineRef.current;
        if (!previousHistory) {
            historyAutoSyncBaselineRef.current = history;
            return;
        }
        if (skipNextHistoryAutoSyncRef.current) {
            skipNextHistoryAutoSyncRef.current = false;
            historyAutoSyncBaselineRef.current = history;
            return;
        }

        const previousTimestamps = collectHistoryImageTimestamps(previousHistory);
        const currentTimestamps = collectHistoryImageTimestamps(history);
        const changedTimestamps: number[] = [];

        for (const [filename, timestamp] of currentTimestamps) {
            if (previousTimestamps.get(filename) !== timestamp) {
                changedTimestamps.push(timestamp);
            }
        }

        historyAutoSyncBaselineRef.current = history;
        if (changedTimestamps.length === 0) return;

        scheduleAutoSync(
            { imageHistory: true, imageBlobs: true },
            { since: Math.max(0, Math.min(...changedTimestamps) - 1000) }
        );
    }, [history, isInitialLoad, scheduleAutoSync]);

    const deleteRemoteHistoryImages = React.useCallback(
        async (filenames: string[], nextHistory: HistoryMetadata[]): Promise<boolean> => {
            const config = requireSyncConfig();
            if (!config) return false;
            if (!config.s3.allowRemoteDeletion) {
                const message =
                    '远端删除同步未开启。已保留云存储中的图片；如需同步删除，请先在云存储同步设置中开启远端删除。';
                addNotice(message, 'warning');
                return false;
            }

            const startedAt = Date.now();
            const context = getSyncContext(config, startedAt);
            setIsSyncing(true);
            updateSyncStatus(
                '正在删除远端图片…',
                { ...context, operation: 'upload', mode: 'metadata', phase: 'upload-images' },
                { operation: 'upload-images', inProgress: true, done: false }
            );

            try {
                const result = await deleteRemoteImages({
                    config,
                    filenames,
                    imageHistory: nextHistory,
                    onProgress: (r) => {
                        updateSyncStatus(
                            r.phase === 'upload-manifest'
                                ? '正在更新远端删除清单…'
                                : `正在删除远端图片 ${r.completedImages}/${r.totalImages}`,
                            { ...context, ...r },
                            { operation: 'upload-images', inProgress: true, done: false }
                        );
                    }
                });

                if (result.ok) {
                    updateSyncStatus(
                        '远端图片删除完成',
                        { ...context, ...result },
                        { operation: 'upload-images', inProgress: false, done: true, success: true }
                    );
                    addNotice(`已同步删除 ${result.completedImages} 个远端图片对象。`, 'success');
                    return true;
                }

                const message = result.error || '远端图片删除失败。';
                updateSyncStatus(
                    '远端图片删除失败',
                    { ...context, ...result, error: message },
                    { operation: 'upload-images', inProgress: false, done: true, success: false }
                );
                addNotice(`本地已删除，远端删除失败：${message}`, 'warning');
                return false;
            } catch (error) {
                const message = error instanceof Error ? error.message : '远端图片删除失败。';
                updateSyncStatus(
                    '远端图片删除失败',
                    {
                        ...context,
                        operation: 'upload',
                        mode: 'metadata',
                        phase: 'upload-images',
                        completedAt: Date.now(),
                        error: message
                    },
                    { operation: 'upload-images', inProgress: false, done: true, success: false }
                );
                addNotice(`本地已删除，远端删除失败：${message}`, 'warning');
                return false;
            } finally {
                setIsSyncing(false);
            }
        },
        [addNotice, getSyncContext, requireSyncConfig, updateSyncStatus]
    );

    React.useEffect(() => {
        deleteRemoteHistoryImagesRef.current = deleteRemoteHistoryImages;
    }, [deleteRemoteHistoryImages]);

    const handleSyncUploadMetadata = React.useCallback(async () => {
        setIsSyncing(true);
        const startedAt = Date.now();
        updateSyncStatus(
            '正在打包配置和记录…',
            { operation: 'upload', mode: 'metadata', phase: 'snapshot', startedAt },
            { operation: 'upload-metadata', inProgress: true, done: false }
        );
        setError(null);

        try {
            const config = requireSyncConfig();
            if (!config) {
                setSyncStatus(null);
                return;
            }
            if (!flushImageHistoryForSync()) {
                return;
            }
            const context = getSyncContext(config, startedAt);
            updateSyncStatus(
                '正在打包配置和记录…',
                { ...context, operation: 'upload', mode: 'metadata', phase: 'snapshot' },
                { operation: 'upload-metadata', inProgress: true, done: false }
            );

            const result = await uploadSnapshot({
                config,
                appConfig: loadConfig(),
                mode: 'metadata',
                onProgress: (r) => {
                    const progressResult = { ...context, ...r };
                    if (r.phase === 'upload-images') {
                        updateSyncStatus('准备配置和记录清单…', progressResult, {
                            operation: 'upload-metadata',
                            inProgress: true,
                            done: false
                        });
                    } else if (r.phase === 'upload-manifest') {
                        updateSyncStatus('上传配置和记录清单…', progressResult, {
                            operation: 'upload-metadata',
                            inProgress: true,
                            done: false
                        });
                    } else {
                        updateSyncStatus('正在打包配置和记录…', progressResult, {
                            operation: 'upload-metadata',
                            inProgress: true,
                            done: false
                        });
                    }
                }
            });

            if (result.ok) {
                updateSyncStatus(
                    '配置和记录同步完成',
                    { ...context, ...result },
                    { operation: 'upload-metadata', inProgress: false, done: true, success: true }
                );
                addNotice(`配置和记录已同步到 S3：${result.manifestKey || context.basePrefix}`, 'success');
                addSyncWarnings(result.warnings);
            } else {
                const msg = result.error || '上传快照时发生未知错误。';
                updateSyncStatus(
                    '配置和记录同步失败',
                    { ...context, ...result, error: msg },
                    { operation: 'upload-metadata', inProgress: false, done: true, success: false }
                );
                setError(msg);
                addNotice(msg, 'error');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'S3 上传失败。';
            updateSyncStatus(
                '配置和记录同步失败',
                {
                    operation: 'upload',
                    mode: 'metadata',
                    phase: 'snapshot',
                    startedAt,
                    completedAt: Date.now(),
                    error: message
                },
                { operation: 'upload-metadata', inProgress: false, done: true, success: false }
            );
            setError(message);
            addNotice(message, 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [addNotice, addSyncWarnings, flushImageHistoryForSync, getSyncContext, requireSyncConfig, updateSyncStatus]);

    const executeSyncUploadImages = React.useCallback(
        async (options: ImageSyncActionOptions = {}) => {
            const scopeLabel = formatImageSyncScopeLabel(options.since);
            const actionLabel = options.force ? `强制同步${scopeLabel}` : `同步${scopeLabel}`;
            setIsSyncing(true);
            const startedAt = Date.now();
            updateSyncStatus(
                `正在打包${scopeLabel}…`,
                { operation: 'upload', mode: 'full', phase: 'snapshot', startedAt },
                { operation: 'upload-images', inProgress: true, done: false }
            );
            setError(null);

            try {
                const config = requireSyncConfig();
                if (!config) {
                    setSyncStatus(null);
                    return;
                }
                if (!flushImageHistoryForSync()) {
                    return;
                }
                const context = getSyncContext(config, startedAt);
                updateSyncStatus(
                    `正在打包${scopeLabel}…`,
                    { ...context, operation: 'upload', mode: 'full', phase: 'snapshot' },
                    { operation: 'upload-images', inProgress: true, done: false }
                );

                const result = await uploadSnapshot({
                    config,
                    appConfig: loadConfig(),
                    mode: 'full',
                    force: options.force,
                    since: options.since,
                    onProgress: (r) => {
                        const progressResult = { ...context, ...r };
                        if (r.phase === 'upload-images') {
                            if (r.totalImages === 0) {
                                updateSyncStatus(`无${scopeLabel}需要上传`, progressResult, {
                                    operation: 'upload-images',
                                    inProgress: true,
                                    done: false
                                });
                            } else {
                                updateSyncStatus(
                                    `上传${scopeLabel} ${r.completedImages}/${r.totalImages}`,
                                    progressResult,
                                    { operation: 'upload-images', inProgress: true, done: false }
                                );
                            }
                        } else if (r.phase === 'upload-manifest') {
                            updateSyncStatus(`上传${scopeLabel}清单…`, progressResult, {
                                operation: 'upload-images',
                                inProgress: true,
                                done: false
                            });
                        } else {
                            updateSyncStatus(`正在打包${scopeLabel}…`, progressResult, {
                                operation: 'upload-images',
                                inProgress: true,
                                done: false
                            });
                        }
                    }
                });

                if (result.ok) {
                    updateSyncStatus(
                        `${actionLabel}完成`,
                        { ...context, ...result },
                        { operation: 'upload-images', inProgress: false, done: true, success: true }
                    );
                    const skippedText = result.skippedImages ? `，跳过 ${result.skippedImages} 张已存在图片` : '';
                    addNotice(
                        `${actionLabel}完成${skippedText}：${result.manifestKey || context.basePrefix}`,
                        'success'
                    );
                    addSyncWarnings(result.warnings);
                    refreshImageHistoryFromStorage();
                } else {
                    const msg = result.error || '上传快照时发生未知错误。';
                    updateSyncStatus(
                        `${actionLabel}失败`,
                        { ...context, ...result, error: msg },
                        { operation: 'upload-images', inProgress: false, done: true, success: false }
                    );
                    setError(msg);
                    addNotice(msg, 'error');
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'S3 上传失败。';
                updateSyncStatus(
                    `${actionLabel}失败`,
                    {
                        operation: 'upload',
                        mode: 'full',
                        phase: 'snapshot',
                        startedAt,
                        completedAt: Date.now(),
                        error: message
                    },
                    { operation: 'upload-images', inProgress: false, done: true, success: false }
                );
                setError(message);
                addNotice(message, 'error');
            } finally {
                setIsSyncing(false);
            }
        },
        [
            addNotice,
            addSyncWarnings,
            flushImageHistoryForSync,
            getSyncContext,
            refreshImageHistoryFromStorage,
            requireSyncConfig,
            updateSyncStatus
        ]
    );

    const handleSyncUploadFull = React.useCallback(
        async (options: ImageSyncActionOptions = {}) => {
            const scopeLabel = formatImageSyncScopeLabel(options.since);
            setIsSyncing(true);
            const startedAt = Date.now();
            updateSyncStatus(
                `正在统计${scopeLabel}同步内容…`,
                { operation: 'upload', mode: 'full', phase: 'snapshot', startedAt },
                { operation: 'upload-images', inProgress: true, done: false }
            );
            setError(null);

            try {
                const config = requireSyncConfig();
                if (!config) {
                    setSyncStatus(null);
                    return;
                }
                if (!flushImageHistoryForSync()) {
                    return;
                }

                const preview = await previewUploadSnapshot({
                    config,
                    force: options.force,
                    since: options.since
                });
                setSyncStatus(null);
                setPendingImageSyncConfirmation({
                    operation: 'upload',
                    options,
                    title: `${options.force ? '强制同步' : '同步'}${scopeLabel}？`,
                    description: options.force
                        ? '强制同步会重新上传范围内的所有图片，即使远端已经存在同名内容。'
                        : '将先跳过远端已经存在且内容匹配的图片，只上传需要补齐的内容。',
                    confirmLabel: options.force ? '强制同步' : '确认同步',
                    preview
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : '统计同步内容失败。';
                updateSyncStatus(
                    '统计同步内容失败',
                    {
                        operation: 'upload',
                        mode: 'full',
                        phase: 'snapshot',
                        startedAt,
                        completedAt: Date.now(),
                        error: message
                    },
                    { operation: 'upload-images', inProgress: false, done: true, success: false }
                );
                setError(message);
                addNotice(message, 'error');
            } finally {
                setIsSyncing(false);
            }
        },
        [addNotice, flushImageHistoryForSync, requireSyncConfig, updateSyncStatus]
    );

    const handleSyncHistoryItem = React.useCallback(
        async (item: HistoryMetadata) => {
            const filenames = Array.from(new Set(item.images.map((image) => image.filename).filter(Boolean)));
            if (filenames.length === 0) return;

            const imageCountLabel = filenames.length === 1 ? '当前图片' : `当前 ${filenames.length} 张图片`;
            setIsSyncing(true);
            const startedAt = Date.now();
            updateSyncStatus(
                `正在同步${imageCountLabel}…`,
                { operation: 'upload', mode: 'full', phase: 'snapshot', startedAt },
                { operation: 'upload-images', inProgress: true, done: false }
            );
            setError(null);

            try {
                const config = requireSyncConfig();
                if (!config) {
                    setSyncStatus(null);
                    return;
                }
                if (!flushImageHistoryForSync()) {
                    return;
                }

                const preview = await previewUploadSnapshot({
                    config,
                    filenames
                });
                if (preview.totalImages === 0) {
                    const message = '当前历史图片无法读取本地文件，未执行云同步。';
                    updateSyncStatus(
                        '当前图片同步失败',
                        {
                            operation: 'upload',
                            mode: 'full',
                            phase: 'snapshot',
                            startedAt,
                            completedAt: Date.now(),
                            error: message
                        },
                        { operation: 'upload-images', inProgress: false, done: true, success: false }
                    );
                    addNotice(message, 'warning');
                    return;
                }

                const context = getSyncContext(config, startedAt);
                const result = await uploadSnapshot({
                    config,
                    appConfig: loadConfig(),
                    mode: 'full',
                    filenames,
                    onProgress: (r) => {
                        const progressResult = { ...context, ...r };
                        if (r.phase === 'upload-images') {
                            updateSyncStatus(
                                r.totalImages > 0
                                    ? `上传${imageCountLabel} ${r.completedImages}/${r.totalImages}`
                                    : `同步${imageCountLabel}清单…`,
                                progressResult,
                                { operation: 'upload-images', inProgress: true, done: false }
                            );
                        } else if (r.phase === 'upload-manifest') {
                            updateSyncStatus(`上传${imageCountLabel}清单…`, progressResult, {
                                operation: 'upload-images',
                                inProgress: true,
                                done: false
                            });
                        } else {
                            updateSyncStatus(`正在同步${imageCountLabel}…`, progressResult, {
                                operation: 'upload-images',
                                inProgress: true,
                                done: false
                            });
                        }
                    }
                });

                if (result.ok) {
                    updateSyncStatus(
                        `${imageCountLabel}同步完成`,
                        { ...context, ...result },
                        { operation: 'upload-images', inProgress: false, done: true, success: true }
                    );
                    const skippedText = result.skippedImages ? `，跳过 ${result.skippedImages} 张已存在图片` : '';
                    addNotice(`${imageCountLabel}已同步到云存储${skippedText}。`, 'success');
                    addSyncWarnings(result.warnings);
                    refreshImageHistoryFromStorage();
                    return;
                }

                const message = result.error || '当前图片同步失败。';
                updateSyncStatus(
                    '当前图片同步失败',
                    { ...context, ...result, error: message },
                    { operation: 'upload-images', inProgress: false, done: true, success: false }
                );
                setError(message);
                addNotice(message, 'error');
            } catch (error) {
                const message = error instanceof Error ? error.message : '当前图片同步失败。';
                updateSyncStatus(
                    '当前图片同步失败',
                    {
                        operation: 'upload',
                        mode: 'full',
                        phase: 'snapshot',
                        startedAt,
                        completedAt: Date.now(),
                        error: message
                    },
                    { operation: 'upload-images', inProgress: false, done: true, success: false }
                );
                setError(message);
                addNotice(message, 'error');
            } finally {
                setIsSyncing(false);
            }
        },
        [
            addNotice,
            addSyncWarnings,
            flushImageHistoryForSync,
            getSyncContext,
            refreshImageHistoryFromStorage,
            requireSyncConfig,
            updateSyncStatus
        ]
    );

    const runSyncRestore = React.useCallback(
        async (mode: RestoreSyncMode, options: ImageSyncActionOptions = {}) => {
            const isImageRestore = mode === 'images';
            const operation = isImageRestore ? 'restore-images' : 'restore-metadata';
            const scopeLabel = isImageRestore ? formatImageSyncScopeLabel(options.since) : '配置和记录';
            const preparingLabel = isImageRestore ? `正在准备恢复${scopeLabel}…` : '正在准备恢复配置和记录…';
            const completeLabel = isImageRestore
                ? `${options.force ? '强制恢复' : '恢复'}${scopeLabel}完成`
                : '配置和记录恢复完成';
            const failedLabel = isImageRestore
                ? `${options.force ? '强制恢复' : '恢复'}${scopeLabel}失败`
                : '配置和记录恢复失败';
            setIsSyncing(true);
            autoSyncSuppressedRef.current = true;
            const startedAt = Date.now();
            updateSyncStatus(
                preparingLabel,
                {
                    operation: 'restore',
                    mode,
                    phase: 'download-manifest',
                    startedAt,
                    debug: [createSyncDebugEntry('restore:start', `Starting restore for ${scopeLabel}.`, startedAt)]
                },
                { operation, inProgress: true, done: false }
            );
            setError(null);

            try {
                const config = requireSyncConfig();
                if (!config) {
                    setSyncStatus(null);
                    return;
                }
                if (!flushImageHistoryForSync()) {
                    return;
                }
                const context = getSyncContext(config, startedAt);
                updateSyncStatus(
                    '正在查找最新快照清单…',
                    { ...context, operation: 'restore', mode, phase: 'download-manifest' },
                    { operation, inProgress: true, done: false }
                );

                let manifestKey = options.manifestKey;
                if (!manifestKey) {
                    manifestKey = getLatestSyncManifestKey(config);
                    updateSyncStatus(
                        '正在读取最新快照清单…',
                        {
                            ...context,
                            operation: 'restore',
                            mode,
                            phase: 'download-manifest',
                            manifestKey,
                            debug: [
                                createSyncDebugEntry(
                                    'restore:manifest',
                                    `Reading latest manifest pointer: ${manifestKey}`,
                                    startedAt
                                )
                            ]
                        },
                        { operation, inProgress: true, done: false }
                    );
                }
                if (!manifestKey) {
                    const message = '未找到可用的 S3 快照。';
                    updateSyncStatus(
                        '未找到可用的 S3 快照',
                        {
                            ...context,
                            operation: 'restore',
                            mode,
                            phase: 'download-manifest',
                            completedAt: Date.now(),
                            error: message
                        },
                        { operation, inProgress: false, done: true, success: false }
                    );
                    addNotice(message, 'warning');
                    return;
                }

                updateSyncStatus(
                    isImageRestore ? `正在下载${scopeLabel}…` : '正在恢复配置和记录…',
                    { ...context, operation: 'restore', mode, phase: 'download-manifest', manifestKey },
                    { operation, inProgress: true, done: false }
                );

                const result = await downloadAndRestoreSnapshot(config, manifestKey, {
                    mode,
                    force: options.force,
                    since: options.since,
                    onProgress: (r) => {
                        const progressResult = { ...context, ...r, manifestKey };
                        if (r.phase === 'download-images') {
                            updateSyncStatus(
                                `下载${scopeLabel} ${r.completedImages}/${r.totalImages}`,
                                progressResult,
                                { operation, inProgress: true, done: false }
                            );
                        } else if (r.phase === 'restore-images') {
                            updateSyncStatus(
                                `写入${scopeLabel} ${r.completedImages}/${r.totalImages}`,
                                progressResult,
                                { operation, inProgress: true, done: false }
                            );
                        } else if (r.phase === 'restore-metadata') {
                            updateSyncStatus('恢复配置和记录中…', progressResult, {
                                operation,
                                inProgress: true,
                                done: false
                            });
                        } else {
                            updateSyncStatus(
                                isImageRestore ? `恢复${scopeLabel}中…` : '恢复配置和记录中…',
                                progressResult,
                                { operation, inProgress: true, done: false }
                            );
                        }
                    }
                });

                if (result.ok) {
                    updateSyncStatus(
                        completeLabel,
                        { ...context, ...result, manifestKey },
                        { operation, inProgress: false, done: true, success: true }
                    );
                    const skippedText = result.skippedImages ? `，跳过 ${result.skippedImages} 张本地已存在图片` : '';
                    addNotice(`${completeLabel}${skippedText}：${manifestKey}`, 'success');
                    if (!isImageRestore) {
                        setAppConfig(loadConfig());
                    }
                    refreshImageHistoryFromStorage();
                    blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                    blobUrlCacheRef.current.clear();
                    failedBlobUrlLoadsRef.current.clear();
                    scheduleBlobUrlRevisionBump();
                    setDisplayedBatch(null);
                    setSelectedTaskId(null);
                } else {
                    const msg = result.error || '恢复快照时发生未知错误。';
                    updateSyncStatus(
                        failedLabel,
                        { ...context, ...result, manifestKey, error: msg },
                        { operation, inProgress: false, done: true, success: false }
                    );
                    setError(msg);
                    addNotice(msg, 'error');
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : '恢复快照时发生错误。';
                updateSyncStatus(
                    failedLabel,
                    {
                        operation: 'restore',
                        mode,
                        phase: 'download-manifest',
                        startedAt,
                        completedAt: Date.now(),
                        error: message
                    },
                    { operation, inProgress: false, done: true, success: false }
                );
                setError(message);
                addNotice(message, 'error');
            } finally {
                autoSyncSuppressedRef.current = false;
                setIsSyncing(false);
            }
        },
        [
            addNotice,
            flushImageHistoryForSync,
            getSyncContext,
            refreshImageHistoryFromStorage,
            requireSyncConfig,
            scheduleBlobUrlRevisionBump,
            updateSyncStatus
        ]
    );

    React.useEffect(() => {
        runSharedSyncRestoreRef.current = (restoreOptions) => {
            const shouldRestoreImages = restoreOptions.imageRestoreScope !== 'none';
            if (!restoreOptions.restoreMetadata && !shouldRestoreImages) {
                addNotice('云存储同步配置已保存。这个分享链接未要求恢复配置、历史或图片。', 'success');
                return;
            }

            const mode: RestoreSyncMode = shouldRestoreImages
                ? restoreOptions.restoreMetadata
                    ? 'full'
                    : 'images'
                : 'metadata';
            const since =
                restoreOptions.imageRestoreScope === 'recent' && restoreOptions.recentMs
                    ? Date.now() - restoreOptions.recentMs
                    : undefined;

            addNotice('云存储同步配置已保存，开始按分享设置恢复。', 'info');
            void runSyncRestore(mode, { since });
        };
        return () => {
            runSharedSyncRestoreRef.current = null;
        };
    }, [addNotice, runSyncRestore]);

    const handleSyncRestoreMetadata = React.useCallback(() => runSyncRestore('metadata'), [runSyncRestore]);
    const handleSyncRestoreImages = React.useCallback(
        async (options: ImageSyncActionOptions = {}) => {
            const scopeLabel = formatImageSyncScopeLabel(options.since);
            setIsSyncing(true);
            const startedAt = Date.now();
            updateSyncStatus(
                `正在统计${scopeLabel}恢复内容…`,
                {
                    operation: 'restore',
                    mode: 'images',
                    phase: 'download-manifest',
                    startedAt,
                    debug: [
                        createSyncDebugEntry('preview:start', `Preparing restore preview for ${scopeLabel}.`, startedAt)
                    ]
                },
                { operation: 'restore-images', inProgress: true, done: false }
            );
            setError(null);

            try {
                const config = requireSyncConfig();
                if (!config) {
                    setSyncStatus(null);
                    return;
                }
                const context = getSyncContext(config, startedAt);

                const manifestKey = getLatestSyncManifestKey(config);
                updateSyncStatus(
                    '正在读取最新快照清单…',
                    {
                        ...context,
                        operation: 'restore',
                        mode: 'images',
                        phase: 'download-manifest',
                        manifestKey,
                        debug: [
                            createSyncDebugEntry(
                                'preview:manifest',
                                `Reading latest manifest pointer: ${manifestKey}`,
                                startedAt
                            )
                        ]
                    },
                    { operation: 'restore-images', inProgress: true, done: false }
                );

                const preview = await previewRestoreSnapshot(config, manifestKey, {
                    mode: 'images',
                    force: options.force,
                    since: options.since,
                    onProgress: (r) => {
                        const progressResult = { ...context, ...r, manifestKey };
                        updateSyncStatus(
                            r.phase === 'download-images'
                                ? `正在检查本地已存在图片 ${r.completedImages}/${r.totalImages}`
                                : '正在读取最新快照清单…',
                            progressResult,
                            { operation: 'restore-images', inProgress: true, done: false }
                        );
                    }
                });
                setSyncStatus(null);
                setPendingImageSyncConfirmation({
                    operation: 'restore',
                    options: { ...options, manifestKey },
                    title: `${options.force ? '强制恢复' : '恢复'}${scopeLabel}？`,
                    description: options.force
                        ? '强制恢复会重新下载范围内的所有远端图片，并覆盖本地同名图片。'
                        : '将跳过本地已经存在且内容匹配的图片，只下载缺失或不一致的内容。',
                    confirmLabel: options.force ? '强制恢复' : '确认恢复',
                    preview
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : '统计恢复内容失败。';
                updateSyncStatus(
                    '统计恢复内容失败',
                    {
                        operation: 'restore',
                        mode: 'images',
                        phase: 'download-manifest',
                        startedAt,
                        completedAt: Date.now(),
                        error: message
                    },
                    { operation: 'restore-images', inProgress: false, done: true, success: false }
                );
                setError(message);
                addNotice(message, 'error');
            } finally {
                setIsSyncing(false);
            }
        },
        [addNotice, getSyncContext, requireSyncConfig, updateSyncStatus]
    );

    const handleConfirmImageSync = React.useCallback(() => {
        const pending = pendingImageSyncConfirmation;
        if (!pending) return;

        setPendingImageSyncConfirmation(null);
        if (pending.operation === 'upload') {
            void executeSyncUploadImages(pending.options);
            return;
        }

        void runSyncRestore('images', pending.options);
    }, [executeSyncUploadImages, pendingImageSyncConfirmation, runSyncRestore]);

    return (
        <>
            <main className='app-theme-scope text-foreground flex min-h-dvh flex-col items-center overflow-x-hidden px-0 pt-2 pb-4 md:p-6 lg:p-8'>
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
                <div className='mb-4 w-full max-w-screen-2xl [padding-top:max(0.5rem,env(safe-area-inset-top))] [padding-right:max(1rem,env(safe-area-inset-right))] [padding-left:max(1rem,env(safe-area-inset-left))] md:px-0 md:pt-0'>
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
                    <div className='mt-3'>
                        <PromoSlot
                            slotKey='app_top_banner'
                            surface='home'
                            promoProfileId={promoProfileId}
                            className='w-full'
                        />
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
                {pendingSharedSyncConfigChoice && (
                    <SharedSyncConfigChoiceDialog
                        open={true}
                        sharedSyncConfig={pendingSharedSyncConfigChoice.sharedSyncConfig}
                        onSaveOnly={handleSaveSharedSyncConfigOnly}
                        onSaveAndRestore={handleSaveSharedSyncConfigAndRestore}
                        onIgnoreConfig={handleIgnoreSharedSyncConfig}
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
                                promoProfileId={promoProfileId}
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
                                    <AlertDescription className='text-red-700 dark:text-red-300'>
                                        {error}
                                    </AlertDescription>
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
                        <div className='mt-6 mb-4'>
                            <PromoSlot
                                slotKey='history_top_banner'
                                surface='home'
                                promoProfileId={promoProfileId}
                                className='w-full'
                            />
                        </div>
                        <HistoryPanel
                            history={history}
                            exampleHistory={showExampleHistory ? visibleExampleHistory : undefined}
                            onSelectImage={handleHistorySelect}
                            onClearHistory={handleOpenClearHistoryDialog}
                            getImageSrc={getImageSrc}
                            imageSrcRevision={blobUrlRevision}
                            onSendToEdit={handleSendToEdit}
                            onDeleteExampleItem={handleDeleteExampleHistoryItem}
                            onDeleteItemRequest={handleRequestDeleteItem}
                            itemPendingDeleteConfirmation={itemToDeleteConfirm}
                            onConfirmDeletion={handleConfirmDeletion}
                            onCancelDeletion={handleCancelDeletion}
                            deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                            onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                            showRemoteDeleteOption={showRemoteDeleteOption}
                            deleteRemoteDialogValue={deleteRemoteWithLocal}
                            onDeleteRemoteDialogChange={setDeleteRemoteWithLocal}
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
                            onSyncUploadMetadata={hasConfiguredNetworkSync ? handleSyncUploadMetadata : undefined}
                            onSyncUploadFull={hasConfiguredNetworkSync ? handleSyncUploadFull : undefined}
                            onSyncRestoreMetadata={hasConfiguredNetworkSync ? handleSyncRestoreMetadata : undefined}
                            onSyncRestoreImages={hasConfiguredNetworkSync ? handleSyncRestoreImages : undefined}
                            onSyncHistoryItem={hasConfiguredNetworkSync ? handleSyncHistoryItem : undefined}
                            isSyncing={isSyncing}
                            syncStatus={syncStatus}
                        />
                    </div>
                </div>
                <Dialog
                    open={!!pendingImageSyncConfirmation}
                    onOpenChange={(open) => {
                        if (!open) setPendingImageSyncConfirmation(null);
                    }}>
                    <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                        {pendingImageSyncConfirmation && (
                            <>
                                <DialogHeader>
                                    <DialogTitle>{pendingImageSyncConfirmation.title}</DialogTitle>
                                    <DialogDescription className='pt-2'>
                                        {pendingImageSyncConfirmation.description}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className='border-border bg-muted/40 space-y-3 rounded-lg border p-3 text-sm'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <span className='text-muted-foreground'>范围</span>
                                        <span className='text-foreground font-medium'>
                                            {formatImageSyncScopeLabel(pendingImageSyncConfirmation.preview.since)}
                                        </span>
                                    </div>
                                    <div className='flex items-center justify-between gap-3'>
                                        <span className='text-muted-foreground'>候选图片</span>
                                        <span className='text-foreground font-medium tabular-nums'>
                                            {pendingImageSyncConfirmation.preview.totalImages.toLocaleString()} 张
                                        </span>
                                    </div>
                                    <div className='flex items-center justify-between gap-3'>
                                        <span className='text-muted-foreground'>
                                            {pendingImageSyncConfirmation.operation === 'upload'
                                                ? '需要上传'
                                                : '需要下载'}
                                        </span>
                                        <span className='text-foreground font-medium tabular-nums'>
                                            {pendingImageSyncConfirmation.preview.pendingImages.toLocaleString()} 张
                                        </span>
                                    </div>
                                    {!pendingImageSyncConfirmation.preview.force && (
                                        <div className='flex items-center justify-between gap-3'>
                                            <span className='text-muted-foreground'>可跳过</span>
                                            <span className='text-foreground font-medium tabular-nums'>
                                                {pendingImageSyncConfirmation.preview.skippedImages.toLocaleString()} 张
                                            </span>
                                        </div>
                                    )}
                                    {pendingImageSyncConfirmation.preview.manifestCreatedAt && (
                                        <div className='flex items-center justify-between gap-3'>
                                            <span className='text-muted-foreground'>快照时间</span>
                                            <span className='text-foreground font-medium'>
                                                {new Intl.DateTimeFormat('zh-CN', {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short'
                                                }).format(
                                                    new Date(pendingImageSyncConfirmation.preview.manifestCreatedAt)
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter className='gap-2 sm:justify-end'>
                                    <DialogClose asChild>
                                        <Button variant='outline' onClick={() => setPendingImageSyncConfirmation(null)}>
                                            取消
                                        </Button>
                                    </DialogClose>
                                    <Button onClick={handleConfirmImageSync}>
                                        {pendingImageSyncConfirmation.confirmLabel}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
                <Dialog
                    open={pendingBatchDelete > 0}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPendingBatchDelete(0);
                            setBatchDeleteRemoteWithLocal(false);
                        }
                    }}>
                    <DialogContent className='border-border bg-background text-foreground sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle>确认批量删除</DialogTitle>
                            <DialogDescription className='pt-2'>
                                确定要删除选中的 {pendingBatchDelete} 个条目吗？将移除相关图片。此操作不可撤销。
                            </DialogDescription>
                        </DialogHeader>
                        {showRemoteDeleteOption && (
                            <div className='border-border bg-muted/30 flex items-start gap-2 rounded-md border p-3'>
                                <Checkbox
                                    id='batch-delete-remote'
                                    checked={batchDeleteRemoteWithLocal}
                                    onCheckedChange={(checked) => setBatchDeleteRemoteWithLocal(!!checked)}
                                    className='mt-0.5'
                                />
                                <label
                                    htmlFor='batch-delete-remote'
                                    className='text-muted-foreground cursor-pointer text-sm leading-5'>
                                    同时删除远端图片
                                </label>
                            </div>
                        )}
                        <DialogFooter className='gap-2 sm:justify-end'>
                            <DialogClose asChild>
                                <Button
                                    variant='outline'
                                    onClick={() => {
                                        setPendingBatchDelete(0);
                                        setBatchDeleteRemoteWithLocal(false);
                                    }}>
                                    取消
                                </Button>
                            </DialogClose>
                            <Button variant='destructive' onClick={confirmBatchDelete}>
                                删除
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <ClearHistoryDialog
                    open={isClearHistoryDialogOpen}
                    onOpenChange={(open) => {
                        setIsClearHistoryDialogOpen(open);
                        if (!open) setClearHistoryRemoteWithLocal(false);
                    }}
                    onConfirm={handleConfirmClearHistory}
                    isIndexedDBMode={effectiveStorageModeClient === 'indexeddb'}
                    showRemoteDeleteOption={showRemoteDeleteOption}
                    deleteRemoteValue={clearHistoryRemoteWithLocal}
                    onDeleteRemoteChange={setClearHistoryRemoteWithLocal}
                />
            </main>
        </>
    );
}
