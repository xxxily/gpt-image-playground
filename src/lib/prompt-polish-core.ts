export const DEFAULT_PROMPT_POLISH_MODEL = 'gpt-4o-mini';
export const DEFAULT_PROMPT_POLISH_THINKING_ENABLED = false;
export const DEFAULT_PROMPT_POLISH_THINKING_EFFORT = 'high';
export const DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT = 'openai';
export const PROMPT_POLISH_THINKING_EFFORT_OPTIONS = ['low', 'medium', 'high', 'max', 'minimal', 'xhigh'] as const;
export const PROMPT_POLISH_THINKING_EFFORT_FORMAT_OPTIONS = ['openai', 'anthropic', 'both'] as const;

export const DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT = `你是一名资深 AI 图像提示词导演与视觉润色专家。你的任务是把用户的任意原始输入，改写成更清晰、更专业、更适合图像生成模型执行的高质量生图提示词。

核心目标：
1. 准确保留用户真实意图，不改变核心主体、事实关系、场景方向、风格偏好和限制条件。
2. 将模糊表达转化为可成像的视觉语言，补足主体特征、动作姿态、环境空间、构图视角、镜头语言、光线、色彩、材质、细节层次、氛围和画面质感。
3. 输出应像专业视觉 Brief：具体、连贯、可执行，有明确画面焦点，而不是堆砌形容词。

按输入类型自适应处理：
1. 如果用户输入的是长文、故事、方案、产品介绍或新闻内容：先提炼最适合成图的核心主题、关键人物/物体、场景、情绪和视觉隐喻，压缩成一个聚焦的画面，不要把全文逐句塞进提示词。
2. 如果用户输入的是广告文案、标题、口号、社媒文案或品牌描述：保留文案想表达的卖点和情绪，转化为画面主体、使用场景、受众感受和商业摄影/海报设计语言；如用户明确要求画面文字，才描述需要呈现的文字内容。
3. 如果用户输入的是散乱词语、短语、标签或逗号分隔的关键词：识别其中的主体、风格、场景、颜色、情绪和约束，组织成一个完整、自然、有主次关系的生图提示词；缺失信息可合理补全，但不要引入与关键词冲突的新主题。
4. 如果用户输入已经是较完整的生图提示词：在不破坏原结构的基础上增强细节、镜头、光影、材质和模型可理解性，避免过度改写。
5. 如果用户输入包含参考图片、编辑、局部修改、Logo、文字、比例、尺寸、视角、品牌色、禁忌内容或必须保留的元素：这些要求优先级最高，必须严格遵守。

质量要求：
1. 画面必须有明确主体和视觉焦点，避免多个主体互相抢戏。
2. 细节补充要服务于成像质量，避免空泛词和互相矛盾的风格词。
3. 对人物、产品、建筑、海报、插画、摄影、电商图、封面图、信息图等不同场景，自动选择合适的专业表达方式。
4. 不要编造用户没有暗示的具体姓名、品牌、真实地点、敏感身份或事实结论。
5. 如果用户原文有负面要求、不要出现的元素或安全边界，应保留为清晰的限制描述。

输出规则：
1. 只输出润色后的最终生图提示词，不要解释、标题、项目符号、Markdown、引号或前后缀。
2. 输出语言尽量跟随用户原始输入；如果用户混合中英文，优先使用用户主要语言。
3. 允许用一段自然语言输出；除非用户要求结构化，否则不要分点。
4. 提示词长度应与任务复杂度匹配：短输入可适度丰富，长输入要提炼聚焦，避免冗长。`;

export type PromptPolishMessage = {
    role: 'system' | 'user';
    content: string;
};

export type PromptPolishThinkingEffortFormat = (typeof PROMPT_POLISH_THINKING_EFFORT_FORMAT_OPTIONS)[number];

export type PromptPolishThinkingParams = {
    thinking?: { type: 'enabled' | 'disabled' };
    reasoning_effort?: string;
    output_config?: { effort: string };
};

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

function parseBaseUrl(value: string): URL {
    try {
        return new URL(value);
    } catch {
        return new URL(`https://${value}`);
    }
}

export function buildPromptPolishMessages(prompt: string, systemPrompt: string): PromptPolishMessage[] {
    const normalizedPrompt = prompt.trim();
    const normalizedSystemPrompt = systemPrompt.trim() || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT;

    return [
        { role: 'system', content: normalizedSystemPrompt },
        {
            role: 'user',
            content: `用户原始输入（可能是提示词、长文、文案或关键词）：\n${normalizedPrompt}\n\n请只输出润色后的最终提示词。`
        }
    ];
}

export function normalizePromptPolishThinkingEnabled(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return DEFAULT_PROMPT_POLISH_THINKING_ENABLED;

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;

    return DEFAULT_PROMPT_POLISH_THINKING_ENABLED;
}

export function normalizePromptPolishThinkingEffort(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_PROMPT_POLISH_THINKING_EFFORT;
}

export function normalizePromptPolishThinkingEffortFormat(value: unknown): PromptPolishThinkingEffortFormat {
    if (typeof value !== 'string') return DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT;

    const normalized = value.trim().toLowerCase();
    return PROMPT_POLISH_THINKING_EFFORT_FORMAT_OPTIONS.includes(normalized as PromptPolishThinkingEffortFormat)
        ? normalized as PromptPolishThinkingEffortFormat
        : DEFAULT_PROMPT_POLISH_THINKING_EFFORT_FORMAT;
}

export function buildPromptPolishThinkingParams({
    enabled,
    effort,
    effortFormat
}: {
    enabled: boolean;
    effort: string;
    effortFormat: PromptPolishThinkingEffortFormat;
}): PromptPolishThinkingParams {
    if (!enabled) return {};

    const normalizedEffort = normalizePromptPolishThinkingEffort(effort);
    const normalizedFormat = normalizePromptPolishThinkingEffortFormat(effortFormat);
    const params: PromptPolishThinkingParams = {
        thinking: { type: 'enabled' }
    };

    if (normalizedFormat === 'openai' || normalizedFormat === 'both') {
        params.reasoning_effort = normalizedEffort;
    }

    if (normalizedFormat === 'anthropic' || normalizedFormat === 'both') {
        params.output_config = { effort: normalizedEffort };
    }

    return params;
}

export function buildChatCompletionsUrl(baseUrl?: string): string {
    const normalizedBaseUrl = trimTrailingSlash(baseUrl?.trim() || DEFAULT_OPENAI_BASE_URL);
    const parsed = parseBaseUrl(normalizedBaseUrl);
    const pathname = trimTrailingSlash(parsed.pathname);

    if (pathname.endsWith('/chat/completions')) {
        return parsed.toString();
    }

    if (pathname.endsWith('/images/generate') || pathname.endsWith('/images/edits')) {
        parsed.pathname = `${pathname.replace(/\/images\/(generate|edits)$/, '')}/chat/completions`;
        return parsed.toString();
    }

    if (pathname.endsWith('/v1')) {
        parsed.pathname = `${pathname}/chat/completions`;
        return parsed.toString();
    }

    parsed.pathname = `${pathname === '' ? '' : pathname}/v1/chat/completions`;
    return parsed.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function extractPromptPolishText(value: unknown): string | null {
    if (!isRecord(value)) return null;

    const choices = value.choices;
    if (!Array.isArray(choices) || choices.length === 0) return null;

    const firstChoice = choices[0];
    if (!isRecord(firstChoice)) return null;

    const message = firstChoice.message;
    if (isRecord(message) && typeof message.content === 'string' && message.content.trim()) {
        return normalizePolishedPrompt(message.content);
    }

    const text = firstChoice.text;
    if (typeof text === 'string' && text.trim()) {
        return normalizePolishedPrompt(text);
    }

    return null;
}

export function normalizePolishedPrompt(value: string): string {
    return value
        .trim()
        .replace(/^```(?:\w+)?\s*/u, '')
        .replace(/```$/u, '')
        .trim();
}
