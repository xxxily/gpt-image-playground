import type OpenAI from 'openai';
import type {
    ImageToTextStructuredResult,
    VisionTextApiCompatibility,
    VisionTextDetail,
    VisionTextResponseFormat,
    VisionTextTaskType
} from '@/lib/vision-text-types';
import {
    DEFAULT_VISION_TEXT_API_COMPATIBILITY,
    DEFAULT_VISION_TEXT_DETAIL,
    DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS,
    DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
    DEFAULT_VISION_TEXT_STREAMING_ENABLED,
    DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED,
    DEFAULT_VISION_TEXT_SYSTEM_PROMPT,
    DEFAULT_VISION_TEXT_TASK_TYPE,
    VISION_TEXT_API_COMPATIBILITY_LABELS,
    VISION_TEXT_DETAIL_LABELS,
    VISION_TEXT_TASK_TYPE_DESCRIPTIONS,
    VISION_TEXT_TASK_TYPE_LABELS
} from '@/lib/vision-text-types';

type FileLike = {
    name: string;
    type?: string;
    arrayBuffer(): Promise<ArrayBuffer>;
};

type VisionTextResponsesUserContent =
    | {
          type: 'input_text';
          text: string;
      }
    | {
          type: 'input_image';
          image_url: string;
          detail: VisionTextDetail;
      };

type VisionTextChatContent =
    | {
          type: 'text';
          text: string;
      }
    | {
          type: 'image_url';
          image_url: {
              url: string;
              detail?: 'auto' | 'low' | 'high';
          };
      };

type UnknownRecord = Record<string, unknown>;

const VISION_TEXT_RESPONSE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        summary: { type: 'string' },
        prompt: { type: 'string' },
        negativePrompt: { type: 'string' },
        styleTags: {
            type: 'array',
            items: { type: 'string' }
        },
        subject: { type: 'string' },
        composition: { type: 'string' },
        lighting: { type: 'string' },
        colorPalette: { type: 'string' },
        materials: { type: 'string' },
        textInImage: { type: 'string' },
        aspectRatioRecommendation: { type: 'string' },
        generationNotes: { type: 'string' },
        warnings: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: [
        'summary',
        'prompt',
        'negativePrompt',
        'styleTags',
        'subject',
        'composition',
        'lighting',
        'colorPalette',
        'materials',
        'textInImage',
        'aspectRatioRecommendation',
        'generationNotes',
        'warnings'
    ]
} as const;

export function normalizeVisionTextTaskType(value: unknown): VisionTextTaskType {
    if (value === 'prompt_extraction' || value === 'image_description' || value === 'design_spec' || value === 'ocr_and_layout' || value === 'freeform_qa') {
        return value;
    }
    return DEFAULT_VISION_TEXT_TASK_TYPE;
}

export function normalizeVisionTextDetail(value: unknown): VisionTextDetail {
    if (value === 'low' || value === 'high' || value === 'auto' || value === 'original') {
        return value;
    }
    return DEFAULT_VISION_TEXT_DETAIL;
}

export function normalizeVisionTextApiCompatibility(value: unknown): VisionTextApiCompatibility {
    if (value === 'responses' || value === 'chat-completions') {
        return value;
    }
    return DEFAULT_VISION_TEXT_API_COMPATIBILITY;
}

export function normalizeVisionTextResponseFormat(value: unknown): VisionTextResponseFormat {
    if (value === 'json_schema') return 'json_schema';
    return DEFAULT_VISION_TEXT_RESPONSE_FORMAT;
}

export function normalizeVisionTextStreamingEnabled(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    }
    return DEFAULT_VISION_TEXT_STREAMING_ENABLED;
}

export function normalizeVisionTextStructuredOutputEnabled(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    }
    return DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED;
}

export function normalizeVisionTextMaxOutputTokens(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.min(Math.round(value), 32768);
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.min(Math.round(parsed), 32768);
        }
    }
    return DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS;
}

export function normalizeVisionTextSystemPrompt(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_VISION_TEXT_SYSTEM_PROMPT;
}

export function getVisionTextTaskLabel(taskType: VisionTextTaskType): string {
    return VISION_TEXT_TASK_TYPE_LABELS[taskType];
}

export function getVisionTextTaskDescription(taskType: VisionTextTaskType): string {
    return VISION_TEXT_TASK_TYPE_DESCRIPTIONS[taskType];
}

export function getVisionTextTaskPlaceholder(taskType: VisionTextTaskType): string {
    if (taskType === 'prompt_extraction') return '可选：描述你希望模型从图片中提取什么，或直接留空使用默认分析';
    if (taskType === 'image_description') return '例如，简要描述这张图片';
    if (taskType === 'design_spec') return '例如，提取可复用的界面设计规范';
    if (taskType === 'ocr_and_layout') return '例如，提取图片中的文字并说明版式';
    return '例如，回答图片中的具体问题';
}

export function getVisionTextDefaultUserInstruction(taskType: VisionTextTaskType): string {
    if (taskType === 'prompt_extraction') {
        return '请分析图片并反推出一套可复用的文生图提示词。优先给出主提示词、负向提示词和关键视觉要素。';
    }
    if (taskType === 'image_description') {
        return '请客观描述图片内容，强调主要主体、动作、环境和可见细节。';
    }
    if (taskType === 'design_spec') {
        return '请提取可复用的界面或视觉设计规范，包括布局、组件、色彩、字体、间距和状态。';
    }
    if (taskType === 'ocr_and_layout') {
        return '请优先识别图片中的文字，并说明版式结构、信息层级和关键视觉元素。';
    }
    return '请根据图片回答用户的问题。';
}

export function buildVisionTextSystemPrompt(customSystemPrompt?: string | null): string {
    return normalizeVisionTextSystemPrompt(customSystemPrompt);
}

export function buildVisionTextUserInstruction(taskType: VisionTextTaskType, prompt?: string | null, imageCount = 1): string {
    const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    const basePrompt = trimmedPrompt || getVisionTextDefaultUserInstruction(taskType);
    if (imageCount <= 1) return basePrompt;
    return `${basePrompt}\n\n当前共有 ${imageCount} 张图片，请按添加顺序逐张编号分析。`;
}

function bytesToBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, bytes.length);
        let chunk = '';
        for (let index = offset; index < end; index += 1) {
            chunk += String.fromCharCode(bytes[index]);
        }
        binary += chunk;
    }

    return btoa(binary);
}

export async function fileToDataUrl(file: FileLike): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type?.trim() || 'application/octet-stream';
    return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

function toChatDetail(detail: VisionTextDetail): 'auto' | 'low' | 'high' {
    if (detail === 'low' || detail === 'high') return detail;
    return 'auto';
}

export async function buildVisionTextResponsesContent(
    files: readonly FileLike[],
    taskType: VisionTextTaskType,
    prompt?: string | null,
    detail: VisionTextDetail = DEFAULT_VISION_TEXT_DETAIL
): Promise<Array<VisionTextResponsesUserContent>> {
    const userInstruction = buildVisionTextUserInstruction(taskType, prompt, files.length);
    const content: Array<VisionTextResponsesUserContent> = [];
    if (userInstruction.trim()) {
        content.push({ type: 'input_text', text: userInstruction });
    }

    for (const file of files) {
        content.push({
            type: 'input_image',
            image_url: await fileToDataUrl(file),
            detail
        });
    }

    return content;
}

export async function buildVisionTextChatContent(
    files: readonly FileLike[],
    taskType: VisionTextTaskType,
    prompt?: string | null,
    detail: VisionTextDetail = DEFAULT_VISION_TEXT_DETAIL
): Promise<Array<VisionTextChatContent>> {
    const userInstruction = buildVisionTextUserInstruction(taskType, prompt, files.length);
    const content: Array<VisionTextChatContent> = [];
    if (userInstruction.trim()) {
        content.push({ type: 'text', text: userInstruction });
    }

    for (const file of files) {
        content.push({
            type: 'image_url',
            image_url: {
                url: await fileToDataUrl(file),
                detail: toChatDetail(detail)
            }
        });
    }

    return content;
}

export function buildVisionTextResponsesTextFormat(
    responseFormat: VisionTextResponseFormat,
    taskType: VisionTextTaskType
): OpenAI.Responses.ResponseTextConfig['format'] | undefined {
    if (responseFormat !== 'json_schema') return undefined;

    return {
        type: 'json_schema',
        name: `vision_text_${taskType}`,
        description: getVisionTextTaskLabel(taskType),
        strict: true,
        schema: VISION_TEXT_RESPONSE_SCHEMA
    };
}

export function parseImageToTextStructuredResult(value: unknown): ImageToTextStructuredResult | null {
    const record = normalizeStructuredResultRecord(value);
    if (!record) return null;

    const styleTags = normalizeStringArray(record.styleTags);
    const warnings = normalizeStringArray(record.warnings);

    return {
        summary: normalizeStringField(record.summary),
        prompt: normalizeStringField(record.prompt),
        negativePrompt: normalizeStringField(record.negativePrompt),
        styleTags,
        subject: normalizeStringField(record.subject),
        composition: normalizeStringField(record.composition),
        lighting: normalizeStringField(record.lighting),
        colorPalette: normalizeStringField(record.colorPalette),
        materials: normalizeStringField(record.materials),
        textInImage: normalizeStringField(record.textInImage),
        aspectRatioRecommendation: normalizeStringField(record.aspectRatioRecommendation),
        generationNotes: normalizeStringField(record.generationNotes),
        warnings
    };
}

export function parseImageToTextStructuredResultFromText(text: string): ImageToTextStructuredResult | null {
    const trimmed = stripCodeFences(text);
    if (!trimmed) return null;

    try {
        return parseImageToTextStructuredResult(JSON.parse(trimmed) as unknown);
    } catch {
        return null;
    }
}

export function stripCodeFences(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const withoutOpeningFence = trimmed.startsWith('```')
        ? trimmed
              .replace(/^```(?:json|JSON)?\s*/u, '')
              .replace(/^```/u, '')
        : trimmed;

    return withoutOpeningFence.replace(/```$/u, '').trim();
}

export function normalizeImageToTextStructuredResult(value: unknown): ImageToTextStructuredResult | null {
    return parseImageToTextStructuredResult(value);
}

function normalizeStructuredResultRecord(value: unknown): UnknownRecord | null {
    if (typeof value === 'string') {
        return parseStructuredResultString(value);
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return value as UnknownRecord;
}

function parseStructuredResultString(value: string): UnknownRecord | null {
    const trimmed = stripCodeFences(value);
    if (!trimmed) return null;
    try {
        const parsed = JSON.parse(trimmed) as unknown;
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as UnknownRecord) : null;
    } catch {
        return null;
    }
}

function normalizeStringField(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string') continue;
        const trimmed = item.trim();
        if (!trimmed) continue;
        result.push(trimmed);
    }
    return result;
}

export function isVisionTextStructuredOutputEnabled(
    responseFormat: VisionTextResponseFormat,
    compatibility: VisionTextApiCompatibility
): boolean {
    return responseFormat === 'json_schema' && compatibility === 'responses';
}

export function getVisionTextCompatibilityLabel(compatibility: VisionTextApiCompatibility): string {
    return VISION_TEXT_API_COMPATIBILITY_LABELS[compatibility];
}

export function getVisionTextDetailLabel(detail: VisionTextDetail): string {
    return VISION_TEXT_DETAIL_LABELS[detail];
}

export function getDefaultVisionTextState() {
    return {
        taskType: DEFAULT_VISION_TEXT_TASK_TYPE,
        detail: DEFAULT_VISION_TEXT_DETAIL,
        responseFormat: DEFAULT_VISION_TEXT_RESPONSE_FORMAT,
        streamingEnabled: DEFAULT_VISION_TEXT_STREAMING_ENABLED,
        structuredOutputEnabled: DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED,
        apiCompatibility: DEFAULT_VISION_TEXT_API_COMPATIBILITY,
        maxOutputTokens: DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS
    };
}

