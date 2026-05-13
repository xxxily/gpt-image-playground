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
2. 如果用户输入的是商业文案、标题、口号、社媒文案或品牌描述：保留文案想表达的卖点和情绪，转化为画面主体、使用场景、受众感受和商业摄影/海报设计语言；如用户明确要求画面文字，才描述需要呈现的文字内容。
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

// ── Polish Preset Taxonomy

const BALANCED_SYSTEM_PROMPT = DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT;

const CONCISE_SYSTEM_PROMPT = `你是一名精炼的 AI 图像提示词专家。将用户输入改写为简短、精准、高效的生图提示词。

要求：
1. 严格保留核心意图，去除冗余。
2. 输出 1-3 句话，聚焦主体、构图、光线和质感。
3. 避免堆砌形容词和多余修饰。
4. 只输出润色后的提示词，不要解释和其他内容。`;

const EDIT_REFINE_SYSTEM_PROMPT = `你是一名 AI 图像提示词编辑与精修专家。用户的输入可能已经是较完整的生图提示词，你需要在保留原始结构和意图的前提下，做针对性增强。

要求：
1. 微调镜头语言、光影层次、材质细节，确保画面品质提升。
2. 不改变原结构、主体关系、风格方向。
3. 修复模糊表达，消除矛盾的风格词。
4. 只输出润色后的最终提示词，不要解释和其他内容。`;

const CINEMATIC_SYSTEM_PROMPT = `你是一名电影级视觉导演与摄影指导。将用户输入改写为具有电影质感的生图提示词。

要求：
1. 强调镜头类型、焦段、景深、运动构图和光影戏剧性。
2. 使用摄影和电影术语：如 wide shot、dolly zoom、volumetric lighting、anamorphic lens flare 等。
3. 补全场景氛围、色调、对比度、颗粒感和画面情绪。
4. 输出应像电影分镜描述，专业、连贯、有画面感。
5. 只输出润色后的最终提示词，不要解释和其他内容。`;

const PHOTOREALISTIC_SYSTEM_PROMPT = `你是一名专业商业摄影师与超写实渲染专家。将用户输入改写为照片级写实风格的生图提示词。

要求：
1. 强调真实光影、材质物理属性（反射、折射、粗糙度、次表面散射等）。
2. 使用摄影术语：相机型号、传感器尺寸、焦段、光圈、ISO、自然光/棚拍布光方案。
3. 对人物注意皮肤质感、毛发细节、眼神光；对产品注意倒角、纹理、环境反射。
4. 风格锁定为 photorealistic，不要转插画或抽象风格。
5. 只输出润色后的最终提示词，不要解释和其他内容。`;

const ILLUSTRATION_SYSTEM_PROMPT = `你是一名资深插画师与视觉艺术家。将用户输入改写为插画/绘画风格的生图提示词。

要求：
1. 明确插画技法：水彩、油画、数字绘画、扁平插画、概念艺术、赛璐璐等。
2. 强调笔触、色彩调和、线条质量和构图美学。
3. 适当加入艺术家风格参考或艺术流派暗示（不编造具体人名）。
4. 保持手绘感和艺术表现力，避免写实质感。
5. 只输出润色后的最终提示词，不要解释和其他内容。`;

const COMMERCIAL_SYSTEM_PROMPT = `你是一名品牌视觉创意总监。将用户输入改写为适合品牌视觉、电商产品或品牌营销的生图提示词。

要求：
1. 强调卖点传达、受众触达和品牌调性。
2. 描述使用场景、消费者互动情境和产品展示角度。
3. 使用商业摄影和品牌视觉语言，确保画面干净、专业、有吸引力。
4. 注意品牌安全：不引入敏感或争议元素。
5. 只输出润色后的最终提示词，不要解释和其他内容。`;

const MINIMALIST_SYSTEM_PROMPT = `你是一名极简主义视觉设计师。将用户输入改写为极简风格的生图提示词。

要求：
1. 用最少的元素传达核心意图，留白即是设计。
2. 去除一切多余的修饰、背景、细节。
3. 强调主体、负空间、几何构成和克制的光影。
4. 风格锁定为极简，拒绝繁复装饰。
5. 只输出润色后的最终提示词，不要解释和其他内容。`;

export const PROMPT_POLISH_PRESETS = [
    { id: 'balanced', label: '均衡润色', description: '通用场景，精准保留意图并增强视觉语言', category: '通用', systemPrompt: BALANCED_SYSTEM_PROMPT },
    { id: 'concise', label: '精简润色', description: '短输入友好，高效精炼输出', category: '通用', systemPrompt: CONCISE_SYSTEM_PROMPT },
    { id: 'edit-refine', label: '编辑精修', description: '已有完整提示词时做微调增强', category: '通用', systemPrompt: EDIT_REFINE_SYSTEM_PROMPT },
    { id: 'cinematic', label: '电影质感', description: '镜头语言、光影戏剧、电影级构图', category: '风格生成', systemPrompt: CINEMATIC_SYSTEM_PROMPT },
    { id: 'photorealistic', label: '照片写实', description: '商业摄影级别真实感，材质物理准确', category: '风格生成', systemPrompt: PHOTOREALISTIC_SYSTEM_PROMPT },
    { id: 'illustration', label: '插画艺术', description: '水彩、油画、数字绘画等艺术技法', category: '风格生成', systemPrompt: ILLUSTRATION_SYSTEM_PROMPT },
    { id: 'commercial', label: '品牌视觉', description: '电商产品、品牌营销、品牌视觉', category: '风格生成', systemPrompt: COMMERCIAL_SYSTEM_PROMPT },
    { id: 'minimalist', label: '极简设计', description: '少即是多，留白与几何构成', category: '风格生成', systemPrompt: MINIMALIST_SYSTEM_PROMPT },
] as const;

export type PromptPolishPreset = (typeof PROMPT_POLISH_PRESETS)[number];

export const PROMPT_POLISH_PRESET_IDS = PROMPT_POLISH_PRESETS.map((p) => p.id) as string[];

export const DEFAULT_POLISHING_PRESET_ID: PromptPolishPreset['id'] = 'balanced';

export function normalizePromptPolishPresetId(value: unknown): PromptPolishPreset['id'] {
    if (typeof value !== 'string') return DEFAULT_POLISHING_PRESET_ID;
    const trimmed = value.trim().toLowerCase();
    return PROMPT_POLISH_PRESET_IDS.includes(trimmed) ? (trimmed as PromptPolishPreset['id']) : DEFAULT_POLISHING_PRESET_ID;
}

export function getPolishPresetById(id: string): PromptPolishPreset | undefined {
    return PROMPT_POLISH_PRESETS.find((p) => p.id === id);
}

export function normalizeSavedCustomPolishPrompt(value: string | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT) return null;
    return trimmed;
}

export type PromptPolishResolveSystemPromptResult = {
    systemPrompt: string;
    /** Source of the resolved system prompt. */
    source: 'request' | 'preset' | 'built-in-default';
};

/**
 * Resolve the effective system prompt for a polish request.
 * Priority: per-request override > preset by ID > built-in default.
 * Saved custom prompts are explicit runtime choices in the UI, not implicit
 * overrides of built-in presets.
 */
export function resolvePolishSystemPrompt(params: {
    /** Per-request override (from saved-custom or temporary-custom picker choices) */
    requestSystemPrompt?: string;
    /** Preset ID from config */
    presetId: string;
    /** Legacy saved custom prompt field; kept for config compatibility, not an implicit override. */
    configCustomPrompt?: string;
}): PromptPolishResolveSystemPromptResult {
    // 1. Per-request explicit override takes highest priority
    if (params.requestSystemPrompt?.trim()) {
        return { systemPrompt: params.requestSystemPrompt.trim(), source: 'request' };
    }

    // 2. If config presetId maps to a built-in preset, use its systemPrompt
    const normalizedPresetId = params.presetId.trim().toLowerCase();
    const preset = getPolishPresetById(normalizedPresetId);
    if (preset) {
        return { systemPrompt: preset.systemPrompt, source: 'preset' };
    }

    // 3. Built-in default
    return { systemPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT, source: 'built-in-default' };
}

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

// ── Saved Custom Polish Prompts

export type StoredCustomPolishPrompt = {
    id: string;
    name: string;
    systemPrompt: string;
    createdAt?: number;
    updatedAt?: number;
};

function generatePromptId(existingIds: Set<string>): string {
    let attempt = 1;
    while (true) {
        const id = `custom-${Date.now()}-${attempt}`;
        if (!existingIds.has(id)) return id;
        attempt++;
    }
}

export function normalizeStoredCustomPolishPrompts(
    value: unknown,
    legacyPrompt?: string
): StoredCustomPolishPrompt[] {
    if (Array.isArray(value)) {
        const ids = new Set<string>();
        const result: StoredCustomPolishPrompt[] = [];
        for (const item of value) {
            if (typeof item !== 'object' || item === null) continue;
            const rec = item as Record<string, unknown>;
            const rawId = rec.id;
            const rawName = rec.name;
            const rawSystemPrompt = rec.systemPrompt;
            if (typeof rawId !== 'string' || typeof rawName !== 'string' || typeof rawSystemPrompt !== 'string') continue;
            const trimmedId = rawId.trim();
            const trimmedName = rawName.trim();
            const trimmedSystemPrompt = rawSystemPrompt.trim();
            if (!trimmedId || !trimmedName || !trimmedSystemPrompt) continue;
            if (ids.has(trimmedId)) continue;
            ids.add(trimmedId);
            result.push({
                id: trimmedId,
                name: trimmedName,
                systemPrompt: trimmedSystemPrompt,
                createdAt: typeof rec.createdAt === 'number' ? rec.createdAt : undefined,
                updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : undefined,
            });
        }
        return result;
    }

    const migrated = normalizeSavedCustomPolishPrompt(legacyPrompt);
    if (migrated) {
        const id = generatePromptId(new Set<string>());
        return [{
            id,
            name: '自定义润色提示词',
            systemPrompt: migrated,
        }];
    }

    return [];
}

// ── Polish Picker Order

export const POLISH_PICKER_TOKEN_DEFAULT = '__builtin-default__' as const;
export const POLISH_PICKER_TOKEN_TEMPORARY = '__temporary-custom__' as const;

export type PolishPickerToken =
    | typeof POLISH_PICKER_TOKEN_DEFAULT
    | typeof POLISH_PICKER_TOKEN_TEMPORARY
    | string;

function buildDefaultPolishPickerOrder(savedCustomPromptIds: Iterable<string> = []): PolishPickerToken[] {
    return [
        POLISH_PICKER_TOKEN_DEFAULT,
        ...Array.from(savedCustomPromptIds),
        ...PROMPT_POLISH_PRESET_IDS,
        POLISH_PICKER_TOKEN_TEMPORARY,
    ];
}

function isValidPickerToken(token: string, knownPresetIds: Set<string>): boolean {
    if (token === POLISH_PICKER_TOKEN_DEFAULT || token === POLISH_PICKER_TOKEN_TEMPORARY) return true;
    if (knownPresetIds.has(token)) return true;
    return false;
}

export function normalizePolishPickerOrder(
    value: unknown,
    savedCustomPromptIds: Set<string>
): PolishPickerToken[] {
    const knownPresetIds = new Set(PROMPT_POLISH_PRESET_IDS);
    for (const id of savedCustomPromptIds) {
        knownPresetIds.add(id);
    }
    const defaultOrder = buildDefaultPolishPickerOrder(savedCustomPromptIds);

    if (Array.isArray(value) && value.length > 0) {
        const seen = new Set<string>();
        const result: PolishPickerToken[] = [];
        for (const token of value) {
            if (typeof token !== 'string') continue;
            const trimmed = token.trim();
            if (!trimmed || seen.has(trimmed)) continue;
            if (!isValidPickerToken(trimmed, knownPresetIds)) continue;
            seen.add(trimmed);
            result.push(trimmed as PolishPickerToken);
        }
        for (const token of defaultOrder) {
            if (!seen.has(token)) {
                seen.add(token);
                result.push(token);
            }
        }
        return result;
    }

    return [...defaultOrder];
}

export function getDefaultPolishPickerOrder(savedCustomPromptIds: Iterable<string> = []): PolishPickerToken[] {
    return buildDefaultPolishPickerOrder(savedCustomPromptIds);
}
