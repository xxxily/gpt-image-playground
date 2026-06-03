'use client';

import { useAppLanguage } from '@/components/app-language-provider';
import { ConfigurationRequiredActions } from '@/components/configuration-required-actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    batchStrategyIdToPlanningMode,
    normalizeBatchFeatureConfig,
    type BatchFeatureConfig
} from '@/lib/batch-config';
import {
    buildBatchImageEditPlan,
    getBatchImageEditPresetInstruction,
    MAX_BATCH_IMAGE_EDIT_INPUTS,
    type BatchImageEditInputSummary,
    type BatchImageEditPreset,
    type BatchImageEditRuntime,
    type BatchImageEditRuntimeInput
} from '@/lib/batch-image-edit';
import {
    DEFAULT_BATCH_PLAN_MAX_COUNT,
    MAX_BATCH_PLAN_COUNT,
    MIN_BATCH_PLAN_COUNT,
    type BatchCountMode,
    type BatchPlan,
    type BatchPlanningMode
} from '@/lib/batch-plan-core';
import {
    clearBatchPlanDraft,
    loadBatchPlanDraft,
    saveBatchPlanDraft,
    type BatchPlanDraft
} from '@/lib/batch-plan-draft';
import {
    BatchTaskImportError,
    buildManualSplitBatchPlan,
    parseBatchTaskImportJson,
    type BatchPlanDraftSource,
    type BatchTaskBuildWarning,
    type BatchTextSplitMode
} from '@/lib/batch-task-import';
import { isImageFileLike } from '@/lib/clipboard-images';
import { isConfigurationRequiredMessage } from '@/lib/configuration-guidance';
import { generateId } from '@/lib/id';
import { cn } from '@/lib/utils';
import {
    Braces,
    Download,
    FileImage,
    FileText,
    Layers3,
    Loader2,
    RotateCcw,
    Sparkles,
    Trash2,
    UploadCloud
} from 'lucide-react';
import * as React from 'react';

type BatchPlanningDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentPrompt: string;
    currentSourceImageCount: number;
    currentSourceImageNames: string[];
    isPlanning: boolean;
    onPlan: (params: {
        planningMode: BatchPlanningMode;
        countMode: BatchCountMode;
        targetCount?: number;
        maxCount: number;
        adjustmentInstruction: string;
    }) => Promise<void>;
    onLocalPlan: (draft: BatchPlanDraft, runtime?: BatchImageEditRuntime) => void;
    onRecoverPrompt: (prompt: string) => void;
    batchFeature: BatchFeatureConfig;
    hasBatchPlanningModel: boolean;
    onOpenBatchSettings?: () => void;
};

type BrowserFileSystemEntry = {
    isFile: boolean;
    isDirectory: boolean;
    name: string;
};

type BrowserFileSystemFileEntry = BrowserFileSystemEntry & {
    file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};

type BrowserFileSystemDirectoryEntry = BrowserFileSystemEntry & {
    createReader: () => {
        readEntries: (
            success: (entries: BrowserFileSystemEntry[]) => void,
            error?: (error: DOMException) => void
        ) => void;
    };
};

type BrowserDataTransferItemWithEntry = DataTransferItem & {
    webkitGetAsEntry?: () => BrowserFileSystemEntry | null;
};

type CollectedImageFile = {
    file: File;
    relativePath?: string;
};

function readPreviewCount(draft: BatchPlanDraft | null): number {
    return draft?.preview?.tasks.length ?? 0;
}

function buildDefaultDraft(
    currentPrompt: string,
    currentSourceImageCount: number,
    currentSourceImageNames: string[],
    batchFeature: BatchFeatureConfig
): BatchPlanDraft {
    const normalizedBatchFeature = normalizeBatchFeatureConfig(batchFeature);
    const sourceText = currentPrompt.trim();
    if (!sourceText) {
        return {
            source: 'image-edit-batch',
            sourceText: '',
            sourceImageCount: currentSourceImageCount,
            sourceImageNames: currentSourceImageNames.slice(0, 12),
            planningMode: 'image-edit-batch',
            countMode: 'fixed',
            targetCount: 0,
            maxCount: normalizedBatchFeature.maxPreviewTaskCount,
            adjustmentInstruction: '',
            imageEditPreset: 'custom',
            imageEditInstruction: '',
            imageEditSharedReferenceCount: currentSourceImageCount,
            updatedAt: Date.now()
        };
    }
    const defaultStrategy =
        normalizedBatchFeature.strategies.find(
            (strategy) => strategy.id === normalizedBatchFeature.defaultStrategyId
        ) || normalizedBatchFeature.strategies.find((strategy) => strategy.id === 'auto');
    const planningMode = batchStrategyIdToPlanningMode(defaultStrategy?.id ?? 'auto');
    const countMode = defaultStrategy?.defaultCountMode ?? 'auto';
    const targetCount =
        countMode === 'fixed'
            ? (defaultStrategy?.defaultTargetCount ?? normalizedBatchFeature.defaultFixedTaskCount)
            : undefined;
    return {
        source: 'ai-plan',
        sourceText,
        sourceImageCount: currentSourceImageCount,
        sourceImageNames: currentSourceImageNames.slice(0, 12),
        planningMode,
        countMode,
        ...(targetCount !== undefined ? { targetCount } : {}),
        maxCount: defaultStrategy?.defaultMaxCount ?? normalizedBatchFeature.maxAutoTaskCount,
        adjustmentInstruction: '',
        updatedAt: Date.now()
    };
}

function serializeWarnings(warnings: BatchTaskBuildWarning[]): string[] {
    return warnings.map((warning) => JSON.stringify(warning));
}

function formatImportIssues(error: BatchTaskImportError): string {
    return error.issues?.map((issue) => `${issue.path}: ${issue.code}`).join('\n') || '';
}

function getFileRelativePath(file: File): string | undefined {
    const maybeFile = file as File & { webkitRelativePath?: string };
    return maybeFile.webkitRelativePath?.trim() || undefined;
}

function fileEntryToFile(entry: BrowserFileSystemFileEntry): Promise<File> {
    return new Promise((resolve, reject) => {
        entry.file(resolve, reject);
    });
}

function collectImageFilesFromFileList(files: File[]): CollectedImageFile[] {
    return files.filter(isImageFileLike).map((file) => ({
        file,
        ...(getFileRelativePath(file) ? { relativePath: getFileRelativePath(file) } : {})
    }));
}

function readDirectoryEntries(entry: BrowserFileSystemDirectoryEntry): Promise<BrowserFileSystemEntry[]> {
    const reader = entry.createReader();
    const entries: BrowserFileSystemEntry[] = [];

    return new Promise((resolve, reject) => {
        const readNext = () => {
            reader.readEntries((nextEntries) => {
                if (nextEntries.length === 0) {
                    resolve(entries);
                    return;
                }
                entries.push(...nextEntries);
                readNext();
            }, reject);
        };

        readNext();
    });
}

async function collectFilesFromEntry(entry: BrowserFileSystemEntry, parentPath = ''): Promise<CollectedImageFile[]> {
    if (entry.isFile) {
        const file = await fileEntryToFile(entry as BrowserFileSystemFileEntry);
        return [
            {
                file,
                ...(parentPath ? { relativePath: `${parentPath}/${entry.name}` } : {})
            }
        ];
    }
    if (!entry.isDirectory) return [];

    const childEntries = await readDirectoryEntries(entry as BrowserFileSystemDirectoryEntry);
    const nextParentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const nested = await Promise.all(
        childEntries.map((childEntry) => collectFilesFromEntry(childEntry, nextParentPath))
    );
    return nested.flat();
}

async function collectImageFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<CollectedImageFile[]> {
    const entries: BrowserFileSystemEntry[] = [];
    Array.from(dataTransfer.items ?? []).forEach((item) => {
        const entry = (item as BrowserDataTransferItemWithEntry).webkitGetAsEntry?.() ?? null;
        if (entry) entries.push(entry as unknown as BrowserFileSystemEntry);
    });

    if (entries.length > 0) {
        const nested = await Promise.all(entries.map((entry) => collectFilesFromEntry(entry)));
        return nested.flat().filter((item) => isImageFileLike(item.file));
    }

    return collectImageFilesFromFileList(Array.from(dataTransfer.files ?? []));
}

function buildRuntimeInput(item: CollectedImageFile, order: number): BatchImageEditRuntimeInput {
    const { file } = item;
    return {
        id: generateId('batch_input'),
        file,
        previewUrl: URL.createObjectURL(file),
        filename: file.name || `image-${order}`,
        ...(item.relativePath ? { relativePath: item.relativePath } : {}),
        mimeType: file.type || 'image/png',
        sizeBytes: file.size,
        order,
        status: 'ready'
    };
}

function summarizeImageEditInputs(inputs: BatchImageEditRuntimeInput[]): BatchImageEditInputSummary[] {
    return inputs.map((input) => ({
        id: input.id,
        filename: input.filename,
        ...(input.relativePath ? { relativePath: input.relativePath } : {}),
        mimeType: input.mimeType,
        ...(input.sizeBytes !== undefined ? { sizeBytes: input.sizeBytes } : {}),
        order: input.order,
        status: input.status,
        ...(input.warning ? { warning: input.warning } : {})
    }));
}

function formatFileSize(sizeBytes: number | undefined): string {
    if (sizeBytes === undefined) return '';
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function OptionCheckbox({
    id,
    label,
    checked,
    onCheckedChange
}: {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <label
            htmlFor={id}
            className='border-border bg-background/70 text-foreground dark:bg-panel-ghost flex items-center gap-2 rounded-lg border px-3 py-2 text-sm'>
            <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
            <span>{label}</span>
        </label>
    );
}

function clampCount(value: string, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(30, Math.round(parsed)));
}

function clampCountToLimit(value: string, fallback: number, limit: number): number {
    return Math.min(clampCount(value, fallback), clampCount(String(limit), MAX_BATCH_PLAN_COUNT));
}

function formatElapsedMs(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const fraction = Math.floor((ms % 1000) / 10);
    return `${seconds}.${fraction.toString().padStart(2, '0')}s`;
}

function isAiPlanningModeEnabled(batchFeature: BatchFeatureConfig, mode: BatchPlanningMode): boolean {
    return normalizeBatchFeatureConfig(batchFeature).strategies.some(
        (strategy) =>
            strategy.enabled &&
            strategy.executionType === 'ai-plan' &&
            batchStrategyIdToPlanningMode(strategy.id) === mode
    );
}

function BatchPlanningDialogBase({
    open,
    onOpenChange,
    currentPrompt,
    currentSourceImageCount,
    currentSourceImageNames,
    isPlanning,
    onPlan,
    onLocalPlan,
    onRecoverPrompt,
    batchFeature,
    hasBatchPlanningModel,
    onOpenBatchSettings
}: BatchPlanningDialogProps) {
    const { t } = useAppLanguage();
    const normalizedBatchFeature = React.useMemo(() => normalizeBatchFeatureConfig(batchFeature), [batchFeature]);
    const [draft, setDraft] = React.useState<BatchPlanDraft>(() =>
        buildDefaultDraft(currentPrompt, currentSourceImageCount, currentSourceImageNames, normalizedBatchFeature)
    );
    const [source, setSource] = React.useState<BatchPlanDraftSource>('ai-plan');
    const [planningMode, setPlanningMode] = React.useState<BatchPlanningMode>('auto');
    const [countMode, setCountMode] = React.useState<BatchCountMode>('auto');
    const [targetCount, setTargetCount] = React.useState(String(6));
    const [maxCount, setMaxCount] = React.useState(String(DEFAULT_BATCH_PLAN_MAX_COUNT));
    const [adjustmentInstruction, setAdjustmentInstruction] = React.useState('');
    const [manualSourceText, setManualSourceText] = React.useState(currentPrompt.trim());
    const [splitMode, setSplitMode] = React.useState<BatchTextSplitMode>('non-empty-lines');
    const [customDelimiter, setCustomDelimiter] = React.useState('---');
    const [trimWhitespace, setTrimWhitespace] = React.useState(true);
    const [ignoreEmpty, setIgnoreEmpty] = React.useState(true);
    const [collapseWhitespace, setCollapseWhitespace] = React.useState(false);
    const [preserveParagraphLineBreaks, setPreserveParagraphLineBreaks] = React.useState(true);
    const [promptPrefix, setPromptPrefix] = React.useState('');
    const [promptSuffix, setPromptSuffix] = React.useState('');
    const [jsonImportText, setJsonImportText] = React.useState('');
    const [imageEditPreset, setImageEditPreset] = React.useState<BatchImageEditPreset>('custom');
    const [imageEditInstruction, setImageEditInstruction] = React.useState(currentPrompt.trim());
    const [imageEditInputs, setImageEditInputs] = React.useState<BatchImageEditRuntimeInput[]>([]);
    const imageEditInputsRef = React.useRef<BatchImageEditRuntimeInput[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const folderInputRef = React.useRef<HTMLInputElement | null>(null);
    const [localError, setLocalError] = React.useState<string | null>(null);
    const [acknowledgedDraftUpdatedAt, setAcknowledgedDraftUpdatedAt] = React.useState<number | null>(null);
    const [isGeneratingElapsed, setIsGeneratingElapsed] = React.useState(0);
    const generationStartedAtRef = React.useRef<number | null>(null);
    const sourceText = currentPrompt.trim();
    const readyImageEditInputCount = imageEditInputs.filter((input) => input.status === 'ready').length;
    const canSubmit =
        !isPlanning &&
        (source === 'json-import'
            ? jsonImportText.trim().length > 0
            : source === 'manual-split'
              ? manualSourceText.trim().length > 0
              : source === 'image-edit-batch'
                ? readyImageEditInputCount > 0 &&
                  (imageEditPreset !== 'custom' || imageEditInstruction.trim().length > 0)
                : Boolean(sourceText) &&
                  hasBatchPlanningModel &&
                  (countMode === 'auto' || targetCount.trim().length > 0));
    const enabledStrategies = React.useMemo(
        () => normalizedBatchFeature.strategies.filter((strategy) => strategy.enabled),
        [normalizedBatchFeature.strategies]
    );

    React.useEffect(() => {
        imageEditInputsRef.current = imageEditInputs;
    }, [imageEditInputs]);

    React.useEffect(() => {
        const folderInput = folderInputRef.current;
        folderInput?.setAttribute('webkitdirectory', '');
        folderInput?.setAttribute('directory', '');
        return () => {
            imageEditInputsRef.current.forEach((input) => URL.revokeObjectURL(input.previewUrl));
        };
    }, []);

    const syncStateFromDraft = React.useCallback(
        (nextDraft: BatchPlanDraft | null) => {
            const sourceDraft =
                nextDraft ??
                buildDefaultDraft(
                    currentPrompt,
                    currentSourceImageCount,
                    currentSourceImageNames,
                    normalizedBatchFeature
                );
            setDraft(sourceDraft);
            setSource(sourceDraft.source);
            setPlanningMode(
                sourceDraft.planningMode === 'image-edit-batch'
                    ? 'image-edit-batch'
                    : isAiPlanningModeEnabled(normalizedBatchFeature, sourceDraft.planningMode)
                      ? sourceDraft.planningMode
                      : batchStrategyIdToPlanningMode(normalizedBatchFeature.defaultStrategyId)
            );
            setCountMode(sourceDraft.countMode);
            setTargetCount(
                typeof sourceDraft.targetCount === 'number'
                    ? String(sourceDraft.targetCount)
                    : String(normalizedBatchFeature.defaultFixedTaskCount)
            );
            setMaxCount(String(sourceDraft.maxCount || DEFAULT_BATCH_PLAN_MAX_COUNT));
            setAdjustmentInstruction(sourceDraft.adjustmentInstruction);
            setManualSourceText(sourceDraft.sourceText || currentPrompt.trim());
            setSplitMode(sourceDraft.splitMode || 'non-empty-lines');
            setCustomDelimiter(sourceDraft.customDelimiter || '---');
            setTrimWhitespace(sourceDraft.trimWhitespace !== false);
            setIgnoreEmpty(sourceDraft.ignoreEmpty !== false);
            setCollapseWhitespace(sourceDraft.collapseWhitespace === true);
            setPreserveParagraphLineBreaks(sourceDraft.preserveParagraphLineBreaks !== false);
            setPromptPrefix(sourceDraft.promptPrefix || '');
            setPromptSuffix(sourceDraft.promptSuffix || '');
            setJsonImportText(sourceDraft.jsonImportText || '');
            setImageEditPreset(sourceDraft.imageEditPreset || 'custom');
            setImageEditInstruction(sourceDraft.imageEditInstruction || sourceDraft.sourceText || currentPrompt.trim());
            setImageEditInputs((currentInputs) => {
                const hasRuntimeInputs = currentInputs.some((input) => input.file instanceof File);
                if (hasRuntimeInputs) return currentInputs;
                return [];
            });
        },
        [currentPrompt, currentSourceImageCount, currentSourceImageNames, normalizedBatchFeature]
    );

    React.useEffect(() => {
        if (!open) return;
        const stored = loadBatchPlanDraft();
        syncStateFromDraft(stored);
        setLocalError(null);
    }, [open, syncStateFromDraft]);

    const persistDraft = React.useCallback(
        (patch?: Partial<BatchPlanDraft>) => {
            const stored = loadBatchPlanDraft();
            const nextPlanningMode = patch?.planningMode ?? planningMode;
            const nextCountMode = patch?.countMode ?? countMode;
            const hasTargetCountPatch = patch ? Object.prototype.hasOwnProperty.call(patch, 'targetCount') : false;
            const nextTargetCount = hasTargetCountPatch
                ? patch?.targetCount
                : nextCountMode === 'fixed' && targetCount.trim()
                  ? clampCount(targetCount, 6)
                  : undefined;
            const nextAdjustmentInstruction = patch?.adjustmentInstruction ?? adjustmentInstruction.trim();
            const nextSourceText =
                patch?.sourceText ??
                (source === 'manual-split'
                    ? manualSourceText
                    : source === 'image-edit-batch'
                      ? imageEditInstruction
                      : sourceText);
            const nextDraft: BatchPlanDraft = {
                ...(stored ?? draft),
                source,
                sourceText: nextSourceText,
                sourceImageCount: currentSourceImageCount,
                sourceImageNames: currentSourceImageNames.slice(0, 12),
                planningMode: nextPlanningMode,
                countMode: nextCountMode,
                maxCount: patch?.maxCount ?? clampCount(maxCount, DEFAULT_BATCH_PLAN_MAX_COUNT),
                adjustmentInstruction: nextAdjustmentInstruction,
                splitMode,
                customDelimiter,
                trimWhitespace,
                ignoreEmpty,
                collapseWhitespace,
                preserveParagraphLineBreaks,
                promptPrefix,
                promptSuffix,
                jsonImportText,
                imageEditPreset,
                imageEditInstruction,
                imageEditInputSummaries: summarizeImageEditInputs(imageEditInputs),
                imageEditSharedReferenceCount: currentSourceImageCount,
                updatedAt: Date.now(),
                ...(patch ?? {})
            } as BatchPlanDraft;
            if (nextTargetCount !== undefined) nextDraft.targetCount = nextTargetCount;
            else delete (nextDraft as Partial<BatchPlanDraft>).targetCount;
            saveBatchPlanDraft(nextDraft);
            setDraft(nextDraft);
            setAcknowledgedDraftUpdatedAt(nextDraft.updatedAt);
        },
        [
            adjustmentInstruction,
            collapseWhitespace,
            countMode,
            currentSourceImageCount,
            currentSourceImageNames,
            customDelimiter,
            draft,
            ignoreEmpty,
            imageEditInputs,
            imageEditInstruction,
            imageEditPreset,
            jsonImportText,
            manualSourceText,
            maxCount,
            planningMode,
            preserveParagraphLineBreaks,
            promptPrefix,
            promptSuffix,
            source,
            sourceText,
            splitMode,
            targetCount,
            trimWhitespace
        ]
    );

    const handleRecoverDraft = React.useCallback(() => {
        const stored = loadBatchPlanDraft();
        if (!stored) return;
        syncStateFromDraft(stored);
        setAcknowledgedDraftUpdatedAt(stored.updatedAt);
        onRecoverPrompt(stored.sourceText);
    }, [onRecoverPrompt, syncStateFromDraft]);

    const handleDiscardDraft = React.useCallback(() => {
        clearBatchPlanDraft();
        syncStateFromDraft(null);
        setAcknowledgedDraftUpdatedAt(null);
        setLocalError(null);
        generationStartedAtRef.current = null;
        setIsGeneratingElapsed(0);
    }, [syncStateFromDraft]);

    const addImageEditFiles = React.useCallback(
        (files: CollectedImageFile[]) => {
            const imageFiles = files.filter((item) => isImageFileLike(item.file));
            if (imageFiles.length === 0) {
                setLocalError(t('batch.imageEdit.error.noImageFiles'));
                return;
            }

            setLocalError(null);
            setImageEditInputs((currentInputs) => {
                const remainingSlots = Math.max(0, MAX_BATCH_IMAGE_EDIT_INPUTS - currentInputs.length);
                const acceptedFiles = imageFiles.slice(0, remainingSlots);
                const omittedCount = imageFiles.length - acceptedFiles.length;
                if (omittedCount > 0) {
                    setLocalError(t('batch.imageEdit.warning.inputLimit', { count: MAX_BATCH_IMAGE_EDIT_INPUTS }));
                }
                const nextInputs = [
                    ...currentInputs,
                    ...acceptedFiles.map((file, index) => buildRuntimeInput(file, currentInputs.length + index + 1))
                ].map((input, index) => ({ ...input, order: index + 1 }));
                return nextInputs;
            });
        },
        [t]
    );

    const removeImageEditInput = React.useCallback((inputId: string) => {
        setImageEditInputs((currentInputs) => {
            const removed = currentInputs.find((input) => input.id === inputId);
            if (removed) URL.revokeObjectURL(removed.previewUrl);
            return currentInputs
                .filter((input) => input.id !== inputId)
                .map((input, index) => ({ ...input, order: index + 1 }));
        });
    }, []);

    const clearImageEditInputs = React.useCallback(() => {
        setImageEditInputs((currentInputs) => {
            currentInputs.forEach((input) => URL.revokeObjectURL(input.previewUrl));
            return [];
        });
    }, []);

    const handleImageEditFileInput = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            addImageEditFiles(collectImageFilesFromFileList(Array.from(event.target.files ?? [])));
            event.target.value = '';
        },
        [addImageEditFiles]
    );

    const handleImageEditDrop = React.useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            const dataTransfer = event.dataTransfer;
            void collectImageFilesFromDataTransfer(dataTransfer)
                .then((files) => addImageEditFiles(files))
                .catch((error) => {
                    console.warn('[batch-planning-dialog] failed to read dropped files', error);
                    addImageEditFiles(collectImageFilesFromFileList(Array.from(dataTransfer.files ?? [])));
                });
        },
        [addImageEditFiles]
    );

    React.useEffect(() => {
        if (!isPlanning) {
            generationStartedAtRef.current = null;
            setIsGeneratingElapsed(0);
            return;
        }

        if (generationStartedAtRef.current === null) {
            generationStartedAtRef.current = Date.now();
        }

        const tick = () => {
            const startedAt = generationStartedAtRef.current ?? Date.now();
            setIsGeneratingElapsed(Date.now() - startedAt);
        };

        tick();
        const interval = window.setInterval(tick, 250);
        return () => window.clearInterval(interval);
    }, [isPlanning]);

    const handleSubmit = React.useCallback(async () => {
        if (!canSubmit) return;
        setLocalError(null);

        const resolvedCountMode = countMode;
        const resolvedTargetCount =
            resolvedCountMode === 'fixed'
                ? clampCountToLimit(
                      targetCount,
                      normalizedBatchFeature.defaultFixedTaskCount,
                      normalizedBatchFeature.maxPreviewTaskCount
                  )
                : undefined;
        const resolvedMaxCount = clampCountToLimit(
            maxCount,
            normalizedBatchFeature.maxAutoTaskCount,
            normalizedBatchFeature.maxPreviewTaskCount
        );
        if (source === 'image-edit-batch') {
            try {
                const plan = buildBatchImageEditPlan({
                    inputs: imageEditInputs,
                    sharedReferenceImageCount: currentSourceImageCount,
                    instruction: imageEditInstruction,
                    preset: imageEditPreset,
                    maxTasks: normalizedBatchFeature.maxPreviewTaskCount
                });
                const nextDraft: BatchPlanDraft = {
                    source: 'image-edit-batch',
                    sourceText: imageEditInstruction.trim(),
                    sourceImageCount: currentSourceImageCount,
                    sourceImageNames: currentSourceImageNames.slice(0, 12),
                    planningMode: 'image-edit-batch',
                    countMode: 'fixed',
                    targetCount: plan.tasks.length,
                    maxCount: normalizedBatchFeature.maxPreviewTaskCount,
                    adjustmentInstruction: '',
                    imageEditPreset,
                    imageEditInstruction,
                    imageEditInputSummaries: summarizeImageEditInputs(imageEditInputs),
                    imageEditSharedReferenceCount: currentSourceImageCount,
                    preview: plan,
                    updatedAt: Date.now()
                };
                saveBatchPlanDraft(nextDraft);
                setDraft(nextDraft);
                setAcknowledgedDraftUpdatedAt(nextDraft.updatedAt);
                onLocalPlan(nextDraft, { inputs: imageEditInputs });
                onOpenChange(false);
            } catch (error) {
                const messageKey = error instanceof Error ? error.message : 'batch.imageEdit.error.buildFailed';
                setLocalError(t(messageKey));
            }
            return;
        }

        if (source === 'manual-split' || source === 'json-import') {
            try {
                const result =
                    source === 'manual-split'
                        ? buildManualSplitBatchPlan({
                              sourceText: manualSourceText,
                              sourceImageCount: currentSourceImageCount,
                              splitMode,
                              customDelimiter,
                              trimWhitespace,
                              ignoreEmpty,
                              collapseWhitespace,
                              preserveParagraphLineBreaks,
                              prefix: promptPrefix,
                              suffix: promptSuffix,
                              maxTasks: normalizedBatchFeature.maxPreviewTaskCount
                          })
                        : parseBatchTaskImportJson({
                              jsonText: jsonImportText,
                              currentSourceImageCount,
                              maxTasks: normalizedBatchFeature.maxPreviewTaskCount
                          });
                const plan: BatchPlan = {
                    ...result.plan,
                    warnings: serializeWarnings(result.warnings)
                };
                const nextDraft: BatchPlanDraft = {
                    source,
                    sourceText: source === 'json-import' ? plan.sourceText : manualSourceText.trim(),
                    sourceImageCount: currentSourceImageCount,
                    sourceImageNames: currentSourceImageNames.slice(0, 12),
                    planningMode: source === 'manual-split' ? 'manual-split' : 'json-import',
                    countMode: 'fixed',
                    targetCount: plan.tasks.length,
                    maxCount: resolvedMaxCount,
                    adjustmentInstruction: '',
                    splitMode,
                    customDelimiter,
                    trimWhitespace,
                    ignoreEmpty,
                    collapseWhitespace,
                    preserveParagraphLineBreaks,
                    promptPrefix,
                    promptSuffix,
                    jsonImportText,
                    preview: plan,
                    updatedAt: Date.now()
                };
                saveBatchPlanDraft(nextDraft);
                setDraft(nextDraft);
                setAcknowledgedDraftUpdatedAt(nextDraft.updatedAt);
                onLocalPlan(nextDraft);
                onOpenChange(false);
            } catch (error) {
                if (error instanceof BatchTaskImportError) {
                    const details = formatImportIssues(error);
                    const message = t(`batch.local.error.${error.code}`, {
                        line: error.line ?? 0,
                        column: error.column ?? 0,
                        schemaVersion: error.schemaVersion || '',
                        details
                    });
                    setLocalError(details ? `${message}\n${details}` : message);
                } else {
                    const message = error instanceof Error ? error.message : t('batch.dialog.submitError');
                    setLocalError(message);
                }
            }
            return;
        }

        persistDraft({
            source: 'ai-plan',
            sourceText,
            sourceImageCount: currentSourceImageCount,
            sourceImageNames: currentSourceImageNames.slice(0, 12),
            planningMode,
            countMode: resolvedCountMode,
            ...(resolvedTargetCount !== undefined ? { targetCount: resolvedTargetCount } : {}),
            maxCount: resolvedMaxCount,
            adjustmentInstruction: adjustmentInstruction.trim(),
            updatedAt: Date.now()
        });

        try {
            await onPlan({
                planningMode,
                countMode: resolvedCountMode,
                ...(resolvedTargetCount !== undefined ? { targetCount: resolvedTargetCount } : {}),
                maxCount: resolvedMaxCount,
                adjustmentInstruction: adjustmentInstruction.trim()
            });
            onOpenChange(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('batch.dialog.submitError');
            setLocalError(message);
        }
    }, [
        adjustmentInstruction,
        canSubmit,
        collapseWhitespace,
        countMode,
        currentSourceImageCount,
        currentSourceImageNames,
        customDelimiter,
        ignoreEmpty,
        imageEditInputs,
        imageEditInstruction,
        imageEditPreset,
        jsonImportText,
        manualSourceText,
        onLocalPlan,
        onOpenChange,
        onPlan,
        persistDraft,
        planningMode,
        preserveParagraphLineBreaks,
        promptPrefix,
        promptSuffix,
        maxCount,
        source,
        sourceText,
        splitMode,
        targetCount,
        trimWhitespace,
        t,
        normalizedBatchFeature.defaultFixedTaskCount,
        normalizedBatchFeature.maxAutoTaskCount,
        normalizedBatchFeature.maxPreviewTaskCount
    ]);

    const recoverableDraft = loadBatchPlanDraft();
    const shouldShowRecoverBanner =
        Boolean(recoverableDraft) && recoverableDraft?.updatedAt !== acknowledgedDraftUpdatedAt;
    const enabledPreviewCount = readPreviewCount(recoverableDraft);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='border-border bg-background text-foreground top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden overscroll-contain rounded-none p-0 shadow-xl sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[min(860px,calc(100vw-2rem))] sm:max-w-[860px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl'>
                <div className='flex min-h-0 flex-1 flex-col'>
                    <DialogHeader className='border-border border-b px-4 py-4 pr-12 sm:px-5 sm:pr-14'>
                        <DialogTitle className='flex items-center gap-2 text-lg'>
                            <Layers3 className='h-5 w-5 text-violet-500 dark:text-violet-200/80' />
                            {t('batch.dialog.title')}
                        </DialogTitle>
                        <DialogDescription className='text-muted-foreground mt-1 text-sm leading-6'>
                            {t('batch.dialog.description')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5'>
                        {shouldShowRecoverBanner && recoverableDraft && (
                            <div className='border-border bg-card mb-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm'>
                                <span className='text-muted-foreground flex min-w-0 items-center gap-2'>
                                    <RotateCcw className='h-4 w-4 shrink-0' />
                                    <span className='truncate'>
                                        {t('batch.draft.banner', { count: enabledPreviewCount })}
                                    </span>
                                </span>
                                <div className='flex shrink-0 items-center gap-2'>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleRecoverDraft}
                                        className='h-7 rounded-md px-2 text-xs'>
                                        {t('batch.draft.recover')}
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={handleDiscardDraft}
                                        className='text-muted-foreground h-7 rounded-md px-2 text-xs'>
                                        {t('batch.draft.discard')}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <Tabs
                            value={source}
                            onValueChange={(value) => {
                                const next = value as BatchPlanDraftSource;
                                if (
                                    next === 'manual-split' &&
                                    !enabledStrategies.some((strategy) => strategy.id === 'manual-split')
                                ) {
                                    return;
                                }
                                if (
                                    next === 'json-import' &&
                                    !enabledStrategies.some((strategy) => strategy.id === 'json-import')
                                ) {
                                    return;
                                }
                                setSource(next);
                                setLocalError(null);
                                persistDraft({
                                    source: next,
                                    updatedAt: Date.now()
                                });
                            }}
                            className='mb-4'>
                            <TabsList className='border-border bg-card grid h-auto w-full grid-cols-2 gap-1 rounded-xl border p-1 sm:grid-cols-4'>
                                <TabsTrigger value='ai-plan' className='gap-1 rounded-lg px-2 py-2 text-xs sm:text-sm'>
                                    <Sparkles className='h-4 w-4' />
                                    {t('batch.source.ai')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value='image-edit-batch'
                                    className='gap-1 rounded-lg px-2 py-2 text-xs sm:text-sm'>
                                    <FileImage className='h-4 w-4' />
                                    {t('batch.source.imageEdit')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value='manual-split'
                                    disabled={!enabledStrategies.some((strategy) => strategy.id === 'manual-split')}
                                    className='gap-1 rounded-lg px-2 py-2 text-xs sm:text-sm'>
                                    <FileText className='h-4 w-4' />
                                    {t('batch.source.manual')}
                                </TabsTrigger>
                                <TabsTrigger
                                    value='json-import'
                                    disabled={!enabledStrategies.some((strategy) => strategy.id === 'json-import')}
                                    className='gap-1 rounded-lg px-2 py-2 text-xs sm:text-sm'>
                                    <Braces className='h-4 w-4' />
                                    {t('batch.source.json')}
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]'>
                            <div className='space-y-4'>
                                <div className='border-border bg-card rounded-xl border p-3'>
                                    <div className='flex items-center justify-between gap-2'>
                                        <Label className='text-foreground text-sm font-medium'>
                                            {t(
                                                source === 'json-import'
                                                    ? 'batch.dialog.jsonSourceTitle'
                                                    : source === 'image-edit-batch'
                                                      ? 'batch.imageEdit.sourceTitle'
                                                      : 'batch.dialog.sourceTitle'
                                            )}
                                        </Label>
                                        <span className='text-muted-foreground text-xs'>
                                            {t('batch.dialog.sourceCount', { count: currentSourceImageCount })}
                                        </span>
                                    </div>
                                    {source === 'json-import' ? (
                                        <p className='text-muted-foreground mt-2 text-sm leading-6'>
                                            {t('batch.dialog.jsonSourceHint')}
                                        </p>
                                    ) : source === 'image-edit-batch' ? (
                                        <p className='text-muted-foreground mt-2 text-sm leading-6'>
                                            {t('batch.imageEdit.sourceHint', {
                                                count: readyImageEditInputCount,
                                                refs: currentSourceImageCount
                                            })}
                                        </p>
                                    ) : (
                                        <p
                                            className='text-muted-foreground mt-2 line-clamp-4 text-sm leading-6'
                                            data-i18n-skip='true'>
                                            {sourceText || t('batch.dialog.emptySource')}
                                        </p>
                                    )}
                                    {currentSourceImageCount > 0 && (
                                        <p
                                            className='text-muted-foreground mt-2 line-clamp-2 text-xs leading-5'
                                            data-i18n-skip='true'>
                                            {currentSourceImageNames.length > 0
                                                ? currentSourceImageNames.join(' · ')
                                                : t('batch.dialog.sourceImagesAttached', {
                                                      count: currentSourceImageCount
                                                  })}
                                        </p>
                                    )}
                                </div>

                                {source === 'ai-plan' && (
                                    <>
                                        {!hasBatchPlanningModel && (
                                            <div className='flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200'>
                                                <ConfigurationRequiredActions
                                                    onConfigure={onOpenBatchSettings}
                                                    actionClassName='hover:text-amber-950 dark:hover:text-amber-50'
                                                />
                                            </div>
                                        )}
                                        <div className='grid gap-4 sm:grid-cols-2'>
                                            <div className='space-y-1.5'>
                                                <Label className='text-foreground'>
                                                    {t('batch.dialog.planningMode')}
                                                </Label>
                                                <Select
                                                    value={planningMode}
                                                    onValueChange={(value) => {
                                                        const next = value as BatchPlanningMode;
                                                        setPlanningMode(next);
                                                        persistDraft({
                                                            planningMode: next,
                                                            updatedAt: Date.now()
                                                        });
                                                    }}>
                                                    <SelectTrigger className='border-border bg-background text-foreground h-10 rounded-xl'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {enabledStrategies
                                                            .filter((strategy) => strategy.executionType === 'ai-plan')
                                                            .map((strategy) => (
                                                                <SelectItem
                                                                    key={strategy.id}
                                                                    value={batchStrategyIdToPlanningMode(strategy.id)}>
                                                                    {t(strategy.labelKey)}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className='space-y-1.5'>
                                                <Label className='text-foreground'>{t('batch.dialog.countMode')}</Label>
                                                <RadioGroup
                                                    value={countMode}
                                                    onValueChange={(value) => {
                                                        const next = value as BatchCountMode;
                                                        setCountMode(next);
                                                        persistDraft({
                                                            countMode: next,
                                                            updatedAt: Date.now()
                                                        });
                                                    }}
                                                    className='grid grid-cols-2 gap-2'>
                                                    <label
                                                        className={cn(
                                                            'border-border flex items-center gap-2 rounded-xl border px-3 py-2',
                                                            countMode === 'auto' &&
                                                                'border-violet-500/50 bg-violet-500/10'
                                                        )}>
                                                        <RadioGroupItem value='auto' />
                                                        <span className='text-foreground text-sm'>
                                                            {t('batch.dialog.countAuto')}
                                                        </span>
                                                    </label>
                                                    <label
                                                        className={cn(
                                                            'border-border flex items-center gap-2 rounded-xl border px-3 py-2',
                                                            countMode === 'fixed' &&
                                                                'border-violet-500/50 bg-violet-500/10'
                                                        )}>
                                                        <RadioGroupItem value='fixed' />
                                                        <span className='text-foreground text-sm'>
                                                            {t('batch.dialog.countFixed')}
                                                        </span>
                                                    </label>
                                                </RadioGroup>
                                            </div>
                                        </div>

                                        {countMode === 'fixed' ? (
                                            <div className='space-y-1.5'>
                                                <Label htmlFor='batch-target-count' className='text-foreground'>
                                                    {t('batch.dialog.targetCount')}
                                                </Label>
                                                <Input
                                                    id='batch-target-count'
                                                    type='number'
                                                    min={MIN_BATCH_PLAN_COUNT}
                                                    max={MAX_BATCH_PLAN_COUNT}
                                                    value={targetCount}
                                                    onChange={(event) => {
                                                        const next = event.target.value;
                                                        setTargetCount(next);
                                                        persistDraft({
                                                            targetCount: next.trim() ? clampCount(next, 6) : undefined,
                                                            updatedAt: Date.now()
                                                        });
                                                    }}
                                                    className='border-border bg-background text-foreground h-10 rounded-xl'
                                                />
                                                <p className='text-muted-foreground text-xs leading-5'>
                                                    {t('batch.dialog.targetCountHint')}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className='space-y-1.5'>
                                                <Label htmlFor='batch-max-count' className='text-foreground'>
                                                    {t('batch.dialog.maxCount')}
                                                </Label>
                                                <Input
                                                    id='batch-max-count'
                                                    type='number'
                                                    min={MIN_BATCH_PLAN_COUNT}
                                                    max={MAX_BATCH_PLAN_COUNT}
                                                    value={maxCount}
                                                    onChange={(event) => {
                                                        const next = event.target.value;
                                                        setMaxCount(next);
                                                        persistDraft({
                                                            maxCount: clampCount(next, DEFAULT_BATCH_PLAN_MAX_COUNT),
                                                            updatedAt: Date.now()
                                                        });
                                                    }}
                                                    className='border-border bg-background text-foreground h-10 rounded-xl'
                                                />
                                                <p className='text-muted-foreground text-xs leading-5'>
                                                    {t('batch.dialog.maxCountHint')}
                                                </p>
                                            </div>
                                        )}

                                        <div className='space-y-1.5'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <Label htmlFor='batch-adjustment' className='text-foreground'>
                                                    {t('batch.dialog.adjustment')}
                                                </Label>
                                                <span className='text-muted-foreground text-xs'>
                                                    {t('batch.dialog.adjustmentHint')}
                                                </span>
                                            </div>
                                            <Textarea
                                                id='batch-adjustment'
                                                value={adjustmentInstruction}
                                                onChange={(event) => {
                                                    const next = event.target.value;
                                                    setAdjustmentInstruction(next);
                                                    persistDraft({
                                                        adjustmentInstruction: next,
                                                        updatedAt: Date.now()
                                                    });
                                                }}
                                                placeholder={t('batch.dialog.adjustmentPlaceholder')}
                                                className='border-border bg-background text-foreground min-h-36 rounded-xl text-sm'
                                            />
                                        </div>
                                    </>
                                )}

                                {source === 'image-edit-batch' && (
                                    <>
                                        <div className='grid gap-4 sm:grid-cols-2'>
                                            <div className='space-y-1.5'>
                                                <Label className='text-foreground'>{t('batch.imageEdit.preset')}</Label>
                                                <Select
                                                    value={imageEditPreset}
                                                    onValueChange={(value) => {
                                                        const next = value as BatchImageEditPreset;
                                                        const nextInstruction =
                                                            next === 'custom'
                                                                ? imageEditInstruction
                                                                : getBatchImageEditPresetInstruction(next);
                                                        setImageEditPreset(next);
                                                        setImageEditInstruction(nextInstruction);
                                                        persistDraft({
                                                            imageEditPreset: next,
                                                            imageEditInstruction: nextInstruction,
                                                            sourceText: nextInstruction,
                                                            planningMode: 'image-edit-batch',
                                                            source: 'image-edit-batch',
                                                            updatedAt: Date.now()
                                                        });
                                                    }}>
                                                    <SelectTrigger className='border-border bg-background text-foreground h-10 rounded-xl'>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='custom'>
                                                            {t('batch.imageEdit.preset.custom')}
                                                        </SelectItem>
                                                        <SelectItem value='style-transfer'>
                                                            {t('batch.imageEdit.preset.styleTransfer')}
                                                        </SelectItem>
                                                        <SelectItem value='photo-restore'>
                                                            {t('batch.imageEdit.preset.photoRestore')}
                                                        </SelectItem>
                                                        <SelectItem value='enhance'>
                                                            {t('batch.imageEdit.preset.enhance')}
                                                        </SelectItem>
                                                        <SelectItem value='background-rework'>
                                                            {t('batch.imageEdit.preset.backgroundRework')}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className='space-y-1.5'>
                                                <Label className='text-foreground'>
                                                    {t('batch.imageEdit.sharedReferences')}
                                                </Label>
                                                <div className='border-border bg-background text-muted-foreground flex h-10 items-center rounded-xl border px-3 text-sm'>
                                                    {t('batch.imageEdit.sharedReferenceCount', {
                                                        count: currentSourceImageCount
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className='space-y-1.5'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <Label
                                                    htmlFor='batch-image-edit-instruction'
                                                    className='text-foreground'>
                                                    {t('batch.imageEdit.instruction')}
                                                </Label>
                                                <span className='text-muted-foreground text-xs'>
                                                    {imageEditPreset === 'custom'
                                                        ? t('batch.imageEdit.instructionRequired')
                                                        : t('batch.dialog.adjustmentHint')}
                                                </span>
                                            </div>
                                            <Textarea
                                                id='batch-image-edit-instruction'
                                                value={imageEditInstruction}
                                                onChange={(event) => {
                                                    const next = event.target.value;
                                                    setImageEditInstruction(next);
                                                    persistDraft({
                                                        source: 'image-edit-batch',
                                                        sourceText: next,
                                                        imageEditInstruction: next,
                                                        planningMode: 'image-edit-batch',
                                                        updatedAt: Date.now()
                                                    });
                                                }}
                                                placeholder={t('batch.imageEdit.instructionPlaceholder')}
                                                className='border-border bg-background text-foreground min-h-28 rounded-xl text-sm'
                                            />
                                        </div>

                                        <div
                                            role='button'
                                            tabIndex={0}
                                            onClick={() => fileInputRef.current?.click()}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    fileInputRef.current?.click();
                                                }
                                            }}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                            }}
                                            onDrop={handleImageEditDrop}
                                            className='border-border bg-background/70 hover:bg-accent/40 dark:bg-panel-ghost flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-5 text-center transition-colors'>
                                            <UploadCloud className='text-muted-foreground h-6 w-6' />
                                            <div>
                                                <p className='text-foreground text-sm font-medium'>
                                                    {t('batch.imageEdit.dropTitle')}
                                                </p>
                                                <p className='text-muted-foreground mt-1 text-xs leading-5'>
                                                    {t('batch.imageEdit.dropDescription', {
                                                        count: MAX_BATCH_IMAGE_EDIT_INPUTS
                                                    })}
                                                </p>
                                            </div>
                                            <div className='flex flex-wrap items-center justify-center gap-2'>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        fileInputRef.current?.click();
                                                    }}
                                                    className='h-8 rounded-lg px-2 text-xs'>
                                                    {t('batch.imageEdit.chooseFiles')}
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        folderInputRef.current?.click();
                                                    }}
                                                    className='h-8 rounded-lg px-2 text-xs'>
                                                    {t('batch.imageEdit.chooseFolder')}
                                                </Button>
                                            </div>
                                            <input
                                                ref={fileInputRef}
                                                type='file'
                                                accept='image/*'
                                                multiple
                                                className='hidden'
                                                onChange={handleImageEditFileInput}
                                            />
                                            <input
                                                ref={folderInputRef}
                                                type='file'
                                                accept='image/*'
                                                multiple
                                                className='hidden'
                                                onChange={handleImageEditFileInput}
                                            />
                                        </div>

                                        {imageEditInputs.length > 0 && (
                                            <div className='border-border bg-card overflow-hidden rounded-xl border'>
                                                <div className='border-border flex items-center justify-between gap-3 border-b px-3 py-2'>
                                                    <div className='min-w-0'>
                                                        <p className='text-foreground text-sm font-medium'>
                                                            {t('batch.imageEdit.inputList', {
                                                                count: readyImageEditInputCount
                                                            })}
                                                        </p>
                                                        <p className='text-muted-foreground truncate text-xs'>
                                                            {t('batch.imageEdit.inputListHint')}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='sm'
                                                        onClick={clearImageEditInputs}
                                                        className='text-muted-foreground h-8 rounded-lg px-2 text-xs'>
                                                        {t('tasks.clearFailed')}
                                                    </Button>
                                                </div>
                                                <div className='max-h-72 overflow-y-auto p-2'>
                                                    <div className='grid gap-2'>
                                                        {imageEditInputs.map((input) => (
                                                            <div
                                                                key={input.id}
                                                                className='border-border bg-background/70 flex min-w-0 items-center gap-3 rounded-lg border p-2'>
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={input.previewUrl}
                                                                    alt=''
                                                                    className='bg-muted h-12 w-12 shrink-0 rounded-md object-cover'
                                                                />
                                                                <div className='min-w-0 flex-1'>
                                                                    <p
                                                                        className='text-foreground truncate text-sm font-medium'
                                                                        title={input.relativePath || input.filename}
                                                                        data-i18n-skip='true'>
                                                                        {input.relativePath || input.filename}
                                                                    </p>
                                                                    <p className='text-muted-foreground mt-0.5 text-xs'>
                                                                        {formatFileSize(input.sizeBytes)}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    type='button'
                                                                    variant='ghost'
                                                                    size='icon'
                                                                    onClick={() => removeImageEditInput(input.id)}
                                                                    className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0 rounded-lg'
                                                                    aria-label={t('batch.imageEdit.removeInput')}>
                                                                    <Trash2 className='h-4 w-4' />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {source === 'manual-split' && (
                                    <>
                                        <div className='space-y-1.5'>
                                            <Label htmlFor='batch-manual-source' className='text-foreground'>
                                                {t('batch.manual.sourceText')}
                                            </Label>
                                            <Textarea
                                                id='batch-manual-source'
                                                value={manualSourceText}
                                                onChange={(event) => {
                                                    const next = event.target.value;
                                                    setManualSourceText(next);
                                                    persistDraft({ sourceText: next, updatedAt: Date.now() });
                                                }}
                                                placeholder={t('batch.manual.sourcePlaceholder')}
                                                className='border-border bg-background text-foreground min-h-40 rounded-xl text-sm leading-5'
                                                data-i18n-skip='true'
                                            />
                                        </div>
                                        <div className='space-y-1.5'>
                                            <Label className='text-foreground'>{t('batch.manual.splitMode')}</Label>
                                            <Select
                                                value={splitMode}
                                                onValueChange={(value) => {
                                                    const next = value as BatchTextSplitMode;
                                                    setSplitMode(next);
                                                    persistDraft({ splitMode: next, updatedAt: Date.now() });
                                                }}>
                                                <SelectTrigger className='border-border bg-background text-foreground h-10 rounded-xl'>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value='non-empty-lines'>
                                                        {t('batch.manual.mode.nonEmptyLines')}
                                                    </SelectItem>
                                                    <SelectItem value='blank-lines'>
                                                        {t('batch.manual.mode.blankLines')}
                                                    </SelectItem>
                                                    <SelectItem value='custom-delimiter'>
                                                        {t('batch.manual.mode.customDelimiter')}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {splitMode === 'custom-delimiter' && (
                                            <div className='space-y-1.5'>
                                                <Label htmlFor='batch-custom-delimiter' className='text-foreground'>
                                                    {t('batch.manual.customDelimiter')}
                                                </Label>
                                                <Input
                                                    id='batch-custom-delimiter'
                                                    value={customDelimiter}
                                                    onChange={(event) => {
                                                        const next = event.target.value;
                                                        setCustomDelimiter(next);
                                                        persistDraft({
                                                            customDelimiter: next,
                                                            updatedAt: Date.now()
                                                        });
                                                    }}
                                                    placeholder='---'
                                                    className='border-border bg-background text-foreground h-10 rounded-xl'
                                                    data-i18n-skip='true'
                                                />
                                            </div>
                                        )}
                                        <div className='grid gap-2 sm:grid-cols-2'>
                                            <OptionCheckbox
                                                id='batch-trim-whitespace'
                                                label={t('batch.manual.trimWhitespace')}
                                                checked={trimWhitespace}
                                                onCheckedChange={(checked) => {
                                                    setTrimWhitespace(checked);
                                                    persistDraft({ trimWhitespace: checked, updatedAt: Date.now() });
                                                }}
                                            />
                                            <OptionCheckbox
                                                id='batch-ignore-empty'
                                                label={t('batch.manual.ignoreEmpty')}
                                                checked={ignoreEmpty}
                                                onCheckedChange={(checked) => {
                                                    setIgnoreEmpty(checked);
                                                    persistDraft({ ignoreEmpty: checked, updatedAt: Date.now() });
                                                }}
                                            />
                                            <OptionCheckbox
                                                id='batch-collapse-whitespace'
                                                label={t('batch.manual.collapseWhitespace')}
                                                checked={collapseWhitespace}
                                                onCheckedChange={(checked) => {
                                                    setCollapseWhitespace(checked);
                                                    persistDraft({
                                                        collapseWhitespace: checked,
                                                        updatedAt: Date.now()
                                                    });
                                                }}
                                            />
                                            <OptionCheckbox
                                                id='batch-preserve-lines'
                                                label={t('batch.manual.preserveParagraphLines')}
                                                checked={preserveParagraphLineBreaks}
                                                onCheckedChange={(checked) => {
                                                    setPreserveParagraphLineBreaks(checked);
                                                    persistDraft({
                                                        preserveParagraphLineBreaks: checked,
                                                        updatedAt: Date.now()
                                                    });
                                                }}
                                            />
                                        </div>
                                        <div className='grid gap-4 sm:grid-cols-2'>
                                            <div className='space-y-1.5'>
                                                <Label htmlFor='batch-prompt-prefix' className='text-foreground'>
                                                    {t('batch.manual.prefix')}
                                                </Label>
                                                <Textarea
                                                    id='batch-prompt-prefix'
                                                    value={promptPrefix}
                                                    onChange={(event) => {
                                                        const next = event.target.value;
                                                        setPromptPrefix(next);
                                                        persistDraft({ promptPrefix: next, updatedAt: Date.now() });
                                                    }}
                                                    className='border-border bg-background text-foreground min-h-20 rounded-xl text-sm'
                                                />
                                            </div>
                                            <div className='space-y-1.5'>
                                                <Label htmlFor='batch-prompt-suffix' className='text-foreground'>
                                                    {t('batch.manual.suffix')}
                                                </Label>
                                                <Textarea
                                                    id='batch-prompt-suffix'
                                                    value={promptSuffix}
                                                    onChange={(event) => {
                                                        const next = event.target.value;
                                                        setPromptSuffix(next);
                                                        persistDraft({ promptSuffix: next, updatedAt: Date.now() });
                                                    }}
                                                    className='border-border bg-background text-foreground min-h-20 rounded-xl text-sm'
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {source === 'json-import' && (
                                    <>
                                        <div className='space-y-1.5'>
                                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                                <Label htmlFor='batch-json-import' className='text-foreground'>
                                                    {t('batch.json.input')}
                                                </Label>
                                                <Button
                                                    type='button'
                                                    variant='outline'
                                                    size='sm'
                                                    asChild
                                                    className='h-8 rounded-lg px-2 text-xs'>
                                                    <a
                                                        href='/examples/batch-task-import-full-example.json'
                                                        download='batch-task-import-full-example.json'>
                                                        <Download className='h-3.5 w-3.5' />
                                                        {t('batch.json.downloadExample')}
                                                    </a>
                                                </Button>
                                            </div>
                                            <Textarea
                                                id='batch-json-import'
                                                value={jsonImportText}
                                                onChange={(event) => {
                                                    const next = event.target.value;
                                                    setJsonImportText(next);
                                                    persistDraft({ jsonImportText: next, updatedAt: Date.now() });
                                                }}
                                                placeholder={t('batch.json.placeholder')}
                                                className='border-border bg-background text-foreground min-h-80 rounded-xl font-mono text-xs leading-5'
                                                data-i18n-skip='true'
                                            />
                                        </div>
                                        <p className='border-border bg-background/70 text-muted-foreground dark:bg-panel-ghost rounded-xl border px-3 py-2 text-xs leading-5'>
                                            {currentSourceImageCount > 0
                                                ? t('batch.dialog.sourceImageAutoOn')
                                                : t('batch.dialog.sourceImageAutoOff')}
                                        </p>
                                    </>
                                )}
                            </div>

                            <div className='border-border bg-muted/20 space-y-3 rounded-xl border p-3'>
                                <div className='flex items-center gap-2'>
                                    {source === 'json-import' ? (
                                        <Braces className='h-4 w-4 text-violet-500 dark:text-violet-200/80' />
                                    ) : source === 'manual-split' ? (
                                        <FileText className='h-4 w-4 text-violet-500 dark:text-violet-200/80' />
                                    ) : source === 'image-edit-batch' ? (
                                        <FileImage className='h-4 w-4 text-violet-500 dark:text-violet-200/80' />
                                    ) : (
                                        <Sparkles className='h-4 w-4 text-violet-500 dark:text-violet-200/80' />
                                    )}
                                    <h3 className='text-foreground text-sm font-medium'>
                                        {t('batch.dialog.tipsTitle')}
                                    </h3>
                                </div>
                                <ul className='text-muted-foreground space-y-2 text-xs leading-5'>
                                    {source === 'ai-plan' ? (
                                        <>
                                            <li>{t('batch.dialog.tipAuto')}</li>
                                            <li>{t('batch.dialog.tipFixed')}</li>
                                            <li>{t('batch.dialog.tipReference')}</li>
                                            <li>{t('batch.dialog.tipAdjust')}</li>
                                        </>
                                    ) : source === 'image-edit-batch' ? (
                                        <>
                                            <li>{t('batch.imageEdit.tipSeparateInputs')}</li>
                                            <li>{t('batch.imageEdit.tipReferences')}</li>
                                            <li>{t('batch.imageEdit.tipOneToOne')}</li>
                                        </>
                                    ) : source === 'manual-split' ? (
                                        <>
                                            <li>{t('batch.manual.tipNoAi')}</li>
                                            <li>{t('batch.manual.tipSplit')}</li>
                                            <li>{t('batch.manual.tipPreview')}</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>{t('batch.json.tipSchema')}</li>
                                            <li>{t('batch.json.tipSafe')}</li>
                                            <li>{t('batch.json.tipPreview')}</li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {localError && (
                            <p className='mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 whitespace-pre-wrap text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100'>
                                {isConfigurationRequiredMessage(localError) ? (
                                    <ConfigurationRequiredActions
                                        onConfigure={onOpenBatchSettings}
                                        actionClassName='hover:text-red-900 dark:hover:text-red-100'
                                    />
                                ) : (
                                    <span>{localError}</span>
                                )}
                            </p>
                        )}
                    </div>

                    <DialogFooter className='border-border border-t px-4 py-4 sm:px-5'>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => onOpenChange(false)}
                            className='rounded-xl'>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type='button'
                            onClick={() => void handleSubmit()}
                            disabled={!canSubmit}
                            className='rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:brightness-110 disabled:pointer-events-none disabled:opacity-40'>
                            {isPlanning ? (
                                <span className='inline-flex items-center gap-2'>
                                    <Loader2 className='h-4 w-4 animate-spin' />
                                    <span className='whitespace-nowrap'>{t('batch.dialog.generating')}</span>
                                    <span className='rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[11px] tabular-nums'>
                                        {formatElapsedMs(isGeneratingElapsed)}
                                    </span>
                                </span>
                            ) : source === 'manual-split' ? (
                                t('batch.manual.generate')
                            ) : source === 'image-edit-batch' ? (
                                t('batch.imageEdit.generate')
                            ) : source === 'json-import' ? (
                                t('batch.json.generate')
                            ) : (
                                t('batch.dialog.generate')
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export const BatchPlanningDialog = React.memo(BatchPlanningDialogBase) as typeof BatchPlanningDialogBase;
