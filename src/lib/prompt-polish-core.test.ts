import {
    buildPromptPolishThinkingParams,
    buildChatCompletionsUrl,
    buildPromptPolishMessages,
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    extractPromptPolishText,
    getPolishPresetById,
    normalizePolishedPrompt,
    normalizePromptPolishThinkingEffort,
    normalizePromptPolishThinkingEffortFormat,
    normalizePromptPolishThinkingEnabled,
    normalizePromptPolishPresetId,
    normalizeSavedCustomPolishPrompt,
    PROMPT_POLISH_PRESETS,
    PROMPT_POLISH_PRESET_IDS,
    resolvePolishSystemPrompt
} from './prompt-polish-core';
import { describe, expect, it } from 'vitest';

describe('buildChatCompletionsUrl', () => {
    it('uses the official OpenAI chat completions endpoint by default', () => {
        expect(buildChatCompletionsUrl()).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('appends chat completions to v1-compatible base URLs', () => {
        expect(buildChatCompletionsUrl('https://relay.example.com/v1')).toBe('https://relay.example.com/v1/chat/completions');
        expect(buildChatCompletionsUrl('relay.example.com/v1/')).toBe('https://relay.example.com/v1/chat/completions');
    });

    it('normalizes bare hosts, ports, and custom root paths', () => {
        expect(buildChatCompletionsUrl('relay.example.com')).toBe('https://relay.example.com/v1/chat/completions');
        expect(buildChatCompletionsUrl('http://localhost:3000/v1')).toBe('http://localhost:3000/v1/chat/completions');
        expect(buildChatCompletionsUrl('https://api.example.com/my-api')).toBe(
            'https://api.example.com/my-api/v1/chat/completions'
        );
    });

    it('replaces image endpoint suffixes with chat completions', () => {
        expect(buildChatCompletionsUrl('https://relay.example.com/v1/images/generate')).toBe(
            'https://relay.example.com/v1/chat/completions'
        );
    });
});

describe('buildPromptPolishMessages', () => {
    it('keeps default prompt guidance for multiple input shapes', () => {
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('长文');
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('广告文案');
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('散乱词语');
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('较完整的生图提示词');
        expect(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT).toContain('只输出润色后的最终生图提示词');
    });

    it('uses the default system prompt when the configured prompt is blank', () => {
        expect(buildPromptPolishMessages('  a cat in rain  ', ' ')[0]).toEqual({
            role: 'system',
            content: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT
        });
    });

    it('wraps the original prompt without losing user text', () => {
        const messages = buildPromptPolishMessages('赛博朋克城市', 'polish it');
        expect(messages[1].content).toContain('赛博朋克城市');
        expect(messages[1].content).toContain('用户原始输入');
        expect(messages[1].content).toContain('请只输出润色后的最终提示词');
    });

    it('wraps long-form input without pre-truncating it', () => {
        const longInput = '产品发布会背景文案：'.repeat(80);
        const messages = buildPromptPolishMessages(longInput, 'polish it');

        expect(messages[1].content).toContain(longInput);
    });
});

describe('prompt polish thinking params', () => {
    it('omits thinking fields when disabled', () => {
        expect(buildPromptPolishThinkingParams({ enabled: false, effort: 'high', effortFormat: 'both' })).toEqual({});
    });

    it('builds OpenAI-compatible thinking fields', () => {
        expect(buildPromptPolishThinkingParams({ enabled: true, effort: 'max', effortFormat: 'openai' })).toEqual({
            thinking: { type: 'enabled' },
            reasoning_effort: 'max'
        });
    });

    it('builds Anthropic-compatible thinking fields', () => {
        expect(buildPromptPolishThinkingParams({ enabled: true, effort: 'high', effortFormat: 'anthropic' })).toEqual({
            thinking: { type: 'enabled' },
            output_config: { effort: 'high' }
        });
    });

    it('builds mixed compatibility fields for routers', () => {
        expect(buildPromptPolishThinkingParams({ enabled: true, effort: 'xhigh', effortFormat: 'both' })).toEqual({
            thinking: { type: 'enabled' },
            reasoning_effort: 'xhigh',
            output_config: { effort: 'xhigh' }
        });
    });

    it('preserves custom thinking effort values', () => {
        expect(buildPromptPolishThinkingParams({ enabled: true, effort: 'ultra', effortFormat: 'openai' })).toMatchObject({
            reasoning_effort: 'ultra'
        });
    });

    it('normalizes thinking option inputs safely', () => {
        expect(normalizePromptPolishThinkingEnabled('enabled')).toBe(true);
        expect(normalizePromptPolishThinkingEnabled('disabled')).toBe(false);
        expect(normalizePromptPolishThinkingEffort('  custom-max  ')).toBe('custom-max');
        expect(normalizePromptPolishThinkingEffort('')).toBe('high');
        expect(normalizePromptPolishThinkingEffortFormat('anthropic')).toBe('anthropic');
        expect(normalizePromptPolishThinkingEffortFormat('unknown')).toBe('openai');
    });
});

describe('extractPromptPolishText', () => {
    it('extracts the first assistant message content', () => {
        expect(
            extractPromptPolishText({
                choices: [{ message: { content: '  cinematic moonlit cat  ' } }]
            })
        ).toBe('cinematic moonlit cat');
    });

    it('falls back to legacy text completions-style content', () => {
        expect(extractPromptPolishText({ choices: [{ text: '  richer prompt  ' }] })).toBe('richer prompt');
    });

    it('returns null for invalid response shapes', () => {
        expect(extractPromptPolishText({ choices: [] })).toBeNull();
        expect(extractPromptPolishText({ choices: [{ message: { content: '' } }] })).toBeNull();
    });
});

describe('normalizePolishedPrompt', () => {
    it('removes surrounding markdown code fences', () => {
        expect(normalizePolishedPrompt('```text\nA richer prompt\n```')).toBe('A richer prompt');
        expect(normalizePolishedPrompt('```\nA richer prompt\n```')).toBe('A richer prompt');
    });
});

describe('prompt polish presets', () => {
    it('exports 8 presets', () => {
        expect(PROMPT_POLISH_PRESETS).toHaveLength(8);
    });

    it('includes all expected preset ids', () => {
        expect(PROMPT_POLISH_PRESET_IDS).toEqual([
            'balanced', 'concise', 'edit-refine', 'cinematic',
            'photorealistic', 'illustration', 'commercial', 'minimalist'
        ]);
    });

    it('gives each preset a label, description, category, and systemPrompt', () => {
        for (const preset of PROMPT_POLISH_PRESETS) {
            expect(preset.label).toBeTruthy();
            expect(preset.description).toBeTruthy();
            expect(preset.category).toBeTruthy();
            expect(preset.systemPrompt).toBeTruthy();
        }
    });

    it('groups presets as 通用 and 风格生成', () => {
        const categories = new Set(PROMPT_POLISH_PRESETS.map(p => p.category));
        expect(categories).toEqual(new Set(['通用', '风格生成']));
        expect(PROMPT_POLISH_PRESETS.filter(p => p.category === '通用')).toHaveLength(3);
        expect(PROMPT_POLISH_PRESETS.filter(p => p.category === '风格生成')).toHaveLength(5);
    });

    it('makes balanced preset the default', () => {
        expect(DEFAULT_POLISHING_PRESET_ID).toBe('balanced');
        const balanced = PROMPT_POLISH_PRESETS.find(p => p.id === 'balanced');
        expect(balanced?.systemPrompt).toBe(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
    });

    it('resolves a known preset by id', () => {
        const preset = getPolishPresetById('cinematic');
        expect(preset).toBeTruthy();
        expect(preset?.label).toBe('电影质感');
        expect(preset?.systemPrompt).toContain('电影');
    });

    it('returns undefined for unknown preset id', () => {
        expect(getPolishPresetById('nonexistent')).toBeUndefined();
    });
});

describe('normalizePromptPolishPresetId', () => {
    it('returns default for unknown values', () => {
        expect(normalizePromptPolishPresetId(null)).toBe('balanced');
        expect(normalizePromptPolishPresetId(undefined)).toBe('balanced');
        expect(normalizePromptPolishPresetId(42)).toBe('balanced');
        expect(normalizePromptPolishPresetId('invalid-preset')).toBe('balanced');
        expect(normalizePromptPolishPresetId('')).toBe('balanced');
    });

    it('accepts valid preset ids', () => {
        for (const id of PROMPT_POLISH_PRESET_IDS) {
            expect(normalizePromptPolishPresetId(id)).toBe(id);
        }
    });

    it('is case-insensitive and trims whitespace', () => {
        expect(normalizePromptPolishPresetId('  BALANCED  ')).toBe('balanced');
        expect(normalizePromptPolishPresetId('Cinematic')).toBe('cinematic');
    });
});

describe('resolvePolishSystemPrompt', () => {
    it('uses per-request override as highest priority', () => {
        const result = resolvePolishSystemPrompt({
            requestSystemPrompt: 'custom override system prompt',
            presetId: 'balanced',
            configCustomPrompt: 'saved custom prompt',
        });
        expect(result.systemPrompt).toBe('custom override system prompt');
        expect(result.source).toBe('request');
    });

    it('does not let saved custom prompt implicitly override a preset', () => {
        const result = resolvePolishSystemPrompt({
            presetId: 'cinematic',
            configCustomPrompt: 'saved custom prompt',
        });
        const preset = getPolishPresetById('cinematic');
        expect(result.systemPrompt).toBe(preset?.systemPrompt);
        expect(result.source).toBe('preset');
    });

    it('uses preset systemPrompt when no real custom prompt exists', () => {
        const result = resolvePolishSystemPrompt({
            presetId: 'cinematic',
            configCustomPrompt: '',
        });
        const preset = getPolishPresetById('cinematic');
        expect(result.systemPrompt).toBe(preset?.systemPrompt);
        expect(result.source).toBe('preset');
    });

    it('normalizes preset ids before resolving system prompts', () => {
        const result = resolvePolishSystemPrompt({
            presetId: '  Cinematic  ',
            configCustomPrompt: '',
        });
        const preset = getPolishPresetById('cinematic');
        expect(result.systemPrompt).toBe(preset?.systemPrompt);
        expect(result.source).toBe('preset');
    });

    it('treats the historical default prompt as no custom override', () => {
        const result = resolvePolishSystemPrompt({
            presetId: 'cinematic',
            configCustomPrompt: DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
        });
        const preset = getPolishPresetById('cinematic');
        expect(result.systemPrompt).toBe(preset?.systemPrompt);
        expect(result.source).toBe('preset');
    });

    it('falls back to built-in default when everything is empty', () => {
        const result = resolvePolishSystemPrompt({
            presetId: 'nonexistent',
            configCustomPrompt: '',
        });
        expect(result.systemPrompt).toBe(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT);
        expect(result.source).toBe('built-in-default');
    });

    it('ignores blank per-request overrides', () => {
        const result = resolvePolishSystemPrompt({
            requestSystemPrompt: '   ',
            presetId: 'cinematic',
            configCustomPrompt: '',
        });
        const preset = getPolishPresetById('cinematic');
        expect(result.systemPrompt).toBe(preset?.systemPrompt);
        expect(result.source).toBe('preset');
    });
});

describe('normalizeSavedCustomPolishPrompt', () => {
    it('returns null for blank or historical default values', () => {
        expect(normalizeSavedCustomPolishPrompt('')).toBeNull();
        expect(normalizeSavedCustomPolishPrompt('   ')).toBeNull();
        expect(normalizeSavedCustomPolishPrompt(DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT)).toBeNull();
    });

    it('returns trimmed real saved custom prompt values', () => {
        expect(normalizeSavedCustomPolishPrompt('  custom saved prompt  ')).toBe('custom saved prompt');
    });
});
