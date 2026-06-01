import {
    GEMINI_NANO_BANANA_2_MODEL,
    SEEDREAM_5_LITE_MODEL,
    getImageModel,
    type ImageModelId,
    type ImageProviderId,
    type StoredCustomImageModel
} from '@/lib/model-registry';

export const BYTES_PER_MEGABYTE = 1024 * 1024;
export const DEFAULT_REFERENCE_IMAGE_MAX_COUNT = 10;

const OPENAI_REFERENCE_IMAGE_MAX_COUNT = 10;
const GPT_IMAGE_2_REFERENCE_IMAGE_MAX_COUNT = 16;
const SEEDREAM_REFERENCE_IMAGE_MAX_COUNT = 14;
const GEMINI_REFERENCE_IMAGE_MAX_COUNT = 14;
const SEEDREAM_5_LITE_TOTAL_IMAGE_LIMIT = 15;

const OPENAI_REFERENCE_IMAGE_MAX_BYTES = 50 * BYTES_PER_MEGABYTE;
const SEEDREAM_REFERENCE_IMAGE_MAX_BYTES = 30 * BYTES_PER_MEGABYTE;
const GEMINI_REFERENCE_IMAGE_TOTAL_BYTES = 20 * BYTES_PER_MEGABYTE;
const DEFAULT_REFERENCE_IMAGE_MAX_BYTES = 30 * BYTES_PER_MEGABYTE;
const DEFAULT_REFERENCE_IMAGE_MAX_PIXELS = 36_000_000;

const COMMON_REFERENCE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const SEEDREAM_REFERENCE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/gif',
    'image/heic',
    'image/heif'
] as const;
const GEMINI_REFERENCE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'] as const;

const EXTENSION_MIME_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    gif: 'image/gif',
    heic: 'image/heic',
    heif: 'image/heif'
};

export type ImageReferenceConstraintProfile = {
    provider: ImageProviderId;
    model: string;
    modelLabel: string;
    maxImages: number;
    maxFileBytes: number;
    allowedMimeTypes: readonly string[];
    maxTotalBytes?: number;
    maxPixels?: number;
    minShortSideExclusive?: number;
    maxAspectRatio?: number;
    combinedImageCountLimit?: number;
    outputCount: number;
};

export type ImageReferenceConstraintsOptions = {
    customImageModels?: readonly StoredCustomImageModel[];
    outputCount?: number;
};

export type ImageReferenceFileLike = Pick<File, 'name' | 'size' | 'type'>;

export type ImageReferenceValidationIssue =
    | {
          code: 'too_many_images';
          maxImages: number;
          actualCount: number;
          combinedImageCountLimit?: number;
          outputCount?: number;
      }
    | {
          code: 'unsupported_type';
          fileName: string;
          mimeType: string;
          allowedTypesLabel: string;
      }
    | {
          code: 'file_too_large';
          fileName: string;
          maxBytes: number;
          actualBytes: number;
      }
    | {
          code: 'total_too_large';
          maxBytes: number;
          actualBytes: number;
      }
    | {
          code: 'pixel_count_too_large';
          fileName: string;
          width: number;
          height: number;
          maxPixels: number;
      }
    | {
          code: 'short_side_too_small';
          fileName: string;
          width: number;
          height: number;
          minShortSideExclusive: number;
      }
    | {
          code: 'aspect_ratio_out_of_range';
          fileName: string;
          width: number;
          height: number;
          maxAspectRatio: number;
      };

export type ImageReferenceValidationResult =
    | { valid: true }
    | {
          valid: false;
          issue: ImageReferenceValidationIssue;
      };

export type ImageReferenceIssueMessageDescriptor = {
    key: string;
    params: Record<string, string | number>;
};

export type ImageReferenceFileSelectionResult = {
    acceptedFiles: File[];
    issues: ImageReferenceValidationIssue[];
};

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(1, Math.round(value || fallback));
}

function normalizeMimeType(value: string): string {
    const normalized = value.trim().toLowerCase();
    return normalized === 'image/jpg' ? 'image/jpeg' : normalized;
}

function getExtension(filename: string): string {
    return filename.split('.').pop()?.trim().toLowerCase() || '';
}

function getExtensionsForMimeTypes(mimeTypes: readonly string[]): string[] {
    const extensionByMime = new Map<string, string[]>();
    for (const [extension, mimeType] of Object.entries(EXTENSION_MIME_TYPES)) {
        const extensions = extensionByMime.get(mimeType) ?? [];
        extensions.push(extension);
        extensionByMime.set(mimeType, extensions);
    }

    return mimeTypes.flatMap((mimeType) => extensionByMime.get(mimeType) ?? []);
}

function formatTypeLabelFromMime(mimeType: string): string {
    const subtype = mimeType.split('/')[1] || mimeType;
    if (subtype === 'jpeg') return 'JPEG';
    return subtype.toUpperCase();
}

export function formatBytes(bytes: number): string {
    const megabytes = bytes / BYTES_PER_MEGABYTE;
    if (Number.isInteger(megabytes)) return `${megabytes}MB`;
    return `${megabytes.toFixed(1)}MB`;
}

export function formatAllowedImageReferenceTypes(constraints: ImageReferenceConstraintProfile): string {
    return constraints.allowedMimeTypes.map(formatTypeLabelFromMime).join('/');
}

export function getImageReferenceAccept(constraints: ImageReferenceConstraintProfile): string {
    const extensions = getExtensionsForMimeTypes(constraints.allowedMimeTypes).map((extension) => `.${extension}`);
    return [...constraints.allowedMimeTypes, ...extensions].join(', ');
}

export function getReferenceImageMimeType(file: ImageReferenceFileLike): string {
    const fromType = normalizeMimeType(file.type || '');
    if (fromType) return fromType;
    return EXTENSION_MIME_TYPES[getExtension(file.name)] ?? 'application/octet-stream';
}

export function getImageReferenceConstraints(
    model: ImageModelId,
    options: ImageReferenceConstraintsOptions = {}
): ImageReferenceConstraintProfile {
    const modelDefinition = getImageModel(model, options.customImageModels);
    const outputCount = normalizePositiveInteger(options.outputCount, 1);
    const modelId = String(modelDefinition.id);

    if (modelId === 'gpt-image-2') {
        return {
            provider: modelDefinition.provider,
            model: modelId,
            modelLabel: modelDefinition.label,
            maxImages: GPT_IMAGE_2_REFERENCE_IMAGE_MAX_COUNT,
            maxFileBytes: OPENAI_REFERENCE_IMAGE_MAX_BYTES,
            allowedMimeTypes: COMMON_REFERENCE_MIME_TYPES,
            outputCount
        };
    }

    if (modelId === GEMINI_NANO_BANANA_2_MODEL || modelDefinition.provider === 'google') {
        return {
            provider: modelDefinition.provider,
            model: modelId,
            modelLabel: modelDefinition.label,
            maxImages: GEMINI_REFERENCE_IMAGE_MAX_COUNT,
            maxFileBytes: GEMINI_REFERENCE_IMAGE_TOTAL_BYTES,
            maxTotalBytes: GEMINI_REFERENCE_IMAGE_TOTAL_BYTES,
            allowedMimeTypes: GEMINI_REFERENCE_MIME_TYPES,
            outputCount
        };
    }

    if (modelDefinition.provider === 'seedream') {
        const dynamicMaxImages =
            modelId === SEEDREAM_5_LITE_MODEL
                ? Math.max(
                      0,
                      Math.min(SEEDREAM_REFERENCE_IMAGE_MAX_COUNT, SEEDREAM_5_LITE_TOTAL_IMAGE_LIMIT - outputCount)
                  )
                : SEEDREAM_REFERENCE_IMAGE_MAX_COUNT;

        return {
            provider: modelDefinition.provider,
            model: modelId,
            modelLabel: modelDefinition.label,
            maxImages: dynamicMaxImages,
            maxFileBytes: SEEDREAM_REFERENCE_IMAGE_MAX_BYTES,
            allowedMimeTypes: SEEDREAM_REFERENCE_MIME_TYPES,
            maxPixels: DEFAULT_REFERENCE_IMAGE_MAX_PIXELS,
            minShortSideExclusive: 14,
            maxAspectRatio: 16,
            ...(modelId === SEEDREAM_5_LITE_MODEL
                ? {
                      combinedImageCountLimit: SEEDREAM_5_LITE_TOTAL_IMAGE_LIMIT
                  }
                : {}),
            outputCount
        };
    }

    if (modelDefinition.provider === 'openai' && !modelDefinition.custom) {
        return {
            provider: modelDefinition.provider,
            model: modelId,
            modelLabel: modelDefinition.label,
            maxImages: OPENAI_REFERENCE_IMAGE_MAX_COUNT,
            maxFileBytes: OPENAI_REFERENCE_IMAGE_MAX_BYTES,
            allowedMimeTypes: COMMON_REFERENCE_MIME_TYPES,
            outputCount
        };
    }

    return {
        provider: modelDefinition.provider,
        model: modelId,
        modelLabel: modelDefinition.label,
        maxImages: DEFAULT_REFERENCE_IMAGE_MAX_COUNT,
        maxFileBytes: DEFAULT_REFERENCE_IMAGE_MAX_BYTES,
        allowedMimeTypes: COMMON_REFERENCE_MIME_TYPES,
        maxPixels: DEFAULT_REFERENCE_IMAGE_MAX_PIXELS,
        outputCount
    };
}

function validateImageReferenceFile(
    file: ImageReferenceFileLike,
    constraints: ImageReferenceConstraintProfile
): ImageReferenceValidationIssue | null {
    const mimeType = getReferenceImageMimeType(file);
    if (!constraints.allowedMimeTypes.includes(mimeType)) {
        return {
            code: 'unsupported_type',
            fileName: file.name,
            mimeType,
            allowedTypesLabel: formatAllowedImageReferenceTypes(constraints)
        };
    }

    if (file.size > constraints.maxFileBytes) {
        return {
            code: 'file_too_large',
            fileName: file.name,
            maxBytes: constraints.maxFileBytes,
            actualBytes: file.size
        };
    }

    return null;
}

export function validateImageReferenceDimensions(
    dimensions: { width: number; height: number },
    constraints: ImageReferenceConstraintProfile,
    fileName = 'image'
): ImageReferenceValidationIssue | null {
    const { width, height } = dimensions;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

    if (
        constraints.minShortSideExclusive !== undefined &&
        Math.min(width, height) <= constraints.minShortSideExclusive
    ) {
        return {
            code: 'short_side_too_small',
            fileName,
            width,
            height,
            minShortSideExclusive: constraints.minShortSideExclusive
        };
    }

    if (constraints.maxAspectRatio !== undefined) {
        const ratio = Math.max(width / height, height / width);
        if (ratio > constraints.maxAspectRatio) {
            return {
                code: 'aspect_ratio_out_of_range',
                fileName,
                width,
                height,
                maxAspectRatio: constraints.maxAspectRatio
            };
        }
    }

    if (constraints.maxPixels !== undefined && width * height > constraints.maxPixels) {
        return {
            code: 'pixel_count_too_large',
            fileName,
            width,
            height,
            maxPixels: constraints.maxPixels
        };
    }

    return null;
}

export function validateImageReferenceFiles(
    files: readonly ImageReferenceFileLike[],
    constraints: ImageReferenceConstraintProfile
): ImageReferenceValidationResult {
    if (files.length > constraints.maxImages) {
        return {
            valid: false,
            issue: {
                code: 'too_many_images',
                maxImages: constraints.maxImages,
                actualCount: files.length,
                combinedImageCountLimit: constraints.combinedImageCountLimit,
                outputCount: constraints.outputCount
            }
        };
    }

    let totalBytes = 0;
    for (const file of files) {
        totalBytes += file.size;
        const issue = validateImageReferenceFile(file, constraints);
        if (issue) return { valid: false, issue };
    }

    if (constraints.maxTotalBytes !== undefined && totalBytes > constraints.maxTotalBytes) {
        return {
            valid: false,
            issue: {
                code: 'total_too_large',
                maxBytes: constraints.maxTotalBytes,
                actualBytes: totalBytes
            }
        };
    }

    return { valid: true };
}

export function selectValidImageReferenceFilesForAdd(
    candidates: readonly File[],
    existingFiles: readonly ImageReferenceFileLike[],
    constraints: ImageReferenceConstraintProfile
): ImageReferenceFileSelectionResult {
    const acceptedFiles: File[] = [];
    const issues: ImageReferenceValidationIssue[] = [];
    let totalBytes = [...existingFiles].reduce((sum, file) => sum + file.size, 0);

    for (const file of candidates) {
        const nextCount = existingFiles.length + acceptedFiles.length + 1;
        if (nextCount > constraints.maxImages) {
            issues.push({
                code: 'too_many_images',
                maxImages: constraints.maxImages,
                actualCount: nextCount,
                combinedImageCountLimit: constraints.combinedImageCountLimit,
                outputCount: constraints.outputCount
            });
            break;
        }

        const fileIssue = validateImageReferenceFile(file, constraints);
        if (fileIssue) {
            issues.push(fileIssue);
            continue;
        }

        const nextTotalBytes = totalBytes + file.size;
        if (constraints.maxTotalBytes !== undefined && nextTotalBytes > constraints.maxTotalBytes) {
            issues.push({
                code: 'total_too_large',
                maxBytes: constraints.maxTotalBytes,
                actualBytes: nextTotalBytes
            });
            continue;
        }

        totalBytes = nextTotalBytes;
        acceptedFiles.push(file);
    }

    return { acceptedFiles, issues };
}

async function readBrowserImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file);
            const dimensions = { width: bitmap.width, height: bitmap.height };
            bitmap.close();
            return dimensions;
        } catch {
            // Some valid formats, notably HEIC/HEIF, may not be browser-decodable.
        }
    }

    if (typeof Image === 'undefined' || typeof URL === 'undefined') return null;

    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        };
        image.src = objectUrl;
    });
}

export async function validateImageReferenceFileDimensions(
    file: File,
    constraints: ImageReferenceConstraintProfile
): Promise<ImageReferenceValidationIssue | null> {
    if (
        constraints.maxPixels === undefined &&
        constraints.minShortSideExclusive === undefined &&
        constraints.maxAspectRatio === undefined
    ) {
        return null;
    }

    const dimensions = await readBrowserImageDimensions(file);
    if (!dimensions) return null;
    return validateImageReferenceDimensions(dimensions, constraints, file.name);
}

export function getImageReferenceValidationIssueMessageDescriptor(
    issue: ImageReferenceValidationIssue
): ImageReferenceIssueMessageDescriptor {
    switch (issue.code) {
        case 'too_many_images':
            if (issue.combinedImageCountLimit !== undefined && issue.outputCount !== undefined) {
                return {
                    key: 'imageReference.error.tooManyCombined',
                    params: {
                        maxImages: issue.maxImages,
                        combinedLimit: issue.combinedImageCountLimit,
                        outputCount: issue.outputCount
                    }
                };
            }
            return {
                key: 'imageReference.error.tooMany',
                params: { maxImages: issue.maxImages }
            };
        case 'unsupported_type':
            return {
                key: 'imageReference.error.unsupportedType',
                params: { fileName: issue.fileName, allowedTypes: issue.allowedTypesLabel }
            };
        case 'file_too_large':
            return {
                key: 'imageReference.error.fileTooLarge',
                params: { fileName: issue.fileName, maxSize: formatBytes(issue.maxBytes) }
            };
        case 'total_too_large':
            return {
                key: 'imageReference.error.totalTooLarge',
                params: { maxSize: formatBytes(issue.maxBytes) }
            };
        case 'pixel_count_too_large':
            return {
                key: 'imageReference.error.pixelCountTooLarge',
                params: {
                    fileName: issue.fileName,
                    maxMegapixels: Math.round(issue.maxPixels / 1_000_000)
                }
            };
        case 'short_side_too_small':
            return {
                key: 'imageReference.error.shortSideTooSmall',
                params: { fileName: issue.fileName, minSize: issue.minShortSideExclusive }
            };
        case 'aspect_ratio_out_of_range':
            return {
                key: 'imageReference.error.aspectRatioOutOfRange',
                params: {
                    fileName: issue.fileName,
                    maxRatio: issue.maxAspectRatio
                }
            };
    }
}

export function formatImageReferenceValidationIssue(issue: ImageReferenceValidationIssue): string {
    switch (issue.code) {
        case 'too_many_images':
            if (issue.combinedImageCountLimit !== undefined && issue.outputCount !== undefined) {
                return `当前模型最多上传 ${issue.maxImages} 张参考图（参考图 + 输出图数量不能超过 ${issue.combinedImageCountLimit}，当前输出图数量为 ${issue.outputCount}）。`;
            }
            return `当前模型最多上传 ${issue.maxImages} 张参考图。`;
        case 'unsupported_type':
            return `参考图 ${issue.fileName} 的格式不受当前模型支持，请使用 ${issue.allowedTypesLabel}。`;
        case 'file_too_large':
            return `参考图 ${issue.fileName} 超过当前模型单图 ${formatBytes(issue.maxBytes)} 限制。`;
        case 'total_too_large':
            return `参考图总大小超过当前模型 ${formatBytes(issue.maxBytes)} 限制。`;
        case 'pixel_count_too_large':
            return `参考图 ${issue.fileName} 像素数超过当前模型 ${Math.round(issue.maxPixels / 1_000_000)}MP 限制。`;
        case 'short_side_too_small':
            return `参考图 ${issue.fileName} 最短边需要大于 ${issue.minShortSideExclusive}px。`;
        case 'aspect_ratio_out_of_range':
            return `参考图 ${issue.fileName} 宽高比需要在 1:${issue.maxAspectRatio} 到 ${issue.maxAspectRatio}:1 之间。`;
    }
}
