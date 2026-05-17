import type { ProviderKind, ProviderProtocol } from '@/lib/provider-model-catalog';
import type { ProviderUsage } from '@/lib/provider-types';

// ---------------------------------------------------------------------------
// Task modes
// ---------------------------------------------------------------------------

export const WORKBENCH_VIDEO_TASK_MODES = ['text-to-video', 'image-to-video'] as const;
export type WorkbenchVideoTaskMode = (typeof WORKBENCH_VIDEO_TASK_MODES)[number];

export const FUTURE_VIDEO_TASK_MODES = [
    'video-edit',
    'video-extend',
    'reference-to-video',
    'video-to-video',
    'image-audio-to-video'
] as const;
export type FutureVideoTaskMode = (typeof FUTURE_VIDEO_TASK_MODES)[number];

// ---------------------------------------------------------------------------
// Status & enum types
// ---------------------------------------------------------------------------

export type VideoGenerationStatus =
    | 'queued'
    | 'running'
    | 'polling'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'expired';

export type VideoSourceImageRole =
    | 'start_frame'
    | 'end_frame'
    | 'reference'
    | 'subject'
    | 'character'
    | 'motion';

export type VideoResultAssetKind = 'video' | 'thumbnail' | 'spritesheet';

export type VideoResolutionTier = '480p' | '720p' | '1080p' | '4k';

export type VideoShotType = 'single' | 'multi' | 'auto';

export type VideoCameraMotion =
    | 'none'
    | 'pan-left'
    | 'pan-right'
    | 'tilt-up'
    | 'tilt-down'
    | 'zoom-in'
    | 'zoom-out'
    | 'orbit'
    | 'dolly'
    | 'static'
    | 'custom';

export type VideoStorageMode = 'fs' | 'indexeddb' | 'url';

export type VideoHistorySyncStatus =
    | 'local_only'
    | 'pending_upload'
    | 'synced'
    | 'partial'
    | 'conflict';

export type VideoHistoryImageSyncStatus = 'local_only' | 'pending_upload' | 'synced' | 'conflict';

// ---------------------------------------------------------------------------
// Asset refs
// ---------------------------------------------------------------------------

export type VideoSourceAssetRef = {
    filename: string;
    role: VideoSourceImageRole;
    storageModeUsed: VideoStorageMode;
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    sha256?: string;
    source: 'uploaded' | 'clipboard' | 'history-image' | 'generated-image' | 'remote-url' | 'restored';
    syncStatus?: VideoHistoryImageSyncStatus;
};

export type VideoResultAssetRef = {
    filename: string;
    kind: VideoResultAssetKind;
    mimeType: string;
    storageModeUsed: VideoStorageMode;
    size?: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
    remoteUrl?: string;
    remoteUrlExpiresAt?: number;
    sha256?: string;
    syncStatus?: VideoHistoryImageSyncStatus;
};

// ---------------------------------------------------------------------------
// Parameters, job, history metadata
// ---------------------------------------------------------------------------

export type VideoGenerationParameters = {
    durationSeconds?: number;
    aspectRatio?: string;
    size?: string;
    resolutionTier?: VideoResolutionTier;
    frameRate?: number;
    seed?: number;
    count?: number;
    promptEnhanceEnabled?: boolean;
    nativeAudioEnabled?: boolean;
    watermarkEnabled?: boolean;
    cameraMotion?: VideoCameraMotion | string;
    shotType?: VideoShotType;
};

export type VideoGenerationJob = {
    id: string;
    providerJobId?: string;
    providerRequestId?: string;
    status: VideoGenerationStatus;
    progress?: number;
    createdAt: number;
    updatedAt: number;
    startedAt?: number;
    completedAt?: number;
    errorCode?: string;
    errorMessage?: string;
    resultRemoteUrl?: string;
    resultRemoteUrlExpiresAt?: number;
    thumbnailRemoteUrl?: string;
    pollAttempts?: number;
    nextPollAt?: number;
};

export type VideoHistoryMetadata = {
    id: string;
    type: WorkbenchVideoTaskMode;
    timestamp: number;
    durationMs?: number;
    prompt: string;
    negativePrompt?: string;
    providerEndpointId: string;
    providerEndpointName?: string;
    providerKind: ProviderKind;
    providerProtocol: ProviderProtocol;
    catalogEntryId?: string;
    rawModelId: string;
    sourceAssets: VideoSourceAssetRef[];
    resultAssets: VideoResultAssetRef[];
    job: VideoGenerationJob;
    parameters: VideoGenerationParameters;
    usage?: ProviderUsage;
    syncStatus?: VideoHistorySyncStatus;
};

// ---------------------------------------------------------------------------
// Storage keys & defaults
// ---------------------------------------------------------------------------

export const VIDEO_HISTORY_STORAGE_KEY = 'gpt-image-playground-video-history';
export const VIDEO_JOB_STORE_TABLE = 'videoJobs';
export const VIDEO_BLOB_STORE_TABLE = 'videoBlobs';

export const DEFAULT_VIDEO_HISTORY_LIMIT = 100;
export const DEFAULT_VIDEO_POLLING_INTERVAL_SECONDS = 5;
export const DEFAULT_VIDEO_POLLING_MAX_INTERVAL_SECONDS = 30;
export const DEFAULT_VIDEO_POLLING_TIMEOUT_MINUTES = 30;
export const DEFAULT_VIDEO_MAX_FAILURE_RETRIES = 0;

// ---------------------------------------------------------------------------
// VideoTaskDefaults & VideoSyncOptions types + defaults
// ---------------------------------------------------------------------------

export type VideoTaskDefaults = {
    pollingIntervalSeconds: number;
    pollingMaxIntervalSeconds: number;
    pollingTimeoutMinutes: number;
    maxFailureRetries: number;
    saveHistoryEnabled: boolean;
    autoDownloadEnabled: boolean;
    defaultDurationSeconds?: number;
    defaultAspectRatio?: string;
    defaultResolutionTier?: VideoResolutionTier;
    defaultPromptEnhanceEnabled?: boolean;
    defaultNativeAudioEnabled?: boolean;
};

export type VideoSyncOptions = {
    videoHistory: boolean;
    videoSourceImages: boolean;
    videoThumbnails: boolean;
    videoFiles: boolean;
    recentVideoRangeDays: number;
    maxVideoAssetBytes: number;
};

export const DEFAULT_VIDEO_TASK_DEFAULTS: VideoTaskDefaults = {
    pollingIntervalSeconds: 5,
    pollingMaxIntervalSeconds: 30,
    pollingTimeoutMinutes: 30,
    maxFailureRetries: 0,
    saveHistoryEnabled: true,
    autoDownloadEnabled: true
};

export const DEFAULT_VIDEO_SYNC_OPTIONS: VideoSyncOptions = {
    videoHistory: true,
    videoSourceImages: true,
    videoThumbnails: true,
    videoFiles: false,
    recentVideoRangeDays: 7,
    maxVideoAssetBytes: 100 * 1024 * 1024
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Normalizers – scalar enums
// ---------------------------------------------------------------------------

const VIDEO_GENERATION_STATUSES: readonly VideoGenerationStatus[] = [
    'queued',
    'running',
    'polling',
    'succeeded',
    'failed',
    'cancelled',
    'expired'
];

export function normalizeVideoGenerationStatus(value: unknown): VideoGenerationStatus {
    if (typeof value === 'string' && (VIDEO_GENERATION_STATUSES as readonly string[]).includes(value)) {
        return value as VideoGenerationStatus;
    }
    return 'queued';
}

const VIDEO_SOURCE_IMAGE_ROLES: readonly VideoSourceImageRole[] = [
    'start_frame',
    'end_frame',
    'reference',
    'subject',
    'character',
    'motion'
];

export function normalizeVideoSourceImageRole(value: unknown): VideoSourceImageRole {
    if (typeof value === 'string' && (VIDEO_SOURCE_IMAGE_ROLES as readonly string[]).includes(value)) {
        return value as VideoSourceImageRole;
    }
    return 'reference';
}

const VIDEO_RESULT_ASSET_KINDS: readonly VideoResultAssetKind[] = ['video', 'thumbnail', 'spritesheet'];

export function normalizeVideoResultAssetKind(value: unknown): VideoResultAssetKind {
    if (typeof value === 'string' && (VIDEO_RESULT_ASSET_KINDS as readonly string[]).includes(value)) {
        return value as VideoResultAssetKind;
    }
    return 'video';
}

const VIDEO_RESOLUTION_TIERS: readonly VideoResolutionTier[] = ['480p', '720p', '1080p', '4k'];

export function normalizeVideoResolutionTier(value: unknown): VideoResolutionTier | undefined {
    if (typeof value === 'string' && (VIDEO_RESOLUTION_TIERS as readonly string[]).includes(value)) {
        return value as VideoResolutionTier;
    }
    return undefined;
}

const VIDEO_SHOT_TYPES: readonly VideoShotType[] = ['single', 'multi', 'auto'];

export function normalizeVideoShotType(value: unknown): VideoShotType | undefined {
    if (typeof value === 'string' && (VIDEO_SHOT_TYPES as readonly string[]).includes(value)) {
        return value as VideoShotType;
    }
    return undefined;
}

const VIDEO_STORAGE_MODES: readonly VideoStorageMode[] = ['fs', 'indexeddb', 'url'];

export function normalizeVideoStorageMode(value: unknown): VideoStorageMode {
    if (typeof value === 'string' && (VIDEO_STORAGE_MODES as readonly string[]).includes(value)) {
        return value as VideoStorageMode;
    }
    return 'indexeddb';
}

const VIDEO_SYNC_STATUSES: readonly VideoHistorySyncStatus[] = [
    'local_only',
    'pending_upload',
    'synced',
    'partial',
    'conflict'
];

export function normalizeVideoSyncStatus(value: unknown): VideoHistorySyncStatus | undefined {
    if (typeof value === 'string' && (VIDEO_SYNC_STATUSES as readonly string[]).includes(value)) {
        return value as VideoHistorySyncStatus;
    }
    return undefined;
}

const VIDEO_IMAGE_SYNC_STATUSES: readonly VideoHistoryImageSyncStatus[] = [
    'local_only',
    'pending_upload',
    'synced',
    'conflict'
];

export function normalizeVideoImageSyncStatus(value: unknown): VideoHistoryImageSyncStatus | undefined {
    if (typeof value === 'string' && (VIDEO_IMAGE_SYNC_STATUSES as readonly string[]).includes(value)) {
        return value as VideoHistoryImageSyncStatus;
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Normalizers – asset refs
// ---------------------------------------------------------------------------

const VIDEO_SOURCE_ASSET_SOURCES: readonly VideoSourceAssetRef['source'][] = [
    'uploaded',
    'clipboard',
    'history-image',
    'generated-image',
    'remote-url',
    'restored'
];

export function normalizeVideoSourceAssetRef(value: unknown): VideoSourceAssetRef | null {
    if (!isRecord(value)) return null;

    const filename = typeof value.filename === 'string' ? value.filename.trim() : '';
    if (!filename) return null;

    const role = normalizeVideoSourceImageRole(value.role);
    const storageModeUsed = normalizeVideoStorageMode(value.storageModeUsed);

    const rawSource = value.source;
    const source: VideoSourceAssetRef['source'] =
        typeof rawSource === 'string' && (VIDEO_SOURCE_ASSET_SOURCES as readonly string[]).includes(rawSource)
            ? (rawSource as VideoSourceAssetRef['source'])
            : 'uploaded';

    const result: VideoSourceAssetRef = {
        filename,
        role,
        storageModeUsed,
        source
    };

    if (typeof value.mimeType === 'string' && value.mimeType) result.mimeType = value.mimeType;
    if (isFiniteNumber(value.size) && value.size >= 0) result.size = value.size;
    if (isFiniteNumber(value.width) && value.width > 0) result.width = value.width;
    if (isFiniteNumber(value.height) && value.height > 0) result.height = value.height;
    if (typeof value.sha256 === 'string' && value.sha256) result.sha256 = value.sha256;

    const syncStatus = normalizeVideoImageSyncStatus(value.syncStatus);
    if (syncStatus) result.syncStatus = syncStatus;

    return result;
}

export function normalizeVideoResultAssetRef(value: unknown): VideoResultAssetRef | null {
    if (!isRecord(value)) return null;

    const filename = typeof value.filename === 'string' ? value.filename.trim() : '';
    if (!filename) return null;

    const mimeType = typeof value.mimeType === 'string' ? value.mimeType.trim() : '';
    if (!mimeType) return null;

    const kind = normalizeVideoResultAssetKind(value.kind);
    const storageModeUsed = normalizeVideoStorageMode(value.storageModeUsed);

    const result: VideoResultAssetRef = {
        filename,
        kind,
        mimeType,
        storageModeUsed
    };

    if (isFiniteNumber(value.size) && value.size >= 0) result.size = value.size;
    if (isFiniteNumber(value.width) && value.width > 0) result.width = value.width;
    if (isFiniteNumber(value.height) && value.height > 0) result.height = value.height;
    if (isFiniteNumber(value.durationSeconds) && value.durationSeconds > 0) result.durationSeconds = value.durationSeconds;
    if (typeof value.remoteUrl === 'string' && value.remoteUrl) result.remoteUrl = value.remoteUrl;
    if (isFiniteNumber(value.remoteUrlExpiresAt)) result.remoteUrlExpiresAt = value.remoteUrlExpiresAt;
    if (typeof value.sha256 === 'string' && value.sha256) result.sha256 = value.sha256;

    const syncStatus = normalizeVideoImageSyncStatus(value.syncStatus);
    if (syncStatus) result.syncStatus = syncStatus;

    return result;
}

// ---------------------------------------------------------------------------
// Normalizers – parameters, job, history metadata
// ---------------------------------------------------------------------------

export function normalizeVideoGenerationParameters(value: unknown): VideoGenerationParameters {
    if (!isRecord(value)) return {};

    const result: VideoGenerationParameters = {};

    if (isFiniteNumber(value.durationSeconds) && value.durationSeconds > 0)
        result.durationSeconds = value.durationSeconds;
    if (typeof value.aspectRatio === 'string' && value.aspectRatio.trim())
        result.aspectRatio = value.aspectRatio.trim();
    if (typeof value.size === 'string' && value.size.trim()) result.size = value.size.trim();

    const resolutionTier = normalizeVideoResolutionTier(value.resolutionTier);
    if (resolutionTier) result.resolutionTier = resolutionTier;

    if (isFiniteNumber(value.frameRate) && value.frameRate > 0) result.frameRate = value.frameRate;
    if (isFiniteNumber(value.seed)) result.seed = value.seed;
    if (isFiniteNumber(value.count) && value.count > 0) result.count = value.count;

    if (value.promptEnhanceEnabled === true) result.promptEnhanceEnabled = true;
    if (value.nativeAudioEnabled === true) result.nativeAudioEnabled = true;
    if (value.watermarkEnabled === true) result.watermarkEnabled = true;

    if (typeof value.cameraMotion === 'string' && value.cameraMotion.trim())
        result.cameraMotion = value.cameraMotion.trim();

    const shotType = normalizeVideoShotType(value.shotType);
    if (shotType) result.shotType = shotType;

    return result;
}

export function normalizeVideoGenerationJob(value: unknown): VideoGenerationJob | null {
    if (!isRecord(value)) return null;

    const id = typeof value.id === 'string' ? value.id.trim() : '';
    if (!id) return null;

    const status = normalizeVideoGenerationStatus(value.status);
    const now = Date.now();

    const result: VideoGenerationJob = {
        id,
        status,
        createdAt: isFiniteNumber(value.createdAt) && value.createdAt > 0 ? value.createdAt : now,
        updatedAt: isFiniteNumber(value.updatedAt) && value.updatedAt > 0 ? value.updatedAt : now
    };

    if (typeof value.providerJobId === 'string' && value.providerJobId) result.providerJobId = value.providerJobId;
    if (typeof value.providerRequestId === 'string' && value.providerRequestId)
        result.providerRequestId = value.providerRequestId;
    if (isFiniteNumber(value.progress) && value.progress >= 0 && value.progress <= 100) result.progress = value.progress;
    if (isFiniteNumber(value.startedAt) && value.startedAt > 0) result.startedAt = value.startedAt;
    if (isFiniteNumber(value.completedAt) && value.completedAt > 0) result.completedAt = value.completedAt;
    if (typeof value.errorCode === 'string' && value.errorCode) result.errorCode = value.errorCode;
    if (typeof value.errorMessage === 'string' && value.errorMessage) result.errorMessage = value.errorMessage;
    if (typeof value.resultRemoteUrl === 'string' && value.resultRemoteUrl)
        result.resultRemoteUrl = value.resultRemoteUrl;
    if (isFiniteNumber(value.resultRemoteUrlExpiresAt))
        result.resultRemoteUrlExpiresAt = value.resultRemoteUrlExpiresAt;
    if (typeof value.thumbnailRemoteUrl === 'string' && value.thumbnailRemoteUrl)
        result.thumbnailRemoteUrl = value.thumbnailRemoteUrl;
    if (isFiniteNumber(value.pollAttempts) && value.pollAttempts >= 0) result.pollAttempts = value.pollAttempts;
    if (isFiniteNumber(value.nextPollAt) && value.nextPollAt > 0) result.nextPollAt = value.nextPollAt;

    return result;
}

export function normalizeVideoHistoryMetadata(value: unknown): VideoHistoryMetadata | null {
    if (!isRecord(value)) return null;

    const id = typeof value.id === 'string' ? value.id.trim() : '';
    if (!id) return null;

    const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
    if (!prompt) return null;

    const rawModelId = typeof value.rawModelId === 'string' ? value.rawModelId.trim() : '';
    if (!rawModelId) return null;

    const job = normalizeVideoGenerationJob(value.job);
    if (!job) return null;

    // type: unknown → 'text-to-video'
    const rawType = value.type;
    const type: WorkbenchVideoTaskMode =
        typeof rawType === 'string' &&
        (WORKBENCH_VIDEO_TASK_MODES as readonly string[]).includes(rawType)
            ? (rawType as WorkbenchVideoTaskMode)
            : 'text-to-video';

    // providerKind
    const PROVIDER_KINDS: readonly ProviderKind[] = [
        'openai',
        'openai-compatible',
        'google-gemini',
        'volcengine-ark',
        'sensenova'
    ];
    const rawProviderKind = value.providerKind;
    const providerKind: ProviderKind =
        typeof rawProviderKind === 'string' && (PROVIDER_KINDS as readonly string[]).includes(rawProviderKind)
            ? (rawProviderKind as ProviderKind)
            : 'openai-compatible';

    // providerProtocol
    const PROTOCOLS: readonly ProviderProtocol[] = [
        'openai-responses',
        'openai-chat-completions',
        'openai-images',
        'gemini-generate-content',
        'ark-openai-compatible'
    ];
    const rawProtocol = value.providerProtocol;
    const providerProtocol: ProviderProtocol =
        typeof rawProtocol === 'string' && (PROTOCOLS as readonly string[]).includes(rawProtocol)
            ? (rawProtocol as ProviderProtocol)
            : 'openai-images';

    // providerEndpointId
    const providerEndpointId = typeof value.providerEndpointId === 'string' ? value.providerEndpointId.trim() : '';

    // sourceAssets
    const sourceAssets: VideoSourceAssetRef[] = Array.isArray(value.sourceAssets)
        ? value.sourceAssets
              .map(normalizeVideoSourceAssetRef)
              .filter((asset): asset is VideoSourceAssetRef => asset !== null)
        : [];

    // resultAssets
    const resultAssets: VideoResultAssetRef[] = Array.isArray(value.resultAssets)
        ? value.resultAssets
              .map(normalizeVideoResultAssetRef)
              .filter((asset): asset is VideoResultAssetRef => asset !== null)
        : [];

    // parameters
    const parameters = normalizeVideoGenerationParameters(value.parameters);

    const result: VideoHistoryMetadata = {
        id,
        type,
        timestamp: isFiniteNumber(value.timestamp) && value.timestamp > 0 ? value.timestamp : Date.now(),
        prompt,
        providerEndpointId,
        providerKind,
        providerProtocol,
        rawModelId,
        sourceAssets,
        resultAssets,
        job,
        parameters
    };

    if (isFiniteNumber(value.durationMs) && value.durationMs >= 0) result.durationMs = value.durationMs;
    if (typeof value.negativePrompt === 'string' && value.negativePrompt.trim())
        result.negativePrompt = value.negativePrompt.trim();
    if (typeof value.providerEndpointName === 'string' && value.providerEndpointName.trim())
        result.providerEndpointName = value.providerEndpointName.trim();
    if (typeof value.catalogEntryId === 'string' && value.catalogEntryId.trim())
        result.catalogEntryId = value.catalogEntryId.trim();

    // usage
    if (isRecord(value.usage)) {
        const usage: ProviderUsage = {};
        if (isFiniteNumber(value.usage.output_tokens) && value.usage.output_tokens >= 0)
            usage.output_tokens = value.usage.output_tokens;
        if (isRecord(value.usage.input_tokens_details)) {
            const details: NonNullable<ProviderUsage['input_tokens_details']> = {};
            if (isFiniteNumber(value.usage.input_tokens_details.text_tokens) && value.usage.input_tokens_details.text_tokens >= 0)
                details.text_tokens = value.usage.input_tokens_details.text_tokens;
            if (isFiniteNumber(value.usage.input_tokens_details.image_tokens) && value.usage.input_tokens_details.image_tokens >= 0)
                details.image_tokens = value.usage.input_tokens_details.image_tokens;
            if (Object.keys(details).length > 0) usage.input_tokens_details = details;
        }
        if (Object.keys(usage).length > 0) result.usage = usage;
    }

    const syncStatus = normalizeVideoSyncStatus(value.syncStatus);
    if (syncStatus) result.syncStatus = syncStatus;

    return result;
}

// ---------------------------------------------------------------------------
// Normalizers – config shapes
// ---------------------------------------------------------------------------

export function normalizeVideoTaskDefaults(value: unknown): VideoTaskDefaults {
    const defaults = DEFAULT_VIDEO_TASK_DEFAULTS;

    if (!isRecord(value)) return { ...defaults };

    const pollingIntervalSeconds = isFiniteNumber(value.pollingIntervalSeconds)
        ? Math.max(1, Math.floor(value.pollingIntervalSeconds))
        : defaults.pollingIntervalSeconds;

    const pollingMaxIntervalSeconds = isFiniteNumber(value.pollingMaxIntervalSeconds)
        ? Math.max(pollingIntervalSeconds, Math.floor(value.pollingMaxIntervalSeconds))
        : defaults.pollingMaxIntervalSeconds;

    const pollingTimeoutMinutes = isFiniteNumber(value.pollingTimeoutMinutes)
        ? clampNumber(Math.floor(value.pollingTimeoutMinutes), 1, 1440)
        : defaults.pollingTimeoutMinutes;

    const maxFailureRetries = isFiniteNumber(value.maxFailureRetries)
        ? clampNumber(Math.floor(value.maxFailureRetries), 0, 5)
        : defaults.maxFailureRetries;

    const saveHistoryEnabled = typeof value.saveHistoryEnabled === 'boolean'
        ? value.saveHistoryEnabled
        : defaults.saveHistoryEnabled;
    const autoDownloadEnabled = typeof value.autoDownloadEnabled === 'boolean'
        ? value.autoDownloadEnabled
        : defaults.autoDownloadEnabled;

    const defaultDurationSeconds = isFiniteNumber(value.defaultDurationSeconds) && value.defaultDurationSeconds > 0
        ? value.defaultDurationSeconds
        : undefined;

    const defaultAspectRatio = typeof value.defaultAspectRatio === 'string' && value.defaultAspectRatio.trim()
        ? value.defaultAspectRatio.trim()
        : undefined;

    const defaultResolutionTier = normalizeVideoResolutionTier(value.defaultResolutionTier);

    const defaultPromptEnhanceEnabled = typeof value.defaultPromptEnhanceEnabled === 'boolean'
        ? value.defaultPromptEnhanceEnabled
        : undefined;

    const defaultNativeAudioEnabled = typeof value.defaultNativeAudioEnabled === 'boolean'
        ? value.defaultNativeAudioEnabled
        : undefined;

    return {
        pollingIntervalSeconds,
        pollingMaxIntervalSeconds,
        pollingTimeoutMinutes,
        maxFailureRetries,
        saveHistoryEnabled,
        autoDownloadEnabled,
        ...(defaultDurationSeconds !== undefined ? { defaultDurationSeconds } : {}),
        ...(defaultAspectRatio !== undefined ? { defaultAspectRatio } : {}),
        ...(defaultResolutionTier !== undefined ? { defaultResolutionTier } : {}),
        ...(defaultPromptEnhanceEnabled !== undefined ? { defaultPromptEnhanceEnabled } : {}),
        ...(defaultNativeAudioEnabled !== undefined ? { defaultNativeAudioEnabled } : {})
    };
}

export function normalizeVideoSyncOptions(value: unknown): VideoSyncOptions {
    const defaults = DEFAULT_VIDEO_SYNC_OPTIONS;

    if (!isRecord(value)) return { ...defaults };

    const videoHistory = value.videoHistory === true;
    const videoSourceImages = value.videoSourceImages === true;
    const videoThumbnails = value.videoThumbnails === true;
    const videoFiles = value.videoFiles === true;

    const recentVideoRangeDays = isFiniteNumber(value.recentVideoRangeDays)
        ? clampNumber(Math.floor(value.recentVideoRangeDays), 1, 365)
        : defaults.recentVideoRangeDays;

    const maxVideoAssetBytes = isFiniteNumber(value.maxVideoAssetBytes)
        ? clampNumber(Math.floor(value.maxVideoAssetBytes), 1 * 1024 * 1024, 5 * 1024 * 1024 * 1024)
        : defaults.maxVideoAssetBytes;

    return {
        videoHistory: videoHistory || defaults.videoHistory,
        videoSourceImages: videoSourceImages || defaults.videoSourceImages,
        videoThumbnails: videoThumbnails || defaults.videoThumbnails,
        videoFiles,
        recentVideoRangeDays,
        maxVideoAssetBytes
    };
}
