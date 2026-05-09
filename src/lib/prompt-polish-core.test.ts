import {
    buildPromptPolishThinkingParams,
    buildChatCompletionsUrl,
    buildPromptPolishMessages,
    DEFAULT_POLISHING_PRESET_ID,
    DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
    extractPromptPolishText,
    getDefaultPolishPickerOrder,
    getPolishPresetById,
    normalizePolishedPrompt,
    normalizePolishPickerOrder,
    normalizePromptPolishThinkingEffort,
    normalizePromptPolishThinkingEffortFormat,
    normalizePromptPolishThinkingEnabled,
    normalizePromptPolishPresetId,
    normalizeSavedCustomPolishPrompt,
    normalizeStoredCustomPolishPrompts,
    POLISH_PICKER_TOKEN_DEFAULT,
    POLISH_PICKER_TOKEN_TEMPORARY,
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

describe('normalizeStoredCustomPolishPrompts', () => {
    it('returns empty array for blank or non-array input', () => {
        expect(normalizeStoredCustomPolishPrompts(null)).toEqual([]);
        expect(normalizeStoredCustomPolishPrompts('')).toEqual([]);
        expect(normalizeStoredCustomPolishPrompts([])).toEqual([]);
    });

    it('returns empty array with no legacy and no new data', () => {
        expect(normalizeStoredCustomPolishPrompts('', undefined)).toEqual([]);
    });

    it('migrates legacy polishingPrompt when new array is missing', () => {
        const result = normalizeStoredCustomPolishPrompts(undefined, 'my custom prompt');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('自定义润色提示词');
        expect(result[0].systemPrompt).toBe('my custom prompt');
        expect(result[0].id).toMatch(/^custom-/);
    });

    it('does not revive legacy polishingPrompt when new array is empty', () => {
        expect(normalizeStoredCustomPolishPrompts([], 'my custom prompt')).toEqual([]);
    });

    it('ignores legacy default prompt as empty', () => {
        expect(normalizeStoredCustomPolishPrompts(undefined, DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT)).toEqual([]);
    });

    it('ignores legacy blank prompt', () => {
        expect(normalizeStoredCustomPolishPrompts(undefined, '   ')).toEqual([]);
    });

    it('filters invalid items from array', () => {
        const input = [
            { id: 'a', name: 'valid', systemPrompt: 'prompt' },
            null,
            'not an object',
            { id: '', name: 'bad', systemPrompt: 'x' },
            { id: 'b', name: '', systemPrompt: 'x' },
            { id: 'c', name: 'ok', systemPrompt: '  ' },
        ];
        const result = normalizeStoredCustomPolishPrompts(input);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('a');
    });

    it('deduplicates by id', () => {
        const input = [
            { id: 'dup', name: 'first', systemPrompt: 'one' },
            { id: 'dup', name: 'second', systemPrompt: 'two' },
            { id: 'unique', name: 'ok', systemPrompt: 'three' },
        ];
        const result = normalizeStoredCustomPolishPrompts(input);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('dup');
        expect(result[0].name).toBe('first');
    });

    it('trims id, name, and systemPrompt', () => {
        const input = [{ id: ' a ', name: ' b ', systemPrompt: ' c ' }];
        const result = normalizeStoredCustomPolishPrompts(input);
        expect(result[0].id).toBe('a');
        expect(result[0].name).toBe('b');
        expect(result[0].systemPrompt).toBe('c');
    });

    it('prefers new array over legacy migration', () => {
        const input = [{ id: 'new-one', name: 'new', systemPrompt: 'new prompt' }];
        const result = normalizeStoredCustomPolishPrompts(input, 'legacy prompt');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('new-one');
    });

    it('preserves optional timestamps', () => {
        const now = Date.now();
        const input = [{ id: 'ts', name: 'ts', systemPrompt: 'p', createdAt: now, updatedAt: now + 1 }];
        const result = normalizeStoredCustomPolishPrompts(input);
        expect(result[0].createdAt).toBe(now);
        expect(result[0].updatedAt).toBe(now + 1);
    });
});

describe('normalizePolishPickerOrder', () => {
    it('returns default order for blank input', () => {
        const result = normalizePolishPickerOrder(null, new Set());
        expect(result).toContain(POLISH_PICKER_TOKEN_DEFAULT);
        expect(result).toContain(POLISH_PICKER_TOKEN_TEMPORARY);
    });

    it('returns full default order for empty array input', () => {
        const result = normalizePolishPickerOrder([], new Set());
        expect(result).toEqual(getDefaultPolishPickerOrder());
    });

    it('filters invalid tokens', () => {
        const result = normalizePolishPickerOrder([null, '', '   ', 42, POLISH_PICKER_TOKEN_DEFAULT], new Set());
        expect(result).toEqual(getDefaultPolishPickerOrder());
    });

    it('deduplicates tokens', () => {
        const input = [POLISH_PICKER_TOKEN_DEFAULT, POLISH_PICKER_TOKEN_DEFAULT, POLISH_PICKER_TOKEN_TEMPORARY];
        const result = normalizePolishPickerOrder(input, new Set());
        expect(result[0]).toBe(POLISH_PICKER_TOKEN_DEFAULT);
        expect(result[1]).toBe(POLISH_PICKER_TOKEN_TEMPORARY);
        for (const id of PROMPT_POLISH_PRESET_IDS) {
            expect(result).toContain(id);
        }
    });

    it('accepts valid built-in preset ids', () => {
        const input = [POLISH_PICKER_TOKEN_DEFAULT, 'cinematic', POLISH_PICKER_TOKEN_TEMPORARY];
        const result = normalizePolishPickerOrder(input, new Set());
        expect(result.slice(0, 3)).toEqual([POLISH_PICKER_TOKEN_DEFAULT, 'cinematic', POLISH_PICKER_TOKEN_TEMPORARY]);
    });

    it('accepts saved custom prompt ids', () => {
        const customIds = new Set(['custom-1', 'custom-2']);
        const input = [POLISH_PICKER_TOKEN_DEFAULT, 'custom-1', POLISH_PICKER_TOKEN_TEMPORARY];
        const result = normalizePolishPickerOrder(input, customIds);
        expect(result.slice(0, 3)).toEqual([POLISH_PICKER_TOKEN_DEFAULT, 'custom-1', POLISH_PICKER_TOKEN_TEMPORARY]);
        expect(result).toContain('custom-2');
    });

    it('ensures default and temporary tokens exist', () => {
        const input = ['cinematic', 'balanced'];
        const result = normalizePolishPickerOrder(input, new Set());
        expect(result).toContain(POLISH_PICKER_TOKEN_DEFAULT);
        expect(result).toContain(POLISH_PICKER_TOKEN_TEMPORARY);
    });

    it('preserves order of valid tokens', () => {
        const customIds = new Set(['custom-1']);
        const input = ['custom-1', POLISH_PICKER_TOKEN_TEMPORARY, POLISH_PICKER_TOKEN_DEFAULT, 'cinematic'];
        const result = normalizePolishPickerOrder(input, customIds);
        expect(result.slice(0, 4)).toEqual(['custom-1', POLISH_PICKER_TOKEN_TEMPORARY, POLISH_PICKER_TOKEN_DEFAULT, 'cinematic']);
    });

    it('appends missing built-in presets after preserved items', () => {
        const result = normalizePolishPickerOrder([POLISH_PICKER_TOKEN_TEMPORARY], new Set());
        expect(result[0]).toBe(POLISH_PICKER_TOKEN_TEMPORARY);
        for (const id of PROMPT_POLISH_PRESET_IDS) {
            expect(result).toContain(id);
        }
    });
});

describe('getDefaultPolishPickerOrder', () => {
    it('returns a new array each time', () => {
        const a = getDefaultPolishPickerOrder();
        const b = getDefaultPolishPickerOrder();
        expect(a).not.toBe(b);
        expect(a).toEqual(b);
    });

    it('contains default and temporary tokens', () => {
        const order = getDefaultPolishPickerOrder();
        expect(order).toContain(POLISH_PICKER_TOKEN_DEFAULT);
        expect(order).toContain(POLISH_PICKER_TOKEN_TEMPORARY);
    });

    it('places custom prompts before built-in presets and temporary custom', () => {
        const order = getDefaultPolishPickerOrder(['custom-a']);
        expect(order[0]).toBe(POLISH_PICKER_TOKEN_DEFAULT);
        expect(order[1]).toBe('custom-a');
        expect(order.at(-1)).toBe(POLISH_PICKER_TOKEN_TEMPORARY);
    });
});
