import type { BatchPlanFormSnapshot } from '@/lib/batch-plan-draft';
import type { AppConfig } from '@/lib/config';
import type { GptImageModel } from '@/lib/cost-utils';
import type { StoredCustomImageModel } from '@/lib/model-registry';
import type { ProviderOptions } from '@/lib/provider-options';
import type { SizePreset } from '@/lib/size-utils';
import type {
    VisionTextApiCompatibility,
    VisionTextDetail,
    VisionTextResponseFormat,
    VisionTextTaskType
} from '@/lib/vision-text-types';
import type * as React from 'react';

export type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

export type WorkbenchTaskMode = 'image-generate' | 'image-edit' | 'image-to-text' | 'text-to-video' | 'image-to-video';

export type EditingFormData = {
    taskMode: WorkbenchTaskMode;
    prompt: string;
    n: number;
    size: SizePreset;
    customWidth: number;
    customHeight: number;
    quality: 'low' | 'medium' | 'high' | 'auto';
    output_format: 'png' | 'jpeg' | 'webp';
    output_compression?: number;
    background: 'transparent' | 'opaque' | 'auto';
    moderation: 'low' | 'auto';
    imageFiles: File[];
    maskFile: File | null;
    model: GptImageModel;
    providerInstanceId: string;
    providerOptions?: ProviderOptions;
    videoCatalogEntryId: string;
    visionTextProviderInstanceId: string;
    visionTextModelId: string;
    visionTextTaskType: VisionTextTaskType;
    visionTextDetail: VisionTextDetail;
    visionTextResponseFormat: VisionTextResponseFormat;
    visionTextStreamingEnabled: boolean;
    visionTextStructuredOutputEnabled: boolean;
    visionTextMaxOutputTokens: number;
    visionTextSystemPrompt: string;
    visionTextApiCompatibility: VisionTextApiCompatibility;
};

export type EditingFormProps = {
    onSubmit: (data: EditingFormData) => void;
    isPasswordRequiredByBackend: boolean | null;
    clientPasswordHash: string | null;
    onOpenPasswordDialog: () => void;
    workspaceStatusSlot?: React.ReactNode;
    editModel: EditingFormData['model'];
    setEditModel: React.Dispatch<React.SetStateAction<EditingFormData['model']>>;
    providerInstanceId: string;
    setProviderInstanceId: React.Dispatch<React.SetStateAction<string>>;
    videoCatalogEntryId: string;
    setVideoCatalogEntryId: React.Dispatch<React.SetStateAction<string>>;
    taskMode: WorkbenchTaskMode;
    setTaskMode: React.Dispatch<React.SetStateAction<WorkbenchTaskMode>>;
    visionTextProviderInstanceId: string;
    setVisionTextProviderInstanceId: React.Dispatch<React.SetStateAction<string>>;
    visionTextModelId: string;
    setVisionTextModelId: React.Dispatch<React.SetStateAction<string>>;
    visionTextTaskType: VisionTextTaskType;
    setVisionTextTaskType: React.Dispatch<React.SetStateAction<VisionTextTaskType>>;
    visionTextDetail: VisionTextDetail;
    setVisionTextDetail: React.Dispatch<React.SetStateAction<VisionTextDetail>>;
    visionTextResponseFormat: VisionTextResponseFormat;
    setVisionTextResponseFormat: React.Dispatch<React.SetStateAction<VisionTextResponseFormat>>;
    visionTextStreamingEnabled: boolean;
    setVisionTextStreamingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    visionTextStructuredOutputEnabled: boolean;
    setVisionTextStructuredOutputEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    visionTextMaxOutputTokens: number;
    setVisionTextMaxOutputTokens: React.Dispatch<React.SetStateAction<number>>;
    visionTextSystemPrompt: string;
    setVisionTextSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
    visionTextApiCompatibility: 'responses' | 'chat-completions';
    setVisionTextApiCompatibility: React.Dispatch<React.SetStateAction<'responses' | 'chat-completions'>>;
    imageFiles: File[];
    sourceImagePreviewUrls: string[];
    setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
    setSourceImagePreviewUrls: React.Dispatch<React.SetStateAction<string[]>>;
    maxImages: number;
    editN: number[];
    setEditN: React.Dispatch<React.SetStateAction<number[]>>;
    editSize: EditingFormData['size'];
    setEditSize: React.Dispatch<React.SetStateAction<EditingFormData['size']>>;
    scenarioSelectedEditSize: string | null;
    setScenarioSelectedEditSize: React.Dispatch<React.SetStateAction<string | null>>;
    editCustomWidth: number;
    setEditCustomWidth: React.Dispatch<React.SetStateAction<number>>;
    editCustomHeight: number;
    setEditCustomHeight: React.Dispatch<React.SetStateAction<number>>;
    editQuality: EditingFormData['quality'];
    setEditQuality: React.Dispatch<React.SetStateAction<EditingFormData['quality']>>;
    outputFormat: EditingFormData['output_format'];
    setOutputFormat: React.Dispatch<React.SetStateAction<EditingFormData['output_format']>>;
    compression: number[];
    setCompression: React.Dispatch<React.SetStateAction<number[]>>;
    background: EditingFormData['background'];
    setBackground: React.Dispatch<React.SetStateAction<EditingFormData['background']>>;
    moderation: EditingFormData['moderation'];
    setModeration: React.Dispatch<React.SetStateAction<EditingFormData['moderation']>>;
    editBrushSize: number[];
    setEditBrushSize: React.Dispatch<React.SetStateAction<number[]>>;
    editShowMaskEditor: boolean;
    setEditShowMaskEditor: React.Dispatch<React.SetStateAction<boolean>>;
    editGeneratedMaskFile: File | null;
    setEditGeneratedMaskFile: React.Dispatch<React.SetStateAction<File | null>>;
    editIsMaskSaved: boolean;
    setEditIsMaskSaved: React.Dispatch<React.SetStateAction<boolean>>;
    editOriginalImageSize: { width: number; height: number } | null;
    setEditOriginalImageSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>;
    editDrawnPoints: DrawnPoint[];
    setEditDrawnPoints: React.Dispatch<React.SetStateAction<DrawnPoint[]>>;
    editMaskPreviewUrl: string | null;
    setEditMaskPreviewUrl: React.Dispatch<React.SetStateAction<string | null>>;
    enableStreaming: boolean;
    setEnableStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    partialImages: 1 | 2 | 3;
    setPartialImages: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
    promptHistoryLimit: number;
    customImageModels?: StoredCustomImageModel[];
    appConfig: AppConfig;
    clientDirectLinkPriority: boolean;
    shareApiKey: string;
    shareApiBaseUrl: string;
    shareProviderInstanceId: string;
    shareProviderLabel: string;
    promoProfileId?: string | null;
    batchDisabledByShare?: boolean;
    onOpenBatchPlanner: (snapshot: BatchPlanFormSnapshot, prompt: string) => void;
    onOpenVisionTextSettings?: () => void;
    onOpenPromptPolishSettings?: () => void;
    onPromptSettled?: (prompt: string) => void;
};

export type EditingFormPromptOptions = {
    cursorPosition?: number;
    focus?: boolean;
};

export type EditingFormHandle = {
    appendPrompt: (prompt: string, options?: EditingFormPromptOptions) => void;
    getBatchFormSnapshot: () => BatchPlanFormSnapshot;
    getPrompt: () => string;
    setPrompt: (prompt: string, options?: EditingFormPromptOptions) => void;
};
