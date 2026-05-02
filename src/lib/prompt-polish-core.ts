export const DEFAULT_PROMPT_POLISH_MODEL = 'gpt-4o-mini';

export const DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT = `你是一名专业的 AI 图像提示词润色助手。你的任务是把用户输入的原始提示词润色成更饱满、更具体、更适合图像生成模型理解的提示词。

要求：
1. 保留用户原意，不改变核心主体、场景和风格方向。
2. 补充有助于成像的视觉细节，例如主体特征、环境、构图、光线、材质、色彩、镜头语言和氛围。
3. 如果用户已经指定语言、比例、文字、品牌或禁忌内容，必须尊重。
4. 不要添加解释、标题、项目符号或 Markdown，只输出润色后的最终提示词。
5. 输出语言尽量跟随用户原始提示词。`;

export type PromptPolishMessage = {
    role: 'system' | 'user';
    content: string;
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
            content: `原始提示词：\n${normalizedPrompt}\n\n请只输出润色后的最终提示词。`
        }
    ];
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
