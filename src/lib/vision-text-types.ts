export type VisionTextProviderKind = 'openai' | 'openai-compatible';
export type VisionTextApiCompatibility = 'responses' | 'chat-completions';
export type VisionTextTaskType =
    | 'prompt_extraction'
    | 'image_description'
    | 'design_spec'
    | 'ocr_and_layout'
    | 'freeform_qa';
export type VisionTextDetail = 'auto' | 'low' | 'high' | 'original';
export type VisionTextResponseFormat = 'text' | 'json_schema';

export type ImageToTextStructuredResult = {
    summary: string;
    prompt: string;
    negativePrompt: string;
    styleTags: string[];
    subject: string;
    composition: string;
    lighting: string;
    colorPalette: string;
    materials: string;
    textInImage: string;
    aspectRatioRecommendation: string;
    generationNotes: string;
    warnings: string[];
};

export const VISION_TEXT_TASK_TYPES: readonly VisionTextTaskType[] = [
    'prompt_extraction',
    'image_description',
    'design_spec',
    'ocr_and_layout',
    'freeform_qa'
] as const;

export const VISION_TEXT_TASK_TYPE_LABELS: Record<VisionTextTaskType, string> = {
    prompt_extraction: '提示词反推',
    image_description: '图片描述',
    design_spec: '设计规范',
    ocr_and_layout: 'OCR 与版式',
    freeform_qa: '自由问答'
};

export const VISION_TEXT_TASK_TYPE_DESCRIPTIONS: Record<VisionTextTaskType, string> = {
    prompt_extraction: '反推可直接用于文生图的提示词。',
    image_description: '输出客观、简洁的图片说明。',
    design_spec: '提炼 UI、海报或视觉设计规范。',
    ocr_and_layout: '优先识别文字，并保留版式结构。',
    freeform_qa: '根据图片回答用户的具体问题。'
};

export const VISION_TEXT_API_COMPATIBILITY_LABELS: Record<VisionTextApiCompatibility, string> = {
    responses: 'Responses API',
    'chat-completions': 'Chat Completions'
};

export const VISION_TEXT_DETAIL_LABELS: Record<VisionTextDetail, string> = {
    auto: '自动',
    low: '低',
    high: '高',
    original: '原图'
};

export const DEFAULT_VISION_TEXT_TASK_TYPE: VisionTextTaskType = 'prompt_extraction';
export const DEFAULT_VISION_TEXT_DETAIL: VisionTextDetail = 'auto';
export const DEFAULT_VISION_TEXT_API_COMPATIBILITY: VisionTextApiCompatibility = 'responses';
export const DEFAULT_VISION_TEXT_RESPONSE_FORMAT: VisionTextResponseFormat = 'text';
export const DEFAULT_VISION_TEXT_STREAMING_ENABLED = true;
export const DEFAULT_VISION_TEXT_STRUCTURED_OUTPUT_ENABLED = false;
export const DEFAULT_VISION_TEXT_MAX_OUTPUT_TOKENS = 4096;

export const DEFAULT_VISION_TEXT_SYSTEM_PROMPT = [
    '你是一个图像理解助手。',
    '只能描述图片中可见或可合理推断的信息，不要编造身份、品牌、地点或不可见细节。',
    '如果图片中文字不清晰，只能如实说明看不清，不要擅自补全。',
    '优先输出可复用的视觉理解结果，帮助用户把图片转成可再生成的提示词或结构化说明。',
    '遇到多张图片时，请按用户上传顺序分别分析。'
].join(' ');

